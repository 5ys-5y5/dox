from __future__ import annotations

import argparse
import html
import os
from pathlib import Path
from typing import Iterable

import fitz  # PyMuPDF


def rgb_int_to_hex(value: int) -> str:
    r = (value >> 16) & 255
    g = (value >> 8) & 255
    b = value & 255
    return f"#{r:02x}{g:02x}{b:02x}"


def rgb_tuple_to_hex(value) -> str:
    if value is None:
        return "none"
    if isinstance(value, (int, float)):
        v = int(round(value))
        return f"#{v:02x}{v:02x}{v:02x}"
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        vals = []
        for channel in value[:3]:
            if channel <= 1:
                vals.append(max(0, min(255, int(round(channel * 255)))))
            else:
                vals.append(max(0, min(255, int(round(channel)))))
        return "#%02x%02x%02x" % tuple(vals)
    return "none"


def font_weight_from_name(font_name: str, flags: int) -> str:
    lower = (font_name or "").lower()
    if "bold" in lower or (flags & 16):
        return "700"
    return "400"


def font_style_from_name(font_name: str, flags: int) -> str:
    lower = (font_name or "").lower()
    if "italic" in lower or "oblique" in lower or (flags & 2):
        return "italic"
    return "normal"


def escape_text(text: str) -> str:
    return html.escape(text, quote=False).replace("\n", "<br>")


def page_to_svg(drawings: list[dict], scale: float) -> str:
    parts: list[str] = []

    for d in drawings:
        stroke = rgb_tuple_to_hex(d.get("color")) if d.get("color") is not None else "none"
        fill = rgb_tuple_to_hex(d.get("fill")) if d.get("fill") is not None else "none"
        stroke_width = (d.get("width") or 0) * scale
        fill_opacity = d.get("fill_opacity", 1)
        stroke_opacity = d.get("stroke_opacity", 1)

        linecap = d.get("lineCap", [0])
        if isinstance(linecap, (list, tuple)):
            linecap = linecap[0] if linecap else 0
        linejoin = d.get("lineJoin", 0)

        linecap_css = {0: "butt", 1: "round", 2: "square"}.get(linecap, "butt")
        linejoin_css = {0: "miter", 1: "round", 2: "bevel"}.get(linejoin, "miter")

        for item in d.get("items", []):
            kind = item[0]

            if kind == "l":
                p1, p2 = item[1], item[2]
                parts.append(
                    f'<line x1="{p1.x * scale:.3f}" y1="{p1.y * scale:.3f}" '
                    f'x2="{p2.x * scale:.3f}" y2="{p2.y * scale:.3f}" '
                    f'stroke="{stroke}" stroke-width="{max(stroke_width, 1):.3f}" '
                    f'stroke-opacity="{stroke_opacity}" stroke-linecap="{linecap_css}" />'
                )

            elif kind == "re":
                rect = item[1]
                parts.append(
                    f'<rect x="{rect.x0 * scale:.3f}" y="{rect.y0 * scale:.3f}" '
                    f'width="{rect.width * scale:.3f}" height="{rect.height * scale:.3f}" '
                    f'fill="{fill}" fill-opacity="{fill_opacity}" '
                    f'stroke="{stroke}" stroke-width="{stroke_width:.3f}" '
                    f'stroke-opacity="{stroke_opacity}" stroke-linejoin="{linejoin_css}" />'
                )

            elif kind == "qu":
                quad = item[1]
                pts = [quad.ul, quad.ur, quad.lr, quad.ll]
                pts_str = " ".join(f"{p.x * scale:.3f},{p.y * scale:.3f}" for p in pts)
                parts.append(
                    f'<polygon points="{pts_str}" fill="{fill}" fill-opacity="{fill_opacity}" '
                    f'stroke="{stroke}" stroke-width="{stroke_width:.3f}" '
                    f'stroke-opacity="{stroke_opacity}" />'
                )

            elif kind == "c":
                p1, p2, p3, p4 = item[1], item[2], item[3], item[4]
                path_d = (
                    f'M {p1.x * scale:.3f} {p1.y * scale:.3f} '
                    f'C {p2.x * scale:.3f} {p2.y * scale:.3f}, '
                    f'{p3.x * scale:.3f} {p3.y * scale:.3f}, '
                    f'{p4.x * scale:.3f} {p4.y * scale:.3f}'
                )
                parts.append(
                    f'<path d="{path_d}" fill="none" stroke="{stroke}" '
                    f'stroke-width="{max(stroke_width, 1):.3f}" '
                    f'stroke-opacity="{stroke_opacity}" />'
                )

            elif kind in {"h", "m"}:
                continue

    return "\n".join(parts)


