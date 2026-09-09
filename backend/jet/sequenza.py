"""Test puro di completezza della sequenza dei protocolli gestionali."""

from __future__ import annotations

from backend.jet.models import EsitoSequenzaJet, RigaGiornale

__all__ = ["verifica_sequenza"]


def verifica_sequenza(righe: list[RigaGiornale]) -> list[EsitoSequenzaJet]:
    """Restituisce i protocolli numerici mancanti fra minimo e massimo.

    Le righe senza ``numero_documento`` sono escluse perché non offrono una
    sequenza verificabile. Anche i protocolli alfanumerici sono esclusi: senza
    una regola per-cliente non esiste un successore univoco da inferire.
    Duplicati dello stesso protocollo non creano falsi gap.
    """
    numeri = sorted(
        {
            int(riga.numero_documento)
            for riga in righe
            if riga.numero_documento is not None
            and riga.numero_documento.strip().isdigit()
        }
    )
    mancanti: list[EsitoSequenzaJet] = []
    for precedente, successivo in zip(numeri, numeri[1:]):
        mancanti.extend(
            EsitoSequenzaJet(
                numero_atteso=str(numero),
                numero_trovato=None,
                mancante=True,
            )
            for numero in range(precedente + 1, successivo)
        )
    return mancanti
