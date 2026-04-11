"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  MessageCircle,
  PlusSquare,
  Shield,
  Sparkles,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type MouseEvent } from "react";
import { useConversationAdminStatus } from "@/lib/conversation/client/useConversationAdminStatus";
import {
  getFirstTeamTutorialTargetProps,
  type FirstTeamTutorialStep,
} from "@/components/FirstTeamTutorialGate";
import { APP_CREATE_PATH, buildBillingSettingsHref, buildSettingsTabHref } from "@/lib/appRoutes";
import { APP_SHELL_FLOATING_ACTION_DESKTOP_BOTTOM, APP_SHELL_FLOATING_ACTION_MOBILE_BOTTOM } from "@/lib/appShellLayout";

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="랜딩 페이지로 이동">
      <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-slate-200">
        <Image src="/brand/logo.svg" alt="Mejai logo" fill sizes="36px" className="object-cover" priority />
      </div>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight text-slate-900">Mejai</div>
      </div>
    </Link>
  );
}

function SidebarGroup({ header, children, collapsed }: { header: string; children: React.ReactNode; collapsed: boolean }) {
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
  to,
  icon: Icon,
  label,
  badge,
  badgeTone = "rose",
  onClick,
  collapsed,
  activePaths,
  tutorialTargetProps,
  tutorialHighlighted = false,
  tutorialLocked = false,
  onTutorialLockedClick,
  forceActive = false,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number | string;
  badgeTone?: "rose" | "sky";
  onClick?: () => void;
  collapsed: boolean;
  activePaths?: string[];
  tutorialTargetProps?: Record<string, string>;
  tutorialHighlighted?: boolean;
  tutorialLocked?: boolean;
  onTutorialLockedClick?: () => void;
  forceActive?: boolean;
}) {
  const pathname = usePathname();
  const hasActiveOverride = Array.isArray(activePaths) && activePaths.length > 0;
  const isActive = forceActive
    ? true
    : hasActiveOverride
      ? activePaths.some((path) => pathname === path || pathname.startsWith(path))
      : pathname === to || (to !== "/app" && pathname.startsWith(to));
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm text-left transition",
    collapsed ? "justify-center" : "",
    tutorialHighlighted
      ? "border-emerald-300 bg-emerald-50 text-slate-900 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]"
      : isActive
        ? "border-slate-200 bg-slate-100 text-slate-900"
        : "border-transparent text-slate-700 hover:bg-slate-50"
  );
  const iconClassName = cn(
    "h-4 w-4",
    tutorialHighlighted || isActive ? "text-emerald-600" : "text-slate-500"
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (tutorialLocked) {
      event.preventDefault();
      event.stopPropagation();
      onTutorialLockedClick?.();
      return;
    }
    onClick?.();
  };

  return (
    <Link href={to} onClick={handleClick} title={label} className={className} {...tutorialTargetProps}>
      <Icon className={iconClassName} />
      {collapsed ? null : <span className="truncate">{label}</span>}
      {(typeof badge === "number" || typeof badge === "string") && !collapsed ? (
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[11px]",
            badgeTone === "sky"
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AppSidebar({
  onNavigate,
  collapsed = false,
  mobile = false,
  reviewCount = null,
  teamInviteCount = null,
  firstTeamTutorialStep = null,
  onFirstTeamTeamClick,
  onFirstTeamCreateClick,
  onFirstTeamChatClick,
  onMobileClose,
}: {
  onNavigate: () => void;
  collapsed: boolean;
  mobile?: boolean;
  reviewCount?: number | null;
  teamInviteCount?: number | null;
  firstTeamTutorialStep?: FirstTeamTutorialStep | null;
  onFirstTeamTeamClick?: () => void;
  onFirstTeamCreateClick?: () => void;
  onFirstTeamChatClick?: () => void;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const isAdminUser = useConversationAdminStatus();

  const badgeCount =
    typeof reviewCount === "number" && reviewCount > 0
      ? reviewCount > 99
        ? "99+"
        : String(reviewCount)
      : undefined;
  const teamBadgeCount = typeof teamInviteCount === "number" && teamInviteCount > 0 ? teamInviteCount : undefined;
  const isTeamTutorialActive = firstTeamTutorialStep === "team-intro";
  const isCreateTutorialActive = firstTeamTutorialStep === "create-intro";
  const isChatTutorialActive = firstTeamTutorialStep === "chat-intro";
  const collapsedView = collapsed && !mobile;
  const createLinkHref = isCreateTutorialActive ? `${APP_CREATE_PATH}?first_tutorial=1` : APP_CREATE_PATH;
  const billingHref = buildBillingSettingsHref();
  const settingsHref = buildSettingsTabHref();

  return (
    <aside
      className={cn(
        "overflow-y-auto bg-white transition-[width] duration-150",
        mobile
          ? "flex min-h-0 flex-1 flex-col"
          : "sticky top-0 hidden h-screen border-r border-slate-200 md:flex md:flex-col",
        mobile ? "w-full" : collapsedView ? "md:w-20" : "md:w-72"
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
        <div className={cn("flex h-[60px] items-center", collapsedView ? "px-3" : "px-5")}>
          {collapsed ? (
            <div className="flex w-full items-center justify-center">
              <Link href="/" aria-label="랜딩 페이지로 이동" title="Mejai">
                <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-slate-200">
                  <Image src="/brand/logo.svg" alt="Mejai logo" fill sizes="36px" className="object-cover" priority />
                </div>
              </Link>
            </div>
          ) : (
            <BrandMark />
          )}
        </div>
      )}

      <nav className={cn("space-y-5 py-4", collapsedView ? "px-2" : "px-3")}>
        <SidebarGroup header="고객 정보" collapsed={collapsedView}>
          <SidebarLink
            to="/app/contacts"
            icon={UserRound}
            label="고객"
            collapsed={collapsedView}
            activePaths={["/app/contacts", "/app/users"]}
            onClick={onNavigate}
          />
        </SidebarGroup>

        <SidebarGroup header="에이전트" collapsed={collapsedView}>
          <SidebarLink
            to="/app/quickcreate"
            icon={Sparkles}
            label="빠른생성"
            collapsed={collapsedView}
            onClick={onNavigate}
          />
          <SidebarLink
            to={createLinkHref}
            icon={PlusSquare}
            label="생성하기"
            collapsed={collapsedView}
            onClick={() => {
              onFirstTeamCreateClick?.();
              onNavigate();
            }}
            tutorialTargetProps={getFirstTeamTutorialTargetProps("create-button")}
            tutorialHighlighted={isCreateTutorialActive}
            forceActive={isCreateTutorialActive}
          />
          <SidebarLink
            to="/app/chat"
            icon={MessageCircle}
            label="대화기록"
            badge={badgeCount}
            collapsed={collapsedView}
            onClick={() => {
              onFirstTeamChatClick?.();
              onNavigate();
            }}
            tutorialTargetProps={getFirstTeamTutorialTargetProps("chat-button")}
            tutorialHighlighted={isChatTutorialActive}
            forceActive={isChatTutorialActive}
          />
        </SidebarGroup>

        <SidebarGroup header="설정" collapsed={collapsedView}>
          <SidebarLink
            to="/app/team"
            icon={Users}
            label="팀"
            badge={teamBadgeCount}
            badgeTone="sky"
            collapsed={collapsedView}
            onClick={onNavigate}
            tutorialTargetProps={getFirstTeamTutorialTargetProps("team-button")}
            tutorialHighlighted={isTeamTutorialActive}
            tutorialLocked={isTeamTutorialActive}
            onTutorialLockedClick={onFirstTeamTeamClick}
            forceActive={isTeamTutorialActive}
          />
          <SidebarLink
            to={settingsHref}
            icon={Settings}
            label="설정"
            collapsed={collapsedView}
            onClick={onNavigate}
          />
          {isAdminUser ? (
            <SidebarLink
              to="/app/admin"
              icon={Shield}
              label="어드민"
              collapsed={collapsedView}
              onClick={onNavigate}
            />
          ) : null}
        </SidebarGroup>
      </nav>

      <div
        className="mt-auto space-y-3 border-t border-slate-200 px-4 pt-4"
        style={{ paddingBottom: mobile ? APP_SHELL_FLOATING_ACTION_MOBILE_BOTTOM : APP_SHELL_FLOATING_ACTION_DESKTOP_BOTTOM }}
      >
        <Link
          href={billingHref}
          onClick={onNavigate}
          title="결제/플랜"
          aria-label="결제/플랜"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          <CreditCard className={cn("h-4 w-4 text-slate-600", collapsedView ? "" : "mr-2")} />
          {collapsedView ? null : "결제/플랜"}
        </Link>
      </div>
    </aside>
  );
}
