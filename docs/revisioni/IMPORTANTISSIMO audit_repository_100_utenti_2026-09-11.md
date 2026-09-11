# Audit tecnico di Quadra per 100 utenti contemporanei

Data dell'analisi: 11 settembre 2026  
Perimetro: repository applicativa completa (`backend`, `ui`, test, Docker, script, configurazioni e documentazione).  
Obiettivo: valutare se Quadra sia pronto per essere affidato a circa 100 persone che possono operare nello stesso intervallo temporale.

## Verdetto esecutivo

**Prontezza attuale per produzione multiutente: 34/100 — non rilasciabile oggi a 100 utenti.**

Il prodotto è molto più maturo come prototipo funzionale locale che come sistema multiutente. Il nucleo JET e una parte del controllo SA 250B sono ben testati; tuttavia autenticazione, autorizzazione, isolamento tenant, database PostgreSQL, object storage, code asincrone, audit persistente e osservabilità non sono collegati ai flussi operativi. In più, il flusso legacy del controllo usa un singolo oggetto globale condiviso dall'intero processo. Due utenti possono quindi sovrascriversi pratica, documenti, avanzamento ed export.

Non è un problema risolvibile aumentando CPU o RAM: prima serve trasformare il modello di esecuzione e persistenza. Lo stack “enterprise” presente è una buona base progettuale, non una capacità già disponibile.

### Doppio punteggio da non confondere

| Dimensione | Score | Lettura |
|---|---:|---|
| Qualità del prototipo locale e logica funzionale | **72/100** | Buona base, test automatici ampi sul dominio e sul JET |
| Prontezza per 100 utenti concorrenti | **34/100** | Bloccata da sicurezza, isolamento, persistenza e deploy |
| Prontezza per dati contabili reali regolamentati | **29/100** | Mancano controlli di accesso e audit affidabile |

## Evidenze verificate

- Repository: circa **36.493 righe** in 535 file sotto backend, UI e test.
- Test Python: **200 superati**, nessun fallimento; copertura complessiva **54%**.
- Copertura alta nel cuore JET (`criteri` 98%, `store` 96%, modelli 100%) e nel dominio nuovo; **0%** nei moduli enterprise, auth, tenant, Redis, database e security.
- Build UI TypeScript/Vite: superata; bundle principale circa **294 KB** non compresso / **87 KB gzip**.
- Lint Python: **350 rilievi Ruff** (molti stilistici, alcuni tecnici).
- Lint UI: dichiarato ma non eseguito nell'installazione corrente (`eslint: command not found`).
- Test con coverage: **694 warning**, inclusi numerosi `ResourceWarning` per connessioni SQLite non chiuse.
- Compose sviluppo: sintatticamente valido.
- Compose produzione: **non valido**, perché combina `container_name` con `deploy.replicas`.
- Nessuna pipeline CI/CD, nessun test di carico, nessun test browser E2E, nessun test di sicurezza/isolamento trovato.
- Il worker Celery dichiara `backend.tasks`, modulo non presente.

## Matrice di scoring per ruolo

| Ruolo | Score | Giudizio sintetico |
|---|---:|---|
| Software / Solutions Architect | **38/100** | Buona separazione concettuale, runtime ancora monolitico e stateful |
| DevOps / Cloud Engineer | **25/100** | Container presenti, produzione non validabile e assenza CI/observability |
| Database Administrator / Architect | **31/100** | Schema PostgreSQL futuro sensato, runtime ancora SQLite/JSON senza tenant |
| Backend Developer Senior | **54/100** | Dominio ben modellato, concorrenza e job pesanti non pronti |
| Frontend Developer | **66/100** | UI moderna, build valida e risultati paginati; manca robustezza enterprise |
| Cybersecurity Specialist | **14/100** | Endpoint operativi pubblici, CORS aperto, nessun RBAC/audit persistente |
| SME / Consulente Contabile | **69/100** | Buona prudenza metodologica e tracciabilità, validazione normativa incompleta |
| Product Owner / Project Manager | **55/100** | Visione e documentazione buone, debito “produzione” sottostimato |
| QA / Test Automation Engineer | **49/100** | Ottimi test funzionali, nessuna prova delle caratteristiche non funzionali |

