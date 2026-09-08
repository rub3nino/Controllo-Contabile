from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
from typing import Any, Iterable


_PP_OCR = None
_PP_VL = None


def _as_plain(value: Any) -> Any:
    """Convert Paddle/numpy result values to JSON-compatible Python values."""
    if isinstance(value, dict):
        return {str(k): _as_plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_as_plain(v) for v in value]
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _result_json(result: Any) -> dict:
    value = getattr(result, "json", None)
    if callable(value):
        value = value()
    if value is None and isinstance(result, dict):
        value = result
    value = _as_plain(value or {})
    return value.get("res", value) if isinstance(value, dict) else {}


def _result_markdown(result: Any) -> str:
    value = getattr(result, "markdown", None)
    if callable(value):
        value = value()
    if isinstance(value, dict):
        return str(value.get("markdown_texts") or value.get("text") or "")
    return str(value or "")


def _walk_text(obj: Any) -> Iterable[str]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in {"rec_texts", "texts"} and isinstance(value, (list, tuple)):
                yield from (str(v) for v in value if v)
            elif key in {"block_content", "content", "text"} and isinstance(value, str):
                yield value
            else:
                yield from _walk_text(value)
    elif isinstance(obj, (list, tuple)):
        for value in obj:
            yield from _walk_text(value)


def _cache_dir() -> Path:
    configured = os.getenv("QUADRA_OCR_CACHE")
    path = Path(configured).expanduser() if configured else Path("output") / ".ocr-cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _cache_key(data: bytes, layout: bool) -> Path:
    version = "paddle-vl-1.6" if layout else "pp-ocrv6-it"
    digest = hashlib.sha256(data).hexdigest()
    return _cache_dir() / f"{digest}-{version}.json"


def _load_cache(path: Path) -> str | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("text") if data.get("engine") else None
    except (OSError, ValueError):
        return None


def _save_cache(path: Path, text: str, engine: str, pages: list[dict]) -> None:
    payload = {"engine": engine, "text": text, "pages": pages}
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _pp_ocr():
    global _PP_OCR
    if _PP_OCR is not None:
        return _PP_OCR
    os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(Path("output") / ".paddlex"))
    from paddleocr import PaddleOCR

    _PP_OCR = PaddleOCR(
        lang="it",
        ocr_version="PP-OCRv6",
        device=os.getenv("QUADRA_OCR_DEVICE", "cpu"),
        use_doc_orientation_classify=True,
        use_doc_unwarping=True,
        use_textline_orientation=True,
        return_word_box=True,
    )
    return _PP_OCR


def _pp_vl():
    global _PP_VL
    if _PP_VL is not None:
        return _PP_VL
    os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(Path("output") / ".paddlex"))
    from paddleocr import PaddleOCRVL

    _PP_VL = PaddleOCRVL(
        pipeline_version="v1.6",
        device=os.getenv("QUADRA_OCR_DEVICE", "cpu"),
        use_doc_orientation_classify=True,
        use_doc_unwarping=False,
        use_layout_detection=True,
        format_block_content=True,
        # On Apple/CPU the queue workers add substantial startup/teardown cost
        # for the single-page calls made by Quadra.
        use_queues=False,
    )
    return _PP_VL


def paddle_ocr(data: bytes, *, layout: bool = False) -> tuple[str, str]:
    """Run PP-OCRv6 Italian or PaddleOCR-VL 1.6 and cache structured results."""
    cache = _cache_key(data, layout)
    cached = _load_cache(cache)
    engine_name = "paddle-vl-1.6" if layout else "pp-ocrv6-it"
    if cached is not None:
        return cached, f"{engine_name}-cache"

    # Paddle's documented in-memory input is a numpy image, while RapidOCR accepts
    # bytes. Decode here so both providers share the same public interface.
    import numpy as np
    from PIL import Image

    image = np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))
    pipeline = _pp_vl() if layout else _pp_ocr()
    if layout:
        results = list(
            pipeline.predict(
                image,
                max_pixels=int(os.getenv("QUADRA_OCR_VL_MAX_PIXELS", "1200000")),
            )
        )
    else:
        results = list(pipeline.predict(image))
    pages: list[dict] = []
    texts: list[str] = []
    for result in results:
        raw = _result_json(result)
        markdown = _result_markdown(result) if layout else ""
        text = markdown.strip() or "\n".join(_walk_text(raw)).strip()
        if text:
            texts.append(text)
        pages.append(raw)
    combined = "\n\n".join(texts)
    _save_cache(cache, combined, engine_name, pages)
    return combined, engine_name


def reset_engines_for_tests() -> None:
    global _PP_OCR, _PP_VL
    _PP_OCR = None
    _PP_VL = None
