'use client';

import Link from 'next/link';
import * as React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { EntityPicker } from '../ui/EntityPicker';
import { Input } from '../ui/Input';
import { applyTemplateExtractEditableTextFit } from '../../lib/templateExtractEditableTextFit';
import type {
  TemplateEdgeDescriptorDto,
  TemplateEdgeFrameDto,
  TemplateEdgeSelectionStateDto,
  TemplateEdgeSide,
  TemplateEdgeTopologySnapshotDto,
} from '../../lib/templateEdgeSelectionDtos';
import type { TemplateDetailResult, TemplateLayoutResizeMode, TemplateRecordDto } from '../../lib/templateDtos';
import type { TemplateFrameResizeDirection } from '../../lib/templateFrameEditDtos';
import { TemplateEdgeSelectionService } from '../../services/templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from '../../services/templateEdgeTopologyService';
import { TemplateFrameEditGeometryService } from '../../services/templateFrameEditGeometryService';
import { TemplateFrameEditHtmlService } from '../../services/templateFrameEditHtmlService';

type TemplateOption = {
  id: string;
  label: string;
  meta: string;
  keywords: string[];
};

type FrameNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SelectionStyleDraft = {
  width: string;
  height: string;
  fontSize: string;
  lineHeight: string;
  paddingX: string;
  paddingY: string;
  borderRadius: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color: string;
  backgroundColor: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  anchorRect: FrameNodeRect;
  nodes: Array<{
    node: HTMLElement;
    rect: FrameNodeRect;
  }>;
};

type ResizeState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  direction: TemplateFrameResizeDirection;
  node: HTMLElement;
  rect: FrameNodeRect;
  widthInstructions?: FrameWidthResizeInstruction[];
  edgeResizeTargets?: EdgeResizeTarget[];
};

type EdgePressState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  node: HTMLElement;
  direction: TemplateFrameResizeDirection;
  side: TemplateEdgeSide;
  clickedEdgeId: string;
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
  withShift: boolean;
};

type BoundaryShrinkRange = {
  startIndex: number;
  endIndex: number;
  side: 'before' | 'after';
};

type FrameWidthResizeInstruction =
  | {
      kind: 'boundary';
      shell: HTMLElement;
      boundaryIndex: number;
      shrinkRange?: BoundaryShrinkRange;
      minimumStopRange?: BoundaryShrinkRange;
    }
  | { kind: 'outer-left'; shell: HTMLElement; shrinkRange?: BoundaryShrinkRange; minimumStopRange?: BoundaryShrinkRange }
  | { kind: 'outer-right'; shell: HTMLElement; shrinkRange?: BoundaryShrinkRange; minimumStopRange?: BoundaryShrinkRange };

type EdgeResizeTarget = {
  node: HTMLElement;
  shell: HTMLElement;
  side: TemplateEdgeSide;
  boundaryIndex: number | null;
  widthInstructions?: FrameWidthResizeInstruction[];
};

type TemplateEditWorkspaceProps = {
  initialTemplateId?: string;
};

const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SELECTION_NODE_SELECTOR = RAW_FRAME_NODE_SELECTOR;
const FRAME_SELECTION_BADGE_CLASS = 'v106-frame-selection-badge';
const FRAME_RESIZE_HANDLE_SELECTOR = '[data-v106-resize-handle="true"]';
const FRAME_EDGE_BUTTON_SELECTOR = '[data-v106-edge-button="true"]';
const FRAME_RESIZE_DIRECTIONS: TemplateFrameResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const EDGE_DRAG_START_THRESHOLD_PX = 4;

const defaultSelectionStyleDraft: SelectionStyleDraft = {
  width: '',
  height: '',
  fontSize: '',
  lineHeight: '',
  paddingX: '',
  paddingY: '',
  borderRadius: '',
  fontWeight: '',
  textAlign: 'left',
  color: '#0f172a',
  backgroundColor: '#ffffff',
};

const presetStylePatches: Record<
  string,
  Partial<SelectionStyleDraft> & {
    width?: number;
    height?: number;
  }
> = {
  label: {
    fontSize: '12',
    fontWeight: '600',
    lineHeight: '1.35',
    paddingX: '2',
    paddingY: '2',
    borderRadius: '4',
    textAlign: 'left',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  input: {
    fontSize: '13',
    fontWeight: '500',
    lineHeight: '1.45',
    paddingX: '6',
    paddingY: '4',
    borderRadius: '8',
    textAlign: 'left',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  body: {
    fontSize: '14',
    fontWeight: '400',
    lineHeight: '1.55',
    paddingX: '4',
    paddingY: '3',
    borderRadius: '4',
    textAlign: 'left',
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  focus: {
    fontSize: '14',
    fontWeight: '700',
    lineHeight: '1.45',
    paddingX: '6',
    paddingY: '4',
    borderRadius: '10',
    textAlign: 'center',
    color: '#0f172a',
    backgroundColor: '#fef3c7',
  },
};

const FRAME_RESIZE_TOLERANCE_PX = 2;
const MIN_FRAME_SIZE_PX = 12;
const MIN_TABLE_COLUMN_WIDTH_PX = MIN_FRAME_SIZE_PX;
const MIN_TABLE_ROW_HEIGHT_PX = 12;
const MIN_WRITABLE_TABLE_SIZE_PX = 1;
const FRAME_SCAFFOLD_TRACK_THRESHOLD_PX = 4;

const parseFramePx = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveFrameLayoutShell = (node: HTMLElement) => node.closest<HTMLElement>('.v102-frame-band') || node;

const resolveFrameLayoutTable = (node: HTMLElement) => {
  const shell = resolveFrameLayoutShell(node);
  return shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || node.closest<HTMLTableElement>('table');
};

const readFrameElementRect = (element: HTMLElement, pageInner?: HTMLElement | null): FrameNodeRect => {
  const resolvedPageInner = pageInner || element.closest<HTMLElement>('.page-inner');
  const pageRect = resolvedPageInner?.getBoundingClientRect() || null;
  const elementRect = element.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const hasInlineLeft = element.style.left.trim() !== '';
  const hasInlineTop = element.style.top.trim() !== '';
  const hasInlineWidth = element.style.width.trim() !== '';
  const hasInlineHeight = element.style.height.trim() !== '';

  return {
    left: hasInlineLeft ? parseFramePx(element.style.left) : Math.max(0, elementRect.left - (pageRect?.left || 0)),
    top: hasInlineTop ? parseFramePx(element.style.top) : Math.max(0, elementRect.top - (pageRect?.top || 0)),
    width: Math.max(1, hasInlineWidth ? parseFramePx(element.style.width) : parseFramePx(computedStyle.width) || elementRect.width),
    height: Math.max(
      1,
      hasInlineHeight ? parseFramePx(element.style.height) : parseFramePx(computedStyle.height) || elementRect.height
    ),
  };
};

const readFrameMoveRect = (node: HTMLElement): FrameNodeRect => readFrameElementRect(resolveFrameLayoutShell(node));

const readTableColWidths = (table: HTMLTableElement | null) => {
  if (!table) {
    return [];
  }

  return Array.from(table.querySelectorAll<HTMLTableColElement>('col')).map((col) => {
    const computedWidth = parseFramePx(getComputedStyle(col).width);
    return computedWidth > 0 ? computedWidth : MIN_TABLE_COLUMN_WIDTH_PX;
  });
};

const readTableRowHeights = (table: HTMLTableElement | null) => {
  if (!table) {
    return [];
  }

  return Array.from(table.querySelectorAll<HTMLTableRowElement>('tr')).map((row) => {
    const computedHeight = parseFramePx(getComputedStyle(row).height) || row.getBoundingClientRect().height;
    return computedHeight > 0 ? computedHeight : MIN_TABLE_ROW_HEIGHT_PX;
  });
};

const buildBoundaries = (sizes: number[]) => {
  const boundaries = [0];
  let cursor = 0;
  sizes.forEach((size) => {
    cursor += size;
    boundaries.push(cursor);
  });
  return boundaries;
};

const getWritableTableSize = (value: number) =>
  Math.max(MIN_WRITABLE_TABLE_SIZE_PX, Number.isFinite(value) ? value : MIN_WRITABLE_TABLE_SIZE_PX);

const readTableSizeMinimums = (
  table: HTMLTableElement | null,
  axis: 'col' | 'row',
  sizes: number[],
  fallbackMinimum: number
) => {
  if (!table) {
    return [];
  }

  const datasetKey = axis === 'col' ? 'templateFrameColMinimums' : 'templateFrameRowMinimums';
  const cached = table.dataset[datasetKey];

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length === sizes.length) {
        return parsed.map((value) => getWritableTableSize(Number(value) || 0));
      }
    } catch {
      // Ignore malformed cache and rebuild from the current table layout.
    }
  }

  const minimums = sizes.map((size) => getWritableTableSize(Math.min(Math.max(size, 0), fallbackMinimum)));
  table.dataset[datasetKey] = JSON.stringify(minimums);
  return minimums;
};

const readTableColMinimums = (table: HTMLTableElement | null, colWidths?: number[]) =>
  readTableSizeMinimums(table, 'col', colWidths || readTableColWidths(table), MIN_TABLE_COLUMN_WIDTH_PX);

const readTableRowMinimums = (table: HTMLTableElement | null, rowHeights?: number[]) =>
  readTableSizeMinimums(table, 'row', rowHeights || readTableRowHeights(table), MIN_TABLE_ROW_HEIGHT_PX);

const getRangeShrinkCapacity = (sizes: number[], minimums: number[], range: BoundaryShrinkRange) => {
  let capacity = 0;

  for (let index = range.startIndex; index <= range.endIndex; index += 1) {
    const currentSize = getWritableTableSize(sizes[index] || 0);
    const minSize = getWritableTableSize(minimums[index] || 0);
    capacity += Math.max(0, currentSize - minSize);
  }

  return capacity;
};

const growSizeRangeEdge = (sizes: number[], range: BoundaryShrinkRange, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  if (range.side === 'before') {
    sizes[range.endIndex] = getWritableTableSize(sizes[range.endIndex] || 0) + amount;
    return amount;
  }

  sizes[range.startIndex] = getWritableTableSize(sizes[range.startIndex] || 0) + amount;
  return amount;
};

const shrinkSizeRange = (sizes: number[], minimums: number[], range: BoundaryShrinkRange, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  const indices: number[] = [];

  if (range.side === 'before') {
    for (let index = range.endIndex; index >= range.startIndex; index -= 1) {
      indices.push(index);
    }
  } else {
    for (let index = range.startIndex; index <= range.endIndex; index += 1) {
      indices.push(index);
    }
  }

  let remaining = amount;

  indices.forEach((index) => {
    if (remaining <= 0) {
      return;
    }

    const currentSize = getWritableTableSize(sizes[index] || 0);
    const minSize = getWritableTableSize(minimums[index] || 0);
    const shrinkable = Math.max(0, currentSize - minSize);
    const applied = Math.min(remaining, shrinkable);
    sizes[index] = currentSize - applied;
    remaining -= applied;
  });

  return amount - remaining;
};

