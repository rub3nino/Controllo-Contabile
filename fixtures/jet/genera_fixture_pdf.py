"""Rigenera i fixture PDF testuali/scansionati usati dai test JET."""

from pathlib import Path

import pymupdf

ROOT = Path(__file__).parent


def main() -> None:
    righe = (ROOT / "giornale_colonne_fisse.txt").read_text(
        encoding="utf-8"
    ).splitlines()
    documento = pymupdf.open()
    pagina = documento.new_page(width=842, height=595)
    for indice, riga in enumerate(righe):
        pagina.insert_text(
            (24, 36 + indice * 11), riga, fontname="cour", fontsize=8
        )
    documento.save(ROOT / "giornale_colonne_fisse.pdf")
    documento.close()

    scansione = pymupdf.open()
    scansione.new_page(width=842, height=595)
    scansione.save(ROOT / "giornale_scansionato.pdf")
    scansione.close()


if __name__ == "__main__":
    main()
