"""Lettura di giornali TXT a colonne fisse tramite profili espliciti."""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel

from backend.jet.ingest import mappa_righe_giornale
from backend.jet.models import RigaGiornale
from backend.jet.profilo import ProfiloEstrazione


class AnteprimaTxt(BaseModel):
    codifica: str
    riga_intestazione: int
    intestazione: str
    righe_esempio: list[str]


def normalizza_intestazione(intestazione: str) -> str:
    """Rimuove solo gli spazi iniziali e finali per il matching esatto."""
    return intestazione.strip()


def _leggibile(testo: str) -> bool:
    if "\x00" in testo:
        return False
    controlli = sum(ord(carattere) < 32 and carattere not in "\n\r\t" for carattere in testo)
    return controlli <= max(1, len(testo) // 100)


def _leggi_testo(percorso: str | Path) -> tuple[str, str]:
    dati = Path(percorso).read_bytes()
    for codifica in ("utf-8", "cp1252", "latin-1"):
        try:
            testo = dati.decode(codifica)
        except UnicodeDecodeError:
            continue
        if _leggibile(testo):
            return testo, codifica
    raise ValueError(
        "File TXT non leggibile: codifica non riconosciuta o contenuto non testuale"
    )


def ispeziona_righe(
    righe: list[str], *, origine: str, numero_esempi: int = 5
) -> AnteprimaTxt:
    """Costruisce l'anteprima profilabile da righe, indipendentemente dall'origine."""
    for indice, riga in enumerate(righe):
        if riga.strip():
            return AnteprimaTxt(
                codifica=origine,
                riga_intestazione=indice,
                intestazione=riga,
                righe_esempio=[x for x in righe[indice + 1:] if x.strip()][
                    :numero_esempi
                ],
            )
    raise ValueError("Il contenuto non contiene un'intestazione non vuota")


def ispeziona_txt(percorso: str | Path, *, numero_esempi: int = 5) -> AnteprimaTxt:
    testo, codifica = _leggi_testo(percorso)
    try:
        return ispeziona_righe(
            testo.splitlines(), origine=codifica, numero_esempi=numero_esempi
        )
    except ValueError as exc:
        raise ValueError("Il file TXT non contiene un'intestazione non vuota") from exc


def estrai_righe_testo(
    righe: list[str], profilo: ProfiloEstrazione, *, formato: str = "TXT"
) -> list[dict[str, str]]:
    """Applica un profilo alle righe con intervalli 0-based ``[inizio, fine)``."""
    anteprima = ispeziona_righe(righe, origine="testo")
    if normalizza_intestazione(anteprima.intestazione) != profilo.intestazione_riferimento:
        raise ValueError(
            f"L'intestazione del file {formato} non corrisponde al profilo applicato"
        )

    lunghezza_minima = max((fine for _, fine in profilo.posizioni.values()), default=0)
    risultato: list[dict[str, str]] = []
    for indice, riga in enumerate(
        righe[anteprima.riga_intestazione + 1:],
        start=anteprima.riga_intestazione + 2,
    ):
        if not riga.strip():
            continue
        if len(riga) < lunghezza_minima:
            raise ValueError(
                f"Riga {indice} troppo corta: {len(riga)} caratteri, "
                f"ne servono almeno {lunghezza_minima} per il profilo"
            )
        risultato.append({
            campo: riga[inizio:fine]
            for campo, (inizio, fine) in profilo.posizioni.items()
        })
    return risultato


def estrai_righe_txt(
    percorso: str | Path, profilo: ProfiloEstrazione
) -> list[dict[str, str]]:
    """Wrapper TXT compatibile sul motore condiviso di righe profilabili."""
    testo, _ = _leggi_testo(percorso)
    return estrai_righe_testo(testo.splitlines(), profilo)


def mappa_righe_testo(
    righe: list[str], profilo: ProfiloEstrazione, *, formato: str = "TXT"
) -> list[RigaGiornale]:
    grezze = estrai_righe_testo(righe, profilo, formato=formato)
    mappatura = {campo: campo for campo in profilo.posizioni}
    return mappa_righe_giornale(grezze, mappatura)


def mappa_righe_txt(
    percorso: str | Path, profilo: ProfiloEstrazione
) -> list[RigaGiornale]:
    testo, _ = _leggi_testo(percorso)
    return mappa_righe_testo(testo.splitlines(), profilo)
