from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VISUAL_REFERENCE_CONVERTER = (
    REPO_ROOT
    / "docs"
    / "[priority1]highperform_pdf_to_html_converter_type1(mbhj).py"
)
EDIT_REFERENCE_CONVERTER = (
    REPO_ROOT
    / "docs"
    / "[priority1]highperform_pdf_to_html_converter_type3(edit, checkbox)(mbhj).py"
)
CLONE_ID = "pdf-raster-first-v2.01"
CLONE_BUILDER = "pdf_raster_first_editable_checkbox_v2_01"
EDIT_OVERLAY_STYLE = """
<style>
  .template-clone--raster-first-v2-01 .v201-edit-overlay {
    position:absolute;
    inset:0;
    z-index:20;
    pointer-events:none;
  }
  .template-clone--raster-first-v2-01 .v201-edit-text,
  .template-clone--raster-first-v2-01 .v201-choice-row {
    position:absolute;
    pointer-events:auto;
  }
  .template-clone--raster-first-v2-01 .v201-edit-text {
    display:block;
    min-width:8px;
    min-height:8px;
    color:transparent;
    opacity:.01;
    white-space:pre-wrap;
    line-height:1.15;
    overflow:hidden;
    user-select:text;
    -webkit-user-select:text;
  }
  .template-clone--raster-first-v2-01 .v201-edit-text:focus {
    color:#111827;
    opacity:1;
    background:rgba(255,255,255,.92);
    outline:1px dashed #2563eb;
    overflow:visible;
    z-index:2;
  }
  .template-clone--raster-first-v2-01 .v201-choice-row {
    display:flex;
    align-items:center;
    gap:4px;
    opacity:.04;
  }
  .template-clone--raster-first-v2-01 .v201-choice-row:hover,
  .template-clone--raster-first-v2-01 .v201-choice-row:focus-within {
    opacity:1;
  }
  .template-clone--raster-first-v2-01 .v201-choice-box {
    width:10px;
    height:10px;
    padding:0;
    border:1px solid #111827;
    background:#fff;
    appearance:none;
    -webkit-appearance:none;
  }
  .template-clone--raster-first-v2-01 .v201-choice-box[data-checked="1"]::after {
    content:"";
    display:block;
    width:6px;
    height:6px;
    margin:1px;
    background:#111827;
  }
  .template-clone--raster-first-v2-01 .v201-choice-label {
    position:static;
    opacity:1;
    color:transparent;
  }
  .template-clone--raster-first-v2-01 .v201-choice-label:focus {
    color:#111827;
  }
</style>
<script>
  document.addEventListener('click', event => {
    const button = event.target.closest('.v201-choice-box');
    if (!button) return;
    const next = button.getAttribute('data-checked') === '1' ? '0' : '1';
    button.setAttribute('data-checked', next);
    button.setAttribute('aria-checked', next === '1' ? 'true' : 'false');
  });
</script>
"""


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def rounded(value: float) -> float:
    return round(float(value), 2)


