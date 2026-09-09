"""Analizzatore JET (Journal Entry Testing).

Orchestra il processo completo di analisi:
1. Caricamento libro giornale
2. Campionamento
3. Validazione
4. Rilevamento anomalie
5. Generazione risultato
"""

from __future__ import annotations

import logging
from decimal import Decimal
from pathlib import Path

from backend.modules.jet.models import (
    JournalEntry,
    JournalSample,
    JETResult,
    JETAnomaly,
    SampleConfig,
    ValidationResult,
)
from backend.modules.jet.loader import JournalLoader, load_journal
from backend.modules.jet.sampler import JournalSampler, sample_journal
from backend.modules.jet.validators import (
    validate_entry,
    validate_sequence_gaps,
    detect_duplicates,
)

logger = logging.getLogger(__name__)


class JETAnalyzer:
    """Analizzatore principale per il Journal Entry Testing.
    
    Integra tutti i componenti del modulo JET per eseguire
    un'analisi completa del libro giornale.
    
    Uso:
        analyzer = JETAnalyzer(client_config)
        result = analyzer.analyze(
            journal_path="path/to/libro_giornale.xlsx",
            pratica_id="pratica-123",
            client="Ferrero",
            period="III Trimestre 2025",
        )
    """
    
    def __init__(
        self,
        client_config: dict | None = None,
        piano_conti: set[str] | None = None,
    ):
        """
        Args:
            client_config: Configurazione cliente (opzionale)
            piano_conti: Set di codici conto validi (opzionale)
        """
        self.client_config = client_config or {}
        self.piano_conti = piano_conti
        
        # Estrai soglie dal config se disponibili
        self._threshold = self._get_threshold()
        self._focus_accounts = self._get_focus_accounts()
    
    def _get_threshold(self) -> Decimal | None:
        """Estrae la soglia di materialità dal config."""
        # Prima cerca in client_config
        if "soglia_jet_eur" in self.client_config:
            return Decimal(str(self.client_config["soglia_jet_eur"]))
        
        # Fallback su soglia_scostamento_bancario se disponibile
        if "soglia_scostamento_bancario_eur" in self.client_config:
            return Decimal(str(self.client_config["soglia_scostamento_bancario_eur"]))
        
        return None
    
    def _get_focus_accounts(self) -> list[str]:
        """Estrae i conti focus dal config."""
        return self.client_config.get("jet_focus_accounts", [])
    
    def analyze(
        self,
        journal_path: str | Path,
        pratica_id: str,
        client: str,
        period: str,
        sample_config: SampleConfig | None = None,
        check_duplicates: bool = True,
        check_sequence: bool = True,
    ) -> JETResult:
        """Esegue l'analisi JET completa.
        
        Args:
            journal_path: Percorso del file libro giornale
            pratica_id: ID della pratica
            client: Nome cliente
            period: Periodo (es. "III Trimestre 2025")
            sample_config: Configurazione campionamento (opzionale)
            check_duplicates: Esegue controllo duplicati
            check_sequence: Esegue controllo sequenza numerazione
            
        Returns:
            JETResult con tutti i risultati dell'analisi
        """
        journal_path = Path(journal_path)
        
        logger.info(f"Inizio analisi JET: {journal_path.name}")
        
        # 1. Carica il libro giornale
        try:
            entries = load_journal(journal_path)
            logger.info(f"Caricate {len(entries)} registrazioni")
        except Exception as e:
            logger.error(f"Errore caricamento libro giornale: {e}")
            return self._empty_result(pratica_id, client, period, str(journal_path), str(e))
        
        if not entries:
            return self._empty_result(
                pratica_id, client, period, str(journal_path),
                "Nessuna registrazione trovata nel file"
            )
        
        # 2. Configura e esegui campionamento
        if sample_config is None:
            sample_config = SampleConfig(
                random_count=25,
                threshold_amount=self._threshold,
                focus_accounts=self._focus_accounts,
                include_unbalanced=True,
            )
        
        sample = sample_journal(
            entries,
            random_count=sample_config.random_count,
            threshold_amount=sample_config.threshold_amount,
            focus_accounts=sample_config.focus_accounts,
            source_file=str(journal_path),
            include_unbalanced=sample_config.include_unbalanced,
            include_round_amounts=sample_config.include_round_amounts,
            date_from=sample_config.date_from,
            date_to=sample_config.date_to,
            random_seed=sample_config.random_seed,
        )
        
        logger.info(f"Campionate {sample.sample_size} registrazioni su {sample.total_entries}")
        
        # 3. Valida le registrazioni campionate
        validations: list[ValidationResult] = []
        previous_date = None
        
        # Ordina per data per il controllo sequenza
        sorted_entries = sorted(sample.entries, key=lambda e: e.registration_date)
        
        for entry in sorted_entries:
            result = validate_entry(
                entry,
                piano_conti=self.piano_conti,
                previous_date=previous_date,
            )
            validations.append(result)
            previous_date = entry.registration_date
        
        # 4. Raccogli tutte le anomalie
        all_anomalies: list[JETAnomaly] = []
        
        for validation in validations:
            all_anomalies.extend(validation.anomalies)
        
        # 5. Controlli aggiuntivi su tutte le registrazioni
        if check_sequence:
            sequence_anomalies = validate_sequence_gaps(entries)
            all_anomalies.extend(sequence_anomalies)
            if sequence_anomalies:
                logger.info(f"Rilevati {len(sequence_anomalies)} buchi nella numerazione")
        
        if check_duplicates:
            duplicate_anomalies = detect_duplicates(entries)
            all_anomalies.extend(duplicate_anomalies)
            if duplicate_anomalies:
                logger.info(f"Rilevati {len(duplicate_anomalies)} possibili duplicati")
        
        # 6. Crea il risultato
        result = JETResult(
            pratica_id=pratica_id,
            client=client,
            period=period,
            sample=sample,
            validations=validations,
            anomalies=all_anomalies,
        )
        
        result.compute_status()
        
        logger.info(
            f"Analisi JET completata: {result.status} - "
            f"{result.critical_anomalies} critiche, {result.warning_anomalies} warning"
        )
        
        return result
    
    def _empty_result(
        self,
        pratica_id: str,
        client: str,
        period: str,
        source_file: str,
        reason: str,
    ) -> JETResult:
        """Crea un risultato vuoto per errori o file mancanti."""
        sample = JournalSample(
            config=SampleConfig(),
            source_file=source_file,
            total_entries=0,
            sample_size=0,
            entries=[],
        )
        
        result = JETResult(
            pratica_id=pratica_id,
            client=client,
            period=period,
            sample=sample,
            validations=[],
            anomalies=[],
            status="wip",
            reasoning=reason,
        )
        
        return result
    
    def analyze_quick(
        self,
        journal_path: str | Path,
        pratica_id: str = "quick-analysis",
        client: str = "unknown",
        period: str = "current",
    ) -> JETResult:
        """Analisi rapida con configurazione di default.
        
        Utile per test e ispezioni veloci.
        """
        return self.analyze(
            journal_path=journal_path,
            pratica_id=pratica_id,
            client=client,
            period=period,
        )


def run_jet_analysis(
    journal_path: str | Path,
    pratica_id: str,
    client: str,
    period: str,
    threshold_amount: Decimal | None = None,
    sample_count: int = 25,
    piano_conti: set[str] | None = None,
) -> JETResult:
    """Funzione di convenienza per eseguire un'analisi JET.
    
    Args:
        journal_path: Percorso del file libro giornale
        pratica_id: ID della pratica
        client: Nome cliente
        period: Periodo
        threshold_amount: Soglia di materialità
        sample_count: Numero registrazioni casuali da campionare
        piano_conti: Set di codici conto validi
        
    Returns:
        JETResult con i risultati dell'analisi
    """
    config = {}
    if threshold_amount is not None:
        config["soglia_jet_eur"] = float(threshold_amount)
    
    analyzer = JETAnalyzer(
        client_config=config,
        piano_conti=piano_conti,
    )
    
    sample_config = SampleConfig(
        random_count=sample_count,
        threshold_amount=threshold_amount,
    )
    
    return analyzer.analyze(
        journal_path=journal_path,
        pratica_id=pratica_id,
        client=client,
        period=period,
        sample_config=sample_config,
    )
