# JuLis SH Intranet

Internes Portal für Kalender, Mitgliederänderungen, Kreisverbände und Dokumente (Satzung, Sitzungen).

## Stack

- **Frontend:** Next.js 14, React, TailwindCSS, Radix UI
- **Backend:** FastAPI, SQLite (dev), JWT-Auth
- **Dev:** Docker Compose (Backend + Frontend)

## Voraussetzungen

- Docker & Docker Compose
- (Optional) Node 20, Python 3.11 für lokales Laufen ohne Docker

## Schnellstart (Docker)

```bash
# Im Projektroot (Ordner mit docker-compose.dev.yml)
docker compose -f docker-compose.dev.yml up -d
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:8000  
- **API-Docs:** http://localhost:8000/docs  

### Erste Schritte nach dem Start

1. **Seed ausführen** (legt u. a. Admin-User und Kreisverbände an):
   ```bash
   docker compose -f docker-compose.dev.yml exec backend python -m scripts.seed
   ```
2. **Login:** Nutzer `admin` / Passwort `admin` (nur Dev – in Produktion ändern!)
3. **Öffentliche Termin-Einreichung** (optional):  
   In der Seed-Ausgabe erscheint eine Zeile `PUBLIC_SUBMITTER_USER_ID=<id>`. Diese Zeile in eine Datei **`.env`** im Projektroot eintragen, dann Backend neu starten:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --force-recreate backend
   ```
   Danach funktioniert die Seite „Termin einreichen“ (ohne Login).

### Dev vs. Prod Seed

`python -m scripts.seed` wertet **ENVIRONMENT** aus (aus `backend/.env` bzw. Umgebung):

- **ENVIRONMENT=development** (Standard): **Dev-Seed** – Admin (Passwort `admin`), Landesverband, alle Kreisverbände, Test-User (leitung, vorstand, mitarbeiter), User „oeffentlich“.
- **ENVIRONMENT=production**: **Prod-Seed** – nur Admin, ein Landesverband-Tenant und User „oeffentlich“. Keine Kreisverbände, keine Test-User. Admin-Passwort: entweder `ADMIN_INITIAL_PASSWORD` in der Umgebung setzen oder das beim Seed ausgegebene Zufallspasswort einmalig notieren und danach in den Einstellungen ändern.

Optional für Prod: `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD` (siehe `backend/.env.example`).

## Konfiguration

- **Projektroot:** `.env` – wird von `docker-compose.dev.yml` gelesen (z. B. `PUBLIC_SUBMITTER_USER_ID=5`).
- **Backend:** `backend/.env` – Datenbank, JWT, SMTP etc. (siehe `backend/.env.example`).
- **Frontend:** `frontend/.env` – z. B. `NEXT_PUBLIC_API_URL` (siehe `frontend/.env.example`).

## Entwicklung ohne Docker

- **Backend:** `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- **Frontend:** `cd frontend && npm install && npm run dev`
- Datenbank: `backend/.env` mit `DATABASE_URL=sqlite:///./data/intranet.db`, danach `python -m scripts.seed` im Backend-Ordner.

## Projektstruktur

```
intranet/
├── backend/          # FastAPI (app/, scripts/, alembic)
├── frontend/         # Next.js (src/app, src/components, src/lib)
├── data/             # SQLite-DB & Uploads (von Docker gemountet)
├── docker-compose.dev.yml
├── .env              # Optional, z. B. PUBLIC_SUBMITTER_USER_ID
└── README.md
```

## Lizenz / Hinweis

Internes Projekt – Nutzung gemäß Vereinsvorgaben.
