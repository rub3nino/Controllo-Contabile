# Revisione Fase 7 — onboarding del secondo cliente (Suedwolle Group Italia S.p.A.)

Branch: `redesign/fase7-secondo-cliente-swgi` (sopra `redesign/fase6-chiusura-gap-minori`), commit `83916a5`. Questa è la fase che conta di più finora: è il collaudo dell'intera architettura, non un incremento di funzionalità.

## Il risultato che conta

**Il diff tocca un solo file: `backend/domain/clients/swgi.yaml`. Zero righe di codice.** È esattamente il criterio di successo scritto nel piano fin dall'inizio: un cliente nuovo, con banche diverse (Commerzbank, Credem, Sella, Asti, BNL invece del parco Ferrero), fondi previdenziali diversi (ENASARCO/PREVIMODA/SANIMODA invece di QUADRIFOR e gli altri), 79 documenti reali mai visti prima, gira sul motore esistente e produce 95 evidenze e 9 stati di sezione senza che nessuno abbia dovuto toccare `verification_engine.py`, `ingest_adapter.py`, `client_classify.py` o `excel_renderer.py`. La separazione tra motore e configurazione, costruita in 6 fasi, regge davvero.

## Cosa è stato verificato

`git diff redesign/fase6-chiusura-gap-minori..redesign/fase7-secondo-cliente-swgi --stat`: 1 file, 99 righe, tutte in `backend/domain/clients/swgi.yaml`. Confermato.

Ho riletto `swgi.yaml` per intero e **verificato indipendentemente, non per fiducia, il punto più delicato**: Codex dichiara di aver trovato un codice conto Credem "ordinario" (`280930`) distinto dall'e-commerce (`280940`), un dettaglio che io stesso, esplorando la stessa cartella prima di scrivere il prompt, non ero riuscito a trovare nel foglio `Bil. verifica` del bilancino. Ho cercato `280930` in tutti i fogli del workbook: esiste davvero, in `Mapping Finale` (riga 122) e `Conti SAP` (riga 184), descritto come "Credem Banca EUR" con un saldo corrente reale di 167.220,60 — non inventato, trovato in un foglio diverso da quello che avevo controllato io. Buon segno: ha cercato più a fondo di quanto avessi fatto io stesso in fase di preparazione del prompt.

Il file carica correttamente come `ClientConfig` valido (verificato con `load_client_config("swgi")` in un ambiente pulito): 25 voci applicabili, 8 banche, 3 fondi previdenziali, nessun errore di validazione Pydantic. `list_clients()` lo elenca insieme a Ferrero e demo.

Rieseguita tutta la suite in ambiente pulito: **75 passati, 0 falliti** — coincide con la Fase 6, nessuna regressione, coerente col fatto che non sono stati aggiunti test (motivazione accettabile: è un cambio di sola configurazione, e lo scan reale è di per sé una prova più significativa di qualunque test sintetico).

## Sui limiti emersi (senza modificare codice, come richiesto)

Codex ha resistito bene alla tentazione di "aggiustare" il motore per far tornare i numeri — ho verificato personalmente il primo dei due problemi che segnala, perché è il più concreto:

**Il libro giornale provvisorio SWGI viene classificato D.1 invece di B.4.** Ho letto `backend/classify.py`: la regola per D.1 include la frase-chiave `"libro giornale"` (punteggio 12) come match generico, mentre quella per B.4 richiede `"giornale provv"` **come sottostringa contigua** (punteggio 9). Il file si chiama `"SWGI - Libro Giornale 2026.06.30 provvisorio.xlsx"` — "giornale" e "provvisorio" non sono adiacenti (c'è la data in mezzo), quindi il match B.4 non scatta, mentre "libro giornale" combacia sempre e vince per assenza di concorrenza. È una vera imprecisione euristica di `classify.py`, preesistente, mai emersa prima perché il file Ferrero equivalente aveva probabilmente una struttura diversa nel nome. Non blocca nulla adesso (la voce risulta comunque presente, solo sotto l'item sbagliato), ma è un candidato concreto per una fase futura di rifinitura della classificazione.

Il secondo punto (estrazione di alcuni saldi F.1 che prende date o numeri di intestazione invece del saldo) tocca solo `Evidence.fields` — informativo, non lo stato calcolato, come dice correttamente Codex. Anche la nota su C.3 non riconosciuto separatamente da C.1 sul verbale di nomina è dello stesso genere: precisione della classificazione su un documento reale con un formato leggermente diverso da quello con cui l'euristica è stata tarata, non un errore del motore di dominio.

## Sulla performance (11 minuti per lo scan)

Un numero da tenere d'occhio, non un blocco: OCR sincrono su 79 documenti reali, alcuni PDF pesanti (i saldi COGE arrivano a 4-6 MB). Se questo sistema deve girare davvero per uso quotidiano dello studio, prima o poi varrà la pena guardare a caching dell'OCR per documento già visto o a uno scan asincrono — ma è un problema di scala, non di correttezza, e non è urgente ora che l'unico uso è di validazione.

## Verdetto

Fase 7 approvata, ed è la conferma più importante di tutto il redesign: l'architettura generalizza a un cliente reale diverso senza toccare codice. I tre limiti segnalati (classificazione B.4/D.1, precisione di alcuni campi F.1, performance OCR) sono reali ma minori, ben diagnosticati, e nessuno richiede di riaprire il motore in fretta e furia.

## Verso la prossima fase

Direi che a questo punto ha senso una fase piccola e mirata di rifinitura della classificazione (`classify.py`) — il B.4/D.1 in particolare, perché è un errore concreto e riproducibile, non solo una supposizione — prima di considerare il sistema pronto per un terzo cliente. Fammi sapere se vuoi procedere così o se preferisci prima altro (es. mostrare in dashboard/Excel i dati granulari di Fase 5/6, ancora non consumati da nessuna UI).
