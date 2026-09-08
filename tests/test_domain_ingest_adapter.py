"""Fase 1 — ingest_adapter (DocumentOut -> Evidence)."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.domain import ClientConfig, documents_to_evidence
from backend.models import DocumentOut


def doc(item_id: str | None, name: str = "f.pdf", skip: bool = False, method: str = "filename") -> DocumentOut:
    return DocumentOut(id=f"id-{name}", name=name, path=f"/x/{name}", ext=".pdf", size=1, item_id=item_id, skip=skip, method=method)


def test_found_document_becomes_found_evidence():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["E.1"])
    evidences = documents_to_evidence("p1", [doc("E.1", name="F24.pdf")], cfg)
    assert len(evidences) == 1
    assert evidences[0].found is True
    assert evidences[0].item_id == "E.1"
    assert evidences[0].source_name == "F24.pdf"


def test_applicable_item_with_no_document_becomes_absent_evidence():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["E.1", "F.1"])
    evidences = documents_to_evidence("p1", [doc("E.1")], cfg)
    by_item = {e.item_id: e for e in evidences}
    assert by_item["E.1"].found is True
    assert by_item["F.1"].found is False
    assert by_item["F.1"].source_path is None


def test_non_applicable_item_is_ignored_not_missing():
    # E.5 (Intrastat) non è nella lista applicabile: un documento classificato
    # lì va ignorato, e non deve nemmeno comparire come "assente".
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["E.1"])
    evidences = documents_to_evidence("p1", [doc("E.1"), doc("E.5", name="intrastat.pdf")], cfg)
    item_ids = {e.item_id for e in evidences}
    assert item_ids == {"E.1"}


def test_skipped_document_does_not_count_as_found():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["E.1"])
    evidences = documents_to_evidence("p1", [doc("E.1", skip=True)], cfg)
    assert len(evidences) == 1
    assert evidences[0].found is False


def test_two_documents_same_item_id_both_kept():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["F.1"])
    evidences = documents_to_evidence(
        "p1", [doc("F.1", name="Intesa.pdf"), doc("F.1", name="Unicredit.pdf")], cfg
    )
    assert len(evidences) == 2
    assert all(e.found for e in evidences)
