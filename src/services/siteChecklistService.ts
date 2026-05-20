import { createClient } from '@supabase/supabase-js';
import { DocumentService } from './documentService';
import { PhotoLabelRequirementService } from './photoLabelRequirementService';
import type {
  RequiredDocumentRuleInput,
  SiteChecklistPhotoEvidenceDto,
  SiteChecklistItemDto,
  SiteChecklistRebuildInput,
  SiteChecklistRebuildResult,
  SiteChecklistRuleDto,
  SiteChecklistSummaryDto,
  SiteCreateInput,
  SiteDeleteImpactDto,
  SiteDeleteImpactItemDto,
  SiteDeleteResult,
  SiteCreateResult,
  SiteListResult,
  SiteRecordDto,
} from '../lib/siteChecklistDtos';
import type { SitePhotoLabelGapItemDto, SitePhotoLabelGapSummaryDto } from '../lib/photoLabelDtos';

type SiteRegistryRow = {
  id: string;
  site_name: string;
  trade_keys: string[] | null;
  open_date: string;
  checklist_version: number | null;
  created_at: string;
  updated_at: string;
};

type RequiredDocumentRuleRow = {
  id: string;
  trade_key: string;
  document_type_key: string;
  document_title: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SiteChecklistSnapshotRow = {
  id: string;
  site_id: string;
  checklist_version: number;
  generated_at: string;
};

type SiteChecklistItemRow = {
  id: string;
  site_id: string;
  checklist_snapshot_id: string;
  checklist_version: number;
  document_type_key: string;
  document_title: string;
  source_trade_keys: string[] | null;
  status: SiteChecklistItemDto['status'];
  linked_document_id: string | null;
  generated_at: string;
};

type DocumentRegistryDeleteRow = {
  id: string;
};

type DocumentValueFileDeleteRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

type PhotoRegistryDeleteRow = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
};

type RequestLinkDeleteRow = {
  id: string;
};

type SignRequestDeleteRow = {
  id: string;
};

type DispatchDeleteRow = {
  id: string;
};

type BulkPreviewItemDeleteRow = {
  id: string;
  preview_id: string;
};

type StorageObjectRef = {
  bucket: string | null;
  path: string | null;
};

type SiteDeletionContext = {
  site: SiteRegistryRow;
  documentIds: string[];
  requestLinkIds: string[];
  photoStorageObjects: StorageObjectRef[];
  documentValueFileStorageObjects: StorageObjectRef[];
  emptyBulkPreviewIds: string[];
  impact: SiteDeleteImpactDto;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const SITES_DB_SCHEMA = 'sites';
const DOCUMENTS_DB_SCHEMA = 'documents';
const PHOTO_LABELS_DB_SCHEMA = 'photo_labels';
const REQUEST_LINKS_DB_SCHEMA = 'request_links';
const SIGNING_DB_SCHEMA = 'signing';
const EXPORTS_DB_SCHEMA = 'exports';
const MESSAGING_DB_SCHEMA = 'messaging';
const BULK_OPS_DB_SCHEMA = 'bulk_ops';
const MEMBER_ACCESS_DB_SCHEMA = 'member_access';

// SITES_SCHEMA_BOUNDARY
// 현장 체크리스트 도메인 테이블은 public이 아니라 sites 스키마만 사용합니다.
// 현장 메타데이터, 공종별 필수 서류 규칙, 체크리스트 스냅샷, 체크리스트 항목은
// 각각 sites.site_registry, sites.required_document_rules,
// sites.site_checklist_snapshots, sites.site_checklist_items 가 정본입니다.
//
// SUPABASE_API_SCHEMA_REQUIRED
// server-side service role 로 schema('sites')를 사용하려면 PostgREST/Data API 가
// sites 스키마를 읽을 수 있어야 합니다.
// runtime 에서 Invalid schema: sites 오류가 나오면 pgrst.db_schemas 에 sites 를 추가해야 합니다.
const sitesSchema = (client = getSupabase()) => client.schema(SITES_DB_SCHEMA);
const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);
const photoLabelsSchema = (client = getSupabase()) => client.schema(PHOTO_LABELS_DB_SCHEMA);
const requestLinksSchema = (client = getSupabase()) => client.schema(REQUEST_LINKS_DB_SCHEMA);
const signingSchema = (client = getSupabase()) => client.schema(SIGNING_DB_SCHEMA);
const exportsSchema = (client = getSupabase()) => client.schema(EXPORTS_DB_SCHEMA);
const messagingSchema = (client = getSupabase()) => client.schema(MESSAGING_DB_SCHEMA);
const bulkOpsSchema = (client = getSupabase()) => client.schema(BULK_OPS_DB_SCHEMA);
const memberAccessSchema = (client = getSupabase()) => client.schema(MEMBER_ACCESS_DB_SCHEMA);

const normalizeTradeKeys = (tradeKeys?: string[] | null) => {
  if (!Array.isArray(tradeKeys) || tradeKeys.length === 0) {
    return [] as string[];
  }

  const normalizedTradeKeys = tradeKeys.map((item) => item.trim()).filter(Boolean);

  return Array.from(new Set(normalizedTradeKeys));
};

const normalizeRules = (rules: RequiredDocumentRuleInput[]) => {
  return rules.map((rule) => {
    const tradeKey = rule.tradeKey.trim();
    const documentTypeKey = rule.documentTypeKey.trim();
    const documentTitle = rule.documentTitle.trim();

    if (!tradeKey || !documentTypeKey || !documentTitle) {
      throw new Error('체크리스트 규칙 저장 실패: tradeKey, documentTypeKey, documentTitle은 필수입니다.');
    }

    return {
      tradeKey,
      documentTypeKey,
      documentTitle,
      description: rule.description?.trim() || null,
    };
  });
};

