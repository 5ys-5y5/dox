import { createClient } from '@supabase/supabase-js';
import {
  type DocumentHashInput,
  generateDocumentHash,
  generateDocumentHashInfo,
  isValidSha256Hash,
  safeCompareHashes,
} from '../lib/crypto';
import { MemberAccessService } from './memberAccessService';

type SignerInfo = {
  email: string;
  name: string;
  phoneNumber?: string;
  signatureSlotKey?: string | null;
};

type AuditMetadata = Record<string, unknown>;

type SignRequestRow = {
  id: string;
  document_id?: string | null;
  signature_slot_key?: string | null;
  signer_info?: Record<string, unknown> | null;
  status: string;
  expiration_date: string | null;
  document_hash: string | null;
  document_hash_algorithm?: string | null;
  document_hash_encoding?: string | null;
  document_canonicalization?: string | null;
  document_byte_length?: number | null;
};

type VerifiedAuthRow = {
  id: string;
  auth_status: string;
  document_hash: string;
  consent_text_hash: string;
};

type SignatureRow = {
  id: string;
  request_id: string;
  document_hash: string;
  document_hash_algorithm?: string | null;
  document_hash_encoding?: string | null;
  document_canonicalization?: string | null;
  document_byte_length?: number | null;
  signature_image_path?: string | null;
  signer_id?: string | null;
  signed_at?: string | null;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const supabase = () => getSupabase();
const SIGNING_DB_SCHEMA = 'signing';
const DOCUMENTS_DB_SCHEMA = 'documents';

// SIGNING_SCHEMA_BOUNDARY
// 전자서명 도메인 테이블은 public이 아니라 signing 스키마만 사용합니다.
// 이후 LLM 구현도 sign_requests/signatures/signature_audit_logs/sign_authentications를
// 직접 public으로 접근하지 말고 항상 signing 스키마 클라이언트를 통해 접근해야 합니다.
// SUPABASE_API_SCHEMA_REQUIRED
// Supabase Dashboard > Project Settings > API > Exposed schemas 에 signing 을 추가해야 합니다.
const signingSchema = (client = getSupabase()) => client.schema(SIGNING_DB_SCHEMA);
const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);

// AUTH_GATE_POST_INTEGRATION_REQUIRED
// BaroCert/PASS 본인확인 연동이 끝나면 아래 임시 허용을 반드시 제거해야 합니다.
// 1. SIGNABLE_STATUSES를 ['authenticated']만 허용하도록 축소
// 2. executeSignature 전에 sign_authentications(또는 동등 테이블)에서
//    request_id + document_hash 기준 verified 인증 레코드 존재를 강제
// 3. SQL의 validate_sign_request_status_transition()에서 pending -> signed 제거
// 4. SQL의 enforce_signature_request_document_integrity()에서 pending 허용 제거
// 5. 검증 SQL에서 auth_gate_temporary_pending_signed가 PASS로 바뀌는지 확인
// 현재 'pending'은 본인확인 미구현 기간의 임시 전이(pending -> signed)입니다.
const SIGNABLE_STATUSES = ['pending', 'authenticated'] as const;

const isExpired = (expirationDate?: string | null) => {
  if (!expirationDate) return false;

  return new Date(expirationDate).getTime() <= Date.now();
};

const normalizeIpAddress = (ipAddress?: string | null) => {
  const firstForwardedIp = (ipAddress || '').split(',')[0]?.trim();

  return firstForwardedIp || null;
};

const normalizeSignatureSlotKey = (value?: string | null) => {
  const normalized = String(value || '')
    .split('>')
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' > ');

  return normalized || null;
};

const normalizeSignerPhoneNumber = (value?: string | null) => String(value || '').replace(/[^0-9]/g, '').trim();
const normalizeSignerEmail = (value?: string | null) => String(value || '').trim().toLowerCase();
const normalizeSignerName = (value?: string | null) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const readSignerInfoString = (signerInfo: Record<string, unknown> | null | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = signerInfo?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
};

