"""Security utilities for password hashing and JWT tokens"""
import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Password strength requirements
MIN_PASSWORD_LENGTH = 8
PASSWORD_PATTERN = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$'
)


def generate_password(length: int = 14) -> str:
    """Erzeugt ein zufälliges Passwort, das validate_password_strength erfüllt."""
    alphabet = string.ascii_letters + string.digits
    chars = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
    ] + [secrets.choice(alphabet) for _ in range(length - 3)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_strength(password: str) -> Optional[str]:
    """Validate password strength. Returns error message or None if valid."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Passwort muss mindestens {MIN_PASSWORD_LENGTH} Zeichen lang sein."
    if not PASSWORD_PATTERN.match(password):
        return "Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten."
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
