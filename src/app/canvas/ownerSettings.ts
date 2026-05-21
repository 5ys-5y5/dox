'use client';

import * as React from 'react';
import type {
  TemplateEditWorkspaceCanvasToolbarVisibility,
  TemplateEditWorkspacePersistenceVisibility,
  TemplateEditWorkspaceProps,
} from '../../components/template/workspace/types';

export type CanvasWorkspaceMode = NonNullable<TemplateEditWorkspaceProps['workspaceMode']>;

export type CanvasOwnerSettings = {
  hideHeader: boolean;
  hidePersistencePanel: boolean;
  templateListDisplay: 'picker' | 'inline';
  showTopNotice: boolean;
  showWorkspaceMessages: boolean;
  showAdditionalControlPanels: boolean;
  showCanvasTitle: boolean;
  showCanvasNameField: boolean;
  showCanvasSaveButton: boolean;
  showCanvasPreviewToggle: boolean;
  showCanvasInteractionModeControls: boolean;
  showCanvasHistoryControls: boolean;
  showCanvasZoomControls: boolean;
  showCanvasFullscreenControl: boolean;
  defaultCanvasFullscreen: boolean;
  pageContainerWidth: string;
  pageContainerHeight: string;
  autoCanvasHeight: boolean;
  autoCanvasWidth: boolean;
  useSpecifiedCanvasHeight: boolean;
  specifiedCanvasHeight: string;
  specifiedCanvasWidth: string;
  showCanvasEditSettingsToggle: boolean;
  showCanvasSelectionPanelTabs: boolean;
  showPersistenceTemplateList: boolean;
  showPersistenceTemplateNameField: boolean;
  showPersistenceLayoutResizeModeField: boolean;
  showPersistenceSourceDocumentNameField: boolean;
  showPersistenceSaveButton: boolean;
  suppressInitialDraftLoadedMessage: boolean;
  headerTitle: string;
  headerDescription: string;
  nameFieldLabel: string;
  saveButtonLabel: string;
  templateNameReadOnly: boolean;
  saveDisabled: boolean;
  enableDocumentAttachmentApiPath: boolean;
  limitEditableValueKeys: boolean;
  enableOnTemplateSaved: boolean;
  stabilizeInitialLayout: boolean;
  enableRuntimeInitialAutoSize: boolean;
  preventInitialValueClearShrink: boolean;
  preventRuntimeAutoSizeShrink: boolean;
  blockPeerClusterHeightTargets: boolean;
  blockPeerClusterWidthTargets: boolean;
};

export type CanvasOwnerSettingKey = keyof CanvasOwnerSettings;
export type CanvasOwnerSettingSource = 'default' | 'mode' | 'page';
export type CanvasOwnerSettingsOverrides = Partial<CanvasOwnerSettings>;
export type CanvasOwnerSettingsStore = {
  version: 2;
  modeSettings: Partial<Record<CanvasWorkspaceMode, CanvasOwnerSettingsOverrides>>;
  pageSettings: Record<string, Partial<Record<CanvasWorkspaceMode, CanvasOwnerSettingsOverrides>>>;
};
export type CanvasOwnerSettingsContext = {
  pageId?: string;
  workspaceMode: CanvasWorkspaceMode;
};

