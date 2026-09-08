# Prompt — Fase 2b: chiudere due gap del motore di verifica prima della dashboard

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Il redesign procede a fasi, ciascuna rivista prima della successiva. Prima di scrivere codice, leggi in ordine:

1. `docs/analisi_obiettivi_controllo_contabile.md` e `docs/piano_azione_redesign.md` — contesto generale, già letti nelle fasi precedenti.
2. `docs/reviews/fase1_review.md` — contiene la prima segnalazione del gap "controllo saltato per scelta umana" (§ "Il punto di decisione che Claude Code segnala"), con la direzione di soluzione già discussa con Ruben (un modello separato, non un campo su `Evidence`/`ClientConfig`).
3. `docs/reviews/fase2_review.md` — contiene la seconda segnalazione (le voci `extra_items` di un cliente non entrano nel calcolo di stato di una sezione) e un'osservazione sul caso reale del Collegio sindacale in `TEMPLATE_RULES.md` §7.6 (di contesto, non blocca questa fase).
4. `backend/domain/models.py`, `backend/domain/verification_engine.py`, `backend/domain/store.py` — il codice che questa fase modifica. **A differenza delle fasi precedenti, qui sei autorizzato a estendere i contratti di Fase 0** (è la fase pensata apposta per questo): aggiungi, non riscrivere quanto già c'è.
5. `regole/TEMPLATE_RULES.md` §4 e §4.1, e in particolare §7.4 (foglio D: "Dai documenti ricevuti non sono risultate criticità quindi si è deciso di non effettuare questa analisi per questo trimestre" — status INDICE = ✗) — è il caso reale che questa fase deve rendere rappresentabile, oggi non lo è.
6. `backend/models.py:PraticaIn` (`skip_items`, `na_items`, `skip_sections`) — il backend esistente ha già, in forma semplice, lo stesso concetto che manca ai contratti di dominio: un umano può marcare un item o un'intera sezione come saltata. Non stai inventando un concetto nuovo per lo studio, solo dandogli una casa nel nuovo modello.

## Gap 1 — "controllo saltato per scelta umana" (nessun `✗` possibile oggi)

Il motore di verifica (`backend/domain/verification_engine.py`) oggi non può mai produrre `✗`: `_connected_item_is_skipped` ritorna sempre `False` per costruzione, perché i contratti di Fase 0 non hanno un posto dove registrare "un umano ha deciso di non fare questo controllo questo trimestre" — distinto sia da "trovato" (`Evidence(found=True)`) sia da "N/A per il cliente in generale" (`ClientConfig.applicable_items`, che è una decisione permanente, non per-trimestre).

### Cosa costruire

Un nuovo modello in `backend/domain/models.py`, es. `HumanOverride`: rappresenta la decisione di un umano di saltare un controllo in QUESTA pratica. Deve poter esprimere due ambiti (guarda `PraticaIn.skip_items` vs `PraticaIn.skip_sections` per capire perché servono entrambi):

- **a livello di voce di catalogo** (es. "E.5 Intrastat non richiesto questo trimestre" — anche se il cliente ce l'ha in `ClientConfig.applicable_items` in generale);
- **a livello di sezione intera** (es. il caso reale del foglio D: "si è deciso di non fare il test campionario questo trimestre" — non è legato a un `item_id` specifico, è una decisione sulla sezione).

Campi minimi: id, `pratica_id`, l'ambito (voce o sezione) e il suo target, la decisione (`✗` o, se vuoi coprire anche il caso di un'eccezione N/A ad hoc non prevista dal `ClientConfig` del cliente, anche `N/A` — motiva la scelta se la includi), una nota libera, e chi/quando ha deciso (anche solo opzionali, per ora — non serve autenticazione in questa fase). Scrivi la docstring collegando esplicitamente il campo al vincolo di `TEMPLATE_RULES.md` §4: "`✗` solo se si salta il controllo... `N/A` = strutturalmente non esiste per il cliente" — sono concetti diversi, non farli collassare in uno solo.

Estendi `EvidenceStore` (`backend/domain/store.py`) con la persistenza di `HumanOverride` (salva/leggi per `pratica_id`), stesso stile (nessun ORM, JSON in una colonna) delle tabelle già presenti.

### Come collegarlo al motore

Modifica `evaluate_section`/`evaluate_pratica` (`verification_engine.py`) perché accettino anche gli `HumanOverride` della pratica (come parametro esplicito, es. `overrides: list[HumanOverride]` — stesso pattern con cui oggi ricevono `evidences`: il motore resta puro, non va a leggere lo store da solo). La precedenza corretta, in ordine:

