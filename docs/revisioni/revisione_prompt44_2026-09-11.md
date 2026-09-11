# Revisione — Prompt 44 / punto 11 (rilevamento informativo numerazione pagina)

Data: 11 settembre 2026

## Nota preliminare, importante

Questa non è una revisione indipendente nel senso in cui lo sono state tutte le precedenti di questo
sprint. Su richiesta esplicita di Ruben, in questa occasione **ho scritto io stesso il codice**
direttamente sui file del repository (non ho scritto un prompt per Codex), invece di limitarmi al ruolo
di supervisore. Questo significa che la garanzia di un secondo paio d'occhi indipendente — che in questo
sprint ha già trovato un bug reale (il caso ,99 del prompt 41) — qui non c'è stata allo stesso modo.
Quanto segue è quindi: (a) la mia dichiarazione di cosa ho implementato e perché, (b) la verifica di
scope che ho potuto fare io da questa sessione cloud, (c) la conferma che il test reale in ambiente
pulito è stato eseguito **da Ruben**, non da me, con esito positivo.

## Cosa è stato implementato

Punto 11 della tabella dei 15 controlli, secondo le decisioni di Ruben: rilevamento informativo (non un
punteggio, non un flag per riga) — "la fonte caricata ha una numerazione di pagina esplicitamente
mappata?" — su tutti e tre i formati (Excel, TXT, PDF) e su entrambi i percorsi di mappatura del
progetto (per-fonte multi-file e il percorso legacy a livello di pratica).

Per renderlo possibile ho aggiunto un campo `numero_pagina: str | None = None` a `RigaGiornale`
(`backend/jet/models.py`) — la prima modifica al modello centrale del motore JET da quando è stato
validato su Nordson/ALUK (Fase 1-5). Il campo non è usato da nessun criterio esistente; serve solo a
rendere `numero_pagina` un nome di campo ammesso nelle mappature Excel e nei profili TXT/PDF (il
meccanismo di validazione esistente lo accetta automaticamente una volta presente su `RigaGiornale`,
senza altre modifiche di validazione).

Il rilevamento vero e proprio è puramente derivato dalla configurazione, senza euristiche sul contenuto:
"il campo `numero_pagina` è tra le posizioni/colonne mappate dall'utente?" — persistito come nuovo campo
`pagina_rilevata: bool = False` su `FonteJet` e su `PraticaJet` (mirror automatico dalla fonte più
recente tramite `_sync_pratica_fonti`, come già avviene per `mappatura`/`profilo_estrazione_id`).

File toccati (11, nessun altro):
- `backend/jet/models.py` — campo `numero_pagina` su `RigaGiornale`.
- `backend/jet/ingest.py` — `mappa_righe_giornale` mappa anche `numero_pagina` (percorso Excel).
- `backend/jet/fonti.py`, `backend/jet/pratica.py` — campo `pagina_rilevata: bool = False`.
- `backend/jet/api.py` — due helper puri (`_pagina_rilevata_da_mappatura`, `_pagina_rilevata_da_profilo`)
  cablati in tutti i punti che impostano una mappatura Excel o applicano un profilo TXT/PDF (per-fonte e
  legacy pratica-only, 9 punti in totale), più il reset a `False` alla sostituzione del file sorgente e
  il mirroring in `_sync_pratica_fonti`.
- `ui/src/jet/api.ts` — `pagina_rilevata: boolean` su `JetPractice` e `JetSource`.
- `ui/src/jet/JetDashboard.tsx` — badge informativo per fonte ("numerazione pagina rilevata/non
  rilevata"), mostrato solo dopo che la fonte è configurata.
- `ui/src/jet/ParamsPanel.tsx` — testo del controllo id "11" aggiornato per menzionare il nuovo
  rilevamento informativo, senza introdurre punteggio.
- `tests/test_jet_models.py`, `tests/test_jet_ingest.py`, `tests/test_jet_multifile.py` — nuovi test.

## Verifica di scope che ho potuto fare io

Da questa sessione cloud `device_bash` continua a non raggiungere `.git`. Ho verificato lo scope
confrontando i timestamp di modifica (`device_list_dir`) di tutti i file in `backend/jet/`, `tests/` e
`ui/src/jet/` con quelli del mio stesso batch di scrittura: risultano modificati esclusivamente gli 11
file dichiarati sopra, tutti gli altri file di quelle cartelle hanno timestamp precedenti e non
correlati. Coerente con quanto riportato da Ruben ("non ho modificato né committato alcun file").

## Verifica dei test — eseguita da Ruben, non da me

Questa sessione cloud non ha accesso a PyPI (bloccato dalla policy di rete dell'ambiente, non un problema
specifico di questo prompt) e non può installare `fastapi`/`pytest`/le altre dipendenze del progetto. Ho
potuto solo: (1) verificare la sintassi di tutti gli 11 file, (2) eseguire realmente — con uno shim
minimo per sostituire `pytest` e con `pydantic`/`openpyxl` nudi, già presenti nell'ambiente — i test di
`test_jet_models.py` e `test_jet_ingest.py` (inclusi i due nuovi), tutti passati, nessuna regressione sui
test preesistenti di quei due file. Non ho potuto eseguire `test_jet_multifile.py`, che richiede
`fastapi.testclient.TestClient`.

Ruben ha eseguito lui stesso la suite completa in un checkout pulito creato con `git archive` (esattamente
il metodo previsto dalla disciplina di progetto), con risultato:
```
220 passed, 7 warnings in 4.13s
```
Coerente con l'atteso: 215 (base dopo il prompt 43) + 5 nuovi test di questo prompt (1 in
`test_jet_models.py`, 1 in `test_jet_ingest.py`, 3 in `test_jet_multifile.py`) = 220. Ruben conferma
inoltre che i tre test end-to-end di `test_jet_multifile.py` — quelli che io non avevo mai potuto
eseguire — passano realmente con `TestClient`, che `npx tsc --noEmit` termina con codice `0`, e che
`git diff --check` non rileva errori di formattazione.

Ruben segnala correttamente un limite di copertura che confermo: i tre nuovi test end-to-end verificano
il percorso per-fonte (mappatura Excel, profilo TXT, mirroring, reset alla sostituzione) ma non
aggiungono un'asserzione dedicata su `pagina_rilevata` per i rami legacy a livello di pratica (i due rami
"nessuna fonte esistente" in `apply_profilo`, `create_and_apply_profilo`, `put_mappatura`) — rami che
restano comunque coperti indirettamente dal resto della suite senza regressioni, ma che non hanno un test
mirato sul nuovo campo. Non bloccante: quei rami sono praticamente irraggiungibili dal flusso applicativo
reale (l'upload, anche a file singolo, crea sempre una `FonteJet` oggi), mantenuti per compatibilità con
dati pre-esistenti.

## Esito

**Il codice e i test sono coerenti con la specifica discussa e la suite passa per intero, verificata da
Ruben in ambiente pulito.** Non lo dichiaro "approvato" nel senso pieno usato per i prompt 40-43, perché
qui manca la revisione indipendente di un secondo soggetto sull'implementazione stessa (io ho scritto sia
il codice sia questa nota). Dato che si tratta della prima modifica al modello centrale del motore da
Fase 5, suggerisco — non bloccante, a discrezione di Ruben — un passaggio leggero di lettura da parte di
Codex o Cursor in un momento successivo, prima di considerare definitivamente chiuso questo punto della
tabella dei 15 controlli. Il commit resta a Ruben, come da regola del progetto.
