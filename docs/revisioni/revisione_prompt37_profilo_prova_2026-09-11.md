# Revisione — Prompt 37 (pulsante "Compila posizioni di prova" nel form profilo)

Data: 11 settembre 2026
Branch `jet/sprint-15-controlli`, commit `37ad405`, dalla punta di `cc807a2`. Verificato
indipendentemente, non sul riepilogo fornito da Codex.

## Scope

`git diff cc807a2..37ad405 --stat`: esattamente i due file dichiarati, nessuno in più —
`ui/src/jet/JetDashboard.tsx` e `ui/src/jet/presetProva.ts`. Nessun file di backend toccato, come
richiesto (il prompt era solo interfaccia).

## Lettura del codice

- `presetProva.ts`: diff di sole 16 righe aggiunte, nessuna modifica alle funzioni esistenti
  (`presetProva`, `suggestMapping`, `mappingIsReady`, ecc.). Aggiunge solo due costanti nuove:
  - `PROFILO_PROVA_NOME = "Profilo di prova"`.
  - `PROFILO_PROVA_POSIZIONI`: undici campi, ciascuno con coppia `[inizio, fine)` — corrisponde alle
    "22 coordinate" citate da Codex (11 campi × 2 numeri), non una discrepanza.
  - Intervalli verificati manualmente: `0-10, 10-20, 20-30, 30-40, 40-46, 46-56, 56-72, 72-88, 88-104,
    104-144, 144-154` — contigui, nessuna sovrapposizione, esattamente come richiesto nel prompt.
  - Nomi dei campi verificati contro l'array `FIELD_ORDER` già esistente in `JetDashboard.tsx` (righe
    125-135): coincidono esattamente, stesso ordine — nessun rischio di disallineamento con il resto
    del form.
- `JetDashboard.tsx`:
  - Nuova funzione `fillProfiloProva`: legge lo stato esistente `profileName`/`positions` (non nuovi
    hook, riusa quelli già presenti), chiede conferma con `window.confirm` solo se nome o posizioni
    contengono già qualcosa, poi imposta `profileName` a `PROFILO_PROVA_NOME` e `positions` con le
    undici coppie convertite in stringa. Nessuna chiamata a `jetApi`, nessun `run(...)`, quindi nessuna
    chiamata API né salvataggio automatico — confermato.
  - Il pulsante è inserito nell'header della sezione "Crea un nuovo profilo", fuori da qualunque
    condizione — sempre visibile, come richiesto. Disabilitato solo quando `busy` (stesso pattern degli
    altri pulsanti della pagina).
  - Il blocco "Salva e applica profilo" non è toccato dal diff: la procedura di salvataggio resta
    invariata.

## Verifica tipo/compilazione — rieseguita da me

La rete di `device_bash` è risultata bloccata verso `registry.npmjs.org` (403 dal proxy), quindi non ho
potuto ricreare un `node_modules` isolato da zero come da metodo standard per i test Python. In
alternativa: `git status --short` sulla cartella di lavoro live mostra pulito rispetto a `37ad405`
(unico file non tracciato è `docs/prompts/37_jet_profilo_prova_posizioni.md`, non codice) — ho quindi
eseguito la verifica di tipo direttamente lì, equivalente a verificare il commit dichiarato:

```
$ git log -1 --format="%H %s"
37ad405220a07eac3fcdc965040d387ea27c39c0 feat(ui): precompila posizioni profilo di prova
$ npx tsc --noEmit
EXIT_CODE=0
```

Nessun output, uscita 0 — coincide col riepilogo di Codex. `eslint` non è installato nel `node_modules`
esistente (indipendente da questo prompt, mai stato eseguito nelle verifiche precedenti su questo
progetto) — non l'ho considerato bloccante.

## Nota operativa

Nessun push né PR, come da prassi (le operazioni git restano tue). Il documento
`docs/prompts/37_jet_profilo_prova_posizioni.md` non è ancora tracciato da git: andrà incluso nel
prossimo commit di archiviazione prompt/revisioni (stesso pattern di `cc807a2`), ma non blocca
l'approvazione del codice.

## Esito

**Approvato.** Nessuna richiesta di modifica. Puoi procedere: fornisci il prompt 36 (interruttori
interfaccia, `docs/prompts/36_jet_toggle_criteri_interfaccia.md`) a chi implementa, sullo stesso branch
`jet/sprint-15-controlli` a partire da `37ad405`.
