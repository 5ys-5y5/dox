import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  TemplateExtractPdfLine,
  TemplateExtractPdfRuleModel,
  TemplateExtractPdfRuleSegment,
} from '../lib/templateExtractDtos';

const execFileAsync = promisify(execFile);

const PDF_RULE_RECOVERY_SCRIPT = `import Foundation
import PDFKit
import AppKit
import Vision

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

struct OcrLine: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

struct RulePage: Codable {
  let pageNumber: Int
  let width: Double
  let height: Double
  let rowRules: [Double]
  let columnRules: [Double]
  let horizontalSegments: [RuleSegment]
  let verticalSegments: [RuleSegment]
  let ocrLines: [OcrLine]
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

func extractOcrLines(from image: CGImage, bounds: CGRect) -> [OcrLine] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["ko-KR", "en-US"]
  request.minimumTextHeight = 0.003

  let handler = VNImageRequestHandler(cgImage: image, options: [:])

  do {
    try handler.perform([request])
  } catch {
    return []
  }

  let observations = request.results ?? []
  var lines: [OcrLine] = []

  for observation in observations {
    guard let candidate = observation.topCandidates(1).first else {
      continue
    }

    let text = candidate.string
      .replacingOccurrences(of: "\\r", with: "")
      .replacingOccurrences(of: "\\n", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    if text.isEmpty {
      continue
    }

    let box = observation.boundingBox
    lines.append(
      OcrLine(
        text: text,
        x: Double(box.origin.x) * Double(bounds.width),
        y: Double(box.origin.y) * Double(bounds.height),
        width: Double(box.size.width) * Double(bounds.width),
        height: Double(box.size.height) * Double(bounds.height)
      )
    )
  }

  lines.sort {
    if abs($0.y - $1.y) < 3 {
      return $0.x < $1.x
    }

    return $0.y > $1.y
  }

  return lines
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
        let bitmap = NSBitmapImageRep(data: tiffData),
        let cgImage = bitmap.cgImage else {
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
  let ocrLines = extractOcrLines(from: cgImage, bounds: bounds)

  return RulePage(
    pageNumber: pageNumber,
    width: Double(bounds.width),
    height: Double(bounds.height),
    rowRules: rowRules,
    columnRules: columnRules,
    horizontalSegments: horizontalSegments,
    verticalSegments: verticalSegments,
    ocrLines: ocrLines
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

type RecoveryOcrRow = {
  y: number;
  lines: TemplateExtractPdfLine[];
  text: string;
};

type CertificateFieldDefinition = {
  key: string;
  labels: string[];
  multiline?: boolean;
};

type StructuredBusinessCertificate = {
  issueNumber: string;
  processingTime: string;
  title: string;
  taxType: string;
  fields: Array<{
    key: string;
    label: string;
    valueLines: string[];
  }>;
  jointBusinessStatus: string[];
  certificationText: string[];
  cautionNote: string[];
  issuedDate: string;
  receiptNumber: string;
  department: string;
  official: string;
  contact: string;
  footerNotes: string[];
};

const createDefaultBusinessCertificate = (): StructuredBusinessCertificate => ({
  issueNumber: '',
  processingTime: '',
  title: '사업자등록증명',
  taxType: '( 일반과세자 )',
  fields: CERTIFICATE_FIELD_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.labels[0],
    valueLines: [''],
  })),
  jointBusinessStatus: ['해당사항이 없습니다.'],
  certificationText: ['위와 같이 증명합니다.'],
  cautionNote: ['※ 위 내용은 발급일 현재 상황으로서 추후 변경될 수 있습니다.'],
  issuedDate: '',
  receiptNumber: '',
  department: '',
  official: '',
  contact: '',
  footerNotes: [
    '• 본 증명서는 정부24에서 발급된 증명서로, 문서발급번호로 진위확인을 할 수 있습니다.',
    '• 문서 하단 바코드 또는 문서확인 프로그램으로도 진위확인을 할 수 있습니다.',
  ],
});

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizeLoose = (value: string) =>
  normalizeWhitespace(value)
    .replace(/[()]/g, '')
    .replace(/[·•]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const groupOcrRows = (lines: TemplateExtractPdfLine[]) => {
  const sorted = [...lines].sort((left, right) => {
    if (Math.abs(left.y - right.y) < 6) {
      return left.x - right.x;
    }

    return right.y - left.y;
  });

  const rows: RecoveryOcrRow[] = [];

  for (const line of sorted) {
    const current = rows[rows.length - 1];

    if (current && Math.abs(current.y - line.y) < 8) {
      current.lines.push(line);
      current.lines.sort((left, right) => left.x - right.x);
      current.text = current.lines.map((item) => normalizeWhitespace(item.text)).filter(Boolean).join(' ');
      continue;
    }

    rows.push({
      y: line.y,
      lines: [line],
      text: normalizeWhitespace(line.text),
    });
  }

  return rows.filter((row) => row.text);
};

const buildKnownLabelSet = (definitions: CertificateFieldDefinition[]) => {
  const labels = new Set<string>();

  for (const definition of definitions) {
    for (const label of definition.labels) {
      labels.add(normalizeLoose(label));
    }
  }

  [
    '사업자등록증명',
    '일반과세자',
    '공동사업자',
    '위와같이증명합니다.',
    '위와같이증명합니다',
    '접수번호',
    '담당부서',
    '담당자',
    '연락처',
  ].forEach((label) => labels.add(normalizeLoose(label)));

  return labels;
};

const extractSameRowValue = (row: RecoveryOcrRow, labels: string[]) => {
  const matchingLine = row.lines.find((line) => labels.some((label) => normalizeLoose(line.text).includes(normalizeLoose(label))));

  if (!matchingLine) {
    return '';
  }

  const rightSide = row.lines
    .filter((line) => line.x > matchingLine.x + matchingLine.width + 10)
    .map((line) => normalizeWhitespace(line.text))
    .filter(Boolean)
    .join(' ');

  if (rightSide) {
    return rightSide;
  }

  const rowText = normalizeWhitespace(row.text);

  for (const label of labels) {
    const index = rowText.indexOf(label);

    if (index >= 0) {
      const remainder = normalizeWhitespace(rowText.slice(index + label.length));

      if (remainder) {
        return remainder;
      }
    }
  }

  return '';
};

const buildBusinessCertificateHtml = (structured: StructuredBusinessCertificate) => {
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const valueHtml = (label: string, value: string) =>
    `<span class="template-clone__certificate-value" data-template-value="${escapeHtml(label)}">${escapeHtml(value)}</span>`;
  const fieldRows = structured.fields
    .map((field) => {
      const valueLines = field.valueLines.length > 0 ? field.valueLines : [''];
      return valueLines
        .map((line, index) => `      <tr>
        ${index === 0 ? `<th rowspan="${valueLines.length}">${escapeHtml(field.label)}</th>` : ''}
        <td>${valueHtml(field.key, line)}</td>
      </tr>`)
        .join('\n');
    })
    .join('\n');
  const jointBusinessContent = structured.jointBusinessStatus.length > 0 ? structured.jointBusinessStatus : ['해당사항이 없습니다.'];
  const footerNotes = structured.footerNotes.length > 0 ? structured.footerNotes : [];

  return `<section data-template-extract-draft="true" data-template-clone="pdf-certificate-v19">
  <div class="template-clone template-clone--pdf-certificate-v19">
    <style>
      .template-clone--pdf-certificate-v19 {
        width: 920px;
        margin: 0 auto;
        padding: 18px;
        background: #ffffff;
        color: #0f172a;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        line-height: 1.45;
      }

      .template-clone__certificate-header {
        display: grid;
        grid-template-columns: 26% 48% 26%;
        align-items: end;
        gap: 12px;
        margin-bottom: 10px;
      }

      .template-clone__certificate-header-block {
        border: 1px solid #111827;
        padding: 8px 10px;
        min-height: 54px;
      }

      .template-clone__certificate-header-block--center {
        text-align: center;
      }

      .template-clone__certificate-title {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .template-clone__certificate-subtitle {
        margin-top: 6px;
        font-size: 12px;
      }

      .template-clone__certificate-label {
        font-weight: 700;
        margin-bottom: 4px;
      }

      .template-clone__certificate-table,
      .template-clone__certificate-joint-table,
      .template-clone__certificate-issue-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 10px;
      }

      .template-clone__certificate-table th,
      .template-clone__certificate-table td,
      .template-clone__certificate-joint-table th,
      .template-clone__certificate-joint-table td,
      .template-clone__certificate-issue-table th,
      .template-clone__certificate-issue-table td {
        border: 1px solid #111827;
        padding: 6px 8px;
        font-size: 12px;
        vertical-align: top;
      }

      .template-clone__certificate-table th,
      .template-clone__certificate-joint-table th,
      .template-clone__certificate-issue-table th {
        background: #f8fafc;
        font-weight: 700;
        text-align: center;
      }

      .template-clone__certificate-value {
        display: inline-block;
        width: 100%;
        min-height: 14px;
      }

      .template-clone__certificate-note {
        margin: 0 0 8px;
        font-size: 11px;
      }
    </style>
    <div class="template-clone__certificate-header">
      <div class="template-clone__certificate-header-block">
        <div class="template-clone__certificate-label">발급번호</div>
        <div>${valueHtml('발급번호', structured.issueNumber)}</div>
      </div>
      <div class="template-clone__certificate-header-block template-clone__certificate-header-block--center">
        <h1 class="template-clone__certificate-title">${escapeHtml(structured.title || '사업자등록증명')}</h1>
        <div class="template-clone__certificate-subtitle">${valueHtml('과세유형', structured.taxType)}</div>
      </div>
      <div class="template-clone__certificate-header-block">
        <div class="template-clone__certificate-label">처리기간</div>
        <div>${valueHtml('처리기간', structured.processingTime)}</div>
      </div>
    </div>
    <table class="template-clone__certificate-table">
      <colgroup>
        <col style="width: 23%">
        <col style="width: 77%">
      </colgroup>
      <tbody>
