"""AuditLog Pydantic schemas"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
