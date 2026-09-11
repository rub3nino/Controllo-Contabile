# Prompt 41 — JET: criterio "cifre finali ripetute" (Quadra — modulo JET)

## Contesto

Punto 12 della tabella dei 15 controlli, oggi del tutto assente. Decisioni prese con Ruben l'11/09/2026:

- soglia: **3 o più cifre finali uguali consecutive**;
- **contribuisce al punteggio pesato** (peso 1–4, come "conto >10 cifre" appena implementato dal
  prompt 40), non è un flag informativo separato come la sequenza;
- va evitato il rumore banale di importi che finiscono in **",00"** (euro tondi) o **",99"** (prezzo di
  listino tipico) — Ruben ha chiesto esplicitamente di escluderli.

La definizione esatta del pattern per rispettare quell'esclusione senza perdere segnale reale è una mia
proposta, non discussa parola per parola con Ruben — se i dati reali con cui farai i test ti sembrano
contraddirla, segnalalo nel riepilogo invece di cambiarla di tua iniziativa.

**Logica proposta** (lavora sulle due cifre decimali più le cifre intere, come stringa di sole cifre,
senza separatori):

1. Prendi `abs(importo_netto)`, arrotondato a 2 decimali, e formattalo come stringa di sole cifre (es.
   `Decimal("12345.55")` → `"1234555"`, `Decimal("1000.00")` → `"100000"`).
2. Trova la cifra finale e la lunghezza della sequenza di cifre uguali consecutive che termina alla fine
   della stringa (es. `"1234555"` → cifra `"5"`, lunghezza `3`; `"100000"` → cifra `"0"`, lunghezza `6`).
3. **Se la cifra ripetuta è `"0"`, il flag è sempre `False`**, indipendentemente dalla lunghezza — un
   importo che finisce in zeri è già coperto dal criterio "cifra tonda" (punto 4), non deve generare
   rumore qui.
4. Altrimenti, il flag è `True` se e solo se la lunghezza è **almeno 3**. Questo esclude da solo il caso
   ",99" isolato (lunghezza 2, es. `"...99"` con la cifra prima dei centesimi diversa da 9): non serve
   un'esclusione dedicata per "9", la soglia di 3 già lo copre. Se invece la ripetizione di "9" si
   estende oltre i soli centesimi (es. `"...999.99"` → `"99999"`, lunghezza 5), il flag resta `True`: a
   quel punto non è più un normale prezzo di listino.

Non calcolabile (`None`) quando il criterio è disattivato. `importo_netto` è un campo obbligatorio su
`RigaGiornale` (mai assente), quindi non serve un'altra condizione di "dato mancante".

## Passo 0 — obbligatorio, prima di toccare qualunque file

1. `git branch --show-current` — deve risultare `jet/sprint-15-controlli`.
2. `git log -1 --oneline` — alla mia ultima verifica il branch era a `196edbe`. Se è diverso non è
   necessariamente un problema, ma riporta l'hash esatto nel riepilogo.
3. `git status --short` — deve risultare vuoto. Se non lo è, **fermati e segnala cosa trovi, senza
   scartarlo né correggerlo di tua iniziativa**.

Se un controllo fallisce, non procedere: scrivi nel riepilogo cosa hai trovato e fermati lì.

## Cosa implementare

**`backend/jet/models.py`** — in `ParametriClienteJet`, accanto ad `attivo_conto_lunghezza` (stesso
stile, stesso blocco):
```python
attivo_cifre_ripetute: bool = False
```
e nel blocco dei punteggi, accanto a `punteggio_conto_lunghezza`:
```python
punteggio_cifre_ripetute: int | None = Field(default=None, ge=0)
```
In `EsitoRigaJet`, accanto a `flag_conto_lunghezza`:
```python
flag_cifre_ripetute: bool | None = None
```

**`backend/jet/criteri.py`**

Aggiungi una funzione di modulo (stesso stile di `calcola_media_assoluta_registrazioni`, prima di
`valuta_riga`, non esportata in `__all__` perché è un dettaglio interno):
```python
def _cifre_finali_ripetute(importo: Decimal) -> bool:
    """True se le ultime 3+ cifre (intere+decimali) dell'importo sono uguali, esclusi gli zeri.

    Gli zeri finali sono esclusi perché sono già il segnale del criterio "cifra tonda": qui si cerca
    una ripetizione di cifra diversa da zero (es. 555, 999) che non sia spiegabile da un prezzo di
    listino con centesimi a ",99" isolati.
    """
    cifre = f"{abs(importo):.2f}".replace(".", "")
    ultima = cifre[-1]
    if ultima == "0":
        return False
    lunghezza = 0
    for carattere in reversed(cifre):
        if carattere != ultima:
            break
        lunghezza += 1
    return lunghezza >= 3
```
In `valuta_riga`, subito dopo il blocco di `flag_conto_lunghezza` (stesso punto in cui hai appena
aggiunto quel criterio nel prompt 40):
```python
flag_cifre_ripetute = (
    _cifre_finali_ripetute(riga.importo_netto)
    if parametri.attivo_cifre_ripetute
    else None
)
```
Aggiungi `(flag_cifre_ripetute, parametri.punteggio_cifre_ripetute)` alla tupla `flag_e_pesi` e
`flag_cifre_ripetute=flag_cifre_ripetute` alla costruzione finale di `EsitoRigaJet`.

