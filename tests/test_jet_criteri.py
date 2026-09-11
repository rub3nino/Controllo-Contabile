"""Fase 3 JET: criteri storici di ``Calcs1`` su dati sintetici."""

from datetime import date, time
from decimal import Decimal
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.jet import ParametriClienteJet, RigaGiornale, valuta_riga
from backend.jet.criteri import calcola_media_assoluta_registrazioni


def _parametri(**modifiche) -> ParametriClienteJet:
    base = ParametriClienteJet(
        materialita_bilancio=Decimal("1000"),
        performance_materiality=Decimal("700"),
        utile_netto_dopo_imposte=Decimal("1000"),
        valore_medio_registrazione=Decimal("10"),
        soglia_importo_cifra_tonda=Decimal("10"),
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
    assert esito.flag_forward_dating is None
    assert esito.metodo_calcolo_backdating is None
    assert esito.flag_staff_non_autorizzato is None
    assert esito.punteggio_totale == 0


def test_backdating_usa_giorni_lavorativi_con_paese():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 1, 9), data_creazione=date(2026, 1, 12)),
        _parametri(paese="IT", giorni_weekend=None, festivita=None, soglia_backdating_giorni=2),
    )
    assert esito.flag_backdated is False
    assert esito.flag_forward_dating is False
    assert esito.metodo_calcolo_backdating == "giorni_lavorativi"


def test_forward_dating_non_da_punti():
    esito = valuta_riga(
        _riga(data_creazione=date(2026, 1, 6)),
        _parametri(
            utile_netto_dopo_imposte=None, valore_medio_registrazione=None,
            performance_materiality=None, soglia_importo_cifra_tonda=None,
            orario_ufficio_inizio=None, staff_autorizzato=None,
            parole_chiave_parti_correlate=None, festivita=None,
            giorni_weekend=None, punteggio_backdated=999,
        ),
    )
    assert esito.flag_forward_dating is True
    assert esito.flag_backdated is False
    assert esito.metodo_calcolo_backdating is None
    assert esito.punteggio_totale == 0


def test_backdating_stessa_data():
    esito = valuta_riga(_riga(data_creazione=date(2026, 1, 7)), _parametri())
    assert esito.flag_backdated is False
    assert esito.flag_forward_dating is False
    assert esito.metodo_calcolo_backdating == "giorni_calendario"


def test_backdating_senza_paese_usa_calendario():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 1, 9), data_creazione=date(2026, 1, 12)),
        _parametri(paese=None, soglia_backdating_giorni=3),
    )
    assert esito.flag_backdated is True
    assert esito.metodo_calcolo_backdating == "giorni_calendario"


def test_backdating_israele_senza_festivita_usa_calendario():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 1, 9), data_creazione=date(2026, 1, 12)),
        _parametri(paese="IL", giorni_weekend=None, festivita=None, soglia_backdating_giorni=3),
    )
    assert esito.flag_backdated is True
    assert esito.metodo_calcolo_backdating == "giorni_calendario"


def test_backdating_cambio_anno_usa_calendario_completo():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 24), data_creazione=date(2027, 1, 4)),
        _parametri(paese="IT", giorni_weekend=None, festivita=None, soglia_backdating_giorni=6),
    )
    assert esito.flag_backdated is False
    assert esito.metodo_calcolo_backdating == "giorni_lavorativi"


def test_backdating_fuori_dataset_usa_calendario_senza_crash():
    esito = valuta_riga(
        _riga(data_effettiva=date(2030, 12, 30), data_creazione=date(2031, 1, 2)),
        _parametri(paese="IT", giorni_weekend=None, festivita=None, soglia_backdating_giorni=3),
    )
    assert esito.flag_backdated is True
    assert esito.metodo_calcolo_backdating == "giorni_calendario"


def test_backdating_senza_soglia_non_calcolabile():
    esito = valuta_riga(_riga(), _parametri(soglia_backdating_giorni=None))
    assert esito.flag_backdated is None
    assert esito.flag_forward_dating is None
    assert esito.metodo_calcolo_backdating is None


