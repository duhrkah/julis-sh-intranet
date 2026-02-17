"""Category Pydantic schemas"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$')
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: int
    is_active: bool
    tenant_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryPublic(BaseModel):
    id: int
    name: str
    color: str

    model_config = ConfigDict(from_attributes=True)
