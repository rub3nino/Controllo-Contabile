# Revisione — Prompt 41 (cifre finali ripetute)

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit `857ae05`, parent `4468ef9` (commit di sola documentazione, che
ha anche archiviato `libro_gioranel.csv`), a sua volta parent `196edbe` (ultimo commit di codice
approvato, prompt 40). Verificato indipendentemente, non sul riepilogo fornito.

## Precedente da questa revisione

Durante l'implementazione Codex ha trovato una contraddizione reale nella mia specifica originale
(`19.99` → `"1999"` → tre `9` finali per il conteggio a stringa unica, che avrebbe dato `True` contro il
`False` richiesto dal test) e si è fermato senza committare, come da disciplina. Ho corretto io la
funzione (conteggio limitato alla sola parte intera quando i centesimi sono `,99`) prima che Codex
riprendesse: la correzione è quindi mia, non improvvisata dall'implementatore.

## Metodo

`device_bash` continua a non riuscire a raggiungere `.git`. Scope e contenuto verificati camminando a
mano sugli oggetti git (`device_stage_files` + `zlib.decompress`), fino al singolo blob per ognuno dei
sei file dichiarati.

## Scope

Esattamente i sei file dichiarati, nessuno in più: `backend/jet/models.py`, `backend/jet/criteri.py`,
`tests/test_jet_criteri.py`, `ui/src/jet/api.ts`, `ui/src/jet/ParamsPanel.tsx`,
`ui/src/jet/JetDashboard.tsx`.

## Lettura del codice

- `_cifre_finali_ripetute` in `criteri.py` corrisponde parola per parola, commento incluso, alla
  funzione corretta che ho fornito dopo il blocco di Codex. Ricalcolato a mano tutti i casi che contavano:
  `19,99` → parte intera `"19"`, un solo `9` finale → `False`; `999,99` → parte intera `"999"`, tre `9` →
  `True`; `1.000,00` → ultima cifra `"0"` → `False` per la regola degli zeri, indipendentemente dalla
  lunghezza; `12.345,55` → centesimi `55` (non `99`), si conta l'intera stringa, tre `5` finali → `True`.
  Tutti coincidono con quanto dichiarato nel riepilogo.
- `flag_cifre_ripetute` è `None` quando il criterio è disattivato, mai `False` — disciplina rispettata.
  Aggiunto correttamente alla tupla `flag_e_pesi` e alla costruzione finale di `EsitoRigaJet`.
- **Confermato che `attivo_cifre_ripetute` non è stato aggiunto al conteggio `criteri_standard_attivi`**:
  quel blocco non risulta toccato dal diff.
- `backend/jet/models.py`: `attivo_cifre_ripetute: bool = False` e
  `punteggio_cifre_ripetute: int | None = Field(default=None, ge=0)` nella posizione richiesta;
  `flag_cifre_ripetute: bool | None = None` aggiunto a `EsitoRigaJet`.
- `tests/test_jet_criteri.py`: tutti e cinque i casi richiesti presenti, incluso un helper
  `_parametri_cifre_ripetute` che disattiva esplicitamente gli undici criteri standard per isolare
  l'asserzione sul punteggio totale — non richiesto testualmente dal prompt ma una buona scelta tecnica,
  evita interferenze dai default della fixture condivisa. Il test parametrizzato copre esattamente i tre
  casi di confine discussi (`1000.00`→`False`, `19.99`→`False`, `999.99`→`True`).
- `ui/src/jet/api.ts` e `JetDashboard.tsx`: i campi aggiunti nella posizione corretta, stesso stile dei
  campi analoghi del prompt 40.
- `ui/src/jet/ParamsPanel.tsx`: come per il controllo "14" nel prompt 40, esisteva già una riga
  placeholder per il controllo id `"12"` — aggiornata sul posto, non duplicata. Testo descrittivo
  accurato, spiega chiaramente sia l'esclusione degli zeri sia quella dei ",99" isolati (con la
  precisazione corretta "un finale ,99 isolato ha solo due 9 e non è segnalato"). Nessuna modifica a
  `ControlFields`, corretto: il controllo non ha parametri propri.

## Suite di test

```
210 passed, 7 warnings in 3.95s
```
Coerente con l'atteso: 205 (base dopo il prompt 40) + 5 nuovi test di questo prompt = 210.

**Non rieseguita da me in modo indipendente** in ambiente pulito, per lo stesso guasto di `device_bash`
su `.git` già dichiarato nelle revisioni precedenti — riserva aperta, invariata rispetto alle ultime
fasi. La verifica di contenuto sopra (lettura completa del codice e ricalcolo a mano di tutti i casi di
confine) resta comunque solida.

`npx tsc --noEmit`: uscita `0`, nessun errore, coerente col riepilogo.

## Esito

**Approvato.** Nessuna richiesta di modifica al codice.
