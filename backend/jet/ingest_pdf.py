"""Estrazione layout-aware di giornali da PDF con testo nativo."""

from __future__ import annotations

from pathlib import Path

import pymupdf

from backend.jet.ingest_txt import mappa_righe_testo
from backend.jet.models import RigaGiornale
from backend.jet.profilo import ProfiloEstrazione

ERRORE_PDF_SCANSIONATO = (
    "Questo file sembra un PDF scansionato: l'estrazione testuale non è "
    "supportata, serve l'OCR della Fase D"
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
