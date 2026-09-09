"""Redis connection manager.

Gestisce la connessione a Redis per:
- Cache
- Session storage
- Rate limiting
- Celery broker (indirettamente)

In sviluppo, può usare una cache in memoria se Redis non è disponibile.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Any, Protocol, runtime_checkable

from backend.core.config import settings

logger = logging.getLogger(__name__)


@runtime_checkable
class CacheBackend(Protocol):
    """Interfaccia per cache backend."""
    
    async def get(self, key: str) -> Any | None:
        """Recupera un valore. Ritorna None se non esiste o scaduto."""
        ...
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: int | timedelta | None = None,
    ) -> bool:
        """Salva un valore con opzionale TTL in secondi."""
        ...
    
    async def delete(self, key: str) -> bool:
        """Elimina una chiave."""
        ...
    
    async def exists(self, key: str) -> bool:
        """Verifica se una chiave esiste."""
        ...
    
    async def incr(self, key: str, amount: int = 1) -> int:
        """Incrementa un contatore atomicamente."""
        ...
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Imposta TTL su una chiave esistente."""
        ...
    
    async def ttl(self, key: str) -> int:
        """Ritorna TTL rimanente in secondi (-1 se no TTL, -2 se non esiste)."""
        ...


class RedisCache:
    """Cache backend basato su Redis.
    
    Usato in staging e produzione.
    """
    
    def __init__(self, url: str):
        try:
            import redis.asyncio as redis
        except ImportError:
            raise ImportError("redis package required. Install with: pip install redis")
        
        self._redis = redis.from_url(url, decode_responses=True)
        self._url = url
        logger.info(f"RedisCache initialized: {url.split('@')[-1] if '@' in url else url}")
    
    async def ping(self) -> bool:
        """Verifica connessione."""
        try:
            return await self._redis.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            return False
    
    async def get(self, key: str) -> Any | None:
        value = await self._redis.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: int | timedelta | None = None,
    ) -> bool:
        if isinstance(expire, timedelta):
            expire = int(expire.total_seconds())
        
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        
        return await self._redis.set(key, value, ex=expire)
    
    async def delete(self, key: str) -> bool:
        return bool(await self._redis.delete(key))
    
    async def exists(self, key: str) -> bool:
        return bool(await self._redis.exists(key))
    
    async def incr(self, key: str, amount: int = 1) -> int:
        return await self._redis.incrby(key, amount)
    
    async def expire(self, key: str, seconds: int) -> bool:
        return await self._redis.expire(key, seconds)
    
    async def ttl(self, key: str) -> int:
        return await self._redis.ttl(key)
    
    async def close(self):
        """Chiude la connessione."""
        await self._redis.close()
    
    # Metodi aggiuntivi per use case specifici
    
    async def get_json(self, key: str) -> dict | list | None:
        """Recupera e decodifica JSON."""
        value = await self._redis.get(key)
        if value is None:
            return None
        return json.loads(value)
    
    async def set_json(
        self,
        key: str,
        value: dict | list,
        expire: int | None = None,
    ) -> bool:
        """Salva come JSON."""
        return await self._redis.set(key, json.dumps(value), ex=expire)
    
    async def keys(self, pattern: str) -> list[str]:
        """Lista chiavi con pattern (usa con cautela)."""
        return await self._redis.keys(pattern)
    
    async def mget(self, keys: list[str]) -> list[Any]:
        """Recupera più chiavi atomicamente."""
        values = await self._redis.mget(keys)
        return [
            json.loads(v) if v and v.startswith('{') else v
            for v in values
        ]


class MemoryCache:
    """Cache in memoria.
    
    Usato in sviluppo quando Redis non è disponibile.
    ATTENZIONE: Non persiste tra restart e non supporta multi-processo.
    """
    
    def __init__(self):
        import time
        self._store: dict[str, tuple[Any, float | None]] = {}
        self._time = time.time
        logger.warning("MemoryCache initialized - NOT FOR PRODUCTION")
    
    def _is_expired(self, key: str) -> bool:
        if key not in self._store:
            return True
        _, expire_at = self._store[key]
        if expire_at is None:
            return False
        return self._time() > expire_at
    
    async def get(self, key: str) -> Any | None:
        if self._is_expired(key):
            self._store.pop(key, None)
            return None
        return self._store[key][0]
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: int | timedelta | None = None,
    ) -> bool:
        if isinstance(expire, timedelta):
            expire = int(expire.total_seconds())
        
        expire_at = self._time() + expire if expire else None
        self._store[key] = (value, expire_at)
        return True
    
    async def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None
    
    async def exists(self, key: str) -> bool:
        return not self._is_expired(key)
    
    async def incr(self, key: str, amount: int = 1) -> int:
        current = await self.get(key) or 0
        new_value = int(current) + amount
        # Preserva TTL se esiste
        expire_at = self._store.get(key, (None, None))[1]
        expire = int(expire_at - self._time()) if expire_at else None
        await self.set(key, new_value, expire)
        return new_value
    
    async def expire(self, key: str, seconds: int) -> bool:
        if key not in self._store:
            return False
        value, _ = self._store[key]
        self._store[key] = (value, self._time() + seconds)
        return True
    
    async def ttl(self, key: str) -> int:
        if key not in self._store:
            return -2
        _, expire_at = self._store[key]
        if expire_at is None:
            return -1
        remaining = int(expire_at - self._time())
        return max(remaining, 0)
    
    async def ping(self) -> bool:
        return True
    
    async def close(self):
        self._store.clear()


# ==========================================
# Factory
# ==========================================

_cache: CacheBackend | None = None


async def get_redis() -> CacheBackend:
    """Ritorna il cache backend configurato (singleton)."""
    global _cache
    
    if _cache is not None:
        return _cache
    
    if settings.use_memory_cache:
        _cache = MemoryCache()
    else:
        _cache = RedisCache(settings.redis_url)
        # Verifica connessione
        if not await _cache.ping():
            logger.warning("Redis not available, falling back to MemoryCache")
            _cache = MemoryCache()
    
    return _cache


async def close_redis() -> None:
    """Chiude la connessione Redis."""
    global _cache
    if _cache is not None:
        await _cache.close()
        _cache = None


def reset_redis() -> None:
    """Reset del singleton (per test)."""
    global _cache
    _cache = None
