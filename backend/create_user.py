from database import SessionLocal
from models import User
from main import hash_password

db = SessionLocal()

user = User(
    username="admin",
    password=hash_password("1234")  # apna password dal
)

db.add(user)
db.commit()

print("User created successfully ✅")