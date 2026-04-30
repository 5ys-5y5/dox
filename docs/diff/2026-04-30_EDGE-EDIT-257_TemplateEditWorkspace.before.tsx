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
  TemplateEdgeRoleMapDto,
  TemplateEdgeSelectionRole,
  TemplateEdgeSelectionStateDto,
  TemplateEdgeSide,
  TemplateEdgeTopologySnapshotDto,
} from '../../lib/templateEdgeSelectionDtos';
import type { TemplateDetailResult, TemplateLayoutResizeMode, TemplateRecordDto } from '../../lib/templateDtos';
import type { TemplateFrameResizeDirection } from '../../lib/templateFrameEditDtos';
import { TemplateEdgeResizeIntentService } from '../../services/templateEdgeResizeIntentService';
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

type FrameStylePatch = Omit<Partial<SelectionStyleDraft>, 'width' | 'height'> & {
  width?: number;
  height?: number;
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
  edgeSelectionAfterResize?: TemplateEdgeSelectionStateDto;
  edgeRoleById?: TemplateEdgeRoleMapDto;
  mutationEdgeIds?: string[];
  edgeDragSnapshot?: TemplateEdgeTopologySnapshotDto;
  edgeLineCoordinateBaseline?: Record<string, number>;
  appliedEdgeDeltaX?: number;
  appliedEdgeDeltaY?: number;
};

type EdgePressState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  node: HTMLElement;
  direction: TemplateFrameResizeDirection;
  clickedEdgeId: string;
  snapshot: TemplateEdgeTopologySnapshotDto;
  clickSelection: TemplateEdgeSelectionStateDto;
  dragSelection: TemplateEdgeSelectionStateDto;
  mutationEdgeIds: string[];
  edgeRoleById: TemplateEdgeRoleMapDto;
  withShift: boolean;
};

type EdgeRoleDiagnosticsState = {
  selectedEdgeClickedIds: string[];
  selectedEdgeAutoMultiIds: string[];
  peerEdgeIds: string[];
  mismatchEdgeIds: string[];
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

type EdgeResizeTargetMember = {
  handleId: string;
  edgeId: string;
  node: HTMLElement;
  shell: HTMLElement;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  side: TemplateEdgeSide;
  lineCoordinate: number;
  spanStart: number;
  spanEnd: number;
  boundaryIndex: number | null;
  widthInstructions?: FrameWidthResizeInstruction[];
};

type EdgeResizeTarget = {
  handleId: string;
  node: HTMLElement;
  shell: HTMLElement;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  boundaryIndex: number | null;
  hasOppositePeer: boolean;
  widthInstructions?: FrameWidthResizeInstruction[];
  members: EdgeResizeTargetMember[];
  physicalPeerMembers: EdgeResizeTargetMember[];
};

type TableCellLayoutPosition = {
  cell: HTMLTableCellElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

type SplitFrameBandGroup = {
  groupKey: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  entries: TableCellLayoutPosition[];
};

type NormalizedBandGeometry = {
  shell: HTMLElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  sourceKey: string;
};

type TemplateEditWorkspaceProps = {
  initialTemplateId?: string;
};

const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SELECTION_NODE_SELECTOR = RAW_FRAME_NODE_SELECTOR;
const FRAME_SELECTION_BADGE_CLASS = 'v106-frame-selection-badge';
const FRAME_RESIZE_HANDLE_SELECTOR = '[data-v106-resize-handle="true"]';
const FRAME_EDGE_BUTTON_SELECTOR = '[data-v106-edge-button="true"]';
const emptyEdgeRoleDiagnosticsState: EdgeRoleDiagnosticsState = {
  selectedEdgeClickedIds: [],
  selectedEdgeAutoMultiIds: [],
  peerEdgeIds: [],
  mismatchEdgeIds: [],
};
const FRAME_RESIZE_DIRECTIONS: TemplateFrameResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const EDGE_DRAG_START_THRESHOLD_PX = 4;
const EDGE_DRAG_AUTOSNAP_THRESHOLD_PX = 5;

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

const frameSelectionIdsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const edgeRoleDiagnosticsStatesEqual = (left: EdgeRoleDiagnosticsState, right: EdgeRoleDiagnosticsState) =>
  frameSelectionIdsEqual(left.selectedEdgeClickedIds, right.selectedEdgeClickedIds) &&
  frameSelectionIdsEqual(left.selectedEdgeAutoMultiIds, right.selectedEdgeAutoMultiIds) &&
  frameSelectionIdsEqual(left.peerEdgeIds, right.peerEdgeIds) &&
  frameSelectionIdsEqual(left.mismatchEdgeIds, right.mismatchEdgeIds);

const presetStylePatches: Record<string, FrameStylePatch> = {
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
const NORMALIZED_FRAME_BAND_ATTR = 'data-v106-normalized-band';
const NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR = 'data-v106-band-range';
const NORMALIZED_FRAME_BAND_COL_RANGE_ATTR = 'data-v106-band-col-range';
const NORMALIZED_FRAME_BAND_SOURCE_ATTR = 'data-v106-band-source';

const parseFramePx = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFrameCssPx = (value: number) => `${Number(value.toFixed(3))}px`;

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

const sumWritableTableSizes = (sizes: number[], startIndex = 0, endIndex = sizes.length) =>
  sizes
    .slice(startIndex, endIndex)
    .reduce((sum, size) => sum + getWritableTableSize(size), 0);

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
    const nextWidth = getWritableTableSize(colWidths[index] || 0);
    col.style.width = toFrameCssPx(nextWidth);
    col.removeAttribute('width');
  });
};

const setTableRowHeights = (table: HTMLTableElement, rowHeights: number[]) => {
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'));
  rows.forEach((row, index) => {
    const nextHeight = getWritableTableSize(rowHeights[index] || 0);
    row.style.height = toFrameCssPx(nextHeight);
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
    shell.style.width = toFrameCssPx(totalWidth);
  }

  if (syncHeight && totalHeight > 0) {
    shell.style.height = toFrameCssPx(totalHeight);
  }

  if (table) {
    if (syncWidth && totalWidth > 0) {
      table.style.width = toFrameCssPx(totalWidth);
    }

    if (syncHeight && totalHeight > 0) {
      table.style.height = toFrameCssPx(totalHeight);
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

const buildTableCellLayoutPositions = (table: HTMLTableElement): TableCellLayoutPosition[] => {
  const positions: TableCellLayoutPosition[] = [];
  const occupiedUntilByColumn: number[] = [];

  Array.from(table.rows).forEach((row, rowIndex) => {
    let nextColumnIndex = 0;
    const advanceToOpenColumn = () => {
      while ((occupiedUntilByColumn[nextColumnIndex] || 0) > rowIndex) {
        nextColumnIndex += 1;
      }
    };

    advanceToOpenColumn();

    Array.from(row.cells).forEach((cell) => {
      advanceToOpenColumn();

      const colSpan = Math.max(1, cell.colSpan || 1);
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      positions.push({
        cell,
        rowStart: rowIndex,
        rowEnd: rowIndex + rowSpan,
        colStart: nextColumnIndex,
        colEnd: nextColumnIndex + colSpan,
      });

      for (let offset = 0; offset < colSpan; offset += 1) {
        occupiedUntilByColumn[nextColumnIndex + offset] = Math.max(
          occupiedUntilByColumn[nextColumnIndex + offset] || 0,
          rowIndex + rowSpan
        );
      }

      nextColumnIndex += colSpan;
    });
  });

  return positions;
};

const buildFallbackTableColWidths = (
  positions: TableCellLayoutPosition[],
  pageInner: HTMLElement,
  columnCount: number
) => {
  const fallbackWidths = Array.from({ length: columnCount }, () => MIN_TABLE_COLUMN_WIDTH_PX);

  positions.forEach((position) => {
    const cellRect = readFrameElementRect(position.cell, pageInner);
    const widthPerColumn = Math.max(
      MIN_WRITABLE_TABLE_SIZE_PX,
      cellRect.width / Math.max(1, position.colEnd - position.colStart)
    );

    for (let columnIndex = position.colStart; columnIndex < position.colEnd; columnIndex += 1) {
      fallbackWidths[columnIndex] = Math.max(fallbackWidths[columnIndex] || 0, widthPerColumn);
    }
  });

  return fallbackWidths;
};

const buildSplitFrameBandGroups = (positions: TableCellLayoutPosition[]): SplitFrameBandGroup[] =>
  positions
    .filter((position) => position.cell.matches(RAW_FRAME_NODE_SELECTOR))
    .map((position, index) => ({
      groupKey:
        position.cell.getAttribute('data-template-frame-group')?.trim() ||
        `normalized-cell-${index}:${position.rowStart}:${position.rowEnd}:${position.colStart}:${position.colEnd}`,
      rowStart: position.rowStart,
      rowEnd: position.rowEnd,
      colStart: position.colStart,
      colEnd: position.colEnd,
      entries: [position],
    }))
    .sort((left, right) => left.rowStart - right.rowStart || left.colStart - right.colStart);

const stripTransientFrameEditorUi = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('[data-frame-editor-ui]').forEach((element) => {
    element.remove();
  });
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

const buildNormalizedFrameBandShell = (
  shell: HTMLElement,
  table: HTMLTableElement,
  pageInner: HTMLElement,
  group: SplitFrameBandGroup,
  colWidths: number[],
  rowHeights: number[]
) => {
  const tableRect = readFrameElementRect(table, pageInner);
  const tableStyle = getComputedStyle(table);
  const borderLeft = parseFramePx(tableStyle.borderLeftWidth);
  const borderTop = parseFramePx(tableStyle.borderTopWidth);
  const left = tableRect.left + borderLeft + sumWritableTableSizes(colWidths, 0, group.colStart);
  const top = tableRect.top + borderTop + sumWritableTableSizes(rowHeights, 0, group.rowStart);
  const width = sumWritableTableSizes(colWidths, group.colStart, group.colEnd);
  const height = sumWritableTableSizes(rowHeights, group.rowStart, group.rowEnd);
  const sourceKey =
    shell.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR) ||
    shell.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR)?.getAttribute('data-template-frame-group') ||
    `source:${shell.style.left}:${shell.style.top}:${shell.style.width}:${shell.style.height}`;
  const nextShell = shell.cloneNode(false) as HTMLElement;
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_ATTR, 'true');
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR, `${group.rowStart}:${group.rowEnd}`);
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_COL_RANGE_ATTR, `${group.colStart}:${group.colEnd}`);
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR, sourceKey);
  nextShell.setAttribute('data-v106-band-group-key', group.groupKey);
  nextShell.style.left = toFrameCssPx(left);
  nextShell.style.top = toFrameCssPx(top);
  nextShell.style.width = toFrameCssPx(width);
  nextShell.style.height = toFrameCssPx(height);

  const nextTable = table.cloneNode(false) as HTMLTableElement;
  nextTable.style.width = nextShell.style.width;
  nextTable.style.height = nextShell.style.height;
  nextTable.style.border = '0px';
  nextTable.style.borderLeftWidth = '0px';
  nextTable.style.borderRightWidth = '0px';
  nextTable.style.borderTopWidth = '0px';
  nextTable.style.borderBottomWidth = '0px';
  nextTable.style.borderSpacing = '0px';

  const colgroup = document.createElement('colgroup');
  colWidths.slice(group.colStart, group.colEnd).forEach((width) => {
    const col = document.createElement('col');
    col.style.width = toFrameCssPx(getWritableTableSize(width));
    colgroup.appendChild(col);
  });
  nextTable.appendChild(colgroup);

  const tbody = document.createElement('tbody');
  for (let rowIndex = group.rowStart; rowIndex < group.rowEnd; rowIndex += 1) {
    const sourceRow = table.rows.item(rowIndex);
    const nextRow = (sourceRow?.cloneNode(false) as HTMLTableRowElement | undefined) || document.createElement('tr');
    nextRow.style.height = toFrameCssPx(getWritableTableSize(rowHeights[rowIndex] || MIN_TABLE_ROW_HEIGHT_PX));
    tbody.appendChild(nextRow);
  }

  group.entries
    .slice()
    .sort((leftEntry, rightEntry) => leftEntry.colStart - rightEntry.colStart)
    .forEach((entry) => {
      const nextCell = entry.cell.cloneNode(true) as HTMLTableCellElement;
      nextCell.colSpan = Math.max(1, entry.colEnd - entry.colStart);
      nextCell.rowSpan = Math.max(1, entry.rowEnd - entry.rowStart);
      tbody.rows[entry.rowStart - group.rowStart]?.appendChild(nextCell);
    });

  nextTable.appendChild(tbody);
  nextShell.appendChild(nextTable);
  stripTransientFrameEditorUi(nextShell);
  TemplateFrameEditHtmlService.stripEditorUiState(nextShell);
  return nextShell;
};

