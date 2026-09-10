# Prompt — JET: soglia configurabile per l'importo a cifra tonda (JET-04) (Quadra — modulo JET)

## Contesto

Oggi `flag_importo_cifra_tonda` in `backend/jet/criteri.py` (riga 78) è fisso:
`importo % Decimal(10) == 0`, quindi segnala anche 20€ o 150€. Va sostituito con una soglia
scelta dall'utente: 10.000, 100.000, 1.000.000, oppure un valore custom.

Nota di contratto: oggi questo è l'unico criterio "sempre calcolabile" che non dipende da nessun
parametro cliente (come `flag_descrizione_vuota`). Rendendolo configurabile smette di esserlo:
quando l'utente non ha ancora scelto una soglia, il criterio deve diventare "non calcolabile"
(`None`), esattamente come già succede per weekend, festività, backdating eccetera — mai un
`False` fittizio. Questo richiede allargare il tipo di `flag_importo_cifra_tonda` in
`EsitoRigaJet` da `bool` a `bool | None`.

## Cosa implementare

**1. `backend/jet/models.py`**

In `ParametriClienteJet`, aggiungi un nuovo campo:

```python
soglia_importo_cifra_tonda: Decimal | None = Field(default=None, gt=0)
```

In `EsitoRigaJet`, cambia il tipo esistente:

```python
flag_importo_cifra_tonda: bool | None
```

(era `bool`).

**2. `backend/jet/criteri.py`**, dentro `valuta_riga`, sostituisci la riga 78:

```python
flag_importo_cifra_tonda = importo % Decimal(10) == 0
```

con:

```python
flag_importo_cifra_tonda = (
    importo % parametri.soglia_importo_cifra_tonda == 0
    if parametri.soglia_importo_cifra_tonda is not None
    else None
)
```

Non serve nessun'altra logica: un multiplo del valore scelto (10.000, 100.000, 1.000.000 o
custom) cattura automaticamente anche i livelli superiori — un importo di 100.000 con soglia
10.000 è già un multiplo di 10.000, quindi già segnalato senza bisogno di un interruttore
aggiuntivo. Non implementare nessun flag "multipli superiori" o simile: è ridondante con
l'aritmetica del modulo, non aggiunge nessun caso che il controllo sopra non copra già.

**3. Interfaccia — `ui/src/jet/JetDashboard.tsx`**

Aggiungi `soglia_importo_cifra_tonda: null` all'oggetto `EMPTY` (vicino a
`valore_medio_registrazione`, riga ~37). Nel form dei parametri, dove oggi c'è il campo
`punteggio_importo_cifra_tonda` (gestito da `WEIGHTS`, riga ~75), aggiungi un controllo separato
per la soglia: un menu a tendina con quattro opzioni — "10.000", "100.000", "1.000.000",
"Personalizzato" — che quando "Personalizzato" è selezionato mostra un campo numerico libero.
Il valore risultante va scritto in `params.soglia_importo_cifra_tonda`. Segui lo stile esistente
del form (classe `inputClass`, stessa gestione `onChange` degli altri campi in `OPTIONAL_NUMBERS`)
ma non è un semplice numero libero come quelli in `OPTIONAL_NUMBERS`: serve un componente dedicato,
decidi tu i dettagli di implementazione purché il comportamento sia quello descritto.

In `ui/src/jet/api.ts`, aggiungi `soglia_importo_cifra_tonda: number | string | null` al tipo
`JetParams`.

## Cosa NON fare

- Non implementare nessun flag "segnala anche i multipli superiori": è stato scartato perché
  ridondante con l'aritmetica del modulo (vedi sopra). Se durante l'implementazione ti sembra che
  manchi comunque un caso reale non coperto, segnalalo nel riepilogo invece di aggiungere logica
  non richiesta.
- Non toccare `punteggio_importo_cifra_tonda`: resta un peso separato, invariato.
- Non toccare nessun altro criterio in `criteri.py` o `models.py`.
- Non toccare `ui/src/jet/ParamsPanel.tsx` se esiste nella tua copia locale: è un file di un altro
  filone di lavoro sul redesign dell'interfaccia, non correlato a questo prompt. Se lo trovi,
  ignoralo, non è nel tuo scope.
- Non cambiare la firma di `valuta_riga` oltre a quanto già presente sul branch di partenza.

## Test richiesti

In `tests/test_jet_criteri.py`, la funzione helper `_parametri()` va aggiornata per includere
`soglia_importo_cifra_tonda=Decimal("10")` come valore di base, così il test parametrizzato
esistente (`flag_importo_cifra_tonda` con importi -120/121, riga 68) continua a passare invariato
con la stessa soglia di prima.

Aggiungi test nuovi che coprano: soglia 10.000 con un importo di 100.000 (deve risultare vero,
essendo multiplo); soglia 100.000 con un importo di 10.000 (deve risultare falso, non è multiplo
di 100.000); soglia non impostata (`None`) → il flag dev'essere `None`, non `False`, e non deve
contribuire al punteggio totale — riusa lo schema del test
`test_flag_non_calcolabili_restano_none_e_non_danno_punti` già esistente come riferimento.

Verifica anche che `EsitoRigaJet` accetti `flag_importo_cifra_tonda=None` senza errori di
validazione pydantic (un test diretto sul modello, in `tests/test_jet_models.py`, accanto a quelli
già presenti).

Rilancia l'intera suite in un checkout pulito (`git archive` dalla punta del branch, mai nella
cartella di lavoro live): `python -m pytest tests/ -q`, mai `pytest` nudo. Incolla l'output
letterale nel riepilogo.

## Consegna

Branch nuovo dalla punta di `codex/jet-media-automatica` (commit `380475c`). Commit locali, niente
push né PR. Nel riepilogo: conferma esplicita che il flag "multipli superiori" non è stato
implementato (per la ragione spiegata sopra) e non è stato aggiunto nessun elemento non richiesto
in `ui/src/jet/ParamsPanel.tsx` o altrove fuori scope; i casi di test verificati a mano (soglia
10.000/importo 100.000, soglia 100.000/importo 10.000, soglia assente); l'esito reale della suite
in ambiente pulito.
