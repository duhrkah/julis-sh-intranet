"""Settings/Admin endpoints (SMTP test, etc.) – nur Admin."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.core.rbac import require_role
from app.models.user import User
from app.services.email import send_email

router = APIRouter()


class SmtpTestRequest(BaseModel):
    to: EmailStr


@router.post("/smtp-test")
async def test_smtp(
    data: SmtpTestRequest,
    current_user: User = Depends(require_role("admin")),
):
    """
    Test-E-Mail an die angegebene Adresse senden. Nur Administrator.
    Prüft die SMTP-Konfiguration (Host, Port, Anmeldung, Versand).
    """
    if not settings.email_configured:
        missing = settings.smtp_missing_settings()
        detail = (
            "SMTP ist nicht konfiguriert. In backend/.env fehlen oder sind leer: "
            + ", ".join(missing)
            + ". Bitte setzen und Backend neu starten."
        )
        raise HTTPException(status_code=503, detail=detail)
    subject = "JuLis SH Intranet – SMTP-Test"
    body = (
        "<p>Diese E-Mail wurde vom JuLis SH Intranet gesendet, um die SMTP-Konfiguration zu testen.</p>"
        "<p>Wenn Sie diese Nachricht erhalten, funktioniert der E-Mail-Versand.</p>"
    )
    ok = send_email(to=[data.to], subject=subject, body=body)
    if not ok:
        raise HTTPException(
            status_code=502,
            detail="E-Mail konnte nicht gesendet werden. Bitte SMTP-Einstellungen und Logs prüfen.",
        )
    return {"detail": f"Test-E-Mail wurde an {data.to} gesendet."}
