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
import { TemplateExtractPdfHybridCloneService } from './templateExtractPdfHybridCloneService';
import { TemplateExtractPdfTextRecoveryService, extractPdfRuleModel } from './templateExtractPdfTextRecoveryService';
import { TemplateExtractReplicaHtmlNormalizerService } from './templateExtractReplicaHtmlNormalizerService';
import { TemplateExtractReplicaOfflineQualityService } from './templateExtractReplicaOfflineQualityService';
import { TemplateExtractReplicaPixelSimilarityService } from './templateExtractReplicaPixelSimilarityService';
import { TemplateExtractPdfTopologyService } from './templateExtractPdfTopologyService';
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
  engineVersion: Extract<TemplateExtractEngineVersion, '19' | '20' | '21'>,
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

type ReplicaHtmlCandidate = {
  html: string;
  cloneBuilder: string;
};

const buildCandidateQualityReport = (
  sourceText: string,
  layout: TemplateExtractPdfLayoutModel,
  topology: TemplateExtractPdfTopologyModel,
  replicaHtml: string
) =>
  TemplateExtractReplicaOfflineQualityService.evaluate({
    sourceText,
    sourceMode: topology.sourceMode,
    sourcePages: layout.pages,
    topologySummary: topology.summary,
    replicaHtml,
    fallbackApplied: false,
    fallbackEngineVersion: null,
    fallbackReason: null,
    mode: 'offline',
    forceFailure: false,
  });

const buildOfflineQualityReport = (
  sourceText: string,
  layout: TemplateExtractPdfLayoutModel,
  topology: TemplateExtractPdfTopologyModel,
  replicaHtml: string,
  fallbackReason: string
) =>
  TemplateExtractReplicaOfflineQualityService.evaluate({
    sourceText,
    sourceMode: topology.sourceMode,
    sourcePages: layout.pages,
    topologySummary: topology.summary,
    replicaHtml,
    fallbackApplied: true,
    fallbackEngineVersion: '20',
    fallbackReason,
    mode: 'offline',
    forceFailure: true,
  });

const dedupeReplicaCandidates = (candidates: ReplicaHtmlCandidate[]) => {
  const seen = new Set<string>();
  const deduped: ReplicaHtmlCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedHtml = candidate.html.trim();

    if (!normalizedHtml || seen.has(normalizedHtml)) {
      continue;
    }

    seen.add(normalizedHtml);
    deduped.push({
      html: normalizedHtml,
      cloneBuilder: candidate.cloneBuilder,
    });
  }

  return deduped;
};

const withReplicaPageMetrics = (layout: TemplateExtractPdfLayoutModel, html: string) =>
  TemplateExtractReplicaHtmlNormalizerService.upsertPageMetrics(html, layout.pages);

const buildTopologyFromHybridLayout = (
  detection: TemplateExtractPdfFamilyDetectionResult,
  layout: TemplateExtractPdfLayoutModel
) => {
  const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);

  if (topology.sourceMode === detection.sourceMode) {
    return topology;
  }

  return {
    ...topology,
    sourceMode: detection.sourceMode,
  };
};

const getCandidateSelectionScore = (qualityReport: TemplateExtractReplicaQualityReport) => {
  const metrics = qualityReport.offlineMetrics;

  if (!metrics) {
    return -1;
  }

  return (
    metrics.overallScore * 0.5 +
    metrics.vectorTopologyScore * 0.2 +
    metrics.pageContractScore * 0.1 +
    metrics.textAnchorScore * 0.1 +
    metrics.placeholderIntegrityScore * 0.1 -
    qualityReport.summary.hardFailureCount * 0.15
  );
};

