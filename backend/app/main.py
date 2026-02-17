"""FastAPI application initialization and configuration"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os

from app.config import settings
from app.core.limiter import limiter, RATE_LIMIT_ENABLED
import logging

if RATE_LIMIT_ENABLED:
    from slowapi.errors import RateLimitExceeded
    from slowapi import _rate_limit_exceeded_handler

import json as _json

class _JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return _json.dumps(log_entry, ensure_ascii=False)

_handler = logging.StreamHandler()
if settings.ENVIRONMENT == "production":
    _handler.setFormatter(_JSONFormatter())
    _handler.setLevel(logging.WARNING)
else:
    _handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    _handler.setLevel(logging.INFO)

logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "development" else logging.WARNING,
    handlers=[_handler],
)
logger = logging.getLogger(__name__)


async def log_unhandled_exception(request: Request, exc: Exception):
    """Loggt jede nicht behandelte Exception mit Traceback und gibt 500 zurück. HTTPException durchreichen."""
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception(
        "Unbehandelte Exception: %s %s -> %s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

app = FastAPI(
    title="JuLis SH Intranet API",
    description="Internes Verwaltungssystem der Jungen Liberalen Schleswig-Holstein e. V.",
    version="1.0.0",
    docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT == "development" else None,
)

if RATE_LIMIT_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_exception_handler(Exception, log_unhandled_exception)

cors_kwargs: dict = {
    "allow_origins": settings.cors_origins_list,
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Authorization", "Content-Type", "X-Tenant-Slug"],
}
if settings.cors_allow_origin_regex:
    cors_kwargs["allow_origin_regex"] = settings.cors_allow_origin_regex
app.add_middleware(CORSMiddleware, **cors_kwargs)

# Mount uploads directory for file serving
uploads_dir = os.path.join("data", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

DEFAULT_JWT_SECRET = "dev-secret-key-change-in-production"


@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting JuLis SH Intranet API in {settings.ENVIRONMENT} mode")
    if settings.ENVIRONMENT == "production" and settings.JWT_SECRET_KEY == DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "SICHERHEITSFEHLER: JWT_SECRET_KEY ist noch der Standardwert! "
            "Bitte einen sicheren, zufälligen Schlüssel in der .env-Datei setzen."
        )


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down JuLis SH Intranet API")


@app.get("/")
async def root():
    return {
        "message": "JuLis SH Intranet API",
        "version": "1.0.0",
        "docs": "/api/docs" if settings.ENVIRONMENT == "development" else "disabled"
    }


@app.get("/health")
async def health_check():
    from app.database import SessionLocal
    from sqlalchemy import text
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": db_status, "environment": settings.ENVIRONMENT},
        )
    return {"status": "healthy", "database": db_status, "environment": settings.ENVIRONMENT}


from app.api.v1.api import api_router as api_v1_router
app.include_router(api_v1_router, prefix="/api/v1")
