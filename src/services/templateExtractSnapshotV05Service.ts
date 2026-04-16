import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';

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

const TemplateExtractSnapshotV05Layout = {
  buildCloneHtml(sourceTitle: string, rawText: string) {
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

const PDF_TEXT_EXTRACT_SCRIPT_V05 = `import Foundation
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

var pages: [String] = []

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else {
    continue
  }

  let text = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

  if !text.isEmpty {
    pages.append(text)
  }
}

let output = pages.joined(separator: "\\n\\n")
print(output)
`;

const PDF_FALLBACK_LABELS_V05 = [
  '양식명(코드)',
  '문서번호',
  '양식 문서번호',
  '작성자',
  '발급일',
  '협력사승인일',
  '프로젝트',
  '발급자',
  '계약',
  '접수자',
  '제목',
  '공사 내용',
  '대표수량 및 단가',
  '하도급 대금',
  '공사착수일',
  '공사완료일',
  '검사의 방법',
  '검사의 시기',
  '대금 지급방법',
  '대금 지급시기',
  '원재료 지급시 조건',
  '공급원가 변동에 따른 하도급 대금의 조정',
  '특기사항',
  '첨부파일',
] as const;

const normalizeWhitespaceV05 = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeRegExpV05 = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePdfFallbackTextV05 = (value: string) => {
  const withLineBreaks = value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
  const labelPattern = new RegExp(
    `(${PDF_FALLBACK_LABELS_V05.map((label) => escapeRegExpV05(label)).join('|')})\\s*`,
    'g'
  );
  const marked = withLineBreaks.replace(labelPattern, '\n$1: ');

  return marked
    .split('\n')
    .map((line) => normalizeWhitespaceV05(line))
    .filter(Boolean)
    .join('\n');
};

const extractPdfTextV05 = async (fileName: string, bytes: Uint8Array) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-v05-'));
  const tempFilePath = join(tempDir, fileName || 'upload.pdf');
  const tempScriptPath = join(tempDir, 'extract-pdf-text-v05.swift');

  try {
    await writeFile(tempFilePath, bytes);
    await writeFile(tempScriptPath, PDF_TEXT_EXTRACT_SCRIPT_V05);

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

    return stdout;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const TemplateExtractSnapshotV05Service = {
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const rawText = await extractPdfTextV05(fileName, bytes);
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    const clonedHtml = TemplateExtractSnapshotV05Layout.buildCloneHtml(sourceTitle, rawText);

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
      sourceContent: normalizePdfFallbackTextV05(rawText),
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  },
};
