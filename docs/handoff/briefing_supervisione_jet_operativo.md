# Briefing per una nuova sessione di supervisione — Quadra, rendere JET operativo

Questo documento sostituisce una conversazione precedente. Leggilo tutto prima di fare qualunque cosa: contiene
il contesto, le regole del progetto e lo storico di cui hai bisogno per continuare correttamente. Non è un
prompt per implementare codice — è il briefing con cui tu, in questa nuova sessione, devi prendere in mano il
ruolo di **supervisore** di questo progetto, esattamente come lo ha svolto la sessione precedente.

## Chi è l'utente e come lavora

Ruben gestisce un progetto software interno, "Quadra", per il suo studio di revisione contabile. Usa Codex o
Claude Code per implementare il codice, e fa lui stesso tutte le operazioni git (branch, commit, merge). Il tuo
ruolo **non è scrivere codice**: è scrivere prompt dettagliati in italiano per la sessione di implementazione
(Codex/Cursor), e poi verificare in modo indipendente il lavoro fatto prima di dare il via libera alla fase
successiva. Non fare mai commit git tramite il bridge verso il suo computer.

Il repository si trova su un Mac collegato a questa sessione tramite un bridge remoto (strumenti
`mcp__remote-devices__*`): se disponibili nella tua sessione, la cartella connessa è
`/Volumes/SSDRubb/Controllo Contabile automatizzato`. Se quegli strumenti non sono disponibili, chiedi a Ruben
di ricollegare il computer o di allegare i file necessari — non puoi accedere al repository altrimenti.

## Il metodo di supervisione, non negoziabile

Per ogni fase di lavoro:

1. Scrivi un prompt in italiano, molto dettagliato, per Codex/Cursor — con contesto, cosa implementare
   esattamente, cosa NON toccare, e una checklist di autoverifica finale per chi implementa.
2. Aspetti che Ruben ti riporti (di solito incollando il messaggio di completamento di Codex) cosa è stato
   fatto.
3. **Non ti fidi del riepilogo**: verifichi tu stesso, indipendentemente.
   - Controlli lo scope del diff: `git diff <branch-precedente>..<branch-nuovo> --stat` deve mostrare
     esattamente i file dichiarati, non di più.
   - Leggi il codice per intero, non solo il diff a campione.
   - Rifai girare la suite di test **in un ambiente pulito**, mai nella cartella di lavoro live (che contiene
     parecchio codice non tracciato ed estraneo — vedi sotto): `git archive <branch> -o file.tar.gz`, estrai in
     una cartella temporanea, crea un virtualenv nuovo, installa le dipendenze, e usa sempre
     `python -m pytest tests/ -q` (mai `pytest` nudo: senza `conftest.py`/`pytest.ini` fallisce con
     `ModuleNotFoundError` perché non trova la root del pacchetto).
   - Quando la fase riguarda dati reali, **rieseguila tu stesso** con i dati reali a disposizione, non ti
     limitare a leggere i numeri dichiarati da Codex.
4. Scrivi una revisione datata con l'esito (approvato o cosa manca) prima di passare alla fase successiva.
5. Consegni file (prompt, revisioni) con: `Write` in una cartella locale → copia in `/mnt/user-data/outputs/`
   → `SendUserFile` → `device_commit_files` con il `file_uuid` restituito verso il percorso esatto nel
   repository sul Mac.

## Storico del modulo JET (Fasi 1–5, già completate e approvate)

JET (Journal Entry Testing) è un modulo isolato in `backend/jet/` (nessuna dipendenza da `backend/domain/`),
che analizza il libro giornale di un cliente secondo i criteri di rischio ISA 240 §A44: conti insoliti/rari,
importi a cifra tonda, registrazioni fuori orario o festive, personale non autorizzato, parti correlate, buchi
nella sequenza dei numeri documento, e altri (undici criteri storici in totale, più la dimensione "conto").

File principali:
- `backend/jet/models.py` — `RigaGiornale` (una riga del giornale), `ParametriClienteJet` (parametri
  configurabili per cliente: materialità, pesi/punteggi per ciascun criterio, elenco utenti di sistema da
  escludere, festività, soglia di rarità conto, conti infragruppo/parti correlate, soglia "da investigare"),
  `EsitoRigaJet` (risultato per riga, un campo booleano-o-None per ciascun criterio), `EsitoSequenzaJet`.
- `backend/jet/ingest.py` — lettura e mappatura di file Excel (`leggi_righe_xlsx`, `mappa_righe_giornale`).
- `backend/jet/criteri.py` — `valuta_riga(riga, parametri, frequenze_conto=None)`, `calcola_frequenza_conti`.
- `backend/jet/sequenza.py` — `verifica_sequenza(righe, gap_massimo=10_000)`.

