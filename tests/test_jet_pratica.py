from backend.jet.models import ParametriClienteJet
from backend.jet.pratica import PraticaJet


def test_pratica_preserva_parametri_opzionali_none():
    pratica = PraticaJet(
        client="Cliente libero", period="2026",
        parametri=ParametriClienteJet(
            soglia_da_investigare=4,
            punteggio_profit_impact=1, punteggio_oltre_dieci_volte_media=1,
            punteggio_sopra_performance_materiality=1, punteggio_importo_cifra_tonda=1,
            punteggio_weekend=1, punteggio_festivita=1, punteggio_fuori_orario=1,
            punteggio_backdated=1, punteggio_staff_non_autorizzato=1,
            punteggio_parte_correlata=1, punteggio_descrizione_vuota=1,
        ),
    )
    restored = PraticaJet.model_validate_json(pratica.model_dump_json())
    assert restored.parametri.valore_medio_registrazione is None
    assert restored.parametri.staff_autorizzato is None
    assert restored.parametri.punteggio_conto_insolito_raro is None
