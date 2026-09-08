# Regole del template — Controllo contabile trimestrale (SA Italia 250B)

File di riferimento per l’applicazione e per chi la sviluppa.
Tutto ciò che è **APERTO** è un buco: non inventare. Chiedere a Ruben.

Fonte originale analizzata: `Template GF wps verifica trimestrale II TRIM .xlsx` (istanza Ferrero II trim 2026, usata per capire la struttura).  
Master pulito: `Template_MASTER.xlsx`  
Aggiornato: 2026-09-08

**Decisioni chiuse da Ruben (2026-09-08):**
1. Questo Excel è la **base unica per tutti i clienti**, non solo Ferrero.
2. Ogni trimestre si parte dal master vuoto + **i documenti nuovi** forniti dal cliente (non dai numeri del trimestre precedente).
3. Documento assente = `wip`. La `✗` è solo per i controlli **saltati** (non c’è bisogno di farli).
4. L’app **può scrivere** gli status sull’INDICE (regole in §4.1).
5. I punti che non tornavano nel file Ferrero sono **errori umani**. Il master va pulito da quei dati.

---

## 1. Cos’è questo file

Working Paper Set (WPS) del **controllo contabile trimestrale** del Collegio Sindacale / revisore, ex art. 2409-ter c.c., secondo il **principio di revisione SA Italia 250B**.

Normativa (link in `INDICE!A3`):
https://revisionelegale.rgs.mef.gov.it/area-pubblica/export/mef/resources/PDF/SA-Italia-250B-15.06.2022.pdf

Due anime nello stesso workbook:

1. **Richiesta doc** — checklist documenti da chiedere al cliente e stato di ricezione.
2. **Carte di lavoro A–I** — dove si svolge (o si registra) il controllo vero e proprio.

L’`INDICE` è il cruscotto: anagrafica, periodo, status delle sezioni, team, conclusione.

Il file è usato in Excel + **DataSnipper** (add-in di revisione: documenti embeddati e “snip” di evidenza). I fogli `DS_INTERNAL_*` sono di DataSnipper: **l’app non li deve toccare**.

Vive in una document library SharePoint (metadati Senior / Assistente / Manager / Condivisa). Percorso storico documenti cliente (Q1 2026):

```
H:\Torino\Clienti BP 2014\Gruppo Ferrero SpA\3.Gruppo Ferrero 2026\3_Revisione legale\I Trimestre 2026\
  4.4_Riconciliazioni bancarie\
  7.1_Analisi Situazione periodica\
```

Hyperlink residui nel foglio E (cartella di lavoro attesa accanto all’Excel):

```
files\andamento\bilancino 30-06-25 attivo-passivo.xlsx   → saldi contabili (co.ge)
files\banche                                              → estratti conto
```

---

## 2. Identità del master (tutti i clienti)

Il file di lavoro **nasce sempre** da `Template_MASTER.xlsx`. Cliente, periodo e tabelle si riempiono a ogni pratica.

| Campo | Cella | Nel master | Chi lo aggiorna |
|---|---|---|---|
| Cliente | `INDICE!A1` | `[CLIENTE]` | App / operatore |
| Titolo | `INDICE!D1` | CONTROLLO CONTABILE TRIMESTRALE | Fisso |
| Periodo | `INDICE!M1` | `[PERIODO]` | App / operatore (es. APRILE - GIUGNO 2026) |
| Data invio richiesta | `INDICE!F5` | vuota | App / operatore |
| Data svolgimento | `INDICE!F6` | vuota | App / operatore |
| Attività svolta da | `INDICE!C28` | vuota | Operatore (iniziali) |
| Rivista da | `INDICE!C29` | vuota | Reviewer |

Formule di testata (ripetute in A–I, corrette nel master):

- `B1` = `=+INDICE!A1` (cliente)
- `B2` = `=+INDICE!M1` (periodo)
- `B3` = `=INDICE!C28` (fatto da)
- `B4` = `=+INDICE!C29` (rivisto da) dove la riga esiste
- `B5` = `=INDICE!F6` (data svolgimento) — **non** F5

`INDICE!A5` resta l’etichetta con link a Richiesta doc. La data sta in `F5`.

---

## 3. Flusso di lavoro (come lo usano)

