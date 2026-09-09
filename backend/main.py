from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .catalog import DOCUMENT_NEED, ITEM_LABELS, SECTION_HELP, SECTION_TITLES, checklist_items
from .domain.api import router as domain_router
from .jet.api import router as jet_router
from .errors import UserError, from_exception
from .models import DocumentPatch, ItemPatch, LinkFolderIn, PraticaIn
from .pipeline import engine

app = FastAPI(title="Quadra", version="0.2.0")
app.include_router(domain_router)
app.include_router(jet_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _state():
    return json.loads(engine.state.model_dump_json())


def _raise_user(exc: BaseException) -> None:
    err = from_exception(exc)
    raise HTTPException(status_code=400, detail=err.as_dict()) from exc


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/catalog")
def catalog():
    return {
        "items": [
            {
                "id": it["id"],
                "label": ITEM_LABELS.get(it["id"], it["id"]),
                "row": it["row"],
                "group": it["group"],
                "need": DOCUMENT_NEED.get(it["id"], ""),
            }
            for it in checklist_items()
        ],
        "sections": [
            {
                "id": k,
                "title": v,
                "blurb": SECTION_HELP[k]["blurb"],
                "look_for": SECTION_HELP[k]["look_for"],
            }
            for k, v in SECTION_TITLES.items()
        ],
    }


@app.get("/api/state")
def state():
    return _state()


@app.post("/api/pratica")
def set_pratica(body: PraticaIn):
    engine.set_pratica(body)
    return _state()


@app.post("/api/ingest")
async def ingest(
    files: list[UploadFile] = File(...),
    rels: list[str] = Form(default=[]),
):
    if not engine.state.pratica:
        _raise_user(
            UserError(
                "Manca la pratica",
                "Compila cliente e trimestre a sinistra, poi scegli una cartella.",
                ["Nome cliente", "Cartella documenti"],
            )
        )
    rels = list(rels or [])
    while len(rels) < len(files):
        rels.append(files[len(rels)].filename or f"file-{len(rels)}")
    items: list[tuple[str, bytes]] = []
    for upload, rel in zip(files, rels, strict=False):
        items.append((rel, await upload.read()))
    try:
        n = engine.ingest_uploads(items)
    except Exception as e:
        _raise_user(e)
    payload = _state()
    payload["uploaded"] = n
    return payload


@app.post("/api/ingest-link")
def ingest_link(body: LinkFolderIn):
    if not engine.state.pratica:
        _raise_user(
            UserError(
                "Manca la pratica",
                "Compila cliente e trimestre a sinistra, poi collega il percorso visibile al server.",
                ["Nome cliente", "Cartella documenti"],
            )
        )
    try:
        engine.link_folder(body.path)
    except Exception as e:
        _raise_user(e)
    return _state()


@app.post("/api/scan")
def scan():
    if not engine.state.pratica:
        _raise_user(
            UserError(
                "Manca la pratica",
                "Compila cliente e trimestre, scegli una cartella, poi premi Scansiona.",
                ["Nome cliente", "Cartella documenti"],
            )
        )
    try:
        engine.scan()
    except Exception as e:
        _raise_user(e)
    return _state()


@app.patch("/api/documents/{doc_id}")
def patch_document(doc_id: str, body: DocumentPatch):
    try:
        engine.patch_doc(doc_id, body.item_id, body.skip)
    except KeyError:
        raise HTTPException(404, "Documento non trovato")
    return _state()


@app.patch("/api/items/{item_id}")
def patch_item(item_id: str, body: ItemPatch):
    try:
        engine.patch_item(item_id, body.status)
    except KeyError:
        raise HTTPException(404, "Voce checklist non trovata")
    except RuntimeError as e:
        _raise_user(e)
    return _state()


@app.post("/api/run")
def run():
    if not engine.state.pratica:
        _raise_user(
            UserError(
                "Manca la pratica",
                "Compila cliente e trimestre prima di avviare la compilazione.",
                ["Nome cliente"],
            )
        )
    try:
        if not engine.state.documents:
            engine.scan()
    except Exception as e:
        _raise_user(e)

    def gen():
        for ev in engine.run():
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/api/export/xlsx")
def export_xlsx():
    path = engine.state.xlsx_path
    if not path or not Path(path).exists():
        raise HTTPException(404, "Nessun Excel compilato")
    return FileResponse(path, filename=Path(path).name)


@app.get("/api/export/mancanti")
def export_mancanti():
    out = engine.state.output_dir
    if not out:
        raise HTTPException(404, "Nessun output")
    path = Path(out) / "mancanti.md"
    if not path.exists():
        raise HTTPException(404, "File mancanti assente")
    return FileResponse(path, filename="mancanti.md")


dist = Path(__file__).resolve().parents[1] / "ui" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="ui")
