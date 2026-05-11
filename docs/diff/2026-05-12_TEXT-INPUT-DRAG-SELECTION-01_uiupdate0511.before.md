# 0511 UI Update 설계: 탭별 편집 권한, 텍스트 맞춤 확장, 위치 탭 액션 버튼

작성일: 2026-05-11  
대상 화면: `http://localhost:3001/templates/edit`  
대표 검증 템플릿: `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`  
대상 라우트: `src/app/templates/edit/page.tsx` -> `src/components/template/TemplateEditWorkspace.tsx`

## 1. 요청 이해 확정안

이 문서는 구현 전 의도 일치를 위한 설계 문서다. 후속 구현자는 코드 수정 전에 아래 이해 내용이 사용자 의도와 일치하는지 사용자에게 명시적으로 확인받는다. 확인 전에는 코드 수정, 리팩터링, 파일 삭제, 포맷팅, 테스트용 임시 코드 추가를 시작하지 않는다.

1. `텍스트` 탭과 `속성` 탭에서는 캔버스 위 상자를 마우스로 드래그해서 이동할 수 없어야 한다.
2. `텍스트` 탭과 `속성` 탭에서는 캔버스 위 상자의 리사이즈 핸들을 마우스로 드래그해서 크기를 변경할 수 없어야 한다.
3. 위 제한은 마우스 드래그 조작에 대한 제한이다. 상자 선택, 텍스트 탭의 직접 텍스트 입력, 속성 탭의 메타데이터 지정은 유지한다.
4. 위치와 크기를 마우스로 직접 조정하는 기능은 `크기 및 위치` 탭 전용 기능으로 둔다.
5. `텍스트` 탭에서는 선택한 상자에 대해 상자 내부 텍스트와 여백에 맞춰 상자의 `높이` 또는 `너비` 중 하나를 자동 확장하는 설정을 제공한다.
6. 텍스트 맞춤 확장은 줄임이나 무관한 주변 상자의 크기 축소를 하지 않는다. 선택된 대상의 한 축은 커질 수 있으며, 같은 기준선을 공유하는 직접 peer 항목은 템플릿 틀 보존을 위해 같은 축으로 함께 커지거나 기본/최소 크기까지 함께 줄어들 수 있다. 이 기준은 높이와 너비 모두에 적용한다.
7. 선택 상자의 확장으로 peer edge, relative anchor, 위치 관계를 보존해야 하는 경우 다른 상자의 위치는 이동할 수 있다. 즉, 직접 같은 edge를 공유하지 않는 주변 상자의 크기 변경은 금지하지만, 위치 재배치와 직접 peer의 같은 축 크기 변경은 허용한다.
8. 텍스트 맞춤 확장에 영향을 받는 상자가 없다면 선택된 하나의 상자만 변경한다.
9. 예시 기준: `status-history-1`의 높이가 달라질 때, 같은 bottom 기준선을 공유하는 직접 peer 상자는 같은 변화량만큼 높이가 바뀔 수 있다. 그러나 `status-history-1` 아래에 이어지는 `band-5-cell-1`, `band-5-cell-2`, `band-5-cell-3`, `band-5-cell-4`, `band-5-cell-5`, `band-5-cell-6`의 높이를 줄이면 안 된다. 해당 상자들은 템플릿 틀 보존을 위해 같은 변화량만큼 `top` 위치만 이동할 수 있다.
10. `크기 및 위치` 탭의 캔버스 액션 버튼은 선택 상태에 따라 출력 여부가 달라져야 한다. 비활성 버튼을 계속 보여주는 것이 아니라 조건에 맞는 버튼만 출력한다.
11. `그룹 만들기`: 복수의 상자 또는 그룹이 선택된 경우 출력한다.
12. `그룹 해제`: 단일 또는 복수의 그룹이 선택에 포함된 경우 출력한다. 선택에 상자가 함께 있어도 그룹만 해제한다.
13. `그룹에서 제외`: 단일 또는 복수의 그룹이 선택된 경우 출력한다. 클릭하면 각 그룹에서 제외할 상자 또는 하위 그룹을 선택하는 모드로 들어간다. 이 모드에서 선택된 상자나 그룹은 상위 그룹에서 해제된다.
14. `그룹에서 제외` 모드는 `Esc`, `x`, `q`, 또는 화면의 `x` 버튼으로 종료할 수 있어야 한다. 종료해도 모드 진입 전 선택 상태는 유지한다.
15. `그룹에 포함`: 단일 또는 복수의 상자나 그룹이 선택된 경우 출력한다. 상자와 그룹이 섞여 선택되어도 허용한다. 클릭하면 포함시킬 대상 그룹을 선택하는 모드로 들어간다.
16. `그룹에 포함` 모드는 `Esc`, `x`, `q`, 또는 화면의 `x` 버튼으로 종료할 수 있어야 한다. 종료해도 모드 진입 전 선택 상태는 유지한다.
17. `상자 생성`: 어떤 상자나 그룹도 선택되지 않은 상태에서만 출력한다.
18. `간격 설정`: 선택이 없는 상태와 선택이 있는 모든 상태에서 항상 출력한다.

확정 문구 예시:

```text
위 이해 내용과 화이트리스트 범위대로 구현해도 됩니다.
```

## 2. 현재 코드 구조 확인

현재 확인한 구현 위치와 후속 구현자가 집중해야 할 지점은 아래와 같다.

- `src/app/templates/edit/page.tsx`는 `TemplateEditWorkspace`를 렌더링하는 얇은 라우트다. 이번 변경의 주 대상은 아니다.
- 실제 캔버스, 선택 상태, 탭별 컨트롤, 드래그/리사이즈 처리는 `src/components/template/TemplateEditWorkspace.tsx`에 집중되어 있다.
- 포인터 입력의 핵심은 `handlePreviewPointerDown`이다. 이 함수는 현재 탭, resize handle, edge button, frame node를 기준으로 선택, 이동, 마퀴, 리사이즈를 시작한다.
- 현재 이동 시작은 `startFrameDragInteraction`과 하단의 `dragStateRef.current = ...` 경로에서 일어난다.
- 현재 크기 변경 시작은 resize handle 또는 edge button을 통해 `resizeStateRef.current` 또는 `edgePressStateRef.current`에 상태를 쓰는 경로에서 일어난다.
- 텍스트 탭의 직접 입력 우선 로직은 `handlePreviewClick`에서 `focusFrameTextInputForEditingByFrameGroupId`를 호출하는 방식으로 유지되어야 한다.
- 현재 텍스트 맞춤은 `requestPreviewTextFit()` -> `applyTemplateExtractEditableTextFit(root)` 경로를 사용한다.
- `src/lib/templateExtractEditableTextFit.ts`의 현재 기능은 `[data-template-fit-target-width]`를 가진 요소의 내부 텍스트를 `transform: scale(...)`로 축소/확대하는 방식이다. 이번 요청의 "상자 크기 확장"과는 성격이 다르므로 기존 함수를 그대로 확장 책임으로 오염시키면 안 된다.
- `applySelectionStylePatch`는 `width` 또는 `height` patch가 있으면 `applyRelativeAnchoredFrameRectsInRoot(root)`를 호출한다. 텍스트 탭 자동 확장은 이 경로를 그대로 쓰면 주변 relative/edge 관계가 재계산되어 다른 상자가 줄어들 수 있으므로 별도 경로가 필요하다. 다만 선택 상자 확장으로 peer edge와 위치 관계를 보존해야 하는 경우, 별도 경로 안에서 주변 상자의 크기 축소 없이 위치만 재배치하는 것은 허용한다.
- 현재 위치 탭 액션 버튼은 `selectionPanelTab === 'position' && !positionOrderLockSelectionMode`일 때 `상자 생성`, `그룹 만들기`, `간격 설정`, `그룹 해제`, `선택 상자 그룹에서 제외`, `선택 항목 그룹에 포함`을 한꺼번에 렌더링하고 `disabled`로 상태를 표현한다. 이번 요구는 조건부 출력으로 바꾸는 것이다.
- 현재 선택 상태 파생값으로 `selectedPositionEntitySelection`, `selectedPositionResolvedBoxGroup`, `selectedExplicitPositionCurrentBoxGroups`, `selectedPositionGroupingFrameGroupIds`, `explicitPositionBoxGroups`, `positionOrderLockSelectionMode` 등이 존재한다. 버튼 출력 조건은 이 파생값을 기준으로 다시 정리한다.

## 3. 수정 허용 화이트리스트

아래 파일만 수정할 수 있다. 목록 외 파일 수정이 필요하면 즉시 중단하고 사용자 승인을 받은 뒤에만 추가한다. 폴더 단위 승인은 금지한다.