const findClosestBoundaryIndex = (boundaries: number[], target: number) => {
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  boundaries.forEach((boundary, index) => {
    const diff = Math.abs(boundary - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
};

const setTableColWidths = (table: HTMLTableElement, colWidths: number[]) => {
  const cols = Array.from(table.querySelectorAll<HTMLTableColElement>('col'));
  cols.forEach((col, index) => {
    const nextWidth = Math.round(getWritableTableSize(colWidths[index] || 0));
    col.style.width = `${nextWidth}px`;
    col.setAttribute('width', String(nextWidth));
  });
};

const setTableRowHeights = (table: HTMLTableElement, rowHeights: number[]) => {
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'));
  rows.forEach((row, index) => {
    const nextHeight = Math.round(getWritableTableSize(rowHeights[index] || 0));
    row.style.height = `${nextHeight}px`;
  });
};

const syncShellSizeFromTable = (
  shell: HTMLElement,
  table: HTMLTableElement | null,
  colWidths: number[],
  rowHeights: number[],
  axes: {
    width?: boolean;
    height?: boolean;
  } = {}
) => {
  const syncWidth = axes.width ?? true;
  const syncHeight = axes.height ?? true;
  const totalWidth = colWidths.length > 0 ? colWidths.reduce((sum, width) => sum + getWritableTableSize(width), 0) : 0;
  const totalHeight =
    rowHeights.length > 0 ? rowHeights.reduce((sum, height) => sum + getWritableTableSize(height), 0) : 0;

  if (syncWidth && totalWidth > 0) {
    shell.style.width = `${Math.round(totalWidth)}px`;
  }

  if (syncHeight && totalHeight > 0) {
    shell.style.height = `${Math.round(totalHeight)}px`;
  }

  if (table) {
    if (syncWidth && totalWidth > 0) {
      table.style.width = `${Math.round(totalWidth)}px`;
    }

    if (syncHeight && totalHeight > 0) {
      table.style.height = `${Math.round(totalHeight)}px`;
    }
  }
};

const buildFrameResizeContext = (node: HTMLElement) => {
  const shell = resolveFrameLayoutShell(node);
  const table = resolveFrameLayoutTable(node);
  const pageInner = shell.closest<HTMLElement>('.page-inner');
  const cell = node.matches('td')
    ? node
    : table?.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${getFrameGroupId(node)}"]`) ||
      table?.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) ||
      node;
  const frameCellCount = table?.querySelectorAll(RAW_FRAME_NODE_SELECTOR).length || 1;
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const singleCellBand = frameCellCount <= 1 && colWidths.length <= 1 && rowHeights.length <= 1;
  const shellRect = readFrameElementRect(shell, pageInner);
  const cellRect = readFrameElementRect(cell, pageInner);
  const tableRect = table?.getBoundingClientRect() || shell.getBoundingClientRect();
  const borderLeft = table ? parseFramePx(getComputedStyle(table).borderLeftWidth) : 0;
  const borderTop = table ? parseFramePx(getComputedStyle(table).borderTopWidth) : 0;
  const relativeLeft = cell.getBoundingClientRect().left - tableRect.left - borderLeft;
  const relativeTop = cell.getBoundingClientRect().top - tableRect.top - borderTop;
  const colBoundaries = buildBoundaries(colWidths);
  const rowBoundaries = buildBoundaries(rowHeights);
  const domColSpan = cell instanceof HTMLTableCellElement ? Math.max(1, cell.colSpan) : 1;
  const domRowSpan = cell instanceof HTMLTableCellElement ? Math.max(1, cell.rowSpan) : 1;
  const startColIndex = findClosestBoundaryIndex(colBoundaries, relativeLeft);
  const startRowIndex = findClosestBoundaryIndex(rowBoundaries, relativeTop);
  const endColIndex = Math.max(startColIndex + 1, Math.min(colBoundaries.length - 1, startColIndex + domColSpan));
  const endRowIndex = Math.max(startRowIndex + 1, Math.min(rowBoundaries.length - 1, startRowIndex + domRowSpan));
  const layoutCellRect =
    colBoundaries.length > 1 && rowBoundaries.length > 1
      ? {
          left: shellRect.left + borderLeft + (colBoundaries[startColIndex] || 0),
          top: shellRect.top + borderTop + (rowBoundaries[startRowIndex] || 0),
          width: Math.max(1, (colBoundaries[endColIndex] || 0) - (colBoundaries[startColIndex] || 0)),
          height: Math.max(1, (rowBoundaries[endRowIndex] || 0) - (rowBoundaries[startRowIndex] || 0)),
        }
      : cellRect;

  return {
    pageInner,
    shell,
    table,
    cell,
    shellRect,
    cellRect: layoutCellRect,
    colWidths,
    rowHeights,
    colBoundaries,
    rowBoundaries,
    startColIndex,
    endColIndex,
    startRowIndex,
    endRowIndex,
    singleCellBand,
  };
};

const readFrameNodeRect = (node: HTMLElement): FrameNodeRect => {
  const context = buildFrameResizeContext(node);
  return context.singleCellBand ? context.shellRect : context.cellRect;
};

const filterResizeSnapRects = (
  siblingRects: FrameNodeRect[],
  anchorRect: FrameNodeRect,
  direction: TemplateFrameResizeDirection
) => {
  const anchorLeft = anchorRect.left;
  const anchorRight = anchorRect.left + anchorRect.width;
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;

  return siblingRects.filter((rect) => {
    const rectLeft = rect.left;
    const rectRight = rect.left + rect.width;
    const rectTop = rect.top;
    const rectBottom = rect.top + rect.height;

    if (direction.includes('e') || direction.includes('w')) {
      const pinnedX = direction.includes('e') ? anchorRight : anchorLeft;
      if (
        Math.abs(rectLeft - pinnedX) <= FRAME_RESIZE_TOLERANCE_PX ||
        Math.abs(rectRight - pinnedX) <= FRAME_RESIZE_TOLERANCE_PX
      ) {
        return false;
      }
    }

    if (direction.includes('n') || direction.includes('s')) {
      const pinnedY = direction.includes('s') ? anchorBottom : anchorTop;
      if (
        Math.abs(rectTop - pinnedY) <= FRAME_RESIZE_TOLERANCE_PX ||
        Math.abs(rectBottom - pinnedY) <= FRAME_RESIZE_TOLERANCE_PX
      ) {
        return false;
      }
    }

    return true;
  });
};

const stabilizeFrameContentHeight = (node: HTMLElement) => {
  const contentTarget = resolveFrameContentTarget(node);
  node.style.overflow = 'hidden';

  if (contentTarget && contentTarget !== node) {
    contentTarget.style.height = '100%';
    contentTarget.style.maxHeight = '100%';
    contentTarget.style.overflow = 'hidden';
  }
};

const ensurePageInnerBaseMinHeight = (pageInner: HTMLElement) => {
  if (!pageInner.dataset.templateBaseMinHeight) {
    pageInner.dataset.templateBaseMinHeight = String(
      parseFramePx(pageInner.style.minHeight || getComputedStyle(pageInner).minHeight || '0')
    );
  }

  return Math.max(MIN_FRAME_SIZE_PX, Number.parseFloat(pageInner.dataset.templateBaseMinHeight || '0') || 0);
};

const updatePageInnerMinHeight = (pageInner: HTMLElement) => {
  const baseMinHeight = ensurePageInnerBaseMinHeight(pageInner);
  const shells = Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band'));
  const maxBottom = shells.reduce((maxBottomValue, shell) => {
    const rect = readFrameElementRect(shell, pageInner);
    return Math.max(maxBottomValue, rect.top + rect.height);
  }, baseMinHeight);
  pageInner.style.minHeight = `${Math.max(baseMinHeight, Math.ceil(maxBottom))}px`;
};

const applyOuterRightWidthDelta = (
  shell: HTMLElement,
  delta: number,
  shrinkRange?: BoundaryShrinkRange,
  minimumStopRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableColMinimums(table, colWidths);

  if (!table || colWidths.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextWidth = Math.max(MIN_FRAME_SIZE_PX, Math.round(shellRect.width + delta));
    shell.style.width = `${nextWidth}px`;
    return nextWidth - shellRect.width;
  }

  const nextColWidths = [...colWidths];
  const lastIndex = nextColWidths.length - 1;

  if (delta >= 0) {
    if (shrinkRange?.side === 'before') {
      growSizeRangeEdge(nextColWidths, shrinkRange, delta);
    } else {
      nextColWidths[lastIndex] += delta;
    }
    setTableColWidths(table, nextColWidths);
    syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
    return delta;
  }

  const effectiveShrinkRange = minimumStopRange || shrinkRange;
  const shrinkable =
    effectiveShrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextColWidths, minimums, effectiveShrinkRange)
      : Math.max(0, nextColWidths[lastIndex] - getWritableTableSize(minimums[lastIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (effectiveShrinkRange?.side === 'before') {
    shrinkSizeRange(nextColWidths, minimums, effectiveShrinkRange, applied);
  } else {
    nextColWidths[lastIndex] -= applied;
  }
  setTableColWidths(table, nextColWidths);
  syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
  return -applied;
};

const applyOuterLeftWidthDelta = (
  shell: HTMLElement,
  delta: number,
  shrinkRange?: BoundaryShrinkRange,
  minimumStopRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableColMinimums(table, colWidths);
  const currentLeft = parseFramePx(shell.style.left);

  if (!table || colWidths.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextWidth = Math.max(MIN_FRAME_SIZE_PX, Math.round(shellRect.width - delta));
    const appliedDelta = shellRect.width - nextWidth;
    shell.style.left = `${Math.round(currentLeft + appliedDelta)}px`;
    shell.style.width = `${Math.round(nextWidth)}px`;
    return appliedDelta;
  }

  const firstIndex = 0;

  if (delta >= 0) {
    const nextColWidths = [...colWidths];
    const effectiveShrinkRange = minimumStopRange || shrinkRange;
    const shrinkable =
      effectiveShrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextColWidths, minimums, effectiveShrinkRange)
        : Math.max(0, nextColWidths[firstIndex] - getWritableTableSize(minimums[firstIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    if (effectiveShrinkRange?.side === 'after') {
      shrinkSizeRange(nextColWidths, minimums, effectiveShrinkRange, applied);
    } else {
      nextColWidths[firstIndex] -= applied;
    }
    shell.style.left = `${Math.round(currentLeft + applied)}px`;
    setTableColWidths(table, nextColWidths);
    syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
    return applied;
  }

  const nextColWidths = [...colWidths];
  if (shrinkRange?.side === 'after') {
    growSizeRangeEdge(nextColWidths, shrinkRange, Math.abs(delta));
  } else {
    nextColWidths[firstIndex] += Math.abs(delta);
  }
  shell.style.left = `${Math.round(currentLeft + delta)}px`;
  setTableColWidths(table, nextColWidths);
  syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
  return delta;
};

const applyTableBoundaryWidthDelta = (
  shell: HTMLElement,
  boundaryIndex: number,
  delta: number,
  shrinkRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableColMinimums(table, colWidths);

  if (!table || colWidths.length === 0 || boundaryIndex <= 0 || boundaryIndex >= colWidths.length) {
    return 0;
  }

  const nextColWidths = [...colWidths];
  const leftIndex = boundaryIndex - 1;
  const rightIndex = boundaryIndex;

  if (delta >= 0) {
    const shrinkable =
      shrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextColWidths, minimums, shrinkRange)
        : Math.max(0, nextColWidths[rightIndex] - getWritableTableSize(minimums[rightIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    nextColWidths[leftIndex] += applied;
    if (shrinkRange?.side === 'after') {
      shrinkSizeRange(nextColWidths, minimums, shrinkRange, applied);
    } else {
      nextColWidths[rightIndex] -= applied;
    }
    setTableColWidths(table, nextColWidths);
    syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
    return applied;
  }

  const shrinkable =
    shrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextColWidths, minimums, shrinkRange)
      : Math.max(0, nextColWidths[leftIndex] - getWritableTableSize(minimums[leftIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (shrinkRange?.side === 'before') {
    shrinkSizeRange(nextColWidths, minimums, shrinkRange, applied);
  } else {
    nextColWidths[leftIndex] -= applied;
  }
  nextColWidths[rightIndex] += applied;
  setTableColWidths(table, nextColWidths);
  syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
  return -applied;
};

const getWidthDeltaCapacity = (
  shell: HTMLElement,
  mode: 'left' | 'right' | 'boundary-left' | 'boundary-right',
  boundaryIndex = 0,
  shrinkRange?: BoundaryShrinkRange,
  minimumStopRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const minimums = readTableColMinimums(table, colWidths);

  if (colWidths.length === 0) {
    const shellRect = readFrameElementRect(shell);
    return Math.max(0, shellRect.width - MIN_FRAME_SIZE_PX);
  }

  if (mode === 'left') {
    const effectiveShrinkRange = minimumStopRange || shrinkRange;
    if (effectiveShrinkRange?.side === 'after') {
      return getRangeShrinkCapacity(colWidths, minimums, effectiveShrinkRange);
    }

    return Math.max(0, (colWidths[0] || 0) - getWritableTableSize(minimums[0] || 0));
  }

  if (mode === 'right') {
    const effectiveShrinkRange = minimumStopRange || shrinkRange;
    if (effectiveShrinkRange?.side === 'before') {
      return getRangeShrinkCapacity(colWidths, minimums, effectiveShrinkRange);
    }

    return Math.max(
      0,
      (colWidths[colWidths.length - 1] || 0) - getWritableTableSize(minimums[colWidths.length - 1] || 0)
    );
  }

  if (mode === 'boundary-left') {
    if (shrinkRange?.side === 'before') {
      return getRangeShrinkCapacity(colWidths, minimums, shrinkRange);
    }

    return Math.max(0, (colWidths[boundaryIndex - 1] || 0) - getWritableTableSize(minimums[boundaryIndex - 1] || 0));
  }

  if (shrinkRange?.side === 'after') {
    return getRangeShrinkCapacity(colWidths, minimums, shrinkRange);
  }

  return Math.max(0, (colWidths[boundaryIndex] || 0) - getWritableTableSize(minimums[boundaryIndex] || 0));
};

const hasLeadingScaffoldColumns = (context: ReturnType<typeof buildFrameResizeContext>) => {
  if (!context.table || context.startColIndex <= 0 || context.cell.previousElementSibling) {
    return false;
  }

  const minimums = readTableColMinimums(context.table, context.colWidths);
  const leadingMinimums = minimums.slice(0, context.startColIndex);
  return leadingMinimums.length > 0 && leadingMinimums.every((width) => width <= FRAME_SCAFFOLD_TRACK_THRESHOLD_PX);
};

const hasTrailingScaffoldColumns = (context: ReturnType<typeof buildFrameResizeContext>) => {
  if (!context.table || context.endColIndex >= context.colWidths.length || context.cell.nextElementSibling) {
    return false;
  }

  const minimums = readTableColMinimums(context.table, context.colWidths);
  const trailingMinimums = minimums.slice(context.endColIndex);
  return trailingMinimums.length > 0 && trailingMinimums.every((width) => width <= FRAME_SCAFFOLD_TRACK_THRESHOLD_PX);
};

const readTableCellColBoundarySpans = (table: HTMLTableElement, colBoundaries: number[]) => {
  const tableRect = table.getBoundingClientRect();
  const borderLeft = parseFramePx(getComputedStyle(table).borderLeftWidth);

  return Array.from(table.querySelectorAll<HTMLTableCellElement>('td,th')).map((cell) => {
    const cellRect = cell.getBoundingClientRect();
    const relativeLeft = cellRect.left - tableRect.left - borderLeft;
    const startIndex = findClosestBoundaryIndex(colBoundaries, relativeLeft);
    const endIndex = Math.max(startIndex + 1, Math.min(colBoundaries.length - 1, startIndex + Math.max(1, cell.colSpan)));

    return {
      startIndex,
      endIndex,
    };
  });
};

const resolveOuterWidthMinimumStopRange = (
  shell: HTMLElement,
  edge: 'left' | 'right'
): BoundaryShrinkRange | undefined => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);

  if (!table || colWidths.length <= 1) {
    return undefined;
  }

  const colBoundaries = buildBoundaries(colWidths);
  const cellSpans = readTableCellColBoundarySpans(table, colBoundaries);

  if (edge === 'right') {
    const alignedStartIndex = cellSpans.reduce((maxStartIndex, span) => {
      if (span.endIndex !== colWidths.length) {
        return maxStartIndex;
      }

      return Math.max(maxStartIndex, span.startIndex);
    }, -1);

    if (alignedStartIndex < 0) {
      return undefined;
    }

    return {
      startIndex: alignedStartIndex,
      endIndex: colWidths.length - 1,
      side: 'before',
    };
  }

  const alignedEndIndex = cellSpans.reduce((minEndIndex, span) => {
    if (span.startIndex !== 0) {
      return minEndIndex;
    }

    return minEndIndex < 0 ? span.endIndex : Math.min(minEndIndex, span.endIndex);
  }, -1);

  if (alignedEndIndex <= 0) {
    return undefined;
  }

  return {
    startIndex: 0,
    endIndex: Math.max(0, alignedEndIndex - 1),
    side: 'after',
  };
};

const buildSelfWidthResizeInstruction = (
  context: ReturnType<typeof buildFrameResizeContext>,
  edge: 'left' | 'right'
): FrameWidthResizeInstruction | null => {
  if (context.singleCellBand || !context.table || context.colWidths.length === 0) {
    return {
      kind: edge === 'left' ? 'outer-left' : 'outer-right',
      shell: context.shell,
      minimumStopRange: resolveOuterWidthMinimumStopRange(context.shell, edge),
      shrinkRange:
        edge === 'left'
          ? {
              startIndex: context.startColIndex,
              endIndex: context.endColIndex - 1,
              side: 'after',
            }
          : {
              startIndex: context.startColIndex,
              endIndex: context.endColIndex - 1,
              side: 'before',
            },
    };
  }

  if (edge === 'left') {
    if (context.startColIndex <= 0 || hasLeadingScaffoldColumns(context)) {
      return {
        kind: 'outer-left',
        shell: context.shell,
        minimumStopRange: resolveOuterWidthMinimumStopRange(context.shell, 'left'),
        shrinkRange: {
          startIndex: context.startColIndex,
          endIndex: context.endColIndex - 1,
          side: 'after',
        },
      };
    }

    return {
      kind: 'boundary',
      shell: context.shell,
      boundaryIndex: context.startColIndex,
      shrinkRange: {
        startIndex: context.startColIndex,
        endIndex: context.endColIndex - 1,
        side: 'after',
      },
    };
  }

  if (context.endColIndex >= context.colWidths.length || hasTrailingScaffoldColumns(context)) {
    return {
      kind: 'outer-right',
      shell: context.shell,
      minimumStopRange: resolveOuterWidthMinimumStopRange(context.shell, 'right'),
      shrinkRange: {
        startIndex: context.startColIndex,
        endIndex: context.endColIndex - 1,
        side: 'before',
      },
    };
  }

  return {
    kind: 'boundary',
    shell: context.shell,
    boundaryIndex: context.endColIndex,
    shrinkRange: {
      startIndex: context.startColIndex,
      endIndex: context.endColIndex - 1,
      side: 'before',
    },
  };
};

const shiftShellsBelowBoundary = (
  pageInner: HTMLElement,
  boundaryY: number,
  deltaY: number,
  excludedShells: HTMLElement[] = []
) => {
  if (Math.abs(deltaY) < 0.5) {
    return;
  }

  const excludedSet = new Set(excludedShells);

  Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band')).forEach((shell) => {
    if (excludedSet.has(shell)) {
      return;
    }

    const shellRect = readFrameElementRect(shell, pageInner);

    if (shellRect.top >= boundaryY - FRAME_RESIZE_TOLERANCE_PX) {
      shell.style.top = `${Math.round(shellRect.top + deltaY)}px`;
    }
  });
};

const applyOuterBottomHeightDelta = (shell: HTMLElement, delta: number, shrinkRange?: BoundaryShrinkRange) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableRowMinimums(table, rowHeights);

  if (!table || rowHeights.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextHeight = Math.max(MIN_FRAME_SIZE_PX, Math.round(shellRect.height + delta));
    shell.style.height = `${nextHeight}px`;
    return nextHeight - shellRect.height;
  }

  const nextRowHeights = [...rowHeights];
  const lastIndex = nextRowHeights.length - 1;

  if (delta >= 0) {
    nextRowHeights[lastIndex] += delta;
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return delta;
  }

  const shrinkable =
    shrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
      : Math.max(0, nextRowHeights[lastIndex] - getWritableTableSize(minimums[lastIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (shrinkRange?.side === 'before') {
    shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
  } else {
    nextRowHeights[lastIndex] -= applied;
  }
  setTableRowHeights(table, nextRowHeights);
  syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
  return -applied;
};

const applyFrameResizeHeightDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return 0;
  }

  const boundaryY = context.cellRect.top + context.cellRect.height;
  let appliedDelta = 0;

  const resizesOuterBottom = context.singleCellBand || context.rowHeights.length <= context.endRowIndex;

  if (resizesOuterBottom) {
    appliedDelta = applyOuterBottomHeightDelta(context.shell, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'before',
    });
  } else if (context.table) {
    appliedDelta = applyTableBoundaryHeightDelta(context.shell, context.endRowIndex, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'before',
    });
  }

  if (resizesOuterBottom && Math.abs(appliedDelta) > 0.5) {
    shiftShellsBelowBoundary(context.pageInner, boundaryY, appliedDelta, [context.shell]);
    updatePageInnerMinHeight(context.pageInner);
  }

  if (Math.abs(appliedDelta) > 0.5) {
    stabilizeFrameContentHeight(node);
  }

  return appliedDelta;
};

const collectWidthResizeInstructions = (
  context: ReturnType<typeof buildFrameResizeContext>,
  edge: 'left' | 'right' = 'right'
): FrameWidthResizeInstruction[] => {
  const pageInner = context.pageInner;

  if (!pageInner) {
    return [];
  }

  const selectedBoundaryUsesOuterLeft = edge === 'left' && hasLeadingScaffoldColumns(context);
  const selectedBoundaryUsesOuterRight = edge === 'right' && hasTrailingScaffoldColumns(context);
  const boundaryX =
    edge === 'left'
      ? selectedBoundaryUsesOuterLeft
        ? context.shellRect.left
        : context.cellRect.left
      : selectedBoundaryUsesOuterRight
        ? context.shellRect.left + context.shellRect.width
        : context.cellRect.left + context.cellRect.width;
  const pageShells = Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band'));

  return pageShells.flatMap((shell) => {
    const shellRect = readFrameElementRect(shell, pageInner);
    const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
    const colWidths = readTableColWidths(table);
    const boundaries = buildBoundaries(colWidths);
    const internalBoundaryIndex =
      colWidths.length > 1
        ? boundaries.findIndex(
            (boundary, index) =>
              index > 0 &&
              index < boundaries.length - 1 &&
              Math.abs(shellRect.left + boundary - boundaryX) <= FRAME_RESIZE_TOLERANCE_PX
          )
        : -1;

    const nextInstructions: FrameWidthResizeInstruction[] = [];
    const skipSelectedInternalBoundary =
      shell === context.shell &&
      ((edge === 'left' && selectedBoundaryUsesOuterLeft) || (edge === 'right' && selectedBoundaryUsesOuterRight));

    if (internalBoundaryIndex > 0 && !skipSelectedInternalBoundary) {
      nextInstructions.push({
        kind: 'boundary',
        shell,
        boundaryIndex: internalBoundaryIndex,
        shrinkRange:
          shell === context.shell
            ? {
                startIndex: context.startColIndex,
                endIndex: context.endColIndex - 1,
                side: edge === 'left' ? 'after' : 'before',
              }
            : undefined,
      });
      return nextInstructions;
    }

    if (Math.abs(shellRect.left - boundaryX) <= FRAME_RESIZE_TOLERANCE_PX) {
      nextInstructions.push({
        kind: 'outer-left',
        shell,
        minimumStopRange: resolveOuterWidthMinimumStopRange(shell, 'left'),
        shrinkRange:
          shell === context.shell
            ? {
                startIndex: context.startColIndex,
                endIndex: context.endColIndex - 1,
                side: 'after',
              }
            : undefined,
      });
    }

    if (Math.abs(shellRect.left + shellRect.width - boundaryX) <= FRAME_RESIZE_TOLERANCE_PX) {
      nextInstructions.push({
        kind: 'outer-right',
        shell,
        minimumStopRange: resolveOuterWidthMinimumStopRange(shell, 'right'),
        shrinkRange:
          shell === context.shell
            ? {
                startIndex: context.startColIndex,
                endIndex: context.endColIndex - 1,
                side: 'before',
              }
            : undefined,
      });
    }

    return nextInstructions;
  });
};

const applyOuterTopHeightDelta = (shell: HTMLElement, delta: number, shrinkRange?: BoundaryShrinkRange) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableRowMinimums(table, rowHeights);
  const currentTop = parseFramePx(shell.style.top);

  if (!table || rowHeights.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextHeight = Math.max(MIN_FRAME_SIZE_PX, Math.round(shellRect.height - delta));
    const appliedDelta = shellRect.height - nextHeight;
    shell.style.top = `${Math.round(currentTop + appliedDelta)}px`;
    shell.style.height = `${Math.round(nextHeight)}px`;
    return appliedDelta;
  }

  const firstIndex = 0;

  if (delta >= 0) {
    const nextRowHeights = [...rowHeights];
    const shrinkable =
      shrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
        : Math.max(0, nextRowHeights[firstIndex] - getWritableTableSize(minimums[firstIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    if (shrinkRange?.side === 'after') {
      shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
    } else {
      nextRowHeights[firstIndex] -= applied;
    }
    shell.style.top = `${Math.round(currentTop + applied)}px`;
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return applied;
  }

  const nextRowHeights = [...rowHeights];
  nextRowHeights[firstIndex] += Math.abs(delta);
  shell.style.top = `${Math.round(currentTop + delta)}px`;
  setTableRowHeights(table, nextRowHeights);
  syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
  return delta;
};

const applyTableBoundaryHeightDelta = (
  shell: HTMLElement,
  boundaryIndex: number,
  delta: number,
  shrinkRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableRowMinimums(table, rowHeights);

  if (!table || rowHeights.length === 0 || boundaryIndex <= 0 || boundaryIndex >= rowHeights.length) {
    return 0;
  }

  const nextRowHeights = [...rowHeights];
  const upperIndex = boundaryIndex - 1;
  const lowerIndex = boundaryIndex;

  if (delta >= 0) {
    const shrinkable =
      shrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
        : Math.max(0, nextRowHeights[lowerIndex] - getWritableTableSize(minimums[lowerIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    nextRowHeights[upperIndex] += applied;
    if (shrinkRange?.side === 'after') {
      shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
    } else {
      nextRowHeights[lowerIndex] -= applied;
    }
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return applied;
  }

  const shrinkable =
    shrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
      : Math.max(0, nextRowHeights[upperIndex] - getWritableTableSize(minimums[upperIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (shrinkRange?.side === 'before') {
    shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
  } else {
    nextRowHeights[upperIndex] -= applied;
  }
  nextRowHeights[lowerIndex] += applied;
  setTableRowHeights(table, nextRowHeights);
  syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
  return -applied;
};

const applyFrameResizeTopDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return 0;
  }

  if (context.singleCellBand || context.startRowIndex === 0) {
    const appliedDelta = applyOuterTopHeightDelta(context.shell, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'after',
    });
    if (Math.abs(appliedDelta) > 0.5) {
      stabilizeFrameContentHeight(node);
    }
    return appliedDelta;
  }

  const appliedDelta = applyTableBoundaryHeightDelta(context.shell, context.startRowIndex, delta, {
    startIndex: context.startRowIndex,
    endIndex: context.endRowIndex - 1,
    side: 'after',
  });
  if (Math.abs(appliedDelta) > 0.5) {
    stabilizeFrameContentHeight(node);
  }
  return appliedDelta;
};

const applyFrameResizeWidthDelta = (
  node: HTMLElement,
  delta: number,
  lockedInstructions?: FrameWidthResizeInstruction[]
) => {
  const context = buildFrameResizeContext(node);
  const pageInner = context.pageInner;

  if (!pageInner || Math.abs(delta) < 0.5) {
    return 0;
  }

  const instructions = lockedInstructions && lockedInstructions.length > 0 ? lockedInstructions : collectWidthResizeInstructions(context);

  if (!instructions.length) {
    return 0;
  }

  let appliedDelta = delta;

  if (delta > 0) {
    const positiveCapacities = instructions
      .map((instruction) => {
        if (instruction.kind === 'boundary') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'boundary-right',
            instruction.boundaryIndex,
            instruction.shrinkRange
          );
        }

        if (instruction.kind === 'outer-left') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'left',
            0,
            instruction.shrinkRange,
            instruction.minimumStopRange
          );
        }

        return Number.POSITIVE_INFINITY;
      })
      .filter((value) => Number.isFinite(value));

    if (positiveCapacities.length > 0) {
      appliedDelta = Math.min(delta, ...positiveCapacities);
    }
  } else {
    const negativeCapacities = instructions
      .map((instruction) => {
        if (instruction.kind === 'boundary') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'boundary-left',
            instruction.boundaryIndex,
            instruction.shrinkRange
          );
        }

        if (instruction.kind === 'outer-right') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'right',
            0,
            instruction.shrinkRange,
            instruction.minimumStopRange
          );
        }

        return Number.POSITIVE_INFINITY;
      })
      .filter((value) => Number.isFinite(value));

    if (negativeCapacities.length > 0) {
      appliedDelta = -Math.min(Math.abs(delta), ...negativeCapacities);
    }
  }

  if (Math.abs(appliedDelta) < 0.5) {
    return 0;
  }

  instructions.forEach((instruction) => {
    if (instruction.kind === 'boundary') {
      applyTableBoundaryWidthDelta(
        instruction.shell,
        instruction.boundaryIndex,
        appliedDelta,
        instruction.shrinkRange
      );
      return;
    }

    if (instruction.kind === 'outer-left') {
      applyOuterLeftWidthDelta(
        instruction.shell,
        appliedDelta,
        instruction.shrinkRange,
        instruction.minimumStopRange
      );
      return;
    }

    applyOuterRightWidthDelta(
      instruction.shell,
      appliedDelta,
      instruction.shrinkRange,
      instruction.minimumStopRange
    );
  });

  return appliedDelta;
};

const writeFrameMoveRect = (node: HTMLElement, rect: FrameNodeRect) => {
  const shell = resolveFrameLayoutShell(node);
  shell.style.left = `${Math.round(rect.left)}px`;
  shell.style.top = `${Math.round(rect.top)}px`;
  shell.style.width = `${Math.max(MIN_FRAME_SIZE_PX, Math.round(rect.width))}px`;
  shell.style.height = `${Math.max(MIN_FRAME_SIZE_PX, Math.round(rect.height))}px`;
};

const writeFrameNodeRect = (node: HTMLElement, rect: FrameNodeRect) => {
  const currentRect = readFrameNodeRect(node);
  applyFrameResizeWidthDelta(node, rect.width - currentRect.width);
  applyFrameResizeHeightDelta(node, rect.height - currentRect.height);
};

const applyFrameResizeWithDirection = (
  node: HTMLElement,
  nextRect: FrameNodeRect,
  direction: TemplateFrameResizeDirection,
  widthInstructions?: FrameWidthResizeInstruction[]
) => {
  const currentRect = readFrameNodeRect(node);

  if (direction.includes('w')) {
    applyFrameResizeWidthDelta(node, nextRect.left - currentRect.left, widthInstructions);
  } else if (direction.includes('e')) {
    applyFrameResizeWidthDelta(node, nextRect.width - currentRect.width, widthInstructions);
  }

  if (direction.includes('n')) {
    applyFrameResizeTopDelta(node, nextRect.top - currentRect.top);
  } else if (direction.includes('s')) {
    applyFrameResizeHeightDelta(node, nextRect.height - currentRect.height);
  }
};

const normalizeEdgeSelectionState = (state: TemplateEdgeSelectionStateDto): TemplateEdgeSelectionStateDto => ({
  primaryTokenId: state.primaryTokenId,
  tokens: state.tokens.map((token) => ({
    ...token,
    memberEdgeIds: token.memberEdgeIds.slice().sort(),
  })),
});

const edgeSelectionStatesEqual = (
  left: TemplateEdgeSelectionStateDto,
  right: TemplateEdgeSelectionStateDto
) => JSON.stringify(normalizeEdgeSelectionState(left)) === JSON.stringify(normalizeEdgeSelectionState(right));

const edgeSelectionContainsEdge = (state: TemplateEdgeSelectionStateDto, edgeId: string) =>
  state.tokens.some((token) => token.memberEdgeIds.includes(edgeId));

const clampFrameNodeRect = (
  rect: FrameNodeRect,
  bounds: { width: number; height: number },
  minSize = MIN_FRAME_SIZE_PX
): FrameNodeRect => {
  const width = Math.max(minSize, Math.min(bounds.width, rect.width));
  const height = Math.max(minSize, Math.min(bounds.height, rect.height));
  const left = Math.max(0, Math.min(bounds.width - width, rect.left));
  const top = Math.max(0, Math.min(bounds.height - height, rect.top));
  return { left, top, width, height };
};

const getNextFrameSelection = (previous: string[], frameGroupId: string, isMultiSelect: boolean) => {
  if (isMultiSelect) {
    return previous.includes(frameGroupId)
      ? previous.filter((value) => value !== frameGroupId)
      : [...previous, frameGroupId];
  }

  return previous.includes(frameGroupId) ? previous : [frameGroupId];
};

const getFrameGroupId = (node: HTMLElement | null) => node?.getAttribute('data-template-frame-group')?.trim() || '';

const isInteractiveTarget = (target: HTMLElement | null) =>
  Boolean(
    target?.closest(
      'input, textarea, select, option, button, a, [contenteditable="true"], [data-template-frame-input="true"]'
    )
  );

const syncFormControlMarkup = (root: ParentNode) => {
  root.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((element) => {
    element.textContent = element.value;
  });

  root.querySelectorAll<HTMLInputElement>('input').forEach((element) => {
    if (element.type === 'checkbox' || element.type === 'radio') {
      if (element.checked) {
        element.setAttribute('checked', 'checked');
      } else {
        element.removeAttribute('checked');
      }
      return;
    }

    element.setAttribute('value', element.value);
  });
};

const stripSelectionAttrs = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
    element.removeAttribute('data-template-selected');
    element.removeAttribute('data-template-primary-selected');
    element.removeAttribute('data-template-selection-order');
  });
  root.querySelectorAll<HTMLElement>('[data-template-edge-visual="true"], [data-template-edge-anchor-node="true"]').forEach((element) => {
    element.removeAttribute('data-template-edge-visual');
    element.removeAttribute('data-template-edge-anchor-node');
  });
  root.querySelectorAll<HTMLElement>('[data-template-edit-enabled]').forEach((element) => {
    element.removeAttribute('data-template-edit-enabled');
  });
};

