"""Kreisverband models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Kreisverband(Base):
    __tablename__ = "kreisverband"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    kuerzel = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    ist_aktiv = Column(Boolean, default=True, nullable=False)

    # Verknüpfung zum Tenant-System
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant")
    vorstandsmitglieder = relationship("KVVorstandsmitglied", back_populates="kreisverband", cascade="all, delete-orphan")
    protokolle = relationship("KVProtokoll", back_populates="kreisverband", cascade="all, delete-orphan")
    email_empfaenger = relationship("EmailRecipient", back_populates="kreisverband", cascade="all, delete-orphan")


class KVVorstandsmitglied(Base):
    __tablename__ = "kv_vorstandsmitglieder"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    kreisverband_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    rolle = Column(String(100), nullable=False)  # Vorsitzender, Stellvertreter, Schatzmeister, etc.
    amtszeit_start = Column(Date, nullable=True)
    amtszeit_ende = Column(Date, nullable=True)
    ist_aktiv = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    kreisverband = relationship("Kreisverband", back_populates="vorstandsmitglieder")


class KVProtokoll(Base):
    __tablename__ = "kv_protokolle"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    kreisverband_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="CASCADE"), nullable=False, index=True)
    titel = Column(String(255), nullable=False)
    datum = Column(Date, nullable=False)
    typ = Column(String(50), nullable=False)  # MV, Vorstandssitzung
    datei_pfad = Column(String(500), nullable=True)
    beschreibung = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    kreisverband = relationship("Kreisverband", back_populates="protokolle")
