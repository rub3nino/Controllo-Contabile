# Journal Entry Testing — specifica funzionale v1.0

**Dal requisito al prodotto**  
Contratto implementativo dei 15 controlli ufficiali e dei moduli ispirati a Caseware  
10 settembre 2026 · proposta pronta per approvazione

> Questa specifica non è codice. Dopo l’approvazione diventa la base per ticket, test automatici e collaudo. Un flag indica una scrittura da approfondire, non un errore o una frode.

## 1. Regole comuni

- Unità distinte: riga, scrittura/Entry ID, conto e popolazione.
- Stati: **attivo**, **non calcolabile**, **non applicabile**, **disattivato**, **errore**.
- “Non calcolabile” non equivale a falso e genera un warning di copertura.
- Completezza, quadratura e sequenza hanno esito separato e peso zero.
- Le scritture di closing sono sempre incluse, indipendentemente dal punteggio.
- I benchmark statistici derivano dalla popolazione originale, mai dai soli sospetti.
- Ogni risultato conserva test/versione, record, valori, formula, parametri, soglia, esito, peso, motivo, fonte e timestamp.

Pipeline: **importa → valida → riconcilia → profila → esegui test → aggrega per Entry ID → score → review → sign-off → export**.

## 2. Scoring iniziale

| Classe | Trattamento |
|---|---|
| Indicatori deboli | Peso 1: dimensione relativa, cifra tonda, weekend, fuori orario, cifre ripetute |
| Indicatori forti | Peso 4: festività, retrodatazione, utente non autorizzato, keyword/parte correlata, descrizione vuota |
| Strutturali | Peso 0: sequenza, quadratura, completezza e validità formato |
| Closing | Lista obbligatoria separata |

Soglia iniziale: totale ≥ 4. Le estensioni non presenti nello standard richiedono approvazione del partner.

## 3. Specifiche dei 15 controlli

### JET-01 — Impatto superiore al 10% dell’utile

**Unità:** riga e totale Entry ID. **Peso:** 1.  
**Input:** importo, utile netto dopo imposte, valuta, periodo.  
**Formula:** soglia = valore assoluto utile × 10%; flag se valore assoluto importo > soglia.  
**Regole:** uguaglianza non scatta; utile e giornale devono avere stesso periodo/valuta. Utile nullo, perdita o benchmark inappropriato producono warning e richiedono benchmark alternativo motivato.  
**Output:** importo, utile, percentuale, soglia e scostamento.  
**Test:** utile 1.000.000; importo 100.000 = falso; 100.000,01 = vero; utile mancante = non calcolabile.

### JET-02 — Importo superiore a 10× la media

**Unità:** riga/scrittura contro popolazione. **Peso:** 1.  
**Formula:** media assoluta = somma valori assoluti / N; flag se importo > 10 × media.  
**Regole:** calcolo automatico dopo deduplica; esclusi totali e intestazioni; vietata la media algebrica Dare/Avere. Conservare numeratore, denominatore e versione della popolazione.  
**Estensione Caseware:** test RSF separato: massimo/secondo massimo per conto, utente o tipo documento.

### JET-03 — Performance materiality

**Unità:** riga e scrittura. **Peso:** 1.  
**Fonte:** file Global Focus approvato.  
**Formula:** flag se valore assoluto importo > PM applicabile.  
**Metadati obbligatori:** overall/PM/specifica, valuta, entità, periodo, versione, preparer e reviewer. Overall materiality non alimenta questo flag. Valori non approvati non sono utilizzabili.

### JET-04 — Cifre tonde

**Unità:** riga. **Peso:** 1.  
**Parametri:** multipli 10.000 e 100.000, importo minimo, valuta, considera/ignora decimali.  
**Formula:** flag se importo modulo multiplo = 0. Se 100.000 soddisfa entrambi, mostrare il livello massimo e assegnare un solo peso.  
**Test:** 20 = falso; 10.000 = livello 10k; 100.000 = livello 100k.

### JET-05 — Weekend e festività

