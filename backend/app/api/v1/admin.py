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
from app.config import settings
from app.schemas.event import EventResponse
from app.services.audit import log_action
from app.services.graph_calendar import sync_event_to_graph

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
    await sync_event_to_graph(db, event)
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
    await sync_event_to_graph(db, event)
    return event


class GraphSyncResult(BaseModel):
    configured: bool
    processed: int
    created: int
    updated: int
    deleted: int
    failed: int


@router.post("/events/sync-graph-calendar", response_model=GraphSyncResult)
async def sync_graph_calendar(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Alle sichtbaren Events mit dem internen Outlook-Sammelkalender abgleichen.

    Nützlich für den initialen Rollout oder nach Ausfällen der Graph-API.
    Legt fehlende approved+public-Events im Kalender an, aktualisiert
    bestehende, und entfernt Einträge für Events, die den Status verloren haben.
    """
    if not settings.graph_calendar_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GRAPH_CALENDAR_MAILBOX und MS-Graph-Zugangsdaten sind nicht konfiguriert.",
        )

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if not tenant_ids:
        return GraphSyncResult(configured=True, processed=0, created=0, updated=0, deleted=0, failed=0)

    events = (
        db.query(Event)
        .filter(Event.tenant_id.in_(tenant_ids))
        .filter((Event.status == "approved") | (Event.graph_event_id.isnot(None)))
        .all()
    )

    created = updated = deleted = failed = 0
    for event in events:
        before_id = event.graph_event_id
        should_exist = event.status == "approved" and event.is_public
        try:
            await sync_event_to_graph(db, event)
        except Exception:
            failed += 1
            continue
        after_id = event.graph_event_id
        if should_exist:
            if not before_id and after_id:
                created += 1
            elif before_id and after_id:
                updated += 1
            elif not after_id:
                failed += 1
        else:
            if before_id and not after_id:
                deleted += 1

    log_action(
        db,
        current_user.id,
        "sync",
        "graph_calendar",
        None,
        f"Graph-Kalender synchronisiert: {created} neu, {updated} aktualisiert, {deleted} entfernt",
        request,
    )
    db.commit()

    return GraphSyncResult(
        configured=True,
        processed=len(events),
        created=created,
        updated=updated,
        deleted=deleted,
        failed=failed,
    )
