# Prompt 43 — JET: nominativi da visura camerale nel criterio "parte correlata" (Quadra — modulo JET)

## Contesto

Punto 15 della tabella dei 15 controlli. Decisione di Ruben (11/09/2026): **nessun OCR** sulla visura
camerale — stesso profilo di rischio della Fase D già sospesa (formato non standardizzato, verifica
umana obbligatoria). Al posto dell'OCR: un **campo dedicato, separato dalle parole chiave esistenti**,
in cui l'utente inserisce manualmente i nominativi (soci, amministratori, titolari effettivi) letti
dalla visura camerale del cliente. Questi nominativi devono contribuire **allo stesso criterio e allo
stesso peso** già esistenti per "parte correlata" (`flag_parte_correlata` / `punteggio_parte_correlata`),
non a un sedicesimo controllo con un peso proprio.

Oggi (`backend/jet/criteri.py`) il criterio funziona così:
```python
descrizione = (riga.descrizione or "").strip()
flag_parte_correlata = (
    any(
        parola.strip().casefold() in descrizione.casefold()
        for parola in parametri.parole_chiave_parti_correlate
        if parola.strip()
    )
    if parametri.attivo_parte_correlata
    and parametri.parole_chiave_parti_correlate is not None
    else None
)
```
Va esteso in modo che i **nominativi da visura** si aggiungano alla stessa lista di termini cercati
nella descrizione, con lo stesso confronto case-insensitive già in uso (sottostringa, non uguaglianza
esatta — è il comportamento reale del codice attuale, anche se il testo descrittivo in `ParamsPanel.tsx`
lo chiama impropriamente "corrispondenza esatta": correggi anche quel testo, vedi sotto).

**Regola di non-calcolabilità** (disciplina del progetto: mai `False` quando manca un dato): il criterio
resta `None` **solo se nessuna delle due liste è configurata** (entrambe `None`). Se anche una sola delle
due è configurata (anche come lista vuota `[]`), il criterio è calcolabile — coerente con come si
comporta oggi `parole_chiave_parti_correlate` da sola.

## Passo 0 — obbligatorio, prima di toccare qualunque file

1. `git branch --show-current` — deve risultare `jet/sprint-15-controlli`.
2. `git log -1 --oneline` — alla mia ultima verifica il branch era a `95c9f8b`. Se è diverso non è
   necessariamente un problema, ma riporta l'hash esatto nel riepilogo.
3. `git status --short` — deve risultare vuoto. Se non lo è, **fermati e segnala cosa trovi, senza
   scartarlo né correggerlo di tua iniziativa**.

Se un controllo fallisce, non procedere: scrivi nel riepilogo cosa hai trovato e fermati lì.

## Cosa implementare

**`backend/jet/models.py`**

In `ParametriClienteJet`, subito dopo il campo `parole_chiave_parti_correlate` (stesso blocco, stesso
stile):
```python
nominativi_visura_camerale: list[str] | None = None
```
Non aggiungere nessun nuovo campo `attivo_*` né `punteggio_*`: questo campo riusa integralmente
`attivo_parte_correlata` e `punteggio_parte_correlata` già esistenti. Non toccare `EsitoRigaJet`: non
serve un nuovo flag, resta `flag_parte_correlata`.

**`backend/jet/criteri.py`**

Sostituisci il blocco di calcolo di `flag_parte_correlata` (quello riportato sopra nel Contesto) con:
```python
descrizione = (riga.descrizione or "").strip()
termini_parte_correlata = list(parametri.parole_chiave_parti_correlate or []) + list(
    parametri.nominativi_visura_camerale or []
)
flag_parte_correlata = (
    any(
        termine.strip().casefold() in descrizione.casefold()
        for termine in termini_parte_correlata
        if termine.strip()
    )
    if parametri.attivo_parte_correlata
    and (
        parametri.parole_chiave_parti_correlate is not None
        or parametri.nominativi_visura_camerale is not None
    )
    else None
)
```
Nessun'altra riga di questo blocco va toccata (in particolare `flag_descrizione_vuota`, che usa la
stessa variabile `descrizione`, resta invariato subito dopo).

