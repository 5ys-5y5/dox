# SELECTED-EDGE-001 Design Log

- 작성 일시: `2026-04-29`
- 현재 턴 목적: `selectededge` 재시작 설계 반영 및 baseline 기준 재구현
- 재시작 기준 커밋: `d0a845da35a6bf9181c70556af3b8ac567b31883`
- 사용자 지시 핵심:
  - 이전 selected-edge 구현은 폐기한다.
  - 2회 클릭 isolated 가 실제 drag 에도 독립되어야 한다.
  - drag delta `n`배 적용을 제거해야 한다.
  - unrelated edge 는 이동도 차단도 하지 않아야 한다.
  - 이번 실패 이유를 명시적으로 기록해 같은 실수를 반복하지 않아야 한다.

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

### 3차 재시작 백업: 실패 원인 기록 후 baseline 재적용 전 백업

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-401_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-402_templateEdgeSelectionService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-403_templateEdgeTopologyService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-404_templateEdgeSelectionDtos.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-405_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-406_selected-edge-design-log.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-407_templateEdgeResizeIntentService.before.ts`

설명:

1. 위 백업은 “이전 개선안이 왜 실패했는지”를 문서에 반영하고 다시 baseline 위에 반영하기 직전 상태다.
2. 이 백업 이후 tracked code 는 다시 `HEAD=d0a845da35a6bf9181c70556af3b8ac567b31883` 기준으로 복원하고 재적용했다.

### 4차 재시작 백업: chrome-devtools 직접 재현 후 최종 반영 전 백업

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-501_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-502_templateEdgeSelectionService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-503_templateEdgeTopologyService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-504_templateEdgeSelectionDtos.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-505_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-506_selected-edge-design-log.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-507_templateEdgeResizeIntentService.before.ts`

설명:

1. 위 백업은 `chrome-devtools` 하니스에서 실제 pointer lifecycle 을 재현한 뒤 마지막 수정 직전 상태다.
2. 이 백업 이후 `TemplateEdgeSelectionService.resolveDragActivation()` 을 “이미 선택된 edge 는 현재 mode 유지” 규칙으로 다시 고정했다.

### 5차 재시작 백업: giant multi-row band 정규화 반영 전 백업

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-601_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-602_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-603_selected-edge-design-log.before.md`

설명:

1. 위 백업은 실제 localhost 페이지에서 giant shared band 구조를 확인한 뒤 DOM normalization 구현 직전 상태다.
2. 이번 차수는 service 수정이 아니라 `TemplateEditWorkspace.tsx` 의 physical layout normalization 을 추가하는 차수다.

### 6차 재시작 백업: cell-shell / vertical dependency 반영 전 백업

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-701_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-702_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-703_selected-edge-design-log.before.md`

설명:

1. 위 백업은 row-range shell 전략이 높이 독립성을 끝내 해결하지 못한 상태에서, `frame cell` shell 전략으로 재전환하기 직전 상태다.
2. 이번 차수는 `TemplateEditWorkspace.tsx` 에 cell-shell normalization, column-local vertical dependency, normalized width isolation 을 추가하는 차수다.

### 7차 재시작 백업: physical boundary peer / shell gap 보정 반영 전 백업

