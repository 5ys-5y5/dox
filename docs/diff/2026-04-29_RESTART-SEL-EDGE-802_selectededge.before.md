# 템플릿 편집기 Selected Edge 재시작 설계서

- 문서 ID: `SELECTED-EDGE-001`
- 개정 일시: `2026-04-29`
- 대상 화면: `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
- 재시작 기준 커밋: `d0a845da35a6bf9181c70556af3b8ac567b31883`
- 연계 diff 기록: `docs/diff/2026-04-29_SELECTED-EDGE-001_design-log.md`

## 1. 수정 전 이해확정 절차 기록

이번 재시작 턴에서 확정된 이해 내용은 아래와 같다.

1. 현재 selected-edge 구현은 폐기한다.
2. 코드 기준점은 반드시 `d0a845da35a6bf9181c70556af3b8ac567b31883` 커밋 버전이다.
3. 설계 문서는 이전 시도 실패를 반영해 다시 작성한다.
4. 해결해야 하는 실제 실패는 아래 세 가지다.
   - 실패 A: 2회 클릭된 엣지가 전혀 독립적으로 움직이지 않는다.
   - 실패 B: 엣지 위치 변경 시 드래그 이동량의 `n`배만큼 적용되는 버그가 있다.
   - 실패 C: 연관 없는 엣지가 함께 이동하지는 않지만, 이동을 차단한다.
5. 명시 재현 기준은 아래를 반드시 포함한다.
   - `band-3-cell-2:left` 는 `band-10-cell-2:left` 계열을 절대 함께 이동시키면 안 된다.
   - `band-3-cell-1:right` 의 이동은 `band-10-cell-2:left` 위치에 의해 어떤 영향도 받으면 안 된다.
6. 이번 턴은 설계 반영 후 구현까지 진행한다.

## 2. 실행 정책 (필수 준수)

이 문서와 후속 구현은 아래 정책을 누락 없이 그대로 따른다.

### 2.1 서비스 독립성 설계 원칙

1. Selected Edge 기능은 편집 화면의 보조 분기 로직이 아니라, 별도 서비스로 분리 가능한 도메인 계약으로 설계한다.
2. 아래 기능은 각각 독립 서비스 단위로 설계한다.
   - 엣지 선택 위상 해석 기능
   - 엣지 활성화 상태 전이 기능
   - 엣지 mutation handle 해석 기능
   - 엣지 리사이즈 계획 및 제약 계산 기능
3. 각 기능은 다음을 반드시 가진다.
   - 기능 목적
   - 단독 서비스로서의 가치
   - 책임 범위
   - 비책임 범위
   - 입력 DTO
   - 출력 DTO
   - 데이터 소유권
   - 의존 서비스
   - 분리 배포 시 최소 조건
4. 기능 간 연동은 오직 계약된 DTO와 이벤트로만 수행한다.
5. 설계 검토 기준은 아래 하나로 고정한다.
   - “이 기능을 지금 당장 별도 서비스로 분리해도 성립하는가?”

### 2.2 모든 코드는 히스토리 없이도 이해 가능해야 한다

1. 후속 구현에서는 이름만 읽어도 실패 원인과 방지 목적이 드러나야 한다.
2. 아래 수준의 의도가 함수명과 타입명에 반영되어야 한다.
   - “두 번째 클릭의 예측 활성 상태를 drag-start 전에 고정한다”
   - “선택 edge 집합을 물리 mutation handle 집합으로 축소한다”
   - “연관 없는 edge 는 constraint graph 에 포함하지 않는다”
3. `edgeIds` 와 `mutationHandles` 를 같은 의미로 섞는 이름은 금지한다.

### 2.3 프론트 UI 변경 원칙

1. `/src/components` 폴더는 수정하지 않고 참고만 한다.
2. 기존 편집 화면의 시각 언어를 유지한다.
3. 후속 구현에서 허용되는 UI 변경은 최소화한다.
   - 엣지 강조선 상태 표현 보정
   - 우측 선택 상태 카드 텍스트 보정
4. 새 범용 UI 컴포넌트 추가는 금지한다.

### 2.4 수정 전 이해확정 절차

1. 구현 시작 전 이해 내용을 문서와 diff 로그에 남긴다.
2. 범위 외 파일이 필요하면 즉시 중단하고 사용자 승인을 받는다.
3. 폴더 단위 허용은 금지한다.

### 2.5 변경 기록 및 롤백 보장

1. 수정 직전 파일은 반드시 `docs/diff` 에 백업한다.
2. 재시작 턴의 백업 파일명은 이 문서와 design log 에 고정한다.
3. diff 로그에는 체크리스트 ID와 백업 파일명을 직접 연결한다.

### 2.6 MCP 테스트 의무

1. 매 실행마다 `chrome-devtools` MCP를 호출한다.
2. 매 실행마다 `supabase` MCP를 호출한다.
3. DB 수정이 필요한 경우 직접 수정하지 않고 사용자 실행용 SQL만 제공한다.
4. MCP 실패 사유와 대체 검증 경로를 기록한다.

## 3. 수정 허용 화이트리스트 (필수 준수)

### 3.1 이번 턴 실제 수정 허용 파일

1. `docs/selectededge.md`
   - 목적: 재시작 설계 반영
2. `docs/diff/2026-04-29_SELECTED-EDGE-001_design-log.md`
   - 목적: 체크리스트, 백업, 검증 기록 반영
3. `src/components/template/TemplateEditWorkspace.tsx`
   - 목적: pointer gesture, selection commit, mutation handle 적용 경로 수정
4. `src/services/templateEdgeSelectionService.ts`
   - 목적: 1회 클릭 / 2회 클릭 활성 상태 전이 수정
5. `src/services/templateEdgeTopologyService.ts`
   - 목적: 직접 연결 connected cohort 증빙 구조 보강
6. `src/lib/templateEdgeSelectionDtos.ts`
   - 목적: activation / mutation handle / resize plan DTO 정의
7. `src/services/templateEdgeResizeIntentService.ts`
   - 목적: 신규 mutation handle plan 서비스 구현

### 3.2 이번 재시작 턴 백업 파일

1. `docs/diff/2026-04-29_RESTART-SEL-EDGE-201_TemplateEditWorkspace.before.tsx`
2. `docs/diff/2026-04-29_RESTART-SEL-EDGE-202_templateEdgeSelectionService.before.ts`
3. `docs/diff/2026-04-29_RESTART-SEL-EDGE-203_templateEdgeTopologyService.before.ts`
4. `docs/diff/2026-04-29_RESTART-SEL-EDGE-204_templateEdgeSelectionDtos.before.ts`
5. `docs/diff/2026-04-29_RESTART-SEL-EDGE-205_selectededge.before.md`
6. `docs/diff/2026-04-29_RESTART-SEL-EDGE-206_selected-edge-design-log.before.md`
7. `docs/diff/2026-04-29_RESTART-SEL-EDGE-207_templateEdgeResizeIntentService.before.ts`
8. `docs/diff/2026-04-29_RESTART-SEL-EDGE-401_TemplateEditWorkspace.before.tsx`
9. `docs/diff/2026-04-29_RESTART-SEL-EDGE-402_templateEdgeSelectionService.before.ts`
10. `docs/diff/2026-04-29_RESTART-SEL-EDGE-403_templateEdgeTopologyService.before.ts`
11. `docs/diff/2026-04-29_RESTART-SEL-EDGE-404_templateEdgeSelectionDtos.before.ts`
12. `docs/diff/2026-04-29_RESTART-SEL-EDGE-405_selectededge.before.md`
13. `docs/diff/2026-04-29_RESTART-SEL-EDGE-406_selected-edge-design-log.before.md`
14. `docs/diff/2026-04-29_RESTART-SEL-EDGE-407_templateEdgeResizeIntentService.before.ts`

## 4. 재시작 기준과 현재 baseline

### 4.1 코드 기준점

현재 구현 작업은 `d0a845da35a6bf9181c70556af3b8ac567b31883` 커밋 기준으로 다시 시작한다.

이 baseline 에는 이미 아래 구조가 존재한다.

1. `TemplateEdgeTopologyService`
   - rect 기반 edge snapshot 과 cohort 계산
2. `TemplateEdgeSelectionService`
   - connected / isolated 토글 계산
3. `TemplateEditWorkspace`
   - pointer gesture, selection state, DOM mutation, snap, width instruction 을 한 파일에서 통합 처리

### 4.2 baseline 에서 확인된 구조적 결함

1. `selected edge` 와 `physical mutation handle` 이 분리되어 있지 않다.
2. `edge selection state` 와 `drag-start selection state` 가 같은 계약으로 고정되지 않는다.
3. edge resize 중에도 generic box resize snap 경로를 계속 사용한다.
4. 외부 non-target frame 이 sibling snap rect 로 남아 unrelated blocking 을 일으킬 수 있다.
5. 실제 localhost 페이지는 `band-3-cell-2`, `band-4-cell-2`, `band-10-cell-2` 를 하나의 giant `.v102-frame-band` / shared colgroup 안에 넣고 있어, selection state 가 맞아도 물리 resize boundary 는 여전히 공유된다.

## 5. 실패 조건 정의

### 5.1 실패 A: 2회 클릭 edge 가 독립되지 않음

1. 같은 edge 를 두 번째 클릭해도 실제 drag 는 기존 connected selection 을 재사용한다.
2. 결과적으로 UI 상 isolated 로 기대하더라도 실제 이동은 group resize 처럼 동작한다.

### 5.2 실패 B: 드래그 이동량의 `n`배 적용

1. 동일 물리 경계를 공유하는 여러 selected edge 가 있을 때, delta 가 edge 수만큼 중복 적용될 수 있다.
2. 이 버그는 “selected edge ids” 를 그대로 mutation loop 에 넣을 때 발생한다.
3. 해결 단위는 edge 가 아니라 unique mutation handle 이어야 한다.

### 5.3 실패 C: 연관 없는 edge 의 blocking

1. unrelated edge 는 이동되면 안 된다.
2. unrelated edge 는 이동량 계산, snap, clamp, blocked minimum 판단에도 영향을 주면 안 된다.
3. `band-3-cell-1:right` 조정은 `band-10-cell-2:left` 의 존재 여부와 무관해야 한다.

## 6. 원인 분석

### 6.1 원인 A: selection commit 시점이 drag-start 보다 늦다

현재 baseline 흐름은 아래와 같다.

1. `pointerdown`
   - `edgePressState.currentSelection = edgeSelectionStateRef.current`
2. `pointermove`
   - threshold 초과 시 `resolveEdgeSelectionForResizeStart()` 호출
3. `pointerup`
   - 그제서야 `resolveClick()` 로 connected / isolated 토글 확정

이 구조에서는 2회 클릭 isolated 가 drag-start 이전에 반영되지 않는다.

### 6.2 원인 B: selected edge 와 mutation handle 을 구분하지 않는다

baseline 의 `collectEdgeResizeTargets()` 는 selection membership 을 그대로 mutation loop 로 변환한다.

이 구조의 문제는 아래와 같다.

1. 선택 의미는 UI/UX 도메인이다.
2. 실제 DOM 변경 의미는 물리 경계 도메인이다.
3. 여러 edge 가 하나의 동일 boundary operation 으로 수렴하는 경우, delta 를 edge 수만큼 적용하면 `n`배 이동 버그가 생긴다.

### 6.3 원인 C: external sibling snap 이 edge resize 에 그대로 섞인다

baseline 의 edge resize 경로는 `snapResizedRect()` 를 호출할 때 page 내의 다른 frame rect 를 sibling rect 로 넣는다.

이 구조의 문제는 아래와 같다.

1. unrelated frame 이 실제 mutation target 은 아니어도 snap blocker 가 된다.
2. line alignment 만 우연히 맞아도 unrelated edge 가 이동량을 막는다.
3. `band-3-cell-1:right` 와 `band-10-cell-2:left` 처럼 연관 없는 경계가 constraint graph 안에 잘못 같이 들어간다.

### 6.4 원인 D: connected cohort 의 증빙 데이터가 약하다

현재는 `cohortId` 와 `edgeIds` 만 있고, 왜 연결되었는지에 대한 직접 adjacency proof 가 없다.

이 때문에 아래 검증이 어렵다.

1. 왜 connected selection 에 포함되었는가
2. 왜 excluded 되었는가
3. 직접 연결이 아닌 단순 정렬 관계가 잘못 포함되었는가

### 6.5 원인 E: shared multi-row band 가 selection 과 무관하게 독립 이동을 깨고 있었다

`chrome-devtools` 로 실제 `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 를 열어 확인한 결과, root 원인은 selection service 이전의 giant DOM band 구조였다.

