# Prompt — JET Fase A, correzione: paginazione dell'export Excel (Quadra — modulo JET)

## Contesto

Ho verificato la Fase A (`jet/faseA-pratiche-operative`, commit `d1aa3e9`/`d2953b9`) su un benchmark
sintetico a scala realistica (100.000-200.000 righe, le dimensioni del cliente reale già testato in
Fase 1-5). Tutto il resto della fase è corretto e resta com'è: questo prompt tocca **solo**
`export_results` in `backend/jet/api.py`.

`export_results` costruisce il workbook iterando `JetStore.query_results(..., limit=1000,
offset=offset)` con `offset` crescente a ogni ciclo. Su SQLite, `LIMIT`/`OFFSET` con `ORDER BY
punteggio_totale DESC, id ASC` costa proporzionalmente all'offset quando `da_investigare`/
`conto_contabile` non sono filtrati (l'indice composito `(pratica_id, da_investigare,
conto_contabile, punteggio_totale)` aiuta solo quando quelle due colonne sono vincolate): la
scansione dev'essere rifatta da capo a ogni blocco. Misurato: 1,3 s su 20.000 righe, **48,8 s** su
100.000 righe — crescita nettamente superlineare, non accettabile su una pratica da 200mila+ righe
(la normalità per questo modulo, non un caso limite).

## Cosa correggere

In `backend/jet/store.py`, aggiungi un metodo di iterazione per l'export che scandisce
`risultato_jet` per chiave (`keyset pagination`) sulla colonna `id` (chiave primaria autoincrementale,
già presente), non con `OFFSET`:

```
WHERE pratica_id = ? [AND ...filtri...] AND id > ?
ORDER BY id ASC
LIMIT ?
```

tenendo traccia dell'ultimo `id` restituito fra una chiamata e la successiva. Questo è O(1) per
blocco indipendentemente da quanto si è già scansionato, perché `id` è la chiave primaria: nessuna
scansione ripetuta dall'inizio della tabella.

Conseguenza accettata e voluta: l'export non sarà più ordinato per `punteggio_totale` ma per ordine
di inserimento (che nella pratica coincide con l'ordine delle righe nel file Excel originale caricato
dal cliente) — è un compromesso ragionevole per un file che il revisore può comunque riordinare in
Excel; se preferisci mantenere l'ordine per punteggio, valuta invece se ordinare in memoria le sole
righe già lette a blocchi via `id`, ma non tornare a `OFFSET` per farlo. Decidi tu quale delle due
strade, e dillo esplicitamente nel riepilogo.

Aggiorna `export_results` in `backend/jet/api.py` per usare il nuovo metodo al posto del ciclo con
`offset` crescente.

**Non toccare** l'endpoint `/risultati` (paginazione interattiva): resta con `OFFSET`, non ha lo
stesso problema in pratica (un revisore non clicca migliaia di volte "Successiva" per raggiungere un
offset alto) e cambiarlo non è necessario né richiesto qui.

## Cosa NON fare

Non toccare nient'altro della Fase A: nessun'altra funzione di `store.py`/`api.py`/`pratica.py`,
nessun file frontend, nessun file del motore (`models.py`/`ingest.py`/`criteri.py`/`sequenza.py`).
Non introdurre una libreria di paginazione esterna: è una modifica piccola, autosufficiente con
`sqlite3` di libreria standard.

## Test richiesti

Un test in `tests/test_jet_store.py` (o nuovo file) che genera almeno 20.000-50.000 righe sintetiche
(puoi riusare l'helper `_pair` già presente) e verifica che il tempo della nuova iterazione di export
cresca linearmente (o quasi) con il numero di righe, non quadraticamente — confronta il tempo per
50.000 righe con quello per 10.000: il rapporto deve restare vicino a 5×, non 25× o più. Non serve
misurare tempi assoluti in millisecondi in un'asserzione (fragile su macchine diverse): basta un
confronto di rapporto con un margine ragionevole. Aggiungi anche un test funzionale che conferma che
tutte le righe vengono restituite esattamente una volta, senza duplicati né buchi, iterando fino a
esaurimento. Rilancia l'intera suite: nessuna regressione.

## Consegna

Commit sopra `jet/faseA-pratiche-operative` (stesso branch, nuovo commit — non serve un branch a
parte per una correzione così piccola e scoped, ma se preferisci separarlo va bene comunque). Niente
push né PR. Nel riepilogo: quale delle due strade hai scelto per l'ordinamento (inserimento vs.
punteggio ricalcolato in memoria a blocchi) e perché, il tempo misurato su almeno 100.000 righe prima
e dopo la correzione, e conferma che `/risultati` non è stato toccato.
