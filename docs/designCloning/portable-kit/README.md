# Portable Kit

목적:
- 다른 프로젝트의 LLM이 현재 저장소 접근 없이도 바로 옮겨 적을 수 있는 UI 코드 패킷
- `portable-kit`는 designCloning 폴더 안에서 직접 재사용 가능한 이식용 구현 킷이다.

필수 읽기 순서:
1. `../00-manifest.md`
2. `../01-foundations.md`
3. `README.md`
4. `src/styles/mejai-theme.css`
5. `src/lib/cn.ts`
6. `src/components/ui/*`
7. `src/components/design-system/*`
8. `src/components/layout/*`

필수 의존성:
- `react`
- `lucide-react`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `@radix-ui/react-slot`

사용 규칙:
- 먼저 `src/styles/mejai-theme.css`를 전역 스타일로 반영한다.
- 그런 다음 `src/components/ui`와 `src/components/design-system`을 그대로 사용한다.
- 앱 크롬이 필요하면 `src/components/layout/AppHeader.clone.tsx`, `AppSidebar.clone.tsx`를 사용한다.
- 더 높은 fidelity가 필요하면 현재 저장소 루트 `src/*`를 직접 확인한다.
