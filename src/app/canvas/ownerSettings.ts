'use client';

import * as React from 'react';
import type {
  TemplateEditWorkspaceCanvasTab,
  TemplateEditWorkspaceCanvasToolbarVisibility,
  TemplateEditWorkspacePersistenceVisibility,
  TemplateEditWorkspaceProps,
} from '../../components/template/workspace/types';

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
  showCanvasTodoButton: boolean;
  showCanvasPreviewToggle: boolean;
  showCanvasInteractionToolControls: boolean;
  showCanvasHistoryControls: boolean;
  showCanvasZoomControls: boolean;
  showCanvasFullscreenControl: boolean;
  defaultCanvasFullscreen: boolean;
  pageContainerWidth: string;
  pageContainerHeight: string;
  autoCanvasHeight: boolean;
  autoCanvasWidth: boolean;
  specifiedCanvasHeight: string;
  specifiedCanvasWidth: string;
  showCanvasEditSettingsToggle: boolean;
  showCanvasSelectionPanelTabs: boolean;
  showPersistenceTemplateList: boolean;
  showPersistenceTemplateNameField: boolean;
  showPersistenceLayoutResizePolicyField: boolean;
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
  selectionInactiveOverlayOpacity: number;
  initialCanvasTab: TemplateEditWorkspaceCanvasTab;
  allowCanvasBoxSelection: boolean;
};

export type CanvasOwnerSettingKey = keyof CanvasOwnerSettings;
export type CanvasOwnerSettingSource = 'default' | 'page';
export type CanvasOwnerSettingsOverrides = Partial<CanvasOwnerSettings>;
export type CanvasOwnerSettingsStore = {
  version: 7;
  pageSettings: Record<string, CanvasOwnerSettingsOverrides>;
};
export type CanvasOwnerSettingsContext = {
  pageId?: string;
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
  showCanvasTodoButton: true,
  showCanvasPreviewToggle: true,
  showCanvasInteractionToolControls: true,
  showCanvasHistoryControls: true,
  showCanvasZoomControls: true,
  showCanvasFullscreenControl: true,
  defaultCanvasFullscreen: false,
  pageContainerWidth: '100%',
  pageContainerHeight: '',
  autoCanvasHeight: true,
  autoCanvasWidth: true,
  specifiedCanvasHeight: '70vh',
  specifiedCanvasWidth: '100%',
  showCanvasEditSettingsToggle: true,
  showCanvasSelectionPanelTabs: true,
  showPersistenceTemplateList: true,
  showPersistenceTemplateNameField: true,
  showPersistenceLayoutResizePolicyField: true,
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
  selectionInactiveOverlayOpacity: 0.5,
  initialCanvasTab: 'position',
  allowCanvasBoxSelection: false,
};

export const CANVAS_OWNER_SETTINGS_STORAGE_KEY = 'mejai.canvas.ownerSettings.v1';
const CANVAS_OWNER_SETTINGS_EVENT_NAME = 'mejai:canvas-owner-settings-changed';
export const canvasOwnerSettingKeys = Object.keys(defaultCanvasOwnerSettings) as CanvasOwnerSettingKey[];
const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const normalizeCanvasCssSizeSetting = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim().slice(0, 80) : fallback;
const normalizeCanvasOpacitySetting = (value: unknown, fallback = 0.5) => {
  const numericValue =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const alphaValue = numericValue > 1 ? numericValue / 100 : numericValue;

  return Math.max(0, Math.min(1, alphaValue));
};
const normalizeCanvasInitialTabSetting = (
  value: unknown,
  fallback: TemplateEditWorkspaceCanvasTab = defaultCanvasOwnerSettings.initialCanvasTab
): TemplateEditWorkspaceCanvasTab =>
  value === 'preview' || value === 'position' || value === 'metadata' || value === 'metadata2'
    ? value
    : fallback;