실측 내용:

1. 초기 `.v102-frame-band` 는 총 4개였다.
2. 문제 shell 하나가 아래 상태였다.
   - `top=40px`
   - `left=38px`
   - `width=688px`
   - `height=656px`
   - `rows=16`
   - `frameCells=51`
3. `band-3-cell-2` 와 `band-4-cell-2` 는 서로 다른 frame 이지만 같은 shell 안의 shared table boundary 를 사용했다.
4. 이 구조에서는 `isolated` selection 으로 바뀌어도 left boundary 조정이 row-local resize 가 아니라 giant shell colgroup mutation 으로 해석된다.
5. `band-3-cell-1:right` 와 `band-10-cell-2:left` blocker 관계도 selection graph 가 아니라 giant shell 내부 shared minimum / shared boundary 계산에서 생긴다.

결론:

1. giant multi-row band 는 edge topology 계산 전에 `frame cell` 단위 shell 로 분해되어야 한다.
2. 높이 변경은 row 전체가 아니라 `같은 row boundary + 겹치는 column span` 기준으로만 전파되어야 한다.
3. 이후 selection / intent / resize 는 정규화된 cell shell 을 기준으로만 동작해야 한다.

### 6.6 이번 실패한 이유와 반복 금지 규칙

이번 턴 직전 실패를 다시 분석한 결과, 같은 실수를 반복하게 만든 원인은 아래와 같다.

