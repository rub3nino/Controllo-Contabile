"""Campionatore per le registrazioni del libro giornale.

Implementa diverse strategie di campionamento:
- Casuale semplice
- Per importo (sopra soglia di materialità)
- Per conti specifici (focus accounts)
- Per anomalie sospette
"""

from __future__ import annotations

import logging
import random
from datetime import date
from decimal import Decimal

from backend.modules.jet.models import (
    JournalEntry,
    JournalSample,
    SampleConfig,
)

logger = logging.getLogger(__name__)


class JournalSampler:
    """Campiona registrazioni dal libro giornale.
    
    Il campionamento combina più criteri:
    1. Registrazioni sopra soglia di materialità (sempre incluse)
    2. Registrazioni su conti focus (sempre incluse)
    3. Registrazioni anomale (sbilanciate, weekend, etc.)
    4. Campione casuale per coprire il resto
    
    Uso:
        sampler = JournalSampler()
        sample = sampler.sample(entries, config)
    """
    
    def __init__(self):
        self._seen_ids: set[str] = set()
    
    def sample(
        self,
        entries: list[JournalEntry],
        config: SampleConfig,
        source_file: str = "",
    ) -> JournalSample:
        """Campiona le registrazioni secondo la configurazione.
        
        Args:
            entries: Lista completa delle registrazioni
            config: Configurazione del campionamento
            source_file: Percorso del file di origine
            
        Returns:
            JournalSample con le registrazioni campionate
        """
        self._seen_ids.clear()
        sampled: list[JournalEntry] = []
        
        # Filtra per periodo se specificato
        filtered = self._filter_by_date(entries, config.date_from, config.date_to)
        
        # 1. Registrazioni sopra soglia materialità
        if config.threshold_amount is not None:
            threshold_sample = self._sample_by_threshold(filtered, config.threshold_amount)
            sampled.extend(threshold_sample)
            logger.debug(f"Campionate {len(threshold_sample)} registrazioni sopra soglia")
        
        # 2. Registrazioni su conti focus
        if config.focus_accounts:
            focus_sample = self._sample_by_accounts(filtered, config.focus_accounts)
            sampled.extend(focus_sample)
            logger.debug(f"Campionate {len(focus_sample)} registrazioni su conti focus")
        
        # 3. Registrazioni anomale
        if config.include_unbalanced:
            unbalanced = self._sample_unbalanced(filtered)
            sampled.extend(unbalanced)
            logger.debug(f"Campionate {len(unbalanced)} registrazioni sbilanciate")
        
        if config.include_round_amounts:
            round_amounts = self._sample_round_amounts(filtered)
            sampled.extend(round_amounts)
            logger.debug(f"Campionate {len(round_amounts)} registrazioni con importi tondi")
        
        # 4. Campione casuale
        if config.random_count > 0:
            remaining = [e for e in filtered if e.id not in self._seen_ids]
            random_sample = self._sample_random(
                remaining, 
                config.random_count,
                config.random_seed
            )
            sampled.extend(random_sample)
            logger.debug(f"Campionate {len(random_sample)} registrazioni casualmente")
        
        # Crea il risultato
        result = JournalSample(
            config=config,
            source_file=source_file,
            total_entries=len(entries),
            sample_size=len(sampled),
            entries=sampled,
        )
        result.compute_stats()
        
        logger.info(
            f"Campionamento completato: {result.sample_size}/{result.total_entries} "
            f"({result.sample_percentage:.1f}%)"
        )
        
        return result
    
    def _filter_by_date(
        self,
        entries: list[JournalEntry],
        date_from: date | None,
        date_to: date | None,
    ) -> list[JournalEntry]:
        """Filtra le registrazioni per periodo."""
        if date_from is None and date_to is None:
            return entries
        
        filtered = []
        for entry in entries:
            if date_from and entry.registration_date < date_from:
                continue
            if date_to and entry.registration_date > date_to:
                continue
            filtered.append(entry)
        
        return filtered
    
    def _sample_by_threshold(
        self,
        entries: list[JournalEntry],
        threshold: Decimal,
    ) -> list[JournalEntry]:
        """Campiona registrazioni sopra soglia di materialità."""
        sampled = []
        for entry in entries:
            if entry.id in self._seen_ids:
                continue
            
            # Usa il maggiore tra dare e avere
            amount = max(entry.total_debit, entry.total_credit)
            if amount >= threshold:
                sampled.append(entry)
                self._seen_ids.add(entry.id)
        
        return sampled
    
    def _sample_by_accounts(
        self,
        entries: list[JournalEntry],
        focus_accounts: list[str],
    ) -> list[JournalEntry]:
        """Campiona registrazioni che movimentano conti specifici."""
        sampled = []
        focus_set = set(a.lower() for a in focus_accounts)
        
        for entry in entries:
            if entry.id in self._seen_ids:
                continue
            
            for line in entry.lines:
                if line.account_code.lower() in focus_set:
                    sampled.append(entry)
                    self._seen_ids.add(entry.id)
                    break
        
        return sampled
    
    def _sample_unbalanced(self, entries: list[JournalEntry]) -> list[JournalEntry]:
        """Campiona registrazioni sbilanciate (dare ≠ avere)."""
        sampled = []
        for entry in entries:
            if entry.id in self._seen_ids:
                continue
            
            if not entry.is_balanced():
                sampled.append(entry)
                self._seen_ids.add(entry.id)
        
        return sampled
    
    def _sample_round_amounts(
        self,
        entries: list[JournalEntry],
        round_threshold: int = 1000,
    ) -> list[JournalEntry]:
        """Campiona registrazioni con importi tondi sospetti.
        
        Gli importi tondi (es. 10.000, 50.000) possono indicare
        registrazioni manuali o stime da verificare.
        """
        sampled = []
        
        for entry in entries:
            if entry.id in self._seen_ids:
                continue
            
            amount = max(entry.total_debit, entry.total_credit)
            
            # Verifica se è un importo tondo
            if amount >= round_threshold and amount % round_threshold == 0:
                sampled.append(entry)
                self._seen_ids.add(entry.id)
        
        return sampled
    
    def _sample_random(
        self,
        entries: list[JournalEntry],
        count: int,
        seed: int | None = None,
    ) -> list[JournalEntry]:
        """Campiona casualmente n registrazioni."""
        if not entries:
            return []
        
        if seed is not None:
            random.seed(seed)
        
        # Non campionare più di quante ne abbiamo
        count = min(count, len(entries))
        
        sampled = random.sample(entries, count)
        for entry in sampled:
            self._seen_ids.add(entry.id)
        
        return sampled


def sample_journal(
    entries: list[JournalEntry],
    random_count: int = 25,
    threshold_amount: Decimal | None = None,
    focus_accounts: list[str] | None = None,
    source_file: str = "",
    **kwargs,
) -> JournalSample:
    """Funzione di convenienza per campionare un libro giornale.
    
    Args:
        entries: Lista delle registrazioni
        random_count: Numero di registrazioni casuali
        threshold_amount: Soglia di materialità
        focus_accounts: Conti da includere sempre
        source_file: Percorso del file di origine
        **kwargs: Altri argomenti per SampleConfig
        
    Returns:
        JournalSample con le registrazioni campionate
    """
    config = SampleConfig(
        random_count=random_count,
        threshold_amount=threshold_amount,
        focus_accounts=focus_accounts or [],
        **kwargs,
    )
    
    sampler = JournalSampler()
    return sampler.sample(entries, config, source_file)
