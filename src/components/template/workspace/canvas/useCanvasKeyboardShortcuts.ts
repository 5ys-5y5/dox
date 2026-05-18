'use client';

import * as React from 'react';
import { TemplateEdgeSelectionService } from '../../../../services/templateEdgeSelectionService';

type UseCanvasKeyboardShortcutsOptions = {
  isInteractiveTarget: (target: HTMLElement | null) => boolean;
  cancelPositionGroupEditMode: () => void;
  clearFrameSelection: () => void;
  applyRuntimeSelectionUi: (selectedFrameGroupIds: string[], edgeSelectionState: any, mismatchEdgeIds?: string[]) => void;
  safeReleasePointerCapture: (owner: HTMLDivElement | null, pointerId?: number) => void;
  defaultSelectionSaveProgressState: any;
  selectedFrameGroupIdsLength: number;
  edgeSelectionTokensLength: number;
  positionOrderLockSelectionMode: boolean;
  selectedPositionSpacingSettingRelationKey: string;
  positionGroupEditModeRef: React.MutableRefObject<any>;
  selectedFrameGroupIdsRef: React.MutableRefObject<string[]>;
  edgeSelectionStateRef: React.MutableRefObject<any>;
  positionGroupProxySelectionGroupIdRef: React.MutableRefObject<string>;
  positionGroupProxySelectionShowAllGroupsRef: React.MutableRefObject<boolean>;
  positionGroupProxySelectionsOverrideRef: React.MutableRefObject<any>;
  positionActiveSelectionEntityRef: React.MutableRefObject<any>;
  canvasPanStateRef: React.MutableRefObject<any>;
  activePointerOwnerRef: React.MutableRefObject<HTMLDivElement | null>;
  setSpacePanArmed: React.Dispatch<React.SetStateAction<boolean>>;
  setSpacePanDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedFrameGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEdgeSelectionState: React.Dispatch<React.SetStateAction<any>>;
  setPositionOrderLockFrameGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPositionOrderLockSelectionKindByFrameGroupId: React.Dispatch<React.SetStateAction<Record<string, 'group' | 'frame'>>>;
  setPositionOrderLockSelectionGroupIdByFrameGroupId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSelectedPositionSpacingSettingRelationKey: React.Dispatch<React.SetStateAction<string>>;
  setPositionOrderLockCandidateFrameGroupId: React.Dispatch<React.SetStateAction<string>>;
  setPositionOrderLockCandidateGroupId: React.Dispatch<React.SetStateAction<string>>;
  setPositionOrderLockCandidateSelectionStage: React.Dispatch<React.SetStateAction<'group' | 'frame' | ''>>;
  setPositionSpacingCheckedRowKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPositionSelectionClickChainSnapshot: React.Dispatch<React.SetStateAction<any>>;
  setSelectionValidationIssues: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectionReviewIssues: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectionSaveProgress: React.Dispatch<React.SetStateAction<any>>;
  setPositionSelectionStateRevision: React.Dispatch<React.SetStateAction<number>>;
};