1. 실패 이유 1: `2회 클릭 isolated` 를 계산만 하고, click 종료와 drag 시작이 같은 예측 결과를 공유하지 않았다.
   - 재발 방지 규칙: `pointerdown` 에서 계산한 `predictedSelection` 을 click `pointerup` 과 drag-start 둘 다에서 동일 객체로 commit 한다.
2. 실패 이유 2: `edgeSelectionStateRef.current`, React state, 실제 DOM selection UI 가 서로 다른 시점에 갱신되었다.
   - 재발 방지 규칙: edge gesture commit 은 반드시 `applyRuntimeSelectionUi`, `setSelectedFrameGroupIds([])`, `setEdgeSelectionState(...)` 를 같은 경로에서 수행한다.
3. 실패 이유 3: edge resize 전용 경로에서 generic `snapResizedRect()` 차단이 완전히 끝나지 않았다.
   - 재발 방지 규칙: `resizeState.edgeResizeTargets` 가 존재하면 sibling snap 기반 blocker 계산을 절대 호출하지 않는다.
4. 실패 이유 4: service-level synthetic 테스트만으로 workspace pointer lifecycle 문제까지 검증했다고 잘못 판단했다.
   - 재발 방지 규칙: 검증 기록은 `selection/topology service` 테스트와 `workspace pointer lifecycle` 검증 한계를 분리해서 명시한다.
