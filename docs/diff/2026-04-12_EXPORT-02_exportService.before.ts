import { createClient } from '@supabase/supabase-js';
import type { DocumentArtifactDto, DocumentArtifactFormat } from '../lib/documentDtos';
import type {
  DocumentArtifactsResult,
  ExportJobCreateInput,
  ExportJobCreateResult,
  ExportJobDetailResult,
  ExportJobRecordDto,
  ExportTargetFormat,
} from '../lib/exportDtos';

type DocumentRegistryRow = {
  id: string;
  site_id: string;
  document_type_key: string;
  title: string;
  current_version_id: string | null;
  current_version_number: number | null;
  deleted_at: string | null;
};

type DocumentVersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  html_sha256: string;
  html_hash_algorithm: string;
  html_hash_encoding: string;
  html_canonicalization: string;
  html_byte_length: number;
  created_at: string;
};

type DocumentArtifactRow = {
  id: string;
  document_id: string;
  version_id: string;
  artifact_format: DocumentArtifactFormat;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ExportJobRow = {
  id: string;
  document_id: string;
  version_id: string;
  target_format: ExportTargetFormat;
  status: ExportJobRecordDto['status'];
  artifact_id: string | null;
  storage_path: string | null;
  mime_type: string | null;
  renderer_key: string | null;
  error_message: string | null;
  render_metadata: Record<string, unknown> | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const DOCUMENTS_DB_SCHEMA = 'documents';
const EXPORTS_DB_SCHEMA = 'exports';

// EXPORTS_SCHEMA_BOUNDARY
// 변환 저장 정본은 exports 스키마의 job 메타데이터와 documents 스키마의 artifact 메타데이터를 조합합니다.
// 실제 문서 본문은 수정하지 않고, 어떤 document/version 에서 출력이 생성되었는지만 기록합니다.
const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);
const exportsSchema = (client = getSupabase()) => client.schema(EXPORTS_DB_SCHEMA);

const toArtifactDto = (row: DocumentArtifactRow): DocumentArtifactDto => ({
  id: row.id,
  documentId: row.document_id,
  versionId: row.version_id,
  artifactFormat: row.artifact_format,
  storagePath: row.storage_path,
  mimeType: row.mime_type,
  fileSizeBytes: row.file_size_bytes,
  status: row.status,
  metadata: row.metadata || {},
  createdAt: row.created_at,
});

const toExportJobDto = (row: ExportJobRow): ExportJobRecordDto => ({
  id: row.id,
  documentId: row.document_id,
  versionId: row.version_id,
  targetFormat: row.target_format,
  status: row.status,
  artifactId: row.artifact_id,
  storagePath: row.storage_path,
  mimeType: row.mime_type,
  rendererKey: row.renderer_key,
  errorMessage: row.error_message,
  renderMetadata: row.render_metadata || {},
  requestedBy: row.requested_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getMimeTypeForFormat = (format: ExportTargetFormat) => {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'hwp':
      return 'application/x-hwp';
    default:
      return 'application/octet-stream';
  }
};

const getRendererKeyForFormat = (format: ExportTargetFormat) => {
  switch (format) {
    case 'pdf':
      return 'internal-html-to-pdf-v1';
    case 'docx':
      return 'internal-html-to-docx-v1';
    case 'hwp':
      return 'external-hwp-converter-required';
    default:
      return 'unknown';
  }
};

const getStoragePath = (documentId: string, versionId: string, jobId: string, format: ExportTargetFormat) =>
  `exports/${documentId}/${versionId}/${jobId}.${format}`;

const getDocumentAndVersion = async (client: ReturnType<typeof getSupabase>, documentId: string, versionId?: string | null) => {
  const documentsClient = documentsSchema(client);
  const { data: documentData, error: documentError } = await documentsClient
    .from('document_registry')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  const document = documentData as DocumentRegistryRow | null;

  if (documentError || !document) {
    throw new Error(`변환 작업 생성 실패: ${documentError?.message || '문서를 찾을 수 없습니다.'}`);
  }

  const targetVersionId = versionId?.trim() || document.current_version_id;

  if (!targetVersionId) {
    throw new Error('변환 작업 생성 실패: 대상 버전이 없습니다.');
  }

  const { data: versionData, error: versionError } = await documentsClient
    .from('document_versions')
    .select('*')
    .eq('id', targetVersionId)
    .eq('document_id', documentId)
    .single();

  const version = versionData as DocumentVersionRow | null;

  if (versionError || !version) {
    throw new Error(`변환 작업 생성 실패: ${versionError?.message || '문서 버전을 찾을 수 없습니다.'}`);
  }

  return { document, version };
};

export const ExportService = {
  async createExportJob(params: ExportJobCreateInput): Promise<ExportJobCreateResult> {
    const documentId = params.documentId.trim();

    if (!documentId) {
      throw new Error('변환 작업 생성 실패: documentId가 필요합니다.');
    }

    const client = getSupabase();
    const { document, version } = await getDocumentAndVersion(client, documentId, params.versionId || null);
    const exportsClient = exportsSchema(client);
    const documentsClient = documentsSchema(client);
    const mimeType = getMimeTypeForFormat(params.targetFormat);
    const rendererKey = getRendererKeyForFormat(params.targetFormat);
    const initialStatus = params.targetFormat === 'hwp' ? 'external_required' : 'queued';

    const { data: exportJobData, error: exportJobError } = await exportsClient
      .from('export_job_registry')
      .insert([
        {
          document_id: document.id,
          version_id: version.id,
          target_format: params.targetFormat,
          status: initialStatus,
          mime_type: mimeType,
          renderer_key: rendererKey,
          render_metadata: {
            documentTitle: document.title,
            documentTypeKey: document.document_type_key,
            htmlSha256: version.html_sha256,
            htmlHashAlgorithm: version.html_hash_algorithm,
            htmlHashEncoding: version.html_hash_encoding,
            htmlCanonicalization: version.html_canonicalization,
            htmlByteLength: version.html_byte_length,
            versionNumber: version.version_number,
          },
          requested_by: params.requestedBy?.trim() || null,
        },
      ])
      .select('*')
      .single();

    const exportJob = exportJobData as ExportJobRow | null;

    if (exportJobError || !exportJob) {
      throw new Error(`변환 작업 생성 실패: ${exportJobError?.message || 'export job을 저장할 수 없습니다.'}`);
    }

    if (params.targetFormat === 'hwp') {
      const storagePath = getStoragePath(document.id, version.id, exportJob.id, params.targetFormat);
      const { data: updatedJobData, error: updateJobError } = await exportsClient
        .from('export_job_registry')
        .update({
          storage_path: storagePath,
          render_metadata: {
            ...(exportJob.render_metadata || {}),
            externalConverterRequired: true,
            handoffStatus: 'pending',
          },
        })
        .eq('id', exportJob.id)
        .select('*')
        .single();

      if (updateJobError || !updatedJobData) {
        throw new Error(`변환 작업 생성 실패: HWP 경로 저장 중 오류가 발생했습니다. (${updateJobError?.message})`);
      }

      return {
        job: toExportJobDto(updatedJobData as ExportJobRow),
        artifact: null,
      };
    }

    const storagePath = getStoragePath(document.id, version.id, exportJob.id, params.targetFormat);
    const estimatedBytes = Math.max(1024, version.html_byte_length * (params.targetFormat === 'pdf' ? 4 : 6));
    const { data: artifactData, error: artifactError } = await documentsClient
      .from('document_artifacts')
      .insert([
        {
          document_id: document.id,
          version_id: version.id,
          artifact_format: params.targetFormat,
          storage_path: storagePath,
          mime_type: mimeType,
          file_size_bytes: estimatedBytes,
          status: 'completed',
          metadata: {
            exportJobId: exportJob.id,
            rendererKey,
            generatedMode: 'metadata-only-simulation',
            htmlSha256: version.html_sha256,
            versionNumber: version.version_number,
          },
        },
      ])
      .select('*')
      .single();

    const artifact = artifactData as DocumentArtifactRow | null;

    if (artifactError || !artifact) {
      throw new Error(`변환 작업 생성 실패: artifact 저장 중 오류가 발생했습니다. (${artifactError?.message})`);
    }

    const { data: updatedJobData, error: updateJobError } = await exportsClient
      .from('export_job_registry')
      .update({
        status: 'completed',
        artifact_id: artifact.id,
        storage_path: artifact.storage_path,
        mime_type: artifact.mime_type,
      })
      .eq('id', exportJob.id)
      .select('*')
      .single();

    if (updateJobError || !updatedJobData) {
      throw new Error(`변환 작업 생성 실패: export job 완료 처리 중 오류가 발생했습니다. (${updateJobError?.message})`);
    }

    return {
      job: toExportJobDto(updatedJobData as ExportJobRow),
      artifact: toArtifactDto(artifact),
    };
  },

  async getExportJob(exportJobId: string): Promise<ExportJobDetailResult> {
    const normalizedExportJobId = exportJobId.trim();

    if (!normalizedExportJobId) {
      throw new Error('변환 작업 조회 실패: exportJobId가 필요합니다.');
    }

    const client = getSupabase();
    const exportsClient = exportsSchema(client);
    const { data: exportJobData, error: exportJobError } = await exportsClient
      .from('export_job_registry')
      .select('*')
      .eq('id', normalizedExportJobId)
      .single();

    const exportJob = exportJobData as ExportJobRow | null;

    if (exportJobError || !exportJob) {
      throw new Error(`변환 작업 조회 실패: ${exportJobError?.message || 'export job을 찾을 수 없습니다.'}`);
    }

    if (!exportJob.artifact_id) {
      return {
        job: toExportJobDto(exportJob),
        artifact: null,
      };
    }

    const { data: artifactData, error: artifactError } = await documentsSchema(client)
      .from('document_artifacts')
      .select('*')
      .eq('id', exportJob.artifact_id)
      .single();

    const artifact = artifactData as DocumentArtifactRow | null;

    if (artifactError || !artifact) {
      throw new Error(`변환 작업 조회 실패: artifact 조회 중 오류가 발생했습니다. (${artifactError?.message})`);
    }

    return {
      job: toExportJobDto(exportJob),
      artifact: toArtifactDto(artifact),
    };
  },

  async listDocumentArtifacts(documentId: string): Promise<DocumentArtifactsResult> {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      throw new Error('출력본 목록 조회 실패: documentId가 필요합니다.');
    }

    const client = getSupabase();
    const { data, error } = await documentsSchema(client)
      .from('document_artifacts')
      .select('*')
      .eq('document_id', normalizedDocumentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`출력본 목록 조회 실패: ${error.message}`);
    }

    return {
      documentId: normalizedDocumentId,
      artifacts: ((data || []) as DocumentArtifactRow[]).map(toArtifactDto),
    };
  },
};