Media semplice dei ruoli: **45/100**. Lo score di readiness è più basso (**34/100**) perché sicurezza e isolamento sono gate: non possono essere compensati dalla qualità della UI o dai test di calcolo.

## 1. Software / Solutions Architect — 38/100

### Cose buone

- Separazione leggibile tra `domain`, JET operativo e pipeline legacy.
- Modelli Pydantic e contratti espliciti riducono ambiguità.
- Risultati JET paginati lato database; export iterativo invece di restituire tutto al browser.
- Sono già abbozzate astrazioni per PostgreSQL, Redis, storage S3/MinIO, tenant e auth.

### Rischi critici

1. **Stato globale condiviso nel controllo legacy.** `backend.main` importa un unico `engine`, e tutti gli endpoint leggono/scrivono `engine.state`. Non esiste una chiave utente o pratica nella sessione. Impatto: contaminazione tra clienti, risultati errati, possibile divulgazione di documenti/export. Probabilità molto alta appena ci sono due utenti sullo stesso worker.
2. **Lo scaling orizzontale peggiora la coerenza.** Con quattro worker Uvicorn o due repliche API ogni processo ha uno stato diverso; una richiesta può arrivare a un processo che non conosce la pratica creata dal precedente.
3. **Due architetture parallele.** Il runtime reale non usa lo stack enterprise. Questo aumenta il costo di manutenzione e crea falsa sicurezza operativa.
4. **Elaborazioni CPU/I/O sincrone nelle request.** Lettura Excel/PDF, OCR, analisi ed export occupano i worker web. Cento utenti che avviano operazioni pesanti possono saturare rapidamente processo, memoria e disco.

### Miglioramento richiesto

Adottare una sola architettura target: API stateless, pratica identificata esplicitamente, metadati e risultati in PostgreSQL, documenti in object storage, job lunghi in coda, stato job in Redis/PostgreSQL. Deprecare o rifattorizzare il singleton legacy. Impatto: **molto alto**, prerequisito per ogni forma di scalabilità.

## 2. DevOps / Cloud Engineer — 25/100

### Cose buone

- Dockerfile multi-stage e utente non-root.
- Health check di base, limiti di memoria dichiarati, PostgreSQL/Redis/MinIO previsti.
- Script di backup e restore presenti.

### Rischi critici

- `docker-compose.prod.yml` fallisce la validazione: repliche e `container_name` sono incompatibili.
- Le immagini produzione sono riferimenti a un registry, ma non esiste workflow che le costruisca, testi e pubblichi.
- Il worker non parte perché manca `backend.tasks`.
- Il health check verifica solo che `/api/health` risponda, non PostgreSQL, Redis, storage o coda.
- `latest` per MinIO e default non bloccati nelle dipendenze Python rendono i build non riproducibili.
- Backup locali non cifrati, nessuna copia off-site/immutabile, nessun test automatico di restore, nessun RPO/RTO.
- Nessuna metrica, tracing, alerting, SLO, centralizzazione log o gestione errori.
- Nessun autoscaling effettivo: `deploy.replicas` non equivale a autoscaling ed è ignorato in molte modalità Compose.

### Miglioramento richiesto

Prima release: pipeline CI con test/lint/build/security scan, immagini versionate, staging identico a produzione, migrazioni automatizzate con rollback, metriche RED (rate/error/duration), code depth, alert e backup cifrato verificato. Per 100 utenti non serve necessariamente Kubernetes: due API stateless dietro load balancer più worker scalabili e servizi gestiti possono bastare. Impatto: **alto** su affidabilità e tempi di recupero.

