"""Admin endpoints for event management"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.api.deps import get_db, get_tenant_filter
from app.core.rbac import require_role
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventResponse
from app.services.audit import log_action

router = APIRouter()


class RejectRequest(BaseModel):
    rejection_reason: str


@router.get("/events/pending", response_model=List[EventResponse])
async def list_pending_events(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """List all pending events for tenants the user has access to."""
    tenant_ids = get_tenant_filter(db, current_user, tenant_id, include_children=True)
    if not tenant_ids:
        return []

    query = (
        db.query(Event)
        .filter(Event.tenant_id.in_(tenant_ids), Event.status == "pending")
        .order_by(Event.created_at.asc())
    )
    events = query.offset(skip).limit(limit).all()
    return events


@router.post("/events/{event_id}/approve", response_model=EventResponse)
async def approve_event(
    event_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Approve a pending event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if event.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this event's tenant")

    if event.status != "pending":
        raise HTTPException(status_code=400, detail=f"Event is already '{event.status}', cannot approve")

    event.status = "approved"
    event.approved_at = datetime.utcnow()
    event.approved_by = current_user.id
    event.rejection_reason = None

    log_action(db, current_user.id, "approve", "event", event.id, f"Event freigegeben: {event.title}", request)
    db.commit()
    db.refresh(event)
    return event


@router.post("/events/{event_id}/reject", response_model=EventResponse)
async def reject_event(
    event_id: int,
    reject_data: RejectRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Reject a pending event with a reason."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if event.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this event's tenant")

    if event.status != "pending":
        raise HTTPException(status_code=400, detail=f"Event is already '{event.status}', cannot reject")

    event.status = "rejected"
    event.rejection_reason = reject_data.rejection_reason
    event.approved_at = None
    event.approved_by = None

    log_action(db, current_user.id, "reject", "event", event.id, f"Event abgelehnt: {event.title}", request)
    db.commit()
    db.refresh(event)
    return event
