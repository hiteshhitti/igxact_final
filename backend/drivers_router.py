"""
drivers_router.py
─────────────────
CRUD for driver details stored in a "Drivers" Google Sheet tab.
Columns: Name, Father Name, Age, DOB, Mobile 1, Mobile 2,
         Present Address, Permanent Address, Aadhaar Number,
         DL Number, DL Expiry
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from utils import require_admin, verify_token
from services.sheets import open_worksheet_by_name

logger = logging.getLogger(__name__)
drivers_router = APIRouter(prefix="/drivers", tags=["Drivers"])

SHEET_NAME = "Drivers"
COLUMNS = [
    "Name", "Father Name", "Age", "DOB",
    "Mobile 1", "Mobile 2",
    "Present Address", "Permanent Address",
    "Aadhaar Number", "DL Number", "DL Expiry",
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


class DriverIn(BaseModel):
    name:              str           = Field(..., min_length=1, max_length=100)
    father_name:       Optional[str] = Field(None, max_length=100)
    age:               Optional[str] = Field(None, max_length=10)
    dob:               Optional[str] = Field(None, max_length=20)
    mobile1:           Optional[str] = Field(None, max_length=20)
    mobile2:           Optional[str] = Field(None, max_length=20)
    present_address:   Optional[str] = Field(None, max_length=300)
    permanent_address: Optional[str] = Field(None, max_length=300)
    aadhaar_number:    Optional[str] = Field(None, max_length=20)
    dl_number:         Optional[str] = Field(None, max_length=30)
    dl_expiry:         Optional[str] = Field(None, max_length=20)


def _to_row(d: DriverIn) -> list:
    return [
        d.name or "", d.father_name or "", d.age or "", d.dob or "",
        d.mobile1 or "", d.mobile2 or "",
        d.present_address or "", d.permanent_address or "",
        d.aadhaar_number or "", d.dl_number or "", d.dl_expiry or "",
    ]


def _row_to_dict(row: list, row_idx: int) -> dict:
    d = {"_row": row_idx}
    for i, col in enumerate(COLUMNS):
        d[col] = row[i] if i < len(row) else ""
    return d


@drivers_router.get("")
def list_drivers(user=Depends(verify_token)):
    ws = _ensure_sheet()
    rows = ws.get_all_values()
    if len(rows) <= 1:
        return {"drivers": []}
    return {"drivers": [_row_to_dict(r, i + 2) for i, r in enumerate(rows[1:]) if any(v.strip() for v in r)]}


@drivers_router.post("", status_code=201)
def add_driver(body: DriverIn, user=Depends(require_admin)):
    ws = _ensure_sheet()
    ws.append_row(_to_row(body), value_input_option="USER_ENTERED")
    return {"msg": "Driver added"}


@drivers_router.put("/{row_number}")
def update_driver(row_number: int, body: DriverIn, user=Depends(require_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="Invalid row")
    ws = _ensure_sheet()
    ws.update(f"A{row_number}:K{row_number}", [_to_row(body)])
    return {"msg": "Driver updated"}


@drivers_router.delete("/{row_number}")
def delete_driver(row_number: int, user=Depends(require_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="Invalid row")
    ws = _ensure_sheet()
    ws.delete_rows(row_number)
    return {"msg": "Driver deleted"}
