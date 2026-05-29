'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EntityPickerOption } from './EntityPicker';

type MultiEntityPickerProps = {
  values: string[];
  options: EntityPickerOption[];
  onChange: (values: string[]) => void;
  placeholder: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  optionLayout?: 'stacked' | 'inline';
  selectionSummary?: (selectedOptions: EntityPickerOption[]) => string;
  onDeleteOption?: (option: EntityPickerOption) => void;
  deleteOptionLabel?: string;
  deferOptionChange?: boolean;
  controlAction?: {
    ariaLabel: string;
    title?: string;
    onClick: () => void;
  };
  dropdownAction?: {
    label: string;
    onClick: () => void;
  };
  ownerItemKey?: string;
  ownerItemName?: string;
  ownerItemAttributes?: (item: string, name: string) => Record<string, string>;
};

const getDefaultSelectionSummary = (selectedOptions: EntityPickerOption[]) => {
  if (selectedOptions.length === 0) {
    return '';
  }

  if (selectedOptions.length === 1) {
    return selectedOptions[0]?.label || '';
  }

  return `${selectedOptions[0]?.label || ''} 외 ${selectedOptions.length - 1}건`;
};

const PICKER_PORTAL_Z_INDEX = 2147483647;
const PICKER_PORTAL_VIEWPORT_PADDING = 8;
const PICKER_PORTAL_GAP = 8;
const PICKER_PORTAL_MAX_HEIGHT = 320;
const PICKER_PORTAL_MIN_HEIGHT = 160;

const resolvePickerPortalStyle = (anchor: HTMLElement): React.CSSProperties => {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const width = Math.max(160, rect.width);
  const left = Math.min(
    Math.max(PICKER_PORTAL_VIEWPORT_PADDING, rect.left),
    Math.max(PICKER_PORTAL_VIEWPORT_PADDING, viewportWidth - width - PICKER_PORTAL_VIEWPORT_PADDING)
  );
  const belowTop = rect.bottom + PICKER_PORTAL_GAP;
  const availableBelow = viewportHeight - belowTop - PICKER_PORTAL_VIEWPORT_PADDING;
  const availableAbove = rect.top - PICKER_PORTAL_GAP - PICKER_PORTAL_VIEWPORT_PADDING;
  const renderAbove = availableBelow < PICKER_PORTAL_MIN_HEIGHT && availableAbove > availableBelow;
  const maxHeight = Math.max(
    PICKER_PORTAL_MIN_HEIGHT,
    Math.min(PICKER_PORTAL_MAX_HEIGHT, renderAbove ? availableAbove : availableBelow)
  );
  const top = renderAbove
    ? Math.max(PICKER_PORTAL_VIEWPORT_PADDING, rect.top - PICKER_PORTAL_GAP - maxHeight)
    : belowTop;

  return {
    position: 'fixed',
    top,
    left,
    width,
    maxHeight,
    zIndex: PICKER_PORTAL_Z_INDEX,
  };
};

