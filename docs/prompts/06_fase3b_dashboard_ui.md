# Prompt — Fase 3b: dashboard nativa in React (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Il redesign procede a fasi, ciascuna rivista prima della successiva. Prima di scrivere codice, leggi in ordine:

1. `docs/analisi_obiettivi_controllo_contabile.md` e `docs/piano_azione_redesign.md` — contesto generale. Il piano (§7, decisione confermata da Ruben) dice che **questa dashboard è l'output primario** del sistema, non un accessorio: è dove si vede lo stato reale del controllo, l'Excel resta un renderer secondario da costruire in una fase successiva.
2. `docs/reviews/fase3a_review.md` e `backend/domain/api.py` (quest'ultimo è la fonte di verità sul contratto esatto, il documento di revisione lo riassume) — l'API che questa fase deve consumare: `GET /api/domain/clients`, `POST /api/domain/scan`, `GET /api/domain/pratiche/{pratica_id}/verifiche`, `POST /api/domain/pratiche/{pratica_id}/overrides`. Non modificare questi endpoint: se ti sembra che manchi qualcosa lato API, segnalalo nel riepilogo finale invece di aggiungerlo di tua iniziativa.
3. `backend/domain/models.py` — le forme esatte di `VerificationResult`, `Evidence`, `Finding`, `PraticaRecord`, `HumanOverride` che l'API restituisce (in JSON, via la serializzazione Pydantic di default — i nomi dei campi Python sono gli stessi nel JSON).
4. `ui/src/App.tsx`, `ui/src/api.ts`, `ui/package.json` — l'app React esistente. **Leggila per intero prima di toccarla.** Note importanti: è un'unica pagina (nessuna libreria di routing, React 19 + Tailwind + Vite, niente TypeScript "any" sciolto — i tipi in `api.ts` sono presi sul serio); esiste già una funzione `pill(status)` (righe ~111-133 di `App.tsx`) che disegna il badge colorato per `✓/wip/✗/N/A` — è lo stesso vocabolario di stato usato da `VerificationResult.status`, **riusala, non reinventarla**; esiste già `SECTION_HELP` (titolo/descrizione/cosa cercare per ciascuna delle 9 sezioni A-I) — riusalo per i titoli delle sezioni nella dashboard invece di riscriverli.

## Obiettivo di questa fase

Costruire una vista nuova, **additiva**, che mostra il risultato del motore di verifica (le 9 sezioni A-I con stato, motivazione, evidenze e mancanti, più i finding aperti) consumando l'API di Fase 3a — senza toccare il flusso Excel esistente (Scansiona → Avvia → Esporta), che deve continuare a funzionare esattamente come oggi, in parallelo. L'utente deve poter passare dall'uno all'altro con un controllo semplice (due schede/tab in cima alla pagina vanno benissimo — non serve una libreria di routing per una sola vista in più).

## Cosa costruire

### 1. Client API tipizzato per il nuovo dominio

Un nuovo file, es. `ui/src/domain/api.ts`, con funzioni tipizzate per i 4 endpoint di Fase 3a, stesso pattern di `ui/src/api.ts` esistente (la funzione `j<T>`, la gestione errori con `ApiError`/`parseErrorBody` — riusa quelle utility invece di duplicarle, importale da `../api`). Definisci i tipi TypeScript per `VerificationResult`, `Evidence`, `Finding`, `PraticaRecord`, `HumanOverride` guardando `backend/domain/models.py` campo per campo — non indovinare i nomi, leggili dal codice Python.

### 2. La vista dashboard

Un nuovo componente, es. `ui/src/domain/DomainDashboard.tsx` (dividilo in sotto-componenti se diventa lungo, segui lo stile di `App.tsx` per l'organizzazione). Deve permettere di:

- **Avviare/riprendere una pratica**: un piccolo form (cliente — popolato da `GET /clients`, periodo, cartella documenti, id pratica opzionale per riprendere una pratica esistente) che chiama `POST /scan` e poi automaticamente `GET /verifiche` per mostrare il risultato. Tieni lo stato (pratica corrente, risultati) nel componente React — non serve persistenza lato client oltre alla sessione della pagina, l'API è già la fonte di verità persistente.
- **Mostrare le 9 sezioni A-I** come blocchi (uno per lettera), ciascuno con: titolo e descrizione (da `SECTION_HELP`), il badge di stato (`pill()`, riusato), la motivazione (`VerificationResult.reasoning`, testo semplice — è pensata apposta per essere leggibile senza aprire altro), l'elenco delle voci mancanti (`missing_items`), l'elenco delle evidenze trovate con il file di origine (`Evidence.source_name`, utile per rispondere subito a "da dove viene questo dato" — è la stessa filosofia di tracciabilità di `provenienza.jsonl` nel flusso Excel esistente), e le eventuali `anomalies` (oggi quasi sempre vuote, per via delle semplificazioni delle fasi precedenti — mostrale comunque se presenti, non dare per scontato che restino sempre vuote in futuro).
- **Mostrare i finding aperti** (`open_findings` nella risposta di `/verifiche`): una lista separata, non dentro le sezioni — sono carenze/anomalie che attraversano i trimestri (verifiche 11/12 del principio SA 250B, vedi `docs/analisi_obiettivi_controllo_contabile.md` §3), concettualmente diverse dallo stato della sezione corrente.
- **Registrare un override**: un modo semplice (anche solo un piccolo form con ambito voce/sezione, target, decisione ✗/N/A, nota) per chiamare `POST /overrides` e poi ricaricare `/verifiche` per vedere l'effetto. Non deve essere elegante in questa fase, deve funzionare ed essere collegato al posto giusto (es. un pulsante "Segna come saltato" vicino a una voce mancante, che pre-compila `scope: "item"` e `target` con quell'`item_id`; un analogo a livello di sezione per il caso "sezione intera saltata" come il foglio D Ferrero).

### 3. Collegare la nuova vista senza toccare il flusso esistente

In `App.tsx`, l'unica modifica ammessa è un controllo minimo (due tab, o un semplice switch) che decide se renderizzare l'albero di componenti esistente o `DomainDashboard`. Se per farlo hai bisogno della funzione `pill()` anche nel nuovo componente, estraila in un file condiviso (es. `ui/src/statusPill.tsx`) e fai in modo che sia `App.tsx` sia `DomainDashboard.tsx` la importino da lì — verifica con un diff che il comportamento visivo di `App.tsx` resti identico dopo l'estrazione (stessa funzione, stesso output, solo spostata). Lo stesso vale per `SECTION_HELP`, se ha senso condividerlo.

## Cosa NON fare

Non modificare la logica o lo stato del flusso Excel esistente (i componenti/hook che gestiscono Scansiona/Avvia/Esporta in `App.tsx`) oltre al minimo indispensabile per aggiungere il tab e le estrazioni condivise descritte sopra. Non toccare `backend/domain/api.py` né alcun file backend: se manca qualcosa lato API per completare la UI, fermati e segnalalo nel riepilogo, non aggiungerlo di tua iniziativa. Non introdurre una libreria di routing (`react-router` o simili) solo per questa vista in più. Non costruire il renderer Excel (fase successiva, separata). Non preoccuparti di rendere la UI esteticamente rifinita: funzionale, coerente con lo stile Tailwind già in uso (colori, spaziature, il pattern di `pill()`), leggibile — è la prima versione, non quella definitiva.

## Verifica richiesta

Non esiste infrastruttura di test frontend in questo progetto (controlla `ui/package.json`: nessuno script `test`) — non inventarne una complessa per questa fase. Fai come minimo: `npm run build` (compilazione TypeScript + build Vite) per intercettare errori di tipo, e riportalo nel riepilogo. Se hai modo di avviare `start.sh`/`npm run dev` e provare il flusso a mano (client demo, cartella `fixtures/docs`, uno scan e una verifica), descrivi cosa hai visto e cosa hai testato manualmente — inclusa la registrazione di un override e la sua ricomparsa nello stato aggiornato. Se non riesci a far girare l'ambiente completo da dove stai lavorando, dillo esplicitamente nel riepilogo invece di dare per scontato che funzioni.

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase3a-domain-api`, es. `redesign/fase3b-dashboard-ui`. Commit locali, niente push né PR. Nel riepilogo finale: file creati/modificati (incluso il diff esatto su `App.tsx`, per lo stesso motivo per cui l'ho chiesto per `main.py` in Fase 3a — voglio poterlo verificare a colpo d'occhio), risultato di `npm run build`, cosa hai verificato manualmente se sei riuscito a farlo girare, e ogni punto in cui il contratto API di Fase 3a ti è sembrato insufficiente per costruire una UI sensata.
