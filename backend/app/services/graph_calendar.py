"""Spiegelung genehmigter Events in einen Microsoft-365-Sammelkalender.

Die App nutzt den Client-Credentials-Flow und erwartet in Azure die
Application-Permission ``Calendars.ReadWrite`` (Graph). Ziel-Mailbox ist
``settings.GRAPH_CALENDAR_MAILBOX``; der Zugriff sollte über eine
``ApplicationAccessPolicy`` auf genau diese Mailbox eingeschränkt werden.
"""
from __future__ import annotations

import asyncio
import html
import logging
import time
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.event import Event

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
EVENT_TIMEZONE = "Europe/Berlin"
REQUEST_TIMEOUT = 15.0

_token_value: Optional[str] = None
_token_expires_at: float = 0.0
_token_lock = asyncio.Lock()


async def _get_access_token() -> Optional[str]:
    """Holt (und cached) ein App-Token für Microsoft Graph."""
    global _token_value, _token_expires_at

    if not settings.graph_calendar_configured:
        return None

    now = time.time()
    if _token_value and now < _token_expires_at - 60:
        return _token_value

    async with _token_lock:
        if _token_value and time.time() < _token_expires_at - 60:
            return _token_value
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    TOKEN_URL.format(tenant=settings.MS_TENANT_ID),
                    data={
                        "client_id": settings.MS_CLIENT_ID,
                        "client_secret": settings.MS_CLIENT_SECRET,
                        "scope": "https://graph.microsoft.com/.default",
                        "grant_type": "client_credentials",
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
            if resp.status_code != 200:
                logger.warning(
                    "Graph token request failed: %s %s", resp.status_code, resp.text
                )
                return None
            data = resp.json()
            _token_value = data["access_token"]
            _token_expires_at = time.time() + float(data.get("expires_in", 3600))
            return _token_value
        except Exception as exc:
            logger.warning("Graph token request raised: %s", exc)
            return None


def _format_datetime(d, t) -> str:
    """Graph erwartet ISO 8601 ohne Zeitzone (TZ wird separat angegeben)."""
    if t is not None:
        return f"{d.isoformat()}T{t.isoformat(timespec='seconds')}"
    return f"{d.isoformat()}T00:00:00"


def _build_schedule(event: Event) -> tuple[dict, dict, bool]:
    """Liefert (start, end, is_all_day) für den Graph-Event."""
    start_date = event.start_date
    end_date = event.end_date or start_date
    start_time = event.start_time
    end_time = event.end_time

    is_all_day = start_time is None

    if is_all_day:
        # Graph-All-Day: end.dateTime ist der Tag NACH dem letzten Tag um 00:00
        from datetime import timedelta

        end_exclusive = end_date + timedelta(days=1)
        start = {"dateTime": _format_datetime(start_date, None), "timeZone": EVENT_TIMEZONE}
        end = {"dateTime": _format_datetime(end_exclusive, None), "timeZone": EVENT_TIMEZONE}
        return start, end, True

    if end_time is None:
        # Standard: 1 Stunde Dauer, falls nichts Anderes angegeben
        from datetime import datetime, timedelta

        start_dt = datetime.combine(start_date, start_time)
        end_dt = start_dt + timedelta(hours=1)
        end_date = end_dt.date()
        end_time = end_dt.time()

    start = {"dateTime": _format_datetime(start_date, start_time), "timeZone": EVENT_TIMEZONE}
    end = {"dateTime": _format_datetime(end_date, end_time), "timeZone": EVENT_TIMEZONE}
    return start, end, False


def _build_body(event: Event) -> dict:
    """HTML-Body mit Herkunftshinweis und optionaler Beschreibung."""
    intranet_link = settings.APP_URL.rstrip("/") + "/kalender"
    hinweis = (
        "<p><strong>Hinweis:</strong> Dieser Termin wurde automatisch aus dem "
        "JuLis-Intranet synchronisiert. Bitte nicht direkt in Outlook bearbeiten – "
        "Änderungen werden beim nächsten Abgleich überschrieben.</p>"
        f'<p>Quelle: <a href="{html.escape(intranet_link)}">Im Intranet öffnen</a></p>'
    )

    extra_parts: list[str] = []
    if event.description:
        extra_parts.append(
            "<p>" + html.escape(event.description).replace("\n", "<br>") + "</p>"
        )
    if event.organizer:
        extra_parts.append(
            f"<p><em>Veranstalter:</em> {html.escape(event.organizer)}</p>"
        )
    if event.location_url:
        extra_parts.append(
            f'<p><em>Link:</em> <a href="{html.escape(event.location_url)}">'
            f"{html.escape(event.location_url)}</a></p>"
        )

    separator = "<hr>" if extra_parts else ""
    content = hinweis + separator + "".join(extra_parts)
    return {"contentType": "HTML", "content": content}


def _build_payload(event: Event) -> dict:
    start, end, is_all_day = _build_schedule(event)
    payload: dict = {
        "subject": event.title,
        "body": _build_body(event),
        "start": start,
        "end": end,
        "isAllDay": is_all_day,
        "showAs": "free",
        "isReminderOn": False,
    }
    if event.location:
        payload["location"] = {"displayName": event.location}
    return payload


def _events_url() -> str:
    return f"{GRAPH_BASE}/users/{settings.GRAPH_CALENDAR_MAILBOX}/events"


async def create_graph_event(event: Event) -> Optional[str]:
    token = await _get_access_token()
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                _events_url(),
                json=_build_payload(event),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code >= 300:
            logger.warning(
                "Graph create event failed (event_id=%s): %s %s",
                event.id,
                resp.status_code,
                resp.text,
            )
            return None
        return resp.json().get("id")
    except Exception as exc:
        logger.warning("Graph create event raised (event_id=%s): %s", event.id, exc)
        return None


UPDATE_OK = "ok"
UPDATE_GONE = "gone"  # Outlook-Termin wurde zwischenzeitlich gelöscht
UPDATE_ERROR = "error"  # Transienter Fehler – keine Neu-Anlage erzwingen


async def update_graph_event(graph_event_id: str, event: Event) -> str:
    token = await _get_access_token()
    if not token:
        return UPDATE_ERROR
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.patch(
                f"{_events_url()}/{graph_event_id}",
                json=_build_payload(event),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code == 404:
            logger.info(
                "Graph event %s not found (event_id=%s), recreating",
                graph_event_id,
                event.id,
            )
            return UPDATE_GONE
        if resp.status_code >= 300:
            logger.warning(
                "Graph update event failed (event_id=%s, graph_id=%s): %s %s",
                event.id,
                graph_event_id,
                resp.status_code,
                resp.text,
            )
            return UPDATE_ERROR
        return UPDATE_OK
    except Exception as exc:
        logger.warning(
            "Graph update event raised (event_id=%s, graph_id=%s): %s",
            event.id,
            graph_event_id,
            exc,
        )
        return UPDATE_ERROR


async def delete_graph_event(graph_event_id: str) -> bool:
    token = await _get_access_token()
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.delete(
                f"{_events_url()}/{graph_event_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code in (200, 204, 404):
            return True
        logger.warning(
            "Graph delete event failed (graph_id=%s): %s %s",
            graph_event_id,
            resp.status_code,
            resp.text,
        )
        return False
    except Exception as exc:
        logger.warning("Graph delete event raised (graph_id=%s): %s", graph_event_id, exc)
        return False


# ---------------------------------------------------------------------------
# High-Level-Orchestrierung (wird aus den Endpoints aufgerufen)
# ---------------------------------------------------------------------------


async def sync_event_to_graph(db: Session, event: Event) -> None:
    """Upsert oder Delete im Outlook-Kalender je nach Event-Status.

    Sichtbarkeitsregel: Nur ``approved`` + ``is_public`` wird gespiegelt.
    Alle Änderungen werden best-effort ausgeführt; Fehler brechen den
    aufrufenden Request nicht ab, sondern landen nur im Log.
    """
    if not settings.graph_calendar_configured:
        return

    should_exist = event.status == "approved" and event.is_public

    if not should_exist:
        if event.graph_event_id:
            if await delete_graph_event(event.graph_event_id):
                event.graph_event_id = None
                db.commit()
        return

    if event.graph_event_id:
        result = await update_graph_event(event.graph_event_id, event)
        if result == UPDATE_OK:
            return
        if result == UPDATE_ERROR:
            # Transienter Fehler – bestehende ID behalten, nicht duplizieren.
            return
        # UPDATE_GONE: Termin wurde extern gelöscht → neu anlegen
        event.graph_event_id = None

    new_id = await create_graph_event(event)
    if new_id:
        event.graph_event_id = new_id
        db.commit()


async def remove_event_from_graph(graph_event_id: Optional[str]) -> None:
    """Best-effort-Löschung vor dem Hard-Delete eines Events aus der DB."""
    if not settings.graph_calendar_configured or not graph_event_id:
        return
    await delete_graph_event(graph_event_id)