## 3. Database Administrator / Architect — 31/100

### Cose buone

- Lo schema PostgreSQL futuro contiene tenant, utenti, pratiche, documenti, verifiche e indici ragionevoli.
- È prevista RLS e il JET SQLite dispone di indici per pratica e filtri.
- Le scritture SQLite usano transazioni contestuali e query parametrizzate nella parte operativa.

### Rischi critici

- JET e dominio operativi usano file SQLite distinti e payload JSON. SQLite ammette un solo writer alla volta: analisi concorrenti possono produrre lock e latenza.
- Il modello operativo non include `tenant_id`, ownership, foreign key effettive o vincoli di autorizzazione.
- Lo schema PostgreSQL iniziale non rappresenta le tabelle JET realmente usate; non esiste migrazione dal runtime SQLite.
- Nessuna configurazione WAL/busy timeout esplicita; i warning mostrano connessioni SQLite non sempre chiuse tempestivamente.
- La funzione RLS costruisce un comando SQL via interpolazione di stringa. Anche se il tenant dovrebbe essere interno, va sostituita con esecuzione parametrica/`set_config` e transaction-local context.
- Mancano Alembic revision, prove di migrazione, retention e partitioning/audit strategy.

### Miglioramento richiesto

Disegnare lo schema PostgreSQL canonico partendo dagli aggregate realmente usati, con `tenant_id` e ownership su ogni tabella, FK, indici basati su query reali, optimistic locking/versione della pratica e transazioni idempotenti per l'analisi. Misurare `EXPLAIN ANALYZE` su dataset realistici. Impatto: **molto alto** su integrità e concorrenza.

## 4. Backend Developer Senior — 54/100

### Cose buone

- Codice generalmente leggibile, contratti tipizzati e responsabilità abbastanza separate.
- Uso di `Decimal` per importi contabili.
- Il motore distingue correttamente criterio falso da criterio non calcolabile.
- Deduplica, fonti multiple, staging, sequenze, filtri e paginazione sono coperti da test.
- Path e nomi file sono in più punti normalizzati e controllati.

### Rischi critici

- Tutti gli endpoint operativi sono privi di dependency di autenticazione/autorizzazione.
- Gli upload vengono letti interamente in RAM senza limite di dimensione o quota. Cento upload grandi possono esaurire memoria/disco.
- Le funzioni `async` chiamano poi lavoro sincrono CPU/I/O intenso, bloccando l'event loop.
- Analisi ed export non sono job idempotenti con stato, retry, cancellation e timeout.
- Le pratiche sono enumerabili tramite endpoint lista globale e accessibili conoscendo l'ID.
- Il vecchio modulo `backend/modules/jet` resta nel prodotto pur non essendo operativo, aumentando superficie e confusione.
- 350 rilievi Ruff e nessun quality gate automatico.

### Miglioramento richiesto

Applicare auth/RBAC a router interi; introdurre service/repository layer tenant-aware; streaming upload con limiti e scansione MIME/malware; spostare OCR/JET/export su worker; aggiungere idempotency key e versionamento; eliminare o archiviare il JET obsoleto. Impatto: **molto alto**.

## 5. Frontend Developer — 66/100

### Cose buone

- React/TypeScript moderno, build riuscita e bundle ragionevole.
- La tabella JET usa paginazione server-side a 50 righe, scelta corretta per grandi libri giornale.
- UX articolata per fonti, mapping, parametri e risultati; stato connessione presente.
- Separazione API per dominio e JET.

### Rischi e lacune

- Nessun flusso login, session expiry, ruoli, tenant o schermata “accesso negato”.
- Nessun test componente/E2E/accessibilità o budget prestazionale.
- Gestione job lunghi basata sui pattern attuali, senza coda persistente e riconnessione robusta.
- Upload senza feedback su quota, dimensione massima, checksum/resume o scansione.
- Il lint non è riproducibile nell'ambiente installato, segno di drift tra package manifest e installazione/lock.
- Alcuni polling via `setInterval` sono duplicati; a 100 client non è grave da solo, ma va centralizzato e sospeso quando la tab non è visibile.

