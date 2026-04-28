"""
cars_router.py
──────────────
CRUD for car/vehicle details stored in a "Cars" Google Sheet tab.
Columns: Registration Number, Chassis Number, Insurance Expiry,
         Local Permit Date, National Permit Date
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from utils import require_admin, verify_token
from services.sheets import open_worksheet_by_name

logger = logging.getLogger(__name__)
cars_router = APIRouter(prefix="/cars", tags=["Cars"])

SHEET_NAME = "Cars"
COLUMNS = [
    "Registration Number", "Chassis Number",
    "Insurance Expiry", "Local Permit Date", "National Permit Date",
]


def _ensure_sheet():
    try:
        return open_worksheet_by_name(SHEET_NAME)
    except Exception:
        from services.sheets import get_client
        from config import SHEET_URL
        client = get_client()
        wb = client.open_by_url(f"{SHEET_URL}/edit")
        ws = wb.add_worksheet(title=SHEET_NAME, rows=500, cols=len(COLUMNS))
        ws.append_row(COLUMNS)
        return ws


class CarIn(BaseModel):
    registration_number:  str           = Field(..., min_length=1, max_length=30)
    chassis_number:       Optional[str] = Field(None, max_length=50)
    insurance_expiry:     Optional[str] = Field(None, max_length=20)
    local_permit_date:    Optional[str] = Field(None, max_length=20)
    national_permit_date: Optional[str] = Field(None, max_length=20)


def _to_row(c: CarIn) -> list:
    return [
        c.registration_number or "",
        c.chassis_number or "",
        c.insurance_expiry or "",
        c.local_permit_date or "",
        c.national_permit_date or "",
    ]


def _row_to_dict(row: list, row_idx: int) -> dict:
    d = {"_row": row_idx}
    for i, col in enumerate(COLUMNS):
        d[col] = row[i] if i < len(row) else ""
    return d


@cars_router.get("")
def list_cars(user=Depends(verify_token)):
    ws = _ensure_sheet()
    rows = ws.get_all_values()
    if len(rows) <= 1:
        return {"cars": []}
    return {"cars": [_row_to_dict(r, i + 2) for i, r in enumerate(rows[1:]) if any(v.strip() for v in r)]}


@cars_router.post("", status_code=201)
def add_car(body: CarIn, user=Depends(require_admin)):
    ws = _ensure_sheet()
    ws.append_row(_to_row(body), value_input_option="USER_ENTERED")
    return {"msg": "Car added"}


@cars_router.put("/{row_number}")
def update_car(row_number: int, body: CarIn, user=Depends(require_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="Invalid row")
    ws = _ensure_sheet()
    ws.update(f"A{row_number}:E{row_number}", [_to_row(body)])
    return {"msg": "Car updated"}


@cars_router.delete("/{row_number}")
def delete_car(row_number: int, user=Depends(require_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="Invalid row")
    ws = _ensure_sheet()
    ws.delete_rows(row_number)
    return {"msg": "Car deleted"}
