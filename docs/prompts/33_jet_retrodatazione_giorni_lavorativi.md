# Prompt — JET: retrodatazione in giorni lavorativi e forward dating separato (Giorno 6/15) (Quadra — modulo JET)

## Contesto

Oggi `flag_backdated` in `backend/jet/criteri.py` confronta la differenza `data_creazione -
data_effettiva` in giorni di calendario con `soglia_backdating_giorni`. Questo prompt sostituisce il
calcolo con uno basato su giorni lavorativi (weekend e festività del Paese della pratica, riusando
`backend/jet/calendari.py` del Giorno 4/5), e separa il caso "creata prima della data effettiva"
(forward dating) come motivo distinto, senza punteggio proprio.

Branch indipendente da quello del prompt 32 (selettore Paese in `ParamsPanel.tsx`): tocca file diversi,
può partire in parallelo dalla stessa punta.

## Definizioni — leggile con attenzione, sono la parte che deve essere esatta

- **Retrodatazione (`flag_backdated`)**: la scrittura è stata creata **dopo** la data effettiva, con
  uno scarto in giorni lavorativi maggiore o uguale alla soglia configurata.
- **Anticipo (`flag_forward_dating`)**: la scrittura è stata creata **prima** della data effettiva
  (`data_creazione < data_effettiva`). È strutturalmente un motivo informativo, non contribuisce mai al
  punteggio — non ha un peso configurabile, non aggiungere alcun campo `punteggio_forward_dating` da
  nessuna parte. Quando `flag_forward_dating` è `True`, `flag_backdated` è sempre `False` (i due sono
  mutuamente esclusivi per costruzione, non serve gestirli come indipendenti).
- **Stessa data** (`data_creazione == data_effettiva`): scarto zero, `flag_backdated=False`,
  `flag_forward_dating=False` (calcolabile, esito negativo — non "non calcolabile").
- **Metodo di calcolo**: se il Paese della pratica è impostato **e** il calendario festività per gli
  anni coinvolti è disponibile (stesso significato di "disponibile" del Giorno 5: non vuoto, oppure
  disponibile perché il revisore ha inserito festività manuali), lo scarto si conta in giorni
  lavorativi secondo quel calendario. Altrimenti — Paese non impostato, oppure Paese impostato ma
  dataset festività vuoto per gli anni coinvolti e nessuna festività manuale (es. Israele sempre, Spagna
  2027 in poi) — lo scarto ricade sui giorni di calendario, **per quella riga specifica**: due righe
  della stessa pratica possono usare metodi diversi se cadono in anni diversi con disponibilità diversa
  del dataset. Il metodo effettivamente usato va registrato nel risultato.

## Cosa implementare

**1. `backend/jet/calendari.py`** — nuova funzione, accanto a `festivita`/`giorni_weekend`:

```python
def giorni_lavorativi_tra(
    data_da: date, data_a: date, giorni_weekend: list[int], giorni_festivi: list[date]
) -> int:
    """Conta i giorni lavorativi nell'intervallo (data_da, data_a], esclusi weekend e festività.

    Intervallo aperto a sinistra e chiuso a destra: ``data_da`` non viene mai contato. Pensata
    per calcolare quanti giorni lavorativi sono trascorsi fra una data effettiva e una data di
    creazione successiva; richiede ``data_a >= data_da``.
    """
    if data_a < data_da:
        raise ValueError("data_a non può precedere data_da")
    festivi = set(giorni_festivi)
    weekend = set(giorni_weekend)
    conteggio = 0
    giorno = data_da + timedelta(days=1)
    while giorno <= data_a:
        if giorno.weekday() not in weekend and giorno not in festivi:
            conteggio += 1
        giorno += timedelta(days=1)
    return conteggio
```

Aggiungi `timedelta` all'import da `datetime` (oggi il file importa solo `date`) e aggiungi
`giorni_lavorativi_tra` a `__all__`. Non cambiare nient'altro nel file: dataset, `festivita`,
`giorni_weekend` restano invariati.

**2. `backend/jet/models.py`**, in `EsitoRigaJet`, aggiungi due campi accanto a `flag_backdated`:

