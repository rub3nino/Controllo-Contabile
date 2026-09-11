from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from tests.test_jet_api import params
from tests.test_jet_api_txt import FIXTURE as FIXTURE_TXT
from tests.test_jet_api_txt import POSIZIONI

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PDF = ROOT / "fixtures" / "jet" / "giornale_colonne_fisse.pdf"
FIXTURE_SCANSIONE = ROOT / "fixtures" / "jet" / "giornale_scansionato.pdf"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("QUADRA_STORAGE", str(tmp_path / "storage"))
    return TestClient(app)


def _crea_pratica(client, nome):
    return client.post(
        "/api/jet/pratiche", json={"client": nome, "period": "2026"}
    ).json()["id"]


def _upload(client, pratica_id, percorso):
    with percorso.open("rb") as file:
        return client.post(
            f"/api/jet/pratiche/{pratica_id}/file",
            files={"file": (percorso.name, file, "application/pdf")},
        )


def test_pdf_riconosce_e_applica_il_profilo_creato_dal_txt(client):
    txt_id = _crea_pratica(client, "TXT")
    _upload(client, txt_id, FIXTURE_TXT)
    creato = client.post(
        f"/api/jet/pratiche/{txt_id}/profilo",
        json={"nome": "Profilo condiviso", "posizioni": POSIZIONI},
    )
    profilo_id = creato.json()["profilo_estrazione_id"]

    pdf_id = _crea_pratica(client, "PDF")
    caricato = _upload(client, pdf_id, FIXTURE_PDF)

    assert caricato.status_code == 200
    assert caricato.json()["codifica"] == "pdf"
    assert caricato.json()["profilo"]["id"] == profilo_id
    fonte = caricato.json()["fonte"]
    assert fonte["numero_pagine_pdf"] == 1
    assert fonte["numeri_pagina_rilevati"] is None
    assert fonte["pagine_mancanti"] is None
    assert fonte["sequenza_pagine_completa"] is None
    pratica = client.get(f"/api/jet/pratiche/{pdf_id}").json()
    assert pratica["numero_pagine_pdf"] == 1
    assert pratica["sequenza_pagine_completa"] is None
    applicato = client.put(f"/api/jet/pratiche/{pdf_id}/profilo/{profilo_id}")
    assert applicato.status_code == 200
    assert applicato.json()["profilo_estrazione_id"] == profilo_id
    client.put(f"/api/jet/pratiche/{pdf_id}/parametri", json=params())
    analizzato = client.post(f"/api/jet/pratiche/{pdf_id}/analizza")
    assert analizzato.status_code == 200
    assert analizzato.json()["numero_registrazioni"] == 10


def test_upload_pdf_senza_testo_indica_i_formati_supportati(client):
    pratica_id = _crea_pratica(client, "Scansione")
    risposta = _upload(client, pratica_id, FIXTURE_SCANSIONE)

    assert risposta.status_code == 400
    assert "PDF scansionato" in risposta.json()["detail"]
    assert "export Excel, TXT o PDF con testo reale" in risposta.json()["detail"]
