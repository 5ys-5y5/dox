'use client';

import * as React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EntityPicker } from '../../../components/ui/EntityPicker';
import { Input } from '../../../components/ui/Input';
import { applyTemplateExtractEditableTextFit } from '../../../lib/templateExtractEditableTextFit';
import {
  formatTemplateExtractEngineVersionLabel,
  TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS,
  TEMPLATE_EXTRACT_FRAME_GROUP_VERSION_OPTIONS,
} from '../../../lib/templateExtractDtos';
import type {
  TemplateExtractCandidateDto,
  TemplateExtractDetailResult,
  TemplateExtractEngineVersion,
  TemplateExtractExtractionStage,
  TemplateExtractFrameGroupVersion,
  TemplateExtractReplicaRenderFrameSegment,
  TemplateExtractReplicaRenderModel,
  TemplateExtractReplicaRenderPage,
  TemplateExtractReplicaRenderTextItem,
  TemplateExtractReviewedFieldInput,
  TemplateExtractSourceKind,
  TemplateExtractVisualSimilarityReport,
} from '../../../lib/templateExtractDtos';
import type {
  TemplateDetailResult,
  TemplateLayoutResizeMode,
  TemplateRecordDto,
} from '../../../lib/templateDtos';
import { TemplateExtractVisualSimilarityClient } from '../../../lib/templateExtractVisualSimilarityClient';
import type {
  TemplateFrameMetadataDto,
  TemplateFrameNodeDto,
  TemplateFrameRectDto,
} from '../../../lib/templateFrameEditDtos';
import { TemplateFrameEditGeometryService } from '../../../services/templateFrameEditGeometryService';
import { TemplateFrameEditHtmlService } from '../../../services/templateFrameEditHtmlService';
import { TemplateExtractValueBindingService } from '../../../services/templateExtractValueBindingService';

const defaultSourceContent = `<section>
  <h1>안전관리계획서</h1>
  <table>
    <tr>
      <th>현장명</th>
      <td>서울 A현장</td>
    </tr>
    <tr>
      <th>작업일</th>
      <td>2026-04-12</td>
    </tr>
    <tr>
      <th>책임자</th>
      <td>홍길동</td>
    </tr>
  </table>
</section>`;

const RECENT_DRAFTS_STORAGE_KEY = 'template-extract-recent-drafts';

type RecentDraftOption = {
  id: string;
  label: string;
  meta: string;
};

type DraftCreateProgressPhase = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

type DraftCreateProgressState = {
  visible: boolean;
  phase: DraftCreateProgressPhase;
  percent: number;
  stage: string;
  detail: string;
};

type VisualSimilarityProgressStepKey =
  | 'uploading'
  | 'rendering_pdf'
  | 'preparing_pdf_pages'
  | 'rendering_html'
  | 'preparing_replica_pages'
  | 'comparing_pages'
  | 'aggregating';

type VisualSimilarityProgressPhase =
  | 'idle'
  | VisualSimilarityProgressStepKey
  | 'completed'
  | 'failed';

type VisualSimilarityProgressState = {
  visible: boolean;
  phase: VisualSimilarityProgressPhase;
  activeStep: VisualSimilarityProgressStepKey | null;
  percent: number;
  stage: string;
  detail: string;
};

type DraftPreviewEditRole = 'editor' | 'admin';
type PreviewPaneMode = 'source' | 'draft';
type FrameEditorRole = 'group' | 'key' | 'value' | 'key_value';
type FrameOutlineStyle = 'solid' | 'dashed';
type FrameNodeRect = { left: number; top: number; width: number; height: number };
type FrameResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type FrameNodeSnapshot = {
  pageNumber: string;
  attrs: Record<string, string>;
  rowColor: string;
  colColor: string;
  rect: FrameNodeRect;
  value: string;
};
type FrameDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  anchorNode: HTMLElement;
  nodes: Array<{
    node: HTMLElement;
    rect: FrameNodeRect;
  }>;
};
type FrameResizeState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  direction: FrameResizeDirection;
  node: HTMLElement;
  rect: FrameNodeRect;
};
type FrameCreateState = {
  pointerId: number;
  pageInner: HTMLElement;
  start: { x: number; y: number };
  lastRawRect: FrameNodeRect;
  ghostNode: HTMLElement;
};
type FrameExtractedTextState = Record<string, string>;
type FrameTextRenderModelV112 = TemplateExtractReplicaRenderModel & {
  diagnostics?: {
    pageModes?: string[];
  };
};
type FrameTextExtractionMode = 'non_image' | 'image';
type TemplateValueResolveEvent = {
  clientX?: number;
  clientY?: number;
  nativeEvent?: Event;
  composedPath?: () => EventTarget[];
};
type FlattenedFramePreviewMarkup = {
  html: string;
  styleText: string;
  cloneId: string;
  extractionStage: string;
  frameGroupVersion: string;
  pageWidth: string;
  pageMinHeight: string;
};
type StoredFrameProfile = {
  version: 1;
  frameGroupVersion: string;
  profileName: string;
  sourceSignature: string;
  pageWidth: string;
  pageMinHeight: string;
  savedAt: string;
  frames: FrameNodeSnapshot[];
};
type FrameTextExtractionVersion = 'v1.01' | 'v1.02' | 'v1.12';
type ImageFrameTextExtractionVersion = 'v1.00';
type CrossValidationViewMode = 'side_by_side' | 'overlay';
type CrossValidationPreviewState = {
  pdfPageDataUrls: string[];
  replicaPageDataUrls: string[];
  createdAt: string;
};

const V106_FRAME_NODE_SELECTOR = '[data-v106-frame-node="true"]';
const V106_FRAME_RESIZE_HANDLE_SELECTOR = '[data-v106-resize-handle="true"]';
const V106_FRAME_DELETE_BUTTON_SELECTOR = '[data-v106-delete-button="true"]';
const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SELECTION_NODE_SELECTOR = `${V106_FRAME_NODE_SELECTOR}, ${RAW_FRAME_NODE_SELECTOR}`;
const FRAME_SELECTION_BADGE_CLASS = 'v106-frame-selection-badge';
const FRAME_DELETE_BUTTON_CLASS = 'v106-frame-delete-button';
const FRAME_CREATE_GHOST_CLASS = 'v106-frame-create-ghost';
const FRAME_VISIBLE_TEXT_CLASS = 'v106-frame-visible-text';
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
] as const;
const FRAME_EDITOR_SUPPORTED_VERSIONS = ['v1.06', 'v1.07', 'v1.08', 'v1.09', 'v1.10', 'v1.11'] as const;
const FRAME_PROFILE_STORAGE_KEY = 'template-extract-frame-profiles-v109';
const NON_IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS: Array<{
  value: FrameTextExtractionVersion;
  label: string;
}> = [
  { value: 'v1.12', label: 'v1.12' },
  { value: 'v1.02', label: 'v1.02' },
  { value: 'v1.01', label: 'v1.01' },
];
const IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS: Array<{
  value: ImageFrameTextExtractionVersion;
  label: string;
}> = [{ value: 'v1.00', label: 'v1.00' }];
const RENDER_MODEL_SCRIPT_PATTERN =
  /<script\b[^>]*data-template-render-model="positioned-v1"[^>]*>([\s\S]*?)<\/script>/i;

const frameGroupVersionMatches = (frameGroupVersion: string, version: string) =>
  frameGroupVersion === version || frameGroupVersion.startsWith(`${version}-`);

const isSupportedFrameEditorVersion = (frameGroupVersion: string | null | undefined) =>
  FRAME_EDITOR_SUPPORTED_VERSIONS.some((version) => frameGroupVersionMatches(String(frameGroupVersion || ''), version));

const isV109FrameGroupVersion = (frameGroupVersion: string | null | undefined) =>
  frameGroupVersionMatches(String(frameGroupVersion || ''), 'v1.09') ||
  frameGroupVersionMatches(String(frameGroupVersion || ''), 'v1.10') ||
  frameGroupVersionMatches(String(frameGroupVersion || ''), 'v1.11');

const normalizeFrameFieldPath = (value: string) =>
  value
    .split('>')
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' > ');

const sanitizeFrameProfileName = (value: string) => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^0-9A-Za-z._\-\u3131-\u318e\uac00-\ud7a3]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');

  return normalized || 'default';
};

const buildRequestedFrameGroupVersion = (
  baseVersion: string,
  profileName: string
): TemplateExtractFrameGroupVersion =>
  baseVersion === 'v1.09' || baseVersion === 'v1.10' || baseVersion === 'v1.11'
    ? (`${baseVersion}-${sanitizeFrameProfileName(profileName)}` as TemplateExtractFrameGroupVersion)
    : (baseVersion as TemplateExtractFrameGroupVersion);

const hashFrameValueKey = (value: string) => {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
};

const isPdfSourceFile = (file: File | null | undefined) =>
  Boolean(file && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf'));

const hasFrameExtractedTextMarkup = (html: string | null | undefined) =>
  /data-template-frame-extracted-text="/i.test(String(html || ''));

const readStoredFrameProfiles = (): Record<string, StoredFrameProfile> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(FRAME_PROFILE_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, StoredFrameProfile>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStoredFrameProfiles = (profiles: Record<string, StoredFrameProfile>) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(FRAME_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
};

const hasSupportedFrameEditorMarkup = (html: string | null | undefined) =>
  FRAME_EDITOR_SUPPORTED_VERSIONS.some((version) =>
    new RegExp(`data-template-frame-group-version="${version}(?:-[^"]+)?"`, 'i').test(html || '')
  );

const querySupportedFrameEditorSection = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('section[data-template-extraction-stage="frames"]')).find(
    (section) => isSupportedFrameEditorVersion(section.getAttribute('data-template-frame-group-version'))
  ) || null;

const toReviewedFields = (detail: TemplateExtractDetailResult): TemplateExtractReviewedFieldInput[] =>
  detail.candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    fieldKey: candidate.fieldKey,
    labelKey: candidate.labelKey,
    fieldType: candidate.fieldType,
    fieldLabel: candidate.fieldLabel,
    required: candidate.required,
    placeholder: candidate.placeholder,
    defaultValue: candidate.defaultValue,
    options: candidate.options,
    layoutBlockId: candidate.layoutBlockId,
    sortOrder: candidate.sortOrder,
    reviewStatus: candidate.reviewStatus,
  }));

const stringifyTemplateDefaultValue = (value: unknown) =>
  value === null || value === undefined ? '' : String(value);

const reviewedFieldValueText = (
  field: TemplateExtractReviewedFieldInput,
  candidate: TemplateExtractCandidateDto | undefined
) => stringifyTemplateDefaultValue(field.defaultValue ?? candidate?.detectedValue ?? '');

const toTemplateExtractDetailFromTemplate = (
  detail: TemplateDetailResult
): TemplateExtractDetailResult => {
  const candidates: TemplateExtractCandidateDto[] = detail.fields.map((field, index) => ({
    id: `template-field:${field.id}`,
    draftId: `template:${detail.template.id}`,
    candidateKey: `template-candidate:${field.fieldKey}`,
    fieldKey: field.fieldKey,
    labelKey: field.fieldKey,
    fieldType: field.fieldType,
    fieldLabel: field.fieldLabel,
    detectedValue: stringifyTemplateDefaultValue(field.defaultValue),
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    options: field.options || [],
    required: field.required,
    layoutBlockId: field.layoutBlockId,
    confidenceScore: 1,
    reviewStatus: 'accepted',
    extractionReason: 'registered_template',
    sortOrder: field.sortOrder ?? index,
  }));

  const reviewSummary = {
    candidateCount: candidates.length,
    acceptedCount: candidates.length,
    reviewNeededCount: 0,
    rejectedCount: 0,
    averageConfidenceScore: candidates.length ? 1 : 0,
  };

  return {
    draft: {
      id: `template:${detail.template.id}`,
      sourceTitle: detail.template.templateName,
      sourceKind: 'html',
      sourceContent: detail.template.draftHtml,
      generatedDraftHtml: detail.template.draftHtml,
      status: 'approved',
      confidenceSummary: reviewSummary,
      similarTemplateIds: [],
      approvedTemplateId: detail.template.id,
      createdAt: detail.template.createdAt,
      updatedAt: detail.template.updatedAt,
    },
    candidates,
    reviewSummary,
    pipelineTrace: null,
    qualityReport: null,
  };
};

const stripDraftPreviewUiState = (html: string) => {
  if (!html.trim()) {
    return '';
  }

  if (typeof document === 'undefined') {
    return html
      .replace(/\sdata-template-selected="true"/gi, '')
      .replace(/\sdata-template-edit-enabled="(?:true|false)"/gi, '')
      .replace(/\splaceholder="[^"]*"/gi, '');
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
    element.removeAttribute('data-template-selected');
  });
  container.querySelectorAll<HTMLElement>('[data-template-edit-enabled]').forEach((element) => {
    element.removeAttribute('data-template-edit-enabled');
  });
  container.querySelectorAll<HTMLElement>('[data-template-edit-scope="admin"]').forEach((element) => {
    element.setAttribute('contenteditable', 'false');
  });
  container.querySelectorAll<HTMLElement>('[data-template-edit-scope="editor"]').forEach((element) => {
    element.setAttribute('contenteditable', 'true');
  });
  container.querySelectorAll<HTMLElement>('[data-template-frame-input][placeholder]').forEach((element) => {
    element.removeAttribute('placeholder');
  });
  container.querySelectorAll<HTMLElement>(V106_FRAME_RESIZE_HANDLE_SELECTOR).forEach((element) => {
    element.remove();
  });
  TemplateFrameEditHtmlService.stripEditorUiState(container);

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

const findTemplateValueElements = (root: HTMLElement, labelKey: string) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-template-value]')).filter(
    (element) => element.getAttribute('data-template-value') === labelKey
  );

const findClosestTemplateValueElement = (node: Node | null) => {
  if (!node) {
    return null;
  }

  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>('[data-template-value]') || null;
};

const findTemplateValueElementInEditableScope = (element: HTMLElement | null) => {
  const editableElement = element?.closest<HTMLElement>('[contenteditable="true"], [data-template-edit-scope]');

  if (!editableElement) {
    return null;
  }

  if (editableElement.matches('[data-template-value]')) {
    return editableElement;
  }

  const valueElements = Array.from(editableElement.querySelectorAll<HTMLElement>('[data-template-value]'));

  return valueElements.length === 1 ? valueElements[0] : null;
};

const resolveTemplateValueElementFromTarget = (
  target: EventTarget | null,
  event?: TemplateValueResolveEvent
) => {
  const directTarget = target instanceof Node ? target : null;
  const directMatch = findClosestTemplateValueElement(directTarget);

  if (directMatch) {
    return directMatch;
  }

  const targetElement = directTarget instanceof HTMLElement ? directTarget : directTarget?.parentElement || null;
  const editableScopeMatch = findTemplateValueElementInEditableScope(targetElement);

  if (editableScopeMatch) {
    return editableScopeMatch;
  }

  const nativeEvent = event?.nativeEvent || event;
  const eventPath = nativeEvent?.composedPath?.() || [];

  for (const pathItem of eventPath) {
    const pathMatch = findClosestTemplateValueElement(pathItem instanceof Node ? pathItem : null);

    if (pathMatch) {
      return pathMatch;
    }

    const pathEditableMatch = findTemplateValueElementInEditableScope(
      pathItem instanceof HTMLElement ? pathItem : null
    );

    if (pathEditableMatch) {
      return pathEditableMatch;
    }
  }

  if (
    typeof document !== 'undefined' &&
    typeof event?.clientX === 'number' &&
    typeof event?.clientY === 'number'
  ) {
    for (const pointElement of document.elementsFromPoint(event.clientX, event.clientY)) {
      const pointMatch = findClosestTemplateValueElement(pointElement);

      if (pointMatch) {
        return pointMatch;
      }

      const pointEditableMatch = findTemplateValueElementInEditableScope(
        pointElement instanceof HTMLElement ? pointElement : null
      );

      if (pointEditableMatch) {
        return pointEditableMatch;
      }
    }
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

const templateValueElementText = (element: HTMLElement) =>
  element.innerText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .join('\n')
    .trim();

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

const normalizeFrameOutlineStyle = (value: string | null | undefined): FrameOutlineStyle =>
  String(value || '').trim().toLowerCase() === 'dashed' ? 'dashed' : 'solid';

const applyFrameNodeOutlineStyle = (node: HTMLElement, outlineStyle: FrameOutlineStyle) => {
  node.style.border =
    outlineStyle === 'dashed'
      ? '1px dashed rgba(15, 23, 42, 0.34)'
      : '1px solid rgba(15, 23, 42, 0.55)';
};

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

const toFrameNodeRect = (rect: TemplateFrameRectDto): FrameNodeRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

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
  if (node.matches(V106_FRAME_NODE_SELECTOR)) {
    return readFrameNodeRect(node);
  }

  const pageInner = node.closest<HTMLElement>('.page-inner');
  const pageRect = pageInner?.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const scale = readFramePreviewScale(pageInner);

  return {
    left: (rect.left - (pageRect?.left || 0)) / scale,
    top: (rect.top - (pageRect?.top || 0)) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
};

const readFramePreviewScale = (pageInner: HTMLElement | null) => {
  if (!pageInner) {
    return 1;
  }

  const rect = pageInner.getBoundingClientRect();
  return pageInner.clientWidth > 0 && rect.width > 0 ? rect.width / pageInner.clientWidth : 1;
};

const clientPointToPagePoint = (
  pageInner: HTMLElement,
  clientX: number,
  clientY: number
) => {
  const rect = pageInner.getBoundingClientRect();
  const scale = readFramePreviewScale(pageInner);

  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  };
};

const readFrameNodeMetadata = (node: HTMLElement): TemplateFrameMetadataDto => ({
  role: ((node.getAttribute('data-template-frame-role') as FrameEditorRole | null) || 'group'),
  outlineStyle: normalizeFrameOutlineStyle(node.getAttribute('data-template-frame-outline-style') || null),
  valueKey: node.getAttribute('data-template-frame-value-key') || null,
  parentGroupId: node.getAttribute('data-template-frame-parent-group') || null,
  chainKey: node.getAttribute('data-template-frame-chain-key') || null,
  chainDepth: Number.isFinite(Number.parseInt(node.getAttribute('data-template-frame-chain-depth') || '', 10))
    ? Number.parseInt(node.getAttribute('data-template-frame-chain-depth') || '', 10)
    : null,
  sourceText: node.getAttribute('data-template-frame-source-text') || null,
});

const readFrameNodeSourceText = (node: HTMLElement, textarea?: HTMLTextAreaElement | null) =>
  node.getAttribute('data-template-frame-source-text') ||
  textarea?.getAttribute('data-template-frame-source-text') ||
  '';

const readFrameNodeExtractedText = (node: HTMLElement, textarea?: HTMLTextAreaElement | null) =>
  node.getAttribute('data-template-frame-extracted-text') ||
  textarea?.getAttribute('data-template-frame-extracted-text') ||
  '';

const readFrameNodeDisplayText = (node: HTMLElement, textarea?: HTMLTextAreaElement | null) => {
  const extractedText = readFrameNodeExtractedText(node, textarea);

  if (extractedText) {
    return extractedText;
  }

  return readFrameNodeSourceText(node, textarea);
};

const readFrameNodeDto = (node: HTMLElement): TemplateFrameNodeDto => ({
  frameGroupId: node.getAttribute('data-template-frame-group') || '',
  rect: {
    pageNumber: Number.parseInt(node.getAttribute('data-template-frame-page') || '1', 10) || 1,
    ...readFrameNodeRect(node),
  },
  metadata: readFrameNodeMetadata(node),
});

const writeFrameNodeId = (node: HTMLElement, frameGroupId: string) => {
  node.setAttribute('data-template-frame-group', frameGroupId);
  node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]')?.setAttribute(
    'data-template-frame-group',
    frameGroupId
  );
};

const resolvePageInnerFromPoint = (root: HTMLElement, clientX: number, clientY: number) => {
  for (const pointElement of document.elementsFromPoint(clientX, clientY)) {
    const pageInner = pointElement.closest<HTMLElement>('.page-inner');

    if (pageInner && root.contains(pageInner)) {
      return pageInner;
    }
  }

  return null;
};

const resolveFrameNodeFromEvent = (
  root: HTMLElement,
  target: EventTarget | null,
  event: Pick<MouseEvent, 'clientX' | 'clientY'>
) => {
  const targetElement = target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  const directFrameNode = targetElement?.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

  if (directFrameNode && root.contains(directFrameNode)) {
    return directFrameNode;
  }

  for (const pointElement of document.elementsFromPoint(event.clientX, event.clientY)) {
    const pointFrameNode = pointElement.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

    if (pointFrameNode && root.contains(pointFrameNode)) {
      return pointFrameNode;
    }
  }

  const hitPaddingPx = 2;
  const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
    .filter((node) => !node.matches('[data-template-frame-input="true"]'))
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const containsPoint =
        event.clientX >= rect.left - hitPaddingPx &&
        event.clientX <= rect.right + hitPaddingPx &&
        event.clientY >= rect.top - hitPaddingPx &&
        event.clientY <= rect.bottom + hitPaddingPx;

      return {
        node,
        containsPoint,
        area: rect.width * rect.height,
      };
    })
    .filter((item) => item.containsPoint)
    .sort((a, b) => a.area - b.area);

  return frameNodes[0]?.node || null;
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

  root
    .querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)
    .forEach((node) => {
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
        badge.setAttribute('data-frame-editor-ui', 'true');
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = selectedIds.length > 1 ? `선택 ${selectedIndex + 1}` : '선택됨';
        node.appendChild(badge);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = FRAME_DELETE_BUTTON_CLASS;
        deleteButton.setAttribute('data-v106-delete-button', 'true');
        deleteButton.setAttribute('data-frame-editor-ui', 'true');
        deleteButton.setAttribute('aria-label', '선택 프레임 삭제');
        deleteButton.textContent = '삭제';
        node.appendChild(deleteButton);
      }
    });
};

