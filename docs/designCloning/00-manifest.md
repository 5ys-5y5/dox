# Design Cloning Manifest

원본 기준 파일:
- `src/app/globals.css`
- `src/lib/utils.ts`
- `src/components/ui/*`
- `src/components/design-system/*`
- `src/components/AppHeader.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/create/CreateWorkspacePage.tsx`

## 목적
- 현재 Mejai UI를 다른 서비스에서 "유사 구현"이 아니라 "원본 재사용"으로 옮기기 위한 최소 인덱스다.
- 이 폴더는 템플릿 reference와 이식용 코드 패킷을 제공한다.
- 실제 운영 구현 코드는 현재 저장소 루트 `src/*`에 있으며, 이 폴더는 이를 직접 복제한 실행본을 포함하지 않는다.
- 먼저 이 파일을 읽고, 그 다음 문서와 `portable-kit`를 읽는다.

## 읽기 순서
1. `docs/designcloning.md`
2. `docs/designCloning/00-manifest.md`
3. `docs/designCloning/01-foundations.md`
4. `docs/designCloning/02-primitives.md`
5. `docs/designCloning/03-patterns.md`
6. `docs/designCloning/04-conversation-widget.md`
7. `docs/designCloning/05-assembly-map.md`
8. `docs/designCloning/06-prompt-contract.md`
9. `docs/designCloning/07-checklist-diff-map.md`
10. `docs/designCloning/portable-kit/README.md`
11. `docs/designCloning/portable-kit/src/**/*`
12. 대상 서비스 파일

## 코드 패킷
| 폴더 | 역할 | 읽는 이유 |
| --- | --- | --- |
| `docs/designCloning/portable-kit` | 이식성 높은 코드 킷 | 다른 프로젝트에 바로 옮길 수 있는 low-business-dependency 코드 제공 |

## 원본 레이어
| 레이어 | 기준 파일 | 우선 행동 |
| --- | --- | --- |
| Foundations | `src/app/globals.css`, `src/lib/utils.ts`, `package.json`, `postcss.config.mjs` | 폰트, 토큰, Tailwind v4, `cn()` 확인 |
| Primitives | `src/components/ui/*` | 버튼/입력/카드/뱃지/스켈레톤을 직접 import 또는 파일 단위 복제 |
| Patterns | `src/components/design-system/patterns.tsx`, `tabs.tsx`, `shells.tsx` | feature-local 재구현 대신 패턴 우선 사용 |
| Conversation/Widget | `src/components/design-system/conversation/*`, `widget/*` | 대화 UI와 위젯 UI를 단일 원본으로 사용 |
| Assembly Reference | `src/components/AppHeader.tsx`, `AppSidebar.tsx`, `CreateWorkspacePage.tsx` | 실제 spacing/조립 방식만 참조 |

## import 우선순위
1. 다른 프로젝트이고 현재 저장소 접근이 없으면 `portable-kit`를 먼저 사용
2. 더 높은 fidelity가 필요하면 현재 저장소 루트 `src/*`를 직접 확인한다
3. 같은 저장소면 기존 `@/components/design-system` 또는 `@/components/ui` 직접 import
4. 직접 import가 막히면 원본 파일을 묶음 단위로 복제
5. 변형이 필요하면 가장 낮은 공통 레이어를 수정

## 금지
- 스크린샷 기억 기반 Tailwind 재조합
- feature 폴더 내부 duplicate component 생성
- 원본을 읽지 않은 채 새 디자인 시스템 혼합
- `Apple SD Gothic Neo` / slate / radius 체계 임의 변경
