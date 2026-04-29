# 템플릿 편집기 Selected Edge 설계서

- 문서 ID: `SELECTED-EDGE-001`
- 작성 일시: `2026-04-29`
- 대상 화면: `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
- 사용자 확정 상태: 요청 본문으로 범위 확정
- 연계 diff 기록: `docs/diff/2026-04-29_SELECTED-EDGE-001_design-log.md`

## 1. 수정 전 이해확정 절차 기록

이번 턴은 사용자 요청 본문 자체를 이해확정 입력으로 기록한다. 본 요청에는 산출물, 대상 URL, 구현 목표, 현재 버그, 실행 정책이 모두 포함되어 있어 추가 범위 추정이 필요하지 않다.

이번 턴에서 확정된 이해 내용은 아래와 같다.

1. 이번 턴의 산출물은 구현 코드가 아니라 `docs/selectededge.md` 설계 문서다.
2. 설계 대상 행동은 두 가지다.
   - 1회 클릭 활성 선택 상태: 같은 수직/수평 방향을 가지며, 같은 조정선 위에서 시작점과 끝점이 직접 이어지는 엣지만 함께 움직일 수 있어야 한다.
   - 2회 클릭 활성 선택 상태: 같은 엣지를 다시 활성화했을 때 해당 엣지 하나만 움직일 수 있어야 한다.
3. 현재 해결해야 하는 버그는 두 가지다.
   - 버그 A: 2회 클릭으로 개별 선택된 엣지가 실제 드래그에서는 1회 클릭의 연결 선택처럼 연관 엣지를 함께 이동시킨다.
   - 버그 B: 연관이 없는 엣지가 강제로 이동된다. 재현 예시는 `band-3-cell-2:left` 를 이동할 때 `band-10-cell-2:left` 와 그 연관 엣지가 함께 이동하는 현상이다.
4. 이번 턴은 설계 문서와 설계 로그만 작성한다. 런타임 코드 수정과 DB 수정은 범위에 포함하지 않는다.

## 2. 실행 정책 (필수 준수)

이 문서와 후속 구현은 아래 정책을 누락 없이 그대로 따른다.

### 2.1 서비스 독립성 설계 원칙

1. Selected Edge 기능은 편집 화면 내부의 임시 포인터 분기 로직으로 두지 않는다.
2. 아래 기능들은 각각 별도 서비스로 분리 가능한 계약 단위로 설계한다.
   - 엣지 직접 연결성 해석 기능
   - 엣지 선택 상태 전이 기능
   - 엣지 리사이즈 의도 계산 기능
3. 각 기능은 다음을 반드시 독립적으로 가진다.
   - 기능 목적
   - 단독 서비스로서의 가치
   - 책임 범위
   - 비책임 범위
   - 입력 DTO
   - 출력 DTO
   - 데이터 소유권
   - 의존 서비스
   - 분리 배포 시 최소 조건
4. 다른 기능 구현 세부사항에는 직접 의존하지 않는다.
   - DOM query 세부 구현
   - React state 변수명
   - 특정 카드 UI 구조
   - width instruction 내부 배열 형식
5. 기능 간 연동은 계약된 DTO와 이벤트로만 수행한다.
6. 설계 검토 기준은 아래 하나로 고정한다.
   - “이 기능을 지금 당장 별도 서비스로 분리해도 성립하는가?”

### 2.2 모든 코드는 히스토리 없이도 이해 가능해야 한다

1. 후속 구현에서는 타입명, 함수명, 주석이 “왜 이 분기가 존재하는지”를 설명해야 한다.
2. `resolve`, `toggle`, `group`, `apply` 같은 추상 이름만으로는 부족하다.
3. 아래 수준의 의도가 이름만으로 드러나야 한다.
   - “직접 연결된 끝점만 따라 connected cohort 를 계산한다”
   - “두 번째 클릭의 예측 선택 상태를 drag start 전에 고정한다”
   - “실제 mutation 대상 엣지 집합이 선택 집합을 벗어나지 않도록 보장한다”
4. 다른 LLM이 과거 대화를 모른 채 코드를 읽어도, 왜 stale selection 을 버리고 predicted selection 을 쓰는지 이해할 수 있어야 한다.

### 2.3 프론트 UI 변경 원칙

1. `/src/components` 폴더는 수정하지 않고 참고만 한다.
2. `/app` 아래 기존 편집 화면의 시각 언어를 유지한다.
3. 후속 구현에서 허용되는 시각 변경은 최소 범위만 허용한다.
   - 기존 엣지 강조선의 상태 표현 보정
   - 우측 선택 상태 카드의 디버그 문구 보정
4. 새로운 범용 UI 컴포넌트 추가는 이번 설계 범위에 포함하지 않는다.

### 2.4 수정 전 이해확정 절차

1. 후속 구현 턴에서는 실제 수정 전에 이해 내용을 다시 목록으로 정리한다.
2. 사용자의 명시적 확정 없이 구현 파일 수정에 착수하지 않는다.
3. 이번 턴은 사용자가 설계 문서 작성을 직접 요청했으므로, 문서 작성 범위만 확정 상태로 기록한다.

### 2.5 변경 기록 및 롤백 보장

1. 후속 구현 승인이 나면 수정 직전 파일을 반드시 `docs/diff` 에 백업한다.
2. 백업 파일명은 이 문서에 미리 고정한다.
3. 어떤 체크리스트가 어떤 백업 파일과 연결되는지 diff 로그에 직접 기록한다.

### 2.6 확정 범위 외 수정 금지

1. 이번 턴 확정 범위는 설계 문서와 설계 로그 작성까지다.
2. 구현 파일 수정은 후속 승인 전까지 금지한다.
3. 추가 파일이 필요하면 파일 경로를 개별적으로 제안하고 다시 승인받는다.
4. 폴더 단위 허용은 금지한다.

### 2.7 체크리스트 작성 의무

1. 설계 단계와 구현 단계 모두 체크리스트 ID를 사용한다.
2. 각 체크리스트는 아래 세 가지를 가져야 한다.
   - 목표
   - 완료 기준
   - 증빙 방법
3. diff 문서에는 체크리스트 ID를 반드시 함께 적는다.

### 2.8 MCP 테스트 의무

1. 매 실행마다 `chrome-devtools` MCP를 호출한다.
2. 매 실행마다 `supabase` MCP를 호출한다.
3. DB 수정이 필요한 경우 에이전트가 직접 DB를 바꾸지 않고, 사용자 실행용 SQL만 제공한다.
4. 테스트 수행 결과와 막힌 이유를 문서 하단에 남긴다.
5. 관련 기능은 하나의 API 계약으로 구현하며, 과도한 중첩 호출 구조는 금지한다.

## 3. 수정 허용 화이트리스트 (필수 준수)

### 3.1 이번 턴 실제 수정 허용 파일

1. `docs/selectededge.md`
   - 목적: Selected Edge 설계 문서 본문 작성
2. `docs/diff/2026-04-29_SELECTED-EDGE-001_design-log.md`
   - 목적: 체크리스트 매핑과 MCP 실행 기록 보관

### 3.2 후속 구현 승인 시 최초 제안 파일

아래 파일만 1차 구현 후보로 제안한다. 목록 외 파일 수정이 필요하면 즉시 중단하고 추가 승인을 받아야 한다.

1. `src/components/template/TemplateEditWorkspace.tsx`
   - 사유: pointerdown / pointermove / pointerup 흐름, ref-state 동기화, runtime mutation guard 연결
2. `src/services/templateEdgeSelectionService.ts`
   - 사유: 1회 클릭 connected, 2회 클릭 isolated 전이 규칙과 예측 선택 상태 계산
3. `src/services/templateEdgeTopologyService.ts`
   - 사유: “같은 선상”이 아니라 “직접 연결된 끝점 체인” 기준으로 cohort 와 adjacency proof 계산
4. `src/lib/templateEdgeSelectionDtos.ts`
   - 사유: direct adjacency, activation result, resize intent DTO 계약 고정
5. `src/services/templateEdgeResizeIntentService.ts`
   - 사유: 실제로 이동 가능한 target edge 집합과 DOM mutation plan 을 단일 계약으로 계산하는 신규 서비스

### 3.3 후속 구현 승인 시 생성해야 할 백업 파일

1. `docs/diff/2026-04-29_SELECTED-EDGE-101_TemplateEditWorkspace.before.tsx`
2. `docs/diff/2026-04-29_SELECTED-EDGE-102_templateEdgeSelectionService.before.ts`
3. `docs/diff/2026-04-29_SELECTED-EDGE-103_templateEdgeTopologyService.before.ts`
4. `docs/diff/2026-04-29_SELECTED-EDGE-104_templateEdgeSelectionDtos.before.ts`
5. `docs/diff/2026-04-29_SELECTED-EDGE-105_templateEdgeResizeIntentService.before.ts`

## 4. 현행 구현 조사 결과

현재 구현은 이미 엣지 선택 관련 DTO와 서비스가 존재하지만, “선택 상태”와 “실제 이동 대상”이 같은 계약으로 고정되지 않아 버그가 남아 있다.

### 4.1 현재 계층 구조

1. `src/services/templateEdgeTopologyService.ts`
   - 엣지 snapshot 과 cohort 를 계산한다.
   - 기준은 `orientation`, `side`, `lineCoordinate`, `oppositeCoordinate`, `chainIndex` 다.
2. `src/services/templateEdgeSelectionService.ts`
   - 클릭 시 connected / isolated 토글 규칙을 계산한다.
3. `src/components/template/TemplateEditWorkspace.tsx`
   - pointer event 를 받고, snapshot 생성, selection state 보관, 실제 resize target 수집, DOM mutation 을 한 파일에서 모두 처리한다.

### 4.2 현재 클릭-드래그 흐름

현재 pointer 흐름은 아래 순서다.

1. `pointerdown`
   - `edgePressStateRef.current` 에 `snapshot`, `currentSelection`, `clickedEdgeId` 를 저장한다.
2. `pointermove`
   - threshold 를 넘으면 `resolveEdgeSelectionForResizeStart()` 로 drag 시작 selection 을 정한다.
   - 이어서 `collectEdgeResizeTargets()` 로 실제 mutation 대상 DOM node 를 모은다.
3. `pointerup`
   - 드래그가 시작되지 않은 경우에만 `TemplateEdgeSelectionService.resolveClick()` 로 클릭 결과 selection 을 확정한다.

즉, 현재 구현은 “클릭으로 확정될 다음 선택 상태”보다 “pointerdown 시점의 이전 선택 상태”를 drag 에 더 먼저 사용한다.

### 4.3 현재 버그가 생기는 지점

1. `resolveEdgeSelectionForResizeStart()` 는 클릭한 엣지가 이미 current selection 안에 있으면 기존 selection 을 그대로 반환한다.
2. 따라서 두 번째 클릭으로 isolated 로 전환되어야 하는 엣지도, drag start 가 pointerup 전에 시작되면 기존 connected selection 을 그대로 사용한다.
3. `collectEdgeResizeTargets()` 는 workspace 내부에서 selection token 을 DOM target 으로 다시 해석한다.
4. 이때 실제 mutation 대상이 service 계약이 아니라 workspace 추정 로직에 의해 넓어질 수 있다.
5. `setEdgeSelectionState()` 와 `edgeSelectionStateRef.current` 의 동기화가 같은 tick 에 강제되지 않아, 빠른 연속 입력에서 stale selection 이 다음 gesture 로 넘어갈 수 있다.

## 5. 문제 정의

### 5.1 목표 행동 1

엣지를 1회 클릭해 활성화한 상태에서는 아래가 모두 성립하는 엣지만 함께 이동할 수 있어야 한다.

1. 같은 `orientation`
2. 같은 `side`
3. 같은 `lineCoordinate`
4. 같은 `oppositeCoordinate`
5. 직교 축의 시작점과 끝점이 tolerance 안에서 직접 이어지는 체인

위 다섯 조건 중 하나라도 다르면 같은 connected selection 이 아니다.

### 5.2 목표 행동 2

같은 엣지를 2회 클릭해 활성화한 상태에서는 아래가 성립해야 한다.

1. 선택 강조선은 클릭한 엣지 하나만 남는다.
2. 실제 drag target 도 클릭한 엣지 하나만 남는다.
3. pointerdown 당시 이전 connected selection 이 이후 drag 로 누수되면 안 된다.

### 5.3 실제 버그 A

현재는 같은 엣지를 두 번째 클릭한 뒤 움직이면, 시각적으로는 isolated 상태가 기대되더라도 실제 drag 는 connected selection 을 재사용해 연관 엣지를 함께 이동시킬 수 있다.

### 5.4 실제 버그 B

현재는 선택과 직접 연결되지 않은 엣지가 mutation 대상에 포함될 수 있다. 사용자 재현 예시는 아래다.

1. `band-3-cell-2:left` 를 움직인다.
2. 기대 결과는 `band-3-cell-2:left` 기준의 연결 집합 또는 isolated edge 만 이동하는 것이다.
3. 실제 버그에서는 `band-10-cell-2:left` 와 그 연관 엣지가 함께 이동한다.

## 6. 원인 분석

## 6.1 원인 A: 클릭 확정 시점과 drag 시작 시점이 다르다

현재 connected -> isolated 전환은 `pointerup` 에서 확정된다. 하지만 실제 resize session 은 `pointermove` threshold 에서 먼저 시작될 수 있다.

현재 구조를 시간순으로 풀면 아래와 같다.

1. 첫 클릭 완료
   - selection state 는 `connected`
2. 같은 엣지를 두 번째 클릭
   - `pointerdown` 시점에는 여전히 `connected` state 가 `edgePressState` 에 저장된다.
3. 사용자가 두 번째 클릭에서 바로 드래그 시작
   - `pointermove` 에서 drag session 이 먼저 열린다.
4. `resolveEdgeSelectionForResizeStart()` 는 clicked edge 가 이미 selection 안에 있으므로 기존 `connected` state 를 그대로 사용한다.
5. 그 결과 pointerup 에서 isolated 로 확정되기 전에 이미 connected group 이 이동해 버린다.

즉, 현재 버그 A 의 핵심은 “두 번째 클릭으로 생길 다음 상태”가 아니라 “두 번째 클릭 이전 상태”가 drag start 에 사용된다는 점이다.

## 6.2 원인 B: 상태의 source of truth 가 둘로 나뉘어 있다

현재 구현에는 아래 두 저장소가 동시에 존재한다.

1. React state: `edgeSelectionState`
2. mutable ref: `edgeSelectionStateRef.current`

문제는 pointerup 에서 selection 을 바꿀 때 React state 만 바꾸고, 같은 함수 안에서 ref 를 같은 값으로 강제 동기화하지 않는 경로가 있다는 점이다. 이 구조에서는 아래 현상이 생길 수 있다.

1. 카드 UI 는 최신 state 를 보여준다.
2. 다음 pointerdown / pointermove 는 ref 의 구 selection 을 읽는다.
3. 사용자는 “이미 isolated 로 선택됐다”고 보지만, 런타임은 여전히 connected selection 을 mutation 대상으로 사용한다.

## 6.3 원인 C: 실제 mutation target 집합이 서비스 계약으로 고정되지 않았다

현재 workspace 는 selection token 에서 직접 DOM target 을 다시 만든다. 이 구조는 다음 문제가 있다.

1. selection service 는 “무엇이 선택되었는가”만 말한다.
2. workspace 는 다시 “무엇을 움직일 것인가”를 추정한다.
3. selection membership 과 mutation membership 이 다른 경로에서 계산된다.
4. 이 차이 때문에 stale token, 같은 side token, widened DOM target 이 실제 이동 대상으로 섞일 수 있다.

이 버그를 막으려면 “effective target edge ids” 를 서비스가 먼저 확정하고, workspace 는 그 집합만 그대로 집행해야 한다.

## 6.4 원인 D: ‘직접 연결’의 증빙 데이터가 없다

현재 topology service 의 `chainIndex` 계산은 직접 연결성에 가까운 의미를 갖지만, 왜 두 엣지가 connected 인지 설명하는 adjacency proof 를 남기지 않는다.

그 결과 아래 검증이 어렵다.

1. 왜 이 엣지가 같은 connected group 에 포함되었는가
2. 왜 이 엣지는 제외되었는가
3. `band-3-cell-2:left` 와 `band-10-cell-2:left` 는 어떤 기준에서 분리되어야 하는가

후속 구현은 단순 `edgeIds` 목록뿐 아니라 “직접 이어지는 끝점 쌍”을 계산해야 한다.

## 7. 해결 설계

### 7.1 핵심 설계 원칙

1. 클릭으로 예측되는 다음 선택 상태와 실제 drag 에 사용되는 선택 상태는 동일해야 한다.
2. 실제 mutation 대상 집합은 service 가 계산한 `targetEdgeIds` 하나만을 source of truth 로 사용해야 한다.
3. connected selection 은 “같은 선상”이 아니라 “직접 연결된 끝점 adjacency graph 의 connected component” 로 정의한다.
4. workspace 는 selection 을 계산하지 않는다. workspace 는 입력 DTO 를 서비스로 넘기고 결과를 집행만 한다.

### 7.2 핵심 개념

#### 7.2.1 Direct Edge Adjacency

두 엣지가 직접 연결되었다는 증빙 단위다.

필수 속성:

1. `fromEdgeId`
2. `toEdgeId`
3. `sharedCoordinate`
4. `orientation`
5. `side`
6. `relation`
   - `touching-endpoint`

#### 7.2.2 Predicted Selection State

현재 클릭이 pointerup 으로 끝나면 확정될 다음 선택 상태다. 두 번째 클릭 isolated 토글은 이 단계에서 먼저 확정되어야 한다.

#### 7.2.3 Effective Resize Intent

실제 drag 가 허용하는 유일한 mutation 계약이다.

필수 속성:

1. `effectiveSelectionState`
2. `targetEdgeIds`
3. `targetFrameGroupIds`
4. `activatedMode`
5. `blockedReason`

### 7.3 기능 분해: 독립 서비스 단위

### 7.3.1 기능 A: Selected Edge Topology Service

#### 1. 기능 목적

현재 편집 가능한 엣지 목록과 직접 연결 adjacency graph, connected cohort 를 계산한다.

#### 2. 단독 서비스로서의 가치

브라우저 화면 없이도 frame rect 목록만 있으면 “같이 움직일 수 있는 엣지”를 판정할 수 있다.

#### 3. 책임 범위

1. `EdgeDescriptor` 생성
2. `DirectEdgeAdjacency` 계산
3. connected component 계산
4. cohort proof 생성

#### 4. 비책임 범위

1. 클릭 횟수 관리
2. pointer session 관리
3. DOM mutation

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
  adjacencies: TemplateEdgeAdjacencyDto[];
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
3. JSON 응답 채널

### 7.3.2 기능 B: Selected Edge Activation Service

#### 1. 기능 목적

1회 클릭 connected, 2회 클릭 isolated, Shift 누적 선택 규칙을 계산하고 “이번 gesture 에서 사용해야 할 다음 선택 상태”를 고정한다.

#### 2. 단독 서비스로서의 가치

pointer event stream 과 현재 selection state 만 있으면, 화면 없이도 다음 선택 상태를 결정할 수 있다.

#### 3. 책임 범위

1. click sequence 해석
2. connected / isolated 전이
3. incompatible selection 교체
4. predicted selection state 생성

#### 4. 비책임 범위

1. adjacency 계산
2. width/height DOM 쓰기
3. snap 계산

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
  activatedMode: 'connected' | 'isolated';
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

1. `Selected Edge Topology Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. topology snapshot
2. current selection state
3. clicked edge metadata