def test_finestra_chiusura_include_data_chiusura_e_confine():
    parametri = _parametri(
        paese="IT",
        giorni_weekend=None,
        festivita=None,
        data_chiusura=date(2026, 12, 31),
        finestra_chiusura_giorni_lavorativi=5,
    )

    sulla_chiusura = valuta_riga(_riga(data_effettiva=date(2026, 12, 31)), parametri)
    ultimo_giorno_incluso = valuta_riga(_riga(data_effettiva=date(2026, 12, 24)), parametri)
    primo_giorno_escluso = valuta_riga(_riga(data_effettiva=date(2026, 12, 23)), parametri)

    assert sulla_chiusura.flag_finestra_chiusura is True
    assert ultimo_giorno_incluso.flag_finestra_chiusura is True
    assert primo_giorno_escluso.flag_finestra_chiusura is False


def test_finestra_chiusura_data_effettiva_successiva_e_false():
    esito = valuta_riga(
        _riga(data_effettiva=date(2027, 1, 2)),
        _parametri(
            paese="IT",
            data_chiusura=date(2026, 12, 31),
            finestra_chiusura_giorni_lavorativi=5,
        ),
    )
    assert esito.flag_finestra_chiusura is False


def test_creata_dopo_chiusura_vero_e_falso():
    parametri = _parametri(data_chiusura=date(2026, 12, 31))
    successiva = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 31), data_creazione=date(2027, 1, 2)),
        parametri,
    )
    precedente = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 30), data_creazione=date(2026, 12, 31)),
        parametri,
    )
    assert successiva.flag_creata_dopo_chiusura is True
    assert precedente.flag_creata_dopo_chiusura is False


def test_data_chiusura_assente_rende_entrambi_non_calcolabili():
    esito = valuta_riga(
        _riga(),
        _parametri(data_chiusura=None, finestra_chiusura_giorni_lavorativi=5),
    )
    assert esito.flag_finestra_chiusura is None
    assert esito.flag_creata_dopo_chiusura is None


def test_soglia_finestra_assente_non_blocca_creata_dopo_chiusura():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 31), data_creazione=date(2027, 1, 2)),
        _parametri(
            data_chiusura=date(2026, 12, 31),
            finestra_chiusura_giorni_lavorativi=None,
        ),
    )
    assert esito.flag_finestra_chiusura is None
    assert esito.flag_creata_dopo_chiusura is True


def test_finestra_senza_paese_non_ha_fallback_ma_creata_dopo_e_calcolabile():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 31), data_creazione=date(2027, 1, 2)),
        _parametri(
            paese=None,
            data_chiusura=date(2026, 12, 31),
            finestra_chiusura_giorni_lavorativi=5,
        ),
    )
    assert esito.flag_finestra_chiusura is None
    assert esito.flag_creata_dopo_chiusura is True


def test_finestra_israele_senza_festivita_non_calcolabile():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 31)),
        _parametri(
            paese="IL",
            giorni_weekend=None,
            festivita=None,
            data_chiusura=date(2026, 12, 31),
            finestra_chiusura_giorni_lavorativi=5,
        ),
    )
    assert esito.flag_finestra_chiusura is None


