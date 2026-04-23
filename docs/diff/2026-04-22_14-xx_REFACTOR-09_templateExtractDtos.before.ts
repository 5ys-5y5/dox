import type { TemplateFieldType, TemplateLayoutResizeMode } from './templateDtos';

export type TemplateExtractSourceKind = 'html' | 'text';

export type TemplateExtractEngineVersion =
  | '5'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '21'
  | '22'
  | '23'
  | '24'
  | '25'
  | '26'
  | '27'
  | '28'
  | '29'
  | '30'
  | '31'
  | '32';

const toLegacyV1Label = (version: string) => `v1.${version.padStart(2, '0')}`;

export const TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS: Array<{
  value: TemplateExtractEngineVersion;
  label: string;
}> = [
  { value: '32', label: 'v2.01' },
  { value: '5', label: toLegacyV1Label('5') },
  { value: '7', label: toLegacyV1Label('7') },
  { value: '8', label: toLegacyV1Label('8') },
  { value: '9', label: toLegacyV1Label('9') },
  { value: '10', label: toLegacyV1Label('10') },
  { value: '11', label: toLegacyV1Label('11') },
  { value: '12', label: toLegacyV1Label('12') },
  { value: '13', label: toLegacyV1Label('13') },
  { value: '14', label: toLegacyV1Label('14') },
  { value: '15', label: toLegacyV1Label('15') },
  { value: '16', label: toLegacyV1Label('16') },
  { value: '17', label: toLegacyV1Label('17') },
  { value: '18', label: toLegacyV1Label('18') },
  { value: '19', label: toLegacyV1Label('19') },
  { value: '20', label: toLegacyV1Label('20') },
  { value: '21', label: toLegacyV1Label('21') },
  { value: '22', label: toLegacyV1Label('22') },
  { value: '23', label: toLegacyV1Label('23') },
  { value: '24', label: toLegacyV1Label('24') },
  { value: '25', label: toLegacyV1Label('25') },
  { value: '26', label: toLegacyV1Label('26') },
  { value: '27', label: toLegacyV1Label('27') },
  { value: '28', label: toLegacyV1Label('28') },
  { value: '29', label: toLegacyV1Label('29') },
  { value: '30', label: toLegacyV1Label('30') },
  { value: '31', label: toLegacyV1Label('31') },
];

export const formatTemplateExtractEngineVersionLabel = (
  version: TemplateExtractEngineVersion | 'unknown' | null | undefined
) => {
  if (!version || version === 'unknown') {
    return 'unknown';
  }

  return TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS.find((option) => option.value === version)?.label || version;
};

export type TemplateExtractDraftStatus = 'draft' | 'approved' | 'rejected';

export type TemplateExtractReviewStatus = 'accepted' | 'review_needed' | 'rejected';

export type TemplateExtractPdfTextSource = 'text_layer' | 'fallback_text' | 'ocr';

export type TemplateExtractPdfSourceMode = 'digital' | 'scanned';

export type TemplateExtractDocumentFamily = 'work_order' | 'certificate' | 'generic_form';

export type TemplateExtractCreateInput = {
  sourceTitle?: string | null;
  sourceKind: TemplateExtractSourceKind;
  sourceContent: string;
  similarTemplateIds?: string[];
  engineVersion?: TemplateExtractEngineVersion;
};

export type TemplateExtractResolvedSource = {
  sourceTitle: string | null;
  sourceKind: TemplateExtractSourceKind;
  sourceContent: string;
  originalFileName: string | null;
  originalMimeType: string | null;
  pipelineTrace?: TemplateExtractPdfPipelineTrace | null;
  qualityReport?: TemplateExtractReplicaQualityReport | null;
};

export type TemplateExtractPdfLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  fontSize?: number;
  source?: TemplateExtractPdfTextSource;
  characters?: TemplateExtractPdfCharacter[];
};

export type TemplateExtractPdfCharacter = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  fontSize?: number;
};

