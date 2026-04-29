# 템플릿 편집기 리사이즈 이슈 설계서

- 문서 ID: `RESIZE-ISSUE-001`
- 작성 일시: `2026-04-29`
- 대상 화면: `http://localhost:3001/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be`
- 사용자 확정 상태: 완료
- 연계 diff 기록: `docs/diff/2026-04-29_RESIZE-ISSUE-001_design-log.md`

## 1. 수정 전 이해확정 절차 기록

아래 이해 내용을 사용자에게 먼저 제시했고, 사용자는 `확정`으로 응답했다.

1. 이번 턴의 산출물은 코드 수정이 아니라 `docs/resizeissue.md` 설계 문서다.
2. 문서 대상 이슈는 정확히 두 가지다.
   - 이슈 1: 최소 너비/높이에 도달하지 않았는데도 더 줄일 수 없는 현상
   - 이슈 2: `status-history-1` 너비 수정 시 선택 활성 영역과 실제 출력 영역이 다르게 보이는 현상
3. 문서는 후속 구현에 바로 사용할 수 있도록 원인, 재현 절차, 기능 경계, API 계약, 체크리스트, 테스트 방식을 포함해야 한다.
4. 이번 턴은 설계 문서만 작성하고, 구현은 범위에 포함하지 않는다.

## 2. 실행 정책 (필수 준수)

이 문서와 이후 구현은 아래 정책을 누락 없이 그대로 따른다.

### 2.1 서비스 독립성 설계 원칙

1. 리사이즈 기능은 “편집 화면의 내부 편의 로직”으로 두지 않는다.
2. 아래 기능 단위는 각각 독립 서비스로 분리 가능한 형태로 설계한다.
   - 편집 대상 사각형 해석 기능
   - 리사이즈 가능 용량 계산 기능
   - 사용자 입력을 리사이즈 의도로 변환하는 기능
3. 각 기능은 다음을 반드시 독립적으로 가진다.
   - 명확한 목적
   - 입력 DTO
   - 출력 DTO
   - 소유 데이터
   - 비책임 범위
4. 기능 간 연동은 내부 DOM 세부 구현을 직접 참조하지 않고, 계약된 DTO만 사용한다.
5. 향후 `/templates/edit` 화면이 없어도 API 또는 worker 형태로 분리 배포 가능한지를 기준으로 설계한다.
6. 설계 검토 시 기준 질문은 아래 하나로 통일한다.
   - “이 기능을 지금 당장 별도 서비스로 잘라내도 독립 운영이 가능한가?”

### 2.2 모든 코드는 히스토리 없이도 이해 가능해야 한다

1. 후속 구현에서는 함수명, 타입명, 주석이 “왜 존재하는지”를 설명해야 한다.
2. `resize`, `handle`, `apply` 같은 모호한 이름만으로는 부족하다.
3. 최소한 아래 수준의 의도가 드러나야 한다.
   - “공유 테이블 셀의 실제 편집 사각형을 계산한다”
   - “colspan 셀의 축소 가능 용량을 span 전체 기준으로 계산한다”
4. 향후 다른 LLM이 코드를 읽을 때 과거 대화 없이도 분기 목적을 파악할 수 있어야 한다.

### 2.3 프론트 UI 변경 원칙

1. `/src/components` 폴더는 수정하지 않고 참고만 한다.
2. `/app` 아래 기존 페이지의 UI 패턴을 최대한 재사용한다.
3. 새 UI를 만든다면 기존 서비스와 동일한 디자이너가 설계한 것처럼 보여야 한다.
4. 이번 이슈는 기본적으로 로직 문제이므로, 후속 구현에서도 UI 구조 변경은 최소화한다.

### 2.4 확정 범위 외 수정 금지

1. 사용자가 확정한 범위는 현재 문서 작성까지다.
2. 구현 파일 수정은 후속 승인이 있기 전까지 금지한다.
3. 새로운 파일이 필요해지면 파일 경로를 개별적으로 제안하고 다시 승인받는다.
4. 폴더 단위 허용은 금지한다.

### 2.5 변경 기록 및 롤백 보장

