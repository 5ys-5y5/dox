'use client';

import * as React from 'react';
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

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left transition-colors',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-400',
          triggerClassName
        )}
      >
        <div className="min-w-0">
          <div className={cn('truncate text-sm', selectedOption ? 'text-slate-900' : 'text-slate-400')}>
            {selectedOption?.label || placeholder}
          </div>
          {selectedOption?.meta ? <div className="truncate text-xs text-slate-500">{selectedOption.meta}</div> : null}
        </div>
        <span className="ml-3 shrink-0 text-xs text-slate-500">{open ? '닫기' : '선택'}</span>
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-30 mt-2 w-full rounded-xl border border-slate-300 bg-white p-2',
            panelClassName
          )}
        >
          <div className="space-y-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="border-slate-300 bg-slate-50"
            />
            <div role="listbox" className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
              {allowClear ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                    !value
                      ? 'border-slate-200 bg-slate-100'
                      : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <span className="text-sm font-medium text-slate-900">선택 해제</span>
                </button>
              ) : null}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const selected = option.id === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'mt-1 flex w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors first:mt-0',
                        option.disabled
                          ? 'cursor-not-allowed border-transparent bg-white opacity-50'
                          : selected
                            ? 'border-slate-200 bg-slate-100'
                            : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <span className="text-sm font-medium text-slate-900">{option.label}</span>
                      {option.meta ? <span className="text-xs text-slate-500">{option.meta}</span> : null}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-slate-500">{emptyMessage}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