5. 실패 이유 5: drag-start 를 click-toggle 의 연장으로 오해해, 이미 `connected` 로 활성화된 edge 를 다시 drag 할 때도 `isolated` 로 강등시키는 잘못된 규칙을 넣었다.
   - 재발 방지 규칙: drag-start 는 “현재 활성화된 selection 을 그대로 이동시키는 행위”로 해석한다. 이미 선택된 edge 의 drag 는 `connected` 와 `isolated` 모두 현재 mode 를 유지해야 한다.
6. 실패 이유 6: giant multi-row band 를 유지한 채 selection state 수정만으로 독립 이동이 성립할 것이라고 가정했다.
   - 재발 방지 규칙: localhost 실페이지에서 giant shell 이 확인되면 selection 수정 전에 DOM normalization 전략을 먼저 구현한다.
7. 실패 이유 7: 하니스 synthetic success 를 실페이지 success 로 오판했다.
   - 재발 방지 규칙: 실제 `localhost:3001` 페이지의 shell 수, giant shell row/cell 구조, click selection 전이 기록을 별도 남긴다.
8. 실패 이유 8: row-range shell 은 bottom/top edge height 변경에서 같은 row 의 다른 cell 을 물리적으로 분리할 수 없었다.
   - 재발 방지 규칙: 높이 독립성이 필요한 구간은 row-range 가 아니라 `frame cell` shell 로 분해한다.
9. 실패 이유 9: vertical dependency 를 page 전체나 row 전체로 처리해, 실제로는 같은 column span 만 따라가야 하는 shell 까지 같이 움직이거나 반대로 필요한 shell 을 놓쳤다.
   - 재발 방지 규칙: top/bottom edge propagation 은 반드시 `boundaryRowIndex + overlapping col range` 계약으로 계산한다.
10. 실패 이유 10: DOM 정규화 결과를 상태 HTML 로 승격하지 않으면 다음 실제 사용자 클릭 전까지 giant shell 기준 DOM 이 다시 남을 수 있다.
   - 재발 방지 규칙: 실페이지 검증 기록은 “새로고침 직후 raw DOM” 과 “첫 실제 클릭 후 normalized DOM” 을 분리해 남긴다.

## 7. 비가역 설계 원칙

후속 구현은 아래 원칙을 절대 어기면 안 된다.

