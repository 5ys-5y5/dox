'use client';

import * as React from 'react';
import { TemplateEdgeSelectionService } from '../../../../services/templateEdgeSelectionService';

type UseCanvasSelectionActionsOptions = {
  previewRef: React.MutableRefObject<HTMLDivElement | null>;
  dragStateRef: React.MutableRefObject<any>;
  resizeStateRef: React.MutableRefObject<any>;
  edgePressStateRef: React.MutableRefObject<any>;
  marqueeSelectionStateRef: React.MutableRefObject<any>;
  createBoxStateRef: React.MutableRefObject<any>;
  positionGroupProxySelectionGroupIdRef: React.MutableRefObject<string>;
  positionGroupProxySelectionShowAllGroupsRef: React.MutableRefObject<boolean>;
  positionGroupProxySelectionsOverrideRef: React.MutableRefObject<any>;
  positionActiveSelectionEntityRef: React.MutableRefObject<any>;
  selectedFrameGroupIdsRef: React.MutableRefObject<string[]>;
  edgeSelectionStateRef: React.MutableRefObject<any>;
  emptyEdgeRoleDiagnosticsState: any;
  defaultSelectionSaveProgressState: any;
  stopPointerInteraction: (pointerId?: number) => void;
  applyRuntimeSelectionUi: (selectedFrameGroupIds: string[], edgeSelectionState: any, mismatchEdgeIds?: string[]) => void;
  syncEdgeRoleDiagnosticsState: (nextState: any) => void;
  setPositionOrderLockSelectionMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPositionOrderLockFrameGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPositionOrderLockSelectionKindByFrameGroupId: React.Dispatch<React.SetStateAction<Record<string, 'group' | 'frame'>>>;
  setPositionOrderLockSelectionGroupIdByFrameGroupId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPositionOrderLockCandidateFrameGroupId: React.Dispatch<React.SetStateAction<string>>;
  setPositionOrderLockCandidateGroupId: React.Dispatch<React.SetStateAction<string>>;
  setPositionOrderLockCandidateSelectionStage: React.Dispatch<React.SetStateAction<'group' | 'frame' | ''>>;
  setPositionSelectionClickChainSnapshot: React.Dispatch<React.SetStateAction<any>>;
  setSelectionValidationIssues: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectionReviewIssues: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectionSaveProgress: React.Dispatch<React.SetStateAction<any>>;
  setTextAutoSizeUiOverride: React.Dispatch<React.SetStateAction<any>>;
  setSelectedPositionSpacingSettingRelationKey: React.Dispatch<React.SetStateAction<string>>;
  setPositionSelectionStateRevision: React.Dispatch<React.SetStateAction<number>>;
  setSelectedFrameGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEdgeSelectionState: React.Dispatch<React.SetStateAction<any>>;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
  collectPositionBoxGroups: (root: HTMLElement, options?: { includeSingletons?: boolean }) => any[];
  normalizePositionGroupDisplayLabel: (label: string, id: string) => string;
  removeFrameShellsByFrameGroupIds: (root: HTMLElement, frameGroupIds: string[]) => number;
  unwrapPositionGroupTreeEntriesByIds: (root: HTMLElement, groupIds: string[]) => void;
  resolveFrameSelectionAnchor: (node: HTMLElement | null) => HTMLElement | null;
  rawFrameNodeSelector: string;
  readFramePositionGroupConfig: (node: HTMLElement) => { groupId: string; label: string; managed: boolean } | null;
  writeFramePositionGroupAttrs: (node: HTMLElement, config: any) => void;
  removePositionGroupWrappersByIds: (root: HTMLElement, groupIds: string[]) => void;
  clearFrameRelativeAnchorsReferencingDeletedTargets: (
    root: HTMLElement,
    deletedGroupIds: string[],
    deletedFrameGroupIds: string[]
  ) => void;
  prunePositionGroupTreeReferences: (root: HTMLElement, deletedGroupIds: string[], deletedFrameGroupIds: string[]) => void;
  applyRelativeAnchoredFrameRectsInRoot: (root: HTMLElement) => void;
  syncDraftPreviewHtmlRef: () => string;
  requestPreviewTextFit: () => void;
  schedulePreviewEditorState: () => void;
  frameDeleteButtonAttr: string;
  frameDeleteKindAttr: string;
  frameDeleteTargetIdAttr: string;
};

