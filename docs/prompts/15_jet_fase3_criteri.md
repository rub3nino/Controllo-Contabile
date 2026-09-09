# Prompt — JET Fase 3: implementazione e verifica dei 12 criteri di rischio esistenti (Quadra — modulo JET)

## Contesto

Prosegui il filone JET sopra `jet/fase2-ingest` (approvato: `backend/jet/ingest.py`,
`mappa_righe_giornale`, `leggi_righe_xlsx`). Questa fase implementa la logica di scoring che il
foglio Excel storico (`Copia di Jet TEST - NORDSON.xlsx`, foglio `Calcs1`) applica oggi manualmente
con formule — undici criteri con punteggio configurabile più una verifica di sequenza — e la
verifica contro conteggi reali già noti su un cliente vero, non solo contro dati sintetici.

Prima di scrivere codice, leggi:

1. `backend/jet/models.py` — in particolare `ParametriClienteJet` (gli undici pesi configurabili e
   `soglia_da_investigare`) ed `EsitoRigaJet`/`EsitoSequenzaJet`, i contratti che questa fase deve
   popolare. Non modificarli: se qualcosa non torna, segnalalo nel riepilogo.
2. `backend/jet/ingest.py` — le `RigaGiornale` che questa fase riceve in ingresso sono già pulite e
   tipizzate, non serve rileggere Excel qui.
3. `docs/jet/00_riferimento_tecnico.md` e `docs/jet/JET_analisi_file_NORDSON.pdf` (sezioni sulla
   tabella dei 12 criteri e sui parametri specifici di Nordson) — contengono le formule esatte lette
   dal foglio Excel reale e i parametri di quel cliente (materialità di bilancio 1.050.000,
   performance materiality 735.000, utile netto 9.582.473, valore medio registrazione 17.207,03,
   orario ufficio 08:30–17:00, weekend sabato/domenica, soglia backdating 60 giorni, soglia da
   investigare 4).

## Cosa costruire

In `backend/jet/criteri.py`, una funzione pura `valuta_riga(riga: RigaGiornale, parametri:
ParametriClienteJet) -> EsitoRigaJet` che calcola gli undici flag booleani più il punteggio totale
e il verdetto finale, replicando esattamente la logica delle formule Excel documentate:

1. **Profit impact**: `|importo_netto| > 10% * utile_netto_dopo_imposte`.
2. **Oltre 10 volte la media**: `|importo_netto| > 10 * valore_medio_registrazione`.
3. **Sopra performance materiality**: `|importo_netto| > performance_materiality`.
4. **Importo cifra tonda**: resto della divisione per 10 uguale a zero (attenzione al tipo
   `Decimal`, non `float`, per evitare errori di arrotondamento).
5. **Weekend**: giorno della settimana di `data_effettiva` in `giorni_weekend`.
6. **Festività**: `data_effettiva` presente in `festivita`.
7. **Fuori orario**: `ora_creazione` fuori dall'intervallo `orario_ufficio_inizio`–
   `orario_ufficio_fine` (se `ora_creazione` è `None`, il flag deve restare `None`/non calcolabile,
   non `False` — dato mancante non è "dentro orario").
8. **Backdated**: `data_creazione - data_effettiva >= soglia_backdating_giorni` (se manca una delle
   due date, non calcolabile).
9. **Staff non autorizzato**: `utente` non presente in `staff_autorizzato` (se `staff_autorizzato`
   è `None`, il controllo non è applicabile — decidi tu se `None` o `False`, ma **documenta la
   scelta esplicitamente** nel riepilogo: è un caso ambiguo — "nessuna lista fornita" è diverso da
   "lista fornita e utente non ci compare").
10. **Parte correlata**: `descrizione` contiene una delle `parole_chiave_parti_correlate`
    (case-insensitive, come nel foglio Excel).
11. **Descrizione vuota**: `descrizione is None` (o stringa vuota dopo trim).
12. **Verdetto**: somma dei punteggi dei flag veri (usando i pesi corrispondenti in `parametri`) >=
    `soglia_da_investigare`. Ricorda: questo non è un dodicesimo peso, è il confronto finale — già
    chiarito in Fase 1, non reintrodurre un peso fittizio.

Per ogni flag che risulta `None` per dati mancanti (non applicabile), quel criterio non contribuisce
punti al totale — ma la sua indisponibilità non deve essere silenziosamente trattata come "falso":
se aiuta la leggibilità, aggiungi un commento nel codice su questa distinzione, non serve un campo
nuovo nel modello.