### 7.3.3 기능 C: Selected Edge Resize Intent Service

#### 1. 기능 목적

predicted selection state 를 기준으로 실제 mutation 가능한 target edge 집합과 DOM resize plan 을 한 번에 계산한다.

#### 2. 단독 서비스로서의 가치

selection state 와 pointer delta 만 있으면, 화면 밖에서도 어떤 edge 만 움직여야 하는지 결정할 수 있다.

#### 3. 책임 범위

1. drag start 시 target edge 집합 고정
2. connected / isolated 별 mutation membership 계산
3. edge 별 resize operation 생성
4. 최소 크기 차단 사유 계산

#### 4. 비책임 범위

1. click state 토글 자체 결정
2. topology snapshot 생성
3. React state 저장

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeResizeIntentRequestDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  activationResult: TemplateSelectedEdgeActivationResultDto;
  clickedEdgeId: string;
  side: TemplateEdgeSide;
  pointerDeltaPx: number;
};
```

출력 DTO:

```ts
type TemplateEdgeResizeIntentDto = {
  effectiveSelectionState: TemplateEdgeSelectionStateDto;
  targetEdgeIds: string[];
  targetOperations: TemplateEdgeMutationOperationDto[];
  activatedMode: 'connected' | 'isolated';
  blockedReason: 'none' | 'minimum-size' | 'incompatible-side';
};
```

#### 6. 데이터 소유권

1. `targetEdgeIds`
2. `targetOperations`
3. `blockedReason`

#### 7. 의존 서비스

1. `Selected Edge Topology Service`
2. `Selected Edge Activation Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. snapshot
2. activation result
3. pointer delta

