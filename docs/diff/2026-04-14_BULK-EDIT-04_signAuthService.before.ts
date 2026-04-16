import { randomBytes, randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  type AuthProvider,
  type AuthProviderGroup,
  type AuthProviderProduct,
  getAuthProviderDefinition,
  getAuthProviderConfigState,
} from '../lib/authProviders';
import { hashAuthEvidence, protectIdentityValue } from '../lib/authEvidence';
import {
  type DocumentHashInput,
  generateDocumentHash,
  generateDocumentHashInfo,
  isValidSha256Hash,
  safeCompareHashes,
} from '../lib/crypto';

type AuditMetadata = Record<string, unknown>;

type AuthStatus = 'requested' | 'completed' | 'failed' | 'expired' | 'verified' | 'cancelled';

type SignRequestRow = {
  id: string;
  status: string;
  expiration_date: string | null;
  document_hash: string | null;
  document_hash_algorithm: string | null;
  document_hash_encoding: string | null;
  document_canonicalization: string | null;
  document_byte_length: number | null;
  signer_info?: Record<string, unknown> | null;
};

type SignAuthenticationRow = {
  id: string;
  request_id: string;
  provider_group: AuthProviderGroup;
  provider: AuthProvider;
  provider_product: AuthProviderProduct;
  receipt_id: string | null;
  transaction_id?: string | null;
  request_nonce_hash: string | null;
  document_hash: string;
  document_hash_algorithm: string;
  document_hash_encoding: string;
  document_canonicalization: string;
  document_byte_length: number;
  consent_text_hash: string | null;
  terms_version: string | null;
  ci_hash?: string | null;
  di_hash?: string | null;
  signer_name_enc?: string | null;
  birthdate_enc?: string | null;
  phone_enc?: string | null;
  signed_data_hash?: string | null;
  raw_response_hash?: string | null;
  auth_status: AuthStatus;
  requested_at: string;
  completed_at?: string | null;
  verified_at: string | null;
  expires_at: string | null;
  provider_metadata?: Record<string, unknown> | null;
};

const AUTH_REQUESTABLE_REQUEST_STATUSES = ['pending', 'authenticating', 'failed'] as const;
const AUTH_CANCELABLE_STATUSES: AuthStatus[] = ['requested', 'completed'];
const DEFAULT_AUTH_TTL_MINUTES = 10;
const HASH_CANONICALIZATIONS = ['raw-bytes', 'utf8-string', 'canonical-json'] as const;

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
// 본인확인과 전자서명 관련 테이블은 모두 signing 스키마에 소속됩니다.
// 이후 구현에서도 sign_authentications, sign_requests, signatures, signature_audit_logs는
// public이 아니라 signing 스키마 클라이언트로만 접근해야 합니다.
// SUPABASE_API_SCHEMA_REQUIRED
// Supabase Dashboard > Project Settings > API > Exposed schemas 에 signing 을 추가해야 합니다.
const signingSchema = (client = getSupabase()) => client.schema(SIGNING_DB_SCHEMA);

const normalizeIpAddress = (ipAddress?: string | null) => {
  const firstForwardedIp = (ipAddress || '').split(',')[0]?.trim();

  return firstForwardedIp || null;
};

const buildRequestToken = () => `${randomUUID()}-${randomBytes(8).toString('hex')}`;

const buildReceiptId = (provider: AuthProvider) => `${provider}-${randomUUID()}`;

const buildExpiresAt = (minutes = DEFAULT_AUTH_TTL_MINUTES) => {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};

const isExpired = (expirationDate?: string | null) => {
  if (!expirationDate) return false;

  return new Date(expirationDate).getTime() <= Date.now();
};

const mergeProviderMetadata = (
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
) => ({
  ...(current || {}),
  ...patch,
});

const getProviderPayloadKeys = (payload: unknown) =>
  payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>) : [];

