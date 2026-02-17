"""User SQLAlchemy model with RBAC (4 roles)"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, CheckConstraint, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="mitarbeiter")
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            role.in_(['admin', 'leitung', 'vorstand', 'mitarbeiter']),
            name='check_role_type'
        ),
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    submitted_events = relationship("Event", back_populates="submitter", foreign_keys="Event.submitter_id")
    approved_events = relationship("Event", back_populates="approver", foreign_keys="Event.approved_by")
    created_categories = relationship("Category", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"

    def get_display_role(self) -> str:
        role_names = {
            "admin": "Administrator",
            "leitung": "Leitung",
            "vorstand": "Vorstand",
            "mitarbeiter": "Mitarbeiter",
        }
        base = role_names.get(self.role, self.role)
        if self.role == "vorstand" and self.tenant and self.tenant.level:
            level_map = {
                "bundesverband": "Bundesvorstand",
                "landesverband": "Landesvorstand",
                "bezirksverband": "Bezirksvorstand",
                "kreisverband": "Kreisvorstand",
            }
            if self.tenant.level in level_map:
                return level_map[self.tenant.level]
        return base
