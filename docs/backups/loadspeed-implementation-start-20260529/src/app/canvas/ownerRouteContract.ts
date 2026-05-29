'use client';

import type * as React from 'react';
import type { TemplateEditWorkspaceProps } from '../../components/template/workspace/types';

export type CanvasOwnerSurface =
  | 'canvas'
  | 'member-access'
  | 'project'
  | 'request-links'
  | 'templates'
  | 'templates-edit'
  | 'templates-extract-preview';

type CanvasOwnerRouteLocalUiProp =
  | 'additionalControlPanels'
  | 'canvasPageContainerHeight'
  | 'canvasPageContainerWidth'
  | 'canvasSelectionMode'
  | 'canvasSpecifiedHeight'
  | 'canvasSpecifiedHeightEnabled'
  | 'canvasSpecifiedWidth'
  | 'canvasSpecifiedWidthEnabled'
  | 'canvasTextInteractionMode'
  | 'canvasToolbarVisibility'
  | 'defaultCanvasFullscreen'
  | 'documentAttachmentApiPath'
  | 'headerDescription'
  | 'headerTitle'
  | 'hideHeader'
  | 'hidePersistencePanel'
  | 'nameFieldLabel'
  | 'persistenceVisibility'
  | 'saveButtonLabel'
  | 'saveDisabled'
  | 'selectionInactiveOverlayOpacity'
  | 'showWorkspaceMessages'
  | 'suppressInitialDraftLoadedMessage'
  | 'templateListDisplay'
  | 'templateNameReadOnly'
  | 'templateUsagePreviewLayoutDebugOptions'
  | 'todoButtonLabel'
  | 'todoCount'
  | 'todoPanel'
  | 'topNotice';

type CanvasOwnerRouteWorkspaceBaseProps = Omit<TemplateEditWorkspaceProps, CanvasOwnerRouteLocalUiProp>;

/**
 * CANVAS OWNER FIRST PRINCIPLE
 * Route pages must not decide canvas UI visibility, capability, or feature availability.
 * Update this central /canvas owner contract first.
 * If a route-local override is requested, ask for explicit confirmation before implementing it.
 */
export type CanvasOwnerRouteWorkspaceInput = CanvasOwnerRouteWorkspaceBaseProps & {
  canvasOwnerAdditionalControlPanels?: React.ReactNode;
  canvasOwnerCanEditWorkspace?: boolean;
  canvasOwnerCanSignDocument?: boolean;
  canvasOwnerDocumentAttachmentApiPath?: string;
  canvasOwnerRuntimeSaveDisabled?: boolean;
  canvasOwnerTodoButtonLabel?: string;
  canvasOwnerTodoCount?: number;
  canvasOwnerTodoPanel?: React.ReactNode;
  canvasOwnerTopNotice?: React.ReactNode;
};

type CanvasOwnerRouteWorkspaceDefaults = Pick<
  TemplateEditWorkspaceProps,
  | 'editableValueKeys'
  | 'headerDescription'
  | 'headerTitle'
  | 'hideHeader'
  | 'hidePersistencePanel'
  | 'nameFieldLabel'
  | 'saveButtonLabel'
  | 'saveDisabled'
  | 'showWorkspaceMessages'
  | 'suppressInitialDraftLoadedMessage'
  | 'templateListDisplay'
  | 'templateNameReadOnly'
>;

const fallbackTodoPanel = '등록된 할 일이 없습니다.';

const templateEditDefaults = (runtimeSaveDisabled: boolean): CanvasOwnerRouteWorkspaceDefaults => ({
  hideHeader: false,
  hidePersistencePanel: false,
  templateListDisplay: 'inline',
  showWorkspaceMessages: true,
  suppressInitialDraftLoadedMessage: false,
  headerTitle: '템플릿 편집',
  headerDescription: '저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.',
  nameFieldLabel: '템플릿 이름:',
  saveButtonLabel: '저장',
  templateNameReadOnly: false,
  saveDisabled: runtimeSaveDisabled,
});

