import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfTopologyCellCandidate,
  TemplateExtractPdfTopologyModel,
  TemplateExtractPdfTopologyPage,
} from '../lib/templateExtractDtos';
import { TemplateExtractValueBindingService } from './templateExtractValueBindingService';

const MIN_PAGE_WIDTH = 1;
const MIN_COLUMN_WIDTH_PX = 14;
const MIN_EMPTY_ROW_HEIGHT_PX = 34;
const MIN_ROW_HEIGHT_PX = 18;
const MAX_TITLE_LENGTH = 48;

type KnownLabel = {
  canonicalLabel: string;
  fieldType: string;
};

type PendingField = {
  label: string;
  multiline: boolean;
};

type NormalizedRowBand = {
  rowIndex: number;
  top: number;
  bottom: number;
  height: number;
  sourceRows: number[];
};

type NormalizedCell = {
  rowIndex: number;
  startColumn: number;
  endColumn: number;
  text: string;
  x: number;
  right: number;
  width: number;
  height: number;
  knownLabel: KnownLabel | null;
};

type NormalizedPage = {
  pageNumber: number;
  width: number;
  height: number;
  columnEdges: number[];
  rowBands: NormalizedRowBand[];
  cellsByRow: Map<number, NormalizedCell[]>;
};

type CellDescriptor = {
  cell: NormalizedCell;
  text: string;
  knownLabel: KnownLabel | null;
  role: 'plain' | 'label' | 'value' | 'title' | 'section' | 'note';
  valueLabel: string | null;
  html: string | null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttribute = (value: string) => escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const round = (value: number) => Number(value.toFixed(2));

const stripNumberPrefix = (value: string) => normalizeWhitespace(value.replace(/^\d+(?:-\d+)?\.\s*/, '').replace(/\*+$/g, ''));

const fillGapCells = (fromColumn: number, toColumn: number) => {
  const gap = toColumn - fromColumn;

  if (gap <= 0) {
    return '';
  }

  return `<td class="template-clone__work-order-empty" colspan="${gap}"></td>`;
};

const buildValueMarker = (label: string, value: string, kind: 'inline' | 'block' = 'inline') => {
  const className = kind === 'block' ? 'template-clone__work-order-block-value' : 'template-clone__work-order-inline-value';
  const safeValue = value.trim() ? value : ' ';
  return `<span class="${className}" data-template-value="${escapeAttribute(label)}">${escapeHtml(safeValue)}</span>`;
};

const renderPlainCell = (text: string) => `<div class="template-clone__work-order-text">${escapeHtml(text)}</div>`;

const renderRichCell = (html: string) => `<div class="template-clone__work-order-text">${html}</div>`;

const renderValueCell = (label: string, text: string, block = false) =>
  block
    ? `<div class="template-clone__work-order-value template-clone__work-order-value--block">${buildValueMarker(
        label,
        text,
        'block'
      )}</div>`
    : `<div class="template-clone__work-order-value">${buildValueMarker(label, text, 'inline')}</div>`;

const resolveKnownLabel = (text: string): KnownLabel | null => {
  const cleaned = stripNumberPrefix(text);
  const known = TemplateExtractValueBindingService.inferKnownFieldForLabel(cleaned, 0);

  if (!known) {
    return null;
  }

  return {
    canonicalLabel: known.fieldLabel || cleaned,
    fieldType: known.fieldType,
  };
};

const buildInlineCompositeHtml = (text: string) => {
  const normalized = normalizeWhitespace(text);
  const inlineMatch = normalized.match(/^([^:：]{1,80})\s*[:：]\s*(.+)$/);

  if (!inlineMatch) {
    return null;
  }

  const known = resolveKnownLabel(inlineMatch[1]);

  if (!known) {
    return null;
  }

  return `${escapeHtml(inlineMatch[1])} : ${buildValueMarker(known.canonicalLabel, inlineMatch[2])}`;
};

const dedupeEdges = (edges: number[], pageWidth: number) => {
  const sorted = [...edges, 0, pageWidth]
    .map((value) => round(Math.max(0, Math.min(value, pageWidth))))
    .sort((left, right) => left - right);
  const deduped: number[] = [];

  for (const edge of sorted) {
    const previous = deduped[deduped.length - 1];

    if (typeof previous === 'number' && Math.abs(previous - edge) < 1) {
      continue;
    }

    deduped.push(edge);
  }

  if (deduped.length < 2) {
    return [0, round(pageWidth)];
  }

  return deduped;
};

const collectColumnUsage = (cells: TemplateExtractPdfTopologyCellCandidate[]) => {
  const usage = new Set<number>();

  for (const cell of cells) {
    const start = Math.max(cell.startColumn, 0);
    const end = Math.max(cell.endColumn, start + 1);

    for (let column = start; column < end; column += 1) {
      usage.add(column);
    }
  }

  return usage;
};

const normalizeColumnEdges = (page: TemplateExtractPdfTopologyPage) => {
  const columnEdges = dedupeEdges(page.columnEdges, Math.max(page.width, MIN_PAGE_WIDTH));
  const usage = collectColumnUsage(page.cellCandidates);
  const remap = new Map<number, number>();
  const normalizedEdges = [columnEdges[0]];
  let nextColumnIndex = 0;

  for (let index = 0; index < columnEdges.length - 1; index += 1) {
    const width = columnEdges[index + 1] - columnEdges[index];
    const unused = !usage.has(index);
    const shouldCollapse =
      index > 0 && index < columnEdges.length - 2 && unused && width < MIN_COLUMN_WIDTH_PX;

    if (!shouldCollapse) {
      normalizedEdges.push(columnEdges[index + 1]);
      remap.set(index, nextColumnIndex);
      nextColumnIndex += 1;
      continue;
    }

    remap.set(index, Math.max(nextColumnIndex - 1, 0));
  }

  return {
    columnEdges: normalizedEdges.length >= 2 ? normalizedEdges : [0, round(Math.max(page.width, MIN_PAGE_WIDTH))],
    remap,
  };
};

const buildCellsByLegacyRow = (page: TemplateExtractPdfTopologyPage) => {
  const map = new Map<number, TemplateExtractPdfTopologyCellCandidate[]>();

  for (const cell of page.cellCandidates) {
    const current = map.get(cell.rowIndex);

    if (current) {
      current.push(cell);
      continue;
    }

    map.set(cell.rowIndex, [cell]);
  }

  return map;
};

const normalizeRowBands = (page: TemplateExtractPdfTopologyPage) => {
  const legacyCellsByRow = buildCellsByLegacyRow(page);
  const sortedRowBands = [...page.rowBands].sort((left, right) => left.top - right.top);
  const normalizedRowBands: NormalizedRowBand[] = [];
  const rowIndexMap = new Map<number, number>();

  for (const rowBand of sortedRowBands) {
    const hasText = (legacyCellsByRow.get(rowBand.rowIndex) || []).some((cell) => normalizeWhitespace(cell.text));
    const previous = normalizedRowBands[normalizedRowBands.length - 1];
    const shouldMerge =
      previous &&
      ((!hasText && rowBand.height <= MIN_EMPTY_ROW_HEIGHT_PX) ||
        (previous.height < MIN_ROW_HEIGHT_PX && rowBand.height < MIN_ROW_HEIGHT_PX));

    if (shouldMerge) {
      previous.bottom = round(Math.max(previous.bottom, rowBand.bottom));
      previous.height = round(previous.bottom - previous.top);
      previous.sourceRows.push(rowBand.rowIndex);
      rowIndexMap.set(rowBand.rowIndex, previous.rowIndex);
      continue;
    }

    const nextRow: NormalizedRowBand = {
      rowIndex: normalizedRowBands.length,
      top: round(rowBand.top),
      bottom: round(rowBand.bottom),
      height: round(Math.max(rowBand.height, MIN_ROW_HEIGHT_PX)),
      sourceRows: [rowBand.rowIndex],
    };

    normalizedRowBands.push(nextRow);
    rowIndexMap.set(rowBand.rowIndex, nextRow.rowIndex);
  }

  return {
    rowBands: normalizedRowBands,
    rowIndexMap,
  };
};

const remapColumnRange = (startColumn: number, endColumn: number, remap: Map<number, number>, totalColumns: number) => {
  const mappedColumns: number[] = [];
  const boundedStart = Math.max(startColumn, 0);
  const boundedEnd = Math.max(endColumn, boundedStart + 1);

  for (let column = boundedStart; column < boundedEnd; column += 1) {
    mappedColumns.push(remap.get(column) ?? Math.min(column, totalColumns - 1));
  }

  const safeColumns = mappedColumns.length > 0 ? mappedColumns : [0];
  const normalizedStart = Math.min(...safeColumns);
  const normalizedEnd = Math.max(...safeColumns) + 1;

  return {
    startColumn: normalizedStart,
    endColumn: Math.max(normalizedEnd, normalizedStart + 1),
  };
};

const buildNormalizedCells = (
  page: TemplateExtractPdfTopologyPage,
  rowIndexMap: Map<number, number>,
  columnRemap: Map<number, number>,
  totalColumns: number
) => {
  const grouped = new Map<string, NormalizedCell>();

  for (const candidate of page.cellCandidates) {
    const text = normalizeWhitespace(candidate.text);

    if (!text) {
      continue;
    }

    const rowIndex = rowIndexMap.get(candidate.rowIndex) ?? 0;
    const normalizedRange = remapColumnRange(candidate.startColumn, candidate.endColumn, columnRemap, totalColumns);
    const key = `${rowIndex}:${normalizedRange.startColumn}:${normalizedRange.endColumn}`;
    const current = grouped.get(key);

    if (current) {
      const mergedText = [current.text, text].filter(Boolean);
      const uniqueText = [...new Set(mergedText)];
      current.text = uniqueText.join('\n');
      current.x = Math.min(current.x, candidate.x);
      current.right = Math.max(current.right, candidate.right);
      current.width = round(current.right - current.x);
      current.height = round(Math.max(current.height, candidate.height));
      current.knownLabel = current.knownLabel || resolveKnownLabel(uniqueText.join(' '));
      continue;
    }

    grouped.set(key, {
      rowIndex,
      startColumn: normalizedRange.startColumn,
      endColumn: normalizedRange.endColumn,
      text,
      x: round(candidate.x),
      right: round(candidate.right),
      width: round(candidate.width),
      height: round(candidate.height),
      knownLabel: resolveKnownLabel(text),
    });
  }

  const cellsByRow = new Map<number, NormalizedCell[]>();

  for (const cell of grouped.values()) {
    const current = cellsByRow.get(cell.rowIndex);

    if (current) {
      current.push(cell);
      continue;
    }

    cellsByRow.set(cell.rowIndex, [cell]);
  }

  for (const rowCells of cellsByRow.values()) {
    rowCells.sort((left, right) => {
      if (left.startColumn === right.startColumn) {
        return left.x - right.x;
      }

      return left.startColumn - right.startColumn;
    });
  }

  return cellsByRow;
};

const normalizePage = (page: TemplateExtractPdfTopologyPage): NormalizedPage => {
  const { columnEdges, remap } = normalizeColumnEdges(page);
  const { rowBands, rowIndexMap } = normalizeRowBands(page);
  const totalColumns = Math.max(columnEdges.length - 1, 1);

  return {
    pageNumber: page.pageNumber,
    width: Math.max(page.width, MIN_PAGE_WIDTH),
    height: page.height,
    columnEdges,
    rowBands,
    cellsByRow: buildNormalizedCells(page, rowIndexMap, remap, totalColumns),
  };
};

const isSectionText = (text: string) =>
  /^\d+(?:-\d+)?\.\s*/.test(text) || /^(첨부파일|특기사항|기타|주의사항?|하도급 대금 연동에 관한 사항)/.test(text);

const isNoteText = (text: string) => /^(※|주\s*의|비고|첨부)/.test(text);

const isTitleCell = (descriptor: CellDescriptor, rowIndex: number, totalColumns: number) => {
  const span = descriptor.cell.endColumn - descriptor.cell.startColumn;
  const normalized = stripNumberPrefix(descriptor.text);

  if (!normalized || normalized.length > MAX_TITLE_LENGTH || descriptor.knownLabel) {
    return false;
  }

  if (rowIndex > 2) {
    return false;
  }

  if (span < Math.max(Math.floor(totalColumns * 0.45), 2)) {
    return false;
  }

  return /작업지시서|공사|하도급|도급|지시서/.test(normalized) || normalized.length >= 6;
};

const describeRow = (cells: NormalizedCell[]) =>
  cells.map((cell) => ({
    cell,
    text: normalizeWhitespace(cell.text),
    knownLabel: cell.knownLabel,
    role: 'plain' as const,
    valueLabel: null,
    html: null,
  }));

const renderDescriptorHtml = (descriptor: CellDescriptor, totalColumns: number) => {
  if (descriptor.html) {
    return descriptor.html;
  }

  const inlineCompositeHtml = buildInlineCompositeHtml(descriptor.text);

  if (inlineCompositeHtml) {
    return renderRichCell(inlineCompositeHtml);
  }

  if (descriptor.role === 'value' && descriptor.valueLabel) {
    const span = descriptor.cell.endColumn - descriptor.cell.startColumn;
    const multiline =
      descriptor.text.length > 32 || span >= Math.max(Math.floor(totalColumns * 0.35), 2) || descriptor.text.includes('\n');
    return renderValueCell(descriptor.valueLabel, descriptor.text, multiline);
  }

  return renderPlainCell(descriptor.text);
};

const renderRow = (
  rowBand: NormalizedRowBand,
  descriptors: CellDescriptor[],
  totalColumns: number,
  carryOver: PendingField | null
) => {
  let nextCarry = carryOver;
  const rowDescriptors = [...descriptors];

  for (const descriptor of rowDescriptors) {
    if (descriptor.role !== 'plain') {
      continue;
    }

    if (isTitleCell(descriptor, rowBand.rowIndex, totalColumns)) {
      descriptor.role = 'title';
      nextCarry = null;
      continue;
    }

    if (isSectionText(descriptor.text)) {
      descriptor.role = 'section';
      nextCarry = null;
      continue;
    }

    if (isNoteText(descriptor.text)) {
      descriptor.role = 'note';
    }
  }

  const labelIndexes = rowDescriptors
    .map((descriptor, index) => ({ descriptor, index }))
    .filter(
      ({ descriptor }) =>
        descriptor.role === 'plain' &&
        descriptor.knownLabel &&
        !descriptor.html &&
        !buildInlineCompositeHtml(descriptor.text)
    )
    .map(({ index }) => index);

  if (labelIndexes.length > 0) {
    nextCarry = null;

    for (let index = 0; index < labelIndexes.length; index += 1) {
      const labelIndex = labelIndexes[index];
      const labelDescriptor = rowDescriptors[labelIndex];
      const label = labelDescriptor.knownLabel!;
      const nextLabelIndex = labelIndexes[index + 1] ?? rowDescriptors.length;
      let attachedValue = false;

      labelDescriptor.role = 'label';

      for (let cursor = labelIndex + 1; cursor < nextLabelIndex; cursor += 1) {
        const candidate = rowDescriptors[cursor];

        if (candidate.role !== 'plain' || candidate.knownLabel || !candidate.text) {
          continue;
        }

        candidate.role = 'value';
        candidate.valueLabel = label.canonicalLabel;
        attachedValue = true;
      }

      if (!attachedValue) {
        nextCarry = {
          label: label.canonicalLabel,
          multiline: label.fieldType === 'textarea' || labelDescriptor.cell.endColumn - labelDescriptor.cell.startColumn >= 2,
        };
      }
    }
  } else if (carryOver) {
    for (const descriptor of rowDescriptors) {
      if (descriptor.role !== 'plain' || !descriptor.text || descriptor.knownLabel) {
        continue;
      }

      descriptor.role = 'value';
      descriptor.valueLabel = carryOver.label;
    }
  }

  let currentColumn = 0;

  const cellsHtml = rowDescriptors
    .flatMap((descriptor) => {
      const fragments: string[] = [];
      const colspan = Math.max(descriptor.cell.endColumn - descriptor.cell.startColumn, 1);
      const classes = ['template-clone__work-order-cell'];

      fragments.push(fillGapCells(currentColumn, descriptor.cell.startColumn));

      if (descriptor.role === 'label') {
        classes.push('template-clone__work-order-cell--label');
      } else if (descriptor.role === 'value') {
        classes.push('template-clone__work-order-cell--value');
      } else if (descriptor.role === 'title') {
        classes.push('template-clone__work-order-cell--title');
      } else if (descriptor.role === 'section') {
        classes.push('template-clone__work-order-cell--section');
      } else if (descriptor.role === 'note') {
        classes.push('template-clone__work-order-cell--note');
      }

      fragments.push(
        `<td class="${classes.join(' ')}" colspan="${colspan}">${renderDescriptorHtml(descriptor, totalColumns)}</td>`
      );

      currentColumn = descriptor.cell.endColumn;
      return fragments;
    })
    .join('');

  const trailing = fillGapCells(currentColumn, totalColumns);

  return {
    html: `<tr style="height:${Math.max(rowBand.height, MIN_ROW_HEIGHT_PX).toFixed(2)}px;">${cellsHtml}${trailing}</tr>`,
    nextCarry,
  };
};

const buildPageHtml = (page: NormalizedPage) => {
  const totalColumns = Math.max(page.columnEdges.length - 1, 1);
  let carryOver: PendingField | null = null;

  const rowsHtml = page.rowBands
    .map((rowBand) => {
      const descriptors = describeRow(page.cellsByRow.get(rowBand.rowIndex) || []);
      const rendered = renderRow(rowBand, descriptors, totalColumns, carryOver);
      carryOver = rendered.nextCarry;
      return rendered.html;
    })
    .join('\n');

  return `    <div class="template-clone__work-order-page" data-page="${page.pageNumber}">
      <table class="template-clone__work-order-table">
        <colgroup>
${page.columnEdges
  .slice(0, -1)
  .map((edge, index) => {
    const next = page.columnEdges[index + 1];
    const widthPercent = (((next - edge) / Math.max(page.width, MIN_PAGE_WIDTH)) * 100).toFixed(4);
    return `          <col style="width:${widthPercent}%;">`;
  })
  .join('\n')}
        </colgroup>
        <tbody>
${rowsHtml}
        </tbody>
      </table>
    </div>`;
};

const buildStyleHtml = () => `    <style>
      .template-clone--pdf-work-order-topology-v20 {
        width: 100%;
        background:
          linear-gradient(180deg, rgba(226, 232, 240, 0.82) 0%, rgba(248, 250, 252, 0.92) 100%);
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        padding: 12px 0 28px;
      }

      .template-clone__work-order-page {
        margin: 0 auto 24px;
        max-width: 1080px;
        background: #ffffff;
        border: 1px solid #334155;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        padding: 12px;
      }

      .template-clone__work-order-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: #ffffff;
      }

      .template-clone__work-order-table td {
        border: 1px solid #0f172a;
        padding: 4px 6px;
        vertical-align: top;
        font-size: 12px;
        line-height: 1.28;
        word-break: break-word;
      }

      .template-clone__work-order-empty {
        background: #ffffff;
      }

      .template-clone__work-order-cell--label {
        font-weight: 700;
        background: #f8fafc;
      }

      .template-clone__work-order-cell--value {
        background: #ffffff;
      }

      .template-clone__work-order-cell--title {
        font-weight: 700;
        text-align: center;
        background: #e2e8f0;
        letter-spacing: 0.02em;
      }

      .template-clone__work-order-cell--section {
        font-weight: 700;
        background: #eef2ff;
      }

      .template-clone__work-order-cell--note {
        font-size: 11px;
        color: #334155;
        background: #f8fafc;
      }

      .template-clone__work-order-text {
        white-space: pre-wrap;
      }

      .template-clone__work-order-inline-value,
      .template-clone__work-order-block-value {
        display: inline-block;
        width: 100%;
        min-height: 14px;
      }

      .template-clone__work-order-value--block .template-clone__work-order-block-value {
        min-height: 32px;
      }
    </style>`;

export const TemplateExtractWorkOrderTopologyBuilderService = {
  buildCloneHtml(
    _sourceTitle: string,
    topology: TemplateExtractPdfTopologyModel,
    _version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ) {
    if (!topology.pages.length) {
      return null;
    }

    const normalizedPages = topology.pages.map(normalizePage);
    const pagesHtml = normalizedPages.map(buildPageHtml).join('\n');

    return `<section data-template-extract-draft="true" data-template-clone="pdf-work-order-topology-v20">
  <div class="template-clone template-clone--pdf-work-order-topology-v20">
${buildStyleHtml()}
${pagesHtml}
  </div>
</section>`;
  },
};
