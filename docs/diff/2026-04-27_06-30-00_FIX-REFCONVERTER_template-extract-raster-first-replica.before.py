from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import sys
from pathlib import Path
from statistics import median
from types import SimpleNamespace


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
DEFAULT_ENGINE_VERSION = "47"
ENGINE_CONFIGS = {
    "47": {
        "version_label": "v2.21",
        "clone_id": "pdf-raster-first-v2.21",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_21",
    },
    "46": {
        "version_label": "v2.2",
        "clone_id": "pdf-raster-first-v2.2",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_2",
    },
    "32": {
        "version_label": "v2.01",
        "clone_id": "pdf-raster-first-v2.01",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_01",
    },
    "33": {
        "version_label": "v2.02",
        "clone_id": "pdf-raster-first-v2.02",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_02",
    },
    "34": {
        "version_label": "v2.03",
        "clone_id": "pdf-raster-first-v2.03",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_03",
    },
    "35": {
        "version_label": "v2.04",
        "clone_id": "pdf-raster-first-v2.04",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_04",
    },
    "36": {
        "version_label": "v2.05",
        "clone_id": "pdf-raster-first-v2.05",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_05",
    },
    "42": {
        "version_label": "v2.11",
        "clone_id": "pdf-raster-first-v2.11",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_11",
    },
    "43": {
        "version_label": "v2.12",
        "clone_id": "pdf-raster-first-v2.12",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_12",
    },
    "44": {
        "version_label": "v2.13",
        "clone_id": "pdf-raster-first-v2.13",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_13",
    },
    "45": {
        "version_label": "v2.14",
        "clone_id": "pdf-raster-first-v2.14",
        "clone_builder": "pdf_raster_first_editable_checkbox_v2_14",
    },
}


def v202_is_v22_clone(clone_id: str) -> bool:
    return str(clone_id or "").startswith("pdf-raster-first-v2.2")


def v202_is_v221_clone(clone_id: str) -> bool:
    return str(clone_id or "") == "pdf-raster-first-v2.21"


def normalize_extraction_stage(extraction_stage: str) -> str:
    return "frames" if str(extraction_stage or "").strip().lower() == "frames" else "full"


def normalize_frame_group_version(frame_group_version: str) -> str:
    normalized = str(frame_group_version or "").strip().lower()

    if normalized == "v1.11" or normalized.startswith("v1.11-"):
        return "v1.11"
    if normalized == "v1.10" or normalized.startswith("v1.10-"):
        return "v1.10"
    if normalized == "v1.09" or normalized.startswith("v1.09-"):
        return "v1.09"
    if normalized == "v1.01":
        return "v1.01"
    if normalized == "v1.02":
        return "v1.02"
    if normalized == "v1.03":
        return "v1.03"
    if normalized == "v1.04":
        return "v1.04"
    if normalized == "v1.08":
        return "v1.08"
    if normalized == "v1.07":
        return "v1.07"
    if normalized == "v1.06":
        return "v1.06"

    return "v1.05"


def resolve_frame_group_version_tag(frame_group_version: str) -> str:
    normalized = str(frame_group_version or "").strip().lower()

    if normalized == "v1.11":
        return "v1.11-default"

    if normalized.startswith("v1.11-"):
        return normalized

    if normalized == "v1.10":
        return "v1.10-default"

    if normalized.startswith("v1.10-"):
        return normalized

    if normalized == "v1.09":
        return "v1.09-default"

    if normalized.startswith("v1.09-"):
        return normalized

    return normalize_frame_group_version(frame_group_version)


def is_profile_frame_group_version(frame_group_version: str) -> bool:
    return normalize_frame_group_version(frame_group_version) in {"v1.09", "v1.10", "v1.11"}


V201_EDIT_OVERLAY_STYLE = """
<style>
  .template-clone--raster-first-v2 .v201-edit-overlay {
    position:absolute;
    inset:0;
    z-index:20;
    pointer-events:none;
  }
  .template-clone--raster-first-v2 .v202-edit-region {
    position:absolute;
    pointer-events:none;
    z-index:1;
  }
  .template-clone--raster-first-v2 .v201-edit-text,
  .template-clone--raster-first-v2 .v201-choice-row {
    position:absolute;
    pointer-events:auto;
  }
  .template-clone--raster-first-v2 .v201-edit-text {
    display:block;
    min-width:8px;
    min-height:8px;
    color:transparent;
    opacity:.02;
    white-space:pre-wrap;
    line-height:1.15;
    overflow:hidden;
    user-select:text;
    -webkit-user-select:text;
    cursor:text;
    transition:opacity .12s ease, background-color .12s ease, color .12s ease, outline-color .12s ease;
  }
  .template-clone--raster-first-v2 .v202-edit-text {
    width:100%;
    height:100%;
    overflow:visible;
    padding:0;
    background:transparent;
    caret-color:#111827;
  }
  .template-clone--raster-first-v2 .v201-edit-text:focus,
  .template-clone--raster-first-v2 .v201-edit-text[data-template-edited="true"] {
    color:#111827;
    opacity:1;
    background:rgba(255,255,255,.92);
    outline:1px dashed #2563eb;
    overflow:visible;
    z-index:2;
  }
  .template-clone--raster-first-v2 .v201-edit-text[data-template-edited="true"]:not(:focus) {
    outline:0;
  }
  .template-clone--raster-first-v2 .v202-edit-region:hover .v202-edit-text,
  .template-clone--raster-first-v2 .v202-edit-text:hover {
    opacity:.18;
    outline:1px dashed rgba(37,99,235,.28);
    background:rgba(255,255,255,.16);
  }
  .template-clone--raster-first-v2 .v201-choice-row {
    display:flex;
    align-items:center;
    gap:4px;
    opacity:.04;
  }
  .template-clone--raster-first-v2 .v201-choice-row:hover,
  .template-clone--raster-first-v2 .v201-choice-row:focus-within,
  .template-clone--raster-first-v2 .v201-choice-row[data-template-edited="true"] {
    opacity:1;
  }
  .template-clone--raster-first-v2 .v201-choice-row[data-template-edited="true"] {
    background:rgba(255,255,255,.92);
  }
  .template-clone--raster-first-v2 .v201-choice-box {
    width:10px;
    height:10px;
    padding:0;
    border:1px solid #111827;
    background:#fff;
    appearance:none;
    -webkit-appearance:none;
  }
  .template-clone--raster-first-v2 .v201-choice-box[data-checked="1"]::after {
    content:"";
    display:block;
    width:6px;
    height:6px;
    margin:1px;
    background:#111827;
  }
  .template-clone--raster-first-v2 .v201-choice-label {
    position:static;
    opacity:1;
    color:transparent;
  }
  .template-clone--raster-first-v2 .v201-choice-label:focus,
  .template-clone--raster-first-v2 .v201-choice-row[data-template-edited="true"] .v201-choice-label {
    color:#111827;
  }
</style>
<script>
(() => {
  const markEdited = node => {
    if (!node) return;
    node.setAttribute('data-template-edited', 'true');
  };
  document.addEventListener('input', event => {
    const editable = event.target.closest?.('.v201-edit-text');
    if (!editable) return;
    markEdited(editable);
    markEdited(editable.closest('.v201-choice-row'));
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.v201-choice-box');
    if (!button) return;
    const next = button.getAttribute('data-checked') === '1' ? '0' : '1';
    button.setAttribute('data-checked', next);
    button.setAttribute('aria-checked', next === '1' ? 'true' : 'false');
    markEdited(button);
    markEdited(button.closest('.v201-choice-row'));
  });
})();
</script>
"""

V202_STRUCTURED_DOM_STYLE = """
<style>
  .template-clone--raster-first-v2-structured {
    width: fit-content;
    margin: 0 auto;
    background: transparent;
    color: #111827;
    font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
  }
  .template-clone--raster-first-v2-structured .viewer {
    padding: 24px 14px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .template-clone--raster-first-v2-structured .page {
    position: relative;
    background: #ffffff;
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }
  .template-clone--raster-first-v2-structured .page-inner {
    position: relative;
    width: 100%;
    min-height: inherit;
  }
  .template-clone--raster-first-v2-structured .v211-page-region {
    position: relative;
    width: 100%;
  }
  .template-clone--raster-first-v2-structured .v211-frame-stack {
    position: relative;
  }
  .template-clone--raster-first-v2-structured .v211-frame-flow-item {
    position: relative;
  }
  .template-clone--raster-first-v2-structured .v202-table-frame {
    position: relative;
  }
  .template-clone--raster-first-v2-structured .v202-table-block {
    margin: 0;
    border-collapse: collapse;
    border-spacing: 0;
    table-layout: fixed;
    background: #ffffff;
  }
  .template-clone--raster-first-v2-structured .v202-table-block td {
    border: 1px solid #2f2f2f;
    padding: var(--v202-pad-y, 4px) var(--v202-pad-x, 6px);
    vertical-align: top;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    color: #111827;
    background: #ffffff;
    box-sizing: border-box;
  }
  .template-clone--raster-first-v2-structured .v202-table-block td.v202-cell-empty {
    padding: 0;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block {
    position: relative;
    z-index: 1;
    background: transparent;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v22-table-raster {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-position: center center;
    pointer-events: none;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block td {
    position: relative;
    border: 0;
    background: transparent;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block td.v202-cell-empty {
    border: 0;
    background: transparent;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame {
    overflow: hidden;
    background: #ffffff;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame[data-v22-live="true"] .v22-table-raster {
    display: none;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block tr[data-v22-edited="true"] td {
    border: 1px solid #2f2f2f;
    background: #ffffff;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block tr[data-v22-edited="true"] td.v202-cell-empty {
    background: #ffffff;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame[data-v22-live="true"] .v202-table-block td {
    border: 1px solid #2f2f2f;
    background: #ffffff;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame[data-v22-live="true"] .v202-table-block td.v202-cell-empty {
    background: #ffffff;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v22-html-shell {
    position: absolute;
    inset: 0;
    padding: inherit;
    opacity: 0;
    overflow: hidden;
    pointer-events: auto;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v22-html-shell [contenteditable="true"] {
    caret-color: transparent;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block tr[data-v22-edited="true"] .v22-html-shell {
    position: static;
    inset: auto;
    padding: 0;
    opacity: 1;
    overflow: visible;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-block tr[data-v22-edited="true"] .v22-html-shell [contenteditable="true"] {
    caret-color: #111827;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame[data-v22-live="true"] .v22-html-shell {
    position: static;
    inset: auto;
    padding: 0;
    opacity: 1;
    overflow: visible;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame[data-v22-live="true"] .v22-html-shell [contenteditable="true"] {
    caret-color: #111827;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v22-raster-region {
    position: absolute;
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-position: center center;
    pointer-events: none;
  }
  .template-clone--raster-first-v2-structured .halign-left {
    text-align: left;
  }
  .template-clone--raster-first-v2-structured .halign-center {
    text-align: center;
  }
  .template-clone--raster-first-v2-structured .halign-right {
    text-align: right;
  }
  .template-clone--raster-first-v2-structured .valign-top {
    vertical-align: top;
  }
  .template-clone--raster-first-v2-structured .valign-middle {
    vertical-align: middle;
  }
  .template-clone--raster-first-v2-structured .v202-cell-box,
  .template-clone--raster-first-v2-structured .v202-text-box {
    display: block;
    width: 100%;
    min-height: 1.12em;
    box-sizing: border-box;
  }
  .template-clone--raster-first-v2-structured .v202-frame-group {
    min-height: inherit;
  }
  .template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-cell-box {
    min-height: 100%;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"] {
    width: 100%;
    margin: 0;
    padding: 0;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"] .page {
    margin: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
    overflow: visible;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"] .page-inner {
    margin: 0;
    padding: 0;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v202-table-frame {
    background: transparent;
    overflow: visible;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band {
    position: absolute;
    padding: 0;
    background: transparent;
    box-sizing: border-box;
    z-index: 1;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    background: transparent;
    border: 1px solid rgba(15, 23, 42, 0.55);
    box-sizing: border-box;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table tbody {
    background: var(--v102-row-color, rgba(59, 130, 246, 0.08));
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table td {
    position: relative;
    border: 0;
    background: var(--v102-col-color, rgba(14, 165, 233, 0.14));
    padding: 0;
    min-height: 14px;
    overflow: hidden;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table td + td {
    border-left: 1px solid rgba(15, 23, 42, 0.55);
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table tr + tr td {
    border-top: 1px solid rgba(15, 23, 42, 0.55);
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table td::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--v102-row-color, rgba(59, 130, 246, 0.08));
    pointer-events: none;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v102-frame-band-table .v202-frame-group {
    position: relative;
    z-index: 3;
    min-height: 0;
    height: 100%;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v202-frame-group-input {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    border: 0;
    resize: none;
    margin: 0;
    padding: 0;
    background: transparent;
    color: #0f172a;
    font: inherit;
    line-height: 1.2;
    border-radius: 0;
    appearance: none;
    -webkit-appearance: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
    outline: none;
    overflow: hidden;
    white-space: pre-wrap;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v202-frame-group-input::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v202-frame-group[data-template-frame-halign="center"] .v202-frame-group-input {
    text-align: center;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"]:not([data-template-frame-group-version="v1.01"]) .v202-frame-group[data-template-frame-halign="right"] .v202-frame-group-input {
    text-align: right;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.09"] .v102-frame-band-table,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.10"] .v102-frame-band-table,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.11"] .v102-frame-band-table {
    border-color: rgba(15, 23, 42, 0.48);
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.09"] .v102-frame-band-table tbody,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.10"] .v102-frame-band-table tbody,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.11"] .v102-frame-band-table tbody {
    background: transparent;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.09"] .v102-frame-band-table td,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.10"] .v102-frame-band-table td,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.11"] .v102-frame-band-table td {
    background: transparent;
  }
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.09"] .v102-frame-band-table td::before,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.10"] .v102-frame-band-table td::before,
  .template-clone--raster-first-v2-structured[data-template-extraction-stage="frames"][data-template-frame-group-version^="v1.11"] .v102-frame-band-table td::before {
    background: transparent;
  }
  .template-clone--raster-first-v2-structured .v202-text-block {
    position: absolute;
    color: #111827;
    white-space: pre-wrap;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  .template-clone--raster-first-v2-structured .v202-line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px;
    min-height: 1.14em;
  }
  .template-clone--raster-first-v2-structured .v202-line--choice {
    align-items: center;
  }
  .template-clone--raster-first-v2-structured .v202-choice-fragment {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .template-clone--raster-first-v2-structured .v202-choice-box {
    width: 10px;
    height: 10px;
    padding: 0;
    border: 1px solid #111827;
    background: #ffffff;
    appearance: none;
    -webkit-appearance: none;
    box-sizing: border-box;
    cursor: pointer;
    vertical-align: middle;
  }
  .template-clone--raster-first-v2-structured .v202-choice-box[data-checked="1"]::after {
    content: "";
    display: block;
    width: 6px;
    height: 6px;
    margin: 1px;
    background: #111827;
  }
  .template-clone--raster-first-v2-structured .v202-structured-text {
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .template-clone--raster-first-v2-structured .v202-structured-text:focus {
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.28);
  }
  .template-clone--raster-first-v2-structured .template-clone__field-value {
    display: block;
    width: 100%;
    min-height: 1.1em;
    box-sizing: border-box;
    outline: none;
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
    caret-color: #111827;
  }
  .template-clone--raster-first-v2-structured .template-clone__field-value--inline {
    display: inline-block;
    min-width: 0;
  }
  .template-clone--raster-first-v2-structured .template-clone__field-key {
    display: block;
    min-height: 1.1em;
    outline: none;
    color: #111827;
    user-select: text;
    -webkit-user-select: text;
  }
  .template-clone--raster-first-v2-structured .template-clone__field-key--inline {
    display: inline-block;
    min-width: 0;
  }
  .template-clone--raster-first-v2-structured .v202-inline-editor-row {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    outline: none;
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
    caret-color: #111827;
  }
  .template-clone--raster-first-v2-structured .v202-source-inline-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 0;
    width: 100%;
    white-space: nowrap;
  }
  .template-clone--raster-first-v2-structured .v202-inline-positioned-part {
    display: inline-flex;
    align-items: stretch;
    flex: 0 0 auto;
    min-height: 1.1em;
    vertical-align: top;
  }
  .template-clone--raster-first-v2-structured .v202-inline-positioned-part > .template-clone__field-value--inline,
  .template-clone--raster-first-v2-structured .v202-inline-positioned-part > .template-clone__field-key--inline {
    display: block;
    width: 100%;
  }
  .template-clone--raster-first-v2-structured [data-template-edit-scope="admin"][data-template-edit-enabled="true"] {
    cursor: text;
  }
  .template-clone--raster-first-v2-structured [data-template-edit-scope="admin"][data-template-edit-enabled="false"] {
    cursor: default;
  }
  .template-clone--raster-first-v2-structured .v202-choice-label {
    outline: none;
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
    caret-color: #111827;
  }
  .template-clone--raster-first-v2-structured .v202-status-line {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    white-space: nowrap;
  }
  .template-clone--raster-first-v2-structured .v202-status-code {
    display: inline-block;
    min-width: 26px;
  }
  .template-clone--raster-first-v2-structured .v202-status-options {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .template-clone--raster-first-v2-structured .v202-status-option {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  @media print {
    .template-clone--raster-first-v2-structured .viewer {
      padding: 0;
      gap: 0;
    }
    .template-clone--raster-first-v2-structured .page {
      box-shadow: none;
      page-break-after: always;
    }
    .template-clone--raster-first-v2-structured .page:last-child {
      page-break-after: auto;
    }
  }
</style>
"""

V202_STRUCTURED_DOM_SCRIPT = """
<script>
(() => {
  const resolveEditRole = () =>
    document.documentElement.getAttribute('data-template-edit-role') ||
    document.body.getAttribute('data-template-edit-role') ||
    'editor';
  const applyEditPermissions = () => {
    const isAdmin = resolveEditRole() === 'admin';
    document.querySelectorAll('[data-template-edit-scope]').forEach(element => {
      const scope = element.getAttribute('data-template-edit-scope') || 'editor';
      const enabled = scope !== 'admin' || isAdmin;
      element.setAttribute('contenteditable', enabled ? 'true' : 'false');
      element.setAttribute('data-template-edit-enabled', enabled ? 'true' : 'false');
    });
  };
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.v202-choice-box');
    if (!button) return;
    const next = button.getAttribute('data-checked') === '1' ? '0' : '1';
    button.setAttribute('data-checked', next);
    button.setAttribute('aria-checked', next === '1' ? 'true' : 'false');
  });
  const resolveV22Row = node =>
    node?.closest?.('.template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] tr');
  const resolveV22TableFrame = node =>
    node?.closest?.('.template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] .v202-table-frame');
  const resolveV22Cell = node =>
    node?.closest?.('.template-clone--raster-first-v2-structured[data-template-clone-id^="pdf-raster-first-v2.2"] td');
  const markV22RowEdited = node => {
    const row = resolveV22Row(node);
    if (!row) return;
    row.setAttribute('data-v22-edited', 'true');
  };
  const markV22TableLive = node => {
    const tableFrame = resolveV22TableFrame(node);
    if (!tableFrame) return false;
    const wasLive = tableFrame.getAttribute('data-v22-live') === 'true';
    if (!wasLive) {
      tableFrame.setAttribute('data-v22-live', 'true');
    }
    return wasLive;
  };
  const activateV22Cell = cell => {
    if (!cell || cell.classList.contains('v202-cell-empty')) return;
    const row = resolveV22Row(cell);
    const wasRowEdited = row?.getAttribute('data-v22-edited') === 'true';
    markV22RowEdited(cell);
    if (wasRowEdited) return;
    const focusTarget = cell.querySelector('[contenteditable="true"], .v202-choice-box');
    if (!focusTarget) return;
    window.requestAnimationFrame(() => {
      focusTarget.focus?.();
    });
  };
  document.addEventListener('pointerdown', event => {
    const cell = resolveV22Cell(event.target);
    if (!cell) return;
    activateV22Cell(cell);
  });
  document.addEventListener('focusin', event => {
    markV22RowEdited(event.target);
  });
  document.addEventListener('paste', event => {
    const editable = event.target.closest?.('[contenteditable="true"]');
    if (!editable) return;
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData)?.getData('text/plain') || '';
    if (document.queryCommandSupported?.('insertText')) {
      document.execCommand('insertText', false, text);
      return;
    }
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
  });
  window.templateExtractSetEditRole = role => {
    document.documentElement.setAttribute('data-template-edit-role', role === 'admin' ? 'admin' : 'editor');
    applyEditPermissions();
  };
  const FRAME_STROKE_WIDTH = 1.15;
  const mergeFrameSegments = segments => {
    const sorted = [...segments].sort((a, b) => {
      if (Math.abs(a.pos - b.pos) > 0.25) return a.pos - b.pos;
      if (Math.abs(a.start - b.start) > 0.25) return a.start - b.start;
      return a.end - b.end;
    });
    const merged = [];
    sorted.forEach(segment => {
      const previous = merged[merged.length - 1];
      if (
        previous &&
        Math.abs(previous.pos - segment.pos) <= 0.25 &&
        segment.start <= previous.end + 1.25
      ) {
        previous.start = Math.min(previous.start, segment.start);
        previous.end = Math.max(previous.end, segment.end);
        return;
      }
      merged.push({ ...segment });
    });
    return merged.filter(segment => segment.end - segment.start >= 1);
  };
  const syncTableFrameSvg = wrapper => {
    const table = wrapper.querySelector('.v202-table-block');
    const svg = wrapper.querySelector('.v202-frame-svg');
    if (!table || !svg) return;
    const strokeWidth = Number.parseFloat(svg.getAttribute('data-frame-stroke-width') || '') || FRAME_STROKE_WIDTH;
    const wrapperRect = wrapper.getBoundingClientRect();
    if (!wrapperRect.width || !wrapperRect.height) return;
    const hSegments = [];
    const vSegments = [];
    table.querySelectorAll('td').forEach(cell => {
      const cellRect = cell.getBoundingClientRect();
      const left = cellRect.left - wrapperRect.left;
      const right = cellRect.right - wrapperRect.left;
      const top = cellRect.top - wrapperRect.top;
      const bottom = cellRect.bottom - wrapperRect.top;
      hSegments.push({ pos: top, start: left, end: right });
      hSegments.push({ pos: bottom, start: left, end: right });
      vSegments.push({ pos: left, start: top, end: bottom });
      vSegments.push({ pos: right, start: top, end: bottom });
    });
    const width = Math.max(1, wrapperRect.width);
    const height = Math.max(1, wrapperRect.height);
    svg.setAttribute('viewBox', `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`);
    const lines = [];
    mergeFrameSegments(hSegments).forEach(segment => {
      lines.push(
        `<line x1="${segment.start.toFixed(2)}" y1="${segment.pos.toFixed(2)}" x2="${segment.end.toFixed(2)}" y2="${segment.pos.toFixed(2)}" stroke-width="${strokeWidth.toFixed(2)}"></line>`
      );
    });
    mergeFrameSegments(vSegments).forEach(segment => {
      lines.push(
        `<line x1="${segment.pos.toFixed(2)}" y1="${segment.start.toFixed(2)}" x2="${segment.pos.toFixed(2)}" y2="${segment.end.toFixed(2)}" stroke-width="${strokeWidth.toFixed(2)}"></line>`
      );
    });
    svg.innerHTML = lines.join('');
    svg.style.width = `${width.toFixed(2)}px`;
    svg.style.height = `${height.toFixed(2)}px`;
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.strokeWidth = `${FRAME_STROKE_WIDTH}`;
  };
  let frameSyncQueued = false;
  const syncAllTableFrameSvgs = () => {
    frameSyncQueued = false;
    document.querySelectorAll('.v202-table-frame').forEach(syncTableFrameSvg);
  };
  const queueTableFrameSync = () => {
    if (frameSyncQueued) return;
    frameSyncQueued = true;
    window.requestAnimationFrame(syncAllTableFrameSvgs);
  };
  if (typeof ResizeObserver !== 'undefined') {
    const tableResizeObserver = new ResizeObserver(() => queueTableFrameSync());
    document.querySelectorAll('.v202-table-frame').forEach(wrapper => {
      if (wrapper.querySelector('.v202-frame-svg')) {
        tableResizeObserver.observe(wrapper);
      }
    });
  }
  document.addEventListener('input', event => {
    markV22RowEdited(event.target);
    markV22TableLive(event.target);
    if (event.target.closest?.('.v202-table-frame')) {
      queueTableFrameSync();
    }
  });
  document.addEventListener('click', event => {
    markV22RowEdited(event.target);
    if (event.target.closest?.('.v202-choice-box')) {
      markV22TableLive(event.target);
      if (event.target.closest?.('.v202-table-frame')) {
        queueTableFrameSync();
      }
    }
  });
  window.addEventListener('load', queueTableFrameSync, { once: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => queueTableFrameSync()).catch(() => undefined);
  }
  queueTableFrameSync();
  applyEditPermissions();
})();
</script>
"""

V202_FRAME_STROKE_WIDTH = 1.15

V202_KNOWN_LABEL_RULES = [
    {"matches": ["양식명(코드)"], "canonical": "양식명(코드)", "field_type": "text"},
    {"matches": ["양식 문서번호"], "canonical": "양식 문서번호", "field_type": "text"},
    {"matches": ["구분", "구 분"], "canonical": "구분", "field_type": "text"},
    {"matches": ["문서번호", "문 서 번 호"], "canonical": "문서번호", "field_type": "text"},
    {"matches": ["작성자", "작 성 자"], "canonical": "작성자", "field_type": "text"},
    {"matches": ["발급일", "발 급 일"], "canonical": "발급일", "field_type": "date"},
    {"matches": ["협력사승인일"], "canonical": "협력사승인일", "field_type": "date"},
    {"matches": ["프로젝트", "프 로 젝 트"], "canonical": "프로젝트", "field_type": "text"},
    {"matches": ["발급자", "발 급 자"], "canonical": "발급자", "field_type": "text"},
    {"matches": ["계약", "계 약"], "canonical": "계약", "field_type": "text"},
    {"matches": ["접수자", "접 수 자"], "canonical": "접수자", "field_type": "text"},
    {"matches": ["접수자 서명", "접수자서명"], "canonical": "접수자 서명", "field_type": "text"},
    {"matches": ["제목", "제 목"], "canonical": "제목", "field_type": "text"},
    {"matches": ["공사 내용", "공사내용"], "canonical": "공사 내용", "field_type": "textarea"},
    {"matches": ["대표수량 및 단가", "대표수량단가등", "대표수량,단가등"], "canonical": "대표수량 및 단가", "field_type": "textarea"},
    {"matches": ["하도급 대금", "하도급대금"], "canonical": "하도급 대금", "field_type": "text"},
    {"matches": ["공사착수일"], "canonical": "공사착수일", "field_type": "date"},
    {"matches": ["공사완료일"], "canonical": "공사완료일", "field_type": "date"},
    {"matches": ["검사의 방법", "검사의방법"], "canonical": "검사의 방법", "field_type": "textarea"},
    {"matches": ["검사의 시기", "검사의시기"], "canonical": "검사의 시기", "field_type": "text"},
    {"matches": ["대금 지급방법", "대금지급방법"], "canonical": "대금 지급방법", "field_type": "text"},
    {"matches": ["대금 지급시기", "대금지급시기"], "canonical": "대금 지급시기", "field_type": "text"},
    {"matches": ["원재료 지급시 조건", "원재료지급시조건"], "canonical": "원재료 지급시 조건", "field_type": "text"},
    {
        "matches": ["공급원가 변동에 따른 하도급 대금의 조정", "공급원가변동에따른", "하도급대금의조정"],
        "canonical": "공급원가 변동에 따른 하도급 대금의 조정",
        "field_type": "textarea",
    },
    {"matches": ["특기사항", "기타"], "canonical": "특기사항", "field_type": "textarea"},
    {"matches": ["첨부파일"], "canonical": "첨부파일", "field_type": "textarea"},
    {
        "matches": ["하도급대금 연동에 관한 사항", "하도급대금연동에관한사항"],
        "canonical": "하도급대금 연동에 관한 사항",
        "field_type": "text",
    },
    {"matches": ["상호(법인명)", "상호 (법인명)", "성명(법인명)"], "canonical": "상호(법인명)", "field_type": "text"},
    {"matches": ["사업자등록번호", "사업 등록번호"], "canonical": "사업자등록번호", "field_type": "text"},
    {"matches": ["대표자성명(대표유형)", "대표자성명", "대표자 성명"], "canonical": "대표자성명(대표유형)", "field_type": "text"},
    {"matches": ["주민(법인)등록번호", "주민등록번호", "법인등록번호"], "canonical": "주민(법인)등록번호", "field_type": "text"},
    {"matches": ["사업장소재지"], "canonical": "사업장소재지", "field_type": "textarea"},
    {"matches": ["개업일", "개업 일"], "canonical": "개업일", "field_type": "date"},
    {"matches": ["사업자등록일", "사업자등록 일"], "canonical": "사업자등록일", "field_type": "date"},
    {"matches": ["공동사업자", "공동 사업자"], "canonical": "공동사업자", "field_type": "text"},
    {"matches": ["주민(사업자)등록번호", "주민(사업자) 등록번호"], "canonical": "주민(사업자)등록번호", "field_type": "text"},
    {"matches": ["발급번호"], "canonical": "발급번호", "field_type": "text"},
    {"matches": ["처리기간"], "canonical": "처리기간", "field_type": "text"},
    {"matches": ["접수번호"], "canonical": "접수번호", "field_type": "text"},
    {"matches": ["담당부서"], "canonical": "담당부서", "field_type": "text"},
    {"matches": ["발급기관"], "canonical": "발급기관", "field_type": "text"},
    {"matches": ["담당자 연락처", "담당자연락처"], "canonical": "담당자 연락처", "field_type": "text"},
    {"matches": ["과세유형"], "canonical": "과세유형", "field_type": "text"},
    {"matches": ["발급자 서명자", "발급자서명"], "canonical": "발급자 서명자", "field_type": "text"},
    {"matches": ["전자서명 상태"], "canonical": "전자서명 상태", "field_type": "text"},
]

