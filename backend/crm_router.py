"""
crm_router.py
─────────────
FastAPI router for CRM endpoints.
- All endpoints require a valid JWT.
- Write endpoints require admin or staff role.
- attendant is auto-filled from the logged-in username if not provided.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from schemas.crm import (
    CRMEntryCreate,
    CRMEntryUpdate,
    CRMFollowUpCreate,
    CRMQueryParams,
)
from services.crm import (
    create_crm_entry,
    get_all_crm_entries,
    get_crm_analytics,
    get_customer_history,
    get_followups_by_date,
    query_crm_entries,
    update_crm_entry,
)
from utils import require_staff_or_admin, verify_token

logger = logging.getLogger(__name__)

crm_router = APIRouter(prefix="/crm", tags=["CRM"])


# ── GET all CRM entries ────────────────────────────────────────────────────────
@crm_router.get("/entries")
def list_crm_entries(
    status:  str = Query(None),
    channel: str = Query(None),
    start:   str = Query(None),
    end:     str = Query(None),
    search:  str = Query(None),
    user=Depends(verify_token),
):
    try:
        params = CRMQueryParams(status=status, channel=channel, start=start, end=end, search=search)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    rows = query_crm_entries(
        status=params.status,
        channel=params.channel,
        start=params.start,
        end=params.end,
        search=params.search,
    )
    return {"entries": rows, "total": len(rows)}


# ── POST create a new CRM entry ────────────────────────────────────────────────
@crm_router.post("/entries", status_code=201)
def create_entry(body: CRMEntryCreate, user=Depends(require_staff_or_admin)):
    """Append a new CRM row. attendant is auto-set to the logged-in username."""
    data = body.dict(by_alias=False)
    # Auto-fill attendant with logged-in username if not explicitly provided
    if not data.get("attendant"):
        data["attendant"] = user.get("sub", "")
    result = create_crm_entry(data)
    return result


# ── PUT update an existing CRM entry ──────────────────────────────────────────
@crm_router.put("/entries/{row_number}")
def update_entry(row_number: int, body: CRMEntryUpdate, user=Depends(require_staff_or_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="row_number must be ≥ 2 (row 1 is the header)")
    data = body.dict(by_alias=False)
    if not data.get("attendant"):
        data["attendant"] = user.get("sub", "")
    return update_crm_entry(row_number, data)


# ── GET follow-ups ─────────────────────────────────────────────────────────────
@crm_router.get("/followups")
def list_followups(
    date: str = Query(None),
    user=Depends(verify_token),
):
    return get_followups_by_date(target_date=date)


# ── POST create follow-up ──────────────────────────────────────────────────────
@crm_router.post("/followups", status_code=201)
def create_followup(body: CRMFollowUpCreate, user=Depends(require_staff_or_admin)):
    data = body.dict()
    if not data.get("attendant"):
        data["attendant"] = user.get("sub", "")
    return create_crm_entry(data)


# ── GET customer history ───────────────────────────────────────────────────────
@crm_router.get("/history")
def customer_history(
    contact:       str = Query(None),
    customer_name: str = Query(None),
    user=Depends(verify_token),
):
    if not contact and not customer_name:
        raise HTTPException(status_code=400, detail="Provide at least one of: contact, customer_name")
    rows = get_customer_history(contact=contact, customer_name=customer_name)
    return {"history": rows, "total": len(rows)}


# ── GET CRM analytics ──────────────────────────────────────────────────────────
@crm_router.get("/analytics")
def crm_analytics(user=Depends(verify_token)):
    return get_crm_analytics()


# ── POST fund deposit entry ────────────────────────────────────────────────────
@crm_router.post("/fund-deposit", status_code=201)
def fund_deposit(body: dict, user=Depends(require_staff_or_admin)):
    """
    Record a cash/bank deposit to office.
    Stored as a special CRM row with status='Fund Deposit'.
    Expected body: { amount_cash, amount_bank, notes, date }
    """
    from services.crm import create_fund_deposit
    data = {
        "amount_cash": body.get("amount_cash", 0),
        "amount_bank": body.get("amount_bank", 0),
        "notes":       body.get("notes", ""),
        "date":        body.get("date", ""),
        "deposited_by": user.get("sub", ""),
    }
    return create_fund_deposit(data)


@crm_router.get("/fund-deposits")
def list_fund_deposits(user=Depends(verify_token)):
    from services.crm import get_fund_deposits
    return get_fund_deposits()
