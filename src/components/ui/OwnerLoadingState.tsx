import * as React from 'react';
import { cn } from '../../lib/utils';

type OwnerLoadingStateItemAttributes = (item: string, name: string) => Record<string, string>;

type OwnerLoadingStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  itemAttributes?: OwnerLoadingStateItemAttributes;
  stateItemKey?: string;
  stateItemName?: string;
  titleItemKey?: string;
  titleItemName?: string;
  descriptionItemKey?: string;
  descriptionItemName?: string;
};

export function OwnerLoadingState({
  title = '문서 로딩 중',
  description = '상자 편집 캔버스를 준비하고 있습니다.',
  itemAttributes,
  stateItemKey,
  stateItemName = '로딩 상태',
  titleItemKey,
  titleItemName = '로딩 제목',
  descriptionItemKey,
  descriptionItemName = '로딩 설명',
  className,
  ...props
}: OwnerLoadingStateProps) {
  const ownerAttrs = (item: string | undefined, name: string) =>
    itemAttributes && item ? itemAttributes(item, name) : {};

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-600',
        className
      )}
      role="status"
      aria-live="polite"
      {...ownerAttrs(stateItemKey, stateItemName)}
      {...props}
    >
      <span
        className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
        aria-hidden="true"
      />
      <p className="mt-3 font-medium text-slate-900" {...ownerAttrs(titleItemKey, titleItemName)}>
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-500" {...ownerAttrs(descriptionItemKey, descriptionItemName)}>
        {description}
      </p>
    </div>
  );
}