```
1. Parte il trimestre
   → si aggiorna INDICE!M1
   → su Richiesta doc si aggiunge/si rende visibile il blocco colonne del trimestre
   → si invia la richiesta documenti al cliente (art. 2409-ter)

2. Arrivano i documenti nella cartella cliente
   → su Richiesta doc, colonna "Doc. ricevuto" del trimestre corrente: ✓ / ✗ / wip / N/A
   → note cliente / note BT

3. Si compilano le carte A–I con i dati estratti
   → header preso da INDICE
   → tabelle (F24, banche, libri, bilancino)
   → eventuale snip DataSnipper / note Word (foglio F)

4. Si marca lo status della sezione su INDICE!F10:F18
   → tendina ✓ / ✗ / N/A / wip
   → colori condizionali

5. Si scrive la CONCLUSIONE DEI CONTROLLI (casella di testo su INDICE, area H5:M29)
   → oggi è vuota
```

L’app fa i passi 2, 3 e 4. Il passo 5 (conclusione) resta umano.

Ogni pratica: **master vuoto + cartella documenti di quel trimestre**. Non si ereditano saldi/status dal file del trimestre prima.

---

## 4. Codici di stato (chiuso 2026-09-08)

Valori ammessi (tendina). Colori da formattazione condizionale:

| Codice | Significato **vero** | Si usa quando | Colore |
|---|---|---|---|
| `✓` | Fatto / documento trovato e usabile | Il file c’è, o il controllo della sezione è compiuto | verde `#C6EFCE` |
| `wip` | Work in progress | **Documento assente**, parziale, o sezione ancora aperta | ambra `#FFEB9C` |
| `✗` | Controllo **saltato** | Non c’è bisogno di fare quel controllo. Non è un mancante | rosso `#FFC7CE` |
| `N/A` | Non applicabile al cliente | La cosa non esiste per questo cliente (es. niente Intrastat). Stesso effetto di skip sui mancanti | grigio |

**Regole:**

- Documento che doveva esserci e non c’è → `wip` (mai `✗`).
- `✗` solo se si salta il controllo / non si richiede quella cosa.
- `N/A` = strutturalmente non esiste per il cliente; `✗` = scelta di non farlo in questo trimestre. Sui mancanti si comportano uguale (esclusi dalla lista).
- Scrivere sempre `N/A`, mai `n/a`.

Report **documenti mancanti** = righe Richiesta doc del trimestre corrente con status `wip` oppure vuoto.  
Esclusi: `✓`, `✗`, `N/A`.

### 4.1 Cosa comporta scrivere gli status sull’INDICE

L’INDICE `F10:F18` non è la checklist documenti. È il **semaforo delle 9 carte di lavoro**. Ogni lettera A–I dice: questa sezione è chiusa, aperta, o saltata.

Se l’app scrive quelle 9 celle, succede questo:

1. Aprendo il file, l’operatore vede subito verde/ambra/rosso sull’indice, senza entrare nei fogli.
2. Il valore **non è una formula Excel**: è un testo che l’app calcola e incolla. Un umano può sovrascriverlo a mano dopo.
3. Non completa da sola la conclusione (casella H5:M29). Non firma. Non decide la materialità.

**Regola di calcolo (conservativa):** per ogni sezione si guardano gli item di Richiesta doc collegati + se la carta ha i campi meccanici pieni.

| Esito | Quando l’app scrive |
|---|---|
| `✗` | Tutti gli item collegati sono `✗` o `N/A` (la sezione intera è saltata / non applicabile). |
| `✓` | Ogni item collegato non saltato è `✓` **e** i campi meccanici della carta sono compilati (es. E: almeno saldo e/c; C: almeno i F24 del trimestre; G: almeno una riga di bilancino). |
| `wip` | Tutto il resto: manca un documento, tabella incompleta, o la sezione è solo giudizio (A, D, H, I) e l’umano non ha ancora chiuso. |

Esempi:

- Estratti arrivati tutti, riconciliazioni saltate (`✗`), CR `N/A`, tabella E con saldi e/c → sezione E = `✓`.
- Manca anche un solo estratto → E = `wip`, e quel F.1 sta nel report mancanti.
- Si decide di non fare il test campionario (D) → D = `✗`. Nessun documento “mancante”.
- Colloqui (H): nessun documento in checklist. Resta `wip` finché un umano non mette `✓` o `✗`. L’app **non** marca H come `✓` da sola.

