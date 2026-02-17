"""Document model for Satzung/GO"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Date
from sqlalchemy.sql import func
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    titel = Column(String(255), nullable=False)
    typ = Column(String(50), nullable=False)  # satzung, geschaeftsordnung
    aktueller_text = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)
    gueltig_ab = Column(Date, nullable=True)
    datei_pfad = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