const toSiteRecordDto = (row: SiteRegistryRow): SiteRecordDto => ({
  id: row.id,
  siteName: row.site_name,
  tradeKeys: row.trade_keys || [],
  openDate: row.open_date,
  checklistVersion: row.checklist_version || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toRuleDto = (row: RequiredDocumentRuleRow): SiteChecklistRuleDto => ({
  id: row.id,
  tradeKey: row.trade_key,
  documentTypeKey: row.document_type_key,
  documentTitle: row.document_title,
  description: row.description,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toChecklistItemDto = (row: SiteChecklistItemRow): SiteChecklistItemDto => ({
  id: row.id,
  siteId: row.site_id,
  checklistVersion: row.checklist_version,
  documentTypeKey: row.document_type_key,
  documentTitle: row.document_title,
  sourceTradeKeys: row.source_trade_keys || [],
  status: row.status,
  linkedDocumentId: row.linked_document_id,
  generatedAt: row.generated_at,
  photoEvidence: {
    status: 'not_required',
    requirementCount: 0,
    coveredCount: 0,
    reviewNeededCount: 0,
    missingCount: 0,
    requirements: [],
  },
});

const buildPhotoEvidenceDto = (requirements: SitePhotoLabelGapItemDto[]): SiteChecklistPhotoEvidenceDto => {
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

const groupPhotoRequirementsByDocumentType = (summary: SitePhotoLabelGapSummaryDto) => {
  const grouped = new Map<string, SitePhotoLabelGapItemDto[]>();

  for (const requirement of summary.requirements) {
    if (!requirement.documentTypeKey) {
      continue;
    }

    const bucket = grouped.get(requirement.documentTypeKey) || [];
    bucket.push(requirement);
    grouped.set(requirement.documentTypeKey, bucket);
  }

  return grouped;
};

const countRows = async (
  queryPromise: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>,
  errorPrefix: string
) => {
  const { count, error } = await queryPromise;

  if (error) {
    throw new Error(`${errorPrefix}: ${error.message}`);
  }

  return count || 0;
};

const countRowsBestEffort = async (
  queryPromise: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>,
  warningPrefix: string
) => {
  const { count, error } = await queryPromise;

  if (error) {
    console.warn(`${warningPrefix}: ${error.message}`);
    return 0;
  }

  return count || 0;
};

const describeCounts = (items: Array<[label: string, count: number]>) => {
  return items
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}건`)
    .join(', ');
};

const buildDeleteImpactItem = (
  key: string,
  label: string,
  count: number,
  description?: string | null
): SiteDeleteImpactItemDto | null => {
  if (count <= 0) {
    return null;
  }

  return {
    key,
    label,
    count,
    description: description?.trim() || null,
  };
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

const getSiteById = async (siteId: string, client = getSupabase()) => {
  const { data, error } = await sitesSchema(client)
    .from('site_registry')
    .select('*')
    .eq('id', siteId)
    .single();

  return { site: data as SiteRegistryRow | null, error };
};

const buildSiteDeletionContext = async (siteId: string): Promise<SiteDeletionContext> => {
  const normalizedSiteId = siteId.trim();

  if (!normalizedSiteId) {
    throw new Error('현장 삭제 준비 실패: siteId가 필요합니다.');
  }

  const client = getSupabase();
  const sitesClient = sitesSchema(client);
  const documentsClient = documentsSchema(client);
  const photosClient = photoLabelsSchema(client);
  const requestLinksClient = requestLinksSchema(client);
  const signingClient = signingSchema(client);
  const exportsClient = exportsSchema(client);
  const messagingClient = messagingSchema(client);
  const bulkClient = bulkOpsSchema(client);
  const memberAccessClient = memberAccessSchema(client);

  const [
    siteResponse,
    documentResponse,
    photoResponse,
    checklistSnapshotCount,
    checklistItemCount,
    photoRequirementCount,
    siteMembershipCount,
  ] = await Promise.all([
    getSiteById(normalizedSiteId, client),
    documentsClient.from('document_registry').select('id').eq('site_id', normalizedSiteId),
    photosClient.from('photo_registry').select('id, storage_bucket, storage_path').eq('site_id', normalizedSiteId),
    countRows(
      sitesClient.from('site_checklist_snapshots').select('*', { count: 'exact', head: true }).eq('site_id', normalizedSiteId),
      '현장 삭제 준비 실패: 체크리스트 스냅샷 수를 확인할 수 없습니다.'
    ),
    countRows(
      sitesClient.from('site_checklist_items').select('*', { count: 'exact', head: true }).eq('site_id', normalizedSiteId),
      '현장 삭제 준비 실패: 체크리스트 항목 수를 확인할 수 없습니다.'
    ),
    countRows(
      photosClient
        .from('site_photo_label_requirements')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', normalizedSiteId),
      '현장 삭제 준비 실패: 사진 요구사항 수를 확인할 수 없습니다.'
    ),
    countRowsBestEffort(
      memberAccessClient.from('site_memberships').select('*', { count: 'exact', head: true }).eq('site_id', normalizedSiteId),
      '현장 삭제 준비 경고: 프로젝트 구성원 접근 권한 수를 확인할 수 없습니다.'
    ),
  ]);

  const site = siteResponse.site;

  if (siteResponse.error || !site) {
    throw new Error(`현장 삭제 준비 실패: ${siteResponse.error?.message || '현장을 찾을 수 없습니다.'}`);
  }

  if (documentResponse.error) {
    throw new Error(`현장 삭제 준비 실패: 현장 문서 조회 중 오류가 발생했습니다. (${documentResponse.error.message})`);
  }

  if (photoResponse.error) {
    throw new Error(`현장 삭제 준비 실패: 현장 사진 조회 중 오류가 발생했습니다. (${photoResponse.error.message})`);
  }

  const documentRows = (documentResponse.data || []) as DocumentRegistryDeleteRow[];
  const documentIds = documentRows.map((row) => row.id);
  const photoRows = (photoResponse.data || []) as PhotoRegistryDeleteRow[];
  const photoIds = photoRows.map((row) => row.id);
  const photoStorageObjects = photoRows.map((row) => ({
    bucket: row.storage_bucket,
    path: row.storage_path,
  }));

  const [
    documentVersionCount,
    documentArtifactCount,
    documentValueFileResponse,
    requestLinkResponse,
    signRequestResponse,
    exportJobCount,
    smsDocumentSenderBindingCount,
    smsDocumentRecipientBindingCount,
    bulkPreviewItemResponse,
    photoAssignmentCount,
    photoSuggestionCount,
    documentMembershipCount,
  ] = await Promise.all([
    documentIds.length > 0
      ? countRows(
          documentsClient.from('document_versions').select('*', { count: 'exact', head: true }).in('document_id', documentIds),
          '현장 삭제 준비 실패: 문서 버전 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    documentIds.length > 0
      ? countRows(
          documentsClient.from('document_artifacts').select('*', { count: 'exact', head: true }).in('document_id', documentIds),
          '현장 삭제 준비 실패: 문서 출력본 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    documentIds.length > 0
      ? documentsClient.from('document_value_files').select('id, storage_bucket, storage_path').in('document_id', documentIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? requestLinksClient.from('request_link_registry').select('id').in('document_id', documentIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? signingClient.from('sign_requests').select('id').in('document_id', documentIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? countRows(
          exportsClient.from('export_job_registry').select('*', { count: 'exact', head: true }).in('document_id', documentIds),
          '현장 삭제 준비 실패: 변환 작업 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    documentIds.length > 0
      ? countRows(
          messagingClient
            .from('sms_document_sender_registry')
            .select('*', { count: 'exact', head: true })
            .in('document_id', documentIds),
          '현장 삭제 준비 실패: 문자 발신 연결 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    documentIds.length > 0
      ? countRows(
          messagingClient
            .from('sms_document_recipient_registry')
            .select('*', { count: 'exact', head: true })
            .in('document_id', documentIds),
          '현장 삭제 준비 실패: 문자 수신 연결 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    documentIds.length > 0
      ? bulkClient.from('bulk_operation_preview_items').select('id, preview_id').in('document_id', documentIds)
      : Promise.resolve({ data: [], error: null }),
    photoIds.length > 0
      ? countRows(
          photosClient.from('photo_label_assignments').select('*', { count: 'exact', head: true }).in('photo_id', photoIds),
          '현장 삭제 준비 실패: 사진 수동 라벨 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    photoIds.length > 0
      ? countRows(
          photosClient.from('photo_label_suggestions').select('*', { count: 'exact', head: true }).in('photo_id', photoIds),
          '현장 삭제 준비 실패: 사진 추천 라벨 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    documentIds.length > 0
      ? countRowsBestEffort(
          memberAccessClient
            .from('document_memberships')
            .select('*', { count: 'exact', head: true })
            .in('document_id', documentIds),
          '현장 삭제 준비 경고: 문서 구성원 접근 권한 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
  ]);

  if (documentValueFileResponse.error) {
    throw new Error(
      `현장 삭제 준비 실패: 문서 첨부파일 조회 중 오류가 발생했습니다. (${documentValueFileResponse.error.message})`
    );
  }

  if (requestLinkResponse.error) {
    throw new Error(`현장 삭제 준비 실패: 요청 링크 조회 중 오류가 발생했습니다. (${requestLinkResponse.error.message})`);
  }

  if (signRequestResponse.error) {
    throw new Error(`현장 삭제 준비 실패: 전자서명 요청 조회 중 오류가 발생했습니다. (${signRequestResponse.error.message})`);
  }

  if (bulkPreviewItemResponse.error) {
    throw new Error(
      `현장 삭제 준비 실패: 일괄 수정 미리보기 조회 중 오류가 발생했습니다. (${bulkPreviewItemResponse.error.message})`
    );
  }

  const documentValueFileRows = (documentValueFileResponse.data || []) as DocumentValueFileDeleteRow[];
  const documentValueFileStorageObjects = documentValueFileRows.map((row) => ({
    bucket: row.storage_bucket,
    path: row.storage_path,
  }));
  const requestLinkRows = (requestLinkResponse.data || []) as RequestLinkDeleteRow[];
  const requestLinkIds = requestLinkRows.map((row) => row.id);
  const signRequestRows = (signRequestResponse.data || []) as SignRequestDeleteRow[];
  const signRequestIds = signRequestRows.map((row) => row.id);
  const bulkPreviewItemRows = (bulkPreviewItemResponse.data || []) as BulkPreviewItemDeleteRow[];
  const bulkPreviewIds = Array.from(new Set(bulkPreviewItemRows.map((row) => row.preview_id)));

  const [
    requestLinkAuditCount,
    signAuthenticationCount,
    signatureCount,
    signatureAuditLogCount,
    smsDispatchResponse,
    emailDispatchResponse,
    previewAllItemsResponse,
  ] = await Promise.all([
    requestLinkIds.length > 0
      ? countRows(
          requestLinksClient
            .from('request_link_submit_audits')
            .select('*', { count: 'exact', head: true })
            .in('request_link_id', requestLinkIds),
          '현장 삭제 준비 실패: 요청 링크 제출 기록 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    signRequestIds.length > 0
      ? countRows(
          signingClient
            .from('sign_authentications')
            .select('*', { count: 'exact', head: true })
            .in('request_id', signRequestIds),
          '현장 삭제 준비 실패: 본인확인 기록 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    signRequestIds.length > 0
      ? countRows(
          signingClient.from('signatures').select('*', { count: 'exact', head: true }).in('request_id', signRequestIds),
          '현장 삭제 준비 실패: 서명 결과 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    signRequestIds.length > 0
      ? countRows(
          signingClient
            .from('signature_audit_logs')
            .select('*', { count: 'exact', head: true })
            .in('request_id', signRequestIds),
          '현장 삭제 준비 실패: 서명 감사 기록 수를 확인할 수 없습니다.'
        )
      : Promise.resolve(0),
    requestLinkIds.length > 0
      ? messagingClient.from('sms_dispatch_registry').select('id').in('request_link_id', requestLinkIds)
      : Promise.resolve({ data: [], error: null }),
    requestLinkIds.length > 0
      ? messagingClient.from('email_dispatch_registry').select('id').in('request_link_id', requestLinkIds)
      : Promise.resolve({ data: [], error: null }),
    bulkPreviewIds.length > 0
      ? bulkClient.from('bulk_operation_preview_items').select('preview_id').in('preview_id', bulkPreviewIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (smsDispatchResponse.error) {
    throw new Error(
      `현장 삭제 준비 실패: 문자 발송 이력 조회 중 오류가 발생했습니다. (${smsDispatchResponse.error.message})`
    );
  }

  if (emailDispatchResponse.error) {
    throw new Error(
      `현장 삭제 준비 실패: 이메일 발송 이력 조회 중 오류가 발생했습니다. (${emailDispatchResponse.error.message})`
    );
  }

  if (previewAllItemsResponse.error) {
    throw new Error(
      `현장 삭제 준비 실패: 일괄 수정 미리보기 연결 상태 조회 중 오류가 발생했습니다. (${previewAllItemsResponse.error.message})`
    );
  }

  const smsDispatchRows = (smsDispatchResponse.data || []) as DispatchDeleteRow[];
  const smsDispatchIds = smsDispatchRows.map((row) => row.id);
  const emailDispatchRows = (emailDispatchResponse.data || []) as DispatchDeleteRow[];
  const emailDispatchIds = emailDispatchRows.map((row) => row.id);

  const [smsDispatchTargetCount, smsDispatchEventCount, emailDispatchTargetCount, emailDispatchEventCount] =
    await Promise.all([
      smsDispatchIds.length > 0
        ? countRows(
            messagingClient
              .from('sms_dispatch_targets')
              .select('*', { count: 'exact', head: true })
              .in('dispatch_id', smsDispatchIds),
            '현장 삭제 준비 실패: 문자 발송 대상 수를 확인할 수 없습니다.'
          )
        : Promise.resolve(0),
      smsDispatchIds.length > 0
        ? countRows(
            messagingClient
              .from('sms_dispatch_events')
              .select('*', { count: 'exact', head: true })
              .in('dispatch_id', smsDispatchIds),
            '현장 삭제 준비 실패: 문자 발송 이벤트 수를 확인할 수 없습니다.'
          )
        : Promise.resolve(0),
      emailDispatchIds.length > 0
        ? countRows(
            messagingClient
              .from('email_dispatch_targets')
              .select('*', { count: 'exact', head: true })
              .in('dispatch_id', emailDispatchIds),
            '현장 삭제 준비 실패: 이메일 발송 대상 수를 확인할 수 없습니다.'
          )
        : Promise.resolve(0),
      emailDispatchIds.length > 0
        ? countRows(
            messagingClient
              .from('email_dispatch_events')
              .select('*', { count: 'exact', head: true })
              .in('dispatch_id', emailDispatchIds),
            '현장 삭제 준비 실패: 이메일 발송 이벤트 수를 확인할 수 없습니다.'
          )
        : Promise.resolve(0),
    ]);

  const previewAllItems = ((previewAllItemsResponse.data || []) as Array<{ preview_id: string }>).reduce<
    Map<string, number>
  >((accumulator, row) => {
    accumulator.set(row.preview_id, (accumulator.get(row.preview_id) || 0) + 1);
    return accumulator;
  }, new Map<string, number>());
  const previewDeletedItems = bulkPreviewItemRows.reduce<Map<string, number>>((accumulator, row) => {
    accumulator.set(row.preview_id, (accumulator.get(row.preview_id) || 0) + 1);
    return accumulator;
  }, new Map<string, number>());
  const emptyBulkPreviewIds = bulkPreviewIds.filter(
    (previewId) => (previewDeletedItems.get(previewId) || 0) === (previewAllItems.get(previewId) || 0)
  );

  const bulkPreviewCommitCount =
    emptyBulkPreviewIds.length > 0
      ? await countRows(
          bulkClient
            .from('bulk_operation_commits')
            .select('*', { count: 'exact', head: true })
            .in('preview_id', emptyBulkPreviewIds),
          '현장 삭제 준비 실패: 일괄 수정 확정 기록 수를 확인할 수 없습니다.'
        )
      : 0;

  const impactItems = [
    buildDeleteImpactItem('site', '현장 기본 정보', 1, '선택한 현장 자체가 삭제됩니다.'),
    buildDeleteImpactItem(
      'checklist',
      '체크리스트 기록',
      checklistSnapshotCount + checklistItemCount,
      describeCounts([
        ['체크리스트 스냅샷', checklistSnapshotCount],
        ['체크리스트 항목', checklistItemCount],
      ])
    ),
    buildDeleteImpactItem('documents', '현장 문서', documentIds.length, '현장에 귀속된 문서 본문과 상태 정보입니다.'),
    buildDeleteImpactItem(
      'member-access',
      '구성원 접근 권한',
      siteMembershipCount + documentMembershipCount,
      `${describeCounts([
        ['프로젝트 접근 권한', siteMembershipCount],
        ['문서 접근 권한', documentMembershipCount],
      ])} 구성원 계정, 전화번호 인증 상태, 다른 프로젝트/문서 접근 권한은 유지됩니다.`
    ),
    buildDeleteImpactItem(
      'document-files',
      '문서 버전·출력본·첨부 파일',
      documentVersionCount + documentArtifactCount + documentValueFileRows.length,
      `${describeCounts([
        ['문서 버전', documentVersionCount],
        ['출력본 메타데이터', documentArtifactCount],
        ['첨부 파일', documentValueFileRows.length],
      ])}${documentValueFileRows.length > 0 ? '의 저장 파일도 함께 삭제됩니다.' : ''}`
    ),
    buildDeleteImpactItem(
      'request-links',
      '요청 링크',
      requestLinkIds.length + requestLinkAuditCount,
      describeCounts([
        ['요청 링크', requestLinkIds.length],
        ['제출 기록', requestLinkAuditCount],
      ])
    ),
    buildDeleteImpactItem(
      'signing',
      '전자서명 기록',
      signRequestIds.length + signAuthenticationCount + signatureCount + signatureAuditLogCount,
      describeCounts([
        ['서명 요청', signRequestIds.length],
        ['본인확인 기록', signAuthenticationCount],
        ['서명 결과', signatureCount],
        ['감사 로그', signatureAuditLogCount],
      ])
    ),
    buildDeleteImpactItem(
      'photos',
      '사진·라벨',
      photoRows.length + photoRequirementCount + photoAssignmentCount + photoSuggestionCount,
      `${describeCounts([
        ['사진', photoRows.length],
        ['사진 요구사항', photoRequirementCount],
        ['수동 라벨', photoAssignmentCount],
        ['추천 라벨', photoSuggestionCount],
      ])}${photoRows.length > 0 ? '의 저장 파일도 함께 삭제됩니다.' : ''}`
    ),
    buildDeleteImpactItem('exports', '변환 작업', exportJobCount, '문서 PDF/DOCX/HWP 변환 작업 기록입니다.'),
    buildDeleteImpactItem(
      'messaging',
      '발송 연결·이력',
      smsDocumentSenderBindingCount +
        smsDocumentRecipientBindingCount +
        smsDispatchIds.length +
        smsDispatchTargetCount +
        smsDispatchEventCount +
        emailDispatchIds.length +
        emailDispatchTargetCount +
        emailDispatchEventCount,
      describeCounts([
        ['문자 발신 연결', smsDocumentSenderBindingCount],
        ['문자 수신 연결', smsDocumentRecipientBindingCount],
        ['문자 발송', smsDispatchIds.length],
        ['문자 발송 대상', smsDispatchTargetCount],
        ['문자 발송 이벤트', smsDispatchEventCount],
        ['이메일 발송', emailDispatchIds.length],
        ['이메일 발송 대상', emailDispatchTargetCount],
        ['이메일 발송 이벤트', emailDispatchEventCount],
      ])
    ),
    buildDeleteImpactItem(
      'bulk-preview',
      '일괄 수정 미리보기',
      bulkPreviewItemRows.length + emptyBulkPreviewIds.length + bulkPreviewCommitCount,
      describeCounts([
        ['미리보기 항목', bulkPreviewItemRows.length],
        ['비어지는 미리보기', emptyBulkPreviewIds.length],
        ['확정 기록', bulkPreviewCommitCount],
      ])
    ),
  ].filter((item): item is SiteDeleteImpactItemDto => Boolean(item));

  return {
    site,
    documentIds,
    requestLinkIds,
    photoStorageObjects,
    documentValueFileStorageObjects,
    emptyBulkPreviewIds,
    impact: {
      site: toSiteRecordDto(site),
      items: impactItems,
    },
  };
};

const getRulesForTrades = async (tradeKeys: string[]) => {
  if (tradeKeys.length === 0) {
    return { rules: [] as RequiredDocumentRuleRow[], error: null };
  }

  const { data, error } = await sitesSchema()
    .from('required_document_rules')
    .select('*')
    .eq('active', true)
    .in('trade_key', tradeKeys)
    .order('trade_key', { ascending: true })
    .order('document_type_key', { ascending: true });

  return { rules: (data || []) as RequiredDocumentRuleRow[], error };
};

const upsertRules = async (rules: RequiredDocumentRuleInput[]) => {
  if (!rules.length) {
    return [] as SiteChecklistRuleDto[];
  }

  const normalizedRules = normalizeRules(rules);
  const { data, error } = await sitesSchema()
    .from('required_document_rules')
    .upsert(
      normalizedRules.map((rule) => ({
        trade_key: rule.tradeKey,
        document_type_key: rule.documentTypeKey,
        document_title: rule.documentTitle,
        description: rule.description,
        active: true,
      })),
      { onConflict: 'trade_key,document_type_key' }
    )
    .select('*');

  if (error) {
    throw new Error(`체크리스트 규칙 저장 실패: ${error.message}`);
  }

  return ((data || []) as RequiredDocumentRuleRow[]).map(toRuleDto);
};

const buildChecklistSeed = async (site: SiteRegistryRow) => {
  const tradeKeys = site.trade_keys || [];
  const { rules, error: rulesError } = await getRulesForTrades(tradeKeys);

  if (rulesError) {
    throw new Error(`체크리스트 계산 실패: 규칙 조회 중 오류가 발생했습니다. (${rulesError.message})`);
  }

  const existingDocuments = await DocumentService.listDocuments({ siteId: site.id });
  const documentsByType = new Map(
    existingDocuments.map((item) => [item.document.documentTypeKey, item.document.id] as const)
  );

  const dedupedChecklistMap = new Map<
    string,
    {
      documentTypeKey: string;
      documentTitle: string;
      sourceTradeKeys: string[];
      linkedDocumentId: string | null;
      status: SiteChecklistItemDto['status'];
    }
  >();

  for (const rule of rules) {
    const existing = dedupedChecklistMap.get(rule.document_type_key);
    const linkedDocumentId = documentsByType.get(rule.document_type_key) || null;

    if (existing) {
      if (!existing.sourceTradeKeys.includes(rule.trade_key)) {
        existing.sourceTradeKeys.push(rule.trade_key);
      }

      if (!existing.linkedDocumentId && linkedDocumentId) {
        existing.linkedDocumentId = linkedDocumentId;
        existing.status = 'completed';
      }

      continue;
    }

    dedupedChecklistMap.set(rule.document_type_key, {
      documentTypeKey: rule.document_type_key,
      documentTitle: rule.document_title,
      sourceTradeKeys: [rule.trade_key],
      linkedDocumentId,
      status: linkedDocumentId ? 'completed' : 'missing',
    });
  }

  return Array.from(dedupedChecklistMap.values()).sort((a, b) =>
    a.documentTypeKey.localeCompare(b.documentTypeKey, 'ko')
  );
};

export const listSites = async (): Promise<SiteListResult> => {
  const { data, error } = await sitesSchema()
    .from('site_registry')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`현장 목록 조회 실패: ${error.message}`);
  }

  const sites = ((data || []) as SiteRegistryRow[]).map(toSiteRecordDto);

  return {
    siteCount: sites.length,
    sites,
  };
};

export const SiteChecklistService = {
  listSites,
  async getDeleteImpact(siteId: string): Promise<SiteDeleteImpactDto> {
    const context = await buildSiteDeletionContext(siteId);
    return context.impact;
  },

  async createSite(params: SiteCreateInput): Promise<SiteCreateResult> {
    const siteName = params.siteName.trim();

    if (!siteName) {
      throw new Error('현장 생성 실패: siteName이 필요합니다.');
    }

    if (!params.openDate.trim()) {
      throw new Error('현장 생성 실패: openDate가 필요합니다.');
    }

    if (params.requiredDocumentRules?.length) {
      await upsertRules(params.requiredDocumentRules);
    }

    const tradeKeys = normalizeTradeKeys(params.tradeKeys);
    const siteInsertRow: {
      site_name: string;
      open_date: string;
      checklist_version: number;
      trade_keys?: string[];
    } = {
      site_name: siteName,
      open_date: params.openDate,
      checklist_version: 0,
    };

    if (tradeKeys.length > 0) {
      siteInsertRow.trade_keys = tradeKeys;
    }

    const { data: siteData, error: siteError } = await sitesSchema()
      .from('site_registry')
      .insert([siteInsertRow])
      .select('*')
      .single();

    const site = siteData as SiteRegistryRow | null;

    if (siteError || !site) {
      throw new Error(`현장 생성 실패: ${siteError?.message || '현장을 저장할 수 없습니다.'}`);
    }

    const rebuiltChecklist = await this.rebuildChecklist({ siteId: site.id });

    return {
      site: rebuiltChecklist.site,
      checklistVersion: rebuiltChecklist.checklistVersion,
      generatedChecklistCount: rebuiltChecklist.itemCount,
    };
  },

  async deleteSite(siteId: string): Promise<SiteDeleteResult> {
    const context = await buildSiteDeletionContext(siteId);
    const client = getSupabase();
    const documentsClient = documentsSchema(client);
    const photosClient = photoLabelsSchema(client);
    const requestLinksClient = requestLinksSchema(client);
    const signingClient = signingSchema(client);
    const exportsClient = exportsSchema(client);
    const messagingClient = messagingSchema(client);
    const bulkClient = bulkOpsSchema(client);
    const sitesClient = sitesSchema(client);

    if (context.documentIds.length > 0) {
      const { error: bulkPreviewItemsError } = await bulkClient
        .from('bulk_operation_preview_items')
        .delete()
        .in('document_id', context.documentIds);

      if (bulkPreviewItemsError) {
        throw new Error(`현장 삭제 실패: 일괄 수정 미리보기 항목 삭제 중 오류가 발생했습니다. (${bulkPreviewItemsError.message})`);
      }

      if (context.emptyBulkPreviewIds.length > 0) {
        const { error: bulkPreviewsError } = await bulkClient
          .from('bulk_operation_previews')
          .delete()
          .in('id', context.emptyBulkPreviewIds);

        if (bulkPreviewsError) {
          throw new Error(`현장 삭제 실패: 비어 있는 일괄 수정 미리보기 삭제 중 오류가 발생했습니다. (${bulkPreviewsError.message})`);
        }
      }

      const { error: smsSenderBindingError } = await messagingClient
        .from('sms_document_sender_registry')
        .delete()
        .in('document_id', context.documentIds);

      if (smsSenderBindingError) {
        throw new Error(`현장 삭제 실패: 문자 발신 연결 삭제 중 오류가 발생했습니다. (${smsSenderBindingError.message})`);
      }

      const { error: smsRecipientBindingError } = await messagingClient
        .from('sms_document_recipient_registry')
        .delete()
        .in('document_id', context.documentIds);

      if (smsRecipientBindingError) {
        throw new Error(`현장 삭제 실패: 문자 수신 연결 삭제 중 오류가 발생했습니다. (${smsRecipientBindingError.message})`);
      }

      const { error: exportJobsError } = await exportsClient
        .from('export_job_registry')
        .delete()
        .in('document_id', context.documentIds);

      if (exportJobsError) {
        throw new Error(`현장 삭제 실패: 변환 작업 삭제 중 오류가 발생했습니다. (${exportJobsError.message})`);
      }
    }

    if (context.requestLinkIds.length > 0) {
      const { error: smsDispatchError } = await messagingClient
        .from('sms_dispatch_registry')
        .delete()
        .in('request_link_id', context.requestLinkIds);

      if (smsDispatchError) {
        throw new Error(`현장 삭제 실패: 문자 발송 이력 삭제 중 오류가 발생했습니다. (${smsDispatchError.message})`);
      }

      const { error: emailDispatchError } = await messagingClient
        .from('email_dispatch_registry')
        .delete()
        .in('request_link_id', context.requestLinkIds);

      if (emailDispatchError) {
        throw new Error(`현장 삭제 실패: 이메일 발송 이력 삭제 중 오류가 발생했습니다. (${emailDispatchError.message})`);
      }

      const { error: requestLinksError } = await requestLinksClient
        .from('request_link_registry')
        .delete()
        .in('id', context.requestLinkIds);

      if (requestLinksError) {
        throw new Error(`현장 삭제 실패: 요청 링크 삭제 중 오류가 발생했습니다. (${requestLinksError.message})`);
      }
    }

    if (context.documentIds.length > 0) {
      const { error: signRequestsError } = await signingClient
        .from('sign_requests')
        .delete()
        .in('document_id', context.documentIds);

      if (signRequestsError) {
        throw new Error(`현장 삭제 실패: 전자서명 요청 삭제 중 오류가 발생했습니다. (${signRequestsError.message})`);
      }
    }

    const { error: photoRequirementError } = await photosClient
      .from('site_photo_label_requirements')
      .delete()
      .eq('site_id', context.site.id);

    if (photoRequirementError) {
      throw new Error(`현장 삭제 실패: 사진 요구사항 삭제 중 오류가 발생했습니다. (${photoRequirementError.message})`);
    }

    const { error: photoRegistryError } = await photosClient.from('photo_registry').delete().eq('site_id', context.site.id);

    if (photoRegistryError) {
      throw new Error(`현장 삭제 실패: 사진 삭제 중 오류가 발생했습니다. (${photoRegistryError.message})`);
    }

    if (context.documentIds.length > 0) {
      const { error: documentRegistryError } = await documentsClient
        .from('document_registry')
        .delete()
        .eq('site_id', context.site.id);

      if (documentRegistryError) {
        throw new Error(`현장 삭제 실패: 현장 문서 삭제 중 오류가 발생했습니다. (${documentRegistryError.message})`);
      }
    }

    const { error: siteRegistryError } = await sitesClient.from('site_registry').delete().eq('id', context.site.id);

    if (siteRegistryError) {
      throw new Error(`현장 삭제 실패: 현장 삭제 중 오류가 발생했습니다. (${siteRegistryError.message})`);
    }

    // Storage cleanup is best-effort after relational data is gone.
    try {
      await removeStorageObjects(
        client,
        context.documentValueFileStorageObjects,
        '현장 삭제 후 첨부 파일 저장소 정리 중 오류가 발생했습니다.'
      );
      await removeStorageObjects(client, context.photoStorageObjects, '현장 삭제 후 사진 저장소 정리 중 오류가 발생했습니다.');
    } catch (error) {
      console.error('Site delete storage cleanup warning:', error);
    }

    return {
      site: context.impact.site,
      items: context.impact.items,
    };
  },

  async rebuildChecklist(params: SiteChecklistRebuildInput): Promise<SiteChecklistRebuildResult> {
    const siteId = params.siteId.trim();

    if (!siteId) {
      throw new Error('체크리스트 재계산 실패: siteId가 필요합니다.');
    }

    if (params.requiredDocumentRules?.length) {
      await upsertRules(params.requiredDocumentRules);
    }

    const client = getSupabase();
    const sitesClient = sitesSchema(client);
    const { site, error: siteError } = await getSiteById(siteId);

    if (siteError || !site) {
      throw new Error(`체크리스트 재계산 실패: ${siteError?.message || '현장을 찾을 수 없습니다.'}`);
    }

    const nextChecklistVersion = (site.checklist_version || 0) + 1;
    const checklistSeed = await buildChecklistSeed(site);

    const { data: snapshotData, error: snapshotError } = await sitesClient
      .from('site_checklist_snapshots')
      .insert([
        {
          site_id: siteId,
          checklist_version: nextChecklistVersion,
        },
      ])
      .select('*')
      .single();

    const snapshot = snapshotData as SiteChecklistSnapshotRow | null;

    if (snapshotError || !snapshot) {
      throw new Error(`체크리스트 재계산 실패: 스냅샷 생성 중 오류가 발생했습니다. (${snapshotError?.message})`);
    }

    if (checklistSeed.length > 0) {
      const { error: itemsError } = await sitesClient.from('site_checklist_items').insert(
        checklistSeed.map((item) => ({
          site_id: siteId,
          checklist_snapshot_id: snapshot.id,
          checklist_version: nextChecklistVersion,
          document_type_key: item.documentTypeKey,
          document_title: item.documentTitle,
          source_trade_keys: item.sourceTradeKeys,
          status: item.status,
          linked_document_id: item.linkedDocumentId,
        }))
      );

      if (itemsError) {
        throw new Error(`체크리스트 재계산 실패: 항목 저장 중 오류가 발생했습니다. (${itemsError.message})`);
      }
    }

    const { data: updatedSiteData, error: siteUpdateError } = await sitesClient
      .from('site_registry')
      .update({ checklist_version: nextChecklistVersion })
      .eq('id', siteId)
      .select('*')
      .single();

    if (siteUpdateError || !updatedSiteData) {
      throw new Error(
        `체크리스트 재계산 실패: 현장 checklist_version 갱신 중 오류가 발생했습니다. (${siteUpdateError?.message})`
      );
    }

    const requiredDocuments = await this.getChecklist(siteId);

    return {
      site: requiredDocuments.site,
      checklistVersion: requiredDocuments.checklistVersion,
      itemCount: requiredDocuments.requiredDocuments.length,
      requiredDocuments: requiredDocuments.requiredDocuments,
    };
  },

  async getChecklist(siteId: string): Promise<SiteChecklistSummaryDto> {
    const normalizedSiteId = siteId.trim();

    if (!normalizedSiteId) {
      throw new Error('체크리스트 조회 실패: siteId가 필요합니다.');
    }

    const client = getSupabase();
    const sitesClient = sitesSchema(client);
    const { site, error: siteError } = await getSiteById(normalizedSiteId);

    if (siteError || !site) {
      throw new Error(`체크리스트 조회 실패: ${siteError?.message || '현장을 찾을 수 없습니다.'}`);
    }

    const checklistVersion = site.checklist_version || 0;
    let photoGapSummary: SitePhotoLabelGapSummaryDto;

    try {
      photoGapSummary = await PhotoLabelRequirementService.getSitePhotoLabelGaps(normalizedSiteId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      throw new Error(`체크리스트 조회 실패: 사진 증빙 상태 조회 중 오류가 발생했습니다. (${message})`);
    }

    const photoRequirementsByDocumentType = groupPhotoRequirementsByDocumentType(photoGapSummary);

    if (checklistVersion === 0) {
      return {
        site: toSiteRecordDto(site),
        checklistVersion: 0,
        generatedAt: null,
        requiredDocuments: [],
        missingCount: 0,
        completedCount: 0,
        photoRequirementCount: photoGapSummary.requirementCount,
        photoCoveredCount: photoGapSummary.coveredCount,
        photoReviewNeededCount: photoGapSummary.reviewNeededCount,
        photoMissingCount: photoGapSummary.missingCount,
      };
    }

    const [snapshotResponse, itemsResponse] = await Promise.all([
      sitesClient
        .from('site_checklist_snapshots')
        .select('*')
        .eq('site_id', normalizedSiteId)
        .eq('checklist_version', checklistVersion)
        .single(),
      sitesClient
        .from('site_checklist_items')
        .select('*')
        .eq('site_id', normalizedSiteId)
        .eq('checklist_version', checklistVersion)
        .order('document_type_key', { ascending: true }),
    ]);

    const snapshot = snapshotResponse.data as SiteChecklistSnapshotRow | null;
    const items = ((itemsResponse.data || []) as SiteChecklistItemRow[]).map((row) => {
      const item = toChecklistItemDto(row);

      return {
        ...item,
        photoEvidence: buildPhotoEvidenceDto(photoRequirementsByDocumentType.get(item.documentTypeKey) || []),
      };
    });

    if (snapshotResponse.error || !snapshot) {
      throw new Error(
        `체크리스트 조회 실패: 스냅샷을 찾을 수 없습니다. (${snapshotResponse.error?.message || 'missing snapshot'})`
      );
    }

    if (itemsResponse.error) {
      throw new Error(`체크리스트 조회 실패: 항목 조회 중 오류가 발생했습니다. (${itemsResponse.error.message})`);
    }

    const missingCount = items.filter((item) => item.status === 'missing').length;
    const completedCount = items.filter((item) => item.status === 'completed').length;

    return {
      site: toSiteRecordDto(site),
      checklistVersion,
      generatedAt: snapshot.generated_at,
      requiredDocuments: items,
      missingCount,
      completedCount,
      photoRequirementCount: photoGapSummary.requirementCount,
      photoCoveredCount: photoGapSummary.coveredCount,
      photoReviewNeededCount: photoGapSummary.reviewNeededCount,
      photoMissingCount: photoGapSummary.missingCount,
    };
  },
};
