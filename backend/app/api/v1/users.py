"""User management endpoints"""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_db, get_current_user
from app.config import settings
from app.core.rbac import require_role, VALID_ROLES
from app.core.security import get_password_hash, validate_password_strength
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services.audit import log_action
from app.services.email import send_email

logger = logging.getLogger(__name__)
router = APIRouter()

# E-Mail an neuen Benutzer: Erklärung zum Zugang und Microsoft-365-Login
USER_CREATED_EMAIL_SUBJECT = "Dein Zugang zum JuLis-Intranet"
USER_CREATED_EMAIL_BODY_HTML = """
<p>Hallo {name},</p>
<p>für dich wurde ein Zugang zum JuLis-Intranet eingerichtet.</p>
<p><strong>So meldest du dich an:</strong></p>
<ol>
  <li>Öffne die Anmeldeseite: <a href="{login_url}">{login_url}</a></li>
  <li>Klicke auf „Mit Microsoft 365 anmelden“.</li>
  <li>Melde dich mit deinem Microsoft-Geschäftskonto (E-Mail: {email}) an.</li>
</ol>
<p>Bei Fragen wende dich an die Landesgeschäftsstelle.</p>
<p>Mit freundlichen Grüßen<br />
{from_name}</p>
"""


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    users = db.query(User).all()
    result = []
    for u in users:
        resp = UserResponse.model_validate(u)
        resp.display_role = u.get_display_role()
        result.append(resp)
    return result


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    if user_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    password = (user_data.password or "").strip()
    if password:
        error = validate_password_strength(password)
        if error:
            raise HTTPException(status_code=400, detail=error)
        password_hash = get_password_hash(password)
    else:
        # Nur Microsoft-365-Login: Platzhalter-Hash, Anmeldung mit Benutzer/Passwort nicht möglich
        password_hash = get_password_hash(secrets.token_urlsafe(48))

    existing = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        password_hash=password_hash,
        role=user_data.role,
        tenant_id=user_data.tenant_id,
    )
    db.add(db_user)
    db.flush()
    _display = (db_user.full_name or db_user.username or "").strip()
    log_action(db, current_user.id, "create", "user", db_user.id, f"Benutzer erstellt: {_display}", request)
    db.commit()
    db.refresh(db_user)

    # E-Mail mit Erklärungen an den neuen Benutzer senden (nur wenn SMTP konfiguriert)
    if settings.email_configured and db_user.email:
        login_url = settings.APP_URL.rstrip("/") + "/login"
        name = (db_user.full_name or db_user.username or "du").strip()
        body = USER_CREATED_EMAIL_BODY_HTML.format(
            name=name,
            login_url=login_url,
            email=db_user.email,
            username=db_user.username,
            from_name=settings.SMTP_FROM_NAME,
        )
        try:
            sent = send_email(
                to=[db_user.email],
                subject=USER_CREATED_EMAIL_SUBJECT,
                body=body,
                html=True,
            )
            if not sent:
                logger.warning("Benutzer-E-Mail konnte nicht versendet werden: %s", db_user.email)
        except Exception as e:
            logger.exception("Fehler beim Versand der Benutzer-E-Mail: %s", e)

    resp = UserResponse.model_validate(db_user)
    resp.display_role = db_user.get_display_role()
    return resp


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)
    if "password" in update_data:
        error = validate_password_strength(update_data["password"])
        if error:
            raise HTTPException(status_code=400, detail=error)
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    if "role" in update_data and update_data["role"] not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    for field, value in update_data.items():
        setattr(db_user, field, value)

    _display = (db_user.full_name or db_user.username or "").strip()
    log_action(db, current_user.id, "update", "user", db_user.id, f"Benutzer aktualisiert: {_display}", request)
    db.commit()
    db.refresh(db_user)

    resp = UserResponse.model_validate(db_user)
    resp.display_role = db_user.get_display_role()
    return resp


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    _display = (db_user.full_name or db_user.username or "").strip()
    db.delete(db_user)
    log_action(db, current_user.id, "delete", "user", user_id, f"Benutzer gelöscht: {_display}", request)
    db.commit()
    return {"message": "User deleted"}
