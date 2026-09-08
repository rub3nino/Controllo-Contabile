from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from .catalog import ITEM_LABELS, checklist_items
from .extract import extract_file
from .models import DocumentOut
from .paths import doc_id, is_junk_name, posix_rel, to_posix

SKIP_DIR_NAMES = {".git", "node_modules", "__pycache__", ".venv", "output", "0_Richiesta", "0_richiesta", "storage"}
ALLOWED_EXT = {
    ".pdf", ".xlsx", ".xls", ".xlsm", ".csv", ".txt", ".xml", ".json",
    ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".doc", ".docx",
}

# (item_id, score, needles) — needles matched on "relpath / filename"
NAME_RULES: list[tuple[str, float, tuple[str, ...]]] = [
    ("E.1", 10, ("f24", "quietanza", "imposta di bollo", "imposta bollo")),
    ("E.2", 10, ("enasarco", "previmoda", "sanimoda", "alifond", "fasa", "previndai", "fasi", "anima", "previdenza complementare", "versamenti fondi", "ricevute fondi")),
    ("E.3", 10, ("lipe", "liquidazione periodica")),
    ("E.4", 8, ("dichiarazione iva", "iva annuale", "ricevuta di trasmissione", "d.iva", "d. iva")),
    ("E.5", 8, ("intrastat",)),
    ("G.2", 11, ("contabile pag", "pag stip", "pagamento stipendi", "contabile stip")),
    ("D.3", 7, ("registro iva", "iva acquisti", "iva vendite", "registro corrispettivi", "registro riepilogativo", "registro ai", "registro ap", "registro ar", "registro ni", "registro va", "registro vg", "registro vi", "registro vr")),
    ("G.1", 8, (
        "personale aprile", "personale maggio", "personale giugno", "personale luglio",
        "personale agosto", "personale settembre", "personale ottobre", "personale novembre",
        "personale dicembre", "personale gen",
        "welfare", "cedolin", "cedolone", "amm_coll", "libro unico", "lul",
    )),
    ("B.4", 9, ("giornale provv", "mastrini")),
    ("B.1", 8, ("bilancino", "bilancio sap", "bil. verifica", "trial balance")),
    ("F.2", 10, ("saldi_coge", "coge_saldi", "situazione_banche", "df_situazione", "docfinance", "riconciliaz")),
    ("F.3", 8, ("centrale rischi", "centrale_rischi")),
    ("C.1", 8, ("assemblea", "app.ne bil", "app.ne bilancio")),
    ("C.2", 7, ("cda", "consiglio di amministrazione", "esame 1", "quater", "marcante")),
    ("C.3", 7, ("collegio sindacale", "sindaci")),
    ("C.4", 6, ("libro soci",)),
    ("D.1", 12, ("giornale definitivo", "giornale bollato", "libro giornale")),
    ("F.1", 6, (
        "estratto", "estratti", "e/c",
        "bnl_", "credem", "sella", "unicr", "unicredit", "intesa",
        "asti_", "commerz", "biver", "passadore", "bpm",
        "deutsche", "bper", "mediobanca", "allianz", "piemonte", "mps",
    )),
]

PATH_RULES: list[tuple[str, float, tuple[str, ...]]] = [
    ("G.2", 3.5, ("/g.2/",)),
    ("G.1", 3.5, ("/g.1/", "g personale")),
    ("F.1", 3.0, ("f_banche", "f banche", "/banche/", "ec 30.")),
    ("E.1", 1.5, ("e_adempimenti",)),
    ("C.2", 1.2, ("c_libri sociali", "c_libri")),
    ("B.1", 2.0, ("b_bilancio",)),
    ("D.1", 4.0, ("d libri fiscali", "libri fiscali")),
    ("D.3", 2.0, ("d libri fiscali", "libri fiscali")),
    ("G.1", 1.5, ("g_personale",)),
]


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower()


