# 2026-05-28 Canvas Owner Settings Consistency - Before Snapshot

체크리스트명: Canvas Owner Settings Verification Checklist

목적:
- `CanvasOwnerSettings`와 실제 `CanvasOwnedWorkspace` 출력이 일치하도록 수정하기 전 상태 기록.
- 아래 구간은 이번 수정의 직접 대상이며, 롤백 시 이 문서의 before 상태와 git diff를 기준으로 되돌린다.

## src/app/canvas/ownerSettings.ts

수정 전 핵심 상태:
- `useSpecifiedCanvasHeight`가 `CanvasOwnerSettings`의 독립 설정으로 남아 있다.
- `showTopNotice`, `showAdditionalControlPanels`, `limitEditableValueKeys`, `enableOnTemplateSaved`는 `applyCanvasOwnerSettingsToWorkspaceProps`에서 공용 적용되지 않는다.
- `allowCanvasBoxSelection`은 true일 때만 props를 추가하고 false일 때 명시적으로 기본 정책을 강제하지 않는다.

```ts
export type CanvasOwnerSettings = {
  // ...
  autoCanvasHeight: boolean;
  autoCanvasWidth: boolean;
  useSpecifiedCanvasHeight: boolean;
  specifiedCanvasHeight: string;
  specifiedCanvasWidth: string;
  // ...
  allowCanvasBoxSelection: boolean;
};
```

```ts
const canvasBoxSelectionProps: Partial<TemplateEditWorkspaceProps> = settings.allowCanvasBoxSelection
  ? {
      canvasTextInteractionMode: 'selection-only',
      canvasSelectionMode: 'box',
    }
  : {};

return {
  ...baseProps,
  hideHeader: shouldApplySetting('hideHeader') ? settings.hideHeader : baseProps.hideHeader,
  hidePersistencePanel: shouldApplySetting('hidePersistencePanel') ? settings.hidePersistencePanel : baseProps.hidePersistencePanel,
  templateListDisplay: shouldApplySetting('templateListDisplay') ? settings.templateListDisplay : baseProps.templateListDisplay,
  showWorkspaceMessages: shouldApplySetting('showWorkspaceMessages') ? settings.showWorkspaceMessages : baseProps.showWorkspaceMessages,
  // ...
  canvasSpecifiedHeightEnabled: shouldApplySetting('useSpecifiedCanvasHeight')
    || shouldApplySetting('autoCanvasHeight')
    ? !settings.autoCanvasHeight
    : baseProps.canvasSpecifiedHeightEnabled,
  canvasSpecifiedHeight:
    shouldApplySetting('useSpecifiedCanvasHeight') ||
    shouldApplySetting('autoCanvasHeight') ||
    shouldApplySetting('specifiedCanvasHeight')
      ? specifiedCanvasHeight
      : baseProps.canvasSpecifiedHeight,
  // ...
  selectionInactiveOverlayOpacity: shouldApplySetting('selectionInactiveOverlayOpacity')
    ? settings.selectionInactiveOverlayOpacity
    : baseProps.selectionInactiveOverlayOpacity,
  ...canvasBoxSelectionProps,
};
```

## src/app/canvas/page.tsx

수정 전 핵심 상태:
- `settingKeyByDefinitionName`에 `useSpecifiedCanvasHeight`가 포함되어 있다.
- `renderCanvasSizeSettings`는 `autoCanvasHeight`, `specifiedCanvasHeight`, `autoCanvasWidth`, `specifiedCanvasWidth`만 사용자 UI로 노출한다.
- `pageContainerWidth`, `pageContainerHeight`, `allowCanvasBoxSelection` 사용자 UI가 없다.

```ts
const settingKeyByDefinitionName: Record<string, CanvasOwnerSettingKey> = {
  // ...
  pageContainerWidth: 'pageContainerWidth',
  pageContainerHeight: 'pageContainerHeight',
  autoCanvasHeight: 'autoCanvasHeight',
  autoCanvasWidth: 'autoCanvasWidth',
  useSpecifiedCanvasHeight: 'useSpecifiedCanvasHeight',
  specifiedCanvasHeight: 'specifiedCanvasHeight',
  specifiedCanvasWidth: 'specifiedCanvasWidth',
  // ...
  allowCanvasBoxSelection: 'allowCanvasBoxSelection',
};
```

```ts
const previewAdditionalControlPanelsEnabled =
  selectedManagedPage.id === 'templates' || (!routeEquivalentPreviewEnabled && Boolean(templateExtractPanel || previewSettings.showAdditionalControlPanels));
```

## src/components/template/workspace/panels/TemplatePersistencePanel.tsx

수정 전 핵심 상태:
- 하단 저장 버튼이 `saveDisabled` prop을 받지 않는다.
- 하단 저장 버튼 disabled 조건에 `saveDisabled`가 없다.

```ts
type TemplatePersistencePanelProps = {
  // ...
  saving: boolean;
  loading: boolean;
  renderedPreviewHtml: string;
  templateUsagePreviewMode: boolean;
  visibility?: TemplateEditWorkspacePersistenceVisibility;
  // ...
};
```

```tsx
<Button
  {...canvasOwnerEnv('persistenceVisibility.showSaveButton')}
  className="h-11 min-h-11 w-full"
  onClick={onSave}
  disabled={saving || loading || !renderedPreviewHtml.trim() || templateUsagePreviewMode}
>
  {saving ? '저장 중...' : templateDetailTemplateId ? '현재 템플릿 저장' : '초안 저장'}
</Button>
```

## src/components/template/TemplateEditWorkspace.tsx

수정 전 핵심 상태:
- `TemplateEditCanvasToolbar`에는 `saveDisabled`를 전달한다.
- `TemplatePersistencePanel`에는 `saveDisabled`를 전달하지 않는다.

```tsx
<TemplatePersistencePanel
  templateListDisplay={templateListDisplay}
  additionalControlPanels={additionalControlPanels}
  templates={templates}
  selectedTemplateId={selectedTemplateId}
  templateDetailTemplateId={templateDetail?.template.id}
  templateOptions={templateOptions}
  templateName={templateName}
  sourceDocumentName={sourceDocumentName}
  layoutResizeMode={layoutResizeMode}
  saving={saving}
  loading={loading}
  renderedPreviewHtml={renderedPreviewHtml}
  templateUsagePreviewMode={templateUsagePreviewMode}
  visibility={persistenceVisibility}
  onSelectTemplate={handleSelectedTemplateChange}
  onDeleteTemplate={(option) => {
    void handleDeleteTemplateOption(option);
  }}
  onSave={() => {
    void saveTemplate();
  }}
  onTemplateNameChange={setTemplateName}
  onSourceDocumentNameChange={setSourceDocumentName}
  onLayoutResizeModeChange={(nextMode) => setLayoutResizeMode(nextMode as TemplateLayoutResizeMode)}
/>
```