export const useCanvasKeyboardShortcuts = ({
  isInteractiveTarget,
  cancelPositionGroupEditMode,
  clearFrameSelection,
  applyRuntimeSelectionUi,
  safeReleasePointerCapture,
  defaultSelectionSaveProgressState,
  selectedFrameGroupIdsLength,
  edgeSelectionTokensLength,
  positionOrderLockSelectionMode,
  selectedPositionSpacingSettingRelationKey,
  positionGroupEditModeRef,
  selectedFrameGroupIdsRef,
  edgeSelectionStateRef,
  positionGroupProxySelectionGroupIdRef,
  positionGroupProxySelectionShowAllGroupsRef,
  positionGroupProxySelectionsOverrideRef,
  positionActiveSelectionEntityRef,
  canvasPanStateRef,
  activePointerOwnerRef,
  setSpacePanArmed,
  setSpacePanDragging,
  setSelectedFrameGroupIds,
  setEdgeSelectionState,
  setPositionOrderLockFrameGroupIds,
  setPositionOrderLockSelectionKindByFrameGroupId,
  setPositionOrderLockSelectionGroupIdByFrameGroupId,
  setSelectedPositionSpacingSettingRelationKey,
  setPositionOrderLockCandidateFrameGroupId,
  setPositionOrderLockCandidateGroupId,
  setPositionOrderLockCandidateSelectionStage,
  setPositionSpacingCheckedRowKeys,
  setPositionSelectionClickChainSnapshot,
  setSelectionValidationIssues,
  setSelectionReviewIssues,
  setSelectionSaveProgress,
  setPositionSelectionStateRevision,
}: UseCanvasKeyboardShortcutsOptions) => {
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.code === 'Space') {
        const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        if (isInteractiveTarget(activeElement)) {
          return;
        }

        event.preventDefault();
        setSpacePanArmed(true);
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      const isEscapeKey = event.key === 'Escape';
      const isGroupEditCancelKey = normalizedKey === 'x' || normalizedKey === 'q';

      if (event.defaultPrevented || (!isEscapeKey && !isGroupEditCancelKey)) {
        return;
      }

      if (
        isGroupEditCancelKey &&
        typeof document !== 'undefined' &&
        isInteractiveTarget(document.activeElement instanceof HTMLElement ? document.activeElement : null)
      ) {
        return;
      }

      if (positionGroupEditModeRef.current.kind !== 'idle') {
        event.preventDefault();
        cancelPositionGroupEditMode();
        return;
      }

      if (!isEscapeKey) {
        return;
      }

      const hasSelection =
        selectedFrameGroupIdsRef.current.length > 0 ||
        selectedFrameGroupIdsLength > 0 ||
        edgeSelectionStateRef.current.tokens.length > 0 ||
        edgeSelectionTokensLength > 0 ||
        positionGroupProxySelectionGroupIdRef.current.trim().length > 0 ||
        selectedPositionSpacingSettingRelationKey.trim().length > 0 ||
        positionOrderLockSelectionMode;

      if (!hasSelection) {
        return;
      }

      event.preventDefault();

      if (positionOrderLockSelectionMode) {
        const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
        positionGroupProxySelectionGroupIdRef.current = '';
        positionGroupProxySelectionShowAllGroupsRef.current = false;
        positionGroupProxySelectionsOverrideRef.current = null;
        positionActiveSelectionEntityRef.current = null;
        selectedFrameGroupIdsRef.current = [];
        edgeSelectionStateRef.current = emptyEdgeSelection;
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(emptyEdgeSelection);
        setPositionOrderLockFrameGroupIds([]);
        setPositionOrderLockSelectionKindByFrameGroupId({});
        setPositionOrderLockSelectionGroupIdByFrameGroupId({});
        setSelectedPositionSpacingSettingRelationKey('');
        setPositionOrderLockCandidateFrameGroupId('');
        setPositionOrderLockCandidateGroupId('');
        setPositionOrderLockCandidateSelectionStage('');
        setPositionSpacingCheckedRowKeys({});
        setPositionSelectionClickChainSnapshot(null);
        setSelectionValidationIssues([]);
        setSelectionReviewIssues([]);
        setSelectionSaveProgress(defaultSelectionSaveProgressState);
        setPositionSelectionStateRevision((previous) => previous + 1);
        applyRuntimeSelectionUi([], emptyEdgeSelection, []);
        return;
      }

      clearFrameSelection();
    };

    const handleWindowKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.code !== 'Space') {
        return;
      }

      setSpacePanArmed(false);
    };

    const handleWindowBlur = () => {
      if (canvasPanStateRef.current) {
        safeReleasePointerCapture(activePointerOwnerRef.current, canvasPanStateRef.current.pointerId);
      }
      activePointerOwnerRef.current = null;
      setSpacePanArmed(false);
      setSpacePanDragging(false);
      canvasPanStateRef.current = null;
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('keyup', handleWindowKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    activePointerOwnerRef,
    applyRuntimeSelectionUi,
    cancelPositionGroupEditMode,
    canvasPanStateRef,
    clearFrameSelection,
    defaultSelectionSaveProgressState,
    edgeSelectionStateRef,
    edgeSelectionTokensLength,
    isInteractiveTarget,
    positionActiveSelectionEntityRef,
    positionGroupEditModeRef,
    positionGroupProxySelectionGroupIdRef,
    positionGroupProxySelectionShowAllGroupsRef,
    positionGroupProxySelectionsOverrideRef,
    positionOrderLockSelectionMode,
    safeReleasePointerCapture,
    selectedFrameGroupIdsLength,
    selectedFrameGroupIdsRef,
    selectedPositionSpacingSettingRelationKey,
    setEdgeSelectionState,
    setPositionOrderLockCandidateFrameGroupId,
    setPositionOrderLockCandidateGroupId,
    setPositionOrderLockCandidateSelectionStage,
    setPositionOrderLockFrameGroupIds,
    setPositionOrderLockSelectionGroupIdByFrameGroupId,
    setPositionOrderLockSelectionKindByFrameGroupId,
    setPositionSelectionClickChainSnapshot,
    setPositionSelectionStateRevision,
    setPositionSpacingCheckedRowKeys,
    setSelectedFrameGroupIds,
    setSelectedPositionSpacingSettingRelationKey,
    setSelectionReviewIssues,
    setSelectionSaveProgress,
    setSelectionValidationIssues,
    setSpacePanArmed,
    setSpacePanDragging,
  ]);
};