Cosa **non** significa il `✓` automatico: “il revisore ha concluso e firma”. Significa: “documenti della sezione trovati e campi compilabili riempiti”. La firma resta `Rivista da` + conclusione.

Se un umano ha già messo `✗` o `N/A` sull’INDICE, l’app non lo sovrascrive con `✓` o `wip`. Lo skip è una decisione, non un vuoto da riempire.

---

## 5. Due alfabeti (non confonderli)

Le lettere **non coincidono**.

### Carte di lavoro (INDICE A–I)

| Sez. | Foglio | Argomento | Nel master |
|---|---|---|---|
| A | `A` | Sistema di controllo interno | vuoto (poi calcolato) |
| B | `B` | Libri obbligatori | vuoto |
| C | `C` | Adempimenti tributari e previdenziali | vuoto |
| D | `D` | Test su rilevazioni contabili | vuoto |
| E | `E` | Disponibilità liquide | vuoto |
| F | `F` | Lettura verbali Organi sociali e di Controllo | vuoto |
| G | `G` | Analisi situazione contabile periodica | vuoto |
| H | `H` | Colloqui con la Direzione | vuoto |
| I | `I` | Operazioni particolarmente significative | vuoto |

Lo status `INDICE!F10:F18` lo scrive l’app con la regola §4.1. L’umano può correggere.

### Checklist richiesta (Richiesta doc A–G)

| Gruppo | Cosa si chiede al cliente |
|---|---|
| A | Informazioni di carattere generale (SCI, fatti significativi, cartelle, transazioni anomale) |
| B | Bilancio e scritture (bilancino, CE/budget, budget/cashflow, libro giornale txt) |
| C | Libri sociali (assemblee, CDA, collegio, libro soci) |
| D | Libri fiscali/contabili (giornale definitivo, inventari, registri IVA) |
| E | Adempimenti tributari (F24, fondi, LIPE, IVA annuale, Intrastat) |
| F | Banche (estratti, riconciliazioni, Centrale Rischi) |
| G | Personale (cedolini/prima nota, pagamento stipendi) |

---

## 6. Foglio `Richiesta doc` — cuore della checklist

Titolo riga 2: *richieste per controllo contabile ex art. 2409 – ter c.c.*  
Cliente in `A1` = `=+INDICE!A1`.  
Freeze: `A7`.

### 6.1 Colonne a blocchi trimestre

Tre trimestri affiancati. Ogni blocco ha 4 colonne:

| Ruolo | Trimestre più vecchio (NASCOSTO) | Trimestre di mezzo (visibile) | Trimestre CORRENTE (visibile) |
|---|---|---|---|
| Intestazione riga 3 | `D3` 1° ott – 31 dic 2025 | `I3` 1° gen – 31 mar 2026 | `N3` 1° apr – 30 giu 2026 |
| Date rif. | D | I | **N** |
| Note cliente | E | J | **O** |
| Note BT | F | K | **P** |
| Doc. ricevuto | G (giallo + tendina) | L | **Q** |

Colonne nascoste oggi: C, D, E, F, G, H (vecchio blocco Q4 2025 + spacer).  
Spacer visibili: M (e in parte H nascosto).

Nel master i tre blocchi sono vuoti. Intestazioni: `[T-2]`, `[T-1]`, `[Trimestre corrente]`.  
L’app scrive il blocco **corrente** (N–Q se si mantiene questo layout). I blocchi vecchi si riempiono solo se si sta tenendo lo storico a video; di default una pratica nuova parte vuota.

### 6.2 Ogni riga-documento

Colonna A = codice (`A.1` … `G.2`).  
Colonna B = descrizione fissa (non toccare).  
Date rif. = periodo atteso del documento (testo o data).  
Doc. ricevuto = status.

Righe di gruppo (solo titolo, niente status): A4, A10, A16, A23, A28, A35, A40.  
Nota libera `A21`: *Nel caso in cui vi siano verbali non ancora riportati a libro, ci occorre la bozza del verbale.*

### 6.3 Catalogo documenti (stesso per tutti i clienti)

Le colonne Date rif. / Status nel master sono vuote. L’app le riempie sul blocco trimestre corrente.

