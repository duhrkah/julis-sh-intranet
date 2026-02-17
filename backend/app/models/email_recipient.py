"""EmailRecipient model - Empfänger pro Kreisverband"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class EmailRecipient(Base):
    __tablename__ = "email_recipients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    kreisverband_id = Column(Integer, ForeignKey("kreisverband.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    rolle = Column(String(100), nullable=False)  # Vorsitzender, Schatzmeister

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    kreisverband = relationship("Kreisverband", back_populates="email_empfaenger")
