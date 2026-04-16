import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';

const execFileAsync = promisify(execFile);

type PdfLabelDefinition = {
  canonical: string;
  aliases: string[];
};

type PdfRow = {
  label: string;
  value: string;
};

const PDF_TEXT_EXTRACT_SCRIPT = `import Foundation
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

const PDF_INLINE_FIELD_DEFINITIONS: PdfLabelDefinition[] = [
  { canonical: '양식명(코드)', aliases: ['양식명(코드)'] },
  { canonical: '문서번호', aliases: ['문서번호', '문 서 번 호'] },
  { canonical: '작성자', aliases: ['작성자', '작 성 자'] },
  { canonical: '발급일', aliases: ['발급일', '발 급 일'] },
  { canonical: '협력사승인일', aliases: ['협력사승인일'] },
  { canonical: '프로젝트', aliases: ['프로젝트', '프 로 젝 트'] },
  { canonical: '발급자', aliases: ['발급자', '발 급 자'] },
  { canonical: '계약', aliases: ['계약', '계 약'] },
  { canonical: '접수자', aliases: ['접수자', '접 수 자'] },
  { canonical: '제목', aliases: ['제목', '제 목'] },
];

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

const PDF_FORM_REQUIRED_LABELS = ['양식명(코드)', '문서번호', '프로젝트', '제목', '공사착수일'] as const;

const PDF_NOISE_LINE_PATTERNS = [
  /^구\s*분$/i,
  /^신규\s+재발급$/i,
  /^off-line등록$/i,
  /^ce\s+/i,
  /^pm\s+/i,
  /서명/,
  /전자서명 완료/,
  /^※\s*/,
] as const;

const PDF_FALLBACK_LABELS = [
  '양식명(코드)',
  '문서번호',
  '작성자',
  '발급일',
  '프로젝트',
  '발급자',
  '계약',
  '접수자',
  '제목',
  '공사착수일',
  '공사완료일',
  '특기사항',
  '첨부파일',
  '창업아이템명',
  '산출물',
  '직업',
  '기업(예정)명',
  '아이템 개요',
  '문제 인식',
  '실현 가능성',
  '성장전략',
  '팀 구성',
] as const;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLabelToken = (value: string) => value.replace(/\s+/g, '').replace(/\*/g, '').trim();

const aliasToCanonical = new Map<string, string>(
  [...PDF_INLINE_FIELD_DEFINITIONS, ...PDF_SECTION_DEFINITIONS].flatMap((definition) =>
    definition.aliases.map((alias) => [alias, definition.canonical] as const)
  )
);

const buildInlineFieldRegex = () => {
  const aliases = PDF_INLINE_FIELD_DEFINITIONS.flatMap((definition) => definition.aliases).sort(
    (left, right) => right.length - left.length
  );

  return new RegExp(aliases.map((alias) => escapeRegExp(alias)).join('|'), 'g');
};

const PDF_INLINE_FIELD_REGEX = buildInlineFieldRegex();

const PDF_SECTION_START_REGEX = /\d+(?:-\d+)?\.\s*[가-힣A-Za-z(]/g;

const cleanupPdfValue = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/^[:\-\s]+/, '')
      .replace(/\s*\*+\s*/g, ' ')
      .replace(/\s+/g, ' ')
  );

const normalizePdfFallbackText = (value: string) => {
  const withLineBreaks = value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n');

  const labelPattern = new RegExp(
    `(${PDF_FALLBACK_LABELS.map((label) => escapeRegExp(label)).join('|')})\\s*`,
    'g'
  );

  const marked = withLineBreaks.replace(labelPattern, '\n$1: ');

  return marked
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

const isMetadataNoiseLine = (value: string) =>
  PDF_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(value)) || value === '-';

const splitPdfLines = (rawText: string) =>
  rawText
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+(?=\d+(?:-\d+)?\.\s*[가-힣A-Za-z(])/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line && !/^---PAGE\s+\d+---$/i.test(line) && !/^-+\d+-+$/.test(line));

const parseInlinePdfFields = (line: string): PdfRow[] => {
  const matches = Array.from(line.matchAll(PDF_INLINE_FIELD_REGEX)).map((match) => ({
    matched: match[0],
    index: match.index ?? -1,
  }));

  if (matches.length === 0) {
    return [];
  }

  return matches
    .map((match, index) => {
      const canonical = aliasToCanonical.get(match.matched) || match.matched;
      const valueStart = match.index + match.matched.length;
      const valueEnd = matches[index + 1]?.index ?? line.length;
      const value = cleanupPdfValue(line.slice(valueStart, valueEnd));

      if (!value) {
        return null;
      }

      return {
        label: canonical,
        value,
      };
    })
    .filter((row): row is PdfRow => Boolean(row));
};

const matchSectionDefinition = (line: string) => {
  const headingMatch = line.match(/^(\d+(?:-\d+)?)\.\s*(.+)$/);

  if (!headingMatch) {
    return null;
  }

  const remainder = normalizeWhitespace(headingMatch[2].replace(/\*/g, ''));

  for (const definition of PDF_SECTION_DEFINITIONS) {
    for (const alias of definition.aliases) {
      const aliasPattern = new RegExp(
        `^${alias.split(/\s+/).map((part) => escapeRegExp(part)).join('\\s*')}(?:\\s+(.*))?$`
      );
      const matched = remainder.match(aliasPattern);

      if (matched) {
        return {
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

const isStructuredWorkOrderPdf = (rawText: string) => {
  const hits = PDF_FORM_REQUIRED_LABELS.filter((label) => rawText.includes(label)).length;
  return hits >= 3;
};

const dedupeRows = (rows: PdfRow[]) => {
  const seen = new Set<string>();
  const result: PdfRow[] = [];

  for (const row of rows) {
    const key = normalizeLabelToken(row.label);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(row);
  }

  return result;
};

const buildPdfTableHtml = (sourceTitle: string, rows: PdfRow[]) => {
  const rowHtml = rows
    .map(
      (row) =>
        `    <tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value).replace(/\n/g, '<br />')}</td></tr>`
    )
    .join('\n');

  return `<section data-template-extract-draft="true">
  <h1>${escapeHtml(sourceTitle)}</h1>
  <table>
