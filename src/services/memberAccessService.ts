import { createHash, randomInt } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type {
  MemberAccessSessionDto,
  MemberAccessibleDocumentDto,
  MemberAccessibleSiteDto,
  MemberDocumentAccessDto,
  MemberDocumentAccessSource,
  MemberDocumentEffectiveAccessRole,
  DocumentMemberAccessRole,
  DocumentMemberInviteInput,
  DocumentMemberInviteResult,
  DocumentMemberRecordDto,
  MemberDispatchResultDto,
  MemberInviteStatus,
  MemberRecordDto,
  MemberVerificationInput,
  MemberVerificationResult,
  MemberVerificationStatus,
  SiteMemberAccessRole,
  SiteMemberInviteInput,
  SiteMemberInviteResult,
  SiteMemberRecordDto,
} from '../lib/memberAccessDtos';
import { DocumentService } from './documentService';
import { SolapiSmsService } from './solapiSmsService';

type MemberRegistryRow = {
  id: string;
  phone_number: string;
  display_name: string | null;
  verification_status: MemberVerificationStatus;
  active_access_code_hash: string;
  active_access_code_last_sent_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type MemberInviteRow = {
  id: string;
  member_id: string;
  invite_status: MemberInviteStatus;
  invited_by_member_id: string | null;
  invite_note: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type SiteMembershipRow = {
  id: string;
  member_id: string;
  site_id: string;
  access_role: SiteMemberAccessRole;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentMembershipRow = {
  id: string;
  member_id: string;
  document_id: string;
  access_role: DocumentMemberAccessRole;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

type SiteRegistryRow = {
  id: string;
  site_name: string;
};

type DocumentRegistryRow = {
  id: string;
  title: string;
};

type DocumentAccessRegistryRow = {
  id: string;
  site_id: string;
  title: string;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  current_version_number: number | null;
  updated_at: string;
  deleted_at: string | null;
};

type MemberAccessDispatchMode = 'send_code' | 'reuse_existing_verified' | 'reuse_existing_pending';

type MemberAccessSiteMemberRpcRecord = {
  membership: SiteMembershipRow;
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
};

type MemberAccessDocumentMemberRpcRecord = {
  membership: DocumentMembershipRow;
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
};

type MemberAccessInviteRpcResult<TMembership> = {
  membership: TMembership;
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
  dispatchMode: MemberAccessDispatchMode;
};

type MemberAccessSessionRpcResult = {
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
  siteMemberships: SiteMembershipRow[];
  documentMemberships: DocumentMembershipRow[];
};

type MemberAccessVerificationRpcResult = {
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
  authenticatedAt: string;
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

// MEMBER_ACCESS_SCHEMA_BOUNDARY
// 번호 기반 멤버/초대/권한은 DB의 member_access 스키마만 정본으로 사용합니다.
// 앱에서는 public SECURITY DEFINER RPC를 호출해 member_access 스키마를 Data API에 직접 노출하지 않습니다.
// 현장/문서 권한은 sites.site_registry, documents.document_registry 를 참조하지만
// 멤버 정보 자체는 member_access.member_registry 와 memberships 가 기준입니다.
const sitesSchema = (client = getSupabase()) => client.schema(SITES_DB_SCHEMA);
const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);

const normalizePhoneNumber = (value: string) => value.replace(/[^0-9]/g, '').trim();

const normalizeAccessCode = (value: string) => value.replace(/[^0-9]/g, '').trim();

const normalizeSiteMemberAccessRole = (role: SiteMemberAccessRole): SiteMemberAccessRole => {
  if (role === 'owner' || role === 'manager') {
    return role;
  }

  return 'participant';
};

const normalizeDocumentMemberAccessRole = (role: DocumentMemberAccessRole): DocumentMemberAccessRole =>
  role === 'editor' ? 'editor' : 'viewer';

const isLegacySiteRoleConstraintError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');

  return message.includes('권한 값이 올바르지 않습니다') || message.includes('site_memberships_access_role_check');
};

const hashAccessCode = (value: string) => createHash('sha256').update(value).digest('hex');

const generateAccessCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

const buildInviteSmsMessage = (scopeLabel: string, accessCode: string) =>
  `[BARO] ${scopeLabel} 접근 초대 인증번호는 ${accessCode} 입니다. 이 번호는 초대가 철회되기 전까지 계속 사용할 수 있습니다.`;

const getDefaultSenderPhoneNumber = () =>
  process.env.MEMBER_INVITE_SMS_DEFAULT_SENDER?.trim() || process.env.REQUEST_LINK_SMS_DEFAULT_SENDER?.trim() || '';

const buildExistingAccessDispatch = (mode: MemberAccessDispatchMode): MemberDispatchResultDto => {
  if (mode === 'reuse_existing_verified') {
    return {
      status: 'not_required',
      message: '이미 인증된 번호입니다. 새 인증 없이 권한만 추가했습니다.',
      providerConfigured: true,
      sentAt: null,
      accessCodePreview: null,
      providerMessageId: null,
      providerGroupId: null,
    };
  }

  return {
    status: 'failed',
    message:
      '이미 초대된 미인증 번호가 기존 초대를 재사용해 새 인증번호를 만들지 못했습니다. Supabase member_access SQL 함수를 최신 버전으로 반영한 뒤 다시 초대하세요.',
    providerConfigured: true,
    sentAt: null,
    accessCodePreview: null,
    providerMessageId: null,
    providerGroupId: null,
  };
};

const toMemberRecordDto = (params: {
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
}): MemberRecordDto => ({
  id: params.member.id,
  phoneNumber: params.member.phone_number,
  displayName: params.member.display_name,
  verificationStatus: params.member.verification_status,
  inviteStatus: params.invite?.invite_status || 'active',
  activeAccessCodeLastSentAt: params.member.active_access_code_last_sent_at,
  lastVerifiedAt: params.member.last_verified_at,
  createdAt: params.member.created_at,
  updatedAt: params.member.updated_at,
});

const toSiteMemberRecordDto = (params: {
  membership: SiteMembershipRow;
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
}): SiteMemberRecordDto => ({
  membershipId: params.membership.id,
  siteId: params.membership.site_id,
  accessRole: normalizeSiteMemberAccessRole(params.membership.access_role),
  member: toMemberRecordDto({ member: params.member, invite: params.invite }),
  createdAt: params.membership.created_at,
  updatedAt: params.membership.updated_at,
});

const toDocumentMemberRecordDto = (params: {
  membership: DocumentMembershipRow;
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
}): DocumentMemberRecordDto => ({
  membershipId: params.membership.id,
  documentId: params.membership.document_id,
  accessRole: normalizeDocumentMemberAccessRole(params.membership.access_role),
  member: toMemberRecordDto({ member: params.member, invite: params.invite }),
  createdAt: params.membership.created_at,
  updatedAt: params.membership.updated_at,
});

const getDocumentRoleRank = (role: MemberDocumentEffectiveAccessRole) => {
  switch (role) {
    case 'editor':
      return 3;
    case 'signer':
      return 2;
    case 'viewer':
    default:
      return 1;
  }
};

const toEffectiveDocumentRoleFromSiteRole = (role: SiteMemberAccessRole): MemberDocumentEffectiveAccessRole =>
  role === 'owner' || role === 'manager' || role === 'editor' ? 'editor' : 'viewer';

const mergeDocumentAccessRole = (
  currentRole: MemberDocumentEffectiveAccessRole,
  nextRole: MemberDocumentEffectiveAccessRole
): MemberDocumentEffectiveAccessRole =>
  getDocumentRoleRank(nextRole) > getDocumentRoleRank(currentRole) ? nextRole : currentRole;

const mergeDocumentAccessSource = (
  currentSource: MemberDocumentAccessSource,
  nextSource: MemberDocumentAccessSource
): MemberDocumentAccessSource => (currentSource === nextSource ? currentSource : 'site+document');

const validatePhoneNumber = (phoneNumber: string) => {
  if (!phoneNumber || phoneNumber.length < 8 || phoneNumber.length > 15) {
    throw new Error('구성원 초대 실패: 휴대폰 번호 형식이 올바르지 않습니다.');
  }
};

const getUnknownErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' && error.trim() ? error.trim() : '알 수 없는 오류';

const callMemberAccessRpc = async <T>(
  client: ReturnType<typeof getSupabase>,
  functionName: string,
  args: Record<string, unknown>,
  errorPrefix: string
): Promise<T> => {
  const { data, error } = await client.rpc(functionName, args);

  if (error) {
    throw new Error(`${errorPrefix}: ${error.message}`);
  }

  return data as T;
};

const ensureSiteExists = async (client: ReturnType<typeof getSupabase>, siteId: string) => {
  const { data, error } = await sitesSchema(client).from('site_registry').select('id, site_name').eq('id', siteId).single();

  if (error || !data) {
    throw new Error(`구성원 초대 실패: 현장을 찾을 수 없습니다. (${error?.message || siteId})`);
  }

  return data as SiteRegistryRow;
};

const ensureDocumentExists = async (client: ReturnType<typeof getSupabase>, documentId: string) => {
  const { data, error } = await documentsSchema(client)
    .from('document_registry')
    .select('id, title')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    throw new Error(`구성원 초대 실패: 현장 문서를 찾을 수 없습니다. (${error?.message || documentId})`);
  }

  return data as DocumentRegistryRow;
};

const dispatchInviteSms = async (params: {
  phoneNumber: string;
  accessCode: string;
  scopeLabel: string;
}): Promise<MemberDispatchResultDto> => {
  const senderPhoneNumber = getDefaultSenderPhoneNumber();

  if (!senderPhoneNumber) {
    return {
      status: 'provider_not_configured',
      message: '기본 발신번호가 설정되지 않아 문자 대신 인증번호를 수동 전달해야 합니다.',
      providerConfigured: false,
      sentAt: null,
      accessCodePreview: params.accessCode,
      providerMessageId: null,
      providerGroupId: null,
    };
  }

  const sendResult = await SolapiSmsService.sendSms({
    from: senderPhoneNumber,
    to: params.phoneNumber,
    text: buildInviteSmsMessage(params.scopeLabel, params.accessCode),
  }).catch((error: unknown) => ({
    ok: false as const,
    status: 'failed' as const,
    failureReason: `인증번호 문자 발송 중 오류가 발생했습니다. (${getUnknownErrorMessage(error)})`,
    providerPayloadSummary: {},
  }));

  if (sendResult.ok) {
    return {
      status: 'sent',
      message: '인증번호를 문자로 발송했습니다.',
      providerConfigured: true,
      sentAt: new Date().toISOString(),
      accessCodePreview: null,
      providerMessageId: sendResult.providerMessageId,
      providerGroupId: sendResult.providerGroupId,
    };
  }

  return {
    status: sendResult.status === 'provider_not_configured' ? 'provider_not_configured' : 'failed',
    message: sendResult.failureReason || '인증번호 문자 발송에 실패했습니다.',
    providerConfigured: sendResult.status !== 'provider_not_configured',
    sentAt: null,
    accessCodePreview: params.accessCode,
    providerMessageId: null,
    providerGroupId: null,
  };
};

const buildDispatchEventPayload = (params: {
  scopeType: 'site' | 'document';
  scopeId: string;
  dispatchMode: MemberAccessDispatchMode;
  dispatch: MemberDispatchResultDto;
}) => ({
  scopeType: params.scopeType,
  scopeId: params.scopeId,
  dispatchMode: params.dispatchMode,
  dispatchStatus: params.dispatch.status,
  dispatchMessage: params.dispatch.message,
  providerConfigured: params.dispatch.providerConfigured,
  sentAt: params.dispatch.sentAt,
  providerMessageId: params.dispatch.providerMessageId,
  providerGroupId: params.dispatch.providerGroupId,
  accessCodePreviewProvided: Boolean(params.dispatch.accessCodePreview),
});

const recordVerificationEvent = async (params: {
  client: ReturnType<typeof getSupabase>;
  memberId: string;
  phoneNumber: string;
  verificationStatus: 'sent' | 'verified' | 'failed';
  requestPayload?: Record<string, unknown>;
  verifiedAt?: string | null;
}) => {
  await callMemberAccessRpc<unknown>(
    params.client,
    'member_access_record_verification_event',
    {
      p_member_id: params.memberId,
      p_phone_number: params.phoneNumber,
      p_verification_status: params.verificationStatus,
      p_request_payload: params.requestPayload || {},
      p_verified_at: params.verifiedAt || null,
    },
    '구성원 인증 이력 저장 실패'
  );
};

const loadSiteRowsByIds = async (client: ReturnType<typeof getSupabase>, siteIds: string[]) => {
  if (siteIds.length === 0) {
    return [] as SiteRegistryRow[];
  }

  const { data, error } = await sitesSchema(client).from('site_registry').select('id, site_name').in('id', siteIds);

  if (error) {
    throw new Error(`구성원 접근 조회 실패: 현장 조회 중 오류가 발생했습니다. (${error.message})`);
  }

  return (data || []) as SiteRegistryRow[];
};

const loadDocumentAccessRowsBySiteIds = async (client: ReturnType<typeof getSupabase>, siteIds: string[]) => {
  if (siteIds.length === 0) {
    return [] as DocumentAccessRegistryRow[];
  }

  const { data, error } = await documentsSchema(client)
    .from('document_registry')
    .select('id, site_id, title, status, current_version_number, updated_at, deleted_at')
    .in('site_id', siteIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`구성원 접근 조회 실패: 현장 문서 조회 중 오류가 발생했습니다. (${error.message})`);
  }

  return (data || []) as DocumentAccessRegistryRow[];
};

const loadDocumentAccessRowsByIds = async (client: ReturnType<typeof getSupabase>, documentIds: string[]) => {
  if (documentIds.length === 0) {
    return [] as DocumentAccessRegistryRow[];
  }

  const { data, error } = await documentsSchema(client)
    .from('document_registry')
    .select('id, site_id, title, status, current_version_number, updated_at, deleted_at')
    .in('id', documentIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`구성원 접근 조회 실패: 직접 권한 문서 조회 중 오류가 발생했습니다. (${error.message})`);
  }

  return (data || []) as DocumentAccessRegistryRow[];
};

