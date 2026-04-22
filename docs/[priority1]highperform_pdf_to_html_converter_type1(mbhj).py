from __future__ import annotations

import argparse
import base64
import html
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from statistics import median
from typing import Iterable

import cv2
import fitz  # PyMuPDF
import numpy as np
import pytesseract
from pytesseract import Output


# ---------------------------------------------------------------------------
# Geometry / models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RectBox:
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2.0

    def expand(self, pad: float) -> "RectBox":
        return RectBox(self.x0 - pad, self.y0 - pad, self.x1 + pad, self.y1 + pad)

    def clamp(self, width: float, height: float) -> "RectBox":
        return RectBox(
            max(0.0, min(width, self.x0)),
            max(0.0, min(height, self.y0)),
            max(0.0, min(width, self.x1)),
            max(0.0, min(height, self.y1)),
        )

    def contains_point(self, x: float, y: float, pad: float = 0.0) -> bool:
        return self.x0 + pad <= x <= self.x1 - pad and self.y0 + pad <= y <= self.y1 - pad

    def intersects(self, other: "RectBox", pad: float = 0.0) -> bool:
        return not (
            self.x1 + pad < other.x0
            or other.x1 + pad < self.x0
            or self.y1 + pad < other.y0
            or other.y1 + pad < self.y0
        )

    def intersection_area(self, other: "RectBox") -> float:
        x0 = max(self.x0, other.x0)
        y0 = max(self.y0, other.y0)
        x1 = min(self.x1, other.x1)
        y1 = min(self.y1, other.y1)
        if x1 <= x0 or y1 <= y0:
            return 0.0
        return (x1 - x0) * (y1 - y0)

    def mostly_contains(self, other: "RectBox", ratio: float = 0.9) -> bool:
        if other.area <= 0.0:
            return False
        return self.intersection_area(other) / other.area >= ratio


@dataclass
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    conf: float = 100.0
    source: str = "pdf"

    @property
    def bbox(self) -> RectBox:
        return RectBox(self.x0, self.y0, self.x1, self.y1)

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2.0

    @property
    def h(self) -> float:
        return max(0.1, self.y1 - self.y0)

    @property
    def w(self) -> float:
        return max(0.1, self.x1 - self.x0)


@dataclass
class Segment:
    orientation: str  # "h" or "v"
    pos: float
    start: float
    end: float
    thickness: float

    @property
    def bbox(self) -> RectBox:
        half = max(0.5, self.thickness / 2.0)
        if self.orientation == "h":
            return RectBox(self.start, self.pos - half, self.end, self.pos + half)
        return RectBox(self.pos - half, self.start, self.pos + half, self.end)


@dataclass
class TableCell:
    bbox: RectBox
    col_start: int
    col_end: int
    row_start: int
    row_end: int
    text: str
    font_pt: float


@dataclass
class TableBlock:
    bbox: RectBox
    x_lines: list[float]
    y_lines: list[float]
    cells: list[TableCell]
    crop_ref: str = ""


@dataclass
class RasterBlock:
    bbox: RectBox
    crop_ref: str
    text: str = ""
    kind: str = "content"


@dataclass
class TextLine:
    bbox: RectBox
    text: str
    font_pt: float


@dataclass
class PageModel:
    number: int
    width: float
    height: float
    tables: list[TableBlock] = field(default_factory=list)
    raster_blocks: list[RasterBlock] = field(default_factory=list)
    text_lines: list[TextLine] = field(default_factory=list)


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
# Assets
# ---------------------------------------------------------------------------


