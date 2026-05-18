'use client';

import * as React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { Input } from '../../../ui/Input';
import {
  APPEARANCE_PADDING_FIELD_BY_SIDE,
  APPEARANCE_PADDING_LABEL_BY_SIDE,
  APPEARANCE_PADDING_SIDES,
  MIXED_PADDING_DISPLAY_LABEL,
  MIXED_STYLE_VALUE_LABEL,
} from '../constants';
import type {
  SelectedTextAutoSizeState,
  SelectionStyleDraft,
  SizeMatchSourceKind,
  SizeMatchTargetKind,
  StyleFieldKey,
  TextAutoSizeAnchorSide,
  TextAutoSizeMode,
} from '../types';
import { StyleApplyStatusIcon, type StyleFieldApplyStatusMap } from './StyleApplyStatusIcon';

type TemplatePositionBoxSizeOverlayProps = {
  selectedFrameGroupIds: string[];
  selectedPositionResolvedFrameGroupIds: string[];
  selectionStyleDraft: SelectionStyleDraft;
  styleFieldApplyStatus: StyleFieldApplyStatusMap;
  stylePanelRef: React.MutableRefObject<HTMLDivElement | null>;
  selectedTextAutoSizeState: SelectedTextAutoSizeState;
  sizeMatchSourceKind: SizeMatchSourceKind;
  sizeMatchTargetKind: SizeMatchTargetKind;
  sizeMatchSourceFrameGroupId: string;
  textAutoSizePointerHandledRef: React.MutableRefObject<boolean>;
  onSizeMatchSourceKindChange: (nextKind: SizeMatchSourceKind) => void;
  onSizeMatchTargetKindChange: (nextKind: SizeMatchTargetKind) => void;
  onSizeMatchSourceFrameGroupIdChange: (nextId: string) => void;
  onSizeMatchSourcePickModeChange: (nextEnabled: boolean) => void;
  onMessage: (message: string) => void;
  onWriteTextAutoSizeDescriptionDomState: (mode: TextAutoSizeMode | 'mixed', side?: TextAutoSizeAnchorSide) => void;
  onPreviewTextAutoSizeModeDomState: (mode: TextAutoSizeMode) => void;
  onSetTextAutoSizeModeForSelection: (mode: TextAutoSizeMode) => void;
  onPreviewTextAutoSizeAnchorDomState: (side: TextAutoSizeAnchorSide) => void;
  onSetTextAutoSizeModeAndAnchorForSelection: (
    mode: Extract<TextAutoSizeMode, 'height' | 'width'>,
    side: TextAutoSizeAnchorSide
  ) => void;
  onFitTextAutoSizeSecondaryAxisForSelection: (axis: 'height' | 'width') => void;
  onMatchSelectionDimensionFromSource: (frameGroupId: string, target: SizeMatchTargetKind) => void;
  onApplyStyleFieldOnBlur: (field: StyleFieldKey, value?: string, options?: { mixedBlank?: boolean }) => void;
};

