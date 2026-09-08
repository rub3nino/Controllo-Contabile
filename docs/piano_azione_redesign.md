# Piano d'azione — ridisegnare Quadra attorno agli obiettivi reali del controllo contabile

Questo documento propone come ristrutturare il software, partendo da carta bianca sul formato di output ma vincolando tutta la logica alle 12 verifiche del principio SA Italia 250B descritte in `docs/analisi_obiettivi_controllo_contabile.md`. È un piano, non un'esecuzione: nessuna modifica al codice è stata fatta.

## 1. Principio guida

Oggi il software è organizzato attorno a un file Excel specifico (nato da una pratica Ferrero): classificare un documento significa trovare la cella giusta in quel template. Il redesign inverte la priorità: il cuore del software diventa rispondere, per ciascuna delle 12 verifiche del principio, alla domanda "cosa dice l'evidenza raccolta" — con fonte e affidabilità — e produrre un giudizio di stato (`✓ / wip / ✗ / N/A`) motivato. L'Excel compilato in stile Ferrero resta un formato di export possibile (serve comunque, per compatibilità con DataSnipper/SharePoint/abitudini dello studio), ma diventa un renderer tra altri, non il motore.

Questo permette due cose che oggi mancano: generalizzare a clienti diversi senza riscrivere la logica (basta una configurazione per cliente, non codice nuovo), e chiudere le verifiche 11 e 12 del principio — "la direzione ha sistemato quanto segnalato al trimestre precedente?" — che richiedono uno storico persistente e oggi non esistono affatto (ogni pratica riparte da zero, per scelta esplicita già presa).

## 2. Architettura proposta, a livelli

**Livello 1 — Ingestion (documenti → fatti grezzi).** Evoluzione di quanto già esiste (`classify.py`, `extract.py`, `paddle_ocr.py`): dato un file, produce un record di classificazione (che voce di catalogo è) più i dati strutturati che riesce a estrarne (data, importo, protocollo, saldo, ultima pagina di un registro…). Non conosce nessun Excel. Riusa gran parte del codice attuale.

**Livello 2 — Evidence store (persistenza).** Oggi lo stato vive in memoria in un singolo oggetto `Engine` di processo (`backend/pipeline.py`), quindi non c'è storico tra run né tra trimestri. Serve un database leggero (SQLite va benissimo per l'uso in locale) con: clienti, pratiche (cliente+periodo), documenti classificati, fatti estratti, e — punto nuovo — i findings aperti di ogni pratica (carenze, non conformità, errori) con uno stato che si porta al trimestre successivo finché non risulta chiuso.

**Livello 3 — Motore di verifica (business logic pura).** Un modulo per ciascuna delle aree del principio (o le 9 lettere A–I, che sono la stessa scomposizione vista dal lato pratico), che legge i fatti dal livello 2 e produce: stato (`✓/wip/✗/N/A`), motivazione, elenco di evidenze mancanti, eventuali anomalie (scostamento e/c fuori soglia, versamento in ritardo, registrazione ferma da troppo tempo). Le regole di calcolo già scritte in `TEMPLATE_RULES.md` §4.1 sono il punto di partenza — vanno tradotte in codice indipendente da Excel, non riscritte da zero. Qui vive anche la logica delle verifiche 11/12 (confronto con i findings aperti del trimestre precedente).

**Livello 4 — Configurazione cliente.** Un file per cliente (YAML, sullo stile di `regole/schema.yaml` ma generico) che dice: quali voci di catalogo si applicano a questo cliente, l'anagrafica banche, i fondi previdenziali, le soglie di materialità, eventuali libri aggiuntivi. Onboardare un cliente nuovo diventa scrivere un file, non toccare `fill.py`.

**Livello 5 — Output/export (pluggable).** Riceve lo stato calcolato dal livello 3 e lo trasforma in un artefatto: (a) l'Excel WPS in stile attuale — qui va ripreso e adattato `fill.py`, che oggi mescola estrazione e scrittura celle; (b) un report/dashboard nativo (pagina HTML o vista nella UI React esistente) che mostra le 12 verifiche con evidenza e fonte, pensato per la revisione del senior prima ancora di aprire Excel; (c) `mancanti.md` e la tracciatura provenienza, che oggi funzionano già bene e vanno solo agganciati al nuovo modello dati.

In breve: livelli 1 e 2 sono soprattutto evoluzione di codice esistente; il livello 3 è la parte veramente nuova (ed è quella che vale di più, perché è lì che si risponde alla domanda "cosa deve trovare il controllo"); i livelli 4 e 5 sono ciò che rende il sistema scalabile ad altri clienti senza intervento manuale ogni volta.

## 3. Cosa si tiene, cosa si rifà

