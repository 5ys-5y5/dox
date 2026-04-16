import type { TemplateExtractPdfLayoutModel, TemplateExtractPdfLine, TemplateExtractPdfPage } from '../lib/templateExtractDtos';
import { TemplateExtractPdfGeometryService } from './templateExtractPdfGeometryService';
import { TemplateExtractPdfHtmlCloneService } from './templateExtractPdfHtmlCloneService';

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

type SectionHeadingHint = {
  number: string;
  label: string;
  pageNumber: number;
  x: number;
  y: number;
  valueX: number | null;
  pageWidth: number;
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
    aliases: ['공급원가 변동에 따른 하도급 대금의 조정', '공급원가 변동에 따른 하도급 대금의 조정*'],
  },
  { canonical: '특기사항', aliases: ['특기사항'] },
  { canonical: '첨부파일', aliases: ['첨부파일'] },
];

const PDF_SECTION_START_REGEX = /\d+(?:-\d+)?\.\s*[가-힣A-Za-z(]/g;
const PAIR_TOP_TOLERANCE = 16;
const PAIR_MIN_GAP = 90;

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
        `^${alias
          .split(/\s+/)
          .map((part) => escapeRegExp(part))
          .join('\\s*')}(?:\\s+(.*))?$`
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

    sections.push({
      ...currentSection,
      valueLines: normalizedLines,
    });

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
      /^PM\s+/i.test(line) ||
      /서명/.test(line) ||
      /전자서명 완료/.test(line)
    ) {
      statusLines.push(line);
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

    matched = line.match(/^발급자 서명\s+(.+?)\s+(전자서명\s*(?:완료|대기|실패|미완료))(?:\s+접수자 서명\s*(.*))?$/);

    if (matched) {
      overview.issuerSignerName = cleanupPdfValue(matched[1]);
      overview.issuerSignatureStatus = cleanupPdfValue(matched[2]);
      overview.receiverSignerName = cleanupPdfValue(matched[3] || '');
    }
  }

  return overview;
};

const getFirstPage = (layout?: TemplateExtractPdfLayoutModel | null): TemplateExtractPdfPage | null =>
  layout?.pages?.[0] || null;

const getNormalizedPageLines = (page: TemplateExtractPdfPage | null): TemplateExtractPdfLine[] => {
  if (!page) {
    return [];
  }

  return [...page.lines]
    .map((line) => ({
      ...line,
      text: normalizeWhitespace(line.text),
    }))
    .filter((line) => line.text.length > 0)
    .sort((left, right) => {
      if (Math.abs(left.y - right.y) < 3) {
        return left.x - right.x;
      }

      return right.y - left.y;
    });
};

const isHeadingLine = (text: string) => Boolean(matchSectionDefinition(text));

const inferValueStartX = (pageLines: TemplateExtractPdfLine[], headingLine: TemplateExtractPdfLine) => {
  const sameBandCandidates = pageLines.filter(
    (line) =>
      line !== headingLine &&
      !isHeadingLine(line.text) &&
      line.x > headingLine.x + 24 &&
      Math.abs(line.y - headingLine.y) <= 24
  );

  const belowBandCandidates = pageLines.filter(
    (line) =>
      line !== headingLine &&
      !isHeadingLine(line.text) &&
      line.x > headingLine.x + 24 &&
      headingLine.y - line.y >= 0 &&
      headingLine.y - line.y <= 28
  );

  const candidate = [...sameBandCandidates, ...belowBandCandidates].sort((left, right) => left.x - right.x)[0];
  return candidate ? candidate.x : null;
};

const collectSectionHints = (layout: TemplateExtractPdfLayoutModel | null | undefined, sections: PdfSectionBlock[]) => {
  const page = getFirstPage(layout);
  const pageLines = getNormalizedPageLines(page);
  const hints = new Map<string, SectionHeadingHint>();

  if (!page) {
    return hints;
  }

  for (const section of sections) {
    const matchedLine = pageLines.find((line) => {
      const matchedSection = matchSectionDefinition(line.text);
      return matchedSection?.number === section.number && matchedSection.label === section.label;
    });

    if (!matchedLine) {
      continue;
    }

    hints.set(section.number, {
      number: section.number,
      label: section.label,
      pageNumber: page.pageNumber,
      x: matchedLine.x,
      y: matchedLine.y,
      valueX: inferValueStartX(pageLines, matchedLine),
      pageWidth: page.width,
    });
  }

  return hints;
};

