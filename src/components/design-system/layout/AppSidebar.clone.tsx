'use client';

import Link from 'next/link';
import { CreditCard, Home, MessageCircle, PlusSquare, Settings, Sparkles, UserRound, Users, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type SidebarItem = {
  key: string;
  href?: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  active?: boolean;
  disabled?: boolean;
};

export type SidebarGroup = {
  header: string;
  items: SidebarItem[];
};

type AppSidebarCloneShellItemAttributes = (item: string) => Record<string, string>;

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

function BrandMark({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  const initial = label.trim().charAt(0).toUpperCase() || 'D';

  return (
    <span className="flex min-w-0 items-center gap-2" aria-label={label}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-sm font-semibold text-slate-700">
        {initial}
      </span>
      {collapsed ? null : (
        <span className="min-w-0 truncate font-semibold tracking-tight text-slate-900">{label}</span>
      )}
    </span>
  );
}

function SidebarGroupBlock({
  header,
  children,
  collapsed,
  shellItemAttributes,
}: {
  header: string;
  children: React.ReactNode;
  collapsed: boolean;
  shellItemAttributes?: AppSidebarCloneShellItemAttributes;
}) {
  return (
    <div {...shellItemAttributes?.('shell-sidebar-navigation-section')}>
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
  shellItemAttributes,
}: {
  item: SidebarItem;
  collapsed: boolean;
  shellItemAttributes?: AppSidebarCloneShellItemAttributes;
}) {
  const Icon = item.icon;
  const linkContent = (
    <>
      <Icon className={cn('h-4 w-4', item.active ? 'text-emerald-600' : 'text-slate-500')} />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      {(typeof item.badge === 'number' || typeof item.badge === 'string') && !collapsed ? (
        <span className="ml-auto rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
          {item.badge}
        </span>
      ) : null}
    </>
  );
  const className = cn(
    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm text-left transition',
    collapsed ? 'justify-center' : '',
    item.active ? 'border-slate-200 bg-slate-100 text-slate-900' : 'border-transparent text-slate-700 hover:bg-slate-50',
    item.disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''
  );

  if (item.href && !item.disabled) {
    return (
      <Link
        href={item.href}
        title={item.label}
        className={className}
        {...shellItemAttributes?.('shell-sidebar-navigation-link')}
      >
        {linkContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={item.label}
      className={className}
      disabled={item.disabled}
      {...shellItemAttributes?.('shell-sidebar-navigation-link')}
    >
      {linkContent}
    </button>
  );
}

export type AppSidebarCloneProps = {
  collapsed?: boolean;
  mobile?: boolean;
  groups?: SidebarGroup[];
  onMobileClose?: () => void;
  brandLabel?: string;
  brandHref?: string;
  homeItem?: SidebarItem | null;
  planHref?: string;
  planLabel?: string;
  showPlanLink?: boolean;
  shellItemAttributes?: AppSidebarCloneShellItemAttributes;
  className?: string;
};

export function AppSidebarClone({
  collapsed = false,
  mobile = false,
  groups = defaultGroups,
  onMobileClose,
  brandLabel = 'Dox',
  brandHref,
  homeItem = { key: 'home', href: '/', label: '대시보드', icon: Home },
  planHref,
  planLabel = '결제/플랜',
  showPlanLink = true,
  shellItemAttributes,
  className,
}: AppSidebarCloneProps) {
  const collapsedView = collapsed && !mobile;
  const brandContent = <BrandMark label={brandLabel} collapsed={collapsedView} />;
  const planLinkClassName = 'inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50';

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col overflow-y-auto bg-white transition-[width] duration-150',
        mobile ? 'flex-1 w-full' : collapsedView ? 'w-20' : 'w-72',
        mobile ? '' : 'sticky top-0 h-screen border-r border-slate-200',
        className
      )}
      {...shellItemAttributes?.('shell-sidebar')}
    >
      {mobile ? (
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-slate-200 px-4">
          {brandHref ? (
            <Link href={brandHref} className="min-w-0" {...shellItemAttributes?.('shell-sidebar-brand-link')}>
              {brandContent}
            </Link>
          ) : (
            <div className="min-w-0" {...shellItemAttributes?.('shell-sidebar-brand-link')}>
              {brandContent}
            </div>
          )}
          <button
            type="button"
            onClick={onMobileClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            aria-label="닫기"
            title="닫기"
            {...shellItemAttributes?.('shell-sidebar-mobile-close-button')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={cn('flex h-[60px] items-center', collapsedView ? 'px-3 justify-center' : 'px-5')}>
          {brandHref ? (
            <Link href={brandHref} className="min-w-0" {...shellItemAttributes?.('shell-sidebar-brand-link')}>
              {brandContent}
            </Link>
          ) : (
            <div className="min-w-0" {...shellItemAttributes?.('shell-sidebar-brand-link')}>
              {brandContent}
            </div>
          )}
        </div>
      )}

      <nav className={cn('space-y-5 py-4', collapsedView ? 'px-2' : 'px-3')} {...shellItemAttributes?.('shell-sidebar-navigation')}>
        {homeItem ? (
          <SidebarGroupBlock header="홈" collapsed={collapsedView} shellItemAttributes={shellItemAttributes}>
            <SidebarLink item={homeItem} collapsed={collapsedView} shellItemAttributes={shellItemAttributes} />
          </SidebarGroupBlock>
        ) : null}
        {groups.map((group) => (
          <SidebarGroupBlock key={group.header} header={group.header} collapsed={collapsedView} shellItemAttributes={shellItemAttributes}>
            {group.items.map((item) => (
              <SidebarLink key={item.key} item={item} collapsed={collapsedView} shellItemAttributes={shellItemAttributes} />
            ))}
          </SidebarGroupBlock>
        ))}
      </nav>

      {showPlanLink ? (
        <div className="mt-auto space-y-3 border-t border-slate-200 px-4 pt-4 pb-6" {...shellItemAttributes?.('shell-sidebar-footer')}>
          {planHref ? (
            <Link href={planHref} className={planLinkClassName} {...shellItemAttributes?.('shell-sidebar-plan-link')}>
              <CreditCard className={cn('h-4 w-4 text-slate-600', collapsedView ? '' : 'mr-2')} />
              {collapsedView ? null : planLabel}
            </Link>
          ) : (
            <button
              type="button"
              className={planLinkClassName}
              {...shellItemAttributes?.('shell-sidebar-plan-link')}
            >
              <CreditCard className={cn('h-4 w-4 text-slate-600', collapsedView ? '' : 'mr-2')} />
              {collapsedView ? null : planLabel}
            </button>
          )}
        </div>
      ) : null}
    </aside>
  );
}
