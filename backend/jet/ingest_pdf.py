"""Estrazione layout-aware di giornali da PDF con testo nativo.

I PDF scansionati restano non supportati per scelta: un test preliminare ha
mostrato un allineamento OCR instabile. Il lavoro potrà riprendere con un
approccio a bounding box e griglia editabile, da validare su volumi reali.
"""

from __future__ import annotations

from pathlib import Path
import re

import pymupdf

from backend.jet.ingest_txt import mappa_righe_testo
from backend.jet.models import RigaGiornale
from backend.jet.profilo import ProfiloEstrazione

ERRORE_PDF_SCANSIONATO = (
    "Questo file sembra un PDF scansionato: l'estrazione testuale non è "
    "supportata. Carica invece un export Excel, TXT o PDF con testo reale "
    "dello stesso giornale."
)

_NUMERO_PAGINA = re.compile(
    r"(?i)\b(?:pagina|pag\.?)[ \t]*(\d+)(?:[ \t]*(?:/|di)[ \t]*\d+)?\b"
)
_FRAZIONE_PAGINA = re.compile(r"(?<!\d)(\d+)[ \t]*/[ \t]*\d+(?!\d)")


def analizza_numerazione_pdf(percorso: str | Path) -> dict[str, object]:
    """Conta le pagine fisiche e verifica una numerazione stampata riconoscibile.

    L'esito della sequenza resta ``None`` quando nessuna pagina espone una
    numerazione esplicita. Una numerazione parziale, duplicata o non consecutiva
    produce invece ``False``.
    """
    try:
        with pymupdf.open(Path(percorso)) as documento:
            numero_pagine = documento.page_count
            numeri: list[int] = []
            pagine_senza_numero = 0
            for pagina in documento:
                testo = pagina.get_text("text", sort=True)
                trovati = [int(x) for x in _NUMERO_PAGINA.findall(testo)]
                if not trovati:
                    righe = [r.strip() for r in testo.splitlines() if r.strip()]
                    margini = "\n".join(righe[:3] + righe[-3:])
                    trovati = [int(x) for x in _FRAZIONE_PAGINA.findall(margini)]
                unici = list(dict.fromkeys(trovati))
                if len(unici) == 1:
                    numeri.append(unici[0])
                else:
                    pagine_senza_numero += 1
    except (RuntimeError, ValueError) as exc:
        raise ValueError(f"PDF non leggibile: {exc}") from exc

    if not numeri:
        return {
            "numero_pagine_pdf": numero_pagine,
            "numeri_pagina_rilevati": None,
            "pagine_mancanti": None,
            "sequenza_pagine_completa": None,
        }

    attesi = set(range(min(numeri), max(numeri) + 1))
    mancanti = sorted(attesi - set(numeri))
    completa = (
        pagine_senza_numero == 0
        and len(numeri) == numero_pagine
        and len(set(numeri)) == len(numeri)
        and numeri == list(range(numeri[0], numeri[0] + numero_pagine))
    )
    return {
        "numero_pagine_pdf": numero_pagine,
        "numeri_pagina_rilevati": numeri,
        "pagine_mancanti": mancanti,
        "sequenza_pagine_completa": completa,
    }


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
