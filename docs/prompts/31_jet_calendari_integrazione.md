# Prompt — JET: integrazione calendari nazionali nei controlli weekend/festività (Giorno 5/15) (Quadra — modulo JET)

## Contesto

Il Giorno 4 (branch precedente) ha costruito `backend/jet/calendari.py` con
`CODICI_PAESE`, `WEEKEND_PER_PAESE`, `FESTIVITA_PER_PAESE` e le funzioni `festivita(codice_paese,
anno_da, anno_a)` e `giorni_weekend(codice_paese)`, senza collegarlo a nessun controllo. Questo
prompt fa l'integrazione: il cliente sceglie un Paese, weekend e festività vengono derivati
automaticamente dal calendario di quel Paese, con la possibilità di aggiungere chiusure specifiche
del cliente sopra al calendario nazionale.

**Nota se il Giorno 4 ha consegnato un dataset parzialmente compilato** (alcuni Paesi/anni con solo
le festività fisse, come previsto in quel prompt): va bene lo stesso, questo prompt collega la
logica indipendentemente da quanto dataset è già completo — un Paese con poche festività compilate
segnalerà correttamente solo quelle, non è un errore di questo prompt. Nel riepilogo, richiama
comunque quali Paesi restano da completare secondo il riepilogo del Giorno 4, così resta visibile.

## Cosa implementare

**1. `backend/jet/models.py`**, in `ParametriClienteJet`, aggiungi:

```python
paese: str | None = None
```

Con un validatore che, se `paese` non è `None`, verifichi che sia uno dei codici in
`calendari.CODICI_PAESE` — altrimenti errore di validazione esplicito (mai un Paese sbagliato
accettato silenziosamente).

I campi esistenti `giorni_weekend` e `festivita` restano, ma cambiano semantica:

- `giorni_weekend`: se impostato esplicitamente dall'utente, **sostituisce del tutto** il weekend
  derivato dal Paese (override completo — non ha senso "unire" due insiemi di giorni settimanali).
  Se `None` e `paese` è impostato, si deriva da `calendari.giorni_weekend(paese)`. Se entrambi
  `None`, resta "non calcolabile" come oggi.
- `festivita`: se impostato, le date che contiene **si aggiungono** a quelle del calendario
  nazionale (chiusure aziendali specifiche del cliente, non un override) — unione fra le due liste,
  non sostituzione. Se `None` e `paese` è impostato, si usano solo le festività del calendario. Se
  entrambi `None`, resta "non calcolabile" come oggi.

**2. `backend/jet/criteri.py`**

In `valuta_riga`, prima di calcolare `flag_weekend` e `flag_festivita`, deriva i valori effettivi:

```python
weekend_effettivo = (
    parametri.giorni_weekend
    if parametri.giorni_weekend is not None
    else (giorni_weekend(parametri.paese) if parametri.paese is not None else None)
)
festivita_effettiva = None
if parametri.paese is not None:
    anno = riga.data_effettiva.year
    base = calendari.festivita(parametri.paese, anno, anno)
    if not base and not parametri.festivita:
        # Nessuna festività compilata per questo Paese/anno (dataset del Giorno 4
        # ancora incompleto, es. Israele o Spagna 2027+) e nessuna aggiunta manuale:
        # non calcolabile, non "nessuna festività". Un Paese reale non ha mai zero
        # festività in un anno, quindi una lista vuota qui è sempre un segnale di
        # dati mancanti, non un dato genuino.
        festivita_effettiva = None
    else:
        festivita_effettiva = sorted(set(base) | set(parametri.festivita or []))
elif parametri.festivita is not None:
    festivita_effettiva = parametri.festivita
```

**Importante — questa parte è stata corretta dopo la verifica del Giorno 4**: il dataset consegnato
ha Israele con tutti gli anni presenti ma completamente vuoti (scelta corretta per non inventare
corrispondenze del calendario ebraico), e la Spagna vuota per il 2027–2030. Senza il controllo sopra,
`calendari.festivita("IL", anno, anno)` restituirebbe `[]` — una lista vuota valida, non un errore —
e il criterio finirebbe per segnalare silenziosamente "mai festività" per un cliente israeliano
invece di "non calcolabile". Implementa esattamente il controllo `if not base and not
parametri.festivita` come sopra: non ometterlo.

