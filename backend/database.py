from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database file
DATABASE_URL = "sqlite:///./app.db"

# Engine create
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite ke liye required
)

# Session create
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
Base = declarative_base()