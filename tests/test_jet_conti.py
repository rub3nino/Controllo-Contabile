"""Fase 4 JET: criteri che dipendono dalla dimensione conto."""

from datetime import date, time
from decimal import Decimal
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.jet import (
    ParametriClienteJet,
    RigaGiornale,
    calcola_frequenza_conti,
    valuta_riga,
)


def _riga(identificativo: str, conto: str | None) -> RigaGiornale:
    return RigaGiornale(
        data_effettiva=date(2026, 1, 7),
        data_creazione=date(2026, 1, 8),
        ora_creazione=time(9),
        identificativo_registrazione=identificativo,
        importo_netto=Decimal("11.11"),
        descrizione="Operazione ordinaria",
        utente="AUTORIZZATO",
        conto_contabile=conto,
    )


def _parametri(**modifiche) -> ParametriClienteJet:
    base = ParametriClienteJet(
        performance_materiality=Decimal("100000"),
        utile_netto_dopo_imposte=Decimal("100000"),
        valore_medio_registrazione=Decimal("100000"),
        orario_ufficio_inizio=time(8, 30),
        orario_ufficio_fine=time(17),
        giorni_weekend=[5, 6],
        soglia_backdating_giorni=60,
        festivita=[],
        staff_autorizzato=["AUTORIZZATO"],
        parole_chiave_parti_correlate=[],
        soglia_da_investigare=4,
        attivo_conto_insolito_raro=True,
        attivo_conto_infragruppo_parte_correlata=True,
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


def test_calcola_frequenza_conti_ignorando_conto_mancante():
    frequenze = calcola_frequenza_conti(
        [_riga("1", "100"), _riga("2", "100"), _riga("3", "200"), _riga("4", None)]
    )

    assert frequenze == {"100": 2, "200": 1}


def test_conto_frequente_non_flaggato_e_conto_raro_flaggato_con_punti():
    parametri = _parametri(
        soglia_frequenza_insolita=3,
        punteggio_conto_insolito_raro=4,
    )

    frequente = valuta_riga(_riga("1", "100"), parametri, {"100": 5})
    raro = valuta_riga(_riga("2", "200"), parametri, {"200": 2})

    assert frequente.frequenza_utilizzo_conto == 5
    assert frequente.flag_conto_insolito_raro is False
    assert frequente.punteggio_totale == 0
    assert raro.frequenza_utilizzo_conto == 2
    assert raro.flag_conto_insolito_raro is True
    assert raro.punteggio_totale == 4
    assert raro.da_investigare is True


def test_conto_assente_dal_dizionario_ha_frequenza_zero():
    esito = valuta_riga(
        _riga("1", "999"),
        _parametri(soglia_frequenza_insolita=1),
        {},
    )

    assert esito.frequenza_utilizzo_conto == 0
    assert esito.flag_conto_insolito_raro is True


def test_senza_frequenze_comportamento_retrocompatibile():
    esito = valuta_riga(
        _riga("1", "100"),
        _parametri(
            soglia_frequenza_insolita=3,
            punteggio_conto_insolito_raro=4,
        ),
    )

    assert esito.frequenza_utilizzo_conto is None
    assert esito.flag_conto_insolito_raro is None
    assert esito.punteggio_totale == 0


def test_soglia_non_fornita_lascia_il_flag_rarita_non_calcolabile():
    esito = valuta_riga(_riga("1", "100"), _parametri(), {"100": 2})

    assert esito.frequenza_utilizzo_conto == 2
    assert esito.flag_conto_insolito_raro is None


def test_conto_infragruppo_con_lista_fornita_contribuisce_al_punteggio():
    esito = valuta_riga(
        _riga("1", "IC-100"),
        _parametri(
            conti_infragruppo_parte_correlata=["IC-100"],
            punteggio_conto_infragruppo_parte_correlata=5,
        ),
    )

    assert esito.flag_conto_infragruppo_parte_correlata is True
    assert esito.punteggio_totale == 5
    assert esito.da_investigare is True


def test_conto_non_infragruppo_e_lista_non_fornita_sono_distinti():
    non_presente = valuta_riga(
        _riga("1", "100"),
        _parametri(conti_infragruppo_parte_correlata=["IC-100"]),
    )
    non_calcolabile = valuta_riga(_riga("2", "100"), _parametri())

    assert non_presente.flag_conto_infragruppo_parte_correlata is False
    assert non_calcolabile.flag_conto_infragruppo_parte_correlata is None
