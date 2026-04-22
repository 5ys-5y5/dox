import type { TemplateExtractPdfLayoutModel, TemplateExtractPdfLine, TemplateExtractPdfPage } from '../lib/templateExtractDtos';
import { TemplateExtractPdfGeometryService } from './templateExtractPdfGeometryService';
import { TemplateExtractPdfHtmlCloneService } from './templateExtractPdfHtmlCloneService';

type PdfLabelDefinition = {
  canonical: string;
  aliases: string[];
};

type PdfMetadataField = {
  label: string;
  displayLabel: string;
  value: string;
};

type PdfSectionBlock = {
  number: string;
  label: string;
  displayLabel: string;
  valueLines: string[];
  asList: boolean;
};

type MatchedPdfSectionDefinition = {
  number: string;
  label: string;
  displayLabel: string;
  inlineValue: string;
};

type StructuredWorkOrder = {
  statusLines: string[];
  metadataFields: PdfMetadataField[];
  sections: PdfSectionBlock[];
  footerNotes: string[];
};

type ParsedStatusActor = {
  role: string;
  name: string;
  processedAt: string;
};

type ParsedStatusOverview = {
  actors: ParsedStatusActor[];
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

type WorkOrderGridMetrics = {
  pageWidth: number;
  pageHeight: number;
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  outerLeft: number;
  outerRight: number;
  topRow: [number, number];
  statusRow: [number, number, number];
  writerRow: [number, number];
  docIssueRow: [number, number, number];
  projectRow: [number, number];
  contractRow: [number, number];
  signatureRow: [number, number];
  titleRow: [number, number];
  bodySingle: [number, number];
  bodyPair: [number, number, number, number];
};

const PDF_SECTION_DEFINITIONS: PdfLabelDefinition[] = [
  { canonical: '공사 내용', aliases: ['공 사 내 용', '공사 내용', '공사내용'] },
  { canonical: '대표수량 및 단가', aliases: ['대표수량 및 단가', '대표수량, 단가 등', '대표수량 단가 등'] },
  {
    canonical: '하도급 대금 연동에 관한 사항',
    aliases: ['하도급 대금 연동에 관한 사항', '하도급대금 연동에 관한 사항'],
  },
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
  { canonical: '특기사항', aliases: ['특기사항', '기타'] },
  { canonical: '첨부파일', aliases: ['첨부파일'] },
];

const PDF_SECTION_START_REGEX = /\d+(?:-\d+)?\.\s*[가-힣A-Za-z(]/g;
const PAIR_TOP_TOLERANCE = 16;
const PAIR_MIN_GAP = 90;
const STATUS_ACTOR_LINE_REGEX = /^([A-Z][A-Z0-9]{1,4})\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i;
const FOOTER_NOTE_REGEX = /^[○※]/;

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

const isStatusActorLine = (line: string) => STATUS_ACTOR_LINE_REGEX.test(line);

const splitPdfLines = (rawText: string) =>
  rawText
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+(?=\d+(?:-\d+)?\.\s*[가-힣A-Za-z(])/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line && !/^---PAGE\s+\d+---$/i.test(line) && !/^-+\d+-+$/.test(line));

const cleanupSectionDisplayLabel = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/\s*:\s*$/, '')
  );

const getSectionMatchScore = (match: MatchedPdfSectionDefinition | null) =>
  match ? match.displayLabel.replace(/\s+/g, '').length : -1;

