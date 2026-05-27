export type ResolveFrameEditPermissionInput = {
  memberId: string;
  siteId: string;
  frameGroupId: string;
  frameRole: 'key' | 'value' | 'key_value' | 'group' | string;
  parentKeyFrameGroupId?: string | null;
  scopeKeyByKeyFrameGroupId: Record<string, string>;
  memberIdsByScopeKey: Record<string, string[]>;
};

export type ResolveFrameEditPermissionOutput = {
  editable: boolean;
  scopeKey: string | null;
  reason:
    | 'member_assigned_to_scope'
    | 'no_scope_for_key'
    | 'member_not_assigned_to_scope'
    | 'missing_parent_key'
    | 'site_context_missing';
};

const normalizeString = (value: string | null | undefined) => String(value || '').trim();

export const resolveFrameEditPermission = (
  input: ResolveFrameEditPermissionInput
): ResolveFrameEditPermissionOutput => {
  const memberId = normalizeString(input.memberId);
  const siteId = normalizeString(input.siteId);

  if (!siteId) {
    return {
      editable: false,
      scopeKey: null,
      reason: 'site_context_missing',
    };
  }

  const keyFrameGroupId =
    input.frameRole === 'value'
      ? normalizeString(input.parentKeyFrameGroupId)
      : normalizeString(input.frameGroupId);

  if (!keyFrameGroupId) {
    return {
      editable: false,
      scopeKey: null,
      reason: 'missing_parent_key',
    };
  }

  const scopeKey = normalizeString(input.scopeKeyByKeyFrameGroupId[keyFrameGroupId]);

  if (!scopeKey) {
    return {
      editable: false,
      scopeKey: null,
      reason: 'no_scope_for_key',
    };
  }

  const assignedMemberIds = input.memberIdsByScopeKey[scopeKey] || [];
  const editable = Boolean(memberId && assignedMemberIds.includes(memberId));

  return {
    editable,
    scopeKey,
    reason: editable ? 'member_assigned_to_scope' : 'member_not_assigned_to_scope',
  };
};
