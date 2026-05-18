'use client';

import * as React from 'react';
import { Input } from '../../../ui/Input';

type PositionSpacingDeferredInputProps = {
  className: string;
  placeholder?: string;
  value: string;
  onCommit: (nextValue: string) => void;
};

export const PositionSpacingDeferredInput = React.memo(function PositionSpacingDeferredInput({
  className,
  placeholder,
  value,
  onCommit,
}: PositionSpacingDeferredInputProps) {
  const [draftValue, setDraftValue] = React.useState(value);
  const isFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  const commitDraftValue = React.useCallback(
    (nextValue: string) => {
      if (nextValue !== value) {
        onCommit(nextValue);
      }
    },
    [onCommit, value]
  );

  return (
    <Input
      value={draftValue}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(event) => {
        setDraftValue(event.target.value);
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        commitDraftValue(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
    />
  );
});