V202_STATUS_ACTOR_LABEL_MAP = {
    "CAE": "CAE 담당자",
    "CE": "CE 담당자",
    "CAM": "CAM 담당자",
    "PM": "PM 담당자",
}

V202_STATUS_TIME_LABEL_MAP = {
    "CAE": "CAE 처리시각",
    "CE": "CE 처리시각",
    "CAM": "CAM 처리시각",
    "PM": "PM 처리시각",
}

V202_MULTI_FIELD_SEGMENT_REGEX = re.compile(
    r"([^:：]{1,48})\s*[:：]\s*(.*?)(?=(?:\s+[^:：]{1,48}\s*[:：]\s*)|$)"
)
V202_STATUS_LINE_REGEX = re.compile(r"^([A-Z]{2,5})\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$")
V202_SIGNATURE_LINE_REGEX = re.compile(
    r"^발급자 서명\s+(.+?)\s+(전자서명\s*(?:완료|대기|실패|미완료))(?:\s+접수자 서명\s*(.*))?$"
)
V202_INLINE_LABEL_REGEX = re.compile(r"^([^:：]{1,80})\s*[:：]\s*(.+)$")
V202_NUMBERED_LABEL_REGEX = re.compile(r"^\d+(?:-\d+)?\.\s*")
V202_ADMIN_EDITABLE_LABEL_KEYS = {
    re.sub(r"\s+", "", value).replace(":", "").replace("：", "").lower()
    for value in [
        "구분",
        "발급자 서명",
        "접수자 서명",
        *[rule["canonical"] for rule in V202_KNOWN_LABEL_RULES],
    ]
}


def v202_escape_attr(value: str) -> str:
    return html.escape(str(value or ""), quote=True)


def v202_normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def v202_strip_number_prefix(value: str) -> str:
    raw_value = str(value or "")
    normalized = re.sub(r"^\d+(?:-\d+)?(?:[.)]|(?=[가-힣A-Za-z]))\s*", "", raw_value)
    normalized = V202_NUMBERED_LABEL_REGEX.sub("", normalized)
    return v202_normalize_whitespace(normalized.replace("*", ""))


def v202_compact_label(value: str) -> str:
    normalized = v202_strip_number_prefix(value)
    return (
        normalized
        .replace(" ", "")
        .replace(":", "")
        .replace("：", "")
        .replace("*", "")
        .strip()
    )


def v202_text_to_html(value: str) -> str:
    parts = [html.escape(part, quote=False) for part in str(value or "").splitlines()]
    return "<br>".join(parts)


def v202_resolve_known_label(text: str):
    cleaned = v202_strip_number_prefix(text)

    if not cleaned:
        return None

    cleaned_compact = v202_compact_label(cleaned)
    best_rule = None
    best_match_length = -1

    for rule in V202_KNOWN_LABEL_RULES:
        for matched in rule["matches"]:
            matched_compact = v202_compact_label(matched)
            remainder = cleaned_compact[len(matched_compact):] if cleaned_compact.startswith(matched_compact) else ""
            allow_prefix_match = bool(remainder) and remainder.startswith(("(", "단위", "직접비", "원"))

            if (
                cleaned_compact == matched_compact
                or allow_prefix_match
            ):
                if len(matched_compact) > best_match_length:
                    best_rule = rule
                    best_match_length = len(matched_compact)

    if not best_rule:
        return None

    return {
        "original_label": cleaned,
        "canonical_label": best_rule["canonical"],
        "field_type": best_rule["field_type"],
    }


