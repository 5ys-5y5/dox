'use client';

import {
  Eye,
  EyeOff,
  KeyRound,
  ListTodo,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  Move,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Save,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import { Button } from '../../../ui/Button';
import { CardContent } from '../../../ui/Card';
import type { SelectionPanelTab, TemplateEditWorkspaceCanvasToolbarVisibility } from '../types';

type TemplateEditCanvasToolbarProps = {
  placement?: 'top' | 'bottom';
  documentDraftSaveEnabled: boolean;
  readOnlyDraftOutput: boolean;
  nameFieldLabel: string;
  saveButtonLabel: string;
  templateNameReadOnly: boolean;
  saveDisabled: boolean;
  templateName: string;
  loading: boolean;
  saving: boolean;
  canvasFullscreen: boolean;
  previewZoom: number;
  selectionPanelTab: SelectionPanelTab;
  editSettingsPanelVisible: boolean;
  editSettingsPanelAvailable: boolean;
  templateUsagePreviewMode: boolean;
  renderedPreviewHtml: string;
  canvasInteractionMode: 'select' | 'move';
  canUndoCanvasHistory: boolean;
  canRedoCanvasHistory: boolean;
  todoButtonLabel?: string;
  todoCount?: number;
  todoPanelOpen?: boolean;
  todoButtonDisabled?: boolean;
  visibility?: TemplateEditWorkspaceCanvasToolbarVisibility;
  onUpdatePreviewZoom: (nextValue: number | ((previous: number) => number)) => void;
  onToggleCanvasFullscreen: () => void;
  onToggleEditSettingsPanel: () => void;
  onSelectionPanelTabChange: (tab: SelectionPanelTab) => void;
  onToggleTemplateUsagePreviewMode: (options?: { forceEnter?: boolean; forceExit?: boolean }) => void;
  onCanvasInteractionModeChange: (mode: 'select' | 'move') => void;
  onUndoCanvasHistory: () => void;
  onRedoCanvasHistory: () => void;
  onTemplateNameChange: (nextName: string) => void;
  onSave: () => void;
  onToggleTodoPanel?: () => void;
};

type CanvasToolbarViewTabKey = 'preview' | SelectionPanelTab;

const canvasToolbarGroupClassName = 'min-w-0 rounded-md bg-white';
const canvasZoomButtonClassName =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900';
const canvasToolbarButtonBaseClassName =
  'v106-canvas-toolbar-button relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border border-slate-300 px-2 text-xs font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:pointer-events-none disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-100';
const canvasOwnerEnv = (definitionName = '') => ({ env: definitionName });
const canvasToolbarCollapseLevels = [0, 1, 2, 3, 4, 5] as const;
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

type CanvasToolbarLayoutState = {
  collapseLevel: number;
  wrap: boolean;
};

const applyCanvasToolbarMeasurementState = (
  toolbar: HTMLDivElement,
  collapseLevel: number,
  wrap: boolean
) => {
  toolbar.dataset.canvasToolbarCollapseLevel = String(collapseLevel);
  toolbar.dataset.canvasToolbarWrap = wrap ? 'true' : 'false';
  void toolbar.offsetWidth;
};

const getCanvasToolbarLayoutState = (toolbar: HTMLDivElement): CanvasToolbarLayoutState => {
  if (toolbar.clientWidth <= 0) {
    return { collapseLevel: 5, wrap: false };
  }

  for (const collapseLevel of canvasToolbarCollapseLevels) {
    applyCanvasToolbarMeasurementState(toolbar, collapseLevel, false);

    if (toolbar.scrollWidth <= toolbar.clientWidth + 1) {
      return { collapseLevel, wrap: false };
    }
  }

  applyCanvasToolbarMeasurementState(toolbar, 5, false);

  return { collapseLevel: 5, wrap: toolbar.scrollWidth > toolbar.clientWidth + 1 };
};

const getCanvasToolbarButtonStateClassName = (active: boolean, disabled = false) => {
  if (disabled) {
    return 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-100';
  }

  return active ? 'border-slate-300 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50';
};

const canvasToolbarButtonActiveVisualClassNames = ['bg-slate-900', 'text-white', 'hover:bg-slate-800'] as const;
const canvasToolbarButtonInactiveVisualClassNames = ['bg-white', 'text-slate-900', 'hover:bg-slate-50'] as const;
const canvasToolbarButtonDisabledVisualClassNames = ['bg-slate-100', 'text-slate-600', 'hover:bg-slate-100'] as const;
const canvasToolbarButtonImmediateVisualClassNames = [
  ...canvasToolbarButtonActiveVisualClassNames,
  ...canvasToolbarButtonInactiveVisualClassNames,
  ...canvasToolbarButtonDisabledVisualClassNames,
] as const;

const applyImmediateSelectionPanelTabVisualState = (
  clickedButton: HTMLButtonElement,
  activeTabKey: CanvasToolbarViewTabKey
) => {
  const tabRoot = clickedButton.closest<HTMLElement>(
    '[data-canvas-owner-item="canvas-container-상자-편집-탭"]'
  );

  if (!tabRoot) {
    return;
  }

  tabRoot.setAttribute('data-canvas-toolbar-active-tab', activeTabKey);
  tabRoot.querySelectorAll<HTMLButtonElement>('[data-canvas-toolbar-view-tab-key]').forEach((button) => {
    const buttonTabKey = button.getAttribute('data-canvas-toolbar-view-tab-key');
    const active = buttonTabKey === activeTabKey;

    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.remove(...canvasToolbarButtonImmediateVisualClassNames);
    button.classList.add(
      ...(active ? canvasToolbarButtonActiveVisualClassNames : canvasToolbarButtonInactiveVisualClassNames)
    );
  });

  const canvasCard = clickedButton.closest<HTMLElement>('.template-edit-canvas-card');

  if (!canvasCard) {
    return;
  }

  const editorRoot = canvasCard.querySelector<HTMLElement>('[data-template-canvas-editor-room="true"]');
  const editorContainer = canvasCard.querySelector<HTMLElement>(
    '[data-template-canvas-editor-room-container="true"]'
  );
  const previewRoot = canvasCard.querySelector<HTMLElement>('[data-template-canvas-preview-room="true"]');
  const useTemplatePreviewRoom = activeTabKey === 'preview' && Boolean(previewRoot);

  if (editorContainer) {
    editorContainer.classList.toggle('pointer-events-none', useTemplatePreviewRoom);
    editorContainer.classList.toggle('z-0', useTemplatePreviewRoom);
    editorContainer.classList.toggle('z-10', !useTemplatePreviewRoom);

    if (useTemplatePreviewRoom) {
      editorContainer.setAttribute('aria-hidden', 'true');
    } else {
      editorContainer.removeAttribute('aria-hidden');
    }
  }

  if (editorRoot) {
    editorRoot.classList.toggle('pointer-events-none', useTemplatePreviewRoom);
    editorRoot.classList.toggle('invisible', useTemplatePreviewRoom);
    editorRoot.classList.toggle('z-0', useTemplatePreviewRoom);
    editorRoot.classList.toggle('z-10', !useTemplatePreviewRoom);
    editorRoot.setAttribute('data-canvas-prepared-view-visible', useTemplatePreviewRoom ? 'false' : 'true');
    editorRoot.setAttribute('data-canvas-prepared-view-match', useTemplatePreviewRoom ? 'false' : 'true');

    if (activeTabKey !== 'preview') {
      const metadataVisualActive = activeTabKey === 'metadata' || activeTabKey === 'metadata2';
      editorRoot.removeAttribute('aria-hidden');
      editorRoot.setAttribute('data-selection-panel-tab', activeTabKey);
      editorRoot.setAttribute('data-metadata-visual-active', metadataVisualActive ? 'true' : 'false');
      editorRoot.setAttribute('data-canvas-prepared-view-tab', activeTabKey);
      editorRoot.setAttribute('data-canvas-prepared-view-cache-key', `${activeTabKey}:${activeTabKey}`);
      editorRoot.setAttribute('data-canvas-prepared-view-requested-tab', activeTabKey);
    } else if (useTemplatePreviewRoom) {
      editorRoot.setAttribute('aria-hidden', 'true');
    }
  }

  if (previewRoot) {
    previewRoot.classList.toggle('pointer-events-none', !useTemplatePreviewRoom);
    previewRoot.classList.toggle('invisible', !useTemplatePreviewRoom);
    previewRoot.classList.toggle('z-0', !useTemplatePreviewRoom);
    previewRoot.classList.toggle('z-20', useTemplatePreviewRoom);
    previewRoot.setAttribute('data-canvas-prepared-view-visible', useTemplatePreviewRoom ? 'true' : 'false');
    previewRoot.setAttribute('data-canvas-prepared-view-match', useTemplatePreviewRoom ? 'true' : 'false');

    if (useTemplatePreviewRoom) {
      previewRoot.removeAttribute('aria-hidden');
    } else {
      previewRoot.setAttribute('aria-hidden', 'true');
    }
  }

  if (activeTabKey !== 'preview') {
    const overlayRail = canvasCard.querySelector<HTMLElement>('[data-template-overlay-rail="true"]');

    overlayRail?.setAttribute('data-template-overlay-rail-active-tab', activeTabKey);
    overlayRail?.querySelectorAll<HTMLElement>('[data-template-overlay-rail-room]').forEach((room) => {
      const active = room.getAttribute('data-template-overlay-rail-room') === activeTabKey;

      room.classList.toggle('hidden', !active);
      room.classList.toggle('flex', active);
      room.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }
};

const readImmediatePreviewTabActive = (target: HTMLElement) =>
  target
    .closest('[data-canvas-owner-item="canvas-container-상자-편집-탭"]')
    ?.querySelector<HTMLElement>('[data-canvas-toolbar-view-tab-key="preview"]')
    ?.getAttribute('aria-pressed') === 'true';

const getCanvasToolbarButtonShapeClassName = (position: 'single' | 'first' | 'middle' | 'last') => {
  if (position === 'single') {
    return 'rounded-md';
  }

  if (position === 'first') {
    return 'rounded-l-md';
  }

  if (position === 'last') {
    return '-ml-px rounded-r-md';
  }

  return '-ml-px';
};

export const TemplateEditCanvasToolbar = ({
  placement = 'top',
  documentDraftSaveEnabled,
  readOnlyDraftOutput,
  saveButtonLabel,
  saveDisabled,
  loading,
  saving,
  canvasFullscreen,
  previewZoom,
  selectionPanelTab,
  editSettingsPanelVisible,
  editSettingsPanelAvailable,
  templateUsagePreviewMode,
  renderedPreviewHtml,
  canvasInteractionMode,
  canUndoCanvasHistory,
  canRedoCanvasHistory,
  todoButtonLabel = '할 일',
  todoCount = 0,
  todoPanelOpen = false,
  todoButtonDisabled = false,
  visibility,
  onUpdatePreviewZoom,
  onToggleCanvasFullscreen,
  onToggleEditSettingsPanel,
  onSelectionPanelTabChange,
  onToggleTemplateUsagePreviewMode,
  onCanvasInteractionModeChange,
  onUndoCanvasHistory,
  onRedoCanvasHistory,
  onSave,
  onToggleTodoPanel,
}: TemplateEditCanvasToolbarProps) => {
  const isBottomToolbar = placement === 'bottom';
  const isTopToolbar = placement === 'top';
  const showSaveButton = visibility?.showSaveButton !== false;
  const showTodoButton = visibility?.showTodoButton !== false;
  const showPreviewToggle = visibility?.showPreviewToggle !== false;
  const showInteractionModeControls = visibility?.showInteractionModeControls !== false;
  const showHistoryControls = visibility?.showHistoryControls !== false;
  const showZoomControls = visibility?.showZoomControls !== false;
  const showFullscreenControl = visibility?.showFullscreenControl !== false;
  const showEditSettingsToggle = visibility?.showEditSettingsToggle !== false;
  const showSelectionPanelTabs = visibility?.showSelectionPanelTabs !== false;
  const renderSaveButton = isTopToolbar && showSaveButton;
  const renderTodoButton = isTopToolbar && showTodoButton;
  const renderInteractionModeControls =
    isBottomToolbar && showInteractionModeControls && !templateUsagePreviewMode && !readOnlyDraftOutput;
  const renderEditSettingsToggle =
    isTopToolbar && showEditSettingsToggle && !templateUsagePreviewMode && !readOnlyDraftOutput;
  const renderSelectionPanelTabs = isTopToolbar && showSelectionPanelTabs;
  const renderPreviewToggle = isTopToolbar && showPreviewToggle && !renderSelectionPanelTabs;
  const renderHistoryControls = isBottomToolbar && showHistoryControls;
  const renderZoomControls = isBottomToolbar && showZoomControls;
  const renderFullscreenControl = isBottomToolbar && showFullscreenControl;
  const showToolbarBody =
    renderSaveButton ||
    renderTodoButton ||
    renderPreviewToggle ||
    renderInteractionModeControls ||
    renderHistoryControls ||
    renderZoomControls ||
    renderFullscreenControl ||
    renderEditSettingsToggle ||
    renderSelectionPanelTabs;
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const [toolbarLayoutState, setToolbarLayoutState] = React.useState<CanvasToolbarLayoutState>({
    collapseLevel: 5,
    wrap: false,
  });
  const measureToolbarLayout = React.useCallback(() => {
    const toolbar = toolbarRef.current;

    if (!toolbar) {
      return;
    }

    const nextState = getCanvasToolbarLayoutState(toolbar);
    toolbar.dataset.canvasToolbarCollapseLevel = String(nextState.collapseLevel);
    toolbar.dataset.canvasToolbarWrap = nextState.wrap ? 'true' : 'false';
    setToolbarLayoutState((previousState) =>
      previousState.collapseLevel === nextState.collapseLevel && previousState.wrap === nextState.wrap
        ? previousState
        : nextState
    );
  }, []);

  useIsomorphicLayoutEffect(() => {
    measureToolbarLayout();
  });

  React.useEffect(() => {
    const toolbar = toolbarRef.current;

    if (!toolbar || typeof window === 'undefined') {
      return undefined;
    }

    let animationFrameId = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(measureToolbarLayout);
    };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);

    resizeObserver?.observe(toolbar);
    if (toolbar.parentElement) {
      resizeObserver?.observe(toolbar.parentElement);
    }
    Array.from(toolbar.children).forEach((child) => resizeObserver?.observe(child));

    window.addEventListener('resize', scheduleMeasure);
    scheduleMeasure();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [measureToolbarLayout]);

  return (
  <>
    {showToolbarBody ? (
      <CardContent
        className={`v106-canvas-toolbar-shell ${isBottomToolbar ? 'border-t' : 'border-b'} border-slate-200 bg-white px-3 py-3 ${canvasFullscreen ? 'shrink-0' : ''}`}
        data-canvas-owner-item={isBottomToolbar ? 'canvas-bottom-toolbar-body' : 'canvas-toolbar-body'}
        data-canvas-owner-name={isBottomToolbar ? '하단 캔버스 도구 모음' : '캔버스 도구 모음'}
      >
      <div
        ref={toolbarRef}
        className="v106-canvas-toolbar flex w-full min-w-0 flex-nowrap items-stretch gap-2 md:gap-3"
        data-canvas-owner-item={isBottomToolbar ? 'canvas-bottom-toolbar-controls' : 'canvas-toolbar-controls'}
        data-canvas-owner-name={isBottomToolbar ? '하단 캔버스 도구 버튼 묶음' : '캔버스 도구 버튼 묶음'}
        data-canvas-toolbar-placement={placement}
        data-canvas-toolbar-collapse-level={toolbarLayoutState.collapseLevel}
        data-canvas-toolbar-wrap={toolbarLayoutState.wrap ? 'true' : 'false'}
      >
        {renderPreviewToggle ? (
        <div
          className={`${canvasToolbarGroupClassName} shrink-0`}
          data-canvas-toolbar-collapse-priority="5"
          data-canvas-toolbar-group="preview"
          {...canvasOwnerEnv('canvasToolbarVisibility.showPreviewToggle')}
        >
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('single')} ${getCanvasToolbarButtonStateClassName(templateUsagePreviewMode, !renderedPreviewHtml.trim())}`}
            onClick={documentDraftSaveEnabled ? undefined : () => onToggleTemplateUsagePreviewMode()}
            disabled={!renderedPreviewHtml.trim()}
            aria-pressed={templateUsagePreviewMode}
            aria-label={documentDraftSaveEnabled ? '미리보기' : templateUsagePreviewMode ? '편집 화면으로 보기' : '실제 사용 미리보기'}
            title={documentDraftSaveEnabled ? '미리보기' : templateUsagePreviewMode ? '편집 화면으로 보기' : '실제 사용 미리보기'}
          >
            {documentDraftSaveEnabled ? <Eye className="h-4 w-4" /> : templateUsagePreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="v106-canvas-toolbar-label">{documentDraftSaveEnabled ? '미리보기' : templateUsagePreviewMode ? '편집 화면' : '미리보기'}</span>
          </button>
        </div>
        ) : null}
        {renderInteractionModeControls ? (
          <div
            className={`inline-grid h-9 shrink-0 grid-cols-2 ${canvasToolbarGroupClassName}`}
            aria-label="캔버스 조작"
            data-canvas-toolbar-collapse-priority="2"
            data-canvas-toolbar-group="interaction"
            {...canvasOwnerEnv('canvasToolbarVisibility.showInteractionToolControls')}
          >
            <button
              type="button"
              className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('first')} ${getCanvasToolbarButtonStateClassName(canvasInteractionMode === 'select', templateUsagePreviewMode)}`}
              onClick={() => onCanvasInteractionModeChange('select')}
              disabled={templateUsagePreviewMode}
              aria-label="선택"
              title="선택"
            >
              <MousePointer2 className="h-4 w-4" />
              <span className="v106-canvas-toolbar-label">선택</span>
            </button>
            <button
              type="button"
              className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('last')} ${getCanvasToolbarButtonStateClassName(canvasInteractionMode === 'move', templateUsagePreviewMode)}`}
              onClick={() => onCanvasInteractionModeChange('move')}
              disabled={templateUsagePreviewMode}
              aria-label="이동"
              title="이동"
            >
              <Move className="h-4 w-4" />
              <span className="v106-canvas-toolbar-label">이동</span>
            </button>
          </div>
        ) : null}
        {renderHistoryControls ? (
        <div
          className={`inline-grid h-9 shrink-0 grid-cols-2 ${canvasToolbarGroupClassName}`}
          aria-label="캔버스 실행 기록"
          data-canvas-toolbar-collapse-priority="3"
          data-canvas-toolbar-group="history"
          {...canvasOwnerEnv('canvasToolbarVisibility.showHistoryControls')}
        >
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('first')} ${getCanvasToolbarButtonStateClassName(false, !documentDraftSaveEnabled && (!canUndoCanvasHistory || templateUsagePreviewMode))}`}
            onMouseDown={documentDraftSaveEnabled ? (event) => event.preventDefault() : undefined}
            onClick={onUndoCanvasHistory}
            disabled={!documentDraftSaveEnabled && (!canUndoCanvasHistory || templateUsagePreviewMode)}
            aria-label="되돌리기"
            title="되돌리기"
          >
            <Undo2 className="h-4 w-4" />
            <span className="v106-canvas-toolbar-label">되돌리기</span>
          </button>
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('last')} ${getCanvasToolbarButtonStateClassName(false, !documentDraftSaveEnabled && (!canRedoCanvasHistory || templateUsagePreviewMode))}`}
            onMouseDown={documentDraftSaveEnabled ? (event) => event.preventDefault() : undefined}
            onClick={onRedoCanvasHistory}
            disabled={!documentDraftSaveEnabled && (!canRedoCanvasHistory || templateUsagePreviewMode)}
            aria-label="다시 실행하기"
            title="다시 실행하기"
          >
            <Redo2 className="h-4 w-4" />
            <span className="v106-canvas-toolbar-label">다시 실행</span>
          </button>
        </div>
        ) : null}
        {renderZoomControls ? (
        <div
          className={`v106-canvas-toolbar-zoom-group ${isBottomToolbar ? 'v106-canvas-toolbar-bottom-right-start' : ''} flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-0`}
          data-canvas-toolbar-collapse-priority="3"
          data-canvas-toolbar-group="zoom"
          {...canvasOwnerEnv('canvasToolbarVisibility.showZoomControls')}
        >
          <button
            type="button"
            className={canvasZoomButtonClassName}
            onClick={() => onUpdatePreviewZoom((previous) => previous - 10)}
            aria-label="문서 축소"
            title="문서 축소"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="v106-canvas-toolbar-zoom-slider-wrap flex min-w-0 flex-1 items-center gap-2">
            <input
              min={25}
              max={200}
              step={5}
              title="문서 확대 축소"
              className="h-2 min-w-0 flex-1 cursor-pointer accent-slate-900"
              aria-label="문서 확대 비율"
              aria-valuetext={`줌 ${previewZoom}%`}
              type="range"
              value={previewZoom}
              onChange={(event) => onUpdatePreviewZoom(Number.parseInt(event.currentTarget.value, 10) || 100)}
            />
            <span className="v106-canvas-toolbar-zoom-value shrink-0 text-center text-xs font-semibold tabular-nums text-slate-700">
              {previewZoom}%
            </span>
          </div>
          <button
            type="button"
            className={canvasZoomButtonClassName}
            onClick={() => onUpdatePreviewZoom((previous) => previous + 10)}
            aria-label="문서 확대"
            title="문서 확대"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        ) : null}
        {renderFullscreenControl ? (
        <div
          className={`${canvasToolbarGroupClassName} ${isBottomToolbar && !renderZoomControls ? 'v106-canvas-toolbar-bottom-right-start' : ''} shrink-0`}
          data-canvas-toolbar-collapse-priority="4"
          data-canvas-toolbar-group="fullscreen"
          {...canvasOwnerEnv('canvasToolbarVisibility.showFullscreenControl')}
        >
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('single')} ${getCanvasToolbarButtonStateClassName(canvasFullscreen)}`}
            onClick={onToggleCanvasFullscreen}
            aria-pressed={canvasFullscreen}
            aria-label={canvasFullscreen ? '전체 화면 종료' : '전체 화면'}
            title={canvasFullscreen ? '전체 화면 종료' : '전체 화면'}
          >
            {canvasFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="v106-canvas-toolbar-label">{canvasFullscreen ? '전체 화면 종료' : '전체 화면'}</span>
          </button>
        </div>
        ) : null}
        {renderEditSettingsToggle ? (
          <div
            className={`${canvasToolbarGroupClassName} shrink-0`}
            data-canvas-toolbar-collapse-priority="4"
            data-canvas-toolbar-group="edit-settings"
            {...canvasOwnerEnv('canvasToolbarVisibility.showEditSettingsToggle')}
          >
            <button
              type="button"
              className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('single')} ${getCanvasToolbarButtonStateClassName(
                editSettingsPanelVisible,
                !editSettingsPanelAvailable || templateUsagePreviewMode
              )}`}
              onClick={onToggleEditSettingsPanel}
              disabled={!editSettingsPanelAvailable || templateUsagePreviewMode}
              aria-pressed={editSettingsPanelVisible}
              aria-label={editSettingsPanelVisible ? '편집 설정 숨기기' : '편집 설정 펼치기'}
              title={editSettingsPanelVisible ? '편집 설정 숨기기' : '편집 설정 펼치기'}
            >
              {editSettingsPanelVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              <span className="v106-canvas-toolbar-label">편집 설정</span>
            </button>
          </div>
        ) : null}
        {renderSelectionPanelTabs ? (
          <div
            className={`inline-grid h-9 shrink-0 ${showPreviewToggle ? 'grid-cols-4' : 'grid-cols-3'} ${canvasToolbarGroupClassName}`}
            aria-label="상자 편집 탭"
            data-canvas-owner-item="canvas-container-상자-편집-탭"
            data-canvas-owner-name="상자 편집 탭"
            data-canvas-toolbar-collapse-priority="5"
            data-canvas-toolbar-group="selection-tabs"
            {...canvasOwnerEnv('canvasToolbarVisibility.showSelectionPanelTabs')}
          >
            {([
              {
                key: 'preview',
                label: '미리보기',
                icon: Eye,
                ownerItem: 'canvas-container-상자-편집-탭-미리보기',
                env: 'canvasToolbarVisibility.showPreviewToggle',
              },
              {
                key: 'position',
                label: '크기 및 위치',
                icon: Move,
                ownerItem: 'canvas-container-상자-편집-탭-크기-및-위치',
                env: 'canvasToolbarVisibility.showSelectionPanelTabs',
              },
              {
                key: 'metadata',
                label: '속성',
                icon: KeyRound,
                ownerItem: 'canvas-container-상자-편집-탭-속성',
                env: 'canvasToolbarVisibility.showSelectionPanelTabs',
              },
              {
                key: 'metadata2',
                label: '역할',
                icon: KeyRound,
                ownerItem: 'canvas-container-상자-편집-탭-역할',
                env: 'canvasToolbarVisibility.showSelectionPanelTabs',
              },
            ] as const satisfies ReadonlyArray<{
              key: CanvasToolbarViewTabKey;
              label: string;
              icon: LucideIcon;
              ownerItem: string;
              env: string;
            }>).filter((tab) => tab.key !== 'preview' || showPreviewToggle).map((tab, index, tabs) => {
              const TabIcon = tab.icon;
              const isPreviewTab = tab.key === 'preview';
              const isActive = isPreviewTab ? templateUsagePreviewMode : !templateUsagePreviewMode && selectionPanelTab === tab.key;
              const shape = tabs.length === 1 ? 'single' : index === 0 ? 'first' : index === tabs.length - 1 ? 'last' : 'middle';

              return (
                <button
                  key={`selection-panel-tab:${tab.key}`}
                  type="button"
                  className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName(shape)} ${getCanvasToolbarButtonStateClassName(isActive)}`}
                  onClick={(event) => {
                    if (isPreviewTab) {
                      if (!templateUsagePreviewMode) {
                        applyImmediateSelectionPanelTabVisualState(event.currentTarget, tab.key);
                        onToggleTemplateUsagePreviewMode({ forceEnter: true });
                      }
                      return;
                    }

                    const previewVisuallyActive = templateUsagePreviewMode || readImmediatePreviewTabActive(event.currentTarget);
                    applyImmediateSelectionPanelTabVisualState(event.currentTarget, tab.key);
                    onSelectionPanelTabChange(tab.key);
                    if (previewVisuallyActive) {
                      onToggleTemplateUsagePreviewMode({ forceExit: true });
                    }
                  }}
                  disabled={isPreviewTab && !renderedPreviewHtml.trim()}
                  aria-pressed={isActive}
                  aria-label={tab.label}
                  title={tab.label}
                  data-canvas-owner-item={tab.ownerItem}
                  data-canvas-owner-name={tab.label}
                  data-canvas-toolbar-view-tab-key={tab.key}
                  {...canvasOwnerEnv(tab.env)}
                >
                  <TabIcon className="h-4 w-4" />
                  <span className="v106-canvas-toolbar-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {renderSaveButton || renderTodoButton ? (
          <div
            className="v106-canvas-toolbar-actions ml-auto flex shrink-0 items-stretch gap-2"
            data-canvas-owner-item="canvas-toolbar-actions"
            data-canvas-owner-name="캔버스 저장 및 할 일 버튼 묶음"
            data-canvas-toolbar-collapse-priority="1"
            data-canvas-toolbar-group="actions"
          >
            {renderSaveButton ? (
              <Button
                {...canvasOwnerEnv('canvasToolbarVisibility.showSaveButton')}
                onClick={onSave}
                disabled={saveDisabled || saving || loading || !renderedPreviewHtml.trim() || (templateUsagePreviewMode && !documentDraftSaveEnabled)}
                aria-label={saving ? '저장 중...' : saveButtonLabel}
                className={`${canvasToolbarButtonBaseClassName} rounded-md`}
              >
                <Save className="h-4 w-4 shrink-0" />
                <span className="v106-canvas-toolbar-label">{saving ? '저장 중...' : saveButtonLabel}</span>
              </Button>
            ) : null}
            {renderTodoButton ? (
              <Button
                {...canvasOwnerEnv('canvasToolbarVisibility.showTodoButton')}
                type="button"
                variant="outline"
                onClick={onToggleTodoPanel}
                disabled={todoButtonDisabled || !onToggleTodoPanel}
                aria-pressed={todoPanelOpen}
                aria-label={todoButtonLabel}
                className={`${canvasToolbarButtonBaseClassName} rounded-md`}
              >
                <ListTodo className="h-4 w-4 shrink-0" />
                <span className="v106-canvas-toolbar-label">{todoButtonLabel}</span>
                {todoCount > 0 ? (
                  <span className="v106-canvas-toolbar-label ml-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {todoCount}
                  </span>
                ) : null}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      </CardContent>
    ) : null}
  </>
  );
};
