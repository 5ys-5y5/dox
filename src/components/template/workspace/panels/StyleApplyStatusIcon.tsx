'use client';

import { Loader2 } from 'lucide-react';
import type { StyleFieldApplyState, StyleFieldKey } from '../types';

export type StyleFieldApplyStatusMap = Record<StyleFieldKey, StyleFieldApplyState>;

export const StyleApplyStatusIcon = ({
  styleFieldApplyStatus,
  field,
}: {
  styleFieldApplyStatus: StyleFieldApplyStatusMap;
  field: StyleFieldKey;
}) => {
  if (styleFieldApplyStatus[field] !== 'saving') {
    return null;
  }

  return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" aria-label="반영 중" />;
};
