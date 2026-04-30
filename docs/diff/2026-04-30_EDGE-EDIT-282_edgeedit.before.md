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

### 9.19 2026-04-30 marquee ghost visual 유지

#### 실패 원인

1. `Shift + drag` 중 `marquee ghost` 는 실제로 생성되고 있었다.
2. 그러나 live selection redraw 경로의 `applyFrameSelectionUi(...)` 가 매 move 마다 `TemplateFrameEditHtmlService.stripEditorUiState(root)` 를 호출했다.
3. 기존 구현에서 `marquee ghost` 는 `data-frame-editor-ui="true"` 를 가지고 있었기 때문에, selection redraw 직후 바로 제거되었다.
4. 결과적으로 사용자는 drag selection 이 동작해도 사각형 영역이 보이지 않았다.

#### 수정 원칙

1. live marquee/create ghost 는 selection redraw 에서 지워지면 안 된다.
2. 대신 저장용 HTML 추출과 preview render 추출 단계에서만 ghost 를 제거해야 한다.
3. ghost 는 class 기반으로 제거하고, 일반 selection badge / edge handle 과 분리한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `createFrameEditorGhost(...)`
     - `data-frame-editor-ui="true"` 제거
     - `aria-hidden="true"` 만 유지
   - `stripTransientFrameEditorUi(...)`
     - `.v106-frame-marquee`, `.v106-frame-create-ghost` 를 class 기준으로 제거
   - `extractEditorHtml(...)`
     - 저장 직전에도 `stripTransientFrameEditorUi(container)` 를 먼저 호출

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 재현
   - `Shift + drag` 좌→우: `170,50 -> 415,80`
3. drag 중 결과
   - `ghostCount = 1`
   - `ghostMode = contained`
   - `ghostRect = { left: 31.5px, top: 139.5px, width: 245px, height: 30px }`
   - `selectedDuring = [band-5-cell-1, band-5-cell-2]`
4. drag 종료 결과
   - `ghostCount = 0`
   - `selectedAfter = [band-5-cell-1, band-5-cell-2]`
5. 해석
   - drag 중에는 선택 영역이 시각적으로 보이고, 종료 시 ghost 는 정상 제거된다.

#### 체크리스트

1. `CHK-BOX-SELECTION-003`
   - `Shift + drag` 중 marquee rectangle 이 live DOM 에 보여야 한다.
   - 상태: 완료
2. `CHK-BOX-SELECTION-004`
   - pointerup 후 marquee rectangle 은 제거되고 selection 결과만 남아야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-277_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-278_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.20 2026-04-30 box creation single-shot off / relative semantics

#### 현재 `상대 위치` 설계 기준

1. 현재 구현에서 `relative` 는 "특정 박스 1개를 anchor 로 참조하는 모드"가 아니다.
2. 생성된 박스는 `page-inner` 좌표계 기준 `left/top/width/height` 를 가진 shell 로 추가된다.
3. 차이는 anchor reference 가 아니라 propagation policy 에 있다.
   - `relative`
     - 기존 frame 과 같은 resize propagation 경로에 포함된다.
     - 아래 boundary shift, width instruction, outer-bottom follower 이동의 영향을 받을 수 있다.
   - `absolute`
     - 같은 경로에서 제외된다.
     - 다른 박스의 width/height 조정이 전파되어도 follower 로 움직이지 않는다.
4. 따라서 현재 기준의 `relative` 는
   - `band-0-header`, `band-1-header`, `band-19-footer` 같은 개별 박스를 직접 참조하는 구조가 아니라
   - 같은 `page-inner` 레이아웃 흐름에 종속되는 "전파 포함 모드"다.
5. 만약 향후 요구사항이 "어느 박스를 기준 anchor 로 삼을지 명시"하는 구조라면,
   - `anchorFrameGroupId`
   - `anchorEdgeId`
   - `anchorOffset`
   같은 별도 계약을 추가해야 한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - create mode 성공 commit 후 `setBoxCreationMode(false)` 추가
   - 즉, 박스 1개를 만들면 생성 모드가 즉시 종료된다.

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 재현
   - `박스 생성` on
   - drag: `300,300 -> 380,360`
3. 결과
   - 새 박스 생성 완료
   - `data-frame-create-mode = false`
   - `상대 위치 / 절대 위치` selector 다시 disabled
4. 해석
   - create mode 는 single-shot 으로 동작하고, 1개 생성 후 자동 종료된다.

#### 체크리스트

1. `CHK-BOX-CREATE-004`
   - 박스 1개 생성 후 create mode 가 자동으로 꺼져야 한다.
   - 상태: 완료
2. `CHK-BOX-CREATE-005`
   - 현재 `relative` 는 anchor box reference 가 아니라 propagation-included mode 임을 문서화해야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-279_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-280_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.19 `status-history-1:right` line 복구 및 outer-bottom mismatch 억제

#### 문제 요약

1. edit preview 에서 `status-history-1:right` 가 `band-5-cell-6:right` 와 같은 수직선상에 놓이지 않았다.
2. 같은 right line 에 있는 `band-8-cell-4:right`, `band-9-cell-2:right`, `band-10-cell-2:right`, `band-12/13/14-cell-4:right`, `band-16/17/18-cell-2:right` 가 1클릭 connected selection 으로 한 번에 묶이지 않았다.
3. `band-1-header:bottom` edge drag 는 outer-bottom resize 로 아래 shell 을 의도적으로 같이 내리는데, diagnostics 는 그 follower 들을 전부 `movement mismatch edge` 로 기록했다.

#### 원인

1. normalized shell 분해 시 `status-history-1` 은 trailing `2px` scaffold column 을 shell border 에만 남기고 실제 frame cell span 에는 반영하지 않았다.
2. 그 결과 edit preview 의 live rect 기준으로 `status-history-1.right = 863.5xx` 였고, 같은 right line 의 다른 frame 들은 `865.5xx` 라서 visual line 과 cohort line 이 동시에 흔들렸다.
3. `TemplateEdgeTopologyService` 는 connected adjacency/cohort 를 만들 때 `lineCoordinate` 뿐 아니라 `oppositeCoordinate` 까지 같은 cluster 안에서만 연결했다.
4. 그래서 같은 right line 위에서 폭이 다른 edge 들은 시작/끝이 닿아 있어도 서로 다른 opposite cluster 로 분리되었다.
5. `band-1-header:bottom` 의 mismatch 는 실제 resize bug 라기보다, `applyFrameResizeHeightDelta(...)` 가 `shiftShellsBelowBoundary(...)` 로 아래 shell 을 함께 이동시키는 follower translation 을 diagnostics 가 unexpected movement 로 오인한 것이었다.

#### 수정 원칙

