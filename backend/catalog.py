from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "regole" / "schema.yaml"
MASTER_XLSX = ROOT / "Template_MASTER.xlsx"

ITEM_LABELS = {
    "A.1": "Cambiamenti SCI / sistema contabile-amministrativo",
    "A.2": "Operazioni straordinarie, contratti, passività potenziali",
    "A.3": "Cartelle, avvisi bonari, comunicazioni AE/INPS",
    "A.4": "Transazioni finanziarie non ordinarie",
    "B.1": "Bilancino di verifica",
    "B.2": "CE gestionale vs budget",
    "B.3": "Budget e cashflow",
    "B.4": "Libro giornale provvisorio / mastrini",
    "C.1": "Verbali assemblee soci",
    "C.2": "Verbali Consiglio di amministrazione",
    "C.3": "Verbali Collegio sindacale",
    "C.4": "Libro soci",
    "D.1": "Libro giornale definitivo (bollato)",
    "D.2": "Libro inventari",
    "D.3": "Registri IVA",
    "E.1": "Quietanze F24",
    "E.2": "Fondi previdenziali",
    "E.3": "LIPE — liquidazione periodica IVA",
    "E.4": "Dichiarazione annuale IVA",
    "E.5": "Intrastat",
    "F.1": "Estratti conto bancari",
    "F.2": "Riconciliazioni bancarie",
    "F.3": "Centrale Rischi",
    "G.1": "Cedolini / LUL / prima nota personale",
    "G.2": "Contabile pagamento stipendi",
}

SECTION_TITLES = {
    "A": "Sistema di controllo interno",
    "B": "Libri obbligatori",
    "C": "Adempimenti tributari e previdenziali",
    "D": "Test su rilevazioni contabili",
    "E": "Disponibilità liquide",
    "F": "Verbali organi sociali",
    "G": "Analisi situazione contabile",
    "H": "Colloqui con la Direzione",
    "I": "Operazioni particolarmente significative",
}

# Testo per l'interfaccia: titolo Excel + spiegazione in italiano semplice.
SECTION_HELP = {
    "A": {
        "blurb": "Come è organizzata l'azienda e se procedure o organigramma sono cambiati.",
        "look_for": "Organigramma, mail sulle procedure, cartelle e avvisi, fatti straordinari.",
    },
    "B": {
        "blurb": "Controlla che i libri contabili e fiscali siano aggiornati.",
        "look_for": "Libro giornale, libro inventari, registri IVA.",
    },
    "C": {
        "blurb": "Verifica F24, IVA periodica, fondi e pagamenti del personale.",
        "look_for": "Quietanze F24, LIPE, fondi previdenziali, Intrastat, cedolini, bonifico stipendi.",
    },
    "D": {
        "blurb": "Campiona le registrazioni del giornale. Si può saltare se questo trimestre non serve.",
        "look_for": "Libro giornale o mastrini in formato testo.",
    },
    "E": {
        "blurb": "Confronta i saldi in banca con la contabilità.",
        "look_for": "Estratti conto, riconciliazioni bancarie, Centrale Rischi.",
    },
    "F": {
        "blurb": "Legge i verbali per fatti che impattano i conti.",
        "look_for": "Verbali assemblee, CdA, Collegio sindacale, libro soci.",
    },
    "G": {
        "blurb": "Analizza il bilancino e il confronto con budget e cashflow.",
        "look_for": "Bilancino di verifica, CE vs budget, budget e cashflow.",
    },
    "H": {
        "blurb": "Appunti dei colloqui con l'azienda. Si compila a mano.",
        "look_for": "Note o verbali dei colloqui con la Direzione.",
    },
    "I": {
        "blurb": "Segnala operazioni straordinarie o movimenti anomali.",
        "look_for": "Contratti, atti M&A, nuovi prestiti, transazioni extra-business.",
    },
}

SECTION_ITEMS = {
    "A": ["A.1", "A.2", "A.3"],
    "B": ["B.4", "D.1", "D.2", "D.3"],
    "C": ["E.1", "E.2", "E.3", "E.4", "E.5", "G.1", "G.2"],
    "D": ["B.4"],
    "E": ["F.1", "F.2", "F.3", "A.4"],
    "F": ["C.1", "C.2", "C.3", "C.4"],
    "G": ["B.1", "B.2", "B.3"],
    "H": [],
    "I": ["A.2", "A.4"],
}

