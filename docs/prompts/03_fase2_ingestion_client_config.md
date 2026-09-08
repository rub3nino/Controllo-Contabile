# Prompt — Fase 2: ingestion sensibile al cliente (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Il redesign è in corso su un branch dedicato, in fasi successive, ciascuna rivista prima di procedere alla successiva. Prima di scrivere codice, leggi in ordine:

1. `docs/analisi_obiettivi_controllo_contabile.md` — le 12 verifiche del principio SA 250B.
2. `docs/piano_azione_redesign.md` — il piano completo. Questa fase corrisponde agli stream 3+4 della tabella §5 ("ingestion pluggable" e "ClientConfig Ferrero").
3. `docs/reviews/fase0_review.md` e `docs/reviews/fase1_review.md` — le revisioni delle due fasi precedenti. Contengono decisioni già prese che questa fase deve rispettare.
4. `backend/domain/models.py` — i contratti dati (`Evidence`, `VerificationResult`, `Finding`, `ClientConfig`, `ClientCatalogItem`, `ClientBankAccount`). Fissati in Fase 0, **non vanno riaperti senza motivo** (stessa regola già seguita nelle fasi precedenti: se un contratto sembra insufficiente, segnalalo nel riepilogo finale invece di modificarlo silenziosamente).
5. `backend/domain/examples/ferrero.yaml` — il `ClientConfig` reale già scritto in Fase 0.
6. `backend/domain/ingest_adapter.py` e `backend/domain/verification_engine.py` (scritti in Fase 1) — **non toccarli in questa fase** se non per il punto specifico indicato al §2 sotto: sono già rivisti e approvati, e il motore di verifica resta responsabilità di un'altra fase.
7. Il codice esistente da riusare: `backend/catalog.py` (`ITEM_LABELS`, `EXTRA_HINTS`, `checklist_items()` — guarda come oggi il matching per parola chiave sul nome file già funziona, è la stessa tecnica da riusare) e `backend/classify.py` (`scan_folder`, la funzione che oggi produce `DocumentOut` per ogni file).

## Il problema che questa fase risolve

Oggi `classify.py` classifica ogni file solo contro le 25 voci standard del catalogo (`ITEM_LABELS`/`EXTRA_HINTS`, uguali per tutti i clienti). `ClientConfig.extra_items` (Fase 0) è stato pensato apposta per i casi che il template standard non prevede — l'esempio reale è il "Libro verbali del Collegio sindacale" per Ferrero, segnalato come APERTO in `TEMPLATE_RULES.md` §7.6 — ma oggi non esiste alcun meccanismo che classifichi un file contro una voce extra di un cliente: il campo esiste nel modello, ma non è collegato a nulla che lo usi.

## Cosa costruire

### 1. Classificazione sensibile al cliente

Un nuovo modulo, es. `backend/domain/client_classify.py`, con una funzione (es. `scan_folder_for_client(root, pratica_id, client_config) -> list[DocumentOut]`) che: fa girare `classify.scan_folder` così com'è (riusalo, non riscriverlo — è già testato e in produzione), e in più prova a classificare i file rimasti senza `item_id` contro le voci di `client_config.extra_items`, usando un meccanismo di parole chiave (hint) analogo a `EXTRA_HINTS` in `catalog.py`.

**Nota su un contratto insufficiente, da correggere qui:** `ClientCatalogItem` (in `backend/domain/models.py`) oggi ha solo `id`, `label`, `section`, `note` — non ha un campo per le parole chiave di classificazione. Senza quello, non è possibile classificare nulla contro una voce extra. Aggiungi un campo `hints: list[str] = Field(default_factory=list)` a `ClientCatalogItem`, con una docstring che spiega perché (stesso ruolo di `EXTRA_HINTS` in `catalog.py`, ma per-cliente invece che globale). È un'estensione additiva (nuovo campo opzionale, default lista vuota): non deve rompere niente di quanto scritto in Fase 0/1 — verificalo rilanciando `tests/test_domain_contracts.py` e `tests/test_domain_fase1_e2e.py` dopo la modifica. Segnala comunque questa modifica per nome nel riepilogo finale, perché tocca un file (`models.py`) che un'altra fase potrebbe modificare in parallelo per un motivo diverso (vedi §4).

Aggiorna anche `backend/domain/examples/ferrero.yaml`: aggiungi il Collegio sindacale come `extra_items` con hint plausibili (es. `["collegio sindacale", "verbale collegio"]`), visto che ora il meccanismo per rappresentarlo esiste davvero — oggi quel file lo lascia deliberatamente vuoto con un commento che spiega perché (era una decisione aperta, non presa). Se decidi di popolarlo, aggiorna anche `tests/test_domain_contracts.py::test_ferrero_has_25_catalog_items_and_17_banks` (che oggi asserisce `extra_items == []`) di conseguenza — non lasciare un test che contraddice il file che dovrebbe validare.