1. rightmost single-entry normalized shell 은 trailing scaffold column 이 row range 에서 비어 있더라도 visual frame box 가 그 terminal column 까지 채워야 한다.
2. connected edge chain 은 같은 page / orientation / side / line 위에서 endpoint 가 직접 닿아 있으면 폭이 달라도 하나의 cohort 로 이어져야 한다.
3. outer-bottom resize 가 의도적으로 아래 shell 을 같은 delta 로 내리는 follower translation 은 mismatch 에서 제외해야 한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `expandSingleEntryGroupsToTrailingColumns(...)` 추가
     - row range 기준 마지막 occupied group 이고 `entries.length === 1` 인 경우 `colEnd` 를 source table `columnCount` 까지 확장
   - `buildNormalizedFrameBandShell(...)`
     - single-entry group 은 cloned cell `colSpan` / `rowSpan` 을 shell 전체 range 로 재계산
     - 따라서 `status-history-1` 같은 rightmost shell 의 live frame rect 가 trailing scaffold column 까지 포함하도록 보정
   - `ResizeState.passiveShiftedEdgeIds` 추가
   - `collectPassiveShiftedHorizontalEdgeIds(...)` 추가
     - `direction.includes('s')` 이고 outer-bottom resize 인 경우, boundary 아래로 같이 내려가는 shell 의 horizontal edge ids 를 수집
   - `detectEdgeRoleMovementMismatches(...)`
     - 위 follower edge 가 `expectedDelta` 와 같은 양만큼 이동한 경우 mismatch 에서 제외
2. `src/services/templateEdgeTopologyService.ts`
   - `buildDirectAdjacencies(...)`
     - same line cluster 안에서 `oppositeCoordinate` 재클러스터링 제거
   - `buildCohorts(...)`
     - same line cluster 안에서 endpoint touching component 만으로 cohort 구성
     - 따라서 폭이 다른 right/left edge 도 같은 수직선에서 직접 이어지면 하나의 cohort 로 묶임

#### 브라우저 / 서비스 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. right line 좌표
   - `status-history-1.right = 865.53125`
   - `band-5-cell-6.right = 865.515625`
   - `band-8-cell-4.right = 865.5390625`
   - `band-10-cell-2.right = 865.5703125`
   - `band-12-cell-4.right = 865.53125`
   - `band-16-cell-2.right = 865.5703125`
   - 즉 live preview 에서 모두 `865.5xx` 라인으로 수렴했다.
3. topology service 검증
   - `band-8-cell-4:right` cohort
     - `status-history-1:right`
     - `band-5-cell-6:right`
     - `band-6-cell-4:right`
     - `band-7-cell-4:right`
     - `band-8-cell-4:right`
     - `band-9-cell-2:right`
     - `band-10-cell-2:right`
     - `band-11-cell-4:right`
     - `band-12-cell-4:right`
     - `band-13-cell-4:right`
     - `band-14-cell-4:right`
     - `band-15-cell-2:right`
     - `band-16-cell-2:right`
     - `band-17-cell-2:right`
     - `band-18-cell-2:right`
   - `band-11-cell-3:left` cohort
     - `band-11-cell-3:left`
     - `band-12-cell-3:left`
     - `band-13-cell-3:left`
     - `band-14-cell-3:left`
4. `band-1-header:bottom` mismatch
   - synthetic drag 자체는 devtools 제약 때문에 끝까지 자동 재현하지 못했지만,
   - 현재 코드 경로에서는 outer-bottom follower shell 의 horizontal edge ids 를 `passiveShiftedEdgeIds` 로 수집하고,
   - 같은 `expectedDelta` 로 이동한 follower edge 는 mismatch 에서 제외하도록 반영했다.

#### 체크리스트

1. `CHK-EDGE-LINE-001`
   - `status-history-1:right` 는 같은 right line 의 later frame 들과 `865.5xx` 수준으로 정렬되어야 한다.
   - 상태: 완료
2. `CHK-EDGE-LINE-002`
   - 같은 line 에서 endpoint 가 직접 이어지는 right/left edge 는 폭이 달라도 같은 connected cohort 로 묶여야 한다.
   - 상태: 완료
3. `CHK-EDGE-MISMATCH-001`
   - outer-bottom resize 로 아래 shell 이 follower translation 되는 경우, 동일 delta 로 이동한 horizontal edge 는 mismatch 로 기록하면 안 된다.
   - 상태: 구현 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-268_templateEdgeTopologyService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-269_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-270_edgeedit.before.md`
2. 수정 파일
   - `src/services/templateEdgeTopologyService.ts`
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.18 `status-history-1` 우측 경계선 누락 복구

#### 문제 요약

1. edit preview 에서 `status-history-1` 의 우측 경계선이 빠져 있었다.
2. 같은 source giant band 안의 다른 shell 은 오른쪽 경계선을 갖고 있었지만, `status-history-1` 은 `border-right: 0px` 로 렌더링됐다.
3. raw 추출 HTML 에서는 시각적 누락이 없어서, 원인은 edit preview 의 normalized shell perimeter 판정이었다.

#### 원인

1. `buildNormalizedFrameBandShell(...)` 은 기존에 `group.colEnd === colWidths.length` 인 경우에만 shell table 의 right perimeter border 를 유지했다.
2. `status-history-1` shell 은 `data-v106-band-col-range="4:12"` 이고 source table col 수는 trailing scaffold column 때문에 `13` 이다.
3. 하지만 해당 row range `0:2` 에서는 실제 content cell 이 column `12` 이후를 전혀 점유하지 않는다.
4. 즉, `status-history-1` 은 row range 기준으로는 가장 오른쪽 content shell 인데도, 전체 col 수만 보고 perimeter 를 끊어서 우측 경계선이 사라졌다.

#### 수정 원칙

1. right perimeter 는 "source table의 마지막 column" 뿐 아니라 "해당 row range 에서 실제 점유된 마지막 content column" 에도 남아야 한다.
2. trailing scaffold column 이 있어도, 그 row 에 content 가 없으면 마지막 occupied column shell 이 우측 경계선을 가져야 한다.
3. left/top/bottom perimeter 기준은 그대로 두고, 이번 수정은 right perimeter 판정만 좁게 바꾼다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `buildRowOccupiedMaxColEnd(...)` 추가
     - `TableCellLayoutPosition[]` 기준으로 row 별 마지막 occupied `colEnd` 를 계산한다.
   - `buildNormalizedFrameBandShell(...)`
     - `rowOccupiedMaxColEnd` 를 추가 인자로 받는다.
     - `preserveRightBorder`
       - `group.colEnd === colWidths.length`
       - 또는 `group.rowStart..group.rowEnd` 의 모든 row 에서 `rowOccupiedMaxColEnd[rowIndex] <= group.colEnd`
   - `normalizeFrameBandTableLayout(...)`
     - `positions` 계산 직후 `rowOccupiedMaxColEnd` 를 만들고 각 normalized shell 생성에 전달한다.

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 대상 shell
   - `data-template-frame-group="status-history-1"`
   - normalized shell dataset
     - `v106BandRange = "0:2"`
     - `v106BandColRange = "4:12"`
     - `v106BandSource = "band-3-cell-1"`
3. 결과
   - shell table computed border
     - `top = 1px`
     - `right = 1px`
     - `bottom = 0px`
     - `left = 0px`
     - `rightStyle = solid`
   - frame node 자체 border 는 여전히 `right = 0px` 이지만, shell perimeter 가 right outline 을 올바르게 담당한다.

#### 체크리스트

1. `CHK-EDGE-PERIMETER-001`
   - row range 기준 마지막 occupied content shell 은 trailing scaffold column 이 있어도 right perimeter border 를 유지해야 한다.
   - 상태: 완료
2. `CHK-EDGE-PERIMETER-002`
   - `status-history-1` normalized shell table 의 computed `border-right-width` 는 `1px` 이어야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-265_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-267_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.9 2026-04-30 peer 포함 세로 width drag role-only 경로 통일

#### 실패 원인

1. 이전 구현은 `peer_edge` 가 없는 세로 width drag 만 direct role path 를 사용했다.
2. 따라서 `peer_edge` 가 포함된 `band-12-cell-2:left`, `band-12-cell-1:right` 같은 경우는 다시 generic closure 경로로 떨어졌다.
3. 이 구조에서는 실제 이동 범위가 role contract 가 아니라 내부 boundary closure 구현에 의존하게 된다.

#### 수정 원칙

1. 세로 width drag 는 `peer_edge` 유무와 무관하게 role contract 만 따라야 한다.
2. 즉 width mutation 대상은 항상 `selected_edge_clicked + selected_edge_auto_multi + peer_edge` 의 union 이어야 한다.
3. generic closure 로 추가 edge 를 끌어들이지 않는다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `usesDirectRoleWidthPath` 조건을 변경했다.
   - 기존: `peer_edge` 가 없고 같은 side 인 경우만 direct role path 사용
   - 변경 후: `mutationEdgeIds` 가 모두 vertical left/right edge 이면 `peer_edge` 포함 여부와 무관하게 direct role path 사용

#### 브라우저 직접 검증

1. connected width drag
   - 선택: `band-12-cell-2:left` 1회 클릭
   - 역할:
     - `selected_edge_clicked: band-12-cell-2:left`
     - `selected_edge_auto_multi: band-11-cell-2:left, band-13-cell-2:left, band-14-cell-2:left`
     - `peer_edge: band-11-cell-1:right, band-12-cell-1:right, band-13-cell-1:right, band-14-cell-1:right`
   - drag: `-40px`
   - 결과:
     - `band-11-cell-2.left = 333.5 -> 293.5`
     - `band-12-cell-2.left = 333.5 -> 293.5`
     - `band-11-cell-1.right = 333.5 -> 293.5`
     - `band-12-cell-1.right = 333.5 -> 293.5`
     - `band-10-cell-2` 변화 `0`
     - `band-10-cell-1` 변화 `0`
     - `movement mismatch edge = -`
2. isolated width drag
   - 선택: `band-12-cell-2:left` 2회 클릭
   - 역할:
     - `selected_edge_clicked: band-12-cell-2:left`
     - `peer_edge: band-12-cell-1:right`
   - drag: `-40px`
   - 결과:
     - `band-12-cell-2.left = 293.5 -> 253.5`
     - `band-12-cell-1.right = 293.5 -> 253.5`
     - `band-11-cell-2`, `band-11-cell-1`, `band-10-cell-2`, `band-10-cell-1` 변화 `0`
     - `movement mismatch edge = -`
3. peer edge direct drag
   - 선택: `band-12-cell-1:right` 2회 클릭
   - 역할:
     - `selected_edge_clicked: band-12-cell-1:right`
     - `peer_edge: band-12-cell-2:left`
   - drag: `-40px`
   - 결과:
     - `band-12-cell-1.right = 253.5 -> 213.5`
     - `band-12-cell-2.left = 253.5 -> 213.5`
     - `band-11-cell-1`, `band-11-cell-2` 변화 `0`
     - `movement mismatch edge = -`

#### 체크리스트

1. `CHK-EDGE-ROLE-WIDTH-005`
   - `peer_edge` 가 포함된 세로 width drag 도 generic closure 가 아니라 role-only path 를 사용해야 한다.
   - 상태: 완료
2. `CHK-EDGE-ROLE-WIDTH-006`
   - `band-12-cell-2:left` drag 시 `band-10-cell-2`, `band-10-cell-1` 이 더 이상 이동하면 안 된다.
   - 상태: 완료
3. `CHK-EDGE-ROLE-WIDTH-007`
   - `band-12-cell-1:right` 직접 2클릭 drag 는 `band-12-cell-2:left` peer 와 함께 단일 경계로 이동해야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-243_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-244_edgeedit.before.md`
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

