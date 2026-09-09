"""Journal Entry Testing (JET) — Modulo per la Sezione D.

Questo modulo implementa il test delle rilevazioni contabili sul libro giornale,
corrispondente alla Carta D del controllo contabile trimestrale SA Italia 250B.

Funzionalità principali:
- Caricamento e parsing del libro giornale (Excel/PDF)
- Campionamento statistico delle registrazioni
- Validazione formale delle registrazioni campionate
- Rilevamento di anomalie e pattern sospetti
- Generazione di output per la Sezione D del WPS

Uso tipico:
    from backend.modules.jet import JETAnalyzer, JournalEntry, SampleConfig
    
    analyzer = JETAnalyzer(client_config)
    result = analyzer.analyze(journal_path, sample_config)
"""

from backend.modules.jet.models import (
    JournalEntry,
    JournalEntryLine,
    JournalSample,
    JETResult,
    JETAnomaly,
    SampleConfig,
    ValidationResult,
)
from backend.modules.jet.loader import JournalLoader
from backend.modules.jet.sampler import JournalSampler
from backend.modules.jet.analyzer import JETAnalyzer
from backend.modules.jet.validators import (
    validate_entry,
    validate_balancing,
    validate_date_sequence,
    validate_account_codes,
)

__all__ = [
    # Models
    "JournalEntry",
    "JournalEntryLine",
    "JournalSample",
    "JETResult",
    "JETAnomaly",
    "SampleConfig",
    "ValidationResult",
    # Core classes
    "JournalLoader",
    "JournalSampler",
    "JETAnalyzer",
    # Validators
    "validate_entry",
    "validate_balancing",
    "validate_date_sequence",
    "validate_account_codes",
]
