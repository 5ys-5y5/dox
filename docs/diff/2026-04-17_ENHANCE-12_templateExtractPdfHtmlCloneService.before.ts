import type {
  TemplateExtractPdfGeometryCell,
  TemplateExtractPdfGeometryModel,
  TemplateExtractPdfGeometryRow,
  TemplateExtractPdfPageGeometry,
} from '../lib/templateExtractDtos';
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

  const statusMatch = normalized.match(/^(CE|PM)\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/);

  if (statusMatch) {
    const actorLabel = statusMatch[1] === 'CE' ? 'CE 담당자' : 'PM 담당자';
    const timeLabel = statusMatch[1] === 'CE' ? 'CE 처리시각' : 'PM 처리시각';
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

  const inlineMatch = normalized.match(/^([^:：]{1,80})\s*[:：]\s*(.+)$/);

  if (inlineMatch) {
    const known = resolveKnownLabel(inlineMatch[1]);

    if (known) {
      return `${escapeHtml(inlineMatch[1])} : ${buildValueMarker(known.canonicalLabel, inlineMatch[2])}`;
    }
  }

  return null;
};

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
        width: 100%;
        background: #f8fafc;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      }

      .template-clone__pdf-page {
        margin: 0 auto 24px;
        max-width: 980px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        padding: 12px;
      }

      .template-clone__pdf-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .template-clone__pdf-table td {
        border: 1px solid #0f172a;
        padding: 4px 6px;
        vertical-align: top;
        font-size: 12px;
        line-height: 1.28;
        word-break: break-word;
      }

      .template-clone__pdf-cell--label {
        font-weight: 700;
        background: #f8fafc;
      }

      .template-clone__pdf-empty {
        background: #ffffff;
      }

      .template-clone__pdf-text {
        white-space: pre-wrap;
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
};
