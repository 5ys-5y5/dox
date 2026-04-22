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
  | '23';

export const TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS: Array<{
  value: TemplateExtractEngineVersion;
  label: string;
}> = [
  { value: '5', label: 'v5' },
  { value: '7', label: 'v7' },
  { value: '8', label: 'v8' },
  { value: '9', label: 'v9' },
  { value: '10', label: 'v10' },
  { value: '11', label: 'v11' },
  { value: '12', label: 'v12' },
  { value: '13', label: 'v13' },
  { value: '14', label: 'v14' },
  { value: '15', label: 'v15' },
  { value: '16', label: 'v16' },
  { value: '17', label: 'v17' },
  { value: '18', label: 'v18' },
  { value: '19', label: 'v19' },
  { value: '20', label: 'v20' },
  { value: '21', label: 'v21' },
  { value: '22', label: 'v22' },
  { value: '23', label: 'v23' },
];

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
  source?: TemplateExtractPdfTextSource;
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

export type TemplateExtractPdfPipelineTrace = {
  engineVersion: TemplateExtractEngineVersion;
  sourceMode: TemplateExtractPdfSourceMode;
  documentFamily: TemplateExtractDocumentFamily;
  familyConfidenceScore: number;
  familyDetectionReasons: string[];
  topologySummary: TemplateExtractPdfTopologySummary;
  cloneBuilder: string;
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

export type TemplateExtractVisualSimilarityPageReport = {
  pageNumber: number;
  width: number;
  height: number;
  sourceInkPixelCount: number;
  replicaInkPixelCount: number;
  unionInkPixelCount: number;
  overlapInkPixelCount: number;
  exactOverlapInkPixelCount: number;
  overlapRatio: number;
  exactOverlapRatio: number;
  mismatchRatio: number;
  notes: string[];
};

export type TemplateExtractVisualSimilarityReport = {
  measured: boolean;
  measurementMode: 'browser_dom_capture' | 'browser_foreign_object_capture';
  tolerancePx: number;
  minimumPassScore: number;
  passed: boolean;
  overallScore: number;
  measuredAt: string;
  pageCount: number;
  notes: string[];
  pageReports: TemplateExtractVisualSimilarityPageReport[];
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
};

export type TemplateExtractApproveResult = {
  draftId: string;
  templateId: string;
  approvedFieldCount: number;
  skippedFieldCount: number;
  status: 'approved';
};