```python
flag_forward_dating: bool | None = None
metodo_calcolo_backdating: str | None = None
```

`metodo_calcolo_backdating` vale `"giorni_lavorativi"`, `"giorni_calendario"`, oppure `None` quando
nessuno dei due flag è calcolabile. Non serve un `Literal` con validazione stretta, una stringa libera
è coerente con `EsitoSequenzaJet` esistente.

**3. `backend/jet/criteri.py`**, in `valuta_riga`. Dopo il blocco esistente che calcola
`weekend_effettivo`/`festivita_effettiva` (Giorno 5, non toccarlo), aggiungi il calcolo del calendario
festività **per il periodo effettivo-creazione** (che può coprire più di un anno, a differenza di
`festivita_effettiva` che è per il solo anno di `data_effettiva`):

```python
festivita_periodo = None
if (
    parametri.paese is not None
    and riga.data_creazione is not None
    and riga.data_creazione > riga.data_effettiva
):
    try:
        base_periodo = calendari.festivita(
            parametri.paese, riga.data_effettiva.year, riga.data_creazione.year
        )
    except ValueError:
        # Il dataset copre solo 2024-2030 (scelta di scope della Fase calendari): una
        # scrittura con date fuori da questo intervallo non deve far crashare l'intera
        # valutazione, ricade sui giorni di calendario come un Paese senza dati.
        base_periodo = None
    if base_periodo or parametri.festivita:
        festivita_periodo = sorted(set(base_periodo or []) | set(parametri.festivita or []))
```

Poi sostituisci per intero il blocco esistente di `flag_backdated` con:

```python
if riga.data_creazione is None or parametri.soglia_backdating_giorni is None:
    flag_backdated = None
    flag_forward_dating = None
    metodo_calcolo_backdating = None
elif riga.data_creazione < riga.data_effettiva:
    flag_backdated = False
    flag_forward_dating = True
    metodo_calcolo_backdating = None
else:
    if festivita_periodo is not None:
        scarto = calendari.giorni_lavorativi_tra(
            riga.data_effettiva, riga.data_creazione, weekend_effettivo, festivita_periodo
        )
        metodo_calcolo_backdating = "giorni_lavorativi"
    else:
        scarto = (riga.data_creazione - riga.data_effettiva).days
        metodo_calcolo_backdating = "giorni_calendario"
    flag_backdated = scarto >= parametri.soglia_backdating_giorni
    flag_forward_dating = False
```

Nota: `weekend_effettivo` qui è deliberatamente lo stesso valore già calcolato per il criterio
weekend/festività (rispetta l'eventuale override manuale dell'utente), non un nuovo calcolo dal solo
calendario nazionale — se il Paese è impostato, `weekend_effettivo` non è mai `None` in questo ramo.

Passa `flag_forward_dating` e `metodo_calcolo_backdating` nel costruttore di `EsitoRigaJet` alla fine
della funzione. **Non aggiungere `flag_forward_dating` alla tupla `flag_e_pesi`** (il ciclo che somma
il punteggio): deve restare fuori dal calcolo del punteggio esattamente come `flag_descrizione_vuota`
resta dentro invece — non è un'esclusione per distrazione, è la specifica di questo prompt.

**4. `ui/src/jet/JetDashboard.tsx`**: aggiungi `flag_forward_dating: "Anticipata"` a `FLAG_NAMES`, nello
stesso stile delle altre voci, così il nuovo flag compare nella tabella dei risultati insieme agli
altri. Non aggiungere `metodo_calcolo_backdating` da nessuna parte nell'interfaccia in questo prompt:
resta un dettaglio backend per ora, entrerà nell'export dettagliato del Giorno 14.

**5. `ui/src/jet/JetDashboard.tsx`**: un solo cambio di testo, nessuna logica nuova. Nell'array
`OPTIONAL_NUMBERS`, la voce `["soglia_backdating_giorni", "Soglia retrodatazione (giorni)"]` va
aggiornata in `["soglia_backdating_giorni", "Soglia retrodatazione (giorni lavorativi)"]` — solo
l'etichetta, la chiave e il tipo di input restano identici. Non esiste nel codice reale (verificato sul
commit `95df9ee`) alcun `ParamsPanel.tsx` né un sistema di hint per-controllo: quella struttura non fa
parte di questo repository, non cercarla e non crearla.

