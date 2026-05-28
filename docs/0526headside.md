# 0526 중앙 헤더/사이드 네비게이션 설계

## 목적
- `http://localhost:3001/project` 페이지에 먼저 적용할 중앙화 UI 2종을 설계한다.
- 대상 UI는 화면 상단 고정 헤더와 화면 좌측 고정 네비게이션 탭이다.
- 예시로 제공된 외부 서비스 HTML은 시각/동작 참고만 한다. `data-mejai-ui-*`, 외부 라우트, 외부 브랜드 구조를 그대로 복사하지 않는다.
- 이후 `/documents`, `/canvas`, 기타 owner 페이지도 같은 컴포넌트를 import하여 같은 레이아웃 규칙을 사용할 수 있어야 한다.

## 제안 폴더
`src/components/design-system/layout/app-shell/`

이 위치를 제안하는 이유:
- 이미 `src/components/design-system/layout/`에 `AppHeader.clone.tsx`, `AppSidebar.clone.tsx`가 있어 유사한 중앙 레이아웃 UI 맥락이 존재한다.
- `.clone` 파일은 복제/실험 성격이 강하므로 실제 재사용 컴포넌트는 별도 하위 폴더에 명확한 소유권으로 둔다.
- header/sidebar/page frame/mobile drawer/navigation item 같은 앱 공통 shell UI가 한 폴더에 모이게 된다.
- `src/components/ui/`는 Button, Card, Picker 같은 원자/범용 UI가 중심이므로 페이지 shell 구조를 넣기에는 범위가 크다.

예상 파일 구조:
```txt
src/components/design-system/layout/app-shell/
  AppShellHeader.tsx
  AppShellSidebar.tsx
  AppShellFrame.tsx
  appShellNavigation.ts
  appShellTypes.ts
  index.ts
```

## 중앙 UI 명명 원칙
- 공통 shell 컴포넌트 내부 항목에는 `data-app-shell-item`을 사용한다.
- 적용 페이지의 소유 UI에는 기존처럼 `data-project-owner-item`, `data-documents-owner-item`, `data-canvas-owner-item`을 유지한다.
- 외부 코드의 `data-mejai-ui-item`, `data-mejai-ui-source`는 사용하지 않는다.
- 위치 기반 자동 명명은 금지한다. 구조 변경 시 의미가 사라지기 때문이다.

예상 명명:
```tsx
data-app-shell-item="shell-header"
data-app-shell-item="shell-header-sidebar-toggle"
data-app-shell-item="shell-header-page-title"
data-app-shell-item="shell-header-workspace-switcher"
data-app-shell-item="shell-header-profile-button"
data-app-shell-item="shell-sidebar"
data-app-shell-item="shell-sidebar-brand-link"
data-app-shell-item="shell-sidebar-navigation"
data-app-shell-item="shell-sidebar-navigation-section"
data-app-shell-item="shell-sidebar-navigation-link"
data-app-shell-item="shell-sidebar-plan-link"
```

## UI 1. AppShellHeader
역할:
- 페이지 상단에 `sticky top-0 z-30`으로 고정된다.
- 높이는 `60px`를 기준으로 한다.
- 좌측에는 사이드바 토글 버튼, 중앙에는 현재 페이지 제목, 우측에는 워크스페이스/프로필 액션을 둔다.
- `/project`에서는 페이지 제목을 예: `현장 관리`로 전달한다.

Props 초안:
```ts
type AppShellHeaderProps = {
  title: string;
  workspaceLabel?: string;
  profileLabel?: string;
  sidebarToggleLabel?: string;
  onSidebarToggle?: () => void;
  workspaceMenu?: React.ReactNode;
  profileMenu?: React.ReactNode;
};
```

스타일 기준:
- 예시의 `bg-white/90`, `backdrop-blur-[8px]`, `border-b border-slate-200`, `h-[60px]`, `px-4 md:px-8`를 현재 서비스 스타일에 맞게 사용한다.
- 아이콘은 직접 SVG 복사가 아니라 `lucide-react` 아이콘을 사용한다.
- 텍스트는 한 줄 말줄임 처리한다.

## UI 2. AppShellSidebar
역할:
- 데스크톱에서 좌측에 `sticky top-0 h-screen border-r border-slate-200`로 고정된다.
- 모바일에서는 기본 숨김 처리하고, 헤더 토글과 연결 가능한 구조를 제공한다.
- 네비게이션 데이터는 컴포넌트 내부 하드코딩이 아니라 `items` props 또는 `appShellNavigation.ts`에서 관리한다.
- `/project` 우선 적용 시 현장 관리 페이지를 active로 표시한다.

Props 초안:
```ts
type AppShellNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  active?: boolean;
  disabled?: boolean;
};

type AppShellNavigationSection = {
  id: string;
  label: string;
  items: AppShellNavigationItem[];
};

type AppShellSidebarProps = {
  brandLabel?: string;
  brandHref?: string;
  sections: AppShellNavigationSection[];
  planHref?: string;
  planLabel?: string;
  collapsed?: boolean;
  mobile?: boolean;
  onMobileClose?: () => void;
};
```

