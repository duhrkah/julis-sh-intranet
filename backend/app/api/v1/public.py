"""Public endpoints for the calendar (no authentication required)"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from app.api.deps import (
    get_db,
    get_visible_tenant_ids_for_public,
    get_tenant_context,
    get_public_calendar_tenant_ids,
    is_tenant_kreisverband,
)
from app.config import settings
from app.models.event import Event
from app.models.category import Category
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.event import EventResponse, EventPublicCreate
from app.schemas.category import CategoryPublic
from pydantic import BaseModel


class TenantPublicShort(BaseModel):
    id: int
    name: str
    slug: str


class PublicCalendarsResponse(BaseModel):
    landesverband: Optional[TenantPublicShort] = None
    kreisverband: List[TenantPublicShort] = []


router = APIRouter()


@router.get("/calendars", response_model=PublicCalendarsResponse)
async def get_public_calendars(db: Session = Depends(get_db)):
    """
    Zwei Kalender: Landesverband (Root-Tenant, nur aus Intranet) und
    Kreisverbände (Kind-Tenants, öffentliche Einreichung + Freigabe).
    """
    roots = (
        db.query(Tenant)
        .filter(Tenant.parent_id.is_(None), Tenant.is_active == True)
        .order_by(Tenant.id)
        .all()
    )
    children = (
        db.query(Tenant)
        .filter(Tenant.parent_id.isnot(None), Tenant.is_active == True)
        .order_by(Tenant.name)
        .all()
    )
    landesverband = None
    if roots:
        landesverband = TenantPublicShort(id=roots[0].id, name=roots[0].name, slug=roots[0].slug)
    kreisverband = [TenantPublicShort(id=t.id, name=t.name, slug=t.slug) for t in children]
    return PublicCalendarsResponse(landesverband=landesverband, kreisverband=kreisverband)


@router.get("/events", response_model=List[EventResponse])
async def list_public_events(
    start_date: Optional[date] = Query(None, description="Filter from start date"),
    end_date: Optional[date] = Query(None, description="Filter until end date"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    calendar: Optional[str] = Query(
        None, description="Kalender: landesverband | kreisverband"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tenant_ids: List[int] = Depends(get_visible_tenant_ids_for_public),
    db: Session = Depends(get_db),
):
    """List approved public events. No authentication required."""
    if calendar in ("landesverband", "kreisverband"):
        tenant_ids = get_public_calendar_tenant_ids(db, calendar)
    if not tenant_ids:
        return []
    query = db.query(Event).filter(
        Event.status == "approved",
        Event.is_public == True,
        Event.tenant_id.in_(tenant_ids),
    )

    if start_date:
        query = query.filter(Event.start_date >= start_date)
    if end_date:
        query = query.filter(Event.start_date <= end_date)
    if category_id:
        query = query.filter(Event.category_id == category_id)

    query = query.order_by(Event.start_date.asc(), Event.start_time.asc())
    return query.offset(skip).limit(limit).all()


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_public_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    """Get a single event by ID if it is approved and public."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != "approved" or not event.is_public:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def submit_public_event(
    data: EventPublicCreate,
    db: Session = Depends(get_db),
):
    """
    Öffentliche Termin-Einreichung ohne Login.
    Erfordert PUBLIC_SUBMITTER_USER_ID und PUBLIC_DEFAULT_TENANT_ID (oder tenant_id im Body).
    """
    submitter_id = settings.PUBLIC_SUBMITTER_USER_ID
    if submitter_id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Öffentliche Termin-Einreichung ist derzeit nicht konfiguriert.",
        )
    submitter = db.query(User).filter(User.id == submitter_id).first()
    if not submitter or not submitter.is_active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Öffentliche Termin-Einreichung ist derzeit nicht verfügbar.",
        )

    tenant_id = data.tenant_id if data.tenant_id is not None else settings.PUBLIC_DEFAULT_TENANT_ID
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id ist erforderlich oder PUBLIC_DEFAULT_TENANT_ID muss gesetzt sein.",
        )
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger oder inaktiver Tenant.",
        )
    if not is_tenant_kreisverband(db, tenant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Öffentliche Einreichung nur für Kreisverbands-Termine. Landesverbands-Termine werden im Intranet angelegt.",
        )

    if data.category_id is not None:
        cat = (
            db.query(Category)
            .filter(
                Category.id == data.category_id,
                Category.tenant_id == tenant_id,
                Category.is_active == True,
            )
            .first()
        )
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ungültige oder dem Tenant nicht zugeordnete Kategorie.",
            )

    event = Event(
        title=data.title,
        description=data.description,
        start_date=data.start_date,
        start_time=data.start_time,
        end_date=data.end_date,
        end_time=data.end_time,
        location=data.location,
        location_url=data.location_url,
        organizer=data.organizer,
        category_id=data.category_id,
        status="pending",
        submitter_id=submitter_id,
        submitter_name=data.submitter_name,
        submitter_email=data.submitter_email,
        tenant_id=tenant_id,
        is_public=True,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/categories", response_model=List[CategoryPublic])
async def list_public_categories(
    calendar: Optional[str] = Query(None, description="landesverband | kreisverband"),
    tenant_ids: List[int] = Depends(get_visible_tenant_ids_for_public),
    db: Session = Depends(get_db),
):
    """List active categories for public display."""
    if calendar in ("landesverband", "kreisverband"):
        tenant_ids = get_public_calendar_tenant_ids(db, calendar)
    if not tenant_ids:
        return []
    categories = (
        db.query(Category)
        .filter(Category.tenant_id.in_(tenant_ids), Category.is_active == True)
        .order_by(Category.name)
        .all()
    )
    return categories


@router.get("/events.ics")
async def export_ical(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    calendar: Optional[str] = Query(None, description="landesverband | kreisverband"),
    tenant_ids: List[int] = Depends(get_visible_tenant_ids_for_public),
    db: Session = Depends(get_db),
):
    """Export approved public events as iCalendar (.ics) file."""
    if calendar in ("landesverband", "kreisverband"):
        tenant_ids = get_public_calendar_tenant_ids(db, calendar)
    if not tenant_ids:
        return Response(content="BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", media_type="text/calendar; charset=utf-8")
    query = db.query(Event).filter(
        Event.status == "approved",
        Event.is_public == True,
        Event.tenant_id.in_(tenant_ids),
    )

    if start_date:
        query = query.filter(Event.start_date >= start_date)
    if end_date:
        query = query.filter(Event.start_date <= end_date)

    events = query.order_by(Event.start_date.asc()).all()

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//JuLis Intranet//Kalender//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:JuLis Kalender",
    ]

    for event in events:
        dtstart = event.start_date.strftime("%Y%m%d")
        if event.start_time:
            dtstart = f"{event.start_date.strftime('%Y%m%d')}T{event.start_time.strftime('%H%M%S')}"

        dtend = ""
        if event.end_date:
            dtend = event.end_date.strftime("%Y%m%d")
            if event.end_time:
                dtend = f"{event.end_date.strftime('%Y%m%d')}T{event.end_time.strftime('%H%M%S')}"
        elif event.end_time and event.start_date:
            dtend = f"{event.start_date.strftime('%Y%m%d')}T{event.end_time.strftime('%H%M%S')}"

        summary = _ical_escape(event.title)
        description = _ical_escape(event.description or "")
        location = _ical_escape(event.location or "")

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:event-{event.id}@julis-intranet")
        lines.append(f"DTSTART:{dtstart}")
        if dtend:
            lines.append(f"DTEND:{dtend}")
        lines.append(f"SUMMARY:{summary}")
        if description:
            lines.append(f"DESCRIPTION:{description}")
        if location:
            lines.append(f"LOCATION:{location}")
        if event.organizer:
            lines.append(f"ORGANIZER:{_ical_escape(event.organizer)}")
        lines.append(f"DTSTAMP:{event.created_at.strftime('%Y%m%dT%H%M%SZ')}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    ical_content = "\r\n".join(lines)
    return Response(
        content=ical_content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=julis-kalender.ics"},
    )


def _ical_escape(text: str) -> str:
    """Escape special characters for iCalendar format."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )
