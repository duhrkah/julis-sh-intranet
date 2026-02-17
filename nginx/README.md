# Nginx Reverse-Proxy + Let's Encrypt (Certbot)

- **Domain:** intranet.julis-sh.de
- Port 80 → ACME-Challenge + Redirect zu HTTPS
- Port 443 → Proxy zu Frontend (Next.js) und Backend (API, Uploads)

## Erstes Starten (Let's Encrypt Zertifikat)

Beim ersten Start legt der Container ein **selbstsigniertes Zertifikat** an, damit Nginx mit HTTPS starten kann. Für ein gültiges Zertifikat:

1. Stack starten: `docker compose up -d`
2. DNS für **intranet.julis-sh.de** muss auf diesen Host zeigen (Port 80 und 443 erreichbar).
3. Echt-Zertifikat anfordern (E-Mail durch eure Adresse ersetzen):

   ```bash
   docker compose exec nginx certbot certonly --webroot -w /var/www/certbot \
     -d intranet.julis-sh.de \
     -m admin@julis-sh.de \
     --agree-tos --no-eff-email --non-interactive
   ```

4. Nginx neu laden:

   ```bash
   docker compose exec nginx nginx -s reload
   ```

Danach liefert die Seite ein gültiges Let's Encrypt-Zertifikat aus.

## Verlängerung

Ein Cron-Job im Nginx-Container führt täglich um 3:00 Uhr `certbot renew` aus und lädt Nginx danach neu. Kein manueller Schritt nötig.
