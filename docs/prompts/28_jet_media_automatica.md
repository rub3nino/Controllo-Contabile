# Prompt — JET: calcolo automatico della media registrazioni (JET-02) (Quadra — modulo JET)

## Contesto

`valore_medio_registrazione` (in `ParametriClienteJet`) alimenta il criterio ">10× la media"
(`flag_oltre_dieci_volte_media` in `backend/jet/criteri.py`), ma oggi è solo un numero che
qualcuno inserisce a mano nei parametri della pratica. Va calcolato automaticamente dalla
popolazione effettivamente caricata, sul modello di come `calcola_frequenza_conti` calcola già la
frequenza dei conti prima di valutare le righe (`backend/jet/api.py`, endpoint
`POST /pratiche/{pratica_id}/analizza`, funzione `analyze`, dove oggi si legge:
`frequenze = calcola_frequenza_conti(righe)` seguito da
`esiti = [valuta_riga(r, pratica.parametri, frequenze) for r in righe]`).

Il valore manuale resta comunque disponibile: se un revisore lo imposta esplicitamente nei
parametri della pratica, quel valore vince sempre sul calcolo automatico — serve per i casi in cui
si vuole forzare un benchmark diverso con giudizio professionale.

## Cosa implementare

**1. Nuova funzione pura in `backend/jet/criteri.py`**, accanto a `calcola_frequenza_conti`,
stesso stile (pura, senza side effect, opera sulla lista di righe):

```python
def calcola_media_assoluta_registrazioni(righe: list[RigaGiornale]) -> Decimal | None:
    """Media dei valori assoluti degli importi sulla popolazione caricata.

    Gli importi pari a zero sono esclusi dal denominatore. Restituisce ``None``
    quando non c'è alcun valore utilizzabile (popolazione vuota o tutti zero),
    mai zero: zero implicherebbe erroneamente che qualunque importo sia
    "oltre 10 volte la media".
    """
    valori = [abs(r.importo_netto) for r in righe if r.importo_netto != 0]
    if not valori:
        return None
    return sum(valori) / Decimal(len(valori))
```

Aggiungila a `__all__` in cima al file.

**2. Estendi `valuta_riga`** con un nuovo parametro opzionale in coda,
`media_registrazione_popolazione: Decimal | None = None` (dopo `frequenze_conto`, per non rompere
chiamate posizionali esistenti nei test). All'interno della funzione, il valore che alimenta
`flag_oltre_dieci_volte_media` deve essere: quello inserito manualmente in
`parametri.valore_medio_registrazione` se non è `None`, altrimenti
`media_registrazione_popolazione`. Se entrambi sono `None`, il flag resta `None` (non calcolabile)
esattamente come oggi.

**3. In `backend/jet/api.py`, dentro `analyze`**, calcola la media una sola volta sulla
popolazione appena caricata (la stessa lista `righe` già usata per `calcola_frequenza_conti`) e
passala a ogni chiamata di `valuta_riga`:

```python
frequenze = calcola_frequenza_conti(righe)
media_popolazione = calcola_media_assoluta_registrazioni(righe)
esiti = [
    valuta_riga(r, pratica.parametri, frequenze, media_popolazione) for r in righe
]
```

**4. Esponi il valore effettivamente usato**, per permettere la verifica senza dover indovinare
cosa ha calcolato il sistema. Aggiungi a `PraticaJet` (in `backend/jet/pratica.py`) un campo
`valore_medio_registrazione_effettivo: Decimal | None = None`, e valorizzalo nell'`update` del
`model_copy` dentro `analyze`, insieme agli altri campi già aggiornati lì
(`numero_registrazioni`, `numero_da_investigare`): dev'essere il valore manuale se impostato,
altrimenti `media_popolazione` calcolata — cioè lo stesso valore che il motore ha effettivamente
usato per il flag, non semplicemente il numero calcolato a prescindere dall'override.

**5. Interfaccia**: in `ui/src/jet/api.ts`, aggiungi `valore_medio_registrazione_effettivo` al
tipo che descrive `JetPractice`. In `ui/src/jet/JetDashboard.tsx`, mostra il valore accanto a dove
oggi compaiono già `numero_registrazioni` e `numero_da_investigare` per la pratica attiva (circa
riga 710, dove si legge `{active.numero_registrazioni...} righe · {active.numero_da_investigare...}`)
— aggiungi un terzo dato sulla stessa riga o riga successiva, formattato come importo (due
decimali), con un'etichetta chiara tipo "media registrazione: €X" e, se il valore è `null`, un
trattino invece di "0" o di un campo vuoto silenzioso.

## Cosa NON fare

- Non toccare il comportamento quando `parametri.valore_medio_registrazione` è impostato
  manualmente: deve continuare a vincere sempre sul calcolo automatico, senza eccezioni.
- Non introdurre alcun warning per "periodo parziale": non esiste oggi un modo affidabile di
  sapere se il file caricato copre l'intero esercizio o solo una parte (il campo `period` della
  pratica è testo libero), quindi non inventare un'euristica fragile. Se vuoi segnalarlo nel
  riepilogo come limitazione nota, va bene, ma non implementarlo come funzionalità.
- Non cambiare `calcola_frequenza_conti` né la sua chiamata.
- Non toccare gli altri dieci criteri in `criteri.py`.
- Non cambiare la firma di `valuta_riga` in modo da rompere le chiamate posizionali esistenti nei
  test — il nuovo parametro va aggiunto in coda con default `None`.
- Non rendere il campo `valore_medio_registrazione` di `ParametriClienteJet` calcolato o
  read-only: resta un campo che l'utente può ancora impostare a mano.

## Test richiesti

Aggiungi test per `calcola_media_assoluta_registrazioni` in `tests/test_jet_criteri.py` (o dove
già si testano le altre funzioni pure del modulo): popolazione con valori misti positivi/negativi
(verifica che usi il valore assoluto), popolazione con alcuni zeri (verifica che vengano esclusi
dal denominatore), popolazione vuota e popolazione di soli zeri (entrambe devono restituire
`None`, non zero).

Aggiungi un test che verifica la precedenza: con `parametri.valore_medio_registrazione` impostato
manualmente, il flag deve usare quel valore anche se viene passata una
`media_registrazione_popolazione` diversa; con `parametri.valore_medio_registrazione` a `None`,
deve usare quella calcolata.

Verifica anche `PraticaJet.valore_medio_registrazione_effettivo` dopo una chiamata a `analyze` in
`tests/test_jet_api.py`, in entrambi i casi (manuale impostato / non impostato).

Rilancia l'intera suite in un checkout pulito (`git archive` dalla punta del branch, mai nella
cartella di lavoro live): `python -m pytest tests/ -q`, mai `pytest` nudo. Incolla l'output
letterale nel riepilogo.

## Consegna

Branch nuovo dalla punta di `main` (o dalla punta del branch del prompt 27 se non è ancora stato
mergiato — chiarisci nel riepilogo da quale branch sei partito). Commit locali, niente push né PR.
Nel riepilogo: i file toccati, il comportamento verificato sui casi limite (popolazione vuota,
soli zeri, override manuale), e l'esito reale della suite di test in ambiente pulito.
