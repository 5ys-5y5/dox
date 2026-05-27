import type { TemplateCanvasSelectedBox } from '../components/template/workspace/types';

export type TemplateScopeStatus = 'active' | 'inactive' | string;

export type TemplateScopeRegistryEntryDto = {
  id: string;
  templateId: string;
  templateRevisionId: string | null;
  keyFrameGroupId: string;
  valueKey: string | null;
  scopeKey: string;
  displayName: string;
  description: string | null;
  status: TemplateScopeStatus;
  createdByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteScopeAssignmentDto = {
  id: string;
  siteId: string;
  scopeId: string;
  memberId: string;
  status: TemplateScopeStatus;
  createdByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplateLogicalScopeDto = {
  scopeKey: string;
  templateId: string;
  displayName: string;
  description: string | null;
  registryIds: string[];
  keyFrameGroupIds: string[];
  valueKeys: string[];
  status: TemplateScopeStatus;
};

export type RequestScopeConditionDraft = {
  scopeKey: string;
  requiredPhotoTagKeys: string[];
  requiredFileTagKeys: string[];
  expiresAt?: string | null;
};

export type LogicalScopeMemberAssignmentDto = {
  siteId: string;
  templateId: string;
  scopeKey: string;
  registryIds: string[];
  memberIds: string[];
};

export type CanvasScopeDraftSnapshot = {
  loadedAt: number;
  templateId: string;
  siteId: string | null;
  logicalScopes: TemplateLogicalScopeDto[];
  assignmentsByScopeKey: Record<string, string[]>;
  scopeKeysByKeyFrameGroupId: Record<string, string[]>;
  scopeKeyByKeyFrameGroupId: Record<string, string>;
  valueKeyByKeyFrameGroupId: Record<string, string | null>;
  requestConditionsByScopeKey: Record<string, RequestScopeConditionDraft>;
  dirty: boolean;
};

export type CanvasScopeDraftCommand =
  | {
      type: 'create_scope';
      scopeKey: string;
      displayName: string;
      description?: string | null;
    }
  | {
      type: 'update_scope';
      scopeKey: string;
      displayName?: string | null;
      description?: string | null;
    }
  | {
      type: 'deactivate_scope';
      scopeKey: string;
    }
  | {
      type: 'assign_keys_to_scope';
      scopeKey: string;
      keyFrameGroupIds: string[];
      valueKeyByKeyFrameGroupId?: Record<string, string | null>;
    }
  | {
      type: 'remove_keys_from_scope';
      scopeKey: string;
      keyFrameGroupIds: string[];
    }
  | {
      type: 'assign_members_to_scope';
      scopeKey: string;
      memberIds: string[];
    }
  | {
      type: 'set_scope_request_condition';
      scopeKey: string;
      requiredPhotoTagKeys?: string[];
      requiredFileTagKeys?: string[];
      expiresAt?: string | null;
    };

export type TemplateScopeSaveScopeInput = {
  scopeKey: string;
  displayName: string;
  description?: string | null;
  keyFrameGroupIds: string[];
  valueKeyByKeyFrameGroupId?: Record<string, string | null>;
  memberIds?: string[];
};

export type TemplateScopeContextDto = {
  templateId: string;
  siteId: string | null;
  registryEntries: TemplateScopeRegistryEntryDto[];
  logicalScopes: TemplateLogicalScopeDto[];
  assignments: SiteScopeAssignmentDto[];
  assignmentsByScopeKey: Record<string, string[]>;
};

const normalizeString = (value: string | null | undefined) => String(value || '').trim();

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(normalizeString).filter(Boolean)));

export const createEmptyCanvasScopeDraftSnapshot = (): CanvasScopeDraftSnapshot => ({
  loadedAt: 0,
  templateId: '',
  siteId: null,
  logicalScopes: [],
  assignmentsByScopeKey: {},
  scopeKeysByKeyFrameGroupId: {},
  scopeKeyByKeyFrameGroupId: {},
  valueKeyByKeyFrameGroupId: {},
  requestConditionsByScopeKey: {},
  dirty: false,
});

