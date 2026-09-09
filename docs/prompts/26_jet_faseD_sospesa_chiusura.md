# Prompt — JET: chiusura provvisoria della Fase D (PDF scansionato in pausa) (Quadra — modulo JET)

## Contesto

Il passo zero della Fase D (verifica dell'allineamento a colonne del testo OCR su un PDF
scansionato, richiesto prima di implementare qualunque interfaccia) ha mostrato che PaddleOCR non
mantiene un allineamento sufficientemente stabile su un giornale a colonne fisse per riusare il
meccanismo di profili esistente — hai fatto benissimo a fermarti come indicato dal prompt invece
di forzare l'implementazione. Concordato con Ruben: **la Fase D resta in pausa** (non
abbandonata, solo rimandata: servirà un approccio diverso, basato su bounding box OCR e una
griglia editabile con conferma umana, la cui praticabilità su volumi reali va ancora valutata).
Questo prompt non implementa quell'alternativa: si limita a chiudere in modo pulito e onesto
quanto già scritto in Fase C, che oggi promette implicitamente qualcosa che per ora non
consegniamo.

## Cosa correggere

In `backend/jet/ingest_pdf.py`, la costante `ERRORE_PDF_SCANSIONATO` dice oggi:

> "Questo file sembra un PDF scansionato: l'estrazione testuale non è supportata, serve l'OCR
> della Fase D"

Aggiornala per non promettere una fase attiva con una scadenza implicita, restando comunque
chiara sul da farsi, per esempio:

> "Questo file sembra un PDF scansionato: l'estrazione testuale non è supportata. Carica invece
> un export Excel, TXT o PDF con testo reale dello stesso giornale."

Il testo esatto lo scegli tu, purché: (a) non citi "Fase D" o dia l'impressione di una scadenza
imminente, (b) resti comprensibile a un revisore che non conosce la struttura interna del
progetto, (c) mantenga la sotto-stringa "PDF scansionato" per non rompere
`tests/test_jet_ingest_pdf.py::test_pdf_senza_testo_richiede_ocr_fase_d` e l'equivalente in
`tests/test_jet_api_pdf.py` — aggiorna anche i nomi/asserzioni di questi due test se il nuovo
testo non contiene più "OCR della Fase D" letteralmente (controlla `match=` e gli `assert` sulla
sottostringa, aggiornali per riflettere il nuovo messaggio senza cambiarne il senso).

Aggiungi una breve nota nel repository (per esempio in cima a `backend/jet/ingest_pdf.py` come
commento, o in un file `docs/jet/limitazioni_note.md` se preferisci centralizzare le limitazioni
note del modulo) che registri: PDF scansionati non supportati per scelta al momento, non per bug;
motivo (instabilità dell'allineamento OCR verificata con un test preliminare); condizione per
riprendere il lavoro (un approccio a bounding box/griglia editabile, ancora da valutare su volumi
reali). Due o tre righe bastano, non serve un documento lungo.

## Cosa NON fare

- Non implementare l'OCR, i bounding box o la griglia editabile: è esplicitamente rimandato.
- Non toccare nient'altro di Fase A/B/C: nessuna modifica a `models.py`, `criteri.py`,
  `sequenza.py`, `profilo.py`, `store.py`, `pratica.py`, alla logica di
  `ingest.py`/`ingest_txt.py`, o al resto di `ingest_pdf.py`/`api.py` oltre al messaggio ed
  eventuali riferimenti diretti a "Fase D" nei commenti.

## Test richiesti

Aggiorna i due test esistenti che verificano il messaggio esatto (`test_jet_ingest_pdf.py`,
`test_jet_api_pdf.py`) per riflettere il nuovo testo. Rilancia l'intera suite: nessuna
regressione. Come sempre, verifica il conteggio reale con `pytest --collect-only -q` in un
checkout pulito (`git archive`), non nella working directory, e incolla l'output letterale nel
riepilogo.

## Consegna

Branch nuovo dalla punta di `jet/faseC-pdf-testuale` (la Fase D non ha prodotto commit). Commit
locali, niente push né PR. Nel riepilogo: il testo esatto scelto per il messaggio, dove hai
messo la nota sulla limitazione, e conferma che nessun altro comportamento è cambiato.
