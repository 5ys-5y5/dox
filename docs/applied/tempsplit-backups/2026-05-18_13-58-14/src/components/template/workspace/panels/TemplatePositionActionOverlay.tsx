'use client';

import type { PositionGroupEditMode } from '../types';

type TemplatePositionActionOverlayProps = {
  positionOrderLockSelectionMode: boolean;
  positionGroupEditMode: PositionGroupEditMode;
  hasSelectedPositionBoxes: boolean;
  boxCreationMode: boolean;
  canCreatePositionGroupFromSelection: boolean;
  canOpenPositionSpacingSettings: boolean;
  canClearSelectedPositionGroups: boolean;
  canRemoveSelectedItemsFromGroup: boolean;
  canAssignSelectedItemsToGroup: boolean;
  onToggleBoxCreationMode: () => void;
  onApplySelectedPositionGroupRelation: () => void;
  onStartPositionOrderLockSelection: () => void;
  onClearSelectedPositionGroupRelation: () => void;
  onStartPositionGroupExcludeMode: () => void;
  onStartPositionGroupIncludeMode: () => void;
  onCancelPositionGroupEditMode: () => void;
};

export const TemplatePositionActionOverlay = ({
  positionOrderLockSelectionMode,
  positionGroupEditMode,
  hasSelectedPositionBoxes,
  boxCreationMode,
  canCreatePositionGroupFromSelection,
  canOpenPositionSpacingSettings,
  canClearSelectedPositionGroups,
  canRemoveSelectedItemsFromGroup,
  canAssignSelectedItemsToGroup,
  onToggleBoxCreationMode,
  onApplySelectedPositionGroupRelation,
  onStartPositionOrderLockSelection,
  onClearSelectedPositionGroupRelation,
  onStartPositionGroupExcludeMode,
  onStartPositionGroupIncludeMode,
  onCancelPositionGroupEditMode,
}: TemplatePositionActionOverlayProps) => {
  const canShowPositionActions = !positionOrderLockSelectionMode && positionGroupEditMode.kind === 'idle';
  const canShowPositionGroupEditMode = !positionOrderLockSelectionMode && positionGroupEditMode.kind !== 'idle';

  if (!canShowPositionActions && !canShowPositionGroupEditMode) {
    return null;
  }

  return (
    <div className="space-y-2">
      {canShowPositionActions ? (
        <div className="flex flex-col gap-1.5">
          {!hasSelectedPositionBoxes || boxCreationMode ? (
            <button
              type="button"
              className={`inline-flex h-7 w-full items-center justify-center rounded-md border px-2 text-[11px] font-medium transition ${
                boxCreationMode
                  ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              onClick={onToggleBoxCreationMode}
            >
              {boxCreationMode ? '상자 생성 종료' : '상자 생성'}
            </button>
          ) : null}
          {canCreatePositionGroupFromSelection ? (
            <button
              type="button"
              className="inline-flex h-7 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={onApplySelectedPositionGroupRelation}
            >
              그룹 만들기
            </button>
          ) : null}
          {canOpenPositionSpacingSettings ? (
            <button
              type="button"
              className="inline-flex h-7 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={onStartPositionOrderLockSelection}
            >
              간격 설정
            </button>
          ) : null}
          {canClearSelectedPositionGroups ? (
            <button
              type="button"
              className="inline-flex h-7 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={onClearSelectedPositionGroupRelation}
            >
              그룹 해제
            </button>
          ) : null}
          {canRemoveSelectedItemsFromGroup ? (
            <button
              type="button"
              className="inline-flex h-7 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={onStartPositionGroupExcludeMode}
            >
              그룹에서 제외
            </button>
          ) : null}
          {canAssignSelectedItemsToGroup ? (
            <button
              type="button"
              className="inline-flex h-7 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={onStartPositionGroupIncludeMode}
            >
              그룹에 포함
            </button>
          ) : null}
        </div>
      ) : null}
      {canShowPositionGroupEditMode ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-4 text-amber-900">
          <div>
            <div className="font-semibold text-amber-950">
              {positionGroupEditMode.kind === 'exclude-from-group' ? '그룹에서 제외' : '그룹에 포함'}
            </div>
            <div>
              {positionGroupEditMode.kind === 'exclude-from-group'
                ? '제외할 상자 또는 하위 그룹을 선택하세요.'
                : '포함시킬 대상 그룹을 선택하세요.'}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-6 items-center justify-center rounded border border-amber-300 bg-white px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
            onClick={onCancelPositionGroupEditMode}
            aria-label="그룹 편집 모드 종료"
          >
            x
          </button>
        </div>
      ) : null}
    </div>
  );
};
