"""
main.py
───────
HTTP layer only — no business logic here.
All logic lives in services/trips.py and services/sheets.py.
"""

import logging
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import router as auth_router
from database import Base, SessionLocal, engine
from models import User
from services.trips import (
    add_trip,
    add_vehicle,
    get_dashboard_data,
    get_sheet_columns,
    get_vehicles,
    query_trips,
    update_trip,
)
from utils import hash_password, require_admin, verify_password, verify_token

load_dotenv()

# ─── Logging setup ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="IGXact API", version="2.0.0")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://igxactpixel.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")

ALGORITHM = "HS256"

# ─── DB init ────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)


# ─── Schemas ────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


# ─── Auth helpers ────────────────────────────────────────────────────────────
def create_token(data: dict, expires_hours: int = 24) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=expires_hours)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Auth routes ─────────────────────────────────────────────────────────────
@app.post("/create-user", status_code=status.HTTP_201_CREATED)
def create_user(db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        raise HTTPException(status_code=409, detail="Admin already exists")
    user = User(username="admin", password=hash_password("1234"))
    db.add(user)
    db.commit()
    logger.info("Admin user created")
    return {"msg": "User created"}


@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password):
        logger.warning(f"Failed login attempt for username='{data.username}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({"sub": user.username, "role": user.role})
    logger.info(f"Login success: username='{user.username}' role='{user.role}'")
    return {"access_token": token, "token_type": "bearer", "role": user.role}


# ─── Vehicles ────────────────────────────────────────────────────────────────
@app.get("/vehicles")
def list_vehicles(user=Depends(verify_token)):
    return {"vehicles": get_vehicles()}


@app.post("/vehicles")
def create_vehicle(vehicle: dict, user=Depends(verify_token)):
    name = vehicle.get("name", "")
    return add_vehicle(name)


# ─── Trips CRUD ──────────────────────────────────────────────────────────────
@app.post("/add-trip")
def create_trip(data: dict, user=Depends(require_admin)):
    return add_trip(data)


@app.put("/update-trip/{trip_id}")
def edit_trip(trip_id: int, data: dict, user=Depends(require_admin)):
    return update_trip(trip_id, data)


@app.get("/columns")
def list_columns(user=Depends(verify_token)):
    return get_sheet_columns()


# ─── Trip queries ─────────────────────────────────────────────────────────────
@app.get("/trips")
def get_trips(
    start: str = Query(None),
    end: str = Query(None),
    trip_id: str = Query(None),
    mobile: str = Query(None),
    user=Depends(require_admin),
):
    return query_trips(start, end, trip_id, mobile)


@app.get("/trips-view")
def trips_view(
    start: str = Query(None),
    end: str = Query(None),
    trip_id: str = Query(None),
    mobile: str = Query(None),
    user=Depends(verify_token),
):
    return query_trips(start, end, trip_id, mobile)


# ─── Dashboard ────────────────────────────────────────────────────────────────
@app.get("/data")
def get_data(
    year: int = Query(None),
    month: int = Query(None),
    status: str = Query("all"),
    trip_id: str = Query(None),
    mobile: str = Query(None),
    user=Depends(verify_token),
):
    return get_dashboard_data(year, month, status, trip_id, mobile)


# ─── Health ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
