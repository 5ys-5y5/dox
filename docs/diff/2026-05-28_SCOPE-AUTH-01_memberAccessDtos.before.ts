import type { DocumentDetailResult, DocumentLifecycleStatus } from './documentDtos';

export type MemberVerificationStatus = 'invited' | 'verified' | 'revoked';
export type MemberInviteStatus = 'active' | 'revoked';
export type MemberDispatchStatus = 'sent' | 'provider_not_configured' | 'failed' | 'not_required';

export type SiteMemberAccessRole = 'owner' | 'manager' | 'participant' | 'editor' | 'viewer';
export type DocumentMemberAccessRole = 'editor' | 'viewer' | 'signer';

export type MemberRecordDto = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  verificationStatus: MemberVerificationStatus;
  inviteStatus: MemberInviteStatus;
  activeAccessCodeLastSentAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberDispatchResultDto = {
  status: MemberDispatchStatus;
  message: string;
  providerConfigured: boolean;
  sentAt: string | null;
  accessCodePreview: string | null;
  providerMessageId: string | null;
  providerGroupId: string | null;
};

export type SiteMemberRecordDto = {
  membershipId: string;
  siteId: string;
  accessRole: SiteMemberAccessRole;
  member: MemberRecordDto;
  createdAt: string;
  updatedAt: string;
};

export type DocumentMemberRecordDto = {
  membershipId: string;
  documentId: string;
  accessRole: DocumentMemberAccessRole;
  member: MemberRecordDto;
  createdAt: string;
  updatedAt: string;
};

export type SiteMemberInviteInput = {
  siteId: string;
  phoneNumber: string;
  displayName?: string | null;
  accessRole: SiteMemberAccessRole;
  invitedByMemberId?: string | null;
};

export type DocumentMemberInviteInput = {
  documentId: string;
  phoneNumber: string;
  displayName?: string | null;
  accessRole: DocumentMemberAccessRole;
  invitedByMemberId?: string | null;
};

export type SiteMemberInviteResult = {
  membership: SiteMemberRecordDto;
  dispatch: MemberDispatchResultDto;
};

export type DocumentMemberInviteResult = {
  membership: DocumentMemberRecordDto;
  dispatch: MemberDispatchResultDto;
};

export type MemberVerificationInput = {
  phoneNumber: string;
  accessCode: string;
};

export type MemberVerificationResult = {
  member: MemberRecordDto;
  authenticatedAt: string;
};

export type MemberDocumentEffectiveAccessRole = 'editor' | 'signer' | 'viewer';

export type MemberDocumentAccessSource = 'site' | 'document' | 'site+document';

export type MemberAccessibleSiteDto = {
  siteId: string;
  siteName: string;
  accessRole: SiteMemberAccessRole;
  documentCount: number;
};

export type MemberAccessibleDocumentDto = {
  documentId: string;
  siteId: string;
  siteName: string;
  title: string;
  status: DocumentLifecycleStatus;
  currentVersionNumber: number | null;
  updatedAt: string;
  accessRole: MemberDocumentEffectiveAccessRole;
  accessSource: MemberDocumentAccessSource;
};

export type MemberAccessSessionDto = {
  member: MemberRecordDto;
  authenticatedAt: string;
  accessibleSites: MemberAccessibleSiteDto[];
  accessibleDocuments: MemberAccessibleDocumentDto[];
};

export type MemberDocumentAccessDto = {
  member: MemberRecordDto;
  authenticatedAt: string;
  accessRole: MemberDocumentEffectiveAccessRole;
  accessSource: MemberDocumentAccessSource;
  detail: DocumentDetailResult;
};
