"""Session management con Redis."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import redis.asyncio as redis

from backend.enterprise.config import settings
from backend.enterprise.auth.models import Session, User, UserRole

logger = logging.getLogger(__name__)


class SessionManager:
    """Gestisce le sessioni utente in Redis.
    
    Ogni sessione è un hash Redis con:
    - Dati utente (id, tenant, role)
    - Security info (token hash, IP, user agent)
    - Timestamps (created, expires, last activity)
    
    Key format: session:{user_id}:{session_id}
    """
    
    KEY_PREFIX = "session"
    
    def __init__(self, redis_client: redis.Redis | None = None):
        self._redis = redis_client
    
    async def get_redis(self) -> redis.Redis:
        """Ritorna o crea il client Redis."""
        if self._redis is None:
            self._redis = await redis.from_url(
                str(settings.redis_url),
                db=settings.redis_session_db,
                decode_responses=True,
            )
        return self._redis
    
    def _session_key(self, user_id: UUID, session_id: str) -> str:
        """Genera la key Redis per una sessione."""
        return f"{self.KEY_PREFIX}:{user_id}:{session_id}"
    
    def _user_sessions_pattern(self, user_id: UUID) -> str:
        """Pattern per trovare tutte le sessioni di un utente."""
        return f"{self.KEY_PREFIX}:{user_id}:*"
    
    async def create(
        self,
        user: User,
        token_hash: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        max_age_seconds: int | None = None,
    ) -> Session:
        """Crea una nuova sessione.
        
        Args:
            user: Utente autenticato
            token_hash: Hash del JWT token
            ip_address: IP del client
            user_agent: User agent del browser
            max_age_seconds: Durata sessione (default da settings)
            
        Returns:
            Session creata
        """
        max_age = max_age_seconds or settings.session_max_age_seconds
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=max_age)
        
        session = Session(
            user_id=user.id,
            tenant_id=user.tenant_id,
            role=user.role,
            token_hash=token_hash,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=expires_at,
        )
        
        r = await self.get_redis()
        key = self._session_key(user.id, session.id)
        
        # Salva come JSON
        await r.setex(
            key,
            max_age,
            session.model_dump_json(),
        )
        
        logger.info(f"Session created for user {user.id}: {session.id}")
        return session
    
    async def get(self, user_id: UUID, session_id: str) -> Session | None:
        """Recupera una sessione.
        
        Args:
            user_id: ID utente
            session_id: ID sessione
            
        Returns:
            Session se esiste e non scaduta, None altrimenti
        """
        r = await self.get_redis()
        key = self._session_key(user_id, session_id)
        
        data = await r.get(key)
        if not data:
            return None
        
        session = Session.model_validate_json(data)
        
        if session.is_expired():
            await self.delete(user_id, session_id)
            return None
        
        return session
    
    async def get_by_token_hash(self, user_id: UUID, token_hash: str) -> Session | None:
        """Trova una sessione dal token hash.
        
        Args:
            user_id: ID utente
            token_hash: Hash del token
            
        Returns:
            Session se trovata, None altrimenti
        """
        r = await self.get_redis()
        pattern = self._user_sessions_pattern(user_id)
        
        async for key in r.scan_iter(match=pattern):
            data = await r.get(key)
            if data:
                session = Session.model_validate_json(data)
                if session.token_hash == token_hash and not session.is_expired():
                    return session
        
        return None
    
    async def update_activity(self, user_id: UUID, session_id: str) -> None:
        """Aggiorna il timestamp di ultima attività.
        
        Args:
            user_id: ID utente
            session_id: ID sessione
        """
        session = await self.get(user_id, session_id)
        if session:
            session.last_activity = datetime.now(timezone.utc)
            
            r = await self.get_redis()
            key = self._session_key(user_id, session_id)
            ttl = await r.ttl(key)
            
            if ttl > 0:
                await r.setex(key, ttl, session.model_dump_json())
    
    async def delete(self, user_id: UUID, session_id: str) -> bool:
        """Elimina una sessione (logout).
        
        Returns:
            True se eliminata, False se non esisteva
        """
        r = await self.get_redis()
        key = self._session_key(user_id, session_id)
        
        deleted = await r.delete(key)
        
        if deleted:
            logger.info(f"Session deleted: {session_id}")
        
        return deleted > 0
    
    async def delete_all_for_user(self, user_id: UUID) -> int:
        """Elimina tutte le sessioni di un utente (force logout).
        
        Returns:
            Numero di sessioni eliminate
        """
        r = await self.get_redis()
        pattern = self._user_sessions_pattern(user_id)
        
        keys = []
        async for key in r.scan_iter(match=pattern):
            keys.append(key)
        
        if keys:
            deleted = await r.delete(*keys)
            logger.info(f"Deleted {deleted} sessions for user {user_id}")
            return deleted
        
        return 0
    
    async def list_user_sessions(self, user_id: UUID) -> list[Session]:
        """Lista tutte le sessioni attive di un utente.
        
        Returns:
            Lista di Session
        """
        r = await self.get_redis()
        pattern = self._user_sessions_pattern(user_id)
        
        sessions = []
        async for key in r.scan_iter(match=pattern):
            data = await r.get(key)
            if data:
                session = Session.model_validate_json(data)
                if not session.is_expired():
                    sessions.append(session)
        
        return sessions
    
    async def close(self) -> None:
        """Chiude la connessione Redis."""
        if self._redis:
            await self._redis.close()


# Singleton
_session_manager: SessionManager | None = None


async def get_session_manager() -> SessionManager:
    """Ritorna il session manager singleton."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