const selectBestReplicaCandidate = (
  sourceText: string,
  layout: TemplateExtractPdfLayoutModel,
  topology: TemplateExtractPdfTopologyModel,
  candidates: ReplicaHtmlCandidate[]
) => {
  const dedupedCandidates = dedupeReplicaCandidates(candidates);

  if (dedupedCandidates.length === 0) {
    return null;
  }

  const evaluatedCandidates = dedupedCandidates
    .map((candidate) => {
      const qualityReport = buildCandidateQualityReport(sourceText, layout, topology, candidate.html);

      return {
        candidate,
        qualityReport,
        selectionScore: getCandidateSelectionScore(qualityReport),
      };
    })
    .sort((left, right) => {
      if (right.selectionScore !== left.selectionScore) {
        return right.selectionScore - left.selectionScore;
      }

      const rightMetrics = right.qualityReport.offlineMetrics;
      const leftMetrics = left.qualityReport.offlineMetrics;

      if ((rightMetrics?.vectorTopologyScore || 0) !== (leftMetrics?.vectorTopologyScore || 0)) {
        return (rightMetrics?.vectorTopologyScore || 0) - (leftMetrics?.vectorTopologyScore || 0);
      }

      if ((rightMetrics?.textAnchorScore || 0) !== (leftMetrics?.textAnchorScore || 0)) {
        return (rightMetrics?.textAnchorScore || 0) - (leftMetrics?.textAnchorScore || 0);
      }

      return right.candidate.html.length - left.candidate.html.length;
    });

  return evaluatedCandidates[0];
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
  const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
  let fallbackReason = 'v21_hybrid_candidate_unavailable';

  try {
    const hybridArtifact = await TemplateExtractPdfHybridCloneService.extractArtifact(fileName, bytes, {
      sourceTitle,
      renderScale: 2,
      textLayerMode: 'invisible',
    });
    const hybridDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, hybridArtifact.layoutModel);
    const hybridTopology = buildTopologyFromHybridLayout(hybridDetection, hybridArtifact.layoutModel);
    const hybridQualityReport = TemplateExtractReplicaPixelSimilarityService.evaluateHybridReplica({
      candidateHtml: hybridArtifact.html,
      referencePageDataUrls: hybridArtifact.pageBackgroundDataUrls,
      minimumPassScore: 0.95,
    });

    if (hybridQualityReport.passed) {
      const pipelineTrace = buildPipelineTrace(
        '21',
        hybridDetection,
        hybridTopology,
        'hybrid_pdf_background_textlayer'
      );

      return buildResolvedHtmlSource(
        fileName,
        sourceTitle,
        hybridArtifact.html,
        pipelineTrace,
        hybridQualityReport
      );
    }

    fallbackReason = `v21_hybrid_below_threshold_${hybridQualityReport.summary.overallScore.toFixed(4)}`;
  } catch (error) {
    fallbackReason = `v21_hybrid_error_${error instanceof Error ? error.message : 'unknown'}`;
  }

  const layout = await extractPdfLayoutModel(fileName, bytes);
  const layoutDetection = TemplateExtractPdfFamilyService.detectFromLayout(sourceTitle, fileName, layout);

  if (layoutDetection.sourceMode === 'digital') {
    const topology = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout);
    const candidateResults: ReplicaHtmlCandidate[] = [];

    if (layoutDetection.documentFamily === 'work_order') {
      const topologyHtml = TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(sourceTitle, topology, '20');
      const legacyHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, layout.rawText, layout, '20');

      if (topologyHtml) {
        candidateResults.push({
          html: withReplicaPageMetrics(layout, topologyHtml),
          cloneBuilder: 'work_order_family_topology_digital',
        });
      }

      if (legacyHtml) {
        candidateResults.push({
          html: withReplicaPageMetrics(layout, legacyHtml),
          cloneBuilder: 'work_order_family_legacy_digital',
        });
      }
    }

    const genericHtml = TemplateExtractPdfLayoutService.buildGenericCloneHtml(sourceTitle, layout);

    if (genericHtml) {
      candidateResults.push({
        html: withReplicaPageMetrics(layout, genericHtml),
        cloneBuilder: 'generic_layout',
      });
    }

    const selectedCandidate = selectBestReplicaCandidate(layout.rawText, layout, topology, candidateResults);

    if (selectedCandidate) {
      const pipelineTrace = buildPipelineTrace(
        '21',
        layoutDetection,
        topology,
        selectedCandidate.candidate.cloneBuilder
      );
      const qualityReport = buildOfflineQualityReport(
        layout.rawText,
        layout,
        topology,
        selectedCandidate.candidate.html,
        fallbackReason
      );
      return buildResolvedHtmlSource(
        fileName,
        sourceTitle,
        selectedCandidate.candidate.html,
        pipelineTrace,
        qualityReport
      );
    }

    if (layout.rawText.trim()) {
      const pipelineTrace = buildPipelineTrace('21', layoutDetection, topology);
      const qualityReport = buildOfflineQualityReport(layout.rawText, layout, topology, '', fallbackReason);
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
  const scannedSourceText = ruleModel.rawText || layout.rawText;
  const scannedCandidates: ReplicaHtmlCandidate[] = [];

  if (ruleDetection.documentFamily === 'work_order') {
    const topologyHtml = TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(sourceTitle, topology, '20');

    if (topologyHtml) {
      scannedCandidates.push({
        html: withReplicaPageMetrics(layout, topologyHtml),
        cloneBuilder: 'work_order_family_topology_scanned',
      });
    }
  }

  const recoveredHtml = TemplateExtractPdfTextRecoveryService.buildHtmlFromRuleModel(sourceTitle, fileName, ruleModel, '20');

  if (recoveredHtml) {
    scannedCandidates.push({
      html: withReplicaPageMetrics(layout, recoveredHtml),
      cloneBuilder:
        ruleDetection.documentFamily === 'certificate'
          ? 'certificate_family_scanned'
          : ruleDetection.documentFamily === 'work_order'
            ? 'work_order_family_frame_scanned'
            : 'generic_rule',
    });
  }

  const selectedCandidate = selectBestReplicaCandidate(scannedSourceText, layout, topology, scannedCandidates);

  if (selectedCandidate) {
    const pipelineTrace = buildPipelineTrace('21', ruleDetection, topology, selectedCandidate.candidate.cloneBuilder);
    const qualityReport = buildOfflineQualityReport(
      scannedSourceText,
      layout,
      topology,
      selectedCandidate.candidate.html,
      fallbackReason
    );
    return buildResolvedHtmlSource(
      fileName,
      sourceTitle,
      selectedCandidate.candidate.html,
      pipelineTrace,
      qualityReport
    );
  }

  if (layout.rawText.trim()) {
    const pipelineTrace = buildPipelineTrace('21', ruleDetection, topology);
    const qualityReport = buildOfflineQualityReport(scannedSourceText, layout, topology, '', fallbackReason);
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

export const TemplateExtractPdfService = {
  // TEMPLATE_EXTRACT_PDF_PIPELINE
  // text-layer PDF 는 작업지시서형 form clone 경로를 우선 사용하고,
  // image PDF 는 별도 recovery 경로에서 family 별 HTML form clone 을 시도합니다.
  async extractPdfSource(
    fileName: string,
    bytes: Uint8Array,
    version: Extract<TemplateExtractEngineVersion, '19' | '20' | '21'> = '19'
  ): Promise<TemplateExtractResolvedSource> {
    if (version === '21') {
      return extractPdfSourceV21(fileName, bytes);
    }

    if (version === '20') {
      return extractPdfSourceV20(fileName, bytes);
    }

    return extractPdfSourceV19(fileName, bytes);
  },
};
