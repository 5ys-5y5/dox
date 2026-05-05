'use client';

import * as React from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { applyTemplateExtractEditableTextFit } from '../../lib/templateExtractEditableTextFit';

type DraftPreviewEditRole = 'editor' | 'admin';
type PreviewPaneMode = 'source' | 'draft';
type FrameEditorRole = 'group' | 'key' | 'value' | 'key_value';
type FrameNodeRect = { left: number; top: number; width: number; height: number };
type FlattenedFramePreviewMarkup = {
  html: string;
  styleText: string;
  cloneId: string;
  extractionStage: string;
  frameGroupVersion: string;
  pageWidth: string;
  pageMinHeight: string;
};

const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SELECTION_NODE_SELECTOR = RAW_FRAME_NODE_SELECTOR;
const FRAME_SELECTION_BADGE_CLASS = 'v106-frame-selection-badge';
const FRAME_EDITOR_SUPPORTED_VERSIONS = ['fv1.06', 'fv1.07', 'fv1.08', 'fv1.09', 'fv1.10', 'fv1.11'] as const;
const FRAME_GROUP_ATTR_NAMES = [
  'data-template-frame-group',
  'data-template-frame-color-group',
  'data-template-frame-outline-style',
  'data-template-frame-extracted-text',
  'data-template-frame-value-key',
  'data-template-frame-source-text',
  'data-template-frame-role',
  'data-template-frame-parent-group',
  'data-template-frame-chain-key',
  'data-template-frame-chain-depth',
  'data-template-frame-row-start',
  'data-template-frame-row-end',
  'data-template-frame-col-start',
  'data-template-frame-col-end',
  'data-template-frame-halign',
  'data-template-frame-valign',
  'data-v106-band-source',
] as const;

const normalizePublicFrameGroupVersion = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.startsWith('fv1.')) {
    return normalized;
  }

  if (normalized.startsWith('v1.')) {
    return `f${normalized}`;
  }

  return normalized;
};

const hasSupportedFrameEditorMarkup = (html: string | null | undefined) =>
  FRAME_EDITOR_SUPPORTED_VERSIONS.some((version) => {
    const publicVersion = normalizePublicFrameGroupVersion(version);
    const legacyVersion = publicVersion.startsWith('fv') ? publicVersion.slice(1) : publicVersion;

    return new RegExp(`data-template-frame-group-version="(?:${publicVersion}|${legacyVersion})(?:-[^"]+)?"`, 'i').test(
      html || ''
    );
  });

const stripDraftPreviewUiState = (html: string) => {
  if (!html.trim()) {
    return '';
  }

  if (typeof document === 'undefined') {
    return html
      .replace(/\sdata-template-selected="true"/gi, '')
      .replace(/\sdata-template-primary-selected="true"/gi, '')
      .replace(/\sdata-template-selection-order="[^"]*"/gi, '')
      .replace(/\sdata-template-edit-enabled="(?:true|false)"/gi, '');
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
    element.removeAttribute('data-template-selected');
    element.removeAttribute('data-template-primary-selected');
    element.removeAttribute('data-template-selection-order');
  });
  container.querySelectorAll<HTMLElement>(`.${FRAME_SELECTION_BADGE_CLASS}`).forEach((element) => {
    element.remove();
  });
  container.querySelectorAll<HTMLElement>('[data-template-edit-enabled]').forEach((element) => {
    element.removeAttribute('data-template-edit-enabled');
  });
  return container.innerHTML;
};

const applyDraftPreviewEditPermissions = (root: HTMLElement, editRole: DraftPreviewEditRole) => {
  const isAdmin = editRole === 'admin';

  root.setAttribute('data-template-edit-role', editRole);
  root.querySelectorAll<HTMLElement>('[data-template-edit-scope]').forEach((element) => {
    const scope = element.getAttribute('data-template-edit-scope') || 'editor';
    const enabled = scope !== 'admin' || isAdmin;
    element.setAttribute('contenteditable', enabled ? 'true' : 'false');
    element.setAttribute('data-template-edit-enabled', enabled ? 'true' : 'false');
  });
};

