"""Configurazione centralizzata per Quadra.

Segue il principio 12-factor app: tutta la configurazione viene
da variabili d'ambiente. Questo permette lo stesso codice per:
- Sviluppo locale
- Docker compose
- VPS con Coolify
- (futuro) Azure/AWS

Uso:
    from backend.core import settings
    
    db_url = settings.database_url
    if settings.is_production:
        # comportamento produzione
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurazione Quadra — tutte le variabili d'ambiente."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # ==========================================
    # Environment
    # ==========================================
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"
    
    # ==========================================
    # Server
    # ==========================================
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    workers: int = 1
    
    # URLs
    frontend_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"
    
    # ==========================================
    # Database
    # ==========================================
    database_url: str = Field(
        default="postgresql://quadra:quadra_dev@localhost:5432/quadra",
        description="PostgreSQL connection string"
    )
    database_pool_size: int = 5
    database_max_overflow: int = 10
    
    # Per sviluppo senza PostgreSQL
    use_sqlite: bool = Field(
        default=False,
        description="Usa SQLite invece di PostgreSQL (solo dev)"
    )
    sqlite_path: str = "quadra.db"
    
    # ==========================================
    # Redis
    # ==========================================
    redis_url: str = "redis://localhost:6379/0"
    
    # Per sviluppo senza Redis
    use_memory_cache: bool = Field(
        default=False,
        description="Usa cache in memoria invece di Redis (solo dev)"
    )
    
    # ==========================================
    # Storage (MinIO / S3 / Locale)
    # ==========================================
    storage_backend: Literal["local", "minio", "s3"] = "local"
    
    # Local storage
    storage_local_path: str = "./storage"
    
    # MinIO / S3
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "quadra-documents"
    minio_secure: bool = False  # True per HTTPS
    
    # S3 (se diverso da MinIO)
    s3_region: str = "eu-west-1"
    
    # ==========================================
    # Microsoft Entra ID (Azure AD)
    # ==========================================
    azure_client_id: str = ""
    azure_client_secret: str = ""
    azure_tenant_id: str = "common"
    azure_redirect_uri: str = "http://localhost:8000/auth/callback"
    
    # Per sviluppo senza Azure AD
    auth_bypass: bool = Field(
        default=False,
        description="Bypassa autenticazione (SOLO sviluppo!)"
    )
    auth_bypass_user_email: str = "dev@localhost"
    
    @property
    def azure_authority_url(self) -> str:
        return f"https://login.microsoftonline.com/{self.azure_tenant_id}"
    
    # ==========================================
    # JWT
    # ==========================================
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    
    # ==========================================
    # Session
    # ==========================================
    session_cookie_name: str = "quadra_session"
    session_cookie_secure: bool = False  # True in produzione
    session_cookie_httponly: bool = True
    session_cookie_samesite: str = "lax"
    session_max_age_seconds: int = 86400
    
    # ==========================================
    # Celery
    # ==========================================
    celery_broker_url: str = "redis://localhost:6379/2"
    celery_result_backend: str = "redis://localhost:6379/2"
    
    # ==========================================
    # Rate Limiting
    # ==========================================
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 100
    rate_limit_requests_per_minute_per_tenant: int = 1000
    
    # ==========================================
    # CORS
    # ==========================================
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"]
    )
    
    # ==========================================
    # Logging
    # ==========================================
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "text"  # json in produzione
    
    # ==========================================
    # Admin
    # ==========================================
    super_admin_emails: list[str] = Field(default_factory=list)
    
    def is_super_admin(self, email: str) -> bool:
        return email.lower() in [e.lower() for e in self.super_admin_emails]


@lru_cache
def get_settings() -> Settings:
    """Ritorna le settings (cached)."""
    return Settings()


# Alias globale per comodità
settings = get_settings()
