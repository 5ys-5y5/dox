import * as React from 'react';
import { Button } from './Button';

type OptionButtonGroupOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type OptionButtonGroupProps<T extends string> = {
  value: T;
  options: OptionButtonGroupOption<T>[];
  onChange: (value: T) => void;
};

export function OptionButtonGroup<T extends string>({
  value,
  options,
  onChange,
}: OptionButtonGroupProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            className="h-8 px-2 text-[11px]"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
