"""Fase 1 — ingest_adapter (DocumentOut -> Evidence)."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.domain import ClientCatalogItem, ClientConfig, documents_to_evidence
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


# --- Fase 2: extra_items del cliente contano come applicabili ---

def collegio_extra_item() -> ClientCatalogItem:
    return ClientCatalogItem(
        id="CS.1", label="Libro verbali del Collegio sindacale", section="F",
        hints=["collegio sindacale", "verbale collegio"],
    )


def test_extra_item_document_becomes_found_evidence():
    cfg = ClientConfig(
        client_id="demo", display_name="Demo", applicable_items=[],
        extra_items=[collegio_extra_item()],
    )
    evidences = documents_to_evidence("p1", [doc("CS.1", name="Verbale_Collegio_2026.pdf")], cfg)
    assert len(evidences) == 1
    assert evidences[0].found is True
    assert evidences[0].item_id == "CS.1"


def test_extra_item_with_no_document_becomes_absent_evidence():
    # Prima del fix di Fase 2, un item_id non in applicable_items veniva
    # ignorato — quindi un extra_item senza documento non generava MAI
    # un'Evidence(found=False): il gap era invisibile. Questo test copre
    # esattamente quel caso.
    cfg = ClientConfig(
        client_id="demo", display_name="Demo", applicable_items=[],
        extra_items=[collegio_extra_item()],
    )
    evidences = documents_to_evidence("p1", [], cfg)
    assert len(evidences) == 1
    assert evidences[0].item_id == "CS.1"
    assert evidences[0].found is False


def test_extra_items_and_applicable_items_coexist():
    cfg = ClientConfig(
        client_id="demo", display_name="Demo", applicable_items=["E.1"],
        extra_items=[collegio_extra_item()],
    )
    evidences = documents_to_evidence("p1", [doc("E.1")], cfg)
    by_item = {e.item_id: e for e in evidences}
    assert by_item["E.1"].found is True
    assert by_item["CS.1"].found is False  # applicabile (extra), ma assente


# --- Fase 5: estrazione campo-per-campo su fixture reali ---

def real_doc(item_id: str, name: str) -> DocumentOut:
    path = ROOT / "fixtures" / "docs" / name
    return DocumentOut(
        id=f"real-{name}", name=name, path=str(path), ext=path.suffix,
        size=path.stat().st_size, item_id=item_id, method="filename",
    )


def test_real_f24_populates_extracted_fields():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["E.1"])
    evidence = documents_to_evidence(
        "p1", [real_doc("E.1", "F24_aprile_2026.txt")], cfg
    )[0]
    fields = {field.kind: field for field in evidence.fields}
    assert fields["importo"].value == "35616.68"
    assert fields["importo"].unit == "EUR"
    assert fields["data_versamento"].value == "16/04/2026"
    assert fields["protocollo"].value == "26041514340545867"


def test_real_bank_statement_populates_balance():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["F.1"])
    evidence = documents_to_evidence(
        "p1", [real_doc("F.1", "Estratto_Unicredit_30.06.2026.txt")], cfg
    )[0]
    assert len(evidence.fields) == 1
    assert evidence.fields[0].kind == "saldo_ec"
    assert evidence.fields[0].value == "3037.12"
    assert evidence.fields[0].unit == "EUR"


def test_missing_extractable_document_degrades_to_empty_fields():
    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=["E.1"])
    evidence = documents_to_evidence(
        "p1", [doc("E.1", name="inesistente.pdf")], cfg
    )[0]
    assert evidence.found is True
    assert evidence.fields == []
