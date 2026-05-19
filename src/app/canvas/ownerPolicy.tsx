'use client';

import { notFound } from 'next/navigation';
import TemplateEditWorkspace from '../../components/template/TemplateEditWorkspace';
import type { TemplateEditWorkspaceProps } from '../../components/template/workspace/types';

type CanvasWorkspaceMode = NonNullable<TemplateEditWorkspaceProps['workspaceMode']>;

export type CanvasOwnerSurface =
  | 'canvas'
  | 'documents'
  | 'member-access'
  | 'project'
  | 'request-links'
  | 'templates'
  | 'templates-edit'
  | 'templates-extract-preview';

type CanvasOwnedWorkspaceProps = TemplateEditWorkspaceProps & {
  surface: CanvasOwnerSurface;
};

type CanvasSurfacePolicy = {
  allowedModes: CanvasWorkspaceMode[];
  allowEditableValueKeys?: boolean;
};

const CANVAS_SURFACE_POLICIES: Record<CanvasOwnerSurface, CanvasSurfacePolicy> = {
  canvas: {
    allowedModes: ['template', 'document', 'read'],
    allowEditableValueKeys: true,
  },
  documents: {
    allowedModes: ['read'],
  },
  'member-access': {
    allowedModes: ['document', 'read'],
  },
  project: {
    allowedModes: ['document'],
  },
  'request-links': {
    allowedModes: ['document', 'read'],
    allowEditableValueKeys: true,
  },
  templates: {
    allowedModes: ['template'],
  },
  'templates-edit': {
    allowedModes: ['template'],
  },
  'templates-extract-preview': {
    allowedModes: ['read'],
  },
};

const resolveCanvasWorkspaceMode = (value: TemplateEditWorkspaceProps['workspaceMode']): CanvasWorkspaceMode =>
  value === 'document' || value === 'read' ? value : 'template';

const hasEditableValueKeys = (value: string[] | null | undefined) =>
  Array.isArray(value) && value.some((item) => String(item || '').trim().length > 0);

const validateCanvasOwnedWorkspace = (surface: CanvasOwnerSurface, props: TemplateEditWorkspaceProps) => {
  const policy = CANVAS_SURFACE_POLICIES[surface];
  const workspaceMode = resolveCanvasWorkspaceMode(props.workspaceMode);

  if (!policy.allowedModes.includes(workspaceMode)) {
    return false;
  }

  if (workspaceMode === 'template') {
    if (props.initialDraft) {
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

  if (!validateCanvasOwnedWorkspace(surface, normalizedProps)) {
    notFound();
  }

  return normalizedProps;
};

export function CanvasOwnedWorkspace(props: CanvasOwnedWorkspaceProps) {
  return <TemplateEditWorkspace {...resolveCanvasOwnedWorkspaceProps(props)} />;
}
