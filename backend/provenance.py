from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .models import ProvenanceRow


class ProvenanceLog:
    def __init__(self, path: Path):
        self.path = path
        self.rows: list[ProvenanceRow] = []
        path.parent.mkdir(parents=True, exist_ok=True)

    def add(self, **kwargs) -> ProvenanceRow:
        row = ProvenanceRow(
            id=str(uuid4())[:8],
            ts=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **kwargs,
        )
        self.rows.append(row)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(row.model_dump_json() + "\n")
        return row

    def write_xlsx_sheet(self, wb) -> None:
        if "PROVENIENZA" in wb.sheetnames:
            del wb["PROVENIENZA"]
        ws = wb.create_sheet("PROVENIENZA")
        headers = [
            "id", "foglio", "cella", "voce", "valore", "file", "percorso", "pagina",
            "stralcio", "metodo", "confidenza", "timestamp", "umano",
        ]
        ws.append(headers)
        for r in self.rows:
            ws.append([
                r.id, r.sheet, r.cell, r.item_id or "", str(r.value)[:200],
                r.source_name, r.source_rel or r.source_path, r.page or "", r.excerpt[:300], r.method,
                r.confidence, r.ts, "sì" if r.human else "",
            ])
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:M{max(1, len(self.rows)+1)}"
