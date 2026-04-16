import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import type { DocumentArtifactDto } from '../lib/documentDtos';
import type { HwpCallbackInput, HwpCallbackResult, HwpHandoffResult } from '../lib/exportDtos';

type ExportJobRow = {
  id: string;
  document_id: string;
  version_id: string;
  target_format: 'pdf' | 'docx' | 'hwp';
  status: 'queued' | 'completed' | 'failed' | 'external_required';
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

type DocumentArtifactRow = {
  id: string;
  document_id: string;
  version_id: string;
  artifact_format: DocumentArtifactDto['artifactFormat'];
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const DOCUMENTS_DB_SCHEMA = 'documents';
const EXPORTS_DB_SCHEMA = 'exports';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);
const exportsSchema = (client = getSupabase()) => client.schema(EXPORTS_DB_SCHEMA);

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const getCallbackSecret = () =>
  process.env.EXPORT_HWP_CALLBACK_SECRET ||
  process.env.AUTH_EVIDENCE_HMAC_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const buildExternalJobId = (exportJobId: string) => `hwp-ext-${exportJobId}`;

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

const getExportJob = async (client: ReturnType<typeof getSupabase>, exportJobId: string) => {
  const { data, error } = await exportsSchema(client).from('export_job_registry').select('*').eq('id', exportJobId).single();
  const exportJob = data as ExportJobRow | null;

  if (error || !exportJob) {
    throw new Error(`HWP handoff 실패: ${error?.message || 'export job을 찾을 수 없습니다.'}`);
  }

  return exportJob;
};

export const ExportHwpHandoffService = {
  async createHandoff(exportJobId: string, baseUrl: string): Promise<HwpHandoffResult> {
    const normalizedExportJobId = exportJobId.trim();

    if (!normalizedExportJobId) {
      throw new Error('HWP handoff 실패: exportJobId가 필요합니다.');
    }

    const callbackSecret = getCallbackSecret();

    if (!callbackSecret) {
      throw new Error('HWP handoff 실패: callback secret이 없습니다. EXPORT_HWP_CALLBACK_SECRET 설정이 필요합니다.');
    }

    const client = getSupabase();
    const exportJob = await getExportJob(client, normalizedExportJobId);

    if (exportJob.target_format !== 'hwp') {
      throw new Error('HWP handoff 실패: hwp export job만 handoff할 수 있습니다.');
    }

    if (exportJob.status !== 'external_required') {
      throw new Error('HWP handoff 실패: external_required 상태에서만 handoff를 생성할 수 있습니다.');
    }

    const callbackToken = randomBytes(24).toString('hex');
    const callbackTokenHash = sha256Hex(`${callbackSecret}:${callbackToken}`);
    const externalJobId = buildExternalJobId(exportJob.id);
    const callbackUrl = `${baseUrl.replace(/\/$/, '')}/api/exports/hwp-callback`;

    const payload = {
      externalJobId,
      exportJobId: exportJob.id,
      targetFormat: 'hwp',
      source: {
        documentId: exportJob.document_id,
        versionId: exportJob.version_id,
      },
      resultTarget: {
        storagePath: exportJob.storage_path,
        callbackUrl,
      },
      callback: {
        exportJobId: exportJob.id,
        callbackToken,
      },
    };

    const nextRenderMetadata = {
      ...(exportJob.render_metadata || {}),
      handoffStatus: 'prepared',
      handoffPreparedAt: new Date().toISOString(),
      callbackUrl,
      callbackTokenHash,
      externalJobId,
      handoffPayloadPreview: {
        externalJobId,
        exportJobId: exportJob.id,
        storagePath: exportJob.storage_path,
      },
    };

    const { error } = await exportsSchema(client)
      .from('export_job_registry')
      .update({
        render_metadata: nextRenderMetadata,
      })
      .eq('id', exportJob.id);

    if (error) {
      throw new Error(`HWP handoff 실패: ${error.message}`);
    }

    return {
      exportJobId: exportJob.id,
      externalJobId,
      callbackUrl,
      callbackToken,
      payload,
    };
  },

  async handleCallback(input: HwpCallbackInput): Promise<HwpCallbackResult> {
    const normalizedExportJobId = input.exportJobId.trim();
    const callbackToken = input.callbackToken.trim();

    if (!normalizedExportJobId || !callbackToken) {
      throw new Error('HWP callback 실패: exportJobId와 callbackToken이 필요합니다.');
    }

    const callbackSecret = getCallbackSecret();

    if (!callbackSecret) {
      throw new Error('HWP callback 실패: callback secret이 없습니다. EXPORT_HWP_CALLBACK_SECRET 설정이 필요합니다.');
    }

    const client = getSupabase();
    const exportJob = await getExportJob(client, normalizedExportJobId);
    const renderMetadata = exportJob.render_metadata || {};
    const expectedHash = typeof renderMetadata.callbackTokenHash === 'string' ? renderMetadata.callbackTokenHash : null;

    if (exportJob.target_format !== 'hwp') {
      throw new Error('HWP callback 실패: hwp export job만 처리할 수 있습니다.');
    }

    if (exportJob.status !== 'external_required') {
      throw new Error('HWP callback 실패: external_required 상태의 hwp export job만 처리할 수 있습니다.');
    }

    if (!expectedHash) {
      throw new Error('HWP callback 실패: handoff가 먼저 준비되지 않았습니다.');
    }

    if (expectedHash !== sha256Hex(`${callbackSecret}:${callbackToken}`)) {
      throw new Error('HWP callback 실패: callback token이 일치하지 않습니다.');
    }

    if (input.status === 'failed') {
      const nextRenderMetadata = {
        ...renderMetadata,
        handoffStatus: 'failed',
        callbackCompletedAt: new Date().toISOString(),
      };

      const { error } = await exportsSchema(client)
        .from('export_job_registry')
        .update({
          status: 'failed',
          error_message: input.errorMessage?.trim() || 'external hwp conversion failed',
          render_metadata: nextRenderMetadata,
        })
        .eq('id', exportJob.id);

      if (error) {
        throw new Error(`HWP callback 실패: ${error.message}`);
      }

      return {
        exportJobId: exportJob.id,
        status: 'failed',
        artifact: null,
      };
    }

    const storagePath = input.storagePath?.trim() || exportJob.storage_path || '';

    if (!storagePath) {
      throw new Error('HWP callback 실패: storagePath가 필요합니다.');
    }

    const documentsClient = documentsSchema(client);
    let artifact: DocumentArtifactRow | null = null;

    if (exportJob.artifact_id) {
      const { data: artifactData, error: artifactError } = await documentsClient
        .from('document_artifacts')
        .update({
          storage_path: storagePath,
          mime_type: 'application/x-hwp',
          file_size_bytes: input.fileSizeBytes ?? null,
          status: 'ready',
          metadata: {
            exportJobId: exportJob.id,
            actualBinaryMode: 'external-hwp-callback-v1',
            externalJobId: input.externalJobId?.trim() || renderMetadata.externalJobId || null,
            callbackCompletedAt: new Date().toISOString(),
          },
        })
        .eq('id', exportJob.artifact_id)
        .select('*')
        .single();

      artifact = artifactData as DocumentArtifactRow | null;

      if (artifactError || !artifact) {
        throw new Error(`HWP callback 실패: 기존 artifact 갱신 중 오류가 발생했습니다. (${artifactError?.message})`);
      }
    } else {
      const { data: artifactData, error: artifactError } = await documentsClient
        .from('document_artifacts')
        .insert([
          {
            document_id: exportJob.document_id,
            version_id: exportJob.version_id,
            artifact_format: 'hwp',
            storage_path: storagePath,
            mime_type: 'application/x-hwp',
            file_size_bytes: input.fileSizeBytes ?? null,
            status: 'ready',
            metadata: {
              exportJobId: exportJob.id,
              actualBinaryMode: 'external-hwp-callback-v1',
              externalJobId: input.externalJobId?.trim() || renderMetadata.externalJobId || null,
              callbackCompletedAt: new Date().toISOString(),
            },
          },
        ])
        .select('*')
        .single();

      artifact = artifactData as DocumentArtifactRow | null;

      if (artifactError || !artifact) {
        throw new Error(`HWP callback 실패: artifact 생성 중 오류가 발생했습니다. (${artifactError?.message})`);
      }
    }

    const nextRenderMetadata = {
      ...renderMetadata,
      handoffStatus: 'completed',
      callbackCompletedAt: new Date().toISOString(),
      externalJobId: input.externalJobId?.trim() || renderMetadata.externalJobId || null,
      finalStoragePath: storagePath,
    };

    const { error: updateJobError } = await exportsSchema(client)
      .from('export_job_registry')
      .update({
        status: 'completed',
        artifact_id: artifact.id,
        storage_path: storagePath,
        mime_type: 'application/x-hwp',
        error_message: null,
        render_metadata: nextRenderMetadata,
      })
      .eq('id', exportJob.id);

    if (updateJobError) {
      throw new Error(`HWP callback 실패: export job 완료 처리 중 오류가 발생했습니다. (${updateJobError.message})`);
    }

    return {
      exportJobId: exportJob.id,
      status: 'completed',
      artifact: toArtifactDto(artifact),
    };
  },
};