const shouldPairSections = (left: SectionHeadingHint | null | undefined, right: SectionHeadingHint | null | undefined) => {
  if (!left || !right) {
    return false;
  }

  if (left.pageNumber !== right.pageNumber) {
    return false;
  }

  if (Math.abs(left.y - right.y) > PAIR_TOP_TOLERANCE) {
    return false;
  }

  return right.x - left.x >= PAIR_MIN_GAP;
};

const buildCloneStyleHtml = () => `    <style>
      .template-clone--pdf-form-v11 {
        width: 920px;
        margin: 0 auto;
        padding: 18px;
        background: #ffffff;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        line-height: 1.45;
      }

      .template-clone--pdf-form-v11 h1 {
        margin: 0 0 12px;
        text-align: center;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .template-clone--pdf-form-v11 table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 10px;
      }

      .template-clone--pdf-form-v11 th,
      .template-clone--pdf-form-v11 td {
        border: 1px solid #111827;
        padding: 6px 8px;
        font-size: 12px;
        vertical-align: top;
      }

      .template-clone--pdf-form-v11 th {
        background: #f8fafc;
        font-weight: 700;
        text-align: center;
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

      .template-clone__field-value,
      .template-clone__field-placeholder {
        min-height: 18px;
      }

      .template-clone__field-placeholder > span,
      .template-clone__value-line > span,
      .template-clone__value-item > span {
        display: inline-block;
        width: 100%;
        min-height: 14px;
        border-bottom: 1px solid #94a3b8;
      }

      .template-clone__section-table .template-clone__section-heading {
        text-align: left;
        white-space: pre-wrap;
        font-weight: 700;
        background: #f8fafc;
      }

      .template-clone__section-table td {
        padding: 0;
      }

      .template-clone__value-line,
      .template-clone__value-item {
        min-height: 27px;
        margin: 0;
        padding: 6px 8px;
        border-bottom: 1px solid #e2e8f0;
      }

      .template-clone__section-table tr:last-child .template-clone__value-line:last-child,
      .template-clone__section-table tr:last-child .template-clone__value-item:last-child {
        border-bottom: 0;
      }

      .template-clone__value-item::before {
        content: "• ";
      }

      .template-clone__section-label-stack {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .template-clone__footer-table td {
        font-size: 11px;
      }
    </style>`;