const resolveAuthRecord = async (params: {
  client: ReturnType<typeof supabase>;
  requestId?: string;
  authenticationId?: string;
  receiptId?: string;
  providerGroup?: AuthProviderGroup;
  provider?: AuthProvider;
}) => {
  const client = params.client;
  let query = signingSchema(client).from('sign_authentications').select('*');

  if (params.authenticationId) {
    const { data, error } = await query.eq('id', params.authenticationId).single();

    return { authentication: data as SignAuthenticationRow | null, error };
  }

  if (params.receiptId) {
    query = query.eq('receipt_id', params.receiptId);

    if (params.providerGroup) {
      query = query.eq('provider_group', params.providerGroup);
    }

    if (params.provider) {
      query = query.eq('provider', params.provider);
    }
  } else if (params.requestId) {
    query = query.eq('request_id', params.requestId);
  } else {
    throw new Error('본인확인 레코드 조회 실패: requestId, authenticationId, receiptId 중 하나는 필요합니다.');
  }

  if (params.requestId) {
    query = query.eq('request_id', params.requestId);
  }

  const { data, error } = await query.order('requested_at', { ascending: false }).limit(1);

  return {
    authentication: (data?.[0] || null) as SignAuthenticationRow | null,
    error,
  };
};

const resolveSignRequest = async (client: ReturnType<typeof supabase>, requestId: string) => {
  const { data, error } = await signingSchema(client)
    .from('sign_requests')
    .select(
      'id, status, expiration_date, document_hash, document_hash_algorithm, document_hash_encoding, document_canonicalization, document_byte_length, signer_info'
    )
    .eq('id', requestId)
    .single();

  return { signRequest: data as SignRequestRow | null, error };
};

const assertAuthRequestUsable = (authentication: SignAuthenticationRow, signRequest: SignRequestRow) => {
  if (isExpired(authentication.expires_at)) {
    throw new Error('본인확인 처리 실패: 인증 요청이 만료되었습니다.');
  }

  if (isExpired(signRequest.expiration_date)) {
    throw new Error('본인확인 처리 실패: 서명 요청이 이미 만료되었습니다.');
  }

  if (authentication.auth_status === 'cancelled') {
    throw new Error('본인확인 처리 실패: 이미 취소된 인증입니다.');
  }

  if (authentication.auth_status === 'expired') {
    throw new Error('본인확인 처리 실패: 이미 만료된 인증입니다.');
  }
};

