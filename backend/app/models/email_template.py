"""EmailTemplate model"""
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    typ = Column(String(20), nullable=False)  # mitglied, empfaenger
    scenario = Column(String(50), nullable=False, index=True)  # eintritt, austritt, etc.
    kreisverband_id = Column(Integer, nullable=True)  # Optional: KV-spezifisch
    betreff = Column(String(500), nullable=False)
    inhalt = Column(Text, nullable=False)
    # Anhang: Dateiname für E-Mail, Speicherpfad relativ zu UPLOAD_DIR
    attachment_original_filename = Column(String(255), nullable=True)
    attachment_storage_path = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
