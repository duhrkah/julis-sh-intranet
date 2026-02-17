"""Tenant Pydantic schemas"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class TenantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    level: str = Field(..., min_length=1, max_length=50)
    parent_id: Optional[int] = None
    is_active: bool = True
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    level: Optional[str] = None
    is_active: Optional[bool] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None


class TenantResponse(TenantBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TenantTree(TenantResponse):
    children: List["TenantTree"] = []
