#!/bin/bash
set -e

# Eigene Schriftarten aus app/templates/font für LibreOffice/PDF verfügbar machen
if [ -d /app/app/templates/font ] && [ -n "$(ls -A /app/app/templates/font 2>/dev/null)" ]; then
  mkdir -p /usr/share/fonts/truetype/julis
  cp -r /app/app/templates/font/. /usr/share/fonts/truetype/julis/ 2>/dev/null || true
  fc-cache -f -v
fi

exec "$@"
