"""Adapter sottile: `DocumentOut` (classify.py) --> `Evidence` (Fase 0).

Non reimplementa la classificazione: prende quello che `backend/classify.py`
ha già deciso (`item_id`, `method`, `confidence`, `excerpt`...) e lo traduce
nel vocabolario di `backend.domain.models.Evidence`. L'unica logica propria
di questo modulo è generare esplicitamente le `Evidence(found=False)` per le
voci di `ClientConfig.applicable_items` che non risultano in nessun
documento classificato — è il pezzo che Fase 0 ha lasciato come contratto
("un item_id per cui non è stata trovata alcuna evidenza è un fatto
rilevante") e che qui prende vita per la prima volta.

Fase 5: per i quattro item con estrattori puntuali già disponibili
(`E.1`, `F.1`, `B.4`, `D.1`) popola anche `Evidence.fields`. Un errore di
lettura/OCR degrada sempre a lista vuota per il singolo documento: non
impedisce alla scansione di produrre le altre evidenze.

Fix Fase 2: le voci di `client_config.extra_items` (es. il libro del
Collegio sindacale) contano come "applicabili" esattamente come le 25 voci
standard di `applicable_items`. Prima di questo fix una voce extra senza
documento non generava mai una `Evidence(found=False)`: il gap non era
visibile a nessuno, né trovato né segnalato come mancante.
"""

from __future__ import annotations

import re
from pathlib import Path

from backend.domain.models import ClientConfig, Evidence, ExtractedField
from backend.extract import (
    extract_file,
    find_dates,
    find_f24_importo,
    find_payment_date,
    find_protocol,
    find_statement_balance,
    parse_giornale_last,
    parse_mastrini_last,
)
from backend.models import DocumentOut

# Metodo usato per le Evidence(found=False) generate da questo adapter: la
# cartella è stata scansionata per intero (classify.py + scan_folder) e
# nessun file è stato ricondotto a questa voce. Non è nel vocabolario già
# visto in ProvenanceRow.method (filename/folder/content/ocr/pdf-text/
# xlsx/formula/umano) perché nessuno di quei valori descrive "assenza dopo
# scansione completa" — aggiungerne uno nuovo è compatibile con il contratto
# (Evidence.method resta `str` libero, vedi backend/domain/models.py) e non
# richiede di toccarlo.
ABSENCE_METHOD = "scan"


def _extracted_fields(doc: DocumentOut) -> list[ExtractedField]:
    """Estrae i campi supportati senza propagare errori del singolo file."""
    try:
        path = Path(doc.path)
        if doc.item_id == "E.1":
            text, _ = extract_file(path, pages="key")
            values = (
                ("importo", find_f24_importo(text), "EUR"),
                ("data_versamento", find_payment_date(text), None),
                ("protocollo", find_protocol(text), None),
            )
            return [
                ExtractedField(kind=kind, value=str(value), unit=unit)
                for kind, value, unit in values
                if value is not None
            ]
        if doc.item_id == "F.1":
            text, _ = extract_file(path, pages="key")
            balance = find_statement_balance(text)
            return (
                [ExtractedField(kind="saldo_ec", value=str(balance), unit="EUR")]
                if balance is not None
                else []
            )
        if doc.item_id in {"B.4", "D.1"}:
            if doc.ext.lower() == ".xlsx":
                parsed = parse_giornale_last(path)
            else:
                text, _ = extract_file(path, pages="key")
                parsed = parse_mastrini_last(text)
            mapping = (
                ("ultimo_numero_registrazione", "nr_reg"),
                ("data_ultimo_verbale", "data_reg"),
                ("ultima_pagina", "page"),
            )
            return [
                ExtractedField(kind=kind, value=str(parsed[key]))
                for kind, key in mapping
                if parsed.get(key) is not None
            ]
        if doc.item_id in {"C.1", "C.2", "C.4"}:
            text, _ = extract_file(path, pages="key")
            filename_date = re.search(r"(20\d{2})(\d{2})(\d{2})", doc.name)
            if filename_date:
                value = (
                    f"{filename_date.group(3)}/{filename_date.group(2)}/"
                    f"{filename_date.group(1)}"
                )
            else:
                dates = find_dates(text)
                value = dates[-1] if dates else None
            return (
                [ExtractedField(kind="data_verbale", value=value)]
                if value is not None
                else []
            )
    except Exception:
        return []
    return []


def documents_to_evidence(
    pratica_id: str,
    documents: list[DocumentOut],
    client_config: ClientConfig,
) -> list[Evidence]:
    """Traduce i documenti classificati di una pratica in `Evidence`.

    Un `DocumentOut` con `item_id` non applicabile a questo cliente (non in
    `client_config.applicable_items` né in `client_config.extra_items`)
    viene ignorato silenziosamente: è N/A per il cliente, non deve comparire
    né come trovato né come mancante (altrimenti un cliente senza Intrastat
    vedrebbe comunque "E.5 mancante").
    """
    applicable = set(client_config.applicable_items) | {item.id for item in client_config.extra_items}
    evidences: list[Evidence] = []
    found_items: set[str] = set()

    for doc in documents:
        if not doc.item_id or doc.skip:
            continue
        if doc.item_id not in applicable:
            continue
        evidences.append(
            Evidence(
                pratica_id=pratica_id,
                item_id=doc.item_id,
                found=True,
                source_path=doc.path,
                source_name=doc.name,
                method=doc.method,
                confidence=doc.confidence,
                excerpt=doc.excerpt,
                fields=_extracted_fields(doc),
            )
        )
        found_items.add(doc.item_id)

    for item_id in applicable:
        if item_id in found_items:
            continue
        evidences.append(
            Evidence(
                pratica_id=pratica_id,
                item_id=item_id,
                found=False,
                method=ABSENCE_METHOD,
                notes="Nessun documento classificato su questa voce dopo la scansione completa della cartella.",
            )
        )

    return evidences
