"""Email recipient CRUD – Empfänger pro Kreisverband (Vorsitzender, Schatzmeister)"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db
from app.core.rbac import require_role
from app.models.email_recipient import EmailRecipient
from app.models.user import User
from app.schemas.email_recipient import (
    EmailRecipientCreate,
    EmailRecipientUpdate,
    EmailRecipientResponse,
)

router = APIRouter()


@router.get("/", response_model=List[EmailRecipientResponse])
async def list_email_recipients(
    kreisverband_id: Optional[int] = Query(None, description="Filter by Kreisverband"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """List email recipients. Leitung+ can view."""
    query = db.query(EmailRecipient)
    if kreisverband_id is not None:
        query = query.filter(EmailRecipient.kreisverband_id == kreisverband_id)
    return query.order_by(EmailRecipient.kreisverband_id, EmailRecipient.rolle).all()


@router.post("/", response_model=EmailRecipientResponse, status_code=status.HTTP_201_CREATED)
async def create_email_recipient(
    data: EmailRecipientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Create an email recipient. Leitung+ can create."""
    rec = EmailRecipient(
        kreisverband_id=data.kreisverband_id,
        name=data.name,
        email=data.email,
        rolle=data.rolle,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/{recipient_id}", response_model=EmailRecipientResponse)
async def get_email_recipient(
    recipient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Get a single recipient by ID."""
    rec = db.query(EmailRecipient).filter(EmailRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Email recipient not found")
    return rec


@router.put("/{recipient_id}", response_model=EmailRecipientResponse)
async def update_email_recipient(
    recipient_id: int,
    data: EmailRecipientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Update an email recipient. Leitung+ can edit."""
    rec = db.query(EmailRecipient).filter(EmailRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Email recipient not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rec, field, value)
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{recipient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_recipient(
    recipient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """E-Mail-Empfänger löschen. Nur Admin kann löschen."""
    rec = db.query(EmailRecipient).filter(EmailRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Email recipient not found")
    db.delete(rec)
    db.commit()
    return None
