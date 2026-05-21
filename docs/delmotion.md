# DELMOTION-01 리스트 모션 제거 설계

## 목표

`/project`에서 리스트에 값이 등록될 때 행 높이가 커졌다가 줄어드는 것처럼 보이는 모션을 사후 차단 CSS로 덮지 않고, 리스트 컴포넌트의 렌더링 원인에서 제거한다.

현재 `/project`의 `.project-no-motion * { animation: none; transition: none; }` 방식은 금지한다. 이 규칙은 페이지 전체 상호작용을 일괄 무력화하므로 원인 해결이 아니다.

## 절대 금지 범위

다음 경로와 개념은 이번 작업의 수정 대상이 아니다.

- `src/app/canvas/**`
- `src/components/template/**`
- `src/lib/template*`
- `src/services/template*`
- 문서 편집 캔버스의 `자동 높이`, `자동 너비`, `grow_height`, `grow_width`, 텍스트 자동 맞춤, 프레임 자동 크기 계산

위 기능은 `/canvas` 및 문서 생성/편집의 필수 기능이며, 리스트 행 모션과 무관하다. 리스트 모션 제거를 이유로 자동 높이/너비 속성, 측정 함수, 프레임/텍스트 크기 조정 로직을 삭제하거나 변경하지 않는다.

## 수정 화이트리스트

구현 시 수정 가능한 파일은 아래 2개로 제한한다.

1. `src/components/ui/MejaiScrollTable.tsx`
2. `src/app/project/page.tsx`

검토만 허용되는 파일:

- `src/app/member-access/page.tsx`

`MejaiScrollTable`을 사용하는 서비스 목록 검증 목적의 읽기 전용 파일이다. 구현 단계에서 이 파일은 수정하지 않는다.

화이트리스트 밖의 파일은 문서, 타입, 스타일, 테스트 편의 목적이라도 수정하지 않는다.

## 현재 원인 후보

1. `MejaiScrollTable`은 `ResizeObserver`와 `bodyRowHeights` 상태로 실제 표 행 높이를 측정하고, 오른쪽 filler 영역 행 높이를 맞춘다.
2. 이 측정은 현재 `React.useEffect`에서 실행된다. 행 추가 직후 첫 paint 이후에 보정 상태가 들어오면 사용자는 행 높이가 한 번 커졌다가 줄어드는 것처럼 볼 수 있다.
3. `MejaiScrollTable` 내부에 `transition-opacity duration-200`, `transition-colors`가 남아 있다. 높이 전용 transition은 아니지만 리스트 컴포넌트 자체에 motion class가 남아 있으므로 제거 대상이다.
4. `/project`는 `.project-no-motion` 전역 규칙으로 animation/transition을 모두 끄고 있다. 이는 원인 제거가 아니라 사후 처리이므로 마지막에 제거한다.

## 구현 설계

### C01. `MejaiScrollTable`에서 리스트 모션 원인 제거

- `rows`/`columns` 변경 직후 높이 측정이 paint 이후에 보이지 않도록 `React.useEffect` 기반 측정 effect를 `React.useLayoutEffect`로 전환한다.
- `ResizeObserver`와 `bodyRowHeights` 자체는 유지한다. filler 영역의 구조적 높이 동기화 기능이므로 삭제하지 않는다.
- `transition-opacity duration-200`를 제거해 좌우 스크롤 힌트가 즉시 표시/숨김되게 한다.
- 행의 `transition-colors`를 제거한다. hover 색상은 즉시 바뀌어도 된다.
- 높이 보정 로직을 타이머, CSS animation, `requestAnimationFrame` 기반 지연 처리로 대체하지 않는다.

### C02. `/project`의 사후 차단 규칙 제거

- 루트 className에서 `project-no-motion`을 제거한다.
- 루트 아래 inline `<style>`의 `.project-no-motion` animation/transition 차단 규칙을 삭제한다.
- 삭제 후에도 `MejaiScrollTable` 기반 목록에서 등록 시 행 높이 모션이 없어야 한다.

### C03. 유지해야 할 동작

- `/project`의 목록 클릭, 펼침 행, 삭제 버튼, 문서 링크 복사 버튼은 그대로 동작해야 한다.
- `MejaiScrollTable`의 가로 스크롤, sticky right column, filler 영역 높이 맞춤은 유지해야 한다.
- `/member-access`의 `MejaiScrollTable` 목록은 같은 table 수정의 영향을 받지만, 파일 자체는 수정하지 않는다.
- `/canvas` 문서 자동 높이/너비 기능은 수정하지 않는다.

## 백업

구현 전 현재 상태 백업:

- `docs/diff/2026-05-21_DELMOTION-01_MejaiScrollTable.before.tsx`
- `docs/diff/2026-05-21_DELMOTION-01_project-page.before.tsx`
- `docs/diff/2026-05-21_DELMOTION-01_member-access-page.before.tsx`

복구 기준:

- C01 실패: `src/components/ui/MejaiScrollTable.tsx`를 `2026-05-21_DELMOTION-01_MejaiScrollTable.before.tsx`에서 복구한다.
- C02 실패: `src/app/project/page.tsx`를 `2026-05-21_DELMOTION-01_project-page.before.tsx`에서 복구한다.
- C03 중 `/member-access` 목록 회귀가 발견되면 `2026-05-21_DELMOTION-01_member-access-page.before.tsx`와 현재 파일을 비교한다. 구현 계획상 이 파일은 수정하지 않아야 하므로 차이가 있으면 화이트리스트 위반이다.

## 실행 체크리스트

- [x] DELMOTION-B01: 구현 전 관련 파일 현재 상태를 `docs/diff`에 백업한다.
- [x] DELMOTION-D01: 수정 화이트리스트와 금지 범위를 문서에 고정한다.
- [x] DELMOTION-C01: `MejaiScrollTable`의 행 높이 측정을 paint 전 동기화하고 table 자체 motion class를 제거한다.
- [x] DELMOTION-C02: `/project`의 `.project-no-motion` 전역 차단 규칙을 제거한다.
- [x] DELMOTION-V01: `rg -n "project-no-motion|transition-opacity|duration-200|transition-colors" src/app/project/page.tsx src/components/ui/MejaiScrollTable.tsx`로 금지 흔적을 확인한다.
- [x] DELMOTION-V02: `rg -n "auto-height|auto-width|grow_height|grow_width|data-template-frame-auto" src/app/canvas src/components/template src/lib src/services`는 읽기 검증만 수행하고 결과 파일을 수정하지 않는다.
- [x] DELMOTION-V03: `/project`에서 현장 문서, 서명 요청, 필수 사진, 필수 파일, 구성원, 문서 권한 목록에 항목을 추가하거나 목록 데이터가 갱신될 때 행 높이 모션이 보이지 않는지 확인한다.
- [x] DELMOTION-V04: `/member-access`의 현장 접근 권한, 접근 가능한 문서 목록에서 표 레이아웃과 클릭 이동이 유지되는지 확인한다.

## 구현 기록

- 2026-05-21: DELMOTION-C01 완료. `MejaiScrollTable`의 행 높이 측정 effect를 `React.useLayoutEffect`로 전환하고, 좌우 스크롤 힌트와 clickable row의 transition class를 제거했다. 문제가 있으면 `docs/diff/2026-05-21_DELMOTION-01_MejaiScrollTable.before.tsx`에서 복구한다.
- 2026-05-21: DELMOTION-C02 완료. `/project` 루트의 `project-no-motion` class와 inline 전역 motion 차단 style을 제거했다. 문제가 있으면 `docs/diff/2026-05-21_DELMOTION-01_project-page.before.tsx`에서 복구한다.
- 2026-05-21: DELMOTION-V01 완료. 금지 문자열 검색 결과가 비어 있음을 확인했다.
- 2026-05-21: DELMOTION-V02 완료. 자동 높이/너비 관련 경로는 검색만 수행했고 파일 수정은 하지 않았다.
- 2026-05-21: DELMOTION-V03 완료. `/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c&documentId=2f6d0be2-8ba5-4d69-aacf-845275a66908`에서 현장 문서 새로고침, 문서 상태 펼침, 필수 사진, 필수 파일, 기록 값, 서명 요청, 구성원 문서 권한 목록을 브라우저로 측정했다. 필수 파일은 임시 항목 추가/삭제까지 수행했다. 측정 결과 `transitionrun`, `transitionstart`, `animationstart` 이벤트 0건, 같은 행의 높이 변화 0건이다. 측정 산출물은 `/private/tmp/delmotion-v03-project.json`, `/private/tmp/delmotion-v03-file-add.json`이다.
- 2026-05-21: DELMOTION-V04 완료. 샌드박스에서 새 `next dev -p 3001` 서버 바인딩은 `listen EPERM`으로 불가했으므로, `/member-access`에 이미 로드된 클라이언트 화면에서 세션 API 응답만 검증용 fixture로 주입하고, 현장 접근 권한 목록 렌더, 현장 행 클릭 필터, 문서 검색 필터를 브라우저로 측정했다. 소스와 DB는 수정하지 않았다. 측정 결과 `transitionrun`, `transitionstart`, `animationstart` 이벤트 0건, 같은 행의 높이 변화 0건이다. 문서 열기 링크가 `/member-access/document/delmotion-doc-a1?phoneNumber=01093107159` 형태로 유지되는 것도 확인했다. 측정 산출물은 `/private/tmp/delmotion-v04-member-access.json`, `/private/tmp/delmotion-v04-member-access.snapshot.txt`이다.

## 완료 기준

- `/project`에 페이지 전체 motion 차단 CSS가 남아 있지 않다.
- 리스트 컴포넌트 자체에 행/스크롤 힌트 motion class가 남아 있지 않다.
- 행 높이 측정 보정이 사용자의 눈에 paint 이후 변경으로 보이지 않는다.
- `/canvas`와 템플릿 자동 높이/너비 관련 파일은 수정되지 않는다.
