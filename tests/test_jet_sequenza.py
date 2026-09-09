"""Fase 3 JET: completezza della sequenza dei numeri documento."""

from datetime import date
from decimal import Decimal
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.jet import RigaGiornale, verifica_sequenza


def _riga(numero: str | None) -> RigaGiornale:
    return RigaGiornale(
        data_effettiva=date(2026, 1, 1),
        identificativo_registrazione=f"riga-{numero}",
        numero_documento=numero,
        importo_netto=Decimal("1"),
    )


def test_individua_i_buchi_nella_sequenza_ordinata():
    esiti, non_enumerati = verifica_sequenza(
        [_riga("7"), _riga("1"), _riga("4"), _riga("2"), _riga("5")]
    )
    assert [esito.numero_atteso for esito in esiti] == ["3", "6"]
    assert all(esito.numero_trovato is None and esito.mancante for esito in esiti)
    assert non_enumerati == []


def test_ignora_documenti_assenti_alfanumerici_e_duplicati():
    esiti, non_enumerati = verifica_sequenza(
        [_riga(None), _riga("A-1"), _riga("10"), _riga("10"), _riga("11")]
    )
    assert esiti == []
    assert non_enumerati == []


def test_gap_enorme_viene_segnalato_senza_essere_enumerato():
    esiti, non_enumerati = verifica_sequenza(
        [_riga("1"), _riga(str(10**15))]
    )

    assert esiti == []
    assert non_enumerati == [("1", str(10**15), 10**15 - 2)]


def test_gap_massimo_e_configurabile():
    esiti, non_enumerati = verifica_sequenza(
        [_riga("1"), _riga("5")], gap_massimo=2
    )

    assert esiti == []
    assert non_enumerati == [("1", "5", 3)]


def test_gap_massimo_negativo_non_e_valido():
    with pytest.raises(ValueError, match="gap_massimo"):
        verifica_sequenza([_riga("1"), _riga("2")], gap_massimo=-1)
