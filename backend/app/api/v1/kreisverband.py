"""Kreisverband CRUD, Vorstandsmitglieder CRUD, Protokoll CRUD + file upload"""
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

import aiofiles

from app.api.deps import get_db
from app.core.rbac import require_role, has_min_role
from app.models.kreisverband import Kreisverband, KVVorstandsmitglied, KVProtokoll
from app.models.user import User
from app.schemas.kreisverband import (
    KreisverbandCreate,
    KreisverbandUpdate,
    KreisverbandResponse,
    KreisverbandListResponse,
    KVVorstandsmitgliedCreate,
    KVVorstandsmitgliedResponse,
    KVProtokollCreate,
    KVProtokollResponse,
    VorstandUebersichtEintrag,
    VorstandUebersichtMitglied,
)
from app.config import settings
from app.services.audit import log_action

router = APIRouter()

PROTOKOLL_UPLOAD_DIR = os.path.join(settings.UPLOAD_DIR, "protokolle")

ALLOWED_PROTOKOLL_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

def _validate_upload(filename: str, content_length: int = 0) -> str:
    """Validate file extension and return safe extension."""
    ext = os.path.splitext(filename)[1].lower() if filename else ""
    if ext not in ALLOWED_PROTOKOLL_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Dateityp '{ext}' nicht erlaubt. Erlaubt: {', '.join(ALLOWED_PROTOKOLL_EXTENSIONS)}")
    return ext

def _safe_file_path(base_dir: str, file_path: str) -> bool:
    """Check that file_path is within base_dir (prevent path traversal)."""
    real_base = os.path.realpath(base_dir)
    real_path = os.path.realpath(file_path)
    return real_path.startswith(real_base)


# ---------------------------------------------------------------------------
# Kreisverband CRUD
# ---------------------------------------------------------------------------

# Rollen-Mapping für Landesverband-Vorstandsübersicht (muss mit Frontend ROLEN übereinstimmen)
_ROLLE_VORSITZ = ["Kreisvorsitzender"]
_ROLLE_SCHATZMEISTER = ["Kreisschatzmeister"]
_ROLLE_ORGANISATION = ["stv. Kreisvorsitzender für Organisation", "Beisitzer für Organisation"]
_ROLLE_PROGRAMMATIK = ["stv. Kreisvorsitzender für Programmatik", "Beisitzer für Programmatik"]
_ROLLE_PRESSE = ["stv. Kreisvorsitzender für Presse- und Öffentlichkeitsarbeit", "Beisitzer für Presse- und Öffentlichkeitsarbeit"]

def _rollen_fuer_uebersicht(rolle: str, mit_beisitzern: bool) -> List[str]:
    if rolle == "vorsitz":
        return _ROLLE_VORSITZ
    if rolle == "schatzmeister":
        return _ROLLE_SCHATZMEISTER
    if rolle == "organisation":
        return _ROLLE_ORGANISATION if mit_beisitzern else [_ROLLE_ORGANISATION[0]]
    if rolle == "programmatik":
        return _ROLLE_PROGRAMMATIK if mit_beisitzern else [_ROLLE_PROGRAMMATIK[0]]
    if rolle == "presse":
        return _ROLLE_PRESSE if mit_beisitzern else [_ROLLE_PRESSE[0]]
    return []


