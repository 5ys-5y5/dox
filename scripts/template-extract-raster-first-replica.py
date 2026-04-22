from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_CONVERTER = (
    REPO_ROOT
    / "docs"
    / "[priority1]highperform_pdf_to_html_converter_type3(edit, checkbox)(mbhj).py"
)
CLONE_ID = "pdf-raster-first-v2.01"
CLONE_BUILDER = "pdf_raster_first_editable_checkbox_v2_01"


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def rounded(value: float) -> float:
    return round(float(value), 2)


def load_reference_converter():
    if not REFERENCE_CONVERTER.exists():
        raise FileNotFoundError(f"reference converter not found: {REFERENCE_CONVERTER}")

    spec = importlib.util.spec_from_file_location("template_extract_reference_type3", REFERENCE_CONVERTER)

    if spec is None or spec.loader is None:
        raise RuntimeError(f"reference converter cannot be loaded: {REFERENCE_CONVERTER}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def body_fragment_from_full_html(full_html: str, render_model: dict) -> str:
    style_blocks = "\n".join(re.findall(r"<style>[\s\S]*?</style>", full_html, flags=re.IGNORECASE))
    body_match = re.search(r"<body[^>]*>([\s\S]*?)</body>", full_html, flags=re.IGNORECASE)
    body_inner = body_match.group(1).strip() if body_match else full_html.strip()
    body_inner = re.sub(r"<style>[\s\S]*?</style>", "", body_inner, flags=re.IGNORECASE).strip()
    render_model_json = json.dumps(render_model, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

    return f'''<section data-template-extract-draft="true" data-template-clone="{CLONE_ID}">
  <script type="application/json" data-template-render-model="positioned-v1">{render_model_json}</script>
  <div class="template-clone template-clone--raster-first-v2-01">
{style_blocks}
{body_inner}
  </div>
</section>'''


def page_source_mode(pages) -> str:
    modes = {getattr(page, "mode", "") for page in pages}
    return "scanned" if modes == {"scan"} else "digital"


def build_model_summary(pages) -> dict:
    table_count = sum(len(getattr(page, "tables", [])) for page in pages)
    text_block_count = sum(len(getattr(page, "text_blocks", [])) for page in pages)
    cell_count = sum(
        len(getattr(table, "cells", []))
        for page in pages
        for table in getattr(page, "tables", [])
    )
    choice_mark_count = sum(
        len(getattr(cell, "choice_marks", []))
        for page in pages
        for table in getattr(page, "tables", [])
        for cell in getattr(table, "cells", [])
    )
    row_band_count = sum(
        max(0, len(getattr(table, "y_lines", [])) - 1)
        for page in pages
        for table in getattr(page, "tables", [])
    )
    column_edge_count = sum(
        len(getattr(table, "x_lines", []))
        for page in pages
        for table in getattr(page, "tables", [])
    )

    return {
        "pageCount": len(pages),
        "tableCount": table_count,
        "textBlockCount": text_block_count,
        "cellCount": cell_count,
        "choiceMarkCount": choice_mark_count,
        "rowBandCount": row_band_count,
        "columnEdgeCount": column_edge_count,
        "horizontalSegmentCount": row_band_count,
        "verticalSegmentCount": column_edge_count,
    }


def rich_line_text(line) -> str:
    parts = []

    for fragment in getattr(line, "fragments", []):
        if getattr(fragment, "kind", "") == "choice":
            mark = "[x]" if getattr(fragment, "checked", False) else "[ ]"
            text = getattr(fragment, "text", "") or ""
            parts.append(f"{mark} {text}".strip())
            continue

        parts.append(getattr(fragment, "text", "") or "")

    return " ".join(part for part in parts if part).strip()


def rich_line_options(line) -> list:
    options = []

    for fragment in getattr(line, "fragments", []):
        if getattr(fragment, "kind", "") != "choice":
            continue

        options.append({
            "label": getattr(fragment, "text", "") or "",
            "checked": bool(getattr(fragment, "checked", False)),
        })

    return options


def build_text_items_for_region(rect, text: str, font_pt: float, bold: bool, rich_lines: list) -> list:
    font_size = rounded(clamp(float(font_pt or 11.0) * 0.95, 8.0, 14.0))
    line_height = rounded(max(font_size * 1.22, 9.0))
    font_weight = 700 if bold else 400
    pad_x = clamp(font_size * 0.38, 3.5, 7.0)
    pad_y = clamp(font_size * 0.28, 2.5, 6.0)
    left = rect.x0 + pad_x
    top = rect.y0 + pad_y
    width = max(1.0, rect.width - pad_x * 2)
    max_lines = max(1, int(max(1.0, rect.height - pad_y * 2) // max(1.0, line_height)))
    lines = list(rich_lines or [])

    if not lines:
        normalized_lines = [line.strip() for line in str(text or "").splitlines() if line.strip()]
    else:
        normalized_lines = [rich_line_text(line) for line in lines]

    if not normalized_lines and text:
        normalized_lines = [str(text).strip()]

    items = []

    for index, line_text in enumerate(normalized_lines[:max_lines]):
        item_top = top + line_height * index
        height = max(1.0, min(line_height, rect.y1 - item_top))

        if height <= 0:
            continue

        options = rich_line_options(lines[index]) if index < len(lines) else []

        if options:
            items.append({
                "kind": "status_options",
                "left": rounded(left),
                "top": rounded(item_top),
                "width": rounded(width),
                "height": rounded(height),
                "fontSize": font_size,
                "lineHeight": line_height,
                "fontWeight": font_weight,
                "options": options,
            })
            continue

        if not line_text:
            continue

        items.append({
            "kind": "plain_text",
            "left": rounded(left),
            "top": rounded(item_top),
            "width": rounded(width),
            "height": rounded(height),
            "fontSize": font_size,
            "lineHeight": line_height,
            "fontWeight": font_weight,
            "text": line_text,
        })

    return items


def build_frame_segments_for_table(table) -> list:
    segments = []

    for y_value in getattr(table, "y_lines", []):
        segments.append({
            "orientation": "h",
            "left": rounded(table.bbox.x0),
            "top": rounded(y_value),
            "width": rounded(table.bbox.width),
        })

    for x_value in getattr(table, "x_lines", []):
        segments.append({
            "orientation": "v",
            "left": rounded(x_value),
            "top": rounded(table.bbox.y0),
            "height": rounded(table.bbox.height),
        })

    return segments


def build_render_model(pages) -> dict:
    render_pages = []

    for page in pages:
        frame_segments = []
        text_items = []

        for table in getattr(page, "tables", []):
            frame_segments.extend(build_frame_segments_for_table(table))

            for cell in getattr(table, "cells", []):
                text_items.extend(
                    build_text_items_for_region(
                        cell.rect,
                        getattr(cell, "text", "") or "",
                        getattr(cell, "font_pt", 11.0),
                        bool(getattr(cell, "bold", False)),
                        getattr(cell, "lines", []) or [],
                    )
                )

        for block in getattr(page, "text_blocks", []):
            text_items.extend(
                build_text_items_for_region(
                    block.bbox,
                    getattr(block, "text", "") or "",
                    getattr(block, "font_pt", 11.0),
                    bool(getattr(block, "bold", False)),
                    getattr(block, "lines", []) or [],
                )
            )

        render_pages.append({
            "pageNumber": int(getattr(page, "number", len(render_pages) + 1)),
            "width": rounded(getattr(page, "width", 0.0)),
            "height": rounded(getattr(page, "height", 0.0)),
            "frameSegments": frame_segments,
            "textItems": text_items,
        })

    return {
        "version": "positioned-v1",
        "cloneId": CLONE_ID,
        "pageCount": len(render_pages),
        "pages": render_pages,
    }


def convert(input_pdf: Path, scale: float, raster_scale: float, ocr_lang: str) -> dict:
    converter = load_reference_converter()
    doc = converter.fitz.open(str(input_pdf))
    pages = [
        converter.convert_page(page, index + 1, raster_scale, ocr_lang)
        for index, page in enumerate(doc)
    ]
    full_html = converter.render_document(pages, input_pdf.stem, scale)
    render_model = build_render_model(pages)
    fragment_html = body_fragment_from_full_html(full_html, render_model)
    summary = build_model_summary(pages)

    return {
        "sourceTitle": input_pdf.stem,
        "html": fragment_html,
        "pageCount": len(pages),
        "sourceMode": page_source_mode(pages),
        "documentFamily": "generic_form",
        "cloneBuilder": CLONE_BUILDER,
        "modelSummary": summary,
        "renderModel": render_model,
        "diagnostics": {
            "fallbackApplied": False,
            "fallbackReason": None,
            "dependencyWarnings": [],
            "referenceConverter": REFERENCE_CONVERTER.name,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build v2.01 raster-first editable HTML from a PDF using the pinned reference converter."
    )
    parser.add_argument("--input-pdf", required=True)
    parser.add_argument("--engine-version", default="32")
    parser.add_argument("--scale", type=float, default=1.28)
    parser.add_argument("--raster-scale", type=float, default=3.2)
    parser.add_argument("--ocr-lang", default="kor+eng")
    args = parser.parse_args()

    input_pdf = Path(args.input_pdf)

    if not input_pdf.exists():
        raise FileNotFoundError(f"input pdf not found: {input_pdf}")

    result = convert(input_pdf, args.scale, args.raster_scale, args.ocr_lang)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
