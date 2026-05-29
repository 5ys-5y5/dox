import { FolderKanban, ShieldCheck } from 'lucide-react';
import type { AppShellNavigationSection } from './appShellTypes';

export const appShellNavigationSections: AppShellNavigationSection[] = [
  {
    id: 'work',
    label: '작업',
    items: [
      { id: 'project', label: '현장 관리', href: '/project', icon: FolderKanban },
      { id: 'member-access', label: '구성원 문서 접근', href: '/member-access', icon: ShieldCheck },
    ],
  },
];

export const createAppShellNavigationSections = (activeId?: string): AppShellNavigationSection[] =>
  appShellNavigationSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      active: item.id === activeId,
    })),
  }));
