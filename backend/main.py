import logging
import json
import os

import bcrypt  # Must import before passlib to avoid version conflict
import gspread
import numpy as np
import pandas as pd
from database import engine, SessionLocal
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import service_account
from jose import jwt
from datetime import datetime, timedelta
from models import Base, User
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB ────────────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth ──────────────────────────────────────────────────────────────────────
# FIX #9 – Never hardcode secrets; read from env
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"

# FIX #5 – Explicit bcrypt import above prevents passlib/bcrypt version crash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Google Sheets (lazy, non-crashing init) ───────────────────────────────────
# FIX #1 & #2 – Don't crash the whole app at startup; log and continue
SHEET_URL = "https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0"

_sheet = None  # module-level singleton; populated once


def get_sheet():
    """Return the gspread Sheet object, initializing on first call."""
    global _sheet
    if _sheet is not None:
        return _sheet

    creds_raw = os.getenv("GOOGLE_CREDS")
    if not creds_raw:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_CREDS environment variable is not set on the server.",
        )

    try:
        creds_json = json.loads(creds_raw)
    except json.JSONDecodeError as exc:
        logger.error("GOOGLE_CREDS is not valid JSON: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_CREDS is not valid JSON. Check your Render env var for escaped quotes or newlines.",
        )

    scope = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    try:
        creds = service_account.Credentials.from_service_account_info(creds_json, scopes=scope)
        client = gspread.authorize(creds)
        _sheet = client.open_by_url(SHEET_URL).sheet1
        logger.info("Google Sheets initialized successfully.")
    except Exception as exc:
        logger.error("Google Sheets init failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to Google Sheets: {exc}",
        )

    return _sheet


# ── Schemas ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # FIX #3 – session managed by dependency (auto-closed)
    user = db.query(User).filter(User.username == data.username).first()

    # FIX: explicit 401 instead of NoneType crash
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/change-password")
def change_password(data: dict, user=Depends(verify_token), db: Session = Depends(get_db)):
    # FIX #3 & #4 – session managed by DI; guard against None user
    current_user = db.query(User).filter(User.username == user["sub"]).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.get("old_password", ""), current_user.password):
        raise HTTPException(status_code=400, detail="Wrong old password")

    current_user.password = hash_password(data["new_password"])
    db.commit()
    return {"msg": "Password updated"}