${fieldRows}
      </tbody>
    </table>
    <table class="template-clone__certificate-joint-table">
      <colgroup>
        <col style="width: 23%">
        <col style="width: 38%">
        <col style="width: 39%">
      </colgroup>
      <tbody>
      <tr>
        <th rowspan="2">공동 사업자</th>
        <th>성명(법인명)</th>
        <th>주민(사업자)등록번호</th>
      </tr>
      <tr>
        <td colspan="2">${valueHtml('공동사업자', jointBusinessContent.join(' '))}</td>
      </tr>
      </tbody>
    </table>
    ${structured.certificationText.map((line) => `<p class="template-clone__certificate-note">${escapeHtml(line)}</p>`).join('\n')}
    ${structured.cautionNote.map((line) => `<p class="template-clone__certificate-note">${escapeHtml(line)}</p>`).join('\n')}
    <table class="template-clone__certificate-issue-table">
      <colgroup>
        <col style="width: 20%">
        <col style="width: 30%">
        <col style="width: 20%">
        <col style="width: 30%">
      </colgroup>
      <tbody>
      <tr>
        <th>발급일</th>
        <td>${valueHtml('발급일', structured.issuedDate)}</td>
        <th>접수번호</th>
        <td>${valueHtml('접수번호', structured.receiptNumber)}</td>
      </tr>
      <tr>
        <th>담당부서</th>
        <td>${valueHtml('담당부서', structured.department)}</td>
        <th>발급기관</th>
        <td>${valueHtml('발급기관', structured.official)}</td>
      </tr>
      <tr>
        <th>담당자 연락처</th>
        <td colspan="3">${valueHtml('담당자 연락처', structured.contact)}</td>
      </tr>
      </tbody>
    </table>
    ${footerNotes.map((line) => `<p class="template-clone__certificate-note">${escapeHtml(line)}</p>`).join('\n')}
  </div>
