from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.paths import doc_id, is_junk_name, safe_join, to_posix
from backend.workspace import inbox_dir, new_pratica_id, resolve_link, write_inbox_file


def test_to_posix_windows_and_mac():
    assert to_posix(r"II trimestre\E Adempimenti\F24 160426.pdf") == (
        "II trimestre/E Adempimenti/F24 160426.pdf"
    )
    assert to_posix(r"C:\Users\me\F24.pdf") == "C:/Users/me/F24.pdf"
    assert to_posix("foo/../secret.txt") == "secret.txt"
    assert to_posix("EC/./Bnl.pdf") == "EC/Bnl.pdf"
    assert doc_id("abc", r"EC\Bnl.pdf") == doc_id("abc", "EC/Bnl.pdf")
    assert doc_id("a", "x") != doc_id("b", "x")


def test_junk_and_safe_join(tmp_path: Path):
    assert is_junk_name("._F24 160426.pdf")
    assert is_junk_name(".DS_Store")
    assert is_junk_name("Thumbs.db")
    assert not is_junk_name("F24 160426.pdf")
    root = tmp_path / "inbox"
    root.mkdir(parents=True, exist_ok=True)
    dest = safe_join(root, "II trimestre/F24.pdf")
    assert root.resolve() in dest.parents
    escaped = safe_join(root, "../../etc/passwd")
    assert escaped.is_relative_to(root.resolve())


def test_workspace_write_and_link(tmp_path: Path, monkeypatch=None):
    storage = tmp_path / "storage"
    if monkeypatch is not None:
        monkeypatch.setenv("QUADRA_STORAGE", str(storage))
    else:
        os.environ["QUADRA_STORAGE"] = str(storage)
    pid = new_pratica_id()
    path = write_inbox_file(pid, r"Docs\F24 160426.pdf", b"%PDF")
    assert path.name == "F24 160426.pdf"
    assert "Docs" in path.parts
    linked = resolve_link(str(inbox_dir(pid)))
    assert linked.is_dir()


if __name__ == "__main__":
    test_to_posix_windows_and_mac()
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as d:
        root = Path(d)
        test_junk_and_safe_join(root / "j")
        (root / "j" / "inbox").mkdir(parents=True, exist_ok=True)
        test_workspace_write_and_link(root / "w")
    print("paths-ok")
