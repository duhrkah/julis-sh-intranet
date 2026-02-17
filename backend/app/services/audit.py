"""Audit logging service for tracking all user actions"""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Create an audit log entry."""
    ip_address = None
    if request:
        ip_address = request.client.host if request.client else None

    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    try:
        db.flush()
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
    return entry
