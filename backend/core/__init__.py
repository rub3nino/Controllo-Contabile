"""Core module — Configurazione e connessioni condivise.

Questo modulo contiene:
- config.py: Settings da environment (12-factor app)
- database.py: Connessione PostgreSQL
- redis.py: Connessione Redis  
- storage.py: Storage abstraction (locale/MinIO/S3)
"""

from backend.core.config import get_settings, settings
from backend.core.storage import get_storage, StorageBackend

__all__ = [
    "get_settings",
    "settings",
    "get_storage",
    "StorageBackend",
]