### 9.10 2026-04-30 `band-12-cell-1:top` peer 누락/겹침 보강

#### 실패 원인

1. `templateEdgeResizeIntentService.ts` 의 역할 계산은 `selected_edge_clicked + selected_edge_auto_multi` 에 대해 `peer_edge` 를 1회만 계산했다.
2. 그 뒤 `peer_edge` 로 인해 같은 line 에 새로 편입된 `selected_edge_auto_multi` 는 자신의 `peer_edge` 를 다시 계산하지 못했다.
3. 결과적으로 `band-12-cell-1:top` connected 선택처럼 `band-12-cell-2:top`, `band-12-cell-3:top` 가 자동 선택되는 경우에도, resize 적용 시점에는 일부 top/bottom peer 가 누락된 역할 집합이 내려갈 수 있었다.
4. `TemplateEditWorkspace.tsx` 의 direct role resize 경로도 세로 width drag 중심으로 좁게 적용돼 있었기 때문에, horizontal top/bottom drag 는 generic closure 로 다시 떨어졌고, 이 경로가 `band-11-cell-4` / `band-12-cell-4` 같은 비역할 edge 를 끌어들일 수 있었다.

#### 수정 원칙

1. 역할 집합은 `selected_edge_clicked`, `selected_edge_auto_multi`, `peer_edge` 의 고정 계약으로 끝까지 유지한다.
2. 새로 확장된 `selected_edge_auto_multi` 가 있으면 그 edge 의 `peer_edge` 까지 반복 계산해 closure 가 안정될 때까지 역할 집합을 확정한다.
3. drag mutation 은 generic physical closure 가 아니라 역할 계약으로 계산된 `mutationEdgeIds` 를 우선 사용한다.
4. `band-12-cell-1:top` connected 선택의 허용 범위는 `band-11-cell-1/2/3:bottom + band-12-cell-1/2/3:top` 까지이고, `band-11/12-cell-4` 는 절대 포함되면 안 된다.
5. `band-12-cell-1:top` isolated 선택의 허용 범위는 `band-11-cell-1:bottom + band-12-cell-1:top` 뿐이며 셀 2/3 은 움직이면 안 된다.

#### 이번 턴 구현

1. `src/services/templateEdgeResizeIntentService.ts`
   - `collectPeerEdgeIds(...)` 추가
   - `describeSelectionRoles(...)` 를 반복 closure 방식으로 수정
   - 반복 규칙:
     - 현재 `selected_edge_clicked + selected_edge_auto_multi` 기준 `peer_edge` 계산
     - 그 `peer_edge` 와 직접 맞닿는 same-side edge 를 `selected_edge_auto_multi` 로 추가
     - 역할 집합이 더 이상 변하지 않을 때까지 반복
2. `src/components/template/TemplateEditWorkspace.tsx`
   - `collectDirectRoleResizeTargets(...)` 로 helper 일반화
   - left/right 전용 분기였던 role-only 경로를 top/bottom 포함 모든 edge drag 에 우선 적용
   - drag 시작 시 `mutationEdgeIds` 기반 direct role target 이 존재하면 generic closure 대신 그 target 만 resize 대상으로 사용

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 검증 보조
   - devtools synthetic pointer 검증을 위해 페이지 세션에서 `setPointerCapture / releasePointerCapture / hasPointerCapture` 를 테스트용 no-op 으로 패치한 뒤 실제 runtime drag 경로를 실행
