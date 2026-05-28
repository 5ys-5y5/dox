import { ClipboardList, FileImage, FileStack, FolderKanban, LayoutDashboard, PanelTop } from 'lucide-react';
import type { AppShellNavigationSection } from './appShellTypes';

export const appShellNavigationSections: AppShellNavigationSection[] = [
  {
    id: 'work',
    label: '작업',
    items: [
      { id: 'project', label: '현장 관리', href: '/project', icon: FolderKanban },
      { id: 'documents', label: '문서', href: '/documents', icon: FileStack },
      { id: 'photos', label: '사진', href: '/photos', icon: FileImage },
    ],
  },
  {
    id: 'build',
    label: '제작',
    items: [
      { id: 'canvas', label: '캔버스', href: '/canvas', icon: LayoutDashboard },
      { id: 'templates', label: '문서 양식', href: '/templates', icon: ClipboardList },
      { id: 'templates-extract', label: '추출 미리보기', href: '/templates/extract', icon: PanelTop },
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