(Adatta i nomi delle variabili locali per non confliggere con l'import delle funzioni
`festivita`/`giorni_weekend` da `calendari.py` — per esempio importa il modulo con
`from backend.jet import calendari` e usa `calendari.festivita(...)`, non l'import diretto dei nomi,
proprio per evitare l'ombra su variabili locali con lo stesso nome.)

Usa `weekend_effettivo`/`festivita_effettiva` al posto di `parametri.giorni_weekend`/
`parametri.festivita` nel calcolo di `flag_weekend`/`flag_festivita`, lasciando la struttura dei due
flag (e la loro presenza in `EsitoRigaJet`) invariata.

**3. Regola di non doppio conteggio.** Quando `flag_weekend` e `flag_festivita` sono entrambi
`True` per la stessa riga (un giorno festivo che cade di sabato, per esempio), il punteggio deve
contare **solo il peso maggiore fra i due**, non la somma — i due flag restano comunque entrambi
`True` e visibili separatamente nel risultato, cambia solo come contribuiscono al totale. Nella
funzione `flag_e_pesi`/somma del punteggio totale, togli le due tuple `(flag_weekend,
punteggio_weekend)` e `(flag_festivita, punteggio_festivita)` dal ciclo generico e sostituiscile con
un contributo calcolato a parte:

```python
if flag_weekend is True and flag_festivita is True:
    contributo_weekend_festivita = max(parametri.punteggio_weekend, parametri.punteggio_festivita)
elif flag_weekend is True:
    contributo_weekend_festivita = parametri.punteggio_weekend
elif flag_festivita is True:
    contributo_weekend_festivita = parametri.punteggio_festivita
else:
    contributo_weekend_festivita = 0
```

da sommare al totale insieme al contributo degli altri criteri (che restano nel ciclo generico
esistente, invariati).

**4. Interfaccia — `ui/src/jet/JetDashboard.tsx`**: aggiungi `paese: null` a `EMPTY`, e un menu a
tendina "Paese" con le nove opzioni (usa le stesse etichette leggibili — Italia, Germania, Francia,
Spagna, Israele, Stati Uniti, Malta, Irlanda, Cipro — mappate ai codici `calendari.CODICI_PAESE`;
se non hai un modo automatico per tenerle sincronizzate, scrivi l'elenco a mano nel frontend e
segnala nel riepilogo che è duplicato manualmente rispetto al backend, così resta tracciato).
Posizionalo vicino ai campi `giorni_weekend`/`festivita` esistenti nel form, con una nota nel testo
del form che i campi manuali sotto sono "chiusure aggiuntive", non una sostituzione, quando è
selezionato un Paese. In `ui/src/jet/api.ts`, aggiungi `paese: string | null` a `JetParams`.

## Cosa NON fare

- Non toccare `calendari.py` né il suo dataset: se lo trovi incompleto per qualche Paese, non è
  compito di questo prompt completarlo.
- Non introdurre alcuna regola di non-doppio-conteggio per altre coppie di criteri: riguarda solo
  weekend/festività, per gli altri dieci criteri nulla cambia.
- Non toccare `ui/src/jet/ParamsPanel.tsx` se presente nella tua copia locale: non è nel tuo scope.
- Non cambiare il comportamento quando `paese` è `None`: dev'essere identico a oggi (liste manuali,
  "non calcolabile" se assenti).

## Test richiesti

In `tests/test_jet_criteri.py`: un caso con `paese` impostato e nessuna lista manuale (weekend e
festività derivati dal calendario); un caso con `paese` impostato più `festivita` manuale
aggiuntiva (verifica che sia un'unione, non una sostituzione — una data presente solo nella lista
manuale dev'essere comunque segnalata); un caso con `paese` impostato più `giorni_weekend` manuale
(verifica che il manuale prevalga per intero sul calendario); il caso di non doppio conteggio,
costruendo una riga con data che sia contemporaneamente weekend e festività secondo il calendario
scelto, con pesi diversi per i due criteri, e verificando che il punteggio totale rifletta solo il
peso maggiore; il comportamento invariato quando `paese` è `None`; **un caso con `paese="IL"`
(dataset vuoto) e nessuna `festivita` manuale, che deve risultare `flag_festivita is None`, non
`False`**; un caso con `paese="IL"` più una `festivita` manuale, che deve invece usare quella lista
manuale normalmente (non `None`, perché in quel caso il revisore ha comunque fornito un dato).

In `tests/test_jet_models.py`: verifica che un `paese` non valido (fuori da `CODICI_PAESE`) venga
rifiutato dalla validazione.

Rilancia l'intera suite in un checkout pulito: `python -m pytest tests/ -q`, mai `pytest` nudo.
Incolla l'output letterale.

## Consegna

Branch nuovo dalla punta del branch del Giorno 4 (indicalo esplicitamente nel riepilogo, dato che
dipende da quale commit ha effettivamente prodotto). Commit locali, niente push né PR. Nel
riepilogo: conferma del comportamento sui casi limite sopra elencati (unione festività, override
weekend, non doppio conteggio, `paese` assente invariato), quali Paesi restano con dataset
incompleto secondo il Giorno 4, ed esito reale della suite in ambiente pulito.
