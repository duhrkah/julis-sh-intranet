"""Meeting CRUD + Einladung/Protokoll-Generierung (docxtpl + PDF)"""
import asyncio
import logging
import os
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional

WOCHE_TAG = ("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag")

from docxtpl import RichText

from app.api.deps import get_db
from app.core.rbac import require_role
from app.services.pdf import docx_to_pdf
from app.models.meeting import Meeting
from app.models.user import User
from app.models.kreisverband import Kreisverband, KVVorstandsmitglied
from app.schemas.meeting import MeetingCreate, MeetingUpdate, MeetingResponse
from app.config import settings

router = APIRouter()

SITZUNGEN_DIR = os.path.join(settings.UPLOAD_DIR, "sitzungen")
os.makedirs(SITZUNGEN_DIR, exist_ok=True)


@router.get("/", response_model=List[MeetingResponse])
async def list_meetings(
    typ: Optional[str] = Query(None, description="Filter by type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """List meetings. Mitarbeiter+ can view."""
    query = db.query(Meeting)
    if typ:
        query = query.filter(Meeting.typ == typ)
    query = query.order_by(Meeting.datum.desc(), Meeting.uhrzeit)
    return query.offset(skip).limit(limit).all()


@router.get("/teilnehmer-optionen/{variante}", response_model=List[str])
async def get_teilnehmer_optionen(
    variante: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Optionen für Dropdown 'Teilnehmer der Eingeladenen' je nach Einladungsvariante. Erweiterter LV = feste Namen + alle KV-Vorstandsmitglieder (pro Kreis z. B. Vorsitz oder Stellvertretung wählbar)."""
    v = variante.strip().lower()
    if v == "landesvorstand":
        return TEILNEHMER_NAMEN_LANDESVORSTAND
    if v == "erweiterter_landesvorstand":
        return TEILNEHMER_NAMEN_LANDESVORSTAND + _get_kv_vertreter_optionen(db)
    return []


@router.post("/", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("leitung")),
):
    """Create a meeting. Leitung+ can create."""
    meeting = Meeting(
        titel=data.titel,
        titel_kurz=getattr(data, "titel_kurz", None),
        typ=data.typ,
        datum=data.datum,
        uhrzeit=data.uhrzeit,
        ort=data.ort,
        tagesordnung=data.tagesordnung,
        protokoll_top_texte=data.protokoll_top_texte,
        teilnehmer=data.teilnehmer,
        teilnehmer_sonstige=getattr(data, "teilnehmer_sonstige", None),
        sitzungsleitung=getattr(data, "sitzungsleitung", None),
        protokollfuehrer=getattr(data, "protokollfuehrer", None),
        beschluesse=data.beschluesse,
        einladung_variante=getattr(data, "einladung_variante", None) or "freitext",
        einladung_empfaenger_freitext=getattr(data, "einladung_empfaenger_freitext", None),
        teilnehmer_eingeladene_auswahl=getattr(data, "teilnehmer_eingeladene_auswahl", None),
        erstellt_von_id=current_user.id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Get a single meeting by ID. Mitarbeiter+ can view."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


# Felder, die Mitarbeiter/Vorstand beim Update setzen dürfen (nur Protokoll schreiben)
MEETING_UPDATE_PROTOCOL_ONLY_FIELDS = frozenset({
    "protokoll_top_texte", "teilnehmer", "teilnehmer_sonstige",
    "sitzungsleitung", "protokollfuehrer", "teilnehmer_eingeladene_auswahl", "beschluesse",
})


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: int,
    data: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Update a meeting. Leitung/Admin: alle Felder. Mitarbeiter/Vorstand: nur Protokollfelder."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    update_data = data.model_dump(exclude_unset=True)
    if current_user.role in ("mitarbeiter", "vorstand"):
        update_data = {k: v for k, v in update_data.items() if k in MEETING_UPDATE_PROTOCOL_ONLY_FIELDS}
    for field, value in update_data.items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Delete a meeting. Nur Admin kann löschen."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()
    return None


def _normalize_node(item) -> dict:
    """Normalize to { titel, unterpunkte: [node, ...] }. Unterpunkte können string oder dict sein."""
    if isinstance(item, str):
        return {"titel": item, "unterpunkte": []}
    if isinstance(item, dict):
        titel = item.get("titel", "")
        unterpunkte = item.get("unterpunkte")
        if isinstance(unterpunkte, list):
            unterpunkte = [_normalize_node(u) for u in unterpunkte]
        else:
            unterpunkte = []
        return {"titel": titel, "unterpunkte": unterpunkte}
    return {"titel": str(item), "unterpunkte": []}


def _node_count(node: dict) -> int:
    """Anzahl aller Knoten (jeder TOP/Unterpunkt zählt) in Tiefenreihenfolge."""
    kids = node.get("unterpunkte") or []
    return 1 + sum(_node_count(c) for c in kids)


def _collect_lines(node: dict, path_prefix: str) -> list:
    """Tiefenreihenfolge: (path_str, titel). path_prefix z.B. '1' -> '1.1', '1.1.1'."""
    titel = node.get("titel", "")
    out = [(path_prefix, titel)]
    for i, c in enumerate(node.get("unterpunkte") or []):
        sub_prefix = f"{path_prefix}.{i + 1}"
        out.extend(_collect_lines(c, sub_prefix))
    return out


def _build_protokoll_tree(node: dict, node_texts: list, pos: list) -> dict:
    """Baut Baum mit protokoll an jedem Knoten (TOP, Unterpunkt, Unter-Unterpunkt). pos = [current_index] (mutable)."""
    kids = node.get("unterpunkte") or []
    titel = node.get("titel", "")
    idx = pos[0]
    text = node_texts[idx] if idx < len(node_texts) else ""
    pos[0] += 1
    sub = [_build_protokoll_tree(c, node_texts, pos) for c in kids]
    return {"titel": titel, "protokoll": text or "", "unterpunkte_mit_protokoll": sub}


def _flatten_top_mit_protokoll_richtext(
    top_mit_protokoll: list,
    add_kw: Optional[dict] = None,
    indent_protokoll: str = "    ",
) -> RichText:
    """Erzeugt RichText aller TOPs: TOP-Titel fett, Protokolltext normal und eingerückt.
    add_kw (font, size, style) erhält die Vorlagen-Formatierung. Für Vorlage: {{r top_mit_protokoll_text }}."""
    rt = RichText()
    kw = add_kw or {}
    for i, top in enumerate(top_mit_protokoll or []):
        titel = (top.get("titel") or "").strip()
        protokoll = (top.get("protokoll") or "").strip()
        rt.add(f"TOP {i + 1}: {titel}\a", bold=True, **kw)
        if protokoll:
            rt.add(indent_protokoll + protokoll.replace("\n", "\n" + indent_protokoll) + "\a", bold=False, **kw)
        for j, u in enumerate(top.get("unterpunkte_mit_protokoll") or []):
            ut = (u.get("titel") or "").strip()
            up = (u.get("protokoll") or "").strip()
            prefix = f"TOP {i + 1}.{j + 1}"
            zeile = f"{prefix}: {ut}" if ut else prefix
            rt.add(zeile + "\a", bold=True, **kw)
            if up:
                rt.add(indent_protokoll + up.replace("\n", "\n" + indent_protokoll) + "\a", bold=False, **kw)
    return rt


# Vorgefertigte Einladungsempfänger für Variante 1 und 2 (Word-Vorlage: {{ einladungsempfaenger }})
EINLADUNG_LANDESVORSTAND = """- die Mitglieder des Landesvorstandes

nachrichtlich:
- die Landesgeschäftsstelle
- die Ombudsperson
- die Liberalen Schüler Schleswig-Holstein
- den Bundesvorsitzenden der Jungen Liberalen"""

EINLADUNG_ERWEITERTER_LANDESVORSTAND = """- die Mitglieder des Landesvorstandes
- die Kreisvorsitzenden

nachrichtlich:
- die Landesgeschäftsstelle
- die Ombudsperson
- die Liberalen Schüler Schleswig-Holstein
- den Bundesvorsitzenden der Jungen Liberalen"""


# Konkrete Namen für Dropdown "Teilnehmer der Eingeladenen" (Protokoll) – hier anpassen
TEILNEHMER_NAMEN_LANDESVORSTAND = [
    # Mitglieder des Landesvorstandes (Namen eintragen)
    "Luisa Sophie Fellner",
    "Laurids Heidemann",
    "Tom Schröder",
    "Julian Antonius Geist",
    "Ann-Malin Madsen",
    "Kevin Naumann",
    "Tristan Schlabritz",
    "Elena Marggraff",
    "Jan-Niklas Kaufmann",
    # Landesgeschäftsstelle, Ombudsperson, LSSH, Bundesvorsitz (sonstige Anwesende)
    "Luca Stephan Kohls (Landesgeschäftsführer)",
    "Felix Leon Holz (Referent für Organisation & IT)",
    "Jonas Tippner (Referent für Mitgliederangelegenheiten)",
    "Laura Sophie Lehmann (Ombudsmitglied)",
    "Jona Janowitz (Liberale Schüler SH)",
    "Finn Flebbe (Bundesvorsitzender JuLis)",
]
# Aufteilung für Protokoll „Anwesende“: Landesvorstand vs. sonstige Anwesende
TEILNEHMER_LANDESVORSTAND = TEILNEHMER_NAMEN_LANDESVORSTAND[:9]  # erste 9 = LV-Mitglieder
TEILNEHMER_SONSTIGE_ANWESENDE = TEILNEHMER_NAMEN_LANDESVORSTAND[9:]  # Rest = Ombudsperson, LGS, LSSH, Bundesvorsitz
# Geschütztes Leerzeichen nach Komma, damit Word zwischen Namen umbricht, nicht mitten im Namen
_NBSP = "\u00a0"


def _namen_zeile(namen: List[str]) -> str:
    """Namen kommasepariert mit geschütztem Leerzeichen nach Komma für sauberen Zeilenumbruch in Word."""
    if not namen:
        return ""
    return _NBSP.join(n.strip() + "," for n in namen if n)[:-1]  # "A,\u00a0B,\u00a0C"
# Erweiterter Landesvorstand = TEILNEHMER_NAMEN_LANDESVORSTAND + Kreisvorsitzende aus Kreismodul (siehe get_teilnehmer_optionen)


def _get_kv_vertreter_optionen(db: Session) -> List[str]:
    """Alle Vorstandsmitglieder aller aktiven KVs als wählbare Optionen (Name - Rolle (KV)), sortiert nach KV dann Rolle. So kann pro Kreis z. B. Stellvertreter statt Vorsitzender gewählt werden."""
    rows = (
        db.query(KVVorstandsmitglied.name, KVVorstandsmitglied.rolle, Kreisverband.name.label("kv_name"))
        .join(Kreisverband, KVVorstandsmitglied.kreisverband_id == Kreisverband.id)
        .filter(
            Kreisverband.ist_aktiv.is_(True),
            KVVorstandsmitglied.ist_aktiv.is_(True),
        )
        .order_by(Kreisverband.name, KVVorstandsmitglied.rolle)
        .all()
    )
    return [f"{r.name} – {r.rolle} ({r.kv_name})" for r in rows]


def _einladungsempfaenger_text(meeting: Meeting) -> str:
    """Textblock für Einladungsempfänger je nach einladung_variante."""
    variante = (meeting.einladung_variante or "").strip().lower()
    if variante == "landesvorstand":
        return EINLADUNG_LANDESVORSTAND
    if variante == "erweiterter_landesvorstand":
        return EINLADUNG_ERWEITERTER_LANDESVORSTAND
    return meeting.einladung_empfaenger_freitext or ""


def _teilnehmer_eingeladene_text(meeting: Meeting) -> str:
    """Für Protokoll: Ausgewählte Teilnehmer hintereinander (kommasepariert) oder Fallback Einladungsblock."""
    auswahl = meeting.teilnehmer_eingeladene_auswahl
    if isinstance(auswahl, list) and auswahl:
        return ", ".join(str(item).strip() for item in auswahl if item)
    return _einladungsempfaenger_text(meeting)


def _teilnehmer_zeile(meeting: Meeting) -> str:
    """Alle Teilnehmer in einer Zeile (hintereinander, kommasepariert): Eingeladene + sonstige."""
    eingeladene = _teilnehmer_eingeladene_text(meeting)
    # Fallback (Einladungsblock) kann Zeilenumbrüche enthalten → eine Zeile
    if "\n" in eingeladene:
        eingeladene = ", ".join(s.strip() for s in eingeladene.splitlines() if s.strip())
    sonstige = (meeting.teilnehmer_sonstige or "").strip()
    if not sonstige:
        return eingeladene
    sonstige_zeile = ", ".join(s.strip() for s in sonstige.splitlines() if s.strip())
    if not eingeladene:
        return sonstige_zeile
    return f"{eingeladene}, {sonstige_zeile}"


def _meeting_context(meeting: Meeting, for_protocol: bool = False, db: Optional[Session] = None) -> dict:
    """Build Jinja context for Word templates. Rekursive Tagesordnung + Protokoll pro Knoten."""
    to_list = meeting.tagesordnung if isinstance(meeting.tagesordnung, list) else []
    # Gemeinsame Zeichenformatierung (Font/Size/Style) aus Config – bleibt in Vorlage erhalten
    style = getattr(settings, "DOCX_TAGESORDNUNG_STYLE", None) or None
    font = getattr(settings, "DOCX_TAGESORDNUNG_FONT", None) or None
    size_pt = getattr(settings, "DOCX_TAGESORDNUNG_SIZE", None)
    add_kw: dict = {}
    if style:
        add_kw["style"] = style
    if font:
        add_kw["font"] = font
    if size_pt is not None:
        add_kw["size"] = size_pt * 2  # Word Halbpunkt
    indent_per_level = 8
    tagesordnung_rt = RichText()
    for i, item in enumerate(to_list):
        node = _normalize_node(item)
        path_prefix = str(i + 1)
        for p, titel in _collect_lines(node, path_prefix):
            depth = p.count(".")
            indent = " " * (depth * indent_per_level)
            line_text = f"{indent}TOP {p} {titel}\n"
            tagesordnung_rt.add(line_text, bold=(depth == 0), **add_kw)
    protokoll_texte = meeting.protokoll_top_texte if isinstance(meeting.protokoll_top_texte, list) else []
    top_mit_protokoll = []
    for i, item in enumerate(to_list):
        node = _normalize_node(item)
        pt_i = protokoll_texte[i] if i < len(protokoll_texte) else None
        if isinstance(pt_i, list):
            node_list = [str(t) for t in pt_i]
        elif isinstance(pt_i, str):
            node_list = [str(pt_i)] if _node_count(node) > 0 else []
        else:
            node_list = []
        pos = [0]
        tree = _build_protokoll_tree(node, node_list, pos)
        top_mit_protokoll.append(tree)

    # Protokoll-Text: gleiche Formatierung wie Tagesordnung, Protokolltext eingerückt
    indent_protokoll = "    "  # 4 Leerzeichen Einzug
    top_mit_protokoll_rt = _flatten_top_mit_protokoll_richtext(top_mit_protokoll, add_kw=add_kw, indent_protokoll=indent_protokoll)

    # Sitzungsdatum: Wochentag, ISO (bestehend), DD.MM.YYYY
    sitzung_datum = meeting.datum
    datum_iso = sitzung_datum.isoformat() if sitzung_datum else ""
    datum_dmy = sitzung_datum.strftime("%d.%m.%Y") if sitzung_datum else ""
    wochentag = WOCHE_TAG[sitzung_datum.weekday()] if sitzung_datum else ""
    heute = date.today()
    datum_erstellung = heute.strftime("%d.%m.%Y")

    # Anwesende nach Kategorien (nur bei LV/erweitertem LV); leere Kategorien weglassen
    # anwesende_protokoll als RichText: Kategorie-Überschrift fett + Absatz, dann Namen normal
    teilnehmer_lv = ""
    teilnehmer_sonstige_anwesende = ""
    teilnehmer_kreisverbaende = ""
    anwesende_has_blocks = False
    anwesende_protokoll: RichText = RichText()
    variante = (meeting.einladung_variante or "").strip().lower()
    auswahl = meeting.teilnehmer_eingeladene_auswahl if isinstance(meeting.teilnehmer_eingeladene_auswahl, list) else []
    if variante in ("landesvorstand", "erweiterter_landesvorstand") and auswahl:
        set_auswahl = {str(n).strip() for n in auswahl if n}
        lv_names = [n for n in TEILNEHMER_LANDESVORSTAND if n in set_auswahl]
        sonstige_names = [n for n in TEILNEHMER_SONSTIGE_ANWESENDE if n in set_auswahl]
        kv_names: List[str] = []
        if variante == "erweiterter_landesvorstand" and db:
            kv_options = _get_kv_vertreter_optionen(db)
            kv_names = [n for n in kv_options if n in set_auswahl]
        teilnehmer_lv = _namen_zeile(lv_names)
        teilnehmer_sonstige_anwesende = _namen_zeile(sonstige_names)
        teilnehmer_kreisverbaende = _namen_zeile(kv_names)
        rt_anwesende = RichText()
        if teilnehmer_lv:
            rt_anwesende.add("Anwesende des Landesvorstandes\a", bold=True, **add_kw)
            rt_anwesende.add(teilnehmer_lv + "\a", bold=False, **add_kw)
            anwesende_has_blocks = True
        if teilnehmer_kreisverbaende:
            rt_anwesende.add("Vertreter der Kreisverbände\a", bold=True, **add_kw)
            rt_anwesende.add(teilnehmer_kreisverbaende + "\a", bold=False, **add_kw)
            anwesende_has_blocks = True
        if teilnehmer_sonstige_anwesende:
            rt_anwesende.add("Sonstige Anwesende\a", bold=True, **add_kw)
            rt_anwesende.add(teilnehmer_sonstige_anwesende + "\a", bold=False, **add_kw)
            anwesende_has_blocks = True
        if anwesende_has_blocks:
            anwesende_protokoll = rt_anwesende
    # Sonstige Teilnehmer (Freitext) anhängen, falls vorhanden
    sonstige_freitext = (meeting.teilnehmer_sonstige or "").strip()
    if sonstige_freitext:
        sonstige_zeile = _namen_zeile([s.strip() for s in sonstige_freitext.splitlines() if s.strip()])
        if anwesende_has_blocks:
            anwesende_protokoll.add("Sonstige\a", bold=True, **add_kw)
            anwesende_protokoll.add(sonstige_zeile + "\a", bold=False, **add_kw)
        else:
            rt_anwesende = RichText()
            rt_anwesende.add("Sonstige\a", bold=True, **add_kw)
            rt_anwesende.add(sonstige_zeile + "\a", bold=False, **add_kw)
            anwesende_protokoll = rt_anwesende

    ctx = {
        "titel": meeting.titel,
        "titel_kurz": meeting.titel_kurz or "",
        "typ": meeting.typ,
        "datum": datum_iso,
        "datum_dmy": datum_dmy,
        "wochentag": wochentag,
        "datum_erstellung": datum_erstellung,
        "uhrzeit": meeting.uhrzeit.strftime("%H:%M") if meeting.uhrzeit else "",
        "ort": meeting.ort or "",
        "tagesordnung": tagesordnung_rt,
        "tagesordnung_liste": to_list,
        "top_mit_protokoll": top_mit_protokoll,
        "top_mit_protokoll_text": top_mit_protokoll_rt,
        "teilnehmer": meeting.teilnehmer or "",
        "teilnehmer_eingeladene": _teilnehmer_eingeladene_text(meeting),
        "teilnehmer_zeile": _teilnehmer_zeile(meeting),
        "teilnehmer_landesvorstand": teilnehmer_lv,
        "teilnehmer_sonstige_anwesende": teilnehmer_sonstige_anwesende,
        "teilnehmer_kreisverbaende": teilnehmer_kreisverbaende,
        "anwesende_protokoll": anwesende_protokoll,
        "teilnehmer_sonstige": meeting.teilnehmer_sonstige or "",
        "sitzungsleitung": meeting.sitzungsleitung or "",
        "protokollfuehrer": meeting.protokollfuehrer or "",
        "beschluesse": meeting.beschluesse or "",
    }
    ctx["einladungsempfaenger"] = _einladungsempfaenger_text(meeting)
    return ctx


@router.post("/{meeting_id}/generate-invitation")
async def generate_invitation(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Generate Einladung DOCX from template. Mitarbeiter+ can generate."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    context = _meeting_context(meeting)
    output_name = f"einladung_{meeting_id}_{meeting.datum.isoformat()}.docx"
    template_path = "einladung.docx"
    template_full = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates", template_path
    )
    if not os.path.exists(template_full):
        raise HTTPException(status_code=500, detail="Template einladung.docx not found")

    try:
        from docxtpl import DocxTemplate
        doc = DocxTemplate(template_full)
        doc.render(context)
        rel_path = os.path.join("sitzungen", output_name)
        out_path = os.path.join(settings.UPLOAD_DIR, "sitzungen", output_name)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        doc.save(out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")

    meeting.einladung_pfad = rel_path
    db.commit()
    db.refresh(meeting)
    return {"path": rel_path, "message": "Einladung erstellt"}


@router.post("/{meeting_id}/generate-protocol")
async def generate_protocol(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Generate Protokoll DOCX from template. Mitarbeiter+ can generate (Protokolle schreiben)."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    template_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates", "protokoll.docx"
    )
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Template protokoll.docx not found")

    context = _meeting_context(meeting, for_protocol=True, db=db)
    output_name = f"protokoll_{meeting_id}_{meeting.datum.isoformat()}.docx"
    try:
        from docxtpl import DocxTemplate
        doc = DocxTemplate(template_path)
        doc.render(context)
        rel_path = os.path.join("sitzungen", output_name)
        out_path = os.path.join(settings.UPLOAD_DIR, "sitzungen", output_name)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        doc.save(out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Protocol generation failed: {str(e)}")

    meeting.protokoll_pfad = rel_path
    db.commit()
    db.refresh(meeting)
    return {"path": rel_path, "message": "Protokoll erstellt"}


@router.get("/{meeting_id}/einladung.pdf")
async def download_invitation_pdf(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Einladung als PDF herunterladen. Mitarbeiter+ can download."""
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting or not meeting.einladung_pfad:
            raise HTTPException(status_code=404, detail="Einladung nicht vorhanden. Bitte zuerst Einladung (DOCX) erzeugen.")
        docx_full = os.path.normpath(os.path.join(settings.UPLOAD_DIR, meeting.einladung_pfad))
        if not os.path.isfile(docx_full):
            raise HTTPException(status_code=404, detail="Einladungsdatei nicht gefunden.")
        pdf_path = await asyncio.to_thread(docx_to_pdf, docx_full)
        if not pdf_path:
            raise HTTPException(status_code=500, detail="PDF-Konvertierung fehlgeschlagen (LibreOffice erforderlich).")
        if not os.path.isfile(pdf_path):
            raise HTTPException(status_code=500, detail="PDF-Datei nach Konvertierung nicht gefunden.")
        filename = Path(meeting.einladung_pfad).with_suffix(".pdf").name
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Einladung PDF-Download fehlgeschlagen (meeting_id=%s): %s", meeting_id, e)
        raise HTTPException(
            status_code=500,
            detail=f"PDF-Download fehlgeschlagen: {str(e)}",
        ) from e


@router.get("/{meeting_id}/protokoll.pdf")
async def download_protocol_pdf(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("mitarbeiter")),
):
    """Protokoll als PDF herunterladen. Mitarbeiter+ can download."""
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting or not meeting.protokoll_pfad:
            raise HTTPException(status_code=404, detail="Protokoll nicht vorhanden. Bitte zuerst Protokoll (DOCX) erzeugen.")
        docx_full = os.path.normpath(os.path.join(settings.UPLOAD_DIR, meeting.protokoll_pfad))
        if not os.path.isfile(docx_full):
            raise HTTPException(status_code=404, detail="Protokolldatei nicht gefunden.")
        pdf_path = await asyncio.to_thread(docx_to_pdf, docx_full)
        if not pdf_path:
            raise HTTPException(status_code=500, detail="PDF-Konvertierung fehlgeschlagen (LibreOffice erforderlich).")
        if not os.path.isfile(pdf_path):
            raise HTTPException(status_code=500, detail="PDF-Datei nach Konvertierung nicht gefunden.")
        filename = Path(meeting.protokoll_pfad).with_suffix(".pdf").name
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Protokoll PDF-Download fehlgeschlagen (meeting_id=%s): %s", meeting_id, e)
        raise HTTPException(
            status_code=500,
            detail=f"PDF-Download fehlgeschlagen: {str(e)}",
        ) from e