@app.get("/data")
def get_data(year: int = Query(None), user=Depends(verify_token)):
    sheet = get_sheet()  # FIX #2 – sheet access inside the route, with proper error

    try:
        data = sheet.get_all_records()
        df = pd.DataFrame(data)

        # Clean column names
        df.columns = (
            df.columns
            .str.strip()
            .str.replace('\n', ' ', regex=False)
            .str.replace('\r', ' ', regex=False)
            .str.replace(r'\s+', ' ', regex=True)
        )

        # Fill nulls for known numeric columns
        df = df.fillna({
            'Deal Price': 0,
            'Net Profit (without Driver Salary)': 0,
            'Profit Percentage': 0,
            'Number of Days': 0,
            'Total Cash': 0,
            'Total Bank': 0,
        })

        df['Customer Name'] = df['Customer Name'].astype(str).str.strip()

        # Parse dates
        df['Start Date'] = pd.to_datetime(df['Start Date'], format='%m/%d/%Y', errors='coerce')

        # Derived date fields
        df['Month'] = df['Start Date'].dt.to_period('M').astype(str)
        df['MonthName'] = df['Start Date'].dt.strftime('%B')
        df['MonthNum'] = df['Start Date'].dt.month
        df['DayOfWeek'] = df['Start Date'].dt.day_name()
        df['Year'] = df['Start Date'].dt.year

        # FIX #6 – cast year to int to avoid NaN in list
        years = sorted([int(y) for y in df['Year'].dropna().unique()])

        if year is None:
            year = df['Year'].max()

        df = df[df['Year'] == year]

        # Route column
        df['Route'] = (
            df['Trip From'].astype(str).str.strip()
            + ' → '
            + df['Trip TO'].astype(str).str.strip()
        )

        # Clean numeric columns
        def clean_numeric(col):
            return pd.to_numeric(
                df[col].astype(str)
                .str.replace(',', '', regex=False)
                .str.replace('₹', '', regex=False)
                .str.replace('%', '', regex=False),
                errors='coerce',
            )

        numeric_cols = [
            'Deal Price', 'Net Profit (without Driver Salary)', 'Profit Percentage',
            'Number of Days', 'Total Cash', 'Total Bank',
            'Tolls & Taxes', 'Parking', 'Driver Allowance',
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = clean_numeric(col)

        df = df.fillna(0)

        # KPIs
        total_revenue = df['Deal Price'].sum()
        total_profit = df['Net Profit (without Driver Salary)'].sum()
        avg_margin = df['Profit Percentage'].mean()
        avg_deal = df['Deal Price'].mean()
        avg_days = df['Number of Days'].mean()
        cash_total = float(df['Total Cash'].sum())
        bank_total = float(df['Total Bank'].sum())

        # Monthly aggregation
        monthly = df.groupby('MonthNum').agg(
            Month=('MonthName', 'first'),
            Trips=('Deal Price', 'count'),
            Revenue=('Deal Price', 'sum'),
            NetProfit=('Net Profit (without Driver Salary)', 'sum'),
            AvgMargin=('Profit Percentage', 'mean'),
            RevPerTrip=('Deal Price', 'mean'),
        ).reset_index().sort_values('MonthNum')

        # Vehicle aggregation
        veh = df.groupby('Vehicle Details').agg(
            Trips=('Deal Price', 'count'),
            TotalRevenue=('Deal Price', 'sum'),
            AvgDealPrice=('Deal Price', 'mean'),
            AvgMargin=('Profit Percentage', 'mean'),
            TotalProfit=('Net Profit (without Driver Salary)', 'sum'),
        ).sort_values('TotalRevenue', ascending=False)

        # Routes
        routes = df.groupby('Route').agg(
            TripCount=('Deal Price', 'count'),
            TotalRevenue=('Deal Price', 'sum'),
            AvgDeal=('Deal Price', 'mean'),
            AvgMargin=('Profit Percentage', 'mean'),
        ).sort_values('TripCount', ascending=False)

        # Cost columns – ensure they exist
        cost_cols = ['Fuel', 'Tolls & Taxes', 'Parking', 'Driver Allowance', 'Sales Commission']
        for col in cost_cols:
            if col not in df.columns:
                df[col] = 0

        required_cols = cost_cols + ['Deal Price', 'Number of Days']
        veh_full = df.groupby('Vehicle Details')[required_cols].sum()

        total_cost_series = veh_full[cost_cols].sum(axis=1)
        profit_series = veh_full['Deal Price'] - total_cost_series

        profit_per_day = (
            (profit_series / veh_full['Number of Days'])
            .replace([np.inf, -np.inf], 0)
            .fillna(0)
            .round(2)
            .sort_values(ascending=False)
        )
        vehicle_profit_per_day = [{"vehicle": k, "value": float(v)} for k, v in profit_per_day.items()]

        vehicle_deal = veh_full['Deal Price'].sort_values(ascending=False)
        vehicle_deal_data = [{"vehicle": k, "value": float(v)} for k, v in vehicle_deal.items()]

        parking_per_day = (
            (veh_full['Parking'] / veh_full['Number of Days'])
            .replace([np.inf, -np.inf], 0)
            .fillna(0)
            .round(2)
            .sort_values(ascending=False)
        )
        parking_data = [{"vehicle": k, "value": float(v)} for k, v in parking_per_day.items()]

        # Top routes
        top_routes = routes.head(10).reset_index()
        top_routes['ShortRoute'] = top_routes['Route'].apply(
            lambda r: r[:30] + '...' if len(r) > 30 else r
        )

        # Duration distribution
        duration_counts = df['Number of Days'].value_counts().sort_index()
        duration_data = [{"days": int(d), "trips": int(v)} for d, v in duration_counts.items()]

        # Day-of-week
        dow_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        dow_counts = df['DayOfWeek'].value_counts().reindex(dow_order).fillna(0)
        dow_data = [{"day": d, "trips": int(v)} for d, v in dow_counts.items()]

        # Cost breakdown
        cost_totals = df[cost_cols].sum()
        total_cost_val = cost_totals.sum()
        cost_data = [
            {
                "name": col,
                "value": float(val),
                "percent": round(val / total_cost_val * 100, 1) if total_cost_val != 0 else 0,
            }
            for col, val in cost_totals.items()
        ]

        # Payment split
        total_collected = cash_total + bank_total
        payment_split = [
            {
                "name": "Cash",
                "value": cash_total,
                "percent": round(cash_total / total_collected * 100, 1) if total_collected > 0 else 0,
            },
            {
                "name": "Bank Transfer",
                "value": bank_total,
                "percent": round(bank_total / total_collected * 100, 1) if total_collected > 0 else 0,
            },
        ]

        monthly_pay = df.groupby('MonthNum').agg(
            Cash=('Total Cash', 'sum'),
            Bank=('Total Bank', 'sum'),
        ).reset_index()
        monthly_payment = monthly_pay.to_dict(orient='records')

        monthly_costs = df.groupby('MonthNum')[cost_cols].sum().reset_index()
        monthly_cost_data = monthly_costs.to_dict(orient='records')

        # Top customers
        custs = df.groupby('Customer Name')['Deal Price'].sum().sort_values(ascending=False).head(10)
        cust_df = custs.reset_index()
        cust_df.columns = ['Customer', 'Revenue']
        cust_data = cust_df.to_dict(orient='records')

        # FIX #7 – safe discrepancy handling
        if 'Difference' in df.columns:
            discrepancies = df[df['Difference'] != 0]
            discrepancy_count = int(len(discrepancies))
            discrepancy_total = float(discrepancies['Difference'].sum())
        else:
            discrepancy_count = 0
            discrepancy_total = 0.0

        # FIX #8 – guard against empty grouped frames
        if len(monthly) > 0:
            best_month_row = monthly.loc[monthly['Revenue'].idxmax()]
            best_month = best_month_row['Month']
            best_month_revenue = float(best_month_row['Revenue'])
        else:
            best_month, best_month_revenue = "N/A", 0.0

        best_vehicle = veh.index[0] if len(veh) > 0 else "N/A"
        best_vehicle_revenue = float(veh.iloc[0]['TotalRevenue']) if len(veh) > 0 else 0.0
        best_vehicle_margin = float(veh.iloc[0]['AvgMargin']) if len(veh) > 0 else 0.0

        best_cust = custs.index[0] if len(custs) > 0 else "N/A"
        best_cust_revenue = float(custs.iloc[0]) if len(custs) > 0 else 0.0

        best_route = routes.index[0] if len(routes) > 0 else "N/A"

        sat_trips = int(dow_counts.get('Saturday', 0))

        fuel_pct = (df['Fuel'].sum() / total_cost_val * 100) if total_cost_val > 0 else 0
        digital_pct = (bank_total / total_collected * 100) if total_collected > 0 else 0

        insights = {
            "best_month": best_month,
            "best_month_revenue": best_month_revenue,
            "best_customer": best_cust,
            "best_customer_revenue": best_cust_revenue,
            "best_vehicle": best_vehicle,
            "best_vehicle_revenue": best_vehicle_revenue,
            "best_vehicle_margin": best_vehicle_margin,
            "best_route": best_route,
            "sat_trips": sat_trips,
            "fuel_pct": round(fuel_pct, 1),
            "digital_pct": round(digital_pct, 1),
            "discrepancy_count": discrepancy_count,
            "discrepancy_total": discrepancy_total,
        }

        profit_duration = (
            df.groupby('Number of Days')['Net Profit (without Driver Salary)'].sum().reset_index()
        )
        profit_duration_data = [
            {"days": int(row["Number of Days"]), "profit": float(row["Net Profit (without Driver Salary)"])}
            for _, row in profit_duration.iterrows()
        ]

        return {
            "success": True,
            "years": years,
            "kpi": {
                "total_revenue": round(float(total_revenue), 2),
                "total_profit": round(float(total_profit), 2),
                "avg_margin": round(float(avg_margin), 2),
                "avg_deal": round(float(avg_deal), 2),
                "avg_days": round(float(avg_days), 2),
                "cash_total": round(cash_total, 2),
                "bank_total": round(bank_total, 2),
            },
            "monthly": monthly.to_dict(orient='records'),
            "vehicle": veh.reset_index().to_dict(orient='records'),
            "top_customers": cust_data,
            "routes": top_routes.to_dict(orient='records'),
            "cost_breakdown": cost_data,
            "monthly_cost": monthly_cost_data,
            "duration_dist": duration_data,
            "day_of_week": dow_data,
            "payment_split": payment_split,
            "monthly_payment": monthly_payment,
            "insights": insights,
            "extra_insights": {
                "vehicle_profit_per_day": vehicle_profit_per_day,
                "vehicle_deal": vehicle_deal_data,
                "parking_per_day": parking_data,
                "profit_by_duration": profit_duration_data,
            },
        }

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.exception("Unhandled error in /data")
        # Return structured JSON error instead of a plain 500
        raise HTTPException(status_code=500, detail=f"Data processing error: {str(e)}")