const resetCanvasSelectionState = (options: UseCanvasSelectionActionsOptions, emptyEdgeSelection: any) => {
  options.positionGroupProxySelectionGroupIdRef.current = '';
  options.positionGroupProxySelectionShowAllGroupsRef.current = false;
  options.positionGroupProxySelectionsOverrideRef.current = null;
  options.positionActiveSelectionEntityRef.current = null;
  options.selectedFrameGroupIdsRef.current = [];
  options.edgeSelectionStateRef.current = emptyEdgeSelection;
  options.setPositionOrderLockSelectionMode(false);
  options.setPositionOrderLockFrameGroupIds([]);
  options.setPositionOrderLockSelectionKindByFrameGroupId({});
  options.setPositionOrderLockSelectionGroupIdByFrameGroupId({});
  options.setPositionOrderLockCandidateFrameGroupId('');
  options.setPositionOrderLockCandidateGroupId('');
  options.setPositionOrderLockCandidateSelectionStage('');
  options.setPositionSelectionClickChainSnapshot(null);
  options.setSelectionValidationIssues([]);
  options.setSelectionReviewIssues([]);
  options.setSelectionSaveProgress(options.defaultSelectionSaveProgressState);
  options.setSelectedPositionSpacingSettingRelationKey('');
  options.setPositionSelectionStateRevision((previous) => previous + 1);
  options.setSelectedFrameGroupIds([]);
  options.setEdgeSelectionState(emptyEdgeSelection);
  options.syncEdgeRoleDiagnosticsState(options.emptyEdgeRoleDiagnosticsState);
};

