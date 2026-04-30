# 템플릿 편집기 Edge Edit 설계서

- 문서 ID: `EDGE-EDIT-001`
- 작성 일시: `2026-04-29 21:11 KST`
- 대상 화면: `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
- 현재 기준 코드: `/templates/edit` 라우트가 `c1a5d01ab97ca6a2f710cd34f7ed18efd4ba16a6` 상태로 복원된 시점

## 1. 수정 전 이해확정 기록

사용자와 확정된 이해 내용은 아래와 같다.

1. 현재 작업 대상은 `/templates/edit` 의 "박스 편집 캔버스" 이다.
2. 목표는 박스 전체 이동/모서리 리사이즈가 아니라 `edge` 선택과 `edge` 경계 이동이다.
3. 엣지 선택 규칙은 아래와 같다.
   - 1회 클릭: 같은 수직/수평선상에서 시작과 끝이 직접 연결된 엣지 cohort 를 선택한다.
   - 2회 클릭: 2번째로 클릭한 해당 엣지만 단독 선택한다.
   - `Shift+클릭`: 여러 개의 단일 엣지를 누적 선택한다.
4. 엣지 이동 규칙은 아래와 같다.
   - 단일 선택이면 그 단일 엣지 boundary 만 직접 이동시킨다.
   - 다중 선택이면 선택된 여러 엣지 boundary 만 함께 이동시킨다.
   - 선택되지 않은 unrelated edge 는 이동 대상도, 이동 blocker 도 되면 안 된다.
   - 단, 선택 엣지와 동일한 물리 경계를 공유하는 opposite peer edge 는 표/박스 보존을 위한 passive follower 로 함께 반영될 수 있다.
5. 엣지 이동 최대 범위는 선택된 경계와 직접 맞닿은 박스가 최소 너비/최소 높이에 도달하는 지점까지다.
6. 설계 문서 작성과 구현을 같이 진행한다.
7. 수정 범위는 사용자가 확정한 화이트리스트 파일만 허용한다.

## 2. 실행 정책

### 2.1 서비스 독립성 설계 원칙

아래 기능은 처음부터 별도 서비스로 분리 가능한 단위로 설계한다.

1. `TemplateEdgeTopologyService`
   - live DOM rect 를 edge topology snapshot 으로 변환하는 서비스
2. `TemplateEdgeSelectionService`
   - click/shift click 입력을 selection state transition 으로 변환하는 서비스
3. `TemplateEdgeResizeIntentService`
   - selection state 와 clicked edge 를 drag 대상 edge ids 와 passive peer ids 로 변환하는 서비스
4. `TemplateEditWorkspace` 내부 runtime adapter
   - DOM node / shell / table boundary 를 실제 mutation handle 로 연결하는 adapter

각 기능은 아래 기준을 반드시 만족해야 한다.

1. 명확한 도메인 경계
2. 입력/출력 DTO 로만 연결
3. 다른 구현 세부사항에 직접 의존하지 않음
4. 단독 테스트 가능
5. 교체 가능
6. 분리 배포 가능성 유지

### 2.2 히스토리 없이 읽혀야 하는 코드 규칙

후속 코드에서는 아래 의도가 함수명과 타입명에 그대로 드러나야 한다.

1. `click selection` 과 `drag selection` 이 다를 수 있다는 점
2. `selected edge ids` 와 `physical mutation handles` 가 다른 개념이라는 점
3. `passive peer edge` 는 선택 확장이 아니라 물리 경계 보존용 추종 대상이라는 점
4. `unrelated edge blocker` 를 제거하려는 목적

### 2.3 프론트 UI 변경 원칙

1. 기존 템플릿 편집 화면의 레이아웃/카드/UI 컴포넌트는 유지한다.
2. 새 범용 컴포넌트는 추가하지 않는다.
3. 허용되는 UI 변경은 아래 정도로 제한한다.
   - frame node 위 edge button overlay
   - 선택 상태 카드의 edge 선택 정보 표시
   - 캔버스 설명 문구 보정

### 2.4 변경 기록 및 롤백 보장

코드 수정 전 아래 파일의 수정 직전 상태를 `docs/diff` 에 기록한다.

1. `src/components/template/TemplateEditWorkspace.tsx`
2. `src/services/templateEdgeSelectionService.ts`
3. `src/services/templateEdgeTopologyService.ts`
4. `src/services/templateEdgeResizeIntentService.ts`
5. `src/lib/templateEdgeSelectionDtos.ts`

### 2.5 MCP 테스트 의무

매 실행마다 아래를 기록한다.

1. `supabase.list_migrations`
2. `chrome-devtools.list_pages`
3. 실제 브라우저 탭 attach 가능 여부
4. attach 실패 시 대체 검증 경로

## 3. 수정 허용 화이트리스트

이번 작업에서 실제 수정 허용 파일은 아래로 고정한다.

1. `docs/edgeedit.md`
   - 목적: 설계 기록
2. `docs/diff/2026-04-29_EDGE-EDIT-*.before`
   - 목적: 롤백 보장
3. `src/components/template/TemplateEditWorkspace.tsx`
   - 목적: runtime edge UI, pointer lifecycle, mutation handle adapter
4. `src/services/templateEdgeSelectionService.ts`
   - 목적: 1회 클릭 / 2회 클릭 / shift 누적 selection 전이
5. `src/services/templateEdgeTopologyService.ts`
   - 목적: connected cohort 와 physical peer helper 유지/보강
6. `src/services/templateEdgeResizeIntentService.ts`
   - 목적: drag 대상 edge ids 와 passive peer ids 계산
7. `src/lib/templateEdgeSelectionDtos.ts`
   - 목적: 서비스 계약 DTO 보강

## 4. 현재 baseline 진단

현재 `c1a5d01...` 상태의 `/templates/edit` 는 아래 구조다.

1. `TemplateEditWorkspace` 는 `frame group` 선택/이동/리사이즈 중심이다.
2. 캔버스에는 box selection badge 와 frame resize handle 만 있다.
3. edge topology / edge selection / edge resize intent 서비스 파일은 존재하지만, 실제 workspace pointer lifecycle 에 연결되어 있지 않다.
4. 따라서 현재 화면은 사용자가 요구한 edge 기반 선택/이동 모델을 수행할 수 없다.

정리하면, 현재 필요한 작업은 “새로운 edge 알고리즘 설계”가 아니라 “이미 분리된 edge 도메인 서비스를 현재 workspace 에 올바르게 접속하는 것”이다.

## 5. 목표 동작 정의

### 5.1 선택 규칙

1. 일반 클릭
   - 현재 선택이 비어 있거나 다른 edge 라면 `connected` token 1개를 만든다.
   - 현재 primary token 이 `connected` 이고 클릭한 edge 가 그 token 안에 있으면 `isolated` token 1개로 바꾼다.
   - 현재 primary token 이 `isolated` 이고 같은 edge 를 다시 클릭하면 다시 `connected` token 1개로 바꾼다.
2. `Shift+클릭`
   - 여러 단일 edge 를 누적 선택하기 위한 입력으로 해석한다.
   - shift selection 은 `isolated token` 만 누적한다.
   - orientation 또는 side 가 호환되지 않으면 기존 shift selection 을 버리고 새 단일 edge 선택으로 교체한다.
3. drag 시작
   - 클릭과 드래그는 같은 의미가 아니다.
   - 이미 선택된 edge 를 드래그하면 click 토글을 다시 계산하지 않고 현재 selection 을 그대로 이동에 사용한다.

### 5.2 이동 규칙

1. 선택 상태의 직접 대상은 `selected edge ids` 다.
2. 실제 DOM 변경 대상은 `physical mutation handles` 다.
3. 하나의 physical boundary 를 공유하는 여러 edge id 는 mutation handle 1개로 dedupe 해야 한다.
4. 직접 선택되지 않은 unrelated edge 는 selection 집합에 포함되지 않는다.
5. 다만 선택된 edge 와 opposite side 로 같은 physical boundary 를 공유하는 passive peer edge 는 동일 delta 를 적용받는다.

### 5.3 최대 이동 범위 규칙

1. 수직 이동량은 선택된 vertical boundary 를 기준으로 계산한다.
2. 수평 이동량은 선택된 horizontal boundary 를 기준으로 계산한다.
3. 허용 delta 는 모든 active mutation handle 의 공통 허용치 중 최소값을 사용한다.
4. 따라서 여러 선택이 함께 이동할 때도 어떤 하나의 인접 박스가 최소 크기에 닿으면 전체 drag 가 그 지점에서 멈춘다.

## 5.4 2026-04-29 실행 보정 기록

이번 차수에서 실제 브라우저 구동으로 확인한 추가 원인과 보정 사항은 아래와 같다.

1. giant frame band 정규화 시점이 너무 빨라서, raw template table 의 실제 col/row 폭이 계산되기 전에 `12px` 최소값으로 분해되는 문제가 있었다.
2. 이 문제는 초기 page load 직후에는 edge overlay 가 보이지 않다가, 프레임을 한 번 클릭한 뒤에야 overlay 가 생기고 그 시점에 잘못된 분해가 일어나는 현상과 연결되어 있었다.
3. 따라서 정규화는 “DOM mount 직후 즉시”가 아니라 “실제 frame layout 이 안정된 다음 animation frame” 에만 수행하도록 지연시켜야 한다.
4. edge button 자체도 textarea 뒤에 깔려 hit-test 가 실패할 수 있었으므로, edge host node 의 stacking context 를 올려 button 이 실제 pointer target 이 되도록 유지해야 한다.
5. width drag 의 passive peer 는 selection service 결과만 신뢰하지 않고, runtime adapter 단계에서 live DOM opposite boundary 를 다시 수집해 보강해야 한다.

실행 후 검증에서 확인한 결과:

1. 초기 로드 후 edge overlay 가 자동으로 나타나는지 확인했다.
2. `band-3-cell-1:right` 1회 클릭은 `connected` 로 전환되는 것을 확인했다.
3. `connected` 상태 drag 에서 `band-3-cell-2:left`, `band-4-cell-2:left` passive peer 가 같이 움직이고 `band-10-cell-2` 는 그대로인 것을 확인했다.
4. `isolated` 상태 drag 는 실제 브라우저 click + synthetic pointer 조합 기준으로 추가 검증을 계속해야 한다. 현재 synthetic 경로에서는 passive peer 는 붙지만 선택되지 않은 아래 connected peer 가 함께 움직인 기록이 있어, 이 구간은 후속 검증 시 가장 먼저 다시 확인해야 한다.

## 6. 기능별 서비스 설계

### 6.1 기능 A: Edge Topology Snapshot Service

#### 6.1.1 기능 목적

live DOM 의 frame rect 집합을 selection 과 resize intent 가 읽을 수 있는 edge topology snapshot 으로 바꾼다.

#### 6.1.2 단독 서비스로서의 가치

다른 렌더러나 다른 편집 UI 에서도 “현재 frame 배치에서 edge adjacency 와 physical peer 를 구하는 서비스”로 재사용 가능하다.

#### 6.1.3 책임 범위

1. frame rect -> edge descriptor 변환
2. orientation / side / lineCoordinate / span 계산
3. 직접 endpoint adjacency 계산
4. connected cohort 계산
5. opposite side physical peer 조회

#### 6.1.4 비책임 범위

1. click state transition
2. DOM mutation
3. pointer threshold 처리
4. resize delta clamp

#### 6.1.5 API 계약

입력:

```ts
type TemplateEdgeTopologySourceDto = {
  frames: TemplateEdgeFrameDto[];
  tolerancePx: number;
};
```

출력:

```ts
type TemplateEdgeTopologySnapshotDto = {
  edges: TemplateEdgeDescriptorDto[];
  cohorts: TemplateEdgeCohortDto[];
  adjacencies: TemplateEdgeDirectAdjacencyDto[];
};
```

조회 API:

1. `getEdgeById(snapshot, edgeId)`
2. `getCohortByEdgeId(snapshot, edgeId)`
3. `getPhysicalPeerEdgeIds(snapshot, edgeId)`

#### 6.1.6 데이터 소유권

snapshot 자체는 immutable DTO 로 취급하며, 소유권은 caller 가 가진다.

#### 6.1.7 의존 서비스

없음. pure service 로 유지한다.

#### 6.1.8 분리 배포 시 필요한 최소 조건

1. frame rect 입력 DTO
2. tolerance 설정
3. snapshot JSON 반환 채널

### 6.2 기능 B: Edge Selection State Transition Service

#### 6.2.1 기능 목적

click, second click, shift click 을 `connected` / `isolated` selection state 로 변환한다.

#### 6.2.2 단독 서비스로서의 가치

선택 규칙 자체는 UI 렌더러와 분리된 정책이므로, 같은 도메인을 canvas/SVG/DOM 어디서든 동일하게 재사용할 수 있다.

#### 6.2.3 책임 범위

1. 빈 선택 생성
2. topology 변경 후 selection reconcile
3. 일반 click 전이
4. shift 누적 selection 전이
5. drag 시 기존 selection 유지 여부 판단
6. 선택 상태에서 effective selected edge ids 계산

#### 6.2.4 비책임 범위

1. passive peer 계산
2. DOM query
3. handle dedupe
4. delta clamp

#### 6.2.5 API 계약

입력:

```ts
type TemplateEdgeSelectionClickDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
  clickedEdgeId: string;
  withShift: boolean;
};
```

출력:

```ts
type TemplateEdgeActivationResultDto = {
  selectionState: TemplateEdgeSelectionStateDto;
  activatedTokenId: string | null;
  effectiveEdgeIds: string[];
  mode: TemplateEdgeSelectionMode | null;
};
```

필수 메서드:

1. `createEmptyState()`
2. `reconcileSelectionState(...)`
3. `resolveActivation(...)`
4. `resolveDragActivation(...)`
5. `resolveClick(...)`

#### 6.2.6 데이터 소유권

selection state 는 React state / mutable ref 가 복제해서 쓰는 DTO 이며, service 는 상태를 직접 저장하지 않는다.

#### 6.2.7 의존 서비스

`TemplateEdgeTopologyService`

#### 6.2.8 분리 배포 시 필요한 최소 조건

1. topology snapshot
2. current selection dto
3. clicked edge id

### 6.3 기능 C: Edge Resize Intent Service

#### 6.3.1 기능 목적

selection state 와 clicked edge 를 실제 drag 대상 집합으로 변환한다.

#### 6.3.2 단독 서비스로서의 가치

selection semantics 와 DOM mutation semantics 사이의 anti-corruption layer 역할을 한다. 이 계층이 분리되면 selection 정책 변경이 있어도 mutation adapter 는 그대로 유지할 수 있다.

#### 6.3.3 책임 범위

1. click selection 과 drag selection 분리
2. drag 에 사용할 direct selected edge ids 계산
3. passive peer edge ids 계산
4. 최종 target edge ids 계산

#### 6.3.4 비책임 범위

1. DOM node lookup
2. shell/table boundary index 계산
3. delta clamp
4. 실제 width/height style 변경

#### 6.3.5 API 계약

입력:

```ts
type TemplateEdgeSelectionClickDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
  clickedEdgeId: string;
  withShift: boolean;
};
```

출력:

```ts
type TemplateEdgeResizeIntentDto = {
  clickSelectionState: TemplateEdgeSelectionStateDto;
  dragSelectionState: TemplateEdgeSelectionStateDto;
  selectedEdgeIds: string[];
  passivePeerEdgeIds: string[];
  targetEdgeIds: string[];
  dragMode: TemplateEdgeSelectionMode | null;
  side: TemplateEdgeSide | null;
};
```

#### 6.3.6 데이터 소유권

intent dto 는 stateless 계산 결과이며, ownership 은 caller 에 있다.

#### 6.3.7 의존 서비스

1. `TemplateEdgeSelectionService`
2. `TemplateEdgeTopologyService`

#### 6.3.8 분리 배포 시 필요한 최소 조건

1. topology snapshot
2. selection state
3. clicked edge id

### 6.4 기능 D: Workspace Edge Runtime Adapter

#### 6.4.1 기능 목적

서비스가 계산한 edge ids 를 실제 DOM mutation handle 로 변환하고, 공통 delta clamp 와 style mutation 을 실행한다.

#### 6.4.2 단독 서비스로서의 가치

현재는 React component 내부 helper 이지만, long term 으로는 DOM adapter 또는 editor engine adapter 로 분리 가능한 단위다.

#### 6.4.3 책임 범위

1. live DOM 에서 edge snapshot source frame 수집
2. edge overlay button 생성
3. pointerdown / move / up lifecycle 관리
4. selected edge ids -> unique mutation handles 변환
5. width/height shared delta clamp
6. passive peer 포함 여부를 고려한 실제 mutation

#### 6.4.4 비책임 범위

1. topology adjacency 계산 그 자체
2. selection state 전이 정책
3. template persistence API

#### 6.4.5 API 계약

입력:

1. `TemplateEdgeResizeIntentDto`
2. live DOM root
3. clicked frame node
4. current page bounds

출력:

1. runtime `edgePressState`
2. runtime `resizeState.edgeResizeTargets`
3. DOM mutation side effect

#### 6.4.6 데이터 소유권

runtime state 는 `TemplateEditWorkspace` 가 소유한다.

#### 6.4.7 의존 서비스

1. `TemplateEdgeTopologyService`
2. `TemplateEdgeSelectionService`
3. `TemplateEdgeResizeIntentService`
4. 기존 frame resize low-level helpers

#### 6.4.8 분리 배포 시 필요한 최소 조건

1. DOM adapter layer
2. frame rect reader
3. table boundary writer

## 7. 구현 설계

### 7.1 선택 상태 모델

`edge selection` 은 아래 두 상태를 유지한다.

1. React state: `edgeSelectionState`
2. mutable ref: `edgeSelectionStateRef.current`

규칙:

1. UI 반영과 drag 계산은 같은 selection snapshot 을 읽어야 한다.
2. `pointerdown` 에서 계산한 `clickSelectionState` 와 `dragSelectionState` 를 `edgePressState` 에 보관한다.
3. `drag threshold` 를 넘기면 `dragSelectionState` 를 commit 한다.
4. threshold 를 넘기지 않고 pointerup 되면 `clickSelectionState` 를 commit 한다.

### 7.2 Edge overlay 렌더링

1. 각 frame node 에 대해 `left/right/top/bottom` edge button 을 생성한다.
2. button 은 `data-v106-edge-button="true"` 와 `data-edge-id` 를 가진다.
3. 선택되지 않은 edge 도 클릭 가능해야 하므로 overlay 는 전체 frame 에 대해 항상 생성한다.
4. 선택된 edge 는 아래 정보를 data attribute 로 가진다.
   - `data-edge-selection-order`
   - `data-edge-selection-mode`
   - `data-edge-anchor`

### 7.3 Selected edge ids 와 mutation handles 분리

1. `selectedEdgeIds`
   - selection semantics
2. `passivePeerEdgeIds`
   - 같은 물리 경계를 유지하기 위한 opposite side follower
3. `targetEdgeIds`
   - 위 두 집합의 union
4. `edgeResizeTargets`
   - DOM shell/table boundary 기준 dedupe 된 실제 mutation handle

핵심 규칙:

1. delta loop 는 `targetEdgeIds` 가 아니라 `edgeResizeTargets` 로 돈다.
2. `edgeResizeTargets` 에서 같은 physical boundary 는 `handleId` 1개로 dedupe 한다.
3. `unrelated edge` 는 targetEdgeIds 에 들어오지 못하므로 blocker 가 될 수 없다.

### 7.4 Width boundary mutation

1. vertical edge 는 `buildSelfWidthResizeInstruction(context, side)` 로 self boundary instruction 을 만든다.
2. page 전체 shell 을 훑는 generic width instruction 은 edge edit 경로에 사용하지 않는다.
3. 각 target 의 허용 delta 는 `resolveWidthInstructionDelta(instructions, requestedDelta)` 로 계산한다.
4. 최종 delta 는 active target 전부의 허용 delta 중 최소값을 쓴다.

### 7.5 Height boundary mutation

1. top edge 는 `applyFrameResizeTopDelta()` 를 사용한다.
2. bottom edge 는 두 가지 경로를 가진다.
   - opposite peer 가 없는 경우: 기존 `applyFrameResizeHeightDelta()` 사용 가능
   - opposite peer 가 있는 경우: global shell shift 를 피하기 위해 `applyFrameResizeHeightDeltaLocal()` 사용
3. shrink 방향 delta 는 `resolveFrameResizeTopDelta()` / `resolveFrameResizeBottomDelta()` 로 공통 clamp 한다.
4. 최종 delta 는 active horizontal target 전부의 허용 delta 중 최소값을 사용한다.

### 7.6 Frame selection 과 edge selection 충돌 처리

1. frame drag/resize 를 시작하면 `edgeSelectionState` 는 비운다.
2. edge drag/selection 을 시작하면 `selectedFrameGroupIds` 는 비운다.
3. 우측 상태 카드에는 frame 선택 정보와 edge 선택 정보를 같이 보여주되, 둘은 별도 state 로 유지한다.

## 8. 구현 체크리스트

### 8.1 CHK-EDGE-EDIT-001: 문서와 서비스 계약 정렬

- [ ] `docs/edgeedit.md` 생성
- [ ] 기능별 API 계약/책임 범위/분리 배포 조건 기록

### 8.2 CHK-EDGE-EDIT-002: 백업 기록

- [ ] `TemplateEditWorkspace.tsx` 백업
- [ ] `templateEdgeSelectionService.ts` 백업
- [ ] `templateEdgeTopologyService.ts` 백업
- [ ] `templateEdgeResizeIntentService.ts` 백업
- [ ] `templateEdgeSelectionDtos.ts` 백업

### 8.3 CHK-EDGE-EDIT-003: Selection service 구현

- [ ] second click isolated 전이
- [ ] shift isolated multi-select 전이
- [ ] drag activation 시 기존 multi selection 유지

### 8.4 CHK-EDGE-EDIT-004: Resize intent service 구현

- [ ] clickSelection / dragSelection 분리
- [ ] selectedEdgeIds / passivePeerEdgeIds / targetEdgeIds 분리

### 8.5 CHK-EDGE-EDIT-005: Workspace runtime adapter 구현

- [ ] edge overlay button 렌더링
- [ ] live topology snapshot builder 연결
- [ ] edge press state 도입
- [ ] unique mutation handle 수집
- [ ] width shared delta clamp 연결
- [ ] height shared delta clamp 연결

### 8.6 CHK-EDGE-EDIT-006: 저장 HTML 보호

- [ ] edge overlay 와 editor UI state 가 `extractEditorHtml()` 에 남지 않음

### 8.7 CHK-EDGE-EDIT-007: 검증 기록

- [ ] `supabase.list_migrations` 호출 결과 기록
- [ ] `chrome-devtools.list_pages` 호출 결과 기록
- [ ] 타입체크 결과 기록
- [ ] 브라우저 직접 검증 가능/불가 사유 기록

## 9. 테스트 기록

### 9.1 이번 턴 시작 상태

1. `supabase.list_migrations`
   - 결과: `Auth required`
2. `chrome-devtools.list_pages`
   - 결과: `about:blank`, `file:///tmp/selected-edge-harness/...`, `chrome-error://chromewebdata/`
