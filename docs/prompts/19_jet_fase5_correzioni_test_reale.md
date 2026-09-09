# Prompt — JET Fase 5: correzioni emerse dal primo test su dati reali di un secondo cliente (Quadra — modulo JET)

## Contesto

Ho appena testato l'intera pipeline JET (Fase 1-4b, approvata) su un cliente reale diverso da
Nordson (ALUK GROUP S.P.A., libro giornale a stampa fissa dal gestionale, 56.133 registrazioni su 9
mesi). L'ingest e i criteri funzionano correttamente sul nuovo formato — non serve toccare nulla lì.
Sono emersi però due problemi reali nel modulo esistente, non legati a un client specifico, che
vanno corretti prima di considerare il modulo pronto per un cliente reale arbitrario.

Leggi prima `backend/jet/sequenza.py` e `backend/jet/criteri.py` per intero.

## Problema 1 — `verifica_sequenza` può esaurire la memoria su numerazioni reali eterogenee

Il campo `numero_documento` di un cliente reale può non essere un'unica serie sequenziale: può
mescolare veri numeri di documento (piccoli, densi) con altri riferimenti puramente numerici ma non
correlati (es. codici di mandato RID/SDD a 16 cifre). Oggi `verifica_sequenza` prende tutti i valori
che superano `.isdigit()`, li ordina, e con `range(precedente + 1, successivo)` prova a enumerare
ogni "buco" fra coppie consecutive — se il salto fra due valori è enorme (es. da 756 a
4220425800055956), il range da enumerare è dell'ordine di 10^19 elementi: il processo si blocca e
esaurisce la memoria, non solleva un'eccezione pulita.

Correggi introducendo un limite esplicito e configurabile alla dimensione di un singolo gap da
enumerare — un nuovo parametro della funzione, `gap_massimo: int = 10_000` (default ragionevole ma
esplicito, non nascosto). Se un gap fra due numeri consecutivi supera `gap_massimo`, **non
enumerarlo**: quella coppia va segnalata diversamente, non silenziosamente ignorata e non
processata a costo di bloccare tutto. Aggiungi al risultato della funzione un modo per riportare
"gap troppo ampio per essere enumerato, saltato" (decidi tu la forma più naturale coerente con
`EsitoSequenzaJet` — es. una lista separata di intervalli-saltati restituita insieme ai gap normali,
o un secondo valore di ritorno; se cambi la firma della funzione in modo che rompa i chiamanti
esistenti — lo script di validazione Nordson — aggiornali di conseguenza e dillo nel riepilogo).

Non provare a "risolvere" il problema deducendo automaticamente più serie all'interno dello stesso
campo (es. raggruppando per lunghezza della stringa o per prefisso) — è una euristica rischiosa e
non richiesta ora: limitati a rendere la funzione sicura (mai un crash o un blocco) e onesta su cosa
non è stato controllato.

## Problema 2 — incoerenza fra "non configurato" e "controllato, risultato negativo"

In `valuta_riga`, quando un parametro opzionale manca, il comportamento oggi non è uniforme:

- `orario_ufficio_inizio`/`fine`, `soglia_backdating_giorni`, `staff_autorizzato` mancanti →
  flag corrispondente `None` (corretto, già sistemato prima della Fase 3).
- `utile_netto_dopo_imposte`, `valore_medio_registrazione`, `performance_materiality`,
  `giorni_weekend`, `festivita`, `parole_chiave_parti_correlate` mancanti → flag corrispondente
  `False` — **sbagliato**: un cliente senza queste cifre configurate vedrebbe "0 righe sopra
  performance materiality" come se il controllo fosse stato eseguito e avesse dato esito negativo,
  quando in realtà non è mai stato eseguito.

Correggi tutti questi criteri per restituire `None` quando il rispettivo parametro è `None`,
esattamente come già fanno gli altri tre. `flag_importo_cifra_tonda` e `flag_descrizione_vuota`
restano invariati (non dipendono da nessun parametro opzionale del cliente, sono sempre
calcolabili dal solo dato della riga). Verifica che la somma pesata (`punteggio_totale`) continui a
ignorare correttamente i flag `None` dopo la modifica (dovrebbe già funzionare, dato che il filtro è
già `if flag is True`, ma conferma con un test esplicito per ciascun criterio toccato).

## Cosa NON fare

Non toccare `backend/jet/ingest.py` né l'adattatore usato per ALUK (resta fuori da questo
repository per ora, è uno script di prova che ho scritto io — ne parliamo separatamente se vogliamo
renderlo riutilizzabile). Non inventare valori di fallback per i parametri mancanti. Non modificare
i pesi (`punteggio_*`) né `soglia_da_investigare`.

## Test richiesti

Per `verifica_sequenza`: un test con un gap piccolo (comportamento invariato), un test con un gap
che supera `gap_massimo` (verifica che non venga enumerato e che compaia nella segnalazione
separata), un test con `gap_massimo` esplicitamente più permissivo che dimostra che il limite è
configurabile. Per `criteri.py`: un test per ciascuno dei sei criteri toccati che verifica `None`
quando il parametro è assente (analogo ai test già esistenti per gli altri tre). Rilancia tutta la
suite (110 test dopo la Fase 4/4b — la Fase 4b non ha aggiunto test, solo modificato lo script di
validazione): nessuna regressione, più i nuovi test.

## Consegna

Branch nuovo da `jet/fase4b-correzione-colonna-conto`, es. `jet/fase5-correzioni-test-reale`.
Commit locali, niente push né PR. Nel riepilogo finale: il diff esatto, il risultato di tutta la
suite, e conferma che uno scenario sintetico con un gap enorme (es. da 1 a 10^15) non causa più
blocchi o consumo di memoria eccessivo.
