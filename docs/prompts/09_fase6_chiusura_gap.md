# Prompt — Fase 6: chiudere i gap minori rimasti aperti (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Il redesign procede a fasi, ciascuna rivista prima della successiva. Prima di scrivere codice, leggi in ordine:

1. `docs/piano_azione_redesign.md` — contesto generale.
2. `docs/reviews/fase3a_review.md` (il punto su `decided_at` sempre `null`), `docs/reviews/fase3b_review.md` (il punto sulla cronologia degli override non esposta), `docs/reviews/fase5_review.md` (stato attuale del motore, e la nota su F.2/bilancino/date verbali lasciati fuori scope in Fase 5).
3. `backend/domain/api.py` per intero — in particolare `OverrideRequest` e `create_override` (righe ~31-37 e ~126-132).
4. `backend/domain/store.py` — `human_overrides_for_pratica(pratica_id) -> list[HumanOverride]` (riga ~158): **esiste già**, questa fase la espone via API, non la reimplementa.
5. `backend/domain/models.py` — `HumanOverride` (in particolare `decided_at: str | None`, riga ~342).
6. `backend/domain/ingest_adapter.py` per intero — `_extracted_fields(doc)` (Fase 5): il pattern da riusare per gli item C.1/C.2/C.4 (vedi punto 3 sotto).
7. `backend/extract.py` — `find_dates(text) -> list[str]` (tutte le date `dd/mm/yyyy` nel testo).
8. `backend/fill.py`, funzione `_fill_verbali` (cerca `mapping = [(11, "C.1"), (13, "C.2"), (10, "C.4")]`): come oggi estrae la data dai verbali — `extract_file(Path(doc.path), ocr=True)` poi `find_dates(text)`. Guarda cosa fa con la lista di date ritornata (quale elemento usa, se il primo) per capire cosa replicare.

Questa fase chiude tre gap minori segnalati in revisioni precedenti, indipendenti tra loro — puoi affrontarli in ordine, ciascuno è un cambiamento piccolo e verificabile a sé.

## Gap 1 — cronologia degli HumanOverride non consultabile

Oggi si può registrare un override (`POST /pratiche/{id}/overrides`) e vederne l'effetto ricalcolando `/verifiche`, ma non c'è modo di rivedere "chi ha saltato cosa, quando, con quale nota" per una pratica.

**Cosa costruire**: un nuovo endpoint `GET /api/domain/pratiche/{pratica_id}/overrides` in `backend/domain/api.py` che ritorna la lista di `HumanOverride` per quella pratica, usando `store.human_overrides_for_pratica(pratica_id)` (già esistente — non aggiungere logica nuova allo store per questo). 404 se la pratica non esiste, stesso pattern degli altri endpoint. Forma di risposta: `{"overrides": [HumanOverride, ...]}`, coerente con lo stile delle altre risposte del router.

## Gap 2 — `decided_at` sempre `null`

`OverrideRequest` non porta `decided_at`, e `HumanOverride.decided_at` di default è `None` — quindi ogni override registrato oggi non ha mai un timestamp, anche se è il momento reale in cui la decisione viene presa.

**Cosa costruire**: in `create_override` (`backend/domain/api.py`), se il chiamante non ha passato `decided_at` (aggiungilo come campo opzionale a `OverrideRequest`, per permettere comunque a un chiamante di specificarlo esplicitamente se serve, es. per un import/migrazione), valorizzalo con il timestamp corrente (UTC, formato ISO 8601 — guarda come altri timestamp del progetto sono formattati, es. `Evidence.collected_at`/`VerificationResult.computed_at`, e usa la stessa convenzione, non inventarne una nuova) prima di costruire l'oggetto `HumanOverride`.

## Gap 3 — date dei verbali (C.1/C.2/C.4) non estratte in `Evidence.fields`

