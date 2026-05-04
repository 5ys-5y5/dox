'use client';

import * as React from 'react';
import { Check, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
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
  onCreateOption?: (label: string) => void;
  createOptionLabel?: string;
  onDeleteOption?: (option: EntityPickerOption) => void;
  onRenameOption?: (option: EntityPickerOption, nextLabel: string, nextMeta: string) => void;
  renameOptionLabel?: string;
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
  onCreateOption,
  createOptionLabel = '저장',
  onDeleteOption,
  onRenameOption,
  renameOptionLabel = '항목 수정',
  deleteOptionLabel = '항목 삭제',
}: EntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [editingId, setEditingId] = React.useState('');
  const [editingLabel, setEditingLabel] = React.useState('');
  const [editingMeta, setEditingMeta] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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

  const hasExactMatch = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return false;
    }
    return options.some((option) => option.id.toLowerCase() === normalizedQuery || option.label.toLowerCase() === normalizedQuery);
  }, [options, query]);

  const canCreate = Boolean(onCreateOption && query.trim() && !hasExactMatch);

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
    const selectedLabel = selectedOption?.label || '';
    if (!open && query !== selectedLabel) {
      setQuery(selectedLabel);
    }
  }, [open, query, selectedOption]);

  React.useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const inlineOptionLayout = optionLayout === 'inline';

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
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          aria-haspopup="listbox"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const normalizedQuery = query.trim().toLowerCase();
              const exact = options.find(
                (option) => option.id.toLowerCase() === normalizedQuery || option.label.toLowerCase() === normalizedQuery
              );
              if (exact) {
                onChange(exact.id);
                setOpen(false);
                return;
              }
              if (canCreate && onCreateOption) {
                onCreateOption(query.trim());
                setOpen(false);
              }
            }
          }}
          className="h-6 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              if (!onCreateOption) {
                return;
              }
              onCreateOption(query.trim());
              setOpen(false);
            }}
            className="inline-flex h-7 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {createOptionLabel}
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
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
                      {editingId === option.id ? (
                        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
                          <Input
                            value={editingLabel}
                            onChange={(event) => setEditingLabel(event.target.value)}
                            className="h-8 min-w-0 flex-1 rounded-md border-slate-300 bg-white text-xs"
                            placeholder="항목명"
                          />
                          <Input
                            value={editingMeta}
                            onChange={(event) => setEditingMeta(event.target.value)}
                            className="h-8 w-32 rounded-md border-slate-300 bg-white text-xs"
                            placeholder="ID"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={option.disabled}
                          onClick={() => {
                            onChange(option.id);
                            setQuery(option.label);
                            setOpen(false);
                          }}
                          className={cn('flex min-w-0 flex-1 items-center justify-start px-3 py-2.5 text-left', inlineOptionLayout ? 'gap-2' : 'flex-col items-start')}
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
                      )}
                      <div className="mr-1 flex shrink-0 items-center gap-1">
                        {onRenameOption ? (
                          editingId === option.id ? (
                            <>
                              <button
                                type="button"
                                aria-label={`${renameOptionLabel}: ${option.label}`}
                                title={renameOptionLabel}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRenameOption(option, editingLabel, editingMeta);
                                  setEditingId('');
                                  setEditingLabel('');
                                  setEditingMeta('');
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50"
                              >
                                <Check aria-hidden="true" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="수정 취소"
                                title="수정 취소"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingId('');
                                  setEditingLabel('');
                                  setEditingMeta('');
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
                              >
                                <X aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              aria-label={`${renameOptionLabel}: ${option.label}`}
                              title={renameOptionLabel}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingId(option.id);
                                setEditingLabel(option.label);
                                setEditingMeta(option.meta || option.id);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                            </button>
                          )
                        ) : null}
                        {onDeleteOption ? (
                          <button
                            type="button"
                            aria-label={`${deleteOptionLabel}: ${option.label}`}
                            title={deleteOptionLabel}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteOption(option);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-200"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
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
