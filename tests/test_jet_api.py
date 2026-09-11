from datetime import date
from decimal import Decimal
from pathlib import Path

import openpyxl
import pytest
from fastapi.testclient import TestClient

from backend.main import app

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "jet" / "giornale_sintetico.xlsx"
MAPPING = {
    "identificativo_registrazione": "Riga N.", "numero_documento": "Doc.No.",
    "data_effettiva": "Data Reg.", "data_creazione": "Data Reg. [2]",
    "ora_creazione": "C TIME", "conto_contabile": "Conto contabile",
    "importo_dare": "Importo Dare", "importo_avere": "Importo Avere",
    "descrizione": "Descrizione", "utente": "USER",
}


def params():
    return {
        "materialita_bilancio": None, "performance_materiality": None,
        "utile_netto_dopo_imposte": None, "valore_medio_registrazione": None,
        "orario_ufficio_inizio": None, "orario_ufficio_fine": None,
        "giorni_weekend": [5, 6], "soglia_backdating_giorni": None,
        "festivita": [date(2024, 1, 1).isoformat()], "staff_autorizzato": None,
        "utenti_di_sistema": None, "parole_chiave_parti_correlate": None,
        "soglia_frequenza_insolita": 2, "conti_infragruppo_parte_correlata": None,
        "soglia_da_investigare": 2,
        **{name: 1 for name in [
            "punteggio_profit_impact", "punteggio_oltre_dieci_volte_media",
            "punteggio_sopra_performance_materiality", "punteggio_importo_cifra_tonda",
            "punteggio_weekend", "punteggio_festivita", "punteggio_fuori_orario",
            "punteggio_backdated", "punteggio_staff_non_autorizzato",
            "punteggio_parte_correlata", "punteggio_descrizione_vuota",
        ]},
        "punteggio_conto_insolito_raro": 1,
        "punteggio_conto_infragruppo_parte_correlata": None,
    }


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("QUADRA_STORAGE", str(tmp_path / "storage"))
    return TestClient(app)