const normalizeFrameBandTableLayout = (shell: HTMLElement) => {
  if (shell.getAttribute(NORMALIZED_FRAME_BAND_ATTR) === 'true') {
    return false;
  }

  const pageInner = shell.closest<HTMLElement>('.page-inner');
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');

  if (!pageInner || !table || table.rows.length <= 1) {
    return false;
  }

  const positions = buildTableCellLayoutPositions(table);
  const groups = buildSplitFrameBandGroups(positions);

  if (groups.length <= 1) {
    return false;
  }

  const columnCount = positions.reduce((maxColumnCount, position) => Math.max(maxColumnCount, position.colEnd), 0);
  const colWidthsFromTable = readTableColWidths(table);
  const colWidths =
    colWidthsFromTable.length >= columnCount
      ? colWidthsFromTable
      : buildFallbackTableColWidths(positions, pageInner, columnCount);
  const rowHeightsFromTable = readTableRowHeights(table);
  const rowHeights =
    rowHeightsFromTable.length >= table.rows.length
      ? rowHeightsFromTable
      : Array.from(table.rows).map((row, rowIndex) => {
          const fallbackHeight = parseFramePx(getComputedStyle(row).height) || row.getBoundingClientRect().height;
          return Math.max(
            MIN_WRITABLE_TABLE_SIZE_PX,
            rowHeightsFromTable[rowIndex] || fallbackHeight || MIN_TABLE_ROW_HEIGHT_PX
          );
        });

  const nextShells = groups.map((group) =>
    buildNormalizedFrameBandShell(shell, table, pageInner, group, colWidths, rowHeights)
  );

  shell.replaceWith(...nextShells);
  return true;
};

const ensurePreviewFrameBandNormalization = (root: ParentNode) => {
  let normalized = false;

  root.querySelectorAll<HTMLElement>('.page-inner').forEach((pageInner) => {
    let pageNormalized = false;

    Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band')).forEach((shell) => {
      const shellNormalized = normalizeFrameBandTableLayout(shell);
      pageNormalized = shellNormalized || pageNormalized;
      normalized = shellNormalized || normalized;
    });

    if (pageNormalized) {
      updatePageInnerMinHeight(pageInner);
    }
  });

  return normalized;
};

const parseNormalizedBandRange = (value: string | null | undefined) => {
  const [startValue, endValue] = String(value || '')
    .split(':')
    .map((entry) => Number.parseInt(entry, 10));

  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue <= startValue) {
    return null;
  }

  return {
    start: startValue,
    end: endValue,
  };
};

const readNormalizedBandGeometry = (shell: HTMLElement): NormalizedBandGeometry | null => {
  if (shell.getAttribute(NORMALIZED_FRAME_BAND_ATTR) !== 'true') {
    return null;
  }

  const rowRange = parseNormalizedBandRange(shell.getAttribute(NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR));
  const colRange = parseNormalizedBandRange(shell.getAttribute(NORMALIZED_FRAME_BAND_COL_RANGE_ATTR));
  const sourceKey = shell.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR)?.trim() || '';

  if (!rowRange || !colRange || !sourceKey) {
    return null;
  }

  return {
    shell,
    rowStart: rowRange.start,
    rowEnd: rowRange.end,
    colStart: colRange.start,
    colEnd: colRange.end,
    sourceKey,
  };
};

const buildDenormalizedFrameBandShell = (sourceShells: HTMLElement[]) => {
  const geometries = sourceShells
    .map((shell) => readNormalizedBandGeometry(shell))
    .filter((geometry): geometry is NormalizedBandGeometry => Boolean(geometry))
    .sort((left, right) => left.rowStart - right.rowStart || left.colStart - right.colStart);

  const templateShell = geometries[0]?.shell || null;
  const templateTable =
    templateShell?.querySelector<HTMLTableElement>('table.v102-frame-band-table') ||
    templateShell?.querySelector<HTMLTableElement>('table') ||
    null;

  if (!templateShell || !templateTable) {
    return null;
  }

  const rowCount = geometries.reduce((maxRowCount, geometry) => Math.max(maxRowCount, geometry.rowEnd), 0);
  const colCount = geometries.reduce((maxColumnCount, geometry) => Math.max(maxColumnCount, geometry.colEnd), 0);
  const rowHeights = Array.from({ length: rowCount }, () => MIN_TABLE_ROW_HEIGHT_PX);
  const colWidths = Array.from({ length: colCount }, () => MIN_TABLE_COLUMN_WIDTH_PX);
  const shellRects = geometries.map((geometry) => readFrameElementRect(geometry.shell));

  geometries.forEach((geometry) => {
    const shellTable =
      geometry.shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') ||
      geometry.shell.querySelector<HTMLTableElement>('table') ||
      null;

    if (!shellTable) {
      return;
    }

    readTableColWidths(shellTable).forEach((width, index) => {
      const absoluteIndex = geometry.colStart + index;
      colWidths[absoluteIndex] = Math.max(colWidths[absoluteIndex] || 0, width);
    });
    readTableRowHeights(shellTable).forEach((height, index) => {
      const absoluteIndex = geometry.rowStart + index;
      rowHeights[absoluteIndex] = Math.max(rowHeights[absoluteIndex] || 0, height);
    });
  });

  const nextShell = templateShell.cloneNode(false) as HTMLElement;
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_ATTR);
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR);
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_COL_RANGE_ATTR);
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR);
  nextShell.removeAttribute('data-v106-band-group-key');
  nextShell.style.left = toFrameCssPx(Math.min(...shellRects.map((rect) => rect.left)));
  nextShell.style.top = toFrameCssPx(Math.min(...shellRects.map((rect) => rect.top)));
  nextShell.style.width = toFrameCssPx(colWidths.reduce((sum, width) => sum + getWritableTableSize(width), 0));
  nextShell.style.height = toFrameCssPx(rowHeights.reduce((sum, height) => sum + getWritableTableSize(height), 0));

  const nextTable = templateTable.cloneNode(false) as HTMLTableElement;
  nextTable.style.border = '';
  nextTable.style.borderLeftWidth = '';
  nextTable.style.borderRightWidth = '';
  nextTable.style.borderTopWidth = '';
  nextTable.style.borderBottomWidth = '';
  nextTable.style.borderSpacing = '';
  nextTable.style.width = nextShell.style.width;
  nextTable.style.height = nextShell.style.height;

  const colgroup = document.createElement('colgroup');
  colWidths.forEach((width) => {
    const col = document.createElement('col');
    col.style.width = toFrameCssPx(getWritableTableSize(width));
    colgroup.appendChild(col);
  });
  nextTable.appendChild(colgroup);

  const tbody = document.createElement('tbody');
  rowHeights.forEach((height) => {
    const row = document.createElement('tr');
    row.style.height = toFrameCssPx(getWritableTableSize(height));
    tbody.appendChild(row);
  });

  geometries.forEach((geometry) => {
    const shellTable =
      geometry.shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') ||
      geometry.shell.querySelector<HTMLTableElement>('table') ||
      null;

    if (!shellTable) {
      return;
    }

    Array.from(shellTable.rows).forEach((row, rowOffset) => {
      const targetRow = tbody.rows[geometry.rowStart + rowOffset];

      Array.from(row.cells).forEach((cell) => {
        targetRow?.appendChild(cell.cloneNode(true));
      });
    });
  });

  nextTable.appendChild(tbody);
  nextShell.appendChild(nextTable);
  stripTransientFrameEditorUi(nextShell);
  TemplateFrameEditHtmlService.stripEditorUiState(nextShell);
  return nextShell;
};

