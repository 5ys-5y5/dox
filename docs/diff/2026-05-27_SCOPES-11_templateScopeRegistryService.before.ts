import { createClient } from '@supabase/supabase-js';
import {
  buildTemplateLogicalScopes,
  type TemplateScopeContextDto,
  type TemplateScopeRegistryEntryDto,
  type TemplateScopeSaveScopeInput,
} from './canvasScopeDraftService';
import { SiteScopeAssignmentService } from './siteScopeAssignmentService';

type ScopeRegistryRow = {
  id: string;
  template_id: string;
  template_revision_id: string | null;
  key_frame_group_id: string;
  value_key: string | null;
  scope_key: string;
  display_name: string;
  description: string | null;
  status: string;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LoadTemplateScopeContextInput = {
  templateId: string;
  siteId?: string | null;
};

export type SaveTemplateScopeContextInput = {
  templateId: string;
  templateRevisionId?: string | null;
  siteId?: string | null;
  createdByMemberId?: string | null;
  scopes: TemplateScopeSaveScopeInput[];
};

const SCOPES_DB_SCHEMA = 'scopes';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const scopesSchema = (client = getSupabase()) => client.schema(SCOPES_DB_SCHEMA);

const normalizeString = (value: string | null | undefined) => String(value || '').trim();

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(normalizeString).filter(Boolean)));

const buildScopeMembershipKey = (keyFrameGroupId: string, scopeKey: string) =>
  `${normalizeString(keyFrameGroupId)}::${normalizeString(scopeKey)}`;

