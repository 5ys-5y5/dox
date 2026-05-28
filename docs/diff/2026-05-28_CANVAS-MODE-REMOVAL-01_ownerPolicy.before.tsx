'use client';

import { notFound } from 'next/navigation';
import TemplateEditWorkspace from '../../components/template/TemplateEditWorkspace';
import type { TemplateEditWorkspaceProps } from '../../components/template/workspace/types';
import {
  applyCanvasOwnerSettingsToWorkspaceProps,
  normalizeCanvasWorkspaceRuntime,
  type CanvasOwnerSettings,
  type CanvasOwnerSettingKey,
  type CanvasOwnerSettingSource,
  useStoredCanvasOwnerSettings,
} from './ownerSettings';

type CanvasWorkspaceRuntime = NonNullable<TemplateEditWorkspaceProps['workspaceMode']>;

export type CanvasOwnerSurface =
  | 'canvas'
  | 'member-access'
  | 'project'
  | 'request-links'
  | 'templates'
  | 'templates-edit'
  | 'templates-extract-preview';

type CanvasOwnedWorkspaceProps = TemplateEditWorkspaceProps & {
  surface: CanvasOwnerSurface;
  applyStoredCanvasOwnerSettings?: boolean;
  canvasOwnerSettings?: CanvasOwnerSettings | null;
  canvasOwnerSettingSources?: Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>;
};

type CanvasSurfacePolicy = {
  supportedRuntimes: CanvasWorkspaceRuntime[];
  allowEditableValueKeys?: boolean;
  allowTemplateInitialDraft?: boolean;
};

const CANVAS_SURFACE_POLICIES: Record<CanvasOwnerSurface, CanvasSurfacePolicy> = {
  canvas: {
    supportedRuntimes: ['template', 'document', 'read'],
    allowEditableValueKeys: true,
  },
  'member-access': {
    supportedRuntimes: ['document', 'read'],
    allowEditableValueKeys: true,
  },
  project: {
    supportedRuntimes: ['document', 'read'],
  },
  'request-links': {
    supportedRuntimes: ['document', 'read'],
    allowEditableValueKeys: true,
  },
  templates: {
    supportedRuntimes: ['template'],
    allowTemplateInitialDraft: true,
  },
  'templates-edit': {
    supportedRuntimes: ['template'],
  },
  'templates-extract-preview': {
    supportedRuntimes: ['read'],
  },
};

const resolveCanvasWorkspaceRuntime = (value: TemplateEditWorkspaceProps['workspaceMode']): CanvasWorkspaceRuntime =>
  normalizeCanvasWorkspaceRuntime(value);

const hasEditableValueKeys = (value: string[] | null | undefined) =>
  Array.isArray(value) && value.some((item) => String(item || '').trim().length > 0);

const validateCanvasOwnedWorkspace = (
  surface: CanvasOwnerSurface,
  props: TemplateEditWorkspaceProps
) => {
  const policy = CANVAS_SURFACE_POLICIES[surface];
  const workspaceRuntime = resolveCanvasWorkspaceRuntime(props.workspaceMode);

  if (!policy.supportedRuntimes.includes(workspaceRuntime)) {
    return false;
  }

  if (workspaceRuntime === 'template') {
    if (props.initialDraft && !policy.allowTemplateInitialDraft) {
      return false;
    }
    if (props.documentAttachmentApiPath || props.onSaveDraftHtml || hasEditableValueKeys(props.editableValueKeys)) {
      return false;
    }
  }

  if (workspaceRuntime !== 'template') {
    if (!props.initialDraft) {
      return false;
    }
  }

  if (workspaceRuntime === 'document') {
    if (typeof props.onSaveDraftHtml !== 'function') {
      return false;
    }
  }

  if (workspaceRuntime === 'read') {
    if (typeof props.onSaveDraftHtml === 'function') {
      return false;
    }
  }

  if (hasEditableValueKeys(props.editableValueKeys) && !policy.allowEditableValueKeys) {
    return false;
  }

  return true;
};

