# Briefing per una nuova sessione — Quadra, JET: pianificazione dello sprint di 2 settimane

Questo documento sostituisce una conversazione precedente. Leggilo tutto prima di fare qualunque cosa:
contiene il contesto, le regole del progetto e lo storico di cui hai bisogno per continuare
correttamente. Non è ancora un prompt per implementare codice — è il briefing con cui tu, in questa
nuova sessione, prendi in mano il ruolo di **supervisore** di questo progetto, esattamente come è stato
svolto finora.

## Chi è l'utente e come lavora

Ruben gestisce "Quadra", un progetto software interno per il suo studio di revisione contabile (Baker
Tilly). Usa Codex, Claude Code e Cursor per implementare il codice, e fa lui stesso tutte le operazioni
git (branch, commit, merge, push). Il tuo ruolo **non è scrivere codice**: è discutere con Ruben come
deve comportarsi ciascun controllo, scrivere prompt dettagliati in italiano per chi implementa, e poi
verificare in modo indipendente il lavoro fatto prima di dare il via libera alla fase successiva. Non
fare mai commit git tramite il bridge verso il suo computer.

Il repository si trova su un Mac collegato a questa sessione tramite un bridge remoto (strumenti
`mcp__remote-devices__*`): la cartella connessa è `/Volumes/SSDRubb/Controllo Contabile automatizzato`.
Se quegli strumenti non sono disponibili, chiedi a Ruben di ricollegare il computer o di allegare i file
necessari.

## Il metodo di supervisione, non negoziabile

1. Discuti con Ruben, punto per punto, come deve comportarsi esattamente un controllo (parametri,
   soglie, default, casi limite) prima di scrivere qualunque prompt.
2. Scrivi un prompt in italiano, molto dettagliato, per chi implementa (Codex/Claude Code/Cursor) —
   contesto, cosa implementare esattamente, cosa NON toccare, checklist di autoverifica finale.
3. Aspetti che Ruben riporti (di solito incollando il riepilogo di chi ha implementato) cosa è stato
   fatto. **Non ti fidi del riepilogo**: verifichi tu stesso, indipendentemente.
   - Scope del diff: `git diff <branch-precedente>..<branch-nuovo> --stat` deve mostrare esattamente i
     file dichiarati, non di più.
   - Leggi il codice per intero, non solo il diff a campione.
   - Rifai girare la suite di test in un ambiente pulito — mai nella cartella di lavoro live (contiene
     codice non tracciato ed estraneo): `git archive <branch> -o file.tar.gz`, estrai, virtualenv nuovo,
     installa le dipendenze minime necessarie (fastapi, uvicorn[standard], pydantic, pydantic-settings,
     python-multipart, pyyaml, sqlalchemy[asyncio], aiosqlite, alembic, httpx, openpyxl, pypdf, pymupdf,
     pytest, pytest-asyncio, pytest-cov — **non** installare paddleocr/redis/celery/minio/PyJWT, servono
     solo a moduli non toccati da JET), `python -m pytest tests/ -q` (mai `pytest` nudo).
   - Quando la fase riguarda dati reali, rieseguila tu stesso con dati reali, non limitarti a leggere i
     numeri dichiarati.
4. Scrivi una revisione datata con l'esito (approvato o cosa manca) prima di passare alla fase
   successiva.
5. Consegni file (prompt, revisioni) con: `Write` locale → copia in `/mnt/user-data/outputs/` →
   `SendUserFile` → `device_commit_files` verso il percorso esatto nel repository sul Mac.
6. Il mount git dentro `device_bash` a volte smette di funzionare in modo intermittente (torna da solo,
   a volte basta un retry); quando succede, `device_list_dir`/`device_stage_files`/`device_commit_files`
   restano comunque funzionanti — usali per staccare e leggere i singoli file cambiati come verifica
   alternativa, dichiarando sempre nella revisione che si è dovuto ripiegare su questo metodo.
7. Non fabbricare mai dati reali di un cliente dentro una fixture che finisce committata nel repository:
   se serve un file di test realistico, usa un file reale solo come riferimento strutturale e ricostruisci
   dati inventati con la stessa struttura.

## Storico del modulo JET

