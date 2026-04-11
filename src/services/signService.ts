import { createClient } from '@supabase/supabase-js';
import {
  type DocumentHashInput,
  generateDocumentHash,
  generateDocumentHashInfo,
  isValidSha256Hash,
  safeCompareHashes,
} from '../lib/crypto';

type SignerInfo = {
  email: string;
  name: string;
};

type AuditMetadata = Record<string, unknown>;

type SignRequestRow = {
  id: string;
  status: string;
  expiration_date: string | null;
  document_hash: string | null;
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

// SIGNING_SCHEMA_BOUNDARY
// 전자서명 도메인 테이블은 public이 아니라 signing 스키마만 사용합니다.
// 이후 LLM 구현도 sign_requests/signatures/signature_audit_logs/sign_authentications를
// 직접 public으로 접근하지 말고 항상 signing 스키마 클라이언트를 통해 접근해야 합니다.
// SUPABASE_API_SCHEMA_REQUIRED
// Supabase Dashboard > Project Settings > API > Exposed schemas 에 signing 을 추가해야 합니다.
const signingSchema = (client = getSupabase()) => client.schema(SIGNING_DB_SCHEMA);

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

export const SignService = {
  async createRequest(params: {
    documentId: string;
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
    const signingClient = signingSchema();

    const { data: request, error: requestError } = await signingClient
      .from('sign_requests')
      .insert([
        {
          document_id: params.documentId,
          document_hash: documentHashInfo.hash,
          document_hash_algorithm: documentHashInfo.algorithm,
          document_hash_encoding: documentHashInfo.encoding,
          document_canonicalization: documentHashInfo.canonicalization,
          document_byte_length: documentHashInfo.byteLength,
          signer_info: params.signerInfo,
          expiration_date: params.expirationDate?.toISOString(),
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (requestError) throw new Error(`서명 요청 생성 실패: ${requestError.message}`);

    await this.logAudit({
      requestId: request.id,
      action: 'REQUEST_CREATED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        documentHash: documentHashInfo.hash,
        hashAlgorithm: documentHashInfo.algorithm,
        hashEncoding: documentHashInfo.encoding,
        canonicalization: documentHashInfo.canonicalization,
        byteLength: documentHashInfo.byteLength,
      },
    });

    return request;
  },

  async executeSignature(params: {
    requestId: string;
    documentContent: DocumentHashInput;
    signatureImagePath: string;
    consentText?: string;
    signerId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = supabase();
    const signingClient = signingSchema(client);
    const documentHashInfo = generateDocumentHashInfo(params.documentContent);
    const consentTextHash = params.consentText?.trim()
      ? generateDocumentHash(params.consentText)
      : null;

    const { data: signRequestData, error: requestError } = await signingClient
      .from('sign_requests')
      .select('id, status, expiration_date, document_hash')
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
        action: 'SIGN_REJECTED_HASH_MISMATCH',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          expectedDocumentHash: signRequest.document_hash,
          currentDocumentHash: documentHashInfo.hash,
          hashAlgorithm: documentHashInfo.algorithm,
        },
      });

      throw new Error('서명 실행 불가: 요청 시점의 문서 해시와 현재 문서 해시가 일치하지 않습니다.');
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

    const { data: signatureData, error: signError } = await signingClient
      .from('signatures')
      .insert([
        {
          request_id: params.requestId,
          document_hash: documentHashInfo.hash,
          document_hash_algorithm: documentHashInfo.algorithm,
          document_hash_encoding: documentHashInfo.encoding,
          document_canonicalization: documentHashInfo.canonicalization,
          document_byte_length: documentHashInfo.byteLength,
          signature_image_path: params.signatureImagePath,
          signer_id: params.signerId,
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
        documentHash: documentHashInfo.hash,
        hashAlgorithm: documentHashInfo.algorithm,
        hashEncoding: documentHashInfo.encoding,
        canonicalization: documentHashInfo.canonicalization,
        byteLength: documentHashInfo.byteLength,
        consentTextHash,
      },
    });

    return { signature, documentHash: documentHashInfo.hash, hashMetadata: documentHashInfo };
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
