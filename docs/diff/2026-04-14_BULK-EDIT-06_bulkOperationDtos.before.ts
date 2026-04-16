export type BulkChangeAction = 'upsert' | 'delete';

export type BulkPreviewStatus = 'draft' | 'committed' | 'expired';

export type BulkPreviewItemStatus = 'apply' | 'skip' | 'blocked';

export type BulkScalarValue = string | number | boolean | null;

export type BulkLabelChangeInput = {
  labelKey: string;
  action: BulkChangeAction;
  value?: BulkScalarValue;
};

export type BulkSignatureAuthorizationInput = {
  authenticationId: string;
  approvedBy?: string | null;
};

export type BulkPreviewInput = {
  documentIds: string[];
  labelChanges: BulkLabelChangeInput[];
  requestedBy?: string | null;
  signatureAuthorization?: BulkSignatureAuthorizationInput | null;
};

export type BulkPreviewRecordDto = {
  id: string;
  status: BulkPreviewStatus;
  requestedBy: string | null;
  documentCount: number;
  changeCount: number;
  warnings: string[];
  createdAt: string;
  committedAt: string | null;
};

export type BulkPreviewItemDto = {
  id: string;
  previewId: string;
  documentId: string;
  documentVersionId: string | null;
  documentTitle: string;
  labelKey: string;
  changeAction: BulkChangeAction;
  beforeValue: unknown;
  afterValue: unknown;
  itemStatus: BulkPreviewItemStatus;
  warningText: string | null;
  createdAt: string;
};

export type BulkPreviewResult = {
  preview: BulkPreviewRecordDto;
  items: BulkPreviewItemDto[];
  warnings: string[];
};

export type BulkCommitInput = {
  previewId: string;
  confirmedBy: string;
  signatureAuthorization?: BulkSignatureAuthorizationInput | null;
};

export type BulkCommitRecordDto = {
  id: string;
  previewId: string;
  confirmedBy: string;
  updatedDocumentCount: number;
  skippedDocumentCount: number;
  createdAt: string;
};

export type BulkCommitResult = {
  commit: BulkCommitRecordDto;
  preview: BulkPreviewRecordDto;
  updatedDocumentCount: number;
  skippedDocumentCount: number;
  updatedDocumentIds: string[];
  skippedDocumentIds: string[];
};
