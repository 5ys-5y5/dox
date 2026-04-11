"use client";

import { Menu, Search } from "lucide-react";

type AppHeaderCloneProps = {
  title: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onToggleSidebar?: () => void;
  teamLabel?: string;
  profileLabel?: string;
};

export function AppHeaderClone({
  title,
  showSearch = true,
  searchValue = "",
  onSearchChange,
  onToggleSidebar,
  teamLabel = "기본 팀",
  profileLabel = "A",
}: AppHeaderCloneProps) {
  return (
    <header className="w-full mx-auto flex items-center gap-2 bg-white/90 backdrop-blur-[8px] border-b border-slate-200 px-4 md:px-8 py-[10px] h-[60px] sticky top-0 z-30">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="relative inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus:outline-none bg-transparent hover:bg-slate-100 active:bg-slate-200 rounded-[10px] p-0 h-8 w-8 text-slate-600 hover:text-slate-900 duration-100 transition-colors shrink-0"
        aria-label="사이드바 토글"
        title="메뉴"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 overflow-hidden w-full py-1 px-1 -mr-1">
        <div className="shrink-0">
          <h1 data-testid="page-title" className="text-sm text-slate-900 font-medium truncate">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center max-h-full w-fit gap-2">
        {showSearch ? (
          <div className="hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="h-8 w-72 rounded-[0.6rem] border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="검색..."
                aria-label="검색"
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="inline-flex h-8 items-center rounded-[0.6rem] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {teamLabel}
        </button>

        <button
          type="button"
          className="h-8 w-8 rounded-[0.6rem] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          aria-label="프로필"
        >
          {profileLabel}
        </button>
      </div>
    </header>
  );
}
