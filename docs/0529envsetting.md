# 0529 환경 설정과 UI 기능 상태 일치 설계

## 목적

`/canvas?page=project&mode=template` 같은 공용 캔버스 owner 화면에서 환경 설정은 ON인데 실제 UI가 비활성화되거나 사용할 수 없는 상태가 발생하지 않도록 한다.

핵심 원칙은 다음과 같다.

- UI와 기능을 담당하는 요소는 모두 환경 설정 화면 안에서 현재 상태를 확인할 수 있어야 한다.
- 설정값과 실제 UI 출력 상태가 달라지는 경우, 환경 설정 화면에서 그 이유를 보여야 한다.
- 실제 UI는 `설정값`이 아니라 `설정값 + 현재 페이지 capability`를 거친 effective 상태를 기준으로 출력되어야 한다.

## 현재 상태

### 환경 설정 값

현재 `src/app/canvas/ownerSettings.ts`에는 `CanvasOwnerSettings`가 있고, 툴바 관련 값은 다음처럼 관리된다.

- `showCanvasSaveButton`
- `showCanvasTodoButton`
- `showCanvasPreviewToggle`
- `showCanvasInteractionToolControls`
- `showCanvasHistoryControls`
- `showCanvasZoomControls`
- `showCanvasFullscreenControl`
- `showCanvasEditSettingsToggle`
- `showCanvasSelectionPanelTabs`

이 값들은 `buildCanvasToolbarVisibility()`와 `applyCanvasOwnerSettingsToWorkspaceProps()`를 거쳐 `TemplateEditWorkspace`의 `canvasToolbarVisibility` prop으로 전달된다.

### 실제 렌더링 조건

`TemplateEditCanvasToolbar`는 `canvasToolbarVisibility.showEditSettingsToggle !== false`이면 `편집 설정` 버튼을 렌더링한다.

하지만 버튼 사용 가능 여부는 별도 prop인 `editSettingsPanelAvailable`과 `templateUsagePreviewMode`로 결정된다.

현재 상단 `편집 설정` 버튼의 핵심 조건은 다음과 같다.

```ts
const renderEditSettingsToggle = isTopToolbar && showEditSettingsToggle;

disabled={!editSettingsPanelAvailable || templateUsagePreviewMode}
```

`editSettingsPanelAvailable`은 `TemplateEditWorkspace`에서 다음 조건으로 전달된다.

```ts
editSettingsPanelAvailable={
  !documentDraftSaveEnabled &&
  !templateUsagePreviewActive &&
  Boolean(renderedPreviewHtml.trim())
}
```

### 문제 사례

`/canvas?page=project&mode=template` 계열에서는 project가 문서 저장 모드이므로 `onSaveDraftHtml`이 연결될 수 있다.

그 결과 내부 상태는 다음처럼 된다.

- `documentDraftSaveEnabled = true`
- `templateUsagePreviewActive = true`
- `editSettingsPanelAvailable = false`
- `showCanvasEditSettingsToggle = true`

따라서 환경 설정은 ON인데, 실제 `편집 설정` 버튼은 출력만 되고 사용할 수 없는 상태가 된다.

### 구조적 문제

현재 구조는 다음 세 레이어가 서로 다른 곳에서 계산된다.

- 설정값: `CanvasOwnerSettings`
- 출력 여부: `canvasToolbarVisibility`
- 기능 가능 여부: `TemplateEditWorkspace`와 `TemplateEditCanvasToolbar` 내부 조건

이 때문에 환경 설정 화면에서는 ON으로 보이지만, 실제 UI에서는 disabled 또는 숨김이 되는 상태가 발생한다.

## 추가해야 하는 것

### 1. UI 기능 레지스트리

모든 UI 및 기능 요소를 한 곳에서 정의하는 레지스트리를 추가한다.

대상 예시:

- `saveButton`
- `todoButton`
- `previewToggle`
- `interactionTools`
- `historyControls`
- `zoomControls`
- `fullscreenControl`
- `editSettingsToggle`
- `selectionPanelTabs`
- `persistencePanel`
- `templateList`
- `templateNameInput`
- `layoutResizePolicySelect`
- `sourceDocumentNameInput`
- `persistenceSaveButton`
- `documentAttachment`
- `onTemplateSaved`
- `onSaveDraftHtml`