export const normalizeCanvasOwnerSettings = (value: unknown): CanvasOwnerSettings => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CanvasOwnerSettings>)
      : {};
  const legacyCandidate = candidate as Partial<CanvasOwnerSettings> & {
    canvasViewMode?: unknown;
    showCanvasInteractionModeControls?: boolean;
    showPersistenceLayoutResizeModeField?: boolean;
    useSpecifiedCanvasHeight?: unknown;
  };
  const legacyUseSpecifiedCanvasHeight = hasOwn(legacyCandidate, 'useSpecifiedCanvasHeight')
    ? legacyCandidate.useSpecifiedCanvasHeight === true
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
    showCanvasInteractionToolControls:
      typeof candidate.showCanvasInteractionToolControls === 'boolean'
        ? candidate.showCanvasInteractionToolControls
        : typeof legacyCandidate.showCanvasInteractionModeControls === 'boolean'
          ? legacyCandidate.showCanvasInteractionModeControls
          : defaultCanvasOwnerSettings.showCanvasInteractionToolControls,
    showPersistenceLayoutResizePolicyField:
      typeof candidate.showPersistenceLayoutResizePolicyField === 'boolean'
        ? candidate.showPersistenceLayoutResizePolicyField
        : typeof legacyCandidate.showPersistenceLayoutResizeModeField === 'boolean'
          ? legacyCandidate.showPersistenceLayoutResizeModeField
          : defaultCanvasOwnerSettings.showPersistenceLayoutResizePolicyField,
    selectionInactiveOverlayOpacity: normalizeCanvasOpacitySetting(
      candidate.selectionInactiveOverlayOpacity,
      defaultCanvasOwnerSettings.selectionInactiveOverlayOpacity
    ),
    initialCanvasTab: normalizeCanvasInitialTabSetting(
      candidate.initialCanvasTab ?? legacyCandidate.canvasViewMode,
      defaultCanvasOwnerSettings.initialCanvasTab
    ),
    allowCanvasBoxSelection:
      typeof candidate.allowCanvasBoxSelection === 'boolean'
        ? candidate.allowCanvasBoxSelection
        : defaultCanvasOwnerSettings.allowCanvasBoxSelection,
  };
};

export const createEmptyCanvasOwnerSettingsStore = (): CanvasOwnerSettingsStore => ({
  version: 7,
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
    normalizedOverrides.autoCanvasHeight = normalizedSettings.autoCanvasHeight;
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

  if (
    hasOwn(candidate, 'showCanvasInteractionModeControls') &&
    !hasOwn(candidate, 'showCanvasInteractionToolControls')
  ) {
    normalizedOverrides.showCanvasInteractionToolControls = normalizedSettings.showCanvasInteractionToolControls;
  }

  if (
    hasOwn(candidate, 'showPersistenceLayoutResizeModeField') &&
    !hasOwn(candidate, 'showPersistenceLayoutResizePolicyField')
  ) {
    normalizedOverrides.showPersistenceLayoutResizePolicyField =
      normalizedSettings.showPersistenceLayoutResizePolicyField;
  }

  if (hasOwn(candidate, 'canvasViewMode') && !hasOwn(candidate, 'initialCanvasTab')) {
    normalizedOverrides.initialCanvasTab = normalizedSettings.initialCanvasTab;
  }

  return normalizedOverrides;
};

export const normalizeCanvasOwnerSettingsStore = (value: unknown): CanvasOwnerSettingsStore => {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as {
          pageSettings?: unknown;
          pagePolicies?: unknown;
        })
      : null;

  if (!candidate || (!candidate.pageSettings && !candidate.pagePolicies)) {
    const legacyOverrides = normalizeCanvasOwnerSettingsOverrides(value);

    if (Object.keys(legacyOverrides).length === 0) {
      return createEmptyCanvasOwnerSettingsStore();
    }

    return {
      version: 7,
      pageSettings: {
        canvas: { ...legacyOverrides },
      },
    };
  }

  const pageSettingsCandidate =
    candidate.pageSettings && typeof candidate.pageSettings === 'object' && !Array.isArray(candidate.pageSettings)
      ? (candidate.pageSettings as Record<string, unknown>)
      : {};
  const pageSettings: CanvasOwnerSettingsStore['pageSettings'] = {};

  Object.entries(pageSettingsCandidate).forEach(([pageId, rawPageSettings]) => {
    if (!rawPageSettings || typeof rawPageSettings !== 'object' || Array.isArray(rawPageSettings)) {
      return;
    }

    const normalizedPageSettings = normalizeCanvasOwnerSettingsOverrides(rawPageSettings);

    if (Object.keys(normalizedPageSettings).length > 0) {
      pageSettings[pageId] = normalizedPageSettings;
    }
  });

  return {
    version: 7,
    pageSettings,
  };
};

export const resolveCanvasOwnerSettings = (
  store: CanvasOwnerSettingsStore,
  context: CanvasOwnerSettingsContext
) => {
  const normalizedStore = normalizeCanvasOwnerSettingsStore(store);
  const pageOverrides = context.pageId ? normalizedStore.pageSettings[context.pageId] || {} : {};
  const settings = normalizeCanvasOwnerSettings({
    ...defaultCanvasOwnerSettings,
    ...pageOverrides,
  });
  const sources = canvasOwnerSettingKeys.reduce(
    (accumulator, key) => {
      accumulator[key] = 'default';
      return accumulator;
    },
    {} as Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>
  );

  Object.keys(pageOverrides).forEach((key) => {
    sources[key as CanvasOwnerSettingKey] = 'page';
  });

  return {
    settings,
    sources,
    pageOverrides,
  };
};

