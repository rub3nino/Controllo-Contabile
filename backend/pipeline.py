from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator

from .catalog import ITEM_LABELS, SECTION_TITLES, checklist_items
from .classify import scan_folder, ALLOWED_EXT, SKIP_DIR_NAMES
from .errors import UserError, from_exception
from .fill import Filler
from .models import (
    AppState,
    DocumentOut,
    Kpis,
    LogEvent,
    PraticaIn,
    SectionState,
)
from .paths import is_junk_name, to_posix
from .provenance import ProvenanceLog
from .workspace import (
    inbox_dir,
    new_pratica_id,
    output_dir,
    resolve_link,
    write_inbox_file,
)

Emit = Callable[[dict], None]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Engine:
    def __init__(self):
        self.state = AppState(
            sections=[SectionState(id=k, title=v) for k, v in SECTION_TITLES.items()]
        )

    def log(self, message: str, section: str = "", source: str | None = None, level: str = "info"):
        ev = LogEvent(ts=now_iso(), message=message, section=section, source=source, level=level)
        self.state.logs.append(ev)
        if len(self.state.logs) > 400:
            self.state.logs = self.state.logs[-400:]
        return ev

    def set_pratica(self, pratica: PraticaIn):
        prev = self.state.pratica
        if prev and prev.pratica_id and not pratica.pratica_id:
            pratica.pratica_id = prev.pratica_id
        if not pratica.pratica_id:
            pratica.pratica_id = new_pratica_id()
        same = bool(prev and prev.pratica_id == pratica.pratica_id)
        if not pratica.documents_dir:
            if same and prev.documents_dir:
                pratica.documents_dir = prev.documents_dir
                pratica.ingest_kind = prev.ingest_kind
            else:
                pratica.documents_dir = str(inbox_dir(pratica.pratica_id))
        self.state.pratica = pratica
        if not same:
            self.state.documents = []
            self.state.checklist = {it["id"]: "" for it in checklist_items()}
            self.state.provenance = []
            self.state.missing = []
            self.state.xlsx_path = None
            self.state.output_dir = None
        self.state.error = None
        self.state.progress = 0
        self._apply_overrides_to_checklist()
        self.log(f"Pratica {pratica.client} — {pratica.period}")
        self._refresh_kpis()

    def ingest_uploads(self, items: list[tuple[str, bytes]]) -> int:
        if not self.state.pratica:
            raise RuntimeError("Nessuna pratica")
        pid = self.state.pratica.pratica_id
        inbox = inbox_dir(pid)
        self.state.pratica.documents_dir = str(inbox)
        self.state.pratica.ingest_kind = "upload"
        written = 0
        for rel, data in items:
            posix = to_posix(rel)
            name = Path(posix).name
            if is_junk_name(name):
                continue
            if any(part in SKIP_DIR_NAMES for part in posix.split("/")[:-1]):
                continue
            if Path(name).suffix.lower() not in ALLOWED_EXT:
                continue
            write_inbox_file(pid, posix, data)
            written += 1
        self.state.documents = []
        self.log(f"Caricati {written} file dal browser", section="Documenti")
        if written == 0:
            raise UserError(
                "Nessun file valido nel caricamento",
                "Ho ricevuto la cartella ma nessun PDF, Excel, CSV o TXT utilizzabile. Controlla di non aver selezionato solo file nascosti o una cartella vuota.",
                ["File PDF / Excel / CSV / TXT"],
            )
        return written

    def link_folder(self, path: str) -> str:
        if not self.state.pratica:
            raise RuntimeError("Nessuna pratica")
        target = resolve_link(path)
        self.state.pratica.documents_dir = str(target)
        self.state.pratica.ingest_kind = "link"
        self.state.documents = []
        self.log(f"Cartella collegata sul server ({len(list(target.rglob('*')))} voci)", section="Documenti")
        return str(target)

    def patch_item(self, item_id: str, status: str | None):
        if item_id not in ITEM_LABELS:
            raise KeyError(item_id)
        if not self.state.pratica:
            raise RuntimeError("Nessuna pratica")
        skip = [x for x in self.state.pratica.skip_items if x != item_id]
        na = [x for x in self.state.pratica.na_items if x != item_id]
        if status == "✗":
            skip.append(item_id)
        elif status == "N/A":
            na.append(item_id)
        self.state.pratica.skip_items = skip
        self.state.pratica.na_items = na
        self._apply_overrides_to_checklist()
        self.log(f"{item_id} → {status or 'automatico'} (operatore)", section="Richiesta")
        self._refresh_kpis()

    def _apply_overrides_to_checklist(self):
        if not self.state.pratica:
            return
        skip = set(self.state.pratica.skip_items)
        na = set(self.state.pratica.na_items)
        have = {d.item_id for d in self.state.documents if d.item_id and not d.skip}
        for it in checklist_items():
            iid = it["id"]
            if iid in skip:
                self.state.checklist[iid] = "✗"
            elif iid in na:
                self.state.checklist[iid] = "N/A"
            else:
                current = self.state.checklist.get(iid, "")
                if current in ("✗", "N/A", ""):
                    if iid in have:
                        self.state.checklist[iid] = "✓"
                    elif self.state.documents:
                        self.state.checklist[iid] = "wip"
                    else:
                        self.state.checklist[iid] = ""
                # keep ✓ / wip already calcolati da una compilazione

    def scan(self) -> list[DocumentOut]:
        if not self.state.pratica:
            raise UserError(
                "Manca la pratica",
                "Compila cliente e trimestre, scegli una cartella, poi premi Scansiona.",
                ["Nome cliente", "Cartella documenti"],
            )
        p = self.state.pratica
        if not (p.client or "").strip():
            raise UserError(
                "Manca il nome del cliente",
                "Senza il cliente Quadra non sa come intestare il foglio INDICE. Scrivilo nel campo Cliente a sinistra.",
                ["Campo Cliente"],
            )
        root = Path(p.documents_dir).expanduser() if p.documents_dir else None
        if not root or not root.is_dir():
            raise UserError(
                "Nessuna cartella documenti",
                "Non hai ancora scelto i file. Usa «Scegli cartella» (funziona da Mac e da Windows) oppure collega un percorso che il server può leggere.",
                ["Cartella documenti"],
            )
        self.state.error = None
        self.state.error_detail = ""
        self.state.error_missing = []
        self.state.running = True
        self.state.job_step = 1
        self.state.job_total = 2
        self.state.job_label = "Lettura nomi e cartelle (senza copia, senza OCR)"
        self.state.progress = 20
        self.log("Scansione in corso (file sul disco, classificazione da nome/cartella)", section="Documenti")
        try:
            docs = scan_folder(str(root), p.pratica_id)
            self.state.documents = docs
            classified = sum(1 for d in docs if d.item_id)
            if not docs:
                raise UserError(
                    "Nella cartella non ci sono documenti utilizzabili",
                    "Quadra accetta PDF, Excel, CSV, TXT e immagini. I file di sistema (._ , Thumbs.db, cartelle output) vengono ignorati. Controlla di aver selezionato la cartella giusta, non un singolo file.",
                    ["PDF / Excel / TXT / CSV nella cartella scelta"],
                )
            self.log(f"{len(docs)} file, {classified} classificati", section="Documenti")
            for d in docs:
                if d.item_id:
                    self.log(f"{d.name} → {d.item_id} {d.item_label or ''}".strip(), section="Documenti", source=d.name)
            unclassified = [d.name for d in docs if not d.item_id]
            if unclassified:
                preview = ", ".join(unclassified[:6])
                extra = f" e altri {len(unclassified) - 6}" if len(unclassified) > 6 else ""
                self.log(
                    f"{len(unclassified)} file senza voce checklist (da assegnare a mano): {preview}{extra}",
                    section="Documenti",
                    level="warn",
                )
            self.state.job_step = 2
            self.state.job_total = 2
            self.state.job_label = "Scansione completata"
            self.state.progress = 100
            self._apply_overrides_to_checklist()
            self._refresh_kpis()
            return docs
        except Exception as e:
            err = from_exception(e)
            self.state.error = err.title
            self.state.error_detail = err.detail
            self.state.error_missing = err.missing
            self.state.progress = 0
            self.state.job_step = 0
            self.state.job_total = 0
            self.state.job_label = ""
            self.state.running = False
            raise err from e
        finally:
            self.state.running = False

    def patch_doc(self, doc_id: str, item_id: str | None, skip: bool | None):
        for d in self.state.documents:
            if d.id != doc_id:
                continue
            if item_id is not None:
                d.item_id = item_id or None
                d.item_label = ITEM_LABELS.get(item_id) if item_id else None
                d.method = "umano"
                d.confidence = 1.0
                self.log(f"{d.name} → {item_id or 'nessuna voce'} (correzione)", source=d.name)
            if skip is not None:
                d.skip = skip
                self.log(f"{d.name} {'saltato' if skip else 'reincluso'}", source=d.name)
            self._apply_overrides_to_checklist()
            self._refresh_kpis()
            return d
        raise KeyError(doc_id)

    def _refresh_kpis(self):
        docs = self.state.documents
        skip = set(self.state.pratica.skip_items if self.state.pratica else [])
        na = set(self.state.pratica.na_items if self.state.pratica else [])
        filled = any(st in ("✓", "wip", "✗", "N/A") for st in self.state.checklist.values())
        if filled:
            missing = sum(1 for st in self.state.checklist.values() if st in ("wip", ""))
        else:
            have = {d.item_id for d in docs if d.item_id and not d.skip}
            missing = sum(
                1
                for it in checklist_items()
                if it["id"] not in have and it["id"] not in skip and it["id"] not in na
            )
        self.state.kpis = Kpis(
            files=len(docs),
            classified=sum(1 for d in docs if d.item_id),
            missing=missing,
            sections_done=sum(1 for s in self.state.sections if s.status == "✓"),
        )

    def run(self) -> Iterator[dict]:
        self.state.running = True
        self.state.error = None
        self.state.error_detail = ""
        self.state.error_missing = []
        try:
            if not self.state.pratica:
                raise UserError(
                    "Manca la pratica",
                    "Compila cliente e trimestre prima di avviare la compilazione.",
                    ["Nome cliente"],
                )
            p = self.state.pratica
            if not self.state.documents:
                raise UserError(
                    "Non posso compilare: manca la scansione",
                    "Prima scegli la cartella e premi Scansiona. Solo dopo Quadra sa quali F24, e/c e mastrini usare.",
                    ["Scansione documenti"],
                )
            out = output_dir(p.pratica_id) if p.pratica_id else Path(p.documents_dir).expanduser().resolve() / "output"
            self.state.output_dir = str(out)
            prov = ProvenanceLog(out / "provenienza.jsonl")
            yield self._evt("start", "Avvio compilazione", 2)
            filler = Filler(p, self.state.documents, out, prov)
            path = None
            for kind, payload in filler.fill_iter(p.skip_items, p.na_items, p.skip_sections):
                if kind == "step":
                    step = int(payload["step"])
                    total = int(payload["total"])
                    label = str(payload["label"])
                    sec = str(payload["section"])
                    self.state.current_section = sec
                    self.state.job_step = step
                    self.state.job_total = total
                    self.state.job_label = label
                    left = max(0, total - step)
                    self.log(label, section=sec)
                    pct = 8 + (step - 1) / max(total, 1) * 84
                    yield self._evt(
                        "section",
                        label,
                        pct,
                        section=sec,
                        remaining_steps=left,
                    )
                elif kind == "done":
                    path = payload
            if path is None:
                raise UserError("Compilazione interrotta", "L'Excel non è stato scritto.", ["File WPS"])
            self.state.xlsx_path = str(path)
            self.state.checklist = filler.checklist
            self.state.missing = getattr(filler, "missing", [])
            self.state.provenance = prov.rows
            for warn in getattr(filler, "warnings", []):
                self.log(warn, section="E", level="warn")
            status_map = {r.cell: r.value for r in prov.rows if r.sheet == "INDICE" and r.cell.startswith("F")}
            cell_to_sec = {
                "F10": "A", "F11": "B", "F12": "C", "F13": "D", "F14": "E",
                "F15": "F", "F16": "G", "F17": "H", "F18": "I",
            }
            for s in self.state.sections:
                for cell, sid in cell_to_sec.items():
                    if sid == s.id and cell in status_map:
                        s.status = status_map[cell]  # type: ignore
            self.state.current_section = "INDICE"
            self.state.job_label = "Compilazione completata"
            self._refresh_kpis()
            self.log(f"Excel scritto: {path.name}", section="INDICE", source=path.name)
            n_miss = len(self.state.missing)
            if n_miss:
                self.log(f"{n_miss} voci ancora mancanti: apri Mancanti per sapere cosa serve", section="Mancanti", level="warn")
            yield self._evt("done", "Compilazione completata", 100, xlsx=str(path))
        except Exception as e:
            err = from_exception(e)
            self.state.error = err.title
            self.state.error_detail = err.detail
            self.state.error_missing = err.missing
            self.state.progress = 0
            self.state.job_step = 0
            self.state.job_total = 0
            self.state.job_label = ""
            self.log(err.title, level="error")
            if err.detail:
                self.log(err.detail, level="error")
            self.state.running = False
            yield self._evt("error", err.title, 0, detail=err.detail, missing=err.missing)
        finally:
            self.state.running = False
            if not self.state.error:
                self.state.progress = 100

    def _evt(self, kind: str, message: str, progress: float, **extra) -> dict:
        self.state.progress = progress
        payload = {
            "kind": kind,
            "message": message,
            "progress": progress,
            "section": extra.get("section", self.state.current_section),
            "state": json.loads(self.state.model_dump_json()),
        }
        payload.update(extra)
        return payload


engine = Engine()