const extractStyleValue = (styleText: string, property: string) => {
  const match = styleText.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

const flattenFramePreviewMarkup = (html: string): FlattenedFramePreviewMarkup | null => {
  if (!html.trim() || typeof document === 'undefined' || !html.includes('data-template-extraction-stage="frames"')) {
    return null;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const preFlattenedPageInner =
    container.querySelector<HTMLElement>(':scope > .page-inner[data-template-extraction-stage="frames"]') ||
    container.querySelector<HTMLElement>(':scope > .page-inner');

  if (preFlattenedPageInner) {
    const styleText = Array.from(container.children)
      .filter((node) => node.tagName === 'STYLE')
      .map((node) => node.textContent || '')
      .join('');

    return {
      html: preFlattenedPageInner.outerHTML,
      styleText,
      cloneId: preFlattenedPageInner.getAttribute('data-template-clone-id') || '',
      extractionStage: preFlattenedPageInner.getAttribute('data-template-extraction-stage') || 'frames',
      frameGroupVersion: preFlattenedPageInner.getAttribute('data-template-frame-group-version') || '',
      pageWidth: preFlattenedPageInner.style.width || '',
      pageMinHeight: preFlattenedPageInner.style.minHeight || '',
    };
  }

  const frameSection =
    container.querySelector<HTMLElement>(':scope > section[data-template-extraction-stage="frames"]') ||
    container.querySelector<HTMLElement>('section[data-template-extraction-stage="frames"]');

  if (!frameSection) {
    return null;
  }

  const pageSections = Array.from(frameSection.querySelectorAll<HTMLElement>(':scope > section.page'));

  if (pageSections.length !== 1) {
    return null;
  }

  const styleText = Array.from(frameSection.children)
    .filter((node) => node.tagName === 'STYLE')
    .map((node) => node.textContent || '')
    .join('');

  const fragment = document.createElement('div');
  let firstPageWidth = '';
  let firstPageMinHeight = '';

  pageSections.forEach((pageSection, pageIndex) => {
    const pageInner = pageSection.querySelector<HTMLElement>(':scope > .page-inner');

    if (!pageInner) {
      return;
    }

    const nextPageInner = pageInner.cloneNode(true) as HTMLElement;
    const pageStyle = pageSection.getAttribute('style') || '';
    const pageWidth = extractStyleValue(pageStyle, 'width');
    const pageMinHeight = extractStyleValue(pageStyle, 'min-height');

    if (!firstPageWidth && pageWidth) {
      firstPageWidth = pageWidth;
    }

    if (!firstPageMinHeight && pageMinHeight) {
      firstPageMinHeight = pageMinHeight;
    }

    nextPageInner.classList.add('template-clone', 'template-clone--raster-first-v2-structured');
    nextPageInner.setAttribute(
      'data-template-extraction-stage',
      frameSection.getAttribute('data-template-extraction-stage') || 'frames'
    );
    nextPageInner.setAttribute(
      'data-template-frame-group-version',
      frameSection.getAttribute('data-template-frame-group-version') || ''
    );
    nextPageInner.setAttribute(
      'data-template-clone-id',
      frameSection.getAttribute('data-template-clone-id') || ''
    );

    if (pageWidth) {
      nextPageInner.style.width = pageWidth;
    }

    if (pageMinHeight) {
      nextPageInner.style.minHeight = pageMinHeight;
    }

    nextPageInner.style.margin = '0';
    nextPageInner.style.padding = '0';
    nextPageInner.style.display = 'block';
    nextPageInner.setAttribute('data-page', pageSection.getAttribute('data-page') || String(pageIndex + 1));
    fragment.appendChild(nextPageInner);
  });

  return {
    html: fragment.innerHTML,
    styleText,
    cloneId: frameSection.getAttribute('data-template-clone-id') || '',
    extractionStage: frameSection.getAttribute('data-template-extraction-stage') || 'frames',
    frameGroupVersion: frameSection.getAttribute('data-template-frame-group-version') || '',
    pageWidth: firstPageWidth,
    pageMinHeight: firstPageMinHeight,
  };
};

const findClosestTemplateValueElement = (node: Node | null) => {
  if (!node) {
    return null;
  }

  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>('[data-template-value]') || null;
};

const resolveTemplateValueElementFromTarget = (target: EventTarget | null) => {
  const directTarget = target instanceof Node ? target : null;
  const directMatch = findClosestTemplateValueElement(directTarget);

  if (directMatch) {
    return directMatch;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  return (
    findClosestTemplateValueElement(selection?.anchorNode || null) ||
    findClosestTemplateValueElement(selection?.focusNode || null)
  );
};

const markTemplateValueElementEdited = (element: HTMLElement) => {
  element.setAttribute('data-template-edited', 'true');
  element
    .closest('.v201-choice-row, .v202-line--choice')
    ?.setAttribute('data-template-edited', 'true');
};

const toggleChoiceBoxElement = (element: HTMLElement) => {
  const nextValue = element.getAttribute('data-checked') === '1' ? '0' : '1';
  element.setAttribute('data-checked', nextValue);
  element.setAttribute('aria-checked', nextValue === '1' ? 'true' : 'false');
  markTemplateValueElementEdited(element);
};

const parseFramePx = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const readFrameNodeRect = (node: HTMLElement): FrameNodeRect => ({
  left: parseFramePx(node.style.left),
  top: parseFramePx(node.style.top),
  width: Math.max(1, parseFramePx(node.style.width)),
  height: Math.max(1, parseFramePx(node.style.height)),
});

const writeFrameNodeRect = (node: HTMLElement, rect: FrameNodeRect) => {
  node.style.left = `${Math.round(rect.left)}px`;
  node.style.top = `${Math.round(rect.top)}px`;
  node.style.width = `${Math.max(1, Math.round(rect.width))}px`;
  node.style.height = `${Math.max(1, Math.round(rect.height))}px`;
};

const clampFrameNodeRect = (
  rect: FrameNodeRect,
  bounds: { width: number; height: number },
  minSize = 12
): FrameNodeRect => {
  const width = Math.max(minSize, Math.min(bounds.width, rect.width));
  const height = Math.max(minSize, Math.min(bounds.height, rect.height));
  const left = Math.max(0, Math.min(bounds.width - width, rect.left));
  const top = Math.max(0, Math.min(bounds.height - height, rect.top));
  return { left, top, width, height };
};

const frameRectsOverlapVertically = (left: FrameNodeRect, right: FrameNodeRect) =>
  left.top < right.top + right.height - 2 && right.top < left.top + left.height - 2;

const frameRectsOverlapHorizontally = (top: FrameNodeRect, bottom: FrameNodeRect) =>
  top.left < bottom.left + bottom.width - 2 && bottom.left < top.left + top.width - 2;

const getNextFrameSelection = (previous: string[], frameGroupId: string, isMultiSelect: boolean) => {
  if (isMultiSelect) {
    return previous.includes(frameGroupId)
      ? previous.filter((value) => value !== frameGroupId)
      : [...previous, frameGroupId];
  }

  return previous.includes(frameGroupId) ? previous : [frameGroupId];
};

const readSelectableFrameNodeRect = (node: HTMLElement): FrameNodeRect => {
  const pageInner = node.closest<HTMLElement>('.page-inner');
  const pageRect = pageInner?.getBoundingClientRect();
  const rect = node.getBoundingClientRect();

  return {
    left: rect.left - (pageRect?.left || 0),
    top: rect.top - (pageRect?.top || 0),
    width: rect.width,
    height: rect.height,
  };
};

const applyFrameSelectionHighlight = (root: HTMLElement, selectedIds: string[]) => {
  root.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
    element.removeAttribute('data-template-selected');
    element.removeAttribute('data-template-primary-selected');
    element.removeAttribute('data-template-selection-order');
  });
  root.querySelectorAll<HTMLElement>(`.${FRAME_SELECTION_BADGE_CLASS}`).forEach((element) => {
    element.remove();
  });

  if (!selectedIds.length) {
    return;
  }

  root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR).forEach((node) => {
    const groupId = node.getAttribute('data-template-frame-group') || '';
    const selectedIndex = selectedIds.indexOf(groupId);

    if (selectedIndex >= 0) {
      node.setAttribute('data-template-selected', 'true');
      node.setAttribute('data-template-selection-order', String(selectedIndex + 1));

      if (selectedIndex === 0) {
        node.setAttribute('data-template-primary-selected', 'true');
      }

      const badge = document.createElement('div');
      badge.className = FRAME_SELECTION_BADGE_CLASS;
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = selectedIds.length > 1 ? `선택 ${selectedIndex + 1}` : '선택됨';
      node.appendChild(badge);
    }
  });
};