const buildMemberAccessibleDocuments = (params: {
  siteMemberships: SiteMembershipRow[];
  documentMemberships: DocumentMembershipRow[];
  siteRows: SiteRegistryRow[];
  siteDocuments: DocumentAccessRegistryRow[];
  directDocuments: DocumentAccessRegistryRow[];
}) => {
  const siteNameById = new Map(params.siteRows.map((site) => [site.id, site.site_name] as const));
  const siteRoleBySiteId = new Map(params.siteMemberships.map((membership) => [membership.site_id, membership.access_role] as const));
  const documentRoleByDocumentId = new Map(
    params.documentMemberships.map(
      (membership) => [membership.document_id, normalizeDocumentMemberAccessRole(membership.access_role)] as const
    )
  );
  const documentMap = new Map<string, MemberAccessibleDocumentDto>();

  const upsertDocument = (document: DocumentAccessRegistryRow, accessRole: MemberDocumentEffectiveAccessRole, accessSource: MemberDocumentAccessSource) => {
    const existing = documentMap.get(document.id);
    const siteName = siteNameById.get(document.site_id) || '현장';

    if (!existing) {
      documentMap.set(document.id, {
        documentId: document.id,
        siteId: document.site_id,
        siteName,
        title: document.title,
        status: document.status,
        currentVersionNumber: document.current_version_number,
        updatedAt: document.updated_at,
        accessRole,
        accessSource,
      });
      return;
    }

    documentMap.set(document.id, {
      ...existing,
      accessRole: mergeDocumentAccessRole(existing.accessRole, accessRole),
      accessSource: mergeDocumentAccessSource(existing.accessSource, accessSource),
    });
  };

  for (const document of params.siteDocuments) {
    const siteRole = siteRoleBySiteId.get(document.site_id);
    const managedSiteRole = siteRole ? normalizeSiteMemberAccessRole(siteRole) : null;

    if (!managedSiteRole || managedSiteRole === 'participant') {
      continue;
    }

    upsertDocument(document, toEffectiveDocumentRoleFromSiteRole(managedSiteRole), 'site');
  }

  for (const document of params.directDocuments) {
    const documentRole = documentRoleByDocumentId.get(document.id);

    if (!documentRole) {
      continue;
    }

    upsertDocument(document, documentRole, 'document');
  }

  return Array.from(documentMap.values()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title, 'ko')
  );
};