3. connected `band-12-cell-1:top`
   - 선택:
     - `selected_edge_clicked: band-12-cell-1:top`
     - `selected_edge_auto_multi: band-12-cell-2:top, band-12-cell-3:top`
     - `peer_edge: band-11-cell-1:bottom, band-11-cell-2:bottom, band-11-cell-3:bottom`
   - drag: `-40px`
   - 결과:
     - `band-11-cell-1/2/3.bottom = 419 -> 379`
     - `band-12-cell-1/2/3.top = 419 -> 379`
     - `band-11-cell-4`, `band-12-cell-4` 변화 `0`
     - `gap = 0`, `movement mismatch edge = -`
4. connected 왕복 검증
   - same selection 에서 다시 아래로 되돌린 뒤 측정
   - 결과:
     - `band-11-cell-1/2/3.bottom` 과 `band-12-cell-1/2/3.top` 이 계속 같은 좌표를 유지
     - peer 누락으로 인한 음수 gap / overlap 재현 없음

#### 체크리스트

1. `CHK-EDGE-PEER-CLOSURE-005`
   - 역할 확장 후 새로 편입된 `selected_edge_auto_multi` 도 자신의 `peer_edge` 를 끝까지 계산해야 한다.
   - 상태: 완료
2. `CHK-EDGE-PEER-CLOSURE-006`
   - `band-12-cell-1:top` connected drag 는 `band-11/12-cell-1/2/3` 경계만 움직이고 셀 4 는 움직이면 안 된다.
   - 상태: 완료
3. `CHK-EDGE-PEER-CLOSURE-007`
   - `band-11-cell-1` 과 `band-12-cell-1` 사이 gap 은 drag 전후 모두 `0` 이어야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-245_templateEdgeResizeIntentService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-246_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-247_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-248_edgeedit.before.md`
2. 수정 파일
   - `src/services/templateEdgeResizeIntentService.ts`
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.11 2026-04-30 `band-12-cell-2:top` isolated peer bleed 차단

#### 실패 원인

1. `band-12-cell-2` 와 `band-12-cell-3`, `band-11-cell-2` 와 `band-11-cell-3` 는 추출된 DOM rect 기준으로 약 `2px` 내외의 가짜 겹침을 갖고 있었다.
2. `templateEdgeResizeIntentService.ts` 의 `collectPeerEdgeIds(...)`, `collectPeerConstrainedSameSideEdgeIds(...)` 는 이 작은 겹침도 실제 peer overlap 으로 인정했다.
3. 그래서 `band-12-cell-2:top` 을 2회 클릭해 `isolated` 로 만든 뒤에도:
   - `selected_edge_auto_multi: band-12-cell-3:top`
   - `peer_edge: band-11-cell-2:bottom, band-11-cell-3:bottom`
   로 과확장되며, 실제 drag 도 `cell-3` 를 같이 움직였다.

#### 수정 원칙

1. `selected_edge_clicked` 와 `peer_edge` 의 연결은 단순 `0.5px` 수준의 추출 잡음으로 성립하면 안 된다.
2. 역할 계산에서 쓰는 overlap 은 “실제 같은 물리 경계로 봐도 되는 길이” 이상일 때만 인정한다.
3. 같은 턴의 다른 요구사항인 `band-11-cell-3:top` 처럼 genuinely broad peer 를 가진 경우는 계속 유지되어야 하므로, overlap floor 는 row/column border noise 보다 크고 실제 peer span 보다는 충분히 작게 잡는다.

#### 이번 턴 구현

1. `src/services/templateEdgeResizeIntentService.ts`
   - `EDGE_ROLE_OVERLAP_NOISE_FLOOR_PX = 4` 추가
   - `readEdgeOverlapLength(...)` helper 추가
   - `collectPeerEdgeIds(...)`
   - `collectPeerConstrainedSameSideEdgeIds(...)`
   - 두 경로 모두 `overlap > 0.5` 대신 `overlap > EDGE_ROLE_OVERLAP_NOISE_FLOOR_PX` 로 변경

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 겹침 실측
   - 패치 전 DOM 실측:
     - `band-12-cell-2.right = 534.5234375`
     - `band-12-cell-3.left = 532.515625`
     - 약 `2.008px` 겹침
   - 같은 패턴이 `band-11-cell-2` / `band-11-cell-3` 에도 존재
3. connected 1회 클릭
   - 선택: `band-12-cell-2:top`
   - 결과:
     - `selected_edge_clicked: band-12-cell-2:top`
     - `selected_edge_auto_multi: band-12-cell-1:top`
     - `peer_edge: band-11-cell-2:bottom, band-11-cell-1:bottom`
4. isolated 2회 클릭
   - 선택: `band-12-cell-2:top`
   - 결과:
     - `selected_edge_clicked: band-12-cell-2:top`
     - `selected_edge_auto_multi: -`
     - `peer_edge: band-11-cell-2:bottom`
5. isolated drag `-40px`
   - 결과:
     - `band-11-cell-2.bottom: -40`
     - `band-12-cell-2.top: -40`
     - `band-11-cell-3.bottom: 0`
     - `band-12-cell-3.top: 0`
     - `movement mismatch edge = -`

#### 체크리스트

1. `CHK-EDGE-PEER-NOISE-008`
   - `band-12-cell-2:top` isolated 선택은 `band-12-cell-3:top` 를 `selected_edge_auto_multi` 로 포함하면 안 된다.
   - 상태: 완료
2. `CHK-EDGE-PEER-NOISE-009`
   - `band-12-cell-2:top` isolated drag 는 `band-11/12-cell-2` 만 움직이고 `cell-3` 는 그대로여야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-249_templateEdgeResizeIntentService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-250_edgeedit.before.md`
2. 수정 파일
   - `src/services/templateEdgeResizeIntentService.ts`
   - `docs/edgeedit.md`

### 9.13 2026-04-30 edit preview split shell 시각 어긋남 및 isolated drag 후 peer 해제 보정

#### 실패 원인

1. 저장된 `draftHtml` 자체는 raw giant-band 구조였고 `data-v106-normalized-band` 가 없었다.
2. 문제는 edit preview runtime normalization 이 raw giant-band 를 split shell 로 바꾸는 과정에서 발생했다.
3. `TemplateEditWorkspace.tsx` 의 split shell 렌더링은 두 가지 이유로 원본 raw rect 를 바꿔버리고 있었다.
   - scaffold column `10px`, `2px` 같은 실제 source width 를 `MIN_TABLE_COLUMN_WIDTH_PX = 12` 로 강제 확대했다.
   - 각 split shell 이 giant table 의 outer border 를 자기 table 에도 그대로 복제했다.
4. 그 결과 raw giant table 에서는 `band-11-cell-2.width = 199.015625`, `band-11-cell-3.width = 128` 이어야 하는 구간이 edit preview 에서는 `201.0390625 / 128.015625` 로 벌어졌고, isolated edge drag 후에는 untouched row/column 이 다시 peer 조건을 잃을 수 있었다.

#### 수정 원칙

