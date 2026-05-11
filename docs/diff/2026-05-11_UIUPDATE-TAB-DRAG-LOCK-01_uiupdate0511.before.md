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
6. 텍스트 맞춤 확장은 줄임이나 주변 상자의 크기 축소를 하지 않는다. 선택된 대상의 한 축은 커질 수 있으며, 다른 상자의 높이/너비를 줄여 공간을 만들지 않는다.
7. 선택 상자의 확장으로 peer edge, relative anchor, 위치 관계를 보존해야 하는 경우 다른 상자의 위치는 이동할 수 있다. 즉, 주변 상자의 크기 축소는 금지하지만 위치 재배치는 허용한다.
8. 텍스트 맞춤 확장에 영향을 받는 상자가 없다면 선택된 하나의 상자만 변경한다.
9. 예시 기준: `status-history-1`의 높이가 달라질 때, `크기 및 위치` 탭의 edge resize처럼 `band-5-cell-1`, `band-5-cell-2`, `band-5-cell-3`, `band-5-cell-4`, `band-5-cell-5`, `band-5-cell-6`의 높이를 줄이면 안 된다. 단, `status-history-1` 확장 후 peer edge와 위치 관계를 보존하기 위한 해당 상자들의 `top/left` 위치 이동은 허용한다.
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
- 텍스트 자동 확장은 선택 상자 크기 확장과 필요한 위치 관계 보존만 다루며, 위치 탭 edge resize 알고리즘을 재사용해 주변 상자를 줄이는 방식은 금지한다. 주변 상자의 크기는 유지하되 peer edge 또는 relative anchor 보존을 위해 위치를 이동하는 것은 허용한다.
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

### 5.2 기능 B: 텍스트 상자 단독 자동 확장 서비스

#### 기능 목적

텍스트 탭에서 지정 상자의 텍스트 내용과 여백에 맞춰 `height` 또는 `width` 중 하나를 자동으로 늘린다.

#### 단독 서비스로서의 가치

템플릿 편집 화면 밖에서도 텍스트 컨텐츠 기반 박스 크기 계산 서비스로 재사용할 수 있다. 서버 렌더, 배치 템플릿 보정, 외부 API 상품화가 가능하다.

#### 책임 범위

- 선택 상자 ID, 축(`height` 또는 `width`), 텍스트 내용, 글꼴/줄높이/여백/현재 크기를 입력받는다.
- 필요한 목표 크기를 계산한다.
- 목표 크기는 현재 크기보다 작아질 수 없다.
- 주변 상자의 크기 축소는 수행하지 않는다.
- 선택 상자 확장으로 peer edge, relative anchor, 위치 관계 보존이 필요한 경우 주변 상자의 위치 이동 계획을 반환할 수 있다.
- `status-history-1` 같은 단일 상자에 적용할 때 주변 `band-5-cell-*` 높이를 줄이지 않는 결과를 반환한다. 단, 관계 보존을 위한 주변 상자 위치 이동은 반환할 수 있다.

#### 비책임 범위

- 위치 탭 edge resize.
- 다른 상자 축소.
- 다른 상자의 크기 축소를 동반하는 relative anchor 재배치.
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
- 위치 보정 adapter와 직접 결합하지 않는다. 구현에서 `applyRelativeAnchoredFrameRectsInRoot` 또는 유사 위치 재계산이 필요하면, 그 결과가 주변 상자의 `width`/`height`를 줄이지 않는다는 guard를 반드시 둔다.

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

### 6.2 텍스트 탭 자동 높이/너비 확장

#### UI 설계

`renderTextCanvasActionControls()` 내부 `텍스트 설정` 컨트롤에 다음 조작을 추가한다.

- 축 선택 segmented control:
  - `높이 맞춤`
  - `너비 맞춤`
- 실행 버튼:
  - `텍스트에 맞게 확장`

선택이 없으면 비활성화한다. 복수 선택은 허용하되 각 상자별로 독립 계산한다. 단, 최초 구현이 단일 선택만 지원해야 한다고 판단되면 문서에 근거를 남기고 사용자 확인을 다시 받아야 한다.

#### 계산 정책

- `height` 축:
  - 현재 width는 유지한다.
  - 텍스트의 `scrollHeight` 또는 측정 element 높이와 `paddingY`를 합산해 필요한 높이를 계산한다.
  - `nextHeight = Math.max(currentHeight, measuredHeight)`이다.
- `width` 축:
  - 현재 height는 유지한다.
  - 텍스트의 `scrollWidth` 또는 측정 element 너비와 `paddingX`를 합산해 필요한 너비를 계산한다.
  - `nextWidth = Math.max(currentWidth, measuredWidth)`이다.
- 줄임은 하지 않는다.
- 주변 상자 크기 축소는 하지 않는다.
- 선택 상자 확장으로 peer edge, relative anchor, 위치 관계를 보존해야 하면 다른 상자의 위치 이동은 허용한다.
- 적용 후 `syncDraftPreviewHtmlRef({ materializePositionGroups: false })`를 기본으로 하되, 위치 보정이 필요한 경우에는 크기 축소 금지 guard를 통과한 보정 결과만 materialize한다.
- 이 자동 확장 경로에서는 위치 탭 edge resize처럼 반대편 상자를 줄이는 알고리즘을 호출하지 않는다.
- 상대 위치 anchor 자체를 깨지 않기 위해, 선택 상자의 크기 확장과 주변 상자의 위치 보정은 같은 transaction으로 계산한다.
- 주변 peer 보정은 `width`/`height` 축소 없이 `left`/`top` 이동만 허용한다.

#### `status-history-1` 검증 기준

