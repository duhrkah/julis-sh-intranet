"""User Pydantic schemas"""
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: Optional[str] = None  # Leer = nur Microsoft-365-Login (Platzhalter-Hash wird gesetzt)
    role: str = "mitarbeiter"
    tenant_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    tenant_id: Optional[int] = None


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    tenant_id: Optional[int]
    display_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfile(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: Optional[str]
    role: str
    is_active: bool
    tenant_id: Optional[int]
    display_role: Optional[str] = None
    accessible_tenant_ids: Optional[List[int]] = None

    model_config = ConfigDict(from_attributes=True)
