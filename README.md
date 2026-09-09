# Quadra — Controllo contabile e Journal Entry Testing

Quadra è lo strumento interno dello studio per due lavori distinti:

1. **Controllo contabile trimestrale** (art. 2409-ter c.c., principio **SA Italia 250B**): classifica i documenti del cliente, estrae i campi, verifica le aree A–I e produce dashboard + Excel carte di lavoro.
2. **JET (Journal Entry Testing)** (ISA Italia 240 §A44): analizza il libro giornale (Excel, TXT a colonne fisse, PDF testuale), applica i criteri di rischio e esporta le righe da investigare.

Non firma, non scrive la conclusione, non decide la materialità: quello resta dell'operatore.

Piano di lavoro operativo (ordine, test, cosa non toccare): [`docs/piano_operativo.md`](docs/piano_operativo.md).

![Schermata di Quadra](docs/screenshot.png)

## Stato attuale

| Modulo | Stato | Note |
|--------|--------|------|
| JET motore + UI operativa | In uso locale | Pratiche, più file in staging, parametri, mappatura, profili TXT, PDF testuale, filtri, export |
| JET PDF scansionato (OCR) | In pausa | Serve conferma umana campo per campo; non mescolare col JET tabellare |
| Controllo SA 250B | Funzionante in locale | Dashboard + export A–I; generalizzazione oltre il pilota ancora aperta |
| Consentil (cyber) | Fuori da questo repo | Si riprende dopo Quadra stabile |
| Produzione / Vercel | Non supportato | Vercel non va: serve processo Python, upload grandi, disco. Locale o VPS+Docker |

## Cosa fa

**Controllo**

1. Classifica i documenti (F24, estratti conto, verbali, libri…)
2. Estrae date, importi, saldi, protocolli
3. Calcola lo stato delle sezioni A–I con evidenze e fonti
4. Export Excel compatibile col template A–I
5. Traccia ogni dato al documento di origine

**JET**

1. Crea una pratica (cliente + periodo)
2. Carica una o più fonti (xlsx / txt / pdf testuale), con tracciabilità e deduplica configurabile
3. Mappa le colonne o applica un profilo a larghezza fissa (TXT)
4. Imposta i parametri cliente; se un parametro manca il criterio è **non calcolabile** (`None`), mai un falso «ok»
5. Valuta i criteri (importo, weekend, festività, orario, backdating, staff, parti correlate, descrizione, rarità conto, infragruppo, sequenza)
6. Filtra, pagina ed esporta Excel

## Avvio in locale

Serve **Python 3.13**, **Node.js**. Per l'OCR del controllo, PaddlePaddle: [`docs/OCR.md`](docs/OCR.md).

```bash
chmod +x start.sh
./start.sh
```

- UI: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- OpenAPI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Windows: `start.bat`

`start.sh` crea `.venv-py313`, installa le dipendenze e alza API + Vite.

```bash
# Solo API
.venv-py313/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Solo UI
cd ui && npm run dev
```

Prove senza dati cliente: `fixtures/docs` (controllo), `fixtures/jet` (JET).

## Architettura

```
UI (React + Vite)  —  Controllo + JET
        │
API FastAPI  —  /api/domain/*  /api/jet/*  /api/*
        │
┌───────────────┬─────────────────┬──────────────────┐
│ Domain SA 250B│ JET (backend/jet)│ Pipeline legacy  │
│ verify/export │ criteri, ingest │ classify/extract │
└───────────────┴─────────────────┴──────────────────┘
        │
Evidence store (controllo)     JetStore SQLite (pratiche JET)
```

Il JET **operativo** è `backend/jet/` (isolato da `backend/domain/`).  
`backend/modules/jet/` è un prototipo precedente: non usarlo per le pratiche.

Sotto `backend/core/` e `backend/enterprise/` c'è lo scaffolding (auth, tenant, Redis) per un eventuale deploy multi-utente: **non è il percorso di lavoro attuale**.

## API JET (sintesi)

```
POST /api/jet/pratiche
GET  /api/jet/pratiche
PUT  /api/jet/pratiche/{id}/parametri
POST /api/jet/pratiche/{id}/files          # staging multi-file
PUT  /api/jet/pratiche/{id}/mappatura
POST /api/jet/pratiche/{id}/analizza
GET  /api/jet/pratiche/{id}/risultati
GET  /api/jet/pratiche/{id}/export.xlsx
```

Dettaglio in `/docs` a runtime.

## Clienti controllo

Config in `backend/domain/clients/*.yaml`:

| Cliente | File | Note |
|---------|------|------|
| Ferrero | `ferrero.yaml` | Riferimento |
| SWGI | `swgi.yaml` | Secondo cliente |
| Demo | `demo.yaml` | Test |

Nuovo cliente: YAML con banche, fondi, soglie e voci catalogo.

## Sezioni A–I e stati

| | Carta | Verifiche SA 250B |
|---|---|---|
| **A** | Sistema di controllo interno | Organizzazione, procedure |
| **B** | Libri obbligatori | 3, 5, 6, 7 |
| **C** | Adempimenti tributari/previdenziali | 8 |
| **D** | Test rilevazioni / JET | Campione sul giornale |
| **E** | Disponibilità liquide | Banche vs co.ge. |
| **F** | Verbali | 7 |
| **G** | Situazione contabile | 10 |
| **H** | Colloqui Direzione | 9 |
| **I** | Operazioni significative | Giudizio |

| Codice | Significato |
|---|---|
| **✓** | Superata / documento usabile |
| **wip** | Manca evidenza |
| **✗** | Saltato di proposito |
| **N/A** | Non applicabile al cliente |

## Deploy

Non usare Vercel per API+JET+OCR.

- **Primi test:** questo Mac, `./start.sh` (anche in LAN se l'IT lo consente).
- **Studio / URL interno:** VPS EU + Docker (`docker-compose.yml` / `docker-compose.prod.yml`). Primo giro **senza** OCR pesante.
- Dati cliente e file JET reali: solo disco locale o server dello studio. Non finiscono in git (`data/`, `test/`, `storage/` sono ignorati).

Copia `.env.example` in `.env` per Postgres/Redis/MinIO quando usi Compose.

## Test

```bash
.venv-py313/bin/python -m pytest tests/ -q
.venv-py313/bin/python -m pytest tests/test_jet*.py tests/modules/jet/ -q
.venv-py313/bin/python -m pytest tests/test_domain_*.py -q
```

## Stack

- Backend: FastAPI, Python 3.13
- UI: React + Vite + TypeScript
- JET persistenza: SQLite sotto `storage/`
- OCR controllo: PaddleOCR (locale)
- Opzionale: PostgreSQL, Redis, MinIO (Compose)

## Documentazione

- [Piano operativo](docs/piano_operativo.md) — ordine JET → controllo → OCR → Consentil
- [Obiettivi SA 250B](docs/analisi_obiettivi_controllo_contabile.md)
- [Riferimento tecnico JET](docs/jet/00_riferimento_tecnico.md)
- [OCR](docs/OCR.md)
- [Prompts e review](docs/prompts/)
- [Architettura enterprise (futuro)](docs/architecture/ENTERPRISE_ARCHITECTURE.md)
