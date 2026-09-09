"""Storage abstraction layer.

Permette di usare diversi backend di storage con la stessa interfaccia:
- LocalStorage: filesystem locale (sviluppo)
- MinIOStorage: MinIO S3-compatible (staging/produzione)
- S3Storage: AWS S3 (futuro)

Uso:
    from backend.core import get_storage
    
    storage = get_storage()
    
    # Upload
    await storage.upload("tenant-a/pratica-123/doc.pdf", file_bytes)
    
    # Download
    data = await storage.download("tenant-a/pratica-123/doc.pdf")
    
    # Delete
    await storage.delete("tenant-a/pratica-123/doc.pdf")
    
    # List
    files = await storage.list("tenant-a/pratica-123/")
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import AsyncIterator, BinaryIO, Protocol, runtime_checkable

from backend.core.config import settings

logger = logging.getLogger(__name__)


@runtime_checkable
class StorageBackend(Protocol):
    """Interfaccia per storage backend."""
    
    async def upload(
        self,
        path: str,
        data: bytes | BinaryIO,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Carica un file. Ritorna il path completo."""
        ...
    
    async def download(self, path: str) -> bytes:
        """Scarica un file. Solleva FileNotFoundError se non esiste."""
        ...
    
    async def delete(self, path: str) -> bool:
        """Elimina un file. Ritorna True se eliminato, False se non esisteva."""
        ...
    
    async def exists(self, path: str) -> bool:
        """Verifica se un file esiste."""
        ...
    
    async def list(self, prefix: str = "") -> list[str]:
        """Lista i file con un certo prefisso."""
        ...
    
    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """Genera URL pre-firmato per accesso diretto (se supportato)."""
        ...


class LocalStorage:
    """Storage su filesystem locale.
    
    Ideale per sviluppo. I file vengono salvati in una cartella locale.
    """
    
    def __init__(self, base_path: str | Path):
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalStorage initialized at {self.base_path}")
    
    def _full_path(self, path: str) -> Path:
        """Risolve il path completo, prevenendo path traversal."""
        # Normalizza e previeni path traversal
        clean_path = Path(path).as_posix().lstrip("/")
        full = (self.base_path / clean_path).resolve()
        
        # Verifica che sia dentro base_path
        if not str(full).startswith(str(self.base_path)):
            raise ValueError(f"Invalid path: {path}")
        
        return full
    
    async def upload(
        self,
        path: str,
        data: bytes | BinaryIO,
        content_type: str = "application/octet-stream",
    ) -> str:
        full_path = self._full_path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        if isinstance(data, bytes):
            full_path.write_bytes(data)
        else:
            full_path.write_bytes(data.read())
        
        logger.debug(f"Uploaded {path} ({full_path.stat().st_size} bytes)")
        return path
    
    async def download(self, path: str) -> bytes:
        full_path = self._full_path(path)
        
        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        return full_path.read_bytes()
    
    async def delete(self, path: str) -> bool:
        full_path = self._full_path(path)
        
        if not full_path.exists():
            return False
        
        full_path.unlink()
        logger.debug(f"Deleted {path}")
        return True
    
    async def exists(self, path: str) -> bool:
        return self._full_path(path).exists()
    
    async def list(self, prefix: str = "") -> list[str]:
        base = self._full_path(prefix) if prefix else self.base_path
        
        if not base.exists():
            return []
        
        if base.is_file():
            return [prefix]
        
        result = []
        for item in base.rglob("*"):
            if item.is_file():
                rel = item.relative_to(self.base_path)
                result.append(str(rel))
        
        return sorted(result)
    
    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        # Per LocalStorage, ritorna un path file://
        # In produzione, l'API servirà il file
        return f"file://{self._full_path(path)}"


class MinIOStorage:
    """Storage su MinIO (S3-compatible).
    
    Usato in staging e produzione. Compatibile anche con AWS S3.
    """
    
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False,
    ):
        try:
            from minio import Minio
            from minio.error import S3Error
        except ImportError:
            raise ImportError("minio package required. Install with: pip install minio")
        
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self.bucket = bucket
        self._ensure_bucket()
        logger.info(f"MinIOStorage initialized: {endpoint}/{bucket}")
    
    def _ensure_bucket(self):
        """Crea il bucket se non esiste."""
        from minio.error import S3Error
        
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to create bucket: {e}")
            raise
    
    async def upload(
        self,
        path: str,
        data: bytes | BinaryIO,
        content_type: str = "application/octet-stream",
    ) -> str:
        from io import BytesIO
        
        if isinstance(data, bytes):
            data_io = BytesIO(data)
            length = len(data)
        else:
            data.seek(0, 2)  # End
            length = data.tell()
            data.seek(0)  # Start
            data_io = data
        
        # MinIO è sincrono, eseguiamo in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.client.put_object(
                self.bucket,
                path,
                data_io,
                length,
                content_type=content_type,
            )
        )
        
        logger.debug(f"Uploaded to MinIO: {path}")
        return path
    
    async def download(self, path: str) -> bytes:
        from minio.error import S3Error
        
        loop = asyncio.get_event_loop()
        
        try:
            response = await loop.run_in_executor(
                None,
                lambda: self.client.get_object(self.bucket, path)
            )
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise FileNotFoundError(f"File not found: {path}")
            raise
    
    async def delete(self, path: str) -> bool:
        from minio.error import S3Error
        
        loop = asyncio.get_event_loop()
        
        try:
            await loop.run_in_executor(
                None,
                lambda: self.client.remove_object(self.bucket, path)
            )
            return True
        except S3Error:
            return False
    
    async def exists(self, path: str) -> bool:
        from minio.error import S3Error
        
        loop = asyncio.get_event_loop()
        
        try:
            await loop.run_in_executor(
                None,
                lambda: self.client.stat_object(self.bucket, path)
            )
            return True
        except S3Error:
            return False
    
    async def list(self, prefix: str = "") -> list[str]:
        loop = asyncio.get_event_loop()
        
        objects = await loop.run_in_executor(
            None,
            lambda: list(self.client.list_objects(self.bucket, prefix=prefix, recursive=True))
        )
        
        return [obj.object_name for obj in objects]
    
    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        from datetime import timedelta
        
        loop = asyncio.get_event_loop()
        
        url = await loop.run_in_executor(
            None,
            lambda: self.client.presigned_get_object(
                self.bucket,
                path,
                expires=timedelta(seconds=expires_in)
            )
        )
        
        return url


# ==========================================
# Factory
# ==========================================

_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """Ritorna il backend di storage configurato (singleton)."""
    global _storage
    
    if _storage is not None:
        return _storage
    
    backend = settings.storage_backend
    
    if backend == "local":
        _storage = LocalStorage(settings.storage_local_path)
    
    elif backend == "minio":
        _storage = MinIOStorage(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            bucket=settings.minio_bucket,
            secure=settings.minio_secure,
        )
    
    elif backend == "s3":
        # Per ora usa MinIO client che è S3-compatible
        _storage = MinIOStorage(
            endpoint=f"s3.{settings.s3_region}.amazonaws.com",
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            bucket=settings.minio_bucket,
            secure=True,
        )
    
    else:
        raise ValueError(f"Unknown storage backend: {backend}")
    
    return _storage


def reset_storage() -> None:
    """Reset del singleton (per test)."""
    global _storage
    _storage = None
