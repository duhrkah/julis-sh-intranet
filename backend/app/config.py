"""Application configuration using Pydantic Settings"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings"""

    DATABASE_URL: str = "sqlite:///./data/intranet.db"

    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3333"

    ENVIRONMENT: str = "development"

    # E-Mail (SMTP)
    SMTP_ENABLED: bool = False
    SMTP_HOST: str = "smtp.office365.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "JuLis SH Intranet"
    APP_URL: str = "http://localhost:3000"

    # E-Mail-Empfänger für Benachrichtigungen zu Änderungsanträgen (Satzung/Geschäftsordnung), kommagetrennt
    DOCUMENT_AMENDMENT_NOTIFY_EMAILS: str = ""

    # Microsoft Graph API (for mail sending)
    MS_TENANT_ID: Optional[str] = None
    MS_CLIENT_ID: Optional[str] = None
    MS_CLIENT_SECRET: Optional[str] = None
    MS_SENDER_MAIL: Optional[str] = None

    # Microsoft 365 / Entra ID Login (OAuth2)
    # Redirect URI in Azure muss exakt der Frontend-Callback sein, z. B. https://intranet.example.com/login/microsoft/callback
    MS_OAUTH_REDIRECT_URI: Optional[str] = None  # z. B. aus APP_URL + /login/microsoft/callback

    # Upload paths
    UPLOAD_DIR: str = "./data/uploads"

    # Word-Vorlagen: Zeichenformat für Tagesordnung (RichText setzt sonst Vorlagen-Formatierung zurück)
    # Option A: Name eines in Word angelegten Zeichenstils (z. B. "TagesordnungText") – Schriftart/Größe aus Vorlage
    DOCX_TAGESORDNUNG_STYLE: Optional[str] = None
    # Option B: Schriftart und Größe direkt (falls kein Zeichenstil): z. B. "Calibri", 11
    DOCX_TAGESORDNUNG_FONT: Optional[str] = None
    DOCX_TAGESORDNUNG_SIZE: Optional[int] = None  # Punkt (pt)

    # Öffentliche Termin-Einreichung (ohne Login)
    PUBLIC_SUBMITTER_USER_ID: Optional[int] = None  # User-ID für "Gast"-Einreichungen
    PUBLIC_DEFAULT_TENANT_ID: Optional[int] = None  # Standard-Tenant für öffentliche Einreichungen

    @field_validator("PUBLIC_SUBMITTER_USER_ID", "PUBLIC_DEFAULT_TENANT_ID", mode="before")
    @classmethod
    def empty_str_to_none_int(cls, v: object) -> Optional[int]:
        if v is None or v == "":
            return None
        if isinstance(v, int):
            return v
        return int(v) if str(v).strip() else None

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def cors_allow_origin_regex(self) -> Optional[str]:
        if self.ENVIRONMENT != "development":
            return None
        return r"https?://(localhost|127\.0\.0\.1|frontend|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?"

    @property
    def email_configured(self) -> bool:
        return (
            self.SMTP_ENABLED
            and bool(self.SMTP_USER)
            and bool(self.SMTP_PASSWORD)
            and bool(self.SMTP_FROM_EMAIL)
        )

    def smtp_missing_settings(self) -> List[str]:
        """Liste der fehlenden SMTP-Einstellungen (für Fehlermeldungen)."""
        missing = []
        if not self.SMTP_ENABLED:
            missing.append("SMTP_ENABLED=true")
        if not self.SMTP_USER:
            missing.append("SMTP_USER")
        if not self.SMTP_PASSWORD:
            missing.append("SMTP_PASSWORD")
        if not self.SMTP_FROM_EMAIL:
            missing.append("SMTP_FROM_EMAIL")
        return missing

    @property
    def document_amendment_notify_emails_list(self) -> List[str]:
        """Liste der E-Mail-Adressen für Änderungsantrag-Benachrichtigungen."""
        return [e.strip() for e in self.DOCUMENT_AMENDMENT_NOTIFY_EMAILS.split(",") if e.strip()]

    @property
    def ms_graph_configured(self) -> bool:
        return (
            bool(self.MS_TENANT_ID)
            and bool(self.MS_CLIENT_ID)
            and bool(self.MS_CLIENT_SECRET)
            and bool(self.MS_SENDER_MAIL)
        )

    @property
    def ms_oauth_redirect_uri(self) -> str:
        """Redirect URI für Microsoft Login (Frontend-Callback)."""
        if self.MS_OAUTH_REDIRECT_URI:
            return self.MS_OAUTH_REDIRECT_URI.rstrip("/")
        return self.APP_URL.rstrip("/") + "/login/microsoft/callback"

    @property
    def ms_oauth_configured(self) -> bool:
        """Ob Microsoft-365-Login aktiv ist (Tenant + Client + Secret + Redirect)."""
        return (
            bool(self.MS_TENANT_ID)
            and bool(self.MS_CLIENT_ID)
            and bool(self.MS_CLIENT_SECRET)
        )


settings = Settings()