In `backend/jet/sequenza.py`, una funzione pura `verifica_sequenza(righe: list[RigaGiornale]) ->
list[EsitoSequenzaJet]` che replica il test di sequenza del foglio `Calcs2`: ordina le righe per
`numero_documento`, individua i numeri mancanti nella sequenza. **Nota già segnalata nella mia
analisi**: il foglio Excel esistente fa questo test su un contatore di riga ricostruito, non sul
vero numero documento del gestionale — è un limite noto dello strumento attuale. Qui invece usa
`numero_documento` (il campo vero, se disponibile), che è più corretto ma produrrà probabilmente un
numero di "buchi" diverso da quello del foglio Excel — non è un errore della tua implementazione,
documentalo semplicemente nel riepilogo.

## Verifica contro il caso reale Nordson — importante

Le funzioni sopra vanno prima testate su dati sintetici con risultato atteso noto (vedi sotto). Poi,
come passo di validazione separato (non un test automatico nella suite, uno script/riepilogo
manuale), esegui la pipeline completa — `leggi_righe_xlsx` + `mappa_righe_giornale` +
`valuta_riga`/`verifica_sequenza` — sul file reale `JET Analysis/Copia di Jet TEST - NORDSON.xlsx`
(foglio `Data Input`), usando i parametri Nordson già documentati nel PDF.

Per i tre criteri che dipendono da liste specifiche del cliente — festività, staff autorizzato,
parole chiave parti correlate — **non inventare le liste**: vanno estratte dal file Excel stesso,
dove esistono già (il foglio `Calcs1` le referenzia con `VLOOKUP` verso range con nome; usa lo
stesso approccio già usato nella mia analisi — `openpyxl` in `read_only=True` per leggere i nomi dei
named ranges da `xl/workbook.xml` e risalire ai fogli/celle sorgente, oppure ispeziona direttamente
le formule `VLOOKUP`/`MATCH` in `Calcs1` per capire quali range citano). Se dopo un tentativo
ragionevole non riesci a individuare con certezza dove vive una di queste tre liste, non
indovinare: lascia quel parametro a `None` per la validazione, documenta quale lista non hai
trovato e perché, e il criterio corrispondente risulterà semplicemente non applicato (coerente con
la gestione "non disponibile" già definita sopra).

Confronta il numero di righe con `da_investigare=True` prodotto dalla tua pipeline con il conteggio
noto del foglio Excel (**184 righe da investigare**, soglia 4, su 213.656 registrazioni), il numero
di buchi di sequenza trovati dal tuo `verifica_sequenza` con il conteggio noto del foglio Excel
(**17**), il numero di importi sopra performance materiality (**1.104**) e il numero di importi a
cifra tonda (**19.196**, 8,98% del totale). Non aspettarti una corrispondenza esatta su tutti e
quattro — spiegato sopra perché alcuni criteri (staff/festività/parti correlate, sequenza) possono
legittimamente divergere — ma i criteri puramente numerici (performance materiality, cifra tonda)
dovrebbero corrispondere quasi esattamente, e se non corrispondono è un segnale di bug reale da
indagare, non da ignorare. Riporta tutti e quattro i confronti nel riepilogo finale, numero contro
numero, con la tua spiegazione per ogni scostamento.

## Cosa NON fare

Non toccare `backend/jet/models.py` né `backend/jet/ingest.py`. Non implementare ancora i criteri
sul conto (`frequenza_utilizzo_conto`, `flag_conto_insolito_raro`,
`flag_conto_infragruppo_parte_correlata`) — restano `None`, arrivano in Fase 4, che è dedicata
proprio a colmare quel gap. Non scrivere il file di validazione Nordson come test automatico della
suite (il file è troppo grande e non deterministico da tenere in CI) — tienilo come script separato
in `scripts/` o riporta semplicemente i numeri nel riepilogo, a tua scelta, purché riproducibile.
Non copiare né spostare il file Nordson reale nel repository.

## Test richiesti

Test su dati sintetici, con risultato atteso calcolato a mano, per ciascuno degli undici criteri
(almeno un caso vero e uno falso per ciascuno, più i casi limite di dato mancante dove applicabile:
`ora_creazione=None`, `data_creazione=None`, `staff_autorizzato=None`). Un test che verifica il
verdetto finale come somma-pesata-contro-soglia, non come un dodicesimo peso. Test su
`verifica_sequenza` con una sequenza sintetica con buchi noti (es. numeri 1,2,4,5,7 → deve trovare
mancanti 3 e 6). Rilancia tutta la suite (84 test dopo la Fase 2, verificati in ambiente pulito):
deve continuare a passare, nessuna regressione.

## Consegna

Branch nuovo da `jet/fase2-ingest`, es. `jet/fase3-criteri`. Commit locali, niente push né PR. Nel
riepilogo finale: il diff esatto, il risultato di tutta la suite, i quattro confronti numerici
contro Nordson (con spiegazione di ogni scostamento), quale lista (festività/staff/parole chiave)
hai trovato nel file reale e quale eventualmente no, e la tua scelta documentata su come trattare
"nessuna lista di staff autorizzato fornita" nel criterio 9.
