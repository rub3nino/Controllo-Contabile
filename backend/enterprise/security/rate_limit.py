"""Rate limiting con Redis.

Implementa sliding window rate limiting per:
- Per utente
- Per tenant
- Per IP
- Per endpoint
"""

from __future__ import annotations

import logging
import time
from typing import Callable
from uuid import UUID

import redis.asyncio as redis
from fastapi import HTTPException, Request, status

from backend.enterprise.config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """Rate limiter basato su Redis sliding window.
    
    Uso:
        limiter = RateLimiter()
        
        # Check se la richiesta è permessa
        allowed = await limiter.is_allowed(
            key="user:123:api",
            max_requests=100,
            window_seconds=60
        )
        
        if not allowed:
            raise HTTPException(429, "Too many requests")
    """
    
    KEY_PREFIX = "ratelimit"
    
    def __init__(self, redis_client: redis.Redis | None = None):
        self._redis = redis_client
    
    async def get_redis(self) -> redis.Redis:
        """Ritorna o crea il client Redis."""
        if self._redis is None:
            self._redis = await redis.from_url(
                str(settings.redis_url),
                decode_responses=True,
            )
        return self._redis
    
    def _key(self, identifier: str) -> str:
        """Genera la key Redis per un identificatore."""
        return f"{self.KEY_PREFIX}:{identifier}"
    
    async def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int = 60,
    ) -> tuple[bool, int, int]:
        """Verifica se una richiesta è permessa.
        
        Args:
            key: Identificatore univoco (es. "user:123:api")
            max_requests: Numero massimo di richieste nella finestra
            window_seconds: Durata della finestra in secondi
            
        Returns:
            Tuple (is_allowed, remaining, reset_in_seconds)
        """
        r = await self.get_redis()
        redis_key = self._key(key)
        
        now = time.time()
        window_start = now - window_seconds
        
        # Pipeline per atomicità
        pipe = r.pipeline()
        
        # Rimuovi entries vecchie
        pipe.zremrangebyscore(redis_key, 0, window_start)
        
        # Conta entries nella finestra
        pipe.zcard(redis_key)
        
        # Aggiungi questa richiesta
        pipe.zadd(redis_key, {str(now): now})
        
        # Imposta TTL
        pipe.expire(redis_key, window_seconds)
        
        results = await pipe.execute()
        current_count = results[1]
        
        remaining = max(0, max_requests - current_count - 1)
        
        # Calcola reset time
        oldest = await r.zrange(redis_key, 0, 0, withscores=True)
        if oldest:
            reset_in = int(oldest[0][1] + window_seconds - now)
        else:
            reset_in = window_seconds
        
        is_allowed = current_count < max_requests
        
        if not is_allowed:
            logger.warning(f"Rate limit exceeded for {key}")
        
        return is_allowed, remaining, reset_in
    
    async def reset(self, key: str) -> None:
        """Reset del contatore per una key."""
        r = await self.get_redis()
        await r.delete(self._key(key))


# Singleton
_rate_limiter: RateLimiter | None = None


async def get_rate_limiter() -> RateLimiter:
    """Ritorna il rate limiter singleton."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


def rate_limit(
    max_requests: int = 100,
    window_seconds: int = 60,
    key_func: Callable[[Request], str] | None = None,
):
    """Dependency per rate limiting su un endpoint.
    
    Args:
        max_requests: Numero massimo di richieste nella finestra
        window_seconds: Durata della finestra in secondi
        key_func: Funzione per generare la key (default: IP + endpoint)
        
    Uso:
        @app.get("/api/resource")
        async def get_resource(
            _: None = Depends(rate_limit(max_requests=10, window_seconds=60))
        ):
            ...
    """
    async def rate_limit_dependency(request: Request) -> None:
        limiter = await get_rate_limiter()
        
        # Genera key
        if key_func:
            key = key_func(request)
        else:
            # Default: IP + endpoint
            client_ip = request.client.host if request.client else "unknown"
            endpoint = request.url.path
            key = f"ip:{client_ip}:{endpoint}"
        
        is_allowed, remaining, reset_in = await limiter.is_allowed(
            key=key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        
        # Aggiungi headers per informare il client
        request.state.rate_limit_remaining = remaining
        request.state.rate_limit_reset = reset_in
        
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Troppe richieste. Riprova tra poco.",
                headers={
                    "Retry-After": str(reset_in),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_in),
                },
            )
    
    return rate_limit_dependency


def rate_limit_by_user(
    max_requests: int = 100,
    window_seconds: int = 60,
):
    """Rate limit per utente autenticato."""
    def key_func(request: Request) -> str:
        user = getattr(request.state, "user", None)
        if user:
            return f"user:{user.id}:api"
        # Fallback su IP
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}:api"
    
    return rate_limit(max_requests, window_seconds, key_func)


def rate_limit_by_tenant(
    max_requests: int = 1000,
    window_seconds: int = 60,
):
    """Rate limit per tenant."""
    def key_func(request: Request) -> str:
        user = getattr(request.state, "user", None)
        if user:
            return f"tenant:{user.tenant_id}:api"
        # Fallback su IP
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}:api"
    
    return rate_limit(max_requests, window_seconds, key_func)