1. `selectedEdgeIds` 와 `mutationHandles` 는 서로 다른 DTO다.
2. `mutationHandle` 하나에는 pointermove 당 delta 를 최대 1회만 적용한다.
3. edge resize 에서는 generic sibling snap 을 사용하지 않는다.
4. unrelated edge 는 movement graph 와 constraint graph 양쪽에서 모두 제외한다.
5. 2회 클릭 isolated 는 `pointerdown preview` 단계에서 이미 계산되어야 한다.
6. 이미 선택된 edge 의 drag-start 는 click-toggle 을 다시 실행하지 않는다.
7. giant multi-row band 가 남아 있으면 selection service 수정만으로는 독립 이동이 성립하지 않으므로, DOM normalization 이전 결과를 최종 검증 근거로 사용하지 않는다.
8. top/bottom edge dependency 는 row 전체가 아니라 overlapping column span 에만 전파한다.

## 8. 핵심 개념

### 8.1 Direct Edge Adjacency

직접 연결 증빙 단위다.

필수 속성:

1. `fromEdgeId`
2. `toEdgeId`
3. `orientation`
4. `side`
5. `sharedCoordinate`
6. `relation`
   - `touching-endpoint`

### 8.2 Predicted Activation

현재 press 가 클릭으로 끝나든 drag 로 이어지든, 이번 gesture 에서 사용해야 할 다음 활성 상태다.

### 8.3 Mutation Handle

실제 DOM width/height/position mutation 을 한 번만 적용해야 하는 물리 단위다.

필수 속성:

1. `handleId`
2. `pageId`
3. `frameGroupId`
4. `side`
5. `axis`
6. `operationKind`
   - `table-boundary`
   - `outer-shell-edge`
7. `constraintFamilyId`

### 8.4 Constraint Family

같은 resize constraint 와 capacity 계산을 공유하는 handle 묶음이다. unrelated handle 은 같은 family 가 될 수 없다.

## 9. 기능 분해: 독립 서비스 단위

### 9.1 기능 A: Edge Topology Service

#### 1. 기능 목적

live rect 기준 edge descriptor, direct adjacency, connected cohort 를 계산한다.

#### 2. 단독 서비스로서의 가치

브라우저 UI 없이도 connected edge selection 을 판정할 수 있다.

#### 3. 책임 범위

1. `EdgeDescriptor` 생성
2. `DirectEdgeAdjacency` 생성
3. connected component 계산
4. cohort proof 생성

#### 4. 비책임 범위

1. click sequence 해석
2. mutation handle 계산
3. DOM 쓰기

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeTopologySourceDto = {
  frames: TemplateEdgeFrameDto[];
  tolerancePx: number;
};
```

출력 DTO:

```ts
type TemplateEdgeTopologySnapshotDto = {
  edges: TemplateEdgeDescriptorDto[];
  adjacencies: TemplateEdgeDirectAdjacencyDto[];
  cohorts: TemplateEdgeCohortDto[];
};
```

#### 6. 데이터 소유권

1. `edges`
2. `adjacencies`
3. `cohorts`

#### 7. 의존 서비스

1. 없음

#### 8. 분리 배포 시 필요한 최소 조건

1. frame rect JSON 입력
2. tolerance 설정
3. JSON 출력 채널

### 9.2 기능 B: Edge Activation Service

#### 1. 기능 목적

1회 클릭 connected, 2회 클릭 isolated, Shift 누적 규칙을 계산하고 predicted activation 을 생성한다.

#### 2. 단독 서비스로서의 가치

event metadata 와 current selection 만 있으면 다음 활성 상태를 결정할 수 있다.

#### 3. 책임 범위

1. connected / isolated 전이
2. incompatible selection 교체
3. predicted activation 계산
4. effective selected edge ids 계산

#### 4. 비책임 범위

1. mutation handle 계산
2. DOM resize
3. external snap 판단

#### 5. API 계약

입력 DTO:

```ts
type TemplateSelectedEdgeActivationRequestDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
  clickedEdgeId: string;
  withShift: boolean;
  phase: 'pointerdown-preview' | 'pointerup-commit' | 'drag-start';
};
```

출력 DTO:

```ts
type TemplateSelectedEdgeActivationResultDto = {
  nextSelectionState: TemplateEdgeSelectionStateDto;
  activatedMode: 'connected' | 'isolated' | null;
  effectiveEdgeIds: string[];
  activationReason:
    | 'new-connected'
    | 'toggle-isolated'
    | 'toggle-connected'
    | 'append-connected'
    | 'replace-incompatible';
};
```

#### 6. 데이터 소유권

1. `nextSelectionState`
2. `activatedMode`
3. `effectiveEdgeIds`

#### 7. 의존 서비스

1. `Edge Topology Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. topology snapshot
2. current selection
3. clicked edge metadata

