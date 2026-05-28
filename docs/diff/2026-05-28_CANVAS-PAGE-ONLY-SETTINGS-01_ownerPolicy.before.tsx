'use client';

import { notFound } from 'next/navigation';
import TemplateEditWorkspace from '../../components/template/TemplateEditWorkspace';
import type { TemplateEditWorkspaceProps } from '../../components/template/workspace/types';
import {
  applyCanvasOwnerSettingsToWorkspaceProps,
  normalizeCanvasWorkspaceMode,
  resolveCanvasOwnerPagePolicy,
  type CanvasOwnerSettings,
  type CanvasOwnerSettingKey,
  type CanvasOwnerSettingSource,
  type CanvasOwnerSettingsStore,
  useStoredCanvasOwnerSettings,
} from './ownerSettings';

type CanvasWorkspaceMode = NonNullable<TemplateEditWorkspaceProps['workspaceMode']>;

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
  canvasOwnerSettingsStore?: CanvasOwnerSettingsStore;
  allowedWorkspaceModes?: CanvasWorkspaceMode[];
};

type CanvasSurfacePolicy = {
  allowedModes: CanvasWorkspaceMode[];
  allowEditableValueKeys?: boolean;
  allowTemplateInitialDraft?: boolean;
};

const CANVAS_SURFACE_POLICIES: Record<CanvasOwnerSurface, CanvasSurfacePolicy> = {
  canvas: {
    allowedModes: ['template', 'document', 'read'],
    allowEditableValueKeys: true,
  },
  'member-access': {
    allowedModes: ['document', 'read'],
    allowEditableValueKeys: true,
  },
  project: {
    allowedModes: ['document', 'read'],
  },
  'request-links': {
    allowedModes: ['document', 'read'],
    allowEditableValueKeys: true,
  },
  templates: {
    allowedModes: ['template'],
    allowTemplateInitialDraft: true,
  },
  'templates-edit': {
    allowedModes: ['template'],
  },
  'templates-extract-preview': {
    allowedModes: ['read'],
  },
};

const resolveCanvasWorkspaceMode = (value: TemplateEditWorkspaceProps['workspaceMode']): CanvasWorkspaceMode =>
  normalizeCanvasWorkspaceMode(value);

const hasEditableValueKeys = (value: string[] | null | undefined) =>
  Array.isArray(value) && value.some((item) => String(item || '').trim().length > 0);

const resolveCanvasOwnedSurfacePolicy = (
  surface: CanvasOwnerSurface,
  settingsStore?: CanvasOwnerSettingsStore,
  allowedWorkspaceModes?: CanvasWorkspaceMode[]
): CanvasSurfacePolicy => {
  const policy = CANVAS_SURFACE_POLICIES[surface];
  const resolvedPolicy = resolveCanvasOwnerPagePolicy(settingsStore || {
    version: 6,
    pageSettings: {},
    pagePolicies: {},
  }, {
    pageId: surface,
    defaultAllowedModes: allowedWorkspaceModes || policy.allowedModes,
    defaultMode: (allowedWorkspaceModes && allowedWorkspaceModes[0]) || policy.allowedModes[0],
  });

  return {
    ...policy,
    allowedModes: resolvedPolicy.allowedModes,
  };
};

const validateCanvasOwnedWorkspace = (
  surface: CanvasOwnerSurface,
  props: TemplateEditWorkspaceProps,
  settingsStore?: CanvasOwnerSettingsStore,
  allowedWorkspaceModes?: CanvasWorkspaceMode[]
) => {
  const policy = resolveCanvasOwnedSurfacePolicy(surface, settingsStore, allowedWorkspaceModes);
  const workspaceMode = resolveCanvasWorkspaceMode(props.workspaceMode);

  if (!policy.allowedModes.includes(workspaceMode)) {
    return false;
  }

  if (workspaceMode === 'template') {
    if (props.initialDraft && !policy.allowTemplateInitialDraft) {
      return false;
    }
    if (props.documentAttachmentApiPath || props.onSaveDraftHtml || hasEditableValueKeys(props.editableValueKeys)) {
      return false;
    }
  }

  if (workspaceMode !== 'template') {
    if (!props.initialDraft) {
      return false;
    }
    if (props.templateListDisplay) {
      return false;
    }
  }

  if (workspaceMode === 'document') {
    if (typeof props.onSaveDraftHtml !== 'function') {
      return false;
    }
  }

  if (workspaceMode === 'read') {
    if (typeof props.onSaveDraftHtml === 'function') {
      return false;
    }
    if (props.saveDisabled === false) {
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
  canvasOwnerSettingsStore,
  allowedWorkspaceModes,
  ...props
}: CanvasOwnedWorkspaceProps): TemplateEditWorkspaceProps => {
  const normalizedWorkspaceMode = resolveCanvasWorkspaceMode(workspaceMode);
  const normalizedProps: TemplateEditWorkspaceProps = {
    ...props,
    workspaceMode: normalizedWorkspaceMode,
    hidePersistencePanel:
      normalizedWorkspaceMode === 'template' ? props.hidePersistencePanel : (props.hidePersistencePanel ?? true),
    templateNameReadOnly:
      normalizedWorkspaceMode === 'template' ? props.templateNameReadOnly : (props.templateNameReadOnly ?? true),
    saveDisabled: normalizedWorkspaceMode === 'read' ? true : props.saveDisabled,
  };
  const configuredProps = canvasOwnerSettings
    ? applyCanvasOwnerSettingsToWorkspaceProps({
        baseProps: normalizedProps,
        settings: canvasOwnerSettings,
        settingSources: canvasOwnerSettingSources,
        workspaceMode: normalizedWorkspaceMode,
      })
    : normalizedProps;

  if (!validateCanvasOwnedWorkspace(surface, configuredProps, canvasOwnerSettingsStore, allowedWorkspaceModes)) {
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
  const normalizedWorkspaceMode = normalizeCanvasWorkspaceMode(ownedWorkspaceProps.workspaceMode);
  const storedCanvasOwnerSettings = useStoredCanvasOwnerSettings({
    pageId: ownedWorkspaceProps.surface,
    workspaceMode: normalizedWorkspaceMode,
  });
  const canvasOwnerSettings =
    explicitCanvasOwnerSettings ??
    (applyStoredCanvasOwnerSettings ? storedCanvasOwnerSettings.settings : null);
  const canvasOwnerSettingSources =
    explicitCanvasOwnerSettingSources ??
    (applyStoredCanvasOwnerSettings ? storedCanvasOwnerSettings.sources : undefined);
  const canvasOwnerSettingsStore = applyStoredCanvasOwnerSettings ? storedCanvasOwnerSettings.settingsStore : undefined;
  const resolvedWorkspaceProps = resolveCanvasOwnedWorkspaceProps({
    ...ownedWorkspaceProps,
    canvasOwnerSettings,
    canvasOwnerSettingSources,
    canvasOwnerSettingsStore,
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
      data-canvas-owner-mode={resolvedWorkspaceProps.workspaceMode || 'template'}
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
