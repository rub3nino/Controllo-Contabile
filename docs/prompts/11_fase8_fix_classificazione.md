# Prompt — Fase 8: correggere la classificazione B.4/D.1 emersa dal caso SWGI (Quadra redesign)

## Contesto

Lavori nel repository di **Quadra** (FastAPI in `backend/`, React/Vite in `ui/`), l'app che aiuta un collegio sindacale a compilare il controllo contabile trimestrale (art. 2409-ter c.c., principio SA Italia 250B). La Fase 7 (onboarding del secondo cliente reale, Suedwolle Group Italia S.p.A.) ha validato l'architettura senza toccare codice — ma ha fatto emergere un'imprecisione reale, riproducibile, in `backend/classify.py`, non nel motore di dominio. Questa fase la corregge in modo mirato. Prima di scrivere codice, leggi in ordine:

1. `docs/reviews/fase7_review.md` — la segnalazione originale e la verifica che ho già fatto io stesso leggendo `classify.py`.
2. `backend/classify.py` **per intero**, in particolare `NAME_RULES` (righe ~19-46) e le regole di disambiguazione dopo il loop principale in `classify_text` (righe ~86-107, i blocchi `if`/`elif` che aggiustano i punteggi per casi speciali come "mastrini" vs "giornale definitivo", e il blocco C.1/C.3 su "collegio").
3. `tests/test_domain_client_classify.py` (o l'equivalente test esistente per `classify.py`/`client_classify.py`, verificane il nome esatto) — lo stile dei test già presenti, per non reinventare un pattern nuovo.

## Il problema, con la causa esatta

Il file `"SWGI - Libro Giornale 2026.06.30 provvisorio.xlsx"` (item atteso: **B.4**, libro giornale provvisorio) viene classificato **D.1** (libro giornale definitivo/bollato) invece. Causa, verificata leggendo il codice:

- `NAME_RULES` assegna a D.1 12 punti per il match generico `"libro giornale"` (una sottostringa che compare in moltissimi nomi di file, provvisori o definitivi che siano).
- Assegna a B.4 9 punti solo per il match **esatto** `"giornale provv"` — che richiede "giornale" e "provv..." **adiacenti**. Nel nome SWGI non lo sono (c'è la data `2026.06.30` in mezzo), quindi il match B.4 non scatta.
- Il blocco di disambiguazione dopo il loop (righe ~101-107) gestisce già correttamente il caso "mastrini" (booste B.4 a 16, sopprime D.1) e il caso "definitivo/bollato" (booste D.1 a 16, sopprime B.4) — ma **non esiste un caso analogo per "provvisorio" non adiacente a "giornale"**. Quando il nome contiene "giornale" e "provvisorio" ma non uno dei due pattern espliciti, resta solo il punteggio generico di D.1 a decidere, e vince per assenza di concorrenza.

## Cosa costruire

Nel blocco di disambiguazione di `classify_text` (`backend/classify.py`, lo stesso punto dove già vivono i casi "mastrini" e "definitivo/bollato"), aggiungi un caso analogo per "provvisorio": se il nome contiene `"giornale"` e `"provvisorio"` (in qualunque posizione, non necessariamente adiacenti — usa lo stesso stile di controllo già usato per il caso "definitivo/bollato", che infatti già cerca `"definitiv|bollat"` con `re.search` su tutto il nome, non una sottostringa esatta: replica quello stile, non quello più rigido di `NAME_RULES`), assegna a B.4 un punteggio che vince sicuramente su D.1 (guarda i valori già usati — 16 per il caso mastrini — per restare coerente), e sopprimi D.1 allo stesso modo. Attenzione all'ordine delle condizioni: il caso "definitivo/bollato" esistente deve continuare a vincere quando presente (un nome con sia "provvisorio" sia "definitivo" non dovrebbe capitare nella pratica, ma se la logica te lo permette di verificare in modo pulito con un `elif` ben ordinato, fallo).

## Sul caso C.1/C.3 (verifica, non necessariamente correggere)

La Fase 7 ha anche segnalato che il verbale SWGI del 29/04/2026 (titolo: "app.ne bil + nomina collegio sindacale") viene classificato C.1 (verbale assemblea soci) invece di C.3 (verbale Collegio sindacale). **Prima di correggere qualcosa, verifica se è davvero un errore**: il titolo del documento suggerisce che sia il verbale di un'**assemblea dei soci** che approva il bilancio e, nella stessa seduta, nomina il Collegio sindacale — in tal caso è correttamente un verbale C.1 (di assemblea), non un verbale C.3 (che sarebbe invece il verbale di una riunione *del* Collegio sindacale stesso, un organo diverso). Leggi il blocco esistente in `classify_text` che gestisce esplicitamente questo tipo di collisione (righe ~92-95, il commento dice "G.2 folder copies... stay G.1" ma il codice sotto tratta C.1 vs C.3 — il commento sembra disallineato dal codice, verificalo e correggilo se è davvero un refuso) — è già una scelta deliberata di favorire C.1 quando il nome contiene "collegio" e C.1 ha già un punteggio alto, non uno stub dimenticato. Se concludi che il comportamento attuale è semanticamente corretto (un verbale di assemblea che tratta anche la nomina del Collegio resta un verbale di assemblea), lascialo com'è e scrivilo chiaramente nel riepilogo — non modificare un comportamento intenzionale solo perché è stato segnalato, se la segnalazione si rivela una lettura errata mia o di Codex in Fase 7.

## Cosa NON fare

Non toccare `backend/domain/client_classify.py` (il wrapper di dominio, Fase 2): questa fase corregge `backend/classify.py`, la funzione di base che `client_classify.scan_folder_for_client` già riusa — la correzione si propaga automaticamente, non serve toccare il wrapper. Non toccare `backend/extract.py` (il secondo limite segnalato in Fase 7, l'estrazione di alcuni saldi F.1 impropri, resta fuori scope: è un problema diverso, in un file diverso, per una fase futura separata se deciderai di affrontarlo). Non toccare `verification_engine.py`, `ingest_adapter.py`, `excel_renderer.py`, `api.py`. Non modificare `regole/schema.yaml` né i `ClientConfig` esistenti (`ferrero.yaml`, `swgi.yaml`).

## Test richiesti

Un test in stile analogo ai test esistenti di classificazione (guarda `tests/test_domain_client_classify.py` o l'equivalente, e anche se esiste un test diretto su `backend/classify.py`) che riproduce esattamente il nome file SWGI (`"SWGI - Libro Giornale 2026.06.30 provvisorio.xlsx"`) e verifica che venga classificato B.4, non D.1. Un test di non-regressione esplicito che verifica che un nome tipo `"Libro giornale definitivo bollato.pdf"` (o il nome file reale usato nelle fixture Ferrero per D.1, se esiste — cercalo) continui a essere classificato D.1 come prima. Rilancia **tutta** la suite `tests/` — deve coincidere con la Fase 7 (75 test) più i test nuovi, nessuna regressione, in particolare `tests/test_domain_fase1_e2e.py` (il caso Ferrero) deve continuare a passare identico.

## Consegna

Lavora su un branch nuovo a partire da `redesign/fase7-secondo-cliente-swgi`, es. `redesign/fase8-fix-classificazione-b4-d1`. Commit locali, niente push né PR. Nel riepilogo finale: il diff esatto su `classify.py`, il risultato del test sul nome file SWGI reale, conferma che Ferrero non regredisce, risultato di tutta la suite, e la tua conclusione motivata sul caso C.1/C.3 (corretto così com'è, o davvero da correggere — e se lo correggi, perché e con quale test).