export const useCanvasSelectionActions = (options: UseCanvasSelectionActionsOptions) => {
  const clearFrameSelection = React.useCallback(() => {
    const hasInteractionInProgress = Boolean(
      options.dragStateRef.current ||
        options.resizeStateRef.current ||
        options.edgePressStateRef.current ||
        options.marqueeSelectionStateRef.current ||
        options.createBoxStateRef.current
    );

    if (hasInteractionInProgress) {
      options.stopPointerInteraction();
    }

    const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
    resetCanvasSelectionState(options, emptyEdgeSelection);
    options.setTextAutoSizeUiOverride(null);
    options.applyRuntimeSelectionUi([], emptyEdgeSelection, []);
  }, [options]);

  const deleteCanvasSelectionEntity = React.useCallback(
    (kind: string | null | undefined, targetId: string | null | undefined) => {
      const root = options.previewRef.current;
      const normalizedKind = kind === 'group' || kind === 'frame' ? kind : '';
      const normalizedTargetId = String(targetId || '').trim();

      if (!root || !normalizedTargetId || !normalizedKind) {
        options.setMessage('삭제할 상자 또는 그룹을 찾지 못했습니다.');
        return;
      }

      const groups = options.collectPositionBoxGroups(root, { includeSingletons: false });
      const groupById = new Map(groups.map((group) => [group.id, group] as const));
      let targetFrameGroupIds: string[] = [];
      let targetGroupIds: string[] = [];
      let targetLabel = normalizedTargetId;
      let groupDirectFrameGroupIdsToDetach: string[] = [];

      if (normalizedKind === 'group') {
        const targetGroup = groupById.get(normalizedTargetId) || null;

        if (!targetGroup) {
          options.setMessage('삭제할 그룹을 찾지 못했습니다.');
          return;
        }

        targetGroupIds = [normalizedTargetId];
        groupDirectFrameGroupIdsToDetach = Array.from(
          new Set(
            (targetGroup.directFrameGroupIds ?? targetGroup.frameGroupIds)
              .map((frameGroupId: string) => frameGroupId.trim())
              .filter(Boolean)
          )
        );
        targetLabel = options.normalizePositionGroupDisplayLabel(targetGroup.label, targetGroup.id);
      } else {
        targetFrameGroupIds = [normalizedTargetId];
      }

      if (targetFrameGroupIds.length <= 0 && targetGroupIds.length <= 0) {
        options.setMessage('삭제할 상자 또는 그룹을 찾지 못했습니다.');
        return;
      }

      const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
      resetCanvasSelectionState(options, emptyEdgeSelection);

      const removedFrameCount =
        normalizedKind === 'frame' ? options.removeFrameShellsByFrameGroupIds(root, targetFrameGroupIds) : 0;

      if (normalizedKind === 'frame' && removedFrameCount <= 0) {
        options.setMessage('삭제할 상자를 찾지 못했습니다.');
        options.applyRuntimeSelectionUi([], emptyEdgeSelection, []);
        return;
      }

      if (normalizedKind === 'group') {
        options.unwrapPositionGroupTreeEntriesByIds(root, targetGroupIds);
        groupDirectFrameGroupIdsToDetach.forEach((frameGroupId) => {
          const targetNode = options.resolveFrameSelectionAnchor(
            root.querySelector<HTMLElement>(
              `${options.rawFrameNodeSelector}[data-template-frame-group="${frameGroupId}"]`
            )
          );

          if (targetNode && options.readFramePositionGroupConfig(targetNode)?.groupId === normalizedTargetId) {
            options.writeFramePositionGroupAttrs(targetNode, null);
          }
        });
        options.removePositionGroupWrappersByIds(root, targetGroupIds);
        options.clearFrameRelativeAnchorsReferencingDeletedTargets(root, targetGroupIds, []);
      } else {
        options.prunePositionGroupTreeReferences(root, [], targetFrameGroupIds);
        options.clearFrameRelativeAnchorsReferencingDeletedTargets(root, [], targetFrameGroupIds);
      }

      options.applyRelativeAnchoredFrameRectsInRoot(root);
      options.applyRuntimeSelectionUi([], emptyEdgeSelection, []);
      options.syncDraftPreviewHtmlRef();
      options.requestPreviewTextFit();
      options.schedulePreviewEditorState();
      options.setMessage(
        normalizedKind === 'group'
          ? `${targetLabel} 그룹 삭제 완료: 하위 상자와 하위 그룹 유지`
          : `${normalizedTargetId} 상자 삭제 완료`
      );
    },
    [options]
  );

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleNativeDeleteButtonEvent = (event: PointerEvent | MouseEvent) => {
      const root = options.previewRef.current;
      const target = event.target instanceof Element ? event.target : null;
      const deleteButton = target?.closest<HTMLElement>(`[${options.frameDeleteButtonAttr}="true"]`) || null;

      if (!root || !deleteButton || !root.contains(deleteButton)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      deleteCanvasSelectionEntity(
        deleteButton.getAttribute(options.frameDeleteKindAttr),
        deleteButton.getAttribute(options.frameDeleteTargetIdAttr)
      );
    };

    document.addEventListener('pointerdown', handleNativeDeleteButtonEvent, true);
    document.addEventListener('mousedown', handleNativeDeleteButtonEvent, true);
    document.addEventListener('click', handleNativeDeleteButtonEvent, true);

    return () => {
      document.removeEventListener('pointerdown', handleNativeDeleteButtonEvent, true);
      document.removeEventListener('mousedown', handleNativeDeleteButtonEvent, true);
      document.removeEventListener('click', handleNativeDeleteButtonEvent, true);
    };
  }, [deleteCanvasSelectionEntity, options]);

  return {
    clearFrameSelection,
    deleteCanvasSelectionEntity,
  };
};
