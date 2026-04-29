# 템플릿 편집기 엣지 선택/조정 설계서

- 문서 ID: `EDGE-EDIT-001`
- 작성 일시: `2026-04-29`
- 대상 화면: `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
- 사용자 확정 상태: 완료
- 연계 diff 기록: `docs/diff/2026-04-29_EDGE-EDIT-001_design-log.md`

## 1. 수정 전 이해확정 절차 기록

아래 이해 내용을 사용자에게 먼저 제시했고, 사용자는 `확정`으로 응답했다.

1. 이번 턴의 산출물은 구현이 아니라 `docs/edgedit.md` 설계 문서다.
2. 설계 대상은 특정 `band-*` 예외 규칙이 아니라, 엣지의 연결성을 일반화한 선택/조정 규칙이다.
3. 엣지는 “같은 수직선 또는 수평선상에 있다”는 이유만으로 같은 조정 그룹이 되면 안 된다.
4. 같은 조정 그룹이 되려면 다음이 함께 성립해야 한다.
   - 같은 방향의 엣지다.
   - 같은 조정선 좌표를 공유한다.
   - 같은 반대 경계 좌표를 공유한다.
   - 같은 시작점/끝점 구간을 따라 연속된 선분 체인을 이룬다.
5. 첫 번째 클릭은 연결된 엣지 그룹 선택이어야 한다.
6. 같은 엣지를 두 번째 클릭하면 해당 엣지 하나만 선택하는 개별 조정 모드여야 한다.
7. 중간 항목을 수정해 연결성이 깨지면, 다음 선택부터는 자동 그룹에 포함되면 안 된다.
8. 문서에는 서비스 독립성 원칙, 화이트리스트, 체크리스트, diff 규칙, MCP 테스트 기록을 모두 포함해야 한다.

## 2. 실행 정책 (필수 준수)

이 문서와 이후 구현은 아래 정책을 누락 없이 그대로 따른다.

### 2.1 서비스 독립성 설계 원칙

1. 엣지 선택/조정 기능은 화면 내부의 임시 분기 로직이 아니라, 별도 서비스로 분리 가능한 계약 단위로 설계한다.
2. 아래 기능은 각각 독립 서비스 단위로 분리 가능해야 한다.
   - 엣지 위상 해석 기능
   - 엣지 선택 상태 전이 기능
   - 엣지 리사이즈 의도 계산 기능
3. 각 기능은 다음을 반드시 독립적으로 가진다.
   - 명확한 기능 목적
   - 입력 DTO
   - 출력 DTO
   - 소유 데이터
   - 비책임 범위
4. DOM 구조, React state, 페이지 카드 UI는 서비스 내부의 직접 의존 대상이 아니어야 한다.
5. 연동은 오직 계약된 DTO와 이벤트로만 수행한다.
6. 설계 검토 기준은 아래 하나로 통일한다.
   - “이 기능을 지금 당장 별도 서비스로 떼어내도 독립 운영 가능한가?”

### 2.2 모든 코드는 히스토리 없이도 이해 가능해야 한다

1. 후속 구현에서는 함수명, 타입명, 주석이 “왜 존재하는지”를 설명해야 한다.
2. `groupEdges`, `toggleSelection`, `applyResize` 같은 모호한 이름만으로는 부족하다.
3. 아래 수준의 의도가 이름만으로 드러나야 한다.
   - “같은 조정선과 같은 반대 경계를 공유하는 엣지 체인을 계산한다”
   - “반복 클릭 시 연결 선택을 개별 선택으로 축소한다”
   - “선택 토큰별 최소 리사이즈 용량을 계산한다”
4. 다른 LLM이 과거 대화 없이 코드를 읽어도 불필요한 예외 분기를 새로 만들지 않도록 설계해야 한다.

### 2.3 프론트 UI 변경 원칙

1. `/src/components` 전체를 건드리는 UI 확장은 금지한다.
2. 후속 구현은 새 디자인 시스템을 만들지 않고 현재 편집 화면의 시각 언어를 유지한다.
3. 시각 변경이 필요하면 다음만 최소로 허용한다.
   - 기존 엣지 강조선 스타일 확장
   - 기존 선택 상태 카드 안의 텍스트 상태 추가
4. 새 범용 UI 컴포넌트 추가는 이번 설계 범위에 포함하지 않는다.

### 2.4 확정 범위 외 수정 금지

1. 사용자가 확정한 현재 범위는 설계 문서 작성까지다.
2. 구현 파일 수정은 후속 승인이 있기 전까지 금지한다.
3. 추가 파일이 필요해지면 파일 경로를 개별적으로 제안하고 다시 승인받는다.
4. 폴더 단위 허용은 금지한다.

### 2.5 변경 기록 및 롤백 보장

1. 코드 수정이 승인되면 수정 직전 파일을 반드시 `docs/diff`에 백업한다.
2. 백업 파일명은 이 설계서에 미리 고정한다.
3. 구현 완료 후 diff 로그에 어떤 체크리스트 항목이 어떤 백업 파일과 연결되는지 기록한다.

### 2.6 체크리스트 기록 의무

1. 설계 단계와 구현 단계 모두 체크리스트 ID를 사용한다.
2. 각 체크리스트는 아래 세 가지를 가져야 한다.
   - 목표
   - 완료 기준
   - 증빙 방법
3. diff 문서에는 반드시 체크리스트 ID를 함께 적는다.

### 2.7 MCP 테스트 의무

1. 매 실행마다 `chrome-devtools` MCP로 실제 브라우저 상태를 확인한다.
2. 매 실행마다 `supabase` MCP도 호출해 실행 기록을 남긴다.
3. DB 수정이 필요하면 에이전트가 직접 DB를 바꾸지 않고, 사용자 실행용 SQL을 제공한다.
4. 테스트 결과는 문서 하단에 남긴다.

## 3. 수정 허용 화이트리스트 (필수 준수)

### 3.1 이번 턴 실제 수정 허용 파일

1. `docs/edgedit.md`
   - 목적: 엣지 선택/조정 설계 문서 본문 작성
2. `docs/diff/2026-04-29_EDGE-EDIT-001_design-log.md`
   - 목적: 설계 체크리스트와 diff 연계 기록

### 3.2 후속 구현 승인 시 최초 제안 파일

아래 파일만 1차 구현 후보로 제안한다. 이 목록 외 파일은 추가 승인 없이는 수정 금지다.

1. `src/components/template/TemplateEditWorkspace.tsx`
   - 사유: 포인터 이벤트 진입점, 선택 상태 표시, 우측 패널 표시 문자열 연결
2. `src/services/templateEdgeTopologyService.ts`
   - 사유: live DOM에서 엣지 위상 스냅샷과 연결 그룹 계산 분리
3. `src/services/templateEdgeSelectionService.ts`
   - 사유: 1회 클릭/2회 클릭/Shift 누적 선택 상태 전이 규칙 분리
4. `src/lib/templateEdgeSelectionDtos.ts`
   - 사유: 엣지 기술자, 선택 토큰, 연결 그룹 키, 리사이즈 의도 DTO 고정

### 3.3 후속 구현 승인 시 생성해야 할 백업 파일

1. `docs/diff/2026-04-29_EDGE-EDIT-101_TemplateEditWorkspace.before.tsx`
2. `docs/diff/2026-04-29_EDGE-EDIT-102_templateEdgeTopologyService.before.ts`
3. `docs/diff/2026-04-29_EDGE-EDIT-103_templateEdgeSelectionService.before.ts`
4. `docs/diff/2026-04-29_EDGE-EDIT-104_templateEdgeSelectionDtos.before.ts`

## 4. 문제 정의

### 4.1 현재 UX의 구조적 부족

현재 편집기는 다음 두 가지를 아직 구분하지 못한다.

1. 개별 박스 선택
2. 개별 엣지 또는 연결 엣지 그룹 선택

현재 구조에서는 선택 1차 단위가 여전히 박스이며, 엣지는 박스 위에 붙는 리사이즈 핸들 방향 정보만 가진다. 따라서 아래 문제가 생긴다.

1. 같은 축 위에 있다는 이유만으로 과도하게 같이 움직이는 경우가 생긴다.
2. 반대로 그룹으로 같이 움직이면 편리한 경우에도 사용자가 개별 엣지 하나만 따로 움직일 방법이 없다.
3. 한 번 수정해 연결성이 깨진 뒤에도 예전 정렬 관계가 계속 살아 있는 것처럼 취급될 위험이 있다.

### 4.2 일반화된 연결성 원칙

엣지가 같은 자동 조정 그룹이 되기 위한 기준은 “같은 선상”이 아니다. 다음 네 가지가 함께 성립해야 한다.

1. 같은 방향의 엣지다.
   - 수직 엣지는 수직 엣리끼리만 본다.
   - 수평 엣지는 수평 엣지끼리만 본다.
2. 같은 조정선 좌표를 공유한다.
   - 수직 엣지는 `x`
   - 수평 엣지는 `y`
3. 같은 반대 경계 좌표를 공유한다.
   - 수직 엣지의 폭 조정은 같은 `oppositeX`를 공유해야 한다.
   - 수평 엣지의 높이 조정은 같은 `oppositeY`를 공유해야 한다.
4. 직교 축 구간이 같은 연속 체인을 이룬다.
   - 수직 엣지는 `startY`와 `endY`
   - 수평 엣지는 `startX`와 `endX`
   - 선분이 서로 닿거나 일정 허용 오차 내에서 이어져야 같은 체인이다.

이 네 가지 중 하나라도 다르면 자동 연결 그룹이 아니다.

## 5. 현행 구현 조사 결과

### 5.1 현재 코드의 한계

현재 [TemplateEditWorkspace.tsx](/Users/gy/Documents/dev/docs/src/components/template/TemplateEditWorkspace.tsx:1451) 에서는 엣지 핸들이 다음 정보만 가진다.

1. `data-v106-resize-handle="true"`
2. `data-direction`

즉, 핸들은 방향만 알 뿐 아래 정보는 없다.

1. 자기 엣지의 고유 ID
2. 같은 그룹에 속하는 다른 엣지 목록
3. 첫 클릭인지 두 번째 클릭인지에 따른 선택 모드
4. 연결 그룹인지 개별 엣지인지에 대한 상태

또 현재 [포인터 진입 경로](/Users/gy/Documents/dev/docs/src/components/template/TemplateEditWorkspace.tsx:2080) 는 클릭 즉시 현재 박스의 `widthInstructions`를 계산한다. 이 경로는 “박스 기준 리사이즈 instruction”이지 “엣지 위상 기반 선택 상태”가 아니다.

### 5.2 현재 문제를 만드는 설계상 결핍

현재 코드에는 아래 개념이 없다.

1. `EdgeDescriptor`
2. `EdgeCohort`
3. `EdgeSelectionToken`
4. `EdgeSelectionMode`
5. `EdgeTopologySnapshot`

따라서 지금은 아래 질문에 답할 수 없다.

1. “이 엣지와 같은 그룹으로 같이 움직여야 할 엣지는 누구인가?”
2. “이번 클릭은 그룹 선택인가, 개별 선택인가?”
3. “중간 항목 하나가 깨진 뒤에도 아직 같은 그룹으로 봐야 하는가?”

### 5.3 일반화된 대표 사례

다음 두 사례는 같은 규칙으로 설명되어야 한다.

1. `band-3-cell-1 ~ band-9-cell-1`
2. `band-10-cell-1 ~ band-18-cell-1`

이 두 묶음은 같은 왼쪽 수직선 위에 있을 수 있어도, 같은 자동 그룹이 아니어야 한다. 이유는 다음과 같다.

1. 두 묶음은 같은 반대 경계 좌표를 공유하지 않는다.
2. 즉, 폭을 규정하는 반대편 수직 경계가 다르다.
3. 따라서 동일한 조정 그룹이 아니라 서로 다른 연결 엣지 체인이다.

이 규칙은 특정 `band-*` 예외가 아니라, 모든 엣지에 일반적으로 적용되어야 한다.

## 6. 핵심 개념 정의

### 6.1 EdgeDescriptor

라이브 DOM에서 추출한 하나의 엣지 기술자다.

필수 속성:

1. `edgeId`
2. `frameGroupId`
3. `orientation`
   - `vertical` | `horizontal`
4. `side`
   - `left` | `right` | `top` | `bottom`
5. `lineCoordinate`
   - 수직이면 `x`
   - 수평이면 `y`
6. `spanStart`
7. `spanEnd`
8. `oppositeCoordinate`
9. `rect`
10. `pageId`

### 6.2 Connected Edge Cohort

자동 그룹 선택의 최소 단위다.

같은 `Connected Edge Cohort`가 되려면 다음이 모두 같아야 한다.

1. `pageId`
2. `orientation`
3. `side`
4. `lineCoordinate`
5. `oppositeCoordinate`
6. 연속된 `span` 체인 소속

### 6.3 EdgeSelectionToken

사용자 선택 1건을 표현하는 상태 단위다.

필수 속성:

1. `tokenId`
2. `anchorEdgeId`
3. `mode`
   - `connected`
   - `isolated`
4. `memberEdgeIds`
5. `createdAt`
6. `selectionOrder`

### 6.4 EdgeSelectionMode

1. `connected`
   - 클릭한 엣지와 같은 연결 그룹 전체를 대상으로 조정
2. `isolated`
   - 클릭한 엣지 하나만 대상으로 조정

## 7. 연결성 판정 알고리즘

### 7.1 수직 엣지 그룹 판정

수직 엣지 두 개 `A`, `B` 가 같은 자동 그룹 후보가 되려면 다음이 필요하다.

1. `A.orientation === 'vertical'`
2. `B.orientation === 'vertical'`
3. `abs(A.lineCoordinate - B.lineCoordinate) <= tolerance`
4. `abs(A.oppositeCoordinate - B.oppositeCoordinate) <= tolerance`
5. `A.side === B.side`
6. `A.span` 과 `B.span` 이 겹치거나 맞닿아 하나의 연속 체인을 만든다.

### 7.2 수평 엣지 그룹 판정

수평 엣지도 같은 규칙을 쓴다. 차이는 기준 좌표만 바뀐다.

1. `lineCoordinate = y`
2. `oppositeCoordinate = oppositeY`
3. `span = [startX, endX]`

### 7.3 연속 체인 분리 규칙

같은 `lineCoordinate` 와 `oppositeCoordinate` 를 가진 엣지들이 많더라도, span 체인이 끊기면 다른 그룹이다.

1. 정렬 기준:
   - `spanStart` 오름차순
2. 병합 규칙:
   - 이전 `spanEnd + tolerance >= 다음 spanStart` 면 같은 체인
   - 아니면 다른 체인
3. 체인 ID:
   - `chainIndex`

### 7.4 그룹 키

자동 그룹 키는 아래처럼 계산한다.

`pageId + orientation + side + lineCoordinate + oppositeCoordinate + chainIndex`

이 키가 달라지면 같은 선상에 있어도 같은 그룹이 아니다.

### 7.5 일반화 예시

#### 예시 A

`band-10-cell-1 ~ band-18-cell-1`

1. 같은 왼쪽 수직선
2. 같은 오른쪽 반대 경계
3. span 체인이 연속
4. 따라서 첫 클릭 시 같은 `connected` 그룹

#### 예시 B

`band-3-cell-1 ~ band-9-cell-1`

1. 예시 A와 같은 왼쪽 수직선일 수 있다.
2. 그러나 오른쪽 반대 경계가 다르다.
3. 따라서 예시 A와 같은 그룹이 아니다.

#### 예시 C

중간 항목 하나의 너비를 별도로 수정한 뒤

1. 그 항목의 `oppositeCoordinate` 가 달라진다.
2. 다음 위상 계산 시 그룹 키가 달라진다.
3. 따라서 이후 자동 그룹 선택에서 기존 체인에서 분리된다.

## 8. 선택 UX 계약

### 8.1 첫 클릭

사용자가 엣지를 처음 클릭하면:

1. 현재 topology snapshot을 재계산한다.
2. 클릭한 엣지의 `Connected Edge Cohort`를 찾는다.
3. 선택 토큰을 `mode='connected'` 로 만든다.
4. 해당 그룹 전체를 강조한다.

### 8.2 두 번째 클릭

사용자가 같은 엣지를 다시 클릭하면:

1. 같은 `anchorEdgeId` 인 기존 토큰을 찾는다.
2. 기존 토큰이 `connected` 면 `isolated` 로 축소한다.
3. `memberEdgeIds` 는 클릭한 엣지 하나만 남긴다.
4. 강조선도 해당 엣지 하나만 남긴다.

### 8.3 Shift+클릭

`Shift+클릭`은 기존 박스 다중 선택과 별도 규칙을 가져야 한다.

1. `Shift+클릭`한 새 엣지는 새로운 선택 토큰으로 추가한다.
2. 기본 추가 모드는 `connected` 다.
3. 이미 선택된 같은 엣지를 다시 `Shift+클릭`하면 그 토큰만 `isolated` 로 축소한다.
4. 박스 다중 선택과 엣지 다중 선택은 동시에 활성화하지 않는다.
5. 엣지 선택이 시작되면 박스 선택 UI는 비활성화한다.

### 8.4 선택 해제

1. `Esc` 는 모든 엣지 선택 토큰을 비운다.
2. `선택 해제` 버튼도 같은 경로를 탄다.
3. 토큰이 비워지면 다음 클릭은 다시 “첫 클릭”으로 취급한다.

## 9. 기능 분해: 독립 서비스 단위

### 9.1 기능 A: Edge Topology Service

#### 1. 기능 목적

라이브 DOM에서 현재 편집 가능한 엣지 스냅샷과 연결 그룹을 계산한다.

#### 2. 단독 서비스로서의 가치

UI 없이도 현재 HTML 레이아웃만 있으면 같은 자동 그룹의 엣지를 판정할 수 있다.

#### 3. 책임 범위

1. `EdgeDescriptor` 생성
2. `Connected Edge Cohort` 계산
3. `chainIndex` 계산
4. tolerance 기반 연결성 판정

#### 4. 비책임 범위

1. 클릭 횟수 상태 관리
2. React selection state 저장
3. DOM 쓰기

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeTopologySourceDto = {
  pageId: string;
  frameNodes: TemplateFrameRectDto[];
  tolerancePx: number;
};
```

