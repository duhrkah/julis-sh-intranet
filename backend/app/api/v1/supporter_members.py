"""Fördermitglieder CRUD endpoints – Zugriff ab Rolle Leitung"""
import csv
import io
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db
from app.core.rbac import require_role
from app.models.supporter_member import SupporterMember, berechne_stufe
from app.models.kreisverband import Kreisverband
from app.models.user import User
from app.schemas.supporter_member import (
    SupporterMemberCreate,
    SupporterMemberUpdate,
    SupporterMemberResponse,
)

router = APIRouter()


# Spalten für den CSV-Export: key → (Header-Label, Wert-Extractor)
# Reihenfolge hier bestimmt auch die Default-Reihenfolge im Export.
def _fmt_betrag(value) -> str:
    if value is None:
        return ""
    # Dezimalkomma für deutsche Excel-Darstellung
    return f"{Decimal(value):.2f}".replace(".", ",")


def _fmt_bool(value) -> str:
    if value is None:
        return ""
    return "Ja" if value else "Nein"


def _fmt_date(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    return str(value)


EXPORT_COLUMNS: dict[str, tuple[str, callable]] = {
    "id": ("ID", lambda m, kv: str(m.id)),
    "anrede": ("Anrede", lambda m, kv: m.geschlecht or ""),
    "titel": ("Titel", lambda m, kv: m.titel or ""),
    "vorname": ("Vorname", lambda m, kv: m.vorname or ""),
    "nachname": ("Nachname", lambda m, kv: m.nachname or ""),
    "kreisverband": ("Kreisverband", lambda m, kv: kv or ""),
    "stufe": ("Stufe", lambda m, kv: m.stufe or ""),
    "beitragshoehe": ("Beitragshöhe (€)", lambda m, kv: _fmt_betrag(m.beitragshoehe)),
    "verwendungszweck": ("Verwendungszweck", lambda m, kv: m.verwendungszweck or ""),
    "iban": ("IBAN", lambda m, kv: m.iban or ""),
    "bankinstitut": ("Bankinstitut", lambda m, kv: m.bankinstitut or ""),
    "strasse_hausnummer": ("Straße/Hausnr.", lambda m, kv: m.strasse_hausnummer or ""),
    "plz": ("PLZ", lambda m, kv: m.plz or ""),
    "ort": ("Ort", lambda m, kv: m.ort or ""),
    "telefon": ("Telefon", lambda m, kv: m.telefon or ""),
    "mobilnummer": ("Mobil", lambda m, kv: m.mobilnummer or ""),
    "email": ("E-Mail", lambda m, kv: m.email or ""),
    "ist_aktiv": ("Aktiv", lambda m, kv: _fmt_bool(m.ist_aktiv)),
    "created_at": ("Erstellt am", lambda m, kv: _fmt_date(m.created_at)),
    "updated_at": ("Aktualisiert am", lambda m, kv: _fmt_date(m.updated_at)),
}


def _to_response(member: SupporterMember, db: Session) -> dict:
    """Convert model to response dict with kreisverband_name."""
    data = {c.name: getattr(member, c.name) for c in member.__table__.columns}
    kv_name = None
    if member.kreisverband_id:
        kv = db.query(Kreisverband.name).filter(Kreisverband.id == member.kreisverband_id).first()
        kv_name = kv[0] if kv else None
    data["kreisverband_name"] = kv_name
    return data


@router.get("/", response_model=List[SupporterMemberResponse])
async def list_supporter_members(
    kreisverband_id: Optional[int] = Query(None, description="Filter by Kreisverband"),
    stufe: Optional[str] = Query(None, description="Filter by Stufe"),
    search: Optional[str] = Query(None, description="Search by name"),
    include_inactive: bool = Query(False, description="Include inactive members"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Liste aller Fördermitglieder mit optionalen Filtern."""
    query = db.query(SupporterMember)

    if not include_inactive:
        query = query.filter(SupporterMember.ist_aktiv.is_(True))
    if kreisverband_id:
        query = query.filter(SupporterMember.kreisverband_id == kreisverband_id)
    if stufe:
        query = query.filter(SupporterMember.stufe == stufe)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (SupporterMember.vorname.ilike(term))
            | (SupporterMember.nachname.ilike(term))
            | (SupporterMember.email.ilike(term))
        )

    members = query.order_by(SupporterMember.id.asc()).offset(skip).limit(limit).all()
    return [_to_response(m, db) for m in members]


@router.get("/export.csv")
async def export_supporter_members_csv(
    kreisverband_id: Optional[int] = Query(None, description="Filter by Kreisverband"),
    stufe: Optional[str] = Query(None, description="Filter by Stufe"),
    search: Optional[str] = Query(None, description="Search by name"),
    include_inactive: bool = Query(False, description="Include inactive members"),
    columns: Optional[str] = Query(
        None,
        description=(
            "Kommagetrennte Liste der zu exportierenden Spalten. "
            f"Erlaubt: {','.join(EXPORT_COLUMNS.keys())}. Leer = alle Spalten."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Fördermitglieder als CSV exportieren (UTF-8 mit BOM, Semikolon-Trenner)."""
    if columns:
        requested = [c.strip() for c in columns.split(",") if c.strip()]
        unknown = [c for c in requested if c not in EXPORT_COLUMNS]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"Unbekannte Spalte(n): {', '.join(unknown)}",
            )
        selected = requested
    else:
        selected = list(EXPORT_COLUMNS.keys())

    if not selected:
        raise HTTPException(status_code=400, detail="Mindestens eine Spalte erforderlich.")

    query = db.query(SupporterMember)
    if not include_inactive:
        query = query.filter(SupporterMember.ist_aktiv.is_(True))
    if kreisverband_id:
        query = query.filter(SupporterMember.kreisverband_id == kreisverband_id)
    if stufe:
        query = query.filter(SupporterMember.stufe == stufe)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (SupporterMember.vorname.ilike(term))
            | (SupporterMember.nachname.ilike(term))
            | (SupporterMember.email.ilike(term))
        )

    members = query.order_by(SupporterMember.nachname.asc(), SupporterMember.vorname.asc()).all()

    # Kreisverband-Namen in einem Rutsch laden (keine N+1-Queries)
    kv_ids = {m.kreisverband_id for m in members if m.kreisverband_id is not None}
    kv_map: dict[int, str] = {}
    if kv_ids:
        rows = db.query(Kreisverband.id, Kreisverband.name).filter(Kreisverband.id.in_(kv_ids)).all()
        kv_map = {row[0]: row[1] for row in rows}

    buffer = io.StringIO()
    # Semikolon + QUOTE_MINIMAL: DE-Excel-kompatibel; doppelte Anführungszeichen maskieren
    writer = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([EXPORT_COLUMNS[col][0] for col in selected])
    for member in members:
        kv_name = kv_map.get(member.kreisverband_id) if member.kreisverband_id else None
        writer.writerow([EXPORT_COLUMNS[col][1](member, kv_name) for col in selected])

    # UTF-8 BOM, damit Excel unter Windows die Umlaute korrekt darstellt
    content = "﻿" + buffer.getvalue()
    filename = f"foerdermitglieder_{date.today().isoformat()}.csv"
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{member_id}", response_model=SupporterMemberResponse)
async def get_supporter_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Einzelnes Fördermitglied abrufen."""
    member = db.query(SupporterMember).filter(SupporterMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Fördermitglied nicht gefunden")
    return _to_response(member, db)


@router.post("/", response_model=SupporterMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_supporter_member(
    data: SupporterMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Neues Fördermitglied anlegen."""
    stufe = berechne_stufe(float(data.beitragshoehe))

    member = SupporterMember(
        geschlecht=data.geschlecht,
        titel=data.titel,
        vorname=data.vorname,
        nachname=data.nachname,
        kreisverband_id=data.kreisverband_id,
        beitragshoehe=data.beitragshoehe,
        stufe=stufe,
        verwendungszweck=data.verwendungszweck,
        iban=data.iban,
        bankinstitut=data.bankinstitut,
        strasse_hausnummer=data.strasse_hausnummer,
        plz=data.plz,
        ort=data.ort,
        telefon=data.telefon,
        mobilnummer=data.mobilnummer,
        email=data.email,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return _to_response(member, db)


@router.put("/{member_id}", response_model=SupporterMemberResponse)
async def update_supporter_member(
    member_id: int,
    data: SupporterMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Fördermitglied bearbeiten."""
    member = db.query(SupporterMember).filter(SupporterMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Fördermitglied nicht gefunden")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    # Stufe neu berechnen wenn Beitragshöhe geändert wurde
    if "beitragshoehe" in update_data:
        member.stufe = berechne_stufe(float(member.beitragshoehe))

    db.commit()
    db.refresh(member)
    return _to_response(member, db)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supporter_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Fördermitglied deaktivieren (Soft-Delete)."""
    member = db.query(SupporterMember).filter(SupporterMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Fördermitglied nicht gefunden")

    member.ist_aktiv = False
    db.commit()
