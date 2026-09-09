# JET (Journal Entry Testing) — riferimento tecnico condensato

Questo file riassume, in forma operativa, i due documenti di studio prodotti prima di questa fase
(`JET_libro_giornale_fondamento_normativo.pdf` e `JET_analisi_file_NORDSON.pdf`, entrambi in
questa cartella). Leggi anche quelli per il testo integrale delle citazioni normative e per il
dettaglio completo del file Excel esistente — questo è solo la sintesi operativa per scrivere codice.

## 1. Perché (ISA Italia 240, §33 lett. a, §A44)

Il revisore deve verificare le scritture del libro giornale e le rettifiche di bilancio, in
particolare quelle di fine periodo. Il §A44 elenca i segnali di rischio: conto non pertinente/
insolito/raro; autore inusuale; registrata a fine periodo con descrizione scarsa; priva di
codifica di conto; importo a cifra tonda; conto storicamente in errore/non riconciliato/
infragruppo; operazione fuori dal normale corso dell'attività. Il §A38 legittima esplicitamente
l'uso di tecniche computerizzate su tutta la popolazione, non un campione.

## 2. Il file Excel esistente (NORDSON, "BTI spreadsheet") — pipeline

`Original data` (export grezzo, italiano/SAP) → `Cleansed data1`/`Cleansed data2` (pulizia
manuale) → `Data Input` (7 campi canonici + parametri cliente) → `Calcs1`/`Calcs2` (12 criteri a
punteggio + test di sequenza) → `Detailed results` (vista leggibile) → `Dashboard` (riepilogo:
blocchi COUNTIF affidabili + 4 pivot che, in questo file, sono rotte per cache non aggiornata —
bug di processo Excel, non di logica: le formule sorgente sono corrette).

Campi canonici di "Data Input": `EffectiveDate`, `CreatedDate`, `CreatedTime`, `TransactionId`,
`Net`, `JournalDescription`, `UserId`. **Manca il conto contabile** — presente nel dato grezzo ma
scartato durante la pulizia: è il gap principale rispetto al §A44.

## 3. I 12 criteri esistenti (nome interno, formula, punti)

| # | Criterio | Formula (logica) | Punti |
|---|---|---|---|
| 1 | Profit impact | `abs(importo) > 10% × utile netto dopo imposte` | 1 |
| 2 | >10x average | `abs(importo) > 10 × valore medio registrazione` | 1 |
| 3 | Above PM | `abs(importo) > performance materiality` | 1 |
| 4 | Round sum | `abs(importo) % 10 == 0` | 1 |
| 5 | Posted on a weekend | giorno settimana ∈ {giorni weekend cliente} | 1 |
| 6 | Posted on a public holiday | data ∈ elenco festività cliente | 4 |
| 7 | Posted outside office hours | ora < inizio o > fine orario ufficio cliente | 1 |
| 8 | Backdated | `CreatedDate - EffectiveDate >= soglia_backdating_giorni` (default cliente: 60) | 4 |
| 9 | Unauthorised staff | autore ∉ elenco staff autorizzato cliente | 4 |
| 10 | Related party / keyword match | descrizione contiene una di N parole chiave cliente | 4 |
| 11 | Blank description | descrizione vuota | 4 |
| 12 | Investigate further? | somma punti (1-11) ≥ soglia cliente (default: 4) | — |

Più, separato dal punteggio: **test di sequenza** (gap nel numero progressivo di riga — nel file
esistente sul contatore ricostruito, non sul numero di documento reale: nella nostra versione va
fatto sul numero di documento/protocollo reale, quando disponibile) e **Benford's Law**
(distribuzione della prima cifra di `abs(importo)`, confrontata con la distribuzione teorica
30,1% / 17,6% / 12,5% / 9,7% / 7,9% / 6,7% / 5,8% / 5,1% / 4,6% per le cifre 1-9; sconsigliata
sotto le 500 registrazioni).

Parametri cliente necessari (equivalente di un `ClientConfig` per il JET): materialità di
bilancio, performance materiality, utile netto dopo imposte, valore medio registrazione (calcolato
da totale/conteggio), orario ufficio (inizio/fine), giorni di weekend, soglia backdating in
giorni, elenco festività, elenco staff autorizzato, elenco parole chiave parti correlate, soglia
punteggio per "da investigare".

## 4. I criteri nuovi da aggiungere (chiudono il gap §A44 sul conto)

Assenti nel file Excel esistente, perché richiedono il campo conto che lì viene scartato:

- **Conto insolito o usato raramente**: frequenza di utilizzo del conto (nel periodo, o rispetto a
  uno storico se disponibile) sotto una soglia minima.
- **Conto storicamente soggetto a errori / non riconciliato**: richiede uno storico di
  rettifiche/differenze non riconciliate per conto — se il dato non è disponibile, il criterio va
  documentato come non calcolabile, non stimato a caso.
- **Operazioni infragruppo/parti correlate legate al conto**: il conto (o la sua descrizione)
  compare in un elenco di conti infragruppo/parti correlate del cliente — più preciso della sola
  ricerca di parole chiave nella descrizione, che il file esistente già fa ma è debole (falsi
  negativi se il nome non compare testualmente nella descrizione).

## 5. Convenzioni del progetto Quadra da rispettare

Pacchetto isolato e additivo (come `backend/domain/` per Quadra): niente logica nella Fase 1, solo
contratti. Mai inventare soglie o dati non disponibili — usare `None`/valore esplicito "non
disponibile" e documentarlo nel modello, mai un numero a caso. Test contro dati reali quando
possibile, mai copiare i documenti reali del cliente nel repository (solo fixture minime,
sintetiche o estratte in piccola quantità). Ogni fase: branch nuovo, commit locali, niente push.
