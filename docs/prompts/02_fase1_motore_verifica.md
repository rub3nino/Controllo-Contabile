# Prompt — Fase 1: evidence store + motore di verifica (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Prima di scrivere codice, leggi in ordine:

1. `docs/analisi_obiettivi_controllo_contabile.md` — le 12 verifiche del principio SA 250B e come si mappano sulle 9 carte A–I.
2. `docs/piano_azione_redesign.md` — il piano completo (architettura a livelli, fasi, decisione "dashboard prima, Excel derivato").
3. `docs/reviews/fase0_review.md` — la revisione della fase precedente: contiene due piccoli fix da includere in questa fase (vedi §5 sotto) e il parere sulle scelte di design della Fase 0, che qui vanno rispettate, non riaperte senza motivo.
4. `backend/domain/models.py` e `backend/domain/examples/ferrero.yaml` — i contratti dati già chiusi in Fase 0 (`Evidence`, `VerificationResult`, `Finding`, `ClientConfig`). **Sono l'interfaccia che questa fase deve rispettare, non ridiscutere.** Se durante il lavoro scopri che un contratto è davvero insufficiente, fermati e segnalalo nel riepilogo finale invece di modificarlo silenziosamente — altri (Codex, in una fase parallela) potrebbero già farci affidamento.
5. `regole/TEMPLATE_RULES.md` §4 e §4.1 in particolare — è la logica di calcolo dello stato (✓/wip/✗/N/A) già scritta in linguaggio naturale, che questa fase deve tradurre in codice.
6. Il codice esistente da **riusare, non riscrivere**: `backend/catalog.py` (in particolare `SECTION_ITEMS`, che mappa già ogni sezione A–I alle voci di catalogo collegate, e `checklist_items()`), `backend/classify.py` (classificazione file → voce di catalogo, oggi produce `DocumentOut`), `backend/provenance.py` (modello di tracciabilità, stesso vocabolario di `Evidence`), `backend/pipeline.py` (in particolare il metodo `_apply_overrides_to_checklist`, che oggi contiene già un pezzo — semplificato — della logica di stato: guardalo per capire cosa esiste già prima di reinventarlo).

## Obiettivo di questa fase

Costruire il **livello 2 (evidence store)** e il **livello 3 (motore di verifica)** del piano, sopra ai contratti della Fase 0. Alla fine di questa fase, dato un `ClientConfig` e una cartella di documenti classificati, il sistema deve poter produrre — senza passare da nessun Excel — un `VerificationResult` per ciascuna delle 9 sezioni A–I, con stato, motivazione ed evidenze collegate, più l'elenco dei `Finding` ancora aperti riportati dal trimestre precedente. Questo è il "cuore nuovo" descritto nel piano: non tocca ancora la dashboard (Fase 3) né l'Excel esistente, ma è ciò che li alimenterà entrambi.

Non stai ancora collegando questo al backend FastAPI esistente (`main.py`), né costruendo la UI. Fase 1 è motore puro più persistenza, testabile da riga di comando/pytest.

## Cosa costruire

### 1. Evidence store (persistenza)

Un modulo, es. `backend/domain/store.py`, con un database SQLite (usa `sqlite3` della standard library o `sqlmodel`/`sqlalchemy` se preferisci — a tua discrezione, ma giustifica la scelta nel riepilogo finale) che persiste `Evidence`, `VerificationResult` e `Finding` così come definiti in `backend/domain/models.py`, senza reinventarne la forma. Il database deve vivere fuori dalla cartella del repository tracciata da git (es. sotto `storage/`, che è già una cartella esistente nel progetto — controllala prima di crearne una nuova) o comunque in un percorso escluso da `.gitignore`, per lo stesso motivo per cui `output/` non è versionato.

Funzioni minime richieste: salvare/leggere evidenze per una pratica; salvare un nuovo `VerificationResult` (ricorda: è immutabile, ogni calcolo è un nuovo record, mai un update — vedi la docstring del modello); leggere l'ultimo `VerificationResult` per sezione di una pratica; salvare un `Finding`; leggere i `Finding` ancora aperti (`status != "sistemato"`) per un cliente, indipendentemente dalla pratica in cui sono stati sollevati — è la query che serve per implementare le verifiche 11/12 del principio.

### 2. Adapter ingestion → Evidence

Un modulo, es. `backend/domain/ingest_adapter.py`, che prende l'output già prodotto da `backend/classify.py` (`DocumentOut`, vedi `backend/models.py`) e lo traduce in `Evidence`. Questo è un adapter sottile: non deve reimplementare la classificazione, solo tradurre il vocabolario. Deve anche generare esplicitamente le `Evidence(found=False)` per ogni `item_id` di `ClientConfig.applicable_items` che non risulta in nessun documento classificato — è il punto in cui il contratto "abbiamo cercato e non c'è" (deciso in Fase 0) prende vita.

### 3. Motore di verifica

Un modulo, es. `backend/domain/verification_engine.py`, con una funzione per sezione (o una funzione generica parametrizzata sulla sezione — a tua scelta di design) che, dati: la lista di `Evidence` di una pratica, il `ClientConfig` del cliente, e la mappa sezione→voci collegate (`backend.catalog.SECTION_ITEMS`, riusala, non duplicarla), produce un `VerificationResult`. Traduci qui la "regola di calcolo conservativa" di `TEMPLATE_RULES.md` §4.1:

