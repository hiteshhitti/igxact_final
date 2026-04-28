from sqlalchemy import Column, Integer, String
from database import Base

# Valid roles: "admin" | "user" | "staff"
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, nullable=False)
    password      = Column(String, nullable=False)   # bcrypt hashed
    role          = Column(String, default="user")   # admin | user | staff
    refresh_token = Column(String, nullable=True)    # hashed refresh token