const toScopeRegistryEntryDto = (row: ScopeRegistryRow): TemplateScopeRegistryEntryDto => ({
  id: row.id,
  templateId: row.template_id,
  templateRevisionId: row.template_revision_id,
  keyFrameGroupId: row.key_frame_group_id,
  valueKey: row.value_key,
  scopeKey: row.scope_key,
  displayName: row.display_name,
  description: row.description,
  status: row.status,
  createdByMemberId: row.created_by_member_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const selectRegistryRows = async (templateId: string) => {
  const { data, error } = await scopesSchema()
    .from('scope_registry')
    .select('*')
    .eq('template_id', templateId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`scope 목록 조회 실패: ${error.message}`);
  }

  return (data || []) as ScopeRegistryRow[];
};

export const TemplateScopeRegistryService = {
  async loadTemplateScopeContext(input: LoadTemplateScopeContextInput): Promise<TemplateScopeContextDto> {
    const templateId = normalizeString(input.templateId);
    const siteId = normalizeString(input.siteId) || null;

    if (!templateId) {
      throw new Error('scope 조회 실패: templateId가 필요합니다.');
    }

    const registryEntries = (await selectRegistryRows(templateId)).map(toScopeRegistryEntryDto);
    const logicalScopes = buildTemplateLogicalScopes(registryEntries);
    const activeRegistryIds = registryEntries
      .filter((entry) => entry.status === 'active')
      .map((entry) => entry.id);
    const assignments = siteId
      ? await SiteScopeAssignmentService.loadSiteScopeAssignmentsForScopeIds(siteId, activeRegistryIds)
      : [];

    return {
      templateId,
      siteId,
      registryEntries,
      logicalScopes,
      assignments,
      assignmentsByScopeKey: SiteScopeAssignmentService.buildAssignmentsByScopeKey(logicalScopes, assignments),
    };
  },

  async saveTemplateScopeContext(input: SaveTemplateScopeContextInput): Promise<TemplateScopeContextDto> {
    const templateId = normalizeString(input.templateId);
    const templateRevisionId = normalizeString(input.templateRevisionId) || null;
    const siteId = normalizeString(input.siteId) || null;
    const createdByMemberId = normalizeString(input.createdByMemberId) || null;

    if (!templateId) {
      throw new Error('scope 저장 실패: templateId가 필요합니다.');
    }

    const normalizedScopes = input.scopes
      .map((scope) => ({
        scopeKey: normalizeString(scope.scopeKey),
        displayName: normalizeString(scope.displayName),
        description: normalizeString(scope.description) || null,
        keyFrameGroupIds: uniqueStrings(scope.keyFrameGroupIds),
        valueKeyByKeyFrameGroupId: scope.valueKeyByKeyFrameGroupId || {},
        memberIds: uniqueStrings(scope.memberIds || []),
      }))
      .filter((scope) => scope.scopeKey && scope.displayName && scope.keyFrameGroupIds.length > 0);

    const desiredEntries: Array<{
      keyFrameGroupId: string;
      scopeKey: string;
      displayName: string;
      description: string | null;
      valueKey: string | null;
    }> = [];
    const desiredEntryByMembershipKey = new Map<
      string,
      {
        keyFrameGroupId: string;
        scopeKey: string;
        displayName: string;
        description: string | null;
        valueKey: string | null;
      }
    >();

    normalizedScopes.forEach((scope) => {
      scope.keyFrameGroupIds.forEach((keyFrameGroupId) => {
        const membershipKey = buildScopeMembershipKey(keyFrameGroupId, scope.scopeKey);
        const desiredEntry = {
          keyFrameGroupId,
          scopeKey: scope.scopeKey,
          displayName: scope.displayName,
          description: scope.description,
          valueKey: normalizeString(scope.valueKeyByKeyFrameGroupId[keyFrameGroupId]) || null,
        };

        if (!desiredEntryByMembershipKey.has(membershipKey)) {
          desiredEntries.push(desiredEntry);
        }

        desiredEntryByMembershipKey.set(membershipKey, desiredEntry);
      });
    });

    const existingRows = await selectRegistryRows(templateId);
    const existingRowByMembershipKey = new Map<string, ScopeRegistryRow>();
    existingRows.forEach((row) => {
      const keyFrameGroupId = normalizeString(row.key_frame_group_id);
      const scopeKey = normalizeString(row.scope_key);
      const membershipKey = buildScopeMembershipKey(keyFrameGroupId, scopeKey);

      if (keyFrameGroupId && scopeKey && !existingRowByMembershipKey.has(membershipKey)) {
        existingRowByMembershipKey.set(membershipKey, row);
      }
    });

    for (const desired of desiredEntries) {
      const previous = existingRowByMembershipKey.get(buildScopeMembershipKey(desired.keyFrameGroupId, desired.scopeKey));
      const payload = {
        template_id: templateId,
        template_revision_id: templateRevisionId,
        key_frame_group_id: desired.keyFrameGroupId,
        value_key: desired.valueKey,
        scope_key: desired.scopeKey,
        display_name: desired.displayName,
        description: desired.description,
        status: 'active',
        created_by_member_id: createdByMemberId,
      };

      if (previous) {
        const { error } = await scopesSchema()
          .from('scope_registry')
          .update({
            template_revision_id: payload.template_revision_id,
            value_key: payload.value_key,
            scope_key: payload.scope_key,
            display_name: payload.display_name,
            description: payload.description,
            status: 'active',
          })
          .eq('id', previous.id);

        if (error) {
          throw new Error(`scope 저장 실패: ${error.message}`);
        }
        continue;
      }

      const { error } = await scopesSchema().from('scope_registry').insert(payload);

      if (error) {
        throw new Error(`scope 생성 실패: ${error.message}`);
      }
    }

    const desiredMembershipKeys = new Set(desiredEntryByMembershipKey.keys());
    const rowsToDeactivate = existingRows.filter(
      (row) =>
        row.status === 'active' &&
        !desiredMembershipKeys.has(buildScopeMembershipKey(row.key_frame_group_id, row.scope_key))
    );

    if (rowsToDeactivate.length > 0) {
      const { error } = await scopesSchema()
        .from('scope_registry')
        .update({ status: 'inactive' })
        .in('id', rowsToDeactivate.map((row) => row.id));

      if (error) {
        throw new Error(`scope 비활성화 실패: ${error.message}`);
      }
    }

    const nextContext = await this.loadTemplateScopeContext({ templateId, siteId });

    if (siteId) {
      await SiteScopeAssignmentService.saveLogicalScopeAssignments({
        siteId,
        createdByMemberId,
        logicalScopes: nextContext.logicalScopes,
        desiredScopes: normalizedScopes,
      });
    }

    return this.loadTemplateScopeContext({ templateId, siteId });
  },
};