- `✗` se tutte le voci collegate (tra quelle in `ClientConfig.applicable_items` per quella sezione) sono assenti-per-scelta (nel nuovo modello: nessuna `Evidence(found=False)` con motivo "skip" — per ora, poiché Fase 1 non ha ancora un concetto esplicito di "skip deciso da un umano" nei contratti Fase 0, tratta questo caso come `wip` di default e segnalalo nel riepilogo finale come punto da chiarire con Ruben, non decidere tu se aggiungere un campo nuovo a `Evidence`/`ClientConfig`);
- `✓` se ogni voce collegata non saltata ha `Evidence(found=True)`;
- `wip` in tutti gli altri casi (compreso: nessuna evidenza affatto, evidenza parziale, sezioni di solo giudizio umano A/D/H/I dove — coerentemente con `TEMPLATE_RULES.md` §4.1 — l'app non decide mai da sola `✓`).

Per le sezioni A, D, H, I (giudizio umano, vedi piano e `TEMPLATE_RULES.md` §7.1/7.4/7.8/7.9): il motore calcola comunque `missing_items` e `evidence`, ma non deve mai emettere `✓` autonomamente per queste — replica lo stesso vincolo già rispettato da `TEMPLATE_RULES.md` §4.1 ("L'app non marca H come ✓ da sola"). Scrivi un test esplicito che verifica questo vincolo.

**Non implementare in questa fase:** le soglie di materialità (`ClientConfig.soglia_scostamento_bancario_eur`/`soglia_variazione_significativa_g_pct` sono `None` per decisione esplicita di Ruben — finché restano `None` il motore non genera `Anomaly` di tipo scostamento/variazione, si limita a segnalare found/missing) e la logica "campi meccanici compilati" per la sezione E/C/G descritta in `TEMPLATE_RULES.md` §4.1 (richiede di leggere dati strutturati da bilancino/estratti che oggi `extract.py` produce in parte ma che questa fase non deve integrare — limita il calcolo di `✓` a "tutte le voci collegate trovate", segnalalo esplicitamente come semplificazione nel riepilogo finale).

### 4. Continuità fra trimestri (verifiche 11/12)

Una funzione, es. in `backend/domain/continuity.py`, che data una pratica nuova e il cliente, recupera dallo store i `Finding` ancora aperti del cliente (indipendentemente dalla pratica), e produce per ciascuno un `Finding` nuovo con `previous_finding_id` valorizzato e `status="aperto"` di default (il sistema **non decide da solo** che una carenza è stata sistemata — questo resta giudizio umano, coerente col vincolo di Fase 0 e con `TEMPLATE_RULES.md`: la funzione porta avanti l'informazione, non la chiude). Questo è il pezzo che oggi manca del tutto nel processo (ogni pratica riparte da un master vuoto) e che questa fase introduce per la prima volta.

## Cosa NON fare in questa fase

Non toccare `backend/main.py`, `backend/pipeline.py`, `backend/fill.py` — l'app esistente deve continuare a funzionare identica (stesso controllo di prima/dopo che hai già fatto in Fase 0: `GET /api/health`). Non costruire la dashboard né endpoint HTTP per il motore di verifica (Fase 3). Non modificare `backend/domain/models.py` per aggiungere concetti nuovi (es. lo "skip deciso da un umano" citato sopra) senza prima segnalarlo nel riepilogo — se un contratto della Fase 0 risulta davvero incompleto, la modifica va discussa, non fatta silenziosamente in mezzo a un'altra fase. Non implementare le soglie di materialità con un valore a caso.

## Due fix da includere (dalla revisione della Fase 0)

1. Aggiungi `pytest` (e `pyyaml` se non già presente) a un `requirements-dev.txt` nuovo (non mescolarlo con `requirements.txt`, che è runtime). Motivo: senza questo, i test della Fase 0 non sono riproducibili da un clone pulito — l'ha segnalato Claude Code stesso nel report della Fase 0.
2. In `backend/domain/models.py`, aggiungi un validator su `VerificationResult` che rifiuta `status=""` a runtime (senza toccare il `Literal Status` condiviso — resta riusato come deciso in Fase 0). È un fix a costo quasi zero che chiude una falla segnalata in revisione.

## Test richiesti

Usa `fixtures/docs` (la cartella demo sintetica già presente, senza dati cliente) come caso end-to-end: fai girare `classify.py` su quei file, traduci in `Evidence` con l'adapter, calcola `VerificationResult` per tutte le 9 sezioni con un `ClientConfig` minimo scritto per questo test (non serve replicare Ferrero), e verifica che gli stati calcolati siano quelli plausibili dati i file presenti in `fixtures/docs` (guarda cosa contiene quella cartella prima di scrivere le assert). Aggiungi anche test unitari mirati su: la regola ✗/✓/wip per una sezione con evidenze parziali; il vincolo "mai ✓ automatico" per le sezioni A/D/H/I; la catena di continuità di un `Finding` che sopravvive a una pratica successiva (puoi estendere lo scenario già testato in Fase 0, `test_finding_continuity_chain_across_quarters`, ma stavolta passando dallo store invece che costruendo gli oggetti a mano).

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase0-contratti-dati` (non da `main`: `main` non ha ancora `backend/domain/`), es. `redesign/fase1-motore-verifica`. Commit locali, niente push né PR. Nel riepilogo finale, oltre ai file creati, segnala esplicitamente: le semplificazioni introdotte (soglie non implementate, "campi meccanici" non verificato, skip-umano non modellato), qualunque punto in cui i contratti della Fase 0 ti sono sembrati insufficienti, e il risultato dei test sul caso `fixtures/docs`. Fermati lì: non collegare ancora questo al backend esistente né iniziare la dashboard (Fase 3).