3. 실제 localhost 편집 페이지 attach 여부
   - 결과: 현재 세션에서는 아직 없음
4. sandbox 에서 `next dev --port 3001`
   - 결과: `listen EPERM`

### 9.2 이번 턴의 직접 브라우저 검증 제약

현재 세션에서는 아래 제약이 있다.

1. sandbox 에서 dev server 를 띄울 수 없다.
2. `chrome-devtools` 세션에 실제 `http://localhost:3001/templates/edit?...` 탭이 붙어 있지 않다.

따라서 이번 구현 검증은 아래 순서로 기록한다.

1. 타입체크/번들 검증
2. `chrome-devtools` 세션 상태 기록
3. localhost 탭이 attach 되면 그 시점에 실제 drag 검증 추가

### 9.3 2026-04-29 박스 클릭 최소 크기 붕괴 회귀

#### 관찰된 현상

1. 새로고침 직후에는 raw `.v102-frame-band` 4개 상태로 정상 레이아웃이 보인다.
2. 박스 본문을 클릭해 frame selection 을 활성화하면 edge overlay 초기화와 함께 raw band 가 normalized band 로 전환된다.
3. 이전 구현에서는 이 전환이 `buildLiveEdgeTopologySnapshot()` 같은 일반 선택 경로에서도 즉시 실행될 수 있었고, 그 시점의 table col/row layout 이 아직 안정되지 않으면 `12px` 최소값 기준으로 shell 이 잘못 고정될 수 있었다.