export const defaultCanvasOwnerSettings: CanvasOwnerSettings = {
  hideHeader: true,
  hidePersistencePanel: false,
  templateListDisplay: 'inline',
  showTopNotice: false,
  showWorkspaceMessages: true,
  showAdditionalControlPanels: false,
  showCanvasTitle: true,
  showCanvasNameField: true,
  showCanvasSaveButton: true,
  showCanvasPreviewToggle: true,
  showCanvasInteractionModeControls: true,
  showCanvasHistoryControls: true,
  showCanvasZoomControls: true,
  showCanvasFullscreenControl: true,
  defaultCanvasFullscreen: false,
  pageContainerWidth: '100%',
  pageContainerHeight: '',
  autoCanvasHeight: true,
  autoCanvasWidth: true,
  useSpecifiedCanvasHeight: false,
  specifiedCanvasHeight: '70vh',
  specifiedCanvasWidth: '100%',
  showCanvasEditSettingsToggle: true,
  showCanvasSelectionPanelTabs: true,
  showPersistenceTemplateList: true,
  showPersistenceTemplateNameField: true,
  showPersistenceLayoutResizeModeField: true,
  showPersistenceSourceDocumentNameField: true,
  showPersistenceSaveButton: true,
  suppressInitialDraftLoadedMessage: true,
  headerTitle: '상자 편집 캔버스',
  headerDescription: '공용 캔버스 owner 경로입니다.',
  nameFieldLabel: '문서 이름:',
  saveButtonLabel: '문서 저장',
  templateNameReadOnly: true,
  saveDisabled: false,
  enableDocumentAttachmentApiPath: true,
  limitEditableValueKeys: false,
  enableOnTemplateSaved: true,
  stabilizeInitialLayout: true,
  enableRuntimeInitialAutoSize: true,
  preventInitialValueClearShrink: true,
  preventRuntimeAutoSizeShrink: false,
  blockPeerClusterHeightTargets: false,
  blockPeerClusterWidthTargets: false,
};

export const CANVAS_OWNER_SETTINGS_STORAGE_KEY = 'mejai.canvas.ownerSettings.v1';
const CANVAS_OWNER_SETTINGS_EVENT_NAME = 'mejai:canvas-owner-settings-changed';
export const canvasOwnerSettingKeys = Object.keys(defaultCanvasOwnerSettings) as CanvasOwnerSettingKey[];
const canvasWorkspaceModes: CanvasWorkspaceMode[] = ['template', 'document', 'read'];
const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const normalizeCanvasCssSizeSetting = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim().slice(0, 80) : fallback;

export const normalizeCanvasWorkspaceMode = (value: string | null | undefined): CanvasWorkspaceMode => {
  if (value === 'document' || value === 'read') {
    return value;
  }

  return 'template';
};

export const normalizeCanvasOwnerSettings = (value: unknown): CanvasOwnerSettings => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CanvasOwnerSettings>)
      : {};
  const legacyUseSpecifiedCanvasHeight = hasOwn(candidate, 'useSpecifiedCanvasHeight')
    ? candidate.useSpecifiedCanvasHeight === true
    : false;
  const legacyPageContainerWidth = normalizeCanvasCssSizeSetting(candidate.pageContainerWidth);
  const resolvedAutoCanvasHeight =
    typeof candidate.autoCanvasHeight === 'boolean' ? candidate.autoCanvasHeight : !legacyUseSpecifiedCanvasHeight;
  const resolvedAutoCanvasWidth =
    typeof candidate.autoCanvasWidth === 'boolean'
      ? candidate.autoCanvasWidth
      : !(legacyPageContainerWidth && legacyPageContainerWidth !== defaultCanvasOwnerSettings.pageContainerWidth);

  return {
    ...defaultCanvasOwnerSettings,
    ...candidate,
    autoCanvasHeight: resolvedAutoCanvasHeight,
    autoCanvasWidth: resolvedAutoCanvasWidth,
    useSpecifiedCanvasHeight: !resolvedAutoCanvasHeight,
    pageContainerWidth: normalizeCanvasCssSizeSetting(
      candidate.pageContainerWidth,
      defaultCanvasOwnerSettings.pageContainerWidth
    ),
    pageContainerHeight: normalizeCanvasCssSizeSetting(
      candidate.pageContainerHeight,
      defaultCanvasOwnerSettings.pageContainerHeight
    ),
    specifiedCanvasHeight: normalizeCanvasCssSizeSetting(
      candidate.specifiedCanvasHeight,
      defaultCanvasOwnerSettings.specifiedCanvasHeight
    ),
    specifiedCanvasWidth: normalizeCanvasCssSizeSetting(
      candidate.specifiedCanvasWidth,
      legacyPageContainerWidth || defaultCanvasOwnerSettings.specifiedCanvasWidth
    ),
    templateListDisplay:
      candidate.templateListDisplay === 'picker' || candidate.templateListDisplay === 'inline'
        ? candidate.templateListDisplay
        : defaultCanvasOwnerSettings.templateListDisplay,
  };
};

