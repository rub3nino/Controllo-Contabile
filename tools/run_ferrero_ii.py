#!/usr/bin/env python3
"""End-to-end test on Gruppo Ferrero II trimestre 2026."""
from __future__ import annotations

import json
import os
import sys
import time
import traceback
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DOCS = Path(
    "/Volumes/SSDRubb/Controllo Contabile automatizzato/test/"
    "3. Controlli Contabili 2026/Gruppo Ferrero SpA/3.Gruppo Ferrero 2026/"
    "3_Revisione legale/II Trimestre 2026/Docs da analizzare"
)
OUT = ROOT / "output" / "ferrero-ii-2026"

os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(ROOT / "output" / ".paddlex"))
os.environ.setdefault("QUADRA_OCR_CACHE", str(ROOT / "output" / ".ocr-cache"))
os.environ.setdefault("QUADRA_OCR_DEVICE", "cpu")
os.environ.setdefault("QUADRA_OCR_PROVIDER", "paddle")


def log(msg: str) -> None:
    print(msg, flush=True)


def dump(name: str, payload) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    log(f"wrote {path}")
    return path


def classify_only():
    from backend.classify import classify_text, scan_folder
    from backend.catalog import ITEM_LABELS, SECTION_ITEMS, checklist_items
    from backend.extract import extract_pdf_text

    files = []
    by_item: dict[str, list] = defaultdict(list)
    for path in sorted(DOCS.rglob("*")):
        if not path.is_file() or path.name.startswith(("._", ".")):
            continue
        rel = str(path.relative_to(DOCS))
        item_id, conf, how = classify_text(path.name, "", rel)
        native_chars = None
        native_pages = None
        if path.suffix.lower() == ".pdf":
            try:
                text, method = extract_pdf_text(path, ocr=False)
                native_chars = len(text.strip())
                import pymupdf

                doc = pymupdf.open(str(path))
                native_pages = doc.page_count
                doc.close()
            except Exception as e:
                method = f"err:{e}"
                text = ""
        else:
            method = path.suffix.lower().lstrip(".") or "file"
            text = ""
        rec = {
            "name": path.name,
            "rel": rel,
            "ext": path.suffix.lower(),
            "size": path.stat().st_size,
            "item_id": item_id,
            "label": ITEM_LABELS.get(item_id) if item_id else None,
            "confidence": round(conf, 2),
            "method": how,
            "native_chars": native_chars,
            "pages": native_pages,
            "needs_ocr": bool(path.suffix.lower() == ".pdf" and (native_chars or 0) < 80),
        }
        files.append(rec)
        by_item[item_id or "UNCLASSIFIED"].append(path.name)

    expected_missing = [
        "B.1", "B.2", "B.3", "B.4",
        "C.1", "C.2", "C.3", "C.4",
        "E.2", "E.3",
        "G.1",
    ]
    present_ids = {k for k, v in by_item.items() if k != "UNCLASSIFIED" and v}
    catalog = [it["id"] for it in checklist_items()]
    human_vs_engine = []
    for iid in catalog:
        human = iid in expected_missing
        engine_has = iid in present_ids
        human_vs_engine.append({
            "id": iid,
            "label": ITEM_LABELS.get(iid, iid),
            "human_said_missing": human,
            "engine_found": engine_has,
            "files": by_item.get(iid, []),
            "mismatch": human == engine_has,
        })

    payload = {
        "folder": str(DOCS),
        "file_count": len(files),
        "classified": sum(1 for f in files if f["item_id"]),
        "unclassified": [f["name"] for f in files if not f["item_id"]],
        "needs_ocr": [f["name"] for f in files if f["needs_ocr"]],
        "by_item": {k: v for k, v in sorted(by_item.items())},
        "files": files,
        "section_coverage": {
            sec: {iid: iid in present_ids for iid in iids}
            for sec, iids in SECTION_ITEMS.items()
        },
        "human_missing_docx": expected_missing,
        "human_vs_engine": human_vs_engine,
    }
    dump("01_classificazione.json", payload)
    return payload


def run_scan():
    os.environ["QUADRA_OCR_PROVIDER"] = "none"
    from backend.classify import scan_folder

    t0 = time.time()
    log("SCAN start (OCR disabled — filename/folder only)")
    docs = scan_folder(str(DOCS))
    log(f"SCAN done in {time.time()-t0:.1f}s — {len(docs)} files")
    dump(
        "02_scan.json",
        [
            {
                "id": d.id,
                "name": d.name,
                "path": d.path,
                "item_id": d.item_id,
                "label": d.item_label,
                "confidence": d.confidence,
                "method": d.method,
                "excerpt": d.excerpt[:240],
                "size": d.size,
            }
            for d in docs
        ],
    )
    return docs


def run_fill(docs):
    os.environ["QUADRA_OCR_PROVIDER"] = "paddle"
    from backend.fill import Filler
    from backend.models import PraticaIn
    from backend.provenance import ProvenanceLog

    pratica = PraticaIn(
        client="Gruppo Ferrero SpA",
        period="II trimestre 2026",
        done_by="Quadra test",
        documents_dir=str(DOCS),
        activity_date="2026-09-08",
    )
    prov = ProvenanceLog(OUT / "provenienza.jsonl")
    filler = Filler(pratica, docs, OUT, prov)
    t0 = time.time()
    log("FILL start (Paddle OCR on scans: banche layout + F24 + libri)")
    try:
        xlsx = filler.fill_all([], [])
        log(f"FILL done in {time.time()-t0:.1f}s → {xlsx}")
        dump(
            "03_fill.json",
            {
                "xlsx": str(xlsx),
                "seconds": round(time.time() - t0, 1),
                "checklist": filler.checklist,
                "missing": filler.missing,
                "warnings": filler.warnings,
                "provenance_rows": len(prov.rows),
            },
        )
        dump("04_provenienza.json", [r.model_dump() for r in prov.rows])
        return filler, xlsx
    except Exception:
        log("FILL FAILED")
        log(traceback.format_exc())
        dump("03_fill_error.json", {"error": traceback.format_exc(), "seconds": round(time.time() - t0, 1)})
        raise


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    log(f"ROOT={ROOT}")
    log(f"DOCS={DOCS}")
    log(f"OUT={OUT}")
    classify_only()
    docs = run_scan()
    run_fill(docs)
    log("ALL DONE")


if __name__ == "__main__":
    main()
