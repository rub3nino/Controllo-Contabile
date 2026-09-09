"""Modelli dati per il modulo JET (Journal Entry Testing).

Questi modelli definiscono la struttura dei dati per:
- Registrazioni del libro giornale (JournalEntry, JournalEntryLine)
- Campionamento (JournalSample, SampleConfig)
- Risultati dell'analisi (JETResult, JETAnomaly, ValidationResult)

I modelli si integrano con backend/domain/models.py:
- JETResult produce Evidence e Anomaly per l'Evidence Store
- JETAnomaly mappa su backend.domain.models.Anomaly
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id() -> str:
    return str(uuid4())[:8]


class AccountType(str, Enum):
    """Tipo di conto contabile."""
    ASSET = "asset"           # Attivo
    LIABILITY = "liability"   # Passivo
    EQUITY = "equity"         # Patrimonio netto
    REVENUE = "revenue"       # Ricavi
    EXPENSE = "expense"       # Costi
    UNKNOWN = "unknown"       # Non determinato


class JournalEntryLine(BaseModel):
    """Una singola riga di una registrazione contabile.
    
    Ogni registrazione (JournalEntry) è composta da più righe,
    una per ogni conto movimentato. La somma dei dare deve
    uguagliare la somma degli avere.
    """
    
    line_number: int = Field(description="Numero progressivo della riga all'interno della registrazione.")
    account_code: str = Field(description="Codice del conto contabile (es. '10.01.001').")
    account_name: str = Field(default="", description="Descrizione del conto contabile.")
    account_type: AccountType = Field(default=AccountType.UNKNOWN, description="Tipo di conto (attivo, passivo, etc.).")
    
    debit: Decimal = Field(default=Decimal("0"), description="Importo in DARE (positivo o zero).")
    credit: Decimal = Field(default=Decimal("0"), description="Importo in AVERE (positivo o zero).")
    
    description: str = Field(default="", description="Descrizione della riga, se presente.")
    
    @field_validator("debit", "credit", mode="before")
    @classmethod
    def _parse_decimal(cls, v):
        if v is None or v == "":
            return Decimal("0")
        if isinstance(v, (int, float)):
            return Decimal(str(v))
        if isinstance(v, str):
            # Gestisce formati italiani (1.234,56) e inglesi (1,234.56)
            v = v.strip().replace(" ", "")
            if "," in v and "." in v:
                if v.rfind(",") > v.rfind("."):
                    # Formato italiano: 1.234,56
                    v = v.replace(".", "").replace(",", ".")
                else:
                    # Formato inglese: 1,234.56
                    v = v.replace(",", "")
            elif "," in v:
                v = v.replace(",", ".")
            return Decimal(v)
        return Decimal(str(v))


class JournalEntry(BaseModel):
    """Una registrazione completa del libro giornale.
    
    Corrisponde a una "prima nota" o "scrittura contabile":
    un insieme di movimenti che devono bilanciare (dare = avere).
    """
    
    id: str = Field(default_factory=_new_id)
    
    # Identificazione
    entry_number: int = Field(description="Numero progressivo della registrazione nel libro giornale.")
    registration_date: date = Field(description="Data di registrazione.")
    document_date: date | None = Field(default=None, description="Data del documento di origine (fattura, etc.).")
    
    # Contenuto
    description: str = Field(default="", description="Causale o descrizione generale della registrazione.")
    document_ref: str | None = Field(default=None, description="Riferimento al documento di origine (n. fattura, etc.).")
    
    # Righe della registrazione
    lines: list[JournalEntryLine] = Field(default_factory=list, description="Righe della registrazione (minimo 2).")
    
    # Totali calcolati
    total_debit: Decimal = Field(default=Decimal("0"), description="Totale DARE (calcolato dalle righe).")
    total_credit: Decimal = Field(default=Decimal("0"), description="Totale AVERE (calcolato dalle righe).")
    
    # Metadati
    source_row: int | None = Field(default=None, description="Riga di origine nel file Excel, per tracciabilità.")
    source_sheet: str | None = Field(default=None, description="Foglio di origine nel file Excel.")
    
    def is_balanced(self) -> bool:
        """Verifica che dare e avere siano in equilibrio."""
        return self.total_debit == self.total_credit
    
    def balance_diff(self) -> Decimal:
        """Restituisce lo sbilancio (dare - avere)."""
        return self.total_debit - self.total_credit
    
    def compute_totals(self) -> None:
        """Ricalcola i totali dalle righe."""
        self.total_debit = sum(line.debit for line in self.lines)
        self.total_credit = sum(line.credit for line in self.lines)


class SampleConfig(BaseModel):
    """Configurazione per il campionamento delle registrazioni.
    
    Il campionamento può essere:
    - Casuale semplice (random_count)
    - Per importo (threshold_amount): tutte le registrazioni sopra soglia
    - Per tipo di conto (focus_accounts): registrazioni che movimentano certi conti
    - Combinato (tutti i criteri applicati insieme)
    """
    
    # Campionamento casuale
    random_count: int = Field(
        default=25,
        ge=0,
        description="Numero di registrazioni da campionare casualmente. 0 = nessun campione casuale."
    )
    random_seed: int | None = Field(
        default=None,
        description="Seed per la riproducibilità del campionamento casuale."
    )
    
    # Campionamento per importo
    threshold_amount: Decimal | None = Field(
        default=None,
        description="Soglia di materialità: tutte le registrazioni con importo >= soglia sono incluse."
    )
    
    # Campionamento per conti specifici
    focus_accounts: list[str] = Field(
        default_factory=list,
        description="Codici conto da includere sempre (tutte le registrazioni che li movimentano)."
    )
    
    # Campionamento per periodo
    date_from: date | None = Field(default=None, description="Data inizio periodo di campionamento.")
    date_to: date | None = Field(default=None, description="Data fine periodo di campionamento.")
    
    # Campionamento per anomalie
    include_unbalanced: bool = Field(
        default=True,
        description="Include tutte le registrazioni sbilanciate (dare ≠ avere)."
    )
    include_round_amounts: bool = Field(
        default=False,
        description="Include registrazioni con importi 'tondi' (possibili manuali)."
    )


class JournalSample(BaseModel):
    """Risultato del campionamento del libro giornale.
    
    Contiene le registrazioni selezionate e i metadati sul campionamento.
    """
    
    id: str = Field(default_factory=_new_id)
    
    # Metadati campionamento
    config: SampleConfig = Field(description="Configurazione usata per il campionamento.")
    source_file: str = Field(description="Percorso del file libro giornale di origine.")
    total_entries: int = Field(description="Numero totale di registrazioni nel libro giornale.")
    sample_size: int = Field(description="Numero di registrazioni nel campione.")
    
    # Registrazioni campionate
    entries: list[JournalEntry] = Field(default_factory=list, description="Registrazioni campionate.")
    
    # Statistiche
    sample_percentage: float = Field(
        default=0.0,
        description="Percentuale del libro giornale campionata (sample_size / total_entries * 100)."
    )
    total_amount_sampled: Decimal = Field(
        default=Decimal("0"),
        description="Somma degli importi delle registrazioni campionate (dare o avere, il maggiore)."
    )
    
    # Metadati
    sampled_at: str = Field(default_factory=_now)
    
    def compute_stats(self) -> None:
        """Ricalcola le statistiche dal campione."""
        self.sample_size = len(self.entries)
        if self.total_entries > 0:
            self.sample_percentage = (self.sample_size / self.total_entries) * 100
        self.total_amount_sampled = sum(
            max(e.total_debit, e.total_credit) for e in self.entries
        )


class AnomalyType(str, Enum):
    """Tipi di anomalia rilevabili nel JET."""
    
    UNBALANCED = "unbalanced"           # Registrazione sbilanciata
    INVALID_DATE = "invalid_date"       # Data non valida o fuori periodo
    MISSING_ACCOUNT = "missing_account" # Conto inesistente nel piano dei conti
    DUPLICATE = "duplicate"             # Possibile duplicato
    ROUND_AMOUNT = "round_amount"       # Importo tondo sospetto
    WEEKEND_ENTRY = "weekend_entry"     # Registrazione in weekend
    UNUSUAL_ACCOUNT = "unusual_account" # Conto usato in modo insolito
    MISSING_DESCRIPTION = "missing_description"  # Manca la causale
    SEQUENCE_GAP = "sequence_gap"       # Buco nella numerazione
    OTHER = "other"


class JETAnomaly(BaseModel):
    """Anomalia rilevata durante l'analisi JET.
    
    Mappa su backend.domain.models.Anomaly per l'integrazione
    con l'Evidence Store.
    """
    
    id: str = Field(default_factory=_new_id)
    
    anomaly_type: AnomalyType = Field(description="Tipo di anomalia.")
    severity: Literal["info", "warning", "critical"] = Field(
        default="warning",
        description="Gravità: info (nota), warning (da verificare), critical (errore probabile)."
    )
    
    entry_id: str = Field(description="ID della registrazione coinvolta.")
    entry_number: int = Field(description="Numero della registrazione per riferimento.")
    
    description: str = Field(description="Descrizione dell'anomalia in linguaggio naturale.")
    details: dict = Field(
        default_factory=dict,
        description="Dettagli strutturati (valori coinvolti, differenze, etc.)."
    )
    
    detected_at: str = Field(default_factory=_now)
    
    def to_domain_anomaly(self):
        """Converte in backend.domain.models.Anomaly per l'Evidence Store."""
        from backend.domain.models import Anomaly
        return Anomaly(
            kind=f"jet_{self.anomaly_type.value}",
            description=self.description,
            severity=self.severity,
            related_item_id="D.1",  # JET è sempre sezione D
        )


