import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generateDocumentHash } from '../lib/crypto';
import { DocumentService } from './documentService';
import type {
  RequestLinkCreateInput,
  RequestLinkCreateResult,
  RequestLinkPublicViewDto,
  RequestLinkRecordDto,
  RequestLinkScalarValue,
  RequestLinkSubmitAuditDto,
  RequestLinkSubmitInput,
  RequestLinkSubmitResult,
} from '../lib/requestLinkDtos';

type RequestLinkRow = {
  id: string;
  document_id: string;
  token_hash: string;
  recipient_channel: RequestLinkRecordDto['recipientChannel'];
  recipient_target: string;
  recipient_name: string | null;
  allowed_labels: string[] | null;
  expires_at: string;
  one_time_use: boolean;
  status: RequestLinkRecordDto['status'];
  requested_by: string | null;
  created_at: string;
  updated_at: string;
};

type RequestLinkSubmitAuditRow = {
  id: string;
  request_link_id: string;
  document_id: string;
  submitted_by: string | null;
  submitted_labels: Record<string, RequestLinkScalarValue> | null;
  updated_version_id: string;
  created_at: string;
};

type RecentRequestLinkListItem = {
  requestLink: RequestLinkRecordDto;
  documentTitle: string;
  documentTypeKey: string;
  siteId: string;
  maskedRecipientTarget: string;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const REQUEST_LINKS_DB_SCHEMA = 'request_links';
const requestLinksSchema = (client = getSupabase()) => client.schema(REQUEST_LINKS_DB_SCHEMA);

// REQUEST_LINKS_SCHEMA_BOUNDARY
// 요청 링크 도메인의 정본은 request_links 스키마에만 저장합니다.
// 토큰 원문은 저장하지 않고 token_hash 만 저장하며, 문서 반영은 documents 서비스 계약만 사용합니다.

// REQ_LINK_SCALAR_ONLY_PHASE1
// 1차 구현에서는 허용 라벨 제출값을 scalar(string/number/boolean/null) 로만 제한합니다.
// 객체/배열 제출은 다음 단계 전까지 차단합니다.
const isScalarValue = (value: unknown): value is RequestLinkScalarValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

const toRequestLinkDto = (row: RequestLinkRow): RequestLinkRecordDto => ({
  id: row.id,
  documentId: row.document_id,
  recipientChannel: row.recipient_channel,
  recipientTarget: row.recipient_target,
  recipientName: row.recipient_name,
  allowedLabels: row.allowed_labels || [],
  expiresAt: row.expires_at,
  oneTimeUse: row.one_time_use,
  status: row.status,
  requestedBy: row.requested_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSubmitAuditDto = (row: RequestLinkSubmitAuditRow): RequestLinkSubmitAuditDto => ({
  id: row.id,
  requestLinkId: row.request_link_id,
  documentId: row.document_id,
  submittedBy: row.submitted_by,
  submittedLabels: row.submitted_labels || {},
  updatedVersionId: row.updated_version_id,
  createdAt: row.created_at,
});

const maskRecipientTarget = (recipientTarget: string) => {
  if (recipientTarget.includes('@')) {
    const [local, domain] = recipientTarget.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }

  return `${recipientTarget.slice(0, 3)}****${recipientTarget.slice(-2)}`;
};

const normalizeAllowedLabels = (allowedLabels: string[]) => {
  const normalized = [...new Set((allowedLabels || []).map((item) => item.trim()).filter(Boolean))];

  if (normalized.length === 0) {
    throw new Error('요청 링크 생성 실패: allowedLabels가 최소 1개 이상 필요합니다.');
  }

  return normalized;
};

const isExpired = (expiresAt: string) => new Date(expiresAt).getTime() <= Date.now();

const getTokenHash = (token: string) => generateDocumentHash(token);

const generateRequestToken = () => randomBytes(24).toString('hex');

const serializeRequestLinkValueFile = (valueFile: {
  valueKey: string;
  storageBucket: string;
  storagePath: string;
  originalFileName: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  sortOrder?: number | null;
}) => ({
  valueKey: String(valueFile.valueKey || '').trim(),
  storageBucket: String(valueFile.storageBucket || '').trim(),
  storagePath: String(valueFile.storagePath || '').trim(),
  originalFileName: String(valueFile.originalFileName || '').trim(),
  mimeType: valueFile.mimeType || null,
  fileSizeBytes: valueFile.fileSizeBytes ?? null,
  sortOrder: valueFile.sortOrder ?? 0,
});

const getRequestLinkByToken = async (token: string) => {
  const tokenHash = getTokenHash(token);
  const { data, error } = await requestLinksSchema()
    .from('request_link_registry')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();

  return {
    requestLink: data as RequestLinkRow | null,
    error,
  };
};

export const RequestLinkService = {
  async listRecentRequestLinks(query: { siteId?: string; limit?: number } = {}): Promise<RecentRequestLinkListItem[]> {
    const client = getSupabase();
    const requestLinksClient = requestLinksSchema(client);
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);

    let registryQuery = requestLinksClient
      .from('request_link_registry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (query.siteId?.trim()) {
      const siteDocuments = await DocumentService.listDocuments({ siteId: query.siteId.trim() });
      const documentIds = siteDocuments.map((item) => item.document.id);

      if (documentIds.length === 0) {
        return [];
      }

      registryQuery = registryQuery.in('document_id', documentIds);
    }

    const { data, error } = await registryQuery;
    const rows = (data || []) as RequestLinkRow[];

    if (error) {
      throw new Error(`요청 링크 목록 조회 실패: ${error.message}`);
    }

    const items = await Promise.all(
      rows.map(async (row) => {
        const detail = await DocumentService.getDocumentDetail(row.document_id);

        return {
          requestLink: toRequestLinkDto(row),
          documentTitle: detail.document.title,
          documentTypeKey: detail.document.documentTypeKey,
          siteId: detail.document.siteId,
          maskedRecipientTarget: maskRecipientTarget(row.recipient_target),
        };
      })
    );

    return items;
  },

  async getRequestLinkById(requestLinkId: string) {
    const normalizedRequestLinkId = requestLinkId.trim();

    if (!normalizedRequestLinkId) {
      throw new Error('요청 링크 조회 실패: requestLinkId가 필요합니다.');
    }

    const { data, error } = await requestLinksSchema()
      .from('request_link_registry')
      .select('*')
      .eq('id', normalizedRequestLinkId)
      .single();

    if (error || !data) {
      throw new Error(`요청 링크 조회 실패: ${error?.message || '요청 링크를 찾을 수 없습니다.'}`);
    }

    return toRequestLinkDto(data as RequestLinkRow);
  },

  async issueDispatchUrl(requestLinkId: string) {
    const normalizedRequestLinkId = requestLinkId.trim();

    if (!normalizedRequestLinkId) {
      throw new Error('요청 링크 발송 URL 생성 실패: requestLinkId가 필요합니다.');
    }

    const client = getSupabase();
    const requestLinksClient = requestLinksSchema(client);
    const { data, error } = await requestLinksClient
      .from('request_link_registry')
      .select('*')
      .eq('id', normalizedRequestLinkId)
      .single();

    const requestLink = data as RequestLinkRow | null;

    if (error || !requestLink) {
      throw new Error(`요청 링크 발송 URL 생성 실패: ${error?.message || '요청 링크를 찾을 수 없습니다.'}`);
    }

    if (requestLink.status === 'revoked') {
      throw new Error('요청 링크 발송 URL 생성 실패: 이미 폐기된 링크입니다.');
    }

    if (requestLink.one_time_use && requestLink.status === 'submitted') {
      throw new Error('요청 링크 발송 URL 생성 실패: 이미 사용된 1회성 링크입니다.');
    }

    if (isExpired(requestLink.expires_at)) {
      throw new Error('요청 링크 발송 URL 생성 실패: 만료된 링크입니다.');
    }

    const token = generateRequestToken();
    const tokenHash = getTokenHash(token);
    const { data: updatedData, error: updateError } = await requestLinksClient
      .from('request_link_registry')
      .update({
        token_hash: tokenHash,
        status: 'active',
      })
      .eq('id', requestLink.id)
      .select('*')
      .single();

    const updatedRequestLink = updatedData as RequestLinkRow | null;

    if (updateError || !updatedRequestLink) {
      throw new Error(
        `요청 링크 발송 URL 생성 실패: 토큰 갱신 중 오류가 발생했습니다. (${updateError?.message || 'unknown'})`
      );
    }

    return {
      requestLink: toRequestLinkDto(updatedRequestLink),
      maskedUrl: `/request-links/${token}`,
    };
  },

  async createRequestLink(params: RequestLinkCreateInput): Promise<RequestLinkCreateResult> {
    const documentId = params.documentId.trim();
    const recipientTarget = params.recipientTarget.trim();
    const expiresAt = params.expiresAt.trim();

    if (!documentId) {
      throw new Error('요청 링크 생성 실패: documentId가 필요합니다.');
    }

    if (!recipientTarget) {
      throw new Error('요청 링크 생성 실패: recipientTarget이 필요합니다.');
    }

    if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
      throw new Error('요청 링크 생성 실패: expiresAt이 올바른 ISO 날짜여야 합니다.');
    }

    if (isExpired(expiresAt)) {
      throw new Error('요청 링크 생성 실패: expiresAt은 현재 시각보다 미래여야 합니다.');
    }

    await DocumentService.getDocumentDetail(documentId);

    const allowedLabels = normalizeAllowedLabels(params.allowedLabels || []);
    const token = generateRequestToken();
    const tokenHash = getTokenHash(token);
    const { data, error } = await requestLinksSchema()
      .from('request_link_registry')
      .insert([
        {
          document_id: documentId,
          token_hash: tokenHash,
          recipient_channel: params.recipientChannel,
          recipient_target: recipientTarget,
          recipient_name: params.recipientName?.trim() || null,
          allowed_labels: allowedLabels,
          expires_at: expiresAt,
          one_time_use: params.oneTimeUse ?? true,
          status: 'active',
          requested_by: params.requestedBy?.trim() || null,
        },
      ])
      .select('*')
      .single();

    const requestLink = data as RequestLinkRow | null;

    if (error || !requestLink) {
      throw new Error(`요청 링크 생성 실패: ${error?.message || '요청 링크를 저장할 수 없습니다.'}`);
    }

    return {
      requestLink: toRequestLinkDto(requestLink),
      token,
      maskedUrl: `/request-links/${token}`,
    };
  },

  async getPublicRequestLink(token: string): Promise<RequestLinkPublicViewDto> {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      throw new Error('요청 링크 조회 실패: token이 필요합니다.');
    }

    const { requestLink, error } = await getRequestLinkByToken(normalizedToken);

    if (error || !requestLink) {
      throw new Error(`요청 링크 조회 실패: ${error?.message || '요청 링크를 찾을 수 없습니다.'}`);
    }

    const currentStatus =
      requestLink.status === 'active' && isExpired(requestLink.expires_at) ? 'expired' : requestLink.status;

    const detail = await DocumentService.getDocumentDetail(requestLink.document_id);
    const latestVersion = detail.latestVersion;
    const allowedLabelValues = (requestLink.allowed_labels || []).reduce<Record<string, unknown>>((acc, labelKey) => {
      acc[labelKey] = latestVersion?.labelValues?.[labelKey] ?? null;
      return acc;
    }, {});

    return {
      requestLinkId: requestLink.id,
      status: currentStatus,
      expiresAt: requestLink.expires_at,
      oneTimeUse: requestLink.one_time_use,
      recipientName: requestLink.recipient_name,
      allowedLabels: requestLink.allowed_labels || [],
      documentSummary: {
        documentId: detail.document.id,
        title: detail.document.title,
        documentTypeKey: detail.document.documentTypeKey,
        siteId: detail.document.siteId,
        currentVersionNumber: detail.document.currentVersionNumber,
        latestVersionHtml: latestVersion?.htmlCanonical || null,
        latestVersionCreatedAt: latestVersion?.createdAt || null,
        labelValues: latestVersion?.labelValues || {},
        allowedLabelValues,
        valueFiles: detail.valueFiles,
        valueEntries: detail.valueEntries,
        templateLink: detail.templateLink,
        linkedTemplate: detail.linkedTemplate,
      },
    };
  },

  async submitRequestLink(token: string, params: RequestLinkSubmitInput): Promise<RequestLinkSubmitResult> {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      throw new Error('요청 링크 제출 실패: token이 필요합니다.');
    }

    const { requestLink, error } = await getRequestLinkByToken(normalizedToken);

    if (error || !requestLink) {
      throw new Error(`요청 링크 제출 실패: ${error?.message || '요청 링크를 찾을 수 없습니다.'}`);
    }

    if (requestLink.status === 'revoked') {
      throw new Error('요청 링크 제출 실패: 이미 폐기된 링크입니다.');
    }

    if (isExpired(requestLink.expires_at)) {
      throw new Error('요청 링크 제출 실패: 만료된 링크입니다.');
    }

    if (requestLink.one_time_use && requestLink.status === 'submitted') {
      throw new Error('요청 링크 제출 실패: 이미 사용된 1회성 링크입니다.');
    }

    const submittedValues = params.labelValues || {};
    const allowedLabels = new Set(requestLink.allowed_labels || []);
    const submittedKeys = Object.keys(submittedValues);

    for (const key of submittedKeys) {
      if (!allowedLabels.has(key)) {
        throw new Error(`요청 링크 제출 실패: 허용되지 않은 라벨(${key})은 수정할 수 없습니다.`);
      }

      if (!isScalarValue(submittedValues[key])) {
        throw new Error(`요청 링크 제출 실패: ${key} 값은 string/number/boolean/null만 허용됩니다.`);
      }
    }

    const detail = await DocumentService.getDocumentDetail(requestLink.document_id);
    const latestVersion = detail.latestVersion;

    if (!latestVersion) {
      throw new Error('요청 링크 제출 실패: 최신 문서 버전이 없습니다.');
    }

    const nextLabelValues = { ...(latestVersion.labelValues || {}) } as Record<string, unknown>;
    const updatedLabels: string[] = [];

    for (const labelKey of requestLink.allowed_labels || []) {
      if (Object.prototype.hasOwnProperty.call(submittedValues, labelKey)) {
        const nextValue = submittedValues[labelKey];
        const currentValue = nextLabelValues[labelKey] ?? null;

        if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
          updatedLabels.push(labelKey);
        }

        nextLabelValues[labelKey] = nextValue;
      }
    }

    const allowedValueKeys = new Set(requestLink.allowed_labels || []);
    const currentAllowedValueFiles = detail.valueFiles
      .filter((file) => allowedValueKeys.has(file.valueKey))
      .map(serializeRequestLinkValueFile)
      .sort((left, right) =>
        `${left.valueKey}:${left.sortOrder}:${left.originalFileName}`.localeCompare(
          `${right.valueKey}:${right.sortOrder}:${right.originalFileName}`,
          'ko'
        )
      );
    const nextAllowedValueFiles = (params.valueFiles || [])
      .filter((file) => allowedValueKeys.has(String(file.valueKey || '').trim()))
      .map(serializeRequestLinkValueFile)
      .sort((left, right) =>
        `${left.valueKey}:${left.sortOrder}:${left.originalFileName}`.localeCompare(
          `${right.valueKey}:${right.sortOrder}:${right.originalFileName}`,
          'ko'
        )
      );
    const attachmentFilesChanged =
      JSON.stringify(currentAllowedValueFiles) !== JSON.stringify(nextAllowedValueFiles);

    if (updatedLabels.length === 0 && !attachmentFilesChanged) {
      throw new Error('요청 링크 제출 실패: 실제로 바뀌는 허용 라벨 값이 없습니다.');
    }

    const nextHtmlCanonical = typeof params.htmlCanonical === 'string' && params.htmlCanonical.trim()
      ? params.htmlCanonical.trim()
      : latestVersion.htmlCanonical;

    const versionResult = await DocumentService.createVersion(requestLink.document_id, {
      htmlCanonical: nextHtmlCanonical,
      labelValues: nextLabelValues,
      valueFiles: params.valueFiles,
      changeReason: `request-link:${requestLink.id}`,
      createdBy: params.submittedBy?.trim() || 'request-link-submit',
    });

    const client = getSupabase();
    const requestLinksClient = requestLinksSchema(client);
    const { data: auditData, error: auditError } = await requestLinksClient
      .from('request_link_submit_audits')
      .insert([
        {
          request_link_id: requestLink.id,
          document_id: requestLink.document_id,
          submitted_by: params.submittedBy?.trim() || null,
          submitted_labels: submittedValues,
          updated_version_id: versionResult.latestVersion.id,
        },
      ])
      .select('*')
      .single();

    const auditLog = auditData as RequestLinkSubmitAuditRow | null;

    if (auditError || !auditLog) {
      throw new Error(`요청 링크 제출 실패: 감사 로그 저장 중 오류가 발생했습니다. (${auditError?.message})`);
    }

    const nextStatus = requestLink.one_time_use ? 'submitted' : 'active';
    const { error: updateError } = await requestLinksClient
      .from('request_link_registry')
      .update({
        status: nextStatus,
      })
      .eq('id', requestLink.id);

    if (updateError) {
      throw new Error(`요청 링크 제출 실패: 링크 상태 갱신 중 오류가 발생했습니다. (${updateError.message})`);
    }

    return {
      status: 'submitted',
      updatedLabels,
      requestLinkId: requestLink.id,
      updatedVersionId: versionResult.latestVersion.id,
      auditLog: toSubmitAuditDto(auditLog),
    };
  },

  maskRecipientTarget,
};