1. 코드 수정이 승인되면 수정 직전 파일을 반드시 `docs/diff`에 백업한다.
2. 백업 파일명은 설계서에 미리 고정한다.
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
3. DB 수정이 필요한 경우에는 에이전트가 직접 DB를 바꾸지 않고, 사용자 실행용 SQL을 문서에 적는다.
4. 테스트 결과는 문서 하단에 남긴다.

## 3. 수정 허용 화이트리스트 (필수 준수)

### 3.1 이번 턴 실제 수정 허용 파일

1. `docs/resizeissue.md`
   - 목적: 리사이즈 이슈 설계 문서 본문 작성
2. `docs/diff/2026-04-29_RESIZE-ISSUE-001_design-log.md`
   - 목적: 설계 체크리스트와 diff 연계 기록

### 3.2 후속 구현 승인 시 최초 제안 파일

아래 파일만 1차 구현 후보로 제안한다. 이 목록 외 파일은 추가 승인 없이는 수정 금지다.

1. `src/components/template/TemplateEditWorkspace.tsx`
   - 사유: 편집 대상 사각형 해석, 선택 UI, 패널 입력 적용, 드래그 리사이즈 입력 경로
2. `src/services/templateFrameEditGeometryService.ts`
   - 사유: 리사이즈 스냅 규칙과 기하 연산 계약 분리
3. `src/lib/templateFrameEditDtos.ts`
   - 사유: 리사이즈 옵션, 최소 크기, 스냅 기준 DTO 고정

### 3.3 후속 구현 승인 시 생성해야 할 백업 파일

1. `docs/diff/2026-04-29_RESIZE-ISSUE-101_TemplateEditWorkspace.before.tsx`
2. `docs/diff/2026-04-29_RESIZE-ISSUE-102_templateFrameEditGeometryService.before.ts`
3. `docs/diff/2026-04-29_RESIZE-ISSUE-103_templateFrameEditDtos.before.ts`

## 4. 문제 요약

### 4.1 이슈 1

선택한 항목이 아직 최소 너비/높이에 도달하지 않았는데도, 더 이상 축소되지 않는다.

### 4.2 이슈 2

`status-history-1` 항목은 너비 수정 시 선택된 활성 영역과 실제 출력되는 레이아웃 영역이 동일한 단위로 취급되지 않는다.

## 5. 브라우저 실측 조사 결과

이 절의 내용은 `chrome-devtools` MCP로 실제 페이지에 접속해 확인한 값이다.

### 5.1 `status-history-1`의 실제 구조

1. `status-history-1`는 독립 `div` 박스가 아니다.
2. 실제 DOM 타입은 `td.v202-frame-group[data-template-frame-group="status-history-1"]` 이다.
3. 이 셀은 아래 속성을 가진다.
   - `rowspan="2"`
   - `colspan="8"`
4. 이 셀은 큰 `.v102-frame-band` 내부의 공유 `table`에 속한다.

### 5.2 같은 항목의 셀 기준 사각형과 셸 기준 사각형이 다르다

브라우저 확인 시 아래와 같은 분리가 존재했다.

1. `nodeRect`
   - 대략 `width=411`, `height=102`
2. `shellRect`
   - 대략 `width=688`, `height=656`
3. 선택 UI와 핸들은 `nodeRect` 기준으로 붙는다.
4. 그러나 실제 레이아웃 변경은 공유 `table.colgroup`과 `tr` 높이를 건드린다.

즉, 사용자는 “하나의 박스”를 수정한다고 생각하지만, 런타임은 “공유 표 내부의 하나의 셀”을 수정하고 있다.

### 5.3 `status-history-1`이 속한 행 구조

브라우저에서 같은 첫 행 셀을 읽으면 아래와 같았다.

1. `band-3-cell-1`
   - 첫 번째 셀
2. `band-3-cell-2`
   - `colspan=3`
3. `status-history-1`
   - `colspan=8`

즉, `status-history-1`의 오른쪽 경계는 단일 열 경계가 아니라, 여러 열이 합쳐진 span의 끝 경계다.

## 6. 원인 분석

## 6.1 이슈 1의 원인: span 셀을 단일 열/행처럼 축소하고 있다

