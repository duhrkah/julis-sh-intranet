"""SupporterMember model for Fördermitglieder-Verwaltung"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


STUFEN = [
    ("Zukunftsgestalter", 450),
    ("Chancenmacher", 250),
    ("Freiheitsbringer", 120),
    ("Impulsgeber", 25),
]


def berechne_stufe(beitragshoehe: float) -> str:
    """Berechnet die Stufe anhand der Beitragshöhe (€/Jahr)."""
    for name, min_betrag in STUFEN:
        if beitragshoehe >= min_betrag:
            return name
    return "Impulsgeber"


class SupporterMember(Base):
    __tablename__ = "supporter_members"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    geschlecht = Column(String(20), nullable=False)
    titel = Column(String(50), nullable=True)
    vorname = Column(String(255), nullable=False)
    nachname = Column(String(255), nullable=False, index=True)

    kreisverband_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="SET NULL"), nullable=True, index=True)

    beitragshoehe = Column(Numeric(10, 2), nullable=False)
    stufe = Column(String(50), nullable=False)
    verwendungszweck = Column(String(500), nullable=True)

    iban = Column(String(34), nullable=True)
    bankinstitut = Column(String(255), nullable=True)

    strasse_hausnummer = Column(String(255), nullable=True)
    plz = Column(String(10), nullable=True)
    ort = Column(String(255), nullable=True)

    telefon = Column(String(50), nullable=True)
    mobilnummer = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)

    ist_aktiv = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    kreisverband = relationship("Kreisverband", foreign_keys=[kreisverband_id])