각 항목은 최소한 아래 정보를 가져야 한다.

```ts
type CanvasOwnerUiFeatureDefinition = {
  key: string;
  settingKey: CanvasOwnerSettingKey;
  definitionName: string;
  label: string;
  description: string;
  supportedSurfaces?: CanvasOwnerSurface[];
  unsupportedReason?: string;
};
```

### 2. 페이지 capability resolver

선택된 페이지와 런타임 모드를 기준으로 기능 사용 가능 여부를 계산하는 resolver를 추가한다.

입력 후보:

- `selectedManagedPage`
- `usesTemplateList`
- `documentSaveEnabled`
- `readOnlyCanvasOutput`
- `canEditCurrentWorkspace`
- `selectedDocumentInitialDraft`
- `selectedTemplateId`
- `routeEquivalentPreviewEnabled`
- `previewBaseWorkspaceProps`
- `renderedPreviewHtml` 또는 preview HTML 존재 여부

출력 예시:

```ts
type CanvasOwnerPageCapabilities = {
  canUseTemplateEditing: boolean;
  canUseDocumentDraftSave: boolean;
  canUseEditSettingsPanel: boolean;
  canUseSelectionPanelTabs: boolean;
  canUsePreviewToggle: boolean;
  canUseTodoPanel: boolean;
  canUseDocumentAttachment: boolean;
  canUseTemplateSavedCallback: boolean;
};
```

`project` 문서 저장 모드의 예시는 다음처럼 해석되어야 한다.

```ts
canUseDocumentDraftSave = true;
canUseEditSettingsPanel = false;
canUseSelectionPanelTabs = false;
canUseTemplateEditing = false;
```

### 3. effective UI state resolver

환경 설정값과 capability를 합쳐 실제 UI 상태를 만든다.

```ts
type CanvasOwnerUiFeatureState = {
  key: string;
  settingKey: CanvasOwnerSettingKey;
  definitionName: string;
  label: string;
  configuredVisible: boolean;
  supported: boolean;
  effectiveVisible: boolean;
  enabled: boolean;
  disabledReason: string;
};
```

기본 정책:

- `configuredVisible = false`이면 실제 UI는 숨긴다.
- `configuredVisible = true`이고 `supported = true`이면 실제 UI에 출력한다.
- `configuredVisible = true`이고 `supported = false`이면 실제 UI에는 숨기고, 환경 설정 화면에서만 미지원 이유를 보여준다.
- debug 목적의 disabled 렌더링은 별도 설정으로 분리한다.

예시:

```ts
editSettingsToggle = {
  configuredVisible: settings.showCanvasEditSettingsToggle,
  supported: capabilities.canUseEditSettingsPanel,
  effectiveVisible: settings.showCanvasEditSettingsToggle && capabilities.canUseEditSettingsPanel,
  enabled: capabilities.canUseEditSettingsPanel,
  disabledReason: capabilities.canUseEditSettingsPanel
    ? ''
    : '문서 저장 모드에서는 편집 설정 패널을 사용할 수 없습니다.',
};
```

### 4. `canvasToolbarVisibility` 생성 경로 변경

현재는 설정값이 바로 `canvasToolbarVisibility`로 변환된다.

현재 흐름:

```text
CanvasOwnerSettings
→ canvasToolbarVisibility
→ TemplateEditWorkspace
→ TemplateEditCanvasToolbar
```

개선 흐름:

```text
CanvasOwnerSettings
→ CanvasOwnerPageCapabilities
→ CanvasOwnerUiFeatureState[]
→ effectiveCanvasToolbarVisibility
→ TemplateEditWorkspace
→ TemplateEditCanvasToolbar
```

따라서 `showCanvasEditSettingsToggle = true`여도 현재 페이지에서 지원되지 않으면 다음처럼 전달되어야 한다.

```ts
canvasToolbarVisibility.showEditSettingsToggle = false;
```

### 5. 환경 설정 화면 확장

현재 환경 설정 화면은 대부분 ON/OFF만 보여준다.

각 UI/기능 행에 아래 정보를 추가해야 한다.

- 설정값: ON/OFF
- 현재 페이지 지원 여부: 지원됨/지원 안 됨
- 실제 출력: 출력/숨김
- 실제 동작: 활성/비활성
- 이유: 미지원 또는 비활성 사유