export const buildTemplateLogicalScopes = (
  entries: TemplateScopeRegistryEntryDto[]
): TemplateLogicalScopeDto[] => {
  const scopeByKey = new Map<string, TemplateLogicalScopeDto>();

  entries
    .filter((entry) => entry.status === 'active')
    .forEach((entry) => {
      const scopeKey = normalizeString(entry.scopeKey);
      const templateId = normalizeString(entry.templateId);
      const keyFrameGroupId = normalizeString(entry.keyFrameGroupId);

      if (!scopeKey || !templateId || !keyFrameGroupId) {
        return;
      }

      const previous = scopeByKey.get(scopeKey);

      if (!previous) {
        scopeByKey.set(scopeKey, {
          scopeKey,
          templateId,
          displayName: normalizeString(entry.displayName) || scopeKey,
          description: entry.description,
          registryIds: uniqueStrings([entry.id]),
          keyFrameGroupIds: uniqueStrings([keyFrameGroupId]),
          valueKeys: uniqueStrings([entry.valueKey]),
          status: entry.status,
        });
        return;
      }

      previous.registryIds = uniqueStrings([...previous.registryIds, entry.id]);
      previous.keyFrameGroupIds = uniqueStrings([...previous.keyFrameGroupIds, keyFrameGroupId]);
      previous.valueKeys = uniqueStrings([...previous.valueKeys, entry.valueKey]);
      if (!previous.description && entry.description) {
        previous.description = entry.description;
      }
    });

  return Array.from(scopeByKey.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName, 'ko')
  );
};

export const buildScopeKeysByKeyFrameGroupId = (logicalScopes: TemplateLogicalScopeDto[]) => {
  const scopeKeysByKeyFrameGroupId: Record<string, string[]> = {};

  logicalScopes.forEach((scope) => {
    scope.keyFrameGroupIds.forEach((keyFrameGroupId) => {
      const normalizedKeyFrameGroupId = normalizeString(keyFrameGroupId);
      if (normalizedKeyFrameGroupId) {
        scopeKeysByKeyFrameGroupId[normalizedKeyFrameGroupId] = uniqueStrings([
          ...(scopeKeysByKeyFrameGroupId[normalizedKeyFrameGroupId] || []),
          scope.scopeKey,
        ]);
      }
    });
  });

  return scopeKeysByKeyFrameGroupId;
};

export const buildScopeKeyByKeyFrameGroupId = (logicalScopes: TemplateLogicalScopeDto[]) => {
  const scopeKeyByKeyFrameGroupId: Record<string, string> = {};
  const scopeKeysByKeyFrameGroupId = buildScopeKeysByKeyFrameGroupId(logicalScopes);

  Object.entries(scopeKeysByKeyFrameGroupId).forEach(([keyFrameGroupId, scopeKeys]) => {
    scopeKeyByKeyFrameGroupId[keyFrameGroupId] = scopeKeys[0] || '';
  });

  return scopeKeyByKeyFrameGroupId;
};

export const buildValueKeyByKeyFrameGroupId = (entries: TemplateScopeRegistryEntryDto[]) => {
  const valueKeyByKeyFrameGroupId: Record<string, string | null> = {};

  entries
    .filter((entry) => entry.status === 'active')
    .forEach((entry) => {
      const keyFrameGroupId = normalizeString(entry.keyFrameGroupId);
      if (keyFrameGroupId) {
        valueKeyByKeyFrameGroupId[keyFrameGroupId] = entry.valueKey;
      }
    });

  return valueKeyByKeyFrameGroupId;
};