현재 로직은 `colspan > 1`, `rowspan > 1` 인 셀이라도 축소 가능 용량을 span 전체가 아니라 “경계 바로 옆 1개 열/행” 기준으로 계산한다.

### 6.1.1 현재 코드 경로

1. `buildFrameResizeContext`
   - 선택 셀의 `startColIndex`, `endColIndex`, `startRowIndex`, `endRowIndex`를 계산한다.
2. `collectWidthResizeInstructions`
   - 셀의 오른쪽 또는 왼쪽 경계에 맞는 `boundaryIndex`를 찾는다.
3. `getWidthDeltaCapacity`
   - `boundaryIndex - 1` 또는 `boundaryIndex` 한 칸만 보고 축소 여유를 계산한다.
4. `applyTableBoundaryWidthDelta`
   - 실제 축소도 같은 한 칸에만 적용한다.
5. 높이도 `applyTableBoundaryHeightDelta`가 같은 방식으로 동작한다.

### 6.1.2 왜 이것이 잘못인가

예를 들어 `status-history-1`는 `colspan=8` 이다.

1. 사용자가 줄이려는 대상은 8개 열이 합쳐진 셀 전체다.
2. 그런데 현재 계산은 그 8개 열 전체가 아니라, span 끝에 붙은 마지막 1개 열만 줄인다.
3. 그 1개 열이 `12px`에 도달하면 셀 전체 너비는 아직 충분히 커도 축소가 멈춘다.
4. 결과적으로 “최소 너비까지 줄일 수 없다”는 현상이 발생한다.

### 6.1.3 브라우저 근거

브라우저 조사 시 `status-history-1`의 오른쪽 경계는 내부 경계 `boundaryIndex=12`에 걸려 있었고, 이 경계 오른쪽 또는 왼쪽 단일 열 중 하나가 이미 `12px`였다.

즉, 셀 전체가 최소 너비에 도달한 것이 아니라, “현재 알고리즘이 참조하는 마지막 한 칸”이 최소값에 도달했기 때문에 멈춘 것이다.

## 6.2 이슈 2의 원인: 편집 대상 사각형과 레이아웃 소유 단위가 다르다

`status-history-1`는 선택 UI 관점에서는 독립 박스처럼 보이지만, 실제 레이아웃 소유권은 공유 표가 가진다.

### 6.2.1 현재 구조의 충돌

1. 선택 상태
   - `td` 셀을 기준으로 활성화된다.
2. 표시되는 핸들
   - `td` 셀 사각형 기준으로 배치된다.
3. 레이아웃 계산
   - `table.colgroup`, `tr` 높이, `shell` 크기까지 같이 엮인다.
4. 스냅 계산
   - `readFrameNodeRect`, `shellRect`, `cellRect`, sibling rect가 혼합 사용된다.

### 6.2.2 결과

1. 사용자는 셀 하나를 수정한다고 느낀다.
2. 런타임은 공유 밴드 내부 열 구조를 재배분한다.
3. 따라서 어떤 시점에는 선택 박스가 가리키는 영역과, 실제로 레이아웃을 소유하는 단위가 다르게 인식된다.
4. `status-history-1`처럼 shared table cell인 경우 이 충돌이 특히 크게 드러난다.

### 6.2.3 핵심 결론

후속 구현은 “편집 대상의 단일 진실(source of truth) 사각형”을 분리해야 한다.

1. 단일 셀 밴드라면 `shellRect`가 진실이다.
2. 공유 표 내부 셀이라면 `cellRect`가 진실이다.
3. 선택 UI, 핸들, 패널 입력, 스냅, 용량 계산, DOM 쓰기 모두 같은 진실 사각형을 기준으로 돌아야 한다.

## 7. 해결 설계

## 7.1 해결 목표

1. `colspan`, `rowspan` 셀도 실제 span 전체 기준으로 최소 너비/높이까지 줄일 수 있어야 한다.
2. 선택 UI와 실제 출력 영역은 같은 소유 단위를 기준으로 움직여야 한다.
3. 패널 입력 방식과 드래그 리사이즈 방식은 동일한 계산 서비스 경로를 사용해야 한다.

## 7.2 기능 분해: 독립 서비스 단위