export const createEmptyCanvasOwnerSettingsStore = (): CanvasOwnerSettingsStore => ({
  version: 2,
  modeSettings: {},
  pageSettings: {},
});

export const normalizeCanvasOwnerSettingsOverrides = (value: unknown): CanvasOwnerSettingsOverrides => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CanvasOwnerSettings>)
      : {};
  const normalizedSettings = normalizeCanvasOwnerSettings(candidate);
  const normalizedOverrides: CanvasOwnerSettingsOverrides = {};

  canvasOwnerSettingKeys.forEach((key) => {
    if (hasOwn(candidate, key)) {
      normalizedOverrides[key] = normalizedSettings[key] as never;
    }
  });

  if (hasOwn(candidate, 'useSpecifiedCanvasHeight') && !hasOwn(candidate, 'autoCanvasHeight')) {
    normalizedOverrides.autoCanvasHeight = !normalizedSettings.useSpecifiedCanvasHeight;
  }

  if (hasOwn(candidate, 'pageContainerWidth') && !hasOwn(candidate, 'autoCanvasWidth')) {
    const legacyWidth = normalizeCanvasCssSizeSetting(candidate.pageContainerWidth);

    if (legacyWidth && legacyWidth !== defaultCanvasOwnerSettings.pageContainerWidth) {
      normalizedOverrides.autoCanvasWidth = false;
      if (!hasOwn(candidate, 'specifiedCanvasWidth')) {
        normalizedOverrides.specifiedCanvasWidth = legacyWidth;
      }
    }
  }

  return normalizedOverrides;
};

export const normalizeCanvasOwnerSettingsStore = (value: unknown): CanvasOwnerSettingsStore => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as {
          modeSettings?: unknown;
          pageSettings?: unknown;
        })
      : null;

  if (!candidate || (!candidate.modeSettings && !candidate.pageSettings)) {
    const legacyOverrides = normalizeCanvasOwnerSettingsOverrides(value);

    if (Object.keys(legacyOverrides).length === 0) {
      return createEmptyCanvasOwnerSettingsStore();
    }

    return {
      version: 2,
      modeSettings: {
        template: { ...legacyOverrides },
        document: { ...legacyOverrides },
        read: { ...legacyOverrides },
      },
      pageSettings: {},
    };
  }

  const modeSettingsCandidate =
    candidate.modeSettings && typeof candidate.modeSettings === 'object' && !Array.isArray(candidate.modeSettings)
      ? (candidate.modeSettings as Record<string, unknown>)
      : {};
  const pageSettingsCandidate =
    candidate.pageSettings && typeof candidate.pageSettings === 'object' && !Array.isArray(candidate.pageSettings)
      ? (candidate.pageSettings as Record<string, unknown>)
      : {};
  const modeSettings: CanvasOwnerSettingsStore['modeSettings'] = {};
  const pageSettings: CanvasOwnerSettingsStore['pageSettings'] = {};

  canvasWorkspaceModes.forEach((mode) => {
    const overrides = normalizeCanvasOwnerSettingsOverrides(modeSettingsCandidate[mode]);

    if (Object.keys(overrides).length > 0) {
      modeSettings[mode] = overrides;
    }
  });

  Object.entries(pageSettingsCandidate).forEach(([pageId, rawPageSettings]) => {
    if (!rawPageSettings || typeof rawPageSettings !== 'object' || Array.isArray(rawPageSettings)) {
      return;
    }

    const normalizedPageSettings: Partial<Record<CanvasWorkspaceMode, CanvasOwnerSettingsOverrides>> = {};
    const pageModeSettings = rawPageSettings as Record<string, unknown>;

    canvasWorkspaceModes.forEach((mode) => {
      const overrides = normalizeCanvasOwnerSettingsOverrides(pageModeSettings[mode]);

      if (Object.keys(overrides).length > 0) {
        normalizedPageSettings[mode] = overrides;
      }
    });

    if (Object.keys(normalizedPageSettings).length > 0) {
      pageSettings[pageId] = normalizedPageSettings;
    }
  });

  return {
    version: 2,
    modeSettings,
    pageSettings,
  };
};