const buildV106FrameNode = (snapshot: FrameNodeSnapshot) => {
  const resizeHandles: Array<{
    direction: FrameResizeDirection;
    cursor: string;
    style: Partial<CSSStyleDeclaration>;
  }> = [
    {
      direction: 'n',
      cursor: 'ns-resize',
      style: { top: '-4px', left: '8px', right: '8px', height: '8px' },
    },
    {
      direction: 's',
      cursor: 'ns-resize',
      style: { bottom: '-4px', left: '8px', right: '8px', height: '8px' },
    },
    {
      direction: 'e',
      cursor: 'ew-resize',
      style: { top: '8px', right: '-4px', bottom: '8px', width: '8px' },
    },
    {
      direction: 'w',
      cursor: 'ew-resize',
      style: { top: '8px', left: '-4px', bottom: '8px', width: '8px' },
    },
    {
      direction: 'ne',
      cursor: 'nesw-resize',
      style: { top: '-4px', right: '-4px', width: '10px', height: '10px' },
    },
    {
      direction: 'nw',
      cursor: 'nwse-resize',
      style: { top: '-4px', left: '-4px', width: '10px', height: '10px' },
    },
    {
      direction: 'se',
      cursor: 'nwse-resize',
      style: { right: '-4px', bottom: '-4px', width: '10px', height: '10px' },
    },
    {
      direction: 'sw',
      cursor: 'nesw-resize',
      style: { left: '-4px', bottom: '-4px', width: '10px', height: '10px' },
    },
  ];

  const box = document.createElement('div');
  box.className = 'v202-cell-box v202-frame-group';
  box.setAttribute('data-v106-frame-node', 'true');
  box.setAttribute('data-template-frame-page', snapshot.pageNumber);

  for (const [name, value] of Object.entries(snapshot.attrs)) {
    if (value) {
      box.setAttribute(name, value);
    }
  }

  box.style.position = 'absolute';
  box.style.left = `${Math.round(snapshot.rect.left)}px`;
  box.style.top = `${Math.round(snapshot.rect.top)}px`;
  box.style.width = `${Math.max(1, Math.round(snapshot.rect.width))}px`;
  box.style.height = `${Math.max(1, Math.round(snapshot.rect.height))}px`;
  box.style.boxSizing = 'border-box';
  applyFrameNodeOutlineStyle(box, normalizeFrameOutlineStyle(snapshot.attrs['data-template-frame-outline-style']));
  box.style.background = snapshot.colColor || 'rgba(14, 165, 233, 0.14)';
  box.style.overflow = 'hidden';
  box.style.display = 'block';
  box.style.cursor = 'grab';
  box.style.userSelect = 'none';
  box.style.touchAction = 'none';
  box.style.setProperty('--v102-row-color', snapshot.rowColor);
  box.style.setProperty('--v102-col-color', snapshot.colColor);

  const textarea = document.createElement('textarea');
  textarea.className = 'v202-frame-group-input';
  textarea.value = '';
  textarea.setAttribute('spellcheck', 'false');
  textarea.setAttribute('data-template-frame-input', 'true');
  textarea.setAttribute('readonly', 'true');
  textarea.setAttribute('tabindex', '-1');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'absolute';
  textarea.style.inset = '0';
  textarea.style.display = 'block';
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.padding = '0';
  textarea.style.margin = '0';
  textarea.style.border = '0';
  textarea.style.background = 'transparent';
  textarea.style.resize = 'none';
  textarea.style.overflow = 'hidden';
  textarea.style.boxSizing = 'border-box';
  textarea.style.font = 'inherit';
  textarea.style.color = 'transparent';
  textarea.style.caretColor = 'transparent';
  textarea.style.lineHeight = '1.2';
  textarea.style.whiteSpace = 'pre-wrap';
  textarea.style.outline = 'none';
  textarea.style.pointerEvents = 'none';
  textarea.style.userSelect = 'none';
  textarea.style.textAlign = snapshot.attrs['data-template-frame-halign'] || 'left';

  for (const name of FRAME_GROUP_ATTR_NAMES) {
    const value = snapshot.attrs[name];
    if (value) {
      textarea.setAttribute(name, value);
    }
  }

  box.appendChild(textarea);

  const visibleText = document.createElement('div');
  visibleText.className = FRAME_VISIBLE_TEXT_CLASS;
  visibleText.setAttribute('data-template-frame-visible-text', 'true');
  visibleText.style.position = 'absolute';
  visibleText.style.inset = '0';
  visibleText.style.display = 'flex';
  visibleText.style.flexDirection = 'column';
  visibleText.style.justifyContent =
    snapshot.attrs['data-template-frame-valign'] === 'bottom'
      ? 'flex-end'
      : snapshot.attrs['data-template-frame-valign'] === 'middle' ||
          snapshot.attrs['data-template-frame-valign'] === 'center'
        ? 'center'
        : 'flex-start';
  visibleText.style.padding = '0';
  visibleText.style.margin = '0';
  visibleText.style.border = '0';
  visibleText.style.background = 'transparent';
  visibleText.style.boxSizing = 'border-box';
  visibleText.style.font = 'inherit';
  visibleText.style.color = 'transparent';
  visibleText.style.lineHeight = '1.2';
  visibleText.style.whiteSpace = 'pre-wrap';
  visibleText.style.wordBreak = 'break-word';
  visibleText.style.overflow = 'hidden';
  visibleText.style.pointerEvents = 'none';
  visibleText.style.userSelect = 'none';
  visibleText.style.textAlign = snapshot.attrs['data-template-frame-halign'] || 'left';
  visibleText.textContent = '';
  box.appendChild(visibleText);

  const snapshotSourceText = normalizeExtractedFrameText(snapshot.attrs['data-template-frame-source-text'] || '');
  const snapshotFallbackValue = normalizeExtractedFrameText(snapshot.value || '');
  const fallbackDisplayValue =
    snapshotFallbackValue && snapshotFallbackValue !== snapshotSourceText ? snapshotFallbackValue : '';
  const initialText = formatFrameSourceTextForDisplay(
    snapshot.attrs['data-template-frame-extracted-text'] || fallbackDisplayValue,
    {
      frameGroup: snapshot.attrs['data-template-frame-group'],
      valueKey: snapshot.attrs['data-template-frame-value-key'],
      colorGroup: snapshot.attrs['data-template-frame-color-group'],
    }
  );

  if (initialText) {
    textarea.value = initialText;
    textarea.textContent = initialText;
    textarea.style.color = '#0f172a';
    textarea.style.setProperty('-webkit-text-fill-color', '#0f172a');
    visibleText.textContent = initialText;
    visibleText.style.color = '#0f172a';
  }

  resizeHandles.forEach(({ direction, cursor, style }) => {
    const handle = document.createElement('div');
    handle.setAttribute('data-v106-resize-handle', 'true');
    handle.setAttribute('data-v106-resize-direction', direction);
    handle.style.position = 'absolute';
    handle.style.zIndex = '3';
    handle.style.pointerEvents = 'auto';
    handle.style.touchAction = 'none';
    handle.style.cursor = cursor;
    handle.style.background = 'transparent';
    Object.assign(handle.style, style);
    box.appendChild(handle);
  });

  return box;
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

const getPreviewPageInners = (root: HTMLElement) => {
  const directPageInners = Array.from(root.querySelectorAll<HTMLElement>(':scope > .page-inner'));

  if (directPageInners.length > 0) {
    return directPageInners;
  }

  return Array.from(root.querySelectorAll<HTMLElement>('.page-inner'));
};

const readFrameNodeSnapshot = (node: HTMLElement): FrameNodeSnapshot => {
  const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
  const attrs = Object.fromEntries(
    FRAME_GROUP_ATTR_NAMES.map((name) => [name, node.getAttribute(name) || textarea?.getAttribute(name) || ''])
  );
  const rowColor = node.style.getPropertyValue('--v102-row-color').trim() || 'rgba(59, 130, 246, 0.08)';
  const colColor = node.style.getPropertyValue('--v102-col-color').trim() || 'rgba(14, 165, 233, 0.14)';

  return {
    pageNumber:
      node.getAttribute('data-template-frame-page') ||
      node.closest<HTMLElement>('.page-inner')?.getAttribute('data-page') ||
      '1',
    attrs,
    rowColor,
    colColor,
    rect: node.matches(V106_FRAME_NODE_SELECTOR) ? readFrameNodeRect(node) : readSelectableFrameNodeRect(node),
    value: readFrameNodeDisplayText(node, textarea),
  };
};

const stripFrameSnapshotText = (snapshot: FrameNodeSnapshot): FrameNodeSnapshot => ({
  ...snapshot,
  attrs: {
    ...snapshot.attrs,
    'data-template-frame-source-text': '',
    'data-template-frame-extracted-text': '',
  },
  value: '',
});

const buildFrameProfileSnapshotKey = (snapshot: Pick<FrameNodeSnapshot, 'pageNumber' | 'attrs'>) =>
  [
    snapshot.pageNumber,
    snapshot.attrs['data-template-frame-group'] || '',
    snapshot.attrs['data-template-frame-row-start'] || '',
    snapshot.attrs['data-template-frame-row-end'] || '',
    snapshot.attrs['data-template-frame-col-start'] || '',
    snapshot.attrs['data-template-frame-col-end'] || '',
  ].join('::');

const buildFrameSourceSignatureFromHtml = (html: string) => {
  if (!html.trim() || typeof document === 'undefined') {
    return '';
  }

  const flattened = flattenFramePreviewMarkup(html);
  const versionTag = flattened?.frameGroupVersion || '';
  const sourceHtml = flattened?.html || html;
  const pageWidth = flattened?.pageWidth || '';
  const pageMinHeight = flattened?.pageMinHeight || '';
  const container = document.createElement('div');
  container.innerHTML = sourceHtml;
  const pageInners = Array.from(container.querySelectorAll<HTMLElement>('.page-inner'));
  const signatureParts = pageInners.flatMap((pageInner, pageIndex) =>
    Array.from(pageInner.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR))
      .filter((node) => !node.matches('[data-template-frame-input="true"]'))
      .map((node) => {
        return [
          pageInner.getAttribute('data-page') || String(pageIndex + 1),
          node.getAttribute('data-template-frame-group') || '',
          node.getAttribute('data-template-frame-row-start') || '',
          node.getAttribute('data-template-frame-row-end') || '',
          node.getAttribute('data-template-frame-col-start') || '',
          node.getAttribute('data-template-frame-col-end') || '',
        ].join(':');
      })
  );

  return [versionTag, pageWidth, pageMinHeight, signatureParts.length, signatureParts.join('|')].join('||');
};

const parseReplicaRenderModelFromHtml = (html: string) => {
  const matched = String(html || '').match(RENDER_MODEL_SCRIPT_PATTERN);

  if (!matched?.[1]) {
    return null;
  }

  try {
    return JSON.parse(matched[1]) as TemplateExtractReplicaRenderModel;
  } catch {
    return null;
  }
};

const overlapLength = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

const normalizeExtractedFrameText = (value: string) =>
  value
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

const compactFrameTextForComparison = (value: string) =>
  normalizeExtractedFrameText(value)
    .toLowerCase()
    .replace(/[^0-9A-Za-z\u3131-\u318e\uac00-\ud7a3]+/g, '');

const countFrameTextLines = (value: string) =>
  normalizeExtractedFrameText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;

const looksLikeShortFrameLabel = (value: string) => {
  const normalized = normalizeExtractedFrameText(value);

  if (!normalized || normalized.length > 28 || normalized.includes('\n')) {
    return false;
  }

  const digitCount = (normalized.match(/\d/g) || []).length;
  return digitCount <= 8;
};

const STATUS_HISTORY_LINE_PATTERN = /^(CAE|CE|CAM|PM)\s+.+?\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

const formatFrameSourceTextForDisplay = (
  value: string,
  metadata?: {
    frameGroup?: string | null;
    valueKey?: string | null;
    colorGroup?: string | null;
  }
) => {
  const normalized = normalizeExtractedFrameText(value);

  if (!normalized) {
    return '';
  }

  const frameGroup = String(metadata?.frameGroup || '').trim();
  const valueKey = String(metadata?.valueKey || '').trim();
  const colorGroup = String(metadata?.colorGroup || '').trim();
  const segments = normalized.split(/\s+\|\s+/).map((segment) => segment.trim()).filter(Boolean);
  const isStatusHistoryFrame =
    frameGroup.startsWith('status-history-') || valueKey === '상태 이력' || colorGroup === '상태 이력';

  if (segments.length > 1 && (isStatusHistoryFrame || segments.every((segment) => STATUS_HISTORY_LINE_PATTERN.test(segment)))) {
    return segments.join('\n');
  }

  return normalized;
};

const stringifyRenderTextItem = (item: TemplateExtractReplicaRenderTextItem) => {
  if (item.kind === 'plain' || item.kind === 'plain_text') {
    return item.text;
  }

  if (item.kind === 'status_line') {
    return [item.code, item.actor, item.timestamp].filter(Boolean).join(' ');
  }

  if (!('options' in item)) {
    return '';
  }

  return item.options
    .filter((option) => option.checked)
    .map((option) => option.label)
    .join(' ');
};

type FrameRenderCandidateItem = {
  sourceIndex: number;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  lineHeight: number;
  centerX: number;
  centerY: number;
  horizontalOverlap: number;
  verticalOverlap: number;
  overlapArea: number;
  overlapRatio: number;
  insideStrict: boolean;
  insideLoose: boolean;
  distanceX: number;
  distanceY: number;
  hintAffinity?: number;
  score?: number;
};

type FrameRenderCandidateLine = {
  top: number;
  height: number;
  texts: string[];
};

const mapFrameRenderCandidateItems = (
  page: TemplateExtractReplicaRenderPage,
  frameRect: FrameNodeRect
): FrameRenderCandidateItem[] =>
  page.textItems
    .map((item, sourceIndex) => {
      const text = normalizeExtractedFrameText(stringifyRenderTextItem(item));

      if (!text) {
        return null;
      }

      const left = item.left;
      const top = item.top;
      const width = item.width;
      const height = item.height;
      const centerX = left + width * 0.5;
      const centerY = top + height * 0.5;
      const horizontalOverlap = overlapLength(
        frameRect.left,
        frameRect.left + frameRect.width,
        left,
        left + width
      );
      const verticalOverlap = overlapLength(
        frameRect.top,
        frameRect.top + frameRect.height,
        top,
        top + height
      );
      const overlapArea = horizontalOverlap * verticalOverlap;
      const itemArea = Math.max(1, width * height);

      return {
        sourceIndex,
        text,
        left,
        top,
        width,
        height,
        lineHeight: item.lineHeight,
        centerX,
        centerY,
        horizontalOverlap,
        verticalOverlap,
        overlapArea,
        overlapRatio: overlapArea / itemArea,
        insideStrict:
          centerX >= frameRect.left - 2 &&
          centerX <= frameRect.left + frameRect.width + 2 &&
          centerY >= frameRect.top - 2 &&
          centerY <= frameRect.top + frameRect.height + 2,
        insideLoose:
          centerX >= frameRect.left - 6 &&
          centerX <= frameRect.left + frameRect.width + 6 &&
          centerY >= frameRect.top - 6 &&
          centerY <= frameRect.top + frameRect.height + 6,
        distanceX:
          centerX < frameRect.left
            ? frameRect.left - centerX
            : centerX > frameRect.left + frameRect.width
              ? centerX - (frameRect.left + frameRect.width)
              : 0,
        distanceY:
          centerY < frameRect.top
            ? frameRect.top - centerY
            : centerY > frameRect.top + frameRect.height
              ? centerY - (frameRect.top + frameRect.height)
              : 0,
      } satisfies FrameRenderCandidateItem;
    })
    .filter((item): item is FrameRenderCandidateItem => item !== null);

const groupFrameRenderCandidateLines = (candidateItems: FrameRenderCandidateItem[]): FrameRenderCandidateLine[] => {
  if (!candidateItems.length) {
    return [];
  }

  const lines: FrameRenderCandidateLine[] = [];

  candidateItems.forEach((item) => {
    const lastLine = lines[lines.length - 1];

    if (!lastLine) {
      lines.push({ top: item.centerY, height: item.lineHeight || item.height, texts: [item.text] });
      return;
    }

    const lineThreshold = Math.max(6, Math.min(lastLine.height, item.lineHeight || item.height) * 0.55);

    if (Math.abs(lastLine.top - item.centerY) <= lineThreshold) {
      lastLine.texts.push(item.text);
      lastLine.top = (lastLine.top + item.centerY) * 0.5;
      lastLine.height = Math.max(lastLine.height, item.lineHeight || item.height);
      return;
    }

    lines.push({ top: item.centerY, height: item.lineHeight || item.height, texts: [item.text] });
  });

  return lines;
};

const stringifyFrameRenderCandidateLines = (lines: FrameRenderCandidateLine[]) =>
  normalizeExtractedFrameText(lines.map((line) => line.texts.join(' ')).join('\n'));

const buildFrameTextFromCandidateItems = (candidateItems: FrameRenderCandidateItem[]) =>
  stringifyFrameRenderCandidateLines(groupFrameRenderCandidateLines(candidateItems));

const measureFrameTextAffinity = (left: string, right: string) => {
  const compactLeft = compactFrameTextForComparison(left);
  const compactRight = compactFrameTextForComparison(right);

  if (!compactLeft || !compactRight) {
    return 0;
  }

  if (compactLeft === compactRight) {
    return 1;
  }

  const shorter = compactLeft.length <= compactRight.length ? compactLeft : compactRight;
  const longer = shorter === compactLeft ? compactRight : compactLeft;

  if (longer.includes(shorter)) {
    return shorter.length / Math.max(shorter.length, longer.length);
  }

  let longestPrefix = 0;

  for (let index = 0; index < shorter.length; index += 1) {
    if (longer.includes(shorter.slice(0, shorter.length - index))) {
      longestPrefix = shorter.length - index;
      break;
    }
  }

  return longestPrefix / Math.max(shorter.length, longer.length);
};

const selectFrameRenderCandidateItemsV101 = (
  page: TemplateExtractReplicaRenderPage,
  frameRect: FrameNodeRect
) =>
  mapFrameRenderCandidateItems(page, frameRect)
    .filter((item) => {
      if (item.insideStrict) {
        return true;
      }

      return item.overlapArea > 0 && item.overlapRatio >= 0.28;
    })
    .sort((left, right) => {
      const topDelta = left.top - right.top;
      return Math.abs(topDelta) > 3 ? topDelta : left.left - right.left;
    });

const selectFrameRenderCandidateItemsV102 = (
  page: TemplateExtractReplicaRenderPage,
  frameRect: FrameNodeRect,
  sourceTextHint: string
) => {
  const normalizedHint = normalizeExtractedFrameText(sourceTextHint);

  return mapFrameRenderCandidateItems(page, frameRect)
    .map((item) => {
      const hintAffinity = normalizedHint ? measureFrameTextAffinity(item.text, normalizedHint) : 0;
      const score =
        (item.insideStrict ? 4 : item.insideLoose ? 2.5 : 0) +
        Math.min(3, item.overlapRatio * 6) +
        hintAffinity * 3 -
        Math.min(1.2, (item.distanceX + item.distanceY) / 24);

      return {
        ...item,
        hintAffinity,
        score,
      };
    })
    .filter((item) => {
      if (item.insideStrict) {
        return true;
      }

      if (item.overlapArea > 0 && item.overlapRatio >= 0.16) {
        return true;
      }

      return item.hintAffinity >= 0.55 && item.insideLoose;
    })
    .sort((left, right) => {
      if (Math.abs(left.top - right.top) > 3) {
        return left.top - right.top;
      }

      if (Math.abs(left.left - right.left) > 2) {
        return left.left - right.left;
      }

      return right.score - left.score;
    });
};

const selectBestFrameRenderTextWindowV102 = (
  candidateItems: FrameRenderCandidateItem[],
  sourceTextHint: string
) => {
  const lines = groupFrameRenderCandidateLines(candidateItems);

  if (!lines.length) {
    return '';
  }

  const normalizedHint = normalizeExtractedFrameText(sourceTextHint);

  if (!normalizedHint) {
    return stringifyFrameRenderCandidateLines(lines);
  }

  const hintLineCount = countFrameTextLines(normalizedHint);
  let bestText = '';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let start = 0; start < lines.length; start += 1) {
    for (let end = start + 1; end <= lines.length; end += 1) {
      const candidateText = stringifyFrameRenderCandidateLines(lines.slice(start, end));

      if (!candidateText) {
        continue;
      }

      const affinity = measureFrameTextAffinity(candidateText, normalizedHint);
      const candidateLineCount = countFrameTextLines(candidateText);
      const compactCandidate = compactFrameTextForComparison(candidateText);
      const compactHint = compactFrameTextForComparison(normalizedHint);
      const containsBonus =
        compactCandidate === compactHint
          ? 1.25
          : compactCandidate.includes(compactHint) || compactHint.includes(compactCandidate)
            ? 0.45
            : 0;
      const extraLinePenalty = Math.max(0, candidateLineCount - hintLineCount) * 0.55;
      const extraLengthPenalty = Math.max(0, candidateText.length - normalizedHint.length) / Math.max(8, normalizedHint.length);
      const shorterPenalty = Math.max(0, hintLineCount - candidateLineCount) * 0.35;
      const score = affinity * 4 + containsBonus - extraLinePenalty - extraLengthPenalty - shorterPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestText = candidateText;
      }
    }
  }

  return bestText || stringifyFrameRenderCandidateLines(lines);
};

const resolveFrameTextExtractionV102 = (renderText: string, sourceTextHint: string) => {
  const normalizedRenderText = normalizeExtractedFrameText(renderText);
  const normalizedSourceHint = normalizeExtractedFrameText(sourceTextHint);

  if (!normalizedRenderText) {
    return normalizedSourceHint;
  }

  if (!normalizedSourceHint) {
    return normalizedRenderText;
  }

  const affinity = measureFrameTextAffinity(normalizedRenderText, normalizedSourceHint);
  const compactRender = compactFrameTextForComparison(normalizedRenderText);
  const compactSource = compactFrameTextForComparison(normalizedSourceHint);

  if (!compactRender) {
    return normalizedSourceHint;
  }

  if (compactRender === compactSource) {
    return normalizedSourceHint.length >= normalizedRenderText.length ? normalizedSourceHint : normalizedRenderText;
  }

  if (compactRender.includes(compactSource) && compactSource.length / compactRender.length >= 0.6) {
    if (
      countFrameTextLines(normalizedRenderText) > countFrameTextLines(normalizedSourceHint) &&
      looksLikeShortFrameLabel(normalizedSourceHint)
    ) {
      return normalizedSourceHint;
    }

    return normalizedRenderText;
  }

  if (compactSource.includes(compactRender) && compactRender.length / compactSource.length <= 0.8) {
    return normalizedSourceHint;
  }

  if (countFrameTextLines(normalizedRenderText) < countFrameTextLines(normalizedSourceHint)) {
    return normalizedSourceHint;
  }

  if (normalizedRenderText.length < Math.max(4, Math.round(normalizedSourceHint.length * 0.6))) {
    return normalizedSourceHint;
  }

  if (looksLikeShortFrameLabel(normalizedSourceHint) && affinity < 0.72) {
    return normalizedSourceHint;
  }

  return affinity >= 0.35 ? normalizedRenderText : normalizedSourceHint;
};

const looksLikeNoisyFrameExtractedText = (value: string) => {
  const normalized = normalizeExtractedFrameText(value);

  if (!normalized) {
    return false;
  }

  const compact = compactFrameTextForComparison(normalized);
  const symbolCount = (normalized.match(/[|[\]{}<>_=]/g) || []).length;
  const visibleLength = normalized.replace(/\s+/g, '').length;

  if (symbolCount >= 2) {
    return true;
  }

  if (visibleLength >= 3 && compact.length <= Math.max(1, Math.floor(visibleLength * 0.55))) {
    return true;
  }

  return false;
};

const scoreFrameRenderCandidateItemV112 = (item: FrameRenderCandidateItem, sourceTextHint: string) => {
  const normalizedHint = normalizeExtractedFrameText(sourceTextHint);
  const hintAffinity = normalizedHint ? measureFrameTextAffinity(item.text, normalizedHint) : 0;
  const geometryScore =
    (item.insideStrict ? 5.5 : item.insideLoose ? 2.8 : 0) +
    Math.min(3.6, item.overlapRatio * 7.2) -
    Math.min(1.5, (item.distanceX + item.distanceY) / 18);
  const linePenalty =
    normalizedHint && countFrameTextLines(item.text) > countFrameTextLines(normalizedHint) + 1 ? 0.85 : 0;
  const noisePenalty = normalizedHint && looksLikeNoisyFrameExtractedText(item.text) ? 0.9 : 0;

  return {
    ...item,
    hintAffinity,
    score: geometryScore + hintAffinity * 4 - linePenalty - noisePenalty,
  } satisfies FrameRenderCandidateItem;
};

const resolveFrameTextExtractionV112 = (
  assignedText: string,
  localText: string,
  sourceTextHint: string
) => {
  const normalizedHint = normalizeExtractedFrameText(sourceTextHint);
  const resolvedAssigned = resolveFrameTextExtractionV102(assignedText, sourceTextHint);
  const resolvedLocal = resolveFrameTextExtractionV102(localText, sourceTextHint);

  if (!resolvedAssigned) {
    return resolvedLocal || normalizedHint;
  }

  if (!resolvedLocal) {
    return resolvedAssigned;
  }

  if (!normalizedHint) {
    return resolvedAssigned.length >= resolvedLocal.length ? resolvedAssigned : resolvedLocal;
  }

  const assignedNoise = looksLikeNoisyFrameExtractedText(resolvedAssigned);
  const localNoise = looksLikeNoisyFrameExtractedText(resolvedLocal);

  if (assignedNoise !== localNoise) {
    return assignedNoise ? resolvedLocal : resolvedAssigned;
  }

  const assignedAffinity = measureFrameTextAffinity(resolvedAssigned, normalizedHint);
  const localAffinity = measureFrameTextAffinity(resolvedLocal, normalizedHint);

  if (Math.abs(assignedAffinity - localAffinity) > 0.08) {
    return assignedAffinity > localAffinity ? resolvedAssigned : resolvedLocal;
  }

  const hintLineCount = countFrameTextLines(normalizedHint);
  const assignedLineDistance = Math.abs(countFrameTextLines(resolvedAssigned) - hintLineCount);
  const localLineDistance = Math.abs(countFrameTextLines(resolvedLocal) - hintLineCount);

  if (assignedLineDistance !== localLineDistance) {
    return assignedLineDistance < localLineDistance ? resolvedAssigned : resolvedLocal;
  }

  return resolvedAssigned.length >= resolvedLocal.length ? resolvedAssigned : resolvedLocal;
};