const denormalizePreviewFrameBands = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('.page-inner').forEach((pageInner) => {
    const groupedShells = new Map<string, HTMLElement[]>();

    Array.from(pageInner.querySelectorAll<HTMLElement>(`.v102-frame-band[${NORMALIZED_FRAME_BAND_ATTR}="true"]`)).forEach((shell) => {
      const sourceKey = shell.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR)?.trim();

      if (!sourceKey) {
        return;
      }

      const current = groupedShells.get(sourceKey);

      if (current) {
        current.push(shell);
        return;
      }

      groupedShells.set(sourceKey, [shell]);
    });

    groupedShells.forEach((sourceShells) => {
      const replacementShell = buildDenormalizedFrameBandShell(sourceShells);

      if (!replacementShell) {
        return;
      }

      const [firstShell, ...remainingShells] = sourceShells;
      firstShell.replaceWith(replacementShell);
      remainingShells.forEach((shell) => shell.remove());
    });
  });
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
    const nextWidth = Math.max(MIN_FRAME_SIZE_PX, shellRect.width + delta);
    shell.style.width = toFrameCssPx(nextWidth);
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
    const nextWidth = Math.max(MIN_FRAME_SIZE_PX, shellRect.width - delta);
    const appliedDelta = shellRect.width - nextWidth;
    shell.style.left = toFrameCssPx(currentLeft + appliedDelta);
    shell.style.width = toFrameCssPx(nextWidth);
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
    shell.style.left = toFrameCssPx(currentLeft + applied);
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
  shell.style.left = toFrameCssPx(currentLeft + delta);
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

const areOppositeBoundarySides = (leftSide: TemplateEdgeSide, rightSide: TemplateEdgeSide) =>
  (leftSide === 'left' && rightSide === 'right') ||
  (leftSide === 'right' && rightSide === 'left') ||
  (leftSide === 'top' && rightSide === 'bottom') ||
  (leftSide === 'bottom' && rightSide === 'top');

const targetsSharePhysicalBoundary = (
  left: Pick<EdgeResizeTargetMember, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  right: Pick<EdgeResizeTargetMember, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>
) =>
  left.edgeId !== right.edgeId &&
  left.orientation === right.orientation &&
  areOppositeBoundarySides(left.side, right.side) &&
  Math.abs(left.lineCoordinate - right.lineCoordinate) <= FRAME_RESIZE_TOLERANCE_PX &&
  Math.max(left.spanStart, right.spanStart) < Math.min(left.spanEnd, right.spanEnd);

const edgesSharePhysicalBoundary = (
  left: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>
) =>
  left.edgeId !== right.edgeId &&
  left.orientation === right.orientation &&
  areOppositeBoundarySides(left.side, right.side) &&
  Math.abs(left.lineCoordinate - right.lineCoordinate) <= FRAME_RESIZE_TOLERANCE_PX &&
  Math.max(left.spanStart, right.spanStart) < Math.min(left.spanEnd, right.spanEnd);

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
      shell.style.top = toFrameCssPx(shellRect.top + deltaY);
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
    const nextHeight = Math.max(MIN_FRAME_SIZE_PX, shellRect.height + delta);
    shell.style.height = toFrameCssPx(nextHeight);
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

const applyFrameResizeHeightDeltaLocal = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (Math.abs(delta) < 0.5) {
    return 0;
  }

  const resizesOuterBottom = context.singleCellBand || context.rowHeights.length <= context.endRowIndex;
  let appliedDelta = 0;

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

  if (Math.abs(appliedDelta) > 0.5) {
    stabilizeFrameContentHeight(node);
  }

  return appliedDelta;
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
    const nextHeight = Math.max(MIN_FRAME_SIZE_PX, shellRect.height - delta);
    const appliedDelta = shellRect.height - nextHeight;
    shell.style.top = toFrameCssPx(currentTop + appliedDelta);
    shell.style.height = toFrameCssPx(nextHeight);
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
    shell.style.top = toFrameCssPx(currentTop + applied);
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return applied;
  }

  const nextRowHeights = [...rowHeights];
  nextRowHeights[firstIndex] += Math.abs(delta);
  shell.style.top = toFrameCssPx(currentTop + delta);
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

const resolveWidthInstructionDelta = (instructions: FrameWidthResizeInstruction[], delta: number) => {
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

  return Math.abs(appliedDelta) >= 0.5 ? appliedDelta : 0;
};

const resolveFrameResizeTopDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (delta < 0) {
    if (context.singleCellBand || context.startRowIndex === 0 || !context.table || context.rowHeights.length === 0) {
      return delta;
    }

    const minimums = readTableRowMinimums(context.table, context.rowHeights);
    const upperIndex = Math.max(0, context.startRowIndex - 1);
    const capacity = Math.max(0, context.rowHeights[upperIndex] - getWritableTableSize(minimums[upperIndex] || 0));

    return -Math.min(Math.abs(delta), capacity);
  }

  if (delta <= 0) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (!context.table || context.rowHeights.length === 0) {
    return Math.min(delta, Math.max(0, context.shellRect.height - MIN_FRAME_SIZE_PX));
  }

  const minimums = readTableRowMinimums(context.table, context.rowHeights);
  const shrinkRange = {
    startIndex: context.startRowIndex,
    endIndex: context.endRowIndex - 1,
    side: 'after' as const,
  };
  const capacity = getRangeShrinkCapacity(context.rowHeights, minimums, shrinkRange);

  return Math.min(delta, capacity);
};

const resolveFrameResizeBottomDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (delta > 0) {
    if (
      context.singleCellBand ||
      context.rowHeights.length <= context.endRowIndex ||
      !context.table ||
      context.rowHeights.length === 0
    ) {
      return delta;
    }

    const minimums = readTableRowMinimums(context.table, context.rowHeights);
    const lowerIndex = Math.min(context.rowHeights.length - 1, context.endRowIndex);
    const capacity = Math.max(0, context.rowHeights[lowerIndex] - getWritableTableSize(minimums[lowerIndex] || 0));

    return Math.min(delta, capacity);
  }

  if (delta >= 0) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (!context.table || context.rowHeights.length === 0) {
    return -Math.min(Math.abs(delta), Math.max(0, context.shellRect.height - MIN_FRAME_SIZE_PX));
  }

  const minimums = readTableRowMinimums(context.table, context.rowHeights);
  const shrinkRange = {
    startIndex: context.startRowIndex,
    endIndex: context.endRowIndex - 1,
    side: 'before' as const,
  };
  const capacity = getRangeShrinkCapacity(context.rowHeights, minimums, shrinkRange);

  return -Math.min(Math.abs(delta), capacity);
};

const resolveSharedEdgeResizeDelta = (requestedDelta: number, candidateDeltas: number[]) => {
  if (Math.abs(requestedDelta) < 0.5 || candidateDeltas.length === 0) {
    return 0;
  }

  if (requestedDelta > 0) {
    const positiveCandidates = candidateDeltas.map((candidateDelta) => Math.max(0, candidateDelta));
    return positiveCandidates.length > 0 ? Math.min(...positiveCandidates) : 0;
  }

  const negativeCandidates = candidateDeltas.map((candidateDelta) => Math.max(0, Math.abs(candidateDelta)));
  return negativeCandidates.length > 0 ? -Math.min(...negativeCandidates) : 0;
};

const readEdgeSpanOverlapLength = (
  left: Pick<EdgeResizeTargetMember, 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'spanStart' | 'spanEnd'>
) => Math.min(left.spanEnd, right.spanEnd) - Math.max(left.spanStart, right.spanStart);

