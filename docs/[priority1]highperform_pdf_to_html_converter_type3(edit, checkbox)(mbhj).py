from __future__ import annotations

import argparse
import base64
import html
import math
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from statistics import median
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import fitz  # PyMuPDF
import numpy as np
import pytesseract
from pytesseract import Output


BBox = Tuple[float, float, float, float]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


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
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)

    @property
    def bbox(self) -> BBox:
        return (self.x0, self.y0, self.x1, self.y1)


@dataclass
class RectBox:
    x0: float
    y0: float
    x1: float
    y1: float
    source: str = "vector"

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)

    @property
    def area(self) -> float:
        return max(0.0, self.width * self.height)

    @property
    def bbox(self) -> BBox:
        return (self.x0, self.y0, self.x1, self.y1)

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2.0

    def contains_point(self, x: float, y: float, pad: float = 0.0) -> bool:
        return self.x0 - pad <= x <= self.x1 + pad and self.y0 - pad <= y <= self.y1 + pad

    def intersects(self, other: "RectBox", pad: float = 0.0) -> bool:
        return not (
            self.x1 + pad < other.x0 or other.x1 + pad < self.x0 or self.y1 + pad < other.y0 or other.y1 + pad < self.y0
        )


@dataclass
class ChoiceMark:
    bbox: RectBox
    checked: bool
    style: str = "fill"

    @property
    def x0(self) -> float:
        return self.bbox.x0

    @property
    def y0(self) -> float:
        return self.bbox.y0

    @property
    def x1(self) -> float:
        return self.bbox.x1

    @property
    def y1(self) -> float:
        return self.bbox.y1

    @property
    def cx(self) -> float:
        return self.bbox.cx

    @property
    def cy(self) -> float:
        return self.bbox.cy

    @property
    def width(self) -> float:
        return self.bbox.width

    @property
    def height(self) -> float:
        return self.bbox.height


@dataclass
class InlineFragment:
    kind: str  # text / choice
    text: str = ""
    checked: bool = False
    style: str = "fill"


@dataclass
class RichLine:
    fragments: List[InlineFragment] = field(default_factory=list)


@dataclass
class Cell:
    rect: RectBox
    col_start: int
    col_end: int
    row_start: int
    row_end: int
    text: str
    font_pt: float
    align: str = "left"
    valign: str = "top"
    bold: bool = False
    lines: List[RichLine] = field(default_factory=list)
    has_choices: bool = False
    bg_image: str = ""


@dataclass
class Table:
    bbox: RectBox
    x_lines: List[float]
    y_lines: List[float]
    cells: List[Cell]
    mode: str


@dataclass
class TextBlock:
    bbox: RectBox
    text: str
    font_pt: float
    align: str
    bold: bool
    lines: List[RichLine] = field(default_factory=list)
    has_choices: bool = False
    bg_image: str = ""


@dataclass
class PageModel:
    number: int
    width: float
    height: float
    mode: str
    tables: List[Table]
    text_blocks: List[TextBlock]


@dataclass
class RasterPage:
    scale: float
    rgb: np.ndarray
    gray: np.ndarray
    binary_inv: np.ndarray


class UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


# ---------------------------------------------------------------------------
# Text and geometry helpers
# ---------------------------------------------------------------------------


