"""Adapter sottile: `DocumentOut` (classify.py) --> `Evidence` (Fase 0).

Non reimplementa la classificazione: prende quello che `backend/classify.py`
ha già deciso (`item_id`, `method`, `confidence`, `excerpt`...) e lo traduce
nel vocabolario di `backend.domain.models.Evidence`. L'unica logica propria
di questo modulo è generare esplicitamente le `Evidence(found=False)` per le
voci di `ClientConfig.applicable_items` che non risultano in nessun
documento classificato — è il pezzo che Fase 0 ha lasciato come contratto
("un item_id per cui non è stata trovata alcuna evidenza è un fatto
rilevante") e che qui prende vita per la prima volta.

Non estrae campi strutturati (`Evidence.fields`): quello è compito di
`backend/extract.py`, che oggi produce dati (F24: data/protocollo/importo,
bilancino: saldi...) ma non è ancora integrato in questo adapter — vedi
il riepilogo di Fase 1 per la segnalazione esplicita di questa lacuna.
"""

from __future__ import annotations

from backend.domain.models import ClientConfig, Evidence
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


def documents_to_evidence(
    pratica_id: str,
    documents: list[DocumentOut],
    client_config: ClientConfig,
) -> list[Evidence]:
    """Traduce i documenti classificati di una pratica in `Evidence`.

    Un `DocumentOut` con `item_id` non applicabile a questo cliente (non in
    `client_config.applicable_items`) viene ignorato silenziosamente: è N/A
    per il cliente, non deve comparire né come trovato né come mancante
    (altrimenti un cliente senza Intrastat vedrebbe comunque "E.5 mancante").
    """
    applicable = set(client_config.applicable_items)
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
