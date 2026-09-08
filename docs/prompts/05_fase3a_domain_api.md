# Prompt — Fase 3a: esporre il motore di verifica via API (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Il redesign procede a fasi, ciascuna rivista prima della successiva, tutte finora additive (nessun file esistente toccato). **Questa fase è la prima eccezione controllata a quella regola**: deve collegare il motore di dominio (Fasi 0-2b) al backend FastAPI esistente, quindi tocca `backend/main.py` — ma solo in un punto preciso, vedi §3. Prima di scrivere codice, leggi in ordine:

1. `docs/analisi_obiettivi_controllo_contabile.md` e `docs/piano_azione_redesign.md` — contesto generale. Il piano (§7, decisione confermata da Ruben) dice che la **dashboard nativa è l'output primario**, l'Excel resta un renderer secondario. Questa fase costruisce l'API che la dashboard (Fase 3b, prompt successivo, per Codex) userà — tu non costruisci la UI React qui, solo l'API.
2. `docs/reviews/fase0_review.md`, `fase1_review.md`, `fase2_review.md`, `fase2b_review.md` — lo stato attuale del motore, già rivisto e approvato: 4 fasi di lavoro isolato in `backend/domain/`, mai collegato a nulla che gira davvero. Questa fase collega, per la prima volta, tutto quel lavoro a un endpoint HTTP reale.
3. `backend/domain/models.py`, `store.py`, `verification_engine.py`, `ingest_adapter.py`, `client_classify.py`, `continuity.py` — il motore che questa fase deve orchestrare. Non modificarne la logica interna (nessun cambiamento alle regole di calcolo, agli override, alla continuità): questa fase li chiama, non li riscrive.
4. `backend/domain/examples/ferrero.yaml` — l'unico `ClientConfig` reale scritto finora. Resta dov'è (è materiale di test/dimostrazione delle Fasi 0-2, altri test lo referenziano per percorso): non spostarlo, vedi §1 sotto per dove va invece la configurazione "vera".
5. `backend/main.py` — leggilo per intero prima di toccarlo. Nota come è strutturato: un singolo `Engine` globale (`backend/pipeline.py`), endpoint REST semplici, nessun router separato. Questa fase non cambia quello che c'è, aggiunge un router nuovo montato a parte (vedi §3).
6. `backend/workspace.py` — le funzioni esistenti per generare id di pratica e percorsi (`new_pratica_id`, `storage_root` o equivalenti, guarda i nomi esatti). Riusale invece di inventare una convenzione parallela: `backend/domain/store.py` (Fase 1) già dice nella sua docstring di riusare `backend.workspace.storage_root`.
7. `tests/` — cerca se esiste già un test che usa `fastapi.testclient.TestClient` contro `backend.main.app` (per capire lo stile di test HTTP già in uso nel progetto, se esiste, e riusarlo invece di inventarne uno nuovo).

## Il problema che questa fase risolve

Le Fasi 0-2b hanno costruito un motore di verifica completo e testato (evidence store, classificazione sensibile al cliente, calcolo di stato per le 9 sezioni, override umani, continuità dei finding) — ma **nessuna riga di quel codice gira mai**, se non dentro `pytest`. Non esiste un modo di dire "prendi questa cartella documenti per questo cliente e dimmi lo stato delle 9 sezioni" se non chiamando le funzioni a mano in un test. Questa fase costruisce l'API che rende il motore utilizzabile da un client HTTP reale (la futura dashboard).

## Cosa costruire

### 1. Configurazione cliente "vera" (distinta dagli esempi di test)

Crea una nuova cartella `backend/domain/clients/` (diversa da `backend/domain/examples/`, che resta per i test/dimostrazioni delle fasi precedenti — non toccarla, non spostarci nulla). Copia (non spostare) `backend/domain/examples/ferrero.yaml` in `backend/domain/clients/ferrero.yaml`: da questo momento quella è la configurazione che l'API userà davvero per il cliente Ferrero, mentre la copia in `examples/` resta materiale di riferimento per i test esistenti (che puntano a quel percorso — verificalo, non romperli).

Un modulo, es. `backend/domain/client_config_loader.py`: `load_client_config(client_id: str) -> ClientConfig` (legge `backend/domain/clients/{client_id}.yaml`, errore chiaro se non esiste) e `list_clients() -> list[dict]` (id + `display_name` di ogni file in quella cartella, per un futuro selettore cliente).

### 2. Un concetto che finora non serviva: la pratica come record persistito

Le Fasi 1-2b hanno sempre ricevuto `pratica_id`/`client`/`period` come parametri passati a mano nei test — non esiste ancora un posto dove il sistema ricordi "la pratica X è del cliente Y, periodo Z, cartella documenti W". Serve ora. Aggiungi un modello minimo in `backend/domain/models.py`, es. `PraticaRecord` (id, `client_id`, `client` — nome visualizzato, `period`, `documents_dir`, `created_at`), e la persistenza corrispondente in `EvidenceStore` (`save_pratica`, `get_pratica`). È un'estensione dei contratti come `HumanOverride` in Fase 2b: motivala nel riepilogo finale, non è un cambiamento nascosto.

### 3. Router API nuovo, montato con una sola riga in `main.py`

Un nuovo file, es. `backend/domain/api.py`, con un `fastapi.APIRouter`. Endpoint minimi:

