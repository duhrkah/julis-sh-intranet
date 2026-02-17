"""API v1 Router-Aggregator – alle Module unter /api/v1"""
from fastapi import APIRouter

from app.api.v1 import auth, users, events, admin, categories, tenants, public
from app.api.v1 import kreisverband, member_changes, email_templates, email_recipients, documents, meetings, audit, settings as settings_router

api_router = APIRouter()

# Auth (öffentlich + geschützt)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Benutzer & RBAC
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Kalender
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(public.router, prefix="/public", tags=["public"])

# Kreisverbandsmanagement
api_router.include_router(kreisverband.router, prefix="/kreisverband", tags=["kreisverband"])

# Mitgliederänderungen & E-Mail
api_router.include_router(member_changes.router, prefix="/member-changes", tags=["member-changes"])
api_router.include_router(email_templates.router, prefix="/email-templates", tags=["email-templates"])
api_router.include_router(email_recipients.router, prefix="/email-recipients", tags=["email-recipients"])

# Dokumentenverwaltung (Satzung/GO) & Sitzungen
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])

# Audit-Log
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])

# Einstellungen (SMTP-Test etc.) – Admin
api_router.include_router(settings_router.router, prefix="/settings", tags=["settings"])
