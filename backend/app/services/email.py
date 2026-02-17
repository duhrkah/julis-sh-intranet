"""Email service for sending mails via SMTP"""
import smtplib
import re
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import List, Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)


def get_attachment_from_path(
    upload_dir: str,
    relative_path: Optional[str],
    original_filename: Optional[str],
) -> Optional[Tuple[str, bytes]]:
    """Liest eine Anhang-Datei; gibt (filename, bytes) oder None zurück."""
    if not relative_path or not original_filename:
        return None
    path = Path(upload_dir) / relative_path
    if not path.is_file():
        return None
    try:
        return (original_filename, path.read_bytes())
    except Exception:
        return None


def render_template(template: str, data: dict) -> str:
    """Replace {placeholder} patterns in template string with data values."""
    def replacer(match):
        key = match.group(1)
        return str(data.get(key, ""))

    result = re.sub(r'\{(\w+)\}', replacer, template)
    return result.replace("\n", "<br>")


def send_email(
    to: List[str],
    subject: str,
    body: str,
    html: bool = True,
    attachments: Optional[List[Tuple[str, bytes]]] = None,
) -> bool:
    """Send an email via SMTP. attachments: list of (filename, raw_bytes)."""
    if not settings.email_configured:
        logger.warning("Email not configured, skipping send")
        return False

    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = ", ".join(to)

        body_part = MIMEMultipart("alternative")
        if html:
            body_part.attach(MIMEText(body, "html", "utf-8"))
        else:
            body_part.attach(MIMEText(body, "plain", "utf-8"))
        msg.attach(body_part)

        if attachments:
            for filename, content in attachments:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(content)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=("utf-8", "", filename),
                )
                msg.attach(part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to, msg.as_string())

        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False