스타일 기준:
- 예시의 `w-72`, `space-y-5 py-4 px-3`, `rounded-xl border px-3 py-2 text-sm` 패턴을 따른다.
- 현재 서비스 라우트에 맞게 `/project`, `/documents`, `/canvas`, `/templates` 등으로 재구성한다.
- 링크는 Next `Link` 사용을 우선한다.
- active 항목은 `border-slate-200 bg-slate-100 text-slate-900` 기준으로 출력한다.

## UI 3. AppShellFrame
역할:
- 헤더와 사이드바를 조립하는 페이지 프레임이다.
- 페이지별 본문은 `children`으로 들어간다.
- `/project`는 기존 본문을 `AppShellFrame` 안으로 넣고, 프로젝트 고유 UI의 `data-project-owner-item` 명명은 그대로 유지한다.

Props 초안:
```ts
type AppShellFrameProps = {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
};
```

예상 레이아웃:
```tsx
<div data-app-shell-item="shell-frame" className="min-h-screen bg-slate-50 md:flex">
  <AppShellSidebar />
  <div data-app-shell-item="shell-main-column" className="min-w-0 flex-1">
    <AppShellHeader />
    <main data-app-shell-item="shell-main-content">{children}</main>
  </div>
</div>
```

## `/project` 우선 적용 방식
1. `src/app/project/page.tsx`의 데이터/상태/현장 관리 로직은 유지한다.
2. 최상위 배경/본문 wrapper만 `AppShellFrame` 구조로 감싼다.
3. 기존 `/project` 내부 항목의 `data-project-owner-item`은 삭제하지 않는다.
4. 신규 공통 헤더/사이드바에는 `data-app-shell-item`만 사용한다.
5. `/project` 페이지의 고유 헤더가 이미 있다면, 중복되는 제목/상단 여백을 제거하거나 `AppShellHeader`와 역할이 겹치지 않게 재배치한다.

## 화이트리스트
구현 시 수정 허용:
- `src/components/design-system/layout/app-shell/**`
- `src/components/design-system/layout/index.ts`
- `src/components/design-system/index.ts`
- `src/app/project/page.tsx`
- `docs/0526headside.md`
- `docs/backups/0526headside/**`

구현 시 수정 금지:
- `/documents`, `/canvas` 기능 코드
- `src/components/template/**`
- API route
- 데이터 저장 로직
- 기존 owner 설정/문서 요청 기능
- 전역 CSS. 단, AppShell 구현이 불가능한 명확한 이유가 있을 때만 별도 승인 후 수정한다.

## 백업 계획
구현 전 아래 파일을 같은 이름의 백업 경로로 보관한다.
```txt
docs/backups/0526headside/src/app/project/page.tsx
docs/backups/0526headside/src/components/design-system/layout/index.ts
docs/backups/0526headside/src/components/design-system/index.ts
```

신규 파일은 백업이 아니라 체크리스트에 신규 생성으로 기록한다.

## 구현 체크리스트
- [x] `docs/backups/0526headside/`에 백업을 생성한다.
- [x] `src/components/design-system/layout/app-shell/appShellTypes.ts`를 만든다.
- [x] `src/components/design-system/layout/app-shell/appShellNavigation.ts`를 만든다.
- [x] `src/components/design-system/layout/app-shell/AppShellHeader.tsx`를 만든다.
- [x] `src/components/design-system/layout/app-shell/AppShellSidebar.tsx`를 만든다.
- [x] `src/components/design-system/layout/app-shell/AppShellFrame.tsx`를 만든다.
- [x] `src/components/design-system/layout/app-shell/index.ts`를 만든다.
- [x] `src/components/design-system/layout/index.ts`에서 app-shell export를 추가한다.
- [x] 필요 시 `src/components/design-system/index.ts`에서 app-shell export를 추가한다.
- [x] `/project` 페이지에 `AppShellFrame`, `AppShellHeader`, `AppShellSidebar`를 우선 적용한다.
- [x] `AppShellHeader`, `AppShellSidebar`가 기존 `AppHeaderClone`, `AppSidebarClone` UI를 재사용하도록 재구현한다.
- [x] 외부 예시의 `data-mejai-ui-*`가 코드에 남지 않았는지 `rg "data-mejai-ui|page-app-create-tab"`로 확인한다. 수정 범위 기준 통과.
- [x] 모든 신규 shell 항목에 의미 기반 `data-app-shell-item`이 있는지 확인한다.
- [x] 기존 `/project` 고유 항목의 `data-project-owner-item`이 손실되지 않았는지 확인한다.
- [x] `npm run check:no-shadow-app`를 실행한다.
- [ ] 브라우저에서 `http://localhost:3001/project`를 직접 열어 헤더 sticky, 사이드바 sticky, 본문 스크롤을 확인한다. 현재 실행 환경에서 `listen EPERM`으로 dev 서버 시작 불가.

## 구현 제외
- 실제 인증/팀 전환 팝오버 구현
- 프로필 상세 메뉴 구현
- 모바일 drawer 완성
- `/documents`, `/canvas` 적용
- 외부 서비스와 동일한 라우트/문구/브랜드 복제