class AssetStore:
    def __init__(
        self,
        output_html: str | os.PathLike[str],
        mode: str = "external",
        assets_dir_name: str | None = None,
    ) -> None:
        self.output_html = Path(output_html)
        self.mode = mode
        self.assets_dir = self.output_html.with_name(assets_dir_name or f"{self.output_html.stem}_assets")
        if self.mode == "external":
            self.assets_dir.mkdir(parents=True, exist_ok=True)
        self.counter = 0

    def add_crop(
        self,
        rgb: np.ndarray,
        rect_px: tuple[int, int, int, int],
        stem: str,
    ) -> str:
        x0, y0, x1, y1 = rect_px
        if x1 <= x0 or y1 <= y0:
            return ""
        crop = rgb[y0:y1, x0:x1]
        if crop.size == 0:
            return ""
        ok, encoded = cv2.imencode(".png", cv2.cvtColor(crop, cv2.COLOR_RGB2BGR))
        if not ok:
            return ""
        data = encoded.tobytes()
        if self.mode == "embed":
            return "data:image/png;base64," + base64.b64encode(data).decode("ascii")
        self.counter += 1
        filename = f"{stem}_{self.counter:04d}.png"
        path = self.assets_dir / filename
        path.write_bytes(data)
        return path.relative_to(self.output_html.parent).as_posix()


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def sanitize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_multiline_text(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def render_multiline(text: str) -> str:
    return "<br>".join(html.escape(line) for line in text.splitlines())


def merge_intervals(intervals: list[tuple[float, float]], gap: float = 1.5) -> list[tuple[float, float]]:
    if not intervals:
        return []
    intervals = sorted(intervals)
    out = [[intervals[0][0], intervals[0][1]]]
    for a, b in intervals[1:]:
        if a <= out[-1][1] + gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [(a, b) for a, b in out]


def cluster_values(values: list[float], tol: float) -> list[float]:
    if not values:
        return []
    values = sorted(values)
    groups = [[values[0]]]
    for v in values[1:]:
        if abs(v - groups[-1][-1]) <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [sorted(g)[len(g) // 2] for g in groups]


def intervals_cover(intervals: list[tuple[float, float]], start: float, end: float, tol: float = 1.5) -> bool:
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


def bbox_of_rects(rects: Iterable[RectBox]) -> RectBox:
    boxes = list(rects)
    return RectBox(
        min(r.x0 for r in boxes),
        min(r.y0 for r in boxes),
        max(r.x1 for r in boxes),
        max(r.y1 for r in boxes),
    )


def nearest_index(value: float, boundaries: list[float]) -> int:
    return min(range(len(boundaries)), key=lambda i: abs(boundaries[i] - value))


def rect_pt_to_px(rect: RectBox, raster_scale: float, img_shape: tuple[int, int, int], pad_px: int = 0) -> tuple[int, int, int, int]:
    h, w = img_shape[:2]
    x0 = max(0, int(np.floor(rect.x0 * raster_scale)) - pad_px)
    y0 = max(0, int(np.floor(rect.y0 * raster_scale)) - pad_px)
    x1 = min(w, int(np.ceil(rect.x1 * raster_scale)) + pad_px)
    y1 = min(h, int(np.ceil(rect.y1 * raster_scale)) + pad_px)
    return x0, y0, x1, y1


def join_words_as_lines(words: list[Word], y_tol: float | None = None) -> tuple[list[str], float]:
    if not words:
        return [], 10.0
    if y_tol is None:
        y_tol = max(2.0, median(w.h for w in words) * 0.55)
    ordered = sorted(words, key=lambda w: (round(w.cy, 2), w.x0))
    lines: list[list[Word]] = []
    cur: list[Word] = []
    cur_y: float | None = None
    for w in ordered:
        if cur_y is None or abs(w.cy - cur_y) <= y_tol:
            cur.append(w)
            cur_y = w.cy if cur_y is None else (cur_y + w.cy) / 2.0
        else:
            lines.append(cur)
            cur = [w]
            cur_y = w.cy
    if cur:
        lines.append(cur)

    rendered: list[str] = []
    for line in lines:
        line = sorted(line, key=lambda w: w.x0)
        parts: list[str] = []
        prev: Word | None = None
        for w in line:
            if prev is not None:
                gap = w.x0 - prev.x1
                gap_th = max(1.2, min(10.0, prev.h * 0.35))
                if gap > gap_th:
                    parts.append(" ")
            parts.append(w.text)
            prev = w
        rendered.append("".join(parts).strip())
    return rendered, float(median(w.h for w in words))


def dedupe_words(words: list[Word], overlap_ratio: float = 0.82) -> list[Word]:
    if not words:
        return []
    out: list[Word] = []
    for w in sorted(words, key=lambda x: (x.y0, x.x0, -x.conf)):
        duplicate = False
        for prev in out:
            inter = w.bbox.intersection_area(prev.bbox)
            denom = min(w.bbox.area, prev.bbox.area)
            if denom > 0 and inter / denom >= overlap_ratio:
                duplicate = True
                break
        if not duplicate:
            out.append(w)
    return out


def merge_close_rects(rects: list[RectBox], x_gap: float, y_gap: float, contain_ratio: float = 0.92) -> list[RectBox]:
    if not rects:
        return []
    uf = UnionFind(len(rects))
    expanded = [RectBox(r.x0 - x_gap, r.y0 - y_gap, r.x1 + x_gap, r.y1 + y_gap) for r in rects]
    for i, a in enumerate(expanded):
        for j in range(i + 1, len(expanded)):
            if a.intersects(expanded[j]):
                uf.union(i, j)
    groups: dict[int, list[RectBox]] = {}
    for i, r in enumerate(rects):
        groups.setdefault(uf.find(i), []).append(r)

    merged = [bbox_of_rects(g) for g in groups.values()]
    keep: list[RectBox] = []
    for r in sorted(merged, key=lambda x: x.area, reverse=True):
        if any(k.mostly_contains(r, contain_ratio) for k in keep):
            continue
        keep.append(r)
    return sorted(keep, key=lambda x: (x.y0, x.x0))


# ---------------------------------------------------------------------------
# Raster-first extraction
# ---------------------------------------------------------------------------


def render_page_raster(page: fitz.Page, raster_scale: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    pix = page.get_pixmap(matrix=fitz.Matrix(raster_scale, raster_scale), alpha=False, annots=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
    elif pix.n == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    binary_inv = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        11,
    )
    return img, gray, binary_inv


def extract_pdf_words(page: fitz.Page) -> list[Word]:
    words: list[Word] = []
    for item in page.get_text("words"):
        text = sanitize_text(str(item[4]))
        if not text:
            continue
        words.append(Word(item[0], item[1], item[2], item[3], text, 100.0, "pdf"))
    return dedupe_words(words)


def extract_ocr_words(gray: np.ndarray, raster_scale: float, lang: str, psm: int) -> list[Word]:
    config = f"--oem 1 --psm {psm} -c preserve_interword_spaces=1"
    data = pytesseract.image_to_data(gray, lang=lang, config=config, output_type=Output.DICT)
    words: list[Word] = []
    total = len(data.get("text", []))
    for i in range(total):
        raw = sanitize_text(data["text"][i])
        if not raw:
            continue
        try:
            conf = float(data["conf"][i])
        except Exception:
            conf = -1.0
        if conf < 15.0:
            continue
        x = data["left"][i] / raster_scale
        y = data["top"][i] / raster_scale
        w = data["width"][i] / raster_scale
        h = data["height"][i] / raster_scale
        if w <= 0 or h <= 0:
            continue
        words.append(Word(x, y, x + w, y + h, raw, conf, "ocr"))
    return dedupe_words(words)


def extract_words(page: fitz.Page, gray: np.ndarray, raster_scale: float, ocr_lang: str) -> list[Word]:
    pdf_words = extract_pdf_words(page)
    if len(pdf_words) >= 20:
        return pdf_words

    ocr_words = extract_ocr_words(gray, raster_scale, ocr_lang, psm=11)
    if len(ocr_words) < 12:
        alt = extract_ocr_words(gray, raster_scale, ocr_lang, psm=6)
        if len(alt) > len(ocr_words):
            ocr_words = alt

    if pdf_words and len(pdf_words) >= max(8, int(len(ocr_words) * 0.7)):
        return pdf_words
    return ocr_words if ocr_words else pdf_words


def line_masks(binary_inv: np.ndarray, word_height_px: float) -> tuple[np.ndarray, np.ndarray]:
    h, w = binary_inv.shape
    hmask = np.zeros_like(binary_inv)
    vmask = np.zeros_like(binary_inv)

    h_kernels = sorted(
        {
            max(12, int(word_height_px * 2.4)),
            max(18, w // 60),
            max(24, w // 30),
        }
    )
    v_kernels = sorted(
        {
            max(12, int(word_height_px * 2.4)),
            max(18, h // 60),
            max(24, h // 30),
        }
    )

    for k in h_kernels:
        part = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (k, 1)))
        hmask = cv2.bitwise_or(hmask, part)
    for k in v_kernels:
        part = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, k)))
        vmask = cv2.bitwise_or(vmask, part)

    close_w = max(3, int(word_height_px * 0.7))
    close_h = max(3, int(word_height_px * 0.7))
    hmask = cv2.morphologyEx(hmask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (close_w, 1)))
    vmask = cv2.morphologyEx(vmask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, close_h)))
    return hmask, vmask


