import pytest
from fastapi.testclient import TestClient

from backend.jet.pratica import PraticaJet
from backend.jet.store import JetStore
from backend.main import app
from tests.test_jet_api import FIXTURE, MAPPING, params


@pytest.fixture
def client_and_storage(tmp_path, monkeypatch):
    storage = tmp_path / "storage"
    monkeypatch.setenv("QUADRA_STORAGE", str(storage))
    return TestClient(app), storage


def _create(client):
    response = client.post(
        "/api/jet/pratiche", json={"client": "Multi", "period": "2026"}
    )
    return response.json()["id"]


def test_due_file_staging_tracciabilita_e_deduplicazione_configurabile(
    client_and_storage,
):
    client, _ = client_and_storage
    pratica_id = _create(client)
    content = FIXTURE.read_bytes()
    uploaded = client.post(
        f"/api/jet/pratiche/{pratica_id}/files",
        files=[
            (
                "files",
                (
                    "gennaio.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            ),
            (
                "files",
                (
                    "febbraio.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            ),
        ],
    )

    assert uploaded.status_code == 200
    fonti = client.get(f"/api/jet/pratiche/{pratica_id}/fonti").json()
    assert len(fonti) == 2
    assert fonti[0]["percorso_relativo"] != fonti[1]["percorso_relativo"]
    assert fonti[0]["sha256"] == fonti[1]["sha256"]

    for fonte in fonti:
        configured = client.put(
            f"/api/jet/pratiche/{pratica_id}/fonti/{fonte['id']}/mappatura",
            json={"mappatura": MAPPING},
        )
        assert configured.status_code == 200
        assert configured.json()["numero_righe"] == 8

    assert len(client.get(f"/api/jet/pratiche/{pratica_id}/importazioni").json()) == 2
    client.put(f"/api/jet/pratiche/{pratica_id}/parametri", json=params())
    analyzed = client.post(f"/api/jet/pratiche/{pratica_id}/analizza")
    assert analyzed.json()["numero_registrazioni"] == 16
    results = client.get(
        f"/api/jet/pratiche/{pratica_id}/risultati", params={"page_size": 200}
    ).json()
    assert results["total"] == 16
    assert {item["fonte_id"] for item in results["items"]} == {
        fonte["id"] for fonte in fonti
    }
    assert all(item["numero_riga_fonte"] is not None for item in results["items"])

    strategy = client.put(
        f"/api/jet/pratiche/{pratica_id}/duplicati",
        json={"strategia": "scarta_identiche"},
    )
    assert strategy.status_code == 200
    analyzed = client.post(f"/api/jet/pratiche/{pratica_id}/analizza")
    assert analyzed.json()["numero_registrazioni"] == 8


def test_esclusione_e_cancellazione_fonte(client_and_storage):
    client, storage = client_and_storage
    pratica_id = _create(client)
    content = FIXTURE.read_bytes()
    uploaded = client.post(
        f"/api/jet/pratiche/{pratica_id}/files",
        files=[
            ("files", ("uno.xlsx", content, "application/octet-stream")),
            ("files", ("due.xlsx", content, "application/octet-stream")),
        ],
    ).json()
    first, second = [item["fonte"] for item in uploaded["files"]]

    excluded = client.patch(
        f"/api/jet/pratiche/{pratica_id}/fonti/{second['id']}",
        json={"attiva": False},
    )
    assert excluded.json()["stato"] == "esclusa"

    stored = storage / "pratiche" / pratica_id / "inbox" / first["percorso_relativo"]
    assert stored.exists()
    deleted = client.delete(f"/api/jet/pratiche/{pratica_id}/fonti/{first['id']}")
    assert deleted.status_code == 204
    assert not stored.exists()
    pratica = client.get(f"/api/jet/pratiche/{pratica_id}").json()
    assert pratica["numero_fonti"] == 1


def test_sostituzione_mantiene_identita_e_azzera_configurazione(client_and_storage):
    client, storage = client_and_storage
    pratica_id = _create(client)
    uploaded = client.post(
        f"/api/jet/pratiche/{pratica_id}/file",
        files={
            "file": ("prima.xlsx", FIXTURE.read_bytes(), "application/octet-stream")
        },
    ).json()
    fonte = uploaded["fonte"]
    client.put(
        f"/api/jet/pratiche/{pratica_id}/fonti/{fonte['id']}/mappatura",
        json={"mappatura": MAPPING},
    )

    replaced = client.put(
        f"/api/jet/pratiche/{pratica_id}/fonti/{fonte['id']}/file",
        files={
            "file": ("seconda.xlsx", FIXTURE.read_bytes(), "application/octet-stream")
        },
    )

    assert replaced.status_code == 200
    nuova = replaced.json()["fonte"]
    assert nuova["id"] == fonte["id"]
    assert nuova["nome_originale"] == "seconda.xlsx"
    assert nuova["stato"] == "da_configurare"
    assert nuova["mappatura"] is None
    assert nuova["numero_righe"] == 0
    inbox = storage / "pratiche" / pratica_id / "inbox"
    assert not (inbox / fonte["percorso_relativo"]).exists()
    assert (inbox / nuova["percorso_relativo"]).exists()


def test_migrazione_file_singolo_legacy_crea_una_fonte(tmp_path):
    database = tmp_path / "jet.sqlite3"
    store = JetStore(database)
    pratica = PraticaJet(
        id="legacy",
        client="Legacy",
        period="2025",
        file_originale_nome="giornale.xlsx",
        mappatura=MAPPING,
    )
    store.save_pratica(pratica)
    inbox = tmp_path / "pratiche" / pratica.id / "inbox"
    inbox.mkdir(parents=True)
    (inbox / "giornale.xlsx").write_bytes(FIXTURE.read_bytes())

    migrated = JetStore(database).list_fonti(pratica.id)

    assert len(migrated) == 1
    assert migrated[0].nome_originale == "giornale.xlsx"
    assert migrated[0].mappatura == MAPPING
    assert migrated[0].stato == "pronta"
    assert JetStore(database).get_pratica(pratica.id).numero_fonti == 1
