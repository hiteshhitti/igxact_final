from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import FastAPI, Query, HTTPException, Depends, Header
from models import Base, User
from database import engine, SessionLocal
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from pydantic import BaseModel
import json
import os
from dotenv import load_dotenv
import traceback
from auth import router as auth_router
from utils import verify_password, hash_password, verify_token

load_dotenv()

app = FastAPI()

app.include_router(auth_router)

security = HTTPBearer()






SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise Exception("SECRET_KEY missing")

ALGORITHM = "HS256"






Base.metadata.create_all(bind=engine)


def get_client():
    try:
        creds_env = os.getenv("GOOGLE_CREDS")

        if not creds_env:
            print("GOOGLE_CREDS NOT FOUND")
            return None

        creds_dict = json.loads(creds_env)
        creds = Credentials.from_service_account_info(creds_dict, scopes=scope)

        return gspread.authorize(creds)

    except Exception as e:
        print("GOOGLE ERROR:", e)
        return None


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://igxactpixel.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scope = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]







# creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
# client=gspread.authorize(creds)





class LoginRequest(BaseModel):
    username: str
    password: str



@app.post("/create-user")
def create_user():
    db: Session = SessionLocal()
    try:
        user = User(
            username="admin",
            password=hash_password("1234")
        )
        db.add(user)
        db.commit()
        return {"msg": "User created"}
    finally:
        db.close()


