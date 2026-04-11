"use client";

import { useState } from "react";
import {
  Book,
  Bot,
  ClipboardCheck,
  House,
  Inbox,
  Menu,
  Palette,
  Phone,
  PhoneCall,
  RefreshCw,
  Route,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function TypographyScaleShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      <div className="text-sm font-semibold text-slate-900">Typography Scale (폰트/크기/두께 기준)</div>
      <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
        <div className="grid grid-cols-[120px_120px_120px_minmax(220px,1fr)] bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
          <span>Token</span>
          <span>Size</span>
          <span>Weight</span>
          <span>Sample</span>
        </div>
        <div className="grid grid-cols-[120px_120px_120px_minmax(220px,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
          <code>text-xs</code>
          <span>12px</span>
          <span>400</span>
          <span className="text-xs">보조 정보/메타 텍스트</span>
        </div>
        <div className="grid grid-cols-[120px_120px_120px_minmax(220px,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
          <code>text-sm</code>
          <span>14px</span>
          <span>400</span>
          <span className="text-sm">기본 본문 텍스트</span>
        </div>
        <div className="grid grid-cols-[120px_120px_120px_minmax(220px,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
          <code>text-base</code>
          <span>16px</span>
          <span>500</span>
          <span className="text-base">강조 본문/섹션 본문</span>
        </div>
        <div className="grid grid-cols-[120px_120px_120px_minmax(220px,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
          <code>text-lg</code>
          <span>18px</span>
          <span>500</span>
          <span className="text-lg">소제목</span>
        </div>
        <div className="grid grid-cols-[120px_120px_120px_minmax(220px,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
          <code>text-2xl</code>
          <span>24px</span>
          <span>700</span>
          <span className="text-2xl font-semibold">페이지 타이틀</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        기본 폰트 패밀리: <code>Apple SD Gothic Neo</code>
      </div>
    </div>
  );
}

export function PageActionBarShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      <div className="mb-2 text-sm font-semibold text-slate-900">Page Action Bar Pattern</div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <Button variant="outline" className="h-9 text-xs">
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 text-xs">
            CSV 내보내기
          </Button>
          <Button className="h-9 text-xs">추가</Button>
        </div>
      </div>
    </div>
  );
}

export function SidebarNavigationShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      <div className="mb-2 text-sm font-semibold text-slate-900">Sidebar Link Pattern</div>
      <nav className="rounded-xl border border-slate-200 bg-white py-4 px-3 space-y-5">
        <div>
          <div className="px-3 text-[11px] font-medium text-slate-500">홈</div>
          <div className="mt-2 space-y-1">
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <House className="h-4 w-4 text-slate-500" />
              <span className="truncate">대시보드</span>
            </a>
          </div>
        </div>
        <div>
          <div className="px-3 text-[11px] font-medium text-slate-500">모니터링</div>
          <div className="mt-2 space-y-1">
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <PhoneCall className="h-4 w-4 text-slate-500" />
              <span className="truncate">통화/세션</span>
            </a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Inbox className="h-4 w-4 text-slate-500" />
              <span className="truncate">후속 지원 요청</span>
            </a>
          </div>
        </div>
        <div>
          <div className="px-3 text-[11px] font-medium text-slate-500">구성</div>
          <div className="mt-2 space-y-1">
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="truncate">에이전트</span>
            </a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Bot className="h-4 w-4 text-slate-500" />
              <span className="truncate">실험실</span>
            </a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <ClipboardCheck className="h-4 w-4 text-slate-500" />
              <span className="truncate">평가/관리</span>
            </a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Book className="h-4 w-4 text-slate-500" />
              <span className="truncate">지식 베이스</span>
            </a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Route className="h-4 w-4 text-slate-500" />
              <span className="truncate">규칙</span>
            </a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-slate-200 bg-slate-100 text-slate-900" href="#">
              <Palette className="h-4 w-4 text-emerald-600" />
              <span className="truncate">디자인 시스템</span>
            </a>
          </div>
        </div>
        <div>
          <div className="px-3 text-[11px] font-medium text-slate-500">온보딩</div>
          <div className="mt-2 space-y-1">
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Phone className="h-4 w-4 text-slate-500" />
              <span className="truncate">번호/정책 설정</span>
            </a>
          </div>
        </div>
        <div>
          <div className="px-3 text-[11px] font-medium text-slate-500">설정</div>
          <div className="mt-2 space-y-1">
            <a className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent text-slate-700 hover:bg-slate-50" href="#">
              <Settings className="h-4 w-4 text-slate-500" />
              <span className="truncate">설정</span>
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}

export function TopHeaderShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      <div className="mb-2 text-sm font-semibold text-slate-900">Top Header Pattern</div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-transparent text-slate-600 hover:bg-slate-100">
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium text-slate-900">대시보드</div>
          <div className="flex-1" />
          <Input placeholder="검색..." className="h-8 w-56 text-xs" />
          <button className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700">A</button>
        </div>
      </div>
    </div>
  );
}

export function OverlayShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={cn(className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
        <Button variant="outline" onClick={() => setDrawerOpen(true)}>
          드로어 열기
        </Button>
        <div className="relative">
          <Button variant="ghost" onClick={() => setMenuOpen((v) => !v)}>
            메뉴
          </Button>
          {menuOpen ? (
            <div className="absolute right-0 top-10 z-40 w-40 rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
              <button type="button" className="mb-1 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600">
                선택 ON
              </button>
              <button type="button" className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600">
                로그 ON
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">현재 레이어 우선순위 정책은 다음 단계에서 token으로 통합 예정</div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">샘플 모달</div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 p-1 text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 text-sm text-slate-600">설정 상세를 표시하는 레이어 샘플</div>
          </div>
        </div>
      ) : null}

      {drawerOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 z-50 w-72 border-r border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">샘플 드로어</div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg border border-slate-200 p-1 text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-600">모바일 네비게이션/설정 패널 형태</div>
          </div>
        </>
      ) : null}
    </div>
  );
}