export const createCanvasScopeDraftSnapshot = (context: TemplateScopeContextDto): CanvasScopeDraftSnapshot => ({
  loadedAt: Date.now(),
  templateId: context.templateId,
  siteId: context.siteId,
  logicalScopes: context.logicalScopes,
  assignmentsByScopeKey: context.assignmentsByScopeKey,
  scopeKeysByKeyFrameGroupId: buildScopeKeysByKeyFrameGroupId(context.logicalScopes),
  scopeKeyByKeyFrameGroupId: buildScopeKeyByKeyFrameGroupId(context.logicalScopes),
  valueKeyByKeyFrameGroupId: buildValueKeyByKeyFrameGroupId(context.registryEntries),
  requestConditionsByScopeKey: {},
  dirty: false,
});

export const normalizeScopeKey = (value: string) =>
  normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

export const buildAvailableScopeKey = (displayName: string, existingScopeKeys: string[]) => {
  const baseScopeKey = normalizeScopeKey(displayName) || `scope_${Date.now().toString(36)}`;
  const existingSet = new Set(existingScopeKeys.map(normalizeString).filter(Boolean));

  if (!existingSet.has(baseScopeKey)) {
    return baseScopeKey;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseScopeKey}_${index}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  return `${baseScopeKey}_${Date.now().toString(36)}`;
};

export const collectScopeAssignableKeyFrameGroupIds = (selectedBoxes: TemplateCanvasSelectedBox[]) =>
  uniqueStrings(
    selectedBoxes.map((box) => {
      if (box.keyFrameGroupId) {
        return box.keyFrameGroupId;
      }

      if (box.frameRole === 'key' || box.role === 'key') {
        return box.frameGroupId;
      }

      return '';
    })
  );

export const buildSelectedValueKeyByKeyFrameGroupId = (selectedBoxes: TemplateCanvasSelectedBox[]) => {
  const valueKeyByKeyFrameGroupId: Record<string, string | null> = {};

  selectedBoxes.forEach((box) => {
    const keyFrameGroupId = normalizeString(
      box.keyFrameGroupId || (box.frameRole === 'key' || box.role === 'key' ? box.frameGroupId : '')
    );

    if (!keyFrameGroupId || Object.prototype.hasOwnProperty.call(valueKeyByKeyFrameGroupId, keyFrameGroupId)) {
      return;
    }

    valueKeyByKeyFrameGroupId[keyFrameGroupId] = normalizeString(box.valueKey) || null;
  });

  return valueKeyByKeyFrameGroupId;
};

const upsertLogicalScope = (
  logicalScopes: TemplateLogicalScopeDto[],
  params: {
    templateId: string;
    scopeKey: string;
    displayName: string;
    description?: string | null;
  }
) => {
  const scopeKey = normalizeString(params.scopeKey);
  const index = logicalScopes.findIndex((scope) => scope.scopeKey === scopeKey);

  if (index >= 0) {
    return logicalScopes.map((scope, scopeIndex) =>
      scopeIndex === index
        ? {
            ...scope,
            displayName: normalizeString(params.displayName) || scope.displayName,
            description: params.description ?? scope.description,
          }
        : scope
    );
  }

  return [
    ...logicalScopes,
    {
      scopeKey,
      templateId: params.templateId,
      displayName: normalizeString(params.displayName) || scopeKey,
      description: params.description ?? null,
      registryIds: [],
      keyFrameGroupIds: [],
      valueKeys: [],
      status: 'active',
    },
  ].sort((left, right) => left.displayName.localeCompare(right.displayName, 'ko'));
};

const rebuildScopeIndex = (logicalScopes: TemplateLogicalScopeDto[]) => ({
  scopeKeysByKeyFrameGroupId: buildScopeKeysByKeyFrameGroupId(logicalScopes),
  scopeKeyByKeyFrameGroupId: buildScopeKeyByKeyFrameGroupId(logicalScopes),
});

export const normalizeRequestScopeExpiresAt = (value: string | null | undefined): string | null =>
  normalizeString(value) || null;