## 8. 구현 상세 설계

### 8.1 pointerdown 에서 해야 할 일

현재 selection 을 그대로 저장하지 않고, 아래 두 값을 함께 계산해 `edgePressState` 에 넣는다.

1. `predictedActivationResult`
   - 두 번째 클릭이면 여기서 이미 isolated 로 계산
2. `predictedSelectionState`
   - pointerup 이 오기 전에 drag 가 시작돼도 이 값을 사용

즉, `edgePressState` 는 `currentSelection` 이 아니라 `predictedSelectionState` 를 가진다.

### 8.2 pointermove drag-start 에서 해야 할 일

threshold 를 넘긴 순간 아래 순서로 처리한다.

1. `SelectedEdgeResizeIntentService.resolve(...)`
2. `targetEdgeIds` 고정
3. `resizeState` 에 `targetEdgeIds` 와 `targetOperations` 저장
4. 이후 pointermove 는 이 집합만 반복 적용

여기서 금지되는 구현은 아래와 같다.

1. side 만 같다는 이유로 target 을 다시 확장하는 것
2. token.memberEdgeIds 를 workspace 에서 임의로 덧셈하는 것
3. drag 중 snapshot 재계산 결과로 target membership 을 바꾸는 것

drag 중에는 geometry 는 바뀌어도 membership 은 고정되어야 한다.

