import type * as React from 'react';

export type AppShellNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  active?: boolean;
  disabled?: boolean;
  badge?: string | number;
};

export type AppShellNavigationSection = {
  id: string;
  label: string;
  items: AppShellNavigationItem[];
};

export type AppShellHeaderProps = {
  title: string;
  workspaceLabel?: string;
  profileLabel?: string;
  sidebarToggleLabel?: string;
  onSidebarToggle?: () => void;
  workspaceMenu?: React.ReactNode;
  profileMenu?: React.ReactNode;
};

export type AppShellSidebarProps = {
  brandLabel?: string;
  brandHref?: string;
  sections: AppShellNavigationSection[];
  planHref?: string;
  planLabel?: string;
  collapsed?: boolean;
  mobile?: boolean;
  onMobileClose?: () => void;
};

export type AppShellFrameProps = {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  mobileSidebar?: React.ReactNode;
  mobileSidebarOpen?: boolean;
  onMobileSidebarClose?: () => void;
  className?: string;
  mainClassName?: string;
};
