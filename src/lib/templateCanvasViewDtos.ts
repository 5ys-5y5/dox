export type TemplateCanvasViewMode = 'preview' | 'position' | 'metadata' | 'metadata2';

export type TemplateCanvasSelectionPanelTab = 'position' | 'metadata' | 'metadata2';

export type TemplateCanvasViewRevision = {
  draftRevision: number;
  layoutRevision: number;
  selectionRevision: number;
  settingsSignature: string;
};

export type TemplateCanvasViewCacheKey = {
  templateId: string;
  viewMode: TemplateCanvasViewMode;
  revision: TemplateCanvasViewRevision;
};

export type TemplateCanvasDerivedViewState = {
  key: TemplateCanvasViewCacheKey;
  viewMode: TemplateCanvasViewMode;
  ready: boolean;
  stale: boolean;
  overlayPlan: unknown;
  domPatchPlan: unknown;
  diagnostics: {
    computedAt: number;
    reason: string;
  };
};

export type TemplateCanvasPreparedViewMatchResult =
  | { ok: true; preparedView: TemplateCanvasDerivedViewState }
  | {
      ok: false;
      reason:
        | 'view-mode-mismatch'
        | 'revision-mismatch'
        | 'settings-signature-mismatch'
        | 'not-ready'
        | 'stale'
        | 'missing';
      requestedViewMode: TemplateCanvasViewMode;
      preparedViewMode?: TemplateCanvasViewMode;
    };
