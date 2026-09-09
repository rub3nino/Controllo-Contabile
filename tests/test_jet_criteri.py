"""Fase 3 JET: criteri storici di ``Calcs1`` su dati sintetici."""

from datetime import date, time
from decimal import Decimal
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.jet import ParametriClienteJet, RigaGiornale, valuta_riga


def _parametri(**modifiche) -> ParametriClienteJet:
    base = ParametriClienteJet(
        materialita_bilancio=Decimal("1000"),
        performance_materiality=Decimal("700"),
        utile_netto_dopo_imposte=Decimal("1000"),
        valore_medio_registrazione=Decimal("10"),
        orario_ufficio_inizio=time(8, 30),
        orario_ufficio_fine=time(17),
        giorni_weekend=[5, 6],
        soglia_backdating_giorni=60,
        festivita=[date(2026, 1, 6)],
        staff_autorizzato=["AUTORIZZATO"],
        parole_chiave_parti_correlate=["Società Collegata"],
        soglia_da_investigare=4,
        punteggio_profit_impact=1,
        punteggio_oltre_dieci_volte_media=1,
        punteggio_sopra_performance_materiality=1,
        punteggio_importo_cifra_tonda=1,
        punteggio_weekend=1,
        punteggio_festivita=4,
        punteggio_fuori_orario=1,
        punteggio_backdated=4,
        punteggio_staff_non_autorizzato=4,
        punteggio_parte_correlata=4,
        punteggio_descrizione_vuota=4,
    )
    return base.model_copy(update=modifiche)


def _riga(**modifiche) -> RigaGiornale:
    dati = dict(
        data_effettiva=date(2026, 1, 7),
        data_creazione=date(2026, 1, 8),
        ora_creazione=time(9),
        identificativo_registrazione="1",
        numero_documento="1",
        importo_netto=Decimal("11.11"),
        descrizione="Operazione ordinaria",
        utente="AUTORIZZATO",
        conto_contabile="100100",
    )
    dati.update(modifiche)
    return RigaGiornale(**dati)


@pytest.mark.parametrize(
    ("campo", "riga_vera", "riga_falsa"),
    [
        ("flag_profit_impact", {"importo_netto": Decimal("100.01")}, {"importo_netto": Decimal("100.00")}),
        ("flag_oltre_dieci_volte_media", {"importo_netto": Decimal("100.01")}, {"importo_netto": Decimal("100.00")}),
        ("flag_sopra_performance_materiality", {"importo_netto": Decimal("700.01")}, {"importo_netto": Decimal("700.00")}),
        ("flag_importo_cifra_tonda", {"importo_netto": Decimal("-120")}, {"importo_netto": Decimal("121")}),
        ("flag_weekend", {"data_effettiva": date(2026, 1, 10)}, {"data_effettiva": date(2026, 1, 7)}),
        ("flag_festivita", {"data_effettiva": date(2026, 1, 6)}, {"data_effettiva": date(2026, 1, 7)}),
        ("flag_fuori_orario", {"ora_creazione": time(17, 1)}, {"ora_creazione": time(17)}),
        ("flag_backdated", {"data_creazione": date(2026, 3, 8)}, {"data_creazione": date(2026, 3, 7)}),
        ("flag_staff_non_autorizzato", {"utente": "ESTERNO"}, {"utente": "AUTORIZZATO"}),
        ("flag_parte_correlata", {"descrizione": "Pagamento SOCIETÀ COLLEGATA"}, {"descrizione": "Pagamento fornitore"}),
        ("flag_descrizione_vuota", {"descrizione": "   "}, {"descrizione": "Presente"}),
    ],
)
def test_ogni_criterio_ha_un_caso_vero_e_falso(campo, riga_vera, riga_falsa):
    assert getattr(valuta_riga(_riga(**riga_vera), _parametri()), campo) is True
    assert getattr(valuta_riga(_riga(**riga_falsa), _parametri()), campo) is False


def test_flag_non_calcolabili_restano_none_e_non_danno_punti():
    esito = valuta_riga(
        _riga(ora_creazione=None, data_creazione=None),
        _parametri(staff_autorizzato=None),
    )
    assert esito.flag_fuori_orario is None
    assert esito.flag_backdated is None
    assert esito.flag_staff_non_autorizzato is None
    assert esito.punteggio_totale == 0


def test_verdetto_usa_somma_pesata_e_non_un_dodicesimo_peso():
    esito = valuta_riga(
        _riga(importo_netto=Decimal("121"), utente="ESTERNO"),
        _parametri(soglia_da_investigare=5),
    )
    assert esito.punteggio_totale == 6
    assert esito.da_investigare is True


def test_criteri_conto_restano_non_calcolati():
    esito = valuta_riga(_riga(), _parametri())
    assert esito.frequenza_utilizzo_conto is None
    assert esito.flag_conto_insolito_raro is None
    assert esito.flag_conto_infragruppo_parte_correlata is None
