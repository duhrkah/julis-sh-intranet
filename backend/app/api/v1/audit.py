"""Audit-Log Endpoints – wer hat wann was geändert"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db
from app.core.rbac import require_role
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse

router = APIRouter()


@router.get("/", response_model=List[AuditLogResponse])
async def list_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    user_id: Optional[int] = Query(None, description="Filter by user"),
    action: Optional[str] = Query(None, description="Filter by action"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List audit log entries. Admin only."""
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    query = query.order_by(AuditLog.created_at.desc())
    return query.offset(skip).limit(limit).all()
