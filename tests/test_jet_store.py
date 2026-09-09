from datetime import date
from decimal import Decimal

from backend.jet.models import EsitoRigaJet, RigaGiornale
from backend.jet.pratica import PraticaJet
from backend.jet.store import JetStore


def _pair(i: int):
    riga = RigaGiornale(
        data_effettiva=date(2026, 1, 1), identificativo_registrazione=str(i),
        importo_netto=Decimal(i), conto_contabile=f"C{i % 7}",
    )
    esito = EsitoRigaJet(
        identificativo_registrazione=str(i), flag_profit_impact=None,
        flag_oltre_dieci_volte_media=None, flag_sopra_performance_materiality=None,
        flag_importo_cifra_tonda=False, flag_weekend=None, flag_festivita=None,
        flag_fuori_orario=None, flag_backdated=None, flag_staff_non_autorizzato=None,
        flag_parte_correlata=None, flag_descrizione_vuota=False,
        punteggio_totale=i % 11, da_investigare=i % 3 == 0,
    )
    return riga, esito


def test_store_filtra_e_pagina_migliaia_di_righe_in_sql(tmp_path):
    store = JetStore(tmp_path / "jet.sqlite3")
    pratica = PraticaJet(id="p", client="C", period="2026", status="analizzato",
                         numero_registrazioni=2500, numero_da_investigare=834)
    store.replace_analysis(pratica, (_pair(i) for i in range(2500)), [], [])

    first, total = store.query_results("p", da_investigare=True, limit=37, offset=0)
    second, total2 = store.query_results("p", da_investigare=True, limit=37, offset=37)
    filtered, filtered_total = store.query_results(
        "p", conto_contabile="C2", punteggio_minimo=8, limit=200, offset=0
    )
    assert total == total2 == 834
    assert len(first) == len(second) == 37
    assert {x.riga.identificativo_registrazione for x in first}.isdisjoint(
        x.riga.identificativo_registrazione for x in second
    )
    assert filtered_total > 30
    assert all(x.riga.conto_contabile == "C2" and x.esito.punteggio_totale >= 8 for x in filtered)
