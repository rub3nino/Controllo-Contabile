"""API HTTP del motore di dominio, separata dal flusso Excel legacy."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.domain.client_classify import scan_folder_for_client
from backend.domain.client_config_loader import list_clients, load_client_config
from backend.domain.continuity import carry_forward_open_findings
from backend.domain.ingest_adapter import documents_to_evidence
from backend.domain.excel_renderer import render_domain_workbook
from backend.domain.models import ClientConfig, HumanOverride, PraticaRecord
from backend.domain.store import EvidenceStore
from backend.domain.verification_engine import evaluate_pratica
from backend.workspace import new_pratica_id, output_dir, resolve_link, storage_root

router = APIRouter(prefix="/api/domain", tags=["domain"])


class ScanRequest(BaseModel):
    client_id: str
    period: str
    documents_dir: str
    pratica_id: str | None = None


class OverrideRequest(BaseModel):
    scope: Literal["item", "section"]
    target: str
    decision: Literal["✗", "N/A"]
    note: str = ""
    decided_by: str | None = None


def _store() -> EvidenceStore:
    return EvidenceStore(storage_root() / "domain.sqlite3")


def _config_or_404(client_id: str) -> ClientConfig:
    try:
        return load_client_config(client_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/clients")
def available_clients():
    return {"clients": list_clients()}


@router.post("/scan")
def scan(body: ScanRequest):
    store = _store()
    config = _config_or_404(body.client_id)
    pratica_id = body.pratica_id or new_pratica_id()
    existing = store.get_pratica(pratica_id)
    if existing is not None and existing.client_id != body.client_id:
        raise HTTPException(status_code=409, detail="La pratica appartiene a un altro cliente")

    try:
        documents_dir = resolve_link(body.documents_dir)
        documents = scan_folder_for_client(str(documents_dir), pratica_id, config)
    except (FileNotFoundError, PermissionError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    pratica = PraticaRecord(
        id=pratica_id,
        client_id=config.client_id,
        client=config.display_name,
        period=body.period,
        documents_dir=str(documents_dir),
        **({"created_at": existing.created_at} if existing else {}),
    )
    had_evidence = bool(store.evidence_for_pratica(pratica_id))
    carry_already_done = bool(store.findings_for_pratica(pratica_id))
    store.save_pratica(pratica)
    evidences = documents_to_evidence(pratica_id, documents, config)
    store.replace_evidences_for_pratica(pratica_id, evidences)
    carried = []
    if not carry_already_done:
        carried = carry_forward_open_findings(
            store,
            client=config.display_name,
            new_pratica_id=pratica_id,
            new_period=body.period,
        )

    return {
        "pratica": pratica,
        "documents_count": len(documents),
        "evidence_count": len(evidences),
        "evidences": evidences,
        "rescan": existing is not None or had_evidence,
        "carried_findings": carried,
    }


@router.get("/pratiche/{pratica_id}/verifiche")
def verifiche(pratica_id: str):
    store = _store()
    pratica = store.get_pratica(pratica_id)
    if pratica is None:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    config = _config_or_404(pratica.client_id)
    results = evaluate_pratica(
        pratica_id=pratica.id,
        client=pratica.client,
        period=pratica.period,
        evidences=store.evidence_for_pratica(pratica.id),
        overrides=store.human_overrides_for_pratica(pratica.id),
        client_config=config,
    )
    store.save_verification_results(list(results.values()))
    return {
        "pratica": pratica,
        "verifiche": results,
        "open_findings": store.open_findings_for_client(pratica.client),
    }


@router.post("/pratiche/{pratica_id}/overrides", status_code=201)
def create_override(pratica_id: str, body: OverrideRequest):
    store = _store()
    if store.get_pratica(pratica_id) is None:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    override = HumanOverride(pratica_id=pratica_id, **body.model_dump())
    store.save_human_override(override)
    return {"override": override}


@router.get("/pratiche/{pratica_id}/export.xlsx")
def export_workbook(pratica_id: str):
    store = _store()
    pratica = store.get_pratica(pratica_id)
    if pratica is None:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    verifiche = store.latest_verification_results(pratica_id)
    if not verifiche:
        raise HTTPException(
            status_code=409,
            detail="Nessuna verifica calcolata: richiama prima l'endpoint /verifiche.",
        )
    path = render_domain_workbook(
        pratica,
        verifiche,
        store.open_findings_for_client(pratica.client),
        output_dir(pratica_id),
    )
    return FileResponse(
        path,
        filename=path.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
