FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl fontconfig libreoffice-writer \
    fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY --from=builder /install /usr/local
COPY ./app ./app
COPY ./alembic ./alembic
COPY ./alembic.ini .
COPY ./scripts ./scripts
RUN chmod +x /app/scripts/*.py 2>/dev/null || true
RUN chmod +x /app/scripts/entrypoint.sh
RUN mkdir -p /usr/share/fonts/truetype/julis \
    && cp -r /app/app/templates/font/. /usr/share/fonts/truetype/julis/ 2>/dev/null || true \
    && fc-cache -f -v
RUN mkdir -p /app/data/uploads/protokolle /app/data/uploads/dokumente /app/data/uploads/sitzungen \
    && chown -R app:app /app/data
EXPOSE 8000
USER app
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