- `docs/diff/2026-04-29_RESTART-SEL-EDGE-801_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-802_selectededge.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-803_selected-edge-design-log.before.md`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-804_templateEdgeResizeIntentService.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-805_templateEdgeSelectionDtos.before.ts`
- `docs/diff/2026-04-29_RESTART-SEL-EDGE-806_templateEdgeTopologyService.before.ts`

설명:

1. 위 백업은 cell-shell 전략 이후에도 높이 isolated drag 가 selected shell 만 움직이고, shell rounding 때문에 gap 이 생기던 상태를 보존한 것이다.
2. 이번 차수는 `physical boundary peer expansion` 과 `non-rounded normalized shell geometry` 를 반영하는 차수다.

## 이번 실패 원인 기록

1. `pointerdown` 에서 isolated 예측을 계산했더라도, click 종료와 drag 시작이 같은 예측 결과를 같이 쓰지 않으면 stale connected state 가 다시 섞인다.
2. `edgeSelectionStateRef.current`, React state, DOM selection UI 를 서로 다른 시점에 갱신하면 다음 gesture 가 옛 selection 을 읽을 수 있다.
3. edge resize 전용 경로에서 generic `snapResizedRect()` blocker 를 남겨두면 unrelated edge 는 이동하지 않아도 delta 를 0 으로 만들 수 있다.
4. service synthetic 테스트만 통과했다고 해서 `TemplateEditWorkspace` 의 pointer lifecycle 이 검증된 것은 아니다.
5. drag-start 를 click-toggle 과 동일시하면, 이미 `connected` 로 활성화된 edge 를 다시 drag 할 때도 `isolated` 로 강등시키는 회귀가 생긴다.
6. localhost 실페이지 giant shell 구조를 보지 않고 selection service 만 수정한 것이 핵심 오판이었다.
7. shared colgroup 이 남아 있으면 `isolated` selection 도 물리적으로는 여전히 shared resize 가 된다.

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

- `CHK-RESTART-SEL-EDGE-007`
  - 목표: giant multi-row band 를 edge topology 이전에 `frame cell` shell 로 정규화한다.
  - 현재 상태: 완료
  - 반영 코드:
    - `src/components/template/TemplateEditWorkspace.tsx`

## 실제 구현 반영 내용

### `src/lib/templateEdgeSelectionDtos.ts`

1. direct adjacency DTO 를 추가했다.
2. activation result DTO 를 추가했다.
3. resize intent DTO 를 추가했다.
4. topology snapshot 에 `adjacencies` 를 추가했다.

### `src/services/templateEdgeTopologyService.ts`

1. line/opposite coordinate cluster 안에서 endpoint-touch adjacency 를 계산한다.
2. connected cohort 는 단순 chain index 추정이 아니라 adjacency graph connected component 기준으로 다시 계산한다.
3. `getPhysicalPeerEdgeIds()` 는 `same line coordinate + overlapping span + opposite side` 기준으로 physical boundary peer edge 를 계산한다.
4. 따라서 connected selection 은 “직접 이어진 chain” 만 포함하고, 실제 mutation target 은 여기에 opposite-side peer edge 를 별도로 확장한다.

### `src/services/templateEdgeSelectionService.ts`

1. 기존 `resolveClick()` 로직을 `resolveActivation()` 과 분리했다.
2. `resolveActivation()` 은 다음 selection state 와 activated token 의 effective edge ids 를 함께 반환한다.
3. 같은 edge 2회 클릭 시 `connected -> isolated` 전이를 click commit 계약으로 고정했다.
4. `resolveDragActivation()` 은 “이미 선택된 edge 면 현재 selection mode 유지, 미선택 edge 면 새 connected selection 생성” 규칙으로 다시 고정했다.

### `src/services/templateEdgeResizeIntentService.ts`

1. pointerdown 시점의 resize intent 를 하나의 서비스 계약으로 계산한다.
2. 이 서비스는 `clickSelectionState`, `dragSelectionState`, 실제 drag target edge ids 를 함께 반환한다.
3. `targetEdgeIds` 는 selected edge ids 만이 아니라 같은 physical boundary 의 opposite-side peer edge ids 까지 포함한다.
4. 이미 선택된 edge 를 drag 하는 경우 drag selection state 는 현재 selection mode 를 그대로 유지한다.
5. 워크스페이스는 이후 selection token 을 직접 다시 해석하지 않고 이 intent 결과만 소비한다.

### `src/components/template/TemplateEditWorkspace.tsx`

1. edge pointerdown 에서 live snapshot + current selection 을 읽고 resize intent 를 먼저 계산한다.
2. click `pointerup` 은 `clickSelection` 을 commit 하고, drag-start 는 `dragSelection` 을 commit 한다.
3. drag-start 에서는 `targetEdgeIds` 만 실제 mutation 대상으로 사용하고, selection ref/state/UI 를 같은 경로로 commit 한다.
4. edge resize target 은 `handleId` 기준으로 dedupe 하여 같은 물리 handle 이 중복 mutation 되지 않게 했다.
5. edge resize 경로에서는 generic `snapResizedRect()` sibling blocking 을 사용하지 않는다.
6. 대신 pointer delta 를 page bounds 기준으로만 clamp 하고, target handle 들의 최소 허용 delta 를 먼저 계산한 뒤 동일 delta 를 일괄 적용한다.
7. 따라서 unrelated edge 는 이동도 하지 않고 blocker 도 되지 않는다.
8. 실제 localhost giant shared band 를 `frame cell` shell 로 분해하는 `ensurePreviewFrameBandNormalization()` 을 추가했다.
9. 정규화된 shell 은 `data-v106-band-range`, `data-v106-band-col-range`, `data-v106-band-source` 메타데이터를 가진다.
10. normalized shell 의 generic width resize 는 self instruction 만 사용하도록 제한하여 `status-history-1` 이 비대상인데 줄어드는 경로를 차단했다.
11. edge resize target 은 selected edge 와 opposite-side physical peer edge 를 모두 포함한 mixed-side handle 집합으로 계산한다.
12. bottom edge resize 는 opposite-side peer 가 있으면 local bottom resize 만 적용하고, peer 가 없을 때만 legacy outer-bottom shift 경로를 사용한다.
13. normalized shell `left/top/width/height` 는 `Math.round()` 대신 소수점 좌표를 유지해 gap 생성을 줄인다.
14. 새로고침 직후 raw DOM 으로 돌아오는 재렌더를 막기 위해, 첫 실제 click 이후 normalized HTML 을 `previewHtml` 상태로 승격하는 경로를 추가했다.

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

1. `band-3-cell-2:left` cohort 는 `band-4-cell-2:left` 와만 연결되고 `band-10-cell-2:left` 와는 분리되었다.
2. 첫 클릭 resize intent 는 connected target edge ids 를 반환했다.
3. 같은 edge 두 번째 클릭 resize intent 는 `isolated` mode 와 단일 target edge id 만 반환했다.
4. same-line 이지만 endpoint 가 닿지 않는 `band-10-cell-2:left` 는 `band-3-cell-2:left` cohort 에 포함되지 않았다.

### MCP 실행 기록

- `mcp__supabase__.list_migrations`
  - 결과: 실패
  - 비고: `Auth required`, DB 변경 없음

- `mcp__chrome_devtools__`
  - 결과: 성공
  - 비고: 실제 `localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 를 직접 열어 검증했다
  - 실측 1: 초기 root 하위 `.v102-frame-band` 는 4개였고, 문제 shell 하나가 `rows=16`, `frameCells=51` 이었다
  - 실측 2: 첫 실제 frame click 이후 root 하위 `.v102-frame-band` 는 54개, `data-v106-normalized-band="true"` shell 은 51개였다
  - 실측 3: `band-3-cell-1`=`rowRange 0:1 / colRange 0:1`, `band-3-cell-2`=`0:1 / 1:4`, `band-4-cell-2`=`1:2 / 1:4`, `status-history-1`=`0:2 / 4:12` 로 분리되었고, 네 shell 모두 같은 `source=band-3-cell-1` 계열로 묶였다
  - 실측 4: `band-3-cell-2:bottom` 1회 클릭 시 `connected`, edge 수 `2`, anchor `band-3-cell-2:bottom`
  - 실측 5: 같은 edge 2회 클릭 시 `isolated`, edge 수 `1`, anchor `band-3-cell-2:bottom`
  - 실측 6: isolated 상태에서 `band-3-cell-2` rect bottom 은 `500`, `band-4-cell-2` rect top 은 `500` 으로 gap 이 `0px` 였다
  - 실측 7: `status-history-1` rect bottom 은 `547` 이므로 `band-3-cell-2:bottom` 과 같은 physical boundary peer 가 아니었다
  - 실측 8: synthetic pointer drag 는 safety / pointer-capture 제약 때문에 실제 resize capture 를 끝까지 재현하지 못했다
  - 실측 9: 따라서 이번 턴의 브라우저 증빙은 `실제 click 전이 + normalized shell geometry + physical peer 식별` 까지이며, 최종 drag 동작은 human 수동 drag 로 한 번 더 확인이 필요하다

### 환경 제약

1. `supabase` MCP 는 인증이 없어 `list_migrations` 단계에서 중단되었다.
2. `chrome-devtools` 의 click 검증과 DOM 정규화 확인은 가능했지만, low-level drag primitive 부재로 human drag 1:1 자동화에는 한계가 있었다.
3. 이번 턴 자동 검증 범위는 문서, 타입체크, 컴포넌트 번들, localhost giant shell 정규화 확인, click selection 전이 확인, physical peer / gap 실측, `supabase` MCP 실패 사유 기록까지다.
