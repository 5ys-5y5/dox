'use client';

import * as React from 'react';
import { TemplateEdgeSelectionService } from '../../../../services/templateEdgeSelectionService';

type UseCanvasPointerLifecycleOptions = {
  activePointerOwnerRef: React.MutableRefObject<HTMLDivElement | null>;
  canvasPanStateRef: React.MutableRefObject<any>;
  marqueeSelectionStateRef: React.MutableRefObject<any>;
  createBoxStateRef: React.MutableRefObject<any>;
  edgePressStateRef: React.MutableRefObject<any>;
  dragStateRef: React.MutableRefObject<any>;
  resizeStateRef: React.MutableRefObject<any>;
  selectedFrameGroupIdsRef: React.MutableRefObject<string[]>;
  edgeSelectionStateRef: React.MutableRefObject<any>;
  deferredPreviewEditorStateRef: React.MutableRefObject<boolean>;
  templateUsagePreviewMode: boolean;
  safeReleasePointerCapture: (owner: HTMLDivElement | null, pointerId?: number) => void;
  clearTransientCanvasOverlays: () => void;
  setSpacePanDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedFrameGroupIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEdgeSelectionState: React.Dispatch<React.SetStateAction<any>>;
  syncEdgeRoleDiagnosticsState: (nextState: any) => void;
  emptyEdgeRoleDiagnosticsState: any;
  applyRuntimeSelectionUi: (selectedFrameGroupIds: string[], edgeSelectionState: any, mismatchEdgeIds?: string[]) => void;
  schedulePreviewEditorState: () => void;
  stopPointerInteraction: (pointerId?: number) => void;
};

export const useCanvasPointerLifecycle = (options: UseCanvasPointerLifecycleOptions) => {
  const cancelActivePointerInteraction = React.useCallback(
    (pointerId?: number) => {
      const matchesPointer = (candidatePointerId: number | undefined) =>
        typeof pointerId !== 'number' || candidatePointerId === pointerId;

      const panState = options.canvasPanStateRef.current;
      if (panState && matchesPointer(panState.pointerId)) {
        const owner = options.activePointerOwnerRef.current;
        options.safeReleasePointerCapture(owner, panState.pointerId);
        options.activePointerOwnerRef.current = null;
        options.canvasPanStateRef.current = null;
        options.setSpacePanDragging(false);
        return;
      }

      if (options.templateUsagePreviewMode) {
        return;
      }

      const marqueeSelectionState = options.marqueeSelectionStateRef.current;
      if (marqueeSelectionState && matchesPointer(marqueeSelectionState.pointerId)) {
        const owner = options.activePointerOwnerRef.current;
        options.safeReleasePointerCapture(owner, marqueeSelectionState.pointerId);
        const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
        options.clearTransientCanvasOverlays();
        options.activePointerOwnerRef.current = null;
        const restoredSelectionIds =
          marqueeSelectionState.clickSelectionIds?.slice() || marqueeSelectionState.baseSelectionIds.slice();
        options.selectedFrameGroupIdsRef.current = restoredSelectionIds;
        options.edgeSelectionStateRef.current = emptyEdgeSelection;
        options.setSelectedFrameGroupIds(restoredSelectionIds.slice());
        options.setEdgeSelectionState(emptyEdgeSelection);
        options.syncEdgeRoleDiagnosticsState(options.emptyEdgeRoleDiagnosticsState);
        options.applyRuntimeSelectionUi(restoredSelectionIds, emptyEdgeSelection);
        if (options.deferredPreviewEditorStateRef.current) {
          options.deferredPreviewEditorStateRef.current = false;
          options.schedulePreviewEditorState();
        }
        return;
      }

      const createBoxState = options.createBoxStateRef.current;
      if (createBoxState && matchesPointer(createBoxState.pointerId)) {
        const owner = options.activePointerOwnerRef.current;
        options.safeReleasePointerCapture(owner, createBoxState.pointerId);
        options.clearTransientCanvasOverlays();
        options.activePointerOwnerRef.current = null;
        if (options.deferredPreviewEditorStateRef.current) {
          options.deferredPreviewEditorStateRef.current = false;
          options.schedulePreviewEditorState();
        }
        return;
      }

      const edgePressState = options.edgePressStateRef.current;
      if (edgePressState && matchesPointer(edgePressState.pointerId)) {
        options.stopPointerInteraction(edgePressState.pointerId);
        return;
      }

      const dragState = options.dragStateRef.current;
      if (dragState && matchesPointer(dragState.pointerId)) {
        options.stopPointerInteraction(dragState.pointerId);
        return;
      }

      const resizeState = options.resizeStateRef.current;
      if (resizeState && matchesPointer(resizeState.pointerId)) {
        options.stopPointerInteraction(resizeState.pointerId);
      }
    },
    [options]
  );

  const handlePreviewLostPointerCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      cancelActivePointerInteraction(event.pointerId);
    },
    [cancelActivePointerInteraction]
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleWindowBlur = () => {
      cancelActivePointerInteraction();
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [cancelActivePointerInteraction]);

  return {
    cancelActivePointerInteraction,
    handlePreviewLostPointerCapture,
  };
};
