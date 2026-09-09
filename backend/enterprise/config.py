"""Configurazione enterprise per Quadra SaaS.

Tutte le configurazioni sensibili vengono lette da variabili d'ambiente.
In produzione, usa Azure Key Vault per i secrets.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class EnterpriseSettings(BaseSettings):
    """Configurazione enterprise Quadra."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Environment
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    
    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    workers: int = 4
    
    # Frontend URL (per CORS e redirect)
    frontend_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"
    
    # Database PostgreSQL
    database_url: PostgresDsn = Field(
        default="postgresql://postgres:postgres@localhost:5432/quadra"
    )
    database_pool_size: int = 20
    database_max_overflow: int = 10
    
    # Redis
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")
    redis_session_db: int = 0
    redis_cache_db: int = 1
    redis_queue_db: int = 2
    
    # Microsoft Entra ID (Azure AD)
    azure_client_id: str = Field(default="")
    azure_client_secret: str = Field(default="")
    azure_tenant_id: str = Field(default="common")  # "common" per multi-tenant
    azure_authority: str = Field(default="")
    azure_redirect_uri: str = Field(default="")
    
    @property
    def azure_authority_url(self) -> str:
        if self.azure_authority:
            return self.azure_authority
        return f"https://login.microsoftonline.com/{self.azure_tenant_id}"
    
    # JWT
    jwt_secret_key: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    
    # Session
    session_cookie_name: str = "quadra_session"
    session_cookie_secure: bool = True  # False solo in development
    session_cookie_httponly: bool = True
    session_cookie_samesite: str = "lax"
    session_max_age_seconds: int = 86400  # 24 ore
    
    # Rate Limiting
    rate_limit_requests_per_minute: int = 100
    rate_limit_requests_per_minute_per_tenant: int = 1000
    
    # Security
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    allowed_hosts: list[str] = Field(default_factory=lambda: ["*"])
    
    # Azure Storage
    azure_storage_connection_string: str = Field(default="")
    azure_storage_container_name: str = "documents"
    
    # Celery
    celery_broker_url: str = Field(default="redis://localhost:6379/2")
    celery_result_backend: str = Field(default="redis://localhost:6379/2")
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"  # "json" o "text"
    
    # Super Admin (il tuo account)
    super_admin_emails: list[str] = Field(default_factory=list)
    
    def is_super_admin(self, email: str) -> bool:
        """Verifica se l'email è un super admin."""
        return email.lower() in [e.lower() for e in self.super_admin_emails]


@lru_cache
def get_settings() -> EnterpriseSettings:
    """Ritorna le settings (cached)."""
    return EnterpriseSettings()


# Alias per comodità
settings = get_settings()
