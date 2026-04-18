from passlib.context import CryptContext
from jose import jwt
import os
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

security = HTTPBearer()

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])