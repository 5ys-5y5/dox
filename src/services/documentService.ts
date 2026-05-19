import { createClient } from '@supabase/supabase-js';
import { generateDocumentHashInfo } from '../lib/crypto';
import { PhotoLabelRequirementService } from './photoLabelRequirementService';
import type {
  DocumentArtifactDto,
  DocumentCreateInput,
  DocumentCreateResult,
  DocumentDeleteResult,
  DocumentDetailResult,
  DocumentDetailQueryDebugDto,
  DocumentLinkedTemplateDto,
  DocumentPhotoEvidenceSummaryDto,
  DocumentTemplateLinkDto,
  DocumentValueEntryDto,
  DocumentValueFileDto,
  DocumentValueFileInput,
  DocumentListItem,
  DocumentListQuery,
  DocumentRecordDto,
  DocumentVersionCreateInput,
  DocumentVersionCreateResult,
  DocumentVersionDto,
} from '../lib/documentDtos';
import type { SitePhotoLabelGapItemDto } from '../lib/photoLabelDtos';

type DocumentRegistryRow = {
  id: string;
  site_id: string;
  document_type_key: string;
  title: string;
  template_id: string | null;
  status: DocumentRecordDto['status'];
  current_version_id: string | null;
  current_version_number: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentVersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  html_canonical: string;
  html_sha256: string;
  html_hash_algorithm: string;
  html_hash_encoding: string;
  html_canonicalization: string;
  html_byte_length: number;
  label_values: Record<string, unknown> | null;
  change_reason: string | null;
  created_by: string | null;
  created_at: string;
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

type DocumentValueFileRow = {
  id: string;
  document_id: string;
  version_id: string;
  value_key: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  uploaded_by: string | null;
  uploaded_at: string;
  metadata: Record<string, unknown> | null;
};

type DocumentTemplateLinkRow = {
  document_id: string;
  template_id: string;
  template_revision_id: string | null;
  sync_mode: DocumentTemplateLinkDto['syncMode'];
  auto_sync: boolean;
  last_synced_revision_id: string | null;
  linked_at: string;
  last_synced_at: string | null;
  updated_at: string;
};

type DocumentValueEntryRow = {
  id: string;
  document_id: string;
  value_key: string;
  value_payload: Record<string, unknown> | null;
  display_text: string | null;
  updated_by: string | null;
  updated_at: string;
};

type TemplateRegistryLinkRow = {
  id: string;
  template_name: string;
  current_revision_id: string | null;
};

type TemplateRegistryRevisionBootstrapRow = {
  id: string;
  template_name: string;
  draft_html: string;
  layout_resize_mode: string;
  current_revision_id: string | null;
};

type TemplateRevisionLinkRow = {
  id: string;
  template_id: string;
  revision_number: number;
  render_snapshot_html: string;
};

type TemplateRevisionPointerRow = {
  id: string;
  revision_number: number;
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
const TEMPLATES_DB_SCHEMA = 'templates';
const REQUEST_LINKS_DB_SCHEMA = 'request_links';
const SIGNING_DB_SCHEMA = 'signing';
const EXPORTS_DB_SCHEMA = 'exports';
const MESSAGING_DB_SCHEMA = 'messaging';
const BULK_OPS_DB_SCHEMA = 'bulk_ops';
const DOCUMENT_VALUE_FILE_STORAGE_BUCKET = 'document-value-files';
const DOCUMENT_VALUE_FILE_STORAGE_FILE_SIZE_LIMIT = 10485760;

// DOCUMENTS_SCHEMA_BOUNDARY
// 서류 클라우드 관리 도메인 테이블은 public이 아니라 documents 스키마만 사용합니다.
// 문서 메타데이터, 버전, 출력본 메타데이터는 documents.document_registry,
// documents.document_versions, documents.document_artifacts 가 정본입니다.
// 이후 LLM 구현도 public.documents_* 같은 우회 테이블을 만들지 말고
// 항상 documents 스키마 클라이언트를 통해 접근해야 합니다.
//
// SUPABASE_API_SCHEMA_REQUIRED
// server-side service role 로 schema('documents')를 사용하려면 PostgREST/Data API 가
// documents 스키마를 읽을 수 있어야 합니다.
// signing 전환과 같은 방식으로 documents 를 Exposed schemas / pgrst.db_schemas 에
// 포함해야 runtime 에서 "schema must be one of the following" 류 오류를 피할 수 있습니다.
const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);
const templatesSchema = (client = getSupabase()) => client.schema(TEMPLATES_DB_SCHEMA);
const requestLinksSchema = (client = getSupabase()) => client.schema(REQUEST_LINKS_DB_SCHEMA);
const signingSchema = (client = getSupabase()) => client.schema(SIGNING_DB_SCHEMA);
const exportsSchema = (client = getSupabase()) => client.schema(EXPORTS_DB_SCHEMA);
const messagingSchema = (client = getSupabase()) => client.schema(MESSAGING_DB_SCHEMA);
const bulkOpsSchema = (client = getSupabase()) => client.schema(BULK_OPS_DB_SCHEMA);

const toDocumentRecordDto = (row: DocumentRegistryRow): DocumentRecordDto => ({
  id: row.id,
  siteId: row.site_id,
  documentTypeKey: row.document_type_key,
  title: row.title,
  templateId: row.template_id,
  status: row.status,
  currentVersionId: row.current_version_id,
  currentVersionNumber: row.current_version_number,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDocumentVersionDto = (row: DocumentVersionRow): DocumentVersionDto => ({
  id: row.id,
  documentId: row.document_id,
  versionNumber: row.version_number,
  htmlCanonical: row.html_canonical,
  htmlSha256: row.html_sha256,
  htmlHashAlgorithm: row.html_hash_algorithm,
  htmlHashEncoding: row.html_hash_encoding,
  htmlCanonicalization: row.html_canonicalization,
  htmlByteLength: row.html_byte_length,
  labelValues: row.label_values || {},
  changeReason: row.change_reason,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const buildDefaultTitle = (documentTypeKey: string) => `${documentTypeKey} 문서`;

const sanitizeLabelValues = (labelValues: DocumentCreateInput['labelValues']) => {
  if (!labelValues || Array.isArray(labelValues) || typeof labelValues !== 'object') {
    throw new Error('문서 저장 실패: labelValues는 JSON 객체 형식이어야 합니다.');
  }

  return labelValues;
};

const toDocumentArtifactDto = (row: DocumentArtifactRow): DocumentArtifactDto => ({
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

const toDocumentValueFileDto = (row: DocumentValueFileRow): DocumentValueFileDto => ({
  id: row.id,
  documentId: row.document_id,
  versionId: row.version_id,
  valueKey: row.value_key,
  storageBucket: row.storage_bucket,
  storagePath: row.storage_path,
  originalFileName: row.original_file_name,
  mimeType: row.mime_type,
  fileSizeBytes: row.file_size_bytes,
  sortOrder: row.sort_order,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.uploaded_at,
  metadata: row.metadata || {},
});

const sanitizeStorageFileName = (value: string) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';

const resolveDocumentAttachmentExtension = (originalFileName: string, mimeType: string) => {
  const normalizedName = String(originalFileName || '').trim();
  const explicitExtension = normalizedName.includes('.') ? normalizedName.split('.').pop()?.trim().toLowerCase() || '' : '';

  if (explicitExtension) {
    return explicitExtension;
  }

  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();

  switch (normalizedMimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'application/vnd.ms-excel':
      return 'xls';
    case 'application/msword':
      return 'doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'application/x-hwp':
      return 'hwp';
    default:
      return 'bin';
  }
};

const buildDocumentValueFileStoragePath = (documentId: string, valueKey: string, originalFileName: string, mimeType: string) => {
  const safeDocumentId = sanitizeStorageFileName(documentId);
  const safeValueKey = sanitizeStorageFileName(valueKey);
  const extension = resolveDocumentAttachmentExtension(originalFileName, mimeType);
  const normalizedFileName = sanitizeStorageFileName(originalFileName).replace(new RegExp(`\\.${extension}$`, 'i'), '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `${safeDocumentId}/${safeValueKey}/${timestamp}-${crypto.randomUUID()}-${normalizedFileName}.${extension}`;
};

const ensureDocumentValueFileStorageBucket = async (client: ReturnType<typeof getSupabase>) => {
  const storageApi = client.storage as typeof client.storage & {
    getBucket?: (id: string) => Promise<{ data: unknown; error: { message?: string } | null }>;
    createBucket?: (
      id: string,
      options: { public: boolean; fileSizeLimit: number }
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  if (typeof storageApi.getBucket === 'function') {
    const existingBucket = await storageApi.getBucket(DOCUMENT_VALUE_FILE_STORAGE_BUCKET);

    if (!existingBucket.error) {
      return;
    }

    const shouldCreateBucket =
      existingBucket.error.message?.includes('not found') ||
      existingBucket.error.message?.includes('not exist');

    if (!shouldCreateBucket) {
      throw new Error(
        `첨부파일 업로드 실패: Storage 버킷 상태를 확인할 수 없습니다. (${existingBucket.error.message || '알 수 없는 오류'})`
      );
    }
  }

  if (typeof storageApi.createBucket !== 'function') {
    throw new Error('첨부파일 업로드 실패: Storage 버킷 자동 생성을 지원하지 않는 환경입니다.');
  }

  const createdBucket = await storageApi.createBucket(DOCUMENT_VALUE_FILE_STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: DOCUMENT_VALUE_FILE_STORAGE_FILE_SIZE_LIMIT,
  });

  if (createdBucket.error && !createdBucket.error.message?.includes('already exists')) {
    throw new Error(
      `첨부파일 업로드 실패: Storage 버킷을 자동 생성할 수 없습니다. (${createdBucket.error.message || '알 수 없는 오류'})`
    );
  }
};

const toDocumentTemplateLinkDto = (row: DocumentTemplateLinkRow): DocumentTemplateLinkDto => ({
  documentId: row.document_id,
  templateId: row.template_id,
  templateRevisionId: row.template_revision_id,
  syncMode: row.sync_mode,
  autoSync: row.auto_sync,
  lastSyncedRevisionId: row.last_synced_revision_id,
  linkedAt: row.linked_at,
  lastSyncedAt: row.last_synced_at,
  updatedAt: row.updated_at,
});

const toDocumentValueEntryDto = (row: DocumentValueEntryRow): DocumentValueEntryDto => ({
  id: row.id,
  documentId: row.document_id,
  valueKey: row.value_key,
  valuePayload: row.value_payload || {},
  displayText: row.display_text,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

const stringifyDocumentValueEntry = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const sanitizeDocumentValueFiles = (valueFiles?: DocumentValueFileInput[] | null): DocumentValueFileInput[] => {
  if (valueFiles == null) {
    return [];
  }

  if (!Array.isArray(valueFiles)) {
    throw new Error('문서 저장 실패: valueFiles는 배열 형식이어야 합니다.');
  }

  return valueFiles.map((valueFile, index) => {
    if (!valueFile || typeof valueFile !== 'object') {
      throw new Error(`문서 저장 실패: valueFiles[${index}] 형식이 올바르지 않습니다.`);
    }

    const valueKey = String(valueFile.valueKey || '').trim();
    const storageBucket = String(valueFile.storageBucket || '').trim();
    const storagePath = String(valueFile.storagePath || '').trim();
    const originalFileName = String(valueFile.originalFileName || '').trim();
    const sortOrder =
      valueFile.sortOrder == null ? index : Number.parseInt(String(valueFile.sortOrder), 10);
    const fileSizeBytes =
      valueFile.fileSizeBytes == null ? null : Number.parseInt(String(valueFile.fileSizeBytes), 10);

    if (!valueKey) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].valueKey가 필요합니다.`);
    }

    if (!storageBucket) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].storageBucket이 필요합니다.`);
    }

    if (!storagePath) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].storagePath가 필요합니다.`);
    }

    if (!originalFileName) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].originalFileName이 필요합니다.`);
    }

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].sortOrder는 0 이상의 정수여야 합니다.`);
    }

    if (fileSizeBytes !== null && (!Number.isFinite(fileSizeBytes) || fileSizeBytes < 0)) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].fileSizeBytes는 0 이상의 정수여야 합니다.`);
    }

    const metadata =
      valueFile.metadata == null
        ? {}
        : Array.isArray(valueFile.metadata) || typeof valueFile.metadata !== 'object'
          ? null
          : valueFile.metadata;

    if (metadata === null) {
      throw new Error(`문서 저장 실패: valueFiles[${index}].metadata는 JSON 객체 형식이어야 합니다.`);
    }

    return {
      valueKey,
      storageBucket,
      storagePath,
      originalFileName,
      mimeType: valueFile.mimeType?.trim() || null,
      fileSizeBytes,
      sortOrder,
      uploadedBy: valueFile.uploadedBy?.trim() || null,
      metadata,
    };
  });
};

const insertDocumentValueFiles = async (params: {
  documentsClient: ReturnType<typeof documentsSchema>;
  documentId: string;
  versionId: string;
  valueFiles: DocumentValueFileInput[];
}): Promise<DocumentValueFileDto[]> => {
  if (params.valueFiles.length === 0) {
    return [];
  }

  const { data, error } = await params.documentsClient
    .from('document_value_files')
    .insert(
      params.valueFiles.map((valueFile) => ({
        document_id: params.documentId,
        version_id: params.versionId,
        value_key: valueFile.valueKey,
        storage_bucket: valueFile.storageBucket,
        storage_path: valueFile.storagePath,
        original_file_name: valueFile.originalFileName,
        mime_type: valueFile.mimeType || null,
        file_size_bytes: valueFile.fileSizeBytes ?? null,
        sort_order: valueFile.sortOrder ?? 0,
        uploaded_by: valueFile.uploadedBy || null,
        metadata: valueFile.metadata || {},
      }))
    )
    .select('*');

  if (error) {
    throw new Error(`문서 저장 실패: 첨부파일 슬롯 저장 중 오류가 발생했습니다. (${error.message})`);
  }

  return ((data || []) as DocumentValueFileRow[])
    .sort((left, right) => left.sort_order - right.sort_order || left.original_file_name.localeCompare(right.original_file_name, 'ko'))
    .map(toDocumentValueFileDto);
};

const resolveTemplateRevisionIdForDocumentLink = async (params: {
  templatesClient: ReturnType<typeof templatesSchema>;
  templateId: string;
}): Promise<string> => {
  const normalizedTemplateId = params.templateId.trim();
  const { data: templateRegistryData, error: templateRegistryError } = await params.templatesClient
    .from('template_registry')
    .select('id, template_name, draft_html, layout_resize_mode, current_revision_id')
    .eq('id', normalizedTemplateId)
    .single();

  const templateRegistry = templateRegistryData as TemplateRegistryRevisionBootstrapRow | null;

  if (templateRegistryError || !templateRegistry) {
    throw new Error(
      `문서 저장 실패: 연결할 문서 양식을 찾지 못했습니다. (${templateRegistryError?.message || normalizedTemplateId})`
    );
  }

  if (templateRegistry.current_revision_id?.trim()) {
    return templateRegistry.current_revision_id.trim();
  }

  const { data: revisionRows, error: revisionLookupError } = await params.templatesClient
    .from('template_revisions')
    .select('id, revision_number')
    .eq('template_id', normalizedTemplateId)
    .order('revision_number', { ascending: false })
    .limit(1);

  if (revisionLookupError) {
    throw new Error(`문서 저장 실패: 문서 양식 리비전 조회 중 오류가 발생했습니다. (${revisionLookupError.message})`);
  }

  const latestRevision = ((revisionRows || []) as TemplateRevisionPointerRow[])[0] || null;

  if (latestRevision?.id) {
    const { error: pointerUpdateError } = await params.templatesClient
      .from('template_registry')
      .update({ current_revision_id: latestRevision.id })
      .eq('id', normalizedTemplateId);

    if (pointerUpdateError) {
      throw new Error(
        `문서 저장 실패: 문서 양식 현재 리비전 연결 중 오류가 발생했습니다. (${pointerUpdateError.message})`
      );
    }

    return latestRevision.id;
  }

  const fallbackDraftHtml = templateRegistry.draft_html?.trim() || '';

  if (!fallbackDraftHtml) {
    throw new Error(
      `문서 저장 실패: "${templateRegistry.template_name}" 문서 양식에 저장된 본문이 없어 연결용 리비전을 만들 수 없습니다.`
    );
  }

  const { data: bootstrapRevisionData, error: bootstrapRevisionError } = await params.templatesClient
    .from('template_revisions')
    .insert([
      {
        template_id: normalizedTemplateId,
        revision_number: 1,
        draft_html: fallbackDraftHtml,
        layout_resize_mode: templateRegistry.layout_resize_mode,
        render_snapshot_html: fallbackDraftHtml,
        frame_schema_json: [],
        relation_schema_json: [],
      },
    ])
    .select('id')
    .single();

  const bootstrapRevisionId = (bootstrapRevisionData as Pick<TemplateRevisionPointerRow, 'id'> | null)?.id || null;

  if (bootstrapRevisionError || !bootstrapRevisionId) {
    throw new Error(
      `문서 저장 실패: 문서 양식 기본 리비전 생성 중 오류가 발생했습니다. (${bootstrapRevisionError?.message || 'unknown'})`
    );
  }

  const { error: bootstrapPointerUpdateError } = await params.templatesClient
    .from('template_registry')
    .update({ current_revision_id: bootstrapRevisionId })
    .eq('id', normalizedTemplateId);

  if (bootstrapPointerUpdateError) {
    throw new Error(
      `문서 저장 실패: 기본 리비전 연결 중 오류가 발생했습니다. (${bootstrapPointerUpdateError.message})`
    );
  }

  return bootstrapRevisionId;
};

const upsertDocumentTemplateLink = async (params: {
  documentsClient: ReturnType<typeof documentsSchema>;
  templatesClient: ReturnType<typeof templatesSchema>;
  documentId: string;
  templateId: string;
}) => {
  const resolvedRevisionId = await resolveTemplateRevisionIdForDocumentLink({
    templatesClient: params.templatesClient,
    templateId: params.templateId,
  });
  const { error } = await params.documentsClient.from('document_template_links').upsert(
    [
      {
        document_id: params.documentId,
        template_id: params.templateId,
        template_revision_id: resolvedRevisionId,
        sync_mode: 'follow_latest',
        auto_sync: true,
      },
    ],
    {
      onConflict: 'document_id',
    }
  );

  if (error) {
    throw new Error(`문서 저장 실패: 템플릿 연결 저장 중 오류가 발생했습니다. (${error.message})`);
  }
};

const upsertDocumentValueEntries = async (params: {
  documentsClient: ReturnType<typeof documentsSchema>;
  documentId: string;
  labelValues: Record<string, unknown>;
  updatedBy?: string | null;
}): Promise<DocumentValueEntryDto[]> => {
  const entries = Object.entries(params.labelValues)
    .map(([valueKey, rawValue]) => {
      const normalizedValueKey = String(valueKey || '').trim();

      if (!normalizedValueKey) {
        return null;
      }

      return {
        document_id: params.documentId,
        value_key: normalizedValueKey,
        value_payload: {
          value: rawValue ?? null,
        },
        display_text: stringifyDocumentValueEntry(rawValue) || null,
        updated_by: params.updatedBy?.trim() || null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (entries.length === 0) {
    return [];
  }

  const { data, error } = await params.documentsClient
    .from('document_value_entries')
    .upsert(entries, { onConflict: 'document_id,value_key' })
    .select('*');

  if (error) {
    throw new Error(`문서 저장 실패: 문서 값 저장 중 오류가 발생했습니다. (${error.message})`);
  }

  return ((data || []) as DocumentValueEntryRow[]).map(toDocumentValueEntryDto);
};

const buildDocumentPhotoEvidenceSummary = (
  requirements: SitePhotoLabelGapItemDto[]
): DocumentPhotoEvidenceSummaryDto => {
  if (requirements.length === 0) {
    return {
      status: 'not_required',
      requirementCount: 0,
      coveredCount: 0,
      reviewNeededCount: 0,
      missingCount: 0,
      requirements: [],
    };
  }

  const coveredCount = requirements.filter((item) => item.coverageStatus === 'covered').length;
  const reviewNeededCount = requirements.filter((item) => item.coverageStatus === 'review_needed').length;
  const missingCount = requirements.filter((item) => item.coverageStatus === 'missing').length;

  return {
    status: missingCount > 0 ? 'missing' : reviewNeededCount > 0 ? 'review_needed' : 'covered',
    requirementCount: requirements.length,
    coveredCount,
    reviewNeededCount,
    missingCount,
    requirements,
  };
};

type StorageObjectRef = {
  bucket: string | null;
  path: string | null;
};

const removeStorageObjects = async (
  client: ReturnType<typeof getSupabase>,
  objects: StorageObjectRef[],
  errorPrefix: string
) => {
  const bucketToPaths = new Map<string, string[]>();

  for (const object of objects) {
    const bucket = object.bucket?.trim() || '';
    const path = object.path?.trim() || '';

    if (!bucket || !path) {
      continue;
    }

    const bucketPaths = bucketToPaths.get(bucket) || [];
    bucketPaths.push(path);
    bucketToPaths.set(bucket, bucketPaths);
  }

  for (const [bucket, paths] of Array.from(bucketToPaths.entries())) {
    const uniquePaths = Array.from(new Set(paths));

    if (uniquePaths.length === 0) {
      continue;
    }

    const { error } = await client.storage.from(bucket).remove(uniquePaths);

    if (error && !error.message?.includes('not found') && !error.message?.includes('does not exist')) {
      throw new Error(`${errorPrefix}: ${error.message}`);
    }
  }
};

const getDocumentRegistryById = async (documentId: string) => {
  const { data, error } = await documentsSchema()
    .from('document_registry')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();

  return { document: data as DocumentRegistryRow | null, error };
};

class DocumentDetailQueryError extends Error {
  debug: DocumentDetailQueryDebugDto;

  constructor(message: string, debug: DocumentDetailQueryDebugDto) {
    super(message);
    this.name = 'DocumentDetailQueryError';
    this.debug = debug;
  }
}

export const DocumentService = {
  async createDocument(params: DocumentCreateInput): Promise<DocumentCreateResult> {
    if (!params.siteId.trim()) {
      throw new Error('문서 저장 실패: siteId가 필요합니다.');
    }

    if (!params.documentTypeKey.trim()) {
      throw new Error('문서 저장 실패: documentTypeKey가 필요합니다.');
    }

    if (!params.htmlCanonical.trim()) {
      throw new Error('문서 저장 실패: htmlCanonical이 비어 있습니다.');
    }

    const client = getSupabase();
    const documentsClient = documentsSchema(client);
    const templatesClient = templatesSchema(client);
    const labelValues = sanitizeLabelValues(params.labelValues);
    const valueFiles = sanitizeDocumentValueFiles(params.valueFiles);
    const htmlHashInfo = generateDocumentHashInfo(params.htmlCanonical);

    const { data: documentData, error: documentError } = await documentsClient
      .from('document_registry')
      .insert([
        {
          site_id: params.siteId,
          document_type_key: params.documentTypeKey,
          title: params.title?.trim() || buildDefaultTitle(params.documentTypeKey),
          template_id: params.templateId || null,
          status: 'active',
        },
      ])
      .select('*')
      .single();

    const document = documentData as DocumentRegistryRow | null;

    if (documentError || !document) {
      throw new Error(`문서 저장 실패: 메타데이터 생성 중 오류가 발생했습니다. (${documentError?.message})`);
    }

    const { data: versionData, error: versionError } = await documentsClient
      .from('document_versions')
      .insert([
        {
          document_id: document.id,
          version_number: 1,
          html_canonical: params.htmlCanonical,
          html_sha256: htmlHashInfo.hash,
          html_hash_algorithm: htmlHashInfo.algorithm,
          html_hash_encoding: htmlHashInfo.encoding,
          html_canonicalization: htmlHashInfo.canonicalization,
          html_byte_length: htmlHashInfo.byteLength,
          label_values: labelValues,
          change_reason: 'initial-create',
          created_by: params.createdBy || null,
        },
      ])
      .select('*')
      .single();

    const version = versionData as DocumentVersionRow | null;

    if (versionError || !version) {
      await documentsClient.from('document_registry').delete().eq('id', document.id);
      throw new Error(`문서 저장 실패: 버전 생성 중 오류가 발생했습니다. (${versionError?.message})`);
    }

    let createdValueFiles: DocumentValueFileDto[] = [];

    try {
      createdValueFiles = await insertDocumentValueFiles({
        documentsClient,
        documentId: document.id,
        versionId: version.id,
        valueFiles,
      });

      await upsertDocumentValueEntries({
        documentsClient,
        documentId: document.id,
        labelValues,
        updatedBy: params.createdBy || null,
      });

      if (params.templateId?.trim()) {
        await upsertDocumentTemplateLink({
          documentsClient,
          templatesClient,
          documentId: document.id,
          templateId: params.templateId.trim(),
        });
      }
    } catch (error) {
      await documentsClient.from('document_versions').delete().eq('id', version.id);
      await documentsClient.from('document_registry').delete().eq('id', document.id);
      throw error;
    }

    const { data: updatedDocumentData, error: updateError } = await documentsClient
      .from('document_registry')
      .update({
        current_version_id: version.id,
        current_version_number: version.version_number,
      })
      .eq('id', document.id)
      .select('*')
      .single();

    const updatedDocument = (updatedDocumentData || document) as DocumentRegistryRow;

    if (updateError) {
      throw new Error(`문서 저장 실패: 최신 버전 포인터 갱신에 실패했습니다. (${updateError.message})`);
    }

    return {
      document: toDocumentRecordDto(updatedDocument),
      latestVersion: toDocumentVersionDto(version),
      artifacts: [],
      valueFiles: createdValueFiles,
    };
  },

  async listDocuments(query: DocumentListQuery = {}): Promise<DocumentListItem[]> {
    const client = getSupabase();
    let registryQuery = documentsSchema(client)
      .from('document_registry')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (query.siteId?.trim()) {
      registryQuery = registryQuery.eq('site_id', query.siteId.trim());
    }

    if (query.status?.trim()) {
      registryQuery = registryQuery.eq('status', query.status.trim());
    }

    if (query.documentTypeKey?.trim()) {
      registryQuery = registryQuery.eq('document_type_key', query.documentTypeKey.trim());
    }

    const { data: registryData, error: registryError } = await registryQuery;
    const registryRows = (registryData || []) as DocumentRegistryRow[];

    if (registryError) {
      throw new Error(`문서 목록 조회 실패: ${registryError.message}`);
    }

    if (registryRows.length === 0) {
      return [];
    }

    const currentVersionIds = registryRows
      .map((row) => row.current_version_id)
      .filter((value): value is string => Boolean(value));

    const documentIds = registryRows.map((row) => row.id);

    const [versionResponse, artifactResponse] = await Promise.all([
      currentVersionIds.length > 0
        ? documentsSchema(client).from('document_versions').select('*').in('id', currentVersionIds)
        : Promise.resolve({ data: [], error: null }),
      documentsSchema(client).from('document_artifacts').select('id, document_id').in('document_id', documentIds),
    ]);

    if (versionResponse.error) {
      throw new Error(`문서 목록 조회 실패: 최신 버전 조회 중 오류가 발생했습니다. (${versionResponse.error.message})`);
    }

    if (artifactResponse.error) {
      throw new Error(`문서 목록 조회 실패: 출력본 메타데이터 조회 중 오류가 발생했습니다. (${artifactResponse.error.message})`);
    }

    const versionById = new Map(
      ((versionResponse.data || []) as DocumentVersionRow[]).map((row) => [row.id, row] as const)
    );

    const artifactCountByDocumentId = ((artifactResponse.data || []) as Array<{ id: string; document_id: string }>)
      .reduce<Record<string, number>>((counts, row) => {
        counts[row.document_id] = (counts[row.document_id] || 0) + 1;

        return counts;
      }, {});

    return registryRows.map((row) => {
      const latestVersion = row.current_version_id ? versionById.get(row.current_version_id) || null : null;
      const latestVersionDto = latestVersion ? toDocumentVersionDto(latestVersion) : null;

      return {
        document: toDocumentRecordDto(row),
        latestVersion: latestVersionDto
          ? {
              id: latestVersionDto.id,
              versionNumber: latestVersionDto.versionNumber,
              htmlCanonical: latestVersionDto.htmlCanonical,
              htmlSha256: latestVersionDto.htmlSha256,
              htmlHashAlgorithm: latestVersionDto.htmlHashAlgorithm,
              htmlHashEncoding: latestVersionDto.htmlHashEncoding,
              htmlCanonicalization: latestVersionDto.htmlCanonicalization,
              htmlByteLength: latestVersionDto.htmlByteLength,
              labelValues: latestVersionDto.labelValues,
              createdAt: latestVersionDto.createdAt,
            }
          : null,
        artifactCount: artifactCountByDocumentId[row.id] || 0,
      };
    });
  },

  // DOC_CLOUD_DETAIL_API
  // 상세 조회는 document_registry 를 기준으로 최신 버전, 전체 버전 이력,
  // 출력본 메타데이터를 함께 반환합니다.
  async getDocumentDetail(documentId: string): Promise<DocumentDetailResult> {
    if (!documentId.trim()) {
      throw new Error('문서 상세 조회 실패: documentId가 필요합니다.');
    }

    const client = getSupabase();
    const documentsClient = documentsSchema(client);
    const { document, error: documentError } = await getDocumentRegistryById(documentId.trim());

    if (documentError || !document) {
      throw new Error(`문서 상세 조회 실패: ${documentError?.message || '문서를 찾을 수 없습니다.'}`);
    }

    const [versionsResponse, artifactsResponse, photoGapSummaryResponse, templateLinkResponse, valueEntriesResponse] =
      await Promise.allSettled([
      documentsClient
        .from('document_versions')
        .select('*')
        .eq('document_id', document.id)
        .order('version_number', { ascending: false }),
      documentsClient
        .from('document_artifacts')
        .select('*')
        .eq('document_id', document.id)
        .order('created_at', { ascending: false }),
      PhotoLabelRequirementService.getSitePhotoLabelGaps(document.site_id),
      documentsClient.from('document_template_links').select('*').eq('document_id', document.id).maybeSingle(),
      documentsClient.from('document_value_entries').select('*').eq('document_id', document.id).order('value_key', {
        ascending: true,
      }),
    ]);
    const queryDebug: DocumentDetailQueryDebugDto = {};
    const versionsResponseData =
      versionsResponse.status === 'fulfilled'
        ? versionsResponse.value
        : { data: null, error: { message: versionsResponse.reason instanceof Error ? versionsResponse.reason.message : 'unknown' } };
    const artifactsResponseData =
      artifactsResponse.status === 'fulfilled'
        ? artifactsResponse.value
        : { data: null, error: { message: artifactsResponse.reason instanceof Error ? artifactsResponse.reason.message : 'unknown' } };

    if (versionsResponseData.error) {
      queryDebug.versions = `버전 조회 중 오류가 발생했습니다. (${versionsResponseData.error.message})`;
    }

    if (artifactsResponseData.error) {
      queryDebug.artifacts = `출력본 조회 중 오류가 발생했습니다. (${artifactsResponseData.error.message})`;
    }

    const templateLinkResponseData =
      templateLinkResponse.status === 'fulfilled'
        ? templateLinkResponse.value
        : { data: null, error: { message: templateLinkResponse.reason instanceof Error ? templateLinkResponse.reason.message : 'unknown' } };
    const valueEntriesResponseData =
      valueEntriesResponse.status === 'fulfilled'
        ? valueEntriesResponse.value
        : { data: null, error: { message: valueEntriesResponse.reason instanceof Error ? valueEntriesResponse.reason.message : 'unknown' } };

    if (templateLinkResponseData.error) {
      queryDebug.templateLink = `템플릿 연결 조회 중 오류가 발생했습니다. (${templateLinkResponseData.error.message})`;
    }

    if (valueEntriesResponseData.error) {
      queryDebug.valueEntries = `문서 값 조회 중 오류가 발생했습니다. (${valueEntriesResponseData.error.message})`;
    }

    const versions = ((versionsResponseData.data || []) as DocumentVersionRow[]).map(toDocumentVersionDto);
    const artifacts = ((artifactsResponseData.data || []) as DocumentArtifactRow[]).map(toDocumentArtifactDto);
    const templateLink = templateLinkResponseData.data
      ? toDocumentTemplateLinkDto(templateLinkResponseData.data as DocumentTemplateLinkRow)
      : null;
    const valueEntries = ((valueEntriesResponseData.data || []) as DocumentValueEntryRow[]).map(toDocumentValueEntryDto);
    const photoEvidence =
      photoGapSummaryResponse.status === 'fulfilled'
        ? buildDocumentPhotoEvidenceSummary(
            photoGapSummaryResponse.value.requirements.filter(
              (item) => item.documentTypeKey === document.document_type_key
            )
          )
        : (() => {
            queryDebug.photoEvidence = `사진 증빙 상태 조회 중 오류가 발생했습니다. (${
              photoGapSummaryResponse.reason instanceof Error ? photoGapSummaryResponse.reason.message : 'unknown'
            })`;
            return buildDocumentPhotoEvidenceSummary([]);
          })();
    const latestVersion = document.current_version_id
      ? versions.find((item) => item.id === document.current_version_id) || versions[0] || null
      : versions[0] || null;
    const effectiveVersionId = latestVersion?.id || document.current_version_id || null;
    let valueFiles: DocumentValueFileDto[] = [];

    if (effectiveVersionId) {
      const { data: valueFilesData, error: valueFilesError } = await documentsClient
        .from('document_value_files')
        .select('*')
        .eq('document_id', document.id)
        .eq('version_id', effectiveVersionId)
        .order('sort_order', { ascending: true })
        .order('uploaded_at', { ascending: true });

      if (valueFilesError) {
        queryDebug.valueFiles = `첨부파일 슬롯 조회 중 오류가 발생했습니다. (${valueFilesError.message})`;
      } else {
        valueFiles = ((valueFilesData || []) as DocumentValueFileRow[]).map(toDocumentValueFileDto);
      }
    }

    let linkedTemplate: DocumentLinkedTemplateDto | null = null;

    if (!queryDebug.templateLink && templateLink?.templateId) {
      const { data: templateRegistryData, error: templateRegistryError } = await templatesSchema(client)
        .from('template_registry')
        .select('id, template_name, current_revision_id')
        .eq('id', templateLink.templateId)
        .single();

      if (templateRegistryError) {
        queryDebug.templateLink = `연결된 템플릿 조회 중 오류가 발생했습니다. (${templateRegistryError.message})`;
      } else {
        const templateRegistry = templateRegistryData as TemplateRegistryLinkRow;
        const resolvedRevisionId =
          templateLink.lastSyncedRevisionId || templateLink.templateRevisionId || templateRegistry.current_revision_id;

        if (resolvedRevisionId) {
          const { data: revisionData, error: revisionError } = await templatesSchema(client)
            .from('template_revisions')
            .select('id, template_id, revision_number, render_snapshot_html')
            .eq('id', resolvedRevisionId)
            .single();

          if (revisionError) {
            queryDebug.templateLink = `연결된 템플릿 리비전 조회 중 오류가 발생했습니다. (${revisionError.message})`;
          } else {
            const revision = revisionData as TemplateRevisionLinkRow;
            linkedTemplate = {
              templateId: templateRegistry.id,
              templateName: templateRegistry.template_name,
              currentRevisionId: templateRegistry.current_revision_id,
              resolvedRevisionId: revision.id,
              resolvedRevisionNumber: revision.revision_number,
              renderSnapshotHtml: revision.render_snapshot_html,
            };
          }
        } else {
          linkedTemplate = {
            templateId: templateRegistry.id,
            templateName: templateRegistry.template_name,
            currentRevisionId: templateRegistry.current_revision_id,
            resolvedRevisionId: null,
            resolvedRevisionNumber: null,
            renderSnapshotHtml: null,
          };
        }
      }
    }

    if (Object.keys(queryDebug).length > 0) {
      const failureSummary = [
        queryDebug.versions ? '버전' : null,
        queryDebug.artifacts ? '출력본' : null,
        queryDebug.valueFiles ? '첨부 파일' : null,
        queryDebug.photoEvidence ? '사진 증빙' : null,
        queryDebug.templateLink ? '템플릿 연결' : null,
        queryDebug.valueEntries ? '문서 값' : null,
      ]
        .filter(Boolean)
        .join(', ');

      throw new DocumentDetailQueryError(
        `문서 상세 조회 실패: ${failureSummary || '하위 조회'} 항목을 불러오지 못했습니다.`,
        queryDebug
      );
    }

    return {
      document: toDocumentRecordDto(document),
      latestVersion,
      versions,
      artifacts,
      valueFiles,
      valueEntries,
      templateLink,
      linkedTemplate,
      photoEvidence,
      queryDebug,
    };
  },

  async uploadDocumentValueFiles(params: {
    documentId: string;
    valueKey: string;
    files: Array<{
      originalFileName: string;
      mimeType: string;
      fileBytes: Uint8Array;
      fileSizeBytes: number;
      uploadedBy?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
  }): Promise<DocumentValueFileInput[]> {
    const documentId = params.documentId.trim();
    const valueKey = params.valueKey.trim();

    if (!documentId) {
      throw new Error('첨부파일 업로드 실패: documentId가 필요합니다.');
    }

    if (!valueKey) {
      throw new Error('첨부파일 업로드 실패: valueKey가 필요합니다.');
    }

    if (!Array.isArray(params.files) || params.files.length === 0) {
      throw new Error('첨부파일 업로드 실패: 업로드할 파일이 필요합니다.');
    }

    const { document, error: documentError } = await getDocumentRegistryById(documentId);

    if (documentError || !document) {
      throw new Error(`첨부파일 업로드 실패: ${documentError?.message || '문서를 찾을 수 없습니다.'}`);
    }

    const client = getSupabase();
    const uploads: DocumentValueFileInput[] = [];
    const uploadedStoragePaths: string[] = [];

    const uploadToStorage = async (storagePath: string, fileBytes: Uint8Array, mimeType: string) =>
      client.storage.from(DOCUMENT_VALUE_FILE_STORAGE_BUCKET).upload(storagePath, fileBytes, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    try {
      for (const [index, file] of params.files.entries()) {
        const originalFileName = String(file.originalFileName || '').trim();
        const mimeType = String(file.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
        const fileSizeBytes = Number.parseInt(String(file.fileSizeBytes || 0), 10);

        if (!originalFileName) {
          throw new Error(`첨부파일 업로드 실패: files[${index}]의 파일 이름이 비어 있습니다.`);
        }

        if (!file.fileBytes || file.fileBytes.length === 0) {
          throw new Error(`첨부파일 업로드 실패: files[${index}]의 파일 바이트가 비어 있습니다.`);
        }

        if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
          throw new Error(`첨부파일 업로드 실패: files[${index}]의 파일 크기가 올바르지 않습니다.`);
        }

        if (fileSizeBytes > DOCUMENT_VALUE_FILE_STORAGE_FILE_SIZE_LIMIT) {
          throw new Error('첨부파일 업로드 실패: 파일 하나의 최대 크기는 10MB입니다.');
        }

        const storagePath = buildDocumentValueFileStoragePath(documentId, valueKey, originalFileName, mimeType);
        let { error: uploadError } = await uploadToStorage(storagePath, file.fileBytes, mimeType);

        if (uploadError?.message?.includes('Bucket not found')) {
          await ensureDocumentValueFileStorageBucket(client);
          ({ error: uploadError } = await uploadToStorage(storagePath, file.fileBytes, mimeType));
        }

        if (uploadError) {
          throw new Error(`첨부파일 업로드 실패: Storage 업로드 중 오류가 발생했습니다. (${uploadError.message})`);
        }

        uploadedStoragePaths.push(storagePath);
        uploads.push({
          valueKey,
          storageBucket: DOCUMENT_VALUE_FILE_STORAGE_BUCKET,
          storagePath,
          originalFileName,
          mimeType,
          fileSizeBytes,
          sortOrder: index,
          uploadedBy: file.uploadedBy?.trim() || null,
          metadata:
            file.metadata && !Array.isArray(file.metadata) && typeof file.metadata === 'object'
              ? file.metadata
              : {},
        });
      }

      return uploads;
    } catch (error) {
      if (uploadedStoragePaths.length > 0) {
        await removeStorageObjects(
          client,
          uploadedStoragePaths.map((storagePath) => ({
            bucket: DOCUMENT_VALUE_FILE_STORAGE_BUCKET,
            path: storagePath,
          })),
          '첨부파일 업로드 실패: 업로드 롤백 중 오류가 발생했습니다.'
        ).catch((rollbackError) => {
          console.error('Document attachment upload rollback warning:', rollbackError);
        });
      }

      throw error;
    }
  },

  async createDocumentValueFileSignedUrl(params: {
    documentId: string;
    storageBucket: string;
    storagePath: string;
    expiresInSeconds?: number;
  }) {
    const documentId = params.documentId.trim();
    const storageBucket = params.storageBucket.trim();
    const storagePath = params.storagePath.trim();

    if (!documentId || !storageBucket || !storagePath) {
      throw new Error('첨부파일 보기 실패: 문서와 파일 경로 정보가 필요합니다.');
    }

    const { document, error: documentError } = await getDocumentRegistryById(documentId);

    if (documentError || !document) {
      throw new Error(`첨부파일 보기 실패: ${documentError?.message || '문서를 찾을 수 없습니다.'}`);
    }

    const client = getSupabase();
    const documentsClient = documentsSchema(client);
    const { data: linkedValueFile, error: linkedValueFileError } = await documentsClient
      .from('document_value_files')
      .select('id')
      .eq('document_id', documentId)
      .eq('storage_bucket', storageBucket)
      .eq('storage_path', storagePath)
      .maybeSingle();

    if (linkedValueFileError || !linkedValueFile) {
      throw new Error(`첨부파일 보기 실패: 현재 문서에 연결된 파일을 찾지 못했습니다. (${linkedValueFileError?.message || '연결 없음'})`);
    }

    const { data, error } = await client.storage
      .from(storageBucket)
      .createSignedUrl(storagePath, Math.max(30, Math.min(params.expiresInSeconds || 300, 3600)));

    if (error || !data?.signedUrl) {
      throw new Error(`첨부파일 보기 실패: 서명 URL을 생성할 수 없습니다. (${error?.message || '알 수 없는 오류'})`);
    }

    return {
      signedUrl: data.signedUrl,
    };
  },

  async deleteDocument(documentId: string): Promise<DocumentDeleteResult> {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      throw new Error('문서 삭제 실패: documentId가 필요합니다.');
    }

    const client = getSupabase();
    const documentsClient = documentsSchema(client);
    const requestLinksClient = requestLinksSchema(client);
    const signingClient = signingSchema(client);
    const exportsClient = exportsSchema(client);
    const messagingClient = messagingSchema(client);
    const bulkClient = bulkOpsSchema(client);
    const { document, error: documentError } = await getDocumentRegistryById(normalizedDocumentId);

    if (documentError || !document) {
      throw new Error(`문서 삭제 실패: ${documentError?.message || '문서를 찾을 수 없습니다.'}`);
    }

    const [valueFilesResponse, requestLinksResponse, signRequestsResponse, bulkPreviewItemsResponse] = await Promise.all([
      documentsClient
        .from('document_value_files')
        .select('storage_bucket, storage_path')
        .eq('document_id', normalizedDocumentId),
      requestLinksClient.from('request_link_registry').select('id').eq('document_id', normalizedDocumentId),
      signingClient.from('sign_requests').select('id').eq('document_id', normalizedDocumentId),
      bulkClient.from('bulk_operation_preview_items').select('preview_id').eq('document_id', normalizedDocumentId),
    ]);

    if (valueFilesResponse.error) {
      throw new Error(`문서 삭제 실패: 첨부 파일 저장 경로 조회 중 오류가 발생했습니다. (${valueFilesResponse.error.message})`);
    }

    if (requestLinksResponse.error) {
      throw new Error(`문서 삭제 실패: 요청 링크 조회 중 오류가 발생했습니다. (${requestLinksResponse.error.message})`);
    }

    if (signRequestsResponse.error) {
      throw new Error(`문서 삭제 실패: 전자서명 요청 조회 중 오류가 발생했습니다. (${signRequestsResponse.error.message})`);
    }

    if (bulkPreviewItemsResponse.error) {
      throw new Error(
        `문서 삭제 실패: 일괄 수정 미리보기 조회 중 오류가 발생했습니다. (${bulkPreviewItemsResponse.error.message})`
      );
    }

    const valueFileStorageObjects = ((valueFilesResponse.data || []) as Array<{ storage_bucket: string; storage_path: string }>).map(
      (row) => ({
        bucket: row.storage_bucket,
        path: row.storage_path,
      })
    );
    const requestLinkIds = ((requestLinksResponse.data || []) as Array<{ id: string }>).map((row) => row.id);
    const bulkPreviewRows = (bulkPreviewItemsResponse.data || []) as Array<{ preview_id: string }>;
    const bulkPreviewIds = Array.from(new Set(bulkPreviewRows.map((row) => row.preview_id)));

    let emptyBulkPreviewIds: string[] = [];

    if (bulkPreviewIds.length > 0) {
      const { data: previewRows, error: previewError } = await bulkClient
        .from('bulk_operation_preview_items')
        .select('preview_id')
        .in('preview_id', bulkPreviewIds);

      if (previewError) {
        throw new Error(`문서 삭제 실패: 일괄 수정 미리보기 연결 상태 조회 중 오류가 발생했습니다. (${previewError.message})`);
      }

      const previewAllItems = ((previewRows || []) as Array<{ preview_id: string }>).reduce<Map<string, number>>(
        (accumulator, row) => {
          accumulator.set(row.preview_id, (accumulator.get(row.preview_id) || 0) + 1);
          return accumulator;
        },
        new Map<string, number>()
      );
      const previewDeletedItems = bulkPreviewRows.reduce<Map<string, number>>((accumulator, row) => {
        accumulator.set(row.preview_id, (accumulator.get(row.preview_id) || 0) + 1);
        return accumulator;
      }, new Map<string, number>());

      emptyBulkPreviewIds = bulkPreviewIds.filter(
        (previewId) => (previewDeletedItems.get(previewId) || 0) === (previewAllItems.get(previewId) || 0)
      );
    }

    const { error: bulkPreviewItemsDeleteError } = await bulkClient
      .from('bulk_operation_preview_items')
      .delete()
      .eq('document_id', normalizedDocumentId);

    if (bulkPreviewItemsDeleteError) {
      throw new Error(
        `문서 삭제 실패: 일괄 수정 미리보기 항목 삭제 중 오류가 발생했습니다. (${bulkPreviewItemsDeleteError.message})`
      );
    }

    if (emptyBulkPreviewIds.length > 0) {
      const { error: bulkPreviewsDeleteError } = await bulkClient
        .from('bulk_operation_previews')
        .delete()
        .in('id', emptyBulkPreviewIds);

      if (bulkPreviewsDeleteError) {
        throw new Error(
          `문서 삭제 실패: 비어 있는 일괄 수정 미리보기 삭제 중 오류가 발생했습니다. (${bulkPreviewsDeleteError.message})`
        );
      }
    }

    const { error: smsSenderDeleteError } = await messagingClient
      .from('sms_document_sender_registry')
      .delete()
      .eq('document_id', normalizedDocumentId);

    if (smsSenderDeleteError) {
      throw new Error(`문서 삭제 실패: 문자 발신 연결 삭제 중 오류가 발생했습니다. (${smsSenderDeleteError.message})`);
    }

    const { error: smsRecipientDeleteError } = await messagingClient
      .from('sms_document_recipient_registry')
      .delete()
      .eq('document_id', normalizedDocumentId);

    if (smsRecipientDeleteError) {
      throw new Error(`문서 삭제 실패: 문자 수신 연결 삭제 중 오류가 발생했습니다. (${smsRecipientDeleteError.message})`);
    }

    const { error: exportJobsDeleteError } = await exportsClient
      .from('export_job_registry')
      .delete()
      .eq('document_id', normalizedDocumentId);

    if (exportJobsDeleteError) {
      throw new Error(`문서 삭제 실패: 변환 작업 삭제 중 오류가 발생했습니다. (${exportJobsDeleteError.message})`);
    }

    if (requestLinkIds.length > 0) {
      const { error: smsDispatchDeleteError } = await messagingClient
        .from('sms_dispatch_registry')
        .delete()
        .in('request_link_id', requestLinkIds);

      if (smsDispatchDeleteError) {
        throw new Error(`문서 삭제 실패: 문자 발송 이력 삭제 중 오류가 발생했습니다. (${smsDispatchDeleteError.message})`);
      }

      const { error: emailDispatchDeleteError } = await messagingClient
        .from('email_dispatch_registry')
        .delete()
        .in('request_link_id', requestLinkIds);

      if (emailDispatchDeleteError) {
        throw new Error(`문서 삭제 실패: 이메일 발송 이력 삭제 중 오류가 발생했습니다. (${emailDispatchDeleteError.message})`);
      }

      const { error: requestLinksDeleteError } = await requestLinksClient
        .from('request_link_registry')
        .delete()
        .in('id', requestLinkIds);

      if (requestLinksDeleteError) {
        throw new Error(`문서 삭제 실패: 요청 링크 삭제 중 오류가 발생했습니다. (${requestLinksDeleteError.message})`);
      }
    }

    const { error: signRequestsDeleteError } = await signingClient
      .from('sign_requests')
      .delete()
      .eq('document_id', normalizedDocumentId);

    if (signRequestsDeleteError) {
      throw new Error(`문서 삭제 실패: 전자서명 요청 삭제 중 오류가 발생했습니다. (${signRequestsDeleteError.message})`);
    }

    const { error: documentDeleteError } = await documentsClient
      .from('document_registry')
      .delete()
      .eq('id', normalizedDocumentId);

    if (documentDeleteError) {
      throw new Error(`문서 삭제 실패: 현장 문서 삭제 중 오류가 발생했습니다. (${documentDeleteError.message})`);
    }

    try {
      await removeStorageObjects(client, valueFileStorageObjects, '문서 삭제 후 첨부 파일 저장소 정리 중 오류가 발생했습니다.');
    } catch (error) {
      console.error('Document delete storage cleanup warning:', error);
    }

    return {
      document: toDocumentRecordDto(document),
    };
  },

  // DOC_CLOUD_VERSION_APPEND
  // 문서 버전 추가는 기존 문서 메타데이터를 유지하면서 html canonical 과
  // 라벨 값 스냅샷만 새 버전으로 추가합니다.
  async createVersion(
    documentId: string,
    params: DocumentVersionCreateInput
  ): Promise<DocumentVersionCreateResult> {
    if (!documentId.trim()) {
      throw new Error('문서 버전 생성 실패: documentId가 필요합니다.');
    }

    if (!params.htmlCanonical.trim()) {
      throw new Error('문서 버전 생성 실패: htmlCanonical이 비어 있습니다.');
    }

    const client = getSupabase();
    const documentsClient = documentsSchema(client);
    const normalizedDocumentId = documentId.trim();
    const labelValues = sanitizeLabelValues(params.labelValues);
    const valueFiles = sanitizeDocumentValueFiles(params.valueFiles);
    const htmlHashInfo = generateDocumentHashInfo(params.htmlCanonical);

    const { document, error: documentError } = await getDocumentRegistryById(normalizedDocumentId);

    if (documentError || !document) {
      throw new Error(`문서 버전 생성 실패: ${documentError?.message || '문서를 찾을 수 없습니다.'}`);
    }

    const nextVersionNumber = (document.current_version_number || 0) + 1;

    const { data: versionData, error: versionError } = await documentsClient
      .from('document_versions')
      .insert([
        {
          document_id: normalizedDocumentId,
          version_number: nextVersionNumber,
          html_canonical: params.htmlCanonical,
          html_sha256: htmlHashInfo.hash,
          html_hash_algorithm: htmlHashInfo.algorithm,
          html_hash_encoding: htmlHashInfo.encoding,
          html_canonicalization: htmlHashInfo.canonicalization,
          html_byte_length: htmlHashInfo.byteLength,
          label_values: labelValues,
          change_reason: params.changeReason?.trim() || null,
          created_by: params.createdBy || null,
        },
      ])
      .select('*')
      .single();

    const version = versionData as DocumentVersionRow | null;

    if (versionError || !version) {
      throw new Error(`문서 버전 생성 실패: ${versionError?.message || '버전을 생성할 수 없습니다.'}`);
    }

    let createdValueFiles: DocumentValueFileDto[] = [];

    try {
      createdValueFiles = await insertDocumentValueFiles({
        documentsClient,
        documentId: normalizedDocumentId,
        versionId: version.id,
        valueFiles,
      });

      await upsertDocumentValueEntries({
        documentsClient,
        documentId: normalizedDocumentId,
        labelValues,
        updatedBy: params.createdBy || null,
      });
    } catch (error) {
      await documentsClient.from('document_versions').delete().eq('id', version.id);
      throw error;
    }

    const { data: updatedDocumentData, error: updateError } = await documentsClient
      .from('document_registry')
      .update({
        current_version_id: version.id,
        current_version_number: version.version_number,
        status: 'active',
      })
      .eq('id', normalizedDocumentId)
      .select('*')
      .single();

    if (updateError || !updatedDocumentData) {
      throw new Error(`문서 버전 생성 실패: 최신 버전 포인터 갱신에 실패했습니다. (${updateError?.message})`);
    }

    return {
      document: toDocumentRecordDto(updatedDocumentData as DocumentRegistryRow),
      latestVersion: toDocumentVersionDto(version),
      valueFiles: createdValueFiles,
    };
  },
};