1. Se esiste un override a livello di **sezione** per questa sezione → lo stato è direttamente quello dell'override (`✗`, o `N/A` se lo hai incluso), motivazione presa dalla nota dell'override. Questo vale **anche per le sezioni di solo giudizio umano** (A/D/H/I): il vincolo "mai `✓` automatico" riguarda l'assegnazione automatica di `✓`, non impedisce a un umano di marcare esplicitamente `✗` — sono cose diverse, non farle collidere. Riproduci qui il caso reale del foglio D Ferrero come test.
2. Altrimenti, per ogni voce collegata (catalogo standard + `extra_items`, vedi Gap 2), un `HumanOverride` a livello di voce marca quella singola voce come "soddisfatta ai fini del calcolo, saltata" — è quello che finalmente rende vero `_connected_item_is_skipped` (oggi uno stub sempre `False`: sostituiscilo con un controllo reale sugli override ricevuti, non limitarti ad aggiungere un altro livello sopra allo stub).
3. Il resto della logica (`✓` se tutto trovato e non giudizio, `wip` altrimenti) resta come in Fase 1.

Non toccare il vincolo esistente "mai `✓` automatico per A/D/H/I" — resta valido per il ramo `✓`, non per il ramo `✗` via override.

## Gap 2 — le voci `extra_items` di un cliente sono invisibili al motore

Oggi `evaluate_section` calcola le "voci collegate" a una sezione solo da `backend.catalog.SECTION_ITEMS` (il catalogo standard), filtrate per `client_config.applicable_items`. Le voci di `client_config.extra_items` (introdotte in Fase 0, collegabili a una sezione tramite il loro campo `section`, rese classificabili in Fase 2 da `client_classify.py`) non entrano mai in questo calcolo: anche se un documento viene trovato o dichiarato assente per una voce extra (Fase 2 lo fa già correttamente lato `Evidence`, vedi `docs/reviews/fase2_review.md`), il motore di verifica la ignora completamente nel calcolare lo stato della sezione.

### Cosa costruire

In `evaluate_section`, aggiungi alle "voci collegate" anche gli `item_id` di `client_config.extra_items` il cui campo `section` corrisponde alla sezione corrente — in aggiunta a quelle di `SECTION_ITEMS`, non al posto. Da quel momento la voce extra partecipa a `missing_items`, al calcolo di `✓`/`wip`, e (Gap 1) può anche essere oggetto di un `HumanOverride`.

## Cosa NON fare

Non toccare `backend/domain/ingest_adapter.py`, `backend/domain/client_classify.py`, `backend/domain/continuity.py` (fasi precedenti, già riviste — se qualcosa lì sembra dover cambiare per via di questi due gap, segnalalo nel riepilogo, non modificarlo qui). Non toccare `backend/main.py`, `backend/pipeline.py`, `backend/fill.py`, `backend/classify.py`, `backend/extract.py`, `backend/catalog.py` esistenti (stesso vincolo di sempre: l'app deve continuare a funzionare identica). Non iniziare la dashboard (Fase 3) né collegare questo al backend FastAPI: resta motore puro, testabile da pytest.

## Test richiesti

Estendi `tests/test_domain_verification_engine.py`: un test che riproduce il caso reale del foglio D Ferrero (override a livello di sezione → `✗`, indipendentemente da quali evidenze esistano); un test di override a livello di voce (una sezione con più voci collegate, una saltata via override, le altre trovate → `✓`, non `wip`); un test che dimostra che un `HumanOverride` di sezione su una sezione di giudizio (es. D) produce `✗` e non è bloccato dal vincolo "mai ✓ automatico" (che deve restare intatto per il ramo `✓`); un test con una voce `extra_items` mancante che compare in `missing_items` di una sezione che prima (Fase 2) non ne teneva conto. Estendi `tests/test_domain_store.py` per la persistenza di `HumanOverride`. Rilancia **tutti** i test esistenti (non solo quelli di dominio) per assicurarti di non aver rotto silenziosamente qualcosa nella nuova logica di precedenza di `evaluate_section` — in particolare il test end-to-end di Fase 1 su `fixtures/docs` (`test_domain_fase1_e2e.py`) deve continuare a passare invariato, visto che quella pratica non ha override né extra_items.

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase2-ingestion-client-config` (ti servono sia il motore di Fase 1 sia l'ingestion di Fase 2), es. `redesign/fase2b-motore-override-extra-items`. Commit locali, niente push né PR. Nel riepilogo finale: file creati/modificati, il testo esatto della nuova logica di precedenza in `evaluate_section` (in poche righe, non solo "ho aggiunto gli override"), risultato di tutti i test (non solo quelli nuovi), e qualunque punto in cui la scelta fra "override a livello di voce" e "a livello di sezione" ti è sembrata ambigua nel tradurre un caso reale di `TEMPLATE_RULES.md`.
