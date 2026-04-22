from __future__ import annotations

import argparse
import html
import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import fitz  # PyMuPDF
import numpy as np
import pytesseract


@dataclass
class Segment:
    orient: str  # 'h' or 'v'
    pos: float
    start: float
    end: float
    width: float = 1.0

    def length(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class WordBox:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    conf: float = 100.0
    source: str = "pdf"

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2.0

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0


@dataclass
class Cell:
    r0: int
    r1: int
    c0: int
    c1: int
    bbox: Tuple[float, float, float, float]
    text: str = ""
    words: List[WordBox] = field(default_factory=list)
    h_align: str = "left"
    v_align: str = "top"


@dataclass
class TableBlock:
    bbox: Tuple[float, float, float, float]
    x_lines: List[float]
    y_lines: List[float]
    cells: List[Cell]


@dataclass
class TextBlock:
    bbox: Tuple[float, float, float, float]
    lines: List[str]


@dataclass
class PageLayout:
    width: float
    height: float
    mode: str
    tables: List[TableBlock]
    texts: List[TextBlock]


def cluster_values(values: List[float], tol: float) -> List[float]:
    values = sorted(values)
    if not values:
        return []
    groups: List[List[float]] = [[values[0]]]
    for v in values[1:]:
        if abs(v - groups[-1][-1]) <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [sum(g) / len(g) for g in groups]


def merge_axis_positions(values: List[float], tol: float, min_gap: float) -> List[float]:
    clustered = cluster_values(values, tol)
    if not clustered:
        return []
    out = [clustered[0]]
    for v in clustered[1:]:
        if v - out[-1] < min_gap:
            out[-1] = (out[-1] + v) / 2.0
        else:
            out.append(v)
    return out


def merge_segments(segments: List[Segment], pos_tol: float, gap_tol: float) -> List[Segment]:
    merged: List[Segment] = []
    for orient in ("h", "v"):
        arr = [s for s in segments if s.orient == orient and s.length() > 0.5]
        arr.sort(key=lambda s: (s.pos, s.start, s.end))
        groups: List[List[Segment]] = []
        for seg in arr:
            if not groups or abs(seg.pos - groups[-1][0].pos) > pos_tol:
                groups.append([seg])
            else:
                groups[-1].append(seg)

        for group in groups:
            pos = sum(s.pos for s in group) / len(group)
            group = sorted(group, key=lambda s: s.start)
            cur_start, cur_end = group[0].start, group[0].end
            cur_width = max(s.width for s in group)
            for seg in group[1:]:
                if seg.start <= cur_end + gap_tol:
                    cur_end = max(cur_end, seg.end)
                    cur_width = max(cur_width, seg.width)
                else:
                    merged.append(Segment(orient, pos, cur_start, cur_end, cur_width))
                    cur_start, cur_end, cur_width = seg.start, seg.end, seg.width
            merged.append(Segment(orient, pos, cur_start, cur_end, cur_width))
    return merged


def segment_connected(a: Segment, b: Segment, tol: float) -> bool:
    if a.orient == b.orient:
        if abs(a.pos - b.pos) > tol:
            return False
        return not (a.end < b.start - tol or b.end < a.start - tol)

    if a.orient == "h" and b.orient == "v":
        return (a.start - tol <= b.pos <= a.end + tol) and (b.start - tol <= a.pos <= b.end + tol)
    if a.orient == "v" and b.orient == "h":
        return (b.start - tol <= a.pos <= b.end + tol) and (a.start - tol <= b.pos <= a.end + tol)
    return False


def connected_components(segments: List[Segment], tol: float) -> List[List[Segment]]:
    n = len(segments)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(n):
        for j in range(i + 1, n):
            if segment_connected(segments[i], segments[j], tol):
                union(i, j)

    comps: Dict[int, List[Segment]] = {}
    for i in range(n):
        comps.setdefault(find(i), []).append(segments[i])
    return list(comps.values())


def component_bbox(segments: List[Segment]) -> Tuple[float, float, float, float]:
    xs0: List[float] = []
    ys0: List[float] = []
    xs1: List[float] = []
    ys1: List[float] = []
    for seg in segments:
        if seg.orient == "h":
            xs0.append(seg.start)
            xs1.append(seg.end)
            ys0.append(seg.pos)
            ys1.append(seg.pos)
        else:
            xs0.append(seg.pos)
            xs1.append(seg.pos)
            ys0.append(seg.start)
            ys1.append(seg.end)
    return (min(xs0), min(ys0), max(xs1), max(ys1))


def extract_vector_segments(page: fitz.Page, small_box: float = 22.0) -> List[Segment]:
    segs: List[Segment] = []
    for drawing in page.get_drawings():
        width = float(drawing.get("width", 1.0) or 1.0)
        for item in drawing.get("items", []):
            kind = item[0]
            if kind == "l":
                p1, p2 = item[1], item[2]
                if abs(p1.y - p2.y) <= 1.5 and abs(p1.x - p2.x) >= 4:
                    segs.append(Segment("h", (p1.y + p2.y) / 2.0, min(p1.x, p2.x), max(p1.x, p2.x), width))
                elif abs(p1.x - p2.x) <= 1.5 and abs(p1.y - p2.y) >= 4:
                    segs.append(Segment("v", (p1.x + p2.x) / 2.0, min(p1.y, p2.y), max(p1.y, p2.y), width))
            elif kind == "re":
                rect = item[1]
                if rect.width < small_box and rect.height < small_box:
                    continue
                segs.extend(
                    [
                        Segment("h", rect.y0, rect.x0, rect.x1, width),
                        Segment("h", rect.y1, rect.x0, rect.x1, width),
                        Segment("v", rect.x0, rect.y0, rect.y1, width),
                        Segment("v", rect.x1, rect.y0, rect.y1, width),
                    ]
                )
    return merge_segments(segs, pos_tol=1.2, gap_tol=2.5)


def render_page_gray(page: fitz.Page, zoom: float = 3.0) -> Tuple[np.ndarray, np.ndarray]:
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return img, gray


def extract_raster_segments(page: fitz.Page, zoom: float = 3.0) -> Tuple[List[Segment], np.ndarray]:
    _, gray = render_page_gray(page, zoom=zoom)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(30, gray.shape[1] // 18), 1))
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(30, gray.shape[0] // 18)))
    hmask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)
    vmask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)
    hmask = cv2.dilate(hmask, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 1)), iterations=1)
    vmask = cv2.dilate(vmask, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5)), iterations=1)

    sx = page.rect.width / gray.shape[1]
    sy = page.rect.height / gray.shape[0]
    segs: List[Segment] = []

    contours, _ = cv2.findContours(hmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < gray.shape[1] * 0.05 or h > gray.shape[0] * 0.02:
            continue
        segs.append(Segment("h", (y + h / 2.0) * sy, x * sx, (x + w) * sx, max(1.0, h * sy)))

    contours, _ = cv2.findContours(vmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if h < gray.shape[0] * 0.05 or w > gray.shape[1] * 0.02:
            continue
        segs.append(Segment("v", (x + w / 2.0) * sx, y * sy, (y + h) * sy, max(1.0, w * sx)))

    return merge_segments(segs, pos_tol=max(sx, sy) * 4.0, gap_tol=max(sx, sy) * 8.0), gray


def pdf_words(page: fitz.Page) -> List[WordBox]:
    out: List[WordBox] = []
    for w in page.get_text("words"):
        x0, y0, x1, y1, text, *_ = w
        text = str(text).strip()
        if text:
            out.append(WordBox(x0, y0, x1, y1, text, 100.0, "pdf"))
    return out


def ocr_words(gray: np.ndarray, page: fitz.Page, lang: str = "Hangul+eng") -> List[WordBox]:
    data = pytesseract.image_to_data(
        gray,
        lang=lang,
        config="--oem 1 --psm 11",
        output_type=pytesseract.Output.DICT,
    )
    sx = page.rect.width / gray.shape[1]
    sy = page.rect.height / gray.shape[0]
    out: List[WordBox] = []
    for text, conf, left, top, width, height in zip(
        data["text"],
        data["conf"],
        data["left"],
        data["top"],
        data["width"],
        data["height"],
    ):
        text = (text or "").strip()
        if not text:
            continue
        try:
            confidence = float(conf)
        except Exception:
            confidence = -1.0
        out.append(
            WordBox(
                left * sx,
                top * sy,
                (left + width) * sx,
                (top + height) * sy,
                text,
                confidence,
                "ocr",
            )
        )
    return out


def bbox_contains(bbox: Tuple[float, float, float, float], x: float, y: float, pad: float = 0.0) -> bool:
    x0, y0, x1, y1 = bbox
    return x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad


def bbox_iou(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0 = max(ax0, bx0)
    iy0 = max(ay0, by0)
    ix1 = min(ax1, bx1)
    iy1 = min(ay1, by1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    area = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter
    return inter / area if area > 0 else 0.0


def has_vertical(vs: List[Segment], x: float, y0: float, y1: float, pos_tol: float) -> bool:
    for seg in vs:
        if abs(seg.pos - x) <= pos_tol and seg.start <= y0 + pos_tol and seg.end >= y1 - pos_tol:
            return True
    return False


def has_horizontal(hs: List[Segment], y: float, x0: float, x1: float, pos_tol: float) -> bool:
    for seg in hs:
        if abs(seg.pos - y) <= pos_tol and seg.start <= x0 + pos_tol and seg.end >= x1 - pos_tol:
            return True
    return False


def build_table(component: List[Segment], page_rect: fitz.Rect, mode: str) -> Optional[TableBlock]:
    bbox = component_bbox(component)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]

    if width < page_rect.width * 0.08 or height < page_rect.height * 0.04:
        return None
    if width > page_rect.width * 0.95 and height > page_rect.height * 0.95:
        return None

    pos_tol = 2.5 if mode == "scan" else 1.2
    min_gap = 5.0 if mode == "scan" else 3.0

    vs = [s for s in component if s.orient == "v"]
    hs = [s for s in component if s.orient == "h"]
    x_lines = merge_axis_positions([s.pos for s in vs], tol=pos_tol, min_gap=min_gap)
    y_lines = merge_axis_positions([s.pos for s in hs], tol=pos_tol, min_gap=min_gap)

    if len(x_lines) < 2 or len(y_lines) < 2:
        return None

    x_lines = [x for x in x_lines if bbox[0] - pos_tol <= x <= bbox[2] + pos_tol]
    y_lines = [y for y in y_lines if bbox[1] - pos_tol <= y <= bbox[3] + pos_tol]
    rows = len(y_lines) - 1
    cols = len(x_lines) - 1
    if rows <= 0 or cols <= 0:
        return None

    atomic = [
        (r, c)
        for r in range(rows)
        for c in range(cols)
        if (x_lines[c + 1] - x_lines[c] > 1.5 and y_lines[r + 1] - y_lines[r] > 1.5)
    ]

    parent = {rc: rc for rc in atomic}

    def find(a: Tuple[int, int]) -> Tuple[int, int]:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: Tuple[int, int], b: Tuple[int, int]) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for r, c in atomic:
        if c + 1 < cols and (r, c + 1) in parent:
            x = x_lines[c + 1]
            if not has_vertical(vs, x, y_lines[r], y_lines[r + 1], pos_tol):
                union((r, c), (r, c + 1))
        if r + 1 < rows and (r + 1, c) in parent:
            y = y_lines[r + 1]
            if not has_horizontal(hs, y, x_lines[c], x_lines[c + 1], pos_tol):
                union((r, c), (r + 1, c))

    groups: Dict[Tuple[int, int], List[Tuple[int, int]]] = {}
    for rc in atomic:
        groups.setdefault(find(rc), []).append(rc)

    cells: List[Cell] = []
    for group in groups.values():
        rs = [r for r, _ in group]
        cs = [c for _, c in group]
        r0, r1 = min(rs), max(rs) + 1
        c0, c1 = min(cs), max(cs) + 1
        cells.append(Cell(r0, r1, c0, c1, (x_lines[c0], y_lines[r0], x_lines[c1], y_lines[r1])))

    cells.sort(key=lambda c: (c.r0, c.c0, c.r1, c.c1))
    return TableBlock(bbox=bbox, x_lines=x_lines, y_lines=y_lines, cells=cells)


def classify_page(page: fitz.Page) -> str:
    if len(page.get_text("words")) >= 20 and len(page.get_drawings()) >= 10:
        return "vector"
    return "scan"


def detect_tables(page: fitz.Page, mode: str, gray: Optional[np.ndarray]) -> Tuple[List[TableBlock], Optional[np.ndarray]]:
    if mode == "vector":
        segments = extract_vector_segments(page)
    else:
        segments, gray = extract_raster_segments(page, zoom=3.0)

    if not segments:
        return [], gray

    comps = connected_components(segments, tol=3.5 if mode == "scan" else 2.0)
    tables: List[TableBlock] = []
    for comp in comps:
        table = build_table(comp, page.rect, mode)
        if table is not None:
            tables.append(table)

    tables.sort(key=lambda t: (t.bbox[2] - t.bbox[0]) * (t.bbox[3] - t.bbox[1]), reverse=True)
    final: List[TableBlock] = []
    for table in tables:
        if any(bbox_iou(table.bbox, existing.bbox) > 0.8 for existing in final):
            continue
        final.append(table)
    final.sort(key=lambda t: (t.bbox[1], t.bbox[0]))
    return final, gray


def choose_words(page: fitz.Page, gray: Optional[np.ndarray]) -> Tuple[List[WordBox], Optional[np.ndarray]]:
    words = pdf_words(page)
    if len(words) >= 20:
        return words, gray
    if gray is None:
        _, gray = render_page_gray(page, zoom=3.0)
    return ocr_words(gray, page), gray


def group_words_to_lines(words: List[WordBox], y_tol: Optional[float] = None) -> List[List[WordBox]]:
    if not words:
        return []
    words = sorted(words, key=lambda w: (w.cy, w.x0))
    if y_tol is None:
        heights = [max(1.0, w.height) for w in words]
        y_tol = max(2.0, statistics.median(heights) * 0.45)

    lines: List[List[WordBox]] = []
    cur = [words[0]]
    cur_y = words[0].cy
    for word in words[1:]:
        if abs(word.cy - cur_y) <= y_tol:
            cur.append(word)
            cur_y = (cur_y * (len(cur) - 1) + word.cy) / len(cur)
        else:
            lines.append(sorted(cur, key=lambda w: w.x0))
            cur = [word]
            cur_y = word.cy
    if cur:
        lines.append(sorted(cur, key=lambda w: w.x0))
    return lines


def line_text(words: List[WordBox]) -> str:
    if not words:
        return ""
    heights = [max(1.0, w.height) for w in words]
    gap_threshold = max(1.5, statistics.median(heights) * 0.35)
    parts: List[str] = []
    prev: Optional[WordBox] = None
    for word in sorted(words, key=lambda w: w.x0):
        text = (word.text or "").strip()
        if not text:
            continue
        if prev is not None and word.x0 - prev.x1 > gap_threshold:
            parts.append(" ")
        parts.append(text)
        prev = word
    text = "".join(parts)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def text_quality_score(text: str) -> float:
    if not text:
        return 0.0
    compact = re.sub(r"\s+", "", text)
    if not compact:
        return 0.0
    good = len(re.findall(r"[0-9A-Za-z가-힣()\-/:.,%&※]", compact))
    junk = len(compact) - good
    line_bonus = min(3, max(1, len([x for x in text.splitlines() if x.strip()])))
    return good - junk * 1.5 + line_bonus * 0.5


def ocr_crop(page: fitz.Page, gray: np.ndarray, bbox: Tuple[float, float, float, float], lang: str = "Hangul+eng") -> str:
    x0, y0, x1, y1 = bbox
    sx = gray.shape[1] / page.rect.width
    sy = gray.shape[0] / page.rect.height
    ix0 = max(0, int(round((x0 + 1.5) * sx)))
    iy0 = max(0, int(round((y0 + 1.5) * sy)))
    ix1 = min(gray.shape[1], int(round((x1 - 1.5) * sx)))
    iy1 = min(gray.shape[0], int(round((y1 - 1.5) * sy)))
    if ix1 <= ix0 or iy1 <= iy0:
        return ""

    crop = gray[iy0:iy1, ix0:ix1]
    if crop.size == 0:
        return ""

    psm = 7 if crop.shape[0] < 70 else 6
    binary = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    candidates = []
    for image in (crop, binary):
        raw = pytesseract.image_to_string(image, lang=lang, config=f"--oem 1 --psm {psm}")
        cleaned = "\n".join(line.strip() for line in raw.splitlines() if line.strip()).strip()
        candidates.append(cleaned)
    return max(candidates, key=text_quality_score)


def assign_words_to_cells(table: TableBlock, words: List[WordBox], page: fitz.Page, gray: Optional[np.ndarray]) -> None:
    for cell in table.cells:
        selected = [w for w in words if bbox_contains(cell.bbox, w.cx, w.cy, pad=0.5)]
        cell.words = selected
        lines = group_words_to_lines(selected)
        text_lines = [line_text(line) for line in lines if line_text(line)]
        page_text = "\n".join(text_lines).strip()
        if gray is not None:
            crop_text = ocr_crop(page, gray, cell.bbox)
            cell.text = crop_text if text_quality_score(crop_text) > text_quality_score(page_text) else page_text
        else:
            cell.text = page_text

        x0, y0, x1, y1 = cell.bbox
        if selected:
            tx0 = min(w.x0 for w in selected)
            tx1 = max(w.x1 for w in selected)
            ty0 = min(w.y0 for w in selected)
            ty1 = max(w.y1 for w in selected)
            lm = tx0 - x0
            rm = x1 - tx1
            tw = tx1 - tx0
            th = ty1 - ty0
            cw = x1 - x0
            ch = y1 - y0
            if abs(lm - rm) <= max(3.0, cw * 0.12) and tw < cw * 0.85:
                cell.h_align = "center"
            elif rm < cw * 0.08 and lm > cw * 0.18:
                cell.h_align = "right"
            else:
                cell.h_align = "left"
            cell.v_align = "top" if (ty0 - y0) < ch * 0.22 or th > ch * 0.45 else "middle"
        else:
            cell.h_align = "left"
            cell.v_align = "top"


def words_outside_tables(words: List[WordBox], tables: List[TableBlock]) -> List[WordBox]:
    out: List[WordBox] = []
    for word in words:
        if any(bbox_contains(table.bbox, word.cx, word.cy, pad=0.5) for table in tables):
            continue
        out.append(word)
    return out


def group_text_blocks(words: List[WordBox], page_width: float) -> List[TextBlock]:
    if not words:
        return []

    runs: List[Tuple[Tuple[float, float, float, float], str]] = []
    for line in group_words_to_lines(words):
        if not line:
            continue
        heights = [max(1.0, w.height) for w in line]
        gap_threshold = max(6.0, statistics.median(heights) * 4.0)
        cur = [line[0]]
        for word in line[1:]:
            if word.x0 - cur[-1].x1 > gap_threshold:
                txt = line_text(cur)
                if txt:
                    bbox = (
                        min(w.x0 for w in cur),
                        min(w.y0 for w in cur),
                        max(w.x1 for w in cur),
                        max(w.y1 for w in cur),
                    )
                    runs.append((bbox, txt))
                cur = [word]
            else:
                cur.append(word)
        txt = line_text(cur)
        if txt:
            bbox = (
                min(w.x0 for w in cur),
                min(w.y0 for w in cur),
                max(w.x1 for w in cur),
                max(w.y1 for w in cur),
            )
            runs.append((bbox, txt))

    blocks: List[TextBlock] = []
    for bbox, txt in sorted(runs, key=lambda item: (item[0][1], item[0][0])):
        if not blocks:
            blocks.append(TextBlock(bbox, [txt]))
            continue
        prev = blocks[-1]
        px0, py0, px1, py1 = prev.bbox
        x0, y0, x1, y1 = bbox
        same_column = abs(x0 - px0) < page_width * 0.08 or (min(x1, px1) - max(x0, px0)) > 0
        close_y = y0 - py1 <= max(8.0, (py1 - py0) * 1.3)
        if same_column and close_y:
            prev.lines.append(txt)
            prev.bbox = (min(px0, x0), min(py0, y0), max(px1, x1), max(py1, y1))
        else:
            blocks.append(TextBlock(bbox, [txt]))
    return blocks


def layout_page(page: fitz.Page) -> PageLayout:
    mode = classify_page(page)
    gray: Optional[np.ndarray] = None
    tables, gray = detect_tables(page, mode, gray)
    words, gray = choose_words(page, gray)
    for table in tables:
        assign_words_to_cells(table, words, page, gray if mode == "scan" else None)
    text_blocks = group_text_blocks(words_outside_tables(words, tables), page.rect.width)
    return PageLayout(page.rect.width, page.rect.height, mode, tables, text_blocks)


def html_escape_preserve(text: str) -> str:
    if not text:
        return ""
    return "<br>".join(html.escape(line) for line in text.splitlines())


def table_to_matrix(table: TableBlock) -> Tuple[int, int, Dict[Tuple[int, int], Cell]]:
    rows = len(table.y_lines) - 1
    cols = len(table.x_lines) - 1
    mapping: Dict[Tuple[int, int], Cell] = {}
    for cell in table.cells:
        mapping[(cell.r0, cell.c0)] = cell
    return rows, cols, mapping


def emit_table_html(table: TableBlock, page_width: float, page_height: float) -> str:
    rows, cols, mapping = table_to_matrix(table)
    total_width = max(1.0, table.bbox[2] - table.bbox[0])
    col_widths = [table.x_lines[i + 1] - table.x_lines[i] for i in range(cols)]
    table_style = (
        f"left:{table.bbox[0] / page_width * 100:.4f}%;"
        f"top:{table.bbox[1] / page_height * 100:.4f}%;"
        f"width:{(table.bbox[2] - table.bbox[0]) / page_width * 100:.4f}%;"
    )
    colgroup = "".join(f'<col style="width:{w / total_width * 100:.4f}%">' for w in col_widths)
    skip = set()
    row_html: List[str] = []
    for r in range(rows):
        parts = []
        for c in range(cols):
            if (r, c) in skip:
                continue
            cell = mapping.get((r, c))
            if cell is None:
                continue
            rowspan = cell.r1 - cell.r0
            colspan = cell.c1 - cell.c0
            for rr in range(cell.r0, cell.r1):
                for cc in range(cell.c0, cell.c1):
                    if (rr, cc) != (r, c):
                        skip.add((rr, cc))
            classes = f"halign-{cell.h_align} valign-{cell.v_align}"
            parts.append(
                f'<td class="{classes}" rowspan="{rowspan}" colspan="{colspan}">{html_escape_preserve(cell.text)}</td>'
            )
        row_html.append("<tr>" + "".join(parts) + "</tr>")
    return f'<table class="table-block" style="{table_style}"><colgroup>{colgroup}</colgroup><tbody>{"".join(row_html)}</tbody></table>'


def emit_text_html(block: TextBlock, page_width: float, page_height: float) -> str:
    x0, y0, x1, y1 = block.bbox
    style = (
        f"left:{x0 / page_width * 100:.4f}%;"
        f"top:{y0 / page_height * 100:.4f}%;"
        f"width:{(x1 - x0) / page_width * 100:.4f}%;"
    )
    content = "<br>".join(html.escape(line) for line in block.lines)
    return f'<div class="text-block" style="{style}">{content}</div>'


def emit_html(layouts: List[PageLayout], title: str) -> str:
    pages: List[str] = []
    for i, layout in enumerate(layouts, start=1):
        blocks: List[str] = []
        for table in layout.tables:
            blocks.append(emit_table_html(table, layout.width, layout.height))
        for block in layout.texts:
            blocks.append(emit_text_html(block, layout.width, layout.height))
        pages.append(
            f'<section class="page" data-page="{i}" style="aspect-ratio:{layout.width:.3f}/{layout.height:.3f}"><div class="page-inner">{"".join(blocks)}</div></section>'
        )

    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --paper-w: 860px;
      --canvas-bg: #ececec;
      --paper-bg: #fff;
      --line: #2f2f2f;
      --text: #1a1a1a;
    }}

    * {{ box-sizing: border-box; }}

    body {{
      margin: 0;
      background: var(--canvas-bg);
      color: var(--text);
      font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
      padding: 24px 12px 40px;
    }}

    .viewer {{
      max-width: var(--paper-w);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    .page {{
      position: relative;
      width: min(100%, var(--paper-w));
      background: var(--paper-bg);
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      overflow: hidden;
    }}

    .page-inner {{
      position: absolute;
      inset: 0;
      font-size: 12px;
      line-height: 1.25;
    }}

    .table-block {{
      position: absolute;
      border-collapse: collapse;
      border-spacing: 0;
      table-layout: fixed;
      background: #fff;
      font-size: 1em;
    }}

    .table-block td {{
      border: 1px solid var(--line);
      padding: 4px 6px;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      vertical-align: top;
      min-height: 18px;
    }}

    .table-block td.halign-center {{ text-align: center; }}
    .table-block td.halign-right {{ text-align: right; }}
    .table-block td.halign-left {{ text-align: left; }}
    .table-block td.valign-middle {{ vertical-align: middle; }}
    .table-block td.valign-top {{ vertical-align: top; }}

    .text-block {{
      position: absolute;
      white-space: pre-wrap;
      word-break: keep-all;
      overflow-wrap: anywhere;
      font-size: 1em;
      line-height: 1.3;
    }}

    @media print {{
      body {{ background: #fff; padding: 0; }}
      .viewer {{ gap: 0; max-width: none; }}
      .page {{ width: 210mm; box-shadow: none; page-break-after: always; }}
      .page:last-child {{ page-break-after: auto; }}
    }}
  </style>
</head>
<body>
  <main class="viewer">
    {''.join(pages)}
  </main>
</body>
</html>'''


def convert_pdf_to_html(input_pdf: str, output_html: str) -> None:
    doc = fitz.open(input_pdf)
    layouts = [layout_page(page) for page in doc]
    html_text = emit_html(layouts, Path(input_pdf).stem)
    Path(output_html).write_text(html_text, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Frame-first generic PDF to semantic HTML converter.")
    parser.add_argument("input_pdf", help="Input PDF path")
    parser.add_argument("output_html", help="Output HTML path")
    args = parser.parse_args()
    convert_pdf_to_html(args.input_pdf, args.output_html)
