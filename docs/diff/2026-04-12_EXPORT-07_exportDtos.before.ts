import type { DocumentArtifactDto } from './documentDtos';

export type ExportTargetFormat = 'pdf' | 'docx' | 'hwp';

export type ExportJobStatus = 'queued' | 'completed' | 'failed' | 'external_required';

export type ExportJobCreateInput = {
  documentId: string;
  versionId?: string | null;
  targetFormat: ExportTargetFormat;
  requestedBy?: string | null;
};

export type ExportJobRecordDto = {
  id: string;
  documentId: string;
  versionId: string;
  targetFormat: ExportTargetFormat;
  status: ExportJobStatus;
  artifactId: string | null;
  storagePath: string | null;
  mimeType: string | null;
  rendererKey: string | null;
  errorMessage: string | null;
  renderMetadata: Record<string, unknown>;
  requestedBy: string | null;
  downloadSupported: boolean;
  downloadReady: boolean;
  downloadUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExportJobCreateResult = {
  job: ExportJobRecordDto;
  artifact: DocumentArtifactDto | null;
};

export type ExportJobDetailResult = {
  job: ExportJobRecordDto;
  artifact: DocumentArtifactDto | null;
};

export type DocumentArtifactsResult = {
  documentId: string;
  artifacts: DocumentArtifactDto[];
};
