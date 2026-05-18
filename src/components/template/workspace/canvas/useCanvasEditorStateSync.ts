'use client';

import * as React from 'react';

type UseCanvasEditorStateSyncOptions = {
  previewRef: React.MutableRefObject<HTMLDivElement | null>;
  draftPreviewHtmlRef: React.MutableRefObject<string>;
  previewEditorStateRetryCountRef: React.MutableRefObject<number>;
  pendingPreviewViewportResetRef: React.MutableRefObject<boolean>;
  renderedPreviewHtml: string;
  surfaceRenderedPreviewHtml: string;
  selectionPanelTab: string;
  templateUsagePreviewMode: boolean;
  boxCreationMode: boolean;
  boxCreationPositionMode: string;
  frameEdgeButtonSelector: string;
  templatePreviewEditPermissionsTabAttr: string;
  templatePreviewContentStabilizedAttr: string;
  templateFrameVisualHintsSignatureAttr: string;
  templateMetadataRelationRenderSignatureAttr: string;
  applyEditorAutoSizeBoxesWithPreservedLayout: (root: HTMLElement) => { changedCount: number };
  syncDraftPreviewHtmlRef: (options?: any) => string;
  requestPreviewTextFit: () => void;
  schedulePreviewEditorState: () => void;
  cancelScheduledPreviewEditorState: () => void;
  syncPreviewSurfaceScale: (root: HTMLElement | null) => void;
};

export const useCanvasEditorStateSync = ({
  previewRef,
  draftPreviewHtmlRef,
  previewEditorStateRetryCountRef,
  pendingPreviewViewportResetRef,
  renderedPreviewHtml,
  surfaceRenderedPreviewHtml,
  selectionPanelTab,
  templateUsagePreviewMode,
  boxCreationMode,
  boxCreationPositionMode,
  frameEdgeButtonSelector,
  templatePreviewEditPermissionsTabAttr,
  templatePreviewContentStabilizedAttr,
  templateFrameVisualHintsSignatureAttr,
  templateMetadataRelationRenderSignatureAttr,
  applyEditorAutoSizeBoxesWithPreservedLayout,
  syncDraftPreviewHtmlRef,
  requestPreviewTextFit,
  schedulePreviewEditorState,
  cancelScheduledPreviewEditorState,
  syncPreviewSurfaceScale,
}: UseCanvasEditorStateSyncOptions) => {
  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined') {
      return;
    }

    draftPreviewHtmlRef.current = renderedPreviewHtml;
    root.removeAttribute(templatePreviewEditPermissionsTabAttr);
    root.removeAttribute(templatePreviewContentStabilizedAttr);
    root.removeAttribute(templateFrameVisualHintsSignatureAttr);
    root.removeAttribute(templateMetadataRelationRenderSignatureAttr);

    let cancelled = false;

    const applyInitialEditorAutoSize = () => {
      if (templateUsagePreviewMode) {
        return;
      }

      const result = applyEditorAutoSizeBoxesWithPreservedLayout(root);
      if (result.changedCount <= 0) {
        return;
      }

      syncDraftPreviewHtmlRef({
        materializePositionGroups: false,
        recordHistory: false,
        updatePreviewDomVersion: false,
        updateRenderedHtml: false,
      });
      requestPreviewTextFit();
    };

    const applyEditorState = async () => {
      applyInitialEditorAutoSize();
      schedulePreviewEditorState();
      await document.fonts?.ready?.catch(() => undefined);

      if (cancelled) {
        return;
      }

      applyInitialEditorAutoSize();
      schedulePreviewEditorState();
    };

    const pageInnerObservers = Array.from(root.querySelectorAll<HTMLElement>('.page-inner')).map((pageInner) => {
      const observer = new MutationObserver(() => {
        if (cancelled) {
          return;
        }

        if (selectionPanelTab === 'position' && !root.querySelector(frameEdgeButtonSelector)) {
          schedulePreviewEditorState();
        }
      });
      observer.observe(pageInner, { childList: true });
      return observer;
    });

    void applyEditorState();

    return () => {
      cancelled = true;
      previewEditorStateRetryCountRef.current = 0;
      cancelScheduledPreviewEditorState();
      pageInnerObservers.forEach((observer) => observer.disconnect());
    };
  }, [
    applyEditorAutoSizeBoxesWithPreservedLayout,
    cancelScheduledPreviewEditorState,
    draftPreviewHtmlRef,
    frameEdgeButtonSelector,
    previewEditorStateRetryCountRef,
    previewRef,
    renderedPreviewHtml,
    requestPreviewTextFit,
    schedulePreviewEditorState,
    selectionPanelTab,
    syncDraftPreviewHtmlRef,
    templateFrameVisualHintsSignatureAttr,
    templateMetadataRelationRenderSignatureAttr,
    templatePreviewContentStabilizedAttr,
    templatePreviewEditPermissionsTabAttr,
    templateUsagePreviewMode,
  ]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined' || selectionPanelTab !== 'position') {
      return;
    }

    let attempts = 0;
    const timerId = window.setInterval(() => {
      const liveRoot = previewRef.current;

      if (!liveRoot) {
        return;
      }

      if (liveRoot.querySelector(frameEdgeButtonSelector)) {
        window.clearInterval(timerId);
        return;
      }

      schedulePreviewEditorState();
      attempts += 1;

      if (attempts >= 12) {
        window.clearInterval(timerId);
      }
    }, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [frameEdgeButtonSelector, previewRef, renderedPreviewHtml, schedulePreviewEditorState, selectionPanelTab]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined' || selectionPanelTab !== 'position') {
      return;
    }

    if (root.querySelector(frameEdgeButtonSelector)) {
      return;
    }

    const timerId = window.setTimeout(() => {
      schedulePreviewEditorState();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    boxCreationMode,
    boxCreationPositionMode,
    frameEdgeButtonSelector,
    previewRef,
    renderedPreviewHtml,
    schedulePreviewEditorState,
    selectionPanelTab,
  ]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root || typeof window === 'undefined') {
      return;
    }

    if (pendingPreviewViewportResetRef.current) {
      root.scrollTop = 0;
      root.scrollLeft = 0;
      pendingPreviewViewportResetRef.current = false;
    }

    syncPreviewSurfaceScale(root);
    const frameId = window.requestAnimationFrame(() => {
      syncPreviewSurfaceScale(previewRef.current);
    });
    const handleWindowResize = () => {
      syncPreviewSurfaceScale(previewRef.current);
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [pendingPreviewViewportResetRef, previewRef, surfaceRenderedPreviewHtml, syncPreviewSurfaceScale, templateUsagePreviewMode]);
};