#### 원인 정리

1. `buildLiveEdgeTopologySnapshot()` 이 “snapshot read” 책임만 가져야 하는데, 내부에서 `ensurePreviewFrameBandNormalization()` 을 호출하며 DOM 쓰기를 같이 수행했다.
2. `setPreviewNode()` 와 `renderedPreviewHtml` effect 가 `document.fonts.ready` 이전에도 정규화 스케줄을 걸어, raw giant band 의 실제 폭/높이가 아직 풀리지 않은 시점에 normalization 이 진입할 수 있었다.
3. 결과적으로 plain box click 이 단순 selection 이 아니라 “미완성 레이아웃을 가진 raw table 을 normalized shell 로 강제 치환하는 작업”으로 바뀌었다.

#### 이번 턴 수정

1. `buildLiveEdgeTopologySnapshot()` 에서 `ensurePreviewFrameBandNormalization()` 호출 제거
2. `setPreviewNode()` 의 즉시 `schedulePreviewEditorState()` 호출 제거
3. `renderedPreviewHtml` effect 에서 `document.fonts.ready` 이전 선행 스케줄 제거
4. 정규화는 안정 레이아웃 확인 이후 `schedulePreviewEditorState()` 경로에서만 수행

#### 재발 방지 규칙

1. topology snapshot builder 는 DOM 을 변경하지 않는다.
2. raw `.v102-frame-band` -> normalized shell 전환은 단 하나의 scheduler 경로에서만 수행한다.
3. font/layout 안정화 이전에는 normalization 을 절대 실행하지 않는다.
4. box selection / edge selection / selection style sync 는 snapshot read 만 수행하고 normalization side effect 를 직접 호출하지 않는다.