def iter_text_spans(page_dict: dict) -> Iterable[dict]:
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "")
                if not text.strip():
                    continue
                yield span


def page_to_html(page: fitz.Page, page_number: int, scale: float) -> str:
    rect = page.rect
    width = rect.width * scale
    height = rect.height * scale

    drawings = page.get_drawings()
    text_dict = page.get_text("dict")

    text_parts: list[str] = []
    for span in iter_text_spans(text_dict):
        x0, y0, x1, y1 = span["bbox"]
        left = x0 * scale
        top = y0 * scale
        w = max((x1 - x0) * scale, 1)
        h = max((y1 - y0) * scale, 1)
        font_size = span.get("size", 10) * scale
        color = rgb_int_to_hex(span.get("color", 0))
        font_name = span.get("font", "")
        flags = span.get("flags", 0)

        text_parts.append(
            '<div class="t" style="'
            f'left:{left:.3f}px;top:{top:.3f}px;width:{w:.3f}px;height:{h:.3f}px;'
            f'font-size:{font_size:.3f}px;color:{color};'
            f'font-weight:{font_weight_from_name(font_name, flags)};'
            f'font-style:{font_style_from_name(font_name, flags)};'
            '">'
            f'{escape_text(span["text"])}'
            '</div>'
        )

    svg = page_to_svg(drawings, scale)

    return f'''
<section class="page" style="width:{width:.3f}px;height:{height:.3f}px" data-page="{page_number}">
  <svg class="overlay" viewBox="0 0 {width:.3f} {height:.3f}" width="{width:.3f}" height="{height:.3f}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {svg}
  </svg>
  {''.join(text_parts)}
</section>
'''


def convert_pdf_to_html(pdf_path: str | os.PathLike[str], output_html: str | os.PathLike[str], scale: float = 1.5) -> None:
    doc = fitz.open(pdf_path)

    pages_html = []
    max_width = 0.0

    for i, page in enumerate(doc, start=1):
        pages_html.append(page_to_html(page, i, scale))
        max_width = max(max_width, page.rect.width * scale)

    html_doc = f'''<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(Path(pdf_path).stem)} - vector html</title>
  <style>
    :root {{
      --bg: #e9ecef;
      --paper: #ffffff;
      --shadow: rgba(0,0,0,.14);
      --text: #111;
    }}

    * {{
      box-sizing: border-box;
    }}

    body {{
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
    }}

    .viewer {{
      max-width: {max_width:.3f}px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    .page {{
      position: relative;
      background: var(--paper);
      box-shadow: 0 8px 24px var(--shadow);
      overflow: hidden;
    }}

    .overlay {{
      position: absolute;
      inset: 0;
      pointer-events: none;
    }}

    .t {{
      position: absolute;
      white-space: pre;
      line-height: 1;
      transform-origin: top left;
    }}

    @media print {{
      body {{
        background: #fff;
        padding: 0;
      }}

      .viewer {{
        gap: 0;
      }}

      .page {{
        box-shadow: none;
        page-break-after: always;
        margin: 0 auto;
      }}

      .page:last-child {{
        page-break-after: auto;
      }}
    }}
  </style>
</head>
<body>
  <main class="viewer">
    {''.join(pages_html)}
  </main>
</body>
</html>
'''
    Path(output_html).write_text(html_doc, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert PDF to absolutely-positioned HTML with SVG vector lines."
    )
    parser.add_argument("input_pdf", help="Input PDF path")
    parser.add_argument("output_html", help="Output HTML path")
    parser.add_argument(
        "--scale",
        type=float,
        default=1.5,
        help="Scale factor from PDF points to CSS pixels",
    )
    args = parser.parse_args()

    convert_pdf_to_html(args.input_pdf, args.output_html, scale=args.scale)