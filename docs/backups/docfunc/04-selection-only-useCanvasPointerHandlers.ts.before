'use client';

import * as React from 'react';
import { TemplateEdgeResizeIntentService } from '../../../../services/templateEdgeResizeIntentService';
import { TemplateEdgeSelectionService } from '../../../../services/templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from '../../../../services/templateEdgeTopologyService';
import { TemplateFrameEditGeometryService } from '../../../../services/templateFrameEditGeometryService';
import type {
  EdgeResizeTarget,
  EdgeResizeTargetMember,
  FrameMarqueeSelectionMode,
  FrameNodeRect,
  FrameWidthResizeInstruction,
  MarqueeFrameHitEntry,
  MarqueePositionGroupHitEntry,
  MarqueeSelectionState,
  PositionGroupProxySelection,
  PositionSelectionClickChainEntry,
  TemplateFrameResizeDirection,
} from '../types';

type UseCanvasPointerHandlersOptions = any;

export const useCanvasPointerHandlers = (options: UseCanvasPointerHandlersOptions) => {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const updateMarqueeSelectionFromClientPoint = React.useCallback(
    (marqueeSelectionState: MarqueeSelectionState, clientX: number, clientY: number) => {
      const {
        readPageInnerPointerPoint,
        buildPointerDragRect,
        FRAME_MARQUEE_DRAG_THRESHOLD_PX,
        createFrameEditorGhost,
        FRAME_MARQUEE_GHOST_CLASS,
        buildMarqueeSelectionHitEntries,
        writeFrameEditorGhostRect,
        resolveMarqueeSelectionIdsFromHitEntries,
        selectionPanelTab,
        resolvePositionMarqueeProxySelectionsFromHitEntries,
        retainPositionProxySelectionsForSelectedIds,
        mergePositionProxySelections,
        stringArraysEqual,
        positionGroupProxySelectionsEqual,
        selectedFrameGroupIdsRef,
        edgeSelectionStateRef,
        applyFastFrameBoxSelectionVisuals,
      } = optionsRef.current;
      const currentPoint = readPageInnerPointerPoint(
        marqueeSelectionState.pageInner,
        clientX,
        clientY,
        marqueeSelectionState.scale
      );
      const nextRect = buildPointerDragRect(marqueeSelectionState.origin, currentPoint);

      if (
        !marqueeSelectionState.active &&
        nextRect.width < FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
        nextRect.height < FRAME_MARQUEE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (!marqueeSelectionState.active) {
        const nextGhost = createFrameEditorGhost(FRAME_MARQUEE_GHOST_CLASS, marqueeSelectionState.mode);
        marqueeSelectionState.pageInner.appendChild(nextGhost);
        marqueeSelectionState.ghost = nextGhost;
        marqueeSelectionState.active = true;
      }

      if (!marqueeSelectionState.hitEntriesReady) {
        const { frameHitEntries, positionGroupHitEntries } = buildMarqueeSelectionHitEntries(
          marqueeSelectionState.pageInner
        );
        marqueeSelectionState.frameHitEntries = frameHitEntries;
        marqueeSelectionState.positionGroupHitEntries = positionGroupHitEntries;
        marqueeSelectionState.hitEntriesReady = true;
      }

      const nextMode: FrameMarqueeSelectionMode =
        currentPoint.x >= marqueeSelectionState.origin.x ? 'contained' : 'intersected';
      marqueeSelectionState.mode = nextMode;
      marqueeSelectionState.ghost?.setAttribute('data-marquee-mode', nextMode);
      if (marqueeSelectionState.ghost) {
        writeFrameEditorGhostRect(marqueeSelectionState.ghost, nextRect);
      }

      const nextSelectionIds = resolveMarqueeSelectionIdsFromHitEntries({
        selectionRect: nextRect,
        mode: nextMode,
        baseSelectionIds: marqueeSelectionState.baseSelectionIds,
        frameHitEntries: marqueeSelectionState.frameHitEntries,
        positionGroupHitEntries: marqueeSelectionState.positionGroupHitEntries,
        usePositionGroups: selectionPanelTab === 'position',
      });
      const shouldShowMarqueeProxySelections = selectionPanelTab === 'position';
      const computedMarqueeProxySelections = shouldShowMarqueeProxySelections
        ? resolvePositionMarqueeProxySelectionsFromHitEntries(
            marqueeSelectionState.positionGroupHitEntries,
            nextSelectionIds
          )
        : undefined;
      const retainedBaseProxySelections = shouldShowMarqueeProxySelections
        ? retainPositionProxySelectionsForSelectedIds(marqueeSelectionState.baseProxySelections, nextSelectionIds)
        : undefined;
      const marqueeProxySelections = shouldShowMarqueeProxySelections
        ? mergePositionProxySelections(retainedBaseProxySelections, computedMarqueeProxySelections)
        : undefined;
      if (
        stringArraysEqual(marqueeSelectionState.lastSelectionIds, nextSelectionIds) &&
        positionGroupProxySelectionsEqual(marqueeSelectionState.lastProxySelections, marqueeProxySelections)
      ) {
        return;
      }

      marqueeSelectionState.lastSelectionIds = nextSelectionIds;
      marqueeSelectionState.lastProxySelections = marqueeProxySelections;
      const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
      selectedFrameGroupIdsRef.current = nextSelectionIds;
      edgeSelectionStateRef.current = emptyEdgeSelection;
      applyFastFrameBoxSelectionVisuals(nextSelectionIds, emptyEdgeSelection, marqueeProxySelections);
    },
    []
  );

  const stepMarqueeAutoScroll = React.useCallback(() => {
    const {
      marqueeAutoScrollFrameRef,
      marqueeSelectionStateRef,
      marqueeAutoScrollPointerRef,
      previewRef,
      stopMarqueeAutoScroll,
      resolveMarqueeAutoScrollDelta,
    } = optionsRef.current;
    marqueeAutoScrollFrameRef.current = null;
    const marqueeSelectionState = marqueeSelectionStateRef.current;
    const pointer = marqueeAutoScrollPointerRef.current;
    const scrollContainer = previewRef.current;

    if (
      !marqueeSelectionState ||
      !pointer ||
      !scrollContainer ||
      marqueeSelectionState.pointerId !== pointer.pointerId ||
      !marqueeSelectionState.active
    ) {
      stopMarqueeAutoScroll();
      return;
    }

    const { deltaX, deltaY } = resolveMarqueeAutoScrollDelta(scrollContainer, pointer.clientX, pointer.clientY);
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, scrollContainer.scrollLeft + deltaX));
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, scrollContainer.scrollTop + deltaY));
    const didScroll =
      Math.abs(nextScrollLeft - scrollContainer.scrollLeft) > 0.1 ||
      Math.abs(nextScrollTop - scrollContainer.scrollTop) > 0.1;

    if (!didScroll) {
      stopMarqueeAutoScroll();
      return;
    }

    scrollContainer.scrollLeft = nextScrollLeft;
    scrollContainer.scrollTop = nextScrollTop;
    updateMarqueeSelectionFromClientPoint(marqueeSelectionState, pointer.clientX, pointer.clientY);

    if (marqueeSelectionStateRef.current?.pointerId === pointer.pointerId) {
      marqueeAutoScrollFrameRef.current = window.requestAnimationFrame(stepMarqueeAutoScroll);
    }
  }, [updateMarqueeSelectionFromClientPoint]);

  const syncMarqueeAutoScrollFromClientPoint = React.useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const {
        marqueeSelectionStateRef,
        previewRef,
        stopMarqueeAutoScroll,
        marqueeAutoScrollPointerRef,
        resolveMarqueeAutoScrollDelta,
        marqueeAutoScrollFrameRef,
      } = optionsRef.current;
      const marqueeSelectionState = marqueeSelectionStateRef.current;
      const scrollContainer = previewRef.current;

      if (
        !marqueeSelectionState ||
        !scrollContainer ||
        marqueeSelectionState.pointerId !== pointerId ||
        !marqueeSelectionState.active
      ) {
        stopMarqueeAutoScroll();
        return;
      }

      marqueeAutoScrollPointerRef.current = {
        pointerId,
        clientX,
        clientY,
      };
      const { deltaX, deltaY } = resolveMarqueeAutoScrollDelta(scrollContainer, clientX, clientY);

      if (Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) {
        if (marqueeAutoScrollFrameRef.current !== null) {
          window.cancelAnimationFrame(marqueeAutoScrollFrameRef.current);
          marqueeAutoScrollFrameRef.current = null;
        }
        return;
      }

      if (marqueeAutoScrollFrameRef.current === null) {
        marqueeAutoScrollFrameRef.current = window.requestAnimationFrame(stepMarqueeAutoScroll);
      }
    },
    [stepMarqueeAutoScroll]
  );

  const handlePreviewPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const {
        previewRef,
        spacePanArmedRef,
        safeSetPointerCapture,
        activePointerOwnerRef,
        canvasPanStateRef,
        setSpacePanDragging,
        templateUsagePreviewMode,
        FRAME_REVIEW_WARNING_BUTTON_CLASS,
        FRAME_REVIEW_WARNING_POPOVER_CLASS,
        FRAME_DELETE_BUTTON_ATTR,
        deleteCanvasSelectionEntity,
        FRAME_DELETE_KIND_ATTR,
        FRAME_DELETE_TARGET_ID_ATTR,
        FRAME_EDGE_BUTTON_SELECTOR,
        FRAME_RESIZE_HANDLE_SELECTOR,
        resolveExplicitEdgeFrameNode,
        FRAME_SELECTION_NODE_SELECTOR,
        resolveFrameSelectionAnchor,
        selectionPanelTab,
        resolveFrameSelectionAnchorAtPoint,
        selectedFrameGroupIdsRef,
        canvasInteractionMode,
        getFrameGroupId,
        getFrameNodes,
        lockPreviewEditorStateDuringInteraction,
        readFrameMoveRect,
        buildFrameRectUnion,
        dragStateRef,
        buildMarqueeSelectionHitEntries,
        positionOrderLockSelectionMode,
        positionBoxGroupByFrameGroupId,
        marqueeSelectionStateRef,
        resolvePositionMarqueeProxySelectionsFromHitEntries,
        readPageInnerPointerPoint,
        previewZoom,
        textCanvasEditModeActiveRef,
        resolveFrameTextInputElement,
        enableFrameTextInputForEditing,
        sizeMatchSourcePickModeRef,
        setSizeMatchSourceFrameGroupId,
        setSizeMatchSourcePickMode,
        setMessage,
        metadataRelationSelectionModeRef,
        handleMetadataRelationFramePick,
        boxCreationMode,
        boxCreationPositionMode,
        readSingleFrameGroupId,
        setBoxCreationPositionMode,
        createBoxStateRef,
        resolvePositionSelectionClickChain,
        setPositionSelectionClickChainSnapshot,
        resolvePositionOrderLockClickChainCurrentIndex,
        resolvePositionClickChainCurrentIndex,
        positionGroupEditModeRef,
        applyPositionGroupEditModeSelection,
        previewPositionOrderLockCandidateSelection,
        positionBoxGroups,
        queryFrameSelectionAnchorByFrameGroupId,
        applyFrameBoxSelection,
        clearFrameSelection,
        edgeSelectionStateRef,
        positionOrderLockFrameGroupIds,
        positionOrderLockSelectionKindByFrameGroupId,
        buildLiveEdgeTopologySnapshot,
        edgePressStateRef,
        getCardinalEdgeSideFromDirection,
        buildFrameResizeContext,
        readFrameNodeRect,
        collectWidthResizeInstructions,
        filterResizeSnapRects,
        resizeStateRef,
        isInteractiveTarget,
      } = optionsRef.current;

      if (event.button !== 0) {
        return;
      }

      const root = previewRef.current;
      const deleteTarget = event.target instanceof Element ? event.target : null;

      if (!root || !deleteTarget) {
        return;
      }

      if (spacePanArmedRef.current) {
        event.preventDefault();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        canvasPanStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startScrollLeft: root.scrollLeft,
          startScrollTop: root.scrollTop,
        };
        setSpacePanDragging(true);
        return;
      }

      if (templateUsagePreviewMode) {
        return;
      }

      const reviewWarningUi = deleteTarget.closest<HTMLElement>(
        `.${FRAME_REVIEW_WARNING_BUTTON_CLASS}, .${FRAME_REVIEW_WARNING_POPOVER_CLASS}`
      );

      if (reviewWarningUi && root.contains(reviewWarningUi)) {
        return;
      }

      const deleteButton = deleteTarget.closest<HTMLElement>(`[${FRAME_DELETE_BUTTON_ATTR}="true"]`);

      if (deleteButton && root.contains(deleteButton)) {
        event.preventDefault();
        event.stopPropagation();
        deleteCanvasSelectionEntity(
          deleteButton.getAttribute(FRAME_DELETE_KIND_ATTR),
          deleteButton.getAttribute(FRAME_DELETE_TARGET_ID_ATTR)
        );
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;

      if (!target) {
        return;
      }

      const edgeButton = target.closest<HTMLElement>(FRAME_EDGE_BUTTON_SELECTOR);
      const resizeHandle = target.closest<HTMLElement>(FRAME_RESIZE_HANDLE_SELECTOR);
      const explicitEdgeId = edgeButton?.getAttribute('data-edge-id')?.trim() || '';
      const explicitEdgeFrameNode = resolveExplicitEdgeFrameNode(root, explicitEdgeId);
      const frameAnchorTarget =
        explicitEdgeFrameNode ||
        edgeButton?.closest<HTMLElement>('.v102-frame-band') ||
        resizeHandle?.closest<HTMLElement>('.v102-frame-band') ||
        target.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);
      const pageInnerFromTarget = target.closest<HTMLElement>('.page-inner') || null;
      const frameNode =
        resolveFrameSelectionAnchor(frameAnchorTarget) ||
        (selectionPanelTab !== 'position'
          ? resolveFrameSelectionAnchorAtPoint(pageInnerFromTarget, event.clientX, event.clientY)
          : null);
      const pageInner = pageInnerFromTarget || frameNode?.closest<HTMLElement>('.page-inner') || null;
      const hadSelectionBeforePointerDown = selectedFrameGroupIdsRef.current.length > 0;
      const startFrameDragInteraction = (anchorNode: HTMLElement, selectionFrameGroupIds: string[]) => {
        if (!pageInner || selectionPanelTab !== 'position' || canvasInteractionMode !== 'move') {
          return false;
        }

        const normalizedSelectionIdSet = new Set(
          selectionFrameGroupIds
            .map((selectionFrameGroupId) => selectionFrameGroupId.trim())
            .filter((selectionFrameGroupId) => Boolean(selectionFrameGroupId))
        );

        if (normalizedSelectionIdSet.size <= 0) {
          normalizedSelectionIdSet.add(getFrameGroupId(anchorNode));
        }

        const pageFrameNodes = getFrameNodes(pageInner);
        const selectionOnPage = pageFrameNodes.filter(
          (node: HTMLElement) =>
            normalizedSelectionIdSet.has(getFrameGroupId(node)) &&
            node.closest<HTMLElement>('.page-inner') === pageInner
        );
        const dragNodes = selectionOnPage.length ? selectionOnPage : [anchorNode];
        const dragNodeSet = new Set(dragNodes);

        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        const dragNodeRects = dragNodes.map((node: HTMLElement) => readFrameMoveRect(node));
        dragStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          active: false,
          pageInner,
          anchorRect: readFrameMoveRect(anchorNode),
          moveRect: buildFrameRectUnion(dragNodeRects),
          nodes: dragNodes.map((node: HTMLElement, index: number) => ({
            node,
            rect: dragNodeRects[index] || readFrameMoveRect(node),
          })),
          snapSiblingRects: pageFrameNodes
            .filter((node: HTMLElement) => !dragNodeSet.has(node))
            .map((node: HTMLElement) => readFrameMoveRect(node)),
        };
        return true;
      };
      const startMarqueeSelectionInteraction = ({
        anchorFrameGroupId = '',
        focusFrameGroupIdOnClick = null,
        positionShiftClickFallbackEntry = null,
        baseSelectionIds,
        baseProxySelections,
        clickSelectionIds,
        clickProxySelections,
        deferHitEntryCollection = false,
      }: {
        anchorFrameGroupId?: string;
        focusFrameGroupIdOnClick?: string | null;
        positionShiftClickFallbackEntry?: PositionSelectionClickChainEntry | null;
        baseSelectionIds?: string[];
        baseProxySelections?: PositionGroupProxySelection[];
        clickSelectionIds?: string[];
        clickProxySelections?: PositionGroupProxySelection[];
        deferHitEntryCollection?: boolean;
      } = {}) => {
        if (!pageInner || edgeButton || resizeHandle) {
          return false;
        }

        const useGroupedShiftSelection = selectionPanelTab === 'position' && positionOrderLockSelectionMode;
        const shouldAccumulateSelection = Boolean(event.shiftKey);
        const expandGroupMembers = (frameGroupId: string) => {
          const normalizedFrameGroupId = frameGroupId.trim();
          if (!normalizedFrameGroupId) {
            return [] as string[];
          }
          const group = positionBoxGroupByFrameGroupId.get(normalizedFrameGroupId);
          if (!group || group.frameGroupIds.length <= 1) {
            return [normalizedFrameGroupId];
          }
          return group.frameGroupIds
            .map((memberFrameGroupId: string) => memberFrameGroupId.trim())
            .filter((memberFrameGroupId: string) => Boolean(memberFrameGroupId));
        };
        const resolvedBaseSelectionIds =
          baseSelectionIds !== undefined
            ? baseSelectionIds
            : shouldAccumulateSelection
              ? useGroupedShiftSelection
                ? Array.from(new Set(selectedFrameGroupIdsRef.current.flatMap(expandGroupMembers)))
                : selectedFrameGroupIdsRef.current.slice()
              : [];
        const { frameHitEntries, positionGroupHitEntries } = deferHitEntryCollection
          ? {
              frameHitEntries: [] as MarqueeFrameHitEntry[],
              positionGroupHitEntries: [] as MarqueePositionGroupHitEntry[],
            }
          : buildMarqueeSelectionHitEntries(pageInner);

        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        marqueeSelectionStateRef.current = {
          pointerId: event.pointerId,
          scale: previewZoom / 100,
          pageInner,
          anchorFrameGroupId: anchorFrameGroupId || null,
          focusFrameGroupIdOnClick: focusFrameGroupIdOnClick?.trim() || null,
          positionShiftClickFallbackEntry,
          baseSelectionIds: resolvedBaseSelectionIds.slice(),
          baseProxySelections: selectionPanelTab === 'position' ? baseProxySelections : undefined,
          clickSelectionIds: clickSelectionIds?.slice(),
          clickProxySelections: selectionPanelTab === 'position' ? clickProxySelections : undefined,
          lastSelectionIds: resolvedBaseSelectionIds.slice(),
          lastProxySelections:
            selectionPanelTab === 'position'
              ? baseProxySelections !== undefined
                ? baseProxySelections
                : resolvePositionMarqueeProxySelectionsFromHitEntries(positionGroupHitEntries, resolvedBaseSelectionIds)
              : undefined,
          hitEntriesReady: !deferHitEntryCollection,
          frameHitEntries,
          positionGroupHitEntries,
          origin: readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100),
          ghost: null,
          mode: 'contained',
          active: false,
        };
        return true;
      };
      const startSelectionMarqueeAfterClickSelection = (baseProxySelections: PositionGroupProxySelection[] = []) => {
        if (selectionPanelTab === 'position') {
          if (
            canvasInteractionMode !== 'select' ||
            positionOrderLockSelectionMode ||
            positionGroupEditModeRef.current.kind !== 'idle'
          ) {
            return false;
          }

          return startMarqueeSelectionInteraction({
            anchorFrameGroupId: '',
            baseSelectionIds: [],
            baseProxySelections: [],
            clickSelectionIds: selectedFrameGroupIdsRef.current.slice(),
            clickProxySelections: baseProxySelections,
            deferHitEntryCollection: true,
          });
        }

        if (
          canvasInteractionMode !== 'select' &&
          !(canvasInteractionMode === 'move' && !hadSelectionBeforePointerDown)
        ) {
          return false;
        }

        return startMarqueeSelectionInteraction({
          anchorFrameGroupId: '',
          baseSelectionIds: [],
          baseProxySelections: [],
          clickSelectionIds: selectedFrameGroupIdsRef.current.slice(),
          clickProxySelections: baseProxySelections,
        });
      };

      if (textCanvasEditModeActiveRef.current && frameNode && !edgeButton && !resizeHandle && !event.shiftKey) {
        const clickedTextInput = resolveFrameTextInputElement(target);
        const isActiveTextInput =
          Boolean(clickedTextInput) &&
          !clickedTextInput.readOnly &&
          document.activeElement === clickedTextInput;
        const frameGroupIdForTextMode = getFrameGroupId(frameNode);

        if (clickedTextInput && isActiveTextInput) {
          enableFrameTextInputForEditing(clickedTextInput);
          return;
        }

        if (clickedTextInput && frameGroupIdForTextMode) {
          const started = startMarqueeSelectionInteraction({
            anchorFrameGroupId: frameGroupIdForTextMode,
            focusFrameGroupIdOnClick: frameGroupIdForTextMode,
          });
          if (started) {
            return;
          }
        }
      }

      if (sizeMatchSourcePickModeRef.current && frameNode && !edgeButton && !resizeHandle) {
        const pickedFrameGroupId = getFrameGroupId(frameNode).trim();

        if (pickedFrameGroupId) {
          event.preventDefault();
          setSizeMatchSourceFrameGroupId(pickedFrameGroupId);
          setSizeMatchSourcePickMode(false);
          setMessage(`크기 맞추기 기준 상자 선택: ${pickedFrameGroupId}`);
          return;
        }
      }

      if (
        metadataRelationSelectionModeRef.current.kind !== 'idle' &&
        frameNode &&
        !edgeButton &&
        !resizeHandle
      ) {
        const relationFrameGroupId = getFrameGroupId(frameNode);

        if (relationFrameGroupId) {
          event.preventDefault();
          handleMetadataRelationFramePick(relationFrameGroupId, {
            append: Boolean(event.shiftKey),
          });
          return;
        }
      }

      if (boxCreationMode && pageInner) {
        const anchorFrameGroupId =
          boxCreationPositionMode === 'relative'
            ? readSingleFrameGroupId(selectedFrameGroupIdsRef.current) || null
            : null;
        const resolvedPositionMode =
          boxCreationPositionMode === 'relative' && !anchorFrameGroupId ? 'absolute' : boxCreationPositionMode;

        if (boxCreationPositionMode === 'relative' && !anchorFrameGroupId) {
          optionsRef.current.setBoxCreationPositionMode('absolute');
          setMessage('상대 기준 상자 1개가 없어 이번 생성은 절대 위치 모드로 전환합니다.');
        }

        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        const origin = readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100);
        createBoxStateRef.current = {
          pointerId: event.pointerId,
          scale: previewZoom / 100,
          pageInner,
          positionMode: resolvedPositionMode,
          anchorFrameGroupId,
          origin,
          ghost: null,
          active: false,
        };
        return;
      }

      if (selectionPanelTab === 'position' && !edgeButton && !resizeHandle && pageInner && !frameNode) {
        const pointerPoint = readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100);
        const clickChain = resolvePositionSelectionClickChain(pageInner, '', pointerPoint);

        if (clickChain.entries.length > 0) {
          event.preventDefault();
          React.startTransition(() => {
            setPositionSelectionClickChainSnapshot({
              sourceFrameGroupId: '',
              point: pointerPoint,
              entries: clickChain.entries,
            });
          });
          const currentChainIndex = positionOrderLockSelectionMode
            ? resolvePositionOrderLockClickChainCurrentIndex(clickChain.entries)
            : resolvePositionClickChainCurrentIndex(clickChain.entries);
          const nextChainIndex =
            currentChainIndex >= 0 ? (currentChainIndex + 1) % clickChain.entries.length : 0;
          const nextEntry = clickChain.entries[nextChainIndex] || null;

          if (!nextEntry) {
            return;
          }

          if (positionGroupEditModeRef.current.kind !== 'idle') {
            const editModeEntry =
              positionGroupEditModeRef.current.kind === 'include-in-group'
                ? clickChain.entries.find((entry: any) => entry.kind === 'group') || nextEntry
                : nextEntry;
            applyPositionGroupEditModeSelection(editModeEntry);
            return;
          }

          if (positionOrderLockSelectionMode) {
            if (nextEntry.kind === 'group') {
              previewPositionOrderLockCandidateSelection(nextEntry.frameGroupId, {
                positionGroupProxySelectionGroupId: nextEntry.groupId,
                candidateGroupId: nextEntry.groupId,
                commitSelection: true,
                replaceExistingSelection: false,
              });
              return;
            }

            previewPositionOrderLockCandidateSelection(nextEntry.frameGroupId, {
              preserveFrameGroupId: true,
              disableProxySelection: true,
              commitSelection: true,
              replaceExistingSelection: false,
            });
            return;
          }

          if (event.shiftKey) {
            startMarqueeSelectionInteraction({
              baseSelectionIds: selectedFrameGroupIdsRef.current.slice(),
              positionShiftClickFallbackEntry: nextEntry,
            });
            return;
          }

          if (nextEntry.kind === 'group') {
            const nextGroup = positionBoxGroups.find((group: any) => group.id === nextEntry.groupId) || null;
            const nextSelectionIdsFromEntry = Array.from(
              new Set(
                (nextEntry.groupFrameGroupIds || [])
                  .map((candidateFrameGroupId: string) => candidateFrameGroupId.trim())
                  .filter((candidateFrameGroupId: string) => Boolean(candidateFrameGroupId))
              )
            );
            const nextSelectionIds =
              nextSelectionIdsFromEntry.length > 0
                ? nextSelectionIdsFromEntry
                : nextGroup?.frameGroupIds
                    .map((candidateFrameGroupId: string) => candidateFrameGroupId.trim())
                    .filter((candidateFrameGroupId: string) => Boolean(candidateFrameGroupId)) || [];
            const proxySelection =
              nextSelectionIds.length > 1
                ? [
                    {
                      groupId: nextEntry.groupId,
                      label: nextGroup?.label || nextEntry.groupId,
                      frameGroupIds: nextSelectionIds,
                    },
                  ]
                : undefined;
            const dragSelectionIds = nextSelectionIds.length > 0 ? nextSelectionIds : [nextEntry.frameGroupId];
            const dragAnchorNode =
              queryFrameSelectionAnchorByFrameGroupId(pageInner, dragSelectionIds[0] || nextEntry.frameGroupId);
            applyFrameBoxSelection(dragSelectionIds, {
              positionGroupProxySelectionGroupId: nextEntry.groupId,
              overridePositionGroupProxySelections: proxySelection,
              positionSelectionEntity: {
                kind: 'group',
                groupId: nextEntry.groupId,
                frameGroupIds: dragSelectionIds,
              },
            });
            if (startSelectionMarqueeAfterClickSelection(proxySelection || [])) {
              return;
            }
            if (dragAnchorNode) {
              startFrameDragInteraction(dragAnchorNode, dragSelectionIds);
            }
            return;
          }

          const nextFrameAnchorNode =
            queryFrameSelectionAnchorByFrameGroupId(pageInner, nextEntry.frameGroupId) || frameNode;
          applyFrameBoxSelection([nextEntry.frameGroupId], {
            disableAutoPositionGroupProxySelection: true,
            positionSelectionEntity: {
              kind: 'frame',
              frameGroupId: nextEntry.frameGroupId,
            },
          });
          if (startSelectionMarqueeAfterClickSelection([])) {
            return;
          }
          if (nextFrameAnchorNode) {
            startFrameDragInteraction(nextFrameAnchorNode, [nextEntry.frameGroupId]);
          }
          return;
        }
      }

      const shouldStartMarqueeSelection =
        !edgeButton &&
        !resizeHandle &&
        Boolean(pageInner) &&
        (!frameNode ||
          (event.shiftKey && selectionPanelTab !== 'position') ||
          (selectionPanelTab !== 'position' &&
            Boolean(frameNode) &&
            (canvasInteractionMode === 'select' || (canvasInteractionMode === 'move' && !hadSelectionBeforePointerDown))));

      if (shouldStartMarqueeSelection && pageInner) {
        const rawAnchorFrameGroupId = frameNode ? getFrameGroupId(frameNode) : '';
        startMarqueeSelectionInteraction({ anchorFrameGroupId: rawAnchorFrameGroupId });
        return;
      }

      if (!frameNode) {
        if (
          !edgeButton &&
          !resizeHandle &&
          !pageInner &&
          (selectedFrameGroupIdsRef.current.length > 0 || edgeSelectionStateRef.current.tokens.length > 0)
        ) {
          event.preventDefault();
          clearFrameSelection();
        }
        return;
      }

      const frameGroupId = getFrameGroupId(frameNode);

      if (!frameGroupId) {
        return;
      }

      if (selectionPanelTab !== 'position' && (edgeButton || resizeHandle)) {
        event.preventDefault();
        return;
      }

      if (selectionPanelTab === 'position' && !edgeButton && !resizeHandle) {
        const pointerPoint = pageInner
          ? readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100)
          : null;

        if (positionOrderLockSelectionMode) {
          event.preventDefault();
          const clickChain = resolvePositionSelectionClickChain(pageInner, frameGroupId, pointerPoint);
          const currentChainIndex = resolvePositionOrderLockClickChainCurrentIndex(clickChain.entries);
          const nextChainIndex =
            clickChain.entries.length > 0
              ? currentChainIndex >= 0
                ? (currentChainIndex + 1) % clickChain.entries.length
                : 0
              : -1;
          const nextEntry = nextChainIndex >= 0 ? clickChain.entries[nextChainIndex] : null;

          if (!nextEntry) {
            previewPositionOrderLockCandidateSelection(frameGroupId, {
              preserveFrameGroupId: true,
              disableProxySelection: true,
              commitSelection: true,
              replaceExistingSelection: false,
            });
            return;
          }

          if (nextEntry.kind === 'group') {
            previewPositionOrderLockCandidateSelection(nextEntry.frameGroupId, {
              positionGroupProxySelectionGroupId: nextEntry.groupId,
              candidateGroupId: nextEntry.groupId,
              commitSelection: true,
              replaceExistingSelection: false,
            });
            return;
          }

          const groupIdsToReplace = clickChain.entries
            .filter((entry: any) => entry.kind === 'group')
            .map((entry: any) => entry.groupId);
          const selectedGroupIdToReplace =
            groupIdsToReplace.find((groupId: string) => {
              const group = positionBoxGroups.find((candidateGroup: any) => candidateGroup.id === groupId) || null;
              if (!group) {
                return false;
              }

              return group.frameGroupIds.some(
                (memberFrameGroupId: string) =>
                  positionOrderLockFrameGroupIds.includes(memberFrameGroupId) &&
                  (positionOrderLockSelectionKindByFrameGroupId[memberFrameGroupId] || 'frame') === 'group'
              );
            }) || '';

          previewPositionOrderLockCandidateSelection(nextEntry.frameGroupId, {
            preserveFrameGroupId: true,
            candidateGroupId: selectedGroupIdToReplace,
            disableProxySelection: true,
            commitSelection: true,
            replaceSelectionFromGroupId: selectedGroupIdToReplace,
            replaceExistingSelection: false,
          });
          return;
        }

        event.preventDefault();
        const currentSelectionIds = selectedFrameGroupIdsRef.current
          .map((selectedFrameGroupId: string) => selectedFrameGroupId.trim())
          .filter((selectedFrameGroupId: string) => Boolean(selectedFrameGroupId));
        const isSameSingleFrameSelection =
          currentSelectionIds.length === 1 &&
          currentSelectionIds[0] === frameGroupId &&
          !optionsRef.current.positionGroupProxySelectionGroupIdRef.current.trim();
        const directSelectionGroup = positionBoxGroupByFrameGroupId.get(frameGroupId) || null;
        const liveDirectSelectionGroupFrameCount = (() => {
          if (!frameNode) {
            return 0;
          }

          const groupWrapper = frameNode.closest<HTMLElement>('[data-template-position-group-node="true"]');

          if (!groupWrapper) {
            return 0;
          }

          return Array.from(
            new Set(
              Array.from(groupWrapper.querySelectorAll<HTMLElement>('[data-template-frame-group]'))
                .map((node) => node.getAttribute('data-template-frame-group')?.trim() || '')
                .filter((candidateFrameGroupId) => Boolean(candidateFrameGroupId))
            )
          ).length;
        })();
        const directSelectionClickChain =
          positionGroupEditModeRef.current.kind === 'idle'
            ? resolvePositionSelectionClickChain(pageInner, frameGroupId, pointerPoint)
            : { entries: [] as PositionSelectionClickChainEntry[] };
        const hasDirectSelectionGroupEntry = directSelectionClickChain.entries.some((entry: any) => entry.kind === 'group');
        const canUseDirectFrameSelection =
          !event.shiftKey &&
          positionGroupEditModeRef.current.kind === 'idle' &&
          !isSameSingleFrameSelection &&
          (!directSelectionGroup || directSelectionGroup.frameGroupIds.length <= 1) &&
          liveDirectSelectionGroupFrameCount <= 1 &&
          !hasDirectSelectionGroupEntry;
        if (canUseDirectFrameSelection) {
          applyFrameBoxSelection([frameGroupId], {
            disableAutoPositionGroupProxySelection: true,
            positionSelectionEntity: {
              kind: 'frame',
              frameGroupId,
            },
          });
          if (startSelectionMarqueeAfterClickSelection([])) {
            return;
          }
          startFrameDragInteraction(frameNode, [frameGroupId]);
          return;
        }
        const clickChain = directSelectionClickChain;
        React.startTransition(() => {
          setPositionSelectionClickChainSnapshot({
            sourceFrameGroupId: frameGroupId,
            point: pointerPoint,
            entries: clickChain.entries,
          });
        });
        const currentChainIndex = resolvePositionClickChainCurrentIndex(clickChain.entries);
        const nextChainIndex =
          clickChain.entries.length > 0
            ? currentChainIndex >= 0
              ? (currentChainIndex + 1) % clickChain.entries.length
              : 0
            : -1;
        const nextEntry = nextChainIndex >= 0 ? clickChain.entries[nextChainIndex] : null;

        if (positionGroupEditModeRef.current.kind !== 'idle') {
          const fallbackEntry: PositionSelectionClickChainEntry = nextEntry || {
            kind: 'frame',
            frameGroupId,
          };
          const editModeEntry =
            positionGroupEditModeRef.current.kind === 'include-in-group'
              ? clickChain.entries.find((entry: any) => entry.kind === 'group') || fallbackEntry
              : fallbackEntry;
          applyPositionGroupEditModeSelection(editModeEntry);
          return;
        }

        if (!nextEntry) {
          if (event.shiftKey) {
            startMarqueeSelectionInteraction({
              baseSelectionIds: selectedFrameGroupIdsRef.current.slice(),
              positionShiftClickFallbackEntry: {
                kind: 'frame',
                frameGroupId,
              },
            });
            return;
          }

          applyFrameBoxSelection([frameGroupId], {
            disableAutoPositionGroupProxySelection: true,
            positionSelectionEntity: {
              kind: 'frame',
              frameGroupId,
            },
          });
          if (startSelectionMarqueeAfterClickSelection([])) {
            return;
          }
          startFrameDragInteraction(frameNode, [frameGroupId]);
          return;
        }

        if (event.shiftKey) {
          startMarqueeSelectionInteraction({
            baseSelectionIds: selectedFrameGroupIdsRef.current.slice(),
            positionShiftClickFallbackEntry: nextEntry,
          });
          return;
        }

        if (nextEntry.kind === 'group') {
          const nextGroup = positionBoxGroups.find((group: any) => group.id === nextEntry.groupId) || null;
          const nextSelectionIdsFromEntry = Array.from(
            new Set(
              (nextEntry.groupFrameGroupIds || [])
                .map((candidateFrameGroupId: string) => candidateFrameGroupId.trim())
                .filter((candidateFrameGroupId: string) => Boolean(candidateFrameGroupId))
            )
          );
          const nextSelectionIds =
            nextSelectionIdsFromEntry.length > 0
              ? nextSelectionIdsFromEntry
              : nextGroup?.frameGroupIds
                  .map((candidateFrameGroupId: string) => candidateFrameGroupId.trim())
                  .filter((candidateFrameGroupId: string) => Boolean(candidateFrameGroupId)) || [];
          const proxySelection =
            nextSelectionIds.length > 1
              ? [
                  {
                    groupId: nextEntry.groupId,
                    label: nextGroup?.label || nextEntry.groupId,
                    frameGroupIds: nextSelectionIds,
                  },
                ]
              : undefined;
          const dragSelectionIds = nextSelectionIds.length > 0 ? nextSelectionIds : [nextEntry.frameGroupId];
          applyFrameBoxSelection(dragSelectionIds, {
            positionGroupProxySelectionGroupId: nextEntry.groupId,
            overridePositionGroupProxySelections: proxySelection,
            positionSelectionEntity: {
              kind: 'group',
              groupId: nextEntry.groupId,
              frameGroupIds: dragSelectionIds,
            },
          });
          if (startSelectionMarqueeAfterClickSelection(proxySelection || [])) {
            return;
          }
          startFrameDragInteraction(frameNode, dragSelectionIds);
          return;
        }

        const nextFrameAnchorNode =
          queryFrameSelectionAnchorByFrameGroupId(pageInner, nextEntry.frameGroupId) || frameNode;
        applyFrameBoxSelection([nextEntry.frameGroupId], {
          disableAutoPositionGroupProxySelection: true,
          positionSelectionEntity: {
            kind: 'frame',
            frameGroupId: nextEntry.frameGroupId,
          },
        });
        if (startSelectionMarqueeAfterClickSelection([])) {
          return;
        }
        startFrameDragInteraction(nextFrameAnchorNode, [nextEntry.frameGroupId]);
        return;
      }

      const explicitEdgeDirection = ((edgeButton?.getAttribute('data-direction') ||
        resizeHandle?.getAttribute('data-direction') ||
        '') as TemplateFrameResizeDirection);
      const explicitEdgeSide = getCardinalEdgeSideFromDirection(explicitEdgeDirection);

      if (explicitEdgeSide && pageInner) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        const currentSelection = TemplateEdgeSelectionService.reconcileSelectionState({
          snapshot,
          currentSelection: edgeSelectionStateRef.current,
        });
        const clickedEdgeId = explicitEdgeId || `${frameGroupId}:${explicitEdgeSide}`;
        const resizeIntent = TemplateEdgeResizeIntentService.resolveResizeIntent({
          snapshot,
          currentSelection,
          clickedEdgeId,
          withShift: Boolean(event.shiftKey),
        });
        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        edgePressStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          node: frameNode,
          direction: explicitEdgeDirection,
          clickedEdgeId,
          snapshot,
          clickSelection: resizeIntent.clickSelectionState,
          dragSelection: resizeIntent.dragSelectionState,
          mutationEdgeIds: resizeIntent.mutationEdgeIds,
          edgeRoleById: resizeIntent.edgeRoleById,
          withShift: Boolean(event.shiftKey),
        };
        return;
      }

      if (!pageInner) {
        applyFrameBoxSelection([frameGroupId]);
        return;
      }

      const currentSelectionIds = selectedFrameGroupIdsRef.current;
      const stableSelection = currentSelectionIds.includes(frameGroupId) ? currentSelectionIds : [frameGroupId];
      applyFrameBoxSelection(stableSelection);

      if (resizeHandle) {
        const direction = (resizeHandle.getAttribute('data-direction') || 'se') as TemplateFrameResizeDirection;
        const resizeContext = buildFrameResizeContext(frameNode);
        const resizeSiblingRects = getFrameNodes(pageInner)
          .filter((node: HTMLElement) => node !== frameNode)
          .map((node: HTMLElement) => readFrameNodeRect(node));
        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        resizeStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          direction,
          node: frameNode,
          rect: readFrameNodeRect(frameNode),
          widthInstructions:
            direction.includes('e') || direction.includes('w')
              ? collectWidthResizeInstructions(resizeContext, direction.includes('w') ? 'left' : 'right')
              : undefined,
          snapSiblingRects: filterResizeSnapRects(resizeSiblingRects, readFrameNodeRect(frameNode), direction),
          edgeResizeTargets: undefined,
        };
        return;
      }

      if (selectionPanelTab !== 'position' || canvasInteractionMode !== 'move') {
        return;
      }

      if (isInteractiveTarget(target)) {
        return;
      }

      event.preventDefault();
      lockPreviewEditorStateDuringInteraction();
      safeSetPointerCapture(event.currentTarget, event.pointerId);
      activePointerOwnerRef.current = event.currentTarget;
      const pageFrameNodes = getFrameNodes(pageInner);
      const selectionOnPage = pageFrameNodes.filter(
        (node: HTMLElement) =>
          getFrameGroupId(node) === frameGroupId ||
          (stableSelection.includes(getFrameGroupId(node)) && node.closest<HTMLElement>('.page-inner') === pageInner)
      );
      const dragNodes = selectionOnPage.length ? selectionOnPage : [frameNode];
      const dragNodeSet = new Set(dragNodes);
      const dragNodeRects = dragNodes.map((node: HTMLElement) => readFrameMoveRect(node));

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scale: previewZoom / 100,
        active: false,
        pageInner,
        anchorRect: readFrameMoveRect(frameNode),
        moveRect: buildFrameRectUnion(dragNodeRects),
        nodes: dragNodes.map((node: HTMLElement, index: number) => ({
          node,
          rect: dragNodeRects[index] || readFrameMoveRect(node),
        })),
        snapSiblingRects: pageFrameNodes
          .filter((node: HTMLElement) => !dragNodeSet.has(node))
          .map((node: HTMLElement) => readFrameMoveRect(node)),
      };
    },
    []
  );

  const handlePreviewPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const {
      canvasPanStateRef,
      previewRef,
      templateUsagePreviewMode,
      marqueeSelectionStateRef,
      createBoxStateRef,
      dragStateRef,
      resizeStateRef,
      readPageInnerPointerPoint,
      buildPointerDragRect,
      FRAME_MARQUEE_DRAG_THRESHOLD_PX,
      createFrameEditorGhost,
      FRAME_CREATION_GHOST_CLASS,
      writeFrameEditorGhostRect,
      clampFrameNodeRect,
      writeFrameMoveRect,
      ensureRelativeAnchorConfigs,
      applyRelativeAnchoredFrameRects,
      getFrameGroupId,
      edgePressStateRef,
      resolveLiveEdgeResizeTargets,
      applyRuntimeSelectionUi,
      edgeSelectionStateRef,
      readFrameNodeRect,
      collectPassiveShiftedHorizontalEdgeIds,
      resolveFrameSelectionAnchor,
      rawFrameNodeSelector,
      buildWidthInstructionKey,
      targetsSharePhysicalBoundary,
      pickHeightResizeTargetMember,
      resolveSharedEdgeResizeDelta,
      resolveWidthInstructionDelta,
      resolveFrameResizeTopDelta,
      resolveFrameResizeBottomDelta,
      resolveEdgeDragAutosnapResult,
      clampResolvedEdgeDragDeltaToPointerRequest,
      isSimpleExactPhysicalBoundaryVerticalDrag,
      applyFrameResizeWidthDelta,
      applyFrameResizeTopDelta,
      applyFrameResizeHeightDeltaLocal,
      applyFrameResizeHeightDelta,
      stabilizeLiveVerticalEdgeTargetsToAppliedDelta,
      realignLiveVerticalEdgeTargets,
      buildLiveEdgeTopologySnapshot,
      resolveLiveEdgeAutosnapCorrection,
      normalizeLiveVerticalPhysicalPeers,
      normalizeLiveVerticalPhysicalPeersToDragDirection,
      normalizePassiveOppositeVerticalEdges,
      applyFrameResizeWithDirection,
      rebaseRelativeAnchorConfigForResizeDirection,
      syncLiveAppliedEdgeDeltas,
    } = optionsRef.current;
    const panState = canvasPanStateRef.current;

    if (panState?.pointerId === event.pointerId && previewRef.current) {
      event.preventDefault();
      previewRef.current.scrollLeft = panState.startScrollLeft - (event.clientX - panState.startX);
      previewRef.current.scrollTop = panState.startScrollTop - (event.clientY - panState.startY);
      return;
    }

    if (templateUsagePreviewMode) {
      return;
    }

    const marqueeSelectionState = marqueeSelectionStateRef.current;
    const createBoxState = createBoxStateRef.current;
    const dragState = dragStateRef.current;
    let resizeState = resizeStateRef.current;

    if (marqueeSelectionState && event.pointerId === marqueeSelectionState.pointerId) {
      event.preventDefault();
      updateMarqueeSelectionFromClientPoint(marqueeSelectionState, event.clientX, event.clientY);
      syncMarqueeAutoScrollFromClientPoint(event.pointerId, event.clientX, event.clientY);
      return;
    }

    if (createBoxState && event.pointerId === createBoxState.pointerId) {
      event.preventDefault();
      const currentPoint = readPageInnerPointerPoint(
        createBoxState.pageInner,
        event.clientX,
        event.clientY,
        createBoxState.scale
      );
      const nextRect = buildPointerDragRect(createBoxState.origin, currentPoint);

      if (
        !createBoxState.active &&
        nextRect.width < FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
        nextRect.height < FRAME_MARQUEE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (!createBoxState.active) {
        const nextGhost = createFrameEditorGhost(FRAME_CREATION_GHOST_CLASS);
        createBoxState.pageInner.appendChild(nextGhost);
        createBoxState.ghost = nextGhost;
        createBoxState.active = true;
      }

      if (createBoxState.ghost) {
        writeFrameEditorGhostRect(createBoxState.ghost, nextRect);
      }
      return;
    }

    if (dragState && event.pointerId === dragState.pointerId) {
      event.preventDefault();
      const rawDeltaX = event.clientX - dragState.startX;
      const rawDeltaY = event.clientY - dragState.startY;

      if (
        !dragState.active &&
        Math.abs(rawDeltaX) < optionsRef.current.FRAME_MOVE_DRAG_THRESHOLD_PX &&
        Math.abs(rawDeltaY) < optionsRef.current.FRAME_MOVE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      dragState.active = true;
      const pageBounds = {
        width: dragState.pageInner.clientWidth,
        height: dragState.pageInner.clientHeight,
      };
      const delta = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: rawDeltaX,
          y: rawDeltaY,
        },
        dragState.scale
      );
      const requestedMoveRect = {
        ...dragState.moveRect,
        left: dragState.moveRect.left + delta.x,
        top: dragState.moveRect.top + delta.y,
      };
      const snapResult = TemplateFrameEditGeometryService.snapMovedRect({
        rect: requestedMoveRect,
        siblingRects: dragState.snapSiblingRects,
        bounds: pageBounds,
      });
      const resolvedRect = snapResult.ok && snapResult.value ? snapResult.value : clampFrameNodeRect(requestedMoveRect, pageBounds);
      const moveDx = resolvedRect.left - dragState.moveRect.left;
      const moveDy = resolvedRect.top - dragState.moveRect.top;

      dragState.nodes.forEach(({ node, rect }: any) => {
        writeFrameMoveRect(
          node,
          clampFrameNodeRect(
            {
              left: rect.left + moveDx,
              top: rect.top + moveDy,
              width: rect.width,
              height: rect.height,
            },
            pageBounds
          )
        );
      });
      ensureRelativeAnchorConfigs(dragState.pageInner);
      applyRelativeAnchoredFrameRects(dragState.pageInner, dragState.nodes.map(({ node }: any) => getFrameGroupId(node)));
      return;
    }

    const edgePressState = edgePressStateRef.current;

    if (!resizeState && edgePressState && event.pointerId === edgePressState.pointerId) {
      event.preventDefault();

      if (edgePressState.withShift) {
        return;
      }

      const rawDeltaX = event.clientX - edgePressState.startX;
      const rawDeltaY = event.clientY - edgePressState.startY;

      if (
        Math.abs(rawDeltaX) < optionsRef.current.EDGE_DRAG_START_THRESHOLD_PX &&
        Math.abs(rawDeltaY) < optionsRef.current.EDGE_DRAG_START_THRESHOLD_PX
      ) {
        return;
      }

      const resizeTargets = resolveLiveEdgeResizeTargets(
        previewRef.current || event.currentTarget,
        edgePressState.snapshot,
        edgePressState.mutationEdgeIds
      );

      applyRuntimeSelectionUi([], edgePressState.dragSelection);
      edgeSelectionStateRef.current = edgePressState.dragSelection;
      resizeStateRef.current = {
        pointerId: edgePressState.pointerId,
        startX: edgePressState.startX,
        startY: edgePressState.startY,
        scale: edgePressState.scale,
        pageInner: edgePressState.pageInner,
        direction: edgePressState.direction,
        node: edgePressState.node,
        rect: readFrameNodeRect(edgePressState.node),
        widthInstructions:
          edgePressState.direction === 'e' || edgePressState.direction === 'w'
            ? resizeTargets[0]?.widthInstructions
            : undefined,
        edgeResizeTargets: resizeTargets,
        edgeSelectionAfterResize: edgePressState.dragSelection,
        edgeRoleById: edgePressState.edgeRoleById,
        mutationEdgeIds: edgePressState.mutationEdgeIds,
        edgeDragSnapshot: edgePressState.snapshot,
        edgeLineCoordinateBaseline: Object.fromEntries(
          edgePressState.snapshot.edges.map((edge: any) => [edge.edgeId, edge.lineCoordinate])
        ),
        appliedEdgeDeltaX: 0,
        appliedEdgeDeltaY: 0,
        edgeAutosnapLockX: null,
        edgeAutosnapLockY: null,
        passiveShiftedEdgeIds: collectPassiveShiftedHorizontalEdgeIds(
          edgePressState.pageInner,
          edgePressState.node,
          edgePressState.direction,
          edgePressState.snapshot
        ),
      };
      edgePressStateRef.current = null;
      resizeState = resizeStateRef.current;
    }

    if (resizeState && event.pointerId === resizeState.pointerId) {
      event.preventDefault();
      if (
        (!resizeState.pageInner.isConnected ||
          resizeState.pageInner.clientWidth <= 0 ||
          resizeState.pageInner.clientHeight <= 0) &&
        previewRef.current
      ) {
        const resizeFrameGroupId = getFrameGroupId(resizeState.node);
        const liveResizeNode = resizeFrameGroupId
          ? resolveFrameSelectionAnchor(
              previewRef.current.querySelector<HTMLElement>(
                `${rawFrameNodeSelector}[data-template-frame-group="${resizeFrameGroupId}"]`
              )
            )
          : null;
        const livePageInner =
          liveResizeNode?.closest<HTMLElement>('.page-inner') ||
          previewRef.current.querySelector<HTMLElement>('.page-inner') ||
          null;

        if (liveResizeNode) {
          resizeState.node = liveResizeNode;
        }

        if (livePageInner) {
          resizeState.pageInner = livePageInner;
        }
      }
      const pageBounds = {
        width: resizeState.pageInner.clientWidth,
        height: resizeState.pageInner.clientHeight,
      };
      const delta = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: event.clientX - resizeState.startX,
          y: event.clientY - resizeState.startY,
        },
        resizeState.scale
      );

      let nextRect: FrameNodeRect = { ...resizeState.rect };

      if (resizeState.direction.includes('w')) {
        nextRect.left = resizeState.rect.left + delta.x;
        nextRect.width = resizeState.rect.width - delta.x;
      }

      if (resizeState.direction.includes('e')) {
        nextRect.width = resizeState.rect.width + delta.x;
      }

      if (resizeState.direction.includes('n')) {
        nextRect.top = resizeState.rect.top + delta.y;
        nextRect.height = resizeState.rect.height - delta.y;
      }

      if (resizeState.direction.includes('s')) {
        nextRect.height = resizeState.rect.height + delta.y;
      }

      const activeEdgeResizeTargets = resizeState.edgeResizeTargets || [];

      if (activeEdgeResizeTargets.length > 0) {
        const boundedEdgeRect = clampFrameNodeRect(nextRect, pageBounds);
        const totalRequestedDeltaX = resizeState.direction.includes('w')
          ? boundedEdgeRect.left - resizeState.rect.left
          : resizeState.direction.includes('e')
            ? boundedEdgeRect.width - resizeState.rect.width
            : 0;
        const totalRequestedDeltaY = resizeState.direction.includes('n')
          ? boundedEdgeRect.top - resizeState.rect.top
          : resizeState.direction.includes('s')
            ? boundedEdgeRect.height - resizeState.rect.height
            : 0;
        const nextDeltaX = totalRequestedDeltaX - (resizeState.appliedEdgeDeltaX || 0);
        const nextDeltaY = totalRequestedDeltaY - (resizeState.appliedEdgeDeltaY || 0);
        const widthResizeTargets = activeEdgeResizeTargets.filter(
          (edgeTarget: any) => edgeTarget.orientation === 'vertical' && (edgeTarget.widthInstructions?.length || 0) > 0
        );
        const widthConstraintTargets = widthResizeTargets.reduce<
          Array<{
            members: EdgeResizeTargetMember[];
            instructions: FrameWidthResizeInstruction[];
          }>
        >((groups, edgeTarget: any) => {
          const targetMembers = [...edgeTarget.members, ...edgeTarget.physicalPeerMembers].filter(
            (member: any, memberIndex: number, members: any[]) =>
              members.findIndex((candidateMember: any) => candidateMember.edgeId === member.edgeId) === memberIndex
          );
          const targetInstructions = [
            ...(edgeTarget.widthInstructions || []),
            ...targetMembers.flatMap((member: any) => member.widthInstructions || []),
          ];
          const matchedGroup = groups.find((group) =>
            targetMembers.some((member: any) =>
              group.members.some(
                (groupMember) =>
                  groupMember.edgeId === member.edgeId || targetsSharePhysicalBoundary(groupMember, member)
              )
            )
          );

          if (!matchedGroup) {
            const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
            targetInstructions.forEach((instruction: FrameWidthResizeInstruction) => {
              uniqueInstructions.set(buildWidthInstructionKey(instruction, edgeTarget.node), instruction);
            });
            groups.push({
              members: targetMembers,
              instructions: Array.from(uniqueInstructions.values()),
            });
            return groups;
          }

          targetMembers.forEach((member: any) => {
            if (!matchedGroup.members.some((groupMember) => groupMember.edgeId === member.edgeId)) {
              matchedGroup.members.push(member);
            }
          });
          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
          [...matchedGroup.instructions, ...targetInstructions].forEach((instruction) => {
            uniqueInstructions.set(buildWidthInstructionKey(instruction, edgeTarget.node), instruction);
          });
          matchedGroup.instructions = Array.from(uniqueInstructions.values());
          return groups;
        }, []);
        const heightResizeTargets = activeEdgeResizeTargets
          .map((edgeTarget: any) => ({
            edgeTarget,
            member: pickHeightResizeTargetMember(edgeTarget, resizeState.direction),
          }))
          .filter(
            (
              value
            ): value is {
              edgeTarget: EdgeResizeTarget;
              member: EdgeResizeTargetMember;
            } => Boolean(value.member)
          );
        const resolveWidthDragDelta = (requestedDelta: number) =>
          resolveSharedEdgeResizeDelta(
            requestedDelta,
            widthConstraintTargets
              .map((constraintTarget) => resolveWidthInstructionDelta(constraintTarget.instructions, requestedDelta))
              .filter((candidateDelta) => Number.isFinite(candidateDelta))
          );
        const resolveHeightDragDelta = (requestedDelta: number) =>
          resolveSharedEdgeResizeDelta(
            requestedDelta,
            heightResizeTargets
              .map(({ edgeTarget, member }) => {
                const constraintMembers = [member, ...edgeTarget.members, ...edgeTarget.physicalPeerMembers].filter(
                  (constraintMember, constraintIndex, members) =>
                    members.findIndex((candidateMember) => candidateMember.edgeId === constraintMember.edgeId) ===
                    constraintIndex
                );
                const candidateDeltas = constraintMembers
                  .map((constraintMember) => {
                    if (constraintMember.side === 'top') {
                      return resolveFrameResizeTopDelta(constraintMember.node, requestedDelta);
                    }

                    if (constraintMember.side === 'bottom') {
                      return resolveFrameResizeBottomDelta(constraintMember.node, requestedDelta);
                    }

                    return 0;
                  })
                  .filter((candidateDelta) => Number.isFinite(candidateDelta));

                if (candidateDeltas.length === 0) {
                  return 0;
                }

                return resolveSharedEdgeResizeDelta(requestedDelta, candidateDeltas);
              })
              .filter((candidateDelta) => Number.isFinite(candidateDelta))
          );
        const constrainedDeltaX = resolveWidthDragDelta(nextDeltaX);
        const constrainedDeltaY = resolveHeightDragDelta(nextDeltaY);
        const movingWidthMembers = widthResizeTargets
          .flatMap((edgeTarget: any) => [...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .filter(
            (member: any, memberIndex: number, members: any[]) =>
              members.findIndex((candidateMember: any) => candidateMember.edgeId === member.edgeId) === memberIndex
          );
        const movingHeightMembers = heightResizeTargets
          .flatMap(({ edgeTarget, member }) => [member, ...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .filter(
            (constraintMember, constraintIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === constraintMember.edgeId) ===
              constraintIndex
          );
        const autosnapWidthMembers = movingWidthMembers
          .map((member: any) => {
            const baselineEdge = resizeState.edgeDragSnapshot
              ? TemplateEdgeTopologyService.getEdgeById(resizeState.edgeDragSnapshot, member.edgeId)
              : null;

            if (!baselineEdge) {
              return member;
            }

            return {
              ...member,
              lineCoordinate: baselineEdge.lineCoordinate,
              spanStart: baselineEdge.spanStart,
              spanEnd: baselineEdge.spanEnd,
            };
          })
          .filter((member): member is EdgeResizeTargetMember => Boolean(member));
        const autosnapHeightMembers = movingHeightMembers
          .map((member) => {
            const baselineEdge = resizeState.edgeDragSnapshot
              ? TemplateEdgeTopologyService.getEdgeById(resizeState.edgeDragSnapshot, member.edgeId)
              : null;

            if (!baselineEdge) {
              return member;
            }

            return {
              ...member,
              lineCoordinate: baselineEdge.lineCoordinate,
              spanStart: baselineEdge.spanStart,
              spanEnd: baselineEdge.spanEnd,
            };
          })
          .filter((member): member is EdgeResizeTargetMember => Boolean(member));
        const snappedResultX = resolveEdgeDragAutosnapResult({
          requestedDelta: constrainedDeltaX,
          orientation: 'vertical',
          movingMembers: autosnapWidthMembers,
          snapshot: resizeState.edgeDragSnapshot,
          currentAppliedDelta: resizeState.appliedEdgeDeltaX || 0,
          existingLock: resizeState.edgeAutosnapLockX,
        });
        const snappedResultY = resolveEdgeDragAutosnapResult({
          requestedDelta: constrainedDeltaY,
          orientation: 'horizontal',
          movingMembers: autosnapHeightMembers,
          snapshot: resizeState.edgeDragSnapshot,
          currentAppliedDelta: resizeState.appliedEdgeDeltaY || 0,
          existingLock: resizeState.edgeAutosnapLockY,
        });
        const snappedDeltaX = snappedResultX.delta;
        const snappedDeltaY = snappedResultY.delta;
        const finalDeltaX =
          Math.abs(snappedDeltaX - constrainedDeltaX) >= 0.5
            ? resolveWidthDragDelta(snappedDeltaX)
            : constrainedDeltaX;
        const finalDeltaY =
          Math.abs(snappedDeltaY - constrainedDeltaY) >= 0.5
            ? resolveHeightDragDelta(snappedDeltaY)
            : constrainedDeltaY;
        const safeFinalDeltaX = clampResolvedEdgeDragDeltaToPointerRequest(nextDeltaX, finalDeltaX);
        const safeFinalDeltaY = clampResolvedEdgeDragDeltaToPointerRequest(nextDeltaY, finalDeltaY);
        resizeState.edgeAutosnapLockX = snappedResultX.nextLock || null;
        resizeState.edgeAutosnapLockY = snappedResultY.nextLock || null;
        const useSimpleExactBoundaryWidthCorrections =
          widthResizeTargets.length > 0 &&
          isSimpleExactPhysicalBoundaryVerticalDrag({
            direction: resizeState.direction,
            snapshot: resizeState.edgeDragSnapshot,
            edgeRoleById: resizeState.edgeRoleById,
          });

        const nextAppliedEdgeDeltaX = (resizeState.appliedEdgeDeltaX || 0) + safeFinalDeltaX;
        const nextAppliedEdgeDeltaY = (resizeState.appliedEdgeDeltaY || 0) + safeFinalDeltaY;

        widthResizeTargets.forEach((edgeTarget: any) => {
          if (Math.abs(safeFinalDeltaX) >= 0.5) {
            applyFrameResizeWidthDelta(edgeTarget.node, safeFinalDeltaX, edgeTarget.widthInstructions);
          }
        });

        heightResizeTargets.forEach(({ edgeTarget, member }) => {
          if (Math.abs(safeFinalDeltaY) < 0.5) {
            return;
          }

          if (member.side === 'top') {
            applyFrameResizeTopDelta(member.node, safeFinalDeltaY);
            return;
          }

          if (member.side === 'bottom') {
            if (edgeTarget.hasOppositePeer) {
              applyFrameResizeHeightDeltaLocal(member.node, safeFinalDeltaY);
              return;
            }

            applyFrameResizeHeightDelta(member.node, safeFinalDeltaY);
          }
        });

        resizeState.appliedEdgeDeltaX = nextAppliedEdgeDeltaX;
        resizeState.appliedEdgeDeltaY = nextAppliedEdgeDeltaY;
        if (previewRef.current) {
          if (widthResizeTargets.length > 0 && !useSimpleExactBoundaryWidthCorrections) {
            stabilizeLiveVerticalEdgeTargetsToAppliedDelta(previewRef.current, resizeState, nextAppliedEdgeDeltaX);
          }
          if (!useSimpleExactBoundaryWidthCorrections) {
            realignLiveVerticalEdgeTargets(previewRef.current, resizeState);
          }
          if (
            widthResizeTargets.length > 0 &&
            !resizeState.edgeAutosnapLockX &&
            !useSimpleExactBoundaryWidthCorrections
          ) {
            const liveAutosnapSnapshot = buildLiveEdgeTopologySnapshot(previewRef.current);
            const liveMovingWidthMembers = movingWidthMembers
              .map((member: any) => {
                const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveAutosnapSnapshot, member.edgeId);

                if (!liveEdge) {
                  return null;
                }

                return {
                  ...member,
                  lineCoordinate: liveEdge.lineCoordinate,
                  spanStart: liveEdge.spanStart,
                  spanEnd: liveEdge.spanEnd,
                };
              })
              .filter((member): member is EdgeResizeTargetMember => Boolean(member));
            const liveAutosnapCorrectionX = resolveLiveEdgeAutosnapCorrection({
              orientation: 'vertical',
              movingMembers: liveMovingWidthMembers,
              snapshot: liveAutosnapSnapshot,
            });

            if (Math.abs(liveAutosnapCorrectionX) >= 0.5) {
              widthResizeTargets.forEach((edgeTarget: any) => {
                applyFrameResizeWidthDelta(edgeTarget.node, liveAutosnapCorrectionX, edgeTarget.widthInstructions);
              });
              resizeState.appliedEdgeDeltaX += liveAutosnapCorrectionX;
              stabilizeLiveVerticalEdgeTargetsToAppliedDelta(
                previewRef.current,
                resizeState,
                resizeState.appliedEdgeDeltaX
              );
              realignLiveVerticalEdgeTargets(previewRef.current, resizeState);
            }
          }
          if (Math.abs(safeFinalDeltaY) >= 0.5) {
            normalizeLiveVerticalPhysicalPeers(previewRef.current, {
              preferredEdgeRoleById: resizeState.edgeRoleById,
            });
          }
          if (widthResizeTargets.length > 0 && !useSimpleExactBoundaryWidthCorrections) {
            stabilizeLiveVerticalEdgeTargetsToAppliedDelta(
              previewRef.current,
              resizeState,
              resizeState.appliedEdgeDeltaX || 0
            );
            normalizeLiveVerticalPhysicalPeersToDragDirection(previewRef.current, resizeState);
          }
          if (widthResizeTargets.length > 0) {
            normalizePassiveOppositeVerticalEdges(previewRef.current, resizeState);
          }
        }
      } else {
        const snapResult = TemplateFrameEditGeometryService.snapResizedRect({
          rect: clampFrameNodeRect(nextRect, pageBounds),
          direction: resizeState.direction,
          siblingRects: resizeState.snapSiblingRects || [],
          bounds: pageBounds,
        });
        const resolvedRect = snapResult.ok && snapResult.value ? snapResult.value : clampFrameNodeRect(nextRect, pageBounds);
        applyFrameResizeWithDirection(
          resizeState.node,
          resolvedRect,
          resizeState.direction,
          resizeState.widthInstructions
        );
      }

      const resizeDirection = resizeState.direction;
      if (activeEdgeResizeTargets.length > 0) {
        const targetNodes = Array.from(
          new Set(
            activeEdgeResizeTargets.flatMap((edgeTarget: any) =>
              [...edgeTarget.members, ...edgeTarget.physicalPeerMembers].map((member: any) => member.node)
            )
          )
        );
        targetNodes.forEach((node: any) =>
          rebaseRelativeAnchorConfigForResizeDirection(node, resizeState.pageInner, resizeDirection)
        );
      } else {
        rebaseRelativeAnchorConfigForResizeDirection(resizeState.node, resizeState.pageInner, resizeDirection);
      }

      ensureRelativeAnchorConfigs(resizeState.pageInner);
      applyRelativeAnchoredFrameRects(
        resizeState.pageInner,
        activeEdgeResizeTargets.length > 0
          ? Array.from(
              new Set(
                activeEdgeResizeTargets.flatMap((edgeTarget: any) =>
                  [...edgeTarget.members, ...edgeTarget.physicalPeerMembers]
                    .map((member: any) => getFrameGroupId(member.node))
                    .filter((frameGroupId: string) => Boolean(frameGroupId))
                )
              )
            )
          : [getFrameGroupId(resizeState.node)]
      );
      if (previewRef.current) {
        syncLiveAppliedEdgeDeltas(previewRef.current, resizeState);
      }
    }
  }, [syncMarqueeAutoScrollFromClientPoint, updateMarqueeSelectionFromClientPoint]);

  const handlePreviewPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const {
        canvasPanStateRef,
        activePointerOwnerRef,
        safeReleasePointerCapture,
        setSpacePanDragging,
        templateUsagePreviewMode,
        createBoxStateRef,
        readPageInnerPointerPoint,
        buildPointerDragRect,
        MIN_FRAME_SIZE_PX,
        clearTransientCanvasOverlays,
        commitCreatedFrameShell,
        setBoxCreationMode,
        deferredPreviewEditorStateRef,
        schedulePreviewEditorState,
        marqueeSelectionStateRef,
        selectionPanelTab,
        selectedFrameGroupIdsRef,
        edgeSelectionStateRef,
        mergePositionProxySelections,
        retainPositionProxySelectionsForSelectedIds,
        positionActiveSelectionEntityRef,
        positionGroupProxySelectionsOverrideRef,
        positionGroupProxySelectionGroupIdRef,
        applyFastFrameBoxSelectionVisuals,
        applyRuntimeSelectionUi,
        previewRef,
        focusFrameTextInputForEditingByFrameGroupId,
        resolveMarqueeSelectionIdsFromHitEntries,
        resolvePositionMarqueeProxySelectionsFromHitEntries,
        positionOrderLockSelectionMode,
        applyPositionOrderLockMarqueeSelection,
        applyFrameBoxSelection,
        applyShiftMergedPositionEntitySelection,
        getNextFrameSelection,
        clearFrameSelection,
        edgePressStateRef,
        setSelectedFrameGroupIds,
        setEdgeSelectionState,
        syncEdgeRoleDiagnosticsState,
        resolveEdgeRolePresentation,
        dragStateRef,
        resizeStateRef,
        stopPointerInteraction,
      } = optionsRef.current;
      const panState = canvasPanStateRef.current;

      if (panState?.pointerId === event.pointerId) {
        event.preventDefault();
        const owner = activePointerOwnerRef.current;
        safeReleasePointerCapture(owner, event.pointerId);
        activePointerOwnerRef.current = null;
        canvasPanStateRef.current = null;
        setSpacePanDragging(false);
        return;
      }

      if (templateUsagePreviewMode) {
        return;
      }

      const createBoxState = createBoxStateRef.current;

      if (createBoxState?.pointerId === event.pointerId) {
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        const finalPoint = readPageInnerPointerPoint(
          createBoxState.pageInner,
          event.clientX,
          event.clientY,
          createBoxState.scale
        );
        const finalRect = buildPointerDragRect(createBoxState.origin, finalPoint);
        const shouldCreate = finalRect.width >= MIN_FRAME_SIZE_PX && finalRect.height >= MIN_FRAME_SIZE_PX;

        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;

        if (shouldCreate) {
          const createdFrameGroupId = commitCreatedFrameShell(
            createBoxState.pageInner,
            finalRect,
            createBoxState.positionMode,
            createBoxState.anchorFrameGroupId
          );

          if (createdFrameGroupId) {
            setBoxCreationMode(false);
          }
        }

        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }

        return;
      }

      const marqueeSelectionState = marqueeSelectionStateRef.current;

      if (marqueeSelectionState?.pointerId === event.pointerId) {
        const keepGroupedShiftSelection = selectionPanelTab === 'position';
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        const finalPoint = readPageInnerPointerPoint(
          marqueeSelectionState.pageInner,
          event.clientX,
          event.clientY,
          marqueeSelectionState.scale
        );
        const finalRect = buildPointerDragRect(marqueeSelectionState.origin, finalPoint);
        const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
        const shouldTreatAsTextInputActivationClick =
          Boolean(marqueeSelectionState.focusFrameGroupIdOnClick) &&
          !marqueeSelectionState.active &&
          finalRect.width < optionsRef.current.FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
          finalRect.height < optionsRef.current.FRAME_MARQUEE_DRAG_THRESHOLD_PX;

        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;

        const restoredSelectionIds =
          marqueeSelectionState.clickSelectionIds?.slice() || marqueeSelectionState.baseSelectionIds.slice();
        const restoredProxySelections =
          marqueeSelectionState.clickProxySelections || marqueeSelectionState.baseProxySelections || [];

        if (shouldTreatAsTextInputActivationClick) {
          selectedFrameGroupIdsRef.current = marqueeSelectionState.baseSelectionIds;
          edgeSelectionStateRef.current = emptyEdgeSelection;
          if (selectionPanelTab === 'position') {
            const retainedProxySelections = mergePositionProxySelections(
              retainPositionProxySelectionsForSelectedIds(
                marqueeSelectionState.baseProxySelections,
                marqueeSelectionState.baseSelectionIds
              ),
              marqueeSelectionState.lastProxySelections || []
            );
            const previousActiveEntity = positionActiveSelectionEntityRef.current;
            positionGroupProxySelectionsOverrideRef.current = retainedProxySelections;
            positionGroupProxySelectionGroupIdRef.current =
              retainedProxySelections[0]?.groupId ||
              (previousActiveEntity?.kind === 'group' ? previousActiveEntity.groupId : '');
            positionActiveSelectionEntityRef.current = retainedProxySelections[0]
              ? {
                  kind: 'group',
                  groupId: retainedProxySelections[0].groupId,
                  frameGroupIds: retainedProxySelections[0].frameGroupIds.slice(),
                }
              : marqueeSelectionState.baseSelectionIds.length === 1
                ? {
                    kind: 'frame',
                    frameGroupId: marqueeSelectionState.baseSelectionIds[0] || '',
                  }
                : previousActiveEntity?.kind === 'group'
                  ? previousActiveEntity
                  : null;
            applyFastFrameBoxSelectionVisuals(
              marqueeSelectionState.baseSelectionIds,
              emptyEdgeSelection,
              retainedProxySelections
            );
          } else {
            applyRuntimeSelectionUi(marqueeSelectionState.baseSelectionIds, emptyEdgeSelection);
          }

          const focusFrameGroupId = marqueeSelectionState.focusFrameGroupIdOnClick?.trim() || '';
          if (focusFrameGroupId && previewRef.current) {
            focusFrameTextInputForEditingByFrameGroupId(previewRef.current, focusFrameGroupId);
          }

          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }

          return;
        }

        const isPlainClickAfterImmediateSelection =
          !marqueeSelectionState.active &&
          finalRect.width < optionsRef.current.FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
          finalRect.height < optionsRef.current.FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
          !marqueeSelectionState.anchorFrameGroupId &&
          !marqueeSelectionState.positionShiftClickFallbackEntry &&
          ((marqueeSelectionState.clickSelectionIds?.length || 0) > 0 ||
            (marqueeSelectionState.clickProxySelections?.length || 0) > 0);

        if (isPlainClickAfterImmediateSelection) {
          deferredPreviewEditorStateRef.current = false;
          return;
        }

        if (
          marqueeSelectionState.active ||
          finalRect.width >= optionsRef.current.FRAME_MARQUEE_DRAG_THRESHOLD_PX ||
          finalRect.height >= optionsRef.current.FRAME_MARQUEE_DRAG_THRESHOLD_PX
        ) {
          const nextMode: FrameMarqueeSelectionMode =
            finalPoint.x >= marqueeSelectionState.origin.x ? 'contained' : 'intersected';
          const computedSelectionIds = resolveMarqueeSelectionIdsFromHitEntries({
            selectionRect: finalRect,
            mode: nextMode,
            baseSelectionIds: marqueeSelectionState.baseSelectionIds,
            frameHitEntries: marqueeSelectionState.frameHitEntries,
            positionGroupHitEntries: marqueeSelectionState.positionGroupHitEntries,
            usePositionGroups: selectionPanelTab === 'position',
          });
          const nextSelectionIds =
            marqueeSelectionState.active && marqueeSelectionState.lastSelectionIds.length > 0
              ? marqueeSelectionState.lastSelectionIds
              : computedSelectionIds;
          const marqueeProxySelections = keepGroupedShiftSelection
            ? mergePositionProxySelections(
                retainPositionProxySelectionsForSelectedIds(marqueeSelectionState.baseProxySelections, nextSelectionIds),
                marqueeSelectionState.lastProxySelections ||
                  resolvePositionMarqueeProxySelectionsFromHitEntries(
                    marqueeSelectionState.positionGroupHitEntries,
                    nextSelectionIds
                  ) ||
                  []
              )
            : undefined;
          if (positionOrderLockSelectionMode) {
            applyPositionOrderLockMarqueeSelection(nextSelectionIds, marqueeProxySelections);
            if (deferredPreviewEditorStateRef.current) {
              deferredPreviewEditorStateRef.current = false;
              schedulePreviewEditorState();
            }
            return;
          }

          applyFrameBoxSelection(
            nextSelectionIds,
            keepGroupedShiftSelection
              ? {
                  showAllGroupProxySelections: true,
                  overridePositionGroupProxySelections: marqueeProxySelections,
                }
              : undefined
          );
          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }
          return;
        }

        if (selectionPanelTab === 'position' && marqueeSelectionState.positionShiftClickFallbackEntry) {
          applyShiftMergedPositionEntitySelection(marqueeSelectionState.positionShiftClickFallbackEntry);
          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }
          return;
        }

        if (marqueeSelectionState.anchorFrameGroupId) {
          const nextSelectionIds = getNextFrameSelection(
            marqueeSelectionState.baseSelectionIds,
            marqueeSelectionState.anchorFrameGroupId,
            true
          );
          const marqueeProxySelections = keepGroupedShiftSelection
            ? mergePositionProxySelections(
                retainPositionProxySelectionsForSelectedIds(marqueeSelectionState.baseProxySelections, nextSelectionIds),
                resolvePositionMarqueeProxySelectionsFromHitEntries(
                  marqueeSelectionState.positionGroupHitEntries,
                  nextSelectionIds
                ) || []
              )
            : undefined;
          if (positionOrderLockSelectionMode) {
            applyPositionOrderLockMarqueeSelection(nextSelectionIds, marqueeProxySelections);
            if (deferredPreviewEditorStateRef.current) {
              deferredPreviewEditorStateRef.current = false;
              schedulePreviewEditorState();
            }
            return;
          }

          applyFrameBoxSelection(
            nextSelectionIds,
            keepGroupedShiftSelection
              ? {
                  showAllGroupProxySelections: true,
                  overridePositionGroupProxySelections: marqueeProxySelections,
                }
              : undefined
          );
          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }
          return;
        }

        const isPlainEmptyPageClick =
          !event.shiftKey &&
          !marqueeSelectionState.anchorFrameGroupId &&
          !marqueeSelectionState.positionShiftClickFallbackEntry &&
          marqueeSelectionState.baseSelectionIds.length <= 0 &&
          (marqueeSelectionState.baseProxySelections?.length || 0) <= 0 &&
          (marqueeSelectionState.clickSelectionIds?.length || 0) <= 0 &&
          (marqueeSelectionState.clickProxySelections?.length || 0) <= 0;

        if (isPlainEmptyPageClick) {
          clearFrameSelection();
          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }
          return;
        }

        selectedFrameGroupIdsRef.current = marqueeSelectionState.baseSelectionIds;
        edgeSelectionStateRef.current = emptyEdgeSelection;
        if (selectionPanelTab === 'position') {
          const retainedProxySelections = mergePositionProxySelections(
            retainPositionProxySelectionsForSelectedIds(restoredProxySelections, restoredSelectionIds),
            marqueeSelectionState.lastProxySelections || []
          );
          const previousActiveEntity = positionActiveSelectionEntityRef.current;
          positionGroupProxySelectionsOverrideRef.current = retainedProxySelections;
          positionGroupProxySelectionGroupIdRef.current =
            retainedProxySelections[0]?.groupId ||
            (previousActiveEntity?.kind === 'group' ? previousActiveEntity.groupId : '');
          positionActiveSelectionEntityRef.current = retainedProxySelections[0]
            ? {
                kind: 'group',
                groupId: retainedProxySelections[0].groupId,
                frameGroupIds: retainedProxySelections[0].frameGroupIds.slice(),
              }
            : restoredSelectionIds.length === 1
              ? {
                  kind: 'frame',
                  frameGroupId: restoredSelectionIds[0] || '',
                }
              : previousActiveEntity?.kind === 'group'
                ? previousActiveEntity
                : null;
          applyFrameBoxSelection(restoredSelectionIds, {
            positionGroupProxySelectionGroupId: retainedProxySelections[0]?.groupId || '',
            overridePositionGroupProxySelections: retainedProxySelections,
            disableAutoPositionGroupProxySelection: retainedProxySelections.length <= 0,
            forceImmediateReactState: true,
            positionSelectionEntity: retainedProxySelections[0]
              ? {
                  kind: 'group',
                  groupId: retainedProxySelections[0].groupId,
                  frameGroupIds: retainedProxySelections[0].frameGroupIds.slice(),
                }
              : restoredSelectionIds.length === 1
                ? {
                    kind: 'frame',
                    frameGroupId: restoredSelectionIds[0] || '',
                  }
                : null,
          });
        } else {
          applyRuntimeSelectionUi(restoredSelectionIds, emptyEdgeSelection);
        }
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      const edgePressState = edgePressStateRef.current;

      if (edgePressState?.pointerId === event.pointerId) {
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        activePointerOwnerRef.current = null;
        edgePressStateRef.current = null;
        selectedFrameGroupIdsRef.current = [];
        edgeSelectionStateRef.current = edgePressState.clickSelection;
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(edgePressState.clickSelection);
        syncEdgeRoleDiagnosticsState(
          resolveEdgeRolePresentation(edgePressState.snapshot, edgePressState.clickSelection).diagnosticsState
        );
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    []
  );

  const handlePreviewPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const {
        canvasPanStateRef,
        activePointerOwnerRef,
        safeReleasePointerCapture,
        setSpacePanDragging,
        templateUsagePreviewMode,
        marqueeSelectionStateRef,
        clearTransientCanvasOverlays,
        selectedFrameGroupIdsRef,
        edgeSelectionStateRef,
        applyRuntimeSelectionUi,
        deferredPreviewEditorStateRef,
        schedulePreviewEditorState,
        createBoxStateRef,
        edgePressStateRef,
        dragStateRef,
        resizeStateRef,
        stopPointerInteraction,
      } = optionsRef.current;
      const panState = canvasPanStateRef.current;

      if (panState?.pointerId === event.pointerId) {
        const owner = activePointerOwnerRef.current;
        safeReleasePointerCapture(owner, event.pointerId);
        activePointerOwnerRef.current = null;
        canvasPanStateRef.current = null;
        setSpacePanDragging(false);
        return;
      }

      if (templateUsagePreviewMode) {
        return;
      }

      const marqueeSelectionState = marqueeSelectionStateRef.current;

      if (marqueeSelectionState?.pointerId === event.pointerId) {
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;
        const restoredSelectionIds =
          marqueeSelectionState.clickSelectionIds?.slice() || marqueeSelectionState.baseSelectionIds.slice();
        selectedFrameGroupIdsRef.current = restoredSelectionIds;
        edgeSelectionStateRef.current = emptyEdgeSelection;
        applyRuntimeSelectionUi(restoredSelectionIds, emptyEdgeSelection);
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      if (createBoxStateRef.current?.pointerId === event.pointerId) {
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      if (edgePressStateRef.current?.pointerId === event.pointerId) {
        stopPointerInteraction(event.pointerId);
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    []
  );

  return {
    handlePreviewPointerDown,
    handlePreviewPointerMove,
    handlePreviewPointerUp,
    handlePreviewPointerCancel,
  };
};
