# SELECTED-EDGE-001 Design Log

- 작성 일시: `2026-04-29`
- 현재 턴 목적: `selectededge` 재시작 설계 반영 및 baseline 기준 재구현
- 재시작 기준 커밋: `d0a845da35a6bf9181c70556af3b8ac567b31883`
- 사용자 지시 핵심:
  - 이전 selected-edge 구현은 폐기한다.
  - 2회 클릭 isolated 가 실제 drag 에도 독립되어야 한다.
  - drag delta `n`배 적용을 제거해야 한다.
  - unrelated edge 는 이동도 차단도 하지 않아야 한다.

## 재시작 이해 확정 기록

1. `band-3-cell-2:left` 이동은 `band-10-cell-2:left` 계열과 완전히 분리되어야 한다.
2. `band-3-cell-1:right` 이동은 `band-10-cell-2:left` 위치에 의해 어떤 영향도 받아서는 안 된다.
3. 구현 기준점은 반드시 `d0a845da35a6bf9181c70556af3b8ac567b31883` 이다.
4. 이번 턴은 문서 갱신만이 아니라 baseline 복원 후 재구현까지 포함한다.

## 재시작 백업 및 롤백 기록

### 1차 재시작 백업: 실패 구현 보존 후 baseline 복원

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-201_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-202_templateEdgeSelectionService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-203_templateEdgeTopologyService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-204_templateEdgeSelectionDtos.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-205_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-206_selected-edge-design-log.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-207_templateEdgeResizeIntentService.before.ts`

설명:

1. 위 백업은 실패 구현 상태를 그대로 보존하기 위한 것이다.
2. 이후 `d0a845da35a6bf9181c70556af3b8ac567b31883` 기준으로 코드 baseline 을 복원했다.

### 2차 재시작 백업: baseline 복원 직후 현재 구현 전 백업

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-301_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-302_templateEdgeSelectionService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-303_templateEdgeTopologyService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-304_templateEdgeSelectionDtos.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-305_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-306_selected-edge-design-log.before.md`

설명:

1. 위 백업은 baseline 복원 후 실제 재구현 직전 상태다.
2. 신규 파일 `src/services/templateEdgeResizeIntentService.ts` 는 baseline 에 존재하지 않았으므로 “부재 상태에서 신규 생성”으로 취급한다.

## 체크리스트 매핑

- `CHK-RESTART-SEL-EDGE-001`
  - 목표: 2회 클릭 isolated 가 drag-start 전에 확정되도록 한다.
  - 현재 상태: 완료
  - 반영 코드:
    - `src/services/templateEdgeSelectionService.ts`
    - `src/services/templateEdgeResizeIntentService.ts`
    - `src/components/template/TemplateEditWorkspace.tsx`

- `CHK-RESTART-SEL-EDGE-002`
  - 목표: selection state 와 drag mutation target 을 분리한다.
  - 현재 상태: 완료
  - 반영 코드:
    - `src/lib/templateEdgeSelectionDtos.ts`
    - `src/services/templateEdgeResizeIntentService.ts`
    - `src/components/template/TemplateEditWorkspace.tsx`

- `CHK-RESTART-SEL-EDGE-003`
  - 목표: delta 가 handle 수나 edge 수만큼 증폭되지 않도록 한다.
  - 현재 상태: 완료
  - 반영 코드:
    - `src/components/template/TemplateEditWorkspace.tsx`

- `CHK-RESTART-SEL-EDGE-004`
  - 목표: unrelated edge 를 movement graph 와 blocking graph 양쪽에서 제거한다.
  - 현재 상태: 완료
  - 반영 코드:
    - `src/services/templateEdgeTopologyService.ts`
    - `src/services/templateEdgeResizeIntentService.ts`
    - `src/components/template/TemplateEditWorkspace.tsx`

- `CHK-RESTART-SEL-EDGE-005`
  - 목표: connected cohort 에 direct adjacency 증빙을 추가한다.
  - 현재 상태: 완료
  - 반영 코드:
    - `src/lib/templateEdgeSelectionDtos.ts`
    - `src/services/templateEdgeTopologyService.ts`

- `CHK-RESTART-SEL-EDGE-006`
  - 목표: 재시작 기준 커밋, 백업, 테스트 기록을 다시 고정한다.
  - 현재 상태: 완료
  - 반영 문서:
    - `docs/selectededge.md`
    - `docs/diff/2026-04-29_SELECTED-EDGE-001_design-log.md`

