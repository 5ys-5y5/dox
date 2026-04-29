# SELECTED-EDGE-001 Design Log

- 작성 일시: 2026-04-29
- 사용자 확정: 요청 본문으로 범위 확정
- 현재 턴 목적: `docs/selectededge.md` 설계 문서 작성
- 초기 설계 기록 시점 runtime 코드 수정: 없음

## 체크리스트 매핑

- `CHK-PLAN-SEL-EDGE-001`
  - 내용: 1회 클릭 connected, 2회 클릭 isolated 행동을 구현 가능한 계약으로 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/selectededge.md`

- `CHK-PLAN-SEL-EDGE-002`
  - 내용: stale selection 이 drag 로 누수되는 현재 원인을 정리한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/selectededge.md`

- `CHK-PLAN-SEL-EDGE-003`
  - 내용: 직접 연결된 끝점 adjacency 기준으로 connected cohort 규칙을 고정한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/selectededge.md`

- `CHK-PLAN-SEL-EDGE-004`
  - 내용: mutation target 집합을 service 계약으로 고정하는 설계를 남긴다.
  - 현재 상태: 완료
  - 반영 문서: `docs/selectededge.md`

- `CHK-PLAN-SEL-EDGE-005`
  - 내용: 수정 허용 화이트리스트와 백업 파일명을 고정한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/selectededge.md`

- `CHK-PLAN-SEL-EDGE-006`
  - 내용: MCP 실행 결과와 환경 제약을 기록한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/selectededge.md`

## 후속 구현 승인 시 생성해야 할 백업 파일

- `docs/diff/2026-04-29_SELECTED-EDGE-101_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_SELECTED-EDGE-102_templateEdgeSelectionService.before.ts`
- `docs/diff/2026-04-29_SELECTED-EDGE-103_templateEdgeTopologyService.before.ts`
- `docs/diff/2026-04-29_SELECTED-EDGE-104_templateEdgeSelectionDtos.before.ts`
- `docs/diff/2026-04-29_SELECTED-EDGE-105_templateEdgeResizeIntentService.before.ts`

## MCP 실행 기록

- `mcp__supabase__.list_migrations`
  - 결과: 성공
  - 비고: DB 변경 없음

- `mcp__chrome_devtools__.list_pages`
  - 결과: 성공
  - 비고: `about:blank` 1개만 attach 되어 대상 편집 페이지 실검증은 불가

- 로컬 dev 서버 기동 시도
  - `next dev` 실패: `listen EPERM: operation not permitted 0.0.0.0:3000`
  - `next dev -H 127.0.0.1 -p 3001` 실패: `listen EPERM: operation not permitted 127.0.0.1:3001`

## 비고

- 초기 기록 시점에는 설계 문서와 design log 만 작성했다.
- 이후 사용자의 구현 승인에 따라 아래 후속 구현 로그를 추가했다.

## 후속 구현 로그

- `2026-04-29_SELECTED-EDGE-101_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-PLAN-SEL-EDGE-001`, `CHK-PLAN-SEL-EDGE-002`, `CHK-PLAN-SEL-EDGE-004`
  - 목적: edge pointer flow, ref-state sync, target guard 수정 전 백업

- `2026-04-29_SELECTED-EDGE-102_templateEdgeSelectionService.before.ts`
  - 체크리스트: `CHK-PLAN-SEL-EDGE-001`, `CHK-PLAN-SEL-EDGE-002`
  - 목적: predicted activation result 도입 전 백업

- `2026-04-29_SELECTED-EDGE-103_templateEdgeTopologyService.before.ts`
  - 체크리스트: `CHK-PLAN-SEL-EDGE-003`
  - 목적: adjacency proof 와 직접 연결 cohort 계산 추가 전 백업

- `2026-04-29_SELECTED-EDGE-104_templateEdgeSelectionDtos.before.ts`
  - 체크리스트: `CHK-PLAN-SEL-EDGE-003`, `CHK-PLAN-SEL-EDGE-004`
  - 목적: activation / resize intent DTO 추가 전 백업

- `2026-04-29_SELECTED-EDGE-105_templateEdgeResizeIntentService.before.ts`
  - 체크리스트: `CHK-PLAN-SEL-EDGE-004`
  - 목적: 신규 resize intent service 부재 상태 기록

- 구현 반영 요약
  - `src/lib/templateEdgeSelectionDtos.ts`
    - direct adjacency, activation result, resize intent DTO 계약 추가
  - `src/services/templateEdgeTopologyService.ts`
    - direct neighbor adjacency proof 생성
    - connected cohort 계산을 direct chain 기준으로 유지하면서 proof 데이터 반환
  - `src/services/templateEdgeSelectionService.ts`
    - `resolveActivation()` 추가
    - 1회 클릭 connected, 2회 클릭 isolated 결과를 `effectiveEdgeIds` 와 함께 반환
  - `src/services/templateEdgeResizeIntentService.ts`
    - 실제 mutation target edge 집합을 selection state 와 분리한 단일 계약으로 계산
  - `src/components/template/TemplateEditWorkspace.tsx`
    - `pointerdown` 에서 predicted activation result 생성
    - `pointermove` drag-start 에서 resize intent 로만 target edge 수집
    - `pointerup` 에서 predicted selection state 를 commit
    - `commitSelectionState()` 로 ref/state 동기화 통합
    - runtime mutation guard 로 `targetEdgeIds` 밖의 edge 차단

- 구현 검증 결과
  - 파일 단위 타입체크 성공:
    - `npx tsc --noEmit --pretty false --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --jsx preserve src/lib/templateEdgeSelectionDtos.ts src/services/templateEdgeTopologyService.ts src/services/templateEdgeSelectionService.ts src/services/templateEdgeResizeIntentService.ts src/components/template/TemplateEditWorkspace.tsx`
  - 컴포넌트 번들 성공:
    - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --format=esm --platform=browser --outfile=/tmp/selected-edge-workspace.js`
  - 서비스 번들 성공:
    - `npx esbuild src/services/templateEdgeSelectionService.ts src/services/templateEdgeTopologyService.ts src/services/templateEdgeResizeIntentService.ts --bundle --format=esm --platform=node --outdir=/tmp/selected-edge-services`
  - synthetic runtime 검증 성공:
    - `band-3-cell-2:left` 와 `band-10-cell-2:left` 는 다른 cohort 로 분리됨
    - 첫 클릭 결과는 connected edge ids 반환
    - 두 번째 클릭 결과는 isolated edge id 1개만 반환
    - resize intent 도 isolated target 1개만 반환

- 남은 제약
  - 프로젝트 전체 `npx tsc --noEmit` 는 기존 저장소의 unrelated before 파일 오류 때문에 실패한다.
    - 문제 파일: `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`
  - `chrome-devtools` 와 로컬 dev 서버 제한은 설계 단계와 동일하다.