DOCUMENT_NEED = {
    "A.1": "Serve una nota o file su cambiamenti del sistema di controllo interno / organigramma.",
    "A.2": "Servono atti o mail su operazioni straordinarie, contratti, passività potenziali.",
    "A.3": "Servono cartelle, avvisi bonari o comunicazioni AE/INPS del trimestre.",
    "A.4": "Servono evidenze di transazioni finanziarie non ordinarie (nuovi prestiti, M&A).",
    "B.1": "Serve il bilancino di verifica (Excel o TXT) alla data di fine trimestre.",
    "B.2": "Serve il conto economico gestionale confrontato con il budget.",
    "B.3": "Servono il budget e, se c'è, il cashflow a 6–12 mesi.",
    "B.4": "Serve l'estrazione libro giornale provvisorio o i mastrini in TXT/Excel del trimestre.",
    "C.1": "Manca la copia dei verbali delle assemblee soci.",
    "C.2": "Manca la copia dei verbali del Consiglio di amministrazione.",
    "C.3": "Manca la copia dei verbali del Collegio sindacale.",
    "C.4": "Mancano annotazioni o visure del libro soci.",
    "D.1": "Serve il libro giornale definitivo (bollato), distinto dal provvisorio.",
    "D.2": "Serve il libro inventari aggiornato.",
    "D.3": "Servono i registri IVA (acquisti, vendite, corrispettivi) del periodo.",
    "E.1": "Servono le quietanze F24 del trimestre (file con F24 o quietanza nel nome).",
    "E.2": "Servono le ricevute fondi (Alifond, FASA, Previndai, Enasarco, FASI, Anima…).",
    "E.3": "Manca la LIPE (comunicazione liquidazione periodica IVA).",
    "E.4": "Manca la dichiarazione IVA annuale o la ricevuta di trasmissione.",
    "E.5": "Manca l'Intrastat, se l'azienda è tenuta a presentarlo.",
    "F.1": "Servono gli estratti conto bancari di fine trimestre.",
    "F.2": "Mancano le riconciliazioni bancarie / dump DocFinance saldi.",
    "F.3": "Manca la Centrale Rischi.",
    "G.1": "Servono cedolini, LUL o prima nota del personale (non solo il contabile di pagamento).",
    "G.2": "Serve il contabile di pagamento stipendi del trimestre.",
}

EXTRA_HINTS = {
    "F.1": [
        "estratto", "estratti", "e/c", "iban", "saldo contabile",
        "intesa", "unicredit", "unicr", "bpm", "bnl", "mps", "paschi", "piemonte",
        "credem", "deutsche", "mediobanca", "allianz", "bper", "passadore",
        "sella", "asti", "commerz", "biver",
    ],
    "E.1": ["f24", "quietanza", "delega unica", "agenzia entrate", "protocollo telematico"],
    "B.1": ["bilancino", "trial balance", "piano dei conti", "saldo dare", "saldo avere"],
    "C.2": ["cda", "consiglio di amministrazione", "verbale cda"],
    "C.1": ["assemblea", "verbale assemblea"],
    "C.3": ["collegio sindacale", "sindaci"],
    "D.3": ["registro iva", "iva acquisti", "iva vendite"],
    "B.4": ["libro giornale", "mastrino", "mastrini"],
    "G.1": ["cedolino", "cedolone", "lul", "libro unico"],
}


@lru_cache(maxsize=1)
def load_schema() -> dict:
    with SCHEMA_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def checklist_items() -> list[dict]:
    schema = load_schema()
    items = []
    for raw in schema["richiesta_doc"]["items"]:
        item = dict(raw)
        item["label"] = ITEM_LABELS.get(item["id"], item["id"])
        hints = list(item.get("classify_hints") or [])
        hints.extend(EXTRA_HINTS.get(item["id"], []))
        item["hints"] = [h.lower() for h in hints]
        items.append(item)
    return items


def item_by_id(item_id: str) -> dict | None:
    for item in checklist_items():
        if item["id"] == item_id:
            return item
    return None