const extractFrameTextStateFromRenderPageV112 = (
  page: TemplateExtractReplicaRenderPage | null | undefined,
  framePlans: Array<{
    key: string;
    frameRect: FrameNodeRect;
    sourceTextHint: string;
  }>
): FrameExtractedTextState => {
  if (!page || !framePlans.length) {
    return {};
  }

  const assignments = new Map<string, FrameRenderCandidateItem[]>();
  const localCandidatesByKey = new Map<string, FrameRenderCandidateItem[]>();
  const scoredByItemIndex = new Map<number, Array<{ key: string; item: FrameRenderCandidateItem }>>();

  framePlans.forEach((plan) => {
    const candidates = mapFrameRenderCandidateItems(page, plan.frameRect)
      .map((item) => scoreFrameRenderCandidateItemV112(item, plan.sourceTextHint))
      .filter((item) => {
        if (item.insideStrict) {
          return true;
        }

        if (item.overlapArea > 0 && item.overlapRatio >= 0.14) {
          return true;
        }

        return (item.hintAffinity || 0) >= 0.5 && item.insideLoose;
      })
      .sort((left, right) => {
        if (Math.abs(left.top - right.top) > 3) {
          return left.top - right.top;
        }

        if (Math.abs(left.left - right.left) > 2) {
          return left.left - right.left;
        }

        return (right.score || 0) - (left.score || 0);
      });

    localCandidatesByKey.set(plan.key, candidates);

    candidates.forEach((item) => {
      const entries = scoredByItemIndex.get(item.sourceIndex) || [];
      entries.push({ key: plan.key, item });
      scoredByItemIndex.set(item.sourceIndex, entries);
    });
  });

  scoredByItemIndex.forEach((entries) => {
    const viable = entries
      .filter(({ item }) => (item.score || 0) >= 2.2 || (item.insideStrict && (item.score || 0) >= 1.4))
      .sort((left, right) => (right.item.score || 0) - (left.item.score || 0));

    if (!viable.length) {
      return;
    }

    const best = viable[0];
    const second = viable[1];

    if (
      second &&
      (best.item.score || 0) < (second.item.score || 0) + 0.55 &&
      (best.item.hintAffinity || 0) < 0.7 &&
      !best.item.insideStrict
    ) {
      return;
    }

    const assigned = assignments.get(best.key) || [];
    assigned.push(best.item);
    assignments.set(best.key, assigned);
  });

  return framePlans.reduce<FrameExtractedTextState>((nextState, plan) => {
    const assignedItems = (assignments.get(plan.key) || []).sort((left, right) => {
      if (Math.abs(left.top - right.top) > 3) {
        return left.top - right.top;
      }

      if (Math.abs(left.left - right.left) > 2) {
        return left.left - right.left;
      }

      return (right.score || 0) - (left.score || 0);
    });
    const localCandidates = localCandidatesByKey.get(plan.key) || [];
    const assignedText = selectBestFrameRenderTextWindowV102(assignedItems, plan.sourceTextHint);
    const localText = selectBestFrameRenderTextWindowV102(localCandidates, plan.sourceTextHint);
    nextState[plan.key] = resolveFrameTextExtractionV112(assignedText, localText, plan.sourceTextHint);
    return nextState;
  }, {});
};

const scoreFrameRenderCandidateItemImageV100 = (item: FrameRenderCandidateItem, sourceTextHint: string) => {
  const normalizedHint = normalizeExtractedFrameText(sourceTextHint);
  const hintAffinity = normalizedHint ? measureFrameTextAffinity(item.text, normalizedHint) : 0;
  const geometryScore =
    (item.insideStrict ? 5.2 : item.insideLoose ? 2.4 : 0) +
    Math.min(3.2, item.overlapRatio * 6.4) -
    Math.min(1.8, (item.distanceX + item.distanceY) / 16);
  const noisePenalty = looksLikeNoisyFrameExtractedText(item.text) ? 1.1 : 0;

  return {
    ...item,
    hintAffinity,
    score: geometryScore + hintAffinity * 2.6 - noisePenalty,
  } satisfies FrameRenderCandidateItem;
};

const resolveFrameTextExtractionImageV100 = (
  assignedText: string,
  localText: string,
  sourceTextHint: string
) => {
  const resolvedAssigned = resolveFrameTextExtractionV102(assignedText, sourceTextHint);
  const resolvedLocal = resolveFrameTextExtractionV102(localText, sourceTextHint);

  if (!resolvedAssigned) {
    return resolvedLocal;
  }

  if (!resolvedLocal) {
    return resolvedAssigned;
  }

  const assignedNoise = looksLikeNoisyFrameExtractedText(resolvedAssigned);
  const localNoise = looksLikeNoisyFrameExtractedText(resolvedLocal);

  if (assignedNoise !== localNoise) {
    return assignedNoise ? resolvedLocal : resolvedAssigned;
  }

  return resolvedAssigned.length >= resolvedLocal.length ? resolvedAssigned : resolvedLocal;
};

const extractFrameTextStateFromRenderPageImageV100 = (
  page: TemplateExtractReplicaRenderPage | null | undefined,
  framePlans: Array<{
    key: string;
    frameRect: FrameNodeRect;
    sourceTextHint: string;
  }>
): FrameExtractedTextState => {
  if (!page || !framePlans.length) {
    return {};
  }

  const assignments = new Map<string, FrameRenderCandidateItem[]>();
  const localCandidatesByKey = new Map<string, FrameRenderCandidateItem[]>();
  const scoredByItemIndex = new Map<number, Array<{ key: string; item: FrameRenderCandidateItem }>>();

  framePlans.forEach((plan) => {
    const candidates = mapFrameRenderCandidateItems(page, plan.frameRect)
      .map((item) => scoreFrameRenderCandidateItemImageV100(item, plan.sourceTextHint))
      .filter((item) => {
        if (item.insideStrict) {
          return true;
        }

        if (item.overlapArea > 0 && item.overlapRatio >= 0.1) {
          return true;
        }

        return (item.hintAffinity || 0) >= 0.32 && item.insideLoose;
      })
      .sort((left, right) => {
        if (Math.abs(left.top - right.top) > 3) {
          return left.top - right.top;
        }

        if (Math.abs(left.left - right.left) > 2) {
          return left.left - right.left;
        }

        return (right.score || 0) - (left.score || 0);
      });

    localCandidatesByKey.set(plan.key, candidates);

    candidates.forEach((item) => {
      const entries = scoredByItemIndex.get(item.sourceIndex) || [];
      entries.push({ key: plan.key, item });
      scoredByItemIndex.set(item.sourceIndex, entries);
    });
  });

  scoredByItemIndex.forEach((entries) => {
    const viable = entries
      .filter(({ item }) => (item.score || 0) >= 1.8 || (item.insideStrict && (item.score || 0) >= 1.2))
      .sort((left, right) => (right.item.score || 0) - (left.item.score || 0));

    if (!viable.length) {
      return;
    }

    const best = viable[0];
    const second = viable[1];

    if (
      second &&
      (best.item.score || 0) < (second.item.score || 0) + 0.4 &&
      (best.item.hintAffinity || 0) < 0.58 &&
      !best.item.insideStrict
    ) {
      return;
    }

    const assigned = assignments.get(best.key) || [];
    assigned.push(best.item);
    assignments.set(best.key, assigned);
  });

  return framePlans.reduce<FrameExtractedTextState>((nextState, plan) => {
    const assignedItems = (assignments.get(plan.key) || []).sort((left, right) => {
      if (Math.abs(left.top - right.top) > 3) {
        return left.top - right.top;
      }

      if (Math.abs(left.left - right.left) > 2) {
        return left.left - right.left;
      }

      return (right.score || 0) - (left.score || 0);
    });
    const localCandidates = localCandidatesByKey.get(plan.key) || [];
    const assignedText = selectBestFrameRenderTextWindowV102(assignedItems, plan.sourceTextHint);
    const localText = selectBestFrameRenderTextWindowV102(localCandidates, plan.sourceTextHint);
    nextState[plan.key] = resolveFrameTextExtractionImageV100(assignedText, localText, plan.sourceTextHint);
    return nextState;
  }, {});
};

const extractFrameTextFromRenderPage = (
  page: TemplateExtractReplicaRenderPage | null | undefined,
  frameRect: FrameNodeRect,
  version: FrameTextExtractionVersion,
  sourceTextHint = ''
) => {
  if (!page) {
    return '';
  }

  switch (version) {
    case 'v1.12': {
      const candidateItems = selectFrameRenderCandidateItemsV102(page, frameRect, sourceTextHint).map((item) =>
        scoreFrameRenderCandidateItemV112(item, sourceTextHint)
      );
      const renderText = selectBestFrameRenderTextWindowV102(candidateItems, sourceTextHint);
      return resolveFrameTextExtractionV112(renderText, renderText, sourceTextHint);
    }
    case 'v1.02': {
      const candidateItems = selectFrameRenderCandidateItemsV102(page, frameRect, sourceTextHint);
      const renderText = selectBestFrameRenderTextWindowV102(candidateItems, sourceTextHint);
      return resolveFrameTextExtractionV102(renderText, sourceTextHint);
    }
    case 'v1.01':
    default: {
      return buildFrameTextFromCandidateItems(selectFrameRenderCandidateItemsV101(page, frameRect));
    }
  }
};

const writeFrameNodeExtractedText = (node: HTMLElement, nextText: string) => {
  const normalizedText = formatFrameSourceTextForDisplay(nextText, {
    frameGroup: node.getAttribute('data-template-frame-group'),
    valueKey: node.getAttribute('data-template-frame-value-key'),
    colorGroup: node.getAttribute('data-template-frame-color-group'),
  });
  const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
  const visibleText = node.querySelector<HTMLElement>('[data-template-frame-visible-text="true"]');

  if (normalizedText) {
    node.setAttribute('data-template-frame-extracted-text', normalizedText);
    textarea?.setAttribute('data-template-frame-extracted-text', normalizedText);
  } else {
    node.removeAttribute('data-template-frame-extracted-text');
    textarea?.removeAttribute('data-template-frame-extracted-text');
  }

  if (textarea) {
    textarea.value = normalizedText;
    textarea.textContent = normalizedText;
    textarea.style.color = normalizedText ? '#0f172a' : 'transparent';
    textarea.style.setProperty('-webkit-text-fill-color', normalizedText ? '#0f172a' : 'transparent');
  }

  if (visibleText) {
    visibleText.textContent = normalizedText;
    visibleText.style.color = normalizedText ? '#0f172a' : 'transparent';
  }
};

const buildFrameExtractedTextKey = ({
  pageNumber,
  frameGroup,
  rowStart,
  rowEnd,
  colStart,
  colEnd,
}: {
  pageNumber: string;
  frameGroup: string;
  rowStart?: string | null;
  rowEnd?: string | null;
  colStart?: string | null;
  colEnd?: string | null;
}) =>
  [pageNumber, frameGroup, rowStart || '', rowEnd || '', colStart || '', colEnd || ''].join('::');

const buildFrameExtractedTextKeyFromNode = (node: HTMLElement) => {
  const pageNumber =
    node.getAttribute('data-template-frame-page') ||
    node.closest<HTMLElement>('.page-inner')?.getAttribute('data-page') ||
    '1';
  const frameGroup = node.getAttribute('data-template-frame-group') || '';

  if (!frameGroup) {
    return '';
  }

  return buildFrameExtractedTextKey({
    pageNumber,
    frameGroup,
    rowStart: node.getAttribute('data-template-frame-row-start'),
    rowEnd: node.getAttribute('data-template-frame-row-end'),
    colStart: node.getAttribute('data-template-frame-col-start'),
    colEnd: node.getAttribute('data-template-frame-col-end'),
  });
};

const resetFrameNodeExtractedText = (node: HTMLElement) => {
  const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
  const visibleText = node.querySelector<HTMLElement>('[data-template-frame-visible-text="true"]');

  node.removeAttribute('data-template-frame-extracted-text');
  textarea?.removeAttribute('data-template-frame-extracted-text');

  if (textarea) {
    textarea.value = '';
    textarea.textContent = '';
    textarea.style.color = 'transparent';
    textarea.style.setProperty('-webkit-text-fill-color', 'transparent');
  }

  if (visibleText) {
    visibleText.textContent = '';
    visibleText.style.color = 'transparent';
  }
};