const buildMetadataHtml = (metadataFields: PdfMetadataField[]) => {
  const metadataByLabel = new Map(metadataFields.map((field) => [field.label, field.value]));

  const fieldValue = (label: string) => metadataByLabel.get(label) || '';

  return `    <table class="template-clone__meta-table">
      <colgroup>
        <col style="width: 11%">
        <col style="width: 17%">
        <col style="width: 11%">
        <col style="width: 17%">
        <col style="width: 11%">
        <col style="width: 11%">
        <col style="width: 11%">
        <col style="width: 11%">
      </colgroup>
      <tbody>
      <tr>
        <th>양식명(코드)</th>
        <td><div class="template-clone__field-value" data-template-value="양식명(코드)">${escapeHtml(fieldValue('양식명(코드)'))}</div></td>
        <th>양식 문서번호</th>
        <td><div class="template-clone__field-value" data-template-value="양식 문서번호">${escapeHtml(fieldValue('양식 문서번호'))}</div></td>
        <td colspan="4"></td>
      </tr>
      <tr>
        <th>작성자</th>
        <td><div class="template-clone__field-value" data-template-value="작성자">${escapeHtml(fieldValue('작성자'))}</div></td>
        <th>문서번호</th>
        <td><div class="template-clone__field-value" data-template-value="문서번호">${escapeHtml(fieldValue('문서번호'))}</div></td>
        <th>발급일</th>
        <td><div class="template-clone__field-value" data-template-value="발급일">${escapeHtml(fieldValue('발급일'))}</div></td>
        <th>협력사승인일</th>
        <td><div class="template-clone__field-value" data-template-value="협력사승인일">${escapeHtml(fieldValue('협력사승인일'))}</div></td>
      </tr>
      <tr>
        <th>프로젝트</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="프로젝트">${escapeHtml(fieldValue('프로젝트'))}</div></td>
        <th>발급자</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="발급자">${escapeHtml(fieldValue('발급자'))}</div></td>
      </tr>
      <tr>
        <th>계약</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="계약">${escapeHtml(fieldValue('계약'))}</div></td>
        <th>접수자</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="접수자">${escapeHtml(fieldValue('접수자'))}</div></td>
      </tr>
      <tr>
        <th>제목</th>
        <td colspan="7"><div class="template-clone__field-value" data-template-value="제목">${escapeHtml(fieldValue('제목'))}</div></td>
      </tr>
      </tbody>
    </table>`;
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
        <td><div class="template-clone__field-value" data-template-value="CE 담당자">${escapeHtml(overview.ceName)}</div></td>
        <th>CE 처리시각</th>
        <td><div class="template-clone__field-value" data-template-value="CE 처리시각">${escapeHtml(overview.ceProcessedAt)}</div></td>
        <td colspan="2"></td>
      </tr>
      <tr>
        <th>PM 담당자</th>
        <td><div class="template-clone__field-value" data-template-value="PM 담당자">${escapeHtml(overview.pmName)}</div></td>
        <th>PM 처리시각</th>
        <td><div class="template-clone__field-value" data-template-value="PM 처리시각">${escapeHtml(overview.pmProcessedAt)}</div></td>
        <th>접수자 서명</th>
        <td><div class="template-clone__field-value" data-template-value="접수자 서명">${escapeHtml(overview.receiverSignerName)}</div></td>
      </tr>
      <tr>
        <th>발급자 서명</th>
        <td><div class="template-clone__field-value" data-template-value="발급자 서명자">${escapeHtml(overview.issuerSignerName)}</div></td>
        <th>전자서명 상태</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="전자서명 상태">${escapeHtml(overview.issuerSignatureStatus)}</div></td>
      </tr>
      </tbody>
    </table>`;
};

const buildSectionHeadingHtml = (section: PdfSectionBlock) => {
  if (section.label === '공급원가 변동에 따른 하도급 대금의 조정') {
    return `<div class="template-clone__section-label-stack">
      <span>${escapeHtml(`${section.number}. 공급원가 변동에 따른`)}</span>
      <span>${escapeHtml('하도급 대금의 조정')}</span>
    </div>`;
  }

  return escapeHtml(`${section.number}. ${section.label}`);
};

const buildSectionValueCell = (section: PdfSectionBlock, valueLine: string) => {
  if (section.asList) {
    return `<p class="template-clone__value-item" data-template-value="${escapeHtml(section.label)}">${escapeHtml(valueLine)}</p>`;
  }

  return `<p class="template-clone__value-line" data-template-value="${escapeHtml(section.label)}">${escapeHtml(valueLine)}</p>`;
};

const buildSingleSectionTable = (section: PdfSectionBlock, hint: SectionHeadingHint | null | undefined) => {
  const pageWidth = hint?.pageWidth || 595;
  const marginLeft = 30;
  const marginRight = pageWidth - 30;
  const headingWidthPx = Math.max((hint?.valueX || 150) - marginLeft, 140);
  const valueWidthPx = Math.max(marginRight - (hint?.valueX || 150), 260);
  const total = headingWidthPx + valueWidthPx;
  const headingWidth = ((headingWidthPx / total) * 100).toFixed(2);
  const valueWidth = ((valueWidthPx / total) * 100).toFixed(2);
  const valueLines = section.valueLines.length > 0 ? section.valueLines : [''];

  const rows = valueLines
    .map((line, index) => {
      const headingCell =
        index === 0
          ? `<td class="template-clone__section-heading" rowspan="${valueLines.length}">${buildSectionHeadingHtml(section)}</td>`
          : '';

      return `      <tr>
${headingCell}
        <td>${buildSectionValueCell(section, line)}</td>
      </tr>`;
    })
    .join('\n');

  return `    <table class="template-clone__section-table template-clone__section-table--single">
      <colgroup>
        <col style="width: ${headingWidth}%">
        <col style="width: ${valueWidth}%">
      </colgroup>
      <tbody>
${rows}
      </tbody>
    </table>`;
};

const buildPairedSectionTable = (
  leftSection: PdfSectionBlock,
  rightSection: PdfSectionBlock,
  leftHint: SectionHeadingHint | null | undefined,
  rightHint: SectionHeadingHint | null | undefined
) => {
  const pageWidth = leftHint?.pageWidth || rightHint?.pageWidth || 595;
  const marginLeft = Math.min(leftHint?.x || 36, 42);
  const contentRight = pageWidth - marginLeft;
  const leftValueStart = leftHint?.valueX || leftHint?.x || 158;
  const rightHeadingStart = rightHint?.x || pageWidth * 0.52;
  const rightValueStart = rightHint?.valueX || Math.max(rightHeadingStart + 90, pageWidth * 0.68);

  const widths = [
    Math.max(leftValueStart - marginLeft, 90),
    Math.max(rightHeadingStart - leftValueStart, 120),
    Math.max(rightValueStart - rightHeadingStart, 85),
    Math.max(contentRight - rightValueStart, 110),
  ];
  const total = widths.reduce((sum, value) => sum + value, 0);
  const valueLinesLeft = leftSection.valueLines.length > 0 ? leftSection.valueLines : [''];
  const valueLinesRight = rightSection.valueLines.length > 0 ? rightSection.valueLines : [''];
  const rowCount = Math.max(valueLinesLeft.length, valueLinesRight.length);

  const rows = Array.from({ length: rowCount })
    .map((_, index) => {
      const leftHeadingCell =
        index === 0
          ? `<td class="template-clone__section-heading" rowspan="${valueLinesLeft.length}">${buildSectionHeadingHtml(leftSection)}</td>`
          : '';
      const rightHeadingCell =
        index === 0
          ? `<td class="template-clone__section-heading" rowspan="${valueLinesRight.length}">${buildSectionHeadingHtml(rightSection)}</td>`
          : '';
      const leftLine = valueLinesLeft[index] || '';
      const rightLine = valueLinesRight[index] || '';
      const leftValueCell =
        index < valueLinesLeft.length
          ? `<td>${buildSectionValueCell(leftSection, leftLine)}</td>`
          : `<td></td>`;
      const rightHeadingPlaceholder =
        index >= valueLinesRight.length && index !== 0 ? '<td class="template-clone__section-heading template-clone__section-heading--empty"></td>' : '';
      const rightValueCell =
        index < valueLinesRight.length
          ? `<td>${buildSectionValueCell(rightSection, rightLine)}</td>`
          : '<td></td>';
      const leftHeadingPlaceholder =
        index >= valueLinesLeft.length && index !== 0 ? '<td class="template-clone__section-heading template-clone__section-heading--empty"></td>' : '';

      return `      <tr>
${leftHeadingCell || leftHeadingPlaceholder}
        ${leftValueCell}
${rightHeadingCell || rightHeadingPlaceholder}
        ${rightValueCell}
      </tr>`;
    })
    .join('\n');

  return `    <table class="template-clone__section-table template-clone__section-table--pair">
      <colgroup>
        <col style="width: ${((widths[0] / total) * 100).toFixed(2)}%">
        <col style="width: ${((widths[1] / total) * 100).toFixed(2)}%">
        <col style="width: ${((widths[2] / total) * 100).toFixed(2)}%">
        <col style="width: ${((widths[3] / total) * 100).toFixed(2)}%">
      </colgroup>
      <tbody>
${rows}
      </tbody>
    </table>`;
};

const buildSectionsHtml = (sections: PdfSectionBlock[], layout?: TemplateExtractPdfLayoutModel | null) => {
  const hints = collectSectionHints(layout, sections);
  const htmlParts: string[] = [];

  for (let index = 0; index < sections.length; index += 1) {
    const current = sections[index];
    const next = sections[index + 1];
    const currentHint = hints.get(current.number);
    const nextHint = next ? hints.get(next.number) : null;

    if (next && shouldPairSections(currentHint, nextHint)) {
      htmlParts.push(buildPairedSectionTable(current, next, currentHint, nextHint));
      index += 1;
      continue;
    }

    htmlParts.push(buildSingleSectionTable(current, currentHint));
  }

  return htmlParts.join('\n');
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

const buildStructuredCloneHtml = (structured: StructuredWorkOrder, layout?: TemplateExtractPdfLayoutModel | null) => `<section data-template-extract-draft="true" data-template-clone="pdf-form-v11">
  <div class="template-clone template-clone--pdf-form-v11">
${buildCloneStyleHtml()}
    <h1>작업지시서</h1>
${buildMetadataHtml(structured.metadataFields)}
${buildStatusHtml(structured.statusLines)}
${buildSectionsHtml(structured.sections, layout)}
${buildFooterHtml(structured.footerNotes)}
  </div>
</section>`;

export const TemplateExtractPdfLayoutService = {
  // BUILDHTML-PDF-11
  // current 경로는 v10의 form clone을 유지하되,
  // section table 첫 줄이 row-fallback 으로 inline placeholder 가 되는 문제와
  // 병렬 섹션의 짧은 오른쪽 값이 과도하게 반복되는 문제를 줄입니다.
  buildCloneHtml(sourceTitle: string, rawText: string, layout?: TemplateExtractPdfLayoutModel | null) {
    const structured = parseStructuredWorkOrder(rawText);

    if (structured) {
      return buildStructuredCloneHtml(structured, layout);
    }

    if (!layout || layout.pages.length === 0) {
      return null;
    }

    return TemplateExtractPdfHtmlCloneService.buildCloneHtml(
      sourceTitle,
      TemplateExtractPdfGeometryService.buildGeometry(layout)
    );
  },
};