def test_flag_chiusura_non_contribuiscono_al_punteggio():
    esito = valuta_riga(
        _riga(
            data_effettiva=date(2026, 12, 31),
            data_creazione=date(2027, 1, 2),
        ),
        _parametri(
            paese="IT", giorni_weekend=None, festivita=None,
            data_chiusura=date(2026, 12, 31),
            finestra_chiusura_giorni_lavorativi=5,
            soglia_backdating_giorni=None,
            utile_netto_dopo_imposte=None, valore_medio_registrazione=None,
            performance_materiality=None, soglia_importo_cifra_tonda=None,
            orario_ufficio_inizio=None, staff_autorizzato=None,
            parole_chiave_parti_correlate=None,
            punteggio_profit_impact=999, punteggio_oltre_dieci_volte_media=999,
            punteggio_sopra_performance_materiality=999,
            punteggio_importo_cifra_tonda=999, punteggio_weekend=999,
            punteggio_festivita=999, punteggio_fuori_orario=999,
            punteggio_backdated=999, punteggio_staff_non_autorizzato=999,
            punteggio_parte_correlata=999, punteggio_descrizione_vuota=999,
        ),
    )
    assert esito.flag_finestra_chiusura is True
    assert esito.flag_creata_dopo_chiusura is True
    assert esito.punteggio_totale == 0


@pytest.mark.parametrize(
    ("soglia", "importo", "atteso"),
    [
        (Decimal("10000"), Decimal("100000"), True),
        (Decimal("100000"), Decimal("10000"), False),
    ],
)
def test_cifra_tonda_usa_la_soglia_configurata(soglia, importo, atteso):
    esito = valuta_riga(
        _riga(importo_netto=importo),
        _parametri(soglia_importo_cifra_tonda=soglia),
    )

    assert esito.flag_importo_cifra_tonda is atteso


def test_cifra_tonda_senza_soglia_non_e_calcolabile_e_non_da_punti():
    esito = valuta_riga(
        _riga(importo_netto=Decimal("100000")),
        _parametri(
            soglia_importo_cifra_tonda=None,
            utile_netto_dopo_imposte=None,
            valore_medio_registrazione=None,
            performance_materiality=None,
        ),
    )

    assert esito.flag_importo_cifra_tonda is None
    assert esito.punteggio_totale == 0


@pytest.mark.parametrize(
    ("parametro", "campo_esito"),
    [
        ("utile_netto_dopo_imposte", "flag_profit_impact"),
        ("valore_medio_registrazione", "flag_oltre_dieci_volte_media"),
        ("performance_materiality", "flag_sopra_performance_materiality"),
        ("giorni_weekend", "flag_weekend"),
        ("festivita", "flag_festivita"),
        ("parole_chiave_parti_correlate", "flag_parte_correlata"),
    ],
)
def test_parametro_non_configurato_resta_non_calcolabile(parametro, campo_esito):
    esito = valuta_riga(_riga(), _parametri(**{parametro: None}))

    assert getattr(esito, campo_esito) is None
    assert esito.punteggio_totale == 0


def test_utente_di_sistema_rende_il_criterio_staff_non_applicabile():
    esito = valuta_riga(
        _riga(utente="BATCH_SINTETICO"),
        _parametri(utenti_di_sistema=["BATCH_SINTETICO"]),
    )

    assert "BATCH_SINTETICO" not in _parametri().staff_autorizzato
    assert esito.flag_staff_non_autorizzato is None


def test_senza_lista_utenti_di_sistema_non_esclude_implicitamente():
    parametri = _parametri(utenti_di_sistema=None)
    esito = valuta_riga(_riga(utente="BATCH_SINTETICO"), parametri)

    assert esito.flag_staff_non_autorizzato is True
    assert esito.punteggio_totale == parametri.punteggio_staff_non_autorizzato


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


def test_media_assoluta_usa_assoluti_ed_esclude_zeri():
    righe = [
        _riga(importo_netto=Decimal("10")),
        _riga(importo_netto=Decimal("-20")),
        _riga(importo_netto=Decimal("0")),
    ]
    assert calcola_media_assoluta_registrazioni(righe) == Decimal("15")


@pytest.mark.parametrize("righe", [[], [_riga(importo_netto=Decimal("0"))]])
def test_media_assoluta_senza_valori_utilizzabili_restituisce_none(righe):
    assert calcola_media_assoluta_registrazioni(righe) is None


