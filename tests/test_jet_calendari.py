"""Verifiche strutturali del dataset dei calendari nazionali JET."""

from datetime import date

import pytest

from backend.jet.calendari import (
    CODICI_PAESE,
    FESTIVITA_PER_PAESE,
    WEEKEND_PER_PAESE,
    festivita,
    giorni_lavorativi_tra,
    giorni_weekend,
)


def test_tutti_i_paesi_hanno_weekend_e_copertura_2024_2030():
    assert set(WEEKEND_PER_PAESE) == set(CODICI_PAESE)
    assert set(FESTIVITA_PER_PAESE) == set(CODICI_PAESE)

    for codice in CODICI_PAESE:
        assert set(FESTIVITA_PER_PAESE[codice]) == set(range(2024, 2031))
        assert giorni_weekend(codice) == sorted(set(giorni_weekend(codice)))


def test_ogni_lista_di_festivita_e_ordinata_senza_duplicati():
    for anni in FESTIVITA_PER_PAESE.values():
        for anno, giorni in anni.items():
            assert giorni == sorted(giorni)
            assert len(giorni) == len(set(giorni))
            assert all(giorno.year == anno for giorno in giorni)


def test_calendario_italiano_2026_contiene_date_nazionali_verificate():
    giorni = festivita("IT", 2026, 2026)

    assert date(2026, 4, 6) in giorni
    assert date(2026, 10, 4) in giorni
    assert date(2026, 12, 25) in giorni
    assert giorni_weekend("IT") == [5, 6]


def test_festivita_unisce_piu_anni_in_ordine_e_restituisce_una_copia():
    giorni = festivita("IT", 2024, 2025)

    assert giorni == sorted(giorni)
    assert giorni[0] == date(2024, 1, 1)
    assert giorni[-1] == date(2025, 12, 26)
    giorni.clear()
    assert FESTIVITA_PER_PAESE["IT"][2024]


@pytest.mark.parametrize("funzione", [lambda: festivita("XX", 2026, 2026), lambda: giorni_weekend("XX")])
def test_codice_paese_inesistente_solleva_value_error(funzione):
    with pytest.raises(ValueError, match="Codice Paese non supportato"):
        funzione()


def test_range_non_disponibile_o_invertito_solleva_value_error():
    with pytest.raises(ValueError, match="Anni non disponibili"):
        festivita("IT", 2023, 2024)
    with pytest.raises(ValueError, match="anno_da"):
        festivita("IT", 2026, 2025)


def test_giorni_lavorativi_tra_stessa_data_restituisce_zero():
    assert giorni_lavorativi_tra(date(2026, 1, 7), date(2026, 1, 7), [5, 6], []) == 0


def test_giorni_lavorativi_tra_attraversa_il_weekend():
    assert giorni_lavorativi_tra(date(2026, 1, 9), date(2026, 1, 12), [5, 6], []) == 1


def test_giorni_lavorativi_tra_esclude_una_festivita_nazionale():
    senza_festivita = giorni_lavorativi_tra(
        date(2026, 12, 23), date(2026, 12, 28), [5, 6], []
    )
    con_festivita = giorni_lavorativi_tra(
        date(2026, 12, 23),
        date(2026, 12, 28),
        [5, 6],
        festivita("IT", 2026, 2026),
    )

    assert con_festivita == senza_festivita - 1


def test_giorni_lavorativi_tra_rifiuta_intervallo_invertito():
    with pytest.raises(ValueError, match="data_a"):
        giorni_lavorativi_tra(date(2026, 1, 8), date(2026, 1, 7), [5, 6], [])
