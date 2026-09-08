"""Fase 3a — il motore di dominio esposto dall'app FastAPI reale."""

from pathlib import Path

from fastapi.testclient import TestClient

from backend.domain import EvidenceStore, Finding, FindingRef
from backend.main import app

ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DOCS = ROOT / "fixtures" / "docs"


def api_client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("QUADRA_STORAGE", str(tmp_path / "storage"))
    return TestClient(app)


def scan(client: TestClient, pratica_id: str = "api-e2e"):
    return client.post(
        "/api/domain/scan",
        json={
            "client_id": "demo",
            "period": "Aprile - Giugno 2026",
            "documents_dir": str(FIXTURES_DOCS),
            "pratica_id": pratica_id,
        },
    )


def test_scan_verify_and_section_override_end_to_end(tmp_path: Path, monkeypatch):
    client = api_client(tmp_path, monkeypatch)
    scanned = scan(client)
    assert scanned.status_code == 200
    assert scanned.json()["documents_count"] == 7
    assert scanned.json()["evidence_count"] == 26

    verified = client.get("/api/domain/pratiche/api-e2e/verifiche")
    assert verified.status_code == 200
    assert set(verified.json()["verifiche"]) == set("ABCDEFGHI")
    assert all(v["status"] == "wip" for v in verified.json()["verifiche"].values())

    created = client.post(
        "/api/domain/pratiche/api-e2e/overrides",
        json={
            "scope": "section",
            "target": "D",
            "decision": "✗",
            "note": "Test campionario saltato dall'operatore",
            "decided_by": "RR",
        },
    )
    assert created.status_code == 201
    assert created.json()["override"]["pratica_id"] == "api-e2e"

    recalculated = client.get("/api/domain/pratiche/api-e2e/verifiche")
    assert recalculated.json()["verifiche"]["D"]["status"] == "✗"
    assert recalculated.json()["verifiche"]["D"]["reasoning"] == "Test campionario saltato dall'operatore"


def test_rescan_replaces_evidence_and_does_not_duplicate_findings(tmp_path: Path, monkeypatch):
    client = api_client(tmp_path, monkeypatch)
    store = EvidenceStore(tmp_path / "storage" / "domain.sqlite3")
    previous = Finding(
        client="Cliente Demo",
        pratica_id="previous",
        period="Gennaio - Marzo 2026",
        section="F",
        kind="carenza_procedurale",
        description="Libro non aggiornato",
        status="aperto",
        first_raised=FindingRef(
            pratica_id="previous", client="Cliente Demo", period="Gennaio - Marzo 2026"
        ),
    )
    store.save_finding(previous)

    first = scan(client, "rescan-test")
    assert first.status_code == 200
    assert len(first.json()["carried_findings"]) == 1
    first_count = len(store.evidence_for_pratica("rescan-test"))

    second = scan(client, "rescan-test")
    assert second.status_code == 200
    assert second.json()["rescan"] is True
    assert second.json()["carried_findings"] == []
    assert len(store.evidence_for_pratica("rescan-test")) == first_count
    assert len(store.findings_for_pratica("rescan-test")) == 1


def test_clients_and_legacy_endpoints_still_work(tmp_path: Path, monkeypatch):
    client = api_client(tmp_path, monkeypatch)
    assert client.get("/api/health").json() == {"ok": True}
    clients = client.get("/api/domain/clients")
    assert clients.status_code == 200
    assert {c["id"] for c in clients.json()["clients"]} >= {"demo", "ferrero"}

    legacy = client.post(
        "/api/pratica",
        json={"client": "Legacy Demo", "period": "Q2", "documents_dir": str(FIXTURES_DOCS)},
    )
    assert legacy.status_code == 200
    assert client.get("/api/state").json()["pratica"]["client"] == "Legacy Demo"
    assert client.get("/api/health").json() == {"ok": True}