### 8.3 pointerup 에서 해야 할 일

1. drag 가 없었으면 `predictedSelectionState` 를 commit 한다.
2. drag 가 있었으면 `effectiveSelectionState` 를 commit 한다.
3. commit 함수는 아래 두 저장소를 같은 함수에서 같이 갱신해야 한다.
   - `edgeSelectionStateRef.current`
   - `setEdgeSelectionState(...)`

즉, “state 는 최신인데 ref 는 이전값”인 상태를 남기면 안 된다.

### 8.4 mutation guard

workspace 는 실제 mutation 전에 아래를 검증해야 한다.

1. 현재 움직이려는 edgeId 가 `targetEdgeIds` 안에 있는가
2. 현재 node 가 `clickedEdgeId` 의 predicted selection 이 허용한 node 인가
3. 허용되지 않은 edge 는 무조건 skip 하는가

이 guard 가 있으면 `band-3-cell-2:left` drag 에서 `band-10-cell-2:left` 체인이 섞이는 것을 차단할 수 있다.

### 8.5 direct adjacency 계산 규칙

직접 연결 adjacency 는 아래 조건을 동시에 만족할 때만 생성한다.

1. `pageId` 동일
2. `orientation` 동일
3. `side` 동일
4. `lineCoordinate` 동일
5. `oppositeCoordinate` 동일
6. 정렬 후 이전 edge 의 `spanEnd` 와 다음 edge 의 `spanStart` 차이가 `tolerancePx` 이하

