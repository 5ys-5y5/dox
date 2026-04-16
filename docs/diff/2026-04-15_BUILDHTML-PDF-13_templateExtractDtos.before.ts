import type { TemplateFieldType, TemplateLayoutResizeMode } from './templateDtos';

export type TemplateExtractSourceKind = 'html' | 'text';

export type TemplateExtractEngineVersion = '5' | '7' | '8' | '9' | '10' | '11' | '12';

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
];

export type TemplateExtractDraftStatus = 'draft' | 'approved' | 'rejected';

export type TemplateExtractReviewStatus = 'accepted' | 'review_needed' | 'rejected';

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
};

export type TemplateExtractPdfLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateExtractPdfPage = {
  pageNumber: number;
  width: number;
  height: number;
  lines: TemplateExtractPdfLine[];
};

export type TemplateExtractPdfLayoutModel = {
  rawText: string;
  pages: TemplateExtractPdfPage[];
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
