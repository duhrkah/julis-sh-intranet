"""DocumentAenderungsantrag model for Änderungsanträge"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class DocumentAenderungsantrag(Base):
    __tablename__ = "document_aenderungsantraege"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    titel = Column(String(500), nullable=True)  # z. B. "2. Änderung der Satzung"
    antragsteller = Column(String(255), nullable=False)
    antrag_text = Column(Text, nullable=False)  # Kurzbeschreibung
    alte_fassung = Column(Text, nullable=True)  # Legacy: eine Stelle; wird ignoriert wenn Stellen vorhanden
    neue_fassung = Column(Text, nullable=True)
    begruendung = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="eingereicht")  # eingereicht, angenommen, abgelehnt

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document = relationship("Document")
    stellen = relationship(
        "DocumentAenderung",
        back_populates="aenderungsantrag",
        order_by="DocumentAenderung.position",
        cascade="all, delete-orphan",
    )