const extractEditorHtml = (root: HTMLElement) => {
  const container = document.createElement('div');
  container.innerHTML = root.innerHTML;
  syncFormControlMarkup(container);
  stripSelectionAttrs(container);
  TemplateFrameEditHtmlService.stripEditorUiState(container);
  return container.innerHTML.trim();
};

const applyPreviewEditPermissions = (root: HTMLElement) => {
  root.querySelectorAll<HTMLElement>('[data-template-edit-scope]').forEach((element) => {
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('data-template-edit-enabled', 'true');
  });
};

const markTemplateValueElementEdited = (element: HTMLElement) => {
  element.setAttribute('data-template-edited', 'true');
  element
    .closest('.v201-choice-row, .v202-line--choice')
    ?.setAttribute('data-template-edited', 'true');
};

const toggleChoiceBoxElement = (element: HTMLElement) => {
  const nextValue = element.getAttribute('data-checked') === '1' ? '0' : '1';
  element.setAttribute('data-checked', nextValue);
  element.setAttribute('aria-checked', nextValue === '1' ? 'true' : 'false');
  markTemplateValueElementEdited(element);
};

const rgbChannelToHex = (value: number) => value.toString(16).padStart(2, '0');

const colorToHex = (value: string) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('#')) {
    if (normalized.length === 4) {
      return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
    }

    return normalized.toLowerCase();
  }

  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!rgbMatch) {
    return normalized;
  }

  const [, r, g, b] = rgbMatch;
  return `#${rgbChannelToHex(Number.parseInt(r, 10))}${rgbChannelToHex(Number.parseInt(g, 10))}${rgbChannelToHex(Number.parseInt(b, 10))}`.toLowerCase();
};

