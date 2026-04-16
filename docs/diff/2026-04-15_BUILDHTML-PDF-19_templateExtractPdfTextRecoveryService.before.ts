import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractPdfRuleModel, TemplateExtractPdfRuleSegment } from '../lib/templateExtractDtos';

const execFileAsync = promisify(execFile);

const PDF_RULE_RECOVERY_SCRIPT = `import Foundation
import PDFKit
import AppKit

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

struct RuleSegment: Codable {
  let position: Double
  let start: Double
  let end: Double
  let thickness: Double
}

struct RulePage: Codable {
  let pageNumber: Int
  let width: Double
  let height: Double
  let rowRules: [Double]
  let columnRules: [Double]
  let horizontalSegments: [RuleSegment]
  let verticalSegments: [RuleSegment]
}

struct Output: Codable {
  let rawText: String
  let pages: [RulePage]
}

func groupedCenters(_ values: [Int], threshold: Int, minGap: Int) -> [Int] {
  var output: [Int] = []
  var start: Int? = nil

  for index in 0..<values.count {
    if values[index] >= threshold {
      if start == nil {
        start = index
      }
      continue
    }

    if let currentStart = start {
      let center = (currentStart + index - 1) / 2

      if output.isEmpty || center - output.last! >= minGap {
        output.append(center)
      }

      start = nil
    }
  }

  if let currentStart = start {
    let center = (currentStart + values.count - 1) / 2

    if output.isEmpty || center - output.last! >= minGap {
      output.append(center)
    }
  }

  return output
}

func detectRules(page: PDFPage, pageNumber: Int) -> RulePage? {
  let bounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.0
  let imageSize = NSSize(
    width: max(bounds.width * scale, 1),
    height: max(bounds.height * scale, 1)
  )

  let thumbnail = page.thumbnail(of: imageSize, for: .mediaBox)

  guard let tiffData = thumbnail.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiffData) else {
    return nil
  }

  let pixelWidth = bitmap.pixelsWide
  let pixelHeight = bitmap.pixelsHigh
  let bytesPerRow = bitmap.bytesPerRow
  let samplesPerPixel = max(bitmap.samplesPerPixel, 3)
  guard let bitmapData = bitmap.bitmapData else {
    return nil
  }

  if pixelWidth == 0 || pixelHeight == 0 {
    return nil
  }

  func isDark(_ x: Int, _ y: Int) -> Bool {
    let offset = y * bytesPerRow + x * samplesPerPixel
    let red = Double(bitmapData[offset])
    let green = Double(bitmapData[offset + 1])
    let blue = Double(bitmapData[offset + 2])
    let gray = (red + green + blue) / (255.0 * 3.0)
    return gray < 0.72
  }

  func longestFastRowRun(_ row: Int) -> Int {
    var current = 0
    var best = 0

    for column in 0..<pixelWidth {
      if isDark(column, row) {
        current += 1
        best = max(best, current)
      } else {
        current = 0
      }
    }

    return best
  }

  func longestFastColumnRun(_ column: Int) -> Int {
    var current = 0
    var best = 0

    for row in 0..<pixelHeight {
      if isDark(column, row) {
        current += 1
        best = max(best, current)
      } else {
        current = 0
      }
    }

    return best
  }

  let rowRuns = (0..<pixelHeight).map { longestFastRowRun($0) }
  let columnRuns = (0..<pixelWidth).map { longestFastColumnRun($0) }

  let rowThreshold = max(Int(Double(pixelWidth) * 0.45), 160)
  let columnThreshold = max(Int(Double(pixelHeight) * 0.25), 180)

  let rowRules = groupedCenters(rowRuns, threshold: rowThreshold, minGap: 8).map { Double($0) / Double(scale) }
  let columnRules = groupedCenters(columnRuns, threshold: columnThreshold, minGap: 8).map { Double($0) / Double(scale) }

  func detectHorizontalSegments(ruleRow: Int) -> [RuleSegment] {
    let band = 2
    var strengths = Array(repeating: 0, count: pixelWidth)

    for row in max(0, ruleRow - band)...min(pixelHeight - 1, ruleRow + band) {
      for column in 0..<pixelWidth where isDark(column, row) {
        strengths[column] += 1
      }
    }

    var segments: [RuleSegment] = []
    var start: Int? = nil
    let activation = band + 1

    for column in 0..<pixelWidth {
      if strengths[column] >= activation {
        if start == nil {
          start = column
        }
      } else if let currentStart = start {
        let end = column - 1
        if end - currentStart >= 20 {
          segments.append(
            RuleSegment(
              position: Double(ruleRow) / Double(scale),
              start: Double(currentStart) / Double(scale),
              end: Double(end) / Double(scale),
              thickness: Double((band * 2) + 1) / Double(scale)
            )
          )
        }
        start = nil
      }
    }

    if let currentStart = start {
      let end = pixelWidth - 1
      if end - currentStart >= 20 {
        segments.append(
          RuleSegment(
            position: Double(ruleRow) / Double(scale),
            start: Double(currentStart) / Double(scale),
            end: Double(end) / Double(scale),
            thickness: Double((band * 2) + 1) / Double(scale)
          )
        )
      }
    }

    return segments
  }

  func detectVerticalSegments(ruleColumn: Int) -> [RuleSegment] {
    let band = 2
    var strengths = Array(repeating: 0, count: pixelHeight)

    for column in max(0, ruleColumn - band)...min(pixelWidth - 1, ruleColumn + band) {
      for row in 0..<pixelHeight where isDark(column, row) {
        strengths[row] += 1
      }
    }

    var segments: [RuleSegment] = []
    var start: Int? = nil
    let activation = band + 1

    for row in 0..<pixelHeight {
      if strengths[row] >= activation {
        if start == nil {
          start = row
        }
      } else if let currentStart = start {
        let end = row - 1
        if end - currentStart >= 20 {
          segments.append(
            RuleSegment(
              position: Double(ruleColumn) / Double(scale),
              start: Double(currentStart) / Double(scale),
              end: Double(end) / Double(scale),
              thickness: Double((band * 2) + 1) / Double(scale)
            )
          )
        }
        start = nil
      }
    }

    if let currentStart = start {
      let end = pixelHeight - 1
      if end - currentStart >= 20 {
        segments.append(
          RuleSegment(
            position: Double(ruleColumn) / Double(scale),
            start: Double(currentStart) / Double(scale),
            end: Double(end) / Double(scale),
            thickness: Double((band * 2) + 1) / Double(scale)
          )
        )
      }
    }

    return segments
  }

  let horizontalSegments = groupedCenters(rowRuns, threshold: rowThreshold, minGap: 8).flatMap(detectHorizontalSegments)
  let verticalSegments = groupedCenters(columnRuns, threshold: columnThreshold, minGap: 8).flatMap(detectVerticalSegments)

  return RulePage(
    pageNumber: pageNumber,
    width: Double(bounds.width),
    height: Double(bounds.height),
    rowRules: rowRules,
    columnRules: columnRules,
    horizontalSegments: horizontalSegments,
    verticalSegments: verticalSegments
  )
}

var pages: [RulePage] = []

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex),
        let detected = detectRules(page: page, pageNumber: pageIndex + 1) else {
    continue
  }

  pages.append(detected)
}

let output = Output(rawText: "", pages: pages)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted]
let data = try encoder.encode(output)
print(String(data: data, encoding: .utf8) ?? "{}")
`;