La Fase 5 ha collegato l'estrazione per E.1/F.1/B.4/D.1, lasciando esplicitamente fuori scope le date dei verbali (C.1/C.2/C.4) perché non passano da una funzione dedicata di `extract.py` ma da `find_dates` + logica di scelta in `fill.py`. È il più semplice dei gap ancora aperti (a differenza di F.2/bilancino, vedi sotto): un solo valore per documento, nessun confronto cross-documento.

**Cosa costruire**: estendi `_extracted_fields` in `backend/domain/ingest_adapter.py` per gli item `C.1`, `C.2`, `C.4`: `extract_file(path, pages="key")` → `find_dates(text)` → se la lista non è vuota, un `ExtractedField(kind="data_verbale", value=<prima data della lista>)` (replica la stessa scelta — primo elemento — che fa `_fill_verbali` in `fill.py`, per coerenza; se leggendo `_fill_verbali` scopri che sceglie diversamente, es. l'ultima data o una euristica più elaborata, replica quella e motivalo nel riepilogo invece di semplificare). Stesso vincolo della Fase 5: avvolgi in `try/except`, degrado silenzioso a `fields=[]`, mai `pages="all"`.

## Cosa NON fare in questa fase (e perché)

**F.2 (confronto saldi DocFinance) e bilancino (item C, righe conto)** restano fuori scope, non per pigrizia ma per un motivo tecnico preciso da non scavalcare qui: `parse_docfinance_saldi`/`parse_csv_accounts`/`parse_xlsx_accounts` ritornano **liste di righe strutturate** (banca/valuta/saldo per F.2, conto/nome/importo per il bilancino), non un singolo valore — e `ExtractedField` oggi è piatto (`kind`, `value: str`, `unit`). Rappresentarle bene richiede una decisione di modello (un `ExtractedField` per riga con `value` che serializza la riga, o un altro tipo) che è meglio prendere in una fase dedicata e piccola, non infilare qui di corsa. Se hai un'idea chiara e minimale per farlo senza toccare `models.py`, proponila nel riepilogo finale invece di implementarla — voglio valutarla prima.

Non toccare `backend/fill.py`, `backend/pipeline.py`, `backend/main.py`, `backend/domain/verification_engine.py`, `backend/domain/excel_renderer.py`, `backend/extract.py`. Non modificare `Evidence`/`VerificationResult`/`Finding` in `models.py` — solo `OverrideRequest` (Gap 2) può guadagnare un campo opzionale.

## Test richiesti

Per il Gap 1: un test HTTP che registra due override su una pratica e verifica che `GET /overrides` li ritorni entrambi, e un test che verifica 404 su pratica inesistente. Per il Gap 2: un test che chiama `POST /overrides` senza `decided_at` e verifica che la risposta abbia un `decided_at` valorizzato (non `null`), e un test che lo passa esplicitamente e verifica che venga rispettato (non sovrascritto). Per il Gap 3: estendi `tests/test_domain_ingest_adapter.py` con un test su un verbale reale (guarda `fixtures/docs/Verbale_CDA_05.05.2026.txt`) che verifica `Evidence.fields` contenga `kind="data_verbale"` con il valore atteso, e un test di degrado silenzioso su path inesistente, stesso pattern della Fase 5. Rilancia **tutta** la suite `tests/` e riporta il conteggio pass/fail — deve coincidere con quello della Fase 5 più i test nuovi, nessuna regressione.

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase5-estrazione-campi-dominio`, es. `redesign/fase6-chiusura-gap-minori`. Commit locali, niente push né PR (il push lo fa Ruben di persona). Nel riepilogo finale: per ciascuno dei 3 gap, cosa hai cambiato e un esempio concreto (risposta JSON di `GET /overrides`, un `decided_at` reale prodotto, il campo `data_verbale` estratto dal verbale di fixture); risultato di tutti i test; ed eventuali osservazioni su come rappresentare F.2/bilancino se hai un'idea da proporre per una fase futura.
