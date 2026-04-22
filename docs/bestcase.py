from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

import fitz  # PyMuPDF


BASE_W = 595.0
BASE_H = 842.0


def scale_rect(page: fitz.Page, x0: float, y0: float, x1: float, y1: float) -> fitz.Rect:
    sx = page.rect.width / BASE_W
    sy = page.rect.height / BASE_H
    return fitz.Rect(x0 * sx, y0 * sy, x1 * sx, y1 * sy)


def get_words(page: fitz.Page):
    return page.get_text("words")


def words_in_rect(words, rect: fitz.Rect):
    out = []
    for w in words:
        x0, y0, x1, y1, text, block_no, line_no, word_no = w
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        if rect.x0 <= cx <= rect.x1 and rect.y0 <= cy <= rect.y1:
            out.append(w)
    out.sort(key=lambda w: (round((w[1] + w[3]) / 2, 1), w[0]))
    return out


def join_words_as_lines(words_in_region, y_tol: float = 3.0) -> list[str]:
    if not words_in_region:
        return []

    lines: list[list[tuple]] = []
    current: list[tuple] = []
    current_y = None

    for w in words_in_region:
        y = (w[1] + w[3]) / 2
        if current_y is None or abs(y - current_y) <= y_tol:
            current.append(w)
            current_y = y if current_y is None else (current_y + y) / 2
        else:
            lines.append(current)
            current = [w]
            current_y = y
    if current:
        lines.append(current)

    results: list[str] = []
    for line in lines:
        line = sorted(line, key=lambda w: w[0])
        parts: list[str] = []
        prev = None
        for w in line:
            text = str(w[4]).strip()
            if not text:
                continue
            if prev is not None:
                gap = w[0] - prev[2]
                if gap > 1.5:
                    parts.append(" ")
            parts.append(text)
            prev = w
        s = "".join(parts).strip()
        if s:
            results.append(s)
    return results


def text_in_rect(page: fitz.Page, rect: fitz.Rect) -> str:
    words = get_words(page)
    lines = join_words_as_lines(words_in_rect(words, rect))
    return "\n".join(lines).strip()


def parse_header_line(text: str, label: str) -> str:
    m = re.search(rf"{re.escape(label)}\s*:\s*(.+)", text)
    return m.group(1).strip() if m else text.strip()


def detect_checked_boxes(page: fitz.Page) -> dict[str, bool]:
    drawings = page.get_drawings()
    lines = []
    for d in drawings:
        for item in d.get("items", []):
            if item[0] == "l":
                p1, p2 = item[1], item[2]
                lines.append(
                    fitz.Rect(
                        min(p1.x, p2.x),
                        min(p1.y, p2.y),
                        max(p1.x, p2.x),
                        max(p1.y, p2.y),
                    )
                )

    box_defs = {
        "신규": scale_rect(page, 111.0, 38.0, 121.5, 48.8),
        "재발급": scale_rect(page, 179.0, 38.0, 189.8, 48.8),
        "Off-Line등록": scale_rect(page, 111.0, 57.7, 121.5, 68.4),
    }

    result = {}
    for label, box in box_defs.items():
        found = False
        for line_rect in lines:
            if box.intersects(line_rect):
                found = True
                break
        result[label] = found
    return result


def extract_notes(page: fitz.Page) -> list[str]:
    rect = scale_rect(page, 28, 509, 560, 570)
    lines = join_words_as_lines(words_in_rect(get_words(page), rect))
    notes: list[str] = []
    current = ""
    for line in lines:
        if line.startswith("○"):
            if current:
                notes.append(current.strip())
            current = line.lstrip("○").strip()
        else:
            current += " " + line.strip()
    if current:
        notes.append(current.strip())
    return notes