출력 DTO:

```ts
type TemplateEdgeTopologySnapshotDto = {
  edges: TemplateEdgeDescriptorDto[];
  cohorts: TemplateEdgeCohortDto[];
};
```

#### 6. 데이터 소유권

1. `edges`
2. `cohorts`
3. `chainIndex`

#### 7. 의존 서비스

1. 없음

#### 8. 분리 배포 시 필요한 최소 조건

1. 프레임 rect 목록 입력
2. tolerance 설정
3. JSON 출력 채널

### 9.2 기능 B: Edge Selection Service

#### 1. 기능 목적

첫 클릭은 그룹, 두 번째 클릭은 개별 엣지라는 선택 상태 전이를 계산한다.

#### 2. 단독 서비스로서의 가치

브라우저가 아니라 이벤트 스트림만 있어도 다음 선택 상태를 계산할 수 있다.

#### 3. 책임 범위

1. `connected` / `isolated` 모드 전이
2. `Shift+클릭` 누적 규칙
3. 선택 토큰 정렬
4. 동일 엣지 반복 클릭 처리

#### 4. 비책임 범위

1. 엣지 위상 계산
2. 리사이즈 실제 적용
3. UI 강조선 렌더링

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeSelectionClickDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
  clickedEdgeId: string;
  withShift: boolean;
};
```

출력 DTO:

```ts
type TemplateEdgeSelectionStateDto = {
  tokens: TemplateEdgeSelectionTokenDto[];
  primaryTokenId: string | null;
};
```

#### 6. 데이터 소유권

1. `tokens`
2. `primaryTokenId`
3. `selectionOrder`

#### 7. 의존 서비스

1. `Edge Topology Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. topology snapshot
2. current selection state
3. click event metadata