GOOD_CHAR_RE = re.compile(r"[0-9A-Za-z가-힣%&@()/:\-.,*+#]")
NOISE_TOKEN_RE = re.compile(r"^[|¦_~=`·•.,;:()\[\]{}<>/\\+=-]+$")
BOX_GLYPH_RE = re.compile(r"^[□■☐☑☒▣▢◻◼◽◾]+$")
CHECKBOX_NOISE_RE = re.compile(r"^(?:[Oo0DQBmMwW@#]+|[□■☐☑☒▣▢◻◼◽◾]+)$")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def bbox_iou(a: RectBox, b: RectBox) -> float:
    ix0 = max(a.x0, b.x0)
    iy0 = max(a.y0, b.y0)
    ix1 = min(a.x1, b.x1)
    iy1 = min(a.y1, b.y1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    union = a.area + b.area - inter
    return inter / union if union > 0 else 0.0


def overlap_ratio(inner: RectBox, outer: RectBox) -> float:
    ix0 = max(inner.x0, outer.x0)
    iy0 = max(inner.y0, outer.y0)
    ix1 = min(inner.x1, outer.x1)
    iy1 = min(inner.y1, outer.y1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    return inter / max(1.0, inner.area)


def sanitize_text(text: str) -> str:
    text = (text or "").replace("\x00", " ").replace("\u00a0", " ")
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_text(text: str) -> str:
    return "\n".join(line for line in (sanitize_text(line) for line in text.splitlines()) if line)


def clean_token(text: str) -> str:
    text = sanitize_text(text)
    if not text:
        return ""
    if NOISE_TOKEN_RE.fullmatch(text):
        return ""
    if GOOD_CHAR_RE.search(text):
        text = re.sub(r"^[|¦_~=`·•.,;:()\[\]{}<>/\\+-]+", "", text)
        text = re.sub(r"[|¦_~=`·•.,;:()\[\]{}<>/\\+-]+$", "", text)
        text = sanitize_text(text)
    if NOISE_TOKEN_RE.fullmatch(text):
        return ""
    return text


def text_quality_score(text: str, avg_conf: float = 0.0) -> float:
    if not text:
        return 0.0
    compact = re.sub(r"\s+", "", text)
    if not compact:
        return 0.0
    good = len(re.findall(r"[0-9A-Za-z가-힣%&@()/:\-.,*+#]", compact))
    box = len(re.findall(r"[□■☐☑☒▣▢◻◼◽◾]", compact))
    bad = len(compact) - good - box
    score = good * 1.7 + box * 1.2 - bad * 1.8 + avg_conf * 0.025
    if good <= 1 and len(compact) <= 2:
        score -= 1.0
    return score


def image_to_data_uri(rgb: np.ndarray) -> str:
    if rgb.size == 0:
        return ""
    ok, buf = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        return ""
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def cluster_values(values: Sequence[float], tol: float) -> List[float]:
    if not values:
        return []
    values = sorted(values)
    groups: List[List[float]] = [[values[0]]]
    for v in values[1:]:
        if abs(v - groups[-1][-1]) <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [sum(group) / len(group) for group in groups]


def merge_axis_positions(values: Sequence[float], tol: float, min_gap: float) -> List[float]:
    clustered = cluster_values(values, tol)
    if not clustered:
        return []
    out = [clustered[0]]
    for value in clustered[1:]:
        if value - out[-1] < min_gap:
            out[-1] = (out[-1] + value) / 2.0
        else:
            out.append(value)
    return out


def merge_intervals(intervals: Sequence[Tuple[float, float]], tol: float = 1.5) -> List[Tuple[float, float]]:
    if not intervals:
        return []
    intervals = sorted(intervals)
    out = [[intervals[0][0], intervals[0][1]]]
    for a, b in intervals[1:]:
        if a > out[-1][1] + tol:
            out.append([a, b])
        else:
            out[-1][1] = max(out[-1][1], b)
    return [(a, b) for a, b in out]


def intervals_cover(intervals: Sequence[Tuple[float, float]], start: float, end: float, tol: float = 1.5) -> bool:
    need = start
    for a, b in intervals:
        if b < need - tol:
            continue
        if a > need + tol:
            return False
        need = max(need, b)
        if need >= end - tol:
            return True
    return False


def dedupe_rects(rects: Sequence[RectBox], tol: float) -> List[RectBox]:
    out: List[RectBox] = []
    for rect in sorted(rects, key=lambda r: (r.y0, r.x0, r.y1, r.x1)):
        if any(abs(rect.x0 - s.x0) <= tol and abs(rect.y0 - s.y0) <= tol and abs(rect.x1 - s.x1) <= tol and abs(rect.y1 - s.y1) <= tol for s in out):
            continue
        out.append(rect)
    return out


def bbox_of(rects: Sequence[RectBox]) -> RectBox:
    return RectBox(min(r.x0 for r in rects), min(r.y0 for r in rects), max(r.x1 for r in rects), max(r.y1 for r in rects), rects[0].source)


def nearest_index(value: float, boundaries: Sequence[float]) -> int:
    return min(range(len(boundaries)), key=lambda i: abs(boundaries[i] - value))


# ---------------------------------------------------------------------------
# Rasterization and OCR
# ---------------------------------------------------------------------------


def rasterize_page(page: fitz.Page, scale: float) -> RasterPage:
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].copy()
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    binary_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    return RasterPage(scale=scale, rgb=img, gray=gray, binary_inv=binary_inv)


def px_rect(rect: RectBox, raster: RasterPage, pad: int = 0) -> Tuple[int, int, int, int]:
    h, w = raster.gray.shape[:2]
    x0 = max(0, min(w, int(math.floor(rect.x0 * raster.scale)) - pad))
    y0 = max(0, min(h, int(math.floor(rect.y0 * raster.scale)) - pad))
    x1 = max(0, min(w, int(math.ceil(rect.x1 * raster.scale)) + pad))
    y1 = max(0, min(h, int(math.ceil(rect.y1 * raster.scale)) + pad))
    return x0, y0, x1, y1


def extract_pdf_words(page: fitz.Page) -> List[WordBox]:
    out: List[WordBox] = []
    for raw in page.get_text("words"):
        x0, y0, x1, y1, text, *_ = raw
        clean = clean_token(str(text))
        if clean:
            out.append(WordBox(float(x0), float(y0), float(x1), float(y1), clean, 100.0, "pdf"))
    return out


def ocr_data_to_words(data: dict, page_rect: RectBox, scale: float, source: str) -> List[WordBox]:
    out: List[WordBox] = []
    for i, raw in enumerate(data.get("text", [])):
        text = clean_token(raw)
        if not text:
            continue
        try:
            conf = float(data["conf"][i])
        except Exception:
            conf = -1.0
        if conf < 10:
            continue
        left = float(data["left"][i])
        top = float(data["top"][i])
        width = float(data["width"][i])
        height = float(data["height"][i])
        out.append(
            WordBox(
                page_rect.x0 + left / scale,
                page_rect.y0 + top / scale,
                page_rect.x0 + (left + width) / scale,
                page_rect.y0 + (top + height) / scale,
                text,
                conf,
                source,
            )
        )
    return out


def join_words_as_lines(words: Sequence[WordBox], y_tol: Optional[float] = None) -> Tuple[List[str], float, List[List[WordBox]]]:
    if not words:
        return [], 11.0, []
    ordered = sorted(words, key=lambda w: (round(w.cy, 2), w.x0))
    if y_tol is None:
        y_tol = max(3.0, median(max(1.0, w.height) for w in ordered) * 0.55)
    lines: List[List[WordBox]] = []
    cur: List[WordBox] = []
    cur_y: Optional[float] = None
    for word in ordered:
        if cur_y is None or abs(word.cy - cur_y) <= y_tol:
            cur.append(word)
            cur_y = word.cy if cur_y is None else (cur_y + word.cy) / 2.0
        else:
            lines.append(sorted(cur, key=lambda w: w.x0))
            cur = [word]
            cur_y = word.cy
    if cur:
        lines.append(sorted(cur, key=lambda w: w.x0))

    rendered: List[str] = []
    heights: List[float] = []
    for line in lines:
        prev: Optional[WordBox] = None
        parts: List[str] = []
        for word in line:
            if prev is not None:
                gap = word.x0 - prev.x1
                gap_th = max(1.3, min(10.0, prev.height * 0.35))
                if gap > gap_th:
                    parts.append(" ")
            parts.append(clean_token(word.text))
            prev = word
            heights.append(word.height)
        rendered.append(sanitize_text("".join(parts)))
    rendered = [line for line in rendered if line]
    return rendered, float(median(heights) if heights else 11.0), lines


def whole_page_ocr_words(page: fitz.Page, raster: RasterPage, lang: str) -> List[WordBox]:
    page_rect = RectBox(0, 0, page.rect.width, page.rect.height, "ocr")
    variants = [raster.gray, cv2.threshold(raster.gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]]
    collected: List[WordBox] = []
    for image in variants[:1]:
        for psm in (6, 11):
            try:
                data = pytesseract.image_to_data(image, lang=lang, config=f"--oem 1 --psm {psm}", output_type=Output.DICT)
            except Exception:
                continue
            collected.extend(ocr_data_to_words(data, page_rect, raster.scale, f"ocr-page-{psm}"))
    deduped: List[WordBox] = []
    for word in sorted(collected, key=lambda w: (w.y0, w.x0, -w.conf)):
        duplicate = False
        for kept in deduped:
            if abs(word.x0 - kept.x0) <= 1.8 and abs(word.y0 - kept.y0) <= 1.8 and abs(word.x1 - kept.x1) <= 2.2 and abs(word.y1 - kept.y1) <= 2.2:
                if word.conf > kept.conf:
                    kept.text = word.text
                    kept.conf = word.conf
                duplicate = True
                break
        if not duplicate:
            deduped.append(word)
    return deduped


def region_psm_candidates(crop_w: int, crop_h: int) -> List[int]:
    if crop_h <= 90 or crop_w >= crop_h * 3.4:
        return [7, 13, 6]
    if crop_h <= 170:
        return [6, 7, 11]
    return [6, 11, 4]


def region_ocr_words(raster: RasterPage, rect: RectBox, lang: str) -> Tuple[List[WordBox], str, float]:
    x0, y0, x1, y1 = px_rect(rect, raster, pad=0)
    inset = max(1, int(min(x1 - x0, y1 - y0) * 0.03))
    x0 += inset
    y0 += inset
    x1 -= inset
    y1 -= inset
    if x1 <= x0 or y1 <= y0:
        return [], "", 0.0

    crop = raster.gray[y0:y1, x0:x1]
    if crop.size == 0:
        return [], "", 0.0
    variants = [crop]
    variants.append(cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1])
    variants.append(cv2.adaptiveThreshold(crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 9))

    best_words: List[WordBox] = []
    best_text = ""
    best_score = 0.0
    for image in variants:
        for psm in region_psm_candidates(crop.shape[1], crop.shape[0]):
            try:
                data = pytesseract.image_to_data(image, lang=lang, config=f"--oem 1 --psm {psm}", output_type=Output.DICT)
            except Exception:
                continue
            words = ocr_data_to_words(data, rect, raster.scale, f"ocr-r{psm}")
            lines, _, _ = join_words_as_lines(words)
            text = normalize_text("\n".join(lines))
            score = text_quality_score(text, sum(w.conf for w in words) / len(words) if words else 0.0)
            if score > best_score:
                best_words, best_text, best_score = words, text, score
    return best_words, best_text, best_score


def select_words(words: Sequence[WordBox], rect: RectBox, overlap_th: float = 0.05, pad: float = 2.0) -> List[WordBox]:
    expanded = RectBox(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad, rect.source)
    out: List[WordBox] = []
    for word in words:
        word_rect = RectBox(word.x0, word.y0, word.x1, word.y1, word.source)
        if expanded.contains_point(word.cx, word.cy) or overlap_ratio(word_rect, expanded) >= overlap_th:
            out.append(word)
    return out


