# Revisione — Prompt 42 (soglia "conto raro" inclusiva)

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit `95c9f8b`, parent `f4f15cf7` (commit di sola documentazione,
archivia prompt 42 e la revisione del prompt 41), a sua volta parent `857ae05` (ultimo commit di codice
approvato, prompt 41). Verificato indipendentemente, non sul riepilogo fornito. Nota: il riepilogo di
Codex indicava come "commit iniziale" `857ae05` (l'ultimo commit di codice, ignorando quello di sola
documentazione in mezzo) — descrizione ragionevole, coerente con quanto verificato.

## Metodo

`device_bash` continua a non riuscire a raggiungere `.git`. Scope e contenuto verificati camminando a
mano sugli oggetti git, fino al singolo blob per ognuno dei tre file dichiarati.

## Scope

Esattamente i tre file dichiarati, nessuno in più: `backend/jet/criteri.py`, `tests/test_jet_conti.py`,
`ui/src/jet/ParamsPanel.tsx`. Confermato che `backend/jet/models.py` non è stato toccato, come richiesto.

## Lettura del codice

- `criteri.py`: unica riga cambiata, esattamente `<` → `<=` nel calcolo di `flag_conto_insolito_raro`.
  Nessun'altra riga del blocco toccata.
- `tests/test_jet_conti.py`: aggiunto esattamente il test di confine richiesto
  (`test_conto_raro_include_la_soglia_ma_non_la_supera`), che verifica sia il nuovo comportamento
  (frequenza 10 con soglia 10 → `True`, punteggio 4) sia l'invarianza appena sopra (frequenza 11 con
  soglia 10 → `False`). Ho controllato gli altri test già presenti nel file per lo stesso criterio:
  nessuno di essi cade esattamente sul confine soglia==frequenza, quindi correttamente non modificati —
  la lettura del prompt su "correggere se necessario" è stata applicata con criterio, non riscritta a
  tappeto.
- `ui/src/jet/ParamsPanel.tsx`: entrambe le occorrenze del testo descrittivo del controllo id `"10"`
  corrette da "sotto soglia"/"meno volte della soglia" a "uguale o inferiore alla soglia", coerenti con
  la nuova semantica. Nessun'altra modifica alla voce (peso, interruttore, posizione invariati).

## Suite di test

```
211 passed, 7 warnings in 4.11s
```
Coerente con l'atteso: 210 (base dopo il prompt 41) + 1 nuovo test di confine = 211.

**Non rieseguita da me in modo indipendente** in ambiente pulito, per lo stesso guasto di `device_bash`
su `.git` già dichiarato nelle revisioni precedenti — riserva aperta, invariata. La verifica di contenuto
sopra (lettura completa del diff e ricalcolo a mano del confine) resta comunque solida.

`npx tsc --noEmit`: uscita `0`, nessun errore, coerente col riepilogo.

## Esito

**Approvato.** Nessuna richiesta di modifica al codice.
