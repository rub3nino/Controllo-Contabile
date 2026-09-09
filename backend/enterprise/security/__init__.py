"""Security module per Quadra Enterprise.

Contiene:
- Audit logging
- Rate limiting
- Security headers
- Input sanitization
"""

from backend.enterprise.security.audit import (
    AuditLogger,
    AuditAction,
    log_action,
)
from backend.enterprise.security.rate_limit import (
    RateLimiter,
    rate_limit,
)
from backend.enterprise.security.headers import (
    SecurityHeaders,
    security_headers_middleware,
)

__all__ = [
    "AuditLogger",
    "AuditAction",
    "log_action",
    "RateLimiter",
    "rate_limit",
    "SecurityHeaders",
    "security_headers_middleware",
]