def extract_approvals(page: fitz.Page) -> list[tuple[str, str, str]]:
    rows = [
        scale_rect(page, 246, 30, 560, 45),
        scale_rect(page, 246, 45, 560, 60),
        scale_rect(page, 246, 60, 560, 75),
        scale_rect(page, 246, 75, 560, 90),
    ]
    approvals = []
    for rect in rows:
        line = text_in_rect(page, rect).replace("\n", " ").strip()
        if not line:
            continue
        m = re.match(r"([A-Z]+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})", line)
        if m:
            approvals.append((m.group(1), m.group(2), m.group(3)))
        else:
            parts = line.split()
            if len(parts) >= 3:
                approvals.append((parts[0], parts[1], " ".join(parts[2:])))
    return approvals


def nl_lines(value: str) -> str:
    if not value:
        return ""
    return "<br>".join(html.escape(line) for line in value.splitlines())


def extract_work_order_fields(pdf_path: str | Path) -> dict:
    doc = fitz.open(pdf_path)
    page = doc[0]

    header_left = text_in_rect(page, scale_rect(page, 25, 10, 240, 28))
    header_right = text_in_rect(page, scale_rect(page, 445, 10, 570, 28))
    checked = detect_checked_boxes(page)

    data = {
        "form_name": parse_header_line(header_left, "양식명(코드)"),
        "doc_no_top": parse_header_line(header_right, "문서번호"),
        "kinds": [
            {"label": "신규", "checked": checked.get("신규", False)},
            {"label": "재발급", "checked": checked.get("재발급", False)},
            {"label": "Off-Line등록", "checked": checked.get("Off-Line등록", False)},
        ],
        "writer": text_in_rect(page, scale_rect(page, 103, 82, 240, 102)),
        "approvals": extract_approvals(page),
        "doc_no": text_in_rect(page, scale_rect(page, 102, 111, 205, 127)),
        "issue_date": text_in_rect(page, scale_rect(page, 281, 111, 385, 127)),
        "partner_approval_date": text_in_rect(page, scale_rect(page, 459, 111, 563, 127)),
        "project": text_in_rect(page, scale_rect(page, 102, 129, 385, 145)),
        "issuer": text_in_rect(page, scale_rect(page, 459, 129, 563, 145)),
        "contract": text_in_rect(page, scale_rect(page, 102, 147, 385, 163)),
        "receiver": text_in_rect(page, scale_rect(page, 459, 147, 563, 163)),
        "issuer_sign": text_in_rect(page, scale_rect(page, 102, 165, 296, 181)),
        "receiver_sign": text_in_rect(page, scale_rect(page, 370, 165, 563, 181)),
        "title": text_in_rect(page, scale_rect(page, 102, 183, 563, 199)),
        "work_desc": text_in_rect(page, scale_rect(page, 152, 201, 563, 227)),
        "qty_desc": text_in_rect(page, scale_rect(page, 152, 230, 305, 283)),
        "subcontract_amount": text_in_rect(page, scale_rect(page, 407, 230, 563, 283)),
        "start_date": text_in_rect(page, scale_rect(page, 152, 285, 305, 302)),
        "end_date": text_in_rect(page, scale_rect(page, 407, 285, 563, 302)),
        "inspection_method": text_in_rect(page, scale_rect(page, 152, 303, 305, 320)),
        "inspection_time": text_in_rect(page, scale_rect(page, 407, 303, 563, 320)),
        "payment_method": text_in_rect(page, scale_rect(page, 152, 322, 305, 339)),
        "payment_time": text_in_rect(page, scale_rect(page, 407, 322, 563, 339)),
        "materials_condition": text_in_rect(page, scale_rect(page, 152, 341, 563, 357)),
        "price_adjustment": text_in_rect(page, scale_rect(page, 152, 359, 563, 395)),
        "etc": text_in_rect(page, scale_rect(page, 152, 396, 563, 423)),
        "linkage": text_in_rect(page, scale_rect(page, 152, 425, 563, 455)),
        "attachments": text_in_rect(page, scale_rect(page, 152, 457, 563, 511)),
        "notes": extract_notes(page),
    }
    return data


