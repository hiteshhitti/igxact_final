"""
schemas/crm.py
──────────────
Pydantic models for CRM request validation.
Google Sheets is the ONLY database — no SQL models here.
"""

from typing import Optional
from pydantic import BaseModel, Field, validator


# ─── Allowed values ────────────────────────────────────────────────────────────

MODE_VALUES    = {"Call", "WhatsApp"}
STATUS_VALUES  = {"Enquiry", "Booked", "Interested", "Super Interested", "Trip Decline", "Cancelled"}
CHANNEL_VALUES = {"Meta Ads", "Google Ads"}


class CRMEntryCreate(BaseModel):
    customer_name:    str            = Field(..., alias="customer_name",    min_length=1, max_length=120)
    contact:          str            = Field(..., alias="contact",          min_length=6, max_length=20)
    description:      Optional[str]  = Field(None, alias="description",    max_length=1000)
    mode:             str            = Field(..., alias="mode")
    status:           str            = Field(..., alias="status")
    channel:          str            = Field(..., alias="channel")
    vehicle:          Optional[str]  = Field(None, alias="vehicle",        max_length=100)
    follow_up_date:   Optional[str]  = Field(None, alias="follow_up_date")
    deal_closed_date: Optional[str]  = Field(None, alias="deal_closed_date")
    attendant:        Optional[str]  = Field(None, alias="attendant",      max_length=80)

    @validator("mode", pre=True)
    def validate_mode(cls, v):
        if not v:
            raise ValueError("mode is required")
        if str(v).strip() not in MODE_VALUES:
            raise ValueError(f"mode must be one of: {', '.join(sorted(MODE_VALUES))}")
        return str(v).strip()

    @validator("status", pre=True)
    def validate_status(cls, v):
        if not v:
            raise ValueError("status is required")
        if str(v).strip() not in STATUS_VALUES:
            raise ValueError(f"status must be one of: {', '.join(sorted(STATUS_VALUES))}")
        return str(v).strip()

    @validator("channel", pre=True)
    def validate_channel(cls, v):
        if not v:
            raise ValueError("channel is required")
        if str(v).strip() not in CHANNEL_VALUES:
            raise ValueError(f"channel must be one of: {', '.join(sorted(CHANNEL_VALUES))}")
        return str(v).strip()

    @validator("follow_up_date", "deal_closed_date", pre=True)
    def validate_date(cls, v):
        if not v:
            return None
        from datetime import datetime
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                datetime.strptime(v, fmt)
                return v
            except ValueError:
                continue
        raise ValueError(f"Date '{v}' must be YYYY-MM-DD")

    @validator("contact", pre=True)
    def clean_contact(cls, v):
        if not v:
            raise ValueError("contact is required")
        digits = "".join(c for c in str(v) if c.isdigit())
        if len(digits) < 6:
            raise ValueError("contact must have at least 6 digits")
        return str(v).strip()

    class Config:
        populate_by_name = True
        extra = "ignore"


class CRMEntryUpdate(CRMEntryCreate):
    """Full replacement update — same rules as create."""
    pass


class CRMFollowUpCreate(BaseModel):
    """
    Creates a new follow-up row pre-filled with existing customer data.
    Only the follow_up_date and optional fields may differ.
    """
    customer_name:    str            = Field(..., min_length=1, max_length=120)
    contact:          str            = Field(..., min_length=6, max_length=20)
    description:      Optional[str]  = Field(None, max_length=1000)
    mode:             str            = Field(...)
    status:           str            = Field(...)
    channel:          str            = Field(...)
    vehicle:          Optional[str]  = Field(None, max_length=100)
    follow_up_date:   Optional[str]  = Field(None)
    deal_closed_date: Optional[str]  = Field(None)
    attendant:        Optional[str]  = Field(None, max_length=80)

    @validator("mode", pre=True)
    def validate_mode(cls, v):
        if str(v).strip() not in MODE_VALUES:
            raise ValueError(f"mode must be one of: {', '.join(sorted(MODE_VALUES))}")
        return str(v).strip()

    @validator("status", pre=True)
    def validate_status(cls, v):
        if str(v).strip() not in STATUS_VALUES:
            raise ValueError(f"status must be one of: {', '.join(sorted(STATUS_VALUES))}")
        return str(v).strip()

    @validator("channel", pre=True)
    def validate_channel(cls, v):
        if str(v).strip() not in CHANNEL_VALUES:
            raise ValueError(f"channel must be one of: {', '.join(sorted(CHANNEL_VALUES))}")
        return str(v).strip()

    @validator("follow_up_date", "deal_closed_date", pre=True)
    def validate_date(cls, v):
        if not v:
            return None
        from datetime import datetime
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                datetime.strptime(v, fmt)
                return v
            except ValueError:
                continue
        raise ValueError(f"Date '{v}' must be YYYY-MM-DD")

    @validator("contact", pre=True)
    def clean_contact(cls, v):
        digits = "".join(c for c in str(v) if c.isdigit())
        if len(digits) < 6:
            raise ValueError("contact must have at least 6 digits")
        return str(v).strip()

    class Config:
        extra = "ignore"


class CRMQueryParams(BaseModel):
    status:    Optional[str] = None
    channel:   Optional[str] = None
    start:     Optional[str] = None
    end:       Optional[str] = None
    search:    Optional[str] = Field(None, max_length=120)

    @validator("status", pre=True)
    def validate_status(cls, v):
        if not v or v == "all":
            return None
        if v not in STATUS_VALUES:
            raise ValueError(f"status must be one of: {', '.join(sorted(STATUS_VALUES))}")
        return v

    @validator("channel", pre=True)
    def validate_channel(cls, v):
        if not v or v == "all":
            return None
        if v not in CHANNEL_VALUES:
            raise ValueError(f"channel must be one of: {', '.join(sorted(CHANNEL_VALUES))}")
        return v

    @validator("start", "end", pre=True)
    def validate_date_filter(cls, v):
        if not v:
            return None
        from datetime import datetime
        try:
            datetime.strptime(v, "%Y-%m-%d")
            return v
        except ValueError:
            raise ValueError("Date filter must be YYYY-MM-DD")