### 9.3 기능 C: Edge Mutation Handle Service

#### 1. 기능 목적

selected edge ids 를 unique physical mutation handle 집합으로 변환한다.

#### 2. 단독 서비스로서의 가치

selection service 와 DOM mutation logic 사이에 “한 edge = 한 mutation” 오해를 끊을 수 있다.

#### 3. 책임 범위

1. edge -> mutation handle 매핑
2. 동일 물리 경계의 dedupe
3. `constraintFamilyId` 계산
4. handle-level metadata 제공

#### 4. 비책임 범위

1. connected selection 계산
2. pointer delta 적용
3. actual DOM write

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeMutationHandleRequestDto = {
  root: HTMLElement;
  snapshot: TemplateEdgeTopologySnapshotDto;
  effectiveEdgeIds: string[];
  clickedEdgeId: string;
};
```

출력 DTO:

```ts
type TemplateEdgeMutationHandleResultDto = {
  handles: TemplateEdgeMutationHandleDto[];
  clickedHandleId: string | null;
};
```

#### 6. 데이터 소유권

1. `handles`
2. `clickedHandleId`
3. `constraintFamilyId`

#### 7. 의존 서비스

1. `Edge Topology Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. DOM adapter 또는 shell/boundary metadata 입력
2. selected edge ids

#### 9. 현재 whitelist 구현 반영 메모

1. 이번 턴 구현에서는 `TemplateEditWorkspace.tsx` 의 `collectEdgeResizeTargets()` 가 기능 C의 DOM adapter 역할을 수행한다.
2. 다만 adapter 입력은 `TemplateEdgeResizeIntentService.resolveResizeIntent()` 의 `targetEdgeIds` 로 고정하여 selection state 와 mutation target 의 혼용을 방지한다.

### 9.4 기능 D: Edge Resize Plan Service

#### 1. 기능 목적

mutation handle 집합과 pointer delta 를 받아, 실제 적용할 operation 과 allowed constraint scope 를 계산한다.

#### 2. 단독 서비스로서의 가치

UI outside 환경에서도 “한 move 에 어느 handle 에 얼마를 한 번만 적용할지”를 계산할 수 있다.

#### 3. 책임 범위

1. handle-level resize plan 계산
2. pointer delta 의 단일 적용 보장
3. unrelated constraint 제거
4. blocked reason 계산

#### 4. 비책임 범위

1. click sequence 해석
2. adjacency 생성
3. React state 저장

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeResizePlanRequestDto = {
  handles: TemplateEdgeMutationHandleDto[];
  clickedHandleId: string | null;
  side: TemplateEdgeSide;
  pointerDeltaPx: number;
};
```

출력 DTO:

```ts
type TemplateEdgeResizePlanDto = {
  targetHandleIds: string[];
  handleOperations: TemplateEdgeMutationOperationDto[];
  blockedReason: 'none' | 'minimum-size' | 'missing-handle' | 'incompatible-side';
  ignoreExternalSiblingSnap: true;
};
```

#### 6. 데이터 소유권

1. `targetHandleIds`
2. `handleOperations`
3. `blockedReason`

#### 7. 의존 서비스

1. `Edge Mutation Handle Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. handle DTO 입력
2. pointer delta 입력

#### 9. 현재 whitelist 구현 반영 메모

1. 이번 턴 구현에서는 기능 D의 계산이 `TemplateEditWorkspace.tsx` 내부 shared-delta resolver 로 들어간다.
2. 대신 아래 보장 조건은 그대로 유지한다.
   - target handle 들 중 최소 허용 delta 를 먼저 계산한다.
   - 계산된 동일 delta 를 target handle 들에 한 번씩만 적용한다.
   - unrelated sibling snap 을 edge resize 경로에 넣지 않는다.
3. giant multi-row band 정규화는 기능 D 이전의 DOM adapter 준비 단계로 `TemplateEditWorkspace.tsx` 안에서 수행한다.
4. 정규화된 shell 은 `rowRange + colRange` 메타데이터를 가져야 하며, vertical dependency 계산은 이 메타데이터만 사용한다.

## 10. 구현 원칙

### 10.1 pointerdown

