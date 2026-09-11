# Prompt — JET: interruttore attivo/disattivato per criterio, motore (Giorno 8/15, parte 1 di 2) (Quadra — modulo JET)

## Contesto

Oggi un criterio si "disattiva" solo azzerando il suo peso — indistinguibile da un peso legittimamente
pari a zero. Questo prompt introduce un interruttore esplicito per ciascun criterio, separato dal peso,
e la riproporzionamento della soglia di approfondimento quando molti criteri sono spenti. **Solo motore
e test in questo prompt — nessuna modifica all'interfaccia**: il form continua a funzionare esattamente
come oggi (i nuovi campi hanno un default a livello di modello, quindi un payload che non li include
ancora si comporta come prima). La parte 2 (interruttori nell'interfaccia, legenda a quattro stati,
indicatore di copertura, etichette "peso proposto"/"peso approvato dal partner") è un prompt separato,
dopo che questo è verificato.

Deciso con Ruben prima di scrivere questo prompt (non ridiscuterli): interruttore = campo booleano
indipendente per criterio; soglia di approfondimento riproporzionata in modo proporzionale al numero di
criteri attivi quando scendono sotto 8.

## Elenco completo degli interruttori

Quattordici campi booleani nuovi in `ParametriClienteJet`, un blocco unico subito dopo
`soglia_da_investigare`, prima di `punteggio_profit_impact`:

```python
attivo_profit_impact: bool = True
attivo_oltre_dieci_volte_media: bool = True
attivo_sopra_performance_materiality: bool = True
attivo_importo_cifra_tonda: bool = True
attivo_weekend: bool = True
attivo_festivita: bool = True
attivo_fuori_orario: bool = True
attivo_backdated: bool = True
attivo_staff_non_autorizzato: bool = True
attivo_parte_correlata: bool = True
attivo_descrizione_vuota: bool = True
attivo_conto_insolito_raro: bool = False
attivo_conto_infragruppo_parte_correlata: bool = False
attivo_finestra_chiusura: bool = True
```

**Perché gli undici standard default a `True` e i tre restanti a `False`** — è un'eccezione deliberata
alla regola "nessun default nascosto", non una svista: gli undici criteri storici sono già attivi oggi
per ogni pratica esistente (governati solo da peso/parametri). Se questi nuovi interruttori default a
`False`, ogni pratica esistente perderebbe silenziosamente tutto il punteggio finché qualcuno non riapre
e riattiva manualmente undici interruttori — una regressione seria, non solo teorica: romperebbe anche
tutte le fixture dei test già scritte nei giorni precedenti (`_parametri()` in
`tests/test_jet_criteri.py` non imposta questi nuovi campi). Conto insolito/raro e conto
infragruppo/parte correlata sono invece estensioni non standard, non ancora approvate dal partner, e
già di fatto spente oggi (nessun peso precompilato) — per loro `False` preserva esattamente il
comportamento attuale, non lo cambia. `attivo_finestra_chiusura` default `True` perché il controllo del
Giorno 7 è già considerato standard (parte della specifica ufficiale), non un'estensione.

`attivo_backdated` governa **insieme** `flag_backdated`, `flag_forward_dating` e
`metodo_calcolo_backdating` (sono la stessa "prova" del Giorno 6, non tre controlli separati).
`attivo_finestra_chiusura` governa **insieme** `flag_finestra_chiusura` e `flag_creata_dopo_chiusura`
(stesso motivo, Giorno 7). Gli altri dodici interruttori sono uno-a-uno con il rispettivo flag.

## Cosa implementare

**1. `backend/jet/models.py`**

Aggiungi il blocco di quattordici campi sopra a `ParametriClienteJet`, nella posizione indicata.

