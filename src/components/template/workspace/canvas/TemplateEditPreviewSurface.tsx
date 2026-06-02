'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import * as React from 'react';
import { CardContent } from '../../../ui/Card';
import {
  isTemplateCanvasMetadataSelectionPanelTab,
  resolveTemplateCanvasSelectionPanelTab,
} from '../../../../services/templateCanvasViewModeService';
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
  SelectionPanelTab,
  SummaryOverlayCorner,
  SummaryOverlayDragState,
  TemplateEditPreviewSurfaceProps,
  TemplateFloatingOverlayContent,
  TemplateFloatingOverlayId,
} from '../types';

type OverlayRailSection = {
  node: React.ReactElement;
};

type OverlayRailRoom = {
  tab: SelectionPanelTab;
  sections: OverlayRailSection[];
};

type CanvasScrollEdgeState = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

const emptyCanvasScrollEdgeState: CanvasScrollEdgeState = {
  top: false,
  right: false,
  bottom: false,
  left: false,
};

const areCanvasScrollEdgeStatesEqual = (left: CanvasScrollEdgeState, right: CanvasScrollEdgeState) =>
  left.top === right.top &&
  left.right === right.right &&
  left.bottom === right.bottom &&
  left.left === right.left;

const readCanvasScrollEdgeState = (node: HTMLElement | null): CanvasScrollEdgeState => {
  if (!node) {
    return emptyCanvasScrollEdgeState;
  }

  const horizontalMax = Math.max(0, node.scrollWidth - node.clientWidth);
  const verticalMax = Math.max(0, node.scrollHeight - node.clientHeight);

  return {
    top: node.scrollTop > 2,
    right: node.scrollLeft < horizontalMax - 2,
    bottom: node.scrollTop < verticalMax - 2,
    left: node.scrollLeft > 2,
  };
};

function compactOverlayRailSections(sections: Array<OverlayRailSection | null>) {
  return sections.filter((section): section is OverlayRailSection => Boolean(section));
}

const renderedCanvasHtmlAttrRenames: Array<[string, string]> = [
  ['data-template-runtime-' + 'mo' + 'de', 'data-template-runtime-kind'],
  ['data-template-frame-position-' + 'mo' + 'de', 'data-template-frame-position-kind'],
  ['data-template-usage-preview-' + 'mo' + 'de', 'data-template-usage-preview-active'],
  ['data-template-usage-preview-file-' + 'mo' + 'de', 'data-template-usage-preview-file-kind'],
  ['data-template-usage-preview-runtime-' + 'mo' + 'de', 'data-template-usage-preview-runtime-kind'],
  ['data-v106-text-canvas-edit-' + 'mo' + 'de', 'data-v106-text-canvas-edit-active'],
  ['data-template-source-' + 'mo' + 'de', 'data-template-source-kind'],
  ['data-template-quality-' + 'mo' + 'de', 'data-template-quality-kind'],
  ['data-template-render-' + 'mo' + 'del', 'data-template-render-plan'],
];

const removeCanvasModeAttrNamesFromRenderedHtml = (html: string) =>
  renderedCanvasHtmlAttrRenames.reduce(
    (nextHtml, [legacyAttrName, canonicalAttrName]) => nextHtml.replaceAll(legacyAttrName, canonicalAttrName),
    html
  );