@app.post("/login")
def login(data: LoginRequest):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == data.username).first()

        if not user or not verify_password(data.password, user.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_token({"sub": user.username})

        return {
            "access_token": token,
            "token_type": "bearer"
        }
    finally:
        db.close()




@app.post("/add-trip")
def add_trip(data: dict, user=Depends(verify_token)):
    client = get_client()
    if not client:
        raise HTTPException(status_code=500, detail="Google client failed")

    sheet = client.open_by_url("https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0").sheet1

    records = sheet.get_all_records()
    headers = sheet.row_values(1)

    # 🔥 FIND LAST ID
    trip_ids = []

    for row in records:
        for key in row.keys():
            if key.strip().lower() == "trip id":
                try:
                    trip_ids.append(int(row[key]))
                except:
                    pass

    last_id = max(trip_ids) if trip_ids else (START_ID - 1)
    trip_id = last_id + 1

    # 🔥 BUILD ROW
    row = []
    for col in headers:
        if col.strip().lower() == "trip id":
            row.append(trip_id)
        else:
            row.append(data.get(col, ""))

    sheet.append_row(row, value_input_option="USER_ENTERED")

    return {"msg": "Trip added", "trip_id": trip_id}


@app.get("/columns")
def get_columns(user=Depends(verify_token)):
    try:
        client = get_client()
        if not client:
            raise HTTPException(status_code=500, detail="Google client failed")
        sheet = client.open_by_url("https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0").sheet1

        headers = sheet.row_values(1)

        return headers or []

    except Exception as e:
        print("COLUMNS ERROR:", e)
        raise HTTPException(status_code=500, detail="Columns fetch failed")


@app.get("/trips")
def get_trips(
    start: str = Query(None),
    end: str = Query(None),
    trip_id: str = Query(None),
    mobile: str = Query(None),
    user=Depends(verify_token)
):
    try:
        client = get_client()
        if not client:
            raise HTTPException(status_code=500, detail="Google client failed")

        sheet = client.open_by_url(
            "https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0"
        ).sheet1

        data = sheet.get_all_records()
        df = pd.DataFrame(data)

        # 🔥 SAFE COLUMN CLEAN
        df.columns = df.columns.str.strip()

        print("COLUMNS:", df.columns.tolist())
        print("TRIP_ID:", trip_id)

        # 🔥 SAFE TRIP ID
        if "trip id" in df.columns:
            df["trip id"] = df["trip id"].fillna("").astype(str).str.strip()

        # 🔥 SAFE DATE
        if "Start Date" in df.columns:
            df["Start Date"] = pd.to_datetime(df["Start Date"], errors="coerce")

        # 🔥 SAFE MOBILE
        if "Cust. Contact Number" in df.columns:
            df["Cust. Contact Number"] = df["Cust. Contact Number"].fillna("").astype(str).str.replace(" ", "")

        # 🔥 FILTER SYSTEM
        if trip_id:
            trip_id_str = str(trip_id).strip()

            if "trip id" in df.columns:
                df = df[df["trip id"] == trip_id_str]
            else:
                return {"trips": []}

        else:
            if start and "Start Date" in df.columns:
                df = df[df["Start Date"] >= pd.to_datetime(start)]

            if end and "Start Date" in df.columns:
                df = df[df["Start Date"] <= pd.to_datetime(end)]

            if mobile and "Cust. Contact Number" in df.columns:
                mobile_clean = mobile.replace(" ", "")
                df = df[df["Cust. Contact Number"].str.contains(mobile_clean)]

        # 🔥 SAFE NUMERIC CLEAN
        def clean(col):
            if col not in df.columns:
                return 0
            return pd.to_numeric(
                df[col].astype(str).str.replace(",", ""),
                errors="coerce"
            ).fillna(0)

        df["Deal Price"] = clean("Deal Price")
        df["AdvanceCash"] = clean("Booking Amt/Advance Cash")
        df["AdvanceBank"] = clean("Booking Amt/Advance Bank")

        df["Received"] = df["AdvanceCash"] + df["AdvanceBank"]
        df["Pending"] = df["Deal Price"] - df["Received"]

        # 🔥 SAFE STATUS
        if "Status" in df.columns:
            df["Status"] = df["Status"].astype(str).str.strip().str.lower()

        return {
            "trips": df.fillna("").to_dict(orient="records")
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    # ✅ CLEAN NUMBERS
    def clean(col):
        if col not in df.columns:
            return 0
        return pd.to_numeric(
            df[col].astype(str).str.replace(',', ''),
            errors='coerce'
        ).fillna(0)

    df['Deal Price'] = clean('Deal Price')
    df['AdvanceCash'] = clean('Booking Amt/Advance Cash')
    df['AdvanceBank'] = clean('Booking Amt/Advance Bank')

    df['Received'] = df['AdvanceCash'] + df['AdvanceBank']
    df['Pending'] = df['Deal Price'] - df['Received']

    df['Status'] = df['Status'].astype(str).str.strip().str.lower()

    return {
        "trips": df.fillna("").to_dict(orient="records")
    }

    df['Deal Price'] = clean('Deal Price')
    df['AdvanceCash'] = clean('Booking Amt/Advance Cash')
    df['AdvanceBank'] = clean('Booking Amt/Advance Bank')

    df['Received'] = df['AdvanceCash'] + df['AdvanceBank']
    df['Pending'] = df['Deal Price'] - df['Received']

    # ✅ STATUS CLEAN
    df['Status'] = df['Status'].astype(str).str.strip().str.lower()


    # 🔥 SPLIT
    df_completed = df[df['Status'].str.contains('completed', na=False)]
    df_progress = df[df['Status'].str.contains('progress', na=False)]
    df_booked = df[df['Status'].str.contains('booked', na=False)]

    # ✅ SUMMARY FUNCTION
    def summary(d):
        return {
            "trips": int(len(d)),
            "revenue": float(d['Deal Price'].sum()),
            "received": float(d['Received'].sum()),
            "pending": float(d['Pending'].sum())
        }

    return {
        "completed": summary(df_completed),
        "progress": summary(df_progress),
        "booked": summary(df_booked),
        "trips": df.fillna("").to_dict(orient="records")
    }

@app.put("/update-trip/{trip_id}")
def update_trip(trip_id: int, data: dict, user=Depends(verify_token)):
    client = get_client()
    if not client:
        raise HTTPException(status_code=500, detail="Google client failed")

    sheet = client.open_by_url("https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0").sheet1

    records = sheet.get_all_records()
    headers = sheet.row_values(1)

    for i, row in enumerate(records):
        trip_key = None

        for key in row.keys():
            if key.strip().lower() == "trip id":
                trip_key = key
                break

        value = row.get(trip_key, 0)

        try:
            value = int(value)
        except:
            value = 0

        if trip_key and value == trip_id:
            row_index = i + 2  # skip header

            updated_row = []

            for col in headers:
                if col.strip().lower() == "trip id":
                    updated_row.append(trip_id)
                else:
                    updated_row.append(data.get(col, ""))

            # 🔥 FULL ROW UPDATE
            sheet.update(f"A{row_index}", [updated_row])

            return {"msg": "Updated successfully"}

    raise HTTPException(status_code=404, detail="Trip not found")

def build_pipeline(df_src):
    if df_src.empty:
        return []

    def clean(col):
        if col not in df_src.columns:
            return 0
        series = df_src[col].astype(str).str.replace(',', '')
        return pd.to_numeric(series, errors='coerce').fillna(0)

    df_src['Deal Price'] = clean('Deal Price')

    df_src['AdvanceCash'] = clean('Booking Amt/Advance Cash')
    df_src['AdvanceBank'] = clean('Booking Amt/Advance Bank')

    df_src['Received'] = df_src['AdvanceCash'] + df_src['AdvanceBank']
    df_src['Pending'] = df_src['Deal Price'] - df_src['Received']

    return df_src[[
        'trip id',
        'Customer Name',
        'Cust. Contact Number',
        'Trip From',
        'Trip TO',
        'Start Date',
        'End date',
        'Vehicle Details',
        'Deal Price',
        'Received',
        'Pending'
    ]].fillna("").to_dict(orient="records")



@app.get("/data")
def get_data(year: int = Query(None), 
             user=Depends(verify_token),
             month: int = Query(None), 
             status: str = Query("all"),
             trip_id: str = Query(None),
             mobile: str = Query(None)
             ):
    try:
        # 📥 Load data
        client = get_client()

        if not client:
            raise HTTPException(status_code=500, detail="Google Sheets connection failed")


        sheet=client.open_by_url("https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0").sheet1
        data=sheet.get_all_records()
        df = pd.DataFrame(data)
        df = df.replace('', np.nan)   # turn all empty strings into NaN
        df = df.fillna(0) 

        df.columns = (
            df.columns
            .str.strip()
            .str.replace('\n', ' ')
            .str.replace('\r', ' ')
            .str.replace(r'\s+', ' ', regex=True)
        )



        

        # 🧹 Clean columns
        df.columns = df.columns.str.strip()
        # df=df.dropna(subset="Customer Name")

        numeric_cols = ['Deal Price', 'Net Profit (without Driver Salary)', 'Profit Percentage',
                'Number of Days', 'Total Cash', 'Total Bank', 'Fuel', 
                'Tolls & Taxes', 'Parking', 'Driver Allowance', 'Sales Commission']

        for col in numeric_cols:
            if col in df.columns:
                df[col] = df[col].replace('', '0')


        # 🧹 Replace null & inf
        df = df.fillna({
            'Deal Price': 0,
            'Net Profit (without Driver Salary)': 0,
            'Profit Percentage': 0,
            'Number of Days': 0,
            'Total Cash': 0,
            'Total Bank': 0
        })

        df['Customer Name'] = df['Customer Name'].astype(str).str.strip()
        # df = df[df['Customer Name'] != '']
        # df.replace([np.inf, -np.inf], 0, inplace=True)

        # 📅 Date convert
        df['Start Date'] = pd.to_datetime(
            df['Start Date'],
            format='%m/%d/%Y',
            errors='coerce'
        )
        # df = df.dropna(subset=['Start Date'])

        # 📊 Derived fields
        df['Month'] = df['Start Date'].dt.to_period('M').astype(str)
        df['MonthName'] = df['Start Date'].dt.strftime('%B')
        df['MonthNum'] = df['Start Date'].dt.month
        df['DayOfWeek'] = df['Start Date'].dt.day_name()
        df['Year'] = df['Start Date'].dt.year

        df['Status'] = df['Status'].astype(str).str.strip().str.lower()

        if trip_id:
            trip_id_str = str(trip_id).strip()
            if "trip id" in df.columns:
                df = df[df["trip id"] == trip_id_str]
            else:
                return {"trips": []}

        else:
            # 🥈 Mobile (optional)
            if mobile:
                df["Cust. Contact Number"] = df["Cust. Contact Number"].astype(str).str.replace(" ", "")
                mobile_clean = mobile.replace(" ", "")
                df = df[df["Cust. Contact Number"].str.contains(mobile_clean)]
            if year:
                df = df[df['Year'] == year]

            if month:
                df = df[df['MonthNum'] == month]

        

        df_progress = df[df['Status'].str.contains('progress', na=False)]
        df_booked = df[df['Status'].str.contains('booked', na=False)]
        df_completed = df[df['Status'].str.contains('completed', na=False)]

        if status == "completed":
            df = df_completed.copy()
        elif status == "progress":
            df = df_progress.copy()
        elif status == "booked":
            df = df_booked.copy()

        progress_data = build_pipeline(df_progress.copy())
        booked_data = build_pipeline(df_booked.copy())

        years = sorted(df['Year'].dropna().unique().tolist())

        # if year:
        #     df = df[df['Year'] == year]
        
        # if year is None:
        #     year = df['Year'].max()
        #     df = df[df['Year'] == year]

        
        # df = df[df['Year'] == year]
        
        if month:
            df = df[df['MonthNum'] == month]

        if df.empty:
            return {
                "success": True,
                "years": years,
                "monthly": [],
                "kpi": {
                    "total_revenue": 0,
                    "total_profit": 0,
                    "avg_margin": 0,
                    "avg_deal": 0,
                    "avg_days": 0,
                    "cash_total": 0,
                    "bank_total": 0,
                },
                "growth": {
                    "revenue_change": 0,
                    "profit_change": 0
                }
            }

        # 🚛 Route
        df['Route'] = df['Trip From'].astype(str).str.strip() + ' → ' + df['Trip TO'].astype(str).str.strip()

        # 🔥 CLEAN NUMERIC COLUMNS
        def clean_numeric(col):
            series = df[col].astype(str).str.strip()
            series = series.replace('', '0')          # pandas Series .replace(), not str method
            series = series.str.replace(',', '', regex=False)
            series = series.str.replace('₹', '', regex=False)
            series = series.str.replace('%', '', regex=False)
            series = series.replace('nan', '0')       # handle 'nan' strings
            series = series.replace('None', '0')      # handle 'None' strings
            return pd.to_numeric(series, errors='coerce').fillna(0)

        df['Deal Price'] = clean_numeric('Deal Price')
        df['Net Profit (without Driver Salary)'] = clean_numeric('Net Profit (without Driver Salary)')
        df['Profit Percentage'] = clean_numeric('Profit Percentage')
        df['Number of Days'] = clean_numeric('Number of Days')
        df['Total Cash'] = clean_numeric('Total Cash')
        df['Total Bank'] = clean_numeric('Total Bank')
        df['Tolls & Taxes'] = clean_numeric('Tolls & Taxes')
        df['Parking'] = clean_numeric('Parking')
        df['Driver Allowance'] = clean_numeric('Driver Allowance')
        df['Fuel'] = clean_numeric('Fuel')
        df['Sales Commission'] = clean_numeric('Sales Commission')

        df = df.fillna(0)

        # 📊 KPI calculations
        
        total_revenue = df['Deal Price'].sum()
        total_profit = df['Net Profit (without Driver Salary)'].sum()
        avg_margin = df['Profit Percentage'].mean()
        avg_deal = df['Deal Price'].mean()
        avg_days = df['Number of Days'].mean()

        cash_total = df['Total Cash'].sum()
        bank_total = df['Total Bank'].sum()

        for col in ["Fuel", "Tolls & Taxes", "Parking", "Driver Allowance", "Sales Commission"]:
            if col not in df.columns:
                df[col] = 0
        
        df["TotalExpense"] = (
            df["Fuel"] +
            df["Tolls & Taxes"] +
            df["Parking"] +
            df["Driver Allowance"] +
            df["Sales Commission"]
        )

        monthly = df.groupby('MonthNum').agg(
            Month=('MonthName', 'first'),
            Trips=('Deal Price', 'count'),
            Revenue=('Deal Price', 'sum'),
            NetProfit=('Net Profit (without Driver Salary)', 'sum'),
            TotalExpense=('TotalExpense', 'sum'),
            AvgMargin=('Profit Percentage', 'mean'),
            RevPerTrip=('Deal Price', 'mean')
        ).reset_index()

        veh = df.groupby('Vehicle Details').agg(
            Trips=('Deal Price', 'count'),
            TotalRevenue=('Deal Price', 'sum'),
            AvgDealPrice=('Deal Price', 'mean'),
            AvgMargin=('Profit Percentage', 'mean'),
            TotalProfit=('Net Profit (without Driver Salary)', 'sum')
        ).sort_values('TotalRevenue', ascending=False)

        routes = df.groupby('Route').agg(
            TripCount=('Deal Price', 'count'),
            TotalRevenue=('Deal Price', 'sum'),
            AvgDeal=('Deal Price', 'mean'),
            AvgMargin=('Profit Percentage', 'mean')
        ).sort_values('TripCount', ascending=False)


        cost_cols = ["Fuel", "Tolls & Taxes", "Parking", "Driver Allowance", "Sales Commission"]

        

        required_cols = cost_cols + ["Deal Price", "Number of Days"] 
        for col in required_cols:
            if col not in df.columns:
                df[col] = 0


        veh_full = df.groupby("Vehicle Details")[required_cols].sum()

        

        total_cost = veh_full[cost_cols].sum(axis=1)
        profit = veh_full["Deal Price"] - total_cost

        profit_per_day = (profit / veh_full["Number of Days"]).replace([np.inf, -np.inf], 0).fillna(0)
        profit_per_day = profit_per_day.round(2).sort_values(ascending=False)

        vehicle_profit_per_day = [
            {"vehicle": k, "value": float(v)}
            for k, v in profit_per_day.items()
        ]

        vehicle_deal = veh_full["Deal Price"].sort_values(ascending=False)

        vehicle_deal_data = [
            {"vehicle": k, "value": float(v)}
            for k, v in vehicle_deal.items()
        ]

        parking_per_day = (veh_full["Parking"] / veh_full["Number of Days"]).replace([np.inf, -np.inf], 0).fillna(0)
        parking_per_day = parking_per_day.round(2).sort_values(ascending=False)

        parking_data = [
            {"vehicle": k, "value": float(v)}
            for k, v in parking_per_day.items()
        ]

        top_routes = routes.head(10).reset_index()

        top_routes['ShortRoute'] = top_routes['Route'].apply(
            lambda r: r[:30] + '...' if len(r) > 30 else r
        )

        cost_cols = ['Fuel', 'Tolls & Taxes', 'Parking', 'Driver Allowance', 'Sales Commission']
        duration_counts = df['Number of Days'].value_counts().sort_index()

        duration_data = []
        for d, v in duration_counts.items():
            duration_data.append({
                "days": int(d),
                "trips": int(v)
            })

        dow_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        dow_counts = df['DayOfWeek'].value_counts().reindex(dow_order).fillna(0)

        dow_data = []
        for d, v in dow_counts.items():
            dow_data.append({
                "day": d,
                "trips": int(v)
            })

        for col in cost_cols:
            if col not in df.columns:
                df[col] = 0
        
        cost_totals = df[cost_cols].sum()

        cost_data = []


        # 🔥 REVENUE BREAKDOWN (expenses + profit)

        total_profit_val = df['Net Profit (without Driver Salary)'].sum()

        revenue_breakdown = []

        # expenses
        for col, val in cost_totals.items():
            revenue_breakdown.append({
                "name": col,
                "value": float(val)
            })

        # profit add
        revenue_breakdown.append({
            "name": "Profit",
            "value": float(total_profit_val)
        })

        total_cost = cost_totals.sum()

        for col, val in cost_totals.items():
            pct = (val / total_cost * 100) if total_cost != 0 else 0
            cost_data.append({
                "name": col,
                "value": float(val),
                "percent": round(pct, 1)
            })

        cash_total = float(df['Total Cash'].sum())
        bank_total = float(df['Total Bank'].sum())
        total_collected = cash_total + bank_total

        payment_split = [
            {
                "name": "Cash",
                "value": cash_total,
                "percent": round((cash_total / total_collected) * 100, 1) if total_collected > 0 else 0
            },
            {
                "name": "Bank Transfer",
                "value": bank_total,
                "percent": round((bank_total / total_collected) * 100, 1) if total_collected > 0 else 0
            }
        ]

        monthly_pay = df.groupby('MonthNum').agg(
            Cash=('Total Cash', 'sum'),
            Bank=('Total Bank', 'sum')
        ).reset_index()

        monthly_payment = monthly_pay.to_dict(orient="records")

        monthly_costs = df.groupby('MonthNum')[cost_cols].sum().reset_index()

        monthly_cost_data = monthly_costs.to_dict(orient="records")

        routes_data = top_routes.to_dict(orient="records")


        custs = df.groupby("Customer Name")["Deal Price"].sum().sort_values(ascending=False).head(10)

        cust_data = custs.reset_index()
        cust_data.columns = ["Customer", "Revenue"]

        cust_data = cust_data.to_dict(orient="records")

        veh_data = veh.reset_index().to_dict(orient="records")

        monthly = monthly.sort_values('MonthNum')

        monthly_data = monthly.to_dict(orient="records")

        # discrepancies = df[df['Difference'] != 0]
        
        if 'Difference' in df.columns:
            discrepancies = df[df['Difference'] != 0]
        else:
            discrepancies = pd.DataFrame()


        discrepancy_count = int(len(discrepancies))
        discrepancy_total = float(discrepancies['Difference'].sum())

        # 🔥 Best values
        # best_month_row = monthly.loc[monthly['Revenue'].idxmax()]

        if not monthly.empty:
            best_month_row = monthly.loc[monthly['Revenue'].idxmax()]
            best_month = best_month_row['Month']
            best_month_revenue = float(best_month_row.get('Revenue', 0) or 0)
        else:
            best_month = "N/A"
            best_month_revenue = 0


        if len(veh) > 0:
            best_vehicle = veh.index[0]

            rev = veh.iloc[0].get('TotalRevenue', 0)
            margin = veh.iloc[0].get('AvgMargin', 0)

            best_vehicle_revenue = float(rev or 0)
            best_vehicle_margin = float(margin or 0)
        else:
            best_vehicle = "N/A"
            best_vehicle_revenue = 0
            best_vehicle_margin = 0

        # best_cust = cust.index[0]
        # best_cust_revenue = float(cust.iloc[0])

        if len(custs) > 0:
            best_cust = custs.index[0]
            best_cust_revenue = float(custs.iloc[0] or 0)
        else:
            best_cust = "N/A"
            best_cust_revenue = 0

        best_route = routes.index[0] if len(routes) > 0 else "N/A"

        sat_trips = int(dow_counts.get('Saturday', 0))

        fuel_pct = (df["Fuel"].sum() / cost_totals.sum() * 100) if cost_totals.sum() > 0 else 0
        digital_pct = (bank_total / (cash_total + bank_total) * 100) if (cash_total + bank_total) > 0 else 0

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
            "discrepancy_total": discrepancy_total
        }


        profit_duration = df.groupby("Number of Days")['Net Profit (without Driver Salary)'].sum().reset_index()

        profit_duration_data = []

        for _, row in profit_duration.iterrows():
            profit_duration_data.append({
                "days": int(row["Number of Days"]),
                "profit": float(row["Net Profit (without Driver Salary)"])
            })

        current_month = datetime.now().month

        target = 250000

        month_targets = []

        for i in range(3):
            m = current_month + i
            if m > 12:
                m = m - 12

            month_data = monthly[monthly["MonthNum"] == m]

            if len(month_data) > 0:
                revenue = float(month_data.iloc[0]["Revenue"])
                trips = int(month_data.iloc[0]["Trips"])
                name = month_data.iloc[0]["Month"]
            else:
                revenue = 0
                trips = 0
                name = datetime(2024, m, 1).strftime("%B")

            month_targets.append({
                "month": name,
                "revenue": revenue,
                "trips": trips,
                "target": target,
                "status": "green" if revenue >= target else "red"
            })

        # ✅ Response
        return {
            "revenue_breakdown": revenue_breakdown,
            "success": True,
            "years": years,
            "month_targets": month_targets,
            "kpi": {
                "total_revenue": round(float(total_revenue), 2),
                "total_profit": round(float(total_profit), 2),
                "avg_margin": round(float(avg_margin), 2),
                "avg_deal": round(float(avg_deal), 2),
                "avg_days": round(float(avg_days), 2),
                "cash_total": round(float(cash_total), 2),
                "bank_total": round(float(bank_total), 2),
            },

            "pipeline_summary": {
                "progress_total": float(sum([x["Deal Price"] for x in progress_data])),
                "progress_received": float(sum([x["Received"] for x in progress_data])),

                "booked_total": float(sum([x["Deal Price"] for x in booked_data])),
                "booked_received": float(sum([x["Received"] for x in booked_data]))
            },

            "pipeline": {
                "progress": progress_data,
                "booked": booked_data
            },
            "monthly": monthly_data,
            "vehicle": veh_data,
            "top_customers": cust_data,
            "routes": routes_data,
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
                "profit_by_duration": profit_duration_data
            }
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))