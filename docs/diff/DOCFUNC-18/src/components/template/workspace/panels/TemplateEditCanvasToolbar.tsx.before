'use client';

import {
  Eye,
  EyeOff,
  KeyRound,
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
} from 'lucide-react';
import * as React from 'react';
import { Button } from '../../../ui/Button';
import { CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import type { TemplateEditWorkspaceCanvasToolbarVisibility } from '../types';

type TemplateEditCanvasToolbarProps = {
  documentMode: boolean;
  readMode: boolean;
  nameFieldLabel: string;
  saveButtonLabel: string;
  templateNameReadOnly: boolean;
  saveDisabled: boolean;
  templateName: string;
  loading: boolean;
  saving: boolean;
  canvasFullscreen: boolean;
  previewZoom: number;
  selectionPanelTab: 'position' | 'metadata';
  editSettingsPanelVisible: boolean;
  editSettingsPanelAvailable: boolean;
  templateUsagePreviewMode: boolean;
  renderedPreviewHtml: string;
  canvasInteractionMode: 'select' | 'move';
  canUndoCanvasHistory: boolean;
  canRedoCanvasHistory: boolean;
  visibility?: TemplateEditWorkspaceCanvasToolbarVisibility;
  onUpdatePreviewZoom: (nextValue: number | ((previous: number) => number)) => void;
  onToggleCanvasFullscreen: () => void;
  onToggleEditSettingsPanel: () => void;
  onSelectionPanelTabChange: (tab: 'position' | 'metadata') => void;
  onToggleTemplateUsagePreviewMode: () => void;
  onCanvasInteractionModeChange: (mode: 'select' | 'move') => void;
  onUndoCanvasHistory: () => void;
  onRedoCanvasHistory: () => void;
  onTemplateNameChange: (nextName: string) => void;
  onSave: () => void;
};

const canvasToolbarGroupClassName = 'min-w-0 rounded-md bg-white';
const canvasZoomButtonClassName =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900';
const canvasToolbarButtonBaseClassName =
  'v106-canvas-toolbar-button relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border border-slate-300 px-2 text-xs font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:pointer-events-none disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-100';

const getCanvasToolbarButtonStateClassName = (active: boolean, disabled = false) => {
  if (disabled) {
    return 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-100';
  }

  return active ? 'border-slate-300 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50';
};

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
  documentMode,
  readMode,
  nameFieldLabel,
  saveButtonLabel,
  templateNameReadOnly,
  saveDisabled,
  templateName,
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
  visibility,
  onUpdatePreviewZoom,
  onToggleCanvasFullscreen,
  onToggleEditSettingsPanel,
  onSelectionPanelTabChange,
  onToggleTemplateUsagePreviewMode,
  onCanvasInteractionModeChange,
  onUndoCanvasHistory,
  onRedoCanvasHistory,
  onTemplateNameChange,
  onSave,
}: TemplateEditCanvasToolbarProps) => {
  const showCanvasTitle = visibility?.showCanvasTitle !== false;
  const showTemplateNameInput = visibility?.showTemplateNameInput !== false;
  const showSaveButton = visibility?.showSaveButton !== false;
  const showPreviewToggle = visibility?.showPreviewToggle !== false;
  const showInteractionModeControls = visibility?.showInteractionModeControls !== false;
  const showHistoryControls = visibility?.showHistoryControls !== false;
  const showZoomControls = visibility?.showZoomControls !== false;
  const showFullscreenControl = visibility?.showFullscreenControl !== false;
  const showEditSettingsToggle = visibility?.showEditSettingsToggle !== false;
  const showSelectionPanelTabs = visibility?.showSelectionPanelTabs !== false;
  const renderTemplateNameInput = !documentMode && !readMode && showTemplateNameInput;
  const renderSaveButton = !readMode && showSaveButton;
  const renderPreviewToggle = !readMode && showPreviewToggle;
  const renderInteractionModeControls = !documentMode && !readMode && showInteractionModeControls;
  const renderEditSettingsToggle = !documentMode && !readMode && showEditSettingsToggle;
  const renderSelectionPanelTabs = !documentMode && !readMode && showSelectionPanelTabs;
  const renderHistoryControls = !readMode && showHistoryControls;
  const renderZoomControls = showZoomControls;
  const renderFullscreenControl = showFullscreenControl;
  const showHeaderActions = renderTemplateNameInput || renderSaveButton;
  const showHeader = showCanvasTitle || showHeaderActions;
  const showToolbarBody =
    renderPreviewToggle ||
    renderInteractionModeControls ||
    renderHistoryControls ||
    renderZoomControls ||
    renderFullscreenControl ||
    renderEditSettingsToggle ||
    renderSelectionPanelTabs;

  return (
  <>
    {showHeader ? (
    <CardHeader className={`space-y-4 pb-3 ${canvasFullscreen ? 'shrink-0' : ''}`}>
      <div className="flex items-center gap-3">
        {showCanvasTitle ? (
        <div className="min-w-0 shrink-0">
          <CardTitle>상자 편집 캔버스</CardTitle>
        </div>
        ) : null}
        {readMode ? null : (
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
            {renderTemplateNameInput ? (
              <div className="relative min-w-0 max-w-[420px] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-slate-500">
                  <span className="sm:hidden">이름:</span>
                  <span className="hidden sm:inline">{nameFieldLabel}</span>
                </span>
                <Input
                  value={templateName}
                  onChange={(event) => onTemplateNameChange(event.target.value)}
                  disabled={loading || templateNameReadOnly}
                  readOnly={templateNameReadOnly}
                  aria-label={nameFieldLabel}
                  className="h-9 pl-12 sm:pl-[7.75rem]"
                />
              </div>
            ) : null}
            {renderSaveButton ? (
              <Button
                onClick={onSave}
                disabled={saveDisabled || saving || loading || !renderedPreviewHtml.trim() || (templateUsagePreviewMode && !documentMode)}
                aria-label={saving ? '저장 중...' : saveButtonLabel}
                className="h-9 w-9 shrink-0 px-0 sm:w-auto sm:px-4"
              >
                <Save className="h-4 w-4 shrink-0 sm:mr-1" />
                <span className="hidden sm:inline">{saving ? '저장 중...' : saveButtonLabel}</span>
                <span className="sr-only sm:hidden">{saving ? '저장 중...' : saveButtonLabel}</span>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </CardHeader>
    ) : null}
    {showToolbarBody ? (
      <CardContent className={`border-b border-slate-200 bg-white px-6 pb-6 pt-0 ${canvasFullscreen ? 'shrink-0' : ''}`}>
      <div className="v106-canvas-toolbar flex w-full min-w-0 flex-wrap items-stretch gap-2 md:gap-3">
        {renderPreviewToggle ? (
        <div className={`${canvasToolbarGroupClassName} shrink-0`}>
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('single')} ${getCanvasToolbarButtonStateClassName(templateUsagePreviewMode, !renderedPreviewHtml.trim())}`}
            onClick={documentMode ? undefined : onToggleTemplateUsagePreviewMode}
            disabled={!renderedPreviewHtml.trim()}
            aria-pressed={templateUsagePreviewMode}
            aria-label={documentMode ? '미리보기' : templateUsagePreviewMode ? '편집 모드로 보기' : '실제 사용 미리보기'}
            title={documentMode ? '미리보기' : templateUsagePreviewMode ? '편집 모드로 보기' : '실제 사용 미리보기'}
          >
            {documentMode ? <Eye className="h-4 w-4" /> : templateUsagePreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="v106-canvas-toolbar-label">{documentMode ? '미리보기' : templateUsagePreviewMode ? '편집 모드' : '미리보기'}</span>
          </button>
        </div>
        ) : null}
        {renderInteractionModeControls ? (
          <div className={`inline-grid h-9 shrink-0 grid-cols-2 ${canvasToolbarGroupClassName}`} aria-label="캔버스 조작 모드">
            <button
              type="button"
              className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('first')} ${getCanvasToolbarButtonStateClassName(canvasInteractionMode === 'select', templateUsagePreviewMode)}`}
              onClick={() => onCanvasInteractionModeChange('select')}
              disabled={templateUsagePreviewMode}
              aria-label="선택 모드"
              title="선택 모드"
            >
              <MousePointer2 className="h-4 w-4" />
              <span className="v106-canvas-toolbar-label">선택</span>
            </button>
            <button
              type="button"
              className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('last')} ${getCanvasToolbarButtonStateClassName(canvasInteractionMode === 'move', templateUsagePreviewMode)}`}
              onClick={() => onCanvasInteractionModeChange('move')}
              disabled={templateUsagePreviewMode}
              aria-label="이동 모드"
              title="이동 모드"
            >
              <Move className="h-4 w-4" />
              <span className="v106-canvas-toolbar-label">이동</span>
            </button>
          </div>
        ) : null}
        {renderHistoryControls ? (
        <div className={`inline-grid h-9 shrink-0 grid-cols-2 ${canvasToolbarGroupClassName}`} aria-label="캔버스 실행 기록">
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('first')} ${getCanvasToolbarButtonStateClassName(false, !documentMode && (!canUndoCanvasHistory || templateUsagePreviewMode))}`}
            onMouseDown={documentMode ? (event) => event.preventDefault() : undefined}
            onClick={onUndoCanvasHistory}
            disabled={!documentMode && (!canUndoCanvasHistory || templateUsagePreviewMode)}
            aria-label="되돌리기"
            title="되돌리기"
          >
            <Undo2 className="h-4 w-4" />
            <span className="v106-canvas-toolbar-label">되돌리기</span>
          </button>
          <button
            type="button"
            className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName('last')} ${getCanvasToolbarButtonStateClassName(false, !documentMode && (!canRedoCanvasHistory || templateUsagePreviewMode))}`}
            onMouseDown={documentMode ? (event) => event.preventDefault() : undefined}
            onClick={onRedoCanvasHistory}
            disabled={!documentMode && (!canRedoCanvasHistory || templateUsagePreviewMode)}
            aria-label="다시 실행하기"
            title="다시 실행하기"
          >
            <Redo2 className="h-4 w-4" />
            <span className="v106-canvas-toolbar-label">다시 실행</span>
          </button>
        </div>
        ) : null}
        {renderZoomControls ? (
        <div className="v106-canvas-toolbar-zoom-group flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-0">
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
        <div className={`${canvasToolbarGroupClassName} shrink-0`}>
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
          <div className={`${canvasToolbarGroupClassName} shrink-0`}>
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
          <div className={`inline-grid h-9 shrink-0 grid-cols-2 ${canvasToolbarGroupClassName}`} aria-label="상자 편집 탭">
            {([
              { key: 'position', label: '크기 및 위치', icon: Move },
              { key: 'metadata', label: '속성', icon: KeyRound },
            ] as const).map((tab, index) => {
              const TabIcon = tab.icon;
              const isActive = selectionPanelTab === tab.key;

              return (
                <button
                  key={`selection-panel-tab:${tab.key}`}
                  type="button"
                  className={`${canvasToolbarButtonBaseClassName} ${getCanvasToolbarButtonShapeClassName(index === 0 ? 'first' : 'last')} ${getCanvasToolbarButtonStateClassName(isActive)}`}
                  onClick={() => onSelectionPanelTabChange(tab.key)}
                  aria-pressed={isActive}
                  aria-label={tab.label}
                  title={tab.label}
                >
                  <TabIcon className="h-4 w-4" />
                  <span className="v106-canvas-toolbar-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      </CardContent>
    ) : null}
  </>
  );
};
