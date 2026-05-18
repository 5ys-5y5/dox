'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
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
}: MultiEntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
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

  const inlineOptionLayout = optionLayout === 'inline';
  const toggleValue = (optionId: string) => {
    onChange(values.includes(optionId) ? values.filter((value) => value !== optionId) : [...values, optionId]);
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'group flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 transition-colors focus-within:ring-1 focus-within:ring-slate-300',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-400',
          triggerClassName
        )}
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
        />
        {allowClear && values.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setQuery('');
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
            aria-label="선택 초기화"
            title="선택 초기화"
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
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
          aria-label="목록 열기"
          title="목록 열기"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('h-4 w-4 transition-transform duration-150', open ? 'rotate-180' : 'rotate-0')}
          />
        </button>
      </div>

      {open ? (
        <div
          className={cn(
            'absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 p-2',
            panelClassName
          )}
        >
          <div className="space-y-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
              전체 {options.length}개 중 {selectedOptions.length}개 선택
            </div>
            <div role="listbox" aria-multiselectable="true" className="max-h-64 space-y-1 overflow-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const selected = values.includes(option.id);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={option.disabled}
                      onClick={() => toggleValue(option.id)}
                      className={cn(
                        'flex w-full items-center rounded-xl border text-left transition-colors',
                        option.disabled
                          ? 'cursor-not-allowed border-transparent bg-white opacity-50'
                          : selected
                            ? 'border-slate-200 bg-slate-100'
                            : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white'
                      )}
                    >
                      <div
                        className={cn(
                          'flex min-w-0 flex-1 justify-start px-3 py-2.5 text-left',
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
                      </div>
                      <div className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                        {selected ? <Check aria-hidden="true" className="h-4 w-4 text-slate-700" /> : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
