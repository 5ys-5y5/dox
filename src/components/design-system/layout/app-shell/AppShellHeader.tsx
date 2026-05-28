'use client';

import { AppHeaderClone } from '../AppHeader.clone';
import type { AppShellHeaderProps } from './appShellTypes';

const appShellItemAttributes = (item: string) => ({
  'data-app-shell-item': item,
});

export function AppShellHeader({
  title,
  profileLabel = '사용자',
  sidebarToggleLabel = '사이드바 열기',
  onSidebarToggle,
  workspaceMenu,
  profileMenu,
}: AppShellHeaderProps) {
  const profileInitial = profileLabel.trim().charAt(0).toUpperCase() || 'U';

  return (
    <AppHeaderClone
      title={title}
      showSearch={false}
      profileLabel={profileInitial}
      sidebarToggleLabel={sidebarToggleLabel}
      onToggleSidebar={onSidebarToggle}
      workspaceMenu={workspaceMenu}
      profileMenu={profileMenu}
      shellItemAttributes={appShellItemAttributes}
      className="bg-slate-50/95"
      contentClassName="max-w-7xl"
      titleClassName="font-semibold text-slate-950"
    />
  );
}
