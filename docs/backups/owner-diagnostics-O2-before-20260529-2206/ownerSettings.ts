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
export type CanvasOwnerUiFeatureKey =
  | 'canvasTitle'
  | 'templateNameInput'
  | 'saveButton'
  | 'todoButton'
  | 'previewToggle'
  | 'interactionTools'
  | 'historyControls'
  | 'zoomControls'
  | 'fullscreenControl'
  | 'editSettingsToggle'
  | 'selectionPanelTabs'
  | 'persistenceTemplateList'
  | 'persistenceTemplateNameInput'
  | 'persistenceLayoutResizePolicySelect'
  | 'persistenceSourceDocumentNameInput'
  | 'persistenceSaveButton'
  | 'documentAttachment'
  | 'onTemplateSaved'
  | 'onSaveDraftHtml';
export type CanvasOwnerUiFeatureDiagnosticLevel = 'none' | 'info' | 'warning';
export type CanvasOwnerUiFeatureActionAvailability = 'unknown' | 'available' | 'missing-runtime-condition';
export type CanvasOwnerUiFeatureDiagnostic = {
  key: CanvasOwnerUiFeatureKey;
  settingKey: CanvasOwnerSettingKey;
  definitionName: string;
  label: string;
  description: string;
  configuredVisible: boolean;
  visible: boolean;
  modeDiagnosticLevel: CanvasOwnerUiFeatureDiagnosticLevel;
  modeDiagnosticMessage: string;
  actionAvailability: CanvasOwnerUiFeatureActionAvailability;
  actionAvailabilityMessage: string;
};
export type CanvasOwnerSettingDiagnosticSeverity = 'none' | 'info' | 'warning' | 'blocking-risk';
export type CanvasOwnerSettingDiagnosticCategory =
  | 'none'
  | 'mode-mismatch'
  | 'runtime-missing'
  | 'capability-blocked'
  | 'inactive-setting'
  | 'persistence-performance'
  | 'layout-risk'
  | 'feedback-risk';
export type CanvasOwnerSettingDiagnostic = {
  settingKey: CanvasOwnerSettingKey;
  definitionName: string;
  label: string;
  severity: CanvasOwnerSettingDiagnosticSeverity;
  category: CanvasOwnerSettingDiagnosticCategory;
  configuredValue: string;
  effectiveValue: string;
  message: string;
  recommendedAction: string;
};

type CanvasOwnerUiFeatureDiagnosticState = {
  modeDiagnosticLevel?: CanvasOwnerUiFeatureDiagnosticLevel;
  modeDiagnosticMessage?: string;
  actionAvailability?: CanvasOwnerUiFeatureActionAvailability;
  actionAvailabilityMessage?: string;
};

type CanvasOwnerUiFeatureResolveContext = {
  settings: CanvasOwnerSettings;
  baseProps: TemplateEditWorkspaceProps;
  hasInitialDraft: boolean;
  documentDraftSaveEnabled: boolean;
  documentEditMode: boolean;
  readOnlyDraftOutput: boolean;
  templateEditMode: boolean;
  editableMode: boolean;
};

type CanvasOwnerUiFeatureDefinition = {
  key: CanvasOwnerUiFeatureKey;
  settingKey: CanvasOwnerSettingKey;
  definitionName: string;
  label: string;
  description: string;
  readConfiguredVisible: (settings: CanvasOwnerSettings) => boolean;
  resolveDiagnostic: (context: CanvasOwnerUiFeatureResolveContext) => CanvasOwnerUiFeatureDiagnosticState;
};

const canvasOwnerSettingDefinitionNames: Record<CanvasOwnerSettingKey, string> = {
  hideHeader: 'hideHeader',
  hidePersistencePanel: 'hidePersistencePanel',
  templateListDisplay: 'templateListDisplay',
  showTopNotice: 'showTopNotice',
  showWorkspaceMessages: 'showWorkspaceMessages',
  showAdditionalControlPanels: 'showAdditionalControlPanels',
  showCanvasTitle: 'canvasToolbarVisibility.showCanvasTitle',
  showCanvasNameField: 'canvasToolbarVisibility.showTemplateNameInput',
  showCanvasSaveButton: 'canvasToolbarVisibility.showSaveButton',
  showCanvasTodoButton: 'canvasToolbarVisibility.showTodoButton',
  showCanvasPreviewToggle: 'canvasToolbarVisibility.showPreviewToggle',
  showCanvasInteractionToolControls: 'canvasToolbarVisibility.showInteractionToolControls',
  showCanvasHistoryControls: 'canvasToolbarVisibility.showHistoryControls',
  showCanvasZoomControls: 'canvasToolbarVisibility.showZoomControls',
  showCanvasFullscreenControl: 'canvasToolbarVisibility.showFullscreenControl',
  defaultCanvasFullscreen: 'defaultCanvasFullscreen',
  pageContainerWidth: 'pageContainerWidth',
  pageContainerHeight: 'pageContainerHeight',
  autoCanvasHeight: 'autoCanvasHeight',
  autoCanvasWidth: 'autoCanvasWidth',
  specifiedCanvasHeight: 'specifiedCanvasHeight',
  specifiedCanvasWidth: 'specifiedCanvasWidth',
  showCanvasEditSettingsToggle: 'canvasToolbarVisibility.showEditSettingsToggle',
  showCanvasSelectionPanelTabs: 'canvasToolbarVisibility.showSelectionPanelTabs',
  showPersistenceTemplateList: 'persistenceVisibility.showTemplateList',
  showPersistenceTemplateNameField: 'persistenceVisibility.showTemplateNameInput',
  showPersistenceLayoutResizePolicyField: 'persistenceVisibility.showLayoutResizePolicySelect',
  showPersistenceSourceDocumentNameField: 'persistenceVisibility.showSourceDocumentNameInput',
  showPersistenceSaveButton: 'persistenceVisibility.showSaveButton',
  suppressInitialDraftLoadedMessage: 'suppressInitialDraftLoadedMessage',
  headerTitle: 'headerTitle',
  headerDescription: 'headerDescription',
  nameFieldLabel: 'nameFieldLabel',
  saveButtonLabel: 'saveButtonLabel',
  templateNameReadOnly: 'templateNameReadOnly',
  saveDisabled: 'saveDisabled',
  enableDocumentAttachmentApiPath: 'documentAttachmentApiPath',
  limitEditableValueKeys: 'editableValueKeys',
  enableOnTemplateSaved: 'onTemplateSaved',
  stabilizeInitialLayout: 'templateUsagePreviewLayoutDebugOptions.stabilizeInitialLayout',
  enableRuntimeInitialAutoSize: 'templateUsagePreviewLayoutDebugOptions.enableInitialAutoSize',
  preventInitialValueClearShrink: 'templateUsagePreviewLayoutDebugOptions.preventInitialValueClearShrink',
  preventRuntimeAutoSizeShrink: 'templateUsagePreviewLayoutDebugOptions.preventRuntimeAutoSizeShrink',
  blockPeerClusterHeightTargets: 'templateUsagePreviewLayoutDebugOptions.measurePeerClusterHeightTargets',
  blockPeerClusterWidthTargets: 'templateUsagePreviewLayoutDebugOptions.measurePeerClusterWidthTargets',
  selectionInactiveOverlayOpacity: 'selectionInactiveOverlayOpacity',
  initialCanvasTab: 'initialCanvasTab',
  allowCanvasBoxSelection: 'allowCanvasBoxSelection',
};