const collectFrameExtractedTextStateFromHtml = (html: string): FrameExtractedTextState => {
  if (!html.trim() || typeof document === 'undefined') {
    return {};
  }

  const container = document.createElement('div');
  const nextState: FrameExtractedTextState = {};
  container.innerHTML = html;

  Array.from(container.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
    .filter((node) => !node.matches('[data-template-frame-input="true"]'))
    .forEach((node) => {
      const key = buildFrameExtractedTextKeyFromNode(node);
      const value = normalizeExtractedFrameText(readFrameNodeExtractedText(node));

      if (!key || !value) {
        return;
      }

      nextState[key] = value;
    });

  return nextState;
};

const stripFrameExtractedTextStateFromHtml = (html: string) => {
  if (!html.trim() || typeof document === 'undefined') {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  Array.from(container.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
    .filter((node) => !node.matches('[data-template-frame-input="true"]'))
    .forEach((node) => {
      resetFrameNodeExtractedText(node);
    });

  return container.innerHTML;
};

const applyFrameExtractedTextStateToHtml = (html: string, extractedTextState: FrameExtractedTextState) => {
  if (!html.trim() || typeof document === 'undefined') {
    return html;
  }

  if (Object.keys(extractedTextState).length === 0) {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  Array.from(container.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
    .filter((node) => !node.matches('[data-template-frame-input="true"]'))
    .forEach((node) => {
      const key = buildFrameExtractedTextKeyFromNode(node);

      if (!key || !Object.prototype.hasOwnProperty.call(extractedTextState, key)) {
        return;
      }

      writeFrameNodeExtractedText(node, extractedTextState[key] || '');
    });

  return container.innerHTML;
};

const buildReviewedFieldsFromFrameNodes = (
  nodes: HTMLElement[],
  previousFields: TemplateExtractReviewedFieldInput[]
) => {
  const previousFieldByLabelKey = new Map(
    previousFields
      .filter((field) => field.labelKey.trim())
      .map((field) => [normalizeFrameFieldPath(field.labelKey), field])
  );
  const grouped = new Map<
    string,
    {
      sourceValues: string[];
      sortOrder: number;
      fieldType: TemplateExtractReviewedFieldInput['fieldType'];
    }
  >();

  nodes.forEach((node, index) => {
    const role = (node.getAttribute('data-template-frame-role') as FrameEditorRole | null) || 'group';

    if (role !== 'value' && role !== 'key_value') {
      return;
    }

    const valueKey = normalizeFrameFieldPath(node.getAttribute('data-template-frame-value-key') || '');

    if (!valueKey) {
      return;
    }

    const sourceValue = readFrameNodeDisplayText(node).replace(/\s+/g, ' ').trim();
    const lastSegment = valueKey.split('>').pop()?.trim() || valueKey;
    const knownField =
      TemplateExtractValueBindingService.inferKnownFieldForLabel(lastSegment, index) ||
      TemplateExtractValueBindingService.inferKnownFieldForLabel(valueKey, index);
    const entry = grouped.get(valueKey) || {
      sourceValues: [],
      sortOrder: index + 1,
      fieldType:
        knownField?.fieldType ||
        (sourceValue.length >= 80 || sourceValue.includes('\n') ? 'textarea' : 'text'),
    };

    if (sourceValue && !entry.sourceValues.includes(sourceValue)) {
      entry.sourceValues.push(sourceValue);
    }

    if (knownField?.fieldType) {
      entry.fieldType = knownField.fieldType;
    }

    grouped.set(valueKey, entry);
  });

  return Array.from(grouped.entries())
    .map(([labelKey, entry], index) => {
      const previous = previousFieldByLabelKey.get(labelKey);
      const fieldKey = previous?.fieldKey || `frame_field_${hashFrameValueKey(labelKey)}`;
      const candidateKey = previous?.candidateKey || `manual:${fieldKey}`;
      const defaultValue = previous?.defaultValue ?? entry.sourceValues.join('\n');
      const fieldLabel = previous?.fieldLabel?.trim() || labelKey;

      return {
        candidateKey,
        fieldKey,
        labelKey,
        fieldType: previous?.fieldType || entry.fieldType,
        fieldLabel,
        required: previous?.required ?? false,
        placeholder: previous?.placeholder ?? null,
        defaultValue,
        options: previous?.options || [],
        layoutBlockId: previous?.layoutBlockId || `frame:${fieldKey}`,
        sortOrder: previous?.sortOrder ?? entry.sortOrder ?? index + 1,
        reviewStatus: previous?.reviewStatus || (entry.fieldType === 'signature' ? 'review_needed' : 'accepted'),
      } satisfies TemplateExtractReviewedFieldInput;
    })
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
};

const applyStoredFrameProfileToPreview = (root: HTMLElement, profile: StoredFrameProfile) => {
  const pageInners = getPreviewPageInners(root);

  if (!pageInners.length || !profile.frames.length) {
    return false;
  }

  const currentFrameSnapshots = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
    .filter((node) => !node.matches('[data-template-frame-input="true"]'))
    .map(readFrameNodeSnapshot);
  const currentFrameSnapshotByKey = new Map(
    currentFrameSnapshots.map((snapshot) => [buildFrameProfileSnapshotKey(snapshot), snapshot] as const)
  );

  pageInners.forEach((pageInner) => {
    pageInner.replaceChildren();
    pageInner.style.position = 'relative';
  });

  const pageInnerByPageNumber = new Map(
    pageInners.map((pageInner, index) => [pageInner.getAttribute('data-page') || String(index + 1), pageInner] as const)
  );

  profile.frames.forEach((snapshot) => {
    const pageInner = pageInnerByPageNumber.get(snapshot.pageNumber) || pageInners[0];
    const currentSnapshot = currentFrameSnapshotByKey.get(buildFrameProfileSnapshotKey(snapshot));
    const currentSourceText =
      currentSnapshot?.attrs['data-template-frame-source-text'] || '';
    const currentExtractedText =
      currentSnapshot?.attrs['data-template-frame-extracted-text'] || '';
    const mergedSnapshot: FrameNodeSnapshot = currentSnapshot
      ? {
          ...snapshot,
          rowColor: currentSnapshot.rowColor || snapshot.rowColor,
          colColor: currentSnapshot.colColor || snapshot.colColor,
          attrs: {
            ...snapshot.attrs,
            'data-template-frame-source-text': currentSourceText,
            'data-template-frame-extracted-text': currentExtractedText,
          },
          value: currentExtractedText || currentSourceText,
        }
      : {
          ...snapshot,
          attrs: {
            ...snapshot.attrs,
            'data-template-frame-source-text': '',
            'data-template-frame-extracted-text': '',
          },
          value: '',
        };
    let editorLayer = pageInner.querySelector<HTMLElement>('[data-v106-frame-editor-layer="true"]');

    if (!editorLayer) {
      editorLayer = document.createElement('div');
      editorLayer.className = 'v106-frame-editor-layer';
      editorLayer.setAttribute('data-v106-frame-editor-layer', 'true');
      editorLayer.style.position = 'absolute';
      editorLayer.style.inset = '0';
      editorLayer.style.pointerEvents = 'none';
      pageInner.appendChild(editorLayer);
    }

    const node = buildV106FrameNode(mergedSnapshot);
    node.style.pointerEvents = 'auto';
    editorLayer.appendChild(node);
  });

  root.setAttribute('data-v106-frame-editor-ready', 'true');
  return true;
};

const normalizeFramePreviewForV106 = (root: HTMLElement) => {
  if (root.getAttribute('data-v106-frame-editor-ready') === 'true') {
    return false;
  }

  const frameGroupVersionTag = root.getAttribute('data-template-frame-group-version') || '';

  if (!isSupportedFrameEditorVersion(frameGroupVersionTag)) {
    return false;
  }

  const transparentMode = isV109FrameGroupVersion(frameGroupVersionTag);

  let transformed = false;
  const pageInners = getPreviewPageInners(root);

  pageInners.forEach((pageInner, pageIndex) => {
    const frameGroups = Array.from(pageInner.querySelectorAll<HTMLElement>('.v202-frame-group'));

    if (!frameGroups.length) {
      return;
    }

    const pageRect = pageInner.getBoundingClientRect();
    const scale = readFramePreviewScale(pageInner);
    const snapshots: FrameNodeSnapshot[] = frameGroups.map((frameGroup) => {
      const rect = frameGroup.getBoundingClientRect();
      const host = frameGroup.closest<HTMLElement>('td, .v102-frame-band, .v202-text-box, .v202-cell-box') || frameGroup;
      const computed = window.getComputedStyle(host);
      const textarea = frameGroup.querySelector<HTMLTextAreaElement>('textarea');
      const attrs = Object.fromEntries(
        FRAME_GROUP_ATTR_NAMES.map((name) => [name, frameGroup.getAttribute(name) || textarea?.getAttribute(name) || ''])
      );

      return {
        pageNumber: pageInner.getAttribute('data-page') || String(pageIndex + 1),
        attrs,
        rowColor: transparentMode
          ? 'transparent'
          : computed.getPropertyValue('--v102-row-color').trim() || 'rgba(59, 130, 246, 0.08)',
        colColor: transparentMode
          ? 'transparent'
          : computed.getPropertyValue('--v102-col-color').trim() || 'rgba(14, 165, 233, 0.14)',
        rect: {
          left: (rect.left - pageRect.left) / scale,
          top: (rect.top - pageRect.top) / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        },
        value:
          frameGroup.getAttribute('data-template-frame-extracted-text') ||
          textarea?.getAttribute('data-template-frame-extracted-text') ||
          textarea?.value ||
          '',
      };
    });

    pageInner.replaceChildren();
    pageInner.style.position = 'relative';

    const editorLayer = document.createElement('div');
    editorLayer.className = 'v106-frame-editor-layer';
    editorLayer.setAttribute('data-v106-frame-editor-layer', 'true');
    editorLayer.style.position = 'absolute';
    editorLayer.style.inset = '0';
    editorLayer.style.pointerEvents = 'none';

    snapshots.forEach((snapshot) => {
      const node = buildV106FrameNode(snapshot);
      node.style.pointerEvents = 'auto';
      editorLayer.appendChild(node);
    });

    pageInner.appendChild(editorLayer);
    transformed = true;
  });

  if (transformed) {
    root.setAttribute('data-v106-frame-editor-ready', 'true');
  }

  return transformed;
};

const renderContentPreview = (
  sourceKind: TemplateExtractSourceKind,
  content: string,
  className = ''
) => {
  if (!content.trim()) {
    return (
      <div className={className}>
        <p className="p-6 text-sm text-slate-500">표시할 내용이 없습니다.</p>
      </div>
    );
  }

  if (sourceKind === 'html') {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <pre className={className}>{content}</pre>;
};

const formatScore = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(4);
};

const formatPercent = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return `${(value * 100).toFixed(2)}%`;
};

const buildSelectedFileCacheKey = (file: File | null | undefined) =>
  file ? `${file.name}::${file.size}::${file.lastModified}` : '';

const toVisualSimilarityStepKey = (phase: string): VisualSimilarityProgressStepKey => {
  if (phase === 'loading_html' || phase === 'capturing_pages') {
    return 'preparing_replica_pages';
  }

  if (
    phase === 'uploading' ||
    phase === 'rendering_pdf' ||
    phase === 'preparing_pdf_pages' ||
    phase === 'rendering_html' ||
    phase === 'preparing_replica_pages' ||
    phase === 'comparing_pages' ||
    phase === 'aggregating'
  ) {
    return phase;
  }

  return 'uploading';
};

export default function TemplateExtractPage() {
  const [sourceTitle, setSourceTitle] = React.useState('안전관리계획서 입력본');
  const [sourceKind, setSourceKind] = React.useState<TemplateExtractSourceKind>('html');
  const [sourceContent, setSourceContent] = React.useState(defaultSourceContent);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [engineVersion, setEngineVersion] = React.useState<TemplateExtractEngineVersion>('47');
  const [frameGroupVersion, setFrameGroupVersion] = React.useState<TemplateExtractFrameGroupVersion>('v1.11');
  const [frameProfileName, setFrameProfileName] = React.useState('default');
  const [previewPaneMode, setPreviewPaneMode] = React.useState<PreviewPaneMode>('source');
  const [draftPreviewEditRole, setDraftPreviewEditRole] = React.useState<DraftPreviewEditRole>('editor');
  const [selectedFrameGroupIds, setSelectedFrameGroupIds] = React.useState<string[]>([]);
  const [frameEditorValueKey, setFrameEditorValueKey] = React.useState('');
  const [frameEditorRole, setFrameEditorRole] = React.useState<FrameEditorRole>('group');
  const [frameEditorOutlineStyle, setFrameEditorOutlineStyle] = React.useState<FrameOutlineStyle>('solid');
  const [frameEditorParentGroup, setFrameEditorParentGroup] = React.useState('');
  const [frameEditorChainKey, setFrameEditorChainKey] = React.useState('');
  const [frameEditorChainDepth, setFrameEditorChainDepth] = React.useState('');
  const [frameEditorWidthPx, setFrameEditorWidthPx] = React.useState('');
  const [frameEditorHeightPx, setFrameEditorHeightPx] = React.useState('');
  const [frameMergePromptDismissed, setFrameMergePromptDismissed] = React.useState(false);
  const [frameCreateMode, setFrameCreateMode] = React.useState(false);
  const [frameEditorNotice, setFrameEditorNotice] = React.useState<string | null>(null);
  const [frameRevision, setFrameRevision] = React.useState(0);
  const [frameTextExtractionMode, setFrameTextExtractionMode] =
    React.useState<FrameTextExtractionMode>('non_image');
  const [frameTextExtractionVersion, setFrameTextExtractionVersion] =
    React.useState<FrameTextExtractionVersion>('v1.12');
  const [imageFrameTextExtractionVersion, setImageFrameTextExtractionVersion] =
    React.useState<ImageFrameTextExtractionVersion>('v1.00');
  const [frameExtractedTextState, setFrameExtractedTextState] = React.useState<FrameExtractedTextState>({});
  const [frameTextExtractionCompleted, setFrameTextExtractionCompleted] = React.useState(false);
  const [similarTemplateIdsText, setSimilarTemplateIdsText] = React.useState('');
  const [selectedDraftId, setSelectedDraftId] = React.useState('');
  const [reviewedFields, setReviewedFields] = React.useState<TemplateExtractReviewedFieldInput[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = React.useState<string | null>(null);
  const [templateName, setTemplateName] = React.useState('안전관리계획서 템플릿 초안');
  const [layoutResizeMode, setLayoutResizeMode] =
    React.useState<TemplateLayoutResizeMode>('grow_height');
  const [draftDetail, setDraftDetail] = React.useState<TemplateExtractDetailResult | null>(null);
  const [visualSimilarityReport, setVisualSimilarityReport] =
    React.useState<TemplateExtractVisualSimilarityReport | null>(null);
  const [crossValidationPreview, setCrossValidationPreview] =
    React.useState<CrossValidationPreviewState | null>(null);
  const [crossValidationReferenceVisible, setCrossValidationReferenceVisible] = React.useState(false);
  const [crossValidationViewMode, setCrossValidationViewMode] =
    React.useState<CrossValidationViewMode>('side_by_side');
  const [crossValidationPageIndex, setCrossValidationPageIndex] = React.useState(0);
  const [crossValidationOverlayOpacity, setCrossValidationOverlayOpacity] = React.useState(55);
  const [recentDrafts, setRecentDrafts] = React.useState<RecentDraftOption[]>([]);
  const [registeredTemplates, setRegisteredTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [selectedRegisteredTemplateId, setSelectedRegisteredTemplateId] = React.useState('');
  const [loadedTemplateId, setLoadedTemplateId] = React.useState<string | null>(null);
  const [approveResult, setApproveResult] = React.useState<{
    templateId: string;
    approvedFieldCount: number;
    skippedFieldCount: number;
  } | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [draftHtmlCopied, setDraftHtmlCopied] = React.useState(false);
  const [draftLogWriting, setDraftLogWriting] = React.useState(false);
  const [visualSimilarityMeasuring, setVisualSimilarityMeasuring] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [draftProgress, setDraftProgress] = React.useState<DraftCreateProgressState>({
    visible: false,
    phase: 'idle',
    percent: 0,
    stage: '',
    detail: '',
  });
  const [draftProgressAction, setDraftProgressAction] =
    React.useState<TemplateExtractExtractionStage>('full');
  const [progressPanelExpanded, setProgressPanelExpanded] = React.useState(false);
  const progressTimerRef = React.useRef<number | null>(null);
  const visualProgressTimerRef = React.useRef<number | null>(null);
  const visualMeasurementFrameRef = React.useRef<HTMLIFrameElement | null>(null);
  const draftPreviewRef = React.useRef<HTMLDivElement | null>(null);
  const draftPreviewHtmlRef = React.useRef('');
  const appliedFrameProfileKeyRef = React.useRef('');
  const frameDragStateRef = React.useRef<FrameDragState | null>(null);
  const frameResizeStateRef = React.useRef<FrameResizeState | null>(null);
  const frameCreateStateRef = React.useRef<FrameCreateState | null>(null);
  const visualMeasurementLogFileNameRef = React.useRef('');
  const lastVisualMeasurementLogEventKeyRef = React.useRef('');
  const lastVisualMeasurementKeyRef = React.useRef<string>('');
  const frameTextRenderModelCacheRef = React.useRef<{
    fileKey: string;
    model: FrameTextRenderModelV112;
  } | null>(null);
  const [visualSimilarityProgress, setVisualSimilarityProgress] =
    React.useState<VisualSimilarityProgressState>({
      visible: false,
      phase: 'idle',
      activeStep: null,
      percent: 0,
      stage: '',
      detail: '',
    });

  const candidateMap = React.useMemo(() => {
    const map = new Map<string, TemplateExtractCandidateDto>();

    for (const candidate of draftDetail?.candidates || []) {
      map.set(candidate.candidateKey, candidate);
    }

    reviewedFields.forEach((field, index) => {
      if (!field.candidateKey || map.has(field.candidateKey)) {
        return;
      }

      map.set(field.candidateKey, {
        id: `manual:${field.candidateKey}`,
        draftId: draftDetail?.draft.id || 'manual',
        candidateKey: field.candidateKey,
        fieldKey: field.fieldKey,
        labelKey: field.labelKey,
        fieldType: field.fieldType,
        fieldLabel: field.fieldLabel,
        detectedValue: stringifyTemplateDefaultValue(field.defaultValue),
        placeholder: field.placeholder || null,
        defaultValue: field.defaultValue ?? null,
        options: field.options || [],
        required: field.required ?? false,
        layoutBlockId: field.layoutBlockId || null,
        confidenceScore: 0.8,
        reviewStatus: field.reviewStatus || 'accepted',
        extractionReason: 'manual_frame_mapping',
        sortOrder: field.sortOrder ?? index,
      });
    });

    return map;
  }, [draftDetail, reviewedFields]);

  const candidateKeyByLabelKey = React.useMemo(() => {
    const map = new Map<string, string>();

    for (const candidate of draftDetail?.candidates || []) {
      map.set(candidate.labelKey, candidate.candidateKey);
    }

    reviewedFields.forEach((field) => {
      if (field.labelKey && field.candidateKey) {
        map.set(field.labelKey, field.candidateKey);
      }
    });

    return map;
  }, [draftDetail, reviewedFields]);

  const reviewedSummary = React.useMemo(() => {
    return reviewedFields.reduce(
      (summary, candidate) => {
        if (candidate.reviewStatus === 'accepted') {
          summary.accepted += 1;
        } else if (candidate.reviewStatus === 'rejected') {
          summary.rejected += 1;
        } else {
          summary.reviewNeeded += 1;
        }

        return summary;
      },
      { accepted: 0, reviewNeeded: 0, rejected: 0 }
    );
  }, [reviewedFields]);

  const registeredTemplateOptions = React.useMemo(
    () =>
      registeredTemplates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: template.id,
        keywords: [template.sourceDocumentName || ''],
      })),
    [registeredTemplates]
  );

  const flattenedFramePreview = React.useMemo(
    () => flattenFramePreviewMarkup(draftDetail?.draft.generatedDraftHtml || ''),
    [draftDetail?.draft.generatedDraftHtml]
  );
  const previewDraftStyleText = flattenedFramePreview?.styleText || '';
  const previewDraftHtml = flattenedFramePreview?.html || draftDetail?.draft.generatedDraftHtml || '';
  const previewDraftCopyHtml = `${previewDraftStyleText ? `<style>${previewDraftStyleText}</style>` : ''}${previewDraftHtml}`;
  const previewDraftBaseHtml = React.useMemo(
    () => stripFrameExtractedTextStateFromHtml(previewDraftCopyHtml),
    [previewDraftCopyHtml]
  );
  const initialFrameExtractedTextState = React.useMemo(
    () => collectFrameExtractedTextStateFromHtml(previewDraftCopyHtml),
    [previewDraftCopyHtml]
  );
  const frameExtractedTextStateSignature = React.useMemo(
    () => JSON.stringify(frameExtractedTextState),
    [frameExtractedTextState]
  );
  const renderedDraftHtml = React.useMemo(() => {
    const baseHtml = (frameRevision > 0 ? draftPreviewHtmlRef.current : previewDraftBaseHtml) || previewDraftBaseHtml;
    return applyFrameExtractedTextStateToHtml(baseHtml, frameExtractedTextState);
  }, [frameExtractedTextState, frameRevision, previewDraftBaseHtml]);
  const requestedFrameGroupVersion = React.useMemo(
    () => buildRequestedFrameGroupVersion(String(frameGroupVersion || 'v1.11'), frameProfileName),
    [frameGroupVersion, frameProfileName]
  );
  const currentFrameGroupVersionTag =
    flattenedFramePreview?.frameGroupVersion ||
    (draftDetail?.draft.generatedDraftHtml.match(/data-template-frame-group-version="([^"]+)"/i)?.[1] || '');
  const currentFrameProfileSourceSignature = React.useMemo(
    () => buildFrameSourceSignatureFromHtml(draftDetail?.draft.generatedDraftHtml || ''),
    [draftDetail?.draft.generatedDraftHtml]
  );
  const extractedTextReady = frameTextExtractionCompleted;
  const textExtractionReady =
    Boolean(draftDetail?.draft.generatedDraftHtml?.includes('data-template-extraction-stage="frames"')) &&
    hasSupportedFrameEditorMarkup(draftDetail?.draft.generatedDraftHtml);
  const crossValidationReady =
    textExtractionReady &&
    extractedTextReady &&
    Boolean(draftDetail) &&
    isPdfSourceFile(selectedFile);
  const frameEditorActive =
    Boolean(draftDetail?.draft.generatedDraftHtml?.includes('data-template-extraction-stage="frames"')) &&
    hasSupportedFrameEditorMarkup(draftDetail?.draft.generatedDraftHtml);

  React.useEffect(() => {
    if (!isV109FrameGroupVersion(frameGroupVersion)) {
      return;
    }

    if (frameProfileName.trim() && frameProfileName.trim() !== 'default') {
      return;
    }

    const suggestedName = sanitizeFrameProfileName(
      selectedFile?.name.replace(/\.[^.]+$/u, '') || sourceTitle || 'default'
    );

    if (suggestedName !== frameProfileName) {
      setFrameProfileName(suggestedName);
    }
  }, [frameGroupVersion, frameProfileName, selectedFile?.name, sourceTitle]);

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

  const persistRecentDraft = React.useCallback((detail: TemplateExtractDetailResult) => {
    const nextEntry = {
      id: detail.draft.id,
      label: detail.draft.sourceTitle || '제목 없는 초안',
      meta: detail.draft.id,
    };

    setRecentDrafts((previous) => {
      const nextDrafts = [nextEntry, ...previous.filter((item) => item.id !== nextEntry.id)].slice(0, 8);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts));
      }

      return nextDrafts;
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem(RECENT_DRAFTS_STORAGE_KEY);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as RecentDraftOption[];
      setRecentDrafts(Array.isArray(parsed) ? parsed : []);
    } catch {
      // ignore local storage parse errors
    }
  }, []);

  const loadRegisteredTemplates = React.useCallback(async () => {
    try {
      const response = await fetch('/api/templates?limit=12', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '등록된 템플릿 목록을 불러오지 못했습니다.');
      }

      const templates = (result.data || []) as TemplateRecordDto[];
      setRegisteredTemplates(templates);
      setSelectedRegisteredTemplateId((previous) => previous || templates[0]?.id || '');
    } catch {
      // template registry failures must not block extract flow
    }
  }, []);

  React.useEffect(() => {
    void loadRegisteredTemplates();
  }, [loadRegisteredTemplates]);

  const syncReviewedFields = React.useCallback((nextFields: TemplateExtractReviewedFieldInput[]) => {
    setReviewedFields(nextFields);
  }, []);

  const getCurrentDraftPreviewHtml = React.useCallback(() => {
    const liveHtml = draftPreviewRef.current?.innerHTML?.trim() || '';
    const normalizedLiveHtml = stripDraftPreviewUiState(liveHtml);
    const normalizedBaseLiveHtml = stripFrameExtractedTextStateFromHtml(normalizedLiveHtml);

    if (flattenedFramePreview && normalizedBaseLiveHtml) {
      return applyFrameExtractedTextStateToHtml(
        `${previewDraftStyleText ? `<style>${previewDraftStyleText}</style>` : ''}${normalizedBaseLiveHtml}`,
        frameExtractedTextState
      );
    }

    const fallbackHtml = draftPreviewHtmlRef.current || previewDraftBaseHtml;

    return applyFrameExtractedTextStateToHtml(
      stripFrameExtractedTextStateFromHtml(liveHtml || fallbackHtml),
      frameExtractedTextState
    );
  }, [flattenedFramePreview, frameExtractedTextState, previewDraftBaseHtml, previewDraftStyleText]);

  const syncDraftPreviewHtmlRef = React.useCallback(() => {
    const root = draftPreviewRef.current;

    if (!root) {
      return;
    }

    const normalizedHtml = stripFrameExtractedTextStateFromHtml(stripDraftPreviewUiState(root.innerHTML));
    draftPreviewHtmlRef.current = flattenedFramePreview
      ? `${previewDraftStyleText ? `<style>${previewDraftStyleText}</style>` : ''}${normalizedHtml}`
      : normalizedHtml;
    setFrameExtractedTextState((previous) => (Object.keys(previous).length > 0 ? {} : previous));
    setFrameTextExtractionCompleted(false);
    setFrameRevision((previous) => previous + 1);
  }, [flattenedFramePreview, previewDraftStyleText]);

  const syncV109ReviewedFieldsFromCurrentFrames = React.useCallback(() => {
    const root = draftPreviewRef.current;

    if (!root || !isV109FrameGroupVersion(currentFrameGroupVersionTag)) {
      return;
    }

    const nextFields = buildReviewedFieldsFromFrameNodes(
      Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)).filter(
        (node) => !node.matches('[data-template-frame-input="true"]')
      ),
      reviewedFields
    );

    if (JSON.stringify(nextFields) === JSON.stringify(reviewedFields)) {
      return;
    }

    syncReviewedFields(nextFields);
  }, [currentFrameGroupVersionTag, reviewedFields, syncReviewedFields]);

  const saveCurrentFrameProfile = React.useCallback(() => {
    const root = draftPreviewRef.current;

    if (!root || !isV109FrameGroupVersion(currentFrameGroupVersionTag)) {
      setFrameEditorNotice('v1.09/v1.10/v1.11 프레임 프로필에서만 저장할 수 있습니다.');
      return false;
    }

    const frames = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
      .filter((node) => !node.matches('[data-template-frame-input="true"]'))
      .map(readFrameNodeSnapshot)
      .map(stripFrameSnapshotText);

    if (!frames.length) {
      setFrameEditorNotice('저장할 프레임이 없습니다.');
      return false;
    }

    const profileName = sanitizeFrameProfileName(frameProfileName);
    const storedProfiles = readStoredFrameProfiles();
    storedProfiles[currentFrameGroupVersionTag] = {
      version: 1,
      frameGroupVersion: currentFrameGroupVersionTag,
      profileName,
      sourceSignature: currentFrameProfileSourceSignature,
      pageWidth: flattenedFramePreview?.pageWidth || '',
      pageMinHeight: flattenedFramePreview?.pageMinHeight || '',
      savedAt: new Date().toISOString(),
      frames,
    };
    writeStoredFrameProfiles(storedProfiles);
    setFrameEditorNotice(`프레임 프로필 ${profileName} 을 저장했습니다.`);
    return true;
  }, [
    currentFrameGroupVersionTag,
    currentFrameProfileSourceSignature,
    flattenedFramePreview?.pageMinHeight,
    flattenedFramePreview?.pageWidth,
    frameProfileName,
  ]);

  React.useEffect(() => {
    if (frameRevision === 0) {
      return;
    }

    syncV109ReviewedFieldsFromCurrentFrames();
  }, [frameRevision, syncV109ReviewedFieldsFromCurrentFrames]);

  React.useEffect(() => {
    draftPreviewHtmlRef.current = previewDraftBaseHtml;
    setFrameExtractedTextState(initialFrameExtractedTextState);
    setFrameTextExtractionCompleted(Object.keys(initialFrameExtractedTextState).length > 0);
    setFrameRevision(0);
    setSelectedFrameGroupIds([]);
    setFrameEditorValueKey('');
    setFrameEditorRole('group');
    setFrameEditorOutlineStyle('solid');
    setFrameEditorParentGroup('');
    setFrameEditorChainKey('');
    setFrameEditorChainDepth('');
    setFrameEditorWidthPx('');
    setFrameEditorHeightPx('');
    setFrameMergePromptDismissed(false);
    setFrameCreateMode(false);
    setFrameEditorNotice(null);
  }, [draftDetail?.draft.id, initialFrameExtractedTextState, previewDraftBaseHtml]);

  React.useEffect(() => {
    setCrossValidationPreview(null);
    setCrossValidationReferenceVisible(false);
    setCrossValidationPageIndex(0);
  }, [
    draftDetail?.draft.id,
    selectedFile?.name,
    selectedFile?.size,
    selectedFile?.lastModified,
    frameRevision,
    frameExtractedTextStateSignature,
  ]);

  React.useEffect(() => {
    appliedFrameProfileKeyRef.current = '';
  }, [draftDetail?.draft.id, currentFrameGroupVersionTag, currentFrameProfileSourceSignature]);

  React.useEffect(() => {
    if (!frameEditorActive || !isV109FrameGroupVersion(currentFrameGroupVersionTag)) {
      return;
    }

    syncV109ReviewedFieldsFromCurrentFrames();
  }, [
    currentFrameGroupVersionTag,
    frameEditorActive,
    frameExtractedTextStateSignature,
    syncV109ReviewedFieldsFromCurrentFrames,
  ]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const styleId = 'template-extract-draft-preview-frame-style';
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
    const availableCandidateKey = reviewedFields.find((field) => field.candidateKey)?.candidateKey || null;

    if (!availableCandidateKey) {
      setSelectedCandidateKey(null);
      return;
    }

    if (
      selectedCandidateKey &&
      reviewedFields.some((field) => field.candidateKey === selectedCandidateKey)
    ) {
      return;
    }

    setSelectedCandidateKey(availableCandidateKey);
  }, [reviewedFields, selectedCandidateKey]);

  React.useEffect(() => {
    const root = draftPreviewRef.current;

    if (!root) {
      return;
    }

    root.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
      element.removeAttribute('data-template-selected');
    });

    const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)).filter(
      (node) => !node.matches('[data-template-frame-input="true"]')
    );

    if (frameNodes.length > 0) {
      applyFrameSelectionHighlight(root, selectedFrameGroupIds);
      return;
    }

    const selectedField = reviewedFields.find((field) => field.candidateKey === selectedCandidateKey);

    if (!selectedField?.labelKey) {
      return;
    }

    findTemplateValueElements(root, selectedField.labelKey).forEach((element) => {
      element.setAttribute('data-template-selected', 'true');
    });
  }, [draftDetail?.draft.generatedDraftHtml, reviewedFields, selectedCandidateKey, selectedFrameGroupIds]);

  React.useEffect(() => {
    const root = draftPreviewRef.current;

    if (!root) {
      return;
    }

    applyDraftPreviewEditPermissions(root, draftPreviewEditRole);
  }, [draftDetail?.draft.generatedDraftHtml, draftPreviewEditRole]);

  const syncFrameEditorSelectionState = React.useCallback(() => {
    const root = draftPreviewRef.current;

    if (!root || selectedFrameGroupIds.length === 0) {
      setFrameEditorValueKey('');
      setFrameEditorRole('group');
      setFrameEditorOutlineStyle('solid');
      setFrameEditorParentGroup('');
      setFrameEditorChainKey('');
      setFrameEditorChainDepth('');
      setFrameEditorWidthPx('');
      setFrameEditorHeightPx('');
      return;
    }

    const selectedNode = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
      .filter((node) => !node.matches('[data-template-frame-input="true"]'))
      .find(
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
    setFrameEditorOutlineStyle(
      normalizeFrameOutlineStyle(selectedNode.getAttribute('data-template-frame-outline-style'))
    );
    setFrameEditorParentGroup(selectedNode.getAttribute('data-template-frame-parent-group') || '');
    setFrameEditorChainKey(selectedNode.getAttribute('data-template-frame-chain-key') || '');
    setFrameEditorChainDepth(selectedNode.getAttribute('data-template-frame-chain-depth') || '');
    setFrameEditorWidthPx(String(Math.round(rect.width)));
    setFrameEditorHeightPx(String(Math.round(rect.height)));
  }, [selectedFrameGroupIds]);

  React.useEffect(() => {
    syncFrameEditorSelectionState();
  }, [syncFrameEditorSelectionState]);

  React.useLayoutEffect(() => {
    const root = draftPreviewRef.current;

    if (!root || selectedFrameGroupIds.length === 0) {
      return;
    }

    const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)).filter(
      (node) => !node.matches('[data-template-frame-input="true"]')
    );

    if (frameNodes.length > 0) {
      applyFrameSelectionHighlight(root, selectedFrameGroupIds);
    }
  }, [
    draftDetail?.draft.generatedDraftHtml,
    frameEditorChainDepth,
    frameEditorChainKey,
    frameEditorHeightPx,
    frameEditorParentGroup,
    frameEditorRole,
    frameEditorValueKey,
    frameEditorWidthPx,
    selectedFrameGroupIds,
  ]);

  React.useEffect(() => {
    if (selectedFrameGroupIds.length <= 1) {
      setFrameMergePromptDismissed(false);
    }
  }, [selectedFrameGroupIds]);

  const clearDraftProgressTimer = React.useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearDraftProgressTimer(), [clearDraftProgressTimer]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const html = draftDetail?.draft.generatedDraftHtml?.trim() || '';
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
  }, [draftDetail?.draft.generatedDraftHtml]);

  const clearVisualSimilarityProgressTimer = React.useCallback(() => {
    if (visualProgressTimerRef.current !== null) {
      window.clearInterval(visualProgressTimerRef.current);
      visualProgressTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => clearVisualSimilarityProgressTimer(),
    [clearVisualSimilarityProgressTimer]
  );

  const updateDraftProgress = React.useCallback(
    (patch: Partial<DraftCreateProgressState>) => {
      setDraftProgress((previous) => ({
        ...previous,
        ...patch,
      }));
    },
    []
  );

  const updateVisualSimilarityProgress = React.useCallback(
    (patch: Partial<VisualSimilarityProgressState>) => {
      setVisualSimilarityProgress((previous) => ({
        ...previous,
        ...patch,
      }));
    },
    []
  );

  const postVisualMeasurementLog = React.useCallback(
    async (body: Record<string, unknown>) => {
      const fileName = visualMeasurementLogFileNameRef.current.trim();

      if (!fileName) {
        return;
      }

      try {
        await fetch('/api/templates/extract/measure/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            fileName,
          }),
        });
      } catch {
        // measurement logging must never block the main flow
      }
    },
    []
  );

  const appendVisualMeasurementLog = React.useCallback(
    async (input: {
      level?: 'info' | 'warn' | 'error';
      phase: string;
      percent?: number | null;
      stage?: string | null;
      detail?: string | null;
      payload?: unknown;
      force?: boolean;
    }) => {
      const eventKey = JSON.stringify([
        input.level || 'info',
        input.phase,
        input.percent ?? null,
        input.stage || '',
        input.detail || '',
      ]);

      if (!input.force && lastVisualMeasurementLogEventKeyRef.current === eventKey) {
        return;
      }

      lastVisualMeasurementLogEventKeyRef.current = eventKey;
      await postVisualMeasurementLog({
        action: 'append',
        level: input.level || 'info',
        phase: input.phase,
        percent: input.percent ?? null,
        stage: input.stage ?? null,
        detail: input.detail ?? null,
        payload: input.payload,
      });
    },
    [postVisualMeasurementLog]
  );

  const startVisualMeasurementLog = React.useCallback(
    async (input: {
      draftId?: string | null;
      sourceTitle?: string | null;
      sourceFileName?: string | null;
      engineVersion?: TemplateExtractEngineVersion | 'unknown' | null;
    }) => {
      lastVisualMeasurementLogEventKeyRef.current = '';

      try {
        const response = await fetch('/api/templates/extract/measure/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            draftId: input.draftId || null,
            sourceTitle: input.sourceTitle || null,
            sourceFileName: input.sourceFileName || null,
            engineVersion: input.engineVersion || 'unknown',
          }),
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '시각 유사도 로그 세션을 시작하지 못했습니다.');
        }

        visualMeasurementLogFileNameRef.current = String(result.data?.fileName || '').trim();
      } catch {
        visualMeasurementLogFileNameRef.current = '';
      }
    },
    []
  );

  const beginProcessingProgress = React.useCallback(
    (startPercent: number, stage: string, detail: string) => {
      clearDraftProgressTimer();
      setDraftProgress({
        visible: true,
        phase: 'processing',
        percent: startPercent,
        stage,
        detail,
      });

      progressTimerRef.current = window.setInterval(() => {
        setDraftProgress((previous) => {
          if (previous.phase !== 'processing') {
            return previous;
          }

          const ceiling = previous.percent < 80 ? 86 : 94;
          const step = previous.percent < 55 ? 4 : previous.percent < 75 ? 2 : 1;
          const nextPercent = Math.min(previous.percent + step, ceiling);

          if (nextPercent === previous.percent) {
            return previous;
          }

          return {
            ...previous,
            percent: nextPercent,
          };
        });
      }, 420);
    },
    [clearDraftProgressTimer]
  );

  const beginVisualSimilarityServerProgress = React.useCallback(
    (startPercent: number, stage: string, detail: string) => {
      clearVisualSimilarityProgressTimer();
      setVisualSimilarityProgress({
        visible: true,
        phase: 'rendering_pdf',
        activeStep: 'rendering_pdf',
        percent: startPercent,
        stage,
        detail,
      });

      visualProgressTimerRef.current = window.setInterval(() => {
        setVisualSimilarityProgress((previous) => {
          if (previous.phase !== 'rendering_pdf' && previous.phase !== 'rendering_html') {
            return previous;
          }

          const nextPercent = Math.min(previous.percent + 2, 66);

          if (nextPercent === previous.percent) {
            return previous;
          }

          const nextActiveStep = nextPercent >= 52 ? 'rendering_html' : 'rendering_pdf';

          return {
            ...previous,
            phase: nextActiveStep,
            activeStep: nextActiveStep,
            percent: nextPercent,
            stage:
              nextActiveStep === 'rendering_pdf'
                ? '서버에서 PDF 페이지 PNG를 만들고 있습니다.'
                : '서버에서 output HTML 페이지 PNG를 만들고 있습니다.',
            detail:
              nextActiveStep === 'rendering_pdf'
                ? '원본 PDF를 페이지 단위 이미지로 렌더하고 있습니다.'
                : 'Headless Chrome 으로 output HTML을 페이지 단위 이미지로 렌더하고 있습니다.',
          };
        });
      }, 380);
    },
    [clearVisualSimilarityProgressTimer]
  );

  const createDraftWithFileUpload = React.useCallback(
    (formData: FormData, extractionStage: TemplateExtractExtractionStage = 'full') =>
      new Promise<{ success: boolean; data?: TemplateExtractDetailResult; message?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('POST', '/api/templates/extract');
        xhr.responseType = 'text';

        xhr.upload.onprogress = (event) => {
          const uploadRatio = event.lengthComputable && event.total > 0 ? event.loaded / event.total : 0.7;
          const uploadPercent = Math.max(4, Math.min(Math.round(uploadRatio * 58), 58));

          updateDraftProgress({
            visible: true,
            phase: 'uploading',
            percent: uploadPercent,
            stage: '파일을 업로드하고 있습니다.',
            detail: event.lengthComputable
              ? `업로드 ${Math.round(uploadRatio * 100)}%`
              : '브라우저에서 서버로 파일을 전송하고 있습니다.',
          });
        };

        xhr.onerror = () => {
          reject(new Error('추출 초안 생성 요청을 서버로 보내지 못했습니다.'));
        };

        xhr.onload = () => {
          beginProcessingProgress(
            62,
            extractionStage === 'frames' ? '프레임 그룹을 분석하고 있습니다.' : '문서를 분석하고 있습니다.',
            extractionStage === 'frames'
              ? '원본 PDF에서 프레임 그룹 구조만 먼저 추출하고 있습니다.'
              : '원본 문서를 읽고 템플릿 초안과 추천 항목을 조립하고 있습니다.'
          );

          try {
            const parsed = JSON.parse(xhr.responseText || '{}') as {
              success?: boolean;
              data?: TemplateExtractDetailResult;
              message?: string;
            };

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({
                success: Boolean(parsed.success),
                data: parsed.data,
                message: parsed.message,
              });
              return;
            }

            reject(new Error(parsed.message || '추출 초안 생성에 실패했습니다.'));
          } catch {
            reject(new Error('추출 초안 응답을 해석하지 못했습니다.'));
          }
        };

        xhr.send(formData);
      }),
    [beginProcessingProgress, updateDraftProgress]
  );

  const loadDraft = React.useCallback(
    async (draftId: string) => {
      const normalizedDraftId = draftId.trim();

      if (!normalizedDraftId) {
        setDraftDetail(null);
        syncReviewedFields([]);
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/templates/extract/${normalizedDraftId}?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '추출 초안 조회에 실패했습니다.');
        }

        setDraftDetail(result.data);
        setLoadedTemplateId(null);
        setPreviewPaneMode('draft');
        setSelectedDraftId(normalizedDraftId);
        syncReviewedFields(toReviewedFields(result.data));
        persistRecentDraft(result.data);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '추출 초안 조회에 실패했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    [persistRecentDraft, syncReviewedFields]
  );

  const loadRegisteredTemplate = React.useCallback(
    async (templateId: string) => {
      const normalizedTemplateId = templateId.trim();

      if (!normalizedTemplateId) {
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/templates/${normalizedTemplateId}?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '정식 템플릿 조회에 실패했습니다.');
        }

        const templateDetail = result.data as TemplateDetailResult;
        const extractDetail = toTemplateExtractDetailFromTemplate(templateDetail);

        setDraftDetail(extractDetail);
        setLoadedTemplateId(normalizedTemplateId);
        setSelectedRegisteredTemplateId(normalizedTemplateId);
        setSelectedDraftId('');
        setPreviewPaneMode('draft');
        setTemplateName(templateDetail.template.templateName);
        setSourceTitle(templateDetail.template.templateName);
        setSourceContent(templateDetail.template.draftHtml);
        syncReviewedFields(toReviewedFields(extractDetail));
        setApproveResult(null);
        setVisualSimilarityReport(null);
        setMessage(`정식 템플릿 ${normalizedTemplateId} 를 불러왔습니다.`);
      } catch (error) {
        const nextMessage =
          error instanceof Error ? error.message : '정식 템플릿 조회에 실패했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    [syncReviewedFields]
  );

  const handleSaveRegisteredTemplate = React.useCallback(async () => {
    const normalizedTemplateId = loadedTemplateId?.trim() || '';

    if (!normalizedTemplateId) {
      setMessage('저장할 정식 템플릿이 없습니다.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isV109FrameGroupVersion(currentFrameGroupVersionTag)) {
        saveCurrentFrameProfile();
      }

      const response = await fetch(`/api/templates/${normalizedTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          sourceDocumentName: sourceTitle,
          draftHtml: getCurrentDraftPreviewHtml(),
          layoutResizeMode,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '정식 템플릿 저장에 실패했습니다.');
      }

      const updatedTemplate = (result.data?.template || null) as TemplateRecordDto | null;

      if (updatedTemplate) {
        setRegisteredTemplates((previous) =>
          [updatedTemplate, ...previous.filter((item) => item.id !== updatedTemplate.id)].slice(0, 12)
        );
      }

      setMessage(`정식 템플릿 ${normalizedTemplateId} 저장을 완료했습니다.`);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '정식 템플릿 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [
    currentFrameGroupVersionTag,
    getCurrentDraftPreviewHtml,
    layoutResizeMode,
    loadedTemplateId,
    saveCurrentFrameProfile,
    sourceTitle,
    templateName,
  ]);

  const handleDeleteRegisteredTemplate = React.useCallback(async (templateId?: string) => {
    const normalizedTemplateId = (templateId || selectedRegisteredTemplateId).trim();

    if (!normalizedTemplateId || typeof window === 'undefined') {
      return;
    }

    const confirmed = window.confirm(
      `정식 템플릿 ${normalizedTemplateId} 를 삭제합니다. 필드와 서명 영역도 함께 삭제됩니다.`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/${normalizedTemplateId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '정식 템플릿 삭제에 실패했습니다.');
      }

      const nextTemplates = registeredTemplates.filter((template) => template.id !== normalizedTemplateId);
      setRegisteredTemplates(nextTemplates);
      setSelectedRegisteredTemplateId((previous) =>
        previous === normalizedTemplateId ? nextTemplates[0]?.id || '' : previous
      );

      if (loadedTemplateId === normalizedTemplateId) {
        setLoadedTemplateId(null);
        setDraftDetail(null);
        setSelectedDraftId('');
        syncReviewedFields([]);
        setPreviewPaneMode('source');
        setApproveResult(null);
        setVisualSimilarityReport(null);
      }

      setMessage(`정식 템플릿 ${normalizedTemplateId} 를 삭제했습니다.`);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '정식 템플릿 삭제에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [
    loadedTemplateId,
    registeredTemplates,
    selectedRegisteredTemplateId,
    syncReviewedFields,
  ]);

  const handleDeleteRecentDraft = React.useCallback((draft: { id: string }) => {
    const normalizedDraftId = draft.id.trim();

    if (!normalizedDraftId) {
      return;
    }

    setRecentDrafts((previous) => {
      const nextDrafts = previous.filter((item) => item.id !== normalizedDraftId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts));
      }

      return nextDrafts;
    });
    setSelectedDraftId((previous) => (previous === normalizedDraftId ? '' : previous));
  }, []);

  const handleCreateDraft = async (extractionStage: TemplateExtractExtractionStage = 'full') => {
    if (extractionStage === 'frames' && !selectedFile) {
      setMessage('프레임 그룹 생성은 PDF 업로드에서만 지원합니다.');
      return;
    }

    const frameStage = extractionStage === 'frames';
    setLoading(true);
    setMessage(null);
    setApproveResult(null);
    setVisualSimilarityReport(null);
    setDraftProgressAction(extractionStage);
    setProgressPanelExpanded(true);
    clearDraftProgressTimer();
    clearVisualSimilarityProgressTimer();
    setVisualSimilarityProgress({
      visible: false,
      phase: 'idle',
      activeStep: null,
      percent: 0,
      stage: '',
      detail: '',
    });
    visualMeasurementLogFileNameRef.current = '';
    lastVisualMeasurementLogEventKeyRef.current = '';
    lastVisualMeasurementKeyRef.current = '';
    setDraftProgress({
      visible: true,
      phase: selectedFile ? 'uploading' : 'processing',
      percent: selectedFile ? 4 : 12,
      stage: selectedFile
        ? frameStage
          ? 'PDF를 업로드하고 프레임 그룹을 준비하고 있습니다.'
          : '파일을 업로드하고 있습니다.'
        : '문서를 준비하고 있습니다.',
      detail: selectedFile
        ? frameStage
          ? '브라우저에서 서버로 PDF를 전송한 뒤 프레임 그룹만 먼저 추출합니다.'
          : '브라우저에서 서버로 파일을 전송합니다.'
        : '붙여 넣은 원본 본문을 읽어 템플릿 초안을 준비합니다.',
    });

    try {
      const similarTemplateIds = similarTemplateIdsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      let result;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('sourceTitle', sourceTitle);
        formData.append('similarTemplateIds', similarTemplateIds.join(','));
        formData.append('engineVersion', engineVersion);
        formData.append('extractionStage', extractionStage);
        formData.append('frameGroupVersion', requestedFrameGroupVersion);
        formData.append('file', selectedFile);

        result = await createDraftWithFileUpload(formData, extractionStage);
      } else {
        beginProcessingProgress(
          22,
          frameStage ? '프레임 그룹을 분석하고 있습니다.' : '문서를 분석하고 있습니다.',
          frameStage
            ? '원본 본문에서 프레임 그룹 구조만 분리하고 있습니다.'
            : '원본 본문을 읽고 템플릿 초안과 추천 항목을 조립하고 있습니다.'
        );
        const response = await fetch('/api/templates/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTitle,
            sourceKind,
            sourceContent,
            similarTemplateIds,
            engineVersion,
            extractionStage,
            frameGroupVersion: requestedFrameGroupVersion,
          }),
        });
        result = await response.json();
      }

      if (!result.success) {
        throw new Error(result.message || '추출 초안 생성에 실패했습니다.');
      }

      clearDraftProgressTimer();
      setDraftProgress({
        visible: true,
        phase: 'completed',
        percent: 100,
        stage: frameStage ? '프레임 그룹 생성을 완료했습니다.' : '초안 생성을 완료했습니다.',
        detail: frameStage
          ? '원본 문서에서 프레임 그룹만 먼저 분리했습니다.'
          : '원본 문서를 읽어 템플릿 초안과 추천 항목을 만들었습니다.',
      });
      setDraftDetail(result.data);
      setLoadedTemplateId(null);
      setPreviewPaneMode('draft');
      setSelectedDraftId(result.data.draft.id);
      syncReviewedFields(toReviewedFields(result.data));
      persistRecentDraft(result.data);
      const actualExtractionStage =
        result.data?.pipelineTrace?.extractionStage === 'frames' ? 'frames' : extractionStage;
      const versionLabel = formatTemplateExtractEngineVersionLabel(engineVersion);
      setMessage(
        actualExtractionStage === 'frames'
          ? `프레임 그룹 초안을 만들었습니다. (${requestedFrameGroupVersion}, ${versionLabel})`
          : `원본 문서를 읽어 템플릿 초안과 추천 항목을 만들었습니다. (${versionLabel})`
      );
    } catch (error) {
      clearDraftProgressTimer();
      setDraftProgress((previous) => ({
        visible: true,
        phase: 'failed',
        percent: Math.max(previous.percent, 18),
        stage: '초안 생성이 중단되었습니다.',
        detail: error instanceof Error ? error.message : '추출 초안 생성에 실패했습니다.',
      }));
      const nextMessage = error instanceof Error ? error.message : '추출 초안 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    const normalizedDraftId = selectedDraftId.trim();

    if (!normalizedDraftId) {
      setMessage('승인할 초안을 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isV109FrameGroupVersion(currentFrameGroupVersionTag)) {
        saveCurrentFrameProfile();
      }

      const response = await fetch(`/api/templates/extract/${normalizedDraftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          layoutResizeMode,
          reviewedFields,
          generatedDraftHtml: getCurrentDraftPreviewHtml(),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '정식 템플릿 승인에 실패했습니다.');
      }

      setApproveResult(result.data);
      setMessage(
        `정식 템플릿 ${result.data.templateId} 생성 완료. 승인 ${result.data.approvedFieldCount}개, 제외 ${result.data.skippedFieldCount}개`
      );
      await loadDraft(normalizedDraftId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '정식 템플릿 승인에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDraftHtml = async () => {
    const html = getCurrentDraftPreviewHtml().trim();

    if (!html) {
      setMessage('복사할 생성 HTML이 없습니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(html);
      setDraftHtmlCopied(true);
      window.setTimeout(() => setDraftHtmlCopied(false), 1800);
    } catch {
      setMessage('HTML을 복사하지 못했습니다.');
    }
  };

  const handleCopyDraftLog = async () => {
    const normalizedDraftId = draftDetail?.draft.id?.trim() || '';

    if (!normalizedDraftId || !draftDetail) {
      setMessage('로그를 저장할 초안이 없습니다.');
      return;
    }

    setDraftLogWriting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/extract/${normalizedDraftId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTitle: draftDetail.draft.sourceTitle,
          sourceKind: draftDetail.draft.sourceKind,
          sourceContent: draftDetail.draft.sourceContent,
          generatedDraftHtml: getCurrentDraftPreviewHtml(),
          engineVersion: pipelineTrace?.engineVersion || engineVersion,
          pipelineTrace,
          qualityReport,
          visualSimilarityReport,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '로그 저장에 실패했습니다.');
      }

      const filePath = String(result.data?.filePath || '').trim();

      if (filePath) {
        try {
          await navigator.clipboard.writeText(filePath);
          setMessage(`로그 파일을 저장했고 경로를 클립보드에 복사했습니다. ${filePath}`);
        } catch {
          setMessage(`로그 파일을 저장했습니다. ${filePath}`);
        }
        return;
      }

      setMessage('로그 파일을 저장했습니다.');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '로그 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setDraftLogWriting(false);
    }
  };

  const requestVisualSimilarityRenderInputs = React.useCallback(
    (file: File, html: string) =>
      new Promise<{ pdfPageDataUrls: string[]; replicaPageDataUrls: string[] }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('html', html);
        if (visualMeasurementLogFileNameRef.current.trim()) {
          formData.append('measurementLogFileName', visualMeasurementLogFileNameRef.current.trim());
        }

        xhr.open('POST', '/api/templates/extract/measure');
        xhr.responseType = 'text';

        xhr.upload.onloadstart = () => {
          updateVisualSimilarityProgress({
            visible: true,
            phase: 'uploading',
            activeStep: 'uploading',
            percent: 4,
            stage: '원본 PDF를 측정 서버로 업로드하고 있습니다.',
            detail: '시각 유사도 측정을 위해 브라우저에서 PDF를 전송합니다.',
          });
          void appendVisualMeasurementLog({
            phase: 'uploading',
            percent: 4,
            stage: '원본 PDF 업로드를 시작했습니다.',
            detail: file.name,
            payload: {
              fileName: file.name,
              fileType: file.type || 'application/pdf',
              fileSize: file.size,
            },
          });
        };

        xhr.upload.onprogress = (event) => {
          const uploadRatio = event.lengthComputable && event.total > 0 ? event.loaded / event.total : 0.6;
          const uploadPercent = Math.max(4, Math.min(Math.round(uploadRatio * 18), 18));
          const detail = event.lengthComputable
            ? `업로드 ${Math.round(uploadRatio * 100)}%`
            : '브라우저에서 서버로 측정용 PDF를 전송하고 있습니다.';

          updateVisualSimilarityProgress({
            visible: true,
            phase: 'uploading',
            activeStep: 'uploading',
            percent: uploadPercent,
            stage: '원본 PDF를 측정 서버로 업로드하고 있습니다.',
            detail,
          });
          void appendVisualMeasurementLog({
            phase: 'uploading',
            percent: uploadPercent,
            stage: '원본 PDF를 측정 서버로 업로드하고 있습니다.',
            detail,
          });
        };

        xhr.upload.onloadend = () => {
          beginVisualSimilarityServerProgress(
            22,
            '서버에서 PDF와 HTML 페이지 PNG를 만들고 있습니다.',
            '원본 PDF와 output HTML을 각각 실제 렌더 이미지로 만든 뒤 브라우저 비교 단계로 넘깁니다.'
          );
          void appendVisualMeasurementLog({
            phase: 'rendering_pdf',
            percent: 22,
            stage: '서버 PDF/HTML 렌더 대기',
            detail: '업로드가 끝나 서버에서 PDF PNG와 HTML PNG 생성을 시작합니다.',
          });
        };

        xhr.onerror = () => {
          reject(new Error('시각 유사도 측정 요청을 서버로 보내지 못했습니다.'));
        };

        xhr.onload = () => {
          clearVisualSimilarityProgressTimer();

          try {
            const parsed = JSON.parse(xhr.responseText || '{}') as {
              success?: boolean;
              data?: {
                pageImages?: string[];
                replicaPageImages?: string[];
              };
              message?: string;
            };

            if (!(xhr.status >= 200 && xhr.status < 300 && parsed.success)) {
              reject(new Error(parsed.message || 'PDF/HTML 렌더 이미지를 생성하지 못했습니다.'));
              return;
            }

            const nextPageImages = parsed.data?.pageImages;
            const nextReplicaPageImages = parsed.data?.replicaPageImages;
            const pageImages = Array.isArray(nextPageImages) ? nextPageImages : [];
            const replicaPageImages = Array.isArray(nextReplicaPageImages) ? nextReplicaPageImages : [];

            if (pageImages.length === 0) {
              reject(new Error('PDF 페이지 이미지를 생성하지 못했습니다.'));
              return;
            }

            if (replicaPageImages.length === 0) {
              reject(new Error('HTML 페이지 이미지를 생성하지 못했습니다.'));
              return;
            }

            updateVisualSimilarityProgress({
              visible: true,
              phase: 'preparing_pdf_pages',
              activeStep: 'preparing_pdf_pages',
              percent: 42,
              stage: 'PDF/HTML 페이지 PNG를 브라우저 비교 입력으로 넘겼습니다.',
              detail: `PDF ${pageImages.length}개, HTML ${replicaPageImages.length}개 페이지 이미지를 브라우저 canvas 비교 단계로 넘깁니다.`,
            });
            void appendVisualMeasurementLog({
              phase: 'preparing_pdf_pages',
              percent: 42,
              stage: 'PDF/HTML 페이지 PNG를 브라우저 비교 입력으로 넘겼습니다.',
              detail: `PDF ${pageImages.length}개, HTML ${replicaPageImages.length}개 페이지 이미지를 브라우저 canvas 비교 단계로 넘깁니다.`,
              payload: {
                sourcePageCount: pageImages.length,
                replicaPageCount: replicaPageImages.length,
              },
            });
            resolve({
              pdfPageDataUrls: pageImages,
              replicaPageDataUrls: replicaPageImages,
            });
          } catch {
            reject(new Error('시각 유사도 측정 응답을 해석하지 못했습니다.'));
          }
        };

        xhr.send(formData);
      }),
    [
      appendVisualMeasurementLog,
      beginVisualSimilarityServerProgress,
      clearVisualSimilarityProgressTimer,
      updateVisualSimilarityProgress
    ]
  );

  const handleMeasureVisualSimilarity = React.useCallback(async () => {
    if (!selectedFile) {
      setMessage('교차 검증을 하려면 원본 PDF 파일이 필요합니다.');
      return;
    }

    if (!draftDetail || draftDetail.draft.sourceKind !== 'html') {
      setMessage('교차 검증할 HTML 초안이 없습니다.');
      return;
    }

    if (!isPdfSourceFile(selectedFile)) {
      setMessage('교차 검증은 PDF 업로드에 대해서만 지원합니다.');
      return;
    }

    if (!crossValidationReady) {
      setMessage('교차 검증은 프레임 그룹 생성 후 텍스트 추출을 완료한 뒤에 실행할 수 있습니다.');
      return;
    }

    const sourceHtml = getCurrentDraftPreviewHtml() || draftDetail.draft.sourceContent.trim();
    const measurementKey = [
      draftDetail.draft.id,
      selectedFile.name,
      selectedFile.size,
      selectedFile.lastModified,
    ].join('::');

    if (!sourceHtml) {
      setMessage('교차 검증할 output HTML이 없습니다.');
      return;
    }

    setVisualSimilarityMeasuring(true);
    setVisualSimilarityReport(null);
    setMessage(null);
    setProgressPanelExpanded(true);
    clearVisualSimilarityProgressTimer();
    setVisualSimilarityProgress({
      visible: true,
      phase: 'uploading',
      activeStep: 'uploading',
      percent: 2,
      stage: '교차 검증을 준비하고 있습니다.',
      detail: '원본 PDF와 output HTML을 같은 기준으로 비교하기 위한 입력을 준비합니다.',
    });
    lastVisualMeasurementKeyRef.current = measurementKey;

    try {
      await startVisualMeasurementLog({
        draftId: draftDetail.draft.id,
        sourceTitle: draftDetail.draft.sourceTitle || null,
        sourceFileName: selectedFile.name,
        engineVersion: pipelineTrace?.engineVersion || engineVersion,
      });
      await appendVisualMeasurementLog({
        phase: 'prepare',
        percent: 2,
        stage: '시각 유사도 측정 준비',
        detail: '원본 PDF와 output HTML 비교 세션을 시작했습니다.',
        payload: {
          draftId: draftDetail.draft.id,
          sourceTitle: draftDetail.draft.sourceTitle || null,
          sourceFileName: selectedFile.name,
        },
        force: true,
      });

      const { pdfPageDataUrls, replicaPageDataUrls } = await requestVisualSimilarityRenderInputs(
        selectedFile,
        sourceHtml
      );
      setCrossValidationPreview({
        pdfPageDataUrls,
        replicaPageDataUrls,
        createdAt: new Date().toISOString(),
      });
      setCrossValidationReferenceVisible(true);
      setCrossValidationPageIndex(0);
      const framePages = buildCrossValidationFramePages();

      const report = await TemplateExtractVisualSimilarityClient.measureRenderedPageImages({
        pdfPageDataUrls,
        replicaPageDataUrls,
        framePages,
        onProgress: (progress) => {
          const activeStep = toVisualSimilarityStepKey(progress.phase);
          updateVisualSimilarityProgress({
            visible: true,
            phase: activeStep,
            activeStep,
            percent: progress.percent,
            stage: progress.stage,
            detail: progress.detail,
          });
          void appendVisualMeasurementLog({
            phase: progress.phase,
            percent: progress.percent,
            stage: progress.stage,
            detail: progress.detail,
          });
        },
      });

      clearVisualSimilarityProgressTimer();
      setVisualSimilarityProgress({
        visible: true,
        phase: 'completed',
        activeStep: 'aggregating',
        percent: 100,
        stage: '시각 유사도 측정을 완료했습니다.',
        detail: `PDF와 HTML의 1px 허용 오차 기준 프레임 중첩률 ${formatPercent(report.frameScore ?? report.overallScore)} 를 계산했습니다.`,
      });
      setVisualSimilarityReport(report);
      await postVisualMeasurementLog({
        action: 'finalize',
        status: 'completed',
        summary: `1px 허용 오차 기준 프레임 중첩률 ${formatPercent(report.frameScore ?? report.overallScore)}`,
        visualSimilarityReport: report,
      });
      setMessage(`교차 검증을 완료했습니다. 프레임 기준 ${formatPercent(report.frameScore ?? report.overallScore)}`);
    } catch (error) {
      setVisualSimilarityReport(null);
      clearVisualSimilarityProgressTimer();
      const nextMessage = error instanceof Error ? error.message : '교차 검증에 실패했습니다.';
      setVisualSimilarityProgress((previous) => ({
        visible: true,
        phase: 'failed',
        activeStep: previous.activeStep || 'uploading',
        percent: Math.max(previous.percent, 12),
        stage: '교차 검증이 중단되었습니다.',
        detail: nextMessage,
      }));
      await appendVisualMeasurementLog({
        level: 'error',
        phase: 'failed',
        percent: null,
        stage: '시각 유사도 측정 실패',
        detail: nextMessage,
        force: true,
      });
      await postVisualMeasurementLog({
        action: 'finalize',
        status: 'failed',
        errorMessage: nextMessage,
        summary: '시각 유사도 측정이 실패했습니다.',
      });
      setMessage(nextMessage);
    } finally {
      setVisualSimilarityMeasuring(false);
    }
  }, [
    appendVisualMeasurementLog,
    clearVisualSimilarityProgressTimer,
    crossValidationReady,
    draftDetail,
    engineVersion,
    frameGroupVersion,
    getCurrentDraftPreviewHtml,
    postVisualMeasurementLog,
    requestVisualSimilarityRenderInputs,
    selectedFile,
    buildCrossValidationFramePages,
    updateVisualSimilarityProgress,
    startVisualMeasurementLog,
  ]);

  React.useEffect(() => {
    const isEligible =
      !!selectedFile &&
      !!draftDetail &&
      draftDetail.draft.sourceKind === 'html' &&
      (/\.pdf$/i.test(selectedFile.name) || selectedFile.type === 'application/pdf');

    if (isEligible) {
      const measurementKey = [
        draftDetail.draft.id,
        selectedFile.name,
        selectedFile.size,
        selectedFile.lastModified,
      ].join('::');

      if (lastVisualMeasurementKeyRef.current !== measurementKey) {
        setVisualSimilarityReport(null);
        clearVisualSimilarityProgressTimer();
        visualMeasurementLogFileNameRef.current = '';
        lastVisualMeasurementLogEventKeyRef.current = '';
        setVisualSimilarityProgress({
          visible: false,
          phase: 'idle',
          activeStep: null,
          percent: 0,
          stage: '',
          detail: '',
        });
      }

      return;
    }

    setVisualSimilarityReport(null);
    clearVisualSimilarityProgressTimer();
    visualMeasurementLogFileNameRef.current = '';
    lastVisualMeasurementLogEventKeyRef.current = '';
    setVisualSimilarityProgress({
      visible: false,
      phase: 'idle',
      activeStep: null,
      percent: 0,
      stage: '',
      detail: '',
    });
    lastVisualMeasurementKeyRef.current = '';
  }, [clearVisualSimilarityProgressTimer, draftDetail, selectedFile]);

  const updateReviewedField = (
    candidateKey: string | undefined,
    patch: Partial<TemplateExtractReviewedFieldInput>
  ) => {
    syncReviewedFields(
      reviewedFields.map((field) =>
        field.candidateKey === candidateKey
          ? {
              ...field,
              ...patch,
            }
          : field
      )
    );
  };

  const requestPreviewTextFit = React.useCallback(() => {
    const root = draftPreviewRef.current;

    if (!root || typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      applyTemplateExtractEditableTextFit(root);
    });
  }, []);

  const loadImageFrameTextRenderModelV100 = React.useCallback(async () => {
    if (!selectedFile || !isPdfSourceFile(selectedFile)) {
      return null;
    }

    const fileKey = buildSelectedFileCacheKey(selectedFile);

    if (frameTextRenderModelCacheRef.current?.fileKey === fileKey) {
      return frameTextRenderModelCacheRef.current.model;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', 'image');

    const response = await fetch('/api/templates/extract/frame-text', {
      method: 'POST',
      body: formData,
    });
    const result = (await response.json()) as {
      success?: boolean;
      data?: FrameTextRenderModelV112;
      message?: string;
    };

    if (!response.ok || !result.success || !result.data?.pages?.length) {
      throw new Error(result.message || '이미지 모드 텍스트 추출용 PDF 재분석에 실패했습니다.');
    }

    frameTextRenderModelCacheRef.current = {
      fileKey,
      model: result.data,
    };

    return result.data;
  }, [selectedFile]);

  const handleExtractFrameText = React.useCallback(async () => {
    const root = draftPreviewRef.current;

    if (!root || !textExtractionReady) {
      setMessage('텍스트 추출은 프레임 그룹 생성 이후에 실행할 수 있습니다.');
      return;
    }
    const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)).filter(
      (node) => !node.matches('[data-template-frame-input="true"]')
    );

    if (!frameNodes.length) {
      setMessage('텍스트를 채울 프레임이 없습니다.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const defaultRenderModel =
        parseReplicaRenderModelFromHtml(draftDetail?.draft.generatedDraftHtml || '') ||
        parseReplicaRenderModelFromHtml(draftDetail?.draft.sourceContent || '');
      const activeTextExtractionVersion =
        frameTextExtractionMode === 'image' ? imageFrameTextExtractionVersion : frameTextExtractionVersion;
      const renderModel =
        frameTextExtractionMode === 'image' ? await loadImageFrameTextRenderModelV100() : defaultRenderModel;

      if (!renderModel?.pages?.length) {
        setMessage('텍스트 추출용 렌더 모델을 찾지 못했습니다.');
        return;
      }

      const pageModelByPageNumber = new Map(
        (renderModel.pages || []).map((page) => [String(page.pageNumber), page] as const)
      );
      let filledCount = 0;
      const nextExtractedTextState: FrameExtractedTextState = {};
      if (frameTextExtractionMode === 'image' || frameTextExtractionVersion === 'v1.12') {
        const framePlansByPageNumber = new Map<
          string,
          Array<{
            key: string;
            frameRect: FrameNodeRect;
            sourceTextHint: string;
            node: HTMLElement;
          }>
        >();

        frameNodes.forEach((node) => {
          const pageNumber =
            node.getAttribute('data-template-frame-page') ||
            node.closest<HTMLElement>('.page-inner')?.getAttribute('data-page') ||
            '1';
          const extractedTextKey = buildFrameExtractedTextKeyFromNode(node);

          if (!extractedTextKey) {
            return;
          }

          const pagePlans = framePlansByPageNumber.get(pageNumber) || [];
          pagePlans.push({
            key: extractedTextKey,
            frameRect: readSelectableFrameNodeRect(node),
            sourceTextHint: readFrameNodeSourceText(node),
            node,
          });
          framePlansByPageNumber.set(pageNumber, pagePlans);
        });

        framePlansByPageNumber.forEach((plans, pageNumber) => {
          const pageModel = pageModelByPageNumber.get(pageNumber) || renderModel?.pages?.[0];
          const normalizedPlans = plans.map((plan) => ({
            key: plan.key,
            frameRect: plan.frameRect,
            sourceTextHint: plan.sourceTextHint,
          }));
          const extractedTextState =
            frameTextExtractionMode === 'image'
              ? extractFrameTextStateFromRenderPageImageV100(pageModel, normalizedPlans)
              : extractFrameTextStateFromRenderPageV112(pageModel, normalizedPlans);

          plans.forEach((plan) => {
            const nextText = extractedTextState[plan.key] || '';
            const normalizedText = formatFrameSourceTextForDisplay(nextText, {
              frameGroup: plan.node.getAttribute('data-template-frame-group'),
              valueKey: plan.node.getAttribute('data-template-frame-value-key'),
              colorGroup: plan.node.getAttribute('data-template-frame-color-group'),
            });

            nextExtractedTextState[plan.key] = normalizedText;

            if (normalizedText) {
              filledCount += 1;
            }
          });
        });
      } else {
        frameNodes.forEach((node) => {
          const pageNumber =
            node.getAttribute('data-template-frame-page') ||
            node.closest<HTMLElement>('.page-inner')?.getAttribute('data-page') ||
            '1';
          const pageModel = pageModelByPageNumber.get(pageNumber) || renderModel?.pages?.[0];
          const frameRect = readSelectableFrameNodeRect(node);
          const sourceTextHint = readFrameNodeSourceText(node);
          const nextText = extractFrameTextFromRenderPage(
            pageModel,
            frameRect,
            frameTextExtractionVersion,
            sourceTextHint
          );
          const extractedTextKey = buildFrameExtractedTextKeyFromNode(node);
          const normalizedText = formatFrameSourceTextForDisplay(nextText, {
            frameGroup: node.getAttribute('data-template-frame-group'),
            valueKey: node.getAttribute('data-template-frame-value-key'),
            colorGroup: node.getAttribute('data-template-frame-color-group'),
          });

          if (extractedTextKey) {
            nextExtractedTextState[extractedTextKey] = normalizedText;
          }

          if (normalizedText) {
            filledCount += 1;
          }
        });
      }

      setFrameExtractedTextState(nextExtractedTextState);
      setFrameTextExtractionCompleted(true);
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          requestPreviewTextFit();
        });
      }
      setMessage(
        `텍스트 추출을 완료했습니다. (${frameTextExtractionMode === 'image' ? '이미지' : '비 이미지'} ${activeTextExtractionVersion}, ${filledCount}개 프레임)`
      );
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '텍스트 추출에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [
    draftDetail?.draft.generatedDraftHtml,
    draftDetail?.draft.sourceContent,
    frameTextExtractionMode,
    frameTextExtractionVersion,
    imageFrameTextExtractionVersion,
    loadImageFrameTextRenderModelV100,
    requestPreviewTextFit,
    textExtractionReady,
  ]);

  const getFrameEditorNodes = React.useCallback(
    (root?: HTMLElement | null) =>
      Array.from(
        (root || draftPreviewRef.current)?.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR) || []
      ).filter((node) => !node.matches('[data-template-frame-input="true"]')),
    []
  );

  function buildCrossValidationFramePages(): TemplateExtractReplicaRenderPage[] {
    const root = draftPreviewRef.current;

    if (!root) {
      return [];
    }

    const renderModel =
      frameRevision === 0
        ? parseReplicaRenderModelFromHtml(getCurrentDraftPreviewHtml()) ||
          parseReplicaRenderModelFromHtml(draftDetail?.draft.generatedDraftHtml || '') ||
          parseReplicaRenderModelFromHtml(draftDetail?.draft.sourceContent || '')
        : null;

    if (frameRevision === 0 && renderModel?.pages?.some((page) => (page.frameSegments || []).length > 0)) {
      return renderModel.pages
        .map((page) => ({
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          frameSegments: page.frameSegments || [],
          textItems: [],
        }))
        .filter((page) => page.frameSegments.length > 0);
    }

    return getPreviewPageInners(root)
      .map((pageInner, pageIndex) => {
        const pageNumber = Number.parseInt(pageInner.getAttribute('data-page') || '', 10) || pageIndex + 1;
        const pageWidth = Math.max(
          1,
          pageInner.clientWidth || parseFramePx(pageInner.style.width) || root.clientWidth || 1
        );
        const pageHeight = Math.max(
          1,
          pageInner.clientHeight || parseFramePx(pageInner.style.minHeight) || parseFramePx(pageInner.style.height) || 1
        );
        const frameSegments: TemplateExtractReplicaRenderFrameSegment[] = [];

        getFrameEditorNodes(pageInner).forEach((node) => {
          const rect = node.matches(V106_FRAME_NODE_SELECTOR) ? readFrameNodeRect(node) : readSelectableFrameNodeRect(node);
          const thickness = 1;

          frameSegments.push({
            orientation: 'h',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            thickness,
          });
          frameSegments.push({
            orientation: 'h',
            left: rect.left,
            top: rect.top + rect.height,
            width: rect.width,
            thickness,
          });
          frameSegments.push({
            orientation: 'v',
            left: rect.left,
            top: rect.top,
            height: rect.height,
            thickness,
          });
          frameSegments.push({
            orientation: 'v',
            left: rect.left + rect.width,
            top: rect.top,
            height: rect.height,
            thickness,
          });
        });

        return {
          pageNumber,
          width: pageWidth,
          height: pageHeight,
          frameSegments,
          textItems: [],
        } satisfies TemplateExtractReplicaRenderPage;
      })
      .filter((page) => page.frameSegments.length > 0);
  }

  const applyFrameEditorMetadata = React.useCallback(
    (
      nodes: HTMLElement[],
      patch: {
        valueKey?: string;
        role?: FrameEditorRole;
        outlineStyle?: FrameOutlineStyle;
        parentGroup?: string;
        chainKey?: string;
        chainDepth?: string;
      }
    ) => {
      nodes.forEach((node) => {
        const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');

        if (patch.valueKey !== undefined) {
          const nextValueKey = normalizeFrameFieldPath(patch.valueKey);
          if (nextValueKey) {
            node.setAttribute('data-template-frame-value-key', nextValueKey);
            textarea?.setAttribute('data-template-frame-value-key', nextValueKey);
          } else {
            node.removeAttribute('data-template-frame-value-key');
            textarea?.removeAttribute('data-template-frame-value-key');
          }
          textarea?.removeAttribute('placeholder');
        }

        if (patch.role !== undefined) {
          node.setAttribute('data-template-frame-role', patch.role);
          textarea?.setAttribute('data-template-frame-role', patch.role);
        }

        if (patch.outlineStyle !== undefined) {
          node.setAttribute('data-template-frame-outline-style', patch.outlineStyle);
          textarea?.setAttribute('data-template-frame-outline-style', patch.outlineStyle);
          applyFrameNodeOutlineStyle(node, patch.outlineStyle);
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

        if (patch.chainKey !== undefined) {
          const chainKey = normalizeFrameFieldPath(patch.chainKey);
          if (chainKey) {
            node.setAttribute('data-template-frame-chain-key', chainKey);
            textarea?.setAttribute('data-template-frame-chain-key', chainKey);
          } else {
            node.removeAttribute('data-template-frame-chain-key');
            textarea?.removeAttribute('data-template-frame-chain-key');
          }
        }

        if (patch.chainDepth !== undefined) {
          const parsedDepth = Number.parseInt(patch.chainDepth, 10);
          if (Number.isFinite(parsedDepth) && parsedDepth >= 0) {
            node.setAttribute('data-template-frame-chain-depth', String(parsedDepth));
            textarea?.setAttribute('data-template-frame-chain-depth', String(parsedDepth));
          } else {
            node.removeAttribute('data-template-frame-chain-depth');
            textarea?.removeAttribute('data-template-frame-chain-depth');
          }
        }
      });

      syncDraftPreviewHtmlRef();
    },
    [syncDraftPreviewHtmlRef]
  );

  const findNearestFrameEdge = React.useCallback(
    (
      node: HTMLElement,
      direction: 'left' | 'right' | 'top' | 'bottom'
    ) => {
      const currentRect = readFrameNodeRect(node);
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

        const candidateRect = readFrameNodeRect(candidate);

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
        return Math.min(pageWidth, ...horizontalCandidates.filter((value) => value > currentRect.left + currentRect.width + 1), pageWidth);
      }

      if (direction === 'top') {
        return Math.max(0, ...verticalCandidates.filter((value) => value < currentRect.top - 1));
      }

      return Math.min(pageHeight, ...verticalCandidates.filter((value) => value > currentRect.top + currentRect.height + 1), pageHeight);
    },
    [getFrameEditorNodes]
  );

  const snapMovedFrameRect = React.useCallback(
    (node: HTMLElement, rect: FrameNodeRect) => {
      const pageInner = node.closest<HTMLElement>('.page-inner');

      if (!pageInner) {
        return rect;
      }

      const pageWidth = pageInner.clientWidth;
      const pageHeight = pageInner.clientHeight;
      const result = TemplateFrameEditGeometryService.snapMovedRect({
        rect,
        siblingRects: getFrameEditorNodes(pageInner)
          .filter((candidate) => candidate !== node)
          .map(readFrameNodeRect),
        bounds: { width: pageWidth, height: pageHeight },
      });

      return result.value || rect;
    },
    [getFrameEditorNodes]
  );

  const snapResizedFrameRect = React.useCallback(
    (node: HTMLElement, rect: FrameNodeRect, direction: FrameResizeDirection) => {
      const pageInner = node.closest<HTMLElement>('.page-inner');

      if (!pageInner) {
        return rect;
      }

      const pageWidth = pageInner.clientWidth;
      const pageHeight = pageInner.clientHeight;
      const result = TemplateFrameEditGeometryService.snapResizedRect({
        rect,
        direction,
        siblingRects: getFrameEditorNodes(pageInner)
          .filter((candidate) => candidate !== node)
          .map(readFrameNodeRect),
        bounds: { width: pageWidth, height: pageHeight },
      });

      return result.value || rect;
    },
    [getFrameEditorNodes]
  );

  const buildFrameEditorAttrs = React.useCallback(
    (frameGroupId: string) => {
      const attrs: Record<string, string> = {
        'data-template-frame-group': frameGroupId,
        'data-template-frame-role': frameEditorRole,
        'data-template-frame-outline-style': frameEditorOutlineStyle,
      };
      const valueKey = normalizeFrameFieldPath(frameEditorValueKey);
      const parentGroup = frameEditorParentGroup.trim();
      const chainKey = normalizeFrameFieldPath(frameEditorChainKey);
      const chainDepth = Number.parseInt(frameEditorChainDepth, 10);

      if (valueKey) {
        attrs['data-template-frame-value-key'] = valueKey;
      }

      if (parentGroup) {
        attrs['data-template-frame-parent-group'] = parentGroup;
      }

      if (chainKey) {
        attrs['data-template-frame-chain-key'] = chainKey;
      }

      if (Number.isFinite(chainDepth) && chainDepth >= 0) {
        attrs['data-template-frame-chain-depth'] = String(chainDepth);
      }

      return attrs;
    },
    [
      frameEditorChainDepth,
      frameEditorChainKey,
      frameEditorOutlineStyle,
      frameEditorParentGroup,
      frameEditorRole,
      frameEditorValueKey,
    ]
  );

  const createFrameNodeFromRect = React.useCallback(
    (pageInner: HTMLElement, rect: FrameNodeRect) => {
      const pageNumber =
        pageInner.getAttribute('data-page') ||
        pageInner.closest<HTMLElement>('[data-page]')?.getAttribute('data-page') ||
        '1';
      const frameGroupId = `created-${Date.now()}`;
      const node = buildV106FrameNode({
        pageNumber,
        attrs: buildFrameEditorAttrs(frameGroupId),
        rowColor: isV109FrameGroupVersion(currentFrameGroupVersionTag)
          ? 'transparent'
          : 'rgba(59, 130, 246, 0.08)',
        colColor: isV109FrameGroupVersion(currentFrameGroupVersionTag)
          ? 'transparent'
          : 'rgba(14, 165, 233, 0.14)',
        rect,
        value: '',
      });
      const layer = pageInner.querySelector<HTMLElement>('[data-v106-frame-editor-layer="true"]') || pageInner;

      node.style.pointerEvents = 'auto';
      layer.appendChild(node);
      setSelectedFrameGroupIds([frameGroupId]);
      setFrameEditorNotice(null);
      syncDraftPreviewHtmlRef();
      window.requestAnimationFrame(() => syncFrameEditorSelectionState());
    },
    [buildFrameEditorAttrs, currentFrameGroupVersionTag, syncDraftPreviewHtmlRef, syncFrameEditorSelectionState]
  );

  const deleteSelectedFrameGroups = React.useCallback(
    (targetFrameGroupIds = selectedFrameGroupIds) => {
      const root = draftPreviewRef.current;
      const ids = targetFrameGroupIds.filter(Boolean);

      if (!root || !ids.length) {
        return;
      }

      getFrameEditorNodes(root).forEach((node) => {
        if (ids.includes(node.getAttribute('data-template-frame-group') || '')) {
          node.remove();
        }
      });

      const missingParentReferences = getFrameEditorNodes(root).filter((node) =>
        ids.includes(node.getAttribute('data-template-frame-parent-group') || '')
      );

      missingParentReferences.forEach((node) => {
        node.removeAttribute('data-template-frame-parent-group');
        node
          .querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]')
          ?.removeAttribute('data-template-frame-parent-group');
      });

      setSelectedFrameGroupIds((previous) => previous.filter((id) => !ids.includes(id)));
      setFrameEditorNotice(
        missingParentReferences.length
          ? '삭제된 프레임을 부모로 참조하던 연결을 제거했습니다.'
          : null
      );
      syncDraftPreviewHtmlRef();
      syncFrameEditorSelectionState();
    },
    [getFrameEditorNodes, selectedFrameGroupIds, syncDraftPreviewHtmlRef, syncFrameEditorSelectionState]
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const createState = frameCreateStateRef.current;

      if (createState) {
        const point = clientPointToPagePoint(createState.pageInner, event.clientX, event.clientY);
        const rawRect = {
          left: Math.min(createState.start.x, point.x),
          top: Math.min(createState.start.y, point.y),
          width: Math.abs(point.x - createState.start.x),
          height: Math.abs(point.y - createState.start.y),
        };
        createState.lastRawRect = rawRect;
        const result = TemplateFrameEditGeometryService.validateCreateRect({
          rect: rawRect,
          siblingRects: getFrameEditorNodes(createState.pageInner).map(readFrameNodeRect),
          bounds: {
            width: createState.pageInner.clientWidth,
            height: createState.pageInner.clientHeight,
          },
        });

        writeFrameNodeRect(createState.ghostNode, result.value || rawRect);
        return;
      }

      const resizeState = frameResizeStateRef.current;

      if (resizeState) {
        const { x: dx, y: dy } = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
          {
            x: event.clientX - resizeState.startX,
            y: event.clientY - resizeState.startY,
          },
          resizeState.scale
        );
        const startRect = resizeState.rect;
        let left = startRect.left;
        let top = startRect.top;
        let right = startRect.left + startRect.width;
        let bottom = startRect.top + startRect.height;

        if (resizeState.direction.includes('w')) {
          left += dx;
        }

        if (resizeState.direction.includes('e')) {
          right += dx;
        }

        if (resizeState.direction.includes('n')) {
          top += dy;
        }

        if (resizeState.direction.includes('s')) {
          bottom += dy;
        }

        const pageInner = resizeState.node.closest<HTMLElement>('.page-inner');
        const nextRect = clampFrameNodeRect(
          {
            left: Math.min(left, right - 12),
            top: Math.min(top, bottom - 12),
            width: Math.max(12, right - left),
            height: Math.max(12, bottom - top),
          },
          {
            width: pageInner?.clientWidth || Number.MAX_SAFE_INTEGER,
            height: pageInner?.clientHeight || Number.MAX_SAFE_INTEGER,
          }
        );

        writeFrameNodeRect(resizeState.node, nextRect);
        return;
      }

      const dragState = frameDragStateRef.current;

      if (!dragState) {
        return;
      }

      const { x: dx, y: dy } = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: event.clientX - dragState.startX,
          y: event.clientY - dragState.startY,
        },
        dragState.scale
      );

      dragState.nodes.forEach(({ node, rect }) => {
        writeFrameNodeRect(node, {
          left: rect.left + dx,
          top: rect.top + dy,
          width: rect.width,
          height: rect.height,
        });
      });
    };

    const finishDrag = () => {
      const createState = frameCreateStateRef.current;

      if (createState) {
        const rect = readFrameNodeRect(createState.ghostNode);
        const rawRect = createState.lastRawRect;
        createState.ghostNode.remove();
        frameCreateStateRef.current = null;

        if (rawRect.width >= 12 && rawRect.height >= 12) {
          createFrameNodeFromRect(createState.pageInner, rect);
          setFrameCreateMode(false);
        } else {
          setFrameEditorNotice('새 프레임이 최소 크기보다 작아 생성하지 않았습니다.');
        }
        return;
      }

      const resizeState = frameResizeStateRef.current;

      if (resizeState) {
        const resizedRect = readFrameNodeRect(resizeState.node);
        const snappedRect = snapResizedFrameRect(
          resizeState.node,
          resizedRect,
          resizeState.direction
        );
        writeFrameNodeRect(resizeState.node, snappedRect);
        resizeState.node.style.cursor = 'grab';
        frameResizeStateRef.current = null;
        syncDraftPreviewHtmlRef();
        syncFrameEditorSelectionState();
        return;
      }

      const dragState = frameDragStateRef.current;

      if (!dragState) {
        return;
      }

      const anchorRect = readFrameNodeRect(dragState.anchorNode);
      const snappedAnchorRect = snapMovedFrameRect(dragState.anchorNode, anchorRect);
      const dx = snappedAnchorRect.left - anchorRect.left;
      const dy = snappedAnchorRect.top - anchorRect.top;

      dragState.nodes.forEach(({ node }) => {
        const rect = readFrameNodeRect(node);
        writeFrameNodeRect(node, {
          left: rect.left + dx,
          top: rect.top + dy,
          width: rect.width,
          height: rect.height,
        });
        node.style.cursor = 'grab';
      });

      frameDragStateRef.current = null;
      syncDraftPreviewHtmlRef();
      syncFrameEditorSelectionState();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [
    createFrameNodeFromRect,
    getFrameEditorNodes,
    snapMovedFrameRect,
    snapResizedFrameRect,
    syncDraftPreviewHtmlRef,
    syncFrameEditorSelectionState,
  ]);

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

    const mergeResult = TemplateFrameEditGeometryService.validateMerge({
      frames: nodes.map(readFrameNodeDto),
    });

    if (!mergeResult.ok || !mergeResult.value) {
      setFrameEditorNotice(mergeResult.warnings[0]?.message || '선택한 프레임은 병합할 수 없습니다.');
      return;
    }

    const anchor = nodes[0];
    const mergedId = `merged-${Date.now()}`;
    writeFrameNodeRect(anchor, toFrameNodeRect(mergeResult.value));
    writeFrameNodeId(anchor, mergedId);

    for (const node of nodes.slice(1)) {
      node.remove();
    }

    setSelectedFrameGroupIds([mergedId]);
    setFrameEditorNotice(null);
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

      const pageInner = node.closest<HTMLElement>('.page-inner');
      const currentFrame = readFrameNodeDto(node);
      const otherFrames = getFrameEditorNodes(pageInner)
        .filter((candidate) => candidate !== node)
        .map(readFrameNodeDto);
      const candidatesResult = TemplateFrameEditGeometryService.listSplitCandidates({
        frame: currentFrame,
        siblings: otherFrames,
        axis,
      });

      if (!candidatesResult.ok || !candidatesResult.value?.length) {
        setFrameEditorNotice(candidatesResult.warnings[0]?.message || '인접 경계선이 없어 분할할 수 없습니다.');
        return;
      }

      const firstId = `${selectedFrameGroupIds[0]}-a`;
      const secondId = `${selectedFrameGroupIds[0]}-b`;
      const splitResult = TemplateFrameEditGeometryService.splitFrame({
        frame: currentFrame,
        candidate: candidatesResult.value[0],
        firstFrameGroupId: firstId,
        secondFrameGroupId: secondId,
      });

      if (!splitResult.ok || !splitResult.value) {
        setFrameEditorNotice(splitResult.warnings[0]?.message || '선택한 프레임을 분할할 수 없습니다.');
        return;
      }

      const secondNode = node.cloneNode(true) as HTMLElement;
      const input = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
      const secondInput = secondNode.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
      const [firstFrame, secondFrame] = splitResult.value;

      writeFrameNodeRect(node, toFrameNodeRect(firstFrame.rect));
      writeFrameNodeRect(secondNode, toFrameNodeRect(secondFrame.rect));

      writeFrameNodeId(node, firstId);
      writeFrameNodeId(secondNode, secondId);
      input?.setAttribute('data-template-frame-group', firstId);
      secondInput?.setAttribute('data-template-frame-group', secondId);
      node.after(secondNode);

      setSelectedFrameGroupIds([firstId, secondId]);
      setFrameEditorNotice(null);
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
        const rect = readFrameNodeRect(node);
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
    const currentRect = readFrameNodeRect(node);
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

  const handleDraftPreviewPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      const deleteButton = targetElement?.closest<HTMLElement>(V106_FRAME_DELETE_BUTTON_SELECTOR);
      const resizeHandle = targetElement?.closest<HTMLElement>(V106_FRAME_RESIZE_HANDLE_SELECTOR);
      const root = draftPreviewRef.current;

      if (deleteButton) {
        event.preventDefault();
        const frameGroupId =
          deleteButton.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)?.getAttribute('data-template-frame-group') ||
          '';
        deleteSelectedFrameGroups(frameGroupId ? [frameGroupId] : selectedFrameGroupIds);
        return;
      }

      if (frameCreateMode && root) {
        const pageInner = resolvePageInnerFromPoint(root, event.clientX, event.clientY);

        if (pageInner) {
          event.preventDefault();
          const start = clientPointToPagePoint(pageInner, event.clientX, event.clientY);
          const ghostNode = document.createElement('div');
          ghostNode.className = FRAME_CREATE_GHOST_CLASS;
          ghostNode.setAttribute('data-frame-editor-ui', 'true');
          ghostNode.style.position = 'absolute';
          ghostNode.style.pointerEvents = 'none';
          ghostNode.style.zIndex = '35';
          ghostNode.style.border = '2px dashed #2563eb';
          ghostNode.style.background = 'rgba(37, 99, 235, .12)';
          ghostNode.style.boxSizing = 'border-box';
          writeFrameNodeRect(ghostNode, { left: start.x, top: start.y, width: 1, height: 1 });
          (pageInner.querySelector<HTMLElement>('[data-v106-frame-editor-layer="true"]') || pageInner).appendChild(
            ghostNode
          );
          frameCreateStateRef.current = {
            pointerId: event.pointerId,
            pageInner,
            start,
            lastRawRect: { left: start.x, top: start.y, width: 0, height: 0 },
            ghostNode,
          };
          return;
        }
      }

      const frameNode = root ? resolveFrameNodeFromEvent(root, event.target, event) : null;

      if (!frameNode) {
        return;
      }

      event.preventDefault();
      setSelectedCandidateKey(null);

      const frameGroupId = frameNode.getAttribute('data-template-frame-group') || '';

      if (!frameGroupId) {
        return;
      }

      const frameValueKey = normalizeFrameFieldPath(frameNode.getAttribute('data-template-frame-value-key') || '');
      setSelectedCandidateKey(frameValueKey ? candidateKeyByLabelKey.get(frameValueKey) || null : null);

      const isV106FrameNode = frameNode.matches(V106_FRAME_NODE_SELECTOR);

      if (resizeHandle) {
        if (!isV106FrameNode) {
          setSelectedFrameGroupIds([frameGroupId]);
          return;
        }

        const direction = resizeHandle.getAttribute('data-v106-resize-direction') as FrameResizeDirection | null;

        if (!direction) {
          return;
        }

        setSelectedFrameGroupIds([frameGroupId]);
        frameNode.style.cursor = 'grabbing';
        frameResizeStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          direction,
          node: frameNode,
          scale: readFramePreviewScale(frameNode.closest<HTMLElement>('.page-inner')),
          rect: readFrameNodeRect(frameNode),
        };
        return;
      }

      if (!isV106FrameNode) {
        if (event.shiftKey) {
          setSelectedFrameGroupIds((previous) => {
            const next = getNextFrameSelection(previous, frameGroupId, true);
            if (draftPreviewRef.current) {
              applyFrameSelectionHighlight(draftPreviewRef.current, next);
            }
            return next;
          });
        } else {
          setSelectedFrameGroupIds((previous) => {
            const next = getNextFrameSelection(previous, frameGroupId, false);
            if (draftPreviewRef.current) {
              applyFrameSelectionHighlight(draftPreviewRef.current, next);
            }
            return next;
          });
        }
        return;
      }

      const nextSelectedIds = getNextFrameSelection(
        selectedFrameGroupIds,
        frameGroupId,
        Boolean(event.shiftKey)
      );

      setSelectedFrameGroupIds((previous) =>
        {
          const next = getNextFrameSelection(previous, frameGroupId, Boolean(event.shiftKey));
          if (draftPreviewRef.current) {
            applyFrameSelectionHighlight(draftPreviewRef.current, next);
          }
          return next;
        }
      );

      if (!root) {
        return;
      }

      const nodes = getFrameEditorNodes(root).filter((node) =>
        nextSelectedIds.includes(node.getAttribute('data-template-frame-group') || '')
      );

      if (!nodes.length) {
        return;
      }

      nodes.forEach((node) => {
        node.style.cursor = 'grabbing';
      });

      frameDragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scale: readFramePreviewScale(frameNode.closest<HTMLElement>('.page-inner')),
        anchorNode: frameNode,
        nodes: nodes.map((node) => ({ node, rect: readFrameNodeRect(node) })),
      };
    },
    [deleteSelectedFrameGroups, frameCreateMode, getFrameEditorNodes, selectedFrameGroupIds]
  );

  const selectReviewedField = (field: TemplateExtractReviewedFieldInput) => {
    setSelectedCandidateKey(field.candidateKey || null);

    const root = draftPreviewRef.current;

    if (!root || !field.labelKey) {
      return;
    }

    const normalizedLabelKey = normalizeFrameFieldPath(field.labelKey);
    const matchingFrameNodes = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
      .filter((node) => !node.matches('[data-template-frame-input="true"]'))
      .filter(
        (node) =>
          normalizeFrameFieldPath(node.getAttribute('data-template-frame-value-key') || '') === normalizedLabelKey
      );

    if (matchingFrameNodes.length > 0) {
      const matchingIds = matchingFrameNodes
        .map((node) => node.getAttribute('data-template-frame-group') || '')
        .filter(Boolean);
      setSelectedFrameGroupIds(matchingIds);
      window.requestAnimationFrame(() => {
        matchingFrameNodes[0]?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      });
      return;
    }

    window.requestAnimationFrame(() => {
      const target = findTemplateValueElements(root, field.labelKey)[0];
      target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
  };

  const updatePreviewValueForField = (field: TemplateExtractReviewedFieldInput, nextValue: string) => {
    const root = draftPreviewRef.current;

    if (!root || !field.labelKey) {
      return;
    }

    const matchedValueElements = findTemplateValueElements(root, field.labelKey);

    for (const element of matchedValueElements) {
      element.textContent = nextValue;
      markTemplateValueElementEdited(element);
    }

    const matchedFrameNodes =
      matchedValueElements.length === 0
        ? Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
        .filter((node) => !node.matches('[data-template-frame-input="true"]'))
        .filter(
          (node) =>
            normalizeFrameFieldPath(node.getAttribute('data-template-frame-value-key') || '') ===
            normalizeFrameFieldPath(field.labelKey)
        )
        : [];

    if (matchedFrameNodes.length > 0) {
      setFrameExtractedTextState((previous) => {
        const nextState = { ...previous };

        matchedFrameNodes.forEach((node) => {
          const extractedTextKey = buildFrameExtractedTextKeyFromNode(node);

          if (!extractedTextKey) {
            return;
          }

          nextState[extractedTextKey] = formatFrameSourceTextForDisplay(nextValue, {
            frameGroup: node.getAttribute('data-template-frame-group'),
            valueKey: node.getAttribute('data-template-frame-value-key'),
            colorGroup: node.getAttribute('data-template-frame-color-group'),
          });
        });

        return nextState;
      });
      setFrameTextExtractionCompleted(true);
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          requestPreviewTextFit();
        });
      }
      return;
    }

    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
  };

  const handleReviewedFieldValueChange = (
    field: TemplateExtractReviewedFieldInput,
    nextValue: string
  ) => {
    setSelectedCandidateKey(field.candidateKey || null);
    updateReviewedField(field.candidateKey, { defaultValue: nextValue });
    updatePreviewValueForField(field, nextValue);
  };

  const syncPreviewEditTarget = (target: EventTarget | null) => {
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

    const labelKey = valueElement.getAttribute('data-template-value') || '';
    const candidateKey = candidateKeyByLabelKey.get(labelKey);

    if (!candidateKey) {
      return;
    }

    setSelectedCandidateKey(candidateKey);
    markTemplateValueElementEdited(valueElement);
    updateReviewedField(candidateKey, { defaultValue: templateValueElementText(valueElement) });

    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
  };

  const handleDraftPreviewSelect = (
    event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>
  ) => {
    const targetElement = event.target instanceof HTMLElement ? event.target : null;
    const root = draftPreviewRef.current;
    const frameNode =
      root && 'clientX' in event
        ? resolveFrameNodeFromEvent(root, event.target, event)
        : targetElement?.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);

    if (frameNode) {
      return;
    }

    const choiceButton = targetElement?.closest<HTMLElement>('[role="checkbox"][data-checked]');

    if (choiceButton) {
      toggleChoiceBoxElement(choiceButton);
      syncDraftPreviewHtmlRef();
      return;
    }

    const valueElement = resolveTemplateValueElementFromTarget(event.target, event);

    if (!valueElement) {
      if ('clientX' in event) {
        window.requestAnimationFrame(() => {
          const nextValueElement = resolveTemplateValueElementFromTarget(event.target, event);
          const nextCandidateKey = candidateKeyByLabelKey.get(
            nextValueElement?.getAttribute('data-template-value') || ''
          );

          if (nextCandidateKey) {
            setSelectedCandidateKey(nextCandidateKey);
          }
        });
      }
      return;
    }

    const candidateKey = candidateKeyByLabelKey.get(valueElement.getAttribute('data-template-value') || '');

    if (candidateKey) {
      setSelectedCandidateKey(candidateKey);
    }
  };

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleNativePointerDown = (event: PointerEvent) => {
      const root = draftPreviewRef.current;
      const target = event.target instanceof Node ? event.target : null;

      if (!root || !target || !root.contains(target)) {
        return;
      }

      handleDraftPreviewPointerDown(event as unknown as React.PointerEvent<HTMLDivElement>);
    };

    const handleNativeClick = (event: MouseEvent) => {
      const root = draftPreviewRef.current;
      const target = event.target instanceof Node ? event.target : null;

      if (!root || !target || !root.contains(target)) {
        return;
      }

      handleDraftPreviewSelect(event as unknown as React.MouseEvent<HTMLDivElement>);
    };

    document.addEventListener('pointerdown', handleNativePointerDown, true);
    document.addEventListener('click', handleNativeClick, true);

    return () => {
      document.removeEventListener('pointerdown', handleNativePointerDown, true);
      document.removeEventListener('click', handleNativeClick, true);
    };
  }, [handleDraftPreviewPointerDown, handleDraftPreviewSelect, draftDetail?.draft.generatedDraftHtml]);

  const handleDraftPreviewPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
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
  };

  const previewSourceKind = draftDetail?.draft.sourceKind || sourceKind;
  const previewSourceContent = draftDetail?.draft.sourceContent || sourceContent;
  const hasGeneratedDraftHtml = Boolean((draftDetail?.draft.generatedDraftHtml || '').trim());
  const activePreviewPaneMode = previewPaneMode === 'draft' && !hasGeneratedDraftHtml ? 'source' : previewPaneMode;
  const pipelineTrace = draftDetail?.pipelineTrace || null;
  const qualityReport = draftDetail?.qualityReport || null;
  const offlineMetrics = qualityReport?.offlineMetrics || null;
  const viewingRegisteredTemplate = Boolean(loadedTemplateId);
  const unifiedProgressSource = visualSimilarityProgress.visible ? 'visual' : draftProgress.visible ? 'draft' : 'idle';
  const unifiedProgress =
    unifiedProgressSource === 'visual'
      ? {
          title: '교차 검증',
          percent: visualSimilarityProgress.percent,
          phase: visualSimilarityProgress.phase,
          stage: visualSimilarityProgress.stage || '교차 검증 중',
          detail:
            visualSimilarityProgress.detail ||
            '원본 PDF와 output HTML을 같은 기준으로 비교하고 있습니다.',
        }
      : unifiedProgressSource === 'draft'
        ? {
            title: draftProgressAction === 'frames' ? '프레임 그룹 생성' : '전체 추출',
            percent: draftProgress.percent,
            phase: draftProgress.phase,
            stage: draftProgress.stage || '초안을 생성하고 있습니다.',
            detail: draftProgress.detail || '원본 문서를 읽고 템플릿 초안을 준비하고 있습니다.',
          }
        : {
            title: '진행 상태',
            percent: 0,
            phase: 'idle',
            stage: '작업 대기 중입니다.',
            detail: '프레임 그룹 생성, 전체 추출, 교차 검증 진행률이 여기에 표시됩니다.',
          };
  const unifiedProgressFailed = unifiedProgress.phase === 'failed';
  const unifiedProgressCompleted = unifiedProgress.phase === 'completed';
  const unifiedProgressActive = unifiedProgressSource !== 'idle' && !unifiedProgressFailed && !unifiedProgressCompleted;
  const availableFrameGroupIds = getFrameEditorNodes()
    .map((node) => node.getAttribute('data-template-frame-group') || '')
    .filter(Boolean);
  const crossValidationPageCount = Math.max(
    crossValidationPreview?.pdfPageDataUrls.length || 0,
    crossValidationPreview?.replicaPageDataUrls.length || 0,
    visualSimilarityReport?.pageCount || 0
  );
  const activeCrossValidationPageIndex =
    crossValidationPageCount > 0 ? Math.min(crossValidationPageIndex, crossValidationPageCount - 1) : 0;
  const activeCrossValidationPdfPageUrl =
    crossValidationPreview?.pdfPageDataUrls[activeCrossValidationPageIndex] || '';
  const activeCrossValidationReplicaPageUrl =
    crossValidationPreview?.replicaPageDataUrls[activeCrossValidationPageIndex] || '';
  const activeCrossValidationPageReport =
    visualSimilarityReport?.pageReports[activeCrossValidationPageIndex] || null;
  const crossValidationAspectRatio =
    activeCrossValidationPageReport && activeCrossValidationPageReport.width > 0 && activeCrossValidationPageReport.height > 0
      ? `${activeCrossValidationPageReport.width} / ${activeCrossValidationPageReport.height}`
      : '210 / 297';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <style>{`
        .template-extract-draft-preview [data-template-value] {
          cursor: text;
        }
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
        .template-extract-preview-surface.template-extract-html-preview,
        .template-extract-preview-surface.template-extract-draft-preview {
          color: rgb(30 41 59);
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
        .template-extract-draft-preview[data-cross-validation-reference-visible="true"] {
          isolation: isolate;
          background: transparent !important;
        }
        .template-extract-draft-preview[data-cross-validation-reference-visible="true"]::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image: var(--cross-validation-reference-image);
          background-repeat: no-repeat;
          background-position: center center;
          background-size: contain;
          opacity: .92;
        }
        .template-extract-draft-preview[data-cross-validation-reference-visible="true"] > * {
          position: relative;
          z-index: 1;
        }
        .template-extract-draft-preview[data-cross-validation-reference-visible="true"] .page,
        .template-extract-draft-preview[data-cross-validation-reference-visible="true"] .page-inner {
          background: transparent !important;
        }
        .template-extract-draft-preview [data-v106-frame-node="true"] {
          cursor: pointer;
        }
        .template-extract-draft-preview [data-v106-frame-node="true"] [data-template-frame-input="true"] {
          cursor: text;
        }
        .template-extract-draft-preview [data-template-extraction-stage="frames"] .v202-frame-group-input {
          pointer-events: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .template-extract-draft-preview [data-template-edit-scope="admin"][data-template-edit-enabled="true"] {
          cursor: text;
        }
        .template-extract-draft-preview [data-template-edit-scope="admin"][data-template-edit-enabled="false"] {
          cursor: default;
        }
        .template-extract-draft-preview [role="checkbox"][data-checked] {
          cursor: pointer;
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
        .template-extract-draft-preview .${FRAME_DELETE_BUTTON_CLASS} {
          position: absolute;
          right: 4px;
          bottom: 4px;
          z-index: 33;
          height: 24px;
          min-width: 24px;
          border-radius: 6px;
          border: 1px solid rgba(185, 28, 28, .28);
          background: rgba(254, 242, 242, .98);
          color: #991b1b;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .2);
        }
        .template-extract-draft-preview .${FRAME_DELETE_BUTTON_CLASS}:hover {
          background: #fee2e2;
          border-color: rgba(185, 28, 28, .45);
        }
        .template-extract-draft-preview .${FRAME_CREATE_GHOST_CLASS} {
          position: absolute;
        }
      `}</style>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-FLOW-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">템플릿 추출</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문서를 올리면 왼쪽에서 원본과 추출 초안을 크게 보고, 오른쪽에서 필요한 항목만 검토한 뒤 바로 템플릿으로 저장합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button
            variant="outline"
            onClick={() => void handleCreateDraft('frames')}
            disabled={loading || visualSimilarityMeasuring || !selectedFile}
          >
            프레임 그룹 생성
          </Button>
          <select
            value={frameGroupVersion}
            onChange={(event) => setFrameGroupVersion(event.target.value as TemplateExtractFrameGroupVersion)}
            disabled={loading || visualSimilarityMeasuring}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TEMPLATE_EXTRACT_FRAME_GROUP_VERSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isV109FrameGroupVersion(frameGroupVersion) ? (
            <Input
              value={frameProfileName}
              onChange={(event) => setFrameProfileName(event.target.value)}
              disabled={loading || visualSimilarityMeasuring}
              placeholder={`${String(frameGroupVersion || 'v1.11')} 저장명`}
              className="h-9 w-44"
            />
          ) : null}
          <Button
            variant="outline"
            onClick={handleExtractFrameText}
            disabled={loading || visualSimilarityMeasuring || !textExtractionReady}
            title={textExtractionReady ? undefined : '프레임 그룹 생성 이후에 활성화됩니다.'}
          >
            텍스트 추출
          </Button>
          <div className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-1">
            <Button
              variant={frameTextExtractionMode === 'non_image' ? 'default' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => setFrameTextExtractionMode('non_image')}
              disabled={loading || visualSimilarityMeasuring || !textExtractionReady}
              title={textExtractionReady ? undefined : '프레임 그룹 생성 이후에 활성화됩니다.'}
            >
              비 이미지
            </Button>
            <Button
              variant={frameTextExtractionMode === 'image' ? 'default' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => setFrameTextExtractionMode('image')}
              disabled={loading || visualSimilarityMeasuring || !textExtractionReady}
              title={textExtractionReady ? undefined : '프레임 그룹 생성 이후에 활성화됩니다.'}
            >
              이미지
            </Button>
          </div>
          <select
            value={frameTextExtractionMode === 'image' ? imageFrameTextExtractionVersion : frameTextExtractionVersion}
            onChange={(event) =>
              frameTextExtractionMode === 'image'
                ? setImageFrameTextExtractionVersion(event.target.value as ImageFrameTextExtractionVersion)
                : setFrameTextExtractionVersion(event.target.value as FrameTextExtractionVersion)
            }
            disabled={loading || visualSimilarityMeasuring || !textExtractionReady}
            title={textExtractionReady ? undefined : '프레임 그룹 생성 이후에 활성화됩니다.'}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {(frameTextExtractionMode === 'image'
              ? IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS
              : NON_IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={handleMeasureVisualSimilarity}
            disabled={loading || visualSimilarityMeasuring || !crossValidationReady}
            title={crossValidationReady ? undefined : '텍스트 추출 완료 이후에 활성화됩니다.'}
          >
            {visualSimilarityMeasuring ? `교차 검증 ${visualSimilarityProgress.percent}%` : '교차 검증'}
          </Button>
          <Button onClick={() => void handleCreateDraft('full')} disabled={loading || visualSimilarityMeasuring}>
            전체 추출
          </Button>
          <select
            value={engineVersion}
            onChange={(event) => setEngineVersion(event.target.value as TemplateExtractEngineVersion)}
            disabled={loading || visualSimilarityMeasuring}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-6">
          <Card className="flex flex-col gap-6 border-slate-200 p-6">
            <CardHeader className="flex flex-col gap-3 p-0 md:flex-row md:items-start md:justify-between">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCrossValidationReferenceVisible((previous) => !previous)}
                      disabled={!crossValidationPreview || !activeCrossValidationPdfPageUrl}
                      title={
                        crossValidationPreview && activeCrossValidationPdfPageUrl
                          ? crossValidationReferenceVisible
                            ? '문서 미리보기의 원본 문서 배경을 숨깁니다.'
                            : '문서 미리보기의 원본 문서 배경을 표시합니다.'
                          : '교차 검증 실행 이후에 활성화됩니다.'
                      }
                      aria-label={crossValidationReferenceVisible ? '원본 문서 배경 숨기기' : '원본 문서 배경 표시'}
                    >
                      {crossValidationReferenceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
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
            {activePreviewPaneMode === 'source' ? (
              previewSourceKind === 'html' ? (
                <CardContent
                  className="template-extract-preview-surface template-extract-html-preview !p-0"
                  dangerouslySetInnerHTML={{ __html: previewSourceContent }}
                />
              ) : (
                <CardContent className="template-extract-preview-surface template-extract-text-preview !p-0">
                  {previewSourceContent.trim() || '표시할 내용이 없습니다.'}
                </CardContent>
              )
            ) : hasGeneratedDraftHtml ? (
              <CardContent
                ref={draftPreviewRef}
                className={`template-extract-draft-preview template-extract-preview-surface !p-0${
                  flattenedFramePreview ? ' template-clone template-clone--raster-first-v2-structured' : ''
                }`}
                data-template-extraction-stage={flattenedFramePreview?.extractionStage || undefined}
                data-template-frame-group-version={flattenedFramePreview?.frameGroupVersion || undefined}
                data-template-clone-id={flattenedFramePreview?.cloneId || undefined}
                data-cross-validation-reference-visible={crossValidationReferenceVisible && activeCrossValidationPdfPageUrl ? 'true' : undefined}
                onFocusCapture={handleDraftPreviewSelect}
                onInput={(event) => syncPreviewEditTarget(event.target)}
                onPasteCapture={handleDraftPreviewPaste}
                style={
                  crossValidationReferenceVisible && activeCrossValidationPdfPageUrl
                    ? ({
                        ['--cross-validation-reference-image' as string]: `url("${activeCrossValidationPdfPageUrl}")`,
                      } as React.CSSProperties)
                    : undefined
                }
                dangerouslySetInnerHTML={{ __html: renderedDraftHtml }}
              />
            ) : (
              <CardContent className="template-extract-preview-surface flex items-center justify-center !p-0 text-sm text-slate-500">
                아직 생성된 초안이 없습니다.
              </CardContent>
            )}
          </Card>

          {crossValidationReady || crossValidationPreview ? (
            <Card className="border-slate-200">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle>교차 검증</CardTitle>
                  <CardDescription>
                    원본 PDF 렌더와 현재 텍스트 추출 결과를 병치하거나 겹쳐서 점검합니다.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={crossValidationViewMode === 'side_by_side' ? 'default' : 'outline'}
                    onClick={() => setCrossValidationViewMode('side_by_side')}
                    disabled={!crossValidationPreview}
                  >
                    병치
                  </Button>
                  <Button
                    size="sm"
                    variant={crossValidationViewMode === 'overlay' ? 'default' : 'outline'}
                    onClick={() => setCrossValidationViewMode('overlay')}
                    disabled={!crossValidationPreview}
                  >
                    겹쳐보기
                  </Button>
                  <select
                    value={String(activeCrossValidationPageIndex)}
                    onChange={(event) => setCrossValidationPageIndex(Number.parseInt(event.target.value, 10) || 0)}
                    disabled={!crossValidationPreview || crossValidationPageCount <= 1}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Array.from({ length: crossValidationPageCount }, (_, index) => (
                      <option key={index} value={index}>
                        페이지 {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {crossValidationPreview ? (
                  <>
                    {activeCrossValidationPageReport ? (
                      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500">페이지</p>
                          <p className="font-semibold text-slate-950">{activeCrossValidationPageReport.pageNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">프레임 일치율</p>
                          <p className="font-semibold text-slate-950">
                            {formatPercent(activeCrossValidationPageReport.frameLayerReport?.overlapRatio ?? activeCrossValidationPageReport.overlapRatio)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">텍스트 일치율</p>
                          <p className="font-semibold text-slate-950">
                            {formatPercent(activeCrossValidationPageReport.textLayerReport?.overlapRatio ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">오염 비율</p>
                          <p className="font-semibold text-slate-950">
                            {formatPercent(activeCrossValidationPageReport.mismatchRatio)}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {crossValidationViewMode === 'overlay' ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-medium text-slate-800">겹침 강도</label>
                          <input
                            type="range"
                            min={15}
                            max={100}
                            step={1}
                            value={crossValidationOverlayOpacity}
                            onChange={(event) => setCrossValidationOverlayOpacity(Number.parseInt(event.target.value, 10) || 55)}
                            className="w-48"
                          />
                          <span className="text-xs text-slate-500">{crossValidationOverlayOpacity}%</span>
                        </div>
                        <div
                          className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                          style={{ aspectRatio: crossValidationAspectRatio }}
                        >
                          {activeCrossValidationPdfPageUrl ? (
                            <img
                              src={activeCrossValidationPdfPageUrl}
                              alt={`원본 PDF 페이지 ${activeCrossValidationPageIndex + 1}`}
                              className="absolute inset-0 h-full w-full object-contain"
                            />
                          ) : null}
                          {activeCrossValidationReplicaPageUrl ? (
                            <img
                              src={activeCrossValidationReplicaPageUrl}
                              alt={`추출 결과 페이지 ${activeCrossValidationPageIndex + 1}`}
                              className="absolute inset-0 h-full w-full object-contain"
                              style={{ opacity: crossValidationOverlayOpacity / 100 }}
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>배경: 원본 PDF</span>
                          <span>상단: 현재 추출 결과</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-800">원본 PDF</p>
                          <div
                            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                            style={{ aspectRatio: crossValidationAspectRatio }}
                          >
                            {activeCrossValidationPdfPageUrl ? (
                              <img
                                src={activeCrossValidationPdfPageUrl}
                                alt={`원본 PDF 페이지 ${activeCrossValidationPageIndex + 1}`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                원본 PDF 페이지가 없습니다.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-800">현재 추출 결과</p>
                          <div
                            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                            style={{ aspectRatio: crossValidationAspectRatio }}
                          >
                            {activeCrossValidationReplicaPageUrl ? (
                              <img
                                src={activeCrossValidationReplicaPageUrl}
                                alt={`추출 결과 페이지 ${activeCrossValidationPageIndex + 1}`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                추출 결과 페이지가 없습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    텍스트 추출이 끝난 뒤 `교차 검증`을 실행하면, 원본 PDF와 현재 출력 결과를 이 영역에서 병치하거나 겹쳐서 확인할 수 있습니다.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

        </div>

        <div className="space-y-6">
          {frameEditorActive ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>프레임 편집</CardTitle>
                <CardDescription>
                  선택한 프레임을 합치거나 나누고, key/value 체인과 부모 관계를 수동으로 보정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p>선택 수: {selectedFrameGroupIds.length}</p>
                  <p className="break-all">선택 ID: {selectedFrameGroupIds.join(', ') || '-'}</p>
                  {isV109FrameGroupVersion(currentFrameGroupVersionTag) ? (
                    <p className="mt-1 break-all text-xs text-slate-500">현재 프로필: {currentFrameGroupVersionTag}</p>
                  ) : null}
                </div>

                {frameEditorNotice ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    {frameEditorNotice}
                  </div>
                ) : null}

                {selectedFrameGroupIds.length > 1 && !frameMergePromptDismissed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-medium">복수 프레임이 선택되었습니다.</p>
                    <p className="mt-1">선택한 박스를 그대로 유지하거나 바로 병합할 수 있습니다.</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={mergeSelectedFrameGroups}>
                        선택 병합
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFrameMergePromptDismissed(true)}
                      >
                        그대로 유지
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">Value Key</label>
                  <Input
                    value={frameEditorValueKey}
                    onChange={(event) => setFrameEditorValueKey(event.target.value)}
                    placeholder="예: 공동사업자 > 성명(법인명)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">Frame Role</label>
                  <select
                    value={frameEditorRole}
                    onChange={(event) => setFrameEditorRole(event.target.value as FrameEditorRole)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="group">group</option>
                    <option value="key">key</option>
                    <option value="value">value</option>
                    <option value="key_value">key_value</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">Outline Style</label>
                  <select
                    value={frameEditorOutlineStyle}
                    onChange={(event) => setFrameEditorOutlineStyle(event.target.value as FrameOutlineStyle)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="solid">solid</option>
                    <option value="dashed">dashed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">Parent Frame Group</label>
                  <Input
                    value={frameEditorParentGroup}
                    onChange={(event) => setFrameEditorParentGroup(event.target.value)}
                    list="frame-group-id-options"
                    placeholder="parent frame group id"
                  />
                  <datalist id="frame-group-id-options">
                    {availableFrameGroupIds.map((frameGroupId) => (
                      <option key={frameGroupId} value={frameGroupId} />
                    ))}
                  </datalist>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Chain Key</label>
                    <Input
                      value={frameEditorChainKey}
                      onChange={(event) => setFrameEditorChainKey(event.target.value)}
                      placeholder="chain key"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Chain Depth</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={frameEditorChainDepth}
                      onChange={(event) => setFrameEditorChainDepth(event.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Width (px)</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={frameEditorWidthPx}
                      onChange={(event) => setFrameEditorWidthPx(event.target.value)}
                      placeholder="width"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">Height (px)</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={frameEditorHeightPx}
                      onChange={(event) => setFrameEditorHeightPx(event.target.value)}
                      placeholder="height"
                    />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length === 0}
                    onClick={() => {
                      const root = draftPreviewRef.current;
                      if (!root) {
                        return;
                      }
                      const nodes = getFrameEditorNodes(root).filter((node) =>
                        selectedFrameGroupIds.includes(node.getAttribute('data-template-frame-group') || '')
                      );
                      applyFrameEditorMetadata(nodes, {
                        valueKey: frameEditorValueKey,
                        role: frameEditorRole,
                        outlineStyle: frameEditorOutlineStyle,
                        parentGroup: frameEditorParentGroup,
                        chainKey: frameEditorChainKey,
                        chainDepth: frameEditorChainDepth,
                      });
                    }}
                  >
                    메타데이터 적용
                  </Button>
                  <Button
                    variant={frameCreateMode ? 'default' : 'outline'}
                    onClick={() => {
                      setFrameCreateMode((previous) => !previous);
                      setFrameEditorNotice(null);
                    }}
                  >
                    생성 모드
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!isV109FrameGroupVersion(currentFrameGroupVersionTag)}
                    onClick={saveCurrentFrameProfile}
                  >
                    프로필 저장
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length === 0}
                    onClick={() => deleteSelectedFrameGroups()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    선택 삭제
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length !== 1}
                    onClick={applySelectedFrameSize}
                  >
                    크기 적용
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length < 2}
                    onClick={linkSelectedFrameGroups}
                  >
                    첫 선택을 부모로 연결
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length < 2}
                    onClick={mergeSelectedFrameGroups}
                  >
                    선택 병합
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length !== 1}
                    onClick={() => splitSelectedFrameGroup('vertical')}
                  >
                    세로 분할
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length !== 1}
                    onClick={() => splitSelectedFrameGroup('horizontal')}
                  >
                    가로 분할
                  </Button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length === 0}
                    onClick={() => snapSelectedFrameGroups('left')}
                  >
                    좌측 스냅
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length === 0}
                    onClick={() => snapSelectedFrameGroups('right')}
                  >
                    우측 스냅
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length === 0}
                    onClick={() => snapSelectedFrameGroups('top')}
                  >
                    상단 스냅
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedFrameGroupIds.length === 0}
                    onClick={() => snapSelectedFrameGroups('bottom')}
                  >
                    하단 스냅
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>원본 문서 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">원본 제목</label>
                  <Input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">업로드 파일</label>
                  <input
                    type="file"
                    accept=".txt,.html,.htm,.docx,.pdf,text/plain,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>선택된 파일: {selectedFile ? selectedFile.name : '없음'}</p>
                <p>파일 형식: {selectedFile?.type || '-'}</p>
              </div>

              <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-slate-800">템플릿 관리</label>
                  {viewingRegisteredTemplate ? <Badge variant="green">현재 편집 중</Badge> : null}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">등록된 정식 템플릿</label>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <EntityPicker
                      value={selectedRegisteredTemplateId}
                      options={registeredTemplateOptions}
                      onChange={setSelectedRegisteredTemplateId}
                      placeholder="정식 템플릿을 선택하세요"
                      emptyMessage="저장된 템플릿이 없습니다."
                      className="flex-1"
                      triggerClassName="h-9 min-h-9 items-center rounded-md py-1"
                      optionLayout="inline"
                      onDeleteOption={(option) => void handleDeleteRegisteredTemplate(option.id)}
                      deleteOptionLabel="정식 템플릿 삭제"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadRegisteredTemplate(selectedRegisteredTemplateId)}
                      disabled={loading || !selectedRegisteredTemplateId.trim()}
                    >
                      정식 템플릿 불러오기
                    </Button>
                  </div>
                </div>

                {!viewingRegisteredTemplate ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">최근 초안 선택</label>
                    <EntityPicker
                      value={selectedDraftId}
                      options={recentDrafts}
                      onChange={setSelectedDraftId}
                      placeholder="최근 초안을 선택하세요"
                      emptyMessage="최근 초안이 없습니다."
                      className="flex-1"
                      triggerClassName="h-9 min-h-9 items-center rounded-md py-1"
                      optionLayout="inline"
                      onDeleteOption={handleDeleteRecentDraft}
                      deleteOptionLabel="최근 초안 삭제"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    현재 정식 템플릿 ID: {loadedTemplateId}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">템플릿 이름</label>
                    <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">레이아웃 확장 정책</label>
                    <select
                      value={layoutResizeMode}
                      onChange={(event) =>
                        setLayoutResizeMode(event.target.value as TemplateLayoutResizeMode)
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="fixed">fixed</option>
                      <option value="grow_height">grow_height</option>
                      <option value="grow_width">grow_width</option>
                    </select>
                  </div>
                </div>

                {viewingRegisteredTemplate ? (
                  <Button
                    variant="outline"
                    onClick={handleSaveRegisteredTemplate}
                    disabled={loading || !draftDetail}
                  >
                    현재 정식 템플릿 저장
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleApprove} disabled={loading || !draftDetail}>
                    정식 템플릿 만들기
                  </Button>
                )}

                {approveResult ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">생성 완료</p>
                    <p>템플릿 ID: {approveResult.templateId}</p>
                    <p>승인 항목 수: {approveResult.approvedFieldCount}</p>
                    <a
                      href={`/templates?templateId=${approveResult.templateId}`}
                      className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                    >
                      생성된 템플릿 열기
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">진행 상태</div>
                    <div className="mt-1 truncate text-sm font-semibold text-sky-950">{unifiedProgress.title}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        unifiedProgressCompleted
                          ? 'green'
                          : unifiedProgressFailed
                            ? 'red'
                            : unifiedProgressActive
                              ? 'amber'
                              : 'slate'
                      }
                    >
                      {unifiedProgressCompleted
                        ? '완료'
                        : unifiedProgressFailed
                          ? '오류'
                          : unifiedProgressActive
                            ? '진행 중'
                            : '대기'}
                    </Badge>
                    <span className="font-semibold">{unifiedProgress.percent}%</span>
                    {unifiedProgressSource === 'draft' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sky-200 bg-white/80 text-sky-950 hover:bg-white"
                        onClick={handleCopyDraftHtml}
                        disabled={!draftDetail?.draft.generatedDraftHtml}
                      >
                        {draftHtmlCopied ? '복사됨' : 'HTML 복사'}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-sky-200 bg-white/80 text-sky-950 hover:bg-white"
                      onClick={handleCopyDraftLog}
                      disabled={!draftDetail || draftLogWriting || viewingRegisteredTemplate}
                    >
                      {draftLogWriting ? '로그 저장 중' : '로그 복사'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-sky-200 bg-white/80 text-sky-950 hover:bg-white"
                      onClick={() => setProgressPanelExpanded((previous) => !previous)}
                    >
                      {progressPanelExpanded ? '최소화' : '펼치기'}
                    </Button>
                  </div>
                </div>

                {progressPanelExpanded ? (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={unifiedProgress.percent}
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          unifiedProgressFailed
                            ? 'bg-rose-500'
                            : unifiedProgressCompleted
                              ? 'bg-emerald-600'
                              : 'bg-sky-600'
                        }`}
                        style={{ width: `${unifiedProgress.percent}%` }}
                      />
                    </div>
                    <div className="mt-3 text-sm font-semibold">{unifiedProgress.stage}</div>
                    <div className="mt-1 text-[11px] leading-5 opacity-90">{unifiedProgress.detail}</div>

                    <div className="mt-3 rounded-md border border-sky-200 bg-white p-3 text-sm text-slate-700">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-slate-950">결과</p>
                          <p className="text-xs text-slate-500">
                            {draftDetail ? draftDetail.draft.sourceTitle || '제목 없음' : '아직 생성된 결과가 없습니다.'}
                          </p>
                        </div>
                      </div>

                      {draftDetail ? (
                        <>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <Badge variant="green">{draftDetail.draft.status}</Badge>
                            {qualityReport ? (
                              <Badge variant="slate">
                                {qualityReport.mode === 'offline' ? 'diagnostic-only' : `${qualityReport.mode}:${qualityReport.passed ? 'pass' : 'review'}`}
                              </Badge>
                            ) : null}
                            {visualSimilarityReport?.measured ? (
                              <Badge variant={visualSimilarityReport.passed ? 'green' : 'slate'}>
                                frame:{formatPercent(visualSimilarityReport.frameScore ?? visualSimilarityReport.overallScore)}
                              </Badge>
                            ) : null}
                            {pipelineTrace ? (
                              <Badge variant="slate">{formatTemplateExtractEngineVersionLabel(pipelineTrace.engineVersion)}</Badge>
                            ) : null}
                          </div>

                          <div className="mt-3 grid gap-x-4 gap-y-1 text-xs text-slate-600 md:grid-cols-2">
                            <p className="break-all">초안 ID: {draftDetail.draft.id}</p>
                            <p>검토 대상: {reviewedFields.length}개</p>
                            <p>승인 예정: {reviewedSummary.accepted}개</p>
                            <p>추가 검토: {reviewedSummary.reviewNeeded}개</p>
                            <p>제외: {reviewedSummary.rejected}개</p>
                          </div>

                          {pipelineTrace || visualSimilarityReport || qualityReport ? (
                            <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                              <summary className="cursor-pointer font-medium text-slate-800">세부 값 보기</summary>
                              <div className="mt-2 space-y-2">
                                {pipelineTrace ? (
                                  <div className="space-y-0.5">
                                    <p className="font-medium text-slate-900">Pipeline Trace</p>
                                    <p>sourceMode: {pipelineTrace.sourceMode}</p>
                                    <p>documentFamily: {pipelineTrace.documentFamily}</p>
                                    <p>cloneBuilder: {pipelineTrace.cloneBuilder}</p>
                                    <p>familyConfidence: {formatScore(pipelineTrace.familyConfidenceScore)}</p>
                                    <p>
                                      topology: p{pipelineTrace.topologySummary.pageCount} / rb
                                      {pipelineTrace.topologySummary.rowBandCount} / hs
                                      {pipelineTrace.topologySummary.horizontalSegmentCount} / vs
                                      {pipelineTrace.topologySummary.verticalSegmentCount}
                                    </p>
                                  </div>
                                ) : null}

                                {visualSimilarityReport ? (
                                  <div className="space-y-0.5">
                                    <p className="font-medium text-slate-900">시각 유사도 측정 결과</p>
                                    <p>measurementMode: {visualSimilarityReport.measurementMode}</p>
                                    <p>tolerancePx: {visualSimilarityReport.tolerancePx}</p>
                                    <p>minimumPassScore: {formatPercent(visualSimilarityReport.minimumPassScore)}</p>
                                    <p>scoreMode: {visualSimilarityReport.scoreMode || 'combined_ink_overlap'}</p>
                                    <p>frameScore: {formatPercent(visualSimilarityReport.frameScore ?? visualSimilarityReport.overallScore)}</p>
                                    <p>textScore: {formatPercent(visualSimilarityReport.textScore ?? 0)}</p>
                                    <p>combinedScore: {formatPercent(visualSimilarityReport.combinedScore ?? visualSimilarityReport.overallScore)}</p>
                                    <p>overallScore: {formatPercent(visualSimilarityReport.overallScore)}</p>
                                    <p>passed: {visualSimilarityReport.passed ? 'true' : 'false'}</p>
                                    <p>pageCount: {visualSimilarityReport.pageCount}</p>
                                    <p>measuredAt: {visualSimilarityReport.measuredAt}</p>
                                  </div>
                                ) : null}

                                {qualityReport ? (
                                  <div className="space-y-0.5">
                                    <p className="font-medium text-slate-900">
                                      {visualSimilarityReport ? '구조 진단값' : '시각 유사도 측정 상태'}
                                    </p>
                                    {!visualSimilarityReport ? (
                                      <p>visualSimilarity: {visualSimilarityMeasuring ? '측정 진행 중' : '미측정'}</p>
                                    ) : null}
                                    <p>measurementMode: structural-diagnostics-only</p>
                                    <p>pageCount: {qualityReport.summary.pageCount}</p>
                                    <p>hardFailures: {qualityReport.summary.hardFailureCount}</p>
                                    <p>fallbackApplied: {qualityReport.fallbackApplied ? 'true' : 'false'}</p>
                                    {qualityReport.fallbackReason ? <p>fallbackReason: {qualityReport.fallbackReason}</p> : null}
                                    {offlineMetrics ? (
                                      <>
                                        <p>pageContract: {formatScore(offlineMetrics.pageContractScore)}</p>
                                        <p>textAnchor: {formatScore(offlineMetrics.textAnchorScore)}</p>
                                        <p>vectorTopology: {formatScore(offlineMetrics.vectorTopologyScore)}</p>
                                        <p>textContent: {formatScore(offlineMetrics.textContentScore)}</p>
                                        <p>placeholderIntegrity: {formatScore(offlineMetrics.placeholderIntegrityScore)}</p>
                                        <p>diagnosticOverall: {formatScore(offlineMetrics.overallScore)}</p>
                                      </>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </details>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>항목 검토</CardTitle>
              <CardDescription>필요한 항목만 승인하고, 불필요한 항목은 제외합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewedFields.length > 0 ? (
                reviewedFields.map((field) => {
                  const candidate = candidateMap.get(field.candidateKey || '');
                  const isSelected = selectedCandidateKey === field.candidateKey;
                  const fieldValueText = reviewedFieldValueText(field, candidate);

                  return (
                    <div
                      key={field.candidateKey || field.fieldKey}
                      tabIndex={0}
                      onClick={() => selectReviewedField(field)}
                      onFocusCapture={() => selectReviewedField(field)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) {
                          return;
                        }

                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          selectReviewedField(field);
                        }
                      }}
                      className={`rounded-lg border p-3 text-sm text-slate-700 transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-100'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            field.reviewStatus === 'accepted'
                              ? 'green'
                              : field.reviewStatus === 'rejected'
                                ? 'slate'
                                : 'slate'
                          }
                        >
                          {field.reviewStatus}
                        </Badge>
                        <Input
                          value={field.fieldLabel}
                          onFocus={() => selectReviewedField(field)}
                          onChange={(event) =>
                            updateReviewedField(field.candidateKey, { fieldLabel: event.target.value })
                          }
                        />
                      </div>
                      <div className="mt-3 grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500">감지된 값</p>
                            <p className="text-sm text-slate-700">{candidate?.detectedValue || '-'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500">필드 타입</p>
                            <p className="text-sm text-slate-700">{field.fieldType}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-500">선택 항목 수정값</label>
                          {field.fieldType === 'textarea' ? (
                            <textarea
                              value={fieldValueText}
                              onFocus={() => selectReviewedField(field)}
                              onChange={(event) => handleReviewedFieldValueChange(field, event.target.value)}
                              className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          ) : (
                            <Input
                              value={fieldValueText}
                              onFocus={() => selectReviewedField(field)}
                              onChange={(event) => handleReviewedFieldValueChange(field, event.target.value)}
                            />
                          )}
                          <p className="text-xs text-slate-500">
                            이 값은 왼쪽 초안의 선택된 텍스트와 승인될 HTML에 즉시 반영됩니다.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-500">이 항목 처리</label>
                          <select
                            value={field.reviewStatus || 'review_needed'}
                            onChange={(event) =>
                              updateReviewedField(field.candidateKey, {
                                reviewStatus: event.target.value as TemplateExtractReviewedFieldInput['reviewStatus'],
                              })
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="accepted">템플릿 항목으로 저장</option>
                            <option value="review_needed">조금 더 검토</option>
                            <option value="rejected">이번 템플릿에서 제외</option>
                          </select>
                        </div>
                        <p className="text-xs text-slate-500">추출 근거: {candidate?.extractionReason || '-'}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">생성된 초안이 있으면 검토 항목이 나타납니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <iframe
        ref={visualMeasurementFrameRef}
        title="visual-similarity-measurement-frame"
        aria-hidden="true"
        tabIndex={-1}
        sandbox="allow-same-origin"
        className="pointer-events-none fixed -left-[200vw] top-0 h-px w-px opacity-0"
      />
    </div>
  );
}
