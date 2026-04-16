import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractResolvedSource, TemplateExtractSourceKind } from '../lib/templateExtractDtos';

const execFileAsync = promisify(execFile);
type TemplateExtractUploadKind = TemplateExtractSourceKind | 'docx' | 'pdf';

const WORD_TEXT_TAG_PATTERN = /<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g;
const WORD_ROW_TAG_PATTERN = /<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g;
const WORD_CELL_TAG_PATTERN = /<w:tc(?=[\s>])[^>]*>[\s\S]*?<\/w:tc>/g;
const WORD_PARAGRAPH_TAG_PATTERN = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const WORD_TABLE_CELL_PAIR_MIN_COUNT = 2;
const PDF_FORM_LABELS = [
  '양식명(코드)',
  '문서번호',
  '구 분',
  '구분',
  '작 성 자',
  '작성자',
  '발 급 일',
  '발급일',
  '협력사승인일',
  '프 로 젝 트',
  '프로젝트',
  '계 약',
  '계약',
  '접 수 자',
  '접수자',
  '발 급 자',
  '발급자',
  '제 목',
  '제목',
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

const decodeText = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: false }).decode(bytes);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripXmlTags = (value: string) => value.replace(/<[^>]+>/g, ' ');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePdfExtractedText = (value: string) => {
  const withLineBreaks = value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n');

  const labelPattern = new RegExp(
    `(${PDF_FORM_LABELS.map((label) => escapeRegExp(label)).join('|')})\\s*`,
    'g'
  );

  const marked = withLineBreaks.replace(labelPattern, '\n$1: ');

  return marked
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

const toDocxRowPairs = (cells: string[]) => {
  if (cells.length < WORD_TABLE_CELL_PAIR_MIN_COUNT) {
    return [];
  }

  if (cells.length === 2) {
    return [
      {
        label: cells[0],
        value: cells[1],
      },
    ];
  }

  if (cells.length % 2 !== 0) {
    return [];
  }

  const pairs: Array<{ label: string; value: string }> = [];

  for (let index = 0; index < cells.length; index += 2) {
    const label = cells[index]?.trim() || '';
    const value = cells[index + 1]?.trim() || '';

    if (!label || !value) {
      continue;
    }

    pairs.push({ label, value });
  }

  return pairs;
};

const getFileExtension = (fileName: string) => {
  const matched = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] || '';
};

const inferUploadKind = (fileName: string, mimeType: string): TemplateExtractUploadKind => {
  const extension = getFileExtension(fileName);

  if (mimeType.includes('html') || extension === 'html' || extension === 'htm') {
    return 'html';
  }

  if (mimeType.includes('text/plain') || extension === 'txt' || extension === 'md') {
    return 'text';
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  ) {
    return 'docx';
  }

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  throw new Error('템플릿 추출 실패: 현재는 txt, html, docx, pdf 파일만 업로드할 수 있습니다.');
};

const extractWordText = (xmlFragment: string) => {
  const runs = Array.from(xmlFragment.matchAll(WORD_TEXT_TAG_PATTERN)).map((match) =>
    decodeXmlEntities(match[1])
  );

  if (runs.length === 0) {
    return normalizeWhitespace(stripXmlTags(decodeXmlEntities(xmlFragment)));
  }

  return normalizeWhitespace(stripXmlTags(runs.join(' ')));
};

const buildDocxHtml = (sourceTitle: string, documentXml: string) => {
  const tableRows = Array.from(documentXml.matchAll(WORD_ROW_TAG_PATTERN))
    .flatMap((rowMatch) => {
      const cells = Array.from(rowMatch[0].matchAll(WORD_CELL_TAG_PATTERN))
        .map((cellMatch) => extractWordText(cellMatch[0]))
        .filter(Boolean);

      return toDocxRowPairs(cells);
    });

  const paragraphs = Array.from(documentXml.matchAll(WORD_PARAGRAPH_TAG_PATTERN))
    .map((paragraphMatch) => extractWordText(paragraphMatch[0]))
    .filter(Boolean);

  const heading = paragraphs[0] || sourceTitle;

  if (tableRows.length > 0) {
    const rowsHtml = tableRows
      .map(
        (row) =>
          `    <tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`
      )
      .join('\n');

    return `<section>
  <h1>${escapeHtml(heading)}</h1>
  <table>
${rowsHtml}
  </table>
</section>`;
  }

  const paragraphHtml = paragraphs
    .map((paragraph) => `  <p>${escapeHtml(paragraph)}</p>`)
    .join('\n');

  return `<section>
  <h1>${escapeHtml(heading)}</h1>
${paragraphHtml}
</section>`;
};

const extractDocxSource = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-docx-'));
  const tempFilePath = join(tempDir, fileName || 'upload.docx');

  try {
    await writeFile(tempFilePath, bytes);
    const { stdout } = await execFileAsync('unzip', ['-p', tempFilePath, 'word/document.xml'], {
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'utf8',
    });

    const sourceTitle = fileName.replace(/\.docx$/i, '').trim() || '업로드 문서';
    const generatedHtml = buildDocxHtml(sourceTitle, stdout);

    return {
      sourceTitle,
      sourceKind: 'html',
      sourceContent: generatedHtml,
      originalFileName: fileName,
      originalMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'word/document.xml 추출에 실패했습니다.';
    throw new Error(`템플릿 추출 실패: DOCX 본문 추출 중 오류가 발생했습니다. (${message})`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const extractPdfSource = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
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
        SWIFT_MODULECACHE_PATH: tempDir,
        CLANG_MODULE_CACHE_PATH: tempDir,
      },
    });

    const sourceContent = normalizePdfExtractedText(stdout);

    if (!sourceContent) {
      throw new Error('텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    return {
      sourceTitle: fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF',
      sourceKind: 'text',
      sourceContent,
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '텍스트 레이어를 찾지 못했습니다.';
    throw new Error(`템플릿 추출 실패: PDF 본문 추출 중 오류가 발생했습니다. (${message})`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const TemplateExtractFileService = {
  // TEMPLATE_EXTRACT_UPLOAD_PIPELINE
  // 업로드 파일 처리는
  // 1) 형식 판별
  // 2) 본문 추출
  // 3) 기존 templateExtractService 로 전달
  // 순서로 분리합니다. UI는 단순하지만 내부 단계는 명확히 유지합니다.
  async resolveUploadSource(fileName: string, mimeType: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const normalizedFileName = fileName.trim() || 'upload';
    const normalizedMimeType = mimeType.trim();
    const uploadKind = inferUploadKind(normalizedFileName, normalizedMimeType);
    const sourceTitle = normalizedFileName.replace(/\.[a-z0-9]+$/i, '').trim() || '업로드 문서';

    if (uploadKind === 'docx') {
      return extractDocxSource(normalizedFileName, bytes);
    }

    if (uploadKind === 'pdf') {
      return extractPdfSource(normalizedFileName, bytes);
    }

    const sourceContent = decodeText(bytes).trim();

    if (!sourceContent) {
      throw new Error('템플릿 추출 실패: 업로드 파일 본문이 비어 있습니다.');
    }

    return {
      sourceTitle,
      sourceKind: uploadKind,
      sourceContent,
      originalFileName: normalizedFileName,
      originalMimeType: normalizedMimeType || null,
    };
  },
};
