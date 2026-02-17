"""Meeting model for Sitzungen/Einladungen/Protokolle"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Time, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    titel = Column(String(255), nullable=False)
    titel_kurz = Column(String(255), nullable=True)  # optional, z. B. für Kopfzeilen
    typ = Column(String(50), nullable=False)  # vorstandssitzung, mitgliederversammlung, sonstige
    datum = Column(Date, nullable=False)
    uhrzeit = Column(Time, nullable=True)
    ort = Column(String(500), nullable=True)
    tagesordnung = Column(JSON, nullable=True)  # Array von TOPs: str oder {"titel": "..."}
    protokoll_top_texte = Column(JSON, nullable=True)  # Pro TOP ein Protokolltext, gleiche Reihenfolge wie tagesordnung
    teilnehmer = Column(Text, nullable=True)
    teilnehmer_sonstige = Column(Text, nullable=True)  # Sonstige Teilnehmer (Freitext) für Protokoll
    sitzungsleitung = Column(Text, nullable=True)
    protokollfuehrer = Column(Text, nullable=True)
    beschluesse = Column(Text, nullable=True)
    einladung_variante = Column(String(50), nullable=True, default="freitext")  # landesvorstand | erweiterter_landesvorstand | freitext
    einladung_empfaenger_freitext = Column(Text, nullable=True)  # nur bei einladung_variante=freitext
    teilnehmer_eingeladene_auswahl = Column(JSON, nullable=True)  # ausgewählte Optionen für Protokoll (Liste von Strings)
    einladung_pfad = Column(String(500), nullable=True)
    protokoll_pfad = Column(String(500), nullable=True)

    erstellt_von_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    erstellt_von = relationship("User")
