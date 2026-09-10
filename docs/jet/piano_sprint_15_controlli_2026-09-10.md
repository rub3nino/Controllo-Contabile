# Piano di implementazione — sprint JET "15 controlli"

Data: 10 settembre 2026
Riferimenti: `Specifica_funzionale_tecnica_JET_v1.0_20260910.pdf`, documento "JET — 15 controlli: stato e confronto" (10/09/2026), discussione di pianificazione del 10/09/2026.

## Come si usa questo documento

Non è un elenco di scadenze fisse, è una sequenza di checkpoint. Ogni "Giorno" corrisponde a un controllo. Si passa al giorno successivo solo quando Ruben ha verificato di persona, su dati reali, che il controllo restituisce esattamente il dato atteso — non quando il calendario dice che è ora. Se un giorno richiede una correzione o slitta, tutti i giorni successivi si spostano della stessa misura: non si comprime la verifica per stare nei tempi.

Per ogni giorno: cosa si implementa (con i valori esatti già decisi), cosa non va toccato, cosa deve controllare Ruben per dare l'ok, e il criterio con cui si considera chiuso. Il prompt dettagliato per chi implementa (Codex/Claude Code/Cursor) si scrive giorno per giorno, non tutti insieme: viene scritto subito prima di ogni giornata, numerato progressivamente in `docs/prompts/` a partire da `27_...`.

In fondo al documento c'è una tabella di stato da aggiornare mano a mano.

## Decisioni architetturali di riferimento

Queste valgono per tutti i controlli, non si ridiscutono a ogni giorno salvo che emerga un problema concreto in verifica.

