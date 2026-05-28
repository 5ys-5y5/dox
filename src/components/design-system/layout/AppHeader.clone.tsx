'use client';

import { Menu, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';

type AppHeaderCloneShellItemAttributes = (item: string) => Record<string, string>;

export type AppHeaderCloneProps = {
  title: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onToggleSidebar?: () => void;
  sidebarToggleLabel?: string;
  profileLabel?: string;
  workspaceMenu?: React.ReactNode;
  profileMenu?: React.ReactNode;
  shellItemAttributes?: AppHeaderCloneShellItemAttributes;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
};

export function AppHeaderClone({
  title,
  showSearch = true,
  searchValue = '',
  onSearchChange,
  onToggleSidebar,
  sidebarToggleLabel = '사이드바 토글',
  profileLabel = 'A',
  workspaceMenu,
  profileMenu,
  shellItemAttributes,
  className,
  contentClassName,
  titleClassName,
}: AppHeaderCloneProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-[60px] w-full border-b border-slate-200 bg-white/90 backdrop-blur-[8px]',
        className
      )}
      {...shellItemAttributes?.('shell-header')}
    >
      <div
        className={cn('mx-auto flex h-full w-full items-center gap-2 px-4 py-[10px] md:px-8', contentClassName)}
        {...shellItemAttributes?.('shell-header-content')}
      >
        <button
          type="button"
          onClick={onToggleSidebar}
          className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-transparent p-0 text-sm font-medium text-slate-600 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus:outline-none"
          aria-label={sidebarToggleLabel}
          title={sidebarToggleLabel}
          {...shellItemAttributes?.('shell-header-sidebar-toggle')}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 w-full items-center gap-1.5 overflow-hidden whitespace-nowrap px-1 py-1 -mr-1">
          <div className="min-w-0 shrink-0">
            <h1
              data-testid="page-title"
              className={cn('truncate text-sm font-medium text-slate-900', titleClassName)}
              title={title}
              {...shellItemAttributes?.('shell-header-page-title')}
            >
              {title}
            </h1>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex max-h-full w-fit items-center gap-2">
          {showSearch ? (
            <div className="hidden lg:block" {...shellItemAttributes?.('shell-header-search')}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchValue}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  className="h-8 w-72 rounded-[0.6rem] border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="검색..."
                  aria-label="검색"
                />
              </div>
            </div>
          ) : null}

          {workspaceMenu ? (
            <div className="hidden min-w-0 sm:block" {...shellItemAttributes?.('shell-header-workspace-switcher')}>
              {workspaceMenu}
            </div>
          ) : null}

          <div className="shrink-0" {...shellItemAttributes?.('shell-header-profile-button')}>
            {profileMenu || (
              <button
                type="button"
                className="h-8 w-8 rounded-[0.6rem] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                aria-label="프로필"
                title={profileLabel}
              >
                {profileLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
