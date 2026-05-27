'use client';

import * as React from 'react';
import { Input, type InputProps } from '../../../ui/Input';

type DeferredValueInputProps = Omit<InputProps, 'value' | 'defaultValue' | 'onChange'> & {
  value: string;
  onCommit: (nextValue: string) => void;
  onDraftChange?: (nextValue: string) => void;
  normalizeCommitValue?: (nextValue: string) => string;
};

export const DeferredValueInput = React.forwardRef<HTMLInputElement, DeferredValueInputProps>(
  (
    {
      value,
      onCommit,
      onDraftChange,
      normalizeCommitValue,
      disabled,
      readOnly,
      onBlur,
      onFocus,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const [draftValue, setDraftValue] = React.useState(value);
    const focusedRef = React.useRef(false);

    React.useEffect(() => {
      if (!focusedRef.current) {
        setDraftValue(value);
      }
    }, [value]);

    const commitDraftValue = React.useCallback(
      (rawValue: string) => {
        const nextValue = normalizeCommitValue ? normalizeCommitValue(rawValue) : rawValue;
        setDraftValue(nextValue);

        if (!disabled && !readOnly && nextValue !== value) {
          onCommit(nextValue);
        }
      },
      [disabled, normalizeCommitValue, onCommit, readOnly, value]
    );

    return (
      <Input
        {...props}
        ref={ref}
        value={draftValue}
        disabled={disabled}
        readOnly={readOnly}
        onFocus={(event) => {
          focusedRef.current = true;
          onFocus?.(event);
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setDraftValue(nextValue);
          onDraftChange?.(nextValue);
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          commitDraftValue(event.currentTarget.value);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }

          onKeyDown?.(event);
        }}
      />
    );
  }
);

DeferredValueInput.displayName = 'DeferredValueInput';