### 9.4 이번 턴 검증 기록

1. `supabase.list_migrations`
   - 결과: `Auth required`
2. `chrome-devtools.list_pages`
   - 결과: `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 선택 상태 확인
3. 브라우저 직접 검증
   - 새로고침 직후:
     - `edgeButtons = 0`
     - `normalizedBands = 0`
     - `rawBands = 4`
     - `band-3-cell-1 = 91 x 55`
     - `band-3-cell-2 = 184.015625 x 55`
     - `band-10-cell-2 = 533.015625 x 72`
   - `band-3-cell-1` 박스 클릭 1.2초 후:
     - `edgeButtons = 216`
     - `normalizedBands = 51`
     - `rawBands = 54`
     - `band-3-cell-1 = 91 x 55`
     - `band-3-cell-2 = 184.015625 x 55`
     - `band-10-cell-2 = 545.0546875 x 72`
   - 추가 박스 클릭 후:
     - 대표 박스들의 폭/높이가 `12px` 최소값으로 붕괴되지 않음
4. 정적 검증
   - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --outfile=/tmp/template-edit-workspace-check.js`
   - 결과: 통과
5. TypeScript
   - `npx tsc --noEmit src/components/template/TemplateEditWorkspace.tsx`
   - 결과: 저장소 tsconfig 를 사용하지 않는 호출이라 JSX/`esModuleInterop` 관련 오류가 발생했고, 이번 턴의 회귀와 직접 관련 없는 실행 방법 오류로 기록만 남긴다.
