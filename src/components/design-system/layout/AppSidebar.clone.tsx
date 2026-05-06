'use client';

import { CreditCard, Home, MessageCircle, PlusSquare, Settings, Sparkles, UserRound, Users, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

type SidebarItem = {
  key: string;
  href?: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  active?: boolean;
};

type SidebarGroup = {
  header: string;
  items: SidebarItem[];
};

const defaultGroups: SidebarGroup[] = [
  {
    header: '고객 정보',
    items: [{ key: 'contacts', label: '고객', icon: UserRound }],
  },
  {
    header: '에이전트',
    items: [
      { key: 'quickcreate', label: '빠른생성', icon: Sparkles },
      { key: 'create', label: '생성하기', icon: PlusSquare, active: true },
      { key: 'chat', label: '대화기록', icon: MessageCircle, badge: 3 },
    ],
  },
  {
    header: '설정',
    items: [
      { key: 'team', label: '팀', icon: Users, badge: 2 },
      { key: 'settings', label: '설정', icon: Settings },
    ],
  },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2" aria-label="Mejai">
      <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-slate-200" />
      <div className="leading-tight">
        <div className="font-semibold tracking-tight text-slate-900">Mejai</div>
      </div>
    </div>
  );
}

function SidebarGroupBlock({
  header,
  children,
  collapsed,
}: {
  header: string;
  children: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <div>
      {collapsed ? (
        <div className="flex justify-center px-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">•</div>
      ) : (
        <div className="px-3 text-[11px] font-medium text-slate-500">{header}</div>
      )}
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
}: {
  item: SidebarItem;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      title={item.label}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm text-left transition',
        collapsed ? 'justify-center' : '',
        item.active ? 'border-slate-200 bg-slate-100 text-slate-900' : 'border-transparent text-slate-700 hover:bg-slate-50'
      )}
    >
      <Icon className={cn('h-4 w-4', item.active ? 'text-emerald-600' : 'text-slate-500')} />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      {(typeof item.badge === 'number' || typeof item.badge === 'string') && !collapsed ? (
        <span className="ml-auto rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

type AppSidebarCloneProps = {
  collapsed?: boolean;
  mobile?: boolean;
  groups?: SidebarGroup[];
  onMobileClose?: () => void;
};

export function AppSidebarClone({
  collapsed = false,
  mobile = false,
  groups = defaultGroups,
  onMobileClose,
}: AppSidebarCloneProps) {
  const collapsedView = collapsed && !mobile;

  return (
    <aside
      className={cn(
        'overflow-y-auto bg-white transition-[width] duration-150',
        mobile ? 'flex min-h-0 flex-1 flex-col w-full' : collapsedView ? 'w-20' : 'w-72',
        mobile ? '' : 'sticky top-0 h-screen border-r border-slate-200'
      )}
    >
      {mobile ? (
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <BrandMark />
          <button
            type="button"
            onClick={onMobileClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={cn('flex h-[60px] items-center', collapsedView ? 'px-3 justify-center' : 'px-5')}>
          {collapsedView ? <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-slate-200" /> : <BrandMark />}
        </div>
      )}

      <nav className={cn('space-y-5 py-4', collapsedView ? 'px-2' : 'px-3')}>
        <SidebarGroupBlock header="홈" collapsed={collapsedView}>
          <SidebarLink item={{ key: 'home', label: '대시보드', icon: Home }} collapsed={collapsedView} />
        </SidebarGroupBlock>
        {groups.map((group) => (
          <SidebarGroupBlock key={group.header} header={group.header} collapsed={collapsedView}>
            {group.items.map((item) => (
              <SidebarLink key={item.key} item={item} collapsed={collapsedView} />
            ))}
          </SidebarGroupBlock>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-slate-200 px-4 pt-4 pb-6">
        <button
          type="button"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          <CreditCard className={cn('h-4 w-4 text-slate-600', collapsedView ? '' : 'mr-2')} />
          {collapsedView ? null : '결제/플랜'}
        </button>
      </div>
    </aside>
  );
}