export const applyCanvasScopeDraftCommand = (
  snapshot: CanvasScopeDraftSnapshot,
  command: CanvasScopeDraftCommand
): CanvasScopeDraftSnapshot => {
  if (!snapshot.templateId) {
    return snapshot;
  }

  if (command.type === 'create_scope') {
    const scopeKey = normalizeString(command.scopeKey);

    if (!scopeKey) {
      return snapshot;
    }

    return {
      ...snapshot,
      logicalScopes: upsertLogicalScope(snapshot.logicalScopes, {
        templateId: snapshot.templateId,
        scopeKey,
        displayName: command.displayName,
        description: command.description,
      }),
      dirty: true,
    };
  }

  if (command.type === 'update_scope') {
    const scopeKey = normalizeString(command.scopeKey);

    if (!scopeKey) {
      return snapshot;
    }

    return {
      ...snapshot,
      logicalScopes: snapshot.logicalScopes.map((scope) =>
        scope.scopeKey === scopeKey
          ? {
              ...scope,
              displayName: normalizeString(command.displayName) || scope.displayName,
              description: command.description === undefined ? scope.description : normalizeString(command.description) || null,
            }
          : scope
      ),
      dirty: true,
    };
  }

  if (command.type === 'deactivate_scope') {
    const scopeKey = normalizeString(command.scopeKey);

    if (!scopeKey) {
      return snapshot;
    }

    const nextLogicalScopes = snapshot.logicalScopes.map((scope) =>
      scope.scopeKey === scopeKey
        ? {
            ...scope,
            status: 'inactive',
            keyFrameGroupIds: [],
            valueKeys: [],
          }
        : scope
    );
    const nextAssignmentsByScopeKey = { ...snapshot.assignmentsByScopeKey };
    delete nextAssignmentsByScopeKey[scopeKey];
    const nextRequestConditionsByScopeKey = { ...snapshot.requestConditionsByScopeKey };
    delete nextRequestConditionsByScopeKey[scopeKey];

    return {
      ...snapshot,
      logicalScopes: nextLogicalScopes,
      assignmentsByScopeKey: nextAssignmentsByScopeKey,
      requestConditionsByScopeKey: nextRequestConditionsByScopeKey,
      ...rebuildScopeIndex(nextLogicalScopes),
      dirty: true,
    };
  }

  if (command.type === 'assign_keys_to_scope') {
    const scopeKey = normalizeString(command.scopeKey);
    const keyFrameGroupIds = uniqueStrings(command.keyFrameGroupIds);

    if (!scopeKey || keyFrameGroupIds.length <= 0) {
      return snapshot;
    }

    const baseScopes = upsertLogicalScope(snapshot.logicalScopes, {
      templateId: snapshot.templateId,
      scopeKey,
      displayName: snapshot.logicalScopes.find((scope) => scope.scopeKey === scopeKey)?.displayName || scopeKey,
      description: snapshot.logicalScopes.find((scope) => scope.scopeKey === scopeKey)?.description ?? null,
    });
    const nextValueKeyByKeyFrameGroupId = { ...snapshot.valueKeyByKeyFrameGroupId };
    Object.entries(command.valueKeyByKeyFrameGroupId || {}).forEach(([keyFrameGroupId, valueKey]) => {
      const normalizedKeyFrameGroupId = normalizeString(keyFrameGroupId);
      if (normalizedKeyFrameGroupId) {
        nextValueKeyByKeyFrameGroupId[normalizedKeyFrameGroupId] = normalizeString(valueKey) || null;
      }
    });
    const nextLogicalScopes = baseScopes.map((scope) => {
      if (scope.scopeKey !== scopeKey) {
        return scope;
      }

      const nextKeyFrameGroupIds = uniqueStrings([...scope.keyFrameGroupIds, ...keyFrameGroupIds]);

      return {
        ...scope,
        status: 'active',
        keyFrameGroupIds: nextKeyFrameGroupIds,
        valueKeys: uniqueStrings(nextKeyFrameGroupIds.map((keyFrameGroupId) => nextValueKeyByKeyFrameGroupId[keyFrameGroupId])),
      };
    });

    return {
      ...snapshot,
      logicalScopes: nextLogicalScopes,
      ...rebuildScopeIndex(nextLogicalScopes),
      valueKeyByKeyFrameGroupId: nextValueKeyByKeyFrameGroupId,
      dirty: true,
    };
  }

  if (command.type === 'remove_keys_from_scope') {
    const scopeKey = normalizeString(command.scopeKey);
    const keyFrameGroupIds = uniqueStrings(command.keyFrameGroupIds);

    if (!scopeKey || keyFrameGroupIds.length <= 0) {
      return snapshot;
    }

    const nextLogicalScopes = snapshot.logicalScopes.map((scope) => {
      if (scope.scopeKey !== scopeKey) {
        return scope;
      }

      const nextKeyFrameGroupIds = scope.keyFrameGroupIds.filter((keyFrameGroupId) => !keyFrameGroupIds.includes(keyFrameGroupId));

      return {
        ...scope,
        keyFrameGroupIds: nextKeyFrameGroupIds,
        valueKeys: uniqueStrings(nextKeyFrameGroupIds.map((keyFrameGroupId) => snapshot.valueKeyByKeyFrameGroupId[keyFrameGroupId])),
      };
    });

    return {
      ...snapshot,
      logicalScopes: nextLogicalScopes,
      ...rebuildScopeIndex(nextLogicalScopes),
      dirty: true,
    };
  }

  if (command.type === 'assign_members_to_scope') {
    const scopeKey = normalizeString(command.scopeKey);

    if (!scopeKey) {
      return snapshot;
    }

    return {
      ...snapshot,
      assignmentsByScopeKey: {
        ...snapshot.assignmentsByScopeKey,
        [scopeKey]: uniqueStrings(command.memberIds),
      },
      dirty: true,
    };
  }

  if (command.type === 'set_scope_request_condition') {
    const scopeKey = normalizeString(command.scopeKey);

    if (!scopeKey) {
      return snapshot;
    }

    const previousCondition = snapshot.requestConditionsByScopeKey[scopeKey] || {
      scopeKey,
      requiredPhotoTagKeys: [],
      requiredFileTagKeys: [],
      expiresAt: null,
    };

    return {
      ...snapshot,
      requestConditionsByScopeKey: {
        ...snapshot.requestConditionsByScopeKey,
        [scopeKey]: {
          scopeKey,
          requiredPhotoTagKeys:
            command.requiredPhotoTagKeys === undefined
              ? previousCondition.requiredPhotoTagKeys
              : uniqueStrings(command.requiredPhotoTagKeys),
          requiredFileTagKeys:
            command.requiredFileTagKeys === undefined
              ? previousCondition.requiredFileTagKeys
              : uniqueStrings(command.requiredFileTagKeys),
          expiresAt:
            command.expiresAt === undefined
              ? normalizeRequestScopeExpiresAt(previousCondition.expiresAt)
              : normalizeRequestScopeExpiresAt(command.expiresAt),
        },
      },
      dirty: true,
    };
  }

  return snapshot;
};

export const buildTemplateScopeSaveInputFromDraft = (
  snapshot: CanvasScopeDraftSnapshot
): TemplateScopeSaveScopeInput[] =>
  snapshot.logicalScopes
    .filter((scope) => scope.status === 'active')
    .map((scope) => ({
      scopeKey: scope.scopeKey,
      displayName: scope.displayName,
      description: scope.description,
      keyFrameGroupIds: scope.keyFrameGroupIds,
      valueKeyByKeyFrameGroupId: scope.keyFrameGroupIds.reduce<Record<string, string | null>>((map, keyFrameGroupId) => {
        map[keyFrameGroupId] = snapshot.valueKeyByKeyFrameGroupId[keyFrameGroupId] || null;
        return map;
      }, {}),
      memberIds: snapshot.assignmentsByScopeKey[scope.scopeKey] || [],
    }))
    .filter((scope) => scope.scopeKey && scope.keyFrameGroupIds.length > 0);
