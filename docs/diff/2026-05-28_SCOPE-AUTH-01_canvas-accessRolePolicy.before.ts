'use client';

import * as React from 'react';
import type { MemberDocumentEffectiveAccessRole } from '../../lib/memberAccessDtos';

export type CanvasAccessRole = 'editor' | 'viewer' | 'signer';
export type CanvasAccessMode = 'edit' | 'view';

export type CanvasAccessRolePolicy = {
  accessMode: CanvasAccessMode;
  label: string;
  badgeLabel: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

export type CanvasAccessRolePolicyStore = {
  version: 1;
  pagePolicies: Record<string, Partial<Record<CanvasAccessRole, Partial<CanvasAccessRolePolicy>>>>;
};

export const canvasAccessRoles: CanvasAccessRole[] = ['editor', 'viewer', 'signer'];

export const canvasAccessRoleLabels: Record<CanvasAccessRole, string> = {
  editor: '편집 권한자',
  viewer: '보기 권한자',
  signer: '서명 권한자',
};

export const normalizeCanvasAccessRole = (value: string | null | undefined): CanvasAccessRole =>
  canvasAccessRoles.includes(value as CanvasAccessRole) ? (value as CanvasAccessRole) : 'editor';

export const defaultCanvasAccessRolePolicies: Record<CanvasAccessRole, CanvasAccessRolePolicy> = {
  editor: {
    accessMode: 'edit',
    label: '편집 권한자',
    badgeLabel: '편집 가능',
    accentColor: '#2563eb',
    backgroundColor: '#eff6ff',
    textColor: '#1d4ed8',
  },
  viewer: {
    accessMode: 'view',
    label: '보기 권한자',
    badgeLabel: '열람 가능',
    accentColor: '#64748b',
    backgroundColor: '#f8fafc',
    textColor: '#334155',
  },
  signer: {
    accessMode: 'view',
    label: '서명 권한자',
    badgeLabel: '서명 확인',
    accentColor: '#7c3aed',
    backgroundColor: '#f5f3ff',
    textColor: '#6d28d9',
  },
};

const CANVAS_ACCESS_ROLE_POLICY_STORAGE_KEY = 'mejai.canvas.accessRolePolicies.v1';
const CANVAS_ACCESS_ROLE_POLICY_EVENT_NAME = 'mejai:canvas-access-role-policies-changed';

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeText = (value: unknown, fallback: string, maxLength = 40) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return (normalized || fallback).slice(0, maxLength);
};

const normalizeColor = (value: unknown, fallback: string) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
};

export const normalizeCanvasAccessRolePolicy = (
  role: CanvasAccessRole,
  value: unknown
): CanvasAccessRolePolicy => {
  const defaults = defaultCanvasAccessRolePolicies[role];
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CanvasAccessRolePolicy>)
      : {};
  const requestedAccessMode = candidate.accessMode === 'edit' ? 'edit' : 'view';

  return {
    accessMode: role === 'editor' ? requestedAccessMode : 'view',
    label: normalizeText(candidate.label, defaults.label),
    badgeLabel: normalizeText(candidate.badgeLabel, defaults.badgeLabel),
    accentColor: normalizeColor(candidate.accentColor, defaults.accentColor),
    backgroundColor: normalizeColor(candidate.backgroundColor, defaults.backgroundColor),
    textColor: normalizeColor(candidate.textColor, defaults.textColor),
  };
};

export const normalizeCanvasAccessRolePolicyOverrides = (
  role: CanvasAccessRole,
  value: unknown
): Partial<CanvasAccessRolePolicy> => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CanvasAccessRolePolicy>)
      : {};
  const normalized = normalizeCanvasAccessRolePolicy(role, candidate);
  const overrides: Partial<CanvasAccessRolePolicy> = {};

  (Object.keys(defaultCanvasAccessRolePolicies[role]) as Array<keyof CanvasAccessRolePolicy>).forEach((key) => {
    if (hasOwn(candidate, key)) {
      overrides[key] = normalized[key] as never;
    }
  });

  return overrides;
};

export const createEmptyCanvasAccessRolePolicyStore = (): CanvasAccessRolePolicyStore => ({
  version: 1,
  pagePolicies: {},
});

export const normalizeCanvasAccessRolePolicyStore = (value: unknown): CanvasAccessRolePolicyStore => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { pagePolicies?: unknown })
      : null;

  if (!candidate?.pagePolicies || typeof candidate.pagePolicies !== 'object' || Array.isArray(candidate.pagePolicies)) {
    return createEmptyCanvasAccessRolePolicyStore();
  }

  const pagePoliciesCandidate = candidate.pagePolicies as Record<string, unknown>;
  const pagePolicies: CanvasAccessRolePolicyStore['pagePolicies'] = {};

  Object.entries(pagePoliciesCandidate).forEach(([pageId, rawPolicyByRole]) => {
    if (!rawPolicyByRole || typeof rawPolicyByRole !== 'object' || Array.isArray(rawPolicyByRole)) {
      return;
    }

    const normalizedPageId = pageId.trim();
    const policyByRole = rawPolicyByRole as Record<string, unknown>;
    const nextPolicyByRole: Partial<Record<CanvasAccessRole, Partial<CanvasAccessRolePolicy>>> = {};

    canvasAccessRoles.forEach((role) => {
      const overrides = normalizeCanvasAccessRolePolicyOverrides(role, policyByRole[role]);

      if (Object.keys(overrides).length > 0) {
        nextPolicyByRole[role] = overrides;
      }
    });

    if (normalizedPageId && Object.keys(nextPolicyByRole).length > 0) {
      pagePolicies[normalizedPageId] = nextPolicyByRole;
    }
  });

  return {
    version: 1,
    pagePolicies,
  };
};

