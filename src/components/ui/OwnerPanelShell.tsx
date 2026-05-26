import * as React from 'react';
import { cn } from '../../lib/utils';

const OwnerPanelShell = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-4 p-6', className)} {...props} />
  )
);

OwnerPanelShell.displayName = 'OwnerPanelShell';

export { OwnerPanelShell };