const resolveCanvasOwnerRouteDefaults = (
  surface: CanvasOwnerSurface,
  {
    canvasOwnerCanEditWorkspace = true,
    canvasOwnerCanSignDocument = false,
    canvasOwnerRuntimeSaveDisabled = false,
    onSaveDraftHtml,
  }: CanvasOwnerRouteWorkspaceInput
): CanvasOwnerRouteWorkspaceDefaults => {
  const documentSaveEnabled = typeof onSaveDraftHtml === 'function';
  const runtimeSaveDisabled = canvasOwnerRuntimeSaveDisabled || !canvasOwnerCanEditWorkspace;

  if (surface === 'templates') {
    return {
      ...templateEditDefaults(runtimeSaveDisabled),
      suppressInitialDraftLoadedMessage: true,
    };
  }

  if (surface === 'templates-edit') {
    return templateEditDefaults(runtimeSaveDisabled);
  }

  if (surface === 'project') {
    return {
      hideHeader: true,
      hidePersistencePanel: true,
      editableValueKeys: null,
      showWorkspaceMessages: true,
      suppressInitialDraftLoadedMessage: true,
      headerTitle: '템플릿 편집',
      headerDescription: '저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.',
      nameFieldLabel: '문서 이름:',
      saveButtonLabel: '문서 저장',
      templateNameReadOnly: true,
      saveDisabled: runtimeSaveDisabled || !documentSaveEnabled,
    };
  }

  if (surface === 'request-links') {
    return {
      hideHeader: false,
      hidePersistencePanel: true,
      showWorkspaceMessages: true,
      suppressInitialDraftLoadedMessage: true,
      headerTitle: '상자 편집 캔버스',
      headerDescription: '요청 링크에서 허용된 항목만 기록할 수 있습니다.',
      nameFieldLabel: '템플릿 이름:',
      saveButtonLabel: '문서 저장',
      templateNameReadOnly: true,
      saveDisabled: runtimeSaveDisabled || !documentSaveEnabled,
    };
  }

  if (surface === 'member-access') {
    return {
      hideHeader: false,
      hidePersistencePanel: true,
      editableValueKeys: null,
      showWorkspaceMessages: true,
      suppressInitialDraftLoadedMessage: false,
      headerTitle: '구성원 문서 접근',
      headerDescription: '멤버 소속과 scope 배정 범위 안에서 현장 문서를 열람하거나 수정합니다.',
      nameFieldLabel: '문서 이름:',
      saveButtonLabel: documentSaveEnabled && canvasOwnerCanEditWorkspace ? '문서 저장' : canvasOwnerCanSignDocument ? '서명 완료' : '열람 전용',
      templateNameReadOnly: true,
      saveDisabled: runtimeSaveDisabled || !documentSaveEnabled,
    };
  }

  if (surface === 'templates-extract-preview') {
    return {
      hideHeader: true,
      hidePersistencePanel: true,
      editableValueKeys: null,
      showWorkspaceMessages: true,
      suppressInitialDraftLoadedMessage: true,
      headerTitle: '상자 편집 캔버스',
      headerDescription: 'PDF 추출 결과를 읽기 전용 공용 캔버스로 확인합니다.',
      nameFieldLabel: '템플릿 이름:',
      saveButtonLabel: '열람 전용',
      templateNameReadOnly: true,
      saveDisabled: true,
    };
  }

  return {
    hideHeader: false,
    hidePersistencePanel: false,
    templateListDisplay: 'inline',
    showWorkspaceMessages: true,
    suppressInitialDraftLoadedMessage: false,
    headerTitle: '상자 편집 캔버스',
    headerDescription: '공용 캔버스 owner 경로입니다.',
    nameFieldLabel: '문서 이름:',
    saveButtonLabel: '문서 저장',
    templateNameReadOnly: false,
    saveDisabled: runtimeSaveDisabled,
  };
};

export const resolveCanvasOwnerRouteWorkspaceProps = ({
  surface,
  props,
}: {
  surface: CanvasOwnerSurface;
  props: CanvasOwnerRouteWorkspaceInput;
}): TemplateEditWorkspaceProps => {
  const {
    canvasOwnerAdditionalControlPanels,
    canvasOwnerDocumentAttachmentApiPath,
    canvasOwnerTodoButtonLabel,
    canvasOwnerTodoCount,
    canvasOwnerTodoPanel,
    canvasOwnerTopNotice,
    canvasOwnerCanEditWorkspace: _canvasOwnerCanEditWorkspace,
    canvasOwnerCanSignDocument: _canvasOwnerCanSignDocument,
    canvasOwnerRuntimeSaveDisabled: _canvasOwnerRuntimeSaveDisabled,
    ...workspaceProps
  } = props;
  const routeDefaults = resolveCanvasOwnerRouteDefaults(surface, props);

  return {
    ...routeDefaults,
    ...workspaceProps,
    additionalControlPanels: canvasOwnerAdditionalControlPanels,
    documentAttachmentApiPath: canvasOwnerDocumentAttachmentApiPath || '',
    saveDisabled: Boolean(routeDefaults.saveDisabled),
    todoButtonLabel: canvasOwnerTodoButtonLabel || '할 일',
    todoCount: canvasOwnerTodoCount || 0,
    todoPanel: canvasOwnerTodoPanel ?? fallbackTodoPanel,
    topNotice: canvasOwnerTopNotice,
  };
};
