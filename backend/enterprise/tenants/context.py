"""Tenant context per multi-tenancy.

Il TenantContext viene impostato dal middleware su ogni request
e usato per:
- Filtrare le query (RLS)
- Determinare lo storage bucket
- Applicare configurazioni tenant-specific
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import Any
from uuid import UUID

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from backend.enterprise.tenants.models import Tenant, TenantSettings

logger = logging.getLogger(__name__)

# Context variable per il tenant corrente
_tenant_context: ContextVar[dict[str, Any] | None] = ContextVar(
    "tenant_context", default=None
)


class TenantContext:
    """Context del tenant corrente nella request.
    
    Uso:
        ctx = get_tenant_context()
        tenant_id = ctx.tenant_id
        settings = ctx.settings
    """
    
    def __init__(
        self,
        tenant_id: UUID,
        tenant_slug: str,
        settings: TenantSettings,
    ):
        self.tenant_id = tenant_id
        self.tenant_slug = tenant_slug
        self.settings = settings
    
    @property
    def storage_container(self) -> str:
        """Nome del container storage per questo tenant."""
        return f"tenant-{self.tenant_slug}"
    
    def has_feature(self, feature: str) -> bool:
        """Verifica se una feature è abilitata per il tenant."""
        return feature in self.settings.features
    
    def check_limit(self, resource: str, current: int) -> bool:
        """Verifica se un limite è stato raggiunto.
        
        Args:
            resource: "users" | "storage_gb" | "pratiche_active"
            current: Valore corrente
            
        Returns:
            True se sotto il limite, False se raggiunto
        """
        limits = {
            "users": self.settings.max_users,
            "storage_gb": self.settings.max_storage_gb,
            "pratiche_active": self.settings.max_pratiche_active,
        }
        max_value = limits.get(resource)
        if max_value is None:
            return True
        return current < max_value


def get_tenant_context() -> TenantContext | None:
    """Ritorna il TenantContext della request corrente."""
    ctx_data = _tenant_context.get()
    if ctx_data is None:
        return None
    return TenantContext(**ctx_data)


def set_tenant_context(context: TenantContext | None) -> None:
    """Imposta il TenantContext per la request corrente."""
    if context is None:
        _tenant_context.set(None)
    else:
        _tenant_context.set({
            "tenant_id": context.tenant_id,
            "tenant_slug": context.tenant_slug,
            "settings": context.settings,
        })


class TenantMiddleware(BaseHTTPMiddleware):
    """Middleware che imposta il tenant context da auth.
    
    Deve essere eseguito DOPO l'auth middleware.
    """
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        # Reset context
        set_tenant_context(None)
        
        # Se c'è un utente autenticato, imposta il suo tenant
        user = getattr(request.state, "user", None)
        
        if user:
            # In produzione, caricare da database o cache
            # Per ora, creiamo un context di default
            context = TenantContext(
                tenant_id=user.tenant_id,
                tenant_slug=str(user.tenant_id)[:8],  # Placeholder
                settings=TenantSettings(),
            )
            set_tenant_context(context)
            
            # Passa il tenant_id alla request per query RLS
            request.state.tenant_id = user.tenant_id
        
        response = await call_next(request)
        
        # Cleanup
        set_tenant_context(None)
        
        return response


# Alias per comodità
tenant_middleware = TenantMiddleware


def require_feature(feature: str):
    """Dependency per richiedere una feature abilitata.
    
    Uso:
        @app.get("/jet-analysis")
        async def jet_analysis(
            _: None = Depends(require_feature("jet_analysis"))
        ):
            ...
    """
    from fastapi import Depends, HTTPException, status
    
    async def feature_checker() -> None:
        ctx = get_tenant_context()
        if ctx is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Autenticazione richiesta",
            )
        
        if not ctx.has_feature(feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature}' non abilitata per questo studio",
            )
    
    return feature_checker
