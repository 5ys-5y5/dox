'use client';

import * as React from 'react';
import type { DocumentsOwnerSurface } from './documentOwnerTypes';

export type DocumentsOwnerDocumentSelectionMode = 'picker' | 'host';

export type DocumentsOwnerSettings = {
  documentSelectionMode: DocumentsOwnerDocumentSelectionMode;
  showCurrentWorkPanel: boolean;
  showRequestStepBoxAssignee: boolean;
  showRequestStepPhoto: boolean;
  showRequestStepFile: boolean;
  showRequestStepExpiration: boolean;
  showHistoryPanel: boolean;
  applyStoredCanvasOwnerSettings: boolean;
};

export type DocumentsOwnerSettingKey = keyof DocumentsOwnerSettings;

export type DocumentsOwnerSettingsStore = {
  version: 1;
  surfaceSettings: Partial<Record<DocumentsOwnerSurface, Partial<DocumentsOwnerSettings>>>;
};

export const documentsOwnerManagedSurfaces: Array<{
  surface: DocumentsOwnerSurface;
  label: string;
  path: string;
}> = [
  { surface: 'documents', label: '문서 관리', path: '/documents' },
  { surface: 'project', label: '현장 관리', path: '/project' },
];

export const defaultDocumentsOwnerSettings: DocumentsOwnerSettings = {
  documentSelectionMode: 'picker',
  showCurrentWorkPanel: true,
  showRequestStepBoxAssignee: true,
  showRequestStepPhoto: true,
  showRequestStepFile: true,
  showRequestStepExpiration: true,
  showHistoryPanel: true,
  applyStoredCanvasOwnerSettings: true,
};

const getDefaultDocumentsOwnerSettingsForSurface = (surface: DocumentsOwnerSurface): DocumentsOwnerSettings => ({
  ...defaultDocumentsOwnerSettings,
  documentSelectionMode: surface === 'project' ? 'host' : defaultDocumentsOwnerSettings.documentSelectionMode,
});

const DOCUMENTS_OWNER_SETTINGS_STORAGE_KEY = 'documents.owner.settings.v1';
const DOCUMENTS_OWNER_SETTINGS_EVENT_NAME = 'documents:owner-settings-changed';
const documentsOwnerSurfaces = documentsOwnerManagedSurfaces.map((item) => item.surface);
const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

export const createEmptyDocumentsOwnerSettingsStore = (): DocumentsOwnerSettingsStore => ({
  version: 1,
  surfaceSettings: {},
});

const normalizeDocumentsOwnerSettingsOverrides = (value: unknown): Partial<DocumentsOwnerSettings> => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<DocumentsOwnerSettings>)
      : {};
  const overrides: Partial<DocumentsOwnerSettings> = {};

  if (hasOwn(candidate, 'documentSelectionMode')) {
    overrides.documentSelectionMode = candidate.documentSelectionMode === 'host' ? 'host' : 'picker';
  }

  if (hasOwn(candidate, 'showCurrentWorkPanel')) {
    overrides.showCurrentWorkPanel = candidate.showCurrentWorkPanel === true;
  }

  if (hasOwn(candidate, 'showRequestStepBoxAssignee')) {
    overrides.showRequestStepBoxAssignee = candidate.showRequestStepBoxAssignee === true;
  }

  if (hasOwn(candidate, 'showRequestStepPhoto')) {
    overrides.showRequestStepPhoto = candidate.showRequestStepPhoto === true;
  }

  if (hasOwn(candidate, 'showRequestStepFile')) {
    overrides.showRequestStepFile = candidate.showRequestStepFile === true;
  }

  if (hasOwn(candidate, 'showRequestStepExpiration')) {
    overrides.showRequestStepExpiration = candidate.showRequestStepExpiration === true;
  }

  if (hasOwn(candidate, 'showHistoryPanel')) {
    overrides.showHistoryPanel = candidate.showHistoryPanel === true;
  }

  if (hasOwn(candidate, 'applyStoredCanvasOwnerSettings')) {
    overrides.applyStoredCanvasOwnerSettings = candidate.applyStoredCanvasOwnerSettings === true;
  }

  return overrides;
};

export const normalizeDocumentsOwnerSettingsStore = (value: unknown): DocumentsOwnerSettingsStore => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { surfaceSettings?: unknown })
      : {};
  const surfaceSettingsCandidate =
    candidate.surfaceSettings && typeof candidate.surfaceSettings === 'object' && !Array.isArray(candidate.surfaceSettings)
      ? (candidate.surfaceSettings as Record<string, unknown>)
      : {};
  const surfaceSettings: DocumentsOwnerSettingsStore['surfaceSettings'] = {};

  documentsOwnerSurfaces.forEach((surface) => {
    const overrides = normalizeDocumentsOwnerSettingsOverrides(surfaceSettingsCandidate[surface]);

    if (Object.keys(overrides).length > 0) {
      surfaceSettings[surface] = overrides;
    }
  });

  return {
    version: 1,
    surfaceSettings,
  };
};