| ID | Documento / informazione | Tipo input | Destinazione carta | Classificazione file (hint) |
|---|---|---|---|---|
| A.1 | Cambiamenti significativi SCI / sistema contabile-amministrativo | info / mail / org chart | A | organigramma, procedure, mail SCI |
| A.2 | Cambiamenti org/commerciale; ops rischiose; contratti straordinari; M&A; passività potenziali; nuovi prestiti/garanzie | info + atti | A, H, I | contratti, atti, comunicazioni legale |
| A.3 | Cartelle, avvisi bonari, comunicazioni AE / INPS / altri organi | documenti | A, C | cartella, avviso bonario, Agenzia Entrate |
| A.4 | Transazioni finanziarie non ordinarie (paradisi fiscali, IC non cash-pooling, movimenti extra-business) | info + e/c | E, I | bonifici, SWIFT, movimenti anomali |
| B.1 | Bilancino di verifica (txt o excel) | file strutturato | G, E (saldo co.ge) | bilancino, trial balance, TB |
| B.2 | CE gestionale confrontato con budget | file | G | CE, budget, gestionale |
| B.3 | Budget + cashflow 6-12 mesi se disponibile | file | G | budget, cashflow, tesoreria |
| B.4 | Libro giornale provvisorio o mastrini, **txt** | file txt | B, D | giornale, mastrini, prima nota |
| C.1 | Verbali Assemblee soci | pdf | F | verbale assemblea |
| C.2 | Verbali CdA | pdf | F | verbale CDA, consiglio |
| C.3 | Verbali Collegio sindacale | pdf | F | verbale collegio, sindaci |
| C.4 | Annotazioni libro soci | pdf / scan | F | libro soci |
| D.1 | Libro giornale definitivo: scan prima e ultima pagina bollato | scan | B | giornale definitivo, bollato |
| D.2 | Libro inventari definitivo | scan | B | libro inventari |
| D.3 | Registri IVA | pdf/excel | B | registro IVA, vendite, acquisti |
| E.1 | Quietanze F24 versati / da versare / compensati | pdf | C | F24, quietanza, delega F24 |
| E.2 | Ricevute fondi previdenziali (elenco dipende dal cliente) | pdf | C | Alifond, FASA, Previndai, Anima, FASI, Enasarco, … |
| E.3 | Comunicazione liquidazione periodica IVA (LIPE) | pdf / ricevuta | C | LIPE, liquidazione IVA |
| E.4 | Dichiarazione annuale IVA | pdf / ricevuta | C | dichiarazione IVA, IVA annuale |
| E.5 | Ricevute Intrastat | ricevuta | C | Intrastat |
| F.1 | Estratti conto bancari | pdf | E | estratto conto, e/c, bank statement |
| F.2 | Riconciliazioni bancarie | excel/pdf | E | riconciliazione, bank rec |
| F.3 | Report Centrale Rischi o equivalente | pdf | E | centrale rischi, CR |
| G.1 | Cedolone, prospetto contabile e prima nota | pdf/excel | C | cedolino, LUL, prima nota personale |
| G.2 | Contabile pagamento stipendi | pdf | C, E | bonifico stipendi, distinta stipendi |

Nota `A21`: se un verbale è solo in bozza, va raccolto e annotato in F colonna E.

### 6.4 Come l’app marca “Doc. ricevuto”

- file trovato e ricondotto all’ID → `✓`
- ID non saltato, nessun file → `wip` + riga nel report mancanti
- file parziale (es. 10 e/c su N banche) → `wip` + nota
- controllo non richiesto questo trimestre → `✗` (solo se deciso, non per assenza file)
- strutturalmente non esiste per il cliente → `N/A`
- A.1–A.4 sono informazioni: se non c’è un file/mail classificabile restano `wip`, non `✗`

---

## 7. Carte di lavoro — struttura e regole di compilazione

Header comune (righe 1–5) + titolo sezione riga 7 + link `← INDICE`.

### 7.1 Foglio A — Sistema di controllo interno

Celle: solo header + titolo.  
Contenuto reale: **immagine organigramma** “SITUAZIONE ORGANIZZATIVA GRUPPO FERRERO S.P.A.” (drawing su sheet A).

Organigramma letto dall’immagine (utile per capire chi firma / chi fornisce docs):

- CdA
- Giuseppe Ferrero (Presidente)
- Silvia Caterina Ferrero (VP e AD)
- Gabriella Toso (AD)
- Paola Ferrero (AD)
- Giuseppe Schiavone — Datore di lavoro e Direttore amministrativo e finanziario (contatto docs admin/finanza)
  - Area amm.: Carla Arrò, Corrado Tedeschi
  - Finanza e CdG: Maria Lombardi