1. preview normalization 은 raw `draftHtml` 와 같은 geometry 를 만들어야 하며, source giant table 에 없는 폭/높이를 임의로 추가하면 안 된다.
2. split shell table 은 giant table 의 internal cell 을 복제하는 것이지 giant table outer border box 를 개별 shell 마다 복제하는 것이 아니다.
3. rendering 용 col/row width write 와 resize 중 live width/height write 모두 source subpixel 값을 유지해야 한다.
4. denormalize 저장 경로에서는 preview-only border reset 이 raw giant table 에 새어 들어가면 안 된다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `setTableColWidths(...)`, `setTableRowHeights(...)`
     - `12px` 강제 반올림/확장을 제거하고 실제 subpixel width/height 그대로 기록
   - `buildNormalizedFrameBandShell(...)`
     - split shell table 에 `border: 0`, `borderSpacing: 0` 을 적용
     - colgroup width / row height 에 raw giant table 의 실제 값 사용
   - `syncShellSizeFromTable(...)`
     - resize 중 shell/table width/height 를 subpixel 그대로 유지
   - `buildDenormalizedFrameBandShell(...)`
     - preview-only `border: 0` inline style 가 raw giant table 저장본으로 새지 않도록 border reset 제거
   - shell left/top/width/height write 경로
     - `Math.round(...)` 대신 `toFrameCssPx(...)` 로 유지
2. fallback width/height builder
   - source table 에 colgroup 이 없더라도 scaffold width 를 `12px` 로 강제 확대하지 않도록 하한을 `1px` writable size 로 낮춤

#### 브라우저 직접 검증

1. raw `draftHtml` 확인
   - `fetch('/api/templates/9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be')`
   - 결과:
     - `data-v106-normalized-band = 0`
     - `data-v106-band-source = 0`
     - giant-band raw 저장본임을 확인
2. raw giant table vs normalized preview rect 비교
   - same edit page 안에서 raw `draftHtml` 를 offscreen host 로 렌더링해 비교
   - raw baseline:
     - `band-11-cell-2.width = 199.015625`
     - `band-11-cell-3.width = 128`
     - `band-12-cell-2.width = 199.015625`
     - `band-12-cell-3.width = 128`
   - patch 후 live normalized preview:
     - `band-11-cell-2.width = 199.0390625`
     - `band-11-cell-3.width = 128.015625`
     - `band-12-cell-2.width = 199.0390625`
     - `band-12-cell-3.width = 128.015625`
   - raw 대비 width diff 는 최대 약 `0.024px` 로 줄었고, 이전 `+2px` scaffold inflation 은 사라졌다.
3. connected role 복구
   - fresh reload 후 `band-11-cell-3:left` 1회 클릭
   - 결과:
     - `selected_edge_clicked: band-11-cell-3:left`
     - `selected_edge_auto_multi: band-12-cell-3:left, band-13-cell-3:left, band-14-cell-3:left`
     - `peer_edge: band-11-cell-2:right, band-12-cell-2:right, band-13-cell-2:right, band-14-cell-2:right`
4. isolated drag 영향 범위
   - `band-12-cell-2:left` 2회 클릭 후 `-40px` drag
   - 결과:
     - `band-12-cell-1.right = -40`
     - `band-12-cell-2.left = -40`
     - `band-12-cell-2.width = +40.016`
     - untouched row:
       - `band-11-cell-1.right = 0`
       - `band-11-cell-2.left = 0`
     - active role:
       - `selected_edge_clicked: band-12-cell-2:left`
       - `peer_edge: band-12-cell-1:right`
   - 즉 isolated drag 가 자기 peer pair 만 움직이고 위 row 는 건드리지 않았다.

#### 체크리스트

1. `CHK-EDGE-RENDER-ALIGN-013`
   - normalized preview 는 raw `draftHtml` 대비 scaffold column inflation 없이 같은 geometry 를 유지해야 한다.
   - 상태: 완료
2. `CHK-EDGE-RENDER-ALIGN-014`
   - `band-11/12-cell-2/3` 구간 width drift 는 `2px` 급이 아니라 subpixel 수준이어야 한다.
   - 상태: 완료
3. `CHK-EDGE-RENDER-ALIGN-015`
   - `band-12-cell-2:left` isolated drag 는 `band-12-cell-1:right` peer 만 같이 움직이고 `band-11` row 는 그대로여야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-253_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-254_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.12 2026-04-30 수직 peer_edge 누락 보정

#### 실패 원인

1. `selected_edge_clicked: band-11-cell-3:left` 와 같이 수직 경계를 선택하면 `selected_edge_auto_multi: band-12/13/14-cell-3:left` 는 정상으로 잡혔지만, 반대편 `band-11/12/13/14-cell-2:right` 는 `peer_edge` 로 잡히지 않았다.
2. 실제 브라우저 rect 기준으로 두 경계는 같은 물리 경계였지만, 추출된 div shell 좌표가 약 `2.008px` 어긋나 있었다.
3. `templateEdgeResizeIntentService.ts` 의 `collectPeerEdgeIds(...)`, `collectPeerConstrainedSameSideEdgeIds(...)` 는 peer 판정에서 `lineCoordinate` 오차를 `0.5px` 이하로만 허용하고 있었다.
4. 그래서 overlap 길이는 충분해도 `lineCoordinate` mismatch 때문에 peer 역할 확장이 중간에 끊겼다.

#### 수정 원칙

1. `selected_edge_clicked`, `selected_edge_auto_multi`, `peer_edge` 역할 판정은 추출 div 의 미세한 shell 오차를 견뎌야 한다.
2. 다만 이전에 막은 `band-12-cell-2:top` 의 가짜 peer bleed 는 유지해야 하므로, tolerance 완화는 `lineCoordinate` 에만 적용하고 `overlap` 은 계속 `4px` floor 로 제한한다.
3. 이 tolerance 는 peer role 계산 전용이어야 하며, generic topology 연결 규칙까지 같이 느슨하게 만들면 안 된다.

#### 이번 턴 구현

1. `src/services/templateEdgeResizeIntentService.ts`
   - `EDGE_ROLE_LINE_ALIGNMENT_TOLERANCE_PX = 4` 추가
   - `collectPeerEdgeIds(...)`
   - `collectPeerConstrainedSameSideEdgeIds(...)`
   - 두 경로의 `lineCoordinate` 허용치를 `0.5px` 에서 `4px` 로 분리
2. 기존 `EDGE_ROLE_OVERLAP_NOISE_FLOOR_PX = 4` 는 유지
   - 따라서 `lineCoordinate` 는 완화하되, span overlap 이 `4px` 이하인 가짜 접촉은 여전히 peer 로 인정하지 않는다.

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 실측
   - `band-11/12/13/14-cell-3:left = 532.515625`
   - `band-11/12/13/14-cell-2:right = 534.5234375`
   - 물리 경계 차이 약 `2.008px`
3. `band-11-cell-3:left` connected 1회 클릭
   - 결과:
     - `selected_edge_clicked: band-11-cell-3:left`
     - `selected_edge_auto_multi: band-12-cell-3:left, band-13-cell-3:left, band-14-cell-3:left`
     - `peer_edge: band-11-cell-2:right, band-12-cell-2:right, band-13-cell-2:right, band-14-cell-2:right`
4. `band-12-cell-4:right` connected 1회 클릭
   - 결과:
     - `selected_edge_clicked: band-12-cell-4:right`
     - `selected_edge_auto_multi: band-11-cell-4:right, band-13-cell-4:right, band-14-cell-4:right`
     - outer boundary 라 `peer_edge` 는 생성되지 않음
     - 즉, 이 케이스의 회귀는 peer 누락이 아니라 위아래 connected segment 누락이었고, 현재는 `band-11/12/13/14-cell-4:right` 가 한 번에 선택됨
5. `band-7-cell-3:left` connected 1회 클릭
   - 결과:
     - `selected_edge_clicked: band-7-cell-3:left`
     - `selected_edge_auto_multi: band-5-cell-5:left, band-6-cell-3:left`
     - `peer_edge: band-5-cell-4:right, band-6-cell-2:right, band-7-cell-2:right`
     - 사용자 지적 구간에서도 반대편 peer 역할이 다시 생성됨
