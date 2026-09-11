# Revisione — Giorno 7 (finestra di chiusura, JET-07B)

Data: 10 settembre 2026
Branch `codex/jet-finestra-chiusura`, commit `07757bf`, dalla punta di `c307106`.
Verificato indipendentemente, non sul riepilogo fornito.

## Scope

`git diff c307106..07757bf --stat`: esattamente i cinque file dichiarati, nessuno in più —
`backend/jet/models.py`, `backend/jet/criteri.py`, `tests/test_jet_criteri.py`, `ui/src/jet/api.ts`,
`ui/src/jet/JetDashboard.tsx`.

## Lettura del codice

`festivita_chiusura`, `flag_finestra_chiusura`, `flag_creata_dopo_chiusura` in `criteri.py`
corrispondono parola per parola alla specifica del prompt 34: nessun fallback a giorni di calendario
quando il Paese non è impostato (per `flag_finestra_chiusura`); `flag_creata_dopo_chiusura` resta
calcolabile anche senza Paese, essendo un confronto di date puro. Confermato che nessuno dei due flag
compare nella tupla `flag_e_pesi` e che non esiste alcun campo `punteggio_finestra_chiusura` o
`punteggio_creata_dopo_chiusura` in nessun file.

## Verifica manuale del confine

Ho ricalcolato a mano il caso limite del test (`data_chiusura=31/12/2026`, finestra 5 giorni
lavorativi): il 31 dicembre 2026 è giovedì; il 24 dicembre (giovedì) ha uno scarto di 4 giorni
lavorativi fino alla chiusura (25/12 festività, 26/12 sabato, 27/12 domenica esclusi; 28-31/12 contati)
→ dentro la finestra; il 23 dicembre ha scarto 5 → fuori. Coincide esattamente con l'assunzione dei
test `test_finestra_chiusura_include_data_chiusura_e_confine`.

## Suite — rieseguita da me, ambiente pulito

`git archive` del commit `07757bf`, venv nuovo, sole dipendenze minime (niente `paddleocr`):

```
2 failed, 188 passed in 5.62s
```

Numero identico al riepilogo. I due falliti sono `test_ocr.py` per `PIL` mancante, estranei a JET.

## Nota operativa — non di codice

Al momento della verifica, `.git/index.lock` era di nuovo presente nella cartella di lavoro (timestamp
diverso da quello segnalato nella revisione del Giorno 6), e questa volta rendeva `git diff` sulla
cartella di lavoro inaffidabile. `git status` segnalava `backend/jet/models.py` e
`ui/src/jet/JetDashboard.tsx` come modificati oltre al commit `07757bf` — non è stato possibile
verificare il contenuto di queste modifiche per lo stesso motivo. Non riguarda il codice di questa
consegna (verificato correttamente sul commit), ma va risolto da Ruben direttamente sul Mac prima della
prossima fase.

## Esito

**Approvato.** Nessuna richiesta di modifica al codice.