**Unità:** scrittura. **Pesi:** weekend 1; festività 4.  
**Input:** data creazione, data effettiva, Paese/sede, calendario versionato.  
**Calendari:** Italia, Germania, Francia e Spagna, con festività locali e chiusure cliente.  
**Regole:** usare la data tecnica per l’attività dell’utente; mantenere eventuale flag distinto sulla data effettiva. Se weekend e festività coincidono, conservare entrambi i motivi ma applicare di default solo il peso maggiore.

### JET-06 — Fuori orario

**Unità:** scrittura. **Peso:** 1. **Default:** 08:00–18:00 configurabile.  
**Formula:** ora < inizio oppure ora > fine. Gli estremi non scattano.  
**Regole:** fuso orario, sede, turni e closing configurabili; account batch classificati separatamente. Ora mancante = non calcolabile.

### JET-07A — Retrodatazione e forward dating

**Unità:** scrittura. **Peso retrodatazione:** 4.  
**Formula:** delta = data creazione − data effettiva; backdated se delta ≥ soglia; forward dated se delta < 0.  
**Output:** entrambe le date, giorni calendario/lavorativi e tipo anomalia.

### JET-07B — Finestra di closing

**Esito:** lista obbligatoria, non subordinata allo score.  
**Default:** chiusura 31/12 modificabile; ultimi 5 giorni lavorativi.  
**Regole:** selezionare data effettiva nella finestra e, separatamente, scritture create dopo la chiusura con competenza precedente.

### JET-08 — Utenti e segregation of duties

**Unità:** scrittura. **Peso non autorizzato:** 4.  
**Input:** preparer, approver, ruoli, validità accessi e account tecnici.  
**Formula:** preparer fuori whitelist valida alla data; SoD se preparer = approver.  
**Regole:** controllo Attivo/Non applicabile/Dato non disponibile con motivazione; SoD è esito distinto.

### JET-09 — Descrizione vuota, corta o generica

**Unità:** riga e testata. **Peso vuota:** 4.  
**Formule:** testo normalizzato vuoto; lunghezza ≤ N; match con dizionario di causali generiche.  
**Estensione Caseware:** famiglia “Dati mancanti” anche per ID, conto, data, ora, utente, valuta e periodo; mostrare tasso di completezza e bloccare sui campi critici.

### JET-10 — Conto raro

**Unità:** conto nell’intero esercizio. **Peso proposto:** 4, da approvare.  
**Formula:** conteggio Entry ID distinti per conto nella fascia 1–4.  
**Regole:** file infrannuale = provvisorio/non calcolabile; mostrare anche numero righe.  
**Estensione Caseware:** frequenza percentuale delle combinazioni Dare/Avere e confronto storico.

### JET-11 — Sequenza e pagine

**Unità:** serie documentale. **Peso:** 0.  
**Parametri:** campo, prefisso, sezionale, limiti, reset e annullati.  
**Algoritmo:** normalizzare, ordinare, deduplicare, calcolare successori, segnalare gap; supportare pattern alfanumerici configurati. Gap grandi sono riepilogati.  
**Pagine:** estrarre numero pagina, rilevare mancanti, duplicati e ordine errato; risultato separato dalla completezza contabile.

### JET-12 — Pattern numerici ricorrenti

**Unità:** riga. **Peso proposto:** 1.  
**Parametri:** pattern/N cifre, posizione, parte intera/decimali, importo minimo, esclusione tondi.  
**Regole:** lavorare sulla rappresentazione decimale canonica. 15.777 con tre cifre finali = vero; 86.514,99 con due centesimi ripetuti = vero; 1.000 escluso se “ignora tondi”.

### JET-13 — Second-level review

**Unità:** caso aggregato per Entry ID. **Peso:** nessun nuovo punto automatico.  
**Stati:** Nuovo → Assegnato → Evidenze richieste → In revisione → Giustificato/Errore/Rettifica/Escalation → Approvato.  
**Regole:** filtri AND/OR/NOT salvabili; benchmark invariati; dossier unico con righe, motivi, documenti, owner, cronologia e sign-off.

### JET-14 — Validità del conto

**Unità:** conto. **Peso:** 0 qualità dati; 1 solo se approvato come rischio.  
**Controlli distinti:** lunghezza >10 se applicabile, regex, segmenti, presenza e validità nel piano dei conti.  
**Regola:** mai applicare globalmente “oltre 10 cifre”; configurare per ERP.

