import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';

const execFileAsync = promisify(execFile);

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

const PDF_FALLBACK_LABELS = [
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

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePdfFallbackText = (value: string) => {
  const withLineBreaks = value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
  const labelPattern = new RegExp(
    `(${PDF_FALLBACK_LABELS.map((label) => escapeRegExp(label)).join('|')})\\s*`,
    'g'
  );
  const marked = withLineBreaks.replace(labelPattern, '\n$1: ');

  return marked
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join('\n');
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
  // 2) 가능한 경우 원문 구조를 HTML 로 클로닝
  // 3) 클로닝이 어려우면 key-value text fallback
  // 순서로 처리합니다.
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const rawText = await extractPdfText(fileName, bytes);
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText);

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
      sourceContent: normalizePdfFallbackText(rawText),
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  },
};