## 실제 구현 반영 내용

### `src/lib/templateEdgeSelectionDtos.ts`

1. direct adjacency DTO 를 추가했다.
2. activation result DTO 를 추가했다.
3. resize intent DTO 를 추가했다.
4. topology snapshot 에 `adjacencies` 를 추가했다.

### `src/services/templateEdgeTopologyService.ts`

1. line/opposite coordinate cluster 안에서 endpoint-touch adjacency 를 계산한다.
2. connected cohort 는 단순 chain index 추정이 아니라 adjacency graph connected component 기준으로 다시 계산한다.
3. 따라서 connected selection 은 “직접 이어진 chain” 만 포함하고, 떨어진 chain 은 같은 line 에 있어도 다른 cohort 로 남는다.

### `src/services/templateEdgeSelectionService.ts`

1. 기존 `resolveClick()` 로직을 `resolveActivation()` 과 분리했다.
2. `resolveActivation()` 은 다음 selection state 와 activated token 의 effective edge ids 를 함께 반환한다.
3. 같은 edge 2회 클릭 시 `connected -> isolated` 전이를 drag-start 이전에 예측 가능한 계약으로 고정했다.

### `src/services/templateEdgeResizeIntentService.ts`

1. pointerdown 시점의 resize intent 를 하나의 서비스 계약으로 계산한다.
2. 이 서비스는 predicted selection state 와 실제 drag target edge ids 를 함께 반환한다.
3. 워크스페이스는 이후 selection token 을 직접 다시 해석하지 않고 이 intent 결과만 소비한다.

### `src/components/template/TemplateEditWorkspace.tsx`

1. edge pointerdown 에서 live snapshot + current selection 을 읽고 resize intent 를 먼저 계산한다.
2. drag-start 에서는 `predictedSelection` 과 `targetEdgeIds` 만 사용한다.
3. edge resize target 은 `handleId` 기준으로 dedupe 하여 같은 물리 handle 이 중복 mutation 되지 않게 했다.
4. edge resize 경로에서는 generic `snapResizedRect()` sibling blocking 을 사용하지 않는다.
5. 대신 pointer delta 를 page bounds 기준으로만 clamp 하고, target handle 들의 최소 허용 delta 를 먼저 계산한 뒤 동일 delta 를 일괄 적용한다.
6. 따라서 unrelated edge 는 이동도 하지 않고 blocker 도 되지 않는다.

## 검증 기록

### 정적 검증

- 파일 단위 타입체크 성공:
  - `npx tsc --noEmit --pretty false --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --jsx preserve src/lib/templateEdgeSelectionDtos.ts src/services/templateEdgeTopologyService.ts src/services/templateEdgeSelectionService.ts src/services/templateEdgeResizeIntentService.ts src/components/template/TemplateEditWorkspace.tsx`

- 컴포넌트 번들 성공:
  - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --format=esm --platform=browser --outfile=/tmp/selected-edge-workspace.js`

- 서비스 번들 성공:
  - `npx esbuild src/services/templateEdgeSelectionService.ts src/services/templateEdgeTopologyService.ts src/services/templateEdgeResizeIntentService.ts --bundle --format=esm --platform=node --outdir=/tmp/selected-edge-services`

### synthetic runtime 검증

실행 결과:

1. `band-3-cell-2:left` cohort 는 `band-3-cell-3:left` 와만 연결되고 `band-10-cell-2:left` 와는 분리되었다.
2. 첫 클릭 resize intent 는 connected target edge ids 를 반환했다.
3. 같은 edge 두 번째 클릭 resize intent 는 `isolated` mode 와 단일 target edge id 만 반환했다.
4. `band-3-cell-1:right` resize intent 는 자기 자신만 target 으로 반환했다.

### MCP 실행 기록

- `mcp__supabase__.list_migrations`
  - 결과: 성공
  - 비고: DB 변경 없음

- `mcp__chrome_devtools__.list_pages`
  - 결과: 성공
  - 비고: attach 된 페이지는 `about:blank` 1개뿐이라 대상 편집 페이지 실검증은 불가

### 환경 제약

1. sandbox 제약 때문에 로컬 `next dev` 를 직접 붙여 브라우저 자동 검증하지 못했다.
2. 따라서 실제 페이지 상 drag 체감 검증은 사용자의 로컬 화면 확인이 추가로 필요하다.
3. 이번 턴에서는 문서, 타입체크, 번들, synthetic runtime, MCP 기록까지만 자동 검증했다.
