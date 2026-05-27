import { createClient } from '@supabase/supabase-js';
import type {
  SiteScopeAssignmentDto,
  TemplateLogicalScopeDto,
  TemplateScopeSaveScopeInput,
} from './canvasScopeDraftService';

type SiteScopeAssignmentRow = {
  id: string;
  site_id: string;
  scope_id: string;
  member_id: string;
  status: string;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveLogicalScopeAssignmentsInput = {
  siteId: string;
  createdByMemberId?: string | null;
  logicalScopes: TemplateLogicalScopeDto[];
  desiredScopes: TemplateScopeSaveScopeInput[];
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

const toSiteScopeAssignmentDto = (row: SiteScopeAssignmentRow): SiteScopeAssignmentDto => ({
  id: row.id,
  siteId: row.site_id,
  scopeId: row.scope_id,
  memberId: row.member_id,
  status: row.status,
  createdByMemberId: row.created_by_member_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const selectAssignmentRows = async (siteId: string, scopeIds: string[]) => {
  if (!siteId || scopeIds.length <= 0) {
    return [] as SiteScopeAssignmentRow[];
  }

  const { data, error } = await scopesSchema()
    .from('site_scope_assignments')
    .select('*')
    .eq('site_id', siteId)
    .in('scope_id', scopeIds)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`scope 구성원 조회 실패: ${error.message}`);
  }

  return (data || []) as SiteScopeAssignmentRow[];
};

export const SiteScopeAssignmentService = {
  buildAssignmentsByScopeKey(
    logicalScopes: TemplateLogicalScopeDto[],
    assignments: SiteScopeAssignmentDto[]
  ) {
    const scopeKeyByRegistryId = new Map<string, string>();
    logicalScopes.forEach((scope) => {
      scope.registryIds.forEach((registryId) => {
        scopeKeyByRegistryId.set(registryId, scope.scopeKey);
      });
    });

    return assignments.reduce<Record<string, string[]>>((map, assignment) => {
      if (assignment.status !== 'active') {
        return map;
      }

      const scopeKey = scopeKeyByRegistryId.get(assignment.scopeId);
      if (!scopeKey) {
        return map;
      }

      map[scopeKey] = uniqueStrings([...(map[scopeKey] || []), assignment.memberId]);
      return map;
    }, {});
  },

  async loadSiteScopeAssignmentsForScopeIds(siteId: string, scopeIds: string[]) {
    return (await selectAssignmentRows(normalizeString(siteId), uniqueStrings(scopeIds))).map(toSiteScopeAssignmentDto);
  },

  async saveLogicalScopeAssignments(input: SaveLogicalScopeAssignmentsInput) {
    const siteId = normalizeString(input.siteId);
    const createdByMemberId = normalizeString(input.createdByMemberId) || null;

    if (!siteId) {
      throw new Error('scope 구성원 저장 실패: siteId가 필요합니다.');
    }

    const registryIdsByScopeKey = new Map<string, string[]>();
    input.logicalScopes.forEach((scope) => {
      registryIdsByScopeKey.set(scope.scopeKey, scope.registryIds);
    });

    for (const scope of input.desiredScopes) {
      const scopeKey = normalizeString(scope.scopeKey);
      const registryIds = registryIdsByScopeKey.get(scopeKey) || [];
      const desiredMemberIds = new Set(uniqueStrings(scope.memberIds || []));

      if (!scopeKey || registryIds.length <= 0) {
        continue;
      }

      const existingAssignments = await selectAssignmentRows(siteId, registryIds);

      for (const registryId of registryIds) {
        for (const memberId of desiredMemberIds) {
          const previous = existingAssignments.find(
            (assignment) => assignment.scope_id === registryId && assignment.member_id === memberId
          );

          if (previous) {
            if (previous.status !== 'active') {
              const { error } = await scopesSchema()
                .from('site_scope_assignments')
                .update({ status: 'active' })
                .eq('id', previous.id);

              if (error) {
                throw new Error(`scope 구성원 재활성화 실패: ${error.message}`);
              }
            }
            continue;
          }

          const { error } = await scopesSchema().from('site_scope_assignments').insert({
            site_id: siteId,
            scope_id: registryId,
            member_id: memberId,
            status: 'active',
            created_by_member_id: createdByMemberId,
          });

          if (error) {
            throw new Error(`scope 구성원 배정 실패: ${error.message}`);
          }
        }
      }

      const assignmentsToDeactivate = existingAssignments.filter(
        (assignment) => assignment.status === 'active' && !desiredMemberIds.has(assignment.member_id)
      );

      if (assignmentsToDeactivate.length > 0) {
        const { error } = await scopesSchema()
          .from('site_scope_assignments')
          .update({ status: 'inactive' })
          .in('id', assignmentsToDeactivate.map((assignment) => assignment.id));

        if (error) {
          throw new Error(`scope 구성원 해제 실패: ${error.message}`);
        }
      }
    }
  },
};
