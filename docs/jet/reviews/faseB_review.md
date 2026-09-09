# Revisione JET Fase B — motore di profili di estrazione per TXT a colonne fisse

Data: 2026-09-09. Branch: `jet/faseB-profili-estrazione-txt` (sopra `jet/faseA-pratiche-operative`),
commit `9da077b`, base `9303dfc` (punta di Fase A dopo la correzione della paginazione export).

## Verifica dello scope

`git diff 9303dfc..9da077b --stat`: **13 file, esattamente quelli dichiarati** —
`backend/jet/{api,ingest,pratica,profilo,store}.py` (`profilo.py` nuovo), `backend/jet/ingest_txt.py`
(nuovo), due fixture TXT nuove, tre file di test nuovi, `ui/src/jet/{JetDashboard.tsx,api.ts}`.
Nessun altro file toccato. Diff isolato esplicitamente su `backend/jet/{models,criteri,sequenza}.py`:
**vuoto**, confermato. Nessuna dipendenza nuova, nessun uso di `backend/domain`, `modules`,
`enterprise`, `core`. La working directory sul Mac è già sul branch corretto, ma ha modifiche locali
non commesse preesistenti (`requirements.txt`, `ui/package.json`, `ui/src/App.tsx`,
`ui/src/components/Sidebar.tsx`) — non toccate da Codex, coerenti con lo scope creep già segnalato
nelle fasi precedenti e ancora da chiarire con te, non un problema di questa consegna.

## Lettura completa del codice

**`backend/jet/ingest.py`**: il diff di 41 righe è esattamente quanto dichiarato — una
rinominazione meccanica di quattro normalizzatori privati (`_testo_o_none` → `testo_o_none`, e così
per data/ora/decimale) più l'aggiornamento di `__all__`. Nessuna riga di logica cambiata: confrontato
corpo per corpo, `mappa_righe_giornale` e `leggi_righe_xlsx` sono bit-per-bit identiche a meno del
nome delle chiamate interne. Nessuna regressione possibile sul flusso Excel.

**`backend/jet/profilo.py`** (nuovo): `ProfiloEstrazione` con intervalli 0-based e `fine` esclusivo
(`[inizio, fine)`, come lo slicing Python — scelta chiara e non ambigua). Validazione che rifiuta
campi JET sconosciuti e intervalli invertiti o vuoti. Nessun meccanismo di derivazione automatica
delle posizioni dall'etichetta di colonna, come richiesto.

