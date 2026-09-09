"""Enterprise module per Quadra SaaS multi-tenant.

Questo modulo contiene:
- auth/: Autenticazione Microsoft Entra ID
- tenants/: Gestione multi-tenant
- admin/: Admin panel e audit
- security/: Rate limiting, RBAC, audit logging
"""

from backend.enterprise.auth import (
    get_current_user,
    require_auth,
    require_role,
    MicrosoftAuthProvider,
)
from backend.enterprise.tenants import (
    TenantContext,
    get_tenant_context,
    tenant_middleware,
)
from backend.enterprise.security import (
    AuditLogger,
    RateLimiter,
    SecurityHeaders,
)

__all__ = [
    # Auth
    "get_current_user",
    "require_auth",
    "require_role",
    "MicrosoftAuthProvider",
    # Tenants
    "TenantContext",
    "get_tenant_context",
    "tenant_middleware",
    # Security
    "AuditLogger",
    "RateLimiter",
    "SecurityHeaders",
]
