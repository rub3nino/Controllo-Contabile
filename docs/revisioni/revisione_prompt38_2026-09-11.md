# Revisione — Prompt 38 (allineamento tipi `attivo_*` in `JetParams`)

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit `7e7e28e`, dalla punta di `37ad405`. Verificato
indipendentemente, non sul riepilogo fornito.

## Scope

`git diff 37ad405..7e7e28e --stat`: esattamente i due file dichiarati — `ui/src/jet/api.ts` e
`ui/src/jet/JetDashboard.tsx` — nessun altro. Nessun file di backend toccato.

## Lettura del codice

Diff letto per intero (28 righe totali, solo aggiunte):

- `api.ts`: i quattordici campi `attivo_*` aggiunti a `JetParams`, stesso ordine di
  `backend/jet/models.py`, tutti tipizzati `boolean` (corretto: nel backend sono `bool` con default
  sempre presente, mai `Optional`).
- `JetDashboard.tsx`: i quattordici valori aggiunti a `EMPTY`, stesso ordine, valori identici a quelli
  specificati nel prompt (mirror esatto dei default già approvati nella revisione del prompt 35 lato
  backend): undici `true`, `attivo_conto_insolito_raro` e `attivo_conto_infragruppo_parte_correlata`
  a `false`, `attivo_finestra_chiusura` a `true`. Nessun'altra riga di `EMPTY` toccata, nessun'altra
  modifica al file.
- Nessuna discrepanza ulteriore "corretta di iniziativa", nessun file backend toccato, come richiesto.

## Verifica tipo/compilazione — rieseguita da me

Come per il prompt 37, rete del device bridge bloccata verso npm; cartella di lavoro live pulita
rispetto a `7e7e28e` (unici file non tracciati: tre documenti di prompt/revisione, non codice) — ho
eseguito il controllo direttamente lì:

```
$ git log -1 --format="%H %s"
7e7e28ee6f8ba52cb4c93774f01256d3fc7936e2 chore(ui): allinea tipi interruttori JET
$ npx tsc --noEmit
EXIT_CODE=0
```

Nessun output, uscita 0 — coincide col riepilogo.

## Nota operativa

Nessun push né PR, come da prassi. Restano non tracciati da git: `docs/prompts/37_...md`,
`docs/prompts/38_...md`, `docs/revisioni/revisione_prompt37_...md` — da includere nel prossimo commit
di archiviazione (stesso pattern di `cc807a2`), non bloccante.

## Esito

**Approvato.** Il buco di sequenza tra il prompt 35 (backend) e il prompt 36 (interfaccia) è chiuso.
Puoi ora fornire il prompt 36 (`docs/prompts/36_jet_toggle_criteri_interfaccia.md`) a chi implementa,
sullo stesso branch `jet/sprint-15-controlli` a partire da `7e7e28e`.