export const TemplateEditPreviewSurface = React.memo(function TemplateEditPreviewSurface({
  renderedPreviewHtml,
  canvasFullscreen,
  canvasSurfaceHeight,
  canvasSurfaceFillAvailableHeight = false,
  boxCreationMode,
  canvasIconScale,
  spacePanArmed,
  spacePanDragging,
  metadataVisualMode,
  preparedViewMode,
  selectionInactiveOverlayOpacity = 0.5,
  templateUsagePreviewMode,
  templateUsagePreviewHtml = '',
  templateUsagePreviewPending = false,
  showEditorRoomAsUsagePreviewFallback = false,
  selectionPanelTab,
  editSettingsPanelVisible,
  showMetadataIcons,
  todoOverlay,
  todoOverlayLabel = '할 일',
  onCloseTodoOverlay,
  actionOverlay,
  actionOverlayLabel = '기능 버튼',
  actionOverlayExpandedWidthClassName,
  metadataNameOverlay,
  metadataRolePrimaryOverlay,
  metadataRoleSecondaryOverlay,
  metadataRoleTertiaryOverlay,
  metadata2RoleScopeOverlay,
  metadata2RolePhotoOverlay,
  metadata2RoleFileOverlay,
  metadata2RoleExpirationOverlay,
  metadata2RoleAssignmentOverlay,
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
  setEditorPreviewNode,
  setTemplateUsagePreviewNode,
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
  const editorPreviewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const templateUsagePreviewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const syncedTemplateUsagePreviewHtmlRef = React.useRef('');
  const canvasScrollIndicatorFrameRef = React.useRef<number | null>(null);
  const [canvasScrollEdgeState, setCanvasScrollEdgeState] = React.useState<CanvasScrollEdgeState>(
    emptyCanvasScrollEdgeState
  );
  const hasPreparedTemplateUsagePreviewHtml = templateUsagePreviewHtml.trim().length > 0;
  const showEditorRoomFallbackForUsagePreview =
    templateUsagePreviewMode && showEditorRoomAsUsagePreviewFallback && !hasPreparedTemplateUsagePreviewHtml;
  const floatingOverlayNodeRefs = React.useRef<Record<TemplateFloatingOverlayId, HTMLElement | null>>({
    todo: null,
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
    todo: 'top-left',
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
  const syncCanvasScrollEdgeState = React.useCallback(() => {
    const nextState = readCanvasScrollEdgeState(previewNodeRef.current);

    setCanvasScrollEdgeState((currentState) =>
      areCanvasScrollEdgeStatesEqual(currentState, nextState) ? currentState : nextState
    );
  }, []);
  const scheduleCanvasScrollEdgeStateSync = React.useCallback(() => {
    if (typeof window === 'undefined') {
      syncCanvasScrollEdgeState();
      return;
    }

    if (canvasScrollIndicatorFrameRef.current !== null) {
      return;
    }

    canvasScrollIndicatorFrameRef.current = window.requestAnimationFrame(() => {
      canvasScrollIndicatorFrameRef.current = null;
      syncCanvasScrollEdgeState();
    });
  }, [syncCanvasScrollEdgeState]);
  const setActivePreviewSurfaceNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      previewNodeRef.current = node;
      setPreviewNode(node);
      scheduleCanvasScrollEdgeStateSync();
    },
    [scheduleCanvasScrollEdgeStateSync, setPreviewNode]
  );
  const setEditorPreviewSurfaceNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      editorPreviewNodeRef.current = node;
      setEditorPreviewNode?.(node);
      if (!templateUsagePreviewMode || showEditorRoomFallbackForUsagePreview) {
        setActivePreviewSurfaceNode(node);
      }
    },
    [
      setActivePreviewSurfaceNode,
      setEditorPreviewNode,
      showEditorRoomFallbackForUsagePreview,
      templateUsagePreviewMode,
    ]
  );
  const setTemplateUsagePreviewSurfaceNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      templateUsagePreviewNodeRef.current = node;
      setTemplateUsagePreviewNode?.(node);
      if (templateUsagePreviewMode) {
        setActivePreviewSurfaceNode(node);
      }
    },
    [setActivePreviewSurfaceNode, setTemplateUsagePreviewNode, templateUsagePreviewMode]
  );

  React.useLayoutEffect(() => {
    setActivePreviewSurfaceNode(
      templateUsagePreviewMode
        ? templateUsagePreviewNodeRef.current ||
            (showEditorRoomFallbackForUsagePreview ? editorPreviewNodeRef.current : null)
        : editorPreviewNodeRef.current
    );
  }, [
    renderedPreviewHtml,
    setActivePreviewSurfaceNode,
    showEditorRoomFallbackForUsagePreview,
    templateUsagePreviewHtml,
    templateUsagePreviewMode,
  ]);

  React.useEffect(() => {
    const node = previewNodeRef.current;

    scheduleCanvasScrollEdgeStateSync();

    if (!node || typeof window === 'undefined') {
      return undefined;
    }

    const handleScroll = () => {
      scheduleCanvasScrollEdgeStateSync();
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            scheduleCanvasScrollEdgeStateSync();
          });

    node.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    resizeObserver?.observe(node);
    Array.from(node.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        resizeObserver?.observe(child);
      }
    });

    return () => {
      node.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      resizeObserver?.disconnect();

      if (canvasScrollIndicatorFrameRef.current !== null) {
        window.cancelAnimationFrame(canvasScrollIndicatorFrameRef.current);
        canvasScrollIndicatorFrameRef.current = null;
      }
    };
  }, [
    canvasSurfaceFillAvailableHeight,
    canvasSurfaceHeight,
    preparedViewMode,
    renderedPreviewHtml,
    scheduleCanvasScrollEdgeStateSync,
    selectionPanelTab,
    showEditorRoomFallbackForUsagePreview,
    templateUsagePreviewHtml,
    templateUsagePreviewMode,
  ]);

  React.useLayoutEffect(() => {
    if (!showEditorRoomFallbackForUsagePreview || !editorPreviewNodeRef.current) {
      return;
    }

    syncTemplateUsagePreviewTextControls?.(editorPreviewNodeRef.current);
  }, [renderedPreviewHtml, showEditorRoomFallbackForUsagePreview, syncTemplateUsagePreviewTextControls]);

  React.useLayoutEffect(() => {
    if (!templateUsagePreviewHtml.trim()) {
      syncedTemplateUsagePreviewHtmlRef.current = '';
      return;
    }

    if (
      !templateUsagePreviewNodeRef.current ||
      syncedTemplateUsagePreviewHtmlRef.current === templateUsagePreviewHtml
    ) {
      return;
    }

    syncTemplateUsagePreviewTextControls?.(templateUsagePreviewNodeRef.current);
    syncedTemplateUsagePreviewHtmlRef.current = templateUsagePreviewHtml;
  }, [syncTemplateUsagePreviewTextControls, templateUsagePreviewHtml]);

  const [styleOverlayCollapsed, setStyleOverlayCollapsed] = React.useState(true);
  const [sizeTypeOverlayCollapsed, setSizeTypeOverlayCollapsed] = React.useState(true);
  const [textStyleOverlayCollapsed, setTextStyleOverlayCollapsed] = React.useState(true);
  const [summaryOverlayCollapsed, setSummaryOverlayCollapsed] = React.useState(true);
  const [actionOverlayCollapsed, setActionOverlayCollapsed] = React.useState(false);
  const [metadataNameOverlayCollapsed, setMetadataNameOverlayCollapsed] = React.useState(true);
  const [metadataRolePrimaryOverlayCollapsed, setMetadataRolePrimaryOverlayCollapsed] = React.useState(true);
  const [metadataRoleSecondaryOverlayCollapsed, setMetadataRoleSecondaryOverlayCollapsed] = React.useState(true);
  const [metadataRoleTertiaryOverlayCollapsed, setMetadataRoleTertiaryOverlayCollapsed] = React.useState(true);
  const [metadata2NameOverlayCollapsed, setMetadata2NameOverlayCollapsed] = React.useState(false);
  const [metadata2RolePrimaryOverlayCollapsed, setMetadata2RolePrimaryOverlayCollapsed] = React.useState(true);
  const [metadata2RoleSecondaryOverlayCollapsed, setMetadata2RoleSecondaryOverlayCollapsed] = React.useState(true);
  const [metadata2RoleTertiaryOverlayCollapsed, setMetadata2RoleTertiaryOverlayCollapsed] = React.useState(true);
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
    metadata2NameOverlayCollapsed,
    metadata2RolePrimaryOverlayCollapsed,
    metadata2RoleSecondaryOverlayCollapsed,
    metadata2RoleTertiaryOverlayCollapsed,
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
    const metadata2Active = selectionPanelTab === 'metadata2';

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
        return metadata2Active ? metadata2NameOverlayCollapsed : metadataNameOverlayCollapsed;
      case 'metadataRolePrimary':
        return metadata2Active ? metadata2RolePrimaryOverlayCollapsed : metadataRolePrimaryOverlayCollapsed;
      case 'metadataRoleSecondary':
        return metadata2Active ? metadata2RoleSecondaryOverlayCollapsed : metadataRoleSecondaryOverlayCollapsed;
      case 'metadataRoleTertiary':
        return metadata2Active ? metadata2RoleTertiaryOverlayCollapsed : metadataRoleTertiaryOverlayCollapsed;
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
    if (isTemplateCanvasMetadataSelectionPanelTab(selectionPanelTab)) {
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
        case 'action':
          return 94;
        case 'style':
          return 104;
        case 'sizeType':
          return 116;
        case 'textStyle':
          return 113;
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
      finishFloatingOverlayDrag(event, () => {
        if (selectionPanelTab === 'metadata2') {
          setMetadata2NameOverlayCollapsed((current) => !current);
          return;
        }

        setMetadataNameOverlayCollapsed((current) => !current);
      });
    },
    [finishFloatingOverlayDrag, selectionPanelTab]
  );
  const finishMetadataRolePrimaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => {
        if (selectionPanelTab === 'metadata2') {
          setMetadata2RolePrimaryOverlayCollapsed((current) => !current);
          return;
        }

        setMetadataRolePrimaryOverlayCollapsed((current) => !current);
      });
    },
    [finishFloatingOverlayDrag, selectionPanelTab]
  );
  const finishMetadataRoleSecondaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => {
        if (selectionPanelTab === 'metadata2') {
          setMetadata2RoleSecondaryOverlayCollapsed((current) => !current);
          return;
        }

        setMetadataRoleSecondaryOverlayCollapsed((current) => !current);
      });
    },
    [finishFloatingOverlayDrag, selectionPanelTab]
  );
  const finishMetadataRoleTertiaryOverlayDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      finishFloatingOverlayDrag(event, () => {
        if (selectionPanelTab === 'metadata2') {
          setMetadata2RoleTertiaryOverlayCollapsed((current) => !current);
          return;
        }

        setMetadataRoleTertiaryOverlayCollapsed((current) => !current);
      });
    },
    [finishFloatingOverlayDrag, selectionPanelTab]
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
      __html: removeCanvasModeAttrNamesFromRenderedHtml(renderedPreviewHtml),
    }),
    [renderedPreviewHtml]
  );
  const templateUsagePreviewMarkup = React.useMemo(
    () => ({
      __html: removeCanvasModeAttrNamesFromRenderedHtml(templateUsagePreviewHtml),
    }),
    [templateUsagePreviewHtml]
  );
  const normalizedSelectionInactiveOverlayOpacity = Math.max(
    0,
    Math.min(1, Number.isFinite(selectionInactiveOverlayOpacity) ? selectionInactiveOverlayOpacity : 0.5)
  );
  const previewSurfaceStyle = React.useMemo(
    () =>
      ({
        '--v106-selection-inactive-overlay-alpha': String(normalizedSelectionInactiveOverlayOpacity),
      }) as React.CSSProperties,
    [normalizedSelectionInactiveOverlayOpacity]
  );
  const templateUsagePreviewSurfaceStyle = React.useMemo(
    () =>
      ({
        ...previewSurfaceStyle,
        position: 'absolute',
        inset: 0,
      }) as React.CSSProperties,
    [previewSurfaceStyle]
  );

  const renderFloatingOverlaySection = (
    overlayId: TemplateFloatingOverlayId,
    label: string,
    collapsed: boolean,
    setCollapsed: React.Dispatch<React.SetStateAction<boolean>> | null,
    _finishDrag: (event: React.PointerEvent<HTMLButtonElement>) => void,
    content: TemplateFloatingOverlayContent | null | undefined,
    options: {
      alwaysExpanded?: boolean;
      keepMountedWhenCollapsed?: boolean;
      expandedWidthClassName?: string;
      sectionOwnerItem?: string;
      sectionOwnerName?: string;
      contentOwnerItem?: string;
      contentOwnerName?: string;
      overflowVisible?: boolean;
    } = {}
  ) => {
    const contentRenderer = typeof content === 'function' ? content : null;

    if (!contentRenderer && !content) {
      return null;
    }

    const isCollapsed = options.alwaysExpanded ? false : collapsed;

    return {
      node: (
        <div
          key={overlayId}
          ref={(node) => {
            floatingOverlayNodeRefs.current[overlayId] = node;
          }}
          className={`w-full border-b border-slate-200 last:border-b-0 ${options.overflowVisible ? 'overflow-visible' : ''}`}
          data-template-floating-overlay-expanded={isCollapsed ? 'false' : 'true'}
          data-template-floating-overlay-id={overlayId}
          data-canvas-owner-item={options.sectionOwnerItem}
          data-canvas-owner-name={options.sectionOwnerName}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={`w-full min-w-0 ${options.overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}>
            <button
              type="button"
              className="flex h-8 w-full items-center justify-between gap-3 bg-white px-3 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              aria-label={
                options.alwaysExpanded
                  ? label
                  : isCollapsed
                    ? `${label} 열기`
                    : `${label} 접기`
              }
              title={label}
              onClick={(event) => {
                if (options.alwaysExpanded || !setCollapsed) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                setCollapsed((current) => !current);
              }}
              onKeyDown={(event) => {
                if (options.alwaysExpanded || !setCollapsed || (event.key !== 'Enter' && event.key !== ' ')) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                setCollapsed((current) => !current);
              }}
            >
              <span className="min-w-0 truncate">{label}</span>
              {options.alwaysExpanded ? null : isCollapsed ? (
                <ChevronDown className="h-3 w-3 text-slate-500" aria-hidden="true" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              )}
            </button>
            {isCollapsed ? null : (
              <div
                data-template-overlay-rail-content="true"
                data-canvas-owner-item={options.contentOwnerItem}
                data-canvas-owner-name={options.contentOwnerName}
                className={
                  overlayId === 'style'
                    ? `flex w-full max-w-full flex-col items-stretch gap-2.5 bg-slate-100 px-3 py-2.5 ${options.overflowVisible ? 'overflow-visible' : ''}`
                    : overlayId === 'sizeType'
                      ? `max-w-full bg-slate-100 px-3 py-2.5 ${options.overflowVisible ? 'overflow-visible' : ''}`
                      : `bg-slate-100 px-3 py-2.5 ${options.overflowVisible ? 'overflow-visible' : ''}`
                }
                aria-hidden="false"
              >
                {contentRenderer ? contentRenderer() : (content as React.ReactNode)}
              </div>
            )}
          </div>
        </div>
      ),
    };
  };

  const resolvedCanvasSurfaceHeight = String(canvasSurfaceHeight || '').trim();
  const hasSpecifiedCanvasSurfaceHeight = !canvasFullscreen && Boolean(resolvedCanvasSurfaceHeight);
  const canvasSurfaceSizingClassName =
    canvasFullscreen || canvasSurfaceFillAvailableHeight
      ? 'flex-1'
      : hasSpecifiedCanvasSurfaceHeight
        ? ''
        : 'h-[70vh] max-h-[70vh]';
  const canvasSurfaceSizingStyle = hasSpecifiedCanvasSurfaceHeight
    ? ({ height: resolvedCanvasSurfaceHeight, maxHeight: resolvedCanvasSurfaceHeight } as React.CSSProperties)
    : undefined;
  const preparedViewSelectionPanelTab = resolveTemplateCanvasSelectionPanelTab(preparedViewMode);
  const preparedViewMatchesActivePanel = preparedViewSelectionPanelTab === selectionPanelTab;
  const todoOverlayActive = Boolean(todoOverlay);
  const renderTodoOverlaySection = (): OverlayRailSection | null => {
    if (!todoOverlay) {
      return null;
    }

    const contentRenderer = typeof todoOverlay === 'function' ? todoOverlay : null;

    return {
      node: (
        <div
          key="todo"
          ref={(node) => {
            floatingOverlayNodeRefs.current.todo = node;
          }}
          className="w-full border-b border-slate-200 last:border-b-0"
          data-template-floating-overlay-expanded="true"
          data-template-floating-overlay-id="todo"
          data-canvas-owner-item="canvas-container-상자-편집-패널-할-일"
          data-canvas-owner-name="상자 편집 패널 할 일 섹션"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            data-template-overlay-rail-content="true"
            data-canvas-owner-item="canvas-container-상자-편집-패널-할-일-내용"
            data-canvas-owner-name="상자 편집 패널 할 일 내용"
            className="bg-slate-100 px-3 py-2.5"
            aria-label={todoOverlayLabel}
          >
            {onCloseTodoOverlay ? (
              <button
                type="button"
                className="mb-2.5 flex h-8 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseTodoOverlay();
                }}
                aria-label="할 일 닫기"
                title="할 일 닫기"
              >
                <span className="min-w-0 truncate">편집 설정으로 돌아가기</span>
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {contentRenderer ? contentRenderer() : todoOverlay}
          </div>
        </div>
      ),
    };
  };
  const renderActiveTodoOverlaySection = (tab: SelectionPanelTab) =>
    tab === selectionPanelTab ? renderTodoOverlaySection() : null;

  if (templateUsagePreviewPending && !showEditorRoomFallbackForUsagePreview) {
    return (
      <CardContent
        className={`min-h-0 bg-slate-200 p-6 ${canvasSurfaceSizingClassName}`}
        data-canvas-prepared-view-match="false"
        data-canvas-prepared-view-tab="preview"
        data-canvas-prepared-view-status="pending"
        data-canvas-prepared-view-requested-tab={preparedViewSelectionPanelTab}
        data-selection-panel-tab={selectionPanelTab}
        data-template-usage-preview-active={templateUsagePreviewMode ? 'true' : 'false'}
        style={canvasSurfaceSizingStyle}
      >
        <div
          className={`flex items-center justify-center text-sm text-slate-500 ${
            hasSpecifiedCanvasSurfaceHeight || canvasSurfaceFillAvailableHeight ? 'h-full min-h-0' : 'min-h-[560px]'
          }`}
        >
          미리보기 준비 중입니다.
        </div>
      </CardContent>
    );
  }

  if (renderedPreviewHtml && !preparedViewMatchesActivePanel) {
    return (
      <CardContent
        className={`min-h-0 bg-slate-200 p-6 ${canvasSurfaceSizingClassName}`}
        data-canvas-prepared-view-match="false"
        data-canvas-prepared-view-tab={preparedViewMode}
        data-canvas-prepared-view-requested-tab={preparedViewSelectionPanelTab}
        data-selection-panel-tab={selectionPanelTab}
        style={canvasSurfaceSizingStyle}
      >
        <div
          className={`flex items-center justify-center text-sm text-slate-500 ${
            hasSpecifiedCanvasSurfaceHeight || canvasSurfaceFillAvailableHeight ? 'h-full min-h-0' : 'min-h-[560px]'
          }`}
        >
          캔버스 뷰를 준비 중입니다.
        </div>
      </CardContent>
    );
  }

  if (!renderedPreviewHtml) {
    return (
      <CardContent
        className={`min-h-0 bg-slate-200 p-6 ${canvasSurfaceSizingClassName}`}
        style={canvasSurfaceSizingStyle}
      >
        <div
          className={`flex items-center justify-center text-sm text-slate-500 ${
            hasSpecifiedCanvasSurfaceHeight || canvasSurfaceFillAvailableHeight ? 'h-full min-h-0' : 'min-h-[560px]'
          }`}
        >
          편집할 템플릿을 먼저 불러오세요.
        </div>
      </CardContent>
    );
  }

  const editOverlayRailVisible = editSettingsPanelVisible && !templateUsagePreviewMode;
  const positionEditOverlayRailSections = editOverlayRailVisible
    ? [
        renderFloatingOverlaySection('summary', '요약', summaryOverlayCollapsed, setSummaryOverlayCollapsed, finishSummaryOverlayDrag, summaryOverlay),
        renderFloatingOverlaySection(
          'style',
          styleOverlayLabel,
          styleOverlayCollapsed,
          setStyleOverlayCollapsed,
          finishStyleOverlayDrag,
          styleOverlay,
          { expandedWidthClassName: 'w-[250px] max-w-[250px]', keepMountedWhenCollapsed: true }
        ),
        renderFloatingOverlaySection(
          'sizeType',
          '상자 크기 타입',
          sizeTypeOverlayCollapsed,
          setSizeTypeOverlayCollapsed,
          finishSizeTypeOverlayDrag,
          sizeTypeOverlay,
          { expandedWidthClassName: 'w-fit max-w-[250px]', keepMountedWhenCollapsed: true }
        ),
        renderFloatingOverlaySection(
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
        ),
        renderFloatingOverlaySection(
          'action',
          actionOverlayLabel,
          actionOverlayCollapsed,
          setActionOverlayCollapsed,
          finishActionOverlayDrag,
          actionOverlay,
          {
            expandedWidthClassName: actionOverlayExpandedWidthClassName || 'w-44 max-w-[calc(100%_-_1.5rem)]',
            keepMountedWhenCollapsed: true,
          }
        ),
      ]
    : [];
  const positionOverlayRailSections = compactOverlayRailSections(
    todoOverlayActive ? [renderActiveTodoOverlaySection('position')] : positionEditOverlayRailSections
  );
  const metadataEditOverlayRailSections = editOverlayRailVisible
    ? [
        renderFloatingOverlaySection('summary', '요약', summaryOverlayCollapsed, setSummaryOverlayCollapsed, finishSummaryOverlayDrag, summaryOverlay),
        renderFloatingOverlaySection(
          'metadataRolePrimary',
          '상자 역할 - 1',
          metadataRolePrimaryOverlayCollapsed,
          setMetadataRolePrimaryOverlayCollapsed,
          finishMetadataRolePrimaryOverlayDrag,
          metadataRolePrimaryOverlay,
          { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
        ),
        renderFloatingOverlaySection(
          'metadataRoleSecondary',
          '상자 역할 - 2',
          metadataRoleSecondaryOverlayCollapsed,
          setMetadataRoleSecondaryOverlayCollapsed,
          finishMetadataRoleSecondaryOverlayDrag,
          metadataRoleSecondaryOverlay,
          { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
        ),
        renderFloatingOverlaySection(
          'metadataRoleTertiary',
          '상자 연결',
          metadataRoleTertiaryOverlayCollapsed,
          setMetadataRoleTertiaryOverlayCollapsed,
          finishMetadataRoleTertiaryOverlayDrag,
          metadataRoleTertiaryOverlay,
          { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
        ),
      ]
    : [];
  const metadataOverlayRailSections = compactOverlayRailSections(
    todoOverlayActive ? [renderActiveTodoOverlaySection('metadata')] : metadataEditOverlayRailSections
  );
  const hasMetadata2ScopeRailOverlay = Boolean(
    metadata2RoleScopeOverlay ||
      metadata2RolePhotoOverlay ||
      metadata2RoleFileOverlay ||
      metadata2RoleExpirationOverlay ||
      metadata2RoleAssignmentOverlay
  );
  const metadata2EditOverlayRailSections = editOverlayRailVisible
    ? hasMetadata2ScopeRailOverlay
      ? [
          renderFloatingOverlaySection(
            'metadataName',
            '상자에 scope 지정',
            metadata2NameOverlayCollapsed,
            setMetadata2NameOverlayCollapsed,
            finishMetadataNameOverlayDrag,
            metadata2RoleScopeOverlay || metadata2RoleAssignmentOverlay,
            {
              expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]',
              sectionOwnerItem: 'canvas-container-123',
              sectionOwnerName: '역할 탭 scope 설정 섹션',
              contentOwnerItem: 'canvas-container-113',
              contentOwnerName: '역할 탭 scope 설정 내용',
              overflowVisible: true,
            }
          ),
          renderFloatingOverlaySection(
            'metadataRolePrimary',
            '필수 사진 등록',
            metadata2RolePrimaryOverlayCollapsed,
            setMetadata2RolePrimaryOverlayCollapsed,
            finishMetadataRolePrimaryOverlayDrag,
            metadata2RolePhotoOverlay,
            {
              expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]',
              overflowVisible: true,
            }
          ),
          renderFloatingOverlaySection(
            'metadataRoleSecondary',
            '필수 파일 등록',
            metadata2RoleSecondaryOverlayCollapsed,
            setMetadata2RoleSecondaryOverlayCollapsed,
            finishMetadataRoleSecondaryOverlayDrag,
            metadata2RoleFileOverlay,
            {
              expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]',
              overflowVisible: true,
            }
          ),
          renderFloatingOverlaySection(
            'metadataRoleTertiary',
            '만료 시각 설정',
            metadata2RoleTertiaryOverlayCollapsed,
            setMetadata2RoleTertiaryOverlayCollapsed,
            finishMetadataRoleTertiaryOverlayDrag,
            metadata2RoleExpirationOverlay,
            {
              expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]',
              overflowVisible: true,
            }
          ),
        ]
      : [
          renderFloatingOverlaySection('summary', '요약', summaryOverlayCollapsed, setSummaryOverlayCollapsed, finishSummaryOverlayDrag, summaryOverlay),
          renderFloatingOverlaySection(
            'metadataRolePrimary',
            '상자 역할 - 1',
            metadata2RolePrimaryOverlayCollapsed,
            setMetadata2RolePrimaryOverlayCollapsed,
            finishMetadataRolePrimaryOverlayDrag,
            metadataRolePrimaryOverlay,
            { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
          ),
          renderFloatingOverlaySection(
            'metadataRoleSecondary',
            '상자 역할 - 2',
            metadata2RoleSecondaryOverlayCollapsed,
            setMetadata2RoleSecondaryOverlayCollapsed,
            finishMetadataRoleSecondaryOverlayDrag,
            metadataRoleSecondaryOverlay,
            { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
          ),
          renderFloatingOverlaySection(
            'metadataRoleTertiary',
            '상자 연결',
            metadata2RoleTertiaryOverlayCollapsed,
            setMetadata2RoleTertiaryOverlayCollapsed,
            finishMetadataRoleTertiaryOverlayDrag,
            metadataRoleTertiaryOverlay,
            { expandedWidthClassName: 'w-[25rem] max-w-[calc(100%_-_1.5rem)]' }
          ),
        ]
    : [];
  const metadata2OverlayRailSections = compactOverlayRailSections(
    todoOverlayActive ? [renderActiveTodoOverlaySection('metadata2')] : metadata2EditOverlayRailSections
  );
  const overlayRailRooms: OverlayRailRoom[] = [
    { tab: 'position', sections: positionOverlayRailSections },
    { tab: 'metadata', sections: metadataOverlayRailSections },
    { tab: 'metadata2', sections: metadata2OverlayRailSections },
  ];
  const hasOverlayRail = editOverlayRailVisible && overlayRailRooms.some((room) => room.sections.length > 0);
  const preserveHiddenEditorOverlayRailSpace = false;
  const previewSurfaceBaseClassName =
    'template-edit-preview template-extract-draft-preview template-extract-preview-surface h-full max-h-full bg-slate-200 template-clone template-clone--raster-first-v2-structured';
  const visibleEditorRoomClassName = `${previewSurfaceBaseClassName} relative z-10`;
  const hiddenEditorRoomClassName = `${previewSurfaceBaseClassName} pointer-events-none invisible relative z-0`;
  const visibleTemplateUsagePreviewRoomClassName = `${previewSurfaceBaseClassName} absolute inset-0 z-20`;
  const hiddenTemplateUsagePreviewRoomClassName = `${previewSurfaceBaseClassName} pointer-events-none invisible absolute inset-0 z-0`;
  const hideEditorRoomForUsagePreview = templateUsagePreviewMode && !showEditorRoomFallbackForUsagePreview;
  const hasCanvasScrollEdgeIndicator =
    canvasScrollEdgeState.top ||
    canvasScrollEdgeState.right ||
    canvasScrollEdgeState.bottom ||
    canvasScrollEdgeState.left;

  return (
    <CardContent
      ref={surfaceShellRef}
      className={`relative min-h-0 overflow-hidden bg-slate-200 p-0 ${canvasSurfaceSizingClassName}`}
      style={canvasSurfaceSizingStyle}
    >
      <div
        data-template-canvas-editor-room-container="true"
        className={`flex h-full min-h-0 w-full ${
          hideEditorRoomForUsagePreview ? 'pointer-events-none relative z-0' : 'relative z-10'
        }`}
        aria-hidden={hideEditorRoomForUsagePreview ? 'true' : undefined}
      >
        <div className="relative min-w-0 flex-1">
          <div
            ref={setEditorPreviewSurfaceNode}
            className={hideEditorRoomForUsagePreview ? hiddenEditorRoomClassName : visibleEditorRoomClassName}
            aria-hidden={hideEditorRoomForUsagePreview ? 'true' : undefined}
            data-template-canvas-editor-room="true"
            data-template-usage-preview-fallback-visible={showEditorRoomFallbackForUsagePreview ? 'true' : 'false'}
            data-frame-create-active={boxCreationMode ? 'true' : 'false'}
            data-canvas-icon-scale={canvasIconScale}
            data-space-pan-armed={spacePanArmed ? 'true' : 'false'}
            data-space-pan-dragging={spacePanDragging ? 'true' : 'false'}
            data-metadata-visual-active={metadataVisualMode ? 'true' : 'false'}
            data-template-usage-preview-active="false"
            data-selection-panel-tab={selectionPanelTab}
            data-canvas-prepared-view-tab={templateUsagePreviewMode ? 'position' : preparedViewMode}
            data-canvas-prepared-view-cache-key={`${templateUsagePreviewMode ? 'position' : preparedViewMode}:${selectionPanelTab}`}
            data-canvas-prepared-view-match={!templateUsagePreviewMode && preparedViewMatchesActivePanel ? 'true' : 'false'}
            data-canvas-prepared-view-requested-tab={preparedViewSelectionPanelTab}
            data-canvas-prepared-view-visible={hideEditorRoomForUsagePreview ? 'false' : 'true'}
            data-metadata-icon-visual-active={showMetadataIcons ? 'true' : 'false'}
            style={previewSurfaceStyle}
            onPointerDownCapture={handlePreviewPointerDown}
            onPointerMoveCapture={handlePreviewPointerMove}
            onPointerUpCapture={handlePreviewPointerUp}
            onPointerCancelCapture={handlePreviewPointerCancel}
            onLostPointerCaptureCapture={handlePreviewLostPointerCapture}
            onClickCapture={handlePreviewClickCapture}
            onInput={handlePreviewInput}
            dangerouslySetInnerHTML={renderedPreviewMarkup}
          />
          {hasCanvasScrollEdgeIndicator ? (
            <div
              className="pointer-events-none absolute inset-0 z-30"
              data-canvas-owner-item="canvas-scroll-edge-indicators"
              data-canvas-owner-name="캔버스 스크롤 가능 방향 표시"
              aria-hidden="true"
            >
              {canvasScrollEdgeState.top ? (
                <div
                  className="absolute left-0 right-0 top-0 flex h-[26px] items-start justify-center bg-gradient-to-b from-[rgba(226,232,240,0.94)] to-transparent pt-1"
                  data-canvas-owner-item="canvas-scroll-edge-indicator-top"
                  data-canvas-owner-name="캔버스 위쪽 스크롤 가능 표시"
                >
                  <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
              ) : null}
              {canvasScrollEdgeState.right ? (
                <div
                  className="absolute bottom-0 right-0 top-0 flex w-[26px] items-center justify-end bg-gradient-to-l from-[rgba(226,232,240,0.94)] to-transparent pr-1"
                  data-canvas-owner-item="canvas-scroll-edge-indicator-right"
                  data-canvas-owner-name="캔버스 오른쪽 스크롤 가능 표시"
                >
                  <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
              ) : null}
              {canvasScrollEdgeState.bottom ? (
                <div
                  className="absolute bottom-0 left-0 right-0 flex h-[26px] items-end justify-center bg-gradient-to-t from-[rgba(226,232,240,0.94)] to-transparent pb-1"
                  data-canvas-owner-item="canvas-scroll-edge-indicator-bottom"
                  data-canvas-owner-name="캔버스 아래쪽 스크롤 가능 표시"
                >
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
              ) : null}
              {canvasScrollEdgeState.left ? (
                <div
                  className="absolute bottom-0 left-0 top-0 flex w-[26px] items-center justify-start bg-gradient-to-r from-[rgba(226,232,240,0.94)] to-transparent pl-1"
                  data-canvas-owner-item="canvas-scroll-edge-indicator-left"
                  data-canvas-owner-name="캔버스 왼쪽 스크롤 가능 표시"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {hasOverlayRail ? (
          <aside
            className="h-full min-w-0 w-[min(300px,45%)] max-w-[300px] shrink-0 overflow-y-auto border-l border-slate-300 bg-white p-0"
            data-template-overlay-rail="true"
            data-template-overlay-rail-active-tab={selectionPanelTab}
            data-canvas-owner-item="canvas-aside-상자-편집-패널-2"
            data-canvas-owner-name="상자 편집 패널"
            aria-label="상자 편집 패널"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {overlayRailRooms.map((room) => {
              const active = room.tab === selectionPanelTab;

              return (
                <div
                  key={`overlay-rail-room:${room.tab}`}
                  className={`${active ? 'flex' : 'hidden'} min-h-0 flex-col`}
                  data-template-overlay-rail-items="true"
                  data-template-overlay-rail-room={room.tab}
                  aria-hidden={active ? 'false' : 'true'}
                >
                  {room.sections.map((section) => section.node)}
                </div>
              );
            })}
          </aside>
        ) : preserveHiddenEditorOverlayRailSpace ? (
          <aside
            className="h-full min-w-0 w-[min(300px,45%)] max-w-[300px] shrink-0 border-l border-slate-300 bg-white p-0"
            data-template-overlay-rail-placeholder="true"
            data-canvas-owner-item="canvas-aside-상자-편집-패널-2"
            data-canvas-owner-name="상자 편집 패널"
            aria-hidden="true"
            inert
          />
        ) : null}
      </div>
      {hasPreparedTemplateUsagePreviewHtml ? (
        <div
          ref={setTemplateUsagePreviewSurfaceNode}
          className={
            templateUsagePreviewMode
              ? visibleTemplateUsagePreviewRoomClassName
              : hiddenTemplateUsagePreviewRoomClassName
          }
          aria-hidden={templateUsagePreviewMode ? undefined : 'true'}
          data-template-canvas-preview-room="true"
          data-frame-create-active="false"
          data-canvas-icon-scale={canvasIconScale}
          data-space-pan-armed={spacePanArmed ? 'true' : 'false'}
          data-space-pan-dragging={spacePanDragging ? 'true' : 'false'}
          data-metadata-visual-active="false"
          data-template-usage-preview-active="true"
          data-template-usage-preview-prepared="true"
          data-selection-panel-tab="position"
          data-canvas-prepared-view-tab="preview"
          data-canvas-prepared-view-cache-key="preview:position"
          data-canvas-prepared-view-match={templateUsagePreviewMode ? 'true' : 'false'}
          data-canvas-prepared-view-requested-tab="position"
          data-canvas-prepared-view-visible={templateUsagePreviewMode ? 'true' : 'false'}
          data-metadata-icon-visual-active="false"
          style={templateUsagePreviewSurfaceStyle}
          onPointerDownCapture={handlePreviewPointerDown}
          onPointerMoveCapture={handlePreviewPointerMove}
          onPointerUpCapture={handlePreviewPointerUp}
          onPointerCancelCapture={handlePreviewPointerCancel}
          onLostPointerCaptureCapture={handlePreviewLostPointerCapture}
          onClickCapture={handlePreviewClickCapture}
          onInput={handlePreviewInput}
          dangerouslySetInnerHTML={templateUsagePreviewMarkup}
        />
      ) : null}
    </CardContent>
  );
});
