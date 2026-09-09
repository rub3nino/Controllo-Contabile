# Prompt — JET Fase 3b: esclusione degli account di sistema dal criterio staff (Quadra — modulo JET)

## Contesto

Piccola aggiunta mirata sopra `jet/fase3-criteri` (approvato: `backend/jet/criteri.py`,
`backend/jet/sequenza.py`, validazione confermata contro Nordson). Durante la verifica della Fase 3
è emerso, e l'ho controllato personalmente sul file reale, che il criterio "staff non autorizzato"
applicato alla lettera flagga 190.618 righe su 213.656 (l'83%) — ma 178.992 di queste sono solo due
account: `BATCHJOB` (135.267 righe) e `BANKBATCH` (43.725 righe), interfacce automatiche di sistema,
non persone. Non compaiono nella lista dei 38 preparatori umani autorizzati per un motivo ovvio: non
sono preparatori, sono processi automatici. Il foglio Excel storico non se n'era mai accorto solo
per un difetto di una formula (`Calcs1!U`) che di fatto disattivava il criterio per chiunque.

Questa fase distingue esplicitamente "non è un preparatore umano autorizzato" da "è un processo di
sistema, non si applica il concetto di autorizzazione individuale" — stessa disciplina già seguita
per i dati mancanti (`None` ≠ `False`), applicata qui a una categoria concettualmente diversa:
questa volta il dato non manca, è il criterio stesso a non essere pertinente per quell'attore.

## Cosa costruire

In `backend/jet/models.py`, un nuovo campo opzionale in `ParametriClienteJet`:
`utenti_di_sistema: list[str] | None = None`, con docstring che spiega la distinzione sopra (account
di interfacce automatiche/batch, esclusi dal criterio "staff non autorizzato" perché il concetto di
autorizzazione individuale non si applica a un processo, non perché siano considerati "autorizzati"
nel senso ordinario). Non toccare nessun altro campo del modello.

In `backend/jet/criteri.py`, modifica `valuta_riga`: se `riga.utente` è presente in
`parametri.utenti_di_sistema` (quando la lista è fornita), `flag_staff_non_autorizzato` deve
risultare `None` (non calcolabile / non applicabile), esattamente come già succede oggi quando
`riga.utente` è `None` o `parametri.staff_autorizzato` è `None` — stessa famiglia di casi, stesso
trattamento. Se `utenti_di_sistema` non è fornito (`None`), il comportamento resta quello attuale,
invariato: nessuna riga viene esclusa implicitamente.

In `scripts/valida_jet_nordson.py`, passa `utenti_di_sistema=["BATCHJOB", "BANKBATCH"]` quando
costruisci i `ParametriClienteJet` per la validazione Nordson (valori giustificati dal conteggio
utenti già fatto, non magici: sono i due soli account il cui volume domina la popolazione e il cui
nome indica chiaramente un'interfaccia automatica — non aggiungere altri utenti alla lista senza una
verifica altrettanto esplicita).

## Cosa NON fare

Non inventare una euristica automatica per riconoscere "che sembra un account di sistema" (es. per
pattern del nome) — la lista è sempre esplicita e fornita dal cliente/dall'analisi, mai indovinata a
runtime. Non toccare gli altri dieci criteri. Non modificare `soglia_da_investigare` né i pesi.

## Test richiesti

Un test che verifica che un utente presente in `utenti_di_sistema` produce
`flag_staff_non_autorizzato=None` anche se non è nella lista `staff_autorizzato`. Un test che
verifica che, con `utenti_di_sistema=None` (default), il comportamento è identico a prima (nessuna
esclusione implicita — non una regressione silenziosa). Rilancia tutta la suite (101 test dopo la
Fase 3, verificati in ambiente pulito): nessuna regressione.

Poi rilancia `scripts/valida_jet_nordson.py` sul file reale (come già fatto per la Fase 3) e
riporta nel riepilogo il nuovo conteggio di "da investigare": mi aspetto che torni vicino a 184 (la
cifra del foglio Excel storico), dato che l'unica differenza rimasta rispetto al foglio storico è la
distinzione fra "criterio disattivato per bug" e "criterio correttamente non applicato a processi di
sistema" — se il numero non torna vicino, indaga e spiegalo nel riepilogo invece di forzarlo.

## Consegna

Branch nuovo da `jet/fase3-criteri`, es. `jet/fase3b-utenti-sistema`. Commit locali, niente push né
PR. Nel riepilogo finale: il diff esatto, il risultato di tutta la suite, e il nuovo conteggio
"da investigare" sul file reale Nordson confrontato con 184.