def render_clean_html(data: dict) -> str:
    checks_html = "\n".join(
        f'<span class="check"><span class="checkbox">{"✓" if item["checked"] else ""}</span>{html.escape(item["label"])}</span>'
        for item in data["kinds"]
    )

    approvals_html = "\n".join(
        f"""<div class="approval-row">
          <div class="approval-role">{html.escape(role)}</div>
          <div class="approval-name">{html.escape(name)}</div>
          <div class="approval-date">{html.escape(date)}</div>
        </div>"""
        for role, name, date in data["approvals"]
    )

    notes_html = "\n".join(
        f'<div class="note"><span class="bullet">○</span><span>{html.escape(note)}</span></div>'
        for note in data["notes"]
    )

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(data["title"] or "작업지시서")}</title>
  <style>
    :root {{
      --line: #2f2f2f;
      --label-bg: #efefef;
      --paper: #fff;
      --canvas: #ececec;
      --text: #1b1b1b;
    }}

    * {{ box-sizing: border-box; }}

    body {{
      margin: 0;
      background: var(--canvas);
      color: var(--text);
      font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
    }}

    .wrap {{
      min-height: 100vh;
      padding: 28px 16px 40px;
      display: flex;
      justify-content: center;
    }}

    .page {{
      width: min(100%, 860px);
      background: var(--paper);
      box-shadow: 0 10px 30px rgba(0,0,0,.12);
      padding: 14px 30px 28px;
    }}

    .meta {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 10px;
    }}

    .doc {{
      border: 1px solid var(--line);
      font-size: 13px;
      line-height: 1.35;
    }}

    .row {{
      display: grid;
      border-top: 1px solid var(--line);
    }}
    .row:first-child {{ border-top: 0; }}

    .cell {{
      border-left: 1px solid var(--line);
      padding: 6px 9px;
      min-height: 34px;
      display: flex;
      align-items: center;
      word-break: keep-all;
      white-space: normal;
    }}
    .row > .cell:first-child {{ border-left: 0; }}

    .label {{
      background: var(--label-bg);
      font-weight: 700;
      justify-content: center;
      text-align: center;
    }}

    .top {{ align-items: flex-start; }}
    .center {{ justify-content: center; text-align: center; }}
    .pre {{ white-space: pre-line; }}
    .title {{
      font-size: 15px;
      font-weight: 700;
    }}

    .top-grid {{
      display: grid;
      grid-template-columns: 1.1fr 1.7fr;
      border-top: 0;
    }}

    .top-grid > .cell {{
      padding: 0;
    }}

    .mini-table {{
      width: 100%;
      display: grid;
      grid-template-columns: 72px 1fr;
    }}

    .mini-table .m-label,
    .mini-table .m-value {{
      border-top: 1px solid var(--line);
      padding: 8px 9px;
      min-height: 36px;
      display: flex;
      align-items: center;
    }}
    .mini-table .m-label.first,
    .mini-table .m-value.first {{
      border-top: 0;
    }}
    .mini-table .m-label {{
      background: var(--label-bg);
      font-weight: 700;
      justify-content: center;
      text-align: center;
      border-right: 1px solid var(--line);
    }}

    .kind-area {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      align-items: center;
      padding-left: 2px;
    }}

    .check {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }}

    .checkbox {{
      width: 13px;
      height: 13px;
      border: 1px solid #666;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      line-height: 1;
    }}

    .approval {{
      display: flex;
      flex-direction: column;
    }}

    .approval-row {{
      display: grid;
      grid-template-columns: 62px 96px 1fr;
      min-height: 19.5px;
      border-top: 1px solid var(--line);
    }}
    .approval-row:first-child {{ border-top: 0; }}

    .approval-role,
    .approval-name,
    .approval-date {{
      padding: 5px 8px;
      display: flex;
      align-items: center;
    }}
    .approval-role {{
      background: var(--label-bg);
      font-weight: 700;
      justify-content: center;
      border-right: 1px solid var(--line);
    }}
    .approval-name {{
      justify-content: center;
      border-right: 1px solid var(--line);
    }}

    .g-6 {{ grid-template-columns: 72px 1fr 72px 1fr 107px 1fr; }}
    .g-4b {{ grid-template-columns: 72px 1fr 72px 1fr; }}
    .g-single {{ grid-template-columns: 122px 1fr; }}
    .g-split {{ grid-template-columns: 1fr 1fr; }}

    .subgrid {{
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: 122px 1fr;
    }}
    .subgrid.right {{
      grid-template-columns: 100px 1fr;
    }}
    .subgrid .sub-label,
    .subgrid .sub-value {{
      padding: 8px 9px;
      display: flex;
      min-height: 100%;
    }}
    .subgrid .sub-label {{
      background: var(--label-bg);
      font-weight: 700;
      justify-content: center;
      text-align: center;
      align-items: center;
      border-right: 1px solid var(--line);
    }}
    .subgrid .sub-value {{
      align-items: flex-start;
      white-space: pre-line;
    }}

    .amount {{
      justify-content: center !important;
      align-items: center !important;
      font-size: 18px;
      font-weight: 400;
    }}

    .notes {{
      margin-top: 12px;
      font-size: 13px;
      line-height: 1.45;
      max-width: 710px;
    }}

    .note {{
      display: flex;
      gap: 6px;
      margin: 2px 0;
    }}
    .bullet {{
      width: 14px;
      flex: 0 0 14px;
      text-align: center;
    }}

    .footer-logo {{
      margin-top: 10px;
      text-align: right;
      color: #2f5e92;
      font-weight: 800;
      line-height: 1.1;
    }}
    .footer-logo .mini {{
      font-size: 15px;
      text-transform: lowercase;
    }}
    .footer-logo .ko {{
      font-size: 22px;
      letter-spacing: -0.03em;
    }}

    @media (max-width: 820px) {{
      .page {{ padding: 14px 14px 24px; }}
      .meta, .doc, .notes {{ font-size: 11px; }}
      .title {{ font-size: 13px; }}
      .g-6 {{ grid-template-columns: 58px 1fr 58px 1fr 84px 1fr; }}
      .g-4b {{ grid-template-columns: 58px 1fr 58px 1fr; }}
      .g-single {{ grid-template-columns: 112px 1fr; }}
      .subgrid {{ grid-template-columns: 112px 1fr; }}
      .subgrid.right {{ grid-template-columns: 92px 1fr; }}
      .approval-row {{ grid-template-columns: 52px 72px 1fr; }}
    }}

    @media print {{
      body {{ background: #fff; }}
      .wrap {{ padding: 0; }}
      .page {{
        width: 210mm;
        min-height: 297mm;
        box-shadow: none;
      }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <article class="page">
      <div class="meta">
        <div>양식명(코드) : {html.escape(data["form_name"])}</div>
        <div>문서번호 : {html.escape(data["doc_no_top"])}</div>
      </div>

      <section class="doc">
        <div class="row top-grid" style="min-height: 84px;">
          <div class="cell">
            <div class="mini-table">
              <div class="m-label first">구&nbsp;&nbsp;&nbsp;분</div>
              <div class="m-value first"><div class="kind-area">{checks_html}</div></div>
              <div class="m-label">작 성 자</div>
              <div class="m-value">{html.escape(data["writer"])}</div>
            </div>
          </div>
          <div class="cell">
            <div class="approval">{approvals_html}</div>
          </div>
        </div>

        <div class="row g-6">
          <div class="cell label">문서번호</div>
          <div class="cell">{html.escape(data["doc_no"])}</div>
          <div class="cell label">발급일</div>
          <div class="cell center">{html.escape(data["issue_date"])}</div>
          <div class="cell label">협력사승인일</div>
          <div class="cell center">{html.escape(data["partner_approval_date"])}</div>
        </div>

        <div class="row g-4b">
          <div class="cell label">프로젝트</div>
          <div class="cell">{html.escape(data["project"])}</div>
          <div class="cell label">발급자</div>
          <div class="cell">{html.escape(data["issuer"])}</div>
        </div>

        <div class="row g-4b">
          <div class="cell label">계 약</div>
          <div class="cell">{html.escape(data["contract"])}</div>
          <div class="cell label">접수자</div>
          <div class="cell">{html.escape(data["receiver"])}</div>
        </div>

        <div class="row" style="grid-template-columns: 72px 1fr 72px 1fr;">
          <div class="cell label">발급자 서명</div>
          <div class="cell">{html.escape(data["issuer_sign"])}</div>
          <div class="cell label">접수자 서명</div>
          <div class="cell">{html.escape(data["receiver_sign"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label">제 목</div>
          <div class="cell title">{html.escape(data["title"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label top">1. 공 사 내 용*</div>
          <div class="cell pre top">{nl_lines(data["work_desc"])}</div>
        </div>

        <div class="row g-split" style="min-height: 86px;">
          <div class="cell" style="padding:0;">
            <div class="subgrid">
              <div class="sub-label">1-1. 대표수량, 단가 등*</div>
              <div class="sub-value">{nl_lines(data["qty_desc"])}</div>
            </div>
          </div>
          <div class="cell" style="padding:0;">
            <div class="subgrid right">
              <div class="sub-label">1-2. 하도급 대금<br><span style="font-size:12px;font-weight:400;">(단위 : 원, 직접비)*</span></div>
              <div class="sub-value amount">{html.escape(data["subcontract_amount"])}</div>
            </div>
          </div>
        </div>

        <div class="row" style="grid-template-columns: 122px 1fr 100px 1fr;">
          <div class="cell label">2. 공사착수일*</div>
          <div class="cell center">{html.escape(data["start_date"])}</div>
          <div class="cell label">2-1. 공사완료일*</div>
          <div class="cell center">{html.escape(data["end_date"])}</div>
        </div>

        <div class="row" style="grid-template-columns: 122px 1fr 100px 1fr;">
          <div class="cell label">3. 검사의 방법*</div>
          <div class="cell">{html.escape(data["inspection_method"])}</div>
          <div class="cell label">3-1. 검사의 시기*</div>
          <div class="cell">{html.escape(data["inspection_time"])}</div>
        </div>

        <div class="row" style="grid-template-columns: 122px 1fr 100px 1fr;">
          <div class="cell label">4. 대금 지급방법*</div>
          <div class="cell">{html.escape(data["payment_method"])}</div>
          <div class="cell label">4-1. 대금 지급시기*</div>
          <div class="cell">{html.escape(data["payment_time"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label">5. 원재료 지급시 조건*</div>
          <div class="cell">{html.escape(data["materials_condition"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label top">6. 공급원가 변동에 따른<br>하도급 대금의 조정*</div>
          <div class="cell">{html.escape(data["price_adjustment"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label top">7. 기타</div>
          <div class="cell pre top">{nl_lines(data["etc"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label top">8. 하도급대금 연동에<br>관한 사항</div>
          <div class="cell">{html.escape(data["linkage"])}</div>
        </div>

        <div class="row g-single">
          <div class="cell label top">9. 첨부파일</div>
          <div class="cell pre top">{nl_lines(data["attachments"])}</div>
        </div>
      </section>

      <section class="notes">
        {notes_html}
      </section>

      <div class="footer-logo" aria-label="text-only footer logo">
        <div class="mini">posco</div>
        <div class="ko">포스코이앤씨</div>
      </div>
    </article>
  </div>
</body>
</html>"""


def convert(pdf_path: str | Path, output_html: str | Path) -> None:
    data = extract_work_order_fields(pdf_path)
    html_text = render_clean_html(data)
    Path(output_html).write_text(html_text, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert this 작업지시서 PDF into clean, structured HTML.")
    parser.add_argument("input_pdf")
    parser.add_argument("output_html")
    args = parser.parse_args()
    convert(args.input_pdf, args.output_html)