const buildMemberAccessibleSites = (params: {
  siteMemberships: SiteMembershipRow[];
  siteRows: SiteRegistryRow[];
  accessibleDocuments: MemberAccessibleDocumentDto[];
}) => {
  const documentCountBySiteId = params.accessibleDocuments.reduce<Record<string, number>>((accumulator, document) => {
    accumulator[document.siteId] = (accumulator[document.siteId] || 0) + 1;
    return accumulator;
  }, {});
  const siteNameById = new Map(params.siteRows.map((site) => [site.id, site.site_name] as const));

  return params.siteMemberships
    .map<MemberAccessibleSiteDto>((membership) => ({
      siteId: membership.site_id,
      siteName: siteNameById.get(membership.site_id) || '현장',
      accessRole: normalizeSiteMemberAccessRole(membership.access_role),
      documentCount: documentCountBySiteId[membership.site_id] || 0,
    }))
    .sort((left, right) => left.siteName.localeCompare(right.siteName, 'ko'));
};

const getMemberAccessSessionRemotely = async (
  client: ReturnType<typeof getSupabase>,
  memberId: string,
  authenticatedAt?: string | null
): Promise<MemberAccessSessionDto> => {
  const session = await callMemberAccessRpc<MemberAccessSessionRpcResult>(
    client,
    'member_access_get_session',
    { p_member_id: memberId },
    '구성원 접근 조회 실패'
  );
  const member = session.member;
  const invite = session.invite;
  const siteMemberships = Array.isArray(session.siteMemberships) ? session.siteMemberships : [];
  const documentMemberships = Array.isArray(session.documentMemberships) ? session.documentMemberships : [];
  const siteIds = Array.from(new Set(siteMemberships.map((membership) => membership.site_id)));
  const documentIds = Array.from(new Set(documentMemberships.map((membership) => membership.document_id)));
  const [siteRows, siteDocuments, directDocuments] = await Promise.all([
    loadSiteRowsByIds(client, siteIds),
    loadDocumentAccessRowsBySiteIds(client, siteIds),
    loadDocumentAccessRowsByIds(client, documentIds),
  ]);
  const accessibleDocuments = buildMemberAccessibleDocuments({
    siteMemberships,
    documentMemberships,
    siteRows,
    siteDocuments,
    directDocuments,
  });

  return {
    member: toMemberRecordDto({ member, invite }),
    authenticatedAt: authenticatedAt || member.last_verified_at || member.updated_at,
    accessibleSites: buildMemberAccessibleSites({
      siteMemberships,
      siteRows,
      accessibleDocuments,
    }),
    accessibleDocuments,
  };
};