def v202_looks_like_datetime(value: str) -> bool:
    return bool(re.search(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", str(value or "")))


def v202_has_choice_lines(lines: list) -> bool:
    return any(any(getattr(fragment, "kind", "") == "choice" for fragment in getattr(line, "fragments", [])) for line in lines or [])


def v202_is_admin_editable_label_text(text: str) -> bool:
    normalized = re.sub(r"\s+", "", str(text or "")).replace(":", "").replace("：", "").lower()
    return normalized in V202_ADMIN_EDITABLE_LABEL_KEYS


def v202_build_value_marker(label: str, value: str, block: bool = False, standalone: bool = True) -> str:
    tag_name = "div" if block else "span"
    class_name = "template-clone__field-value v202-structured-text editable"

    if not block:
        class_name += " template-clone__field-value--inline"

    attrs = f'class="{class_name}" data-template-value="{v202_escape_attr(label)}"'

    if standalone:
        attrs += (
            ' data-template-edit-scope="editor" data-template-edit-enabled="true" '
            'contenteditable="true" spellcheck="false" data-template-edit-text="true"'
        )

    return f'<{tag_name} {attrs}>{v202_text_to_html(value)}</{tag_name}>'


def v202_build_admin_text_marker(text: str, block: bool = False) -> str:
    tag_name = "div" if block else "span"
    class_name = "template-clone__field-key v202-structured-text"

    if not block:
        class_name += " template-clone__field-key--inline"

    return (
        f'<{tag_name} class="{class_name}" data-template-edit-scope="admin" '
        f'data-template-edit-enabled="false" contenteditable="false" spellcheck="false" '
        f'data-template-edit-text="true">'
        f'{v202_text_to_html(text)}'
        f'</{tag_name}>'
    )


def v202_build_inline_editor_row(parts: list[str], extra_classes: list[str] | None = None) -> str:
    rendered = " ".join(part.strip() for part in parts if part and part.strip())

    if not rendered:
        return ""

    classes = ["v202-inline-editor-row", "v202-structured-text", "editable"]

    if extra_classes:
        classes.extend(extra_classes)

    return f'<span class="{" ".join(classes)}">{rendered}</span>'


def v202_build_inline_value_box(label: str, value: str, block: bool = False) -> str:
    return v202_build_value_marker(label, value, block, standalone=True)


def v202_build_inline_label_box(text: str) -> str:
    return v202_build_admin_text_marker(str(text or ""))


def v202_sort_source_words(words: list) -> list:
    return sorted(
        words or [],
        key=lambda word: (
            round(float(getattr(getattr(word, "bbox", None), "y0", 0.0) or 0.0), 2),
            float(getattr(getattr(word, "bbox", None), "x0", 0.0) or 0.0),
        ),
    )


def v202_resolve_words_bbox(words: list):
    valid_words = [word for word in words or [] if getattr(word, "bbox", None) is not None]

    if not valid_words:
        return None

    x0 = min(float(word.bbox.x0) for word in valid_words)
    y0 = min(float(word.bbox.y0) for word in valid_words)
    x1 = max(float(word.bbox.x1) for word in valid_words)
    y1 = max(float(word.bbox.y1) for word in valid_words)
    return SimpleNamespace(x0=x0, y0=y0, x1=x1, y1=y1, width=max(0.0, x1 - x0), height=max(0.0, y1 - y0))


def v202_find_compact_word_range(words: list, label_text: str) -> tuple[int, int] | None:
    compact_target = v202_compact_label(label_text)
    compact_words = [v202_compact_label(getattr(word, "text", "") or "") for word in words or []]

    for start_index in range(len(compact_words)):
        merged = ""

        for end_index in range(start_index, len(compact_words)):
            merged += compact_words[end_index]

            if merged == compact_target:
                return start_index, end_index + 1

            if compact_target and not compact_target.startswith(merged):
                break

    return None


def v202_wrap_positioned_inline_part(inner_html: str, gap_px: float, width_px: float) -> str:
    styles = []

    if gap_px > 0.2:
        styles.append(f"margin-left:{gap_px:.2f}px")

    if width_px > 0.2:
        styles.append(f"min-width:{width_px:.2f}px")

    style_attr = f' style="{"; ".join(styles)};"' if styles else ""
    return f'<span class="v202-inline-positioned-part"{style_attr}>{inner_html}</span>'


def v202_build_document_issue_composite_html(
    label_descriptor: dict,
    value_descriptor: dict,
    scale: float,
    clone_id: str,
) -> str | None:
    if not v202_is_v221_clone(clone_id):
        return None

    known_label = label_descriptor.get("known_label") or {}

    if known_label.get("canonical_label") != "문서번호":
        return None

    cell = value_descriptor["cell"]
    source_words = v202_sort_source_words(getattr(cell, "_source_words", []) or [])

    if not source_words:
        return None

    label_range = v202_find_compact_word_range(source_words, "발급일")

    if not label_range:
        return None

    label_start, label_end = label_range

    if label_start <= 0 or label_end >= len(source_words):
        return None

    document_words = source_words[:label_start]
    issue_label_words = source_words[label_start:label_end]
    issue_value_words = source_words[label_end:]

    if not document_words or not issue_label_words or not issue_value_words:
        return None

    cell_words_bbox = v202_resolve_words_bbox(source_words)
    document_bbox = v202_resolve_words_bbox(document_words)
    issue_label_bbox = v202_resolve_words_bbox(issue_label_words)
    issue_value_bbox = v202_resolve_words_bbox(issue_value_words)

    if not cell_words_bbox or not document_bbox or not issue_label_bbox or not issue_value_bbox:
        return None

    parts = []
    previous_end = float(cell_words_bbox.x0)
    word_groups = [
        (
            v202_build_inline_value_box(
                "문서번호",
                v202_normalize_whitespace(" ".join(getattr(word, "text", "") or "" for word in document_words)),
            ),
            document_bbox,
        ),
        (
            v202_build_inline_label_box(
                " ".join(getattr(word, "text", "") or "" for word in issue_label_words).strip() or "발 급 일"
            ),
            issue_label_bbox,
        ),
        (
            v202_build_inline_value_box(
                "발급일",
                v202_normalize_whitespace(" ".join(getattr(word, "text", "") or "" for word in issue_value_words)),
            ),
            issue_value_bbox,
        ),
    ]

    for inner_html, bbox in word_groups:
        gap_px = max(0.0, (float(bbox.x0) - previous_end) * scale)
        width_px = max(0.0, float(bbox.width) * scale)
        parts.append(v202_wrap_positioned_inline_part(inner_html, gap_px, width_px))
        previous_end = float(bbox.x1)

    return f'<div class="v202-cell-box">{v202_build_inline_editor_row(parts, ["v202-source-inline-row"])}</div>'


def v202_build_inline_composite_html(text: str):
    normalized = v202_normalize_whitespace(text)

    if not normalized:
        return None

    status_match = V202_STATUS_LINE_REGEX.match(normalized)

    if status_match:
        code, actor_value, timestamp_value = status_match.groups()
        actor_label = V202_STATUS_ACTOR_LABEL_MAP.get(code, f"{code} 담당자")
        time_label = V202_STATUS_TIME_LABEL_MAP.get(code, f"{code} 처리시각")
        status_parts = [
            v202_build_inline_label_box(code),
            v202_build_inline_value_box(actor_label, actor_value),
            v202_build_inline_value_box(time_label, timestamp_value),
        ]
        return v202_build_inline_editor_row(status_parts, ["v202-status-line"])

    signature_match = V202_SIGNATURE_LINE_REGEX.match(normalized)

    if signature_match:
        signer_value, status_value, receiver_value = signature_match.groups()
        receiver_text = v202_normalize_whitespace(receiver_value or "")
        return v202_build_inline_editor_row(
            [
                v202_build_inline_label_box("발급자 서명"),
                v202_build_inline_value_box("발급자 서명자", signer_value),
                v202_build_inline_value_box("전자서명 상태", status_value),
                v202_build_inline_label_box("접수자 서명"),
                v202_build_inline_value_box("접수자 서명", receiver_text),
            ]
        )

    segments = [
        {
            "label_text": v202_normalize_whitespace(match.group(1) or ""),
            "value_text": v202_normalize_whitespace(match.group(2) or ""),
        }
        for match in V202_MULTI_FIELD_SEGMENT_REGEX.finditer(normalized)
    ]
    segments = [segment for segment in segments if segment["label_text"] and segment["value_text"]]

    if len(segments) > 1:
        parts = []
        known_segment_count = 0

        for segment in segments:
            known = v202_resolve_known_label(segment["label_text"])

            if not known:
                parts.append(
                    f'{html.escape(segment["label_text"], quote=False)} : '
                    f'{html.escape(segment["value_text"], quote=False)}'
                )
                continue

            known_segment_count += 1
            parts.append(
                v202_build_inline_editor_row(
                    [
                        v202_build_inline_label_box(f'{segment["label_text"]} :'),
                        v202_build_inline_value_box(known["canonical_label"], segment["value_text"]),
                    ]
                )
            )

        if known_segment_count > 0:
            return " ".join(parts)

    inline_match = V202_INLINE_LABEL_REGEX.match(normalized)

    if inline_match:
        label_text, value_text = inline_match.groups()
        known = v202_resolve_known_label(label_text)

        if known:
            return v202_build_inline_editor_row(
                [
                    v202_build_inline_label_box(f'{v202_normalize_whitespace(label_text)} :'),
                    v202_build_inline_value_box(
                        known["canonical_label"],
                        v202_normalize_whitespace(value_text),
                    ),
                ]
            )

    return None


def v202_render_choice_lines(lines: list) -> str:
    rendered_lines = []

    for line in lines or []:
        fragments_html = []

        for fragment in getattr(line, "fragments", []) or []:
            kind = getattr(fragment, "kind", "")

            if kind == "choice":
                checked = "1" if getattr(fragment, "checked", False) else "0"
                aria_checked = "true" if getattr(fragment, "checked", False) else "false"
                fragments_html.append(
                    '<span class="v202-choice-fragment">'
                    f'<button type="button" class="v202-choice-box" data-checked="{checked}" '
                    f'aria-checked="{aria_checked}" role="checkbox"></button>'
                    f'<span class="v202-choice-label editable" contenteditable="true" spellcheck="false" '
                    f'data-template-edit-text="true">{html.escape(getattr(fragment, "text", "") or "", quote=False)}</span>'
                    '</span>'
                )
            else:
                plain_text = getattr(fragment, "text", "") or ""

                if plain_text:
                    fragments_html.append(
                        f'<span>{html.escape(plain_text, quote=False)}</span>'
                    )

        if fragments_html:
            rendered_lines.append(f'<div class="v202-line v202-line--choice">{"".join(fragments_html)}</div>')

    return "".join(rendered_lines)


def v202_render_plain_region(raw_text: str) -> str:
    normalized = str(raw_text or "")
    composite_html = v202_build_inline_composite_html(normalized)

    if composite_html:
        return f'<div class="v202-cell-box">{composite_html}</div>'

    return f'<div class="v202-cell-box">{v202_text_to_html(normalized)}</div>'


def v202_render_value_region(label: str, raw_text: str, block: bool = False) -> str:
    return f'<div class="v202-cell-box">{v202_build_value_marker(label, str(raw_text or ""), block)}</div>'


def v202_build_cell_descriptor(cell) -> dict:
    raw_text = str(getattr(cell, "text", "") or "")
    return {
        "cell": cell,
        "raw_text": raw_text,
        "text": v202_normalize_whitespace(raw_text),
        "known_label": v202_resolve_known_label(raw_text),
        "html": None,
    }


def v202_build_virtual_cell_descriptor(
    source_descriptor: dict,
    col_start: int,
    col_end: int,
    html_fragment: str,
    *,
    align: str | None = None,
    valign: str | None = None,
) -> dict:
    source_cell = source_descriptor["cell"]
    return {
        "cell": SimpleNamespace(
            col_start=max(1, int(col_start)),
            col_end=max(max(1, int(col_start)) + 1, int(col_end)),
            row_start=max(1, int(getattr(source_cell, "row_start", 1) or 1)),
            row_end=max(
                max(1, int(getattr(source_cell, "row_start", 1) or 1)) + 1,
                int(getattr(source_cell, "row_end", 2) or 2),
            ),
            font_pt=float(getattr(source_cell, "font_pt", 11.0) or 11.0),
            bold=bool(getattr(source_cell, "bold", False)),
            align=(align or getattr(source_cell, "align", "left") or "left"),
            valign=(valign or getattr(source_cell, "valign", "top") or "top"),
        ),
        "raw_text": "",
        "text": "",
        "known_label": None,
        "html": html_fragment,
    }


def v202_resolve_document_issue_virtual_descriptors(
    label_descriptor: dict,
    value_descriptor: dict,
) -> list[dict] | None:
    known_label = label_descriptor.get("known_label") or {}

    if known_label.get("canonical_label") != "문서번호":
        return None

    value_cell = value_descriptor["cell"]
    span = max(1, int(value_cell.col_end) - int(value_cell.col_start))
    normalized_text = v202_normalize_whitespace(value_descriptor.get("raw_text", "") or "")
    has_issue_slot = span >= 3

    if not has_issue_slot:
        return None

    document_number = normalized_text
    issue_date = ""
    match = re.match(r"^(.*?)\s*발\s*급\s*일\s*(\d{4}-\d{2}-\d{2})?$", normalized_text)

    if match:
        document_number = v202_normalize_whitespace(match.group(1) or "")
        issue_date = v202_normalize_whitespace(match.group(2) or "")

    col_start = int(value_cell.col_start)
    col_end = int(value_cell.col_end)
    value_span = max(1, span - 2)
    value_end = min(col_end - 2, col_start + value_span)

    if value_end <= col_start:
        value_end = min(col_end - 2, col_start + 1)

    issue_label_start = value_end
    issue_label_end = min(col_end, issue_label_start + 1)
    issue_value_start = issue_label_end

    if issue_value_start >= col_end:
        issue_value_start = max(issue_label_start + 1, col_end - 1)
        issue_label_end = issue_value_start

    if issue_label_start >= issue_label_end or issue_value_start >= col_end:
        return None

    return [
        v202_build_virtual_cell_descriptor(
            value_descriptor,
            col_start,
            value_end,
            (
                '<div class="v202-cell-box">'
                f'{v202_build_value_marker("문서번호", document_number, block=True)}'
                '</div>'
            ),
        ),
        v202_build_virtual_cell_descriptor(
            value_descriptor,
            issue_label_start,
            issue_label_end,
            (
                '<div class="v202-cell-box">'
                f'{v202_build_admin_text_marker("발 급 일", block=True)}'
                '</div>'
            ),
        ),
        v202_build_virtual_cell_descriptor(
            value_descriptor,
            issue_value_start,
            col_end,
            (
                '<div class="v202-cell-box">'
                f'{v202_build_value_marker("발급일", issue_date, block=True)}'
                '</div>'
            ),
        ),
    ]


def v202_render_plain_cell_html(cell, allow_composite: bool = True, admin_scope: bool = False) -> str:
    lines = getattr(cell, "lines", []) or []
    raw_text = getattr(cell, "text", "") or ""
    normalized = v202_normalize_whitespace(raw_text)

    if v202_has_choice_lines(lines):
        return f'<div class="v202-cell-box">{v202_render_choice_lines(lines)}</div>'

    if "신규" in normalized and "재발급" in normalized:
        option_rows = [
            '<div class="v202-line v202-line--choice">'
            '<span class="v202-choice-fragment"><button type="button" class="v202-choice-box" data-checked="1" aria-checked="true" role="checkbox"></button><span>신규</span></span>'
            '<span class="v202-choice-fragment"><button type="button" class="v202-choice-box" data-checked="0" aria-checked="false" role="checkbox"></button><span>재발급</span></span>'
            '</div>'
        ]

        if "Off-Line등록" in normalized:
            option_rows.append(
                '<div class="v202-line v202-line--choice">'
                '<span class="v202-choice-fragment"><button type="button" class="v202-choice-box" data-checked="0" aria-checked="false" role="checkbox"></button><span>Off-Line등록</span></span>'
                '</div>'
            )

        return f'<div class="v202-cell-box">{"".join(option_rows)}</div>'

    if admin_scope or v202_is_admin_editable_label_text(raw_text):
        admin_block = "\n" in raw_text
        return f'<div class="v202-cell-box">{v202_build_admin_text_marker(raw_text, admin_block)}</div>'

    if allow_composite:
        return v202_render_plain_region(raw_text)

    return f'<div class="v202-cell-box">{v202_text_to_html(raw_text)}</div>'


def v202_render_value_cell_html(
    label: str,
    cell,
    force_block: bool = False,
    clone_id: str = "pdf-raster-first-v2.05",
) -> str:
    raw_text = str(getattr(cell, "text", "") or "")
    normalized_text = v202_normalize_whitespace(raw_text)

    if label == "문서번호":
        issue_date_match = re.match(r"^(.*?)\s*발\s*급\s*일\s*(\d{4}-\d{2}-\d{2})$", normalized_text)

        if issue_date_match:
            document_number, issue_date = issue_date_match.groups()
            return (
                '<div class="v202-cell-box">'
                + v202_build_inline_editor_row(
                    [
                        v202_build_inline_value_box("문서번호", document_number),
                        v202_build_inline_label_box("발 급 일"),
                        v202_build_inline_value_box("발급일", issue_date),
                    ]
                )
                +
                '</div>'
            )

    if label == "발급자 서명자" and "전자서명" in normalized_text:
        compact_text = normalized_text.replace(" ", "")
        status_match = re.match(r"^(.*?)(전자서명(?:완료|대기|실패|미완료))(?:접수자서명(.*))?$", compact_text)

        if status_match:
            signer_value, status_value, receiver_value = status_match.groups()
            return (
                '<div class="v202-cell-box">'
                + v202_build_inline_editor_row(
                    [
                        v202_build_inline_value_box("발급자 서명자", signer_value),
                        v202_build_inline_value_box("전자서명 상태", status_value),
                        v202_build_inline_label_box("접수자서명"),
                        v202_build_inline_value_box("접수자 서명", receiver_value or ""),
                    ]
                )
                +
                '</div>'
            )

    should_render_block = (
        force_block
        or v202_is_v22_clone(clone_id)
        or not normalized_text
        or "\n" in raw_text
        or len(normalized_text) > 36
        or v202_looks_like_datetime(normalized_text)
    )
    return v202_render_value_region(label, raw_text, should_render_block)


def v202_resolve_cell_padding(cell, scale: float, default_pad_x: float, default_pad_y: float, clone_id: str) -> tuple[float, float, float, float]:
    default_padding = (default_pad_y, default_pad_x, default_pad_y, default_pad_x)

    if not v202_is_v22_clone(clone_id):
        return default_padding

    rect = getattr(cell, "rect", None) or getattr(cell, "bbox", None)
    source_words = v202_sort_source_words(getattr(cell, "_source_words", []) or [])
    words_bbox = v202_resolve_words_bbox(source_words)

    if rect is None or words_bbox is None:
        return default_padding

    max_horizontal_padding = max(default_pad_x * 3.0, float(getattr(rect, "width", 0.0) or 0.0) * scale * 0.35)
    max_vertical_padding = max(default_pad_y * 3.0, float(getattr(rect, "height", 0.0) or 0.0) * scale * 0.40)
    top = clamp((float(words_bbox.y0) - float(rect.y0)) * scale, 0.0, max_vertical_padding)
    right = clamp((float(rect.x1) - float(words_bbox.x1)) * scale, 0.0, max_horizontal_padding)
    bottom = clamp((float(rect.y1) - float(words_bbox.y1)) * scale, 0.0, max_vertical_padding)
    left = clamp((float(words_bbox.x0) - float(rect.x0)) * scale, 0.0, max_horizontal_padding)
    return (top, right, bottom, left)


def v202_build_cell_border_style(
    col_start: int,
    col_end: int,
    row_start: int,
    row_end: int,
    total_columns: int,
    total_rows: int,
    clone_id: str,
) -> str:
    return ""


def v202_normalize_frame_outline_style(value: str | None, default: str = "solid") -> str:
    normalized = str(value or "").strip().lower()

    if normalized == "dashed":
        return "dashed"

    if normalized == "solid":
        return "solid"

    return default


def v202_resolve_frame_outline_style(cell, default: str = "solid") -> str:
    return v202_normalize_frame_outline_style(getattr(cell, "_frame_outline_style", ""), default)


def v22_wrap_cell_html(inner_html: str, clone_id: str) -> str:
    if not v202_is_v22_clone(clone_id) or not inner_html:
        return inner_html

    return f'<div class="v22-html-shell">{inner_html}</div>'


def v202_resolve_frame_group_parts(cell) -> tuple[str, str, str, str, str]:
    row_start = int(getattr(cell, "row_start", 1) or 1)
    row_end = int(getattr(cell, "row_end", row_start + 1) or (row_start + 1))
    col_start = int(getattr(cell, "col_start", 1) or 1)
    col_end = int(getattr(cell, "col_end", col_start + 1) or (col_start + 1))
    frame_group_id = str(getattr(cell, "_frame_group_id", "") or "").strip()
    frame_color_group = str(getattr(cell, "_frame_color_group", "") or "").strip()
    frame_value_key = str(getattr(cell, "_frame_value_key", "") or "").strip()
    frame_source_text = str(getattr(cell, "_frame_source_text", "") or "").strip()
    frame_role = str(getattr(cell, "_frame_role", "") or "").strip()
    frame_parent_group = str(getattr(cell, "_frame_parent_group", "") or "").strip()
    frame_chain_key = str(getattr(cell, "_frame_chain_key", "") or "").strip()
    frame_chain_depth = str(getattr(cell, "_frame_chain_depth", "") or "").strip()
    frame_outline_style = v202_resolve_frame_outline_style(cell)
    align = str(getattr(cell, "align", "left") or "left").strip().lower()
    valign = str(getattr(cell, "valign", "top") or "top").strip().lower()

    if not frame_group_id:
        frame_group_id = f"r{row_start}-r{row_end - 1}-c{col_start}-c{col_end - 1}"
    if not frame_color_group:
        frame_color_group = frame_group_id

    value_key_attr = f' data-template-frame-value-key="{v202_escape_attr(frame_value_key)}" ' if frame_value_key else ""
    source_text_attr = f' data-template-frame-source-text="{v202_escape_attr(frame_source_text)}" ' if frame_source_text else ""
    role_attr = f' data-template-frame-role="{v202_escape_attr(frame_role)}" ' if frame_role else ""
    parent_group_attr = f' data-template-frame-parent-group="{v202_escape_attr(frame_parent_group)}" ' if frame_parent_group else ""
    chain_key_attr = f' data-template-frame-chain-key="{v202_escape_attr(frame_chain_key)}" ' if frame_chain_key else ""
    chain_depth_attr = f' data-template-frame-chain-depth="{v202_escape_attr(frame_chain_depth)}" ' if frame_chain_depth else ""
    outline_style_attr = f' data-template-frame-outline-style="{v202_escape_attr(frame_outline_style)}" ' if frame_outline_style else ""

    container_attrs = (
        f'data-template-frame-group="{frame_group_id}" '
        f'data-template-frame-color-group="{v202_escape_attr(frame_color_group)}" '
        f'{value_key_attr}'
        f'{source_text_attr}'
        f'{role_attr}'
        f'{parent_group_attr}'
        f'{chain_key_attr}'
        f'{chain_depth_attr}'
        f'{outline_style_attr}'
        f'data-template-frame-row-start="{row_start}" '
        f'data-template-frame-row-end="{row_end}" '
        f'data-template-frame-col-start="{col_start}" '
        f'data-template-frame-col-end="{col_end}" '
        f'data-template-frame-halign="{v202_escape_attr(align)}" '
        f'data-template-frame-valign="{v202_escape_attr(valign)}"'
    )

    input_html = (
        f'<textarea class="v202-frame-group-input" spellcheck="false" readonly tabindex="-1" '
        f'data-template-frame-input="true" '
        f'data-template-frame-group="{frame_group_id}" '
        f'data-template-frame-color-group="{v202_escape_attr(frame_color_group)}" '
        f'{value_key_attr}'
        f'{source_text_attr}'
        f'{role_attr}'
        f'{parent_group_attr}'
        f'{chain_key_attr}'
        f'{chain_depth_attr}'
        f'{outline_style_attr}'
        f'data-template-frame-halign="{v202_escape_attr(align)}" '
        f'data-template-frame-valign="{v202_escape_attr(valign)}"></textarea>'
    )

    return frame_group_id, frame_color_group, container_attrs, input_html, align


def v202_build_frame_group_html(cell) -> str:
    _, _, _, input_html, _ = v202_resolve_frame_group_parts(cell)
    return input_html


def v202_build_frame_group_td_open_tag(
    cell,
    class_name: str,
    style_attr: str,
    span_attr: str = "",
) -> str:
    _, _, container_attrs, _, _ = v202_resolve_frame_group_parts(cell)
    normalized_class = " ".join(part for part in [class_name.strip(), "v202-frame-group"] if part).strip()
    span_fragment = f"{span_attr} " if span_attr else ""
    return f'<td class="{normalized_class}" {span_fragment}{container_attrs} style="{style_attr}">'


V102_ROW_COLOR_PALETTE = [
    "rgba(59, 130, 246, 0.10)",
    "rgba(16, 185, 129, 0.10)",
    "rgba(245, 158, 11, 0.10)",
    "rgba(236, 72, 153, 0.10)",
]

V102_COL_COLOR_PALETTE = [
    "rgba(14, 165, 233, 0.18)",
    "rgba(245, 158, 11, 0.18)",
    "rgba(217, 70, 239, 0.18)",
    "rgba(34, 197, 94, 0.18)",
    "rgba(239, 68, 68, 0.18)",
    "rgba(99, 102, 241, 0.18)",
]


def v102_pick_palette_color(colors: list[str], index: int) -> str:
    if not colors:
        return "rgba(148, 163, 184, 0.12)"

    return colors[index % len(colors)]


def v102_make_bbox(x0: float, y0: float, x1: float, y1: float):
    return SimpleNamespace(
        x0=float(x0),
        y0=float(y0),
        x1=float(x1),
        y1=float(y1),
        width=max(0.0, float(x1) - float(x0)),
        height=max(0.0, float(y1) - float(y0)),
    )


def v102_build_virtual_frame_cell(
    source_cell,
    x0: float,
    x1: float,
    local_index: int,
    frame_group_id: str,
    frame_color_group: str | None = None,
):
    source_bbox = getattr(source_cell, "bbox", None)

    if source_bbox is None:
        return None

    bbox = v102_make_bbox(x0, float(source_bbox.y0), x1, float(source_bbox.y1))
    return SimpleNamespace(
        row_start=int(getattr(source_cell, "row_start", 1) or 1),
        row_end=int(getattr(source_cell, "row_end", 2) or 2),
        col_start=local_index,
        col_end=local_index + 1,
        bbox=bbox,
        font_pt=float(getattr(source_cell, "font_pt", 11.0) or 11.0),
        bold=bool(getattr(source_cell, "bold", False)),
        align=getattr(source_cell, "align", "left") or "left",
        valign=getattr(source_cell, "valign", "top") or "top",
        _frame_group_id=frame_group_id,
        _frame_color_group=str(frame_color_group or frame_group_id),
        _frame_source_text=str(getattr(source_cell, "text", "") or "").strip(),
        _frame_outline_style="dashed",
    )


def v102_apply_virtual_frame_cell_semantics(
    cell,
    *,
    source_text: str | None = None,
    value_key: str | None = None,
    role: str | None = None,
    chain_key: str | None = None,
    chain_depth: int | None = None,
):
    if cell is None:
        return None

    if source_text is not None:
        setattr(cell, "_frame_source_text", str(source_text))

    if value_key is not None:
        setattr(cell, "_frame_value_key", str(value_key))

    if role is not None:
        setattr(cell, "_frame_role", str(role))

    if chain_key is not None:
        setattr(cell, "_frame_chain_key", str(chain_key))

    if chain_depth is not None:
        setattr(cell, "_frame_chain_depth", str(int(chain_depth)))

    return cell


def v102_build_frame_cell_spec(
    cell,
    local_index: int,
    frame_group_id: str,
    frame_color_group: str | None = None,
    frame_outline_style: str | None = None,
) -> dict | None:
    bbox = getattr(cell, "bbox", None)

    if bbox is None:
        return None

    resolved_outline_style = str(frame_outline_style or getattr(cell, "_frame_outline_style", "") or "").strip().lower()

    if resolved_outline_style not in {"solid", "dashed"}:
        table = getattr(cell, "_frame_table", None)

        if table is not None:
            resolved_outline_style = v105_resolve_frame_outline_style(
                table,
                float(bbox.x0),
                float(bbox.y0),
                float(bbox.x1),
                float(bbox.y1),
            )

    resolved_outline_style = v202_normalize_frame_outline_style(resolved_outline_style, "solid")
    cell_like = SimpleNamespace(
        row_start=int(getattr(cell, "row_start", 1) or 1),
        row_end=int(getattr(cell, "row_end", 2) or 2),
        col_start=local_index,
        col_end=local_index + 1,
        bbox=bbox,
        font_pt=float(getattr(cell, "font_pt", 11.0) or 11.0),
        bold=bool(getattr(cell, "bold", False)),
        align=getattr(cell, "align", "left") or "left",
        valign=getattr(cell, "valign", "top") or "top",
        _frame_group_id=frame_group_id,
        _frame_color_group=str(frame_color_group or frame_group_id),
        _frame_source_text=str(getattr(cell, "text", "") or "").strip(),
        _frame_outline_style=resolved_outline_style,
    )
    return {
        "cell": cell_like,
        "x0": float(bbox.x0),
        "x1": float(bbox.x1),
        "y0": float(bbox.y0),
        "y1": float(bbox.y1),
        "color_group": str(frame_color_group or frame_group_id),
        "outline_style": resolved_outline_style,
    }


def v102_find_row_label_cell(row_cells: list, canonical_label: str):
    for cell in row_cells:
        known_label = v202_resolve_known_label(getattr(cell, "text", "") or "")

        if known_label and known_label.get("canonical_label") == canonical_label:
            return cell

    return None


def v102_estimate_inline_cell_padding(source_bbox, source_words: list) -> float:
    if source_bbox is None or not source_words:
        return 6.0

    first_bbox = getattr(source_words[0], "bbox", None) or getattr(source_words[0], "rect", None)

    if first_bbox is None:
        return 6.0

    return clamp(float(first_bbox.x0) - float(source_bbox.x0), 4.0, 14.0)


def v102_build_document_issue_frame_specs(
    row_cells: list,
    band_index: int,
    frame_group_version: str = "v1.08",
) -> list[dict] | None:
    sorted_cells = sorted(row_cells, key=lambda item: (item.col_start, item.col_end))
    neutral_mode = is_profile_frame_group_version(frame_group_version)

    if len(sorted_cells) < 4:
        return None

    label_cell = sorted_cells[0]
    composite_cell = sorted_cells[1]
    source_words = v202_sort_source_words(getattr(composite_cell, "_source_words", []) or [])
    label_range = v202_find_compact_word_range(source_words, "발급일")

    if not source_words or not label_range:
        return None

    label_start, label_end = label_range

    if label_start <= 0 or label_end >= len(source_words):
        return None

    document_text = v202_normalize_whitespace(" ".join(getattr(word, "text", "") or "" for word in source_words[:label_start]))
    issue_label_text = " ".join(getattr(word, "text", "") or "" for word in source_words[label_start:label_end]).strip() or "발 급 일"
    issue_value_text = v202_normalize_whitespace(" ".join(getattr(word, "text", "") or "" for word in source_words[label_end:]))
    document_bbox = v202_resolve_words_bbox(source_words[:label_start])
    issue_label_bbox = v202_resolve_words_bbox(source_words[label_start:label_end])
    issue_value_bbox = v202_resolve_words_bbox(source_words[label_end:])
    source_bbox = getattr(composite_cell, "bbox", None)

    if not document_bbox or not issue_label_bbox or not issue_value_bbox or source_bbox is None:
        return None

    inferred_pad = v102_estimate_inline_cell_padding(source_bbox, source_words)
    boundary_one = max(
        float(document_bbox.x1) + 1.0,
        min(float(issue_label_bbox.x0) - 1.0, float(issue_label_bbox.x0) - inferred_pad),
    )
    boundary_two = max(
        boundary_one + 1.0,
        min(float(source_bbox.x1) - 1.0, float(issue_value_bbox.x0) - inferred_pad),
    )

    def build_virtual_spec(
        x0: float,
        x1: float,
        local_index: int,
        semantic_suffix: str,
        semantic_color_group: str,
        source_text: str,
        *,
        value_key: str | None = None,
        role: str | None = None,
        chain_key: str | None = None,
        chain_depth: int | None = None,
    ) -> dict | None:
        frame_group_id = (
            f"band-{band_index}-cell-{local_index}"
            if neutral_mode
            else f"band-{band_index}-{semantic_suffix}"
        )
        frame_color_group = frame_group_id if neutral_mode else semantic_color_group
        virtual_cell = v102_build_virtual_frame_cell(
            composite_cell,
            x0,
            x1,
            local_index,
            frame_group_id,
            frame_color_group,
        )

        if virtual_cell is None:
            return None

        setattr(virtual_cell, "_frame_source_text", source_text)

        if not neutral_mode:
            v102_apply_virtual_frame_cell_semantics(
                virtual_cell,
                value_key=value_key,
                role=role,
                chain_key=chain_key,
                chain_depth=chain_depth,
            )

        return {
            "cell": virtual_cell,
            "x0": float(virtual_cell.bbox.x0),
            "x1": float(virtual_cell.bbox.x1),
            "y0": float(virtual_cell.bbox.y0),
            "y1": float(virtual_cell.bbox.y1),
            "color_group": str(getattr(virtual_cell, "_frame_color_group", "") or getattr(virtual_cell, "_frame_group_id", "")),
        }

    virtual_specs = [
        build_virtual_spec(
            float(source_bbox.x0),
            boundary_one,
            2,
            "document-number",
            "document-number",
            document_text,
            value_key="문서번호",
            role="value",
            chain_key="문서번호",
            chain_depth=1,
        ),
        build_virtual_spec(
            boundary_one,
            boundary_two,
            3,
            "issue-date-label",
            "issue-date",
            issue_label_text,
            value_key="발급일",
            role="key",
            chain_key="발급일",
            chain_depth=0,
        ),
        build_virtual_spec(
            boundary_two,
            float(source_bbox.x1),
            4,
            "issue-date-value",
            "issue-date",
            issue_value_text,
            value_key="발급일",
            role="value",
            chain_key="발급일",
            chain_depth=1,
        ),
    ]

    label_group_id = f"band-{band_index}-cell-1" if neutral_mode else f"band-{band_index}-document-label"
    label_color_group = label_group_id if neutral_mode else "document-number"
    partner_label_group_id = f"band-{band_index}-cell-5" if neutral_mode else f"band-{band_index}-partner-approval-label"
    partner_label_color_group = partner_label_group_id if neutral_mode else "partner-approval"
    partner_value_group_id = f"band-{band_index}-cell-6" if neutral_mode else f"band-{band_index}-partner-approval-value"
    partner_value_color_group = partner_value_group_id if neutral_mode else "partner-approval"

    partner_approval_value_spec = v102_build_frame_cell_spec(
        sorted_cells[3],
        6,
        partner_value_group_id,
        partner_value_color_group,
    )

    if partner_approval_value_spec is not None:
        setattr(partner_approval_value_spec.get("cell"), "_frame_source_text", "")

        if not neutral_mode:
            v102_apply_virtual_frame_cell_semantics(
                partner_approval_value_spec.get("cell"),
                value_key="협력사승인일",
                role="value",
                chain_key="협력사승인일",
                chain_depth=1,
            )

    specs = [
        v102_build_frame_cell_spec(label_cell, 1, label_group_id, label_color_group),
        *[spec for spec in virtual_specs if spec is not None],
        v102_build_frame_cell_spec(sorted_cells[2], 5, partner_label_group_id, partner_label_color_group),
        partner_approval_value_spec,
    ]

    return [spec for spec in specs if spec is not None]


def v102_build_signature_frame_specs(
    row_cells: list,
    band_index: int,
    frame_group_version: str = "v1.08",
) -> list[dict] | None:
    sorted_cells = sorted(row_cells, key=lambda item: (item.col_start, item.col_end))
    neutral_mode = is_profile_frame_group_version(frame_group_version)

    if len(sorted_cells) < 2:
        return None

    label_cell = sorted_cells[0]
    value_cell = sorted_cells[1]
    source_words = v202_sort_source_words(getattr(value_cell, "_source_words", []) or [])
    label_range = v202_find_compact_word_range(source_words, "접수자서명")

    if not source_words or not label_range:
        return None

    label_start, label_end = label_range

    if label_start <= 0:
        return None

    issuer_value_text = v202_normalize_whitespace(" ".join(getattr(word, "text", "") or "" for word in source_words[:label_start]))
    receiver_label_text = " ".join(getattr(word, "text", "") or "" for word in source_words[label_start:label_end]).strip() or "접수자 서명"
    receiver_value_text = v202_normalize_whitespace(" ".join(getattr(word, "text", "") or "" for word in source_words[label_end:]))
    signer_bbox = v202_resolve_words_bbox(source_words[:1])
    status_bbox = v202_resolve_words_bbox(source_words[1:label_start])
    receiver_label_bbox = v202_resolve_words_bbox(source_words[label_start:label_end])
    source_bbox = getattr(value_cell, "bbox", None)

    if not signer_bbox or not status_bbox or not receiver_label_bbox or source_bbox is None:
        return None

    left = float(source_bbox.x0)
    right = float(source_bbox.x1)
    total_width = max(1.0, right - left)
    signer_end = max(left + 1.0, (float(signer_bbox.x1) + float(status_bbox.x0)) * 0.5)
    inferred_pad = v102_estimate_inline_cell_padding(source_bbox, source_words)
    status_end = max(
        signer_end + 1.0,
        min(right - 1.0, float(receiver_label_bbox.x0) - inferred_pad),
    )
    receiver_value_min_width = max(42.0, total_width * 0.18)
    receiver_label_end = min(
        right - receiver_value_min_width,
        max(status_end + 18.0, float(receiver_label_bbox.x1) + max(10.0, total_width * 0.02)),
    )

    if receiver_label_end >= right:
        receiver_label_end = right - max(18.0, receiver_value_min_width * 0.5)

    def build_virtual_spec(
        x0: float,
        x1: float,
        local_index: int,
        semantic_suffix: str,
        semantic_color_group: str,
        source_text: str,
        *,
        value_key: str | None = None,
        role: str | None = None,
        chain_key: str | None = None,
        chain_depth: int | None = None,
    ) -> dict | None:
        frame_group_id = (
            f"band-{band_index}-cell-{local_index}"
            if neutral_mode
            else f"band-{band_index}-{semantic_suffix}"
        )
        frame_color_group = frame_group_id if neutral_mode else semantic_color_group
        virtual_cell = v102_build_virtual_frame_cell(
            value_cell,
            x0,
            x1,
            local_index,
            frame_group_id,
            frame_color_group,
        )

        if virtual_cell is None:
            return None

        setattr(virtual_cell, "_frame_source_text", source_text)

        if not neutral_mode:
            v102_apply_virtual_frame_cell_semantics(
                virtual_cell,
                value_key=value_key,
                role=role,
                chain_key=chain_key,
                chain_depth=chain_depth,
            )

        return {
            "cell": virtual_cell,
            "x0": float(virtual_cell.bbox.x0),
            "x1": float(virtual_cell.bbox.x1),
            "y0": float(virtual_cell.bbox.y0),
            "y1": float(virtual_cell.bbox.y1),
            "color_group": str(getattr(virtual_cell, "_frame_color_group", "") or getattr(virtual_cell, "_frame_group_id", "")),
        }

    virtual_specs = [
        build_virtual_spec(
            left,
            status_end,
            2,
            "issuer-sign-value",
            "issuer-sign",
            issuer_value_text,
            value_key="발급자 서명자",
            role="value",
            chain_key="발급자 서명자",
            chain_depth=1,
        ),
        build_virtual_spec(
            status_end,
            receiver_label_end,
            3,
            "receiver-sign-label",
            "receiver-sign",
            receiver_label_text,
            value_key="접수자 서명",
            role="key",
            chain_key="접수자 서명",
            chain_depth=0,
        ),
        build_virtual_spec(
            receiver_label_end,
            right,
            4,
            "receiver-sign-value",
            "receiver-sign",
            receiver_value_text,
            value_key="접수자 서명",
            role="value",
            chain_key="접수자 서명",
            chain_depth=1,
        ),
    ]

    label_group_id = f"band-{band_index}-cell-1" if neutral_mode else f"band-{band_index}-issuer-sign-label"
    label_color_group = label_group_id if neutral_mode else "issuer-sign"

    specs = [
        v102_build_frame_cell_spec(label_cell, 1, label_group_id, label_color_group),
        *[spec for spec in virtual_specs if spec is not None],
    ]

    return [spec for spec in specs if spec is not None]


def v102_resolve_row_frame_specs(
    row_cells: list,
    band_index: int,
    frame_group_version: str = "v1.08",
) -> list[dict]:
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)

    if normalized_frame_group_version in ("v1.07", "v1.08", "v1.09", "v1.10", "v1.11"):
        document_issue_specs = None

        if v102_find_row_label_cell(row_cells, "문서번호") is not None:
            document_issue_specs = v102_build_document_issue_frame_specs(row_cells, band_index, frame_group_version)

        if document_issue_specs:
            if normalized_frame_group_version not in ("v1.09", "v1.10", "v1.11"):
                v106_apply_frame_spec_semantics(document_issue_specs)
            return document_issue_specs

        signature_specs = None

        if v102_find_row_label_cell(row_cells, "발급자 서명자") is not None:
            signature_specs = v102_build_signature_frame_specs(row_cells, band_index, frame_group_version)

        if signature_specs:
            if normalized_frame_group_version not in ("v1.09", "v1.10", "v1.11"):
                v106_apply_frame_spec_semantics(signature_specs)
            return signature_specs

    specs = []
    active_color_group = None

    for local_index, cell in enumerate(sorted(row_cells, key=lambda item: (item.col_start, item.col_end)), start=1):
        if normalized_frame_group_version in ("v1.09", "v1.10", "v1.11"):
            color_group = f"band-{band_index}-cell-{local_index}"
        else:
            known_label = v202_resolve_known_label(getattr(cell, "text", "") or "")

            if known_label is not None:
                active_color_group = str(known_label.get("canonical_label") or f"band-{band_index}-pair-{local_index}")
                color_group = active_color_group
            else:
                color_group = active_color_group or f"band-{band_index}-cell-{local_index}"
                active_color_group = None

        spec = v102_build_frame_cell_spec(
            cell,
            local_index,
            f"band-{band_index}-cell-{local_index}",
            color_group,
        )

        if spec is not None:
            specs.append(spec)

    if normalized_frame_group_version in ("v1.06", "v1.07", "v1.08"):
        v106_apply_frame_spec_semantics(specs)

    return specs


def v102_build_frame_band_markup(
    frame_specs: list[dict],
    scale: float,
    band_index: int,
    *,
    frame_group_version: str = "v1.08",
    left: float | None = None,
    top: float | None = None,
    right: float | None = None,
    bottom: float | None = None,
) -> str:
    if not frame_specs:
        return ""

    sorted_specs = sorted(frame_specs, key=lambda item: (item["x0"], item["x1"]))
    band_left = min(float(item["x0"]) for item in sorted_specs) if left is None else float(left)
    band_top = min(float(item["y0"]) for item in sorted_specs) if top is None else float(top)
    band_right = max(float(item["x1"]) for item in sorted_specs) if right is None else float(right)
    band_bottom = max(float(item["y1"]) for item in sorted_specs) if bottom is None else float(bottom)
    band_width = max(1.0, band_right - band_left)
    band_height = max(1.0, band_bottom - band_top)
    row_color = v102_pick_palette_color(V102_ROW_COLOR_PALETTE, band_index)
    band_outline_style = v102_resolve_band_outline_style(sorted_specs, frame_group_version)
    band_border_color = "rgba(15, 23, 42, 0.34)" if band_outline_style == "dashed" else "rgba(15, 23, 42, 0.55)"
    band_border_css = f" border:1px {band_outline_style} {band_border_color};" if band_outline_style == "dashed" else ""
    colgroup_html = "".join(
        f'<col style="width:{max(0.5, ((float(item["x1"]) - float(item["x0"])) / band_width) * 100.0):.6f}%">'
        for item in sorted_specs
    )
    cells_html = []
    color_group_indexes = v102_resolve_color_group_indexes(sorted_specs)

    for cell_index, item in enumerate(sorted_specs):
        cell = item["cell"]
        font_px = clamp(float(getattr(cell, "font_pt", 11.0) or 11.0) * scale, 10.5, 18.0)
        font_weight = 700 if getattr(cell, "bold", False) else 400
        color_group = str(item.get("color_group") or getattr(cell, "_frame_color_group", "") or getattr(cell, "_frame_group_id", "") or "")
        color_index = color_group_indexes.get(color_group, cell_index)
        col_color = v102_pick_palette_color(V102_COL_COLOR_PALETTE, color_index)
        border_style = ""

        if cell_index > 0:
            border_style += f" border-left:1px {band_outline_style} {band_border_color};"

        cells_html.append(
            f'{v202_build_frame_group_td_open_tag(cell, "halign-left valign-top", f"font-size:{font_px:.2f}px; font-weight:{font_weight}; --v102-row-color:{row_color}; --v102-col-color:{col_color};{border_style}")}'
            f'{v202_build_frame_group_html(cell)}'
            '</td>'
        )

    return (
        f'<div class="v102-frame-band" style="left:{band_left * scale:.2f}px; top:{band_top * scale:.2f}px; '
        f'width:{band_width * scale:.2f}px; min-height:{band_height * scale:.2f}px;">'
        f'<table class="v202-table-block v102-frame-band-table" style="width:100%; min-height:{band_height * scale:.2f}px;{band_border_css}">'
        f'<colgroup>{colgroup_html}</colgroup>'
        f'<tbody style="--v102-row-color:{row_color};">'
        f'<tr style="height:{band_height * scale:.2f}px;">{"".join(cells_html)}</tr>'
        '</tbody></table></div>'
    )


def v103_snap_scaled_px(value: float, scale: float) -> int:
    return int(round(float(value) * scale))


def v102_resolve_color_group_indexes(frame_specs: list[dict]) -> dict[str, int]:
    color_group_indexes = {}

    for item in frame_specs:
        color_group = str(item.get("color_group") or getattr(item.get("cell"), "_frame_color_group", "") or getattr(item.get("cell"), "_frame_group_id", "") or "")

        if not color_group:
            continue

        if color_group not in color_group_indexes:
            color_group_indexes[color_group] = len(color_group_indexes)

    return color_group_indexes


def v102_resolve_band_outline_style(frame_specs: list[dict], frame_group_version: str = "v1.08") -> str:
    if normalize_frame_group_version(frame_group_version) not in ("v1.10", "v1.11"):
        return "solid"

    outline_styles = [
        v202_normalize_frame_outline_style(
            str(item.get("outline_style") or getattr(item.get("cell"), "_frame_outline_style", "") or ""),
            "solid",
        )
        for item in frame_specs
        if item is not None
    ]

    if outline_styles and all(style == "dashed" for style in outline_styles):
        return "dashed"

    return "solid"


def v103_build_frame_band_markup(
    frame_specs: list[dict],
    scale: float,
    band_index: int,
    *,
    frame_group_version: str = "v1.08",
    left: float | None = None,
    top: float | None = None,
    right: float | None = None,
    bottom: float | None = None,
) -> str:
    if not frame_specs:
        return ""

    sorted_specs = sorted(frame_specs, key=lambda item: (item["x0"], item["x1"]))
    band_left = min(float(item["x0"]) for item in sorted_specs) if left is None else float(left)
    band_top = min(float(item["y0"]) for item in sorted_specs) if top is None else float(top)
    band_right = max(float(item["x1"]) for item in sorted_specs) if right is None else float(right)
    band_bottom = max(float(item["y1"]) for item in sorted_specs) if bottom is None else float(bottom)
    row_color = v102_pick_palette_color(V102_ROW_COLOR_PALETTE, band_index)

    band_left_px = v103_snap_scaled_px(band_left, scale)
    band_top_px = v103_snap_scaled_px(band_top, scale)
    band_right_px = max(band_left_px + 1, v103_snap_scaled_px(band_right, scale))
    band_bottom_px = max(band_top_px + 1, v103_snap_scaled_px(band_bottom, scale))
    band_width_px = band_right_px - band_left_px
    band_height_px = band_bottom_px - band_top_px
    band_outline_style = v102_resolve_band_outline_style(sorted_specs, frame_group_version)
    band_border_color = "rgba(15, 23, 42, 0.34)" if band_outline_style == "dashed" else "rgba(15, 23, 42, 0.55)"
    band_border_css = f" border:1px {band_outline_style} {band_border_color};" if band_outline_style == "dashed" else ""

    col_edges_px = [band_left_px]
    for item in sorted_specs[:-1]:
        col_edges_px.append(v103_snap_scaled_px(float(item["x1"]), scale))
    col_edges_px.append(band_right_px)

    col_widths_px = []
    cursor = band_left_px
    for edge_px in col_edges_px[1:]:
        next_edge_px = max(cursor + 1, min(edge_px, band_right_px))
        col_widths_px.append(next_edge_px - cursor)
        cursor = next_edge_px

    if col_widths_px:
        col_widths_px[-1] += max(0, band_right_px - cursor)

    colgroup_html = "".join(f'<col style="width:{max(1, width_px)}px">' for width_px in col_widths_px)
    cells_html = []
    color_group_indexes = v102_resolve_color_group_indexes(sorted_specs)

    for cell_index, item in enumerate(sorted_specs):
        cell = item["cell"]
        font_px = clamp(float(getattr(cell, "font_pt", 11.0) or 11.0) * scale, 10.5, 18.0)
        font_weight = 700 if getattr(cell, "bold", False) else 400
        color_group = str(item.get("color_group") or getattr(cell, "_frame_color_group", "") or getattr(cell, "_frame_group_id", "") or "")
        color_index = color_group_indexes.get(color_group, cell_index)
        col_color = v102_pick_palette_color(V102_COL_COLOR_PALETTE, color_index)
        border_style = ""

        if cell_index > 0:
            border_style += f" border-left:1px {band_outline_style} {band_border_color};"

        cells_html.append(
            f'{v202_build_frame_group_td_open_tag(cell, "halign-left valign-top", f"font-size:{font_px:.2f}px; font-weight:{font_weight}; --v102-row-color:{row_color}; --v102-col-color:{col_color};{border_style}")}'
            f'{v202_build_frame_group_html(cell)}'
            '</td>'
        )

    return (
        f'<div class="v102-frame-band" style="left:{band_left_px}px; top:{band_top_px}px; '
        f'width:{band_width_px}px; height:{band_height_px}px;">'
        f'<table class="v202-table-block v102-frame-band-table" style="width:{band_width_px}px; height:{band_height_px}px;{band_border_css}">'
        f'<colgroup>{colgroup_html}</colgroup>'
        f'<tbody style="--v102-row-color:{row_color};">'
        f'<tr style="height:{band_height_px}px;">{"".join(cells_html)}</tr>'
        '</tbody></table></div>'
    )


def v105_apply_frame_spec_color_links(frame_specs: list[dict]) -> None:
    if not frame_specs:
        return

    anchor_specs = sorted(
        [
            spec
            for spec in frame_specs
            if int(spec.get("layout_col_start", 1)) == 1
            and int(spec.get("layout_row_end", 1)) - int(spec.get("layout_row_start", 1)) > 1
        ],
        key=lambda item: (
            int(item.get("layout_row_start", 1)),
            int(item.get("layout_col_start", 1)),
            -(
                int(item.get("layout_row_end", 1))
                - int(item.get("layout_row_start", 1))
            ),
        ),
    )

    for anchor in anchor_specs:
        anchor_color_group = str(anchor.get("color_group") or getattr(anchor.get("cell"), "_frame_color_group", "") or "")

        if not anchor_color_group:
            continue

        anchor_row_start = int(anchor.get("layout_row_start", 1))
        anchor_row_end = int(anchor.get("layout_row_end", anchor_row_start + 1))
        anchor_col_end = int(anchor.get("layout_col_end", 2))

        for candidate in frame_specs:
            if candidate is anchor:
                continue

            candidate_row_start = int(candidate.get("layout_row_start", 1))
            candidate_row_end = int(candidate.get("layout_row_end", candidate_row_start + 1))
            candidate_col_start = int(candidate.get("layout_col_start", 1))

            if candidate_col_start < anchor_col_end:
                continue

            if candidate_row_start < anchor_row_start or candidate_row_end > anchor_row_end:
                continue

            candidate["color_group"] = anchor_color_group
            candidate_cell = candidate.get("cell")

            if candidate_cell is not None:
                setattr(candidate_cell, "_frame_color_group", anchor_color_group)


def v106_apply_frame_spec_semantics(frame_specs: list[dict]) -> None:
    if not frame_specs:
        return

    specs_by_id = {}

    for spec in frame_specs:
        cell = spec.get("cell")
        if cell is None:
            continue

        frame_group_id = str(getattr(cell, "_frame_group_id", "") or "")
        source_text = str(getattr(cell, "_frame_source_text", "") or "").strip()
        known_label = v202_resolve_known_label(source_text) if source_text else None
        default_value_key = str(known_label.get("canonical_label") or source_text or frame_group_id) if known_label else str(source_text or frame_group_id)
        role = "key" if known_label else "value"

        setattr(cell, "_frame_value_key", str(getattr(cell, "_frame_value_key", "") or default_value_key))
        setattr(cell, "_frame_role", str(getattr(cell, "_frame_role", "") or role))
        setattr(cell, "_frame_chain_key", str(getattr(cell, "_frame_chain_key", "") or default_value_key))
        setattr(cell, "_frame_chain_depth", str(getattr(cell, "_frame_chain_depth", "") or ("0" if role == "key" else "1")))
        if frame_group_id:
            specs_by_id[frame_group_id] = spec

    anchor_specs = sorted(
        [
            spec
            for spec in frame_specs
            if int(spec.get("layout_col_start", 1)) == 1
            and int(spec.get("layout_row_end", 1)) - int(spec.get("layout_row_start", 1)) > 1
        ],
        key=lambda item: (int(item.get("layout_row_start", 1)), int(item.get("layout_col_start", 1))),
    )

    for anchor in anchor_specs:
        anchor_cell = anchor.get("cell")
        if anchor_cell is None:
            continue

        anchor_group = str(getattr(anchor_cell, "_frame_group_id", "") or "")
        anchor_depth = int(str(getattr(anchor_cell, "_frame_chain_depth", "") or "0") or "0")
        anchor_row_start = int(anchor.get("layout_row_start", 1))
        anchor_row_end = int(anchor.get("layout_row_end", anchor_row_start + 1))
        anchor_col_end = int(anchor.get("layout_col_end", 2))
        setattr(anchor_cell, "_frame_role", "key")
        setattr(anchor_cell, "_frame_chain_depth", str(anchor_depth))

        row_candidates_map: dict[int, list[dict]] = {}

        for candidate in frame_specs:
            if candidate is anchor:
                continue

            candidate_row_start = int(candidate.get("layout_row_start", 1))
            candidate_row_end = int(candidate.get("layout_row_end", candidate_row_start + 1))
            candidate_col_start = int(candidate.get("layout_col_start", 1))

            if candidate_col_start < anchor_col_end:
                continue

            if candidate_row_start < anchor_row_start or candidate_row_end > anchor_row_end:
                continue

            row_candidates_map.setdefault(candidate_row_start, []).append(candidate)

        for row_start, row_candidates in row_candidates_map.items():
            ordered_candidates = sorted(row_candidates, key=lambda item: int(item.get("layout_col_start", 1)))
            first_row_candidate = ordered_candidates[0] if ordered_candidates else None
            row_key_cell = None

            if first_row_candidate is not None and len(ordered_candidates) > 1:
                row_key_cell = first_row_candidate.get("cell")

                if row_key_cell is not None:
                    setattr(row_key_cell, "_frame_role", "key")
                    setattr(row_key_cell, "_frame_parent_group", anchor_group)
                    setattr(row_key_cell, "_frame_chain_depth", str(anchor_depth + 1))

            for candidate in ordered_candidates:
                candidate_cell = candidate.get("cell")

                if candidate_cell is None:
                    continue

                if row_key_cell is not None and candidate_cell is row_key_cell:
                    continue

                current_parent = str(getattr(candidate_cell, "_frame_parent_group", "") or "")

                if not current_parent:
                    setattr(
                        candidate_cell,
                        "_frame_parent_group",
                        str(getattr(row_key_cell, "_frame_group_id", "") or anchor_group) if row_key_cell is not None else anchor_group,
                    )

                if row_key_cell is not None:
                    parent_depth = int(str(getattr(row_key_cell, "_frame_chain_depth", "") or str(anchor_depth + 1)) or str(anchor_depth + 1))
                    setattr(candidate_cell, "_frame_chain_depth", str(parent_depth + 1))
                    parent_value_key = str(getattr(row_key_cell, "_frame_value_key", "") or "")
                    if parent_value_key:
                        setattr(candidate_cell, "_frame_chain_key", parent_value_key)
                else:
                    setattr(candidate_cell, "_frame_chain_depth", str(anchor_depth + 1))


def v108_apply_certificate_row_pair_semantics(frame_specs: list[dict]) -> None:
    if not frame_specs:
        return

    row_specs_map: dict[int, list[dict]] = {}

    for spec in frame_specs:
        row_start = int(spec.get("layout_row_start", 1))
        row_specs_map.setdefault(row_start, []).append(spec)

    for row_start in sorted(row_specs_map):
        ordered_specs = sorted(row_specs_map[row_start], key=lambda item: int(item.get("layout_col_start", 1)))

        if not ordered_specs:
            continue

        if (
            len(ordered_specs) == 2
            and int(ordered_specs[0].get("layout_col_start", 1)) == 1
            and int(ordered_specs[0].get("layout_row_end", row_start + 1)) - row_start <= 1
        ):
            key_spec = ordered_specs[0]
            value_spec = ordered_specs[1]
            key_cell = key_spec.get("cell")
            value_cell = value_spec.get("cell")

            if key_cell is not None and value_cell is not None:
                key_text = v202_normalize_whitespace(str(getattr(key_cell, "_frame_source_text", "") or ""))

                if key_text:
                    known_label = v202_resolve_known_label(key_text)
                    key_value_key = str(known_label.get("canonical_label") or key_text) if known_label else key_text
                    key_group_id = str(getattr(key_cell, "_frame_group_id", "") or key_value_key)
                    key_color_group = str(known_label.get("canonical_label") or key_group_id) if known_label else key_group_id
                    key_spec["color_group"] = key_color_group
                    value_spec["color_group"] = key_color_group
                    setattr(key_cell, "_frame_color_group", key_color_group)
                    setattr(value_cell, "_frame_color_group", key_color_group)
                    setattr(key_cell, "_frame_value_key", key_value_key)
                    setattr(value_cell, "_frame_value_key", key_value_key)
                    setattr(key_cell, "_frame_role", "key")
                    setattr(value_cell, "_frame_role", "value")
                    setattr(key_cell, "_frame_chain_key", key_value_key)
                    setattr(value_cell, "_frame_chain_key", key_value_key)
                    setattr(key_cell, "_frame_chain_depth", "0")
                    setattr(value_cell, "_frame_chain_depth", "1")
                    setattr(value_cell, "_frame_parent_group", key_group_id)
                    continue

        active_key_spec = None
        active_key_value_key = ""
        active_key_group_id = ""
        active_color_group = ""

        for spec in ordered_specs:
            cell = spec.get("cell")

            if cell is None:
                continue

            source_text = v202_normalize_whitespace(str(getattr(cell, "_frame_source_text", "") or ""))
            known_label = v202_resolve_known_label(source_text) if source_text else None

            if known_label is not None:
                active_key_spec = spec
                active_key_value_key = str(known_label.get("canonical_label") or source_text)
                active_key_group_id = str(getattr(cell, "_frame_group_id", "") or active_key_value_key)
                active_color_group = active_key_value_key
                spec["color_group"] = active_color_group
                setattr(cell, "_frame_color_group", active_color_group)
                setattr(cell, "_frame_value_key", active_key_value_key)
                setattr(cell, "_frame_role", "key")
                setattr(cell, "_frame_chain_key", active_key_value_key)
                setattr(cell, "_frame_chain_depth", "0")
                continue

            if active_key_spec is None or not active_key_value_key:
                continue

            spec["color_group"] = active_color_group
            setattr(cell, "_frame_color_group", active_color_group)
            setattr(cell, "_frame_value_key", active_key_value_key)
            setattr(cell, "_frame_role", "value")
            setattr(cell, "_frame_chain_key", active_key_value_key)
            setattr(cell, "_frame_chain_depth", "1")
            setattr(cell, "_frame_parent_group", active_key_group_id)


def v102_build_region_frame_band_html(
    block,
    scale: float,
    band_index: int,
    frame_group_id: str,
    frame_group_version: str = "v1.08",
) -> str:
    bbox = getattr(block, "bbox", None)

    if bbox is None:
        return ""

    frame_outline_style = v202_normalize_frame_outline_style(
        str(getattr(block, "_frame_outline_style", "") or ""),
        "dashed",
    )
    cell = SimpleNamespace(
        row_start=1,
        row_end=2,
        col_start=1,
        col_end=2,
        bbox=bbox,
        font_pt=float(getattr(block, "font_pt", 10.0) or 10.0),
        bold=bool(getattr(block, "bold", False)),
        align="left",
        valign="top",
        _frame_group_id=str(getattr(block, "_frame_group_id", "") or frame_group_id),
        _frame_color_group=str(getattr(block, "_frame_color_group", "") or frame_group_id),
        _frame_value_key=str(getattr(block, "_frame_value_key", "") or ""),
        _frame_source_text=str(getattr(block, "text", "") or "").strip(),
        _frame_role=str(getattr(block, "_frame_role", "") or "").strip(),
        _frame_parent_group=str(getattr(block, "_frame_parent_group", "") or "").strip(),
        _frame_chain_key=str(getattr(block, "_frame_chain_key", "") or "").strip(),
        _frame_chain_depth=str(getattr(block, "_frame_chain_depth", "") or "").strip(),
        _frame_outline_style=frame_outline_style,
    )
    spec = {
        "cell": cell,
        "x0": float(bbox.x0),
        "x1": float(bbox.x1),
        "y0": float(bbox.y0),
        "y1": float(bbox.y1),
        "outline_style": frame_outline_style,
    }
    if normalize_frame_group_version(frame_group_version) in ("v1.03", "v1.04", "v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11"):
        return v103_build_frame_band_markup([spec], scale, band_index, frame_group_version=frame_group_version)

    return v102_build_frame_band_markup([spec], scale, band_index, frame_group_version=frame_group_version)


def v202_fill_gap_cells(
    current_column: int,
    next_column: int,
    row_index: int,
    total_columns: int,
    total_rows: int,
    clone_id: str,
) -> str:
    gap = max(0, next_column - current_column)

    if gap <= 0:
        return ""

    col_start = current_column + 1
    col_end = next_column + 1
    row_start = row_index + 1
    row_end = row_start + 1
    border_style = v202_build_cell_border_style(
        col_start,
        col_end,
        row_start,
        row_end,
        total_columns,
        total_rows,
        clone_id,
    )
    style_attr = f' style="{border_style}"' if border_style else ""

    return f'<td class="v202-cell-empty" colspan="{gap}"{style_attr}></td>'


def v202_text_signature(text: str) -> str:
    return re.sub(r"\s+", "", str(text or "")).strip()


def v202_bbox_overlap_ratio(start_a: float, end_a: float, start_b: float, end_b: float) -> float:
    overlap = max(0.0, min(end_a, end_b) - max(start_a, start_b))
    span = min(max(0.0, end_a - start_a), max(0.0, end_b - start_b))

    if span <= 0:
        return 0.0

    return overlap / span


def v202_is_duplicate_line_block(candidate, existing_blocks: list) -> bool:
    candidate_bbox = getattr(candidate, "bbox", None)
    candidate_text = v202_text_signature(getattr(candidate, "text", "") or "")

    if candidate_bbox is None or not candidate_text:
        return False

    for existing in existing_blocks:
        existing_bbox = getattr(existing, "bbox", None)
        existing_text = v202_text_signature(getattr(existing, "text", "") or "")

        if existing_bbox is None or not existing_text:
            continue

        vertical_overlap = v202_bbox_overlap_ratio(
            float(candidate_bbox.y0),
            float(candidate_bbox.y1),
            float(existing_bbox.y0),
            float(existing_bbox.y1),
        )
        horizontal_overlap = v202_bbox_overlap_ratio(
            float(candidate_bbox.x0),
            float(candidate_bbox.x1),
            float(existing_bbox.x0),
            float(existing_bbox.x1),
        )

        if vertical_overlap < 0.6 or horizontal_overlap < 0.25:
            continue

        if (
            candidate_text == existing_text
            or candidate_text in existing_text
            or existing_text in candidate_text
        ):
            return True

    return False


def v202_is_contained_region_block(candidate, other) -> bool:
    candidate_bbox = getattr(candidate, "bbox", None)
    other_bbox = getattr(other, "bbox", None)

    if candidate_bbox is None or other_bbox is None:
        return False

    candidate_area = max(1.0, float(candidate_bbox.width) * float(candidate_bbox.height))
    other_area = max(1.0, float(other_bbox.width) * float(other_bbox.height))

    if other_area <= candidate_area * 1.15:
        return False

    overlap_width = max(0.0, min(float(candidate_bbox.x1), float(other_bbox.x1)) - max(float(candidate_bbox.x0), float(other_bbox.x0)))
    overlap_height = max(0.0, min(float(candidate_bbox.y1), float(other_bbox.y1)) - max(float(candidate_bbox.y0), float(other_bbox.y0)))
    overlap_area = overlap_width * overlap_height

    if overlap_area <= 0.0:
        return False

    containment_ratio = overlap_area / candidate_area

    if containment_ratio < 0.88:
        return False

    candidate_text = v202_text_signature(getattr(candidate, "text", "") or "")
    other_text = v202_text_signature(getattr(other, "text", "") or "")

    if candidate_text and other_text:
        if candidate_text == other_text or candidate_text in other_text or other_text in candidate_text:
            return True

    return float(candidate_bbox.y0) >= float(other_bbox.y0) - 2.0 and float(candidate_bbox.y1) <= float(other_bbox.y1) + 2.0


def v202_outside_region_source_groups(page) -> list:
    return [
        ("raster", getattr(page, "raster_blocks", []) or []),
        ("line", getattr(page, "text_lines", []) or []),
        ("block", getattr(page, "text_blocks", []) or []),
    ]


def v202_is_footer_bullet_text(text: str) -> bool:
    normalized = v202_text_signature(text)

    return (
        normalized.startswith("○")
        or "상기내용은진행" in normalized
        or "협력사에서는반드시" in normalized
        or "향후수급사업자의귀책" in normalized
        or "무효입니다" in normalized
    )


def v202_is_footer_note_text(text: str) -> bool:
    normalized = v202_text_signature(text)
    return "※협력사에서는전자서명완료후에작업에착수해주시기바랍니다" in normalized


def v202_resolve_table_frame_bounds(table):
    x_lines = list(getattr(table, "x_lines", []) or [])
    y_lines = list(getattr(table, "y_lines", []) or [])

    if len(x_lines) >= 2 and len(y_lines) >= 2:
        left = float(x_lines[0])
        top = float(y_lines[0])
        right = float(x_lines[-1])
        bottom = float(y_lines[-1])
        width = max(1.0, right - left)
        height = max(1.0, bottom - top)
        return {
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
            "width": width,
            "height": height,
        }

    return {
        "left": float(table.bbox.x0),
        "top": float(table.bbox.y0),
        "right": float(table.bbox.x1),
        "bottom": float(table.bbox.y1),
        "width": max(1.0, float(table.bbox.width)),
        "height": max(1.0, float(table.bbox.height)),
    }


def v202_resolve_page_frame_bounds(page):
    tables = getattr(page, "tables", []) or []

    if not tables:
        return None

    table_bounds = [v202_resolve_table_frame_bounds(table) for table in tables]
    left = min(bounds["left"] for bounds in table_bounds)
    top = min(bounds["top"] for bounds in table_bounds)
    right = max(bounds["right"] for bounds in table_bounds)
    bottom = max(bounds["bottom"] for bounds in table_bounds)

    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": max(1.0, right - left),
        "height": max(1.0, bottom - top),
    }


