"""
services/trips.py
─────────────────
Business logic for trips, separated from HTTP layer.
All profit calculations use the CORRECT formula:

  Profit    = Revenue - (Fuel + Tolls & Taxes + Parking +
                         Driver Allowance + Sales Commission + Other Expenses)
  Profit %  = (Profit / Revenue) * 100
"""

import logging
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException

from services.sheets import (
    EXPENSE_COLS,
    REVENUE_COL,
    clean_col,
    load_trips_df,
    open_sheet,
    open_worksheet_by_name,
    safe_float,
)

logger = logging.getLogger(__name__)

START_ID = 1000


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _pipeline_records(df: pd.DataFrame) -> list[dict]:
    """Return slim pipeline dicts for in-progress / booked trips."""
    if df.empty:
        return []

    keep = [
        "trip id", "Customer Name", "Cust. Contact Number",
        "Trip From", "Trip TO", "Start Date", "End date",
        "Vehicle Details", REVENUE_COL, "Received", "Pending",
    ]
    existing = [c for c in keep if c in df.columns]
    return df[existing].fillna("").to_dict(orient="records")


def _safe_summary(d: pd.DataFrame) -> dict:
    return {
        "trips": int(len(d)),
        "revenue": safe_float(d[REVENUE_COL].sum()),
        "received": safe_float(d["Received"].sum()),
        "pending": safe_float(d["Pending"].sum()),
        "other_expenses": safe_float(d["Other Expenses"].sum()) if "Other Expenses" in d.columns else 0.0,
    }


# ─────────────────────────────────────────────
# Vehicles
# ─────────────────────────────────────────────

def get_vehicles() -> list[str]:
    ws = open_worksheet_by_name("Vehichles")
    try:
        data = ws.get_all_records()
    except Exception as e:
        logger.error(f"Vehicles read error: {e}")
        raise HTTPException(status_code=500, detail="Could not read vehicles")

    return [
        str(row["Vehicle Name"]).strip()
        for row in data
        if row.get("Vehicle Name") and str(row.get("Vehicle Name")).strip()
    ]


def add_vehicle(name: str) -> dict:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Vehicle name is required")

    ws = open_worksheet_by_name("Vehichles")
    try:
        existing = ws.get_all_records()
    except Exception as e:
        logger.error(f"Vehicles read error: {e}")
        raise HTTPException(status_code=500, detail="Could not read vehicles")

    existing_names = {str(r["Vehicle Name"]).strip().lower() for r in existing}
    if name.lower() in existing_names:
        return {"msg": "Already exists"}

    ws.append_row([name])
    return {"msg": "Vehicle added"}


# ─────────────────────────────────────────────
# Trips CRUD
# ─────────────────────────────────────────────

def add_trip(data: dict) -> dict:
    logger.info(f"add_trip: customer='{data.get('Customer Name', '')}' vehicle='{data.get('Vehicle Details', '')}'")
    sheet = open_sheet("0")
    try:
        records = sheet.get_all_records()
        headers = sheet.row_values(1)
    except Exception as e:
        logger.error(f"Sheet read error during add_trip: {e}")
        raise HTTPException(status_code=500, detail="Failed to read sheet")

    trip_ids = []
    for row in records:
        for key, val in row.items():
            if key.strip().lower() == "trip id":
                try:
                    trip_ids.append(int(val))
                except (ValueError, TypeError):
                    pass

    last_id = max(trip_ids) if trip_ids else (START_ID - 1)
    trip_id = last_id + 1

    row = []
    for col in headers:
        if col.strip().lower() == "trip id":
            row.append(trip_id)
        else:
            row.append(data.get(col, ""))

    try:
        sheet.append_row(row, value_input_option="USER_ENTERED")
    except Exception as e:
        logger.error(f"Sheet append error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save trip")

    return {"msg": "Trip added", "trip_id": trip_id}


def update_trip(trip_id: int, data: dict) -> dict:
    logger.info(f"update_trip: trip_id={trip_id} by customer='{data.get('Customer Name', '')}'")
    sheet = open_sheet("0")
    try:
        records = sheet.get_all_records()
        headers = sheet.row_values(1)
    except Exception as e:
        logger.error(f"Sheet read error during update_trip: {e}")
        raise HTTPException(status_code=500, detail="Failed to read sheet")

    for i, row in enumerate(records):
        trip_key = next((k for k in row if k.strip().lower() == "trip id"), None)
        if not trip_key:
            continue
        try:
            row_trip_id = int(row[trip_key])
        except (ValueError, TypeError):
            continue

        if row_trip_id == trip_id:
            updated_row = [
                trip_id if col.strip().lower() == "trip id" else data.get(col, "")
                for col in headers
            ]
            try:
                sheet.update(f"A{i + 2}", [updated_row])
            except Exception as e:
                logger.error(f"Sheet update error: {e}")
                raise HTTPException(status_code=500, detail="Failed to update trip")
            return {"msg": "Updated successfully"}

    raise HTTPException(status_code=404, detail="Trip not found")