def extract_segments_from_mask(
    mask: np.ndarray,
    orientation: str,
    raster_scale: float,
    min_len_px: int,
    word_height_px: float,
) -> list[Segment]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    segments: list[Segment] = []
    max_minor = max(24.0, word_height_px * 2.2)
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if orientation == "h":
            if w < min_len_px or h > max_minor:
                continue
            segments.append(Segment("h", (y + y + h) / 2.0 / raster_scale, x / raster_scale, (x + w) / raster_scale, max(1.0, h / raster_scale)))
        else:
            if h < min_len_px or w > max_minor:
                continue
            segments.append(Segment("v", (x + x + w) / 2.0 / raster_scale, y / raster_scale, (y + h) / raster_scale, max(1.0, w / raster_scale)))
    return segments


def merge_colinear_segments(segments: list[Segment]) -> list[Segment]:
    if not segments:
        return []
    orientation = segments[0].orientation
    tol = 1.8
    merged: list[Segment] = []
    ordered = sorted(segments, key=lambda s: (s.pos, s.start))
    groups: list[list[Segment]] = [[ordered[0]]]
    for seg in ordered[1:]:
        if abs(seg.pos - groups[-1][-1].pos) <= tol:
            groups[-1].append(seg)
        else:
            groups.append([seg])

    for group in groups:
        pos = float(median(s.pos for s in group))
        thickness = float(median(s.thickness for s in group))
        intervals = merge_intervals([(s.start, s.end) for s in group], gap=2.5)
        for start, end in intervals:
            merged.append(Segment(orientation, pos, start, end, thickness))
    return merged


