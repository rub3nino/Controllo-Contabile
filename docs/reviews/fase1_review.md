# Revisione Fase 1 — evidence store + motore di verifica

Branch: `redesign/fase1-motore-verifica` (sopra `redesign/fase0-contratti-dati`), commit `3fbaa48`. Revisione indipendente, come per la Fase 0.

## Cosa è stato verificato

`git diff redesign/fase0-contratti-dati..redesign/fase1-motore-verifica --stat`: 12 file, tutti dentro `backend/domain/`, `tests/` o `requirements-dev.txt`. Confermato con un secondo diff ristretto a "tutto tranne quei percorsi": zero risultati — nessun file esistente toccato, esattamente come dichiarato.

Letto per intero il codice nuovo (`store.py`, `ingest_adapter.py`, `verification_engine.py`, `continuity.py`, il diff su `models.py`): coerente con quanto riportato, niente sorprese rispetto al riepilogo. In particolare ho controllato a mano che il vincolo "le sezioni A/D/H/I non vanno mai a ✓ da sole" sia davvero applicato nel codice (non solo nel test) — lo è, riga per riga in `evaluate_section`.

Rieseguiti tutti i test in un ambiente indipendente da quello di Claude Code: **33/33 passati** (8 di Fase 0 + 25 nuovi). Ho anche letto il test end-to-end su `fixtures/docs` (non solo il risultato): usa i 7 file reali della cartella demo, dichiara la "verità di terra" nel docstring (quali 6 voci su 25 vengono trovate) verificata a mano prima di scrivere le assert, e controlla `missing_items` sezione per sezione — non è un test superficiale.

Ho anche fatto girare l'intera suite `tests/` del progetto (non solo i test di dominio): 44 passati, 2 falliti. I due fallimenti (`test_fill.py::test_scan_and_fill`, `test_ocr.py::test_ocr_engine_and_image`) sono un problema di questo ambiente di verifica (file che esistono ma non vengono letti — probabile limite del bridge verso la tua cartella locale, non del codice) — li ho riprodotti identici anche su `main`, quindi **preesistenti, non causati da questa fase**. Non richiedono azione da parte di Claude Code.

## Verdetto

Fase 1 approvata. Il lavoro rispetta i contratti di Fase 0 senza riaprirli silenziosamente, include entrambi i fix di revisione richiesti (validator su `status`, `requirements-dev.txt`), e la scelta tecnica (SQLite via `sqlite3` invece di un ORM) è motivata e proporzionata al problema reale ("nessun join relazionale da esprimere").

## Il punto di decisione che Claude Code segnala

"Controllo saltato per scelta umana" (il ramo `✗` del motore) non è raggiungibile: i contratti di Fase 0 non hanno un posto dove registrare "un umano ha deciso di non fare questo controllo questo trimestre", distinto da "N/A per il cliente" (che già esiste via `ClientConfig.applicable_items`). Concordo che sia un vuoto reale, non solo teorico: senza questo, il sistema oggi può produrre solo `wip`/`✓`, mai `✗` — e il caso reale più semplice del template Ferrero (Foglio D, test su rilevazioni contabili, marcato `✗` con nota "si è deciso di non effettuare questa analisi") non sarebbe rappresentabile.

La soluzione più naturale, guardando cosa esiste già nel backend attuale: `backend/models.py:PraticaIn` ha già `skip_items`/`na_items` — è esattamente la stessa decisione ("questo item è saltato per scelta", diverso da "manca") che oggi vive come override manuale nell'`Engine` (`pipeline.py:patch_item`). Nel nuovo modello questo diventerebbe un piccolo oggetto nuovo (es. `HumanOverride`: `item_id`, `decision` ✗|N/A, nota, chi e quando) salvato nello store e consultato da `evaluate_section` prima di calcolare found/missing — non tocca `Evidence` (che resta "cosa dice un documento", non "cosa ha deciso un umano") né `ClientConfig` (che resta "cosa vale per questo cliente in generale", non "cosa si è deciso questo trimestre").

Non ho fatto implementare questo ora: è una modifica ai contratti di Fase 0, e per lo stesso principio con cui ho chiesto a Claude Code di non farla di nascosto in mezzo alla Fase 1, non la aggiungo di mia iniziativa come supervisore. Te la giro come decisione: se sei d'accordo con la direzione (`HumanOverride` separato da `Evidence`/`ClientConfig`), la includo come primo punto del prossimo prompt.

## Nota su Fase 2 (Codex, in parallelo)

Questo gap non blocca l'avvio della Fase 2 (ingestion pluggable, lavoro Codex): riguarda il motore di verifica, non l'adapter di ingestion né la configurazione cliente. I due stream possono partire in parallelo come da piano.
