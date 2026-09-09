"""Autenticazione Microsoft Entra ID per Quadra Enterprise.

Questo modulo gestisce:
- Login/logout via Microsoft OAuth2/OIDC
- Verifica JWT tokens
- Session management con Redis
- RBAC (Role-Based Access Control)
"""

from backend.enterprise.auth.microsoft import MicrosoftAuthProvider
from backend.enterprise.auth.dependencies import (
    get_current_user,
    get_current_user_optional,
    require_auth,
    require_role,
)
from backend.enterprise.auth.models import (
    User,
    UserRole,
    Session,
    TokenPair,
)
from backend.enterprise.auth.session import SessionManager

__all__ = [
    "MicrosoftAuthProvider",
    "get_current_user",
    "get_current_user_optional",
    "require_auth",
    "require_role",
    "User",
    "UserRole",
    "Session",
    "TokenPair",
    "SessionManager",
]
