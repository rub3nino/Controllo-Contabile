# Prompt — JET Fase D: estrazione da PDF scansionato via OCR, con conferma umana (Quadra — modulo JET)

## Contesto

Fasi A-C hanno reso JET operativo per Excel, TXT a colonne fisse e PDF con layer di testo reale,
tutti e tre attraverso lo stesso motore di "profili di estrazione" (`backend/jet/profilo.py`,
generalizzato in Fase C su `ispeziona_righe`/`estrai_righe_testo`/`mappa_righe_testo` in
`backend/jet/ingest_txt.py`): un profilo ricorda le posizioni di carattere `[inizio, fine)` di ogni
campo per un'intestazione già vista, e si riapplica automaticamente. `backend/jet/ingest_pdf.py`
(Fase C) rifiuta esplicitamente un PDF privo di testo estraibile, con un errore che rimanda a questa
fase.

**Decisione già presa fin dall'inizio di questo lavoro, da rispettare**: l'OCR non deve alimentare
automaticamente e silenziosamente lo stesso profilo a colonne fisse come fanno TXT e PDF testuale.
Il motivo è tecnico, non solo prudenziale, e va verificato concretamente prima di scrivere
l'interfaccia: il meccanismo a posizioni fisse assume che lo stesso carattere alla stessa posizione
rappresenti sempre lo stesso campo, riga dopo riga — vero per un file di testo reale o per il layer
di testo di un PDF (i caratteri hanno posizioni esatte nel documento digitale), ma **non garantito**
per il testo ricostruito da un motore OCR, che riconosce parole per riquadro (bounding box) e non per
una griglia di caratteri a passo fisso. Un disallineamento anche di un solo carattere fra una riga e
l'altra romperebbe l'estrazione a posizioni fisse **silenziosamente**, restituendo un dato sbagliato
in un campo sbagliato senza sollevare alcun errore — nel contesto di una verifica antifrode ISA 240
questo è un rischio che non ci possiamo permettere. Per questo la fase prevede una schermata di
**conferma umana**: il revisore vede il testo letto dall'OCR (idealmente affiancato all'immagine
della pagina originale) e lo conferma o corregge prima che qualunque profilo venga applicato.

**Infrastruttura OCR già esistente da riusare, non da reinventare**: il progetto usa già PaddleOCR
altrove (funzionalità "Controllo Contabile", estrazione di ricevute F24 ed estratti conto), tramite
`backend/paddle_ocr.py` (funzione `paddle_ocr(bytes, layout=...) -> (testo, metodo)`, con cache su
`QUADRA_OCR_CACHE`) e `backend/extract.py` (`ocr_image_bytes`, `ocr_pdf`, `extract_pdf_text`, ecc.).
**Non richiamare direttamente `ocr_pdf()`/`extract_pdf_text()` di `backend/extract.py` così come
sono**: sono scritti per estrarre un valore da un documento breve (una ricevuta, un estratto conto)
e per default campionano solo 4 pagine con un'euristica "pagine chiave" (`_ocr_max_pages`,
`_ocr_page_indices`) pensata per quel caso d'uso — un giornale contabile scansionato va letto
**per intero**, pagina per pagina, non a campione. Usa invece le funzioni di livello più basso
(`ocr_image_bytes` su ogni pagina renderizzata a immagine con PyMuPDF, stesso pattern con cui
`ocr_pdf` renderizza le pagine, ma senza il campionamento) o valuta se serva una piccola funzione
dedicata in `backend/jet/`.

## Passo zero, da fare prima di scrivere qualunque interfaccia

Prima di implementare la schermata di conferma o qualunque altra cosa, **verifica concretamente
quanto l'allineamento a colonne del testo OCR sia stabile**, su un file scansionato reale che ti
chiederà Ruben (non un fixture sintetico troppo pulito: un vero giornale contabile scansionato, con
le imperfezioni di una scansione reale). Prova a passare le righe risultanti al motore di profili
esistente (`mappa_righe_testo`, con `formato="OCR"` o simile) e osserva se le posizioni di carattere
restano coerenti riga per riga. Riporta onestamente cosa hai trovato nel riepilogo:

- Se l'allineamento regge ragionevolmente bene: implementa comunque la conferma umana come
  passaggio obbligatorio (non renderla opzionale solo perché "di solito funziona"), ma il profilo a
  colonne fisse può restare il meccanismo di applicazione dopo la conferma.
- Se l'allineamento non regge in modo affidabile: **non forzarlo**. Fermati e proponi
  un'alternativa nel riepilogo (per esempio: la conferma umana diventa anche l'occasione per
  correggere manualmente il testo riga per riga prima di applicare il profilo, oppure un meccanismo
  di estrazione diverso dal semplice slicing di stringa per l'origine OCR). È un caso esplicitamente
  previsto da rivedere insieme, non da risolvere a modo tuo inventando una soluzione non concordata.

## Cosa implementare

### 1. Estrazione OCR pagina per pagina (nuovo file `backend/jet/ingest_ocr.py`)

