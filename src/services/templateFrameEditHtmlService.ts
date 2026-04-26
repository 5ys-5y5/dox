export const TEMPLATE_FRAME_EDITOR_UI_SELECTORS = [
  '[data-v106-resize-handle="true"]',
  '[data-frame-editor-ui="true"]',
  '.v106-frame-selection-badge',
  '.v106-frame-delete-button',
  '.v106-frame-create-ghost',
] as const;

export const TemplateFrameEditHtmlService = {
  // FRAMEEDIT_HTML_UI_STATE_STRIP
  // 저장 가능한 template draftHtml 에는 selection badge, resize handle,
  // delete button, 생성 ghost 같은 편집 UI 전용 노드를 남기지 않는다.
  stripEditorUiState(root: ParentNode) {
    TEMPLATE_FRAME_EDITOR_UI_SELECTORS.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => {
        element.remove();
      });
    });
  },
};