**Non aggiungere** `attivo_cifre_ripetute` al conteggio `criteri_standard_attivi`: stesso trattamento di
`attivo_conto_insolito_raro`/`attivo_conto_infragruppo_parte_correlata`/`attivo_conto_lunghezza`, è un
criterio opzionale fuori dagli undici standard.

**`tests/test_jet_criteri.py`** (non `test_jet_conti.py` questa volta: il criterio lavora sull'importo,
non sul conto — segui lo stile dei test già presenti in questo file per criteri basati sull'importo).
Copri almeno:
- importo con 3+ cifre finali uguali non-zero (es. `Decimal("12345.55")`, che termina in `"555"`) → flag
  `True`, contribuisce al punteggio;
- importo che finisce in `",00"` con più zeri finali (es. `Decimal("1000.00")`) → flag `False` nonostante
  la lunghezza della ripetizione sia ben oltre 3;
- importo che finisce in `",99"` isolato, con la cifra prima dei centesimi diversa da 9 (es.
  `Decimal("19.99")`) → flag `False`;
- importo che finisce in `"999"` o più, estendendosi oltre i soli centesimi (es. `Decimal("999.99")`,
  che termina in `"99999"`) → flag `True`, il "9" ripetuto oltre i centesimi resta un segnale valido;
- criterio disattivato → flag `None`, nessun contributo al punteggio, anche con un importo che
  altrimenti sarebbe stato flaggato.

**Frontend — `ui/src/jet/api.ts`**: aggiungi a `JetParams`, stesso stile dei campi analoghi già presenti:
```ts
attivo_cifre_ripetute: boolean;
punteggio_cifre_ripetute: number | null;
```

**Frontend — `ui/src/jet/JetDashboard.tsx`**: in `EMPTY`, aggiungi
`punteggio_cifre_ripetute: null` e `attivo_cifre_ripetute: false`, stesso stile e stessa posizione dei
campi analoghi appena aggiunti dal prompt 40.

**Frontend — `ui/src/jet/ParamsPanel.tsx`**: verifica se esiste già, come per il controllo "14" nel
prompt 40, una voce placeholder per il controllo id `"12"` (cifre finali ripetute) in `CONTROLS` — se sì
aggiornala sul posto invece di duplicarla, seguendo esattamente lo schema usato per l'id `"14"` (`status:
"presente"`, `baker` con nota che non ha un peso ufficiale nella tabella Global Focus, `hint` che spiega
la regola in una frase, `flagKeys: ["flag_cifre_ripetute"]`, `available: true`,
`attivoKeys: ["attivo_cifre_ripetute"]`, `pesi: [{ key: "punteggio_cifre_ripetute" }]`). Aggiungi la voce
descrittiva corrispondente (stesso schema obiettivo/rischio/campi/regola/limitazioni/eccezione usato per
`flag_conto_lunghezza`), spiegando chiaramente sia l'esclusione degli zeri finali sia quella dei ",99"
isolati. Nessuna modifica a `ControlFields` prevista: come per il conto >10 cifre, il controllo non ha
parametri propri oltre a peso e interruttore.

## Cosa NON fare

- Non toccare `sequenza.py`, `calendari.py`, `ingest*.py`, `store.py`, `pratica.py`, `fonti.py`,
  `tests/test_jet_conti.py`, `tests/test_jet_models.py`.
- Non includere `attivo_cifre_ripetute` nel conteggio `criteri_standard_attivi`.
- Non aggiungere una soglia configurabile per il numero di cifre ripetute: è fissa a 3 per decisione di
  Ruben.
- Non toccare altri valori di `EMPTY` o altre voci di `CONTROLS`/`SCOPO_CONTROLLI` (o equivalente) oltre
  a quelli di questo prompt.
- **Non toccare, scartare o committare alcun file che non sia uno di quelli elencati sopra.** Se trovi
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
suite di test, e segnala esplicitamente se la logica proposta sopra (esclusione zeri sempre, esclusione
",99" isolato ma non "999" esteso) ti è sembrata sbagliata alla luce dei casi che hai testato — è una mia
proposta, non di Ruben, e va confermata.
