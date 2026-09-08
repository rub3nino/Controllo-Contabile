from pathlib import Path
import io
import os
import sys
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.extract import extract_file, ocr_image_bytes
from backend.paddle_ocr import _result_json, _result_markdown, _walk_text


class FakeResult:
    json = {"res": {"rec_texts": ["F24", "1.234,56"], "rec_scores": [0.99, 0.98]}}
    markdown = {"markdown_texts": "| Campo | Valore |\n|---|---|\n| Totale | 1.234,56 |"}


def test_paddle_result_normalization():
    result = FakeResult()
    raw = _result_json(result)
    assert list(_walk_text(raw)) == ["F24", "1.234,56"]
    assert "Totale" in _result_markdown(result)


def test_paddle_provider_and_cache():
    from PIL import Image
    from backend.paddle_ocr import paddle_ocr

    image = Image.new("RGB", (20, 20), "white")
    raw = io.BytesIO()
    image.save(raw, format="PNG")

    class FakePipeline:
        calls = 0

        def predict(self, _image):
            self.calls += 1
            return [FakeResult()]

    fake = FakePipeline()
    with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {"QUADRA_OCR_CACHE": tmp}):
        with patch("backend.paddle_ocr._pp_ocr", return_value=fake):
            text, method = paddle_ocr(raw.getvalue())
            cached, cached_method = paddle_ocr(raw.getvalue())
    assert "1.234,56" in text
    assert method == "pp-ocrv6-it"
    assert cached == text
    assert cached_method.endswith("-cache")
    assert fake.calls == 1


def test_ocr_engine_and_image(tmp_path: Path | None = None):
    from PIL import Image, ImageDraw

    out = tmp_path or (ROOT / "output" / "_ocr")
    out.mkdir(parents=True, exist_ok=True)
    path = out / "F24_scan.png"
    img = Image.new("RGB", (1200, 240), "white")
    draw = ImageDraw.Draw(img)
    draw.text((40, 90), "F24 quietanza aprile 2026", fill="black")
    img.save(path)

    text, method = extract_file(path)
    assert method == "ocr"
    # RapidOCR may miss synthetic tiny fonts; the wiring must still run.
    _ = ocr_image_bytes(path.read_bytes())
    assert isinstance(text, str)
    print("ocr-ok", "chars", len(text), "sample", text[:80])


if __name__ == "__main__":
    test_paddle_result_normalization()
    test_paddle_provider_and_cache()
    test_ocr_engine_and_image()
