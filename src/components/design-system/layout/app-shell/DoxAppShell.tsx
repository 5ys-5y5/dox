'use client';

import * as React from 'react';
import { AppShellFrame } from './AppShellFrame';
import { AppShellHeader } from './AppShellHeader';
import { AppShellSidebar } from './AppShellSidebar';
import { createAppShellNavigationSections } from './appShellNavigation';

export type DoxAppShellProps = {
  title: string;
  activeNavigationId?: string;
  children: React.ReactNode;
  brandLabel?: string;
  brandHref?: string;
  profileLabel?: string;
  mainClassName?: string;
};

export function DoxAppShell({
  title,
  activeNavigationId,
  children,
  brandLabel = 'Dox',
  brandHref = '/project',
  profileLabel = '프로필',
  mainClassName,
}: DoxAppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const navigationSections = React.useMemo(
    () => createAppShellNavigationSections(activeNavigationId),
    [activeNavigationId]
  );

  return (
    <AppShellFrame
      header={
        <AppShellHeader
          title={title}
          profileLabel={profileLabel}
          sidebarToggleLabel="사이드바 열기"
          onSidebarToggle={() => setMobileSidebarOpen(true)}
        />
      }
      sidebar={
        <AppShellSidebar
          brandLabel={brandLabel}
          brandHref={brandHref}
          sections={navigationSections}
        />
      }
      mobileSidebar={
        <AppShellSidebar
          brandLabel={brandLabel}
          brandHref={brandHref}
          sections={navigationSections}
          mobile
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      }
      mobileSidebarOpen={mobileSidebarOpen}
      onMobileSidebarClose={() => setMobileSidebarOpen(false)}
      mainClassName={mainClassName}
    >
      {children}
    </AppShellFrame>
  );
}