6. 회귀 확인
   - `band-12-cell-2:top` isolated 2회 클릭은 계속
     - `selected_edge_auto_multi: -`
     - `peer_edge: band-11-cell-2:bottom`
     이어야 한다.
   - 결과:
     - `selected_edge_clicked: band-12-cell-2:top`
     - `selected_edge_auto_multi: -`
     - `peer_edge: band-11-cell-2:bottom`

#### 체크리스트

1. `CHK-EDGE-PEER-NOISE-010`
   - `band-11-cell-3:left` connected 선택은 `band-11/12/13/14-cell-2:right` 를 `peer_edge` 로 포함해야 한다.
   - 상태: 완료
2. `CHK-EDGE-PEER-NOISE-011`
   - `band-12-cell-4:right` connected 선택은 위아래 수직 segment 및 인접 left peer 역할 확장을 유지해야 한다.
   - 상태: 완료
3. `CHK-EDGE-PEER-NOISE-012`
   - `band-12-cell-2:top` isolated 회귀가 없어야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-251_templateEdgeResizeIntentService.before.ts`
   - `docs/diff/2026-04-30_EDGE-EDIT-252_edgeedit.before.md`
2. 수정 파일
   - `src/services/templateEdgeResizeIntentService.ts`
   - `docs/edgeedit.md`

### 9.14 2026-04-30 edge drag autosnap 5px

#### 실패 원인

1. 사용자는 edit 페이지에서 edge 를 드래그할 때, 근처 edge 와 `5px` 미만으로 가까워지는 시점에는 손으로 끝까지 맞추지 않아도 자동으로 붙어야 한다.
2. 기존 구현은 edge drag delta 를 최소 크기 제약과 peer 제약으로만 clamp 했고, 가까운 정지 edge 라인으로 끌어당기는 proximity snap 이 없었다.
3. 이 요구는 edge drag 전용이어야 하며, 우측 `선택 상태` 패널의 `너비 (px)` / `높이 (px)` 직접 입력에는 적용되면 안 된다.

#### 수정 원칙

1. autosnap 은 `pointermove` 기반 edge drag 경로에서만 동작한다.
2. snap 후보는 drag 시작 시점 snapshot 에 있던 같은 orientation 의 edge 중, 현재 같이 움직이는 역할 집합(`selected_edge_clicked`, `selected_edge_auto_multi`, `peer_edge`) 밖의 edge 만 본다.
3. span overlap 이 실질적으로 있는 edge 만 snap 후보가 될 수 있어야 한다.
4. snap 은 drag 방향의 부호를 뒤집으면 안 된다.
5. 우측 패널의 `너비 (px)` 직접 입력은 autosnap 과 완전히 분리된 경로로 유지한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `EDGE_DRAG_AUTOSNAP_THRESHOLD_PX = 5` 유지
   - `ResizeState.edgeDragSnapshot` 을 drag 시작 시점 topology snapshot 으로 보관
   - `readEdgeSpanOverlapLength(...)` 추가
   - `resolveEdgeDragAutosnapDelta(...)` 추가
   - width drag / height drag 모두
     - 1차 제약 clamp
     - autosnap delta 보정
     - 2차 제약 clamp
     순서로 최종 delta 를 계산
2. 동일 파일 주석 보강
   - autosnap 은 live edge drag 전용이며 `선택 상태` 패널의 width/height 입력에는 적용되지 않는다는 점을 코드에 직접 기록

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 기준 시나리오
   - `selected_edge_clicked: band-3-cell-1:top`
   - snap 후보: `band-0-header:bottom`
   - 초기 frame gap: `7px`
3. 재현
   - 같은 edge 를 `2회 클릭` 해서 `isolated` 로 전환
   - 위로 `-4px` 만 드래그
4. 결과
   - button overlay 기준
     - before gap: `7px`
     - after gap: `-1px`
   - 실제 frame rect 기준
     - `band-0-header.bottom = 39`
     - `band-3-cell-1.top`
       - before: `46`
       - after: `38`
     - frame gap
       - before: `7px`
       - after: `-1px`
   - 즉, 사용자가 요청한 `-4px` 보다 더 큰 `-8px` 가 적용되어 가까운 edge line 으로 자동 흡착되었다.
   - edit preview 의 기존 `1px` border overlap 모델 때문에 최종 gap 이 `0` 대신 `-1` 로 측정되지만, drag 입력 자체는 autosnap 으로 보정되었다.
5. 회귀 확인
   - 동일 검증에서 `선택 상태` 패널 width input 경로는 수정하지 않았고, autosnap 호출점도 `handlePreviewPointerMove(...)` 의 edge drag 분기 내부에만 존재한다.

#### 체크리스트

1. `CHK-EDGE-AUTOSNAP-013`
   - edge drag 중 같은 orientation 의 근처 edge 와 `5px` 미만으로 가까워지면 autosnap 이 적용되어야 한다.
   - 상태: 완료
2. `CHK-EDGE-AUTOSNAP-014`
   - `선택 상태` 패널의 `너비 (px)` / `높이 (px)` 직접 입력은 autosnap 과 무관해야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-255_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-256_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-257_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-258_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.15 2026-04-30 autosnap 누락 및 템플릿 외곽 outline 복구

#### 실패 원인

1. autosnap 은 drag 시작 직후 1회성 큰 이동에서는 보였지만, 실제 브라우저에서 여러 번의 작은 `pointermove` 로 드래그하면 자주 빠졌다.
2. 원인은 `resolveEdgeDragAutosnapDelta(...)` 가 현재 edge 의 live 위치가 아니라 drag 시작 snapshot 좌표와 이번 move 의 `incremental delta` 만 보고 snap 후보와 비교하고 있었기 때문이다.
3. 그래서 이미 `appliedEdgeDeltaX/Y` 가 누적된 뒤에는 실제 gap 이 `5px` 미만이어도 snap 계산에서는 아직 멀리 떨어진 것으로 잘못 판단할 수 있었다.
4. 동시에 normalized split shell preview 는 각 shell table border 를 전부 `0px` 로 지우고 있어서, raw giant frame table 이 갖고 있던 외곽 outline 이 사라졌다.

#### 수정 원칙

1. autosnap 후보 판정은 항상 `drag 시작 baseline + 현재까지 누적 적용된 delta + 이번 move delta` 를 기준으로 해야 한다.
2. autosnap 은 여전히 edge drag 전용이어야 하며, `선택 상태` 패널 입력 경로에는 적용하지 않는다.
3. normalized split shell 은 내부 seam border 는 제거하되, 원본 giant table 의 바깥 perimeter border 는 유지해야 한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `resolveEdgeDragAutosnapDelta(...)`
     - `currentAppliedDelta` 인자 추가
     - snap 후보 비교 좌표를 `member.lineCoordinate + currentAppliedDelta + requestedDelta` 로 수정
   - edge drag 분기
     - vertical autosnap 호출 시 `resizeState.appliedEdgeDeltaX`
     - horizontal autosnap 호출 시 `resizeState.appliedEdgeDeltaY`
     를 함께 전달
2. 동일 파일 `buildNormalizedFrameBandShell(...)`
   - split shell table border 를 무조건 `0px` 로 지우던 경로 제거
   - 대신
     - `group.rowStart === 0` 면 top border 유지
     - `group.rowEnd === rowHeights.length` 면 bottom border 유지
     - `group.colStart === 0` 면 left border 유지
     - `group.colEnd === colWidths.length` 면 right border 유지
   - 내부 seam 은 계속 `0px / none / transparent` 로 유지

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. autosnap 누적 drag 검증
   - 대상: `selected_edge_clicked: band-3-cell-1:top`
   - snap 후보: `band-0-header:bottom`
   - 2회 클릭으로 `isolated` 전환 후
     - 1차 move: `-2px`
     - 2차 move: 누적 `-4px`
   - 결과
     - before gap: `8px`
     - after gap: `0px`
     - actual applied delta: `-8px`
   - 즉, 작은 move 가 누적된 뒤에야 snap 범위에 들어오는 케이스에서도 자동 흡착이 재현되었다.
3. outline 복구 검증
   - normalized shell sample `source=band-3-cell-1`
   - `rowRange=0:1, colRange=0:1`
     - `borderTopWidth=1px`
     - `borderLeftWidth=1px`
   - `rowRange=15:16, colRange=2:13`
     - `borderRightWidth=1px`
     - `borderBottomWidth=1px`
   - 즉, split shell 내부 seam 은 비워두고 source giant table 의 바깥 perimeter border 만 복구되었다.

#### 체크리스트

1. `CHK-EDGE-AUTOSNAP-015`
   - 여러 번의 작은 drag move 후에 `5px` 미만 proximity 에 진입해도 autosnap 이 작동해야 한다.
   - 상태: 완료
2. `CHK-EDGE-AUTOSNAP-016`
   - normalized split shell preview 는 내부 seam border 없이 외곽 outline 만 유지해야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-259_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-260_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.16 2026-04-30 autosnap span overlap 필터 제거

#### 실패 원인

1. 사용자가 요구한 autosnap 기준은 "근처에 있는 같은 수직선 혹은 같은 수평선상의 엣지" 였다.
2. 그런데 `resolveEdgeDragAutosnapDelta(...)` 는 snap 후보를 고를 때 `readEdgeSpanOverlapLength(...) > FRAME_RESIZE_TOLERANCE_PX` 조건을 강제하고 있었다.
3. 이 때문에 line coordinate 는 충분히 가깝지만, 화면상 위아래 또는 좌우로 떨어져 있어 span 이 겹치지 않는 edge 는 전부 snap 후보에서 탈락했다.
4. 그래서 실제 마우스 드래그에서는 같은 축의 edge 근처로 가도 `1px` 단위로만 움직이는 경우가 계속 남아 있었다.

#### 수정 원칙

1. autosnap 후보 판정은 같은 page 의 같은 orientation edge 라는 조건만 유지한다.
2. snap 은 line coordinate proximity 로만 결정하고, span overlap 은 요구하지 않는다.
3. drag 방향 부호 역전 금지, edge drag 전용, 패널 width/height 입력 비적용 원칙은 그대로 유지한다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `resolveEdgeDragAutosnapDelta(...)`
   - snap 후보 필터에서 `readEdgeSpanOverlapLength(...)` 조건 제거
   - 따라서 같은 vertical / horizontal axis 상에서 `5px` 미만으로 접근한 edge 는 span 이 겹치지 않아도 autosnap 후보가 된다.

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 비겹침 동일 수직선 케이스
   - moving: `selected_edge_clicked: band-1-header:right`
   - candidate: `band-12-cell-4:right`
   - 두 edge 는 같은 vertical axis 에 있고 line diff 는 `4.03125px`
   - span overlap 은 `-391px` 로 전혀 겹치지 않는다.
3. 재현
   - `band-1-header:right` 를 2회 클릭해 `isolated` 전환
   - 오른쪽으로 `4.2px` 드래그
4. 결과
   - before diff: `4.03125px`
   - after diff: `-0.984375px`
   - actual applied delta: `5.015625px`
   - 즉, span 이 겹치지 않는 같은 수직선 edge 에도 autosnap 이 적용되어 요청 drag 보다 더 큰 보정 delta 가 들어갔다.
   - edit overlay 의 기존 `~1px` offset 때문에 완전 `0` 대신 `-0.984375` 로 측정되지만, line snap 자체는 재현되었다.

#### 체크리스트

1. `CHK-EDGE-AUTOSNAP-017`
   - span 이 겹치지 않는 같은 수직선/수평선 edge 도 autosnap 후보가 되어야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-261_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-262_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.17 2026-04-30 autosnap same-side 우선

#### 실패 원인

1. `selected_edge_clicked: band-11-cell-1:top` 처럼 horizontal `top` edge 를 드래그하면, 같은 line 근처에
   - `band-11-cell-2:top`
   - `band-10-cell-1:bottom`
   - `band-10-cell-2:bottom`
   이 동시에 snap 후보로 들어왔다.
2. 이 후보들은 line coordinate 가 `1px` 차이밖에 나지 않아서, 사용자는 사실상 두 개의 snap point 가 중첩된 것처럼 느끼게 되었다.
3. 사용자가 원하는 것은 인접 same-side edge 인 `band-11-cell-2:top` 기준으로만 붙는 것이고, 같은 경계의 opposite-side `bottom` candidate 가 우선되면 안 된다.

#### 수정 원칙

1. 같은 orientation 후보 중에서는 `same-side` edge 를 `opposite-side` edge 보다 항상 우선한다.
2. 같은 side 후보가 여러 개면, 현재 moving edge 와 endpoint gap 이 가장 작은 edge 를 우선한다.
3. 그래도 tie 면 기존처럼 line adjustment 절댓값이 가장 작은 후보를 쓴다.

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `readEdgeEndpointGapLength(...)` 추가
   - `resolveEdgeDragAutosnapDelta(...)`
     - `sidePriority`
       - `candidateEdge.side === member.side ? 0 : 1`
     - `endpointGap`
       - same-side tie-break 용
   - autosnap best match 선택 순서
     - `same-side 우선`
     - `adjustment 절댓값`
     - `endpoint gap`

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. 기준 좌표
   - `band-10-cell-1:bottom.line = 331`
   - `band-10-cell-2:bottom.line = 331`
   - `band-11-cell-1:top.line = 332`
   - `band-11-cell-2:top.line = 332`
3. 재현
   - `band-11-cell-1:top` 2회 클릭으로 `isolated`
   - 먼저 `+20px` 아래로 내려서 `height = 68`
   - 다시 `-16px` 위로 되돌림
4. 결과
   - before: `top = 334`, `height = 88`
   - displaced: `top = 354`, `height = 68`
   - snapped: `top = 334`, `height = 88`
   - 즉, 되돌아올 때 `331` 계열 opposite-side candidate 로 가지 않고, `332` 계열 same-side candidate 로만 복귀했다.

#### 체크리스트

1. `CHK-EDGE-AUTOSNAP-018`
   - 같은 축에 same-side 와 opposite-side candidate 가 함께 있을 때 same-side edge 가 우선되어야 한다.
   - 상태: 완료
2. `CHK-EDGE-AUTOSNAP-019`
   - `band-11-cell-1:top` 복귀 snap 은 `band-11-cell-2:top` line 과 같은 높이 한 점으로 수렴해야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-263_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-264_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`