const normalizeNumericStyleValue = (value: string) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(2))) : '';
};

const getSharedValue = (values: string[]) => {
  const normalizedValues = values.map((value) => String(value || ''));
  const [first] = normalizedValues;

  if (normalizedValues.every((value) => value === first)) {
    return first;
  }

  return '';
};

const resolveFrameContentTarget = (node: HTMLElement) => {
  return (
    node.querySelector<HTMLElement>('[data-template-frame-input="true"]') ||
    node.querySelector<HTMLElement>('[data-template-value]') ||
    node.querySelector<HTMLElement>('[data-template-edit-scope]') ||
    node
  );
};

const buildResizeHandle = (direction: TemplateFrameResizeDirection) => {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.setAttribute('data-v106-resize-handle', 'true');
  handle.setAttribute('data-frame-editor-ui', 'true');
  handle.setAttribute('data-direction', direction);
  handle.setAttribute('aria-label', `${direction} resize`);
  return handle;
};

const getCardinalEdgeSideFromDirection = (direction: TemplateFrameResizeDirection): TemplateEdgeSide | null => {
  if (direction === 'w') {
    return 'left';
  }

  if (direction === 'e') {
    return 'right';
  }

  if (direction === 'n') {
    return 'top';
  }

  if (direction === 's') {
    return 'bottom';
  }

  return null;
};

