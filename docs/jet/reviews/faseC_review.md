# Revisione JET Fase C — estrazione da PDF testuale

Data: 2026-09-09. Branch: `jet/faseC-pdf-testuale` (sopra `jet/faseB-profili-estrazione-txt`),
commit `3fd7c73`, base `9da077b` (punta di Fase B approvata).

## Verifica dello scope

`git diff 9da077b..3fd7c73 --stat`: **10 file, esattamente quelli dichiarati**
(`backend/jet/{api,ingest_txt}.py` modificati, `backend/jet/ingest_pdf.py` nuovo, due fixture PDF,
uno script di generazione fixture, due file di test nuovi, `ui/src/jet/JetDashboard.tsx`,
`.gitattributes` per marcare i PDF come binari). Nessun altro file toccato. Diff isolato
esplicitamente su `backend/jet/{models,criteri,sequenza,profilo,store,pratica}.py`: **vuoto,
confermato** — né il motore né il modello dati né lo store dei profili sono stati toccati, coerente
con "non duplicare il motore di profili" richiesto dal prompt.

## Lettura completa del codice

**Il punto più delicato del prompt era proprio questo**: se la Fase B avesse legato lettura-file e
applicazione-profilo in un'unica funzione che assume un percorso su disco, serviva un refactoring
minimo e dichiarato, non una duplicazione. È esattamente quello che è successo, e Codex l'ha
dichiarato come richiesto: `backend/jet/ingest_txt.py` ora espone tre funzioni generiche che operano
su `list[str]` indipendentemente dall'origine — `ispeziona_righe`, `estrai_righe_testo`,
`mappa_righe_testo` (quest'ultima con un parametro `formato` usato solo per il messaggio d'errore) —
e le vecchie `ispeziona_txt`/`estrai_righe_txt`/`mappa_righe_txt` diventano wrapper sottili che
leggono il file e delegano. Confrontato il comportamento pubblico prima/dopo: **identico** per il
percorso TXT (stesso `AnteprimaTxt`, stesso messaggio d'errore su intestazione mancante, stessa
validazione di riga corta) — è un refactoring additivo genuino, non una riscrittura, verificato anche
dal fatto che tutti i test di Fase B esistenti passano invariati nella suite pulita (sotto).

