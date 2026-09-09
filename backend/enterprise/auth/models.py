"""Modelli per autenticazione e autorizzazione."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, EmailStr


class UserRole(str, Enum):
    """Ruoli utente nel sistema.
    
    Gerarchia:
    - super_admin: Accesso a tutto, gestione tutti i tenant (solo tu)
    - tenant_admin: Admin dello studio, gestisce utenti del proprio tenant
    - manager: Responsabile revisione, tutte le pratiche del tenant
    - analyst: Revisore operativo, pratiche assegnate
    - viewer: Sola lettura
    """
    SUPER_ADMIN = "super_admin"
    TENANT_ADMIN = "tenant_admin"
    MANAGER = "manager"
    ANALYST = "analyst"
    VIEWER = "viewer"
    
    @property
    def level(self) -> int:
        """Livello numerico per confronti (più alto = più permessi)."""
        levels = {
            UserRole.SUPER_ADMIN: 100,
            UserRole.TENANT_ADMIN: 80,
            UserRole.MANAGER: 60,
            UserRole.ANALYST: 40,
            UserRole.VIEWER: 20,
        }
        return levels[self]
    
    def can_access(self, required: UserRole) -> bool:
        """Verifica se questo ruolo può accedere a risorse che richiedono `required`."""
        return self.level >= required.level


class User(BaseModel):
    """Utente autenticato."""
    
    id: UUID
    tenant_id: UUID
    azure_oid: str = Field(description="Object ID da Microsoft Entra ID")
    email: EmailStr
    display_name: str
    role: UserRole
    is_active: bool = True
    last_login: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Computed
    is_super_admin: bool = False
    
    class Config:
        from_attributes = True


class Session(BaseModel):
    """Sessione utente (stored in Redis)."""
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: UUID
    tenant_id: UUID
    role: UserRole
    
    # Security
    token_hash: str
    ip_address: str | None = None
    user_agent: str | None = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at


class TokenPair(BaseModel):
    """Coppia di token JWT."""
    
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = Field(description="Secondi alla scadenza dell'access token")


class MicrosoftUserInfo(BaseModel):
    """Info utente da Microsoft Graph API."""
    
    oid: str = Field(alias="id", description="Object ID univoco")
    email: EmailStr | None = Field(alias="mail", default=None)
    upn: str | None = Field(alias="userPrincipalName", default=None)
    display_name: str = Field(alias="displayName")
    given_name: str | None = Field(alias="givenName", default=None)
    surname: str | None = Field(alias="surname", default=None)
    
    @property
    def primary_email(self) -> str:
        """Email primaria (mail o UPN)."""
        return self.email or self.upn or ""
    
    class Config:
        populate_by_name = True


class LoginResponse(BaseModel):
    """Risposta al login."""
    
    user: User
    tokens: TokenPair
    is_new_user: bool = False


class AuthError(Exception):
    """Errore di autenticazione."""
    
    def __init__(self, message: str, code: str = "auth_error"):
        self.message = message
        self.code = code
        super().__init__(message)


class PermissionDenied(AuthError):
    """Permesso negato."""
    
    def __init__(self, message: str = "Non hai i permessi per questa operazione"):
        super().__init__(message, code="permission_denied")
