# Prompt — JET Fase 2: ingest e mappatura campi (Quadra — modulo JET)

## Contesto

Prosegui il filone JET dentro il repository di **Quadra**, sopra `jet/fase1-contratti` (approvato:
`backend/jet/models.py` con `RigaGiornale`, `ParametriClienteJet`, `EsitoRigaJet`,
`EsitoSequenzaJet`). Questa fase costruisce l'ingest: leggere un export reale del libro giornale
ed è mapparlo al formato canonico `RigaGiornale` già definito.

Prima di scrivere codice, leggi:

1. `backend/jet/models.py` — i contratti che l'ingest deve popolare, per intero, senza saltare
   nessun campo opzionale.
2. `docs/jet/JET_analisi_file_NORDSON.pdf`, sezione 2 — la struttura reale del foglio "Original
   data" del caso Nordson: intestazioni in italiano, formato tipico di un export SAP.
3. `backend/domain/ingest_adapter.py` — lo stile di ingest già in uso in Quadra per il motore
   principale (funzione pura, nessuno stato nascosto, degrado a lista vuota/campo `None` invece di
   eccezione quando un dato manca), da riusare come riferimento di stile per il nuovo modulo.

## Il problema concreto, con un esempio reale

Il file "Original data" di Nordson non ha un formato pulito: alcune intestazioni sono duplicate
(colonna "Data Reg." compare due volte, con significati diversi), alcuni campi conto sono
ambigui (esistono tre colonne che sembrano riferirsi a un conto: "Conto n.", "Conto contabile",
"Conto conta" — non è ovvio dai soli nomi quale sia il conto principale da usare per i criteri
della Fase 4, e nei dati reali letti finora "Conto conta" risultava valorizzato solo su alcune
righe). Non indovinare quale sia quello giusto: se dopo aver scritto il mapper resta un dubbio
concreto su quale colonna rappresenti il conto principale, documentalo esplicitamente nel
riepilogo finale invece di sceglierne una a caso — è lo stesso principio già seguito più volte in
questo progetto (es. i conti "APERTO" di Ferrero/SWGI).

Per ancorare il lavoro a un caso reale senza dover leggere il file Nordson (213 MB, non va aperto
né copiato in questa fase), ecco una riga vera, letta e riportata qui esattamente come appare nel
file originale — usala per verificare che il tuo mapper produca il risultato atteso:

| Colonna originale | Valore |
|---|---|
| Riga N. | 1 |
| Descrizione | Unicredit - EUR - AB |
| Doc.No. | 709000000 |
| Data Reg. | 1/11/2024 |
| Conto contabile | 36422000002 |
| Importo Dare | 21142.17 |
| Importo Avere | 0 |
| Totale (= Dare + Avere) | 21142.17 |
| Mese | Novembre |
| USER | BANKBATCH |

Mappata a `RigaGiornale`, questa riga dovrebbe produrre: `identificativo_registrazione="1"`,
`numero_documento="709000000"`, `data_effettiva=2024-11-01` (formato italiano gg/mm/aaaa — non
statunitense), `conto_contabile="36422000002"`, `importo_netto=21142.17`,
`descrizione="Unicredit - EUR - AB"`, `utente="BANKBATCH"`.

## Cosa costruire

In `backend/jet/ingest.py`:

1. Una funzione pura che prende (a) i dati grezzi tabellari (righe come dizionari, indipendente
   da come sono stati letti — xlsx, csv, ecc., la lettura del file è un dettaglio separato, non
   mescolarla con la logica di mappatura) e (b) una **mappatura esplicita** campo-canonico →
   nome-colonna-sorgente (un semplice dizionario o una piccola struttura dati, non un file di
   configurazione YAML per cliente — quella decisione dipende dalla Fase 6, ancora da discutere,
   non anticiparla qui). Restituisce una lista di `RigaGiornale`.

