"""Database connection manager.

Gestisce la connessione a PostgreSQL con supporto per:
- Connection pooling
- Async operations  
- Multi-tenant Row-Level Security (RLS)
- Migrations con Alembic

In sviluppo, può usare SQLite se configurato.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from backend.core.config import settings

logger = logging.getLogger(__name__)


# ==========================================
# SQLAlchemy Setup
# ==========================================

def get_database_url() -> str:
    """Ritorna la connection string appropriata."""
    if settings.use_sqlite:
        return f"sqlite+aiosqlite:///{settings.sqlite_path}"
    
    # Converti postgresql:// in postgresql+asyncpg://
    url = settings.database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    return url


async def create_engine():
    """Crea l'engine SQLAlchemy async."""
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
    except ImportError:
        raise ImportError(
            "SQLAlchemy async support required. "
            "Install with: pip install sqlalchemy[asyncio] asyncpg aiosqlite"
        )
    
    url = get_database_url()
    
    if settings.use_sqlite:
        engine = create_async_engine(
            url,
            echo=settings.debug,
        )
    else:
        engine = create_async_engine(
            url,
            echo=settings.debug,
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_pre_ping=True,  # Verifica connessione prima di usarla
        )
    
    logger.info(f"Database engine created: {url.split('@')[-1] if '@' in url else url}")
    return engine


async def create_session_factory():
    """Crea la session factory."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    engine = await create_engine()
    
    return sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


# ==========================================
# Dependency Injection per FastAPI
# ==========================================

_engine = None
_session_factory = None


async def init_database() -> None:
    """Inizializza connessione database (chiamare all'avvio app)."""
    global _engine, _session_factory
    
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    url = get_database_url()
    
    if settings.use_sqlite:
        _engine = create_async_engine(url, echo=settings.debug)
    else:
        _engine = create_async_engine(
            url,
            echo=settings.debug,
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_pre_ping=True,
        )
    
    _session_factory = sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    logger.info("Database initialized")


async def close_database() -> None:
    """Chiude connessione database."""
    global _engine, _session_factory
    
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database connection closed")


@asynccontextmanager
async def get_session():
    """Context manager per sessione database.
    
    Uso:
        async with get_session() as session:
            result = await session.execute(query)
    """
    if _session_factory is None:
        await init_database()
    
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db():
    """Dependency per FastAPI.
    
    Uso:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    if _session_factory is None:
        await init_database()
    
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ==========================================
# Multi-Tenant RLS Helper
# ==========================================

async def set_tenant_context(session, tenant_id: str) -> None:
    """Imposta il tenant corrente per RLS.
    
    PostgreSQL RLS usa questa variabile per filtrare automaticamente
    tutte le query per tenant.
    
    Uso:
        async with get_session() as session:
            await set_tenant_context(session, "tenant-123")
            # Tutte le query ora vedono solo dati di tenant-123
    """
    if settings.use_sqlite:
        # SQLite non supporta RLS, il filtro va fatto manualmente
        logger.warning("RLS not supported in SQLite mode")
        return
    
    await session.execute(
        f"SET app.current_tenant = '{tenant_id}'"
    )


async def clear_tenant_context(session) -> None:
    """Rimuove il tenant context (per operazioni cross-tenant)."""
    if settings.use_sqlite:
        return
    
    await session.execute("RESET app.current_tenant")


# ==========================================
# Health Check
# ==========================================

async def check_database_health() -> dict:
    """Verifica salute database."""
    try:
        async with get_session() as session:
            if settings.use_sqlite:
                result = await session.execute("SELECT 1")
            else:
                result = await session.execute("SELECT 1")
            
            return {
                "status": "healthy",
                "type": "sqlite" if settings.use_sqlite else "postgresql",
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
