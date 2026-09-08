"""Fase 0 — valida i contratti dati condivisi in backend/domain/models.py.

Non testa nessuna logica di business (il motore di verifica non esiste
ancora, Fase 1): verifica solo che i modelli si costruiscano, che il file
di esempio Ferrero si carichi senza errori, e che qualche vincolo di forma
(Status riusato, soglie opzionali, catena Finding) si comporti come da
docstring.
"""

from pathlib import Path
import sys

import pytest
import yaml
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.domain import (
    ClientConfig,
    Evidence,
    ExtractedField,
    Finding,
    FindingRef,
    VerificationResult,
)

FERRERO_YAML = ROOT / "backend" / "domain" / "examples" / "ferrero.yaml"


def load_ferrero_config() -> ClientConfig:
    with FERRERO_YAML.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return ClientConfig.model_validate(raw)


def test_ferrero_client_config_loads_without_errors():
    cfg = load_ferrero_config()
    assert cfg.client_id == "ferrero"
    assert cfg.display_name == "Gruppo Ferrero S.p.A."


def test_ferrero_has_25_catalog_items_and_17_banks():
    cfg = load_ferrero_config()
    assert len(cfg.applicable_items) == 25
    assert len(set(cfg.applicable_items)) == 25  # nessun duplicato
    assert len(cfg.banks) == 17
    assert cfg.extra_items == []  # Collegio sindacale: APERTO, non deciso


def test_ferrero_thresholds_are_unset_not_zero():
    cfg = load_ferrero_config()
    assert cfg.soglia_scostamento_bancario_eur is None
    assert cfg.soglia_variazione_significativa_g_pct is None


def test_ferrero_bank_row_with_open_account_number():
    cfg = load_ferrero_config()
    mps = next(b for b in cfg.banks if b.coge == "100915100110")
    assert mps.banca == "MONTE DEI PASCHI DI SIENA"
    assert mps.numero_conto == "APERTO"


def test_evidence_can_represent_absence():
    ev = Evidence(
        pratica_id="ferrero-2026-q2",
        item_id="F.1",
        found=False,
        method="content",
        notes="nessun estratto conto Intesa nel trimestre corrente",
    )
    assert ev.found is False
    assert ev.fields == []
    assert ev.source_path is None


def test_evidence_can_carry_multiple_fields_for_one_document():
    ev = Evidence(
        pratica_id="ferrero-2026-q2",
        item_id="E.1",
        source_path="/docs/F24 160426.pdf",
        source_name="F24 160426.pdf",
        method="pdf-text",
        confidence=0.9,
        fields=[
            ExtractedField(kind="data_versamento", value="2026-04-16"),
            ExtractedField(kind="protocollo", value="26041611010335539"),
            ExtractedField(kind="importo", value="35616.68", unit="EUR"),
        ],
    )
    kinds = {f.kind for f in ev.fields}
    assert kinds == {"data_versamento", "protocollo", "importo"}


def test_verification_result_reuses_status_literal_and_rejects_invalid():
    vr = VerificationResult(
        pratica_id="ferrero-2026-q2",
        client="Gruppo Ferrero S.p.A.",
        period="APRILE - GIUGNO 2026",
        section="E",
        status="wip",
        reasoning="manca l'estratto conto Intesa Sanpaolo del trimestre corrente",
        missing_items=["F.1"],
    )
    assert vr.status == "wip"

    with pytest.raises(ValidationError):
        VerificationResult(
            pratica_id="x",
            client="x",
            period="x",
            section="E",
            status="chiuso",  # non è uno dei valori di backend.models.Status
            reasoning="x",
        )


def test_finding_continuity_chain_across_quarters():
    q1 = Finding(
        client="Gruppo Ferrero S.p.A.",
        pratica_id="ferrero-2026-q1",
        period="GENNAIO - MARZO 2026",
        section="F",
        sa250b_check=11,
        kind="carenza_procedurale",
        description="Libro verbali del Collegio sindacale non aggiornato",
        status="aperto",
        first_raised=FindingRef(pratica_id="ferrero-2026-q1", client="Gruppo Ferrero S.p.A.", period="GENNAIO - MARZO 2026"),
    )

    q2 = Finding(
        client="Gruppo Ferrero S.p.A.",
        pratica_id="ferrero-2026-q2",
        period="APRILE - GIUGNO 2026",
        section="F",
        sa250b_check=11,
        kind="carenza_procedurale",
        description="Libro verbali del Collegio sindacale non aggiornato",
        status="sistemato",
        first_raised=q1.first_raised,
        previous_finding_id=q1.id,
        resolved_in=FindingRef(pratica_id="ferrero-2026-q2", client="Gruppo Ferrero S.p.A.", period="APRILE - GIUGNO 2026"),
    )

    assert q2.previous_finding_id == q1.id
    assert q2.first_raised == q1.first_raised
    assert q2.resolved_in is not None and q2.resolved_in.pratica_id == "ferrero-2026-q2"
