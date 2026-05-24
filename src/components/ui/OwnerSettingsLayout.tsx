import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';
import { Button } from './Button';

type OwnerSettingsActionBarProps = {
  dirty: boolean;
  dirtyLabel?: React.ReactNode;
  cleanLabel?: React.ReactNode;
  resetLabel?: React.ReactNode;
  saveLabel?: React.ReactNode;
  onReset: () => void;
  onSave: () => void;
  className?: string;
};

export function OwnerSettingsActionBar({
  dirty,
  dirtyLabel = '저장 전',
  cleanLabel = '저장됨',
  resetLabel = '되돌리기',
  saveLabel = '설정 저장',
  onReset,
  onSave,
  className,
}: OwnerSettingsActionBarProps) {
  return (
    <div className={cn('flex shrink-0 flex-wrap items-center gap-2', className)}>
      <Badge variant={dirty ? 'amber' : 'green'} className="px-2 py-0 text-[10px]">
        {dirty ? dirtyLabel : cleanLabel}
      </Badge>
      <Button type="button" variant="outline" size="sm" disabled={!dirty} onClick={onReset}>
        {resetLabel}
      </Button>
      <Button type="button" size="sm" disabled={!dirty} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  );
}

type OwnerSettingsSectionHeaderProps = {
  label: React.ReactNode;
  description?: React.ReactNode;
  count?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
};

export function OwnerSettingsSectionHeader({
  label,
  description,
  count,
  badge,
  className,
}: OwnerSettingsSectionHeaderProps) {
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-0.5', className)}>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <div className="shrink-0 text-[11px] font-semibold leading-3 text-slate-800">{label}</div>
        {description ? <div className="min-w-0 truncate text-[10px] leading-3 text-slate-500">{description}</div> : null}
      </div>
      {badge || count ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          {count ? <span className="text-[9px] font-semibold text-slate-400">{count}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export type OwnerSettingsTabOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type OwnerSettingsTabListProps = {
  value: string;
  options: OwnerSettingsTabOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
  className?: string;
};

export function OwnerSettingsTabList({
  value,
  options,
  ariaLabel,
  onChange,
  className,
}: OwnerSettingsTabListProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('grid gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'default' : 'outline'}
          className="h-8 text-xs"
          role="tab"
          aria-selected={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export type OwnerSettingsManagedTargetDetailRow = {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
};

export type OwnerSettingsManagedTarget = {
  value: string;
  label: React.ReactNode;
  path?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  detailRows?: OwnerSettingsManagedTargetDetailRow[];
};

type OwnerSettingsManagedTargetControlsProps = {
  value: string;
  targets: OwnerSettingsManagedTarget[];
  onChange: (value: string) => void;
  listClassName?: string;
};

export function OwnerSettingsManagedTargetControls({
  value,
  targets,
  onChange,
  listClassName,
}: OwnerSettingsManagedTargetControlsProps) {
  const selectedTarget = targets.find((target) => target.value === value) || targets[0];

  if (!selectedTarget) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className={cn('max-h-[22rem] space-y-1.5 overflow-y-auto pr-1', listClassName)}>
        {targets.map((target) => {
          const active = target.value === selectedTarget.value;

          return (
            <Button
              key={target.value}
              type="button"
              variant={active ? 'default' : 'outline'}
              className="h-auto w-full justify-start px-2 py-2 text-left"
              aria-pressed={active}
              onClick={() => onChange(target.value)}
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-xs font-semibold">{target.label}</span>
                </span>
                {target.path ? (
                  <span className="mt-0.5 block truncate text-[10px] font-normal opacity-80">{target.path}</span>
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{selectedTarget.label}</div>
            {selectedTarget.description ? (
              <div className="mt-0.5 truncate text-[10px] text-slate-500">{selectedTarget.description}</div>
            ) : null}
          </div>
          {selectedTarget.badge}
        </div>
        {selectedTarget.detailRows?.length ? (
          <div className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[72px_minmax(0,1fr)]">
            {selectedTarget.detailRows.map((row, index) => (
              <React.Fragment key={`${String(row.label)}:${index}`}>
                <div className="font-medium text-slate-600">{row.label}</div>
                <div className={cn('min-w-0 text-slate-900', row.valueClassName || 'truncate')}>{row.value}</div>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
