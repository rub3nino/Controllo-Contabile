# Prompt — JET Fase C: estrazione da PDF testuale (Quadra — modulo JET)

> **Nota per chi implementa, da leggere prima di tutto:** questo prompt è stato scritto mentre la
> Fase B (`jet/faseB-profili-estrazione-txt` — motore di profili di estrazione per TXT a colonne
> fisse) era ancora in corso, non ancora verificata. Ogni riferimento qui sotto a nomi di file, classi
> o endpoint della Fase B è la mia previsione di come sarà strutturata, non un dato certo. **Prima di
> scrivere una riga di codice, leggi per intero il codice reale della Fase B così com'è stato
> consegnato** (non questo prompt) e adatta i nomi esatti a quello che trovi. Se l'architettura reale
> di Fase B rende impossibile o molto più complicata la strategia di riuso descritta qui — per esempio
> se la logica di matching-profilo è scritta assumendo sempre un file `.txt` su disco, senza un punto
> di ingresso che accetti semplicemente "una lista di righe di testo" — **fermati e segnalalo nel
> riepilogo invece di duplicare da zero il motore di profili**: è un caso da rivedere con me, non da
> risolvere a modo tuo.

## Contesto

La Fase B costruisce il motore di "profili di estrazione" per file TXT a colonne fisse: un profilo
(`ProfiloEstrazione`, presumibilmente in `backend/jet/profilo.py`) ricorda, per un'intestazione già
vista, le posizioni di inizio/fine carattere di ciascun campo di `RigaGiornale`; quando arriva un file
con la stessa intestazione, le posizioni si riapplicano automaticamente; quando l'intestazione è
nuova, l'utente le indica una volta in una schermata assistita, e quella configurazione diventa un
nuovo profilo riusabile.

Questa fase (C) applica la stessa idea a un PDF testuale: un export del libro giornale in PDF il cui
contenuto è vero testo estraibile (non una scansione — quello è la Fase D, con OCR, deliberatamente
separata e successiva). Il principio, deciso a monte: **Fase C non deve duplicare il motore di
profili**. Il suo unico compito è trasformare un PDF in qualcosa di equivalente a "le righe di un file
TXT" — una lista di stringhe, una per riga del libro giornale, con l'allineamento a colonne il più
possibile preservato — e poi consegnare quelle righe allo stesso meccanismo di matching/applicazione
profilo già costruito in Fase B, senza toccarne la logica.

## Cosa implementare

### 1. Estrazione testo da PDF (nuovo file `backend/jet/ingest_pdf.py`)

Una funzione che, dato un percorso PDF, restituisce una lista di righe di testo (una stringa per riga
visualizzata nel documento). Usa `pymupdf` (`fitz`), già dipendenza del progetto (`requirements.txt`),
non `pypdf`: l'estrazione "a griglia"/layout di PyMuPDF (es. `page.get_text("text")` con le opzioni di
preservazione del layout, o ricostruendo le righe dalle posizioni delle singole parole se il testo
semplice non basta a mantenere l'allineamento a colonne) conserva l'allineamento orizzontale molto
meglio di un'estrazione di testo "a flusso". Prova prima l'estrazione più semplice che preserva il
layout; se sui PDF reali che Ruben fornirà per il test l'allineamento a colonne non regge (caratteri
che scivolano di una o due posizioni da riga a riga), documenta il problema nel riepilogo invece di
inseguire un allineamento perfetto a tempo indefinito — è un limite noto da eventualmente affrontare
in una fase successiva, non da nascondere.

