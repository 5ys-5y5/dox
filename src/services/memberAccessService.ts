import { createHash, randomInt, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
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

type MemberVerificationEventRow = {
  id: string;
  member_id: string;
  phone_number: string;
  verification_source: 'sms_code';
  verification_status: 'sent' | 'verified' | 'failed';
  request_payload: Record<string, unknown> | null;
  verified_at: string | null;
  created_at: string;
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

type LocalMemberAccessStore = {
  members: MemberRegistryRow[];
  invites: MemberInviteRow[];
  verificationEvents: MemberVerificationEventRow[];
  siteMemberships: SiteMembershipRow[];
  documentMemberships: DocumentMembershipRow[];
};

type UpsertMemberWithInviteResult = {
  member: MemberRegistryRow;
  invite: MemberInviteRow | null;
  accessCode: string | null;
  dispatchMode: 'send_code' | 'reuse_existing_verified' | 'reuse_existing_pending';
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const MEMBER_ACCESS_DB_SCHEMA = 'member_access';
const SITES_DB_SCHEMA = 'sites';
const DOCUMENTS_DB_SCHEMA = 'documents';
const LOCAL_MEMBER_ACCESS_STORE_PATH = path.join(process.cwd(), '.runtime', 'member-access-local.json');

// MEMBER_ACCESS_SCHEMA_BOUNDARY
// 번호 기반 멤버/초대/권한은 member_access 스키마만 정본으로 사용합니다.
// 현장/문서 권한은 sites.site_registry, documents.document_registry 를 참조하지만
// 멤버 정보 자체는 member_access.member_registry 와 memberships 가 기준입니다.
const memberAccessSchema = (client = getSupabase()) => client.schema(MEMBER_ACCESS_DB_SCHEMA);
const sitesSchema = (client = getSupabase()) => client.schema(SITES_DB_SCHEMA);
const documentsSchema = (client = getSupabase()) => client.schema(DOCUMENTS_DB_SCHEMA);

const normalizePhoneNumber = (value: string) => value.replace(/[^0-9]/g, '').trim();

const normalizeAccessCode = (value: string) => value.replace(/[^0-9]/g, '').trim();

const hashAccessCode = (value: string) => createHash('sha256').update(value).digest('hex');

const generateAccessCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

const isMemberAccessSchemaUnavailableError = (error: unknown) =>
  error instanceof Error && error.message.includes(`Invalid schema: ${MEMBER_ACCESS_DB_SCHEMA}`);

const buildInviteSmsMessage = (scopeLabel: string, accessCode: string) =>
  `[BARO] ${scopeLabel} 접근 초대 인증번호는 ${accessCode} 입니다. 이 번호는 초대가 철회되기 전까지 계속 사용할 수 있습니다.`;

const getDefaultSenderPhoneNumber = () =>
  process.env.MEMBER_INVITE_SMS_DEFAULT_SENDER?.trim() || process.env.REQUEST_LINK_SMS_DEFAULT_SENDER?.trim() || '';

const createEmptyLocalStore = (): LocalMemberAccessStore => ({
  members: [],
  invites: [],
  verificationEvents: [],
  siteMemberships: [],
  documentMemberships: [],
});

const buildExistingAccessDispatch = (mode: UpsertMemberWithInviteResult['dispatchMode']): MemberDispatchResultDto => {
  if (mode === 'reuse_existing_verified') {
    return {
      status: 'not_required',
      message: '이미 인증된 번호입니다. 새 인증 없이 권한만 추가했습니다.',
      providerConfigured: true,
      sentAt: null,
      accessCodePreview: null,
    };
  }

  return {
    status: 'not_required',
    message: '이미 초대된 번호입니다. 기존 인증번호로 서비스에 들어오면 새 권한이 바로 적용됩니다.',
    providerConfigured: true,
    sentAt: null,
    accessCodePreview: null,
  };
};

const ensureLocalStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_MEMBER_ACCESS_STORE_PATH), { recursive: true });

  try {
    const raw = await fs.readFile(LOCAL_MEMBER_ACCESS_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalMemberAccessStore>;

    return {
      members: Array.isArray(parsed.members) ? parsed.members : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
      verificationEvents: Array.isArray(parsed.verificationEvents) ? parsed.verificationEvents : [],
      siteMemberships: Array.isArray(parsed.siteMemberships) ? parsed.siteMemberships : [],
      documentMemberships: Array.isArray(parsed.documentMemberships) ? parsed.documentMemberships : [],
    } satisfies LocalMemberAccessStore;
  } catch {
    const initialStore = createEmptyLocalStore();
    await fs.writeFile(LOCAL_MEMBER_ACCESS_STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    return initialStore;
  }
};

const saveLocalStore = async (store: LocalMemberAccessStore) => {
  await fs.mkdir(path.dirname(LOCAL_MEMBER_ACCESS_STORE_PATH), { recursive: true });
  await fs.writeFile(LOCAL_MEMBER_ACCESS_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
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
  accessRole: params.membership.access_role,
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
  accessRole: params.membership.access_role,
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
  role === 'viewer' ? 'viewer' : 'editor';

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

const loadInviteByMemberId = async (client: ReturnType<typeof getSupabase>, memberId: string) => {
  const { data, error } = await memberAccessSchema(client).from('member_invites').select('*').eq('member_id', memberId).maybeSingle();

  if (error) {
    throw new Error(`구성원 초대 상태 조회 실패: ${error.message}`);
  }

  return (data || null) as MemberInviteRow | null;
};

const loadMembersByIds = async (client: ReturnType<typeof getSupabase>, memberIds: string[]) => {
  if (memberIds.length === 0) {
    return new Map<string, MemberRegistryRow>();
  }

  const { data, error } = await memberAccessSchema(client).from('member_registry').select('*').in('id', memberIds);

  if (error) {
    throw new Error(`구성원 조회 실패: ${error.message}`);
  }

  return ((data || []) as MemberRegistryRow[]).reduce<Map<string, MemberRegistryRow>>((accumulator, row) => {
    accumulator.set(row.id, row);
    return accumulator;
  }, new Map<string, MemberRegistryRow>());
};

const loadInvitesByMemberIds = async (client: ReturnType<typeof getSupabase>, memberIds: string[]) => {
  if (memberIds.length === 0) {
    return new Map<string, MemberInviteRow>();
  }

  const { data, error } = await memberAccessSchema(client).from('member_invites').select('*').in('member_id', memberIds);

  if (error) {
    throw new Error(`구성원 초대 조회 실패: ${error.message}`);
  }

  return ((data || []) as MemberInviteRow[]).reduce<Map<string, MemberInviteRow>>((accumulator, row) => {
    accumulator.set(row.member_id, row);
    return accumulator;
  }, new Map<string, MemberInviteRow>());
};

const loadMemberById = async (client: ReturnType<typeof getSupabase>, memberId: string) => {
  const memberMap = await loadMembersByIds(client, [memberId]);
  const inviteMap = await loadInvitesByMemberIds(client, [memberId]);
  const member = memberMap.get(memberId) || null;
  const invite = inviteMap.get(memberId) || null;

  if (!member) {
    throw new Error('구성원 접근 확인 실패: 멤버를 찾을 수 없습니다.');
  }

  if (!invite || invite.invite_status !== 'active') {
    throw new Error('구성원 접근 확인 실패: 현재 활성화된 초대가 없습니다.');
  }

  if (member.verification_status === 'revoked') {
    throw new Error('구성원 접근 확인 실패: 철회된 번호입니다.');
  }

  return {
    member,
    invite,
  };
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

const upsertMemberWithInvite = async (params: {
  client: ReturnType<typeof getSupabase>;
  phoneNumber: string;
  displayName?: string | null;
  invitedByMemberId?: string | null;
}): Promise<UpsertMemberWithInviteResult> => {
  const membersClient = memberAccessSchema(params.client);
  const normalizedPhoneNumber = normalizePhoneNumber(params.phoneNumber);
  const trimmedDisplayName = params.displayName?.trim() || null;

  const { data: existingMemberData, error: existingMemberError } = await membersClient
    .from('member_registry')
    .select('*')
    .eq('phone_number', normalizedPhoneNumber)
    .maybeSingle();

  if (existingMemberError) {
    throw new Error(`구성원 초대 실패: 기존 구성원 조회 중 오류가 발생했습니다. (${existingMemberError.message})`);
  }

  const existingMember = (existingMemberData || null) as MemberRegistryRow | null;
  const existingInvite = existingMember ? await loadInviteByMemberId(params.client, existingMember.id) : null;
  const canReuseExistingAccess =
    Boolean(existingMember) &&
    Boolean(existingInvite) &&
    existingInvite?.invite_status === 'active' &&
    existingMember?.verification_status !== 'revoked';
  const shouldGenerateNewAccessCode = !canReuseExistingAccess;
  const accessCode = shouldGenerateNewAccessCode ? generateAccessCode() : null;
  const accessCodeHash = accessCode ? hashAccessCode(accessCode) : '';
  const nextVerificationStatus: MemberVerificationStatus =
    existingMember?.verification_status === 'verified'
      ? 'verified'
      : shouldGenerateNewAccessCode
        ? 'invited'
        : existingMember?.verification_status || 'invited';
  const nowIso = new Date().toISOString();

  const memberPatch = {
    phone_number: normalizedPhoneNumber,
    display_name: trimmedDisplayName || existingMember?.display_name || null,
    verification_status: nextVerificationStatus,
    active_access_code_hash: accessCodeHash || existingMember?.active_access_code_hash || '',
    active_access_code_last_sent_at: shouldGenerateNewAccessCode
      ? nowIso
      : existingMember?.active_access_code_last_sent_at || null,
  };

  const memberResponse = existingMember
    ? await membersClient.from('member_registry').update(memberPatch).eq('id', existingMember.id).select('*').single()
    : await membersClient
        .from('member_registry')
        .insert([
          {
            ...memberPatch,
            active_access_code_hash: accessCodeHash,
          },
        ])
        .select('*')
        .single();

  const member = (memberResponse.data || null) as MemberRegistryRow | null;

  if (memberResponse.error || !member) {
    throw new Error(`구성원 초대 실패: 구성원 저장 중 오류가 발생했습니다. (${memberResponse.error?.message || 'unknown'})`);
  }

  const { error: inviteError } = await membersClient.from('member_invites').upsert(
    [
      {
        member_id: member.id,
        invite_status: 'active',
        invited_by_member_id: params.invitedByMemberId?.trim() || null,
        invite_note: null,
        revoked_at: null,
      },
    ],
    {
      onConflict: 'member_id',
    }
  );

  if (inviteError) {
    throw new Error(`구성원 초대 실패: 초대 상태 저장 중 오류가 발생했습니다. (${inviteError.message})`);
  }

  return {
    member,
    invite: await loadInviteByMemberId(params.client, member.id),
    accessCode,
    dispatchMode:
      member.verification_status === 'verified'
        ? 'reuse_existing_verified'
        : shouldGenerateNewAccessCode
          ? 'send_code'
          : 'reuse_existing_pending',
  };
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
    };
  }

  const sendResult = await SolapiSmsService.sendSms({
    from: senderPhoneNumber,
    to: params.phoneNumber,
    text: buildInviteSmsMessage(params.scopeLabel, params.accessCode),
  });

  if (sendResult.ok) {
    return {
      status: 'sent',
      message: '인증번호를 문자로 발송했습니다.',
      providerConfigured: true,
      sentAt: new Date().toISOString(),
      accessCodePreview: null,
    };
  }

  return {
    status: sendResult.status === 'provider_not_configured' ? 'provider_not_configured' : 'failed',
    message: sendResult.failureReason || '인증번호 문자 발송에 실패했습니다.',
    providerConfigured: sendResult.status !== 'provider_not_configured',
    sentAt: null,
    accessCodePreview: params.accessCode,
  };
};

const recordVerificationEvent = async (params: {
  client: ReturnType<typeof getSupabase>;
  memberId: string;
  phoneNumber: string;
  verificationStatus: 'sent' | 'verified' | 'failed';
  requestPayload?: Record<string, unknown>;
  verifiedAt?: string | null;
}) => {
  const { error } = await memberAccessSchema(params.client).from('member_verification_events').insert([
    {
      member_id: params.memberId,
      phone_number: params.phoneNumber,
      verification_source: 'sms_code',
      verification_status: params.verificationStatus,
      request_payload: params.requestPayload || {},
      verified_at: params.verifiedAt || null,
    },
  ]);

  if (error) {
    throw new Error(`구성원 인증 이력 저장 실패: ${error.message}`);
  }
};

const localLoadInviteByMemberId = (store: LocalMemberAccessStore, memberId: string) =>
  store.invites.find((invite) => invite.member_id === memberId) || null;

const localUpsertMemberWithInvite = async (params: {
  store: LocalMemberAccessStore;
  phoneNumber: string;
  displayName?: string | null;
  invitedByMemberId?: string | null;
}): Promise<UpsertMemberWithInviteResult> => {
  const normalizedPhoneNumber = normalizePhoneNumber(params.phoneNumber);
  const trimmedDisplayName = params.displayName?.trim() || null;
  const nowIso = new Date().toISOString();
  const existingMember = params.store.members.find((member) => member.phone_number === normalizedPhoneNumber) || null;
  const existingInvite = existingMember ? localLoadInviteByMemberId(params.store, existingMember.id) : null;
  const canReuseExistingAccess =
    Boolean(existingMember) &&
    Boolean(existingInvite) &&
    existingInvite?.invite_status === 'active' &&
    existingMember?.verification_status !== 'revoked';
  const shouldGenerateNewAccessCode = !canReuseExistingAccess;
  const accessCode = shouldGenerateNewAccessCode ? generateAccessCode() : null;
  const accessCodeHash = accessCode ? hashAccessCode(accessCode) : '';

  let member: MemberRegistryRow;

  if (existingMember) {
    member = {
      ...existingMember,
      display_name: trimmedDisplayName || existingMember.display_name || null,
      verification_status:
        existingMember.verification_status === 'verified'
          ? 'verified'
          : shouldGenerateNewAccessCode
            ? 'invited'
            : existingMember.verification_status,
      active_access_code_hash: accessCodeHash || existingMember.active_access_code_hash,
      active_access_code_last_sent_at: shouldGenerateNewAccessCode
        ? nowIso
        : existingMember.active_access_code_last_sent_at,
      updated_at: nowIso,
    };
    params.store.members = params.store.members.map((current) => (current.id === member.id ? member : current));
  } else {
    if (!accessCode) {
      throw new Error('구성원 초대 실패: 새 구성원에 대한 접근 코드를 만들지 못했습니다.');
    }

    member = {
      id: randomUUID(),
      phone_number: normalizedPhoneNumber,
      display_name: trimmedDisplayName,
      verification_status: 'invited',
      active_access_code_hash: accessCodeHash,
      active_access_code_last_sent_at: nowIso,
      last_verified_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    params.store.members.push(member);
  }

  const invite: MemberInviteRow = existingInvite
    ? {
        ...existingInvite,
        invite_status: 'active',
        invited_by_member_id: params.invitedByMemberId?.trim() || null,
        revoked_at: null,
        updated_at: nowIso,
      }
    : {
        id: randomUUID(),
        member_id: member.id,
        invite_status: 'active',
        invited_by_member_id: params.invitedByMemberId?.trim() || null,
        invite_note: null,
        revoked_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

  if (existingInvite) {
    params.store.invites = params.store.invites.map((current) => (current.id === invite.id ? invite : current));
  } else {
    params.store.invites.push(invite);
  }

  return {
    member,
    invite,
    accessCode,
    dispatchMode:
      member.verification_status === 'verified'
        ? 'reuse_existing_verified'
        : shouldGenerateNewAccessCode
          ? 'send_code'
          : 'reuse_existing_pending',
  };
};

const localRecordVerificationEvent = (params: {
  store: LocalMemberAccessStore;
  memberId: string;
  phoneNumber: string;
  verificationStatus: 'sent' | 'verified' | 'failed';
  requestPayload?: Record<string, unknown>;
  verifiedAt?: string | null;
}) => {
  params.store.verificationEvents.unshift({
    id: randomUUID(),
    member_id: params.memberId,
    phone_number: params.phoneNumber,
    verification_source: 'sms_code',
    verification_status: params.verificationStatus,
    request_payload: params.requestPayload || {},
    verified_at: params.verifiedAt || null,
    created_at: new Date().toISOString(),
  });
};

const listSiteMembersLocally = async (siteId: string): Promise<SiteMemberRecordDto[]> => {
  const store = await ensureLocalStore();

  return store.siteMemberships
    .filter((membership) => membership.site_id === siteId)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((membership) => {
      const member = store.members.find((item) => item.id === membership.member_id);

      if (!member) {
        return null;
      }

      return toSiteMemberRecordDto({
        membership,
        member,
        invite: localLoadInviteByMemberId(store, membership.member_id),
      });
    })
    .filter((item): item is SiteMemberRecordDto => Boolean(item));
};

const listDocumentMembersLocally = async (documentId: string): Promise<DocumentMemberRecordDto[]> => {
  const store = await ensureLocalStore();

  return store.documentMemberships
    .filter((membership) => membership.document_id === documentId)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((membership) => {
      const member = store.members.find((item) => item.id === membership.member_id);

      if (!member) {
        return null;
      }

      return toDocumentMemberRecordDto({
        membership,
        member,
        invite: localLoadInviteByMemberId(store, membership.member_id),
      });
    })
    .filter((item): item is DocumentMemberRecordDto => Boolean(item));
};

const inviteSiteMemberLocally = async (input: SiteMemberInviteInput): Promise<SiteMemberInviteResult> => {
  const client = getSupabase();
  const normalizedSiteId = input.siteId.trim();
  const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
  validatePhoneNumber(normalizedPhoneNumber);
  const site = await ensureSiteExists(client, normalizedSiteId);
  const store = await ensureLocalStore();
  const inviteContext = await localUpsertMemberWithInvite({
    store,
    phoneNumber: normalizedPhoneNumber,
    displayName: input.displayName,
    invitedByMemberId: input.invitedByMemberId,
  });
  const nowIso = new Date().toISOString();
  const existingMembership =
    store.siteMemberships.find(
      (membership) => membership.member_id === inviteContext.member.id && membership.site_id === normalizedSiteId
    ) || null;
  const membership: SiteMembershipRow = existingMembership
    ? {
        ...existingMembership,
        access_role: input.accessRole,
        created_by_member_id: input.invitedByMemberId?.trim() || null,
        updated_at: nowIso,
      }
    : {
        id: randomUUID(),
        member_id: inviteContext.member.id,
        site_id: normalizedSiteId,
        access_role: input.accessRole,
        created_by_member_id: input.invitedByMemberId?.trim() || null,
        created_at: nowIso,
        updated_at: nowIso,
      };

  if (existingMembership) {
    store.siteMemberships = store.siteMemberships.map((current) => (current.id === membership.id ? membership : current));
  } else {
    store.siteMemberships.unshift(membership);
  }

  const dispatch =
    inviteContext.dispatchMode === 'send_code' && inviteContext.accessCode
      ? await dispatchInviteSms({
          phoneNumber: normalizedPhoneNumber,
          accessCode: inviteContext.accessCode,
          scopeLabel: `${site.site_name} 프로젝트`,
        })
      : buildExistingAccessDispatch(inviteContext.dispatchMode);

  if (inviteContext.dispatchMode === 'send_code') {
    localRecordVerificationEvent({
      store,
      memberId: inviteContext.member.id,
      phoneNumber: normalizedPhoneNumber,
      verificationStatus: 'sent',
      requestPayload: {
        scopeType: 'site',
        scopeId: normalizedSiteId,
        dispatchStatus: dispatch.status,
        localFallback: true,
      },
    });
  }

  await saveLocalStore(store);

  return {
    membership: toSiteMemberRecordDto({
      membership,
      member: inviteContext.member,
      invite: inviteContext.invite,
    }),
    dispatch,
  };
};

const inviteDocumentMemberLocally = async (input: DocumentMemberInviteInput): Promise<DocumentMemberInviteResult> => {
  const client = getSupabase();
  const normalizedDocumentId = input.documentId.trim();
  const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
  validatePhoneNumber(normalizedPhoneNumber);
  const document = await ensureDocumentExists(client, normalizedDocumentId);
  const store = await ensureLocalStore();
  const inviteContext = await localUpsertMemberWithInvite({
    store,
    phoneNumber: normalizedPhoneNumber,
    displayName: input.displayName,
    invitedByMemberId: input.invitedByMemberId,
  });
  const nowIso = new Date().toISOString();
  const existingMembership =
    store.documentMemberships.find(
      (membership) => membership.member_id === inviteContext.member.id && membership.document_id === normalizedDocumentId
    ) || null;
  const membership: DocumentMembershipRow = existingMembership
    ? {
        ...existingMembership,
        access_role: input.accessRole,
        created_by_member_id: input.invitedByMemberId?.trim() || null,
        updated_at: nowIso,
      }
    : {
        id: randomUUID(),
        member_id: inviteContext.member.id,
        document_id: normalizedDocumentId,
        access_role: input.accessRole,
        created_by_member_id: input.invitedByMemberId?.trim() || null,
        created_at: nowIso,
        updated_at: nowIso,
      };

  if (existingMembership) {
    store.documentMemberships = store.documentMemberships.map((current) => (current.id === membership.id ? membership : current));
  } else {
    store.documentMemberships.unshift(membership);
  }

  const dispatch =
    inviteContext.dispatchMode === 'send_code' && inviteContext.accessCode
      ? await dispatchInviteSms({
          phoneNumber: normalizedPhoneNumber,
          accessCode: inviteContext.accessCode,
          scopeLabel: `${document.title} 문서`,
        })
      : buildExistingAccessDispatch(inviteContext.dispatchMode);

  if (inviteContext.dispatchMode === 'send_code') {
    localRecordVerificationEvent({
      store,
      memberId: inviteContext.member.id,
      phoneNumber: normalizedPhoneNumber,
      verificationStatus: 'sent',
      requestPayload: {
        scopeType: 'document',
        scopeId: normalizedDocumentId,
        dispatchStatus: dispatch.status,
        localFallback: true,
      },
    });
  }

  await saveLocalStore(store);

  return {
    membership: toDocumentMemberRecordDto({
      membership,
      member: inviteContext.member,
      invite: inviteContext.invite,
    }),
    dispatch,
  };
};

const removeSiteMembershipLocally = async (membershipId: string): Promise<SiteMemberRecordDto> => {
  const store = await ensureLocalStore();
  const membership = store.siteMemberships.find((item) => item.id === membershipId) || null;

  if (!membership) {
    throw new Error('프로젝트 권한 삭제 실패: 구성원을 찾을 수 없습니다.');
  }

  const member = store.members.find((item) => item.id === membership.member_id) || null;

  if (!member) {
    throw new Error('프로젝트 권한 삭제 실패: 연결된 멤버를 찾을 수 없습니다.');
  }

  store.siteMemberships = store.siteMemberships.filter((item) => item.id !== membershipId);
  await saveLocalStore(store);

  return toSiteMemberRecordDto({
    membership,
    member,
    invite: localLoadInviteByMemberId(store, membership.member_id),
  });
};

const removeDocumentMembershipLocally = async (membershipId: string): Promise<DocumentMemberRecordDto> => {
  const store = await ensureLocalStore();
  const membership = store.documentMemberships.find((item) => item.id === membershipId) || null;

  if (!membership) {
    throw new Error('문서 권한 삭제 실패: 구성원을 찾을 수 없습니다.');
  }

  const member = store.members.find((item) => item.id === membership.member_id) || null;

  if (!member) {
    throw new Error('문서 권한 삭제 실패: 연결된 멤버를 찾을 수 없습니다.');
  }

  store.documentMemberships = store.documentMemberships.filter((item) => item.id !== membershipId);
  await saveLocalStore(store);

  return toDocumentMemberRecordDto({
    membership,
    member,
    invite: localLoadInviteByMemberId(store, membership.member_id),
  });
};

const verifyMemberAccessLocally = async (input: MemberVerificationInput): Promise<MemberVerificationResult> => {
  const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
  const normalizedAccessCode = normalizeAccessCode(input.accessCode);
  validatePhoneNumber(normalizedPhoneNumber);

  if (normalizedAccessCode.length !== 6) {
    throw new Error('구성원 인증 실패: 인증번호는 6자리 숫자여야 합니다.');
  }

  const store = await ensureLocalStore();
  const member = store.members.find((item) => item.phone_number === normalizedPhoneNumber) || null;

  if (!member) {
    throw new Error(`구성원 인증 실패: 초대된 번호를 찾을 수 없습니다. (${normalizedPhoneNumber})`);
  }

  const invite = localLoadInviteByMemberId(store, member.id);

  if (!invite || invite.invite_status !== 'active') {
    localRecordVerificationEvent({
      store,
      memberId: member.id,
      phoneNumber: normalizedPhoneNumber,
      verificationStatus: 'failed',
      requestPayload: { reason: 'invite_not_active', localFallback: true },
    });
    await saveLocalStore(store);
    throw new Error('구성원 인증 실패: 현재 활성화된 초대가 없습니다.');
  }

  if (member.verification_status === 'revoked') {
    localRecordVerificationEvent({
      store,
      memberId: member.id,
      phoneNumber: normalizedPhoneNumber,
      verificationStatus: 'failed',
      requestPayload: { reason: 'member_revoked', localFallback: true },
    });
    await saveLocalStore(store);
    throw new Error('구성원 인증 실패: 철회된 번호입니다.');
  }

  if (hashAccessCode(normalizedAccessCode) !== member.active_access_code_hash) {
    localRecordVerificationEvent({
      store,
      memberId: member.id,
      phoneNumber: normalizedPhoneNumber,
      verificationStatus: 'failed',
      requestPayload: { reason: 'code_mismatch', localFallback: true },
    });
    await saveLocalStore(store);
    throw new Error('구성원 인증 실패: 인증번호가 올바르지 않습니다.');
  }

  const verifiedAt = new Date().toISOString();
  const updatedMember: MemberRegistryRow = {
    ...member,
    verification_status: 'verified',
    last_verified_at: verifiedAt,
    updated_at: verifiedAt,
  };
  store.members = store.members.map((current) => (current.id === updatedMember.id ? updatedMember : current));
  localRecordVerificationEvent({
    store,
    memberId: member.id,
    phoneNumber: normalizedPhoneNumber,
    verificationStatus: 'verified',
    requestPayload: { reason: 'code_match', localFallback: true },
    verifiedAt,
  });
  await saveLocalStore(store);

  return {
    member: toMemberRecordDto({ member: updatedMember, invite }),
    authenticatedAt: verifiedAt,
  };
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
    params.documentMemberships.map((membership) => [membership.document_id, membership.access_role] as const)
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

    if (!siteRole) {
      continue;
    }

    upsertDocument(document, toEffectiveDocumentRoleFromSiteRole(siteRole), 'site');
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
      accessRole: membership.access_role,
      documentCount: documentCountBySiteId[membership.site_id] || 0,
    }))
    .sort((left, right) => left.siteName.localeCompare(right.siteName, 'ko'));
};

const getMemberAccessSessionLocally = async (
  memberId: string,
  authenticatedAt?: string | null
): Promise<MemberAccessSessionDto> => {
  const client = getSupabase();
  const store = await ensureLocalStore();
  const member = store.members.find((item) => item.id === memberId) || null;
  const invite = member ? localLoadInviteByMemberId(store, member.id) : null;

  if (!member || !invite || invite.invite_status !== 'active' || member.verification_status === 'revoked') {
    throw new Error('구성원 접근 확인 실패: 현재 접근 가능한 초대가 없습니다.');
  }

  const siteMemberships = store.siteMemberships.filter((membership) => membership.member_id === member.id);
  const documentMemberships = store.documentMemberships.filter((membership) => membership.member_id === member.id);
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

const getMemberAccessSessionRemotely = async (
  client: ReturnType<typeof getSupabase>,
  memberId: string,
  authenticatedAt?: string | null
): Promise<MemberAccessSessionDto> => {
  const { member, invite } = await loadMemberById(client, memberId);
  const [siteMembershipsResponse, documentMembershipsResponse] = await Promise.all([
    memberAccessSchema(client)
      .from('site_memberships')
      .select('*')
      .eq('member_id', memberId)
      .order('updated_at', { ascending: false }),
    memberAccessSchema(client)
      .from('document_memberships')
      .select('*')
      .eq('member_id', memberId)
      .order('updated_at', { ascending: false }),
  ]);

  if (siteMembershipsResponse.error) {
    throw new Error(`구성원 접근 조회 실패: 프로젝트 권한 조회 중 오류가 발생했습니다. (${siteMembershipsResponse.error.message})`);
  }

  if (documentMembershipsResponse.error) {
    throw new Error(`구성원 접근 조회 실패: 문서 권한 조회 중 오류가 발생했습니다. (${documentMembershipsResponse.error.message})`);
  }

  const siteMemberships = (siteMembershipsResponse.data || []) as SiteMembershipRow[];
  const documentMemberships = (documentMembershipsResponse.data || []) as DocumentMembershipRow[];
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
    try {
      const normalizedSiteId = siteId.trim();

      if (!normalizedSiteId) {
        throw new Error('구성원 목록 조회 실패: siteId가 필요합니다.');
      }

      const client = getSupabase();
      const { data, error } = await memberAccessSchema(client)
        .from('site_memberships')
        .select('*')
        .eq('site_id', normalizedSiteId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`구성원 목록 조회 실패: ${error.message}`);
      }

      const memberships = (data || []) as SiteMembershipRow[];
      const memberIds = memberships.map((row) => row.member_id);
      const membersById = await loadMembersByIds(client, memberIds);
      const invitesByMemberId = await loadInvitesByMemberIds(client, memberIds);

      return memberships
        .map((membership) => {
          const member = membersById.get(membership.member_id);

          if (!member) {
            return null;
          }

          return toSiteMemberRecordDto({
            membership,
            member,
            invite: invitesByMemberId.get(membership.member_id) || null,
          });
        })
        .filter((item): item is SiteMemberRecordDto => Boolean(item));
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return listSiteMembersLocally(siteId.trim());
      }

      throw error;
    }
  },

  async inviteSiteMember(input: SiteMemberInviteInput): Promise<SiteMemberInviteResult> {
    try {
      const normalizedSiteId = input.siteId.trim();
      const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
      validatePhoneNumber(normalizedPhoneNumber);
      const client = getSupabase();
      const site = await ensureSiteExists(client, normalizedSiteId);
      const inviteContext = await upsertMemberWithInvite({
        client,
        phoneNumber: normalizedPhoneNumber,
        displayName: input.displayName,
        invitedByMemberId: input.invitedByMemberId,
      });

      const { data, error } = await memberAccessSchema(client)
        .from('site_memberships')
        .upsert(
          [
            {
              member_id: inviteContext.member.id,
              site_id: normalizedSiteId,
              access_role: input.accessRole,
              created_by_member_id: input.invitedByMemberId?.trim() || null,
            },
          ],
          { onConflict: 'member_id,site_id' }
        )
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(`구성원 초대 실패: 프로젝트 권한 저장 중 오류가 발생했습니다. (${error?.message || 'unknown'})`);
      }

      const dispatch =
        inviteContext.dispatchMode === 'send_code' && inviteContext.accessCode
          ? await dispatchInviteSms({
              phoneNumber: normalizedPhoneNumber,
              accessCode: inviteContext.accessCode,
              scopeLabel: `${site.site_name} 프로젝트`,
            })
          : buildExistingAccessDispatch(inviteContext.dispatchMode);

      if (inviteContext.dispatchMode === 'send_code') {
        await recordVerificationEvent({
          client,
          memberId: inviteContext.member.id,
          phoneNumber: normalizedPhoneNumber,
          verificationStatus: 'sent',
          requestPayload: {
            scopeType: 'site',
            scopeId: normalizedSiteId,
            dispatchStatus: dispatch.status,
          },
        });
      }

      return {
        membership: toSiteMemberRecordDto({
          membership: data as SiteMembershipRow,
          member: inviteContext.member,
          invite: inviteContext.invite,
        }),
        dispatch,
      };
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return inviteSiteMemberLocally(input);
      }

      throw error;
    }
  },

  async removeSiteMembership(membershipId: string): Promise<SiteMemberRecordDto> {
    try {
      const normalizedMembershipId = membershipId.trim();

      if (!normalizedMembershipId) {
        throw new Error('프로젝트 권한 삭제 실패: membershipId가 필요합니다.');
      }

      const client = getSupabase();
      const { data, error } = await memberAccessSchema(client)
        .from('site_memberships')
        .select('*')
        .eq('id', normalizedMembershipId)
        .single();

      const membership = (data || null) as SiteMembershipRow | null;

      if (error || !membership) {
        throw new Error(`프로젝트 권한 삭제 실패: ${error?.message || '구성원을 찾을 수 없습니다.'}`);
      }

      const memberMap = await loadMembersByIds(client, [membership.member_id]);
      const inviteMap = await loadInvitesByMemberIds(client, [membership.member_id]);
      const member = memberMap.get(membership.member_id);

      if (!member) {
        throw new Error('프로젝트 권한 삭제 실패: 연결된 멤버를 찾을 수 없습니다.');
      }

      const { error: deleteError } = await memberAccessSchema(client)
        .from('site_memberships')
        .delete()
        .eq('id', normalizedMembershipId);

      if (deleteError) {
        throw new Error(`프로젝트 권한 삭제 실패: ${deleteError.message}`);
      }

      return toSiteMemberRecordDto({
        membership,
        member,
        invite: inviteMap.get(membership.member_id) || null,
      });
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return removeSiteMembershipLocally(membershipId.trim());
      }

      throw error;
    }
  },

  async listDocumentMembers(documentId: string): Promise<DocumentMemberRecordDto[]> {
    try {
      const normalizedDocumentId = documentId.trim();

      if (!normalizedDocumentId) {
        throw new Error('문서 권한 목록 조회 실패: documentId가 필요합니다.');
      }

      const client = getSupabase();
      const { data, error } = await memberAccessSchema(client)
        .from('document_memberships')
        .select('*')
        .eq('document_id', normalizedDocumentId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`문서 권한 목록 조회 실패: ${error.message}`);
      }

      const memberships = (data || []) as DocumentMembershipRow[];
      const memberIds = memberships.map((row) => row.member_id);
      const membersById = await loadMembersByIds(client, memberIds);
      const invitesByMemberId = await loadInvitesByMemberIds(client, memberIds);

      return memberships
        .map((membership) => {
          const member = membersById.get(membership.member_id);

          if (!member) {
            return null;
          }

          return toDocumentMemberRecordDto({
            membership,
            member,
            invite: invitesByMemberId.get(membership.member_id) || null,
          });
        })
        .filter((item): item is DocumentMemberRecordDto => Boolean(item));
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return listDocumentMembersLocally(documentId.trim());
      }

      throw error;
    }
  },

  async inviteDocumentMember(input: DocumentMemberInviteInput): Promise<DocumentMemberInviteResult> {
    try {
      const normalizedDocumentId = input.documentId.trim();
      const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
      validatePhoneNumber(normalizedPhoneNumber);
      const client = getSupabase();
      const document = await ensureDocumentExists(client, normalizedDocumentId);
      const inviteContext = await upsertMemberWithInvite({
        client,
        phoneNumber: normalizedPhoneNumber,
        displayName: input.displayName,
        invitedByMemberId: input.invitedByMemberId,
      });

      const { data, error } = await memberAccessSchema(client)
        .from('document_memberships')
        .upsert(
          [
            {
              member_id: inviteContext.member.id,
              document_id: normalizedDocumentId,
              access_role: input.accessRole,
              created_by_member_id: input.invitedByMemberId?.trim() || null,
            },
          ],
          { onConflict: 'member_id,document_id' }
        )
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(`구성원 초대 실패: 문서 권한 저장 중 오류가 발생했습니다. (${error?.message || 'unknown'})`);
      }

      const dispatch =
        inviteContext.dispatchMode === 'send_code' && inviteContext.accessCode
          ? await dispatchInviteSms({
              phoneNumber: normalizedPhoneNumber,
              accessCode: inviteContext.accessCode,
              scopeLabel: `${document.title} 문서`,
            })
          : buildExistingAccessDispatch(inviteContext.dispatchMode);

      if (inviteContext.dispatchMode === 'send_code') {
        await recordVerificationEvent({
          client,
          memberId: inviteContext.member.id,
          phoneNumber: normalizedPhoneNumber,
          verificationStatus: 'sent',
          requestPayload: {
            scopeType: 'document',
            scopeId: normalizedDocumentId,
            dispatchStatus: dispatch.status,
          },
        });
      }

      return {
        membership: toDocumentMemberRecordDto({
          membership: data as DocumentMembershipRow,
          member: inviteContext.member,
          invite: inviteContext.invite,
        }),
        dispatch,
      };
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return inviteDocumentMemberLocally(input);
      }

      throw error;
    }
  },

  async removeDocumentMembership(membershipId: string): Promise<DocumentMemberRecordDto> {
    try {
      const normalizedMembershipId = membershipId.trim();

      if (!normalizedMembershipId) {
        throw new Error('문서 권한 삭제 실패: membershipId가 필요합니다.');
      }

      const client = getSupabase();
      const { data, error } = await memberAccessSchema(client)
        .from('document_memberships')
        .select('*')
        .eq('id', normalizedMembershipId)
        .single();

      const membership = (data || null) as DocumentMembershipRow | null;

      if (error || !membership) {
        throw new Error(`문서 권한 삭제 실패: ${error?.message || '구성원을 찾을 수 없습니다.'}`);
      }

      const memberMap = await loadMembersByIds(client, [membership.member_id]);
      const inviteMap = await loadInvitesByMemberIds(client, [membership.member_id]);
      const member = memberMap.get(membership.member_id);

      if (!member) {
        throw new Error('문서 권한 삭제 실패: 연결된 멤버를 찾을 수 없습니다.');
      }

      const { error: deleteError } = await memberAccessSchema(client)
        .from('document_memberships')
        .delete()
        .eq('id', normalizedMembershipId);

      if (deleteError) {
        throw new Error(`문서 권한 삭제 실패: ${deleteError.message}`);
      }

      return toDocumentMemberRecordDto({
        membership,
        member,
        invite: inviteMap.get(membership.member_id) || null,
      });
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return removeDocumentMembershipLocally(membershipId.trim());
      }

      throw error;
    }
  },

  async getMemberAccessSession(memberId: string, authenticatedAt?: string | null): Promise<MemberAccessSessionDto> {
    const normalizedMemberId = memberId.trim();

    if (!normalizedMemberId) {
      throw new Error('구성원 접근 조회 실패: memberId가 필요합니다.');
    }

    try {
      const client = getSupabase();
      return await getMemberAccessSessionRemotely(client, normalizedMemberId, authenticatedAt);
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return getMemberAccessSessionLocally(normalizedMemberId, authenticatedAt);
      }

      throw error;
    }
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
    try {
      const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
      const normalizedAccessCode = normalizeAccessCode(input.accessCode);
      validatePhoneNumber(normalizedPhoneNumber);

      if (normalizedAccessCode.length !== 6) {
        throw new Error('구성원 인증 실패: 인증번호는 6자리 숫자여야 합니다.');
      }

      const client = getSupabase();
      const membersClient = memberAccessSchema(client);
      const { data, error } = await membersClient
        .from('member_registry')
        .select('*')
        .eq('phone_number', normalizedPhoneNumber)
        .maybeSingle();

      const member = (data || null) as MemberRegistryRow | null;

      if (error || !member) {
        throw new Error(`구성원 인증 실패: 초대된 번호를 찾을 수 없습니다. (${error?.message || normalizedPhoneNumber})`);
      }

      const invite = await loadInviteByMemberId(client, member.id);

      if (!invite || invite.invite_status !== 'active') {
        await recordVerificationEvent({
          client,
          memberId: member.id,
          phoneNumber: normalizedPhoneNumber,
          verificationStatus: 'failed',
          requestPayload: { reason: 'invite_not_active' },
        });
        throw new Error('구성원 인증 실패: 현재 활성화된 초대가 없습니다.');
      }

      if (member.verification_status === 'revoked') {
        await recordVerificationEvent({
          client,
          memberId: member.id,
          phoneNumber: normalizedPhoneNumber,
          verificationStatus: 'failed',
          requestPayload: { reason: 'member_revoked' },
        });
        throw new Error('구성원 인증 실패: 철회된 번호입니다.');
      }

      if (hashAccessCode(normalizedAccessCode) !== member.active_access_code_hash) {
        await recordVerificationEvent({
          client,
          memberId: member.id,
          phoneNumber: normalizedPhoneNumber,
          verificationStatus: 'failed',
          requestPayload: { reason: 'code_mismatch' },
        });
        throw new Error('구성원 인증 실패: 인증번호가 올바르지 않습니다.');
      }

      const verifiedAt = new Date().toISOString();
      const { data: updatedMemberData, error: updateError } = await membersClient
        .from('member_registry')
        .update({
          verification_status: 'verified',
          last_verified_at: verifiedAt,
        })
        .eq('id', member.id)
        .select('*')
        .single();

      const updatedMember = (updatedMemberData || null) as MemberRegistryRow | null;

      if (updateError || !updatedMember) {
        throw new Error(`구성원 인증 실패: 인증 상태 저장 중 오류가 발생했습니다. (${updateError?.message || 'unknown'})`);
      }

      await recordVerificationEvent({
        client,
        memberId: member.id,
        phoneNumber: normalizedPhoneNumber,
        verificationStatus: 'verified',
        requestPayload: { reason: 'code_match' },
        verifiedAt,
      });

      return {
        member: toMemberRecordDto({ member: updatedMember, invite }),
        authenticatedAt: verifiedAt,
      };
    } catch (error) {
      if (isMemberAccessSchemaUnavailableError(error)) {
        return verifyMemberAccessLocally(input);
      }

      throw error;
    }
  },
};
