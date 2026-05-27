import type {
  TemplateCanvasDerivedViewState,
  TemplateCanvasPreparedViewMatchResult,
  TemplateCanvasViewCacheKey,
} from '../lib/templateCanvasViewDtos';

export const assertPreparedViewMatchesRequest = (
  requested: TemplateCanvasViewCacheKey,
  prepared: TemplateCanvasDerivedViewState | null
): TemplateCanvasPreparedViewMatchResult => {
  if (!prepared) {
    return {
      ok: false,
      reason: 'missing',
      requestedViewMode: requested.viewMode,
    };
  }

  if (prepared.viewMode !== requested.viewMode || prepared.key.viewMode !== requested.viewMode) {
    return {
      ok: false,
      reason: 'view-mode-mismatch',
      requestedViewMode: requested.viewMode,
      preparedViewMode: prepared.viewMode,
    };
  }

  if (
    prepared.key.revision.draftRevision !== requested.revision.draftRevision ||
    prepared.key.revision.layoutRevision !== requested.revision.layoutRevision ||
    prepared.key.revision.selectionRevision !== requested.revision.selectionRevision
  ) {
    return {
      ok: false,
      reason: 'revision-mismatch',
      requestedViewMode: requested.viewMode,
      preparedViewMode: prepared.viewMode,
    };
  }

  if (prepared.key.revision.settingsSignature !== requested.revision.settingsSignature) {
    return {
      ok: false,
      reason: 'settings-signature-mismatch',
      requestedViewMode: requested.viewMode,
      preparedViewMode: prepared.viewMode,
    };
  }

  if (!prepared.ready) {
    return {
      ok: false,
      reason: 'not-ready',
      requestedViewMode: requested.viewMode,
      preparedViewMode: prepared.viewMode,
    };
  }

  if (prepared.stale) {
    return {
      ok: false,
      reason: 'stale',
      requestedViewMode: requested.viewMode,
      preparedViewMode: prepared.viewMode,
    };
  }

  return {
    ok: true,
    preparedView: prepared,
  };
};
