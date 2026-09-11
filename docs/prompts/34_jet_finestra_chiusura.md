# Prompt — JET: finestra di chiusura (JET-07B) (Giorno 7/15) (Quadra — modulo JET)

## Contesto

Nuovo controllo, oggi completamente assente. Due segnali distinti, entrambi calcolati per riga ma
**strutturalmente esclusi dal punteggio** (liste obbligatorie separate, non subordinate alla soglia di
approfondimento, come da specifica): (1) la data effettiva della scrittura cade negli ultimi N giorni
lavorativi prima della data di chiusura del periodo; (2) la scrittura è stata creata dopo la data di
chiusura ma con competenza (data effettiva) nel periodo già chiuso. Stesso pattern già usato per
`flag_forward_dating` al Giorno 6: nessun peso configurabile, nessun contributo al punteggio, mai.

Verificato sul codice reale (commit `c307106`, non su una struttura presunta): il form è quello piatto
in `ui/src/jet/JetDashboard.tsx` — un oggetto `EMPTY`, l'array `OPTIONAL_NUMBERS` per i numeri opzionali,
blocchi `<Field>` espliciti per i singoli campi non numerici (vedi `orario_ufficio_inizio`/`fine`, il
`<select>` Paese). Non esiste alcun `ParamsPanel.tsx` in questo branch.

## Definizioni — leggile con attenzione

- **`flag_finestra_chiusura`**: `True` quando `riga.data_effettiva` cade negli ultimi
  `finestra_chiusura_giorni_lavorativi` giorni lavorativi fino alla (e inclusa la) `data_chiusura`,
  secondo il calendario del Paese della pratica. Se `riga.data_effettiva` è successiva a
  `data_chiusura` (scrittura del periodo successivo), il flag è `False`, non `None` — è calcolabile,
  semplicemente fuori dalla finestra.
- **`flag_creata_dopo_chiusura`**: `True` quando `riga.data_creazione > data_chiusura` **e**
  `riga.data_effettiva <= data_chiusura` (competenza nel periodo chiuso, ma registrata dopo). È un
  confronto di date puro, **non richiede il calendario del Paese** — resta calcolabile anche senza
  Paese impostato, a differenza dell'altro flag.
- **Perché `flag_finestra_chiusura` richiede il Paese, senza eccezioni**: a differenza della
  retrodatazione del Giorno 6, qui non esiste una versione precedente "a giorni di calendario" a cui
  ricadere — è un controllo nuovo. Introdurre un fallback inventato a giorni di calendario
  significherebbe inventare un comportamento non specificato. Decisione: se il Paese non è impostato,
  o se il calendario festività non è disponibile per gli anni coinvolti (stesso caso limite del Giorno
  6 — Israele, o anni fuori 2024-2030), il flag resta `None`, non calcolabile. Non introdurre alcun
  fallback diverso da questo.
- **Soglia e data non impostate**: se `data_chiusura` è `None`, entrambi i flag sono `None`. Se
  `finestra_chiusura_giorni_lavorativi` è `None` ma `data_chiusura` è impostata, `flag_finestra_chiusura`
  è `None` (manca la soglia) ma `flag_creata_dopo_chiusura` resta comunque calcolabile — non dipende da
  quella soglia.

## Cosa implementare

**1. `backend/jet/models.py`**

In `ParametriClienteJet`, aggiungi due campi (nessun default nascosto, coerente con gli altri):

```python
data_chiusura: date | None = None
finestra_chiusura_giorni_lavorativi: int | None = Field(default=None, ge=0)
```

In `EsitoRigaJet`, aggiungi accanto a `flag_forward_dating`/`metodo_calcolo_backdating`:

```python
flag_finestra_chiusura: bool | None = None
flag_creata_dopo_chiusura: bool | None = None
```

