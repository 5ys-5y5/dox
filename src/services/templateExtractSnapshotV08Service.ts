import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfLine,
  TemplateExtractResolvedSource,
} from '../lib/templateExtractDtos';

type PdfLabelDefinition = {
  canonical: string;
  aliases: string[];
};

type PdfMetadataField = {
  label: string;
  value: string;
};

type PdfSectionBlock = {
  number: string;
  label: string;
  valueLines: string[];
  asList: boolean;
};

type StructuredWorkOrder = {
  statusLines: string[];
  metadataFields: PdfMetadataField[];
  sections: PdfSectionBlock[];
  footerNotes: string[];
};

type ParsedStatusOverview = {
  ceName: string;
  ceProcessedAt: string;
  pmName: string;
  pmProcessedAt: string;
  issuerSignerName: string;
  issuerSignatureStatus: string;
  receiverSignerName: string;
};

type PdfSectionAnchor = {
  label: string;
  x: number;
  y: number;
};

const PDF_SECTION_DEFINITIONS: PdfLabelDefinition[] = [
  { canonical: '공사 내용', aliases: ['공 사 내 용', '공사 내용', '공사내용'] },
  { canonical: '대표수량 및 단가', aliases: ['대표수량 및 단가'] },
  { canonical: '하도급 대금', aliases: ['하도급 대금'] },
  { canonical: '공사착수일', aliases: ['공사착수일'] },
  { canonical: '공사완료일', aliases: ['공사완료일'] },
  { canonical: '검사의 방법', aliases: ['검사의 방법'] },
  { canonical: '검사의 시기', aliases: ['검사의 시기'] },
  { canonical: '대금 지급방법', aliases: ['대금 지급방법'] },
  { canonical: '대금 지급시기', aliases: ['대금 지급시기'] },
  { canonical: '원재료 지급시 조건', aliases: ['원재료 지급시 조건'] },
  {
    canonical: '공급원가 변동에 따른 하도급 대금의 조정',
    aliases: ['공급원가 변동에 따른 하도급 대금의 조정'],
  },
  { canonical: '특기사항', aliases: ['특기사항'] },
  { canonical: '첨부파일', aliases: ['첨부파일'] },
];

const PDF_SECTION_START_REGEX = /\d+(?:-\d+)?\.\s*[가-힣A-Za-z(]/g;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const cleanupPdfValue = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/^[:\-\s]+/, '')
      .replace(/\s*\*+\s*/g, ' ')
      .replace(/\s+/g, ' ')
  );

const splitPdfLines = (rawText: string) =>
  rawText
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+(?=\d+(?:-\d+)?\.\s*[가-힣A-Za-z(])/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line && !/^---PAGE\s+\d+---$/i.test(line) && !/^-+\d+-+$/.test(line));

const matchSectionDefinition = (line: string) => {
  const headingMatch = line.match(/^(\d+(?:-\d+)?)\.\s*(.+)$/);

  if (!headingMatch) {
    return null;
  }

  const number = headingMatch[1];
  const remainder = normalizeWhitespace(headingMatch[2].replace(/\*/g, ''));

  for (const definition of PDF_SECTION_DEFINITIONS) {
    for (const alias of definition.aliases) {
      const aliasPattern = new RegExp(
        `^${alias.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')}(?:\\s+(.*))?$`
      );
      const matched = remainder.match(aliasPattern);

      if (matched) {
        return {
          number,
          label: definition.canonical,
          inlineValue: cleanupPdfValue(matched[1] || ''),
        };
      }
    }
  }

  return null;
};

const mergeWrappedSectionLines = (lines: string[]) => {
  const merged: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];

    if (!current || !next) {
      merged.push(current);
      continue;
    }

    if (!/^\d+(?:-\d+)?\.\s*/.test(current) || matchSectionDefinition(current)) {
      merged.push(current);
      continue;
    }

    const combined = normalizeWhitespace(`${current} ${next}`);

    if (matchSectionDefinition(combined)) {
      merged.push(combined);
      index += 1;
      continue;
    }

    merged.push(current);
  }

  return merged;
};

const expandCompoundSectionLines = (lines: string[]) =>
  lines.flatMap((line) => {
    const matches = Array.from(line.matchAll(PDF_SECTION_START_REGEX)).map((match) => ({
      index: match.index ?? -1,
    }));

    if (matches.length <= 1) {
      return [line];
    }

    return matches
      .map((match, index) =>
        normalizeWhitespace(line.slice(match.index, matches[index + 1]?.index ?? line.length))
      )
      .filter(Boolean);
  });

