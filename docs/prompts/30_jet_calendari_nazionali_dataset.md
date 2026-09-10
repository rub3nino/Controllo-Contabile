# Prompt — JET: dataset dei calendari nazionali (Giorno 4/15, solo dati — nessuna integrazione) (Quadra — modulo JET)

## Contesto

Oggi `festivita` e `giorni_weekend` in `ParametriClienteJet` sono liste che il revisore compila a
mano per ogni cliente, senza alcun concetto di Paese. Vogliamo un dataset statico e versionato di
festività e weekend per nove Paesi: Italia, Germania, Francia, Spagna, Israele, Stati Uniti (solo
festività federali), Malta, Irlanda, Cipro — copertura anni 2024–2030.

**Questo prompt costruisce solo il dataset e le funzioni di lettura, non lo collega ancora ai
controlli JET** (weekend/festività in `criteri.py` restano come oggi, invariati). L'integrazione è
un prompt separato (Giorno 5), apposta per poter verificare il dataset da solo prima di metterlo
in produzione — è dati sensibili per un tool di revisione, un errore qui si propaga silenziosamente
su ogni pratica che lo usa.

## Perché l'accuratezza qui conta più della velocità

Non inventare date plausibili. Per ogni Paese, cerca le festività ufficiali da fonti autorevoli
(sito governativo, camera di commercio, calendario ufficiale nazionale) — non da memoria, non da
un elenco generico trovato senza verifica. Presta attenzione particolare a:

- **Festività mobili**: Pasqua e Lunedì dell'Angelo/Pasquetta (Italia, Francia, Germania, Spagna,
  Irlanda, Malta — la data cambia ogni anno, calcolala correttamente per ciascun anno 2024–2030,
  non fissarla).
- **Israele**: calendario ebraico, le date gregoriane cambiano ogni anno (Rosh Hashanah, Yom
  Kippur, Sukkot, Pesach, Shavuot, Yom HaAtzmaut...) — vanno cercate anno per anno, non calcolate
  con una formula semplice. Il weekend israeliano è venerdì-sabato, non sabato-domenica: vale come
  `giorni_weekend` distinto da tutti gli altri otto Paesi.
- **Stati Uniti**: solo le festività federali (Presidents Day, Memorial Day, Juneteenth,
  Independence Day, Labor Day, Thanksgiving, ecc. — attenzione a quelle "third Monday of..." che
  cambiano data ogni anno), non quelle statali.
- **Malta, Irlanda, Cipro**: hanno calendari propri distinti, non copiare quello italiano/UK per
  vicinanza geografica o linguistica.

Se durante l'implementazione non hai accesso di rete per verificare le fonti, non procedere a
compilare le date a memoria: costruisci comunque la struttura dati e le funzioni richieste sotto,
ma lascia le liste delle festività vuote o con solo le festività fisse più ovvie e incontestabili
(1 gennaio, 25 dicembre), e scrivi esplicitamente nel riepilogo quali Paesi/anni restano da
completare e perché — sarà Ruben a fornire o validare il resto prima del Giorno 5.

## Cosa implementare

Nuovo file `backend/jet/calendari.py`:

```python
"""Calendari nazionali statici per JET: festività e weekend per Paese, 2024-2030.

Dataset versionato e curato manualmente, non generato automaticamente da una libreria
di terze parti: ogni data richiede verifica da fonte ufficiale prima di essere usata in
un controllo di revisione. Vedi il commento sopra ogni blocco Paese per le fonti usate.
"""

from __future__ import annotations

from datetime import date

CODICI_PAESE = ["IT", "DE", "FR", "ES", "IL", "US", "MT", "IE", "CY"]

WEEKEND_PER_PAESE: dict[str, list[int]] = {
    "IT": [5, 6],
    "DE": [5, 6],
    "FR": [5, 6],
    "ES": [5, 6],
    "IL": [4, 5],
    "US": [5, 6],
    "MT": [5, 6],
    "IE": [5, 6],
    "CY": [5, 6],
}

# FESTIVITA_PER_PAESE[codice][anno] = lista di date festive di quell'anno.
# Ogni blocco Paese deve avere un commento con la fonte usata per compilarlo.
FESTIVITA_PER_PAESE: dict[str, dict[int, list[date]]] = {
    # ... da compilare Paese per Paese, anni 2024-2030
}


def festivita(codice_paese: str, anno_da: int, anno_a: int) -> list[date]:
    """Tutte le festività del Paese fra anno_da e anno_a inclusi, ordinate."""
    ...


def giorni_weekend(codice_paese: str) -> list[int]:
    """I giorni della settimana considerati weekend per il Paese (0=lunedì, 6=domenica)."""
    ...
```

Firme esatte e nomi dei simboli esportati (`CODICI_PAESE`, `WEEKEND_PER_PAESE`,
`FESTIVITA_PER_PAESE`, `festivita`, `giorni_weekend`) da rispettare — verranno usati dal prompt di
integrazione del Giorno 5. Comportamento di `festivita()` e `giorni_weekend()` su un codice Paese
non presente nel dataset: solleva `ValueError` con messaggio chiaro, non restituire una lista vuota
silenziosa (un Paese sbagliato non è la stessa cosa di un Paese senza festività).

Aggiungi `calendari.py` all'`__init__.py` del pacchetto `backend/jet/` se il pattern esistente lo
richiede (controlla come sono esposti `criteri.py`/`models.py` prima di decidere).

## Cosa NON fare

- Non toccare `criteri.py`, `models.py`, `api.py`, né alcun campo di `ParametriClienteJet`: questo
  prompt non collega ancora il dataset a nessun controllo.
- Non toccare l'interfaccia (`ui/src/jet/`): niente selezione Paese in questo prompt.
- Non usare una libreria esterna di festività (tipo `holidays` su PyPI) come sostituto della
  verifica manuale: se la usi come punto di partenza per non ripartire da zero, ogni data che ne
  deriva va comunque confermata contro una fonte ufficiale prima di essere inclusa, e va dichiarato
  nel riepilogo che l'hai usata come riferimento.
- Non inventare o approssimare le festività mobili (Pasqua, calendario ebraico, "n-esimo lunedì
  del mese" USA) con una formula scritta a memoria senza verificarla contro una fonte: sono
  esattamente il tipo di errore silenzioso che questo prompt vuole evitare.

## Test richiesti

`tests/test_jet_calendari.py` nuovo: verifica che `festivita("IT", 2026, 2026)` e
`giorni_weekend("IT")` restituiscano dati coerenti con quanto effettivamente inserito nel dataset
(un test che si limiti a ripetere gli stessi valori del dataset non vale molto — meglio un test che
verifichi proprietà strutturali: ogni lista è ordinata, nessuna data duplicata, ogni Paese in
`CODICI_PAESE` ha una voce in `WEEKEND_PER_PAESE`, il range di anni richiesto è coperto per ogni
Paese anche se con liste eventualmente vuote per i Paesi/anni non ancora compilati). Verifica anche
il comportamento su un codice Paese inesistente (`ValueError`).

Rilancia l'intera suite in un checkout pulito: `python -m pytest tests/ -q`, mai `pytest` nudo.
Incolla l'output letterale.

## Consegna

Branch nuovo dalla punta di `codex/jet-cifra-tonda-configurabile` (commit `3960f33`). Commit
locali, niente push né PR. Nel riepilogo, oltre al solito (file toccati, test, esito suite),
**una tabella esplicita: per ciascuno dei nove Paesi, quali anni 2024–2030 sono completi, quali
parziali (solo festività fisse) e quali fonti hai usato per i Paesi completati** — è l'informazione
che serve per decidere se il Giorno 5 può partire subito o se prima va completato/validato il
dataset con Ruben.