**2. `backend/jet/criteri.py`**, in `valuta_riga`. Dopo il blocco `festivita_periodo` del Giorno 6 (non
toccarlo), aggiungi il calcolo del calendario festività per il periodo `data_effettiva` → `data_chiusura`
(stesso pattern, chiave diversa):

```python
festivita_chiusura = None
if (
    parametri.paese is not None
    and parametri.data_chiusura is not None
    and riga.data_effettiva <= parametri.data_chiusura
):
    try:
        base_chiusura = calendari.festivita(
            parametri.paese, riga.data_effettiva.year, parametri.data_chiusura.year
        )
    except ValueError:
        base_chiusura = None
    if base_chiusura or parametri.festivita:
        festivita_chiusura = sorted(set(base_chiusura or []) | set(parametri.festivita or []))
```

Poi il calcolo dei due flag (in un punto qualsiasi dopo questo blocco, ad esempio subito dopo il blocco
`flag_backdated`/`flag_forward_dating` del Giorno 6):

```python
if (
    parametri.data_chiusura is None
    or parametri.finestra_chiusura_giorni_lavorativi is None
    or parametri.paese is None
):
    flag_finestra_chiusura = None
elif riga.data_effettiva > parametri.data_chiusura:
    flag_finestra_chiusura = False
elif festivita_chiusura is None:
    flag_finestra_chiusura = None
else:
    scarto_chiusura = calendari.giorni_lavorativi_tra(
        riga.data_effettiva, parametri.data_chiusura, weekend_effettivo, festivita_chiusura
    )
    flag_finestra_chiusura = scarto_chiusura < parametri.finestra_chiusura_giorni_lavorativi

if riga.data_creazione is None or parametri.data_chiusura is None:
    flag_creata_dopo_chiusura = None
else:
    flag_creata_dopo_chiusura = (
        riga.data_creazione > parametri.data_chiusura
        and riga.data_effettiva <= parametri.data_chiusura
    )
```

`weekend_effettivo` è lo stesso valore già calcolato per gli altri criteri (Giorno 5/6), non ricalcolarlo.
Passa entrambi i nuovi flag nel costruttore di `EsitoRigaJet`. **Non aggiungerli alla tupla
`flag_e_pesi`**, non introdurre alcun campo `punteggio_finestra_chiusura` o
`punteggio_creata_dopo_chiusura`: sono strutturalmente esclusi dal punteggio, esattamente come
`flag_forward_dating`.

**3. `ui/src/jet/api.ts`**: in `JetParams`, aggiungi

```typescript
data_chiusura: string | null;
finestra_chiusura_giorni_lavorativi: number | null;
```

**4. `ui/src/jet/JetDashboard.tsx`**

- Nell'oggetto `EMPTY`: aggiungi `data_chiusura: null,` e `finestra_chiusura_giorni_lavorativi: null,`.
- Nell'array `OPTIONAL_NUMBERS`: aggiungi
  `["finestra_chiusura_giorni_lavorativi", "Finestra di chiusura (giorni lavorativi)"],`.
- Un nuovo `<Field label="Data di chiusura">` con `<input type="date">`, nello stesso stile esplicito
  del blocco `orario_ufficio_inizio`/`orario_ufficio_fine` esistente (posizionalo vicino a quei campi o
  al `<select>` Paese, sono concettualmente collegati).
- In `choose(p: JetPractice)`: quando la pratica non ha ancora parametri salvati (`p.parametri` è
  `null`/assente), precompila `data_chiusura` al 31 dicembre dell'anno ricavato da `p.period` (se
  contiene un anno a 4 cifre riconoscibile, regex `/\b(20\d{2})\b/`), altrimenti l'anno corrente. È un
  valore precompilato nell'interfaccia, non un default nascosto nel motore — resta sempre modificabile
  e il campo nel modello resta `None` di suo:

