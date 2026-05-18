'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  Underline,
} from 'lucide-react';
import * as React from 'react';
import { Input } from '../../../ui/Input';
import { FRAME_STYLE_COLOR_OPTIONS, RICH_TEXT_FONT_FAMILY_OPTIONS } from '../constants';
import type { SelectionStyleDraft, StyleFieldKey } from '../types';
import { hasTextDecorationToken, toggleTextDecorationTokenValue } from '../utils';
import { StyleApplyStatusIcon, type StyleFieldApplyStatusMap } from './StyleApplyStatusIcon';

type TemplatePositionTextStyleOverlayProps = {
  selectedFrameGroupIds: string[];
  selectedPositionResolvedFrameGroupIds: string[];
  selectionStyleDraft: SelectionStyleDraft;
  styleFieldApplyStatus: StyleFieldApplyStatusMap;
  onApplyStyleFieldImmediateValue: (field: StyleFieldKey, value: string) => void;
  onApplyStyleFieldOnBlur: (field: StyleFieldKey, value?: string, options?: { mixedBlank?: boolean }) => void;
  onColorToHex: (value: string) => string;
};

export const TemplatePositionTextStyleOverlay = ({
  selectedFrameGroupIds,
  selectedPositionResolvedFrameGroupIds,
  selectionStyleDraft,
  styleFieldApplyStatus,
  onApplyStyleFieldImmediateValue,
  onApplyStyleFieldOnBlur,
  onColorToHex,
}: TemplatePositionTextStyleOverlayProps) => {
  const activeStyleSelectionIds =
    selectedPositionResolvedFrameGroupIds.length > 0 ? selectedPositionResolvedFrameGroupIds : selectedFrameGroupIds;
  const hasSelection = activeStyleSelectionIds.length > 0;
  const currentFontFamily = selectionStyleDraft.fontFamily || '';
  const hasCustomFontFamily =
    Boolean(currentFontFamily) &&
    !RICH_TEXT_FONT_FAMILY_OPTIONS.some((option) => option.value === currentFontFamily);
  const fontWeightValue = selectionStyleDraft.fontWeight.trim().toLowerCase();
  const isBold =
    fontWeightValue === 'bold' || (Number.isFinite(Number.parseInt(fontWeightValue, 10)) && Number.parseInt(fontWeightValue, 10) >= 600);
  const isItalic = selectionStyleDraft.fontStyle.trim().toLowerCase() === 'italic';
  const isUnderline = hasTextDecorationToken(selectionStyleDraft.textDecorationLine, 'underline');
  const isStrikeThrough = hasTextDecorationToken(selectionStyleDraft.textDecorationLine, 'line-through');
  const styleButtonClass = (active: boolean) =>
    `inline-flex h-8 items-center justify-center border-r border-slate-200 text-xs font-semibold transition last:border-r-0 ${
      active
        ? 'bg-slate-950 text-white'
        : 'bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
    }`;

  const renderStyleColorPicker = (field: 'color', label: string) => {
    const fallbackValue = '#0f172a';
    const draftValue = selectionStyleDraft[field].trim();
    const selectedValue = hasSelection ? draftValue || fallbackValue : '';
    const hasPresetOption = FRAME_STYLE_COLOR_OPTIONS.some((option) => onColorToHex(option.value) === onColorToHex(selectedValue));
    const customValue = selectedValue && !hasPresetOption ? selectedValue : '';

    return (
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          {label}
          <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field={field} />
        </label>
        <select
          data-style-field={field}
          value={selectedValue}
          disabled={!hasSelection}
          onChange={(event) => {
            const nextValue = event.target.value;
            const selectElement = event.currentTarget;
            window.requestAnimationFrame(() => {
              selectElement.value = nextValue;
            });
            onApplyStyleFieldImmediateValue(field, nextValue);
          }}
          className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="" disabled={hasSelection}>
            {hasSelection ? '선택' : '선택 없음'}
          </option>
          {customValue ? <option value={customValue}>{customValue}</option> : null}
          {FRAME_STYLE_COLOR_OPTIONS.map((option) => (
            <option key={`style-color-option:${field}:${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderRichTextNumericInput = (
    field: 'fontSize' | 'lineHeight' | 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight',
    label: string,
    placeholder: string
  ) => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
        {label}
        <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field={field} />
      </label>
      <div className="relative">
        <Input
          key={`rich-text:${field}:${hasSelection ? 'selected' : 'empty'}:${selectionStyleDraft[field]}`}
          data-style-field={field}
          defaultValue={hasSelection ? selectionStyleDraft[field] : ''}
          inputMode="decimal"
          placeholder={placeholder}
          disabled={!hasSelection}
          className="h-8 pr-8 text-xs"
          onBlur={(event) => onApplyStyleFieldOnBlur(field, event.currentTarget.value)}
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
  );

  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          폰트
          <StyleApplyStatusIcon styleFieldApplyStatus={styleFieldApplyStatus} field="fontFamily" />
        </label>
        <select
          data-style-field="fontFamily"
          value={currentFontFamily}
          disabled={!hasSelection}
          onChange={(event) => {
            const nextValue = event.target.value;
            const selectElement = event.currentTarget;
            window.requestAnimationFrame(() => {
              selectElement.value = nextValue;
            });
            onApplyStyleFieldImmediateValue('fontFamily', nextValue);
          }}
          className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasCustomFontFamily ? <option value={currentFontFamily}>{currentFontFamily}</option> : null}
          {RICH_TEXT_FONT_FAMILY_OPTIONS.map((option) => (
            <option key={`rich-text-font-family:${option.value || 'default'}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {renderRichTextNumericInput('fontSize', '글자 크기', '14')}
        {renderRichTextNumericInput('lineHeight', '줄 높이', '20')}
        <div className="[&>div>label]:text-xs [&>div>label]:font-semibold [&_select]:h-8 [&_select]:text-xs">
          {renderStyleColorPicker('color', '글자 색')}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-800">글자 강조</label>
        <div className="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-white">
          <button
            type="button"
            className={styleButtonClass(isBold)}
            disabled={!hasSelection}
            onClick={() => onApplyStyleFieldImmediateValue('fontWeight', isBold ? '400' : '700')}
            aria-label="굵게"
            title="굵게"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={styleButtonClass(isItalic)}
            disabled={!hasSelection}
            onClick={() => onApplyStyleFieldImmediateValue('fontStyle', isItalic ? 'normal' : 'italic')}
            aria-label="이탤릭"
            title="이탤릭"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={styleButtonClass(isUnderline)}
            disabled={!hasSelection}
            onClick={() =>
              onApplyStyleFieldImmediateValue(
                'textDecorationLine',
                toggleTextDecorationTokenValue(selectionStyleDraft.textDecorationLine, 'underline')
              )
            }
            aria-label="밑줄"
            title="밑줄"
          >
            <Underline className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={styleButtonClass(isStrikeThrough)}
            disabled={!hasSelection}
            onClick={() =>
              onApplyStyleFieldImmediateValue(
                'textDecorationLine',
                toggleTextDecorationTokenValue(selectionStyleDraft.textDecorationLine, 'line-through')
              )
            }
            aria-label="삭선"
            title="삭선"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-800">문서 정렬</label>
        <div className="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-white">
          {[
            { value: 'left', label: '왼쪽', icon: AlignLeft },
            { value: 'center', label: '가운데', icon: AlignCenter },
            { value: 'right', label: '오른쪽', icon: AlignRight },
            { value: 'justify', label: '양쪽', icon: AlignJustify },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={`rich-text-align:${value}`}
              type="button"
              className={styleButtonClass(selectionStyleDraft.textAlign === value)}
              disabled={!hasSelection}
              onClick={() => onApplyStyleFieldImmediateValue('textAlign', value)}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