export function MultiEntityPicker({
  values,
  options,
  onChange,
  placeholder,
  emptyMessage = '선택 가능한 항목이 없습니다.',
  searchPlaceholder = '목록 검색',
  disabled = false,
  allowClear = false,
  className,
  triggerClassName,
  panelClassName,
  optionLayout = 'stacked',
  selectionSummary,
  onDeleteOption,
  deleteOptionLabel = '항목 삭제',
  deferOptionChange = false,
  controlAction,
  dropdownAction,
  ownerItemKey,
  ownerItemName = '복수 항목 선택기',
  ownerItemAttributes,
}: MultiEntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const deferredChangeFrameRef = React.useRef<number | null>(null);
  const [dropdownPortalStyle, setDropdownPortalStyle] = React.useState<React.CSSProperties | null>(null);

  const selectedOptions = React.useMemo(
    () =>
      values
        .map((value) => options.find((option) => option.id === value) || null)
        .filter((option): option is EntityPickerOption => Boolean(option)),
    [options, values]
  );

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystack = [option.label, option.meta || '', ...(option.keywords || [])].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  const resolvedSelectionSummary = React.useMemo(() => {
    const summary = selectionSummary || getDefaultSelectionSummary;
    return summary(selectedOptions);
  }, [selectedOptions, selectionSummary]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedRoot = Boolean(rootRef.current && rootRef.current.contains(target));
      const clickedDropdown = Boolean(dropdownRef.current && dropdownRef.current.contains(target));

      if (!clickedRoot && !clickedDropdown) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setDropdownPortalStyle(null);
      return;
    }

    const updateDropdownPortalStyle = () => {
      if (!rootRef.current) {
        return;
      }

      setDropdownPortalStyle(resolvePickerPortalStyle(rootRef.current));
    };

    updateDropdownPortalStyle();
    window.addEventListener('resize', updateDropdownPortalStyle);
    window.addEventListener('scroll', updateDropdownPortalStyle, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPortalStyle);
      window.removeEventListener('scroll', updateDropdownPortalStyle, true);
    };
  }, [open, filteredOptions.length, selectedOptions.length]);

  const inlineOptionLayout = optionLayout === 'inline';
  const ownerAttrs = React.useCallback(
    (item: string | undefined, name: string) => (ownerItemAttributes && item ? ownerItemAttributes(item, name) : {}),
    [ownerItemAttributes]
  );
  const toggleValue = (optionId: string) => {
    const nextValues = values.includes(optionId) ? values.filter((value) => value !== optionId) : [...values, optionId];

    if (!deferOptionChange) {
      onChange(nextValues);
      return;
    }

    setOpen(false);
    setQuery('');

    if (deferredChangeFrameRef.current !== null) {
      window.cancelAnimationFrame(deferredChangeFrameRef.current);
    }

    deferredChangeFrameRef.current = window.requestAnimationFrame(() => {
      deferredChangeFrameRef.current = null;
      onChange(nextValues);
    });
  };

  React.useEffect(
    () => () => {
      if (deferredChangeFrameRef.current !== null) {
        window.cancelAnimationFrame(deferredChangeFrameRef.current);
      }
    },
    []
  );

  const dropdownNode =
    open && dropdownPortalStyle && typeof document !== 'undefined' ? (
      <div
        ref={dropdownRef}
        style={dropdownPortalStyle}
        className={cn(
          'overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 p-2',
          panelClassName
        )}
        {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-dropdown` : undefined, `${ownerItemName} 드롭다운`)}
      >
        <div className="space-y-2" {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-dropdown-content` : undefined, `${ownerItemName} 드롭다운 내용`)}>
          {dropdownAction ? (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              onClick={() => {
                dropdownAction.onClick();
                setOpen(false);
                setQuery('');
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {dropdownAction.label}
            </button>
          ) : null}
          <div
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500"
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-option-count` : undefined, `${ownerItemName} 옵션 개수`)}
          >
            전체 {options.length}개 중 {selectedOptions.length}개 선택
          </div>
          <div
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 space-y-1 overflow-auto"
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-option-list` : undefined, `${ownerItemName} 옵션 목록`)}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const selected = values.includes(option.id);

                return (
                  <div
                    key={option.id}
                    role="option"
                    aria-selected={selected}
                    {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-option-${option.id}` : undefined, `${ownerItemName} 옵션 - ${option.label}`)}
                    className={cn(
                      'flex w-full items-center rounded-xl border text-left',
                      option.disabled
                        ? 'cursor-not-allowed border-transparent bg-white opacity-50'
                        : selected
                          ? 'border-slate-200 bg-slate-100'
                          : 'border-transparent bg-transparent'
                    )}
                  >
                    <button
                      type="button"
                      disabled={option.disabled}
                      onClick={() => toggleValue(option.id)}
                      {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-option-${option.id}-select-button` : undefined, `${ownerItemName} 옵션 선택 버튼 - ${option.label}`)}
                      className={cn(
                        'flex min-w-0 flex-1 justify-start px-3 py-2.5 text-left disabled:cursor-not-allowed',
                        inlineOptionLayout ? 'items-center gap-2' : 'flex-col items-start'
                      )}
                    >
                      <span
                        className={cn(
                          'min-w-0 truncate text-sm leading-5 text-slate-900',
                          inlineOptionLayout ? 'font-normal' : 'font-medium'
                        )}
                      >
                        {option.label}
                      </span>
                      {option.meta ? (
                        <span
                          className={cn(
                            'truncate text-[11px] font-normal leading-4 text-slate-500',
                            inlineOptionLayout ? 'max-w-[48%] shrink-0' : 'mt-0.5'
                          )}
                        >
                          {option.meta}
                        </span>
                      ) : null}
                    </button>
                    <div className="mr-1 flex shrink-0 items-center gap-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md">
                        {selected ? <Check aria-hidden="true" className="h-4 w-4 text-slate-700" /> : null}
                      </div>
                      {onDeleteOption ? (
                        <button
                          type="button"
                          aria-label={`${deleteOptionLabel}: ${option.label}`}
                          title={deleteOptionLabel}
                          disabled={option.disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteOption(option);
                            setOpen(false);
                            setQuery('');
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                          {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-option-${option.id}-delete-button` : undefined, `${ownerItemName} 옵션 삭제 버튼 - ${option.label}`)}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500"
                {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-empty-state` : undefined, `${ownerItemName} 빈 상태`)}
              >
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        ref={rootRef}
        className={cn('relative w-full', className)}
        {...ownerAttrs(ownerItemKey, ownerItemName)}
      >
        {controlAction ? (
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-3 py-2 text-white"
            aria-label={controlAction.ariaLabel}
            title={controlAction.title || controlAction.ariaLabel}
            onClick={controlAction.onClick}
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-control` : undefined, `${ownerItemName} 컨트롤`)}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : (
          <div
            className={cn(
              'group flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:ring-1 focus-within:ring-slate-300',
              disabled ? 'cursor-not-allowed opacity-60' : '',
              triggerClassName
            )}
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-control` : undefined, `${ownerItemName} 컨트롤`)}
          >
            <input
              ref={inputRef}
              type="text"
              value={open ? query : resolvedSelectionSummary}
              readOnly={!open}
              disabled={disabled}
              placeholder={open ? searchPlaceholder : placeholder}
              aria-haspopup="listbox"
              aria-expanded={open}
              onFocus={() => {
                setQuery('');
                setOpen(true);
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false);
                  setQuery('');
                }
              }}
              className="h-6 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-input` : undefined, `${ownerItemName} 검색 입력`)}
            />
            {allowClear && values.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setQuery('');
                }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400"
                aria-label="선택 초기화"
                title="선택 초기화"
                {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-clear-button` : undefined, `${ownerItemName} 선택 초기화 버튼`)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setQuery('');
                setOpen((current) => !current);
              }}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400"
              aria-label="목록 열기"
              title="목록 열기"
              {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-toggle-button` : undefined, `${ownerItemName} 목록 열기 버튼`)}
            >
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>
          </div>
        )}
      </div>
      {dropdownNode ? createPortal(dropdownNode, document.body) : null}
    </>
  );
}
