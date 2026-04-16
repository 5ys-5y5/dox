import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractPdfLayoutModel, TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';

const execFileAsync = promisify(execFile);

const PDF_LAYOUT_EXTRACT_SCRIPT = `import Foundation
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

const extractPdfLayout = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractPdfLayoutModel> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-'));
  const tempFilePath = join(tempDir, fileName || 'upload.pdf');
  const tempScriptPath = join(tempDir, 'extract-pdf-layout.swift');

  try {
    await writeFile(tempFilePath, bytes);
    await writeFile(tempScriptPath, PDF_LAYOUT_EXTRACT_SCRIPT);

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

export const TemplateExtractPdfService = {
  // TEMPLATE_EXTRACT_PDF_PIPELINE
  // PDF 는
  // 1) PDFKit 으로 텍스트 라인과 좌표를 추출
  // 2) line geometry 를 행/열 geometry 로 변환
  // 3) geometry 를 실제 HTML table/div 구조로 클론
  // 4) clone HTML 안의 value 영역만 placeholder 로 비움
  // 순서로 처리합니다.
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const layout = await extractPdfLayout(fileName, bytes);
    const rawText = layout.rawText;
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText, layout);

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
