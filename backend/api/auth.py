"""Auth routes — register, login, me, logout."""

import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import User
from services.auth_service import hash_password, verify_password, create_access_token
from api.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    body.name = body.name.strip()
    body.email = body.email.strip().lower()

    if not body.name:
        raise HTTPException(400, "Name is required.")
    if not EMAIL_RE.match(body.email):
        raise HTTPException(400, "Invalid email address.")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")
    if body.password != body.confirm_password:
        raise HTTPException(400, "Passwords do not match.")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "An account with this email already exists.")

    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    body.email = body.email.strip().lower()
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.post("/logout")
def logout():
    # JWT is stateless; client must discard the token.
    return {"message": "Logged out successfully."}
