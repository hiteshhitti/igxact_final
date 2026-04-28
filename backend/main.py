import logging
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import router as auth_router
from crm_router import crm_router
from drivers_router import drivers_router
from cars_router import cars_router
from attendants_router import attendants_router
from database import Base, engine
from middleware import RequestLoggingMiddleware
from schemas.trip import DashboardQueryParams, TripCreate, TripUpdate, TripQueryParams, VehicleCreate
from services.trips import (
    add_trip,
    add_vehicle,
    get_dashboard_data,
    get_sheet_columns,
    get_vehicles,
    query_trips,
    update_trip,
)
from utils import require_admin, require_staff_or_admin, verify_token

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="IGXact API", version="2.3.0", docs_url=None, redoc_url=None)

app.add_middleware(RequestLoggingMiddleware)

from config import ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(crm_router)
app.include_router(drivers_router)
app.include_router(cars_router)
app.include_router(attendants_router)

Base.metadata.create_all(bind=engine)


# ── Error handlers ────────────────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(l) for l in e["loc"][1:]), "msg": e["msg"]}
        for e in exc.errors()
    ]
    logger.warning(f"Validation error on {request.url.path}: {errors}")
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc!r}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Vehicles ──────────────────────────────────────────────────────────────────
@app.get("/vehicles")
def list_vehicles(user=Depends(verify_token)):
    return {"vehicles": get_vehicles()}


@app.post("/vehicles", status_code=201)
def create_vehicle(body: VehicleCreate, user=Depends(require_admin)):
    return add_vehicle(body.name)


# ── Trips ─────────────────────────────────────────────────────────────────────
@app.post("/add-trip", status_code=201)
def create_trip(body: TripCreate, user=Depends(require_staff_or_admin)):
    return add_trip(body.dict(by_alias=True))


@app.put("/update-trip/{trip_id}")
def edit_trip(trip_id: int, body: TripUpdate, user=Depends(require_staff_or_admin)):
    if trip_id <= 0:
        raise HTTPException(status_code=400, detail="trip_id must be a positive integer")
    return update_trip(trip_id, body.dict(by_alias=True))


@app.get("/columns")
def list_columns(user=Depends(verify_token)):
    return get_sheet_columns()


@app.get("/trips")
def get_trips(
    start:   str = Query(None),
    end:     str = Query(None),
    trip_id: str = Query(None),
    mobile:  str = Query(None),
    user=Depends(require_staff_or_admin),
):
    params = TripQueryParams(start=start, end=end, trip_id=trip_id, mobile=mobile)
    return query_trips(params.start, params.end, params.trip_id, params.mobile)


@app.get("/trips-view")
def trips_view(
    start:   str = Query(None),
    end:     str = Query(None),
    trip_id: str = Query(None),
    mobile:  str = Query(None),
    user=Depends(verify_token),
):
    params = TripQueryParams(start=start, end=end, trip_id=trip_id, mobile=mobile)
    return query_trips(params.start, params.end, params.trip_id, params.mobile)


@app.get("/data")
def get_data(
    year:    int = Query(None),
    month:   int = Query(None),
    status:  str = Query("all"),
    trip_id: str = Query(None),
    mobile:  str = Query(None),
    user=Depends(verify_token),
):
    params = DashboardQueryParams(
        year=year, month=month, status=status, trip_id=trip_id, mobile=mobile
    )
    return get_dashboard_data(
        params.year, params.month, params.status, params.trip_id, params.mobile
    )


@app.get("/health")
def health():
    return {"status": "ok"}