1. `snapshot` 계산
2. giant multi-row band 가 남아 있으면 먼저 `frame cell` shell 로 정규화
2. `TemplateEdgeResizeIntentService.resolveResizeIntent(...)` 호출
3. 반환된 `predictedSelection` 과 `targetEdgeIds` 를 `edgePressState` 에 저장
4. 저장 대상은 `currentSelection` 이 아니라 pointerdown 에서 계산된 예측 결과다

### 10.2 drag-start

1. `targetEdgeIds` 를 `Edge Mutation Handle Service` 로 전달
2. unique `handles` 를 계산
3. `Edge Resize Plan Service` 로 `targetHandleIds` 와 `handleOperations` 계산
4. 이후 pointermove 는 `handleOperations` 만 반복 집행
5. 이번 턴 구현에서는 1~3단계를 `TemplateEdgeResizeIntentService` 와 `TemplateEditWorkspace` 내부 adapter/helper 조합으로 수행한다.

### 10.3 pointermove

1. delta 는 handle 당 최대 1회 적용한다.
2. edge count 만큼 loop 를 돌려 같은 handle 을 중복 적용하면 안 된다.
3. edge resize 경로에서는 generic `snapResizedRect()` 의 unrelated sibling rect 사용을 금지한다.
4. 필요한 제약은 `constraintFamilyId` 내부에서만 계산한다.

### 10.4 pointerup

1. drag 가 없었으면 `pointerdown` 에서 저장한 `predictedSelection` 을 그대로 commit
2. drag 가 있었으면 drag-start 시점에 commit 된 selection 을 유지한 채 live reconcile 결과를 commit
3. commit 함수는 아래 둘을 동시에 갱신
   - `edgeSelectionStateRef.current`
   - `setEdgeSelectionState(...)`

### 10.5 금지 구현

1. `edgeIds` 를 그대로 mutation loop 에 넣는 것
2. connected / isolated 전이를 pointerup 에서만 생각하는 것
3. edge resize 중 generic sibling snap 으로 external frame 을 blocker 로 넣는 것
4. unrelated edge 를 snap rect 나 minimum capacity 판단에 포함하는 것
5. 특정 `band-*` 예외 하드코딩으로 문제를 덮는 것
6. giant shared band 를 유지한 채 isolated drag 만 기대하는 것

## 11. 검증 시나리오

### 11.1 2회 클릭 독립성

1. 같은 edge 1회 클릭
2. connected cohort 강조 확인
3. 같은 edge 2회 클릭
4. 강조가 해당 edge 하나만 남는지 확인
5. drag 시 해당 edge 하나만 변하는지 확인
6. drag 종료 후 selection mode 가 다시 `connected` 로 되돌아가지 않는지 확인

### 11.2 n배 이동 방지

1. 동일 물리 boundary 를 공유하는 connected edge 묶음 선택
2. 10px drag
3. 실제 applied delta 가 정확히 10px 인지 확인
4. edge 수가 2개, 3개여도 20px, 30px 로 증폭되지 않는지 확인

### 11.3 unrelated blocking 방지

1. `band-3-cell-1:right` 선택
2. `band-10-cell-2:left` 와 alignment 가 같아도 drag 수행
3. `band-10-cell-2:left` 가 이동하지 않고, snap blocker 도 되지 않는지 확인

### 11.4 unrelated movement 방지

1. `band-3-cell-2:left` 선택
2. drag 수행
3. `band-10-cell-2:left` 계열이 절대 같이 이동하지 않는지 확인
4. 같은 physical handle 반대편인 `band-3-cell-1:right` drag 도 `band-10-cell-2:left` 와 무관한지 확인

### 11.5 giant band 정규화 검증

1. 페이지 로드 직후 giant shell row/cell 구조를 읽는다.
2. 첫 실제 frame click 이후 `.v102-frame-band[data-v106-normalized-band="true"]` 가 생성되는지 확인한다.
3. root 하위 shell 수가 증가하고 `frame cell` 단위 shell 로 분해되는지 확인한다.
4. `band-3-cell-1`, `band-3-cell-2`, `band-4-cell-2`, `status-history-1` 이 서로 다른 shell / rowRange / colRange 를 가지는지 확인한다.

## 12. 체크리스트

- `CHK-RESTART-SEL-EDGE-001`
  - 목표: 2회 클릭 isolated 가 drag-start 전에 확정되도록 설계한다.
  - 완료 기준: `predictedSelection` / `targetEdgeIds` 기반 flow 가 문서화되어 있다.
  - 증빙 방법: 본 문서 6.1절, 9.2절, 10.1절, 10.4절

