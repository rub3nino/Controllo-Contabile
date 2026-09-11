# Revisione — Prompt 36 (interruttori nell'interfaccia, legenda, scopo dei controlli)

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit `1a98113`, dalla punta di `508cab0c`. Verificato
indipendentemente, non sul riepilogo fornito.

## Nota metodologica — mount git non disponibile

Il mount `device_bash` verso la cartella del repository è risultato completamente non raggiungibile
per l'intera durata di questa verifica (non solo la parte git: anche `cd`/`ls` sulla cartella
fallivano). Ho quindi seguito il metodo alternativo previsto dal progetto per questi casi, ma spinto
fino al livello degli oggetti git grezzi (non solo `device_list_dir`/`device_stage_files` sui file di
lavoro): ho letto `.git/HEAD` e `.git/refs/heads/...` per confermare branch e commit, poi ho scaricato
e decompresso a mano (zlib) gli oggetti commit e tree di `508cab0c` e `1a98113`, ricostruendo l'albero
`root → ui → src → jet` per entrambi i commit e confrontando gli hash SHA-1 a ogni livello.

## Scope — verificato a livello di oggetti git, non di `git diff`

Confronto ricorsivo albero-per-albero tra `508cab0c` e `1a98113`: **l'unico percorso che cambia in
tutto il repository è `ui/src/jet/JetDashboard.tsx`**. Tutti gli altri file e sotto-alberi (root,
`ui/`, `ui/src/`, inclusi `backend/`, `docs/`, ecc.) hanno hash identico nei due commit. Verificato
anche che `ui/src/jet/api.ts` e `ui/src/jet/presetProva.ts` abbiano lo stesso hash del blob in
entrambi i commit (nessuna modifica). Scope rispettato esattamente.

Confermato anche, a monte: a `508cab0c` (la base dichiarata da Codex) `ui/src/jet/` conteneva **solo**
`JetDashboard.tsx`, `api.ts`, `presetProva.ts` — nessuna traccia di `JetMappingDrawer.tsx` o
`campiGiornale.ts` nella storia committata. Questo conferma che quei due file, nell'incidente di prima,
erano solo residui non tracciati nella cartella condivisa: la pulizia fatta da Codex (checkout +
rimozione) non ha cancellato alcun lavoro ufficialmente committato.

## Lettura del codice — diff ricostruito e letto per intero

Ho ricostruito il diff completo (`diff -u`) tra il blob `JetDashboard.tsx` dei due commit e l'ho letto
integralmente (300 righe di diff). Corrisponde punto per punto alla specifica del prompt:

- **Punto 1 (interruttori sui pesi)**: il ciclo `WEIGHTS.map` è stato riscritto esattamente come da
  prompt — `attivoKey` derivato meccanicamente con `.replace("punteggio_", "attivo_")`, checkbox legata
  a `params[attivoKey]`, il campo numerico resta sempre modificabile (nessuna logica di
  disabilitazione aggiunta, come richiesto).
- **Punto 2 (finestra di chiusura)**: nuovo `<Field label="Finestra di chiusura — attiva">` con
  checkbox su `params.attivo_finestra_chiusura`, posizionato subito dopo il campo "Orario ufficio —
  fine" esistente (vicino a "Data di chiusura" come richiesto, stessa sezione).
- **Punto 3 (precompilamento conto insolito/raro)**: in `EMPTY`, `soglia_frequenza_insolita: null → 10`
  e `punteggio_conto_insolito_raro: null → 4`. Nessun altro valore di `EMPTY` toccato.
- **Punto 4 (legenda a quattro stati)**: testo inserito verbatim, identico carattere per carattere a
  quello fornito nel prompt.
- **Punto 5 (pesi proposti/approvati)**: `PESI_PROPOSTI` definito esattamente con le sette chiavi del
  prompt, inclusa `punteggio_conto_infragruppo_parte_correlata` — Codex l'ha mantenuta e ha segnalato
  esplicitamente nel riepilogo che resta da confermare con te, senza deciderlo autonomamente, come
  richiesto. Etichetta `${label} — peso proposto/peso approvato dal partner` applicata nel `<Field>`.
- **Punto 6 (pannello scopo del controllo)**: `SCOPO_CONTROLLI` presente con tutti e quattordici i
  controlli, testo verbatim identico a quello fornito nel prompt (nessuna riformulazione). Componente
  `ScopeDetails` con `<details><summary>ℹ️ Scopo del controllo</summary>...</details>`, collegato sia ai
  campi peso (via `flagKey` derivato da `key.replace("punteggio_", "flag_")`) sia al campo finestra di
  chiusura (`flagKey="flag_finestra_chiusura"` esplicito).
- Nessuna modifica a `backend/`, nessun'altra modifica a `JetDashboard.tsx` oltre a quanto sopra,
  nessun file estraneo toccato o committato (confermato anche a livello di oggetti git, non solo dal
  riepilogo).

## Verifica TypeScript — non rieseguita in questo giro, per causa di forza maggiore

Il mount `device_bash` è rimasto completamente irraggiungibile (non solo per git) per tutta la durata
di questa verifica, nonostante diversi tentativi. Non ho quindi potuto rilanciare io stesso
`npx tsc --noEmit`. Ho fatto una verifica manuale di tipo sul codice letto (i nuovi usi di
`params.attivo_finestra_chiusura`, `attivoKey as keyof JetParams`, `PESI_PROPOSTI: Set<keyof
JetParams>`, `SCOPO_CONTROLLI: Record<string, {...}>`) e non emergono incompatibilità con i tipi già
verificati nei prompt 35/38 — ma è un controllo a occhio, non un'esecuzione del compilatore, quindi non
equivale al controllo indipendente richiesto dal metodo del progetto.

**Azione richiesta**: appena possibile (a te, se hai due minuti sulla macchina, oppure a me al prossimo
giro se il mount si è ripreso), rilanciare `npx tsc --noEmit` dentro `ui/` sul commit `1a98113` e
incollarne l'output. Non blocco il proseguimento per questo — lo scope e la correttezza del codice sono
verificati in modo molto più rigoroso del solito (a livello di oggetti git, non di semplice diff) — ma
la chiusura formale di questa revisione resta in sospeso su questo solo punto.

## Esito

**Approvato con riserva minima**: contenuto e scope del codice verificati in modo rigoroso e corretti
in ogni punto della specifica. Manca solo la riconferma automatica del type-check, per un problema di
infrastruttura (mount down), non per un dubbio sul codice. Puoi considerare il prompt 36 chiuso; la
riconferma tsc la aggiungo a questa stessa revisione appena disponibile.
