// EDGE-EDIT-106 before snapshot
// Modified sections only. This records the state immediately before
// separating edge click selection from edge drag resize start.

type ResizeState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  direction: TemplateFrameResizeDirection;
  node: HTMLElement;
  rect: FrameNodeRect;
  widthInstructions?: FrameWidthResizeInstruction[];
  edgeResizeTargets?: EdgeResizeTarget[];
};

const FRAME_EDGE_BUTTON_SELECTOR = '[data-v106-edge-button="true"]';

  const selectedFrameGroupIdsRef = React.useRef<string[]>([]);
  const edgeSelectionStateRef = React.useRef<TemplateEdgeSelectionStateDto>(TemplateEdgeSelectionService.createEmptyState());
  const activePointerOwnerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const resizeStateRef = React.useRef<ResizeState | null>(null);

  const stopPointerInteraction = React.useCallback(
    (pointerId?: number) => {
      const owner = activePointerOwnerRef.current;

      if (owner && typeof pointerId === 'number' && owner.hasPointerCapture(pointerId)) {
        owner.releasePointerCapture(pointerId);
      }

      activePointerOwnerRef.current = null;
      dragStateRef.current = null;
      resizeStateRef.current = null;
      syncDraftPreviewHtmlRef();
      const nextEdgeSelection = reconcileLiveEdgeSelection(previewRef.current, edgeSelectionStateRef.current);
      if (!edgeSelectionStatesEqual(nextEdgeSelection, edgeSelectionStateRef.current)) {
        setEdgeSelectionState(nextEdgeSelection);
      }
      syncSelectionStyleDraft();
      requestPreviewTextFit();
    },
    [reconcileLiveEdgeSelection, requestPreviewTextFit, syncDraftPreviewHtmlRef, syncSelectionStyleDraft]
  );

  const handlePreviewPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const root = previewRef.current;
      const target = event.target instanceof HTMLElement ? event.target : null;

      if (!root || !target) {
        return;
      }

      const edgeButton = target.closest<HTMLElement>(FRAME_EDGE_BUTTON_SELECTOR);
      const resizeHandle = target.closest<HTMLElement>(FRAME_RESIZE_HANDLE_SELECTOR);
      const frameNode = target.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

      if (!frameNode) {
        return;
      }

      const frameGroupId = getFrameGroupId(frameNode);

      if (!frameGroupId) {
        return;
      }

      const explicitEdgeDirection = (edgeButton?.getAttribute('data-direction') ||
        resizeHandle?.getAttribute('data-direction') ||
        '') as TemplateFrameResizeDirection;
      const explicitEdgeSide = getCardinalEdgeSideFromDirection(explicitEdgeDirection);
      const pageInner = frameNode.closest<HTMLElement>('.page-inner');

      if (explicitEdgeSide && pageInner) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        const currentSelection = TemplateEdgeSelectionService.reconcileSelectionState({
          snapshot,
          currentSelection: edgeSelectionStateRef.current,
        });
        const clickedEdgeId = `${frameGroupId}:${explicitEdgeSide}`;
        const nextEdgeSelection = TemplateEdgeSelectionService.resolveClick({
          snapshot,
          currentSelection,
          clickedEdgeId,
          withShift: Boolean(event.shiftKey),
        });

        setEdgeSelectionState(nextEdgeSelection);
        setSelectedFrameGroupIds([]);

        if (event.shiftKey) {
          event.preventDefault();
          return;
        }

        const resizeTargets = collectEdgeResizeTargets(root, snapshot, nextEdgeSelection, explicitEdgeSide);
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        resizeStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          direction: explicitEdgeDirection,
          node: frameNode,
          rect: readFrameNodeRect(frameNode),
          widthInstructions:
            explicitEdgeDirection === 'e' || explicitEdgeDirection === 'w'
              ? resizeTargets[0]?.widthInstructions
              : undefined,
          edgeResizeTargets: resizeTargets,
        };
        return;
      }
    },
    [buildLiveEdgeTopologySnapshot, collectEdgeResizeTargets, getFrameNodes, previewZoom, selectedFrameGroupIds]
  );

  const handlePreviewPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const resizeState = resizeStateRef.current;

    if (resizeState && event.pointerId === resizeState.pointerId) {
      event.preventDefault();
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
    }
  }, [getFrameNodes]);

  const handlePreviewPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [buildLiveEdgeTopologySnapshot, stopPointerInteraction]
  );

  const handlePreviewPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [stopPointerInteraction]
  );