| 파일 | 상태 | 허용 목적 | 금지 사항 |
| --- | --- | --- | --- |
| `src/components/template/TemplateEditWorkspace.tsx` | 기존 파일 | 탭별 포인터 권한, 텍스트 탭 자동 확장 UI, 위치 탭 액션 버튼 조건부 출력, 그룹 포함/제외 모드 UI 연결 | 추출 로직, API 계약, DB 저장 포맷, 무관한 리팩터링 |
| `src/lib/templateTextBoxAutoSize.ts` | 신규 제안 | 텍스트 내용과 여백 기반으로 단일 상자의 필요 `width` 또는 `height`를 계산하는 순수 함수 | DOM 상태를 직접 저장, React state 직접 접근, 그룹/간격 설정 변경 |
| `src/lib/templateTextBoxAutoSizeDtos.ts` | 신규 제안 | 텍스트 자동 확장 요청/결과 DTO 정의가 `TemplateEditWorkspace.tsx` 내부에 두기 어려울 때만 사용 | DB DTO와 혼합, 기존 저장 DTO 변경 |
| `docs/uiupdate0511.md` | 신규 문서 | 본 설계, 체크리스트, 테스트 기록 갱신 | 구현 범위를 벗어난 요구 추가 |
| `docs/diff/2026-05-11_UIUPDATE-TAB-DRAG-LOCK-01_TemplateEditWorkspace.before.tsx` | 신규 백업 | 탭별 이동/리사이즈 제한 구현 전 원본 백업 | 백업 외 코드 대체 문서로 사용 금지 |
| `docs/diff/2026-05-11_UIUPDATE-TEXT-AUTOSIZE-01_TemplateEditWorkspace.before.tsx` | 신규 백업 | 텍스트 자동 확장 구현 전 원본 백업 | 백업 외 코드 대체 문서로 사용 금지 |
| `docs/diff/2026-05-11_UIUPDATE-POSITION-ACTIONS-01_TemplateEditWorkspace.before.tsx` | 신규 백업 | 위치 탭 액션 버튼 구현 전 원본 백업 | 백업 외 코드 대체 문서로 사용 금지 |
| `docs/diff/2026-05-11_UIUPDATE-*_uiupdate0511.before.md` | 신규 백업 | 구현 기록을 위해 이 문서를 수정하기 직전 상태 백업 | 체크리스트와 무관한 문서 변경 |

읽기 전용 참고 파일:

- `src/app/templates/edit/page.tsx`
- `src/lib/templateExtractEditableTextFit.ts`
- `docs/0511ui.md`

## 4. 실행 정책

### 4.1 수정 전 이해확정 절차

- 구현자는 이 문서의 `1. 요청 이해 확정안`을 사용자에게 먼저 제시한다.
- 사용자가 명시적으로 확정하기 전에는 코드 수정, 파일 삭제, 리네임, 포맷팅, 테스트용 임시 코드 추가를 하지 않는다.
- 확정 후에도 범위가 달라지는 문제가 발견되면 즉시 중단하고 사용자에게 변경 범위 추가 승인을 받는다.

### 4.2 변경 기록 및 롤백 보장

- 코드 수정 전 반드시 `docs/diff`에 수정 직전 상태를 기록한다.
- 기존 파일은 전체 파일 백업을 원칙으로 한다.
- 신규 파일은 `파일 없음 -> 신규 생성` 상태를 diff 문서에 명시한다.
- 각 diff 문서에는 이 설계의 체크리스트 ID를 반드시 적는다.
- 백업 누락이 발견되면 구현을 중단하고 누락된 백업을 먼저 복구한다.

### 4.3 확정 범위 외 수정 금지

- DB, Supabase schema, API route, 템플릿 추출 파이프라인은 변경하지 않는다.
- `src/components` 하위 공용 UI 컴포넌트는 수정하지 않는다.
- 텍스트 자동 확장은 선택 상자 크기 확장과 필요한 위치 관계 보존만 다룬다. 위치 탭 edge resize처럼 반대편 상자의 크기를 줄여 공간을 만드는 방식은 금지한다. 다만 선택 edge와 같은 방향/같은 side를 공유하는 직접 peer 항목은 템플릿 틀 보존을 위해 같은 축으로 함께 크기가 변할 수 있고, 그 밖의 주변 상자는 크기를 유지한 채 위치만 이동할 수 있다. 이 원칙은 높이와 너비 모두에 적용한다.
- 위치 탭 액션 버튼 변경은 출력 조건과 모드 진입/종료 UX에 한정한다. 기존 그룹 데이터 모델을 무단 변경하지 않는다.

### 4.4 MCP 테스트 의무

- 구현 실행마다 `chrome-devtools` MCP로 `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`를 직접 확인한다.
- 구현 실행마다 `supabase` MCP 노출 여부를 확인한다. 이번 변경은 DB 수정이 없어야 한다.
- DB 수정이 필요한 상황이 발견되면 직접 DB를 수정하지 않는다. 필요한 SQL을 문서에 제공하고 사용자가 직접 실행하게 한다.
- MCP 도구가 세션에 노출되지 않거나 연결 실패하면 실패 사유와 대체 확인 방법을 이 문서 하단 테스트 기록에 남긴다.

## 5. 서비스 독립성 설계

### 5.1 기능 A: 탭별 캔버스 조작 권한 서비스

#### 기능 목적

선택 탭에 따라 캔버스에서 허용되는 포인터 조작을 제한한다. `크기 및 위치` 탭만 이동과 리사이즈를 허용하고, `속성`/`텍스트` 탭은 선택과 입력만 허용한다.

#### 단독 서비스로서의 가치

향후 캔버스 조작 권한을 API 또는 별도 편집 엔진으로 분리할 수 있다. 탭 이름, 조작 종류, 입력 이벤트를 받아 `allow`/`deny` 결과를 반환하면 다른 UI에서도 같은 정책을 사용할 수 있다.

#### 책임 범위

- 현재 탭에서 `select`, `marqueeSelect`, `textEdit`, `move`, `resizeHandle`, `edgeResize` 허용 여부 결정.
- 이벤트 시작 전 차단 사유 반환.
- UI에서 핸들을 숨길지, 보이지만 동작을 막을지에 대한 표시 정책 제공.

#### 비책임 범위

- 실제 DOM 이동/리사이즈 수행.
- 선택 상태 저장.
- 텍스트 입력값 저장.
- 그룹/간격 설정 변경.

#### API 계약

```ts
export type TemplateCanvasTab = 'position' | 'metadata' | 'text';
export type TemplateCanvasInteractionKind =
  | 'select'
  | 'marquee-select'
  | 'text-edit'
  | 'move'
  | 'resize-handle'
  | 'edge-resize';

export type TemplateCanvasInteractionPolicyRequestDto = {
  tab: TemplateCanvasTab;
  interaction: TemplateCanvasInteractionKind;
};

export type TemplateCanvasInteractionPolicyResultDto = {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'position-tab-only'
    | 'text-edit-only'
    | 'metadata-edit-only';
};
```

#### 데이터 소유권

이 기능은 데이터를 소유하지 않는다. 탭 상태와 포인터 이벤트를 입력으로 받고 결과만 반환한다.

#### 의존 서비스

- `TemplateEditWorkspace` 포인터 이벤트 어댑터.
- 선택 UI 적용 함수.

#### 분리 배포 시 최소 조건

- 탭 enum과 interaction enum을 DTO로 고정한다.
- DOM API에 의존하지 않는 순수 함수로 유지한다.

### 5.2 기능 B: 텍스트 상자 자동 크기 및 peer edge 보존 서비스

#### 기능 목적

텍스트 탭에서 지정 상자의 텍스트 내용과 여백에 맞춰 `height` 또는 `width` 중 하나를 자동으로 늘린다. 선택 상자의 edge가 같은 기준선을 공유하는 직접 peer를 만들고 있으면, 템플릿 틀이 벌어지지 않도록 직접 peer도 같은 축으로 함께 보정한다.

#### 단독 서비스로서의 가치

템플릿 편집 화면 밖에서도 텍스트 컨텐츠 기반 박스 크기 계산 서비스로 재사용할 수 있다. 서버 렌더, 배치 템플릿 보정, 외부 API 상품화가 가능하다.

#### 책임 범위

- 선택 상자 ID, 축(`height` 또는 `width`), 텍스트 내용, 글꼴/줄높이/여백/현재 크기를 입력받는다.
- 필요한 목표 크기를 계산한다.
- 목표 크기는 자동 크기 설정 당시 기본 크기보다 작아질 수 없다.
- 선택 edge와 같은 방향/같은 side를 공유하는 직접 peer 항목은 같은 축으로 같은 변화량만큼 커질 수 있으며, 기본/최소 크기 한도 안에서 다시 줄어들 수 있다.
- 직접 peer가 아닌 주변 상자의 크기 축소는 수행하지 않는다.
- 선택 상자 확장으로 peer edge, relative anchor, 위치 관계 보존이 필요한 경우 주변 상자의 위치 이동 계획을 반환할 수 있다.
- `status-history-1` 같은 단일 상자에 적용할 때 같은 bottom 기준선의 직접 peer는 함께 높이가 바뀔 수 있으나, 아래 행인 `band-5-cell-*` 높이를 줄이지 않는 결과를 반환한다. 단, 관계 보존을 위한 주변 상자 위치 이동은 반환할 수 있다.

#### 비책임 범위

- 위치 탭 edge resize.
- 직접 peer가 아닌 다른 상자 축소.
- 직접 peer가 아닌 다른 상자의 크기 축소를 동반하는 relative anchor 재배치.
- DB 저장.
- 텍스트 OCR 또는 추출.

#### API 계약

```ts
export type TemplateTextAutoSizeAxis = 'height' | 'width';

export type TemplateTextAutoSizeRequestDto = {
  frameGroupId: string;
  axis: TemplateTextAutoSizeAxis;
  text: string;
  currentRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  style: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
    whiteSpace: string;
  };
};

export type TemplateTextAutoSizeResultDto = {
  frameGroupId: string;
  axis: TemplateTextAutoSizeAxis;
  previousSize: number;
  nextSize: number;
  changed: boolean;
  affectedFrameMoves: Array<{
    frameGroupId: string;
    previousLeft: number;
    previousTop: number;
    nextLeft: number;
    nextTop: number;
  }>;
  affectedPeerSizeChanges: Array<{
    frameGroupId: string;
    previousWidth: number;
    previousHeight: number;
    nextWidth: number;
    nextHeight: number;
  }>;
  guardedUnchangedFrameSizes: Array<{
    frameGroupId: string;
    width: number;
    height: number;
  }>;
};
```

#### 데이터 소유권

