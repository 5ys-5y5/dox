import type { SitePhotoLabelGapItemDto, SitePhotoLabelGapStatus } from './photoLabelDtos';
import type { TemplateSchemaSnapshotInput } from './templateDtos';

export type DocumentLifecycleStatus = 'draft' | 'active' | 'archived' | 'deleted';

export type DocumentArtifactFormat = 'pdf' | 'docx' | 'hwp' | 'preview';

export type DocumentLabelValues = Record<string, unknown>;

export type DocumentValueFileMetadata = Record<string, unknown>;

export type DocumentValueFileInput = {
  valueKey: string;
  storageBucket: string;
  storagePath: string;
  originalFileName: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  sortOrder?: number | null;
  uploadedBy?: string | null;
  metadata?: DocumentValueFileMetadata;
};

export type DocumentValueFileDto = {
  id: string;
  documentId: string;
  versionId: string;
  valueKey: string;
  storageBucket: string;
  storagePath: string;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sortOrder: number;
  uploadedBy: string | null;
  uploadedAt: string;
  metadata: DocumentValueFileMetadata;
};

export type DocumentCreateInput = {
  siteId: string;
  documentTypeKey: string;
  title?: string;
  templateId?: string | null;
  htmlCanonical: string;
  labelValues: DocumentLabelValues;
  valueFiles?: DocumentValueFileInput[];
  createdBy?: string | null;
  templateSnapshot?: TemplateSchemaSnapshotInput | null;
};

export type DocumentVersionCreateInput = {
  htmlCanonical: string;
  labelValues: DocumentLabelValues;
  valueFiles?: DocumentValueFileInput[];
  changeReason?: string | null;
  createdBy?: string | null;
  templateSnapshot?: TemplateSchemaSnapshotInput | null;
};

export type DocumentListQuery = {
  siteId?: string | null;
  status?: DocumentLifecycleStatus | null;
  documentTypeKey?: string | null;
  latestOnly?: boolean;
};

export type DocumentRecordDto = {
  id: string;
  siteId: string;
  documentTypeKey: string;
  title: string;
  templateId: string | null;
  status: DocumentLifecycleStatus;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentVersionDto = {
  id: string;
  documentId: string;
  versionNumber: number;
  htmlCanonical: string;
  htmlSha256: string;
  htmlHashAlgorithm: string;
  htmlHashEncoding: string;
  htmlCanonicalization: string;
  htmlByteLength: number;
  labelValues: DocumentLabelValues;
  changeReason: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type DocumentArtifactDto = {
  id: string;
  documentId: string;
  versionId: string;
  artifactFormat: DocumentArtifactFormat;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DocumentPhotoEvidenceStatus = 'not_required' | SitePhotoLabelGapStatus;

export type DocumentPhotoEvidenceSummaryDto = {
  status: DocumentPhotoEvidenceStatus;
  requirementCount: number;
  coveredCount: number;
  reviewNeededCount: number;
  missingCount: number;
  requirements: SitePhotoLabelGapItemDto[];
};

export type DocumentDetailQueryDebugDto = Partial<
  Record<'versions' | 'artifacts' | 'valueFiles' | 'photoEvidence' | 'templateLink' | 'valueEntries', string>
>;

export type DocumentValueEntryDto = {
  id: string;
  documentId: string;
  valueKey: string;
  valuePayload: Record<string, unknown>;
  displayText: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export type DocumentTemplateLinkDto = {
  documentId: string;
  templateId: string;
  templateRevisionId: string | null;
  syncMode: 'follow_latest' | 'freeze_revision';
  autoSync: boolean;
  lastSyncedRevisionId: string | null;
  linkedAt: string;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type DocumentLinkedTemplateDto = {
  templateId: string;
  templateName: string;
  currentRevisionId: string | null;
  resolvedRevisionId: string | null;
  resolvedRevisionNumber: number | null;
  renderSnapshotHtml: string | null;
};

export type DocumentCreateResult = {
  document: DocumentRecordDto;
  latestVersion: DocumentVersionDto;
  artifacts: DocumentArtifactDto[];
  valueFiles: DocumentValueFileDto[];
};

export type DocumentDetailResult = {
  document: DocumentRecordDto;
  latestVersion: DocumentVersionDto | null;
  versions: DocumentVersionDto[];
  artifacts: DocumentArtifactDto[];
  valueFiles: DocumentValueFileDto[];
  valueEntries: DocumentValueEntryDto[];
  templateLink: DocumentTemplateLinkDto | null;
  linkedTemplate: DocumentLinkedTemplateDto | null;
  photoEvidence: DocumentPhotoEvidenceSummaryDto;
  queryDebug: DocumentDetailQueryDebugDto;
};

export type DocumentVersionCreateResult = {
  document: DocumentRecordDto;
  latestVersion: DocumentVersionDto;
  valueFiles: DocumentValueFileDto[];
};

export type DocumentListItem = {
  document: DocumentRecordDto;
  latestVersion: Pick<
    DocumentVersionDto,
    | 'id'
    | 'versionNumber'
    | 'htmlCanonical'
    | 'htmlSha256'
    | 'htmlHashAlgorithm'
    | 'htmlHashEncoding'
    | 'htmlCanonicalization'
    | 'htmlByteLength'
    | 'labelValues'
    | 'createdAt'
  > | null;
  artifactCount: number;
};

export type DocumentDeleteResult = {
  document: DocumentRecordDto;
};