Si tengono: la classificazione dei file su catalogo (`classify.py`, `catalog.py`), l'estrazione dati (`extract.py`), l'OCR locale (`paddle_ocr.py`), il modello di provenienza (`provenance.py`) che è già esattamente lo standard di tracciabilità richiesto dal principio, e le fixture di test (`fixtures/docs`). Si rifanno: lo stato in-memory singleton (`Engine`/`AppState` in `pipeline.py`, che non è multi-pratica né persistente), la logica di scrittura celle mescolata nell'estrazione (`fill.py`, 1142 righe, oggi accoppia "cosa significa questo dato" con "in che cella va"), e il vincolo dei due passi rigidi Scansiona→Avvia legato a un solo template.

## 4. Fasi

**Fase 0 — Contratti dati (1 sola persona/agente, non parallelizzabile).** Definire i modelli condivisi prima di dividere il lavoro: `Evidence` (documento + fatto estratto + fonte), `VerificationResult` (per ciascuna area: stato, motivazione, evidenze collegate, anomalie), `ClientConfig` (schema YAML del livello 4), `Finding` (carenza/errore aperto, con storico trimestri). Questi contratti sono l'interfaccia tra tutti gli altri stream: se cambiano dopo, il lavoro parallelo va rifatto. Vale la pena chiuderli per iscritto (anche solo come `pydantic` models + un file di esempio) prima di far partire Claude Code e Codex in parallelo.

**Fase 1 — Evidence store e motore di verifica (il cuore nuovo).** Implementare il livello 2 (persistenza SQLite) e il livello 3 (le regole per le 9 aree, tradotte da `TEMPLATE_RULES.md` §4.1 in codice puro testabile), incluso lo storico tra trimestri per le verifiche 11/12. Si lavora sulle fixture esistenti (`fixtures/docs`) come caso di test, senza toccare ancora l'export Excel.

**Fase 2 — Adattare ingestion e config cliente.** Rendere `classify.py`/`extract.py` pluggable rispetto al `ClientConfig` (oggi il catalogo è fisso e uguale per tutti), e scrivere il primo `ClientConfig` reale a partire dal caso Ferrero già mappato in `regole/schema.yaml`, così si verifica che il nuovo sistema riproduca gli stessi risultati del vecchio su un caso noto.

**Fase 3 — Dashboard nativa, poi renderer Excel.** Priorità confermata da Ruben (§7): prima la vista nativa (nella UI React esistente) che mostra le 12 verifiche con stato, evidenza e fonte — è il vero output del sistema, non solo un accessorio. Solo dopo (o in parallelo se le risorse lo permettono) si riscrive l'export Excel come semplice consumatore del `VerificationResult` già validato in dashboard, mantenendo la compatibilità con `Template_MASTER.xlsx` per lo studio: l'Excel diventa un risultato derivato, non più il posto dove si decide lo stato di una sezione.

**Fase 4 — Secondo cliente reale + chiusura punti aperti.** Onboardare un cliente diverso da Ferrero usando solo il `ClientConfig`, senza toccare codice: è il vero test che l'architettura regge. In questa fase vanno chiuse anche le decisioni ancora aperte (soglia di materialità per lo scostamento bancario e per le variazioni "significative" in G, mapping fondi previdenziali, continuità Collegio sindacale in F) — sono poche ma bloccano la generalizzazione, meglio deciderle qui che scoprirle durante l'uso.

## 5. Divisione del lavoro tra Claude Code e Codex

La Fase 0 (contratti dati) conviene farla con un solo agente, per evitare che i due divergano su modelli che poi devono combaciare — è un lavoro di poche ore, non da parallelizzare. Da lì in poi la separazione più pulita è per tipo di rischio: un agente sul "core" (dove un errore logico produce un giudizio di controllo sbagliato, quindi serve più rigore e test), l'altro sugli "adapter" (parser, formati file, rendering) dove l'errore è più visibile e meno pericoloso.

| Stream | Contenuto | Agente proposto | Dipende da |
|---|---|---|---|
| 0. Contratti dati | Modelli `Evidence`, `VerificationResult`, `ClientConfig`, `Finding` | Claude Code | — |
| 1. Motore di verifica | Regole di stato per le 9 aree + logica verifiche 11/12 (continuità trimestri) | Claude Code | Fase 0 |
| 2. Evidence store | Schema SQLite, persistenza pratiche/documenti/findings | Claude Code | Fase 0 |
| 3. Ingestion pluggable | Adattare `classify.py`/`extract.py` a `ClientConfig`, estrattori per nuovi tipi documento | Codex | Fase 0 |
| 4. ClientConfig Ferrero | Tradurre `regole/schema.yaml` nel nuovo formato, come caso di riferimento | Codex | Fase 0 |
| 5. Renderer Excel | Riscrivere `fill.py` come consumatore di `VerificationResult` | Codex | Fase 1 |
| 6. Dashboard nativa | Vista React delle 12 verifiche con evidenza/fonte | Codex | Fase 1 |
| 7. Test di non regressione | Confronto output nuovo vs vecchio sistema sul caso Ferrero | Claude Code | Fasi 1–5 |
| 8. Secondo cliente | Onboarding nuovo cliente solo via config | Da assegnare in base a chi è più libero | Fase 4 |