2. La regola per `importo_netto`: se sono presenti colonne separate di importo Dare e Avere,
   calcola `Dare - Avere` direttamente dai due valori sorgente, **non** fidarti di una colonna
   "Totale" già precalcolata se è presente — ricalcolarlo è più robusto quando l'export non
   contiene quella colonna comoda (che nel foglio Excel esistente è una formula, non un dato
   grezzo). Se invece l'export fornisce solo un importo netto già firmato, usalo direttamente.

3. Gestione esplicita dei dati mancanti: un campo opzionale di `RigaGiornale` assente
   nell'export (colonna non mappata o cella vuota) deve risultare `None`, mai una stringa vuota o
   zero silenzioso — stessa disciplina della Fase 1.

4. Una piccola funzione di lettura file (xlsx tramite la libreria già in uso nel progetto per
   `backend/extract.py`/`backend/domain/ingest_adapter.py`, così non introduci una dipendenza
   nuova) che produce le righe grezze da passare alla funzione di mappatura del punto 1 — tenuta
   separata dalla logica di mappatura per poterla testare senza un file reale.

## Fixture di test — sintetica, non il file reale

Crea `fixtures/jet/giornale_sintetico.xlsx` (o `.csv`, a tua scelta, ma coerente con cosa la
funzione di lettura del punto 4 si aspetta): 8-10 righe **inventate**, con la stessa forma delle
intestazioni reali di Nordson (comprese le ambiguità descritte sopra: replica la duplicazione di
"Data Reg." e la presenza di più colonne simili a "conto", così il mapper viene testato proprio
sul caso difficile, non su un formato già pulito). Includi almeno: una riga con importo a credito
(Avere valorizzato, Dare vuoto), una riga con conto contabile mancante, una riga con utente
mancante, una riga con descrizione vuota. Nessun dato reale di Nordson va in questa fixture — nomi
di società, conti e importi devono essere inventati.

## Cosa NON fare

Non leggere né aprire il file reale `JET Analysis/Copia di Jet TEST - NORDSON.xlsx` in questa
fase — l'esempio nella sezione precedente è sufficiente e già verificato. Non implementare ancora
nessuno dei 12 criteri di rischio (arrivano in Fase 3): questa fase produce solo `RigaGiornale`
popolate, non `EsitoRigaJet`. Non toccare `backend/domain/` né `backend/jet/models.py` (se scopri
che un campo del modello andrebbe cambiato, segnalalo nel riepilogo invece di modificarlo
direttamente — è un contratto già approvato, una modifica va discussa). Non costruire un
meccanismo di configurazione per-cliente della mappatura colonne (niente YAML, niente
`ClientConfig` JET) — quella è una decisione da prendere quando arriveremo alla Fase 6.

## Test richiesti

Un test che mappa la riga reale riportata sopra (costruita a mano come dizionario nel test,
esattamente con quei valori) e verifica che il `RigaGiornale` risultante coincida esattamente con
i valori attesi indicati. Un test sulla fixture sintetica che verifica: la riga a credito produce
un `importo_netto` negativo corretto, la riga con conto mancante produce `conto_contabile=None`
(non una stringa vuota), la riga con utente mancante produce `utente=None`. Un test che verifica
che la funzione di lettura file (punto 4) e la funzione di mappatura (punto 1) siano testabili
separatamente — cioè che la mappatura funzioni anche passandole righe costruite a mano, senza
dover passare per un file. Rilancia **tutta** la suite `tests/`: deve continuare a passare quanto
già presente (91 test dopo la Fase 1) più i test nuovi, nessuna regressione.

## Consegna

Lavora su un branch nuovo a partire da `jet/fase1-contratti`, es. `jet/fase2-ingest`. Commit
locali, niente push né PR. Nel riepilogo finale: il diff esatto, il risultato del test sulla riga
reale Nordson (deve tornare esattamente ai valori attesi indicati sopra), il risultato di tutta la
suite, e la tua conclusione sull'ambiguità delle tre colonne conto — quale hai scelto per
`conto_contabile` nella fixture di test e perché, o se resta un dubbio da chiarire insieme prima
della Fase 3.