def detect_segments(binary_inv: np.ndarray, raster_scale: float, words: list[Word]) -> tuple[list[Segment], list[Segment], np.ndarray]:
    if words:
        word_height_px = float(median(w.h for w in words) * raster_scale)
    else:
        word_height_px = 14.0
    hmask, vmask = line_masks(binary_inv, word_height_px)
    min_len_px = max(18, int(word_height_px * 2.6))
    h_segments = merge_colinear_segments(extract_segments_from_mask(hmask, "h", raster_scale, min_len_px, word_height_px))
    v_segments = merge_colinear_segments(extract_segments_from_mask(vmask, "v", raster_scale, min_len_px, word_height_px))
    line_mask = cv2.bitwise_or(hmask, vmask)
    return h_segments, v_segments, line_mask


# ---------------------------------------------------------------------------
# Table reconstruction from raster segments
# ---------------------------------------------------------------------------


def connected_segment_components(segments: list[Segment]) -> list[list[Segment]]:
    if not segments:
        return []
    uf = UnionFind(len(segments))
    expanded = [s.bbox.expand(1.2) for s in segments]
    for i, a in enumerate(expanded):
        for j in range(i + 1, len(expanded)):
            if a.intersects(expanded[j]):
                uf.union(i, j)
    groups: dict[int, list[Segment]] = {}
    for i, seg in enumerate(segments):
        groups.setdefault(uf.find(i), []).append(seg)
    return list(groups.values())


