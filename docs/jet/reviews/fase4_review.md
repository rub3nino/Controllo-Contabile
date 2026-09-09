# Revisione JET Fase 4 — dimensione conto

Branch: `jet/fase4-dimensione-conto` (sopra `jet/fase3b-utenti-sistema`, approvato), commit `dc95a1d`.

## Verifica del codice — approvata

`git diff jet/fase3b-utenti-sistema..jet/fase4-dimensione-conto --stat`: **5 file, esattamente
quelli dichiarati**. Letto il diff completo di `criteri.py`/`models.py`/`__init__.py`: `valuta_riga`
resta retrocompatibile (il nuovo parametro `frequenze_conto` è opzionale, default `None`, e senza
di esso il comportamento è identico a prima — verificato con un test dedicato, non solo affermato).
`calcola_frequenza_conti` è pura e ignora correttamente le righe senza conto. I due nuovi criteri si
integrano nella somma pesata con la stessa disciplina degli altri undici (`peso is not None`
aggiunto correttamente alla guardia, altrimenti un peso `None` avrebbe rotto la somma). `models.py`
è additivo, nessun campo esistente toccato. Letto anche `tests/test_jet_conti.py` per intero: sette
test mirati, incluso uno esplicito sulla retrocompatibilità e uno sulla distinzione fra "lista non
fornita" (`None`, non calcolabile) e "conto non nella lista fornita" (`False`) — la stessa
distinzione già vista più volte in questo progetto, applicata di nuovo correttamente.

Suite in ambiente pulito (`git archive` + venv nuovo): **110 passati, 0 falliti** (103 + 7 nuovi) —
coincide con la mia riesecuzione, non con i "121" di Codex, stessa causa già segnalata (file non
tracciati nella cartella di lavoro).

**L'implementazione della Fase 4 è corretta e approvata così com'è.**

## Un errore reale nei numeri di validazione — e in un mio documento precedente

Qui la cosa si complica, e la responsabilità è in parte mia. Ho controllato personalmente, riga per
riga, l'allineamento posizionale fra `Original data` e `Data Input` che lo script usa per associare
il conto a ogni riga (l'approccio — zip per posizione con solo un controllo di lunghezza uguale — mi
sembrava rischioso in astratto): **l'allineamento è corretto**, l'ho verificato confrontando importi
e descrizioni riga per riga in più punti del file, dall'inizio alla fine. Non è questo il problema.

Il problema è **quale colonna abbiamo scelto come "conto contabile"** fin dalla Fase 2. Ho contato i
valori reali della colonna `Conto contabile` su tutte le 213.656 righe: **180.794 di queste (l'85%)
non sono affatto codici conto — sono etichette del tipo di documento SAP** ("Invoice ZF2" da sola
compare 64.245 volte — è il "valore massimo di frequenza" che compare nei numeri di Codex, non un
conto usato 64 mila volte —, poi "CoS EDI", "Imposta di bollo assolta", "Vendor invoice", "G/L
account posting" e simili). Solo il 15% dei valori sono numeri che sembrano codici conto veri.

Controllando le altre due colonne candidate: `Conto n.` è invece valorizzata su tutte le 213.656
righe, numerica al 99,97% (213.584/213.656), con 1.957 valori distinti e una distribuzione
credibile per un vero piano dei conti (il valore più frequente, "106209", copre il 12,7% delle
righe — plausibile per un conto operativo dominante, non per un'etichetta di sistema). `Conto conta`
è valorizzata solo sul 19% delle righe e ha appena 15 valori distinti — sembra piuttosto un codice di
raggruppamento/contropartita, non il conto principale.

**`Conto n.` è quasi certamente il conto giusto, `Conto contabile` non lo è** — nonostante il nome
sembri il più ovvio. Ho anche notato, tornando a guardare la riga reale che avevo estratto io stesso
in Fase 2 come "ground truth" (`Conto contabile=36422000002`), che nelle righe immediatamente
successive quel valore incrementa di uno a ogni riga (36422000002, 36422000003, 36422000004...) —
un comportamento tipico di un **numero di riferimento/documento**, non di un codice conto, che
avrei dovuto notare allora e non ho notato. **L'esempio che ho fornito io nel prompt della Fase 2
era quindi fuorviante**: proveniva dalla mia analisi del file ma non avevo verificato quella colonna
contro l'intera popolazione, solo contro un'unica riga. Codex ha lavorato correttamente sulla base
di quell'indicazione — l'errore è a monte, non nella sua esecuzione.

Con la colonna corretta (`Conto n.`), la distribuzione reale è molto diversa e molto più
plausibile:

| Misura | Con `Conto contabile` (sbagliata) | Con `Conto n.` (corretta) |
|---|---:|---:|
| Conti distinti | 7.818 | 1.957 |
| Frequenza massima | 64.245 (in realtà un'etichetta di documento) | 27.104 (plausibile, conto operativo) |
| Conti con frequenza < 5 | 2.191 (8.379 righe, 3,9%) | 763 (1.896 righe, 0,9%) |
| Conti con frequenza < 10 | 7.662 (98% dei conti!) | 1.175 (4.611 righe, 2,2%) |
| Conti con frequenza > 1.000 | 13 | 25 |

La soglia `5` proposta da Codex, con la colonna corretta, isola circa lo 0,9% della popolazione
invece del 3,9% ipotizzato — un risultato molto più in linea con quello che ci si aspetta da un
criterio di rarità ben calibrato.

## Non blocca il codice, blocca solo la validazione — e un'implicazione per il nuovo cliente

Il codice di `criteri.py`/`models.py` non va toccato: la scelta di quale colonna passare come
`conto_contabile` è, correttamente, decisa dal chiamante (lo stesso principio già sancito in Fase
2 sull'ambiguità delle tre colonne). Va corretto solo `scripts/valida_jet_nordson.py`, che oggi
legge `Conto contabile` invece di `Conto n.`.

C'è anche un'implicazione pratica per i tre documenti del nuovo cliente che hai appena ricevuto:
prima di fidarci di quale colonna userà il mapper per il conto, vale la pena applicare lo stesso
controllo che ho fatto qui — percentuale di valori numerici vs testuali, tasso di copertura,
cardinalità — invece di scegliere in base a una sola riga di esempio. Lo includo nel prossimo
prompt come passaggio esplicito, così non si ripete.

## Verdetto

Fase 4 **approvata per il codice**, ma la validazione contro Nordson va rifatta con la colonna
giusta prima di considerarla definitiva. Prompt di correzione allegato — piccolo, isolato, non
tocca la logica già approvata.
