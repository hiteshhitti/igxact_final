# routes/auth.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import SessionLocal
from models import User
from main import verify_password, hash_password, verify_token   # 🔥 IMPORTANT

router = APIRouter()

# schema
class ChangePasswordSchema(BaseModel):
    old_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    data: ChangePasswordSchema,
    user=Depends(verify_token)
):
    db: Session = SessionLocal()

    try:
        current_user = db.query(User).filter(User.username == user["sub"]).first()

        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        # old password check
        if not verify_password(data.old_password, current_user.password):
            raise HTTPException(status_code=400, detail="Incorrect old password")

        # same password check (optional but good)
        if verify_password(data.new_password, current_user.password):
            raise HTTPException(status_code=400, detail="New password cannot be same")

        # update password
        current_user.password = hash_password(data.new_password)
        db.commit()

        return {"msg": "Password updated successfully"}

    finally:
        db.close()