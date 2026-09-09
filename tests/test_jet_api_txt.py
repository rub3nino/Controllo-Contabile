from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from tests.test_jet_api import params

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "jet" / "giornale_colonne_fisse.txt"
POSIZIONI = {
    "identificativo_registrazione": [0, 8],
    "data_effettiva": [8, 18],
    "conto_contabile": [18, 28],
    "importo_netto": [28, 42],
    "descrizione": [42, 62],
    "utente": [62, 72],
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("QUADRA_STORAGE", str(tmp_path / "storage"))
    return TestClient(app)


def _crea_pratica(client, client_name="Acme"):
    return client.post(
        "/api/jet/pratiche", json={"client": client_name, "period": "2026"}
    ).json()["id"]


def _upload(client, pratica_id, path=FIXTURE):
    with path.open("rb") as fh:
        return client.post(
            f"/api/jet/pratiche/{pratica_id}/file",
            files={"file": (path.name, fh, "text/plain")},
        )


def test_txt_sconosciuto_creazione_e_riuso_automatico_profilo(client):
    primo_id = _crea_pratica(client)
    primo_upload = _upload(client, primo_id)

    assert primo_upload.status_code == 200
    anteprima = primo_upload.json()
    assert anteprima["profilo"] is None
    assert anteprima["intestazione"].strip().startswith("ID")
    assert len(anteprima["righe_esempio"]) == 5

    creato = client.post(
        f"/api/jet/pratiche/{primo_id}/profilo",
        json={"nome": "Gestionale Acme", "posizioni": POSIZIONI},
    )
    assert creato.status_code == 201
    profilo_id = creato.json()["profilo_estrazione_id"]
    assert client.get("/api/jet/profili").json()[0]["id"] == profilo_id
    assert client.get(f"/api/jet/profili/{profilo_id}").status_code == 200
    client.put(f"/api/jet/pratiche/{primo_id}/parametri", json=params())
    analizzato = client.post(f"/api/jet/pratiche/{primo_id}/analizza")
    assert analizzato.status_code == 200
    assert analizzato.json()["numero_registrazioni"] == 10

    secondo_id = _crea_pratica(client, "Beta")
    secondo_upload = _upload(client, secondo_id)
    assert secondo_upload.json()["profilo"]["id"] == profilo_id
    applicato = client.put(
        f"/api/jet/pratiche/{secondo_id}/profilo/{profilo_id}"
    )
    assert applicato.status_code == 200
    assert applicato.json()["profilo_estrazione_id"] == profilo_id


def test_txt_richiede_profilo_e_riga_corta_restituisce_errore_leggibile(
    client, tmp_path
):
    profilo_pratica_id = _crea_pratica(client)
    _upload(client, profilo_pratica_id)
    profilo = client.post(
        f"/api/jet/pratiche/{profilo_pratica_id}/profilo",
        json={"nome": "Gestionale", "posizioni": POSIZIONI},
    ).json()
    profilo_id = profilo["profilo_estrazione_id"]

    senza_profilo_id = _crea_pratica(client, "Senza profilo")
    _upload(client, senza_profilo_id)
    client.put(f"/api/jet/pratiche/{senza_profilo_id}/parametri", json=params())
    missing = client.post(f"/api/jet/pratiche/{senza_profilo_id}/analizza")
    assert missing.status_code == 409
    assert "profilo di estrazione TXT" in missing.json()["detail"]

    righe = FIXTURE.read_text(encoding="utf-8").splitlines()
    corto = tmp_path / "corto.txt"
    corto.write_text("\n".join([righe[0], righe[1][:30]]), encoding="utf-8")
    corta_id = _crea_pratica(client, "Corta")
    _upload(client, corta_id, corto)
    client.put(f"/api/jet/pratiche/{corta_id}/parametri", json=params())
    assert client.put(
        f"/api/jet/pratiche/{corta_id}/profilo/{profilo_id}"
    ).status_code == 200
    analisi = client.post(f"/api/jet/pratiche/{corta_id}/analizza")
    assert analisi.status_code == 400
    assert "Riga 2 troppo corta" in analisi.json()["detail"]
