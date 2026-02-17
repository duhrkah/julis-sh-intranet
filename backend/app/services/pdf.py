"""Shared DOCX-to-PDF conversion using LibreOffice headless."""
import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def docx_to_pdf(docx_path: str) -> Optional[str]:
    """Konvertiert DOCX zu PDF mit LibreOffice (headless). Gibt Pfad zur PDF-Datei zurueck oder None bei Fehler."""
    try:
        docx_path = os.path.abspath(docx_path)
        if not os.path.isfile(docx_path):
            logger.warning("DOCX fuer PDF-Konvertierung nicht gefunden: %s", docx_path)
            return None
        out_dir = os.path.dirname(docx_path)
        for cmd in ("libreoffice", "soffice"):
            try:
                proc = subprocess.run(
                    [cmd, "--headless", "--convert-to", "pdf", "--outdir", out_dir, docx_path],
                    capture_output=True,
                    timeout=60,
                    cwd=out_dir,
                )
                if proc.returncode != 0:
                    logger.debug(
                        "LibreOffice %s exit code %s stderr=%s",
                        cmd,
                        proc.returncode,
                        (proc.stderr or b"").decode("utf-8", errors="replace")[:500],
                    )
                    continue
                pdf_path = Path(docx_path).with_suffix(".pdf")
                if pdf_path.is_file():
                    return str(pdf_path)
                break
            except (FileNotFoundError, subprocess.TimeoutExpired) as e:
                logger.debug("LibreOffice %s: %s", cmd, e)
                continue
        return None
    except Exception as e:
        logger.exception("PDF-Konvertierung fehlgeschlagen fuer %s: %s", docx_path, e)
        return None