## Cosa NON fare

- Non toccare `ParametriClienteJet`: nessun nuovo parametro, `soglia_backdating_giorni` esiste già e
  resta l'unico campo di soglia per questo controllo.
- Non introdurre alcun peso/campo per `flag_forward_dating`: è strutturalmente peso zero, non
  configurabile, non entra nella somma del punteggio.
- Non toccare il blocco `weekend_effettivo`/`festivita_effettiva` del Giorno 5, né i criteri weekend e
  festività: restano esattamente come sono.
- Non implementare la finestra di chiusura (data 31/12, ultimi 5 giorni lavorativi): è il Giorno 7, un
  prompt separato.
- Non toccare `ui/src/jet/api.ts`, `backend/jet/ingest*.py`, `backend/jet/sequenza.py`.
- Non ottimizzare `giorni_lavorativi_tra` con un algoritmo diverso dal ciclo giorno-per-giorno: per gli
  intervalli reali di questo controllo (tipicamente giorni o poche settimane, al massimo qualche mese)
  le prestazioni non sono un problema; non serve introdurre complessità aggiuntiva per un caso che non
  si presenta.

## Test richiesti

In `tests/test_jet_calendari.py`, per `giorni_lavorativi_tra`: scarto zero su stessa data; un caso che
attraversa un weekend senza festività (es. venerdì → lunedì successivo, atteso 1); un caso che
attraversa anche una festività nota del dataset (es. un intervallo che include il 25 dicembre italiano,
atteso uno scarto inferiore di 1 rispetto al caso senza festività); `ValueError` se `data_a < data_da`.

In `tests/test_jet_criteri.py`: caso retrodatazione calcolata in giorni lavorativi con Paese impostato
(costruisci un caso dove il conteggio a giorni di calendario e quello a giorni lavorativi darebbero
esiti diversi rispetto alla soglia, per dimostrare che il criterio usa davvero il secondo, non il
primo); caso forward dating (`data_creazione < data_effettiva`) con verifica che `flag_forward_dating
is True`, `flag_backdated is False`, e che `punteggio_totale` non include alcun contributo per questo
flag anche impostando pesi alti su tutti gli altri criteri disattivati; caso stessa data
(`flag_backdated is False`, `flag_forward_dating is False`); caso senza Paese impostato
(`metodo_calcolo_backdating == "giorni_calendario"`, comportamento numerico identico a quello di prima
di questo prompt); caso con Paese `"IL"` impostato e nessuna festività manuale, che deve ricadere su
`"giorni_calendario"` anche se il Paese è impostato (dataset vuoto); caso che attraversa il cambio
d'anno (es. `data_effettiva` a fine dicembre, `data_creazione` a gennaio dell'anno dopo, Paese con
dataset completo su entrambi gli anni) per verificare che `festivita_periodo` copra correttamente
entrambi gli anni; caso `data_creazione`/`soglia_backdating_giorni` assenti → entrambi i flag `None`,
metodo `None` (comportamento invariato).

Rilancia l'intera suite in un checkout pulito (`git archive`, venv nuovo con le sole dipendenze minime
elencate nella disciplina del progetto — **non installare `paddleocr`**): `python -m pytest tests/ -q`,
mai `pytest` nudo. Incolla l'output letterale, per intero.

## Consegna

Branch nuovo dalla punta di `codex/jet-calendari-integrazione` (commit `95df9ee`). Commit locali, niente
push né PR. Nel riepilogo: file toccati, conferma esplicita di ciascun caso limite sopra elencato
(metodo usato per riga, mutua esclusione backdated/forward, forward dating escluso dal punteggio,
fallback su Israele/anni fuori 2024-2030 senza crash), ed esito reale della suite in ambiente pulito con
l'output incollato per intero (non solo il conteggio finale).
