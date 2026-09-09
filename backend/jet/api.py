"""API operativa del Journal Entry Testing."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from backend.jet.criteri import calcola_frequenza_conti, valuta_riga
from backend.jet.ingest import leggi_righe_xlsx, mappa_righe_giornale
from backend.jet.models import ParametriClienteJet, RigaGiornale
from backend.jet.pratica import (
    CreaPraticaJet, IntervalloSequenzaJet, MappaturaJet, PaginaRisultatiJet, PraticaJet,
)
from backend.jet.sequenza import verifica_sequenza
from backend.jet.store import JetStore
from backend.workspace import output_dir, storage_root, write_inbox_file

router = APIRouter(prefix="/api/jet", tags=["jet"])


def _store() -> JetStore:
    return JetStore(storage_root() / "jet.sqlite3")


def _pratica_or_404(pratica_id: str) -> PraticaJet:
    pratica = _store().get_pratica(pratica_id)
    if pratica is None:
        raise HTTPException(status_code=404, detail="Pratica JET non trovata")
    return pratica


def _file_path(pratica: PraticaJet) -> Path:
    if not pratica.file_originale_nome:
        raise HTTPException(status_code=409, detail="Carica prima il file Excel del libro giornale")
    return storage_root() / "pratiche" / pratica.id / "inbox" / pratica.file_originale_nome


def _raw_rows(pratica: PraticaJet) -> list[dict]:
    try:
        return leggi_righe_xlsx(_file_path(pratica))
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=f"File Excel non leggibile: {exc}") from exc


@router.post("/pratiche", response_model=PraticaJet, status_code=201)
def create_pratica(body: CreaPraticaJet):
    pratica = PraticaJet(client=body.client.strip(), period=body.period.strip())
    _store().save_pratica(pratica)
    return pratica


@router.get("/pratiche", response_model=list[PraticaJet])
def list_pratiche():
    return _store().list_pratiche()


@router.get("/pratiche/{pratica_id}", response_model=PraticaJet)
def get_pratica(pratica_id: str):
    return _pratica_or_404(pratica_id)


@router.put("/pratiche/{pratica_id}/parametri", response_model=PraticaJet)
def put_parametri(pratica_id: str, body: ParametriClienteJet):
    pratica = _pratica_or_404(pratica_id)
    status = "file_caricato" if pratica.file_originale_nome else "parametri_configurati"
    pratica = pratica.model_copy(update={
        "parametri": body, "status": status, "analizzato_at": None,
        "numero_registrazioni": 0, "numero_da_investigare": 0,
    })
    _store().save_pratica(pratica)
    return pratica


@router.post("/pratiche/{pratica_id}/file")
async def upload_file(pratica_id: str, file: UploadFile = File(...)):
    pratica = _pratica_or_404(pratica_id)
    filename = Path(file.filename or "giornale.xlsx").name
    if Path(filename).suffix.lower() != ".xlsx":
        raise HTTPException(status_code=400, detail="In questa fase è accettato solo un file .xlsx")
    path = write_inbox_file(pratica.id, filename, await file.read())
    try:
        rows = leggi_righe_xlsx(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"File Excel non leggibile: {exc}") from exc
    headers = list(rows[0]) if rows else []
    if not headers:
        raise HTTPException(status_code=400, detail="Il file Excel non contiene intestazioni e righe dati")
    pratica = pratica.model_copy(update={
        "file_originale_nome": filename, "mappatura": None, "status": "file_caricato",
        "analizzato_at": None, "numero_registrazioni": 0, "numero_da_investigare": 0,
    })
    _store().save_pratica(pratica)
    return {"pratica": pratica, "intestazioni": headers}


@router.get("/pratiche/{pratica_id}/intestazioni")
def get_headers(pratica_id: str):
    pratica = _pratica_or_404(pratica_id)
    rows = _raw_rows(pratica)
    return {"intestazioni": list(rows[0]) if rows else []}


@router.put("/pratiche/{pratica_id}/mappatura", response_model=PraticaJet)
def put_mappatura(pratica_id: str, body: MappaturaJet):
    pratica = _pratica_or_404(pratica_id)
    rows = _raw_rows(pratica)
    headers = set(rows[0]) if rows else set()
    sconosciute = sorted(set(body.mappatura.values()) - headers)
    if sconosciute:
        raise HTTPException(status_code=400, detail=f"Colonne Excel non trovate: {', '.join(sconosciute)}")
    campi_ammessi = set(RigaGiornale.model_fields) | {"importo_dare", "importo_avere"}
    campi_sconosciuti = sorted(set(body.mappatura) - campi_ammessi)
    if campi_sconosciuti:
        raise HTTPException(status_code=400, detail=f"Campi JET non riconosciuti: {', '.join(campi_sconosciuti)}")
    required = {"identificativo_registrazione", "data_effettiva"}
    if not required <= body.mappatura.keys():
        raise HTTPException(status_code=400, detail="La mappatura richiede identificativo_registrazione e data_effettiva")
    if not ({"importo_netto", "importo_dare", "importo_avere"} & body.mappatura.keys()):
        raise HTTPException(status_code=400, detail="Mappare importo_netto oppure almeno una colonna Dare/Avere")
    pratica = pratica.model_copy(update={
        "mappatura": body.mappatura, "status": "file_caricato", "analizzato_at": None,
        "numero_registrazioni": 0, "numero_da_investigare": 0,
    })
    _store().save_pratica(pratica)
    return pratica


@router.post("/pratiche/{pratica_id}/analizza", response_model=PraticaJet)
def analyze(pratica_id: str):
    pratica = _pratica_or_404(pratica_id)
    missing = []
    if pratica.parametri is None: missing.append("parametri")
    if pratica.file_originale_nome is None: missing.append("file Excel")
    if pratica.mappatura is None: missing.append("mappatura colonne")
    if missing:
        raise HTTPException(status_code=409, detail=f"Prima di analizzare completa: {', '.join(missing)}")
    try:
        righe = mappa_righe_giornale(_raw_rows(pratica), pratica.mappatura)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Errore nella mappatura dei dati: {exc}") from exc
    frequenze = calcola_frequenza_conti(righe)
    esiti = [valuta_riga(r, pratica.parametri, frequenze) for r in righe]
    mancanti, intervalli_raw = verifica_sequenza(righe)
    intervalli = [IntervalloSequenzaJet(
        precedente=a, successivo=b, quantita_mancanti=n
    ) for a, b, n in intervalli_raw]
    pratica = pratica.model_copy(update={
        "status": "analizzato",
        "analizzato_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "numero_registrazioni": len(esiti),
        "numero_da_investigare": sum(e.da_investigare for e in esiti),
    })
    _store().replace_analysis(pratica, zip(righe, esiti), mancanti, intervalli)
    return pratica


def _ensure_analyzed(pratica_id: str) -> PraticaJet:
    pratica = _pratica_or_404(pratica_id)
    if pratica.status != "analizzato":
        raise HTTPException(status_code=409, detail="La pratica deve essere analizzata prima di consultare i risultati")
    return pratica


@router.get("/pratiche/{pratica_id}/risultati", response_model=PaginaRisultatiJet)
def results(
    pratica_id: str, da_investigare: bool | None = None,
    conto_contabile: str | None = None, punteggio_minimo: int | None = Query(None, ge=0),
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
):
    _ensure_analyzed(pratica_id)
    items, total = _store().query_results(
        pratica_id, da_investigare=da_investigare, conto_contabile=conto_contabile,
        punteggio_minimo=punteggio_minimo, limit=page_size, offset=(page - 1) * page_size,
    )
    return PaginaRisultatiJet(
        items=items, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/pratiche/{pratica_id}/sequenza")
def sequence(pratica_id: str):
    _ensure_analyzed(pratica_id)
    mancanti, intervalli = _store().sequence(pratica_id)
    return {"mancanti": mancanti, "intervalli_non_enumerati": intervalli}


FLAG_LABELS = {
    "flag_profit_impact": "Impatto sull'utile", "flag_oltre_dieci_volte_media": "> 10× media",
    "flag_sopra_performance_materiality": "Oltre performance materiality",
    "flag_importo_cifra_tonda": "Importo a cifra tonda", "flag_weekend": "Weekend",
    "flag_festivita": "Festività", "flag_fuori_orario": "Fuori orario",
    "flag_backdated": "Registrazione retrodatata", "flag_staff_non_autorizzato": "Staff non autorizzato",
    "flag_parte_correlata": "Parte correlata", "flag_descrizione_vuota": "Descrizione vuota",
    "flag_conto_insolito_raro": "Conto insolito/raro",
    "flag_conto_infragruppo_parte_correlata": "Conto infragruppo/parte correlata",
}


@router.get("/pratiche/{pratica_id}/export.xlsx")
def export_results(
    pratica_id: str, da_investigare: bool | None = None,
    conto_contabile: str | None = None, punteggio_minimo: int | None = Query(None, ge=0),
):
    pratica = _ensure_analyzed(pratica_id)
    wb = Workbook(write_only=False)
    ws = wb.active
    ws.title = "Risultati JET"
    headers = ["ID registrazione", "Numero documento", "Data effettiva", "Conto contabile",
               "Importo netto", "Descrizione", "Utente", "Punteggio", "Da investigare", "Criteri scattati"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="31556F")
    for item in _store().iter_export_results(
        pratica_id, da_investigare=da_investigare, conto_contabile=conto_contabile,
        punteggio_minimo=punteggio_minimo, batch_size=1000,
    ):
        r, e = item.riga, item.esito
        motivi = ", ".join(label for field, label in FLAG_LABELS.items() if getattr(e, field) is True)
        ws.append([r.identificativo_registrazione, r.numero_documento, r.data_effettiva,
                   r.conto_contabile, float(r.importo_netto), r.descrizione, r.utente,
                   e.punteggio_totale, "Sì" if e.da_investigare else "No", motivi])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    widths = [20, 20, 16, 20, 18, 45, 22, 12, 16, 60]
    for i, width in enumerate(widths, 1): ws.column_dimensions[chr(64 + i)].width = width
    nome_sicuro = re.sub(r"[^\w.-]+", "_", f"JET_{pratica.client}_{pratica.period}").strip("._")
    path = output_dir(pratica_id) / f"{nome_sicuro or 'JET_risultati'}.xlsx"
    wb.save(path)
    return FileResponse(path, filename=path.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
