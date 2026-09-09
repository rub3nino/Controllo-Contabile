# Revisione Fase 6 — chiusura gap minori

Branch: `redesign/fase6-chiusura-gap-minori` (sopra `redesign/fase5-estrazione-campi-dominio`), commit `2064069`. Revisione indipendente sul branch.

## Cosa è stato verificato

`git diff redesign/fase5-estrazione-campi-dominio..redesign/fase6-chiusura-gap-minori --stat`: 4 file, esattamente quelli dichiarati.

**Gap 1** (`GET /pratiche/{id}/overrides`): letto per intero, 404 su pratica inesistente, riusa `store.human_overrides_for_pratica` senza aggiungere logica allo store, come richiesto.

**Gap 2** (`decided_at`): il formato usato — `datetime.now(timezone.utc).isoformat(timespec="seconds")` — è **identico** alla funzione `_now()` già usata in `backend/domain/models.py` per `Evidence.collected_at`/`VerificationResult.computed_at`. Nessuna convenzione nuova inventata, esattamente come richiesto. Un `decided_at` passato esplicitamente non viene sovrascritto (verificato nel codice e nel test dedicato).

**Gap 3** (date verbali C.1/C.2/C.4): qui Codex ha fatto meglio di quanto scritto nel mio prompt. Avevo indicato "prima data della lista" come default, ma leggendo `fill.py._fill_verbali` per verificarlo ho trovato che il comportamento reale è: prima prova la data nel **nome del file** (regex `(20\d{2})(\d{2})(\d{2})`), solo se assente usa `dates[-1]` (**l'ultima**, non la prima) del testo estratto. Codex ha replicato esattamente questa logica, non la mia semplificazione — corretto segnalarlo invece di implementare quello che avevo scritto io per sbaglio.

Rieseguiti tutti i test in ambiente pulito: **75 passati, 0 falliti**, coincide esattamente. Isolati i 4 test nuovi di `test_domain_api.py` (override history + timestamp) e verificato a mano — non solo dal nome — che `_extracted_fields` su `fixtures/docs/Verbale_CDA_05.05.2026.txt` produca davvero `data_verbale=05/05/2026`, e che un path inesistente degradi a `[]` senza eccezioni.

## Verdetto

Fase 6 approvata. I tre gap sono chiusi correttamente, con particolare merito per aver corretto una mia imprecisione nel prompt (Gap 3) invece di implementarla alla lettera.

## Sulla proposta per F.2/bilancino

L'idea di un `ExtractedField` per riga con `value` come JSON compatto è ragionevole e minimale (non tocca `models.py`), ma concordo sul non adottarla ora senza discuterla: rende `value` opaco per chiunque consumi il campo senza sapere che è JSON (dashboard, futuro renderer Excel) — varrebbe la pena valutare, quando servirà davvero, se non sia meglio un tipo dedicato (es. `Evidence` con un campo opzionale per righe strutturate) invece di sovraccaricare `ExtractedField`. Non è urgente: nessuno dei consumatori attuali (dashboard, Excel di dominio) ha ancora bisogno di F.2/bilancino.

## Stato del sistema a questo punto

Con Fase 0→6 il motore di dominio è completo su tutti i fronti aperti tranne il secondo cliente: verifica, continuità, override (con cronologia), API, dashboard, renderer Excel derivato, estrazione campo-per-campo sui 7 item più diretti (E.1, F.1, B.4, D.1, C.1, C.2, C.4). Resta in sospeso solo l'onboarding di un secondo cliente reale, che richiede le decisioni di merito che solo tu puoi prendere (soglie di materialità, fondi previdenziali, continuità Collegio sindacale) — pronto quando lo sei tu.
