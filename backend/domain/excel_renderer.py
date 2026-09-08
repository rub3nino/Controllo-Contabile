"""Serializza gli esiti già calcolati dal motore in un WPS Excel."""

from __future__ import annotations

import shutil
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from backend.catalog import DOCUMENT_NEED, ITEM_LABELS, MASTER_XLSX, checklist_items
from backend.domain.models import Finding, PraticaRecord, VerificationResult
from backend.fill import _add_status_cf, apply_status_fill

INDEX_CELLS = {
    "A": "F10", "B": "F11", "C": "F12", "D": "F13", "E": "F14",
    "F": "F15", "G": "F16", "H": "F17", "I": "F18",
}


def render_domain_workbook(
    pratica: PraticaRecord,
    verifiche: dict[str, VerificationResult],
    findings: list[Finding],
    out_dir: Path,
) -> Path:
    """Crea un workbook derivato, senza ricalcolare alcuno stato."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    destination = out_dir / f"WPS_Dominio_{pratica.id}.xlsx"
    shutil.copyfile(MASTER_XLSX, destination)

    workbook = load_workbook(destination)
    _fill_index(workbook, pratica, verifiche)
    _fill_request_sheet(workbook, verifiche)
    _fill_domain_sources(workbook, verifiche, findings)
    workbook.save(destination)
    _write_missing(out_dir / "mancanti.md", pratica, verifiche)
    return destination


def _fill_index(workbook, pratica: PraticaRecord, verifiche: dict[str, VerificationResult]) -> None:
    sheet = workbook["INDICE"]
    sheet["A1"] = pratica.client
    sheet["M1"] = pratica.period
    for section, coordinate in INDEX_CELLS.items():
        result = verifiche.get(section)
        if result is None:
            continue
        sheet[coordinate] = result.status
        apply_status_fill(sheet[coordinate], result.status)
    _add_status_cf(sheet, "F10:F18")


def _evidence_by_item(verifiche: dict[str, VerificationResult]):
    by_id = {}
    for result in verifiche.values():
        for evidence in result.evidence:
            by_id[evidence.id] = evidence
    by_item: dict[str, list] = {}
    for evidence in by_id.values():
        by_item.setdefault(evidence.item_id, []).append(evidence)
    return by_item


def _fill_request_sheet(workbook, verifiche: dict[str, VerificationResult]) -> None:
    sheet = workbook["Richiesta doc"]
    by_item = _evidence_by_item(verifiche)
    for item in checklist_items():
        item_id = item["id"]
        evidences = by_item.get(item_id, [])
        found = [evidence for evidence in evidences if evidence.found]
        status = "✓" if found else "wip"
        note = ", ".join(dict.fromkeys(e.source_name for e in found if e.source_name))
        sheet[f"P{item['row']}"] = note[:80] if note else "documento non trovato in cartella"
        cell = sheet[f"Q{item['row']}"]
        cell.value = status
        apply_status_fill(cell, status)
    _add_status_cf(sheet, "Q5:Q42")


def _fill_domain_sources(workbook, verifiche: dict[str, VerificationResult], findings: list[Finding]) -> None:
    sheet = workbook.create_sheet("DOMINIO")
    headers = ["Sezione", "Stato", "Tipo", "Voce", "File / descrizione", "Percorso / dettaglio"]
    sheet.append(headers)
    for result in verifiche.values():
        sheet.append([
            result.section, result.status, "Motivazione", "", result.reasoning, "",
        ])
        seen = set()
        for evidence in result.evidence:
            if not evidence.found or evidence.id in seen:
                continue
            seen.add(evidence.id)
            sheet.append([
                result.section, result.status, "Evidenza", evidence.item_id,
                evidence.source_name or "Fonte non disponibile", evidence.source_path or evidence.excerpt,
            ])
        for item_id in result.missing_items:
            sheet.append([
                result.section, result.status, "Mancante", item_id,
                ITEM_LABELS.get(item_id, item_id), DOCUMENT_NEED.get(item_id, "Documento non trovato in cartella."),
            ])
        for anomaly in result.anomalies:
            sheet.append([
                result.section, result.status, f"Anomalia: {anomaly.severity}",
                anomaly.related_item_id or "", anomaly.kind, anomaly.description,
            ])
    for finding in findings:
        sheet.append([
            finding.section, finding.status, "Finding aperto", "", finding.description,
            f"Prima segnalazione: {finding.first_raised.period}",
        ])

    header_fill = PatternFill("solid", fgColor="1A1A1A")
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
    widths = {"A": 12, "B": 14, "C": 20, "D": 14, "E": 44, "F": 72}
    for column, width in widths.items():
        sheet.column_dimensions[column].width = width
    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    sheet.sheet_view.showGridLines = False


def _missing_ids(verifiche: dict[str, VerificationResult]) -> list[str]:
    wanted = {item_id for result in verifiche.values() for item_id in result.missing_items}
    standard_order = [item["id"] for item in checklist_items()]
    ordered = [item_id for item_id in standard_order if item_id in wanted]
    ordered.extend(sorted(wanted - set(standard_order)))
    return ordered


def _write_missing(path: Path, pratica: PraticaRecord, verifiche: dict[str, VerificationResult]) -> None:
    lines = ["# Documenti mancanti", "", f"Cliente: {pratica.client}", f"Periodo: {pratica.period}", ""]
    missing = _missing_ids(verifiche)
    if not missing:
        lines.append("Nessun documento mancante (niente in wip).")
    for item_id in missing:
        lines.append(f"- **{item_id}** {ITEM_LABELS.get(item_id, item_id)}")
        lines.append(f"  {DOCUMENT_NEED.get(item_id, 'Documento non trovato in cartella.')}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