**`backend/jet/ingest_pdf.py`** (nuovo, 39 righe): `estrai_righe_pdf` usa
`pagina.get_text("text", sort=True)` di PyMuPDF (l'opzione `sort=True` riordina i frammenti di testo
per posizione verticale/orizzontale, che è quanto basta qui dato che il fixture di test è
monospaziato a passo fisso). Rilevamento PDF scansionato: se meno di 2 righe non vuote o meno di 20
caratteri totali di testo utile, solleva `ValueError` con il messaggio esatto richiesto dal prompt
("...serve l'OCR della Fase D"), non una lista vuota silenziosa né un fallback automatico —
esattamente il comportamento richiesto. `mappa_righe_pdf` chiama `mappa_righe_testo` (il nuovo punto
d'ingresso condiviso di Fase B): **riuso vero, non duplicato**, confermato leggendo il codice, non
solo dichiarato nel riepilogo.

**`backend/jet/api.py`**: generalizzazione pulita da "solo TXT" a un insieme
`FORMATI_PROFILABILI = {".txt", ".pdf"}`, usato coerentemente in tutti i punti che prima
controllavano `== ".txt"` (`_raw_rows`, `upload_file`, `get_headers`, `_pratica_txt_or_400`
rinominata `_pratica_profilabile_or_400`, `analyze`). Upload `.pdf` instrada a
`estrai_righe_pdf`/`mappa_righe_pdf`, messaggi d'errore aggiornati per dire "PDF" invece di "TXT"
quando pertinente.

Un piccolo difetto reale ma non bloccante, non dichiarato nel riepilogo: in `_raw_rows`, il messaggio
`"Applica prima un profilo di estrazione TXT"` (409, quando manca il profilo) **non è stato
generalizzato** e dice ancora "TXT" anche per una pratica PDF. Verificato che non è raggiungibile dal
flusso reale: `analyze()` controlla `profilo_estrazione_id is None` **prima** di arrivare a
`_raw_rows` e produce il proprio messaggio corretto ("profilo di estrazione PDF"); l'unico modo per
arrivare al messaggio sbagliato è chiamare `PUT /pratiche/{id}/mappatura` su una pratica PDF senza
profilo — endpoint che il frontend non espone mai per file TXT/PDF (stessa inconsistenza già
segnalata, non bloccante, in Fase B, qui semplicemente estesa al PDF). Da sistemare con comodo,
non blocca l'approvazione.

**`ui/src/jet/JetDashboard.tsx`**: `isTxt` generalizzato a `isProfileFile` (controlla sia `.txt` sia
`.pdf`), `accept` dell'input file esteso, pannello di configurazione profilo riusato integralmente
senza duplicazione di markup — esattamente come dichiarato ("riutilizzando integralmente il pannello
profili"). Letto per intero, coerente con l'API.

## Verifica del conteggio test — risolto il pattern, e trovata la causa reale

Estrazione pulita (`git archive` di `3fd7c73` + venv nuovo, mai la working directory):
**135 test collezionati**, non i "146" dichiarati; suite completa: **133 passati, 2 falliti**
(identici ai due fallimenti OCR pre-esistenti già visti in Fase A/B — `ModuleNotFoundError` per
`PIL`/`paddleocr` assenti nel mio venv minimale, non installo l'intero `requirements.txt` per lo
stesso motivo spiegato nelle fasi precedenti). Delta reale rispetto alla base di Fase B (131):
**+4 test**, esattamente le funzioni nei due file nuovi (`test_jet_ingest_pdf.py`: 2,
`test_jet_api_pdf.py`: 2) — nessuno mancante, nessuno di troppo, nessuna regressione.

Lo scarto fra il numero dichiarato da Codex e quello reale è ancora una volta **+11**
(146-135, e già 142-131 se ricalcolato sulla stessa base) — **lo stesso identico scarto delle due
fasi precedenti**. Questa volta ho voluto capire la causa invece di limitarmi a segnalarlo di nuovo:
la cartella `tests/modules/jet/test_models.py` (segnalata fin dal briefing iniziale come "scope
creep non tracciato" — una reimplementazione parallela in inglese di JET, mai commissionata) contiene
**esattamente 11 funzioni di test**, e **non esiste affatto nella mia estrazione pulita via
`git archive`** — cioè non è tracciata da git a questo commit. La conclusione più probabile è che
Codex esegua la suite nella working directory reale (che contiene quel file non tracciato) invece
che in un ambiente pulito equivalente a quanto consegnato: il numero che riporta non è "sbagliato per
distrazione", è semplicemente il conteggio di una suite che include file estranei al lavoro
consegnato. Non è un problema del codice di Fase C — è un problema di *come Codex verifica se
stesso*, ed è precisamente il tipo di rischio per cui esiste questa supervisione indipendente. Vale
la pena, prima della Fase D, chiedere esplicitamente a Codex di ripulire o isolare quella cartella
(o quantomeno di confermare da quale ambiente esegue i test) invece di continuare a rincorrere lo
scarto fase dopo fase.

## Verifica funzionale indipendente

Non mi sono fidato del solo "test verde": ho rieseguito io stesso, in Python diretto nell'ambiente
pulito, il confronto più importante che il prompt chiedeva come prova di riuso:

- **Confronto carattere per carattere**: le 11 righe estratte dal PDF (incluso il carattere `|` di
  fine riga del fixture) coincidono **esattamente**, una per una, con le 11 righe del TXT originale
  — nessuna differenza, nemmeno di un singolo spazio. Non è un caso fortunato dovuto a un fixture
  comodo: il layout monospaziato del PDF generato con `pagina.insert_text(..., fontname="cour",
  fontsize=8)` è stato ricostruito da PyMuPDF con fedeltà completa.
- **Stesso profilo, stesso risultato**: applicando lo stesso `ProfiloEstrazione` (creato una volta
  sola) sia al TXT sia al PDF, gli oggetti `RigaGiornale` risultanti sono **identici campo per
  campo** (`righe_pdf == righe_txt`, confermato anche a mano, non solo tramite l'assert del test) —
  è la prova più diretta possibile che il riuso del motore di profili funziona davvero, non solo che
  "compila".
- **PDF scansionato rifiutato correttamente**: chiamata diretta a `estrai_righe_pdf` sul fixture
  senza testo solleva `ValueError` con il messaggio **esattamente identico, carattere per carattere**,
  alla costante `ERRORE_PDF_SCANSIONATO` — nessuna lista vuota, nessun fallback silenzioso.
- **End-to-end via API reale**: `test_pdf_riconosce_e_applica_il_profilo_creato_dal_txt` usa
  `TestClient` vero per dimostrare che un profilo creato caricando il TXT viene riconosciuto e
  applicabile caricando il PDF equivalente su una pratica diversa, fino ad analisi completa
  (`numero_registrazioni == 10`) — letto per intero, test onesto, non un giro a vuoto.

Non ho rieseguito `npm run type-check`/`npm run build` in modo indipendente, per lo stesso motivo
già valido in Fase B: la working directory sul Mac ha ancora modifiche locali non commesse
(`requirements.txt`, `ui/package.json`, `ui/src/App.tsx`, `ui/src/components/Sidebar.tsx`) che ne
inquinerebbero l'esito; il diff di `JetDashboard.tsx` letto per intero non presenta nulla di sospetto
dal punto di vista dei tipi, e non ci sono claim di correttezza dei dati che dipendano dal frontend.

## Verdetto

**Fase C approvata.** Lo scope è esattamente quello dichiarato, l'estrazione testuale da PDF
riproduce il layout con fedeltà verificata carattere per carattere, il riuso del motore di profili di
Fase B è reale (stesso profilo, stesso risultato, nessuna duplicazione di logica), il rilevamento di
PDF scansionati funziona con il messaggio esatto richiesto, e il flusso TXT/Excel resta invariato
(confermato dal refactoring additivo e dalla suite pulita senza regressioni: 133/135, gli unici 2
falliti sono pre-esistenti e indipendenti da questa fase).

Note non bloccanti per il futuro: (1) il messaggio d'errore "profilo di estrazione TXT" in
`_raw_rows` non è stato generalizzato per il PDF (irraggiungibile dal frontend reale, cosmetico);
(2) **la causa dello scarto costante di +11 nei conteggi test dichiarati da Codex è stata
identificata**: la cartella `tests/modules/jet/` (scope creep non tracciato, già segnalato) viene
probabilmente inclusa quando Codex esegue la suite nella sua working directory — non è più solo "il
numero è impreciso", è un segnale che Codex non sta testando in un ambiente equivalente a quanto
consegnato. Prima della Fase D vale la pena chiarire questo punto con lui direttamente.

## Prossimo passo

Fase C chiusa. **Puoi procedere con la Fase D** (OCR per PDF scansionati, PaddleOCR già presente nel
progetto) — ti preparo il prompto appena mi dai conferma, includendo questa volta un'istruzione
esplicita a Codex di confermare l'ambiente/il comando esatto con cui esegue `pytest --collect-only`,
per chiudere definitivamente la questione del conteggio.