- Segreteria: Laura Marino → Irene Zorio, Alessandro Bastianello, Setuhul Pravindsingh

**Cosa può fare l’app:** poco in automatico. Se arriva un organigramma nuovo, segnalarlo.  
**Cosa non può fare:** giudicare se il SCI è cambiato (A.1).  
**APERTO:** esiste un testo/conclusione da scrivere in A, o basta l’organigramma + status INDICE?

### 7.2 Foglio B — Libri obbligatori

Tabella “RILEVAZIONE ULTIMO AGGIORNAMENTO” da riga 10:

| Col | Campo | Cosa ci va |
|---|---|---|
| A | Libro (fisso) | Libro giornale definitivo; Libro giornale provvisorio anno in corso; Registro Beni Ammortizzabili; Registro IVA acquisti; Libro unico del lavoro |
| C | Nr.reg. | Ultimo n. registrazione |
| D | Data reg. | Data ultima registrazione |
| E | Pag. | Pagina (qui a volte è una data: E14 = 2026-09-08, formato `d-mmm`) |
| F | Descrizione registrazione | Descrizione ultima riga (es. “fattura aquisto italia IVA 22% indetraibile”) |
| G | Note | Libero |

Dato presente solo su IVA acquisti (C14=164, D14=2026-06-30).

Fonte: D.1, D.3, B.4, G.1 (LUL).  
**APERTO:** E14 è davvero “pagina” o è una data di stampa? Il formato cella è data.  
**APERTO:** mancano in tabella Registro IVA vendite, Libro inventari, Libro cespiti se diversi dal “Beni ammortizzabili”.

### 7.3 Foglio C — Adempimenti tributari e previdenziali

Tre blocchi.

#### C-1. F24 mensili (righe 9–13, colonne B–G = gen→giu 2026)

| Riga | Campo | Note |
|---|---|---|
| 10 | Data rif. | 1° del mese (formato mmm-yy italiano) |
| 11 | Data vers. | Data F24 (di solito 16 del mese; mag 2026 = 18) |
| 12 | Importo | Somma delle deleghe del mese. Spesso formula tipo `=2947.08+27.78+...` (un addendo = un tributo/fondo) |
| 13 | Nr. prot. | Protocollo F24, 17 cifre, formato testo `@` |

YTD gennaio–giugno, non solo il trimestre.  
**APERTO:** per il solo II trim si compilano E–G (apr–giu) o sempre tutto il semestre/anno?

Importi attuali (somma delle formule):

- gen `=2947.08+27.78+27.78+52920.13`
- feb `=64107.73+62.5+20289.66+62.5+55.56+2947.008` ← possibile typo `2947.008`
- mar `33129.17` (valore fisso, non scomposto)
- apr `=35561.12+55.56`
- mag `=48028.99+325.86`
- giu `=73911.74+433+9557+335`

Protocolli: `26011511010335539` … `26061608392358701` (pattern `AAMMGG` + resto).

Fonte: E.1 quietanze F24. L’app può: data versamento, protocollo, importo (e, se legge il dettaglio tributi, la formula a somma).

#### C-2. Adempimenti trimestrali (righe 17–24)

Colonne B–E = 1°…4° trim 2026. Tendina `✓,✗,N/A,wip` su `B19:E24`.

Elenco **specifico Ferrero** (non è un elenco generico SA 250B):

- QUADRIFOR
- BB PREV IMPIEGATI
- MARIO NEGRI
- MARIO BESUSSO
- ANTONIO PASTORE
- LIPE  ← corrisponde a richiesta E.3

Oggi solo colonna B (1° trim) è ✓; 2° trim vuoto.

Fonte: E.2 (fondi) + E.3 (LIPE).  
**APERTO:** mapping esatto fondo ↔ riga (Alifond/FASA/Previndai/Anima/FASI/Enasarco vs Mario Negri/Besusso/Pastore/Quadrifor/BB Prev). Non è scritto nel file.

#### C-3. Adempimenti annuali (righe 26–28)

- `A28` TASSA ANNUALE LIBRI SOCI (codice tributo **7085**)
- B27 = anno 2026; C27 Data invio; D27 Nr. protocollo — tutti da compilare

