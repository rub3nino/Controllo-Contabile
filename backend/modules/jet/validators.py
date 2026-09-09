"""Validatori per le registrazioni del libro giornale.

Ogni validatore verifica un aspetto specifico delle registrazioni:
- Bilanciamento (dare = avere)
- Sequenza date (ordine cronologico)
- Codici conto validi
- Completezza dati
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.modules.jet.models import (
    JournalEntry,
    JETAnomaly,
    AnomalyType,
    ValidationResult,
)


def validate_entry(
    entry: JournalEntry,
    piano_conti: set[str] | None = None,
    previous_date: date | None = None,
) -> ValidationResult:
    """Esegue tutte le validazioni su una registrazione.
    
    Args:
        entry: Registrazione da validare
        piano_conti: Set di codici conto validi (opzionale)
        previous_date: Data dell'ultima registrazione per controllo sequenza
        
    Returns:
        ValidationResult con esito e anomalie
    """
    checks_passed = []
    checks_failed = []
    anomalies = []
    
    # 1. Verifica bilanciamento
    balance_result = validate_balancing(entry)
    if balance_result:
        anomalies.append(balance_result)
        checks_failed.append("bilanciamento")
    else:
        checks_passed.append("bilanciamento")
    
    # 2. Verifica sequenza date
    if previous_date:
        date_result = validate_date_sequence(entry, previous_date)
        if date_result:
            anomalies.append(date_result)
            checks_failed.append("sequenza_date")
        else:
            checks_passed.append("sequenza_date")
    
    # 3. Verifica codici conto
    if piano_conti:
        account_results = validate_account_codes(entry, piano_conti)
        if account_results:
            anomalies.extend(account_results)
            checks_failed.append("codici_conto")
        else:
            checks_passed.append("codici_conto")
    
    # 4. Verifica completezza
    completeness_results = validate_completeness(entry)
    if completeness_results:
        anomalies.extend(completeness_results)
        checks_failed.append("completezza")
    else:
        checks_passed.append("completezza")
    
    # 5. Verifica registrazioni in weekend
    weekend_result = validate_weekend(entry)
    if weekend_result:
        anomalies.append(weekend_result)
        # Non è un fallimento, solo una nota
        checks_passed.append("weekend")
    else:
        checks_passed.append("weekend")
    
    return ValidationResult(
        entry_id=entry.id,
        is_valid=len(checks_failed) == 0,
        checks_passed=checks_passed,
        checks_failed=checks_failed,
        anomalies=anomalies,
    )


def validate_balancing(entry: JournalEntry) -> JETAnomaly | None:
    """Verifica che la registrazione sia bilanciata (dare = avere).
    
    Returns:
        JETAnomaly se sbilanciata, None altrimenti
    """
    diff = entry.balance_diff()
    
    if diff != Decimal("0"):
        return JETAnomaly(
            anomaly_type=AnomalyType.UNBALANCED,
            severity="critical",
            entry_id=entry.id,
            entry_number=entry.entry_number,
            description=(
                f"Registrazione n. {entry.entry_number} sbilanciata: "
                f"Dare={entry.total_debit}, Avere={entry.total_credit}, "
                f"Differenza={abs(diff)}"
            ),
            details={
                "debit": str(entry.total_debit),
                "credit": str(entry.total_credit),
                "difference": str(diff),
            },
        )
    
    return None


def validate_date_sequence(
    entry: JournalEntry,
    previous_date: date,
) -> JETAnomaly | None:
    """Verifica che la data sia in sequenza con la precedente.
    
    Args:
        entry: Registrazione da verificare
        previous_date: Data dell'ultima registrazione
        
    Returns:
        JETAnomaly se fuori sequenza, None altrimenti
    """
    if entry.registration_date < previous_date:
        return JETAnomaly(
            anomaly_type=AnomalyType.INVALID_DATE,
            severity="warning",
            entry_id=entry.id,
            entry_number=entry.entry_number,
            description=(
                f"Registrazione n. {entry.entry_number} con data anteriore "
                f"alla precedente: {entry.registration_date} < {previous_date}"
            ),
            details={
                "entry_date": str(entry.registration_date),
                "previous_date": str(previous_date),
            },
        )
    
    return None


def validate_account_codes(
    entry: JournalEntry,
    piano_conti: set[str],
) -> list[JETAnomaly]:
    """Verifica che i codici conto esistano nel piano dei conti.
    
    Args:
        entry: Registrazione da verificare
        piano_conti: Set di codici conto validi
        
    Returns:
        Lista di anomalie per conti non trovati
    """
    anomalies = []
    
    for line in entry.lines:
        if line.account_code and line.account_code not in piano_conti:
            anomalies.append(JETAnomaly(
                anomaly_type=AnomalyType.MISSING_ACCOUNT,
                severity="warning",
                entry_id=entry.id,
                entry_number=entry.entry_number,
                description=(
                    f"Registrazione n. {entry.entry_number}: "
                    f"codice conto '{line.account_code}' non trovato nel piano dei conti"
                ),
                details={
                    "account_code": line.account_code,
                    "line_number": line.line_number,
                },
            ))
    
    return anomalies


def validate_completeness(entry: JournalEntry) -> list[JETAnomaly]:
    """Verifica la completezza dei dati obbligatori.
    
    Returns:
        Lista di anomalie per dati mancanti
    """
    anomalies = []
    
    # Verifica descrizione/causale
    if not entry.description or entry.description.strip() == "":
        anomalies.append(JETAnomaly(
            anomaly_type=AnomalyType.MISSING_DESCRIPTION,
            severity="info",
            entry_id=entry.id,
            entry_number=entry.entry_number,
            description=f"Registrazione n. {entry.entry_number} senza causale/descrizione",
            details={},
        ))
    
    # Verifica che ci siano almeno 2 righe
    if len(entry.lines) < 2:
        anomalies.append(JETAnomaly(
            anomaly_type=AnomalyType.OTHER,
            severity="warning",
            entry_id=entry.id,
            entry_number=entry.entry_number,
            description=(
                f"Registrazione n. {entry.entry_number} con meno di 2 righe "
                f"(trovate: {len(entry.lines)})"
            ),
            details={"line_count": len(entry.lines)},
        ))
    
    return anomalies


def validate_weekend(entry: JournalEntry) -> JETAnomaly | None:
    """Verifica se la registrazione è in un giorno di weekend.
    
    Le registrazioni nei weekend possono indicare operazioni manuali
    o retrodatate da verificare.
    
    Returns:
        JETAnomaly se in weekend (severity info), None altrimenti
    """
    weekday = entry.registration_date.weekday()
    
    if weekday >= 5:  # Sabato (5) o Domenica (6)
        day_name = "Sabato" if weekday == 5 else "Domenica"
        return JETAnomaly(
            anomaly_type=AnomalyType.WEEKEND_ENTRY,
            severity="info",
            entry_id=entry.id,
            entry_number=entry.entry_number,
            description=(
                f"Registrazione n. {entry.entry_number} in {day_name} "
                f"({entry.registration_date})"
            ),
            details={
                "date": str(entry.registration_date),
                "weekday": weekday,
                "day_name": day_name,
            },
        )
    
    return None


def validate_sequence_gaps(
    entries: list[JournalEntry],
) -> list[JETAnomaly]:
    """Verifica la continuità della numerazione delle registrazioni.
    
    Args:
        entries: Lista ordinata delle registrazioni
        
    Returns:
        Lista di anomalie per buchi nella numerazione
    """
    anomalies = []
    
    if len(entries) < 2:
        return anomalies
    
    # Ordina per numero registrazione
    sorted_entries = sorted(entries, key=lambda e: e.entry_number)
    
    for i in range(1, len(sorted_entries)):
        prev_num = sorted_entries[i-1].entry_number
        curr_num = sorted_entries[i].entry_number
        
        if curr_num - prev_num > 1:
            missing = list(range(prev_num + 1, curr_num))
            anomalies.append(JETAnomaly(
                anomaly_type=AnomalyType.SEQUENCE_GAP,
                severity="warning",
                entry_id=sorted_entries[i].id,
                entry_number=curr_num,
                description=(
                    f"Buco nella numerazione: da {prev_num} a {curr_num}, "
                    f"mancano {len(missing)} registrazioni"
                ),
                details={
                    "previous_number": prev_num,
                    "current_number": curr_num,
                    "missing_count": len(missing),
                    "missing_numbers": missing[:10],  # Max 10 per evitare liste enormi
                },
            ))
    
    return anomalies


def detect_duplicates(entries: list[JournalEntry]) -> list[JETAnomaly]:
    """Rileva possibili registrazioni duplicate.
    
    Due registrazioni sono considerate possibili duplicati se hanno:
    - Stessa data
    - Stesso importo (dare o avere)
    - Stesso primo conto
    
    Returns:
        Lista di anomalie per possibili duplicati
    """
    anomalies = []
    
    # Crea una firma per ogni registrazione
    signatures: dict[str, list[JournalEntry]] = {}
    
    for entry in entries:
        if not entry.lines:
            continue
        
        first_account = entry.lines[0].account_code
        amount = max(entry.total_debit, entry.total_credit)
        
        signature = f"{entry.registration_date}|{first_account}|{amount}"
        
        if signature not in signatures:
            signatures[signature] = []
        signatures[signature].append(entry)
    
    # Trova i duplicati
    for signature, group in signatures.items():
        if len(group) > 1:
            entry_numbers = [e.entry_number for e in group]
            for entry in group[1:]:  # Salta il primo, è l'originale
                anomalies.append(JETAnomaly(
                    anomaly_type=AnomalyType.DUPLICATE,
                    severity="warning",
                    entry_id=entry.id,
                    entry_number=entry.entry_number,
                    description=(
                        f"Possibile duplicato della registrazione n. {group[0].entry_number}: "
                        f"stessa data, conto e importo"
                    ),
                    details={
                        "original_number": group[0].entry_number,
                        "duplicate_numbers": entry_numbers[1:],
                        "signature": signature,
                    },
                ))
    
    return anomalies
