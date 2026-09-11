# Prompt 42 — JET: soglia "conto raro" inclusiva (10 volte o meno) (Quadra — modulo JET)

## Contesto

Punto 10 della tabella dei 15 controlli. Decisione di Ruben (11/09/2026): un conto è "raro" quando
appare **10 volte o meno in tutto nei file caricati** della pratica. Oggi il motore usa un confronto
stretto (`<`): con la soglia già precompilata a 10 in interfaccia (`EMPTY.soglia_frequenza_insolita`,
impostata dal prompt 36), un conto che appare **esattamente 10 volte non viene flaggato** — solo quelli
con 9 o meno. Va corretto in un confronto inclusivo (`<=`), in modo che "soglia 10" significhi davvero
"10 o meno", non "meno di 10".

Nessun'altra modifica di comportamento: il campo `soglia_frequenza_insolita` resta configurabile per
cliente esattamente come oggi (Ruben non ha chiesto di renderlo fisso, solo di correggere il confronto);
il default in interfaccia resta 10, il peso resta configurabile e disattivato di default, tutto invariato.

## Passo 0 — obbligatorio, prima di toccare qualunque file

1. `git branch --show-current` — deve risultare `jet/sprint-15-controlli`.
2. `git log -1 --oneline` — alla mia ultima verifica il branch era a `857ae05`. Se è diverso non è
   necessariamente un problema, ma riporta l'hash esatto nel riepilogo.
3. `git status --short` — deve risultare vuoto. Se non lo è, **fermati e segnala cosa trovi, senza
   scartarlo né correggerlo di tua iniziativa**.

Se un controllo fallisce, non procedere: scrivi nel riepilogo cosa hai trovato e fermati lì.

## Cosa implementare

**`backend/jet/criteri.py`**

Nel blocco che calcola `flag_conto_insolito_raro` (dentro `valuta_riga`), cambia:
```python
flag_conto_insolito_raro = (
    frequenza_utilizzo_conto < parametri.soglia_frequenza_insolita
    if parametri.attivo_conto_insolito_raro
    and parametri.soglia_frequenza_insolita is not None
    else None
)
```
in:
```python
flag_conto_insolito_raro = (
    frequenza_utilizzo_conto <= parametri.soglia_frequenza_insolita
    if parametri.attivo_conto_insolito_raro
    and parametri.soglia_frequenza_insolita is not None
    else None
)
```
Nessun'altra riga di questo blocco va toccata. Non modificare `soglia_frequenza_insolita` come campo
(resta `int | None`, resta configurabile), non aggiungere una soglia fissa.

**`tests/test_jet_conti.py`**

I test esistenti per questo criterio vanno riletti e, se necessario, corretti per riflettere il nuovo
confronto inclusivo (in particolare qualunque test che usi una frequenza uguale alla soglia dovrebbe ora
aspettarsi `True`, non `False`). Aggiungi inoltre un test esplicito sul confine che oggi manca:
- un conto con frequenza **esattamente uguale** alla soglia configurata (es. soglia 10, frequenza 10) →
  `flag_conto_insolito_raro` deve essere `True` (comportamento nuovo, prima era `False`);
- un conto con frequenza **superiore di una unità** alla soglia (es. soglia 10, frequenza 11) → resta
  `False` (comportamento invariato).

**Frontend — `ui/src/jet/ParamsPanel.tsx`**

Rileggi il testo descrittivo esistente per il controllo id `"10"` (conto raro) — se il testo dice
qualcosa come "meno di X volte" o "sotto soglia", correggilo per riflettere la semantica inclusiva (es.
"X volte o meno"), coerente col cambiamento sopra. Non toccare nient'altro della voce (peso, interruttore,
posizione).

## Cosa NON fare

- Non toccare `models.py`: nessun nuovo campo, nessun cambio di tipo o default per
  `soglia_frequenza_insolita`/`punteggio_conto_insolito_raro`/`attivo_conto_insolito_raro`.
- Non toccare `EMPTY` in `JetDashboard.tsx`: il default 10 è già corretto, non va cambiato.
- Non toccare nessun altro criterio o controllo.
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
`backend/jet/criteri.py`, `tests/test_jet_conti.py`, `ui/src/jet/ParamsPanel.tsx` (solo se il testo
descrittivo andava davvero corretto — se non c'è nulla da cambiare lì, ometti il file dal commit e
dichiaralo nel riepilogo) — nessun altro file. Nel riepilogo: branch e commit di partenza effettivi,
conferma che il diff riguarda solo questi file, output letterale della suite di test, e se hai modificato
o meno il testo in `ParamsPanel.tsx` e perché.