- 서비스는 선택 상자의 확장 계산 결과와 주변 상자의 위치 보정 계획만 소유한다.
- DOM 반영과 draft HTML 저장은 `TemplateEditWorkspace`가 소유한다.
- DB 데이터는 소유하지 않는다.

#### 의존 서비스

- 텍스트 측정 adapter. 브라우저 구현은 hidden measurement element 또는 `scrollHeight`/`scrollWidth`를 사용할 수 있다.
- `TemplateEditWorkspace`의 DOM patch adapter.

#### 분리 배포 시 최소 조건

- DOM 측정 adapter와 순수 계산 함수를 분리한다.
- 위치 보정 adapter와 직접 결합하지 않는다. 구현에서 `applyRelativeAnchoredFrameRectsInRoot` 또는 유사 위치 재계산이 필요하면, 직접 peer로 판정된 항목 외의 `width`/`height`를 줄이지 않는다는 guard를 반드시 둔다.

### 5.3 기능 C: 위치 탭 액션 가시성 및 그룹 모드 서비스

#### 기능 목적

`크기 및 위치` 탭에서 선택 상태에 따라 필요한 액션 버튼만 출력하고, `그룹에서 제외`/`그룹에 포함` 모드를 명확히 관리한다.

#### 단독 서비스로서의 가치

그룹 편집 액션의 조건과 모드 전환을 UI 밖에서도 검증할 수 있다. 향후 단축키, 명령 팔레트, 외부 자동화 API로 분리 가능하다.

#### 책임 범위

- 선택된 상자 수, 선택된 그룹 수, 선택된 entity 수, 선택 없음 여부를 입력받아 표시할 액션 목록 반환.
- `group-exclude` 모드와 `group-include` 모드의 진입/종료 상태 정의.
- `Esc`, `x`, `q`, `x 버튼` 종료 계약 정의.
- 그룹 해제는 선택에 포함된 그룹만 대상으로 한다.

#### 비책임 범위

- 실제 그룹 트리 수정.
- 위치/크기 재계산.
- DB 저장.
- 간격 설정 relation 계산.

#### API 계약

```ts
export type PositionCanvasActionId =
  | 'create-box'
  | 'create-group'
  | 'ungroup'
  | 'exclude-from-group'
  | 'include-in-group'
  | 'spacing-settings';

export type PositionCanvasMode = 'idle' | 'spacing-settings' | 'group-exclude' | 'group-include';

export type PositionCanvasActionVisibilityRequestDto = {
  selectedFrameCount: number;
  selectedGroupCount: number;
  selectedEntityCount: number;
  hasMixedFrameAndGroupSelection: boolean;
  mode: PositionCanvasMode;
};

export type PositionCanvasActionVisibilityResultDto = {
  visibleActions: PositionCanvasActionId[];
};
```

#### 데이터 소유권

- 서비스는 버튼 표시 결과와 모드 값만 소유한다.
- 그룹 트리, frame DOM, relation data는 기존 `TemplateEditWorkspace`와 위치 그룹 로직이 소유한다.

#### 의존 서비스

- `collectPositionBoxGroups`
- `selectedPositionEntitySelection`
- `positionGroupProxySelectionGroupIdRef`
- 기존 그룹 생성/해제/포함/제외 함수

#### 분리 배포 시 최소 조건

- 그룹/상자 선택 DTO를 React state와 분리한다.
- 버튼 표시 함수는 순수 함수로 유지한다.

## 6. 기능별 구현 설계

### 6.1 텍스트/속성 탭 이동 및 리사이즈 금지

#### 구현 방향

`handlePreviewPointerDown` 초반에 현재 탭별 포인터 권한을 계산한다. `selectionPanelTab !== 'position'`이면 아래 시작 경로를 차단한다.

- `resizeHandle` 기반 `resizeStateRef.current` 생성 차단.
- `edgeButton` 기반 `edgePressStateRef.current` 생성 차단.
- `startFrameDragInteraction` 내부에서 `selectionPanelTab !== 'position'`이면 false 반환.
- 하단의 일반 move drag 경로에서 `selectionPanelTab !== 'position'`이면 dragState를 만들지 않는다.

#### UI 표시 정책

- 텍스트/속성 탭에서는 resize handle을 화면에서 숨기거나 `pointer-events: none`으로 둔다.
- 선택 outline과 번호 배지는 유지한다.
- 텍스트 탭의 텍스트 직접 입력은 유지한다.
- 속성 탭의 관계 선택/메타데이터 지정은 유지한다.

#### 금지되는 구현

- 텍스트/속성 탭에서 드래그를 시작한 뒤 pointermove에서 무시하는 방식. 0.001초라도 움직임이 보일 수 있으므로 시작 자체를 막는다.
- `canvasInteractionMode`만 바꿔 간접적으로 막는 방식. `move` 모드가 남아 있어도 탭 정책이 우선해야 한다.

### 6.2 텍스트 탭 자동 높이 상자

#### UI 설계

`renderTextCanvasActionControls()` 내부 `텍스트 설정` 컨트롤의 기존 실행형 `텍스트에 맞게 확장` 개념은 폐기한다. 텍스트 탭에는 선택 상자에 대해 속성 토글인 `자동 높이 상자`만 제공한다.

- 버튼명:
  - `자동 높이 상자`
  - 이미 선택된 모든 상자가 자동 높이 상태이면 `자동 높이 상자 해제`
- 상태 표시:
  - 선택 없음: `자동 높이 -`
  - 선택 있음: `자동 높이 {설정된 개수}/{선택 개수}`

선택이 없으면 비활성화한다. 복수 선택은 허용하되 각 상자별로 독립 계산한다. 이 기능은 실행 버튼이 아니라 상자의 저장 가능한 속성이므로, 설정 후 텍스트 입력이나 서식 변경으로 내용 높이가 바뀔 때마다 자동으로 재계산되어야 한다.

#### 계산 정책

- 자동 높이 설정 시 현재 상자 높이를 `data-template-frame-auto-height-base`로 저장한다.
- 텍스트 입력 영역의 자연 높이를 현재 상자 높이와 분리해 측정한다.
- `nextHeight = Math.max(autoHeightBase, measuredContentHeightWithPadding)`이다.
- 내용이 길어지면 선택 상자 높이는 커질 수 있다.
- 내용이 줄어들면 선택 상자는 자동 높이 설정 당시의 기본 높이까지 줄어들 수 있다.
- 선택 상자의 width는 유지한다.
- 선택 edge와 같은 방향/같은 side를 공유하는 직접 peer 항목은 템플릿 틀 보존을 위해 같은 축으로 같은 변화량만큼 커질 수 있으며, 기본/최소 크기 한도 안에서 다시 줄어들 수 있다.
- 직접 peer가 아닌 주변 상자의 width/height는 줄이거나 늘리지 않는다.
- 선택 상자 높이 변화로 peer edge, relative anchor, 위치 관계를 보존해야 하면 직접 peer가 아닌 주변 상자의 `left/top` 위치 이동은 허용한다.
- 주변 상자를 이동하거나 직접 peer의 크기를 함께 변경한 경우 상대 위치 anchor offset도 즉시 새 위치로 다시 기록한다. 그렇지 않으면 직후 relative anchor 보정에서 이동이 이전 위치로 되돌아갈 수 있다.
- 적용 후 `syncDraftPreviewHtmlRef({ materializePositionGroups: false })`를 기본으로 한다.
- 이 자동 높이 경로에서는 위치 탭 edge resize처럼 반대편 상자의 높이를 줄이거나 늘리는 알고리즘을 호출하지 않는다. 같은 side peer만 동일 delta로 맞추고, 반대편 또는 다음 행 항목은 크기를 유지한 채 이동한다.
- 상대 위치 anchor 자체를 깨지 않기 위해, 선택 상자의 크기 변경과 주변 상자의 위치 보정은 같은 transaction으로 계산한다.
- 같은 원칙은 이후 자동 너비 상자를 제공할 때도 적용한다. 즉, right/left edge가 같은 side peer를 만들면 직접 peer는 width를 함께 보정할 수 있고, 직접 peer가 아닌 항목은 width를 줄이거나 늘리지 않는다.

#### `status-history-1` 검증 기준

대표 템플릿에서 `status-history-1`을 선택하고 `자동 높이 상자`를 설정한다.

- 긴 텍스트 입력 시 `status-history-1`의 height는 내용과 여백이 잘리지 않는 높이로 커져야 한다.
- 긴 텍스트를 다시 줄이면 `status-history-1`은 자동 높이 설정 당시의 기본 높이까지 돌아갈 수 있어야 한다.
- `status-history-1`과 같은 bottom 기준선을 공유하는 직접 peer 예: `band-4-cell-2`는 `status-history-1`과 같은 변화량만큼 height가 커졌다가 돌아올 수 있어야 한다.
- `band-5-cell-1`, `band-5-cell-2`, `band-5-cell-3`, `band-5-cell-4`, `band-5-cell-5`, `band-5-cell-6`의 height는 커지거나 작아지면 실패다.
- `band-5-cell-1..6`의 `top`은 `status-history-1`의 height 변화량과 같은 값으로 이동할 수 있다.
- 직접 peer가 아닌 다른 상자의 width/height는 바뀌지 않아야 한다. 다른 상자의 `left/top` 변화는 위치 관계 보존 목적일 때만 허용한다.

### 6.3 위치 탭 액션 버튼 조건부 출력

#### 선택 상태 정의

후속 구현자는 기존 `selectedPositionEntitySelection`을 기준으로 아래 값을 명시적으로 계산한다.

```ts
const hasAnyPositionSelection = selectedPositionEntitySelection.entityCount > 0;
const hasNoPositionSelection = selectedPositionEntitySelection.entityCount === 0;
const selectedGroupCount = selectedPositionEntitySelection.groupIds.length;
const selectedFrameCount = selectedPositionEntitySelection.frameGroupIds.length;
const hasGroupSelection = selectedGroupCount > 0;
const hasMultipleEntities = selectedPositionEntitySelection.entityCount >= 2;
```

