"""Continuità fra trimestri — verifiche 11 e 12 del principio SA 250B.

Chiude il buco descritto in `docs/analisi_obiettivi_controllo_contabile.md`
§3 e §4: oggi ogni pratica riparte da un master vuoto, quindi non c'è modo
di sapere se una carenza segnalata a T-1 è stata sistemata a T. Questa
funzione non decide da sola che qualcosa è stato risolto (quel giudizio
resta umano, coerente con `TEMPLATE_RULES.md` e con la Fase 0): porta solo
avanti l'informazione, marcando ogni finding riportato come `status="aperto"`
di default e collegandolo con `previous_finding_id` alla riga del trimestre
precedente.
"""

from __future__ import annotations

from backend.domain.models import Finding
from backend.domain.store import EvidenceStore


def carry_forward_open_findings(
    store: EvidenceStore,
    *,
    client: str,
    new_pratica_id: str,
    new_period: str,
) -> list[Finding]:
    """Riporta nella nuova pratica ogni Finding non `sistemato` del cliente.

    Per ciascun finding aperto trovato nello store crea (e salva) un nuovo
    `Finding`:
    - stessa `section`, `sa250b_check`, `kind`, `description` del finding di origine
      (il testo non cambia da solo: se la carenza si è evoluta, serve un umano
      che lo riscriva, non questa funzione);
    - `status="aperto"` sempre, anche se il finding di origine era `"in_corso"`:
      il sistema non promuove/eredita uno stato più avanzato senza una nuova
      verifica in QUESTA pratica;
    - `previous_finding_id` = id del finding di origine, `first_raised`
      copiato invariato (resta fisso lungo tutta la catena, vedi docstring
      di `Finding` in backend/domain/models.py);
    - `resolved_in=None`: la chiusura, quando arriva, la scrive un umano (o
      una fase futura del motore di verifica) su QUESTA nuova riga, non qui.

    Ritorna la lista dei nuovi `Finding` (già salvati nello store).
    """
    open_findings = store.open_findings_for_client(client)
    carried: list[Finding] = []
    for prev in open_findings:
        nf = Finding(
            client=prev.client,
            pratica_id=new_pratica_id,
            period=new_period,
            section=prev.section,
            sa250b_check=prev.sa250b_check,
            kind=prev.kind,
            description=prev.description,
            status="aperto",
            first_raised=prev.first_raised,
            previous_finding_id=prev.id,
            resolved_in=None,
        )
        store.save_finding(nf)
        carried.append(nf)
    return carried
