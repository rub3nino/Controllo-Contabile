# Prompt — JET Fase B: motore di profili di estrazione per file TXT a colonne fisse (Quadra — modulo JET)

## Contesto

La Fase A (`jet/faseA-pratiche-operative`, approvata) rende JET operativo end-to-end per un cliente
che fornisce il libro giornale già in Excel: `backend/jet/{pratica,store,api}.py` gestiscono
pratiche, parametri, upload, mappatura colonne, analisi e risultati. `backend/jet/ingest.py`
(`leggi_righe_xlsx`, `mappa_righe_giornale`) e il motore di calcolo (`criteri.py`, `sequenza.py`,
`models.py`) restano quelli verificati nelle Fasi 1-5.

In pratica, il formato più frequente di export da un gestionale non è l'Excel: è una stampa di testo
a colonne fisse (ogni riga ha una lunghezza fissa, ogni campo occupa sempre le stesse posizioni di
carattere). Questa fase costruisce il motore per leggerlo, con lo stesso metodo che avevo usato a
mano, fuori dal repository, per validare JET su un secondo cliente reale (ALUK Group S.p.A., 56.133
registrazioni, "Stampa di Prova Giornale Contabile"): posizioni dei campi derivate una volta
dall'intestazione, poi riusate. Quello script non è mai stato portato nel repository — questa fase
lo generalizza e lo rende parte del prodotto, non uno strumento a parte.

Leggi prima per intero `backend/jet/ingest.py` (i normalizzatori privati `_testo_o_none`,
`_data_o_none`, `_ora_o_none`, `_decimale_o_none` sono la parte che questa fase deve riusare, non
duplicare) e `backend/jet/{pratica,store,api}.py` così come sono oggi, per capire esattamente dove si
aggancia il nuovo lavoro.

## Decisione di fondo, già presa

Il profilo di estrazione per un TXT a colonne fisse **non deriva le posizioni dei campi in modo
automatico dalle etichette di intestazione** (quell'euristica, quella usata a mano su ALUK, resta
fuori da questa fase — vedi "Cosa NON fare"). Il sistema fa due cose, non tre:

1. **Riconosce** un'intestazione già vista confrontandola con i profili salvati (confronto esatto su
   stringa normalizzata, non approssimato) e, se combacia, applica automaticamente le posizioni già
   configurate.
2. Se l'intestazione non combacia con nessun profilo noto, **mostra all'utente l'intestazione grezza**
   (e qualche riga di dati di esempio) e gli fa **indicare lui, una volta sola**, dove sono i campi
   che servono (posizione di inizio e fine carattere per ciascun campo di `RigaGiornale` che vuole
   mappare). Quella configurazione diventa un nuovo profilo, con un nome scelto dall'utente, salvato e
   riusato automaticamente per i prossimi file con la stessa identica intestazione.

Questo è tutto quello che questa fase deve fare. Non c'è un terzo passo di "il sistema prova a
indovinare le posizioni da solo": è un miglioramento futuro possibile, non un requisito qui, e non
deve rallentare questa fase.

## Cosa implementare

### 1. Modello e store del profilo (nuovo file `backend/jet/profilo.py`)

