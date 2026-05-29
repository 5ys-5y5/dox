import * as React from 'react';
import { Button } from './Button';

type SettingToggleRowProps = {
  label: string;
  sectionLabel?: string;
  definitionName?: string;
  settingKey?: string;
  env?: string;
  description?: string;
  statusItems?: Array<{
    label: string;
    value: string;
    tone?: 'default' | 'success' | 'warning' | 'muted';
  }>;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  onCheckedChange: (checked: boolean, settingKey?: string) => void;
};

const settingToggleStatusItemsEqual = (
  left: SettingToggleRowProps['statusItems'] = [],
  right: SettingToggleRowProps['statusItems'] = []
) =>
  left.length === right.length &&
  left.every(
    (item, index) =>
      item.label === right[index]?.label &&
      item.value === right[index]?.value &&
      item.tone === right[index]?.tone
  );

export const SettingToggleRow = React.memo(function SettingToggleRow({
  label,
  sectionLabel,
  definitionName,
  settingKey,
  env = '',
  description,
  statusItems = [],
  checked,
  disabled = false,
  className = '',
  onCheckedChange,
}: SettingToggleRowProps) {
  const envAttributes = { env };
  const getStatusClassName = (tone: 'default' | 'success' | 'warning' | 'muted' = 'default') => {
    if (tone === 'success') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (tone === 'warning') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    if (tone === 'muted') {
      return 'border-slate-200 bg-slate-50 text-slate-500';
    }

    return 'border-slate-200 bg-white text-slate-700';
  };

  return (
    <div
      className={`flex items-center justify-between gap-1.5 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700 ${className}`}
      {...envAttributes}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1 leading-3">
          {sectionLabel ? <span className="shrink-0 text-[9px] font-semibold text-slate-400">{sectionLabel}</span> : null}
          <span className="min-w-0 truncate font-semibold text-slate-800">{label}</span>
          {definitionName ? <span className="min-w-0 truncate text-[10px] font-medium text-slate-500">{definitionName}</span> : null}
        </div>
        {description ? <div className="mt-0.5 truncate text-[10px] leading-[11px] text-slate-500">{description}</div> : null}
        {statusItems.length > 0 ? (
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            {statusItems.map((item) => (
              <span
                key={`${item.label}:${item.value}`}
                className={`inline-flex max-w-full items-center gap-1 rounded border px-1 py-0.5 text-[9px] font-semibold leading-none ${getStatusClassName(item.tone)}`}
                title={`${item.label}: ${item.value}`}
              >
                <span className="shrink-0 opacity-70">{item.label}</span>
                <span className="min-w-0 truncate">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={checked ? 'default' : 'outline'}
          className="h-6 min-w-12 px-2 text-[10px]"
          disabled={disabled}
          aria-pressed={checked}
          aria-label={`${label} ${checked ? 'ON' : 'OFF'}`}
          onClick={() => onCheckedChange(!checked, settingKey)}
        >
          {checked ? 'ON' : 'OFF'}
        </Button>
      </div>
    </div>
  );
}, (previous, next) =>
  previous.label === next.label &&
  previous.sectionLabel === next.sectionLabel &&
  previous.definitionName === next.definitionName &&
  previous.settingKey === next.settingKey &&
  previous.env === next.env &&
  previous.description === next.description &&
  previous.checked === next.checked &&
  previous.disabled === next.disabled &&
  previous.className === next.className &&
  previous.onCheckedChange === next.onCheckedChange &&
  settingToggleStatusItemsEqual(previous.statusItems, next.statusItems)
);