### 9.18 2026-04-30 shift-drag marquee / box creation mode

#### 기능 분리

1. 기능 A: frame marquee selection service
   - 목적
     - `Shift + drag` 방향에 따라 `contained` 와 `intersected` selection 을 분리한다.
   - 단독 서비스 가치
     - 박스 편집 캔버스가 아닌 다른 템플릿/도면 편집기에서도 같은 selection contract 를 그대로 재사용할 수 있다.
   - 책임 범위
     - drag origin/current point 계산
     - direction 기반 selection mode 결정
     - page-inner 안 frame anchor hit 계산
     - live ghost overlay 표시
   - 비책임 범위
     - edge cohort 선택
     - box resize / move mutation
     - 저장 API 호출
   - API 계약
     - 입력: `pageInner`, `origin`, `current`, `baseSelectionIds`
     - 출력: `mode(contained|intersected)`, `selectedFrameGroupIds`
   - 데이터 소유권
     - runtime drag state only
   - 의존 서비스
     - `collectFrameSelectionAnchors`
     - `readFrameMoveRect`
   - 분리 배포 최소 조건
     - page-local frame rect snapshot
     - selection commit callback
2. 기능 B: frame box creation service
   - 목적
     - 캔버스에서 drag 한 rect 만큼 새 frame shell 을 생성한다.
   - 단독 서비스 가치
     - 추후 “박스 주석 추가”, “워터마크 추가”, “빈 입력영역 생성기” 같은 별도 상품 기능으로 독립시킬 수 있다.
   - 책임 범위
     - create-mode state
     - `relative` / `absolute` shell 생성
     - 신규 frameGroupId 발급
     - 생성 직후 selection commit
   - 비책임 범위
     - 신규 박스 텍스트 채우기
     - 저장 버튼 실행
     - DB 반영
   - API 계약
     - 입력: `pageInner`, `rect`, `positionMode`
     - 출력: `createdFrameGroupId`
   - 데이터 소유권
     - preview DOM shell
     - draft/render html sync
   - 의존 서비스
     - `extractEditorHtml`
     - `extractPreviewRenderHtml`
     - `schedulePreviewEditorState`
   - 분리 배포 최소 조건
     - frame shell html factory
     - created id allocator
