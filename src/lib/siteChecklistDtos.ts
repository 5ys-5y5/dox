import type { SitePhotoLabelGapItemDto, SitePhotoLabelGapStatus } from './photoLabelDtos';

export type SiteChecklistItemStatus = 'missing' | 'completed';
export type SiteChecklistPhotoEvidenceStatus = 'not_required' | SitePhotoLabelGapStatus;

export type RequiredDocumentRuleInput = {
  tradeKey: string;
  documentTypeKey: string;
  documentTitle: string;
  description?: string | null;
};

export type SiteCreateInput = {
  siteName: string;
  tradeKeys?: string[];
  openDate: string;
  requiredDocumentRules?: RequiredDocumentRuleInput[];
};

export type SiteChecklistRebuildInput = {
  siteId: string;
  requiredDocumentRules?: RequiredDocumentRuleInput[];
};

export type SiteRecordDto = {
  id: string;
  siteName: string;
  tradeKeys: string[];
  openDate: string;
  checklistVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type SiteChecklistRuleDto = {
  id: string;
  tradeKey: string;
  documentTypeKey: string;
  documentTitle: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SiteChecklistItemDto = {
  id: string;
  siteId: string;
  checklistVersion: number;
  documentTypeKey: string;
  documentTitle: string;
  sourceTradeKeys: string[];
  status: SiteChecklistItemStatus;
  linkedDocumentId: string | null;
  generatedAt: string;
  photoEvidence: SiteChecklistPhotoEvidenceDto;
};

export type SiteChecklistPhotoEvidenceDto = {
  status: SiteChecklistPhotoEvidenceStatus;
  requirementCount: number;
  coveredCount: number;
  reviewNeededCount: number;
  missingCount: number;
  requirements: SitePhotoLabelGapItemDto[];
};

export type SiteChecklistSummaryDto = {
  site: SiteRecordDto;
  checklistVersion: number;
  generatedAt: string | null;
  requiredDocuments: SiteChecklistItemDto[];
  missingCount: number;
  completedCount: number;
  photoRequirementCount: number;
  photoCoveredCount: number;
  photoReviewNeededCount: number;
  photoMissingCount: number;
};

export type SiteCreateResult = {
  site: SiteRecordDto;
  checklistVersion: number;
  generatedChecklistCount: number;
};

export type SiteDeleteImpactItemDto = {
  key: string;
  label: string;
  count: number;
  description: string | null;
};

export type SiteDeleteImpactDto = {
  site: SiteRecordDto;
  items: SiteDeleteImpactItemDto[];
};

export type SiteDeleteResult = {
  site: SiteRecordDto;
  items: SiteDeleteImpactItemDto[];
};

export type SiteListResult = {
  siteCount: number;
  sites: SiteRecordDto[];
};

export type SiteChecklistRebuildResult = {
  site: SiteRecordDto;
  checklistVersion: number;
  itemCount: number;
  requiredDocuments: SiteChecklistItemDto[];
};
