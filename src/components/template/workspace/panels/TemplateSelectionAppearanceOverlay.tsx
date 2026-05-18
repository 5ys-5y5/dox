'use client';

import * as React from 'react';
import type { TemplateEdgeSide } from '../../../../lib/templateEdgeSelectionDtos';
import { Input } from '../../../ui/Input';
import {
  APPEARANCE_BORDER_SIDE_LABELS,
  APPEARANCE_BORDER_SIDES,
  APPEARANCE_CORNERS,
  APPEARANCE_CORNER_LABELS,
  APPEARANCE_TARGET_BY_STYLE_FIELD,
  FRAME_BORDER_ALIGN_OPTIONS,
  FRAME_BORDER_STYLE_OPTIONS,
  FRAME_STYLE_COLOR_OPTIONS,
  MIXED_STYLE_VALUE_LABEL,
} from '../constants';
import type {
  AppearanceBoxModelTarget,
  AppearanceColorPickerField,
  AppearanceCorner,
  SelectedTextAutoSizeState,
  SelectionStyleDraft,
  StyleFieldKey,
  TextAutoSizeSecondaryFitAxis,
} from '../types';
import { normalizeFrameBorderStyleValue, normalizeFrameBorderWidthValue } from '../utils';
import { StyleApplyStatusIcon, type StyleFieldApplyStatusMap } from './StyleApplyStatusIcon';

type TemplateSelectionAppearanceOverlayProps = {
  selectedFrameGroupIds: string[];
  selectedPositionResolvedFrameGroupIds: string[];
  selectionStyleDraft: SelectionStyleDraft;
  styleFieldApplyStatus: StyleFieldApplyStatusMap;
  selectedTextAutoSizeState: SelectedTextAutoSizeState;
  previewRef: React.MutableRefObject<HTMLDivElement | null>;
  selectionAppearanceToolbarWidth: number | null;
  appearanceBoxModelTarget: AppearanceBoxModelTarget;
  appearanceTargetBorderSides: TemplateEdgeSide[];
  appearanceTargetCorners: AppearanceCorner[];
  minFrameSizePx: number;
  handleSelectionAppearanceToolbarRef: (node: HTMLDivElement | null) => void;
  setAppearanceTargetBorderSides: React.Dispatch<React.SetStateAction<TemplateEdgeSide[]>>;
  setAppearanceTargetCorners: React.Dispatch<React.SetStateAction<AppearanceCorner[]>>;
  setAppearanceBoxModelTarget: React.Dispatch<React.SetStateAction<AppearanceBoxModelTarget>>;
  resolveSelectionAppearanceStyleTargets: (
    root: HTMLElement
  ) => { kind: 'frame'; elements: HTMLElement[] };
  resolveFrameLayoutShell: (node: HTMLElement) => HTMLElement;
  readElementBorderSideAppearance: (
    element: HTMLElement,
    side: TemplateEdgeSide
  ) => { width: number; style: string; color: string };
  formatFrameBorderWidthValue: (value: number) => string;
  readElementBorderAppearance: (element: HTMLElement) => {
    align: string;
    color: string;
    style: string;
    width: number;
  };
  readElementCornerRadiusValue: (element: HTMLElement, corner: AppearanceCorner) => string;
  readFrameAutoHeightBox: (node: HTMLElement) => boolean;
  readFrameAutoWidthBox: (node: HTMLElement) => boolean;
  readFrameAutoHeightBaseHeight: (node: HTMLElement) => number;
  readFrameAutoWidthBaseWidth: (node: HTMLElement) => number;
  colorToHex: (value: string) => string;
  getSharedValue: (values: Array<string | null | undefined>) => string;
  onApplyStyleFieldOnBlur: (field: StyleFieldKey, value?: string, options?: { mixedBlank?: boolean }) => void;
  onApplyStyleFieldImmediateValue: (field: StyleFieldKey, value: string) => void;
  onSetTextAutoSizeMinimumForSelection: (axis: Extract<TextAutoSizeSecondaryFitAxis, 'height' | 'width'>, value: number) => void;
  onMessage: (message: string) => void;
};

