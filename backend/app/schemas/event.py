"""Event Pydantic schemas"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, time, datetime


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    start_time: Optional[time] = None
    end_date: Optional[date] = None
    end_time: Optional[time] = None
    location: Optional[str] = Field(None, max_length=500)
    location_url: Optional[str] = Field(None, max_length=500)
    organizer: str = Field(..., min_length=1, max_length=255)
    category_id: Optional[int] = None
    is_public: bool = True


class EventCreate(EventBase):
    submitter_name: Optional[str] = Field(None, max_length=255)
    submitter_email: Optional[str] = Field(None, max_length=255)
    target_tenant_id: Optional[int] = None


class EventPublicCreate(BaseModel):
    """Schema für öffentliche Termin-Einreichung (ohne Auth)."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    start_time: Optional[time] = None
    end_date: Optional[date] = None
    end_time: Optional[time] = None
    location: Optional[str] = Field(None, max_length=500)
    location_url: Optional[str] = Field(None, max_length=500)
    organizer: str = Field(..., min_length=1, max_length=255)
    category_id: Optional[int] = None
    submitter_name: str = Field(..., min_length=1, max_length=255)
    submitter_email: str = Field(..., min_length=1, max_length=255)
    tenant_id: Optional[int] = None  # optional; falls nicht gesetzt: PUBLIC_DEFAULT_TENANT_ID


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[time] = None
    end_date: Optional[date] = None
    end_time: Optional[time] = None
    location: Optional[str] = Field(None, max_length=500)
    location_url: Optional[str] = Field(None, max_length=500)
    organizer: Optional[str] = Field(None, min_length=1, max_length=255)
    category_id: Optional[int] = None
    is_public: Optional[bool] = None


class EventResponse(EventBase):
    id: int
    status: str
    organizer: Optional[str] = None
    submitter_id: int
    submitter_name: Optional[str]
    submitter_email: Optional[str]
    rejection_reason: Optional[str]
    approved_at: Optional[datetime]
    approved_by: Optional[int]
    tenant_id: int
    source_tenant_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