export const resolveCanvasAccessRolePolicies = (
  store: CanvasAccessRolePolicyStore,
  pageId: string
): Record<CanvasAccessRole, CanvasAccessRolePolicy> => {
  const normalizedStore = normalizeCanvasAccessRolePolicyStore(store);
  const pageOverrides = normalizedStore.pagePolicies[String(pageId || '').trim()] || {};

  return canvasAccessRoles.reduce(
    (accumulator, role) => {
      accumulator[role] = normalizeCanvasAccessRolePolicy(role, {
        ...defaultCanvasAccessRolePolicies[role],
        ...(pageOverrides[role] || {}),
      });
      return accumulator;
    },
    {} as Record<CanvasAccessRole, CanvasAccessRolePolicy>
  );
};

export const updateCanvasAccessRolePolicyStoreOverride = (
  store: CanvasAccessRolePolicyStore,
  {
    pageId,
    role,
    patch,
  }: {
    pageId: string;
    role: CanvasAccessRole;
    patch: Partial<CanvasAccessRolePolicy>;
  }
): CanvasAccessRolePolicyStore => {
  const normalizedStore = normalizeCanvasAccessRolePolicyStore(store);
  const normalizedPageId = pageId.trim();

  if (!normalizedPageId) {
    return normalizedStore;
  }

  const normalizedPolicy = normalizeCanvasAccessRolePolicy(role, {
    ...(normalizedStore.pagePolicies[normalizedPageId]?.[role] || {}),
    ...patch,
  });

  return {
    ...normalizedStore,
    pagePolicies: {
      ...normalizedStore.pagePolicies,
      [normalizedPageId]: {
        ...(normalizedStore.pagePolicies[normalizedPageId] || {}),
        [role]: normalizedPolicy,
      },
    },
  };
};

export const readCanvasAccessRolePolicyStoreFromStorage = () => {
  if (typeof window === 'undefined') {
    return {
      policyStore: createEmptyCanvasAccessRolePolicyStore(),
      hasStoredPolicies: false,
    };
  }

  try {
    const rawValue = window.localStorage.getItem(CANVAS_ACCESS_ROLE_POLICY_STORAGE_KEY);

    if (!rawValue) {
      return {
        policyStore: createEmptyCanvasAccessRolePolicyStore(),
        hasStoredPolicies: false,
      };
    }

    return {
      policyStore: normalizeCanvasAccessRolePolicyStore(JSON.parse(rawValue)),
      hasStoredPolicies: true,
    };
  } catch {
    window.localStorage.removeItem(CANVAS_ACCESS_ROLE_POLICY_STORAGE_KEY);
    return {
      policyStore: createEmptyCanvasAccessRolePolicyStore(),
      hasStoredPolicies: false,
    };
  }
};

export const saveCanvasAccessRolePolicyStoreToStorage = (store: CanvasAccessRolePolicyStore) => {
  const nextStore = normalizeCanvasAccessRolePolicyStore(store);
  window.localStorage.setItem(CANVAS_ACCESS_ROLE_POLICY_STORAGE_KEY, JSON.stringify(nextStore));
  window.dispatchEvent(new CustomEvent(CANVAS_ACCESS_ROLE_POLICY_EVENT_NAME, { detail: nextStore }));
  return nextStore;
};

export const useStoredCanvasAccessRolePolicies = (pageId: string) => {
  const [state, setState] = React.useState(() => {
    const { policyStore, hasStoredPolicies } = readCanvasAccessRolePolicyStoreFromStorage();
    return {
      policyStore,
      policies: resolveCanvasAccessRolePolicies(policyStore, pageId),
      hasStoredPolicies,
      loaded: false,
    };
  });

  React.useEffect(() => {
    const readNextState = () => {
      const { policyStore, hasStoredPolicies } = readCanvasAccessRolePolicyStoreFromStorage();
      setState({
        policyStore,
        policies: resolveCanvasAccessRolePolicies(policyStore, pageId),
        hasStoredPolicies,
        loaded: true,
      });
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CANVAS_ACCESS_ROLE_POLICY_STORAGE_KEY) {
        readNextState();
      }
    };

    readNextState();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CANVAS_ACCESS_ROLE_POLICY_EVENT_NAME, readNextState);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CANVAS_ACCESS_ROLE_POLICY_EVENT_NAME, readNextState);
    };
  }, [pageId]);

  return state;
};

export const mapMemberDocumentAccessRoleToCanvasAccessRole = (
  role: MemberDocumentEffectiveAccessRole
): CanvasAccessRole => {
  if (role === 'editor') {
    return 'editor';
  }

  if (role === 'signer') {
    return 'signer';
  }

  return 'viewer';
};

export const resolveEffectiveCanvasAccessMode = (
  role: CanvasAccessRole,
  policy: CanvasAccessRolePolicy
): CanvasAccessMode => (role === 'editor' && policy.accessMode === 'edit' ? 'edit' : 'view');