def test_flusso_api_completo_filtri_paginazione_ed_export(client):
    created = client.post("/api/jet/pratiche", json={"client": "Acme", "period": "2026"})
    assert created.status_code == 201
    pid = created.json()["id"]
    saved = client.put(f"/api/jet/pratiche/{pid}/parametri", json=params())
    assert saved.status_code == 200
    assert saved.json()["parametri"]["staff_autorizzato"] is None

    with FIXTURE.open("rb") as fh:
        uploaded = client.post(
            f"/api/jet/pratiche/{pid}/file",
            files={"file": (FIXTURE.name, fh, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert uploaded.status_code == 200
    assert "Data Reg. [2]" in uploaded.json()["intestazioni"]
    invalid = client.put(f"/api/jet/pratiche/{pid}/mappatura", json={"mappatura": {**MAPPING, "utente": "inesistente"}})
    assert invalid.status_code == 400
    assert client.put(f"/api/jet/pratiche/{pid}/mappatura", json={"mappatura": MAPPING}).status_code == 200

    analyzed = client.post(f"/api/jet/pratiche/{pid}/analizza")
    assert analyzed.status_code == 200
    assert analyzed.json()["numero_registrazioni"] == 8
    tutti_risultati = client.get(
        f"/api/jet/pratiche/{pid}/risultati", params={"page_size": 100}
    ).json()["items"]
    importi_non_zero = [
        abs(Decimal(item["riga"]["importo_netto"]))
        for item in tutti_risultati
        if Decimal(item["riga"]["importo_netto"]) != 0
    ]
    media_attesa = sum(importi_non_zero) / Decimal(len(importi_non_zero))
    assert Decimal(
        analyzed.json()["valore_medio_registrazione_effettivo"]
    ) == media_attesa
    page = client.get(f"/api/jet/pratiche/{pid}/risultati", params={"page_size": 3})
    assert page.status_code == 200
    assert page.json()["total"] == 8 and len(page.json()["items"]) == 3
    nullable_esito = page.json()["items"][0]["esito"]
    assert nullable_esito["flag_profit_impact"] is None
    investigated = client.get(f"/api/jet/pratiche/{pid}/risultati", params={"da_investigare": True})
    assert all(x["esito"]["da_investigare"] for x in investigated.json()["items"])
    sequence = client.get(f"/api/jet/pratiche/{pid}/sequenza")
    assert sequence.status_code == 200
    assert set(sequence.json()) == {"mancanti", "intervalli_non_enumerati"}

    export = client.get(f"/api/jet/pratiche/{pid}/export.xlsx", params={"da_investigare": True})
    assert export.status_code == 200
    output = ROOT / "_verifica_scratch" / "jet-api-export.xlsx"
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(export.content)
    wb = openpyxl.load_workbook(output, read_only=True)
    assert wb.active["A1"].value == "ID registrazione"
    wb.close()
    output.unlink()


def test_analisi_richiede_tutti_i_passi(client):
    pid = client.post("/api/jet/pratiche", json={"client": "X", "period": "Q1"}).json()["id"]
    response = client.post(f"/api/jet/pratiche/{pid}/analizza")
    assert response.status_code == 409
    assert "parametri" in response.json()["detail"]


def test_media_effettiva_rispetta_override_manuale(client):
    pid = client.post("/api/jet/pratiche", json={"client": "Media", "period": "2026"}).json()["id"]
    configurazione = params()
    configurazione["valore_medio_registrazione"] = 123.45
    client.put(f"/api/jet/pratiche/{pid}/parametri", json=configurazione)
    with FIXTURE.open("rb") as fh:
        client.post(
            f"/api/jet/pratiche/{pid}/file",
            files={"file": (FIXTURE.name, fh, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    client.put(f"/api/jet/pratiche/{pid}/mappatura", json={"mappatura": MAPPING})
    analyzed = client.post(f"/api/jet/pratiche/{pid}/analizza")
    assert analyzed.status_code == 200
    assert Decimal(
        analyzed.json()["valore_medio_registrazione_effettivo"]
    ) == Decimal("123.45")


CSV_PROVA = ROOT / "fixtures" / "jet" / "libro_giornale_prova.csv"
MAPPATURA_CSV_PROVA = {
    "identificativo_registrazione": "Riga",
    "data_effettiva": "Data",
    "descrizione": "Descrizione",
    "conto_contabile": "Conto",
    "importo_dare": "Entrate",
    "importo_avere": "Uscite",
}


def test_csv_prova_upload_mappatura_e_analisi(client):
    pid = client.post(
        "/api/jet/pratiche", json={"client": "Prova JET", "period": "2026"}
    ).json()["id"]
    configurazione = params()
    configurazione.update(
        {
            "paese": "IT",
            "performance_materiality": 15000,
            "utile_netto_dopo_imposte": 100000,
            "soglia_importo_cifra_tonda": 10000,
        }
    )
    client.put(f"/api/jet/pratiche/{pid}/parametri", json=configurazione)
    with CSV_PROVA.open("rb") as fh:
        uploaded = client.post(
            f"/api/jet/pratiche/{pid}/files",
            files=[("files", (CSV_PROVA.name, fh, "text/csv"))],
        )
    assert uploaded.status_code == 200, uploaded.text
    payload = uploaded.json()["files"][0]
    assert "Riga" in payload["intestazioni"]
    assert "Entrate" in payload["intestazioni"]
    fonte_id = payload["fonte"]["id"]
    mapped = client.put(
        f"/api/jet/pratiche/{pid}/fonti/{fonte_id}/mappatura",
        json={"mappatura": MAPPATURA_CSV_PROVA},
    )
    assert mapped.status_code == 200, mapped.text
    analyzed = client.post(f"/api/jet/pratiche/{pid}/analizza")
    assert analyzed.status_code == 200, analyzed.text
    assert analyzed.json()["numero_registrazioni"] == 500
    assert analyzed.json()["numero_da_investigare"] >= 1
