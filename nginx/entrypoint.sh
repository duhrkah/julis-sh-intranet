#!/bin/sh
set -e

CERT_DIR="/etc/letsencrypt/live/intranet.julis-sh.de"
mkdir -p /var/www/certbot

# Selbstsigniertes Zertifikat anlegen, falls noch keins von Let's Encrypt existiert
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  echo "No Let's Encrypt cert found. Creating self-signed certificate for initial start."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=intranet.julis-sh.de"
  echo "Run: docker compose exec nginx certbot certonly --webroot -w /var/www/certbot -d intranet.julis-sh.de -m YOUR_EMAIL --agree-tos --no-eff-email"
  echo "Then: docker compose exec nginx nginx -s reload"
fi

# Cron für Certbot-Renewal starten (im Hintergrund)
crond -b -l 2

exec nginx -g "daemon off;"
