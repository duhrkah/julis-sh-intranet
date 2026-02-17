"""MemberChange Pydantic schemas"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class MemberChangeBase(BaseModel):
    scenario: str
    mitgliedsnummer: Optional[str] = None
    vorname: str
    nachname: str
    email: Optional[str] = None
    telefon: Optional[str] = None
    strasse: Optional[str] = None
    hausnummer: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    geburtsdatum: Optional[str] = None
    kreisverband_id: Optional[int] = None
    kreisverband_alt_id: Optional[int] = None
    kreisverband_neu_id: Optional[int] = None
    bemerkung: Optional[str] = None


class MemberChangeCreate(MemberChangeBase):
    pass


class MemberChangeResponse(MemberChangeBase):
    id: int
    status: str
    erstellt_von_id: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
