"""EmailTemplate Pydantic schemas"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class EmailTemplateBase(BaseModel):
    name: str
    typ: str  # mitglied, empfaenger
    scenario: str
    kreisverband_id: Optional[int] = None
    betreff: str
    inhalt: str


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    typ: Optional[str] = None
    scenario: Optional[str] = None
    kreisverband_id: Optional[int] = None
    betreff: Optional[str] = None
    inhalt: Optional[str] = None


class EmailTemplateResponse(EmailTemplateBase):
    id: int
    attachment_original_filename: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
