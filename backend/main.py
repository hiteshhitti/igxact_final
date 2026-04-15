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

load_dotenv()

app = FastAPI()

security = HTTPBearer()



pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)


SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise Exception("SECRET_KEY missing")

ALGORITHM = "HS256"


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])



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
    allow_origins=["*"],
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




@app.post("/change-password")
def change_password(data: dict, user=Depends(verify_token)):
    db: Session = SessionLocal()
    try:
        current_user = db.query(User).filter(User.username == user["sub"]).first()

        if not verify_password(data["old_password"], current_user.password):
            raise HTTPException(status_code=400, detail="Wrong old password")

        current_user.password = hash_password(data["new_password"])
        db.commit()

        return {"msg": "Password updated"}
    finally:
        db.close()

@app.get("/data")
def get_data(year: int = Query(None), 
             user=Depends(verify_token),
             month: int = Query(None), 
             ):
    try:
        # 📥 Load data
        client = get_client()

        if not client:
            raise HTTPException(status_code=500, detail="Google Sheets connection failed")


        sheet=client.open_by_url("https://docs.google.com/spreadsheets/d/11SVXk8gh1RRwS7U-rvxfnYx_ieIrqoyAavmkFWwMHjA/edit?gid=0#gid=0").sheet1
        data=sheet.get_all_records()
        df = pd.DataFrame(data)

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

        years = sorted(df['Year'].dropna().unique().tolist())

        if year:
            df = df[df['Year'] == year]
        
        # if year is None:
        #     year = df['Year'].max()
        #     df = df[df['Year'] == year]

        
        df = df[df['Year'] == year]
        
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
            return pd.to_numeric(
                df[col]
                .astype(str)
                .str.replace(',', '')
                .str.replace('₹', '')
                .str.replace('%', ''),
                errors='coerce'
            )

        df['Deal Price'] = clean_numeric('Deal Price')
        df['Net Profit (without Driver Salary)'] = clean_numeric('Net Profit (without Driver Salary)')
        df['Profit Percentage'] = clean_numeric('Profit Percentage')
        df['Number of Days'] = clean_numeric('Number of Days')
        df['Total Cash'] = clean_numeric('Total Cash')
        df['Total Bank'] = clean_numeric('Total Bank')
        df['Tolls & Taxes'] = clean_numeric('Tolls & Taxes')
        df['Parking'] = clean_numeric('Parking')
        df['Driver Allowance'] = clean_numeric('Driver Allowance')

        df = df.fillna(0)

        # 📊 KPI calculations
        total_revenue = df['Deal Price'].sum()
        total_profit = df['Net Profit (without Driver Salary)'].sum()
        avg_margin = df['Profit Percentage'].mean()
        avg_deal = df['Deal Price'].mean()
        avg_days = df['Number of Days'].mean()

        cash_total = df['Total Cash'].sum()
        bank_total = df['Total Bank'].sum()

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
            best_month_revenue = float(best_month_row['Revenue'])
        else:
            best_month = "N/A"
            best_month_revenue = 0

        best_month = best_month_row['Month']
        best_month_revenue = float(best_month_row['Revenue'])

        best_vehicle = veh.index[0]
        best_vehicle_revenue = float(veh.iloc[0]['TotalRevenue'])
        best_vehicle_margin = float(veh.iloc[0]['AvgMargin'])

        # best_cust = cust.index[0]
        # best_cust_revenue = float(cust.iloc[0])

        if len(custs) > 0:
            best_cust = custs.index[0]
            best_cust_revenue = float(custs.iloc[0])
        else:
            best_cust = "N/A"
            best_cust_revenue = 0

        best_route = routes.index[0]

        sat_trips = int(dow_counts['Saturday'])

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
        print("ERROR:", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")