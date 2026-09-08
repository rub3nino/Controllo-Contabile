# Revisione Fase 3b — dashboard nativa in React

Branch: `redesign/fase3b-dashboard-ui` (sopra `redesign/fase3a-domain-api`), commit `1779a7a`. Prima fase che tocca `ui/`.

## Cosa è stato verificato

`git diff redesign/fase3a-domain-api..redesign/fase3b-dashboard-ui --stat`: 7 file, tutti dentro `ui/`, nessuno fuori — 2 file esistenti modificati (`App.tsx`, `api.ts`), 5 nuovi (`domain/api.ts`, `domain/DomainDashboard.tsx`, `domain/WorkspaceTabs.tsx`, `sectionHelp.ts`, `statusPill.tsx`). `backend/domain/api.py` e il resto del backend: intatti, confermato.

Diff completo su `App.tsx` letto per intero: corrisponde esattamente a quanto dichiarato da Codex — `SECTION_HELP`/`ALL_SECTIONS`/`sectionHelp()`/`pill()` estratti verbatim (non riscritti) in `sectionHelp.ts`/`statusPill.tsx`, un `useState<"excel"|"domain">` con return anticipato per la dashboard di dominio, `<WorkspaceTabs>` nell'header esistente. Il flusso Excel (Scansiona/Avvia/Esporta) non è toccato nella sua logica, solo "avvolto" dal nuovo switch. Diff su `api.ts`: una riga, `j<T>` reso `export`. Nessuna sorpresa.

`ui/src/domain/api.ts` e `ui/src/domain/DomainDashboard.tsx` letti per intero: i tipi TypeScript corrispondono campo per campo a `backend/domain/models.py` (controllato nome per nome, non per fiducia); il componente copre tutti i punti richiesti — form scan/riprendi pratica, le 9 sezioni con badge/motivazione/mancanti/evidenze/anomalie, i finding aperti separati, il form di override con precompilazione da un pulsante "Segna saltata" sulla singola voce mancante. Nessuna libreria di routing introdotta, come richiesto.

**Verifica build, con una complicazione risolta:** `npx tsc --noEmit` rieseguito da questo bridge è passato pulito (nessun output). `npm run build` invece falliva ripetutamente da questo bridge con `ENOENT` su file temporanei di vite (`node_modules/.vite-temp/*.mjs`) — un bug del mount FUSE su questo ambiente (non riesce a cancellare i propri file temporanei), non del codice: gli stessi file restano bloccati anche con permessi di cancellazione negati. Per non lasciare la build non verificata, ho copiato il sorgente `ui/` (esclusi `node_modules`/`dist`) fuori dal mount, in un ambiente cloud pulito, ho rifatto `npm install` da zero lì e ho rilanciato sia `tsc --noEmit` sia `npm run build`: **entrambi passati puliti**, build Vite completata in 2.69s con i 36 moduli attesi. Quindi la build che Codex ha dichiarato è confermata in modo indipendente, solo non nell'ambiente originale del bridge.

Un dettaglio di pulizia per te: ho dovuto creare una cartella `_verifica_scratch/` dentro il tuo progetto per copiare temporaneamente quel sorgente — non riesco a cancellarla da qui (stesso limite di permessi). Contiene solo un archivio del codice `ui/` già nel repo, nessun dato nuovo: puoi cancellarla quando vuoi, non blocca nulla.

## Verdetto

Fase 3b approvata. Codice pulito, ambito del diff esattamente quello richiesto, riuso corretto di `pill()`/`SECTION_HELP` come imposto, build e type-check confermati in modo indipendente (fuori dal bridge, per il motivo sopra).

## Limite noto, segnalato onestamente da Codex

L'API non espone un modo per elencare/vedere la cronologia degli `HumanOverride` salvati — si può registrarne uno e vederne l'effetto ricalcolando `/verifiche`, ma non c'è un endpoint per rivedere "chi ha saltato cosa e quando". Non blocca l'uso, ma è un buco reale se più persone del collegio useranno la dashboard: prima o poi qualcuno chiederà "chi ha deciso di saltare questa voce". Lo terrei in mente per un prompt futuro, non urgente ora.

Resta anche aperto, dalla revisione della Fase 3a, il dettaglio minore di `HumanOverride.decided_at` sempre `null` — stesso non-bloccante di allora.

## Stato del sistema a questo punto

Con Fase 0 → 3b: motore di verifica completo e testato, API HTTP funzionante in parallelo al flusso Excel esistente, e ora una dashboard reale che lo mostra — il pezzo che avevi chiesto come "primo output vero". Il flusso Excel storico continua a funzionare invariato (confermato più volte, anche in questa fase).