### 9.3 기능 C: Edge Resize Intent Service

#### 1. 기능 목적

선택 토큰 기준으로 실제 너비/높이 조정 대상을 계산한다.

#### 2. 단독 서비스로서의 가치

드래그 입력과 선택 상태만 있으면 “어떤 엣지를 얼마나 움직일지”를 브라우저 밖에서도 계산할 수 있다.

#### 3. 책임 범위

1. `connected` 모드에서 여러 엣지의 공통 delta 계산
2. `isolated` 모드에서 단일 엣지 delta 계산
3. 최소 너비/높이 clamp
4. 토큰별 resize member 목록 생성

#### 4. 비책임 범위

1. topology snapshot 생성
2. 선택 상태 토글
3. DOM 스타일 반영

#### 5. API 계약

입력 DTO:

```ts
type TemplateEdgeResizeIntentRequestDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  selectionState: TemplateEdgeSelectionStateDto;
  pointerDeltaPx: number;
  axis: 'width' | 'height';
};
```

출력 DTO:

```ts
type TemplateEdgeResizeIntentDto = {
  targetEdges: string[];
  appliedDeltaPx: number;
  blockedByMinimum: boolean;
};
```

#### 6. 데이터 소유권

1. `targetEdges`
2. `appliedDeltaPx`
3. `blockedByMinimum`

