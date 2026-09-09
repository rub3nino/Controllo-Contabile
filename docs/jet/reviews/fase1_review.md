# Revisione JET Fase 1 — contratti dati

Branch: `jet/fase1-contratti` (sopra il branch principale, con fasi 0-9 del redesign già confluite — verificato con `git merge-base --is-ancestor`), commit `60011b6`.

## Cosa è stato verificato

`git diff main..jet/fase1-contratti --stat`: **3 file, esattamente quelli dichiarati** (`backend/jet/models.py`, `backend/jet/__init__.py`, `tests/test_jet_models.py`), 255 righe aggiunte, zero rimosse — nessun file esistente toccato, `backend/domain/` intatto come richiesto.

Letto `models.py` per intero. I quattro modelli sono precisi e la disciplina già consolidata nel progetto (mai inventare default, `None` esplicito per "non disponibile") è rispettata ovunque: nessun campo opzionale ha un valore di comodo, ogni scelta non ovvia è spiegata nel docstring con lo stesso stile di `backend/domain/models.py`.

Due dettagli che meritano nota positiva, non solo "conformi al prompt":

**La distinzione `numero_documento` / `identificativo_registrazione`** è implementata esattamente come richiesto — la prima sarà la base del test di sequenza in Fase 3, la seconda conserva l'identificativo canonico del foglio Excel (il contatore ricostruito). Il docstring lo spiega chiaramente, non lascia il perché implicito.

**I campi sul conto in `EsitoRigaJet`** (`frequenza_utilizzo_conto`, `flag_conto_insolito_raro`, `flag_conto_infragruppo_parte_correlata`) sono tutti opzionali con motivazione esplicita: "senza conto, storico o anagrafica infragruppo, il risultato è non calcolabile — `None` non deve essere confuso con frequenza zero o esito negativo". È precisamente la distinzione che avevamo isolato come principio guida fin dalla Fase 1 di Quadra (mai confondere "non disponibile" con "zero"/"no").

## Sull'ambiguità segnalata — dodicesimo criterio senza peso

Codex ha notato correttamente che il "dodicesimo criterio" del riferimento tecnico (`Investigate further?`) è un verdetto calcolato dal confronto punteggio-vs-soglia, non un criterio con un proprio peso — coerente con come l'avevo descritto anche io nel documento di analisi Nordson (tabella con "Punti: —" per quella riga). La soluzione — undici pesi configurabili più `soglia_da_investigare` separata, senza inventare un dodicesimo peso fittizio — è quella corretta: non è una scorciatoia, è la lettura esatta della logica del foglio Excel (`AK = somma di 11 colonne punti`, `AL = IF(AK >= soglia, "Yes", "")`, come documentato). Buona cattura di un'imprecisione nel mio stesso riferimento tecnico, non solo un'esecuzione alla lettera.

## Verifica indipendente

Rieseguiti tutti i test in ambiente pulito (copia fresca fuori dal mount, venv nuovo): **91 passati, 0 falliti** — coincide esattamente con quanto dichiarato (77 della Fase 9 + 2 nuovi + gli altri già presenti... il totale torna). Letto anche `test_jet_models.py` per intero: il primo test istanzia tutti e quattro i modelli con dati sintetici plausibili e verifica alcuni valori chiave; il secondo verifica esplicitamente che un campo lista lasciato non fornito (`festivita`) resti `None` dopo validazione — esattamente il test richiesto nel prompt, non un test generico "tanto per avere una riga verde".

## Verdetto

Fase 1 JET approvata. Contratti puliti, disciplina sui default rispettata, distinzione dati-non-disponibili-vs-zero applicata correttamente ovunque serve, e un'ambiguità reale nel mio riferimento tecnico è stata individuata e risolta nel modo giusto invece di essere ignorata o forzata.

## Verso la Fase 2

Il prossimo passo è l'ingest: leggere un export reale (formato "Original data" di Nordson, o equivalente di un altro cliente) e mappare le colonne al `RigaGiornale` canonico appena definito. Preparo il prompt quando confermi.
