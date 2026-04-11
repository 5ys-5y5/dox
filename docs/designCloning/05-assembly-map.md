# Assembly Map

원본 기준 파일:
- `src/components/AppHeader.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/create/CreateWorkspacePage.tsx`

## 실제 서비스 조립 참조

### Header
기준 파일:
- `src/components/AppHeader.tsx`

관찰 포인트:
- 높이 `60px`
- `bg-white/90`, `backdrop-blur-[8px]`, `border-b border-slate-200`
- 좌측 메뉴 버튼 + 페이지 타이틀 + 우측 검색/팀 스위처/프로필 메뉴
- 검색 input은 primitive `input` 시각 규칙을 그대로 따르면서 header 맥락에 맞게 조정됨

규칙:
- 헤더가 필요하면 먼저 이 파일의 간격/blur/액션 밀도를 참조한다.
- shell 데모보다 이 파일이 실제 제품 기준이다.

### Sidebar
기준 파일:
- `src/components/AppSidebar.tsx`

관찰 포인트:
- 그룹 헤더는 `text-[11px] text-slate-500`
- 링크는 `rounded-xl border px-3 py-2 text-sm`
- active는 `border-slate-200 bg-slate-100`
- badge는 `rose` 또는 `sky` tone
- 모바일/데스크톱, collapsed/expanded 변형이 이미 존재

규칙:
- 사이드바 그룹/링크를 새로 설계하지 않는다.
- 새로운 서비스가 좌측 탐색 구조를 가지면 이 패턴을 기준으로 맞춘다.

### Create Workspace
기준 파일:
- `src/components/create/CreateWorkspacePage.tsx`

관찰 포인트:
- 상위 오케스트레이션 컴포넌트
- `StateBanner` 같은 design-system 컴포넌트를 실제 화면에서 소비
- 탭/튜토리얼/프리뷰/워크스페이스 관련 하위 컴포넌트 조립을 담당

규칙:
- 이 파일은 직접 복제 대상이라기보다 "design-system이 실제 제품 화면에서 소비되는 증거"로 사용한다.
- 대형 페이지를 만들 때 하위 레이어부터 import 하고, 이 파일은 spacing/배치 참조용으로만 읽는다.

## 조립 우선순위
1. `ui/*`
2. `design-system/*`
3. 실제 조립 참조 파일
4. 대상 서비스 파일

## 금지
- `AppHeader.tsx`와 `AppSidebar.tsx`를 읽지 않고 대시보드 크롬을 임의 설계
- `CreateWorkspacePage.tsx`를 통째 복제해 다른 서비스에 붙이는 방식의 과복제
