import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from schemas.auth import ChangePasswordRequest, LoginRequest, MessageResponse, TokenResponse
from utils import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie("refresh_token", samesite="none", secure=True)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password):
        logger.warning(f"Failed login: username='{data.username}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token  = create_access_token({"sub": user.username, "role": user.role})
    refresh_token = create_refresh_token()
    user.refresh_token = hash_refresh_token(refresh_token)
    db.commit()

    _set_refresh_cookie(response, refresh_token)
    logger.info(f"Login: username='{user.username}' role='{user.role}'")
    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        role=user.role,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    refresh_token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    user = db.query(User).filter(
        User.refresh_token == hash_refresh_token(refresh_token)
    ).first()

    if not user:
        logger.warning("Refresh with unknown/revoked token")
        raise HTTPException(status_code=401, detail="Refresh token is invalid or revoked")

    new_refresh = create_refresh_token()
    user.refresh_token = hash_refresh_token(new_refresh)
    db.commit()

    _set_refresh_cookie(response, new_refresh)
    new_access = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(
        access_token=new_access,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        role=user.role,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.username == user["sub"]).first()
    if db_user:
        db_user.refresh_token = None
        db.commit()
    _clear_refresh_cookie(response)
    logger.info(f"Logout: username='{user['sub']}'")
    return MessageResponse(msg="Logged out successfully")


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    response: Response,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.username == user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(data.old_password, db_user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    if verify_password(data.new_password, db_user.password):
        raise HTTPException(status_code=400, detail="New password must differ from current")

    db_user.password      = hash_password(data.new_password)
    db_user.refresh_token = None
    db.commit()
    _clear_refresh_cookie(response)
    logger.info(f"Password changed: username='{user['sub']}'")
    return MessageResponse(msg="Password updated. Please log in again.")


@router.post("/create-user", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
def create_user(db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == "admin").first():
        raise HTTPException(status_code=409, detail="Admin user already exists")
    db.add(User(username="admin", password=hash_password("1234")))
    db.commit()
    logger.info("Admin user created")
    return MessageResponse(msg="Admin user created. Change the default password immediately.")