export const MemberAccessService = {
  async listSiteMembers(siteId: string): Promise<SiteMemberRecordDto[]> {
    const normalizedSiteId = siteId.trim();

    if (!normalizedSiteId) {
      throw new Error('구성원 목록 조회 실패: siteId가 필요합니다.');
    }

    const client = getSupabase();
    const records = await callMemberAccessRpc<MemberAccessSiteMemberRpcRecord[]>(
      client,
      'member_access_list_site_members',
      { p_site_id: normalizedSiteId },
      '구성원 목록 조회 실패'
    );

    return (Array.isArray(records) ? records : []).map((record) =>
      toSiteMemberRecordDto({
        membership: record.membership,
        member: record.member,
        invite: record.invite,
      })
    );
  },

  async inviteSiteMember(input: SiteMemberInviteInput): Promise<SiteMemberInviteResult> {
    const normalizedSiteId = input.siteId.trim();
    const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
    const normalizedAccessRole = normalizeSiteMemberAccessRole(input.accessRole);
    validatePhoneNumber(normalizedPhoneNumber);
    const client = getSupabase();
    const site = await ensureSiteExists(client, normalizedSiteId);
    const accessCode = generateAccessCode();
    const inviteWithRole = (accessRole: SiteMemberAccessRole) =>
      callMemberAccessRpc<MemberAccessInviteRpcResult<SiteMembershipRow>>(
        client,
        'member_access_invite_site_member',
        {
          p_site_id: normalizedSiteId,
          p_phone_number: normalizedPhoneNumber,
          p_display_name: input.displayName?.trim() || null,
          p_access_role: accessRole,
          p_access_code_hash: hashAccessCode(accessCode),
          p_invited_by_member_id: input.invitedByMemberId?.trim() || null,
        },
        '구성원 초대 실패'
      );
    const inviteContext = await inviteWithRole(normalizedAccessRole).catch((error) => {
      if (normalizedAccessRole === 'participant' && isLegacySiteRoleConstraintError(error)) {
        return inviteWithRole('editor');
      }

      throw error;
    });

    const dispatch =
      inviteContext.dispatchMode === 'send_code'
        ? await dispatchInviteSms({
            phoneNumber: normalizedPhoneNumber,
            accessCode,
            scopeLabel: `${site.site_name} 현장`,
          })
        : buildExistingAccessDispatch(inviteContext.dispatchMode);

    if (inviteContext.dispatchMode === 'send_code' || inviteContext.dispatchMode === 'reuse_existing_pending') {
      await recordVerificationEvent({
        client,
        memberId: inviteContext.member.id,
        phoneNumber: normalizedPhoneNumber,
        verificationStatus: dispatch.status === 'sent' ? 'sent' : 'failed',
        requestPayload: buildDispatchEventPayload({
          scopeType: 'site',
          scopeId: normalizedSiteId,
          dispatchMode: inviteContext.dispatchMode,
          dispatch,
        }),
      });
    }

    return {
      membership: toSiteMemberRecordDto({
        membership: inviteContext.membership,
        member: inviteContext.member,
        invite: inviteContext.invite,
      }),
      dispatch,
    };
  },

  async removeSiteMembership(membershipId: string): Promise<SiteMemberRecordDto> {
    const normalizedMembershipId = membershipId.trim();

    if (!normalizedMembershipId) {
      throw new Error('현장 권한 삭제 실패: membershipId가 필요합니다.');
    }

    const client = getSupabase();
    const deleted = await callMemberAccessRpc<MemberAccessSiteMemberRpcRecord>(
      client,
      'member_access_remove_site_membership',
      { p_membership_id: normalizedMembershipId },
      '현장 권한 삭제 실패'
    );

    return toSiteMemberRecordDto({
      membership: deleted.membership,
      member: deleted.member,
      invite: deleted.invite,
    });
  },

  async listDocumentMembers(documentId: string): Promise<DocumentMemberRecordDto[]> {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      throw new Error('문서 권한 목록 조회 실패: documentId가 필요합니다.');
    }

    const client = getSupabase();
    const records = await callMemberAccessRpc<MemberAccessDocumentMemberRpcRecord[]>(
      client,
      'member_access_list_document_members',
      { p_document_id: normalizedDocumentId },
      '문서 권한 목록 조회 실패'
    );

    return (Array.isArray(records) ? records : []).map((record) =>
      toDocumentMemberRecordDto({
        membership: record.membership,
        member: record.member,
        invite: record.invite,
      })
    );
  },

  async inviteDocumentMember(input: DocumentMemberInviteInput): Promise<DocumentMemberInviteResult> {
    const normalizedDocumentId = input.documentId.trim();
    const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
    const normalizedAccessRole = normalizeDocumentMemberAccessRole(input.accessRole);
    validatePhoneNumber(normalizedPhoneNumber);
    const client = getSupabase();
    const document = await ensureDocumentExists(client, normalizedDocumentId);
    const accessCode = generateAccessCode();
    const inviteContext = await callMemberAccessRpc<MemberAccessInviteRpcResult<DocumentMembershipRow>>(
      client,
      'member_access_invite_document_member',
      {
        p_document_id: normalizedDocumentId,
        p_phone_number: normalizedPhoneNumber,
        p_display_name: input.displayName?.trim() || null,
        p_access_role: normalizedAccessRole,
        p_access_code_hash: hashAccessCode(accessCode),
        p_invited_by_member_id: input.invitedByMemberId?.trim() || null,
      },
      '구성원 초대 실패'
    );

    const dispatch =
      inviteContext.dispatchMode === 'send_code'
        ? await dispatchInviteSms({
            phoneNumber: normalizedPhoneNumber,
            accessCode,
            scopeLabel: `${document.title} 문서`,
          })
        : buildExistingAccessDispatch(inviteContext.dispatchMode);

    if (inviteContext.dispatchMode === 'send_code' || inviteContext.dispatchMode === 'reuse_existing_pending') {
      await recordVerificationEvent({
        client,
        memberId: inviteContext.member.id,
        phoneNumber: normalizedPhoneNumber,
        verificationStatus: dispatch.status === 'sent' ? 'sent' : 'failed',
        requestPayload: buildDispatchEventPayload({
          scopeType: 'document',
          scopeId: normalizedDocumentId,
          dispatchMode: inviteContext.dispatchMode,
          dispatch,
        }),
      });
    }

    return {
      membership: toDocumentMemberRecordDto({
        membership: inviteContext.membership,
        member: inviteContext.member,
        invite: inviteContext.invite,
      }),
      dispatch,
    };
  },

  async removeDocumentMembership(membershipId: string): Promise<DocumentMemberRecordDto> {
    const normalizedMembershipId = membershipId.trim();

    if (!normalizedMembershipId) {
      throw new Error('문서 권한 삭제 실패: membershipId가 필요합니다.');
    }

    const client = getSupabase();
    const deleted = await callMemberAccessRpc<MemberAccessDocumentMemberRpcRecord>(
      client,
      'member_access_remove_document_membership',
      { p_membership_id: normalizedMembershipId },
      '문서 권한 삭제 실패'
    );

    return toDocumentMemberRecordDto({
      membership: deleted.membership,
      member: deleted.member,
      invite: deleted.invite,
    });
  },

  async getMemberAccessSession(memberId: string, authenticatedAt?: string | null): Promise<MemberAccessSessionDto> {
    const normalizedMemberId = memberId.trim();

    if (!normalizedMemberId) {
      throw new Error('구성원 접근 조회 실패: memberId가 필요합니다.');
    }

    const client = getSupabase();
    return getMemberAccessSessionRemotely(client, normalizedMemberId, authenticatedAt);
  },

  async getMemberDocumentAccess(
    memberId: string,
    documentId: string,
    authenticatedAt?: string | null
  ): Promise<MemberDocumentAccessDto> {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      throw new Error('문서 접근 조회 실패: documentId가 필요합니다.');
    }

    const session = await this.getMemberAccessSession(memberId, authenticatedAt);
    const accessibleDocument = session.accessibleDocuments.find((item) => item.documentId === normalizedDocumentId) || null;

    if (!accessibleDocument) {
      throw new Error('문서 접근 권한이 없습니다.');
    }

    const detail = await DocumentService.getDocumentDetail(normalizedDocumentId);

    return {
      member: session.member,
      authenticatedAt: session.authenticatedAt,
      accessRole: accessibleDocument.accessRole,
      accessSource: accessibleDocument.accessSource,
      detail,
    };
  },

  async verifyMemberAccess(input: MemberVerificationInput): Promise<MemberVerificationResult> {
    const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
    const normalizedAccessCode = normalizeAccessCode(input.accessCode);
    validatePhoneNumber(normalizedPhoneNumber);

    if (normalizedAccessCode.length !== 6) {
      throw new Error('구성원 인증 실패: 인증번호는 6자리 숫자여야 합니다.');
    }

    const client = getSupabase();
    const verification = await callMemberAccessRpc<MemberAccessVerificationRpcResult>(
      client,
      'member_access_verify',
      {
        p_phone_number: normalizedPhoneNumber,
        p_access_code_hash: hashAccessCode(normalizedAccessCode),
      },
      '구성원 인증 실패'
    );

    return {
      member: toMemberRecordDto({ member: verification.member, invite: verification.invite }),
      authenticatedAt: verification.authenticatedAt,
    };
  },
};
