# Prompt — JET Fase 4b: correzione della colonna conto nella validazione Nordson (Quadra — modulo JET)

## Contesto

Correzione mirata sopra `jet/fase4-dimensione-conto` (approvato per il codice). Non è un problema
di `criteri.py`/`models.py` — quella logica va bene così com'è. Il problema è nello script di
validazione: `scripts/valida_jet_nordson.py` legge la colonna `Conto contabile` di `Original data`
come conto principale, ma dopo un controllo su tutta la popolazione (non solo sulla riga di esempio
usata in Fase 2) risulta che **l'85% dei suoi valori non sono codici conto**, sono etichette del
tipo di documento SAP (es. "Invoice ZF2", "CoS EDI", "Vendor invoice"). La colonna giusta è
`Conto n.`: sempre valorizzata, numerica al 99,97%, 1.957 valori distinti con una distribuzione
plausibile per un piano dei conti reale. L'esempio fornito nel prompt della Fase 2 proveniva da una
sola riga e non è stato verificato contro l'intera popolazione — errore mio, non un problema del tuo
lavoro sull'ingest o sui criteri.

## Cosa fare

In `scripts/valida_jet_nordson.py`, modifica `_conti_original_data` (o il suo punto di chiamata)
per leggere `Conto n.` invece di `Conto contabile`. Nessun'altra modifica: `ingest.py` e
`criteri.py` restano quelli già approvati, `conto_contabile` in `RigaGiornale` resta il nome del
campo canonico — cambia solo quale colonna sorgente ci viene mappata in questa validazione
specifica.

Rilancia la validazione sul file reale e riporta i nuovi numeri di distribuzione (conti distinti,
frequenza <5, <10, >1000, massima) — mi aspetto valori vicini a: 1.957 conti distinti, ~763 con
frequenza <5 (~1.896 righe, 0,9% della popolazione), frequenza massima intorno a 27.000. Se i tuoi
numeri sono sensibilmente diversi, prima di riportarli controlla di aver letto la colonna giusta
(indice di `Conto n.` nell'intestazione, non `Conto contabile` né `Conto conta`).

## Un controllo da aggiungere per il futuro

Aggiungi, in coda allo script di validazione (solo per Nordson, non serve generalizzarlo ancora), una
piccola stampa diagnostica sulla colonna conto usata: percentuale di valori numerici vs testuali,
percentuale di celle vuote, numero di valori distinti. Se in una fase futura useremo questo stesso
schema di validazione su un nuovo cliente (ne arriverà uno reale a breve), voglio che chi scrive
quel prompt — io per primo — abbia questo controllo automatico invece di fidarsi di una singola riga
di esempio, come è successo qui.

## Cosa NON fare

Non toccare `backend/jet/ingest.py`, `backend/jet/criteri.py`, `backend/jet/models.py`. Non
modificare la fixture sintetica della Fase 2 (usa nomi di colonna inventati, non è affetta da
questo problema). Non tentare di "ripulire" la colonna `Conto contabile` per ricavarne comunque un
conto (es. escludendo le etichette testuali riga per riga) — è una colonna concettualmente diversa,
non va riparata, va sostituita con quella giusta.

## Consegna

Branch nuovo da `jet/fase4-dimensione-conto`, es. `jet/fase4b-correzione-colonna-conto`. Commit
locali, niente push né PR. Nel riepilogo finale: il diff (dovrebbe essere solo
`scripts/valida_jet_nordson.py`), la suite completa (nessuna modifica attesa al numero di test, ma
rilanciala comunque), e i nuovi numeri di distribuzione confrontati con quelli attesi sopra.
