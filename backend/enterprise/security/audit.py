"""Audit logging per Quadra Enterprise.

Ogni azione viene tracciata con:
- Chi (user_id, tenant_id)
- Cosa (action, entity_type, entity_id)
- Quando (timestamp)
- Come (IP, user agent)
- Dettagli (JSON con dati specifici)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

logger = logging.getLogger("audit")


class AuditAction(str, Enum):
    """Azioni tracciabili nel sistema."""
    
    # Auth
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    TOKEN_REFRESH = "token_refresh"
    
    # User
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    USER_ROLE_CHANGE = "user_role_change"
    
    # Tenant
    TENANT_CREATE = "tenant_create"
    TENANT_UPDATE = "tenant_update"
    TENANT_DISABLE = "tenant_disable"
    
    # Client (cliente dello studio)
    CLIENT_CREATE = "client_create"
    CLIENT_UPDATE = "client_update"
    CLIENT_DELETE = "client_delete"
    
    # Pratica
    PRATICA_CREATE = "pratica_create"
    PRATICA_UPDATE = "pratica_update"
    PRATICA_DELETE = "pratica_delete"
    PRATICA_STATUS_CHANGE = "pratica_status_change"
    PRATICA_ASSIGN = "pratica_assign"
    
    # Document
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_DELETE = "document_delete"
    DOCUMENT_DOWNLOAD = "document_download"
    DOCUMENT_CLASSIFY = "document_classify"
    
    # Analysis
    ANALYSIS_START = "analysis_start"
    ANALYSIS_COMPLETE = "analysis_complete"
    
    # Export
    EXPORT_XLSX = "export_xlsx"
    EXPORT_PDF = "export_pdf"
    
    # Admin
    ADMIN_VIEW_AUDIT = "admin_view_audit"
    ADMIN_VIEW_METRICS = "admin_view_metrics"
    ADMIN_CONFIG_CHANGE = "admin_config_change"


class AuditEntry(BaseModel):
    """Entry del log di audit."""
    
    id: int | None = None  # Auto-generated dal DB
    
    # Who
    tenant_id: UUID | None = None
    user_id: UUID | None = None
    user_email: str | None = None
    
    # What
    action: AuditAction
    entity_type: str | None = None  # "pratica", "document", "user", etc.
    entity_id: UUID | None = None
    
    # Details
    details: dict[str, Any] = Field(default_factory=dict)
    
    # Context
    ip_address: str | None = None
    user_agent: str | None = None
    request_id: str | None = None
    
    # When
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_log_dict(self) -> dict[str, Any]:
        """Converte in dict per structured logging."""
        return {
            "event": "audit",
            "action": self.action.value,
            "tenant_id": str(self.tenant_id) if self.tenant_id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "user_email": self.user_email,
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id) if self.entity_id else None,
            "details": self.details,
            "ip": self.ip_address,
            "user_agent": self.user_agent,
            "request_id": self.request_id,
            "timestamp": self.created_at.isoformat(),
        }


class AuditLogger:
    """Logger per audit trail.
    
    In produzione, salva anche su database.
    Per ora, log strutturato su stdout.
    
    Uso:
        audit = AuditLogger()
        
        audit.log(
            action=AuditAction.PRATICA_CREATE,
            user=current_user,
            entity_type="pratica",
            entity_id=pratica.id,
            details={"client_name": pratica.client_name}
        )
    """
    
    def __init__(self):
        self._db = None  # In futuro: database connection
    
    def log(
        self,
        action: AuditAction,
        user: Any | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> AuditEntry:
        """Registra un'azione nel log di audit.
        
        Args:
            action: Tipo di azione
            user: Utente che ha eseguito l'azione (con id, tenant_id, email)
            entity_type: Tipo di entità coinvolta
            entity_id: ID dell'entità
            details: Dettagli aggiuntivi
            ip_address: IP del client
            user_agent: User agent del browser
            request_id: ID della request per correlazione
            
        Returns:
            AuditEntry creata
        """
        entry = AuditEntry(
            tenant_id=getattr(user, "tenant_id", None) if user else None,
            user_id=getattr(user, "id", None) if user else None,
            user_email=getattr(user, "email", None) if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )
        
        # Log strutturato
        logger.info(
            f"{action.value}",
            extra=entry.to_log_dict(),
        )
        
        # TODO: Salva su database
        # await self._save_to_db(entry)
        
        return entry
    
    async def query(
        self,
        tenant_id: UUID | None = None,
        user_id: UUID | None = None,
        action: AuditAction | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEntry]:
        """Query sul log di audit.
        
        TODO: Implementare con query al database.
        """
        # Placeholder
        return []


# Singleton
_audit_logger: AuditLogger | None = None


def get_audit_logger() -> AuditLogger:
    """Ritorna l'audit logger singleton."""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


def log_action(
    action: AuditAction,
    user: Any | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    details: dict[str, Any] | None = None,
    **kwargs,
) -> AuditEntry:
    """Shortcut per loggare un'azione.
    
    Uso:
        log_action(
            AuditAction.PRATICA_CREATE,
            user=current_user,
            entity_type="pratica",
            entity_id=pratica.id,
        )
    """
    return get_audit_logger().log(
        action=action,
        user=user,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        **kwargs,
    )