**Fasi 1–5** (motore puro, `backend/jet/{models,ingest,criteri,sequenza}.py`, mai più toccato da allora):
undici criteri di rischio ISA 240 §A44 + dimensione conto, validati su Nordson (213.656 righe Excel/SAP,
coincidenza esatta con l'Excel storico del team) e su un primo test ad-hoc su ALUK (56.133 righe TXT,
parser scritto fuori dal repo). Disciplina fondamentale: quando un parametro cliente non è configurato,
il risultato del criterio è `None` ("non calcolabile"), mai `False`. Fase 5 ha corretto due bug reali
trovati proprio sul test ALUK: crash di `verifica_sequenza` su numerazioni miste (fatture a poche cifre +
codici RID/SDD a 16 cifre — enumerazione di gap dell'ordine di 10^19), e sei criteri opzionali che
restituivano ancora `False` invece di `None`. **Entrambi confermati corretti nel codice attuale.**

**Fase A** (branch `jet/faseA-pratiche-operative`, commit `9303dfc`): modello pratiche JET operativo,
API (`backend/jet/{pratica,store,api}.py`), form parametri, esecuzione analisi, export Excel. Bug di
scala trovato e corretto (export con OFFSET cresceva quadraticamente → keyset pagination, verificato a
213k righe in 0,6s).

**Fase B** (commit `9da077b`): motore di "profili di estrazione" per TXT a colonne fisse
(`backend/jet/{profilo,ingest_txt}.py`), posizioni `[inizio, fine)` derivate dall'intestazione, matching
esatto (no fuzzy) per riuso automatico del profilo su file dello stesso formato.

**Fase C** (commit `3fd7c73`): estrazione da PDF testuale (`backend/jet/ingest_pdf.py`, PyMuPDF),
generalizzando Fase B in `ispeziona_righe`/`estrai_righe_testo`/`mappa_righe_testo` riusabili da
TXT e PDF.

**Fase D — PDF scansionato via OCR — SOSPESA** (commit `baa0495`): il "passo zero" (test obbligatorio di
allineamento OCR prima di costruire qualunque interfaccia) ha mostrato che PaddleOCR frammenta ogni
registrazione in decine di bounding box senza una posizione orizzontale condivisa: il meccanismo di
profili a posizioni fisse non è riusabile sul testo OCR. Decisione presa con Ruben: pausa, non
abbandono — l'alternativa (bounding box + griglia editabile con conferma umana) resta da valutare su
volumi reali prima di riprendere. Il messaggio d'errore in `ingest_pdf.py` è stato aggiornato per non
promettere più una "Fase D" imminente.

**5 commit comparsi direttamente su `main` fuori dal processo di revisione** (`ce55a06`, `8ba45c5`,
`a99631c`, `7e26522`, `bb50d42`, punta attuale `bb50d42`): `ce55a06`/`7e26522` aggiungono una funzione
reale — più file/fonti per una stessa pratica JET (`backend/jet/fonti.py`, dedup sha256, stato/errore
per fonte, profilo/mappatura per fonte); `8ba45c5` divide la dashboard UI (Controllo Contabile vs JET);
`a99631c` è solo documentazione storica archiviata; `bb50d42` aggiunge Docker compose e lo scope-creep
già segnalato in passato (`backend/modules/jet/`, `backend/enterprise/`, `backend/core/`) — ora
committato ma esplicitamente etichettato "unused" nel messaggio di commit. **Il multi-fonte non ha mai
ricevuto una revisione formale con il metodo sopra descritto**, ma è stato validato in pratica con
successo durante il test reale su ALUK (vedi sotto) — rischio quindi basso ma non chiuso: va comunque
fatta la revisione formale (diff scope, lettura integrale di `api.py`/`store.py`/`JetDashboard.tsx`,
test in ambiente pulito) quando c'è spazio, non necessariamente prima di iniziare lo sprint.

**Test reale end-to-end su ALUK GROUP S.P.A.** (10/09/2026, 3 file reali, 56.133 registrazioni totali,
motore invariato): risultato consegnato a Ruben come export Excel reale. Due lacune reali del prodotto
attuale confermate sui dati veri (non emerse prima perché le fixture di Fase B/C erano pulite): (1)
l'engine TXT non sa saltare un masthead di stampa prima della vera riga di intestazione colonne; (2) il
formato di stampa usa due righe fisiche per registrazione, mentre il profilo attuale mappa una riga di
testo = una registrazione, e richiede comunque una posizione per `identificativo_registrazione` che in
quell'export non esiste come colonna. Per il test è stato usato uno script di pre-elaborazione esterno
al repository (stesso approccio già documentato in `docs/jet/test_reale_aluk_1.md` per il primo test
ad-hoc), validato al centesimo contro i totali "TOTALI STAMPA" dichiarati nei file stessi. Bilancio
netto verificato a zero su tutti e tre i periodi.

## Il documento "JET — 15 controlli: stato e confronto" (10/09/2026)

Su richiesta di Ruben (le 15 verifiche richieste dal team/partner per portare JET da MVP a prodotto
finito) è stata prodotta una relazione — verificata riga per riga sul codice reale, non su un
riepilogo — che incrocia ciascun controllo con lo standard ufficiale Baker Tilly/Global Focus (tabella
pesi del "JET Template", pagina 12 del manuale Global Focus Audit Methodology, Novembre 2024). Sintesi:

| # | Controllo | Stato | Punteggio oggi → standard BTR | Gap principale |
|---|---|---|---|---|
| 1 | Impatto >10% utile netto | Presente | 1 → 1 (coincide) | — |
| 2 | Importo >10x media | Presente | 1 → 1 (coincide) | media da calcolare, non inserire a mano |
| 3 | Sopra performance materiality | Presente | 1 → 1 (coincide) | import/riconciliazione dal file Global Focus |
| 4 | Cifra tonda 10.000/100.000 | Parziale | 1 → 1 (peso ok, soglia no) | oggi è "divisibile per 10", non 10k/100k |
| 5 | Weekend e festività per Paese | Parziale | 1/1 → 1 (weekend) / **4** (festività) | nessun calendario nazionale (IT/DE/FR/ES); peso festività da correggere a 4 |
| 6 | Fuori orario 8:00–18:00 | Presente | 1 → 1 (coincide) | nessun default 8–18 precompilato |
| 7 | Retrodatazione + finestra chiusura | Parziale | 1 → **4** (per la retrodatazione generica) | **manca del tutto** la finestra ultimi 5gg lavorativi/data chiusura configurabile — gap più rilevante dei 15 |
| 8 | Utenti non autorizzati (disattivabile) | Presente | 1 → **4** | interruttore oggi implicito (None se lista assente), non un toggle esplicito |
| 9 | Righe/descrizioni vuote | Presente | 1 → **4** | solo il peso da correggere |
| 10 | Conto raro (2–4 volte/anno) | Parziale | opzionale/non standard BTR | oggi è "sotto soglia", non una fascia 2–4 annualizzata |
| 11 | Sequenza numerica + pagina | Parziale | nessun punteggio (controllo separato) | manca del tutto il controllo per pagina/numerazione bollata; rischio alto di eterogeneità per gestionale (visto con ALUK) |
| 12 | Cifre finali ripetute | Assente | — | nessuna logica dedicata; va definito il pattern esatto per evitare falsi positivi (es. ,99) |
| 13 | Ri-analisi sui soli sospetti | Assente | — | esiste solo il filtro `da_investigare` sui risultati, non un secondo livello di analisi |
| 14 | Conto >10 cifre | Assente | — | nessuna validazione di lunghezza/formato |
| 15 | Keyword frode + OCR visura | Parziale | 1 → **4** (keyword) | keyword sì (riuso del meccanismo parti correlate); OCR estrazione nominativi da visura camerale del tutto assente — stesso profilo di rischio della Fase D già sospesa |

Standard BTR per riferimento — soglia di approfondimento ufficiale: punteggio totale **≥ 4** (Quadra oggi
non ha un default imposto, il campo è liberamente configurabile).

## Valutazione di capacità già discussa con Ruben (2 settimane, Claude Code + Codex + Cursor)

Punto di partenza condiviso: il punto 15 (OCR sulla visura per estrarre nominativi/cariche) **non entra
in questo sprint** — stesso profilo di rischio della Fase D già sospesa (formato non standardizzato,
verifica umana obbligatoria, servirebbe un passo zero dedicato come already fatto per l'OCR del
giornale). Va trattato come iniziativa separata futura, non una voce dello sprint da 2 settimane.

**Entra comodamente in una settimana di lavoro** (prompt piccoli e mirati, basso rischio):
correzione pesi a 4 (festività, retrodatazione, utenti non autorizzati, descrizione vuota, keyword) e
soglia di approfondimento a 4; default 8–18 per l'orario; soglia cifra tonda configurabile
10.000/100.000; media registrazioni calcolata automaticamente; toggle esplicito utenti non autorizzati;
conto >10 cifre; cifre finali ripetute (previa decisione con Ruben sul pattern esatto).

**Entra, ma riempie la settimana, non è un extra**: la finestra di chiusura (ultimi 5 giorni lavorativi +
data configurabile, default 31/12) — il gap più importante trovato; calendari IT/DE/FR/ES (fattibile in
una settimana solo come dataset statico curato, non una libreria "intelligente" auto-aggiornante);
import dalla materialità di Global Focus (dipende dal formato reale del file, non ancora visto).

**Rischioso includerlo in questo giro, valutare con Ruben se rimandare**: test di sequenza per pagina
(ogni gestionale numera diversamente, rischio di un'altra sorpresa come il masthead ALUK); ri-analisi sui
soli sospetti come vero secondo livello (non solo il filtro già esistente) — se richiesto, va scoping a
parte, non improvvisato nella stessa settimana degli altri punti.

Nota sulla settimana di test: in questa sessione, ogni singola fase ha fatto emergere almeno una sorpresa
reale in verifica (lo scarto costante di test, il campionamento OCR, il masthead/due-righe di ALUK) — non
per sfortuna, è il lavoro che il test serve a fare. Con nove-dieci modifiche assieme in un'unica settimana
di sviluppo, la settimana di test va vissuta come piena di suo, non con margine libero per bug trovati —
se emerge qualcosa (probabile), la correzione va a scapito del resto della finestra, non si aggiunge come
tempo gratuito.

## Il piano concordato con Ruben per queste 2 settimane

- **Oggi e domani**: pianificazione scrupolosa. Discutere con Ruben, punto per punto, i 15 controlli:
  come li immagina, come devono comportarsi esattamente (parametri, soglie, default, casi limite),
  prendendo anche in considerazione un **documento ufficiale con le richieste del team/partner** che
  Ruben fornirà a inizio di questa nuova conversazione — leggilo per primo e riconcilia quanto contiene
  con la tabella sopra prima di procedere.
- **Da domani**: 10 giorni lavorativi di implementazione, con Claude Code, Codex e Cursor come
  esecutori sotto la stessa disciplina di supervisione descritta sopra (prompt scritto da te, mai
  fidarsi del riepilogo, verifica indipendente prima di ogni via libera).
- Obiettivo dichiarato da Ruben: avere qualcosa di realmente utilizzabile entro la fine di questi 10
  giorni — non l'intero elenco dei 15 punti, ma il sottoinsieme concordato secondo la valutazione di
  capacità sopra.

## Cosa fare adesso, concretamente

1. Aspetta e leggi il documento ufficiale con le richieste del team/partner che Ruben ti fornirà.
2. Discuti con Ruben, uno per uno, i 15 controlli della tabella sopra: per ciascuno, arrivare a una
   definizione precisa e non ambigua di come deve funzionare (formula, parametri, default, cosa succede
   quando un dato manca — sempre `None`, mai `False`, coerentemente con la disciplina del progetto).
3. Sulla base di queste decisioni, organizza il lavoro dei 10 giorni in una sequenza di prompt piccoli e
   scopati, seguendo esattamente lo stile dei prompt precedenti (li trovi in `docs/prompts/`, numerati
   progressivamente — l'ultimo usato è `26_jet_faseD_sospesa_chiusura.md`, il prossimo sarà `27`),
   rispettando le fasce di rischio/sforzo già identificate e lasciando fuori dallo sprint l'OCR della
   visura (punto 15).
4. Non ridiscutere decisioni già prese in questo briefing salvo che il documento ufficiale di Ruben le
   contraddica esplicitamente — in quel caso fermati e chiedi chiarimento invece di procedere su
   un'assunzione sbagliata.
5. Tieni presente, ma senza farne una priorità immediata, che la revisione formale dei 5 commit sul
   multi-fonte resta da chiudere.
