"""Event CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from app.api.deps import (
    get_db,
    get_current_user,
    get_tenant_filter,
    get_required_tenant_filter,
    is_tenant_landesverband,
)
from app.core.rbac import require_role, has_min_role
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, EventResponse
from app.services.audit import log_action

router = APIRouter()


@router.get("/", response_model=List[EventResponse])
async def list_events(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    start_date: Optional[date] = Query(None, description="Start date range"),
    end_date: Optional[date] = Query(None, description="End date range"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List events visible to the current user, with optional filters."""
    tenant_ids = get_tenant_filter(db, current_user, tenant_id, include_children=True)
    if not tenant_ids:
        return []

    query = db.query(Event).filter(Event.tenant_id.in_(tenant_ids))

    if status_filter:
        if status_filter not in ("pending", "approved", "rejected"):
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Event.status == status_filter)

    if start_date:
        query = query.filter(Event.start_date >= start_date)
    if end_date:
        query = query.filter(Event.start_date <= end_date)

    query = query.order_by(Event.start_date.desc(), Event.created_at.desc())
    events = query.offset(skip).limit(limit).all()
    return events


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new event. Regular users create events with status=pending.
    Vorstand+ users create events with status=approved automatically.
    """
    target_tenant_id = event_data.target_tenant_id or current_user.tenant_id
    if target_tenant_id is None:
        raise HTTPException(status_code=400, detail="No target tenant specified and user has no tenant")

    accessible = get_required_tenant_filter(db, current_user, target_tenant_id, include_children=True)
    if target_tenant_id not in accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to target tenant")

    # Landesverband: nur aus Intranet, keine Freigabe nötig → immer approved
    # Kreisverband: Vorstand = approved, sonst pending (Freigabe)
    if is_tenant_landesverband(db, target_tenant_id):
        initial_status = "approved"
    else:
        initial_status = "approved" if has_min_role(current_user.role, "vorstand") else "pending"

    db_event = Event(
        title=event_data.title,
        description=event_data.description,
        start_date=event_data.start_date,
        start_time=event_data.start_time,
        end_date=event_data.end_date,
        end_time=event_data.end_time,
        location=event_data.location,
        location_url=event_data.location_url,
        organizer=event_data.organizer,
        category_id=event_data.category_id,
        is_public=event_data.is_public,
        submitter_name=event_data.submitter_name or current_user.full_name,
        submitter_email=event_data.submitter_email or current_user.email,
        submitter_id=current_user.id,
        tenant_id=target_tenant_id,
        source_tenant_id=current_user.tenant_id,
        status=initial_status,
        approved_at=datetime.utcnow() if initial_status == "approved" else None,
        approved_by=current_user.id if initial_status == "approved" else None,
    )
    db.add(db_event)
    db.flush()
    log_action(db, current_user.id, "create", "event", db_event.id, f"Event erstellt: {db_event.title}", request)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single event by ID."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if event.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this event")

    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an event. Only the submitter or vorstand+ can update.
    Updating a rejected/approved event resets status to pending for non-vorstand users.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_submitter = event.submitter_id == current_user.id
    is_vorstand = has_min_role(current_user.role, "vorstand")

    if not is_submitter and not is_vorstand:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this event")

    update_data = event_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    # If a non-vorstand user edits a rejected event, reset to pending
    if not is_vorstand and event.status == "rejected":
        event.status = "pending"
        event.rejection_reason = None

    log_action(db, current_user.id, "update", "event", event.id, f"Event aktualisiert: {event.title}", request)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an event. Only the submitter or vorstand+ can delete."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_submitter = event.submitter_id == current_user.id
    is_vorstand = has_min_role(current_user.role, "vorstand")

    if not is_submitter and not is_vorstand:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this event")

    event_title = event.title
    db.delete(event)
    log_action(db, current_user.id, "delete", "event", event_id, f"Event gelöscht: {event_title}", request)
    db.commit()
    return None