이 규칙으로 만든 adjacency graph 의 connected component 만 connected selection 이다. 단순 line cluster 는 connected selection 이 아니다.

## 9. 후속 구현 계획

### 9.1 파일별 책임

1. `src/services/templateEdgeTopologyService.ts`
   - adjacency proof 와 cohort component 계산 추가
2. `src/services/templateEdgeSelectionService.ts`
   - predicted activation result 계산 추가
3. `src/services/templateEdgeResizeIntentService.ts`
   - 실제 mutation target 집합과 operation 계산
4. `src/lib/templateEdgeSelectionDtos.ts`
   - 신규 DTO와 contract reason enum 추가
5. `src/components/template/TemplateEditWorkspace.tsx`
   - pointer gesture 흐름을 service 계약 중심으로 재배선
   - `commitEdgeSelectionState()` 같은 단일 커밋 함수 추가

### 9.2 구현 순서

1. DTO 계약을 먼저 확정한다.
2. topology service 에 adjacency proof 를 추가한다.
3. selection service 에 predicted activation result 를 추가한다.
4. resize intent service 를 새로 만든다.
5. workspace 에서 `resolveEdgeSelectionForResizeStart()` 와 `collectEdgeResizeTargets()` 를 제거하거나 thin adapter 로 축소한다.
6. drag start 는 오직 resize intent service 결과만 사용하도록 바꾼다.
7. pointerup commit 경로는 ref 와 state 를 동시에 갱신하도록 통합한다.

