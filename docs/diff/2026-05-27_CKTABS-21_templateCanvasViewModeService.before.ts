import type {
  TemplateCanvasSelectionPanelTab,
  TemplateCanvasViewMode,
} from '../lib/templateCanvasViewDtos';

export type TemplateCanvasViewModeDefinition = {
  mode: TemplateCanvasViewMode;
  selectionPanelTab: TemplateCanvasSelectionPanelTab;
  label: string;
  description: string;
  ownerItem: string;
  metadataVisualMode: boolean;
  runtimePreviewMode: boolean;
};

export const TEMPLATE_CANVAS_VIEW_MODE_DEFINITIONS: readonly TemplateCanvasViewModeDefinition[] = [
  {
    mode: 'preview',
    selectionPanelTab: 'position',
    label: '미리보기',
    description: '실제 사용 화면',
    ownerItem: 'canvas-page-root-button-미리보기',
    metadataVisualMode: false,
    runtimePreviewMode: true,
  },
  {
    mode: 'position',
    selectionPanelTab: 'position',
    label: '크기 및 위치',
    description: '크기와 위치',
    ownerItem: 'canvas-page-root-button-크기-및-위치',
    metadataVisualMode: false,
    runtimePreviewMode: false,
  },
  {
    mode: 'metadata',
    selectionPanelTab: 'metadata',
    label: '속성',
    description: '키/밸류 속성',
    ownerItem: 'canvas-page-root-button-속성',
    metadataVisualMode: true,
    runtimePreviewMode: false,
  },
  {
    mode: 'metadata2',
    selectionPanelTab: 'metadata2',
    label: '속성2',
    description: '키/밸류 속성',
    ownerItem: 'canvas-page-root-button-속성2',
    metadataVisualMode: true,
    runtimePreviewMode: false,
  },
] as const;

export const normalizeTemplateCanvasViewMode = (
  value: unknown,
  fallback: TemplateCanvasViewMode = 'position'
): TemplateCanvasViewMode =>
  value === 'preview' || value === 'position' || value === 'metadata' || value === 'metadata2'
    ? value
    : fallback;

export const getTemplateCanvasViewModeDefinition = (
  viewMode: TemplateCanvasViewMode
): TemplateCanvasViewModeDefinition =>
  TEMPLATE_CANVAS_VIEW_MODE_DEFINITIONS.find((definition) => definition.mode === viewMode) ||
  TEMPLATE_CANVAS_VIEW_MODE_DEFINITIONS[1];

export const resolveTemplateCanvasSelectionPanelTab = (
  viewMode: TemplateCanvasViewMode
): TemplateCanvasSelectionPanelTab => getTemplateCanvasViewModeDefinition(viewMode).selectionPanelTab;

export const resolveTemplateCanvasViewModeForSelectionPanelTab = (
  tab: TemplateCanvasSelectionPanelTab
): TemplateCanvasViewMode => {
  if (tab === 'metadata2') {
    return 'metadata2';
  }

  if (tab === 'metadata') {
    return 'metadata';
  }

  return 'position';
};

export const isTemplateCanvasMetadataViewMode = (viewMode: TemplateCanvasViewMode) =>
  viewMode === 'metadata' || viewMode === 'metadata2';

export const isTemplateCanvasMetadataSelectionPanelTab = (tab: TemplateCanvasSelectionPanelTab) =>
  tab === 'metadata' || tab === 'metadata2';
