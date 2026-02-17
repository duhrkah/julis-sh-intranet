"""Meeting Pydantic schemas"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any, Union
from datetime import date, time, datetime

# Pro TOP: ein String (ganzer TOP) oder Liste von Strings (ein Text pro Unterpunkt)
ProtokollTopTexte = List[Union[str, List[str]]]


class MeetingBase(BaseModel):
    titel: str
    titel_kurz: Optional[str] = None
    typ: str
    datum: date
    uhrzeit: Optional[time] = None
    ort: Optional[str] = None
    tagesordnung: Optional[List[Any]] = None
    protokoll_top_texte: Optional[ProtokollTopTexte] = None
    teilnehmer: Optional[str] = None
    teilnehmer_sonstige: Optional[str] = None
    sitzungsleitung: Optional[str] = None
    protokollfuehrer: Optional[str] = None
    beschluesse: Optional[str] = None
    einladung_variante: Optional[str] = "freitext"  # landesvorstand | erweiterter_landesvorstand | freitext
    einladung_empfaenger_freitext: Optional[str] = None
    teilnehmer_eingeladene_auswahl: Optional[List[str]] = None  # ausgewählte Optionen für Protokoll


class MeetingCreate(MeetingBase):
    pass


class MeetingUpdate(BaseModel):
    titel: Optional[str] = None
    titel_kurz: Optional[str] = None
    typ: Optional[str] = None
    datum: Optional[date] = None
    uhrzeit: Optional[time] = None
    ort: Optional[str] = None
    tagesordnung: Optional[List[Any]] = None
    protokoll_top_texte: Optional[ProtokollTopTexte] = None
    teilnehmer: Optional[str] = None
    teilnehmer_sonstige: Optional[str] = None
    sitzungsleitung: Optional[str] = None
    protokollfuehrer: Optional[str] = None
    beschluesse: Optional[str] = None
    einladung_variante: Optional[str] = None
    einladung_empfaenger_freitext: Optional[str] = None
    teilnehmer_eingeladene_auswahl: Optional[List[str]] = None


class MeetingResponse(MeetingBase):
    id: int
    einladung_pfad: Optional[str] = None
    protokoll_pfad: Optional[str] = None
    erstellt_von_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