def test_media_manuale_prevale_sulla_media_di_popolazione():
    manuale = valuta_riga(
        _riga(importo_netto=Decimal("150")),
        _parametri(valore_medio_registrazione=Decimal("20")),
        media_registrazione_popolazione=Decimal("10"),
    )
    automatica = valuta_riga(
        _riga(importo_netto=Decimal("150")),
        _parametri(valore_medio_registrazione=None),
        media_registrazione_popolazione=Decimal("10"),
    )
    assert manuale.flag_oltre_dieci_volte_media is False
    assert automatica.flag_oltre_dieci_volte_media is True


def test_paese_deriva_weekend_e_festivita_senza_liste_manuali():
    parametri = _parametri(paese="IT", giorni_weekend=None, festivita=None)

    weekend = valuta_riga(_riga(data_effettiva=date(2026, 1, 10)), parametri)
    festivo = valuta_riga(_riga(data_effettiva=date(2026, 4, 6)), parametri)

    assert weekend.flag_weekend is True
    assert festivo.flag_festivita is True


def test_festivita_manuali_si_aggiungono_al_calendario_del_paese():
    parametri = _parametri(
        paese="IT", giorni_weekend=None, festivita=[date(2026, 1, 7)]
    )

    aggiuntiva = valuta_riga(_riga(data_effettiva=date(2026, 1, 7)), parametri)
    nazionale = valuta_riga(_riga(data_effettiva=date(2026, 4, 6)), parametri)

    assert aggiuntiva.flag_festivita is True
    assert nazionale.flag_festivita is True


def test_weekend_manuale_sostituisce_interamente_quello_del_paese():
    parametri = _parametri(paese="IT", giorni_weekend=[2], festivita=None)

    mercoledi = valuta_riga(_riga(data_effettiva=date(2026, 1, 7)), parametri)
    sabato = valuta_riga(_riga(data_effettiva=date(2026, 1, 10)), parametri)

    assert mercoledi.flag_weekend is True
    assert sabato.flag_weekend is False


def test_weekend_e_festivita_sovrapposti_contano_solo_il_peso_maggiore():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 10, 4)),
        _parametri(
            paese="IT",
            giorni_weekend=None,
            festivita=None,
            punteggio_weekend=2,
            punteggio_festivita=4,
        ),
    )

    assert esito.flag_weekend is True
    assert esito.flag_festivita is True
    assert esito.punteggio_totale == 4


def test_senza_paese_le_liste_manuali_continuano_a_funzionare():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 1, 10)),
        _parametri(paese=None, giorni_weekend=[5], festivita=[date(2026, 1, 10)]),
    )

    assert esito.flag_weekend is True
    assert esito.flag_festivita is True


def test_israele_senza_festivita_compilate_resta_non_calcolabile():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 1, 7)),
        _parametri(paese="IL", giorni_weekend=None, festivita=None),
    )

    assert esito.flag_festivita is None


def test_israele_usa_le_festivita_manuali_quando_presenti():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 1, 7)),
        _parametri(
            paese="IL", giorni_weekend=None, festivita=[date(2026, 1, 7)]
        ),
    )

    assert esito.flag_festivita is True


def test_profit_impact_disattivato_resta_none_e_non_da_punti():
    esito = valuta_riga(
        _riga(importo_netto=Decimal("100.01")),
        _parametri(
            attivo_profit_impact=False,
            valore_medio_registrazione=Decimal("100"),
            punteggio_profit_impact=999,
        ),
    )
    assert esito.flag_profit_impact is None
    assert esito.punteggio_totale == 0


def test_gruppo_backdating_disattivato_annulla_flag_metodo_e_punteggio():
    esito = valuta_riga(
        _riga(data_creazione=date(2026, 3, 9)),
        _parametri(attivo_backdated=False, punteggio_backdated=999),
    )
    assert esito.flag_backdated is None
    assert esito.flag_forward_dating is None
    assert esito.metodo_calcolo_backdating is None
    assert esito.punteggio_totale == 0