**Disciplina fondamentale da rispettare sempre in questo modulo**: quando un criterio dipende da un parametro
non configurato per quel cliente, il risultato deve essere `None` (non calcolabile), **mai** `False` — `False`
significherebbe "controllato, risultato negativo", mentre non è stato affatto controllato. Confonderli dà un
falso senso di sicurezza a un revisore. Questo principio è stato applicato con fatica su più fasi (Fase 1 sui
tre criteri originali, Fase 5 sugli altri sei) — non regredire mai su questo.

Le cinque fasi, in sintesi: Fase 1 (contratti dati), Fase 2 (ingest Excel), Fase 3/3b (undici criteri +
gestione utenti di sistema), Fase 4/4b (dimensione conto: frequenza, conti insoliti, infragruppo — la 4b ha
corretto un mio errore di colonna nel prompt originale), Fase 5 (due bug di robustezza emersi dal primo test
su dati reali: crash potenziale in `verifica_sequenza` su sequenze miste, e sei criteri che restituivano
ancora `False` invece di `None`). Tutte approvate, tutte verificate con il metodo sopra.

## I due test su dati reali (perché contano)

**Nordson**: 213.656 registrazioni, file Excel da SAP. Risultati del modulo confrontati riga per riga con il
foglio Excel storico già usato dal team — coincidenza esatta sui numeri chiave (1.104 profit impact, 19.196
importi a cifra tonda, 17 buchi di sequenza secondo l'Excel, 184 da investigare).

**ALUK Group S.p.A.**: 56.133 registrazioni, formato completamente diverso — non Excel, ma tre file di testo a
colonne fisse ("Stampa di Prova Giornale Contabile"), ciascuno con un totale "TOTALI STAMPA" di
autoverifica. Per questo test la sessione precedente ha scritto un parser da zero (fuori dal repository, in
un ambiente di verifica), derivando le posizioni delle colonne dalle etichette di intestazione e risolvendo
l'ambiguità Dare/Avere tramite la posizione finale del match dell'importo — validato al centesimo contro i
totali dichiarati nei file stessi. Questo test ha fatto emergere i due bug corretti in Fase 5. **Nota
importante**: il parser ALUK non è mai stato portato nel repository — vive solo come riferimento del metodo
da riapplicare. Un limite noto e non ancora risolto: su ALUK il controllo di sequenza è sicuro (non crasha)
ma non ancora significativo, perché il campo numero-documento di quel gestionale mescola più serie parallele.

## Stato attuale del resto del progetto (contesto, non è il tuo compito immediato)

In parallelo a JET, Ruben ha commissionato una ricostruzione completa del frontend (`ui/`) secondo un design
system chiamato "Atelier Document System" (stile Notion: base chiara e calda `#faf9f6`, inchiostro
`#232321`/`#5f5e5b`, bordi hairline, nessuna ombra marcata, sidebar a 5 sezioni: Controllo Contabile, JET (ISA
240), Sezione 3/4/5 segnaposto). Un prompt dettagliato per Cursor/Opus è già stato consegnato e salvato in
`docs/prompts/20_ui_redesign_atelier_cursor.md`, ma **non è ancora stato verificato** — se Ruben ti dice che
Cursor ha finito quel lavoro, va verificato con lo stesso rigore (diff, lettura codice, verifica visiva)
prima di considerarlo concluso. Questo lavoro e il rendere-JET-operativo sono paralleli e collegati: la pagina
"JET" nel nuovo frontend era stata pensata come pagina di stato/racconto dei lavori svolti, non come strumento
operativo — è proprio questo che ora va cambiato.

Problema aperto, mai risolto, da segnalare se non già affrontato: la cartella di lavoro di Ruben contiene
parecchio codice **non tracciato** e mai commissionato da nessun prompt di questo progetto — `backend/modules/jet/`
(una reimplementazione parallela in inglese), `backend/enterprise/` (autenticazione/JWT/SSO/multi-tenancy),
`backend/core/`, Dockerfile, e modifiche non commesse a `requirements.txt`/`ui/package.json`/`ui/vite.config.ts`.
Non va mai usato come base né toccato — va solo segnalato a Ruben come scope creep da chiarire con chi scrive il
codice.

## Il compito che ti aspetta ora: rendere JET operativo

Decisioni già prese con Ruben, **non ridiscuterle**:

- **Formato di input, prima fase**: solo file Excel (il modulo di ingest esiste già). Successivamente vanno
  aggiunti TXT a colonne fisse (il più frequente in pratica), PDF testuale, PDF scansionato — in
  quest'ordine di priorità.
- **Niente estrazione basata su modello AI**: costo e affidabilità non accettabili per dati contabili. La
  strategia è invece un **motore di "profili di estrazione" basato su regole**, riutilizzando lo stesso
  metodo usato a mano per ALUK ma reso generico e riusabile:
  - Ogni famiglia di formato (= ogni gestionale/cliente) ha un profilo salvato: per un TXT a colonne fisse, le
    posizioni esatte dei caratteri di inizio/fine di ogni campo, derivate dall'intestazione; per un PDF
    testuale, la stessa logica applicata al testo estratto riga per riga; per un CSV/delimitato, carattere
    separatore e ordine colonne.
  - Quando arriva un file, il sistema prova a far combaciare l'intestazione con i profili già noti; se
    combacia, estrae automaticamente; se no, mostra al revisore l'intestazione grezza e gli chiede di indicare
    una volta sola dove sono i campi che servono (data, conto, importo dare/avere, descrizione, numero
    documento...) — quella configurazione diventa un nuovo profilo salvato e riusato per i file futuri dello
    stesso cliente/gestionale.
  - Per i PDF scansionati serve comunque l'OCR (il backend ha già PaddleOCR in uso altrove, import lazy —
    vedi `backend/extract.py`/`paddle_ocr.py`), ma l'interpretazione della struttura resta la stessa logica a
    regole, non un modello che "legge e capisce" il contenuto.
