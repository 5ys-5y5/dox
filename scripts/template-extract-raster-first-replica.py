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


def body_fragment_from_full_html(full_html: str) -> str:
    style_blocks = "\n".join(re.findall(r"<style>[\s\S]*?</style>", full_html, flags=re.IGNORECASE))
    body_match = re.search(r"<body[^>]*>([\s\S]*?)</body>", full_html, flags=re.IGNORECASE)
    body_inner = body_match.group(1).strip() if body_match else full_html.strip()
    body_inner = re.sub(r"<style>[\s\S]*?</style>", "", body_inner, flags=re.IGNORECASE).strip()

    return f'''<section data-template-extract-draft="true" data-template-clone="{CLONE_ID}">
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


def convert(input_pdf: Path, scale: float, raster_scale: float, ocr_lang: str) -> dict:
    converter = load_reference_converter()
    doc = converter.fitz.open(str(input_pdf))
    pages = [
        converter.convert_page(page, index + 1, raster_scale, ocr_lang)
        for index, page in enumerate(doc)
    ]
    full_html = converter.render_document(pages, input_pdf.stem, scale)
    fragment_html = body_fragment_from_full_html(full_html)
    summary = build_model_summary(pages)

    return {
        "sourceTitle": input_pdf.stem,
        "html": fragment_html,
        "pageCount": len(pages),
        "sourceMode": page_source_mode(pages),
        "documentFamily": "generic_form",
        "cloneBuilder": CLONE_BUILDER,
        "modelSummary": summary,
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
