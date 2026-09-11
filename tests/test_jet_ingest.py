"""Fase 2 JET: lettura tabellare e mapping verso ``RigaGiornale``."""

from datetime import date
from decimal import Decimal
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.jet import leggi_righe_xlsx, mappa_righe_giornale

FIXTURE = ROOT / "fixtures" / "jet" / "giornale_sintetico.xlsx"

MAPPATURA = {
    "identificativo_registrazione": "Riga N.",
    "numero_documento": "Doc.No.",
    "data_effettiva": "Data Reg.",
    "data_creazione": "Data Reg. [2]",
    "ora_creazione": "C TIME",
    "conto_contabile": "Conto contabile",
    "importo_dare": "Importo Dare",
    "importo_avere": "Importo Avere",
    "descrizione": "Descrizione",
    "utente": "USER",
}


def test_mappa_esattamente_la_riga_nordson_riportata_nel_prompt():
    riga_reale_riportata = {
        "Riga N.": 1,
        "Descrizione": "Unicredit - EUR - AB",
        "Doc.No.": 709000000,
        "Data Reg.": "1/11/2024",
        "Conto contabile": 36422000002,
        "Importo Dare": 21142.17,
        "Importo Avere": 0,
        "Totale (= Dare + Avere)": 21142.17,
        "Mese": "Novembre",
        "USER": "BANKBATCH",
    }

    risultato = mappa_righe_giornale([riga_reale_riportata], MAPPATURA)[0]

    assert risultato.identificativo_registrazione == "1"
    assert risultato.numero_documento == "709000000"
    assert risultato.data_effettiva == date(2024, 11, 1)
    assert risultato.conto_contabile == "36422000002"
    assert risultato.importo_netto == Decimal("21142.17")
    assert risultato.descrizione == "Unicredit - EUR - AB"
    assert risultato.utente == "BANKBATCH"


def test_fixture_gestisce_credito_e_campi_opzionali_mancanti():
    grezze = leggi_righe_xlsx(FIXTURE, foglio="Original data")
    righe = mappa_righe_giornale(grezze, MAPPATURA)

    assert len(righe) == 8
    assert righe[1].importo_netto == Decimal("-725.40")
    assert righe[2].conto_contabile is None
    assert righe[3].utente is None
    assert righe[4].descrizione is None


def test_lettore_preserva_intestazioni_duplicate_e_colonne_conto_ambigue():
    grezze = leggi_righe_xlsx(FIXTURE, foglio="Original data")

    assert "Data Reg." in grezze[0]
    assert "Data Reg. [2]" in grezze[0]
    assert {"Conto n.", "Conto contabile", "Conto conta"} <= grezze[0].keys()


def test_mapper_funzione_senza_passare_da_file():
    righe = mappa_righe_giornale(
        [
            {
                "id": "MANUALE-1",
                "data": "31/12/2025",
                "netto": "-10,50",
            }
        ],
        {
            "identificativo_registrazione": "id",
            "data_effettiva": "data",
            "importo_netto": "netto",
        },
    )

    assert righe[0].importo_netto == Decimal("-10.50")
    assert righe[0].numero_documento is None
    assert righe[0].conto_contabile is None


CSV_PROVA = ROOT / "fixtures" / "jet" / "libro_giornale_prova.csv"
MAPPATURA_CSV_PROVA = {
    "identificativo_registrazione": "Riga",
    "data_effettiva": "Data",
    "descrizione": "Descrizione",
    "conto_contabile": "Conto",
    "importo_dare": "Entrate",
    "importo_avere": "Uscite",
}


def test_csv_prova_aggiunge_riga_e_mappa_entrate_uscite():
    from backend.jet.ingest import leggi_righe_csv, mappa_righe_giornale

    grezze = leggi_righe_csv(CSV_PROVA)
    assert grezze[0]["Riga"] == "1"
    assert grezze[0]["Data"] == "2026-02-03"
    assert grezze[0]["Conto"] == "40000"
    assert grezze[0]["Entrate"] == "13527"
    assert grezze[0]["Uscite"] == ""

    righe = mappa_righe_giornale(grezze, MAPPATURA_CSV_PROVA)
    assert len(righe) == 500
    assert righe[0].identificativo_registrazione == "1"
    assert righe[0].data_effettiva == date(2026, 2, 3)
    assert righe[0].conto_contabile == "40000"
    assert righe[0].importo_netto == Decimal("13527")
    assert righe[0].descrizione == "RABEN ITALY SRL"
    assert righe[0].utente is None
    assert all(r.importo_netto > 0 for r in righe)