**APERTO:** altri adempimenti annuali (IVA E.4, CU, 770, IRES/IRAP) non hanno riga. Vanno solo in Richiesta doc?

### 7.4 Foglio D — Test su rilevazioni contabili

Struttura: solo header + nota in A8:

> Dai documenti ricevuti non sono risultate criticità quindi si è deciso di non effettuare questa analisi per questo trimestre

Status INDICE = ✗ (coerente: test non fatto).

Fonte teorica: B.4 giornale + campionamento.  
Skip = status `✗` (chiuso: non è un mancante). L’app non decide da sola di saltare: o lo trova già `✗` in Richiesta/INDICE, o lo scrive un umano. Non inventare la frase “niente criticità”.

### 7.5 Foglio E — Disponibilità liquide

La carta più strutturata. Titolo riga 9 oggi: `RICONCILIAZIONI BANCARIE AL 31/12/2025` (residuo Q4; per II trim dovrebbe essere **30/06/2026**).  
B2 oggi `IV trim 2025` — **sbagliato** rispetto a INDICE.

Tabella banche righe 12–28, totale riga 29:

| Col | Campo | Regola |
|---|---|---|
| A | Co.ge | Codice conto (es. `100915100020`) — chiave di matching col bilancino |
| B | Banca | Anagrafica |
| C | Tipo conto | `cc` (tutti i presenti) |
| D | N° conto | IBAN/n. conto. **Attenzione:** D13=`39095.72` sembra un importo finito nella colonna sbagliata |
| E | Saldo co.ge | Dal bilancino (B.1). Link storico a `files\andamento\...xlsx`. **Oggi tutte le E12:E28 sono vuote** |
| F | Saldo e/c | Da estratto (F.1). Link a `files\banche` |
| G | Sospesi | Partite in riconciliazione (F.2). Oggi vuote |
| H | Check | `=E−F` (deve tendere a 0 se G spiega la differenza). **H19 è invertita: `=F19-E19`** |
| I | Note BT | Libero. Merge I17:I29 |

Formule da **non rompere**:

```
H12:H18, H20:H28  =E{r}-F{r}
H19               nel file Ferrero era `=F19-E19` → **errore umano**. Nel master tutte le H = `=E-F`.
E29               =SUM(E12:E28)
F29               =SUM(F12:F28)
G29               =SUM(G12:G28)
H29               =SUM(H12:H28)
```

Banche anagrafiche (master Ferrero, 17 conti):

| Co.ge | Banca | N° conto (come da file) |
|---|---|---|
| 100915100020 | INTESA SANPAOLO SPA | 00527/1000/00068796 |
| 100915100110 | MONTE DEI PASCHI DI SIENA | 39095.72 ← sospetto |
| 100915100121 | UNICREDIT SPA | 101476918 |
| 100915100130 | BANCO BPM SPA | 23515 |
| 100915100170 | BNL GRUPPO BNP PARIBAS | 000240 |
| 100915100210 | BANCA DEL PIEMONTE S.P.A. | 88419-7 |
| 100915100232 | CREDITO EMILIANO SPA | 1085924 |
| 100915100233 | CREDEM EUROMOBILIARE SPA | 198105 |
| 100915100700 | DEUTSCHE BANK SPA 830320 | 830320-1 |
| 100915100701 | DEUTSCHE BANK SPA 830321 | 830321-0 |
| 100915100704 | DEUTSCHE C/GARANZ.401195 | 401195 |
| 100915100800 | MEDIOBANCA SPA | 13757-0 |
| 100915100900 | ALLIANZ BANK SPA | 949810 |
| 100915100350 | BPER BANCA SPA | 38035173 |
| 100915100360 | BPER BANCA SPA (EX UBI) | 42216254 |
| 100915100500 | PASSADORE C/C N.1613722 | 000001613722 |
| 100915100501 | PASSADORE C/C N.1614336 | 000001614336 |

Da DataSnipper Q1 esiste anche `Intesa cc_USD 31.03.2026.pdf` — **non ha riga in tabella**.  
**APERTO:** il conto USD Intesa va aggiunto o è fuori perimetro?

Naming storico e/c: `{Banca}[ cc_{nconto}] {dd.mm.yyyy}.pdf`  
es. `Deutsche cc_830321 31.03.2026.pdf`, `Allianz 31.03.2026.pdf`.