def load_reference_converter(path: Path, module_name: str):
    if not path.exists():
        raise FileNotFoundError(f"reference converter not found: {path}")

    spec = importlib.util.spec_from_file_location(module_name, path)

    if spec is None or spec.loader is None:
        raise RuntimeError(f"reference converter cannot be loaded: {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def body_fragment_from_full_html(full_html: str, render_model: dict, edit_pages: list, scale: float) -> str:
    style_blocks = "\n".join(re.findall(r"<style>[\s\S]*?</style>", full_html, flags=re.IGNORECASE))
    body_match = re.search(r"<body[^>]*>([\s\S]*?)</body>", full_html, flags=re.IGNORECASE)
    body_inner = body_match.group(1).strip() if body_match else full_html.strip()
    body_inner = re.sub(r"<style>[\s\S]*?</style>", "", body_inner, flags=re.IGNORECASE).strip()
    body_inner = inject_edit_overlays(body_inner, edit_pages, scale)
    render_model_json = json.dumps(render_model, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

    return f'''<section data-template-extract-draft="true" data-template-clone="{CLONE_ID}">
  <script type="application/json" data-template-render-model="positioned-v1">{render_model_json}</script>
  <div class="template-clone template-clone--raster-first-v2-01">
{style_blocks}
{EDIT_OVERLAY_STYLE}
{body_inner}
  </div>
</section>'''


def collect_choice_count_from_edit_pages(pages: list) -> int:
    count = 0

    for page in pages:
        for table in getattr(page, "tables", []):
            for cell in getattr(table, "cells", []):
                for line in getattr(cell, "lines", []) or []:
                    count += len(rich_line_options(line))

        for block in getattr(page, "text_blocks", []):
            for line in getattr(block, "lines", []) or []:
                count += len(rich_line_options(line))

    return count


def page_source_mode(pages) -> str:
    modes = {getattr(page, "mode", "") for page in pages}
    return "scanned" if modes == {"scan"} else "digital"


def build_model_summary(visual_pages: list, edit_pages: list) -> dict:
    pages = visual_pages
    table_count = sum(len(getattr(page, "tables", [])) for page in pages)
    text_block_count = sum(
        len(getattr(page, "text_blocks", []))
        + len(getattr(page, "text_lines", []))
        + len(getattr(page, "raster_blocks", []))
        for page in pages
    )
    cell_count = sum(
        len(getattr(table, "cells", []))
        for page in pages
        for table in getattr(page, "tables", [])
    )
    choice_mark_count = collect_choice_count_from_edit_pages(edit_pages)
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


def region_lines_from_text_and_rich_lines(text: str, rich_lines: list) -> list[dict]:
    lines = list(rich_lines or [])

    if lines:
        return [
            {
                "text": rich_line_text(line),
                "options": rich_line_options(line),
            }
            for line in lines
        ]

    return [
        {
            "text": line.strip(),
            "options": [],
        }
        for line in str(text or "").splitlines()
        if line.strip()
    ]


def render_edit_overlay_region(rect, text: str, font_pt: float, bold: bool, rich_lines: list, scale: float) -> str:
    font_px = clamp(float(font_pt or 11.0) * scale * 0.95, 9.0, 18.0)
    line_height_px = max(font_px * 1.22, 10.0)
    font_weight = 700 if bold else 400
    pad_x = clamp(font_px * 0.38, 4.0, 8.0)
    pad_y = clamp(font_px * 0.28, 2.5, 6.0)
    left = rect.x0 * scale + pad_x
    top = rect.y0 * scale + pad_y
    width = max(1.0, rect.width * scale - pad_x * 2)
    height_limit = max(1.0, rect.height * scale - pad_y * 2)
    max_lines = max(1, int(height_limit // max(1.0, line_height_px)))
    html_parts = []

    for index, line in enumerate(region_lines_from_text_and_rich_lines(text, rich_lines)[:max_lines]):
        line_top = top + line_height_px * index
        line_height = min(line_height_px, rect.y1 * scale - line_top)

        if line_height <= 0:
            continue

        base_style = (
            f"left:{left:.2f}px; top:{line_top:.2f}px; width:{width:.2f}px; "
            f"min-height:{line_height:.2f}px; font-size:{font_px:.2f}px; "
            f"font-weight:{font_weight};"
        )
        options = line.get("options") or []

        if options:
            buttons = []

            for option in options:
                checked = "1" if option.get("checked") else "0"
                aria = "true" if option.get("checked") else "false"
                label = html.escape(str(option.get("label") or ""), quote=False)
                buttons.append(
                    f'<button type="button" class="v201-choice-box" data-checked="{checked}" '
                    f'aria-checked="{aria}" role="checkbox"></button>'
                    f'<span class="v201-edit-text v201-choice-label" contenteditable="true">{label}</span>'
                )

            html_parts.append(f'<span class="v201-choice-row" style="{base_style}">{"".join(buttons)}</span>')
            continue

        line_text = str(line.get("text") or "").strip()

        if not line_text:
            continue

        html_parts.append(
            f'<span class="v201-edit-text" contenteditable="true" '
            f'data-template-edit-text="true" style="{base_style}">{html.escape(line_text, quote=False)}</span>'
        )

    return "".join(html_parts)


def render_edit_overlay_page(page, scale: float) -> str:
    regions = []

    for table in getattr(page, "tables", []):
        for cell in getattr(table, "cells", []):
            regions.append(
                render_edit_overlay_region(
                    cell.rect,
                    getattr(cell, "text", "") or "",
                    getattr(cell, "font_pt", 11.0),
                    bool(getattr(cell, "bold", False)),
                    getattr(cell, "lines", []) or [],
                    scale,
                )
            )

    for block in getattr(page, "text_blocks", []):
        regions.append(
            render_edit_overlay_region(
                block.bbox,
                getattr(block, "text", "") or "",
                getattr(block, "font_pt", 11.0),
                bool(getattr(block, "bold", False)),
                getattr(block, "lines", []) or [],
                scale,
            )
        )

    return f'<div class="v201-edit-overlay" data-template-edit-overlay="true">{"".join(regions)}</div>'


def inject_edit_overlays(body_inner: str, edit_pages: list, scale: float) -> str:
    overlays_by_page = {
        str(int(getattr(page, "number", index + 1))): render_edit_overlay_page(page, scale)
        for index, page in enumerate(edit_pages)
    }

    if not overlays_by_page:
        return body_inner

    page_tag_pattern = re.compile(
        r'(<section\b[^>]*class="[^"]*\bpage\b[^"]*"[^>]*data-page="(\d+)"[^>]*>)',
        flags=re.IGNORECASE,
    )
    injected_pages = set()

    def replace_page_tag(match: re.Match) -> str:
        page_number = match.group(2)
        overlay = overlays_by_page.get(page_number)

        if not overlay:
            return match.group(1)

        injected_pages.add(page_number)
        return match.group(1) + overlay

    next_body = page_tag_pattern.sub(replace_page_tag, body_inner)

    if injected_pages:
        return next_body

    return body_inner + "".join(overlays_by_page.values())


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
                cell_rect = getattr(cell, "rect", None) or getattr(cell, "bbox", None)

                if cell_rect is None:
                    continue

                text_items.extend(
                    build_text_items_for_region(
                        cell_rect,
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

        for line in getattr(page, "text_lines", []):
            text_items.extend(
                build_text_items_for_region(
                    line.bbox,
                    getattr(line, "text", "") or "",
                    getattr(line, "font_pt", 10.0),
                    False,
                    [],
                )
            )

        for block in getattr(page, "raster_blocks", []):
            block_text = getattr(block, "text", "") or ""

            if not block_text:
                continue

            text_items.extend(
                build_text_items_for_region(
                    block.bbox,
                    block_text,
                    10.0,
                    False,
                    [],
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
    visual_converter = load_reference_converter(VISUAL_REFERENCE_CONVERTER, "template_extract_reference_type1")
    edit_converter = load_reference_converter(EDIT_REFERENCE_CONVERTER, "template_extract_reference_type3")
    doc = visual_converter.fitz.open(str(input_pdf))
    asset_store = visual_converter.AssetStore(str(input_pdf.with_suffix(".v201-inline.html")), mode="embed")
    visual_pages = []
    edit_pages = []

    for index in range(doc.page_count):
        page = doc[index]
        visual_pages.append(visual_converter.convert_page(page, index + 1, asset_store, raster_scale, ocr_lang))
        edit_pages.append(edit_converter.convert_page(page, index + 1, raster_scale, ocr_lang))
    full_html = visual_converter.render_document(visual_pages, input_pdf.stem, scale)
    render_model = build_render_model(visual_pages)
    fragment_html = body_fragment_from_full_html(full_html, render_model, edit_pages, scale)
    summary = build_model_summary(visual_pages, edit_pages)

    return {
        "sourceTitle": input_pdf.stem,
        "html": fragment_html,
        "pageCount": len(visual_pages),
        "sourceMode": page_source_mode(edit_pages),
        "documentFamily": "generic_form",
        "cloneBuilder": CLONE_BUILDER,
        "modelSummary": summary,
        "renderModel": render_model,
        "diagnostics": {
            "fallbackApplied": False,
            "fallbackReason": None,
            "dependencyWarnings": [],
            "referenceConverter": (
                f"visual={VISUAL_REFERENCE_CONVERTER.name}; edit={EDIT_REFERENCE_CONVERTER.name}"
            ),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Build v2.01 crop-preserving HTML from type1 visual reconstruction, "
            "with type3 used only for editable text and checkbox overlays."
        )
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