export const resolveCanvasOwnerSettings = (
  store: CanvasOwnerSettingsStore,
  context: CanvasOwnerSettingsContext
) => {
  const workspaceMode = normalizeCanvasWorkspaceMode(context.workspaceMode);
  const modeOverrides = store.modeSettings[workspaceMode] || {};
  const pageOverrides = context.pageId ? store.pageSettings[context.pageId]?.[workspaceMode] || {} : {};
  const settings = normalizeCanvasOwnerSettings({
    ...defaultCanvasOwnerSettings,
    ...modeOverrides,
    ...pageOverrides,
  });
  const sources = canvasOwnerSettingKeys.reduce(
    (accumulator, key) => {
      accumulator[key] = 'default';
      return accumulator;
    },
    {} as Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>
  );

  Object.keys(modeOverrides).forEach((key) => {
    sources[key as CanvasOwnerSettingKey] = 'mode';
  });
  Object.keys(pageOverrides).forEach((key) => {
    sources[key as CanvasOwnerSettingKey] = 'page';
  });

  return {
    settings,
    sources,
    modeOverrides,
    pageOverrides,
    workspaceMode,
  };
};

export const updateCanvasOwnerSettingsStoreOverride = <K extends CanvasOwnerSettingKey>(
  store: CanvasOwnerSettingsStore,
  {
    scope,
    pageId,
    workspaceMode,
    key,
    value,
  }: {
    scope: 'mode' | 'page';
    pageId?: string;
    workspaceMode: CanvasWorkspaceMode;
    key: K;
    value: CanvasOwnerSettings[K];
  }
): CanvasOwnerSettingsStore => {
  const normalizedStore = normalizeCanvasOwnerSettingsStore(store);
  const normalizedMode = normalizeCanvasWorkspaceMode(workspaceMode);

  if (scope === 'mode') {
    return {
      ...normalizedStore,
      modeSettings: {
        ...normalizedStore.modeSettings,
        [normalizedMode]: {
          ...(normalizedStore.modeSettings[normalizedMode] || {}),
          [key]: value,
        },
      },
    };
  }

  const normalizedPageId = String(pageId || '').trim();

  if (!normalizedPageId) {
    return normalizedStore;
  }

  return {
    ...normalizedStore,
    pageSettings: {
      ...normalizedStore.pageSettings,
      [normalizedPageId]: {
        ...(normalizedStore.pageSettings[normalizedPageId] || {}),
        [normalizedMode]: {
          ...(normalizedStore.pageSettings[normalizedPageId]?.[normalizedMode] || {}),
          [key]: value,
        },
      },
    },
  };
};