In `EsitoRigaJet`, aggiungi un campo per rendere tracciabile quale soglia è stata effettivamente
applicata a quella riga (utile per l'audit trail, si aggiunge alla lista dei "dettagli salvati" già
prevista dall'architettura):

```python
soglia_da_investigare_effettiva: int = Field(ge=0)
```

**2. `backend/jet/criteri.py`**, in `valuta_riga`. Per ciascuno degli undici criteri standard e dei due
criteri di conto, la modifica è la stessa in ogni punto: aggiungi `parametri.attivo_<nome> and` (o `not
parametri.attivo_<nome> or` a seconda della forma dell'`if` esistente) alla condizione che già decide se
il flag è calcolabile — **non toccare nient'altro della logica esistente**. Esempio per
`flag_profit_impact` (identico schema per `flag_oltre_dieci_volte_media`,
`flag_sopra_performance_materiality`, `flag_importo_cifra_tonda`, `flag_weekend`, `flag_festivita`,
`flag_fuori_orario`, `flag_staff_non_autorizzato`, `flag_parte_correlata`):

```python
flag_profit_impact = (
    importo > Decimal("0.10") * abs(parametri.utile_netto_dopo_imposte)
    if parametri.attivo_profit_impact and parametri.utile_netto_dopo_imposte is not None
    else None
)
```

`flag_descrizione_vuota` è `bool`, non `bool | None` (non è mai "non calcolabile" oggi, la stringa vuota
è sempre valutabile) — per questo campo, quando `attivo_descrizione_vuota` è `False`, tienilo comunque
`bool` ma forzalo a `False` (mai contribuisce, ma il tipo del campo in `EsitoRigaJet` resta invariato,
non diventare `bool | None` solo per questo criterio):

```python
flag_descrizione_vuota = parametri.attivo_descrizione_vuota and not descrizione
```

Per il gruppo retrodatazione, aggiungi `not parametri.attivo_backdated or` in testa alla condizione che
già annulla tutto quando mancano dati/soglia:

```python
if (
    not parametri.attivo_backdated
    or riga.data_creazione is None
    or parametri.soglia_backdating_giorni is None
):
    flag_backdated = None
    flag_forward_dating = None
    metodo_calcolo_backdating = None
elif riga.data_creazione < riga.data_effettiva:
    ...  # invariato
```

Per il gruppo finestra di chiusura, stesso schema su entrambi i flag:

```python
if (
    not parametri.attivo_finestra_chiusura
    or parametri.data_chiusura is None
    or parametri.finestra_chiusura_giorni_lavorativi is None
    or parametri.paese is None
):
    flag_finestra_chiusura = None
elif riga.data_effettiva > parametri.data_chiusura:
    flag_finestra_chiusura = False
elif festivita_chiusura is None:
    flag_finestra_chiusura = None
else:
    ...  # invariato

if (
    not parametri.attivo_finestra_chiusura
    or riga.data_creazione is None
    or parametri.data_chiusura is None
):
    flag_creata_dopo_chiusura = None
else:
    ...  # invariato
```

Per `flag_conto_insolito_raro` e `flag_conto_infragruppo_parte_correlata`, stesso schema:

```python
flag_conto_insolito_raro = (
    frequenza_utilizzo_conto < parametri.soglia_frequenza_insolita
    if parametri.attivo_conto_insolito_raro and parametri.soglia_frequenza_insolita is not None
    else None
)
```

```python
if (
    not parametri.attivo_conto_infragruppo_parte_correlata
    or parametri.conti_infragruppo_parte_correlata is None
    or riga.conto_contabile is None
):
    flag_conto_infragruppo_parte_correlata = None
else:
    ...  # invariato
```

**3. Riproporzionamento della soglia.** Poco prima di costruire `EsitoRigaJet` (dopo aver calcolato
`punteggio_totale`), aggiungi:

```python
criteri_standard_attivi = sum([
    parametri.attivo_profit_impact,
    parametri.attivo_oltre_dieci_volte_media,
    parametri.attivo_sopra_performance_materiality,
    parametri.attivo_importo_cifra_tonda,
    parametri.attivo_weekend,
    parametri.attivo_festivita,
    parametri.attivo_fuori_orario,
    parametri.attivo_backdated,
    parametri.attivo_staff_non_autorizzato,
    parametri.attivo_parte_correlata,
    parametri.attivo_descrizione_vuota,
])
if 1 <= criteri_standard_attivi < 8:
    soglia_effettiva = round(
        parametri.soglia_da_investigare * criteri_standard_attivi / 11
    )
else:
    soglia_effettiva = parametri.soglia_da_investigare
```

Nota sul caso `criteri_standard_attivi == 0`: **non** rientra nel ramo di riproporzionamento (la
condizione è `1 <= ... < 8`, non `< 8`) — con tutti gli undici standard spenti, `soglia_effettiva`
resta quella configurata, non zero. Con zero criteri attivi il punteggio sarà comunque sempre zero (i
conti/finestra chiusura non contribuiscono mai), quindi `da_investigare` risulterà correttamente
`False` quasi sempre invece che banalmente `True` per ogni riga come accadrebbe con soglia zero — non
omettere questo caso speciale, è stato scelto apposta per evitarlo.

Sostituisci la riga esistente `da_investigare=punteggio_totale >= parametri.soglia_da_investigare,` con:

```python
da_investigare=punteggio_totale >= soglia_effettiva,
soglia_da_investigare_effettiva=soglia_effettiva,
```

`criteri_standard_attivi` conta **solo** gli undici criteri standard elencati sopra — non include
`attivo_conto_insolito_raro`, `attivo_conto_infragruppo_parte_correlata` né
`attivo_finestra_chiusura` (sono estensioni/controlli senza peso, fuori dal conteggio "undici criteri"
a cui il piano si riferisce).

## Cosa NON fare

- Non toccare `ui/src/jet/JetDashboard.tsx` né `ui/src/jet/api.ts`: zero modifiche all'interfaccia in
  questo prompt. I nuovi campi hanno un default a livello di modello Pydantic, quindi un payload che non
  li include ancora (l'interfaccia attuale) si comporta esattamente come oggi.
- Non cambiare il comportamento di nessun criterio quando il relativo `attivo_X` è `True` (il default
  per undici dei quattordici): dev'essere bit-per-bit identico a prima di questo prompt.
- Non introdurre un'unica lista/dizionario generico per gli interruttori al posto dei quattordici campi
  espliciti: mantieni lo stile del resto del modello (campi nominati, non una struttura dinamica).
- Non toccare `backend/jet/calendari.py`, `backend/jet/sequenza.py`, `backend/jet/ingest*.py`.

## Test richiesti

In `tests/test_jet_criteri.py`, aggiungi (senza toccare i test esistenti — verifica che continuino a
passare invariati, è la controprova che il default `True` non cambia nulla per chi non usa i nuovi
campi):

- per almeno tre criteri diversi (uno "semplice" come `flag_profit_impact`, il gruppo
  `flag_backdated`/`flag_forward_dating`, il gruppo `flag_finestra_chiusura`/`flag_creata_dopo_chiusura`):
  con tutti i parametri necessari presenti e `attivo_X=False`, il/i flag risultano `None` e non
  contribuiscono al punteggio, anche con un peso molto alto impostato.
- `flag_descrizione_vuota` con `attivo_descrizione_vuota=False` su una riga con descrizione vuota:
  risulta `False` (non `None` — il tipo del campo resta `bool`), e non contribuisce al punteggio.
- `flag_conto_insolito_raro` con `attivo_conto_insolito_raro=False` (il default) anche con
  `soglia_frequenza_insolita` impostata: resta `None`.
- riproporzionamento: con `soglia_da_investigare=4` e sette degli undici criteri standard disattivati
  (quindi quattro attivi), verifica `soglia_da_investigare_effettiva == round(4 * 4 / 11)` (= 1) sia nel
  campo dell'esito sia nel comportamento di `da_investigare` con un punteggio totale che dimostri il
  confine (es. punteggio 1 → `da_investigare is True` con soglia effettiva 1, mentre con tutti gli
  undici attivi lo stesso punteggio non lo sarebbe).
- con otto o più criteri standard attivi, `soglia_da_investigare_effettiva == parametri.soglia_da_investigare`
  (nessun riproporzionamento) — verifica il confine esatto: sette attivi riproporziona, otto no.
- con **zero** criteri standard attivi, `soglia_da_investigare_effettiva == parametri.soglia_da_investigare`
  (il caso speciale descritto sopra, non zero) e `da_investigare is False` (punteggio necessariamente
  zero, soglia configurata normalmente positiva).
- un test che rilancia la parametrizzazione esistente `test_ogni_criterio_ha_un_caso_vero_e_falso` (o
  equivalente) senza modifiche, a conferma che il comportamento di default resta invariato.

In `tests/test_jet_models.py`: verifica che `ParametriClienteJet` costruito senza specificare i nuovi
campi abbia `attivo_conto_insolito_raro is False`, `attivo_conto_infragruppo_parte_correlata is False`,
e tutti gli altri undici/`attivo_finestra_chiusura` `is True`.

Rilancia l'intera suite in un checkout pulito (`git archive`, venv nuovo, sole dipendenze minime, niente
`paddleocr`): `python -m pytest tests/ -q`, mai `pytest` nudo. Incolla l'output letterale per intero.

## Consegna

Branch nuovo dalla punta di `codex/jet-finestra-chiusura` (commit `07757bf`) — o da
`jet/sprint-15-controlli` se Ruben lo ha nel frattempo allineato a quella punta, indicalo esplicitamente
nel riepilogo. Commit locali, niente push né PR. Nel riepilogo: file toccati, conferma di ciascun caso
limite sopra elencato (in particolare il confine 7/8 criteri attivi e il caso zero), conferma che i test
preesistenti passano invariati, ed esito reale della suite in ambiente pulito con l'output incollato per
intero.
