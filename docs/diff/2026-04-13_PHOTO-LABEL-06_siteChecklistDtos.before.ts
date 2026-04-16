export type SiteChecklistItemStatus = 'missing' | 'completed';

export type RequiredDocumentRuleInput = {
  tradeKey: string;
  documentTypeKey: string;
  documentTitle: string;
  description?: string | null;
};

export type SiteCreateInput = {
  siteName: string;
  tradeKeys: string[];
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
};

export type SiteChecklistSummaryDto = {
  site: SiteRecordDto;
  checklistVersion: number;
  generatedAt: string | null;
  requiredDocuments: SiteChecklistItemDto[];
  missingCount: number;
  completedCount: number;
};

export type SiteCreateResult = {
  site: SiteRecordDto;
  checklistVersion: number;
  generatedChecklistCount: number;
};

export type SiteChecklistRebuildResult = {
  site: SiteRecordDto;
  checklistVersion: number;
  itemCount: number;
  requiredDocuments: SiteChecklistItemDto[];
};