### Miglioramento richiesto

Integrare identity e permessi nella navigazione, job status persistente con retry/cancel, error boundary, test Playwright dei flussi critici, accessibilità WCAG 2.1 AA e telemetry frontend. Impatto: **medio-alto**.

## 6. Cybersecurity Specialist — 14/100

### Blocchi al go-live

1. **Nessuna autenticazione applicata.** Le implementazioni Entra/JWT esistono ma non sono montate in `main.py` né richieste dai router.
2. **Nessuna autorizzazione/ownership.** Chiunque raggiunga l'API può elencare pratiche, leggere risultati, cambiare parametri, cancellare fonti ed esportare dati.
3. **Nessun isolamento tenant.** I database operativi non hanno tenant; la RLS PostgreSQL non protegge i dati effettivamente usati.
4. **CORS wildcard.** Origini, metodi e header sono tutti aperti.
5. **Audit non affidabile.** Il logger enterprise scrive solo su stdout, non è collegato agli endpoint e la query restituisce sempre lista vuota. Non è immutabile né probatorio.
6. **Accesso a cartelle server.** Gli endpoint `ingest-link`/`domain/scan` permettono di indicare percorsi sotto radici ampie; senza auth possono esporre metadati e processare file del server.
7. **Assenza di limiti.** Nessuna quota per tenant, upload, job concorrenti o rate limiting effettivamente applicato.

### Altri rischi

- CSP preparata ma non montata e contiene comunque `unsafe-inline`/`unsafe-eval`.
- Secret di default deboli nei file di esempio/dev; manca fail-fast in produzione se un segreto è vuoto o predefinito.
- Nessuna evidenza di encryption at rest/KMS, rotation, antivirus, DLP, vulnerability scanning o SBOM.
- Nessuna privacy policy tecnica: retention, cancellazione, data residency, DPIA, registro trattamenti, gestione data breach e diritti GDPR.

### Miglioramento richiesto

Il rilascio deve essere bloccato finché non esistono SSO/MFA, RBAC deny-by-default, tenant isolation testata, audit append-only/WORM, TLS end-to-end, cifratura at rest, secrets manager, limiti e scansione upload, DPIA/retention e penetration test. Impatto: **critico**; rischio di data breach e non conformità.

## 7. SME / Consulente Contabile — 69/100

### Cose buone

- Il README delimita correttamente il ruolo del software: non firma, non conclude e non decide la materialità al posto del professionista.
- Il JET è collegato a ISA Italia 240 e il controllo a SA Italia 250B.
- Provenienza dei dati, evidenze, override umani motivati e continuità dei finding sono concetti corretti.
- Le regole non trasformano dati mancanti in esiti rassicuranti; è una scelta prudente e importante.

### Rischi di dominio

- Le configurazioni cliente YAML sono codice/regola di fatto, ma non hanno workflow formale di approvazione, versione efficace, maker-checker e firma/hash della versione usata nell'elaborazione.
- Non è presente una matrice completa requisito normativo → regola → test → evidenza → output approvata dallo SME.
- Gli override possono essere creati senza identità autenticata; `decided_by` è input del client e quindi non probatorio.
- La logica è testata soprattutto con fixture sintetiche e pochi clienti; manca validazione su popolazioni reali, edge case fiscali e golden dataset approvati.
- Non emerge un workflow di review a quattro occhi, chiusura pratica, congelamento e riapertura controllata.

### Miglioramento richiesto

Costruire un rulebook versionato e approvato, dataset “golden” anonimizzati, doppia revisione, evidenza della versione algoritmo/configurazione, riconciliazioni di completezza e procedure di eccezione. Impatto: **alto** sulla difendibilità professionale.

