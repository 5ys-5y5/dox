'use client';

import { cn } from '../../../../lib/utils';
import type { AppShellFrameProps } from './appShellTypes';

export function AppShellFrame({
  header,
  sidebar,
  children,
  mobileSidebar,
  mobileSidebarOpen = false,
  onMobileSidebarClose,
  className,
  mainClassName,
}: AppShellFrameProps) {
  return (
    <div data-app-shell-item="shell-frame" className={cn('min-h-screen bg-slate-50 md:flex', className)}>
      <div data-app-shell-item="shell-sidebar-desktop" className="hidden shrink-0 md:block">
        {sidebar}
      </div>

      {mobileSidebarOpen ? (
        <div
          data-app-shell-item="shell-mobile-sidebar-backdrop"
          className="fixed inset-0 z-50 bg-slate-950/30 md:hidden"
          onClick={onMobileSidebarClose}
        >
          <div
            data-app-shell-item="shell-mobile-sidebar-panel"
            className="h-full w-[min(20rem,calc(100vw-2rem))] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {mobileSidebar || sidebar}
          </div>
        </div>
      ) : null}

      <div data-app-shell-item="shell-main-column" className="min-w-0 flex-1">
        {header}
        <main data-app-shell-item="shell-main-content" className={cn('min-w-0', mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
