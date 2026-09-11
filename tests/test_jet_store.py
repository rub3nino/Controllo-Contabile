from datetime import date
from decimal import Decimal
from time import perf_counter

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
        soglia_da_investigare_effettiva=4,
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


def test_iter_export_results_restituisce_tutte_le_righe_una_volta(tmp_path):
    store = JetStore(tmp_path / "jet.sqlite3")
    pratica = PraticaJet(id="p", client="C", period="2026", status="analizzato",
                         numero_registrazioni=20_003, numero_da_investigare=6_668)
    store.replace_analysis(pratica, (_pair(i) for i in range(20_003)), [], [])

    items = list(store.iter_export_results("p", batch_size=997))
    identifiers = [int(item.riga.identificativo_registrazione) for item in items]

    assert identifiers == list(range(20_003))
    assert len(set(identifiers)) == 20_003


def test_iter_export_results_cresce_quasi_linearmente(tmp_path):
    store = JetStore(tmp_path / "jet.sqlite3")
    for pratica_id, size in (("p10", 10_000), ("p50", 50_000)):
        pratica = PraticaJet(id=pratica_id, client="C", period="2026", status="analizzato",
                             numero_registrazioni=size, numero_da_investigare=(size + 2) // 3)
        store.replace_analysis(pratica, (_pair(i) for i in range(size)), [], [])

    started = perf_counter()
    assert sum(1 for _ in store.iter_export_results("p10")) == 10_000
    elapsed_10k = perf_counter() - started

    started = perf_counter()
    assert sum(1 for _ in store.iter_export_results("p50")) == 50_000
    elapsed_50k = perf_counter() - started

    assert elapsed_50k / elapsed_10k < 10
