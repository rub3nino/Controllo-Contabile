# Obiettivi del controllo contabile trimestrale e ruolo di Quadra

Analisi basata sul codice e la documentazione di Quadra (`README.md`, `regole/TEMPLATE_RULES.md`, `regole/schema.yaml`, `backend/`) e sulle fonti normative in `doc_base/` (principio SA Italia 250B, ASSIREVI/CNDCEC, luglio 2015, e i relativi allegati VP-1…VP-6).

## 1. Cosa fa Quadra oggi

Quadra è un'applicazione locale (FastAPI + React) che prende la cartella documenti fornita da un cliente per un trimestre, classifica i file (F24, estratti conto, mastrini, verbali, IVA…) e compila un Excel — le "carte di lavoro A–I" più un foglio INDICE — che parte da un master unico (`Template_MASTER.xlsx`). Alla fine produce l'Excel compilato, un elenco dei documenti mancanti (`mancanti.md`) e una tracciatura cella-per-cella di dove è uscito ogni dato (`provenienza.jsonl`). Non firma, non scrive la conclusione, non decide la materialità: quello resta dell'operatore. Il template attuale è stato ricavato da una pratica reale (Gruppo Ferrero, II trimestre 2026) e poi "ripulito" per diventare generico per tutti i clienti.

Il punto centrale è che questo Excel — e quindi il lavoro di Quadra — è lo strumento con cui lo studio documenta un adempimento normativo preciso, non un report interno a piacere. Per capire cosa deve "trovare" l'analisi bisogna partire da lì.

## 2. Da dove nasce l'obbligo: il principio SA Italia 250B

Il controllo contabile trimestrale che Quadra supporta è la "verifica periodica della regolare tenuta della contabilità sociale" prevista dall'art. 14, comma 1, lettera b) del D.Lgs. 27 gennaio 2010, n. 39, e disciplinata dal principio di revisione (SA Italia) 250B (in vigore dal 1° gennaio 2015, documento applicativo ASSIREVI/CNDCEC del luglio 2015 presente in `doc_base/250b.pdf`).

Il principio distingue due doveri del revisore/collegio sindacale, e questo è il punto più importante da tenere a mente: la verifica periodica **non è la revisione del bilancio**. Sono due attività distinte che si alimentano a vicenda:

1. verificare, nel corso dell'esercizio, la **regolare tenuta della contabilità sociale** — rispetto delle norme civilistiche e fiscali su tempistiche di registrazione, tenuta/vidimazione/bollatura dei libri obbligatori, ed esecuzione degli adempimenti fiscali e previdenziali;
2. verificare la **corretta rilevazione dei fatti di gestione nelle scritture contabili** — questa parte, dice il principio stesso, si realizza attraverso l'attività di revisione contabile del bilancio vera e propria, non attraverso la verifica periodica.

In altre parole: il controllo trimestrale che Quadra compila è un controllo di **regolarità formale e tempestività** (i libri ci sono, sono aggiornati, gli adempimenti sono stati fatti nei tempi), non un giudizio di merito sui numeri di bilancio. Questo spiega perché nel WPS ci sono sezioni molto meccaniche (F24 pagati, estratti conto arrivati, libri aggiornati a che pagina) e sezioni che restano deliberatamente di giudizio umano (conclusione, materialità, operazioni significative).

## 3. Le 12 verifiche che il principio richiede — l'obiettivo puntuale

Il principio (§2 del documento applicativo) elenca le procedure che compongono la verifica periodica. Ognuna ha uno scopo preciso, e insieme costituiscono l'obiettivo reale di "cosa deve trovare" il controllo contabile:

| # | Verifica richiesta dal principio | Cosa deve accertare / trovare |
|---|---|---|
| 1 | Pianificare la frequenza delle verifiche periodiche in base a settore, complessità organizzativa, numerosità/frammentazione delle operazioni, esiti di verifiche precedenti | Che la cadenza dei controlli sia adeguata al rischio del cliente, non un automatismo calendariale |
| 2 | Documentare tale pianificazione nelle carte di lavoro | Tracciabilità della decisione, non solo il risultato |
| 3 | Alla prima verifica, censire i libri obbligatori richiesti da normativa civilistica, fiscale, previdenziale e leggi speciali | L'elenco corretto e completo dei libri che quel cliente specifico deve tenere |
| 4 | Alla prima verifica, esaminare la documentazione dell'ultima verifica del revisore precedente | Continuità: eventuali criticità già note da chi c'era prima |
| 5 | Verificare a campione l'**esistenza** dei libri obbligatori | Che i libri richiesti esistano davvero, non solo sulla carta |
| 6 | Verificare, dove richiesto, **vidimazione e bollatura** tempestive dei libri | Adempimento formale con scadenza (es. bollatura libro giornale/inventari) |
| 7 | Verificare a campione il **tempestivo aggiornamento** dei libri (ultima registrazione, ultimo accadimento) | Che i libri non siano "indietro" — è esattamente il dato che Quadra cerca di leggere in Foglio B (ultimo n. registrazione, data, pagina) e Foglio F (ultimo verbale a libro) |
| 8 | Verificare a campione la **corretta esecuzione degli adempimenti fiscali e previdenziali** tramite documentazione pertinente (F24, LIPE, fondi, contributi…) e le relative registrazioni | Che i versamenti dovuti siano stati fatti, nei tempi, e coerenti con le scritture — è il Foglio C di Quadra |
| 9 | Colloqui con la direzione / organi di governance sulle procedure adottate e i loro cambiamenti | Notizie che non emergono dai documenti (cambio di procedura, criticità non ancora tracciata) — Foglio H |
| 10 | Analisi comparativa su una situazione contabile successiva all'ultima verifica | Individuare scostamenti anomali tra periodi — Foglio G (bilancino corrente vs comparativo, %Chg) |
| 11 | Verificare che la direzione abbia **sistemato le carenze procedurali** segnalate nella verifica precedente | Chiusura del ciclo: un problema trovato a T-1 deve risultare risolto a T, non ripetersi in silenzio |
| 12 | Verificare che la direzione abbia **corretto gli errori nelle scritture contabili** segnalati in precedenza | Stessa logica, sul piano contabile |

Il principio è esplicito anche sul "perché" di tutto questo (non solo il "cosa"): il revisore deve poter dimostrare che ha pianificato le verifiche, le ha svolte, e — soprattutto — cosa ha trovato. Gli esiti rilevanti hanno tre destinazioni possibili, ed è qui che si vede l'obiettivo finale dell'analisi:

- se emergono **carenze procedurali** o **non conformità** negli adempimenti, vanno segnalate e nella verifica successiva bisogna controllare che siano state sistemate (punto 11);
- se emergono **errori nelle scritture contabili**, stessa cosa, con verifica di correzione (punto 12);
- se gli elementi raccolti hanno **effetti sulla revisione del bilancio** in corso, vanno segnalati a quell'attività;
- se richiedono **comunicazione agli organi di governance** (CdA, assemblea), vanno tracciati per quello scopo.

Quindi l'obiettivo di ogni singola "carta" non è "riempire una cella": è produrre, per ciascuna delle 12 aree, una risposta documentata a "esiste / è tempestivo / è corretto — sì o no, e se no cosa manca e da quando". Il valore del controllo sta nell'individuare gli scostamenti (documento mancante, libro non aggiornato, versamento in ritardo, scrittura anomala), non nel certificare che tutto va bene quando in realtà nessuno ha guardato.

## 4. Come questi obiettivi si traducono nelle carte A–I di Quadra