### 9.3 금지 구현

1. `pointermove` 에서 이전 selection 을 그대로 재사용하는 것
2. `pointerup` 에서만 isolated 토글을 생각하고 drag start 는 connected 로 여는 것
3. workspace 가 target edge 집합을 side 기준으로 재확장하는 것
4. mutation 도중 선택 membership 을 재계산해 범위를 바꾸는 것
5. `band-*` 예외 하드코딩으로 문제를 덮는 것

## 10. 체크리스트

- `CHK-PLAN-SEL-EDGE-001`
  - 목표: 1회 클릭 connected, 2회 클릭 isolated 행동을 구현 가능한 문장으로 고정한다.
  - 완료 기준: selection activation 과 drag membership 이 같은 계약으로 문서화되어 있다.
  - 증빙 방법: 본 문서 5장, 7장, 8장

- `CHK-PLAN-SEL-EDGE-002`
  - 목표: stale selection 이 drag 로 누수되는 현재 원인을 설명한다.
  - 완료 기준: pointerdown / pointermove / pointerup 시점 차이와 ref-state 분리 원인이 명시되어 있다.
  - 증빙 방법: 본 문서 4장, 6장

- `CHK-PLAN-SEL-EDGE-003`
  - 목표: 직접 연결된 엣지만 connected cohort 로 인정하는 기준을 고정한다.
  - 완료 기준: adjacency 생성 규칙과 connected component 정의가 문서화되어 있다.
  - 증빙 방법: 본 문서 5.1절, 7.2절, 8.5절