3. 기능 C: absolute frame isolation contract
   - 목적
     - `absolute` 박스는 다른 relative box resize 전파에서 제외한다.
   - 단독 서비스 가치
     - watermark / stamp / fixed overlay 기능을 일반 frame layout 과 분리 운영할 수 있다.
   - 책임 범위
     - vertical follower shift 제외
     - width resize instruction 제외
     - outer-bottom follower shift 제외
   - 비책임 범위
     - absolute box 자체 이동/resize 금지 여부 결정
   - API 계약
     - 입력: frame shell attr `data-template-frame-position-mode`
     - 출력: propagation include/exclude decision
   - 데이터 소유권
     - shell position mode attr
   - 의존 서비스
     - `collectWidthResizeInstructions`
     - `shiftShellsBelowBoundary`
     - `applyFrameResizeHeightDelta`
   - 분리 배포 최소 조건
     - mutation pipeline 에서 frame-level policy hook 제공

#### 이번 턴 구현

1. `src/components/template/TemplateEditWorkspace.tsx`
   - `TemplateFramePositionMode`, `FrameMarqueeSelectionMode`, `MarqueeSelectionState`, `CreateBoxState` 추가
   - `FRAME_MARQUEE_GHOST_CLASS`, `FRAME_CREATION_GHOST_CLASS`, `TEMPLATE_FRAME_POSITION_MODE_ATTR`, `CREATED_FRAME_GROUP_PREFIX` 추가
   - `readPageInnerPointerPoint(...)`, `buildPointerDragRect(...)`, `rectContainsRect(...)`, `rectIntersectsRect(...)`, `buildCreatedFrameShell(...)` 추가
   - `handlePreviewPointerDown / Move / Up / Cancel` 에 marquee / create lifecycle 추가
   - 카드 헤더에 `박스 생성` 버튼과 `상대 위치 / 절대 위치` selector 추가
   - create-mode cursor, marquee ghost, create ghost CSS 추가
   - `relative` / `absolute` 전파 차단을 기존 resize pipeline 에 연결
   - 박스 생성 후와 create-mode toggle 후에도 edge overlay 가 유지되도록 `schedulePreviewEditorState()` 재스케줄 보강

#### 브라우저 직접 검증

1. 페이지
   - `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
2. `Shift + drag` contained
   - drag: `170,50 -> 415,80` 좌→우
   - 결과: `selectedIds = [band-5-cell-1, band-5-cell-2]`
   - 해석: rect 안에 완전히 들어온 박스만 선택되었다.
3. `Shift + drag` intersected
   - drag: `400,60 -> 170,80` 우→좌
   - 결과: `selectedIds = [band-5-cell-1, band-5-cell-2, band-6-cell-1, band-6-cell-2]`
   - 해석: rect 에 걸친 박스까지 선택되었다.
4. `relative` 박스 생성
   - `박스 생성` on
   - drag: `300,300 -> 380,360`
   - 결과: `user-box-1`, `mode=relative`, `rect=80x60`, 생성 직후 선택 수 `1`
5. `absolute` 박스 생성
   - selector 를 `absolute` 로 전환
   - drag: `420,300 -> 500,360`
   - 결과: `user-box-2`, `mode=absolute`
6. 생성 후 overlay 유지
   - 첫 박스 생성 후 `edgeCount = 220`
   - create-mode off toggle 후 `edgeCount = 220`
   - 해석: create/toggle rerender 뒤에도 editor edge overlay 가 유지되었다.

#### 실패 원인과 수정

1. create-mode on/off, 새 박스 생성 후 React rerender 가 일어나면 `dangerouslySetInnerHTML` subtree 가 다시 그려지면서 imperatively 추가된 edge overlay 가 사라질 수 있었다.
2. 이를 `commitCreatedFrameShell(...)` 직후 `schedulePreviewEditorState()` 재스케줄과, `boxCreationMode / boxCreationPositionMode` 변화 시 edge overlay 부재를 감지하는 effect 로 막았다.

#### 체크리스트

1. `CHK-BOX-SELECTION-001`
   - `Shift + drag` 좌→우는 contained mode 여야 한다.
   - 상태: 완료
2. `CHK-BOX-SELECTION-002`
   - `Shift + drag` 우→좌는 intersected mode 여야 한다.
   - 상태: 완료
3. `CHK-BOX-CREATE-001`
   - create-mode drag 는 새 frame shell 을 생성해야 한다.
   - 상태: 완료
4. `CHK-BOX-CREATE-002`
   - create-mode selector 는 `relative` / `absolute` attr 를 생성 shell 에 반영해야 한다.
   - 상태: 완료
5. `CHK-BOX-CREATE-003`
   - create-mode on/off 또는 생성 직후에도 edge overlay 가 유지되어야 한다.
   - 상태: 완료

#### 이번 턴 파일/백업

1. 백업
   - `docs/diff/2026-04-30_EDGE-EDIT-271_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-272_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-273_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-274_edgeedit.before.md`
   - `docs/diff/2026-04-30_EDGE-EDIT-275_TemplateEditWorkspace.before.tsx`
   - `docs/diff/2026-04-30_EDGE-EDIT-276_edgeedit.before.md`
2. 수정 파일
   - `src/components/template/TemplateEditWorkspace.tsx`
   - `docs/edgeedit.md`
