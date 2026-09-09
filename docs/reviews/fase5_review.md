# Revisione Fase 5 — estrazione campo-per-campo nel motore di dominio

Branch: `redesign/fase5-estrazione-campi-dominio` (sopra `redesign/fase4-renderer-excel-dominio`), commit `25ed7f7`. Revisione indipendente sul branch.

## Cosa è stato verificato

`git diff redesign/fase4-renderer-excel-dominio..redesign/fase5-estrazione-campi-dominio --stat`: 2 file, esattamente quelli dichiarati (`backend/domain/ingest_adapter.py`, `tests/test_domain_ingest_adapter.py`). Nessun altro file toccato — `extract.py`, `fill.py`, `excel_renderer.py`, `verification_engine.py` intatti, come richiesto.

`ingest_adapter.py` letto per intero: `_extracted_fields(doc)` gestisce esattamente i 4 item richiesti (E.1, F.1, B.4, D.1), sceglie `parse_giornale_last` vs `extract_file`+`parse_mastrini_last` in base a `doc.ext.lower() == ".xlsx"` (confermato che `ext` è popolato con il punto incluso da `classify.py:173`, quindi il confronto è corretto), usa sempre `pages="key"` (mai `"all"`, verificato a colpo d'occhio), e l'intera funzione è avvolta in un unico `try/except Exception: return []` — degrado silenzioso come richiesto, nessuna eccezione può risalire a `documents_to_evidence`. F.2, bilancino e date verbali correttamente non toccati.

Rieseguiti tutti i test in un ambiente pulito (stesso approccio delle fasi precedenti): **69 passati, 0 falliti** — coincide esattamente. Isolati gli 11 test di `test_domain_ingest_adapter.py` (8 esistenti + 3 nuovi), tutti passati per nome, incluso `test_missing_extractable_document_degrades_to_empty_fields`.

Ho anche verificato **a mano**, chiamando `_extracted_fields` direttamente sulle fixture reali (non fidandomi solo del nome dei test), che i valori dichiarati sono esatti: F24 → `importo=35616.68 EUR`, `data_versamento=16/04/2026`, `protocollo=26041514340545867`; estratto conto Unicredit → `saldo_ec=3037.12 EUR` (e, in più, non citato nel riepilogo ma verificato: l'estratto Intesa → `saldo_ec=12500.4 EUR`, coerente).

## Verdetto

Fase 5 approvata. Implementazione precisa, aderente al prompt in ogni vincolo (nessun `pages="all"`, degrado silenzioso, scope limitato ai 4 item concordati), valori estratti verificati esatti su dati reali, nessuna regressione.

## Sulla nota di performance

0,5 ms su fixture leggere e 1,9 s sull'xlsx reale più grande sono trascurabili per uno scan occasionale. Il rischio vero resta l'OCR su PDF scansionati, correttamente segnalato come non ancora misurato in questa fase (nessuna fixture con PDF scansionato disponibile per testarlo) — da tenere d'occhio quando si userà su documenti reali del cliente, non un blocco per procedere ora.

## Stato del sistema a questo punto

Con Fase 0→5: motore di verifica completo, API di dominio, dashboard React, renderer Excel derivato, e ora dati granulari reali (importi, saldi, date) disponibili in `Evidence.fields` per i 4 item più diretti — pronti per essere mostrati in dashboard/Excel quando si deciderà come (non richiesto in questa fase, resta un piccolo lavoro di presentazione, non di dominio).

## Verso la prossima fase

A questo punto il motore ha già digerito un caso reale (Ferrero) attraverso 5 fasi di rifinitura. Il passo che il piano originale indica come prova vera dell'architettura è **onboardare un secondo cliente usando solo un nuovo `ClientConfig`, senza toccare una riga di codice** — se serve modificare motore o renderer per farlo funzionare, vuol dire che la separazione tra livelli non è ancora pulita (§6 del piano).

Quel passo però si porta dietro alcune decisioni che sono tue, non tecniche: soglie di materialità per lo scostamento bancario e per le variazioni "significative" in G, mapping dei fondi previdenziali, e come modellare la continuità del Collegio sindacale in F per un cliente diverso da Ferrero. Non sono cose che posso decidere né delegare a Codex/Claude Code — servono a te prima di scrivere quel prompt. Fammi sapere quando vuoi affrontarle (anche solo con un cliente fittizio/di prova, se non hai ancora un secondo cliente reale pronto) e prepariamo insieme quella fase.