</section>`;
};

const CERTIFICATE_FIELD_DEFINITIONS: CertificateFieldDefinition[] = [
  { key: '상호(법인명)', labels: ['상호 (법인명)', '상호(법인명)'] },
  { key: '사업자등록번호', labels: ['사업자등록번호'] },
  { key: '대표자성명(대표유형)', labels: ['대표자성명(대표유형)', '대표자성명', '대표자 성명'] },
  { key: '주민(법인)등록번호', labels: ['주민(법인)등록번호', '주민등록번호', '법인등록번호'] },
  { key: '사업장소재지', labels: ['사업장소재지'] },
  { key: '개업일', labels: ['개업 일', '개업일'] },
  { key: '사업자등록일', labels: ['사업자등록 일', '사업자등록일'] },
  { key: '업태', labels: ['업태', '업 태'], multiline: true },
  { key: '종목', labels: ['종목', '종 목'], multiline: true },
];

const parseBusinessCertificate = (model: TemplateExtractPdfRuleModel): StructuredBusinessCertificate | null => {
  const firstPage = model.pages[0];

  if (!firstPage || firstPage.ocrLines.length === 0) {
    return null;
  }

  const rows = groupOcrRows(firstPage.ocrLines);
  const allLabels = buildKnownLabelSet(CERTIFICATE_FIELD_DEFINITIONS);
  const normalizedRows = rows.map((row) => ({
    ...row,
    normalized: normalizeLoose(row.text),
  }));
  const indexOfRow = (matcher: (row: typeof normalizedRows[number]) => boolean) => normalizedRows.findIndex(matcher);
  const findByText = (needle: string) => indexOfRow((row) => row.normalized.includes(normalizeLoose(needle)));
  const isLabelRow = (row: typeof normalizedRows[number]) => {
    if (allLabels.has(row.normalized)) {
      return true;
    }

    return row.lines.some((line) => allLabels.has(normalizeLoose(line.text)));
  };
  const collectAfter = (startIndex: number, stopIndexSet: Set<number>, multiline = false) => {
    if (startIndex < 0) {
      return [] as string[];
    }

    const sameRowValue = extractSameRowValue(normalizedRows[startIndex], CERTIFICATE_FIELD_DEFINITIONS.flatMap((definition) => definition.labels));

    if (sameRowValue && !multiline) {
      return [sameRowValue];
    }

    const values: string[] = [];

    if (sameRowValue) {
      values.push(sameRowValue);
    }

    for (let index = startIndex + 1; index < normalizedRows.length; index += 1) {
      if (stopIndexSet.has(index)) {
        break;
      }

      if (isLabelRow(normalizedRows[index])) {
        break;
      }

      values.push(normalizedRows[index].text);

      if (!multiline) {
        break;
      }
    }

    return values.map((value) => normalizeWhitespace(value)).filter(Boolean);
  };

  const fieldIndexes = new Map<string, number>();

  for (const definition of CERTIFICATE_FIELD_DEFINITIONS) {
    const foundIndex = indexOfRow((row) =>
      definition.labels.some((label) => row.normalized.includes(normalizeLoose(label)))
    );
    fieldIndexes.set(definition.key, foundIndex);
  }

  const specialIndexes = new Set<number>(
    [
      findByText('발급번호'),
      findByText('처리기간'),
      findByText('사업자등록증명'),
      findByText('공동 사업자'),
      findByText('위와 같이 증명합니다'),
      findByText('접수번호'),
      findByText('담당부서'),
      findByText('담당자'),
      findByText('연락처'),
    ].filter((value): value is number => value >= 0)
  );

  const nextLabelStops = new Set<number>([
    ...Array.from(fieldIndexes.values()).filter((value): value is number => value >= 0),
    ...specialIndexes,
  ]);

  const fieldRows = CERTIFICATE_FIELD_DEFINITIONS.map((definition) => {
    const fieldIndex = fieldIndexes.get(definition.key) ?? -1;
    const valueLines = fieldIndex >= 0
      ? (() => {
          const row = normalizedRows[fieldIndex];
          const sameRowValue = extractSameRowValue(row, definition.labels);

          if (sameRowValue && !definition.multiline) {
            return [sameRowValue];
          }

          const values: string[] = [];

          if (sameRowValue) {
            values.push(sameRowValue);
          }

          for (let index = fieldIndex + 1; index < normalizedRows.length; index += 1) {
            if (nextLabelStops.has(index)) {
              break;
            }

            if (isLabelRow(normalizedRows[index])) {
              break;
            }

            values.push(normalizedRows[index].text);

            if (!definition.multiline) {
              break;
            }
          }

          return values.map((value) => normalizeWhitespace(value)).filter(Boolean);
        })()
      : [];

    return {
      key: definition.key,
      label: definition.labels[0],
      valueLines,
    };
  });

  const issueIndex = findByText('발급번호');
  const processingIndex = findByText('처리기간');
  const titleIndex = findByText('사업자등록증명');
  const taxTypeIndex = indexOfRow((row) => row.normalized.includes(normalizeLoose('일반과세자')));
  const receiptIndex = findByText('접수번호');
  const departmentIndex = findByText('담당부서');
  const contactIndex = findByText('연락처');
  const certIndex = findByText('위와 같이 증명합니다');
  const jointIndex = findByText('공동 사업자');

  const extractHeaderValue = (index: number, label: string) => {
    if (index < 0) {
      return '';
    }

    const sameRowValue = extractSameRowValue(normalizedRows[index], [label]);

    if (sameRowValue) {
      return sameRowValue;
    }

    return normalizeWhitespace(normalizedRows[index + 1]?.text || '');
  };

  const receiptNumber = extractHeaderValue(receiptIndex, '접수번호');
  const department = extractHeaderValue(departmentIndex, '담당부서');
  const contact = extractHeaderValue(contactIndex, '연락처');
  const issuedDate = (() => {
    const dateRow = normalizedRows.find((row) => /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(row.text));
    return dateRow?.text || '';
  })();
  const official = (() => {
    const candidate = normalizedRows.find((row) => row.text.includes('세무서') || row.text.includes('세무'));
    return candidate?.text || '';
  })();
  const title = titleIndex >= 0 ? '사업자등록증명' : '';
  const taxType = taxTypeIndex >= 0 ? normalizedRows[taxTypeIndex].text : '';
  const jointBusinessStatus = jointIndex >= 0
    ? normalizedRows.slice(jointIndex + 1, Math.min(jointIndex + 4, normalizedRows.length)).map((row) => row.text).filter(Boolean)
    : [];
  const certificationText = certIndex >= 0 ? [normalizedRows[certIndex].text].filter(Boolean) : [];
  const cautionNote = normalizedRows.filter((row) => row.text.startsWith('※')).map((row) => row.text);
  const footerNotes = normalizedRows
    .filter((row) => row.text.startsWith('•') || row.text.includes('정부24') || row.text.includes('진위확인'))
    .map((row) => row.text);

  if (!title || !fieldRows.some((field) => field.valueLines.length > 0)) {
    return null;
  }

  return {
    issueNumber: extractHeaderValue(issueIndex, '발급번호'),
    processingTime: extractHeaderValue(processingIndex, '처리기간'),
    title,
    taxType,
    fields: fieldRows,
    jointBusinessStatus,
    certificationText,
    cautionNote,
    issuedDate,
    receiptNumber,
    department,
    official,
    contact,
    footerNotes,
  };
};

const isBusinessCertificateFamily = (
  model: TemplateExtractPdfRuleModel,
  sourceTitle: string,
  fileName: string
) => {
  const text = normalizeLoose(model.pages.flatMap((page) => page.ocrLines.map((line) => line.text)).join(' '));
  const sourceHint = normalizeLoose(`${sourceTitle} ${fileName}`);

  if (text.includes(normalizeLoose('사업자등록증명')) && text.includes(normalizeLoose('사업자등록번호'))) {
    return true;
  }

  return sourceHint.includes(normalizeLoose('사업자등록증'));
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
  async recoverHtml(sourceTitle: string, fileName: string, bytes: Uint8Array, version: '14' | '15' | '19' = '19') {
    const ruleModel = await extractRuleModel(fileName, bytes);

    if (!ruleModel.pages.length) {
      return null;
    }

    if (version === '19' && isBusinessCertificateFamily(ruleModel, sourceTitle, fileName)) {
      const structured = parseBusinessCertificate(ruleModel) ?? createDefaultBusinessCertificate();
      return buildBusinessCertificateHtml(structured);
    }

    if (version === '14') {
      return buildGridHtml(ruleModel);
    }

    return buildFrameHtml(ruleModel);
  },
};
