"""Auth Pydantic schemas"""
from pydantic import BaseModel, EmailStr
from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class ProfileUpdate(BaseModel):
    """Felder, die der eingeloggte User selbst ändern darf."""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class MicrosoftCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None


class MicrosoftAuthorizeResponse(BaseModel):
    authorize_url: str