def build_boundary_maps(h_segments: list[Segment], v_segments: list[Segment]) -> tuple[list[float], list[float], dict[float, list[tuple[float, float]]], dict[float, list[tuple[float, float]]]]:
    x_lines = cluster_values([s.pos for s in v_segments], 1.5)
    y_lines = cluster_values([s.pos for s in h_segments], 1.5)
    h_map: dict[float, list[tuple[float, float]]] = {y: [] for y in y_lines}
    v_map: dict[float, list[tuple[float, float]]] = {x: [] for x in x_lines}

    for seg in h_segments:
        y = min(y_lines, key=lambda value: abs(value - seg.pos))
        h_map[y].append((seg.start, seg.end))
    for seg in v_segments:
        x = min(x_lines, key=lambda value: abs(value - seg.pos))
        v_map[x].append((seg.start, seg.end))

    h_map = {k: merge_intervals(v, gap=1.5) for k, v in h_map.items()}
    v_map = {k: merge_intervals(v, gap=1.5) for k, v in v_map.items()}
    return x_lines, y_lines, h_map, v_map


def discover_table_cells(
    x_lines: list[float],
    y_lines: list[float],
    h_map: dict[float, list[tuple[float, float]]],
    v_map: dict[float, list[tuple[float, float]]],
) -> list[tuple[int, int, int, int]]:
    if len(x_lines) < 2 or len(y_lines) < 2:
        return []

    row_cells: list[list[int]] = []
    for r in range(len(y_lines) - 1):
        y0, y1 = y_lines[r], y_lines[r + 1]
        if y1 - y0 < 4.0:
            continue
        active = [i for i, x in enumerate(x_lines) if intervals_cover(v_map[x], y0, y1, tol=1.5)]
        if len(active) < 2:
            continue
        for li, ri in zip(active, active[1:]):
            x0, x1 = x_lines[li], x_lines[ri]
            if x1 - x0 < 4.0:
                continue
            if not intervals_cover(h_map[y0], x0, x1, tol=1.5):
                continue
            if not intervals_cover(h_map[y1], x0, x1, tol=1.5):
                continue
            row_cells.append([li, ri, r, r + 1])

    if not row_cells:
        return []

    merged = [cell[:] for cell in row_cells]
    changed = True
    while changed:
        changed = False
        next_cells: list[list[int]] = []
        used: set[int] = set()
        for i, cell in enumerate(merged):
            if i in used:
                continue
            l, r, t, b = cell
            out = cell
            for j in range(i + 1, len(merged)):
                if j in used:
                    continue
                l2, r2, t2, b2 = merged[j]
                if l == l2 and r == r2 and b == t2:
                    shared_y = y_lines[b]
                    if not intervals_cover(h_map[shared_y], x_lines[l], x_lines[r], tol=1.5):
                        out = [l, r, t, b2]
                        used.add(j)
                        changed = True
                        b = b2
            next_cells.append(out)
        merged = next_cells

    return [tuple(cell) for cell in merged]


def build_tables(page: fitz.Page, h_segments: list[Segment], v_segments: list[Segment], words: list[Word]) -> tuple[list[TableBlock], list[RectBox]]:
    page_area = page.rect.width * page.rect.height
    segments = h_segments + v_segments
    components = connected_segment_components(segments)
    tables: list[TableBlock] = []
    table_bboxes: list[RectBox] = []

    for comp in components:
        h_comp = [s for s in comp if s.orientation == "h"]
        v_comp = [s for s in comp if s.orientation == "v"]
        if len(h_comp) < 2 or len(v_comp) < 2:
            continue
        bbox = bbox_of_rects(s.bbox for s in comp).expand(0.6).clamp(page.rect.width, page.rect.height)
        if bbox.area < page_area * 0.01:
            continue
        x_lines, y_lines, h_map, v_map = build_boundary_maps(h_comp, v_comp)
        cell_specs = discover_table_cells(x_lines, y_lines, h_map, v_map)
        if len(cell_specs) < 3:
            continue

        cells: list[TableCell] = []
        for l, r, t, b in cell_specs:
            cell_bbox = RectBox(x_lines[l], y_lines[t], x_lines[r], y_lines[b]).clamp(page.rect.width, page.rect.height)
            inside = [w for w in words if cell_bbox.contains_point(w.cx, w.cy, pad=0.8)]
            lines, font_pt = join_words_as_lines(inside)
            text = normalize_multiline_text("\n".join(lines))
            cells.append(TableCell(cell_bbox, l + 1, r + 1, t + 1, b + 1, text, font_pt))

        if not cells:
            continue
        tables.append(TableBlock(bbox, x_lines, y_lines, cells))
        table_bboxes.append(bbox)

    tables.sort(key=lambda t: (t.bbox.y0, t.bbox.x0))
    table_bboxes.sort(key=lambda b: (b.y0, b.x0))
    return tables, table_bboxes


