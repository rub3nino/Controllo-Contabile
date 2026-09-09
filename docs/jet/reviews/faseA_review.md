# Revisione JET Fase A — pratiche operative, parametri, ingest Excel e vista risultati

Branch: `jet/faseA-pratiche-operative` (sopra `ui/redesign-atelier`), commit `d1aa3e9` (backend) e
`d2953b9` (frontend). Nel mezzo, sul branch base, sono comparsi due commit esterni non richiesti da
questa fase (`06cd2ee`, `f59d4fb`, miglioramenti dark mode dell'UI) — non toccati da Codex, confermato
sotto.

## Verifica del codice

`git diff f59d4fb..d1aa3e9 --stat` e `git diff d1aa3e9..d2953b9 --stat`: **10 file in tutto, esattamente
quelli dichiarati** (`backend/jet/{pratica,store,api}.py`, `tests/test_jet_{pratica,store,api}.py`,
`ui/src/jet/{api.ts,JetDashboard.tsx}` nuovi; `backend/main.py` +2 righe, `ui/src/pages/JetPage.tsx`
ridotto a un wrapper di 6 righe). Nessun altro file toccato — confermato byte per byte anche su
`backend/jet/{models,ingest,criteri,sequenza}.py`, il cui contenuto letto ora coincide esattamente
(stessa dimensione, stesso timestamp) con quello letto prima che questa fase iniziasse. Nessuna
dipendenza fra `backend/jet` e `backend/domain` in nessuna direzione. Nessun uso di `backend/modules`,
`enterprise`, `core`. Nessuna dipendenza nuova (niente ORM, niente coda/worker): `store.py` usa
`sqlite3` di libreria standard.

Letto per intero il codice nuovo, non solo il diff a campione: modelli (`pratica.py`), store SQLite
con tabella riga-per-riga indicizzata su `(pratica_id, da_investigare, conto_contabile,
punteggio_totale)`, API REST con validazione della mappatura colonne (colonne inesistenti, campi JET
sconosciuti, campi obbligatori mancanti — più severa di quanto chiesto, in senso buono), invalidazione
corretta dello stato quando si cambiano parametri/file/mappatura, dashboard React a più passi con la
distinzione visiva fra flag `False` e `None` ("Alcuni non calcolabili").

Suite in ambiente pulito (`git archive` + venv nuovo, mai nella working directory): **123 passati, 0
falliti** — non i "134" dichiarati nel riepilogo. Ho verificato anche il numero di base: **119**
sull'ultimo commit prima di questa fase (coincide con quanto dichiarato per la base). La differenza
reale è quindi **+4 test**, non +15: esattamente le quattro funzioni presenti nei tre file di test
nuovi (`test_pratica_preserva_parametri_opzionali_none`,
`test_store_filtra_e_pagina_migliaia_di_righe_in_sql`,
`test_flusso_api_completo_filtri_paginazione_ed_export`, `test_analisi_richiede_tutti_i_passi`). Non
cambia la sostanza — nessuna regressione, tutto verde — ma il numero "134" nel riepilogo di Codex è
sbagliato, vale la pena dirglielo.

Il test end-to-end (`test_jet_api.py`) usa davvero `TestClient` + il fixture
`fixtures/jet/giornale_sintetico.xlsx` attraverso l'intero ciclo HTTP (crea pratica → parametri →
upload → mappatura → analizza → risultati → export), non mock: l'ho letto riga per riga ed è un test
onesto, non un giro a vuoto.

## Verifica indipendente — un problema reale trovato con un benchmark su dati sintetici a scala realistica

