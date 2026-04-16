import { createClient } from '@supabase/supabase-js';
import { generateDocumentHashInfo } from '../lib/crypto';
import type {
  DocumentArtifactDto,
  DocumentCreateInput,
  DocumentCreateResult,
  DocumentListItem,
  DocumentListQuery,
  DocumentRecordDto,
  DocumentVersionDto,
} from '../lib/documentDtos';

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

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const DOCUMENTS_DB_SCHEMA = 'documents';

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
    const labelValues = sanitizeLabelValues(params.labelValues);
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
};
