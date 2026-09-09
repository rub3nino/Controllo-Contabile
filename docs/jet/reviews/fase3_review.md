# Revisione JET Fase 3 — criteri di rischio e verifica sequenza

Branch: `jet/fase3-criteri` (sopra `jet/fase2-ingest`, approvato), commit `c97fe2e`.

## Correzione contrattuale preliminare

`git diff jet/fase2-ingest..jet/fase3-criteri --stat`: **8 file, esattamente quelli dichiarati**.
Confermato che la modifica a `backend/jet/models.py` tocca solo i tre campi autorizzati
(`flag_fuori_orario`, `flag_backdated`, `flag_staff_non_autorizzato` da `bool` a `bool | None`),
nessun altro campo toccato. `tests/test_jet_models.py` ha un nuovo test che assegna esplicitamente
`None` a tutti e tre. Corretto: era un vincolo reale del contratto che avrei dovuto notare io stesso
scrivendo il prompt della Fase 3 — bene che Codex l'abbia bloccato prima di scrivere codice che
Pydantic avrebbe rifiutato, invece di forzare un valore.

## Verifica del codice

Letti per intero `backend/jet/criteri.py` e `backend/jet/sequenza.py`. `valuta_riga` replica
correttamente gli undici criteri: ho ricalcolato a mano il caso `test_verdetto_usa_somma_pesata...`
(importo 121, utente "ESTERNO" → profit impact + oltre-10-volte-media + staff non autorizzato =
1+1+4 = 6 punti, soglia 5 → investigare) e torna. La gestione dei tre flag non calcolabili è
corretta: `None` non contribuisce mai punti (`if flag is True`, non un semplice `if flag`, che
avrebbe trattato `None` come falsy ma comunque escluso correttamente — verificato che è la scelta
giusta, non un caso limite non gestito). `verifica_sequenza` ordina, ignora protocolli non numerici
e duplicati, e restituisce solo i buchi — comportamento pulito e diverso, correttamente, dal test di
sequenza del foglio Excel che opera su un contatore ricostruito.

Letti anche `tests/test_jet_criteri.py` (undici casi vero/falso parametrizzati, più i tre test su
non-calcolabilità/verdetto/campi conto ancora `None`) e `tests/test_jet_sequenza.py` — test mirati,
non generici.

## Verifica indipendente in ambiente pulito

`python -m pytest tests/ -q` da `git archive jet/fase3-criteri`: **101 passati, 0 falliti** — non
95+6=101... in realtà torna esattamente: 84 (Fase 2) + 6 (correzione + verifica modello) + 11 (nuovi
criteri/sequenza) = 101. Coincide con la mia riesecuzione, non con i "112 passed" di Codex — stessa
causa già segnalata in Fase 2: la cartella di lavoro reale contiene file non tracciati da git che si
sommano al conteggio. **Questo filone di codice non tracciato sta crescendo**: rispetto alla Fase 2
ho trovato anche `backend/core/`, `Dockerfile`, `Dockerfile.worker`, `docker-compose.yml`,
`docker-compose.prod.yml`, `scripts/init-db.sql`, `ui/Dockerfile`, `ui/nginx.conf` — sembra
un'infrastruttura di deploy completa in costruzione, sempre non commitata. Lo segnalo di nuovo,
in modo più netto: se non è farina del tuo sacco, vale la pena chiedere direttamente a Codex cosa
sta generando fuori dai prompt che gli dai, prima che cresca ancora o finisca committato per sbaglio
insieme al lavoro JET.

## Verifica indipendente sul file reale Nordson — non mi sono fidato del solo riepilogo

Ho rieseguito io stesso `scripts/valida_jet_nordson.py` direttamente sul file reale (213 MB, sul
tuo Mac, senza copiarlo né spostarlo). Risultato, identico a quanto riportato da Codex:

| Controllo | Pipeline | Excel storico | Esito |
|---|---:|---:|---|
| Sopra performance materiality | 1.104 | 1.104 | coincidenza esatta |
| Importo a cifra tonda | 19.196 | 19.196 | coincidenza esatta |
| Da investigare (criterio staff alla lettera) | 190.752 | 184 | vedi sotto |
| Da investigare (senza punti staff) | 184 | 184 | coincidenza esatta |
| Gap di sequenza | 0 | 17 | non confrontabile, spiegato sotto |

Sulla sequenza: confermato che il foglio `Data Input` non contiene `Doc.No.`, solo `TransactionId`
(il contatore ricostruito) — `numero_documento` resta correttamente `None` per ogni riga in questa
validazione, quindi zero buchi rilevabili. I 17 buchi del foglio Excel sono sul contatore, non sul
protocollo gestionale reale — è un limite noto dello strumento attuale, non della nuova pipeline.

## La causa dei 190.618 "staff non autorizzato" — verificata, non solo spiegata

Non mi sono fermato alla spiegazione di Codex sul bug della formula Excel (`Calcs1!T`/`Calcs1!U`,
che di fatto non assegna mai punti al criterio staff) — ho voluto capire perché la nuova
implementazione, che applica la regola dichiarata alla lettera, ne trova così tante. Ho contato gli
utenti distinti nella colonna `UserId` di `Data Input`: 64 utenti in tutto, ma **due soli account,
`BATCHJOB` (135.267 righe) e `BANKBATCH` (43.725 righe), coprono da soli 178.992 delle 190.618
righe flaggate** — l'83% dell'intera popolazione di 213.656 registrazioni. Non è un bug di
matching (case, spazi, colonna sbagliata): sono interfacce automatiche di sistema, non persone, e
ovviamente non compaiono nella lista dei 38 preparatori umani autorizzati. Il criterio sta facendo
esattamente quello per cui è stato scritto — è il foglio Excel storico che, per effetto collaterale
di una formula rotta, non se n'è mai accorto.

## Verdetto

Fase 3 JET approvata. Logica dei criteri e della sequenza corretta e verificata riga per riga, i due
confronti puramente numerici (PM, cifra tonda) coincidono esattamente con il foglio storico, e la
grande divergenza sul totale "da investigare" ha una causa reale e verificata (interfacce di sistema
non distinguibili dal criterio staff così com'è), non un difetto della Fase 3.

## Prossimo passo, prima della Fase 4

Come discusso: aggiungere una lista configurabile di account di sistema da escludere dal criterio
staff (per Nordson: `BATCHJOB`, `BANKBATCH`), invece di lasciare il criterio a segnalare l'83% delle
righe o di disattivarlo silenziosamente come faceva il foglio Excel. Preparo il prompt mirato (Fase
3b, piccola e isolata) prima di passare alla Fase 4 sul gap dimensione-conto.
