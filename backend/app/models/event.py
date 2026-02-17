"""Event SQLAlchemy model"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Time, ForeignKey, Text, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=True)
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    location = Column(String(500), nullable=True)
    location_url = Column(String(500), nullable=True)
    organizer = Column(String(255), nullable=True)

    status = Column(String(20), nullable=False, default="pending", index=True)
    rejection_reason = Column(Text, nullable=True)

    submitter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    submitter_name = Column(String(255), nullable=True)
    submitter_email = Column(String(255), nullable=True)

    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    source_tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)

    is_public = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(status.in_(['pending', 'approved', 'rejected']), name='check_status_type'),
    )

    tenant = relationship("Tenant", back_populates="events", foreign_keys=[tenant_id])
    source_tenant = relationship("Tenant", foreign_keys=[source_tenant_id])
    submitter = relationship("User", back_populates="submitted_events", foreign_keys=[submitter_id])
    approver = relationship("User", back_populates="approved_events", foreign_keys=[approved_by])
    category = relationship("Category", back_populates="events")
