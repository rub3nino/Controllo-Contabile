"""Estrazione layout-aware di giornali da PDF con testo nativo.

I PDF scansionati restano non supportati per scelta: un test preliminare ha
mostrato un allineamento OCR instabile. Il lavoro potrà riprendere con un
approccio a bounding box e griglia editabile, da validare su volumi reali.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf

from backend.jet.ingest_txt import mappa_righe_testo
from backend.jet.models import RigaGiornale
from backend.jet.profilo import ProfiloEstrazione

ERRORE_PDF_SCANSIONATO = (
    "Questo file sembra un PDF scansionato: l'estrazione testuale non è "
    "supportata. Carica invece un export Excel, TXT o PDF con testo reale "
    "dello stesso giornale."
)


def estrai_righe_pdf(percorso: str | Path) -> list[str]:
    """Estrae righe preservando spazi e ordine visuale del testo PDF."""
    try:
        with pymupdf.open(Path(percorso)) as documento:
            righe = [
                riga
                for pagina in documento
                for riga in pagina.get_text("text", sort=True).splitlines()
            ]
    except (RuntimeError, ValueError) as exc:
        raise ValueError(f"PDF non leggibile: {exc}") from exc
    non_vuote = [riga for riga in righe if riga.strip()]
    if len(non_vuote) < 2 or sum(len(riga.strip()) for riga in non_vuote) < 20:
        raise ValueError(ERRORE_PDF_SCANSIONATO)
    return righe


def mappa_righe_pdf(
    percorso: str | Path, profilo: ProfiloEstrazione
) -> list[RigaGiornale]:
    return mappa_righe_testo(estrai_righe_pdf(percorso), profilo, formato="PDF")
