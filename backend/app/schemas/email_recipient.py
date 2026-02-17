"""EmailRecipient Pydantic schemas"""
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime


class EmailRecipientBase(BaseModel):
    kreisverband_id: int
    name: str
    email: EmailStr
    rolle: str


class EmailRecipientCreate(EmailRecipientBase):
    pass


class EmailRecipientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    rolle: Optional[str] = None


class EmailRecipientResponse(EmailRecipientBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