## 8. Product Owner / Project Manager — 55/100

### Cose buone

- Documentazione ricca, roadmap per fasi e review storiche.
- Confini di prodotto e moduli principali sono esplicitati.
- Buona attenzione agli errori comprensibili dall'utente.

### Rischi gestionali

- La documentazione presenta un deploy futuro come se parte dell'infrastruttura fosse pronta, ma il runtime non è integrato e il Compose produzione non valida.
- “100 utenti” non è definito come profilo di carico: utenti loggati, consultazione, upload contemporanei, OCR o analisi JET sono scenari radicalmente diversi.
- Mancano SLO/SLA, RPO/RTO, volumi massimi per file/pratica, retention, matrice ruoli e criteri di accettazione non funzionali.
- Il doppio percorso legacy/domain e il prototipo JET precedente generano debito e priorità ambigue.

### Miglioramento richiesto

Definire un MVP di produzione con gate misurabili: sicurezza, isolamento, capacità, recovery, correttezza contabile e supporto. Congelare nuove feature finché i P0 non sono chiusi. Impatto: **alto** sulla prevedibilità della release.

## 9. QA / Test Automation Engineer — 49/100

### Cose buone

- 200 test veloci e deterministici passano in pochi secondi.
- Copertura eccellente nei modelli e nei criteri JET e buona nel nuovo dominio.
- Esistono test API end-to-end a livello FastAPI, multifile, PDF/TXT, deduplica e crescita quasi lineare dell'export.

### Lacune bloccanti

- Nessun load/stress/soak test con 100+ utenti.
- Nessun test di race condition: doppia analisi, update concorrente, upload e cancellazione simultanei.
- Nessun test multi-tenant/IDOR/RBAC, perché tali controlli non sono collegati.
- Moduli enterprise e core infrastrutturali allo 0% di coverage.
- Nessun test su PostgreSQL/Redis/MinIO/Celery reali, failover, retry, restart durante job o restore backup.
- Nessun E2E browser e nessun test di accessibilità.
- Copertura totale 54%; pipeline legacy 27%, main 44%, extract 53%.
- Numerosi warning di connessioni SQLite non chiuse.

### Piano di prova minimo per 100 utenti

Definire tre workload separati:

1. **Navigazione:** 100 utenti, 10–20 richieste/minuto, p95 API < 500 ms, errori < 1%.
2. **Operatività mista:** 100 sessioni, 20 upload concorrenti e 10 analisi contemporanee; nessun dato incrociato, nessun job perso.
3. **Picco pesante:** 25 analisi JET/OCR concorrenti su file al percentile 95; coda stabile, web responsivo, memoria entro limite.

Eseguire test di soak per 4–8 ore, fault injection su worker/Redis/PostgreSQL e verifica dei risultati contabili tramite checksum/golden output. I numeri finali di latenza e capacità possono essere dichiarati solo dopo queste prove.

## Registro rischi prioritario

| ID | Rischio | Probabilità | Impatto | Priorità |
|---|---|---:|---:|---:|
| R1 | Stato globale mescola pratiche di utenti diversi | Alta | Critico | P0 |
| R2 | API senza autenticazione e autorizzazione | Certa se esposta | Critico | P0 |
| R3 | Nessun isolamento tenant/ownership | Alta | Critico | P0 |
| R4 | Deploy produzione non valido e worker inesistente | Certa | Critico | P0 |
| R5 | SQLite conteso con scritture concorrenti | Alta | Alto | P0 |
| R6 | Job pesanti bloccano i worker web | Alta | Alto | P0 |
| R7 | Upload illimitati consumano RAM/disco | Alta | Alto | P0 |
| R8 | Audit non persistente/non immutabile | Certa | Alto | P0 |
| R9 | Backup non cifrato e restore non provato | Media | Alto | P1 |
| R10 | Regole contabili senza approval/version workflow | Media | Alto | P1 |
| R11 | Assenza osservabilità e alert | Alta | Medio-alto | P1 |
| R12 | Assenza load/security/E2E test | Certa | Alto | P1 |