const clampRule = (value: number, max: number) => Math.max(0, Math.min(value, max));

const dedupeRules = (values: number[], max: number) => {
  const sorted = [...values]
    .map((value) => clampRule(value, max))
    .sort((left, right) => left - right);

  const deduped: number[] = [];

  for (const value of sorted) {
    if (deduped.length === 0 || Math.abs(value - deduped[deduped.length - 1]) >= 4) {
      deduped.push(value);
    }
  }

  return deduped;
};

const buildIntervals = (rules: number[], max: number) => {
  const normalized = dedupeRules(rules, max);

  if (normalized.length < 2) {
    return [];
  }

  const intervals: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const start = normalized[index];
    const end = normalized[index + 1];

    if (end - start < 6) {
      continue;
    }

    intervals.push({ start, end });
  }

  return intervals;
};

const buildGridHtml = (model: TemplateExtractPdfRuleModel) => {
  const pagesHtml = model.pages
    .map((page) => {
      const rowIntervals = buildIntervals(page.rowRules, page.height);
      const columnIntervals = buildIntervals(page.columnRules, page.width);

      if (rowIntervals.length === 0 || columnIntervals.length === 0) {
        return '';
      }

      const totalColumnWidth = columnIntervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);

      const colgroup = columnIntervals
        .map((interval) => {
          const width = ((interval.end - interval.start) / totalColumnWidth) * 100;
          return `        <col style="width: ${width.toFixed(2)}%">`;
        })
        .join('\n');

      const rows = rowIntervals
        .map((interval) => {
          const height = interval.end - interval.start;
          const cells = columnIntervals
            .map(
              () =>
                `          <td><div class="template-clone__pdf-grid-cell" style="min-height:${height.toFixed(
                  2
                )}px;"></div></td>`
            )
            .join('\n');

          return `        <tr>\n${cells}\n        </tr>`;
        })
        .join('\n');

      return `    <div class="template-clone__pdf-grid-page" data-page="${page.pageNumber}">
      <table class="template-clone__pdf-grid-table">
        <colgroup>
${colgroup}
        </colgroup>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>`;
    })
    .filter(Boolean)
    .join('\n');

  if (!pagesHtml) {
    return null;
  }

  return `<section data-template-extract-draft="true" data-template-clone="pdf-grid-v14">
  <div class="template-clone template-clone--pdf-grid-v14">
    <style>
      .template-clone--pdf-grid-v14 {
        width: 920px;
        margin: 0 auto;
        padding: 18px;
        background: #ffffff;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      }

      .template-clone__pdf-grid-page {
        margin-bottom: 18px;
      }

      .template-clone__pdf-grid-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .template-clone__pdf-grid-table td {
        border: 1px solid #111827;
        padding: 0;
        vertical-align: top;
      }

      .template-clone__pdf-grid-cell {
        width: 100%;
      }
    </style>
${pagesHtml}
  </div>
</section>`;
};

