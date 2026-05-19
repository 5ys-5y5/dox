import * as React from 'react';
import { Badge } from './Badge';
import { Button } from './Button';

type SettingToggleRowProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function SettingToggleRow({
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: SettingToggleRowProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700">
      <span className="min-w-0 truncate">{label}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant={checked ? 'blue' : 'slate'} className="px-2 py-0 text-[10px]">
          {checked ? 'ON' : 'OFF'}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant={checked ? 'default' : 'outline'}
          className="h-7 px-2 text-[11px]"
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
        >
          {checked ? '끄기' : '켜기'}
        </Button>
      </div>
    </div>
  );
}