def get_sheet_columns() -> list[str]:
    sheet = open_sheet("0")
    try:
        return sheet.row_values(1)
    except Exception as e:
        logger.error(f"Columns read error: {e}")
        raise HTTPException(status_code=500, detail="Failed to read columns")


# ─────────────────────────────────────────────
# Query / filter helpers
# ─────────────────────────────────────────────

def filter_trips(
    df: pd.DataFrame,
    start: str | None,
    end: str | None,
    trip_id: str | None,
    mobile: str | None,
) -> pd.DataFrame:
    if trip_id:
        return df[df["trip id"] == str(trip_id).strip()]

    if start:
        try:
            df = df[df["Start Date"] >= pd.to_datetime(start)]
        except Exception:
            pass
    if end:
        try:
            df = df[df["Start Date"] <= pd.to_datetime(end)]
        except Exception:
            pass
    if mobile:
        clean_mobile = mobile.replace(" ", "")
        if "Cust. Contact Number" in df.columns:
            df = df[df["Cust. Contact Number"].str.contains(clean_mobile, na=False)]

    return df


# ─────────────────────────────────────────────
# Public service calls
# ─────────────────────────────────────────────

def query_trips(
    start: str | None = None,
    end: str | None = None,
    trip_id: str | None = None,
    mobile: str | None = None,
) -> dict:
    """Used by /trips and /trips-view endpoints."""
    df = load_trips_df()
    if df.empty:
        empty = _safe_summary(pd.DataFrame())
        return {
            "completed": empty,
            "progress": empty,
            "booked": empty,
            "trips": [],
        }

    df = filter_trips(df, start, end, trip_id, mobile)

    df_completed = df[df["Status"].str.contains("completed", na=False)]
    df_progress = df[df["Status"].str.contains("progress", na=False)]
    df_booked = df[df["Status"].str.contains("booked", na=False)]

    return {
        "completed": _safe_summary(df_completed),
        "progress": _safe_summary(df_progress),
        "booked": _safe_summary(df_booked),
        "trips": df.fillna("").to_dict(orient="records"),
    }