def choose_region_words(page_words: Sequence[WordBox], rect: RectBox, raster: RasterPage, mode: str, lang: str) -> Tuple[List[WordBox], str, float]:
    base_words = select_words(page_words, rect)
    base_lines, _, _ = join_words_as_lines(base_words)
    base_text = normalize_text("\n".join(base_lines))
    base_score = text_quality_score(base_text, sum(w.conf for w in base_words) / len(base_words) if base_words else 0.0)

    # Scan pages already use whole-page OCR. To keep the converter generic and fast,
    # region OCR is only used when a region is truly empty. Degraded-but-nonempty scan
    # regions are preserved and, if needed, backed by a visible crop instead of going blank.
    if mode == "scan":
        # Scan pages already use page-level OCR. Per-cell OCR is deliberately
        # avoided to keep the converter generic, stable, and fast. When scan OCR
        # still misses a region, the renderer shows a crop fallback instead of a blank.
        return base_words, base_text, base_score
    else:
        rescue_needed = (not base_words) or (base_score < 2.4)
        if not rescue_needed:
            return base_words, base_text, base_score

    ocr_words, ocr_text, ocr_score = region_ocr_words(raster, rect, lang)
    if ocr_score > max(base_score + 0.8, 1.8):
        return ocr_words, ocr_text, ocr_score
    if base_score < 1.2 and ocr_score >= 1.0:
        return ocr_words, ocr_text, ocr_score
    return base_words, base_text, base_score


def unresolved_bg(rect: RectBox, raster: RasterPage, score: float) -> str:
    if score >= 1.3:
        return ""
    x0, y0, x1, y1 = px_rect(rect, raster, pad=2)
    crop = raster.rgb[y0:y1, x0:x1]
    if crop.size == 0:
        return ""
    density = float(raster.binary_inv[y0:y1, x0:x1].mean() / 255.0)
    if density < 0.03:
        return ""
    return image_to_data_uri(crop)


# ---------------------------------------------------------------------------
# Structure detection
# ---------------------------------------------------------------------------


def merge_segments(segments: Sequence[Segment], pos_tol: float, gap_tol: float) -> List[Segment]:
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


def extract_raster_segments(page: fitz.Page, raster: RasterPage) -> List[Segment]:
    gray = raster.gray
    binary = raster.binary_inv
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

    return merge_segments(segs, pos_tol=max(sx, sy) * 4.0, gap_tol=max(sx, sy) * 8.0)


def connected_components(segments: Sequence[Segment], tol: float) -> List[List[Segment]]:
    if not segments:
        return []
    uf = UnionFind(len(segments))
    def segment_connected(a: Segment, b: Segment, tol_: float) -> bool:
        if a.orient == b.orient:
            if abs(a.pos - b.pos) > tol_:
                return False
            return not (a.end < b.start - tol_ or b.end < a.start - tol_)
        if a.orient == "h" and b.orient == "v":
            return (a.start - tol_ <= b.pos <= a.end + tol_) and (b.start - tol_ <= a.pos <= b.end + tol_)
        if a.orient == "v" and b.orient == "h":
            return (b.start - tol_ <= a.pos <= b.end + tol_) and (a.start - tol_ <= b.pos <= a.end + tol_)
        return False
    for i in range(len(segments)):
        for j in range(i + 1, len(segments)):
            if segment_connected(segments[i], segments[j], tol):
                uf.union(i, j)
    groups: Dict[int, List[Segment]] = {}
    for i, seg in enumerate(segments):
        groups.setdefault(uf.find(i), []).append(seg)
    return list(groups.values())


def component_bbox(segments: Sequence[Segment]) -> RectBox:
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
    return RectBox(min(xs0), min(ys0), max(xs1), max(ys1), "segment")


def has_vertical(intervals: Dict[float, List[Tuple[float, float]]], x: float, y0: float, y1: float, pos_tol: float) -> bool:
    candidates = [k for k in intervals if abs(k - x) <= pos_tol]
    return any(intervals_cover(intervals[k], y0, y1, pos_tol) for k in candidates)


def has_horizontal(intervals: Dict[float, List[Tuple[float, float]]], y: float, x0: float, x1: float, pos_tol: float) -> bool:
    candidates = [k for k in intervals if abs(k - y) <= pos_tol]
    return any(intervals_cover(intervals[k], x0, x1, pos_tol) for k in candidates)


def classify_page(page: fitz.Page) -> str:
    return "vector" if len(page.get_text("words")) >= 20 and len(page.get_drawings()) >= 10 else "scan"


def detect_rects(page: fitz.Page, raster: RasterPage) -> Tuple[List[RectBox], str]:
    mode = classify_page(page)
    rects: List[RectBox] = []
    if mode == "vector":
        for drawing in page.get_drawings():
            for item in drawing.get("items", []):
                if item[0] == "re":
                    rect = item[1]
                    if rect.width >= 8 and rect.height >= 8:
                        rects.append(RectBox(rect.x0, rect.y0, rect.x1, rect.y1, "vector"))
    else:
        gray = raster.gray
        binary = raster.binary_inv
        contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        sx = page.rect.width / gray.shape[1]
        sy = page.rect.height / gray.shape[0]
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w < 24 or h < 24:
                continue
            approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
            if len(approx) != 4:
                continue
            rects.append(RectBox(x * sx, y * sy, (x + w) * sx, (y + h) * sy, "raster"))
    rects = [r for r in rects if r.width <= page.rect.width * 0.99 and r.height <= page.rect.height * 0.99]
    rects = dedupe_rects(rects, 1.5 if mode == "vector" else 3.5)
    return rects, mode


# ---------------------------------------------------------------------------
# Checkbox detection and rich-line construction
# ---------------------------------------------------------------------------


def fill_ratio_inside(mark_rect: RectBox, raster: RasterPage) -> float:
    x0, y0, x1, y1 = px_rect(mark_rect, raster, pad=0)
    crop = raster.binary_inv[y0:y1, x0:x1]
    if crop.size == 0:
        return 0.0
    pad_y = max(1, int(crop.shape[0] * 0.25))
    pad_x = max(1, int(crop.shape[1] * 0.25))
    inner = crop[pad_y:crop.shape[0] - pad_y, pad_x:crop.shape[1] - pad_x]
    if inner.size == 0:
        inner = crop
    return float(inner.mean() / 255.0)


def dedupe_marks(marks: Sequence[ChoiceMark]) -> List[ChoiceMark]:
    out: List[ChoiceMark] = []
    for mark in sorted(marks, key=lambda m: (m.y0, m.x0, -m.width * m.height)):
        replaced = False
        for i, kept in enumerate(out):
            if bbox_iou(mark.bbox, kept.bbox) > 0.35 or (abs(mark.cx - kept.cx) <= max(mark.width, kept.width) * 0.45 and abs(mark.cy - kept.cy) <= max(mark.height, kept.height) * 0.45):
                if mark.width * mark.height > kept.width * kept.height:
                    out[i] = mark
                replaced = True
                break
        if not replaced:
            out.append(mark)
    return out


def extract_vector_choice_marks(page: fitz.Page, raster: RasterPage) -> List[ChoiceMark]:
    candidates: List[RectBox] = []
    for drawing in page.get_drawings():
        for item in drawing.get("items", []):
            if item[0] != "re":
                continue
            rect = item[1]
            box = RectBox(rect.x0, rect.y0, rect.x1, rect.y1, "vector-box")
            if not (4.5 <= box.width <= 18.0 and 4.5 <= box.height <= 18.0 and 0.72 <= box.width / max(box.height, 0.1) <= 1.28):
                continue
            candidates.append(box)
    outer: List[RectBox] = []
    for box in candidates:
        has_inner = False
        for other in candidates:
            if other is box:
                continue
            if box.x0 <= other.cx <= box.x1 and box.y0 <= other.cy <= box.y1 and other.area < box.area * 0.92:
                has_inner = True
                break
        if has_inner:
            outer.append(box)
    if outer:
        candidates = outer
    marks = [ChoiceMark(box, fill_ratio_inside(box, raster) > 0.12, "fill") for box in candidates]
    return dedupe_marks(marks)