**Distingui esplicitamente un PDF senza testo estraibile** (una scansione, o un PDF "vuoto" di testo):
se l'estrazione produce nulla o quasi nulla di utile, la funzione deve fallire con un errore chiaro
("questo file sembra un PDF scansionato: l'estrazione testuale non è supportata, serve l'OCR della
Fase D"), non restituire una lista vuota silenziosa né tentare un fallback OCR automatico — l'OCR è
volutamente un'altra fase, con un'altra interfaccia utente (la conferma umana della lettura, come
deciso per la Fase D).

### 2. Collegamento al motore di profili di Fase B

Una volta ottenuta la lista di righe di testo dal PDF, deve poter attraversare **esattamente** lo
stesso percorso già costruito per il TXT in Fase B: individuazione della riga di intestazione,
confronto con i profili salvati, applicazione automatica se combacia, schermata assistita se non
combacia, salvataggio come nuovo profilo. Se il codice di Fase B espone già un punto d'ingresso che
accetta una lista di righe di testo indipendentemente dalla loro origine, usalo. Se invece la lettura
del TXT e l'applicazione del profilo sono scritte insieme in un'unica funzione che assume un file su
disco, il refactoring minimo e giustificato da fare è separare le due responsabilità ("ottieni le
righe" da "applica il profilo a delle righe") — un cambiamento additivo alla Fase B, non una riscrittura,
e da dichiarare esplicitamente nel riepilogo.

### 3. API

Estendi l'endpoint di upload file della pratica (presumibilmente `POST
/api/jet/pratiche/{id}/file`) per accettare anche `.pdf`, oltre a `.xlsx` e `.txt` già supportati (il
cui comportamento non deve cambiare in nessun modo). Per un `.pdf`: estrai le righe di testo, poi segui
lo stesso flusso di riconoscimento/applicazione profilo già usato per il TXT. Se l'estrazione fallisce
perché il PDF è scansionato, restituisci l'errore chiaro descritto sopra (status code 400, messaggio
comprensibile a un revisore, non un traceback).

### 4. Frontend

Estendi l'input di caricamento file (in `JetDashboard.tsx` o dove la Fase B l'ha messo) per accettare
anche `.pdf`. Il resto dell'interfaccia (conferma profilo trovato, configurazione assistita se non
trovato) dovrebbe restare invariato, dato che è già generico su "intestazione grezza + righe di
esempio" indipendentemente dal formato di provenienza — se scopri che non è così, è un segnale che la
Fase B andrebbe resa più generica prima di procedere: segnalalo.

## Cosa NON fare

- Non implementare OCR o gestione di PDF scansionati: è la Fase D, con la sua interfaccia dedicata.
- Non duplicare la logica di matching/applicazione profilo: il compito di questa fase è solo produrre
  righe di testo da un PDF, non reinventare come vengono interpretate.
- Non toccare `backend/jet/{models,criteri,sequenza}.py`.
- Non modificare il comportamento esistente per `.xlsx`/`.txt`.
- Non introdurre AI/LLM per l'estrazione o l'interpretazione del testo: resta un motore a regole.

## Test richiesti

Costruisci un fixture PDF testuale (puoi generarlo con `pymupdf` stesso o `reportlab`, se disponibile,
in un piccolo script di supporto ai test) che riproduce un layout a colonne fisse analogo a quello del
fixture TXT di Fase B — così puoi dimostrare che **lo stesso profilo**, creato una volta, funziona sia
sul TXT sia sul PDF equivalente (è la prova più convincente che il riuso del motore funziona
davvero). Aggiungi anche un fixture PDF senza testo estraibile (una pagina bianca o un'immagine
inserita come pagina) per verificare che l'errore esplicito scatti come previsto, non un crash né un
risultato vuoto. Rilancia l'intera suite esistente: nessuna regressione, conteggio esatto verificato
con `pytest --collect-only` prima di dichiararlo nel riepilogo (nelle due fasi precedenti i numeri
dichiarati non hanno mai coinciso con quelli reali — controlla sempre).

## Consegna

Branch nuovo dalla punta di `jet/faseB-...` (il nome esatto del branch Fase B, una volta che esiste).
Commit locali, niente push né PR. Nel riepilogo: conferma esplicita di aver letto il codice reale della
Fase B prima di iniziare (non questo prompt), cosa hai dovuto adattare rispetto a quanto previsto qui,
il diff esatto, il risultato della suite con conteggio verificato, e se l'allineamento a colonne
estratto dal PDF di test ha retto senza problemi o ha richiesto compromessi da segnalare.