### 7.2.1 기능 A: Editable Rect Resolution Service

#### 1. 기능 목적

선택된 프레임이 독립 밴드인지, 공유 표 내부 셀인지 판별하고 편집 대상의 단일 진실 사각형을 계산한다.

#### 2. 단독 서비스로서의 가치

UI 없이도 HTML 조각과 선택 ID만 있으면 “실제 편집 대상 rect”를 계산할 수 있다.

#### 3. 책임 범위

1. `shellRect`와 `cellRect` 중 어떤 것이 편집 기준인지 결정
2. `start/end row/col index` 계산
3. span 범위 계산
4. 편집 대상 사각형 DTO 반환

#### 4. 비책임 범위

1. 드래그 이벤트 처리
2. 스냅 정책 결정
3. DOM 쓰기

#### 5. API 계약

입력 DTO:

```ts
type EditableRectRequest = {
  frameGroupId: string;
  root: HTMLElement;
};
```

출력 DTO:

```ts
type EditableRectResult = {
  layoutKind: 'single-band' | 'shared-table-cell';
  shellRect: FrameNodeRect;
  editableRect: FrameNodeRect;
  startColIndex: number;
  endColIndex: number;
  startRowIndex: number;
  endRowIndex: number;
};
```

#### 6. 데이터 소유권

1. 선택 대상의 구조 해석 결과
2. span 인덱스 정보

#### 7. 의존 서비스

없음. DOM 읽기 유틸만 사용 가능.

#### 8. 분리 배포 시 최소 조건

1. HTML fragment 또는 DOM snapshot 입력
2. rect 계산 가능 런타임

### 7.2.2 기능 B: Shared Grid Resize Capacity Service

#### 1. 기능 목적

공유 표 내부 셀의 축소 가능 용량과 실제 적용 범위를 span 전체 기준으로 계산한다.

#### 2. 단독 서비스로서의 가치

UI가 없어도 “이 셀을 40px 줄일 수 있는가”와 “어느 열/행을 얼마나 줄일 것인가”를 독립 계산할 수 있다.

#### 3. 책임 범위

1. `colspan`, `rowspan` 셀의 전체 span 축소 용량 계산
2. 좌/우/상/하 어느 방향에서 줄이는지에 따라 축소 분배 순서 결정
3. 최소값 도달 시 정확히 중단

#### 4. 비책임 범위

1. 포인터 이벤트
2. 선택 UI
3. 패널 상태 관리

#### 5. API 계약

입력 DTO:

```ts
type SharedGridResizeCapacityRequest = {
  axis: 'x' | 'y';
  direction: 'start' | 'end';
  sizes: number[];
  spanStart: number;
  spanEnd: number;
  minSize: number;
  requestedDelta: number;
};
```

출력 DTO:

```ts
type SharedGridResizeCapacityResult = {
  appliedDelta: number;
  nextSizes: number[];
  consumedIndices: number[];
  stopReason: 'requested_applied' | 'min_size_reached';
};
```

#### 6. 데이터 소유권

1. row/col 크기 배열
2. span 기준 축소 결과

#### 7. 의존 서비스

1. Editable Rect Resolution Service의 span 정보

#### 8. 분리 배포 시 최소 조건

1. 현재 열/행 배열 입력
2. 최소값 설정 입력

### 7.2.3 기능 C: Resize Interaction Service

#### 1. 기능 목적

패널 입력과 드래그 입력을 하나의 리사이즈 의도 DTO로 정규화하여 동일한 계산 경로에 태운다.

#### 2. 단독 서비스로서의 가치

화면 구현이 바뀌어도 입력 장치만 바꾸면 같은 리사이즈 동작을 재사용할 수 있다.

#### 3. 책임 범위

1. `pointer delta` 또는 `target width/height`를 공통 `ResizeIntent`로 변환
2. Editable Rect Resolution Service 호출
3. Shared Grid Resize Capacity Service 호출
4. 계산 결과를 DOM 쓰기 DTO로 변환

#### 4. 비책임 범위

1. 실제 React state 저장
2. 저장 API 호출

#### 5. API 계약

입력 DTO:

