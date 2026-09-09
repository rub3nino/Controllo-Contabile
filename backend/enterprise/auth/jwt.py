"""JWT token management."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from backend.enterprise.config import settings
from backend.enterprise.auth.models import User, TokenPair, AuthError


def create_access_token(
    user: User,
    expires_delta: timedelta | None = None,
) -> tuple[str, str]:
    """Crea un access token JWT.
    
    Args:
        user: Utente per cui creare il token
        expires_delta: Durata custom (default da settings)
        
    Returns:
        Tuple (token, jti) dove jti è l'ID univoco del token
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    
    jti = secrets.token_urlsafe(32)
    
    payload = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "email": user.email,
        "name": user.display_name,
        "role": user.role.value,
        "azure_oid": user.azure_oid,
        "jti": hashlib.sha256(jti.encode()).hexdigest(),  # Hash per storage
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + expires_delta,
        "type": "access",
    }
    
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    
    return token, payload["jti"]


def create_refresh_token(
    user: User,
    expires_delta: timedelta | None = None,
) -> str:
    """Crea un refresh token JWT.
    
    Args:
        user: Utente per cui creare il token
        expires_delta: Durata custom (default da settings)
        
    Returns:
        Refresh token JWT
    """
    if expires_delta is None:
        expires_delta = timedelta(days=settings.jwt_refresh_token_expire_days)
    
    payload = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "jti": secrets.token_urlsafe(32),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + expires_delta,
        "type": "refresh",
    }
    
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_token_pair(user: User) -> tuple[TokenPair, str]:
    """Crea una coppia access + refresh token.
    
    Args:
        user: Utente per cui creare i token
        
    Returns:
        Tuple (TokenPair, token_hash) dove token_hash serve per la sessione
    """
    access_token, token_hash = create_access_token(user)
    refresh_token = create_refresh_token(user)
    
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    ), token_hash


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica e valida un access token.
    
    Args:
        token: JWT token da decodificare
        
    Returns:
        Payload del token
        
    Raises:
        AuthError: Se il token non è valido o è scaduto
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        
        if payload.get("type") != "access":
            raise AuthError("Token type non valido", code="invalid_token_type")
        
        return payload
        
    except ExpiredSignatureError:
        raise AuthError("Token scaduto", code="token_expired")
    except InvalidTokenError as e:
        raise AuthError(f"Token non valido: {e}", code="invalid_token")


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decodifica e valida un refresh token.
    
    Args:
        token: JWT refresh token
        
    Returns:
        Payload del token
        
    Raises:
        AuthError: Se il token non è valido o è scaduto
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        
        if payload.get("type") != "refresh":
            raise AuthError("Token type non valido", code="invalid_token_type")
        
        return payload
        
    except ExpiredSignatureError:
        raise AuthError("Refresh token scaduto", code="refresh_token_expired")
    except InvalidTokenError as e:
        raise AuthError(f"Refresh token non valido: {e}", code="invalid_refresh_token")


def verify_token_hash(token: str, stored_hash: str) -> bool:
    """Verifica che l'hash del token corrisponda a quello stored."""
    computed_hash = hashlib.sha256(token.encode()).hexdigest()
    return secrets.compare_digest(computed_hash, stored_hash)