- `POST /api/domain/scan` — body: `{client_id, period, documents_dir, pratica_id?}`. Genera/riusa `pratica_id` (riusa `backend.workspace` per la generazione se già esiste una funzione per questo), carica il `ClientConfig` del cliente, salva/aggiorna il `PraticaRecord`, esegue `client_classify.scan_folder_for_client` + `ingest_adapter.documents_to_evidence`, e salva le `Evidence` nello store. **Attenzione a un dettaglio non ovvio:** a differenza di `VerificationResult` (voluto immutabile fin da Fase 0), `Evidence` rappresenta lo stato *attuale* della cartella — se questo endpoint viene chiamato due volte sulla stessa pratica (rescan), non deve accumulare evidenze duplicate delle scansioni precedenti. Aggiungi un modo di sostituire (non solo aggiungere) le evidenze di una pratica nello store prima di salvare le nuove. Alla prima scansione di una pratica (nessuna evidenza precedente in store), esegui anche `continuity.carry_forward_open_findings` per il cliente — ma non ripeterlo su un rescan della stessa pratica (altrimenti i finding aperti verrebbero duplicati): usa la presenza di `Finding` già salvati per questa `pratica_id` come segnale che il carry-forward è già stato fatto.
- `GET /api/domain/pratiche/{pratica_id}/verifiche` — carica `PraticaRecord`, `ClientConfig`, le `Evidence` e gli `HumanOverride` salvati per la pratica, chiama `verification_engine.evaluate_pratica`, salva i 9 `VerificationResult` prodotti (è la "nuova istantanea di calcolo" prevista dal contratto immutabile di Fase 0 — va bene che ogni chiamata a questo endpoint ne produca una) e li ritorna, insieme ai `Finding` ancora aperti per il cliente (`store.open_findings_for_client`).
- `POST /api/domain/pratiche/{pratica_id}/overrides` — body: `{scope, target, decision, note, decided_by?}`. Crea e salva un `HumanOverride`. Non ricalcola da sé i `VerificationResult` (il chiamante richiama l'endpoint sopra per vedere l'effetto) — endpoint a responsabilità singola, più facile da testare e da usare da un client.
- `GET /api/domain/clients` — lista i client disponibili (usa `list_clients()`).

In `backend/main.py`, l'unica modifica ammessa: importare il router da `backend/domain/api.py` e montarlo (`app.include_router(...)`). Nient'altro in quel file cambia — verificalo tu stesso con `git diff` prima di consegnare, non fidarti della memoria di cosa hai toccato.

## Cosa NON fare

Non modificare la logica di `verification_engine.py`, `ingest_adapter.py`, `client_classify.py`, `continuity.py`, `store.py` oltre alle nuove funzioni di persistenza per `PraticaRecord` e alla sostituzione delle evidenze descritta al §3 — se durante il lavoro ti accorgi che una regola di calcolo dovrebbe cambiare, segnalalo, non modificarla qui. Non toccare `backend/pipeline.py`, `backend/fill.py`, `backend/classify.py`, `backend/extract.py`, `backend/catalog.py`: il flusso Excel esistente (Scansiona/Avvia) deve continuare a funzionare esattamente come oggi, in parallelo a questo nuovo flusso, non sostituito da esso. Non costruire nessuna pagina/componente React: è la Fase 3b, un prompt separato per Codex, che partirà da questa API come contratto. Non esporre endpoint di cancellazione/reset dello store in questa fase (non è richiesto e allarga la superficie senza necessità).

## Test richiesti

Test HTTP con `fastapi.testclient.TestClient` (o `httpx.AsyncClient` se è già lo stile del progetto) contro l'app con il nuovo router montato: uno scenario end-to-end su `fixtures/docs` (crea un `backend/domain/clients/demo.yaml` minimale per il test, coerente con quanto già usato in `tests/test_domain_fase1_e2e.py`) — `POST /scan` seguito da `GET /verifiche` deve dare le stesse 9 sezioni `wip` già viste in quel test; poi un `POST /overrides` in stile "sezione D saltata" seguito da un nuovo `GET /verifiche` deve mostrare D a `✗`, verificando che l'endpoint richiami correttamente il motore con gli override appena salvati. Un test che chiama `/scan` due volte sulla stessa pratica e verifica che le evidenze non raddoppino e i finding non vengano duplicati. Un test di non regressione sul resto dell'app: `GET /api/health` prima e dopo, e se esiste già un test che esercita il flusso `POST /api/pratica` + `GET /api/state` esistente, rilancialo e conferma che passa invariato. Rilancia infine **tutta** la suite `tests/` e riporta il conteggio pass/fail — deve coincidere con quello delle fasi precedenti più i test nuovi (nessuna nuova regressione).

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase2b-motore-override-extra-items`, es. `redesign/fase3a-domain-api`. Commit locali, niente push né PR. Nel riepilogo finale: file creati/modificati (con il diff esatto, anche solo incollato, delle due righe toccate in `main.py` — voglio poterlo verificare a colpo d'occhio), la forma esatta delle risposte JSON dei 4 endpoint (è il contratto che userà Codex nella prossima fase, deve essere chiaro senza dover leggere il codice), risultato di tutti i test, e ogni scelta di design su cui vuoi un parere prima che Codex costruisca la UI sopra.