def classify_text(name: str, text: str, relpath: str = "") -> tuple[str | None, float, str]:
    name_n = _norm(name)
    path_n = _norm(to_posix(relpath))
    blob = f"{path_n} {name_n}"
    text_n = _norm(text[:6000]) if text else ""

    scores: dict[str, float] = {}
    name_hit: dict[str, bool] = {}

    for item_id, pts, needles in NAME_RULES:
        for n in needles:
            if _norm(n) in blob:
                scores[item_id] = scores.get(item_id, 0) + pts
                name_hit[item_id] = True
                break

    for item_id, pts, needles in PATH_RULES:
        for n in needles:
            if _norm(n) in path_n:
                scores[item_id] = scores.get(item_id, 0) + pts
                name_hit.setdefault(item_id, False)
                break

    # G.2 folder copies of payroll files stay G.1 if the filename is payroll
    if scores.get("C.1", 0) >= 8 and scores.get("C.3", 0):
        scores["C.3"] = min(scores["C.3"], 3)
    if scores.get("C.1", 0) >= 8 and "collegio" in name_n:
        scores["C.1"] = max(scores["C.1"], scores.get("C.3", 0) + 1)

    # F_Banche supporting files are F.2, not e/c
    if scores.get("F.2", 0) >= 10:
        scores["F.1"] = min(scores.get("F.1", 0), 1)

    # Giornale bollato/definitivo è D.1, i mastrini restano B.4
    if "mastrini" in name_n:
        scores["B.4"] = max(scores.get("B.4", 0), 16)
        scores["D.1"] = min(scores.get("D.1", 0), 2)
    elif "giornale" in name_n and re.search(r"definitiv|bollat", name_n):
        scores["D.1"] = max(scores.get("D.1", 0), 16)
        scores["B.4"] = min(scores.get("B.4", 0), 3)

    for item in checklist_items():
        iid = item["id"]
        for hint in item["hints"]:
            h = _norm(hint)
            if not h:
                continue
            if h in name_n:
                scores[iid] = scores.get(iid, 0) + 2.5
                name_hit[iid] = True
            elif h in text_n:
                scores[iid] = scores.get(iid, 0) + 0.8
                name_hit.setdefault(iid, False)

    if not scores:
        return None, 0.0, "unclassified"
    best_id = max(scores, key=scores.get)
    best = scores[best_id]
    if best <= 0:
        return None, 0.0, "unclassified"
    conf = min(0.95, 0.40 + best * 0.06)
    how = "filename" if name_hit.get(best_id) else ("folder" if best_id in scores else "content")
    if not name_hit.get(best_id) and text_n:
        how = "content"
    return best_id, conf, how


def scan_folder(folder: str, pratica_id: str = "") -> list[DocumentOut]:
    root = Path(folder).expanduser().resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"Cartella non trovata: {root}")
    docs: list[DocumentOut] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if is_junk_name(path.name):
            continue
        if re.search(r"^template wps|template.*wps|wps verifica trimestrale|documenti mancanti", path.name, re.I):
            continue
        hidden = False
        for parent in path.parents:
            if parent == root:
                break
            if parent.name in SKIP_DIR_NAMES:
                hidden = True
                break
        if hidden:
            continue
        if path.suffix.lower() not in ALLOWED_EXT:
            continue
        rel = posix_rel(root, path)
        item_id, conf, how = classify_text(path.name, "", rel)
        text, method = "", "filename"
        if not item_id or conf < 0.55:
            # Solo testo nativo (PDF digitale, TXT, Excel). Mai OCR in scansione:
            # sui PDF scansionati l'OCR parte dopo, in compilazione.
            text, method = extract_file(path, ocr=False)
            item_id, conf, how = classify_text(path.name, text, rel)
        excerpt = " ".join(text.split())[:280] if text else rel
        docs.append(
            DocumentOut(
                id=doc_id(pratica_id, rel),
                name=path.name,
                path=str(path),
                rel=rel,
                ext=path.suffix.lower(),
                size=path.stat().st_size,
                item_id=item_id,
                item_label=ITEM_LABELS.get(item_id) if item_id else None,
                confidence=round(conf, 2),
                method=how if item_id else method,
                excerpt=excerpt,
            )
        )
    return docs
