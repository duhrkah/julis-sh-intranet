"""Email template CRUD endpoints"""
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db
from app.config import settings
from app.core.rbac import require_role
from app.models.email_template import EmailTemplate
from app.models.user import User
from app.schemas.email_template import (
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateResponse,
)
from app.services.email import send_email, render_template, get_attachment_from_path

router = APIRouter()

EMAIL_TEMPLATES_UPLOAD_DIR = "email_templates"
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".odt", ".txt", ".png", ".jpg", ".jpeg"}


def _sample_template_vars(scenario: str, typ: str) -> dict:
    """Beispieldaten für Template-Test (Platzhalter)."""
    return {
        "vorname": "Max",
        "nachname": "Muster",
        "email": "max.muster@beispiel.de",
        "mitgliedsnummer": "12345",
        "kreisverband": "Kiel",
        "kreis": "Kiel",
        "kreisverband_alt": "Flensburg",
        "kreisverband_neu": "Kiel",
        "telefon": "0123 456789",
        "strasse": "Musterstraße",
        "hausnummer": "1",
        "plz": "24103",
        "ort": "Kiel",
        "geburtsdatum": "01.01.1990",
        "bemerkung": "Test-Bemerkung",
        "scenario": scenario,
        "eintrittsdatum": "17.02.2025",
        "austrittsdatum": "01.03.2025",
        "wechseldatum": "15.02.2025",
        "empfaenger_name": "Anna Vorsitz" if typ == "empfaenger" else "",
        "vorsitzender": "Anna Vorsitz",
        "schatzmeister": "Bernd Schatz",
        "ihr_kreis": "Kiel",
        "abgebend_oder_aufnehmend": "abgebend",
    }


def _build_attachments_list(template: EmailTemplate) -> List[tuple]:
    """[(filename, bytes), ...] für send_email."""
    att = get_attachment_from_path(
        settings.UPLOAD_DIR,
        template.attachment_storage_path,
        template.attachment_original_filename,
    )
    return [att] if att else []


@router.get("/", response_model=List[EmailTemplateResponse])
async def list_email_templates(
    scenario: Optional[str] = Query(None, description="Filter by scenario"),
    typ: Optional[str] = Query(None, description="Filter by type (mitglied/empfaenger)"),
    kreisverband_id: Optional[int] = Query(None, description="Filter by Kreisverband"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """List email templates with optional filters. Leitung+ role required."""
    query = db.query(EmailTemplate)

    if scenario:
        query = query.filter(EmailTemplate.scenario == scenario)
    if typ:
        query = query.filter(EmailTemplate.typ == typ)
    if kreisverband_id is not None:
        query = query.filter(EmailTemplate.kreisverband_id == kreisverband_id)

    query = query.order_by(EmailTemplate.scenario, EmailTemplate.typ, EmailTemplate.name)
    return query.all()


@router.post("/", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_email_template(
    data: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Create a new email template. Leitung+ role required."""
    if data.typ not in ("mitglied", "empfaenger"):
        raise HTTPException(status_code=400, detail="typ must be 'mitglied' or 'empfaenger'")

    template = EmailTemplate(
        name=data.name,
        typ=data.typ,
        scenario=data.scenario,
        kreisverband_id=data.kreisverband_id,
        betreff=data.betreff,
        inhalt=data.inhalt,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=EmailTemplateResponse)
async def get_email_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Get a single email template by ID. Leitung+ role required."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")
    return template


@router.put("/{template_id}", response_model=EmailTemplateResponse)
async def update_email_template(
    template_id: int,
    data: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Update an email template. Leitung+ role required."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    update_data = data.model_dump(exclude_unset=True)
    if "typ" in update_data and update_data["typ"] not in ("mitglied", "empfaenger"):
        raise HTTPException(status_code=400, detail="typ must be 'mitglied' or 'empfaenger'")
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Delete an email template. Leitung+ role required."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    db.delete(template)
    db.commit()
    return None


class TemplateTestRequest(BaseModel):
    to: EmailStr


@router.post("/{template_id}/test")
async def test_email_template(
    template_id: int,
    data: TemplateTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Test-E-Mail mit diesem Template an die angegebene Adresse senden (Beispieldaten für Platzhalter). Leitung+."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    vars_ = _sample_template_vars(template.scenario, template.typ)
    subject = render_template(template.betreff, vars_)
    body = render_template(template.inhalt, vars_)
    attachments = _build_attachments_list(template)

    if not send_email(to=[data.to], subject=subject, body=body, attachments=attachments or None):
        raise HTTPException(
            status_code=502,
            detail="E-Mail konnte nicht gesendet werden. SMTP prüfen (z. B. Verwaltung → Stammdaten → SMTP testen).",
        )
    return {"detail": f"Test-E-Mail wurde an {data.to} gesendet."}


@router.put("/{template_id}/attachment", response_model=EmailTemplateResponse)
async def upload_template_attachment(
    template_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Anhang für dieses Template hochladen. Ersetzt vorhandenen Anhang. Leitung+."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Dateiname fehlt")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp nicht erlaubt. Erlaubt: {', '.join(ALLOWED_ATTACHMENT_EXTENSIONS)}",
        )

    base_dir = Path(settings.UPLOAD_DIR) / EMAIL_TEMPLATES_UPLOAD_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^\w.\-]", "_", file.filename)[:200]
    storage_name = f"{template_id}_{uuid.uuid4().hex[:8]}_{safe_name}"
    storage_path = base_dir / storage_name
    try:
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:  # 15 MB
            raise HTTPException(status_code=400, detail="Datei zu groß (max. 15 MB)")
        storage_path.write_bytes(content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speichern fehlgeschlagen: {e}")

    # Alte Anhang-Datei löschen falls vorhanden
    if template.attachment_storage_path:
        old_path = Path(settings.UPLOAD_DIR) / template.attachment_storage_path
        if old_path.is_file():
            try:
                old_path.unlink()
            except Exception:
                pass

    relative_path = f"{EMAIL_TEMPLATES_UPLOAD_DIR}/{storage_name}"
    template.attachment_original_filename = file.filename
    template.attachment_storage_path = relative_path
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}/attachment", response_model=EmailTemplateResponse)
async def delete_template_attachment(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Anhang dieses Templates entfernen. Leitung+."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    if template.attachment_storage_path:
        path = Path(settings.UPLOAD_DIR) / template.attachment_storage_path
        if path.is_file():
            try:
                path.unlink()
            except Exception:
                pass
    template.attachment_original_filename = None
    template.attachment_storage_path = None
    db.commit()
    db.refresh(template)
    return template
