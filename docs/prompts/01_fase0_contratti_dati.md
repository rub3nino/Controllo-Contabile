# Prompt — Fase 0: contratti dati condivisi (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra**, un'app locale (FastAPI in `backend/`, React/Vite in `ui/`) che aiuta un collegio sindacale a compilare il working paper set del controllo contabile trimestrale (art. 2409-ter c.c., principio di revisione SA Italia 250B). Prima di scrivere una sola riga di codice, leggi in quest'ordine:

1. `README.md` — cosa fa l'app oggi, in breve.
2. `docs/analisi_obiettivi_controllo_contabile.md` — l'analisi degli obiettivi reali del controllo contabile secondo il principio SA 250B (12 verifiche normative) e di come si mappano sulle 9 carte A–I del template attuale. È il documento che spiega *perché* stiamo facendo questo redesign.
3. `docs/piano_azione_redesign.md` — il piano di redesign concordato con l'utente (Ruben). Contiene l'architettura a livelli (ingestion → evidence store → motore di verifica → client config → dashboard/Excel) e la divisione del lavoro tra questa sessione (tu, come "core") e Codex (che lavorerà su ingestion/renderer in fasi successive, non in questa).
4. `regole/TEMPLATE_RULES.md` — le regole di business già scritte in linguaggio naturale (in particolare il §4 "Codici di stato" e il §4.1 "Cosa comporta scrivere gli status sull'INDICE": è la logica che oggi decide se una sezione è ✓/wip/✗/N/A, e che dovrà finire dentro al motore di verifica in una fase successiva).
5. `regole/schema.yaml` — la stessa logica di TEMPLATE_RULES.md ma in formato macchina, con l'elenco delle 24 voci documento (`A.1`…`G.2`), le colonne dei blocchi trimestre, e i dati banche del cliente Ferrero (17 conti).
6. Il codice esistente: `backend/models.py` (modelli Pydantic attuali — `DocumentOut`, `ProvenanceRow`, `SectionState`, `AppState`), `backend/catalog.py` (cataloghi statici: `ITEM_LABELS`, `SECTION_TITLES`, `SECTION_ITEMS`, `DOCUMENT_NEED`, `EXTRA_HINTS`), `backend/pipeline.py` (l'`Engine` che oggi tiene tutto lo stato in memoria, singleton, non persistente), `backend/provenance.py` (il modello di tracciabilità cella→fonte, già buono, da riusare come vocabolario).

Importante: l'app oggi funziona, viene usata, e non deve smettere di funzionare. Questa fase non tocca il comportamento esistente.

## Obiettivo di questa fase (Fase 0 del piano)

Il piano di redesign prevede che il nuovo sistema sia organizzato attorno a un **motore di verifica** che risponde, per ciascuna delle aree del principio SA 250B (le 9 lettere A–I), allo stato dell'evidenza raccolta — invece che attorno alla scrittura di celle in un Excel specifico. Prima di costruire quel motore (Fase 1, lavoro futuro), serve fissare per iscritto i **contratti dati condivisi**: i modelli che faranno da interfaccia tra i moduli che verranno sviluppati in parallelo da persone/agenti diversi nelle fasi successive. Se questi contratti sono ambigui o sottodimensionati ora, il lavoro fatto sopra rischia di dover essere rifatto.

Il tuo compito in questa fase è **solo definire e validare questi contratti**, non implementare la logica che li usa. Niente motore di verifica, niente persistenza reale, niente UI, niente modifica ai renderer esistenti.

## Cosa creare

Crea un nuovo pacchetto Python, separato dal codice esistente, ad esempio `backend/domain/` (scegli tu il nome se hai una ragione migliore, ma tienilo isolato da `backend/*.py` esistenti — non modificare i file attuali). Dentro, definisci con Pydantic (stessa libreria già in uso, vedi `backend/models.py` per lo stile) questi modelli:

### 1. `Evidence` — un'evidenza raccolta da un documento

Rappresenta un singolo fatto estratto da un file e collegato a una voce di catalogo (`item_id`, es. `"E.1"`). Deve poter esprimere almeno: da quale file viene (path/nome), quale voce di catalogo soddisfa, quale dato strutturato è stato estratto (valore, tipo di dato — es. importo, data, protocollo, saldo — con un modo per rappresentare più campi per lo stesso documento, es. un F24 ha data versamento + protocollo + importo), con che metodo è stato ottenuto (filename / OCR / estrazione strutturata / umano — riusa il vocabolario già presente in `ProvenanceRow.method`), con che confidenza, e quando. Deve poter tracciare anche l'assenza: un `item_id` per cui non è stata trovata alcuna evidenza è un fatto rilevante quanto trovarne una (è la base per calcolare `wip`).

### 2. `VerificationResult` — l'esito calcolato per una sezione (A–I)

Per una pratica (cliente + periodo) e una sezione, deve contenere: lo stato finale (`✓ | wip | ✗ | N/A`, riusa il `Literal` già definito come `Status` in `backend/models.py` invece di ridefinirlo), la motivazione in linguaggio naturale (perché quello stato — deve poter spiegare "manca l'estratto conto Intesa" non solo dire `wip`), l'elenco delle `Evidence` che hanno contribuito al calcolo, l'elenco delle voci di catalogo ancora mancanti per quella sezione, ed eventuali **anomalie** trovate (non solo "manca qualcosa", ma "c'è ma non torna" — es. scostamento saldo banca/contabilità oltre soglia, F24 con importo a più decimali, versamento fuori dai tempi attesi). Tieni le anomalie come lista strutturata (tipo di anomalia + descrizione + severità), non solo testo libero, perché la dashboard (fase futura) dovrà poterle evidenziare.

### 3. `Finding` — una carenza/anomalia che deve sopravvivere al trimestre

Il principio SA 250B (punti 11 e 12, vedi `docs/analisi_obiettivi_controllo_contabile.md` §3) richiede di verificare, alla verifica successiva, che la direzione abbia sistemato le carenze procedurali e gli errori contabili segnalati in precedenza. Oggi questo non esiste: ogni pratica riparte da un master vuoto. `Finding` deve rappresentare una carenza/anomalia identificata in una pratica, con: a quale pratica/periodo appartiene, a quale sezione/verifica è collegata, descrizione, stato (aperto / sistemato / in corso), e un riferimento a quando è stata rilevata la prima volta e — se sistemata — in quale pratica successiva è stata verificata la chiusura. Deve poter collegare esplicitamente un `Finding` di un trimestre a quello (eventualmente) risolto nel trimestre dopo, così il motore di verifica di una fase futura potrà chiedere "cosa era aperto l'ultima volta, ed è stato chiuso?".

### 4. `ClientConfig` — configurazione per cliente

Deve rendere possibile, in una fase futura, onboardare un cliente diverso da Ferrero senza toccare codice. Guarda `regole/schema.yaml` e `backend/catalog.py` per capire cosa oggi è cablato uguale per tutti i clienti e che nel nuovo sistema deve poter variare per cliente: quali voci di catalogo si applicano a questo cliente (non tutti i clienti hanno l'Intrastat, i fondi previdenziali cambiano), l'anagrafica banche (co.ge, nome banca, numero conto — vedi la tabella 17 banche in `TEMPLATE_RULES.md` §7.5), eventuali libri aggiuntivi non standard (es. il caso "Collegio sindacale mancante nel foglio F" segnalato come aperto), e le soglie ancora aperte (materialità sullo scostamento bancario, soglia per "variazione significativa" nel foglio G — vedi `TEMPLATE_RULES.md` §13, punto 4). **Importante:** queste soglie sono esplicitamente indicate come non ancora decise. Nel modello rendile campi opzionali (`| None`) con un commento che dice che il default è "nessuna soglia automatica, serve intervento umano finché non viene decisa" — non inventare un numero.

Per ciascun modello, scrivi docstring che spiegano non solo il campo ma **perché esiste** — quando è rilevante, collega il campo alla verifica del principio SA 250B a cui serve (cita il numero, 1–12, come da `docs/analisi_obiettivi_controllo_contabile.md` §3), così chi lo userà in una fase successiva (compreso Codex, che non avrà letto questa conversazione) capisce il contesto solo leggendo il codice.

## Validazione: popolare un `ClientConfig` reale

Dopo aver scritto i modelli, crea un file di esempio (YAML o JSON, a tua scelta, coerente con lo stile di `regole/schema.yaml`) che popola un `ClientConfig` per il cliente Ferrero usando i dati reali già presenti in `regole/schema.yaml` e `backend/catalog.py` (le 24 voci documento, le 17 banche). Questo è il test più importante di questa fase: se per rappresentare il caso Ferrero devi tornare indietro e cambiare i modelli, fallo — è molto meglio scoprirlo ora che dopo che Codex ha già iniziato a scrivere codice che dipende da questi contratti. Aggiungi anche qualche test automatico (pytest, vedi `tests/` o `test/` esistenti per lo stile del progetto) che verifica che questo file di esempio si carichi correttamente nel modello `ClientConfig` senza errori di validazione.

## Cosa NON fare in questa fase

Non toccare `backend/main.py`, `backend/pipeline.py`, `backend/fill.py`, `backend/extract.py`, `backend/classify.py`, `backend/catalog.py`, `backend/models.py` esistenti — l'app deve continuare a partire e funzionare esattamente come oggi (verificalo lanciando `./start.sh` e controllando `GET /api/health`, prima e dopo le tue modifiche). Non modificare `regole/TEMPLATE_RULES.md` o `regole/schema.yaml`: sono la fonte di verità narrativa esistente, in questa fase si leggono, non si cambiano. Non introdurre un database vero (SQLite o altro): quello è lavoro della Fase 1, qui bastano modelli Pydantic e un file di esempio su disco. Non costruire il motore di verifica (le regole che calcolano `VerificationResult` a partire dai documenti): è la Fase 1, lavoro successivo. Non decidere tu le soglie di materialità ancora aperte.

Lavora su un branch dedicato (es. `redesign/fase0-contratti-dati`), con commit locali. Non aprire una pull request né fare push automatico: fermati e lascia il branch pronto per la revisione.

## Risultato atteso

Al termine, consegna: i modelli Pydantic in `backend/domain/` con le docstring collegate alle verifiche SA 250B; il file di esempio `ClientConfig` per Ferrero; i test che validano che si carichi correttamente; e un breve riepilogo finale in markdown (va bene anche solo nella tua risposta, non serve un file nuovo se non lo ritieni utile) che elenca: i file creati, eventuali scelte di design che hai dovuto fare e su cui vuoi un parere prima che si proceda, e ogni caso in cui il caso Ferrero ti ha costretto a un compromesso nei modelli. Non procedere alla Fase 1 (motore di verifica) senza che questa fase sia stata rivista.
