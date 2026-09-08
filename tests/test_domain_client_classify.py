"""Fase 2 — client_classify.scan_folder_for_client.

Due cose da dimostrare: (1) non regressione — senza extra_items il risultato
è identico a classify.scan_folder, byte per byte di ogni DocumentOut; (2) il
meccanismo funziona davvero su un caso reale (Collegio sindacale), non solo
compila.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.catalog import checklist_items
from backend.classify import scan_folder
from backend.domain import ClientCatalogItem, ClientConfig, scan_folder_for_client

FIXTURES_DOCS = ROOT / "fixtures" / "docs"
ALL_STANDARD_ITEMS = [it["id"] for it in checklist_items()]


def test_no_extra_items_is_identical_to_plain_scan_folder():
    plain = scan_folder(str(FIXTURES_DOCS), "e2e-test")

    cfg = ClientConfig(client_id="demo", display_name="Demo", applicable_items=ALL_STANDARD_ITEMS, extra_items=[])
    via_client = scan_folder_for_client(str(FIXTURES_DOCS), "e2e-test", cfg)

    assert [d.model_dump() for d in plain] == [d.model_dump() for d in via_client]


def test_extra_item_classifies_a_file_scan_folder_leaves_unclassified(tmp_path: Path):
    # Nota: NON uso qui un file "collegio sindacale" — l'ho provato mentre
    # scrivevo questo test e ho scoperto che backend.classify già lo
    # classifica come C.3 (Verbali Collegio sindacale, voce standard, stesse
    # parole chiave) PRIMA che questo modulo abbia una possibilità: scan_folder
    # vince sempre perché il secondo passaggio tocca solo file con item_id=None.
    # È un gap reale, segnalato nel riepilogo di questa fase, non un bug da
    # correggere silenziosamente qui (richiederebbe toccare backend/catalog.py
    # o cambiare la precedenza fra i due passaggi). Uso quindi un esempio
    # sintetico che NON collide con nessuna hint standard, per dimostrare il
    # meccanismo in isolamento.
    doc_path = tmp_path / "Certificazione ISO9001 2026.txt"
    doc_path.write_text("Certificazione di qualità ISO 9001:2015, rinnovo 2026.", encoding="utf-8")
    unrelated = tmp_path / "nota_generica.txt"
    unrelated.write_text("appunti vari, niente a che fare con nessuna voce di catalogo", encoding="utf-8")

    plain = scan_folder(str(tmp_path), "e2e-test")
    cert_plain = next(d for d in plain if d.name == doc_path.name)
    assert cert_plain.item_id is None  # scan_folder da solo non sa cos'è

    cfg = ClientConfig(
        client_id="demo", display_name="Demo", applicable_items=[],
        extra_items=[
            ClientCatalogItem(
                id="Q.1", label="Certificazione qualità ISO 9001", section="A",
                hints=["certificazione", "iso9001", "iso 9001"],
            )
        ],
    )
    via_client = scan_folder_for_client(str(tmp_path), "e2e-test", cfg)
    cert = next(d for d in via_client if d.name == doc_path.name)
    nota = next(d for d in via_client if d.name == unrelated.name)

    assert cert.item_id == "Q.1"
    assert cert.item_label == "Certificazione qualità ISO 9001"
    assert cert.method == "filename"  # "certificazione" è nel nome file
    assert nota.item_id is None  # il file non pertinente resta non classificato


def test_ferrero_collegio_sindacale_hints_are_shadowed_by_standard_catalog_c3(tmp_path: Path):
    # Documenta il gap scoperto sopra con il caso reale di ferrero.yaml:
    # un file che userebbe le hints di CS.1 (backend/domain/examples/ferrero.yaml)
    # viene sempre intercettato per primo da scan_folder come C.3, quindi
    # CS.1 in pratica non si attiva mai su un file con queste parole nel nome.
    # Se questo comportamento cambia (es. perché C.3 viene rimosso dal
    # catalogo standard, o la precedenza dei due passaggi viene rivista),
    # questo test lo segnala rompendosi.
    doc_path = tmp_path / "Libro verbali del Collegio Sindacale.pdf"
    doc_path.write_text("registro del collegio sindacale, ultima pagina compilata", encoding="utf-8")

    cfg = ClientConfig(
        client_id="demo", display_name="Demo", applicable_items=[],
        extra_items=[
            ClientCatalogItem(
                id="CS.1", label="Libro verbali del Collegio sindacale", section="F",
                hints=["collegio sindacale", "verbale collegio", "sindaci"],
            )
        ],
    )
    via_client = scan_folder_for_client(str(tmp_path), "e2e-test", cfg)
    doc = via_client[0]
    assert doc.item_id == "C.3"  # non "CS.1": scan_folder ha già deciso


def test_already_classified_document_is_not_overridden_by_extra_item(tmp_path: Path):
    # Un file che scan_folder classifica già (es. un F24) non deve essere
    # toccato dal secondo passaggio, anche se per assurdo il suo nome
    # contenesse anche una hint di una voce extra.
    doc_path = tmp_path / "F24 collegio sindacale 16.04.2026.txt"
    doc_path.write_text("quietanza F24 versamento 16/04/2026", encoding="utf-8")

    cfg = ClientConfig(
        client_id="demo", display_name="Demo", applicable_items=["E.1"],
        extra_items=[
            ClientCatalogItem(id="CS.1", label="Collegio", section="F", hints=["collegio sindacale"]),
        ],
    )
    via_client = scan_folder_for_client(str(tmp_path), "e2e-test", cfg)
    f24 = via_client[0]
    assert f24.item_id == "E.1"  # classificato da scan_folder, non sovrascritto
