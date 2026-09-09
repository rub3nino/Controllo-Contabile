# Prompt — JET Fase 4: colmare il gap sulla dimensione conto (Quadra — modulo JET)

## Contesto

Prosegui sopra `jet/fase3b-utenti-sistema` (approvato: undici criteri Fase 3 più l'esclusione degli
account di sistema). Questa è la fase centrale del piano concordato: lo strumento Excel storico non
copre affatto la dimensione conto perché la colonna viene scartata durante la pulizia dati, prima di
arrivare a `Calcs1` — tre dei criteri di ISA 240 §A44 (conto insolito/raro, conto storicamente
problematico, conto infragruppo/parte correlata) sono quindi oggi completamente non testabili.
`RigaGiornale.conto_contabile` esiste già dalla Fase 1 proprio per questo. `EsitoRigaJet` ha già tre
campi sempre `None` fino ad ora: `frequenza_utilizzo_conto`, `flag_conto_insolito_raro`,
`flag_conto_infragruppo_parte_correlata` — questa fase li rende reali.

Prima di scrivere codice, leggi `backend/jet/models.py`, `backend/jet/criteri.py` per intero
(cambia struttura in un punto importante, vedi sotto) e `docs/jet/JET_analisi_file_NORDSON.pdf`
sezione sui limiti del gap conto.

## Un cambio di forma della funzione, non solo di contenuto

Gli undici criteri esistenti valutano una riga alla volta, indipendentemente dalle altre. La
frequenza di utilizzo di un conto invece è per definizione una proprietà **dell'intera
popolazione**: non si può sapere se un conto è "raro" guardando una riga sola. Questo richiede due
passaggi distinti, da tenere separati:

1. Una funzione pura `calcola_frequenza_conti(righe: list[RigaGiornale]) -> dict[str, int]` che
   conta quante volte compare ogni valore di `conto_contabile` (ignorando le righe con
   `conto_contabile=None` — non contano né a favore né contro nessun conto).
2. `valuta_riga` acquisisce un nuovo parametro **opzionale**, `frequenze_conto: dict[str, int] |
   None = None`. Se fornito e `riga.conto_contabile` non è `None`, imposta
   `frequenza_utilizzo_conto` al conteggio trovato (0 se il conto non compare nel dizionario, cosa
   che non dovrebbe succedere se il dizionario viene dalla stessa popolazione, ma non assumerlo) e
   calcola `flag_conto_insolito_raro` confrontando la frequenza con una nuova soglia configurabile
   (vedi sotto). Se `frequenze_conto` non è fornito, oppure `riga.conto_contabile` è `None`,
   entrambi i campi restano `None` — **comportamento identico a oggi quando questa fase non viene
   usata**, per non rompere silenziosamente le chiamate esistenti a `valuta_riga` (comprese quelle
   nei test già scritti in Fase 3/3b, che non passano questo parametro).

## Cosa aggiungere al modello

In `ParametriClienteJet` (additivo, non toccare nient'altro):

- `soglia_frequenza_insolita: int | None = None` — un conto con `frequenza_utilizzo_conto` sotto
  questa soglia (numero di registrazioni nel periodo) è marcato insolito/raro. Nessun default
  numerico: se il cliente non lo fornisce, il criterio resta `None` per ogni riga anche quando
  `frequenze_conto` è disponibile (dato mancante ≠ zero, stessa regola di sempre).
- `conti_infragruppo_parte_correlata: list[str] | None = None` — elenco esplicito di codici conto
  noti come infragruppo o verso parti correlate. **Non inventare un modo per dedurlo dal codice
  conto** (es. prefissi, range numerici): senza un piano dei conti con descrizioni, che non
  abbiamo, non c'è modo affidabile di riconoscerlo automaticamente — deve essere una lista fornita
  esplicitamente, come già festività/staff/parole chiave.
- Due pesi: `punteggio_conto_insolito_raro: int | None = None` e
  `punteggio_conto_infragruppo_parte_correlata: int | None = None` — coerenti con gli altri undici
  pesi già presenti, ma opzionali (a differenza degli altri) perché questi due criteri potrebbero
  restare inapplicati per un cliente che non fornisce le soglie/liste sopra.

In `valuta_riga`: se `flag_conto_insolito_raro`/`flag_conto_infragruppo_parte_correlata` risultano
`True` e il relativo peso è impostato, contribuiscono al `punteggio_totale` esattamente come gli
altri undici — stessa logica di somma-pesata-contro-soglia, non un percorso separato.

`flag_conto_infragruppo_parte_correlata`: `None` se `conti_infragruppo_parte_correlata` è `None` o
`riga.conto_contabile` è `None`, altrimenti `riga.conto_contabile in conti_infragruppo_parte_correlata`.

## Validazione sul caso reale Nordson

Non abbiamo un piano dei conti reale né una soglia di rarità comunicata dal cliente per Nordson, quindi
la validazione qui è necessariamente parziale — dillo esplicitamente nel riepilogo, non forzare un
confronto che non è disponibile. Nello script `scripts/valida_jet_nordson.py`, aggiungi comunque il
calcolo di `calcola_frequenza_conti` sul file reale e stampa: quanti conti distinti compaiono, la
distribuzione (es. quanti conti hanno frequenza 1, quanti sotto 10, quanti sopra 1000) — è
un'informazione utile di per sé, anche senza una soglia configurata, e permette di proporre a Ruben
una soglia plausibile basata sui dati reali invece di indovinarne una nel codice. Non impostare
`conti_infragruppo_parte_correlata` per Nordson (lista non disponibile) — lascia quel criterio non
applicato nella validazione, documentandolo.

## Cosa NON fare

Non modificare i criteri esistenti (1-11) né la loro logica. Non dedurre "insolito" o "infragruppo"
da euristiche sul formato del codice conto. Non cambiare la firma di `valuta_riga` in modo che rompa
le chiamate esistenti senza il nuovo parametro (deve restare compatibile all'indietro, default
`None`). Non integrare ancora questo modulo con `backend/domain/` — resta un pacchetto isolato,
l'integrazione è una fase successiva da discutere.

## Test richiesti

Test su `calcola_frequenza_conti`: conteggio corretto su dati sintetici, righe con
`conto_contabile=None` ignorate. Test su `valuta_riga` con `frequenze_conto` fornito: un conto
frequente (sopra soglia) non flaggato, uno raro (sotto soglia) flaggato, contributo al punteggio
totale corretto. Un test esplicito che verifica che **senza** passare `frequenze_conto` (come fanno
già tutti i test Fase 3/3b) il comportamento di `valuta_riga` è identico a prima — nessuna
regressione silenziosa sulla firma della funzione. Test su `flag_conto_infragruppo_parte_correlata`
con lista fornita e non fornita. Rilancia tutta la suite (103 test dopo la Fase 3b, verificati in
ambiente pulito): nessuna regressione.

## Consegna

Branch nuovo da `jet/fase3b-utenti-sistema`, es. `jet/fase4-dimensione-conto`. Commit locali, niente
push né PR. Nel riepilogo finale: il diff esatto, il risultato di tutta la suite, la distribuzione di
frequenza dei conti reali di Nordson (senza soglia applicata, solo osservazione), e una proposta
motivata di soglia plausibile che io possa discutere con Ruben prima di configurarla per davvero.