6. 전체 프로젝트 TypeScript
   - `npx tsc --noEmit --pretty false --project tsconfig.json`
   - 결과: 기존 저장소 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류 때문에 실패

### 9.5 2026-04-30 클릭 시 최소 크기 붕괴 보강

#### 추가 원인

1. `buildNormalizedFrameBandShell()` 이 giant frame band 를 split shell 로 분해할 때 각 cell 의 `getBoundingClientRect()` 결과를 직접 사용하고 있었다.
2. 이 방식은 클릭 직후/선택 직후처럼 레이아웃이 완전히 안정되지 않은 순간에 일부 cell rect 가 `12px` 최소값으로 읽히면 split shell 좌표도 그대로 최소값으로 고정되는 취약점이 있었다.
3. 즉, “정규화 진입 타이밍” 문제뿐 아니라 “정규화 좌표 계산이 불안정한 DOM 실측값에 직접 의존한다”는 구조 문제가 남아 있었다.

#### 이번 보강

1. split shell 좌표 계산을 `cell.getBoundingClientRect()` 기반에서 `source table boundary` 기반으로 변경
2. `left/top/width/height` 는 raw table 의 `colWidths/rowHeights` 누적합으로 계산
3. `previewHasStableFrameLayout()` 는 raw multi-row frame band 별로
   - table 자체가 최소값보다 충분히 큰지
   - 실질적으로 큰 frame node 가 최소 2개 이상 존재하는지
   를 확인한 뒤에만 normalization 을 허용
4. `renderedPreviewHtml` 로드 이후 edge button 이 아직 없는 raw 상태가 지속되면 `250ms` 간격 watchdog 이 `schedulePreviewEditorState()` 를 재시도해 사용자의 첫 클릭이 normalization trigger 가 되지 않게 함
5. render 상태와 저장용 HTML 을 분리
   - `extractEditorHtml()` 은 저장용 denormalized HTML 생성
   - `extractPreviewRenderHtml()` 은 normalized preview 전용 HTML 생성
   - 클릭/선택으로 rerender 가 발생해도 giant raw band HTML 로 다시 돌아가지 않게 함

#### 재현/검증

1. 새로고침 직후
   - 최신 보강 이후 a11y snapshot 기준 `edgeButtons` 가 이미 렌더링된 normalized 상태로 진입함
2. 실제 클릭 반복
   - `edgeButtons = 216`
   - `normalizedBands = 51`
   - `band-3-cell-1`, `band-3-cell-2`, `8.첨부파일` 실제 클릭 반복 후 width/height 변화 `0`
   - 전체 frame 기준 width/height 변화 임계치 `0.5px` 초과 항목 `0개`
3. normalized 상태에서 하단 box 실제 클릭
   - `8.첨부파일` 클릭 후에도 최소 크기 붕괴 재현되지 않음
   - 전체 frame `minWidth = 89`, `minHeight = 11` 유지
4. 실제 브라우저 반복 클릭
   - `구 분` 실제 클릭 후 width/height 변화 임계치 `0.5px` 초과 항목 `0개`
   - `8.첨부파일` 실제 클릭 후 width/height 변화 임계치 `0.5px` 초과 항목 `0개`
   - pointerdown/mousedown/up/click 시퀀스로 전체 54개 frame 순회 테스트 시 collapse 항목 `0개`

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-209_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-210_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-211_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-212_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-213_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-214_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-215_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-216_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.9 2026-04-30 2클릭 isolated drag 의 peer boundary closure 보강

#### 추가 원인

1. `TemplateEdgeResizeIntentService.resolveResizeIntent()` 는 `selectedEdgeIds + direct physical peers` 만 `targetEdgeIds` 로 넘기고 있었다.
2. 이 구조에서는 2클릭 `isolated` UI 선택이 유지되더라도, 실제 mutation 대상에는 peer edge 의 같은-side connected cohort 가 포함되지 않을 수 있었다.
3. 그 결과 `band-3-cell-1:right` 같은 경계는 상단 pair 만 움직이고 하단 peer pair 가 빠지거나, `band-11-cell-2:top` 같은 경계는 direct peer only path 에서 drag target 이 불안정해질 수 있었다.

#### 이번 보강

1. `TemplateEdgeTopologyService.getCohortEdgeIds()` 를 추가해 edge 별 same-side connected cohort 를 독립 API 로 노출한다.
2. `TemplateEdgeTopologyService.expandMutationBoundaryEdgeIds()` 를 추가해 아래 관계의 closure 를 BFS 로 계산한다.
   - seed edge
   - seed edge 의 same-side connected cohort
   - 각 edge 의 physical peer
   - 각 physical peer 의 same-side connected cohort
