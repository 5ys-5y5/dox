from __future__ import annotations

import argparse
import io
import json
import re
from collections import defaultdict
from pathlib import Path

import fitz
import pytesseract
from PIL import Image


OCR_MEANINGFUL_TEXT_PATTERN = re.compile(r"[0-9A-Za-z\u3131-\u318e\uac00-\ud7a3]")
OCR_PUNCTUATION_ONLY_PATTERN = re.compile(r"^[|()/:.,=%\-]+$")


def rounded(value: float) -> float:
    return round(float(value), 2)


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").split()).strip()


def build_plain_text_item(
    text: str,
    left: float,
    top: float,
    width: float,
    height: float,
    font_size: float | None = None,
) -> dict | None:
    normalized_text = normalize_text(text)

    if not normalized_text or width <= 0 or height <= 0:
        return None

    resolved_font_size = max(8.0, min(18.0, float(font_size or height * 0.82)))
    resolved_line_height = max(resolved_font_size * 1.18, float(height))

    return {
        "kind": "plain_text",
        "left": rounded(left),
        "top": rounded(top),
        "width": rounded(width),
        "height": rounded(height),
        "fontSize": rounded(resolved_font_size),
        "lineHeight": rounded(resolved_line_height),
        "fontWeight": 400,
        "text": normalized_text,
    }


def extract_digital_text_items(page: fitz.Page) -> list[dict]:
    words = page.get_text("words", sort=True) or []
    items: list[dict] = []

    for word in words:
        x0, y0, x1, y1, text = word[:5]
        item = build_plain_text_item(
            str(text or ""),
            float(x0),
            float(y0),
            float(x1) - float(x0),
            float(y1) - float(y0),
            float(y1) - float(y0),
        )

        if item is not None:
            items.append(item)

    return items


def should_use_digital_items(items: list[dict]) -> bool:
    if len(items) >= 12:
        return True

    visible_chars = sum(len(str(item.get("text") or "").replace(" ", "")) for item in items)
    return visible_chars >= 48


def preprocess_ocr_image(image: Image.Image) -> Image.Image:
    return image.convert("L")


def looks_like_meaningful_ocr_text(value: str) -> bool:
    normalized = normalize_text(value)

    if not normalized:
        return False

    if OCR_MEANINGFUL_TEXT_PATTERN.search(normalized):
        return True

    return OCR_PUNCTUATION_ONLY_PATTERN.fullmatch(normalized) is not None


def is_single_hangul_token(value: str) -> bool:
    normalized = normalize_text(value)
    return len(normalized) == 1 and bool(re.fullmatch(r"[\u3131-\u318e\uac00-\ud7a3]", normalized))


def should_merge_ocr_words(previous: dict, current: dict, gap: float, average_char_width: float) -> bool:
    if gap <= 0:
        return True

    return gap <= max(14.0, average_char_width * 1.9)


def should_insert_space_between_tokens(left_text: str, right_text: str, gap: float, average_char_width: float) -> bool:
    if gap <= max(6.0, average_char_width * 1.05):
        return False

    normalized_left = normalize_text(left_text)
    normalized_right = normalize_text(right_text)

    if not normalized_left or not normalized_right:
        return False

    left_last = normalized_left[-1]
    right_first = normalized_right[0]

    if left_last in "([{" or right_first in ")]},.:;|/%":
        return False

    if is_single_hangul_token(normalized_left) and is_single_hangul_token(normalized_right):
        return False

    return True


def merge_ocr_line_words(words: list[dict]) -> list[dict]:
    ordered = sorted(words, key=lambda item: (float(item["left"]), float(item["top"])))

    if not ordered:
        return []

    chunks: list[dict] = []
    current = dict(ordered[0])

    for word in ordered[1:]:
        gap = float(word["left"]) - float(current["right"])
        current_char_width = max(1.0, float(current["width"]) / max(1, len(str(current["text"] or ""))))
        word_char_width = max(1.0, float(word["width"]) / max(1, len(str(word["text"] or ""))))
        average_char_width = (current_char_width + word_char_width) * 0.5

        if should_merge_ocr_words(current, word, gap, average_char_width):
            separator = " " if should_insert_space_between_tokens(str(current["text"] or ""), str(word["text"] or ""), gap, average_char_width) else ""
            current["text"] = f'{str(current["text"] or "").rstrip()}{separator}{str(word["text"] or "").lstrip()}'
            current["right"] = max(float(current["right"]), float(word["right"]))
            current["width"] = float(current["right"]) - float(current["left"])
            current["top"] = min(float(current["top"]), float(word["top"]))
            current["bottom"] = max(float(current["bottom"]), float(word["bottom"]))
            current["height"] = float(current["bottom"]) - float(current["top"])
            continue

        chunks.append(current)
        current = dict(word)

    chunks.append(current)
    return chunks