export const readCanvasOwnerSettingsFromStorage = (
  context: CanvasOwnerSettingsContext = { pageId: 'canvas', workspaceMode: 'template' }
) => {
  if (typeof window === 'undefined') {
    const settingsStore = createEmptyCanvasOwnerSettingsStore();
    const resolvedSettings = resolveCanvasOwnerSettings(settingsStore, context);

    return {
      ...resolvedSettings,
      settingsStore,
      hasStoredSettings: false,
    };
  }

  try {
    const rawSettings = window.localStorage.getItem(CANVAS_OWNER_SETTINGS_STORAGE_KEY);

    if (!rawSettings) {
      const settingsStore = createEmptyCanvasOwnerSettingsStore();
      const resolvedSettings = resolveCanvasOwnerSettings(settingsStore, context);

      return {
        ...resolvedSettings,
        settingsStore,
        hasStoredSettings: false,
      };
    }

    const settingsStore = normalizeCanvasOwnerSettingsStore(JSON.parse(rawSettings));
    const resolvedSettings = resolveCanvasOwnerSettings(settingsStore, context);

    return {
      ...resolvedSettings,
      settingsStore,
      hasStoredSettings: true,
    };
  } catch {
    window.localStorage.removeItem(CANVAS_OWNER_SETTINGS_STORAGE_KEY);
    const settingsStore = createEmptyCanvasOwnerSettingsStore();
    const resolvedSettings = resolveCanvasOwnerSettings(settingsStore, context);

    return {
      ...resolvedSettings,
      settingsStore,
      hasStoredSettings: false,
    };
  }
};

export const saveCanvasOwnerSettingsStoreToStorage = (settingsStore: CanvasOwnerSettingsStore) => {
  const nextSettingsStore = normalizeCanvasOwnerSettingsStore(settingsStore);
  window.localStorage.setItem(CANVAS_OWNER_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettingsStore));
  window.dispatchEvent(new CustomEvent(CANVAS_OWNER_SETTINGS_EVENT_NAME, { detail: nextSettingsStore }));
  return nextSettingsStore;
};

export const saveCanvasOwnerSettingsToStorage = (settings: CanvasOwnerSettings) => {
  const overrides = normalizeCanvasOwnerSettingsOverrides(settings);
  const nextSettingsStore: CanvasOwnerSettingsStore = {
    version: 2,
    modeSettings: {
      template: { ...overrides },
      document: { ...overrides },
      read: { ...overrides },
    },
    pageSettings: {},
  };

  return saveCanvasOwnerSettingsStoreToStorage(nextSettingsStore);
};

export const useStoredCanvasOwnerSettings = (
  context: CanvasOwnerSettingsContext = { pageId: 'canvas', workspaceMode: 'template' }
) => {
  const [state, setState] = React.useState(() => ({
    ...readCanvasOwnerSettingsFromStorage(context),
    loaded: false,
  }));

  React.useEffect(() => {
    setState({
      ...readCanvasOwnerSettingsFromStorage(context),
      loaded: true,
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CANVAS_OWNER_SETTINGS_STORAGE_KEY) {
        return;
      }

      setState({
        ...readCanvasOwnerSettingsFromStorage(context),
        loaded: true,
      });
    };

    const handleSettingsEvent = () => {
      setState({
        ...readCanvasOwnerSettingsFromStorage(context),
        loaded: true,
      });
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CANVAS_OWNER_SETTINGS_EVENT_NAME, handleSettingsEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CANVAS_OWNER_SETTINGS_EVENT_NAME, handleSettingsEvent);
    };
  }, [context.pageId, context.workspaceMode]);

  return state;
};

export const buildCanvasToolbarVisibility = (
  settings: CanvasOwnerSettings,
  workspaceMode: CanvasWorkspaceMode
): TemplateEditWorkspaceCanvasToolbarVisibility => ({
  showCanvasTitle: settings.showCanvasTitle,
  showTemplateNameInput: settings.showCanvasNameField && workspaceMode === 'template',
  showSaveButton: settings.showCanvasSaveButton && workspaceMode !== 'read',
  showPreviewToggle: settings.showCanvasPreviewToggle && workspaceMode === 'template',
  showInteractionModeControls: settings.showCanvasInteractionModeControls && workspaceMode === 'template',
  showHistoryControls: settings.showCanvasHistoryControls && workspaceMode !== 'read',
  showZoomControls: settings.showCanvasZoomControls,
  showFullscreenControl: settings.showCanvasFullscreenControl,
  showEditSettingsToggle: settings.showCanvasEditSettingsToggle && workspaceMode === 'template',
  showSelectionPanelTabs: settings.showCanvasSelectionPanelTabs && workspaceMode === 'template',
});