class ValidationResult(BaseModel):
    """Risultato della validazione di una singola registrazione."""
    
    entry_id: str = Field(description="ID della registrazione validata.")
    is_valid: bool = Field(description="True se la registrazione passa tutte le validazioni.")
    
    checks_passed: list[str] = Field(
        default_factory=list,
        description="Lista dei controlli superati."
    )
    checks_failed: list[str] = Field(
        default_factory=list,
        description="Lista dei controlli falliti."
    )
    
    anomalies: list[JETAnomaly] = Field(
        default_factory=list,
        description="Anomalie rilevate su questa registrazione."
    )


class JETResult(BaseModel):
    """Risultato completo dell'analisi JET.
    
    Contiene tutto ciò che serve per produrre:
    - Lo stato della Sezione D nel WPS
    - Le Evidence per l'Evidence Store
    - Gli Anomaly per la dashboard
    """
    
    id: str = Field(default_factory=_new_id)
    
    # Riferimenti
    pratica_id: str = Field(description="Pratica di riferimento.")
    client: str = Field(description="Cliente.")
    period: str = Field(description="Periodo (es. 'III Trimestre 2025').")
    
    # Dati di input
    sample: JournalSample = Field(description="Campione analizzato.")
    
    # Risultati validazione
    validations: list[ValidationResult] = Field(
        default_factory=list,
        description="Risultati della validazione per ogni registrazione campionata."
    )
    
    # Anomalie aggregate
    anomalies: list[JETAnomaly] = Field(
        default_factory=list,
        description="Tutte le anomalie rilevate."
    )
    
    # Statistiche
    entries_validated: int = Field(default=0, description="Registrazioni validate.")
    entries_with_issues: int = Field(default=0, description="Registrazioni con almeno un problema.")
    critical_anomalies: int = Field(default=0, description="Anomalie critiche.")
    warning_anomalies: int = Field(default=0, description="Anomalie warning.")
    
    # Stato finale
    status: Literal["✓", "wip", "✗", "N/A"] = Field(
        default="wip",
        description="Stato calcolato per la Sezione D."
    )
    reasoning: str = Field(
        default="",
        description="Motivazione dello stato in linguaggio naturale."
    )
    
    # Metadati
    analyzed_at: str = Field(default_factory=_now)
    
    def compute_stats(self) -> None:
        """Ricalcola le statistiche dai risultati."""
        self.entries_validated = len(self.validations)
        self.entries_with_issues = sum(1 for v in self.validations if not v.is_valid)
        self.critical_anomalies = sum(1 for a in self.anomalies if a.severity == "critical")
        self.warning_anomalies = sum(1 for a in self.anomalies if a.severity == "warning")
    
    def compute_status(self) -> None:
        """Calcola lo stato della Sezione D basandosi sui risultati."""
        self.compute_stats()
        
        if self.entries_validated == 0:
            self.status = "wip"
            self.reasoning = "Nessuna registrazione analizzata - in attesa del libro giornale"
        elif self.critical_anomalies > 0:
            self.status = "wip"
            self.reasoning = (
                f"Rilevate {self.critical_anomalies} anomalie critiche su "
                f"{self.entries_validated} registrazioni campionate - richiede revisione"
            )
        elif self.warning_anomalies > 0:
            self.status = "✓"
            self.reasoning = (
                f"Test completato su {self.entries_validated} registrazioni. "
                f"{self.warning_anomalies} note di attenzione, nessuna anomalia critica."
            )
        else:
            self.status = "✓"
            self.reasoning = (
                f"Test completato su {self.entries_validated} registrazioni. "
                "Nessuna anomalia rilevata."
            )
    
    def to_verification_result(self):
        """Converte in backend.domain.models.VerificationResult."""
        from backend.domain.models import VerificationResult, Evidence, Anomaly
        
        self.compute_status()
        
        # Crea Evidence per il JET
        evidence = Evidence(
            pratica_id=self.pratica_id,
            item_id="D.1",  # JET
            found=self.entries_validated > 0,
            source_path=self.sample.source_file if self.entries_validated > 0 else None,
            source_name="Libro giornale" if self.entries_validated > 0 else None,
            method="jet_analysis",
            confidence=0.9 if self.entries_validated > 0 else 0.0,
            excerpt=f"Campionate {self.sample.sample_size} registrazioni su {self.sample.total_entries}",
            notes=self.reasoning,
        )
        
        # Converte le anomalie
        domain_anomalies = [a.to_domain_anomaly() for a in self.anomalies]
        
        return VerificationResult(
            pratica_id=self.pratica_id,
            client=self.client,
            period=self.period,
            section="D",
            status=self.status,
            reasoning=self.reasoning,
            evidence=[evidence],
            missing_items=[] if self.entries_validated > 0 else ["D.1"],
            anomalies=domain_anomalies,
        )