const getDirectionFromEdgeSide = (side: TemplateEdgeSide): TemplateFrameResizeDirection => {
  if (side === 'left') {
    return 'w';
  }

  if (side === 'right') {
    return 'e';
  }

  if (side === 'top') {
    return 'n';
  }

  return 's';
};

const buildEdgeSelectionButton = (
  side: TemplateEdgeSide,
  edgeId: string,
  selectionOrder: number,
  mode: 'connected' | 'isolated',
  isAnchorEdge: boolean
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-v106-edge-button', 'true');
  button.setAttribute('data-frame-editor-ui', 'true');
  button.setAttribute('data-direction', getDirectionFromEdgeSide(side));
  button.setAttribute('data-edge-id', edgeId);
  button.setAttribute('data-side', side);
  button.setAttribute('data-edge-selection-order', String(selectionOrder));
  button.setAttribute('data-edge-selection-mode', mode);
  if (isAnchorEdge) {
    button.setAttribute('data-edge-anchor', 'true');
  }
  button.setAttribute('aria-label', `${side} edge resize`);
  return button;
};

const applyFrameSelectionUi = (
  root: HTMLElement,
  selectedIds: string[],
  edgeSelectionState: TemplateEdgeSelectionStateDto,
  edgeSnapshot: TemplateEdgeTopologySnapshotDto | null
) => {
  stripSelectionAttrs(root);
  TemplateFrameEditHtmlService.stripEditorUiState(root);

  const edgeMap = new Map((edgeSnapshot?.edges || []).map((edge) => [edge.edgeId, edge]));

  if (edgeSelectionState.tokens.length > 0 && edgeSnapshot) {
    const anchorFrameGroupIds = new Set<string>();

    edgeSelectionState.tokens.forEach((token) => {
      const anchorEdge = edgeMap.get(token.anchorEdgeId);

      if (anchorEdge) {
        anchorFrameGroupIds.add(anchorEdge.frameGroupId);
      }

      token.memberEdgeIds.forEach((edgeId) => {
        const edge = edgeMap.get(edgeId);

        if (!edge) {
          return;
        }

        const node = root.querySelector<HTMLElement>(`${FRAME_SELECTION_NODE_SELECTOR}[data-template-frame-group="${edge.frameGroupId}"]`);

        if (!node) {
          return;
        }

        node.setAttribute('data-template-edge-visual', 'true');
        const button = buildEdgeSelectionButton(
          edge.side,
          edge.edgeId,
          token.selectionOrder,
          token.mode,
          edge.edgeId === token.anchorEdgeId
        );
        node.appendChild(button);
      });
    });

    anchorFrameGroupIds.forEach((frameGroupId) => {
      const node = root.querySelector<HTMLElement>(`${FRAME_SELECTION_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`);

      if (!node) {
        return;
      }

      node.setAttribute('data-template-edge-anchor-node', 'true');
      FRAME_RESIZE_DIRECTIONS.forEach((direction) => {
        node.appendChild(buildResizeHandle(direction));
      });
    });

    return;
  }

  if (!selectedIds.length) {
    return;
  }

  root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR).forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    const selectionIndex = selectedIds.indexOf(frameGroupId);

    if (selectionIndex < 0) {
      return;
    }

    node.setAttribute('data-template-selected', 'true');
    node.setAttribute('data-template-selection-order', String(selectionIndex + 1));

    if (selectionIndex === 0) {
      node.setAttribute('data-template-primary-selected', 'true');
    }

    const badge = document.createElement('div');
    badge.className = FRAME_SELECTION_BADGE_CLASS;
    badge.setAttribute('data-frame-editor-ui', 'true');
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = selectedIds.length > 1 ? `선택 ${selectionIndex + 1}` : '선택';
    node.appendChild(badge);

    if (selectionIndex === 0) {
      (['left', 'right', 'top', 'bottom'] as TemplateEdgeSide[]).forEach((side) => {
        node.appendChild(
          buildEdgeSelectionButton(side, `${frameGroupId}:${side}`, 1, 'connected', true)
        );
      });
      FRAME_RESIZE_DIRECTIONS.forEach((direction) => {
        node.appendChild(buildResizeHandle(direction));
      });
    }
  });
};

const applyFrameStylePatch = (
  node: HTMLElement,
  patch: Partial<SelectionStyleDraft> & {
    width?: number;
    height?: number;
  }
) => {
  const contentTarget = resolveFrameContentTarget(node);

  if (typeof patch.width === 'number' && Number.isFinite(patch.width)) {
    applyFrameResizeWidthDelta(node, patch.width - readFrameNodeRect(node).width);
    if (contentTarget !== node) {
      contentTarget.style.width = '100%';
    }
  }

  if (typeof patch.height === 'number' && Number.isFinite(patch.height)) {
    applyFrameResizeHeightDelta(node, patch.height - readFrameNodeRect(node).height);
    if (contentTarget !== node) {
      contentTarget.style.height = '100%';
    }
  }

  if (patch.fontSize !== undefined) {
    contentTarget.style.fontSize = patch.fontSize ? `${Number.parseFloat(patch.fontSize)}px` : '';
  }

  if (patch.lineHeight !== undefined) {
    contentTarget.style.lineHeight = patch.lineHeight ? `${Number.parseFloat(patch.lineHeight)}px` : '';
  }

  if (patch.fontWeight !== undefined) {
    contentTarget.style.fontWeight = patch.fontWeight || '';
  }

  if (patch.textAlign !== undefined) {
    contentTarget.style.textAlign = patch.textAlign || '';
  }

  if (patch.color !== undefined) {
    contentTarget.style.color = patch.color || '';
  }

  if (patch.backgroundColor !== undefined) {
    node.style.backgroundColor = patch.backgroundColor || '';
  }

  if (patch.borderRadius !== undefined) {
    node.style.borderRadius = patch.borderRadius ? `${Number.parseFloat(patch.borderRadius)}px` : '';
  }

  if (patch.paddingX !== undefined || patch.paddingY !== undefined) {
    const paddingX = patch.paddingX !== undefined ? Number.parseFloat(patch.paddingX || '0') : NaN;
    const paddingY = patch.paddingY !== undefined ? Number.parseFloat(patch.paddingY || '0') : NaN;
    const safePaddingX = Number.isFinite(paddingX) ? paddingX : parseFramePx(contentTarget.style.paddingLeft || '0');
    const safePaddingY = Number.isFinite(paddingY) ? paddingY : parseFramePx(contentTarget.style.paddingTop || '0');
    contentTarget.style.padding = `${safePaddingY}px ${safePaddingX}px`;
  }
};