```ts
type ResizeIntent = {
  frameGroupId: string;
  source: 'pointer' | 'panel';
  axis: 'x' | 'y';
  edge: 'start' | 'end';
  requestedDelta: number;
};
```

출력 DTO:

```ts
type ResizeApplicationPlan = {
  editableRect: FrameNodeRect;
  shellRect: FrameNodeRect;
  nextColWidths?: number[];
  nextRowHeights?: number[];
  appliedDelta: number;
};
```

#### 6. 데이터 소유권

1. 리사이즈 의도
2. 계산된 적용 계획

#### 7. 의존 서비스

1. Editable Rect Resolution Service
2. Shared Grid Resize Capacity Service
3. Geometry Service

#### 8. 분리 배포 시 최소 조건

1. HTML/DOM 입력
2. intent DTO 입력

## 8. 구현 방향

### 8.1 `TemplateEditWorkspace.tsx`에서 반드시 제거해야 할 결합

1. 선택 UI 기준 rect와 resize 계산 rect가 섞여 있는 상태
2. 패널 입력과 드래그 입력이 서로 다른 중간 해석 단계를 가지는 상태
3. span 셀인데도 경계 바로 옆 1개 열/행만 줄이는 상태

### 8.2 후속 구현 시 반드시 추가해야 할 로직

1. `EditableRectResult`를 명시적으로 생성하는 별도 함수/서비스
2. `colspan`, `rowspan` 셀 전용 span shrink capacity 계산 함수
3. 패널 입력과 드래그 입력을 공통 `ResizeIntent`로 변환하는 함수
4. 선택 UI가 항상 `editableRect`를 기준으로만 그려지도록 강제하는 규칙
5. shared table cell의 경우 `shell`을 선택 영역으로 사용하지 않는 규칙

### 8.3 스냅 정책 보정

현재 `snapResizedRect`는 sibling rect 후보를 사용한다. 후속 구현에서는 아래를 추가 검토한다.

1. 현재 잡고 있는 경계와 이미 동일선상인 sibling edge는 스냅 후보에서 제외
2. shared table 내부 cell 리사이즈는 outer shell이 아니라 `editableRect` 기준 sibling만 후보로 사용
3. 스냅은 용량 계산 이후가 아니라, 용량 계산을 방해하지 않는 범위에서만 적용

## 9. 재현 절차

### 9.1 이슈 1 재현

1. `/templates/edit?templateId=9ed2caf1-edc4-4d62-bfe0-95ff40c5a7be` 접속
2. `status-history-1` 선택
3. 너비 또는 높이 입력값을 연속해서 감소
4. 아직 셀 전체 span이 넓은데도 축소가 멈추는지 확인

### 9.2 이슈 2 재현

1. 같은 페이지 접속
2. `status-history-1` 선택
3. 너비를 변경
4. 선택 핸들/활성 영역이 어떤 rect를 기준으로 그려지는지와, 실제 레이아웃 소유 단위가 무엇인지 비교
5. shared table cell이라면 shell과 cell이 다른 크기인지 확인

## 10. 체크리스트

### 10.1 설계 체크리스트

- `CHK-PLAN-001`
  - 목표: 이슈 1, 2의 브라우저 재현 근거를 문서화
  - 완료 기준: DOM 구조, rect 차이, 경계 정보가 문서에 기록됨
  - 상태: 완료

- `CHK-PLAN-002`
  - 목표: 서비스 독립성 기준의 기능 분해
  - 완료 기준: 각 기능별 목적, API, 책임, 데이터 소유권 기록
  - 상태: 완료

- `CHK-PLAN-003`
  - 목표: 화이트리스트와 롤백 규칙 명시
  - 완료 기준: 허용 파일과 백업 파일명이 문서에 고정됨
  - 상태: 완료

- `CHK-PLAN-004`
  - 목표: MCP 테스트 규칙 기록
  - 완료 기준: chrome-devtools, supabase 수행 결과와 후속 규칙이 명시됨
  - 상태: 완료

### 10.2 후속 구현 체크리스트

- `CHK-IMPL-001`
  - 목표: editable rect 단일 진실화
  - 완료 기준: single-band / shared-table-cell 모두 하나의 기준 rect만 사용
  - 상태: 미시작