const resolveEdgeDragAutosnapDelta = ({
  requestedDelta,
  orientation,
  movingMembers,
  snapshot,
}: {
  requestedDelta: number;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  movingMembers: EdgeResizeTargetMember[];
  snapshot?: TemplateEdgeTopologySnapshotDto;
}) => {
  if (!snapshot || Math.abs(requestedDelta) < 0.5 || movingMembers.length === 0) {
    return requestedDelta;
  }

  const movingEdgeIdSet = new Set(movingMembers.map((member) => member.edgeId));
  let bestAdjustment: number | null = null;

  movingMembers.forEach((member) => {
    const movingEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, member.edgeId);

    snapshot.edges.forEach((candidateEdge) => {
      if (
        movingEdgeIdSet.has(candidateEdge.edgeId) ||
        candidateEdge.orientation !== orientation ||
        (movingEdge && candidateEdge.pageId !== movingEdge.pageId)
      ) {
        return;
      }

      if (readEdgeSpanOverlapLength(member, candidateEdge) <= FRAME_RESIZE_TOLERANCE_PX) {
        return;
      }

      const adjustment = candidateEdge.lineCoordinate - (member.lineCoordinate + requestedDelta);

      if (Math.abs(adjustment) >= EDGE_DRAG_AUTOSNAP_THRESHOLD_PX) {
        return;
      }

      const snappedDelta = requestedDelta + adjustment;

      if ((requestedDelta > 0 && snappedDelta < 0) || (requestedDelta < 0 && snappedDelta > 0)) {
        return;
      }

      if (bestAdjustment === null || Math.abs(adjustment) < Math.abs(bestAdjustment)) {
        bestAdjustment = adjustment;
      }
    });
  });

  return bestAdjustment === null ? requestedDelta : requestedDelta + bestAdjustment;
};

const pickHeightResizeTargetMember = (
  target: EdgeResizeTarget,
  direction: TemplateFrameResizeDirection
): EdgeResizeTargetMember | null => {
  if (direction.includes('n')) {
    return target.members.find((member) => member.side === 'top') || target.members.find((member) => member.side === 'bottom') || null;
  }

  if (direction.includes('s')) {
    return (
      target.members.find((member) => member.side === 'bottom') ||
      target.members.find((member) => member.side === 'top') ||
      null
    );
  }

  return null;
};

const writeFrameMoveRect = (node: HTMLElement, rect: FrameNodeRect) => {
  const shell = resolveFrameLayoutShell(node);
  shell.style.left = toFrameCssPx(rect.left);
  shell.style.top = toFrameCssPx(rect.top);
  shell.style.width = toFrameCssPx(Math.max(MIN_FRAME_SIZE_PX, rect.width));
  shell.style.height = toFrameCssPx(Math.max(MIN_FRAME_SIZE_PX, rect.height));
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

const resolveFrameSelectionAnchor = (node: HTMLElement | null) => {
  if (!node) {
    return null;
  }

  const frameGroupId = getFrameGroupId(node);

  if (!frameGroupId) {
    return null;
  }

  let current: HTMLElement | null = node;
  let fallbackAnchor: HTMLElement | null = null;
  let tableCellAnchor: HTMLElement | null = null;

  while (current) {
    if (getFrameGroupId(current) === frameGroupId) {
      fallbackAnchor = current;

      if (!tableCellAnchor && current.matches('td,th')) {
        tableCellAnchor = current;
      }
    }

    current = current.parentElement;
  }

  return tableCellAnchor || fallbackAnchor;
};

const collectFrameSelectionAnchors = (scope?: ParentNode | null) => {
  const anchorMap = new Map<string, HTMLElement>();

  Array.from(scope?.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR) || []).forEach((node) => {
    const anchorNode = resolveFrameSelectionAnchor(node);
    const frameGroupId = getFrameGroupId(anchorNode);

    if (!anchorNode || !frameGroupId || anchorMap.has(frameGroupId)) {
      return;
    }

    anchorMap.set(frameGroupId, anchorNode);
  });

  return Array.from(anchorMap.values());
};

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
  denormalizePreviewFrameBands(container);
  stripSelectionAttrs(container);
  TemplateFrameEditHtmlService.stripEditorUiState(container);
  return container.innerHTML.trim();
};

const extractPreviewRenderHtml = (root: HTMLElement) => {
  const container = document.createElement('div');
  container.innerHTML = root.innerHTML;
  syncFormControlMarkup(container);
  stripTransientFrameEditorUi(container);
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
  selectionOrder: number | null,
  mode: 'connected' | 'isolated' | 'idle',
  isAnchorEdge: boolean,
  role: TemplateEdgeSelectionRole | null,
  hasMovementMismatch: boolean
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-v106-edge-button', 'true');
  button.setAttribute('data-frame-editor-ui', 'true');
  button.setAttribute('data-direction', getDirectionFromEdgeSide(side));
  button.setAttribute('data-edge-id', edgeId);
  button.setAttribute('data-side', side);
  button.setAttribute('data-edge-selection-mode', mode);
  if (selectionOrder !== null) {
    button.setAttribute('data-edge-selection-order', String(selectionOrder));
  }
  if (isAnchorEdge) {
    button.setAttribute('data-edge-anchor', 'true');
  }
  if (role) {
    button.setAttribute('data-edge-selection-role', role);
  }
  if (hasMovementMismatch) {
    button.setAttribute('data-edge-movement-mismatch', 'true');
  }
  button.setAttribute('aria-label', `${side} edge resize`);
  return button;
};

const applyFrameSelectionUi = (
  root: HTMLElement,
  selectedIds: string[],
  edgeSelectionState: TemplateEdgeSelectionStateDto,
  edgeSnapshot: TemplateEdgeTopologySnapshotDto | null,
  edgeRoleById: TemplateEdgeRoleMapDto,
  edgeMovementMismatchIds: string[]
) => {
  stripSelectionAttrs(root);
  TemplateFrameEditHtmlService.stripEditorUiState(root);

  const edgeMetaMap = new Map<
    string,
    {
      selectionOrder: number;
      mode: 'connected' | 'isolated';
      isAnchorEdge: boolean;
    }
  >();

  edgeSelectionState.tokens.forEach((token) => {
    token.memberEdgeIds.forEach((edgeId) => {
      edgeMetaMap.set(edgeId, {
        selectionOrder: token.selectionOrder,
        mode: token.mode,
        isAnchorEdge: edgeId === token.anchorEdgeId,
      });
    });
  });

  const edgeMap = new Map((edgeSnapshot?.edges || []).map((edge) => [edge.edgeId, edge]));

  collectFrameSelectionAnchors(root).forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    const selectionIndex = selectedIds.indexOf(frameGroupId);

    node.setAttribute('data-template-edge-host', 'true');

    if (selectionIndex >= 0) {
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
        FRAME_RESIZE_DIRECTIONS.forEach((direction) => {
          node.appendChild(buildResizeHandle(direction));
        });
      }
    }

    if (!edgeSnapshot) {
      return;
    }

    (['left', 'right', 'top', 'bottom'] as TemplateEdgeSide[]).forEach((side) => {
      const edgeId = `${frameGroupId}:${side}`;
      const edge = edgeMap.get(edgeId);
      const edgeMeta = edgeMetaMap.get(edgeId);
      const edgeRole = edgeRoleById[edgeId] || null;

      if (!edge) {
        return;
      }

      if (edgeMeta) {
        node.setAttribute('data-template-edge-visual', 'true');

        if (edgeMeta.isAnchorEdge) {
          node.setAttribute('data-template-edge-anchor-node', 'true');
        }
      }

      node.appendChild(
        buildEdgeSelectionButton(
          side,
          edgeId,
          edgeMeta?.selectionOrder ?? null,
          edgeMeta?.mode || 'idle',
          Boolean(edgeMeta?.isAnchorEdge),
          edgeRole,
          edgeMovementMismatchIds.includes(edgeId)
        )
      );
    });
  });
};