Non essendo disponibile qui il file Nordson reale, ho generato 100.000 e 200.000 righe sintetiche e
misurato io stesso `JetStore` direttamente (stesso codice usato dall'API), per il dubbio che avevo
segnalato prima ancora di vedere il codice: la query di export non filtrata, iterata a blocchi di
1.000 righe come fa `export_results`, con `OFFSET` crescente.

Risultati (stessa macchina, stesso venv):

| Righe | `replace_analysis` | Iterazione export completa NON filtrata (blocchi da 1.000) |
|---|---|---|
| 20.000 | 0,18 s | 1,30 s |
| 100.000 | 0,96 s | **48,76 s** |

La crescita è nettamente superlineare (5× le righe → 37× il tempo), non lineare: è l'effetto classico
di `OFFSET` su SQLite, che deve scandire e scartare tutte le righe saltate a ogni singola query — con
`ORDER BY punteggio_totale` non coperto dall'indice quando `da_investigare`/`conto_contabile` non sono
filtrati (l'indice composito aiuta solo quando quelle colonne sono vincolate). Su una pratica delle
dimensioni di Nordson (213.656 righe) l'esportazione Excel **senza filtri** — il caso d'uso più
ovvio, non un edge case — è quindi nell'ordine di alcuni minuti, non pochi secondi: il "2 ms" che
Codex riporta nel riepilogo per "query filtrata/paginata" è verosimile per **una singola pagina**
filtrata a basso offset (l'ho confermato anch'io: 0,27-0,55 s anche a offset alti su 100.000 righe per
una singola pagina), ma non copre affatto questo percorso, che è quello che l'endpoint di export
percorre sempre per intero.

La vista risultati interattiva (`/risultati`, paginazione Precedente/Successiva a 50 righe) non ha lo
stesso problema in pratica: un revisore non clicca migliaia di volte per arrivare a un `offset` alto.
Il problema è specifico e concentrato nell'endpoint di export.

## Verifica della correzione (commit `9303dfc`, sopra `d2953b9`)

`git diff d2953b9..9303dfc --stat`: **3 file, esattamente quelli dichiarati**
(`backend/jet/store.py`, `backend/jet/api.py`, `tests/test_jet_store.py`), nessun altro toccato.
Letto il diff completo: `JetStore.iter_export_results` scandisce per chiave sulla colonna `id`
(`WHERE ... AND id > ? ORDER BY id ASC LIMIT ?`, `last_id` aggiornato a ogni batch), esattamente
come richiesto — verificato anche il binding posizionale dei parametri SQL (`[*args, last_id,
batch_size]` contro clausole costruite nello stesso ordine), corretto. `export_results` ora consuma
questo iteratore invece del ciclo a `OFFSET` crescente. `/risultati` non è stato toccato, come
richiesto.

Suite in ambiente pulito: **125 test collezionati, 124 passati** (1 fallito per un modulo OCR non
installato nel mio venv minimale, estraneo a JET e non una regressione introdotta da questa
correzione). Anche qui il numero dichiarato da Codex ("136 passed") non coincide con quello reale:
119 (base) + 4 (Fase A) + 2 (questa correzione) = **125**, non 136 — stesso tipo di imprecisione già
segnalato sopra, seconda volta di fila. Non inficia la correttezza del lavoro, ma è un pattern nel
riepilogo di Codex da tenere presente: verificare sempre il conteggio reale, non fidarsi del numero
dichiarato.

Benchmark indipendente, dati sintetici generati da me (non gli stessi di Codex), correttezza e
scala insieme:

| Righe | Tempo iterazione export completa | Note |
|---|---|---|
| 20.000 | 0,055 s | |
| 100.000 | 0,284 s | coincide quasi esattamente con lo 0,278 s dichiarato da Codex |
| 213.656 (dimensione reale Nordson) | 0,600 s | tutte le righe restituite esattamente una volta, nessun buco, ordine 0..n-1 confermato |

Crescita ora lineare (5× le righe → 5,2× il tempo; poi 2,1× le righe → 2,1× il tempo), non più
quadratica. Il problema di scala è risolto, verificato sia leggendo il codice sia misurandolo io
stesso su un volume pari al cliente reale più grande già testato in Fase 1-5.

## Verdetto

**Fase A approvata.** Il flusso operativo end-to-end (pratiche, parametri con `None` preservato,
upload, mappatura, analisi, vista risultati filtrata e paginata, export Excel) funziona
correttamente anche alla scala di un cliente reale grande, verificato in modo indipendente a ogni
passo — non solo sul codice ma rieseguendo benchmark e suite di test io stesso. L'unico problema
reale trovato (paginazione dell'export) è stato corretto e riverificato.

Due note per il futuro, non bloccanti: (1) i numeri di test riportati da Codex nei riepiloghi sono
stati imprecisi due volte di fila in questa fase — vale la pena chiedergli di far girare
`pytest --collect-only` prima di dichiarare un totale; (2) restano da chiarire, quando ci sarà tempo,
lo scope creep (`backend/modules`, `enterprise`, `core`, Docker) e lo stato non ancora verificato del
redesign UI, entrambi già segnalati e invariati.

## Prossimo passo

Fase A chiusa. Pronto per il prompt della Fase B (motore di profili di estrazione per TXT a colonne
fisse), quando vuoi procedere.
