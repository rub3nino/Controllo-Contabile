"""Fase 1 JET: validazione dei soli contratti dati, senza calcoli."""

from datetime import date, time
from decimal import Decimal
from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.jet import EsitoRigaJet, EsitoSequenzaJet, ParametriClienteJet, RigaGiornale


def _parametri() -> ParametriClienteJet:
    return ParametriClienteJet(
        materialita_bilancio=Decimal("500000"),
        performance_materiality=Decimal("350000"),
        utile_netto_dopo_imposte=Decimal("2400000"),
        valore_medio_registrazione=Decimal("1250.50"),
        orario_ufficio_inizio=time(8, 30),
        orario_ufficio_fine=time(17),
        giorni_weekend=[5, 6],
        soglia_backdating_giorni=45,
        festivita=[date(2026, 1, 1)],
        staff_autorizzato=["UTENTE_TEST"],
        parole_chiave_parti_correlate=["SOCIETA TEST"],
        soglia_da_investigare=5,
        punteggio_profit_impact=2,
        punteggio_oltre_dieci_volte_media=2,
        punteggio_sopra_performance_materiality=2,
        punteggio_importo_cifra_tonda=1,
        punteggio_weekend=1,
        punteggio_festivita=3,
        punteggio_fuori_orario=1,
        punteggio_backdated=3,
        punteggio_staff_non_autorizzato=3,
        punteggio_parte_correlata=3,
        punteggio_descrizione_vuota=3,
    )


def test_tutti_i_modelli_si_istanziano_con_dati_sintetici():
    riga = RigaGiornale(
        data_effettiva=date(2026, 6, 30),
        data_creazione=date(2026, 7, 2),
        ora_creazione=time(10, 15),
        identificativo_registrazione="RIGA-42",
        numero_documento="DOC-2026-0042",
        importo_netto=Decimal("12500.00"),
        descrizione="Assestamento di prova",
        utente="UTENTE_TEST",
        conto_contabile="700100",
    )
    parametri = _parametri()
    esito = EsitoRigaJet(
        identificativo_registrazione=riga.identificativo_registrazione,
        flag_profit_impact=False,
        flag_oltre_dieci_volte_media=False,
        flag_sopra_performance_materiality=False,
        flag_importo_cifra_tonda=True,
        flag_weekend=False,
        flag_festivita=False,
        flag_fuori_orario=False,
        flag_backdated=False,
        flag_staff_non_autorizzato=False,
        flag_parte_correlata=False,
        flag_descrizione_vuota=False,
        punteggio_totale=1,
        da_investigare=False,
        frequenza_utilizzo_conto=18,
        flag_conto_insolito_raro=False,
        flag_conto_infragruppo_parte_correlata=False,
    )
    sequenza = EsitoSequenzaJet(
        numero_atteso="DOC-2026-0042",
        numero_trovato="DOC-2026-0042",
        mancante=False,
    )

    assert parametri.soglia_da_investigare == 5
    assert esito.flag_importo_cifra_tonda is True
    assert sequenza.mancante is False


def test_lista_opzionale_non_fornita_resta_none():
    dati = _parametri().model_dump()
    dati.pop("festivita")

    parametri = ParametriClienteJet.model_validate(dati)

    assert parametri.festivita is None


def test_esito_accetta_flag_non_calcolabili_espliciti():
    esito = EsitoRigaJet(
        identificativo_registrazione="RIGA-NON-CALCOLABILE",
        flag_profit_impact=False,
        flag_oltre_dieci_volte_media=False,
        flag_sopra_performance_materiality=False,
        flag_importo_cifra_tonda=None,
        flag_weekend=False,
        flag_festivita=False,
        flag_fuori_orario=None,
        flag_backdated=None,
        flag_staff_non_autorizzato=None,
        flag_parte_correlata=False,
        flag_descrizione_vuota=False,
        punteggio_totale=0,
        da_investigare=False,
    )

    assert esito.flag_fuori_orario is None
    assert esito.flag_backdated is None
    assert esito.flag_staff_non_autorizzato is None
    assert esito.flag_importo_cifra_tonda is None


def test_parametri_rifiutano_un_codice_paese_non_supportato():
    dati = _parametri().model_dump()
    dati["paese"] = "XX"

    with pytest.raises(ValidationError, match="Codice Paese non supportato"):
        ParametriClienteJet.model_validate(dati)
