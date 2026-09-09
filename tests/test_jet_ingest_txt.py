from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.jet.ingest_txt import estrai_righe_txt, ispeziona_txt, mappa_righe_txt
from backend.jet.profilo import ProfiloEstrazione

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "jet" / "giornale_colonne_fisse.txt"
FIXTURE_CP1252 = ROOT / "fixtures" / "jet" / "giornale_colonne_fisse_cp1252.txt"
POSIZIONI = {
    "identificativo_registrazione": (0, 8),
    "data_effettiva": (8, 18),
    "conto_contabile": (18, 28),
    "importo_netto": (28, 42),
    "descrizione": (42, 62),
    "utente": (62, 72),
}


def _profilo(**updates):
    data = {
        "nome": "Gestionale test",
        "riga_intestazione": 0,
        "intestazione_riferimento": ispeziona_txt(FIXTURE).intestazione.strip(),
        "posizioni": POSIZIONI,
    }
    return ProfiloEstrazione(**(data | updates))


def test_profilo_esplicito_estrae_e_normalizza_colonne_fisse_cp1252():
    anteprima = ispeziona_txt(FIXTURE_CP1252)
    righe = mappa_righe_txt(FIXTURE_CP1252, _profilo())

    assert anteprima.codifica == "cp1252"
    assert len(righe) == 10
    assert righe[0].identificativo_registrazione == "1"
    assert righe[0].data_effettiva == date(2026, 1, 1)
    assert righe[0].importo_netto == Decimal("100.50")
    assert righe[0].descrizione == "Caffè e forniture"
    assert righe[3].utente is None


def test_campo_non_mappato_diventa_none():
    posizioni = {campo: intervallo for campo, intervallo in POSIZIONI.items()
                 if campo != "conto_contabile"}
    riga = mappa_righe_txt(FIXTURE, _profilo(posizioni=posizioni))[0]
    assert riga.conto_contabile is None


def test_riga_corta_indica_il_numero_di_riga(tmp_path):
    corto = tmp_path / "corto.txt"
    righe = FIXTURE.read_text(encoding="utf-8").splitlines()
    corto.write_text("\n".join([righe[0], righe[1][:30]]), encoding="utf-8")

    with pytest.raises(ValueError, match=r"Riga 2 troppo corta"):
        estrai_righe_txt(corto, _profilo())
