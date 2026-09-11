# Revisione — Prompt 43 (nominativi da visura camerale nel criterio "parte correlata")

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit finale `eb4a344`, dopo un commit intermedio di sola
documentazione `1043b8f` (archiviazione prompt/revisioni), a sua volta successivo a `95c9f8b` (ultimo
commit di codice approvato, prompt 42). Verificato indipendentemente, non sul riepilogo fornito.

## Metodo

`device_bash` continua a non riuscire a raggiungere `.git` nella cartella collegata (riconfermato
all'inizio di questa verifica). Non potendo fare né `git diff` né l'object-walk sull'albero dei commit in
modo affidabile in questa occasione, ho verificato **scope e contenuto per confronto diretto**: prima di
consegnare il prompt avevo già staccato (`device_stage_files`) lo stato "prima" dei sei file dichiarati;
ho poi staccato lo stato attuale e fatto un `diff -u` completo dei due stati, riga per riga. In aggiunta,
ho controllato i timestamp di modifica (`device_list_dir`) di tutti i file in `backend/jet/`, `tests/` e
`ui/src/jet/`: solo i sei file dichiarati risultano nello stesso batch temporale della consegna, tutti gli
altri file di quelle cartelle hanno timestamp precedenti e non correlati. Metodo alternativo, dichiarato
esplicitamente come da disciplina di progetto.

## Scope

Confermato: esattamente i sei file dichiarati, nessuno in più — `backend/jet/models.py`,
`backend/jet/criteri.py`, `tests/test_jet_criteri.py`, `ui/src/jet/api.ts`, `ui/src/jet/ParamsPanel.tsx`,
`ui/src/jet/JetDashboard.tsx`. Nessun altro file in quelle cartelle ha un timestamp compatibile con la
consegna.

## Lettura del codice (diff riga per riga)

- `models.py`: aggiunto esattamente `nominativi_visura_camerale: list[str] | None = None`, subito dopo
  `parole_chiave_parti_correlate`, come richiesto. Nessun nuovo campo `attivo_*`/`punteggio_*`, nessuna
  modifica a `EsitoRigaJet`.
- `criteri.py`: il blocco `flag_parte_correlata` ora somma le due liste (`termini_parte_correlata = list(
  parole_chiave_parti_correlate or []) + list(nominativi_visura_camerale or [])`) e resta `None` solo
  quando **entrambe** sono `None` (`or` tra le due condizioni `is not None`), esattamente come richiesto.
  Il confronto resta case-insensitive per sottostringa (`casefold()`/`in`), invariato nella logica, solo
  esteso alla lista combinata. Nessun'altra riga del blocco toccata (`flag_descrizione_vuota` subito dopo
  resta invariato, usa la stessa variabile `descrizione` già presente prima).
- `tests/test_jet_criteri.py`: aggiunti esattamente i quattro test richiesti, tutti corretti nella logica:
  1. solo `nominativi_visura_camerale` configurato → `True` (conferma che la lista nominativi funziona da
     sola, non solo in combinazione);
  2. `parole_chiave_parti_correlate` e `nominativi_visura_camerale` configurati entrambi, match solo sul
     nominativo → `True` (conferma che le due liste si sommano davvero);
  3. entrambe le liste `None` → `None` (non calcolabile, esplicito);
  4. `parole_chiave_parti_correlate=None`, `nominativi_visura_camerale=[]` (lista vuota, non `None`) →
     calcolabile, `False` — conferma corretta che una lista vuota configurata esplicitamente non equivale
     a "non configurato". Questo è il caso più delicato della specifica ed è implementato correttamente.
  I test preesistenti su `flag_parte_correlata` (incluso quello parametrizzato su
  `parole_chiave_parti_correlate`/`flag_parte_correlata`) risultano non modificati nel diff, come previsto
  dalla specifica (la fixture `_parametri()` non imposta `nominativi_visura_camerale`, resta `None` di
  default, quindi il comportamento con la sola `parole_chiave_parti_correlate` non cambia).
- `ui/src/jet/api.ts`: campo aggiunto a `JetParams` nella posizione corretta, stesso stile.
- `ui/src/jet/JetDashboard.tsx`: `nominativi_visura_camerale: null` aggiunto a `EMPTY` nella posizione
  corretta.
- `ui/src/jet/ParamsPanel.tsx`:
  - `hint` del controllo id `"15"` aggiornato col testo esatto richiesto (non promette più un OCR
    inesistente, descrive correttamente la somma delle due liste sullo stesso peso).
  - Voce descrittiva `flag_parte_correlata` in `SCOPO_CONTROLLI`: `campi`, `regola`, `limitazioni`,
    `eccezione` aggiornati col testo esatto richiesto, inclusa la correzione dell'imprecisione
    preesistente ("corrispondenza esatta" → "sottostringa case-insensitive", che descrive il
    comportamento reale del codice).
  - Contatore badge per id `"15"`: esteso di iniziativa propria (non prescritto testualmente, ma coerente
    col punto 4 della specifica) per sommare `parole_chiave_parti_correlate?.length` e
    `nominativi_visura_camerale?.length` in un unico conteggio "N termini", mantenendo distinto il
    conteggio dei conti infragruppo — buona applicazione della specifica, non una deviazione.
  - Nuova `ListInput` per `nominativi_visura_camerale` aggiunta nella posizione corretta (subito dopo
    quella delle parole chiave, prima del blocco conti infragruppo), con l'etichetta esatta richiesta.
  - Blocco conti infragruppo (`conti_infragruppo_parte_correlata` e relativo checkbox/peso): confermato
    non toccato, resta un criterio separato invariato.
  - Paragrafo informativo in fondo al blocco aggiornato col testo esatto richiesto.

Nessuna deviazione dalla specifica, nessun file toccato oltre i sei dichiarati.

## Suite di test

```
215 passed, 7 warnings in 4.14s
```
Coerente con l'atteso: 211 (base dopo il prompt 42) + 4 nuovi test di questo prompt = 215.

**Non rieseguita da me in modo indipendente** in ambiente pulito, per lo stesso guasto di `device_bash`
su `.git` già dichiarato nelle revisioni precedenti — riserva aperta, invariata. La verifica di contenuto
sopra (diff completo riga per riga sui sei file, non solo lettura del riepilogo) resta comunque solida.

`npx tsc --noEmit`: uscita `0`, nessun errore (il riepilogo riporta un blocco di output vuoto, coerente
con un `tsc` pulito).

## Esito

**Approvato.** Nessuna richiesta di modifica al codice. Punto 15 della tabella dei 15 controlli chiuso
secondo la decisione di Ruben (nessun OCR, campo manuale che confluisce nello stesso peso delle keyword).
