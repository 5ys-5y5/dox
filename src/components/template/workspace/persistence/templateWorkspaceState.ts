import type * as React from 'react';
import type { TemplateEdgeSelectionStateDto } from '../../../../lib/templateEdgeSelectionDtos';
import type { TemplateDetailResult, TemplateLayoutResizeMode, TemplateRecordDto } from '../../../../lib/templateDtos';
import type {
  CanvasHistoryEntry,
  EdgeRoleDiagnosticsState,
  FrameMetadataReviewIssue,
  FrameMetadataValidationIssue,
  SelectionSaveProgressState,
  TemplateEditWorkspaceInitialDraft,
} from '../types';

type TemplateWorkspaceDocumentState = {
  templateDetail: TemplateDetailResult | null;
  selectedTemplateId: string;
  templateName: string;
  sourceDocumentName: string;
  layoutResizeMode?: TemplateLayoutResizeMode;
  previewHtml: string;
  draftHtml: string;
  lastPersistedDraftHtml: string;
  syncTemplateQueryTo: string;
  resetHistoryEntry: CanvasHistoryEntry | null;
};

export type TemplateWorkspaceStateController = {
  pendingPreviewViewportResetRef: React.MutableRefObject<boolean>;
  selectedFrameGroupIdsRef: React.MutableRefObject<string[]>;
  frameOverlayCacheRef: React.MutableRefObject<Map<string, any>>;
  edgeSelectionStateRef: React.MutableRefObject<TemplateEdgeSelectionStateDto>;
  draftPreviewHtmlRef: React.MutableRefObject<string>;
  lastPersistedDraftHtmlRef: React.MutableRefObject<string>;
  queuedAutoPersistDraftHtmlRef: React.MutableRefObject<string>;
  setTemplateDetail: React.Dispatch<React.SetStateAction<TemplateDetailResult | null>>;
  setSelectedTemplateId: React.Dispatch<React.SetStateAction<string>>;
  setTemplateName: React.Dispatch<React.SetStateAction<string>>;
  setSourceDocumentName: React.Dispatch<React.SetStateAction<string>>;
  setLayoutResizeMode: React.Dispatch<React.SetStateAction<TemplateLayoutResizeMode>>;
  setPreviewHtml: React.Dispatch<React.SetStateAction<string>>;
  setTemplateUsagePreviewMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTemplateUsagePreviewHtml: React.Dispatch<React.SetStateAction<string>>;
  setSelectedFrameGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEdgeSelectionState: React.Dispatch<React.SetStateAction<TemplateEdgeSelectionStateDto>>;
  setSelectionValidationIssues: React.Dispatch<React.SetStateAction<FrameMetadataValidationIssue[]>>;
  setSelectionReviewIssues: React.Dispatch<React.SetStateAction<FrameMetadataReviewIssue[]>>;
  setSelectionSaveProgress: React.Dispatch<React.SetStateAction<SelectionSaveProgressState>>;
  syncEdgeRoleDiagnosticsState: (nextState: EdgeRoleDiagnosticsState) => void;
  cancelScheduledAutoPersistDraft: () => void;
  resetCanvasHistory: (entry?: CanvasHistoryEntry | null) => void;
  syncTemplateQuery: (templateId: string) => void;
  createEmptyEdgeSelection: () => TemplateEdgeSelectionStateDto;
  emptyEdgeRoleDiagnosticsState: EdgeRoleDiagnosticsState;
  defaultSelectionSaveProgressState: SelectionSaveProgressState;
};

export const mergeTemplateListRecord = (
  templates: TemplateRecordDto[],
  updatedTemplate: TemplateRecordDto,
  limit = 64
) => [updatedTemplate, ...templates.filter((item) => item.id !== updatedTemplate.id)].slice(0, limit);

export const buildPersistedTemplateDetail = (options: {
  previousDetail: TemplateDetailResult | null;
  updatedTemplate: TemplateRecordDto;
  templateName: string;
  sourceDocumentName: string;
  layoutResizeMode: TemplateLayoutResizeMode;
  persistedDraftHtml: string;
}): TemplateDetailResult => {
  const {
    previousDetail,
    updatedTemplate,
    templateName,
    sourceDocumentName,
    layoutResizeMode,
    persistedDraftHtml,
  } = options;

  if (previousDetail) {
    return {
      ...previousDetail,
      template: {
        ...previousDetail.template,
        id: updatedTemplate.id,
        templateName,
        sourceDocumentName,
        layoutResizeMode,
        draftHtml: persistedDraftHtml,
      },
    };
  }

  return {
    template: {
      ...updatedTemplate,
      templateName,
      sourceDocumentName,
      layoutResizeMode,
      draftHtml: persistedDraftHtml,
    },
    fields: [],
    labelBindings: [],
    signatureAreas: [],
    labelMap: [],
  };
};