3. `TemplateEdgeResizeIntentService.resolveResizeIntent()` 는 이제 UI selection 과 분리된 mutation target 으로 위 closure 를 `targetEdgeIds` 에 기록한다.
4. 따라서 `isolated` 는 선택 표시만 단일 edge 로 유지하고, 실제 drag mutation 은 peer boundary 전체가 끊기지 않도록 확장된 target 집합으로 수행한다.

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-229_templateEdgeTopologyService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-230_templateEdgeResizeIntentService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-231_edgeedit.before.md`
2. 수정 파일
   - `src/services/templateEdgeTopologyService.ts`
   - `src/services/templateEdgeResizeIntentService.ts`
   - `docs/edgeedit.md`

#### 재현/검증

1. 브라우저 직접 검증: `band-3-cell-1:right`
   - 1회 클릭 후 `connectedCount = 7`
   - 2회 클릭 후 `isolatedCount = 1`, `connectedCount = 0`
   - `+60px` drag 결과
     - `band-3-cell-1.width = 91 -> 151`
     - `band-3-cell-2.left = 269.5 -> 329.5`
     - `band-4-cell-1.width = 91 -> 151`
     - `band-4-cell-2.left = 269.5 -> 329.5`
   - 즉 isolated UI 선택 상태에서도 하단 peer pair 까지 함께 이동한다.
2. 브라우저 직접 검증: `band-11-cell-2:top`
   - 1회 클릭 후 `connectedCount = 2`
   - 2회 클릭 후 `isolatedCount = 1`, `connectedCount = 0`
   - `-80px` drag 결과
     - `band-10-cell-2.bottom = 1002.5 -> 942.5`
     - `band-11-cell-2.top = 1002.5 -> 942.5`
     - `band-10-cell-2.height = 72 -> 12`
     - `band-9-cell-2.bottom = 930.5` 는 그대로 유지
   - 즉 isolated UI 선택 상태에서도 상단 peer boundary 가 같이 움직이며 상위 row boundary 는 넘지 않는다.
3. 정적 검증
   - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --outfile=/tmp/template-edit-workspace-check.js`
   - `npx tsc --noEmit --pretty false src/services/templateEdgeTopologyService.ts src/services/templateEdgeResizeIntentService.ts src/lib/templateEdgeSelectionDtos.ts`
   - 결과: 모두 통과
4. MCP 확인
   - `chrome-devtools`: 실제 `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 페이지에서 2클릭 isolated drag 재현 완료
   - `supabase.list_migrations`: `Auth required`

### 9.8 2026-04-30 `band-11-cell-2:top` 반복 드래그 관통 수정

#### 직접 재현

1. 대상 경계
   - active edge: `band-11-cell-2:top`
   - physical peer: `band-10-cell-2:bottom`
   - 상단 기준 경계: `band-9-cell-2:bottom`
2. 초기 좌표
   - `band-9-cell-2.bottom = 929.5`
   - `band-10-cell-2.top = 929.5`
   - `band-10-cell-2.bottom = 1001.5`
   - `band-11-cell-2.top = 1001.5`
3. 기존 버그
   - 1차 upward drag 후 `band-10-cell-2.height = 12` 에 도달
   - 그 다음 왕복 drag 에서는 `0` 용량 peer 가 clamp 후보에서 빠져 `band-11-cell-2.top` 이 `929.5` 위로 계속 올라갈 수 있었음
   - 이때 `band-10-cell-2:bottom` 은 더 이상 같이 움직이지 않아 표 row boundary 가 분리됨

#### 추가 원인

1. `resolveSharedEdgeResizeDelta()` 로 넘기기 전에 candidate delta 집합을 `Math.abs(candidateDelta) >= 0.5` 로 필터링하고 있었다.
2. 최소 높이/너비에 이미 도달한 peer 는 candidate delta 가 `0` 이 되는데, 이 값이 필터에서 제거되면서 “더 이상 움직이면 안 되는 blocker” 가 사라졌다.
3. 그래서 같은 경계를 반복해서 왕복 drag 할 때, 최초 1회 이후에는 clamp 가 풀린 것처럼 동작했다.
4. 추가로 `resolveFrameResizeTopDelta()` 의 음수 delta 와 `resolveFrameResizeBottomDelta()` 의 양수 delta 는 내부 boundary 기준 clamp 가 비대칭으로 빠져 있었다.

#### 이번 보강

1. `resolveFrameResizeTopDelta()`
   - 음수 delta 일 때 내부 boundary 면 바로 위 row 의 shrink capacity 만큼만 허용
2. `resolveFrameResizeBottomDelta()`
   - 양수 delta 일 때 내부 boundary 면 바로 아래 row 의 shrink capacity 만큼만 허용
3. `constrainedDeltaX`, `constrainedDeltaY`
   - candidate delta 계산에서 `0` 도 유지
   - 즉, 최소치에 도달한 peer 가 이후 drag 에서도 계속 blocker 로 작동
4. height path 는 계속 `physicalPeerMembers` 를 포함한 공통 candidate 집합으로 계산
5. width path 도 `physicalPeerMembers.widthInstructions` 를 포함한 공통 candidate 집합으로 계산

#### 브라우저 재검증

1. `band-11-cell-2:top` upward `-200px`
   - 결과:
     - `band-10-cell-2.height = 12`
     - `band-10-cell-2.bottom = 941.5`
     - `band-11-cell-2.top = 941.5`
   - 즉, `band-10-cell-2:bottom` 과 `band-11-cell-2:top` 이 같은 boundary 로 함께 이동하고, `band-9-cell-2.bottom = 929.5` 는 넘지 않음
2. 같은 경계 downward `+80px`
   - 결과:
     - `band-10-cell-2.height = 92`
     - `band-10-cell-2.bottom = 1021.5`
     - `band-11-cell-2.top = 1021.5`
   - peer boundary 가 같이 복귀함
3. 다시 upward `-200px`
   - 결과:
     - 다시 `band-10-cell-2.height = 12`
     - `band-10-cell-2.bottom = 941.5`
     - `band-11-cell-2.top = 941.5`
   - 2차 왕복 후에도 `band-9-cell-2.bottom = 929.5` 위로 올라가지 않음

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-227_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-228_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.7 2026-04-30 왕복 드래그 시 peer 누락/최소 폭 관통 보강

#### 추가 재현

1. 브라우저에서 `band-3-cell-1:right` 를 한 방향으로 크게 밀어 `band-3-cell-2` 를 최소 폭까지 줄인 뒤, 같은 경계를 반대 방향으로 되돌리면 표가 다시 깨지는 경로가 확인되었다.
2. 재현 시 1차 이동에서는 `band-3-cell-1`, `band-4-cell-1` 만 커지고 `band-4-cell-2` 는 그대로 남아 row boundary 가 끊어졌다.
3. 즉, 동일 vertical cohort 안에서도 일부 peer edge 가 drag 대상 계산에서 빠지는 경로가 있었고, width clamp 역시 active handle 기준으로만 계산되어 왕복 시 인접 최소 폭 제약이 불안정했다.

#### 추가 원인

1. `FRAME_SELECTION_NODE_SELECTOR` 가 같은 `data-template-frame-group` 를 가진 `TD` 와 내부 `TEXTAREA` 를 모두 잡고 있었다.
2. 그 결과 `getFrameNodes()` 와 `buildLiveEdgeTopologySnapshot()` 이 실 box 수보다 많은 node 를 frame source 로 사용했고, selection/cohort/resize target 계산이 중복 frame 에 흔들릴 수 있었다.
3. width path 는 height path 와 달리 `physicalPeerMembers` 를 clamp 근거에 포함하지 않아, 현재 handle 목록이 흔들릴 때 반대편 peer 의 최소 폭 제약이 빠질 수 있었다.

#### 이번 보강

1. `resolveFrameSelectionAnchor()` 를 추가해 같은 `frameGroupId` 를 가진 후보 중 실제 host node 를 하나만 선택한다.
   - 우선순위는 `TD/TH`
   - 없으면 가장 바깥 matching ancestor
2. `collectFrameSelectionAnchors()` 를 추가해 `frameGroupId` 당 단일 anchor node 만 수집한다.
3. `getFrameNodes()`, `applyFrameSelectionUi()`, `pointerdown` 의 `frameNode` 해석이 모두 이 anchor 수집 결과를 사용하도록 변경한다.
4. width clamp 는 `edgeTarget.widthInstructions` 뿐 아니라 `edgeTarget.physicalPeerMembers` 의 `widthInstructions` 도 함께 포함해 공통 허용 delta 를 계산한다.
5. 따라서 왕복 드래그 시에도
   - 중복 frame snapshot 으로 인한 peer target 누락을 줄이고
   - 반대편 peer 가 현재 handle 집합에서 흔들려도 최소 폭 제약은 계속 유지한다.

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-223_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-224_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-225_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-226_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.6 2026-04-30 엣지 최소 크기 clamp 재고정

#### 추가 원인

1. `edgeResizeTargets` 는 실제 mutation handle 기준으로 묶여 있었지만, 최소 크기 clamp 는 여전히 “현재 drag에 포함된 handle 목록” 에만 의존하고 있었다.
2. 첫 번째 드래그에서 인접 박스가 최소 높이/너비에 도달한 뒤 두 번째 드래그를 시작하면, 반대편 physical peer 가 selection-driven target 목록에서 빠지는 경우가 있었고, 그 결과 clamp 후보에서 제외되었다.
3. 이 상태에서는 active handle 만 계속 성장하고, 이미 최소치에 도달한 passive peer 는 더 이상 함께 움직이지 않아 row/column boundary 가 분리되면서 표가 파괴되었다.

#### 이번 보강

1. `EdgeResizeTarget` 에 `members` 와 별도로 `physicalPeerMembers` 를 추가한다.
2. `collectEdgeResizeTargets()` 종료 시점에 각 handle 이 현재 boundary 를 공유하는 반대편 peer member 를 모두 수집해 `physicalPeerMembers` 에 고정한다.
3. `pointermove` 의 height clamp 는
   - active member
   - 같은 handle 의 member
   - `physicalPeerMembers`
   전체를 합친 `constraintMembers` 기준으로 공통 허용 delta 를 계산한다.
4. 따라서 두 번째 드래그에서는 반대편 peer handle 이 다시 선택 대상에 포함되지 않더라도, 이미 고정된 `physicalPeerMembers` 가 최소치 후보로 남아 boundary 를 더 이상 넘지 못하게 한다.
5. width path 도 handle 단위 1회 mutation 구조를 유지해 동일 physical boundary 의 중복 적용을 막는다.

#### 재현/검증

1. 브라우저 직접 검증: `band-3-cell-2:bottom`
   - 1차 드래그 `+220px`
   - 결과: `band-3-cell-1/2.height = 90`, `band-4-cell-1/2.height = 12`, `band-4 top = band-3 bottom`
   - 2차 드래그 `+260px`
   - 결과: 값 변화 `0`, 최소 높이 `12px` 유지, boundary 분리 재현되지 않음
2. 브라우저 직접 검증: `band-3-cell-1:right`
   - 1차 드래그 `+160px`
   - 결과: `band-3/4-cell-1.width = 207`, `band-3/4-cell-2.width = 68`
   - 2차 드래그 `+280px`
   - 결과: 값 변화 `0`, 최소 폭 유지, `band-10-cell-2` 변화 `0`
3. 정적 검증
   - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --outfile=/tmp/template-edit-workspace-check.js`
   - 결과: 통과