Regola check: dopo aver scritto E e F, H si ricalcola da sola. Se \|H\| > soglia e G vuoto → wip + nota.  
**APERTO:** soglia di materialità (euro). Non è nel file.

Richiesta F.2 (riconciliazioni) e F.3 (CR) sono N/A in Q2.  
**APERTO:** le riconciliazioni si fanno solo a 31/12 (e a volte 31/3) e non a 30/6?

### 7.6 Foglio F — Verbali organi sociali

Tabella da riga 9:

| Col | Campo |
|---|---|
| B | Libro (fisso) |
| C | Ultima pagina compilata |
| D | Data ultimo verbale a libro |
| E | Ultimo verbale in bozza |
| F | Note |

Libri presenti:

| Riga | Libro | Ultimo dato in file |
|---|---|---|
| 10 | Libro dei soci | D=2026-04-02 (niente pagina) |
| 11 | Libro verbali ASSEMBLEE | pag. 179, verbale 2025-12-15 |
| 12 | Libro Obbligazione | pag. 10, 2025-06-16 |
| 13 | Libro verbali del CdA | pag. 148, 2026-05-05 |

**Manca il libro verbali del Collegio sindacale** (in Richiesta c’è C.3).  
**APERTO:** va aggiunta la riga o il collegio sta in Note?

Sul foglio F ci sono **4 documenti Word OLE** con lo storico appunti dei trimestri precedenti (assemblee, CdA, cash pooling, cessioni partecipate, finanziamenti, consolidato fiscale, cause). L’app non li deve cancellare. Eventuali nuovi riassunti: **APERTO** se vanno in un nuovo OLE, in colonna F, o in un file a parte.

Fonte: C.1–C.4 + nota A21 (bozze).

### 7.7 Foglio G — Analisi situazione contabile periodica

Griglia vuota formattata da riga 10 in giù (~500 righe). Header riga 9:

| Col | Header | Significato |
|---|---|---|
| B | acc nb | Codice conto |
| D | Account | Descrizione conto |
| E | `30/06/2026` (testo) | Saldo periodo corrente |
| F | `2025-06-30` (data) | Saldo comparativo N-1 |
| G | Amount Chg | Variazione assoluta |
| H | %Chg | Variazione % |

Fatto da: `MD;03/06/2026` (Mona Dennaoui, residuo Q1).  
Nessuna formula precaricata in G/H: o si incollano valori o si dovranno creare `=E-F` e `=E/F-1`.