def v202_resolve_block_vertical_region(block, frame_bounds) -> str:
    bbox = getattr(block, "bbox", None)

    if bbox is None or frame_bounds is None:
        return "inside"

    if float(bbox.y1) <= frame_bounds["top"] + 2.0:
        return "top"

    if float(bbox.y0) >= frame_bounds["bottom"] - 2.0:
        return "bottom"

    return "inside"


def v202_collect_outside_region_blocks(page, frame_bounds, region: str) -> list:
    ranked_candidates = []
    source_rank = {"raster": 0, "line": 1, "block": 2}

    for source_name, source_group in v202_outside_region_source_groups(page):
        for block in source_group:
            normalized_text = v202_normalize_whitespace(getattr(block, "text", "") or "")

            if not normalized_text:
                continue

            if v202_resolve_block_vertical_region(block, frame_bounds) != region:
                continue

            ranked_candidates.append((source_rank[source_name], block))

    ranked_candidates.sort(
        key=lambda entry: (
            entry[0],
            max(1.0, float(entry[1].bbox.width) * float(entry[1].bbox.height)),
            float(entry[1].bbox.y0),
            float(entry[1].bbox.x0),
        )
    )

    selected = []

    for _, block in ranked_candidates:
        if v202_is_duplicate_line_block(block, selected):
            continue

        selected.append(block)

    if region == "bottom":
        has_bullet_footer = any(
            v202_is_footer_bullet_text(getattr(block, "text", "") or "")
            for block in selected
        )

        if has_bullet_footer:
            selected = [
                block
                for block in selected
                if not v202_is_footer_note_text(getattr(block, "text", "") or "")
            ]

    if region == "top":
        normalized_top_texts = [
            v202_text_signature(getattr(block, "text", "") or "")
            for block in selected
        ]
        has_split_header = any(text.startswith("양식명(코드)") for text in normalized_top_texts) and any(
            text.startswith("문서번호") for text in normalized_top_texts
        )

        if has_split_header:
            selected = [
                block
                for block in selected
                if not (
                    "양식명(코드)" in v202_text_signature(getattr(block, "text", "") or "")
                    and "문서번호" in v202_text_signature(getattr(block, "text", "") or "")
                )
            ]

    deduped = []

    for block in sorted(selected, key=lambda item: (float(item.bbox.y0), float(item.bbox.x0), -(float(item.bbox.width) * float(item.bbox.height)))):
        if any(v202_is_contained_region_block(block, other) for other in selected if other is not block):
            continue

        deduped.append(block)

    return sorted(deduped, key=lambda item: (float(item.bbox.y0), float(item.bbox.x0)))


def v202_render_table_row(
    cells: list,
    row_index: int,
    total_rows: int,
    total_columns: int,
    scale: float,
    carry_over,
    clone_id: str,
    extraction_stage: str = "full",
):
    descriptors = [v202_build_cell_descriptor(cell) for cell in sorted(cells, key=lambda item: (item.col_start, item.col_end))]
    next_carry = carry_over

    if not descriptors:
        return "", next_carry
    frame_only = normalize_extraction_stage(extraction_stage) == "frames"

    if frame_only:
        next_carry = None

        for descriptor in descriptors:
            descriptor["html"] = v202_build_frame_group_html(descriptor["cell"])
    else:
        for descriptor in descriptors:
            if descriptor["known_label"] is not None:
                continue

            if v202_has_choice_lines(getattr(descriptor["cell"], "lines", []) or []):
                continue

            composite_html = v202_build_inline_composite_html(descriptor["raw_text"])

            if composite_html:
                descriptor["html"] = f'<div class="v202-cell-box">{composite_html}</div>'

        label_indexes = [
            index
            for index, descriptor in enumerate(descriptors)
            if descriptor["html"] is None and descriptor["known_label"] is not None
        ]

        if label_indexes:
            next_carry = None

            for label_index, next_label_index in zip(label_indexes, label_indexes[1:] + [len(descriptors)]):
                label_descriptor = descriptors[label_index]
                known_label = label_descriptor["known_label"]
                attached_value = False
                label_descriptor["html"] = v202_render_plain_cell_html(
                    label_descriptor["cell"],
                    allow_composite=False,
                    admin_scope=True,
                )

                for candidate_index in range(label_index + 1, next_label_index):
                    candidate_descriptor = descriptors[candidate_index]

                    if (
                        candidate_descriptor["html"] is not None
                        or candidate_descriptor["known_label"] is not None
                    ):
                        continue

                    if v202_is_v221_clone(clone_id):
                        document_issue_html = v202_build_document_issue_composite_html(
                            label_descriptor,
                            candidate_descriptor,
                            scale,
                            clone_id,
                        )

                        if document_issue_html:
                            candidate_descriptor["html"] = document_issue_html
                            attached_value = True
                            continue
                    else:
                        virtual_descriptors = v202_resolve_document_issue_virtual_descriptors(
                            label_descriptor,
                            candidate_descriptor,
                        )

                        if virtual_descriptors:
                            candidate_descriptor["virtual_descriptors"] = virtual_descriptors
                            candidate_descriptor["html"] = ""
                            attached_value = True
                            continue

                        document_issue_html = v202_build_document_issue_composite_html(
                            label_descriptor,
                            candidate_descriptor,
                            scale,
                            clone_id,
                        )

                        if document_issue_html:
                            candidate_descriptor["html"] = document_issue_html
                            attached_value = True
                            continue

                    should_render_block = (
                        known_label["field_type"] == "textarea"
                        or len(candidate_descriptor["text"]) > 36
                        or "\n" in candidate_descriptor["raw_text"]
                        or v202_looks_like_datetime(candidate_descriptor["text"])
                    )
                    candidate_descriptor["html"] = v202_render_value_cell_html(
                        known_label["canonical_label"],
                        candidate_descriptor["cell"],
                        should_render_block,
                        clone_id,
                    )
                    attached_value = True

                if not attached_value and (
                    known_label["field_type"] == "textarea"
                    or "제목" in known_label["canonical_label"]
                ):
                    next_carry = {
                        "label": known_label["canonical_label"],
                        "multiline": True,
                    }

        elif next_carry:
            for descriptor in descriptors:
                if descriptor["html"] is not None or (not descriptor["text"] and not descriptor["raw_text"].strip()):
                    continue

                descriptor["html"] = v202_render_value_cell_html(
                    next_carry["label"],
                    descriptor["cell"],
                    next_carry["multiline"] or len(descriptor["text"]) > 40 or "\n" in descriptor["raw_text"],
                    clone_id,
                )

        for descriptor in descriptors:
            if descriptor["html"] is None:
                descriptor["html"] = v202_render_plain_cell_html(
                    descriptor["cell"],
                    allow_composite=descriptor["known_label"] is None,
                    admin_scope=descriptor["known_label"] is not None,
                )

    current_column = 0
    fragments = []

    render_descriptors = []

    if frame_only:
        render_descriptors = list(descriptors)
    else:
        for descriptor in descriptors:
            virtual_descriptors = descriptor.get("virtual_descriptors") or []

            if virtual_descriptors:
                render_descriptors.extend(virtual_descriptors)
                continue

            render_descriptors.append(descriptor)

    render_descriptors.sort(key=lambda item: (item["cell"].col_start, item["cell"].col_end))

    for descriptor in render_descriptors:
        cell = descriptor["cell"]
        fragments.append(
            v202_fill_gap_cells(
                current_column,
                cell.col_start - 1,
                row_index,
                total_columns,
                total_rows,
                clone_id,
            )
        )
        current_column = cell.col_end - 1
        colspan = max(1, cell.col_end - cell.col_start)
        rowspan = max(1, cell.row_end - cell.row_start)
        font_px = clamp(float(getattr(cell, "font_pt", 11.0) or 11.0) * scale, 10.5, 18.0)
        pad_x = clamp(font_px * 0.42, 5.0, 8.5)
        pad_y = clamp(font_px * 0.30, 3.5, 7.5)
        pad_top, pad_right, pad_bottom, pad_left = v202_resolve_cell_padding(
            cell,
            scale,
            pad_x,
            pad_y,
            clone_id,
        )
        font_weight = 700 if getattr(cell, "bold", False) else 400
        align = getattr(cell, "align", "left") or "left"
        valign = getattr(cell, "valign", "top") or "top"
        border_style = v202_build_cell_border_style(
            int(cell.col_start),
            int(cell.col_end),
            int(cell.row_start),
            int(cell.row_end),
            total_columns,
            total_rows,
            clone_id,
        )
        td_class = f'halign-{html.escape(str(align), quote=True)} valign-{html.escape(str(valign), quote=True)}'
        td_style = (
            f'{border_style}font-size:{font_px:.2f}px; font-weight:{font_weight}; '
            f'padding:{pad_top:.2f}px {pad_right:.2f}px {pad_bottom:.2f}px {pad_left:.2f}px; '
            f'--v202-pad-x:{pad_x:.2f}px; --v202-pad-y:{pad_y:.2f}px;'
        )
        span_attr = f'colspan="{colspan}" rowspan="{rowspan}"'

        if frame_only:
            fragments.append(
                f'{v202_build_frame_group_td_open_tag(cell, td_class, td_style, span_attr)}'
                f'{descriptor["html"]}'
                '</td>'
            )
        else:
            fragments.append(
                f'<td class="{td_class}" '
                f'{span_attr} '
                f'style="{td_style}">'
                f'{v22_wrap_cell_html(descriptor["html"], clone_id)}'
                '</td>'
            )

    if not v202_is_v221_clone(clone_id):
        fragments.append(
            v202_fill_gap_cells(
                current_column,
                total_columns,
                row_index,
                total_columns,
                total_rows,
                clone_id,
            )
        )
    return "".join(fragment for fragment in fragments if fragment), next_carry


def v202_build_table_inner_html(table, scale: float, clone_id: str, extraction_stage: str = "full") -> str:
    total_columns = max(1, len(getattr(table, "x_lines", []) or []) - 1)
    total_rows = max(0, len(getattr(table, "y_lines", []) or []) - 1)
    table_frame_bounds = v202_resolve_table_frame_bounds(table)
    rows = [[] for _ in range(total_rows)]

    for cell in sorted(getattr(table, "cells", []) or [], key=lambda item: (item.row_start, item.col_start, item.row_end, item.col_end)):
        row_index = max(0, min(total_rows - 1, cell.row_start - 1))

        if total_rows > 0:
            rows[row_index].append(cell)

    col_widths = []
    table_width = table_frame_bounds["width"]

    for column_index in range(total_columns):
        x0 = table.x_lines[column_index]
        x1 = table.x_lines[column_index + 1]
        col_widths.append(f'{((x1 - x0) / table_width) * 100.0:.6f}%')

    colgroup_html = "".join(f'<col style="width:{width}">' for width in col_widths)
    table_rows_html = []
    carry_over = None

    for row_index in range(total_rows):
        y0 = table.y_lines[row_index]
        y1 = table.y_lines[row_index + 1]
        row_height = max(14.0, (y1 - y0) * scale)
        row_html, carry_over = v202_render_table_row(
            rows[row_index],
            row_index,
            total_rows,
            total_columns,
            scale,
            carry_over,
            clone_id,
            extraction_stage,
        )
        row_marker_attr = ' data-v22-edited="false"' if v202_is_v22_clone(clone_id) else ""
        table_rows_html.append(
            f'<tr{row_marker_attr} style="height:{row_height:.2f}px;">'
            f'{row_html}'
            '</tr>'
        )

    return f'<colgroup>{colgroup_html}</colgroup><tbody>{"".join(table_rows_html)}</tbody>'


def v202_build_table_frame_svg_html(table, scale: float, clone_id: str) -> str:
    if not v202_is_v22_clone(clone_id):
        return ""

    table_frame_bounds = v202_resolve_table_frame_bounds(table)
    width = max(1.0, table_frame_bounds["width"] * scale)
    height = max(1.0, table_frame_bounds["height"] * scale)
    lines = []
    stroke_widths = []

    for segment in build_frame_segments_for_table(table):
        orientation = segment.get("orientation")
        stroke_width = max(
            0.8,
            float(segment.get("thickness", V202_FRAME_STROKE_WIDTH) or V202_FRAME_STROKE_WIDTH) * scale,
        )
        stroke_widths.append(stroke_width)

        if orientation == "h":
            x1 = (float(segment["left"]) - table_frame_bounds["left"]) * scale
            x2 = x1 + max(1.0, float(segment["width"]) * scale)
            y = (float(segment["top"]) - table_frame_bounds["top"]) * scale
            lines.append(
                f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" stroke-width="{stroke_width:.2f}"></line>'
            )
            continue

        if orientation == "v":
            x = (float(segment["left"]) - table_frame_bounds["left"]) * scale
            y1 = (float(segment["top"]) - table_frame_bounds["top"]) * scale
            y2 = y1 + max(1.0, float(segment["height"]) * scale)
            lines.append(
                f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" stroke-width="{stroke_width:.2f}"></line>'
            )

    if not lines:
        return ""

    median_stroke_width = max(0.8, float(median(stroke_widths or [V202_FRAME_STROKE_WIDTH * scale])))

    return (
        f'<svg class="v202-frame-svg" aria-hidden="true" preserveAspectRatio="none" '
        f'data-frame-stroke-width="{median_stroke_width:.2f}" '
        f'viewBox="0 0 {width:.2f} {height:.2f}" style="width:{width:.2f}px; height:{height:.2f}px;">'
        f'<g stroke="#2f2f2f" fill="none">'
        f'{"".join(lines)}'
        '</g></svg>'
    )


def v22_build_table_raster_html(table, scale: float, clone_id: str) -> str:
    if not v202_is_v22_clone(clone_id):
        return ""

    crop_ref = str(getattr(table, "crop_ref", "") or "").strip()

    if not crop_ref:
        return ""

    table_frame_bounds = v202_resolve_table_frame_bounds(table)
    return (
        f'<div class="v22-table-raster" aria-hidden="true" '
        f'style="width:{table_frame_bounds["width"] * scale:.2f}px; '
        f'height:{table_frame_bounds["height"] * scale:.2f}px; '
        f'background-image:url(\'{html.escape(crop_ref, quote=True)}\');"></div>'
    )


def v202_build_table_markup(
    table,
    scale: float,
    clone_id: str,
    outer_style: str = "",
    extraction_stage: str = "full",
) -> str:
    table_frame_bounds = v202_resolve_table_frame_bounds(table)
    normalized_stage = normalize_extraction_stage(extraction_stage)
    raster_underlay_html = "" if normalized_stage == "frames" else v22_build_table_raster_html(table, scale, clone_id)
    frame_overlay_html = ""
    v22_live_attr = ""

    if v202_is_v22_clone(clone_id):
        v22_live_attr = ' data-v22-live="true"' if normalized_stage == "frames" else ' data-v22-live="false"'

    if normalized_stage != "frames" and not raster_underlay_html:
        frame_overlay_html = v202_build_table_frame_svg_html(table, scale, clone_id)

    return (
        f'<div class="v202-table-frame"{v22_live_attr} style="{outer_style}width:{table_frame_bounds["width"] * scale:.2f}px; '
        f'min-height:{table_frame_bounds["height"] * scale:.2f}px;">'
        f'{raster_underlay_html}{frame_overlay_html}'
        f'<table class="v202-table-block" style="width:100%; min-height:{table_frame_bounds["height"] * scale:.2f}px;">'
        f'{v202_build_table_inner_html(table, scale, clone_id, normalized_stage)}'
        '</table>'
        '</div>'
    )


def v202_build_table_html(table, scale: float, clone_id: str, extraction_stage: str = "full") -> str:
    table_frame_bounds = v202_resolve_table_frame_bounds(table)
    return v202_build_table_markup(
        table,
        scale,
        clone_id,
        outer_style=(
            f'position:absolute; left:{table_frame_bounds["left"] * scale:.2f}px; '
            f'top:{table_frame_bounds["top"] * scale:.2f}px; '
        ),
        extraction_stage=extraction_stage,
    )


