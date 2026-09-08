"""Fase 1 — verification_engine: la regola ✓/wip/✗ tradotta da TEMPLATE_RULES.md §4.1."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.domain import ClientCatalogItem, ClientConfig, Evidence, HumanOverride, evaluate_pratica, evaluate_section
from backend.domain.verification_engine import JUDGMENT_ONLY_SECTIONS


def cfg(applicable_items: list[str]) -> ClientConfig:
    return ClientConfig(client_id="demo", display_name="Demo", applicable_items=applicable_items)


def ev(item_id: str, found: bool) -> Evidence:
    return Evidence(pratica_id="p1", item_id=item_id, found=found, method="filename")


def override(scope: str, target: str, note: str = "") -> HumanOverride:
    return HumanOverride(pratica_id="p1", scope=scope, target=target, decision="✗", note=note)


def test_all_connected_items_found_gives_ok_for_non_judgment_section():
    # E: [F.1, F.2, F.3, A.4] (backend.catalog.SECTION_ITEMS)
    evidences = [ev("F.1", True), ev("F.2", True), ev("F.3", True), ev("A.4", True)]
    result = evaluate_section(
        section="E", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=evidences, client_config=cfg(["F.1", "F.2", "F.3", "A.4"]),
    )
    assert result.status == "✓"
    assert result.missing_items == []


def test_partial_evidence_gives_wip_with_missing_items_named():
    evidences = [ev("F.1", True), ev("F.2", False)]
    result = evaluate_section(
        section="E", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=evidences, client_config=cfg(["F.1", "F.2", "F.3", "A.4"]),
    )
    assert result.status == "wip"
    # F.2 ha una Evidence(found=False) esplicita, F.3/A.4 non hanno nessuna
    # Evidence: entrambi i casi contano come "non trovato" per item_found().
    assert set(result.missing_items) == {"F.2", "F.3", "A.4"}
    assert "F.2" in result.reasoning


def test_judgment_only_sections_never_auto_approve_even_when_fully_found():
    # D: [B.4] — trovata, ma D è una sezione di solo giudizio umano.
    evidences = [ev("B.4", True)]
    result = evaluate_section(
        section="D", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=evidences, client_config=cfg(["B.4"]),
    )
    assert result.status == "wip"
    assert result.missing_items == []


def test_judgment_only_sections_constant_matches_template_rules():
    assert JUDGMENT_ONLY_SECTIONS == frozenset({"A", "D", "H", "I"})


def test_section_with_no_connected_items_is_wip_not_vacuously_ok():
    # H non ha voci in checklist (backend.catalog.SECTION_ITEMS["H"] == []):
    # non deve MAI risultare ✓ da solo (TEMPLATE_RULES.md §4.1).
    result = evaluate_section(
        section="H", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[], client_config=cfg([]),
    )
    assert result.status == "wip"
    assert result.missing_items == []


def test_client_config_excluding_all_section_items_is_treated_as_na_not_ok():
    # Cliente per cui nessuna delle voci di G è applicabile: G non deve
    # risultare ✓ per un catalogo vuoto, resta wip (giudizio umano/N/A).
    result = evaluate_section(
        section="G", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[], client_config=cfg([]),  # B.1/B.2/B.3 esclusi
    )
    assert result.status == "wip"


def test_evaluate_pratica_covers_all_nine_sections():
    results = evaluate_pratica(
        pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[], client_config=cfg([]),
    )
    assert set(results.keys()) == {"A", "B", "C", "D", "E", "F", "G", "H", "I"}
    assert all(r.status == "wip" for r in results.values())


def test_anomalies_are_always_empty_in_fase1():
    result = evaluate_section(
        section="E", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[ev("F.1", True)], client_config=cfg(["F.1"]),
    )
    assert result.anomalies == []


def test_ferrero_section_d_override_wins_regardless_of_evidence():
    note = "Dai documenti ricevuti non sono risultate criticità quindi si è deciso di non effettuare questa analisi per questo trimestre"
    result = evaluate_section(
        section="D", pratica_id="p1", client="Ferrero", period="Q2 2026",
        evidences=[ev("B.4", False)], client_config=cfg(["B.4"]),
        overrides=[override("section", "D", note)],
    )
    assert result.status == "✗"
    assert result.reasoning == note
    assert result.missing_items == []


def test_item_override_counts_as_satisfied_when_other_items_are_found():
    result = evaluate_section(
        section="E", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[ev("F.1", True), ev("F.2", True)],
        client_config=cfg(["F.1", "F.2", "F.3"]),
        overrides=[override("item", "F.3", "Riconciliazione non richiesta nel trimestre")],
    )
    assert result.status == "✓"
    assert result.missing_items == []


def test_judgment_section_override_is_not_blocked_by_no_auto_approval_rule():
    result = evaluate_section(
        section="D", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[ev("B.4", True)], client_config=cfg(["B.4"]),
        overrides=[override("section", "D", "Test campionario saltato dall'operatore")],
    )
    assert result.status == "✗"


def test_missing_extra_item_participates_in_section_result():
    config = cfg(["F.1"])
    config.extra_items = [ClientCatalogItem(id="BANK.EXTRA", label="Estratto conto aggiuntivo", section="E")]
    result = evaluate_section(
        section="E", pratica_id="p1", client="Demo", period="Q2 2026",
        evidences=[ev("F.1", True)], client_config=config,
    )
    assert result.status == "wip"
    assert result.missing_items == ["BANK.EXTRA"]
