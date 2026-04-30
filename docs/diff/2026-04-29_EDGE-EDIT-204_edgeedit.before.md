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

