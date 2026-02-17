"""Authentication endpoints"""
import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import jwt
from jwt import PyJWKClient

from app.api.deps import get_db, get_current_user, get_accessible_tenant_ids
from app.schemas.auth import (
    LoginResponse,
    Token,
    ProfileUpdate,
    ChangePassword,
    MicrosoftCallbackRequest,
    MicrosoftAuthorizeResponse,
)
from app.schemas.user import UserProfile
from app.models.user import User
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.limiter import limiter
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Microsoft 365 / Entra ID Login
# ---------------------------------------------------------------------------

MS_AUTHORIZE_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
MS_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
MS_JWKS_URL = "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"
MS_SCOPES = "openid profile email"


@router.get("/microsoft/status")
async def microsoft_login_status():
    """Ob Microsoft-Login verfügbar ist (für Anzeige des Buttons). Kein Auth nötig."""
    return {"microsoft_login_enabled": settings.ms_oauth_configured}


@router.get("/microsoft/authorize", response_model=MicrosoftAuthorizeResponse)
async def microsoft_authorize(
    next_path: str = Query("", alias="next"),
):
    """Redirect-URL für Microsoft-Login abrufen. Frontend leitet darauf weiter."""
    if not settings.ms_oauth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft-Login ist nicht konfiguriert (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET).",
        )
    redirect_uri = settings.ms_oauth_redirect_uri
    state = next_path if next_path and next_path.startswith("/") else ""
    params = {
        "client_id": settings.MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": MS_SCOPES,
        "response_mode": "query",
    }
    if state:
        params["state"] = state
    url = MS_AUTHORIZE_URL.format(tenant=settings.MS_TENANT_ID) + "?" + urlencode(params)
    return MicrosoftAuthorizeResponse(authorize_url=url)


@router.post("/microsoft/callback", response_model=LoginResponse)
async def microsoft_callback(
    data: MicrosoftCallbackRequest,
    db: Session = Depends(get_db),
):
    """Authorization-Code gegen Tokens tauschen, User per E-Mail zuordnen, eigenes JWT zurückgeben."""
    if not settings.ms_oauth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft-Login ist nicht konfiguriert.",
        )
    redirect_uri = data.redirect_uri or settings.ms_oauth_redirect_uri

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            MS_TOKEN_URL.format(tenant=settings.MS_TENANT_ID),
            data={
                "client_id": settings.MS_CLIENT_ID,
                "client_secret": settings.MS_CLIENT_SECRET,
                "code": data.code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if token_resp.status_code != 200:
        logger.warning("Microsoft token exchange failed: %s %s", token_resp.status_code, token_resp.text)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Microsoft-Anmeldung fehlgeschlagen (Token).",
        )
    token_json = token_resp.json()
    id_token = token_json.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kein ID-Token von Microsoft erhalten.",
        )

    # ID-Token verifizieren (Signatur + iss/aud/exp)
    jwks_url = MS_JWKS_URL.format(tenant=settings.MS_TENANT_ID)
    try:
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.MS_CLIENT_ID,
            issuer=f"https://login.microsoftonline.com/{settings.MS_TENANT_ID}/v2.0",
        )
    except Exception as e:
        logger.warning("Microsoft id_token validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges Microsoft-Token.",
        )

    # E-Mail aus Token (preferred_username oder email)
    email = (payload.get("email") or payload.get("preferred_username") or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="In Ihrem Microsoft-Konto wurde keine E-Mail-Adresse gefunden.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Intranet-Zugang für diese E-Mail-Adresse. Bitte wenden Sie sich an die Verwaltung.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ihr Zugang ist deaktiviert.",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "tenant_id": user.tenant_id,
        },
    }


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "tenant_id": user.tenant_id
        }
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    display_role = current_user.get_display_role()
    accessible_ids = get_accessible_tenant_ids(db, current_user)

    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        tenant_id=current_user.tenant_id,
        display_role=display_role,
        accessible_tenant_ids=accessible_ids,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(current_user.id), "username": current_user.username, "role": current_user.role},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.patch("/me", response_model=UserProfile)
async def update_my_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Eigenes Profil (Name, E-Mail) aktualisieren. Nur gesetzte Felder werden geändert."""
    update_data = data.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != current_user.email:
        existing = db.query(User).filter(User.email == update_data["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse wird bereits verwendet.")
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    display_role = current_user.get_display_role()
    accessible_ids = get_accessible_tenant_ids(db, current_user)
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        tenant_id=current_user.tenant_id,
        display_role=display_role,
        accessible_tenant_ids=accessible_ids,
    )


@router.post("/change-password")
async def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Passwort ändern. Aktuelles Passwort muss angegeben werden."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch.")
    from app.core.security import validate_password_strength
    error = validate_password_strength(data.new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Passwort wurde geändert."}