Una funzione che, dato un percorso PDF scansionato, renderizza ogni pagina a immagine (stesso
pattern PyMuPDF già usato in `backend/extract.py::ocr_pdf`, DPI simile) e passa ciascuna immagine a
`ocr_image_bytes` di `backend/paddle_ocr.py`/`backend/extract.py`, restituendo una lista di righe di
testo per l'intero documento (tutte le pagine, non un campione). Nessuna nuova dipendenza OCR: solo
riuso di quanto già installato e funzionante (verificato dai test esistenti in `tests/test_ocr.py`).

### 2. Conferma umana del testo letto

Dopo il caricamento di un PDF scansionato, l'utente deve vedere il testo estratto dall'OCR (per
intero o pagina per pagina) e poter confermarlo o correggerlo **prima** che si proceda alla
configurazione/applicazione di un profilo — analogo concettualmente all'anteprima già mostrata per
TXT/PDF testuale (intestazione + righe di esempio), ma con un passaggio di editing esplicito invece
di un'applicazione automatica. Decidi tu la forma tecnica esatta (endpoint che accetta il testo
eventualmente corretto, salvato come stato intermedio della pratica prima di procedere), ma il
principio "il revisore conferma cosa ha letto l'OCR prima che diventi dato analizzato" non è
negoziabile e va reso visibile nell'interfaccia, non solo nell'API.

### 3. Collegamento al motore di profili esistente

Una volta confermato (o corretto) il testo, il resto del flusso riusa **senza duplicazione**
`ispeziona_righe`/`estrai_righe_testo`/`mappa_righe_testo` già generalizzati in Fase C — stesso
principio di riuso già rispettato da TXT e PDF testuale.

### 4. API

Il caricamento di un `.pdf` scansionato (quello che `estrai_righe_pdf` di Fase C rifiuta
esplicitamente con il messaggio "serve l'OCR della Fase D") deve ora instradarsi verso questo nuovo
percorso invece di fallire con 400. Il flusso di analisi (`POST /analizza`) deve continuare a
rifiutarsi (409, come per TXT/PDF senza profilo) finché la conferma umana del testo OCR non è
avvenuta.

### 5. Frontend

Nuovo passaggio nell'interfaccia (in `JetDashboard.tsx` o dove ha senso) per la revisione/conferma
del testo OCR prima della configurazione del profilo. Riusa il pannello di configurazione profilo
già esistente per il passo successivo, se la forma del dato lo consente.

## Cosa NON fare

- Non introdurre un nuovo motore OCR: PaddleOCR è già installato e funzionante, riusa
  `backend/paddle_ocr.py`/`backend/extract.py`.
- Non usare `ocr_pdf()`/`extract_pdf_text()` di `backend/extract.py` così come sono (campionano 4
  pagine, pensati per documenti brevi) senza adattarne il campionamento per leggere l'intero
  giornale.
- Non saltare o rendere opzionale la conferma umana per "velocizzare" il flusso: è una decisione
  presa a monte per un motivo di affidabilità dei dati, non un dettaglio di UX.
- Non forzare il riuso del profilo a colonne fisse se il passo zero mostra che l'allineamento OCR
  non è sufficientemente stabile: fermati e proponi un'alternativa, come descritto sopra.
- Non toccare `backend/jet/{models,criteri,sequenza,profilo,store,pratica}.py` né la logica di
  `ingest.py`/`ingest_txt.py`/`ingest_pdf.py` già esistente per Excel/TXT/PDF testuale.

## Test richiesti

Fixture di un PDF scansionato con testo realistico (un'immagine con testo renderizzato in un layout
simile al giornale delle fasi precedenti, non solo una pagina bianca come il fixture di Fase C che
serviva solo a testare il rifiuto) — se possibile, usa anche un file scansionato reale che ti
fornirà Ruben. Verifica che tutte le pagine di un PDF multi-pagina vengano lette (non un campione di
4). Verifica che l'analisi non proceda finché la conferma umana non è avvenuta. Verifica che, con
testo confermato (eventualmente corretto rispetto a quanto letto dall'OCR), l'applicazione del
profilo produca lo stesso tipo di risultato già visto per TXT/PDF testuale. Rilancia l'intera suite
esistente: nessuna regressione.

**Sul conteggio dei test**: nelle tre fasi precedenti il numero di test dichiarato nel riepilogo
finale non ha mai coinciso con quello reale, con uno scarto costante di 11 (probabilmente perché
`tests/modules/jet/` — una cartella non tracciata da git, scope creep segnalato da tempo — viene
inclusa quando esegui la suite nella working directory). Per questa fase: esegui
`pytest --collect-only -q` in un checkout pulito (`git archive` del tuo commit in una cartella
temporanea, non la working directory) e incolla l'output letterale nel riepilogo, non un numero
riassunto a memoria.

## Consegna

Branch nuovo dalla punta di `jet/faseC-pdf-testuale`. Commit locali, niente push né PR. Nel
riepilogo: cosa hai trovato testando l'allineamento del testo OCR su un file scansionato reale (passo
zero, sopra) e se hai dovuto rivedere l'approccio rispetto a quanto descritto qui, il diff esatto, il
risultato della suite con l'output letterale di `pytest --collect-only` da un checkout pulito, e
conferma esplicita che l'analisi non procede senza la conferma umana del testo.