4. MCP 확인
   - `chrome-devtools`: 실제 `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 페이지에서 직접 드래그 재현 완료
   - `supabase.list_migrations`: `Auth required`

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-219_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-220_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-221_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-222_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.7 2026-04-30 엣지 역할 정의 고정 및 역할 위반 감지

#### 역할 정의

1. `selected_edge_clicked`
   - 직접 마우스로 클릭한 edge
   - 단일 클릭이든 Shift 누적 클릭이든 anchor 로 클릭된 edge 만 해당한다.
2. `selected_edge_auto_multi`
   - 단일 클릭으로 선택된 `connected` token 안에서, `selected_edge_clicked` 와 같은 side/orientation 을 가지며 시작점과 끝점이 직접 닿아 자동으로 함께 선택된 edge
   - 사용자가 직접 클릭하지 않은 connected cohort member 만 해당한다.
3. `peer_edge`
   - 현재 선택된 role edge 와 같은 물리 경계선에 있는 반대편 edge
   - 같은 page, 같은 orientation, 반대 side, 같은 line coordinate, span overlap 조건을 만족해야 한다.

#### 이번 턴 설계 보강

1. drag mutation 집합과 역할 계약을 분리한다.
2. 실제 drag 계산용 `mutationEdgeIds` 는 더 이상 recursive closure 를 쓰지 않는다.
3. 현재 계약상 drag 대상은 다음 union 으로 제한한다.
   - `selected_edge_clicked`
   - `selected_edge_auto_multi`
   - `peer_edge`
4. mismatch 판단도 내부 mutation handle 기준이 아니라 역할 계약 기준으로 수행한다.
5. 즉, 역할이 없는 edge 가 움직였으면 implementation convenience 와 무관하게 mismatch 로 기록한다.

#### 이번 턴 구현

1. `src/lib/templateEdgeSelectionDtos.ts`
   - `TemplateEdgeSelectionRole`
   - `TemplateEdgeRoleMapDto`
   - `selectedEdgeClickedIds`
   - `selectedEdgeAutoMultiIds`
   - `peerEdgeIds`
   - `mutationEdgeIds`
   - `edgeRoleById`
   계약을 추가했다.
2. `src/services/templateEdgeResizeIntentService.ts`
   - 선택 상태를 `selected_edge_clicked / selected_edge_auto_multi / peer_edge` 로 분해한다.
   - `mutationEdgeIds` 는 recursive boundary closure 대신 `role edge union` 으로만 계산한다.
3. `src/components/template/TemplateEditWorkspace.tsx`
   - edge button 에 `data-edge-selection-role` 을 부여한다.
   - 우측 패널에 역할별 개수/목록을 출력한다.
   - drag 종료 후 baseline 대비 실제 이동을 비교해 `movement mismatch edge` 를 기록한다.
   - mismatch 계산은 `edgeRoleById` 바깥에서 움직인 edge 를 우선적으로 잡도록 바꿨다.

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 1회 클릭 검증
   - `band-3-cell-1:right`
   - 결과
     - `selected_edge_clicked 수: 1`
     - `selected_edge_auto_multi 수: 6`
     - `peer_edge 수: 7`
3. 2회 클릭 검증
   - `band-3-cell-1:right`
   - 결과
     - `selected_edge_clicked 수: 1`
     - `selected_edge_auto_multi 수: 0`
     - `peer_edge 수: 1`
4. 2회 클릭 후 drag 검증
   - 동일 edge 를 다시 drag
   - 실측 결과
     - `band-3-cell-1:right` 와 `band-3-cell-2:left` 는 함께 이동한다.
     - 그러나 같은 source table boundary 를 공유하는 `band-4-cell-1:right` 도 함께 이동한다.
   - 현재 mismatch 출력
     - `movement mismatch edge: band-3-cell-2:left, band-4-cell-1:right`

#### 현재 판정

1. 역할 정의 출력과 직접 브라우저 검증 경로는 현재 작동한다.
2. 단일 edge drag 가 raw giant table 의 shared column boundary 를 타면서 `selected_edge_clicked + peer_edge` 바깥으로 새는 문제는 아직 남아 있다.
3. 다만 그 위반은 이제 브라우저 우측 패널의 `movement mismatch edge` 에서 직접 확인 가능하다.

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-232_templateEdgeSelectionDtos.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-233_templateEdgeResizeIntentService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-234_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-235_edgeedit.before.md`
2. 수정 파일
   - `src/lib/templateEdgeSelectionDtos.ts`
   - `src/services/templateEdgeResizeIntentService.ts`
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.8 2026-04-30 peer 없는 width drag 재렌더 롤백 수정

