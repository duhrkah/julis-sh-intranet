"""Member change endpoints - create, send emails, list, get by ID"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db
from app.core.rbac import require_role
from app.models.member_change import MemberChange
from app.models.email_template import EmailTemplate
from app.models.kreisverband import Kreisverband, KVVorstandsmitglied
from app.models.user import User
from app.config import settings
from app.schemas.member_change import MemberChangeCreate, MemberChangeResponse
from app.services.email import send_email, render_template, get_attachment_from_path

router = APIRouter()


class ResendEmailsRequest(BaseModel):
    send_to_member: bool = True
    send_to_kv: bool = True


@router.get("/", response_model=List[MemberChangeResponse])
async def list_member_changes(
    scenario: Optional[str] = Query(None, description="Filter by scenario"),
    kreisverband_id: Optional[int] = Query(None, description="Filter by Kreisverband"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """List member changes with filters. Vorstand+ can view."""
    query = db.query(MemberChange)

    if scenario:
        query = query.filter(MemberChange.scenario == scenario)
    if kreisverband_id:
        query = query.filter(MemberChange.kreisverband_id == kreisverband_id)
    if status_filter:
        query = query.filter(MemberChange.status == status_filter)

    query = query.order_by(MemberChange.created_at.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{change_id}", response_model=MemberChangeResponse)
async def get_member_change(
    change_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Get a single member change by ID. Vorstand+ can view."""
    change = db.query(MemberChange).filter(MemberChange.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Member change not found")
    return change


@router.post("/", response_model=MemberChangeResponse, status_code=status.HTTP_201_CREATED)
async def create_member_change(
    data: MemberChangeCreate,
    send_emails: bool = Query(True, description="Send notification emails immediately"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """
    Create a member change record and optionally send emails.
    Leitung+ can create and send.
    """
    valid_scenarios = [
        "eintritt", "austritt", "verbandswechsel_eintritt",
        "verbandswechsel_austritt", "verbandswechsel_intern", "veraenderung",
    ]
    if data.scenario not in valid_scenarios:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario. Must be one of: {valid_scenarios}",
        )

    # Bei allen Szenarien mindestens ein Kreisverband zur Benachrichtigung nötig
    if data.scenario == "austritt":
        if not data.kreisverband_id:
            raise HTTPException(
                status_code=400,
                detail="Bitte Kreisverband zur Benachrichtigung auswählen (z. B. austretender KV).",
            )
    elif data.scenario in ("eintritt", "veraenderung"):
        if not data.kreisverband_id:
            raise HTTPException(
                status_code=400,
                detail="Bitte Kreisverband auswählen.",
            )
    elif data.scenario.startswith("verbandswechsel"):
        if not data.kreisverband_alt_id or not data.kreisverband_neu_id:
            raise HTTPException(
                status_code=400,
                detail="Bitte beide Kreisverbände (von / nach) auswählen.",
            )

    change = MemberChange(
        scenario=data.scenario,
        mitgliedsnummer=data.mitgliedsnummer,
        vorname=data.vorname,
        nachname=data.nachname,
        email=data.email,
        telefon=data.telefon,
        strasse=data.strasse,
        hausnummer=getattr(data, "hausnummer", None),
        plz=data.plz,
        ort=data.ort,
        geburtsdatum=data.geburtsdatum,
        kreisverband_id=data.kreisverband_id,
        kreisverband_alt_id=data.kreisverband_alt_id,
        kreisverband_neu_id=data.kreisverband_neu_id,
        bemerkung=data.bemerkung,
        status="entwurf" if not send_emails else "versendet",
        erstellt_von_id=current_user.id,
    )
    db.add(change)
    db.commit()
    db.refresh(change)

    if send_emails:
        _send_change_emails(db, change)

    return change


@router.post("/{change_id}/send", response_model=MemberChangeResponse)
async def send_member_change_emails(
    change_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Send emails for a draft member change. Leitung+ can send."""
    change = db.query(MemberChange).filter(MemberChange.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Member change not found")

    if change.status == "versendet":
        raise HTTPException(status_code=400, detail="Emails already sent for this change")

    _send_change_emails(db, change, send_to_member=True, send_to_kv=True)

    change.status = "versendet"
    db.commit()
    db.refresh(change)
    return change


@router.post("/{change_id}/resend", response_model=MemberChangeResponse)
async def resend_member_change_emails(
    change_id: int,
    data: ResendEmailsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """E-Mails für diese Mitgliederänderung erneut senden. Auswahl: an Mitglied und/oder an KV. Leitung+."""
    change = db.query(MemberChange).filter(MemberChange.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Member change not found")
    if not data.send_to_member and not data.send_to_kv:
        raise HTTPException(status_code=400, detail="Mindestens eine Option (Mitglied oder KV) auswählen.")
    _send_change_emails(db, change, send_to_member=data.send_to_member, send_to_kv=data.send_to_kv)
    return change


def _send_change_emails(
    db: Session,
    change: MemberChange,
    *,
    send_to_member: bool = True,
    send_to_kv: bool = True,
) -> None:
    """Send notification emails for a member change using templates."""
    template_vars = {
        "mitgliedsnummer": change.mitgliedsnummer or "",
        "vorname": change.vorname or "",
        "nachname": change.nachname or "",
        "email": change.email or "",
        "telefon": change.telefon or "",
        "strasse": change.strasse or "",
        "hausnummer": change.hausnummer or "",
        "plz": change.plz or "",
        "ort": change.ort or "",
        "geburtsdatum": change.geburtsdatum or "",
        "bemerkung": change.bemerkung or "",
        "scenario": change.scenario or "",
        "eintrittsdatum": change.created_at.strftime("%d.%m.%Y") if change.created_at else "",
    }

    # Resolve Kreisverband names
    if change.kreisverband_id:
        kv = db.query(Kreisverband).filter(Kreisverband.id == change.kreisverband_id).first()
        template_vars["kreisverband"] = kv.name if kv else ""
    else:
        template_vars["kreisverband"] = ""

    if change.kreisverband_alt_id:
        kv_alt = db.query(Kreisverband).filter(Kreisverband.id == change.kreisverband_alt_id).first()
        template_vars["kreisverband_alt"] = kv_alt.name if kv_alt else ""
    else:
        template_vars["kreisverband_alt"] = ""

    if change.kreisverband_neu_id:
        kv_neu = db.query(Kreisverband).filter(Kreisverband.id == change.kreisverband_neu_id).first()
        template_vars["kreisverband_neu"] = kv_neu.name if kv_neu else ""
    else:
        template_vars["kreisverband_neu"] = ""

    # Alias für Templates: kreis = Kreisverband-Name (z. B. für "im KV {kreis}")
    template_vars["kreis"] = template_vars["kreisverband"]

    # Send to the member (if email provided)
    if send_to_member and change.email:
        member_templates = db.query(EmailTemplate).filter(
            EmailTemplate.scenario == change.scenario,
            EmailTemplate.typ == "mitglied",
        ).all()

        # Prefer KV-specific template, fall back to general
        template = None
        if change.kreisverband_id:
            template = next(
                (t for t in member_templates if t.kreisverband_id == change.kreisverband_id),
                None,
            )
        if not template:
            template = next(
                (t for t in member_templates if t.kreisverband_id is None),
                None,
            )

        if template:
            subject = render_template(template.betreff, template_vars)
            body = render_template(template.inhalt, template_vars)
            att = get_attachment_from_path(
                settings.UPLOAD_DIR,
                template.attachment_storage_path,
                template.attachment_original_filename,
            )
            attachments = [att] if att else None
            send_email(to=[change.email], subject=subject, body=body, attachments=attachments)

    # Send to Kreisverband: Vorsitzender und Schatzmeister aus dem KV-Vorstand (KV-Modul)
    if not send_to_kv:
        return
    kv_ids = set()
    if change.kreisverband_id:
        kv_ids.add(change.kreisverband_id)
    if change.kreisverband_alt_id:
        kv_ids.add(change.kreisverband_alt_id)
    if change.kreisverband_neu_id:
        kv_ids.add(change.kreisverband_neu_id)

    if kv_ids:
        vorstand_recipients = (
            db.query(KVVorstandsmitglied)
            .filter(
                KVVorstandsmitglied.kreisverband_id.in_(kv_ids),
                KVVorstandsmitglied.ist_aktiv.is_(True),
                KVVorstandsmitglied.rolle.in_(("Kreisvorsitzender", "Kreisschatzmeister")),
                KVVorstandsmitglied.email.isnot(None),
                KVVorstandsmitglied.email != "",
            )
            .all()
        )

        # Pro KV: Namen von Vorsitzender und Schatzmeister für Platzhalter {vorsitzender}, {schatzmeister}
        kv_vorsitz_schatz: dict[int, dict[str, str]] = {}
        for v in vorstand_recipients:
            kv_id = v.kreisverband_id
            if kv_id not in kv_vorsitz_schatz:
                kv_vorsitz_schatz[kv_id] = {"vorsitzender": "", "schatzmeister": ""}
            if v.rolle == "Kreisvorsitzender":
                kv_vorsitz_schatz[kv_id]["vorsitzender"] = v.name or ""
            elif v.rolle == "Kreisschatzmeister":
                kv_vorsitz_schatz[kv_id]["schatzmeister"] = v.name or ""

        recipient_templates = db.query(EmailTemplate).filter(
            EmailTemplate.scenario == change.scenario,
            EmailTemplate.typ == "empfaenger",
        ).all()

        for vorstand in vorstand_recipients:
            template = next(
                (t for t in recipient_templates if t.kreisverband_id == vorstand.kreisverband_id),
                None,
            )
            if not template:
                template = next(
                    (t for t in recipient_templates if t.kreisverband_id is None),
                    None,
                )

            if template and vorstand.email:
                names = kv_vorsitz_schatz.get(vorstand.kreisverband_id, {"vorsitzender": "", "schatzmeister": ""})
                # Bei Verbandswechsel: Platzhalter, ob Empfänger der abgebende oder aufnehmende KV ist
                ihr_kreis = ""
                abgebend_oder_aufnehmend = ""
                if change.kreisverband_alt_id and change.kreisverband_neu_id:
                    if vorstand.kreisverband_id == change.kreisverband_alt_id:
                        ihr_kreis = template_vars.get("kreisverband_alt", "")
                        abgebend_oder_aufnehmend = "abgebend"
                    elif vorstand.kreisverband_id == change.kreisverband_neu_id:
                        ihr_kreis = template_vars.get("kreisverband_neu", "")
                        abgebend_oder_aufnehmend = "aufnehmend"
                elif vorstand.kreisverband_id and change.kreisverband_id:
                    ihr_kreis = template_vars.get("kreisverband", "")
                    abgebend_oder_aufnehmend = ""
                else:
                    ihr_kreis = template_vars.get("kreisverband", "") or template_vars.get("kreisverband_alt", "") or template_vars.get("kreisverband_neu", "")
                recipient_vars = {
                    **template_vars,
                    "empfaenger_name": vorstand.name,
                    "vorsitzender": names["vorsitzender"],
                    "schatzmeister": names["schatzmeister"],
                    "ihr_kreis": ihr_kreis,
                    "abgebend_oder_aufnehmend": abgebend_oder_aufnehmend,
                }
                subject = render_template(template.betreff, recipient_vars)
                body = render_template(template.inhalt, recipient_vars)
                att = get_attachment_from_path(
                    settings.UPLOAD_DIR,
                    template.attachment_storage_path,
                    template.attachment_original_filename,
                )
                attachments = [att] if att else None
                send_email(to=[vorstand.email], subject=subject, body=body, attachments=attachments)
