# Patterns

원본 기준 파일:
- `src/components/design-system/patterns.tsx`
- `src/components/design-system/tabs.tsx`
- `src/components/design-system/shells.tsx`
- `src/components/design-system/index.ts`

## 패턴 export
| export | 파일 | 언제 사용 | 핵심 계약 | 금지 |
| --- | --- | --- | --- | --- |
| `PanelCard` | `patterns.tsx` | 얕은 배경 패널 | `rounded-2xl border border-slate-300 bg-slate-50` | 동일 패널을 feature 로컬 wrapper로 재정의 |
| `AdminTag` | `patterns.tsx` | 어드민 표시 | amber tone 고정 | 임의 색상 태그 생성 |
| `StateBanner` | `patterns.tsx` | info/success/warning/danger 상태 배너 | tone별 border/bg/text 세트, optional actions | 상태 경고 박스를 새로 구현 |
| `InlineToggle` | `patterns.tsx` | ON/OFF 상태 pill | `checked` boolean only | switch UI를 새로 추론 |
| `SectionBlock` | `patterns.tsx` | 섹션 카드 + 제목/설명 | `id`, `title`, `description`, `children` | 페이지마다 섹션 헤더 구조 분기 |
| `UnderlineTabs` | `tabs.tsx` | 일반 탭 | `tabs`, `activeKey`, `onSelect` | 직접 tab bar 재구현 |
| `PillTabs` | `tabs.tsx` | sticky pill 탭 | `sticky` default `true` | pill variant를 임의 클래스 조합으로 제작 |

## shells 파일 해석 규칙
`shells.tsx`는 실제 서비스 공통 크롬이라기보다 "패턴 시연 + 복제 기준 샘플"이다.

| export | 의미 | 사용 기준 |
| --- | --- | --- |
| `TypographyScaleShell` | 타이포 스케일 샘플 | 폰트/크기 기준을 확인할 때 사용 |
| `PageActionBarShell` | 페이지 액션바 패턴 샘플 | 상단 액션 영역 밀도 확인 |
| `SidebarNavigationShell` | 사이드바 링크 패턴 샘플 | 링크 높이, 배지, 그룹 간격 참조 |
| `TopHeaderShell` | 헤더 패턴 샘플 | blur, 검색창, 우측 액션 밀도 참조 |
| `OverlayShell` | modal/drawer/menu 샘플 | 레이어 z-index와 상호작용 참고 |

## 사용 순서
1. `patterns.tsx`와 `tabs.tsx`에서 바로 쓸 수 있는지 확인
2. 실제 앱 크롬은 `AppHeader.tsx`와 `AppSidebar.tsx`를 참조
3. 데모 shell의 시각 밀도만 가져오고, 실제 서비스 조립은 상위 참조 파일 기준으로 맞춘다

## 금지
- shell 데모를 읽지 않고 헤더/사이드바를 새로 디자인
- `UnderlineTabs`와 `PillTabs`가 있는데 페이지 전용 탭 구현 추가
