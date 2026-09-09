# Prompt — Fase 7: onboarding del secondo cliente (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Il redesign ha attraversato 6 fasi (motore di verifica, API di dominio, dashboard React, renderer Excel derivato, estrazione campo-per-campo) tutte costruite e validate sul caso Ferrero. Questa fase è **il vero collaudo dell'architettura**: onboardare un secondo cliente reale, **Suedwolle Group Italia S.p.A.** ("SWGI" nei nomi dei file), usando solo un nuovo `ClientConfig`, senza toccare una riga di codice del motore. Se durante questa fase scopri che serve modificare `verification_engine.py`, `ingest_adapter.py`, `excel_renderer.py` o `client_classify.py` per far funzionare questo cliente, **fermati e segnalalo nel riepilogo invece di modificarli**: è esattamente il segnale che la separazione tra livelli non è ancora pulita (§6 del piano), e voglio saperlo prima di decidere come intervenire.

Prima di scrivere codice/config, leggi in ordine:

1. `docs/piano_azione_redesign.md` §6 — il criterio di successo di questa fase.
2. `backend/domain/clients/ferrero.yaml` **per intero** — il precedente diretto, sia come formato sia come stile: nota come ogni scelta non ovvia (conti bancari APERTI, soglie `null` invece di inventate, `extra_items` con nota sulla decisione non presa) è documentata con un commento nel file stesso, non lasciata implicita. Fai lo stesso per SWGI.
3. `backend/domain/models.py` — `ClientConfig`, `ClientCatalogItem`, `ClientBankAccount` (i campi esatti da popolare).
4. `backend/domain/client_config_loader.py` — dove va il file (`backend/domain/clients/{client_id}.yaml`) e come viene caricato.
5. I documenti del cliente, cartella **`/Volumes/SSDRubb/Controllo Contabile automatizzato/test/Docs da analizzare/`** (struttura: `0_Richiesta`, `B_Bilancio e scritture contabili`, `C_Libri sociali`, `E_Adempimenti tributari`, `F_Banche` con sottocartelle `APRILE`/`MAGGIO`/`GIUGNO`, `G_Personale` con `G.1`/`G.2`). In particolare:
   - `0_Richiesta/richiesta CC II trimestre 2026 swgi.xlsx` — la checklist compilata per questo cliente: **copre A.1-A.4, B.1-B.4, C.1-C.4, D.1-D.5, E.1-E.5, F.1-F.3, G.1-G.2, tutte le 25 voci standard del catalogo, nessuna esclusa**. A meno che leggendo i documenti reali trovi un motivo concreto per escluderne una (come ha fatto Ferrero con la nota su MPS "APERTO"), `applicable_items` per SWGI dovrebbe includerle tutte — verificalo tu stesso leggendo la checklist, non fidarti solo di questo riepilogo.
   - `B_Bilancio e scritture contabili/Bilancio SAP CEE_2026.06.30_2026.07.13.xlsx`, foglio `Bil. verifica`: contiene i codici conto (coge) SAP. Ho già individuato questi conti bancari operativi (colonna A = codice, colonna B = descrizione): `280200 Commerzbank AG`, `280900 Intesa San Paolo S.P.A. Bank EUR`, `280905 INTESA C/C USD`, `280920 Unicredit Bank Italy EUR`, `280940 Credem - ECommerce`, `287500 Banca Sella EUR`, `287505 Banca Sella USD`, `287520 Cassa di Risparmio di Asti S.P.A EUR`, `287540 BNL EUR`. **Attenzione**: gli estratti conto in `F_Banche/` non includono Intesa Sanpaolo (nessun file con quel nome nelle tre sottocartelle mensili) — verifica se i conti Intesa (280900/280905) sono ancora attivi per questo cliente o solo residui contabili, prima di includerli in `banks`. Verifica anche se esiste un conto Credem "CC" (non e-commerce) distinto da `280940`: negli estratti conto compaiono sia `CREDEM_CC_Estratto_conto` sia `CREDEM_ECOMMERCE_Estratto_conto` come file separati, ma nel bilancino ho trovato solo la riga "Credem - ECommerce" — se non trovi un secondo codice conto Credem nel bilancino, documentalo come `numero_conto: "APERTO"` (stesso pattern usato da Ferrero per MPS), non inventarlo.
   - I singoli estratti conto in `F_Banche/APRILE|MAGGIO|GIUGNO/` per i numeri di conto reali (es. `BNL_0700009514`, `UNICR_02008_66084_5283621` sono già nei nomi file — verifica dentro i PDF se il numero completo coincide o se nel nome c'è solo un identificativo parziale).
   - `E_Adempimenti tributari/` per i fondi previdenziali versati: dai nomi file risultano `ENASARCO`, `PREVIMODA`, `SANIMODA` — un set diverso da quello di Ferrero (`QUADRIFOR`, `BB PREV IMPIEGATI`, `MARIO NEGRI`, `MARIO BESUSSO`, `ANTONIO PASTORE`). Verifica nei documenti stessi (o nel bilancino, se i fondi vi compaiono come voci) prima di popolare `fondi_previdenziali`, non limitarti ai nomi dei file.
   - `C_Libri sociali/20260429 SWGI app.ne bil + nomina collegio sindacale ita eng_firmato.pdf` — verbale di nomina del Collegio sindacale: potrebbe contenere informazioni utili per la questione ancora aperta (§7.6 del piano, mai chiusa nemmeno per Ferrero) su come rappresentare la continuità del libro verbali del Collegio sindacale. Non è necessario risolverla qui — se non emerge nulla di conclusivo, lascia lo stesso tipo di `extra_items` dimostrativo che ha Ferrero (`CS.1`), con una nota che spiega che resta aperta anche per questo cliente.

## Cosa costruire

### 1. `backend/domain/clients/swgi.yaml`

Un `ClientConfig` completo per Suedwolle Group Italia S.p.A., `client_id: swgi`, seguendo lo stesso stile documentato di `ferrero.yaml` (ogni scelta non ovvia commentata nel file). In particolare:

- `applicable_items`: le 25 voci standard, salvo scoperte contrarie nella checklist reale.
- `banks`: i conti bancari operativi trovati nel bilancino, con `coge` (il codice SAP a 6 cifre), `banca` (nome per esteso) e `numero_conto` (dal nome file/estratto conto, o `"APERTO"` se non risolvibile con certezza — mai inventato).
- `fondi_previdenziali`: verificati contro i documenti reali, non solo i nomi dei file.
- `extra_items`: solo se emerge un motivo concreto (come il caso Collegio sindacale), con la stessa disciplina di `ferrero.yaml` — non anticipare decisioni non prese.
- `soglia_scostamento_bancario_eur` e `soglia_variazione_significativa_g_pct`: `null`, stesso motivo di Ferrero (non sono state decise — non è compito tuo deciderle).

### 2. La prova vera: uno scan end-to-end

Usa l'API di dominio già esistente (`POST /api/domain/scan` con `client_id: "swgi"`, `documents_dir` puntato alla cartella reale sopra, un `period` coerente — la checklist parla di "II trimestre 2026" — poi `GET /verifiche`) contro questi documenti reali, **senza modificare nulla nel motore**. Riporta nel riepilogo, sezione per sezione, lo stato calcolato e se ti sembra plausibile guardando i documenti — non solo che "il codice non ha sollevato errori" (stesso principio di attenzione al merito richiesto in ogni revisione precedente).

## Cosa NON fare

Non toccare `backend/domain/verification_engine.py`, `ingest_adapter.py`, `client_classify.py`, `excel_renderer.py`, `api.py`, `store.py`, `models.py` — questa fase è puramente configurazione + prova, non sviluppo. Se lo scan rivela un vero bug o una vera lacuna del motore (non solo "questo cliente ha dati che il motore non sa ancora interpretare del tutto", cosa attesa e da documentare, ma un errore di logica), fermati, non correggerlo qui: descrivilo nel riepilogo con l'evidenza specifica, così decidiamo insieme la fase dedicata a risolverlo. Non copiare i documenti reali del cliente dentro il repository (restano dove sono, su `/Volumes/SSDRubb/.../test/Docs da analizzare/`, referenziati solo per percorso durante lo scan, esattamente come già succede con `tools/run_ferrero_ii.py` per Ferrero — se ti è utile, guarda quello script per lo stesso pattern).

## Test richiesti

Nessun nuovo test pytest è strettamente necessario per questa fase (non stai scrivendo codice), ma se vuoi aggiungere un test analogo a `tests/test_domain_fase1_e2e.py`/`test_domain_api.py` usando una piccola selezione di fixture rappresentative di SWGI (copiate in `fixtures/` con lo stesso trattamento delle fixture Ferrero esistenti, non i documenti reali del cliente), è benvenuto ma non obbligatorio — motivalo nel riepilogo se lo fai o se decidi di non farlo. Rilancia comunque **tutta** la suite `tests/` per confermare che non hai rotto nulla con l'unico file nuovo (`swgi.yaml`, che non dovrebbe toccare nessun test esistente).

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase6-chiusura-gap-minori`, es. `redesign/fase7-secondo-cliente-swgi`. Commit locali (solo `backend/domain/clients/swgi.yaml` ed eventuali fixture/test nuovi — **non i documenti reali del cliente**), niente push né PR. Nel riepilogo finale: il file di config prodotto, l'esito sezione-per-sezione dello scan reale con un giudizio di merito (non solo "wip/✓"), ogni punto in cui hai dovuto lasciare qualcosa aperto/incerto invece di inventarlo (banche, fondi, Collegio sindacale), e — soprattutto — se e dove hai sentito la tentazione di toccare codice del motore per far "tornare" qualcosa: è la risposta alla domanda che questa fase pone davvero.