export const TemplateSelectionAppearanceOverlay = ({
  selectedFrameGroupIds,
  selectedPositionResolvedFrameGroupIds,
  selectionStyleDraft,
  styleFieldApplyStatus,
  selectedTextAutoSizeState,
  previewRef,
  selectionAppearanceToolbarWidth,
  appearanceBoxModelTarget,
  appearanceTargetBorderSides,
  appearanceTargetCorners,
  minFrameSizePx,
  handleSelectionAppearanceToolbarRef,
  setAppearanceTargetBorderSides,
  setAppearanceTargetCorners,
  setAppearanceBoxModelTarget,
  resolveSelectionAppearanceStyleTargets,
  resolveFrameLayoutShell,
  readElementBorderSideAppearance,
  formatFrameBorderWidthValue,
  readElementBorderAppearance,
  readElementCornerRadiusValue,
  readFrameAutoHeightBox,
  readFrameAutoWidthBox,
  readFrameAutoHeightBaseHeight,
  readFrameAutoWidthBaseWidth,
  colorToHex,
  getSharedValue,
  onApplyStyleFieldOnBlur,
  onApplyStyleFieldImmediateValue,
  onSetTextAutoSizeMinimumForSelection,
  onMessage,
}: TemplateSelectionAppearanceOverlayProps) => {
  const activeStyleSelectionIds =
    selectedPositionResolvedFrameGroupIds.length > 0 ? selectedPositionResolvedFrameGroupIds : selectedFrameGroupIds;
  const hasAppearanceSelection = activeStyleSelectionIds.length > 0;
  const parseDraftNumber = (value: string) => {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  };
  const clampVisualNumber = (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum);
  const heightValue = parseDraftNumber(selectionStyleDraft.height);
  const borderWidthValue = parseDraftNumber(selectionStyleDraft.borderWidth) || 0;
  const borderRadiusValue = parseDraftNumber(selectionStyleDraft.borderRadius) || 0;
  const borderStyleValue = normalizeFrameBorderStyleValue(selectionStyleDraft.borderStyle, borderWidthValue);
  const borderColorValue = selectionStyleDraft.borderColor.trim() || '#0f172a';
  const backgroundColorValue = selectionStyleDraft.backgroundColor.trim() || 'transparent';
  const previewRoot = previewRef.current;
  const previewStyleTargets =
    hasAppearanceSelection && previewRoot ? resolveSelectionAppearanceStyleTargets(previewRoot) : null;
  const previewStyleTargetShells = previewStyleTargets
    ? previewStyleTargets.elements.map((node) =>
        previewStyleTargets.kind === 'frame' ? resolveFrameLayoutShell(node) : node
      )
    : [];
  const scopedBorderSidesForDisplay =
    appearanceBoxModelTarget === 'border' && appearanceTargetBorderSides.length > 0
      ? appearanceTargetBorderSides
      : APPEARANCE_BORDER_SIDES;
  const scopedCornersForDisplay =
    appearanceBoxModelTarget === 'corner' && appearanceTargetCorners.length > 0
      ? appearanceTargetCorners
      : APPEARANCE_CORNERS;
  const computeSharedDisplayState = (values: string[]) => {
    const normalizedValues = values.map((value) => value.trim());
    const uniqueValues = Array.from(new Set(normalizedValues));
    return {
      value: uniqueValues[0] || '',
      mixed: uniqueValues.length > 1,
    };
  };
  const borderFieldDisplayState = {
    borderWidth: computeSharedDisplayState(
      scopedBorderSidesForDisplay.flatMap((side) =>
        previewStyleTargetShells.map((shell) =>
          formatFrameBorderWidthValue(readElementBorderSideAppearance(shell, side).width)
        )
      )
    ),
    borderStyle: computeSharedDisplayState(
      scopedBorderSidesForDisplay.flatMap((side) =>
        previewStyleTargetShells.map((shell) => readElementBorderSideAppearance(shell, side).style || 'none')
      )
    ),
    borderColor: computeSharedDisplayState(
      scopedBorderSidesForDisplay.flatMap((side) =>
        previewStyleTargetShells.map((shell) => {
          const appearance = readElementBorderSideAppearance(shell, side);
          return colorToHex(appearance.color || '') || appearance.color || '';
        })
      )
    ),
    borderAlign: computeSharedDisplayState(
      previewStyleTargetShells.map((shell) => readElementBorderAppearance(shell).align || '')
    ),
    borderRadius: computeSharedDisplayState(
      scopedCornersForDisplay.flatMap((corner) =>
        previewStyleTargetShells.map((shell) => readElementCornerRadiusValue(shell, corner))
      )
    ),
  } satisfies Partial<Record<StyleFieldKey, { value: string; mixed: boolean }>>;
  const autoSizeMinimumAxis: Extract<TextAutoSizeSecondaryFitAxis, 'height' | 'width'> | null = selectedTextAutoSizeState.allHeight
    ? 'height'
    : selectedTextAutoSizeState.allWidth
      ? 'width'
      : null;
  const autoSizeMinimumDisplayState: {
    axis: Extract<TextAutoSizeSecondaryFitAxis, 'height' | 'width'>;
    label: string;
    value: string;
    mixed: boolean;
  } | null = (() => {
    if (!previewStyleTargets || !autoSizeMinimumAxis || selectedTextAutoSizeState.mixed) {
      return null;
    }

    const targetNodes = previewStyleTargets.elements.filter((node) =>
      autoSizeMinimumAxis === 'height' ? readFrameAutoHeightBox(node) : readFrameAutoWidthBox(node)
    );

    if (targetNodes.length <= 0) {
      return null;
    }

    const normalizedValues = targetNodes.map((node) => {
      const minimumSize =
        autoSizeMinimumAxis === 'height'
          ? readFrameAutoHeightBaseHeight(node)
          : readFrameAutoWidthBaseWidth(node);

      return String(Number(Math.max(minFrameSizePx, minimumSize).toFixed(3)));
    });
    const uniqueValues = Array.from(new Set(normalizedValues));

    return {
      axis: autoSizeMinimumAxis,
      label: autoSizeMinimumAxis === 'height' ? '최소 높이' : '최소 너비',
      value: uniqueValues[0] || '',
      mixed: uniqueValues.length > 1,
    };
  })();
  const isStyleFieldDisabled = (field: StyleFieldKey) => {
    if (!hasAppearanceSelection) {
      return true;
    }

    if (field === 'height' && selectedTextAutoSizeState.allHeight) {
      return true;
    }

    if (field === 'width' && selectedTextAutoSizeState.allWidth) {
      return true;
    }

    if (appearanceBoxModelTarget === 'corner') {
      return field === 'borderWidth' || field === 'borderColor' || field === 'borderStyle' || field === 'borderAlign';
    }

    if (appearanceBoxModelTarget === 'border') {
      return field === 'borderRadius';
    }

    return false;
  };
  const selectionAppearancePreviewWidthPx =
    selectionAppearanceToolbarWidth && Number.isFinite(selectionAppearanceToolbarWidth)
      ? Math.max(1, Math.round(selectionAppearanceToolbarWidth))
      : null;
  const visualContentHeight = heightValue ? clampVisualNumber(heightValue * 0.32, 48, 128) : 70;
  const visualBorderWidth = borderStyleValue === 'none' ? 2 : clampVisualNumber(borderWidthValue || 1, 1, 8);
  const previewStrokeColor = borderStyleValue === 'none' ? 'rgba(15, 23, 42, .35)' : borderColorValue;
  const previewBorderSides = APPEARANCE_BORDER_SIDES.reduce<Record<TemplateEdgeSide, { width: number; style: string; color: string }>>(
    (accumulator, side) => {
      const sideAppearances = previewStyleTargetShells.map((shell) => readElementBorderSideAppearance(shell, side));
      const widthToken =
        sideAppearances.length === 1
          ? formatFrameBorderWidthValue(sideAppearances[0]?.width || 0)
          : getSharedValue(sideAppearances.map((appearance) => formatFrameBorderWidthValue(appearance.width)));
      const widthValue = normalizeFrameBorderWidthValue(widthToken) ?? 0;
      const styleToken =
        sideAppearances.length === 1
          ? sideAppearances[0]?.style || ''
          : getSharedValue(sideAppearances.map((appearance) => appearance.style));
      const colorToken =
        sideAppearances.length === 1
          ? sideAppearances[0]?.color || ''
          : getSharedValue(sideAppearances.map((appearance) => appearance.color));
      const normalizedStyle = normalizeFrameBorderStyleValue(styleToken || 'none', Math.max(widthValue, 1));
      const hasVisibleBorder = widthValue > 0 && normalizedStyle !== 'none';

      accumulator[side] = {
        width: hasVisibleBorder ? clampVisualNumber(widthValue, 1, 8) : 0,
        style: hasVisibleBorder ? normalizedStyle : 'none',
        color: hasVisibleBorder ? colorToHex(colorToken || '') || colorToken || '#0f172a' : 'transparent',
      };
      return accumulator;
    },
    {
      top: { width: 0, style: 'none', color: 'transparent' },
      right: { width: 0, style: 'none', color: 'transparent' },
      bottom: { width: 0, style: 'none', color: 'transparent' },
      left: { width: 0, style: 'none', color: 'transparent' },
    }
  );
  const previewCornerRadii = APPEARANCE_CORNERS.reduce<Record<AppearanceCorner, number>>(
    (accumulator, corner) => {
      const cornerValues = previewStyleTargetShells.map((shell) => readElementCornerRadiusValue(shell, corner));
      const radiusToken = cornerValues.length === 1 ? cornerValues[0] || '' : getSharedValue(cornerValues);
      const parsedRadius = Number.parseFloat(radiusToken || '');
      accumulator[corner] = Number.isFinite(parsedRadius) ? clampVisualNumber(parsedRadius, 0, 28) : 0;
      return accumulator;
    },
    {
      'top-left': clampVisualNumber(borderRadiusValue, 0, 28),
      'top-right': clampVisualNumber(borderRadiusValue, 0, 28),
      'bottom-right': clampVisualNumber(borderRadiusValue, 0, 28),
      'bottom-left': clampVisualNumber(borderRadiusValue, 0, 28),
    }
  );
  const previewHasAnyVisibleBorder = APPEARANCE_BORDER_SIDES.some((side) => {
    const appearance = previewBorderSides[side];
    return appearance.width > 0 && appearance.style !== 'none';
  });
  const previewCornerRadiusStyle: React.CSSProperties = {
    borderTopLeftRadius: `${previewCornerRadii['top-left']}px`,
    borderTopRightRadius: `${previewCornerRadii['top-right']}px`,
    borderBottomRightRadius: `${previewCornerRadii['bottom-right']}px`,
    borderBottomLeftRadius: `${previewCornerRadii['bottom-left']}px`,
  };
  const previewBorderPresentationStyle = (
    previewHasAnyVisibleBorder
      ? {
          borderTopWidth: `${previewBorderSides.top.width}px`,
          borderTopStyle: previewBorderSides.top.style,
          borderTopColor: previewBorderSides.top.color,
          borderRightWidth: `${previewBorderSides.right.width}px`,
          borderRightStyle: previewBorderSides.right.style,
          borderRightColor: previewBorderSides.right.color,
          borderBottomWidth: `${previewBorderSides.bottom.width}px`,
          borderBottomStyle: previewBorderSides.bottom.style,
          borderBottomColor: previewBorderSides.bottom.color,
          borderLeftWidth: `${previewBorderSides.left.width}px`,
          borderLeftStyle: previewBorderSides.left.style,
          borderLeftColor: previewBorderSides.left.color,
        }
      : {
          border: 'none',
        }
  ) as React.CSSProperties;
  const previewDashedGuideStyle: React.CSSProperties | null =
    !previewHasAnyVisibleBorder
      ? {
          position: 'absolute',
          inset: `${visualBorderWidth / -2}px`,
          pointerEvents: 'none',
          borderWidth: `${visualBorderWidth}px`,
          borderStyle: 'dashed',
          borderColor: previewStrokeColor,
          borderTopLeftRadius: `${previewCornerRadii['top-left'] + visualBorderWidth / 2}px`,
          borderTopRightRadius: `${previewCornerRadii['top-right'] + visualBorderWidth / 2}px`,
          borderBottomRightRadius: `${previewCornerRadii['bottom-right'] + visualBorderWidth / 2}px`,
          borderBottomLeftRadius: `${previewCornerRadii['bottom-left'] + visualBorderWidth / 2}px`,
        }
      : null;
  const transparentFillStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    backgroundImage:
      'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
    backgroundSize: '12px 12px',
  };
  const boxModelZoneClass = () => 'relative cursor-pointer focus-visible:outline-none';
  const activateAppearanceTargetMode = (target: AppearanceBoxModelTarget, resetSelection = false) => {
    if (target === 'content') {
      setAppearanceTargetBorderSides((previous) => (previous.length > 0 ? [] : previous));
      setAppearanceTargetCorners((previous) => (previous.length > 0 ? [] : previous));
      setAppearanceBoxModelTarget((previous) => (previous === 'content' ? previous : 'content'));
      return;
    }

    const shouldResetSelection = resetSelection || appearanceBoxModelTarget !== target;

    if (target === 'border' && shouldResetSelection) {
      setAppearanceTargetBorderSides((previous) => (previous.length > 0 ? [] : previous));
    }
    if (target === 'border') {
      setAppearanceTargetCorners((previous) => (previous.length > 0 ? [] : previous));
    }
    if (target === 'corner' && shouldResetSelection) {
      setAppearanceTargetCorners((previous) => (previous.length > 0 ? [] : previous));
    }
    if (target === 'corner') {
      setAppearanceTargetBorderSides((previous) => (previous.length > 0 ? [] : previous));
    }
    setAppearanceBoxModelTarget((previous) => (previous === target ? previous : target));
  };
  const clearAppearanceTargetModeIfNoSelection = (target: Extract<AppearanceBoxModelTarget, 'border' | 'corner'>) => {
    if (target === 'border') {
      if (appearanceBoxModelTarget === 'border' && appearanceTargetBorderSides.length <= 0) {
        activateAppearanceTargetMode('content', true);
      }
      return;
    }

    if (appearanceBoxModelTarget === 'corner' && appearanceTargetCorners.length <= 0) {
      activateAppearanceTargetMode('content', true);
    }
  };
  const toggleBorderSideTargetSelectionFromClick = (side: TemplateEdgeSide) => {
    setAppearanceTargetBorderSides((previous) => {
      const normalizedPrevious = previous.filter((entry): entry is TemplateEdgeSide => APPEARANCE_BORDER_SIDES.includes(entry));

      if (appearanceBoxModelTarget !== 'border') {
        setAppearanceTargetCorners([]);
        setAppearanceBoxModelTarget('border');
        return [side];
      }

      const nextSelection = normalizedPrevious.includes(side)
        ? normalizedPrevious.filter((entry) => entry !== side)
        : [...normalizedPrevious, side];

      if (nextSelection.length <= 0) {
        setAppearanceTargetCorners([]);
        setAppearanceBoxModelTarget('content');
        return [];
      }

      setAppearanceTargetCorners([]);
      setAppearanceBoxModelTarget('border');
      return nextSelection;
    });
  };
  const toggleCornerTargetSelectionFromClick = (corner: AppearanceCorner) => {
    setAppearanceTargetCorners((previous) => {
      const normalizedPrevious = previous.filter((entry): entry is AppearanceCorner => APPEARANCE_CORNERS.includes(entry));

      if (appearanceBoxModelTarget !== 'corner') {
        setAppearanceTargetBorderSides([]);
        setAppearanceBoxModelTarget('corner');
        return [corner];
      }

      const nextSelection = normalizedPrevious.includes(corner)
        ? normalizedPrevious.filter((entry) => entry !== corner)
        : [...normalizedPrevious, corner];

      if (nextSelection.length <= 0) {
        setAppearanceTargetBorderSides([]);
        setAppearanceBoxModelTarget('content');
        return [];
      }

      setAppearanceTargetBorderSides([]);
      setAppearanceBoxModelTarget('corner');
      return nextSelection;
    });
  };
  const selectBoxModelTarget = (
    event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>,
    target: AppearanceBoxModelTarget
  ) => {
    event.stopPropagation();
    activateAppearanceTargetMode(target, true);
  };
  const handleBoxModelTargetKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement | HTMLButtonElement>,
    target: AppearanceBoxModelTarget
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    activateAppearanceTargetMode(target, true);
  };
  const hintAppearanceModeForStyleField = (field: StyleFieldKey, nextValue?: string) => {
    const nextTarget = APPEARANCE_TARGET_BY_STYLE_FIELD[field];

    if (!nextTarget) {
      return;
    }

    if (!hasAppearanceSelection) {
      activateAppearanceTargetMode('content', true);
      return;
    }

    if (nextTarget === 'content') {
      activateAppearanceTargetMode('content', true);
      return;
    }

    const resolvedValue = typeof nextValue === 'string' ? nextValue : selectionStyleDraft[field];
    if ((nextTarget === 'border' || nextTarget === 'corner') && !String(resolvedValue || '').trim()) {
      const hasExplicitTargetSelection =
        nextTarget === 'border' ? appearanceTargetBorderSides.length > 0 : appearanceTargetCorners.length > 0;

      if (!hasExplicitTargetSelection) {
        activateAppearanceTargetMode('content', true);
      }
      return;
    }

    if (nextTarget === 'border' || nextTarget === 'corner') {
      activateAppearanceTargetMode(nextTarget);
      return;
    }

    setAppearanceBoxModelTarget(nextTarget);
  };
  const stopInlineControlEvent = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  const renderBorderSideTargetButton = (side: TemplateEdgeSide) => {
    const isSelected = appearanceTargetBorderSides.includes(side);
    const isActive = appearanceBoxModelTarget === 'border' && isSelected;
    const isVisible = appearanceBoxModelTarget === 'border';
    const sideClassName =
      side === 'top'
        ? 'left-3 right-3 top-[-8px] h-4 cursor-pointer'
        : side === 'bottom'
          ? 'left-3 right-3 bottom-[-8px] h-4 cursor-pointer'
          : side === 'left'
            ? 'bottom-3 left-[-8px] top-3 w-4 cursor-pointer'
            : 'bottom-3 right-[-8px] top-3 w-4 cursor-pointer';

    return (
      <button
        key={`appearance-border-side:${side}`}
        type="button"
        aria-label={`${APPEARANCE_BORDER_SIDE_LABELS[side]} 엣지 선택`}
        aria-pressed={isSelected}
        className={`absolute z-20 rounded-full border-0 p-0 transition-colors ${
          isVisible ? 'bg-sky-500/20 hover:bg-sky-500/25' : 'bg-transparent hover:bg-transparent'
        } ${sideClassName}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleBorderSideTargetSelectionFromClick(side);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            toggleBorderSideTargetSelectionFromClick(side);
          }
        }}
      >
        {isActive ? (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute ${
              side === 'top' || side === 'bottom'
                ? 'left-0 right-0 top-1/2 -translate-y-1/2 border-t-[3px] border-sky-500'
                : 'bottom-0 left-1/2 top-0 -translate-x-1/2 border-l-[3px] border-sky-500'
            }`}
            style={{
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            }}
          />
        ) : null}
      </button>
    );
  };
  const renderCornerTargetButton = (corner: AppearanceCorner) => {
    const isSelected = appearanceTargetCorners.includes(corner);
    const isActive = appearanceBoxModelTarget === 'corner' && isSelected;
    const isVisible = appearanceBoxModelTarget === 'corner';
    const cornerClassName =
      corner === 'top-left'
        ? 'left-[-8px] top-[-8px]'
        : corner === 'top-right'
          ? 'right-[-8px] top-[-8px]'
          : corner === 'bottom-right'
            ? 'bottom-[-8px] right-[-8px]'
            : 'bottom-[-8px] left-[-8px]';

    return (
      <button
        key={`appearance-corner:${corner}`}
        type="button"
        aria-label={`${APPEARANCE_CORNER_LABELS[corner]} 코너 선택`}
        aria-pressed={isSelected}
        className={`absolute z-20 h-4 w-4 rounded-full border-0 p-0 transition-colors ${
          isVisible ? 'bg-sky-500/20 hover:bg-sky-500/25' : 'bg-transparent hover:bg-transparent'
        } ${cornerClassName}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleCornerTargetSelectionFromClick(corner);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            toggleCornerTargetSelectionFromClick(corner);
          }
        }}
      >
        {isActive ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-sky-500"
            style={{
              boxShadow: '0 0 0 2px rgba(255,255,255,0.92)',
            }}
          />
        ) : null}
      </button>
    );
  };
  const resolveInlineStyleFieldStateClass = (field: StyleFieldKey, disabled = false) => {
    if (disabled) {
      return 'border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100';
    }

    const applyStatus = styleFieldApplyStatus[field];

    if (applyStatus === 'saved') {
      return 'border-emerald-400 bg-emerald-50 text-slate-900 hover:bg-emerald-100';
    }

    if (applyStatus === 'failed') {
      return 'border-red-400 bg-red-50 text-red-950 hover:bg-red-100';
    }

    if (applyStatus === 'saving') {
      return 'border-sky-300 bg-sky-50 text-slate-900 hover:bg-sky-100';
    }

    return 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
  };
  const renderInlineNumericInput = (
    field: StyleFieldKey,
    ariaLabel: string,
    widthClassName = 'w-32',
    shortLabel = ariaLabel,
    maxIntegerDigits?: number,
    showInlineLabel = true
  ) => {
    const draftValue = hasAppearanceSelection ? selectionStyleDraft[field] : '';
    const isDraftMixedValue = draftValue.trim() === MIXED_STYLE_VALUE_LABEL;
    const displayState = borderFieldDisplayState[field] || {
      value: isDraftMixedValue ? '' : draftValue,
      mixed: isDraftMixedValue,
    };
    const disabled = isStyleFieldDisabled(field);
    const inputStateClass = resolveInlineStyleFieldStateClass(field, disabled);
    const inputDefaultValue = hasAppearanceSelection
      ? displayState.mixed
        ? MIXED_STYLE_VALUE_LABEL
        : displayState.value
      : '';
    const inputKey = `inline-style:${field}:${hasAppearanceSelection ? 'selected' : 'empty'}:${
      displayState.mixed ? 'mixed' : displayState.value
    }:${selectionStyleDraft[field]}`;
    const inputPaddingClass = showInlineLabel
      ? 'pl-[18px] pr-[16px] sm:pl-[34px] sm:pr-4'
      : 'pl-2 pr-[16px] sm:pl-2 sm:pr-5';
    const normalizeNumericInputByIntegerDigits = (value: string) => {
      if (!maxIntegerDigits) {
        return value;
      }

      const numericOnly = value.replace(/[^\d.]/g, '');

      if (!numericOnly) {
        return '';
      }

      const hasDecimalPoint = numericOnly.includes('.');
      const [rawIntegerPart = '', ...fractionParts] = numericOnly.split('.');
      const integerPart = rawIntegerPart.slice(0, maxIntegerDigits);
      const fractionPart = fractionParts.join('');

      if (!hasDecimalPoint) {
        return integerPart;
      }

      const normalizedIntegerPart = integerPart || '0';

      if (numericOnly.endsWith('.') && !fractionPart) {
        return `${normalizedIntegerPart}.`;
      }

      return `${normalizedIntegerPart}.${fractionPart}`;
    };

    return (
      <span
        className={`relative inline-flex ${widthClassName} items-center`}
        onMouseDown={stopInlineControlEvent}
        onClick={stopInlineControlEvent}
      >
        {showInlineLabel ? (
          <span className="pointer-events-none absolute left-1 top-1/2 z-10 -translate-y-1/2 text-[10px] font-medium text-slate-500 sm:left-2">
            <span className="hidden sm:inline">{ariaLabel}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </span>
        ) : null}
        <Input
          key={inputKey}
          data-style-field={field}
          data-style-field-mixed={displayState.mixed ? 'true' : 'false'}
          defaultValue={inputDefaultValue}
          inputMode="decimal"
          aria-label={ariaLabel}
          title={ariaLabel}
          placeholder=""
          className={`h-8 w-full rounded-md border ${inputPaddingClass} text-center text-[11px] font-semibold disabled:opacity-100 ${inputStateClass}`}
          disabled={disabled}
          onInput={(event) => {
            if (!maxIntegerDigits) {
              return;
            }
            const inputElement = event.currentTarget;
            const normalizedValue = normalizeNumericInputByIntegerDigits(inputElement.value);
            if (normalizedValue !== inputElement.value) {
              inputElement.value = normalizedValue;
            }
          }}
          onFocus={() => {
            if (disabled) {
              return;
            }
            hintAppearanceModeForStyleField(field);
          }}
          onBlur={(event) => {
            if (disabled) {
              return;
            }
            const normalizedValue = normalizeNumericInputByIntegerDigits(event.currentTarget.value);
            if (normalizedValue !== event.currentTarget.value) {
              event.currentTarget.value = normalizedValue;
            }
            onApplyStyleFieldOnBlur(field, event.currentTarget.value, {
              mixedBlank: displayState.mixed && !event.currentTarget.value.trim(),
            });
            const nextTarget = APPEARANCE_TARGET_BY_STYLE_FIELD[field];
            if (nextTarget === 'border' || nextTarget === 'corner') {
              clearAppearanceTargetModeIfNoSelection(nextTarget);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-500 sm:right-1.5">
          px
        </span>
      </span>
    );
  };
  const normalizeAutoSizeMinimumInput = (value: string) => {
    const numericOnly = value.replace(/[^\d.]/g, '');

    if (!numericOnly) {
      return '';
    }

    const hasDecimalPoint = numericOnly.includes('.');
    const [rawIntegerPart = '', ...fractionParts] = numericOnly.split('.');
    const integerPart = rawIntegerPart.slice(0, 4);
    const fractionPart = fractionParts.join('');

    if (!hasDecimalPoint) {
      return integerPart;
    }

    const normalizedIntegerPart = integerPart || '0';

    if (numericOnly.endsWith('.') && !fractionPart) {
      return `${normalizedIntegerPart}.`;
    }

    return `${normalizedIntegerPart}.${fractionPart}`;
  };
  const renderInlineColorPicker = (
    field: AppearanceColorPickerField,
    fillWidth = false
  ) => {
    const displayState = borderFieldDisplayState[field] || {
      value: selectionStyleDraft[field] || (field === 'backgroundColor' ? 'transparent' : hasAppearanceSelection ? '#0f172a' : ''),
      mixed: false,
    };
    const selectedValue = hasAppearanceSelection ? (displayState.mixed ? '' : displayState.value || '') : '';
    const hasPresetOption = FRAME_STYLE_COLOR_OPTIONS.some(
      (option) => colorToHex(option.value) === colorToHex(selectedValue)
    );
    const customValue = selectedValue && !hasPresetOption ? selectedValue : '';
    const disabled = isStyleFieldDisabled(field);
    const selectClassName = resolveInlineStyleFieldStateClass(field, disabled);

    return (
      <div
        className={`relative inline-flex min-w-0 w-full ${fillWidth ? '' : 'sm:w-auto'}`}
        onMouseDown={stopInlineControlEvent}
        onClick={stopInlineControlEvent}
      >
        <select
          data-style-field={field}
          disabled={disabled}
          value={selectedValue}
          className={`h-8 w-full min-w-0 rounded-md border px-2 text-[11px] font-semibold ${selectClassName}`}
          onFocus={() => {
            if (disabled) {
              return;
            }
            hintAppearanceModeForStyleField(field);
          }}
          onChange={(event) => {
            if (disabled) {
              return;
            }
            const nextValue = event.target.value.trim();
            if (!nextValue) {
              return;
            }
            const selectElement = event.currentTarget;
            window.requestAnimationFrame(() => {
              selectElement.value = nextValue;
            });
            onApplyStyleFieldImmediateValue(field, nextValue);
          }}
          onBlur={() => {
            const nextAppearanceTarget = APPEARANCE_TARGET_BY_STYLE_FIELD[field];
            if (nextAppearanceTarget === 'border' || nextAppearanceTarget === 'corner') {
              clearAppearanceTargetModeIfNoSelection(nextAppearanceTarget);
            }
          }}
          aria-label={field === 'backgroundColor' ? '배경 색 선택' : '선 색 선택'}
        >
          <option value="" disabled={hasAppearanceSelection && !displayState.mixed}>
            {displayState.mixed ? '혼합' : hasAppearanceSelection ? '선택' : '선택 없음'}
          </option>
          {customValue ? <option value={customValue}>{customValue}</option> : null}
          {FRAME_STYLE_COLOR_OPTIONS.map((option) => (
            <option key={`inline-style-color-option:${field}:${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };
  const renderInlineBorderAlignPicker = () => {
    const displayState = borderFieldDisplayState.borderAlign || {
      value: hasAppearanceSelection ? selectionStyleDraft.borderAlign : '',
      mixed: false,
    };
    const selectedValue = hasAppearanceSelection ? (displayState.mixed ? '' : displayState.value || '') : '';
    const hasPresetOption = FRAME_BORDER_ALIGN_OPTIONS.some((option) => option.value === selectedValue);
    const customValue = selectedValue && !hasPresetOption ? selectedValue : '';
    const disabled = isStyleFieldDisabled('borderAlign');
    return (
      <div className="relative inline-flex min-w-0 w-full" onMouseDown={stopInlineControlEvent} onClick={stopInlineControlEvent}>
        <select
          data-style-field="borderAlign"
          disabled={disabled}
          value={selectedValue}
          className={`h-8 w-full min-w-0 rounded-md border px-2 text-[11px] font-semibold ${resolveInlineStyleFieldStateClass('borderAlign', disabled)}`}
          onFocus={() => {
            if (disabled) {
              return;
            }
            hintAppearanceModeForStyleField('borderAlign');
          }}
          onChange={(event) => {
            if (disabled) {
              return;
            }
            const nextValue = event.target.value.trim();
            if (!nextValue) {
              return;
            }
            const selectElement = event.currentTarget;
            window.requestAnimationFrame(() => {
              selectElement.value = nextValue;
            });
            onApplyStyleFieldImmediateValue('borderAlign', nextValue);
          }}
          onBlur={() => {
            if (!disabled) {
              clearAppearanceTargetModeIfNoSelection('border');
            }
          }}
        >
          <option value="" disabled={hasAppearanceSelection && !displayState.mixed}>
            {displayState.mixed ? '혼합' : hasAppearanceSelection ? '선택' : '선택 없음'}
          </option>
          {customValue ? <option value={customValue}>{customValue}</option> : null}
          {FRAME_BORDER_ALIGN_OPTIONS.map((option) => (
            <option key={`inline-style-border-align-option:${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };
  const renderInlineBorderStylePicker = () => {
    const displayState = borderFieldDisplayState.borderStyle || {
      value: hasAppearanceSelection ? selectionStyleDraft.borderStyle : '',
      mixed: false,
    };
    const currentBorderStyleValue = hasAppearanceSelection ? (displayState.mixed ? '' : displayState.value || '') : '';
    const borderStyleDisabled = isStyleFieldDisabled('borderStyle');
    const hasPresetOption = FRAME_BORDER_STYLE_OPTIONS.some((option) => option.value === currentBorderStyleValue);
    const customValue = currentBorderStyleValue && !hasPresetOption ? currentBorderStyleValue : '';

    return (
      <div className="relative inline-flex min-w-0 w-full" onMouseDown={stopInlineControlEvent} onClick={stopInlineControlEvent}>
        <select
          data-style-field="borderStyle"
          disabled={borderStyleDisabled}
          value={currentBorderStyleValue}
          className={`h-8 w-full min-w-0 rounded-md border px-2 text-[11px] font-semibold ${resolveInlineStyleFieldStateClass('borderStyle', borderStyleDisabled)}`}
          onFocus={() => {
            if (borderStyleDisabled) {
              return;
            }
            hintAppearanceModeForStyleField('borderStyle');
          }}
          onChange={(event) => {
            if (borderStyleDisabled) {
              return;
            }
            const nextValue = event.target.value.trim();
            if (!nextValue) {
              return;
            }
            const selectElement = event.currentTarget;
            window.requestAnimationFrame(() => {
              selectElement.value = nextValue;
            });
            onApplyStyleFieldImmediateValue('borderStyle', nextValue);
          }}
          onBlur={() => {
            if (!borderStyleDisabled) {
              clearAppearanceTargetModeIfNoSelection('border');
            }
          }}
        >
          <option value="" disabled={hasAppearanceSelection && !displayState.mixed}>
            {displayState.mixed ? '혼합' : hasAppearanceSelection ? '선택' : '선택 없음'}
          </option>
          {customValue ? <option value={customValue}>{customValue}</option> : null}
          {FRAME_BORDER_STYLE_OPTIONS.map((option) => (
            <option key={`border-style-option:${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <>
      <div ref={handleSelectionAppearanceToolbarRef} className="inline-flex self-start max-w-full flex-col gap-2">
        <div className="grid w-full min-w-0 max-w-full grid-cols-2 items-center gap-2 self-stretch">
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              선 두께
              <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field="borderWidth" />
            </label>
            {renderInlineNumericInput('borderWidth', '선 두께', 'w-full min-w-0', 'LW', 3, false)}
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              코너 라운딩
              <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field="borderRadius" />
            </label>
            {renderInlineNumericInput('borderRadius', '코너 라운딩', 'w-full min-w-0', 'CR', 3, false)}
          </div>
        </div>
        <div className="grid w-full min-w-0 max-w-full grid-cols-3 items-center gap-2 self-stretch">
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              선 색
              <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field="borderColor" />
            </label>
            {renderInlineColorPicker('borderColor', true)}
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              선 종류
              <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field="borderStyle" />
            </label>
            {renderInlineBorderStylePicker()}
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              선 정렬
              <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field="borderAlign" />
            </label>
            {renderInlineBorderAlignPicker()}
          </div>
        </div>
      </div>
      <div className="w-full min-w-0 max-w-full space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">상자 크기 및 배경</label>
        <div className="rounded-md bg-slate-50 p-2">
          <div
            role="button"
            tabIndex={0}
            className={`${boxModelZoneClass()} min-w-0 max-w-full overflow-visible rounded-xl`}
            aria-label="외곽선 및 상자 출력 형식 편집"
            style={{
              boxSizing: 'border-box',
              width: selectionAppearancePreviewWidthPx ? `${selectionAppearancePreviewWidthPx}px` : 'fit-content',
              maxWidth: '100%',
              ...previewCornerRadiusStyle,
              ...previewBorderPresentationStyle,
            }}
            onClick={(event) => selectBoxModelTarget(event, 'border')}
            onKeyDown={(event) => handleBoxModelTargetKeyDown(event, 'border')}
          >
            {previewDashedGuideStyle ? <div aria-hidden="true" className="absolute z-0" style={previewDashedGuideStyle} /> : null}
            {APPEARANCE_BORDER_SIDES.map((side) => renderBorderSideTargetButton(side))}
            {APPEARANCE_CORNERS.map((corner) => renderCornerTargetButton(corner))}
            <div
              className="group/content relative z-10 flex min-h-[96px] min-w-full items-center justify-center text-center text-sm font-semibold text-slate-900"
              style={{
                ...(backgroundColorValue === 'transparent'
                  ? transparentFillStyle
                  : { backgroundColor: backgroundColorValue }),
                width: '100%',
                maxWidth: '100%',
                minHeight: `${visualContentHeight}px`,
                ...previewCornerRadiusStyle,
                overflow: 'hidden',
              }}
              onMouseDown={stopInlineControlEvent}
              onClick={stopInlineControlEvent}
            >
              <div
                className="relative flex w-full min-w-0 max-w-full flex-col gap-2 rounded-md px-5 py-5"
                onMouseDown={stopInlineControlEvent}
                onClick={stopInlineControlEvent}
              >
                <div className="w-full">{renderInlineColorPicker('backgroundColor', true)}</div>
                <div className="grid w-full min-w-0 max-w-full grid-cols-2 items-center gap-2">
                  {renderInlineNumericInput('height', '높이', 'w-full min-w-0', 'H', 3)}
                  {renderInlineNumericInput('width', '너비', 'w-full min-w-0', 'W', 3)}
                </div>
                {autoSizeMinimumDisplayState ? (
                  <span
                    className="relative inline-flex w-full items-center"
                    onMouseDown={stopInlineControlEvent}
                    onClick={stopInlineControlEvent}
                  >
                    <span className="pointer-events-none absolute left-1 top-1/2 z-10 -translate-y-1/2 text-[10px] font-medium text-slate-500 sm:left-2">
                      <span className="hidden sm:inline">{autoSizeMinimumDisplayState.label}</span>
                      <span className="sm:hidden">{autoSizeMinimumDisplayState.axis === 'height' ? 'MH' : 'MW'}</span>
                    </span>
                    <Input
                      key={`inline-style:auto-size-minimum:${autoSizeMinimumDisplayState.axis}:${autoSizeMinimumDisplayState.mixed ? 'mixed' : autoSizeMinimumDisplayState.value}`}
                      defaultValue={autoSizeMinimumDisplayState.mixed ? MIXED_STYLE_VALUE_LABEL : autoSizeMinimumDisplayState.value}
                      inputMode="decimal"
                      aria-label={autoSizeMinimumDisplayState.label}
                      title={autoSizeMinimumDisplayState.label}
                      className={`h-8 w-full rounded-md border pl-[18px] pr-[16px] text-center text-[11px] font-semibold disabled:opacity-100 sm:pl-[34px] sm:pr-4 ${
                        resolveInlineStyleFieldStateClass(autoSizeMinimumDisplayState.axis === 'height' ? 'height' : 'width')
                      }`}
                      onInput={(event) => {
                        const inputElement = event.currentTarget;
                        const normalizedValue = normalizeAutoSizeMinimumInput(inputElement.value);
                        if (normalizedValue !== inputElement.value) {
                          inputElement.value = normalizedValue;
                        }
                      }}
                      onBlur={(event) => {
                        const normalizedValue = normalizeAutoSizeMinimumInput(event.currentTarget.value);
                        if (normalizedValue !== event.currentTarget.value) {
                          event.currentTarget.value = normalizedValue;
                        }

                        if (!normalizedValue.trim()) {
                          return;
                        }

                        const parsedValue = Number.parseFloat(normalizedValue);
                        if (!Number.isFinite(parsedValue)) {
                          onMessage(
                            autoSizeMinimumDisplayState.axis === 'height'
                              ? '최소 높이 값을 확인하세요.'
                              : '최소 너비 값을 확인하세요.'
                          );
                          return;
                        }

                        if (!autoSizeMinimumDisplayState.mixed) {
                          const currentValue = Number.parseFloat(autoSizeMinimumDisplayState.value);
                          if (Number.isFinite(currentValue) && Math.abs(currentValue - parsedValue) <= 0.001) {
                            return;
                          }
                        }

                        onSetTextAutoSizeMinimumForSelection(autoSizeMinimumDisplayState.axis, parsedValue);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-500 sm:right-1.5">
                      px
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
