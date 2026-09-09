"""Modelli per la gestione dei tenant."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, EmailStr


class TenantSettings(BaseModel):
    """Configurazione specifica del tenant."""
    
    # Limiti
    max_users: int = 50
    max_storage_gb: int = 100
    max_pratiche_active: int = 1000
    
    # Features abilitate
    features: list[str] = Field(default_factory=lambda: [
        "jet_analysis",
        "export_excel",
        "export_pdf",
    ])
    
    # Branding (opzionale)
    logo_url: str | None = None
    primary_color: str | None = None
    
    # Notifiche
    notification_emails: list[EmailStr] = Field(default_factory=list)
    
    # Integrations
    azure_tenant_id: str | None = None  # Per SSO specifico dello studio


class Tenant(BaseModel):
    """Studio di revisione (tenant)."""
    
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(description="Nome dello studio")
    slug: str = Field(description="Slug univoco per URL, es. 'studio-rossi'")
    
    settings: TenantSettings = Field(default_factory=TenantSettings)
    
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Stats (calcolate)
    user_count: int = 0
    pratica_count: int = 0
    storage_used_gb: float = 0.0
    
    class Config:
        from_attributes = True


class TenantCreate(BaseModel):
    """Schema per creazione tenant."""
    
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    settings: TenantSettings | None = None
    
    # Admin iniziale
    admin_email: EmailStr = Field(description="Email del primo admin del tenant")
    admin_name: str = Field(description="Nome del primo admin")


class TenantUpdate(BaseModel):
    """Schema per aggiornamento tenant."""
    
    name: str | None = None
    settings: TenantSettings | None = None
    is_active: bool | None = None


class TenantStats(BaseModel):
    """Statistiche di un tenant."""
    
    tenant_id: UUID
    user_count: int
    active_user_count: int  # Utenti attivi negli ultimi 30 giorni
    pratica_count: int
    pratica_count_this_month: int
    document_count: int
    storage_used_bytes: int
    api_calls_today: int
    api_calls_this_month: int