def extract_raster_choice_marks(region: RectBox, raster: RasterPage, hint_words: Sequence[WordBox]) -> List[ChoiceMark]:
    x0, y0, x1, y1 = px_rect(region, raster, pad=0)
    crop = raster.binary_inv[y0:y1, x0:x1].copy()
    if crop.size == 0:
        return []
    border_trim = max(1, int(min(crop.shape[:2]) * 0.02))
    crop[:border_trim, :] = 0
    crop[-border_trim:, :] = 0
    crop[:, :border_trim] = 0
    crop[:, -border_trim:] = 0

    hints = [w.height * raster.scale for w in hint_words if w.height > 0]
    med_word_px = median(hints) if hints else 18.0
    min_side = max(10, int(med_word_px * 0.55))
    max_side = max(min_side + 3, int(med_word_px * 1.8))

    contours, _ = cv2.findContours(crop, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    out: List[ChoiceMark] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if min(w, h) < min_side or max(w, h) > max_side:
            continue
        if not (0.72 <= w / max(h, 1) <= 1.28):
            continue
        if x <= 1 or y <= 1 or x + w >= crop.shape[1] - 1 or y + h >= crop.shape[0] - 1:
            continue
        peri = cv2.arcLength(contour, True)
        if peri <= 0:
            continue
        approx = cv2.approxPolyDP(contour, 0.08 * peri, True)
        if len(approx) < 4 or len(approx) > 8:
            continue
        patch = crop[y:y + h, x:x + w]
        band = max(1, int(min(w, h) * 0.18))
        inner = patch[band:h - band, band:w - band]
        border = patch.copy()
        if inner.size:
            border[band:h - band, band:w - band] = 0
        border_fill = float(border.mean() / 255.0)
        inner_fill = float(inner.mean() / 255.0) if inner.size else 0.0
        if border_fill < 0.14:
            continue
        top_fill = float(patch[:band, :].mean() / 255.0)
        bottom_fill = float(patch[h - band:, :].mean() / 255.0)
        left_fill = float(patch[:, :band].mean() / 255.0)
        right_fill = float(patch[:, w - band:].mean() / 255.0)
        if min(top_fill, bottom_fill, left_fill, right_fill) < 0.08:
            continue
        box = RectBox(region.x0 + x / raster.scale, region.y0 + y / raster.scale, region.x0 + (x + w) / raster.scale, region.y0 + (y + h) / raster.scale, "raster-box")
        overlapping_words = []
        for word in hint_words:
            word_rect = RectBox(word.x0, word.y0, word.x1, word.y1, word.source)
            if overlap_ratio(box, word_rect) >= 0.15 or word_rect.contains_point(box.cx, box.cy):
                overlapping_words.append(clean_token(word.text))
        if overlapping_words and not any(CHECKBOX_NOISE_RE.fullmatch(t) or BOX_GLYPH_RE.fullmatch(t) for t in overlapping_words if t):
            continue
        out.append(ChoiceMark(box, inner_fill > 0.13 or (inner_fill > 0.08 and border_fill > 0.22), "fill"))
    return dedupe_marks(out)


def likely_choice_region(region: RectBox, hint_words: Sequence[WordBox]) -> bool:
    texts = [clean_token(w.text) for w in hint_words if clean_token(w.text)]
    if any(CHECKBOX_NOISE_RE.fullmatch(t) or BOX_GLYPH_RE.fullmatch(t) for t in texts):
        return True
    short = sum(1 for t in texts if 0 < len(re.sub(r"\s+", "", t)) <= 4)
    return region.width >= 120 and region.height <= 110 and len(texts) >= 5 and short >= 2


def marks_in_region(region: RectBox, vector_marks: Sequence[ChoiceMark], raster: RasterPage, hint_words: Sequence[WordBox]) -> List[ChoiceMark]:
    hits = [m for m in vector_marks if region.intersects(m.bbox, pad=2.0)]
    if hits:
        return hits
    if not likely_choice_region(region, hint_words):
        return []
    return extract_raster_choice_marks(region, raster, hint_words)


def remove_checkbox_noise(words: Sequence[WordBox], marks: Sequence[ChoiceMark]) -> List[WordBox]:
    out: List[WordBox] = []
    for word in words:
        text = clean_token(word.text)
        if not text:
            continue
        near_mark = any(RectBox(word.x0, word.y0, word.x1, word.y1, word.source).intersects(RectBox(mark.x0 - max(mark.width, mark.height) * 0.5, mark.y0 - max(mark.width, mark.height) * 0.5, mark.x1 + max(mark.width, mark.height) * 0.5, mark.y1 + max(mark.width, mark.height) * 0.5, mark.style)) for mark in marks)
        if near_mark and (CHECKBOX_NOISE_RE.fullmatch(text) or BOX_GLYPH_RE.fullmatch(text)):
            continue
        out.append(WordBox(word.x0, word.y0, word.x1, word.y1, text, word.conf, word.source))
    return out


def group_marks_to_lines(marks: Sequence[ChoiceMark], y_tol: float) -> List[List[ChoiceMark]]:
    if not marks:
        return []
    ordered = sorted(marks, key=lambda m: (m.cy, m.x0))
    lines: List[List[ChoiceMark]] = []
    cur = [ordered[0]]
    cur_y = ordered[0].cy
    for mark in ordered[1:]:
        if abs(mark.cy - cur_y) <= y_tol:
            cur.append(mark)
            cur_y = (cur_y * (len(cur) - 1) + mark.cy) / len(cur)
        else:
            lines.append(sorted(cur, key=lambda m: m.x0))
            cur = [mark]
            cur_y = mark.cy
    if cur:
        lines.append(sorted(cur, key=lambda m: m.x0))
    return lines


def build_rich_lines(words: Sequence[WordBox], marks: Sequence[ChoiceMark], region: RectBox) -> Tuple[List[RichLine], str, bool]:
    if not words and not marks:
        return [RichLine([InlineFragment("text", "")])], "", False

    clean_words = remove_checkbox_noise(words, marks)
    _, font_pt, grouped_words = join_words_as_lines(clean_words)
    y_tol = max(2.5, font_pt * 0.55)
    mark_groups = group_marks_to_lines(marks, y_tol)

    entries: List[Tuple[float, List[WordBox], List[ChoiceMark]]] = []
    used_mark_idx: set[int] = set()
    for word_line in grouped_words:
        cy = sum(w.cy for w in word_line) / len(word_line)
        attached: List[ChoiceMark] = []
        for idx, mline in enumerate(mark_groups):
            if idx in used_mark_idx:
                continue
            mcy = sum(m.cy for m in mline) / len(mline)
            if abs(mcy - cy) <= y_tol * 1.15:
                attached = mline
                used_mark_idx.add(idx)
                break
        entries.append((cy, list(word_line), attached))
    for idx, mline in enumerate(mark_groups):
        if idx not in used_mark_idx:
            entries.append((sum(m.cy for m in mline) / len(mline), [], list(mline)))
    entries.sort(key=lambda item: item[0])

    rendered_text: List[str] = []
    rich_lines: List[RichLine] = []
    has_choices = False

    for _, line_words, line_marks in entries:
        if not line_marks:
            texts, _, _ = join_words_as_lines(line_words, y_tol)
            text = sanitize_text(texts[0] if texts else "")
            rich_lines.append(RichLine([InlineFragment("text", text)]))
            if text:
                rendered_text.append(text)
            continue

        has_choices = True
        line_marks = sorted(line_marks, key=lambda m: m.x0)
        line_words = remove_checkbox_noise(line_words, line_marks)
        fragments: List[InlineFragment] = []

        lead = [w for w in line_words if w.cx < line_marks[0].x0 - font_pt * 0.15]
        lead_text = sanitize_text(" ".join(join_words_as_lines(lead, y_tol)[0])) if lead else ""
        if lead_text:
            fragments.append(InlineFragment("text", lead_text))

        for idx, mark in enumerate(line_marks):
            next_x = line_marks[idx + 1].x0 if idx + 1 < len(line_marks) else region.x1 + 1.0
            label_words = [w for w in line_words if w.cx >= mark.x0 - font_pt * 0.1 and w.cx < next_x - font_pt * 0.12 and w.x1 > mark.x1 - font_pt * 0.08]
            label_lines, _, _ = join_words_as_lines(label_words, y_tol)
            label_text = sanitize_text(" ".join(label_lines))
            fragments.append(InlineFragment("choice", label_text, mark.checked, mark.style))

        plain_render: List[str] = []
        for frag in fragments:
            if frag.kind == "choice":
                plain_render.append(("☑ " if frag.checked else "☐ ") + sanitize_text(frag.text))
            else:
                plain_render.append(sanitize_text(frag.text))
        rendered_text.append(sanitize_text(" ".join(part for part in plain_render if part)))
        rich_lines.append(RichLine(fragments or [InlineFragment("text", "")]))

    text = normalize_text("\n".join(line for line in rendered_text if line))
    if not rich_lines:
        rich_lines = [RichLine([InlineFragment("text", text)])]
    return rich_lines, text, has_choices


# ---------------------------------------------------------------------------
# Tables and blocks
# ---------------------------------------------------------------------------


def detect_tables(page: fitz.Page, rects: Sequence[RectBox], mode: str) -> List[Table]:
    if not rects:
        return []
    rect_components = connected_components(
        [Segment("h", r.y0, r.x0, r.x1) for r in rects] + [Segment("h", r.y1, r.x0, r.x1) for r in rects] + [Segment("v", r.x0, r.y0, r.y1) for r in rects] + [Segment("v", r.x1, r.y0, r.y1) for r in rects],
        tol=3.5 if mode == "scan" else 2.0,
    )
    tables: List[Table] = []
    for component in rect_components:
        bbox_seg = component_bbox(component)
        bbox = RectBox(bbox_seg.x0, bbox_seg.y0, bbox_seg.x1, bbox_seg.y1, mode)
        if bbox.width < page.rect.width * 0.10 or bbox.height < page.rect.height * 0.05:
            continue
        inside = [r for r in rects if bbox.intersects(r, pad=1.5) and r.x0 >= bbox.x0 - 2 and r.x1 <= bbox.x1 + 2 and r.y0 >= bbox.y0 - 2 and r.y1 <= bbox.y1 + 2]
        if len(inside) < 4:
            continue

        pos_tol = 3.5 if mode == "scan" else 1.2
        min_gap = 4.5 if mode == "scan" else 2.5
        x_lines = merge_axis_positions([v for r in inside for v in (r.x0, r.x1)], pos_tol, min_gap)
        y_lines = merge_axis_positions([v for r in inside for v in (r.y0, r.y1)], pos_tol, min_gap)
        if len(x_lines) < 2 or len(y_lines) < 2:
            continue

        v_map: Dict[float, List[Tuple[float, float]]] = {}
        h_map: Dict[float, List[Tuple[float, float]]] = {}
        for rect in inside:
            v_map.setdefault(min(x_lines, key=lambda x: abs(x - rect.x0)), []).append((rect.y0, rect.y1))
            v_map.setdefault(min(x_lines, key=lambda x: abs(x - rect.x1)), []).append((rect.y0, rect.y1))
            h_map.setdefault(min(y_lines, key=lambda y: abs(y - rect.y0)), []).append((rect.x0, rect.x1))
            h_map.setdefault(min(y_lines, key=lambda y: abs(y - rect.y1)), []).append((rect.x0, rect.x1))
        v_map = {k: merge_intervals(v, pos_tol) for k, v in v_map.items()}
        h_map = {k: merge_intervals(v, pos_tol) for k, v in h_map.items()}

        rows = len(y_lines) - 1
        cols = len(x_lines) - 1
        atomic = [(r, c) for r in range(rows) for c in range(cols) if x_lines[c + 1] - x_lines[c] > 1.2 and y_lines[r + 1] - y_lines[r] > 1.2]
        if not atomic:
            continue
        parent: Dict[Tuple[int, int], Tuple[int, int]] = {rc: rc for rc in atomic}
        def find(rc: Tuple[int, int]) -> Tuple[int, int]:
            while parent[rc] != rc:
                parent[rc] = parent[parent[rc]]
                rc = parent[rc]
            return rc
        def union(a: Tuple[int, int], b: Tuple[int, int]) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra
        for r, c in atomic:
            if c + 1 < cols and (r, c + 1) in parent:
                if not has_vertical(v_map, x_lines[c + 1], y_lines[r], y_lines[r + 1], pos_tol):
                    union((r, c), (r, c + 1))
            if r + 1 < rows and (r + 1, c) in parent:
                if not has_horizontal(h_map, y_lines[r + 1], x_lines[c], x_lines[c + 1], pos_tol):
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
            cell_rect = RectBox(x_lines[c0], y_lines[r0], x_lines[c1], y_lines[r1], mode)
            cells.append(Cell(cell_rect, c0 + 1, c1 + 1, r0 + 1, r1 + 1, "", 11.0))
        if len(cells) >= 3:
            tables.append(Table(RectBox(min(x_lines), min(y_lines), max(x_lines), max(y_lines), mode), x_lines, y_lines, sorted(cells, key=lambda c: (c.row_start, c.col_start, c.row_end, c.col_end)), mode))
    tables.sort(key=lambda t: t.bbox.area, reverse=True)
    final: List[Table] = []
    for table in tables:
        if any(bbox_iou(table.bbox, other.bbox) > 0.8 for other in final):
            continue
        final.append(table)
    return sorted(final, key=lambda t: (t.bbox.y0, t.bbox.x0))


def classify_cell(text: str, rect: RectBox, table_bbox: RectBox) -> Tuple[str, bool, str]:
    compact = re.sub(r"\s+", "", text)
    numeric = bool(re.fullmatch(r"[0-9,./:()%-]+", compact))
    short = len(compact) <= 18
    narrow = rect.width <= table_bbox.width * 0.28
    wide = rect.width >= table_bbox.width * 0.45
    align = "left"
    bold = False
    valign = "center"
    if numeric:
        align = "center"
    elif short and narrow:
        align = "center"
        bold = True
    elif short and wide and rect.height <= 40:
        bold = True
    if text.count("\n") >= 2 or rect.height >= 42:
        valign = "top"
    return align, bold, valign


def build_tables(page: fitz.Page, tables: Sequence[Table], words: Sequence[WordBox], raster: RasterPage, mode: str, lang: str, vector_marks: Sequence[ChoiceMark]) -> Tuple[List[Table], set[int]]:
    used_words: set[int] = set()
    out: List[Table] = []
    for table in tables:
        new_cells: List[Cell] = []
        for cell in table.cells:
            chosen_words, chosen_text, score = choose_region_words(words, cell.rect, raster, mode, lang)
            marks = marks_in_region(cell.rect, vector_marks, raster, chosen_words)
            lines, rich_text, has_choices = build_rich_lines(chosen_words, marks, cell.rect)
            final_text = rich_text or chosen_text
            align, bold, valign = classify_cell(final_text, cell.rect, table.bbox)
            _, font_pt, _ = join_words_as_lines(chosen_words)
            bg = unresolved_bg(cell.rect, raster, text_quality_score(final_text, sum(w.conf for w in chosen_words) / len(chosen_words) if chosen_words else 0.0))
            for idx, word in enumerate(words):
                if idx in used_words:
                    continue
                if cell.rect.contains_point(word.cx, word.cy, 0.6) or overlap_ratio(RectBox(word.x0, word.y0, word.x1, word.y1, word.source), cell.rect) >= 0.12:
                    used_words.add(idx)
            new_cells.append(
                Cell(
                    rect=cell.rect,
                    col_start=cell.col_start,
                    col_end=cell.col_end,
                    row_start=cell.row_start,
                    row_end=cell.row_end,
                    text=final_text,
                    font_pt=font_pt,
                    align=align,
                    valign=valign,
                    bold=bold,
                    lines=lines,
                    has_choices=has_choices,
                    bg_image=bg,
                )
            )
        out.append(Table(table.bbox, table.x_lines, table.y_lines, new_cells, table.mode))
    return out, used_words


def build_text_blocks(page: fitz.Page, words: Sequence[WordBox], used_idx: set[int], raster: RasterPage, mode: str, lang: str, vector_marks: Sequence[ChoiceMark], tables: Sequence[Table]) -> List[TextBlock]:
    remaining = [w for idx, w in enumerate(words) if idx not in used_idx and GOOD_CHAR_RE.search(w.text)]
    if not remaining:
        return []

    y_tol = max(3.0, median(max(1.0, w.height) for w in remaining) * 0.55)
    ordered = sorted(remaining, key=lambda w: (round(w.cy, 2), w.x0))
    lines: List[List[WordBox]] = []
    cur: List[WordBox] = []
    cur_y: Optional[float] = None
    for word in ordered:
        if cur_y is None or abs(word.cy - cur_y) <= y_tol:
            cur.append(word)
            cur_y = word.cy if cur_y is None else (cur_y + word.cy) / 2.0
        else:
            lines.append(cur)
            cur = [word]
            cur_y = word.cy
    if cur:
        lines.append(cur)

    line_models: List[Tuple[RectBox, str, float, List[WordBox]]] = []
    for line in lines:
        rendered, font_pt, _ = join_words_as_lines(line, y_tol)
        text = sanitize_text(rendered[0] if rendered else "")
        if not text and not any(CHECKBOX_NOISE_RE.fullmatch(clean_token(w.text)) for w in line):
            continue
        bbox = RectBox(min(w.x0 for w in line), min(w.y0 for w in line), max(w.x1 for w in line), max(w.y1 for w in line), line[0].source)
        line_models.append((bbox, text, font_pt, line))

    blocks: List[TextBlock] = []
    if not line_models:
        return blocks

    bb, txt, fp, pool = line_models[0][0], [line_models[0][1]], [line_models[0][2]], list(line_models[0][3])
    for bbox, text, font_pt, line_words in line_models[1:]:
        gap = bbox.y0 - bb.y1
        overlap = max(0.0, min(bb.x1, bbox.x1) - max(bb.x0, bbox.x0))
        overlap_ratio_x = overlap / max(1.0, min(bb.width, bbox.width))
        similar_left = abs(bb.x0 - bbox.x0) <= 18
        if gap <= max(8.0, bb.height * 0.8) and (overlap_ratio_x >= 0.2 or similar_left):
            txt.append(text)
            fp.append(font_pt)
            pool.extend(line_words)
            bb = RectBox(min(bb.x0, bbox.x0), min(bb.y0, bbox.y0), max(bb.x1, bbox.x1), max(bb.y1, bbox.y1), bbox.source)
        else:
            blocks.append(_finalize_text_block(bb, txt, fp, pool, raster, mode, lang, vector_marks, tables))
            bb, txt, fp, pool = bbox, [text], [font_pt], list(line_words)
    blocks.append(_finalize_text_block(bb, txt, fp, pool, raster, mode, lang, vector_marks, tables))
    return [b for b in blocks if b is not None]


def _finalize_text_block(bb: RectBox, lines: Sequence[str], fonts: Sequence[float], pool: Sequence[WordBox], raster: RasterPage, mode: str, lang: str, vector_marks: Sequence[ChoiceMark], tables: Sequence[Table]) -> Optional[TextBlock]:
    if any(table.bbox.intersects(bb, pad=1.0) and overlap_ratio(bb, table.bbox) > 0.85 for table in tables):
        return None
    chosen_words, chosen_text, _ = choose_region_words(pool, bb, raster, mode, lang)
    marks = marks_in_region(bb, vector_marks, raster, chosen_words)
    rich_lines, final_text, has_choices = build_rich_lines(chosen_words, marks, bb)
    if not final_text:
        final_text = normalize_text("\n".join(line for line in lines if line))
    align = "center" if abs((bb.x0 + bb.x1) / 2 - 297.5) < 70 and bb.width < 260 else "left"
    bold = len(re.sub(r"\s+", "", final_text)) <= 24 and final_text.count("\n") <= 1
    score = text_quality_score(final_text, sum(w.conf for w in chosen_words) / len(chosen_words) if chosen_words else 0.0)
    bg = unresolved_bg(bb, raster, score)
    return TextBlock(bb, final_text, float(median(fonts) if fonts else 11.0), align, bold, rich_lines, has_choices, bg)


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------


def escape_text(text: str) -> str:
    return html.escape(text or "", quote=False)


def render_rich_lines(lines: Sequence[RichLine]) -> str:
    out: List[str] = []
    for line in lines:
        if not line.fragments:
            out.append('<div class="rich-line plain-line"><span class="editable-text" contenteditable="true"></span></div>')
            continue
        has_choice = any(f.kind == "choice" for f in line.fragments)
        classes = "rich-line option-line" if has_choice else "rich-line plain-line"
        frags: List[str] = []
        for frag in line.fragments:
            if frag.kind == "choice":
                state = "1" if frag.checked else "0"
                aria = "true" if frag.checked else "false"
                frags.append(
                    '<span class="choice-fragment">'
                    f'<button type="button" class="choice-box" data-style="{escape_text(frag.style)}" data-checked="{state}" aria-checked="{aria}" role="checkbox"></button>'
                    f'<span class="editable-text option-label" contenteditable="true">{escape_text(frag.text)}</span>'
                    '</span>'
                )
            else:
                frags.append(f'<span class="editable-text text-fragment" contenteditable="true">{escape_text(frag.text)}</span>')
        out.append(f'<div class="{classes}">{"".join(frags)}</div>')
    return "".join(out)


def render_bg(bg_image: str) -> str:
    if not bg_image:
        return ""
    return f'<div class="region-bg" style="background-image:url(\'{bg_image}\')"></div>'


def render_cell(cell: Cell, table: Table, scale: float) -> str:
    font_px = clamp(cell.font_pt * scale * 0.95, 10.5, 18.0)
    pad_x = clamp(font_px * 0.42, 5.0, 8.5)
    pad_y = clamp(font_px * 0.30, 3.5, 7.5)
    weight = 700 if cell.bold else 400
    content = render_rich_lines(cell.lines) if cell.lines else f'<div class="rich-line plain-line"><span class="editable-text text-fragment" contenteditable="true">{escape_text(cell.text)}</span></div>'
    return (
        f'<div class="cell align-{cell.align} valign-{cell.valign}" '
        f'style="grid-column:{cell.col_start} / {cell.col_end}; grid-row:{cell.row_start} / {cell.row_end}; font-size:{font_px:.2f}px; font-weight:{weight}; --pad-x:{pad_x:.2f}px; --pad-y:{pad_y:.2f}px;">'
        '<div class="cell-box">'
        f'{render_bg(cell.bg_image)}'
        f'<div class="cell-pad">{content}</div>'
        '</div></div>'
    )


def render_table(table: Table, scale: float, band_y0: float) -> str:
    width = table.bbox.width * scale
    height = table.bbox.height * scale
    col_sizes = []
    for i in range(len(table.x_lines) - 1):
        pct = ((table.x_lines[i + 1] - table.x_lines[i]) / max(1.0, table.bbox.width)) * 100.0
        col_sizes.append(f"minmax(0, {pct:.6f}%)")
    row_sizes = []
    for i in range(len(table.y_lines) - 1):
        row_px = max(14.0, (table.y_lines[i + 1] - table.y_lines[i]) * scale)
        row_sizes.append(f"minmax({row_px:.2f}px, auto)")
    cells_html = "".join(render_cell(cell, table, scale) for cell in table.cells)
    top = (table.bbox.y0 - band_y0) * scale
    left = table.bbox.x0 * scale
    return (
        f'<div class="frame table-frame" data-kind="table" style="left:{left:.2f}px; top:{top:.2f}px; width:{width:.2f}px; min-height:{height:.2f}px;">'
        '<div class="drag-handle" title="drag"></div>'
        '<div class="frame-box">'
        f'<div class="table-grid" style="grid-template-columns:{" ".join(col_sizes)}; grid-template-rows:{" ".join(row_sizes)};">{cells_html}</div>'
        '</div>'
        '<div class="resize-handle" title="resize"></div>'
        '</div>'
    )


def render_text_block(block: TextBlock, scale: float, band_y0: float) -> str:
    width = block.bbox.width * scale
    height = block.bbox.height * scale
    font_px = clamp(block.font_pt * scale * 0.95, 10.5, 18.0)
    pad_x = clamp(font_px * 0.36, 4.0, 8.0)
    pad_y = clamp(font_px * 0.26, 2.8, 6.5)
    weight = 700 if block.bold else 400
    top = (block.bbox.y0 - band_y0) * scale
    left = block.bbox.x0 * scale
    content = render_rich_lines(block.lines) if block.lines else f'<div class="rich-line plain-line"><span class="editable-text text-fragment" contenteditable="true">{escape_text(block.text)}</span></div>'
    return (
        f'<div class="frame text-frame align-{block.align}" data-kind="text" style="left:{left:.2f}px; top:{top:.2f}px; width:{width:.2f}px; min-height:{height:.2f}px; font-size:{font_px:.2f}px; font-weight:{weight}; --pad-x:{pad_x:.2f}px; --pad-y:{pad_y:.2f}px;">'
        '<div class="drag-handle" title="drag"></div>'
        '<div class="frame-box">'
        f'{render_bg(block.bg_image)}'
        f'<div class="text-pad">{content}</div>'
        '</div>'
        '<div class="resize-handle" title="resize"></div>'
        '</div>'
    )


def build_bands(page: PageModel) -> List[Tuple[float, float, List[Tuple[str, object]]]]:
    items: List[Tuple[float, float, str, float, object]] = []
    for table in page.tables:
        items.append((table.bbox.y0, table.bbox.y1, "table", table.bbox.x0, table))
    for block in page.text_blocks:
        items.append((block.bbox.y0, block.bbox.y1, "text", block.bbox.x0, block))
    items.sort(key=lambda t: (t[0], t[3]))
    bands: List[Tuple[float, float, List[Tuple[str, object]]]] = []
    current: Optional[List[object]] = None
    for y0, y1, kind, _, payload in items:
        if current is None:
            current = [y0, y1, [(kind, payload)]]
            continue
        same_text_band = kind == "text" and all(k == "text" for k, _ in current[2]) and y0 <= current[1] + 8
        if same_text_band:
            current[1] = max(current[1], y1)
            current[2].append((kind, payload))
        else:
            bands.append((float(current[0]), float(current[1]), current[2]))
            current = [y0, y1, [(kind, payload)]]
    if current is not None:
        bands.append((float(current[0]), float(current[1]), current[2]))
    return bands


def render_page(page: PageModel, scale: float) -> str:
    bands = build_bands(page)
    sections: List[str] = []
    prev_y = 0.0
    for band_index, (y0, y1, items) in enumerate(bands, start=1):
        mt = max(0.0, (y0 - prev_y) * scale)
        prev_y = y1
        inner: List[str] = []
        for kind, payload in items:
            if kind == "table":
                inner.append(render_table(payload, scale, y0))
            else:
                inner.append(render_text_block(payload, scale, y0))
        sections.append(
            f'<section class="band" data-band="{band_index}" style="margin-top:{mt:.2f}px; min-height:{(y1 - y0) * scale:.2f}px;">'
            f'{"".join(inner)}</section>'
        )
    return f'<section class="page" data-page="{page.number}" style="width:{page.width * scale:.2f}px; min-height:{page.height * scale:.2f}px;">{"".join(sections)}</section>'


def render_document(pages: Sequence[PageModel], title: str, scale: float) -> str:
    pages_html = "".join(render_page(page, scale) for page in pages)
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --canvas:#ececec;
      --paper:#ffffff;
      --ink:#1d1d1d;
      --line:#2f2f2f;
      --shadow:rgba(0,0,0,.12);
      --handle:#111111;
      --accent:#2563eb;
    }}
    * {{ box-sizing:border-box; }}
    body {{
      margin:0;
      background:var(--canvas);
      color:var(--ink);
      font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;
      line-height:1.24;
    }}
    .viewer {{
      padding:24px 14px 40px;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:24px;
    }}
    .page {{
      position:relative;
      background:var(--paper);
      box-shadow:0 8px 26px var(--shadow);
      overflow:visible;
      user-select:text;
    }}
    .band {{
      position:relative;
      width:100%;
    }}
    .frame {{
      position:absolute;
      min-width:24px;
    }}
    .frame-box {{
      position:relative;
      min-width:100%;
      min-height:100%;
    }}
    .drag-handle {{
      position:absolute;
      left:0;
      top:-12px;
      width:100%;
      height:10px;
      border-radius:4px 4px 0 0;
      background:var(--handle);
      cursor:move;
      opacity:.72;
    }}
    .resize-handle {{
      position:absolute;
      right:-7px;
      bottom:-7px;
      width:14px;
      height:14px;
      border-radius:50%;
      background:var(--accent);
      cursor:nwse-resize;
      box-shadow:0 0 0 2px #fff;
    }}
    .table-grid {{
      display:grid;
      gap:1px;
      background:var(--line);
      padding:1px;
      align-items:stretch;
    }}
    .cell {{
      background:var(--paper);
      min-width:0;
      display:flex;
    }}
    .cell-box {{
      position:relative;
      width:100%;
      min-height:100%;
      background:#fff;
      overflow:visible;
    }}
    .cell-pad {{
      position:relative;
      z-index:1;
      width:100%;
      height:100%;
      min-width:0;
      padding:var(--pad-y) var(--pad-x);
      white-space:normal;
      overflow-wrap:anywhere;
      word-break:keep-all;
    }}
    .text-frame {{
      color:var(--ink);
    }}
    .text-frame .frame-box {{
      background:#fff;
    }}
    .text-pad {{
      position:relative;
      z-index:1;
      width:100%;
      min-height:100%;
      padding:var(--pad-y) var(--pad-x);
      white-space:normal;
      overflow-wrap:anywhere;
      word-break:keep-all;
    }}
    .align-left {{ text-align:left; justify-content:flex-start; }}
    .align-center {{ text-align:center; justify-content:center; }}
    .align-right {{ text-align:right; justify-content:flex-end; }}
    .valign-top {{ align-items:flex-start; }}
    .valign-center {{ align-items:center; }}
    .region-bg {{
      position:absolute;
      inset:0;
      background-repeat:no-repeat;
      background-position:center center;
      background-size:100% 100%;
      opacity:.92;
      pointer-events:none;
      z-index:0;
    }}
    .rich-line {{
      display:flex;
      flex-wrap:wrap;
      align-items:flex-start;
      gap:.2em .45em;
      min-height:1.18em;
    }}
    .plain-line {{ gap:0; }}
    .plain-line .text-fragment {{ width:100%; }}
    .choice-fragment {{
      display:inline-flex;
      align-items:flex-start;
      gap:.42em;
      min-width:0;
      margin-right:.18em;
    }}
    .choice-box {{
      flex:0 0 auto;
      width:1em;
      height:1em;
      margin-top:.08em;
      border:1.35px solid #111;
      background:#fff;
      padding:0;
      position:relative;
      border-radius:1px;
      cursor:pointer;
    }}
    .choice-box[data-checked="1"]::after {{
      content:"";
      position:absolute;
      inset:18%;
      background:#111;
    }}
    .editable-text {{
      display:inline-block;
      min-width:.28em;
      min-height:1.08em;
      outline:none;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      word-break:keep-all;
    }}
    .editable-text:focus {{
      box-shadow:inset 0 0 0 1px rgba(37,99,235,.28);
      background:rgba(37,99,235,.06);
    }}
    .option-label {{ min-width:.8em; }}
    @media print {{
      body {{ background:#fff; }}
      .viewer {{ padding:0; gap:0; }}
      .page {{ box-shadow:none; page-break-after:always; }}
      .page:last-child {{ page-break-after:auto; }}
      .drag-handle, .resize-handle {{ display:none !important; }}
    }}
  </style>
</head>
<body>
  <main class="viewer">{pages_html}</main>
  <script>
    (() => {{
      const updateChoice = (btn, checked) => {{
        btn.dataset.checked = checked ? '1' : '0';
        btn.setAttribute('aria-checked', checked ? 'true' : 'false');
      }};

      document.querySelectorAll('.choice-box').forEach(btn => {{
        btn.addEventListener('click', () => updateChoice(btn, btn.dataset.checked !== '1'));
        btn.addEventListener('keydown', evt => {{
          if (evt.key === ' ' || evt.key === 'Enter') {{
            evt.preventDefault();
            updateChoice(btn, btn.dataset.checked !== '1');
          }}
        }});
      }});

      const updateBandHeight = band => {{
        const frames = [...band.querySelectorAll(':scope > .frame')];
        if (!frames.length) return;
        let maxBottom = 0;
        frames.forEach(frame => {{
          const top = parseFloat(frame.style.top || '0') || 0;
          const h = frame.offsetHeight;
          maxBottom = Math.max(maxBottom, top + h + 8);
        }});
        band.style.minHeight = `${{Math.max(maxBottom, 20)}}px`;
      }};

      const refreshAllBands = () => document.querySelectorAll('.band').forEach(updateBandHeight);

      document.querySelectorAll('.editable-text').forEach(node => {{
        node.addEventListener('input', () => {{
          const band = node.closest('.band');
          if (band) updateBandHeight(band);
        }});
      }});

      document.querySelectorAll('.frame').forEach(frame => {{
        const handle = frame.querySelector('.drag-handle');
        const resize = frame.querySelector('.resize-handle');
        const box = frame.querySelector('.frame-box');
        const band = frame.closest('.band');
        if (handle) {{
          handle.addEventListener('mousedown', evt => {{
            if (evt.target.closest('[contenteditable="true"], .choice-box')) return;
            evt.preventDefault();
            const startX = evt.clientX;
            const startY = evt.clientY;
            const startLeft = parseFloat(frame.style.left || '0') || 0;
            const startTop = parseFloat(frame.style.top || '0') || 0;
            const onMove = moveEvt => {{
              frame.style.left = `${{Math.max(0, startLeft + moveEvt.clientX - startX)}}px`;
              frame.style.top = `${{Math.max(0, startTop + moveEvt.clientY - startY)}}px`;
              if (band) updateBandHeight(band);
            }};
            const onUp = () => {{
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            }};
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }});
        }}
        if (resize) {{
          resize.addEventListener('mousedown', evt => {{
            evt.preventDefault();
            const startX = evt.clientX;
            const startY = evt.clientY;
            const startW = frame.offsetWidth;
            const startH = frame.offsetHeight;
            const onMove = moveEvt => {{
              const newW = Math.max(24, startW + moveEvt.clientX - startX);
              const newH = Math.max(18, startH + moveEvt.clientY - startY);
              frame.style.width = `${{newW}}px`;
              frame.style.minHeight = `${{newH}}px`;
              if (box) box.style.minHeight = `${{newH}}px`;
              if (band) updateBandHeight(band);
            }};
            const onUp = () => {{
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            }};
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }});
        }}
      }});

      const ro = new ResizeObserver(entries => {{
        entries.forEach(entry => {{
          const band = entry.target.closest('.band');
          if (band) updateBandHeight(band);
        }});
      }});
      document.querySelectorAll('.frame-box').forEach(node => ro.observe(node));
      window.addEventListener('load', refreshAllBands);
      window.addEventListener('resize', refreshAllBands);
      refreshAllBands();
    }})();
  </script>
</body>
</html>'''


# ---------------------------------------------------------------------------
# Conversion entry points
# ---------------------------------------------------------------------------


def convert_page(page: fitz.Page, page_num: int, raster_scale: float, ocr_lang: str) -> PageModel:
    raster = rasterize_page(page, raster_scale)
    pdf_words = extract_pdf_words(page)
    page_words = pdf_words if pdf_words else whole_page_ocr_words(page, raster, ocr_lang)
    rects, mode = detect_rects(page, raster)
    tables = detect_tables(page, rects, mode)
    vector_marks = extract_vector_choice_marks(page, raster) if mode == "vector" else []
    tables, used_idx = build_tables(page, tables, page_words, raster, mode, ocr_lang, vector_marks)
    text_blocks = build_text_blocks(page, page_words, used_idx, raster, mode, ocr_lang, vector_marks, tables)
    return PageModel(page_num, page.rect.width, page.rect.height, mode, tables, text_blocks)


def convert_pdf_to_html(
    input_pdf: str | os.PathLike[str],
    output_html: str | os.PathLike[str],
    scale: float = 1.28,
    raster_scale: float = 3.2,
    ocr_lang: str = "kor+eng",
) -> None:
    doc = fitz.open(str(input_pdf))
    pages = [convert_page(page, i + 1, raster_scale, ocr_lang) for i, page in enumerate(doc)]
    Path(output_html).write_text(render_document(pages, Path(input_pdf).stem, scale), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert PDF to editable div/grid HTML with checkbox reconstruction and OCR rescue.")
    parser.add_argument("input_pdf", help="Input PDF path")
    parser.add_argument("output_html", help="Output HTML path")
    parser.add_argument("--scale", type=float, default=1.28, help="Output display scale")
    parser.add_argument("--raster-scale", type=float, default=3.2, help="Rasterization scale for OCR and checkbox detection")
    parser.add_argument("--ocr-lang", default="kor+eng", help="Tesseract OCR language string")
    args = parser.parse_args()
    convert_pdf_to_html(args.input_pdf, args.output_html, args.scale, args.raster_scale, args.ocr_lang)