const applyFrameStylePatch = (
  node: HTMLElement,
  patch: FrameStylePatch
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
  const [edgeRoleDiagnostics, setEdgeRoleDiagnostics] = React.useState<EdgeRoleDiagnosticsState>(
    emptyEdgeRoleDiagnosticsState
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
  const previewEditorStateFrameRef = React.useRef<number | null>(null);
  const previewEditorStateRetryCountRef = React.useRef(0);

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
  const selectedEdgeClickedCount = edgeRoleDiagnostics.selectedEdgeClickedIds.length;
  const selectedEdgeAutoMultiCount = edgeRoleDiagnostics.selectedEdgeAutoMultiIds.length;
  const peerEdgeCount = edgeRoleDiagnostics.peerEdgeIds.length;

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

    const nextDraftHtml = extractEditorHtml(root);
    const nextRenderHtml = extractPreviewRenderHtml(root);
    draftPreviewHtmlRef.current = nextDraftHtml;
    setPreviewHtml(nextRenderHtml);
    return nextDraftHtml;
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
    (scope?: ParentNode | null) => collectFrameSelectionAnchors(scope || previewRef.current),
    []
  );

  const previewHasStableFrameLayout = React.useCallback((root: ParentNode) => {
    const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR));

    if (!frameNodes.length) {
      return false;
    }

    const rawBandTables = Array.from(root.querySelectorAll<HTMLTableElement>('.v102-frame-band table')).filter(
      (table) =>
        table.rows.length > 1 && table.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR).length > 1
    );

    if (rawBandTables.length === 0) {
      return frameNodes.some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > MIN_FRAME_SIZE_PX + 0.5 || rect.height > MIN_FRAME_SIZE_PX + 0.5;
      });
    }

    return rawBandTables.every((table) => {
      const tableRect = table.getBoundingClientRect();

      if (tableRect.width <= MIN_FRAME_SIZE_PX * 2 || tableRect.height <= MIN_FRAME_SIZE_PX * 2) {
        return false;
      }

      const sizableFrameNodes = Array.from(table.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR)).filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > MIN_FRAME_SIZE_PX + 0.5 || rect.height > MIN_FRAME_SIZE_PX + 0.5;
      });

      return sizableFrameNodes.length >= 2;
    });
  }, []);

  const cancelScheduledPreviewEditorState = React.useCallback(() => {
    if (typeof window === 'undefined' || previewEditorStateFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(previewEditorStateFrameRef.current);
    previewEditorStateFrameRef.current = null;
  }, []);

  const buildLiveEdgeTopologySnapshot = React.useCallback((root: HTMLElement): TemplateEdgeTopologySnapshotDto => {
    const pages = Array.from(root.querySelectorAll<HTMLElement>('section.page'));
    const frames: TemplateEdgeFrameDto[] = getFrameNodes(root).map((node) => {
      const pageElement = node.closest<HTMLElement>('section.page');
      const pageIndex = Math.max(0, pages.indexOf(pageElement || pages[0] || node));

      return {
        frameGroupId: getFrameGroupId(node),
        pageId: `page-${pageIndex + 1}`,
        rect: readFrameNodeRect(node),
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

  const resolveEdgeRolePresentation = React.useCallback(
    (
      snapshot: TemplateEdgeTopologySnapshotDto,
      selectionState: TemplateEdgeSelectionStateDto,
      mismatchEdgeIds: string[] = []
    ) => {
      const roleSummary = TemplateEdgeResizeIntentService.describeSelectionRoles(
        snapshot,
        selectionState,
        selectionState.tokens[0]?.anchorEdgeId
      );
      return {
        edgeRoleById: roleSummary.edgeRoleById,
        diagnosticsState: {
          selectedEdgeClickedIds: roleSummary.selectedEdgeClickedIds,
          selectedEdgeAutoMultiIds: roleSummary.selectedEdgeAutoMultiIds,
          peerEdgeIds: roleSummary.peerEdgeIds,
          mismatchEdgeIds,
        },
      };
    },
    []
  );

  const detectEdgeRoleMovementMismatches = React.useCallback(
    (root: HTMLElement | null, resizeState: ResizeState | null) => {
      if (!root || !resizeState?.mutationEdgeIds?.length || !resizeState.edgeResizeTargets?.length) {
        return [];
      }

      const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
      const orientation = resizeState.edgeResizeTargets[0]?.orientation;
      const roleEdgeIds = Object.keys(resizeState.edgeRoleById || {});
      const expectedEdgeIds = roleEdgeIds.length > 0 ? roleEdgeIds : resizeState.mutationEdgeIds;
      const expectedEdgeIdSet = new Set(expectedEdgeIds);
      const referenceEdgeId =
        expectedEdgeIds.find((edgeId) => resizeState.edgeRoleById?.[edgeId] === 'selected_edge_clicked') ||
        expectedEdgeIds[0] ||
        null;
      const referenceBaseline = referenceEdgeId ? resizeState.edgeLineCoordinateBaseline?.[referenceEdgeId] : Number.NaN;
      const referenceLiveEdge = referenceEdgeId ? TemplateEdgeTopologyService.getEdgeById(liveSnapshot, referenceEdgeId) : null;
      const expectedDelta =
        Number.isFinite(referenceBaseline) && referenceLiveEdge
          ? referenceLiveEdge.lineCoordinate - referenceBaseline
          : orientation === 'vertical'
            ? resizeState.appliedEdgeDeltaX || 0
            : resizeState.appliedEdgeDeltaY || 0;
      const expectedMismatchIds = expectedEdgeIds.filter((edgeId) => {
        const baselineLineCoordinate = resizeState.edgeLineCoordinateBaseline?.[edgeId];
        const edge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId);
        const appliedMovementPresent = Math.abs(expectedDelta) > FRAME_RESIZE_TOLERANCE_PX;

        if (!Number.isFinite(baselineLineCoordinate) || !edge) {
          return true;
        }

        if (!resizeState.edgeRoleById?.[edgeId] && appliedMovementPresent) {
          return true;
        }

        return Math.abs(edge.lineCoordinate - baselineLineCoordinate - expectedDelta) > FRAME_RESIZE_TOLERANCE_PX;
      });
      const unexpectedMovedEdgeIds = liveSnapshot.edges
        .filter((edge) => edge.orientation === orientation && !expectedEdgeIdSet.has(edge.edgeId))
        .filter((edge) => {
          const baselineLineCoordinate = resizeState.edgeLineCoordinateBaseline?.[edge.edgeId];

          if (!Number.isFinite(baselineLineCoordinate)) {
            return false;
          }

          return Math.abs(edge.lineCoordinate - baselineLineCoordinate) > FRAME_RESIZE_TOLERANCE_PX;
        })
        .map((edge) => edge.edgeId);

      return Array.from(new Set([...expectedMismatchIds, ...unexpectedMovedEdgeIds]));
    },
    [buildLiveEdgeTopologySnapshot]
  );

  const schedulePreviewEditorState = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    cancelScheduledPreviewEditorState();
    previewEditorStateFrameRef.current = window.requestAnimationFrame(() => {
      previewEditorStateFrameRef.current = null;
      const root = previewRef.current;

      if (!root) {
        return;
      }

      const hasPendingRawBands =
        Boolean(root.querySelector('.v102-frame-band')) &&
        !root.querySelector(`.v102-frame-band[${NORMALIZED_FRAME_BAND_ATTR}="true"]`);

      if (hasPendingRawBands && !previewHasStableFrameLayout(root)) {
        if (previewEditorStateRetryCountRef.current < 8) {
          previewEditorStateRetryCountRef.current += 1;
          schedulePreviewEditorState();
        }
        return;
      }

      previewEditorStateRetryCountRef.current = 0;
      const normalized = ensurePreviewFrameBandNormalization(root);
      applyPreviewEditPermissions(root);
      const nextRenderHtml = normalized ? extractPreviewRenderHtml(root) : '';

      if (nextRenderHtml && nextRenderHtml !== renderedPreviewHtml) {
        setPreviewHtml(nextRenderHtml);
      }

      const snapshot = buildLiveEdgeTopologySnapshot(root);
      const nextEdgeSelection = TemplateEdgeSelectionService.reconcileSelectionState({
        snapshot,
        currentSelection: edgeSelectionStateRef.current,
      });
      const edgeSelectionChanged = !edgeSelectionStatesEqual(nextEdgeSelection, edgeSelectionStateRef.current);

      edgeSelectionStateRef.current = nextEdgeSelection;
      const nextEdgeRolePresentation = resolveEdgeRolePresentation(
        snapshot,
        nextEdgeSelection,
        edgeRoleDiagnostics.mismatchEdgeIds
      );
      applyFrameSelectionUi(
        root,
        selectedFrameGroupIdsRef.current,
        nextEdgeSelection,
        snapshot,
        nextEdgeRolePresentation.edgeRoleById,
        nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds
      );
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );

      if (edgeSelectionChanged) {
        setEdgeSelectionState(nextEdgeSelection);
      }

      requestPreviewTextFit();
    });
  }, [
    buildLiveEdgeTopologySnapshot,
    cancelScheduledPreviewEditorState,
    edgeRoleDiagnostics.mismatchEdgeIds,
    previewHasStableFrameLayout,
    renderedPreviewHtml,
    resolveEdgeRolePresentation,
    requestPreviewTextFit,
  ]);

  const setPreviewNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      previewRef.current = node;

      if (node && renderedPreviewHtml) {
        schedulePreviewEditorState();
      }
    },
    [renderedPreviewHtml, schedulePreviewEditorState]
  );

  const applyRuntimeSelectionUi = React.useCallback(
    (nextSelectedFrameGroupIds: string[], nextEdgeSelectionState: TemplateEdgeSelectionStateDto) => {
      selectedFrameGroupIdsRef.current = nextSelectedFrameGroupIds;
      edgeSelectionStateRef.current = nextEdgeSelectionState;
      const root = previewRef.current;

      if (!root) {
        return;
      }

      applyPreviewEditPermissions(root);
      const reconciledEdgeSelection = reconcileLiveEdgeSelection(root, nextEdgeSelectionState);
      const snapshot = buildLiveEdgeTopologySnapshot(root);
      const nextEdgeRolePresentation = resolveEdgeRolePresentation(snapshot, reconciledEdgeSelection);
      applyFrameSelectionUi(
        root,
        nextSelectedFrameGroupIds,
        reconciledEdgeSelection,
        snapshot,
        nextEdgeRolePresentation.edgeRoleById,
        nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds
      );
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );
    },
    [buildLiveEdgeTopologySnapshot, reconcileLiveEdgeSelection, resolveEdgeRolePresentation]
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
        setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
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
        setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
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

    if (!root || !renderedPreviewHtml || typeof window === 'undefined') {
      return;
    }

    draftPreviewHtmlRef.current = renderedPreviewHtml;
    let cancelled = false;
    const applyEditorState = async () => {
      schedulePreviewEditorState();
      await document.fonts?.ready?.catch(() => undefined);

      if (cancelled) {
        return;
      }

      schedulePreviewEditorState();
    };

    const pageInnerObservers = Array.from(root.querySelectorAll<HTMLElement>('.page-inner')).map((pageInner) => {
      const observer = new MutationObserver(() => {
        if (cancelled) {
          return;
        }

        if (!root.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
          schedulePreviewEditorState();
        }
      });
      observer.observe(pageInner, { childList: true });
      return observer;
    });

    void applyEditorState();

    return () => {
      cancelled = true;
      previewEditorStateRetryCountRef.current = 0;
      cancelScheduledPreviewEditorState();
      pageInnerObservers.forEach((observer) => observer.disconnect());
    };
  }, [cancelScheduledPreviewEditorState, renderedPreviewHtml, schedulePreviewEditorState]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined') {
      return;
    }

    let attempts = 0;
    const timerId = window.setInterval(() => {
      const liveRoot = previewRef.current;

      if (!liveRoot) {
        return;
      }

      if (liveRoot.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
        window.clearInterval(timerId);
        return;
      }

      schedulePreviewEditorState();
      attempts += 1;

      if (attempts >= 12) {
        window.clearInterval(timerId);
      }
    }, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [renderedPreviewHtml, schedulePreviewEditorState]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    if (!root.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
      schedulePreviewEditorState();
      return;
    }

    applyPreviewEditPermissions(root);
    const snapshot = buildLiveEdgeTopologySnapshot(root);
    const nextEdgeSelection = TemplateEdgeSelectionService.reconcileSelectionState({
      snapshot,
      currentSelection: edgeSelectionState,
    });
    edgeSelectionStateRef.current = nextEdgeSelection;
    const nextEdgeRolePresentation = resolveEdgeRolePresentation(
      snapshot,
      nextEdgeSelection,
      edgeRoleDiagnostics.mismatchEdgeIds
    );
    applyFrameSelectionUi(
      root,
      selectedFrameGroupIds,
      nextEdgeSelection,
      snapshot,
      nextEdgeRolePresentation.edgeRoleById,
      nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds
    );
    setEdgeRoleDiagnostics((previous) =>
      edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
        ? previous
        : nextEdgeRolePresentation.diagnosticsState
    );
  }, [
    buildLiveEdgeTopologySnapshot,
    edgeRoleDiagnostics.mismatchEdgeIds,
    edgeSelectionState,
    renderedPreviewHtml,
    resolveEdgeRolePresentation,
    schedulePreviewEditorState,
    selectedFrameGroupIds,
    selectionStyleDraft,
  ]);

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
    (patch: FrameStylePatch) => {
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

  const getResizeShellAnchorId = React.useCallback((shell: HTMLElement, fallbackNode?: HTMLElement | null) => {
    const shellAnchorNode = shell.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) || fallbackNode || null;
    const shellAnchorId = shellAnchorNode ? getFrameGroupId(shellAnchorNode) : '';

    return shellAnchorId || `shell:${shell.style.left}:${shell.style.top}:${shell.style.width}:${shell.style.height}`;
  }, []);

  const serializeBoundaryShrinkRange = React.useCallback(
    (range?: BoundaryShrinkRange) =>
      range ? `${range.startIndex}:${range.endIndex}:${range.side}` : 'none',
    []
  );

  const buildWidthInstructionKey = React.useCallback(
    (instruction: FrameWidthResizeInstruction, fallbackNode?: HTMLElement | null) => {
      const shellAnchorId = getResizeShellAnchorId(instruction.shell, fallbackNode);

      if (instruction.kind === 'boundary') {
        return [
          shellAnchorId,
          instruction.kind,
          instruction.boundaryIndex,
          serializeBoundaryShrinkRange(instruction.shrinkRange),
        ].join('|');
      }

      return [
        shellAnchorId,
        instruction.kind,
        serializeBoundaryShrinkRange(instruction.shrinkRange),
        serializeBoundaryShrinkRange(instruction.minimumStopRange),
      ].join('|');
    },
    [getResizeShellAnchorId, serializeBoundaryShrinkRange]
  );

  const buildEdgeResizeHandleId = React.useCallback(
    (
      node: HTMLElement,
      shell: HTMLElement,
      orientation: TemplateEdgeDescriptorDto['orientation'],
      side: TemplateEdgeSide,
      boundaryIndex: number | null
    ) => {
      const shellAnchorId = getResizeShellAnchorId(shell, node);
      const boundaryKey =
        boundaryIndex === null
          ? orientation === 'vertical'
            ? side === 'left'
              ? 'start'
              : 'end'
            : side === 'top'
              ? 'start'
              : 'end'
          : String(boundaryIndex);

      return `${shellAnchorId}:${orientation}:${boundaryKey}`;
    },
    [getResizeShellAnchorId]
  );

  const collectDirectRoleResizeTargets = React.useCallback(
    (root: HTMLElement, snapshot: TemplateEdgeTopologySnapshotDto, edgeIds: string[]) => {
      const handleMap = new Map<string, EdgeResizeTarget>();

      Array.from(new Set(edgeIds)).forEach((edgeId) => {
        const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

        if (!edge) {
          return;
        }

        const node = getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === edge.frameGroupId) || null;

        if (!node) {
          return;
        }

        const context = buildFrameResizeContext(node);
        const widthInstruction =
          edge.side === 'left' || edge.side === 'right'
            ? buildSelfWidthResizeInstruction(context, edge.side)
            : null;
        const boundaryIndex =
          edge.side === 'left'
            ? context.startColIndex
            : edge.side === 'right'
              ? context.endColIndex
              : edge.side === 'top'
                ? context.startRowIndex
                : context.endRowIndex;
        const member: EdgeResizeTargetMember = {
          handleId: buildEdgeResizeHandleId(
            node,
            context.shell,
            edge.orientation,
            edge.side,
            context.singleCellBand ? null : boundaryIndex
          ),
          edgeId: edge.edgeId,
          node,
          shell: context.shell,
          orientation: edge.orientation,
          side: edge.side,
          lineCoordinate: edge.lineCoordinate,
          spanStart: edge.spanStart,
          spanEnd: edge.spanEnd,
          boundaryIndex: context.singleCellBand ? null : boundaryIndex,
          widthInstructions: widthInstruction ? [widthInstruction] : undefined,
        };
        const existingTarget = handleMap.get(member.handleId);

        if (existingTarget) {
          if (!existingTarget.members.some((existingMember) => existingMember.edgeId === member.edgeId)) {
            existingTarget.members.push(member);
          }

          const mergedInstructions = [...(existingTarget.widthInstructions || []), ...(member.widthInstructions || [])];
          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
          mergedInstructions.forEach((instruction) => {
            uniqueInstructions.set(buildWidthInstructionKey(instruction, member.node), instruction);
          });
          existingTarget.widthInstructions = Array.from(uniqueInstructions.values());
          return;
        }

        handleMap.set(member.handleId, {
          handleId: member.handleId,
          node,
          shell: context.shell,
          orientation: edge.orientation,
          boundaryIndex: member.boundaryIndex,
          hasOppositePeer: false,
          widthInstructions: member.widthInstructions ? member.widthInstructions.slice() : undefined,
          members: [member],
          physicalPeerMembers: [],
        });
      });

      const groupedTargets = Array.from(handleMap.values());

      return groupedTargets.map((target, targetIndex) => ({
        ...target,
        physicalPeerMembers: groupedTargets
          .flatMap((candidateTarget, candidateIndex) => {
            if (candidateIndex === targetIndex) {
              return [];
            }

            if (
              !target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
            ) {
              return [];
            }

            return candidateTarget.members;
          })
          .filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          ),
        hasOppositePeer:
          target.hasOppositePeer ||
          target.members.some((member, memberIndex) =>
            target.members.some(
              (candidateMember, candidateIndex) =>
                candidateIndex !== memberIndex && targetsSharePhysicalBoundary(member, candidateMember)
            )
          ) ||
          groupedTargets.some(
            (candidateTarget, candidateIndex) =>
              candidateIndex !== targetIndex &&
              target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
          ),
      }));
    },
    [buildEdgeResizeHandleId, buildWidthInstructionKey, getFrameNodes]
  );

  const collectEdgeResizeTargets = React.useCallback(
    (root: HTMLElement, snapshot: TemplateEdgeTopologySnapshotDto, mutationEdgeIds: string[]) => {
      const handleMap = new Map<string, EdgeResizeTarget>();
      const seedEdgeIds = Array.from(
        new Set(
          mutationEdgeIds.flatMap((edgeId) => [edgeId, ...TemplateEdgeTopologyService.getPhysicalPeerEdgeIds(snapshot, edgeId)])
        )
      );
      const closureEdgeIds = Array.from(
        new Set([
          ...seedEdgeIds,
          ...seedEdgeIds.flatMap((edgeId) => {
            const sourceEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

            if (!sourceEdge) {
              return [];
            }

            return snapshot.edges
              .filter((candidate) => edgesSharePhysicalBoundary(sourceEdge, candidate))
              .map((candidate) => candidate.edgeId);
          }),
        ])
      );

      const buildTargetFromEdgeId = (edgeId: string): EdgeResizeTargetMember | null => {
        const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

        if (!edge) {
          return null;
        }

        const node =
          getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === edge.frameGroupId) || null;

        if (!node) {
          return;
        }

        const context = buildFrameResizeContext(node);
        const boundaryIndex =
          edge.side === 'left'
            ? context.startColIndex
            : edge.side === 'right'
              ? context.endColIndex
              : edge.side === 'top'
                ? context.startRowIndex
                : context.endRowIndex;
        const widthInstruction =
          edge.side === 'left' || edge.side === 'right'
            ? buildSelfWidthResizeInstruction(context, edge.side)
            : null;
        return {
          handleId: buildEdgeResizeHandleId(
            node,
            context.shell,
            edge.orientation,
            edge.side,
            context.singleCellBand ? null : boundaryIndex
          ),
          edgeId: edge.edgeId,
          node,
          shell: context.shell,
          orientation: edge.orientation,
          side: edge.side,
          lineCoordinate: edge.lineCoordinate,
          spanStart: edge.spanStart,
          spanEnd: edge.spanEnd,
          boundaryIndex: context.singleCellBand ? null : boundaryIndex,
          widthInstructions: widthInstruction ? [widthInstruction] : undefined,
        };
      };

      const addTargetMember = (member: EdgeResizeTargetMember | null) => {
        if (!member) {
          return;
        }

        const existingHandle = handleMap.get(member.handleId);

        if (existingHandle) {
          if (!existingHandle.members.some((existingMember) => existingMember.edgeId === member.edgeId)) {
            existingHandle.members.push(member);
          }

          const mergedInstructions = [...(existingHandle.widthInstructions || []), ...(member.widthInstructions || [])];
          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();

          mergedInstructions.forEach((instruction) => {
            uniqueInstructions.set(buildWidthInstructionKey(instruction, member.node), instruction);
          });

          existingHandle.widthInstructions = Array.from(uniqueInstructions.values());
          existingHandle.hasOppositePeer =
            existingHandle.hasOppositePeer ||
            existingHandle.members.some(
              (existingMember) =>
                existingMember.edgeId !== member.edgeId && targetsSharePhysicalBoundary(existingMember, member)
            );
          return;
        }

        handleMap.set(member.handleId, {
          handleId: member.handleId,
          node: member.node,
          shell: member.shell,
          orientation: member.orientation,
          boundaryIndex: member.boundaryIndex,
          hasOppositePeer: false,
          widthInstructions: member.widthInstructions ? member.widthInstructions.slice() : undefined,
          members: [member],
          physicalPeerMembers: [],
        });
      };

      closureEdgeIds.forEach((edgeId) => {
        addTargetMember(buildTargetFromEdgeId(edgeId));
      });

      Array.from(handleMap.values())
        .flatMap((target) => target.members)
        .forEach((target) => {
          const oppositeSide =
          target.side === 'left'
            ? 'right'
            : target.side === 'right'
              ? 'left'
              : target.side === 'top'
                ? 'bottom'
                : 'top';

        getFrameNodes(root).forEach((node) => {
          const frameGroupId = getFrameGroupId(node);

          if (!frameGroupId) {
            return;
          }

          const candidateTarget = buildTargetFromEdgeId(`${frameGroupId}:${oppositeSide}`);

          if (!candidateTarget || !targetsSharePhysicalBoundary(target, candidateTarget)) {
            return;
          }

          addTargetMember(candidateTarget);
        });
      });

      const groupedTargets = Array.from(handleMap.values());

      return groupedTargets.map((target, targetIndex) => ({
        ...target,
        physicalPeerMembers: groupedTargets
          .flatMap((candidateTarget, candidateIndex) => {
            if (candidateIndex === targetIndex) {
              return [];
            }

            if (
              !target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
            ) {
              return [];
            }

            return candidateTarget.members;
          })
          .filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          ),
        hasOppositePeer:
          target.hasOppositePeer ||
          target.members.some((member, memberIndex) =>
            target.members.some(
              (candidateMember, candidateIndex) =>
                candidateIndex !== memberIndex && targetsSharePhysicalBoundary(member, candidateMember)
            )
          ) ||
          groupedTargets.some(
            (candidateTarget, candidateIndex) =>
              candidateIndex !== targetIndex &&
              target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
          ),
      }));
    },
    [buildEdgeResizeHandleId, buildWidthInstructionKey, getFrameNodes]
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
      const currentResizeState = resizeStateRef.current;
      const owner = activePointerOwnerRef.current;

      if (owner && typeof pointerId === 'number' && owner.hasPointerCapture(pointerId)) {
        owner.releasePointerCapture(pointerId);
      }

      activePointerOwnerRef.current = null;
      dragStateRef.current = null;
      resizeStateRef.current = null;
      edgePressStateRef.current = null;
      syncDraftPreviewHtmlRef();
      if (!frameSelectionIdsEqual(selectedFrameGroupIds, selectedFrameGroupIdsRef.current)) {
        setSelectedFrameGroupIds(selectedFrameGroupIdsRef.current);
      }
      const nextEdgeSelectionBase = currentResizeState?.edgeSelectionAfterResize || edgeSelectionStateRef.current;
      const nextEdgeSelection = reconcileLiveEdgeSelection(previewRef.current, nextEdgeSelectionBase);
      const nextEdgeMovementMismatchIds = currentResizeState
        ? detectEdgeRoleMovementMismatches(previewRef.current, currentResizeState)
        : edgeRoleDiagnostics.mismatchEdgeIds;
      const liveSnapshot = previewRef.current ? buildLiveEdgeTopologySnapshot(previewRef.current) : null;
      edgeSelectionStateRef.current = nextEdgeSelection;
      if (!edgeSelectionStatesEqual(nextEdgeSelection, edgeSelectionState)) {
        setEdgeSelectionState(nextEdgeSelection);
      }
      const nextEdgeRolePresentation = liveSnapshot
        ? resolveEdgeRolePresentation(liveSnapshot, nextEdgeSelection, nextEdgeMovementMismatchIds)
        : {
            edgeRoleById: {},
            diagnosticsState: emptyEdgeRoleDiagnosticsState,
          };
      if (previewRef.current && liveSnapshot) {
        applyFrameSelectionUi(
          previewRef.current,
          selectedFrameGroupIdsRef.current,
          nextEdgeSelection,
          liveSnapshot,
          nextEdgeRolePresentation.edgeRoleById,
          nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds
        );
      }
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );
      syncSelectionStyleDraft();
      requestPreviewTextFit();
    },
    [
      buildLiveEdgeTopologySnapshot,
      detectEdgeRoleMovementMismatches,
      edgeRoleDiagnostics.mismatchEdgeIds,
      edgeSelectionState,
      reconcileLiveEdgeSelection,
      resolveEdgeRolePresentation,
      requestPreviewTextFit,
      selectedFrameGroupIds,
      syncDraftPreviewHtmlRef,
      syncSelectionStyleDraft,
    ]
  );

  const clearFrameSelection = React.useCallback(() => {
    stopPointerInteraction();
    setSelectedFrameGroupIds([]);
    setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
    setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
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
      const frameNode = resolveFrameSelectionAnchor(target.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR));

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
        const clickedEdgeId = edgeButton?.getAttribute('data-edge-id') || `${frameGroupId}:${explicitEdgeSide}`;
        const resizeIntent = TemplateEdgeResizeIntentService.resolveResizeIntent({
          snapshot,
          currentSelection,
          clickedEdgeId,
          withShift: Boolean(event.shiftKey),
        });
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
          clickedEdgeId,
          snapshot,
          clickSelection: resizeIntent.clickSelectionState,
          dragSelection: resizeIntent.dragSelectionState,
          mutationEdgeIds: resizeIntent.mutationEdgeIds,
          edgeRoleById: resizeIntent.edgeRoleById,
          withShift: Boolean(event.shiftKey),
        };
        return;
      }

      const nextSelection = getNextFrameSelection(selectedFrameGroupIds, frameGroupId, Boolean(event.shiftKey));

      if (event.shiftKey) {
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
        setSelectedFrameGroupIds(nextSelection);
        return;
      }

      if (!pageInner) {
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
        setSelectedFrameGroupIds([frameGroupId]);
        return;
      }

      const stableSelection = selectedFrameGroupIds.includes(frameGroupId) ? selectedFrameGroupIds : [frameGroupId];
      setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
      setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
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
    [buildLiveEdgeTopologySnapshot, getFrameNodes, previewZoom, selectedFrameGroupIds]
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

      const directRoleResizeTargets = collectDirectRoleResizeTargets(
        previewRef.current || event.currentTarget,
        edgePressState.snapshot,
        edgePressState.mutationEdgeIds
      );
      const resizeTargets =
        directRoleResizeTargets.length > 0
          ? directRoleResizeTargets
          : collectEdgeResizeTargets(
              previewRef.current || event.currentTarget,
              edgePressState.snapshot,
              edgePressState.mutationEdgeIds
            );

      applyRuntimeSelectionUi([], edgePressState.dragSelection);
      edgeSelectionStateRef.current = edgePressState.dragSelection;
      // During edge drag we keep the runtime selection UI on the live DOM only.
      // Committing React state here re-renders stale previewHtml and reverts the
      // in-progress shell geometry before pointerup can persist it.
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
        edgeSelectionAfterResize: edgePressState.dragSelection,
        edgeRoleById: edgePressState.edgeRoleById,
        mutationEdgeIds: edgePressState.mutationEdgeIds,
        edgeDragSnapshot: edgePressState.snapshot,
        edgeLineCoordinateBaseline: Object.fromEntries(
          edgePressState.snapshot.edges.map((edge) => [
            edge.edgeId,
            edge.lineCoordinate,
          ])
        ),
        appliedEdgeDeltaX: 0,
        appliedEdgeDeltaY: 0,
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

      if (resizeState.edgeResizeTargets && resizeState.edgeResizeTargets.length > 0) {
        const boundedEdgeRect = clampFrameNodeRect(nextRect, pageBounds);
        const totalRequestedDeltaX = resizeState.direction.includes('w')
          ? boundedEdgeRect.left - resizeState.rect.left
          : resizeState.direction.includes('e')
            ? boundedEdgeRect.width - resizeState.rect.width
            : 0;
        const totalRequestedDeltaY = resizeState.direction.includes('n')
          ? boundedEdgeRect.top - resizeState.rect.top
          : resizeState.direction.includes('s')
            ? boundedEdgeRect.height - resizeState.rect.height
            : 0;
        const nextDeltaX = totalRequestedDeltaX - (resizeState.appliedEdgeDeltaX || 0);
        const nextDeltaY = totalRequestedDeltaY - (resizeState.appliedEdgeDeltaY || 0);
        const widthResizeTargets = resizeState.edgeResizeTargets.filter(
          (edgeTarget) => edgeTarget.orientation === 'vertical' && (edgeTarget.widthInstructions?.length || 0) > 0
        );
        const heightResizeTargets = resizeState.edgeResizeTargets
          .map((edgeTarget) => ({
            edgeTarget,
            member: pickHeightResizeTargetMember(edgeTarget, resizeState.direction),
          }))
          .filter(
            (
              value
            ): value is {
              edgeTarget: EdgeResizeTarget;
              member: EdgeResizeTargetMember;
            } => Boolean(value.member)
          );
        const resolveWidthDragDelta = (requestedDelta: number) =>
          resolveSharedEdgeResizeDelta(
            requestedDelta,
            widthResizeTargets
              .map((edgeTarget) =>
                resolveWidthInstructionDelta(
                  [
                    ...(edgeTarget.widthInstructions || []),
                    ...edgeTarget.physicalPeerMembers.flatMap((member) => member.widthInstructions || []),
                  ],
                  requestedDelta
                )
              )
              .filter((candidateDelta) => Number.isFinite(candidateDelta))
          );
        const resolveHeightDragDelta = (requestedDelta: number) =>
          resolveSharedEdgeResizeDelta(
            requestedDelta,
            heightResizeTargets
              .map(({ edgeTarget, member }) => {
                const constraintMembers = [member, ...edgeTarget.members, ...edgeTarget.physicalPeerMembers].filter(
                  (constraintMember, constraintIndex, members) =>
                    members.findIndex((candidateMember) => candidateMember.edgeId === constraintMember.edgeId) ===
                    constraintIndex
                );
                const candidateDeltas = constraintMembers
                  .map((constraintMember) => {
                    if (constraintMember.side === 'top') {
                      return resolveFrameResizeTopDelta(constraintMember.node, requestedDelta);
                    }

                    if (constraintMember.side === 'bottom') {
                      return resolveFrameResizeBottomDelta(constraintMember.node, requestedDelta);
                    }

                    return 0;
                  })
                  .filter((candidateDelta) => Number.isFinite(candidateDelta));

                if (candidateDeltas.length === 0) {
                  return 0;
                }

                return resolveSharedEdgeResizeDelta(requestedDelta, candidateDeltas);
              })
              .filter((candidateDelta) => Number.isFinite(candidateDelta))
          );
        const constrainedDeltaX = resolveWidthDragDelta(nextDeltaX);
        const constrainedDeltaY = resolveHeightDragDelta(nextDeltaY);
        const movingWidthMembers = widthResizeTargets
          .flatMap((edgeTarget) => [...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          );
        const movingHeightMembers = heightResizeTargets
          .flatMap(({ edgeTarget, member }) => [member, ...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .filter(
            (constraintMember, constraintIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === constraintMember.edgeId) ===
              constraintIndex
          );
        const snappedDeltaX = resolveEdgeDragAutosnapDelta({
          requestedDelta: constrainedDeltaX,
          orientation: 'vertical',
          movingMembers: movingWidthMembers,
          snapshot: resizeState.edgeDragSnapshot,
        });
        const snappedDeltaY = resolveEdgeDragAutosnapDelta({
          requestedDelta: constrainedDeltaY,
          orientation: 'horizontal',
          movingMembers: movingHeightMembers,
          snapshot: resizeState.edgeDragSnapshot,
        });
        const finalDeltaX =
          Math.abs(snappedDeltaX - constrainedDeltaX) >= 0.5 ? resolveWidthDragDelta(snappedDeltaX) : constrainedDeltaX;
        const finalDeltaY =
          Math.abs(snappedDeltaY - constrainedDeltaY) >= 0.5 ? resolveHeightDragDelta(snappedDeltaY) : constrainedDeltaY;

        widthResizeTargets.forEach((edgeTarget) => {
          if (Math.abs(finalDeltaX) >= 0.5) {
            applyFrameResizeWidthDelta(edgeTarget.node, finalDeltaX, edgeTarget.widthInstructions);
          }
        });

        heightResizeTargets.forEach(({ edgeTarget, member }) => {
          if (Math.abs(finalDeltaY) < 0.5) {
            return;
          }

          if (member.side === 'top') {
            applyFrameResizeTopDelta(member.node, finalDeltaY);
            return;
          }

          if (member.side === 'bottom') {
            if (edgeTarget.hasOppositePeer) {
              applyFrameResizeHeightDeltaLocal(member.node, finalDeltaY);
              return;
            }

            applyFrameResizeHeightDelta(member.node, finalDeltaY);
          }
        });

        resizeState.appliedEdgeDeltaX = (resizeState.appliedEdgeDeltaX || 0) + finalDeltaX;
        resizeState.appliedEdgeDeltaY = (resizeState.appliedEdgeDeltaY || 0) + finalDeltaY;
      } else {
        const siblingRects = filterResizeSnapRects(
          getFrameNodes(resizeState.pageInner)
            .filter((node) => node !== resizeState.node)
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
        applyFrameResizeWithDirection(
          resizeState.node,
          resolvedRect,
          resizeState.direction,
          resizeState.widthInstructions
        );
      }
    }
  }, [applyRuntimeSelectionUi, collectDirectRoleResizeTargets, collectEdgeResizeTargets, getFrameNodes]);

  const handlePreviewPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const edgePressState = edgePressStateRef.current;

      if (edgePressState?.pointerId === event.pointerId) {
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        if (owner?.hasPointerCapture(event.pointerId)) {
          owner.releasePointerCapture(event.pointerId);
        }

        activePointerOwnerRef.current = null;
        edgePressStateRef.current = null;
        selectedFrameGroupIdsRef.current = [];
        edgeSelectionStateRef.current = edgePressState.clickSelection;
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(edgePressState.clickSelection);
        setEdgeRoleDiagnostics(
          resolveEdgeRolePresentation(edgePressState.snapshot, edgePressState.clickSelection).diagnosticsState
        );
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [resolveEdgeRolePresentation, stopPointerInteraction]
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
        .template-edit-preview [data-template-edge-host="true"] {
          position: relative;
          z-index: 21 !important;
        }
        .template-edit-preview [data-template-edge-host="true"] [data-template-frame-input="true"] {
          position: relative;
          z-index: 22;
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
          background: rgba(148, 163, 184, .16);
          padding: 0;
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px rgba(148, 163, 184, .28);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-mode="connected"] {
          background: rgba(13, 148, 136, .72);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, .92);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-mode="isolated"] {
          background: rgba(234, 88, 12, .88);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, .94);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-role="selected_edge_clicked"] {
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, .94),
            0 0 0 4px rgba(15, 118, 110, .36);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-role="selected_edge_auto_multi"] {
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, .88),
            0 0 0 4px rgba(8, 145, 178, .26);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-role="peer_edge"] {
          background: rgba(59, 130, 246, .42);
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, .72);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-movement-mismatch="true"] {
          background: rgba(220, 38, 38, .92) !important;
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, .94),
            0 0 0 4px rgba(220, 38, 38, .34) !important;
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
                엣지를 1회 클릭하면 직접 연결된 엣지 cohort 가 선택되고, 같은 엣지를 다시 클릭하면 해당 엣지만 단독 선택됩니다.
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
                    ref={setPreviewNode}
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
              <CardDescription>엣지는 `selected_edge_clicked`, `selected_edge_auto_multi`, `peer_edge` 역할로 나뉘며 이동 mismatch 를 함께 기록합니다.</CardDescription>
            </CardHeader>
            <CardContent ref={stylePanelRef} className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div>선택 박스 수: {selectedFrameGroupIds.length}</div>
                <div className="mt-1 break-all">선택 ID: {selectedFrameGroupIds.join(', ') || '-'}</div>
                <div className="mt-1">선택 엣지 토큰 수: {edgeSelectionState.tokens.length}</div>
                <div className="mt-1">선택 엣지 수: {selectedEdgeMemberCount}</div>
                <div className="mt-1">선택 엣지 모드: {selectedEdgeMode || '-'}</div>
                <div className="mt-1 break-all">선택 엣지 앵커: {selectedEdgeAnchorIds.join(', ') || '-'}</div>
                <div className="mt-1">selected_edge_clicked 수: {selectedEdgeClickedCount}</div>
                <div className="mt-1 break-all">
                  selected_edge_clicked: {edgeRoleDiagnostics.selectedEdgeClickedIds.join(', ') || '-'}
                </div>
                <div className="mt-1">selected_edge_auto_multi 수: {selectedEdgeAutoMultiCount}</div>
                <div className="mt-1 break-all">
                  selected_edge_auto_multi: {edgeRoleDiagnostics.selectedEdgeAutoMultiIds.join(', ') || '-'}
                </div>
                <div className="mt-1">peer_edge 수: {peerEdgeCount}</div>
                <div className="mt-1 break-all">peer_edge: {edgeRoleDiagnostics.peerEdgeIds.join(', ') || '-'}</div>
                <div className="mt-1 break-all">
                  movement mismatch edge: {edgeRoleDiagnostics.mismatchEdgeIds.join(', ') || '-'}
                </div>
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
              <p>엣지를 한 번 클릭하면 동일 수직/수평선상에서 시작과 끝이 직접 연결된 엣지가 함께 선택되고, 같은 엣지를 다시 클릭하면 해당 엣지만 단독 선택됩니다.</p>
              <p>`selected_edge_clicked` 는 직접 클릭한 엣지, `selected_edge_auto_multi` 는 connected 자동 선택 엣지, `peer_edge` 는 같은 물리 경계에 있는 반대편 엣지입니다.</p>
              <p>Shift+클릭은 여러 `selected_edge_clicked` 를 누적 선택하며, 드래그는 현재 역할 정의에 따라 함께 움직여야 할 `peer_edge` 까지 이동시키고 mismatch 를 감지합니다.</p>
              <p>오른쪽 패널에서는 여러 박스에 동일한 폰트 크기, 패딩, 정렬, 색상, 크기를 일괄 적용할 수 있습니다.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