${rowHtml}
  </table>
</section>`;
};

const buildStructuredWorkOrderHtml = (sourceTitle: string, rawText: string) => {
  const lines = mergeWrappedSectionLines(expandCompoundSectionLines(splitPdfLines(rawText)));
  const rows: PdfRow[] = [];
  let currentSection: { label: string; values: string[] } | null = null;

  const flushSection = () => {
    if (!currentSection) {
      return;
    }

    const value = currentSection.values.map(cleanupPdfValue).filter(Boolean).join('\n');

    if (value) {
      rows.push({
        label: currentSection.label,
        value,
      });
    }

    currentSection = null;
  };

  for (const line of lines) {
    const sectionMatch = matchSectionDefinition(line);

    if (sectionMatch) {
      flushSection();
      currentSection = {
        label: sectionMatch.label,
        values: sectionMatch.inlineValue ? [sectionMatch.inlineValue] : [],
      };
      continue;
    }

    if (!currentSection) {
      if (isMetadataNoiseLine(line)) {
        continue;
      }

      const inlineRows = parseInlinePdfFields(line);

      if (inlineRows.length > 0) {
        rows.push(...inlineRows);
      }

      continue;
    }

    if (currentSection.label === '첨부파일' && /^※\s*/.test(line)) {
      continue;
    }

    currentSection.values.push(line);
  }

  flushSection();

  const dedupedRows = dedupeRows(rows);

  if (dedupedRows.length < 3) {
    return null;
  }

  return buildPdfTableHtml(sourceTitle, dedupedRows);
};

const extractPdfText = async (fileName: string, bytes: Uint8Array) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-'));
  const tempFilePath = join(tempDir, fileName || 'upload.pdf');
  const tempScriptPath = join(tempDir, 'extract-pdf-text.swift');

  try {
    await writeFile(tempFilePath, bytes);
    await writeFile(tempScriptPath, PDF_TEXT_EXTRACT_SCRIPT);

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

export const TemplateExtractPdfService = {
  // TEMPLATE_EXTRACT_PDF_PIPELINE
  // PDF 는
  // 1) PDFKit 으로 텍스트 레이어 추출
  // 2) 작업지시서형 폼 메타데이터 라벨-값 정규화
  // 3) 구조화 가능한 경우 HTML 초안 반환
  // 4) 그렇지 않으면 텍스트 fallback 반환
  // 순서로 처리합니다.
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const rawText = await extractPdfText(fileName, bytes);
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    if (isStructuredWorkOrderPdf(rawText)) {
      const html = buildStructuredWorkOrderHtml(sourceTitle, rawText);

      if (html) {
        return {
          sourceTitle,
          sourceKind: 'html',
          sourceContent: html,
          originalFileName: fileName,
          originalMimeType: 'application/pdf',
        };
      }
    }

    return {
      sourceTitle,
      sourceKind: 'text',
      sourceContent: normalizePdfFallbackText(rawText),
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  },
};
