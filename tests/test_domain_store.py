"""Fase 1 — EvidenceStore (backend/domain/store.py): CRUD di base su SQLite."""

from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.domain import Evidence, EvidenceStore, Finding, FindingRef, HumanOverride, VerificationResult


def make_store(tmp_path: Path) -> EvidenceStore:
    return EvidenceStore(tmp_path / "domain.sqlite3")


def test_evidence_roundtrip(tmp_path: Path):
    store = make_store(tmp_path)
    ev = Evidence(pratica_id="p1", item_id="E.1", found=True, method="pdf-text", source_name="F24.pdf")
    store.save_evidence(ev)

    loaded = store.evidence_for_pratica("p1")
    assert len(loaded) == 1
    assert loaded[0].id == ev.id
    assert loaded[0].item_id == "E.1"
    assert loaded[0].found is True


def test_evidence_for_pratica_is_scoped(tmp_path: Path):
    store = make_store(tmp_path)
    store.save_evidences(
        [
            Evidence(pratica_id="p1", item_id="E.1", found=True, method="filename"),
            Evidence(pratica_id="p2", item_id="E.1", found=True, method="filename"),
        ]
    )
    assert len(store.evidence_for_pratica("p1")) == 1
    assert len(store.evidence_for_pratica("p2")) == 1
    assert store.evidence_for_pratica("p3") == []


def test_human_override_roundtrip_is_scoped_by_pratica(tmp_path: Path):
    store = make_store(tmp_path)
    item_override = HumanOverride(
        pratica_id="p1", scope="item", target="E.5", decision="✗",
        note="Intrastat non richiesto questo trimestre", decided_by="RR",
    )
    section_override = HumanOverride(
        pratica_id="p2", scope="section", target="D", decision="N/A",
    )
    store.save_human_overrides([item_override, section_override])

    loaded = store.human_overrides_for_pratica("p1")
    assert loaded == [item_override]
    assert store.human_overrides_for_pratica("p2") == [section_override]
    assert store.human_overrides_for_pratica("missing") == []


def test_verification_result_is_append_only_and_latest_wins(tmp_path: Path):
    store = make_store(tmp_path)
    first = VerificationResult(
        pratica_id="p1", client="Cliente Demo", period="Q2 2026", section="E",
        status="wip", reasoning="manca l'estratto Intesa",
    )
    store.save_verification_result(first)

    second = VerificationResult(
        pratica_id="p1", client="Cliente Demo", period="Q2 2026", section="E",
        status="✓", reasoning="tutte le voci trovate",
    )
    store.save_verification_result(second)

    latest = store.latest_verification_result("p1", "E")
    assert latest is not None
    assert latest.id == second.id
    assert latest.status == "✓"


def test_verification_result_duplicate_id_raises(tmp_path: Path):
    import sqlite3

    store = make_store(tmp_path)
    vr = VerificationResult(
        pratica_id="p1", client="x", period="x", section="A", status="wip", reasoning="x",
    )
    store.save_verification_result(vr)
    with pytest.raises(sqlite3.IntegrityError):
        store.save_verification_result(vr)  # stesso id: VerificationResult è immutabile, mai un update


def test_latest_verification_results_covers_all_saved_sections(tmp_path: Path):
    store = make_store(tmp_path)
    for section in ["A", "B", "E"]:
        store.save_verification_result(
            VerificationResult(
                pratica_id="p1", client="x", period="x", section=section, status="wip", reasoning="x",
            )
        )
    latest = store.latest_verification_results("p1")
    assert set(latest.keys()) == {"A", "B", "E"}


def test_open_findings_for_client_excludes_sistemato(tmp_path: Path):
    store = make_store(tmp_path)
    ref = FindingRef(pratica_id="p1", client="Cliente Demo", period="Q1 2026")
    aperto = Finding(
        client="Cliente Demo", pratica_id="p1", period="Q1 2026", section="F",
        kind="carenza_procedurale", description="manca verbale collegio", status="aperto",
        first_raised=ref,
    )
    sistemato = Finding(
        client="Cliente Demo", pratica_id="p1", period="Q1 2026", section="B",
        kind="errore_contabile", description="registro IVA non aggiornato", status="sistemato",
        first_raised=ref, resolved_in=ref,
    )
    store.save_finding(aperto)
    store.save_finding(sistemato)

    open_findings = store.open_findings_for_client("Cliente Demo")
    assert [f.id for f in open_findings] == [aperto.id]