`ProfiloEstrazione`: `id`, `nome` (scelto dall'utente, es. "Gestionale ALUK" o il nome del cliente),
`riga_intestazione` (indice, a partire da 0, della riga di intestazione nel file — vedi sotto per come
si individua), `intestazione_riferimento` (il testo esatto, normalizzato, usato per il matching),
`posizioni: dict[str, tuple[int, int]]` (per ciascun campo di `RigaGiornale` mappato: carattere di
inizio e fine — definisci tu con chiarezza se `fine` è inclusivo o esclusivo, documentalo nel
docstring e usalo in modo coerente ovunque), `created_at`. Stessa disciplina di `ParametriClienteJet`:
un campo non mappato semplicemente non compare in `posizioni`, non diventa una posizione fittizia
`(0, 0)`.

Persistenza: estendi `backend/jet/store.py` (o aggiungi una classe dedicata nello stesso file, se
preferisci separare le responsabilità — decidi tu, ma resta nello stesso `jet.sqlite3`, non un
database a parte) con CRUD per i profili e una ricerca per intestazione esatta normalizzata (spazi
iniziali/finali rimossi; non fare fuzzy matching — se l'intestazione cambia anche di un carattere,
è corretto che non trovi il profilo, non un bug da mascherare).

### 2. Lettura TXT a colonne fisse

Aggiungi una nuova funzione di lettura (nuovo file `backend/jet/ingest_txt.py`, per non toccare
affatto `ingest.py` — più sicuro da verificare). Deve:

- Aprire il file provando `utf-8` e poi `cp1252`/`latin-1` come fallback (le stampe da gestionale
  italiane spesso non sono UTF-8): se nessuna codifica produce testo leggibile, un errore chiaro, non
  un crash con un traceback di decodifica.
- Individuare la riga di intestazione: per questa fase è sufficiente considerare la **prima riga non
  vuota del file** come intestazione candidata (non serve una euristica più sofisticata: se un file
  reale ha un preambolo prima dell'intestazione vera, è un caso da gestire quando si presenta, non da
  anticipare qui).
- Tagliare ogni riga dati alle posizioni del profilo, restituendo dizionari `campo -> stringa grezza`
  (non ancora `RigaGiornale`).
- Validare che ogni riga dati sia abbastanza lunga per tutte le posizioni richieste dal profilo: se
  una riga è più corta, un errore leggibile che indica il numero di riga, non un `IndexError` non
  gestito né un troncamento silenzioso.

Per convertire i dizionari grezzi in `RigaGiornale`, riusa gli stessi normalizzatori già scritti in
`ingest.py` per Excel (`_testo_o_none`, `_data_o_none`, `_ora_o_none`, `_decimale_o_none`): sono già
scritti per accettare anche stringhe, quindi dovrebbero funzionare invariati anche su valori letti da
TXT. Per riusarli da un altro modulo devi renderli pubblici (togliere il trattino iniziale) — è un
tocco minimo, additivo e a basso rischio a `ingest.py`, a differenza di modificarne la logica: fallo,
ma verifica che `leggi_righe_xlsx` e `mappa_righe_giornale` restituiscano *esattamente* gli stessi
risultati di prima (i test Fase 1-2 esistenti devono passare invariati, senza toccarli). Se preferisci
un'altra soluzione che eviti di toccare `ingest.py` anche per questo, spiegala nel riepilogo — ma non
duplicare la logica di parsing di date/importi: sono le stesse regole, tenerle in un solo posto.

### 3. API

Estendi `backend/jet/api.py` (tocchi già previsti e attesi in questa fase, a differenza della Fase A):

- `POST /api/jet/pratiche/{id}/file` deve accettare anche `.txt` oltre a `.xlsx` (il comportamento per
  `.xlsx` non deve cambiare in nessun modo — verificalo con i test Fase A esistenti, che devono
  continuare a passare senza modifiche). Per un `.txt`: leggi la riga di intestazione candidata, cerca
  un profilo corrispondente. Se lo trovi, restituiscilo nella risposta insieme all'intestazione letta,
  così il frontend può proporlo per conferma. Se non lo trovi, restituisci l'intestazione grezza e
  alcune righe di dati di esempio (es. le prime 5), perché il frontend costruisca la schermata di
  configurazione assistita.
- Endpoint per applicare un profilo alla pratica — sia il caso "usa un profilo esistente" (per id) sia
  "creane uno nuovo da queste posizioni" (nome + posizioni, e la pratica lo usa subito). Decidi tu se
  un endpoint solo con corpo variabile o due endpoint distinti; documenta la scelta nel riepilogo.
- `GET /api/jet/profili` (lista) e `GET /api/jet/profili/{id}` (dettaglio), per popolare una eventuale
  lista "scegli un profilo esistente" nel frontend.
- `/pratiche/{id}/analizza`: per una pratica il cui file è `.txt`, richiedi un profilo applicato prima
  di procedere (stesso spirito del controllo già esistente su parametri/file/mappatura per Excel — un
  409 con messaggio chiaro se manca). Per `.xlsx` il comportamento resta quello di Fase A (mappatura
  colonne), invariato.

### 4. Frontend

In `ui/src/jet/JetDashboard.tsx`, il passo "2. File Excel e mappatura" diventa "File e
mappatura/profilo": accetta anche `.txt`. Dopo l'upload di un TXT:

- Se è stato trovato un profilo corrispondente, mostralo (nome, quando è stato creato) con un modo per
  confermarlo con un click, o sceglierne uno diverso dalla lista dei profili esistenti, o crearne uno
  nuovo comunque.
- Se non è stato trovato nessun profilo, mostra l'intestazione grezza e un paio di righe di esempio in
  un carattere monospace (per far vedere davvero l'allineamento dei caratteri), e lascia che l'utente
  indichi, per ciascun campo che vuole mappare, la posizione di inizio e fine carattere con due caselle
  numeriche. Non serve un'interazione di trascinamento sofisticata: due numeri per campo, con
  un'evidenziazione visiva (es. uno sfondo) della porzione di testo corrispondente nell'intestazione
  mentre l'utente digita, sono sufficienti e molto più sicuri da fare bene in questa fase. Chiedi un
  nome per il profilo prima di salvarlo.

## Cosa NON fare

- Non toccare `backend/jet/{models,criteri,sequenza}.py`: il motore di calcolo non cambia, cambia solo
  come i dati arrivano a `RigaGiornale`.
- Non modificare il comportamento esistente per Excel in nessun file: `leggi_righe_xlsx`,
  `mappa_righe_giornale`, l'endpoint di upload per `.xlsx`, la mappatura per colonna. I test Fase A
  esistenti devono continuare a passare senza essere toccati.
- Non implementare PDF (testuale o scansionato): sono le Fasi C e D.
- Non derivare automaticamente le posizioni dei campi dalle etichette di intestazione: per questa fase
  è l'utente a indicarle, una volta, come deciso sopra.
- Non fare fuzzy matching delle intestazioni: solo confronto esatto su stringa normalizzata.
- Non introdurre una libreria nuova per il parsing a colonne fisse: è semplice slicing di stringhe,
  libreria standard.

## Test richiesti

Costruisci un fixture TXT a colonne fisse per i test (es. `fixtures/jet/giornale_colonne_fisse.txt`,
una decina di righe basta) — a tua scelta se sintetico scritto a mano o generato nel test stesso.
Includi anche un fixture (o una variante) con una codifica non-UTF-8 (`cp1252` o `latin-1`) con almeno
un carattere accentato, per verificare che la lettura con fallback di codifica funzioni davvero, non
solo che il codice ce l'abbia.

Test richiesti almeno: un'intestazione mai vista non trova profilo (risposta coerente, non un errore);
un profilo creato con posizioni esplicite estrae correttamente i campi attesi, incluso il caso con
codifica non-UTF-8; un secondo file con la stessa identica intestazione trova e riusa automaticamente
il profilo; un profilo applicato a un file le cui righe sono più corte di quanto richiesto produce un
errore leggibile, non un crash; `leggi_righe_xlsx`/`mappa_righe_giornale` continuano a comportarsi
esattamente come prima (rilancia i test Fase 1-2 esistenti, non ne servono di nuovi se non cambi quelle
funzioni). Rilancia l'intera suite: nessuna regressione sui centoventicinque test esistenti (verifica
tu stesso il numero esatto con `pytest --collect-only`, non fidarti a memoria).

## Checklist di autoverifica finale

- [ ] `backend/jet/{models,criteri,sequenza}.py` hanno diff vuoto.
- [ ] `leggi_righe_xlsx`/`mappa_righe_giornale` invariate nel comportamento (test Fase A verdi senza
      modifiche).
- [ ] Un campo TXT non mappato nel profilo produce `None` a valle, non un valore fittizio.
- [ ] Lettura con fallback di codifica verificata con un test che usa davvero un file non-UTF-8, non
      solo letta nel codice.
- [ ] Un profilo riusato su un secondo file con la stessa intestazione non richiede all'utente di
      ripetere la configurazione.
- [ ] Riga dati più corta del previsto: errore leggibile con numero di riga, non crash.
- [ ] `python -m pytest tests/ -q` pulito, conteggio esatto riportato (base e dopo).
- [ ] Riepilogo: file nuovi ed esistenti toccati, e per questi ultimi perché.

## Consegna

Branch nuovo da `jet/faseA-pratiche-operative` (che include già il fix di Fase A), es.
`jet/faseB-profili-estrazione-txt`. Commit locali, niente push né PR. Nel riepilogo finale: diff esatto
(`git diff jet/faseA-pratiche-operative..jet/faseB-profili-estrazione-txt --stat`), risultato della
suite con conteggio verificato via `--collect-only`, e conferma esplicita che il flusso Excel di Fase A
non è cambiato di comportamento.
