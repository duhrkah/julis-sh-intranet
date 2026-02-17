"""Document & Amendment Pydantic schemas"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime


# ---------- DocumentAenderung (eine Stelle innerhalb eines Änderungsantrags) ----------


class DocumentAenderungBase(BaseModel):
    position: int = 0
    bezug: Optional[str] = None
    alte_fassung: Optional[str] = None
    neue_fassung: Optional[str] = None
    aenderungstext: Optional[str] = None


class DocumentAenderungCreate(DocumentAenderungBase):
    pass


class DocumentAenderungUpdate(BaseModel):
    position: Optional[int] = None
    bezug: Optional[str] = None
    alte_fassung: Optional[str] = None
    neue_fassung: Optional[str] = None
    aenderungstext: Optional[str] = None


class DocumentAenderungResponse(DocumentAenderungBase):
    id: int
    aenderungsantrag_id: int
    model_config = ConfigDict(from_attributes=True)


# ---------- Document ----------


class DocumentBase(BaseModel):
    titel: str
    typ: str
    aktueller_text: Optional[str] = None
    version: Optional[str] = None
    gueltig_ab: Optional[date] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    titel: Optional[str] = None
    aktueller_text: Optional[str] = None
    version: Optional[str] = None
    gueltig_ab: Optional[date] = None


class DocumentResponse(DocumentBase):
    id: int
    datei_pfad: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DocumentAenderungsantragBase(BaseModel):
    document_id: int
    titel: Optional[str] = None
    antragsteller: str
    antrag_text: str
    alte_fassung: Optional[str] = None
    neue_fassung: Optional[str] = None
    begruendung: Optional[str] = None


class DocumentAenderungsantragCreate(DocumentAenderungsantragBase):
    pass


class DocumentAenderungsantragUpdate(BaseModel):
    status: Optional[str] = None
    titel: Optional[str] = None
    antrag_text: Optional[str] = None
    alte_fassung: Optional[str] = None
    neue_fassung: Optional[str] = None
    begruendung: Optional[str] = None


class DocumentAenderungsantragResponse(DocumentAenderungsantragBase):
    id: int
    status: str
    created_at: datetime
    stellen: List[DocumentAenderungResponse] = []
    model_config = ConfigDict(from_attributes=True)