def v202_build_table_flow_html(
    table,
    scale: float,
    frame_bounds: dict,
    previous_bottom: float | None,
    clone_id: str,
    extraction_stage: str = "full",
) -> tuple[str, float]:
    table_frame_bounds = v202_resolve_table_frame_bounds(table)
    table_top = table_frame_bounds["top"]
    table_bottom = table_frame_bounds["bottom"]
    gap_top = table_top - (previous_bottom if previous_bottom is not None else frame_bounds["top"])
    left_offset = table_frame_bounds["left"] - frame_bounds["left"]
    html_fragment = (
        f'<div class="v211-frame-flow-item" '
        f'style="margin-top:{max(0.0, gap_top) * scale:.2f}px; margin-left:{max(0.0, left_offset) * scale:.2f}px;">'
        f'{v202_build_table_markup(table, scale, clone_id, extraction_stage=extraction_stage)}'
        '</div>'
    )
    return html_fragment, table_bottom


def v202_build_text_block_html(block, scale: float) -> str:
    raw_text = str(getattr(block, "text", "") or "")
    font_px = clamp(float(getattr(block, "font_pt", 11.0) or 11.0) * scale * 0.95, 10.5, 18.0)
    pad_x = clamp(font_px * 0.36, 4.0, 8.0)
    pad_y = clamp(font_px * 0.26, 2.8, 6.5)
    font_weight = 700 if getattr(block, "bold", False) else 400
    align = getattr(block, "align", "left") or "left"
    lines = getattr(block, "lines", []) or []

    if v202_has_choice_lines(lines):
        content_html = v202_render_choice_lines(lines)
    elif getattr(block, "bbox", None) is not None and getattr(block.bbox, "y0", 0.0) < 40 and raw_text.strip().startswith("문서번호"):
        header_match = re.match(r"^문서번호\s*[:：]?\s*(.+)$", v202_normalize_whitespace(raw_text))

        if header_match:
            content_html = (
                '<div class="v202-cell-box">'
                f'{v202_build_admin_text_marker("문서번호 : ")} '
                f'{v202_build_value_marker("양식 문서번호", header_match.group(1))}'
                '</div>'
            )
        else:
            content_html = v202_render_plain_region(raw_text)
    else:
        content_html = v202_render_plain_region(raw_text)

    return (
        f'<div class="v202-text-block halign-{html.escape(str(align), quote=True)}" '
        f'style="left:{block.bbox.x0 * scale:.2f}px; top:{block.bbox.y0 * scale:.2f}px; '
        f'width:{block.bbox.width * scale:.2f}px; min-height:{block.bbox.height * scale:.2f}px; '
        f'padding:{pad_y:.2f}px {pad_x:.2f}px; font-size:{font_px:.2f}px; font-weight:{font_weight}; '
        f'line-height:{max(font_px * 1.24, 13.0):.2f}px;">'
        f'{content_html}'
        '</div>'
    )


def v202_should_right_anchor_region_block(block, page_width: float) -> bool:
    raw_text = v202_normalize_whitespace(getattr(block, "text", "") or "")
    bbox = getattr(block, "bbox", None)

    if bbox is None:
        return False

    if raw_text.startswith("문서번호") or raw_text.startswith("양식문서번호"):
        return True

    return float(bbox.x0) >= page_width * 0.68 or float(bbox.x1) >= page_width * 0.82


def v202_build_region_text_block_html(block, scale: float, region_top: float, page_width: float) -> str:
    raw_text = str(getattr(block, "text", "") or "")
    font_px = clamp(float(getattr(block, "font_pt", 11.0) or 11.0) * scale * 0.95, 10.5, 18.0)
    pad_x = clamp(font_px * 0.36, 4.0, 8.0)
    pad_y = clamp(font_px * 0.26, 2.8, 6.5)
    font_weight = 700 if getattr(block, "bold", False) else 400
    align = getattr(block, "align", "left") or "left"
    page_width_px = page_width * scale
    max_width = max(80.0, (page_width - float(block.bbox.x0)) * scale - pad_x * 2)
    content_html = v202_render_plain_region(raw_text)
    top_px = max(0.0, (float(block.bbox.y0) - region_top) * scale)
    min_height_px = block.bbox.height * scale
    line_height_px = max(font_px * 1.24, 13.0)
    right_anchored = v202_should_right_anchor_region_block(block, page_width)

    if right_anchored:
        right_px = max(0.0, (page_width - float(block.bbox.x1)) * scale)
        desired_width = max(float(block.bbox.width) * scale + pad_x * 4, 160.0)
        width_px = min(max(100.0, desired_width), max(100.0, page_width_px - right_px - 8.0))
        block_align = "right"
        block_position_style = (
            f'right:{right_px:.2f}px; top:{top_px:.2f}px; '
            f'width:{width_px:.2f}px; min-height:{min_height_px:.2f}px; '
        )
    else:
        block_align = align
        block_position_style = (
            f'left:{block.bbox.x0 * scale:.2f}px; top:{top_px:.2f}px; '
            f'min-height:{min_height_px:.2f}px; max-width:{max_width:.2f}px; '
        )

    return (
        f'<div class="v202-text-block halign-{html.escape(str(block_align), quote=True)}" '
        f'style="{block_position_style}'
        f'padding:{pad_y:.2f}px {pad_x:.2f}px; font-size:{font_px:.2f}px; font-weight:{font_weight}; '
        f'line-height:{line_height_px:.2f}px;">'
        f'{content_html}'
        '</div>'
    )


def v22_build_region_block_html(block, scale: float, region_top: float, page_width: float, clone_id: str) -> str:
    if v202_is_v22_clone(clone_id):
        crop_ref = str(getattr(block, "crop_ref", "") or "").strip()

        if crop_ref and getattr(block, "bbox", None) is not None:
            top_px = max(0.0, (float(block.bbox.y0) - region_top) * scale)
            return (
                f'<div class="v22-raster-region" aria-hidden="true" '
                f'style="left:{block.bbox.x0 * scale:.2f}px; top:{top_px:.2f}px; '
                f'width:{block.bbox.width * scale:.2f}px; min-height:{block.bbox.height * scale:.2f}px; '
                f'background-image:url(\'{html.escape(crop_ref, quote=True)}\');"></div>'
            )

    return v202_build_region_text_block_html(block, scale, region_top, page_width)


def v105_unique_positions(values: list[float], tolerance: float = 3.0) -> list[float]:
    ordered = sorted(float(value) for value in values)
    merged = []

    for value in ordered:
        if not merged or abs(value - merged[-1]) > tolerance:
            merged.append(value)
            continue

        merged[-1] = (merged[-1] + value) * 0.5

    return merged


def v105_find_row_cells(table, row_top: float, row_bottom: float) -> list:
    selected = []

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        overlap = v202_bbox_overlap_ratio(float(bbox.y0), float(bbox.y1), row_top, row_bottom)
        center_y = (row_top + row_bottom) * 0.5
        covers_center = float(bbox.y0) - 1.5 <= center_y <= float(bbox.y1) + 1.5

        if overlap >= 0.2 or covers_center:
            selected.append(cell)

    return selected


def v105_collect_row_vertical_edges(
    table,
    row_top: float,
    row_bottom: float,
    row_cells: list,
    prefer_source_segments: bool = False,
) -> list[float]:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return []

    center_y = (row_top + row_bottom) * 0.5
    table_left = float(table_bbox.x0)
    table_right = float(table_bbox.x1)
    source_edges = [table_left, table_right]
    cell_edges = [table_left, table_right]

    for cell in row_cells:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        cell_edges.extend([float(bbox.x0), float(bbox.x1)])

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "v":
            continue

        overlap = v202_bbox_overlap_ratio(float(bbox.y0), float(bbox.y1), row_top, row_bottom)
        covers_center = float(bbox.y0) - 2.0 <= center_y <= float(bbox.y1) + 2.0

        if overlap >= 0.18 or covers_center:
            source_edges.append((float(bbox.x0) + float(bbox.x1)) * 0.5)

    snapped_source_edges = [
        value
        for value in v105_unique_positions(source_edges)
        if table_left - 1.0 <= value <= table_right + 1.0
    ]

    if prefer_source_segments and len(snapped_source_edges) >= 2:
        internal_source_edges = snapped_source_edges[1:-1]

        if internal_source_edges:
            return snapped_source_edges

    return [
        value
        for value in v105_unique_positions(cell_edges + snapped_source_edges)
        if table_left - 1.0 <= value <= table_right + 1.0
    ]


def v105_pick_frame_color_group(cell, fallback_group: str) -> str:
    if cell is None:
        return fallback_group

    known_label = v202_resolve_known_label(getattr(cell, "text", "") or "")

    if known_label:
        return str(known_label.get("canonical_label") or fallback_group)

    return str(getattr(cell, "_frame_color_group", "") or getattr(cell, "_frame_group_id", "") or fallback_group)


def v105_select_overlapping_cell(row_cells: list, x0: float, x1: float) -> object | None:
    best_cell = None
    best_score = 0.0

    for cell in row_cells:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        overlap = max(0.0, min(float(bbox.x1), x1) - max(float(bbox.x0), x0))
        if overlap <= 0:
            continue

        cell_width = max(1.0, float(bbox.x1) - float(bbox.x0))
        score = overlap / cell_width

        if score > best_score:
            best_score = score
            best_cell = cell

    return best_cell


def v105_build_row_local_frame_specs(
    table,
    row_index: int,
    band_index: int,
    frame_group_version: str = "v1.08",
) -> list[dict]:
    y_lines = list(getattr(table, "y_lines", []) or [])
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)

    if row_index < 0 or row_index + 1 >= len(y_lines):
        return []

    row_top = float(y_lines[row_index])
    row_bottom = float(y_lines[row_index + 1])
    row_cells = v105_find_row_cells(table, row_top, row_bottom)
    edges = v105_collect_row_vertical_edges(table, row_top, row_bottom, row_cells, prefer_source_segments=True)

    if len(edges) < 2:
        return []

    font_points = [float(getattr(cell, "font_pt", 11.0) or 11.0) for cell in row_cells]
    font_pt = median(font_points) if font_points else 11.0
    specs = []

    for local_index, (x0, x1) in enumerate(zip(edges, edges[1:]), start=1):
        if x1 - x0 < 6.0:
            continue

        overlap_cell = v105_select_overlapping_cell(row_cells, x0, x1)
        frame_group_id = f"band-{band_index}-cell-{local_index}"
        frame_color_group = (
            frame_group_id
            if normalized_frame_group_version in ("v1.09", "v1.10", "v1.11")
            else v105_pick_frame_color_group(overlap_cell, frame_group_id)
        )
        frame_outline_style = v105_resolve_frame_outline_style(table, x0, row_top, x1, row_bottom)
        bbox = v102_make_bbox(x0, row_top, x1, row_bottom)
        cell_like = SimpleNamespace(
            row_start=row_index + 1,
            row_end=row_index + 2,
            col_start=local_index,
            col_end=local_index + 1,
            bbox=bbox,
            font_pt=float(getattr(overlap_cell, "font_pt", font_pt) if overlap_cell is not None else font_pt),
            bold=bool(getattr(overlap_cell, "bold", False)) if overlap_cell is not None else False,
            align=getattr(overlap_cell, "align", "left") if overlap_cell is not None else "left",
            valign=getattr(overlap_cell, "valign", "top") if overlap_cell is not None else "top",
            _frame_group_id=frame_group_id,
            _frame_color_group=frame_color_group,
            _frame_source_text=str(getattr(overlap_cell, "text", "") or "").strip(),
            _frame_outline_style=frame_outline_style,
        )
        specs.append(
            {
                "cell": cell_like,
                "x0": x0,
                "x1": x1,
                "y0": row_top,
                "y1": row_bottom,
                "color_group": frame_color_group,
                "outline_style": frame_outline_style,
            }
        )

    if normalized_frame_group_version not in ("v1.09", "v1.10", "v1.11"):
        v106_apply_frame_spec_semantics(specs)

    return specs


def v111_snap_value_to_candidates(value: float, candidates: list[float], tolerance: float = 4.0) -> float:
    if not candidates:
        return float(value)

    nearest = min(candidates, key=lambda candidate: abs(float(candidate) - float(value)))
    return float(nearest) if abs(float(nearest) - float(value)) <= tolerance else float(value)


def v111_collect_precise_row_vertical_edges(table, row_top: float, row_bottom: float, row_cells: list) -> list[float]:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return []

    table_left = float(table_bbox.x0)
    table_right = float(table_bbox.x1)
    center_y = (float(row_top) + float(row_bottom)) * 0.5
    candidates = [table_left, table_right]
    candidates.extend(float(value) for value in (getattr(table, "x_lines", []) or []))

    for cell in row_cells:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        candidates.extend([float(bbox.x0), float(bbox.x1)])

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "v":
            continue

        overlap = v202_bbox_overlap_ratio(float(bbox.y0), float(bbox.y1), row_top, row_bottom)
        covers_center = float(bbox.y0) - 2.0 <= center_y <= float(bbox.y1) + 2.0

        if overlap >= 0.18 or covers_center:
            candidates.append((float(bbox.x0) + float(bbox.x1)) * 0.5)

    resolved = v105_resolve_certificate_edge_clusters(
        candidates,
        lambda x_value: v105_measure_vertical_line_score(table, x_value),
        2.75,
    )
    return [value for value in resolved if table_left - 1.0 <= value <= table_right + 1.0]


def v111_collect_precise_row_horizontal_edges(table, row_top: float, row_bottom: float) -> list[float]:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return []

    table_top = float(table_bbox.y0)
    table_bottom = float(table_bbox.y1)
    table_left = float(table_bbox.x0)
    table_right = float(table_bbox.x1)
    candidates = [table_top, table_bottom, float(row_top), float(row_bottom)]
    candidates.extend(float(value) for value in (getattr(table, "y_lines", []) or []))

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "h":
            continue

        overlap = max(0.0, min(float(bbox.x1), table_right) - max(float(bbox.x0), table_left))

        if overlap <= 0.0:
            continue

        candidates.append((float(bbox.y0) + float(bbox.y1)) * 0.5)

    resolved = v105_resolve_certificate_edge_clusters(
        candidates,
        lambda y_value: v105_measure_horizontal_line_score(table, y_value),
        2.5,
    )
    return [value for value in resolved if table_top - 1.0 <= value <= table_bottom + 1.0]


def v111_refresh_frame_spec_bbox(spec: dict, x0: float, y0: float, x1: float, y1: float) -> None:
    cell = spec.get("cell")
    next_bbox = v102_make_bbox(x0, y0, x1, y1)
    spec["x0"] = float(x0)
    spec["x1"] = float(x1)
    spec["y0"] = float(y0)
    spec["y1"] = float(y1)

    if cell is not None:
        setattr(cell, "bbox", next_bbox)


def v111_resolve_mesh_edge_indexes(start_value: float, end_value: float, edges: list[float]) -> tuple[int, int] | None:
    if len(edges) < 2:
        return None

    start_index = min(range(len(edges)), key=lambda index: abs(float(edges[index]) - float(start_value)))
    end_index = min(range(len(edges)), key=lambda index: abs(float(edges[index]) - float(end_value)))

    if end_index <= start_index:
        return None

    return start_index, end_index


def v111_build_table_mesh_markup(
    scale: float,
    band_index: int,
    frame_specs: list[dict],
    frame_group_version: str = "v1.11",
) -> str:
    if not frame_specs:
        return ""

    sorted_specs = sorted(
        frame_specs,
        key=lambda item: (
            float(item["y0"]),
            float(item["x0"]),
            float(item["y1"]),
            float(item["x1"]),
        ),
    )
    x_edges = v105_unique_positions(
        [float(item["x0"]) for item in sorted_specs] + [float(item["x1"]) for item in sorted_specs],
        0.75,
    )
    y_edges = v105_unique_positions(
        [float(item["y0"]) for item in sorted_specs] + [float(item["y1"]) for item in sorted_specs],
        0.75,
    )

    if len(x_edges) < 2 or len(y_edges) < 2:
        return ""

    normalized_specs = []

    for spec in sorted_specs:
        edge_indexes = v111_resolve_mesh_edge_indexes(float(spec["x0"]), float(spec["x1"]), x_edges)
        row_indexes = v111_resolve_mesh_edge_indexes(float(spec["y0"]), float(spec["y1"]), y_edges)

        if edge_indexes is None or row_indexes is None:
            continue

        normalized_spec = dict(spec)
        normalized_spec["layout_col_start"] = edge_indexes[0] + 1
        normalized_spec["layout_col_end"] = edge_indexes[1] + 1
        normalized_spec["layout_row_start"] = row_indexes[0] + 1
        normalized_spec["layout_row_end"] = row_indexes[1] + 1
        normalized_specs.append(normalized_spec)

    if not normalized_specs:
        return ""

    band_left = float(x_edges[0])
    band_top = float(y_edges[0])
    band_right = float(x_edges[-1])
    band_bottom = float(y_edges[-1])
    band_left_px = v103_snap_scaled_px(band_left, scale)
    band_top_px = v103_snap_scaled_px(band_top, scale)
    band_right_px = max(band_left_px + 1, v103_snap_scaled_px(band_right, scale))
    band_bottom_px = max(band_top_px + 1, v103_snap_scaled_px(band_bottom, scale))
    band_width_px = band_right_px - band_left_px
    band_height_px = band_bottom_px - band_top_px

    col_edges_px = [v103_snap_scaled_px(value, scale) for value in x_edges]
    row_edges_px = [v103_snap_scaled_px(value, scale) for value in y_edges]
    col_edges_px[0] = band_left_px
    col_edges_px[-1] = band_right_px
    row_edges_px[0] = band_top_px
    row_edges_px[-1] = band_bottom_px
    col_widths_px = [max(1, right_px - left_px) for left_px, right_px in zip(col_edges_px, col_edges_px[1:])]
    row_heights_px = [max(1, bottom_px - top_px) for top_px, bottom_px in zip(row_edges_px, row_edges_px[1:])]
    frame_specs_by_origin = {}
    color_group_indexes = v102_resolve_color_group_indexes(normalized_specs)
    band_outline_style = v102_resolve_band_outline_style(normalized_specs, frame_group_version)
    band_border_color = "rgba(15, 23, 42, 0.34)" if band_outline_style == "dashed" else "rgba(15, 23, 42, 0.55)"
    band_border_css = f" border:1px {band_outline_style} {band_border_color};" if band_outline_style == "dashed" else ""

    for spec in normalized_specs:
        frame_specs_by_origin[(int(spec["layout_row_start"]), int(spec["layout_col_start"]))] = spec

    occupied = set()
    rows_html = []

    for local_row_index in range(1, len(y_edges)):
        row_color = v102_pick_palette_color(V102_ROW_COLOR_PALETTE, band_index + local_row_index - 1)
        cells_html = []

        for local_col_index in range(1, len(x_edges)):
            if (local_row_index, local_col_index) in occupied:
                continue

            spec = frame_specs_by_origin.get((local_row_index, local_col_index))

            if spec is None:
                continue

            cell = spec["cell"]
            local_row_end = int(spec["layout_row_end"])
            local_col_end = int(spec["layout_col_end"])
            rowspan = max(1, local_row_end - local_row_index)
            colspan = max(1, local_col_end - local_col_index)

            for covered_row in range(local_row_index, local_row_end):
                for covered_col in range(local_col_index, local_col_end):
                    if covered_row == local_row_index and covered_col == local_col_index:
                        continue
                    occupied.add((covered_row, covered_col))

            font_px = clamp(float(getattr(cell, "font_pt", 11.0) or 11.0) * scale, 10.5, 18.0)
            font_weight = 700 if getattr(cell, "bold", False) else 400
            color_group = str(spec.get("color_group") or getattr(cell, "_frame_color_group", "") or getattr(cell, "_frame_group_id", "") or "")
            color_index = color_group_indexes.get(color_group, len(color_group_indexes))
            col_color = v102_pick_palette_color(V102_COL_COLOR_PALETTE, color_index)
            span_attr = ""
            border_style = ""

            if rowspan > 1:
                span_attr += f' rowspan="{rowspan}"'

            if colspan > 1:
                span_attr += f' colspan="{colspan}"'

            if local_col_index > 1:
                border_style += f" border-left:1px {band_outline_style} {band_border_color};"

            if local_row_index > 1:
                border_style += f" border-top:1px {band_outline_style} {band_border_color};"

            cells_html.append(
                f'{v202_build_frame_group_td_open_tag(cell, "halign-left valign-top", f"font-size:{font_px:.2f}px; font-weight:{font_weight}; --v102-row-color:{row_color}; --v102-col-color:{col_color};{border_style}", span_attr.strip())}'
                f'{v202_build_frame_group_html(cell)}'
                '</td>'
            )

        rows_html.append(f'<tr style="height:{row_heights_px[local_row_index - 1]}px;">{"".join(cells_html)}</tr>')

    colgroup_html = "".join(f'<col style="width:{max(1, width_px)}px">' for width_px in col_widths_px)

    return (
        f'<div class="v102-frame-band" style="left:{band_left_px}px; top:{band_top_px}px; '
        f'width:{band_width_px}px; height:{band_height_px}px;">'
        f'<table class="v202-table-block v102-frame-band-table" style="width:{band_width_px}px; height:{band_height_px}px;{band_border_css}">'
        f'<colgroup>{colgroup_html}</colgroup>'
        f'<tbody style="--v102-row-color:{v102_pick_palette_color(V102_ROW_COLOR_PALETTE, band_index)};">'
        f'{"".join(rows_html)}'
        '</tbody></table></div>'
    )


def v111_build_embedded_block_frame_spec(block) -> dict | None:
    bbox = getattr(block, "bbox", None)

    if bbox is None:
        return None

    frame_group_id = str(getattr(block, "_frame_group_id", "") or "")
    frame_color_group = str(getattr(block, "_frame_color_group", "") or frame_group_id or "embedded-block")
    frame_outline_style = str(getattr(block, "_frame_outline_style", "") or "solid")
    cell_like = SimpleNamespace(
        row_start=1,
        row_end=2,
        col_start=1,
        col_end=2,
        bbox=bbox,
        font_pt=float(getattr(block, "font_pt", 11.0) or 11.0),
        bold=bool(getattr(block, "bold", False)),
        align=getattr(block, "align", "left") or "left",
        valign=getattr(block, "valign", "top") or "top",
        _frame_group_id=frame_group_id,
        _frame_color_group=frame_color_group,
        _frame_source_text=str(getattr(block, "text", "") or "").strip(),
        _frame_outline_style=frame_outline_style,
    )

    if hasattr(block, "_frame_value_key"):
        setattr(cell_like, "_frame_value_key", str(getattr(block, "_frame_value_key", "") or ""))

    if hasattr(block, "_frame_role"):
        setattr(cell_like, "_frame_role", str(getattr(block, "_frame_role", "") or ""))

    return {
        "cell": cell_like,
        "x0": float(bbox.x0),
        "x1": float(bbox.x1),
        "y0": float(bbox.y0),
        "y1": float(bbox.y1),
        "color_group": frame_color_group,
        "outline_style": frame_outline_style,
    }


def v111_refine_row_frame_specs(table, row_index: int, row_cells: list, frame_specs: list[dict]) -> list[dict]:
    if not frame_specs:
        return frame_specs

    y_lines = list(getattr(table, "y_lines", []) or [])

    if row_index < 0 or row_index + 1 >= len(y_lines):
        return frame_specs

    row_top = float(y_lines[row_index])
    row_bottom = float(y_lines[row_index + 1])
    x_candidates = v111_collect_precise_row_vertical_edges(table, row_top, row_bottom, row_cells)
    y_candidates = v111_collect_precise_row_horizontal_edges(table, row_top, row_bottom)

    if not x_candidates and not y_candidates:
        return frame_specs

    snapped_top = v111_snap_value_to_candidates(row_top, y_candidates, 3.5)
    snapped_bottom = v111_snap_value_to_candidates(row_bottom, y_candidates, 3.5)
    sorted_specs = sorted(frame_specs, key=lambda item: (float(item["x0"]), float(item["x1"])))
    previous_right = None

    for spec_index, spec in enumerate(sorted_specs):
        original_left = float(spec["x0"])
        original_right = float(spec["x1"])
        snapped_left = v111_snap_value_to_candidates(original_left, x_candidates, 4.5)
        snapped_right = v111_snap_value_to_candidates(original_right, x_candidates, 4.5)

        if previous_right is not None and snapped_left < previous_right:
            snapped_left = previous_right

        if snapped_right <= snapped_left + 1.0:
            snapped_right = max(snapped_left + 1.0, original_right)

        v111_refresh_frame_spec_bbox(spec, snapped_left, snapped_top, snapped_right, snapped_bottom)
        previous_right = snapped_right

    return sorted_specs


def v111_build_table_row_frame_bands_html(
    table,
    scale: float,
    band_index_start: int,
    frame_group_version: str = "v1.11",
) -> tuple[list[str], int]:
    y_lines = list(getattr(table, "y_lines", []) or [])
    total_rows = max(0, len(y_lines) - 1)
    rows = [[] for _ in range(total_rows)]
    next_band_index = band_index_start
    all_frame_specs = []

    for cell in sorted(getattr(table, "cells", []) or [], key=lambda item: (item.row_start, item.col_start, item.row_end, item.col_end)):
        row_index = max(0, min(total_rows - 1, int(getattr(cell, "row_start", 1) or 1) - 1))

        if total_rows > 0:
            setattr(cell, "_frame_table", table)
            rows[row_index].append(cell)

    for row_index in range(total_rows):
        row_top = float(y_lines[row_index])
        row_bottom = float(y_lines[row_index + 1])
        row_cells = rows[row_index]
        refinement_cells = v105_find_row_cells(table, row_top, row_bottom) or row_cells

        if not row_cells:
            continue

        frame_specs = v102_resolve_row_frame_specs(row_cells, next_band_index, frame_group_version)
        frame_specs = v111_refine_row_frame_specs(table, row_index, refinement_cells, frame_specs)

        if not frame_specs:
            continue

        all_frame_specs.extend(frame_specs)
        next_band_index += 1

    for block in getattr(table, "_v111_embedded_status_blocks", []) or []:
        block_spec = v111_build_embedded_block_frame_spec(block)

        if block_spec is not None:
            all_frame_specs.append(block_spec)

    mesh_fragment = v111_build_table_mesh_markup(
        scale,
        band_index_start,
        all_frame_specs,
        frame_group_version,
    )

    return ([mesh_fragment] if mesh_fragment else []), next_band_index


def v105_resolve_certificate_edge_clusters(
    values: list[float],
    score_fn,
    tolerance: float,
) -> list[float]:
    ordered = sorted(float(value) for value in values)

    if not ordered:
        return []

    clusters: list[list[float]] = [[ordered[0]]]

    for value in ordered[1:]:
        if abs(value - clusters[-1][-1]) <= tolerance:
            clusters[-1].append(value)
            continue

        clusters.append([value])

    resolved = []

    for cluster in clusters:
        best_value = cluster[0]
        best_score = score_fn(best_value)

        for candidate in cluster[1:]:
            candidate_score = score_fn(candidate)

            if candidate_score > best_score + 1e-6:
                best_value = candidate
                best_score = candidate_score
                continue

            if abs(candidate_score - best_score) <= 1e-6 and candidate > best_value:
                best_value = candidate

        resolved.append(best_value)

    return resolved


def v105_measure_vertical_line_score(table, x_value: float) -> float:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return 0.0

    total = 0.0

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "v":
            continue

        segment_x = (float(bbox.x0) + float(bbox.x1)) * 0.5

        if abs(segment_x - float(x_value)) <= 4.0:
            total += max(0.0, float(bbox.y1) - float(bbox.y0))

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        if abs(float(bbox.x0) - float(x_value)) <= 4.0 or abs(float(bbox.x1) - float(x_value)) <= 4.0:
            total += max(0.0, float(bbox.y1) - float(bbox.y0)) * 0.15

    return total


def v105_measure_horizontal_line_score(table, y_value: float) -> float:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return 0.0

    total = 0.0

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "h":
            continue

        segment_y = (float(bbox.y0) + float(bbox.y1)) * 0.5

        if abs(segment_y - float(y_value)) <= 4.0:
            total += max(0.0, float(bbox.x1) - float(bbox.x0))

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        if abs(float(bbox.y0) - float(y_value)) <= 4.0 or abs(float(bbox.y1) - float(y_value)) <= 4.0:
            total += max(0.0, float(bbox.x1) - float(bbox.x0)) * 0.15

    return total


def v105_resolve_certificate_x_edges(table) -> list[float]:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return []

    candidates = [float(table_bbox.x0), float(table_bbox.x1)]
    candidates.extend(float(value) for value in (getattr(table, "x_lines", []) or []))

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "v":
            continue

        candidates.append((float(bbox.x0) + float(bbox.x1)) * 0.5)

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        candidates.extend([float(bbox.x0), float(bbox.x1)])

    return v105_resolve_certificate_edge_clusters(candidates, lambda value: v105_measure_vertical_line_score(table, value), 6.0)


def v105_resolve_certificate_y_edges(table) -> list[float]:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return []

    candidates = [float(table_bbox.y0), float(table_bbox.y1)]
    candidates.extend(float(value) for value in (getattr(table, "y_lines", []) or []))

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "h":
            continue

        candidates.append((float(bbox.y0) + float(bbox.y1)) * 0.5)

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        candidates.extend([float(bbox.y0), float(bbox.y1)])

    return v105_resolve_certificate_edge_clusters(candidates, lambda value: v105_measure_horizontal_line_score(table, value), 5.0)


