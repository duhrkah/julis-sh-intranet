"""Tenant SQLAlchemy model for multi-tenancy support"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    level = Column(String(50), nullable=False)
    parent_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    is_active = Column(Boolean, default=True, nullable=False)

    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(7), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    parent = relationship("Tenant", remote_side=[id], backref="children")
    users = relationship("User", back_populates="tenant")
    events = relationship("Event", back_populates="tenant", foreign_keys="Event.tenant_id")
    categories = relationship("Category", back_populates="tenant")

    def __repr__(self):
        return f"<Tenant(id={self.id}, name='{self.name}', level='{self.level}')>"

    def is_top_level(self) -> bool:
        return self.parent_id is None

    def get_all_child_ids(self, db) -> list:
        child_ids = []
        for child in self.children:
            child_ids.append(child.id)
            child_ids.extend(child.get_all_child_ids(db))
        return child_ids