export type TemplateExtractPdfPage = {
  pageNumber: number;
  width: number;
  height: number;
  contentSource?: TemplateExtractPdfTextSource;
  lines: TemplateExtractPdfLine[];
};

export type TemplateExtractPdfLayoutModel = {
  rawText: string;
  pages: TemplateExtractPdfPage[];
};

export type TemplateExtractPdfRulePage = {
  pageNumber: number;
  width: number;
  height: number;
  rowRules: number[];
  columnRules: number[];
  horizontalSegments: TemplateExtractPdfRuleSegment[];
  verticalSegments: TemplateExtractPdfRuleSegment[];
  ocrLines: TemplateExtractPdfLine[];
};

export type TemplateExtractPdfRuleModel = {
  rawText: string;
  pages: TemplateExtractPdfRulePage[];
};

export type TemplateExtractPdfRuleSegment = {
  position: number;
  start: number;
  end: number;
  thickness: number;
};

export type TemplateExtractPdfGeometryCell = {
  text: string;
  x: number;
  right: number;
  width: number;
  height: number;
  startColumn: number;
  endColumn: number;
};

export type TemplateExtractPdfGeometryRow = {
  rowIndex: number;
  top: number;
  height: number;
  cells: TemplateExtractPdfGeometryCell[];
};

export type TemplateExtractPdfPageGeometry = {
  pageNumber: number;
  width: number;
  height: number;
  columnEdges: number[];
  rows: TemplateExtractPdfGeometryRow[];
};

export type TemplateExtractPdfGeometryModel = {
  rawText: string;
  pages: TemplateExtractPdfPageGeometry[];
};

export type TemplateExtractPdfTopologyRowBand = {
  rowIndex: number;
  top: number;
  bottom: number;
  height: number;
  source: 'geometry' | 'rule_interval' | 'ocr_cluster';
};

export type TemplateExtractPdfTopologyTextBlock = {
  text: string;
  x: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  textSource: TemplateExtractPdfTextSource;
};

export type TemplateExtractPdfTopologyCellCandidate = {
  rowIndex: number;
  startColumn: number;
  endColumn: number;
  text: string;
  x: number;
  right: number;
  width: number;
  height: number;
  source: 'geometry' | 'ocr_rule';
};

export type TemplateExtractPdfTopologyPage = {
  pageNumber: number;
  width: number;
  height: number;
  columnEdges: number[];
  rowBands: TemplateExtractPdfTopologyRowBand[];
  horizontalSegments: TemplateExtractPdfRuleSegment[];
  verticalSegments: TemplateExtractPdfRuleSegment[];
  textBlocks: TemplateExtractPdfTopologyTextBlock[];
  cellCandidates: TemplateExtractPdfTopologyCellCandidate[];
};

export type TemplateExtractPdfTopologySummary = {
  pageCount: number;
  rowBandCount: number;
  columnEdgeCount: number;
  horizontalSegmentCount: number;
  verticalSegmentCount: number;
  textBlockCount: number;
  cellCandidateCount: number;
};

export type TemplateExtractPdfTopologyModel = {
  sourceMode: TemplateExtractPdfSourceMode;
  rawText: string;
  pages: TemplateExtractPdfTopologyPage[];
  summary: TemplateExtractPdfTopologySummary;
};

export type TemplateExtractPdfFamilyDetectionResult = {
  sourceMode: TemplateExtractPdfSourceMode;
  documentFamily: TemplateExtractDocumentFamily;
  confidenceScore: number;
  matchedSignals: string[];
  detectionReasons: string[];
};

export type TemplateExtractPdfFramePolicy =
  | 'mask_vector_priority'
  | 'rule_geometry_only'
  | 'table_fragmented_rule_geometry'
  | 'table_fragmented_rule_geometry_mask_edges';

export type TemplateExtractPdfFrameSource =
  | 'mask_vector'
  | 'rule_geometry'
  | 'rule_only'
  | 'geometry_only'
  | 'mixed'
  | 'none';