export const buildPersistenceVisibility = (
  settings: CanvasOwnerSettings
): TemplateEditWorkspacePersistenceVisibility => ({
  showTemplateList: settings.showPersistenceTemplateList,
  showTemplateNameInput: settings.showPersistenceTemplateNameField,
  showLayoutResizeModeSelect: settings.showPersistenceLayoutResizeModeField,
  showSourceDocumentNameInput: settings.showPersistenceSourceDocumentNameField,
  showSaveButton: settings.showPersistenceSaveButton,
});

export const buildTemplateUsagePreviewLayoutDebugOptions = (settings: CanvasOwnerSettings) => ({
  stabilizeInitialLayout: settings.stabilizeInitialLayout,
  enableInitialAutoSize: settings.enableRuntimeInitialAutoSize,
  preventInitialValueClearShrink: settings.preventInitialValueClearShrink,
  preventRuntimeAutoSizeShrink: settings.preventRuntimeAutoSizeShrink,
  measurePeerClusterHeightTargets: !settings.blockPeerClusterHeightTargets,
  measurePeerClusterWidthTargets: !settings.blockPeerClusterWidthTargets,
});

export const applyCanvasOwnerSettingsToWorkspaceProps = ({
  baseProps,
  settings,
  settingSources,
  workspaceMode,
}: {
  baseProps: TemplateEditWorkspaceProps;
  settings: CanvasOwnerSettings;
  settingSources?: Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>;
  workspaceMode: CanvasWorkspaceMode;
}): TemplateEditWorkspaceProps => {
  const normalizedWorkspaceMode = normalizeCanvasWorkspaceMode(workspaceMode);
  const shouldApplySetting = (key: CanvasOwnerSettingKey) => !settingSources || settingSources[key] !== 'default';
  const headerTitle = settings.headerTitle.trim() || baseProps.headerTitle;
  const headerDescription = settings.headerDescription.trim() || baseProps.headerDescription;
  const nameFieldLabel = settings.nameFieldLabel.trim() || baseProps.nameFieldLabel;
  const saveButtonLabel = settings.saveButtonLabel.trim() || baseProps.saveButtonLabel;
  const pageContainerWidth = normalizeCanvasCssSizeSetting(settings.pageContainerWidth);
  const pageContainerHeight = normalizeCanvasCssSizeSetting(settings.pageContainerHeight);
  const specifiedCanvasHeight = normalizeCanvasCssSizeSetting(settings.specifiedCanvasHeight, '70vh') || '70vh';
  const specifiedCanvasWidth = normalizeCanvasCssSizeSetting(settings.specifiedCanvasWidth, '100%') || '100%';
  const canvasToolbarVisibility = {
    ...(baseProps.canvasToolbarVisibility || {}),
  } as TemplateEditWorkspaceCanvasToolbarVisibility;
  const persistenceVisibility = {
    ...(baseProps.persistenceVisibility || {}),
  } as TemplateEditWorkspacePersistenceVisibility;
  const templateUsagePreviewLayoutDebugOptions = {
    ...(baseProps.templateUsagePreviewLayoutDebugOptions || {}),
  };

  if (shouldApplySetting('showCanvasTitle')) {
    canvasToolbarVisibility.showCanvasTitle = settings.showCanvasTitle;
  }
  if (shouldApplySetting('showCanvasNameField')) {
    canvasToolbarVisibility.showTemplateNameInput = settings.showCanvasNameField && normalizedWorkspaceMode === 'template';
  }
  if (shouldApplySetting('showCanvasSaveButton')) {
    canvasToolbarVisibility.showSaveButton = settings.showCanvasSaveButton && normalizedWorkspaceMode !== 'read';
  }
  if (shouldApplySetting('showCanvasPreviewToggle')) {
    canvasToolbarVisibility.showPreviewToggle = settings.showCanvasPreviewToggle && normalizedWorkspaceMode === 'template';
  }
  if (shouldApplySetting('showCanvasInteractionModeControls')) {
    canvasToolbarVisibility.showInteractionModeControls =
      settings.showCanvasInteractionModeControls && normalizedWorkspaceMode === 'template';
  }
  if (shouldApplySetting('showCanvasHistoryControls')) {
    canvasToolbarVisibility.showHistoryControls = settings.showCanvasHistoryControls && normalizedWorkspaceMode !== 'read';
  }
  if (shouldApplySetting('showCanvasZoomControls')) {
    canvasToolbarVisibility.showZoomControls = settings.showCanvasZoomControls;
  }
  if (shouldApplySetting('showCanvasFullscreenControl')) {
    canvasToolbarVisibility.showFullscreenControl = settings.showCanvasFullscreenControl;
  }
  if (shouldApplySetting('showCanvasEditSettingsToggle')) {
    canvasToolbarVisibility.showEditSettingsToggle =
      settings.showCanvasEditSettingsToggle && normalizedWorkspaceMode === 'template';
  }
  if (shouldApplySetting('showCanvasSelectionPanelTabs')) {
    canvasToolbarVisibility.showSelectionPanelTabs =
      settings.showCanvasSelectionPanelTabs && normalizedWorkspaceMode === 'template';
  }
  if (shouldApplySetting('showPersistenceTemplateList')) {
    persistenceVisibility.showTemplateList = settings.showPersistenceTemplateList;
  }
  if (shouldApplySetting('showPersistenceTemplateNameField')) {
    persistenceVisibility.showTemplateNameInput = settings.showPersistenceTemplateNameField;
  }
  if (shouldApplySetting('showPersistenceLayoutResizeModeField')) {
    persistenceVisibility.showLayoutResizeModeSelect = settings.showPersistenceLayoutResizeModeField;
  }
  if (shouldApplySetting('showPersistenceSourceDocumentNameField')) {
    persistenceVisibility.showSourceDocumentNameInput = settings.showPersistenceSourceDocumentNameField;
  }
  if (shouldApplySetting('showPersistenceSaveButton')) {
    persistenceVisibility.showSaveButton = settings.showPersistenceSaveButton;
  }
  if (shouldApplySetting('stabilizeInitialLayout')) {
    templateUsagePreviewLayoutDebugOptions.stabilizeInitialLayout = settings.stabilizeInitialLayout;
  }
  if (shouldApplySetting('enableRuntimeInitialAutoSize')) {
    templateUsagePreviewLayoutDebugOptions.enableInitialAutoSize = settings.enableRuntimeInitialAutoSize;
  }
  if (shouldApplySetting('preventInitialValueClearShrink')) {
    templateUsagePreviewLayoutDebugOptions.preventInitialValueClearShrink = settings.preventInitialValueClearShrink;
  }
  if (shouldApplySetting('preventRuntimeAutoSizeShrink')) {
    templateUsagePreviewLayoutDebugOptions.preventRuntimeAutoSizeShrink = settings.preventRuntimeAutoSizeShrink;
  }
  if (shouldApplySetting('blockPeerClusterHeightTargets')) {
    templateUsagePreviewLayoutDebugOptions.measurePeerClusterHeightTargets = !settings.blockPeerClusterHeightTargets;
  }
  if (shouldApplySetting('blockPeerClusterWidthTargets')) {
    templateUsagePreviewLayoutDebugOptions.measurePeerClusterWidthTargets = !settings.blockPeerClusterWidthTargets;
  }

  return {
    ...baseProps,
    hideHeader: shouldApplySetting('hideHeader') ? settings.hideHeader : baseProps.hideHeader,
    hidePersistencePanel: shouldApplySetting('hidePersistencePanel') ? settings.hidePersistencePanel : baseProps.hidePersistencePanel,
    templateListDisplay:
      normalizedWorkspaceMode === 'template'
        ? shouldApplySetting('templateListDisplay')
          ? settings.templateListDisplay
          : baseProps.templateListDisplay
        : undefined,
    showWorkspaceMessages: shouldApplySetting('showWorkspaceMessages') ? settings.showWorkspaceMessages : baseProps.showWorkspaceMessages,
    suppressInitialDraftLoadedMessage: shouldApplySetting('suppressInitialDraftLoadedMessage')
      ? settings.suppressInitialDraftLoadedMessage
      : baseProps.suppressInitialDraftLoadedMessage,
    headerTitle: shouldApplySetting('headerTitle') ? headerTitle : baseProps.headerTitle,
    headerDescription: shouldApplySetting('headerDescription') ? headerDescription : baseProps.headerDescription,
    nameFieldLabel: shouldApplySetting('nameFieldLabel') ? nameFieldLabel : baseProps.nameFieldLabel,
    saveButtonLabel: shouldApplySetting('saveButtonLabel') ? saveButtonLabel : baseProps.saveButtonLabel,
    templateNameReadOnly: shouldApplySetting('templateNameReadOnly')
      ? Boolean(baseProps.templateNameReadOnly || settings.templateNameReadOnly)
      : baseProps.templateNameReadOnly,
    saveDisabled: shouldApplySetting('saveDisabled')
      ? Boolean(baseProps.saveDisabled || normalizedWorkspaceMode === 'read' || settings.saveDisabled)
      : Boolean(baseProps.saveDisabled || normalizedWorkspaceMode === 'read'),
    defaultCanvasFullscreen: shouldApplySetting('defaultCanvasFullscreen')
      ? settings.defaultCanvasFullscreen
      : baseProps.defaultCanvasFullscreen,
    canvasPageContainerWidth: shouldApplySetting('pageContainerWidth')
      ? pageContainerWidth
      : baseProps.canvasPageContainerWidth,
    canvasPageContainerHeight: shouldApplySetting('pageContainerHeight')
      ? pageContainerHeight
      : baseProps.canvasPageContainerHeight,
    canvasSpecifiedHeightEnabled: shouldApplySetting('useSpecifiedCanvasHeight')
      || shouldApplySetting('autoCanvasHeight')
      ? !settings.autoCanvasHeight
      : baseProps.canvasSpecifiedHeightEnabled,
    canvasSpecifiedHeight:
      shouldApplySetting('useSpecifiedCanvasHeight') ||
      shouldApplySetting('autoCanvasHeight') ||
      shouldApplySetting('specifiedCanvasHeight')
        ? specifiedCanvasHeight
        : baseProps.canvasSpecifiedHeight,
    canvasSpecifiedWidthEnabled: shouldApplySetting('autoCanvasWidth') || shouldApplySetting('pageContainerWidth')
      ? !settings.autoCanvasWidth
      : baseProps.canvasSpecifiedWidthEnabled,
    canvasSpecifiedWidth:
      shouldApplySetting('autoCanvasWidth') ||
      shouldApplySetting('specifiedCanvasWidth') ||
      shouldApplySetting('pageContainerWidth')
        ? specifiedCanvasWidth
        : baseProps.canvasSpecifiedWidth,
    documentAttachmentApiPath:
      normalizedWorkspaceMode === 'document' &&
      (!shouldApplySetting('enableDocumentAttachmentApiPath') || settings.enableDocumentAttachmentApiPath !== false)
        ? baseProps.documentAttachmentApiPath
        : '',
    canvasToolbarVisibility,
    persistenceVisibility,
    templateUsagePreviewLayoutDebugOptions,
  };
};