export const SignAuthService = {
  async requestAuthentication(params: {
    requestId: string;
    providerGroup: AuthProviderGroup;
    provider: AuthProvider;
    providerProduct?: AuthProviderProduct;
    documentContent: DocumentHashInput;
    consentText: string;
    termsVersion: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!params.consentText.trim()) {
      throw new Error('본인확인 요청 생성 실패: consentText가 필요합니다.');
    }

    if (!params.termsVersion.trim()) {
      throw new Error('본인확인 요청 생성 실패: termsVersion이 필요합니다.');
    }

    const client = supabase();
    const signingClient = signingSchema(client);
    const documentHashInfo = generateDocumentHashInfo(params.documentContent);
    const consentTextHash = generateDocumentHash(params.consentText);

    const { data: signRequestData, error: requestError } = await signingClient
      .from('sign_requests')
      .select(
        'id, status, expiration_date, document_hash, document_hash_algorithm, document_hash_encoding, document_canonicalization, document_byte_length'
      )
      .eq('id', params.requestId)
      .single();

    const signRequest = signRequestData as SignRequestRow | null;

    if (requestError || !signRequest) {
      throw new Error(`본인확인 요청 생성 실패: ${requestError?.message || '요청을 찾을 수 없습니다.'}`);
    }

    if (
      !AUTH_REQUESTABLE_REQUEST_STATUSES.includes(
        signRequest.status as (typeof AUTH_REQUESTABLE_REQUEST_STATUSES)[number]
      )
    ) {
      throw new Error(`본인확인 요청 생성 실패: 현재 요청 상태에서 인증을 시작할 수 없습니다. (${signRequest.status})`);
    }

    if (isExpired(signRequest.expiration_date)) {
      throw new Error('본인확인 요청 생성 실패: 서명 요청이 이미 만료되었습니다.');
    }

    if (!signRequest.document_hash || !isValidSha256Hash(signRequest.document_hash)) {
      throw new Error('본인확인 요청 생성 실패: 요청 생성 시점의 document_hash가 없습니다.');
    }

    if (
      signRequest.document_hash_algorithm !== documentHashInfo.algorithm ||
      signRequest.document_hash_encoding !== documentHashInfo.encoding ||
      !HASH_CANONICALIZATIONS.includes(
        (signRequest.document_canonicalization || '') as (typeof HASH_CANONICALIZATIONS)[number]
      ) ||
      signRequest.document_canonicalization !== documentHashInfo.canonicalization ||
      signRequest.document_byte_length !== documentHashInfo.byteLength
    ) {
      throw new Error('본인확인 요청 생성 실패: 요청 생성 시점의 문서 해시 메타데이터가 현재 문서와 일치하지 않습니다.');
    }

    if (!safeCompareHashes(documentHashInfo.hash, signRequest.document_hash)) {
      throw new Error('본인확인 요청 생성 실패: 요청 생성 시점의 문서 해시와 현재 문서 해시가 일치하지 않습니다.');
    }

    const providerConfig = getAuthProviderConfigState(params.providerGroup, params.provider);

    if (!providerConfig.definition) {
      throw new Error(
        `본인확인 요청 생성 실패: 지원하지 않는 provider입니다. (${params.providerGroup}/${params.provider})`
      );
    }

    const requestToken = buildRequestToken();
    const requestNonceHash = generateDocumentHash(requestToken);
    const receiptId = buildReceiptId(params.provider);
    const expiresAt = buildExpiresAt();

    const { data: authData, error: authError } = await signingClient
      .from('sign_authentications')
      .insert([
        {
          request_id: params.requestId,
          provider_group: params.providerGroup,
          provider: params.provider,
          provider_product: params.providerProduct || providerConfig.definition.defaultProduct,
          receipt_id: receiptId,
          request_nonce_hash: requestNonceHash,
          document_hash: documentHashInfo.hash,
          document_hash_algorithm: documentHashInfo.algorithm,
          document_hash_encoding: documentHashInfo.encoding,
          document_canonicalization: documentHashInfo.canonicalization,
          document_byte_length: documentHashInfo.byteLength,
          consent_text_hash: consentTextHash,
          terms_version: params.termsVersion,
          auth_status: 'requested',
          expires_at: expiresAt,
          provider_metadata: {
            configured: providerConfig.configured,
            missingEnv: providerConfig.missingEnv,
            adapterLabel: providerConfig.definition.label,
          },
        },
      ])
      .select()
      .single();

    const authentication = authData as SignAuthenticationRow | null;

    if (authError || !authentication) {
      throw new Error(`본인확인 요청 생성 실패: ${authError?.message || '인증 레코드를 확인할 수 없습니다.'}`);
    }

    const { error: updateError } = await signingClient
      .from('sign_requests')
      .update({ status: 'authenticating' })
      .eq('id', params.requestId)
      .in('status', ['pending', 'failed']);

    if (updateError) {
      throw new Error(`본인확인 요청 생성 실패: sign_requests 상태 업데이트 실패 (${updateError.message})`);
    }

    await this.logAudit({
      requestId: params.requestId,
      action: 'AUTH_REQUESTED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        authId: authentication.id,
        providerGroup: params.providerGroup,
        provider: params.provider,
        providerProduct: authentication.provider_product,
        receiptId,
        documentHash: documentHashInfo.hash,
        hashAlgorithm: documentHashInfo.algorithm,
        hashEncoding: documentHashInfo.encoding,
        canonicalization: documentHashInfo.canonicalization,
        byteLength: documentHashInfo.byteLength,
        consentTextHash,
        termsVersion: params.termsVersion,
        providerConfigured: providerConfig.configured,
        providerMissingEnv: providerConfig.missingEnv,
      },
    });

    return {
      authentication,
      dispatch: {
        requestToken,
        receiptId,
        providerConfigured: providerConfig.configured,
        missingEnv: providerConfig.missingEnv,
        adapterLabel: providerConfig.definition.label,
        verificationMethod: providerConfig.definition.verificationMethod,
        callbackTransport: providerConfig.definition.callbackTransport,
        nextAction:
          providerConfig.definition.verificationMethod === 'callback'
            ? '사용자 완료 후 AUTH_CALLBACK 또는 AUTH_VERIFY로 상태를 반영합니다.'
            : 'provider polling 후 AUTH_VERIFY로 검증을 완료합니다.',
      },
    };
  },

  async getAuthenticationStatus(params: { requestId: string; authenticationId?: string }) {
    const client = supabase();
    const query = signingSchema(client)
      .from('sign_authentications')
      .select('*')
      .eq('request_id', params.requestId)
      .order('requested_at', { ascending: false })
      .limit(1);

    const { data, error } = params.authenticationId
      ? await query.eq('id', params.authenticationId)
      : await query;

    if (error) {
      throw new Error(`본인확인 상태 조회 실패: ${error.message}`);
    }

    const authentication = (data?.[0] || null) as SignAuthenticationRow | null;

    if (!authentication) {
      return { authentication: null, message: '인증 레코드가 없습니다.' };
    }

    const providerConfig = getAuthProviderConfigState(
      authentication.provider_group,
      authentication.provider
    );

    return {
      authentication,
      providerConfigured: providerConfig.configured,
      providerMissingEnv: providerConfig.missingEnv,
    };
  },

  async cancelAuthentication(params: {
    requestId: string;
    authenticationId: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = supabase();
    const signingClient = signingSchema(client);

    const { data: authData, error: authError } = await signingClient
      .from('sign_authentications')
      .select('*')
      .eq('id', params.authenticationId)
      .eq('request_id', params.requestId)
      .single();

    const authentication = authData as SignAuthenticationRow | null;

    if (authError || !authentication) {
      throw new Error(`본인확인 취소 실패: ${authError?.message || '인증 레코드를 찾을 수 없습니다.'}`);
    }

    if (!AUTH_CANCELABLE_STATUSES.includes(authentication.auth_status)) {
      throw new Error(`본인확인 취소 실패: 현재 auth_status에서 취소할 수 없습니다. (${authentication.auth_status})`);
    }

    const { data: cancelledAuthData, error: cancelError } = await signingClient
      .from('sign_authentications')
      .update({ auth_status: 'cancelled' })
      .eq('id', authentication.id)
      .eq('request_id', params.requestId)
      .select()
      .single();

    const cancelledAuthentication = cancelledAuthData as SignAuthenticationRow | null;

    if (cancelError || !cancelledAuthentication) {
      throw new Error(`본인확인 취소 실패: ${cancelError?.message || '취소 결과를 확인할 수 없습니다.'}`);
    }

    const { error: requestUpdateError } = await signingClient
      .from('sign_requests')
      .update({ status: 'failed' })
      .eq('id', params.requestId)
      .eq('status', 'authenticating');

    if (requestUpdateError) {
      throw new Error(`본인확인 취소 실패: sign_requests 상태 업데이트 실패 (${requestUpdateError.message})`);
    }

    await this.logAudit({
      requestId: params.requestId,
      action: 'AUTH_CANCELLED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        authId: authentication.id,
        reason: params.reason || 'user_cancelled',
      },
    });

    return { authentication: cancelledAuthentication };
  },

  async verifyAuthentication(params: {
    requestId?: string;
    authenticationId?: string;
    receiptId?: string;
    providerGroup?: AuthProviderGroup;
    provider?: AuthProvider;
    documentContent?: DocumentHashInput;
    consentText?: string;
    signerName?: string;
    birthdate?: string;
    phone?: string;
    ci?: string;
    di?: string;
    transactionId?: string;
    signedData?: DocumentHashInput;
    rawResponse?: unknown;
    verificationPayload?: unknown;
    verificationSource?: 'manual' | 'callback' | 'polling';
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = supabase();
    const signingClient = signingSchema(client);
    const { authentication, error: authError } = await resolveAuthRecord({
      client,
      requestId: params.requestId,
      authenticationId: params.authenticationId,
      receiptId: params.receiptId,
      providerGroup: params.providerGroup,
      provider: params.provider,
    });

    if (authError || !authentication) {
      throw new Error(`본인확인 검증 실패: ${authError?.message || '인증 레코드를 찾을 수 없습니다.'}`);
    }

    const { signRequest, error: requestError } = await resolveSignRequest(client, authentication.request_id);

    if (requestError || !signRequest) {
      throw new Error(`본인확인 검증 실패: ${requestError?.message || '서명 요청을 찾을 수 없습니다.'}`);
    }

    assertAuthRequestUsable(authentication, signRequest);

    if (authentication.auth_status === 'verified') {
      return {
        authentication,
        requestStatus: signRequest.status,
        message: '이미 verified 상태의 인증입니다.',
      };
    }

    if (params.documentContent !== undefined) {
      const documentHashInfo = generateDocumentHashInfo(params.documentContent);

      if (
        !safeCompareHashes(documentHashInfo.hash, authentication.document_hash) ||
        documentHashInfo.algorithm !== authentication.document_hash_algorithm ||
        documentHashInfo.encoding !== authentication.document_hash_encoding ||
        documentHashInfo.canonicalization !== authentication.document_canonicalization ||
        documentHashInfo.byteLength !== authentication.document_byte_length
      ) {
        throw new Error('본인확인 검증 실패: 인증 요청 시점의 문서 해시 메타데이터와 현재 문서가 일치하지 않습니다.');
      }
    }

    if (params.consentText?.trim()) {
      const consentTextHash = generateDocumentHash(params.consentText);

      if (!safeCompareHashes(consentTextHash, authentication.consent_text_hash || '')) {
        throw new Error('본인확인 검증 실패: 인증 요청 시점의 동의 문구와 현재 동의 문구가 일치하지 않습니다.');
      }
    }

    const expectedSignerName =
      typeof signRequest.signer_info?.name === 'string' ? signRequest.signer_info.name.trim() : null;
    const providedSignerName = params.signerName?.trim() || null;

    if (expectedSignerName && providedSignerName && expectedSignerName !== providedSignerName) {
      const rejectedMetadata = mergeProviderMetadata(authentication.provider_metadata, {
        verificationRejectedAt: new Date().toISOString(),
        verificationRejectReason: 'signer_name_mismatch',
        providedSignerName,
        expectedSignerName,
      });

      const { error: rejectError } = await signingClient
        .from('sign_authentications')
        .update({
          auth_status: 'failed',
          provider_metadata: rejectedMetadata,
        })
        .eq('id', authentication.id);

      if (rejectError) {
        throw new Error(`본인확인 검증 실패: signer mismatch 처리 중 오류 (${rejectError.message})`);
      }

      await this.logAudit({
        requestId: authentication.request_id,
        action: 'AUTH_VERIFICATION_REJECTED',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          authId: authentication.id,
          reason: 'signer_name_mismatch',
          expectedSignerName,
          providedSignerName,
        },
      });

      throw new Error('본인확인 검증 실패: 인증 결과의 이름이 서명 요청자와 일치하지 않습니다.');
    }

    const ciHash = hashAuthEvidence('ci', params.ci);
    const diHash = hashAuthEvidence('di', params.di);
    const signedDataHash = hashAuthEvidence('signedData', params.signedData);
    const rawResponseHash = hashAuthEvidence(
      'rawResponse',
      params.rawResponse ?? params.verificationPayload ?? null
    );
    const signerNameProtected = protectIdentityValue('signerName', params.signerName);
    const birthdateProtected = protectIdentityValue('birthdate', params.birthdate);
    const phoneProtected = protectIdentityValue('phone', params.phone);
    const providerDefinition = getAuthProviderDefinition(
      authentication.provider_group,
      authentication.provider
    );

    const providerMetadata = mergeProviderMetadata(authentication.provider_metadata, {
      verificationSource: params.verificationSource || 'manual',
      verifiedAt: new Date().toISOString(),
      verificationMethod: providerDefinition?.verificationMethod || null,
      callbackTransport: providerDefinition?.callbackTransport || null,
      verificationPayloadKeys: getProviderPayloadKeys(params.verificationPayload),
      rawResponseHashPresent: !!rawResponseHash,
      signedDataHashPresent: !!signedDataHash,
      ciHashPresent: !!ciHash,
      diHashPresent: !!diHash,
      protectedIdentityStrategies: {
        signerName: signerNameProtected.strategy,
        birthdate: birthdateProtected.strategy,
        phone: phoneProtected.strategy,
      },
    });

    const { data: verifiedAuthData, error: verifyError } = await signingClient
      .from('sign_authentications')
      .update({
        auth_status: 'verified',
        transaction_id: params.transactionId || authentication.transaction_id || null,
        ci_hash: ciHash,
        di_hash: diHash,
        signer_name_enc: signerNameProtected.value,
        birthdate_enc: birthdateProtected.value,
        phone_enc: phoneProtected.value,
        signed_data_hash: signedDataHash,
        raw_response_hash: rawResponseHash,
        provider_metadata: providerMetadata,
      })
      .eq('id', authentication.id)
      .select()
      .single();

    const verifiedAuthentication = verifiedAuthData as SignAuthenticationRow | null;

    if (verifyError || !verifiedAuthentication) {
      throw new Error(`본인확인 검증 실패: ${verifyError?.message || '검증 결과를 저장할 수 없습니다.'}`);
    }

    const { error: requestUpdateError } = await signingClient
      .from('sign_requests')
      .update({ status: 'authenticated' })
      .eq('id', authentication.request_id)
      .in('status', ['pending', 'authenticating']);

    if (requestUpdateError) {
      throw new Error(`본인확인 검증 실패: sign_requests 상태 업데이트 실패 (${requestUpdateError.message})`);
    }

    await this.logAudit({
      requestId: authentication.request_id,
      action: 'AUTH_VERIFIED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        authId: authentication.id,
        providerGroup: authentication.provider_group,
        provider: authentication.provider,
        providerProduct: authentication.provider_product,
        receiptId: authentication.receipt_id,
        transactionId: params.transactionId || null,
        documentHash: authentication.document_hash,
        consentTextHash: authentication.consent_text_hash,
        signedDataHash,
        ciHashPresent: !!ciHash,
        diHashPresent: !!diHash,
      },
    });

    return {
      authentication: verifiedAuthentication,
      requestStatus: 'authenticated',
    };
  },

  async receiveCallback(params: {
    requestId?: string;
    authenticationId?: string;
    receiptId?: string;
    providerGroup?: AuthProviderGroup;
    provider?: AuthProvider;
    documentContent?: DocumentHashInput;
    consentText?: string;
    callbackPayload?: unknown;
    rawResponse?: unknown;
    transactionId?: string;
    signedData?: DocumentHashInput;
    autoVerify?: boolean;
    signerName?: string;
    birthdate?: string;
    phone?: string;
    ci?: string;
    di?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const client = supabase();
    const signingClient = signingSchema(client);
    const { authentication, error: authError } = await resolveAuthRecord({
      client,
      requestId: params.requestId,
      authenticationId: params.authenticationId,
      receiptId: params.receiptId,
      providerGroup: params.providerGroup,
      provider: params.provider,
    });

    if (authError || !authentication) {
      throw new Error(`본인확인 callback 처리 실패: ${authError?.message || '인증 레코드를 찾을 수 없습니다.'}`);
    }

    const { signRequest, error: requestError } = await resolveSignRequest(client, authentication.request_id);

    if (requestError || !signRequest) {
      throw new Error(`본인확인 callback 처리 실패: ${requestError?.message || '서명 요청을 찾을 수 없습니다.'}`);
    }

    assertAuthRequestUsable(authentication, signRequest);

    if (params.documentContent !== undefined) {
      const documentHashInfo = generateDocumentHashInfo(params.documentContent);

      if (!safeCompareHashes(documentHashInfo.hash, authentication.document_hash)) {
        throw new Error('본인확인 callback 처리 실패: callback 시점의 문서 해시가 인증 요청과 일치하지 않습니다.');
      }
    }

    if (params.consentText?.trim()) {
      const consentTextHash = generateDocumentHash(params.consentText);

      if (!safeCompareHashes(consentTextHash, authentication.consent_text_hash || '')) {
        throw new Error('본인확인 callback 처리 실패: callback 시점의 동의 문구가 인증 요청과 일치하지 않습니다.');
      }
    }

    const signedDataHash = hashAuthEvidence('signedData', params.signedData);
    const rawResponseHash = hashAuthEvidence(
      'rawResponse',
      params.rawResponse ?? params.callbackPayload ?? null
    );
    const providerMetadata = mergeProviderMetadata(authentication.provider_metadata, {
      callbackReceivedAt: new Date().toISOString(),
      callbackPayloadKeys: getProviderPayloadKeys(params.callbackPayload),
      rawResponseHashPresent: !!rawResponseHash,
      signedDataHashPresent: !!signedDataHash,
    });

    const nextStatus: AuthStatus =
      authentication.auth_status === 'verified' ? 'verified' : 'completed';

    const { data: callbackAuthData, error: callbackError } = await signingClient
      .from('sign_authentications')
      .update({
        auth_status: nextStatus,
        transaction_id: params.transactionId || authentication.transaction_id || null,
        signed_data_hash: signedDataHash || authentication.signed_data_hash || null,
        raw_response_hash: rawResponseHash || authentication.raw_response_hash || null,
        provider_metadata: providerMetadata,
      })
      .eq('id', authentication.id)
      .select()
      .single();

    const callbackAuthentication = callbackAuthData as SignAuthenticationRow | null;

    if (callbackError || !callbackAuthentication) {
      throw new Error(`본인확인 callback 처리 실패: ${callbackError?.message || 'callback 결과를 저장할 수 없습니다.'}`);
    }

    await this.logAudit({
      requestId: authentication.request_id,
      action: 'AUTH_CALLBACK_RECEIVED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        authId: authentication.id,
        providerGroup: authentication.provider_group,
        provider: authentication.provider,
        receiptId: authentication.receipt_id,
        transactionId: params.transactionId || null,
        signedDataHash,
      },
    });

    if (params.autoVerify) {
      const verified = await this.verifyAuthentication({
        requestId: authentication.request_id,
        authenticationId: authentication.id,
        documentContent: params.documentContent,
        consentText: params.consentText,
        signerName: params.signerName,
        birthdate: params.birthdate,
        phone: params.phone,
        ci: params.ci,
        di: params.di,
        transactionId: params.transactionId,
        signedData: params.signedData,
        rawResponse: params.rawResponse ?? params.callbackPayload,
        verificationPayload: params.callbackPayload,
        verificationSource: 'callback',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      return {
        callback: callbackAuthentication,
        verification: verified,
      };
    }

    return {
      authentication: callbackAuthentication,
      nextAction: 'AUTH_VERIFY',
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