- **Parametri cliente** (materialità, firmatari autorizzati, festività, soglia rarità conto, conti
  infragruppo, pesi per criterio): inseriti tramite un **form nell'interfaccia**, non un file di
  configurazione esterno — quindi serve persistenza lato backend per pratica.
- **Collocazione**: JET è una **pratica a sé stante**, con la propria lista di pratiche/analisi, indipendente
  dalle pratiche di Controllo Contabile (non una sotto-sezione delle pratiche esistenti).

### Le fasi da costruire

- **Fase A** (parte da qui): modello dati e API per le pratiche JET (cliente, periodo, stato), form parametri
  completo (tutti i campi di `ParametriClienteJet`), collegamento all'ingest Excel già esistente, esecuzione
  dell'analisi (criteri + sequenza, motore esistente invariato), vista risultati con filtri ed export Excel.
  Alla fine di questa fase JET è operativo end-to-end per chi può fornire il file già in Excel.
- **Fase B**: motore di profili di estrazione per TXT a colonne fisse, con la schermata di configurazione
  assistita al primo utilizzo di un nuovo formato (descritta sopra).
- **Fase C**: estrazione da PDF testuale, riusando lo stesso motore di profili della Fase B.
- **Fase D**: estrazione da PDF scansionato via OCR, poi la stessa pipeline di interpretazione.

## Cosa devi fare adesso, concretamente

1. Se non l'hai già fatto, verifica di avere accesso al repository (bridge verso il Mac) e leggi tu stesso i
   file rilevanti citati sopra (`backend/jet/*.py`, `ui/src/App.tsx`, `ui/tailwind.config.js`, la struttura
   esistente delle pratiche di Controllo Contabile in `backend/domain/` e `ui/src/domain/`) per capire
   esattamente come sono strutturate oggi le pratiche, prima di scrivere il prompt della Fase A — il nuovo
   modello dati JET dovrebbe essere coerente con i pattern già in uso nel progetto, non inventare
   convenzioni diverse senza motivo.
2. Scrivi il prompt della Fase A per Codex/Cursor, seguendo lo stile e il rigore dei prompt precedenti
   (li trovi in `docs/prompts/`, numerati progressivamente — l'ultimo usato è `20_...`, quindi il prossimo
   prompt JET operativo dovrebbe chiamarsi in modo analogo, es.
   `docs/prompts/21_jet_operativo_faseA_pratiche_api.md`). Includi sempre: contesto, cosa implementare, cosa
   NON toccare (il motore `backend/jet/criteri.py`/`sequenza.py`/`ingest.py` non va modificato in questa
   fase, solo collegato), e una checklist di autoverifica per chi implementa.
3. Consegna il prompt a Ruben con la pipeline di file già descritta sopra, e salvalo anche nel repository in
   `docs/prompts/`.
4. Aspetta che Ruben ti riporti l'esito e verificalo con il metodo descritto, prima di scrivere il prompt
   della fase successiva.

Non chiedere a Ruben di ripetere decisioni già prese in questo briefing. Se qualcosa nel codice esistente
contraddice quanto scritto qui (per esempio la struttura delle pratiche di Controllo Contabile è diversa da
come te l'aspetti), fermati e chiedi chiarimento invece di procedere su un'assunzione sbagliata.
