"""Test puro di completezza della sequenza dei protocolli gestionali."""

from __future__ import annotations

from backend.jet.models import EsitoSequenzaJet, RigaGiornale

__all__ = ["verifica_sequenza"]

IntervalloNonEnumerato = tuple[str, str, int]


def verifica_sequenza(
    righe: list[RigaGiornale],
    gap_massimo: int = 10_000,
) -> tuple[list[EsitoSequenzaJet], list[IntervalloNonEnumerato]]:
    """Restituisce i protocolli mancanti e gli intervalli non enumerati.

    Le righe senza ``numero_documento`` sono escluse perché non offrono una
    sequenza verificabile. Anche i protocolli alfanumerici sono esclusi: senza
    una regola per-cliente non esiste un successore univoco da inferire.
    Duplicati dello stesso protocollo non creano falsi gap.

    Ogni intervallo con più di ``gap_massimo`` numeri mancanti viene riportato
    come ``(precedente, successivo, quantità_mancanti)`` nel secondo elemento
    del risultato, senza enumerarlo. Questo mantiene memoria e tempo limitati
    anche quando il campo mescola serie numeriche non correlate.
    """
    if gap_massimo < 0:
        raise ValueError("gap_massimo deve essere maggiore o uguale a zero")

    numeri = sorted(
        {
            int(riga.numero_documento)
            for riga in righe
            if riga.numero_documento is not None
            and riga.numero_documento.strip().isdigit()
        }
    )
    mancanti: list[EsitoSequenzaJet] = []
    non_enumerati: list[IntervalloNonEnumerato] = []
    for precedente, successivo in zip(numeri, numeri[1:]):
        dimensione_gap = successivo - precedente - 1
        if dimensione_gap > gap_massimo:
            non_enumerati.append(
                (str(precedente), str(successivo), dimensione_gap)
            )
            continue
        mancanti.extend(
            EsitoSequenzaJet(
                numero_atteso=str(numero),
                numero_trovato=None,
                mancante=True,
            )
            for numero in range(precedente + 1, successivo)
        )
    return mancanti, non_enumerati