대표 템플릿에서 `status-history-1`을 선택하고 높이 맞춤을 실행한다.

- `status-history-1`의 height는 현재값 이상으로만 변경된다.
- `band-5-cell-1`, `band-5-cell-2`, `band-5-cell-3`, `band-5-cell-4`, `band-5-cell-5`, `band-5-cell-6`의 height는 실행 전보다 작아지면 실패다.
- `band-5-cell-1..6`의 위치는 peer edge와 위치 관계를 보존하기 위해 이동할 수 있다.
- 변경 대상이 `status-history-1` 하나뿐인 경우 다른 상자의 width/height는 바뀌지 않아야 한다. 다른 상자의 `left/top` 변화는 위치 관계 보존 목적일 때만 허용한다.

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
| `UIUPDATE-TAB-DRAG-LOCK-01` | 탭별 이동/리사이즈 제한 구현 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UIUPDATE-TAB-DRAG-LOCK-01_*` | 대기 |
| `UIUPDATE-TAB-DRAG-LOCK-02` | `텍스트`/`속성` 탭에서는 move drag 시작을 차단한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-TAB-DRAG-LOCK-03` | `텍스트`/`속성` 탭에서는 resize handle/edge resize 시작을 차단한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-TEXT-AUTOSIZE-01` | 텍스트 자동 확장 구현 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UIUPDATE-TEXT-AUTOSIZE-01_*` | 대기 |
| `UIUPDATE-TEXT-AUTOSIZE-02` | 텍스트 탭에 높이/너비 중 하나를 선택하는 자동 확장 UI를 추가한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-TEXT-AUTOSIZE-03` | 선택 상자는 현재 크기 이상으로 확장하고, 주변 상자는 크기를 줄이지 않되 필요한 위치 이동은 허용하는 적용 경로를 구현한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-TEXT-AUTOSIZE-04` | `status-history-1` 확장 시 `band-5-cell-1..6`의 크기는 줄어들지 않고 위치 이동만 허용됨을 검증한다. | 테스트 기록 | 대기 |
| `UIUPDATE-POSITION-ACTIONS-01` | 위치 탭 액션 버튼 구현 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UIUPDATE-POSITION-ACTIONS-01_*` | 대기 |
| `UIUPDATE-POSITION-ACTIONS-02` | 선택 상태에 따라 `상자 생성`, `간격 설정`, `그룹 만들기`, `그룹 해제`, `그룹에서 제외`, `그룹에 포함`을 조건부 출력한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-POSITION-ACTIONS-03` | `그룹에서 제외` 모드를 구현하고 `Esc`/`x`/`q`/화면 `x` 종료를 지원한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-POSITION-ACTIONS-04` | `그룹에 포함` 모드를 구현하고 `Esc`/`x`/`q`/화면 `x` 종료를 지원한다. | `TemplateEditWorkspace.before.tsx` | 대기 |
| `UIUPDATE-VERIFY-01` | 정적 검증, chrome-devtools MCP 검증, Supabase MCP 제한 사항을 기록한다. | 테스트 기록 | 대기 |

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
7. `status-history-1`을 선택하고 높이 맞춤을 실행한다.
8. 실행 전후 `status-history-1`의 height와 `band-5-cell-1..6`의 height를 비교한다. `status-history-1`은 커질 수 있고, `band-5-cell-1..6`은 작아지면 실패다. 단, `band-5-cell-1..6`의 `left/top` 위치 이동은 peer edge와 위치 관계 보존 목적이면 허용한다.
9. `크기 및 위치` 탭에서 선택 없음 상태를 확인한다. `상자 생성`, `간격 설정`만 출력되어야 한다.
10. 복수 상자 선택 상태를 확인한다. `그룹 만들기`, `그룹에 포함`, `간격 설정`이 출력되어야 한다.
11. 그룹 선택 포함 상태를 확인한다. `그룹 해제`, `그룹에서 제외`, `그룹에 포함`, `간격 설정`이 출력되어야 한다.
12. `그룹에서 제외` 모드 진입 후 `Esc`, `x`, `q`, 화면 `x` 버튼으로 종료되는지 확인한다.
13. `그룹에 포함` 모드 진입 후 `Esc`, `x`, `q`, 화면 `x` 버튼으로 종료되는지 확인한다.

### 9.3 Supabase MCP 검증

- 이번 변경은 DB 스키마 또는 DB 데이터 수정을 포함하지 않는다.
- Supabase MCP가 노출되면 DB migration 또는 write query가 없음을 확인한다.
- Supabase MCP가 노출되지 않으면 이 문서 테스트 기록에 `세션에 supabase MCP 도구가 노출되지 않음. DB 변경 없음`으로 남긴다.

## 10. 테스트 기록

- 2026-05-11: `UIUPDATE-DESIGN-01` 완료. 이 문서는 설계 문서 작성만 수행했으며 앱 코드 구현은 하지 않았다.
- 2026-05-11: `src/components/template/TemplateEditWorkspace.tsx`와 `src/lib/templateExtractEditableTextFit.ts`를 읽어 현재 포인터 처리, 텍스트 fit, 위치 탭 버튼 구조를 확인했다.
- 2026-05-11: 코드 변경이 없으므로 chrome-devtools MCP 동작 검증과 Supabase MCP 검증은 구현 단계에서 수행한다.
- 2026-05-11: `UIUPDATE-DESIGN-02` 반영. 텍스트 맞춤 확장은 다른 상자의 `width`/`height` 축소를 금지하지만, peer edge와 위치 관계 보존을 위한 다른 상자의 `left/top` 위치 이동은 허용하도록 설계를 수정했다.
