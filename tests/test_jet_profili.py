from backend.jet.profilo import ProfiloEstrazione
from backend.jet.store import JetStore


def test_store_crud_e_matching_esatto_normalizzato(tmp_path):
    store = JetStore(tmp_path / "jet.sqlite3")
    profilo = ProfiloEstrazione(
        nome="Gestionale", riga_intestazione=0,
        intestazione_riferimento="  ID DATA IMPORTO  ",
        posizioni={"identificativo_registrazione": (0, 2)},
    )
    store.save_profilo(profilo)

    assert store.get_profilo(profilo.id) == profilo
    assert store.list_profili() == [profilo]
    assert store.find_profilo_by_intestazione(" ID DATA IMPORTO ") == profilo
    assert store.find_profilo_by_intestazione("ID DATA  IMPORTO") is None

    aggiornato = profilo.model_copy(update={"nome": "Gestionale aggiornato"})
    store.save_profilo(aggiornato)
    assert store.get_profilo(profilo.id).nome == "Gestionale aggiornato"
    assert store.delete_profilo(profilo.id) is True
    assert store.get_profilo(profilo.id) is None
