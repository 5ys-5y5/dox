'use client';

import { ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import * as React from 'react';
import { CardContent } from '../../../ui/Card';
import {
  FLOATING_OVERLAY_STACK_GAP_PX,
  METADATA_FLOATING_OVERLAY_STACK_ORDER,
  POSITION_FLOATING_OVERLAY_STACK_ORDER,
  SUMMARY_OVERLAY_CLICK_DRAG_THRESHOLD_PX,
  SUMMARY_OVERLAY_COLLAPSED_HEIGHT_PX,
  SUMMARY_OVERLAY_INSET_PX,
} from '../constants';
import type {
  FloatingOverlayQuadrantGuideState,
  SummaryOverlayCorner,
  SummaryOverlayDragState,
  TemplateEditPreviewSurfaceProps,
  TemplateFloatingOverlayContent,
  TemplateFloatingOverlayId,
} from '../types';

export const TemplateEditPreviewSurface = React.memo(function TemplateEditPreviewSurface({
  renderedPreviewHtml,
  canvasFullscreen,
  boxCreationMode,
  canvasIconScale,
  spacePanArmed,
  spacePanDragging,
  metadataVisualMode,
  templateUsagePreviewMode,
  selectionPanelTab,
  showMetadataIcons,
  actionOverlay,
  actionOverlayLabel = '기능 버튼',
  actionOverlayExpandedWidthClassName,
  metadataNameOverlay,
  metadataRolePrimaryOverlay,
  metadataRoleSecondaryOverlay,
  metadataRoleTertiaryOverlay,
  styleOverlay,
  styleOverlayLabel = '스타일',
  onStyleOverlayCollapsedChange,
  sizeTypeOverlay,
  onSizeTypeOverlayCollapsedChange,
  textStyleOverlay,
  onTextStyleOverlayCollapsedChange,
  textStyleOverlayExpandedWidthClassName,
  summaryOverlay,
  onSummaryOverlayCollapsedChange,
  setPreviewNode,
  syncTemplateUsagePreviewTextControls,
  handlePreviewPointerDown,
  handlePreviewPointerMove,
  handlePreviewPointerUp,
  handlePreviewPointerCancel,
  handlePreviewLostPointerCapture,
  handlePreviewClickCapture,
  handlePreviewInput,
}: TemplateEditPreviewSurfaceProps) {
  const surfaceShellRef = React.useRef<HTMLDivElement | null>(null);
  const previewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const floatingOverlayNodeRefs = React.useRef<Record<TemplateFloatingOverlayId, HTMLDivElement | null>>({
    summary: null,
    style: null,
    sizeType: null,
    textStyle: null,
    action: null,
    metadataName: null,
    metadataRolePrimary: null,
    metadataRoleSecondary: null,
    metadataRoleTertiary: null,
  });
  const floatingOverlayDragStateRef = React.useRef<SummaryOverlayDragState | null>(null);
  const pendingFloatingOverlayDragStyleResetRef = React.useRef<TemplateFloatingOverlayId | null>(null);
  const [floatingOverlayQuadrantGuide, setFloatingOverlayQuadrantGuide] =
    React.useState<FloatingOverlayQuadrantGuideState | null>(null);
  const [floatingOverlayCorners, setFloatingOverlayCorners] = React.useState<Record<TemplateFloatingOverlayId, SummaryOverlayCorner>>({
    summary: 'top-left',
    style: 'top-right',
    sizeType: 'top-right',
    textStyle: 'top-right',
    action: 'top-right',
    metadataName: 'top-right',
    metadataRolePrimary: 'top-right',
    metadataRoleSecondary: 'top-right',
    metadataRoleTertiary: 'top-right',
  });
  const setPreviewSurfaceNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      previewNodeRef.current = node;
      setPreviewNode(node);
    },
    [setPreviewNode]
  );

  React.useLayoutEffect(() => {
    if (!templateUsagePreviewMode || !previewNodeRef.current) {
      return;
    }

    syncTemplateUsagePreviewTextControls?.(previewNodeRef.current);
  }, [renderedPreviewHtml, syncTemplateUsagePreviewTextControls, templateUsagePreviewMode]);

  const [styleOverlayCollapsed, setStyleOverlayCollapsed] = React.useState(true);
  const [sizeTypeOverlayCollapsed, setSizeTypeOverlayCollapsed] = React.useState(true);
  const [textStyleOverlayCollapsed, setTextStyleOverlayCollapsed] = React.useState(true);
  const [summaryOverlayCollapsed, setSummaryOverlayCollapsed] = React.useState(true);
  const [actionOverlayCollapsed, setActionOverlayCollapsed] = React.useState(false);
  const [metadataNameOverlayCollapsed, setMetadataNameOverlayCollapsed] = React.useState(true);
  const [metadataRolePrimaryOverlayCollapsed, setMetadataRolePrimaryOverlayCollapsed] = React.useState(true);
  const [metadataRoleSecondaryOverlayCollapsed, setMetadataRoleSecondaryOverlayCollapsed] = React.useState(true);
  const [metadataRoleTertiaryOverlayCollapsed, setMetadataRoleTertiaryOverlayCollapsed] = React.useState(true);
  const [floatingOverlayViewportRevision, setFloatingOverlayViewportRevision] = React.useState(0);
  const hasSummaryOverlay = Boolean(summaryOverlay);
  const hasStyleOverlay = Boolean(styleOverlay);
  const hasSizeTypeOverlay = Boolean(sizeTypeOverlay);
  const hasTextStyleOverlay = Boolean(textStyleOverlay);
  const hasActionOverlay = Boolean(actionOverlay);
  const hasMetadataNameOverlay = Boolean(metadataNameOverlay);
  const hasMetadataRolePrimaryOverlay = Boolean(metadataRolePrimaryOverlay);
  const hasMetadataRoleSecondaryOverlay = Boolean(metadataRoleSecondaryOverlay);
  const hasMetadataRoleTertiaryOverlay = Boolean(metadataRoleTertiaryOverlay);

  React.useEffect(() => {
    onTextStyleOverlayCollapsedChange?.(
      !hasTextStyleOverlay || selectionPanelTab !== 'position' ? true : textStyleOverlayCollapsed
    );
  }, [hasTextStyleOverlay, onTextStyleOverlayCollapsedChange, selectionPanelTab, textStyleOverlayCollapsed]);

  React.useEffect(() => {
    onStyleOverlayCollapsedChange?.(!hasStyleOverlay || selectionPanelTab !== 'position' ? true : styleOverlayCollapsed);
  }, [hasStyleOverlay, onStyleOverlayCollapsedChange, selectionPanelTab, styleOverlayCollapsed]);

  React.useEffect(() => {
    onSizeTypeOverlayCollapsedChange?.(
      !hasSizeTypeOverlay || selectionPanelTab !== 'position' ? true : sizeTypeOverlayCollapsed
    );
  }, [hasSizeTypeOverlay, onSizeTypeOverlayCollapsedChange, selectionPanelTab, sizeTypeOverlayCollapsed]);

  React.useEffect(() => {
    onSummaryOverlayCollapsedChange?.(!hasSummaryOverlay || selectionPanelTab !== 'position' ? true : summaryOverlayCollapsed);
  }, [hasSummaryOverlay, onSummaryOverlayCollapsedChange, selectionPanelTab, summaryOverlayCollapsed]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let animationFrameId: number | null = null;
    const requestViewportRevision = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        setFloatingOverlayViewportRevision((currentRevision) => currentRevision + 1);
      });
    };

    requestViewportRevision();
    window.addEventListener('resize', requestViewportRevision);
    window.addEventListener('scroll', requestViewportRevision, true);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            requestViewportRevision();
          });

    if (surfaceShellRef.current) {
      resizeObserver?.observe(surfaceShellRef.current);
    }

    Object.values(floatingOverlayNodeRefs.current).forEach((overlayNode) => {
      if (overlayNode) {
        resizeObserver?.observe(overlayNode);
      }
    });

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener('resize', requestViewportRevision);
      window.removeEventListener('scroll', requestViewportRevision, true);
      resizeObserver?.disconnect();
    };
  }, [
    renderedPreviewHtml,
    summaryOverlayCollapsed,
    styleOverlayCollapsed,
    sizeTypeOverlayCollapsed,
    textStyleOverlayCollapsed,
    actionOverlayCollapsed,
    metadataNameOverlayCollapsed,
    metadataRolePrimaryOverlayCollapsed,
    metadataRoleSecondaryOverlayCollapsed,
    metadataRoleTertiaryOverlayCollapsed,
    hasSummaryOverlay,
    hasStyleOverlay,
    hasSizeTypeOverlay,
    hasTextStyleOverlay,
    hasActionOverlay,
    hasMetadataNameOverlay,
    hasMetadataRolePrimaryOverlay,
    hasMetadataRoleSecondaryOverlay,
    hasMetadataRoleTertiaryOverlay,
  ]);

  const readFloatingOverlayVisibleBounds = React.useCallback(() => {
    void floatingOverlayViewportRevision;
    const shell = surfaceShellRef.current;

    if (!shell || typeof window === 'undefined') {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const clampToShellWidth = (value: number) => Math.min(Math.max(value, 0), shellRect.width);
    const clampToShellHeight = (value: number) => Math.min(Math.max(value, 0), shellRect.height);
    const visibleLeft = clampToShellWidth(Math.max(0, 0 - shellRect.left));
    const visibleTop = clampToShellHeight(Math.max(0, 0 - shellRect.top));
    const visibleRight = clampToShellWidth(Math.min(shellRect.width, window.innerWidth - shellRect.left));
    const visibleBottom = clampToShellHeight(Math.min(shellRect.height, window.innerHeight - shellRect.top));
    const normalizedRight = Math.max(visibleLeft, visibleRight);
    const normalizedBottom = Math.max(visibleTop, visibleBottom);
    const visibleWidth = normalizedRight - visibleLeft;
    const visibleHeight = normalizedBottom - visibleTop;

    if (visibleWidth <= 0 || visibleHeight <= 0) {
      return {
        shellRect,
        left: 0,
        top: 0,
        right: shellRect.width,
        bottom: shellRect.height,
        width: shellRect.width,
        height: shellRect.height,
        shellWidth: shellRect.width,
        shellHeight: shellRect.height,
      };
    }

    return {
      shellRect,
      left: visibleLeft,
      top: visibleTop,
      right: normalizedRight,
      bottom: normalizedBottom,
      width: visibleWidth,
      height: visibleHeight,
      shellWidth: shellRect.width,
      shellHeight: shellRect.height,
    };
  }, [floatingOverlayViewportRevision]);

  const readFloatingOverlayCollapsed = (overlayId: TemplateFloatingOverlayId) => {
    switch (overlayId) {
      case 'summary':
        return summaryOverlayCollapsed;
      case 'style':
        return styleOverlayCollapsed;
      case 'sizeType':
        return sizeTypeOverlayCollapsed;
      case 'textStyle':
        return textStyleOverlayCollapsed;
      case 'action':
        return actionOverlayCollapsed;
      case 'metadataName':
        return metadataNameOverlayCollapsed;
      case 'metadataRolePrimary':
        return metadataRolePrimaryOverlayCollapsed;
      case 'metadataRoleSecondary':
        return metadataRoleSecondaryOverlayCollapsed;
      case 'metadataRoleTertiary':
        return metadataRoleTertiaryOverlayCollapsed;
      default:
        return true;
    }
  };

  const hasFloatingOverlayContent = (overlayId: TemplateFloatingOverlayId) => {
    switch (overlayId) {
      case 'summary':
        return hasSummaryOverlay;
      case 'style':
        return hasStyleOverlay;
      case 'sizeType':
        return hasSizeTypeOverlay;
      case 'textStyle':
        return hasTextStyleOverlay;
      case 'action':
        return hasActionOverlay;
      case 'metadataName':
        return hasMetadataNameOverlay;
      case 'metadataRolePrimary':
        return hasMetadataRolePrimaryOverlay;
      case 'metadataRoleSecondary':
        return hasMetadataRoleSecondaryOverlay;
      case 'metadataRoleTertiary':
        return hasMetadataRoleTertiaryOverlay;
      default:
        return false;
    }
  };

  const readFloatingOverlayStackOrder = () => {
    if (selectionPanelTab === 'metadata') {
      return METADATA_FLOATING_OVERLAY_STACK_ORDER;
    }

    return POSITION_FLOATING_OVERLAY_STACK_ORDER;
  };

  const readFloatingOverlayFallbackHeight = React.useCallback((overlayId: TemplateFloatingOverlayId, isCollapsed: boolean) => {
    if (isCollapsed) {
      return SUMMARY_OVERLAY_COLLAPSED_HEIGHT_PX;
    }

    if (overlayId === 'action') {
      return 220;
    }

    if (overlayId === 'textStyle') {
      return 300;
    }

    if (overlayId === 'sizeType') {
      return 300;
    }

    if (overlayId === 'metadataName') {
      return 150;
    }

    if (overlayId === 'metadataRolePrimary' || overlayId === 'metadataRoleSecondary' || overlayId === 'metadataRoleTertiary') {
      return 220;
    }

    return 260;
  }, []);

  const readFloatingOverlayFallbackWidth = React.useCallback((overlayId: TemplateFloatingOverlayId, isCollapsed: boolean) => {
    if (isCollapsed) {
      switch (overlayId) {
        case 'summary':
          return 73;
        case 'style':
          return 104;
        case 'sizeType':
          return 118;
        case 'textStyle':
          return 113;
        case 'action':
          return 94;
        case 'metadataName':
          return 78;
        case 'metadataRolePrimary':
        case 'metadataRoleSecondary':
          return 124;
        case 'metadataRoleTertiary':
          return 90;
        default:
          return 96;
      }
    }

    if (overlayId === 'action') {
      return 176;
    }

    if (overlayId === 'style') {
      return 250;
    }

    if (overlayId === 'textStyle') {
      return 672;
    }

    if (overlayId === 'sizeType') {
      return 250;
    }

    if (
      overlayId === 'metadataName' ||
      overlayId === 'metadataRolePrimary' ||
      overlayId === 'metadataRoleSecondary' ||
      overlayId === 'metadataRoleTertiary'
    ) {
      return 400;
    }

    return 480;
  }, []);

  const readFloatingOverlayResolvedSize = React.useCallback(
    (overlayId: TemplateFloatingOverlayId, isCollapsed: boolean) => {
      const overlayNode = floatingOverlayNodeRefs.current[overlayId];
      const collapsedFallbackWidth = readFloatingOverlayFallbackWidth(overlayId, true);
      const collapsedFallbackHeight = readFloatingOverlayFallbackHeight(overlayId, true);
      const targetFallbackWidth = readFloatingOverlayFallbackWidth(overlayId, isCollapsed);
      const targetFallbackHeight = readFloatingOverlayFallbackHeight(overlayId, isCollapsed);
      const measuredWidth = overlayNode?.offsetWidth || 0;
      const measuredHeight = overlayNode?.offsetHeight || 0;
      const width = isCollapsed
        ? measuredWidth > 0
          ? Math.min(measuredWidth, collapsedFallbackWidth)
          : collapsedFallbackWidth
        : measuredWidth > collapsedFallbackWidth + 1
          ? measuredWidth
          : targetFallbackWidth;
      const height = isCollapsed
        ? measuredHeight > 0
          ? Math.min(measuredHeight, collapsedFallbackHeight)
          : collapsedFallbackHeight
        : measuredHeight > collapsedFallbackHeight + 1
          ? measuredHeight
          : targetFallbackHeight;

      return {
        width,
        height,
      };
    },
    [readFloatingOverlayFallbackHeight, readFloatingOverlayFallbackWidth]
  );

  const updateFloatingOverlayQuadrantGuide = React.useCallback(
    (metrics: {
      left: number;
      top: number;
      width: number;
      height: number;
      visibleLeft: number;
      visibleTop: number;
      visibleWidth: number;
      visibleHeight: number;
    } | null) => {
      if (!metrics) {
        setFloatingOverlayQuadrantGuide((currentGuide) => (currentGuide ? null : currentGuide));
        return;
      }

      const nextVertical =
        metrics.top + metrics.height / 2 < metrics.visibleTop + metrics.visibleHeight / 2 ? 'top' : 'bottom';
      const nextHorizontal =
        metrics.left + metrics.width / 2 < metrics.visibleLeft + metrics.visibleWidth / 2 ? 'left' : 'right';
      const activeCorner = `${nextVertical}-${nextHorizontal}` as SummaryOverlayCorner;
      setFloatingOverlayQuadrantGuide((currentGuide) => {
        if (
          currentGuide &&
          currentGuide.activeCorner === activeCorner &&
          currentGuide.left === metrics.visibleLeft &&
          currentGuide.top === metrics.visibleTop &&
          currentGuide.width === metrics.visibleWidth &&
          currentGuide.height === metrics.visibleHeight
        ) {
          return currentGuide;
        }

        return {
          activeCorner,
          left: metrics.visibleLeft,
          top: metrics.visibleTop,
          width: metrics.visibleWidth,
          height: metrics.visibleHeight,
        };
      });
    },
    []
  );

  const resolveFloatingOverlayPinnedStyle = React.useCallback(
    (overlayId: TemplateFloatingOverlayId, corner: SummaryOverlayCorner, isCollapsed: boolean): React.CSSProperties | undefined => {
      const visibleBounds = readFloatingOverlayVisibleBounds();

      if (!visibleBounds) {
        return undefined;
      }

      const { width: overlayWidth } = readFloatingOverlayResolvedSize(overlayId, isCollapsed);
      const availableWidth = Math.max(
        SUMMARY_OVERLAY_COLLAPSED_HEIGHT_PX,
        visibleBounds.width - SUMMARY_OVERLAY_INSET_PX * 2
      );
      const stackOrder = readFloatingOverlayStackOrder();
      const sameCornerStackIds = stackOrder.filter(
        (stackOverlayId) => hasFloatingOverlayContent(stackOverlayId) && floatingOverlayCorners[stackOverlayId] === corner
      );
      const readStackOverlayHeight = (stackOverlayId: TemplateFloatingOverlayId) =>
        readFloatingOverlayResolvedSize(stackOverlayId, readFloatingOverlayCollapsed(stackOverlayId)).height;
      const sameCornerStackIndex = sameCornerStackIds.indexOf(overlayId);
      const sameCornerStackHeights = new Map(
        sameCornerStackIds.map((stackOverlayId) => [stackOverlayId, readStackOverlayHeight(stackOverlayId)] as const)
      );
      const sameCornerStackTotalHeight = sameCornerStackIds.reduce(
        (height, stackOverlayId) => height + (sameCornerStackHeights.get(stackOverlayId) || 0),
        0
      );
      const stackGap = sameCornerStackIds.length <= 1 ? 0 : FLOATING_OVERLAY_STACK_GAP_PX;
      const totalStackHeight = sameCornerStackTotalHeight + stackGap * Math.max(0, sameCornerStackIds.length - 1);
      const stackStartTop = corner.startsWith('bottom')
        ? Math.max(
            visibleBounds.top + SUMMARY_OVERLAY_INSET_PX,
            visibleBounds.bottom - SUMMARY_OVERLAY_INSET_PX - totalStackHeight
          )
        : visibleBounds.top + SUMMARY_OVERLAY_INSET_PX;
      const verticalStackOffset =
        sameCornerStackIndex <= 0
          ? 0
          : sameCornerStackIds.slice(0, sameCornerStackIndex).reduce(
              (offset, stackOverlayId) => offset + (sameCornerStackHeights.get(stackOverlayId) || 0) + stackGap,
              0
            );
      const minLeft = visibleBounds.left + SUMMARY_OVERLAY_INSET_PX;
      const maxLeft = Math.max(minLeft, visibleBounds.right - overlayWidth - SUMMARY_OVERLAY_INSET_PX);
      const pinnedLeft = corner.endsWith('left') ? minLeft : maxLeft;
      const pinnedTop = stackStartTop + verticalStackOffset;

      return {
        left: `${pinnedLeft}px`,
        top: `${pinnedTop}px`,
        maxWidth: `${availableWidth}px`,
      };
    },
    [floatingOverlayCorners, readFloatingOverlayResolvedSize, readFloatingOverlayVisibleBounds, selectionPanelTab]
  );

  const resetFloatingOverlayDirectDragStyle = React.useCallback((overlayId: TemplateFloatingOverlayId) => {
    const overlay = floatingOverlayNodeRefs.current[overlayId];

    if (!overlay) {
      return;
    }

    overlay.style.removeProperty('transform');
    overlay.style.removeProperty('width');
    overlay.style.removeProperty('will-change');
  }, []);

  const applyFloatingOverlayDirectDragStyle = React.useCallback(
    (
      overlayId: TemplateFloatingOverlayId,
      metrics: {
        left: number;
        top: number;
        width: number;
      }
    ) => {
      const dragState = floatingOverlayDragStateRef.current;
      const overlay = floatingOverlayNodeRefs.current[overlayId];

      if (!dragState || dragState.overlayId !== overlayId || !overlay) {
        return;
      }

      const translateX = metrics.left - dragState.initialLeft;
      const translateY = metrics.top - dragState.initialTop;
      overlay.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
      overlay.style.width = `${metrics.width}px`;
    },
    []
  );

  React.useLayoutEffect(() => {
    const overlayId = pendingFloatingOverlayDragStyleResetRef.current;

    if (!overlayId) {
      return;
    }

    pendingFloatingOverlayDragStyleResetRef.current = null;
    resetFloatingOverlayDirectDragStyle(overlayId);
  }, [floatingOverlayCorners, resetFloatingOverlayDirectDragStyle]);

  const readFloatingOverlayDragMetrics = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    const dragState = floatingOverlayDragStateRef.current;

    if (!dragState) {
      return null;
    }

    const left = Math.min(
      Math.max(event.clientX - dragState.shellLeft - dragState.offsetX, dragState.minLeft),
      dragState.maxLeft
    );
    const top = Math.min(
      Math.max(event.clientY - dragState.shellTop - dragState.offsetY, dragState.minTop),
      dragState.maxTop
    );

    return {
      left,
      top,
      width: dragState.width,
      height: dragState.height,
      visibleLeft: dragState.visibleLeft,
      visibleTop: dragState.visibleTop,
      visibleWidth: dragState.visibleWidth,
      visibleHeight: dragState.visibleHeight,
    };
  }, []);

  const handleFloatingOverlayPointerDown = React.useCallback(
    (overlayId: TemplateFloatingOverlayId, event: React.PointerEvent<HTMLButtonElement>) => {
      const overlay = floatingOverlayNodeRefs.current[overlayId];

      if (!overlay || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const overlayRect = overlay.getBoundingClientRect();
      const visibleBounds = readFloatingOverlayVisibleBounds();

      if (!visibleBounds) {
        return;
      }

      const boundedWidth = Math.min(
        overlayRect.width,
        Math.max(SUMMARY_OVERLAY_COLLAPSED_HEIGHT_PX, visibleBounds.width - SUMMARY_OVERLAY_INSET_PX * 2)
      );
      const minLeft = visibleBounds.left + SUMMARY_OVERLAY_INSET_PX;
      const minTop = visibleBounds.top + SUMMARY_OVERLAY_INSET_PX;
      overlay.style.willChange = 'transform';
      floatingOverlayDragStateRef.current = {
        overlayId,
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        initialLeft: overlayRect.left - visibleBounds.shellRect.left,
        initialTop: overlayRect.top - visibleBounds.shellRect.top,
        offsetX: event.clientX - overlayRect.left,
        offsetY: event.clientY - overlayRect.top,
        width: boundedWidth,
        height: overlayRect.height,
        shellLeft: visibleBounds.shellRect.left,
        shellTop: visibleBounds.shellRect.top,
        minLeft,
        maxLeft: Math.max(minLeft, visibleBounds.right - boundedWidth - SUMMARY_OVERLAY_INSET_PX),
        minTop,
        maxTop: Math.max(minTop, visibleBounds.bottom - overlayRect.height - SUMMARY_OVERLAY_INSET_PX),
        visibleLeft: visibleBounds.left,
        visibleTop: visibleBounds.top,
        visibleWidth: visibleBounds.width,
        visibleHeight: visibleBounds.height,
        hasMoved: false,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer events used by browser verification do not always create an active pointer.
      }
    },
    [readFloatingOverlayVisibleBounds]
  );

  const handleFloatingOverlayPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const dragState = floatingOverlayDragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!dragState.hasMoved) {
        const pointerDistance = Math.hypot(event.clientX - dragState.originX, event.clientY - dragState.originY);

        if (pointerDistance < SUMMARY_OVERLAY_CLICK_DRAG_THRESHOLD_PX) {
          return;
        }

        dragState.hasMoved = true;
      }

      const metrics = readFloatingOverlayDragMetrics(event);

      if (!metrics) {
        return;
      }

      applyFloatingOverlayDirectDragStyle(dragState.overlayId, metrics);
      updateFloatingOverlayQuadrantGuide(metrics);
    },
    [applyFloatingOverlayDirectDragStyle, readFloatingOverlayDragMetrics, updateFloatingOverlayQuadrantGuide]
  );

  const finishFloatingOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, toggleCollapsed?: () => void) => {
      const dragState = floatingOverlayDragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const overlayId = dragState.overlayId;
      const metrics = readFloatingOverlayDragMetrics(event);

      if (metrics && dragState.hasMoved) {
        const nextVertical =
          metrics.top + metrics.height / 2 < metrics.visibleTop + metrics.visibleHeight / 2 ? 'top' : 'bottom';
        const nextHorizontal =
          metrics.left + metrics.width / 2 < metrics.visibleLeft + metrics.visibleWidth / 2 ? 'left' : 'right';
        pendingFloatingOverlayDragStyleResetRef.current = overlayId;
        setFloatingOverlayCorners((currentCorners) => ({
          ...currentCorners,
          [overlayId]: `${nextVertical}-${nextHorizontal}` as SummaryOverlayCorner,
        }));
      } else if (dragState.hasMoved) {
        resetFloatingOverlayDirectDragStyle(overlayId);
      }

      if (!dragState.hasMoved && toggleCollapsed) {
        resetFloatingOverlayDirectDragStyle(overlayId);
        toggleCollapsed();
      }

      setFloatingOverlayQuadrantGuide(null);
      floatingOverlayDragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [readFloatingOverlayDragMetrics, resetFloatingOverlayDirectDragStyle]
  );

  const finishActionOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setActionOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishStyleOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setStyleOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishSizeTypeOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setSizeTypeOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishTextStyleOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setTextStyleOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishSummaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setSummaryOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishMetadataNameOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setMetadataNameOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishMetadataRolePrimaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setMetadataRolePrimaryOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishMetadataRoleSecondaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setMetadataRoleSecondaryOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );
  const finishMetadataRoleTertiaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => setMetadataRoleTertiaryOverlayCollapsed((current) => !current));
    },
    [finishFloatingOverlayDrag]
  );

  const cancelFloatingOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const dragState = floatingOverlayDragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.stopPropagation();
      const overlayId = dragState.overlayId;
      floatingOverlayDragStateRef.current = null;
      setFloatingOverlayQuadrantGuide(null);
      resetFloatingOverlayDirectDragStyle(overlayId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [resetFloatingOverlayDirectDragStyle]
  );

  const renderedPreviewMarkup = React.useMemo(
    () => ({
      __html: renderedPreviewHtml,
    }),
    [renderedPreviewHtml]
  );

  const renderFloatingOverlaySection = (
    overlayId: TemplateFloatingOverlayId,
    label: string,
    collapsed: boolean,
    setCollapsed: React.Dispatch<React.SetStateAction<boolean>> | null,
    finishDrag: (event: React.PointerEvent<HTMLButtonElement>) => void,
    content: TemplateFloatingOverlayContent | null | undefined,
    options: {
      alwaysExpanded?: boolean;
      keepMountedWhenCollapsed?: boolean;
      expandedWidthClassName?: string;
    } = {}
  ) => {
    const contentRenderer = typeof content === 'function' ? content : null;

    if (!contentRenderer && !content) {
      return null;
    }

    const isCollapsed = options.alwaysExpanded ? false : collapsed;
    const overlayCorner = floatingOverlayCorners[overlayId];
    const expandedWidthClassName = options.expandedWidthClassName || 'w-[30rem] max-w-[calc(100%_-_1.5rem)]';
    const overlayWidthClassName = isCollapsed ? 'w-max max-w-[calc(100%_-_1.5rem)]' : expandedWidthClassName;
    const overlayZIndexClassName =
      overlayId === 'metadataRoleTertiary'
        ? 'z-[75]'
        : overlayId === 'metadataRoleSecondary'
          ? 'z-[74]'
          : overlayId === 'metadataRolePrimary'
            ? 'z-[73]'
            : overlayId === 'action' || overlayId === 'metadataName'
              ? 'z-[72]'
              : overlayId === 'style' || overlayId === 'sizeType'
                ? 'z-[71]'
                : 'z-[70]';
    const pinnedOverlayStyle = resolveFloatingOverlayPinnedStyle(overlayId, overlayCorner, isCollapsed);
    const overlayPinnedStyle =
      overlayId === 'style' || overlayId === 'sizeType' || overlayId === 'textStyle'
        ? {
            ...pinnedOverlayStyle,
            maxWidth: '250px',
          }
        : pinnedOverlayStyle;

    return (
      <div
        ref={(node) => {
          floatingOverlayNodeRefs.current[overlayId] = node;
        }}
        className={`absolute ${overlayZIndexClassName} ${overlayWidthClassName}`}
        style={overlayPinnedStyle}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-lg backdrop-blur ${
            isCollapsed ? 'w-fit max-w-full' : ''
          }`}
          style={
            isCollapsed
              ? {
                  height: `${SUMMARY_OVERLAY_COLLAPSED_HEIGHT_PX}px`,
                }
              : undefined
          }
        >
          <button
            type="button"
            className={`flex cursor-move items-center bg-white/90 text-xs font-semibold text-slate-700 ${
              isCollapsed
                ? 'h-full w-auto justify-between gap-1.5 px-2 text-[11px] leading-none'
                : 'h-8 w-full justify-between gap-3 border-b border-slate-200 px-2'
            }`}
            aria-label={
              options.alwaysExpanded
                ? `${label} 위치 이동`
                : isCollapsed
                  ? `${label} 열기 및 위치 이동`
                  : `${label} 접기 및 위치 이동`
            }
            title={`${label} 위치 이동`}
            onPointerDown={(event) => handleFloatingOverlayPointerDown(overlayId, event)}
            onPointerMove={handleFloatingOverlayPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={cancelFloatingOverlayDrag}
            onKeyDown={(event) => {
              if (options.alwaysExpanded || !setCollapsed || (event.key !== 'Enter' && event.key !== ' ')) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              setCollapsed((current) => !current);
            }}
            onLostPointerCapture={(event) => {
              const dragState = floatingOverlayDragStateRef.current;

              if (dragState?.pointerId === event.pointerId) {
                const activeOverlayId = dragState.overlayId;
                floatingOverlayDragStateRef.current = null;
                setFloatingOverlayQuadrantGuide(null);
                resetFloatingOverlayDirectDragStyle(activeOverlayId);
              }
            }}
          >
            <span className="flex items-center gap-1.5">
              <GripHorizontal className="h-3 w-3 rotate-90 text-slate-400" aria-hidden="true" />
              <span className={isCollapsed ? 'whitespace-nowrap' : undefined}>{label}</span>
            </span>
            {options.alwaysExpanded ? null : isCollapsed ? (
              <ChevronDown className="h-3 w-3 text-slate-500" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            )}
          </button>
          {isCollapsed && !options.keepMountedWhenCollapsed ? null : (
            <div
              className={
                isCollapsed
                  ? 'hidden'
                  : overlayId === 'style'
                    ? 'flex w-full max-w-full flex-col items-stretch gap-2.5 p-2'
                    : overlayId === 'sizeType'
                      ? 'max-w-full p-2'
                      : 'max-h-[min(26rem,calc(100vh-14rem))] overflow-auto p-2'
              }
              aria-hidden={isCollapsed}
            >
              {contentRenderer ? contentRenderer() : (content as React.ReactNode)}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!renderedPreviewHtml) {
    return (
      <CardContent className={`min-h-0 bg-slate-200 p-6 ${canvasFullscreen ? 'flex-1' : 'h-[70vh] max-h-[70vh]'}`}>
        <div className="flex min-h-[560px] items-center justify-center text-sm text-slate-500">
          편집할 템플릿을 먼저 불러오세요.
        </div>
      </CardContent>
    );
  }

  return (
    <CardContent
      ref={surfaceShellRef}
      className={`relative min-h-0 overflow-hidden bg-slate-200 p-0 ${canvasFullscreen ? 'flex-1' : 'h-[70vh] max-h-[70vh]'}`}
    >
      <div
        ref={setPreviewSurfaceNode}
        className="template-edit-preview template-extract-draft-preview template-extract-preview-surface h-full max-h-full bg-slate-200 template-clone template-clone--raster-first-v2-structured"
        data-frame-create-mode={boxCreationMode ? 'true' : 'false'}
        data-canvas-icon-scale={canvasIconScale}
        data-space-pan-armed={spacePanArmed ? 'true' : 'false'}
        data-space-pan-dragging={spacePanDragging ? 'true' : 'false'}
        data-metadata-visual-mode={metadataVisualMode ? 'true' : 'false'}
        data-template-usage-preview-mode={templateUsagePreviewMode ? 'true' : 'false'}
        data-selection-panel-tab={selectionPanelTab}
        data-metadata-icon-visual-mode={showMetadataIcons ? 'true' : 'false'}
        onPointerDownCapture={handlePreviewPointerDown}
        onPointerMoveCapture={handlePreviewPointerMove}
        onPointerUpCapture={handlePreviewPointerUp}
        onPointerCancelCapture={handlePreviewPointerCancel}
        onLostPointerCaptureCapture={handlePreviewLostPointerCapture}
        onClickCapture={handlePreviewClickCapture}
        onInput={handlePreviewInput}
        dangerouslySetInnerHTML={renderedPreviewMarkup}
      />
      {selectionPanelTab === 'position' && floatingOverlayQuadrantGuide ? (
        <div
          className="pointer-events-none absolute z-[60]"
          style={{
            left: `${floatingOverlayQuadrantGuide.left}px`,
            top: `${floatingOverlayQuadrantGuide.top}px`,
            width: `${floatingOverlayQuadrantGuide.width}px`,
            height: `${floatingOverlayQuadrantGuide.height}px`,
          }}
        >
          <div
            className="grid h-full w-full grid-cols-2 grid-rows-2"
            style={{
              padding: `${SUMMARY_OVERLAY_INSET_PX}px`,
              gap: `${FLOATING_OVERLAY_STACK_GAP_PX}px`,
            }}
          >
            {(
              [
                ['top-left', 'row-start-1 col-start-1'],
                ['top-right', 'row-start-1 col-start-2'],
                ['bottom-left', 'row-start-2 col-start-1'],
                ['bottom-right', 'row-start-2 col-start-2'],
              ] as const
            ).map(([corner, positionClassName]) => (
              <div
                key={corner}
                className={`rounded-lg transition-colors ${
                  floatingOverlayQuadrantGuide.activeCorner === corner ? 'bg-sky-500/10' : 'bg-sky-500/[0.03]'
                } ${positionClassName}`}
              />
            ))}
          </div>
        </div>
      ) : null}
      {renderFloatingOverlaySection('summary', '요약', summaryOverlayCollapsed, setSummaryOverlayCollapsed, finishSummaryOverlayDrag, summaryOverlay)}
      {renderFloatingOverlaySection(
        'style',
        styleOverlayLabel,
        styleOverlayCollapsed,
        setStyleOverlayCollapsed,
        finishStyleOverlayDrag,
        styleOverlay,
        { expandedWidthClassName: 'w-[250px] max-w-[250px]', keepMountedWhenCollapsed: true }
      )}
      {renderFloatingOverlaySection(
        'sizeType',
        '상자 크기 타입',
        sizeTypeOverlayCollapsed,
        setSizeTypeOverlayCollapsed,
        finishSizeTypeOverlayDrag,
        sizeTypeOverlay,
        { expandedWidthClassName: 'w-fit max-w-[250px]', keepMountedWhenCollapsed: true }
      )}
      {renderFloatingOverlaySection(
        'textStyle',
        '텍스트 스타일',
        textStyleOverlayCollapsed,
        setTextStyleOverlayCollapsed,
        finishTextStyleOverlayDrag,
        textStyleOverlay,
        {
          expandedWidthClassName: textStyleOverlayExpandedWidthClassName || 'w-fit max-w-[250px]',
          keepMountedWhenCollapsed: true,
        }
      )}
      {renderFloatingOverlaySection(
        'metadataName',
        '상자명',
        metadataNameOverlayCollapsed,
        setMetadataNameOverlayCollapsed,
        finishMetadataNameOverlayDrag,
        metadataNameOverlay,
        { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
      )}
      {renderFloatingOverlaySection(
        'metadataRolePrimary',
        '상자 역할 - 1',
        metadataRolePrimaryOverlayCollapsed,
        setMetadataRolePrimaryOverlayCollapsed,
        finishMetadataRolePrimaryOverlayDrag,
        metadataRolePrimaryOverlay,
        { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
      )}
      {renderFloatingOverlaySection(
        'metadataRoleSecondary',
        '상자 역할 - 2',
        metadataRoleSecondaryOverlayCollapsed,
        setMetadataRoleSecondaryOverlayCollapsed,
        finishMetadataRoleSecondaryOverlayDrag,
        metadataRoleSecondaryOverlay,
        { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
      )}
      {renderFloatingOverlaySection(
        'metadataRoleTertiary',
        '상자 연결',
        metadataRoleTertiaryOverlayCollapsed,
        setMetadataRoleTertiaryOverlayCollapsed,
        finishMetadataRoleTertiaryOverlayDrag,
        metadataRoleTertiaryOverlay,
        { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
      )}
      {renderFloatingOverlaySection('action', actionOverlayLabel, actionOverlayCollapsed, setActionOverlayCollapsed, finishActionOverlayDrag, actionOverlay, {
        expandedWidthClassName: actionOverlayExpandedWidthClassName || 'w-44 max-w-[calc(100%_-_1.5rem)]',
        keepMountedWhenCollapsed: true,
      })}
    </CardContent>
  );
});