const parseMetadataLine = (line: string, metadataFields: PdfMetadataField[]) => {
  const pushField = (label: string, value: string) => {
    const cleanedValue = cleanupPdfValue(value);

    if (!cleanedValue) {
      return;
    }

    metadataFields.push({
      label,
      value: cleanedValue,
    });
  };

  let matched = line.match(/^양식명\(코드\)\s*:\s*(.+?)\s+문서번호\s*:\s*(.+)$/);

  if (matched) {
    pushField('양식명(코드)', matched[1]);
    pushField('양식 문서번호', matched[2]);
    return true;
  }

  matched = line.match(/^작\s*성\s*자\s+(.+)$/);

  if (matched) {
    pushField('작성자', matched[1]);
    return true;
  }

  matched = line.match(/^문\s*서\s*번\s*호\s+(.+?)\s+발\s*급\s*일\s+(.+?)(?:\s+협력사승인일\s*(.*))?$/);

  if (matched) {
    pushField('문서번호', matched[1]);
    pushField('발급일', matched[2]);
    if (matched[3]) {
      pushField('협력사승인일', matched[3]);
    }
    return true;
  }

  matched = line.match(/^프\s*로\s*젝\s*트\s+(.+?)\s+발\s*급\s*자\s+(.+)$/);

  if (matched) {
    pushField('프로젝트', matched[1]);
    pushField('발급자', matched[2]);
    return true;
  }

  matched = line.match(/^계\s*약\s+(.+?)\s+접\s*수\s*자\s+(.+)$/);

  if (matched) {
    pushField('계약', matched[1]);
    pushField('접수자', matched[2]);
    return true;
  }

  matched = line.match(/^제\s*목\s+(.+)$/);

  if (matched) {
    pushField('제목', matched[1]);
    return true;
  }

  return false;
};