def v105_has_vertical_boundary(table, x_value: float, y0: float, y1: float, table_left: float, table_right: float) -> bool:
    if abs(float(x_value) - float(table_left)) <= 1.5 or abs(float(x_value) - float(table_right)) <= 1.5:
        return True

    span = max(1.0, float(y1) - float(y0))
    covered = 0.0
    center_y = (float(y0) + float(y1)) * 0.5

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "v":
            continue

        segment_x = (float(bbox.x0) + float(bbox.x1)) * 0.5

        if abs(segment_x - float(x_value)) > 4.0:
            continue

        overlap = max(0.0, min(float(bbox.y1), float(y1)) - max(float(bbox.y0), float(y0)))
        covered += overlap

        if overlap >= span * 0.55:
            return True

        if float(bbox.y0) - 1.5 <= center_y <= float(bbox.y1) + 1.5 and overlap >= span * 0.25:
            return True

    cell_coverage = 0.0
    cell_edge_matches = 0

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        if abs(float(bbox.x0) - float(x_value)) > 4.0 and abs(float(bbox.x1) - float(x_value)) > 4.0:
            continue

        overlap = max(0.0, min(float(bbox.y1), float(y1)) - max(float(bbox.y0), float(y0)))

        if overlap <= 0.0:
            continue

        cell_coverage += overlap
        cell_edge_matches += 1

        if overlap >= span * 0.4:
            return True

        if float(bbox.y0) - 1.5 <= center_y <= float(bbox.y1) + 1.5 and overlap >= span * 0.2:
            return True

    if covered >= span * 0.7:
        return True

    if cell_coverage >= span * 0.85:
        return True

    if any(abs(float(line_x) - float(x_value)) <= 4.0 for line_x in (getattr(table, "x_lines", []) or [])):
        if covered >= span * 0.18 or cell_coverage >= span * 0.18 or cell_edge_matches >= 1:
            return True

    return cell_edge_matches >= 2 and cell_coverage >= span * 0.45


def v105_has_horizontal_boundary(table, y_value: float, x0: float, x1: float, table_top: float, table_bottom: float) -> bool:
    if abs(float(y_value) - float(table_top)) <= 1.5 or abs(float(y_value) - float(table_bottom)) <= 1.5:
        return True

    span = max(1.0, float(x1) - float(x0))
    covered = 0.0
    center_x = (float(x0) + float(x1)) * 0.5

    for segment in getattr(table, "_source_frame_segments", []) or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "h":
            continue

        segment_y = (float(bbox.y0) + float(bbox.y1)) * 0.5

        if abs(segment_y - float(y_value)) > 4.0:
            continue

        overlap = max(0.0, min(float(bbox.x1), float(x1)) - max(float(bbox.x0), float(x0)))
        covered += overlap

        if overlap >= span * 0.55:
            return True

        if float(bbox.x0) - 1.5 <= center_x <= float(bbox.x1) + 1.5 and overlap >= span * 0.25:
            return True

    cell_coverage = 0.0
    cell_edge_matches = 0

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        if abs(float(bbox.y0) - float(y_value)) > 4.0 and abs(float(bbox.y1) - float(y_value)) > 4.0:
            continue

        overlap = max(0.0, min(float(bbox.x1), float(x1)) - max(float(bbox.x0), float(x0)))

        if overlap <= 0.0:
            continue

        cell_coverage += overlap
        cell_edge_matches += 1

        if overlap >= span * 0.4:
            return True

        if float(bbox.x0) - 1.5 <= center_x <= float(bbox.x1) + 1.5 and overlap >= span * 0.2:
            return True

    if covered >= span * 0.7:
        return True

    if cell_coverage >= span * 0.85:
        return True

    if any(abs(float(line_y) - float(y_value)) <= 4.0 for line_y in (getattr(table, "y_lines", []) or [])):
        if covered >= span * 0.18 or cell_coverage >= span * 0.18 or cell_edge_matches >= 1:
            return True

    return cell_edge_matches >= 2 and cell_coverage >= span * 0.45


def v105_resolve_frame_outline_style(table, x0: float, y0: float, x1: float, y1: float) -> str:
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return "dashed"

    table_left = float(table_bbox.x0)
    table_right = float(table_bbox.x1)
    table_top = float(table_bbox.y0)
    table_bottom = float(table_bbox.y1)
    has_left = v105_has_vertical_boundary(table, float(x0), float(y0), float(y1), table_left, table_right)
    has_right = v105_has_vertical_boundary(table, float(x1), float(y0), float(y1), table_left, table_right)
    has_top = v105_has_horizontal_boundary(table, float(y0), float(x0), float(x1), table_top, table_bottom)
    has_bottom = v105_has_horizontal_boundary(table, float(y1), float(x0), float(x1), table_top, table_bottom)
    return "solid" if has_left and has_right and has_top and has_bottom else "dashed"


def v105_select_overlapping_cell_for_bbox(table, x0: float, y0: float, x1: float, y1: float):
    best_cell = None
    best_area = 0.0

    for cell in getattr(table, "cells", []) or []:
        bbox = getattr(cell, "bbox", None) or getattr(cell, "rect", None)

        if bbox is None:
            continue

        overlap_w = max(0.0, min(float(bbox.x1), float(x1)) - max(float(bbox.x0), float(x0)))
        overlap_h = max(0.0, min(float(bbox.y1), float(y1)) - max(float(bbox.y0), float(y0)))
        overlap_area = overlap_w * overlap_h

        if overlap_area > best_area:
            best_area = overlap_area
            best_cell = cell

    return best_cell


def v105_simplify_row_certificate_edges(table, row_top: float, row_bottom: float, row_cells: list) -> list[float]:
    row_edges = v105_collect_row_vertical_edges(table, row_top, row_bottom, row_cells, prefer_source_segments=True)

    if len(row_edges) < 2:
        table_bbox = getattr(table, "bbox", None)

        if table_bbox is None:
            return []

        row_edges = [float(table_bbox.x0), float(table_bbox.x1)]

    return v105_resolve_certificate_edge_clusters(row_edges, lambda value: v105_measure_vertical_line_score(table, value), 6.0)


def v105_row_edge_signatures_match(left_edges: list[float], right_edges: list[float]) -> bool:
    if len(left_edges) != len(right_edges):
        return False

    return all(abs(float(left) - float(right)) <= 6.0 for left, right in zip(left_edges, right_edges))


def v105_build_certificate_group_mesh_specs(
    table,
    row_start_index: int,
    row_end_index: int,
    x_edges: list[float],
    band_index: int,
    frame_group_version: str = "v1.08",
) -> tuple[list[float], list[float], list[dict]]:
    table_bbox = getattr(table, "bbox", None)
    y_lines = list(getattr(table, "y_lines", []) or [])

    if table_bbox is None or row_start_index < 0 or row_end_index + 1 >= len(y_lines):
        return [], [], []

    y_edges = [float(value) for value in y_lines[row_start_index : row_end_index + 2]]

    if len(x_edges) < 2 or len(y_edges) < 2:
        return [], [], []

    col_count = len(x_edges) - 1
    row_count = len(y_edges) - 1
    parent = list(range(row_count * col_count))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left_index: int, right_index: int) -> None:
        left_root = find(left_index)
        right_root = find(right_index)

        if left_root != right_root:
            parent[right_root] = left_root

    for local_row_index in range(row_count):
        y0 = float(y_edges[local_row_index])
        y1 = float(y_edges[local_row_index + 1])

        for col_index in range(col_count):
            x0 = float(x_edges[col_index])
            x1 = float(x_edges[col_index + 1])
            current = local_row_index * col_count + col_index

            if col_index + 1 < col_count:
                boundary_x = float(x_edges[col_index + 1])

                if not v105_has_vertical_boundary(table, boundary_x, y0, y1, float(table_bbox.x0), float(table_bbox.x1)):
                    union(current, local_row_index * col_count + (col_index + 1))

            if local_row_index + 1 < row_count:
                boundary_y = float(y_edges[local_row_index + 1])

                if not v105_has_horizontal_boundary(table, boundary_y, x0, x1, float(table_bbox.y0), float(table_bbox.y1)):
                    union(current, (local_row_index + 1) * col_count + col_index)

    components: dict[int, list[tuple[int, int]]] = {}

    for local_row_index in range(row_count):
        for col_index in range(col_count):
            tile_index = local_row_index * col_count + col_index
            root = find(tile_index)
            components.setdefault(root, []).append((local_row_index, col_index))

    specs = []
    next_local_index = 1
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)

    for tiles in components.values():
        local_rows = [row_index for row_index, _ in tiles]
        col_indexes = [col_index for _, col_index in tiles]
        local_row_min = min(local_rows)
        local_row_max = max(local_rows)
        col_min = min(col_indexes)
        col_max = max(col_indexes)
        expected_tile_count = (local_row_max - local_row_min + 1) * (col_max - col_min + 1)

        if len(tiles) != expected_tile_count:
            continue

        x0 = float(x_edges[col_min])
        x1 = float(x_edges[col_max + 1])
        y0 = float(y_edges[local_row_min])
        y1 = float(y_edges[local_row_max + 1])
        overlap_cell = v105_select_overlapping_cell_for_bbox(table, x0, y0, x1, y1)
        frame_group_id = f"band-{band_index}-cell-{next_local_index}"
        frame_color_group = (
            frame_group_id
            if normalized_frame_group_version in ("v1.09", "v1.10", "v1.11")
            else v105_pick_frame_color_group(overlap_cell, frame_group_id)
        )
        frame_outline_style = v105_resolve_frame_outline_style(table, x0, y0, x1, y1)
        bbox = v102_make_bbox(x0, y0, x1, y1)
        font_pt = float(getattr(overlap_cell, "font_pt", 11.0) if overlap_cell is not None else 11.0)
        cell_like = SimpleNamespace(
            row_start=row_start_index + local_row_min + 1,
            row_end=row_start_index + local_row_max + 2,
            col_start=col_min + 1,
            col_end=col_max + 2,
            bbox=bbox,
            font_pt=font_pt,
            bold=bool(getattr(overlap_cell, "bold", False)) if overlap_cell is not None else False,
            align=getattr(overlap_cell, "align", "left") if overlap_cell is not None else "left",
            valign=getattr(overlap_cell, "valign", "top") if overlap_cell is not None else "top",
            _frame_group_id=frame_group_id,
            _frame_color_group=frame_color_group,
            _frame_source_text=str(getattr(overlap_cell, "text", "") or "").strip(),
            _frame_outline_style=frame_outline_style,
        )
        specs.append(
            {
                "cell": cell_like,
                "x0": x0,
                "x1": x1,
                "y0": y0,
                "y1": y1,
                "color_group": frame_color_group,
                "outline_style": frame_outline_style,
                "layout_row_start": local_row_min + 1,
                "layout_row_end": local_row_max + 2,
                "layout_col_start": col_min + 1,
                "layout_col_end": col_max + 2,
            }
        )
        next_local_index += 1

    if normalized_frame_group_version not in ("v1.09", "v1.10", "v1.11"):
        v105_apply_frame_spec_color_links(specs)
        v106_apply_frame_spec_semantics(specs)

    if normalized_frame_group_version == "v1.08":
        v108_apply_certificate_row_pair_semantics(specs)

    return x_edges, y_edges, specs


def v105_build_certificate_group_mesh_markup(
    table,
    scale: float,
    band_index: int,
    row_start_index: int,
    row_end_index: int,
    x_edges: list[float],
    frame_group_version: str = "v1.08",
) -> str:
    x_edges, y_edges, frame_specs = v105_build_certificate_group_mesh_specs(
        table,
        row_start_index,
        row_end_index,
        x_edges,
        band_index,
        frame_group_version,
    )

    if len(x_edges) < 2 or len(y_edges) < 2 or not frame_specs:
        return ""

    band_left = float(x_edges[0])
    band_top = float(y_edges[0])
    band_right = float(x_edges[-1])
    band_bottom = float(y_edges[-1])
    band_left_px = v103_snap_scaled_px(band_left, scale)
    band_top_px = v103_snap_scaled_px(band_top, scale)
    band_right_px = max(band_left_px + 1, v103_snap_scaled_px(band_right, scale))
    band_bottom_px = max(band_top_px + 1, v103_snap_scaled_px(band_bottom, scale))
    band_width_px = band_right_px - band_left_px
    band_height_px = band_bottom_px - band_top_px

    col_edges_px = [v103_snap_scaled_px(value, scale) for value in x_edges]
    row_edges_px = [v103_snap_scaled_px(value, scale) for value in y_edges]
    col_edges_px[0] = band_left_px
    col_edges_px[-1] = band_right_px
    row_edges_px[0] = band_top_px
    row_edges_px[-1] = band_bottom_px

    col_widths_px = [max(1, right_px - left_px) for left_px, right_px in zip(col_edges_px, col_edges_px[1:])]
    row_heights_px = [max(1, bottom_px - top_px) for top_px, bottom_px in zip(row_edges_px, row_edges_px[1:])]
    frame_specs_by_origin = {}
    color_group_indexes = v102_resolve_color_group_indexes(frame_specs)
    band_outline_style = v102_resolve_band_outline_style(frame_specs, frame_group_version)
    band_border_color = "rgba(15, 23, 42, 0.34)" if band_outline_style == "dashed" else "rgba(15, 23, 42, 0.55)"
    band_border_css = f" border:1px {band_outline_style} {band_border_color};" if band_outline_style == "dashed" else ""

    for spec in frame_specs:
        frame_specs_by_origin[(int(spec["layout_row_start"]), int(spec["layout_col_start"]))] = spec

    occupied = set()
    rows_html = []

    for local_row_index in range(1, len(y_edges)):
        row_color = v102_pick_palette_color(V102_ROW_COLOR_PALETTE, band_index + local_row_index - 1)
        cells_html = []

        for local_col_index in range(1, len(x_edges)):
            if (local_row_index, local_col_index) in occupied:
                continue

            spec = frame_specs_by_origin.get((local_row_index, local_col_index))

            if spec is None:
                continue

            cell = spec["cell"]
            local_row_end = int(spec["layout_row_end"])
            local_col_end = int(spec["layout_col_end"])
            rowspan = max(1, local_row_end - local_row_index)
            colspan = max(1, local_col_end - local_col_index)

            for covered_row in range(local_row_index, local_row_end):
                for covered_col in range(local_col_index, local_col_end):
                    if covered_row == local_row_index and covered_col == local_col_index:
                        continue
                    occupied.add((covered_row, covered_col))

            font_px = clamp(float(getattr(cell, "font_pt", 11.0) or 11.0) * scale, 10.5, 18.0)
            font_weight = 700 if getattr(cell, "bold", False) else 400
            color_group = str(spec.get("color_group") or getattr(cell, "_frame_color_group", "") or getattr(cell, "_frame_group_id", "") or "")
            color_index = color_group_indexes.get(color_group, len(color_group_indexes))
            col_color = v102_pick_palette_color(V102_COL_COLOR_PALETTE, color_index)
            span_attr = ""
            border_style = ""

            if rowspan > 1:
                span_attr += f' rowspan="{rowspan}"'

            if colspan > 1:
                span_attr += f' colspan="{colspan}"'

            if local_col_index > 1:
                border_style += f" border-left:1px {band_outline_style} {band_border_color};"

            if local_row_index > 1:
                border_style += f" border-top:1px {band_outline_style} {band_border_color};"

            cells_html.append(
                f'{v202_build_frame_group_td_open_tag(cell, "halign-left valign-top", f"font-size:{font_px:.2f}px; font-weight:{font_weight}; --v102-row-color:{row_color}; --v102-col-color:{col_color};{border_style}", span_attr.strip())}'
                f'{v202_build_frame_group_html(cell)}'
                '</td>'
            )

        rows_html.append(f'<tr style="height:{row_heights_px[local_row_index - 1]}px;">{"".join(cells_html)}</tr>')

    colgroup_html = "".join(f'<col style="width:{max(1, width_px)}px">' for width_px in col_widths_px)

    return (
        f'<div class="v102-frame-band" style="left:{band_left_px}px; top:{band_top_px}px; '
        f'width:{band_width_px}px; height:{band_height_px}px;">'
        f'<table class="v202-table-block v102-frame-band-table" style="width:{band_width_px}px; height:{band_height_px}px;{band_border_css}">'
        f'<colgroup>{colgroup_html}</colgroup>'
        f'<tbody style="--v102-row-color:{v102_pick_palette_color(V102_ROW_COLOR_PALETTE, band_index)};">'
        f'{"".join(rows_html)}'
        '</tbody></table></div>'
    )


def v105_build_certificate_table_mesh_fragments(
    table,
    scale: float,
    band_index_start: int,
    frame_group_version: str = "v1.08",
) -> tuple[list[str], int]:
    y_lines = list(getattr(table, "y_lines", []) or [])
    row_count = max(0, len(y_lines) - 1)

    if row_count <= 0:
        return [], band_index_start

    row_edge_signatures = []

    for row_index in range(row_count):
        row_top = float(y_lines[row_index])
        row_bottom = float(y_lines[row_index + 1])
        row_cells = v105_find_row_cells(table, row_top, row_bottom)
        row_edge_signatures.append(v105_simplify_row_certificate_edges(table, row_top, row_bottom, row_cells))

    fragments = []
    next_band_index = band_index_start
    group_start = 0

    while group_start < row_count:
        group_edges = row_edge_signatures[group_start]
        group_end = group_start

        while group_end + 1 < row_count and v105_row_edge_signatures_match(group_edges, row_edge_signatures[group_end + 1]):
            group_end += 1

        group_fragment = v105_build_certificate_group_mesh_markup(
            table,
            scale,
            next_band_index,
            group_start,
            group_end,
            group_edges,
            frame_group_version,
        )

        if group_fragment:
            fragments.append(group_fragment)
            next_band_index += 1

        group_start = group_end + 1

    return fragments, next_band_index


def v105_is_certificate_like_scanned_page(page, frame_bounds) -> bool:
    if page is None or not frame_bounds:
        return False

    tables = list(getattr(page, "tables", []) or [])

    if len(tables) != 1:
        return False

    table = tables[0]
    table_bbox = getattr(table, "bbox", None)

    if table_bbox is None:
        return False

    if float(table_bbox.width) < float(getattr(page, "width", 0.0) or 0.0) * 0.72:
        return False

    if float(table_bbox.height) < float(getattr(page, "height", 0.0) or 0.0) * 0.55:
        return False

    if float(table_bbox.y0) < float(getattr(page, "height", 0.0) or 0.0) * 0.1:
        return False

    if len(getattr(table, "cells", []) or []) < 20:
        return False

    top_region_text_lines = [
        line
        for line in (getattr(page, "text_lines", []) or [])
        if getattr(line, "bbox", None) is not None and float(line.bbox.y1) <= float(table_bbox.y0) - 4.0
    ]

    if len(top_region_text_lines) > 3:
        return False

    return True


def v105_build_implicit_certificate_header_band_html(page, table, scale: float, band_index: int) -> str:
    table_bbox = getattr(table, "bbox", None)
    y_lines = list(getattr(table, "y_lines", []) or [])

    if table_bbox is None or len(y_lines) < 2:
        return ""

    first_row_top = float(y_lines[0])
    first_row_bottom = float(y_lines[1])
    first_row_cells = v105_find_row_cells(table, first_row_top, first_row_bottom)
    edges = v105_collect_row_vertical_edges(table, first_row_top, first_row_bottom, first_row_cells)

    if len(edges) < 4:
        return ""

    top_candidates = []

    for block in [*(getattr(page, "raster_blocks", []) or []), *(getattr(page, "text_lines", []) or [])]:
        bbox = getattr(block, "bbox", None)

        if bbox is None:
            continue

        if float(bbox.y1) <= float(table_bbox.y0) - 4.0:
            top_candidates.append(float(bbox.y0))

    estimated_top = float(table_bbox.y0) - max(54.0, (first_row_bottom - first_row_top) * 2.4)
    header_top = max(18.0, min(top_candidates) if top_candidates else estimated_top)
    header_bottom = float(table_bbox.y0)

    if header_bottom - header_top < 20.0:
        return ""

    header_specs = []

    for local_index, (x0, x1) in enumerate(zip(edges, edges[1:]), start=1):
        if x1 - x0 < 8.0:
            continue

        if local_index == 1:
            color_group = "증명서 상단 좌측"
        elif local_index == len(edges) - 1:
            color_group = "증명서 상단 우측"
        else:
            color_group = "증명서 상단 제목"

        cell_like = SimpleNamespace(
            row_start=1,
            row_end=2,
            col_start=local_index,
            col_end=local_index + 1,
            bbox=v102_make_bbox(x0, header_top, x1, header_bottom),
            font_pt=11.0,
            bold=local_index == 2,
            align="left" if local_index != 2 else "center",
            valign="top",
            _frame_group_id=f"band-{band_index}-header-cell-{local_index}",
            _frame_color_group=color_group,
        )
        header_specs.append(
            {
                "cell": cell_like,
                "x0": x0,
                "x1": x1,
                "y0": header_top,
                "y1": header_bottom,
                "color_group": color_group,
            }
        )

    if not header_specs:
        return ""

    return v103_build_frame_band_markup(
        header_specs,
        scale,
        band_index,
        frame_group_version=frame_group_version,
        top=header_top,
        bottom=header_bottom,
    )


def v105_build_table_row_frame_bands_html(
    table,
    scale: float,
    band_index_start: int,
    frame_group_version: str = "v1.08",
) -> tuple[list[str], int]:
    y_lines = list(getattr(table, "y_lines", []) or [])
    total_rows = max(0, len(y_lines) - 1)
    fragments = []
    next_band_index = band_index_start

    for row_index in range(total_rows):
        frame_specs = v105_build_row_local_frame_specs(table, row_index, next_band_index, frame_group_version)

        if not frame_specs:
            continue

        fragments.append(v103_build_frame_band_markup(frame_specs, scale, next_band_index, frame_group_version=frame_group_version))
        next_band_index += 1

    return fragments, next_band_index


def v102_build_table_row_frame_bands_html(
    table,
    scale: float,
    band_index_start: int,
    frame_group_version: str = "v1.08",
    use_v105_row_local_grid: bool = False,
) -> tuple[list[str], int]:
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)

    if normalized_frame_group_version == "v1.11" and not use_v105_row_local_grid:
        return v111_build_table_row_frame_bands_html(table, scale, band_index_start, frame_group_version)

    if normalized_frame_group_version in ("v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11") and use_v105_row_local_grid:
        mesh_fragments, next_band_index = v105_build_certificate_table_mesh_fragments(table, scale, band_index_start, frame_group_version)

        if mesh_fragments:
            return mesh_fragments, next_band_index

        return v105_build_table_row_frame_bands_html(table, scale, band_index_start, frame_group_version)

    total_rows = max(0, len(getattr(table, "y_lines", []) or []) - 1)
    rows = [[] for _ in range(total_rows)]

    for cell in sorted(getattr(table, "cells", []) or [], key=lambda item: (item.row_start, item.col_start, item.row_end, item.col_end)):
        row_index = max(0, min(total_rows - 1, int(getattr(cell, "row_start", 1) or 1) - 1))

        if total_rows > 0:
            setattr(cell, "_frame_table", table)
            rows[row_index].append(cell)

    fragments = []
    next_band_index = band_index_start

    for row_cells in rows:
        if not row_cells:
            continue

        frame_specs = v102_resolve_row_frame_specs(row_cells, next_band_index, frame_group_version)

        if not frame_specs:
            continue

        if normalized_frame_group_version in ("v1.03", "v1.04", "v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11"):
            fragments.append(v103_build_frame_band_markup(frame_specs, scale, next_band_index, frame_group_version=frame_group_version))
        else:
            fragments.append(v102_build_frame_band_markup(frame_specs, scale, next_band_index, frame_group_version=frame_group_version))
        next_band_index += 1

    return fragments, next_band_index


def v111_build_source_frame_segment_overlay_html(page, scale: float, frame_group_version: str) -> str:
    if normalize_frame_group_version(frame_group_version) != "v1.11":
        return ""

    source_segments = list(getattr(page, "_source_frame_segments", []) or [])

    if not source_segments:
        return ""

    fragments = []

    for segment in source_segments:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation not in {"h", "v"}:
            continue

        thickness_px = max(
            1.0,
            float(getattr(segment, "thickness", V202_FRAME_STROKE_WIDTH) or V202_FRAME_STROKE_WIDTH) * scale,
        )

        if orientation == "h":
            left_px = float(bbox.x0) * scale
            top_px = ((float(bbox.y0) + float(bbox.y1)) * 0.5) * scale - thickness_px * 0.5
            width_px = max(1.0, float(bbox.width) * scale)
            fragments.append(
                f'<div class="v111-source-frame-segment" data-template-frame-segment="h" '
                f'style="left:{left_px:.2f}px; top:{top_px:.2f}px; width:{width_px:.2f}px; height:{thickness_px:.2f}px;"></div>'
            )
            continue

        left_px = ((float(bbox.x0) + float(bbox.x1)) * 0.5) * scale - thickness_px * 0.5
        top_px = float(bbox.y0) * scale
        height_px = max(1.0, float(bbox.height) * scale)
        fragments.append(
            f'<div class="v111-source-frame-segment" data-template-frame-segment="v" '
            f'style="left:{left_px:.2f}px; top:{top_px:.2f}px; width:{thickness_px:.2f}px; height:{height_px:.2f}px;"></div>'
        )

    if not fragments:
        return ""

def v102_build_frame_groups_page_html(
    page,
    scale: float,
    clone_id: str,
    frame_group_version: str = "v1.08",
) -> str:
    band_fragments = []
    band_index = 0
    frame_bounds = v202_resolve_page_frame_bounds(page)
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)
    certificate_like_page = normalized_frame_group_version in ("v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11") and v105_is_certificate_like_scanned_page(page, frame_bounds)
    embedded_status_block_ids = set()

    if normalized_frame_group_version == "v1.11":
        status_blocks = list(getattr(page, "_v104_status_value_blocks", []) or [])
        tables = list(getattr(page, "tables", []) or [])

        for table in tables:
            setattr(table, "_v111_embedded_status_blocks", [])

        for block in status_blocks:
            block_bbox = getattr(block, "bbox", None)

            if block_bbox is None:
                continue

            block_center_x = (float(block_bbox.x0) + float(block_bbox.x1)) * 0.5
            block_center_y = (float(block_bbox.y0) + float(block_bbox.y1)) * 0.5

            for table in tables:
                table_bbox = getattr(table, "bbox", None)

                if table_bbox is None:
                    continue

                if not (
                    float(table_bbox.x0) - 2.0 <= block_center_x <= float(table_bbox.x1) + 2.0
                    and float(table_bbox.y0) - 2.0 <= block_center_y <= float(table_bbox.y1) + 2.0
                ):
                    continue

                blocks = list(getattr(table, "_v111_embedded_status_blocks", []) or [])
                blocks.append(block)
                setattr(table, "_v111_embedded_status_blocks", blocks)
                embedded_status_block_ids.add(id(block))
                break

    if frame_bounds:
        for block in v202_collect_outside_region_blocks(page, frame_bounds, "top"):
            band_fragments.append(
                v102_build_region_frame_band_html(block, scale, band_index, f"band-{band_index}-header", frame_group_version)
            )
            band_index += 1

        if normalized_frame_group_version in ("v1.04", "v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11") and not certificate_like_page:
            for block in getattr(page, "_v104_status_value_blocks", []) or []:
                if normalized_frame_group_version == "v1.11" and id(block) in embedded_status_block_ids:
                    band_index += 1
                    continue

                frame_group_id = str(getattr(block, "_frame_group_id", "") or f"band-{band_index}-status")
                band_fragments.append(
                    v102_build_region_frame_band_html(block, scale, band_index, frame_group_id, frame_group_version)
                )
                band_index += 1

    for table in getattr(page, "tables", []) or []:
        table_fragments, band_index = v102_build_table_row_frame_bands_html(
            table,
            scale,
            band_index,
            frame_group_version,
            use_v105_row_local_grid=certificate_like_page,
        )
        band_fragments.extend(table_fragments)

    if frame_bounds:
        for block in v202_collect_outside_region_blocks(page, frame_bounds, "bottom"):
            band_fragments.append(
                v102_build_region_frame_band_html(block, scale, band_index, f"band-{band_index}-footer", frame_group_version)
            )
            band_index += 1

    page_width_px = v103_snap_scaled_px(page.width, scale) if normalize_frame_group_version(frame_group_version) in ("v1.03", "v1.04", "v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11") else page.width * scale
    page_height_px = v103_snap_scaled_px(page.height, scale) if normalize_frame_group_version(frame_group_version) in ("v1.03", "v1.04", "v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11") else page.height * scale
    return (
        f'<section class="page" data-page="{getattr(page, "number", 1)}" '
        f'style="width:{page_width_px:.2f}px; min-height:{page_height_px:.2f}px;">'
        '<div class="page-inner">'
        + "".join(fragment for fragment in band_fragments if fragment)
        + '</div></section>'
    )