export default function TemplateEditWorkspace({ initialTemplateId = '' }: TemplateEditWorkspaceProps) {
  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [templateDetail, setTemplateDetail] = React.useState<TemplateDetailResult | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState('');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(initialTemplateId.trim());
  const [templateName, setTemplateName] = React.useState('');
  const [sourceDocumentName, setSourceDocumentName] = React.useState('');
  const [layoutResizeMode, setLayoutResizeMode] = React.useState<TemplateLayoutResizeMode>('grow_height');
  const [previewZoom, setPreviewZoom] = React.useState(100);
  const [selectedFrameGroupIds, setSelectedFrameGroupIds] = React.useState<string[]>([]);
  const [edgeSelectionState, setEdgeSelectionState] = React.useState<TemplateEdgeSelectionStateDto>(
    TemplateEdgeSelectionService.createEmptyState()
  );
  const [selectionStyleDraft, setSelectionStyleDraft] = React.useState<SelectionStyleDraft>(defaultSelectionStyleDraft);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const stylePanelRef = React.useRef<HTMLDivElement | null>(null);
  const draftPreviewHtmlRef = React.useRef('');
  const initializedTemplateIdRef = React.useRef('');
  const selectedFrameGroupIdsRef = React.useRef<string[]>([]);
  const edgeSelectionStateRef = React.useRef<TemplateEdgeSelectionStateDto>(TemplateEdgeSelectionService.createEmptyState());
  const activePointerOwnerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const resizeStateRef = React.useRef<ResizeState | null>(null);
  const edgePressStateRef = React.useRef<EdgePressState | null>(null);

  const templateOptions = React.useMemo<TemplateOption[]>(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: template.id,
        keywords: [template.sourceDocumentName || '', template.layoutResizeMode],
      })),
    [templates]
  );

  const frameNodesAvailable = React.useMemo(
    () => ((previewHtml || templateDetail?.template.draftHtml || '').match(/data-template-frame-group=/g) || []).length,
    [previewHtml, templateDetail?.template.draftHtml]
  );
  const renderedPreviewHtml = previewHtml || templateDetail?.template.draftHtml || '';
  const selectedEdgeMemberCount = React.useMemo(
    () => new Set(edgeSelectionState.tokens.flatMap((token) => token.memberEdgeIds)).size,
    [edgeSelectionState]
  );
  const selectedEdgeMode = edgeSelectionState.tokens[0]?.mode || null;
  const selectedEdgeAnchorIds = edgeSelectionState.tokens.map((token) => token.anchorEdgeId);

  const syncTemplateQuery = React.useCallback((templateId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);

    if (templateId.trim()) {
      url.searchParams.set('templateId', templateId.trim());
    } else {
      url.searchParams.delete('templateId');
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, []);

  const syncDraftPreviewHtmlRef = React.useCallback(() => {
    const root = previewRef.current;

    if (!root) {
      return '';
    }

    const nextHtml = extractEditorHtml(root);
    draftPreviewHtmlRef.current = nextHtml;
    setPreviewHtml(nextHtml);
    return nextHtml;
  }, []);

  const requestPreviewTextFit = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      applyTemplateExtractEditableTextFit(root);
    });
  }, []);

  const getFrameNodes = React.useCallback(
    (scope?: ParentNode | null) =>
      Array.from((scope || previewRef.current)?.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR) || []),
    []
  );

  const buildLiveEdgeTopologySnapshot = React.useCallback((root: HTMLElement): TemplateEdgeTopologySnapshotDto => {
    const pages = Array.from(root.querySelectorAll<HTMLElement>('section.page'));
    const frames: TemplateEdgeFrameDto[] = getFrameNodes(root).map((node) => {
      const pageElement = node.closest<HTMLElement>('section.page');
      const pageIndex = Math.max(0, pages.indexOf(pageElement || pages[0] || node));
      const rect = readFrameNodeRect(node);

      return {
        frameGroupId: getFrameGroupId(node),
        pageId: `page-${pageIndex + 1}`,
        rect,
      };
    });

    return TemplateEdgeTopologyService.createSnapshot({
      frames,
      tolerancePx: FRAME_RESIZE_TOLERANCE_PX,
    });
  }, [getFrameNodes]);

  const reconcileLiveEdgeSelection = React.useCallback(
    (root?: HTMLElement | null, state?: TemplateEdgeSelectionStateDto) => {
      const resolvedRoot = root || previewRef.current;

      if (!resolvedRoot) {
        return TemplateEdgeSelectionService.createEmptyState();
      }

      return TemplateEdgeSelectionService.reconcileSelectionState({
        snapshot: buildLiveEdgeTopologySnapshot(resolvedRoot),
        currentSelection: state || edgeSelectionStateRef.current,
      });
    },
    [buildLiveEdgeTopologySnapshot]
  );

  const loadTemplates = React.useCallback(async () => {
    try {
      const response = await fetch('/api/templates?limit=64', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '저장된 템플릿 목록을 불러오지 못했습니다.');
      }

      setTemplates(result.data || []);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '저장된 템플릿 목록을 불러오지 못했습니다.';
      setMessage(nextMessage);
    }
  }, []);

  const loadTemplate = React.useCallback(
    async (templateId: string) => {
      const normalizedTemplateId = templateId.trim();

      if (!normalizedTemplateId) {
        setTemplateDetail(null);
        setPreviewHtml('');
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        draftPreviewHtmlRef.current = '';
        syncTemplateQuery('');
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/templates/${normalizedTemplateId}?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || '템플릿 상세를 불러오지 못했습니다.');
        }

        const detail = result.data as TemplateDetailResult;
        setTemplateDetail(detail);
        setSelectedTemplateId(normalizedTemplateId);
        setTemplateName(detail.template.templateName);
        setSourceDocumentName(detail.template.sourceDocumentName || '');
        setLayoutResizeMode(detail.template.layoutResizeMode);
        setPreviewHtml(detail.template.draftHtml);
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        draftPreviewHtmlRef.current = detail.template.draftHtml;
        syncTemplateQuery(normalizedTemplateId);
        setMessage(`템플릿 ${normalizedTemplateId} 를 편집 모드로 불러왔습니다.`);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '템플릿 상세를 불러오지 못했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    [syncTemplateQuery]
  );

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  React.useEffect(() => {
    const normalizedInitialTemplateId = initialTemplateId.trim();

    if (!normalizedInitialTemplateId || initializedTemplateIdRef.current === normalizedInitialTemplateId) {
      return;
    }

    initializedTemplateIdRef.current = normalizedInitialTemplateId;
    void loadTemplate(normalizedInitialTemplateId);
  }, [initialTemplateId, loadTemplate]);

  React.useEffect(() => {
    selectedFrameGroupIdsRef.current = selectedFrameGroupIds;
  }, [selectedFrameGroupIds]);

  React.useEffect(() => {
    edgeSelectionStateRef.current = edgeSelectionState;
  }, [edgeSelectionState]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml) {
      return;
    }

    draftPreviewHtmlRef.current = renderedPreviewHtml;
    let cancelled = false;

    const applyEditorState = async () => {
      await document.fonts?.ready?.catch(() => undefined);

      if (cancelled) {
        return;
      }

      applyPreviewEditPermissions(root);
      applyFrameSelectionUi(
        root,
        selectedFrameGroupIdsRef.current,
        reconcileLiveEdgeSelection(root, edgeSelectionStateRef.current),
        buildLiveEdgeTopologySnapshot(root)
      );
      requestPreviewTextFit();
    };

    void applyEditorState();

    return () => {
      cancelled = true;
    };
  }, [renderedPreviewHtml, requestPreviewTextFit]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    applyPreviewEditPermissions(root);
    applyFrameSelectionUi(
      root,
      selectedFrameGroupIds,
      reconcileLiveEdgeSelection(root, edgeSelectionState),
      buildLiveEdgeTopologySnapshot(root)
    );
  }, [buildLiveEdgeTopologySnapshot, edgeSelectionState, reconcileLiveEdgeSelection, renderedPreviewHtml, selectedFrameGroupIds, selectionStyleDraft]);

  const syncSelectionStyleDraft = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || selectedFrameGroupIds.length === 0) {
      setSelectionStyleDraft(defaultSelectionStyleDraft);
      return;
    }

    const nodes = getFrameNodes(root).filter((node) => selectedFrameGroupIds.includes(getFrameGroupId(node)));

    if (!nodes.length) {
      setSelectionStyleDraft(defaultSelectionStyleDraft);
      return;
    }

    const widths = nodes.map((node) => String(Math.round(readFrameNodeRect(node).width)));
    const heights = nodes.map((node) => String(Math.round(readFrameNodeRect(node).height)));
    const fontSizes = nodes.map((node) => normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).fontSize));
    const lineHeights = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).lineHeight)
    );
    const paddingXs = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).paddingLeft)
    );
    const paddingYs = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).paddingTop)
    );
    const borderRadii = nodes.map((node) => normalizeNumericStyleValue(getComputedStyle(node).borderRadius));
    const fontWeights = nodes.map((node) => getComputedStyle(resolveFrameContentTarget(node)).fontWeight || '');
    const textAligns = nodes.map((node) => getComputedStyle(resolveFrameContentTarget(node)).textAlign || 'left');
    const colors = nodes.map((node) => colorToHex(getComputedStyle(resolveFrameContentTarget(node)).color || ''));
    const backgroundColors = nodes.map((node) => colorToHex(getComputedStyle(node).backgroundColor || ''));

    const sharedTextAlign = getSharedValue(textAligns);

    setSelectionStyleDraft({
      width: getSharedValue(widths),
      height: getSharedValue(heights),
      fontSize: getSharedValue(fontSizes),
      lineHeight: getSharedValue(lineHeights),
      paddingX: getSharedValue(paddingXs),
      paddingY: getSharedValue(paddingYs),
      borderRadius: getSharedValue(borderRadii),
      fontWeight: getSharedValue(fontWeights),
      textAlign:
        sharedTextAlign === 'center' || sharedTextAlign === 'right' || sharedTextAlign === 'justify'
          ? sharedTextAlign
          : 'left',
      color: getSharedValue(colors) || '#0f172a',
      backgroundColor: getSharedValue(backgroundColors) || '#ffffff',
    });
  }, [getFrameNodes, selectedFrameGroupIds]);

  React.useEffect(() => {
    syncSelectionStyleDraft();
  }, [selectedFrameGroupIds, syncSelectionStyleDraft, templateDetail?.template.id]);

  const applySelectionStylePatch = React.useCallback(
    (patch: Partial<SelectionStyleDraft> & { width?: number; height?: number }) => {
      const root = previewRef.current;

      if (!root || selectedFrameGroupIds.length === 0) {
        setMessage('편집할 박스를 먼저 선택하세요.');
        return;
      }

      const nodes = getFrameNodes(root).filter((node) => selectedFrameGroupIds.includes(getFrameGroupId(node)));

      if (!nodes.length) {
        return;
      }

      nodes.forEach((node) => applyFrameStylePatch(node, patch));
      syncDraftPreviewHtmlRef();
      syncSelectionStyleDraft();
      requestPreviewTextFit();
    },
    [getFrameNodes, requestPreviewTextFit, selectedFrameGroupIds, syncDraftPreviewHtmlRef, syncSelectionStyleDraft]
  );

  const readSelectionStyleDraftFromControls = React.useCallback((): SelectionStyleDraft => {
    const root = stylePanelRef.current;

    if (!root) {
      return selectionStyleDraft;
    }

    const readFieldValue = (field: keyof SelectionStyleDraft) => {
      const element = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-style-field="${field}"]`);
      return element?.value ?? selectionStyleDraft[field];
    };

    return {
      width: readFieldValue('width'),
      height: readFieldValue('height'),
      fontSize: readFieldValue('fontSize'),
      lineHeight: readFieldValue('lineHeight'),
      paddingX: readFieldValue('paddingX'),
      paddingY: readFieldValue('paddingY'),
      borderRadius: readFieldValue('borderRadius'),
      fontWeight: readFieldValue('fontWeight'),
      textAlign: readFieldValue('textAlign') as SelectionStyleDraft['textAlign'],
      color: readFieldValue('color'),
      backgroundColor: readFieldValue('backgroundColor'),
    };
  }, [selectionStyleDraft]);

  const applySelectionStyleDraft = React.useCallback(() => {
    const nextDraft = readSelectionStyleDraftFromControls();
    const width = Number.parseFloat(nextDraft.width);
    const height = Number.parseFloat(nextDraft.height);

    setSelectionStyleDraft(nextDraft);

    applySelectionStylePatch({
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
      fontSize: nextDraft.fontSize,
      lineHeight: nextDraft.lineHeight,
      paddingX: nextDraft.paddingX,
      paddingY: nextDraft.paddingY,
      borderRadius: nextDraft.borderRadius,
      fontWeight: nextDraft.fontWeight,
      textAlign: nextDraft.textAlign,
      color: nextDraft.color,
      backgroundColor: nextDraft.backgroundColor,
    });
  }, [applySelectionStylePatch, readSelectionStyleDraftFromControls]);

  const applyPrimaryFrameSizeToSelection = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || selectedFrameGroupIds.length < 2) {
      return;
    }

    const nodes = getFrameNodes(root).filter((node) => selectedFrameGroupIds.includes(getFrameGroupId(node)));
    const primaryNode = nodes[0];

    if (!primaryNode) {
      return;
    }

    const primaryRect = readFrameNodeRect(primaryNode);
    nodes.slice(1).forEach((node) => {
      writeFrameNodeRect(node, {
        ...readFrameNodeRect(node),
        width: primaryRect.width,
        height: primaryRect.height,
      });
    });

    syncDraftPreviewHtmlRef();
    syncSelectionStyleDraft();
  }, [getFrameNodes, selectedFrameGroupIds, syncDraftPreviewHtmlRef, syncSelectionStyleDraft]);

  const collectEdgeResizeTargets = React.useCallback(
    (
      root: HTMLElement,
      snapshot: TemplateEdgeTopologySnapshotDto,
      selectionState: TemplateEdgeSelectionStateDto,
      side: TemplateEdgeSide
    ) => {
      const compatibleTokens = selectionState.tokens.filter((token) => {
        const anchorEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, token.anchorEdgeId);
        return anchorEdge?.side === side;
      });
      const targets: EdgeResizeTarget[] = [];

      compatibleTokens.forEach((token) => {
        token.memberEdgeIds.forEach((edgeId) => {
          const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

          if (!edge || edge.side !== side) {
            return;
          }

          const node = root.querySelector<HTMLElement>(
            `${FRAME_SELECTION_NODE_SELECTOR}[data-template-frame-group="${edge.frameGroupId}"]`
          );

          if (!node) {
            return;
          }

          const context = buildFrameResizeContext(node);
          const boundaryIndex =
            side === 'left'
              ? context.startColIndex
              : side === 'right'
                ? context.endColIndex
                : side === 'top'
                  ? context.startRowIndex
                  : context.endRowIndex;
          const target = {
            node,
            shell: context.shell,
            side,
            boundaryIndex: context.singleCellBand ? null : boundaryIndex,
            widthInstructions:
              side === 'left' || side === 'right'
                ? [buildSelfWidthResizeInstruction(context, side) as FrameWidthResizeInstruction].filter(Boolean)
                : undefined,
          };
          const alreadyTracked = targets.some(
            (candidate) =>
              candidate.shell === target.shell &&
              candidate.side === target.side &&
              candidate.boundaryIndex === target.boundaryIndex
          );

          if (!alreadyTracked) {
            targets.push(target);
          }
        });
      });

      return targets;
    },
    []
  );

  const resolveEdgeSelectionForResizeStart = React.useCallback(
    (
      snapshot: TemplateEdgeTopologySnapshotDto,
      currentSelection: TemplateEdgeSelectionStateDto,
      clickedEdgeId: string
    ) => {
      if (edgeSelectionContainsEdge(currentSelection, clickedEdgeId)) {
        return currentSelection;
      }

      return TemplateEdgeSelectionService.resolveClick({
        snapshot,
        currentSelection: TemplateEdgeSelectionService.createEmptyState(),
        clickedEdgeId,
        withShift: false,
      });
    },
    []
  );

  const saveTemplate = React.useCallback(async () => {
    const normalizedTemplateId = selectedTemplateId.trim() || templateDetail?.template.id || '';
    const currentHtml = previewRef.current ? syncDraftPreviewHtmlRef() : draftPreviewHtmlRef.current.trim();

    if (!normalizedTemplateId) {
      setMessage('저장할 템플릿을 먼저 선택하세요.');
      return;
    }

    if (!currentHtml) {
      setMessage('저장할 템플릿 HTML이 없습니다.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/${normalizedTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          sourceDocumentName,
          layoutResizeMode,
          draftHtml: currentHtml,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '템플릿 저장에 실패했습니다.');
      }

      const updatedTemplate = result.data?.template as TemplateRecordDto | undefined;

      if (updatedTemplate) {
        setTemplates((previous) =>
          [updatedTemplate, ...previous.filter((item) => item.id !== updatedTemplate.id)].slice(0, 64)
        );
      }

      setTemplateDetail((previous) =>
        previous
          ? {
              ...previous,
              template: {
                ...previous.template,
                templateName,
                sourceDocumentName,
                layoutResizeMode,
                draftHtml: currentHtml,
              },
            }
          : previous
      );
      setMessage(`템플릿 ${normalizedTemplateId} 저장을 완료했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }, [
    layoutResizeMode,
    selectedTemplateId,
    sourceDocumentName,
    syncDraftPreviewHtmlRef,
    templateDetail?.template.id,
    templateName,
  ]);

  const stopPointerInteraction = React.useCallback(
    (pointerId?: number) => {
      const owner = activePointerOwnerRef.current;

      if (owner && typeof pointerId === 'number' && owner.hasPointerCapture(pointerId)) {
        owner.releasePointerCapture(pointerId);
      }

      activePointerOwnerRef.current = null;
      dragStateRef.current = null;
      resizeStateRef.current = null;
      edgePressStateRef.current = null;
      syncDraftPreviewHtmlRef();
      const nextEdgeSelection = reconcileLiveEdgeSelection(previewRef.current, edgeSelectionStateRef.current);
      if (!edgeSelectionStatesEqual(nextEdgeSelection, edgeSelectionStateRef.current)) {
        setEdgeSelectionState(nextEdgeSelection);
      }
      syncSelectionStyleDraft();
      requestPreviewTextFit();
    },
    [reconcileLiveEdgeSelection, requestPreviewTextFit, syncDraftPreviewHtmlRef, syncSelectionStyleDraft]
  );

  const clearFrameSelection = React.useCallback(() => {
    stopPointerInteraction();
    setSelectedFrameGroupIds([]);
    setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
  }, [stopPointerInteraction]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== 'Escape' ||
        (selectedFrameGroupIdsRef.current.length === 0 && edgeSelectionStateRef.current.tokens.length === 0)
      ) {
        return;
      }

      clearFrameSelection();
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [clearFrameSelection]);

  const handlePreviewPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const root = previewRef.current;
      const target = event.target instanceof HTMLElement ? event.target : null;

      if (!root || !target) {
        return;
      }

      const edgeButton = target.closest<HTMLElement>(FRAME_EDGE_BUTTON_SELECTOR);
      const resizeHandle = target.closest<HTMLElement>(FRAME_RESIZE_HANDLE_SELECTOR);
      const frameNode = target.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

      if (!frameNode) {
        return;
      }

      const frameGroupId = getFrameGroupId(frameNode);

      if (!frameGroupId) {
        return;
      }

      const explicitEdgeDirection = (edgeButton?.getAttribute('data-direction') ||
        resizeHandle?.getAttribute('data-direction') ||
        '') as TemplateFrameResizeDirection;
      const explicitEdgeSide = getCardinalEdgeSideFromDirection(explicitEdgeDirection);
      const pageInner = frameNode.closest<HTMLElement>('.page-inner');

      if (explicitEdgeSide && pageInner) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        const currentSelection = TemplateEdgeSelectionService.reconcileSelectionState({
          snapshot,
          currentSelection: edgeSelectionStateRef.current,
        });
        const clickedEdgeId = `${frameGroupId}:${explicitEdgeSide}`;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        edgePressStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          node: frameNode,
          direction: explicitEdgeDirection,
          side: explicitEdgeSide,
          clickedEdgeId,
          snapshot,
          currentSelection,
          withShift: Boolean(event.shiftKey),
        };
        return;
      }

      const nextSelection = getNextFrameSelection(selectedFrameGroupIds, frameGroupId, Boolean(event.shiftKey));

      if (event.shiftKey) {
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        setSelectedFrameGroupIds(nextSelection);
        return;
      }

      if (!pageInner) {
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        setSelectedFrameGroupIds([frameGroupId]);
        return;
      }

      const stableSelection = selectedFrameGroupIds.includes(frameGroupId) ? selectedFrameGroupIds : [frameGroupId];
      setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
      setSelectedFrameGroupIds(stableSelection);

      if (resizeHandle) {
        const direction = (resizeHandle.getAttribute('data-direction') || 'se') as TemplateFrameResizeDirection;
        const resizeContext = buildFrameResizeContext(frameNode);
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        resizeStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          direction,
          node: frameNode,
          rect: readFrameNodeRect(frameNode),
          widthInstructions:
            direction.includes('e') || direction.includes('w')
              ? collectWidthResizeInstructions(resizeContext, direction.includes('w') ? 'left' : 'right')
              : undefined,
          edgeResizeTargets: undefined,
        };
        return;
      }

      if (isInteractiveTarget(target)) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerOwnerRef.current = event.currentTarget;
      const selectionOnPage = getFrameNodes(pageInner).filter(
        (node) =>
          getFrameGroupId(node) === frameGroupId ||
          (stableSelection.includes(getFrameGroupId(node)) &&
            node.closest<HTMLElement>('.page-inner') === pageInner)
      );

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scale: previewZoom / 100,
        pageInner,
        anchorRect: readFrameMoveRect(frameNode),
        nodes: selectionOnPage.length
          ? selectionOnPage.map((node) => ({ node, rect: readFrameMoveRect(node) }))
          : [{ node: frameNode, rect: readFrameMoveRect(frameNode) }],
      };
    },
    [buildLiveEdgeTopologySnapshot, collectEdgeResizeTargets, getFrameNodes, previewZoom, selectedFrameGroupIds]
  );

  const handlePreviewPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    let resizeState = resizeStateRef.current;

    if (dragState && event.pointerId === dragState.pointerId) {
      event.preventDefault();
      const pageBounds = {
        width: dragState.pageInner.clientWidth,
        height: dragState.pageInner.clientHeight,
      };
      const delta = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: event.clientX - dragState.startX,
          y: event.clientY - dragState.startY,
        },
        dragState.scale
      );
      const siblingRects = getFrameNodes(dragState.pageInner)
        .filter((node) => !dragState.nodes.some((selected) => selected.node === node))
        .map((node) => readFrameMoveRect(node));
      const snapResult = TemplateFrameEditGeometryService.snapMovedRect({
        rect: {
          ...dragState.anchorRect,
          left: dragState.anchorRect.left + delta.x,
          top: dragState.anchorRect.top + delta.y,
        },
        siblingRects,
        bounds: pageBounds,
      });
      const resolvedRect =
        snapResult.ok && snapResult.value
          ? snapResult.value
          : clampFrameNodeRect(
              {
                ...dragState.anchorRect,
                left: dragState.anchorRect.left + delta.x,
                top: dragState.anchorRect.top + delta.y,
              },
              pageBounds
            );
      const moveDx = resolvedRect.left - dragState.anchorRect.left;
      const moveDy = resolvedRect.top - dragState.anchorRect.top;

      dragState.nodes.forEach(({ node, rect }) => {
        writeFrameMoveRect(
          node,
          clampFrameNodeRect(
            {
              left: rect.left + moveDx,
              top: rect.top + moveDy,
              width: rect.width,
              height: rect.height,
            },
            pageBounds
          )
        );
      });
      return;
    }

    const edgePressState = edgePressStateRef.current;

    if (!resizeState && edgePressState && event.pointerId === edgePressState.pointerId) {
      event.preventDefault();

      if (edgePressState.withShift) {
        return;
      }

      const rawDeltaX = event.clientX - edgePressState.startX;
      const rawDeltaY = event.clientY - edgePressState.startY;

      if (Math.abs(rawDeltaX) < EDGE_DRAG_START_THRESHOLD_PX && Math.abs(rawDeltaY) < EDGE_DRAG_START_THRESHOLD_PX) {
        return;
      }

      const nextEdgeSelection = resolveEdgeSelectionForResizeStart(
        edgePressState.snapshot,
        edgePressState.currentSelection,
        edgePressState.clickedEdgeId
      );
      const resizeTargets = collectEdgeResizeTargets(
        previewRef.current || event.currentTarget,
        edgePressState.snapshot,
        nextEdgeSelection,
        edgePressState.side
      );

      setSelectedFrameGroupIds([]);
      setEdgeSelectionState(nextEdgeSelection);
      resizeStateRef.current = {
        pointerId: edgePressState.pointerId,
        startX: edgePressState.startX,
        startY: edgePressState.startY,
        scale: edgePressState.scale,
        pageInner: edgePressState.pageInner,
        direction: edgePressState.direction,
        node: edgePressState.node,
        rect: readFrameNodeRect(edgePressState.node),
        widthInstructions:
          edgePressState.direction === 'e' || edgePressState.direction === 'w'
            ? resizeTargets[0]?.widthInstructions
            : undefined,
        edgeResizeTargets: resizeTargets,
      };
      edgePressStateRef.current = null;
      resizeState = resizeStateRef.current;
    }

    if (resizeState && event.pointerId === resizeState.pointerId) {
      event.preventDefault();
      const pageBounds = {
        width: resizeState.pageInner.clientWidth,
        height: resizeState.pageInner.clientHeight,
      };
      const delta = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: event.clientX - resizeState.startX,
          y: event.clientY - resizeState.startY,
        },
        resizeState.scale
      );

      let nextRect: FrameNodeRect = { ...resizeState.rect };

      if (resizeState.direction.includes('w')) {
        nextRect.left = resizeState.rect.left + delta.x;
        nextRect.width = resizeState.rect.width - delta.x;
      }

      if (resizeState.direction.includes('e')) {
        nextRect.width = resizeState.rect.width + delta.x;
      }

      if (resizeState.direction.includes('n')) {
        nextRect.top = resizeState.rect.top + delta.y;
        nextRect.height = resizeState.rect.height - delta.y;
      }

      if (resizeState.direction.includes('s')) {
        nextRect.height = resizeState.rect.height + delta.y;
      }

      const siblingRects = filterResizeSnapRects(
        getFrameNodes(resizeState.pageInner)
          .filter((node) => {
            if (node === resizeState.node) {
              return false;
            }

            if (!resizeState.edgeResizeTargets?.length) {
              return true;
            }

            return !resizeState.edgeResizeTargets.some((target) => target.node === node);
          })
          .map((node) => readFrameNodeRect(node)),
        resizeState.rect,
        resizeState.direction
      );
      const snapResult = TemplateFrameEditGeometryService.snapResizedRect({
        rect: clampFrameNodeRect(nextRect, pageBounds),
        direction: resizeState.direction,
        siblingRects,
        bounds: pageBounds,
      });
      const resolvedRect =
        snapResult.ok && snapResult.value ? snapResult.value : clampFrameNodeRect(nextRect, pageBounds);
      if (resizeState.edgeResizeTargets && resizeState.edgeResizeTargets.length > 0) {
        const appliedDeltaX = resizeState.direction.includes('w')
          ? resolvedRect.left - resizeState.rect.left
          : resizeState.direction.includes('e')
            ? resolvedRect.width - resizeState.rect.width
            : 0;
        const appliedDeltaY = resizeState.direction.includes('n')
          ? resolvedRect.top - resizeState.rect.top
          : resizeState.direction.includes('s')
            ? resolvedRect.height - resizeState.rect.height
            : 0;

        resizeState.edgeResizeTargets.forEach((target) => {
          if ((target.side === 'left' || target.side === 'right') && Math.abs(appliedDeltaX) >= 0.5) {
            applyFrameResizeWidthDelta(target.node, appliedDeltaX, target.widthInstructions);
            return;
          }

          if (target.side === 'top' && Math.abs(appliedDeltaY) >= 0.5) {
            applyFrameResizeTopDelta(target.node, appliedDeltaY);
            return;
          }

          if (target.side === 'bottom' && Math.abs(appliedDeltaY) >= 0.5) {
            applyFrameResizeHeightDelta(target.node, appliedDeltaY);
          }
        });
      } else {
        applyFrameResizeWithDirection(
          resizeState.node,
          resolvedRect,
          resizeState.direction,
          resizeState.widthInstructions
        );
      }
    }
  }, [getFrameNodes]);

  const handlePreviewPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const edgePressState = edgePressStateRef.current;

      if (edgePressState?.pointerId === event.pointerId) {
        event.preventDefault();
        const root = previewRef.current;
        const snapshot = root ? buildLiveEdgeTopologySnapshot(root) : edgePressState.snapshot;
        const currentSelection = TemplateEdgeSelectionService.reconcileSelectionState({
          snapshot,
          currentSelection: edgeSelectionStateRef.current,
        });
        const nextEdgeSelection = TemplateEdgeSelectionService.resolveClick({
          snapshot,
          currentSelection,
          clickedEdgeId: edgePressState.clickedEdgeId,
          withShift: edgePressState.withShift,
        });
        const owner = activePointerOwnerRef.current;

        if (owner?.hasPointerCapture(event.pointerId)) {
          owner.releasePointerCapture(event.pointerId);
        }

        activePointerOwnerRef.current = null;
        edgePressStateRef.current = null;
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(nextEdgeSelection);
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [buildLiveEdgeTopologySnapshot, stopPointerInteraction]
  );

  const handlePreviewPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (edgePressStateRef.current?.pointerId === event.pointerId) {
        stopPointerInteraction(event.pointerId);
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [stopPointerInteraction]
  );

  const handlePreviewClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const choiceButton = target?.closest<HTMLElement>('[role="checkbox"][data-checked]');

    if (!choiceButton) {
      return;
    }

    toggleChoiceBoxElement(choiceButton);
    syncDraftPreviewHtmlRef();
  }, [syncDraftPreviewHtmlRef]);

  const handlePreviewInput = React.useCallback((event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;

    if (!target) {
      return;
    }

    markTemplateValueElementEdited(target);
    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
  }, [requestPreviewTextFit, syncDraftPreviewHtmlRef]);

  return (
    <div className="space-y-6">
      <style>{`
        .template-edit-preview-shell {
          background:
            radial-gradient(circle at top, rgba(191, 219, 254, .2), transparent 42%),
            linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
        }
        .template-edit-preview-scroll {
          overflow: auto;
          max-height: calc(100vh - 18rem);
        }
        .template-edit-preview {
          position: relative;
          min-height: 100%;
          transform-origin: top left;
          zoom: var(--template-preview-zoom, 1);
        }
        .template-edit-preview section.page {
          margin: 0 auto 20px;
        }
        .template-edit-preview [data-template-selected="true"] {
          position: relative;
          z-index: 20 !important;
          outline: 3px solid #0f766e !important;
          outline-offset: -1px;
          box-shadow:
            0 0 0 4px rgba(20, 184, 166, .18),
            inset 0 0 0 1px rgba(255, 255, 255, .92) !important;
        }
        .template-edit-preview [data-template-primary-selected="true"] {
          outline-color: #0f766e !important;
          box-shadow:
            0 0 0 5px rgba(13, 148, 136, .22),
            inset 0 0 0 1px rgba(255, 255, 255, .96) !important;
        }
        .template-edit-preview [data-template-edge-visual="true"],
        .template-edit-preview [data-template-edge-anchor-node="true"] {
          position: relative;
          z-index: 20 !important;
        }
        .template-edit-preview .${FRAME_SELECTION_BADGE_CLASS} {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 26;
          border-radius: 999px;
          background: rgba(15, 118, 110, .96);
          color: #f0fdfa;
          padding: 2px 8px;
          font-size: 10px;
          line-height: 1.2;
          font-weight: 700;
          pointer-events: none;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR} {
          position: absolute;
          z-index: 28;
          width: 12px;
          height: 12px;
          border: 2px solid white;
          border-radius: 999px;
          background: #0f766e;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .25);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR} {
          position: absolute;
          z-index: 27;
          border: 0;
          background: rgba(13, 148, 136, .7);
          padding: 0;
          border-radius: 999px;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, .92);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-mode="isolated"] {
          background: rgba(234, 88, 12, .88);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="left"],
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="right"] {
          top: 3px;
          bottom: 3px;
          width: 6px;
          cursor: ew-resize;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="left"] {
          left: -3px;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="right"] {
          right: -3px;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="top"],
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="bottom"] {
          left: 3px;
          right: 3px;
          height: 6px;
          cursor: ns-resize;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="top"] {
          top: -3px;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="bottom"] {
          bottom: -3px;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="e"] {
          top: calc(50% - 6px);
          right: -6px;
          cursor: ew-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="w"] {
          top: calc(50% - 6px);
          left: -6px;
          cursor: ew-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="n"] {
          top: -6px;
          left: calc(50% - 6px);
          cursor: ns-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="s"] {
          bottom: -6px;
          left: calc(50% - 6px);
          cursor: ns-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="ne"] {
          top: -6px;
          right: -6px;
          cursor: nesw-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="nw"] {
          top: -6px;
          left: -6px;
          cursor: nwse-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="se"] {
          right: -6px;
          bottom: -6px;
          cursor: nwse-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="sw"] {
          left: -6px;
          bottom: -6px;
          cursor: nesw-resize;
        }
        .template-edit-preview [data-template-edit-scope][data-template-edit-enabled="true"] {
          cursor: text;
        }
      `}</style>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-EDIT-01</Badge>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-950">템플릿 편집</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              추출 페이지에서 저장한 템플릿을 불러와 div 박스를 여러 개 선택하고, 너비·높이·텍스트 크기·여백·정렬을
              한 번에 조정합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/templates/extract"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            추출 페이지
          </Link>
          <Link
            href="/templates"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            템플릿 관리
          </Link>
          <Button onClick={() => void saveTemplate()} disabled={saving || loading || !templateDetail}>
            {saving ? '저장 중...' : '현재 템플릿 저장'}
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>불러오기 및 저장</CardTitle>
          <CardDescription>
            저장된 템플릿을 불러온 뒤 이름과 레이아웃 정책을 조정하고, 편집 결과를 같은 템플릿에 다시 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">저장된 템플릿</label>
              <EntityPicker
                value={selectedTemplateId}
                options={templateOptions}
                onChange={setSelectedTemplateId}
                placeholder="편집할 템플릿을 선택하세요"
                emptyMessage="저장된 템플릿이 없습니다."
                optionLayout="inline"
                className="w-full"
                triggerClassName="h-11 min-h-11 items-center rounded-md py-2"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => void loadTemplate(selectedTemplateId)}
                disabled={loading || !selectedTemplateId.trim()}
              >
                {loading ? '불러오는 중...' : '템플릿 불러오기'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">템플릿 이름</label>
              <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">원본 문서명</label>
              <Input value={sourceDocumentName} onChange={(event) => setSourceDocumentName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">레이아웃 확장 정책</label>
              <select
                value={layoutResizeMode}
                onChange={(event) => setLayoutResizeMode(event.target.value as TemplateLayoutResizeMode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="fixed">fixed</option>
                <option value="grow_height">grow_height</option>
                <option value="grow_width">grow_width</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>박스 편집 캔버스</CardTitle>
              <CardDescription>
                Shift+클릭으로 여러 박스를 고른 뒤 드래그로 이동하고, 가장자리와 모서리 핸들로 상하좌우 크기를 조정합니다.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-slate-500">줌</label>
              {[80, 100, 125].map((zoom) => (
                <Button
                  key={zoom}
                  size="sm"
                  variant={previewZoom === zoom ? 'default' : 'outline'}
                  onClick={() => setPreviewZoom(zoom)}
                >
                  {zoom}%
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="template-edit-preview-shell rounded-b-xl p-4">
              <div className="template-edit-preview-scroll rounded-xl border border-slate-200 bg-white p-4">
                {renderedPreviewHtml ? (
                  <div
                    ref={previewRef}
                    className="template-edit-preview"
                    style={{ ['--template-preview-zoom' as string]: String(previewZoom / 100) }}
                    onPointerDownCapture={handlePreviewPointerDown}
                    onPointerMoveCapture={handlePreviewPointerMove}
                    onPointerUpCapture={handlePreviewPointerUp}
                    onPointerCancelCapture={handlePreviewPointerCancel}
                    onClickCapture={handlePreviewClickCapture}
                    onInput={handlePreviewInput}
                    dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
                  />
                ) : (
                  <div className="flex min-h-[560px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                    편집할 템플릿을 먼저 불러오세요.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>선택 상태</CardTitle>
              <CardDescription>박스 선택과 엣지 선택은 분리되며, 엣지는 그룹 선택과 개별 선택을 전환할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent ref={stylePanelRef} className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div>선택 박스 수: {selectedFrameGroupIds.length}</div>
                <div className="mt-1 break-all">선택 ID: {selectedFrameGroupIds.join(', ') || '-'}</div>
                <div className="mt-1">선택 엣지 토큰 수: {edgeSelectionState.tokens.length}</div>
                <div className="mt-1">선택 엣지 수: {selectedEdgeMemberCount}</div>
                <div className="mt-1">선택 엣지 모드: {selectedEdgeMode || '-'}</div>
                <div className="mt-1 break-all">선택 엣지 앵커: {selectedEdgeAnchorIds.join(', ') || '-'}</div>
                <div className="mt-1">프레임 박스 수: {frameNodesAvailable}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={clearFrameSelection}>
                  선택 해제
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedFrameGroupIds.length < 2}
                  onClick={applyPrimaryFrameSizeToSelection}
                >
                  첫 선택 크기 복제
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">빠른 프리셋</label>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => applySelectionStylePatch(presetStylePatches.label)}>
                    라벨형
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applySelectionStylePatch(presetStylePatches.input)}>
                    입력칸형
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applySelectionStylePatch(presetStylePatches.body)}>
                    본문형
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applySelectionStylePatch(presetStylePatches.focus)}>
                    강조형
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">너비 (px)</label>
                  <Input
                    data-style-field="width"
                    value={selectionStyleDraft.width}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, width: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">높이 (px)</label>
                  <Input
                    data-style-field="height"
                    value={selectionStyleDraft.height}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, height: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">폰트 크기</label>
                  <Input
                    data-style-field="fontSize"
                    value={selectionStyleDraft.fontSize}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, fontSize: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">줄 간격</label>
                  <Input
                    data-style-field="lineHeight"
                    value={selectionStyleDraft.lineHeight}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, lineHeight: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">좌우 여백</label>
                  <Input
                    data-style-field="paddingX"
                    value={selectionStyleDraft.paddingX}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, paddingX: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">상하 여백</label>
                  <Input
                    data-style-field="paddingY"
                    value={selectionStyleDraft.paddingY}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, paddingY: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">모서리 반경</label>
                  <Input
                    data-style-field="borderRadius"
                    value={selectionStyleDraft.borderRadius}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, borderRadius: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">글자 굵기</label>
                  <Input
                    data-style-field="fontWeight"
                    value={selectionStyleDraft.fontWeight}
                    placeholder="혼합"
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, fontWeight: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">정렬</label>
                  <select
                    data-style-field="textAlign"
                    value={selectionStyleDraft.textAlign}
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({
                        ...previous,
                        textAlign: event.target.value as SelectionStyleDraft['textAlign'],
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                    <option value="justify">justify</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">글자 색</label>
                  <Input
                    data-style-field="color"
                    type="color"
                    value={selectionStyleDraft.color}
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({ ...previous, color: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-800">배경 색</label>
                  <Input
                    data-style-field="backgroundColor"
                    type="color"
                    value={selectionStyleDraft.backgroundColor}
                    onChange={(event) =>
                      setSelectionStyleDraft((previous) => ({
                        ...previous,
                        backgroundColor: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <Button className="w-full" onClick={applySelectionStyleDraft} disabled={selectedFrameGroupIds.length === 0}>
                선택 박스 일괄 적용
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>편집 방식</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p>박스를 클릭하면 선택되고, Shift+클릭으로 여러 박스를 누적 선택합니다.</p>
              <p>선택된 박스의 엣지를 처음 누르면 연결된 엣지 그룹이 선택되고, 같은 엣지를 다시 누르면 해당 엣지만 단독 선택됩니다.</p>
              <p>선택된 박스의 외곽선과 엣지 버튼을 드래그하면 위치 또는 크기가 바뀌며, 엣지 선택이 있으면 연결된 대상만 함께 조정됩니다.</p>
              <p>오른쪽 패널에서는 여러 박스에 동일한 폰트 크기, 패딩, 정렬, 색상, 크기를 일괄 적용할 수 있습니다.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