const resolveCanvasOwnedWorkspaceProps = ({
  surface,
  workspaceMode,
  canvasOwnerSettings,
  canvasOwnerSettingSources,
  ...props
}: CanvasOwnedWorkspaceProps): TemplateEditWorkspaceProps => {
  const normalizedWorkspaceRuntime = resolveCanvasWorkspaceRuntime(workspaceMode);
  const normalizedProps: TemplateEditWorkspaceProps = {
    ...props,
    workspaceMode: normalizedWorkspaceRuntime,
    hidePersistencePanel:
      normalizedWorkspaceRuntime === 'template' ? props.hidePersistencePanel : (props.hidePersistencePanel ?? true),
    templateNameReadOnly:
      normalizedWorkspaceRuntime === 'template' ? props.templateNameReadOnly : (props.templateNameReadOnly ?? true),
    saveDisabled: normalizedWorkspaceRuntime === 'read' ? true : props.saveDisabled,
  };
  const configuredProps = canvasOwnerSettings
    ? applyCanvasOwnerSettingsToWorkspaceProps({
        baseProps: normalizedProps,
        settings: canvasOwnerSettings,
        settingSources: canvasOwnerSettingSources,
        workspaceRuntime: normalizedWorkspaceRuntime,
      })
    : normalizedProps;

  if (!validateCanvasOwnedWorkspace(surface, configuredProps)) {
    notFound();
  }

  return configuredProps;
};

export function CanvasOwnedWorkspace({
  applyStoredCanvasOwnerSettings = true,
  canvasOwnerSettings: explicitCanvasOwnerSettings,
  canvasOwnerSettingSources: explicitCanvasOwnerSettingSources,
  ...workspaceProps
}: CanvasOwnedWorkspaceProps) {
  const ownedWorkspaceProps = workspaceProps;
  const normalizedWorkspaceRuntime = normalizeCanvasWorkspaceRuntime(ownedWorkspaceProps.workspaceMode);
  const storedCanvasOwnerSettings = useStoredCanvasOwnerSettings({
    pageId: ownedWorkspaceProps.surface,
  });
  const canvasOwnerSettings =
    explicitCanvasOwnerSettings ??
    (applyStoredCanvasOwnerSettings ? storedCanvasOwnerSettings.settings : null);
  const canvasOwnerSettingSources =
    explicitCanvasOwnerSettingSources ??
    (applyStoredCanvasOwnerSettings ? storedCanvasOwnerSettings.sources : undefined);
  const resolvedWorkspaceProps = resolveCanvasOwnedWorkspaceProps({
    ...ownedWorkspaceProps,
    canvasOwnerSettings,
    canvasOwnerSettingSources,
  });
  const canvasOwnerSettingsSource = canvasOwnerSettingSources
    ? [
        `canvasViewMode:${canvasOwnerSettingSources.canvasViewMode || 'unknown'}`,
        `readModeInteractionMode:${canvasOwnerSettingSources.readModeInteractionMode || 'unknown'}`,
        `selectionInactiveOverlayOpacity:${canvasOwnerSettingSources.selectionInactiveOverlayOpacity || 'unknown'}`,
      ].join('|')
    : canvasOwnerSettings
      ? 'explicit'
      : 'props';

  return (
    <div
      style={{ display: 'contents' }}
      data-canvas-owner-item="canvas-container"
      data-canvas-owner-surface={ownedWorkspaceProps.surface}
      data-canvas-owner-workspace-runtime={resolvedWorkspaceProps.workspaceMode || normalizedWorkspaceRuntime}
      data-canvas-owner-view-mode={resolvedWorkspaceProps.canvasViewMode || 'position'}
      data-canvas-owner-selection-mode={resolvedWorkspaceProps.canvasSelectionMode || 'none'}
      data-canvas-owner-text-interaction-mode={resolvedWorkspaceProps.canvasTextInteractionMode || 'default'}
      data-canvas-owner-selection-inactive-overlay-opacity={String(
        resolvedWorkspaceProps.selectionInactiveOverlayOpacity ?? ''
      )}
      data-canvas-owner-settings-source={canvasOwnerSettingsSource}
    >
      <TemplateEditWorkspace {...resolvedWorkspaceProps} />
    </div>
  );
}