- **Persistenza**: invariata. `storage/jet.sqlite3` resta il database delle pratiche e dei risultati, sul Mac, mai sul repository (già in `.gitignore`, verificato).
- **Entry ID**: quando il file non ha una colonna identificativo esplicita, in fase di mappatura l'utente indica quale combinazione di colonne identifica una scrittura (es. data + numero documento + sezionale). Se non è possibile nemmeno quello, l'analisi resta a livello di riga e i controlli che richiedono la scrittura intera (quadratura, conto raro, dossier) risultano "non calcolabile" su quel file.
- **Punteggio**: ogni criterio contribuisce al massimo una volta per Entry ID, anche se più righe della stessa scrittura lo attivano.
- **Dettaglio dei risultati salvati**: formula, parametri, soglia, motivo completi solo per le righe segnalate e per i "non calcolabile". Per le righe che passano il test si salva solo l'esito sintetico più il riferimento alla versione di configurazione usata.
- **Pesi e soglie**: default di studio versionato, override per pratica con motivazione registrata nel log. Nessun sistema di ruoli reale per ora: chiunque può attivare, disattivare o modificare un test. Ogni peso ha un'etichetta "proposto" oppure "approvato dal partner" — i pesi presi dalla specifica ma non ancora confermati dal partner (backdating, festività, staff non autorizzato, descrizione vuota, keyword, conto raro) restano "proposto" finché non arriva conferma esplicita.
- **Soglia di approfondimento**: fissa a 4. Si riproporziona automaticamente solo se il numero di test attivi scende sotto 8; altrimenti resta 4.
- **Stati di un test**: attivo, disattivato (scelta dell'utente), non applicabile (il cliente non ha quel dato), non calcolabile (parametro mancante a runtime). Nell'interfaccia serve una legenda visibile che spiega la differenza fra i quattro.
- **Orario d'ufficio**: il default 8:00–18:00 è solo un valore precompilato nell'interfaccia, mai un fallback nel motore — il modulo dichiara esplicitamente nel proprio codice che nessun default può essere nascosto nella logica di calcolo, e questo vincolo va rispettato.
- **Configurazione controlli**: si vede e si può modificare a ogni apertura della pratica, non si congela dopo il primo salvataggio.

## Fuori scope per questo sprint

Non vanno implementati, e non vanno nemmeno riaperti in discussione salvo indicazione esplicita di Ruben:

- **JET-13**, ri-analisi di secondo livello sui soli sospetti — in pausa, non se ne tiene conto nemmeno parzialmente (niente aggregazione preparatoria).
- **JET-11**, test di sequenza per pagina/numerazione bollata.
- **JET-15**, la parte OCR sulla visura camerale (estrazione nominativi/cariche) — stesso profilo di rischio della Fase D già sospesa.
- Moduli aggiuntivi Caseware: DAT-01 (Missing Information), INT-01 (Out of Balance), ACC-01/ACC-02 (Unusual/Complex Account Combinations), STA-01 (Relative Size Factor), CMP-01 (Comparisons), DAT-02 (Join).
- Import automatico della materialità dal file Global Focus — resta inserimento manuale con l'icona informativa che spiega dove reperire il valore.
- Segregation of duties (preparer = approver).
- Multilingua sulle keyword.
- Revisione formale dei 5 commit sul multi-fonte già presenti su `main` — resta da fare, ma non è parte di questo sprint.

## Piano giorno per giorno

### Giorno 1 — Correzione pesi degli indicatori forti standard

Obiettivo: allineare allo standard Baker Tilly i quattro pesi che oggi sono precompilati a 1 nel form di creazione pratica, ma dovrebbero valere 4 (indicatore forte). Verificato sul codice: il motore (`criteri.py`, `models.py`) non ha nessun default nascosto, i pesi sono sempre un valore che l'utente imposta; l'unico posto dove esiste un "1" di partenza è l'oggetto `EMPTY` in `ui/src/jet/JetDashboard.tsx`, precompilato quando si apre una nuova pratica. È quindi una modifica a un solo file, senza toccare backend o modelli.

Implementare: nell'oggetto `EMPTY` di `ui/src/jet/JetDashboard.tsx`, cambiare da 1 a 4 il valore precompilato di `punteggio_festivita`, `punteggio_backdated`, `punteggio_staff_non_autorizzato`, `punteggio_descrizione_vuota`. Restano modificabili dall'utente come oggi, cambia solo cosa vede la prima volta che apre una nuova pratica. `soglia_da_investigare` è già 4, nessuna modifica lì.

Non toccare: `punteggio_conto_insolito_raro` e `soglia_frequenza_insolita` restano `null` come oggi — è un'estensione non standard, non ancora approvata dal partner, e oggi non esiste un modo per disattivarla esplicitamente se la precompiliamo attiva (il toggle attivo/disattivato arriva solo al Giorno 8). Attivarla per default adesso significherebbe accendere silenziosamente un controllo non approvato senza un modo per spegnerlo: si rimanda a quando il toggle esiste. Nessuna logica in `criteri.py`, nessun modello, nessun test esistente da aggiornare (verificato: i test in `tests/test_jet_*.py` impostano questi pesi esplicitamente per ogni caso, non dipendono da un valore di default).

Verifica di Ruben: rilanciare l'analisi su un dataset reale già noto (Nordson o ALUK) e controllare a mano, su un campione di righe che avevano già flag festività/backdating/staff/descrizione attivi, che il punteggio totale rifletta i nuovi pesi.

Fatto quando: i punteggi ricalcolati coincidono con l'aspettativa di Ruben sul campione controllato a mano.

### Giorno 2 — Media automatica (JET-02)

Obiettivo: calcolare `valore_medio_registrazione` dalla popolazione caricata invece di riceverlo come valore inserito a mano — priorità dichiarata da Ruben fin dall'inizio.

Implementare: media dei valori assoluti sulle righe, zeri esclusi dal denominatore, calcolata su tutte le fonti della pratica dopo deduplica; se il periodo caricato è parziale, un warning visibile (non un blocco).

Non toccare: il campo resta comunque sovrascrivibile a mano se un revisore vuole forzare un valore diverso.

Verifica di Ruben: calcolare a mano la media assoluta su un dataset reale (ad esempio sommando gli importi assoluti di un sottoinsieme noto) e confrontarla con quella prodotta dal sistema.

Fatto quando: il numero coincide al centesimo con il calcolo manuale di Ruben.

### Giorno 3 — Cifre tonde configurabili

Obiettivo: sostituire la regola attuale (`importo % 10 == 0`) con una soglia scelta dall'utente.

Implementare: tendina con 10.000 / 100.000 / 1.000.000 / valore custom; flag opzionale "segnala anche i multipli superiori" (se attivo su 10.000, un importo da 100.000 viene comunque segnalato); nessun campo importo minimo separato.

Verifica di Ruben: testare con importi noti (es. 20.000 con soglia 10.000 deve risultare vero, con soglia 100.000 deve risultare falso a meno che il flag "multipli superiori" non sia attivo).

Fatto quando: tutti i casi di prova concordati con Ruben si comportano come atteso.

### Giorno 4 — Calendari nazionali, parte 1: dataset

Obiettivo: costruire il dataset statico delle festività e dei giorni di weekend per i nove paesi concordati.

Implementare: dataset versionato per Italia, Germania, Francia, Spagna, Israele (weekend venerdì–sabato, calendario ebraico con date gregoriane), Stati Uniti (solo festività federali), Malta, Irlanda, Cipro — copertura anni 2024–2030 (ridotta da 2015–2030 per restare nei tempi della settimana, come concordato).

Verifica di Ruben: controllare a campione le date di un paese contro un calendario ufficiale esterno (es. le festività italiane 2026).

Fatto quando: il campione controllato da Ruben è corretto.

### Giorno 5 — Calendari nazionali, parte 2: integrazione

Obiettivo: collegare il dataset del Giorno 4 ai controlli weekend e festività, con override per cliente.

Implementare: selezione del paese nei parametri della pratica; weekend e festività derivati automaticamente dal paese scelto, con possibilità di aggiungere chiusure aziendali specifiche del cliente; se weekend e festività coincidono sullo stesso giorno, si applica solo il peso maggiore (festività) ma si conservano entrambi i motivi in dettaglio.

Verifica di Ruben: rilanciare l'analisi su un dataset reale con un paese impostato e controllare a mano che le date segnalate corrispondano davvero a weekend/festività di quel paese.

Fatto quando: il campione controllato da Ruben è corretto.

### Giorno 6 — Retrodatazione

Obiettivo: sostituire il calcolo generico con uno basato su giorni lavorativi e separare il forward dating.

Implementare: soglia di default 1 giorno lavorativo (configurabile); il delta si calcola in giorni lavorativi usando il calendario del paese della pratica; se il paese non è configurato, ricade sui giorni di calendario e lo registra nel risultato quale metodo ha usato; forward dating come motivo separato sotto lo stesso controllo, peso 0 (strutturale, non genera punteggio).

Verifica di Ruben: controllare a mano, su scritture reali con date note, che il conteggio dei giorni lavorativi sia corretto attorno a un weekend/festività.

Fatto quando: il campione controllato da Ruben è corretto.

### Giorno 7 — Finestra di chiusura (JET-07B)

Obiettivo: introdurre il controllo oggi completamente assente.

Implementare: data di chiusura configurabile, default 31/12; finestra sugli ultimi 5 giorni lavorativi (configurabile), calcolata sul calendario del paese del cliente; lista obbligatoria separata (non subordinata al punteggio, come da specifica), che include sia le scritture con data effettiva nella finestra sia quelle create dopo la chiusura con competenza nel periodo precedente, in due elenchi distinti.

Verifica di Ruben: su un dataset reale, controllare a mano quali scritture cadono nella finestra attorno al 31/12 (o alla data di chiusura scelta) e confrontarle con l'output.

Fatto quando: il campione controllato da Ruben è corretto.

### Giorno 8 — Toggle e stato dei test

Obiettivo: rendere esplicito ciò che oggi è implicito.

Implementare: interruttore attivo/disattivato/non applicabile per ciascun test, visibile in una schermata di configurazione stile catalogo; etichetta "peso proposto" / "peso approvato dal partner" per ogni test; indicatore di copertura in testa ai risultati (quanti test erano calcolabili); riproporzionamento della soglia di approfondimento se i test attivi scendono sotto 8, altrimenti resta fissa a 4; legenda che spiega i quattro stati. In questo giorno rientra anche quanto rimandato dal Giorno 1: il conto insolito/raro va precompilato come "disattivato di default" con peso 4 e soglia frequenza 10 già impostati ma non attivi, così l'estensione non approvata resta spenta finché qualcuno non la accende esplicitamente.

Verifica di Ruben: disattivare un test dall'interfaccia e controllare che il punteggio totale e la soglia si comportino come atteso; riattivarlo e controllare che torni tutto come prima.

Fatto quando: il comportamento coincide con quanto Ruben si aspetta su almeno due scenari di attivazione/disattivazione diversi.

### Giorno 9 — Estrazione codici operatore

Obiettivo: dare a Ruben uno strumento usabile per il controllo umano degli utenti, non un'interfaccia con spunte.

Implementare: dopo l'import, generare un elenco dei codici operatore distinti trovati nel file con il numero di scritture per ciascuno; esportabile (Excel/CSV) per il controllo manuale, separato dall'export principale dei risultati.

Verifica di Ruben: controllare su un file reale che l'elenco dei codici e i relativi conteggi corrispondano a quanto si vede aprendo il file sorgente.

Fatto quando: l'elenco coincide con il controllo manuale di Ruben.

### Giorno 10 — Cifre finali ripetute (JET-12)

Obiettivo: nuovo controllo, ispirato al test "Recurring Numeric Pattern" di Caseware.

Implementare: sulla parte intera dell'importo (i decimali vengono ignorati, coerente con il comportamento Caseware); scelta fra combinazione di cifre specifica (default 999) o numero di cifre ricorrenti (default 3), posizione inizio/fine/interna; opzione "ignora importi tondi" per ridurre i falsi positivi. Nessuna gestione dei centesimi ripetuti in questa fase.

Verifica di Ruben: testare con importi noti (es. un importo che termina per 999 con la configurazione di default deve risultare vero).

Fatto quando: tutti i casi di prova concordati con Ruben si comportano come atteso.

### Giorno 11 — Conto oltre 10 cifre (JET-14)

Obiettivo: nuovo controllo di validità formale del conto.

Implementare: soglia di lunghezza configurabile per cliente/piano dei conti (default 10 cifre, ma modificabile), applicata solo se il cliente ha attivato il controllo — nessuna regola fissa globale.

Verifica di Ruben: su un file reale, controllare che i conti oltre la soglia impostata vengano segnalati e quelli sotto no.

Fatto quando: il campione controllato da Ruben è corretto.

### Giorno 12 — Keyword (JET-15, parte testuale)

Obiettivo: attivare la ricerca di parole chiave riusando il meccanismo già esistente per le parti correlate.

Implementare: lista italiana di partenza (bozza già scritta, da rivedere insieme prima di questo giorno), corrispondenza esatta per parola intera, ricerca nel campo descrizione/causale, peso 4 (etichettato "proposto").

Verifica di Ruben: controllare su un dataset reale che le righe con una delle parole della lista vengano segnalate e che parole simili ma diverse (es. "cassazione") non lo siano.

Fatto quando: il campione controllato da Ruben è corretto.

### Giorno 13 — Buffer

Obiettivo: assorbire le correzioni emerse nei giorni precedenti. Storicamente ogni fase di questo progetto ha fatto emergere almeno una sorpresa reale in verifica — questo giorno esiste per quello, non è tempo libero aggiuntivo.

Se non emerge nulla da correggere, si anticipa il Giorno 14.

### Giorno 14 — Export

Obiettivo: potenziare l'export e produrne un secondo separato, come deciso.

Implementare: Excel principale arricchito con i metadati (popolazione totale, filtri applicati, configurazione usata, percentuale di righe e di scritture segnalate); secondo file separato "carta di lavoro" con formula, fonte, parametri e conclusione per ogni test eseguito.

Verifica di Ruben: aprire entrambi i file su un'analisi reale e controllare che i numeri di sintesi (percentuali, conteggi) coincidano con quanto visibile nell'interfaccia.

Fatto quando: entrambi i file sono coerenti con l'interfaccia secondo Ruben.

### Giorno 15 — Revisione finale

Obiettivo: chiusura dello sprint.

Attività: rilancio dell'intera pipeline su un dataset reale end-to-end con tutti i controlli implementati attivi; verifica indipendente di scope (diff, test in ambiente pulito) come da metodologia del progetto; revisione datata con esito.

Discussione da aprire, non da chiudere in questa sprint: prossimi passi per la ri-analisi di secondo livello (JET-13) e per l'OCR della visura (JET-15), oltre alla revisione formale ancora aperta dei 5 commit sul multi-fonte.

## Tabella di stato

| Giorno | Controllo | Stato | Data conferma Ruben | Note |
|---|---|---|---|---|
| 1 | Pesi e soglie | Approvato (verifica tecnica) | | branch `codex/jet-pesi-indicatori-forti` (5522f67) — scope ridotto ai 4 pesi standard, conto raro spostato al Giorno 8 |
| 2 | Media automatica (JET-02) | Approvato dal punto di vista tecnico — in attesa di conferma di Ruben su dati reali | | branch `codex/jet-media-automatica` (380475c). Vedi `revisione_giorno1_giorno2_2026-09-10.md` |
| 3 | Cifre tonde configurabili | Approvato | | branch `codex/jet-cifra-tonda-configurabile` (3960f33). Vedi `revisione_giorno3_2026-09-10.md` |
| 4 | Calendari nazionali — dataset | Approvato (Israele vuoto, Spagna 2027-2030 vuota — intenzionale, in attesa di fonti ufficiali) | | branch `codex/jet-calendari-nazionali` (23b2e6d). Date mobili ricalcolate indipendentemente e coincidenti al 100% per DE/FR/IT/CY/US. Vedi `revisione_giorno4_2026-09-10.md` |
| 5 | Calendari nazionali — integrazione | Prompt pronto (corretto dopo la verifica del Giorno 4 per gestire i Paesi con dataset vuoto come "non calcolabile") | | |
| 6 | Retrodatazione | Da iniziare | | |
| 7 | Finestra di chiusura (JET-07B) | Da iniziare | | |
| 8 | Toggle e stato dei test | Da iniziare | | |
| 9 | Estrazione codici operatore | Da iniziare | | |
| 10 | Cifre finali ripetute (JET-12) | Da iniziare | | |
| 11 | Conto oltre 10 cifre (JET-14) | Da iniziare | | |
| 12 | Keyword (JET-15 testuale) | Da iniziare | | |
| 13 | Buffer | Da iniziare | | |
| 14 | Export | Da iniziare | | |
| 15 | Revisione finale | Da iniziare | | |