Il template usato da Quadra (Ferrero come istanza, generalizzato nel master) traduce le 12 verifiche normative in 9 sezioni operative più una checklist documenti a 7 gruppi (A–G nella "Richiesta doc", diversa dall'alfabeto delle carte A–I — è un dettaglio che genera confusione e che `TEMPLATE_RULES.md` segnala esplicitamente). La mappatura, in sintesi:

Le carte B (libri obbligatori) e F (verbali organi sociali) coprono le verifiche 3, 5, 6, 7 del principio — esistenza e aggiornamento dei libri. La carta C (adempimenti tributari e previdenziali) copre la verifica 8 — F24, fondi, LIPE. La carta E (disponibilità liquide) è la parte più strutturata e serve a riconciliare saldo contabile e saldo bancario, funzionale sia alla verifica 7 (aggiornamento contabile) sia, indirettamente, alla revisione di bilancio. La carta G (analisi situazione contabile periodica) copre la verifica 10 — analisi comparativa. La carta H (colloqui con la direzione) copre la verifica 9. Le carte A (sistema di controllo interno), D (test su rilevazioni contabili) e I (operazioni significative) sono le più vicine a un giudizio professionale e restano, non a caso, quelle che il software può automatizzare meno: registrano cambiamenti, criticità, campionamenti — cose che richiedono valutazione, non solo lettura di documenti. Le verifiche 4, 11 e 12 (continuità con la verifica precedente, chiusura delle carenze/errori pregressi) oggi non hanno una casa esplicita nel template: ogni pratica parte da un master vuoto, per decisione già presa da Ruben il 2026-09-08, quindi il collegamento con "cosa era rimasto aperto al trimestre prima" è, allo stato, un buco strutturale del processo, non solo del software.

## 5. Cosa fa bene il software oggi, e dove è ancora macchinoso

Il backend (`backend/pipeline.py`, `classify.py`, `extract.py`, `fill.py`, `catalog.py`, OCR PaddleOCR locale) fa già un lavoro reale: classificazione automatica dei file su un catalogo di 24 voci documento (A.1–G.2), estrazione dati (es. F24: data versamento, protocollo, importo), scrittura degli status sulla checklist, compilazione parziale delle carte, e soprattutto la tracciabilità (`provenienza.jsonl`) di ogni valore scritto, con metodo ("filename", "umano", ecc.) e confidenza. Questo è già l'elemento più prezioso, perché risponde a un requisito implicito del principio: la verifica deve essere documentabile e ripercorribile.

Quello che oggi rende il processo macchinoso emerge chiaramente da `TEMPLATE_RULES.md`, che elenca oltre venti punti ancora "APERTI" — soglie di materialità non definite, mapping fondo previdenziale → riga non scritto da nessuna parte, ambiguità se il libro del Collegio sindacale vada aggiunto, se i saldi F24 vadano a YTD o solo sul trimestre, formato reale del bilancino cliente per cliente. Il flusso operativo è rigido in due passaggi obbligati ("Scansiona" poi "Avvia", non invertibili) su un intero file Excel enorme con formule fragili da non rompere (`E!H12:H28`, fogli DataSnipper da non toccare, celle header con formule verso INDICE). Il risultato è che il software oggi è tarato per riprodurre fedelmente la struttura di un singolo file Excel (quello di un cliente, Ferrero) più che per rispondere direttamente alle 12 domande del principio SA 250B. Molti "APERTI" sono di fatto scelte editoriali del template Excel (dove scrivere una nota, che colonna usare) più che ambiguità sul contenuto del controllo.

## 6. Una via per renderlo meno macchinoso: separare "cosa deve trovare" da "dove va scritto"

Il nodo, letto insieme, è questo: oggi Quadra è organizzato attorno al foglio Excel (classificare un file → trovare la cella giusta in una carta specifica di un template specifico) invece che attorno alle 12 verifiche del principio (per ogni area, quali evidenze servono e cosa dicono). Sono equivalenti solo finché il template Excel non cambia e i clienti si assomigliano; ma ogni piccola differenza (un cliente senza Intrastat, un conto in USD non previsto dal template Ferrero, un fondo previdenziale diverso) costringe a rincorrere l'Excel invece di rispondere alla domanda di merito.

Un redesign possibile, che non butta via il lavoro fatto ma lo riordina, avrebbe tre livelli invece di un pipeline rigido "scansiona → avvia → correggi":

Un primo livello di **raccolta mirata delle evidenze**, organizzato per le 12 verifiche (o per le sezioni A–I, che è la stessa cosa vista dal lato pratico) invece che per singola cella Excel: per ogni area, il software cerca nella cartella cliente le prove pertinenti e restituisce direttamente la risposta alla domanda di merito — "ultimo F24 versato: data X, importo Y, protocollo Z, coerente coi mesi attesi? sì/no"; "libro giornale definitivo: ultima pagina bollata trovata, aggiornato a che data, scostamento dai tempi normativi? sì/no"; "saldo e/c per ogni banca vs saldo co.ge: quadra? differenza residua? banche del bilancino senza estratto corrispondente?". Questo è quello che oggi il codice fa già in parte (extract.py, fill.py), ma la sua uscita naturale dovrebbe essere una risposta strutturata per verifica, non (solo) una cella riempita in un foglio specifico.

Un secondo livello, la **compilazione del working paper cliente-specifico**, resta necessario perché lo studio deve consegnare un Excel nel formato che usa da anni (compatibile con DataSnipper, SharePoint, revisori che lo conoscono): ma diventa un passo di "esportazione" che prende le risposte già trovate al livello 1 e le versa nelle celle giuste, invece di essere il cuore della logica applicativa. Questo disaccoppiamento è quello che permette, in futuro, di generare output diversi (un riepilogo direzionale, un cruscotto per il senior, un file per un cliente con template leggermente diverso) senza riscrivere la logica di ricerca dei documenti.

Un terzo livello, che oggi manca del tutto, è la **continuità fra trimestri**: tenere traccia di cosa era `wip` o segnalato come carenza al trimestre precedente, per rispondere in automatico alle verifiche 11 e 12 del principio ("la direzione ha sistemato quanto segnalato?") invece di ripartire sempre da zero. Anche solo un log leggero (cosa mancava a T-1, è arrivato a T?) chiuderebbe un pezzo di normativa che oggi il processo, non solo il software, lascia scoperto.

Concretamente, questo significherebbe: costruire per prima cosa, sopra ai moduli di classificazione ed estrazione già scritti, un piccolo motore di query per verifica ("dammi lo stato dei libri obbligatori", "dammi gli F24 del trimestre con eventuali anomalie", "dammi le banche del bilancino senza estratto conto corrispondente") che produce risposte leggibili con fonte allegata; poi mantenere il riempimento dell'Excel come uno dei modi di presentare quelle risposte, non l'unico; e infine chiudere per iscritto, insieme a chi in studio userà il tool su altri clienti, i punti "APERTI" che oggi bloccano la generalizzazione (soglia di materialità per lo scostamento bancario e per le variazioni "significative" in G, mapping fondi previdenziali, se il libro del Collegio sindacale va aggiunto in F) — sono poche decisioni, ma da prendere prima di scalare oltre Ferrero, non dopo.

## 7. In sintesi

L'obiettivo del controllo contabile trimestrale non è compilare un Excel: è dimostrare, con evidenza documentata e tracciabile, che la contabilità del cliente è tenuta regolarmente (libri esistenti, aggiornati, vidimati quando dovuto) e che gli adempimenti fiscali/previdenziali sono stati eseguiti nei tempi — e, quando qualcosa non torna, segnalarlo e verificare nel trimestre successivo che sia stato sistemato. L'Excel A–I è solo il contenitore che lo studio ha scelto per documentare quella dimostrazione. Quadra oggi automatizza bene la parte meccanica di lettura e trascrizione, ma è ancora troppo legato alla forma di quel contenitore; spostare il fulcro della logica verso le 12 domande del principio (e trattare l'Excel come output finale, non come motore) è la via più diretta per renderlo meno macchinoso e più facile da estendere ad altri clienti.
