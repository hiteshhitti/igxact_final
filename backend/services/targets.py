"""
services/targets.py
───────────────────
Monthly target management. Stored in a "Targets" sheet tab.
Columns: year, month_num, month_name, target_amount
"""

import logging
import time
from typing import Optional
from fastapi import HTTPException
from config import SHEET_URL

logger = logging.getLogger(__name__)

SHEET_NAME = "Targets"
COLUMNS = ["year", "month_num", "month_name", "target_amount"]

_cache: dict = {"data": None, "fetched_at": 0.0}
_TTL = 60


def _cache_valid():
    return _cache["data"] is not None and (time.monotonic() - _cache["fetched_at"]) < _TTL


def _invalidate_cache():
    _cache["data"] = None
    _cache["fetched_at"] = 0.0


def _ensure_sheet():
    from services.sheets import get_client
    client = get_client()
    try:
        wb = client.open_by_url(f"{SHEET_URL}/edit")
        return wb.worksheet(SHEET_NAME)
    except Exception as e:
        logger.error(f"Failed to open {SHEET_NAME} sheet: {e}")
        raise HTTPException(status_code=500, detail=f"Could not open Targets sheet. Please create a sheet tab named '{SHEET_NAME}' with columns: year, month_num, month_name, target_amount")


def get_all_targets() -> list[dict]:
    if _cache_valid():
        return _cache["data"]
    ws = _ensure_sheet()
    try:
        all_rows = ws.get_all_values()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read Targets: {e}")

    if not all_rows:
        return []

    header = [h.strip().lower().replace(" ", "_") for h in all_rows[0]]
    result = []
    for idx, row in enumerate(all_rows[1:], start=2):
        if not any(str(v).strip() for v in row):
            continue
        d = {"_row": idx}
        for i, col in enumerate(header):
            d[col] = row[i] if i < len(row) else ""
        result.append(d)

    _cache["data"] = result
    _cache["fetched_at"] = time.monotonic()
    return result


def get_target_for_month(year: int, month_num: int) -> float:
    """Return target amount for a specific year+month. Default 250000 if not set."""
    rows = get_all_targets()
    for r in rows:
        try:
            if int(float(r.get("year", 0))) == year and int(float(r.get("month_num", 0))) == month_num:
                return float(r.get("target_amount", 0) or 0)
        except (ValueError, TypeError):
            continue
    return 250_000  # default fallback


def set_target(year: int, month_num: int, month_name: str, target_amount: float) -> dict:
    ws = _ensure_sheet()
    rows = get_all_targets()

    # Check if row already exists for this year+month
    existing_row = None
    for r in rows:
        try:
            if int(float(r.get("year", 0))) == year and int(float(r.get("month_num", 0))) == month_num:
                existing_row = r["_row"]
                break
        except (ValueError, TypeError):
            continue

    row_data = [str(year), str(month_num), month_name, str(target_amount)]

    try:
        if existing_row:
            ws.update(f"A{existing_row}:D{existing_row}", [row_data], value_input_option="USER_ENTERED")
        else:
            ws.append_row(row_data, value_input_option="USER_ENTERED")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save target: {e}")

    _invalidate_cache()
    return {"msg": "Target saved", "year": year, "month_num": month_num, "target_amount": target_amount}


def get_targets_for_year(year: int) -> dict:
    """Return {month_num: target_amount} for all months in a year."""
    rows = get_all_targets()
    result = {}
    for r in rows:
        try:
            if int(float(r.get("year", 0))) == year:
                mn = int(float(r.get("month_num", 0)))
                result[mn] = float(r.get("target_amount", 0) or 0)
        except (ValueError, TypeError):
            continue
    return result
