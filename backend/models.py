from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Status = Literal["✓", "✗", "wip", "N/A", ""]


class PraticaIn(BaseModel):
    client: str
    period: str
    done_by: str = ""
    reviewed_by: str = ""
    request_date: str | None = None
    activity_date: str | None = None
    documents_dir: str = ""
    pratica_id: str = ""
    ingest_kind: str = ""
    skip_items: list[str] = Field(default_factory=list)
    na_items: list[str] = Field(default_factory=list)
    skip_sections: list[str] = Field(default_factory=list)


class LinkFolderIn(BaseModel):
    path: str


class DocumentOut(BaseModel):
    id: str
    name: str
    path: str
    rel: str = ""
    ext: str
    size: int
    item_id: str | None = None
    item_label: str | None = None
    confidence: float = 0
    method: str = "unclassified"
    excerpt: str = ""
    skip: bool = False


class DocumentPatch(BaseModel):
    item_id: str | None = None
    skip: bool | None = None


class ItemPatch(BaseModel):
    status: Literal["✗", "N/A", ""] | None = None


class LogEvent(BaseModel):
    ts: str
    level: str = "info"
    section: str = ""
    message: str
    source: str | None = None


class ProvenanceRow(BaseModel):
    id: str
    client: str
    period: str
    sheet: str
    cell: str
    item_id: str | None = None
    value: str
    source_path: str = ""
    source_rel: str = ""
    source_name: str
    page: str | None = None
    excerpt: str = ""
    method: str
    confidence: float = 0
    ts: str
    human: bool = False


class Kpis(BaseModel):
    files: int = 0
    classified: int = 0
    missing: int = 0
    sections_done: int = 0


class SectionState(BaseModel):
    id: str
    title: str
    status: Status = ""
    note: str = ""


class AppState(BaseModel):
    pratica: PraticaIn | None = None
    documents: list[DocumentOut] = Field(default_factory=list)
    checklist: dict[str, Status] = Field(default_factory=dict)
    sections: list[SectionState] = Field(default_factory=list)
    kpis: Kpis = Field(default_factory=Kpis)
    logs: list[LogEvent] = Field(default_factory=list)
    provenance: list[ProvenanceRow] = Field(default_factory=list)
    missing: list[dict[str, Any]] = Field(default_factory=list)
    running: bool = False
    current_section: str = ""
    progress: float = 0
    output_dir: str | None = None
    xlsx_path: str | None = None
    error: str | None = None
    error_detail: str = ""
    error_missing: list[str] = Field(default_factory=list)
    job_step: int = 0
    job_total: int = 0
    job_label: str = ""