@router.get("/", response_model=List[KreisverbandListResponse])
async def list_kreisverbande(
    ist_aktiv: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """List all Kreisverbande. Mitarbeiter+ can view."""
    query = db.query(Kreisverband)
    if ist_aktiv is not None:
        query = query.filter(Kreisverband.ist_aktiv == ist_aktiv)
    query = query.order_by(Kreisverband.name)
    return query.all()


@router.get("/landesverband/vorstand-uebersicht", response_model=List[VorstandUebersichtEintrag])
async def landesverband_vorstand_uebersicht(
    rolle: str = Query(..., description="vorsitz | schatzmeister | organisation | programmatik | presse"),
    mit_beisitzern: bool = Query(True, description="Bei Organisation/Programmatik/Presse: Beisitzer einbeziehen"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Vorstandsübersicht für den gesamten Landesverband: alle KVs mit Personen der gewählten Rolle (optional mit/ohne Beisitzer)."""
    rollen_liste = _rollen_fuer_uebersicht(rolle.lower(), mit_beisitzern)
    if not rollen_liste:
        raise HTTPException(status_code=400, detail="Ungültige rolle. Erlaubt: vorsitz, schatzmeister, organisation, programmatik, presse")

    kvs = db.query(Kreisverband).filter(Kreisverband.ist_aktiv.is_(True)).order_by(Kreisverband.name).all()
    result: List[VorstandUebersichtEintrag] = []
    for kv in kvs:
        mitglieder = (
            db.query(KVVorstandsmitglied)
            .filter(
                KVVorstandsmitglied.kreisverband_id == kv.id,
                KVVorstandsmitglied.ist_aktiv.is_(True),
                KVVorstandsmitglied.rolle.in_(rollen_liste),
            )
            .order_by(KVVorstandsmitglied.rolle)
            .all()
        )
        result.append(
            VorstandUebersichtEintrag(
                kreisverband=kv,
                mitglieder=[
                    VorstandUebersichtMitglied(id=m.id, name=m.name, email=m.email, rolle=m.rolle)
                    for m in mitglieder
                ],
            )
        )
    return result


@router.post("/", response_model=KreisverbandResponse, status_code=status.HTTP_201_CREATED)
async def create_kreisverband(
    data: KreisverbandCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a new Kreisverband. Admin only."""
    existing = db.query(Kreisverband).filter(Kreisverband.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Kreisverband with this name already exists")

    kv = Kreisverband(
        name=data.name,
        kuerzel=data.kuerzel,
        email=data.email,
        ist_aktiv=data.ist_aktiv,
        tenant_id=data.tenant_id,
    )
    db.add(kv)
    db.flush()
    log_action(db, current_user.id, "create", "kreisverband", kv.id, f"Kreisverband erstellt: {kv.name}", request)
    db.commit()
    db.refresh(kv)
    return kv


@router.get("/{kv_id}", response_model=KreisverbandResponse)
async def get_kreisverband(
    kv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Get a single Kreisverband with its Vorstandsmitglieder. Mitarbeiter+ can view."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")
    return kv


@router.put("/{kv_id}", response_model=KreisverbandResponse)
async def update_kreisverband(
    kv_id: int,
    data: KreisverbandUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update a Kreisverband. Admin only."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != kv.name:
        existing = db.query(Kreisverband).filter(
            Kreisverband.name == update_data["name"],
            Kreisverband.id != kv_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Kreisverband with this name already exists")

    for field, value in update_data.items():
        setattr(kv, field, value)

    log_action(db, current_user.id, "update", "kreisverband", kv.id, f"Kreisverband aktualisiert: {kv.name}", request)
    db.commit()
    db.refresh(kv)
    return kv


@router.delete("/{kv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kreisverband(
    kv_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Deactivate a Kreisverband. Admin only."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")

    kv.ist_aktiv = False
    log_action(db, current_user.id, "delete", "kreisverband", kv_id, f"Kreisverband deaktiviert: {kv.name}", request)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Vorstandsmitglieder CRUD
# ---------------------------------------------------------------------------

@router.get("/{kv_id}/vorstand", response_model=List[KVVorstandsmitgliedResponse])
async def list_vorstandsmitglieder(
    kv_id: int,
    ist_aktiv: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """List Vorstandsmitglieder of a Kreisverband. Mitarbeiter+ can view."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")

    query = db.query(KVVorstandsmitglied).filter(KVVorstandsmitglied.kreisverband_id == kv_id)
    if ist_aktiv is not None:
        query = query.filter(KVVorstandsmitglied.ist_aktiv == ist_aktiv)
    return query.order_by(KVVorstandsmitglied.rolle).all()


@router.post("/{kv_id}/vorstand", response_model=KVVorstandsmitgliedResponse, status_code=status.HTTP_201_CREATED)
async def create_vorstandsmitglied(
    kv_id: int,
    data: KVVorstandsmitgliedCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Add a Vorstandsmitglied. Vorstand+ can create."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")

    mitglied = KVVorstandsmitglied(
        kreisverband_id=kv_id,
        name=data.name,
        email=data.email,
        rolle=data.rolle,
        amtszeit_start=data.amtszeit_start,
        amtszeit_ende=data.amtszeit_ende,
        ist_aktiv=data.ist_aktiv,
    )
    db.add(mitglied)
    db.flush()
    log_action(db, current_user.id, "create", "vorstandsmitglied", mitglied.id, f"Vorstandsmitglied erstellt: {mitglied.name} ({mitglied.rolle})", request)
    db.commit()
    db.refresh(mitglied)
    return mitglied


@router.put("/vorstand/{mitglied_id}", response_model=KVVorstandsmitgliedResponse)
async def update_vorstandsmitglied(
    mitglied_id: int,
    data: KVVorstandsmitgliedCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Update a Vorstandsmitglied. Vorstand+ can edit."""
    mitglied = db.query(KVVorstandsmitglied).filter(KVVorstandsmitglied.id == mitglied_id).first()
    if not mitglied:
        raise HTTPException(status_code=404, detail="Vorstandsmitglied not found")

    mitglied.name = data.name
    mitglied.email = data.email
    mitglied.rolle = data.rolle
    mitglied.amtszeit_start = data.amtszeit_start
    mitglied.amtszeit_ende = data.amtszeit_ende
    mitglied.ist_aktiv = data.ist_aktiv

    db.commit()
    db.refresh(mitglied)
    return mitglied


@router.delete("/vorstand/{mitglied_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vorstandsmitglied(
    mitglied_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Delete a Vorstandsmitglied. Vorstand+ can delete."""
    mitglied = db.query(KVVorstandsmitglied).filter(KVVorstandsmitglied.id == mitglied_id).first()
    if not mitglied:
        raise HTTPException(status_code=404, detail="Vorstandsmitglied not found")

    db.delete(mitglied)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Protokoll CRUD + File Upload
# ---------------------------------------------------------------------------

@router.get("/{kv_id}/protokolle", response_model=List[KVProtokollResponse])
async def list_protokolle(
    kv_id: int,
    typ: Optional[str] = Query(None, description="Filter by type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """List Protokolle of a Kreisverband. Mitarbeiter+ can view."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")

    query = db.query(KVProtokoll).filter(KVProtokoll.kreisverband_id == kv_id)
    if typ:
        query = query.filter(KVProtokoll.typ == typ)
    return query.order_by(KVProtokoll.datum.desc()).all()


@router.post("/{kv_id}/protokolle", response_model=KVProtokollResponse, status_code=status.HTTP_201_CREATED)
async def create_protokoll(
    kv_id: int,
    titel: str = Form(...),
    datum: date = Form(...),
    typ: str = Form(...),
    beschreibung: Optional[str] = Form(None),
    datei: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Create a Protokoll with optional file upload. Mitarbeiter+ can create."""
    kv = db.query(Kreisverband).filter(Kreisverband.id == kv_id).first()
    if not kv:
        raise HTTPException(status_code=404, detail="Kreisverband not found")

    datei_pfad = None
    if datei and datei.filename:
        os.makedirs(PROTOKOLL_UPLOAD_DIR, exist_ok=True)
        ext = _validate_upload(datei.filename)
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(PROTOKOLL_UPLOAD_DIR, safe_filename)

        content = await datei.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"Datei zu groß. Maximum: {MAX_FILE_SIZE // (1024*1024)} MB")

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        datei_pfad = file_path

    protokoll = KVProtokoll(
        kreisverband_id=kv_id,
        titel=titel,
        datum=datum,
        typ=typ,
        beschreibung=beschreibung,
        datei_pfad=datei_pfad,
    )
    db.add(protokoll)
    db.commit()
    db.refresh(protokoll)
    return protokoll


@router.delete("/protokolle/{protokoll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_protokoll(
    protokoll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Delete a Protokoll and its file. Mitarbeiter+ can delete."""
    protokoll = db.query(KVProtokoll).filter(KVProtokoll.id == protokoll_id).first()
    if not protokoll:
        raise HTTPException(status_code=404, detail="Protokoll not found")

    if protokoll.datei_pfad and os.path.exists(protokoll.datei_pfad) and _safe_file_path(PROTOKOLL_UPLOAD_DIR, protokoll.datei_pfad):
        os.remove(protokoll.datei_pfad)

    db.delete(protokoll)
    db.commit()
    return None
