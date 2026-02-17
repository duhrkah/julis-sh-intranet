"""MemberChange model for Mitgliederänderungen"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class MemberChange(Base):
    __tablename__ = "member_changes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scenario = Column(String(50), nullable=False, index=True)  # eintritt, austritt, verbandswechsel_eintritt, verbandswechsel_austritt, verbandswechsel_intern, veraenderung

    # Mitgliedsdaten
    mitgliedsnummer = Column(String(50), nullable=True, index=True)
    vorname = Column(String(255), nullable=False)
    nachname = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telefon = Column(String(50), nullable=True)
    strasse = Column(String(255), nullable=True)
    hausnummer = Column(String(20), nullable=True)
    plz = Column(String(10), nullable=True)
    ort = Column(String(255), nullable=True)
    geburtsdatum = Column(String(20), nullable=True)

    # Kreisverband-Referenzen
    kreisverband_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="SET NULL"), nullable=True, index=True)
    kreisverband_alt_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="SET NULL"), nullable=True)
    kreisverband_neu_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="SET NULL"), nullable=True)

    # Zusätzliche Daten
    bemerkung = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="versendet")  # entwurf, versendet

    # Tracking
    erstellt_von_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    kreisverband = relationship("Kreisverband", foreign_keys=[kreisverband_id])
    kreisverband_alt = relationship("Kreisverband", foreign_keys=[kreisverband_alt_id])
    kreisverband_neu = relationship("Kreisverband", foreign_keys=[kreisverband_neu_id])
    erstellt_von = relationship("User", foreign_keys=[erstellt_von_id])