export type TemplateDraftWorkspaceHandle = {
  getCurrentDraftHtml: () => string;
};

type TemplateDraftWorkspaceProps = {
  sourceKind: 'html' | 'text';
  sourceContent: string;
  draftHtml: string;
};

const TemplateDraftWorkspace = React.forwardRef<TemplateDraftWorkspaceHandle, TemplateDraftWorkspaceProps>(
  ({ sourceKind, sourceContent, draftHtml }, ref) => {
    const [previewPaneMode, setPreviewPaneMode] = React.useState<PreviewPaneMode>('draft');
    const [draftPreviewEditRole, setDraftPreviewEditRole] = React.useState<DraftPreviewEditRole>('editor');
    const [selectedFrameGroupIds, setSelectedFrameGroupIds] = React.useState<string[]>([]);
    const [frameEditorValueKey, setFrameEditorValueKey] = React.useState('');
    const [frameEditorRole, setFrameEditorRole] = React.useState<FrameEditorRole>('group');
    const [frameEditorParentGroup, setFrameEditorParentGroup] = React.useState('');
    const [frameEditorWidthPx, setFrameEditorWidthPx] = React.useState('');
    const [frameEditorHeightPx, setFrameEditorHeightPx] = React.useState('');
    const [frameMergePromptDismissed, setFrameMergePromptDismissed] = React.useState(false);
    const draftPreviewRef = React.useRef<HTMLDivElement | null>(null);
    const draftPreviewHtmlRef = React.useRef('');

    const flattenedFramePreview = React.useMemo(() => flattenFramePreviewMarkup(draftHtml), [draftHtml]);
    const previewDraftStyleText = flattenedFramePreview?.styleText || '';
    const previewDraftHtml = flattenedFramePreview?.html || draftHtml || '';
    const previewDraftCopyHtml = `${previewDraftStyleText ? `<style>${previewDraftStyleText}</style>` : ''}${previewDraftHtml}`;

    const hasGeneratedDraftHtml = Boolean((draftHtml || '').trim());
    const activePreviewPaneMode =
      previewPaneMode === 'draft' && !hasGeneratedDraftHtml ? 'source' : previewPaneMode;
    const frameEditorActive =
      draftHtml.includes('data-template-extraction-stage="frames"') &&
      hasSupportedFrameEditorMarkup(draftHtml);

    const syncDraftPreviewSurfaceScale = React.useCallback(() => {
      const root = draftPreviewRef.current;

      if (!root) {
        return;
      }

      if (!flattenedFramePreview) {
        root.removeAttribute('data-template-preview-scaled');
        root.style.removeProperty('--template-preview-scale');
        root.style.removeProperty('--template-preview-source-width');
        root.style.removeProperty('--template-preview-source-height');
        return;
      }

      const sourceWidth = parseFramePx(flattenedFramePreview.pageWidth);
      const sourceHeight = parseFramePx(flattenedFramePreview.pageMinHeight);
      const viewportWidth = root.clientWidth;

      if (!sourceWidth || !sourceHeight || !viewportWidth) {
        return;
      }

      root.setAttribute('data-template-preview-scaled', 'true');
      root.style.setProperty('--template-preview-scale', String(viewportWidth / sourceWidth));
      root.style.setProperty('--template-preview-source-width', `${sourceWidth}px`);
      root.style.setProperty('--template-preview-source-height', `${sourceHeight}px`);
    }, [flattenedFramePreview]);

    const getFrameEditorNodes = React.useCallback(
      (root?: HTMLElement | null) =>
        Array.from(
          (root || draftPreviewRef.current)?.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR) || []
        ).filter((node) => !node.matches('[data-template-frame-input="true"]')),
      []
    );

    const getCurrentDraftHtml = React.useCallback(() => {
      const liveHtml = draftPreviewRef.current?.innerHTML?.trim() || '';
      const normalizedLiveHtml = stripDraftPreviewUiState(liveHtml);

      if (flattenedFramePreview && normalizedLiveHtml) {
        return `${previewDraftStyleText ? `<style>${previewDraftStyleText}</style>` : ''}${normalizedLiveHtml}`;
      }

      const fallbackHtml = draftPreviewHtmlRef.current || previewDraftCopyHtml;

      return stripDraftPreviewUiState(liveHtml || fallbackHtml);
    }, [flattenedFramePreview, previewDraftCopyHtml, previewDraftStyleText]);

    React.useImperativeHandle(ref, () => ({
      getCurrentDraftHtml,
    }), [getCurrentDraftHtml]);

    const syncDraftPreviewHtmlRef = React.useCallback(() => {
      const root = draftPreviewRef.current;
      if (!root) {
        return;
      }

      const normalizedHtml = stripDraftPreviewUiState(root.innerHTML);
      draftPreviewHtmlRef.current = flattenedFramePreview
        ? `${previewDraftStyleText ? `<style>${previewDraftStyleText}</style>` : ''}${normalizedHtml}`
        : normalizedHtml;
    }, [flattenedFramePreview, previewDraftStyleText]);

    React.useEffect(() => {
      draftPreviewHtmlRef.current = previewDraftCopyHtml;
      setSelectedFrameGroupIds([]);
      setFrameEditorValueKey('');
      setFrameEditorRole('group');
      setFrameEditorParentGroup('');
      setFrameEditorWidthPx('');
      setFrameEditorHeightPx('');
      setFrameMergePromptDismissed(false);
    }, [previewDraftCopyHtml]);

    React.useEffect(() => {
      if (typeof document === 'undefined') {
        return;
      }

      const styleId = 'template-registered-preview-frame-style';
      const existing = document.getElementById(styleId);

      if (!previewDraftStyleText.trim()) {
        existing?.remove();
        return;
      }

      const styleElement =
        existing instanceof HTMLStyleElement ? existing : document.createElement('style');

      styleElement.id = styleId;
      styleElement.textContent = previewDraftStyleText;

      if (!existing) {
        document.head.appendChild(styleElement);
      }

      return () => {
        styleElement.remove();
      };
    }, [previewDraftStyleText]);

    React.useEffect(() => {
      const root = draftPreviewRef.current;

      if (!root || typeof ResizeObserver === 'undefined') {
        return;
      }

      let frameId = 0;
      const sync = () => {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
        frameId = window.requestAnimationFrame(() => {
          syncDraftPreviewSurfaceScale();
        });
      };
      const observer = new ResizeObserver(() => sync());

      observer.observe(root);
      sync();

      return () => {
        observer.disconnect();
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }, [syncDraftPreviewSurfaceScale]);

    React.useEffect(() => {
      const root = draftPreviewRef.current;

      if (!root) {
        return;
      }

      applyFrameSelectionHighlight(root, selectedFrameGroupIds);
    }, [selectedFrameGroupIds]);

    React.useEffect(() => {
      const root = draftPreviewRef.current;

      if (!root) {
        return;
      }

      applyDraftPreviewEditPermissions(root, draftPreviewEditRole);
    }, [draftPreviewEditRole, draftHtml]);

    const syncFrameEditorSelectionState = React.useCallback(() => {
      const root = draftPreviewRef.current;

      if (!root || selectedFrameGroupIds.length === 0) {
        setFrameEditorValueKey('');
        setFrameEditorRole('group');
        setFrameEditorParentGroup('');
        setFrameEditorWidthPx('');
        setFrameEditorHeightPx('');
        return;
      }

      const selectedNode = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)).find(
        (node) => (node.getAttribute('data-template-frame-group') || '') === selectedFrameGroupIds[0]
      );

      if (!selectedNode) {
        return;
      }

      const rect = readSelectableFrameNodeRect(selectedNode);
      setFrameEditorValueKey(selectedNode.getAttribute('data-template-frame-value-key') || '');
      setFrameEditorRole(
        ((selectedNode.getAttribute('data-template-frame-role') as FrameEditorRole | null) || 'group')
      );
      setFrameEditorParentGroup(selectedNode.getAttribute('data-template-frame-parent-group') || '');
      setFrameEditorWidthPx(String(Math.round(rect.width)));
      setFrameEditorHeightPx(String(Math.round(rect.height)));
    }, [selectedFrameGroupIds]);

    React.useEffect(() => {
      syncFrameEditorSelectionState();
    }, [syncFrameEditorSelectionState]);

    React.useEffect(() => {
      if (selectedFrameGroupIds.length <= 1) {
        setFrameMergePromptDismissed(false);
      }
    }, [selectedFrameGroupIds]);

    React.useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const html = draftHtml.trim();
      const root = draftPreviewRef.current;

      if (!html || !root) {
        return;
      }

      let cancelled = false;

      const fitEditableText = async () => {
        await document.fonts?.ready?.catch(() => undefined);
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        });

        if (cancelled) {
          return;
        }

        applyTemplateExtractEditableTextFit(root);
      };

      void fitEditableText();

      return () => {
        cancelled = true;
      };
    }, [draftHtml]);

    const requestPreviewTextFit = React.useCallback(() => {
      const root = draftPreviewRef.current;

      if (!root || typeof window === 'undefined') {
        return;
      }

      window.requestAnimationFrame(() => {
        applyTemplateExtractEditableTextFit(root);
      });
    }, []);

    const applyFrameEditorMetadata = React.useCallback(
      (
        nodes: HTMLElement[],
        patch: {
          valueKey?: string;
          role?: FrameEditorRole;
          parentGroup?: string;
        }
      ) => {
        nodes.forEach((node) => {
          const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');

          if (patch.valueKey !== undefined) {
            const nextValueKey = patch.valueKey.trim();
            if (nextValueKey) {
              node.setAttribute('data-template-frame-value-key', nextValueKey);
              textarea?.setAttribute('data-template-frame-value-key', nextValueKey);
            } else {
              node.removeAttribute('data-template-frame-value-key');
              textarea?.removeAttribute('data-template-frame-value-key');
            }
          }

          if (patch.role !== undefined) {
            node.setAttribute('data-template-frame-role', patch.role);
            textarea?.setAttribute('data-template-frame-role', patch.role);
          }

          if (patch.parentGroup !== undefined) {
            const parentGroup = patch.parentGroup.trim();
            if (parentGroup) {
              node.setAttribute('data-template-frame-parent-group', parentGroup);
              textarea?.setAttribute('data-template-frame-parent-group', parentGroup);
            } else {
              node.removeAttribute('data-template-frame-parent-group');
              textarea?.removeAttribute('data-template-frame-parent-group');
            }
          }
        });

        syncDraftPreviewHtmlRef();
      },
      [syncDraftPreviewHtmlRef]
    );

    const findNearestFrameEdge = React.useCallback(
      (node: HTMLElement, direction: 'left' | 'right' | 'top' | 'bottom') => {
        const currentRect = readSelectableFrameNodeRect(node);
        const pageInner = node.closest<HTMLElement>('.page-inner');
        const nodes = getFrameEditorNodes(pageInner);
        const pageWidth = pageInner?.clientWidth || 0;
        const pageHeight = pageInner?.clientHeight || 0;
        const horizontalCandidates: number[] = [];
        const verticalCandidates: number[] = [];

        nodes.forEach((candidate) => {
          if (candidate === node) {
            return;
          }

          const candidateRect = readSelectableFrameNodeRect(candidate);

          if (frameRectsOverlapVertically(currentRect, candidateRect)) {
            horizontalCandidates.push(candidateRect.left, candidateRect.left + candidateRect.width);
          }

          if (frameRectsOverlapHorizontally(currentRect, candidateRect)) {
            verticalCandidates.push(candidateRect.top, candidateRect.top + candidateRect.height);
          }
        });

        if (direction === 'left') {
          return Math.max(0, ...horizontalCandidates.filter((value) => value < currentRect.left - 1));
        }

        if (direction === 'right') {
          return Math.min(
            pageWidth,
            ...horizontalCandidates.filter((value) => value > currentRect.left + currentRect.width + 1),
            pageWidth
          );
        }

        if (direction === 'top') {
          return Math.max(0, ...verticalCandidates.filter((value) => value < currentRect.top - 1));
        }

        return Math.min(
          pageHeight,
          ...verticalCandidates.filter((value) => value > currentRect.top + currentRect.height + 1),
          pageHeight
        );
      },
      [getFrameEditorNodes]
    );

    const mergeSelectedFrameGroups = React.useCallback(() => {
      const root = draftPreviewRef.current;
      if (!root || selectedFrameGroupIds.length < 2) {
        return;
      }

      const nodes = getFrameEditorNodes(root).filter((node) =>
        selectedFrameGroupIds.includes(node.getAttribute('data-template-frame-group') || '')
      );

      if (nodes.length < 2) {
        return;
      }

      const union = nodes
        .map(readSelectableFrameNodeRect)
        .reduce<FrameNodeRect>(
          (acc, rect) => ({
            left: Math.min(acc.left, rect.left),
            top: Math.min(acc.top, rect.top),
            width: Math.max(acc.left + acc.width, rect.left + rect.width) - Math.min(acc.left, rect.left),
            height: Math.max(acc.top + acc.height, rect.top + rect.height) - Math.min(acc.top, rect.top),
          }),
          readSelectableFrameNodeRect(nodes[0])
        );

      const anchor = nodes[0];
      const mergedId = `merged-${Date.now()}`;
      writeFrameNodeRect(anchor, union);
      anchor.setAttribute('data-template-frame-group', mergedId);
      anchor.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]')?.setAttribute(
        'data-template-frame-group',
        mergedId
      );

      for (const node of nodes.slice(1)) {
        node.remove();
      }

      setSelectedFrameGroupIds([mergedId]);
      syncDraftPreviewHtmlRef();
      syncFrameEditorSelectionState();
    }, [getFrameEditorNodes, selectedFrameGroupIds, syncDraftPreviewHtmlRef, syncFrameEditorSelectionState]);

    const splitSelectedFrameGroup = React.useCallback(
      (axis: 'vertical' | 'horizontal') => {
        const root = draftPreviewRef.current;
        if (!root || selectedFrameGroupIds.length !== 1) {
          return;
        }

        const node = getFrameEditorNodes(root).find(
          (item) => (item.getAttribute('data-template-frame-group') || '') === selectedFrameGroupIds[0]
        );

        if (!node) {
          return;
        }

        const rect = readSelectableFrameNodeRect(node);
        const pageInner = node.closest<HTMLElement>('.page-inner');
        const otherNodes = getFrameEditorNodes(pageInner).filter((candidate) => candidate !== node);
        const splitCandidates = otherNodes.flatMap((candidate) => {
          const candidateRect = readSelectableFrameNodeRect(candidate);

          if (axis === 'vertical' && frameRectsOverlapVertically(rect, candidateRect)) {
            return [candidateRect.left, candidateRect.left + candidateRect.width];
          }

          if (axis === 'horizontal' && frameRectsOverlapHorizontally(rect, candidateRect)) {
            return [candidateRect.top, candidateRect.top + candidateRect.height];
          }

          return [];
        });

        const innerCandidates = splitCandidates.filter((value) =>
          axis === 'vertical'
            ? value > rect.left + 12 && value < rect.left + rect.width - 12
            : value > rect.top + 12 && value < rect.top + rect.height - 12
        );

        const midpoint = axis === 'vertical' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        const splitAt =
          innerCandidates.sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint))[0] ??
          midpoint;

        const firstId = `${selectedFrameGroupIds[0]}-a`;
        const secondId = `${selectedFrameGroupIds[0]}-b`;
        const secondNode = node.cloneNode(true) as HTMLElement;
        const input = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
        const secondInput = secondNode.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');

        if (axis === 'vertical') {
          writeFrameNodeRect(node, { ...rect, width: splitAt - rect.left });
          writeFrameNodeRect(secondNode, {
            left: splitAt,
            top: rect.top,
            width: rect.left + rect.width - splitAt,
            height: rect.height,
          });
        } else {
          writeFrameNodeRect(node, { ...rect, height: splitAt - rect.top });
          writeFrameNodeRect(secondNode, {
            left: rect.left,
            top: splitAt,
            width: rect.width,
            height: rect.top + rect.height - splitAt,
          });
        }

        node.setAttribute('data-template-frame-group', firstId);
        secondNode.setAttribute('data-template-frame-group', secondId);
        input?.setAttribute('data-template-frame-group', firstId);
        secondInput?.setAttribute('data-template-frame-group', secondId);
        node.after(secondNode);

        setSelectedFrameGroupIds([firstId, secondId]);
        syncDraftPreviewHtmlRef();
        syncFrameEditorSelectionState();
      },
      [getFrameEditorNodes, selectedFrameGroupIds, syncDraftPreviewHtmlRef, syncFrameEditorSelectionState]
    );

    const snapSelectedFrameGroups = React.useCallback(
      (direction: 'left' | 'right' | 'top' | 'bottom') => {
        const root = draftPreviewRef.current;
        if (!root || selectedFrameGroupIds.length === 0) {
          return;
        }

        const nodes = getFrameEditorNodes(root).filter((node) =>
          selectedFrameGroupIds.includes(node.getAttribute('data-template-frame-group') || '')
        );

        nodes.forEach((node) => {
          const rect = readSelectableFrameNodeRect(node);
          const edge = findNearestFrameEdge(node, direction);

          if (direction === 'left' && edge < rect.left + rect.width - 12) {
            writeFrameNodeRect(node, {
              left: edge,
              top: rect.top,
              width: rect.left + rect.width - edge,
              height: rect.height,
            });
          } else if (direction === 'right' && edge > rect.left + 12) {
            writeFrameNodeRect(node, {
              ...rect,
              width: edge - rect.left,
            });
          } else if (direction === 'top' && edge < rect.top + rect.height - 12) {
            writeFrameNodeRect(node, {
              left: rect.left,
              top: edge,
              width: rect.width,
              height: rect.top + rect.height - edge,
            });
          } else if (direction === 'bottom' && edge > rect.top + 12) {
            writeFrameNodeRect(node, {
              ...rect,
              height: edge - rect.top,
            });
          }
        });

        syncDraftPreviewHtmlRef();
        syncFrameEditorSelectionState();
      },
      [findNearestFrameEdge, getFrameEditorNodes, selectedFrameGroupIds, syncDraftPreviewHtmlRef, syncFrameEditorSelectionState]
    );

    const applySelectedFrameSize = React.useCallback(() => {
      const root = draftPreviewRef.current;

      if (!root || selectedFrameGroupIds.length !== 1) {
        return;
      }

      const node = getFrameEditorNodes(root).find(
        (item) => (item.getAttribute('data-template-frame-group') || '') === selectedFrameGroupIds[0]
      );

      if (!node) {
        return;
      }

      const pageInner = node.closest<HTMLElement>('.page-inner');
      const currentRect = readSelectableFrameNodeRect(node);
      const nextWidth = Number.parseFloat(frameEditorWidthPx);
      const nextHeight = Number.parseFloat(frameEditorHeightPx);

      const nextRect = clampFrameNodeRect(
        {
          ...currentRect,
          width: Number.isFinite(nextWidth) ? nextWidth : currentRect.width,
          height: Number.isFinite(nextHeight) ? nextHeight : currentRect.height,
        },
        {
          width: pageInner?.clientWidth || Number.MAX_SAFE_INTEGER,
          height: pageInner?.clientHeight || Number.MAX_SAFE_INTEGER,
        }
      );

      writeFrameNodeRect(node, nextRect);
      syncDraftPreviewHtmlRef();
      syncFrameEditorSelectionState();
    }, [
      frameEditorHeightPx,
      frameEditorWidthPx,
      getFrameEditorNodes,
      selectedFrameGroupIds,
      syncDraftPreviewHtmlRef,
      syncFrameEditorSelectionState,
    ]);

    const linkSelectedFrameGroups = React.useCallback(() => {
      const root = draftPreviewRef.current;
      if (!root || selectedFrameGroupIds.length < 2) {
        return;
      }

      const parentGroupId = selectedFrameGroupIds[0];
      const nodes = getFrameEditorNodes(root).filter((node) =>
        selectedFrameGroupIds.includes(node.getAttribute('data-template-frame-group') || '')
      );

      applyFrameEditorMetadata(nodes.slice(1), { parentGroup: parentGroupId });
    }, [applyFrameEditorMetadata, getFrameEditorNodes, selectedFrameGroupIds]);

    const syncPreviewEditTarget = React.useCallback(
      (target: EventTarget | null) => {
        const targetElement = target instanceof HTMLElement ? target : null;
        const frameInput = targetElement?.closest<HTMLElement>('[data-template-frame-input="true"]');

        if (frameInput) {
          markTemplateValueElementEdited(frameInput);
          syncDraftPreviewHtmlRef();
          return;
        }

        const valueElement = resolveTemplateValueElementFromTarget(target);

        if (!valueElement) {
          const editableElement = targetElement?.closest<HTMLElement>('[contenteditable="true"]');
          if (editableElement) {
            markTemplateValueElementEdited(editableElement);
          }
          syncDraftPreviewHtmlRef();
          requestPreviewTextFit();
          return;
        }

        markTemplateValueElementEdited(valueElement);
        syncDraftPreviewHtmlRef();
        requestPreviewTextFit();
      },
      [requestPreviewTextFit, syncDraftPreviewHtmlRef]
    );

    const handleDraftPreviewSelect = React.useCallback(
      (event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => {
        const targetElement = event.target instanceof HTMLElement ? event.target : null;
        const frameNode = targetElement?.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

        if (frameNode) {
          return;
        }

        const choiceButton = targetElement?.closest<HTMLElement>('[role="checkbox"][data-checked]');

        if (choiceButton) {
          toggleChoiceBoxElement(choiceButton);
          syncDraftPreviewHtmlRef();
        }
      },
      [syncDraftPreviewHtmlRef]
    );

    const handleDraftPreviewPaste = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      const editableElement = targetElement?.closest<HTMLElement>('[contenteditable="true"]');

      if (!editableElement) {
        return;
      }

      event.preventDefault();
      const text = event.clipboardData.getData('text/plain') || '';

      if (document.queryCommandSupported?.('insertText')) {
        document.execCommand('insertText', false, text);
        return;
      }

      const selection = window.getSelection();

      if (!selection || !selection.rangeCount) {
        return;
      }

      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(text));
      selection.collapseToEnd();
    }, []);

    const handleDraftPreviewPointerDown = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
          return;
        }

        const targetElement = event.target instanceof HTMLElement ? event.target : null;
        const frameNode = targetElement?.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

        if (!frameNode) {
          return;
        }

        event.preventDefault();

        const frameGroupId = frameNode.getAttribute('data-template-frame-group') || '';

        if (!frameGroupId) {
          return;
        }

        setSelectedFrameGroupIds((previous) => {
          const next = getNextFrameSelection(previous, frameGroupId, Boolean(event.shiftKey));
          if (draftPreviewRef.current) {
            applyFrameSelectionHighlight(draftPreviewRef.current, next);
          }
          return next;
        });
      },
      []
    );

    const availableFrameGroupIds = getFrameEditorNodes()
      .map((node) => node.getAttribute('data-template-frame-group') || '')
      .filter(Boolean);

    return (
      <div className="space-y-6">
        <style>{`
          .template-extract-preview-surface {
            position: relative;
            box-sizing: border-box;
            width: 100%;
            max-width: none;
            aspect-ratio: 210 / 297;
            overflow: hidden;
            border-radius: 0.75rem;
            border: 1px solid rgb(226 232 240);
            background: white;
            box-shadow: none;
          }
          .template-extract-preview-surface.template-extract-text-preview {
            overflow: auto;
            white-space: pre-wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
            font-size: 12px;
            line-height: 1.5;
            color: rgb(51 65 85);
          }
          .template-extract-draft-preview[data-template-preview-scaled="true"] > .page-inner {
            position: absolute;
            left: 0;
            top: 0;
            width: var(--template-preview-source-width, auto) !important;
            min-height: var(--template-preview-source-height, auto) !important;
            height: var(--template-preview-source-height, auto);
            margin: 0 !important;
            padding: 0 !important;
            transform-origin: top left;
            transform: scale(var(--template-preview-scale, 1));
          }
          .template-extract-draft-preview [data-template-extraction-stage="frames"] .v202-frame-group-input {
            pointer-events: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
          }
          .template-extract-draft-preview [data-template-selected="true"] {
            position: relative;
            z-index: 24 !important;
            outline: 3px solid #2563eb !important;
            outline-offset: -1px;
            box-shadow:
              0 0 0 4px rgba(37, 99, 235, .22),
              inset 0 0 0 1px rgba(255, 255, 255, .96) !important;
            background: rgba(219, 234, 254, .55) !important;
            color: #111827 !important;
            opacity: 1 !important;
          }
          .template-extract-draft-preview [data-template-primary-selected="true"] {
            outline-color: #1d4ed8 !important;
            box-shadow:
              0 0 0 5px rgba(29, 78, 216, .28),
              inset 0 0 0 1px rgba(255, 255, 255, .98) !important;
          }
          .template-extract-draft-preview .${FRAME_SELECTION_BADGE_CLASS} {
            position: absolute;
            top: 4px;
            right: 4px;
            z-index: 32;
            pointer-events: none;
            border-radius: 999px;
            background: rgba(29, 78, 216, .96);
            color: #eff6ff;
            padding: 2px 8px;
            font-size: 10px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: -.01em;
            box-shadow: 0 1px 2px rgba(15, 23, 42, .24);
            white-space: nowrap;
          }
        `}</style>
        <Card className="border-slate-200">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>문서 미리보기</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={activePreviewPaneMode === 'source' ? 'default' : 'outline'}
                onClick={() => setPreviewPaneMode('source')}
              >
                원본 문서 미리보기
              </Button>
              <Button
                variant={activePreviewPaneMode === 'draft' ? 'default' : 'outline'}
                onClick={() => setPreviewPaneMode('draft')}
                disabled={!hasGeneratedDraftHtml}
              >
                추출된 템플릿 초안
              </Button>
              {activePreviewPaneMode === 'draft' ? (
                <>
                  <label className="ml-2 text-xs font-medium text-slate-500">편집 권한</label>
                  <select
                    value={draftPreviewEditRole}
                    onChange={(event) => setDraftPreviewEditRole(event.target.value as DraftPreviewEditRole)}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="editor">일반 편집자</option>
                    <option value="admin">관리자</option>
                  </select>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activePreviewPaneMode === 'source' ? (
              sourceKind === 'html' ? (
                <div
                  className="template-extract-preview-surface template-extract-html-preview"
                  dangerouslySetInnerHTML={{ __html: sourceContent }}
                />
              ) : (
                <div className="template-extract-preview-surface template-extract-text-preview">
                  {sourceContent.trim() || '표시할 내용이 없습니다.'}
                </div>
              )
            ) : hasGeneratedDraftHtml ? (
              <div
                ref={draftPreviewRef}
                className={`template-extract-draft-preview template-extract-preview-surface${
                  flattenedFramePreview ? ' template-clone template-clone--raster-first-v2-structured' : ''
                }`}
                data-template-extraction-stage={flattenedFramePreview?.extractionStage || undefined}
                data-template-frame-group-version={flattenedFramePreview?.frameGroupVersion || undefined}
                data-template-clone-id={flattenedFramePreview?.cloneId || undefined}
                onPointerDownCapture={handleDraftPreviewPointerDown}
                onClickCapture={handleDraftPreviewSelect}
                onFocusCapture={handleDraftPreviewSelect}
                onInput={(event) => syncPreviewEditTarget(event.target)}
                onPasteCapture={handleDraftPreviewPaste}
                dangerouslySetInnerHTML={{ __html: previewDraftHtml }}
              />
            ) : (
              <div className="template-extract-preview-surface flex items-center justify-center text-sm text-slate-500">
                아직 생성된 초안이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>프레임 편집</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {frameEditorActive ? (
              <>
                <p className="text-sm text-slate-600">
                  선택한 프레임을 합치거나 나누고, key/value 체인과 부모 관계를 수동으로 보정합니다.
                </p>
                <div className="text-sm text-slate-700">
                  <div>선택 수: {selectedFrameGroupIds.length}</div>
                  <div>선택 ID: {selectedFrameGroupIds.join(', ') || '-'}</div>
                </div>
                {selectedFrameGroupIds.length > 1 && !frameMergePromptDismissed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-medium">복수 프레임이 선택되었습니다.</div>
                    <div className="mt-1">현재 선택한 박스를 하나로 합칠지 바로 결정할 수 있습니다.</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={mergeSelectedFrameGroups}>
                        선택 병합
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setFrameMergePromptDismissed(true)}
                      >
                        그대로 유지
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Value Key</label>
                    <input
                      value={frameEditorValueKey}
                      onChange={(event) => setFrameEditorValueKey(event.target.value)}
                      placeholder="예: 공동사업자 > 성명(법인명)"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Frame Role</label>
                    <select
                      value={frameEditorRole}
                      onChange={(event) => setFrameEditorRole(event.target.value as FrameEditorRole)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="group">group</option>
                      <option value="key">key</option>
                      <option value="value">value</option>
                      <option value="key_value">key_value</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-800">Parent Frame Group</label>
                    <input
                      list="template-frame-group-id-list"
                      value={frameEditorParentGroup}
                      onChange={(event) => setFrameEditorParentGroup(event.target.value)}
                      placeholder="parent frame group id"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    />
                    <datalist id="template-frame-group-id-list">
                      {availableFrameGroupIds.map((frameGroupId) => (
                        <option key={frameGroupId} value={frameGroupId} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Width (px)</label>
                    <input
                      type="number"
                      min={1}
                      value={frameEditorWidthPx}
                      onChange={(event) => setFrameEditorWidthPx(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Height (px)</label>
                    <input
                      type="number"
                      min={1}
                      value={frameEditorHeightPx}
                      onChange={(event) => setFrameEditorHeightPx(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      applyFrameEditorMetadata(
                        getFrameEditorNodes().filter((node) =>
                          selectedFrameGroupIds.includes(node.getAttribute('data-template-frame-group') || '')
                        ),
                        {
                          valueKey: frameEditorValueKey,
                          role: frameEditorRole,
                          parentGroup: frameEditorParentGroup,
                        }
                      )
                    }
                    disabled={selectedFrameGroupIds.length === 0}
                  >
                    메타데이터 적용
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applySelectedFrameSize}
                    disabled={selectedFrameGroupIds.length !== 1}
                  >
                    크기 적용
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={linkSelectedFrameGroups}
                    disabled={selectedFrameGroupIds.length < 2}
                  >
                    첫 선택을 부모로 연결
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={mergeSelectedFrameGroups}
                    disabled={selectedFrameGroupIds.length < 2}
                  >
                    선택 병합
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => splitSelectedFrameGroup('vertical')}
                    disabled={selectedFrameGroupIds.length !== 1}
                  >
                    세로 분할
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => splitSelectedFrameGroup('horizontal')}
                    disabled={selectedFrameGroupIds.length !== 1}
                  >
                    가로 분할
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => snapSelectedFrameGroups('left')}
                    disabled={selectedFrameGroupIds.length === 0}
                  >
                    좌측 스냅
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => snapSelectedFrameGroups('right')}
                    disabled={selectedFrameGroupIds.length === 0}
                  >
                    우측 스냅
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => snapSelectedFrameGroups('top')}
                    disabled={selectedFrameGroupIds.length === 0}
                  >
                    상단 스냅
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => snapSelectedFrameGroups('bottom')}
                    disabled={selectedFrameGroupIds.length === 0}
                  >
                    하단 스냅
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                현재 초안은 지원되는 프레임 그룹 미리보기가 아니어서 프레임 편집을 바로 표시하지 않습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
);

TemplateDraftWorkspace.displayName = 'TemplateDraftWorkspace';

export default TemplateDraftWorkspace;