const dedupeMetadataFields = (fields: PdfMetadataField[]) => {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = field.label.replace(/\s+/g, '').toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const parseStructuredWorkOrder = (rawText: string): StructuredWorkOrder | null => {
  const lines = mergeWrappedSectionLines(expandCompoundSectionLines(splitPdfLines(rawText)));
  const metadataFields: PdfMetadataField[] = [];
  const sections: PdfSectionBlock[] = [];
  const statusLines: string[] = [];
  const footerNotes: string[] = [];
  let currentSection: PdfSectionBlock | null = null;

  const flushSection = () => {
    if (!currentSection) {
      return;
    }

    const normalizedLines = currentSection.valueLines.map(cleanupPdfValue).filter(Boolean);

    if (normalizedLines.length > 0) {
      sections.push({
        ...currentSection,
        valueLines: normalizedLines,
      });
    }

    currentSection = null;
  };

  for (const line of lines) {
    const sectionMatch = matchSectionDefinition(line);

    if (sectionMatch) {
      flushSection();
      currentSection = {
        number: sectionMatch.number,
        label: sectionMatch.label,
        valueLines: sectionMatch.inlineValue ? [sectionMatch.inlineValue] : [],
        asList: sectionMatch.label === '첨부파일',
      };
      continue;
    }

    if (currentSection) {
      if (currentSection.label === '첨부파일' && /^※\s*/.test(line)) {
        footerNotes.push(line);
        continue;
      }

      currentSection.valueLines.push(line);
      continue;
    }

    if (parseMetadataLine(line, metadataFields)) {
      continue;
    }

    if (
      line === '구 분' ||
      line === '신규 재발급' ||
      line === 'Off-Line등록' ||
      /^CE\s+/i.test(line) ||
      /^PM\s+/i.test(line)
    ) {
      statusLines.push(line);
      continue;
    }

    if (/서명/.test(line) || /전자서명 완료/.test(line)) {
      statusLines.push(line);
      continue;
    }
  }

  flushSection();

  const dedupedMetadata = dedupeMetadataFields(metadataFields);

  if (dedupedMetadata.length < 4 || sections.length < 3) {
    return null;
  }

  return {
    statusLines,
    metadataFields: dedupedMetadata,
    sections,
    footerNotes,
  };
};

const parseStatusOverview = (statusLines: string[]): ParsedStatusOverview => {
  const overview: ParsedStatusOverview = {
    ceName: '',
    ceProcessedAt: '',
    pmName: '',
    pmProcessedAt: '',
    issuerSignerName: '',
    issuerSignatureStatus: '',
    receiverSignerName: '',
  };

  for (const line of statusLines) {
    let matched = line.match(/^CE\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i);

    if (matched) {
      overview.ceName = cleanupPdfValue(matched[1]);
      overview.ceProcessedAt = cleanupPdfValue(matched[2]);
      continue;
    }

    matched = line.match(/^PM\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i);

    if (matched) {
      overview.pmName = cleanupPdfValue(matched[1]);
      overview.pmProcessedAt = cleanupPdfValue(matched[2]);
      continue;
    }

    matched = line.match(/^발급자 서명\s+(.+?)\s+(전자서명 완료)(?:\s+접수자 서명\s*(.*))?$/);

    if (matched) {
      overview.issuerSignerName = cleanupPdfValue(matched[1]);
      overview.issuerSignatureStatus = cleanupPdfValue(matched[2]);
      overview.receiverSignerName = cleanupPdfValue(matched[3] || '');
    }
  }

  return overview;
};

const buildStatusHtml = (statusLines: string[]) => {
  const overview = parseStatusOverview(statusLines);

  return `    <table class="template-clone__status-table">
      <colgroup>
        <col style="width: 10%">
        <col style="width: 23%">
        <col style="width: 10%">
        <col style="width: 23%">
        <col style="width: 10%">
        <col style="width: 24%">
      </colgroup>
      <tbody>
      <tr>
        <th>구분</th>
        <td colspan="5">
          <div class="template-clone__status-options">
            <span class="template-clone__check-option">□ 신규</span>
            <span class="template-clone__check-option">□ 재발급</span>
            <span class="template-clone__check-option">□ Off-Line 등록</span>
          </div>
        </td>
      </tr>
      <tr>
        <th>CE 담당자</th>
        <td><div data-template-value="CE 담당자">${escapeHtml(overview.ceName)}</div></td>
        <th>CE 처리시각</th>
        <td><div data-template-value="CE 처리시각">${escapeHtml(overview.ceProcessedAt)}</div></td>
      </tr>
      <tr>
        <th>PM 담당자</th>
        <td><div data-template-value="PM 담당자">${escapeHtml(overview.pmName)}</div></td>
        <th>PM 처리시각</th>
        <td><div data-template-value="PM 처리시각">${escapeHtml(overview.pmProcessedAt)}</div></td>
        <th>접수자 서명</th>
        <td><div data-template-value="접수자 서명">${escapeHtml(overview.receiverSignerName)}</div></td>
      </tr>
      <tr>
        <th>발급자 서명</th>
        <td><div data-template-value="발급자 서명자">${escapeHtml(overview.issuerSignerName)}</div></td>
        <th>전자서명 상태</th>
        <td colspan="3"><div data-template-value="전자서명 상태">${escapeHtml(overview.issuerSignatureStatus)}</div></td>
      </tr>
      </tbody>
    </table>`;
};

const buildCloneStyleHtml = () => `    <style>
      .template-clone--pdf-work-order {
        width: 920px;
        margin: 0 auto;
        padding: 18px;
        background: #ffffff;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        line-height: 1.45;
      }

      .template-clone--pdf-work-order h1 {
        margin: 0 0 12px;
        text-align: center;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .template-clone--pdf-work-order table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 10px;
      }

      .template-clone--pdf-work-order th,
      .template-clone--pdf-work-order td {
        border: 1px solid #111827;
        padding: 6px 8px;
        font-size: 12px;
        vertical-align: top;
      }

      .template-clone--pdf-work-order th {
        background: #f8fafc;
        font-weight: 700;
        text-align: center;
      }

      .template-clone__meta-table td,
      .template-clone__status-table td,
      .template-clone__body-table td {
        background: #ffffff;
      }

      .template-clone__status-options {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
      }

      .template-clone__check-option {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }

      .template-clone__body-number {
        text-align: center;
        font-weight: 700;
      }

      .template-clone__body-label {
        font-weight: 700;
        text-align: left;
      }

      .template-clone__body-value {
        padding: 0;
      }

      .template-clone__value-line,
      .template-clone__value-item,
      .template-clone__placeholder-line,
      .template-clone__placeholder-item {
        min-height: 28px;
        margin: 0;
        padding: 6px 8px;
        border-bottom: 1px solid #e2e8f0;
      }

      .template-clone__body-row:last-child .template-clone__value-line:last-child,
      .template-clone__body-row:last-child .template-clone__value-item:last-child,
      .template-clone__body-row:last-child .template-clone__placeholder-line:last-child,
      .template-clone__body-row:last-child .template-clone__placeholder-item:last-child {
        border-bottom: 0;
      }

      .template-clone__value-item::before,
      .template-clone__placeholder-item::before {
        content: "• ";
      }

      .template-clone__section-label-stack {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .template-clone__placeholder-inline {
        min-height: 18px;
      }

      .template-clone__placeholder-inline > span,
      .template-clone__placeholder-line > span,
      .template-clone__placeholder-item > span {
        display: inline-block;
        width: 100%;
        min-height: 14px;
        border-bottom: 1px solid #94a3b8;
      }

      .template-clone__footer-table td {
        font-size: 11px;
      }
    </style>`;

const buildMetadataHtml = (metadataFields: PdfMetadataField[]) => {
  const metadataByLabel = new Map(metadataFields.map((field) => [field.label, field.value]));
  const rows: string[] = [];

  const pushRow = (cells: Array<{ label: string; colSpan?: number }>) => {
    const cellHtml = cells
      .map((cell) => {
        const value = metadataByLabel.get(cell.label) || '';
        const colSpanAttr = cell.colSpan ? ` colspan="${cell.colSpan}"` : '';

        return `        <th>${escapeHtml(cell.label)}</th><td${colSpanAttr}><div data-template-value="${escapeHtml(
          cell.label
        )}">${escapeHtml(value)}</div></td>`;
      })
      .join('');

    rows.push(`      <tr>${cellHtml}</tr>`);
  };

  pushRow([{ label: '양식명(코드)' }, { label: '양식 문서번호' }]);
  pushRow([{ label: '작성자' }, { label: '문서번호' }, { label: '발급일' }, { label: '협력사승인일' }]);
  pushRow([{ label: '프로젝트' }, { label: '발급자' }]);
  pushRow([{ label: '계약' }, { label: '접수자' }]);
  pushRow([{ label: '제목', colSpan: 3 }]);

  return `    <table class="template-clone__meta-table">
      <colgroup>
        <col style="width: 12%">
        <col style="width: 19%">
        <col style="width: 12%">
        <col style="width: 19%">
        <col style="width: 12%">
        <col style="width: 13%">
        <col style="width: 13%">
      </colgroup>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>`;
};

const buildSectionLabelHtml = (section: PdfSectionBlock) => {
  if (section.label === '공급원가 변동에 따른 하도급 대금의 조정') {
    return `<div class="template-clone__section-label-stack">
          <span>공급원가 변동에 따른</span>
          <span>하도급 대금의 조정</span>
        </div>`;
  }

  return escapeHtml(section.label);
};

const buildSectionsHtml = (sections: PdfSectionBlock[]) => {
  const rows = sections
    .flatMap((section) => {
      const rowCount = Math.max(section.valueLines.length, 1);
      const valueLines = rowCount === 1 && section.valueLines.length === 0 ? [''] : section.valueLines;

      return valueLines.map((line, index) => {
        const rowHeadCells =
          index === 0
            ? `        <th class="template-clone__body-number" rowspan="${rowCount}">${escapeHtml(section.number)}.</th>
        <th class="template-clone__body-label" rowspan="${rowCount}">${buildSectionLabelHtml(section)}</th>`
            : '';
        const valueTag = 'p';
        const valueClass = section.asList ? 'template-clone__value-item' : 'template-clone__value-line';

        return `      <tr class="template-clone__body-row template-clone__body-row--${section.asList ? 'list' : 'text'}">
${rowHeadCells}
        <td class="template-clone__body-value"><${valueTag} class="${valueClass}" data-template-value="${escapeHtml(
          section.label
        )}">${escapeHtml(line)}</${valueTag}></td>
      </tr>`;
      });
    })
    .join('\n');

  return `    <table class="template-clone__body-table">
      <colgroup>
        <col style="width: 6%">
        <col style="width: 24%">
        <col style="width: 70%">
      </colgroup>
      <tbody>
${rows}
      </tbody>
    </table>`;
};

const buildFooterHtml = (footerNotes: string[]) => {
  if (footerNotes.length === 0) {
    return '';
  }

  return `    <table class="template-clone__footer-table">
      <tbody>
        <tr>
          <td>
${footerNotes.map((line) => `            <p>${escapeHtml(line)}</p>`).join('\n')}
          </td>
        </tr>
      </tbody>
    </table>`;
};

const escapeAttribute = (value: string) =>
  escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildAbsoluteCloneStyleHtml = () => `    <style>
      .template-clone--pdf-absolute {
        width: 100%;
        background: #f8fafc;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      }

      .template-clone__pdf-page {
        position: relative;
        margin: 0 auto 24px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }

      .template-clone__pdf-line {
        position: absolute;
        white-space: pre-wrap;
        overflow: visible;
        font-size: 12px;
        line-height: 1.25;
      }

      .template-clone__pdf-inline-placeholder,
      .template-clone__pdf-line-placeholder {
        display: inline-block;
        min-width: 56px;
        min-height: 12px;
        border-bottom: 1px solid #64748b;
      }

      .template-clone__pdf-line-placeholder {
        width: 100%;
      }
    </style>`;

const PDF_NEXT_LINE_VALUE_LABELS = new Map<string, string>([
  ['작 성 자', '작성자'],
  ['문 서 번 호', '문서번호'],
  ['발 급 일', '발급일'],
  ['프 로 젝 트', '프로젝트'],
  ['발 급 자', '발급자'],
  ['계 약', '계약'],
  ['접 수 자', '접수자'],
  ['발급자 서명', '발급자 서명자'],
  ['제 목', '제목'],
]);

const PDF_INLINE_EMPTY_LABELS = new Map<string, string>([
  ['협력사승인일', '협력사승인일'],
  ['접수자 서명', '접수자 서명'],
]);

const PDF_MULTILINE_PENDING_FIELDS = new Set(['제목']);

const PDF_SINGLE_COLON_VALUE_LABELS = [
  {
    regex: /^양식명\(코드\)\s*:\s*(.+)$/i,
    prefix: '양식명(코드) : ',
    label: '양식명(코드)',
  },
  {
    regex: /^문서번호\s*:\s*(.+)$/i,
    prefix: '문서번호 : ',
    label: '양식 문서번호',
  },
] as const;

const isStandaloneFieldLabel = (line: string) =>
  PDF_NEXT_LINE_VALUE_LABELS.has(line) || PDF_INLINE_EMPTY_LABELS.has(line);

const isLikelyValueContinuation = (line: TemplateExtractPdfLine, previousLabel: string | null) => {
  const text = normalizeWhitespace(line.text);

  if (!previousLabel) {
    return false;
  }

  if (!text.trim()) {
    return false;
  }

  if (/^※/.test(text)) {
    return false;
  }

  if (matchSectionDefinition(text) || isStandaloneFieldLabel(text)) {
    return false;
  }

  if (/^(구\s*분|신규|재발급|Off-Line)/.test(text)) {
    return false;
  }

  if (/^\d+(?:-\d+)?\./.test(text)) {
    return line.x >= 120;
  }

  return line.x >= 108 || !/^[가-힣A-Za-z]+\s*$/.test(text);
};

const renderInlineSegments = (
  lineText: string,
  segments: Array<{ text: string; label?: string; block?: boolean }>
) =>
  segments
    .map((segment) => {
      if (!segment.label) {
        return escapeHtml(segment.text);
      }

      if (segment.block) {
        return `<span data-template-value="${escapeAttribute(segment.label)}" class="template-clone__pdf-line-placeholder">${escapeHtml(
          segment.text
        )}</span>`;
      }

      return `<span data-template-value="${escapeAttribute(segment.label)}" class="template-clone__pdf-inline-placeholder">${escapeHtml(
        segment.text
      )}</span>`;
    })
    .join('');

const findNearestSectionAnchor = (
  line: TemplateExtractPdfLine,
  sectionAnchors: PdfSectionAnchor[]
) => {
  const candidates = sectionAnchors
    .filter(
      (anchor) =>
        line.x >= anchor.x + 40 &&
        line.y >= anchor.y - 14 &&
        line.y <= anchor.y + 120
    )
    .map((anchor) => ({
      label: anchor.label,
      score: Math.abs(line.y - anchor.y) * 2 + Math.abs(line.x - anchor.x),
    }))
    .sort((left, right) => left.score - right.score);

  return candidates[0]?.label || null;
};

const buildGenericLineHtml = (
  line: TemplateExtractPdfLine,
  previousSectionLabel: string | null,
  pendingFieldLabel: string | null,
  nextLine: TemplateExtractPdfLine | null,
  sectionAnchors: PdfSectionAnchor[]
) => {
  const text = normalizeWhitespace(line.text);

  if (!text) {
    return {
      html: '',
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: pendingFieldLabel,
      newSectionAnchor: null,
    };
  }

  let matched = text.match(/^양식명\(코드\)\s*:\s*(.+?)\s+문서번호\s*:\s*(.+)$/);

  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '양식명(코드) : ' },
        { text: matched[1], label: '양식명(코드)' },
        { text: '  문서번호 : ' },
        { text: matched[2], label: '양식 문서번호' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
    };
  }

  for (const definition of PDF_SINGLE_COLON_VALUE_LABELS) {
    const singleColonMatch = text.match(definition.regex);

    if (singleColonMatch) {
      return {
        html: renderInlineSegments(text, [
          { text: definition.prefix },
          { text: singleColonMatch[1], label: definition.label, block: false },
        ]),
        nextSectionLabel: previousSectionLabel,
        nextPendingFieldLabel: null,
        newSectionAnchor: null,
      };
    }
  }

  matched = text.match(/^작\s*성\s*자\s+(.+)$/);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '작 성 자 ' },
        { text: matched[1], label: '작성자' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^문\s*서\s*번\s*호\s+(.+?)\s+발\s*급\s*일\s+(.+?)(?:\s+협력사승인일\s*(.*))?$/);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '문 서 번 호 ' },
        { text: matched[1], label: '문서번호' },
        { text: '  발 급 일 ' },
        { text: matched[2], label: '발급일' },
        { text: '  협력사승인일 ' },
        { text: matched[3] || ' ', label: '협력사승인일' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^프\s*로\s*젝\s*트\s+(.+?)\s+발\s*급\s*자\s+(.+)$/);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '프 로 젝 트 ' },
        { text: matched[1], label: '프로젝트' },
        { text: '  발 급 자 ' },
        { text: matched[2], label: '발급자' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^계\s*약\s+(.+?)\s+접\s*수\s*자\s+(.+)$/);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '계 약 ' },
        { text: matched[1], label: '계약' },
        { text: '  접 수 자 ' },
        { text: matched[2], label: '접수자' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^제\s*목\s+(.+)$/);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '제 목 ' },
        { text: matched[1], label: '제목', block: true },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^CE\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: 'CE ' },
        { text: matched[1], label: 'CE 담당자' },
        { text: ' ' },
        { text: matched[2], label: 'CE 처리시각' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^PM\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: 'PM ' },
        { text: matched[1], label: 'PM 담당자' },
        { text: ' ' },
        { text: matched[2], label: 'PM 처리시각' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  matched = text.match(/^발급자 서명\s+(.+?)\s+(전자서명 완료)(?:\s+접수자 서명\s*(.*))?$/);
  if (matched) {
    return {
      html: renderInlineSegments(text, [
        { text: '발급자 서명 ' },
        { text: matched[1], label: '발급자 서명자' },
        { text: ' ' },
        { text: matched[2], label: '전자서명 상태' },
        { text: ' 접수자 서명 ' },
        { text: matched[3] || ' ', label: '접수자 서명' },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
    };
  }

  if (pendingFieldLabel) {
    if (pendingFieldLabel.startsWith('SECTION_HEADING::')) {
      const sectionLabel = pendingFieldLabel.replace('SECTION_HEADING::', '');
      return {
        html: escapeHtml(text),
        nextSectionLabel: sectionLabel,
        nextPendingFieldLabel: null,
        newSectionAnchor: { label: sectionLabel, x: line.x, y: line.y },
      };
    }

    const shouldStopPending =
      matchSectionDefinition(text) ||
      isStandaloneFieldLabel(text) ||
      /^\d+(?:-\d+)?\./.test(text) ||
      PDF_SINGLE_COLON_VALUE_LABELS.some((definition) => definition.regex.test(text));

    if (shouldStopPending) {
      // fall through and let the current line be parsed by its own rule.
    } else if (pendingFieldLabel === '발급자 서명자' && /전자서명 완료/.test(text)) {
      const signatureStatus = '전자서명 완료';
      const signerName = cleanupPdfValue(text.replace(signatureStatus, ''));

      return {
        html: renderInlineSegments(text, [
          { text: signerName || ' ', label: '발급자 서명자' },
          { text: ' ' },
          { text: signatureStatus, label: '전자서명 상태' },
        ]),
        nextSectionLabel: previousSectionLabel,
        nextPendingFieldLabel: null,
        newSectionAnchor: null,
      };
    } else if (!PDF_NEXT_LINE_VALUE_LABELS.has(text) && !PDF_INLINE_EMPTY_LABELS.has(text)) {
      return {
        html: renderInlineSegments(text, [{ text, label: pendingFieldLabel, block: true }]),
        nextSectionLabel: previousSectionLabel,
        nextPendingFieldLabel: PDF_MULTILINE_PENDING_FIELDS.has(pendingFieldLabel) ? pendingFieldLabel : null,
        newSectionAnchor: null,
      };
    }
  }

  const nextLineValueLabel = PDF_NEXT_LINE_VALUE_LABELS.get(text);
  if (nextLineValueLabel) {
    return {
      html: escapeHtml(text),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: nextLineValueLabel,
      newSectionAnchor: null,
    };
  }

  const inlineEmptyLabel = PDF_INLINE_EMPTY_LABELS.get(text);
  if (inlineEmptyLabel) {
    return {
      html: renderInlineSegments(text, [
        { text: `${text} ` },
        { text: ' ', label: inlineEmptyLabel, block: true },
      ]),
      nextSectionLabel: previousSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  const sectionMatch = matchSectionDefinition(text);
  if (sectionMatch) {
    const prefix = `${sectionMatch.number}. ${sectionMatch.label}`;

    if (sectionMatch.inlineValue) {
      return {
        html: renderInlineSegments(text, [
          { text: `${prefix} ` },
          { text: sectionMatch.inlineValue, label: sectionMatch.label, block: true },
        ]),
        nextSectionLabel: sectionMatch.label,
        nextPendingFieldLabel: null,
        newSectionAnchor: { label: sectionMatch.label, x: line.x, y: line.y },
      };
    }

    return {
      html: escapeHtml(prefix),
      nextSectionLabel: sectionMatch.label,
      nextPendingFieldLabel: null,
      newSectionAnchor: { label: sectionMatch.label, x: line.x, y: line.y },
    };
  }

  const partialSectionMatch = text.match(/^(\d+(?:-\d+)?)\.\s*(.+)$/);
  if (partialSectionMatch && nextLine) {
    const combinedSectionMatch = matchSectionDefinition(
      `${partialSectionMatch[1]}. ${normalizeWhitespace(`${partialSectionMatch[2]} ${nextLine.text}`)}`
    );

    if (combinedSectionMatch) {
      return {
        html: escapeHtml(text),
        nextSectionLabel: previousSectionLabel,
        nextPendingFieldLabel: `SECTION_HEADING::${combinedSectionMatch.label}`,
        newSectionAnchor: null,
      };
    }
  }

  const nextSectionMatch = nextLine ? matchSectionDefinition(normalizeWhitespace(nextLine.text)) : null;
  if (
    !previousSectionLabel &&
    nextSectionMatch &&
    line.x >= nextLine!.x + 60 &&
    Math.abs(line.y - nextLine!.y) <= 14
  ) {
    return {
      html: renderInlineSegments(text, [{ text, label: nextSectionMatch.label, block: true }]),
      nextSectionLabel: nextSectionMatch.label,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  const anchoredSectionLabel = findNearestSectionAnchor(line, sectionAnchors);
  const effectiveSectionLabel = anchoredSectionLabel || previousSectionLabel;

  if (isLikelyValueContinuation(line, effectiveSectionLabel)) {
    return {
      html: renderInlineSegments(text, [{ text, label: effectiveSectionLabel!, block: true }]),
      nextSectionLabel: effectiveSectionLabel,
      nextPendingFieldLabel: null,
      newSectionAnchor: null,
    };
  }

  return {
    html: escapeHtml(text),
    nextSectionLabel: null,
    nextPendingFieldLabel: null,
    newSectionAnchor: null,
  };
};

const buildAbsoluteCloneHtml = (sourceTitle: string, layout: TemplateExtractPdfLayoutModel) => {
  const pagesHtml = layout.pages
    .map((page) => {
      let activeSectionLabel: string | null = null;
      let pendingFieldLabel: string | null = null;
      let sectionAnchors: PdfSectionAnchor[] = [];
      const linesHtml = page.lines
        .map((line, index) => {
          const { html, nextSectionLabel, nextPendingFieldLabel, newSectionAnchor } = buildGenericLineHtml(
            line,
            activeSectionLabel,
            pendingFieldLabel,
            page.lines[index + 1] || null,
            sectionAnchors
          );
          activeSectionLabel = nextSectionLabel;
          pendingFieldLabel = nextPendingFieldLabel;
          if (newSectionAnchor) {
            sectionAnchors = [...sectionAnchors, newSectionAnchor].filter((anchor) => line.y - anchor.y <= 140);
          } else {
            sectionAnchors = sectionAnchors.filter((anchor) => line.y - anchor.y <= 140);
          }

          if (!html) {
            return '';
          }

          const top = Math.max(page.height - line.y - line.height, 0);

          return `      <div class="template-clone__pdf-line" data-page="${page.pageNumber}" data-line-index="${index}" style="left:${line.x.toFixed(
            2
          )}px;top:${top.toFixed(2)}px;width:${line.width.toFixed(2)}px;min-height:${Math.max(
            line.height,
            14
          ).toFixed(2)}px;">${html}</div>`;
        })
        .filter(Boolean)
        .join('\n');

      return `    <div class="template-clone__pdf-page" data-page="${page.pageNumber}" style="width:${page.width.toFixed(
        2
      )}px;height:${page.height.toFixed(2)}px;">\n${linesHtml}\n    </div>`;
    })
    .join('\n');

  return `<section data-template-extract-draft="true" data-template-clone="pdf-absolute">
  <div class="template-clone template-clone--pdf-absolute">
${buildAbsoluteCloneStyleHtml()}
${pagesHtml}
  </div>
</section>`;
};

const TemplateExtractSnapshotV08Layout = {
  buildCloneHtml(sourceTitle: string, rawText: string, layout?: TemplateExtractPdfLayoutModel | null) {
    if (layout?.pages?.length) {
      return buildAbsoluteCloneHtml(sourceTitle, layout);
    }

    const structured = parseStructuredWorkOrder(rawText);

    if (!structured) {
      return null;
    }

    return `<section data-template-extract-draft="true" data-template-clone="pdf-work-order">
  <div class="template-clone template-clone--pdf-work-order">
${buildCloneStyleHtml()}
    <h1>작업지시서</h1>
${buildMetadataHtml(structured.metadataFields)}
${buildStatusHtml(structured.statusLines)}
${buildSectionsHtml(structured.sections)}
${buildFooterHtml(structured.footerNotes)}
  </div>
</section>`;
  },
};

const execFileAsync = promisify(execFile);

const PDF_LAYOUT_EXTRACT_SCRIPT_V08 = `import Foundation
import PDFKit

let args = CommandLine.arguments

guard args.count >= 2 else {
  fputs("missing pdf path\\n", stderr)
  exit(2)
}

let pdfUrl = URL(fileURLWithPath: args[1])

guard let document = PDFDocument(url: pdfUrl) else {
  fputs("pdf open failed\\n", stderr)
  exit(3)
}

struct Line: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

struct PageModel: Codable {
  let pageNumber: Int
  let width: Double
  let height: Double
  let lines: [Line]
}

struct Output: Codable {
  let rawText: String
  let pages: [PageModel]
}

var rawPages: [String] = []
var pages: [PageModel] = []

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else {
    continue
  }

  let pageBounds = page.bounds(for: .mediaBox)
  let pageText = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  var extractedLines: [Line] = []

  if let selection = page.selection(for: pageBounds) {
    let lineSelections = selection.selectionsByLine()

    for lineSelection in lineSelections {
      let text = lineSelection.string?
        .replacingOccurrences(of: "\\r", with: "")
        .replacingOccurrences(of: "\\n", with: " ")
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

      if text.isEmpty {
        continue
      }

      let bounds = lineSelection.bounds(for: page)
      extractedLines.append(
        Line(
          text: text,
          x: Double(bounds.origin.x),
          y: Double(bounds.origin.y),
          width: Double(bounds.size.width),
          height: Double(bounds.size.height)
        )
      )
    }
  }

  if extractedLines.isEmpty && !pageText.isEmpty {
    let fallbackLines = pageText
      .components(separatedBy: .newlines)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    let lineHeight = max(Double(pageBounds.size.height) / Double(max(fallbackLines.count, 1)), 18)

    for (index, line) in fallbackLines.enumerated() {
      extractedLines.append(
        Line(
          text: line,
          x: 24,
          y: Double(pageBounds.size.height) - (Double(index + 1) * lineHeight),
          width: Double(pageBounds.size.width) - 48,
          height: lineHeight
        )
      )
    }
  }

  extractedLines.sort {
    if abs($0.y - $1.y) < 3 {
      return $0.x < $1.x
    }

    return $0.y > $1.y
  }

  if !pageText.isEmpty {
    rawPages.append(pageText)
  }

  pages.append(
    PageModel(
      pageNumber: pageIndex + 1,
      width: Double(pageBounds.size.width),
      height: Double(pageBounds.size.height),
      lines: extractedLines
    )
  )
}

let output = Output(
  rawText: rawPages.joined(separator: "\\n\\n"),
  pages: pages
)

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted]
let data = try encoder.encode(output)
print(String(data: data, encoding: .utf8) ?? "{}")
`;

const PDF_FALLBACK_LABELS_V08 = [
  '양식명(코드)', '문서번호', '양식 문서번호', '작성자', '발급일', '협력사승인일', '프로젝트', '발급자', '계약',
  '접수자', '제목', '공사 내용', '대표수량 및 단가', '하도급 대금', '공사착수일', '공사완료일', '검사의 방법',
  '검사의 시기', '대금 지급방법', '대금 지급시기', '원재료 지급시 조건', '공급원가 변동에 따른 하도급 대금의 조정',
  '특기사항', '첨부파일', '창업아이템명', '산출물', '직업', '기업(예정)명', '아이템 개요', '문제 인식', '실현 가능성',
  '성장전략', '팀 구성',
] as const;

const normalizeWhitespaceV08 = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeRegExpV08 = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePdfFallbackTextV08 = (value: string) => {
  const withLineBreaks = value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
  const labelPattern = new RegExp(
    `(${PDF_FALLBACK_LABELS_V08.map((label) => escapeRegExpV08(label)).join('|')})\\s*`,
    'g'
  );
  const marked = withLineBreaks.replace(labelPattern, '\n$1: ');

  return marked
    .split('\n')
    .map((line) => normalizeWhitespaceV08(line))
    .filter(Boolean)
    .join('\n');
};

const extractPdfLayoutV08 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractPdfLayoutModel> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-v08-'));
  const tempFilePath = join(tempDir, fileName || 'upload.pdf');
  const tempScriptPath = join(tempDir, 'extract-pdf-layout-v08.swift');

  try {
    await writeFile(tempFilePath, bytes);
    await writeFile(tempScriptPath, PDF_LAYOUT_EXTRACT_SCRIPT_V08);

    const { stdout } = await execFileAsync('swift', [tempScriptPath, tempFilePath], {
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'utf8',
      env: {
        ...process.env,
        TMPDIR: tempDir,
        SWIFT_MODULECACHE_PATH: tempDir,
        CLANG_MODULE_CACHE_PATH: tempDir,
      },
    });

    return JSON.parse(stdout) as TemplateExtractPdfLayoutModel;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const TemplateExtractSnapshotV08Service = {
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const layout = await extractPdfLayoutV08(fileName, bytes);
    const rawText = layout.rawText;
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    const clonedHtml = TemplateExtractSnapshotV08Layout.buildCloneHtml(sourceTitle, rawText, layout);

    if (clonedHtml) {
      return {
        sourceTitle,
        sourceKind: 'html',
        sourceContent: clonedHtml,
        originalFileName: fileName,
        originalMimeType: 'application/pdf',
      };
    }

    return {
      sourceTitle,
      sourceKind: 'text',
      sourceContent: normalizePdfFallbackTextV08(rawText),
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  },
};
