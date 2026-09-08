# Revisione Fase 3a — API del motore di verifica

Branch: `redesign/fase3a-domain-api` (sopra `redesign/fase2b-motore-override-extra-items`), commit `099b814`. Prima fase che tocca un file esistente (`backend/main.py`) — verificata con più attenzione del solito su quel punto specifico.

## Cosa è stato verificato

`git diff` su `backend/main.py`: esattamente le due righe dichiarate (import del router + `include_router`), nient'altro. Tutti gli altri file toccati sono nuovi o dentro `backend/domain/`/`tests/`.

Letto `backend/domain/api.py` per intero: gestione errori sensata (404 se cliente o pratica non esistono, 409 se si riusa un `pratica_id` per un cliente diverso), la sostituzione atomica delle evidenze e la protezione contro il doppio carry-forward sono implementate esattamente come richiesto (`had_evidence`/`carry_already_done` controllati *prima* di scrivere, non dopo).

Rieseguiti tutti i test in modo indipendente (ho dovuto installare `fastapi`, `httpx`, `python-multipart` mancanti in questo ambiente — dipendenze reali dell'app, non del test): **61 passati, 2 falliti**, gli stessi due fallimenti preesistenti e non collegati già visti in tutte le revisioni precedenti. I 3 test di `test_domain_api.py` passano, incluso quello più importante per questa fase — `test_clients_and_legacy_endpoints_still_work` — che chiama `/api/health`, il nuovo `/api/domain/clients`, e poi il **flusso Excel esistente** (`POST /api/pratica`, `GET /api/state`) sulla stessa istanza dell'app, per dimostrare che il nuovo router non lo disturba. Non l'avevo chiesto in questa forma esatta, ma è il test più convincente possibile per questo rischio specifico.

## Verdetto

Fase 3a approvata. Il contratto JSON è chiaro, coerente con i modelli di dominio, e pronto per essere consumato dalla Fase 3b.

## Un dettaglio minore, non bloccante

`HumanOverride.decided_at` resta sempre `null` nella risposta di `POST /overrides`, perché `OverrideRequest` non lo include e il campo di default in `HumanOverride` è `None` (scelta presa in Fase 2b, coerente). Ha senso che l'endpoint stesso — che è il momento reale in cui la decisione viene registrata — lo valorizzi con il timestamp corrente se il chiamante non lo passa, invece di lasciarlo sempre vuoto. Non blocca la Fase 3b (la UI può semplicemente non mostrare quel campo per ora), ma vale la pena sistemarlo con una riga in più la prossima volta che si tocca `api.py`.

## Verso la Fase 3b

Il contratto è pronto per Codex: `GET /api/domain/clients`, `POST /api/domain/scan`, `GET /api/domain/pratiche/{id}/verifiche` (con `verifiche` come mappa A-I, non un array — scelta ragionevole, la tengo), `POST /api/domain/pratiche/{id}/overrides`. Preparo il prossimo prompt su questa base.
