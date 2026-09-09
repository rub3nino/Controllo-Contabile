# Prompt — Fase 9: esporre in UI i campi granulari estratti (Fase 5/6) (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). Le Fasi 5 e 6 hanno aggiunto l'estrazione di campi strutturati da 7 tipi di documento (E.1: importo/data_versamento/protocollo F24; F.1: saldo_ec; B.4/D.1: ultimo_numero_registrazione/data_ultimo_verbale/ultima_pagina; C.1/C.2/C.4: data_verbale) — popolati in `Evidence.fields: list[ExtractedField]` e già verificati contro documenti reali in entrambe le revisioni. **Questi dati esistono già in ogni evidenza calcolata, attraversano già l'intera catena, e nessuna interfaccia li mostra.** Questa fase non estrae nulla di nuovo: rende visibile ciò che già c'è.

Prima di scrivere codice, leggi in ordine:

1. `backend/domain/models.py` — la classe `ExtractedField` (`kind: str`, `value: str`, `unit: str | None`) e il campo `Evidence.fields`.
2. `ui/src/domain/api.ts` — nota che il tipo TypeScript `Evidence` **ha già** `fields: ExtractedField[]` (righe 6-11): il contratto è già corretto, non serve toccare questo file.
3. `backend/domain/api.py`, endpoint `GET /pratiche/{id}/verifiche` (righe ~104-124): restituisce `VerificationResult` (che contiene `evidence: list[Evidence]`) come oggetto Pydantic diretto, senza serializzazione manuale — `fields` arriva già intatto nella risposta HTTP. Non serve toccare questo file.
4. `ui/src/domain/DomainDashboard.tsx`, blocco "Evidenze trovate" (circa riga 140-142): oggi mostra solo `evidence.item_id` e `evidence.source_name`, ignorando `evidence.fields`. **Questo è il punto centrale della fase.**
5. `backend/domain/excel_renderer.py`, funzione `_fill_domain_sources` (righe ~82-108): nel foglio "DOMINIO" generato per ogni pratica, le righe di tipo "Evidenza" mostrano `source_name`/`source_path`/`excerpt` in colonna F ma non i campi estratti. **Secondo punto della fase, più piccolo.**
6. Guarda come il dashboard già formatta un `kind` testuale altrove: `finding.kind.replaceAll("_", " ")` (dentro lo stesso `DomainDashboard.tsx`, sezione "Finding aperti") — riusa esattamente questo stile per mostrare `evidence.fields[].kind`, non inventarne uno nuovo.

## Cosa costruire

### 1. Dashboard (`ui/src/domain/DomainDashboard.tsx`) — priorità principale

Nel blocco "Evidenze trovate", per ogni evidenza con `fields.length > 0`, mostra i campi estratti sotto il nome della fonte già presente. Per ogni campo: `kind` con underscore sostituiti da spazio (stesso stile di `finding.kind.replaceAll("_", " ")`), seguito da `value`, seguito da `unit` solo se non nullo (es. "importo: 35616.68 EUR", "data versamento: 16/04/2026"). Nessuna riformattazione di numeri o date: `value` va mostrato esattamente come arriva dal backend, la normalizzazione non è compito di questa fase. Quando `fields` è vuoto (la maggior parte delle voci, che non hanno ancora estrazione — es. A.1, B.1, G.1) non mostrare nulla in più: il comportamento attuale per quelle evidenze non cambia. Mantieni lo stile visivo esistente del file (classi Tailwind già in uso in quel blocco, stessa gerarchia dimensionale del testo — i campi sono un dettaglio secondario rispetto a `source_name`, non devono competere visivamente con esso).

### 2. Renderer Excel (`backend/domain/excel_renderer.py`) — priorità secondaria

Nella funzione `_fill_domain_sources`, per le righe di tipo "Evidenza" (righe ~95-98), se `evidence.fields` non è vuoto aggiungi i campi estratti al contenuto della colonna F ("Percorso / dettaglio"), che oggi contiene `evidence.source_path or evidence.excerpt`. Non aggiungere una colonna nuova alla tabella (romperebe `widths`/`headers`/i test esistenti che contano le colonne): appendi i campi come testo leggibile alla fine del contenuto già presente in quella cella, con lo stesso stile "kind: value unit" della dashboard, separati da un delimitatore chiaro (es. " · " o a capo con `\n`, la cella ha già `wrap_text=True`).

## Cosa NON fare

Non toccare `backend/domain/models.py`, `backend/domain/api.py`, `ui/src/domain/api.ts`, `backend/domain/ingest_adapter.py`, `backend/domain/verification_engine.py`: il contratto dati e il flusso di estrazione sono già corretti e già verificati, questa fase è solo di presentazione. Non toccare `App.tsx` né il flusso Excel legacy (`ui/src/api.ts`, `ui/src/sectionHelp.ts`, `ui/src/statusPill.tsx`) — è un file diverso, fuori scope. **Non installare un framework di test frontend** (vitest, @testing-library/react, playwright, o simili): il progetto oggi non ne ha uno (`ui/package.json` ha solo `dev`/`build`), ed è una decisione più grande da valutare a parte, non necessaria per una fase di questa portata — vedi "Test richiesti" sotto per cosa uso invece. Non inventare una tabella di traduzione "kind → etichetta italiana leggibile" tipo `ITEM_LABELS`: usa la stessa sostituzione underscore→spazio già in uso altrove nel file, niente di più elaborato.

## Test richiesti

Per la dashboard React, non essendoci un framework di test JS in questo progetto, la verifica è: `npm run build` (in `ui/`) deve completare senza errori di tipo — è già il bar usato per verificare le fasi precedenti del frontend in questo redesign. Nel riepilogo finale, includi anche l'output testuale reale di uno scan (via `POST /api/domain/scan` + `GET /verifiche` su una pratica Ferrero o SWGI, quelle già usate nelle fasi precedenti) per almeno due voci con campi popolati (es. una E.1 e una F.1), mostrando esattamente cosa apparirebbe nel blocco "Evidenze trovate" — così posso verificare il rendering senza dover aprire io stesso il browser.

Per `excel_renderer.py`, aggiungi un test in `tests/test_domain_excel_renderer.py` (guarda lo stile dei test già presenti in quel file, non reinventarne uno nuovo) che costruisce una `Evidence` con `fields` popolati, la fa rendere nel foglio DOMINIO, e verifica che il testo dei campi compaia nella cella di colonna F della riga corrispondente. Rilancia **tutta** la suite `tests/` — deve coincidere con la Fase 8 (77 test) più i test nuovi, nessuna regressione.

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase8-fix-classificazione-b4-d1`, es. `redesign/fase9-esposizione-campi-ui`. Commit locali, niente push né PR. Nel riepilogo finale: il diff esatto sui due file toccati, l'output di `npm run build`, il risultato di tutta la suite pytest, l'esempio testuale di rendering per almeno due evidenze reali con campi (come richiesto sopra), e — se durante l'implementazione ti accorgi che alcuni valori estratti sono poco leggibili così come sono (es. un formato data o numero che sul dashboard risulta confuso) — segnalalo nel riepilogo invece di normalizzarlo qui: è lo stesso principio di disciplina di scope delle fasi precedenti, la normalizzazione è una decisione a parte.