`편집 설정` 예시:

```text
편집 설정 표시
설정값: ON
지원 여부: 지원 안 됨
실제 출력: 숨김
실제 동작: 비활성
이유: 문서 저장 모드에서는 편집 설정 패널을 사용할 수 없습니다.
```

### 6. effective props 패널 확장

현재 `전달 prop 전체`에는 `canvasToolbarVisibility.showEditSettingsToggle=true`처럼 전달 prop만 표시된다.

여기에 UI 기능 상태 섹션을 추가해야 한다.

예시:

- `editSettingsToggle.configuredVisible`
- `editSettingsToggle.supported`
- `editSettingsToggle.effectiveVisible`
- `editSettingsToggle.enabled`
- `editSettingsToggle.disabledReason`

이 섹션은 “설정값과 실제 UI가 왜 달라졌는지”를 확인하는 기준이 된다.

## 현재 상태와 추가 항목 매핑

| UI/기능 | 현재 설정 | 현재 실제 조건 | 추가해야 할 effective 기준 |
| --- | --- | --- | --- |
| 문서 저장 | `showCanvasSaveButton`, `saveDisabled`, `onSaveDraftHtml` | 저장 콜백, 로딩, HTML 존재 여부 등에 따라 disabled | 설정값 + 저장 capability + disabled reason |
| 할 일 | `showCanvasTodoButton` | `todoPanel` 존재 여부에 따라 disabled | 설정값 + todoPanel capability |
| 미리보기 | `showCanvasPreviewToggle` | 문서 저장/읽기 출력 모드에서 의미가 달라짐 | 설정값 + template preview capability |
| 선택/이동 | `showCanvasInteractionToolControls` | preview/read-only 상태에서 disabled 가능 | 설정값 + editor interaction capability |
| 실행 기록 | `showCanvasHistoryControls` | history 존재 여부, preview 상태에 따라 disabled | 설정값 + history capability + history state |
| 확대/축소 | `showCanvasZoomControls` | 대부분 항상 가능 | 설정값 + canvas surface capability |
| 전체 화면 | `showCanvasFullscreenControl` | 대부분 항상 가능 | 설정값 + fullscreen capability |
| 편집 설정 | `showCanvasEditSettingsToggle` | `!documentDraftSaveEnabled && !templateUsagePreviewActive` 필요 | 설정값 + edit settings capability |
| 편집 탭 | `showCanvasSelectionPanelTabs` | template edit 모드에서만 의미 있음 | 설정값 + selection panel capability |
| 불러오기/저장 패널 | `hidePersistencePanel`, `persistenceVisibility.*` | `usesTemplateList`와 route props 영향 | 설정값 + persistence capability |
| 첨부파일 API | `enableDocumentAttachmentApiPath` | document id, document save, edit 권한 필요 | 설정값 + document attachment capability |
| 저장 후 콜백 | `enableOnTemplateSaved` | template page, route equivalent 여부 영향 | 설정값 + callback capability |

## 구현 순서

1. `CanvasOwnerUiFeatureDefinition`과 `CanvasOwnerUiFeatureState` 타입을 추가한다.
2. 페이지별 capability를 계산하는 resolver를 추가한다.
3. settings와 capability를 합쳐 `resolvedUiFeatures`를 생성한다.
4. `resolvedUiFeatures`에서 `effectiveCanvasToolbarVisibility`와 `effectivePersistenceVisibility`를 만든다.
5. `TemplateEditWorkspace`에는 effective visibility만 전달한다.
6. 환경 설정 화면의 toggle row에 support/effective 상태를 표시한다.
7. `전달 prop 전체`에 UI 기능 상태 섹션을 추가한다.
8. `편집 설정` 버튼처럼 현재 disabled로만 처리하던 항목은 기본적으로 unsupported 상태에서 렌더링하지 않도록 바꾼다.

## 기대 결과

- 환경 설정 ON인데 실제 UI가 사용할 수 없는 상태가 줄어든다.
- 지원되지 않는 기능은 실제 UI에 보이지 않고, 환경 설정 화면에서 이유를 확인할 수 있다.
- owner 페이지별 UI 정책이 한 곳에서 계산되어 유지보수가 쉬워진다.
- `canvasToolbarVisibility`는 더 이상 단순 설정값이 아니라 실제 UI 출력 계약이 된다.