export type TemplateExtractPdfFrameDiagnostics = {
  policy: TemplateExtractPdfFramePolicy;
  source: TemplateExtractPdfFrameSource;
  segmentCount: number;
  horizontalSegmentCount: number;
  verticalSegmentCount: number;
  maskVectorEnabled: boolean;
  maskVectorPageCount: number;
  maskRuleMinLength: number | null;
  fragmentCount?: number | null;
  giantTableRejected?: boolean | null;
};

export type TemplateExtractPdfPipelineTrace = {
  engineVersion: TemplateExtractEngineVersion;
  sourceMode: TemplateExtractPdfSourceMode;
  documentFamily: TemplateExtractDocumentFamily;
  familyConfidenceScore: number;
  familyDetectionReasons: string[];
  topologySummary: TemplateExtractPdfTopologySummary;
  cloneBuilder: string;
  frameDiagnostics?: TemplateExtractPdfFrameDiagnostics | null;
};

export type TemplateExtractReplicaQualityMode = 'browser' | 'offline' | 'hybrid';

export type TemplateExtractReplicaOfflineMetricSummary = {
  pageContractScore: number;
  textAnchorScore: number;
  vectorTopologyScore: number;
  imageFragmentScore: number;
  textContentScore: number;
  placeholderIntegrityScore: number;
  overallScore: number;
};

export type TemplateExtractReplicaQualityPageReport = {
  pageNumber: number;
  mismatchPixelRatio: number;
  hardFailures: string[];
  notes: string[];
};

export type TemplateExtractReplicaQualityReport = {
  passed: boolean;
  mode: TemplateExtractReplicaQualityMode;
  fallbackApplied: boolean;
  fallbackEngineVersion: TemplateExtractEngineVersion | null;
  fallbackReason: string | null;
  pageReports: TemplateExtractReplicaQualityPageReport[];
  offlineMetrics: TemplateExtractReplicaOfflineMetricSummary | null;
  summary: {
    maxMismatchPixelRatio: number;
    pageCount: number;
    hardFailureCount: number;
    overallScore: number;
  };
};

export type TemplateExtractVisualSimilarityLayerReport = {
  sourceInkPixelCount: number;
  replicaInkPixelCount: number;
  unionInkPixelCount: number;
  overlapInkPixelCount: number;
  exactOverlapInkPixelCount: number;
  overlapRatio: number;
  exactOverlapRatio: number;
  mismatchRatio: number;
};

export type TemplateExtractVisualSimilarityPageReport = TemplateExtractVisualSimilarityLayerReport & {
  pageNumber: number;
  width: number;
  height: number;
  frameLayerReport?: TemplateExtractVisualSimilarityLayerReport;
  textLayerReport?: TemplateExtractVisualSimilarityLayerReport;
  notes: string[];
};

export type TemplateExtractVisualSimilarityReport = {
  measured: boolean;
  measurementMode:
    | 'browser_dom_capture'
    | 'browser_foreign_object_capture'
    | 'server_headless_chrome_capture'
    | 'server_swift_template_render';
  tolerancePx: number;
  minimumPassScore: number;
  passed: boolean;
  overallScore: number;
  scoreMode?: 'frame_ink_overlap' | 'combined_ink_overlap';
  frameScore?: number;
  textScore?: number;
  combinedScore?: number;
  measuredAt: string;
  pageCount: number;
  notes: string[];
  pageReports: TemplateExtractVisualSimilarityPageReport[];
};

export type TemplateExtractReplicaRenderCheckboxOption = {
  label: string;
  checked: boolean;
};

export type TemplateExtractReplicaRenderTextItem =
  | {
      kind: 'plain';
      left: number;
      top: number;
      width: number;
      height: number;
      fontSize: number;
      lineHeight: number;
      fontWeight: number;
      text: string;
    }
  | {
      kind: 'status_line';
      left: number;
      top: number;
      width: number;
      height: number;
      fontSize: number;
      lineHeight: number;
      fontWeight: number;
      code: string;
      actor: string;
      timestamp: string;
    }
  | {
      kind: 'status_options';
      left: number;
      top: number;
      width: number;
      height: number;
      fontSize: number;
      lineHeight: number;
      fontWeight: number;
      options: TemplateExtractReplicaRenderCheckboxOption[];
    };

