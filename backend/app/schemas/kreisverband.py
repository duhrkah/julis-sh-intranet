"""Kreisverband Pydantic schemas"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime


class KreisverbandBase(BaseModel):
    name: str
    kuerzel: Optional[str] = None
    email: Optional[str] = None
    ist_aktiv: bool = True
    tenant_id: Optional[int] = None


class KreisverbandCreate(KreisverbandBase):
    pass


class KreisverbandUpdate(BaseModel):
    name: Optional[str] = None
    kuerzel: Optional[str] = None
    email: Optional[str] = None
    ist_aktiv: Optional[bool] = None
    tenant_id: Optional[int] = None


class KVVorstandsmitgliedBase(BaseModel):
    name: str
    email: Optional[str] = None
    rolle: str
    amtszeit_start: Optional[date] = None
    amtszeit_ende: Optional[date] = None
    ist_aktiv: bool = True


class KVVorstandsmitgliedCreate(KVVorstandsmitgliedBase):
    kreisverband_id: int


class KVVorstandsmitgliedResponse(KVVorstandsmitgliedBase):
    id: int
    kreisverband_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class KVProtokollBase(BaseModel):
    titel: str
    datum: date
    typ: str
    beschreibung: Optional[str] = None


class KVProtokollCreate(KVProtokollBase):
    kreisverband_id: int


class KVProtokollResponse(KVProtokollBase):
    id: int
    kreisverband_id: int
    datei_pfad: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class KreisverbandResponse(KreisverbandBase):
    id: int
    created_at: datetime
    updated_at: datetime
    vorstandsmitglieder: List[KVVorstandsmitgliedResponse] = []
    model_config = ConfigDict(from_attributes=True)


class KreisverbandListResponse(KreisverbandBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Vorstandsübersicht Landesverband: pro KV die gefilterten Vorstandsmitglieder
class VorstandUebersichtMitglied(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    rolle: str


class VorstandUebersichtEintrag(BaseModel):
    kreisverband: KreisverbandListResponse
    mitglieder: List[VorstandUebersichtMitglied]