**`tests/test_jet_criteri.py`**

I test esistenti per `flag_parte_correlata` (inclusi quelli parametrizzati che usano
`("flag_parte_correlata", {"descrizione": "Pagamento SOCIETÀ COLLEGATA"}, ...)` e
`("parole_chiave_parti_correlate", "flag_parte_correlata")` nel test
`test_parametro_non_configurato_resta_non_calcolabile`) restano validi così come sono — non hanno
bisogno di modifiche, perché la fixture `_parametri()` non imposta `nominativi_visura_camerale` (resta
`None` di default) e quindi il comportamento con la sola `parole_chiave_parti_correlate` non cambia.
Verifica comunque che continuino a passare invariati.

Aggiungi test nuovi e dedicati per la combinazione delle due liste, seguendo lo stile dei test esistenti
in questo file per questo criterio:
- solo `nominativi_visura_camerale` configurato (`parole_chiave_parti_correlate=None`), descrizione che
  contiene un nominativo della lista → `flag_parte_correlata` `True`;
- entrambe le liste configurate, la descrizione contiene un termine presente **solo** in
  `nominativi_visura_camerale` e non in `parole_chiave_parti_correlate` → `flag_parte_correlata` `True`
  (conferma che le due liste si sommano davvero, non che una sovrascrive l'altra);
- entrambe le liste `None` → `flag_parte_correlata` `None` (non calcolabile, esplicito, anche se già
  implicito nel test parametrizzato esistente);
- `parole_chiave_parti_correlate=None` ma `nominativi_visura_camerale=[]` (lista vuota, non `None`) →
  criterio calcolabile (non `None`), risultato `False` se la descrizione non contiene nulla — conferma
  che una lista vuota configurata esplicitamente non equivale a "non configurato".

## Frontend

**`ui/src/jet/api.ts`**: in `JetParams`, subito dopo `parole_chiave_parti_correlate: string[] | null;`:
```ts
nominativi_visura_camerale: string[] | null;
```

**`ui/src/jet/JetDashboard.tsx`**: in `EMPTY`, subito dopo `parole_chiave_parti_correlate: null,`:
```ts
nominativi_visura_camerale: null,
```

**`ui/src/jet/ParamsPanel.tsx`**

1. Nella voce `CONTROLS` con `id: "15"`, aggiorna il campo `hint` (oggi dice che l'OCR "non esiste" e
   "resta fuori punteggio" — non è più accurato, ora c'è un inserimento manuale che entra nel punteggio):
   ```
   "Le keyword in descrizione e i nominativi dalla visura camerale (inseriti manualmente) confluiscono nello stesso criterio «parte correlata» e nello stesso peso. Nessun OCR: i nominativi vanno inseriti a mano."
   ```
   Non toccare `title`, `status`, `baker`, `flagKeys`, `available`, `attivoKeys`, `pesi` di questa voce:
   restano invariati, il peso resta uno solo (`punteggio_parte_correlata`).

2. Nell'oggetto descrittivo `SCOPO_CONTROLLI` (o equivalente), voce `flag_parte_correlata`: aggiorna
   `campi`, `regola`, `limitazioni` per riflettere le due liste combinate. Testo esatto da usare:
   - `campi`: `"Descrizione/causale della riga; elenco di parole chiave configurate; elenco di nominativi da visura camerale inseriti manualmente."`
   - `regola`: `"La descrizione contiene, come sottostringa case-insensitive, una delle parole chiave o uno dei nominativi da visura camerale configurati."`
   - `limitazioni`: `"Non calcolabile solo se né l'elenco di parole chiave né l'elenco di nominativi da visura camerale sono configurati (entrambi assenti)."`
   - `eccezione`: `"La descrizione richiama esplicitamente una parola chiave o un nominativo da visura camerale configurato."`
   Questo corregge anche l'imprecisione già presente nel testo attuale ("corrispondenza esatta"), che
   non descriveva il comportamento reale (sottostringa, non uguaglianza) — non è un problema nuovo
   introdotto da questo prompt, ma visto che stai già riscrivendo `regola` per questo stesso criterio,
   usa il testo esatto sopra invece di preservare l'imprecisione.

3. Nel blocco di rendering dei campi per `id === "15"` (la funzione che oggi disegna la `ListInput`
   "Parole chiave parti correlate" e, sotto, quella per i conti infragruppo), aggiungi una seconda
   `ListInput` per il nuovo campo, subito dopo quella delle parole chiave e prima del blocco dei conti
   infragruppo:
   ```tsx
   <ListInput
     label="Nominativi da visura camerale (manuale, stesso peso delle keyword)"
     type="text"
     values={params.nominativi_visura_camerale}
     onChange={(v) =>
       setParams({
         ...params,
         nominativi_visura_camerale: v as string[] | null,
       })}
   />
   ```
   Aggiorna anche il paragrafo informativo in fondo al blocco (oggi:
   `"OCR della visura: assente, cella peso «—». Non è un quindicesimo peso."`) in:
   ```
   "Nominativi da visura camerale: inserimento manuale, nessun OCR. Confluiscono nel peso «Keyword» sopra, non è un peso separato."
   ```
   Non toccare il blocco dei conti infragruppo (`conti_infragruppo_parte_correlata` e relativo
   checkbox/peso): resta un criterio separato con il proprio peso opzionale, invariato.

4. Se esiste un contatore riepilogativo per la voce id `"15"` che conta quanti termini sono configurati
   (cerca un riferimento a `parole_chiave_parti_correlate?.length` nel file, usato per un badge o un
   conteggio sintetico), aggiorna la stessa logica per includere anche
   `nominativi_visura_camerale?.length` nel conteggio totale dei termini configurati per il criterio
   "parte correlata" (mantieni distinto, se già distinto, il conteggio dei conti infragruppo — quello
   resta un criterio separato).

## Cosa NON fare

- Non aggiungere nessun nuovo campo `attivo_*` o `punteggio_*`: il criterio resta uno solo, con un peso
  solo (`punteggio_parte_correlata`), attivabile con l'unico interruttore esistente
  (`attivo_parte_correlata`).
- Non toccare `flag_conto_infragruppo_parte_correlata` né i campi
  `conti_infragruppo_parte_correlata`/`attivo_conto_infragruppo_parte_correlata`/
  `punteggio_conto_infragruppo_parte_correlata`: è un criterio distinto, fuori scope.
- Non implementare nessuna forma di OCR o estrazione automatica dalla visura: il campo è puramente
  testuale a inserimento manuale, stesso meccanismo di `ListInput` già in uso per le parole chiave.
- Non toccare `sequenza.py`, `calendari.py`, `ingest*.py`, `store.py`, `pratica.py`, `fonti.py`,
  `tests/test_jet_conti.py`, `tests/test_jet_models.py`.
- **Non toccare, scartare o committare alcun file che non sia uno di quelli elencati sotto.** Se trovi
  modifiche non committate estranee a questo prompt nella cartella condivisa, fermati e segnalale, non
  deciderle tu.

## Verifica richiesta prima della consegna

Suite completa in ambiente pulito (`git archive`, non la cartella di lavoro live), dipendenze minime
della disciplina di progetto:
```
python -m pytest tests/ -q
```
Incolla l'output letterale. Poi, se possibile nel tuo ambiente, `npx tsc --noEmit` dalla cartella `ui/`
in ambiente pulito — incolla l'output letterale anche se pulito.

## Consegna

Commit diretto su `jet/sprint-15-controlli`. Nessun push né PR. Committa esclusivamente:
`backend/jet/models.py`, `backend/jet/criteri.py`, `tests/test_jet_criteri.py`, `ui/src/jet/api.ts`,
`ui/src/jet/ParamsPanel.tsx`, `ui/src/jet/JetDashboard.tsx` — nessun altro file. Nel riepilogo: branch e
commit di partenza effettivi, conferma che il diff riguarda solo questi sei file, output letterale della
suite di test, e conferma esplicita che i test esistenti su `flag_parte_correlata` sono rimasti invariati
e continuano a passare.