#### 7. 의존 서비스

1. `Edge Topology Service`
2. `Edge Selection Service`

#### 8. 분리 배포 시 필요한 최소 조건

1. topology snapshot
2. selection state
3. drag delta

## 10. 후속 구현 계획

### 10.1 파일별 책임

1. `src/services/templateEdgeTopologyService.ts`
   - 현재 레이아웃에서 `EdgeDescriptor`, `Cohort`, `chainIndex` 계산
2. `src/services/templateEdgeSelectionService.ts`
   - 클릭 이벤트를 `connected` / `isolated` 선택 상태로 전이
3. `src/lib/templateEdgeSelectionDtos.ts`
   - 서비스 간 계약 DTO 정의
4. `src/components/template/TemplateEditWorkspace.tsx`
   - 포인터 이벤트를 DTO로 변환하고, 서비스 결과를 UI에 반영

### 10.2 현재 파일과의 결합 제거 방향

현재 [TemplateEditWorkspace.tsx](/Users/gy/Documents/dev/docs/src/components/template/TemplateEditWorkspace.tsx:2080)는 핸들 클릭 즉시 리사이즈 상태를 만든다. 후속 구현에서는 이 흐름을 아래처럼 바꿔야 한다.

1. 핸들 hit
2. `EdgeDescriptor` 해석
3. `EdgeSelectionService.resolveClick`
4. 선택 강조선 갱신
5. 드래그 시작 시 `EdgeResizeIntentService.resolveDragStart`
6. 이동 중 `resolveDragMove`

