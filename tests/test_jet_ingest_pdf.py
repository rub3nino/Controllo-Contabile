from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.jet.ingest_pdf import (
    ERRORE_PDF_SCANSIONATO,
    estrai_righe_pdf,
    mappa_righe_pdf,
)
from backend.jet.ingest_txt import ispeziona_txt, mappa_righe_txt
from backend.jet.profilo import ProfiloEstrazione

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_TXT = ROOT / "fixtures" / "jet" / "giornale_colonne_fisse.txt"
FIXTURE_PDF = ROOT / "fixtures" / "jet" / "giornale_colonne_fisse.pdf"
FIXTURE_SCANSIONE = ROOT / "fixtures" / "jet" / "giornale_scansionato.pdf"
POSIZIONI = {
    "identificativo_registrazione": (0, 8),
    "data_effettiva": (8, 18),
    "conto_contabile": (18, 28),
    "importo_netto": (28, 42),
    "descrizione": (42, 62),
    "utente": (62, 72),
}


def _profilo_txt() -> ProfiloEstrazione:
    return ProfiloEstrazione(
        nome="Profilo condiviso TXT/PDF",
        riga_intestazione=0,
        intestazione_riferimento=ispeziona_txt(FIXTURE_TXT).intestazione.strip(),
        posizioni=POSIZIONI,
    )


def test_pdf_preserva_layout_e_riusa_lo_stesso_profilo_txt():
    profilo = _profilo_txt()
    righe_txt = mappa_righe_txt(FIXTURE_TXT, profilo)
    righe_pdf = mappa_righe_pdf(FIXTURE_PDF, profilo)

    assert estrai_righe_pdf(FIXTURE_PDF)[0] == ispeziona_txt(FIXTURE_TXT).intestazione
    assert righe_pdf == righe_txt
    assert righe_pdf[0].data_effettiva == date(2026, 1, 1)
    assert righe_pdf[0].importo_netto == Decimal("100.50")


def test_pdf_senza_testo_richiede_ocr_fase_d():
    with pytest.raises(ValueError, match="PDF scansionato") as errore:
        estrai_righe_pdf(FIXTURE_SCANSIONE)
    assert str(errore.value) == ERRORE_PDF_SCANSIONATO
