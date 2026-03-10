"""SupporterMember Pydantic schemas for Fördermitglieder"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SupporterMemberBase(BaseModel):
    geschlecht: str = Field(..., min_length=1, max_length=20)
    titel: Optional[str] = Field(None, max_length=50)
    vorname: str = Field(..., min_length=1, max_length=255)
    nachname: str = Field(..., min_length=1, max_length=255)
    kreisverband_id: Optional[int] = None
    beitragshoehe: Decimal = Field(..., ge=0)
    verwendungszweck: Optional[str] = Field(None, max_length=500)
    iban: Optional[str] = Field(None, max_length=34)
    bankinstitut: Optional[str] = Field(None, max_length=255)
    strasse_hausnummer: Optional[str] = Field(None, max_length=255)
    plz: Optional[str] = Field(None, max_length=10)
    ort: Optional[str] = Field(None, max_length=255)
    telefon: Optional[str] = Field(None, max_length=50)
    mobilnummer: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)


class SupporterMemberCreate(SupporterMemberBase):
    pass


class SupporterMemberUpdate(BaseModel):
    geschlecht: Optional[str] = Field(None, min_length=1, max_length=20)
    titel: Optional[str] = Field(None, max_length=50)
    vorname: Optional[str] = Field(None, min_length=1, max_length=255)
    nachname: Optional[str] = Field(None, min_length=1, max_length=255)
    kreisverband_id: Optional[int] = None
    beitragshoehe: Optional[Decimal] = Field(None, ge=0)
    verwendungszweck: Optional[str] = Field(None, max_length=500)
    iban: Optional[str] = Field(None, max_length=34)
    bankinstitut: Optional[str] = Field(None, max_length=255)
    strasse_hausnummer: Optional[str] = Field(None, max_length=255)
    plz: Optional[str] = Field(None, max_length=10)
    ort: Optional[str] = Field(None, max_length=255)
    telefon: Optional[str] = Field(None, max_length=50)
    mobilnummer: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)


class SupporterMemberResponse(SupporterMemberBase):
    id: int
    stufe: str
    ist_aktiv: bool
    created_at: datetime
    updated_at: datetime
    kreisverband_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