export const updateCanvasOwnerSettingsStoreOverride = <K extends CanvasOwnerSettingKey>(
  store: CanvasOwnerSettingsStore,
  {
    pageId,
    key,
    value,
  }: {
    pageId: string;
    key: K;
    value: CanvasOwnerSettings[K];
  }
): CanvasOwnerSettingsStore => {
  const normalizedStore = normalizeCanvasOwnerSettingsStore(store);
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
        [key]: value,
      },
    },
  };
};

const readDefaultCanvasOwnerSettings = (context: CanvasOwnerSettingsContext = { pageId: 'canvas' }) => {
  const settingsStore = createEmptyCanvasOwnerSettingsStore();
  const resolvedSettings = resolveCanvasOwnerSettings(settingsStore, context);

  return {
    ...resolvedSettings,
    settingsStore,
    hasStoredSettings: false,
  };
};

export const readCanvasOwnerSettingsFromStorage = (context: CanvasOwnerSettingsContext = { pageId: 'canvas' }) => {
  if (typeof window === 'undefined') {
    return readDefaultCanvasOwnerSettings(context);
  }

  try {
    const rawSettings = window.localStorage.getItem(CANVAS_OWNER_SETTINGS_STORAGE_KEY);

    if (!rawSettings) {
      return readDefaultCanvasOwnerSettings(context);
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
    return readDefaultCanvasOwnerSettings(context);
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
    version: 7,
    pageSettings: {
      canvas: { ...overrides },
    },
  };

  return saveCanvasOwnerSettingsStoreToStorage(nextSettingsStore);
};

export const useStoredCanvasOwnerSettings = (context: CanvasOwnerSettingsContext = { pageId: 'canvas' }) => {
  const [state, setState] = React.useState(() => ({
    ...readDefaultCanvasOwnerSettings(context),
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
  }, [context.pageId]);

  return state;
};

export const buildCanvasToolbarVisibility = (
  settings: CanvasOwnerSettings
): TemplateEditWorkspaceCanvasToolbarVisibility => ({
  showCanvasTitle: settings.showCanvasTitle,
  showTemplateNameInput: settings.showCanvasNameField,
  showSaveButton: settings.showCanvasSaveButton,
  showTodoButton: settings.showCanvasTodoButton,
  showPreviewToggle: settings.showCanvasPreviewToggle,
  showInteractionModeControls: settings.showCanvasInteractionToolControls,
  showHistoryControls: settings.showCanvasHistoryControls,
  showZoomControls: settings.showCanvasZoomControls,
  showFullscreenControl: settings.showCanvasFullscreenControl,
  showEditSettingsToggle: settings.showCanvasEditSettingsToggle,
  showSelectionPanelTabs: settings.showCanvasSelectionPanelTabs,
});

export const buildPersistenceVisibility = (
  settings: CanvasOwnerSettings
): TemplateEditWorkspacePersistenceVisibility => ({
  showTemplateList: settings.showPersistenceTemplateList,
  showTemplateNameInput: settings.showPersistenceTemplateNameField,
  showLayoutResizeModeSelect: settings.showPersistenceLayoutResizePolicyField,
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
  settingSources: _settingSources,
  applyDefaultSettings: _applyDefaultSettings = false,
}: {
  baseProps: TemplateEditWorkspaceProps;
  settings: CanvasOwnerSettings;
  settingSources?: Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>;
  applyDefaultSettings?: boolean;
}): TemplateEditWorkspaceProps => {
  const shouldApplySetting = (_key: CanvasOwnerSettingKey) => true;
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
    canvasToolbarVisibility.showTemplateNameInput = settings.showCanvasNameField;
  }
  if (shouldApplySetting('showCanvasSaveButton')) {
    canvasToolbarVisibility.showSaveButton = settings.showCanvasSaveButton;
  }
  if (shouldApplySetting('showCanvasTodoButton')) {
    canvasToolbarVisibility.showTodoButton = settings.showCanvasTodoButton;
  }
  if (shouldApplySetting('showCanvasPreviewToggle')) {
    canvasToolbarVisibility.showPreviewToggle = settings.showCanvasPreviewToggle;
  }
  if (shouldApplySetting('showCanvasInteractionToolControls')) {
    canvasToolbarVisibility.showInteractionModeControls = settings.showCanvasInteractionToolControls;
  }
  if (shouldApplySetting('showCanvasHistoryControls')) {
    canvasToolbarVisibility.showHistoryControls = settings.showCanvasHistoryControls;
  }
  if (shouldApplySetting('showCanvasZoomControls')) {
    canvasToolbarVisibility.showZoomControls = settings.showCanvasZoomControls;
  }
  if (shouldApplySetting('showCanvasFullscreenControl')) {
    canvasToolbarVisibility.showFullscreenControl = settings.showCanvasFullscreenControl;
  }
  if (shouldApplySetting('showCanvasEditSettingsToggle')) {
    canvasToolbarVisibility.showEditSettingsToggle = settings.showCanvasEditSettingsToggle;
  }
  if (shouldApplySetting('showCanvasSelectionPanelTabs')) {
    canvasToolbarVisibility.showSelectionPanelTabs = settings.showCanvasSelectionPanelTabs;
  }
  if (shouldApplySetting('showPersistenceTemplateList')) {
    persistenceVisibility.showTemplateList = settings.showPersistenceTemplateList;
  }
  if (shouldApplySetting('showPersistenceTemplateNameField')) {
    persistenceVisibility.showTemplateNameInput = settings.showPersistenceTemplateNameField;
  }
  if (shouldApplySetting('showPersistenceLayoutResizePolicyField')) {
    persistenceVisibility.showLayoutResizeModeSelect = settings.showPersistenceLayoutResizePolicyField;
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
    templateListDisplay: shouldApplySetting('templateListDisplay') ? settings.templateListDisplay : baseProps.templateListDisplay,
    topNotice: shouldApplySetting('showTopNotice')
      ? settings.showTopNotice
        ? baseProps.topNotice
        : null
      : baseProps.topNotice,
    additionalControlPanels: shouldApplySetting('showAdditionalControlPanels')
      ? settings.showAdditionalControlPanels
        ? baseProps.additionalControlPanels
        : null
      : baseProps.additionalControlPanels,
    editableValueKeys: shouldApplySetting('limitEditableValueKeys')
      ? settings.limitEditableValueKeys
        ? baseProps.editableValueKeys
        : null
      : baseProps.editableValueKeys,
    onTemplateSaved: shouldApplySetting('enableOnTemplateSaved')
      ? settings.enableOnTemplateSaved
        ? baseProps.onTemplateSaved
        : undefined
      : baseProps.onTemplateSaved,
    showWorkspaceMessages: shouldApplySetting('showWorkspaceMessages') ? settings.showWorkspaceMessages : baseProps.showWorkspaceMessages,
    suppressInitialDraftLoadedMessage: shouldApplySetting('suppressInitialDraftLoadedMessage')
      ? settings.suppressInitialDraftLoadedMessage
      : baseProps.suppressInitialDraftLoadedMessage,
    headerTitle: shouldApplySetting('headerTitle') ? headerTitle : baseProps.headerTitle,
    headerDescription: shouldApplySetting('headerDescription') ? headerDescription : baseProps.headerDescription,
    nameFieldLabel: shouldApplySetting('nameFieldLabel') ? nameFieldLabel : baseProps.nameFieldLabel,
    saveButtonLabel: shouldApplySetting('saveButtonLabel') ? saveButtonLabel : baseProps.saveButtonLabel,
    templateNameReadOnly: shouldApplySetting('templateNameReadOnly')
      ? settings.templateNameReadOnly
      : baseProps.templateNameReadOnly,
    saveDisabled: shouldApplySetting('saveDisabled') ? settings.saveDisabled : baseProps.saveDisabled,
    initialCanvasTab: shouldApplySetting('initialCanvasTab') ? settings.initialCanvasTab : baseProps.initialCanvasTab,
    defaultCanvasFullscreen: shouldApplySetting('defaultCanvasFullscreen')
      ? settings.defaultCanvasFullscreen
      : baseProps.defaultCanvasFullscreen,
    canvasPageContainerWidth: shouldApplySetting('pageContainerWidth')
      ? pageContainerWidth
      : baseProps.canvasPageContainerWidth,
    canvasPageContainerHeight: shouldApplySetting('pageContainerHeight')
      ? pageContainerHeight
      : baseProps.canvasPageContainerHeight,
    canvasSpecifiedHeightEnabled: shouldApplySetting('autoCanvasHeight')
      ? !settings.autoCanvasHeight
      : baseProps.canvasSpecifiedHeightEnabled,
    canvasSpecifiedHeight:
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
    documentAttachmentApiPath: shouldApplySetting('enableDocumentAttachmentApiPath') && settings.enableDocumentAttachmentApiPath
      ? baseProps.documentAttachmentApiPath
      : '',
    canvasToolbarVisibility,
    persistenceVisibility,
    templateUsagePreviewLayoutDebugOptions,
    selectionInactiveOverlayOpacity: shouldApplySetting('selectionInactiveOverlayOpacity')
      ? settings.selectionInactiveOverlayOpacity
      : baseProps.selectionInactiveOverlayOpacity,
    canvasTextInteractionMode: shouldApplySetting('allowCanvasBoxSelection')
      ? settings.allowCanvasBoxSelection
        ? 'selection-only'
        : 'default'
      : baseProps.canvasTextInteractionMode,
    canvasSelectionMode: shouldApplySetting('allowCanvasBoxSelection')
      ? settings.allowCanvasBoxSelection
        ? 'box'
        : 'none'
      : baseProps.canvasSelectionMode,
  };
};
