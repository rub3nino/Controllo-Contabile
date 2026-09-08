# Revisione Fase 0 — contratti dati condivisi

Branch: `redesign/fase0-contratti-dati`, commit `bc7e0b9`. Revisione eseguita indipendentemente da questa sessione (non sulla sola parola di Claude Code), come da ruolo di supervisione definito in `docs/piano_azione_redesign.md` §8.

## Cosa è stato verificato, e come

**Nessun file esistente toccato.** `git diff main..redesign/fase0-contratti-dati --stat` mostra solo 4 file nuovi (`backend/domain/__init__.py`, `backend/domain/models.py`, `backend/domain/examples/ferrero.yaml`, `tests/test_domain_contracts.py`), zero righe modificate altrove. Confermato anche via `grep` che nessun file esistente (`main.py`, `pipeline.py`, `fill.py`, `extract.py`, `classify.py`, `catalog.py`, `models.py`) importa `backend.domain`: il pacchetto è davvero isolato, non solo a parole.

**Non pushato.** `git log origin/main..redesign/fase0-contratti-dati` mostra il commit come locale, non presente su `origin/main`. Confermato.

**Sintassi/import a posto.** `py_compile` su tutti i file toccati ed esistenti: nessun errore.

**Test eseguiti in modo indipendente.** Non ho potuto usare il venv del progetto da questa sessione (il suo Python punta a un percorso fuori dalla cartella collegata, non raggiungibile da qui), quindi ho installato `pydantic`/`pyyaml`/`pytest` in un ambiente Python separato e rilanciato `tests/test_domain_contracts.py`: **8/8 passati**, stesso risultato riportato da Claude Code ma ottenuto con un interprete e un ambiente diversi — buon segno, i contratti non dipendono da qualcosa di specifico a quel venv.

**Verifica incrociata dei numeri.** Il conteggio "25 voci catalogo" (non 24, come scritto per errore mio nel prompt) è stato ricontrollato leggendo `regole/schema.yaml` direttamente: 25 è corretto (A: 4, B: 4, C: 4, D: 3, E: 5, F: 3, G: 2). Claude Code ha fatto bene a fidarsi della fonte primaria invece che del numero nel prompt.

## Verdetto sui contratti (letto `backend/domain/models.py` per intero)

Buon lavoro, approvato. I quattro modelli sono espressivi, ogni campo ha una docstring che spiega il perché (non solo il cosa) e collega, dove pertinente, il numero della verifica SA 250B — esattamente quello che serviva perché Codex (che non avrà letto questa conversazione) possa orientarsi solo leggendo il codice.

Sulle cinque scelte di design segnalate, il mio parere:

1. **`Evidence.found: bool` per modellare l'assenza** — d'accordo, tenerlo così. È coerente con `TEMPLATE_RULES.md` §4 ("documento assente = wip, mai vuoto") e con le verifiche 5/7/8 del principio, che richiedono di poter dimostrare di aver guardato.
2. **`method`/`kind` come stringhe libere, non `Literal`** — d'accordo per questa fase, per il motivo che dà (non congelare un vocabolario prima che il motore di verifica esista). Prima che Fase 1 parta davvero in parallelo su due agenti, però, vale la pena aggiungere un piccolo registro di riferimento (anche solo un commento con l'elenco dei valori già in uso, tipo quello che già esiste per `ProvenanceRow.method`) per ridurre il rischio di varianti tipo `"pdf-text"` vs `"pdf_text"` scritte da agenti diversi. Non blocca la Fase 0.
3. **`VerificationResult` immutabile, serie temporale** — d'accordo, è la scelta corretta per le verifiche 11/12 (serve lo storico, non un record aggiornato sul posto).
4. **`Finding` a catena (`previous_finding_id`) invece di record mutabile** — d'accordo, ed è coerente con lo stile già usato in `ProvenanceRog` (append-only, mai sovrascritto).
5. **`Status` riusato con `""` ammesso anche se `VerificationResult` non lo userà mai** — la scelta di riusare il `Literal` come richiesto è corretta. Suggerisco un piccolo miglioramento a costo quasi zero per la Fase 1: un validator Pydantic su `VerificationResult` che rifiuta `status=""` a runtime, senza toccare il tipo condiviso — chiude la falla senza biforcare il vocabolario. Non necessario subito.

## Sui compromessi forzati dal caso Ferrero

Tutti e cinque corretti nell'istinto: dove la fonte (`TEMPLATE_RULES.md`/`schema.yaml`) segnala qualcosa come aperto o sospetto (Collegio sindacale mancante, numero conto MPS, mapping fondi previdenziali, soglie di materialità), Claude Code ha riportato il dato reale o il placeholder onesto invece di inventare una risposta plausibile. È esattamente il comportamento richiesto nel prompt ("non inventare"), e conferma che i modelli sono abbastanza espressivi da rappresentare anche i casi irrisolti senza forzature.

## Unico item di pulizia da chiudere prima della Fase 1

`pytest` non è dichiarato in `requirements.txt` (Claude Code lo segnala da sé). È un problema reale di riproducibilità: se Codex o una sessione futura clona il repo e segue solo `requirements.txt`, i test di questa fase non girano. Va aggiunto (eventualmente in un `requirements-dev.txt` separato, per non mescolare dipendenze di runtime e di test) prima o durante l'inizio della Fase 1.

## Esito

Fase 0 approvata. Si può procedere alla Fase 1 (evidence store + motore di verifica), con il piccolo item di pulizia sopra da includere nel prossimo prompt.
