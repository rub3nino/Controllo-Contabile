"""Contratti dati condivisi (Fase 0 del redesign). Vedi backend/domain/models.py.

Package isolato da backend/*.py esistenti: nessun modulo qui viene importato
dal backend attuale, e questo package non importa nulla da backend/ a parte
il Literal Status (letto, non modificato) da backend.models.
"""

from backend.domain.models import (
    Anomaly,
    ClientBankAccount,
    ClientCatalogItem,
    ClientConfig,
    Evidence,
    ExtractedField,
    Finding,
    FindingRef,
    Section,
    VerificationResult,
)

__all__ = [
    "Anomaly",
    "ClientBankAccount",
    "ClientCatalogItem",
    "ClientConfig",
    "Evidence",
    "ExtractedField",
    "Finding",
    "FindingRef",
    "Section",
    "VerificationResult",
]
