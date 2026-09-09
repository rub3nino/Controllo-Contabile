# Prompt — JET Fase A: pratiche operative, parametri, ingest Excel e vista risultati (Quadra — modulo JET)

## Contesto

Il motore JET (Journal Entry Testing, ISA 240 §A44) è completo e approvato: `backend/jet/models.py`
(contratti), `backend/jet/ingest.py` (lettura/mappatura Excel), `backend/jet/criteri.py` (undici
criteri di rischio + dimensione conto), `backend/jet/sequenza.py` (test di completezza numerazione).
È stato validato su due clienti reali (213.656 e 56.133 registrazioni) con corrispondenza esatta
contro un foglio Excel storico già in uso dal team. Nessuno di questi quattro file va toccato in
questa fase: sono un pacchetto isolato, senza dipendenze da `backend/domain/`, e restano tali.

Oggi il motore non è raggiungibile da nessuna interfaccia. `ui/src/pages/JetPage.tsx` è solo una
pagina di stato che racconta il lavoro già svolto (fasi completate, risultati dei due test reali) —
leggila per intero prima di iniziare, perché va sostituita con uno strumento operativo, non solo
estesa. Il resto del frontend è stato ricostruito di recente secondo un nuovo design system
("Atelier Document System": `ui/src/components/Card.tsx`, `CardHeader`, `DataTable.tsx`, `Icon.tsx`,
`StatusBadge.tsx`, `Callout` in `Card.tsx`) — leggi anche `ui/src/domain/DomainDashboard.tsx` e
`ui/src/domain/api.ts` come riferimento di stile e di come un modulo React parla con un router
FastAPI dedicato, ma NON copiare la sua struttura a scansione-singola: JET ha un ciclo di vita a più
passi (vedi sotto) che quella pagina non ha.

Obiettivo di questa fase: rendere JET operativo end-to-end per un cliente che fornisce il libro
giornale già in Excel. Un revisore deve poter: creare una pratica JET, compilare i parametri cliente,
caricare il file, avviare l'analisi, e vedere/filtrare/esportare i risultati — senza toccare codice
o file di configurazione.

## Decisioni già prese (non ridiscuterle)

- Solo input Excel in questa fase. TXT a colonne fisse, PDF testuale, PDF scansionato sono fasi
  successive (B, C, D) e introdurranno un motore di "profili di estrazione" riusabile fra file dello
  stesso cliente/gestionale — **non anticiparlo qui**: il collegamento fra intestazioni Excel e campi
  di `RigaGiornale` in questa fase è una mappatura valida solo per la singola pratica corrente, scelta
  una volta dall'utente dopo il caricamento del file. Non salvarla come "profilo" riusabile per altri
  file: è la Fase B che deciderà come farlo bene.
- I parametri cliente (`ParametriClienteJet`, tutti i suoi campi) si compilano da un form
  nell'interfaccia e si salvano lato backend per pratica. Niente file YAML esterno — a differenza di
  `ClientConfig` del Controllo Contabile (`backend/domain/clients/*.yaml`), qui non esiste un catalogo
  di clienti pre-registrato: ogni pratica JET porta i propri parametri.
- JET è una pratica a sé stante, con la propria lista, indipendente dalle pratiche di Controllo
  Contabile (`backend/domain/models.py:PraticaRecord`, `backend/domain/store.py`). Non riusare né
  estendere quei modelli/quello store: JET ha i propri.
- Non introdurre AI/LLM per l'estrazione dei dati: la lettura resta quella già scritta
  (`leggi_righe_xlsx`/`mappa_righe_giornale`), con mappatura scelta dall'utente.

## Cosa implementare

### 1. Modelli e persistenza (nuovi file, dentro `backend/jet/` — non toccare `models.py` esistente)

Crea `backend/jet/pratica.py` con i contratti Pydantic per la pratica operativa, distinti dai
contratti "riga per riga" già esistenti in `models.py` (che restano invariati e vengono importati,
non duplicati):

- `PraticaJet`: `id`, `client` (testo libero, non uno slug da catalogo), `period` (testo libero,
  stessa convenzione di `PraticaRecord.period` nel Controllo Contabile), `status`, `created_at`,
  `parametri: ParametriClienteJet | None`, `file_originale_nome: str | None`,
  `mappatura: dict[str, str] | None`, `analizzato_at: str | None`. Aggiungi qui i campi riassuntivi
  utili alla lista pratiche senza dover rileggere tutte le righe (es. `numero_registrazioni`,
  `numero_da_investigare`) — decidi tu se calcolarli a runtime dallo store o mantenerli
  denormalizzati sulla pratica; se li denormalizzi, aggiornali sempre insieme al risultato
  dell'analisi, mai in un punto separato che può disallinearsi.