const matchSectionDefinition = (line: string): MatchedPdfSectionDefinition | null => {
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
        const inlineValue = cleanupPdfValue(matched[1] || '');
        const displayLabel = cleanupSectionDisplayLabel(
          inlineValue ? remainder.slice(0, Math.max(0, remainder.length - matched[1].length)).trim() : remainder
        );

        return {
          number,
          label: definition.canonical,
          displayLabel,
          inlineValue,
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

    const currentMatch = matchSectionDefinition(current);

    if (!/^\d+(?:-\d+)?\.\s*/.test(current)) {
      merged.push(current);
      continue;
    }

    const combined = normalizeWhitespace(`${current} ${next}`);
    const combinedMatch = matchSectionDefinition(combined);

    if (combinedMatch && getSectionMatchScore(combinedMatch) > getSectionMatchScore(currentMatch)) {
      merged.push(combined);
      index += 1;
      continue;
    }

    if (currentMatch) {
      merged.push(current);
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
  const pushField = (label: string, displayLabel: string, value: string) => {
    const cleanedValue = cleanupPdfValue(value);

    if (!cleanedValue) {
      return;
    }

    metadataFields.push({
      label,
      displayLabel,
      value: cleanedValue,
    });
  };

  let matched = line.match(/^양식명\(코드\)\s*:\s*(.+?)\s+문서번호\s*:\s*(.+)$/);

  if (matched) {
    pushField('양식명(코드)', '양식명(코드)', matched[1]);
    pushField('양식 문서번호', '양식 문서번호', matched[2]);
    return true;
  }

  matched = line.match(/^작\s*성\s*자\s+(.+)$/);

  if (matched) {
    pushField('작성자', '작 성 자', matched[1]);
    return true;
  }

  matched = line.match(/^문\s*서\s*번\s*호\s+(.+?)\s+발\s*급\s*일\s+(.+?)(?:\s+협력사승인일\s*(.*))?$/);

  if (matched) {
    pushField('문서번호', '문 서 번 호', matched[1]);
    pushField('발급일', '발 급 일', matched[2]);
    if (matched[3]) {
      pushField('협력사승인일', '협력사승인일', matched[3]);
    }
    return true;
  }

  matched = line.match(/^프\s*로\s*젝\s*트\s+(.+?)\s+발\s*급\s*자\s+(.+)$/);

  if (matched) {
    pushField('프로젝트', '프 로 젝 트', matched[1]);
    pushField('발급자', '발 급 자', matched[2]);
    return true;
  }

  matched = line.match(/^계\s*약\s+(.+?)\s+접\s*수\s*자\s+(.+)$/);

  if (matched) {
    pushField('계약', '계 약', matched[1]);
    pushField('접수자', '접 수 자', matched[2]);
    return true;
  }

  matched = line.match(/^제\s*목\s+(.+)$/);

  if (matched) {
    pushField('제목', '제 목', matched[1]);
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
        displayLabel: sectionMatch.displayLabel,
        valueLines: sectionMatch.inlineValue ? [sectionMatch.inlineValue] : [],
        asList: sectionMatch.label === '첨부파일',
      };
      continue;
    }

    if (currentSection) {
      if (currentSection.label === '첨부파일' && FOOTER_NOTE_REGEX.test(line)) {
        footerNotes.push(line);
        continue;
      }

      if (currentSection.label === '첨부파일' && footerNotes.length > 0 && !matchSectionDefinition(line)) {
        footerNotes[footerNotes.length - 1] = `${footerNotes[footerNotes.length - 1]} ${cleanupPdfValue(line)}`.trim();
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
      isStatusActorLine(line) ||
      /서명/.test(line) ||
      /전자서명 완료/.test(line)
    ) {
      statusLines.push(line);
      continue;
    }

    if (FOOTER_NOTE_REGEX.test(line)) {
      footerNotes.push(line);
      continue;
    }

    if (footerNotes.length > 0) {
      footerNotes[footerNotes.length - 1] = `${footerNotes[footerNotes.length - 1]} ${cleanupPdfValue(line)}`.trim();
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
    actors: [],
    issuerSignerName: '',
    issuerSignatureStatus: '',
    receiverSignerName: '',
  };

  for (const line of statusLines) {
    let matched = line.match(STATUS_ACTOR_LINE_REGEX);

    if (matched) {
      const role = cleanupPdfValue(matched[1]).toUpperCase();
      const name = cleanupPdfValue(matched[2]);
      const processedAt = cleanupPdfValue(matched[3]);
      const existingIndex = overview.actors.findIndex((actor) => actor.role === role);
      const actor = { role, name, processedAt };

      if (existingIndex >= 0) {
        overview.actors[existingIndex] = actor;
      } else {
        overview.actors.push(actor);
      }
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

const toReplicaPageTop = (page: TemplateExtractPdfPage, line: TemplateExtractPdfLine) =>
  Math.max(0, Number((page.height - line.y - line.height).toFixed(2)));

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

const clampMetric = (value: number, fallback: number) => (Number.isFinite(value) && value > 8 ? value : fallback);

const findLineX = (pageLines: TemplateExtractPdfLine[], pattern: RegExp) =>
  pageLines.find((line) => pattern.test(line.text))?.x ?? null;

const findValueStartForLabel = (pageLines: TemplateExtractPdfLine[], pattern: RegExp) => {
  const labelLine = pageLines.find((line) => pattern.test(line.text));

  if (!labelLine) {
    return null;
  }

  const candidates = pageLines
    .filter(
      (line) =>
        line !== labelLine &&
        line.x > labelLine.x + 20 &&
        Math.abs(line.y - labelLine.y) <= 8
    )
    .sort((left, right) => left.x - right.x);

  return candidates[0]?.x ?? null;
};

const toPercentages = (segments: number[]) => {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment, 1), 0);
  return segments.map((segment) => Number(((Math.max(segment, 1) / total) * 100).toFixed(2)));
};

const buildWorkOrderGridMetrics = (layout?: TemplateExtractPdfLayoutModel | null): WorkOrderGridMetrics | null => {
  const page = getFirstPage(layout);
  const pageLines = getNormalizedPageLines(page);

  if (!page || pageLines.length === 0) {
    return null;
  }

  const outerLeft = Math.min(...pageLines.map((line) => line.x));
  const outerRight = Math.max(...pageLines.map((line) => line.x + line.width));
  const metaValue1X = clampMetric(findValueStartForLabel(pageLines, /^작\s*성\s*자/) ?? 108, 108);
  const metaLabel2X = clampMetric(findLineX(pageLines, /^발\s*급\s*일/) ?? 218, 218);
  const metaValue2X = clampMetric(findValueStartForLabel(pageLines, /^발\s*급\s*일/) ?? 287, 287);
  const metaLabel3X = clampMetric(
    findLineX(pageLines, /^협력사승인일/) ?? findLineX(pageLines, /^발\s*급\s*자/) ?? 392,
    392
  );
  const metaValue3X = clampMetric(findValueStartForLabel(pageLines, /^발\s*급\s*자/) ?? 466, 466);
  const topDocLabelX = clampMetric(findLineX(pageLines, /^문서번호\s*:/) ?? 463, 463);
  const statusOptionsX = clampMetric(findLineX(pageLines, /^신규\s*재발급/) ?? 122, 122);
  const statusActorX = clampMetric(findLineX(pageLines, /^(?:CAE|CE|CAM|PM)\b/i) ?? 265, 265);
  const signatureRightLabelX = clampMetric(findLineX(pageLines, /^접수자\s*서명/) ?? 306, 306);
  const titleValueX = clampMetric(findValueStartForLabel(pageLines, /^제\s*목/) ?? 108, 108);
  const bodyValueX = clampMetric(findValueStartForLabel(pageLines, /^1\.\s*공/) ?? 158, 158);
  const bodyRightLabelX = clampMetric(findLineX(pageLines, /^1-2\./) ?? findLineX(pageLines, /^2-1\./) ?? 313, 313);
  const bodyRightValueX = clampMetric(
    findValueStartForLabel(pageLines, /^1-2\./) ?? findValueStartForLabel(pageLines, /^2-1\./) ?? 414,
    414
  );
  const contentTop = Math.min(...pageLines.map((line) => toReplicaPageTop(page, line)));
  const contentWidth = Math.max(1, outerRight - outerLeft);

  return {
    pageWidth: page.width,
    pageHeight: page.height,
    contentLeft: outerLeft,
    contentTop,
    contentWidth,
    outerLeft,
    outerRight,
    topRow: toPercentages([topDocLabelX - outerLeft, outerRight - topDocLabelX]) as [number, number],
    statusRow: toPercentages([statusOptionsX - outerLeft, statusActorX - statusOptionsX, outerRight - statusActorX]) as [
      number,
      number,
      number,
    ],
    writerRow: toPercentages([
      metaLabel2X - outerLeft,
      outerRight - metaLabel2X,
    ]) as [number, number],
    docIssueRow: toPercentages([
      metaLabel2X - outerLeft,
      metaLabel3X - metaLabel2X,
      outerRight - metaLabel3X,
    ]) as [number, number, number],
    projectRow: toPercentages([
      metaLabel3X - outerLeft,
      outerRight - metaLabel3X,
    ]) as [number, number],
    contractRow: toPercentages([
      metaLabel3X - outerLeft,
      outerRight - metaLabel3X,
    ]) as [number, number],
    signatureRow: toPercentages([
      signatureRightLabelX - outerLeft,
      outerRight - signatureRightLabelX,
    ]) as [number, number],
    titleRow: toPercentages([titleValueX - outerLeft, outerRight - titleValueX]) as [number, number],
    bodySingle: toPercentages([bodyValueX - outerLeft, outerRight - bodyValueX]) as [number, number],
    bodyPair: toPercentages([
      bodyValueX - outerLeft,
      bodyRightLabelX - bodyValueX,
      bodyRightValueX - bodyRightLabelX,
      outerRight - bodyRightValueX,
    ]) as [number, number, number, number],
  };
};

const buildCloneStyleHtml = (version: '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '23') => {
  if (version === '23') {
    return `    <style>
      .template-clone--pdf-form-v23 {
        width: fit-content;
        margin: 0 auto;
        background: transparent;
        color: #111827;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        line-height: 1.2;
      }

      .template-clone__pdf-semantic-page {
        position: relative;
        margin: 0 auto 16px;
        background: #ffffff;
        overflow: hidden;
        box-sizing: border-box;
      }

      .template-clone__pdf-semantic-flow {
        position: absolute;
      }

      .template-clone__workorder-grid {
        width: 100%;
        margin: 0;
      }

      .template-clone__grid-block {
        display: grid;
        border-left: 1px solid #111827;
      }

      .template-clone__grid-block + .template-clone__grid-block {
        margin-top: -1px;
      }

      .template-clone__grid-cell {
        border-top: 1px solid #111827;
        border-right: 1px solid #111827;
        border-bottom: 1px solid #111827;
        padding: 3px 4px;
        font-size: 11px;
        min-height: 18px;
        background: #ffffff;
        box-sizing: border-box;
        white-space: pre-wrap;
      }

      .template-clone__grid-cell--label,
      .template-clone__grid-cell--heading {
        font-weight: 700;
        background: #ffffff;
      }

      .template-clone__grid-cell--title {
        min-height: 22px;
      }

      .template-clone__grid-inline-label {
        font-weight: 700;
      }

      .template-clone__grid-inline-value > span,
      .template-clone__grid-inline-value[data-template-value],
      .template-clone__grid-multiline > span {
        display: inline-block;
        width: 100%;
        min-height: 12px;
      }

      .template-clone__grid-status-options {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .template-clone__grid-status-option-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .template-clone__check-option {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        white-space: nowrap;
      }
    </style>`;
  }

  return `    <style>
      .template-clone--pdf-form-v${version} {
        width: 920px;
        margin: 0 auto;
        padding: 18px;
        background: #ffffff;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        line-height: 1.45;
      }

      .template-clone--pdf-form-v${version} h1 {
        margin: 0 0 12px;
        text-align: center;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .template-clone--pdf-form-v${version} table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 10px;
      }

      .template-clone--pdf-form-v${version} th,
      .template-clone--pdf-form-v${version} td {
        border: 1px solid #111827;
        padding: 6px 8px;
        font-size: 12px;
        vertical-align: top;
      }

      .template-clone--pdf-form-v${version} th {
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

      .template-clone__section-table .template-clone__section-value-cell--rowspan {
        vertical-align: top;
      }

      .template-clone__master-table {
        margin-bottom: 10px;
      }

      .template-clone__master-table td {
        padding: 0;
      }

      .template-clone__master-table .template-clone__field-value {
        padding: 6px 8px;
      }

      .template-clone__master-table .template-clone__master-status-options {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 8px;
      }

      .template-clone__master-table .template-clone__status-option-row {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }

      .template-clone__master-table .template-clone__master-title-cell {
        padding: 6px 8px;
        min-height: 32px;
      }

      .template-clone__master-table .template-clone__master-body-label {
        text-align: left;
        white-space: pre-wrap;
        font-weight: 700;
        background: #f8fafc;
      }

      .template-clone__master-table .template-clone__master-body-value-cell {
        padding: 0;
      }

      .template-clone__workorder-grid {
        margin-bottom: 10px;
      }

      .template-clone__grid-block {
        display: grid;
        border-left: 1px solid #111827;
      }

      .template-clone__grid-block + .template-clone__grid-block {
        margin-top: -1px;
      }

      .template-clone__grid-cell {
        border-top: 1px solid #111827;
        border-right: 1px solid #111827;
        border-bottom: 1px solid #111827;
        padding: 6px 8px;
        font-size: 12px;
        min-height: 27px;
        background: #ffffff;
        box-sizing: border-box;
      }

      .template-clone__grid-cell--label {
        font-weight: 700;
        background: #f8fafc;
      }

      .template-clone__grid-cell--heading {
        font-weight: 700;
        background: #f8fafc;
        white-space: pre-wrap;
      }

      .template-clone__grid-cell--title {
        min-height: 34px;
      }

      .template-clone__grid-inline-label {
        font-weight: 700;
      }

      .template-clone__grid-inline-value > span,
      .template-clone__grid-inline-value[data-template-value],
      .template-clone__grid-multiline > span {
        display: inline-block;
        width: 100%;
        min-height: 14px;
      }

      .template-clone__grid-status-options {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .template-clone__grid-status-option-row {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }

      .template-clone__footer-table td {
        font-size: 11px;
      }
    </style>`;
};

const buildMetadataHtml = (metadataFields: PdfMetadataField[]) => {
  const metadataByLabel = new Map(metadataFields.map((field) => [field.label, field.value]));
  const metadataDisplayByLabel = new Map(metadataFields.map((field) => [field.label, field.displayLabel]));

  const fieldValue = (label: string) => metadataByLabel.get(label) || '';
  const displayLabel = (label: string, fallback: string) => metadataDisplayByLabel.get(label) || fallback;

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
        <th>${escapeHtml(displayLabel('양식명(코드)', '양식명(코드)'))}</th>
        <td><div class="template-clone__field-value" data-template-value="양식명(코드)">${escapeHtml(fieldValue('양식명(코드)'))}</div></td>
        <th>${escapeHtml(displayLabel('양식 문서번호', '양식 문서번호'))}</th>
        <td><div class="template-clone__field-value" data-template-value="양식 문서번호">${escapeHtml(fieldValue('양식 문서번호'))}</div></td>
        <td colspan="4"></td>
      </tr>
      <tr>
        <th>${escapeHtml(displayLabel('작성자', '작성자'))}</th>
        <td><div class="template-clone__field-value" data-template-value="작성자">${escapeHtml(fieldValue('작성자'))}</div></td>
        <th>${escapeHtml(displayLabel('문서번호', '문서번호'))}</th>
        <td><div class="template-clone__field-value" data-template-value="문서번호">${escapeHtml(fieldValue('문서번호'))}</div></td>
        <th>${escapeHtml(displayLabel('발급일', '발급일'))}</th>
        <td><div class="template-clone__field-value" data-template-value="발급일">${escapeHtml(fieldValue('발급일'))}</div></td>
        <th>${escapeHtml(displayLabel('협력사승인일', '협력사승인일'))}</th>
        <td><div class="template-clone__field-value" data-template-value="협력사승인일">${escapeHtml(fieldValue('협력사승인일'))}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(displayLabel('프로젝트', '프로젝트'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="프로젝트">${escapeHtml(fieldValue('프로젝트'))}</div></td>
        <th>${escapeHtml(displayLabel('발급자', '발급자'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="발급자">${escapeHtml(fieldValue('발급자'))}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(displayLabel('계약', '계약'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="계약">${escapeHtml(fieldValue('계약'))}</div></td>
        <th>${escapeHtml(displayLabel('접수자', '접수자'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="접수자">${escapeHtml(fieldValue('접수자'))}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(displayLabel('제목', '제목'))}</th>
        <td colspan="7"><div class="template-clone__field-value" data-template-value="제목">${escapeHtml(fieldValue('제목'))}</div></td>
      </tr>
      </tbody>
    </table>`;
};

const buildStatusHtml = (statusLines: string[]) => {
  const overview = parseStatusOverview(statusLines);
  const actors = overview.actors.length > 0 ? overview.actors : [{ role: 'CE', name: '', processedAt: '' }, { role: 'PM', name: '', processedAt: '' }];
  const actorRows = [];

  for (let index = 0; index < actors.length; index += 2) {
    const left = actors[index];
    const right = actors[index + 1];

    actorRows.push(`      <tr>
        <th>${escapeHtml(`${left.role} 담당자`)}</th>
        <td><div class="template-clone__field-value" data-template-value="${escapeHtml(`${left.role} 담당자`)}">${escapeHtml(left.name)}</div></td>
        <th>${escapeHtml(`${left.role} 처리시각`)}</th>
        <td><div class="template-clone__field-value" data-template-value="${escapeHtml(`${left.role} 처리시각`)}">${escapeHtml(left.processedAt)}</div></td>
        ${
          right
            ? `<th>${escapeHtml(`${right.role} 담당자`)}</th>
        <td><div class="template-clone__field-value" data-template-value="${escapeHtml(`${right.role} 담당자`)}">${escapeHtml(right.name)}</div></td>
        <th>${escapeHtml(`${right.role} 처리시각`)}</th>
        <td><div class="template-clone__field-value" data-template-value="${escapeHtml(`${right.role} 처리시각`)}">${escapeHtml(right.processedAt)}</div></td>`
            : `<th>접수자 서명</th>
        <td><div class="template-clone__field-value" data-template-value="접수자 서명">${escapeHtml(overview.receiverSignerName)}</div></td>
        <td colspan="2"></td>`
        }
      </tr>`);
  }

  if (actors.length % 2 === 0) {
    actorRows.push(`      <tr>
        <th>접수자 서명</th>
        <td><div class="template-clone__field-value" data-template-value="접수자 서명">${escapeHtml(overview.receiverSignerName)}</div></td>
        <td colspan="6"></td>
      </tr>`);
  }

  return `    <table class="template-clone__status-table">
      <colgroup>
        <col style="width: 10%">
        <col style="width: 15%">
        <col style="width: 10%">
        <col style="width: 15%">
        <col style="width: 10%">
        <col style="width: 15%">
        <col style="width: 10%">
        <col style="width: 15%">
      </colgroup>
      <tbody>
      <tr>
        <th>구 분</th>
        <td colspan="7">
          <div class="template-clone__status-options">
            <span class="template-clone__check-option">□ 신규</span>
            <span class="template-clone__check-option">□ 재발급</span>
            <span class="template-clone__check-option">□ Off-Line 등록</span>
          </div>
        </td>
      </tr>
${actorRows.join('\n')}
      <tr>
        <th>발급자 서명</th>
        <td><div class="template-clone__field-value" data-template-value="발급자 서명자">${escapeHtml(overview.issuerSignerName)}</div></td>
        <th>전자서명 상태</th>
        <td colspan="5"><div class="template-clone__field-value" data-template-value="전자서명 상태">${escapeHtml(overview.issuerSignatureStatus)}</div></td>
      </tr>
      </tbody>
    </table>`;
};

const buildSectionHeadingHtml = (section: PdfSectionBlock) => {
  if (section.displayLabel === '공급원가 변동에 따른 하도급 대금의 조정') {
    return `<div class="template-clone__section-label-stack">
      <span>${escapeHtml(`${section.number}. 공급원가 변동에 따른`)}</span>
      <span>${escapeHtml('하도급 대금의 조정')}</span>
    </div>`;
  }

  if (section.displayLabel === '하도급대금 연동에 관한 사항' || section.displayLabel === '하도급 대금 연동에 관한 사항') {
    return `<div class="template-clone__section-label-stack">
      <span>${escapeHtml(`${section.number}. 하도급 대금 연동에`)}</span>
      <span>${escapeHtml('관한 사항')}</span>
    </div>`;
  }

  return escapeHtml(`${section.number}. ${section.displayLabel}`);
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
  const leftSingleValue = valueLinesLeft.length === 1;
  const rightSingleValue = valueLinesRight.length === 1;

  const rows = Array.from({ length: rowCount })
    .map((_, index) => {
      const leftHeadingCell =
        index === 0
          ? `<td class="template-clone__section-heading" rowspan="${rowCount}">${buildSectionHeadingHtml(leftSection)}</td>`
          : '';
      const rightHeadingCell =
        index === 0
          ? `<td class="template-clone__section-heading" rowspan="${rowCount}">${buildSectionHeadingHtml(rightSection)}</td>`
          : '';
      const leftLine = valueLinesLeft[index] || '';
      const rightLine = valueLinesRight[index] || '';
      const leftValueCell =
        leftSingleValue
          ? index === 0
            ? `<td class="template-clone__section-value-cell--rowspan" rowspan="${rowCount}">${buildSectionValueCell(leftSection, leftLine)}</td>`
            : ''
          : index < valueLinesLeft.length
            ? `<td>${buildSectionValueCell(leftSection, leftLine)}</td>`
            : `<td></td>`;
      const rightValueCell =
        rightSingleValue
          ? index === 0
            ? `<td class="template-clone__section-value-cell--rowspan" rowspan="${rowCount}">${buildSectionValueCell(rightSection, rightLine)}</td>`
            : ''
          : index < valueLinesRight.length
            ? `<td>${buildSectionValueCell(rightSection, rightLine)}</td>`
          : `<td></td>`;

      return `      <tr>
${leftHeadingCell}
        ${leftValueCell}
${rightHeadingCell}
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

const getSectionByNumber = (sections: PdfSectionBlock[], number: string) =>
  sections.find((section) => section.number === number) || null;

const buildMasterValueCell = (section: PdfSectionBlock, valueLine: string) =>
  buildSectionValueCell(section, valueLine);

const buildMasterSingleSectionRows = (section: PdfSectionBlock, headingColspan = 2, valueColspan = 6) => {
  const valueLines = section.valueLines.length > 0 ? section.valueLines : [''];

  return valueLines
    .map((line, index) => {
      const headingCell =
        index === 0
          ? `<th class="template-clone__master-body-label" colspan="${headingColspan}" rowspan="${valueLines.length}">${buildSectionHeadingHtml(section)}</th>`
          : '';

      return `      <tr>
${headingCell}
        <td class="template-clone__master-body-value-cell" colspan="${valueColspan}">${buildMasterValueCell(section, line)}</td>
      </tr>`;
    })
    .join('\n');
};

const buildMasterPairSectionRows = (leftSection: PdfSectionBlock, rightSection: PdfSectionBlock) => {
  const leftLines = leftSection.valueLines.length > 0 ? leftSection.valueLines : [''];
  const rightLines = rightSection.valueLines.length > 0 ? rightSection.valueLines : [''];
  const rowCount = Math.max(leftLines.length, rightLines.length);
  const leftSingleValue = leftLines.length === 1;
  const rightSingleValue = rightLines.length === 1;

  return Array.from({ length: rowCount })
    .map((_, index) => {
      const leftHeadingCell =
        index === 0
          ? `<th class="template-clone__master-body-label" colspan="2" rowspan="${rowCount}">${buildSectionHeadingHtml(leftSection)}</th>`
          : '';
      const rightHeadingCell =
        index === 0
          ? `<th class="template-clone__master-body-label" colspan="2" rowspan="${rowCount}">${buildSectionHeadingHtml(rightSection)}</th>`
          : '';
      const leftValueCell =
        leftSingleValue
          ? index === 0
            ? `<td class="template-clone__master-body-value-cell" colspan="2" rowspan="${rowCount}">${buildMasterValueCell(leftSection, leftLines[0])}</td>`
            : ''
          : index < leftLines.length
            ? `<td class="template-clone__master-body-value-cell" colspan="2">${buildMasterValueCell(leftSection, leftLines[index])}</td>`
            : `<td colspan="2"></td>`;
      const rightValueCell =
        rightSingleValue
          ? index === 0
            ? `<td class="template-clone__master-body-value-cell" colspan="2" rowspan="${rowCount}">${buildMasterValueCell(rightSection, rightLines[0])}</td>`
            : ''
          : index < rightLines.length
            ? `<td class="template-clone__master-body-value-cell" colspan="2">${buildMasterValueCell(rightSection, rightLines[index])}</td>`
            : `<td colspan="2"></td>`;

      return `      <tr>
${leftHeadingCell}
        ${leftValueCell}
${rightHeadingCell}
        ${rightValueCell}
      </tr>`;
    })
    .join('\n');
};

const buildGridTemplate = (widths: number[]) => widths.map((width) => `${width.toFixed(2)}%`).join(' ');

const buildGridCell = (
  content: string,
  className: string,
  columnStart: number,
  columnSpan = 1,
  rowStart = 1,
  rowSpan = 1
) =>
  `<div class="template-clone__grid-cell ${className}" style="grid-column: ${columnStart} / span ${columnSpan}; grid-row: ${rowStart} / span ${rowSpan};">${content}</div>`;

const buildInlineValue = (dataKey: string, value: string) =>
  `<span class="template-clone__grid-inline-value" data-template-value="${escapeHtml(dataKey)}">${escapeHtml(value)}</span>`;

const buildInlineField = (displayLabel: string, dataKey: string, value: string, separator = ' ') =>
  `<span class="template-clone__grid-inline-label">${escapeHtml(displayLabel)}</span>${separator}${buildInlineValue(dataKey, value)}`;

const buildGridRowBlock = (widths: number[], cells: string[], extraClassName = '') =>
  `    <div class="template-clone__grid-block${extraClassName ? ` ${extraClassName}` : ''}" style="grid-template-columns: ${buildGridTemplate(widths)};">
${cells.join('\n')}
    </div>`;

const buildGridSingleSectionBlock = (widths: [number, number], section: PdfSectionBlock) => {
  const valueLines = section.valueLines.length > 0 ? section.valueLines : [''];
  const cells = [
    buildGridCell(buildSectionHeadingHtml(section), 'template-clone__grid-cell--heading', 1, 1, 1, valueLines.length),
    ...valueLines.map((line, index) =>
      buildGridCell(
        buildSectionValueCell(section, line),
        'template-clone__grid-cell--value',
        2,
        1,
        index + 1,
        1
      )
    ),
  ];

  return `    <div class="template-clone__grid-block" style="grid-template-columns: ${buildGridTemplate(widths)}; grid-template-rows: repeat(${valueLines.length}, minmax(28px, auto));">
${cells.join('\n')}
    </div>`;
};

const buildGridPairSectionBlock = (widths: [number, number, number, number], leftSection: PdfSectionBlock, rightSection: PdfSectionBlock) => {
  const leftLines = leftSection.valueLines.length > 0 ? leftSection.valueLines : [''];
  const rightLines = rightSection.valueLines.length > 0 ? rightSection.valueLines : [''];
  const rowCount = Math.max(leftLines.length, rightLines.length);
  const cells = [
    buildGridCell(buildSectionHeadingHtml(leftSection), 'template-clone__grid-cell--heading', 1, 1, 1, rowCount),
    buildGridCell(buildSectionHeadingHtml(rightSection), 'template-clone__grid-cell--heading', 3, 1, 1, rowCount),
  ];

  if (leftLines.length === 1) {
    cells.push(buildGridCell(buildSectionValueCell(leftSection, leftLines[0]), 'template-clone__grid-cell--value', 2, 1, 1, rowCount));
  } else {
    leftLines.forEach((line, index) => {
      cells.push(buildGridCell(buildSectionValueCell(leftSection, line), 'template-clone__grid-cell--value', 2, 1, index + 1, 1));
    });
  }

  if (rightLines.length === 1) {
    cells.push(buildGridCell(buildSectionValueCell(rightSection, rightLines[0]), 'template-clone__grid-cell--value', 4, 1, 1, rowCount));
  } else {
    rightLines.forEach((line, index) => {
      cells.push(buildGridCell(buildSectionValueCell(rightSection, line), 'template-clone__grid-cell--value', 4, 1, index + 1, 1));
    });
  }

  return `    <div class="template-clone__grid-block" style="grid-template-columns: ${buildGridTemplate(widths)}; grid-template-rows: repeat(${rowCount}, minmax(28px, auto));">
${cells.join('\n')}
    </div>`;
};

const buildWorkOrderGridHtmlV18 = (structured: StructuredWorkOrder, layout?: TemplateExtractPdfLayoutModel | null) => {
  const metrics = buildWorkOrderGridMetrics(layout);

  if (!metrics) {
    return buildUnifiedWorkOrderTableHtml(structured);
  }

  const metadataByLabel = new Map(structured.metadataFields.map((field) => [field.label, field]));
  const statusOverview = parseStatusOverview(structured.statusLines);
  const actorByRole = new Map(statusOverview.actors.map((actor) => [actor.role, actor]));
  const fieldValue = (label: string) => metadataByLabel.get(label)?.value || '';
  const fieldDisplay = (label: string, fallback: string) => metadataByLabel.get(label)?.displayLabel || fallback;
  const actorLine = (role: string) =>
    `${escapeHtml(role)} ${buildInlineValue(`${role} 담당자`, actorByRole.get(role)?.name || '')} ${buildInlineValue(
      `${role} 처리시각`,
      actorByRole.get(role)?.processedAt || ''
    )}`;
  const section1 = getSectionByNumber(structured.sections, '1');
  const section11 = getSectionByNumber(structured.sections, '1-1');
  const section12 = getSectionByNumber(structured.sections, '1-2');
  const section2 = getSectionByNumber(structured.sections, '2');
  const section21 = getSectionByNumber(structured.sections, '2-1');
  const section3 = getSectionByNumber(structured.sections, '3');
  const section31 = getSectionByNumber(structured.sections, '3-1');
  const section4 = getSectionByNumber(structured.sections, '4');
  const section41 = getSectionByNumber(structured.sections, '4-1');
  const section5 = getSectionByNumber(structured.sections, '5');
  const section6 = getSectionByNumber(structured.sections, '6');
  const section7 = getSectionByNumber(structured.sections, '7');
  const section8 = getSectionByNumber(structured.sections, '8');
  const section9 = getSectionByNumber(structured.sections, '9');

  const bodyBlocks = [
    section1 ? buildGridSingleSectionBlock(metrics.bodySingle, section1) : '',
    section11 && section12 ? buildGridPairSectionBlock(metrics.bodyPair, section11, section12) : '',
    section2 && section21 ? buildGridPairSectionBlock(metrics.bodyPair, section2, section21) : '',
    section3 && section31 ? buildGridPairSectionBlock(metrics.bodyPair, section3, section31) : '',
    section4 && section41 ? buildGridPairSectionBlock(metrics.bodyPair, section4, section41) : '',
    section5 ? buildGridSingleSectionBlock(metrics.bodySingle, section5) : '',
    section6 ? buildGridSingleSectionBlock(metrics.bodySingle, section6) : '',
    section7 ? buildGridSingleSectionBlock(metrics.bodySingle, section7) : '',
    section8 ? buildGridSingleSectionBlock(metrics.bodySingle, section8) : '',
    section9 ? buildGridSingleSectionBlock(metrics.bodySingle, section9) : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `    <div class="template-clone__workorder-grid">
${buildGridRowBlock(metrics.topRow, [
  buildGridCell(
    `${escapeHtml(fieldDisplay('양식명(코드)', '양식명(코드) :'))} : ${buildInlineValue('양식명(코드)', fieldValue('양식명(코드)'))}`,
    'template-clone__grid-cell--value',
    1
  ),
  buildGridCell(
    `문서번호 : ${buildInlineValue('양식 문서번호', fieldValue('양식 문서번호'))}`,
    'template-clone__grid-cell--value',
    2
  ),
])}
    <div class="template-clone__grid-block" style="grid-template-columns: ${buildGridTemplate(metrics.statusRow)}; grid-template-rows: repeat(4, minmax(28px, auto));">
${[
  buildGridCell('구 분', 'template-clone__grid-cell--label', 1, 1, 1, 4),
  buildGridCell(
    `<div class="template-clone__grid-status-options">
      <div class="template-clone__grid-status-option-row">
        <span class="template-clone__check-option">□ 신규</span>
        <span class="template-clone__check-option">□ 재발급</span>
      </div>
      <div class="template-clone__grid-status-option-row">
        <span class="template-clone__check-option">□ Off-Line등록</span>
      </div>
    </div>`,
    'template-clone__grid-cell--value',
    2,
    1,
    1,
    4
  ),
  buildGridCell(actorLine('CAE'), 'template-clone__grid-cell--value', 3, 1, 1, 1),
  buildGridCell(actorLine('CE'), 'template-clone__grid-cell--value', 3, 1, 2, 1),
  buildGridCell(actorLine('CAM'), 'template-clone__grid-cell--value', 3, 1, 3, 1),
  buildGridCell(actorLine('PM'), 'template-clone__grid-cell--value', 3, 1, 4, 1),
].join('\n')}
    </div>
${buildGridRowBlock(metrics.writerRow, [
  buildGridCell(buildInlineField(fieldDisplay('작성자', '작 성 자'), '작성자', fieldValue('작성자')), 'template-clone__grid-cell--value', 1),
  buildGridCell('', 'template-clone__grid-cell--value', 2),
])}
${buildGridRowBlock(metrics.docIssueRow, [
  buildGridCell(buildInlineField(fieldDisplay('문서번호', '문 서 번 호'), '문서번호', fieldValue('문서번호')), 'template-clone__grid-cell--value', 1),
  buildGridCell(buildInlineField(fieldDisplay('발급일', '발 급 일'), '발급일', fieldValue('발급일')), 'template-clone__grid-cell--value', 2),
  buildGridCell(buildInlineField(fieldDisplay('협력사승인일', '협력사승인일'), '협력사승인일', fieldValue('협력사승인일')), 'template-clone__grid-cell--value', 3),
])}
${buildGridRowBlock(metrics.projectRow, [
  buildGridCell(buildInlineField(fieldDisplay('프로젝트', '프 로 젝 트'), '프로젝트', fieldValue('프로젝트')), 'template-clone__grid-cell--value', 1),
  buildGridCell(buildInlineField(fieldDisplay('발급자', '발 급 자'), '발급자', fieldValue('발급자')), 'template-clone__grid-cell--value', 2),
])}
${buildGridRowBlock(metrics.contractRow, [
  buildGridCell(buildInlineField(fieldDisplay('계약', '계 약'), '계약', fieldValue('계약')), 'template-clone__grid-cell--value', 1),
  buildGridCell(buildInlineField(fieldDisplay('접수자', '접 수 자'), '접수자', fieldValue('접수자')), 'template-clone__grid-cell--value', 2),
])}
${buildGridRowBlock(metrics.signatureRow, [
  buildGridCell(
    `발급자 서명 ${buildInlineValue('발급자 서명자', statusOverview.issuerSignerName)} ${buildInlineValue('전자서명 상태', statusOverview.issuerSignatureStatus)}`,
    'template-clone__grid-cell--value',
    1
  ),
  buildGridCell(
    `접수자 서명 ${buildInlineValue('접수자 서명', statusOverview.receiverSignerName)}`,
    'template-clone__grid-cell--value',
    2
  ),
])}
${buildGridRowBlock(metrics.titleRow, [
  buildGridCell(escapeHtml(fieldDisplay('제목', '제 목')), 'template-clone__grid-cell--label', 1),
  buildGridCell(buildInlineValue('제목', fieldValue('제목')), 'template-clone__grid-cell--title', 2),
])}
${bodyBlocks}
${structured.footerNotes.length > 0 ? buildGridRowBlock([100], [
  buildGridCell(
    structured.footerNotes.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
    'template-clone__grid-cell--value',
    1
  ),
]) : ''}
    </div>`;
};

const buildUnifiedWorkOrderTableHtml = (structured: StructuredWorkOrder) => {
  const metadataByLabel = new Map(structured.metadataFields.map((field) => [field.label, field]));
  const statusOverview = parseStatusOverview(structured.statusLines);
  const actorByRole = new Map(statusOverview.actors.map((actor) => [actor.role, actor]));
  const section1 = getSectionByNumber(structured.sections, '1');
  const section11 = getSectionByNumber(structured.sections, '1-1');
  const section12 = getSectionByNumber(structured.sections, '1-2');
  const section2 = getSectionByNumber(structured.sections, '2');
  const section21 = getSectionByNumber(structured.sections, '2-1');
  const section3 = getSectionByNumber(structured.sections, '3');
  const section31 = getSectionByNumber(structured.sections, '3-1');
  const section4 = getSectionByNumber(structured.sections, '4');
  const section41 = getSectionByNumber(structured.sections, '4-1');
  const section5 = getSectionByNumber(structured.sections, '5');
  const section6 = getSectionByNumber(structured.sections, '6');
  const section7 = getSectionByNumber(structured.sections, '7');
  const section8 = getSectionByNumber(structured.sections, '8');
  const section9 = getSectionByNumber(structured.sections, '9');
  const fieldValue = (label: string) => metadataByLabel.get(label)?.value || '';
  const fieldDisplay = (label: string, fallback: string) => metadataByLabel.get(label)?.displayLabel || fallback;
  const actorName = (role: string) => actorByRole.get(role)?.name || '';
  const actorTime = (role: string) => actorByRole.get(role)?.processedAt || '';

  const bodyRows = [
    section1 ? buildMasterSingleSectionRows(section1, 2, 6) : '',
    section11 && section12 ? buildMasterPairSectionRows(section11, section12) : '',
    section2 && section21 ? buildMasterPairSectionRows(section2, section21) : '',
    section3 && section31 ? buildMasterPairSectionRows(section3, section31) : '',
    section4 && section41 ? buildMasterPairSectionRows(section4, section41) : '',
    section5 ? buildMasterSingleSectionRows(section5, 2, 6) : '',
    section6 ? buildMasterSingleSectionRows(section6, 2, 6) : '',
    section7 ? buildMasterSingleSectionRows(section7, 2, 6) : '',
    section8 ? buildMasterSingleSectionRows(section8, 2, 6) : '',
    section9 ? buildMasterSingleSectionRows(section9, 2, 6) : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `    <table class="template-clone__master-table">
      <colgroup>
        <col style="width: 12%">
        <col style="width: 13%">
        <col style="width: 12%">
        <col style="width: 13%">
        <col style="width: 12%">
        <col style="width: 13%">
        <col style="width: 12%">
        <col style="width: 13%">
      </colgroup>
      <tbody>
      <tr>
        <th colspan="2">${escapeHtml(fieldDisplay('양식명(코드)', '양식명(코드)'))}</th>
        <td colspan="4"><div class="template-clone__field-value" data-template-value="양식명(코드)">${escapeHtml(fieldValue('양식명(코드)'))}</div></td>
        <th>문서번호</th>
        <td><div class="template-clone__field-value" data-template-value="양식 문서번호">${escapeHtml(fieldValue('양식 문서번호'))}</div></td>
      </tr>
      <tr>
        <th rowspan="4">구 분</th>
        <td colspan="3" rowspan="4">
          <div class="template-clone__master-status-options">
            <div class="template-clone__status-option-row">
              <span class="template-clone__check-option">□ 신규</span>
              <span class="template-clone__check-option">□ 재발급</span>
            </div>
            <div class="template-clone__status-option-row">
              <span class="template-clone__check-option">□ Off-Line등록</span>
            </div>
          </div>
        </td>
        <th>CAE</th>
        <td><div class="template-clone__field-value" data-template-value="CAE 담당자">${escapeHtml(actorName('CAE'))}</div></td>
        <th>처리시각</th>
        <td><div class="template-clone__field-value" data-template-value="CAE 처리시각">${escapeHtml(actorTime('CAE'))}</div></td>
      </tr>
      <tr>
        <th>CE</th>
        <td><div class="template-clone__field-value" data-template-value="CE 담당자">${escapeHtml(actorName('CE'))}</div></td>
        <th>처리시각</th>
        <td><div class="template-clone__field-value" data-template-value="CE 처리시각">${escapeHtml(actorTime('CE'))}</div></td>
      </tr>
      <tr>
        <th>CAM</th>
        <td><div class="template-clone__field-value" data-template-value="CAM 담당자">${escapeHtml(actorName('CAM'))}</div></td>
        <th>처리시각</th>
        <td><div class="template-clone__field-value" data-template-value="CAM 처리시각">${escapeHtml(actorTime('CAM'))}</div></td>
      </tr>
      <tr>
        <th>PM</th>
        <td><div class="template-clone__field-value" data-template-value="PM 담당자">${escapeHtml(actorName('PM'))}</div></td>
        <th>처리시각</th>
        <td><div class="template-clone__field-value" data-template-value="PM 처리시각">${escapeHtml(actorTime('PM'))}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(fieldDisplay('작성자', '작 성 자'))}</th>
        <td><div class="template-clone__field-value" data-template-value="작성자">${escapeHtml(fieldValue('작성자'))}</div></td>
        <th>${escapeHtml(fieldDisplay('문서번호', '문 서 번 호'))}</th>
        <td><div class="template-clone__field-value" data-template-value="문서번호">${escapeHtml(fieldValue('문서번호'))}</div></td>
        <th>${escapeHtml(fieldDisplay('발급일', '발 급 일'))}</th>
        <td><div class="template-clone__field-value" data-template-value="발급일">${escapeHtml(fieldValue('발급일'))}</div></td>
        <th>${escapeHtml(fieldDisplay('협력사승인일', '협력사승인일'))}</th>
        <td><div class="template-clone__field-value" data-template-value="협력사승인일">${escapeHtml(fieldValue('협력사승인일'))}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(fieldDisplay('프로젝트', '프 로 젝 트'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="프로젝트">${escapeHtml(fieldValue('프로젝트'))}</div></td>
        <th>${escapeHtml(fieldDisplay('발급자', '발 급 자'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="발급자">${escapeHtml(fieldValue('발급자'))}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(fieldDisplay('계약', '계 약'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="계약">${escapeHtml(fieldValue('계약'))}</div></td>
        <th>${escapeHtml(fieldDisplay('접수자', '접 수 자'))}</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="접수자">${escapeHtml(fieldValue('접수자'))}</div></td>
      </tr>
      <tr>
        <th>발급자 서명</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="발급자 서명자">${escapeHtml(statusOverview.issuerSignerName)}</div></td>
        <th>접수자 서명</th>
        <td colspan="3"><div class="template-clone__field-value" data-template-value="접수자 서명">${escapeHtml(statusOverview.receiverSignerName)}</div></td>
      </tr>
      <tr>
        <th>전자서명 상태</th>
        <td colspan="7"><div class="template-clone__field-value" data-template-value="전자서명 상태">${escapeHtml(statusOverview.issuerSignatureStatus)}</div></td>
      </tr>
      <tr>
        <th>${escapeHtml(fieldDisplay('제목', '제 목'))}</th>
        <td class="template-clone__master-title-cell" colspan="7"><div class="template-clone__field-value" data-template-value="제목">${escapeHtml(fieldValue('제목'))}</div></td>
      </tr>
${bodyRows}
      </tbody>
    </table>`;
};

const buildStructuredCloneHtml = (
  structured: StructuredWorkOrder,
  layout?: TemplateExtractPdfLayoutModel | null,
  version: '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '23' = '19'
) => {
  if (version === '23') {
    const page = getFirstPage(layout);
    const metrics = buildWorkOrderGridMetrics(layout);

    if (page && metrics) {
      return `<section data-template-extract-draft="true" data-template-clone="pdf-form-v23">
  <div class="template-clone template-clone--pdf-form-v23">
${buildCloneStyleHtml('23')}
    <div class="template-clone__pdf-semantic-page" data-page="1" data-page-number="1" style="width:${page.width.toFixed(
      2
    )}px;height:${page.height.toFixed(2)}px;">
      <div class="template-clone__pdf-semantic-flow" style="left:${metrics.contentLeft.toFixed(
        2
      )}px;top:${metrics.contentTop.toFixed(2)}px;width:${metrics.contentWidth.toFixed(2)}px;">
${buildWorkOrderGridHtmlV18(structured, layout)}
      </div>
    </div>
  </div>
</section>`;
    }
  }

  return `<section data-template-extract-draft="true" data-template-clone="pdf-form-v${version}">
  <div class="template-clone template-clone--pdf-form-v${version}">
${buildCloneStyleHtml(version)}
    <h1>작업지시서</h1>
${version === '18' || version === '19' || version === '20' ? buildWorkOrderGridHtmlV18(structured, layout) : version === '17' ? buildUnifiedWorkOrderTableHtml(structured) : `${buildMetadataHtml(structured.metadataFields)}
${buildStatusHtml(structured.statusLines)}
${buildSectionsHtml(structured.sections, layout)}`}
${buildFooterHtml(structured.footerNotes)}
  </div>
</section>`;
};

export const TemplateExtractPdfLayoutService = {
  buildGenericCloneHtml(sourceTitle: string, layout?: TemplateExtractPdfLayoutModel | null) {
    if (!layout || layout.pages.length === 0) {
      return null;
    }

    return TemplateExtractPdfHtmlCloneService.buildCloneHtml(
      sourceTitle,
      TemplateExtractPdfGeometryService.buildGeometry(layout)
    );
  },

  // BUILDHTML-PDF-18
  // text layer가 있는 작업지시서형 PDF는 의미 기반 table 재조립보다
  // 실제 row band 와 field phrasing 을 먼저 보존하는 grid-form clone 을 우선합니다.
  buildCloneHtml(
    sourceTitle: string,
    rawText: string,
    layout?: TemplateExtractPdfLayoutModel | null,
    version: '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '23' = '19'
  ) {
    const structured = parseStructuredWorkOrder(rawText);

    if (structured) {
      return buildStructuredCloneHtml(structured, layout, version);
    }

    if (!layout || layout.pages.length === 0) {
      return null;
    }

    return this.buildGenericCloneHtml(sourceTitle, layout);
  },
};
