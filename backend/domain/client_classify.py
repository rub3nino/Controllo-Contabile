"""Classificazione sensibile al cliente (Fase 2, piano §5 stream 3).

Risolve il gap descritto nel prompt di questa fase: `ClientConfig.extra_items`
(Fase 0) esiste per rappresentare voci di catalogo non standard di un
cliente (esempio reale: il libro verbali del Collegio sindacale, segnalato
come APERTO in `TEMPLATE_RULES.md` §7.6), ma prima di questo modulo nessun
meccanismo classificava un file contro quelle voci — il campo esisteva nel
modello, non era collegato a nulla.

`backend.classify.scan_folder` resta il classificatore primario, riusato
com'è: questo modulo aggiunge solo un secondo passaggio sui file che
`scan_folder` lascia senza `item_id`, usando le `hints` delle voci extra del
cliente con la stessa tecnica (matching di parole chiave su nome file e
testo estratto) di `EXTRA_HINTS` in `backend/catalog.py` — non una tecnica
nuova, la stessa applicata a un catalogo diverso.
"""

from __future__ import annotations

import unicodedata

from backend.classify import scan_folder
from backend.domain.models import ClientCatalogItem, ClientConfig
from backend.models import DocumentOut


def _normalize(text: str) -> str:
    """Stessa normalizzazione di `backend.classify._norm` (NFKD -> ascii ->
    lower), duplicata qui invece di importata: `_norm` è una funzione
    privata di un altro modulo (prefisso `_`), e questo file non deve
    dipendere da un dettaglio implementativo che `classify.py` potrebbe
    cambiare senza preavviso.
    """
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return s.lower()


def _match_extra_item(
    doc: DocumentOut, extra_items: list[ClientCatalogItem]
) -> tuple[ClientCatalogItem, bool] | None:
    """Prima voce extra (in ordine di lista) le cui `hints` compaiono nel
    nome file o nel testo estratto. Ritorna `(voce, matched_in_name)` o
    `None`. Non è uno scoring multi-voce come `classify.classify_text`: per
    il numero di voci extra tipico di un cliente (una manciata, non 25) un
    "primo che combacia" è sufficiente e più facile da spiegare a un
    revisore di una classifica di punteggi. Se un cliente arrivasse ad
    avere decine di voci extra con hint sovrapposti, vale la pena
    reintrodurre uno scoring — non è questo il caso oggi.
    """
    name_n = _normalize(doc.name)
    excerpt_n = _normalize(doc.excerpt or "")
    for item in extra_items:
        for hint in item.hints:
            h = _normalize(hint)
            if not h:
                continue
            if h in name_n:
                return item, True
            if h in excerpt_n:
                return item, False
    return None


def scan_folder_for_client(root: str, pratica_id: str, client_config: ClientConfig) -> list[DocumentOut]:
    """`classify.scan_folder` più un secondo passaggio sulle voci extra del cliente.

    Il primo passaggio è quello già in produzione, invariato: un file già
    classificato da `scan_folder` (`item_id` non None) non viene più
    toccato — le voci extra non possono sovrascrivere una classificazione
    già decisa dal catalogo standard. Solo i file rimasti senza `item_id`
    vengono confrontati con `client_config.extra_items`.

    Se `client_config.extra_items` è vuota, il risultato è `scan_folder`
    invariato — nessun comportamento esistente cambia per un cliente senza
    voci extra (vedi il test di non regressione in
    `tests/test_domain_client_classify.py`).
    """
    docs = scan_folder(root, pratica_id)
    if not client_config.extra_items:
        return docs

    for doc in docs:
        if doc.item_id:
            continue
        match = _match_extra_item(doc, client_config.extra_items)
        if match is None:
            continue
        item, matched_in_name = match
        doc.item_id = item.id
        doc.item_label = item.label
        doc.method = "filename" if matched_in_name else "content"
        # Stessa scala di classify.classify_text (0.40-0.95): qui non c'è un
        # punteggio multi-regola da normalizzare, solo un match booleano
        # nome/contenuto, quindi due valori fissi bastano.
        doc.confidence = 0.75 if matched_in_name else 0.55

    return docs
