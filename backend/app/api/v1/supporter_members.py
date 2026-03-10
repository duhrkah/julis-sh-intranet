"""Fördermitglieder CRUD endpoints – Zugriff ab Rolle Leitung"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