def get_dashboard_data(
    year: int | None = None,
    month: int | None = None,
    status: str = "all",
    trip_id: str | None = None,
    mobile: str | None = None,
) -> dict:
    """Main dashboard aggregation — /data endpoint."""
    df = load_trips_df()

    if df.empty:
        return _empty_dashboard()

    # Filter
    if trip_id:
        df = df[df["trip id"] == str(trip_id).strip()] if "trip id" in df.columns else df.iloc[0:0]
    else:
        if mobile and "Cust. Contact Number" in df.columns:
            df = df[df["Cust. Contact Number"].str.contains(mobile.replace(" ", ""), na=False)]
        if year and "Year" in df.columns:
            df = df[df["Year"] == year]
        if month and "MonthNum" in df.columns:
            df = df[df["MonthNum"] == month]

    years = sorted(df["Year"].dropna().unique().tolist()) if "Year" in df.columns else []

    if df.empty:
        return {**_empty_dashboard(), "years": years}

    # Split by status
    df_completed = df[df["Status"].str.contains("completed", na=False)].copy()
    df_progress = df[df["Status"].str.contains("progress", na=False)].copy()
    df_booked = df[df["Status"].str.contains("booked", na=False)].copy()

    progress_data = _pipeline_records(df_progress)
    booked_data = _pipeline_records(df_booked)

    # Status filter for table view
    if status == "completed":
        df_view = df_completed
    elif status == "progress":
        df_view = df_progress
    elif status == "booked":
        df_view = df_booked
    else:
        df_view = df

    # ── KPIs (always off completed trips) ──────────────────────────────────
    total_revenue = safe_float(df_completed[REVENUE_COL].sum())
    total_expense = safe_float(df_completed["TotalExpense"].sum())
    total_profit = total_revenue - total_expense
    profit_pct = round((total_profit / total_revenue) * 100, 2) if total_revenue != 0 else 0.0
    avg_deal = safe_float(df_completed[REVENUE_COL].mean())
    avg_days = safe_float(df_completed["Number of Days"].mean()) if "Number of Days" in df_completed.columns else 0.0
    cash_total = safe_float(df_completed["Total Cash"].sum()) if "Total Cash" in df_completed.columns else 0.0
    bank_total = safe_float(df_completed["Total Bank"].sum()) if "Total Bank" in df_completed.columns else 0.0

    # ── Monthly aggregation ─────────────────────────────────────────────────
    monthly_raw = (
        df_completed.groupby("MonthNum")
        .agg(
            Month=("MonthName", "first"),
            Trips=(REVENUE_COL, "count"),
            Revenue=(REVENUE_COL, "sum"),
            TotalExpense=("TotalExpense", "sum"),
            AvgMargin=("CalcProfitPct", "mean"),
            RevPerTrip=(REVENUE_COL, "mean"),
        )
        .reset_index()
        .sort_values("MonthNum")
    )
    # Derive NetProfit from Revenue - TotalExpense (never trust sheet formula)
    monthly_raw["NetProfit"] = monthly_raw["Revenue"] - monthly_raw["TotalExpense"]
    monthly_data = monthly_raw.to_dict(orient="records")
    monthly_data = [{k: _safe_val(v) for k, v in row.items()} for row in monthly_data]

    # ── Vehicle aggregation ─────────────────────────────────────────────────
    veh = (
        df_completed.groupby("Vehicle Details")
        .agg(
            Trips=(REVENUE_COL, "count"),
            TotalRevenue=(REVENUE_COL, "sum"),
            AvgDealPrice=(REVENUE_COL, "mean"),
            AvgMargin=("CalcProfitPct", "mean"),
            TotalProfit=("CalcProfit", "sum"),
        )
        .sort_values("TotalRevenue", ascending=False)
    )

    # ── Routes ─────────────────────────────────────────────────────────────
    routes = (
        df_completed.groupby("Route")
        .agg(
            TripCount=(REVENUE_COL, "count"),
            TotalRevenue=(REVENUE_COL, "sum"),
            AvgDeal=(REVENUE_COL, "mean"),
            AvgMargin=("CalcProfitPct", "mean"),
        )
        .sort_values("TripCount", ascending=False)
    )

    # ── Cost breakdown ──────────────────────────────────────────────────────
    cost_totals = df_completed[EXPENSE_COLS].sum()
    total_cost_sum = safe_float(cost_totals.sum())

    cost_data = [
        {
            "name": col,
            "value": safe_float(val),
            "percent": round(safe_float(val) / total_cost_sum * 100, 1) if total_cost_sum else 0.0,
        }
        for col, val in cost_totals.items()
    ]

    # Revenue breakdown (expenses + profit)
    revenue_breakdown = [{"name": col, "value": safe_float(val)} for col, val in cost_totals.items()]
    revenue_breakdown.append({"name": "Profit", "value": safe_float(total_profit)})

    # ── Payment split ───────────────────────────────────────────────────────
    total_collected = cash_total + bank_total
    payment_split = [
        {
            "name": "Cash",
            "value": cash_total,
            "percent": round(cash_total / total_collected * 100, 1) if total_collected else 0.0,
        },
        {
            "name": "Bank Transfer",
            "value": bank_total,
            "percent": round(bank_total / total_collected * 100, 1) if total_collected else 0.0,
        },
    ]

    # ── Monthly payment ─────────────────────────────────────────────────────
    pay_cols = [c for c in ["Total Cash", "Total Bank"] if c in df_completed.columns]
    if pay_cols and "MonthNum" in df_completed.columns:
        monthly_pay = df_completed.groupby("MonthNum")[pay_cols].sum().reset_index()
        monthly_payment = []
        for r in monthly_pay.to_dict(orient="records"):
            row = {k: _safe_val(v) for k, v in r.items()}
            # Rename to match frontend dataKey="Cash" and dataKey="Bank"
            row["Cash"] = row.pop("Total Cash", 0)
            row["Bank"] = row.pop("Total Bank", 0)
            monthly_payment.append(row)
    else:
        monthly_payment = []

    # ── Monthly cost ────────────────────────────────────────────────────────
    if "MonthNum" in df_completed.columns:
        mc = df_completed.groupby("MonthNum")[EXPENSE_COLS].sum().reset_index()
        monthly_cost_data = [{k: _safe_val(v) for k, v in r.items()} for r in mc.to_dict(orient="records")]
    else:
        monthly_cost_data = []

    # ── Duration distribution ───────────────────────────────────────────────
    if "Number of Days" in df.columns:
        dur_counts = df["Number of Days"].value_counts().sort_index()
        duration_data = [{"days": int(d), "trips": int(v)} for d, v in dur_counts.items()]
    else:
        duration_data = []

    # ── Day of week ─────────────────────────────────────────────────────────
    dow_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    if "DayOfWeek" in df.columns:
        dow_counts = df["DayOfWeek"].value_counts().reindex(dow_order).fillna(0)
        dow_data = [{"day": d, "trips": int(v)} for d, v in dow_counts.items()]
    else:
        dow_counts = pd.Series(0, index=dow_order)
        dow_data = []

    # ── Vehicle per-day stats ───────────────────────────────────────────────
    days_col = "Number of Days"
    veh_cols_needed = EXPENSE_COLS + [REVENUE_COL, days_col]
    avail = [c for c in veh_cols_needed if c in df_completed.columns]
    if "Vehicle Details" in df_completed.columns and avail:
        veh_full = df_completed.groupby("Vehicle Details")[avail].sum()
        trip_cost = veh_full[EXPENSE_COLS].sum(axis=1)
        profit_v = veh_full[REVENUE_COL] - trip_cost

        if days_col in veh_full.columns:
            ppd = (profit_v / veh_full[days_col]).replace([np.inf, -np.inf], 0).fillna(0).round(2)
            vehicle_profit_per_day = [{"vehicle": k, "value": safe_float(v)} for k, v in ppd.sort_values(ascending=False).items()]
            if "Parking" in veh_full.columns:
                park_pd = (veh_full["Parking"] / veh_full[days_col]).replace([np.inf, -np.inf], 0).fillna(0).round(2)
                parking_per_day = [{"vehicle": k, "value": safe_float(v)} for k, v in park_pd.sort_values(ascending=False).items()]
            else:
                parking_per_day = []
        else:
            vehicle_profit_per_day = []
            parking_per_day = []

        vehicle_deal_data = [
            {"vehicle": k, "value": safe_float(v)}
            for k, v in veh_full[REVENUE_COL].sort_values(ascending=False).items()
        ]
    else:
        vehicle_profit_per_day = []
        vehicle_deal_data = []
        parking_per_day = []

    # ── Discrepancies ───────────────────────────────────────────────────────
    if "Difference" in df.columns:
        disc = df[df["Difference"] != 0]
        discrepancy_count = int(len(disc))
        discrepancy_total = safe_float(disc["Difference"].sum())
    else:
        discrepancy_count = 0
        discrepancy_total = 0.0

    # ── Best values ─────────────────────────────────────────────────────────
    best_month = "N/A"
    best_month_revenue = 0.0
    if not monthly_raw.empty:
        idx = monthly_raw["Revenue"].idxmax()
        best_month = monthly_raw.loc[idx, "Month"]
        best_month_revenue = safe_float(monthly_raw.loc[idx, "Revenue"])

    best_vehicle = "N/A"
    best_vehicle_revenue = 0.0
    best_vehicle_margin = 0.0
    if not veh.empty:
        best_vehicle = veh.index[0]
        best_vehicle_revenue = safe_float(veh.iloc[0].get("TotalRevenue", 0))
        best_vehicle_margin = safe_float(veh.iloc[0].get("AvgMargin", 0))

    custs = (
        df_completed.groupby("Customer Name")[REVENUE_COL]
        .sum()
        .sort_values(ascending=False)
        .head(10)
    ) if "Customer Name" in df_completed.columns else pd.Series(dtype=float)

    best_cust = custs.index[0] if not custs.empty else "N/A"
    best_cust_revenue = safe_float(custs.iloc[0]) if not custs.empty else 0.0
    best_route = routes.index[0] if not routes.empty else "N/A"

    fuel_pct = (
        safe_float(df_completed["Fuel"].sum()) / total_cost_sum * 100
        if "Fuel" in df_completed.columns and total_cost_sum
        else 0.0
    )
    digital_pct = bank_total / total_collected * 100 if total_collected else 0.0

    insights = {
        "best_month": best_month,
        "best_month_revenue": best_month_revenue,
        "best_customer": best_cust,
        "best_customer_revenue": best_cust_revenue,
        "best_vehicle": best_vehicle,
        "best_vehicle_revenue": best_vehicle_revenue,
        "best_vehicle_margin": best_vehicle_margin,
        "best_route": best_route,
        "sat_trips": int(dow_counts.get("Saturday", 0)),
        "fuel_pct": round(fuel_pct, 1),
        "digital_pct": round(digital_pct, 1),
        "discrepancy_count": discrepancy_count,
        "discrepancy_total": discrepancy_total,
    }

    # ── Month targets ───────────────────────────────────────────────────────
    TARGET = 250_000
    current_month = datetime.now().month
    month_targets = []
    for i in range(3):
        m = ((current_month - 1 + i) % 12) + 1
        row_data = monthly_raw[monthly_raw["MonthNum"] == m]
        if not row_data.empty:
            rev = safe_float(row_data.iloc[0]["Revenue"])
            trips_n = int(row_data.iloc[0]["Trips"])
            name = row_data.iloc[0]["Month"]
        else:
            rev, trips_n = 0.0, 0
            name = datetime(2024, m, 1).strftime("%B")
        month_targets.append({
            "month": name,
            "revenue": rev,
            "trips": trips_n,
            "target": TARGET,
            "status": "green" if rev >= TARGET else "red",
        })

    # ── Profit by duration ──────────────────────────────────────────────────
    if "Number of Days" in df_completed.columns:
        pbd = df_completed.groupby("Number of Days")["CalcProfit"].sum().reset_index()
        profit_duration_data = [
            {"days": int(r["Number of Days"]), "profit": safe_float(r["CalcProfit"])}
            for _, r in pbd.iterrows()
        ]
    else:
        profit_duration_data = []

    return {
        "success": True,
        "years": [int(y) for y in years],
        "month_targets": month_targets,
        "kpi": {
            "total_revenue": round(total_revenue, 2),
            "total_profit": round(total_profit, 2),
            "avg_margin": round(profit_pct, 2),
            "avg_deal": round(avg_deal, 2),
            "avg_days": round(avg_days, 2),
            "cash_total": round(cash_total, 2),
            "bank_total": round(bank_total, 2),
        },
        "pipeline": {
            "progress": progress_data,
            "booked": booked_data,
        },
        "pipeline_summary": {
            "progress_total": safe_float(sum(x.get(REVENUE_COL, 0) for x in progress_data)),
            "progress_received": safe_float(sum(x.get("Received", 0) for x in progress_data)),
            "booked_total": safe_float(sum(x.get(REVENUE_COL, 0) for x in booked_data)),
            "booked_received": safe_float(sum(x.get("Received", 0) for x in booked_data)),
        },
        "completed_trips": df_completed.fillna("").to_dict(orient="records"),
        "monthly": monthly_data,
        "vehicle": veh.reset_index().to_dict(orient="records"),
        "top_customers": custs.reset_index().rename(columns={"Customer Name": "Customer", REVENUE_COL: "Revenue"}).to_dict(orient="records"),
        "routes": routes.head(10).reset_index().to_dict(orient="records"),
        "cost_breakdown": cost_data,
        "revenue_breakdown": revenue_breakdown,
        "monthly_cost": monthly_cost_data,
        "duration_dist": duration_data,
        "day_of_week": dow_data,
        "payment_split": payment_split,
        "monthly_payment": monthly_payment,
        "insights": insights,
        "extra_insights": {
            "vehicle_profit_per_day": vehicle_profit_per_day,
            "vehicle_deal": vehicle_deal_data,
            "parking_per_day": parking_per_day,
            "profit_by_duration": profit_duration_data,
        },
    }


# ─────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────

def _safe_val(v: Any) -> Any:
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return 0.0
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    return v


def _empty_dashboard() -> dict:
    return {
        "success": True,
        "years": [],
        "month_targets": [],
        "kpi": {
            "total_revenue": 0,
            "total_profit": 0,
            "avg_margin": 0,
            "avg_deal": 0,
            "avg_days": 0,
            "cash_total": 0,
            "bank_total": 0,
        },
        "pipeline": {"progress": [], "booked": []},
        "pipeline_summary": {
            "progress_total": 0,
            "progress_received": 0,
            "booked_total": 0,
            "booked_received": 0,
        },
        "completed_trips": [],
        "monthly": [],
        "vehicle": [],
        "top_customers": [],
        "routes": [],
        "cost_breakdown": [],
        "revenue_breakdown": [],
        "monthly_cost": [],
        "duration_dist": [],
        "day_of_week": [],
        "payment_split": [],
        "monthly_payment": [],
        "insights": {},
        "extra_insights": {
            "vehicle_profit_per_day": [],
            "vehicle_deal": [],
            "profit_by_duration": [],
        },
    }
