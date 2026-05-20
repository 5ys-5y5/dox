import * as React from 'react';
import { Badge } from './Badge';
import { Button } from './Button';

type SettingToggleRowProps = {
  label: string;
  sectionLabel?: string;
  definitionName?: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function SettingToggleRow({
  label,
  sectionLabel,
  definitionName,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: SettingToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-1.5 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1 leading-3">
          {sectionLabel ? <span className="shrink-0 text-[9px] font-semibold text-slate-400">{sectionLabel}</span> : null}
          <span className="min-w-0 truncate font-semibold text-slate-800">{label}</span>
          {definitionName ? <span className="min-w-0 truncate text-[10px] font-medium text-slate-500">{definitionName}</span> : null}
        </div>
        {description ? <div className="mt-0.5 truncate text-[10px] leading-[11px] text-slate-500">{description}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant={checked ? 'blue' : 'slate'} className="px-1.5 py-0 text-[9px]">
          {checked ? 'ON' : 'OFF'}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant={checked ? 'default' : 'outline'}
          className="h-5 px-1.5 text-[10px]"
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
        >
          {checked ? '끄기' : '켜기'}
        </Button>
      </div>
    </div>
  );
}
