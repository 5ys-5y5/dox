import type {
  TemplateExtractPdfGeometryCell,
  TemplateExtractPdfGeometryModel,
  TemplateExtractPdfGeometryRow,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfLine,
  TemplateExtractPdfPage,
  TemplateExtractPdfPageGeometry,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfGeometryService } from './templateExtractPdfGeometryService';
import { TemplateExtractValueBindingService } from './templateExtractValueBindingService';

type KnownLabel = {
  originalLabel: string;
  canonicalLabel: string;
  fieldType: string;
};

type PendingField = {
  label: string;
  multiline: boolean;
};

type CellDescriptor = {
  cell: TemplateExtractPdfGeometryCell;
  text: string;
  knownLabel: KnownLabel | null;
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

const stripNumberPrefix = (value: string) => normalizeWhitespace(value.replace(/^\d+(?:-\d+)?\.\s*/, '').replace(/\*+$/g, ''));

const looksLikeDateTime = (value: string) => /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(value);
const MULTI_FIELD_SEGMENT_REGEX = /([^:：]{1,48})\s*[:：]\s*(.*?)(?=(?:\s+[^:：]{1,48}\s*[:：]\s*)|$)/g;
const STATUS_ACTOR_LABEL_MAP: Record<string, string> = {
  CAE: 'CAE 담당자',
  CE: 'CE 담당자',
  CAM: 'CAM 담당자',
  PM: 'PM 담당자',
};
const STATUS_TIME_LABEL_MAP: Record<string, string> = {
  CAE: 'CAE 처리시각',
  CE: 'CE 처리시각',
  CAM: 'CAM 처리시각',
  PM: 'PM 처리시각',
};

const buildValueMarker = (label: string, value: string, kind: 'inline' | 'block' = 'inline') => {
  const className = kind === 'block' ? 'template-clone__pdf-block-value' : 'template-clone__pdf-inline-value';
  return `<span class="${className}" data-template-value="${escapeAttribute(label)}">${escapeHtml(value)}</span>`;
};

const resolveKnownLabel = (text: string): KnownLabel | null => {
  const cleaned = stripNumberPrefix(text);
  const known = TemplateExtractValueBindingService.inferKnownFieldForLabel(cleaned, 0);

  if (!known) {
    return null;
  }

  return {
    originalLabel: cleaned,
    canonicalLabel: known.fieldLabel || cleaned,
    fieldType: known.fieldType,
  };
};

const buildInlineCompositeHtml = (text: string) => {
  const normalized = normalizeWhitespace(text);

  const statusMatch = normalized.match(/^(CAE|CE|CAM|PM)\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/);

  if (statusMatch) {
    const actorLabel = STATUS_ACTOR_LABEL_MAP[statusMatch[1]] || `${statusMatch[1]} 담당자`;
    const timeLabel = STATUS_TIME_LABEL_MAP[statusMatch[1]] || `${statusMatch[1]} 처리시각`;
    return `${statusMatch[1]} ${buildValueMarker(actorLabel, statusMatch[2])} ${buildValueMarker(timeLabel, statusMatch[3])}`;
  }

  const signatureMatch = normalized.match(
    /^발급자 서명\s+(.+?)\s+(전자서명\s*(?:완료|대기|실패|미완료))(?:\s+접수자 서명\s*(.*))?$/
  );

  if (signatureMatch) {
    const receiverValue = normalizeWhitespace(signatureMatch[3] || '');
    return [
      '발급자 서명',
      buildValueMarker('발급자 서명자', signatureMatch[1]),
      buildValueMarker('전자서명 상태', signatureMatch[2]),
      `접수자 서명 ${buildValueMarker('접수자 서명', receiverValue || ' ')}`,
    ].join(' ');
  }

  const segments = Array.from(normalized.matchAll(MULTI_FIELD_SEGMENT_REGEX))
    .map((match) => ({
      labelText: normalizeWhitespace(match[1] || ''),
      valueText: normalizeWhitespace(match[2] || ''),
    }))
    .filter((segment) => segment.labelText && segment.valueText);

  if (segments.length > 1) {
    let knownSegmentCount = 0;
    const parts = segments.map((segment) => {
      const known = resolveKnownLabel(segment.labelText);

      if (!known) {
        return `${escapeHtml(segment.labelText)} : ${escapeHtml(segment.valueText)}`;
      }

      knownSegmentCount += 1;
      return `${escapeHtml(segment.labelText)} : ${buildValueMarker(known.canonicalLabel, segment.valueText)}`;
    });

    if (knownSegmentCount > 0) {
      return parts.join(' ');
    }
  }

  const inlineMatch = normalized.match(/^([^:：]{1,80})\s*[:：]\s*(.+)$/);

  if (inlineMatch) {
    const known = resolveKnownLabel(inlineMatch[1]);

    if (known) {
      return `${escapeHtml(inlineMatch[1])} : ${buildValueMarker(known.canonicalLabel, inlineMatch[2])}`;
    }
  }

  return null;
};

const toReplicaTop = (page: TemplateExtractPdfPage, line: TemplateExtractPdfLine) =>
  Math.max(0, Number((page.height - line.y - line.height).toFixed(2)));

const normalizeReplicaFontSize = (height: number) => Number(Math.max(9, Math.min(height * 0.92, 18)).toFixed(2));

const buildPositionedLineHtml = (page: TemplateExtractPdfPage, line: TemplateExtractPdfLine, lineIndex: number) => {
  const normalizedText = normalizeWhitespace(line.text);

  if (!normalizedText) {
    return '';
  }

  const inlineCompositeHtml = buildInlineCompositeHtml(normalizedText);
  const knownLabel = resolveKnownLabel(normalizedText);
  const width = Math.max(8, Number(line.width.toFixed(2)));
  const height = Math.max(12, Number(line.height.toFixed(2)));
  const top = toReplicaTop(page, line);
  const left = Math.max(0, Number(line.x.toFixed(2)));
  const fontSize = normalizeReplicaFontSize(height);
  const classes = ['template-clone__pdf-replica-text'];

  if (knownLabel) {
    classes.push('template-clone__pdf-replica-text--label');
  }

  const dataAttributes = [
    `data-template-line="${lineIndex + 1}"`,
    `data-template-source="${escapeAttribute(line.source || 'text_layer')}"`,
  ];

  if (knownLabel && !inlineCompositeHtml) {
    dataAttributes.push(`data-template-label="${escapeAttribute(knownLabel.canonicalLabel)}"`);
  }

  return `      <div class="${classes.join(' ')}" ${dataAttributes.join(
    ' '
  )} style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;font-size:${fontSize}px;line-height:${height}px;">${
    inlineCompositeHtml || escapeHtml(normalizedText)
  }</div>`;
};

const dedupeReplicaPositions = (positions: number[]) => {
  const sorted = [...positions]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const deduped: number[] = [];

  for (const position of sorted) {
    const previous = deduped[deduped.length - 1];

    if (typeof previous === 'number' && Math.abs(previous - position) < 1) {
      continue;
    }

    deduped.push(Number(position.toFixed(2)));
  }

  return deduped;
};

const buildReplicaRulesHtml = (page: TemplateExtractPdfPage, geometryPage: TemplateExtractPdfPageGeometry | null) => {
  if (!geometryPage) {
    return '';
  }

  const verticalRules = geometryPage.columnEdges
    .filter((edge) => edge > 0 && edge < page.width)
    .map(
      (edge) =>
        `      <div class="template-clone__pdf-replica-rule template-clone__pdf-replica-rule--v" style="left:${Number(
          edge.toFixed(2)
        )}px;height:${Number(page.height.toFixed(2))}px;"></div>`
    )
    .join('\n');
  const horizontalPositions = dedupeReplicaPositions([
    ...geometryPage.rows.map((row) => row.top),
    ...geometryPage.rows.map((row) => row.top + row.height),
  ]);
  const horizontalRules = horizontalPositions
    .filter((top) => top > 0 && top < page.height)
    .map(
      (top) =>
        `      <div class="template-clone__pdf-replica-rule template-clone__pdf-replica-rule--h" style="top:${top}px;width:${Number(
          page.width.toFixed(2)
        )}px;"></div>`
    )
    .join('\n');

  return [verticalRules, horizontalRules].filter(Boolean).join('\n');
};

const buildPositionedPageHtml = (
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry | null
) => {
  const lineHtml = page.lines
    .slice()
    .sort((left, right) => {
      const topDiff = toReplicaTop(page, left) - toReplicaTop(page, right);

      if (Math.abs(topDiff) <= 1.5) {
        return left.x - right.x;
      }

      return topDiff;
    })
    .map((line, index) => buildPositionedLineHtml(page, line, index))
    .filter(Boolean)
    .join('\n');
  const rulesHtml = buildReplicaRulesHtml(page, geometryPage);

  return `    <div class="template-clone__pdf-replica-page" data-page="${page.pageNumber}" data-page-number="${
    page.pageNumber
  }" style="width:${Number(page.width.toFixed(2))}px;height:${Number(page.height.toFixed(2))}px;">
${rulesHtml}
${lineHtml}
    </div>`;
};

const buildPositionedStyleHtml = () => `    <style>
      .template-clone--pdf-positioned-v22 {
        width: fit-content;
        margin: 0 auto;
        background: transparent;
        color: #111827;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      }

      .template-clone__pdf-replica-page {
        position: relative;
        margin: 0 auto 16px;
        background: #ffffff;
        border: 1px solid #0f172a;
        box-sizing: content-box;
        overflow: hidden;
      }

      .template-clone__pdf-replica-rule {
        position: absolute;
        background: #0f172a;
        pointer-events: none;
      }

      .template-clone__pdf-replica-rule--v {
        top: 0;
        width: 1px;
        transform: translateX(-0.5px);
      }

      .template-clone__pdf-replica-rule--h {
        left: 0;
        height: 1px;
        transform: translateY(-0.5px);
      }

      .template-clone__pdf-replica-text {
        position: absolute;
        color: #111827;
        white-space: pre;
        letter-spacing: -0.01em;
        overflow: visible;
      }

      .template-clone__pdf-replica-text--label {
        font-weight: 600;
      }

      .template-clone__pdf-replica-text .template-clone__pdf-inline-value,
      .template-clone__pdf-replica-text .template-clone__pdf-block-value {
        display: inline;
        min-height: 0;
      }
    </style>`;

const fillGapCells = (fromColumn: number, toColumn: number) => {
  const gap = toColumn - fromColumn;

  if (gap <= 0) {
    return '';
  }

  return `<td class="template-clone__pdf-empty" colspan="${gap}"></td>`;
};

const renderPlainCell = (text: string) => `<div class="template-clone__pdf-text">${escapeHtml(text)}</div>`;
const renderRichCell = (html: string) => `<div class="template-clone__pdf-text">${html}</div>`;

const renderValueCell = (label: string, text: string, block = false) =>
  block
    ? `<div class="template-clone__pdf-value-block">${buildValueMarker(label, text, 'block')}</div>`
    : `<div class="template-clone__pdf-value-inline">${buildValueMarker(label, text, 'inline')}</div>`;

const describeRow = (row: TemplateExtractPdfGeometryRow): CellDescriptor[] =>
  row.cells.map((cell) => ({
    cell,
    text: normalizeWhitespace(cell.text),
    knownLabel: resolveKnownLabel(cell.text),
    html: null,
  }));

const rowHasStrongLabel = (descriptors: CellDescriptor[]) =>
  descriptors.some(
    (descriptor) =>
      Boolean(descriptor.knownLabel) ||
      Boolean(buildInlineCompositeHtml(descriptor.text)) ||
      /^\d+(?:-\d+)?\.\s*/.test(descriptor.text)
  );

const rowLooksLikeContinuation = (descriptors: CellDescriptor[]) =>
  descriptors.length > 0 &&
  !rowHasStrongLabel(descriptors) &&
  descriptors.every((descriptor) => descriptor.cell.startColumn >= 1);

const renderRow = (row: TemplateExtractPdfGeometryRow, totalColumns: number, carryOver: PendingField | null) => {
  const descriptors = describeRow(row);
  let nextCarry = carryOver;

  for (const descriptor of descriptors) {
    const compositeHtml = buildInlineCompositeHtml(descriptor.text);

    if (compositeHtml) {
      descriptor.html = renderRichCell(compositeHtml);
    }
  }

  const labelIndexes = descriptors
    .map((descriptor, index) => ({ descriptor, index }))
    .filter(({ descriptor }) => descriptor.html === null && descriptor.knownLabel)
    .map(({ index }) => index);

  if (labelIndexes.length > 0) {
    nextCarry = null;

    for (let index = 0; index < labelIndexes.length; index += 1) {
      const labelIndex = labelIndexes[index];
      const descriptor = descriptors[labelIndex];
      const label = descriptor.knownLabel!;
      const nextLabelIndex = labelIndexes[index + 1] ?? descriptors.length;
      let attachedValue = false;

      descriptor.html = renderPlainCell(descriptor.text);

      for (let cursor = labelIndex + 1; cursor < nextLabelIndex; cursor += 1) {
        const candidate = descriptors[cursor];

        if (candidate.html || !candidate.text || candidate.knownLabel) {
          continue;
        }

        candidate.html = renderValueCell(
          label.canonicalLabel,
          candidate.text,
          label.fieldType === 'textarea' || candidate.text.length > 36 || looksLikeDateTime(candidate.text)
        );
        attachedValue = true;
      }

      if (!attachedValue || (labelIndexes.length === 1 && (label.fieldType === 'textarea' || /제목/.test(label.canonicalLabel)))) {
        nextCarry = {
          label: label.canonicalLabel,
          multiline: label.fieldType === 'textarea' || /^\d+(?:-\d+)?\.\s*/.test(descriptor.text),
        };
      }
    }
  } else if (carryOver) {
    for (const descriptor of descriptors) {
      if (descriptor.html || !descriptor.text) {
        continue;
      }

      descriptor.html = renderValueCell(carryOver.label, descriptor.text, carryOver.multiline || descriptor.text.length > 40);
    }
  }

  for (const descriptor of descriptors) {
    if (!descriptor.html) {
      descriptor.html = renderPlainCell(descriptor.text);
    }
  }

  let currentColumn = 0;
  const cellHtml = descriptors
    .flatMap((descriptor) => {
      const fragments: string[] = [];

      fragments.push(fillGapCells(currentColumn, descriptor.cell.startColumn));

      const colspan = Math.max(descriptor.cell.endColumn - descriptor.cell.startColumn, 1);
      const cellClass = descriptor.knownLabel ? 'template-clone__pdf-cell template-clone__pdf-cell--label' : 'template-clone__pdf-cell';
      fragments.push(`<td class="${cellClass}" colspan="${colspan}">${descriptor.html}</td>`);
      currentColumn = descriptor.cell.endColumn;
      return fragments;
    })
    .join('');

  const trailing = fillGapCells(currentColumn, totalColumns);

  return {
    html: `<tr style="height:${Math.max(row.height, 22).toFixed(2)}px;">${cellHtml}${trailing}</tr>`,
    nextCarry,
  };
};

const reorderRowsForLeadingLabels = (rows: TemplateExtractPdfGeometryRow[]) => {
  const reordered: TemplateExtractPdfGeometryRow[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const next = rows[index + 1];

    if (!next) {
      reordered.push(current);
      continue;
    }

    const currentDescriptors = describeRow(current);
    const nextDescriptors = describeRow(next);
    const currentFirstColumn = current.cells[0]?.startColumn ?? 999;
    const nextFirstColumn = next.cells[0]?.startColumn ?? 999;

    if (
      rowLooksLikeContinuation(currentDescriptors) &&
      rowHasStrongLabel(nextDescriptors) &&
      nextFirstColumn < currentFirstColumn &&
      next.top - current.top < 14
    ) {
      reordered.push(next, current);
      index += 1;
      continue;
    }

    reordered.push(current);
  }

  return reordered;
};

const buildPageHtml = (page: TemplateExtractPdfPageGeometry) => {
  const orderedRows = reorderRowsForLeadingLabels(page.rows);
  let carryOver: PendingField | null = null;

  const rowsHtml = orderedRows
    .map((row) => {
      const rendered = renderRow(row, Math.max(page.columnEdges.length - 1, 1), carryOver);
      carryOver = rendered.nextCarry;
      return rendered.html;
    })
    .join('\n');

  return `    <div class="template-clone__pdf-page" data-page="${page.pageNumber}">
      <table class="template-clone__pdf-table">
        <colgroup>
${page.columnEdges
  .slice(0, -1)
  .map((edge, index) => {
    const next = page.columnEdges[index + 1];
    return `          <col style="width:${(((next - edge) / page.width) * 100).toFixed(4)}%;">`;
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
      .template-clone--pdf-html-grid {
        width: fit-content;
        margin: 0 auto;
        background: transparent;
        color: #111827;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      }

      .template-clone__pdf-page {
        position: relative;
        margin: 0 auto 12px;
        background: #ffffff;
        border: 0;
        box-shadow: none;
        padding: 0;
        overflow: hidden;
      }

      .template-clone__pdf-table {
        width: 100%;
        height: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .template-clone__pdf-table td {
        border: 1px solid #0f172a;
        padding: 1px 3px;
        vertical-align: top;
        font-size: 11.5px;
        line-height: 1.16;
        word-break: break-word;
      }

      .template-clone__pdf-cell--label {
        font-weight: 700;
        background: #ffffff;
      }

      .template-clone__pdf-empty {
        background: #ffffff;
      }

      .template-clone__pdf-text {
        white-space: pre-wrap;
        letter-spacing: -0.01em;
      }

      .template-clone__pdf-inline-value,
      .template-clone__pdf-block-value {
        display: block;
        min-height: 16px;
      }

      .template-clone__pdf-inline-value > span,
      .template-clone__pdf-block-value > span {
        display: inline-block;
        width: 100%;
        min-height: 14px;
      }
    </style>`;

export const TemplateExtractPdfHtmlCloneService = {
  buildCloneHtml(_sourceTitle: string, geometryModel: TemplateExtractPdfGeometryModel) {
    const pagesHtml = geometryModel.pages.map(buildPageHtml).join('\n');

    return `<section data-template-extract-draft="true" data-template-clone="pdf-html-grid">
  <div class="template-clone template-clone--pdf-html-grid">
${buildStyleHtml()}
${pagesHtml}
  </div>
</section>`;
  },

  buildPositionedCloneHtml(_sourceTitle: string, layout: TemplateExtractPdfLayoutModel) {
    if (!layout.pages.length) {
      return null;
    }

    const geometryModel = TemplateExtractPdfGeometryService.buildGeometry(layout);
    const geometryPagesByNumber = new Map(
      geometryModel.pages.map((page) => [page.pageNumber, page] satisfies [number, TemplateExtractPdfPageGeometry])
    );
    const pagesHtml = layout.pages
      .map((page) => buildPositionedPageHtml(page, geometryPagesByNumber.get(page.pageNumber) || null))
      .join('\n');

    return `<section data-template-extract-draft="true" data-template-clone="pdf-positioned-v22">
  <div class="template-clone template-clone--pdf-positioned-v22">
${buildPositionedStyleHtml()}
${pagesHtml}
  </div>
</section>`;
  },
};
