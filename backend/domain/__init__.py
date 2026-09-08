"""Contratti dati (Fase 0) + evidence store e motore di verifica (Fase 1).

Isolamento a senso unico: nessun file esistente in `backend/*.py` importa
`backend.domain` (l'app attuale continua a funzionare identica). Il
contrario non è vero e non deve esserlo: i moduli di questo package leggono
da `backend/catalog.py` (`SECTION_ITEMS`, `checklist_items`) e
`backend/models.py` (`Status`, `DocumentOut`) perché il piano
(`docs/piano_azione_redesign.md` §3) chiede esplicitamente di riusare quel
codice, non di duplicarlo. Nessuno di questi import scrive nei moduli
esistenti.
"""

from backend.domain.continuity import carry_forward_open_findings
from backend.domain.ingest_adapter import documents_to_evidence
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
from backend.domain.store import EvidenceStore
from backend.domain.verification_engine import evaluate_pratica, evaluate_section

__all__ = [
    "Anomaly",
    "ClientBankAccount",
    "ClientCatalogItem",
    "ClientConfig",
    "Evidence",
    "EvidenceStore",
    "ExtractedField",
    "Finding",
    "FindingRef",
    "Section",
    "VerificationResult",
    "carry_forward_open_findings",
    "documents_to_evidence",
    "evaluate_pratica",
    "evaluate_section",
]