const canvasOwnerSettingLabels: Record<CanvasOwnerSettingKey, string> = {
  hideHeader: '워크스페이스 헤더 숨김',
  hidePersistencePanel: '불러오기 및 저장 패널 숨김',
  templateListDisplay: '템플릿 목록 표시 방식',
  showTopNotice: '상단 알림 표시',
  showWorkspaceMessages: '실행 알림 표시',
  showAdditionalControlPanels: '추가 제어 패널',
  showCanvasTitle: '캔버스 제목 표시',
  showCanvasNameField: '이름 입력 표시',
  showCanvasSaveButton: '상단 저장 버튼 표시',
  showCanvasTodoButton: '할 일 버튼 표시',
  showCanvasPreviewToggle: '미리보기 버튼 표시',
  showCanvasInteractionToolControls: '선택/이동 표시',
  showCanvasHistoryControls: '실행 기록 표시',
  showCanvasZoomControls: '확대/축소 표시',
  showCanvasFullscreenControl: '전체 화면 표시',
  defaultCanvasFullscreen: '초기 전체 화면',
  pageContainerWidth: '페이지 컨테이너 폭',
  pageContainerHeight: '페이지 컨테이너 높이',
  autoCanvasHeight: '자동 높이',
  autoCanvasWidth: '자동 너비',
  specifiedCanvasHeight: '지정 높이',
  specifiedCanvasWidth: '지정 너비',
  showCanvasEditSettingsToggle: '편집 설정 표시',
  showCanvasSelectionPanelTabs: '편집 탭 표시',
  showPersistenceTemplateList: '템플릿 목록 표시',
  showPersistenceTemplateNameField: '템플릿 이름 표시',
  showPersistenceLayoutResizePolicyField: '레이아웃 정책 표시',
  showPersistenceSourceDocumentNameField: '원본 문서명 표시',
  showPersistenceSaveButton: '하단 저장 버튼 표시',
  suppressInitialDraftLoadedMessage: '초기 초안 로드 안내 억제',
  headerTitle: 'headerTitle',
  headerDescription: 'headerDescription',
  nameFieldLabel: 'nameFieldLabel',
  saveButtonLabel: 'saveButtonLabel',
  templateNameReadOnly: '이름 입력 읽기 전용',
  saveDisabled: '저장 비활성',
  enableDocumentAttachmentApiPath: '첨부파일 API 연결',
  limitEditableValueKeys: '편집 가능 value 키 제한',
  enableOnTemplateSaved: '저장 완료 콜백 연결',
  stabilizeInitialLayout: '초기 레이아웃 안정화',
  enableRuntimeInitialAutoSize: '런타임 초기 자동 크기',
  preventInitialValueClearShrink: '초기 value 제거 축소 방지',
  preventRuntimeAutoSizeShrink: '런타임 자동 크기 축소 차단',
  blockPeerClusterHeightTargets: 'peer cluster 높이 측정 차단',
  blockPeerClusterWidthTargets: 'peer cluster 너비 측정 차단',
  selectionInactiveOverlayOpacity: '비활성 상자 오버레이 강도',
  initialCanvasTab: 'initialCanvasTab',
  allowCanvasBoxSelection: '읽기 출력 상자 선택 허용',
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
const noUiFeatureDiagnostic = (): CanvasOwnerUiFeatureDiagnosticState => ({
  modeDiagnosticLevel: 'none',
  modeDiagnosticMessage: '',
  actionAvailability: 'unknown',
  actionAvailabilityMessage: '',
});
const modeWarning = (modeDiagnosticMessage: string): CanvasOwnerUiFeatureDiagnosticState => ({
  modeDiagnosticLevel: 'warning',
  modeDiagnosticMessage,
  actionAvailability: 'unknown',
  actionAvailabilityMessage: '',
});
const missingRuntimeCondition = (actionAvailabilityMessage: string): CanvasOwnerUiFeatureDiagnosticState => ({
  modeDiagnosticLevel: 'none',
  modeDiagnosticMessage: '',
  actionAvailability: 'missing-runtime-condition',
  actionAvailabilityMessage,
});
const availableRuntimeCondition = (): CanvasOwnerUiFeatureDiagnosticState => ({
  modeDiagnosticLevel: 'none',
  modeDiagnosticMessage: '',
  actionAvailability: 'available',
  actionAvailabilityMessage: '',
});
const templateEditModeNotice = (modeDiagnosticMessage: string) => (context: CanvasOwnerUiFeatureResolveContext) =>
  context.editableMode ? noUiFeatureDiagnostic() : modeWarning(modeDiagnosticMessage);
const readOnlyOutputNotice = (modeDiagnosticMessage: string) => (context: CanvasOwnerUiFeatureResolveContext) =>
  context.readOnlyDraftOutput ? modeWarning(modeDiagnosticMessage) : noUiFeatureDiagnostic();
const createCanvasOwnerUiFeatureResolveContext = (
  settings: CanvasOwnerSettings,
  baseProps: TemplateEditWorkspaceProps
): CanvasOwnerUiFeatureResolveContext => {
  const hasInitialDraft = Boolean(baseProps.initialDraft);
  const documentDraftSaveEnabled = typeof baseProps.onSaveDraftHtml === 'function';
  const hasInitialTemplate = Boolean(String(baseProps.initialTemplateId || '').trim());
  const readOnlyDraftOutput =
    hasInitialDraft &&
    !documentDraftSaveEnabled &&
    !baseProps.onTemplateSaved &&
    !hasInitialTemplate;
  const documentEditMode = hasInitialDraft && documentDraftSaveEnabled;
  const templateEditMode = !hasInitialDraft && !readOnlyDraftOutput;

  return {
    settings,
    baseProps,
    hasInitialDraft,
    documentDraftSaveEnabled,
    documentEditMode,
    readOnlyDraftOutput,
    templateEditMode,
    editableMode: templateEditMode || documentEditMode,
  };
};

export const canvasOwnerUiFeatureDefinitions: CanvasOwnerUiFeatureDefinition[] = [
  {
    key: 'canvasTitle',
    settingKey: 'showCanvasTitle',
    definitionName: 'canvasToolbarVisibility.showCanvasTitle',
    label: '캔버스 제목',
    description: '상자 편집 캔버스 카드의 제목 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasTitle,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'templateNameInput',
    settingKey: 'showCanvasNameField',
    definitionName: 'canvasToolbarVisibility.showTemplateNameInput',
    label: '이름 입력',
    description: '상자 편집 캔버스의 이름 입력 UI 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasNameField,
    resolveDiagnostic: readOnlyOutputNotice('읽기 전용 출력으로 보이지만 이름 입력 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'saveButton',
    settingKey: 'showCanvasSaveButton',
    definitionName: 'canvasToolbarVisibility.showSaveButton',
    label: '문서 저장',
    description: '상단 저장 버튼의 출력 및 동작 가능 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasSaveButton,
    resolveDiagnostic: readOnlyOutputNotice('읽기 전용 출력으로 보이지만 저장 버튼 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'todoButton',
    settingKey: 'showCanvasTodoButton',
    definitionName: 'canvasToolbarVisibility.showTodoButton',
    label: '할 일',
    description: '할 일 패널 버튼의 출력 및 동작 가능 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasTodoButton,
    resolveDiagnostic: (context) =>
      context.baseProps.todoPanel
        ? availableRuntimeCondition()
        : missingRuntimeCondition('할 일 패널이 연결되어 있지 않아 버튼을 눌러도 열 패널이 없습니다.'),
  },
  {
    key: 'previewToggle',
    settingKey: 'showCanvasPreviewToggle',
    definitionName: 'canvasToolbarVisibility.showPreviewToggle',
    label: '미리보기',
    description: '실제 사용 미리보기 전환 UI의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasPreviewToggle,
    resolveDiagnostic: templateEditModeNotice('문서 저장/읽기 출력 흐름으로 보이지만 미리보기 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'interactionTools',
    settingKey: 'showCanvasInteractionToolControls',
    definitionName: 'canvasToolbarVisibility.showInteractionToolControls',
    label: '선택/이동',
    description: '상자 선택과 캔버스 이동 도구의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasInteractionToolControls,
    resolveDiagnostic: templateEditModeNotice('문서 저장/읽기 출력 흐름으로 보이지만 선택/이동 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'historyControls',
    settingKey: 'showCanvasHistoryControls',
    definitionName: 'canvasToolbarVisibility.showHistoryControls',
    label: '실행 기록',
    description: '되돌리기와 다시 실행 버튼의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasHistoryControls,
    resolveDiagnostic: readOnlyOutputNotice('읽기 전용 출력으로 보이지만 실행 기록 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'zoomControls',
    settingKey: 'showCanvasZoomControls',
    definitionName: 'canvasToolbarVisibility.showZoomControls',
    label: '확대/축소',
    description: '캔버스 확대/축소 UI의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasZoomControls,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'fullscreenControl',
    settingKey: 'showCanvasFullscreenControl',
    definitionName: 'canvasToolbarVisibility.showFullscreenControl',
    label: '전체 화면',
    description: '전체 화면 진입/종료 버튼의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasFullscreenControl,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'editSettingsToggle',
    settingKey: 'showCanvasEditSettingsToggle',
    definitionName: 'canvasToolbarVisibility.showEditSettingsToggle',
    label: '편집 설정',
    description: '상자 편집 패널 열기/닫기 버튼의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasEditSettingsToggle,
    resolveDiagnostic: templateEditModeNotice('문서 저장/읽기 출력 흐름으로 보이지만 편집 설정 버튼 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'selectionPanelTabs',
    settingKey: 'showCanvasSelectionPanelTabs',
    definitionName: 'canvasToolbarVisibility.showSelectionPanelTabs',
    label: '편집 탭',
    description: '미리보기/크기 및 위치/속성/역할 탭의 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showCanvasSelectionPanelTabs,
    resolveDiagnostic: templateEditModeNotice('문서 저장/읽기 출력 흐름으로 보이지만 상자 편집 탭 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'persistenceTemplateList',
    settingKey: 'showPersistenceTemplateList',
    definitionName: 'persistenceVisibility.showTemplateList',
    label: '템플릿 목록',
    description: '불러오기 및 저장 패널의 템플릿 목록 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showPersistenceTemplateList,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'persistenceTemplateNameInput',
    settingKey: 'showPersistenceTemplateNameField',
    definitionName: 'persistenceVisibility.showTemplateNameInput',
    label: '템플릿 이름 입력',
    description: '불러오기 및 저장 패널의 템플릿 이름 입력 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showPersistenceTemplateNameField,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'persistenceLayoutResizePolicySelect',
    settingKey: 'showPersistenceLayoutResizePolicyField',
    definitionName: 'persistenceVisibility.showLayoutResizePolicySelect',
    label: '레이아웃 조정 방식',
    description: '불러오기 및 저장 패널의 레이아웃 조정 정책 선택 UI 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showPersistenceLayoutResizePolicyField,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'persistenceSourceDocumentNameInput',
    settingKey: 'showPersistenceSourceDocumentNameField',
    definitionName: 'persistenceVisibility.showSourceDocumentNameInput',
    label: '원본 문서명 입력',
    description: '불러오기 및 저장 패널의 원본 문서명 입력 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showPersistenceSourceDocumentNameField,
    resolveDiagnostic: noUiFeatureDiagnostic,
  },
  {
    key: 'persistenceSaveButton',
    settingKey: 'showPersistenceSaveButton',
    definitionName: 'persistenceVisibility.showSaveButton',
    label: '템플릿 저장',
    description: '불러오기 및 저장 패널의 저장 버튼 출력 상태입니다.',
    readConfiguredVisible: (settings) => settings.showPersistenceSaveButton,
    resolveDiagnostic: readOnlyOutputNotice('읽기 전용 출력으로 보이지만 저장 버튼 표시 설정은 그대로 적용됩니다.'),
  },
  {
    key: 'documentAttachment',
    settingKey: 'enableDocumentAttachmentApiPath',
    definitionName: 'documentAttachmentApiPath',
    label: '문서 첨부파일 API',
    description: '문서 출력 페이지의 첨부파일 업로드 API 연결 상태입니다.',
    readConfiguredVisible: (settings) => settings.enableDocumentAttachmentApiPath,
    resolveDiagnostic: (context) =>
      !context.hasInitialDraft
        ? noUiFeatureDiagnostic()
        : context.baseProps.documentAttachmentApiPath
        ? availableRuntimeCondition()
        : missingRuntimeCondition('문서 첨부파일 API 경로가 연결되어 있지 않습니다.'),
  },
  {
    key: 'onTemplateSaved',
    settingKey: 'enableOnTemplateSaved',
    definitionName: 'onTemplateSaved',
    label: '템플릿 저장 후 콜백',
    description: '템플릿 저장 완료 후 owner 페이지 콜백 연결 상태입니다.',
    readConfiguredVisible: (settings) => settings.enableOnTemplateSaved,
    resolveDiagnostic: (context) =>
      !context.templateEditMode
        ? noUiFeatureDiagnostic()
        : context.baseProps.onTemplateSaved
        ? availableRuntimeCondition()
        : missingRuntimeCondition('템플릿 저장 후 콜백이 연결되어 있지 않습니다.'),
  },
  {
    key: 'onSaveDraftHtml',
    settingKey: 'saveDisabled',
    definitionName: 'onSaveDraftHtml',
    label: '문서 저장 콜백',
    description: '문서 출력 HTML 저장 콜백 연결 상태입니다.',
    readConfiguredVisible: (settings) => !settings.saveDisabled,
    resolveDiagnostic: (context) =>
      !context.hasInitialDraft
        ? noUiFeatureDiagnostic()
        : context.baseProps.onSaveDraftHtml
        ? availableRuntimeCondition()
        : missingRuntimeCondition('문서 저장 콜백이 연결되어 있지 않습니다.'),
  },
];

export const resolveCanvasOwnerUiFeatureDiagnostics = ({
  settings,
  baseProps,
}: {
  settings: CanvasOwnerSettings;
  baseProps: TemplateEditWorkspaceProps;
}): CanvasOwnerUiFeatureDiagnostic[] => {
  const context = createCanvasOwnerUiFeatureResolveContext(settings, baseProps);

  return canvasOwnerUiFeatureDefinitions.map((definition) => {
    const configuredVisible = definition.readConfiguredVisible(settings);
    const diagnosticState = definition.resolveDiagnostic(context);

    return {
      key: definition.key,
      settingKey: definition.settingKey,
      definitionName: definition.definitionName,
      label: definition.label,
      description: definition.description,
      configuredVisible,
      visible: configuredVisible,
      modeDiagnosticLevel: diagnosticState.modeDiagnosticLevel || 'none',
      modeDiagnosticMessage: diagnosticState.modeDiagnosticMessage || '',
      actionAvailability: diagnosticState.actionAvailability || 'unknown',
      actionAvailabilityMessage: diagnosticState.actionAvailabilityMessage || '',
    };
  });
};

const formatCanvasOwnerDiagnosticValue = (value: unknown) => {
  if (value === undefined) {
    return 'not passed';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'invalid';
  }

  if (typeof value === 'string') {
    return value.trim() || '(empty)';
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '[]';
  }

  return 'enabled';
};

const readCssPixelValue = (value: string) => {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
};

const isInvalidCanvasCssSize = (value: string) => {
  const normalizedValue = value.trim();
  return Boolean(normalizedValue) && !/^(auto|100%|min\(|max\(|clamp\(|\d+(?:\.\d+)?(px|rem|em|vh|vw|%))/.test(normalizedValue);
};

const canvasOwnerSettingDiagnosticSeverityRank: Record<CanvasOwnerSettingDiagnosticSeverity, number> = {
  none: 0,
  info: 1,
  warning: 2,
  'blocking-risk': 3,
};

export const resolveCanvasOwnerSettingDiagnostics = ({
  settings,
  settingSources,
  baseProps,
  workspaceProps,
}: {
  settings: CanvasOwnerSettings;
  settingSources?: Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>;
  baseProps: TemplateEditWorkspaceProps;
  workspaceProps: TemplateEditWorkspaceProps;
}): CanvasOwnerSettingDiagnostic[] => {
  const context = createCanvasOwnerUiFeatureResolveContext(settings, baseProps);
  const toolbarVisibility = workspaceProps.canvasToolbarVisibility || {};
  const persistenceVisibility = workspaceProps.persistenceVisibility || {};
  const layoutOptions = workspaceProps.templateUsagePreviewLayoutDebugOptions || {};
  const persistencePanelVisible = workspaceProps.hidePersistencePanel !== true;
  const saveCallbackConnected = typeof workspaceProps.onSaveDraftHtml === 'function';
  const templateSaveCallbackConnected = typeof workspaceProps.onTemplateSaved === 'function';
  const saveDisabled = Boolean(workspaceProps.saveDisabled);
  const selectedTab = workspaceProps.initialCanvasTab || settings.initialCanvasTab;
  const canvasSelectionMode = workspaceProps.canvasSelectionMode || 'none';
  const canvasTextInteractionMode = workspaceProps.canvasTextInteractionMode || 'default';
  const effectiveValues: Record<CanvasOwnerSettingKey, unknown> = {
    hideHeader: workspaceProps.hideHeader,
    hidePersistencePanel: workspaceProps.hidePersistencePanel,
    templateListDisplay: workspaceProps.templateListDisplay,
    showTopNotice: Boolean(workspaceProps.topNotice),
    showWorkspaceMessages: workspaceProps.showWorkspaceMessages !== false,
    showAdditionalControlPanels: Boolean(workspaceProps.additionalControlPanels),
    showCanvasTitle: toolbarVisibility.showCanvasTitle,
    showCanvasNameField: toolbarVisibility.showTemplateNameInput,
    showCanvasSaveButton: toolbarVisibility.showSaveButton,
    showCanvasTodoButton: toolbarVisibility.showTodoButton,
    showCanvasPreviewToggle: toolbarVisibility.showPreviewToggle,
    showCanvasInteractionToolControls: toolbarVisibility.showInteractionModeControls,
    showCanvasHistoryControls: toolbarVisibility.showHistoryControls,
    showCanvasZoomControls: toolbarVisibility.showZoomControls,
    showCanvasFullscreenControl: toolbarVisibility.showFullscreenControl,
    defaultCanvasFullscreen: workspaceProps.defaultCanvasFullscreen,
    pageContainerWidth: workspaceProps.canvasPageContainerWidth,
    pageContainerHeight: workspaceProps.canvasPageContainerHeight,
    autoCanvasHeight: !workspaceProps.canvasSpecifiedHeightEnabled,
    autoCanvasWidth: !workspaceProps.canvasSpecifiedWidthEnabled,
    specifiedCanvasHeight: workspaceProps.canvasSpecifiedHeight,
    specifiedCanvasWidth: workspaceProps.canvasSpecifiedWidth,
    showCanvasEditSettingsToggle: toolbarVisibility.showEditSettingsToggle,
    showCanvasSelectionPanelTabs: toolbarVisibility.showSelectionPanelTabs,
    showPersistenceTemplateList: persistenceVisibility.showTemplateList,
    showPersistenceTemplateNameField: persistenceVisibility.showTemplateNameInput,
    showPersistenceLayoutResizePolicyField: persistenceVisibility.showLayoutResizeModeSelect,
    showPersistenceSourceDocumentNameField: persistenceVisibility.showSourceDocumentNameInput,
    showPersistenceSaveButton: persistenceVisibility.showSaveButton,
    suppressInitialDraftLoadedMessage: workspaceProps.suppressInitialDraftLoadedMessage,
    headerTitle: workspaceProps.headerTitle,
    headerDescription: workspaceProps.headerDescription,
    nameFieldLabel: workspaceProps.nameFieldLabel,
    saveButtonLabel: workspaceProps.saveButtonLabel,
    templateNameReadOnly: workspaceProps.templateNameReadOnly,
    saveDisabled,
    enableDocumentAttachmentApiPath: Boolean(workspaceProps.documentAttachmentApiPath),
    limitEditableValueKeys: Array.isArray(workspaceProps.editableValueKeys),
    enableOnTemplateSaved: templateSaveCallbackConnected,
    stabilizeInitialLayout: layoutOptions.stabilizeInitialLayout,
    enableRuntimeInitialAutoSize: layoutOptions.enableInitialAutoSize,
    preventInitialValueClearShrink: layoutOptions.preventInitialValueClearShrink,
    preventRuntimeAutoSizeShrink: layoutOptions.preventRuntimeAutoSizeShrink,
    blockPeerClusterHeightTargets: layoutOptions.measurePeerClusterHeightTargets === false,
    blockPeerClusterWidthTargets: layoutOptions.measurePeerClusterWidthTargets === false,
    selectionInactiveOverlayOpacity: workspaceProps.selectionInactiveOverlayOpacity,
    initialCanvasTab: selectedTab,
    allowCanvasBoxSelection: canvasSelectionMode === 'box',
  };
  const diagnosticsByKey = new Map<
    CanvasOwnerSettingKey,
    Pick<CanvasOwnerSettingDiagnostic, 'severity' | 'category' | 'message' | 'recommendedAction'>
  >();
  const isPageSetting = (key: CanvasOwnerSettingKey) => settingSources?.[key] === 'page';
  const report = (
    settingKey: CanvasOwnerSettingKey,
    severity: CanvasOwnerSettingDiagnosticSeverity,
    category: CanvasOwnerSettingDiagnosticCategory,
    message: string,
    recommendedAction: string
  ) => {
    const current = diagnosticsByKey.get(settingKey);
    if (
      current &&
      canvasOwnerSettingDiagnosticSeverityRank[current.severity] >= canvasOwnerSettingDiagnosticSeverityRank[severity]
    ) {
      return;
    }

    diagnosticsByKey.set(settingKey, {
      severity,
      category,
      message,
      recommendedAction,
    });
  };

  if (context.templateEditMode && settings.hidePersistencePanel) {
    report('hidePersistencePanel', 'warning', 'capability-blocked', '템플릿 편집 화면에서 불러오기 및 저장 패널이 숨김 상태입니다.', '템플릿 저장/불러오기가 필요하면 이 설정을 OFF로 바꾸세요.');
  }
  if (context.hasInitialDraft && persistencePanelVisible) {
    report('hidePersistencePanel', 'warning', 'persistence-performance', '문서 기반 화면에서 불러오기 및 저장 패널이 표시되어 템플릿 목록 로드가 발생할 수 있습니다.', '문서 편집 화면에서 템플릿 persistence가 필요하지 않다면 패널 숨김을 검토하세요.');
    report('templateListDisplay', 'warning', 'persistence-performance', '문서 기반 화면에서 템플릿 목록 표시 방식이 런타임 로드 비용을 만들 수 있습니다.', '문서 편집 화면에서는 persistence 표시 설정과 함께 판단하세요.');
  }
  if (!persistencePanelVisible && isPageSetting('templateListDisplay')) {
    report('templateListDisplay', 'info', 'inactive-setting', '불러오기 및 저장 패널이 숨겨져 templateListDisplay 값이 화면에 적용되지 않습니다.', '패널을 표시할 때만 이 설정이 의미가 있습니다.');
  }
  if (settings.showTopNotice && !baseProps.topNotice) {
    report('showTopNotice', 'info', 'runtime-missing', '상단 알림 표시가 켜져 있지만 이 page가 전달한 topNotice가 없습니다.', '알림이 필요한 page인지 확인하세요.');
  }
  if (!settings.showTopNotice && baseProps.topNotice) {
    report('showTopNotice', 'warning', 'feedback-risk', '이 page가 topNotice를 전달하지만 설정이 꺼져 표시되지 않습니다.', '필수 안내라면 상단 알림 표시를 켜세요.');
  }
  if (!settings.showWorkspaceMessages && context.editableMode) {
    report('showWorkspaceMessages', 'warning', 'feedback-risk', '편집 가능한 화면에서 실행 알림이 숨김 상태입니다.', '저장, 선택, 첨부 결과를 사용자가 확인해야 하면 켜두세요.');
  }
  if (settings.showAdditionalControlPanels && !baseProps.additionalControlPanels) {
    report('showAdditionalControlPanels', 'info', 'runtime-missing', '추가 제어 패널 표시가 켜져 있지만 연결된 패널이 없습니다.', '이 page가 추가 패널을 제공하는지 확인하세요.');
  }
  if (!settings.showAdditionalControlPanels && baseProps.additionalControlPanels) {
    report('showAdditionalControlPanels', 'info', 'inactive-setting', '추가 제어 패널이 전달됐지만 설정이 꺼져 표시되지 않습니다.', '해당 패널을 써야 하면 설정을 켜세요.');
  }
  if (settings.hideHeader && !settings.showCanvasTitle) {
    report('showCanvasTitle', 'info', 'mode-mismatch', '헤더와 캔버스 제목이 모두 숨김이라 현재 화면 문맥이 약해질 수 있습니다.', '외부 header가 충분한지 확인하세요.');
  }
  if (!settings.showCanvasNameField && context.templateEditMode) {
    report('showCanvasNameField', 'warning', 'capability-blocked', '템플릿 편집 화면에서 이름 입력이 숨김 상태입니다.', '템플릿 이름을 편집해야 하면 이름 입력 표시를 켜세요.');
  }
  if (settings.showCanvasNameField && context.readOnlyDraftOutput) {
    report('showCanvasNameField', 'info', 'mode-mismatch', '읽기 전용 출력 화면에 이름 입력 표시 설정이 켜져 있습니다.', '읽기 전용 화면에서 필요한 표시인지 확인하세요.');
  }
  if (!settings.showCanvasSaveButton && !saveDisabled && (saveCallbackConnected || templateSaveCallbackConnected)) {
    report('showCanvasSaveButton', 'warning', 'capability-blocked', '저장 가능한 화면이지만 상단 저장 버튼이 숨김 상태입니다.', '사용자가 저장할 수 있어야 하면 저장 버튼 표시를 켜세요.');
  }
  if (settings.showCanvasSaveButton && (saveDisabled || (!saveCallbackConnected && !templateSaveCallbackConnected))) {
    report('showCanvasSaveButton', 'warning', 'runtime-missing', '저장 버튼 표시가 켜져 있지만 현재 런타임에서는 저장할 수 없습니다.', '저장 callback과 saveDisabled 상태를 함께 확인하세요.');
  }
  if (settings.showCanvasTodoButton && !baseProps.todoPanel) {
    report('showCanvasTodoButton', 'warning', 'runtime-missing', '할 일 버튼 표시가 켜져 있지만 열 수 있는 패널이 없습니다.', 'todoPanel 연결 여부를 확인하세요.');
  }
  if (!settings.showCanvasTodoButton && (baseProps.todoCount || 0) > 0) {
    report('showCanvasTodoButton', 'info', 'inactive-setting', '할 일 항목이 있지만 버튼이 숨김 상태입니다.', '할 일 확인이 필요하면 버튼 표시를 켜세요.');
  }
  if (!settings.showCanvasPreviewToggle && context.templateEditMode) {
    report('showCanvasPreviewToggle', 'warning', 'capability-blocked', '편집 화면에서 미리보기 전환 버튼이 숨김 상태입니다.', '미리보기 확인이 필요하면 표시를 켜세요.');
  }
  if (settings.showCanvasPreviewToggle && context.readOnlyDraftOutput) {
    report('showCanvasPreviewToggle', 'info', 'mode-mismatch', '읽기 전용 출력 화면에 미리보기 전환 버튼 표시 설정이 켜져 있습니다.', '읽기 화면에서 필요한 제어인지 확인하세요.');
  }
  if (settings.showCanvasInteractionToolControls && canvasSelectionMode === 'none') {
    report('showCanvasInteractionToolControls', 'blocking-risk', 'capability-blocked', '선택/이동 버튼은 표시되지만 실제 상자 선택 정책이 none입니다.', '선택이 필요하면 allowCanvasBoxSelection 또는 선택 정책 설정을 확인하세요.');
  }
  if (!settings.showCanvasInteractionToolControls && context.editableMode) {
    report('showCanvasInteractionToolControls', 'warning', 'capability-blocked', '편집 가능한 화면에서 선택/이동 전환 버튼이 숨김 상태입니다.', '상자 선택과 이동이 필요하면 표시를 켜세요.');
  }
  if (!settings.showCanvasHistoryControls && context.editableMode) {
    report('showCanvasHistoryControls', 'warning', 'capability-blocked', '편집 가능한 화면에서 되돌리기/다시 실행 UI가 숨김 상태입니다.', '편집 복구가 필요하면 실행 기록 표시를 켜세요.');
  }
  if (settings.showCanvasHistoryControls && context.readOnlyDraftOutput) {
    report('showCanvasHistoryControls', 'info', 'mode-mismatch', '읽기 전용 출력 화면에 실행 기록 표시 설정이 켜져 있습니다.', '읽기 화면에서 필요한 제어인지 확인하세요.');
  }
  if (!settings.showCanvasZoomControls && isPageSetting('showCanvasZoomControls')) {
    report('showCanvasZoomControls', 'info', 'capability-blocked', '확대/축소 UI가 숨김 상태입니다.', '작은 화면이나 큰 문서에서 확대 제어가 필요한지 확인하세요.');
  }
  if (!settings.showCanvasFullscreenControl && context.hasInitialDraft && isPageSetting('showCanvasFullscreenControl')) {
    report('showCanvasFullscreenControl', 'info', 'capability-blocked', '문서 화면에서 전체 화면 버튼이 숨김 상태입니다.', '큰 문서 편집에 전체 화면이 필요한지 확인하세요.');
  }
  if (settings.defaultCanvasFullscreen && context.hasInitialDraft) {
    report('defaultCanvasFullscreen', 'info', 'layout-risk', 'embedded 문서 화면이 처음부터 전체 화면으로 열릴 수 있습니다.', 'route layout과 충돌하지 않는지 확인하세요.');
  }

  const pageContainerWidthPx = readCssPixelValue(settings.pageContainerWidth);
  const pageContainerHeightPx = readCssPixelValue(settings.pageContainerHeight);
  const specifiedCanvasHeightPx = readCssPixelValue(settings.specifiedCanvasHeight);
  const specifiedCanvasWidthPx = readCssPixelValue(settings.specifiedCanvasWidth);

  if (isInvalidCanvasCssSize(settings.pageContainerWidth) || (pageContainerWidthPx !== null && pageContainerWidthPx < 480)) {
    report('pageContainerWidth', 'warning', 'layout-risk', '페이지 컨테이너 폭 값이 너무 작거나 유효하지 않을 수 있습니다.', '문서가 잘리지 않는 폭인지 확인하세요.');
  }
  if (isInvalidCanvasCssSize(settings.pageContainerHeight) || (pageContainerHeightPx !== null && pageContainerHeightPx < 240)) {
    report('pageContainerHeight', 'warning', 'layout-risk', '페이지 컨테이너 높이 값이 너무 작거나 유효하지 않을 수 있습니다.', '편집부가 압축되지 않는 높이인지 확인하세요.');
  }
  if (settings.autoCanvasHeight && isPageSetting('specifiedCanvasHeight')) {
    report('specifiedCanvasHeight', 'info', 'inactive-setting', '자동 높이가 켜져 있어 지정 높이 값은 직접 적용되지 않습니다.', '지정 높이를 쓰려면 자동 높이를 끄세요.');
  }
  if (!settings.autoCanvasHeight && (isInvalidCanvasCssSize(settings.specifiedCanvasHeight) || (specifiedCanvasHeightPx !== null && specifiedCanvasHeightPx < 240))) {
    report('autoCanvasHeight', 'warning', 'layout-risk', '자동 높이가 꺼졌지만 지정 높이가 너무 작거나 유효하지 않습니다.', '지정 높이 값을 조정하세요.');
    report('specifiedCanvasHeight', 'warning', 'layout-risk', '지정 높이가 너무 작거나 유효하지 않아 편집 영역이 압축될 수 있습니다.', '문서 편집에 충분한 높이를 지정하세요.');
  }
  if (settings.autoCanvasWidth && isPageSetting('specifiedCanvasWidth')) {
    report('specifiedCanvasWidth', 'info', 'inactive-setting', '자동 너비가 켜져 있어 지정 너비 값은 직접 적용되지 않습니다.', '지정 너비를 쓰려면 자동 너비를 끄세요.');
  }
  if (!settings.autoCanvasWidth && (isInvalidCanvasCssSize(settings.specifiedCanvasWidth) || (specifiedCanvasWidthPx !== null && specifiedCanvasWidthPx < 480))) {
    report('autoCanvasWidth', 'warning', 'layout-risk', '자동 너비가 꺼졌지만 지정 너비가 너무 작거나 유효하지 않습니다.', '지정 너비 값을 조정하세요.');
    report('specifiedCanvasWidth', 'warning', 'layout-risk', '지정 너비가 너무 작거나 유효하지 않아 문서가 잘릴 수 있습니다.', '문서 편집에 충분한 너비를 지정하세요.');
  }
  if (!settings.showCanvasEditSettingsToggle && context.editableMode) {
    report('showCanvasEditSettingsToggle', 'warning', 'capability-blocked', '편집 가능한 화면에서 편집 설정 버튼이 숨김 상태입니다.', '상자 편집 패널 접근이 필요하면 표시를 켜세요.');
  }
  if (settings.showCanvasEditSettingsToggle && context.readOnlyDraftOutput) {
    report('showCanvasEditSettingsToggle', 'info', 'mode-mismatch', '읽기 전용 출력 화면에 편집 설정 버튼 표시 설정이 켜져 있습니다.', '읽기 화면에서 필요한 제어인지 확인하세요.');
  }
  if (!settings.showCanvasSelectionPanelTabs && context.editableMode) {
    report('showCanvasSelectionPanelTabs', 'warning', 'capability-blocked', '편집 가능한 화면에서 편집 탭이 숨김 상태입니다.', '크기, 속성, 역할 탭 접근이 필요하면 표시를 켜세요.');
  }
  if (settings.showCanvasSelectionPanelTabs && context.readOnlyDraftOutput) {
    report('showCanvasSelectionPanelTabs', 'info', 'mode-mismatch', '읽기 전용 출력 화면에 편집 탭 표시 설정이 켜져 있습니다.', '읽기 화면에서 필요한 제어인지 확인하세요.');
  }
  if (!settings.showCanvasSelectionPanelTabs && selectedTab !== 'preview') {
    report('initialCanvasTab', 'warning', 'capability-blocked', '초기 탭은 편집 탭이지만 탭 UI가 숨김 상태입니다.', '초기 탭과 탭 표시 설정을 함께 확인하세요.');
  }
  if (!persistencePanelVisible) {
    ([
      'showPersistenceTemplateList',
      'showPersistenceTemplateNameField',
      'showPersistenceLayoutResizePolicyField',
      'showPersistenceSourceDocumentNameField',
      'showPersistenceSaveButton',
    ] as CanvasOwnerSettingKey[]).forEach((settingKey) => {
      if (isPageSetting(settingKey)) {
        report(settingKey, 'info', 'inactive-setting', '불러오기 및 저장 패널이 숨겨져 이 항목 표시 설정은 적용되지 않습니다.', '패널을 표시할 때만 이 설정이 의미가 있습니다.');
      }
    });
  }
  if (context.hasInitialDraft && persistencePanelVisible) {
    ([
      'showPersistenceTemplateList',
      'showPersistenceTemplateNameField',
      'showPersistenceLayoutResizePolicyField',
      'showPersistenceSourceDocumentNameField',
      'showPersistenceSaveButton',
    ] as CanvasOwnerSettingKey[]).forEach((settingKey) => {
      if (settings[settingKey]) {
        report(settingKey, 'warning', 'persistence-performance', '문서 기반 화면에서 persistence 항목이 표시되어 불필요한 템플릿 런타임을 만들 수 있습니다.', '문서 편집 화면에서 이 항목이 필요한지 확인하세요.');
      }
    });
  }
  if (settings.suppressInitialDraftLoadedMessage && context.hasInitialDraft && isPageSetting('suppressInitialDraftLoadedMessage')) {
    report('suppressInitialDraftLoadedMessage', 'info', 'feedback-risk', '초기 초안 로드 안내가 억제되어 긴 로딩 원인을 사용자가 보기 어렵습니다.', '로딩 진단 중에는 안내 표시를 검토하세요.');
  }
  if (!settings.headerTitle.trim() && isPageSetting('headerTitle')) {
    report('headerTitle', 'info', 'inactive-setting', 'headerTitle이 비어 있어 route 기본 제목으로 fallback됩니다.', '의도한 제목이면 값을 입력하세요.');
  }
  if (!settings.headerDescription.trim() && isPageSetting('headerDescription')) {
    report('headerDescription', 'info', 'inactive-setting', 'headerDescription이 비어 있어 route 기본 설명으로 fallback됩니다.', '의도한 설명이면 값을 입력하세요.');
  }
  if (!settings.nameFieldLabel.trim() && isPageSetting('nameFieldLabel')) {
    report('nameFieldLabel', 'info', 'inactive-setting', 'nameFieldLabel이 비어 있어 기본 라벨로 fallback됩니다.', '의도한 라벨이면 값을 입력하세요.');
  }
  if (!settings.saveButtonLabel.trim() && isPageSetting('saveButtonLabel')) {
    report('saveButtonLabel', 'info', 'inactive-setting', 'saveButtonLabel이 비어 있어 기본 저장 문구로 fallback됩니다.', '의도한 버튼 문구이면 값을 입력하세요.');
  }
  if (settings.templateNameReadOnly && context.templateEditMode) {
    report('templateNameReadOnly', 'warning', 'capability-blocked', '템플릿 편집 화면에서 이름 입력이 읽기 전용입니다.', '템플릿 이름을 수정해야 하면 읽기 전용을 끄세요.');
  }
  if (!settings.templateNameReadOnly && context.hasInitialDraft) {
    report('templateNameReadOnly', 'warning', 'mode-mismatch', '문서 기반 화면에서 템플릿/문서 이름 입력이 수정 가능하게 설정되어 있습니다.', '문서 출력 화면에서 이름 수정이 필요한지 확인하세요.');
  }
  if (settings.saveDisabled && (saveCallbackConnected || templateSaveCallbackConnected)) {
    report('saveDisabled', 'warning', 'capability-blocked', '저장 callback은 연결되어 있지만 저장 비활성이 켜져 있습니다.', '저장을 허용해야 하면 저장 비활성을 끄세요.');
  }
  if (!settings.saveDisabled && context.editableMode && !saveCallbackConnected && !templateSaveCallbackConnected) {
    report('saveDisabled', 'warning', 'runtime-missing', '저장 비활성은 꺼져 있지만 저장 callback이 없습니다.', '저장 동작을 연결하거나 저장 비활성을 켜세요.');
  }
  if (settings.enableDocumentAttachmentApiPath && context.hasInitialDraft && !workspaceProps.documentAttachmentApiPath) {
    report('enableDocumentAttachmentApiPath', 'warning', 'runtime-missing', '첨부파일 API 연결이 켜져 있지만 실제 API 경로가 없습니다.', '문서 첨부 기능이 필요한 page인지 확인하세요.');
  }
  if (!settings.enableDocumentAttachmentApiPath && baseProps.documentAttachmentApiPath && context.documentEditMode) {
    report('enableDocumentAttachmentApiPath', 'warning', 'capability-blocked', '문서 첨부 API 경로가 있지만 설정이 꺼져 첨부 저장이 차단됩니다.', '첨부 파일 편집이 필요하면 API 연결을 켜세요.');
  }
  if (settings.limitEditableValueKeys && !baseProps.editableValueKeys?.length) {
    report('limitEditableValueKeys', 'warning', 'capability-blocked', '편집 가능 value 키 제한이 켜져 있지만 전달된 key 목록이 없습니다.', '권한 제한 목록이 실제로 전달되는지 확인하세요.');
  }
  if (!settings.limitEditableValueKeys && baseProps.editableValueKeys?.length) {
    report('limitEditableValueKeys', 'warning', 'mode-mismatch', '제한 가능한 editableValueKeys가 전달됐지만 설정이 꺼져 있습니다.', '요청 링크나 구성원 접근처럼 제한이 필요한 화면인지 확인하세요.');
  }
  if (!settings.enableOnTemplateSaved && baseProps.onTemplateSaved) {
    report('enableOnTemplateSaved', 'warning', 'capability-blocked', '템플릿 저장 후 콜백이 전달됐지만 설정이 꺼져 실행되지 않습니다.', '저장 후처리가 필요하면 콜백 연결을 켜세요.');
  }
  if (settings.enableOnTemplateSaved && context.templateEditMode && !baseProps.onTemplateSaved) {
    report('enableOnTemplateSaved', 'info', 'runtime-missing', '저장 완료 콜백 연결이 켜져 있지만 이 page가 onTemplateSaved를 전달하지 않습니다.', '템플릿 저장 page인지 확인하세요.');
  }
  if (!settings.stabilizeInitialLayout && context.hasInitialDraft) {
    report('stabilizeInitialLayout', 'warning', 'layout-risk', '문서 출력 화면에서 초기 레이아웃 안정화가 꺼져 있습니다.', '초기 표시 흔들림이나 edge 위치 문제가 없는지 확인하세요.');
  }
  if (!settings.enableRuntimeInitialAutoSize && context.hasInitialDraft) {
    report('enableRuntimeInitialAutoSize', 'warning', 'layout-risk', '문서 출력 화면에서 런타임 초기 자동 크기가 꺼져 있습니다.', '초기 value 병합 뒤 자동 크기 계산이 필요한지 확인하세요.');
  }
  if (!settings.preventInitialValueClearShrink && context.hasInitialDraft) {
    report('preventInitialValueClearShrink', 'warning', 'layout-risk', '문서 출력 화면에서 초기 value 제거 축소 방지가 꺼져 있습니다.', '초기 레이아웃 축소가 재현되는지 확인하세요.');
  }
  if (settings.preventRuntimeAutoSizeShrink && isPageSetting('preventRuntimeAutoSizeShrink')) {
    report('preventRuntimeAutoSizeShrink', 'info', 'layout-risk', '런타임 자동 크기 축소 차단이 켜져 있어 정상 축소까지 막을 수 있습니다.', '값 입력 후 높이/너비 축소가 필요한 문서인지 확인하세요.');
  }
  if (settings.blockPeerClusterHeightTargets) {
    report('blockPeerClusterHeightTargets', 'warning', 'layout-risk', 'peer cluster 높이 측정이 차단되어 연동 높이 계산이 달라질 수 있습니다.', 'peer edge 높이 연동이 필요한 문서인지 확인하세요.');
  }
  if (settings.blockPeerClusterWidthTargets) {
    report('blockPeerClusterWidthTargets', 'warning', 'layout-risk', 'peer cluster 너비 측정이 차단되어 연동 너비 계산이 달라질 수 있습니다.', 'peer edge 너비 연동이 필요한 문서인지 확인하세요.');
  }
  if (canvasSelectionMode === 'none' && isPageSetting('selectionInactiveOverlayOpacity')) {
    report('selectionInactiveOverlayOpacity', 'info', 'inactive-setting', '상자 선택 정책이 none이라 선택 오버레이 강도는 체감되지 않습니다.', '선택 정책을 켤 때만 이 설정이 의미가 있습니다.');
  }
  if (settings.selectionInactiveOverlayOpacity >= 0.85 && canvasSelectionMode === 'box') {
    report('selectionInactiveOverlayOpacity', 'warning', 'layout-risk', '선택 오버레이 강도가 높아 선택되지 않은 항목 가독성이 떨어질 수 있습니다.', '가독성을 확인하고 강도를 낮출지 결정하세요.');
  }
  if (context.readOnlyDraftOutput && selectedTab !== 'preview') {
    report('initialCanvasTab', 'info', 'mode-mismatch', '읽기 전용 출력 화면이 편집 탭에서 시작하도록 설정되어 있습니다.', '읽기 화면에서는 미리보기 시작이 적절한지 확인하세요.');
  }
  if (context.editableMode && !settings.allowCanvasBoxSelection) {
    report('allowCanvasBoxSelection', 'blocking-risk', 'capability-blocked', '편집 가능한 화면이지만 상자 선택 정책이 none입니다.', '선택/이동 버튼을 쓸 수 있어야 하면 이 설정을 ON으로 바꾸세요.');
  }
  if (context.readOnlyDraftOutput && settings.allowCanvasBoxSelection) {
    report('allowCanvasBoxSelection', 'info', 'mode-mismatch', `읽기 출력 화면에서 ${canvasTextInteractionMode} 텍스트 상호작용 정책이 적용됩니다.`, '읽기 화면에서 상자 선택이 필요한지 확인하세요.');
  }

  return canvasOwnerSettingKeys.map((settingKey) => {
    const diagnostic = diagnosticsByKey.get(settingKey);

    return {
      settingKey,
      definitionName: canvasOwnerSettingDefinitionNames[settingKey],
      label: canvasOwnerSettingLabels[settingKey],
      severity: diagnostic?.severity || 'none',
      category: diagnostic?.category || 'none',
      configuredValue: formatCanvasOwnerDiagnosticValue(settings[settingKey]),
      effectiveValue: formatCanvasOwnerDiagnosticValue(effectiveValues[settingKey]),
      message: diagnostic?.message || '현재 선택한 page 조건에서 별도 충돌이 감지되지 않았습니다.',
      recommendedAction: diagnostic?.recommendedAction || '현재 설정을 유지해도 됩니다.',
    };
  });
};

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
    ...buildCanvasToolbarVisibility(settings),
  } as TemplateEditWorkspaceCanvasToolbarVisibility;
  const persistenceVisibility = {
    ...(baseProps.persistenceVisibility || {}),
    ...buildPersistenceVisibility(settings),
  } as TemplateEditWorkspacePersistenceVisibility;
  const templateUsagePreviewLayoutDebugOptions = {
    ...(baseProps.templateUsagePreviewLayoutDebugOptions || {}),
  };
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
    saveDisabled: shouldApplySetting('saveDisabled')
      ? Boolean(baseProps.saveDisabled || settings.saveDisabled)
      : baseProps.saveDisabled,
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
