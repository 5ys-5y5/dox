import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfFamilyDetectionResult,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfPipelineTrace,
  TemplateExtractPdfTopologyModel,
  TemplateExtractReplicaQualityReport,
  TemplateExtractResolvedSource,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfFamilyService } from './templateExtractPdfFamilyService';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';
import { TemplateExtractPdfTextRecoveryService, extractPdfRuleModel } from './templateExtractPdfTextRecoveryService';
import { TemplateExtractReplicaHtmlNormalizerService } from './templateExtractReplicaHtmlNormalizerService';
import { TemplateExtractReplicaOfflineQualityService } from './templateExtractReplicaOfflineQualityService';
import { TemplateExtractPdfTopologyService } from './templateExtractPdfTopologyService';
import { TemplateExtractPdfHtmlCloneService } from './templateExtractPdfHtmlCloneService';
import { TemplateExtractWorkOrderBuilderService } from './templateExtractWorkOrderBuilderService';
import { TemplateExtractWorkOrderTopologyBuilderService } from './templateExtractWorkOrderTopologyBuilderService';

const execFileAsync = promisify(execFile);

const PDF_LAYOUT_EXTRACT_SCRIPT = `import Foundation
import PDFKit
import Vision
import CoreGraphics
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

struct Line: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
  let source: String
}

struct PageModel: Codable {
  let pageNumber: Int
  let width: Double
  let height: Double
  let contentSource: String
  let lines: [Line]
}

struct Output: Codable {
  let rawText: String
  let pages: [PageModel]
}

func renderPageImage(_ page: PDFPage, bounds: CGRect) -> CGImage? {
  let scale: CGFloat = 4.0
  let imageSize = NSSize(
    width: max(bounds.width * scale, 1),
    height: max(bounds.height * scale, 1)
  )
  let thumbnail = page.thumbnail(of: imageSize, for: .mediaBox)

  guard let tiffData = thumbnail.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiffData) else {
    return nil
  }

  return bitmap.cgImage
}

func extractOcrLines(_ page: PDFPage, bounds: CGRect) -> [Line] {
  guard let image = renderPageImage(page, bounds: bounds) else {
    return []
  }

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
  var lines: [Line] = []

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
    let x = Double(box.origin.x) * Double(bounds.width)
    let y = Double(box.origin.y) * Double(bounds.height)
    let width = Double(box.size.width) * Double(bounds.width)
    let height = Double(box.size.height) * Double(bounds.height)

    lines.append(
      Line(
        text: text,
        x: x,
        y: y,
        width: width,
        height: height,
        source: "ocr"
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

var rawPages: [String] = []
var pages: [PageModel] = []

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else {
    continue
  }

  let pageBounds = page.bounds(for: .mediaBox)
  let pageText = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  var extractedLines: [Line] = []
  var pageContentSource = "text_layer"

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
          height: Double(bounds.size.height),
          source: "text_layer"
        )
      )
    }
  }

  if extractedLines.isEmpty && !pageText.isEmpty {
    pageContentSource = "fallback_text"
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
          height: lineHeight,
          source: "fallback_text"
        )
      )
    }
  }

  if extractedLines.isEmpty {
    extractedLines = extractOcrLines(page, bounds: pageBounds)
    pageContentSource = "ocr"
  }

  extractedLines.sort {
    if abs($0.y - $1.y) < 3 {
      return $0.x < $1.x
    }

    return $0.y > $1.y
  }

  if !pageText.isEmpty {
    rawPages.append(pageText)
  } else if !extractedLines.isEmpty {
    rawPages.append(extractedLines.map { $0.text }.joined(separator: "\\n"))
  }

  pages.append(
    PageModel(
      pageNumber: pageIndex + 1,
      width: Double(pageBounds.size.width),
      height: Double(pageBounds.size.height),
      contentSource: pageContentSource,
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
  '기타',
  '하도급 대금 연동에 관한 사항',
  '하도급대금 연동에 관한 사항',
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

export const normalizePdfFallbackText = (value: string) => {
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

export const extractPdfLayoutModel = async (
  fileName: string,
  bytes: Uint8Array
): Promise<TemplateExtractPdfLayoutModel> => {
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

const inferCloneBuilder = (
  detection: TemplateExtractPdfFamilyDetectionResult
): TemplateExtractPdfPipelineTrace['cloneBuilder'] => {
  if (detection.sourceMode === 'digital' && detection.documentFamily === 'work_order') {
    return 'work_order_family_digital';
  }

  if (detection.sourceMode === 'scanned' && detection.documentFamily === 'work_order') {
    return 'work_order_family_scanned';
  }

  if (detection.sourceMode === 'scanned' && detection.documentFamily === 'certificate') {
    return 'certificate_family_scanned';
  }

  if (detection.sourceMode === 'digital') {
    return 'generic_layout';
  }

  return 'generic_rule';
};

const buildPipelineTrace = (
  engineVersion: Extract<TemplateExtractEngineVersion, '19' | '20' | '21' | '22' | '23'>,
  detection: TemplateExtractPdfFamilyDetectionResult,
  topology: TemplateExtractPdfTopologyModel,
  cloneBuilder?: string
): TemplateExtractPdfPipelineTrace => ({
  engineVersion,
  sourceMode: detection.sourceMode,
  documentFamily: detection.documentFamily,
  familyConfidenceScore: Number(detection.confidenceScore.toFixed(2)),
  familyDetectionReasons: detection.detectionReasons,
  topologySummary: topology.summary,
  cloneBuilder: cloneBuilder || inferCloneBuilder(detection),
});

const overrideResolvedSourcePipelineVersion = (
  resolvedSource: TemplateExtractResolvedSource,
  engineVersion: Extract<TemplateExtractEngineVersion, '23'>
): TemplateExtractResolvedSource => {
  const nextPipelineTrace = resolvedSource.pipelineTrace
    ? {
        ...resolvedSource.pipelineTrace,
        engineVersion,
      }
    : null;

  if (resolvedSource.sourceKind === 'html' && nextPipelineTrace) {
    return {
      ...resolvedSource,
      sourceContent: attachPipelineTraceToHtml(resolvedSource.sourceContent, nextPipelineTrace),
      pipelineTrace: nextPipelineTrace,
    };
  }

  return {
    ...resolvedSource,
    pipelineTrace: nextPipelineTrace,
  };
};

const attachPipelineTraceToHtml = (html: string, pipelineTrace: TemplateExtractPdfPipelineTrace) => {
  return TemplateExtractReplicaHtmlNormalizerService.embedPipelineTrace(html, pipelineTrace);
};

const buildResolvedHtmlSource = (
  fileName: string,
  sourceTitle: string,
  html: string,
  pipelineTrace: TemplateExtractPdfPipelineTrace,
  qualityReport?: TemplateExtractReplicaQualityReport | null
): TemplateExtractResolvedSource => ({
  sourceTitle,
  sourceKind: 'html',
  sourceContent: qualityReport
    ? TemplateExtractReplicaHtmlNormalizerService.embedQualityReport(
        attachPipelineTraceToHtml(html, pipelineTrace),
        qualityReport
      )
    : attachPipelineTraceToHtml(html, pipelineTrace),
  originalFileName: fileName,
  originalMimeType: 'application/pdf',
  pipelineTrace,
  qualityReport: qualityReport || null,
});

const buildResolvedTextSource = (
  fileName: string,
  sourceTitle: string,
  text: string,
  pipelineTrace?: TemplateExtractPdfPipelineTrace,
  qualityReport?: TemplateExtractReplicaQualityReport | null
): TemplateExtractResolvedSource => ({
  sourceTitle,
  sourceKind: 'text',
  sourceContent: text,
  originalFileName: fileName,
  originalMimeType: 'application/pdf',
  pipelineTrace: pipelineTrace || null,
  qualityReport: qualityReport || null,
});

const buildOfflineDiagnosticReport = (
  sourceText: string,
  layout: TemplateExtractPdfLayoutModel,
  topology: TemplateExtractPdfTopologyModel,
  replicaHtml: string,
  options?: {
    fallbackApplied?: boolean;
    fallbackEngineVersion?: TemplateExtractEngineVersion | null;
    fallbackReason?: string | null;
  }
) =>
  TemplateExtractReplicaOfflineQualityService.evaluate({
    sourceText,
    sourceMode: topology.sourceMode,
    sourcePages: layout.pages,
    topologySummary: topology.summary,
    replicaHtml,
    fallbackApplied: options?.fallbackApplied ?? false,
    fallbackEngineVersion: options?.fallbackEngineVersion ?? null,
    fallbackReason: options?.fallbackReason ?? null,
    mode: 'offline',
    forceFailure: true,
  });

const buildOfflineQualityReport = (
  sourceText: string,
  layout: TemplateExtractPdfLayoutModel,
  topology: TemplateExtractPdfTopologyModel,
  replicaHtml: string,
  fallbackReason: string
) =>
  buildOfflineDiagnosticReport(sourceText, layout, topology, replicaHtml, {
    fallbackApplied: true,
    fallbackEngineVersion: '20',
    fallbackReason,
  });

const inferV22CloneBuilder = (
  detection: TemplateExtractPdfFamilyDetectionResult,
  options?: { ruleGuided?: boolean }
) => {
  const positionedFamily =
    detection.documentFamily === 'work_order'
      ? 'work_order_family_positioned'
      : detection.documentFamily === 'certificate'
        ? 'certificate_family_positioned'
        : 'generic_positioned';

  return options?.ruleGuided
    ? `${positionedFamily}_rule_guided_${detection.sourceMode}`
    : `${positionedFamily}_${detection.sourceMode}`;
};

const extractPdfSourceV19 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  const layout = await extractPdfLayoutModel(fileName, bytes);
  const rawText = layout.rawText;
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

  if (!rawText.trim()) {
    const recoveredHtml = await TemplateExtractPdfTextRecoveryService.recoverHtml(sourceTitle, fileName, bytes, '19');

    if (recoveredHtml) {
      return {
        sourceTitle,
        sourceKind: 'html',
        sourceContent: recoveredHtml,
        originalFileName: fileName,
        originalMimeType: 'application/pdf',
      };
    }

    throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했고, 이미지 기반 문서 틀 복제도 실패했습니다.');
  }

  const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText, layout, '19');

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
};

const extractPdfSourceV20 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  const layout = await extractPdfLayoutModel(fileName, bytes);
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
  const layoutDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, layout);

  if (layoutDetection.sourceMode === 'digital') {
    const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);
    const workOrderResult =
      layoutDetection.documentFamily === 'work_order'
        ? TemplateExtractWorkOrderBuilderService.buildFromDigitalLayout(sourceTitle, layout, topology, '20')
        : null;
    const clonedHtml = workOrderResult?.html || TemplateExtractPdfLayoutService.buildGenericCloneHtml(sourceTitle, layout);

    if (clonedHtml) {
      return buildResolvedHtmlSource(
        fileName,
        sourceTitle,
        clonedHtml,
        buildPipelineTrace('20', layoutDetection, topology, workOrderResult?.cloneBuilder)
      );
    }

    if (layout.rawText.trim()) {
      return buildResolvedTextSource(
        fileName,
        sourceTitle,
        normalizePdfFallbackText(layout.rawText),
        buildPipelineTrace('20', layoutDetection, topology, workOrderResult?.cloneBuilder)
      );
    }
  }

  const ruleModel = await extractPdfRuleModel(fileName, bytes);
  const ruleDetection = TemplateExtractPdfFamilyService.detectFromRuleModel(sourceTitle, fileName, ruleModel);
  const topology = TemplateExtractPdfTopologyService.buildFromScannedRuleModel(ruleModel);
  const workOrderResult =
    ruleDetection.documentFamily === 'work_order'
      ? TemplateExtractWorkOrderBuilderService.buildFromRuleModel(sourceTitle, fileName, ruleModel, topology, '20')
      : null;
  const recoveredHtml =
    workOrderResult?.html || TemplateExtractPdfTextRecoveryService.buildHtmlFromRuleModel(sourceTitle, fileName, ruleModel, '20');

  if (recoveredHtml) {
    return buildResolvedHtmlSource(
      fileName,
      sourceTitle,
      recoveredHtml,
      buildPipelineTrace('20', ruleDetection, topology, workOrderResult?.cloneBuilder)
    );
  }

  if (layout.rawText.trim()) {
    return buildResolvedTextSource(
      fileName,
      sourceTitle,
      normalizePdfFallbackText(layout.rawText),
      buildPipelineTrace('20', ruleDetection, topology, workOrderResult?.cloneBuilder)
    );
  }

  throw new Error('템플릿 추출 실패: family 판별과 topology 추출 후에도 HTML clone 을 만들지 못했습니다.');
};

const extractPdfSourceV21 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  // v21 is pinned to the v20 HTML generation path until a real pixel-overlap
  // measurement exists. Structural heuristics must not decide candidate selection.
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
  const layout = await extractPdfLayoutModel(fileName, bytes);
  const layoutDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, layout);

  if (layoutDetection.sourceMode === 'digital') {
    const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);
    const workOrderResult =
      layoutDetection.documentFamily === 'work_order'
        ? TemplateExtractWorkOrderBuilderService.buildFromDigitalLayout(sourceTitle, layout, topology, '20')
        : null;
    const clonedHtml = workOrderResult?.html || TemplateExtractPdfLayoutService.buildGenericCloneHtml(sourceTitle, layout);

    if (clonedHtml) {
      const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(clonedHtml, layout.pages);
      const pipelineTrace = buildPipelineTrace('21', layoutDetection, topology, workOrderResult?.cloneBuilder);
      const qualityReport = buildOfflineQualityReport(
        layout.rawText,
        layout,
        topology,
        html,
        'v21_measurement_unavailable_reused_v20_digital_builder'
      );
      return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
    }

    if (layout.rawText.trim()) {
      const pipelineTrace = buildPipelineTrace('21', layoutDetection, topology);
      const qualityReport = buildOfflineQualityReport(
        layout.rawText,
        layout,
        topology,
        '',
        'v21_html_only_bridge_v20_builder'
      );
      return buildResolvedTextSource(
        fileName,
        sourceTitle,
        normalizePdfFallbackText(layout.rawText),
        pipelineTrace,
        qualityReport
      );
    }
  }

  const ruleModel = await extractPdfRuleModel(fileName, bytes);
  const ruleDetection = TemplateExtractPdfFamilyService.detectFromRuleModel(sourceTitle, fileName, ruleModel);
  const topology = TemplateExtractPdfTopologyService.buildFromScannedRuleModel(ruleModel);
  const workOrderResult =
    ruleDetection.documentFamily === 'work_order'
      ? TemplateExtractWorkOrderBuilderService.buildFromRuleModel(sourceTitle, fileName, ruleModel, topology, '20')
      : null;
  const recoveredHtml =
    workOrderResult?.html || TemplateExtractPdfTextRecoveryService.buildHtmlFromRuleModel(sourceTitle, fileName, ruleModel, '20');

  if (recoveredHtml) {
    const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(recoveredHtml, layout.pages);
    const pipelineTrace = buildPipelineTrace('21', ruleDetection, topology, workOrderResult?.cloneBuilder);
    const qualityReport = buildOfflineQualityReport(
      ruleModel.rawText || layout.rawText,
      layout,
      topology,
      html,
      'v21_measurement_unavailable_reused_v20_scanned_builder'
    );
    return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
  }

  if (layout.rawText.trim()) {
    const pipelineTrace = buildPipelineTrace('21', ruleDetection, topology);
    const qualityReport = buildOfflineQualityReport(
      ruleModel.rawText || layout.rawText,
      layout,
      topology,
      '',
      'v21_html_only_bridge_v20_builder'
    );
    return buildResolvedTextSource(
      fileName,
      sourceTitle,
      normalizePdfFallbackText(layout.rawText),
      pipelineTrace,
      qualityReport
    );
  }

  throw new Error('템플릿 추출 실패: v21 bridge 경로에서도 replica HTML 을 만들지 못했습니다.');
};

const extractPdfSourceV22 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
  const layout = await extractPdfLayoutModel(fileName, bytes);
  const layoutDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, layout);
  const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);
  const digitalRuleModel =
    layoutDetection.sourceMode === 'digital'
      ? await extractPdfRuleModel(fileName, bytes).catch(() => null)
      : null;
  const positionedHtml = TemplateExtractPdfHtmlCloneService.buildPositionedCloneHtml(
    sourceTitle,
    layout,
    digitalRuleModel?.pages || []
  );

  if (positionedHtml) {
    const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(positionedHtml, layout.pages);
    const pipelineTrace = buildPipelineTrace(
      '22',
      layoutDetection,
      topology,
      inferV22CloneBuilder(layoutDetection, {
        ruleGuided: Boolean(
          digitalRuleModel?.pages.some((page) => page.rowRules.length >= 3 && page.columnRules.length >= 3)
        ),
      })
    );
    const qualityReport = buildOfflineDiagnosticReport(layout.rawText, layout, topology, html);

    return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
  }

  if (layoutDetection.sourceMode === 'digital') {
    const workOrderResult =
      layoutDetection.documentFamily === 'work_order'
        ? TemplateExtractWorkOrderBuilderService.buildFromDigitalLayout(sourceTitle, layout, topology, '20')
        : null;
    const clonedHtml = workOrderResult?.html || TemplateExtractPdfLayoutService.buildGenericCloneHtml(sourceTitle, layout);

    if (clonedHtml) {
      const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(clonedHtml, layout.pages);
      const pipelineTrace = buildPipelineTrace('22', layoutDetection, topology, workOrderResult?.cloneBuilder);
      const qualityReport = buildOfflineQualityReport(
        layout.rawText,
        layout,
        topology,
        html,
        'v22_positioned_builder_unavailable_reused_v20_digital_builder'
      );
      return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
    }

    if (layout.rawText.trim()) {
      const pipelineTrace = buildPipelineTrace('22', layoutDetection, topology);
      const qualityReport = buildOfflineQualityReport(
        layout.rawText,
        layout,
        topology,
        '',
        'v22_html_only_bridge_v20_builder'
      );
      return buildResolvedTextSource(
        fileName,
        sourceTitle,
        normalizePdfFallbackText(layout.rawText),
        pipelineTrace,
        qualityReport
      );
    }
  }

  const ruleModel = await extractPdfRuleModel(fileName, bytes);
  const ruleDetection = TemplateExtractPdfFamilyService.detectFromRuleModel(sourceTitle, fileName, ruleModel);
  const scannedTopology = TemplateExtractPdfTopologyService.buildFromScannedRuleModel(ruleModel);
  const workOrderResult =
    ruleDetection.documentFamily === 'work_order'
      ? TemplateExtractWorkOrderBuilderService.buildFromRuleModel(sourceTitle, fileName, ruleModel, scannedTopology, '20')
      : null;
  const recoveredHtml =
    workOrderResult?.html || TemplateExtractPdfTextRecoveryService.buildHtmlFromRuleModel(sourceTitle, fileName, ruleModel, '20');

  if (recoveredHtml) {
    const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(recoveredHtml, layout.pages);
    const pipelineTrace = buildPipelineTrace('22', ruleDetection, scannedTopology, workOrderResult?.cloneBuilder);
    const qualityReport = buildOfflineQualityReport(
      ruleModel.rawText || layout.rawText,
      layout,
      scannedTopology,
      html,
      'v22_positioned_builder_unavailable_reused_v20_scanned_builder'
    );
    return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
  }

  if (layout.rawText.trim()) {
    const pipelineTrace = buildPipelineTrace('22', ruleDetection, scannedTopology);
    const qualityReport = buildOfflineQualityReport(
      ruleModel.rawText || layout.rawText,
      layout,
      scannedTopology,
      '',
      'v22_html_only_bridge_v20_builder'
    );
    return buildResolvedTextSource(
      fileName,
      sourceTitle,
      normalizePdfFallbackText(layout.rawText),
      pipelineTrace,
      qualityReport
    );
  }

  throw new Error('템플릿 추출 실패: v22 positioned replica 경로에서도 HTML 을 만들지 못했습니다.');
};

const extractPdfSourceV23 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
  const layout = await extractPdfLayoutModel(fileName, bytes);
  const layoutDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, layout);

  if (layoutDetection.sourceMode === 'digital' && layoutDetection.documentFamily === 'work_order') {
    const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);
    const semanticHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, layout.rawText, layout, '23');

    if (semanticHtml) {
      const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(semanticHtml, layout.pages);
      const pipelineTrace = buildPipelineTrace(
        '23',
        layoutDetection,
        topology,
        'work_order_family_semantic_page_digital'
      );
      const qualityReport = buildOfflineDiagnosticReport(layout.rawText, layout, topology, html);

      return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
    }
  }

  return overrideResolvedSourcePipelineVersion(await extractPdfSourceV22(fileName, bytes), '23');
};

const extractPdfSourceV24 = async (fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> => {
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
  const layout = await extractPdfLayoutModel(fileName, bytes);
  const layoutDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, layout);

  if (layoutDetection.sourceMode === 'digital' && layoutDetection.documentFamily === 'work_order') {
    const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);
    const digitalRuleModel = await extractPdfRuleModel(fileName, bytes).catch(() => null);
    const svgReplicaHtml = TemplateExtractPdfHtmlCloneService.buildPositionedSvgCloneHtml(
      sourceTitle,
      layout,
      digitalRuleModel?.pages || []
    );

    if (svgReplicaHtml) {
      const html = TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(svgReplicaHtml, layout.pages);
      const pipelineTrace = buildPipelineTrace('24', layoutDetection, topology, 'work_order_family_positioned_svg_digital');
      const qualityReport = buildOfflineDiagnosticReport(layout.rawText, layout, topology, html);

      return buildResolvedHtmlSource(fileName, sourceTitle, html, pipelineTrace, qualityReport);
    }
  }

  return overrideResolvedSourcePipelineVersion(await extractPdfSourceV22(fileName, bytes), '24');
};

export const TemplateExtractPdfService = {
  // TEMPLATE_EXTRACT_PDF_PIPELINE
  // text-layer PDF 는 작업지시서형 form clone 경로를 우선 사용하고,
  // image PDF 는 별도 recovery 경로에서 family 별 HTML form clone 을 시도합니다.
  async extractPdfSource(
    fileName: string,
    bytes: Uint8Array,
    version: Extract<TemplateExtractEngineVersion, '19' | '20' | '21' | '22' | '23' | '24'> = '19'
  ): Promise<TemplateExtractResolvedSource> {
    if (version === '24') {
      return extractPdfSourceV24(fileName, bytes);
    }

    if (version === '23') {
      return extractPdfSourceV23(fileName, bytes);
    }

    if (version === '22') {
      return extractPdfSourceV22(fileName, bytes);
    }

    if (version === '21') {
      return extractPdfSourceV21(fileName, bytes);
    }

    if (version === '20') {
      return extractPdfSourceV20(fileName, bytes);
    }

    return extractPdfSourceV19(fileName, bytes);
  },
};