즉, “박스 선택 후 방향별 리사이즈”가 아니라 “엣지 선택 후 선택 모드별 리사이즈”로 주체를 바꿔야 한다.

### 10.3 UI 표현 최소 변경안

1. 기존 엣지 강조선은 유지한다.
2. `connected` 모드에서는 같은 그룹의 다른 엣지도 같은 색으로 함께 강조한다.
3. `isolated` 모드에서는 클릭한 엣지만 강조한다.
4. 우측 `선택 상태` 카드에는 아래 두 값만 추가한다.
   - `선택 엣지 수`
   - `선택 모드`

## 11. 체크리스트

- `CHK-PLAN-EDGE-001`
  - 목표: 특정 사례가 아닌 일반화된 엣지 연결성 기준을 문서화한다.
  - 완료 기준: “같은 선상”이 아니라 `lineCoordinate + oppositeCoordinate + chain` 기준을 명시
  - 증빙 방법: 본 문서 4장, 6장, 7장

- `CHK-PLAN-EDGE-002`
  - 목표: 첫 클릭 그룹 선택, 두 번째 클릭 개별 선택 규칙을 문서화한다.
  - 완료 기준: 반복 클릭 상태 전이가 구체적으로 적혀 있음
  - 증빙 방법: 본 문서 8장

