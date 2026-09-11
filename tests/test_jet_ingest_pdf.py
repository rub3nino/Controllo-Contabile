from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.jet.ingest_pdf import (
    ERRORE_PDF_SCANSIONATO,
    analizza_numerazione_pdf,
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


def test_pdf_senza_testo_indica_i_formati_supportati():
    with pytest.raises(ValueError, match="PDF scansionato") as errore:
        estrai_righe_pdf(FIXTURE_SCANSIONE)
    assert str(errore.value) == ERRORE_PDF_SCANSIONATO


def _pdf_numerato(percorso: Path, numeri: list[int | None]) -> None:
    import pymupdf

    with pymupdf.open() as documento:
        for indice, numero in enumerate(numeri, start=1):
            pagina = documento.new_page()
            pagina.insert_text((72, 72), f"Libro giornale - registrazioni blocco {indice}")
            if numero is not None:
                pagina.insert_text((72, 800), f"Pagina {numero}")
        documento.save(percorso)


def test_pdf_conta_pagine_e_conferma_sequenza_completa(tmp_path):
    percorso = tmp_path / "completo.pdf"
    _pdf_numerato(percorso, [1, 2, 3])

    assert analizza_numerazione_pdf(percorso) == {
        "numero_pagine_pdf": 3,
        "numeri_pagina_rilevati": [1, 2, 3],
        "pagine_mancanti": [],
        "sequenza_pagine_completa": True,
    }


def test_pdf_segnala_buco_nella_numerazione(tmp_path):
    percorso = tmp_path / "buco.pdf"
    _pdf_numerato(percorso, [1, 2, 4])

    assert analizza_numerazione_pdf(percorso) == {
        "numero_pagine_pdf": 3,
        "numeri_pagina_rilevati": [1, 2, 4],
        "pagine_mancanti": [3],
        "sequenza_pagine_completa": False,
    }


def test_pdf_senza_numerazione_resta_non_determinabile(tmp_path):
    percorso = tmp_path / "senza-numeri.pdf"
    _pdf_numerato(percorso, [None, None])

    assert analizza_numerazione_pdf(percorso) == {
        "numero_pagine_pdf": 2,
        "numeri_pagina_rilevati": None,
        "pagine_mancanti": None,
        "sequenza_pagine_completa": None,
    }


def test_pdf_con_numerazione_parziale_o_duplicata_non_e_completo(tmp_path):
    parziale = tmp_path / "parziale.pdf"
    duplicato = tmp_path / "duplicato.pdf"
    _pdf_numerato(parziale, [1, None, 3])
    _pdf_numerato(duplicato, [1, 2, 2])

    esito_parziale = analizza_numerazione_pdf(parziale)
    esito_duplicato = analizza_numerazione_pdf(duplicato)

    assert esito_parziale["pagine_mancanti"] == [2]
    assert esito_parziale["sequenza_pagine_completa"] is False
    assert esito_duplicato["pagine_mancanti"] == []
    assert esito_duplicato["sequenza_pagine_completa"] is False
