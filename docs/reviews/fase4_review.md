# Revisione Fase 4 — renderer Excel come consumatore di VerificationResult

Branch: `redesign/fase4-renderer-excel-dominio` (sopra la documentazione già committata su `redesign/fase3b-dashboard-ui`), commit `7b7a33f`. Revisione indipendente sul branch.

## Cosa è stato verificato

`git diff redesign/fase3b-dashboard-ui..redesign/fase4-renderer-excel-dominio --stat`: 4 file, esattamente quelli dichiarati (`backend/domain/api.py`, `backend/domain/excel_renderer.py` nuovo, `tests/test_domain_api.py`, `tests/test_domain_excel_renderer.py`). Nessun file fuori da questo elenco.

`backend/domain/api.py`: il nuovo endpoint `GET /pratiche/{id}/export.xlsx` riusa `store.latest_verification_results` (già esistente, non reinventato) e `backend.workspace.output_dir` (idem) — nessuna duplicazione di logica già presente. Ritorna 404 se la pratica non esiste, 409 con messaggio chiaro se non ci sono ancora verifiche salvate — esattamente il comportamento richiesto (niente ricalcolo a sorpresa).

`backend/domain/excel_renderer.py` letto per intero: la mappa sezione→cella INDICE (`F10..F18`) è identica, verificata riga per riga, a quella in `backend/fill.py:1070`; la colonna e il range della checklist "Richiesta doc" (`Q`, `Q5:Q42`) sono identici a `fill.py:421-431`. Il modulo importa `apply_status_fill`/`_add_status_cf` da `fill.py` invece di duplicarli, come richiesto. Non calcola nessuno stato: legge `VerificationResult.status` e lo scrive, punto — coerente con l'obiettivo "consumatore, non motore".

Rieseguiti tutti i test in un ambiente pulito (venv isolato, fuori dal bridge, stesso approccio già usato per la Fase 3b): **66 passati, 0 falliti** — coincide esattamente con quanto dichiarato da Codex. Nota per te: in questo ambiente pulito passano anche i due test storicamente falliti in ogni revisione precedente (`test_fill.py::test_scan_and_fill`, `test_ocr.py::test_ocr_engine_and_image`) — conferma retroattiva che erano davvero un limite del mount del bridge, non un problema del codice, come avevo sempre sospettato ma non potuto dimostrare fino ad ora.

Isolati i 6 test toccati da questa fase, tutti passati per nome: `test_renderer_writes_domain_results_and_preserves_datasnipper_sheets`, `test_scan_verify_and_section_override_end_to_end`, `test_rescan_replaces_evidence_and_does_not_duplicate_findings`, `test_clients_and_legacy_endpoints_still_work`, `test_domain_excel_export_end_to_end`, `test_domain_excel_export_requires_saved_verifications`. Verificato anche a mano che i 4 fogli `DS_INTERNAL_*` nel template sono `veryHidden` e che il test dichiarato ne copre esplicitamente la preservazione.

## Verdetto

Fase 4 approvata. Scope rispettato (nessun file del vecchio flusso toccato), mappe cella riusate correttamente dal codice esistente invece di reinventate, test coerenti con quanto dichiarato.

## Sul limite segnalato da Codex (dettaglio granulare mancante)

Concordo con l'analisi: l'Excel di dominio oggi comunica bene stato/motivazione/provenienza/mancanze, ma non importi F24, saldi bancari o righe di bilancino — perché `Evidence.fields` non è quasi mai popolata. È lo stesso gap già segnalato nella revisione di Fase 2 (integrazione di `extract.py` nell'`ingest_adapter`), qui diventato visibile in modo concreto perché ora c'è un secondo consumatore (l'Excel di dominio, oltre alla dashboard) che ne risentirebbe.

## Verso la prossima fase

Propongo di chiuderlo ora: una fase che collega le funzioni di estrazione già esistenti in `extract.py` (`find_f24_importo`, `find_payment_date`, `find_protocol`, `find_statement_balance`, `parse_giornale_last`, `parse_mastrini_last`) a `ingest_adapter.documents_to_evidence`, popolando `Evidence.fields` per i casi più diretti (E.1 F24, F.1 saldo banca, B.4/D.1 mastrini/giornale) — lasciando fuori scope, per lo stesso motivo di sempre (evitare di reinventare logiche di confronto cross-documento in una fase che dovrebbe restare piccola e verificabile), il confronto banche/DocFinance (F.2) e il bilancino (C). Preparo il prompt.