const dedupeSegments = (segments: TemplateExtractPdfRuleSegment[], axis: 'horizontal' | 'vertical') => {
  const sorted = [...segments].sort((left, right) => {
    if (Math.abs(left.position - right.position) < 2) {
      return left.start - right.start;
    }

    return left.position - right.position;
  });

  const deduped: TemplateExtractPdfRuleSegment[] = [];

  for (const segment of sorted) {
    const previous = deduped[deduped.length - 1];

    if (
      previous &&
      Math.abs(previous.position - segment.position) < 2 &&
      Math.abs(previous.start - segment.start) < 6 &&
      Math.abs(previous.end - segment.end) < 6
    ) {
      previous.thickness = Math.max(previous.thickness, segment.thickness);
      continue;
    }

    deduped.push({ ...segment });
  }

  return deduped.filter((segment) => {
    const length = segment.end - segment.start;
    return axis === 'horizontal' ? length >= 20 : length >= 20;
  });
};

const buildFrameHtml = (model: TemplateExtractPdfRuleModel) => {
  const pagesHtml = model.pages
    .map((page) => {
      const horizontalSegments = dedupeSegments(page.horizontalSegments, 'horizontal');
      const verticalSegments = dedupeSegments(page.verticalSegments, 'vertical');

      if (horizontalSegments.length === 0 && verticalSegments.length === 0) {
        return '';
      }

      const horizontalHtml = horizontalSegments
        .map(
          (segment) =>
            `      <div class="template-clone__pdf-frame-line template-clone__pdf-frame-line--horizontal" style="left:${segment.start.toFixed(
              2
            )}px;top:${segment.position.toFixed(2)}px;width:${(segment.end - segment.start).toFixed(
              2
            )}px;height:${Math.max(segment.thickness, 1).toFixed(2)}px;"></div>`
        )
        .join('\n');

      const verticalHtml = verticalSegments
        .map(
          (segment) =>
            `      <div class="template-clone__pdf-frame-line template-clone__pdf-frame-line--vertical" style="left:${segment.position.toFixed(
              2
            )}px;top:${segment.start.toFixed(2)}px;width:${Math.max(segment.thickness, 1).toFixed(
              2
            )}px;height:${(segment.end - segment.start).toFixed(2)}px;"></div>`
        )
        .join('\n');

      return `    <div class="template-clone__pdf-frame-page" data-page="${page.pageNumber}" style="width:${page.width.toFixed(
        2
      )}px;height:${page.height.toFixed(2)}px;">
${horizontalHtml}
${verticalHtml}
    </div>`;
    })
    .filter(Boolean)
    .join('\n');

  if (!pagesHtml) {
    return null;
  }

  return `<section data-template-extract-draft="true" data-template-clone="pdf-frame-v15">
  <div class="template-clone template-clone--pdf-frame-v15">
    <style>
      .template-clone--pdf-frame-v15 {
        width: 920px;
        margin: 0 auto;
        padding: 18px;
        background: #ffffff;
      }

      .template-clone__pdf-frame-page {
        position: relative;
        margin: 0 auto 18px;
        background: #ffffff;
      }

      .template-clone__pdf-frame-line {
        position: absolute;
        background: #111827;
      }
    </style>
${pagesHtml}
  </div>
</section>`;
};

const extractRuleModel = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractPdfRuleModel> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-rules-'));
  const tempFilePath = join(tempDir, fileName || 'upload.pdf');
  const tempScriptPath = join(tempDir, 'extract-pdf-rules.swift');

  try {
    await writeFile(tempFilePath, bytes);
    await writeFile(tempScriptPath, PDF_RULE_RECOVERY_SCRIPT);

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

    return JSON.parse(stdout) as TemplateExtractPdfRuleModel;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const TemplateExtractPdfTextRecoveryService = {
  // BUILDHTML-PDF-15_IMAGE_FRAME_FALLBACK
  // 텍스트 레이어가 없는 PDF는 페이지 규칙선을 직접 HTML line element로 그려
  // 문서 틀을 우선 복제합니다.
  async recoverHtml(_sourceTitle: string, fileName: string, bytes: Uint8Array, version: '14' | '15' = '15') {
    const ruleModel = await extractRuleModel(fileName, bytes);

    if (!ruleModel.pages.length) {
      return null;
    }

    if (version === '14') {
      return buildGridHtml(ruleModel);
    }

    return buildFrameHtml(ruleModel);
  },
};