export const TemplatePositionBoxSizeOverlay = ({
  selectedFrameGroupIds,
  selectedPositionResolvedFrameGroupIds,
  selectionStyleDraft,
  styleFieldApplyStatus,
  stylePanelRef,
  selectedTextAutoSizeState,
  sizeMatchSourceKind,
  sizeMatchTargetKind,
  sizeMatchSourceFrameGroupId,
  textAutoSizePointerHandledRef,
  onSizeMatchSourceKindChange,
  onSizeMatchTargetKindChange,
  onSizeMatchSourceFrameGroupIdChange,
  onSizeMatchSourcePickModeChange,
  onMessage,
  onWriteTextAutoSizeDescriptionDomState,
  onPreviewTextAutoSizeModeDomState,
  onSetTextAutoSizeModeForSelection,
  onPreviewTextAutoSizeAnchorDomState,
  onSetTextAutoSizeModeAndAnchorForSelection,
  onFitTextAutoSizeSecondaryAxisForSelection,
  onMatchSelectionDimensionFromSource,
  onApplyStyleFieldOnBlur,
}: TemplatePositionBoxSizeOverlayProps) => {
  const activeStyleSelectionIds =
    selectedPositionResolvedFrameGroupIds.length > 0 ? selectedPositionResolvedFrameGroupIds : selectedFrameGroupIds;
  const hasSelection = activeStyleSelectionIds.length > 0;
  const autoSizeRowToneClass = (active: boolean) =>
    `inline-flex items-center justify-center text-[11px] font-semibold transition ${
      active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
    }`;
  const autoSizeModeButtonClass = (active: boolean) =>
    `${autoSizeRowToneClass(active)} h-10 w-full min-w-0 justify-start overflow-hidden px-2.5 text-left`;
  const autoSizeModeWithAuxButtonClass = (active: boolean) => `${autoSizeModeButtonClass(active)} pr-14`;
  const autoSizeInlineActionGroupClass =
    'inline-flex h-[30px] items-stretch overflow-hidden rounded-md border border-slate-300 bg-white';
  const autoSizeInlineActionButtonClass = (active: boolean, withLeftBorder = true, disabled = false) =>
    `inline-flex h-full w-5 items-center justify-center p-0 transition ${
      withLeftBorder ? 'border-l border-slate-300' : ''
    } ${
      disabled
        ? 'cursor-not-allowed bg-slate-100 text-slate-400 hover:bg-slate-100'
        : active
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100'
    }`;

  if (!hasSelection) {
    return null;
  }

  const highlightClassName = 'rounded bg-sky-100 px-1 py-0.5 font-semibold text-sky-900';
  const autoSizeDescriptionParts = (() => {
    if (selectedTextAutoSizeState.allHeight) {
      const directionLabel = selectedTextAutoSizeState.heightAnchorSideMixed
        ? '위/아래쪽'
        : selectedTextAutoSizeState.heightAnchorSide === 'top'
          ? '위쪽'
          : '아래쪽';
      return { primary: directionLabel, middle: '으로 ', axis: '높이', tail: '가 늘어나는 상자' };
    }

    if (selectedTextAutoSizeState.allWidth) {
      const directionLabel = selectedTextAutoSizeState.widthAnchorSideMixed
        ? '왼쪽/오른쪽'
        : selectedTextAutoSizeState.widthAnchorSide === 'left'
          ? '왼쪽'
          : '오른쪽';
      return { primary: directionLabel, middle: '으로 ', axis: '너비', tail: '가 늘어나는 상자' };
    }

    if (selectedTextAutoSizeState.allFixed) {
      return { primary: '고정 크기', middle: ' ', axis: '', tail: '상자' };
    }

    return { primary: '상자 타입', middle: '이 서로 다른 상태', axis: '', tail: '' };
  })();
  const autoSizeDescription = (
    <p className="text-[11px] leading-5 text-slate-700" data-text-autosize-description="true">
      <span className="text-slate-500">→</span>{' '}
      <span className={highlightClassName} data-text-autosize-description-primary="true">
        {autoSizeDescriptionParts.primary}
      </span>
      <span data-text-autosize-description-middle="true">{autoSizeDescriptionParts.middle}</span>
      <span className={highlightClassName} data-text-autosize-description-axis="true">
        {autoSizeDescriptionParts.axis}
      </span>
      <span data-text-autosize-description-tail="true">{autoSizeDescriptionParts.tail}</span>
    </p>
  );

  const needsSourceBoxPick = sizeMatchSourceKind === 'selected-box' && !sizeMatchSourceFrameGroupId.trim();
  const sizeMatchTargetDisabled = needsSourceBoxPick;
  const applySizeMatchWithTarget = (target: SizeMatchTargetKind) => {
    onSizeMatchTargetKindChange(target);
    if (sizeMatchSourceKind === 'content') {
      if (target === 'width' || target === 'both') {
        onFitTextAutoSizeSecondaryAxisForSelection('width');
      }
      if (target === 'height' || target === 'both') {
        onFitTextAutoSizeSecondaryAxisForSelection('height');
      }
      return;
    }

    const normalizedSourceFrameGroupId = sizeMatchSourceFrameGroupId.trim();
    if (!normalizedSourceFrameGroupId) {
      onMessage('기준 상자를 캔버스에서 선택하세요.');
      return;
    }

    onMatchSelectionDimensionFromSource(normalizedSourceFrameGroupId, target);
  };
  const resolvePreviewAutoSizeAnchorSide = (mode: TextAutoSizeMode): TextAutoSizeAnchorSide | undefined => {
    if (mode === 'height') {
      return selectedTextAutoSizeState.heightAnchorSide === 'top' ? 'top' : 'bottom';
    }

    if (mode === 'width') {
      return selectedTextAutoSizeState.widthAnchorSide === 'left' ? 'left' : 'right';
    }

    return undefined;
  };
  const handleTextAutoSizeModeControl = (mode: TextAutoSizeMode) => {
    onWriteTextAutoSizeDescriptionDomState(mode, resolvePreviewAutoSizeAnchorSide(mode));
    onPreviewTextAutoSizeModeDomState(mode);
    onSetTextAutoSizeModeForSelection(mode);
  };
  const handleTextAutoSizeModePointerDown = (event: React.PointerEvent<HTMLButtonElement>, mode: TextAutoSizeMode) => {
    if (event.button !== 0) {
      return;
    }

    textAutoSizePointerHandledRef.current = true;
    handleTextAutoSizeModeControl(mode);
  };
  const handleTextAutoSizeModeClick = (mode: TextAutoSizeMode) => {
    if (textAutoSizePointerHandledRef.current) {
      textAutoSizePointerHandledRef.current = false;
      return;
    }

    handleTextAutoSizeModeControl(mode);
  };
  const handleTextAutoSizeAnchorControl = (
    mode: Extract<TextAutoSizeMode, 'height' | 'width'>,
    side: TextAutoSizeAnchorSide
  ) => {
    onWriteTextAutoSizeDescriptionDomState(mode, side);
    onPreviewTextAutoSizeAnchorDomState(side);
    onSetTextAutoSizeModeAndAnchorForSelection(mode, side);
  };
  const handleTextAutoSizeAnchorPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    mode: Extract<TextAutoSizeMode, 'height' | 'width'>,
    side: TextAutoSizeAnchorSide
  ) => {
    if (event.button !== 0) {
      return;
    }

    textAutoSizePointerHandledRef.current = true;
    handleTextAutoSizeAnchorControl(mode, side);
  };
  const handleTextAutoSizeAnchorClick = (
    mode: Extract<TextAutoSizeMode, 'height' | 'width'>,
    side: TextAutoSizeAnchorSide
  ) => {
    if (textAutoSizePointerHandledRef.current) {
      textAutoSizePointerHandledRef.current = false;
      return;
    }

    handleTextAutoSizeAnchorControl(mode, side);
  };

  const renderTextAutoSizeControls = (section: 'boxType' | 'sizeMatch') => {
    if (section === 'boxType') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <span>상자 타입</span>
            {autoSizeDescription}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 w-full">
              <div className="relative min-w-0 w-full overflow-hidden rounded-md border border-slate-300 bg-white">
                <button
                  type="button"
                  data-text-autosize-mode-button="height"
                  className={autoSizeModeWithAuxButtonClass(selectedTextAutoSizeState.allHeight)}
                  onPointerDown={(event) => handleTextAutoSizeModePointerDown(event, 'height')}
                  onClick={() => handleTextAutoSizeModeClick('height')}
                >
                  <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">자동 높이</span>
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <div className={autoSizeInlineActionGroupClass}>
                    <button
                      type="button"
                      data-text-autosize-action-mode="height"
                      data-text-autosize-action-value="top"
                      className={autoSizeInlineActionButtonClass(
                        selectedTextAutoSizeState.allHeight &&
                          selectedTextAutoSizeState.heightAnchorSide === 'top' &&
                          !selectedTextAutoSizeState.heightAnchorSideMixed,
                        false
                      )}
                      onPointerDown={(event) => handleTextAutoSizeAnchorPointerDown(event, 'height', 'top')}
                      onClick={() => handleTextAutoSizeAnchorClick('height', 'top')}
                      aria-label="위로 확장"
                      title="위로 확장"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      data-text-autosize-action-mode="height"
                      data-text-autosize-action-value="bottom"
                      className={autoSizeInlineActionButtonClass(
                        selectedTextAutoSizeState.allHeight &&
                          selectedTextAutoSizeState.heightAnchorSide === 'bottom' &&
                          !selectedTextAutoSizeState.heightAnchorSideMixed
                      )}
                      onPointerDown={(event) => handleTextAutoSizeAnchorPointerDown(event, 'height', 'bottom')}
                      onClick={() => handleTextAutoSizeAnchorClick('height', 'bottom')}
                      aria-label="아래로 확장"
                      title="아래로 확장"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-0 w-full">
              <div className="relative min-w-0 w-full overflow-hidden rounded-md border border-slate-300 bg-white">
                <button
                  type="button"
                  data-text-autosize-mode-button="width"
                  className={autoSizeModeWithAuxButtonClass(selectedTextAutoSizeState.allWidth)}
                  onPointerDown={(event) => handleTextAutoSizeModePointerDown(event, 'width')}
                  onClick={() => handleTextAutoSizeModeClick('width')}
                >
                  <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">자동 너비</span>
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <div className={autoSizeInlineActionGroupClass}>
                    <button
                      type="button"
                      data-text-autosize-action-mode="width"
                      data-text-autosize-action-value="left"
                      className={autoSizeInlineActionButtonClass(
                        selectedTextAutoSizeState.allWidth &&
                          selectedTextAutoSizeState.widthAnchorSide === 'left' &&
                          !selectedTextAutoSizeState.widthAnchorSideMixed,
                        false
                      )}
                      onPointerDown={(event) => handleTextAutoSizeAnchorPointerDown(event, 'width', 'left')}
                      onClick={() => handleTextAutoSizeAnchorClick('width', 'left')}
                      aria-label="왼쪽으로 확장"
                      title="왼쪽으로 확장"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      data-text-autosize-action-mode="width"
                      data-text-autosize-action-value="right"
                      className={autoSizeInlineActionButtonClass(
                        selectedTextAutoSizeState.allWidth &&
                          selectedTextAutoSizeState.widthAnchorSide === 'right' &&
                          !selectedTextAutoSizeState.widthAnchorSideMixed
                      )}
                      onPointerDown={(event) => handleTextAutoSizeAnchorPointerDown(event, 'width', 'right')}
                      onClick={() => handleTextAutoSizeAnchorClick('width', 'right')}
                      aria-label="오른쪽으로 확장"
                      title="오른쪽으로 확장"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              data-text-autosize-mode-button="fixed"
              className={`${autoSizeRowToneClass(selectedTextAutoSizeState.allFixed)} col-span-2 h-10 w-full justify-center rounded-md border border-slate-300`}
              onPointerDown={(event) => handleTextAutoSizeModePointerDown(event, 'fixed')}
              onClick={() => handleTextAutoSizeModeClick('fixed')}
            >
              고정
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">크기 맞추기</label>
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1">
            <div className="min-w-0">
              <select
                value={sizeMatchSourceKind}
                className="flex h-7 w-full rounded-md border border-input bg-white px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onChange={(event) => {
                  const nextSourceKind = event.target.value as SizeMatchSourceKind;
                  onSizeMatchSourceKindChange(nextSourceKind);
                  if (nextSourceKind === 'content') {
                    onSizeMatchSourcePickModeChange(false);
                    return;
                  }
                  onSizeMatchSourceFrameGroupIdChange('');
                  onSizeMatchSourcePickModeChange(true);
                  onMessage('기준 상자를 캔버스에서 1개 선택하세요.');
                }}
              >
                <option value="content">내용</option>
                <option value="selected-box">선택 상자</option>
              </select>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">에</span>
            <div className="min-w-0">
              <select
                value={sizeMatchTargetKind}
                disabled={sizeMatchTargetDisabled}
                className={`flex h-7 w-full rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  sizeMatchTargetDisabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : 'border-input bg-white text-slate-700'
                }`}
                onChange={(event) => {
                  onSizeMatchTargetKindChange(event.target.value as SizeMatchTargetKind);
                }}
              >
                <option value="height">높이</option>
                <option value="width">너비</option>
                <option value="both">높이와 너비</option>
              </select>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">맞추기</span>
          </div>
          <button
            type="button"
            className={`inline-flex h-8 w-full items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition ${
              sizeMatchTargetDisabled
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => applySizeMatchWithTarget(sizeMatchTargetKind)}
            disabled={sizeMatchTargetDisabled}
          >
            실행
          </button>
          {sizeMatchSourceKind === 'selected-box' ? (
            <p className="text-[11px] text-slate-600">
              {needsSourceBoxPick ? '기준 상자를 캔버스에서 1개 선택하세요.' : `기준 상자: ${sizeMatchSourceFrameGroupId}`}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  const renderTextPaddingControls = () => {
    const paddingFieldsBySide = APPEARANCE_PADDING_SIDES.map((side) => {
      const field = APPEARANCE_PADDING_FIELD_BY_SIDE[side];
      const rawValue = hasSelection ? String(selectionStyleDraft[field] || '') : '';
      const isMixed = hasSelection && rawValue.trim() === MIXED_STYLE_VALUE_LABEL;
      const displayValue = isMixed ? MIXED_PADDING_DISPLAY_LABEL : rawValue;
      const hasValue = displayValue.trim().length > 0;
      const state: 'disabled' | 'mixed' | 'active' = !hasSelection ? 'disabled' : isMixed ? 'mixed' : hasValue ? 'active' : 'disabled';

      return {
        side,
        field,
        label: APPEARANCE_PADDING_LABEL_BY_SIDE[side],
        isMixed,
        displayValue,
        state,
      };
    });
    const paddingStatusField =
      (paddingFieldsBySide.find((entry) => styleFieldApplyStatus[entry.field] === 'saving')?.field as StyleFieldKey | undefined) ||
      'paddingTop';
    const paddingSideButtonClassByState = (state: 'disabled' | 'mixed' | 'active') => {
      if (state === 'active') {
        return 'border-slate-950 bg-slate-950 text-white';
      }
      if (state === 'mixed') {
        return 'border-slate-300 bg-slate-300 text-slate-700';
      }
      return 'border-slate-300 bg-white text-slate-400';
    };
    const paddingInputClassByState = (state: 'disabled' | 'mixed' | 'active') => {
      if (state === 'mixed') {
        return 'border-slate-300 bg-slate-200 text-slate-700';
      }
      if (state === 'active') {
        return 'border-slate-300 bg-white text-slate-900';
      }
      return 'border-slate-300 bg-white text-slate-400';
    };

    return (
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          여백
          <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field={paddingStatusField} />
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {paddingFieldsBySide.map(({ side, field, label, isMixed, displayValue, state }) => (
            <div key={`text-padding-field:${side}`} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-1">
              <button
                type="button"
                className={`inline-flex h-7 w-14 items-center justify-center rounded-md border text-[11px] font-semibold transition ${paddingSideButtonClassByState(state)}`}
                disabled={!hasSelection}
                onClick={() => {
                  if (!hasSelection) {
                    return;
                  }
                  const input = stylePanelRef.current?.querySelector<HTMLInputElement>(`[data-style-field="${field}"]`);
                  input?.focus();
                }}
              >
                {label}
              </button>
              <div className="relative">
                <Input
                  key={`text-padding:${field}:${hasSelection ? 'selected' : 'empty'}:${selectionStyleDraft[field]}`}
                  data-style-field={field}
                  data-style-field-mixed={isMixed ? 'true' : 'false'}
                  defaultValue={hasSelection ? displayValue : ''}
                  inputMode="decimal"
                  placeholder={hasSelection ? (isMixed ? MIXED_PADDING_DISPLAY_LABEL : '0') : ''}
                  disabled={!hasSelection}
                  className={`h-7 pr-7 text-xs disabled:opacity-100 ${paddingInputClassByState(state)}`}
                  onFocus={(event) => {
                    if (isMixed && event.currentTarget.value.trim() === MIXED_PADDING_DISPLAY_LABEL) {
                      event.currentTarget.value = '';
                    }
                  }}
                  onBlur={(event) => {
                    const normalizedValue = event.currentTarget.value.trim();
                    if (isMixed && (!normalizedValue || normalizedValue === MIXED_PADDING_DISPLAY_LABEL)) {
                      onApplyStyleFieldOnBlur(field, '', { mixedBlank: true });
                      return;
                    }
                    onApplyStyleFieldOnBlur(field, event.currentTarget.value, {
                      mixedBlank: isMixed && !normalizedValue,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                  px
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {renderTextAutoSizeControls('boxType')}
      {renderTextPaddingControls()}
      {renderTextAutoSizeControls('sizeMatch')}
    </div>
  );
};
