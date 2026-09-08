from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

from .paths import safe_join, to_posix

ROOT = Path(__file__).resolve().parents[1]


def storage_root() -> Path:
    configured = os.getenv("QUADRA_STORAGE")
    path = Path(configured).expanduser().resolve() if configured else ROOT / "storage"
    path.mkdir(parents=True, exist_ok=True)
    return path


def new_pratica_id() -> str:
    return uuid4().hex[:12]


def pratica_dir(pratica_id: str) -> Path:
    path = storage_root() / "pratiche" / pratica_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def inbox_dir(pratica_id: str) -> Path:
    path = pratica_dir(pratica_id) / "inbox"
    path.mkdir(parents=True, exist_ok=True)
    return path


def output_dir(pratica_id: str) -> Path:
    path = pratica_dir(pratica_id) / "output"
    path.mkdir(parents=True, exist_ok=True)
    return path


def allowed_roots() -> list[Path]:
    roots = [ROOT.resolve(), storage_root()]
    extra = os.getenv("QUADRA_ALLOWED_ROOTS", "")
    for raw in extra.split(","):
        raw = raw.strip()
        if not raw:
            continue
        roots.append(Path(raw).expanduser().resolve())
    # unique while preserving order
    seen: set[str] = set()
    out: list[Path] = []
    for r in roots:
        key = str(r)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def is_under(path: Path, root: Path) -> bool:
    path = path.resolve()
    root = root.resolve()
    return path == root or root in path.parents


def resolve_link(path: str) -> Path:
    target = Path(path).expanduser().resolve()
    if not target.is_dir():
        raise FileNotFoundError("Cartella documenti non trovata")
    if not any(is_under(target, root) for root in allowed_roots()):
        raise PermissionError(
            "Cartella fuori dalle radici consentite. Imposta QUADRA_ALLOWED_ROOTS o usa il caricamento dal browser."
        )
    return target


def write_inbox_file(pratica_id: str, rel: str, data: bytes) -> Path:
    dest = safe_join(inbox_dir(pratica_id), to_posix(rel))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return dest