def v202_build_page_html(
    page,
    scale: float,
    clone_id: str,
    extraction_stage: str = "full",
    frame_group_version: str = "v1.08",
) -> str:
    normalized_stage = normalize_extraction_stage(extraction_stage)
    frame_only = normalized_stage == "frames"
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)

    if frame_only and normalized_frame_group_version in ("v1.02", "v1.03", "v1.04", "v1.05", "v1.06", "v1.07", "v1.08", "v1.09", "v1.10", "v1.11"):
        return v102_build_frame_groups_page_html(page, scale, clone_id, frame_group_version)

    frame_bounds = v202_resolve_page_frame_bounds(page)

    if frame_bounds:
        page_width_px = page.width * scale
        header_blocks = [] if frame_only else v202_collect_outside_region_blocks(page, frame_bounds, "top")
        footer_blocks = [] if frame_only else v202_collect_outside_region_blocks(page, frame_bounds, "bottom")

        header_top = min((float(block.bbox.y0) for block in header_blocks), default=0.0)
        header_bottom = max((float(block.bbox.y1) for block in header_blocks), default=frame_bounds["top"])
        footer_top = min((float(block.bbox.y0) for block in footer_blocks), default=frame_bounds["bottom"])
        footer_bottom = max((float(block.bbox.y1) for block in footer_blocks), default=frame_bounds["bottom"])

        header_html = ""

        if header_blocks:
            header_children = "".join(
                v22_build_region_block_html(block, scale, header_top, page.width, clone_id)
                for block in sorted(header_blocks, key=lambda item: (item.bbox.y0, item.bbox.x0))
            )
            header_html = (
                f'<div class="v211-page-region" '
                f'style="min-height:{max(0.0, (header_bottom - header_top) * scale):.2f}px; '
                f'margin-top:{max(0.0, header_top * scale):.2f}px;">'
                f'{header_children}'
                '</div>'
            )

        frame_fragments = []
        previous_table_bottom = None

        for table in getattr(page, "tables", []) or []:
            table_html, previous_table_bottom = v202_build_table_flow_html(
                table,
                scale,
                frame_bounds,
                previous_table_bottom,
                clone_id,
                normalized_stage,
            )
            frame_fragments.append(table_html)

        frame_margin_top = max(0.0, (frame_bounds["top"] - header_bottom) * scale)
        frame_html = (
            f'<div class="v211-frame-stack" '
            f'style="margin-top:{frame_margin_top:.2f}px; margin-left:{frame_bounds["left"] * scale:.2f}px; '
            f'width:{frame_bounds["width"] * scale:.2f}px; min-height:{frame_bounds["height"] * scale:.2f}px;">'
            f'{"".join(frame_fragments)}'
            '</div>'
        )

        footer_html = ""

        if footer_blocks:
            footer_children = "".join(
                v22_build_region_block_html(block, scale, footer_top, page.width, clone_id)
                for block in sorted(footer_blocks, key=lambda item: (item.bbox.y0, item.bbox.x0))
            )
            footer_html = (
                f'<div class="v211-page-region" '
                f'style="min-height:{max(0.0, (footer_bottom - footer_top) * scale):.2f}px; '
                f'margin-top:{max(0.0, (footer_top - frame_bounds["bottom"]) * scale):.2f}px;">'
                f'{footer_children}'
                '</div>'
            )

        return (
            f'<section class="page" data-page="{getattr(page, "number", 1)}" '
            f'style="width:{page_width_px:.2f}px; min-height:{page.height * scale:.2f}px;">'
            '<div class="page-inner">'
            f'{header_html}{frame_html}{footer_html}'
            '</div></section>'
        )

    items = []
    existing_text_blocks = []

    for table in getattr(page, "tables", []) or []:
        items.append((table.bbox.y0, table.bbox.x0, v202_build_table_html(table, scale, clone_id, normalized_stage)))

    if frame_only:
        items.sort(key=lambda entry: (entry[0], entry[1]))

        return (
            f'<section class="page" data-page="{getattr(page, "number", 1)}" '
            f'style="width:{page.width * scale:.2f}px; min-height:{page.height * scale:.2f}px;">'
            + "".join(item[2] for item in items)
            + '</section>'
        )

    for block in getattr(page, "text_blocks", []) or []:
        items.append((block.bbox.y0, block.bbox.x0, v202_build_text_block_html(block, scale)))
        existing_text_blocks.append(block)

    raster_blocks = [
        block
        for block in (getattr(page, "raster_blocks", []) or [])
        if v202_normalize_whitespace(getattr(block, "text", "") or "")
    ]

    if raster_blocks:
        for block in raster_blocks:
            items.append((block.bbox.y0, block.bbox.x0, v202_build_text_block_html(block, scale)))
            existing_text_blocks.append(block)

    for line in getattr(page, "text_lines", []) or []:
        normalized_text = v202_normalize_whitespace(getattr(line, "text", "") or "")

        if not normalized_text or v202_is_duplicate_line_block(line, existing_text_blocks):
            continue

        items.append((line.bbox.y0, line.bbox.x0, v202_build_text_block_html(line, scale)))
        existing_text_blocks.append(line)

    items.sort(key=lambda entry: (entry[0], entry[1]))

    return (
        f'<section class="page" data-page="{getattr(page, "number", 1)}" '
        f'style="width:{page.width * scale:.2f}px; min-height:{page.height * scale:.2f}px;">'
        '<div class="page-inner">'
        + "".join(item[2] for item in items)
        + '</div></section>'
    )