### 2. Evidence anche per le voci extra (fix a `ingest_adapter.py`)

C'è un problema concreto in quanto scritto in Fase 1: `backend/domain/ingest_adapter.py::documents_to_evidence` genera `Evidence(found=False)` solo per le voci in `client_config.applicable_items` (le 25 standard). Le voci di `client_config.extra_items` non vengono mai controllate: se un cliente ha il Collegio sindacale configurato come voce extra ma il documento non arriva, oggi il sistema non se ne accorgerebbe — nessuna `Evidence`, né trovata né assente, verrebbe mai generata per quella voce.

Estendi `documents_to_evidence` (non riscriverlo da zero: è una funzione piccola e già testata, modificala minimamente) perché consideri applicabili anche gli `item_id` di `client_config.extra_items`, allo stesso modo delle voci standard. Aggiungi test che coprano questo caso esplicitamente (un `ClientConfig` con un `extra_item`, un documento che lo soddisfa, un documento assente che non lo soddisfa) — puoi estendere `tests/test_domain_ingest_adapter.py`. Rilancia anche i test esistenti di quel file per assicurarti di non aver rotto nulla.

### 3. Anagrafica banche: solo collegamento, non ancora integrazione

`ClientConfig.banks` (17 conti nel caso Ferrero) esiste dalla Fase 0 ma oggi non è usato da nessuna parte. Il matching e/c per banca oggi avviene solo per parola chiave generica (`EXTRA_HINTS["F.1"]` in `catalog.py`, nomi banca in chiaro). Non serve integrare in questa fase un matching preciso conto-per-conto (richiederebbe leggere `extract.py` ed è più lavoro di quanto valga qui): **limita l'intervento a segnalare esplicitamente**, nel riepilogo finale, che questo resta un gap aperto per una fase successiva (probabilmente insieme all'integrazione di `extract.py` nell'adapter, già segnalata come mancante nel riepilogo di Fase 1). Non improvvisare un matching approssimativo solo per "fare qualcosa" su questo punto.

### 4. Cosa NON fare

Non toccare `backend/domain/verification_engine.py` né `backend/domain/continuity.py`: sono stati scritti e approvati in Fase 1, e il motore di verifica resta lavoro di un'altra fase (chi lo tocca deve leggere prima `docs/reviews/fase1_review.md` per intero). Se durante questa fase ti accorgi che il motore di verifica dovrebbe includere le voci `extra_items` nel calcolo di una sezione (oggi `evaluate_section` guarda solo `SECTION_ITEMS`, che è il catalogo standard, non le voci extra di un cliente) — è vero, è un gap reale collegato a questa fase — **non risolverlo qui**: segnalalo per nome nel riepilogo finale come dipendenza per la fase che toccherà `verification_engine.py`. Non modificare `backend/main.py`, `backend/pipeline.py`, `backend/fill.py`, `backend/classify.py`, `backend/extract.py`, `backend/catalog.py` esistenti (stesso vincolo delle fasi precedenti: l'app deve continuare a funzionare identica a oggi). Non implementare il matching banche preciso (vedi punto 3).

## Test richiesti

Oltre ai test già menzionati (estensione di `test_domain_ingest_adapter.py`, eventuale aggiornamento di `test_domain_contracts.py` se popoli il Collegio sindacale in `ferrero.yaml`): un test di non regressione che confronta `scan_folder_for_client` con un `ClientConfig` senza `extra_items` contro `classify.scan_folder` sugli stessi file (`fixtures/docs`) — i risultati devono essere identici, per dimostrare che il nuovo livello non altera il comportamento esistente quando non c'è nulla di client-specific da classificare. Un test end-to-end con un `ClientConfig` sintetico che ha un `extra_item` e un file di test (puoi crearlo in una cartella temporanea, non serve aggiungerlo a `fixtures/docs`) che lo soddisfa, per dimostrare che la classificazione extra funziona davvero, non solo che compila.

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase1-motore-verifica` (non da `main` né da `fase0`: ti servono `ingest_adapter.py` e gli altri file di Fase 1), es. `redesign/fase2-ingestion-client-config`. Commit locali, niente push né PR. Nel riepilogo finale: file creati/modificati (incluso il campo aggiunto a `ClientCatalogItem`, motivalo), risultato dei test (vecchi e nuovi), e — punto importante — l'elenco esplicito dei gap segnalati e non risolti (matching banche, `extra_items` non ancora visibili al motore di verifica) così chi legge il riepilogo non deve dedurli dal codice.
