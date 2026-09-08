"""Fase 1 — end-to-end su fixtures/docs (cartella demo sintetica, senza dati cliente).

Pipeline completa senza passare da nessun Excel:
    classify.scan_folder -> ingest_adapter.documents_to_evidence -> verification_engine.evaluate_pratica

Verità di terra (verificata leggendo fixtures/docs/output/mancanti.md e
provenienza.jsonl, e rieseguendo scan_folder a mano prima di scrivere questo
test): 7 file, 6 voci di catalogo trovate — B.1 (Bilancino), C.2 (Verbale
CDA), D.3 (Registro IVA acquisti), E.1 (F24 aprile), E.3 (LIPE),
F.1 (Estratto Intesa + Estratto Unicredit, 2 file sulla stessa voce) — le
altre 19 delle 25 voci standard restano assenti. Con questa combinazione
NESSUNA sezione risulta piena (ogni sezione ha almeno una voce collegata
mancante, o è di solo giudizio umano): tutte le 9 sezioni sono wip. Non è
un caso costruito apposta per far vedere un ✓ — è la cartella demo reale
del progetto, ed è normale che una pratica appena scansionata sia quasi
tutta wip.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.catalog import checklist_items
from backend.classify import scan_folder
from backend.domain import ClientConfig, documents_to_evidence, evaluate_pratica

FIXTURES_DOCS = ROOT / "fixtures" / "docs"

ALL_STANDARD_ITEMS = [it["id"] for it in checklist_items()]

FOUND_ITEMS = {"B.1", "C.2", "D.3", "E.1", "E.3", "F.1"}


def build_client_config() -> ClientConfig:
    return ClientConfig(client_id="cliente-demo", display_name="Cliente Demo", applicable_items=ALL_STANDARD_ITEMS)


def test_fixtures_docs_has_the_expected_seven_files():
    docs = scan_folder(str(FIXTURES_DOCS), "e2e-test")
    assert len(docs) == 7
    assert {d.item_id for d in docs} == FOUND_ITEMS


def test_end_to_end_produces_wip_everywhere_with_correct_missing_items():
    docs = scan_folder(str(FIXTURES_DOCS), "e2e-test")
    cfg = build_client_config()
    evidences = documents_to_evidence("e2e-test", docs, cfg)

    # 25 voci applicabili: 6 trovate (>=1 Evidence found=True ciascuna,
    # F.1 ne ha due) + 19 assenti = 6 + 19 = 25 record di assenza+presenza,
    # più la seconda Evidence su F.1.
    assert len({e.item_id for e in evidences if e.found}) == 6
    assert sum(1 for e in evidences if not e.found) == 19

    results = evaluate_pratica(
        pratica_id="e2e-test", client="Cliente Demo", period="Aprile - Giugno 2026",
        evidences=evidences, client_config=cfg,
    )

    assert set(results) == {"A", "B", "C", "D", "E", "F", "G", "H", "I"}
    assert all(r.status == "wip" for r in results.values()), {
        s: r.status for s, r in results.items()
    }

    assert results["A"].missing_items == ["A.1", "A.2", "A.3"]
    assert results["B"].missing_items == ["B.4", "D.1", "D.2"]
    assert results["C"].missing_items == ["E.2", "E.4", "E.5", "G.1", "G.2"]
    assert results["D"].missing_items == ["B.4"]
    assert results["E"].missing_items == ["F.2", "F.3", "A.4"]
    assert results["F"].missing_items == ["C.1", "C.3", "C.4"]
    assert results["G"].missing_items == ["B.2", "B.3"]
    assert results["H"].missing_items == []  # nessuna voce collegata (checklist vuota)
    assert results["I"].missing_items == ["A.2", "A.4"]


def test_end_to_end_evidence_for_found_sections_carries_real_source_files():
    docs = scan_folder(str(FIXTURES_DOCS), "e2e-test")
    cfg = build_client_config()
    evidences = documents_to_evidence("e2e-test", docs, cfg)
    results = evaluate_pratica(
        pratica_id="e2e-test", client="Cliente Demo", period="Aprile - Giugno 2026",
        evidences=evidences, client_config=cfg,
    )

    section_e = results["E"]
    f1_evidences = [e for e in section_e.evidence if e.item_id == "F.1"]
    assert len(f1_evidences) == 2
    assert {e.source_name for e in f1_evidences} == {
        "Estratto_Intesa_30.06.2026.txt",
        "Estratto_Unicredit_30.06.2026.txt",
    }
    assert all(e.found for e in f1_evidences)
