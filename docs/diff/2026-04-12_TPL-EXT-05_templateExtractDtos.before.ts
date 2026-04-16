import type { TemplateFieldType, TemplateLayoutResizeMode } from './templateDtos';

export type TemplateExtractSourceKind = 'html' | 'text';

export type TemplateExtractDraftStatus = 'draft' | 'approved' | 'rejected';

export type TemplateExtractReviewStatus = 'accepted' | 'review_needed' | 'rejected';

export type TemplateExtractCreateInput = {
  sourceTitle?: string | null;
  sourceKind: TemplateExtractSourceKind;
  sourceContent: string;
  similarTemplateIds?: string[];
};

export type TemplateExtractConfidenceSummary = {
  candidateCount: number;
  acceptedCount: number;
  reviewNeededCount: number;
  rejectedCount: number;
  averageConfidenceScore: number;
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