def test_gruppo_finestra_chiusura_disattivato_annulla_entrambi_i_flag():
    esito = valuta_riga(
        _riga(data_effettiva=date(2026, 12, 31), data_creazione=date(2027, 1, 2)),
        _parametri(
            attivo_finestra_chiusura=False,
            paese="IT",
            data_chiusura=date(2026, 12, 31),
            finestra_chiusura_giorni_lavorativi=5,
            soglia_backdating_giorni=None,
        ),
    )
    assert esito.flag_finestra_chiusura is None
    assert esito.flag_creata_dopo_chiusura is None
    assert esito.punteggio_totale == 0


def test_descrizione_vuota_disattivata_resta_false_e_non_da_punti():
    esito = valuta_riga(
        _riga(descrizione=""),
        _parametri(attivo_descrizione_vuota=False, punteggio_descrizione_vuota=999),
    )
    assert esito.flag_descrizione_vuota is False
    assert esito.punteggio_totale == 0


def test_conto_insolito_disattivato_anche_con_soglia_resta_none():
    esito = valuta_riga(
        _riga(),
        _parametri(soglia_frequenza_insolita=10),
        frequenze_conto={"100100": 1},
    )
    assert esito.flag_conto_insolito_raro is None


def test_quattro_criteri_attivi_riproporzionano_soglia_e_verdetto():
    quattro_attivi = _parametri(
        soglia_da_investigare=4,
        valore_medio_registrazione=Decimal("100"),
        attivo_oltre_dieci_volte_media=False,
        attivo_sopra_performance_materiality=False,
        attivo_importo_cifra_tonda=False,
        attivo_festivita=False,
        attivo_backdated=False,
        attivo_parte_correlata=False,
        attivo_descrizione_vuota=False,
    )
    ridotta = valuta_riga(_riga(importo_netto=Decimal("100.01")), quattro_attivi)
    completa = valuta_riga(
        _riga(importo_netto=Decimal("100.01")),
        _parametri(soglia_da_investigare=4, valore_medio_registrazione=Decimal("100")),
    )
    assert ridotta.punteggio_totale == 1
    assert ridotta.soglia_da_investigare_effettiva == round(4 * 4 / 11) == 1
    assert ridotta.da_investigare is True
    assert completa.punteggio_totale == 1
    assert completa.soglia_da_investigare_effettiva == 4
    assert completa.da_investigare is False


@pytest.mark.parametrize(("numero_attivi", "soglia_attesa"), [(7, 3), (8, 4)])
def test_confine_sette_otto_criteri_attivi(numero_attivi, soglia_attesa):
    campi = [
        "attivo_profit_impact", "attivo_oltre_dieci_volte_media",
        "attivo_sopra_performance_materiality", "attivo_importo_cifra_tonda",
        "attivo_weekend", "attivo_festivita", "attivo_fuori_orario",
        "attivo_backdated", "attivo_staff_non_autorizzato",
        "attivo_parte_correlata", "attivo_descrizione_vuota",
    ]
    stato = {campo: indice < numero_attivi for indice, campo in enumerate(campi)}
    esito = valuta_riga(_riga(), _parametri(soglia_da_investigare=4, **stato))
    assert esito.soglia_da_investigare_effettiva == soglia_attesa


def test_zero_criteri_standard_attivi_conserva_soglia_e_non_investiga():
    campi = {
        campo: False
        for campo in (
            "attivo_profit_impact", "attivo_oltre_dieci_volte_media",
            "attivo_sopra_performance_materiality", "attivo_importo_cifra_tonda",
            "attivo_weekend", "attivo_festivita", "attivo_fuori_orario",
            "attivo_backdated", "attivo_staff_non_autorizzato",
            "attivo_parte_correlata", "attivo_descrizione_vuota",
        )
    }
    esito = valuta_riga(
        _riga(descrizione=""),
        _parametri(soglia_da_investigare=4, **campi),
    )
    assert esito.punteggio_totale == 0
    assert esito.soglia_da_investigare_effettiva == 4
    assert esito.da_investigare is False