<div class="page"></div>

### JET‑15 — Keyword, visura e poteri

**Unità:** riga/scrittura e anagrafiche. **Peso keyword forte:** 4.  
**Keyword:** liste standard, caricate o manuali; categorie; match esatto/parziale; case sensitivity; termine e campo trovati.  
**Visura:** OCR locale → estrazione persone/cariche/poteri → conferma umana → mapping persona-user ID → join con scritture. La visura prova poteri legali, non accesso tecnico.  
**Sicurezza:** ruoli, retention, log e nessuna etichetta automatica di persona sospetta.

## 4. Moduli aggiuntivi da Caseware

| ID | Modulo | Algoritmo | Uso | Priorità |
|---|---|---|---|---|
| DAT-01 | Missing Information | Vuoto/zero/lunghezza ≤ N per tipo campo | Qualità e copertura | P0 |
| INT-01 | Out of Balance | Somma per Entry ID oltre tolleranza | Integrità scrittura | P0 |
| ACC-01 | Unusual Account Combinations | Frequenza combinazione/popolazione | Contropartite insolite | P1 |
| ACC-02 | Complex Account Combinations | Conti distinti per Entry ID ≥ N | Complessità | P2 |
| STA-01 | Relative Size Factor | Massimo/secondo massimo per gruppo | Outlier contestuali | P2 |
| CMP-01 | Comparisons | =, ≠, >, ≥, <, ≤ fra campi | SoD, date, incoerenze | P2 |
| DAT-02 | Join | Inner/left/outer/no-match | Arricchimento anagrafiche | P1 |

Out of Balance precede lo scoring: tutte le righe dell’Entry ID con saldo oltre la tolleranza di valuta vengono riportate. Unusual Combinations usa la firma ordinata dei conti; il 3% Caseware è solo un punto di partenza da validare. RSF opera solo su gruppi con almeno due record.

## 5. Requisiti di piattaforma

| Componente | Requisito |
|---|---|
| Catalogo | Test autonomi, versionati e con dipendenze dichiarate |
| Filtri | AND/OR/NOT, tipi coerenti e anteprima conteggio |
| Aggregazione | Un dossier per Entry ID con tutti i motivi |
| Audit trail | Import, parametri, run, override, stato e sign-off |
| Template | Standard studio più override cliente motivato |
| Export | Excel/CSV e carta di lavoro con formula, fonte e conclusione |
| Performance | Batch/stream; nessuna enumerazione incontrollata dei gap |
| Sicurezza | Ruoli, cifratura, retention e protezione visure/user ID |

## 6. Piano di implementazione

1. **P0 — Contratti:** catalogo, unità, stati, scoring, qualità dati e quadratura.
2. **P1 — Fondazioni:** Entry ID, join, calendari, closing, media automatica e risultati aggregati.
3. **P2 — Analisi:** 15 test, combinazioni, RSF, pattern e comparisons.
4. **P3 — Workflow:** stati, evidenze, reviewer, checklist ed export carta di lavoro.
5. **P4 — Intelligence:** OCR visura e analisi cross-entity con privacy review.

## 7. Gate di approvazione

1. Partner approva pesi, soglie e closing.
2. Manager approva fonti, calendari, whitelist e dizionari.
3. Ogni scheda diventa test positivo, negativo, boundary e missing-data.
4. Validazione su fixture sintetiche, poi caso reale riconciliato manualmente.
5. Nessun default cambia senza nuova versione.

> **Definizione di pronto:** ogni risultato è riproducibile, spiegabile e collegato a una procedura; la copertura è visibile; reviewer diversi ottengono la stessa popolazione dalla stessa configurazione.

## Fonti

Documento ufficiale JET fornito; ISA Italia 240; Global Focus/Baker Tilly come riportato nel documento; documentazione ufficiale Caseware: Analytics Hub, Customize analytic tests, Date Entries, Rounded Values, Missing Information, Keywords, Gaps, Relative Size Factor, Recurring Numeric Pattern, Comparisons, Join, Out of Balance Entries, Unusual e Complex Account Combinations, Define materiality e Transaction details. La disponibilità Caseware varia per prodotto/template.
