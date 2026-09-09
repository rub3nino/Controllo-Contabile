# Prompt — JET Fase 1: contratti dati, senza logica (Quadra — nuovo modulo)

## Contesto

Iniziamo un nuovo filone di lavoro dentro il repository di **Quadra**: un modulo per il
**Journal Entry Testing (JET)** — l'analisi automatica del libro giornale richiesta dal principio
di revisione ISA Italia 240 (§33 lett. a, §A44) per identificare scritture contabili sospette.
Lo studio usa già oggi un foglio Excel per questo (un template interno, "BTI spreadsheet",
confrontato nel file stesso con la piattaforma commerciale Inflo), applicato di recente al caso
reale Nordson. L'obiettivo di questo filone è replicare la logica di quel foglio in codice,
correggerne i limiti noti, e colmare un gap che il foglio Excel ha rispetto al principio: non usa
mai il conto contabile nei suoi criteri di rischio.

Prima di scrivere codice, leggi **per intero**, in ordine:

1. `docs/jet/00_riferimento_tecnico.md` — sintesi operativa di tutto quello che segue: i 12
   criteri esistenti con formula esatta e punteggio, i parametri cliente necessari, i criteri
   nuovi da aggiungere sul conto, le convenzioni del progetto.
2. `docs/jet/JET_libro_giornale_fondamento_normativo.pdf` — il fondamento normativo (ISA Italia
   240), con le citazioni testuali complete dei paragrafi rilevanti.
3. `docs/jet/JET_analisi_file_NORDSON.pdf` — l'analisi completa del file Excel esistente: la
   pipeline a 7 fogli, ogni formula letta dal file reale, i parametri usati per Nordson, il bug
   delle pivot (causa esatta, non solo sintomo), il confronto criterio-per-criterio con il
   principio.
4. `backend/domain/models.py` — lo stile di contratti dati già in uso in Quadra (Pydantic,
   docstring che spiegano il *perché* di ogni scelta non ovvia, non solo il *cosa*). Il nuovo
   modulo JET deve seguire lo stesso stile, non inventarne uno diverso.

## L'obiettivo di questa fase, con precisione

Questa fase **non calcola nulla**. Definisce solo i contratti dati — esattamente come la Fase 0 di
Quadra (`backend/domain/models.py`) ha preceduto ogni logica di verifica. Il motivo è lo stesso:
avere un accordo scritto e verificabile su *cosa* rappresentiamo prima di scrivere *come* lo
calcoliamo.

## Cosa costruire

Crea un nuovo package isolato: `backend/jet/` (allo stesso livello di `backend/domain/`, non
dentro di esso — sono due moduli distinti, il JET non dipende dal motore di verifica di Quadra in
questa fase). Dentro, un file `models.py` con:

1. **`RigaGiornale`** — una riga di libro giornale nel formato canonico. Deve includere tutti i
   campi che il foglio Excel esistente usa (data effettiva, data di creazione/registrazione, ora
   di creazione se disponibile, identificativo della registrazione, importo netto, descrizione,
   utente) **più il campo conto contabile**, che il foglio Excel scarta e che serve per i nuovi
   criteri della Fase 4. Aggiungi anche un campo per il numero di documento/protocollo reale del
   gestionale, distinto dal contatore di riga progressivo — la Fase 3 del piano userà quello per
   il test di sequenza, non un contatore ricostruito come fa oggi il foglio Excel (vedi il
   documento di analisi Nordson per il perché di questa distinzione).

2. **`ParametriClienteJet`** — l'equivalente di un `ClientConfig` per il JET: materialità di
   bilancio, performance materiality, utile netto dopo imposte, orario ufficio (inizio/fine),
   giorni di weekend, soglia di backdating in giorni, elenco festività, elenco staff autorizzato a
   registrare, elenco parole chiave parti correlate, soglia di punteggio per "da investigare",
   punteggio assegnato a ciascuno dei 12 criteri esistenti (nel foglio Excel questi punteggi sono
   configurabili per cliente, non fissi — mantieni questa flessibilità). Segui lo stesso principio
   già usato in `ferrero.yaml`/`swgi.yaml`: nessun valore inventato, tutto esplicito, e per ogni
   campo che potrebbe non essere disponibile per un cliente usa un tipo opzionale, mai un default
   silenzioso che nasconde un dato mancante.

3. **`EsitoRigaJet`** — il risultato del test per una riga: un flag booleano (o enum) per ciascuno
   dei 12 criteri esistenti, il punteggio totale, il verdetto "da investigare" (booleano), più i
   campi per i criteri nuovi della Fase 4 sul conto (frequenza di utilizzo, flag conto
   insolito/raro, flag conto infragruppo/parte correlata) — **anche se in questa fase non vengono
   ancora calcolati**, i campi vanno previsti ora nel contratto, coerentemente con l'obiettivo
   dichiarato di questo filone di lavoro (non aggiungerli come ripensamento nella Fase 4).

4. **`EsitoSequenzaJet`** — per il test di completezza/gap: numero atteso, numero trovato,
   flag "mancante".

Ogni classe deve avere un docstring che spiega, in italiano, il *perché* di ogni scelta non ovvia
— esattamente come fa `backend/domain/models.py` per `ExtractedField`/`ClientConfig`. In
particolare, documenta esplicitamente nel docstring di `RigaGiornale` perché il conto è incluso
qui anche se il foglio Excel esistente non lo usa (il gap descritto nel documento di analisi).

## Cosa NON fare

Non scrivere nessuna funzione di calcolo, di ingest, di lettura file — solo classi dati (Pydantic
o dataclass, segui lo stile di `backend/domain/models.py`). Non toccare `backend/domain/` in
nessun file: il JET è un package separato, anche se in una fase futura (la Fase 6 del piano
generale, da discutere) potremmo collegarlo all'architettura di Quadra. Non leggere né copiare il
contenuto reale del file `JET Analysis/Copia di Jet TEST - NORDSON.xlsx` in questa fase — non
serve ancora (arriva nella Fase 2, per l'ingest) e comunque non va mai copiato nel repository, è
un file di lavoro reale del cliente. Non inventare soglie, punteggi o elenchi (festività, staff
autorizzato) di default: quei valori sono per-cliente e arriveranno da una configurazione, non da
un valore hardcoded nel modello.

## Test richiesti

Un test che istanzia ciascuna delle quattro classi con dati plausibili (non reali, inventati per
il test) e verifica che la validazione Pydantic passi. Un test che verifica che un campo opzionale
lasciato `None` (es. un cliente senza elenco festività fornito) non causi un errore di validazione
— coerente con la scelta di non inventare default. Nessun test di calcolo è possibile in questa
fase, perché non c'è ancora nessun calcolo: non forzarlo.

## Consegna

Lavora su un branch nuovo, es. `jet/fase1-contratti`, partendo dal branch principale del repo
(quello dove sono già confluite le fasi 0-9 del redesign di Quadra — verificalo con `git branch`
prima di partire, così sei sicuro di avere già `backend/domain/` come riferimento di stile).
Commit locali, niente push né PR. Nel riepilogo finale: i quattro modelli creati, il diff esatto
(dovrebbe essere solo `backend/jet/models.py`, un eventuale `backend/jet/__init__.py`, e il file di
test), il risultato dei test, e — se durante la lettura dei due PDF/del riferimento tecnico trovi
un'ambiguità o un punto che non ti è chiaro abbastanza da modellare con sicurezza — segnalalo nel
riepilogo invece di indovinare: è meglio una domanda ora che un contratto sbagliato da correggere
in tre fasi successive che ci si baseranno sopra.