- `CHK-IMPL-002`
  - 목표: colspan 셀 span 전체 기준 폭 축소
  - 완료 기준: 마지막 1개 열이 아니라 span 전체로 용량 계산
  - 상태: 진행 중
  - 이번 턴 반영:
    - `TemplateEditWorkspace.tsx`에서 내부 경계와 outer shell 경계 모두 `shrinkRange`를 받아 span 전체 용량으로 축소 계산
    - `band-10-cell-2`, `status-history-1` 같은 outer-edge / inner-edge 케이스를 모두 같은 span 계산 경로로 정리

- `CHK-IMPL-003`
  - 목표: rowspan 셀 span 전체 기준 높이 축소
  - 완료 기준: 마지막 1개 행이 아니라 span 전체로 용량 계산
  - 상태: 진행 중
  - 이번 턴 반영:
    - `applyOuterTopHeightDelta`, `applyOuterBottomHeightDelta`, `applyTableBoundaryHeightDelta`가 모두 span 전체 row 범위를 축소 대상으로 사용

- `CHK-IMPL-004`
  - 목표: 패널 입력과 드래그 입력 경로 통합
  - 완료 기준: 공통 `ResizeIntent` 경유
  - 상태: 미시작

- `CHK-IMPL-005`
  - 목표: 스냅이 축소 가능 용량 계산을 방해하지 않도록 보정
  - 완료 기준: 동일 경계 재스냅, shared-cell outer shell 스냅 오염 제거
  - 상태: 진행 중
  - 이번 턴 반영:
    - 현재 선택 경계와 겹치는 outer shell 경계를 잘못 instruction에 포함하지 않도록 내부 경계 우선 규칙 유지
    - width 0 적용에서도 2px/10px 보조 열이 12px로 커지지 않도록 baseline minimum 규칙으로 보정

- `CHK-IMPL-006`
  - 목표: `status-history-1` 기준 회귀 테스트
  - 완료 기준: 최소 높이/너비 근처까지 정상 축소되고 선택 활성 영역이 editable rect와 일치
  - 상태: 진행 중
  - 이번 턴 반영:
    - 브라우저에서 `status-history-1` 너비 `411 -> 300`, 높이 `102 -> 24`를 확인
    - 동일 테스트에서 shell 전체 폭이 불필요하게 바뀌지 않고, 선택 패널 입력값과 실제 셀 rect가 일치함을 확인

## 11. 테스트 기록

### 11.1 chrome-devtools MCP

수행 완료.

1. 실제 페이지 접속 확인
2. `status-history-1` DOM 구조 확인
3. `rowspan=2`, `colspan=8` 확인
4. `nodeRect`와 `shellRect` 차이 확인
5. 패널 입력으로 shared table cell 폭/높이 변경 시 shared colgroup/row 구조가 바뀌는 점 확인
6. 구현 후 `status-history-1`에 대해 아래를 재확인
   - 초기값: `width=411`, `height=102`
   - 패널 적용 후: `width=300`, `height=24`
   - 결과: 실제 `td` rect와 우측 패널 값이 동일하게 유지됨
7. 구현 후 `band-10-cell-2`의 outer-right 케이스에 대해 런타임 계산값 재확인
   - `startColIndex=2`, `endColIndex=13`
   - shell outer-right 경계를 쓰는 셀임을 확인
   - span 전체 shrink capacity가 `403px`로 계산되는 것을 확인
   - 이 값은 기존 “마지막 2px 열만 보고 0px”이던 경로가 제거되었음을 의미

### 11.2 supabase MCP

수행 완료.

1. `list_migrations` 호출
2. 이번 이슈가 DB 변경과 무관함을 확인
3. DB 수정용 SQL은 없음

## 12. 이번 턴 결론

1. 이슈 1의 본질은 “span 셀을 단일 열/행처럼 취급하는 용량 계산”이다.
2. 이슈 2의 본질은 “선택 UI가 가리키는 편집 단위와 실제 레이아웃 소유 단위가 다르다”는 점이다.
3. 후속 구현은 단순 조건문 추가가 아니라, editable rect 해석과 shared grid resize capacity 계산을 분리하는 방향으로 진행해야 한다.
