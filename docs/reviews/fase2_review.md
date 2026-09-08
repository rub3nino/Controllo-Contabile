# Revisione Fase 2 — ingestion sensibile al cliente

Branch: `redesign/fase2-ingestion-client-config` (sopra `redesign/fase1-motore-verifica`), commit `547a85e`. Revisione indipendente sul branch, non sugli screenshot.

## Cosa è stato verificato

`git diff redesign/fase1-motore-verifica..redesign/fase2-ingestion-client-config --stat`: 8 file, tutti dentro `backend/domain/` o `tests/`. Confermato con diff ristretto "tutto tranne quei percorsi": zero risultati. `verification_engine.py` e `continuity.py` (Fase 1) non compaiono nel diff — rispettato il vincolo di non toccarli.

Letto per intero `client_classify.py`, e il diff su `ingest_adapter.py`/`models.py`: coerenti con il riepilogo. Il fix su `documents_to_evidence` (le voci `extra_items` ora contano come applicabili, non solo `applicable_items`) è minimo e mirato, esattamente il bug che avevo descritto nel prompt.

Rieseguiti tutti i test in modo indipendente: **52 passati, 2 falliti** — gli stessi due fallimenti preesistenti e non collegati già visti nella revisione di Fase 1 (ambiente di verifica, non codice). Nessuna regressione.

## Il punto più interessante di questa fase

Codex ha scoperto, scrivendo i test e non a parole, un problema reale: quando ha provato a popolare `ferrero.yaml` con il Collegio sindacale come `extra_item` usando parole chiave plausibili ("collegio sindacale", "verbale collegio"), si è accorto che quelle stesse parole sono già usate da `classify.py` per la voce standard `C.3` ("Verbali Collegio sindacale") — e siccome `scan_folder_for_client` guarda solo i file che il primo passaggio lascia senza `item_id`, `C.3` vince sempre, `CS.1` non si attiva mai su un file del genere. Invece di aggirarlo silenziosamente (es. cambiando l'ordine di precedenza, o scegliendo hint diverse ad hoc per far "funzionare" il test), ha scritto un test che lo dimostra e si rompe se qualcosa cambia (`test_ferrero_collegio_sindacale_hints_are_shadowed_by_standard_catalog_c3`), e ha usato un secondo esempio sintetico che non collide (certificazione ISO 9001) per dimostrare che il meccanismo di per sé funziona. È esattamente il comportamento che voglio da questa fase del lavoro: un fatto scomodo documentato con un test, non nascosto per far quadrare i numeri.

Una cosa che aggiungo io, guardando di nuovo `TEMPLATE_RULES.md` §7.6: il vero punto aperto lì non è "manca un modo di classificare i documenti del Collegio sindacale" (quello già esiste, è `C.3`) — è se il **foglio F** (la carta di lavoro che traccia pagina/data dell'ultimo verbale per ciascun libro sociale) debba avere una **riga in più** per il libro del Collegio sindacale, distinta dai libri già presenti (soci, assemblee, CdA). Sono due cose diverse: una è "che documento classifico", l'altra è "che riga tengo in una tabella di stato". L'esempio che Codex ha scritto in `ferrero.yaml` è dichiaratamente solo dimostrativo (lo dice il commento nel file), quindi non è un problema per questa fase — ma vale la pena tenerlo a mente per quando quella decisione verrà davvero presa: probabilmente non sarà un `ClientCatalogItem` nuovo, sarà qualcos'altro (una riga di stato per sezione F, ancora da modellare in una fase successiva).

## Verdetto

Fase 2 approvata.

## Gap segnalati da Codex, mio commento su ciascuno

1. **Collisione hint C.3/CS.1** — non un bug da correggere ora, commentato sopra. Nessuna azione richiesta.
2. **Anagrafica banche non integrata** — corretto rimandarlo, come da prompt. Nessuna azione richiesta ora.
3. **`extra_items` invisibili al motore di verifica** — confermo che è un gap reale e collegato a quello che avevo già segnalato dopo la Fase 1 (il concetto di "controllo saltato per scelta umana", `HumanOverride`). Entrambi toccano `verification_engine.py`. Ha senso risolverli insieme, in un solo prompt per Claude Code, invece di far intervenire due volte sullo stesso file in fasi separate.
4. **Campi meccanici / `extract.py` non integrato** — riportato di nuovo da Fase 1, resta un gap noto, non urgente.

## Prossimo passo che propongo

Prima di iniziare la dashboard (Fase 3), chiuderei i due gap del motore di verifica insieme in un solo prompt per Claude Code: il concetto di `HumanOverride` (per ottenere finalmente `✗`) e il fatto che `evaluate_section` deve includere anche `client_config.extra_items` nel calcolo di sezione, non solo `SECTION_ITEMS`. Ha senso costruire la dashboard sopra un motore che già calcola correttamente, piuttosto che sopra uno che poi va rifatto sotto una UI già scritta.