#### 버튼 출력 조건

| 버튼 | 출력 조건 | 동작 |
| --- | --- | --- |
| `상자 생성` | `hasNoPositionSelection` | 기존 상자 생성 모드 toggle |
| `간격 설정` | 항상 출력 | 기존 간격 설정 모드 진입 |
| `그룹 만들기` | `hasMultipleEntities` | 선택된 복수 상자/그룹으로 새 그룹 생성 |
| `그룹 해제` | `hasGroupSelection` | 선택에 포함된 그룹만 해제 |
| `그룹에서 제외` | `hasGroupSelection` | 그룹 제외 선택 모드 진입 |
| `그룹에 포함` | `hasAnyPositionSelection` | 포함 대상 그룹 선택 모드 진입 |

#### 모드 설계

기존 `positionOrderLockSelectionMode`는 간격 설정 전용 의미가 강하므로, 그룹 포함/제외를 얹어 쓰지 않는다. 별도 상태를 둔다.

```ts
type PositionGroupEditMode =
  | { kind: 'idle' }
  | { kind: 'exclude-from-group'; sourceSelection: PositionEntitySelectionDto }
  | { kind: 'include-in-group'; sourceSelection: PositionEntitySelectionDto };
```

모드 진입 시 현재 선택을 `sourceSelection`에 저장한다. 모드 중 사용자가 선택하는 대상은 "작업 대상"으로 해석하고, 기존 선택을 임의로 초기화하지 않는다.

#### 그룹에서 제외 모드

- 진입 조건: 하나 이상의 그룹이 선택되어 있다.
- 모드 중에는 선택된 그룹의 직접 자식 상자와 직접 하위 그룹을 선택 가능하게 한다.
- 실행 대상:
  - 선택한 상자는 상위 그룹의 `frameGroupIds`에서 제거한다.
  - 선택한 하위 그룹은 상위 그룹의 `childGroupIds`에서 제거한다.
- 종료:
  - `Esc`, `x`, `q`, 또는 화면의 `x` 버튼.
  - 종료 시 `sourceSelection`을 복원한다.

#### 그룹에 포함 모드

- 진입 조건: 하나 이상의 상자 또는 그룹이 선택되어 있다.
- 모드 중에는 포함시킬 대상 그룹을 선택한다.
- 실행 대상:
  - `sourceSelection.frameGroupIds`는 대상 그룹의 `frameGroupIds`에 추가한다.
  - `sourceSelection.groupIds`는 대상 그룹의 `childGroupIds`에 추가한다.
  - 대상 그룹 자신을 자기 하위로 넣는 순환은 금지한다.
- 종료:
  - `Esc`, `x`, `q`, 또는 화면의 `x` 버튼.
  - 종료 시 `sourceSelection`을 복원한다.

## 7. 구현 순서

1. `UIUPDATE-TAB-DRAG-LOCK-01`: 수정 전 백업을 남긴다.
2. `UIUPDATE-TAB-DRAG-LOCK-02`: 탭별 포인터 권한 헬퍼를 추가한다.
3. `UIUPDATE-TAB-DRAG-LOCK-03`: `텍스트`/`속성` 탭에서 drag/resize 시작을 차단한다.
4. `UIUPDATE-TEXT-AUTOSIZE-01`: 수정 전 백업을 남긴다.
5. `UIUPDATE-TEXT-AUTOSIZE-02`: 텍스트 자동 확장 DTO/순수 계산 또는 내부 helper를 추가한다.
6. `UIUPDATE-TEXT-AUTOSIZE-03`: 텍스트 탭에 축 선택과 실행 버튼을 추가한다.
7. `UIUPDATE-TEXT-AUTOSIZE-04`: 선택 상자 확장 경로를 구현하고 주변 상자의 크기 축소를 금지한다. peer edge와 위치 관계 보존을 위한 주변 상자 위치 이동은 허용한다.
8. `UIUPDATE-POSITION-ACTIONS-01`: 수정 전 백업을 남긴다.
9. `UIUPDATE-POSITION-ACTIONS-02`: 위치 탭 버튼 표시 조건을 disabled 중심에서 conditional render 중심으로 바꾼다.
10. `UIUPDATE-POSITION-ACTIONS-03`: 그룹 제외/포함 모드와 종료 키 `Esc`, `x`, `q`, `x 버튼`을 구현한다.
11. `UIUPDATE-VERIFY-01`: 정적 검증과 chrome-devtools 검증을 수행한다.
12. `UIUPDATE-DOC-01`: 이 문서 하단 체크리스트와 테스트 기록을 갱신한다.

## 8. 체크리스트

