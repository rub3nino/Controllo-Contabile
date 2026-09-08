from __future__ import annotations

import hashlib
import unicodedata
from pathlib import Path

JUNK_NAMES = {".ds_store", "thumbs.db", "desktop.ini"}
SKIP_NAME_PREFIXES = ("~$", "._", ".")


def to_posix(rel: str) -> str:
    """OS-agnostic relative path: NFC, forward slashes, no . or .. segments."""
    text = unicodedata.normalize("NFC", (rel or "").replace("\\", "/").strip())
    parts: list[str] = []
    for part in text.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if parts:
                parts.pop()
            continue
        parts.append(part)
    return "/".join(parts)


def posix_rel(root: Path, path: Path) -> str:
    return to_posix(str(path.resolve().relative_to(root.resolve())))


def is_junk_name(name: str) -> bool:
    n = name or ""
    if n.casefold() in JUNK_NAMES:
        return True
    return n.startswith(SKIP_NAME_PREFIXES)


def safe_join(root: Path, rel: str) -> Path:
    """Resolve rel under root; raise ValueError on traversal."""
    root = root.resolve()
    dest = (root / to_posix(rel)).resolve()
    if dest != root and root not in dest.parents:
        raise ValueError("percorso non valido")
    return dest


def doc_id(pratica_id: str, rel: str) -> str:
    key = f"{pratica_id}:{to_posix(rel)}".encode("utf-8")
    return hashlib.sha1(key).hexdigest()[:12]