- `CHK-PLAN-EDGE-003`
  - 목표: 서비스 독립성 기준으로 기능을 분해한다.
  - 완료 기준: 최소 3개 기능에 대해 목적, 가치, 책임, API 계약, 데이터 소유권, 의존 서비스, 분리 배포 조건이 모두 적혀 있음
  - 증빙 방법: 본 문서 9장

- `CHK-PLAN-EDGE-004`
  - 목표: 수정 허용 화이트리스트와 백업 파일명을 고정한다.
  - 완료 기준: 이번 턴 파일과 후속 구현 후보 파일, 백업 파일명이 모두 명시됨
  - 증빙 방법: 본 문서 3장

- `CHK-PLAN-EDGE-005`
  - 목표: MCP 테스트 수행 결과와 한계를 기록한다.
  - 완료 기준: `supabase`와 `chrome-devtools` 각각의 수행 결과가 남아 있음
  - 증빙 방법: 본 문서 12장

- `CHK-IMPL-EDGE-001`
  - 목표: `EdgeDescriptor` / `Cohort` / `SelectionToken` DTO를 도입한다.
  - 완료 기준: DTO가 코드에서 import 가능한 계약으로 분리됨
  - 상태: 완료
  - 이번 턴 반영:
    - `src/lib/templateEdgeSelectionDtos.ts` 추가
    - `TemplateEdgeDescriptorDto`, `TemplateEdgeCohortDto`, `TemplateEdgeSelectionTokenDto`, `TemplateEdgeSelectionStateDto` 도입

- `CHK-IMPL-EDGE-002`
  - 목표: `lineCoordinate + oppositeCoordinate + chain` 기반 그룹 계산을 구현한다.
  - 완료 기준: 예시 A와 예시 B가 다른 cohort로 분리됨
  - 상태: 진행 중
  - 이번 턴 반영:
    - `src/services/templateEdgeTopologyService.ts` 추가
    - page/orientation/side 별로 `lineCoordinate`, `oppositeCoordinate`, `span chain` 기준 cohort 계산 구현

