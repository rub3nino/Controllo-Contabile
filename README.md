# Quadra — Controllo contabile

Quadra aiuta a compilare il **working paper set** del controllo contabile trimestrale (art. 2409-ter c.c., principio **SA Italia 250B**).

Legge la cartella documenti del cliente, classifica i file (F24, estratti conto, mastrini, verbali, IVA…) e scrive le carte di lavoro **A–I** su un Excel che parte da `Template_MASTER.xlsx`.

![Schermata di Quadra: pratica a sinistra, panoramica e carte A–I](docs/screenshot.png)

## Cosa fa

1. Collega una cartella di documenti (da Mac o da Windows).
2. **Scansiona**: riconosce i file e li mette sulla voce della checklist.
3. **Avvia**: compila l’Excel (INDICE, richiesta documenti, fogli A–I) e tiene traccia di dove è uscito ogni dato.
4. Segnala i **mancanti** e consente di esportare il file.

Non firma, non scrive la conclusione, non decide la materialità: quello resta dell’operatore.

## Avvio in locale

Serve **Python 3.13**, **Node.js** e, per l’OCR, PaddlePaddle (vedi [docs/OCR.md](docs/OCR.md)).

```bash
chmod +x start.sh
./start.sh
```

Poi apri [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

- API: `http://127.0.0.1:8000`
- Su Windows: `start.bat`

`start.sh` crea l’ambiente `.venv-py313`, installa le dipendenze e alza API + interfaccia.

Cartella di prova (sintetica, senza dati cliente): `fixtures/docs`.

## Come si usa — ordine dei due tasti

Non invertire i passi. **Avvia** resta spento finché non hai scansionato.

| Passo | Cosa fare |
|---|---|
| 0 | Scrivi **Cliente**, scegli **trimestre/anno**, seleziona la **cartella documenti**. Spunta le sezioni A–I da fare. |
| **1 · Scansiona** | Quadra legge i file e li classifica (F24, estratti, mastrini…). Poi apri **Documenti** e correggi le voci sbagliate. |
| **2 · Avvia** | Solo dopo: compila l’Excel. |
| Fine | **Esporta Excel**. Controlla **Mancanti** e **Provenienza**. |

Formati accettati: PDF, Excel, CSV, TXT, immagini. I file di sistema (`._`, `Thumbs.db`) vengono ignorati.

## Sezioni A–I

Ogni lettera è una carta del controllo, non un codice misterioso.

| | Carta | In pratica |
|---|---|---|
| **A** | Sistema di controllo interno | Organigramma e cambiamenti di procedure |
| **B** | Libri obbligatori | Giornale, inventari, registri IVA |
| **C** | Adempimenti tributari e previdenziali | F24, LIPE, fondi, stipendi |
| **D** | Test su rilevazioni contabili | Campione sul giornale (si può saltare) |
| **E** | Disponibilità liquide | Banche, estratti, riconciliazioni |
| **F** | Verbali organi sociali | Assemblee, CdA, Collegio sindacale |
| **G** | Analisi situazione contabile | Bilancino, budget, cashflow |
| **H** | Colloqui con la Direzione | Appunti a mano |
| **I** | Operazioni particolarmente significative | Straordinarie o movimenti anomali |

Lascia spuntate le sezioni da fare. Togli la spunta solo se in quel trimestre non servono: andranno **✗** sull’INDICE.

## Stati

| Codice | Significato |
|---|---|
| **✓** | Fatto / documento trovato e usabile |
| **wip** | Manca o è ancora aperto (non è uno skip) |
| **✗** | Controllo saltato di proposito |
| **N/A** | Non esiste per questo cliente |

Documento assente = `wip`. La `✗` non significa “non l’abbiamo trovato”.

## Cosa produce

Nella cartella di output della pratica:

- Excel compilato (copia del master)
- `mancanti.md`
- `provenienza.jsonl` (cella → file di origine)

## Stack

- Backend: FastAPI (`backend/`)
- UI: React + Vite (`ui/`)
- Regole del template: [`regole/TEMPLATE_RULES.md`](regole/TEMPLATE_RULES.md) e [`regole/schema.yaml`](regole/schema.yaml)
- OCR locale: [docs/OCR.md](docs/OCR.md)