export const resolveDocumentsOwnerSettings = (
  store: DocumentsOwnerSettingsStore,
  surface: DocumentsOwnerSurface
): DocumentsOwnerSettings => {
  const normalizedStore = normalizeDocumentsOwnerSettingsStore(store);
  const surfaceOverrides = normalizedStore.surfaceSettings[surface] || {};

  return {
    ...getDefaultDocumentsOwnerSettingsForSurface(surface),
    ...surfaceOverrides,
  };
};

const readDefaultDocumentsOwnerSettingsStore = () => {
  const settingsStore = createEmptyDocumentsOwnerSettingsStore();

  return {
    settingsStore,
    hasStoredSettings: false,
  };
};

export const readDocumentsOwnerSettingsStoreFromStorage = () => {
  if (typeof window === 'undefined') {
    return readDefaultDocumentsOwnerSettingsStore();
  }

  try {
    const rawSettings = window.localStorage.getItem(DOCUMENTS_OWNER_SETTINGS_STORAGE_KEY);

    if (!rawSettings) {
      return readDefaultDocumentsOwnerSettingsStore();
    }

    return {
      settingsStore: normalizeDocumentsOwnerSettingsStore(JSON.parse(rawSettings)),
      hasStoredSettings: true,
    };
  } catch {
    window.localStorage.removeItem(DOCUMENTS_OWNER_SETTINGS_STORAGE_KEY);
    return readDefaultDocumentsOwnerSettingsStore();
  }
};

export const saveDocumentsOwnerSettingsStoreToStorage = (settingsStore: DocumentsOwnerSettingsStore) => {
  const nextSettingsStore = normalizeDocumentsOwnerSettingsStore(settingsStore);
  window.localStorage.setItem(DOCUMENTS_OWNER_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettingsStore));
  window.dispatchEvent(new CustomEvent(DOCUMENTS_OWNER_SETTINGS_EVENT_NAME, { detail: nextSettingsStore }));
  return nextSettingsStore;
};

export const updateDocumentsOwnerSettingsStoreOverride = <K extends DocumentsOwnerSettingKey>(
  store: DocumentsOwnerSettingsStore,
  {
    surface,
    key,
    value,
  }: {
    surface: DocumentsOwnerSurface;
    key: K;
    value: DocumentsOwnerSettings[K];
  }
): DocumentsOwnerSettingsStore => {
  const normalizedStore = normalizeDocumentsOwnerSettingsStore(store);

  return {
    ...normalizedStore,
    surfaceSettings: {
      ...normalizedStore.surfaceSettings,
      [surface]: {
        ...(normalizedStore.surfaceSettings[surface] || {}),
        [key]: value,
      },
    },
  };
};

export const useDocumentsOwnerSettings = () => {
  const [state, setState] = React.useState(() => ({
    ...readDefaultDocumentsOwnerSettingsStore(),
    loaded: false,
  }));

  React.useEffect(() => {
    setState({
      ...readDocumentsOwnerSettingsStoreFromStorage(),
      loaded: true,
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== DOCUMENTS_OWNER_SETTINGS_STORAGE_KEY) {
        return;
      }

      setState({
        ...readDocumentsOwnerSettingsStoreFromStorage(),
        loaded: true,
      });
    };

    const handleSettingsEvent = () => {
      setState({
        ...readDocumentsOwnerSettingsStoreFromStorage(),
        loaded: true,
      });
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(DOCUMENTS_OWNER_SETTINGS_EVENT_NAME, handleSettingsEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(DOCUMENTS_OWNER_SETTINGS_EVENT_NAME, handleSettingsEvent);
    };
  }, []);

  const updateSurfaceSetting = React.useCallback(
    <K extends DocumentsOwnerSettingKey>(
      surface: DocumentsOwnerSurface,
      key: K,
      value: DocumentsOwnerSettings[K]
    ) => {
      setState((current) => {
        const nextSettingsStore = saveDocumentsOwnerSettingsStoreToStorage(
          updateDocumentsOwnerSettingsStoreOverride(current.settingsStore, { surface, key, value })
        );

        return {
          settingsStore: nextSettingsStore,
          hasStoredSettings: true,
          loaded: true,
        };
      });
    },
    []
  );

  const resolveSurfaceSettings = React.useCallback(
    (surface: DocumentsOwnerSurface) => resolveDocumentsOwnerSettings(state.settingsStore, surface),
    [state.settingsStore]
  );

  return {
    ...state,
    resolveSurfaceSettings,
    updateSurfaceSetting,
  };
};