#### 실패 원인

1. `band-11-cell-3:left` 와 `selected_edge_auto_multi: band-12/13/14-cell-3:left` 는 drag 중 실제 shell style 이 바뀌고 있었다.
2. 하지만 drag 시작 시점에 `setEdgeSelectionState(edgePressState.dragSelection)` 를 바로 호출해서 React rerender 가 발생했다.
3. 이 rerender 는 아직 저장되지 않은 runtime shell geometry 대신 기존 `previewHtml` 로 preview DOM 을 다시 그렸고, 결과적으로 pointerup 전에 적용된 width 변경이 원복됐다.
4. 즉 문제의 본질은 width target 계산만이 아니라, `selected_edge_clicked / selected_edge_auto_multi` drag 중 React state commit 타이밍이 너무 빨랐다는 점이다.

#### 수정 원칙

1. edge drag 중 geometry source of truth 는 live DOM 이다.
2. drag 시작 시에는 `edgeSelectionStateRef` 와 runtime selection UI 만 갱신하고, React state commit 은 pointerup 이후 `stopPointerInteraction()` 에서만 수행한다.
3. `peer_edge` 가 없는 세로 width drag 는 generic closure 대신 역할 집합 그대로 처리한다.
4. `peer_edge` 가 있는 horizontal/top-bottom 경계는 기존 물리 peer 제약을 유지한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `collectDirectRoleWidthResizeTargets(...)`
   - 조건: `peer_edge` 가 없고, 현재 drag role edge 들이 모두 같은 vertical side 인 경우
   - 결과: `selected_edge_clicked + selected_edge_auto_multi` 만 직접 width mutation target 으로 사용
2. `src/components/template/TemplateEditWorkspace.tsx`
   - drag 시작 분기에서 `setEdgeSelectionState(edgePressState.dragSelection)` 제거
   - 주석으로 stale `previewHtml` rerender 가 runtime resize 를 원복시키는 이유를 남김

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. connected left drag
   - 선택: `band-11-cell-3:left` 1회 클릭
   - 역할:
     - `selected_edge_clicked: band-11-cell-3:left`
     - `selected_edge_auto_multi: band-12-cell-3:left, band-13-cell-3:left, band-14-cell-3:left`
     - `peer_edge: -`
   - drag: `-40px`
   - 결과:
     - `band-11/12/13/14-cell-3.left = 540.015625 -> 500`
     - `band-11/12/13/14-cell-3.width = 128.015625 -> 168.015625`
     - `band-11-cell-2` 변화 `0`
     - `movement mismatch edge = -`
3. isolated left drag
   - 선택: `band-11-cell-3:left` 2회 클릭
   - 역할:
     - `selected_edge_clicked: band-11-cell-3:left`
     - `selected_edge_auto_multi: -`
     - `peer_edge: -`
   - drag: `-40px`
   - 결과:
     - `band-11-cell-3.left = 500 -> 460`
     - `band-11-cell-3.width = 168.015625 -> 208.015625`
     - `band-12/13/14-cell-3` 변화 `0`
     - `band-11-cell-2` 변화 `0`
     - `movement mismatch edge = -`
4. top peer-constrained drag 유지
   - 선택: `band-11-cell-3:top` 2회 클릭
   - 역할:
     - `selected_edge_clicked: band-11-cell-3:top`
     - `selected_edge_auto_multi: band-11-cell-2:top, band-11-cell-4:top`
     - `peer_edge: band-10-cell-2:bottom`
   - drag: `-40px`
   - 결과:
     - `band-10-cell-2.bottom = 1002.5 -> 962.5`
     - `band-11-cell-2/3/4.top = 1002.5 -> 962.5`
     - `band-11-cell-2/3/4.height = 88 -> 128`
     - `movement mismatch edge = -`

#### 체크리스트

1. `CHK-EDGE-ROLE-WIDTH-001`
   - `peer_edge` 없는 left/right drag 는 runtime DOM mutation 이 pointerup 이후에도 유지되어야 한다.
   - 상태: 완료
2. `CHK-EDGE-ROLE-WIDTH-002`
   - connected left drag 는 `selected_edge_clicked + selected_edge_auto_multi` 만 이동하고 비선택 edge 는 그대로여야 한다.
   - 상태: 완료
3. `CHK-EDGE-ROLE-WIDTH-003`
   - isolated left drag 는 `selected_edge_clicked` 1개만 이동해야 한다.
   - 상태: 완료
4. `CHK-EDGE-ROLE-PEER-004`
   - `band-11-cell-3:top` 은 `band-11-cell-2/3/4:top + band-10-cell-2:bottom` 묶음을 유지해야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-239_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-240_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-241_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-242_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`
