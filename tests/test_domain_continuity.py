"""Fase 1 — continuity: verifiche 11/12 SA 250B, catena Finding attraverso lo store.

Estende lo scenario di Fase 0 (test_finding_continuity_chain_across_quarters
in tests/test_domain_contracts.py, dove la catena era costruita a mano):
qui il finding del trimestre precedente vive nello store, e
carry_forward_open_findings lo legge da lì.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.domain import EvidenceStore, Finding, FindingRef, carry_forward_open_findings


def test_open_finding_is_carried_forward_with_previous_link(tmp_path: Path):
    store = EvidenceStore(tmp_path / "domain.sqlite3")
    ref_q1 = FindingRef(pratica_id="ferrero-q1", client="Gruppo Ferrero S.p.A.", period="GENNAIO - MARZO 2026")
    original = Finding(
        client="Gruppo Ferrero S.p.A.", pratica_id="ferrero-q1", period="GENNAIO - MARZO 2026",
        section="F", sa250b_check=11, kind="carenza_procedurale",
        description="Libro verbali del Collegio sindacale non aggiornato", status="aperto",
        first_raised=ref_q1,
    )
    store.save_finding(original)

    carried = carry_forward_open_findings(
        store, client="Gruppo Ferrero S.p.A.", new_pratica_id="ferrero-q2", new_period="APRILE - GIUGNO 2026",
    )

    assert len(carried) == 1
    nf = carried[0]
    assert nf.previous_finding_id == original.id
    assert nf.first_raised == ref_q1
    assert nf.status == "aperto"
    assert nf.pratica_id == "ferrero-q2"

    # persistito nello store, non solo ritornato in memoria
    reloaded = store.open_findings_for_client("Gruppo Ferrero S.p.A.")
    assert {f.id for f in reloaded} == {original.id, nf.id}


def test_sistemato_finding_is_not_carried_forward(tmp_path: Path):
    store = EvidenceStore(tmp_path / "domain.sqlite3")
    ref = FindingRef(pratica_id="p1", client="Demo", period="Q1")
    resolved = Finding(
        client="Demo", pratica_id="p1", period="Q1", section="B", kind="errore_contabile",
        description="registro IVA in ritardo", status="sistemato", first_raised=ref, resolved_in=ref,
    )
    store.save_finding(resolved)

    carried = carry_forward_open_findings(store, client="Demo", new_pratica_id="p2", new_period="Q2")
    assert carried == []


def test_in_corso_finding_is_carried_forward_but_reset_to_aperto(tmp_path: Path):
    # "in_corso" non è "sistemato": la carenza non è chiusa, ma il sistema
    # non eredita da solo un giudizio di avanzamento — ogni pratica nuova
    # riparte da "aperto" finché un umano non aggiorna lo stato.
    store = EvidenceStore(tmp_path / "domain.sqlite3")
    ref = FindingRef(pratica_id="p1", client="Demo", period="Q1")
    in_progress = Finding(
        client="Demo", pratica_id="p1", period="Q1", section="C", kind="carenza_procedurale",
        description="mapping fondo previdenziale ancora da chiarire", status="in_corso", first_raised=ref,
    )
    store.save_finding(in_progress)

    carried = carry_forward_open_findings(store, client="Demo", new_pratica_id="p2", new_period="Q2")
    assert len(carried) == 1
    assert carried[0].status == "aperto"
    assert carried[0].previous_finding_id == in_progress.id