## Roadmap consigliata

### Fase 0 — Stop/governance (1 settimana)

- Vietare esposizione Internet e uso simultaneo su dati reali nella forma attuale.
- Definire workload, volumi, ruoli, tenant, SLA/SLO, RPO/RTO e classificazione dati.
- Scegliere un solo percorso architetturale canonico.

### Fase 1 — Fondazioni P0 (3–5 settimane)

- Rimuovere lo stato globale; API stateless e stato per pratica persistente.
- Portare JET e dominio su PostgreSQL tenant-aware con migrazioni.
- Integrare Entra ID/MFA, RBAC e ownership su tutti i router.
- Object storage con namespace tenant e cifratura.
- Worker reale per JET/OCR/export con job status, retry e idempotenza.
- Limiti upload, quota, MIME validation e malware scan.
- Audit append-only collegato a tutte le azioni sensibili.

### Fase 2 — Operabilità (2–3 settimane)

- Correggere immagini/Compose o IaC cloud, rimuovere `container_name`, versionare immagini.
- CI/CD con unit, integration, E2E, lint, dependency/container scan e migrazioni.
- Logging strutturato, correlation ID, metriche, dashboard, alert.
- Backup cifrato off-site e restore drill.

### Fase 3 — Dimostrazione dei 100 utenti (2 settimane)

- Test di carico progressivi 25/50/100/150 utenti con dataset realistici.
- Tuning pool DB, numero API worker e concorrenza worker sulla base delle misure.
- Soak, chaos/failure test e verifica isolamento dati.
- Penetration test e remediation.

### Fase 4 — Validazione contabile e rilascio controllato (2–4 settimane)

- Golden dataset approvato dallo SME e regressione degli output.
- Workflow maker-checker, chiusura/riapertura e versionamento regole.
- Pilota 10 utenti, poi 25, 50 e 100 con feature flag e rollback.

Stima indicativa: **8–14 settimane** con un team minimo composto da senior backend/architect, DevOps, frontend, QA automation e security part-time, oltre allo SME. Non è una promessa temporale: dipende soprattutto dalla profondità richiesta per GDPR, SSO e migrazione dati.

## Criteri minimi di go-live

Il prodotto può essere dichiarato pronto solo se tutti questi gate sono verdi:

- Nessuna request operativa anonima; matrice RBAC testata.
- Test automatici dimostrano che un tenant non può leggere/modificare dati di un altro.
- Nessuno stato di pratica vive solo nella memoria del processo API.
- Database PostgreSQL e object storage sono il percorso reale, non scaffolding.
- Job pesanti passano dalla coda e sopravvivono al restart di un worker.
- Audit persistente e non alterabile per login, upload, modifica regole/override, analisi, export e cancellazione.
- Compose/IaC e worker partono in staging da zero; migrazioni e rollback provati.
- Backup cifrato ripristinato con successo entro l'RTO.
- Test da 100 utenti soddisfa SLO concordati senza errori contabili o contaminazione.
- Security review, DPIA/retention e validazione SME formalmente approvate.

## Conclusione

Quadra è una **buona base funzionale, non ancora un gestionale multiutente**. La parte più preziosa è il lavoro già fatto sui contratti di dominio, sulle regole prudenti, sulla paginazione e sui test JET. La parte più urgente non è aggiungere feature: è collegare davvero persistenza, identità, tenant, job e audit al prodotto operativo.

Con i P0 risolti, l'obiettivo di 100 persone è tecnicamente realistico e non richiede necessariamente infrastruttura enorme. Senza quei P0, anche 5–10 utenti contemporanei possono causare contaminazione dei dati, lock o risultati incoerenti; per questo il giudizio attuale resta **no-go per produzione multiutente**.