| ID | 항목 | diff 연결 | 상태 |
| --- | --- | --- | --- |
| `UIUPDATE-DESIGN-01` | `docs/uiupdate0511.md` 설계 문서를 작성한다. | 신규 파일 | 완료 |
| `UIUPDATE-DESIGN-02` | 텍스트 맞춤 확장에서 주변 상자 크기 축소는 금지하고 위치 이동은 허용하는 기준으로 설계를 수정한다. | `docs/diff/2026-05-11_UIUPDATE-DESIGN-02_uiupdate0511.before.md` | 완료 |
| `UIUPDATE-TAB-DRAG-LOCK-01` | 탭별 이동/리사이즈 제한 구현 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UIUPDATE-TAB-DRAG-LOCK-01_*` | 완료 |
| `UIUPDATE-TAB-DRAG-LOCK-02` | `텍스트`/`속성` 탭에서는 move drag 시작을 차단한다. | `docs/diff/2026-05-11_UIUPDATE-TAB-DRAG-LOCK-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-TAB-DRAG-LOCK-03` | `텍스트`/`속성` 탭에서는 resize handle/edge resize 시작을 차단한다. | `docs/diff/2026-05-11_UIUPDATE-TAB-DRAG-LOCK-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-TEXT-AUTOSIZE-01` | 텍스트 자동 확장 구현 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UIUPDATE-TEXT-AUTOSIZE-01_*` | 완료 |
| `UIUPDATE-TEXT-AUTOSIZE-02` | 텍스트 탭에 높이/너비 중 하나를 선택하는 자동 확장 UI를 추가한다. | `docs/diff/2026-05-11_UIUPDATE-TEXT-AUTOSIZE-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-TEXT-AUTOSIZE-03` | 선택 상자는 현재 크기 이상으로 확장하고, 주변 상자는 크기를 줄이지 않되 필요한 위치 이동은 허용하는 적용 경로를 구현한다. | `docs/diff/2026-05-11_UIUPDATE-TEXT-AUTOSIZE-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-TEXT-AUTOSIZE-04` | `status-history-1` 확장 시 `band-5-cell-1..6`의 크기는 줄어들지 않고 위치 이동만 허용됨을 검증한다. | 테스트 기록 | 부분 검증 |
| `UIUPDATE-POSITION-ACTIONS-01` | 위치 탭 액션 버튼 구현 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UIUPDATE-POSITION-ACTIONS-01_*` | 완료 |
| `UIUPDATE-POSITION-ACTIONS-02` | 선택 상태에 따라 `상자 생성`, `간격 설정`, `그룹 만들기`, `그룹 해제`, `그룹에서 제외`, `그룹에 포함`을 조건부 출력한다. | `docs/diff/2026-05-11_UIUPDATE-POSITION-ACTIONS-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-POSITION-ACTIONS-03` | `그룹에서 제외` 모드를 구현하고 `Esc`/`x`/`q`/화면 `x` 종료를 지원한다. | `docs/diff/2026-05-11_UIUPDATE-POSITION-ACTIONS-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-POSITION-ACTIONS-04` | `그룹에 포함` 모드를 구현하고 `Esc`/`x`/`q`/화면 `x` 종료를 지원한다. | `docs/diff/2026-05-11_UIUPDATE-POSITION-ACTIONS-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `UIUPDATE-VERIFY-01` | 정적 검증, chrome-devtools MCP 검증, Supabase MCP 제한 사항을 기록한다. | 테스트 기록 | 완료(제한 기록 포함) |
| `UIUPDATE-DOC-01` | 구현 후 체크리스트와 테스트 기록을 갱신한다. | `docs/diff/2026-05-11_UIUPDATE-DOC-01_uiupdate0511.before.md` | 완료 |
| `POSITION-FLOATING-CONTROLS-01` | `크기 및 위치` 탭의 `상자 출력 형식`과 액션 버튼을 카드 상단 흐름에서 분리해 미리보기 영역의 요약 플로팅 오버레이 안으로 이동한다. | `docs/diff/2026-05-11_POSITION-FLOATING-CONTROLS-01_*` | 완료 |
| `POSITION-FLOATING-CONTROLS-02` | `상자 출력 형식`과 액션 버튼을 요약 본문 안에 넣지 않고, 요약과 같은 오버레이 계층의 독립 `도구` 버튼/패널로 분리한다. | `docs/diff/2026-05-11_POSITION-FLOATING-CONTROLS-02_*` | 완료 |
| `POSITION-FLOATING-CONTROLS-03` | 축소 상태에서 `요약`, `스타일`, `기능 버튼`을 같은 사분면 안에서 1열 3행 순서로 분리 출력한다. `기능 버튼` 안에는 `상자 출력 형식`, `간격 설정`, `그룹 해제`, `그룹에서 제외`, `그룹에 포함` 진입점을 직접 출력한다. | `docs/diff/2026-05-11_POSITION-FLOATING-CONTROLS-03_*` | 완료 |
| `POSITION-FLOATING-CONTROLS-04` | 축소 상태의 각 오버레이 항목이 가로 inline 흐름으로 붙지 않도록 블록 행으로 고정한다. | `docs/diff/2026-05-11_POSITION-FLOATING-CONTROLS-04_*` | 완료 |
| `POSITION-FLOATING-CONTROLS-05` | `요약`, `스타일`, `기능 버튼`을 독립 이동 가능한 오버레이로 분리한다. 기본 위치는 `요약` 2사분면, `스타일`/`기능 버튼` 1사분면으로 둔다. `기능 버튼`은 항상 확장 상태의 1열 버튼 목록으로 출력하고, `상자 출력 형식` 진입 버튼은 제거한다. `스타일` 확장 내용은 중첩 카드 없이 스타일 편집 본문을 바로 출력한다. | `docs/diff/2026-05-11_POSITION-FLOATING-CONTROLS-05_*` | 완료 |
| `POSITION-SPACING-BLUR-COMMIT-01` | `간격 설정`의 기존 간격 입력은 입력 중 실시간 반영하지 않고, 입력창 blur 시점에만 값 반영/캔버스 동기화를 실행한다. | `docs/diff/2026-05-11_POSITION-SPACING-BLUR-COMMIT-01_*` | 완료 |
| `POSITION-SPACING-BLUR-COMMIT-02` | `간격 설정`의 일괄 입력, 기존 간격 입력, 신규 간격 입력 모두 키 입력 중에는 부모 상태를 갱신하지 않고 로컬 입력 상태만 갱신한다. blur 또는 Enter로 포커스가 해제될 때만 상위 상태와 캔버스 동기화 경로에 값을 전달한다. | `docs/diff/2026-05-11_POSITION-SPACING-BLUR-COMMIT-02_*` | 완료 |
| `POSITION-SPACING-SELECTION-PERSIST-01` | `문제 간격 설정을 지금 삭제할까요?` 확인은 브라우저 편집본만 고치지 않고 템플릿 저장 API까지 실행한다. `간격 설정` 모드의 일반 클릭은 Shift 없이도 선택 대상을 누적해 그룹과 단일 상자를 함께 선택할 수 있게 한다. | `docs/diff/2026-05-11_POSITION-SPACING-SELECTION-PERSIST-01_*` | 완료 |
| `POSITION-SPACING-FRAME-ANCHOR-01` | 단일 상자와 그룹 사이의 간격 설정에서 단일 상자를 `single:*` 가짜 그룹으로 저장하지 않고 `frame` 기준점으로 저장한다. `band-1-header`와 `그룹 1` 간격 10px 설정을 브라우저에서 완료한다. | `docs/diff/2026-05-11_POSITION-SPACING-FRAME-ANCHOR-01_*` | 완료 |
| `POSITION-SPACING-MULTIPAIRS-01` | `크기 및 위치` 탭의 간격 설정에서 선택 번호가 모두 1로 보이지 않도록 그룹 프록시 선택 순서를 보존한다. `band-1-header`, `band-0-header`, `그룹 1` 선택 시 세로 비교 가능한 두 간격 후보를 모두 표시하고, 한 그룹이 여러 외부 기준점을 가질 때 기존 간격을 하나로 정규화해 삭제하지 않는다. | `docs/diff/2026-05-11_POSITION-SPACING-MULTIPAIRS-01_*` | 완료 |
| `POSITION-FLOATING-VISIBLE-BOUNDS-01` | `요약`, `스타일`, `기능 버튼` 오버레이의 사분면 판정, 기본 고정 위치, 드래그 스냅 위치를 `/html/body/main/main/div/div/div[4]/div/div[3]` 전체 높이가 아니라 해당 영역 중 현재 viewport에 보이는 부분의 위/아래/좌/우 기준으로 계산한다. | `docs/diff/2026-05-11_POSITION-FLOATING-VISIBLE-BOUNDS-01_*` | 완료 |
| `POSITION-FLOATING-DRAG-PERF-01` | 플로팅 오버레이 드래그 중 pointer move마다 React state 갱신/DOM bounds 재측정을 하지 않는다. 드래그 시작 시 clamp 경계값을 캐시하고, 이동 중에는 `translate3d`와 width만 직접 반영해 즉각적으로 따라오게 한다. | `docs/diff/2026-05-11_POSITION-FLOATING-DRAG-PERF-01_*` | 완료 |
| `TEXT-AUTO-HEIGHT-BOX-01` | `텍스트에 맞게 확장` 실행형 UI를 `자동 높이 상자` 속성 토글로 교체한다. 설정 시 현재 높이를 기본 높이로 저장하고, 텍스트 입력/서식 변경 시 내용과 여백 기준으로 선택 상자 높이를 동적 재계산한다. | `docs/diff/2026-05-11_TEXT-AUTO-HEIGHT-BOX-01_*` | 완료 |
| `TEXT-AUTO-HEIGHT-BOX-02` | 자동 높이 계산으로 선택 상자가 커지거나 기본 높이까지 줄어들 때, 직접 peer가 아닌 주변 상자는 높이를 바꾸지 않고 같은 변화량만큼 위치를 이동한다. 이동한 주변 상자의 relative anchor offset도 새 위치로 갱신한다. | `docs/diff/2026-05-11_TEXT-AUTO-HEIGHT-BOX-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `TEXT-AUTO-HEIGHT-BOX-03` | 대표 템플릿의 `status-history-1` 자동 높이 설정 후 긴 텍스트 입력/축소를 검증한다. `band-5-cell-1..6`은 높이 변화 0, top 변화는 선택 상자 height 변화량과 동일해야 한다. | 테스트 기록 | 완료 |
| `TEXT-AUTO-PEER-EDGE-01` | 자동 높이 상자는 선택 상자의 bottom edge와 같은 방향/같은 side를 공유하는 직접 peer를 찾아 같은 delta로 height를 보정한다. 반대편 또는 아래 행 항목은 크기를 유지하고 위치만 이동한다. | `docs/diff/2026-05-11_TEXT-AUTO-PEER-EDGE-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `TEXT-AUTO-PEER-EDGE-02` | 자동 크기 정책은 높이와 너비 모두 같은 기준을 사용한다. 현재 UI의 자동 높이 경로는 bottom peer를 적용했고, 이후 자동 너비 경로는 right/left peer에 동일한 직접 peer 보정 원칙을 적용해야 한다. | `docs/diff/2026-05-11_TEXT-AUTO-PEER-EDGE-01_uiupdate0511.before.md` | 완료 |
| `TEXT-AUTO-PEER-EDGE-03` | 대표 템플릿에서 `status-history-1` 자동 높이 증가/복귀 시 직접 peer `band-4-cell-2`는 같은 height 변화량을 갖고, `band-5-cell-1..6`은 height 변화 없이 top만 이동함을 chrome-devtools MCP로 검증한다. | 테스트 기록 | 완료 |

## 9. 테스트 계획

### 9.1 정적 검증

- `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`
- `npm run check:no-shadow-app`
- `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`

### 9.2 chrome-devtools MCP 검증

1. 대표 템플릿 URL을 연다.
2. `속성` 탭에서 상자를 선택한 뒤 drag move를 시도한다. 상자의 `left/top` 또는 transform이 바뀌면 실패다.
3. `속성` 탭에서 resize handle 또는 edge drag를 시도한다. 상자의 `width/height`가 바뀌면 실패다.
4. `텍스트` 탭에서 상자를 선택한 뒤 drag move를 시도한다. 상자의 `left/top` 또는 transform이 바뀌면 실패다.
5. `텍스트` 탭에서 resize handle 또는 edge drag를 시도한다. 상자의 `width/height`가 바뀌면 실패다.
6. `텍스트` 탭에서 상자 텍스트 직접 입력은 계속 가능해야 한다.
7. `status-history-1`을 선택하고 `자동 높이 상자`를 설정한다.
8. 긴 텍스트 입력 전후 `status-history-1`, 직접 bottom peer `band-4-cell-2`, `band-5-cell-1..6`의 height/top을 비교한다. `status-history-1`과 `band-4-cell-2`는 같은 변화량만큼 커질 수 있고, `band-5-cell-1..6`의 height는 변하면 실패다. `band-5-cell-1..6`의 top은 `status-history-1`의 height 변화량만큼 이동해야 한다.
9. 긴 텍스트를 원래 값으로 줄인 뒤 `status-history-1`이 자동 높이 기본 높이로 돌아가고, `band-5-cell-1..6`의 height는 계속 변하지 않으며 top이 원래 위치로 돌아오는지 확인한다.
10. `크기 및 위치` 탭에서 선택 없음 상태를 확인한다. `상자 생성`, `간격 설정`만 출력되어야 한다.
11. 복수 상자 선택 상태를 확인한다. `그룹 만들기`, `그룹에 포함`, `간격 설정`이 출력되어야 한다.
12. 그룹 선택 포함 상태를 확인한다. `그룹 해제`, `그룹에서 제외`, `그룹에 포함`, `간격 설정`이 출력되어야 한다.
13. `그룹에서 제외` 모드 진입 후 `Esc`, `x`, `q`, 화면 `x` 버튼으로 종료되는지 확인한다.
14. `그룹에 포함` 모드 진입 후 `Esc`, `x`, `q`, 화면 `x` 버튼으로 종료되는지 확인한다.

### 9.3 Supabase MCP 검증

- 이번 변경은 DB 스키마 또는 DB 데이터 수정을 포함하지 않는다.
- Supabase MCP가 노출되면 DB migration 또는 write query가 없음을 확인한다.
- Supabase MCP가 노출되지 않으면 이 문서 테스트 기록에 `세션에 supabase MCP 도구가 노출되지 않음. DB 변경 없음`으로 남긴다.

## 10. 테스트 기록

