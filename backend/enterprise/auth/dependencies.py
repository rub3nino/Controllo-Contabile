"""FastAPI dependencies per autenticazione."""

from __future__ import annotations

import logging
from functools import wraps
from typing import Annotated, Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.enterprise.auth.models import User, UserRole, AuthError, PermissionDenied
from backend.enterprise.auth.session import get_session_manager, SessionManager
from backend.enterprise.auth.jwt import decode_access_token
from backend.enterprise.config import settings

logger = logging.getLogger(__name__)

# Security scheme per Swagger UI
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User | None:
    """Dependency che ritorna l'utente corrente se autenticato, None altrimenti.
    
    Usa questa dependency per endpoint che funzionano sia con che senza auth.
    """
    if not credentials:
        return None
    
    try:
        # Decodifica il JWT
        payload = decode_access_token(credentials.credentials)
        
        # Recupera la sessione da Redis per verificare che sia ancora valida
        session_manager = await get_session_manager()
        session = await session_manager.get_by_token_hash(
            user_id=payload["sub"],
            token_hash=payload["jti"],
        )
        
        if not session:
            return None
        
        # Aggiorna attività
        await session_manager.update_activity(session.user_id, session.id)
        
        # Costruisci l'oggetto User
        # In produzione, questo verrebbe dal database
        user = User(
            id=session.user_id,
            tenant_id=session.tenant_id,
            azure_oid=payload.get("azure_oid", ""),
            email=payload.get("email", ""),
            display_name=payload.get("name", ""),
            role=session.role,
            is_super_admin=settings.is_super_admin(payload.get("email", "")),
        )
        
        # Salva l'utente nella request per usi successivi
        request.state.user = user
        
        return user
        
    except Exception as e:
        logger.warning(f"Auth failed: {e}")
        return None


async def get_current_user(
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    """Dependency che richiede un utente autenticato.
    
    Solleva 401 se l'utente non è autenticato.
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticazione richiesta",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_auth(func: Callable) -> Callable:
    """Decorator per richiedere autenticazione su un endpoint.
    
    Uso:
        @app.get("/protected")
        @require_auth
        async def protected_endpoint(user: User = Depends(get_current_user)):
            ...
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    return wrapper


def require_role(*roles: UserRole):
    """Dependency factory per richiedere specifici ruoli.
    
    Uso:
        @app.get("/admin-only")
        async def admin_endpoint(
            user: User = Depends(require_role(UserRole.TENANT_ADMIN))
        ):
            ...
    """
    async def role_checker(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        # Super admin può accedere a tutto
        if user.is_super_admin:
            return user
        
        # Verifica se il ruolo dell'utente è sufficiente
        for required_role in roles:
            if user.role.can_access(required_role):
                return user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Ruolo richiesto: {', '.join(r.value for r in roles)}",
        )
    
    return role_checker


def require_super_admin():
    """Dependency per endpoint riservati al super admin (solo tu).
    
    Uso:
        @app.get("/super-admin-only")
        async def super_admin_endpoint(
            user: User = Depends(require_super_admin())
        ):
            ...
    """
    async def super_admin_checker(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not user.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accesso riservato al super admin",
            )
        return user
    
    return super_admin_checker


def require_tenant_access(tenant_id_param: str = "tenant_id"):
    """Dependency per verificare accesso a un tenant specifico.
    
    Verifica che l'utente appartenga al tenant richiesto o sia super admin.
    
    Uso:
        @app.get("/tenants/{tenant_id}/users")
        async def get_tenant_users(
            tenant_id: UUID,
            user: User = Depends(require_tenant_access("tenant_id"))
        ):
            ...
    """
    async def tenant_checker(
        request: Request,
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        # Super admin accede a tutti i tenant
        if user.is_super_admin:
            return user
        
        # Estrai tenant_id dal path
        tenant_id = request.path_params.get(tenant_id_param)
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parametro {tenant_id_param} mancante",
            )
        
        # Verifica appartenenza
        if str(user.tenant_id) != str(tenant_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Non hai accesso a questo tenant",
            )
        
        return user
    
    return tenant_checker


# Type alias per annotazioni pulite
CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]
TenantAdmin = Annotated[User, Depends(require_role(UserRole.TENANT_ADMIN))]
Manager = Annotated[User, Depends(require_role(UserRole.MANAGER))]
SuperAdmin = Annotated[User, Depends(require_super_admin())]