const buildSignerDuplicateKeys = (signerInfo: Record<string, unknown> | SignerInfo | null | undefined) => {
  const phoneNumber = normalizeSignerPhoneNumber(
    readSignerInfoString(signerInfo as Record<string, unknown> | null | undefined, ['phoneNumber', 'phone_number', 'phone'])
  );
  const email = normalizeSignerEmail(
    readSignerInfoString(signerInfo as Record<string, unknown> | null | undefined, ['email'])
  );
  const duplicateKeys = [phoneNumber ? `phone:${phoneNumber}` : '', email ? `email:${email}` : ''].filter(Boolean);

  if (duplicateKeys.length > 0) {
    return duplicateKeys;
  }

  const name = normalizeSignerName(
    readSignerInfoString(signerInfo as Record<string, unknown> | null | undefined, ['name', 'displayName', 'display_name'])
  );

  return name ? [`name:${name}`] : [];
};

const readSignerInfoSignatureSlotKey = (signerInfo: Record<string, unknown> | null | undefined) =>
  normalizeSignatureSlotKey(
    readSignerInfoString(signerInfo, ['signatureSlotKey', 'signature_slot_key'])
  );

const isDeletedSignRequestInfo = (signerInfo: Record<string, unknown> | null | undefined) => {
  const deletedAt = readSignerInfoString(signerInfo, ['deletedAt', 'deleted_at']);

  return Boolean(deletedAt || signerInfo?.deleted === true);
};

const normalizeOptionalUuid = (value?: string | null) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
};

const isMissingSignatureSlotKeySchemaError = (error: unknown) => {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message || '') : String(error || '');

  return (
    message.includes('signature_slot_key') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  );
};

const signRequestCreationLocks = new Map<string, Promise<void>>();

const buildSignRequestCreationLockKey = (params: {
  documentId: string;
  signatureSlotKey: string | null;
  signerInfo: SignerInfo;
}) => {
  const documentId = String(params.documentId || '').trim();
  const slotKey = params.signatureSlotKey || '__without_signature_slot__';

  if (params.signatureSlotKey) {
    return `document:${documentId}|slot:${slotKey}`;
  }

  const signerKeys = buildSignerDuplicateKeys(params.signerInfo).sort().join('|') || '__unknown_signer__';

  return `document:${documentId}|slot:${slotKey}|signer:${signerKeys}`;
};

const withSignRequestCreationLock = async <T>(lockKey: string, operation: () => Promise<T>) => {
  const previousLock = signRequestCreationLocks.get(lockKey) || Promise.resolve();
  let releaseCurrentLock = () => {};
  const currentLock = new Promise<void>((resolve) => {
    releaseCurrentLock = resolve;
  });
  const nextLock = previousLock.then(() => currentLock, () => currentLock);

  signRequestCreationLocks.set(lockKey, nextLock);
  await previousLock.catch(() => undefined);

  try {
    return await operation();
  } finally {
    releaseCurrentLock();

    if (signRequestCreationLocks.get(lockKey) === nextLock) {
      signRequestCreationLocks.delete(lockKey);
    }
  }
};

const assertNoDuplicateSignRequest = async (params: {
  signingClient: ReturnType<typeof signingSchema>;
  documentId: string;
  signatureSlotKey: string | null;
  signerInfo: SignerInfo;
}) => {
  const documentId = String(params.documentId || '').trim();
  const signerDuplicateKeys = buildSignerDuplicateKeys(params.signerInfo);

  if (!documentId || (!params.signatureSlotKey && signerDuplicateKeys.length === 0)) {
    return;
  }

  const signerDuplicateKeySet = new Set(signerDuplicateKeys);
  const duplicateMessage = '서명 요청 생성 실패: 같은 문서, 같은 서명 위치, 같은 서명자에게 이미 생성된 서명 요청이 있습니다.';
  const assignedSlotMessage = '서명 요청 생성 실패: 같은 문서의 같은 서명 위치에는 이미 서명 요청이 있습니다.';
  const { data, error } = await params.signingClient
    .from('sign_requests')
    .select('id, document_id, signature_slot_key, signer_info, status')
    .eq('document_id', documentId);
  let signRequestsData = data as SignRequestRow[] | null;
  let signRequestsError = error;

  if (signRequestsError && isMissingSignatureSlotKeySchemaError(signRequestsError)) {
    const fallbackResponse = await params.signingClient
      .from('sign_requests')
      .select('id, document_id, signer_info, status')
      .eq('document_id', documentId);

    signRequestsData = fallbackResponse.data as SignRequestRow[] | null;
    signRequestsError = fallbackResponse.error;
  }

  if (signRequestsError) {
    throw new Error(`서명 요청 생성 실패: 기존 서명 요청 확인 중 오류가 발생했습니다. (${signRequestsError.message})`);
  }

  let duplicateReason: 'same-signer' | 'same-slot' | null = null;

  for (const request of signRequestsData || []) {
    const requestSignerInfo =
      request.signer_info && typeof request.signer_info === 'object' && !Array.isArray(request.signer_info)
        ? request.signer_info
        : null;
    const requestSlotKey = normalizeSignatureSlotKey(request.signature_slot_key) ||
      readSignerInfoSignatureSlotKey(requestSignerInfo);
    const requestSignerDuplicateKeys = buildSignerDuplicateKeys(requestSignerInfo);

    if (isDeletedSignRequestInfo(requestSignerInfo) || requestSlotKey !== params.signatureSlotKey) {
      continue;
    }

    if (requestSignerDuplicateKeys.some((key) => signerDuplicateKeySet.has(key))) {
      duplicateReason = 'same-signer';
      break;
    }

    if (params.signatureSlotKey) {
      duplicateReason = 'same-slot';
    }
  }

  if (duplicateReason === 'same-signer') {
    throw new Error(duplicateMessage);
  }

  if (duplicateReason === 'same-slot') {
    throw new Error(assignedSlotMessage);
  }
};