- `CHK-IMPL-EDGE-003`
  - 목표: 첫 클릭은 `connected`, 두 번째 클릭은 `isolated` 전이를 구현한다.
  - 완료 기준: 같은 엣지 반복 클릭 시 선택 모드가 전환됨
  - 상태: 진행 중
  - 이번 턴 반영:
    - `src/services/templateEdgeSelectionService.ts` 추가
    - 같은 anchor edge 재클릭 시 `connected <-> isolated` 토글 규칙 구현

- `CHK-IMPL-EDGE-004`
  - 목표: `Shift+클릭`으로 다중 엣지 토큰을 누적 선택한다.
  - 완료 기준: 둘 이상의 엣지 토큰이 동시에 유지되고 개별 토큰 모드가 보존됨
  - 상태: 진행 중
  - 이번 턴 반영:
    - `Shift+엣지 클릭` 시 selection token 누적 로직 추가
    - orientation/side가 다른 토큰은 같은 선택 집합으로 섞지 않도록 제한

- `CHK-IMPL-EDGE-005`
  - 목표: 중간 항목 수정 후 topology 재계산으로 그룹이 자동 재편된다.
  - 완료 기준: 연결성이 깨진 항목은 다음 선택에서 기존 그룹에 재포함되지 않음
  - 상태: 진행 중
  - 이번 턴 반영:
    - 포인터 상호작용 종료 시 live topology snapshot으로 selection state 재조정 경로 추가

- `CHK-IMPL-EDGE-006`
  - 목표: `connected` 와 `isolated` 모드가 서로 다른 리사이즈 대상을 만든다.
  - 완료 기준: 같은 엣지라도 모드에 따라 적용 대상 edge count가 달라짐
  - 상태: 진행 중
  - 이번 턴 반영:
    - `TemplateEditWorkspace.tsx` 에서 connected edge token member들만 resize target으로 수집하도록 변경
    - edge selection 활성 시 box outline 대신 edge button/edge anchor 중심 UI로 전환

## 12. 테스트 기록

### 12.1 chrome-devtools MCP

이번 턴 수행 시도는 있었으나, 아래 이유로 attach에 실패했다.

1. 실패 메시지:
   - `The browser is already running for /Users/gy/.cache/chrome-devtools-mcp/chrome-profile`
2. 의미:
   - 이 턴에서는 새로운 MCP 브라우저 세션에 연결하지 못했다.
3. 후속 구현 턴 필수 작업:
   - 브라우저 점유 문제 해소 후 같은 대상 페이지에 다시 attach
   - 실제 엣지 클릭 1회/2회 동작
   - 그룹 선택과 개별 선택의 시각 상태
   - 중간 항목 수정 후 cohort 재계산

### 12.2 supabase MCP

수행 완료.

1. `list_migrations` 호출
2. 이번 설계가 DB 변경과 무관함을 확인
3. DB 수정용 SQL은 없음

### 12.3 구현 번들 검증

수행 완료.

1. `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --outfile=/tmp/template-edit-workspace-check.mjs`
2. `npx esbuild src/services/templateEdgeTopologyService.ts --bundle --platform=node --format=esm --outfile=/tmp/template-edge-topology-service-check.mjs`
3. `npx esbuild src/services/templateEdgeSelectionService.ts --bundle --platform=node --format=esm --outfile=/tmp/template-edge-selection-service-check.mjs`
4. `npx esbuild src/lib/templateEdgeSelectionDtos.ts --bundle --platform=node --format=esm --outfile=/tmp/template-edge-selection-dtos-check.mjs`

## 13. 이번 턴 결론

1. 엣지 자동 연동의 기준은 “같은 선상”이 아니라 “같은 조정선, 같은 반대 경계, 같은 연속 체인”이다.
2. 따라서 특정 `band-*` 예외 규칙을 추가하는 방식으로는 문제를 해결할 수 없다.
3. 첫 클릭 그룹 선택, 두 번째 클릭 개별 선택은 별도 선택 서비스의 상태 전이로 다뤄야 한다.
4. 후속 구현은 박스 중심 리사이즈 경로를 유지한 채 분기를 덧붙이는 방식이 아니라, 엣지 위상 스냅샷과 선택 토큰을 중심으로 재구성해야 한다.
