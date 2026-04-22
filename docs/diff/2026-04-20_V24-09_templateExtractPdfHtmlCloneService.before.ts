import type {
  TemplateExtractPdfGeometryCell,
  TemplateExtractPdfGeometryModel,
  TemplateExtractPdfGeometryRow,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfLine,
  TemplateExtractPdfPage,
  TemplateExtractPdfPageGeometry,
  TemplateExtractPdfRulePage,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfGeometryService } from './templateExtractPdfGeometryService';
import type { TemplateExtractPdfMaskVectorPage } from './templateExtractPdfRenderService';
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
    return `<span class="template-clone__pdf-status-line"><span class="template-clone__pdf-status-line-code">${escapeHtml(
      statusMatch[1]
    )}</span>${buildValueMarker(actorLabel, statusMatch[2])}${buildValueMarker(timeLabel, statusMatch[3])}</span>`;
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

const buildStatusOptionLineHtml = (text: string) => {
  const normalized = normalizeWhitespace(text);

  if (normalized === '신규 재발급') {
    return `<span class="template-clone__pdf-status-options"><span class="template-clone__pdf-status-option"><span class="template-clone__pdf-check template-clone__pdf-check--checked"></span>신규</span><span class="template-clone__pdf-status-option"><span class="template-clone__pdf-check"></span>재발급</span></span>`;
  }

  if (normalized === 'Off-Line등록') {
    return `<span class="template-clone__pdf-status-options"><span class="template-clone__pdf-status-option"><span class="template-clone__pdf-check"></span>Off-Line등록</span></span>`;
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
  const statusOptionHtml = buildStatusOptionLineHtml(normalizedText);
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
    statusOptionHtml || inlineCompositeHtml || escapeHtml(normalizedText)
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

type ReplicaRuleSegment =
  | { orientation: 'h'; left: number; top: number; width: number }
  | { orientation: 'v'; left: number; top: number; height: number };

const clampReplicaCoordinate = (value: number, min: number, max: number) =>
  Number(Math.min(Math.max(value, min), max).toFixed(2));

const buildReplicaRuleSegmentKey = (segment: ReplicaRuleSegment) =>
  segment.orientation === 'h'
    ? `h:${segment.left.toFixed(2)}:${segment.top.toFixed(2)}:${segment.width.toFixed(2)}`
    : `v:${segment.left.toFixed(2)}:${segment.top.toFixed(2)}:${segment.height.toFixed(2)}`;

const appendReplicaRuleSegment = (
  segments: ReplicaRuleSegment[],
  seen: Set<string>,
  segment: ReplicaRuleSegment | null
) => {
  if (!segment) {
    return;
  }

  const key = buildReplicaRuleSegmentKey(segment);

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  segments.push(segment);
};

const dedupeReplicaRuleAxis = (values: number[], max: number, tolerance = 2) => {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .map((value) => clampReplicaCoordinate(value, 0, max))
    .sort((left, right) => left - right);
  const deduped: number[] = [];

  for (const value of sorted) {
    const previous = deduped[deduped.length - 1];

    if (typeof previous === 'number' && Math.abs(previous - value) <= tolerance) {
      continue;
    }

    deduped.push(value);
  }

  return deduped;
};

const buildRuleGuidedReplicaRuleSegments = (page: TemplateExtractPdfPage, rulePage: TemplateExtractPdfRulePage) => {
  const rowRules = dedupeReplicaRuleAxis(rulePage.rowRules, page.height);
  const columnRules = dedupeReplicaRuleAxis(rulePage.columnRules, page.width);

  if (rowRules.length < 3 || columnRules.length < 3) {
    return [] as ReplicaRuleSegment[];
  }

  const segments: ReplicaRuleSegment[] = [];
  const seen = new Set<string>();
  const gridLeft = columnRules[0];
  const gridRight = columnRules[columnRules.length - 1];
  const gridTop = rowRules[0];
  const gridBottom = rowRules[rowRules.length - 1];

  if (gridRight - gridLeft <= 24 || gridBottom - gridTop <= 24) {
    return [] as ReplicaRuleSegment[];
  }

  for (const rowRule of rowRules) {
    appendReplicaRuleSegment(segments, seen, {
      orientation: 'h',
      left: gridLeft,
      top: rowRule,
      width: Number((gridRight - gridLeft).toFixed(2)),
    });
  }

  for (const columnRule of columnRules) {
    appendReplicaRuleSegment(segments, seen, {
      orientation: 'v',
      left: columnRule,
      top: gridTop,
      height: Number((gridBottom - gridTop).toFixed(2)),
    });
  }

  for (const horizontalSegment of rulePage.horizontalSegments) {
    appendReplicaRuleSegment(segments, seen, {
      orientation: 'h',
      left: clampReplicaCoordinate(horizontalSegment.start, 0, page.width),
      top: clampReplicaCoordinate(horizontalSegment.position, 0, page.height),
      width: Number(Math.max(1, horizontalSegment.end - horizontalSegment.start).toFixed(2)),
    });
  }

  for (const verticalSegment of rulePage.verticalSegments) {
    appendReplicaRuleSegment(segments, seen, {
      orientation: 'v',
      left: clampReplicaCoordinate(verticalSegment.position, 0, page.width),
      top: clampReplicaCoordinate(verticalSegment.start, 0, page.height),
      height: Number(Math.max(1, verticalSegment.end - verticalSegment.start).toFixed(2)),
    });
  }

  return segments;
};

const buildReplicaRuleSegments = (
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry | null,
  rulePage: TemplateExtractPdfRulePage | null
) => {
  const ruleGuidedSegments = rulePage ? buildRuleGuidedReplicaRuleSegments(page, rulePage) : [];
  const segments: ReplicaRuleSegment[] = [];
  const seen = new Set<string>();

  for (const ruleSegment of ruleGuidedSegments) {
    appendReplicaRuleSegment(segments, seen, ruleSegment);
  }

  if (!geometryPage) {
    return segments;
  }

  for (const row of geometryPage.rows) {
    if (!row.cells.length) {
      continue;
    }

    const rowTop = clampReplicaCoordinate(row.top, 0, page.height);
    const rowBottom = clampReplicaCoordinate(row.top + row.height, 0, page.height);
    const rowHeight = Number((rowBottom - rowTop).toFixed(2));

    if (rowHeight <= 0.5) {
      continue;
    }

    const rowLeft = clampReplicaCoordinate(
      Math.min(...row.cells.map((cell) => cell.x)),
      0,
      page.width
    );
    const rowRight = clampReplicaCoordinate(
      Math.max(...row.cells.map((cell) => cell.right)),
      0,
      page.width
    );
    const rowWidth = Number((rowRight - rowLeft).toFixed(2));

    if (rowWidth <= 0.5) {
      continue;
    }

    appendReplicaRuleSegment(segments, seen, {
      orientation: 'h',
      left: rowLeft,
      top: rowTop,
      width: rowWidth,
    });
    appendReplicaRuleSegment(segments, seen, {
      orientation: 'h',
      left: rowLeft,
      top: rowBottom,
      width: rowWidth,
    });

    for (const cell of row.cells) {
      const cellLeft = clampReplicaCoordinate(cell.x, 0, page.width);
      const cellRight = clampReplicaCoordinate(cell.right, 0, page.width);

      appendReplicaRuleSegment(segments, seen, {
        orientation: 'v',
        left: cellLeft,
        top: rowTop,
        height: rowHeight,
      });
      appendReplicaRuleSegment(segments, seen, {
        orientation: 'v',
        left: cellRight,
        top: rowTop,
        height: rowHeight,
      });
    }
  }

  return segments.sort((left, right) => {
    if (left.orientation !== right.orientation) {
      return left.orientation === 'h' ? -1 : 1;
    }

    if (left.orientation === 'h' && right.orientation === 'h') {
      return left.top - right.top || left.left - right.left;
    }

    return left.left - right.left || left.top - right.top;
  });
};

const buildReplicaRulesHtml = (
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry | null,
  rulePage: TemplateExtractPdfRulePage | null
) =>
  buildReplicaRuleSegments(page, geometryPage, rulePage)
    .map((segment) =>
      segment.orientation === 'h'
        ? `      <div class="template-clone__pdf-replica-rule template-clone__pdf-replica-rule--h" style="left:${segment.left}px;top:${segment.top}px;width:${segment.width}px;"></div>`
        : `      <div class="template-clone__pdf-replica-rule template-clone__pdf-replica-rule--v" style="left:${segment.left}px;top:${segment.top}px;height:${segment.height}px;"></div>`
    )
    .join('\n');

const buildPositionedPageHtml = (
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry | null,
  rulePage: TemplateExtractPdfRulePage | null
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
  const rulesHtml = buildReplicaRulesHtml(page, geometryPage, rulePage);

  return `    <div class="template-clone__pdf-replica-page" data-page="${page.pageNumber}" data-page-number="${
    page.pageNumber
  }" style="width:${Number(page.width.toFixed(2))}px;height:${Number(page.height.toFixed(2))}px;">
${rulesHtml}
${lineHtml}
    </div>`;
};

const escapeSvgText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const buildPositionedSvgTextElement = (page: TemplateExtractPdfPage, line: TemplateExtractPdfLine, lineIndex: number) => {
  const rawText = line.text.replace(/\r/g, '');

  if (!rawText.trim()) {
    return '';
  }

  const knownLabel = resolveKnownLabel(normalizeWhitespace(rawText));
  const left = Math.max(0, Number(line.x.toFixed(2)));
  const top = toReplicaTop(page, line);
  const width = Math.max(8, Number(line.width.toFixed(2)));
  const height = Math.max(10, Number(line.height.toFixed(2)));
  const fontSize = Number(Math.max(8.5, Math.min(height * 0.98, 18)).toFixed(2));
  const baseline = Number((top + height - Math.max(1.2, height * 0.16)).toFixed(2));
  const classes = ['template-clone__pdf-svg-text'];
  const dataAttributes = [
    `data-template-line="${lineIndex + 1}"`,
    `data-template-source="${escapeAttribute(line.source || 'text_layer')}"`,
  ];

  if (knownLabel) {
    classes.push('template-clone__pdf-svg-text--label');
    dataAttributes.push(`data-template-label="${escapeAttribute(knownLabel.canonicalLabel)}"`);
  }

  return `        <text class="${classes.join(' ')}" ${dataAttributes.join(
    ' '
  )} x="${left}" y="${baseline}" font-size="${fontSize}" textLength="${width}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${escapeSvgText(
    rawText
  )}</text>`;
};

const toCrispReplicaCoord = (value: number) => Number((Math.round(value) + 0.5).toFixed(2));

const buildPositionedSvgPageHtml = (
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry | null,
  rulePage: TemplateExtractPdfRulePage | null
) => {
  const textHtml = page.lines
    .slice()
    .sort((left, right) => {
      const topDiff = toReplicaTop(page, left) - toReplicaTop(page, right);

      if (Math.abs(topDiff) <= 1.5) {
        return left.x - right.x;
      }

      return topDiff;
    })
    .map((line, index) => buildPositionedSvgTextElement(page, line, index))
    .filter(Boolean)
    .join('\n');
  const ruleHtml = buildReplicaRuleSegments(page, geometryPage, rulePage)
    .map((segment) =>
      segment.orientation === 'h'
        ? `        <line class="template-clone__pdf-svg-rule" x1="${segment.left}" y1="${toCrispReplicaCoord(
            segment.top
          )}" x2="${Number((segment.left + segment.width).toFixed(2))}" y2="${toCrispReplicaCoord(segment.top)}" />`
        : `        <line class="template-clone__pdf-svg-rule" x1="${toCrispReplicaCoord(
            segment.left
          )}" y1="${segment.top}" x2="${toCrispReplicaCoord(segment.left)}" y2="${Number(
            (segment.top + segment.height).toFixed(2)
          )}" />`
    )
    .join('\n');

  return `    <div class="template-clone__pdf-svg-page-wrap" data-page="${page.pageNumber}" data-page-number="${page.pageNumber}">
      <svg class="template-clone__pdf-svg-page" width="${Number(page.width.toFixed(2))}" height="${Number(
    page.height.toFixed(2)
  )}" viewBox="0 0 ${Number(page.width.toFixed(2))} ${Number(page.height.toFixed(2))}" role="img" aria-label="PDF replica page ${page.pageNumber}">
${ruleHtml}
${textHtml}
      </svg>
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
        border: 0;
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
        width: 1.15px;
        transform: translateX(-0.5px);
      }

      .template-clone__pdf-replica-rule--h {
        left: 0;
        height: 1.15px;
        transform: translateY(-0.5px);
      }

      .template-clone__pdf-replica-text {
        position: absolute;
        color: #111827;
        white-space: pre;
        letter-spacing: -0.01em;
        overflow: visible;
        font-weight: 500;
        -webkit-text-stroke: 0.15px currentColor;
      }

      .template-clone__pdf-replica-text--label {
        font-weight: 600;
      }

      .template-clone__pdf-replica-text .template-clone__pdf-inline-value,
      .template-clone__pdf-replica-text .template-clone__pdf-block-value {
        display: inline;
        min-height: 0;
      }

      .template-clone__pdf-status-line {
        display: inline-flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        white-space: nowrap;
      }

      .template-clone__pdf-status-line-code {
        display: inline-block;
        min-width: 24px;
      }

      .template-clone__pdf-status-options {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        white-space: nowrap;
      }

      .template-clone__pdf-status-option {
        display: inline-flex;
        gap: 3px;
        align-items: center;
      }

      .template-clone__pdf-check {
        display: inline-block;
        width: 9px;
        height: 9px;
        border: 1px solid currentColor;
        box-sizing: border-box;
      }

      .template-clone__pdf-check--checked::after {
        content: "";
        display: block;
        width: 5px;
        height: 5px;
        margin: 1px;
        background: currentColor;
      }
    </style>`;

const buildPositionedSvgStyleHtml = () => `    <style>
      .template-clone--pdf-positioned-svg-v24 {
        width: fit-content;
        margin: 0 auto;
        background: transparent;
        color: #111827;
        font-family: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
      }

      .template-clone__pdf-svg-page-wrap {
        margin: 0 auto 16px;
        background: #ffffff;
      }

      .template-clone__pdf-svg-page {
        display: block;
        background: #ffffff;
        overflow: visible;
        shape-rendering: geometricPrecision;
        text-rendering: geometricPrecision;
      }

      .template-clone__pdf-svg-rule {
        stroke: #111827;
        stroke-width: 1.15;
        stroke-linecap: square;
        vector-effect: non-scaling-stroke;
      }

      .template-clone__pdf-svg-text {
        fill: #111827;
        font-weight: 500;
        letter-spacing: -0.01em;
      }

      .template-clone__pdf-svg-text--label {
        font-weight: 600;
      }
    </style>`;

const buildMaskVectorStyleHtml = () => `    <style>
      .template-clone--pdf-mask-vector-v24 {
        width: fit-content;
        margin: 0 auto;
        background: transparent;
      }

      .template-clone__pdf-mask-page-wrap {
        margin: 0 auto 16px;
        background: #ffffff;
        overflow: hidden;
      }

      .template-clone__pdf-mask-page {
        display: block;
        background: #ffffff;
        shape-rendering: crispEdges;
        text-rendering: geometricPrecision;
      }

      .template-clone__pdf-mask-ink {
        fill: #111827;
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

const buildMaskVectorPageHtml = (page: TemplateExtractPdfMaskVectorPage) => {
  const rectsHtml = page.rects
    .map(
      (rect) =>
        `          <rect class="template-clone__pdf-mask-ink" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"></rect>`
    )
    .join('\n');

  return `    <div class="template-clone__pdf-mask-page-wrap" data-page-number="${page.pageNumber}" style="width:${page.cssWidth}px;height:${page.cssHeight}px">
      <svg class="template-clone__pdf-mask-page" width="${page.cssWidth}" height="${page.cssHeight}" viewBox="0 0 ${page.viewBoxWidth} ${page.viewBoxHeight}" xmlns="http://www.w3.org/2000/svg" aria-label="PDF page ${page.pageNumber}">
        <rect x="0" y="0" width="${page.viewBoxWidth}" height="${page.viewBoxHeight}" fill="#ffffff"></rect>
${rectsHtml}
      </svg>
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

  buildPositionedCloneHtml(
    _sourceTitle: string,
    layout: TemplateExtractPdfLayoutModel,
    rulePages: TemplateExtractPdfRulePage[] = []
  ) {
    if (!layout.pages.length) {
      return null;
    }

    const geometryModel = TemplateExtractPdfGeometryService.buildGeometry(layout);
    const geometryPagesByNumber = new Map(
      geometryModel.pages.map((page) => [page.pageNumber, page] satisfies [number, TemplateExtractPdfPageGeometry])
    );
    const rulePagesByNumber = new Map(rulePages.map((page) => [page.pageNumber, page] satisfies [number, TemplateExtractPdfRulePage]));
    const pagesHtml = layout.pages
      .map((page) =>
        buildPositionedPageHtml(
          page,
          geometryPagesByNumber.get(page.pageNumber) || null,
          rulePagesByNumber.get(page.pageNumber) || null
        )
      )
      .join('\n');

    return `<section data-template-extract-draft="true" data-template-clone="pdf-positioned-v22">
  <div class="template-clone template-clone--pdf-positioned-v22">
${buildPositionedStyleHtml()}
${pagesHtml}
  </div>
</section>`;
  },

  buildPositionedSvgCloneHtml(
    _sourceTitle: string,
    layout: TemplateExtractPdfLayoutModel,
    rulePages: TemplateExtractPdfRulePage[] = []
  ) {
    if (!layout.pages.length) {
      return null;
    }

    const geometryModel = TemplateExtractPdfGeometryService.buildGeometry(layout);
    const geometryPagesByNumber = new Map(
      geometryModel.pages.map((page) => [page.pageNumber, page] satisfies [number, TemplateExtractPdfPageGeometry])
    );
    const rulePagesByNumber = new Map(rulePages.map((page) => [page.pageNumber, page] satisfies [number, TemplateExtractPdfRulePage]));
    const pagesHtml = layout.pages
      .map((page) =>
        buildPositionedSvgPageHtml(
          page,
          geometryPagesByNumber.get(page.pageNumber) || null,
          rulePagesByNumber.get(page.pageNumber) || null
        )
      )
      .join('\n');

    return `<section data-template-extract-draft="true" data-template-clone="pdf-positioned-svg-v24">
  <div class="template-clone template-clone--pdf-positioned-svg-v24">
${buildPositionedSvgStyleHtml()}
${pagesHtml}
  </div>
</section>`;
  },

  buildMaskVectorCloneHtml(
    _sourceTitle: string,
    pages: TemplateExtractPdfMaskVectorPage[],
    semanticHtml: string | null = null
  ) {
    if (!pages.length) {
      return null;
    }

    const pagesHtml = pages.map(buildMaskVectorPageHtml).join('\n');
    const semanticTemplate = semanticHtml?.trim()
      ? `
  <template data-template-semantic-layer="true">
${semanticHtml.trim()}
  </template>`
      : '';

    return `<section data-template-extract-draft="true" data-template-clone="pdf-mask-vector-v24">
  <div class="template-clone template-clone--pdf-mask-vector-v24">
${buildMaskVectorStyleHtml()}
${pagesHtml}
  </div>${semanticTemplate}
</section>`;
  },
};
