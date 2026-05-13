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
| `TEXT-AUTO-SIZE-MODE-DIRECTION-01` | 텍스트 탭의 자동 크기 선택을 `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 3개 모드로 바꾼다. `자동 높이 상자`는 `위로 확장`, `아래로 확장` 세로 기준만 저장하고, `자동 너비 상자`는 `왼쪽으로 확장`, `오른쪽으로 확장` 가로 기준만 저장한다. | `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION-01_*` | 완료 |
| `TEXT-AUTO-SIZE-MODE-DIRECTION-02` | 자동 너비 상자는 텍스트 내용과 여백 기준으로 width를 동적 재계산한다. 기본 기준은 `오른쪽으로 확장`이며, 직접 peer가 있으면 같은 right edge 기준 peer를 같은 delta로 보정하고 직접 peer가 아닌 주변 상자는 크기를 줄이지 않는다. | `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `TEXT-AUTO-SIZE-MODE-DIRECTION-FIT-01` | 자동 높이 상자가 선택된 경우 방향 버튼은 `위로 확장`, `아래로 확장`, `너비 내용에 맞추기`만 출력한다. 자동 너비 상자가 선택된 경우 방향 버튼은 `왼쪽으로 확장`, `오른쪽으로 확장`, `높이 내용에 맞추기`만 출력한다. 반대 축 방향은 UI에 표시하지 않고 저장 로직에서도 무시한다. | `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION_FIT-01_*` | 완료 |
| `TEXT-AUTO-SIZE-SECONDARY-FIT-01` | `너비 내용에 맞추기`는 자동 높이 상자의 현재 높이 자동 속성을 유지한 채 width만 내용 기준으로 맞춘다. `높이 내용에 맞추기`는 자동 너비 상자의 현재 너비 자동 속성을 유지한 채 height만 내용 기준으로 맞춘다. 이 보조 맞춤도 기존 relative anchor와 그룹 간 간격 보존 경로를 거친다. | `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION_FIT-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `TEXT-SECONDARY-HEIGHT-FIT-PADDING-01` | `높이 내용에 맞추기`는 textarea 기본 2행 높이나 현재 화면 높이를 내용 높이로 간주하지 않는다. 계산 기준은 `위 여백 + 실제 텍스트 줄 높이 + 아래 여백 + border`이며, 불필요한 빈 줄 여백을 만들지 않는다. | `docs/diff/2026-05-12_TEXT_SECONDARY_HEIGHT_FIT_PADDING-01_*` | 완료 |
| `POSITION-STYLE-SIZE-ANCHOR-01` | `크기 및 위치` 탭의 `스타일` 높이/너비 입력은 텍스트 탭에서 저장한 자동 크기 방향을 같은 축의 리사이즈 방향으로 사용한다. 저장 방향이 없거나 다른 축의 방향만 있으면 너비는 왼쪽 고정, 높이는 위쪽 고정 기준으로 처리한다. | `docs/diff/2026-05-12_POSITION_STYLE_SIZE_ANCHOR_EXACT-01_TemplateEditWorkspace.before.tsx` | 완료 |
| `POSITION-STYLE-SIZE-EXACT-01` | `크기 및 위치` 탭에서 사용자가 명시적으로 입력한 width/height 축은 즉시 자동 크기 재계산으로 덮어쓰지 않는다. 자동 높이/자동 너비 상자라면 실제 적용된 값을 새 base 값으로 저장해 이후 입력 변화의 기준으로 삼는다. | `docs/diff/2026-05-12_POSITION_STYLE_SIZE_ANCHOR_EXACT-01_*` | 완료 |
| `TEXT-AUTOSIZE-SPACING-01` | 텍스트 탭 자동 높이/자동 너비 재계산 전 기존 `간격 설정`의 frame/group anchor 값을 스냅샷으로 보관하고, 크기/peer 이동 계산 뒤 스냅샷을 복원한 다음 relative anchor를 전체 적용한다. 자동 크기 계산 중 임시로 갱신된 offset 때문에 기존 간격 설정이 무시되면 안 된다. | `docs/diff/2026-05-12_TEXT_AUTOSIZE_SPACING_ICON_SCALE-01_*` | 완료 |
| `TEXT-AUTOSIZE-GROUP-SPACING-01` | 자동 높이/자동 너비로 기준 그룹 크기가 바뀌어도 그 그룹을 기준으로 저장된 그룹 간 간격은 유지한다. 자동 크기 계산 전 그룹 wrapper rect를 저장하고, 변경 후 기존 gap만큼 target offset을 재계산한다. | `docs/diff/2026-05-12_AUTO_SIZE_GROUP_SPACING_INPUT_FOCUS-01_*` | 완료 |
| `TEXT-AUTOSIZE-INPUT-FOCUS-01` | 자동 크기 상자 입력 중에는 매 글자마다 React DOM version/히스토리 갱신을 일으키지 않는다. 입력 직후 같은 textarea와 caret 위치를 복원해 100자 입력 및 100자 붙여넣기 반복 중 포커스가 빠지지 않게 한다. | `docs/diff/2026-05-12_AUTO_SIZE_GROUP_SPACING_INPUT_FOCUS-01_*` | 완료 |
| `TEXT-INPUT-DRAG-SELECTION-01` | 텍스트 탭에서 실제 입력창 위 pointer/click은 브라우저 기본 caret/텍스트 드래그 선택을 보존한다. 입력창 직접 클릭 중에는 `setSelectionRange(end, end)`를 재실행하지 않는다. | `docs/diff/2026-05-12_TEXT-INPUT-DRAG-SELECTION-01_*` | 완료 |
| `NON-TEXT-BOX-DRAG-RESTORE-01` | 텍스트 입력창 드래그 선택 보호는 `텍스트` 탭에만 한정한다. `속성`, `크기 및 위치` 등 텍스트 외 탭의 상자 위 드래그 선택 경로를 텍스트 입력 보호 로직으로 막지 않는다. | `docs/diff/2026-05-12_NON_TEXT_BOX_DRAG_RESTORE-01_*` | 완료 |
| `BOX-MARQUEE-SELECTION-RESTORE-01` | `속성`, `크기 및 위치` 탭의 선택 모드에서는 상자 위에서 시작한 드래그도 캔버스 드래그 선택으로 처리한다. `속성` 탭은 상자 이동으로 해석하지 않는다. | `docs/diff/2026-05-12_BOX_MARQUEE_SELECTION_RESTORE-01_*` | 완료 |
| `METADATA-TEXT-ACTION-OVERLAY-01` | `속성` 탭의 상자명, 상자 역할 1/2, 선택 항목 액션과 `텍스트` 탭의 텍스트 설정을 기존 탭 본문이 아니라 미리보기 표면의 플로팅 action 오버레이에 출력한다. `Runtime Mode` 표기는 `상세 기능`으로 교체한다. | `docs/diff/2026-05-12_METADATA_TEXT_ACTION_OVERLAY-01_*` | 완료 |
| `METADATA-TEXT-STYLE-POSITION-01` | `속성`/`텍스트` 탭의 우측 플로팅 설정은 `크기 및 위치` 탭의 `스타일` 오버레이 기준점에 출력한다. 텍스트 탭 선택 안내를 제거하고, 자동 높이는 `자동 높이 상자`/`고정 높이 상자` 2개 상태 버튼으로만 출력한다. | `docs/diff/2026-05-12_METADATA_TEXT_STYLE_POSITION-01_*` | 완료 |
| `METADATA-SPLIT-FLOATING-OVERLAYS-01` | `속성` 탭의 `상자명`, `상자 역할 - 1`, `상자 역할 - 2`를 `기능 버튼` 내부 섹션이 아니라 `기능 버튼`과 같은 위계의 독립 플로팅 오버레이로 분리한다. 같은 사분면에서는 세 오버레이가 위에서 아래로 쌓여야 한다. | `docs/diff/2026-05-12_METADATA_SPLIT_FLOATING_OVERLAYS-01_*` | 완료 |
| `FLOATING-OVERLAY-TAB-PERF-01` | 탭 전환 시 플로팅 오버레이 본문을 즉시 모두 렌더하지 않고, 접힌 오버레이는 헤더만 렌더한다. `크기 및 위치` 탭의 `스타일` 오버레이를 복구하고, `스타일`/`기능 버튼` 및 `상자명`/`상자 역할 - 1`/`상자 역할 - 2`는 확장 시 서로를 밀어내야 한다. | `docs/diff/2026-05-12_FLOATING_OVERLAY_TAB_PERF-01_*` | 완료 |
| `OVERLAY-STACK-AND-TAB-PERF-01` | 하단 사분면에 스냅된 오버레이도 같은 위계의 다른 오버레이와 겹치지 않게 위로 밀어낸다. `속성`/`텍스트` 탭 전환 시 위치 탭 전용 edge button/relative anchor 재계산을 실행하지 않고, 관계선/메타데이터 마커/텍스트 편집 권한은 signature로 중복 적용을 건너뛴다. | `docs/diff/2026-05-12_OVERLAY_STACK_AND_TAB_PERF-01_*` | 완료 |
| `CANVAS-INTERACTION-IMMEDIATE-PERF-01` | 상자/그룹 선택, 텍스트 입력, 상자 이동, 엣지 이동 같은 고빈도 편집 동작은 먼저 live DOM에 즉시 반영하고, React 패널 상태/HTML 직렬화/edge UI 전체 재계산은 고빈도 이벤트 경로에서 분리한다. | `docs/diff/2026-05-12_CANVAS_INTERACTION_IMMEDIATE_PERF-01_*` | 완료 |
| `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` | 배경색, 글자색, 선색, 코너 라운딩처럼 레이아웃 측정에 영향을 주지 않는 시각 스타일은 자동 높이/너비 재계산, relative anchor 재적용, preview HTML 재렌더를 실행하지 않는다. 특정 상자 ID 예외가 아니라 스타일 변경의 성격으로 분기한다. | `docs/diff/2026-05-12_VISUAL_STYLE_NO_GEOMETRY_REFLOW-01_*` | 완료 |
| `POSITION-SHIFT-DRAG-MARQUEE-01` | `크기 및 위치` 탭에서 상자/그룹 위 `Shift+드래그`는 상자 이동이나 즉시 `Shift+클릭` 확정이 아니라 드래그 범위에 걸린 상자/그룹만 기존 선택에 추가한다. 드래그 없이 놓으면 기존 `Shift+클릭` 순환 선택으로 처리한다. | `docs/diff/2026-05-12_POSITION_SHIFT_DRAG_MARQUEE-01_*` | 완료 |
| `TEMPLATE-USAGE-PREVIEW-MODE-01` | 상자 편집 캔버스 툴바 맨 왼쪽에 실제 사용 미리보기 토글을 둔다. 토글 상태에서는 투명 항목을 실제 출력처럼 보이고, `value`/`key_value` 상자의 템플릿 편집용 텍스트는 비운다. 사용자는 임시 텍스트 입력, 파일 선택, 서명 입력으로 UI를 점검할 수 있지만 이 입력은 draft HTML과 DB 저장 경로에 반영하지 않는다. | `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_MODE-01_*` | 완료 |
| `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` | 실제 사용 미리보기에서 빈 `value` 상자는 key/id/placeholder를 보이면 안 된다. 서명 상자는 점선 테두리 같은 보조 시각화를 추가하지 않는다. 첨부파일 상자는 기본 출력 상태에서 파일명 텍스트만 보이고, 편집 상태에서만 `+`와 삭제 버튼으로 다중 파일을 추가/제거할 수 있어야 한다. 등록된 파일명은 `파일명.확장자` 줄 목록으로 표시한다. | `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_VALUE_ATTACHMENT_SIGNATURE-01_*` | 완료 |
| `TEMPLATE-USAGE-PREVIEW-AUTOSIZE-01` | 실제 사용 미리보기의 runtime 입력은 저장을 막더라도 자동 높이/자동 너비 계산은 계속 실행해야 한다. 텍스트 입력, contenteditable 입력, 첨부파일명 변경은 임시 preview DOM 안에서만 `applyTemplateAutoSizeBoxes`를 실행하고 draft HTML/DB 저장 경로에는 반영하지 않는다. | `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_AUTOSIZE-01_*` | 완료 |
| `TEXT-CONTENTEDITABLE-AUTOSIZE-01` | 일반 편집 경로에서도 auto-size 대상이 `textarea/input`만이 아니라 `data-template-edit-scope` 기반 contenteditable 상자를 포함해야 한다. `텍스트` 탭 입력 중 auto height/width 상자는 입력 DOM 종류와 무관하게 `applyTemplateAutoSizeBoxes`를 실행하고, 저장 직렬화는 기존 live DOM 경로를 유지한다. | `docs/diff/2026-05-12_TEXT_CONTENTEDITABLE_AUTOSIZE-01_*` | 완료 |
| `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` | 같은 행 또는 같은 열을 공유하는 자동 높이/자동 너비 상자는 개별 순서로 따로 늘리지 않고 peer cluster 단위로 한 번에 계산한다. 공용 높이/너비는 cluster 안 각 상자의 요구치 최대값으로 적용해야 하며, preview root가 붙는 즉시 한 번 더 초기 autosize 정규화를 실행해 새로고침 직후 잘린 상태를 남기지 않는다. | `docs/diff/2026-05-12_AUTOSIZE_RELATIVE_OFFSET_FIX-01_*` | 완료 |
| `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` | 자동 높이/자동 너비 상자의 확장 방향 전환은 현재 크기와 위치를 바꾸지 않고 anchor 속성만 바꿔야 한다. 다만 이후 실제 입력으로 auto-size가 다시 실행될 때는 top/left anchor에서도 같은 row/column peer cluster가 함께 커지거나 줄어야 한다. | `docs/diff/2026-05-12_TEXT_AUTOSIZE_ANCHOR_SWITCH_STABLE-01_*` | 완료 |
| `METADATA-OVERLAY-FLAT-CONTENT-01` | `속성` 탭의 `상자명`, `상자 역할 - 1`, `상자 역할 - 2` 오버레이 내부에서 다시 `border/background/padding` 카드로 감싸는 상자 안 상자 구조를 제거하고, 오버레이 본문에 컨트롤을 바로 배치한다. | `docs/diff/2026-05-12_METADATA_OVERLAY_FLAT_CONTENT-01_*` | 완료 |
| `METADATA-MULTI-SELECTION-STATE-01` | `속성` 탭 복수 선택에서는 `상자명` 오버레이를 숨기고, `상자 역할 - 1`/`상자 역할 - 2`는 선택된 상자들의 서로 다른 실제 설정값을 모두 활성 상태로 표시한다. 0개 선택에서는 기존처럼 `상자명` 오버레이와 비활성 안내를 유지한다. | `docs/diff/2026-05-12_METADATA_MULTI_SELECTION_STATE-02_*` | 완료 |
| `METADATA-SELECTION-ROLE-COLORS-01` | `속성` 탭 선택 상자는 `상자 역할 - 1` 값으로 윤곽선 색을, `상자 역할 - 2` 값으로 padding 없는 내부 배경색을 출력한다. `상자 역할 - 1/2` 활성 버튼은 테두리/링 없이 단일 색상으로 표시한다. | `docs/diff/2026-05-12_METADATA_SELECTION_ROLE_COLORS-01_*` | 완료 |
| `SELECTION-CENTERED-BORDER-AND-METADATA-BG-01` | `크기 및 위치`, `속성`, `텍스트` 탭의 선택선은 outline 외곽선이 아니라 경계선 중심 기준의 바깥 1px/안쪽 1px box-shadow로 출력한다. `속성` 탭 선택 배경은 `상자 역할 - 2` 활성 버튼과 같은 Tailwind 색상 변수로 실제 상자 배경에 출력하고, 선택 fill은 숨겨 내용 위에 올라오지 않게 한다. | `docs/diff/2026-05-12_SELECTION_CENTERED_BORDER_AND_METADATA_BG-01_*` | 완료 |
| `METADATA-ROLE2-BG-OPACITY-01` | `속성` 탭 선택 상자의 `상자 역할 - 2` 배경은 기존 역할 색상을 유지하되 실제 상자 뒤 배경의 불투명도를 30% 수준으로 낮춘다. 선택선과 역할-1 윤곽선 색상은 변경하지 않는다. | `docs/diff/2026-05-12_METADATA_ROLE2_BG_OPACITY-01_*` | 완료 |
| `SELECTION-BADGE-SIZE-50-01` | 상자와 그룹 선택 시 출력되는 선택 순서 번호 뱃지는 기존 대비 약 50% 크기로 줄인다. 간격 설정 모드의 항목명 라벨 뱃지는 번호 뱃지가 아니므로 기존 가독성 크기를 유지한다. | `docs/diff/2026-05-12_SELECTION_BADGE_SIZE_50-01_*` | 완료 |
| `CANVAS-ICON-SCALE-01` | `상자 편집 캔버스` 툴바에 `S/M/L` 크기 전환을 추가한다. 현재 작아진 선택 번호 뱃지를 `S` 기준으로 삼고, 선택 번호/삭제 버튼/아이콘 켜기에서 보이는 상자 역할 아이콘은 같은 높이 변수로 즉시 크기가 바뀌어야 한다. | `docs/diff/2026-05-12_TEXT_AUTOSIZE_SPACING_ICON_SCALE-01_*` | 완료 |
| `CANVAS-ICON-SCALE-02` | 캔버스 아이콘 크기 기본값은 `M`이어야 한다. 사용자가 별도 선택하지 않으면 선택 번호/삭제/상자 종류/역할 아이콘은 `M` 크기로 표시한다. | `docs/diff/2026-05-12_ICON_M_DEFAULT_GROUP_DELETE-01_*` | 완료 |
| `POSITION-GROUP-DELETE-01` | `크기 및 위치` 탭에서 그룹 선택 프록시에도 삭제 아이콘을 표시한다. 이 삭제는 그룹 관계와 그룹 기준점만 제거하며, 하위 상자나 하위 그룹은 삭제하지 않고 상위 위계로 올려 유지한다. | `docs/diff/2026-05-12_ICON_M_DEFAULT_GROUP_DELETE-01_*` | 완료 |
| `POSITION-SELECTION-CYCLE-RESTORE-01` | `크기 및 위치` 탭 선택 모드에서 상자 위 클릭은 드래그 선택 준비보다 순환 선택을 먼저 적용한다. 같은 pointerdown에서 클릭 후 드래그로 이어질 때만 현재 선택을 기준으로 마퀴 선택을 시작해, 최상위 그룹 -> 하위 그룹 -> 최하위 상자 순환 선택이 깨지지 않게 한다. | `docs/diff/2026-05-12_POSITION_CYCLE_RESTORE-01_*` | 완료 |
| `METADATA-ROLE3-CONNECTION-OVERLAY-01` | `속성` 탭의 `상자 역할 - 2`는 상위 키/하위 값/독립 값 선택만 담당한다. 기존 연결 CTA와 연결 편집 UI는 독립 오버레이 `상자 연결`으로 분리하고, CTA 위에는 선택 상자의 현재 연결 상태와 해당 CTA가 필요한 이유를 쉬운 말로 줄 구분 출력한다. | `docs/diff/2026-05-12_METADATA_ROLE3_CONNECTION_OVERLAY-01_*` | 완료 |
| `METADATA-CONNECTION-LABEL-01` | `상자 역할 - 3` 오버레이의 사용자 표시명만 `상자 연결`로 변경한다. 내부 슬롯명과 기존 연결 동작은 유지한다. | `docs/diff/2026-05-12_METADATA_CONNECTION_LABEL-01_*` | 완료 |
| `FLOATING-OVERLAY-TAB-ORDER-STACK-01` | 모든 탭의 플로팅 오버레이 스택에 `요약`을 포함한다. 같은 사분면에 있을 때 `속성`: `요약 -> 상자명 -> 상자 역할 - 1 -> 상자 역할 - 2 -> 상자 연결`, `크기 및 위치`: `요약 -> 스타일 -> 기능 버튼`, `텍스트`: `요약 -> 텍스트 설정` 순서로 서로를 밀어내며 겹치지 않게 한다. | `docs/diff/2026-05-12_FLOATING_OVERLAY_TAB_ORDER_STACK-01_*` | 완료 |
| `TEMPLATE-USAGE-PREVIEW-INDEPENDENT-PADDING-01` | 실제 사용 미리보기에서 runtime 입력으로 바뀌는 대상은 `value` 상자만이다. `독립 값(key_value)`은 `key`처럼 그대로 보여야 하며 수정 불가 상태를 유지한다. 첨부파일/서명 같은 non-text runtime control도 기존 상자 여백을 이어받아야 하고, 미리보기 on/off 전후로 편집 캔버스의 상자 `top/left/width/height`는 바뀌면 안 된다. | `docs/diff/2026-05-12_PREVIEW_PADDING_EDGE_CORNER_01_*` | 완료 |
| `TEXT-PADDING-PER-SIDE-01` | `텍스트 설정`의 여백 UI는 `상/하/좌/우` 대상 버튼과 단일 `?px` 입력 하나로 동작해야 한다. 선택한 변에 공통 값이 있으면 숫자를 보여주고, 서로 다른 값이면 `?` placeholder를 보여주며, blur/tab 시점에만 반영한다. | `docs/diff/2026-05-12_PREVIEW_PADDING_EDGE_CORNER_01_*` | 완료 |
| `POSITION-STYLE-EDGE-CORNER-TARGET-01` | `크기 및 위치 > 스타일`은 상단 인라인 컨트롤을 박스 위 가운데에 둔다. 박스 미리보기에서 `상/우/하/좌` 엣지와 `좌상/우상/우하/좌하` 코너를 직접 선택할 수 있어야 하며, 선택된 엣지 집합에만 선 두께/선 색/선 타입을, 선택된 코너 집합에만 코너 라운딩을 적용한다. | `docs/diff/2026-05-12_PREVIEW_PADDING_EDGE_CORNER_01_*` | 완료 |

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
- 2026-05-12: `TEXT-INPUT-DRAG-SELECTION-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT-INPUT-DRAG-SELECTION-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT-INPUT-DRAG-SELECTION-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-INPUT-DRAG-SELECTION-01` 구현. 텍스트 탭에서 pointer/click 대상이 실제 `[data-template-frame-input="true"]` 입력창이면 입력 가능 상태만 보장하고, 기존 `focusFrameTextInputForEditing*`의 커서 끝 이동 경로를 실행하지 않도록 했다. 상자 배경 클릭으로 입력 모드에 진입하는 경우에는 기존처럼 입력창 끝으로 포커스한다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL을 격리 컨텍스트에서 열고 `텍스트` 탭으로 전환했다. 실제 `textarea[data-template-frame-input="true"]`에 selection range `2..10`을 만든 뒤 pointerdown/pointerup/click 이벤트를 입력창 위에 전달하고 150ms 대기했다. 결과는 `selectionStart=2`, `selectionEnd=10`, 선택 텍스트 유지, 입력창 focus 유지, `readOnly=false`였다.
- 2026-05-12: chrome-devtools MCP 검증. 콘솔 `error`/`warn` 메시지는 없었다. 기존 접근성 issue로 `No label associated with a form field`, `A form field element should have an id or name attribute`만 남아 있으며 이번 텍스트 드래그 선택 수정과 직접 관련된 런타임 오류는 아니다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다. `npm run lint`는 `APP-NOSHADOW-02` 통과 후 ESLint 9 설정 파일(`eslint.config.*`) 부재로 실패했다.
- 2026-05-12: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-12: `NON-TEXT-BOX-DRAG-RESTORE-01` 구현 전 백업을 `docs/diff/2026-05-12_NON_TEXT_BOX_DRAG_RESTORE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_NON_TEXT_BOX_DRAG_RESTORE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `NON-TEXT-BOX-DRAG-RESTORE-01` 구현. 텍스트 입력창 직접 조작을 보호하는 조건이 다른 탭의 드래그 선택을 막지 않도록 범위를 `텍스트` 탭으로 좁혔다. 좌표가 `.v202-frame-group` 직접 target이 아닌 band 내부 DIV에 걸린 경우도 `속성` 탭에서 상자 선택 대상으로 해석되도록 비-위치 탭의 좌표 기반 frame 탐색을 복구했다.
- 2026-05-12: `BOX-MARQUEE-SELECTION-RESTORE-01` 구현 전 백업을 `docs/diff/2026-05-12_BOX_MARQUEE_SELECTION_RESTORE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_BOX_MARQUEE_SELECTION_RESTORE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `BOX-MARQUEE-SELECTION-RESTORE-01` 구현. `속성` 탭의 상자 위 드래그는 이동이 아니라 마퀴 선택으로 처리하도록 되돌렸다. `크기 및 위치` 탭의 선택 모드에서도 상자 위에서 시작한 드래그가 마퀴 선택으로 들어가며, 이동은 이동 모드에서만 실행한다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL 새로고침 후 선택 모드에서 `속성` 탭 `band-3-cell-1`부터 `band-5-cell-6`까지 상자 위 pointer drag를 실행했다. 결과는 선택 6개, 시작 상자 이동 없음이었다. 같은 절차를 `크기 및 위치` 탭 `band-6-cell-1`부터 `band-8-cell-4`까지 적용했을 때도 선택 6개, 시작 상자 이동 없음이었다.
- 2026-05-12: chrome-devtools MCP 검증. `텍스트` 탭의 실제 textarea에서는 selection range `2..10`이 pointerup/click 이후에도 유지되어, 텍스트 드래그 선택 보호가 계속 동작함을 확인했다.
- 2026-05-12: chrome-devtools MCP 검증. 콘솔 `error`/`warn` 메시지는 없었다. 기존 접근성 issue로 `No label associated with a form field`, `A form field element should have an id or name attribute`만 남아 있으며 이번 드래그 복구와 직접 관련된 런타임 오류는 아니다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다. `npm run lint`는 `APP-NOSHADOW-02` 통과 후 ESLint 9 설정 파일(`eslint.config.*`) 부재로 실패했다.
- 2026-05-12: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-12: `METADATA-TEXT-ACTION-OVERLAY-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_TEXT_ACTION_OVERLAY-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_TEXT_ACTION_OVERLAY-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-TEXT-ACTION-OVERLAY-01` 구현. `속성` 탭의 상자명, 상자 역할 1, 상자 역할 2/선택 항목 액션을 `TemplateEditPreviewSurface`의 action 오버레이로 이동했다. `텍스트` 탭의 텍스트 설정도 같은 action 오버레이로 이동했고, 기존 탭 본문 렌더링은 제거했다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `chrome-devtools/list_pages`가 `Transport closed`로 실패해 MCP 브라우저 검증을 완료하지 못했다. 이어서 `localhost:3001` 접속과 개발 서버 실행을 시도했으나 현재 세션 샌드박스가 `listen EPERM`으로 포트 바인딩을 차단했다.
- 2026-05-12: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-12: `METADATA-TEXT-STYLE-POSITION-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_TEXT_STYLE_POSITION-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_TEXT_STYLE_POSITION-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-TEXT-STYLE-POSITION-01` 구현. action 오버레이는 `스타일` 오버레이가 같이 있을 때만 아래로 밀리도록 위치 계산을 변경했다. 따라서 `속성`/`텍스트` 탭에서는 같은 `top-right` 기준점에 출력되고, `크기 및 위치` 탭에서는 기존처럼 `스타일` 아래에 `기능 버튼`이 쌓인다.
- 2026-05-12: `METADATA-TEXT-STYLE-POSITION-01` 구현. `텍스트` 탭의 선택 안내 배지를 제거했다. 자동 높이 UI는 선택이 있을 때만 `자동 높이 상자`/`고정 높이 상자` 버튼을 출력하며, 전체 자동/전체 고정/혼합 상태에 따라 활성 색상을 반영한다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `chrome-devtools/list_pages`가 `Transport closed`로 실패해 MCP 브라우저 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-12: `FLOATING-OVERLAY-TAB-PERF-01` 구현 전 백업을 `docs/diff/2026-05-12_FLOATING_OVERLAY_TAB_PERF-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_FLOATING_OVERLAY_TAB_PERF-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `FLOATING-OVERLAY-TAB-PERF-01` 구현. 플로팅 오버레이 content prop을 `ReactNode | () => ReactNode`로 확장해 접힘 상태에서는 본문 생성 자체를 지연한다. `속성` 탭의 세 오버레이 기본 상태를 접힘으로 변경해 탭 진입 시 헤더만 즉시 출력한다.
- 2026-05-12: `FLOATING-OVERLAY-TAB-PERF-01` 구현. 매 렌더마다 새로 만들던 overlay stack 객체/배열을 제거하고, 고정 stack order와 switch 기반 조회 함수로 위치 계산을 단순화했다. `크기 및 위치` 탭의 `스타일` 오버레이는 position 탭에서 lazy content로 전달해 collapsed 헤더가 항상 렌더되도록 복구했다.
- 2026-05-12: `POSITION-STYLE-OVERLAY-RESTORE-01` 보정. `크기 및 위치` 탭의 `스타일` 오버레이는 기존 렌더링 계약처럼 `ReactNode`로 직접 전달한다. `속성` 탭 세 오버레이는 lazy content를 유지하되, `스타일`은 lazy 함수 전달에서 제외해 표시 누락을 막는다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `chrome-devtools/list_pages`가 `Transport closed`로 실패해 MCP 브라우저 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-12: `METADATA-SPLIT-FLOATING-OVERLAYS-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_SPLIT_FLOATING_OVERLAYS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_SPLIT_FLOATING_OVERLAYS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-SPLIT-FLOATING-OVERLAYS-01` 구현. `TemplateEditPreviewSurface`에 `metadataName`, `metadataRolePrimary`, `metadataRoleSecondary` 플로팅 오버레이 슬롯을 추가했다. `속성` 탭에서는 action 오버레이를 비우고, 세 항목을 각각 독립 오버레이로 전달한다.
- 2026-05-12: `METADATA-SPLIT-FLOATING-OVERLAYS-01` 구현. 메타데이터 오버레이 세 개가 같은 top 사분면에 있을 때 이전 오버레이의 실제 높이와 inset을 기준으로 아래로 쌓이도록 위치 계산을 일반화했다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `chrome-devtools/list_pages`가 `Transport closed`로 실패해 MCP 브라우저 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `tool_search`로 Supabase MCP 도구를 탐색했으나 세션에 Supabase namespace가 노출되지 않았다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다.
- 2026-05-12: `OVERLAY-STACK-AND-TAB-PERF-01` 구현 전 백업을 `docs/diff/2026-05-12_OVERLAY_STACK_AND_TAB_PERF-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_OVERLAY_STACK_AND_TAB_PERF-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `OVERLAY-STACK-AND-TAB-PERF-01` 구현. 플로팅 오버레이 stack 계산을 top 전용에서 top/bottom 공통으로 바꿨다. bottom 사분면은 뒤 순서 오버레이 높이만큼 위로 밀어 `상자명`, `상자 역할 - 1`, `상자 역할 - 2`가 서로 겹치지 않는다.
- 2026-05-12: `OVERLAY-STACK-AND-TAB-PERF-01` 구현. `속성`/`텍스트` 탭에서는 위치 탭 전용 edge button 생성, position group materialize, relative anchor 정규화, edge topology snapshot 생성을 건너뛴다. 탭 전환 반복 렌더에서는 메타데이터 관계선, 마커, 텍스트 편집 권한을 signature로 재사용한다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL에서 새로고침 후 `속성`/`텍스트`/`크기 및 위치`를 직접 전환했다. `속성` 오버레이는 `요약`, `상자명`, `상자 역할 - 1`, `상자 역할 - 2`로 분리 표시됐고 edge button 수는 0이었다. `텍스트` 탭 edge button 수도 0이었다. `크기 및 위치` 탭은 `요약`, `스타일`, `기능 버튼`을 표시했고 edge button 216개를 복구했다.
- 2026-05-12: chrome-devtools MCP 성능 검증. 동일 URL에서 2 rAF 기준 탭 전환 시간은 `속성` 396ms, `텍스트` 271ms, `크기 및 위치` 238ms, 다시 `속성` 283ms였다. 수정 전 브라우저 계측의 `속성` 약 711ms, `텍스트` 약 922ms 대비 개선됐다.
- 2026-05-12: chrome-devtools MCP 검증. 콘솔 `error`/`warn` 메시지는 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다. `npm run typecheck`는 프로젝트에 스크립트가 없어 실행되지 않았다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `METADATA-OVERLAY-FLAT-CONTENT-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_OVERLAY_FLAT_CONTENT-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_OVERLAY_FLAT_CONTENT-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-OVERLAY-FLAT-CONTENT-01` 구현. `상자명`, `상자 역할 - 1`, `상자 역할 - 2` 오버레이 본문에서 `rounded-md border border-slate-200 bg-slate-50 p-2` 내부 래퍼를 제거했다. 오류/연결 모드 안내도 별도 카드 배경 없이 텍스트 영역으로 평탄화했다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL에서 `속성` 탭으로 전환한 뒤 `상자명`, `상자 역할 - 1`, `상자 역할 - 2` 오버레이를 확장해 확인했다. 세 오버레이 내부의 `border-slate-200 + bg-slate-50` 카드 래퍼 수는 모두 0이었다. 콘솔 `error`/`warn` 메시지는 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `METADATA-MULTI-SELECTION-STATE-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_MULTI_SELECTION_STATE-02_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_MULTI_SELECTION_STATE-02_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-MULTI-SELECTION-STATE-01` 구현. 선택된 상자들의 실제 `boxKind`, `role`, `runtimeMode` 집합을 읽어 `속성` 탭 오버레이 활성 상태에 사용한다. 복수 선택에서는 `상자명` 오버레이를 숨기며, 0개 선택에서는 기존 비활성 `상자를 선택하세요` 안내를 유지한다.
- 2026-05-12: chrome-devtools MCP 검증. `속성` 탭에서 실제 pointer/mouse 이벤트로 `band-3-cell-1`과 `band-3-cell-2`를 복수 선택했을 때 `상자명` 오버레이가 숨겨지고 `상위 키`/`하위 값`이 함께 활성 표시됨을 확인했다. `band-3-cell-1`과 `status-history-1` 복수 선택에서는 `텍스트`/`서명`, `상위 키`/`하위 값`, 복수 상세 기능 안내가 함께 표시됨을 확인했다. `Escape`로 0개 선택 상태를 만든 뒤 `상자명` 오버레이를 열어 비활성 입력과 `상자를 선택하세요` placeholder가 유지됨을 확인했다. 콘솔 `error`/`warn` 메시지는 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `METADATA-SELECTION-ROLE-COLORS-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_SELECTION_ROLE_COLORS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_SELECTION_ROLE_COLORS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-SELECTION-ROLE-COLORS-01` 구현. `속성` 탭 선택 상자에서 `text`는 회색, `attachment`는 보라색, `signature`는 빨간색 윤곽선을 쓰며, `key`는 앰버, `value`는 하늘색, `key_value`는 회색 배경을 쓴다. 선택 fill의 inset을 0으로 바꿔 padding처럼 비는 내부 영역 없이 배경색이 채워지도록 했다. `상자 역할 - 1/2` 활성 버튼은 테두리와 ring 없이 단일 배경색으로 표시한다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL의 `속성` 탭에서 실제 pointer/mouse 이벤트로 `band-3-cell-1`과 `status-history-1`을 복수 선택했다. 텍스트 key 상자는 회색 outline과 앰버 배경, 서명 value 상자는 빨간 outline과 하늘색 배경이며 selection fill inset은 모두 0px, box-shadow는 none이었다. `band-18-cell-2` 첨부파일 value 단일 선택에서는 보라색 outline과 하늘색 배경이 계산됨을 확인했다. `상자 역할 - 1/2` 오버레이 활성 버튼은 `border-transparent`와 단일 `bg-*` 색상으로 표시됨을 확인했다. 콘솔 `error`/`warn` 메시지는 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `SELECTION-CENTERED-BORDER-AND-METADATA-BG-01` 구현 전 백업을 `docs/diff/2026-05-12_SELECTION_CENTERED_BORDER_AND_METADATA_BG-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_SELECTION_CENTERED_BORDER_AND_METADATA_BG-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `SELECTION-CENTERED-BORDER-AND-METADATA-BG-01` 구현. 공통 선택선은 `outline` 대신 `0 0 0 1px`와 `inset 0 0 0 1px` box-shadow를 함께 사용해 경계선 중심 기준으로 보이게 했다. 위치 그룹 프록시 선택선도 같은 중심 기준 box-shadow로 보정했다. `속성` 탭 선택 배경은 `--color-amber-500`, `--color-sky-500`, `--color-slate-500` 변수를 사용해 `상자 역할 - 2` 활성 버튼과 같은 실제 출력 색상을 사용한다. 속성 탭에서는 `.v106-frame-selection-fill`을 `display: none` 처리해 상자 내용 위에 배경 레이어가 올라오지 않게 했다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL에서 실제 pointer/mouse 이벤트로 `band-3-cell-1`을 선택하고 `크기 및 위치`, `속성`, `텍스트` 탭을 전환했다. 세 탭 모두 선택 대상의 computed `outlineStyle`은 `none`이고 선택선은 바깥 1px/안쪽 1px box-shadow로 계산됐다. `속성` 탭의 key 선택 배경은 `--color-amber-500`와 같은 `lab(72.7183 31.8672 97.9407)` 계열로 계산됐고, selection fill은 `display: none`이었다. 콘솔 `error`/`warn` 메시지는 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `METADATA-ROLE2-BG-OPACITY-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_ROLE2_BG_OPACITY-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_ROLE2_BG_OPACITY-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-ROLE2-BG-OPACITY-01` 구현. `속성` 탭 선택 상자의 역할-2 배경은 기존 `--v106-metadata-selected-fill-color`를 유지하고 `color-mix(... 30%, transparent)`로 실제 상자 뒤 배경의 불투명도만 30% 수준으로 낮춘다. 선택 fill은 계속 숨겨 내용 위에 올라오지 않는다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL의 `속성` 탭에서 실제 pointer/mouse 이벤트로 `작 성 자` 상자를 선택했다. 선택 상자의 computed `backgroundColor`는 `color(... / 0.3)`로 계산됐고, `outlineStyle`은 `none`, 선택 fill은 `display: none`이었다. 콘솔에는 기존 접근성 issue 2건만 표시됐으며 이번 변경과 직접 관련된 `error`/`warn`은 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `SELECTION-BADGE-SIZE-50-01` 구현 전 백업을 `docs/diff/2026-05-12_SELECTION_BADGE_SIZE_50-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_SELECTION_BADGE_SIZE_50-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `SELECTION-BADGE-SIZE-50-01` 구현. 공통 선택 번호 뱃지의 위치 오프셋은 `4px -> 2px`, 최소 너비와 높이는 `22px -> 11px`, 글자 크기는 `11px -> 6px`로 줄였다. 상자와 그룹 프록시가 같은 규칙을 사용하므로 두 선택 번호 모두 같은 크기로 출력된다. 간격 설정 모드의 항목명 라벨은 번호가 아니므로 기존 높이와 글자 크기를 유지하도록 별도 override를 남겼다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL의 `크기 및 위치` 탭에서 실제 pointer/mouse 이벤트로 `작 성 자` 상자를 선택했다. 선택 상자의 `::before` computed style은 `minWidth=11px`, `height=11px`, `fontSize=6px`, `top=2px`, `left=2px`, `content="1"`이었다. 같은 CSS selector를 쓰는 그룹 프록시 뱃지는 임시 probe로 `content="2"` 상태를 계산해 `minWidth=11px`, `height=11px`, `fontSize=6px`, `top=2px`, `left=2px`를 확인했다. 콘솔에는 기존 접근성 issue 2건만 표시됐으며 이번 변경과 직접 관련된 `error`/`warn`은 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `METADATA-ROLE3-CONNECTION-OVERLAY-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_ROLE3_CONNECTION_OVERLAY-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_ROLE3_CONNECTION_OVERLAY-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-ROLE3-CONNECTION-OVERLAY-01` 구현. `TemplateEditPreviewSurface`에 `metadataRoleTertiary` 오버레이 슬롯을 추가하고, `속성` 탭의 플로팅 순서를 `상자명 -> 상자 역할 - 1 -> 상자 역할 - 2 -> 상자 역할 - 3`으로 확장했다. `상자 역할 - 2`에는 역할 선택 버튼만 남기고, 연결 CTA/연결 선택 모드/가상 key-value 저장 UI를 `상자 역할 - 3`으로 이동했다.
- 2026-05-12: `METADATA-ROLE3-CONNECTION-OVERLAY-01` 구현. `상자 역할 - 3`의 CTA 위에는 선택 상자명, 상위 키/하위 값/독립 값 상태, 화면에 존재하는 연결 대상 또는 화면에 없는 상위 키 정보를 쉬운 문장으로 출력한다. 예: `band-0-header는 하위 값입니다. / 화면에 없는 상위 키 form-num와 연결되어 있어 키를 다시 선택할 수 있습니다.`
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL의 `속성` 탭에서 실제 pointer/mouse 이벤트로 `band-0-header`를 선택하고 `상자 역할 - 2`, `상자 역할 - 3`을 확장했다. `상자 역할 - 2` 텍스트는 `상위 키 / 하위 값 / 독립 값`만 포함했고 연결 CTA는 없었다. `상자 역할 - 3`은 `band-0-header는 하위 값입니다.`, `화면에 없는 상위 키 form-num와 연결되어 있어 키를 다시 선택할 수 있습니다.`, `기존 연결 해제하고 키 박스 선택하기`를 표시했다. 콘솔에는 기존 접근성 issue 2건만 표시됐으며 이번 변경과 직접 관련된 `error`/`warn`은 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `METADATA-CONNECTION-LABEL-01` 구현 전 백업을 `docs/diff/2026-05-12_METADATA_CONNECTION_LABEL-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_METADATA_CONNECTION_LABEL-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `METADATA-CONNECTION-LABEL-01` 구현. `metadataRoleTertiary` 슬롯의 화면 표시명만 `상자 역할 - 3`에서 `상자 연결`로 변경했다. 연결 CTA, 설명 문구, 위치 계산, 저장 동작은 변경하지 않았다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL을 새로고침한 뒤 `속성` 탭으로 전환해 플로팅 버튼 표시명을 확인했다. `상자 연결` 버튼이 표시되고 `상자 역할 - 3` 텍스트는 화면 버튼에 남아 있지 않았다. 콘솔에는 기존 접근성 issue와 리소스 404 1건이 표시됐으며 이번 라벨 변경과 직접 관련된 런타임 오류는 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `FLOATING-OVERLAY-TAB-ORDER-STACK-01` 구현 전 백업을 `docs/diff/2026-05-12_FLOATING_OVERLAY_TAB_ORDER_STACK-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_FLOATING_OVERLAY_TAB_ORDER_STACK-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `FLOATING-OVERLAY-TAB-ORDER-STACK-01` 구현. 플로팅 오버레이 스택 순서를 탭별로 분리하고 모든 순서의 첫 항목에 `요약`을 포함했다. `속성` 탭은 `요약, 상자명, 상자 역할 - 1, 상자 역할 - 2, 상자 연결`, `크기 및 위치` 탭은 `요약, 스타일, 기능 버튼`, `텍스트` 탭은 `요약, 텍스트 설정` 순서로 같은 사분면의 이전/다음 오버레이 높이만큼 위치를 보정한다.
- 2026-05-12: `FLOATING-OVERLAY-TAB-ORDER-STACK-01` 보정. 같은 사분면에 들어온 오버레이 전체 높이가 현재 보이는 preview 높이에 가까울 때 기존 고정 간격 때문에 아래 항목이 겹칠 수 있어, 같은 사분면의 총 높이를 기준으로 간격을 자동 축소한다. 부족한 높이에서는 순서와 비겹침을 우선하고, 보이는 영역 내부 고정은 가능한 범위에서만 유지한다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL에서 `속성` 탭 오버레이를 모두 같은 좌측 상단 사분면으로 이동했다. 결과는 `요약 -> 상자명 -> 상자 역할 - 1 -> 상자 역할 - 2 -> 상자 연결` 순서이며 각 rect가 `673-705`, `715-747`, `757-789`, `799-831`, `841-873`으로 겹침 0개였다.
- 2026-05-12: chrome-devtools MCP 검증. 같은 방식으로 `텍스트` 탭은 `요약 -> 텍스트 설정` 순서와 겹침 없음, `크기 및 위치` 탭은 `요약 -> 스타일 -> 기능 버튼` 순서와 겹침 없음이 확인됐다. 콘솔에는 기존 접근성 issue인 `No label associated with a form field`, `A form field element should have an id or name attribute`만 표시됐고 이번 변경과 직접 관련된 `error`/`warn`은 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-AUTO-SIZE-MODE-DIRECTION-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-AUTO-SIZE-MODE-DIRECTION-01` 구현. 텍스트 탭 자동 크기 선택을 `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 3개 버튼으로 변경했다. `자동 높이 상자`가 선택에 포함되어 있으면 `위로 확장`, `아래로 확장`, `왼쪽으로 확장`, `오른쪽으로 확장` 기준 버튼을 표시하고, 선택 기준은 `data-template-frame-auto-size-anchor`로 선택 상자/저장 대상/input에 함께 기록한다.
- 2026-05-12: `TEXT-AUTO-SIZE-MODE-DIRECTION-02` 구현. 자동 너비 상자는 `data-template-frame-auto-width`와 `data-template-frame-auto-width-base`를 사용한다. 입력 텍스트의 자연 너비를 숨김 측정 요소로 계산하고, 기본 너비 이상으로만 동적 재계산한다. `오른쪽으로 확장` 기준은 기존 자동 높이 bottom 기준과 같은 방식으로 직접 peer를 함께 보정하고, 직접 peer가 아닌 우측 상자는 위치만 이동한다.
- 2026-05-12: chrome-devtools MCP 검증. 대표 URL에서 `크기 및 위치` 탭으로 `status-history-1`을 선택한 뒤 `텍스트` 탭으로 전환했다. `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 3개 버튼이 표시됐고, 자동 높이 상태에서는 `위로 확장`, `아래로 확장`, `왼쪽으로 확장`, `오른쪽으로 확장` 버튼이 표시됐다.
- 2026-05-12: chrome-devtools MCP 검증. `자동 너비 상자` 클릭 후 선택 상자에 `data-template-frame-auto-width="true"`가 기록되고 기존 `data-template-frame-auto-height`는 제거됐다. 다시 `자동 높이 상자`를 클릭하면 auto width가 제거되고 auto height가 복구됐다.
- 2026-05-12: chrome-devtools MCP 검증. `상` 기준 선택 후 `status-history-1`에 긴 텍스트를 입력했다. 재조회 기준 rect는 height `102 -> 128`, top `252 -> 226`, bottom `354 -> 354`로 계산되어 상단 기준 확장이 동작했다. 콘솔에는 기존 접근성 issue인 `No label associated with a form field`, `A form field element should have an id or name attribute`만 표시됐고 이번 변경과 직접 관련된 `error`/`warn`은 없었다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 구문 오류 때문에 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-AUTO-SIZE-DIRECTION-LABELS-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_AUTO_SIZE_DIRECTION_LABELS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_AUTO_SIZE_DIRECTION_LABELS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-AUTO-SIZE-DIRECTION-LABELS-01` 구현. 텍스트 탭 자동 크기 방향 버튼 표시를 `상`, `하`, `좌`, `우`에서 `위로 확장`, `아래로 확장`, `왼쪽으로 확장`, `오른쪽으로 확장`으로 변경했다. 설정 완료 메시지도 같은 표현을 사용해 읽는 사람마다 기준을 다르게 해석하지 않도록 했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `navigate_page`와 `list_pages`가 모두 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 브라우저 표시 검증을 완료하지 못했다. 정적 문자열 위치는 코드에서 확인했다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 성능 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 라벨 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-AUTOSIZE-SPACING-01` 및 `CANVAS-ICON-SCALE-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_AUTOSIZE_SPACING_ICON_SCALE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_AUTOSIZE_SPACING_ICON_SCALE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-AUTOSIZE-SPACING-01` 구현. 텍스트 탭 자동 높이/자동 너비 계산은 실행 전 frame/group 기준 relative anchor 설정을 스냅샷으로 저장하고, 자동 크기 및 peer 이동 계산 후 기존 간격 설정을 복원한 뒤 `applyRelativeAnchoredFrameRectsInRoot(root)`를 전체 적용한다. page corner 기준은 자동 크기 방향 재기록을 유지해 `위로 확장`/`왼쪽으로 확장` 기준을 깨지 않도록 했다.
- 2026-05-12: `CANVAS-ICON-SCALE-01` 구현. `상자 편집 캔버스` 툴바에 `S/M/L` 즉시 전환 버튼을 추가했다. 선택 번호 뱃지, 삭제 버튼, `아이콘 켜기`에서 표시되는 상자 종류/역할 아이콘은 `--v106-canvas-icon-size` 기준으로 같은 높이를 쓰며, 현재 축소 선택 번호 크기를 `S`, 이전 일반 선택 번호 크기 수준을 `M`으로 둔다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 구문 오류 때문에 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `new_page(isolatedContext=...)`와 `list_pages`가 모두 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 브라우저 표시 검증을 완료하지 못했다. 보조 확인으로 `playwright`/`@playwright/test` 설치 여부를 확인했으나 둘 다 설치되어 있지 않았고, 현재 샌드박스에서는 `curl http://localhost:3001/templates/edit` 접속도 실패했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `CANVAS-ICON-SCALE-02` 및 `POSITION-GROUP-DELETE-01` 구현 전 백업을 `docs/diff/2026-05-12_ICON_M_DEFAULT_GROUP_DELETE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_ICON_M_DEFAULT_GROUP_DELETE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `CANVAS-ICON-SCALE-02` 구현. 캔버스 아이콘 크기 상태의 기본값을 `S`에서 `M`으로 변경했다. CSS scale 값은 유지하되 초기 렌더링만 `data-canvas-icon-scale="m"`이 되도록 한다.
- 2026-05-12: `POSITION-GROUP-DELETE-01` 구현. 그룹 선택 프록시 마커에 group 삭제 버튼을 추가했다. group 삭제 경로는 `unwrapPositionGroupTreeEntriesByIds`로 선택 그룹만 위계에서 제거하고, 해당 그룹의 직접 하위 상자에 남은 그룹 속성만 해제한다. 하위 상자와 하위 그룹은 삭제하지 않으며, 삭제된 그룹을 기준점으로 삼던 relative anchor만 absolute로 해제한다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 구문 오류 때문에 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `new_page(isolatedContext=...)`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 브라우저 표시 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `POSITION-SELECTION-CYCLE-RESTORE-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_CYCLE_RESTORE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_CYCLE_RESTORE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-SELECTION-CYCLE-RESTORE-01` 구현. `크기 및 위치` 탭 선택 모드에서 상자 위 pointerdown이 마퀴 선택으로 즉시 return되어 순환 선택에 도달하지 못하던 분기를 제거했다. 클릭은 먼저 최상위 그룹 -> 하위 그룹 -> 최하위 상자 순환 선택을 적용하고, 사용자가 그대로 드래그할 때만 현재 선택을 기준으로 마퀴 선택을 이어가도록 변경했다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 구문 오류 때문에 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다. 검증 과정에서 갱신된 `tsconfig.tsbuildinfo`는 수정 범위가 아니므로 원상 복구했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `list_pages`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 브라우저 직접 조작 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-AUTOSIZE-GROUP-SPACING-01`, `TEXT-AUTOSIZE-INPUT-FOCUS-01` 구현 전 백업을 `docs/diff/2026-05-12_AUTO_SIZE_GROUP_SPACING_INPUT_FOCUS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_AUTO_SIZE_GROUP_SPACING_INPUT_FOCUS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: chrome-devtools MCP 원인 확인. 대표 템플릿에서 `그룹 2`는 `band-0-header`, `band-1-header`를 감싼 12px 높이 그룹이고 `그룹 1`은 그 아래 10px 간격으로 배치되어 있었다. `band-0-header`, `band-1-header`를 자동 높이로 만들면 `그룹 2` 높이는 118px로 커졌지만 `그룹 1` 상대 offset이 기존 22px으로 복원되어 실제 gap이 `-96px`로 겹쳤다.
- 2026-05-12: chrome-devtools MCP 원인 확인. 자동 높이 상태의 `band-1-header`에 100자 입력을 시도하면 첫 글자 `A`만 들어가고 active element가 `BODY`로 빠졌다. 원인은 자동 크기 입력 경로가 매 글자마다 preview DOM version 및 history state를 갱신해 React 재렌더를 만들고 textarea focus/caret을 잃게 한 것이다.
- 2026-05-12: `TEXT-AUTOSIZE-GROUP-SPACING-01` 구현. 자동 크기 계산 전에 materialized position group wrapper rect를 저장하고, 자동 크기 적용 뒤 anchor group의 새 높이/너비와 기존 gap을 기준으로 group anchor offset을 재계산한다. 이후 relative anchor 적용을 실행해 `그룹 2 -> 그룹 1` 같은 그룹 간 간격이 유지된다.
- 2026-05-12: `TEXT-AUTOSIZE-INPUT-FOCUS-01` 구현. 자동 크기 입력 중 `syncDraftPreviewHtmlRef`는 draft ref만 갱신하고 preview DOM version/history/render state는 갱신하지 않도록 옵션을 추가했다. 또한 입력 직전 textarea selection range를 저장하고 자동 크기 적용 뒤 같은 frame의 live textarea focus/caret을 복원한다.
- 2026-05-12: chrome-devtools MCP 검증. 새 격리 페이지에서 `band-1-header`를 자동 높이 상태로 두고 100자를 입력했다. 결과는 value length `100`, caret `100`, active element `band-1-header`, frame height `148`, `그룹 2` bottom `830.5`, `그룹 1` top `840.5`, gap `10`이었다.
- 2026-05-12: chrome-devtools MCP 검증. 같은 textarea에 100자 붙여넣기 3회에 해당하는 `insertFromPaste` 입력을 연속 적용했다. 결과는 value length `400`, caret `400`, active element `band-1-header`, frame height `548`, `그룹 2` bottom `1230.5`, `그룹 1` top `1240.5`, gap `10`이었다. MCP의 `Control+V`/`Meta+V`는 클립보드 내용을 textarea에 반영하지 않아, clipboard write 성공 확인 후 paste input event로 검증했다.
- 2026-05-12: chrome-devtools MCP 콘솔 검증. 이번 변경과 직접 관련된 `error`/`warn`은 없었다. 기존 접근성 issue인 `No label associated with a form field`, `A form field element should have an id or name attribute`만 남았다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 구문 오류 때문에 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다. 검증 과정에서 갱신된 `tsconfig.tsbuildinfo`는 수정 범위가 아니므로 원상 복구했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-AUTO-SIZE-MODE-DIRECTION-FIT-01`, `TEXT-AUTO-SIZE-SECONDARY-FIT-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION_FIT-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_AUTO_SIZE_MODE_DIRECTION_FIT-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-AUTO-SIZE-MODE-DIRECTION-FIT-01` 구현. 텍스트 탭 자동 높이 상태에서는 `위로 확장`, `아래로 확장`, `너비 내용에 맞추기`만 출력하고, 자동 너비 상태에서는 `왼쪽으로 확장`, `오른쪽으로 확장`, `높이 내용에 맞추기`만 출력한다. 저장 경로도 현재 자동 크기 모드와 맞지 않는 기준 방향은 대상 상자에서 제외한다.
- 2026-05-12: `TEXT-AUTO-SIZE-SECONDARY-FIT-01` 구현. `너비 내용에 맞추기`는 자동 높이 상자의 width를 내용 기준으로 보정하고, `높이 내용에 맞추기`는 자동 너비 상자의 height를 내용 기준으로 보정한다. 보조 맞춤 후에도 기존 relative anchor와 그룹 간 간격 보존 경로를 적용한다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 단일 파일 타입 확인도 기존 `TemplateEditWorkspace.tsx`의 누적 타입 오류를 보고해 이번 변경만 독립 확인하지 못했다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `list_pages`와 `new_page(isolatedContext=...)`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패했다. 이어서 `curl`은 `localhost:3001` 연결 실패, `npm run dev -- -p 3001`과 `npm run dev -- -H 127.0.0.1 -p 3001`은 샌드박스의 `listen EPERM`으로 실패해 브라우저 표시 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-SIZE-ANCHOR-01`, `POSITION-STYLE-SIZE-EXACT-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_SIZE_ANCHOR_EXACT-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_SIZE_ANCHOR_EXACT-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-SIZE-ANCHOR-01` 구현. 위치 탭 스타일 width/height 입력은 저장된 자동 크기 방향이 같은 축일 때 그 방향의 edge resize를 사용한다. 저장값이 없거나 다른 축 값이면 width는 왼쪽 고정으로 오른쪽 edge를, height는 위쪽 고정으로 아래 edge를 움직인다.
- 2026-05-12: `POSITION-STYLE-SIZE-EXACT-01` 구현. 명시적으로 입력한 width 축은 자동 너비 재계산에서 제외하고, 명시적으로 입력한 height 축은 자동 높이 재계산에서 제외한다. 자동 크기 상자의 명시 입력 후에는 실제 적용된 width/height를 auto base 속성에도 다시 저장한다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `list_pages`와 `new_page(isolatedContext=...)`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패했다. 이어서 `curl`은 `localhost:3001` 연결 실패, `npm run dev -- -H 127.0.0.1 -p 3001`은 샌드박스의 `listen EPERM`으로 실패해 브라우저 표시 검증을 완료하지 못했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-SECONDARY-HEIGHT-FIT-PADDING-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_SECONDARY_HEIGHT_FIT_PADDING-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_SECONDARY_HEIGHT_FIT_PADDING-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-SECONDARY-HEIGHT-FIT-PADDING-01` 구현. `높이 내용에 맞추기`에서 textarea 측정 clone은 `rows=1`, `height=0`, `min-height=0`으로 강제해 브라우저 기본 2행 높이를 내용 높이로 세지 않게 했다. 또한 보조 높이 맞춤 fallback은 현재 `clientHeight/offsetHeight`를 내용 요구 높이로 쓰지 않고 실제 `scrollHeight`를 우선해 기존 화면 높이 때문에 불필요한 여백이 유지되지 않도록 했다. 입력 컨트롤 측정값은 과거 `textContent`가 아니라 현재 `value`만 사용해 삭제된 텍스트 높이가 남지 않게 했다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `list_pages`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 `band-1-header`의 실제 브라우저 높이 맞춤 결과를 직접 확인하지 못했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 UI 높이 계산 변경 범위와 직접 관련 없다.
- 2026-05-12: `CANVAS-INTERACTION-IMMEDIATE-PERF-01` 구현 전 백업을 `docs/diff/2026-05-12_CANVAS_INTERACTION_IMMEDIATE_PERF-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_CANVAS_INTERACTION_IMMEDIATE_PERF-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `CANVAS-INTERACTION-IMMEDIATE-PERF-01` 구현. 상자/그룹 선택은 live DOM 선택 표시를 먼저 적용하고 React 패널 상태 갱신은 `startTransition`으로 넘긴다. 기존 `flushSync` 선택 경로는 제거해 클릭 시 React 렌더가 선택 표시보다 앞서지 않게 했다.
- 2026-05-12: `CANVAS-INTERACTION-IMMEDIATE-PERF-01` 구현. 텍스트 탭의 자동 높이/자동 너비 입력은 live DOM 자동 크기만 즉시 적용하고, 매 글자마다 `extractEditorHtml`/`extractPreviewRenderHtml` 직렬화를 실행하지 않는다. 저장 시점에는 기존 `saveTemplate` 경로가 live DOM을 다시 직렬화한다.
- 2026-05-12: `CANVAS-INTERACTION-IMMEDIATE-PERF-01` 구현. 상자 이동/일반 리사이즈의 snap 비교 대상은 pointerdown 시점에 캐시해 pointermove마다 전체 상자 rect를 다시 수집하지 않는다. 엣지 드래그 중에는 잠긴 edge resize target을 매 pointermove마다 다시 topology snapshot으로 갱신하지 않고, 선택 edge UI 전체 재계산도 pointermove에서 제거해 drag 종료/정리 경로에서 확정한다.
- 2026-05-12: 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: chrome-devtools MCP 검증 시도. `list_pages`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 실제 브라우저에서 선택/입력/엣지 이동 체감 속도는 직접 확인하지 못했다.
- 2026-05-12: Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 캔버스 상호작용 성능 변경 범위와 직접 관련 없다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` 구현 전 백업을 `docs/diff/2026-05-12_VISUAL_STYLE_NO_GEOMETRY_REFLOW-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_VISUAL_STYLE_NO_GEOMETRY_REFLOW-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` 원인 분석. 배경색 변경 자체는 `applyFrameStylePatch`에서 frame node의 `style.backgroundColor`만 바꾸지만, 공통 `applySelectionStylePatch`가 모든 스타일 변경 후 `applyTemplateAutoSizeBoxes`, `syncDraftPreviewHtmlRef`, `schedulePreviewEditorState`를 실행할 수 있었다. 즉 배경색 변경이 자동 크기/relative anchor/preview 재렌더까지 동반되어 선택된 연속 행의 레이아웃을 다시 계산하는 것이 파괴 원인이다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` 구현. 스타일 patch를 내용 측정에 영향 있는 항목과 시각 전용 항목으로 구분했다. `backgroundColor`, `color`, `borderColor`, `borderRadius` 같은 시각 전용 변경은 자동 크기 재계산을 실행하지 않고, live DOM과 draft/history만 갱신하며 preview DOM version/rendered HTML 갱신을 건너뛴다. 특정 `band-*-cell-1` ID를 예외 처리하지 않는다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`는 통과했다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` chrome-devtools MCP 검증 시도. `list_pages`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 실제 브라우저에서 배경색 변경 후 레이아웃 유지 여부를 직접 확인하지 못했다.
- 2026-05-12: `VISUAL-STYLE-NO-GEOMETRY-REFLOW-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 배경색 스타일 적용 변경 범위와 직접 관련 없다.
- 2026-05-12: `POSITION-SHIFT-DRAG-MARQUEE-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_SHIFT_DRAG_MARQUEE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_SHIFT_DRAG_MARQUEE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-SHIFT-DRAG-MARQUEE-01` 구현. `크기 및 위치` 탭의 상자/그룹 위 `Shift+pointerdown`은 즉시 선택을 확정하지 않고 marquee selection 상태로 대기한다. 포인터 이동이 드래그 기준값을 넘으면 기존 선택을 base로 유지하고 드래그 범위에 걸린 상자/그룹만 추가 선택한다. 드래그 없이 pointerup되면 저장해 둔 click-chain entry로 기존 `Shift+클릭` 누적 선택을 실행한다.
- 2026-05-12: `POSITION-SHIFT-DRAG-MARQUEE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`는 통과했다.
- 2026-05-12: `POSITION-SHIFT-DRAG-MARQUEE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-SHIFT-DRAG-MARQUEE-01` chrome-devtools MCP 검증 시도. `list_pages`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패해 실제 브라우저에서 `Shift+드래그` 동작을 직접 확인하지 못했다.
- 2026-05-12: `POSITION-SHIFT-DRAG-MARQUEE-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 캔버스 선택 입력 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` 구현 전 백업을 `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_MODE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_MODE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` 구현. 상자 편집 캔버스 툴바 맨 왼쪽에 눈 아이콘 토글을 추가했다. 실제 사용 미리보기 상태에서는 editor overlay/선택선/삭제/edge/resize UI를 숨기고, 투명 guide 배경을 실제 투명 출력으로 바꾸며, `value`/`key_value` 상자는 편집용 텍스트를 비운 임시 입력 UI로 교체한다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` 구현. 텍스트 상자는 임시 입력 또는 contenteditable 영역으로, 첨부파일 상자는 파일 선택 UI로, 서명 상자는 canvas 서명 UI로 점검할 수 있게 했다. 이 입력들은 preview runtime DOM에서만 처리되며 `handlePreviewInput`, editor state sync, 저장 버튼, 저장 HTML 추출 경로에 들어가지 않는다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`는 통과했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` chrome-devtools MCP 검증 시도. `list_pages`가 Chrome profile lock 오류(`browser is already running for ... chrome-profile`)로 실패했다. 이어서 `curl -I http://localhost:3001/templates/edit`은 로컬 서버 미응답으로 실패했고, `npm run dev -- -H 127.0.0.1 -p 3001`은 샌드박스의 `listen EPERM`으로 실패해 실제 브라우저에서 눈 아이콘 토글과 임시 입력 UI를 직접 확인하지 못했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-MODE-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 DB 저장 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 임시 미리보기 UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` 구현 전 백업을 `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_VALUE_ATTACHMENT_SIGNATURE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_VALUE_ATTACHMENT_SIGNATURE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` 구현. 실제 사용 미리보기의 빈 `value` 상자는 placeholder/id 텍스트를 완전히 제거했다. 서명 canvas는 점선 border와 배경 fill을 제거해 추가 시각화를 남기지 않았다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` 구현. 첨부파일 상자는 다중 파일 등록이 가능하도록 `multiple` input과 preview 전용 파일명 목록 상태를 추가했다. 출력 상태에서는 파일명 텍스트만 보이고, 상자를 클릭해 편집 상태에 들어가면 `+` 버튼과 개별 삭제 버튼이 나타난다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` chrome-devtools MCP 검증. 실제 사용 미리보기에서 빈 value 상자들에 placeholder가 남지 않는 것을 확인했다. 서명 canvas의 computed style은 `border-top-style: none`, `border-top-width: 0px`, `background-color: rgba(0, 0, 0, 0)`였다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` chrome-devtools MCP 검증. `band-18-cell-2` 첨부파일 상자를 클릭해 편집 상태로 전환한 뒤 `/tmp/preview-file-a.pdf`, `/tmp/preview-file-b.hwp`를 순차 업로드했다. 편집 상태에서는 두 파일이 각각 파일명과 삭제 버튼으로 보였고, 다른 상자를 클릭해 출력 상태로 돌아가면 버튼이 사라지고 파일명 텍스트만 남았다. 이후 첫 파일 삭제도 직접 확인했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-FILE-SIGNATURE-VALUE-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 preview value/signature/attachment UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-AUTOSIZE-01` 구현 전 백업을 `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_AUTOSIZE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEMPLATE_USAGE_PREVIEW_AUTOSIZE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-AUTOSIZE-01` 원인 분석. 자동 높이/자동 너비 속성은 상자에 남아 있었지만, 실제 사용 미리보기 모드에서는 `handlePreviewInput`이 가장 먼저 return 되어 `applyTemplateAutoSizeBoxes`가 아예 실행되지 않았다. 첨부파일 상자는 `change` 이벤트에서 파일명만 바꾸고 끝났기 때문에 `band-18-cell-2` 같은 상자도 같은 방식으로 레이아웃이 깨질 수 있었다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-AUTOSIZE-01` 구현. 실제 사용 미리보기의 텍스트 입력, contenteditable 입력, 첨부파일명 변경은 draft sync 없이 runtime DOM에서만 autosize를 다시 계산한다. 따라서 `band-11-cell-2`, `band-13-cell-2`, `band-17-cell-2`, `band-18-cell-2`처럼 자동 높이 상자에 긴 값이나 긴 파일명이 들어가도 peer edge/상대 위치 보정 경로를 함께 타게 된다.
- 2026-05-12: `TEXT-CONTENTEDITABLE-AUTOSIZE-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_CONTENTEDITABLE_AUTOSIZE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_CONTENTEDITABLE_AUTOSIZE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-CONTENTEDITABLE-AUTOSIZE-01` 원인 분석. 일반 편집 모드의 `handlePreviewInput`은 `textarea/input` 상자만 auto-size 대상으로 취급하고, `data-template-edit-scope` 기반 contenteditable 상자는 generic sync 경로로 보내고 있었다. 따라서 자동 높이 속성이 있어도 `band-11-cell-2`, `band-13-cell-2`, `band-17-cell-2`처럼 contenteditable 구조를 가진 상자는 입력 중 `applyTemplateAutoSizeBoxes`가 실행되지 않아 템플릿이 깨질 수 있었다.
- 2026-05-12: `TEXT-CONTENTEDITABLE-AUTOSIZE-01` 구현. `텍스트` 탭 입력에서는 `textarea/input`뿐 아니라 같은 frame의 contenteditable 입력도 auto height/width 판정에 포함한다. 자동 크기 대상이면 기존 performance 정책을 유지한 채 live DOM에서만 autosize를 적용하고, `saveTemplate`의 live DOM 직렬화 경로가 최종 저장을 담당한다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` 구현 전 백업을 `docs/diff/2026-05-12_AUTOSIZE_RELATIVE_OFFSET_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_AUTOSIZE_RELATIVE_OFFSET_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` 원인 분석. `band-11-cell-2`, `band-13-cell-2`가 새로고침 직후 잘린 직접 원인은 초기 autosize 정규화가 없었던 점과, 같은 행의 auto-height peer를 순서대로 따로 계산한 점이 겹친 것이다. 예를 들어 `band-11-cell-2`를 먼저 늘린 뒤 같은 행의 더 작은 peer가 나중에 다시 계산되면 공용 행 높이가 더 작은 요구치로 다시 줄어들어 잘림과 레이아웃 파괴가 재발했다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` 구현. preview root attach 후 `document.fonts.ready`와 2회의 `requestAnimationFrame` 뒤에 전체 autosize 정규화를 1회 실행한다. 자동 높이는 같은 `bottom` peer cluster를, 자동 너비는 같은 `right` peer cluster를 한 번에 모아 cluster 최대 요구 크기만 적용하도록 바꿨다. 이 경로에서 하위 follower의 offset은 새 높이/너비 기준으로 다시 저장되어 이후 입력 중에도 줄/열이 다시 줄어들지 않는다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` chrome-devtools MCP 검증. 대표 템플릿을 새로고침한 직후 `band-11-cell-2`와 `band-11-cell-3`은 모두 `height 111 / scrollHeight 111`, `band-13-cell-2`는 `height 60 / scrollHeight 60`으로 측정되어 초기 잘림이 사라진 것을 확인했다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` chrome-devtools MCP 검증. `텍스트` 탭에서 `band-10-cell-2`와 `band-13-cell-2`에 긴 여러 줄 텍스트를 직접 입력했다. 그 결과 `band-10-cell-2`는 `height 77 -> 111`, `band-13-cell-2`는 `height 60 -> 178`로 즉시 늘었고, 아래 행인 `band-11-cell-2/3`, `band-12-cell-2`, `band-14-cell-2`는 함께 아래로 이동했다. 측정 시점의 대상 상자들은 모두 `clientHeight == scrollHeight`였다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `TEXT-AUTOSIZE-PEER-CLUSTER-NORMALIZATION-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 autosize 계산 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` 구현 전 백업을 `docs/diff/2026-05-12_TEXT_AUTOSIZE_ANCHOR_SWITCH_STABLE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_TEXT_AUTOSIZE_ANCHOR_SWITCH_STABLE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` 원인 분석. `위로 확장`/`왼쪽으로 확장` 전환 버튼은 anchor 속성만 바꿔야 하지만, 기존 구현은 전환 직후 `applyTemplateAutoSizeBoxes`를 다시 실행했다. 이때 top/left anchor peer는 cluster에서 제외되고, `applyFrameAutoHeightDelta`/`applyFrameAutoWidthDelta`도 top/left peer를 함께 움직이지 않아 같은 row/column의 일부 상자만 줄어들며 템플릿이 깨졌다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` 구현. anchor 전환 버튼은 현재 크기 재계산을 실행하지 않고 anchor 속성만 저장하도록 바꿨다. 동시에 실제 auto-size 실행 경로는 top/bottom, left/right와 무관하게 같은 row/column peer cluster를 함께 계산하고, top/left anchor에서도 peer들을 같은 방향으로 함께 resize/rebase 하도록 수정했다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` chrome-devtools MCP 검증. `텍스트` 탭에서 `band-10-cell-2`, `band-11-cell-2`, `band-11-cell-3`, `band-13-cell-2`를 함께 선택한 뒤 `아래로 확장 -> 위로 확장`을 직접 실행했다. 수정 전에는 `band-11-cell-3`가 `height 111 -> 88`, `top 617 -> 640`으로 변하며 줄이 무너졌고, 수정 후에는 네 상자 모두 높이와 top이 그대로 유지되면서 anchor만 `top`으로 바뀌었다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` chrome-devtools MCP 추가 검증. 같은 상태에서 `band-11-cell-2`에 긴 여러 줄 텍스트를 직접 입력했을 때 `band-11-cell-2`, `band-11-cell-3`는 둘 다 `height 111 -> 212`, `top 617 -> 516`으로 함께 변했고, 두 상자 모두 `clientHeight == scrollHeight`를 유지했다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `TEXT-AUTOSIZE-ANCHOR-SWITCH-STABLE-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 anchor 전환 및 peer autosize 변경 범위와 직접 관련 없다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-INDEPENDENT-PADDING-01`, `TEXT-PADDING-PER-SIDE-01`, `POSITION-STYLE-EDGE-CORNER-TARGET-01` 구현 전 백업을 `docs/diff/2026-05-12_PREVIEW_PADDING_EDGE_CORNER_01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_PREVIEW_PADDING_EDGE_CORNER_01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-INDEPENDENT-PADDING-01` 구현. 실제 사용 미리보기의 runtime 입력 대상은 `value`만 남기고 `key_value`는 정적 텍스트로 유지했다. replacement control은 기존 content target의 padding/font/textAlign을 이어받도록 바꿨고, 미리보기 on 진입 시 편집용 draft/render snapshot을 저장한 뒤 off 시 그 snapshot으로 되돌려 편집 캔버스 기하가 바뀌지 않게 했다.
- 2026-05-12: `TEXT-PADDING-PER-SIDE-01` 구현. `텍스트 설정`의 `좌우 여백`/`상하 여백` 2개 입력을 제거하고 `상/하/좌/우` 대상 버튼과 단일 px 입력으로 교체했다. 실제 저장 경로는 `paddingTop/Bottom/Left/Right` 4변 값을 별도로 유지하며, 선택된 변만 blur 시점에 반영한다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-TARGET-01` 구현. `크기 및 위치 > 스타일`의 상단 인라인 컨트롤을 박스 위 중앙으로 옮겼다. 박스 미리보기 위에서 `상/우/하/좌` 엣지와 `좌상/우상/우하/좌하` 코너를 직접 토글할 수 있게 했고, 선택된 엣지에만 선 두께/색/타입 patch를, 선택된 코너에만 corner radius patch를 적용하도록 바꿨다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-INDEPENDENT-PADDING-01` chrome-devtools MCP 검증. 대표 템플릿에서 실제 사용 미리보기를 켠 뒤 `band-19-footer(key_value)`는 텍스트가 그대로 보이고 `band-3-cell-2(value)`는 비어 있는 것을 확인했다. 서명 canvas의 computed style은 `border-top-style: none`, `border-top-width: 0px`, `background-color: rgba(0, 0, 0, 0)`였다.
- 2026-05-12: `TEMPLATE-USAGE-PREVIEW-INDEPENDENT-PADDING-01` chrome-devtools MCP 추가 검증. `band-19-footer`, `band-3-cell-2`, `band-11-cell-2`의 편집 모드 shell `top/left/width/height`를 저장한 뒤 미리보기 on/off를 1회 반복했다. 비교 결과 세 상자 모두 before/after가 완전히 같아 미리보기 토글이 편집 기하를 바꾸지 않음을 확인했다.
- 2026-05-12: `TEXT-PADDING-PER-SIDE-01`, `POSITION-STYLE-EDGE-CORNER-TARGET-01` chrome-devtools MCP 검증. `텍스트` 탭에서는 `여백` 아래에 `상/하/좌/우` 버튼과 단일 px 입력이 렌더되는 것을 확인했다. `크기 및 위치` 탭에서는 `스타일`을 펼쳤을 때 상단 인라인 컨트롤이 박스 위 가운데에 놓이고, 박스 미리보기 안에 `상/우/하/좌`, `좌상/우상/우하/좌하` 토글 버튼이 모두 출력되는 것을 확인했다.
- 2026-05-12: `PREVIEW_PADDING_EDGE_CORNER_01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `PREVIEW_PADDING_EDGE_CORNER_01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `PREVIEW_PADDING_EDGE_CORNER_01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 preview/padding/edge-corner UI 변경 범위와 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_UI_ROLLBACK-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_UI_ROLLBACK-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` 구현. `크기 및 위치 > 스타일`은 기존 box model 미리보기 구조로 되돌렸다. 이번 범위에서 유지한 변경은 `/html/body/main/main/div/div/div[4]/div/div[3]/div[3]/div/div/div/div/div[1]`에 해당하는 상단 인라인 컨트롤 묶음을 박스 선 안이 아니라 박스 위에 두는 것뿐이다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` 구현. `크기 및 위치` 탭에서 추가했던 `상/우/하/좌`, `좌상/우상/우하/좌하` 토글 UI는 제거했다. 선 두께/색/타입/정렬과 코너 라운딩은 다시 전체 상자 기준으로만 적용된다. `텍스트` 탭의 `상/하/좌/우 + 단일 px 입력` 여백 UI는 유지하며, 두 탭의 요구사항을 다시 분리했다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` chrome-devtools MCP 검증. `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40` 페이지를 새로고침한 뒤 `크기 및 위치` 탭을 직접 확인했다. 접힌 `스타일` 오버레이 헤더는 독립 버튼으로 유지되며 DOM 기준 `left: 1120px; top: 12px; height: 32px`에 떠 있었다. 같은 시점에 문서 전체에서 `상/우/하/좌`, `좌상/우상/우하/좌하` 버튼 텍스트와 `data-style-field` 노드는 더 이상 나타나지 않아, 이전 edge/corner 편집 UI가 제거된 상태를 확인했다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-UI-ROLLBACK-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 위치 탭 스타일 UI 되돌림 범위와 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-GAP-10PX-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_GAP_10PX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_GAP_10PX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-GAP-10PX-01` 구현. `크기 및 위치 > 스타일`의 상단 인라인 컨트롤 블록과 box model 본체 사이 간격을 10px로 조정했다. 구현은 헤더 높이 32px과 기존 `-translate-y-1/2` 구조를 기준으로 계산하며, box 본체에 `marginTop = 16 + 10 = 26px`을 적용하도록 기록했다.
- 2026-05-12: `POSITION-STYLE-GAP-10PX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-GAP-10PX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-GAP-10PX-01` chrome-devtools MCP 검증 시도. 기존 세션에서는 페이지 접근이 가능했지만, 이번 수정 직후 `chrome-profile` lock 오류가 발생해 `list_pages` 및 `evaluate_script` 재접속이 실패했다. 따라서 이번 턴에서는 브라우저에서 10px 간격을 직접 재측정하지 못했다.
- 2026-05-12: `POSITION-STYLE-GAP-10PX-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 간격 조정과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_NO_OVERLAP_LAYOUT-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_NO_OVERLAP_LAYOUT-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` 원인 분석. 기존 구현은 상단 인라인 컨트롤 블록을 `absolute + -translate-y-1/2`로 띄우고, 아래 box model 본체를 `margin-top`으로만 밀고 있었다. 이 구조는 수치상 간격이 있어도 오버레이 경계와 본체가 같은 부모 좌표계에서 겹쳐 보이기 쉬웠고, 사용자가 전달한 실제 DOM에서도 `/div/div[1]`과 `/div/div[2]`가 같은 래퍼 안에서 중첩된 상태였다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` 구현. `크기 및 위치 > 스타일`의 상단 인라인 컨트롤 블록을 절대 배치에서 정상 흐름 배치로 변경했다. 현재는 `flex-col` 래퍼 안에서 상단 컨트롤이 먼저 렌더되고, box model 본체가 그 아래에 `gap-2.5`(10px) 간격으로 출력된다. 따라서 `/div/div[1]`과 `/div/div[2]`는 구조적으로 겹치지 않는다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 DOM 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-NO-OVERLAP-LAYOUT-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 비겹침 레이아웃 변경과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-DIRECT-CHILDREN-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_DIRECT_CHILDREN-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_DIRECT_CHILDREN-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-DIRECT-CHILDREN-01` 구현. `크기 및 위치 > 스타일`의 상단 컨트롤 블록을 감싸던 `flex justify-end` 래퍼까지 제거했다. 현재는 `max-w-full overflow-visible pb-1 pt-6` 래퍼 바로 아래에 `grid ...` 컨트롤 블록과 box model 본체가 형제 구조로 직접 렌더된다. 정렬은 래퍼가 아니라 `grid` 자체의 `ml-auto`로 유지한다.
- 2026-05-12: `POSITION-STYLE-DIRECT-CHILDREN-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-DIRECT-CHILDREN-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-DIRECT-CHILDREN-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 DOM 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-DIRECT-CHILDREN-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 직계 자식 구조 변경과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_PARENT_FLATTEN_WIDTH_SYNC-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_PARENT_FLATTEN_WIDTH_SYNC-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` 구현. `renderSelectionAppearanceControls()`는 더 이상 `max-w-full overflow-visible pb-1 pt-6` 래퍼를 반환하지 않고 `Fragment`를 반환한다. 따라서 overlay content wrapper(`max-h-[min(26rem,calc(100vh-14rem))] overflow-auto p-2`) 바로 아래에 1) 상단 `grid` 컨트롤 블록, 2) box model 본체가 직계 형제로 렌더된다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` 구현. 첫 번째 블록은 margin class를 제거해 `grid ...`만 남겼다. 두 번째 블록은 `w-fit max-w-full`로 바꾸고, `selectionAppearanceToolbarRef` + `ResizeObserver`로 첫 번째 블록의 실제 너비를 측정해 `selectionAppearanceToolbarWidth` 상태에 저장한 뒤 그 값을 두 번째 블록의 `width`에 직접 적용한다. 즉 `/div[2]`의 너비는 `/div[1]` 너비를 기준으로 결정된다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 DOM 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-PARENT-FLATTEN-WIDTH-SYNC-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 부모 평탄화/폭 동기화 변경과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_WIDTH_MOUNT_MEASURE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_WIDTH_MOUNT_MEASURE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` 원인 분석. `/html/body/main/main/div/div/div[4]/div/div[3]/div[3]/div/div/div[2]`의 너비는 `/div[1]` 측정값을 기준으로 결정하도록 되어 있었지만, 기존 구현은 `useLayoutEffect`에서만 툴바 폭을 읽었다. 이 구조에서는 툴바 DOM이 effect 실행 시점보다 늦게 붙거나 오버레이가 다시 열릴 때 ref가 비어 있어 측정값이 `null`로 남을 수 있었고, 그 결과 두 번째 블록이 고정 폭을 받지 못해 찌그러진 상태로 출력될 수 있었다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` 구현. `selectionAppearanceToolbarRef`에 callback ref를 적용해 툴바 DOM이 붙는 즉시 실제 폭을 측정하도록 바꿨다. 이후에는 기존 `ResizeObserver`가 같은 helper를 통해 변경 폭을 계속 동기화한다. 이로써 `/div[2]`는 첫 렌더 직후부터 `/div[1]`과 동일한 실제 너비를 받는다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 브라우저 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-WIDTH-MOUNT-MEASURE-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 폭 측정 시점 보정과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_FILL_PARENT_WIDTH-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_FILL_PARENT_WIDTH-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` 원인 분석. 기존 스타일 오버레이의 `/div[1]`과 `/div[2]`는 둘 다 `w-fit` 기반이어서 부모의 padding 영역 전체를 채우지 못했다. 특히 `/div[2]`는 `/div[1]`의 실측 폭을 받더라도 그 기준 자체가 shrink-to-fit 폭이었기 때문에, 사용자가 기대한 “패딩 안을 가득 채운 동일 폭” 구조가 되지 않았다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` 구현. `/div[1]` 툴바 블록을 `w-full min-w-0 max-w-full`로 바꿔 부모 padding 영역 폭을 그대로 사용하게 했고, `/div[2]`도 `w-full min-w-0 max-w-full`로 바꿨다. 두 번째 블록에는 `mt-2.5`를 적용해 두 블록 사이 간격을 10px로 고정했다. 폭 동기화 helper는 유지하되, 기준 폭 자체가 이제 부모 내부 폭이 되므로 두 블록은 같은 부모 폭을 채운다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 브라우저 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-FILL-PARENT-WIDTH-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 부모 폭 채우기 변경과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-WIDTH-BY-FIRST-CHILD-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_WIDTH_BY_FIRST_CHILD-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_WIDTH_BY_FIRST_CHILD-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-WIDTH-BY-FIRST-CHILD-01` 구현. `/div[1]` 툴바는 계속 부모 padding 영역 폭을 채우되, `/div[2]`는 더 이상 `w-full` 클래스로 부모 폭을 직접 따르지 않게 바꿨다. 대신 `/div[1]`의 실측 폭(`selectionAppearancePreviewWidthPx`)만 inline width로 적용하고, 측정 전 fallback으로만 `100%`를 사용한다. 이렇게 해서 두 번째 블록의 폭 기준은 항상 첫 번째 블록이 된다.
- 2026-05-12: `POSITION-STYLE-WIDTH-BY-FIRST-CHILD-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-WIDTH-BY-FIRST-CHILD-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-WIDTH-BY-FIRST-CHILD-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 브라우저 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-WIDTH-BY-FIRST-CHILD-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 오버레이 폭 기준 재조정과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_PREVIEW_CONTENT_FILL-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_PREVIEW_CONTENT_FILL-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` 원인 분석. 바깥 `/div[2]` 폭은 첫 번째 블록 기준으로 맞췄지만, 안쪽 content preview는 여전히 `180px` 고정폭으로 렌더되고 있었다. 그래서 바깥 테두리 폭이 맞아도 실제로 보이는 미리보기 박스가 중앙에 좁게 남아 “찌그러진” 상태로 보였다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` 구현. 안쪽 content preview의 width를 고정 수치가 아니라 `100%`로 변경했다. 이제 바깥 `/div[2]` 폭을 그대로 채우며, 높이만 시각화용 축소값을 유지한다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 브라우저 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-PREVIEW-CONTENT-FILL-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 미리보기 내용 폭 채우기 변경과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-HIT-AREAS-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_EDGE_CORNER_HIT_AREAS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_EDGE_CORNER_HIT_AREAS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-HIT-AREAS-01` 구현. `크기 및 위치 > 스타일`의 미리보기 박스에 캔버스와 같은 invisible edge hit-area 4개를 추가했고, 코너 라운딩 선택용 invisible corner hit-area 4개도 추가했다. 엣지 hit-area는 `borderWidth`, `borderColor`, `borderStyle` patch에 `targetBorderSides`를 실어 보내고, 코너 hit-area는 `borderRadius` patch에 `targetCorners`를 실어 보낸다. 박스 본체를 클릭하면 전체 엣지/전체 코너 대상으로 복귀한다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-HIT-AREAS-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-HIT-AREAS-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-HIT-AREAS-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 브라우저 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-HIT-AREAS-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 미리보기 엣지/코너 hit-area 추가와 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-VISUAL-STATE-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_EDGE_CORNER_VISUAL_STATE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_EDGE_CORNER_VISUAL_STATE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-VISUAL-STATE-01` 구현. 스타일 미리보기의 invisible edge/corner hit-area는 선택만 되는 상태에서 끝나지 않고, 선택된 엣지는 캔버스와 같은 계열의 파란 선으로, 선택된 코너는 파란 점으로 바로 보이게 바꿨다. 이 표시는 각각 `appearanceBoxModelTarget === 'border'`, `appearanceBoxModelTarget === 'corner'` 상태에서만 나타나며, 선택된 대상 배열(`appearanceTargetBorderSides`, `appearanceTargetCorners`)과 직접 연결된다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-VISUAL-STATE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-VISUAL-STATE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-VISUAL-STATE-01` chrome-devtools MCP 검증 시도. 이번 턴에도 `chrome-profile` lock 오류로 `list_pages` 재접속이 실패했다. 따라서 수정 후 브라우저 실측은 완료하지 못했다.
- 2026-05-12: `POSITION-STYLE-EDGE-CORNER-VISUAL-STATE-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 DB 인덱스/RLS 관련 항목이며 이번 스타일 미리보기 선택 상태 시각화 변경과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_SHIFT_DRAG_WIDTH_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_SHIFT_DRAG_WIDTH_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` 원인 분석. 스타일 오버레이 첫 줄(`/div[1]`)은 `w-full`로 렌더되어 실제 내용 폭보다 넓은 DOM 폭을 가지고 있었고, 둘째 줄(`/div[2]`)은 그 잘못된 측정값을 그대로 받아 더 넓게 보였다. 동시에 edge/corner hit-area는 단순 클릭 토글만 지원해, 사용자가 요청한 `Shift+클릭` 다중 선택과 `Shift+드래그` 추가 선택을 수행할 수 없었다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` 구현. 첫 줄 툴바는 `ml-auto + w-fit + max-w-full`로 바꿔 실제 내용 폭만 차지하게 했고, 둘째 줄 미리보기 박스는 계속 첫 줄의 실측 너비를 기준으로만 width를 받게 유지했다. 측정 전 fallback은 `100%`가 아니라 `fit-content`로 낮춰 첫 렌더의 과폭 현상도 줄였다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` 구현. 스타일 미리보기의 edge/corner hit-area는 일반 클릭 시 단일 선택, `Shift+클릭` 시 토글 선택, `Shift+드래그` 시 지나간 대상 추가 선택이 되도록 pointer drag 상태를 분리했다. 드래그가 실제로 발생하지 않은 `Shift+클릭`은 pointer up 시 토글로 확정되고, 드래그가 시작되면 시작 대상과 지나간 대상을 모두 선택 집합에 추가한다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 변경 파일에서 새 타입 오류를 특정한 결과는 아니다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` chrome-devtools MCP 검증 시도. `list_pages` 실행 시 `chrome-profile` lock 오류가 발생해 브라우저 연결에 실패했다. 따라서 이번 턴에서도 실제 페이지 DOM 폭과 hit-area 동작을 브라우저에서 재실측하지 못했다.
- 2026-05-12: `POSITION-STYLE-SHIFT-DRAG-WIDTH-FIX-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 foreign key index / RLS init plan / unused index 계열 항목이며 이번 스타일 오버레이 폭·선택 입력 수정과 직접 관련 없다.
- 2026-05-12: `POSITION-STYLE-VISIBLE-EDGE-BUTTONS-DRAG-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_VISIBLE_EDGE_BUTTONS_DRAG-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_VISIBLE_EDGE_BUTTONS_DRAG-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-VISIBLE-EDGE-BUTTONS-DRAG-01` 구현. 스타일 오버레이 첫 줄(`/div[1]`)과 둘째 줄(`/div[2]`)에서 `ml-auto`를 제거해 좌측 자동 마진을 없앴다. 따라서 첫 줄은 오버레이 패딩 기준 왼쪽부터 시작하고, 둘째 줄도 같은 축으로 정렬된다.
- 2026-05-12: `POSITION-STYLE-VISIBLE-EDGE-BUTTONS-DRAG-01` 구현. `/div[2]`의 상·하·좌·우 엣지 버튼과 4개 코너 버튼은 모두 `rounded-full` 형태로 바꾸고 `bg-sky-500/20` 계열의 상시 배경을 주었다. 선택 전에도 연한 파란 버튼이 항상 보이고, 선택된 경우에는 기존 활성 파란 선/점이 그 위에 추가로 출력된다.
- 2026-05-12: `POSITION-STYLE-VISIBLE-EDGE-BUTTONS-DRAG-01` 구현. 드래그 선택은 `상자 편집 캔버스`와 비슷하게 확장했다. 일반 클릭은 단일 선택, 일반 드래그는 시작 버튼에서 출발해 지나간 버튼을 추가 선택하고, `Shift+클릭`은 토글, `Shift+드래그`는 기존 선택에 추가하는 방식으로 처리한다.
- 2026-05-12: `POSITION-STYLE-VISIBLE-EDGE-BUTTONS-DRAG-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `POSITION-STYLE-EDGE-BUTTON-OPACITY-10-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_EDGE_BUTTON_OPACITY_10-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_EDGE_BUTTON_OPACITY_10-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-EDGE-BUTTON-OPACITY-10-01` 구현. 스타일 오버레이의 엣지 버튼과 코너 버튼 상시 배경색을 `bg-sky-500/20`에서 `bg-sky-500/10`으로 낮췄다. 내부 보조 오버레이도 동일하게 `10%` 투명도로 맞췄다. hover는 기본값보다 약간만 강한 `15%`로 유지했다.
- 2026-05-12: `POSITION-STYLE-TOGGLE-MODE-ONLY-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_TOGGLE_MODE_ONLY-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_TOGGLE_MODE_ONLY-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-TOGGLE-MODE-ONLY-01` 구현. 스타일 오버레이의 edge/corner 상시 배경에서 테두리를 제거했다. 이제 edge 모드일 때는 edge 버튼 상시 배경만 보이고, corner 모드일 때는 corner 버튼 상시 배경만 보인다. content 모드에서는 두 종류의 상시 배경이 모두 숨겨진다.
- 2026-05-12: `POSITION-STYLE-TOGGLE-MODE-ONLY-01` 구현. edge/corner 입력 모델에서 드래그 선택을 제거했다. 버튼은 클릭 시 활성화되고, 같은 버튼을 다시 클릭하면 비활성화된다. 다중 선택은 여러 버튼을 개별 클릭해 누적하는 방식만 유지한다.
- 2026-05-12: `POSITION-STYLE-TOGGLE-MODE-ONLY-01` 구현. edge/corner 선택 배열이 비어 있을 때 border/corner style patch가 전체 상자에 새지 않도록 no-op 보호를 추가했다. 따라서 선택 0개 상태에서 상단 입력을 바꿔도 전체 엣지 또는 전체 코너에 잘못 적용되지 않는다.
- 2026-05-12: `POSITION-STYLE-ROLE-WIDTH-OPACITY-20-01` 구현 전 백업을 `docs/diff/2026-05-12_POSITION_STYLE_ROLE_WIDTH_OPACITY_20-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_POSITION_STYLE_ROLE_WIDTH_OPACITY_20-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `POSITION-STYLE-ROLE-WIDTH-OPACITY-20-01` 구현. edge/corner 버튼의 상시 배경을 다시 `20%` 투명도(`bg-sky-500/20`)로 올렸다. hover는 `25%`로 유지했다.
- 2026-05-12: `POSITION-STYLE-ROLE-WIDTH-OPACITY-20-01` 구현. 스타일 미리보기 내부 content preview(`/div[2]/div`)는 더 이상 `role=button`, `tabIndex`, 클릭/키보드 선택 동작을 가지지 않는 일반 div 박스로 내렸다. 이 영역은 시각화만 담당하고, 내부 컨트롤만 독립적으로 입력을 받는다.
- 2026-05-12: `POSITION-STYLE-ROLE-WIDTH-OPACITY-20-01` 구현. 스타일 오버레이 content wrapper는 style 오버레이에 한해 `inline-flex + w-fit + flex-col + gap-2.5`로 바꿨고, 둘째 줄 미리보기 박스의 `mt-2.5`를 제거했다. 따라서 wrapper 내부에서 오른쪽으로 남던 한쪽 여백을 없애고, 첫 줄과 둘째 줄이 내용 폭 기준으로 바로 붙는다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 구현 전 백업을 `docs/diff/2026-05-12_GROUP_STYLE_MEMBER_APPLY_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-12_GROUP_STYLE_MEMBER_APPLY_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 원인 분석. 스타일 draft는 이미 `resolveFrameLayoutShell(node)` 기준으로 읽고 있었지만, 실제 patch 적용은 raw frame node 기준으로 수행하고 있었다. 이 불일치 때문에 `band-0-header`처럼 shell이 실제 배경/윤곽선을 그리는 상자는 스타일 입력이 보이지 않거나 불완전하게 적용됐다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 구현. `applyFrameStylePatch()`는 이제 배경색, 윤곽선, 코너 라운딩을 raw frame node가 아니라 frame shell(`.v102-frame-band`)에 적용한다. 기존 잘못된 raw node 배경색은 shell과 다를 때 즉시 비워 stale style이 남지 않게 했다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 구현. `크기 및 위치 > 스타일`의 적용 대상 계산은 position 탭에서 `selectedPositionResolvedFrameGroupIds`를 우선 사용한다. 따라서 그룹을 선택하고 스타일을 바꾸면 그룹 wrapper 자체가 아니라 그 그룹에 귀속된 member frame들만 일괄 반영된다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 구현. autosize 재계산도 `selectedFrameGroupIdsRef.current` 전체가 아니라 실제 style target node에서 역산한 frameGroupId 집합만 사용하도록 바꿨다. 따라서 그룹 proxy selection, 중첩 그룹 선택, 직접 box 선택이 섞여도 스타일 변경 후 재계산 대상이 실제 member frame과 일치한다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정 파일에서 새 TypeScript 오류가 추가로 확인된 것은 아니다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` chrome-devtools MCP 검증 시도. `list_pages` 실행 시 기존과 동일하게 `chrome-profile` lock 오류가 발생해 브라우저 연결에 실패했다. 따라서 이번 턴에서도 실제 캔버스에서 그룹 선택 후 style 반영을 브라우저로 재실행하지 못했다.
- 2026-05-12: `GROUP-STYLE-MEMBER-APPLY-FIX-01` Supabase MCP 검증. `get_advisors(type=performance)`를 실행했다. 이번 변경은 DB schema/data write 또는 SQL 실행을 포함하지 않는다. 반환된 advisory는 기존 foreign key index / RLS init plan / unused index 계열 항목이며 이번 그룹 스타일 적용 수정과 직접 관련 없다.
- 2026-05-13: `GROUP-STYLE-EDGE-DEFAULT-SCOPE-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_GROUP_STYLE_EDGE_DEFAULT_SCOPE_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_GROUP_STYLE_EDGE_DEFAULT_SCOPE_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `GROUP-STYLE-EDGE-DEFAULT-SCOPE-FIX-01` 원인 분석. 스타일 오버레이는 선택이 바뀔 때마다 `appearanceTargetBorderSides`, `appearanceTargetCorners`를 빈 배열로 초기화한다. 그런데 `borderWidth`, `borderColor`, `borderStyle`, `borderRadius` patch 생성 시 이 빈 배열을 그대로 넘기고 있었고, `applyFrameStylePatch()`는 `targetBorderSides.length === 0`이면 의도적으로 no-op 처리한다. 그 결과 그룹을 선택한 뒤 선 두께를 바꾸거나 `band-0-header` 같은 상자를 선택한 뒤 선 관련 스타일을 바꿔도 실제 shell에는 아무 반영이 일어나지 않았다.
- 2026-05-13: `GROUP-STYLE-EDGE-DEFAULT-SCOPE-FIX-01` 구현. 선택 또는 탭 전환 시 appearance target 모드를 `content`로 함께 되돌린다. 따라서 edge/corner 세부 선택을 시작하지 않은 기본 상태에서는 상자 전체 스타일 편집 모드로 복귀한다.
- 2026-05-13: `GROUP-STYLE-EDGE-DEFAULT-SCOPE-FIX-01` 구현. `applySelectionStyleDraft()`, `applyStyleFieldOnBlur()`, `applyStyleFieldImmediateValue()`는 이제 `appearanceBoxModelTarget === 'border'`일 때만 `targetBorderSides`를 patch에 포함하고, `appearanceBoxModelTarget === 'corner'`일 때만 `targetCorners`를 포함한다. 기본 `content` 상태에서는 `undefined`를 넘겨 전체 엣지/전체 코너에 정상 반영된다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_GROUP_STYLE_VISIBLE_BORDER_COLOR_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_GROUP_STYLE_VISIBLE_BORDER_COLOR_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` 원인 분석. 그룹 선택 시 스타일 patch는 member shell까지 도달했지만, 기존 border color가 `transparent`인 상자에서 선 두께 또는 선 종류만 바꾸면 patch가 그 투명 색을 그대로 유지했다. 그 결과 `band-0-header`, `band-1-header`처럼 값은 적용됐는데 사용자는 “아무 스타일도 안 바뀐다”고 보게 됐다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` 구현. `applyElementBorderAppearanceStylePatch()`와 `applyElementBorderSideAppearanceStylePatch()`는 이제 사용자가 border color를 명시적으로 바꾸지 않은 상태에서 보이는 border를 새로 만들면, 기존 색이 `transparent`일 경우 기본 visible color `#0f172a`를 자동으로 채운다. 반대로 사용자가 `transparent`를 명시적으로 고른 경우에는 그 의도를 유지한다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `STYLE-OVERLAY-PADDING-DOUBLE-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_OVERLAY_PADDING_DOUBLE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_OVERLAY_PADDING_DOUBLE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-OVERLAY-PADDING-DOUBLE-01` 구현. `크기 및 위치 > 스타일` 오버레이 body wrapper(`/html/body/main/main/div/div/div[4]/div/div[3]/div[3]/div/div`)의 패딩을 `p-2`에서 `p-4`로 2배 확장했다. 다른 오버레이의 공통 body 패딩은 유지하고, 스타일 오버레이 분기만 조정했다.
- 2026-05-13: `STYLE-PREVIEW-DASHED-RADIUS-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_PREVIEW_DASHED_RADIUS_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_PREVIEW_DASHED_RADIUS_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-PREVIEW-DASHED-RADIUS-FIX-01` 구현. 스타일 preview box에서 `외곽선 타입 = 없음`일 때 쓰던 centered dashed `outline`을 제거하고, 반지름을 따라가는 별도 dashed overlay 레이어로 교체했다. overlay는 `inset = -(선두께 / 2)`와 `borderRadius = 기존 반지름 + 선두께/2`를 사용해 경계 중앙선 기준 위치는 유지하면서도 코너 라운딩을 자연스럽게 따른다.
- 2026-05-13: `STYLE-PREVIEW-DASHED-RADIUS-FIX-01` 보완. preview 내부 content 영역에도 같은 `borderRadius`와 `overflow: hidden`을 적용했다. 따라서 투명 체커보드/배경색 레이어가 코너 안쪽에서 사각형으로 남아 dashed guide를 잘라 보이게 하는 현상을 제거했다.
- 2026-05-13: `STYLE-PREVIEW-PER-SIDE-CORNER-RENDER-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_PREVIEW_PER_SIDE_CORNER_RENDER-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_PREVIEW_PER_SIDE_CORNER_RENDER-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-PREVIEW-PER-SIDE-CORNER-RENDER-01` 구현. `크기 및 위치 > 스타일` preview box는 더 이상 `selectionStyleDraft`의 단일 `borderWidth/borderStyle/borderColor/borderRadius` 값만으로 그리지 않는다. 현재 선택된 style target shell에서 각 엣지의 `width/style/color`와 각 코너의 반지름을 직접 읽어 preview에 side/corner별로 반영한다. 따라서 한 상자 안에서 상·하·좌·우 엣지 스타일이 서로 다르거나, 네 코너 라운딩 값이 서로 달라도 preview box가 실제 상태를 따라간다.
- 2026-05-13: `STYLE-PREVIEW-PER-SIDE-CORNER-RENDER-01` chrome-devtools MCP 검증. 실제 캔버스에서 그룹 선택을 한 번 더 클릭해 단일 `v102-frame-band` 선택으로 순환한 뒤, 선택된 shell에 서로 다른 `top/right/bottom/left` border width/style/color와 `top-left/top-right/bottom-right/bottom-left` radius를 주입해 preview box를 재확인했다. 검증 시 preview computed style은 `top=5px solid`, `right=2px dotted`, `bottom=1px dashed`, `left=3px solid`, `TL=14px`, `TR=2px`, `BR=3px`, `BL=9px`로 각각 갈라져 출력됐다.
- 2026-05-13: `STYLE-SCOPE-MIXED-DISABLED-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_SCOPE_MIXED_DISABLED-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_SCOPE_MIXED_DISABLED-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-SCOPE-MIXED-DISABLED-01` 구현. `크기 및 위치 > 스타일`의 상단 입력은 이제 현재 선택된 엣지/코너 범위를 기준으로 실제 값을 다시 계산한다. 엣지 모드에서는 선택된 엣지들(없으면 전체 4변), 코너 모드에서는 선택된 코너들(없으면 전체 4코너)을 기준으로 `borderWidth`, `borderStyle`, `borderColor`, `borderRadius`의 공유값 여부를 판정한다. 값이 하나로 같지 않으면 대표값을 보여주지 않고 `혼합`으로 식별한다.
- 2026-05-13: `STYLE-SCOPE-MIXED-DISABLED-01` 구현. 코너 수정 모드에서는 `선 두께`, `선색`, `외곽선 타입`, `외곽선 정렬`을 회색 disabled 상태로 바꾸고, 엣지 수정 모드에서는 `코너 라운딩`을 회색 disabled 상태로 바꾼다. disabled 상태에서는 클릭/입력으로 다른 카테고리 값을 수정할 수 없다.
- 2026-05-13: `STYLE-SCOPE-MIXED-DISABLED-01` 구현. numeric input이 `혼합` 표시 상태일 때 사용자가 값을 입력하지 않고 blur하면 빈 문자열을 patch로 적용하지 않도록 보호했다. 따라서 여러 값이 섞인 상태를 단순 포커스/blur만으로 지워버리지 않는다.
- 2026-05-13: `RUNTIME-HAS-APPEARANCE-SELECTION-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_RUNTIME_HAS_APPEARANCE_SELECTION_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_RUNTIME_HAS_APPEARANCE_SELECTION_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `RUNTIME-HAS-APPEARANCE-SELECTION-FIX-01` 구현. `renderStyleColorPicker()`는 `renderSelectionAppearanceControls()` 내부 전용 상태인 `hasAppearanceSelection`을 잘못 참조하고 있었다. 이 참조를 제거하고 hidden input 값을 다시 `selectionStyleDraft[field]`로 고정해 `ReferenceError: hasAppearanceSelection is not defined` 런타임 오류를 없앴다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` chrome-devtools MCP 검증. 분리된 Chrome DevTools 세션에서 `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`를 열고 `band-0-header` 영역을 실제 클릭해 `그룹 2(position-box-mp1689ha)`를 선택한 뒤 선 두께를 `3`으로 반영했다. 검증 결과 그룹 wrapper는 계속 `border: 0`, `background: transparent` 상태를 유지했고, 그룹 member shell인 `band-0-header`, `band-1-header`는 모두 `data-template-frame-border-width=\"3\"`, `data-template-frame-border-color=\"#0f172a\"`, `border-style: solid`로 바뀌었다. 이후 `band-0-header`를 다시 클릭해 단일 상자 선택으로 순환한 뒤에도 해당 shell에 같은 윤곽선이 유지되어, 그룹 스타일은 wrapper가 아니라 귀속 상자에 적용되고 `band-0-header` 단일 적용도 정상 동작함을 확인했다.
- 2026-05-13: `GROUP-STYLE-VISIBLE-BORDER-COLOR-FIX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_OVERLAY_FIT_WIDTH-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_OVERLAY_FIT_WIDTH-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` 원인 분석. 스타일 오버레이는 `renderFloatingOverlaySection()`의 공통 기본 확장 폭 `w-[30rem] max-w-[calc(100%_-_1.5rem)]`를 그대로 사용하고 있었다. 이 때문에 내부 `/div/div`가 내용 폭 기준으로 줄어들어도 상위 `/div[3]` 자체는 30rem로 남아, 사용자가 본 것처럼 바깥에 불필요한 여백이 계속 유지됐다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` 구현. 스타일 오버레이 호출부만 별도 `expandedWidthClassName: 'w-fit max-w-[calc(100%_-_1.5rem)]'`를 넘기도록 바꿨다. 따라서 요약/속성/기능 버튼의 기존 폭 정책은 유지하면서, 스타일 오버레이만 내부 실제 내용 폭에 맞춰 축소된다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` chrome-devtools MCP 검증. 분리된 Chrome DevTools 세션에서 스타일 오버레이를 다시 열어 측정했다. 오버레이 최상위 wrapper는 `w-fit`로 렌더되어 실제 폭이 `436.16px`였고, 내부 content wrapper는 `434.16px`, 첫 번째 자식 grid는 `418.16px`, 두 번째 자식 preview box는 `418px`로 측정됐다. 즉 상위 `/div[3]`의 30rem 고정 폭이 사라졌고, 내부 두 자식은 내용 폭 기준으로만 맞춰져 바깥쪽 빈 여백이 제거됐다.
- 2026-05-13: `STYLE-OVERLAY-FIT-WIDTH-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_FIELD_MODE_HINT-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_FIELD_MODE_HINT-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` 원인 분석. 스타일 오버레이는 선/코너 관련 값이 바뀐 뒤 실제 적용은 되더라도, 사용자 입력 경로에 따라 `appearanceBoxModelTarget`이 항상 즉시 `border` 또는 `corner`로 전환되지 않았다. 그 결과 엣지/코너를 직접 고르지 않고 값을 수정할 때 어떤 선택군이 관련되는지 시각적으로 충분히 드러나지 않았다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` 구현. `APPEARANCE_TARGET_BY_STYLE_FIELD`를 상수로 분리하고, 선/코너 관련 필드의 `onFocus`뿐 아니라 `onChange` 경로에서도 해당 appearance mode를 강제로 동기화한다. 따라서 선 두께·선색·선 타입·선 정렬을 수정하면 엣지 배경이 즉시 보이고, 코너 라운딩을 수정하면 코너 배경이 즉시 보인다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` chrome-devtools MCP 검증. 분리된 Chrome DevTools 세션에서 스타일 오버레이를 연 뒤 `코너 라운딩` 입력을 실제 포커스했을 때 코너 hit-area 4개가 모두 `bg-sky-500/20` 상태로 전환되는 것을 확인했다. 이어서 `선 두께` 입력을 실제 클릭했을 때 엣지 hit-area 4개가 모두 `bg-sky-500/20` 상태로 전환되는 것도 확인했다. 즉 엣지/코너를 미리 직접 고르지 않아도 관련 입력을 수정하는 순간 필요한 선택군이 시각적으로 강조된다.
- 2026-05-13: `STYLE-FIELD-MODE-HINT-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `STYLE-HINT-EMPTY-SELECTION-CLEAR-VALUES-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_HINT_EMPTY_SELECTION_CLEAR_VALUES-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_HINT_EMPTY_SELECTION_CLEAR_VALUES-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-HINT-EMPTY-SELECTION-CLEAR-VALUES-01` 구현. 선택이 없을 때 스타일 오버레이의 `선 색`, `외곽선 타입`, `외곽선 정렬`은 실제 값을 출력하지 않고 일반 라벨만 보이도록 바꿨다. 동시에 선/코너 관련 힌트는 선택이 없으면 켜지지 않게 했고, 수치/색상 입력값을 비운 상태에서는 엣지/코너 배경 강조가 즉시 내려가도록 정리했다. `borderAlign`의 공통 fallback `inside`도 제거해 no-selection 상태에서 잘못된 기본값이 보이지 않게 했다.
- 2026-05-13: `STYLE-HINT-EMPTY-SELECTION-CLEAR-VALUES-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `STYLE-HINT-EMPTY-SELECTION-CLEAR-VALUES-01` chrome-devtools MCP 검증. 선택이 없는 상태에서 스타일 오버레이를 열었을 때 `선 두께`, `코너 라운딩` 입력은 빈 값으로 보였고, `선 색 선택`, `외곽선 타입`, `외곽선 정렬`은 값 대신 일반 라벨만 노출됐다. 이어서 선택이 없는 상태에서 `선 두께` 입력과 `외곽선 타입` 버튼을 실제 클릭해도 엣지/코너 hit-area 배경은 모두 `rgba(0, 0, 0, 0)`로 유지되어 강조가 생기지 않음을 확인했다.
- 2026-05-13: `STYLE-HINT-EMPTY-SELECTION-CLEAR-VALUES-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `STYLE-TARGET-STALE-ACTIVE-RESET-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_TARGET_STALE_ACTIVE_RESET-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_TARGET_STALE_ACTIVE_RESET-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-TARGET-STALE-ACTIVE-RESET-01` 구현. appearance target을 `content`로 전환할 때 이전 엣지/코너 선택 배열도 같이 비우도록 바꿨다. 또한 `border -> corner`, `corner -> border` 전환 시 반대편 선택 배열을 함께 제거해 이전 활성 대상이 다시 떠오르지 않게 했다. `width`, `height`, `backgroundColor` 같은 content 계열 필드를 클릭하면 즉시 content 모드로 돌아가며 stale target 상태가 정리된다.
- 2026-05-13: `STYLE-TARGET-STALE-ACTIVE-RESET-01` 구현. border/corner 입력 포커스는 현재 값과 실제 선택 상태를 함께 보고 동작하게 바꿨다. 선택 항목이 없으면 항상 content로 정리되고, 값이 비어 있을 때는 명시적인 엣지/코너 선택이 없는 경우에만 힌트를 내린다. 반대로 border color/style 같은 버튼 계열은 실제 수정 동작에 들어갈 때만 border 모드가 활성화된다.
- 2026-05-13: `STYLE-TARGET-STALE-ACTIVE-RESET-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `STYLE-TARGET-STALE-ACTIVE-RESET-01` chrome-devtools MCP 검증. 선택이 없는 상태에서 스타일 오버레이를 열어 `선 두께` 입력과 `외곽선 타입` 버튼을 순서대로 실제 클릭했을 때 엣지/코너 hit-area 배경은 끝까지 `rgba(0, 0, 0, 0)`로 유지됐다. 또한 같은 상태에서 `선 색`, `외곽선 타입`, `외곽선 정렬`은 각각 `선 색 선택`, `외곽선 타입`, `외곽선 정렬` 라벨만 보이고 이전 값 텍스트가 복귀하지 않음을 확인했다.
- 2026-05-13: `STYLE-TARGET-STALE-ACTIVE-RESET-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `STYLE-TARGET-TOGGLE-CLEAR-DASH-CENTER-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_TARGET_TOGGLE_CLEAR_DASH_CENTER-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_TARGET_TOGGLE_CLEAR_DASH_CENTER-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-TARGET-TOGGLE-CLEAR-DASH-CENTER-01` 구현. 엣지/코너 버튼을 다시 눌러 마지막 선택이 해제되면 appearance target을 즉시 `content`로 되돌리도록 바꿨다. 그래서 `aria-pressed=false` 상태인데도 배경이 남아 있는 stale 활성화가 생기지 않는다. 동시에 border placeholder가 `없음`일 때는 border 대신 centered dashed outline을 사용해 점선이 preview box 경계의 중앙선에 오도록 정리했다.
- 2026-05-13: `STYLE-TARGET-TOGGLE-CLEAR-DASH-CENTER-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `STYLE-TARGET-TOGGLE-CLEAR-DASH-CENTER-01` chrome-devtools MCP 검증. 실제 캔버스에서 상자를 선택한 뒤 스타일 오버레이의 `상 엣지 선택`을 눌러 활성화하고 다시 한 번 눌러 해제했을 때, 4개 엣지 버튼 모두 `aria-pressed=false`와 함께 배경색이 `rgba(0, 0, 0, 0)`로 돌아가는 것을 확인했다. 이어서 `외곽선 타입 -> 없음`을 선택했을 때 preview box는 `border: none`, `outline: rgba(15, 23, 42, 0.35) dashed 2px`, `outlineOffset: -1px` 상태로 바뀌어 점선이 중앙선 기준으로 출력되는 것도 확인했다.
- 2026-05-13: `STYLE-TARGET-TOGGLE-CLEAR-DASH-CENTER-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_CORNER_BLUR_EDIT_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_CORNER_BLUR_EDIT_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` 원인 분석. `크기 및 위치 > 스타일`의 numeric input은 `selectionStyleDraft`가 아니라 preview shell에서 다시 읽은 `borderFieldDisplayState` 값을 controlled value로 사용하고 있었다. 그래서 `position-box-mp1689ha`를 선택한 뒤 `좌상`, `우상` 코너를 고르고 `코너 라운딩`에 숫자를 입력해도, `onChange`가 draft를 갱신한 직후 다음 렌더에서 blur 전 실제 DOM 값(`0`)으로 다시 그려져 입력값이 바로 사라졌다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` 구현. `activeInlineStyleField` 상태를 추가해 현재 편집 중인 numeric field는 live DOM 값이 아니라 draft 값을 직접 렌더하도록 바꿨다. 포커스 시 혼합값이면 draft를 빈 문자열로 초기화하고, 단일값이면 현재 표시값으로 동기화한다. 따라서 입력 중에는 숫자가 유지되고, patch는 계속 blur 시점에만 전송된다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` chrome-devtools MCP 검증. 실제 캔버스에서 `band-0-header`를 클릭해 그룹 proxy `position-box-mp1689ha`를 선택한 뒤 `좌상 코너 선택`, `우상 코너 선택`을 눌렀다. 그 상태에서 `코너 라운딩` 입력에 `12`를 넣었을 때 blur 전 input 값이 `012`로 유지되고 preview radius는 즉시 바뀌지 않았다. 이어서 input을 blur했을 때 preview의 `borderTopLeftRadius`, `borderTopRightRadius`만 `12px`로 바뀌고 `borderBottomLeftRadius`, `borderBottomRightRadius`는 `0px`로 유지되어, 실시간 반영 없이 blur 시점에만 선택 코너 두 곳에 적용되는 것을 확인했다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` 추가 chrome-devtools MCP 검증. 같은 상태에서 `코너 라운딩` 입력의 기존 값 `12`를 선택한 뒤 `18`을 다시 입력했을 때, blur 전 preview의 `borderTopLeftRadius`, `borderTopRightRadius`는 계속 `12px`를 유지했다. 이후 preview box를 클릭해 input이 비활성화되자 두 값만 `18px`로 갱신되어, 마우스로 다른 곳을 눌렀을 때도 blur 시점 반영 규칙이 지켜지는 것을 확인했다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `STYLE-CORNER-BLUR-EDIT-FIX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 구현 전 백업을 `docs/diff/2026-05-13_POSITION_TEXT_STYLE_MOVE-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_POSITION_TEXT_STYLE_MOVE-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 구현. `크기 및 위치` 탭의 기존 `스타일` 오버레이 라벨을 `상자 스타일`로 변경했다. 동시에 텍스트 탭의 서식 제어 묶음을 `크기 및 위치` 탭으로 옮겨 새 floating overlay `텍스트 스타일`로 분리했다. 오버레이 스택 순서도 `요약 -> 상자 스타일 -> 텍스트 스타일 -> 기능 버튼`으로 확장했다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 구현. preview surface props와 floating overlay id 집합에 `textStyle`을 추가하고, `TemplateEditPreviewSurface`가 `텍스트 스타일` 오버레이를 독립적으로 접기/펼치기/이동할 수 있게 확장했다. 기존 `크기 및 위치` 탭의 box style 렌더러는 `renderPositionBoxStyleOverlay()`, 텍스트 서식 렌더러는 `renderPositionTextStyleOverlay()`로 분리했다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 구현. 캔버스 편집 권한 계산을 `selectionPanelTab === 'text'` 고정 조건에서 `isTextCanvasEditModeActive` 파생 상태로 바꿨다. 이 값은 `텍스트` 탭에서는 항상 `true`이고, `크기 및 위치` 탭에서는 `텍스트 스타일` 오버레이가 펼쳐진 동안에만 `true`다. 따라서 `크기 및 위치` 탭에서 `텍스트 스타일`을 열면 텍스트 탭과 동일하게 상자 클릭 시 텍스트 입력 포커스, textarea/contenteditable 편집, autosize 입력 경로가 즉시 활성화된다. 오버레이를 접으면 다시 읽기 전용/포인터 차단 상태로 복귀한다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 구현. `applyPreviewEditPermissions()`는 `selectionPanelTab`만 보지 않고 `textCanvasEditMode` 플래그를 함께 받아 preview root에 `data-v106-text-canvas-edit-mode`를 기록한다. 이 속성을 기준으로 `data-template-frame-input="true"`와 `data-template-edit-scope` 편집 허용 CSS selector를 확장해 `크기 및 위치` 탭의 `텍스트 스타일` 활성화 상태에서도 텍스트 상자 입력이 열리도록 맞췄다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` chrome-devtools MCP 검증. 페이지를 새로고침한 뒤 콘솔을 다시 확인했을 때, 이전 Fast Refresh 중간 단계에서만 보이던 `useLayoutEffect dependency array size changed` 경고는 더 이상 재현되지 않았고 접근성 issue 2건만 남았다. 즉 이번 최종 상태에서는 훅 경고가 고정 결함으로 남아 있지 않다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` chrome-devtools MCP 검증. `크기 및 위치` 탭에서 overlay 버튼 구성을 확인한 결과 `요약`, `상자 스타일`, `텍스트 스타일`, `기능 버튼`이 동시에 노출됐다. `텍스트` 탭으로 이동했을 때는 `요약`만 남고 `텍스트 스타일` overlay는 더 이상 텍스트 탭에 출력되지 않았다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` chrome-devtools MCP 검증. `크기 및 위치` 탭에서 `텍스트 스타일`을 펼친 상태에서는 preview root의 `data-v106-text-canvas-edit-mode="true"`, 첫 번째 `data-template-frame-input="true"` textarea의 `readOnly=false`, `pointer-events=auto`를 확인했다. 다시 `텍스트 스타일`을 접으면 같은 요소가 `readOnly=true`, `pointer-events=none`으로 돌아가 `크기 및 위치` 탭의 기본 읽기 전용 상태가 복구되는 것도 확인했다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` chrome-devtools MCP 검증. `텍스트` 탭 자체로 이동했을 때는 `텍스트 스타일` 오버레이가 없어도 캔버스 textarea들이 editable 상태로 유지됐다. 즉 이번 변경은 텍스트 탭의 기존 입력/선택 동작을 지우지 않고, 그와 동일한 편집 모드를 `크기 및 위치 > 텍스트 스타일`에서도 재사용하도록 확장한 것이다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `POSITION-TEXT-STYLE-MOVE-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_OVERLAY_REFLOW_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_OVERLAY_REFLOW_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 원인 분석. `크기 및 위치 > 텍스트 스타일`을 열 때 실제로 필요한 것은 text edit permission 전환뿐인데, 기존 구현은 `isTextCanvasEditModeActive`를 `schedulePreviewEditorState`, `applyRuntimeSelectionUi`, `applyRuntimeSelectionVisuals`, `rehydratePreviewEditorStateNow`, 핵심 selection reapply `useLayoutEffect`의 dependency에 직접 묶어 두고 있었다. 그 결과 오버레이를 여는 순간 position selection/group wrapper/style recalculation이 통째로 다시 돌았고, 브라우저에서 mutation observer로 확인했을 때 `template-position-group-wrapper` style 변경과 다수 textarea `readonly/tabindex/style` 변경이 한 번에 발생했다. 사용자가 본 “상자가 화면 밖으로 나갔다가 다시 출력되는” 느낌은 이 과한 재계산과 재도장의 부산물이다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 원인 분석. 추가로 `applyPreviewEditPermissions()`는 text mode 활성화 시 preview 내부의 모든 `data-template-frame-input="true"` 요소를 즉시 `readonly=false`, `tabIndex=0`, `pointer-events=auto`로 바꾸고 있었다. 이 페이지에는 해당 textarea/input이 54개 존재하므로, 오버레이 버튼 한 번에 모든 입력창 속성을 갈아치우는 불필요한 mutation이 발생했다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 구현. `isTextCanvasEditModeActive`는 별도 ref(`textCanvasEditModeActiveRef`)로 유지하고, 비싼 selection/layout callback들은 dependency에서 이 값을 제거했다. 대신 별도 `useLayoutEffect` 하나에서만 `applyPreviewEditPermissions(root, selectionPanelTab, isTextCanvasEditModeActive)`를 실행해, 텍스트 스타일 열기/닫기가 편집 권한만 바꾸고 position selection/layout 재계산 자체는 다시 돌리지 않도록 분리했다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 구현. `applyFrameTextEditingMode()`는 text mode를 켤 때 더 이상 preview 안의 모든 textarea/input을 일괄 editable로 바꾸지 않는다. 이제 열기 시점에는 root permission attr과 CSS 기반 pointer gating만 바뀌고, 실제 입력창은 사용자가 해당 상자를 클릭했을 때 `focusFrameTextInputForEditing()` 경로에서만 개별적으로 활성화된다. 반대로 text mode를 끌 때는 기존처럼 전체 입력을 다시 readonly로 돌려 편집 종료 상태를 보장한다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 구현. text mode에서 textarea 자체를 직접 클릭한 경우에는 기존의 `enableFrameTextInputForEditing()` 단순 호출 대신 `focusFrameTextInputForEditing()`로 바꿨다. 따라서 전역 editable 전환을 없앤 뒤에도 textarea를 직접 눌렀을 때 즉시 포커스와 caret 배치가 유지된다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` chrome-devtools MCP 재현. 수정 전 분리 Chrome 세션에서 mutation observer를 걸고 `텍스트 스타일`을 열었을 때 preview 내부 mutation이 282건까지 발생했고, 샘플에는 `template-position-group-wrapper` style 변경과 다수 `v202-frame-group-input`의 `readonly/tabindex/style` 변경이 포함됐다. 즉 오버레이 클릭 한 번이 레이아웃/선택/입력 상태를 한꺼번에 흔드는 것이 브라우저 수준에서 확인됐다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` chrome-devtools MCP 사후 확인. 수정 후 새로고침 기준으로 콘솔에는 기존의 hook dependency 경고나 runtime error가 남지 않았고, 텍스트 편집 권한 토글은 별도 effect로 분리된 상태를 확인했다. 다만 이 턴의 MCP click은 floating overlay header의 pointer-driven toggle을 안정적으로 재현하지 못해, 동일한 open click을 도구로 다시 완전 자동 검증하는 데에는 한계가 있었다. 따라서 사후 검증은 코드 경로 분리와 mutation 원인 제거를 기준으로 기록한다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-REFLOW-FIX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_OVERLAY_FIRST_FRAME_CLAMP_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_OVERLAY_FIRST_FRAME_CLAMP_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` 원인 분석. `크기 및 위치 > 텍스트 스타일` 오버레이는 접힌 상태에서 펼침 상태로 전환되는 첫 렌더에서, pinned 위치 계산이 아직 접힌 DOM 폭(`111px`)을 기준으로 수행되고 있었다. 그 결과 첫 프레임에는 `left=615`, `width=670`, `right=1285`처럼 오버레이가 오른쪽으로 튄 뒤, 다음 프레임의 ResizeObserver/viewport revision 이후에만 `right=726`으로 다시 clamp 되었다. 사용자가 본 “매우 짧게 오른쪽으로 확장했다가 돌아오는” 현상은 이 1프레임 위치 오차였다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` 구현. 오버레이 고정 위치 계산에 `readFloatingOverlayFallbackWidth()`를 추가하고, 펼침 상태에서는 실제 측정값이 fallback보다 작더라도 `Math.max(measuredWidth, fallbackWidth)`를 사용하도록 바꿨다. 텍스트 스타일 오버레이는 첫 펼침부터 고정 확장 폭 `672px`를 기준으로 pinned left/right를 계산하고, stack 높이 계산도 같은 방식으로 펼침 fallback height를 우선 반영한다. 따라서 접힌 헤더 폭을 기준으로 한 1프레임 오버슈트가 발생하지 않는다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` chrome-devtools MCP 재현 및 사후 검증. 새로고침 직후 `텍스트 스타일 열기 및 위치 이동` 버튼을 실제 PointerEvent 시퀀스로 눌러 프레임별 rect를 샘플링했다. 수정 전 기록은 `before right=726 -> first frame right=1285, width=670 -> second frame right=726`이었다. 수정 후 동일한 계측에서는 `before right=726, width=111 -> first frame right=726, left=56, width=670`으로 바로 정착했고, 이후 프레임에서도 `right=726`이 유지됐다. 즉 사용자가 본 오른쪽 순간 확장 구간은 브라우저 측 계측으로 제거됐다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `TEXT-STYLE-OVERLAY-FIRST-FRAME-CLAMP-FIX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_FLOATING_OVERLAY_COLLAPSE_STALE_SIZE_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_FLOATING_OVERLAY_COLLAPSE_STALE_SIZE_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` 원인 분석. `크기 및 위치` 탭의 오버레이 버튼 클릭 시 UI가 흔들리던 실제 원인은 열기뿐 아니라 접기 첫 프레임에도 있었다. 오른쪽에 고정되는 오버레이가 접힐 때 pinned 위치 계산은 직전 확장 폭을 잠깐 그대로 사용했고, 공통 collapsed fallback width `96px`도 `상자 스타일(실제 104px)`, `텍스트 스타일(113px)`, `기능 버튼(94px)`처럼 서로 다른 접힘 폭을 반영하지 못했다. 그 결과 첫 프레임에는 우측 경계가 잠깐 어긋나거나, 다음 프레임에서만 원위치로 clamp 되는 현상이 반복됐다.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` 구현. 오버레이 pinned 위치 계산은 접힘 상태에서 더 이상 직전 측정 폭/높이를 그대로 쓰지 않는다. collapse 시에는 `Math.min(measuredSize, collapsedFallbackSize)`, expand 시에는 `Math.max(measuredSize, expandedFallbackSize)`를 사용해 stale expanded size가 첫 프레임에 끼어들지 않도록 바꿨다. 동시에 collapsed fallback width를 오버레이별 실제 wrapper 폭으로 분리했다: `요약=73`, `상자 스타일=104`, `텍스트 스타일=113`, `기능 버튼=94`, `상자명=78`, `상자 역할 - 1/2=124`, `상자 연결=90`.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` chrome-devtools MCP 검증. 새로고침 후 `상자 스타일`, `텍스트 스타일`, `기능 버튼`을 순서대로 열고 다시 접는 PointerEvent 시퀀스를 직접 실행해 프레임별 rect를 측정했다. 수정 전에는 `기능 버튼 접기`에서 `after1 right=724 -> after2 right=726`, `상자 스타일 접기`와 `텍스트 스타일 접기`에서는 `right=734/743`처럼 접힘 첫 프레임 오차가 남아 있었다. 수정 후 동일 계측에서 `기능 버튼 열기`는 `after1 right=726 -> after2 right=726`, `텍스트 스타일 열기`는 `after1 right=726 -> after2 right=726`, `상자 스타일 열기`는 `after1 right=726 -> after2 right=726`으로 모두 첫 프레임부터 고정됐다. 즉 `크기 및 위치` 탭 오버레이 버튼 클릭에 따라 UI가 잠깐 파괴되던 stale-size 경로는 브라우저 기준으로 제거됐다.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `FLOATING-OVERLAY-COLLAPSE-STALE-SIZE-FIX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_POSITION_OVERLAY_STACK_VISIBLE_QUADRANT_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_POSITION_OVERLAY_STACK_VISIBLE_QUADRANT_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 원인 분석. `크기 및 위치` 탭 오버레이는 동일 사분면에서 세로 순서를 유지하더라도, pinned 위치 계산에 접힘 fallback 크기와 확장 실측 크기를 동시에 섞고 있었다. 특히 펼침 상태에서는 `Math.max(measured, fallback)`을 그대로 사용해 `상자 스타일`처럼 실제 확장 폭(`470px`)보다 큰 fallback 폭(`480px`)을 기준으로 left를 계산했다. 그 결과 우측 사분면에서 `상자 스타일`, `텍스트 스타일`, `기능 버튼`의 right edge와 수직 간격이 클릭 직후 깨지는 상태가 남아 있었다. 또한 stack gap도 visible height와 total height로 다시 분배되고 있어, 내용 높이가 달라지면 같은 사분면 안의 간격이 고정되지 않았다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 구현. 오버레이 크기 계산을 `readFloatingOverlayResolvedSize()`로 분리했다. 접힘 상태는 접힘 실측과 접힘 fallback 중 작은 값을, 펼침 상태는 “이미 확장된 실측인지”를 먼저 판별한 뒤 확장 실측 또는 확장 fallback 중 하나만 사용한다. 따라서 첫 프레임 stale collapsed size는 계속 막으면서도, 안정화 이후에는 실제 확장 폭/높이만 기준으로 pinned 위치를 계산한다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 구현. visible bounds는 viewport와 shell의 교집합을 우선 사용하되, 교집합 높이나 너비가 `0`이 되면 shell 전체 크기로 fallback 하도록 바꿨다. 이로써 shell이 뷰포트 밖에 잠깐 걸쳐 있는 시점에도 `visible.height = 0`으로 무너져 stack gap과 quadrant 판정이 깨지는 경로를 제거했다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 구현. 동일 사분면 stack은 더 이상 남는 높이를 기준으로 gap을 재분배하지 않는다. `요약 -> 상자 스타일 -> 텍스트 스타일 -> 기능 버튼` 고정 순서를 유지한 채 `12px` 간격으로만 쌓이도록 단순화했다. top 사분면은 위에서 아래로, bottom 사분면은 전체 stack을 아래 inset에 맞춘 뒤 역시 같은 순서로 위에서 아래로 배치한다. 오버레이 클릭만 한 경우에는 pointerdown에서 남은 `will-change`가 toggle 뒤에도 유지되지 않도록 reset을 추가했다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` chrome-devtools MCP 검증. 새로고침 후 `상자 스타일`, `텍스트 스타일`을 실제 PointerEvent 클릭으로 열었을 때, wrapper rect는 `요약(12-44) -> 상자 스타일(12-216) -> 텍스트 스타일(228-507) -> 기능 버튼(519-631)`로 정착했고 각 간격은 모두 `12px`였다. 같은 세션에서 `상자 스타일`, `텍스트 스타일`, `기능 버튼`을 top-left 사분면으로 직접 드래그한 뒤 다시 계측했을 때도 `요약 -> 상자 스타일 -> 텍스트 스타일 -> 기능 버튼` 순서가 그대로 유지되었고, `bottom/top`이 각각 `44 -> 56`, `260 -> 272`, `551 -> 563`으로 모두 `12px` 간격을 유지했다. 테스트 후에는 페이지를 새로고침해 런타임 오버레이 위치 상태를 원복했다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 기존 백업 파일 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 구문 오류로 실패했다. 이번 수정에서 새 TypeScript 오류를 특정한 결과는 아니다.
- 2026-05-13: `POSITION-OVERLAY-STACK-VISIBLE-QUADRANT-FIX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` 구현 전 백업을 `docs/diff/2026-05-13_OVERLAY_QUADRANT_GUIDE_DRAG_PREVIEW-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_OVERLAY_QUADRANT_GUIDE_DRAG_PREVIEW-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` 구현. 오버레이 드래그 중 활성 사분면을 보여주기 위한 런타임 상태 `floatingOverlayQuadrantGuide`를 추가했다. drag threshold를 넘긴 뒤 포인터 이동이 발생하면 현재 오버레이 중심점이 visible bounds의 어느 사분면에 들어가는지 계산하고, 그 결과를 guide state로 저장한다. pointerup, pointercancel, lostpointercapture, 클릭 토글 종료 시점에는 guide state를 즉시 비운다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` 구현. preview shell 내부에 absolute guide layer를 추가했다. 이 레이어는 `/html/body/main/main/div/div/div[4]/div/div[3]`의 현재 visible bounds 위에만 렌더되고, 내부는 2x2 grid로 나뉜다. grid의 바깥 padding과 사분면 사이 gap은 모두 `12px`로 고정해 현재 오버레이 스택 이격 간격과 동일하게 맞췄다. 활성 사분면은 `bg-sky-500/10`, 비활성 사분면은 `bg-sky-500/[0.03]`로 표시해 현재 드롭 대상이 미리 식별되도록 했다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` chrome-devtools MCP 검증. `상자 스타일` 헤더를 실제 PointerEvent drag로 top-left 쪽으로 끌었을 때, preview shell 내부에 z-index 60 guide layer가 나타났고 active cell은 `top-left`만 `bg-sky-500/10`, 나머지 3개 셀은 `bg-sky-500/[0.03]` 상태로 확인됐다. guide rect는 viewport 기준 `top=0, width=722, height=469`로 shell의 실제 visible 영역과 일치했다. 같은 시점에 grid computed style은 `paddingTop=12px`, `paddingRight=12px`, `rowGap=12px`, `columnGap=12px`였고, pointerup 직후 guide layer가 DOM에서 제거되는 것까지 확인했다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` 추가 정적 검증. `npx tsc --noEmit --pretty false --incremental false`는 Node.js heap out of memory로 종료됐다. 이번 세션의 전체 workspace 타입 검사는 `docs/diff` 백업 파일까지 포함한 상태에서 안정적으로 신뢰할 수 없는 상태다.
- 2026-05-13: `OVERLAY-QUADRANT-GUIDE-DRAG-PREVIEW-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INLINE-ACTIONS-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_INLINE_ACTIONS-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_INLINE_ACTIONS-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INLINE-ACTIONS-01` 구현. `텍스트 스타일`의 자동 크기 설정 UI를 별도 하단 버튼 그룹에서 인라인 확장형으로 바꿨다. `자동 높이 상자`가 활성화되면 같은 버튼 묶음 안에 `위로 확장`, `아래로 확장`, `너비에 내용 맞추기` 아이콘 버튼이 나타나고, `자동 너비 상자`가 활성화되면 같은 구조로 `왼쪽으로 확장`, `오른쪽으로 확장`, `높이에 내용 맞추기` 아이콘 버튼이 나타난다. `고정 상자`는 하위 아이콘이 없고, 비활성 모드의 하위 아이콘도 렌더하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INLINE-ACTIONS-01` 구현. 하위 아이콘은 모두 lucide 기반으로 바꿨다. 자동 높이는 `ArrowUp`, `ArrowDown`, `ArrowLeftRight`, 자동 너비는 `ArrowLeft`, `ArrowRight`, `ArrowUpDown`을 사용한다. 각 아이콘 버튼에는 `title`과 `aria-label`을 함께 부여해 hover 시 `위로 확장`, `아래로 확장`, `너비에 내용 맞추기`, `왼쪽으로 확장`, `오른쪽으로 확장`, `높이에 내용 맞추기` 설명이 그대로 노출되도록 했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INLINE-ACTIONS-01` chrome-devtools MCP 검증. 캔버스에서 `band-19-footer` 상자를 실제 클릭해 선택한 뒤 `텍스트 스타일` 오버레이를 열었을 때, `자동 높이 상자`가 활성 상태인 경우 바로 옆에 `위로 확장`, `아래로 확장`, `너비에 내용 맞추기` 세 버튼이 나타나는 것을 확인했다. 이어서 `자동 너비 상자`를 클릭하자 메시지 `자동 너비 상자 설정: 1개 상자, 1개 크기 재계산`이 출력되었고, 하위 아이콘이 `왼쪽으로 확장`, `오른쪽으로 확장`, `높이에 내용 맞추기`로 교체되었다. 이때 `오른쪽으로 확장` 버튼은 active class(`bg-white text-slate-950`)로 표시되어 기본값이 오른쪽 확장임을 브라우저에서 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INLINE-ACTIONS-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-FIXED-WIDTH-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_FIXED_WIDTH-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_FIXED_WIDTH-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-FIXED-WIDTH-01` 구현. 자동 크기 3개 모드 버튼을 다시 `grid-cols-3` 고정 폭 레이아웃으로 되돌리고, 하위 방향/맞춤 아이콘은 버튼 내부 absolute tray로 옮겼다. 따라서 `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 버튼 자체 폭은 활성화 여부와 무관하게 변하지 않고, 활성화된 버튼만 내부 오른쪽에 하위 아이콘이 겹쳐 들어간다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-FIXED-WIDTH-01` chrome-devtools MCP 검증. 캔버스 선택 후 `텍스트 스타일` 오버레이를 연 상태에서 `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 세 버튼의 실제 width를 계측한 결과 모두 `213px`였다. 이어서 `자동 너비 상자`를 활성화한 뒤 다시 측정해도 세 버튼 폭이 모두 `213px`로 유지되어, 하위 아이콘 노출 여부에 따라 폭이 줄거나 늘지 않는 것을 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-FIXED-WIDTH-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_IMMEDIATE_SEGMENTED-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_IMMEDIATE_SEGMENTED-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` 원인 분석. `자동 높이 상자`, `자동 너비 상자`, `확장 방향` 클릭 후 시각적 반영이 한 템포 늦게 보이던 주 원인은 자동 크기 관련 3개 핸들러가 모두 DOM 변경 뒤 `requestAnimationFrame` 기반 `requestPreviewTextFit()`에만 의존하고 있었기 때문이다. 이 구조에서는 실제 버튼 상태는 바뀌었더라도 텍스트 맞춤과 관련 geometry 정리가 다음 프레임까지 밀려, 사용자는 “즉시 반영되지 않는다”로 읽게 된다. 동시에 자동 크기 UI는 개별 rounded button 조합이라, 사용자가 지정한 세그먼트 컨트롤 디자인과도 다르게 보였다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` 구현. `applyPreviewTextFitImmediately()`를 추가해 자동 크기 모드 전환, 확장 방향 전환, 반대축 내용 맞춤 실행 직후에 `applyTemplateExtractEditableTextFit(root)`를 먼저 한 번 즉시 실행하게 바꿨다. 이후 기존 `requestPreviewTextFit()`은 안정화용 후속 패스로만 유지한다. 따라서 mode/anchor/content-fit 버튼 클릭 직후 DOM과 텍스트 맞춤이 한 프레임 기다리지 않고 바로 갱신된다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` 구현. `텍스트 스타일`의 자동 크기 UI를 `grid-cols-[minmax(0,1fr)_28px_28px_28px]` 기반 세그먼트 컨트롤로 재구성했다. 각 mode block은 `overflow-hidden rounded-md border border-slate-300 bg-white` shell 안에 `자동 높이 상자 | 자동 너비 상자 | 고정 상자` 메인 segment와, 오른쪽의 `28px x 28px` icon segment 3개를 가진다. 활성 segment는 `bg-slate-900 text-white`, 비활성 segment는 `bg-white text-slate-600 hover:bg-slate-100`로 통일했다. `고정 상자`나 비활성 mode에서는 오른쪽 3칸을 `opacity-0 pointer-events-none` placeholder로 유지해 전체 폭은 그대로 두고, 버튼만 보이지 않도록 처리했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` chrome-devtools MCP 검증. `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`에서 실제 캔버스 텍스트 상자를 클릭한 뒤 `크기 및 위치 > 텍스트 스타일`을 열고 mode/action을 직접 눌렀다. `자동 너비 상자` 클릭 직후 같은 응답 snapshot에서 메시지 `자동 너비 상자 설정: 51개 상자, 45개 크기 재계산`이 바로 나타났고, 버튼도 즉시 `자동 너비 상자 + 왼쪽/오른쪽/높이에 내용 맞추기` 상태로 바뀌었다. 이어서 `자동 높이 상자` 클릭 직후에는 같은 응답 snapshot에서 `자동 높이 상자 설정: 51개 상자`가 나타났고, `위로 확장`, `아래로 확장`, `너비에 내용 맞추기` action이 즉시 교체되었다. 마지막으로 `위로 확장`을 누르자 같은 응답 snapshot에서 `자동 크기 기준 위로 확장 설정: 51개 상자`가 바로 출력되어 방향 전환도 별도 지연 없이 반영됨을 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` chrome-devtools MCP 추가 계측. 자동 크기 세그먼트의 computed box를 읽은 결과 `자동 높이 상자`, `자동 너비 상자`, `고정 상자`, `왼쪽으로 확장`, `오른쪽으로 확장`, `높이에 내용 맞추기` 버튼은 모두 `height = 28px`였다. 아이콘 segment는 `width = 28px`, 메인 mode segment는 약 `126.67px`로 유지됐고, active segment는 어두운 배경색, inactive segment는 흰 배경색으로 분리되어 사용자가 제시한 세그먼트 디자인과 같은 계열의 시각 구조를 만족했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `npm run check:no-shadow-app`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-SEGMENTED-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-GRID-WRAP-FIX-01` 원인 분석. 세그먼트 UI의 첫 구현은 action button 3개를 `Fragment`로 넘기고, 바깥에서는 이를 `React.Children.toArray()` 기준 “1개 action”으로 본 뒤 나머지 2칸 placeholder를 추가 렌더했다. 하지만 DOM에서는 fragment 안의 실제 button 3개가 모두 sibling으로 풀리므로, 최종 자식 수가 `메인 버튼 1 + 실제 action 3 + placeholder 2 = 6`개가 되어 `grid-cols-[minmax(0,1fr)_28px_28px_28px]` 4열 그리드가 2행으로 감겼다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-GRID-WRAP-FIX-01` 구현. `renderTextAutoSizeModeOption()`의 `inlineActions` 타입을 `React.ReactNode[]`로 바꾸고, 호출부에서도 fragment 대신 key가 달린 action button 배열을 직접 넘기도록 수정했다. 이로써 각 mode block의 자식 수는 항상 정확히 4개(메인 1 + action 3 또는 hidden placeholder 3)로 고정되며, second row가 생기지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-GRID-WRAP-FIX-01` chrome-devtools MCP 검증. 새로고침 후 실제 상자를 다시 선택하고 `텍스트 스타일`을 열어 `자동 높이 상자`를 확인했다. `자동 높이 상자`, `위로 확장`, `아래로 확장`, `너비에 내용 맞추기` 4개 버튼 모두 같은 parent grid 아래에 있었고, `gridTemplateColumns = 126.656px 28px 28px 28px`, 각 button의 `top` 값은 모두 `498`로 동일했다. 즉 현재는 한 줄 4칸 세그먼트로만 출력되며 2행 wrap은 재현되지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-32-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_PRIMARY_HEIGHT_32-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_PRIMARY_HEIGHT_32-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-32-01` 구현. `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 메인 모드 버튼은 `h-8`로 올려 32px 높이를 갖게 하고, `위로 확장`, `아래로 확장`, `너비에 내용 맞추기`, `왼쪽으로 확장`, `오른쪽으로 확장`, `높이에 내용 맞추기` 보조 action은 계속 `h-7 w-7`로 유지했다. parent segmented grid에는 `items-center`를 추가해 28px action이 32px 메인 버튼 옆에서 수직 가운데 정렬되게 맞췄다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-32-01` chrome-devtools MCP 검증. `크기 및 위치 > 텍스트 스타일`에서 `자동 높이 상자`, `자동 너비 상자`, `고정 상자`, `위로 확장`, `아래로 확장`, `너비에 내용 맞추기`의 실제 rect를 계측한 결과, 메인 3개 버튼 높이는 각각 `32px`, 보조 action 3개 버튼 높이는 각각 `28px`였다. 폭도 `자동 높이 상자 126.65625px`, `자동 너비 상자 126.671875px`, `고정 상자 126.671875px`, action 3개는 모두 `28px`로 유지되어 메인/보조 버튼의 크기 규칙이 분리된 상태를 브라우저에서 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-32-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-32-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_SPLIT_SEGMENTED_AUX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_SPLIT_SEGMENTED_AUX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` 원인 정리. 기존 구현은 `자동 높이 상자 | 위로 확장 | 아래로 확장 | 너비에 내용 맞추기` 전체를 하나의 세그먼트처럼 묶고 있었다. 사용자가 의도한 구조는 메인 모드 버튼(`자동 높이 상자`, `자동 너비 상자`, `고정 상자`)은 독립 텍스트 버튼으로 유지하고, 오른쪽의 보조 3개 버튼만 별도 아이콘 세그먼트 그룹으로 묶는 방식이다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` 구현. `renderTextAutoSizeModeOption()`을 `grid-cols-[minmax(0,1fr)_max-content] gap-2` 구조로 바꾸고, 왼쪽에는 `h-8` 메인 버튼 1개, 오른쪽에는 `inline-flex overflow-hidden rounded-md border border-slate-300 bg-white` 보조 세그먼트 그룹을 분리해 렌더하도록 수정했다. 비활성 모드에서는 보조 그룹을 `opacity-0 pointer-events-none`으로 숨기되 폭은 유지해, 메인 버튼 너비가 상태에 따라 흔들리지 않도록 맞췄다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` 구현. 보조 세그먼트의 첫 버튼은 좌측 경계선을 제거하고, 이후 버튼들만 `border-l border-slate-300`을 갖게 정리했다. 따라서 사용자가 제시한 캔버스 조작 모드형 segmented control과 같은 경계 구조를 갖는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` chrome-devtools MCP 검증. `크기 및 위치 > 텍스트 스타일`에서 실제 rect를 계측한 결과 `자동 높이 상자`, `자동 너비 상자`, `고정 상자`는 각각 parent wrapper `grid min-w-0 w-full grid-cols-[minmax(0,1fr)_max-content] items-center gap-2` 아래에서 메인 버튼 1개 + 보조 그룹 1개 구조를 가졌다. `자동 높이 상자` wrapper 폭은 `212.65625px`, 메인 버튼 폭은 `118.65625px`, 보조 그룹 폭은 `86px`였고, `위로 확장`, `아래로 확장`, `너비에 내용 맞추기`는 모두 같은 보조 group 안에서 `28px x 28px`로 나란히 배치되었다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-SPLIT-SEGMENTED-AUX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-NESTED-AUX-IN-32PX-ROW-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_NESTED_AUX_IN_32PX_ROW-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_NESTED_AUX_IN_32PX_ROW-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-NESTED-AUX-IN-32PX-ROW-01` 원인 정리. 직전 구조는 메인 버튼 옆에 보조 세그먼트가 sibling으로 붙는 형태였다. 사용자가 원하는 것은 `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 자체가 `32px` 메인 버튼으로 유지되고, 그 버튼 내부 우측에만 `28px` 보조 세그먼트가 들어가는 형태다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-NESTED-AUX-IN-32PX-ROW-01` 구현. 각 auto-size row를 `relative min-w-0 w-full` wrapper로 바꾸고, 메인 mode 버튼은 다시 `h-8 rounded-md border ... pr-[5.75rem]`를 가진 실제 32px 버튼으로 복구했다. 보조 세그먼트는 `absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex h-7 rounded-md border ...`로 메인 버튼 내부에 배치했다. 따라서 메인 버튼은 전체 폭을 유지하면서 오른쪽에 28px 세그먼트 3개를 품고, 비활성 모드에서는 해당 세그먼트만 `opacity-0 pointer-events-none`으로 숨는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-NESTED-AUX-IN-32PX-ROW-01` chrome-devtools MCP 검증. `크기 및 위치 > 텍스트 스타일`에서 실제 rect를 계측한 결과 `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 버튼은 각각 `height = 32px`, `width ≈ 212.67px`였고, parent wrapper도 동일하게 `height = 32px`였다. 같은 상태에서 `위로 확장`, `아래로 확장`, `너비에 내용 맞추기`는 메인 버튼 내부 우측에 있는 absolute 보조 그룹 안에서 각각 `28px x 28px`로 배치되어, 사용자가 요구한 “32px 메인 버튼 안에 28px 보조 버튼” 구조를 브라우저에서 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-NESTED-AUX-IN-32PX-ROW-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-40-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_PRIMARY_HEIGHT_40-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_PRIMARY_HEIGHT_40-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-40-01` 구현. `자동 높이 상자`, `자동 너비 상자`, `고정 상자` 메인 버튼 높이를 `h-10`으로 올려 40px로 변경했다. 자동 높이/자동 너비처럼 보조 세그먼트가 있는 모드는 기존처럼 우측 공간을 예약하고, 보조 세그먼트가 없는 모드가 활성화되면 메인 버튼 텍스트를 `justify-center text-center`로 바꿔 중앙 정렬되게 했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-40-01` 구현. `고정 상자`처럼 실제 보조 버튼이 없는 모드에서는 빈 28px 세그먼트가 남지 않도록 `showInlineActionTray = active && hasInlineActions` 조건으로 보조 그룹 전체를 숨겼다. 따라서 활성화된 `고정 상자`는 40px 메인 버튼만 남고, 내부 빈 그룹은 `opacity: 0`, `pointer-events: none`, `aria-hidden="true"` 상태가 된다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-40-01` chrome-devtools MCP 검증. `크기 및 위치 > 텍스트 스타일`에서 실제 rect를 계측한 결과 `자동 높이 상자`, `자동 너비 상자`, `고정 상자`는 각각 `height = 40px`였다. 이어서 `고정 상자`를 실제 클릭해 활성화한 상태에서 computed style을 확인한 결과 메인 버튼은 `justify-content: center`, `text-align: center`였고, 우측 보조 그룹은 `opacity: 0`, `pointer-events: none`, `aria-hidden: true`로 비활성화되어 빈 세그먼트가 남지 않았다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-PRIMARY-HEIGHT-40-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INSET-6PX-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_INSET_6PX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_INSET_6PX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INSET-6PX-01` 구현. 메인 버튼에 보조 트레이가 실제로 보일 때만 우측 공간을 예약하도록 바꾸고, 보조 트레이 위치를 `absolute right-1.5 top-1.5`로 고정했다. 따라서 40px 메인 버튼 안에서 보조 세그먼트는 상/우/하 모두 `6px` inset을 가진다. 공통 tone class에서 `px-2`를 제거하고, 메인 버튼이 직접 `p-1.5` 또는 `pl-1.5 pr-[5.75rem]`를 갖도록 바꿔 inactive 상태의 텍스트도 정확히 `6px` inset 규칙을 따르게 정리했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INSET-6PX-01` chrome-devtools MCP 검증. `자동 높이 상자`를 활성화한 상태에서 보조 트레이의 실제 inset을 계측한 결과 `topInset = 6`, `rightInset = 6`, `bottomInset = 6`이었다. 이어서 비활성 `자동 너비 상자`와 활성 `고정 상자`의 computed style을 확인한 결과 둘 다 `justify-content: center`, `text-align: center`, `paddingTop = paddingRight = paddingBottom = paddingLeft = 6px`로 일치해, 텍스트만 보이는 상태에서는 버튼 중앙 정렬과 사방 6px 마진이 유지되는 것을 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INSET-6PX-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/uiupdate0511.md`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-INSET-6PX-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-ACTIVE-LABEL-CENTER-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_ACTIVE_LABEL_CENTER-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_ACTIVE_LABEL_CENTER-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-ACTIVE-LABEL-CENTER-01` 구현. 보조 트레이가 보이는 활성 상태에서도 메인 버튼 텍스트가 왼쪽 정렬로 남아 있지 않도록, `reserveInlineActionSpace` 분기의 mode button 클래스를 `justify-center pl-1.5 pr-[5.75rem] text-center`로 바꿨다. 이 변경으로 버튼은 우측 보조 트레이 영역을 계속 비워 두되, 남은 가용 영역 안에서는 텍스트가 가운데에 위치한다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-ACTIVE-LABEL-CENTER-01` chrome-devtools MCP 검증. `자동 높이 상자`가 활성화된 상태에서 computed style과 text range rect를 계측한 결과 `justify-content: center`, `text-align: center`, `paddingLeft = 6px`, `paddingRight = 92px`였다. 같은 상태에서 버튼의 가용 영역 중심(`availableCenter = 127.328125`)과 실제 텍스트 중심(`textCenter = 127.3203125`)의 차이는 `0.0078125px`로 사실상 0에 가까워, 보조 버튼이 차지하지 않는 영역 안에서 텍스트가 중앙에 놓였음을 확인했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-ACTIVE-LABEL-CENTER-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_IMMEDIATE_FINAL-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_STYLE_AUTOSIZE_IMMEDIATE_FINAL-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` 원인 분석. 자동 높이/자동 너비/고정 상자와 방향 보조 버튼의 체감 지연은 autosize 계산만의 문제가 아니었다. 클릭 핸들러에서 무거운 DOM 계산을 뒤로 미뤄도, 버튼 활성 상태를 바꾸는 `textAutoSizeUiOverride` 렌더 자체가 큰 `TemplateEditWorkspace` 전체를 다시 그리면서 `pointerdown -> class-change` 사이에 약 `97ms`가 걸렸다. 즉 React 상태 반영만으로는 “즉시” 수준의 클릭 피드백을 만들 수 없었다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` 구현. autosize 관련 무거운 작업은 모두 click 이후 timeout 경로로 미뤘다. `자동 높이 상자`/`자동 너비 상자`는 클릭 즉시 attrs만 바꾸고, 실제 `applyTemplateAutoSizeBoxes(...)`, `syncDraftPreviewHtmlRef(...)`, `schedulePreviewEditorState()`, `requestPreviewTextFit()`는 `scheduleDeferredTextAutoSizeSync(...)` 안에서 다음 tick에 실행되도록 정리했다. `너비에 내용 맞추기`/`높이에 내용 맞추기`는 실제 크기 변경은 즉시 수행하되, draft/preview sync만 다음 tick으로 넘겼다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` 구현. 메인 mode 버튼과 방향 보조 버튼의 시각 반응은 `pointerdown` 시점에 DOM 클래스를 직접 바꾸도록 추가했다. 이를 위해 각 mode row와 보조 tray/action에 `data-text-autosize-*` 식별자를 부여하고, `previewTextAutoSizeModeDomState(...)`, `previewTextAutoSizeAnchorDomState(...)`가 `bg-slate-900/text-white`, `bg-white/text-slate-600`, `opacity-0`, `pointer-events-none`, `p-1.5`, `pl-1.5 pr-[5.75rem]` 클래스를 즉시 토글한다. React rerender는 뒤늦게 따라오지만, 사용자가 보는 버튼의 active/inactive 상태는 `pointerdown` 직후 바로 바뀐다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` 구현. 비활성 mode에서도 높이/너비용 보조 버튼 DOM은 항상 렌더해 두고 tray만 숨기도록 바꿨다. 따라서 `자동 높이 상자`나 `자동 너비 상자`를 누르는 순간에도 보조 tray를 DOM 생성 없이 즉시 노출할 수 있다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` chrome-devtools MCP 검증. `band-19-footer`를 실제 클릭해 선택한 뒤 `크기 및 위치 > 텍스트 스타일`을 열고, `고정 상자` 버튼을 실제 클릭 이벤트 경로로 계측했다. 수정 전 기록은 `pointerdown -> class-change ≈ 97ms`였고, 수정 후에는 `pointerdown = 5118.4ms`, 첫 `class-change = 5120.2ms`로 약 `1.8ms` 만에 active 스타일이 적용됐다. 같은 방식으로 `위로 확장` 보조 버튼을 계측했을 때도 `pointerdown = 4545.9ms`, 첫 `class-change = 4548.4ms`로 약 `2.5ms` 만에 active 스타일이 바뀌었다. 이후 React rerender가 약 `100ms` 뒤에 따라와도 이미 같은 active 상태를 유지하므로, 사용자가 보는 체감 지연은 제거됐다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` 정적 검증. `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`, `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`가 통과했다.
- 2026-05-13: `TEXT-STYLE-AUTOSIZE-IMMEDIATE-FINAL-01` Supabase MCP 검증 시도. `get_advisors(type=performance)` 호출은 이 세션의 Supabase MCP 인증이 없어 `Auth required`로 실패했다. 이번 작업은 DB schema/data write를 포함하지 않는다.
- 2026-05-13: `TEXT-AUTOSIZE-OVERMEASURE-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_TEXT_AUTOSIZE_OVERMEASURE_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_TEXT_AUTOSIZE_OVERMEASURE_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `TEXT-AUTOSIZE-OVERMEASURE-FIX-01` 원인 분석. `자동 높이 상자` 경로는 `measureRequiredAutoHeightFrameHeight()`에서 여전히 `measureNaturalTextControlHeight()`를 사용하고 있었다. 이 함수는 textarea/input clone의 `scrollHeight + border`를 다시 더하는 방식이라 `band-0-header`, `band-1-header`처럼 이미 `scrollHeight == clientHeight`이거나 `scrollHeight`가 1px만 큰 header text control에서도 요구 높이를 `27px`로 계산했다. 결과적으로 `높이에 내용 맞추기`는 `25px`로 끝나는데 `자동 높이 상자`를 누르면 같은 header가 `27px`로 다시 커지는 경로가 남아 있었다.
- 2026-05-13: `TEXT-AUTOSIZE-OVERMEASURE-FIX-01` 구현. `measureRequiredAutoHeightFrameHeight()`의 textarea/input 분기를 `measureContentFitFrameHeight()`와 같은 기준으로 맞췄다. 즉 clone 자연 높이를 쓰지 않고 `Math.max(scrollHeight, clientHeight, offsetHeight)`만 요구 높이로 사용하고, visible height도 `Math.max(clientHeight, offsetHeight, rect.height)`로 읽는다. 따라서 실제 내용이 이미 맞는 header row는 더 이상 `+2px`로 과대 측정되지 않는다.
- 2026-05-13: `TEXT-AUTOSIZE-OVERMEASURE-FIX-01` chrome-devtools MCP 재현 및 검증. `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`에서 `크기 및 위치 > 텍스트 스타일`을 열고, 캔버스에서 `band-0-header` 영역을 실제 클릭해 `그룹 2(position-box-mp1689ha)`를 선택했다. 클릭 전 계측값은 `group2 height = 23.6875`, `group1.top - group2.bottom = 9.46875`, `band-0-header shell = 25px`, `band-1-header shell = 24px`, `band-1 textarea client/scroll = 24/25`였다.
- 2026-05-13: `TEXT-AUTOSIZE-OVERMEASURE-FIX-01` chrome-devtools MCP 검증 1. 같은 선택 상태에서 `높이에 내용 맞추기`를 눌렀을 때 수정 후 값은 `group2 height = 23.6875`, `gap = 9.46875`, `band-0-header shell = 25px`, `band-1-header shell = 25px`였다. 즉 `band-1-header`만 필요한 만큼 `24 -> 25px`로 늘고, `band-0-header`는 `25px`를 유지했으며 `그룹 2 -> 그룹 1` 간격도 그대로 보존됐다. 수정 전 같은 경로는 `group2 height ≈ 25.578125`, `gap ≈ 7.578125`, `band-0-header/band-1-header = 27px/27px`로 깨졌었다.
- 2026-05-13: `TEXT-AUTOSIZE-OVERMEASURE-FIX-01` chrome-devtools MCP 검증 2. 페이지를 새로고침한 뒤 같은 경로로 다시 `그룹 2`를 선택하고 `자동 높이 상자`를 눌렀다. 수정 후 값은 `group2 height = 23.6875`, `gap = 9.46875`, `band-0-header shell = 25px`, `band-1-header shell = 25px`, `data-template-frame-auto-height = true/true`였다. 즉 autosize mode 전환은 적용되지만 header row가 더 이상 `27px`로 과대 확장되지 않았고, 간격 설정(`그룹 2`와 `그룹 1`)도 유지됐다. 이어서 같은 세션에서 `자동 너비 상자`를 눌러도 `gap = 9.46875`가 그대로 유지되는 것까지 확인했다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` 구현 전 백업을 `docs/diff/2026-05-13_STYLE_TEXT_INPUT_BLUR_COMMIT_FIX-01_TemplateEditWorkspace.before.tsx`, `docs/diff/2026-05-13_STYLE_TEXT_INPUT_BLUR_COMMIT_FIX-01_uiupdate0511.before.md`에 생성했다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` 원인 분석. `상자 스타일`, `텍스트 스타일`의 숫자/색상 자유입력 필드가 모두 controlled input으로 묶여 있었고, `onChange -> setSelectionStyleDraft()` 경로를 타면서 키 입력마다 `TemplateEditWorkspace` 전체가 다시 렌더되고 있었다. 그 결과 입력 중에도 preview/canvas 계산이 반복돼 체감 지연이 발생했다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` 구현. `선 두께`, `코너 라운딩`, `높이`, `너비`, `글자 크기`, `줄 높이`, `여백`, 색상 자유입력 필드를 uncontrolled input(`defaultValue`)으로 바꾸고, 실제 patch 적용은 모두 `blur` 또는 `Enter -> blur` 시점의 `applyStyleFieldOnBlur(field, explicitValue)`로 통일했다. mixed 상태 입력은 `data-style-field-mixed`와 explicit `mixedBlank` 옵션으로 판별해, 값을 비우고 빠져나오면 patch를 보내지 않도록 유지했다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` 구현. `activeInlineStyleField` 상태와 그 cleanup effect를 제거했다. 이제 입력 중 draft state를 전역으로 계속 갱신하지 않고, 선택/적용이 바뀔 때만 input key가 갱신되어 새 기본값으로 다시 마운트된다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` chrome-devtools MCP 검증 1. `크기 및 위치 > 상자 스타일`에서 `선 두께` input에 `2 -> 9`를 입력하는 동안 preview box의 `borderTopWidth`는 blur 전까지 `8px`으로 유지됐고, blur 후에만 `2px`로 반영됐다. 즉 입력 중 실시간 patch는 제거됐다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` chrome-devtools MCP 검증 2. `크기 및 위치 > 텍스트 스타일`에서 `글자 크기` input을 `22 -> 30`으로 입력하는 동안 캔버스의 `구 분` textarea `fontSize`는 blur 전까지 `22px`을 유지했고, blur 후에만 `30px`으로 바뀌었다.
- 2026-05-13: `STYLE-TEXT-INPUT-BLUR-COMMIT-FIX-01` chrome-devtools MCP 검증 3. `텍스트 스타일 > 글자 색` 자유입력에 `#ff0000`을 입력하는 동안 `구 분` textarea의 `color`는 blur 전까지 `rgb(15, 23, 42)`를 유지했고, blur 후에만 `rgb(255, 0, 0)`으로 바뀌었다. 따라서 숫자 입력뿐 아니라 자유 텍스트 색상 입력도 같은 blur commit 경로로 동작함을 확인했다.
- 2026-05-13: `POSITION-BOX-STYLE-AUTOSIZE-MOVE-01` 구현. `자동 높이 상자 / 자동 너비 상자 / 고정 상자`와 그 보조 방향 버튼 묶음을 `텍스트 스타일`에서 제거하고, `상자 스타일` 오버레이 하단으로 이동했다. 렌더 코드는 `renderTextAutoSizeControls()` 공용 helper로 끌어냈고, `상자 스타일`에서는 preview box 아래에 같은 폭으로 렌더되도록 붙였다.
- 2026-05-13: `POSITION-BOX-STYLE-AUTOSIZE-MOVE-01` chrome-devtools MCP 검증. 실제 캔버스에서 `구 분` 상자를 선택한 뒤 `상자 스타일`을 열면 `자동 높이 상자`, `위로 확장`, `아래로 확장`, `너비에 내용 맞추기`, `자동 너비 상자`, `고정 상자`가 `상자 스타일` 아래에 표시됐다. 이어서 `텍스트 스타일`을 열었을 때는 `폰트`, `글자 크기`, `줄 높이`, `여백`, `글자 색`, 굵게/정렬 버튼만 남고 autosize 버튼들은 더 이상 나타나지 않았다.
- 2026-05-13: `POSITION-BOX-STYLE-AUTOSIZE-ROW-SPLIT-01` 구현. `renderTextAutoSizeControls()`의 배치를 `grid-cols-3`에서 `grid-cols-2`로 바꾸고, `고정 상자`는 `col-span-2` wrapper 안으로 내려 둘째 줄 전체를 차지하게 수정했다. 따라서 첫 줄은 `자동 높이 상자`, `자동 너비 상자`, 둘째 줄은 `고정 상자` 한 개만 배치된다.
- 2026-05-13: `POSITION-BOX-STYLE-AUTOSIZE-ROW-SPLIT-01` chrome-devtools MCP 검증. 실제 캔버스에서 `band-3-cell-1(구 분)` 상자를 클릭해 선택한 뒤 `상자 스타일`을 연 상태에서 rect를 계측한 결과 `자동 높이 상자(top=211,left=292,width=205)`와 `자동 너비 상자(top=211,left=505,width=205)`는 같은 첫 줄에 있었고, `고정 상자(top=259,left=292,width=418)`는 다음 줄 전체폭으로 내려가 있었다.