def v202_build_structured_section(
    pages: list,
    title: str,
    scale: float,
    clone_id: str,
    render_model: dict,
    extraction_stage: str = "full",
    frame_group_version: str = "v1.08",
) -> str:
    normalized_stage = normalize_extraction_stage(extraction_stage)
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)
    frame_group_version_tag = resolve_frame_group_version_tag(frame_group_version)
    render_model_json = json.dumps(render_model, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    pages_html = "".join(
        v202_build_page_html(page, scale, clone_id, normalized_stage, frame_group_version_tag)
        for page in pages
    )

    if normalized_stage == "frames":
        return f'''<section data-template-extract-draft="true" data-template-clone="{clone_id}" data-template-extraction-stage="{normalized_stage}" data-template-frame-group-version="{frame_group_version_tag}" class="template-clone template-clone--raster-first-v2-structured" data-template-clone-id="{clone_id}">
  <script type="application/json" data-template-render-model="positioned-v1">{render_model_json}</script>
{V202_STRUCTURED_DOM_STYLE}
{V202_STRUCTURED_DOM_SCRIPT}
{pages_html}
</section>'''

    return f'''<section data-template-extract-draft="true" data-template-clone="{clone_id}" data-template-extraction-stage="{normalized_stage}" data-template-frame-group-version="{frame_group_version_tag}">
  <script type="application/json" data-template-render-model="positioned-v1">{render_model_json}</script>
  <div class="template-clone template-clone--raster-first-v2-structured" data-template-clone-id="{clone_id}" data-template-extraction-stage="{normalized_stage}" data-template-frame-group-version="{frame_group_version_tag}">
{V202_STRUCTURED_DOM_STYLE}
{V202_STRUCTURED_DOM_SCRIPT}
    <div class="viewer">
{pages_html}
    </div>
  </div>
</section>'''


def resolve_engine_config(engine_version: str) -> dict:
    normalized = str(engine_version or DEFAULT_ENGINE_VERSION).strip()
    return ENGINE_CONFIGS.get(normalized, ENGINE_CONFIGS[DEFAULT_ENGINE_VERSION])


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


def v202_rect_intersects_bounds(bounds: dict, rect, pad: float = 0.0) -> bool:
    rect_x0 = float(getattr(rect, "x0", 0.0)) - pad
    rect_y0 = float(getattr(rect, "y0", 0.0)) - pad
    rect_x1 = float(getattr(rect, "x1", 0.0)) + pad
    rect_y1 = float(getattr(rect, "y1", 0.0)) + pad
    return not (
        rect_x1 < bounds["left"]
        or rect_x0 > bounds["right"]
        or rect_y1 < bounds["top"]
        or rect_y0 > bounds["bottom"]
    )


def attach_reference_frame_geometry(reference_converter, page, visual_page, raster_scale: float, ocr_lang: str) -> None:
    try:
        _, gray, binary_inv = reference_converter.render_page_raster(page, raster_scale)
        words = reference_converter.extract_words(page, gray, raster_scale, ocr_lang)
        h_segments, v_segments, _ = reference_converter.detect_segments(binary_inv, raster_scale, words)
    except Exception:
        return

    raw_segments = [*h_segments, *v_segments]
    setattr(visual_page, "_source_frame_segments", raw_segments)
    setattr(visual_page, "_source_words", words)

    for table in getattr(visual_page, "tables", []) or []:
        table_bounds = v202_resolve_table_frame_bounds(table)
        selected_segments = []

        for segment in raw_segments:
            segment_bbox = getattr(segment, "bbox", None)

            if segment_bbox is None:
                continue

            if v202_rect_intersects_bounds(table_bounds, segment_bbox, 1.5):
                selected_segments.append(segment)

        setattr(table, "_source_frame_segments", selected_segments)

        for cell in getattr(table, "cells", []) or []:
            cell_rect = getattr(cell, "rect", None) or getattr(cell, "bbox", None)

            if cell_rect is None:
                continue

            selected_words = []

            for word in words:
                word_bbox = getattr(word, "bbox", None)

                if word_bbox is None:
                    continue

                if v202_rect_intersects_bounds(
                    {
                        "left": float(cell_rect.x0),
                        "top": float(cell_rect.y0),
                        "right": float(cell_rect.x1),
                        "bottom": float(cell_rect.y1),
                    },
                    word_bbox,
                    1.2,
                ):
                    selected_words.append(word)

            setattr(cell, "_source_words", v202_sort_source_words(selected_words))


def v104_infer_container_bbox_from_frame_segments(target_bbox, source_segments, frame_bounds):
    if target_bbox is None:
        return target_bbox

    left = float(target_bbox.x0)
    top = float(target_bbox.y0)
    right = float(target_bbox.x1)
    bottom = float(target_bbox.y1)
    center_x = (left + right) / 2.0
    center_y = (top + bottom) / 2.0
    usable_segments = list(source_segments or [])

    if not usable_segments:
        return target_bbox

    vertical_candidates = []
    horizontal_candidates = []

    for segment in usable_segments:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None:
            continue

        if orientation == "v":
            overlap_y = v202_bbox_overlap_ratio(float(bbox.y0), float(bbox.y1), top, bottom)
            covers_center_y = float(bbox.y0) - 3.0 <= center_y <= float(bbox.y1) + 3.0

            if overlap_y >= 0.15 or covers_center_y:
                vertical_candidates.append(((float(bbox.x0) + float(bbox.x1)) / 2.0, bbox))
        elif orientation == "h":
            overlap_x = v202_bbox_overlap_ratio(float(bbox.x0), float(bbox.x1), left, right)
            covers_center_x = float(bbox.x0) - 3.0 <= center_x <= float(bbox.x1) + 3.0

            if overlap_x >= 0.15 or covers_center_x:
                horizontal_candidates.append(((float(bbox.y0) + float(bbox.y1)) / 2.0, bbox))

    left_candidates = [x for x, _ in vertical_candidates if x <= left + 8.0]
    right_candidates = [x for x, _ in vertical_candidates if x >= right - 8.0]
    resolved_left = max(left_candidates) if left_candidates else float(frame_bounds.get("left", left))
    resolved_right = min(right_candidates) if right_candidates else float(frame_bounds.get("right", right))

    horizontal_overlap_target_left = min(resolved_left, resolved_right)
    horizontal_overlap_target_right = max(resolved_left, resolved_right)
    filtered_horizontals = []

    for y, bbox in horizontal_candidates:
        overlap_ratio = v202_bbox_overlap_ratio(
            float(bbox.x0),
            float(bbox.x1),
            horizontal_overlap_target_left,
            horizontal_overlap_target_right,
        )
        covers_center_x = float(bbox.x0) - 3.0 <= center_x <= float(bbox.x1) + 3.0

        if overlap_ratio >= 0.45 or covers_center_x:
            filtered_horizontals.append((y, bbox))

    top_candidates = [y for y, _ in filtered_horizontals if y <= top + 8.0]
    bottom_candidates = [y for y, _ in filtered_horizontals if y >= bottom - 8.0]
    resolved_top = max(top_candidates) if top_candidates else float(frame_bounds.get("top", top))
    resolved_bottom = min(bottom_candidates) if bottom_candidates else float(frame_bounds.get("bottom", bottom))

    if resolved_left >= resolved_right:
        resolved_left = float(frame_bounds.get("left", left))
        resolved_right = float(frame_bounds.get("right", right))

    if resolved_top >= resolved_bottom:
        resolved_top = float(frame_bounds.get("top", top))
        resolved_bottom = float(frame_bounds.get("bottom", bottom))

    return v102_make_bbox(resolved_left, resolved_top, resolved_right, resolved_bottom)


def v104_has_vertical_segment_boundary(source_segments, x_value: float, y0: float, y1: float) -> bool:
    span = max(1.0, float(y1) - float(y0))
    covered = 0.0
    center_y = (float(y0) + float(y1)) * 0.5

    for segment in source_segments or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "v":
            continue

        segment_x = (float(bbox.x0) + float(bbox.x1)) * 0.5

        if abs(segment_x - float(x_value)) > 4.0:
            continue

        overlap = max(0.0, min(float(bbox.y1), float(y1)) - max(float(bbox.y0), float(y0)))
        covered += overlap

        if overlap >= span * 0.55:
            return True

        if float(bbox.y0) - 1.5 <= center_y <= float(bbox.y1) + 1.5 and overlap >= span * 0.25:
            return True

    return covered >= span * 0.7


def v104_has_horizontal_segment_boundary(source_segments, y_value: float, x0: float, x1: float) -> bool:
    span = max(1.0, float(x1) - float(x0))
    covered = 0.0
    center_x = (float(x0) + float(x1)) * 0.5

    for segment in source_segments or []:
        bbox = getattr(segment, "bbox", None)
        orientation = str(getattr(segment, "orientation", "") or "").lower()

        if bbox is None or orientation != "h":
            continue

        segment_y = (float(bbox.y0) + float(bbox.y1)) * 0.5

        if abs(segment_y - float(y_value)) > 4.0:
            continue

        overlap = max(0.0, min(float(bbox.x1), float(x1)) - max(float(bbox.x0), float(x0)))
        covered += overlap

        if overlap >= span * 0.55:
            return True

        if float(bbox.x0) - 1.5 <= center_x <= float(bbox.x1) + 1.5 and overlap >= span * 0.25:
            return True

    return covered >= span * 0.7


def v104_resolve_outline_style_from_source_segments(target_bbox, source_segments) -> str:
    if target_bbox is None:
        return "dashed"

    usable_segments = list(source_segments or [])

    if not usable_segments:
        return "dashed"

    x0 = float(target_bbox.x0)
    y0 = float(target_bbox.y0)
    x1 = float(target_bbox.x1)
    y1 = float(target_bbox.y1)
    has_left = v104_has_vertical_segment_boundary(usable_segments, x0, y0, y1)
    has_right = v104_has_vertical_segment_boundary(usable_segments, x1, y0, y1)
    has_top = v104_has_horizontal_segment_boundary(usable_segments, y0, x0, x1)
    has_bottom = v104_has_horizontal_segment_boundary(usable_segments, y1, x0, x1)
    return "solid" if has_left and has_right and has_top and has_bottom else "dashed"


def v104_extract_status_value_blocks_from_fitz_page(fitz_page, visual_page, frame_bounds) -> list:
    if fitz_page is None or visual_page is None or not frame_bounds:
        return []

    try:
        raw_words = fitz_page.get_text("words") or []
    except Exception:
        return []

    top_limit = float(frame_bounds.get("top", 0.0)) + 64.0
    candidate_words = [
        word
        for word in raw_words
        if len(word) >= 8
        and float(word[1]) <= top_limit
        and str(word[4] or "").strip()
    ]

    if not candidate_words:
        return []

    normalized_words = []

    for word in candidate_words:
        x0 = float(word[0])
        y0 = float(word[1])
        x1 = float(word[2])
        y1 = float(word[3])
        normalized_words.append(
            {
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "cy": (y0 + y1) / 2.0,
                "height": max(1.0, y1 - y0),
                "text": str(word[4] or "").strip(),
            }
        )

    line_candidates = []
    anchored_words = [word for word in normalized_words if re.fullmatch(r"[A-Z]{2,5}", word["text"] or "")]

    for anchor in sorted(anchored_words, key=lambda item: (item["cy"], item["x0"])):
        words = [
            candidate
            for candidate in normalized_words
            if candidate["x0"] >= anchor["x0"] - 4.0
            and abs(candidate["cy"] - anchor["cy"]) <= max(anchor["height"], candidate["height"]) * 0.6 + 1.5
        ]
        sorted_words = sorted(words, key=lambda item: item["x0"])
        line_text = v202_normalize_whitespace(" ".join(word["text"] for word in sorted_words))

        if not V202_STATUS_LINE_REGEX.match(line_text):
            continue

        x0 = min(word["x0"] for word in sorted_words)
        y0 = min(word["y0"] for word in sorted_words)
        x1 = max(word["x1"] for word in sorted_words)
        y1 = max(word["y1"] for word in sorted_words)
        line_candidates.append(
            {
                "text": line_text,
                "bbox": v102_make_bbox(x0, y0, x1, y1),
            }
        )

    if not line_candidates:
        return []

    line_candidates.sort(key=lambda item: (float(item["bbox"].y0), float(item["bbox"].x0)))
    clusters = []

    for candidate in line_candidates:
        if not clusters:
            clusters.append([candidate])
            continue

        previous = clusters[-1][-1]
        previous_bbox = previous["bbox"]
        current_bbox = candidate["bbox"]
        vertical_gap = float(current_bbox.y0) - float(previous_bbox.y1)
        horizontal_overlap = v202_bbox_overlap_ratio(
            float(previous_bbox.x0),
            float(previous_bbox.x1),
            float(current_bbox.x0),
            float(current_bbox.x1),
        )
        aligned_left = abs(float(previous_bbox.x0) - float(current_bbox.x0)) <= 42.0
        close_enough = vertical_gap <= max(float(previous_bbox.height), float(current_bbox.height)) * 1.35 + 6.0

        if close_enough and (horizontal_overlap >= 0.4 or aligned_left):
            clusters[-1].append(candidate)
        else:
            clusters.append([candidate])

    semantic_blocks = []
    source_segments = getattr(visual_page, "_source_frame_segments", []) or []

    for cluster_index, cluster in enumerate(clusters, start=1):
        x0 = min(float(item["bbox"].x0) for item in cluster)
        y0 = min(float(item["bbox"].y0) for item in cluster)
        x1 = max(float(item["bbox"].x1) for item in cluster)
        y1 = max(float(item["bbox"].y1) for item in cluster)
        font_pt = max(8.5, min(11.0, max(float(item["bbox"].height) for item in cluster) * 0.9))
        value_key = "상태 이력"
        cluster_bbox = v102_make_bbox(x0, y0, x1, y1)
        container_bbox = v104_infer_container_bbox_from_frame_segments(cluster_bbox, source_segments, frame_bounds)
        frame_outline_style = v104_resolve_outline_style_from_source_segments(container_bbox, source_segments)
        semantic_blocks.append(
            SimpleNamespace(
                text=" | ".join(item["text"] for item in cluster),
                bbox=container_bbox,
                font_pt=font_pt,
                bold=False,
                align="left",
                valign="top",
                _frame_group_id=f"status-history-{cluster_index}",
                _frame_color_group=value_key,
                _frame_value_key=value_key,
                _frame_outline_style=frame_outline_style,
            )
        )

    return semantic_blocks


def body_fragment_from_v201_html(
    full_html: str,
    render_model: dict,
    visual_pages: list,
    edit_pages: list,
    scale: float,
    clone_id: str,
) -> str:
    style_blocks = "\n".join(re.findall(r"<style>[\s\S]*?</style>", full_html, flags=re.IGNORECASE))
    body_match = re.search(r"<body[^>]*>([\s\S]*?)</body>", full_html, flags=re.IGNORECASE)
    body_inner = body_match.group(1).strip() if body_match else full_html.strip()
    body_inner = re.sub(r"<style>[\s\S]*?</style>", "", body_inner, flags=re.IGNORECASE).strip()
    body_inner = normalize_v201_body_inner(body_inner, visual_pages, scale, clone_id)
    body_inner = inject_edit_overlays(body_inner, edit_pages, visual_pages, scale, clone_id)
    render_model_json = json.dumps(render_model, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

    return f'''<section data-template-extract-draft="true" data-template-clone="{clone_id}">
  <script type="application/json" data-template-render-model="positioned-v1">{render_model_json}</script>
  <div class="template-clone template-clone--raster-first-v2">
{style_blocks}
{V201_EDIT_OVERLAY_STYLE}
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


def build_v201_semantic_line_html(block, scale: float) -> str:
    raw_text = v202_normalize_whitespace(getattr(block, "text", "") or "")

    if not raw_text:
        return ""

    font_px = rounded(clamp(float(getattr(block, "font_pt", 10.0) or 10.0) * scale * 0.95, 8.0, 14.0))
    left_px = rounded(float(block.bbox.x0) * scale)
    top_px = rounded(float(block.bbox.y0) * scale)
    width_px = rounded(max(1.0, float(block.bbox.width) * scale))

    return (
        f'<div class="semantic-line" data-template-v212-outside="true" '
        f'style="left:{left_px}px; top:{top_px}px; width:{width_px}px; font-size:{font_px}px;">'
        f'{html.escape(raw_text, quote=False)}'
        '</div>'
    )


def normalize_v201_page_outside_semantic_lines(page_html: str, page, scale: float) -> str:
    frame_bounds = v202_resolve_page_frame_bounds(page)

    if not frame_bounds:
        return page_html

    frame_top_px = frame_bounds["top"] * scale
    frame_bottom_px = frame_bounds["bottom"] * scale
    semantic_line_pattern = re.compile(
        r'<div class="semantic-line" style="([^"]*?\btop:([0-9.]+)px;[^"]*)">([\s\S]*?)</div>',
        flags=re.IGNORECASE,
    )

    def replace_semantic_line(match: re.Match) -> str:
        try:
            top_px = float(match.group(2))
        except (TypeError, ValueError):
            return match.group(0)

        if top_px <= frame_top_px + 2.0 or top_px >= frame_bottom_px - 2.0:
            return ""

        return match.group(0)

    cleaned_page_html = semantic_line_pattern.sub(replace_semantic_line, page_html)
    outside_blocks = [
        *v202_collect_outside_region_blocks(page, frame_bounds, "top"),
        *v202_collect_outside_region_blocks(page, frame_bounds, "bottom"),
    ]
    semantic_lines_html = "".join(build_v201_semantic_line_html(block, scale) for block in outside_blocks)

    if not semantic_lines_html:
        return cleaned_page_html

    closing_index = cleaned_page_html.rfind("</section>")

    if closing_index < 0:
        return cleaned_page_html + semantic_lines_html

    return cleaned_page_html[:closing_index] + semantic_lines_html + cleaned_page_html[closing_index:]


def normalize_v201_body_inner(body_inner: str, visual_pages: list, scale: float, clone_id: str) -> str:
    if clone_id != "pdf-raster-first-v2.12":
        return body_inner

    pages_by_number = {
        str(int(getattr(page, "number", index + 1))): page
        for index, page in enumerate(visual_pages)
    }
    page_section_pattern = re.compile(
        r'(<section\b[^>]*class="[^"]*\bpage\b[^"]*"[^>]*data-page="(\d+)"[^>]*>)([\s\S]*?)(</section>)',
        flags=re.IGNORECASE,
    )

    def replace_page_section(match: re.Match) -> str:
        page_number = match.group(2)
        page = pages_by_number.get(page_number)

        if not page:
            return match.group(0)

        normalized_page_html = normalize_v201_page_outside_semantic_lines(
            f"{match.group(1)}{match.group(3)}{match.group(4)}",
            page,
            scale,
        )
        return normalized_page_html

    return page_section_pattern.sub(replace_page_section, body_inner)


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


def normalize_anchor_text(text: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]+", "", str(text or "")).strip().lower()


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

def build_v213_visual_anchor_items(page, scale: float) -> list[dict]:
    items = []

    def append_items(raw_items: list[dict]) -> None:
        for item in raw_items:
            if item.get("kind") != "plain_text":
                continue

            text = str(item.get("text") or "").strip()
            normalized = normalize_anchor_text(text)

            if not text or not normalized:
                continue

            items.append(
                {
                    "text": text,
                    "normalizedText": normalized,
                    "left": rounded(float(item.get("left", 0.0)) * scale),
                    "top": rounded(float(item.get("top", 0.0)) * scale),
                    "width": rounded(float(item.get("width", 0.0)) * scale),
                    "height": rounded(float(item.get("height", 0.0)) * scale),
                    "fontSize": rounded(float(item.get("fontSize", 11.0)) * scale),
                    "lineHeight": rounded(float(item.get("lineHeight", 13.0)) * scale),
                    "fontWeight": int(item.get("fontWeight", 400) or 400),
                    "searchStart": 0,
                }
            )

    for table in getattr(page, "tables", []) or []:
        for cell in getattr(table, "cells", []) or []:
            cell_rect = getattr(cell, "rect", None) or getattr(cell, "bbox", None)

            if cell_rect is None:
                continue

            append_items(
                build_text_items_for_region(
                    cell_rect,
                    getattr(cell, "text", "") or "",
                    getattr(cell, "font_pt", 11.0),
                    bool(getattr(cell, "bold", False)),
                    getattr(cell, "lines", []) or [],
                )
            )

    for line in getattr(page, "text_lines", []) or []:
        append_items(
            build_text_items_for_region(
                line.bbox,
                getattr(line, "text", "") or "",
                getattr(line, "font_pt", 10.0),
                False,
                [],
            )
        )

    for block in getattr(page, "raster_blocks", []) or []:
        block_text = getattr(block, "text", "") or ""

        if not block_text:
            continue

        append_items(
            build_text_items_for_region(
                block.bbox,
                block_text,
                10.0,
                False,
                [],
            )
        )

    items.sort(key=lambda item: (item["top"], item["left"], item["width"]))
    return items


def resolve_v213_visual_anchor(
    anchor_state,
    fragment_text: str,
    fallback_left: float,
    fallback_top: float,
    fallback_width: float,
    fallback_height: float,
    fallback_font_size: float,
    fallback_line_height: float,
    fallback_font_weight: int,
) -> dict | None:
    if not anchor_state:
        return None

    normalized_fragment = normalize_anchor_text(fragment_text)

    if not normalized_fragment:
        return None

    items = anchor_state.get("items", [])

    if not items:
        return None

    cursor = int(anchor_state.get("cursor", 0) or 0)
    best_match = None
    best_score = float("-inf")
    fallback_center_y = fallback_top + (fallback_height / 2.0)

    for index in range(max(0, cursor - 3), len(items)):
        item = items[index]
        normalized_item = item.get("normalizedText", "")

        if not normalized_item:
            continue

        score = None

        if normalized_item == normalized_fragment:
            score = 600.0
        elif normalized_fragment in normalized_item:
            score = 420.0 + (len(normalized_fragment) / max(1, len(normalized_item))) * 100.0
        elif normalized_item in normalized_fragment:
            score = 260.0 + (len(normalized_item) / max(1, len(normalized_fragment))) * 40.0

        if score is None:
            continue

        score -= abs(index - cursor) * 8.0
        score -= abs((item["top"] + (item["height"] / 2.0)) - fallback_center_y) * 0.12
        score -= abs(item["left"] - fallback_left) * 0.02

        if score > best_score:
            best_score = score
            best_match = (index, item)

        if score >= 590.0:
            break

    if best_match is None:
        return None

    index, item = best_match
    anchor_state["cursor"] = max(cursor, index)
    normalized_item = item["normalizedText"]
    search_start = int(item.get("searchStart", 0) or 0)
    start_index = normalized_item.find(normalized_fragment, search_start)

    if start_index < 0:
        start_index = normalized_item.find(normalized_fragment)

    if start_index >= 0:
        end_index = start_index + len(normalized_fragment)
        item["searchStart"] = end_index
        total_length = max(1, len(normalized_item))
        start_ratio = start_index / total_length
        end_ratio = end_index / total_length
        left = item["left"] + (item["width"] * start_ratio)
        width = max(
            max(fallback_font_size * 0.9, 6.0),
            item["width"] * max(0.12, end_ratio - start_ratio),
        )
    else:
        left = item["left"]
        width = item["width"]

    return {
        "left": rounded(left),
        "top": rounded(item["top"]),
        "width": rounded(min(item["left"] + item["width"], left + width) - left),
        "height": rounded(max(item["height"], fallback_height)),
        "fontSize": rounded(max(item["fontSize"], fallback_font_size * 0.85)),
        "lineHeight": rounded(max(item["lineHeight"], fallback_line_height * 0.85)),
        "fontWeight": int(item.get("fontWeight", fallback_font_weight) or fallback_font_weight),
    }


def build_v214_visual_text_items(page, scale: float) -> list[dict]:
    if page is None:
        return []

    raw_items = [dict(item) for item in build_v213_visual_anchor_items(page, scale)]

    if not raw_items:
        return []

    raw_items.sort(key=lambda item: (item["top"], item["left"], -item["width"]))
    combined_header_item = next(
        (
            item
            for item in raw_items
            if "양식명(코드)" in v202_text_signature(item.get("text", "") or "")
            and "문서번호" in v202_text_signature(item.get("text", "") or "")
        ),
        None,
    )
    filtered_items = []
    seen_items = []

    for item in raw_items:
        text_signature = v202_text_signature(item.get("text", "") or "")

        if not text_signature:
            continue

        if combined_header_item is not None and item is not combined_header_item:
            same_top_band = abs(float(item["top"]) - float(combined_header_item["top"])) <= max(
                float(item["height"]),
                float(combined_header_item["height"]),
                8.0,
            )

            if same_top_band and (
                "양식명(코드)" in text_signature or "문서번호" in text_signature
            ):
                continue

        duplicate_item = next(
            (
                existing
                for existing in seen_items
                if existing["signature"] == text_signature
                and abs(existing["top"] - float(item["top"])) <= 2.5
                and abs(existing["left"] - float(item["left"])) <= 4.0
            ),
            None,
        )

        if duplicate_item is not None:
            continue

        item["normalizedText"] = text_signature
        filtered_items.append(item)
        seen_items.append(
            {
                "signature": text_signature,
                "top": float(item["top"]),
                "left": float(item["left"]),
            }
        )

    filtered_items.sort(key=lambda item: (item["top"], item["left"], item["width"]))
    return filtered_items


def render_v214_visual_text_region(item: dict) -> str:
    text = str(item.get("text") or "").strip()

    if not text:
        return ""

    left = rounded(float(item.get("left", 0.0)))
    top = rounded(float(item.get("top", 0.0)))
    width = rounded(max(1.0, float(item.get("width", 1.0))))
    height = rounded(max(1.0, float(item.get("height", 1.0))))
    font_size = rounded(max(8.0, float(item.get("fontSize", 11.0))))
    line_height = rounded(max(font_size * 1.12, float(item.get("lineHeight", font_size * 1.12))))
    font_weight = int(item.get("fontWeight", 400) or 400)

    return (
        f'<div class="v202-edit-region" data-template-edit-region="text" '
        f'style="left:{left:.2f}px; top:{top:.2f}px; width:{width:.2f}px; '
        f'min-height:{height:.2f}px;">'
        f'<div class="v201-edit-text v202-edit-text v214-visual-text" contenteditable="true" '
        f'data-template-edit-text="true" data-template-edit-kind="text" '
        f'data-template-v214-source="visual-text" '
        f'data-template-abs-left="{left:.2f}" '
        f'data-template-abs-top="{top:.2f}" '
        f'data-template-abs-width="{width:.2f}" '
        f'data-template-abs-height="{height:.2f}" '
        f'style="left:0; top:0; width:{width:.2f}px; min-height:{height:.2f}px; '
        f'font-size:{font_size:.2f}px; font-weight:{font_weight}; line-height:{line_height:.2f}px;">'
        f'{html.escape(text, quote=False)}</div></div>'
    )


def render_v214_choice_overlay_region(
    rect,
    font_pt: float,
    bold: bool,
    rich_lines: list,
    scale: float,
    visual_text_signatures: set[str] | None = None,
) -> str:
    font_px = clamp(float(font_pt or 11.0) * scale * 0.95, 9.0, 18.0)
    line_height_px = max(font_px * 1.22, 10.0)
    font_weight = 700 if bold else 400
    pad_x = clamp(font_px * 0.38, 4.0, 8.0)
    pad_y = clamp(font_px * 0.28, 2.5, 6.0)
    region_left = rect.x0 * scale
    region_top = rect.y0 * scale
    region_width = max(1.0, rect.width * scale)
    region_height = max(1.0, rect.height * scale)
    all_lines = region_lines_from_text_and_rich_lines("", rich_lines)
    choice_lines = [
        line
        for line in all_lines
        if line.get("options")
    ]

    if not choice_lines:
        return ""

    compact_labels = [
        v202_text_signature(option.get("label") or "")
        for line in choice_lines
        for option in (line.get("options") or [])
    ]
    is_tiny_noise_region = (
        region_width <= 20.0
        and max(1.0, rect.height * scale) <= 20.0
        and compact_labels
        and all(len(label) <= 2 for label in compact_labels)
    )

    if is_tiny_noise_region:
        return ""

    html_parts = []
    content_width = 0.0
    max_bottom = 0.0
    has_plain_text = False
    seen_plain_signatures = set()

    for index, line in enumerate(all_lines):
        options = line.get("options") or []
        line_top = pad_y + line_height_px * index
        line_height = max(1.0, min(line_height_px, region_height - line_top))

        if line_height <= 0:
            continue

        if options:
            visible_label_text = " ".join(
                html.escape(str(option.get("label") or ""), quote=False)
                for option in options
                if str(option.get("label") or "").strip()
            ).strip()
            estimated_width = max(
                22.0,
                font_px * max(1, len(v202_text_signature(visible_label_text))) * 0.62 + len(options) * 16.0,
            )
            line_width = rounded(min(region_width - pad_x * 2, estimated_width))
            content_width = max(content_width, line_width)
            max_bottom = max(max_bottom, line_top + line_height)
            base_style = (
                f"left:{pad_x:.2f}px; top:{line_top:.2f}px; width:{line_width:.2f}px; "
                f"min-height:{line_height:.2f}px; font-size:{font_px:.2f}px; "
                f"font-weight:{font_weight};"
            )
            buttons = []

            for option in options:
                checked = "1" if option.get("checked") else "0"
                aria = "true" if option.get("checked") else "false"
                label = html.escape(str(option.get("label") or ""), quote=False)
                buttons.append(
                    f'<button type="button" class="v201-choice-box" data-checked="{checked}" '
                    f'data-template-edit-kind="choice" aria-checked="{aria}" role="checkbox"></button>'
                    f'<span class="v201-choice-label v202-choice-label" contenteditable="true" '
                    f'data-template-edit-text="true" data-template-edit-kind="choice-label" '
                    f'data-template-abs-left="{region_left + pad_x:.2f}" '
                    f'data-template-abs-top="{region_top + line_top:.2f}" '
                    f'data-template-abs-width="{line_width:.2f}" '
                    f'data-template-abs-height="{line_height:.2f}">{label}</span>'
                )

            html_parts.append(
                f'<span class="v201-choice-row" data-template-edit-kind="choice-row" '
                f'style="{base_style}">{"".join(buttons)}</span>'
            )
            continue

        line_text = str(line.get("text") or "").strip()
        line_signature = v202_text_signature(line_text)

        if not line_signature or line_signature in seen_plain_signatures:
            continue

        if visual_text_signatures and line_signature in visual_text_signatures:
            continue

        if (
            "양식명(코드)" in line_signature
            and "문서번호" in line_signature
            and visual_text_signatures
            and any(
                "양식명(코드)" in signature or "문서번호" in signature
                for signature in visual_text_signatures
            )
        ):
            continue

        seen_plain_signatures.add(line_signature)
        has_plain_text = True
        line_width = rounded(max(18.0, region_width - pad_x * 2))
        content_width = max(content_width, line_width)
        max_bottom = max(max_bottom, line_top + line_height)
        base_style = (
            f"left:{pad_x:.2f}px; top:{line_top:.2f}px; width:{line_width:.2f}px; "
            f"min-height:{line_height:.2f}px; font-size:{font_px:.2f}px; "
            f"font-weight:{font_weight};"
        )
        html_parts.append(
            f'<span class="v201-edit-text" contenteditable="true" '
            f'data-template-edit-text="true" data-template-edit-kind="text" '
            f'data-template-abs-left="{region_left + pad_x:.2f}" '
            f'data-template-abs-top="{region_top + line_top:.2f}" '
            f'data-template-abs-width="{line_width:.2f}" '
            f'data-template-abs-height="{line_height:.2f}" '
            f'style="{base_style}">{html.escape(line_text, quote=False)}</span>'
        )

    if not html_parts:
        return ""

    overlay_width = rounded(min(region_width, max(content_width + pad_x * 2, 18.0)))
    overlay_height = rounded(max(max_bottom + pad_y, pad_y * 2 + line_height_px))

    return (
        f'<div class="v202-edit-region" data-template-edit-region="choice" '
        f'data-template-v214-source="{"choice-mixed" if has_plain_text else "choice-only"}" '
        f'style="left:{region_left:.2f}px; top:{region_top:.2f}px; width:{overlay_width:.2f}px; '
        f'min-height:{overlay_height:.2f}px;">'
        f'{"".join(html_parts)}</div>'
    )


def build_v214_extra_text_lines(page, visual_text_signatures: set[str]) -> list[dict]:
    frame_bounds = v202_resolve_page_frame_bounds(page)

    if frame_bounds is None:
        return []

    extra_entries = []

    for block in getattr(page, "text_blocks", []) or []:
        if v202_resolve_block_vertical_region(block, frame_bounds) == "inside":
            continue

        lines = region_lines_from_text_and_rich_lines(
            getattr(block, "text", "") or "",
            getattr(block, "lines", []) or [],
        )
        extra_line_texts = []

        for line in lines:
            if line.get("options"):
                continue

            line_text = str(line.get("text") or "").strip()
            line_signature = v202_text_signature(line_text)

            if not line_signature:
                continue

            if line_signature in visual_text_signatures:
                continue

            if (
                "양식명(코드)" in line_signature
                and "문서번호" in line_signature
                and any(
                    "양식명(코드)" in signature or "문서번호" in signature
                    for signature in visual_text_signatures
                )
            ):
                continue

            extra_line_texts.append(line_text)

        if not extra_line_texts:
            continue

        extra_entries.append(
            {
                "rect": block.bbox,
                "text": "\n".join(extra_line_texts),
                "fontPt": getattr(block, "font_pt", 11.0),
                "bold": bool(getattr(block, "bold", False)),
            }
        )

    return extra_entries


def render_edit_overlay_region(
    rect,
    text: str,
    font_pt: float,
    bold: bool,
    rich_lines: list,
    scale: float,
    visual_anchor_state=None,
) -> str:
    font_px = clamp(float(font_pt or 11.0) * scale * 0.95, 9.0, 18.0)
    line_height_px = max(font_px * 1.22, 10.0)
    font_weight = 700 if bold else 400
    pad_x = clamp(font_px * 0.38, 4.0, 8.0)
    pad_y = clamp(font_px * 0.28, 2.5, 6.0)
    region_left = rect.x0 * scale
    region_top = rect.y0 * scale
    region_width = max(1.0, rect.width * scale)
    region_height = max(1.0, rect.height * scale)
    left = pad_x
    top = pad_y
    width = max(1.0, region_width - pad_x * 2)
    height_limit = max(1.0, rect.height * scale - pad_y * 2)
    max_lines = max(1, int(height_limit // max(1.0, line_height_px)))
    lines = region_lines_from_text_and_rich_lines(text, rich_lines)[:max_lines]
    if not lines:
        return ""

    has_choice_lines = any(line.get("options") for line in lines)

    if not has_choice_lines and visual_anchor_state:
        html_parts = []

        for index, line_text in enumerate(lines[:max_lines]):
            normalized_line_text = str(line_text.get("text") or "").strip()

            if not normalized_line_text:
                continue

            line_top = top + line_height_px * index
            line_height = min(line_height_px, region_height - line_top)

            if line_height <= 0:
                continue

            fallback_left = region_left + left
            fallback_top = region_top + line_top
            fallback_width = width
            fallback_height = max(line_height, font_px * 1.08)
            anchor_layout = resolve_v213_visual_anchor(
                visual_anchor_state,
                normalized_line_text,
                fallback_left,
                fallback_top,
                fallback_width,
                fallback_height,
                font_px,
                line_height_px,
                font_weight,
            )

            abs_left = anchor_layout["left"] if anchor_layout else fallback_left
            abs_top = anchor_layout["top"] if anchor_layout else fallback_top
            abs_width = anchor_layout["width"] if anchor_layout else fallback_width
            abs_height = anchor_layout["height"] if anchor_layout else fallback_height
            abs_font_size = anchor_layout["fontSize"] if anchor_layout else font_px
            abs_line_height = anchor_layout["lineHeight"] if anchor_layout else line_height_px
            abs_font_weight = anchor_layout["fontWeight"] if anchor_layout else font_weight

            html_parts.append(
                f'<div class="v202-edit-region" data-template-edit-region="text" '
                f'style="left:{abs_left:.2f}px; top:{abs_top:.2f}px; width:{abs_width:.2f}px; '
                f'min-height:{abs_height:.2f}px;">'
                f'<div class="v201-edit-text v202-edit-text" contenteditable="true" '
                f'data-template-edit-text="true" data-template-edit-kind="text" '
                f'data-template-abs-left="{abs_left:.2f}" '
                f'data-template-abs-top="{abs_top:.2f}" '
                f'data-template-abs-width="{abs_width:.2f}" '
                f'data-template-abs-height="{abs_height:.2f}" '
                f'style="left:0; top:0; width:{abs_width:.2f}px; '
                f'min-height:{abs_height:.2f}px; font-size:{abs_font_size:.2f}px; '
                f'font-weight:{abs_font_weight}; line-height:{abs_line_height:.2f}px;">'
                f'{html.escape(normalized_line_text, quote=False)}</div></div>'
            )

        if html_parts:
            return "".join(html_parts)

    if not has_choice_lines:
        normalized_lines = [
            str(line.get("text") or "").strip()
            for line in lines
            if str(line.get("text") or "").strip()
        ]
        normalized_text = "\n".join(normalized_lines).strip()

        if not normalized_text:
            return ""

        return (
            f'<div class="v202-edit-region" data-template-edit-region="text" '
            f'style="left:{region_left:.2f}px; top:{region_top:.2f}px; width:{region_width:.2f}px; '
            f'min-height:{region_height:.2f}px;">'
            f'<div class="v201-edit-text v202-edit-text" contenteditable="true" '
            f'data-template-edit-text="true" data-template-edit-kind="text" '
            f'data-template-abs-left="{region_left + left:.2f}" '
            f'data-template-abs-top="{region_top + top:.2f}" '
            f'data-template-abs-width="{width:.2f}" '
            f'data-template-abs-height="{height_limit:.2f}" '
            f'style="left:{left:.2f}px; top:{top:.2f}px; width:{width:.2f}px; '
            f'min-height:{height_limit:.2f}px; font-size:{font_px:.2f}px; '
            f'font-weight:{font_weight}; line-height:{line_height_px:.2f}px;">'
            f'{html.escape(normalized_text, quote=False)}</div></div>'
        )

    html_parts = []

    for index, line in enumerate(lines):
        line_top = top + line_height_px * index
        line_height = min(line_height_px, region_height - line_top)

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
                    f'data-template-edit-kind="choice" aria-checked="{aria}" role="checkbox"></button>'
                    f'<span class="v201-edit-text v201-choice-label" contenteditable="true" '
                    f'data-template-edit-text="true" data-template-edit-kind="choice-label" '
                    f'data-template-abs-left="{region_left + left:.2f}" '
                    f'data-template-abs-top="{region_top + line_top:.2f}" '
                    f'data-template-abs-width="{width:.2f}" '
                    f'data-template-abs-height="{line_height:.2f}">{label}</span>'
                )

            html_parts.append(
                f'<span class="v201-choice-row" data-template-edit-kind="choice-row" '
                f'style="{base_style}">{"".join(buttons)}</span>'
            )
            continue

        line_text = str(line.get("text") or "").strip()

        if not line_text:
            continue

        html_parts.append(
            f'<span class="v201-edit-text" contenteditable="true" '
            f'data-template-edit-text="true" data-template-edit-kind="text" '
            f'data-template-abs-left="{region_left + left:.2f}" '
            f'data-template-abs-top="{region_top + line_top:.2f}" '
            f'data-template-abs-width="{width:.2f}" '
            f'data-template-abs-height="{line_height:.2f}" '
            f'style="{base_style}">{html.escape(line_text, quote=False)}</span>'
        )

    if not html_parts:
        return ""

    return (
        f'<div class="v202-edit-region" data-template-edit-region="choice" '
        f'style="left:{region_left:.2f}px; top:{region_top:.2f}px; width:{region_width:.2f}px; '
        f'min-height:{region_height:.2f}px;">'
        f'{"".join(html_parts)}</div>'
    )


def render_edit_overlay_page(page, scale: float, visual_page=None, clone_id: str = "") -> str:
    if clone_id == "pdf-raster-first-v2.14" and visual_page is not None:
        visual_text_items = build_v214_visual_text_items(visual_page, scale)
        visual_text_signatures = {
            str(item.get("normalizedText") or v202_text_signature(item.get("text", "") or ""))
            for item in visual_text_items
        }
        regions = [render_v214_visual_text_region(item) for item in visual_text_items]

        for table in getattr(page, "tables", []) or []:
            for cell in getattr(table, "cells", []) or []:
                regions.append(
                    render_v214_choice_overlay_region(
                        cell.rect,
                        getattr(cell, "font_pt", 11.0),
                        bool(getattr(cell, "bold", False)),
                        getattr(cell, "lines", []) or [],
                        scale,
                        visual_text_signatures,
                    )
                )

        for block in getattr(page, "text_blocks", []) or []:
                regions.append(
                    render_v214_choice_overlay_region(
                        block.bbox,
                        getattr(block, "font_pt", 11.0),
                        bool(getattr(block, "bold", False)),
                        getattr(block, "lines", []) or [],
                        scale,
                        visual_text_signatures,
                    )
                )

        for extra_entry in build_v214_extra_text_lines(page, visual_text_signatures):
            regions.append(
                render_edit_overlay_region(
                    extra_entry["rect"],
                    extra_entry["text"],
                    extra_entry["fontPt"],
                    extra_entry["bold"],
                    [],
                    scale,
                    {"items": [], "cursor": 0},
                )
            )

        return f'<div class="v201-edit-overlay" data-template-edit-overlay="true">{"".join(region for region in regions if region)}</div>'

    regions = []
    visual_anchor_state = None

    if clone_id == "pdf-raster-first-v2.13" and visual_page is not None:
        visual_anchor_state = {
            "items": build_v213_visual_anchor_items(visual_page, scale),
            "cursor": 0,
        }

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
                    visual_anchor_state,
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
                visual_anchor_state,
            )
        )

    return f'<div class="v201-edit-overlay" data-template-edit-overlay="true">{"".join(regions)}</div>'


def inject_edit_overlays(body_inner: str, edit_pages: list, visual_pages: list, scale: float, clone_id: str) -> str:
    visual_page_by_number = {
        str(int(getattr(page, "number", index + 1))): page
        for index, page in enumerate(visual_pages)
    }
    overlays_by_page = {
        str(int(getattr(page, "number", index + 1))): render_edit_overlay_page(
            page,
            scale,
            visual_page_by_number.get(str(int(getattr(page, "number", index + 1)))),
            clone_id,
        )
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
    x_lines = list(getattr(table, "x_lines", []) or [])
    y_lines = list(getattr(table, "y_lines", []) or [])
    raw_horizontal_segments = []
    raw_vertical_segments = []
    source_segments = list(getattr(table, "_source_frame_segments", []) or [])

    def append_raw_segment(segment) -> None:
        orientation = getattr(segment, "orientation", "")
        pos = float(getattr(segment, "pos", 0.0))
        start = float(getattr(segment, "start", 0.0))
        end = float(getattr(segment, "end", 0.0))
        thickness = max(0.6, float(getattr(segment, "thickness", V202_FRAME_STROKE_WIDTH) or V202_FRAME_STROKE_WIDTH))

        if end - start <= 0:
            return

        payload = {
            "pos": pos,
            "start": start,
            "end": end,
            "thickness": thickness,
        }

        if orientation == "h":
            raw_horizontal_segments.append(payload)
        elif orientation == "v":
            raw_vertical_segments.append(payload)

    def append_cell_edges(cell) -> None:
        if len(x_lines) < 2 or len(y_lines) < 2:
            cell_rect = getattr(cell, "rect", None) or getattr(cell, "bbox", None)

            if cell_rect is None:
                return

            left = float(cell_rect.x0)
            right = float(cell_rect.x1)
            top = float(cell_rect.y0)
            bottom = float(cell_rect.y1)
        else:
            col_start = max(1, int(getattr(cell, "col_start", 1) or 1))
            col_end = max(col_start, int(getattr(cell, "col_end", col_start) or col_start))
            row_start = max(1, int(getattr(cell, "row_start", 1) or 1))
            row_end = max(row_start, int(getattr(cell, "row_end", row_start) or row_start))

            col_start_index = min(len(x_lines) - 2, col_start - 1)
            col_end_index = min(len(x_lines) - 1, col_end)
            row_start_index = min(len(y_lines) - 2, row_start - 1)
            row_end_index = min(len(y_lines) - 1, row_end)

            left = float(x_lines[col_start_index])
            right = float(x_lines[col_end_index])
            top = float(y_lines[row_start_index])
            bottom = float(y_lines[row_end_index])

        if right - left <= 0 or bottom - top <= 0:
            return

        raw_horizontal_segments.append({"pos": top, "start": left, "end": right, "thickness": V202_FRAME_STROKE_WIDTH})
        raw_horizontal_segments.append({"pos": bottom, "start": left, "end": right, "thickness": V202_FRAME_STROKE_WIDTH})
        raw_vertical_segments.append({"pos": left, "start": top, "end": bottom, "thickness": V202_FRAME_STROKE_WIDTH})
        raw_vertical_segments.append({"pos": right, "start": top, "end": bottom, "thickness": V202_FRAME_STROKE_WIDTH})

    if source_segments:
        for segment in source_segments:
            append_raw_segment(segment)
    else:
        for cell in getattr(table, "cells", []) or []:
            append_cell_edges(cell)

    if not raw_horizontal_segments and not raw_vertical_segments:
        frame_bounds = v202_resolve_table_frame_bounds(table)

        for y_value in y_lines:
            raw_horizontal_segments.append(
                {
                    "pos": float(y_value),
                    "start": frame_bounds["left"],
                    "end": frame_bounds["right"],
                    "thickness": V202_FRAME_STROKE_WIDTH,
                }
            )

        for x_value in x_lines:
            raw_vertical_segments.append(
                {
                    "pos": float(x_value),
                    "start": frame_bounds["top"],
                    "end": frame_bounds["bottom"],
                    "thickness": V202_FRAME_STROKE_WIDTH,
                }
            )

    def merge_segments(raw_segments: list[dict], orientation: str) -> list[dict]:
        if not raw_segments:
            return []

        sorted_segments = sorted(
            raw_segments,
            key=lambda segment: (round(segment["pos"], 4), round(segment["start"], 4), round(segment["end"], 4)),
        )
        merged = []

        for segment in sorted_segments:
            previous = merged[-1] if merged else None

            if (
                previous
                and abs(previous["pos"] - segment["pos"]) <= 0.25
                and segment["start"] <= previous["end"] + 0.25
            ):
                previous["start"] = min(previous["start"], segment["start"])
                previous["end"] = max(previous["end"], segment["end"])
                previous["thickness_values"].append(float(segment.get("thickness", V202_FRAME_STROKE_WIDTH)))
                continue

            merged.append({
                **dict(segment),
                "thickness_values": [float(segment.get("thickness", V202_FRAME_STROKE_WIDTH))],
            })

        if orientation == "h":
            return [
                {
                    "orientation": "h",
                    "left": rounded(segment["start"]),
                    "top": rounded(segment["pos"]),
                    "width": rounded(max(0.0, segment["end"] - segment["start"])),
                    "thickness": rounded(max(0.8, float(median(segment["thickness_values"] or [V202_FRAME_STROKE_WIDTH])))),
                }
                for segment in merged
                if segment["end"] - segment["start"] > 0.2
            ]

        return [
            {
                "orientation": "v",
                "left": rounded(segment["pos"]),
                "top": rounded(segment["start"]),
                "height": rounded(max(0.0, segment["end"] - segment["start"])),
                "thickness": rounded(max(0.8, float(median(segment["thickness_values"] or [V202_FRAME_STROKE_WIDTH])))),
            }
            for segment in merged
            if segment["end"] - segment["start"] > 0.2
        ]

    return [
        *merge_segments(raw_horizontal_segments, "h"),
        *merge_segments(raw_vertical_segments, "v"),
    ]


def build_render_model(pages, clone_id: str) -> dict:
    render_pages = []

    for page in pages:
        frame_segments = []
        text_items = []
        frame_bounds = v202_resolve_page_frame_bounds(page)

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

        if frame_bounds:
            outside_blocks = [
                *v202_collect_outside_region_blocks(page, frame_bounds, "top"),
                *v202_collect_outside_region_blocks(page, frame_bounds, "bottom"),
            ]

            for block in outside_blocks:
                text_items.extend(
                    build_text_items_for_region(
                        block.bbox,
                        getattr(block, "text", "") or "",
                        getattr(block, "font_pt", 10.0),
                        bool(getattr(block, "bold", False)),
                        getattr(block, "lines", []) or [],
                    )
                )
        else:
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
        "cloneId": clone_id,
        "pageCount": len(render_pages),
        "pages": render_pages,
    }


def convert(
    input_pdf: Path,
    scale: float,
    raster_scale: float,
    ocr_lang: str,
    engine_version: str,
    extraction_stage: str = "full",
    frame_group_version: str = "v1.11-default",
) -> dict:
    engine_config = resolve_engine_config(engine_version)
    normalized_stage = normalize_extraction_stage(extraction_stage)
    normalized_frame_group_version = normalize_frame_group_version(frame_group_version)
    frame_group_version_tag = resolve_frame_group_version_tag(frame_group_version)
    visual_converter = load_reference_converter(VISUAL_REFERENCE_CONVERTER, "template_extract_reference_type1")
    edit_converter = load_reference_converter(EDIT_REFERENCE_CONVERTER, "template_extract_reference_type3")
    doc = visual_converter.fitz.open(str(input_pdf))

    if engine_config["clone_id"] in {"pdf-raster-first-v2.21", "pdf-raster-first-v2.2", "pdf-raster-first-v2.02", "pdf-raster-first-v2.03", "pdf-raster-first-v2.04", "pdf-raster-first-v2.05", "pdf-raster-first-v2.11"}:
        if engine_config["clone_id"] == "pdf-raster-first-v2.11":
            inline_suffix = ".v211-inline.html"
        elif engine_config["clone_id"] == "pdf-raster-first-v2.21":
            inline_suffix = ".v221-inline.html"
        elif engine_config["clone_id"] == "pdf-raster-first-v2.2":
            inline_suffix = ".v22-inline.html"
        elif engine_config["clone_id"] == "pdf-raster-first-v2.05":
            inline_suffix = ".v205-inline.html"
        elif engine_config["clone_id"] == "pdf-raster-first-v2.04":
            inline_suffix = ".v204-inline.html"
        elif engine_config["clone_id"] == "pdf-raster-first-v2.03":
            inline_suffix = ".v203-inline.html"
        else:
            inline_suffix = ".v202-inline.html"
        asset_store = visual_converter.AssetStore(str(input_pdf.with_suffix(inline_suffix)), mode="embed")
        visual_pages = []

        for index in range(doc.page_count):
            page = doc[index]
            visual_page = visual_converter.convert_page(page, index + 1, asset_store, raster_scale, ocr_lang)
            attach_reference_frame_geometry(visual_converter, page, visual_page, raster_scale, ocr_lang)
            setattr(
                visual_page,
                "_v104_status_value_blocks",
                v104_extract_status_value_blocks_from_fitz_page(page, visual_page, v202_resolve_page_frame_bounds(visual_page)),
            )
            visual_pages.append(visual_page)

        render_model = build_render_model(visual_pages, engine_config["clone_id"])
        fragment_html = v202_build_structured_section(
            visual_pages,
            input_pdf.stem,
            scale,
            engine_config["clone_id"],
            render_model,
            normalized_stage,
            frame_group_version,
        )
        summary = build_model_summary(visual_pages, visual_pages)

        return {
            "sourceTitle": input_pdf.stem,
            "html": fragment_html,
            "extractionStage": normalized_stage,
            "frameGroupVersion": frame_group_version_tag,
            "pageCount": len(visual_pages),
            "sourceMode": page_source_mode(visual_pages),
            "documentFamily": "generic_form",
            "cloneBuilder": engine_config["clone_builder"],
            "modelSummary": summary,
            "renderModel": render_model,
            "diagnostics": {
                "fallbackApplied": False,
                "fallbackReason": None,
                "dependencyWarnings": [],
                "referenceConverter": (
                    f"geometry={VISUAL_REFERENCE_CONVERTER.name}; checkbox_hint={EDIT_REFERENCE_CONVERTER.name}"
                ),
            },
        }

    asset_store = visual_converter.AssetStore(str(input_pdf.with_suffix(".v201-inline.html")), mode="embed")
    visual_pages = []
    edit_pages = []

    for index in range(doc.page_count):
        page = doc[index]
        visual_page = visual_converter.convert_page(page, index + 1, asset_store, raster_scale, ocr_lang)
        attach_reference_frame_geometry(visual_converter, page, visual_page, raster_scale, ocr_lang)
        setattr(
            visual_page,
            "_v104_status_value_blocks",
            v104_extract_status_value_blocks_from_fitz_page(page, visual_page, v202_resolve_page_frame_bounds(visual_page)),
        )
        visual_pages.append(visual_page)
        edit_pages.append(edit_converter.convert_page(page, index + 1, raster_scale, ocr_lang))

    full_html = visual_converter.render_document(visual_pages, input_pdf.stem, scale)
    render_model = build_render_model(visual_pages, engine_config["clone_id"])
    fragment_html = body_fragment_from_v201_html(
        full_html,
        render_model,
        visual_pages,
        edit_pages,
        scale,
        engine_config["clone_id"],
    )
    summary = build_model_summary(visual_pages, edit_pages)

    return {
        "sourceTitle": input_pdf.stem,
        "html": fragment_html,
        "extractionStage": "full",
        "pageCount": len(visual_pages),
        "sourceMode": page_source_mode(edit_pages),
        "documentFamily": "generic_form",
        "cloneBuilder": engine_config["clone_builder"],
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
            "Build template extract HTML for v2.0x. "
            "v2.2 resets the branch on top of the v2.05 structured DOM path and prioritizes frame fidelity; "
            "v2.01 keeps raster-first visual overlays; v2.02 emits structured edit DOM; "
            "v2.03 adds direct in-place editing and stronger text fallback; "
            "v2.04 keeps one-cell context and adds admin-scoped key editing; "
            "v2.05 makes composite cells a single parent editor with protected admin labels; "
            "v2.11 anchors header/footer text outside the frame without duplication; "
            "v2.12 keeps the v2.01 visual-first renderer while normalizing outside-frame semantic text."
        )
    )
    parser.add_argument("--input-pdf", required=True)
    parser.add_argument("--engine-version", default=DEFAULT_ENGINE_VERSION)
    parser.add_argument("--extraction-stage", default="full")
    parser.add_argument("--frame-group-version", default="v1.11-default")
    parser.add_argument("--scale", type=float, default=1.28)
    parser.add_argument("--raster-scale", type=float, default=3.2)
    parser.add_argument("--ocr-lang", default="kor+eng")
    args = parser.parse_args()

    input_pdf = Path(args.input_pdf)

    if not input_pdf.exists():
        raise FileNotFoundError(f"input pdf not found: {input_pdf}")

    result = convert(
        input_pdf,
        args.scale,
        args.raster_scale,
        args.ocr_lang,
        args.engine_version,
        args.extraction_stage,
        args.frame_group_version,
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