export const SignService = {
  async createRequest(params: {
    documentId: string;
    signatureSlotKey?: string | null;
    documentContent: DocumentHashInput;
    signerInfo: SignerInfo;
    expirationDate?: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (params.documentContent === undefined) {
      throw new Error('서명 요청 생성 실패: documentContent가 필요합니다.');
    }

    const documentHashInfo = generateDocumentHashInfo(params.documentContent);
    const signatureSlotKey = normalizeSignatureSlotKey(params.signatureSlotKey);
    const signingClient = signingSchema();
    const signerInfo = {
      ...params.signerInfo,
      signatureSlotKey,
    };
    const creationLockKey = buildSignRequestCreationLockKey({
      documentId: params.documentId,
      signatureSlotKey,
      signerInfo,
    });

    return await withSignRequestCreationLock(creationLockKey, async () => {
      await assertNoDuplicateSignRequest({
        signingClient,
        documentId: params.documentId,
        signatureSlotKey,
        signerInfo,
      });

      const baseInsertPayload = {
        document_id: params.documentId,
        document_hash: documentHashInfo.hash,
        document_hash_algorithm: documentHashInfo.algorithm,
        document_hash_encoding: documentHashInfo.encoding,
        document_canonicalization: documentHashInfo.canonicalization,
        document_byte_length: documentHashInfo.byteLength,
        signer_info: signerInfo,
        expiration_date: params.expirationDate?.toISOString(),
        status: 'pending',
      };

      const { data: request, error: requestError } = await signingClient
        .from('sign_requests')
        .insert([
          {
            ...baseInsertPayload,
            signature_slot_key: signatureSlotKey,
          },
        ])
        .select()
        .single();

      let createdRequest = request;

      if (requestError) {
        if (!isMissingSignatureSlotKeySchemaError(requestError)) {
          throw new Error(`서명 요청 생성 실패: ${requestError.message}`);
        }

        const { data: fallbackRequest, error: fallbackRequestError } = await signingClient
          .from('sign_requests')
          .insert([baseInsertPayload])
          .select()
          .single();

        if (fallbackRequestError) {
          throw new Error(`서명 요청 생성 실패: ${fallbackRequestError.message}`);
        }

        createdRequest = fallbackRequest;
      }

      await this.logAudit({
        requestId: createdRequest.id,
        action: 'REQUEST_CREATED',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          documentHash: documentHashInfo.hash,
          hashAlgorithm: documentHashInfo.algorithm,
          hashEncoding: documentHashInfo.encoding,
          canonicalization: documentHashInfo.canonicalization,
          byteLength: documentHashInfo.byteLength,
          signatureSlotKey,
        },
      });

      return createdRequest;
    });
  },

  async deleteRequest(params: {
    requestId: string;
    actingMemberId?: string | null;
    authenticatedAt?: string | null;
    ipAddress?: string;
    userAgent?: string;
    contractImpactAcknowledged?: boolean;
  }) {
    const requestId = String(params.requestId || '').trim();

    if (!requestId) {
      throw new Error('서명 요청 삭제 실패: requestId가 필요합니다.');
    }

    const client = getSupabase();
    const signingClient = signingSchema(client);
    const requestResponse = await signingClient
      .from('sign_requests')
      .select('id, document_id, signature_slot_key, signer_info, status')
      .eq('id', requestId)
      .maybeSingle();
    let requestData = requestResponse.data as SignRequestRow | null;
    let requestError = requestResponse.error;

    if (requestError && isMissingSignatureSlotKeySchemaError(requestError)) {
      const fallbackRequestResponse = await signingClient
        .from('sign_requests')
        .select('id, document_id, signer_info, status')
        .eq('id', requestId)
        .maybeSingle();

      requestData = fallbackRequestResponse.data as SignRequestRow | null;
      requestError = fallbackRequestResponse.error;
    }

    if (requestError) {
      throw new Error(`서명 요청 삭제 실패: ${requestError.message}`);
    }

    if (!requestData) {
      throw new Error('서명 요청 삭제 실패: 요청을 찾을 수 없습니다.');
    }

    const actingMemberId = String(params.actingMemberId || '').trim();
    const documentId = String(requestData.document_id || '').trim();

    if (!actingMemberId) {
      throw new Error('서명 요청 삭제 소속이 없습니다.');
    }

    if (!documentId) {
      throw new Error('서명 요청 삭제 실패: 요청에 연결된 문서를 찾을 수 없습니다.');
    }

    const { data: documentData, error: documentError } = await documentsSchema(client)
      .from('document_registry')
      .select('id, site_id')
      .eq('id', documentId)
      .maybeSingle();
    const documentRecord = documentData as { id: string; site_id: string | null } | null;

    if (documentError || !documentRecord?.site_id) {
      throw new Error(`서명 요청 삭제 실패: 요청 문서의 현장을 확인할 수 없습니다. (${documentError?.message || documentId})`);
    }

    const accessSession = await MemberAccessService.getMemberAccessSession(
      actingMemberId,
      params.authenticatedAt || undefined
    );
    const siteAccess = accessSession.accessibleSites.find((site) => site.siteId === documentRecord.site_id) || null;

    if (!siteAccess) {
      throw new Error('서명 요청 삭제 소속이 없습니다.');
    }

    const requestStatus = String(requestData.status || '').trim().toLowerCase();
    const { data: signatureRowsData, error: signatureRowsError } = await signingClient
      .from('signatures')
      .select('id')
      .eq('request_id', requestId)
      .limit(1);
    const hasStoredSignature = ((signatureRowsData || []) as { id: string }[]).length > 0;

    if (signatureRowsError) {
      throw new Error(`서명 요청 삭제 실패: 완료 서명 확인 중 오류가 발생했습니다. (${signatureRowsError.message})`);
    }

    const deletesCompletedSignature = requestStatus === 'completed' || requestStatus === 'signed' || hasStoredSignature;

    if (deletesCompletedSignature && !params.contractImpactAcknowledged) {
      throw new Error('서명 완료 항목 삭제는 계약서에 치명적인 영향을 줄 수 있음을 확인해야 합니다.');
    }

    const currentSignerInfo =
      requestData.signer_info && typeof requestData.signer_info === 'object' && !Array.isArray(requestData.signer_info)
        ? requestData.signer_info
        : {};
    const deletedAt = new Date().toISOString();
    const nextSignerInfo: Record<string, unknown> = {
      ...currentSignerInfo,
      deletedAt,
      deletedBy: 'project-page',
      deletedStatus: requestData.status,
    };

    if (deletesCompletedSignature) {
      nextSignerInfo.contractImpactAcknowledged = true;
    }

    const { error: requestUpdateError } = await signingClient
      .from('sign_requests')
      .update({ signer_info: nextSignerInfo })
      .eq('id', requestId);

    if (requestUpdateError) {
      throw new Error(`서명 요청 삭제 실패: ${requestUpdateError.message}`);
    }

    await this.logAudit({
      requestId,
      action: 'REQUEST_DELETED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        documentId: requestData.document_id || null,
        signatureSlotKey: requestData.signature_slot_key || null,
        status: requestData.status,
        deletedAt,
        contractImpactAcknowledged: deletesCompletedSignature,
      },
    });

    return {
      request: {
        id: requestData.id,
        documentId: requestData.document_id || null,
        signatureSlotKey: requestData.signature_slot_key || null,
        signerInfo: nextSignerInfo,
        status: requestData.status,
        deletedAt,
      },
    };
  },

  async executeSignature(params: {
    requestId: string;
    documentContent: DocumentHashInput;
    signatureImagePath: string;
    consentText?: string;
    signerId?: string;
    ipAddress?: string;
    userAgent?: string;
    allowDocumentHashMismatch?: boolean;
  }) {
    const client = supabase();
    const signingClient = signingSchema(client);
    const documentHashInfo = generateDocumentHashInfo(params.documentContent);
    const consentTextHash = params.consentText?.trim()
      ? generateDocumentHash(params.consentText)
      : null;

    const { data: signRequestData, error: requestError } = await signingClient
      .from('sign_requests')
      .select(
        'id, status, expiration_date, document_hash, document_hash_algorithm, document_hash_encoding, document_canonicalization, document_byte_length'
      )
      .eq('id', params.requestId)
      .single();

    const signRequest = signRequestData as SignRequestRow | null;

    if (requestError || !signRequest) {
      throw new Error(`서명 요청 조회 실패: ${requestError?.message || '요청을 찾을 수 없습니다.'}`);
    }

    if (!SIGNABLE_STATUSES.includes(signRequest.status as (typeof SIGNABLE_STATUSES)[number])) {
      throw new Error(`서명 실행 불가: 현재 요청 상태가 서명 가능 상태가 아닙니다. (${signRequest.status})`);
    }

    if (isExpired(signRequest.expiration_date)) {
      await signingClient.from('sign_requests').update({ status: 'expired' }).eq('id', params.requestId);

      await this.logAudit({
        requestId: params.requestId,
        action: 'SIGN_REJECTED_EXPIRED',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { documentHash: documentHashInfo.hash },
      });

      throw new Error('서명 실행 불가: 서명 요청이 만료되었습니다.');
    }

    if (!signRequest.document_hash || !isValidSha256Hash(signRequest.document_hash)) {
      await this.logAudit({
        requestId: params.requestId,
        action: 'SIGN_REJECTED_MISSING_REQUEST_HASH',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          currentDocumentHash: documentHashInfo.hash,
          hashAlgorithm: documentHashInfo.algorithm,
        },
      });

      throw new Error('서명 실행 불가: 요청 생성 시점의 문서 해시가 없습니다.');
    }

    if (!safeCompareHashes(documentHashInfo.hash, signRequest.document_hash)) {
      await this.logAudit({
        requestId: params.requestId,
        action: params.allowDocumentHashMismatch ? 'SIGN_HASH_MISMATCH_ALLOWED' : 'SIGN_REJECTED_HASH_MISMATCH',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          expectedDocumentHash: signRequest.document_hash,
          currentDocumentHash: documentHashInfo.hash,
          hashAlgorithm: documentHashInfo.algorithm,
        },
      });

      if (!params.allowDocumentHashMismatch) {
        throw new Error('서명 실행 불가: 요청 시점의 문서 해시와 현재 문서 해시가 일치하지 않습니다.');
      }
    }

    if (signRequest.status === 'authenticated') {
      if (!consentTextHash) {
        await this.logAudit({
          requestId: params.requestId,
          action: 'SIGN_REJECTED_MISSING_CONSENT_TEXT',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: {
            documentHash: signRequest.document_hash,
          },
        });

        throw new Error('서명 실행 불가: authenticated 상태 서명에는 consentText가 필요합니다.');
      }

      const { data: verifiedAuthData, error: verifiedAuthError } = await signingClient
        .from('sign_authentications')
        .select('id, auth_status, document_hash, consent_text_hash')
        .eq('request_id', params.requestId)
        .eq('auth_status', 'verified')
        .eq('document_hash', signRequest.document_hash)
        .eq('consent_text_hash', consentTextHash)
        .order('verified_at', { ascending: false })
        .limit(1);

      const verifiedAuthentication = (verifiedAuthData?.[0] || null) as VerifiedAuthRow | null;

      if (verifiedAuthError) {
        throw new Error(`서명 실행 불가: 인증 검증 레코드 조회 실패 (${verifiedAuthError.message})`);
      }

      if (!verifiedAuthentication) {
        await this.logAudit({
          requestId: params.requestId,
          action: 'SIGN_REJECTED_MISSING_AUTH_VERIFICATION',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: {
            documentHash: signRequest.document_hash,
            consentTextHash,
          },
        });

        throw new Error('서명 실행 불가: authenticated 상태이지만 검증된 본인확인 레코드가 없습니다.');
      }
    }

    const { data: existingSignatureData, error: existingSignatureError } = await signingClient
      .from('signatures')
      .select('id')
      .eq('request_id', params.requestId)
      .maybeSingle();

    const existingSignature = existingSignatureData as { id: string } | null;

    if (existingSignatureError) {
      throw new Error(`기존 서명 조회 실패: ${existingSignatureError.message}`);
    }

    if (existingSignature) {
      throw new Error('서명 실행 불가: 이미 서명된 요청입니다.');
    }

    const signatureDocumentHashInfo = params.allowDocumentHashMismatch
      ? {
          hash: signRequest.document_hash,
          algorithm: signRequest.document_hash_algorithm || documentHashInfo.algorithm,
          encoding: signRequest.document_hash_encoding || documentHashInfo.encoding,
          canonicalization: signRequest.document_canonicalization || documentHashInfo.canonicalization,
          byteLength:
            typeof signRequest.document_byte_length === 'number'
              ? signRequest.document_byte_length
              : documentHashInfo.byteLength,
        }
      : documentHashInfo;

    const { data: signatureData, error: signError } = await signingClient
      .from('signatures')
      .insert([
        {
          request_id: params.requestId,
          document_hash: signatureDocumentHashInfo.hash,
          document_hash_algorithm: signatureDocumentHashInfo.algorithm,
          document_hash_encoding: signatureDocumentHashInfo.encoding,
          document_canonicalization: signatureDocumentHashInfo.canonicalization,
          document_byte_length: signatureDocumentHashInfo.byteLength,
          signature_image_path: params.signatureImagePath,
          signer_id: normalizeOptionalUuid(params.signerId),
        },
      ])
      .select()
      .single();

    const signature = signatureData as SignatureRow | null;

    if (signError || !signature) {
      throw new Error(`서명 데이터 저장 실패: ${signError?.message || '서명 결과를 확인할 수 없습니다.'}`);
    }

    const { error: updateError } = await signingClient
      .from('sign_requests')
      .update({ status: 'signed' })
      .eq('id', params.requestId)
      .in('status', [...SIGNABLE_STATUSES]);

    if (updateError) throw new Error(`서명 요청 상태 업데이트 실패: ${updateError.message}`);

    await this.logAudit({
      requestId: params.requestId,
      action: 'SIGN_EXECUTED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        signatureId: signature.id,
        documentHash: signatureDocumentHashInfo.hash,
        currentDocumentHash: documentHashInfo.hash,
        hashAlgorithm: signatureDocumentHashInfo.algorithm,
        hashEncoding: signatureDocumentHashInfo.encoding,
        canonicalization: signatureDocumentHashInfo.canonicalization,
        byteLength: signatureDocumentHashInfo.byteLength,
        consentTextHash,
      },
    });

    return { signature, documentHash: signatureDocumentHashInfo.hash, hashMetadata: signatureDocumentHashInfo };
  },

  async verifySignature(params: { requestId: string; currentDocumentContent: DocumentHashInput }) {
    const { data: signatureData, error } = await signingSchema()
      .from('signatures')
      .select('*')
      .eq('request_id', params.requestId)
      .single();

    const signature = signatureData as SignatureRow | null;

    if (error || !signature) return { isValid: false, message: '서명 데이터를 찾을 수 없습니다.' };

    if (!isValidSha256Hash(signature.document_hash)) {
      return {
        isValid: false,
        message: '저장된 문서 해시 형식이 올바르지 않습니다.',
        integrity: 'INVALID_STORED_HASH',
      };
    }

    const currentHashInfo = generateDocumentHashInfo(params.currentDocumentContent);
    const isValid = safeCompareHashes(currentHashInfo.hash, signature.document_hash);

    return {
      isValid,
      signerInfo: signature.signer_id,
      signedAt: signature.signed_at,
      integrity: isValid ? 'MATCH' : 'TAMPERED',
      storedHash: signature.document_hash,
      currentHash: currentHashInfo.hash,
      hashMetadata: {
        current: currentHashInfo,
        stored: {
          algorithm: signature.document_hash_algorithm || 'sha256',
          encoding: signature.document_hash_encoding || 'hex',
          canonicalization: signature.document_canonicalization || 'unknown',
          byteLength: signature.document_byte_length ?? null,
        },
      },
    };
  },

  async logAudit(params: {
    requestId: string;
    action: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: AuditMetadata;
  }) {
    await signingSchema().from('signature_audit_logs').insert([
      {
        request_id: params.requestId,
        action: params.action,
        ip_address: normalizeIpAddress(params.ipAddress),
        user_agent: params.userAgent || null,
        metadata: params.metadata,
      },
    ]);
  },
};
