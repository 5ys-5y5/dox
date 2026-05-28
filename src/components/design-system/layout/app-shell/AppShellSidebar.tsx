'use client';

import { AppSidebarClone, type SidebarGroup } from '../AppSidebar.clone';
import type { AppShellSidebarProps } from './appShellTypes';

const appShellItemAttributes = (item: string) => ({
  'data-app-shell-item': item,
});

export function AppShellSidebar({
  brandLabel = 'Dox',
  brandHref = '/project',
  sections,
  planHref,
  planLabel = '결제/플랜',
  collapsed = false,
  mobile = false,
  onMobileClose,
}: AppShellSidebarProps) {
  const groups: SidebarGroup[] = sections.map((section) => ({
    header: section.label,
    items: section.items.map((item) => ({
      key: item.id,
      href: item.href,
      label: item.label,
      icon: item.icon,
      active: item.active,
      disabled: item.disabled,
      badge: item.badge,
    })),
  }));

  return (
    <AppSidebarClone
      brandLabel={brandLabel}
      brandHref={brandHref}
      groups={groups}
      homeItem={null}
      planHref={planHref}
      planLabel={planLabel}
      showPlanLink={Boolean(planHref)}
      collapsed={collapsed}
      mobile={mobile}
      onMobileClose={onMobileClose}
      shellItemAttributes={appShellItemAttributes}
    />
  );
}