- `status` è un `Literal` con almeno: `"bozza"` (creata, parametri non ancora salvati),
  `"parametri_configurati"`, `"file_caricato"` (file presente ma mappatura non confermata o analisi
  non ancora lanciata), `"analizzato"`. Un'analisi si può rilanciare (es. dopo aver corretto un
  parametro): decidi se questo riporta lo status a `"file_caricato"` finché non si rilancia, o resta
  `"analizzato"` con un nuovo `analizzato_at" — sii esplicito nel riepilogo finale su quale hai
  scelto e perché.

Crea `backend/jet/store.py` seguendo lo stesso stile di `backend/domain/store.py` (sqlite3 della
standard library, non SQLAlchemy — **non introdurre un ORM o le dipendenze che trovi già in
`requirements.txt`/`ui/package.json` per `sqlalchemy`, `redis`, `celery`, `PyJWT`, `minio`: sono
scope creep di un altro lavoro mai commissionato in questo repository, non riguardano JET e non vanno
usati**), con il proprio file `jet.sqlite3` sotto `backend.workspace.storage_root()` (es.
`storage_root() / "jet.sqlite3"`, distinto da `domain.sqlite3`).

Vincolo di scala, non negoziabile: una pratica reale ha centinaia di migliaia di righe (Nordson:
213.656). Non progettare lo store come "una riga di tabella = un blob JSON dell'intera pratica" per
i risultati riga-per-riga (va bene invece per `PraticaJet` stessa, che è un singolo record per
pratica): serve una tabella con una riga sqlite per ogni `EsitoRigaJet` calcolato, con colonne
indicizzate per i filtri che la vista risultati dovrà supportare (almeno: `pratica_id`,
`da_investigare`, `conto_contabile`, `punteggio_totale`) in modo che filtro e paginazione avvengano
con `WHERE`/`LIMIT`/`OFFSET` in SQL, non caricando 200mila oggetti Pydantic in memoria a ogni
richiesta per poi filtrarli in Python. Il dettaglio completo della riga (tutti i flag,
`identificativo_registrazione`, importo, data, conto, descrizione — quanto serve a mostrare la riga
in tabella e i motivi del punteggio) può restare in una colonna JSON per riga, letta solo per la
pagina richiesta. Fai lo stesso per l'esito della sequenza (mancanti + intervalli non enumerati):
tabelle proprie, non un blob unico.

### 2. API (nuovo file `backend/jet/api.py`, montato in `backend/main.py`)

Router `APIRouter(prefix="/api/jet", tags=["jet"])`, incluso in `backend/main.py` accanto a
`domain_router` (`app.include_router(jet_router)` — due righe aggiunte, il resto di `main.py` non
cambia). Endpoint minimi attesi (adatta nomi/forma se trovi un'incoerenza con le convenzioni REST già
in uso in `backend/domain/api.py`, ma mantieni la stessa filosofia: corpi Pydantic, errori HTTP con
`HTTPException` e dettaglio leggibile):

- `POST /api/jet/pratiche` — crea una pratica (`client`, `period`) → `status="bozza"`.
- `GET /api/jet/pratiche` — lista pratiche (dati riassuntivi, non tutte le righe).
- `GET /api/jet/pratiche/{id}` — dettaglio pratica (inclusi parametri se presenti).
- `PUT /api/jet/pratiche/{id}/parametri` — corpo `ParametriClienteJet` completo, salva e aggiorna lo
  status.
- `POST /api/jet/pratiche/{id}/file` — upload multipart del file Excel (riusa il pattern di
  `UploadFile` già visto in `backend/main.py:ingest`). Salva il file (puoi riusare
  `backend.workspace.pratica_dir`/`write_inbox_file`, sono generici e non legati al Controllo
  Contabile). Leggi solo le intestazioni (`leggi_righe_xlsx`, prima riga) e restituiscile al
  frontend: sono la base per la schermata di mappatura manuale.
- `PUT /api/jet/pratiche/{id}/mappatura` — corpo `{mappatura: dict[str, str]}` (campo `RigaGiornale`
  → colonna Excel). Valida che le colonne indicate esistano davvero fra le intestazioni lette al passo
  precedente prima di salvare, e restituisci un errore leggibile altrimenti — non un 500 generico.
- `POST /api/jet/pratiche/{id}/analizza` — richiede parametri, file e mappatura già presenti (409 con
  messaggio chiaro se manca qualcosa). Esegue `mappa_righe_giornale` → `calcola_frequenza_conti` →
  `valuta_riga` per ogni riga → `verifica_sequenza`, salva tutto nello store, aggiorna lo status.
  Sincrono per questa fase (niente coda/worker: non è disponibile nulla del genere per questo
  progetto, vedi sopra) — ma misura e riporta nel riepilogo finale quanto impiega su un fixture
  realistico o sul file di test reale se Ruben te ne fornisce uno, così sappiamo se in una fase
  successiva serve renderlo asincrono.
- `GET /api/jet/pratiche/{id}/risultati` — righe paginate con filtri via query string: almeno
  `da_investigare` (bool), `conto_contabile`, `punteggio_minimo`, più paginazione (`page`/`page_size`
  o cursore, a tua scelta, ma esplicita e testata) e un totale conteggiato lato SQL.
- `GET /api/jet/pratiche/{id}/sequenza` — protocolli mancanti + intervalli non enumerati.
- `GET /api/jet/pratiche/{id}/export.xlsx` — esporta i risultati (rispetta gli stessi filtri della
  vista se ha senso, altrimenti l'intero risultato — decidi e motiva nel riepilogo) in un workbook
  openpyxl leggibile da un revisore (intestazioni chiare, non solo i nomi interni dei campi Pydantic).

### 3. Frontend

Sostituisci il contenuto operativo di `ui/src/pages/JetPage.tsx` (puoi mantenere la parte
"storia/fasi completate" altrove o rimuoverla — decidi tu cosa ha senso una volta che la pagina è
operativa, ma il punto di ingresso resta questo file). Segui il pattern del modulo `ui/src/domain/`:
un file `ui/src/jet/api.ts` con tipi e client HTTP (stesso stile di `ui/src/domain/api.ts`, usando
`j<T>` da `../api`), e componenti React sotto `ui/src/jet/` per le viste. Il flusso ha più passi
distinti (lista pratiche → crea pratica → form parametri → upload file → mappatura colonne → avvia
analisi → risultati filtrati + export): non forzarlo in un unico form come fa
`DomainDashboard.tsx` per la scansione, che è un'operazione singola. Guarda come `FormField` è
definito in `DomainDashboard.tsx` (in fondo al file, non esportato da `components/`): se ti serve in
più punti per il form parametri (che ha molti più campi), valuta se estrarlo in
`ui/src/components/` per riuso, invece di duplicarlo.

Il form parametri deve coprire per intero `ParametriClienteJet` (tutti i campi, inclusi i pesi per
ciascuno degli undici criteri più i due opzionali sulla dimensione conto, e la soglia "da
investigare") — non un sottoinsieme. Per i campi lista (`giorni_weekend`, `festivita`,
`staff_autorizzato`, `utenti_di_sistema`, `parole_chiave_parti_correlate`,
`conti_infragruppo_parte_correlata`, `fondi_previdenziali` — occhio, quest'ultimo non esiste su
`ParametriClienteJet`, è del Controllo Contabile: non confonderli) scegli un controllo adatto (aggiungi
un valore alla volta ad esempio), non un textarea JSON grezzo. Per i campi opzionali (`| None`), il
form deve rendere possibile lasciarli esplicitamente vuoti/non impostati, non forzare un valore di
comodo — coerentemente con la disciplina "non calcolabile ≠ falso" che vale anche qui: un parametro
lasciato vuoto dall'utente deve restare `None` sul backend, mai diventare `0`/`[]`/`""` per comodità
di validazione.

La vista risultati deve permettere di filtrare almeno per "da investigare" e per conto, mostrare il
punteggio e quali criteri hanno contribuito (i flag `True`, distinguendo visivamente da `None` —
"non calcolabile" non è "no": se lo mostri in tabella, non renderlo indistinguibile da un flag
`False`/non scattato), e includere un pulsante di export Excel. Con centinaia di migliaia di righe
possibili, la tabella deve usare la paginazione esposta dall'API, non scaricare tutto e paginare lato
client.

## Cosa NON fare

- Non modificare `backend/jet/models.py`, `ingest.py`, `criteri.py`, `sequenza.py`. Se durante
  l'integrazione trovi lì un bug reale (non un'estensione, un bug), fermati e segnalalo nel
  riepilogo invece di correggerlo silenziosamente: quei file sono stati verificati a fondo su dati
  reali e una modifica non richiesta va rivista con lo stesso rigore, non infilata in questa fase.
- Non toccare `backend/domain/*`, né farci dipendere `backend/jet/*` (nessun import in nessuna delle
  due direzioni oltre a quanto già esiste).
- Non usare, estendere, o anche solo importare nulla da `backend/modules/`, `backend/enterprise/`,
  `backend/core/`: sono codice non tracciato, non commissionato da nessun prompt di questo progetto,
  segnalali nel riepilogo finale come scope creep se li incontri, ma non costruirci sopra.
- Non aggiungere nuove dipendenze pesanti (codemarcatori ORM, code/worker, auth) — tutto quello che
  serve a questa fase è già disponibile (`fastapi`, `pydantic`, `openpyxl`, `sqlite3` di libreria
  standard).
- Non toccare `ui/tailwind.config.js`/i design token in `ui/src/index.css`: riusa i componenti
  esistenti (`Card`, `CardHeader`, `DataTable`, `Icon`, `StatusBadge`, `Callout`).
- Non introdurre un "profilo di estrazione" riusabile fra pratiche/clienti: è la Fase B. La
  mappatura colonne di questa fase vive solo dentro la singola `PraticaJet`.

## Test richiesti

Usa il fixture già esistente `fixtures/jet/giornale_sintetico.xlsx` (vedi la mappatura già nota in
`tests/test_jet_ingest.py`) per i test end-to-end della nuova API: crea pratica → salva parametri
(anche un caso con più parametri lasciati `None`, per verificare che restino tali dopo il giro
HTTP → store → risposta) → carica file → salva mappatura → analizza → verifica risultati e
paginazione/filtri → export Excel apribile. Aggiungi anche test mirati sullo store
(`backend/jet/store.py`) per paginazione/filtri con un numero di righe sufficiente a verificare che
`LIMIT`/`OFFSET` (o il meccanismo scelto) funzioni davvero, non solo con 2-3 righe. Segui la
convenzione già in uso: file `tests/test_jet_pratica.py`/`test_jet_store.py`/`test_jet_api.py` (dividi
come preferisci, ma non un unico file monolitico), eseguiti con `python -m pytest tests/ -q`. Rilancia
l'intera suite esistente: nessuna regressione sui test JET Fase 1-5 né su quelli del Controllo
Contabile.

## Checklist di autoverifica finale (per chi implementa, prima di consegnare)

- [ ] `backend/jet/models.py`, `ingest.py`, `criteri.py`, `sequenza.py` hanno diff vuoto rispetto al
      branch di partenza.
- [ ] Nessun import nuovo fra `backend/jet/*` e `backend/domain/*` in nessuna direzione.
- [ ] Nessun riferimento a `backend/modules/`, `backend/enterprise/`, `backend/core/`.
- [ ] Un parametro lasciato vuoto nel form arriva come `None` all'`EsitoRigaJet` corrispondente (non
      `False`/`0`/lista vuota) — verificato con un test, non solo letto nel codice.
- [ ] `GET /api/jet/pratiche/{id}/risultati` con filtri e paginazione è stato provato con più di
      qualche decina di righe (idealmente qualche migliaio) e il tempo di risposta resta ragionevole.
- [ ] `python -m pytest tests/ -q` gira pulito, con il conteggio totale dei test riportato nel
      riepilogo (prima e dopo, per mostrare quanti test sono stati aggiunti).
- [ ] L'export Excel si apre correttamente e mostra intestazioni leggibili da un revisore, non nomi
      di campo interni.
- [ ] Il riepilogo finale elenca esplicitamente ogni file nuovo e ogni file esistente toccato (e per
      questi ultimi, perché).

## Consegna

Branch nuovo da `ui/redesign-atelier` (è il branch che ha già i componenti del nuovo design system
usati dal frontend di questa fase — se nel frattempo Ruben ti dice di partire da un altro branch
perché il redesign è stato mersato o rifatto, usa quello). Nome coerente con la convenzione già in
uso per JET, es. `jet/faseA-pratiche-operative`. Commit locali, niente push né PR. Nel riepilogo
finale: il diff esatto (file nuovi vs. modificati, con `git diff <branch-precedente>..<branch-nuovo>
--stat`), il risultato di tutta la suite di test, il tempo misurato per un'analisi su un file di
dimensioni realistiche se disponibile, e la checklist sopra spuntata voce per voce.
