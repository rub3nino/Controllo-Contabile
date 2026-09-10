# Prompt — JET: correzione dei pesi degli indicatori forti standard (Quadra — modulo JET)

## Contesto

Stiamo allineando i 15 controlli JET allo standard ufficiale Baker Tilly/Global Focus (tabella
pesi del "JET Template", pagina 12 del manuale Global Focus Audit Methodology). Lo standard
distingue indicatori deboli (peso 1) da indicatori forti (peso 4). Quattro dei controlli già
esistenti in Quadra sono oggi trattati come indicatori deboli mentre lo standard li classifica
forti: festività, retrodatazione, staff non autorizzato, descrizione vuota.

Il motore di calcolo (`backend/jet/criteri.py`, `backend/jet/models.py`) non ha alcun default
nascosto nel codice — ogni peso è un valore che arriva da `ParametriClienteJet`, impostato
dall'utente per la pratica. L'unico posto dove questi quattro pesi hanno un valore di partenza è
l'oggetto `EMPTY` in `ui/src/jet/JetDashboard.tsx`: è il form che si precompila quando si apre una
nuova pratica JET, e oggi precompila tutti i pesi a 1.

Questo prompt cambia solo quel valore di partenza, in un solo file. Non è un cambio di logica.

## Cosa correggere

In `ui/src/jet/JetDashboard.tsx`, dentro l'oggetto `EMPTY: JetParams` (le righe con i campi
`punteggio_*`), cambia il valore precompilato da `1` a `4` per questi quattro campi soltanto:

- `punteggio_festivita`
- `punteggio_backdated`
- `punteggio_staff_non_autorizzato`
- `punteggio_descrizione_vuota`

Tutti gli altri campi di `EMPTY` restano invariati, inclusi gli altri pesi che restano a 1
(`punteggio_profit_impact`, `punteggio_oltre_dieci_volte_media`,
`punteggio_sopra_performance_materiality`, `punteggio_importo_cifra_tonda`, `punteggio_weekend`,
`punteggio_fuori_orario`, `punteggio_parte_correlata`) e `soglia_da_investigare`, che è già `4` e
non va toccato.

Il campo resta comunque modificabile dall'utente in interfaccia come oggi: cambia solo cosa vede
la prima volta che apre una nuova pratica, non un vincolo nel backend.

## Cosa NON fare

- Non toccare `punteggio_conto_insolito_raro` né `soglia_frequenza_insolita`: restano `null` come
  oggi. Sono un'estensione non standard, non ancora approvata dal partner, e oggi non esiste un
  modo per disattivarla esplicitamente se la precompiliamo attiva — il toggle attivo/disattivato
  per i singoli test è un prompt futuro, non questo. Attivare per default un controllo non
  approvato, senza un modo per spegnerlo, sarebbe un errore: si rimanda.
- Non toccare nessun altro peso, nessuna soglia, nessun campo di `EMPTY` oltre ai quattro elencati.
- Non toccare `backend/jet/criteri.py`, `backend/jet/models.py`, `backend/jet/api.py`, né alcun
  altro file backend: il motore non ha default da cambiare, il valore vive solo nel form.
- Non toccare `ui/src/jet/api.ts` né altri file dell'interfaccia oltre a `JetDashboard.tsx`.
- Non modificare i test esistenti: `tests/test_jet_models.py`, `tests/test_jet_criteri.py`,
  `tests/test_jet_conti.py`, `tests/test_jet_pratica.py` impostano questi pesi esplicitamente per
  ogni caso (non dipendono da un valore di default), quindi non dovrebbero richiedere modifiche —
  se durante la verifica scopri che qualcuno di questi test si aspettava implicitamente `1` come
  default, segnalalo nel riepilogo invece di correggerlo silenziosamente.

## Test richiesti

Nessun test nuovo è necessario per un cambio di valore precompilato in un form. Rilancia comunque
l'intera suite Python in un checkout pulito (`git archive` dalla punta del branch, mai nella
cartella di lavoro live) per confermare che non ci sono regressioni: `python -m pytest tests/ -q`,
mai `pytest` nudo. Incolla l'output letterale nel riepilogo.

Se esiste una suite di test frontend che copre `JetDashboard.tsx` (controlla `ui/` per
`*.test.tsx` o simili prima di assumere che non ci sia), rilanciala e incolla l'esito; se non
esiste, dillo esplicitamente nel riepilogo invece di ometterlo.

## Consegna

Branch nuovo dalla punta di `main`. Commit locali, niente push né PR. Nel riepilogo conferma: i
quattro valori cambiati e il file esatto, che nessun altro campo di `EMPTY` è stato toccato, che
`punteggio_conto_insolito_raro`/`soglia_frequenza_insolita` sono rimasti `null`, e l'esito reale
della suite di test in ambiente pulito.