- `CHK-PLAN-SEL-EDGE-004`
  - 목표: 실제 mutation target 집합을 서비스 계약으로 고정한다.
  - 완료 기준: `targetEdgeIds` 와 mutation guard 가 문서화되어 있다.
  - 증빙 방법: 본 문서 7.2절, 7.3.3절, 8.2절, 8.4절

- `CHK-PLAN-SEL-EDGE-005`
  - 목표: 수정 허용 화이트리스트와 백업 파일명을 고정한다.
  - 완료 기준: 이번 턴 파일, 후속 구현 후보 파일, 백업 파일명이 모두 명시되어 있다.
  - 증빙 방법: 본 문서 3장

- `CHK-PLAN-SEL-EDGE-006`
  - 목표: MCP 실행 기록과 환경 제약을 남긴다.
  - 완료 기준: `chrome-devtools` 와 `supabase` 결과가 각각 기록되어 있다.
  - 증빙 방법: 본 문서 11장

## 11. MCP 테스트 및 실행 기록

### 11.1 `supabase` MCP

실행 일시: `2026-04-29`

1. `mcp__supabase__.list_migrations` 호출 성공
2. 결과: migration 목록 조회 가능
3. 이번 설계는 DB 스키마 변경이 없으므로 사용자 실행용 SQL은 없음

### 11.2 `chrome-devtools` MCP

실행 일시: `2026-04-29`

1. `mcp__chrome_devtools__.list_pages` 호출 성공
2. 확인 결과: MCP 가 붙어 있는 페이지는 `about:blank` 1개뿐이었다.
3. 로컬 대상 화면은 직접 열려 있지 않아 실페이지 attach 검증은 수행되지 못했다.
4. 추가로 로컬 dev 서버를 띄워 재검증하려 했으나 sandbox 환경에서 아래 이유로 실패했다.
   - `next dev` -> `listen EPERM: operation not permitted 0.0.0.0:3000`
   - `next dev -H 127.0.0.1 -p 3001` -> `listen EPERM: operation not permitted 127.0.0.1:3001`
5. 따라서 이번 문서의 런타임 근거는 현재 소스 코드 구조 분석과 저장된 템플릿 HTML 기준으로 작성했다.

### 11.3 후속 구현 시 필수 수동 검증 시나리오

1. `/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 접속
2. `band-10-cell-2:left` 1회 클릭
   - 같은 connected cohort 만 강조되는지 확인
3. 같은 엣지 2회 클릭
   - 강조선이 해당 엣지 하나만 남는지 확인
4. 2회 클릭 후 드래그
   - 다른 cohort 가 움직이지 않는지 확인
5. `band-3-cell-2:left` 드래그
   - `band-10-cell-2:left` 와 그 연관 엣지가 절대 움직이지 않는지 확인
6. 중간 엣지 하나의 폭을 변경한 뒤 다시 1회 클릭
   - 끊어진 chain 이 자동으로 분리되는지 확인