La logica di questa divisione: a Claude Code le parti dove la correttezza del giudizio conta di più (motore di verifica, continuità, e la verifica finale di non-regressione contro il sistema attuale); a Codex le parti più meccaniche e ad alto volume di codice ripetitivo (parser per formati diversi, mapping celle Excel, componenti UI) dove un throughput alto conta più della supervisione fine. Gli stream 3+4 possono partire in parallelo allo stream 1+2 subito dopo la Fase 0, perché toccano moduli diversi e comunicano solo attraverso i contratti già fissati; lo stream 5+6 invece deve aspettare che il motore di verifica (Fase 1) esista, perché ne consuma l'output.

## 6. Cosa verificare prima di considerarlo pronto

Il test più importante è di non regressione: far girare il nuovo sistema sulla stessa cartella documenti Ferrero II trimestre 2026 già usata oggi, e controllare che gli stati calcolati per le 9 aree e l'elenco `mancanti.md` coincidano con quelli attuali (`output/ferrero-ii-2026/`). Il secondo test, altrettanto importante per validare l'architettura, è onboardare un cliente diverso (anche solo con le fixture sintetiche in `fixtures/docs`, che già simulano un cliente demo) usando solo un nuovo `ClientConfig`, senza toccare una riga di codice del motore o dei renderer: se serve modificare `fill.py` o `extract.py` per farlo funzionare, vuol dire che la separazione tra livelli non è ancora pulita.

## 7. Decisione presa (2026-09-08): la dashboard è l'output primario

Confermato da Ruben: la dashboard nativa (livello 5b) è il vero prodotto — dove si vede lo stato delle 12 verifiche con evidenza e fonte, e dove si lavora davvero. L'Excel in stile Ferrero resta necessario per compatibilità con lo studio (DataSnipper, SharePoint, abitudini dei revisori), ma è un **risultato derivato**: si genera a valle, dallo stesso `VerificationResult` che alimenta la dashboard, non è più il posto dove si "ragiona".

Conseguenza pratica sulla Fase 3 e sulla tabella degli stream: lo stream 6 (dashboard) precede lo stream 5 (renderer Excel) in priorità. Concretamente, nella Fase 3 conviene prima portare la dashboard a un livello usabile (vedere le 9 aree, lo stato calcolato, l'evidenza e la fonte di ogni dato, i mancanti) e solo dopo, o in parallelo se le risorse lo permettono, curare l'export Excel — che a quel punto è "solo" una serializzazione di dati già corretti e già verificati in dashboard, quindi un lavoro più meccanico e a minor rischio.

## 8. Il ruolo di supervisione in questa sessione

Ruben ha chiesto un assetto a tre: Claude Code e Codex realizzano gli stream del piano (tabella §5); questa sessione (Claude, nel workspace collegato al Mac) fa da supervisore — controlla il lavoro nei minimi dettagli dopo ogni azione svolta, prima che si consideri chiusa una fase. In pratica questo significa che ogni stream della tabella §5, quando Claude Code o Codex segnalano di averlo completato, va chiuso solo dopo un controllo esplicito di questa sessione, non per fiducia sul solo esito riportato dall'agente che ha scritto il codice. Il controllo, per ciascuno stream, dovrebbe includere: lettura del diff/codice prodotto (non solo l'output finale), esecuzione dei test di non regressione previsti al §6 dove applicabile, verifica che i contratti dati della Fase 0 siano rispettati (nessuna deviazione silenziosa dai modelli condivisi), e per gli stream che toccano il motore di verifica (§5, stream 1 e 7) un controllo di merito sul caso Ferrero — cioè che lo stato calcolato per ciascuna area sia davvero giustificato dall'evidenza, non solo "verde perché il codice non ha sollevato errori".

Questo ruolo di supervisione è compatibile con la divisione di lavoro proposta al §5 (Claude Code sul core, Codex sugli adapter): la differenza è che ora nessuno dei due stream si considera chiuso in autonomia — passano entrambi dal controllo di questa sessione prima di avanzare alla fase successiva, specialmente prima della Fase 4 (secondo cliente), dove un errore nel motore di verifica si propagherebbe silenziosamente a un cliente reale nuovo.