export type TemplateExtractReplicaRenderFrameSegment =
  | {
      orientation: 'h';
      left: number;
      top: number;
      width: number;
    }
  | {
      orientation: 'v';
      left: number;
      top: number;
      height: number;
    };

export type TemplateExtractReplicaRenderPage = {
  pageNumber: number;
  width: number;
  height: number;
  frameSegments: TemplateExtractReplicaRenderFrameSegment[];
  textItems: TemplateExtractReplicaRenderTextItem[];
};

export type TemplateExtractReplicaRenderModel = {
  version: 'positioned-v1';
  cloneId: string;
  pageCount: number;
  pages: TemplateExtractReplicaRenderPage[];
};

export type TemplateExtractConfidenceSummary = {
  candidateCount: number;
  acceptedCount: number;
  reviewNeededCount: number;
  rejectedCount: number;
  averageConfidenceScore: number;
};

export type TemplateExtractPair = {
  labelText: string;
  valueText: string;
  rowHtml?: string;
  valueHtml?: string;
};

export type TemplateExtractCandidateSeed = {
  candidateKey: string;
  fieldKey: string;
  labelKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  detectedValue: string;
  placeholder: string | null;
  defaultValue: unknown;
  options: string[];
  required: boolean;
  layoutBlockId: string | null;
  confidenceScore: number;
  reviewStatus: TemplateExtractReviewStatus;
  extractionReason: string;
  sortOrder: number;
};

export type TemplateExtractProjectionResult = {
  pairs: TemplateExtractPair[];
  candidates: TemplateExtractCandidateSeed[];
  generatedDraftHtml: string;
};

export type TemplateExtractAnalysisResult = TemplateExtractProjectionResult & {
  confidenceSummary: TemplateExtractConfidenceSummary;
};

export type TemplateExtractDraftDto = {
  id: string;
  sourceTitle: string | null;
  sourceKind: TemplateExtractSourceKind;
  sourceContent: string;
  generatedDraftHtml: string;
  status: TemplateExtractDraftStatus;
  confidenceSummary: TemplateExtractConfidenceSummary;
  similarTemplateIds: string[];
  approvedTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplateExtractCandidateDto = {
  id: string;
  draftId: string;
  candidateKey: string;
  fieldKey: string;
  labelKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  detectedValue: string | null;
  placeholder: string | null;
  defaultValue: unknown;
  options: string[];
  required: boolean;
  layoutBlockId: string | null;
  confidenceScore: number;
  reviewStatus: TemplateExtractReviewStatus;
  extractionReason: string | null;
  sortOrder: number;
};

export type TemplateExtractDetailResult = {
  draft: TemplateExtractDraftDto;
  candidates: TemplateExtractCandidateDto[];
  reviewSummary: TemplateExtractConfidenceSummary;
  pipelineTrace?: TemplateExtractPdfPipelineTrace | null;
  qualityReport?: TemplateExtractReplicaQualityReport | null;
};

export type TemplateExtractReviewedFieldInput = {
  candidateKey?: string;
  fieldKey: string;
  labelKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  required?: boolean;
  placeholder?: string | null;
  defaultValue?: unknown;
  options?: string[] | null;
  layoutBlockId?: string | null;
  sortOrder?: number | null;
  reviewStatus?: TemplateExtractReviewStatus;
};

export type TemplateExtractApproveInput = {
  templateName: string;
  layoutResizeMode?: TemplateLayoutResizeMode;
  reviewedFields?: TemplateExtractReviewedFieldInput[];
  generatedDraftHtml?: string;
};

export type TemplateExtractApproveResult = {
  draftId: string;
  templateId: string;
  approvedFieldCount: number;
  skippedFieldCount: number;
  status: 'approved';
};