Fonte: B.1 (obbligatorio), B.2, B.3.  
Q1: file `Gruppo Ferrero Bilancino al 310326.XLS - Sheet1.pdf` in `7.1_Analisi Situazione periodica\`.

**APERTO:**

- si importa l’intero piano dei conti o solo i conti sopra soglia?
- G/H li calcola l’app?
- serve un commento sulle variazioni significative? (c’è una casella di testo drawing4)
- formato reale del bilancino Ferrero (txt vs xls, colonne, segno dare/avere)

### 7.8 Foglio H — Colloqui con la Direzione

Solo header + titolo + casella di testo vuota.  
Status INDICE = ✗ (non fatto).  
Non nasce da un documento in checklist.  
**APERTO:** l’app deve solo ricordare che manca, o esiste un verbale/mail da classificare?

### 7.9 Foglio I — Operazioni particolarmente significative

Solo header + titolo + casella di testo vuota.  
Status INDICE = N/A.  
Fonte: A.2, A.4.  
Storico (Word in F): cash pooling Thovez 11, finanziamenti soci Chile, cessioni partecipate argentine, consolidato fiscale, linee MPS, versamenti in c/capitale, contenzioso caparra 150k.  
**APERTO:** chi decide N/A vs da compilare ogni trimestre?

---

## 8. Mapping Richiesta → Carta (per l’app)

```
Richiesta A.1, A.3          → carta A
Richiesta A.2, A.4          → carte A, I (e H se c’è colloquio)
Richiesta B.1               → carta G + colonna E della carta E
Richiesta B.2, B.3          → carta G
Richiesta B.4               → carte B, D
Richiesta C.1–C.4           → carta F
Richiesta D.1–D.3           → carta B
Richiesta E.1–E.5, G.1–G.2  → carta C
Richiesta F.1–F.3           → carta E
```

Report **documenti mancanti** = righe del blocco corrente con status `wip` o vuoto.  
Esclusi: `✓` (c’è), `✗` (controllo saltato), `N/A` (non applicabile).

---

## 9. Cosa l’app può compilare da sola (ipotesi, da validare)

Livello 1 — alto, meccanico:

- `Richiesta doc` N/Q: date rif. del trimestre + status se il file è riconoscibile
- Carta E: F (saldo e/c) per banca, matching per nome banca / n. conto / co.ge
- Carta E: E (saldo co.ge) se c’è il bilancino e il codice conto
- Carta C: data vers., importo, protocollo F24
- Carta G: dump bilancino in B/D/E/F
- Output: Excel compilato + lista mancanti

Livello 2 — serve conferma umana:

- Status INDICE F10:F18
- Carta B ultima registrazione (OCR ultima pagina registro)
- Carta F pagina/data ultimo verbale
- Dettaglio addendi F24 (tributo per tributo)
- Matching fondi previdenziali → righe C19:C23
- Variazioni significative in G

Livello 3 — solo umano (l’app non scrive):

- Conclusione INDICE
- Test D (skip o campionamento)
- Colloqui H
- Giudizio SCI (A.1) e ops significative (I)
- N/A di merito

---

## 10. Cosa non toccare

- Fogli `DS_INTERNAL_*` (DataSnipper)
- Formule header verso INDICE
- Formule `H12:H28`, `E29:H29` del foglio E
- Immagine organigramma (A)
- OLE Word storici (F)
- Caselle di testo conclusione (INDICE, G, H, I)
- Blocchi trimestre non correnti (D–G, I–L)
- Validazioni e formattazioni condizionali (solo scrivere i 4 codici status)
- Metadati SharePoint in customXml

---

## 11. Errori umani nel file Ferrero (corretti nel master)

Non sono regole di business. Andavano puliti:

1. Dati cliente/periodo/status/importi lasciati da trimestri precedenti.
2. Foglio E intestato al 31/12/2025 mentre l’INDICE diceva II trim 2026.
3. `E!H19` formula invertita (`F-E` invece di `E-F`).
4. `E!D13` importo messo in colonna “N° conto”.
5. `B5` puntava a `INDICE!F5` vuota invece di `F6`.
6. `n/a` minuscolo mescolato a `N/A`.
7. Dichiarazione IVA “2026” marcata ✓ a giugno (lascito).
8. Typo “aquisto”.
9. F24 febbraio con 3 decimali (`2947.008`).
10. Organigramma, banche, fondi, OLE Word: contenuti Ferrero, non del master.

---

## 12. Team visto nel file (contesto, non regola)

| Sigla / nome | Ruolo apparente |
|---|---|
| RH | Ruben Havrestiuc — esecutore attuale (`C28`) |
| MD | Mona Dennaoui — Q1 (DataSnipper + foglio G) |
| Lorenzo Migliaccio | sessioni DataSnipper |
| Mohammadreza Sobhi | sessione DataSnipper |
| Alexandru Ivan | creatore template 2023 |
| BT | “Note BT” = note dello studio (sigla studio) |

**APERTO:** BT = nome dello studio? Serve in output/intestazioni?

---

## 13. APERTO — rimasto dopo le risposte del 8/9

Chiusi: master per tutti i clienti; ogni trimestre = master + docs nuovi; assente = wip; skip = ✗; INDICE scrivibile; errori = umani; B5 = F6; mancanti = wip.

Ancora aperti (non bloccano il master vuoto):

1. F24: solo mesi del trimestre o sempre YTD gennaio→mese di chiusura?
2. Elenco fondi foglio C: righe vuote da riempire per cliente, o resta solo LIPE + note?
3. Riga Collegio sindacale nel foglio F: aggiungerla nel master?
4. Soglia in euro per segnalare check bancario ≠ 0 e variazioni G “significative”.
5. Output pratica: copia `Cliente_Periodo_compilato.xlsx` + `mancanti.md` (ipotesi di default, confermare).
6. DataSnipper: l’app ignora i fogli `DS_INTERNAL_*` (ipotesi di default).

---

## 14. File companion

`regole/schema.yaml` — stessa sostanza, strutturata per il programma (ID, celle, colonne trimestre, master banche).  
Se i due file divergono, vince questo markdown e si riallinea lo yaml.
