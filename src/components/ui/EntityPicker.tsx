'use client';

import * as React from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from './Input';

export type EntityPickerOption = {
  id: string;
  label: string;
  meta?: string;
  keywords?: string[];
  disabled?: boolean;
};

type EntityPickerProps = {
  value: string;
  options: EntityPickerOption[];
  onChange: (value: string) => void;
  placeholder: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  optionLayout?: 'stacked' | 'inline';
  onDeleteOption?: (option: EntityPickerOption) => void;
  deleteOptionLabel?: string;
};

export function EntityPicker({
  value,
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
  onDeleteOption,
  deleteOptionLabel = '항목 삭제',
}: EntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.id === value) || null,
    [options, value]
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

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const inlineOptionLayout = optionLayout === 'inline';

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'group flex min-h-11 w-full items-start justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-400',
          triggerClassName
        )}
      >
        <div
          className={cn(
            'min-w-0 flex-1 text-left',
            inlineOptionLayout ? 'flex items-baseline gap-2' : ''
          )}
        >
          <div
            className={cn(
              'min-w-0 truncate text-sm font-normal leading-5',
              selectedOption ? 'text-slate-900' : 'text-slate-400'
            )}
          >
            {selectedOption?.label || placeholder}
          </div>
          {selectedOption?.meta ? (
            <div
              className={cn(
                'truncate text-[11px] font-normal leading-4 text-slate-500',
                inlineOptionLayout ? 'max-w-[48%] shrink-0' : 'mt-0.5'
              )}
            >
              {selectedOption.meta}
            </div>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150',
            open ? 'rotate-180' : 'rotate-0'
          )}
        />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 p-2',
            panelClassName
          )}
        >
          <div className="space-y-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 rounded-xl border-slate-300 bg-white"
            />
            <div role="listbox" className="max-h-64 space-y-1 overflow-auto">
              {allowClear ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-colors',
                    !value
                      ? 'border-slate-200 bg-slate-100'
                      : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white'
                  )}
                >
                  <span className="text-sm font-medium text-slate-900">선택 해제</span>
                  <span className="mt-0.5 text-[11px] text-slate-500">현재 선택을 비우고 다시 고릅니다.</span>
                </button>
              ) : null}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const selected = option.id === value;

                  return (
                    <div
                      key={option.id}
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        'flex w-full items-center rounded-xl border text-left transition-colors',
                        option.disabled
                          ? 'cursor-not-allowed border-transparent bg-white opacity-50'
                          : selected
                            ? 'border-slate-200 bg-slate-100'
                            : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white'
                      )}
                    >
                      <button
                        type="button"
                        disabled={option.disabled}
                        onClick={() => {
                          onChange(option.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex min-w-0 flex-1 px-3 py-2.5 text-left',
                          inlineOptionLayout ? 'items-baseline gap-2' : 'flex-col'
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
                      {onDeleteOption ? (
                        <button
                          type="button"
                          aria-label={`${deleteOptionLabel}: ${option.label}`}
                          title={deleteOptionLabel}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteOption(option);
                          }}
                          className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-200"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
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