# ---------------------------------------------------------------------------
# Residual content blocks and hidden text lines
# ---------------------------------------------------------------------------


def detect_residual_blocks(
    binary_inv: np.ndarray,
    page_width: float,
    page_height: float,
    raster_scale: float,
    table_bboxes: list[RectBox],
    words: list[Word],
) -> list[RectBox]:
    mask = binary_inv.copy()
    for table_bbox in table_bboxes:
        x0, y0, x1, y1 = rect_pt_to_px(table_bbox, raster_scale, np.dstack([mask, mask, mask]).shape, pad_px=3)
        mask[y0:y1, x0:x1] = 0

    if words:
        word_height_px = float(median(w.h for w in words) * raster_scale)
    else:
        word_height_px = 14.0
    kx = max(8, int(word_height_px * 1.6))
    ky = max(3, int(word_height_px * 0.5))
    grouped = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (kx, ky)))
    contours, _ = cv2.findContours(grouped, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    rects: list[RectBox] = []
    min_area_px = max(90, int(word_height_px * word_height_px * 0.45))
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w * h < min_area_px or max(w, h) < 8:
            continue
        rect = RectBox(x / raster_scale, y / raster_scale, (x + w) / raster_scale, (y + h) / raster_scale)
        if rect.width < 2.0 or rect.height < 2.0:
            continue
        rects.append(rect.clamp(page_width, page_height))

    merged = merge_close_rects(rects, x_gap=2.5, y_gap=1.8)
    return [r for r in merged if not any(tb.mostly_contains(r, 0.98) for tb in table_bboxes)]


def build_text_lines(words: list[Word], table_bboxes: list[RectBox]) -> list[TextLine]:
    remaining = [
        w
        for w in words
        if re.search(r"[0-9A-Za-z가-힣]", w.text)
        and not any(tb.contains_point(w.cx, w.cy, pad=0.5) for tb in table_bboxes)
    ]
    if not remaining:
        return []

    y_tol = max(2.0, median(w.h for w in remaining) * 0.55)
    ordered = sorted(remaining, key=lambda w: (round(w.cy, 2), w.x0))
    lines: list[list[Word]] = []
    cur: list[Word] = []
    cur_y: float | None = None
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

    out: list[TextLine] = []
    for line_words in lines:
        texts, font_pt = join_words_as_lines(line_words, y_tol=y_tol)
        text = normalize_multiline_text(texts[0] if texts else "")
        if not text:
            continue
        bbox = bbox_of_rects(w.bbox for w in line_words)
        out.append(TextLine(bbox, text, font_pt))
    return out


# ---------------------------------------------------------------------------
# Page conversion
# ---------------------------------------------------------------------------


def convert_page(
    page: fitz.Page,
    page_number: int,
    asset_store: AssetStore,
    raster_scale: float,
    ocr_lang: str,
) -> PageModel:
    rgb, gray, binary_inv = render_page_raster(page, raster_scale)
    words = extract_words(page, gray, raster_scale, ocr_lang)
    h_segments, v_segments, _ = detect_segments(binary_inv, raster_scale, words)
    tables, table_bboxes = build_tables(page, h_segments, v_segments, words)
    text_lines = build_text_lines(words, table_bboxes)
    residual_rects = detect_residual_blocks(binary_inv, page.rect.width, page.rect.height, raster_scale, table_bboxes, words)

    raster_blocks: list[RasterBlock] = []
    for idx, rect in enumerate(residual_rects, start=1):
        crop_ref = asset_store.add_crop(rgb, rect_pt_to_px(rect, raster_scale, rgb.shape, pad_px=1), f"p{page_number}_block")
        if not crop_ref:
            continue
        block_words = [w for w in words if rect.contains_point(w.cx, w.cy, pad=0.0)]
        block_lines, _ = join_words_as_lines(block_words)
        raster_blocks.append(RasterBlock(rect, crop_ref, normalize_multiline_text("\n".join(block_lines)), "content"))

    for idx, table in enumerate(tables, start=1):
        crop_ref = asset_store.add_crop(rgb, rect_pt_to_px(table.bbox, raster_scale, rgb.shape, pad_px=1), f"p{page_number}_table")
        table.crop_ref = crop_ref

    if not tables and not raster_blocks:
        full_ref = asset_store.add_crop(
            rgb,
            (0, 0, rgb.shape[1], rgb.shape[0]),
            f"p{page_number}_page",
        )
        if full_ref:
            raster_blocks.append(RasterBlock(RectBox(0.0, 0.0, page.rect.width, page.rect.height), full_ref, kind="fallback"))

    return PageModel(page_number, page.rect.width, page.rect.height, tables, raster_blocks, text_lines)


# ---------------------------------------------------------------------------
# HTML rendering (scan-level visual layer + semantic hidden layer)
# ---------------------------------------------------------------------------


def render_table(table: TableBlock, scale: float) -> str:
    if not table.crop_ref:
        return ""
    width = max(1.0, table.bbox.width)
    col_sizes = []
    for i in range(len(table.x_lines) - 1):
        pct = ((table.x_lines[i + 1] - table.x_lines[i]) / width) * 100.0
        col_sizes.append(f"minmax(0, {pct:.6f}%)")
    row_sizes = []
    for i in range(len(table.y_lines) - 1):
        h = max(1.0, (table.y_lines[i + 1] - table.y_lines[i]) * scale)
        row_sizes.append(f"minmax({h:.2f}px, auto)")

    cells_html: list[str] = []
    for cell in table.cells:
        cells_html.append(
            f'<div class="table-cell" style="grid-column:{cell.col_start} / {cell.col_end}; grid-row:{cell.row_start} / {cell.row_end};">'
            f'<span class="hidden-text">{render_multiline(cell.text)}</span>'
            '</div>'
        )

    return (
        f'<div class="table-block scan-surface" '
        f'style="left:{table.bbox.x0 * scale:.2f}px; top:{table.bbox.y0 * scale:.2f}px; '
        f'width:{table.bbox.width * scale:.2f}px; height:{table.bbox.height * scale:.2f}px; '
        f'background-image:url(\'{html.escape(table.crop_ref, quote=True)}\');">'
        f'<div class="table-grid" style="grid-template-columns:{" ".join(col_sizes)}; grid-template-rows:{" ".join(row_sizes)};">'
        + "".join(cells_html)
        + "</div></div>"
    )


def render_raster_block(block: RasterBlock, scale: float) -> str:
    return (
        f'<div class="raster-block scan-surface" aria-label="{html.escape(block.text)}" '
        f'style="left:{block.bbox.x0 * scale:.2f}px; top:{block.bbox.y0 * scale:.2f}px; '
        f'width:{block.bbox.width * scale:.2f}px; height:{block.bbox.height * scale:.2f}px; '
        f'background-image:url(\'{html.escape(block.crop_ref, quote=True)}\');"></div>'
    )


def render_text_line(line: TextLine, scale: float) -> str:
    font_px = max(8.0, min(22.0, line.font_pt * scale * 0.95))
    return (
        f'<div class="semantic-line" style="left:{line.bbox.x0 * scale:.2f}px; top:{line.bbox.y0 * scale:.2f}px; '
        f'width:{line.bbox.width * scale:.2f}px; font-size:{font_px:.2f}px;">'
        f'{html.escape(line.text)}'
        '</div>'
    )


def render_page(page: PageModel, scale: float) -> str:
    visible = []
    for table in page.tables:
        visible.append(render_table(table, scale))
    for block in page.raster_blocks:
        visible.append(render_raster_block(block, scale))

    semantic = []
    for line in page.text_lines:
        semantic.append(render_text_line(line, scale))

    return (
        f'<section class="page" data-page="{page.number}" '
        f'style="width:{page.width * scale:.2f}px; min-height:{page.height * scale:.2f}px;">'
        + "".join(visible)
        + ''.join(semantic)
        + '</section>'
    )


def render_document(pages: list[PageModel], title: str, scale: float) -> str:
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
      --shadow:rgba(0,0,0,.12);
    }}
    * {{ box-sizing:border-box; }}
    body {{
      margin:0;
      background:var(--canvas);
      font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;
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
      overflow:hidden;
    }}
    .scan-surface {{
      position:absolute;
      background-repeat:no-repeat;
      background-size:100% 100%;
      background-position:center center;
    }}
    .table-block {{ position:absolute; }}
    .table-grid {{
      position:absolute;
      inset:0;
      display:grid;
    }}
    .table-cell {{ position:relative; min-width:0; min-height:0; overflow:hidden; }}
    .raster-block {{ position:absolute; }}
    .hidden-text,
    .semantic-line {{
      color:transparent;
      opacity:0;
      user-select:text;
      -webkit-user-select:text;
      pointer-events:none;
    }}
    .hidden-text {{
      position:absolute;
      inset:0;
      white-space:pre-line;
      overflow:hidden;
    }}
    .semantic-line {{
      position:absolute;
      white-space:pre;
      line-height:1.05;
    }}
    @media print {{
      body {{ background:#fff; }}
      .viewer {{ padding:0; gap:0; }}
      .page {{ box-shadow:none; page-break-after:always; }}
      .page:last-child {{ page-break-after:auto; }}
    }}
  </style>
</head>
<body>
  <main class="viewer">{pages_html}</main>
</body>
</html>'''


# ---------------------------------------------------------------------------
# Public API / CLI
# ---------------------------------------------------------------------------


def convert_pdf_to_html(
    input_pdf: str | os.PathLike[str],
    output_html: str | os.PathLike[str],
    *,
    scale: float = 1.28,
    raster_scale: float = 2.8,
    ocr_lang: str = "kor+eng",
    asset_mode: str = "external",
) -> None:
    doc = fitz.open(str(input_pdf))
    asset_store = AssetStore(output_html, mode=asset_mode)
    pages = [
        convert_page(page, i + 1, asset_store, raster_scale=raster_scale, ocr_lang=ocr_lang)
        for i, page in enumerate(doc)
    ]
    html_doc = render_document(pages, Path(input_pdf).stem, scale)
    Path(output_html).write_text(html_doc, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Convert PDF to scan-level div/grid HTML using raster-first table detection, "
            "OCR/PDF-text semantic overlay, and block crops instead of SVG."
        )
    )
    parser.add_argument("input_pdf", help="Input PDF path")
    parser.add_argument("output_html", help="Output HTML path")
    parser.add_argument("--scale", type=float, default=1.28, help="PDF point to CSS pixel scale")
    parser.add_argument("--raster-scale", type=float, default=2.8, help="Rasterization scale used for analysis/crops")
    parser.add_argument("--ocr-lang", default="kor+eng", help="Tesseract language pack(s), e.g. kor+eng")
    parser.add_argument(
        "--asset-mode",
        choices=("external", "embed"),
        default="external",
        help="Store crop images in a sibling assets directory or embed them as data URLs",
    )
    args = parser.parse_args()
    convert_pdf_to_html(
        args.input_pdf,
        args.output_html,
        scale=args.scale,
        raster_scale=args.raster_scale,
        ocr_lang=args.ocr_lang,
        asset_mode=args.asset_mode,
    )
