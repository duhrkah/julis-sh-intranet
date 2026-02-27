"""Event CRUD endpoints"""
import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, datetime

from app.api.deps import (
    get_db,
    get_current_user,
    get_tenant_filter,
    get_required_tenant_filter,
    is_tenant_landesverband,
)
from app.config import settings
from app.core.rbac import require_role, has_min_role
from app.models.event import Event
from app.models.event_attachment import EventAttachment
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, EventResponse, EventAttachmentResponse, EventAttachmentRename
from app.services.audit import log_action

router = APIRouter()

EVENT_ATTACHMENT_DIR = os.path.join(settings.UPLOAD_DIR, "event_attachments")
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"}
MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024  # 20 MB


def _validate_attachment(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower() if filename else ""
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp '{ext}' nicht erlaubt. Erlaubt: {', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}",
        )
    return ext


def _safe_file_path(base_dir: str, file_path: str) -> bool:
    real_base = os.path.realpath(base_dir)
    real_path = os.path.realpath(file_path)
    return real_path.startswith(real_base)


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

    query = db.query(Event).options(joinedload(Event.attachments)).filter(Event.tenant_id.in_(tenant_ids))

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
    event = db.query(Event).options(joinedload(Event.attachments)).filter(Event.id == event_id).first()
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
    """Event löschen. Nur Ersteller oder Vorstand."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_submitter = event.submitter_id == current_user.id
    is_vorstand = has_min_role(current_user.role, "vorstand")

    if not is_submitter and not is_vorstand:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this event")

    # Anhänge von Disk löschen
    for att in event.attachments:
        if att.file_path and os.path.exists(att.file_path) and _safe_file_path(EVENT_ATTACHMENT_DIR, att.file_path):
            os.remove(att.file_path)

    event_title = event.title
    db.delete(event)
    log_action(db, current_user.id, "delete", "event", event_id, f"Event gelöscht: {event_title}", request)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Event Attachments
# ---------------------------------------------------------------------------


@router.post("/{event_id}/attachments", response_model=EventAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_event_attachment(
    event_id: int,
    datei: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datei an Event anhängen. Nur Ersteller oder Vorstand+."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_submitter = event.submitter_id == current_user.id
    is_vorstand = has_min_role(current_user.role, "vorstand")
    if not is_submitter and not is_vorstand:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to add attachments")

    os.makedirs(EVENT_ATTACHMENT_DIR, exist_ok=True)
    ext = _validate_attachment(datei.filename)
    content = await datei.read()
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=400, detail=f"Datei zu groß. Maximum: {MAX_ATTACHMENT_SIZE // (1024 * 1024)} MB")

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(EVENT_ATTACHMENT_DIR, safe_filename)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    attachment = EventAttachment(
        event_id=event_id,
        original_name=datei.filename or safe_filename,
        file_path=file_path,
        file_size=len(content),
        content_type=datei.content_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/{event_id}/attachments/{attachment_id}")
async def download_event_attachment(
    event_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Anhang herunterladen. Zugriffsschutz über Tenant."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if event.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this event")

    attachment = db.query(EventAttachment).filter(
        EventAttachment.id == attachment_id,
        EventAttachment.event_id == event_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not os.path.exists(attachment.file_path) or not _safe_file_path(EVENT_ATTACHMENT_DIR, attachment.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=attachment.file_path,
        filename=attachment.original_name,
        media_type=attachment.content_type or "application/octet-stream",
    )


@router.patch("/{event_id}/attachments/{attachment_id}", response_model=EventAttachmentResponse)
async def rename_event_attachment(
    event_id: int,
    attachment_id: int,
    data: EventAttachmentRename,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Anhang umbenennen. Nur Ersteller oder Vorstand+."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_submitter = event.submitter_id == current_user.id
    is_vorstand = has_min_role(current_user.role, "vorstand")
    if not is_submitter and not is_vorstand:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to rename attachments")

    attachment = db.query(EventAttachment).filter(
        EventAttachment.id == attachment_id,
        EventAttachment.event_id == event_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    attachment.original_name = data.original_name
    log_action(db, current_user.id, "update", "event_attachment", attachment_id, f"Anhang umbenannt: {data.original_name}", request)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.delete("/{event_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_attachment(
    event_id: int,
    attachment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Anhang löschen. Nur Ersteller oder Vorstand+."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_submitter = event.submitter_id == current_user.id
    is_vorstand = has_min_role(current_user.role, "vorstand")
    if not is_submitter and not is_vorstand:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete attachments")

    attachment = db.query(EventAttachment).filter(
        EventAttachment.id == attachment_id,
        EventAttachment.event_id == event_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if attachment.file_path and os.path.exists(attachment.file_path) and _safe_file_path(EVENT_ATTACHMENT_DIR, attachment.file_path):
        os.remove(attachment.file_path)

    db.delete(attachment)
    log_action(db, current_user.id, "delete", "event_attachment", attachment_id, f"Anhang gelöscht: {attachment.original_name}", request)
    db.commit()
    return None