**`backend/jet/ingest_txt.py`** (nuovo): fallback di codifica `utf-8` → `cp1252` → `latin-1`
implementato correttamente or­dine-per-ordine come richiesto; un controllo aggiuntivo di
"leggibilità" (`_leggibile`, tollera al più l'1% di caratteri di controllo) evita di accettare un
falso positivo `latin-1` su un file binario, che altrimenti decodificherebbe quasi sempre senza
errori — accorgimento non richiesto esplicitamente nel prompt ma corretto e ragionevole.
`estrai_righe_txt` confronta l'intestazione normalizzata del file con quella del profilo e rifiuta un
mismatch — matching esatto, nessuna euristica fuzzy, come richiesto. Riga troppo corta: errore
esplicito con numero di riga (1-based coerente con quanto un utente vedrebbe aprendo il file).
`mappa_righe_txt` riusa `mappa_righe_giornale` di Fase A con una mappatura identità, riusando quindi
davvero i normalizzatori (incluso il trattamento `None` vs vuoto) senza duplicarli.

Unico appunto non bloccante: `estrai_righe_txt` chiama `ispeziona_txt(percorso)` al proprio interno
dopo aver già letto e decodificato il file una prima volta in `_leggi_testo` — il file viene letto e
decodificato due volte per ogni estrazione. Impatto reale trascurabile (misurato sotto), ma se in
futuro emergessero file TXT molto più grandi del tipico giornale, vale la pena eliminare la doppia
lettura.

**`backend/jet/store.py`**: nuova tabella `profilo_estrazione_jet` con indici su
`intestazione_riferimento` e `created_at`; CRUD profili scritto con lo stesso stile del resto dello
store (blob JSON + poche colonne indicizzate). `find_profilo_by_intestazione` fa un confronto esatto
dopo `strip()`, non una ricerca fuzzy — verificato anche nel test dedicato che una intestazione con
spaziatura interna diversa **non** viene trovata (comportamento corretto e deliberatamente severo).

**`backend/jet/pratica.py`**: una riga, `profilo_estrazione_id: str | None = None` — esattamente
come dichiarato.

**`backend/jet/api.py`**: `_raw_rows` estesa per instradare `.txt` verso `mappa_righe_txt` (richiede
un profilo applicato, altrimenti 409) mantenendo `.xlsx` invariato. Nuovi endpoint
`GET /profili`, `GET /profili/{id}`, `PUT /pratiche/{id}/profilo/{profilo_id}` (applica un profilo
esistente, verificando che l'intestazione corrisponda) e `POST /pratiche/{id}/profilo` (crea e
applica). `analyze()` ora richiede correttamente "profilo di estrazione TXT" invece di "mappatura
colonne" quando il file è un TXT. Upload `.txt` restituisce intestazione, righe di esempio, codifica
rilevata e il profilo suggerito per riuso automatico se l'intestazione coincide con uno già salvato —
esattamente il comportamento "riconosci e riapplica automaticamente" richiesto nel contesto del
prompt.

Un solo punto teorico da segnalare, non bloccante: `PUT /pratiche/{id}/mappatura` (l'endpoint di
Fase A, pensato per Excel) chiama `_raw_rows` senza controllare l'estensione del file; se venisse
invocato su una pratica TXT con un profilo già applicato, riceverebbe una lista di `RigaGiornale` già
mappate invece di righe grezze e produrrebbe una risposta insensata invece di un errore chiaro. Non è
raggiungibile dal flusso reale: ho verificato che il frontend nasconde del tutto la UI di mappatura
Excel quando la pratica è un TXT (`{!isTxt && headers.length > 0 && ...}` in `JetDashboard.tsx`), e
nessun test lo esercita in questo modo. È un'inconsistenza dell'API pensabile solo per un client
esterno scritto a mano, da sistemare quando ci sarà tempo (basterebbe far restituire 400 a
`/mappatura` per una pratica TXT), non un difetto del prodotto consegnato.

**Frontend** (`JetDashboard.tsx`, `api.ts`): tipi estesi coerentemente (`profilo_estrazione_id`,
`ExtractionProfile`, `FileInspection`). UI di configurazione TXT con intestazione monospaziata,
evidenziazione della porzione di colonna selezionata (`highlightedHeader`), riuso profilo
esistente o creazione guidata di uno nuovo con campi inizio/fine per ciascun campo JET. Il pulsante
"Avvia analisi" ora richiede correttamente `profilo_estrazione_id` (non `mappatura`) quando la
pratica è un TXT. Letto per intero, non solo a campione: coerente con l'API.

## Verifica del conteggio test — la discrepanza era di nuovo un'imprecisione di Codex

Estrazione pulita (`git archive` dei due commit + venv nuovo, mai la working directory):

- Base `9303dfc`: **125 test collezionati**, coincide esattamente con il numero confermato alla
  chiusura della Fase A (non i "136" dichiarati da Codex come base di questa fase).
- Finale `9da077b`: **131 test collezionati** (non i "142" dichiarati).

La differenza reale è **+6 test**, non +6 dichiarati per coincidenza sul delta ma su una base
sbagliata: i sei nuovi test sono esattamente le funzioni nei tre file nuovi
(`test_jet_profili.py`: 1, `test_jet_ingest_txt.py`: 3, `test_jet_api_txt.py`: 2) — nessun test
mancante, nessuno di troppo. Notiamo che lo scarto è **+11 identico sia sulla base sia sul finale**
(136-125 e 142-131): non è un problema introdotto da questa fase, è lo stesso pattern di
sovrastima già segnalato due volte nelle fasi precedenti, qui alla terza occorrenza — utile
chiedere esplicitamente a Codex di incollare l'output letterale di `pytest --collect-only`, non un
numero riassunto a memoria.

Suite completa in ambiente pulito:

| | Base `9303dfc` | Finale `9da077b` |
|---|---|---|
| Passati | 123 | 129 |
| Falliti | 2 | 2 |

Gli unici due falliti (`tests/test_ocr.py::test_paddle_provider_and_cache` e `::test_ocr_engine_and_image`,
`ModuleNotFoundError: No module named 'PIL'`) sono **identici su base e finale**: dipendono
dall'assenza di `paddleocr`/`Pillow` nel mio venv minimale (non installo l'intero
`requirements.txt`, che include l'enorme albero di dipendenze OCR, per lo stesso motivo già spiegato
in Fase A), non hanno nulla a che fare con JET e non sono una regressione di questa fase. Nessun
errore di collezione (nessun file di test fallisce l'import): il conteggio di 131 è pulito.

## Verifica funzionale indipendente

Letti per intero (non a campione) i tre file di test nuovi, e confermato che superano davvero quello
che dichiarano di testare, non un giro a vuoto:

- **Fallback di codifica**: la fixture `giornale_colonne_fisse_cp1252.txt` è stata verificata da me
  indipendentemente byte per byte — decodificarla come UTF-8 **fallisce davvero**
  (`'utf-8' codec can't decode byte 0xe8...`), quindi il test che la legge esercita realmente il
  fallback a `cp1252`, non una fixture che "per caso" sarebbe leggibile anche come UTF-8. Il
  contenuto contiene un accento reale ("Caffè e forniture") usato per dimostrare che la decodifica è
  corretta, non solo che non solleva un'eccezione.
- **Matching esatto, non fuzzy**: `test_store_crud_e_matching_esatto_normalizzato` dimostra sia il
  successo (`" ID DATA IMPORTO "` trova il profilo salvato come `"  ID DATA IMPORTO  "`, solo dopo
  `strip()`) sia il fallimento voluto (`"ID DATA  IMPORTO"` con spaziatura interna diversa **non**
  trova nulla).
- **Riuso end-to-end reale**: `test_txt_sconosciuto_creazione_e_riuso_automatico_profilo` usa
  `TestClient` vero (non mock) per creare un profilo su una prima pratica, caricare lo stesso
  file su una seconda pratica e verificare che l'intestazione uguale suggerisca automaticamente il
  profilo già creato — la prova più convincente del riuso, ed è un test onesto: analizza anche fino
  in fondo (`numero_registrazioni == 10`), non si ferma alla sola creazione del profilo.
- **Errore leggibile su riga corta**: `test_riga_corta_indica_il_numero_di_riga` e l'equivalente a
  livello API confermano che l'errore indica il numero di riga (1-based) e non fa crashare
  l'endpoint (400 con messaggio, non 500).
- **Campo non mappato → `None`**: `test_campo_non_mappato_diventa_none` conferma che un campo
  escluso dalle posizioni del profilo resta `None` end-to-end, coerente con la disciplina
  None-vs-False della Fase A/motore.

**Benchmark indipendente** (non richiesto esplicitamente per questa fase, ma ho voluto escludere che
la doppia lettura/decodifica notata sopra in `ingest_txt.py` fosse un problema a scala realistica):
generato un file TXT sintetico di 100.000 righe (~7,3 MB) e misurato `mappa_righe_txt` direttamente —
**1,07 s**, corretto (tutte le 100.000 righe estratte, valori verificati sulla prima riga). Nessun
problema di scala paragonabile a quello trovato in Fase A: qui non c'è nessuna query SQL con
`OFFSET`, solo lettura sequenziale di un file, quindi non mi aspettavo un problema e non l'ho
trovato.

Non ho rieseguito `npm run type-check` / `npm run build` in modo indipendente (la working directory
sul Mac ha modifiche locali non commesse che ne inquinerebbero l'esito, per lo stesso motivo per cui
non uso mai la working directory per la suite Python); ho letto per intero il diff di
`JetDashboard.tsx` e `api.ts` e non presenta nulla di sospetto dal punto di vista dei tipi. Rischio
residuo basso: non ci sono claim di performance o di correttezza sui dati che dipendano dal frontend.

## Verdetto

**Fase B approvata.** Lo scope è esattamente quello dichiarato, il motore di estrazione TXT a
colonne fisse funziona correttamente (fallback di codifica reale, matching esatto normalizzato senza
euristiche, riuso automatico del profilo su intestazione identica, errori leggibili su riga corta,
disciplina `None` preservata), il flusso Excel di Fase A resta invariato byte per byte, e la suite —
riverificata in ambiente pulito, non fidandomi del numero dichiarato — passa per intero (129/131,
gli unici 2 falliti sono pre-esistenti e indipendenti da questa fase).

Due note non bloccanti per il futuro: (1) la doppia lettura del file in `estrai_righe_txt` e
l'endpoint `/mappatura` non protetto per pratiche TXT, entrambe descritte sopra, da sistemare con
comodo; (2) il conteggio test dichiarato da Codex è di nuovo sbagliato (terza volta di fila, stesso
scarto di +11 sia su base sia su finale) — vale la pena chiedergli esplicitamente l'output letterale
di `pytest --collect-only` invece di un riepilogo a memoria, prima della Fase C.

## Sulla Fase C

Il prompt della Fase C (`docs/prompts/24_jet_faseC_pdf_testuale.md`) presumeva endpoint e struttura
di Fase B che ora conosciamo con certezza. Confrontando: gli endpoint reali sono
`PUT /pratiche/{id}/profilo/{profilo_id}` e `POST /pratiche/{id}/profilo` (non un singolo endpoint
generico come ipotizzato genericamente nel prompt) — il prompt C non nomina endpoint specifici di
Fase B con precisione tale da essere in conflitto, quindi non ho trovato incompatibilità che
richiedano una riscrittura. Il punto più delicato del riuso — se la logica di
matching/applicazione-profilo assume un file `.txt` su disco piuttosto che "una lista di righe di
testo" — è confermato **vero**: `estrai_righe_txt`/`mappa_righe_txt` accettano solo un percorso di
file (`str | Path`), non una lista di righe già in memoria. Il prompt C lo aveva già anticipato come
lo scenario più probabile e istruisce esplicitamente l'implementatore a fare "il refactoring minimo e
giustificato" di separare "ottieni le righe" da "applica il profilo a righe" come cambiamento
additivo — la prescrizione resta valida e sufficiente così com'è, non serve riscrivere il prompt.

**Puoi procedere con l'invio del prompt della Fase C a Codex.**
