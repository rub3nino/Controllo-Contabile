"""Multi-tenancy per Quadra Enterprise.

Ogni studio di revisione è un tenant isolato con:
- Database isolato (Row-Level Security)
- Storage isolato (container separati)
- Configurazione specifica
"""

from backend.enterprise.tenants.context import (
    TenantContext,
    get_tenant_context,
    set_tenant_context,
    tenant_middleware,
)
from backend.enterprise.tenants.models import (
    Tenant,
    TenantSettings,
    TenantCreate,
    TenantUpdate,
)

__all__ = [
    "TenantContext",
    "get_tenant_context",
    "set_tenant_context",
    "tenant_middleware",
    "Tenant",
    "TenantSettings",
    "TenantCreate",
    "TenantUpdate",
]