```typescript
const choose = async (p: JetPractice) => {
  setActive(p);
  const annoPeriodo = p.period.match(/\b(20\d{2})\b/)?.[1];
  setParams(
    p.parametri || {
      ...EMPTY,
      data_chiusura: `${annoPeriodo || new Date().getFullYear()}-12-31`,
    },
  );
  ...
```

  Adatta l'inserimento al codice esistente di `choose` senza toccare il resto della funzione (il calcolo
  di `sogliaCifraTondaCustom` e `reloadSources` restano dove sono, dopo `setParams`).
- In `FLAG_NAMES`: aggiungi `flag_finestra_chiusura: "Finestra di chiusura"` e
  `flag_creata_dopo_chiusura: "Creata dopo chiusura"`.

## Cosa NON fare

- Non introdurre alcun fallback "a giorni di calendario" per `flag_finestra_chiusura` quando il Paese
  non è impostato: resta `None`, per la ragione spiegata sopra. Non è un'omissione, è la specifica.
- Non aggiungere pesi/campi punteggio per questi due flag, né includerli nella tupla `flag_e_pesi`.
- Non toccare la logica di retrodatazione/forward dating del Giorno 6, né `weekend_effettivo`/
  `festivita_effettiva`/`festivita_periodo`: restano esattamente come sono.
- Non implementare l'export o una vista dedicata alle "due liste separate": in questo prompt le due
  liste sono i due flag nel risultato per riga, filtrabili come gli altri flag esistenti nella tabella
  risultati. Una vista/export dedicato è materia del Giorno 14.
- Non precompilare `data_chiusura` da nessuna parte nel backend/modello: il default 31/12 è solo
  interfaccia, al momento dell'apertura di una pratica senza parametri salvati.

## Test richiesti

In `tests/test_jet_criteri.py`:

- riga con `data_effettiva` esattamente sulla `data_chiusura`, Paese e finestra impostati (es. finestra
  5) → `flag_finestra_chiusura is True` (scarto 0, sempre dentro la finestra).
- riga al limite esatto della finestra (scarto lavorativo == finestra - 1) → `True`; una riga un giorno
  lavorativo oltre (scarto == finestra) → `False` (verifica il confine, non solo un caso interno).
- riga con `data_effettiva` successiva a `data_chiusura` → `flag_finestra_chiusura is False` (non
  `None`).
- `flag_creata_dopo_chiusura is True` per una scrittura con `data_creazione` dopo la chiusura e
  `data_effettiva` prima/sulla chiusura; `False` per una creata prima della chiusura.
- `data_chiusura` assente → entrambi i flag `None`.
- `finestra_chiusura_giorni_lavorativi` assente ma `data_chiusura` presente → `flag_finestra_chiusura
  is None` ma `flag_creata_dopo_chiusura` comunque calcolabile (dimostra l'indipendenza dei due flag
  dalla stessa soglia).
- Paese non impostato → `flag_finestra_chiusura is None` (nessun fallback), `flag_creata_dopo_chiusura`
  comunque calcolabile.
- Paese `"IL"` (dataset vuoto) senza festività manuali → `flag_finestra_chiusura is None`.
- entrambi i flag non contribuiscono mai al punteggio: un test con pesi alti su tutti gli altri criteri
  disattivati e questi due flag `True` deve dare `punteggio_totale == 0`.

Rilancia l'intera suite in un checkout pulito (`git archive`, venv nuovo, sole dipendenze minime, niente
`paddleocr`): `python -m pytest tests/ -q`, mai `pytest` nudo. Incolla l'output letterale per intero.

## Consegna

Branch nuovo dalla punta di `codex/jet-retrodatazione-giorni-lavorativi` (commit `c307106`) — se nel
frattempo Ruben ha allineato `jet/sprint-15-controlli` a quella stessa punta, usa quel branch come base
invece, indicalo esplicitamente nel riepilogo. Commit locali, niente push né PR. Nel riepilogo: file
toccati, conferma di ciascun caso limite sopra elencato, ed esito reale della suite in ambiente pulito
con l'output incollato per intero.
