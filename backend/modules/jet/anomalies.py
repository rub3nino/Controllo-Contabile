"""Rilevamento pattern anomali nelle registrazioni.

Questo modulo contiene funzioni per rilevare pattern sospetti
che vanno oltre le validazioni formali di base:
- Benford's Law analysis
- Round-tripping detection
- Unusual posting patterns
- Time-based anomalies
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal
from typing import Callable

from backend.modules.jet.models import (
    JournalEntry,
    JETAnomaly,
    AnomalyType,
)

logger = logging.getLogger(__name__)


def analyze_benfords_law(
    entries: list[JournalEntry],
    threshold: float = 0.15,
) -> JETAnomaly | None:
    """Analizza la distribuzione delle prime cifre secondo la Legge di Benford.
    
    La Legge di Benford prevede che nelle serie naturali di numeri,
    la prima cifra segua una distribuzione logaritmica:
    - 1: 30.1%
    - 2: 17.6%
    - 3: 12.5%
    - ...
    - 9: 4.6%
    
    Deviazioni significative possono indicare manipolazione.
    
    Args:
        entries: Lista delle registrazioni
        threshold: Soglia di deviazione (default 0.15 = 15%)
        
    Returns:
        JETAnomaly se la distribuzione devia significativamente
    """
    # Distribuzione attesa di Benford
    benford = {
        "1": 0.301, "2": 0.176, "3": 0.125, "4": 0.097,
        "5": 0.079, "6": 0.067, "7": 0.058, "8": 0.051, "9": 0.046,
    }
    
    # Estrai le prime cifre degli importi
    first_digits = []
    for entry in entries:
        amount = max(entry.total_debit, entry.total_credit)
        if amount > 0:
            first_digit = str(amount).lstrip("0").lstrip("-")[0]
            if first_digit.isdigit() and first_digit != "0":
                first_digits.append(first_digit)
    
    if len(first_digits) < 50:
        # Troppo pochi dati per un'analisi significativa
        return None
    
    # Calcola la distribuzione osservata
    counts = Counter(first_digits)
    total = len(first_digits)
    observed = {d: counts.get(d, 0) / total for d in "123456789"}
    
    # Calcola la deviazione
    max_deviation = 0.0
    max_digit = "1"
    
    for digit in "123456789":
        deviation = abs(observed[digit] - benford[digit])
        if deviation > max_deviation:
            max_deviation = deviation
            max_digit = digit
    
    if max_deviation > threshold:
        return JETAnomaly(
            anomaly_type=AnomalyType.OTHER,
            severity="warning",
            entry_id="",  # Anomalia a livello di insieme
            entry_number=0,
            description=(
                f"Distribuzione delle prime cifre devia dalla Legge di Benford: "
                f"cifra '{max_digit}' devia del {max_deviation*100:.1f}% "
                f"(osservato: {observed[max_digit]*100:.1f}%, atteso: {benford[max_digit]*100:.1f}%)"
            ),
            details={
                "analysis_type": "benford",
                "sample_size": total,
                "max_deviation": float(max_deviation),
                "max_deviation_digit": max_digit,
                "observed_distribution": {k: round(v, 3) for k, v in observed.items()},
                "expected_distribution": benford,
            },
        )
    
    return None


def detect_round_tripping(
    entries: list[JournalEntry],
    window_days: int = 7,
) -> list[JETAnomaly]:
    """Rileva possibili round-tripping (triangolazioni sospette).
    
    Il round-tripping è uno schema dove:
    A paga B -> B paga C -> C paga A
    
    Cerca registrazioni che potrebbero formare cicli.
    
    Args:
        entries: Lista delle registrazioni
        window_days: Finestra temporale per cercare cicli
        
    Returns:
        Lista di anomalie per possibili round-tripping
    """
    anomalies = []
    
    # Raggruppa per conti coinvolti
    by_account: dict[str, list[tuple[JournalEntry, str]]] = {}
    
    for entry in entries:
        for line in entry.lines:
            if line.account_code not in by_account:
                by_account[line.account_code] = []
            movement = "D" if line.debit > 0 else "A"
            by_account[line.account_code].append((entry, movement))
    
    # Cerca pattern sospetti (semplificato)
    # Nota: un'implementazione completa richiederebbe un grafo
    
    for account, movements in by_account.items():
        if len(movements) < 3:
            continue
        
        # Cerca inversioni rapide (dare seguito da avere o viceversa)
        movements_sorted = sorted(movements, key=lambda x: x[0].registration_date)
        
        for i in range(len(movements_sorted) - 1):
            entry1, move1 = movements_sorted[i]
            entry2, move2 = movements_sorted[i + 1]
            
            days_diff = (entry2.registration_date - entry1.registration_date).days
            
            if move1 != move2 and days_diff <= window_days:
                amt1 = max(entry1.total_debit, entry1.total_credit)
                amt2 = max(entry2.total_debit, entry2.total_credit)
                
                # Stessa quantità invertita
                if abs(amt1 - amt2) < Decimal("0.01"):
                    anomalies.append(JETAnomaly(
                        anomaly_type=AnomalyType.OTHER,
                        severity="warning",
                        entry_id=entry2.id,
                        entry_number=entry2.entry_number,
                        description=(
                            f"Possibile round-tripping: registrazione {entry2.entry_number} "
                            f"inverte la {entry1.entry_number} sullo stesso conto '{account}' "
                            f"entro {days_diff} giorni (importo: {amt1})"
                        ),
                        details={
                            "account": account,
                            "entry1_number": entry1.entry_number,
                            "entry2_number": entry2.entry_number,
                            "amount": str(amt1),
                            "days_between": days_diff,
                        },
                    ))
    
    return anomalies


def detect_period_end_spikes(
    entries: list[JournalEntry],
    spike_threshold: float = 2.0,
) -> list[JETAnomaly]:
    """Rileva concentrazioni anomale di registrazioni a fine periodo.
    
    Un numero insolitamente alto di registrazioni negli ultimi giorni
    del mese/trimestre può indicare manipolazione.
    
    Args:
        entries: Lista delle registrazioni
        spike_threshold: Moltiplicatore della media per considerare spike
        
    Returns:
        Lista di anomalie per spike sospetti
    """
    anomalies = []
    
    if len(entries) < 20:
        return anomalies
    
    # Raggruppa per giorno
    by_day: dict[date, list[JournalEntry]] = {}
    for entry in entries:
        d = entry.registration_date
        if d not in by_day:
            by_day[d] = []
        by_day[d].append(entry)
    
    if len(by_day) < 5:
        return anomalies
    
    # Calcola media giornaliera
    daily_counts = [len(e) for e in by_day.values()]
    avg_daily = sum(daily_counts) / len(daily_counts)
    
    # Cerca spike a fine mese
    for d, day_entries in by_day.items():
        count = len(day_entries)
        
        # Fine mese: ultimi 3 giorni
        is_month_end = d.day >= 28
        
        if is_month_end and count > avg_daily * spike_threshold:
            total_amount = sum(
                max(e.total_debit, e.total_credit) 
                for e in day_entries
            )
            
            anomalies.append(JETAnomaly(
                anomaly_type=AnomalyType.OTHER,
                severity="info",
                entry_id="",
                entry_number=0,
                description=(
                    f"Concentrazione anomala a fine mese ({d}): "
                    f"{count} registrazioni vs media di {avg_daily:.1f}/giorno"
                ),
                details={
                    "date": str(d),
                    "count": count,
                    "average_daily": round(avg_daily, 1),
                    "ratio": round(count / avg_daily, 2),
                    "total_amount": str(total_amount),
                },
            ))
    
    return anomalies


def detect_unusual_accounts(
    entries: list[JournalEntry],
    frequency_threshold: int = 2,
) -> list[JETAnomaly]:
    """Rileva conti usati raramente (possibili conti sospetti).
    
    Conti usati pochissime volte potrebbero essere:
    - Conti di transito per manipolazioni
    - Errori di imputazione
    - Conti obsoleti usati impropriamente
    
    Args:
        entries: Lista delle registrazioni
        frequency_threshold: Numero massimo di usi per essere "raro"
        
    Returns:
        Lista di anomalie per conti insoliti
    """
    anomalies = []
    
    # Conta l'uso di ogni conto
    account_usage: Counter = Counter()
    account_entries: dict[str, list[JournalEntry]] = {}
    
    for entry in entries:
        for line in entry.lines:
            account = line.account_code
            account_usage[account] += 1
            if account not in account_entries:
                account_entries[account] = []
            if entry not in account_entries[account]:
                account_entries[account].append(entry)
    
    # Trova conti rari
    for account, count in account_usage.items():
        if count <= frequency_threshold:
            related_entries = account_entries[account]
            total_amount = sum(
                max(e.total_debit, e.total_credit)
                for e in related_entries
            )
            
            # Solo se l'importo è significativo
            if total_amount > Decimal("1000"):
                anomalies.append(JETAnomaly(
                    anomaly_type=AnomalyType.UNUSUAL_ACCOUNT,
                    severity="info",
                    entry_id=related_entries[0].id if related_entries else "",
                    entry_number=related_entries[0].entry_number if related_entries else 0,
                    description=(
                        f"Conto '{account}' usato raramente ({count} volte) "
                        f"ma con importo totale significativo: {total_amount}"
                    ),
                    details={
                        "account": account,
                        "usage_count": count,
                        "total_amount": str(total_amount),
                        "entry_numbers": [e.entry_number for e in related_entries],
                    },
                ))
    
    return anomalies


def run_all_anomaly_checks(
    entries: list[JournalEntry],
) -> list[JETAnomaly]:
    """Esegue tutti i controlli anomalie avanzati.
    
    Args:
        entries: Lista delle registrazioni
        
    Returns:
        Lista di tutte le anomalie rilevate
    """
    all_anomalies: list[JETAnomaly] = []
    
    # Benford's Law
    benford_result = analyze_benfords_law(entries)
    if benford_result:
        all_anomalies.append(benford_result)
    
    # Round-tripping
    rt_anomalies = detect_round_tripping(entries)
    all_anomalies.extend(rt_anomalies)
    
    # Period-end spikes
    spike_anomalies = detect_period_end_spikes(entries)
    all_anomalies.extend(spike_anomalies)
    
    # Unusual accounts
    unusual_anomalies = detect_unusual_accounts(entries)
    all_anomalies.extend(unusual_anomalies)
    
    return all_anomalies