- `CHK-RESTART-SEL-EDGE-002`
  - 목표: `edgeIds` 와 `mutationHandles` 를 분리한다.
  - 완료 기준: 두 DTO와 별도 서비스가 존재한다.
  - 증빙 방법: 본 문서 7장, 8.3절, 9.3절

- `CHK-RESTART-SEL-EDGE-003`
  - 목표: `n`배 이동 버그를 구조적으로 막는다.
  - 완료 기준: handle 당 delta 1회 적용 규칙이 명시되어 있다.
  - 증빙 방법: 본 문서 5.2절, 6.2절, 10.2절, 10.3절

- `CHK-RESTART-SEL-EDGE-004`
  - 목표: unrelated edge 가 constraint graph 에 들어오지 못하게 한다.
  - 완료 기준: external sibling snap 금지와 constraint family 규칙이 명시되어 있다.
  - 증빙 방법: 본 문서 5.3절, 6.3절, 8.4절, 9.4절, 10.3절

- `CHK-RESTART-SEL-EDGE-005`
  - 목표: 직접 연결 connected cohort 증빙 구조를 강화한다.
  - 완료 기준: adjacency proof DTO 와 topology service 책임이 정의되어 있다.
  - 증빙 방법: 본 문서 6.4절, 8.1절, 9.1절

- `CHK-RESTART-SEL-EDGE-006`
  - 목표: 재시작 기준 커밋과 백업 파일을 고정한다.
  - 완료 기준: baseline commit 과 restart backup 파일명이 명시되어 있다.
  - 증빙 방법: 본 문서 3.2절, 4.1절

- `CHK-RESTART-SEL-EDGE-007`
  - 목표: giant multi-row band 를 edge topology 이전에 `frame cell` shell 로 정규화한다.
  - 완료 기준: giant shell 이 normalized cell-shell 묶음으로 대체되고, 각 shell 이 `rowRange/colRange` 메타데이터를 가진다.
  - 증빙 방법: 본 문서 4.2절, 6.5절, 10.1절, 11.5절

## 13. MCP 테스트 및 실행 기록

### 13.1 `supabase` MCP

실행 일시: `2026-04-29`

1. `mcp__supabase__.list_migrations` 호출 시 `Auth required` 로 실패했다.
2. 이번 기능은 DB 변경이 없으므로 추가 SQL 실행은 없다.

### 13.2 `chrome-devtools` MCP

실행 일시: `2026-04-29`

1. `mcp__chrome_devtools__.list_pages` 호출 성공
2. 실제 `localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 페이지를 직접 열어 giant shell 구조를 확인했다.
3. 초기 giant shell 실측:
   - `.v102-frame-band` 총 4개
   - 문제 shell `rows=16`, `frameCells=51`
4. 첫 실제 frame click 이후 normalized shell 실측:
   - `.v102-frame-band` 총 54개
   - `.v102-frame-band[data-v106-normalized-band="true"]` 51개
   - `band-3-cell-1` shell: `rowRange=0:1`, `colRange=0:1`
   - `band-3-cell-2` shell: `rowRange=0:1`, `colRange=1:4`
   - `band-4-cell-2` shell: `rowRange=1:2`, `colRange=1:4`
   - `status-history-1` shell: `rowRange=0:2`, `colRange=4:12`
5. click 검증:
   - `band-3-cell-2` 선택 후 `bottom edge` 1회 클릭 시 `connected`, edge 수 `2`, anchor `band-3-cell-2:bottom`
   - 같은 edge 2회 클릭 시 `isolated`, edge 수 `1`, anchor `band-3-cell-2:bottom`
6. synthetic pointer drag 는 이번 cell-shell 구조에서 React resize capture 를 재현하지 못했다.
7. 따라서 최종 drag 판정은 실제 human drag 로 재확인해야 하며, 이번 MCP 기록은 `실제 click 전이 + normalized shell geometry` 까지를 증빙으로 남긴다.

### 13.3 대체 검증 경로

1. 코드 baseline 을 `d0a845...` 로 복원
2. localhost 실페이지 giant shell 구조를 `chrome-devtools` 로 직접 확인
3. 구조 분석 기반 설계 갱신
4. 후속 구현 후 파일 단위 타입체크와 컴포넌트 번들을 수행
5. `chrome-devtools` 에서 실제 click selection 전이와 normalized shell 생성 여부를 확인