const resetTemplateWorkspaceSelectionState = (controller: TemplateWorkspaceStateController) => {
  const emptyEdgeSelection = controller.createEmptyEdgeSelection();
  controller.selectedFrameGroupIdsRef.current = [];
  controller.frameOverlayCacheRef.current.clear();
  controller.edgeSelectionStateRef.current = emptyEdgeSelection;
  controller.setSelectedFrameGroupIds([]);
  controller.setEdgeSelectionState(emptyEdgeSelection);
  controller.syncEdgeRoleDiagnosticsState(controller.emptyEdgeRoleDiagnosticsState);
  controller.setSelectionValidationIssues([]);
  controller.setSelectionReviewIssues([]);
  controller.setSelectionSaveProgress(controller.defaultSelectionSaveProgressState);
};

export const applyTemplateWorkspaceDocumentState = (
  controller: TemplateWorkspaceStateController,
  nextState: TemplateWorkspaceDocumentState
) => {
  controller.pendingPreviewViewportResetRef.current = true;
  controller.setTemplateDetail(nextState.templateDetail);
  controller.setSelectedTemplateId(nextState.selectedTemplateId);
  controller.setTemplateName(nextState.templateName);
  controller.setSourceDocumentName(nextState.sourceDocumentName);
  if (nextState.layoutResizeMode !== undefined) {
    controller.setLayoutResizeMode(nextState.layoutResizeMode);
  }
  controller.setPreviewHtml(nextState.previewHtml);
  controller.setTemplateUsagePreviewMode(false);
  controller.setTemplateUsagePreviewHtml('');
  resetTemplateWorkspaceSelectionState(controller);
  controller.draftPreviewHtmlRef.current = nextState.draftHtml;
  controller.lastPersistedDraftHtmlRef.current = nextState.lastPersistedDraftHtml;
  controller.queuedAutoPersistDraftHtmlRef.current = '';
  controller.cancelScheduledAutoPersistDraft();
  controller.resetCanvasHistory(nextState.resetHistoryEntry);
  controller.syncTemplateQuery(nextState.syncTemplateQueryTo);
};

export const buildBlankTemplateWorkspaceDocumentState = (options?: {
  templateName?: string;
  sourceDocumentName?: string;
  layoutResizeMode?: TemplateLayoutResizeMode;
}): TemplateWorkspaceDocumentState => ({
  templateDetail: null,
  selectedTemplateId: '',
  templateName: options?.templateName || '',
  sourceDocumentName: options?.sourceDocumentName || '',
  layoutResizeMode: options?.layoutResizeMode,
  previewHtml: '',
  draftHtml: '',
  lastPersistedDraftHtml: '',
  syncTemplateQueryTo: '',
  resetHistoryEntry: null,
});

export const buildLoadedTemplateWorkspaceDocumentState = (
  detail: TemplateDetailResult,
  templateId: string
): TemplateWorkspaceDocumentState => {
  const normalizedTemplateId = templateId.trim() || detail.template.id;
  const draftHtml = detail.template.draftHtml;
  const normalizedHistoryHtml = draftHtml.trim();

  return {
    templateDetail: detail,
    selectedTemplateId: normalizedTemplateId,
    templateName: detail.template.templateName,
    sourceDocumentName: detail.template.sourceDocumentName || '',
    layoutResizeMode: detail.template.layoutResizeMode,
    previewHtml: draftHtml,
    draftHtml,
    lastPersistedDraftHtml: normalizedHistoryHtml,
    syncTemplateQueryTo: normalizedTemplateId,
    resetHistoryEntry: {
      renderHtml: normalizedHistoryHtml,
      draftHtml: normalizedHistoryHtml,
      selectedFrameGroupIds: [],
      positionGroupProxySelectionGroupId: '',
      showAllGroupProxySelections: false,
    },
  };
};

export const buildInitialDraftWorkspaceDocumentState = (
  initialDraft: Pick<
    TemplateEditWorkspaceInitialDraft,
    'draftHtml' | 'layoutResizeMode' | 'sourceDocumentName' | 'templateName'
  >
): TemplateWorkspaceDocumentState => {
  const normalizedDraftHtml = initialDraft.draftHtml.trim();

  return {
    templateDetail: null,
    selectedTemplateId: '',
    templateName: initialDraft.templateName.trim() || '새 템플릿 초안',
    sourceDocumentName: initialDraft.sourceDocumentName?.trim() || '',
    layoutResizeMode: initialDraft.layoutResizeMode || 'grow_height',
    previewHtml: normalizedDraftHtml,
    draftHtml: normalizedDraftHtml,
    lastPersistedDraftHtml: '',
    syncTemplateQueryTo: '',
    resetHistoryEntry: {
      renderHtml: normalizedDraftHtml,
      draftHtml: normalizedDraftHtml,
      selectedFrameGroupIds: [],
      positionGroupProxySelectionGroupId: '',
      showAllGroupProxySelections: false,
    },
  };
};