def collect_ocr_line_words(
    page: fitz.Page,
    prepared: Image.Image,
    ocr_lang: str,
    config: str,
) -> dict[tuple[int, int, int], list[dict]]:
    ocr_data = pytesseract.image_to_data(
        prepared,
        lang=ocr_lang,
        config=config,
        output_type=pytesseract.Output.DICT,
    )
    lines: dict[tuple[int, int, int], list[dict]] = defaultdict(list)

    for index, raw_text in enumerate(ocr_data.get("text", [])):
        text = normalize_text(str(raw_text or ""))

        if not looks_like_meaningful_ocr_text(text):
            continue

        try:
            confidence = float(ocr_data.get("conf", [])[index] or -1)
        except Exception:
            confidence = -1

        if confidence < 25:
            continue

        if confidence < 45 and not OCR_MEANINGFUL_TEXT_PATTERN.search(text):
            continue

        left = float(ocr_data["left"][index])
        top = float(ocr_data["top"][index])
        width = float(ocr_data["width"][index])
        height = float(ocr_data["height"][index])

        if width <= 0 or height <= 0:
            continue

        line_key = (
            int(ocr_data.get("block_num", [0])[index] or 0),
            int(ocr_data.get("par_num", [0])[index] or 0),
            int(ocr_data.get("line_num", [0])[index] or 0),
        )
        lines[line_key].append(
            {
                "text": text,
                "confidence": confidence,
                "left": left,
                "top": top,
                "right": left + width,
                "bottom": top + height,
                "width": width,
                "height": height,
            }
        )

    return lines


def build_ocr_items_from_lines(
    page: fitz.Page,
    prepared: Image.Image,
    lines: dict[tuple[int, int, int], list[dict]],
) -> list[dict]:
    scale_x = float(page.rect.width) / max(1.0, float(prepared.width))
    scale_y = float(page.rect.height) / max(1.0, float(prepared.height))
    items: list[dict] = []

    for line_key in sorted(lines):
        merged_words = merge_ocr_line_words(lines[line_key])

        for word in merged_words:
            item = build_plain_text_item(
                str(word["text"] or ""),
                float(word["left"]) * scale_x,
                float(word["top"]) * scale_y,
                float(word["width"]) * scale_x,
                float(word["height"]) * scale_y,
                float(word["height"]) * scale_y,
            )

            if item is not None:
                items.append(item)

    return items


def extract_ocr_text_items(page: fitz.Page, ocr_lang: str, raster_scale: float) -> list[dict]:
    matrix = fitz.Matrix(raster_scale, raster_scale)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.open(io.BytesIO(pixmap.tobytes("png")))
    prepared = preprocess_ocr_image(image)
    ocr_passes = [
        (prepared, "--oem 1 --psm 6 -c preserve_interword_spaces=1 -c load_system_dawg=0 -c load_freq_dawg=0"),
        (
            prepared.point(lambda value: 255 if value > 180 else 0, mode="1").convert("L"),
            "--oem 1 --psm 6 -c preserve_interword_spaces=1 -c load_system_dawg=0 -c load_freq_dawg=0",
        ),
        (prepared, "--oem 1 --psm 11 -c preserve_interword_spaces=1 -c load_system_dawg=0 -c load_freq_dawg=0"),
    ]

    for candidate_image, config in ocr_passes:
        line_words = collect_ocr_line_words(page, candidate_image, ocr_lang, config)
        items = build_ocr_items_from_lines(page, candidate_image, line_words)

        if items:
            return items

    return []


def extract_page_items(
    page: fitz.Page,
    ocr_lang: str,
    raster_scale: float,
    *,
    force_ocr: bool = False,
) -> tuple[list[dict], str]:
    digital_items: list[dict] = []

    if not force_ocr:
        digital_items = extract_digital_text_items(page)

        if should_use_digital_items(digital_items):
            return digital_items, "digital"

    ocr_items = extract_ocr_text_items(page, ocr_lang, raster_scale)

    if ocr_items:
        return ocr_items, "ocr"

    if force_ocr:
        return [], "ocr_fallback"

    return digital_items, "digital_fallback"


def build_render_model(pdf_path: Path, ocr_lang: str, raster_scale: float, *, force_ocr: bool = False) -> dict:
    document = fitz.open(pdf_path)
    pages: list[dict] = []
    extraction_modes: list[str] = []

    try:
        for page_index, page in enumerate(document):
            text_items, mode = extract_page_items(page, ocr_lang, raster_scale, force_ocr=force_ocr)
            extraction_modes.append(mode)
            pages.append(
                {
                    "pageNumber": page_index + 1,
                    "width": rounded(float(page.rect.width)),
                    "height": rounded(float(page.rect.height)),
                    "frameSegments": [],
                    "textItems": text_items,
                }
            )
    finally:
        document.close()

    return {
        "version": "positioned-v1",
        "cloneId": "pdf-frame-text-image-v1.00",
        "pageCount": len(pages),
        "pages": pages,
        "diagnostics": {
            "pageModes": extraction_modes,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-pdf", required=True)
    parser.add_argument("--ocr-lang", default="kor+eng")
    parser.add_argument("--raster-scale", type=float, default=2.6)
    parser.add_argument("--force-ocr", action="store_true")
    args = parser.parse_args()

    render_model = build_render_model(
        Path(args.input_pdf),
        args.ocr_lang,
        float(args.raster_scale),
        force_ocr=bool(args.force_ocr),
    )
    print(json.dumps(render_model, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
