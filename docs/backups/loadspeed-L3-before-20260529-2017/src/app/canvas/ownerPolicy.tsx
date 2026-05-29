'use client';

import TemplateEditWorkspace from '../../components/template/TemplateEditWorkspace';
import type { TemplateEditWorkspaceProps } from '../../components/template/workspace/types';
import {
  applyCanvasOwnerSettingsToWorkspaceProps,
  type CanvasOwnerSettings,
  type CanvasOwnerSettingKey,
  type CanvasOwnerSettingSource,
  useStoredCanvasOwnerSettings,
} from './ownerSettings';
import {
  resolveCanvasOwnerRouteWorkspaceProps,
  type CanvasOwnerRouteWorkspaceInput,
  type CanvasOwnerSurface,
} from './ownerRouteContract';

export type { CanvasOwnerSurface } from './ownerRouteContract';

type CanvasOwnedWorkspaceProps = CanvasOwnerRouteWorkspaceInput & {
  surface: CanvasOwnerSurface;
  applyStoredCanvasOwnerSettings?: boolean;
  canvasOwnerSettings?: CanvasOwnerSettings | null;
  canvasOwnerSettingSources?: Record<CanvasOwnerSettingKey, CanvasOwnerSettingSource>;
};

const resolveCanvasOwnedWorkspaceProps = ({
  surface: _surface,
  canvasOwnerSettings,
  canvasOwnerSettingSources,
  ...props
}: CanvasOwnedWorkspaceProps): TemplateEditWorkspaceProps => {
  const routeWorkspaceProps = resolveCanvasOwnerRouteWorkspaceProps({
    surface: _surface,
    props,
  });

  if (!canvasOwnerSettings) {
    return routeWorkspaceProps;
  }

  return applyCanvasOwnerSettingsToWorkspaceProps({
    baseProps: routeWorkspaceProps,
    settings: canvasOwnerSettings,
    settingSources: canvasOwnerSettingSources,
  });
};

export function CanvasOwnedWorkspace({
  applyStoredCanvasOwnerSettings = true,
  canvasOwnerSettings: explicitCanvasOwnerSettings,
  canvasOwnerSettingSources: explicitCanvasOwnerSettingSources,
  ...workspaceProps
}: CanvasOwnedWorkspaceProps) {
  const ownedWorkspaceProps = workspaceProps;
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
    ? `selectionInactiveOverlayOpacity:${canvasOwnerSettingSources.selectionInactiveOverlayOpacity || 'unknown'}`
    : canvasOwnerSettings
      ? 'explicit'
      : 'props';

  return (
    <div
      style={{ display: 'contents' }}
      data-canvas-owner-item="canvas-container"
      data-canvas-owner-surface={ownedWorkspaceProps.surface}
      data-canvas-owner-selection-policy={resolvedWorkspaceProps.canvasSelectionMode || 'none'}
      data-canvas-owner-text-interaction-policy={resolvedWorkspaceProps.canvasTextInteractionMode || 'default'}
      data-canvas-owner-selection-inactive-overlay-opacity={String(
        resolvedWorkspaceProps.selectionInactiveOverlayOpacity ?? ''
      )}
      data-canvas-owner-settings-source={canvasOwnerSettingsSource}
    >
      <TemplateEditWorkspace {...resolvedWorkspaceProps} />
    </div>
  );
}