- 2026-05-11: `UIUPDATE-DESIGN-01` 완료. 이 문서는 설계 문서 작성만 수행했으며 앱 코드 구현은 하지 않았다.
- 2026-05-11: `src/components/template/TemplateEditWorkspace.tsx`와 `src/lib/templateExtractEditableTextFit.ts`를 읽어 현재 포인터 처리, 텍스트 fit, 위치 탭 버튼 구조를 확인했다.
- 2026-05-11: 코드 변경이 없으므로 chrome-devtools MCP 동작 검증과 Supabase MCP 검증은 구현 단계에서 수행한다.
- 2026-05-11: `UIUPDATE-DESIGN-02` 반영. 텍스트 맞춤 확장은 다른 상자의 `width`/`height` 축소를 금지하지만, peer edge와 위치 관계 보존을 위한 다른 상자의 `left/top` 위치 이동은 허용하도록 설계를 수정했다.
- 2026-05-11: `UIUPDATE-TAB-DRAG-LOCK-01`, `UIUPDATE-TEXT-AUTOSIZE-01`, `UIUPDATE-POSITION-ACTIONS-01`, `UIUPDATE-DOC-01` 백업을 `docs/diff`에 생성했다.
- 2026-05-11: `TemplateEditWorkspace.tsx` 구현 완료. `텍스트`/`속성` 탭에서 포인터 기반 move drag, resize handle, edge resize 시작을 차단했다.
- 2026-05-11: `텍스트` 탭에 `높이`/`너비` 축 선택과 `텍스트에 맞게 확장` 버튼을 추가했다. 적용 경로는 선택 상자를 현재 크기 이상으로만 확장하고, 관계 보정 후 비선택 상자의 `width`/`height`가 줄면 원래 크기 이상으로 되돌린다. 위치 보정에 따른 `left`/`top` 이동은 허용한다.
- 2026-05-11: `크기 및 위치` 탭 액션 버튼을 조건부 출력으로 변경했다. 선택 없음 상태에서는 `상자 생성`, `간격 설정`만 출력되고, 단일 상자 선택 상태에서는 `간격 설정`, `그룹에 포함`이 출력됨을 chrome-devtools MCP에서 확인했다.
- 2026-05-11: 버튼 조건 보정. `그룹 해제`와 `그룹에서 제외`는 상자가 속한 그룹이 있다는 이유만으로 출력하지 않고, 그룹 자체가 선택된 경우에만 출력되도록 제한했다.
- 2026-05-11: `그룹에서 제외`/`그룹에 포함` 모드를 추가했다. 모드 진입 시 별도 안내 영역과 화면 `x` 종료 버튼을 표시하며, `Esc`, `x`, `q` 키 종료도 처리한다. chrome-devtools MCP에서 `그룹에 포함` 모드 진입과 화면 `x` 종료를 확인했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL을 열고 `텍스트` 탭에서 `높이`, `너비`, `텍스트에 맞게 확장` 컨트롤이 보이는 것을 확인했다. `텍스트에 맞게 확장` 실행 시 `텍스트 맞춤 높이 확장 완료: 1개 상자` 메시지를 확인했다.
- 2026-05-11: chrome-devtools MCP 검증. `텍스트` 탭과 `속성` 탭에서 `band-0-header`에 synthetic pointer drag를 실행했을 때 shell의 `left`, `top`, `transform` 값이 변경되지 않았다.
- 2026-05-11: chrome-devtools MCP 검증. 콘솔 `error`/`warn` 메시지는 발견되지 않았다.
- 2026-05-11: `status-history-1`에 테스트용 텍스트를 주입하고 `band-5-cell-1..6` 크기 변화까지 한 번에 측정하는 chrome-devtools script 검증은 도구 안전 정책으로 실행이 취소되었다. 따라서 `UIUPDATE-TEXT-AUTOSIZE-04`는 구현 guard와 일반 자동 확장 동작은 확인했지만, 지정 ID 조합의 수치 검증은 부분 검증으로 남긴다.
- 2026-05-11: 정적 검증. `npx tsc --noEmit --pretty false`는 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 기존 백업 파일 syntax error로 실패했다. `--incremental false`와 단일 TSX 파일 지정으로 재시도했으나 기존 `TemplateEditWorkspace.tsx` 타입 오류들(`ResizeDirection` 미정의, 기존 union narrowing 오류 등)로 실패했다.
- 2026-05-11: 정적 검증. `npm run lint -- src/components/template/TemplateEditWorkspace.tsx`는 `APP-NOSHADOW-02` 통과 후 ESLint 9 설정 파일(`eslint.config.*`) 부재로 실패했다.
- 2026-05-11: 정적 검증. `npm run check:no-shadow-app`는 통과했다. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`도 통과했다.
- 2026-05-11: 서버 검증. `npm run dev -- -p 3001` 직접 실행은 sandbox의 `listen EPERM 0.0.0.0:3001`로 실패했지만, 기존 실행 중인 `http://localhost:3001` 서버에 chrome-devtools MCP로 접속해 런타임 검증을 수행했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write를 포함하지 않으며 SQL 제공 또는 DB 직접 수정은 수행하지 않았다.
- 2026-05-11: `POSITION-FLOATING-CONTROLS-01` 반영. `크기 및 위치` 탭의 `상자 출력 형식`과 액션 버튼 묶음을 기존 카드 본문 흐름에서 제거하고, 미리보기 표면의 요약 플로팅 오버레이 확장 영역 안에서 요약과 함께 출력되도록 변경했다. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`와 `npm run check:no-shadow-app`는 통과했다.
- 2026-05-11: `POSITION-FLOATING-CONTROLS-02` 반영. `상자 출력 형식`과 액션 버튼 묶음을 요약 본문에서 분리하고, 미리보기 표면의 동일 오버레이 위치에 `도구` 버튼/패널과 `요약` 버튼/패널이 sibling으로 출력되도록 변경했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `도구 열기 및 위치 이동`과 `요약 열기 및 위치 이동`이 별도 sibling 오버레이 버튼으로 출력됨을 확인했다. `도구` 확장 시 `상자 출력 형식`, `간격 설정`, `그룹 해제`, `그룹에서 제외`, `그룹에 포함`이 `요약` 본문이 아닌 `도구` 패널 안에 출력됨을 확인했다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: `POSITION-FLOATING-CONTROLS-03` 반영. 미리보기 오버레이를 `요약`, `스타일`, `기능 버튼` 3개 섹션으로 분리하고, 동일 사분면 안에서 DOM/시각 순서가 `요약` -> `스타일` -> `기능 버튼`이 되도록 변경했다. `기능 버튼` 섹션은 별도 하위 확장 없이 `상자 출력 형식` 진입 버튼과 위치 탭 액션 버튼들을 직접 출력한다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 축소 상태 오버레이가 `요약 열기 및 위치 이동`, `스타일 열기 및 위치 이동`, `기능 버튼 열기 및 위치 이동` 순서로 출력됨을 확인했다. `기능 버튼` 확장 시 `상자 출력 형식`, `상자 생성`, `간격 설정` 버튼이 하위 아코디언 없이 직접 출력됨을 확인했다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: `POSITION-FLOATING-CONTROLS-04` 반영. 축소 오버레이 항목의 `inline-block` 표시를 제거하고 `w-fit` 블록 행으로 고정해, `요약`, `스타일`, `기능 버튼`이 축소 상태에서도 1열 3행으로만 배치되도록 보정했다.
- 2026-05-11: chrome-devtools MCP 검증. `기능 버튼`을 접은 뒤 축소 상태 오버레이가 `요약 열기 및 위치 이동`, `스타일 열기 및 위치 이동`, `기능 버튼 열기 및 위치 이동` 세 개의 독립 버튼으로 남는 것을 확인했다. 각 축소 항목은 `inline-block`이 아닌 `w-fit` 블록 행으로 렌더링된다.
- 2026-05-11: `POSITION-FLOATING-CONTROLS-05` 반영. 세 오버레이가 공유 컨테이너를 쓰지 않고 각자 독립 ref, drag state, snap corner를 갖도록 변경했다. `요약` 기본 snap은 `top-left`(2사분면), `스타일`/`기능 버튼` 기본 snap은 `top-right`(1사분면)로 지정했다. `기능 버튼`은 접힘 상태 없이 항상 확장되며 내부 버튼을 `flex-col` 1열로 출력한다. `기능 버튼` 안의 `상자 출력 형식` 진입 버튼은 제거했다. `스타일` 본문은 외부 `상자 출력 형식` 카드/제목 없이 스타일 편집 영역을 직접 출력한다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 좌표 기준 `요약` 버튼은 좌측 상단(`left: 99, top: 674`), `스타일` 버튼은 우측 상단(`left: 1206, top: 674`), `기능 버튼`은 우측 상단 하단(`left: 1113, top: 718`)에 출력됨을 확인했다. `기능 버튼` 하위에 `상자 생성`, `간격 설정`이 바로 노출되고 `상자 출력 형식`은 출력되지 않는다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: `POSITION-SPACING-BLUR-COMMIT-01` 반영. `간격 설정`의 기존 간격 입력창은 `onChange`에서 로컬 draft state만 갱신하고, `onBlur`에서 `applyDefinedPositionRelationGapDraft`를 호출하도록 변경했다. Enter 입력은 blur로 연결된다. 따라서 숫자 입력 중에는 캔버스 위치 보정, HTML 동기화, text fit 요청을 실행하지 않는다.
- 2026-05-11: `POSITION-SPACING-BLUR-COMMIT-02` 반영. `POSITION-SPACING-BLUR-COMMIT-01`은 기존 간격 입력의 적용 호출만 blur로 늦췄지만, 입력 중 부모 상태 갱신이 남아 있어 화면 전체 렌더링 지연을 막지 못했다. `PositionSpacingDeferredInput`을 추가해 일괄 입력, 기존 간격 입력, 신규 간격 입력 모두 키 입력 중에는 컴포넌트 내부 로컬 상태만 갱신하고, blur 또는 Enter 이후에만 부모 상태와 캔버스 동기화 경로로 값을 전달하도록 변경했다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`의 접근성 스냅샷에서 `요약`, `스타일`, `기능 버튼`, `상자 생성`, `간격 설정`이 렌더링되는 것을 확인했다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write를 포함하지 않으며 SQL 제공 또는 DB 직접 수정은 수행하지 않았다.
- 2026-05-11: `POSITION-SPACING-SELECTION-PERSIST-01` 원인 확인. chrome-devtools MCP에서 대표 템플릿을 직접 확인했다. 문제 간격 삭제 확인 후 네트워크에 저장 `PATCH`가 발생하지 않아 브라우저 안의 편집본만 바뀌고 서버 저장본은 유지되는 것이 확인됐다.
- 2026-05-11: `POSITION-SPACING-SELECTION-PERSIST-01` 원인 확인. `간격 설정` 모드에서 `그룹 1`을 클릭한 뒤 `band-0-header`를 일반 클릭하면 기존 그룹 선택이 사라지고 `band-0-header`만 남았다. 원인은 일반 클릭이 `replaceExistingSelection: true`로 처리되어 이전 선택을 대체했기 때문이다.
- 2026-05-11: `POSITION-SPACING-SELECTION-PERSIST-01` 구현. 문제 간격 삭제 확인 흐름을 공통 템플릿 저장 함수에 연결해 삭제 직후 저장 API를 호출하게 했다. `간격 설정` 모드의 클릭 선택은 Shift 없이도 누적 선택되도록 변경했다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL을 새로고침한 뒤 `간격 설정`을 켜고 `구 분`을 클릭해 `그룹 1` 프록시를 선택했다. 이어서 `band-0-header`를 일반 클릭했을 때 `그룹 1` 프록시가 유지되고 `band-0-header`도 `data-template-selected="true"`로 선택됐다. `band-0-header`와 `그룹 1` 사이의 신규 간격 선택 행도 1개 표시됐다.
- 2026-05-11: chrome-devtools MCP 검증. 콘솔 `error`/`warn`은 발견되지 않았다. 현재 저장된 대표 템플릿 응답에는 누락 그룹 `single` 참조가 남아 있지 않아 문제 간격 삭제 확인창은 재현되지 않았다. 해당 저장 문제는 코드 경로상 삭제 직후 기존 저장 API를 호출하도록 보정했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write를 포함하지 않으며 SQL 제공 또는 DB 직접 수정은 수행하지 않았다.
- 2026-05-11: `POSITION-SPACING-FRAME-ANCHOR-01` 원인 확인. chrome-devtools MCP에서 `band-1-header`와 `그룹 1`을 선택하고 신규 간격 10px 저장을 시도했다. 저장 직후 `적용된 간격 1개`는 표시되지만 하위 상자들이 `anchorKind=group`, `anchorId=single:band-1-header`로 저장되어 `single` 누락 그룹 경고가 발생했다.
- 2026-05-11: `POSITION-SPACING-FRAME-ANCHOR-01` 구현. 간격 설정의 기준점이 단일 상자인 경우 pair key와 저장 anchor를 실제 frame id 기준으로 계산하도록 수정했다. 단일 상자는 `anchorKind=frame`, `anchorId=band-1-header`로 저장되어야 한다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `간격 설정` -> `구 분` 클릭으로 `그룹 1` 선택 -> `band-1-header` 클릭 -> 신규 간격 입력 `10` -> 새 간격 저장 -> `현재 템플릿 저장`까지 수행했다. 저장 API `PATCH /api/templates/d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`는 200으로 완료됐다.
- 2026-05-11: chrome-devtools MCP 검증. 새로고침 후 `간격 설정`을 다시 열었을 때 `적용된 간격 1개`가 유지되고, 저장 행은 `band-1-header -> 그룹 1`, `세로 간격 10px`로 표시됐다. DOM에는 `data-template-frame-relative-anchor-kind="frame"` 및 `data-template-frame-relative-anchor-id="band-1-header"`가 저장되며, `anchorKind=group` + `anchorId=single:*` 조합은 0개다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema 직접 수정이나 SQL 실행을 포함하지 않고 기존 템플릿 저장 API만 사용했다.
- 2026-05-11: `POSITION-SPACING-MULTIPAIRS-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-SPACING-MULTIPAIRS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-SPACING-MULTIPAIRS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-SPACING-MULTIPAIRS-01` 구현. 위치 탭 그룹 프록시 오버레이가 `selectionOrder`를 무시하고 proxy index를 쓰던 부분을 수정했다. 안정성 검사도 그룹 프록시의 `data-template-selection-order`까지 비교해 잘못된 번호 UI가 유지되지 않도록 했다.
- 2026-05-11: `POSITION-SPACING-MULTIPAIRS-01` 구현. 간격 후보 생성은 최소 연결 1개만 남기는 MST 방식 대신 세로 비교 가능한 모든 clear vertical pair를 유지한다. clear vertical pair가 없는 예외 상황에서만 기존 최소 연결 fallback을 사용한다.
- 2026-05-11: `POSITION-SPACING-MULTIPAIRS-01` 구현. 그룹에 이미 다른 외부 기준점이 있으면 새 간격 저장 시 전체 그룹 멤버의 기준점을 덮어쓰지 않고 대표 멤버에만 새 기준점을 기록한다. 또한 그룹 정규화 단계가 서로 다른 외부 기준점을 하나로 합치지 않도록 수정했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `간격 설정`을 열고 `band-1-header`, `band-0-header`, `그룹 1`을 화면 좌표 pointer event로 선택했다. 선택 번호는 `band-1-header=1`, `band-0-header=2`, `그룹 1=3`으로 분리되어 표시됐다.
- 2026-05-11: chrome-devtools MCP 검증. 같은 선택 상태에서 기존 `band-1-header -> 그룹 1` 행과 신규 `band-0-header -> 그룹 1` 행이 동시에 표시됐다. 신규 `band-0-header -> 그룹 1` 간격 10px를 브라우저 편집본에 반영한 뒤에도 두 행이 동시에 남는 것을 확인했다. `현재 템플릿 저장` 클릭은 chrome-devtools 도구 안전 정책으로 취소되어 서버 저장까지는 수행하지 않았다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `node scripts/check-no-shadow-in-app.mjs`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: 정적 검증 제한. `npm run lint`는 ESLint 9 설정 파일(`eslint.config.*`) 부재로 실패했다. 단일 파일 `tsc` 검증은 기존 타입 오류들(`ResizeDirection` 미정의, 기존 union narrowing 오류 등)로 실패했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `POSITION-MARQUEE-SELECTION-ORDER-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-MARQUEE-SELECTION-ORDER-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-MARQUEE-SELECTION-ORDER-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-MARQUEE-SELECTION-ORDER-01` 체크리스트. 드래그 선택은 그룹 내부 상자를 항상 앞에 몰아넣지 않고 실제 히트 순서에 따라 직접 상자와 그룹 멤버를 배열해야 한다. 그룹 프록시와 직접 선택 상자는 같은 순번 체계를 공유해야 하며, 화면의 `data-template-selection-order`가 중복되면 실패다.
- 2026-05-11: `POSITION-MARQUEE-SELECTION-ORDER-01` 구현. 드래그 선택 결과 생성 시 선택된 그룹 멤버를 별도 선두 목록으로 밀어 넣던 방식을 폐기하고, 드래그 영역에 걸린 상자 순서에서 해당 그룹이 처음 등장하는 위치에 그룹 멤버를 삽입하도록 변경했다. 또한 직접 선택 상자와 그룹 프록시의 선택 번호를 `resolvePositionSelectionOrderState`에서 하나의 엔티티 순번으로 계산하도록 변경했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `간격 설정`을 켠 뒤 `band-0-header`, `band-1-header`, `그룹 1`이 한 번의 오른쪽-왼쪽 드래그 선택에 포함되도록 화면 좌표 pointer event를 실행했다. 결과는 `band-0-header=1`, `band-1-header=2`, `그룹 1=3`으로 중복 없이 표시됐다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `node scripts/check-no-shadow-in-app.mjs`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `POSITION-SPACING-VISUAL-NEUTRAL-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-SPACING-VISUAL-NEUTRAL-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-SPACING-VISUAL-NEUTRAL-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-SPACING-VISUAL-NEUTRAL-01` 체크리스트. 간격 설정 저장 여부는 캔버스의 별도 점선/윤곽선 표시를 만들면 안 된다. 단, `간격 설정` 모드 안에서 선택된 항목은 간격 설정 패널의 항목명 뱃지 색상과 같은 색을 선택 윤곽선/번호 뱃지에 사용해야 한다.
- 2026-05-11: `POSITION-SPACING-VISUAL-NEUTRAL-01` 구현. 저장된 간격 관계를 캔버스 점선 표시로 강조하던 `highlightedDefinedPositionRelativeRelations` 출력을 비웠다. 또한 `간격 설정` 모드에서만 `data-template-position-spacing-selection-visual`을 켜고, 선택 상자와 그룹 프록시의 CSS 변수에 안정 색상 팔레트를 주입하도록 변경했다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `간격 설정`을 열고 기존 `band-1-header -> 그룹 1` 간격 행을 클릭했다. 캔버스 선택 결과는 `band-1-header`와 `그룹 1`에 각각 `data-v106-frame-selection-visual="position-spacing"`이 붙고, 선택 색상 CSS 변수가 패널 뱃지 색상(`band-1-header=rgba(77, 124, 15, .96)`, `그룹 1=rgba(185, 28, 28, .96)`)과 일치했다.
- 2026-05-11: chrome-devtools MCP 검증. 같은 상태에서 `data-template-frame-position-relation-active`와 `data-template-frame-position-relation-anchor`가 붙은 요소 수는 0개였다. `간격 설정` 닫기 후 `data-v106-frame-selection-visual`은 0개로 정리되어 일반 위치 탭 선택 색상으로 돌아갔다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `node scripts/check-no-shadow-in-app.mjs`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `POSITION-SPACING-SELECTION-LABEL-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-SPACING-SELECTION-LABEL-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-SPACING-SELECTION-LABEL-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-SPACING-SELECTION-LABEL-01` 구현. `간격 설정` 모드의 선택 뱃지는 선택 순서 번호 대신 `data-template-selection-label`을 표시하도록 변경했다. 단일 상자는 frame group id를, 그룹 프록시는 정규화된 그룹 표시명 예: `그룹 1`을 라벨로 사용한다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `간격 설정`을 열고 기존 `band-1-header -> 그룹 1` 간격 행을 클릭했다. 선택 뱃지 `::before` content는 단일 상자 `"band-1-header"`, 그룹 프록시 `"그룹 1"`로 출력되며, 배경색은 각각 패널 뱃지 색상과 일치했다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `node scripts/check-no-shadow-in-app.mjs`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-11: `POSITION-ACTION-OVERLAY-COLLAPSE-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-ACTION-OVERLAY-COLLAPSE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-ACTION-OVERLAY-COLLAPSE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-ACTION-OVERLAY-COLLAPSE-01` 구현. `기능 버튼` 오버레이도 `요약`, `스타일`과 같은 접기/펼치기 상태를 갖도록 변경했다. 기본값은 확장 상태로 유지하며, 헤더 클릭 또는 키보드 Enter/Space로 접고 펼칠 수 있다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL 새로고침 직후 `기능 버튼`은 `기능 버튼 접기 및 위치 이동` 상태로 열려 있고 `상자 생성`, `간격 설정` 버튼이 보였다. 헤더 클릭 후 `기능 버튼 열기 및 위치 이동` 상태로 접히며 하위 버튼은 보이지 않았다. 다시 클릭하면 확장되어 하위 버튼이 다시 보였다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `POSITION-FLOATING-VISIBLE-BOUNDS-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-FLOATING-VISIBLE-BOUNDS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-FLOATING-VISIBLE-BOUNDS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-FLOATING-VISIBLE-BOUNDS-01` 구현. 플로팅 오버레이의 정적 Tailwind corner class를 제거하고, `surfaceShellRef` 영역의 `getBoundingClientRect()`와 viewport 교차 영역을 shell 내부 좌표로 변환해 `left/top/maxWidth`를 계산하도록 변경했다. 스크롤, resize, surface/overlay 크기 변경 시 위치 계산 revision을 갱신한다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `/html/body/main/main/div/div/div[4]/div/div[3]`의 top이 `-258px`, bottom이 `820px`인 상태까지 스크롤했을 때 `요약`과 `스타일` 오버레이는 viewport 기준 top `12px`, `기능 버튼`은 top `56px`에 출력됐다. 즉 전체 preview 영역의 맨 위가 아니라 현재 보이는 preview 영역의 맨 위를 기준으로 출력됐다.
- 2026-05-11: chrome-devtools MCP 검증. 같은 스크롤 상태에서 `요약` 오버레이를 보이는 preview 영역 하단으로 드래그했다. 스냅 후 `요약` bottom은 `808px`이고 보이는 preview bottom은 `820px`으로, 현재 보이는 영역 하단에서 12px inset을 둔 위치에 고정됐다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다. `npm run lint`는 ESLint 9가 현재 repo 위치에서 `eslint.config.*`를 찾지 못해 실행 자체가 실패했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `POSITION-FLOATING-DRAG-PERF-01` 구현 전 백업을 `docs/diff/2026-05-11_POSITION-FLOATING-DRAG-PERF-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_POSITION-FLOATING-DRAG-PERF-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `POSITION-FLOATING-DRAG-PERF-01` 구현. 플로팅 오버레이 드래그 중 `setFloatingOverlayDragStyles` state 갱신 경로를 제거했다. pointer down에서 visible bounds, clamp 범위, shell 좌표를 한 번 계산해 drag ref에 저장하고, pointer move에서는 저장된 숫자로 clamp한 뒤 DOM style `transform: translate3d(...)`와 `width`만 직접 반영한다. pointer up 이후 layout effect에서 임시 drag style을 제거한다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL에서 `요약` 오버레이에 80회 연속 pointer move를 전달했다. 이동 중 style은 `will-change: transform; transform: translate3d(260px, 130px, 0px); width: 72.7109px`로 직접 갱신됐고, pointer up 후 style은 `left/top/max-width`만 남아 `transform`, `will-change`, 직접 `width`가 제거됐다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다. `npm run lint`는 ESLint 9가 현재 repo 위치에서 `eslint.config.*`를 찾지 못해 실행 자체가 실패했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `TEXT-AUTO-HEIGHT-BOX-01` 구현 전 백업을 `docs/diff/2026-05-11_TEXT-AUTO-HEIGHT-BOX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_TEXT-AUTO-HEIGHT-BOX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `TEXT-AUTO-HEIGHT-BOX-01` 구현. `텍스트` 탭의 `텍스트에 맞게 확장` 실행 버튼과 높이/너비 축 선택을 제거하고, 선택 상자에 저장되는 `자동 높이 상자` 속성 토글로 변경했다. 속성은 `data-template-frame-auto-height="true"`와 설정 당시 기본 높이 `data-template-frame-auto-height-base`로 저장한다.
- 2026-05-11: `TEXT-AUTO-HEIGHT-BOX-02` 구현. 자동 높이 상자는 텍스트 입력 컨트롤의 자연 높이를 숨김 복제 요소로 측정하고, `Math.max(기본 높이, 내용 높이)`로 선택 상자 높이를 재계산한다. 선택 상자 높이가 바뀌면 직접 peer가 아닌 아래쪽 상자를 같은 변화량만큼 이동시키되, 그 상자들의 width/height는 변경하지 않는다. 이동한 상자는 relative anchor offset을 새 위치로 즉시 다시 기록한다.
- 2026-05-11: chrome-devtools MCP 검증. 격리 브라우저 컨텍스트에서 대표 URL을 열고 `텍스트` 탭으로 전환한 뒤 `status-history-1`을 선택해 `자동 높이 상자`를 설정했다. 긴 텍스트 입력 시 `status-history-1`은 height `102 -> 245`로 증가했고, `band-5-cell-1..6`은 각각 top `+143`, height 변화 `0`이었다.
- 2026-05-11: chrome-devtools MCP 검증. 같은 상태에서 텍스트를 원래 2줄로 되돌리자 `status-history-1`은 height `245 -> 102`로 기본 높이까지 축소됐고, `band-5-cell-1..6`은 각각 top `-143`, height 변화 `0`으로 원래 위치에 복귀했다. 콘솔 `error`/`warn`은 발견되지 않았다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`가 통과했다. `npm run lint`는 `APP-NOSHADOW-02` 통과 후 ESLint 9 설정 파일(`eslint.config.*`) 부재로 실패했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-11: `TEXT-AUTO-PEER-EDGE-01` 구현 전 백업을 `docs/diff/2026-05-11_TEXT-AUTO-PEER-EDGE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-11_TEXT-AUTO-PEER-EDGE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-11: `TEXT-AUTO-PEER-EDGE-01` 구현. 자동 높이 상자의 bottom 변화는 위치 탭 edge topology snapshot과 resize intent를 사용해 같은 방향/같은 side의 직접 peer를 찾는다. 선택 상자와 직접 peer는 같은 delta로 height를 보정하고, 반대편 또는 아래 행 항목은 height를 유지한 채 top만 이동한다.
- 2026-05-11: `TEXT-AUTO-PEER-EDGE-02` 설계 반영. 자동 크기 정책은 높이와 너비 모두 같은 원칙을 사용한다. 현재 구현된 UI는 자동 높이 상자이므로 bottom peer 보정까지 적용했고, 이후 자동 너비 항목을 제공할 때는 right/left 직접 peer를 같은 방식으로 보정해야 한다.
- 2026-05-11: chrome-devtools MCP 검증. 대표 URL의 격리 브라우저 컨텍스트에서 `텍스트` 탭으로 전환하고 `status-history-1`을 드래그 선택한 뒤 `자동 높이 상자`를 설정했다. 긴 텍스트 입력 시 `status-history-1`은 height `102 -> 245`로 `+143`, 같은 bottom 직접 peer `band-4-cell-2`는 height `47 -> 190`으로 `+143` 증가했다. 아래 행 `band-5-cell-1..6`은 각각 top `+143`, height 변화 `0`이었다.
- 2026-05-11: chrome-devtools MCP 검증. 같은 상태에서 텍스트를 원래 2줄로 줄였을 때 `status-history-1`은 height `245 -> 102`, `band-4-cell-2`는 height `190 -> 47`로 원래 크기에 복귀했다. `band-5-cell-1..6`은 각각 top `-143`, height 변화 `0`으로 원래 위치에 복귀했다.
- 2026-05-11: chrome-devtools MCP 검증. 콘솔 `error`/`warn` 메시지는 없었다. 기존 접근성 issue로 `No label associated with a form field`, `A form field element should have an id or name attribute`만 남아 있으며 이번 자동 높이 peer edge 변경과 직접 관련된 런타임 오류는 아니다.
- 2026-05-11: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다. `npm run lint`는 `APP-NOSHADOW-02` 통과 후 ESLint 9 설정 파일(`eslint.config.*`) 부재로 실패했다.
- 2026-05-11: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
