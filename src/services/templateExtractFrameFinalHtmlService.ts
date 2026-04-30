import type {
  TemplateExtractFrameTextMode,
  TemplateExtractImageFrameTextVersion,
  TemplateExtractNonImageFrameTextVersion,
  TemplateExtractReplicaRenderModel,
  TemplateExtractReplicaRenderPage,
  TemplateExtractReplicaRenderTextItem,
  TemplateExtractResolvedSource,
} from '../lib/templateExtractDtos';
import { TemplateExtractFrameTextService } from './templateExtractFrameTextService';
import {
  TemplateExtractHtmlRenderService,
  type TemplateExtractMeasuredFrameNode,
} from './templateExtractHtmlRenderService';
import { TemplateExtractReplicaRenderService } from './templateExtractReplicaRenderService';

type FrameNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FrameWritePolicy = 'display_accept' | 'display_review' | 'blank_review' | 'blank_accept' | 'hidden_ignore';

type FrameTextMeta = {
  writePolicy?: FrameWritePolicy;
  visible?: boolean;
  needsReview?: boolean;
  selectedBy?: string;
  fieldType?: string;
  semanticRole?: string;
};

type MeasuredFramePlan = TemplateExtractMeasuredFrameNode & {
  key: string;
  frameRect: FrameNodeRect;
  fieldType: ImageFrameTextFieldType;
  semanticRole: ImageFrameTextSemanticRole;
  expectedPattern: string;
};

type FrameTextUpdate = {
  domIndex: number;
  pageNumber: number;
  key: string;
  text: string;
  frameGroup: string;
  valueKey: string;
  colorGroup: string;
  meta?: FrameTextMeta;
};

type FrameTextRenderModel = TemplateExtractReplicaRenderModel & {
  diagnostics?: {
    frameResults?: Record<string, string>;
    frameDebug?: ImageFrameDebugEntry[];
    frameReviewFlags?: Record<string, boolean>;
    imageOcrVersion?: TemplateExtractImageFrameTextVersion;
    fieldAwareEnabled?: boolean;
    detectionFirstEnabled?: boolean;
    ocrLayerSummary?: Record<string, unknown> | null;
    frameAssignmentSummary?: Record<string, unknown> | null;
    pageTextOutput?: Array<{ pageNumber: number; text: string }>;
    ocrPageLayers?: unknown[];
  };
};

type ImageFrameDebugEntry = {
  key?: string;
  pageNumber?: number;
  selectedText?: string;
  displayText?: string;
  writePolicy?: string;
  selectedBy?: string;
  needsReview?: boolean;
  fieldType?: string;
  semanticRole?: string;
  normalizedRectPdf?: [number, number, number, number];
};

type ImageFrameTextSemanticRole =
  | 'label'
  | 'value'
  | 'footer'
  | 'barcode'
  | 'stamp'
  | 'qr'
  | 'ignore'
  | 'unknown';

type ImageFrameTextFieldType =
  | 'fixed_enum'
  | 'business_registration_number'
  | 'resident_or_corporate_number_masked'
  | 'issue_number'
  | 'receipt_number'
  | 'date'
  | 'phone'
  | 'korean_name'
  | 'address'
  | 'free_text'
  | 'ignore';

export type TemplateExtractFrameTextDecision = {
  mode: TemplateExtractFrameTextMode;
  frameTextExtractionVersion?: TemplateExtractNonImageFrameTextVersion;
  imageFrameTextExtractionVersion?: TemplateExtractImageFrameTextVersion;
};

const ATTRIBUTE_REGEX = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g;
const FRAME_NODE_REGEX =
  /<(td|div)\b(?=[^>]*\bdata-template-frame-group="[^"]+")(?=[^>]*\bclass="[^"]*\bv202-frame-group\b[^"]*")([^>]*)>([\s\S]*?)<\/\1>/gi;
const TEXTAREA_REGEX = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/i;
const RENDER_MODEL_SCRIPT_PATTERN =
  /<script\b[^>]*data-template-render-model="positioned-v1"[^>]*>[\s\S]*?<\/script>/i;
const STATUS_HISTORY_LINE_PATTERN = /^(CAE|CE|CAM|PM)\s+.+?\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const decodeHtml = (value: string) =>
  String(value || '').replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (matched) => HTML_ENTITY_MAP[matched] || matched);

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttribute = escapeHtml;

const buildFrameTextKey = ({
  pageNumber,
  frameGroup,
  rowStart,
  rowEnd,
  colStart,
  colEnd,
}: {
  pageNumber: number;
  frameGroup: string;
  rowStart?: string;
  rowEnd?: string;
  colStart?: string;
  colEnd?: string;
}) => [pageNumber, frameGroup, rowStart || '', rowEnd || '', colStart || '', colEnd || ''].join('::');

const parseTagAttributes = (value: string) => {
  const attrs: Record<string, string> = {};

  for (const match of String(value || '').matchAll(ATTRIBUTE_REGEX)) {
    attrs[match[1]] = decodeHtml(match[2]);
  }

  return attrs;
};

const removeHtmlAttr = (attrs: string, name: string) =>
  String(attrs || '').replace(new RegExp(`\\s${name}="[^"]*"`, 'gi'), '');

const upsertHtmlAttr = (attrs: string, name: string, value: string | null | undefined) => {
  const withoutAttr = removeHtmlAttr(attrs, name);

  if (value === null || value === undefined || value === '') {
    return withoutAttr;
  }

  return `${withoutAttr} ${name}="${escapeAttribute(value)}"`;
};

const normalizeExtractedFrameText = (value: string) =>
  String(value || '')
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

  return (normalized.match(/\d/g) || []).length <= 8;
};

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

const overlapLength = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

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

type FrameTextSelectionPlan = {
  key: string;
  frameRect: FrameNodeRect;
  sourceTextHint: string;
  valueKey?: string;
  frameGroup?: string;
  colorGroup?: string;
  semanticRole?: ImageFrameTextSemanticRole;
  fieldType?: ImageFrameTextFieldType;
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
      const horizontalOverlap = overlapLength(frameRect.left, frameRect.left + frameRect.width, left, left + width);
      const verticalOverlap = overlapLength(frameRect.top, frameRect.top + frameRect.height, top, top + height);
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

const isHintlessValueFramePlan = (plan: Pick<FrameTextSelectionPlan, 'sourceTextHint' | 'valueKey' | 'semanticRole'>) => {
  if (normalizeExtractedFrameText(plan.sourceTextHint)) {
    return false;
  }

  if (String(plan.semanticRole || '').trim().toLowerCase() === 'value') {
    return true;
  }

  return Boolean(String(plan.valueKey || '').trim());
};

const isStrongHintlessValueFrameCandidate = (item: FrameRenderCandidateItem) =>
  item.insideStrict ||
  ((item.distanceX + item.distanceY) <= 1.5 && item.overlapArea > 0 && item.overlapRatio >= 0.6);

const filterFrameRenderCandidatesForPlan = (
  candidateItems: FrameRenderCandidateItem[],
  plan: Pick<FrameTextSelectionPlan, 'sourceTextHint' | 'valueKey' | 'semanticRole'>
) => {
  if (!isHintlessValueFramePlan(plan)) {
    return candidateItems;
  }

  return candidateItems.filter((item) => isStrongHintlessValueFrameCandidate(item));
};

const isViableFrameRenderCandidateV112 = (item: FrameRenderCandidateItem) =>
  item.insideStrict ||
  (item.overlapArea > 0 && item.overlapRatio >= 0.14) ||
  ((item.hintAffinity || 0) >= 0.5 && item.insideLoose);

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

const selectFrameRenderCandidateItemsV101 = (page: TemplateExtractReplicaRenderPage, frameRect: FrameNodeRect) =>
  mapFrameRenderCandidateItems(page, frameRect)
    .filter((item) => item.insideStrict || (item.overlapArea > 0 && item.overlapRatio >= 0.28))
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
    .filter(
      (item) =>
        item.insideStrict ||
        (item.overlapArea > 0 && item.overlapRatio >= 0.16) ||
        ((item.hintAffinity || 0) >= 0.55 && item.insideLoose)
    )
    .sort((left, right) => {
      if (Math.abs(left.top - right.top) > 3) {
        return left.top - right.top;
      }

      if (Math.abs(left.left - right.left) > 2) {
        return left.left - right.left;
      }

      return (right.score || 0) - (left.score || 0);
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
      const extraLengthPenalty =
        Math.max(0, candidateText.length - normalizedHint.length) / Math.max(8, normalizedHint.length);
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

const resolveFrameTextExtractionV112 = (assignedText: string, localText: string, sourceTextHint: string) => {
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
  framePlans: FrameTextSelectionPlan[]
) => {
  if (!page || !framePlans.length) {
    return {} as Record<string, string>;
  }

  const assignments = new Map<string, FrameRenderCandidateItem[]>();
  const localCandidatesByKey = new Map<string, FrameRenderCandidateItem[]>();
  const scoredByItemIndex = new Map<number, Array<{ key: string; item: FrameRenderCandidateItem }>>();

  framePlans.forEach((plan) => {
    const candidates = filterFrameRenderCandidatesForPlan(
      mapFrameRenderCandidateItems(page, plan.frameRect)
        .map((item) => scoreFrameRenderCandidateItemV112(item, plan.sourceTextHint))
        .filter((item) => isViableFrameRenderCandidateV112(item)),
      plan
    )
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

  return framePlans.reduce<Record<string, string>>((nextState, plan) => {
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

const extractFrameTextFromRenderPage = (
  page: TemplateExtractReplicaRenderPage | null | undefined,
  frameRect: FrameNodeRect,
  version: TemplateExtractNonImageFrameTextVersion,
  sourceTextHint = '',
  metadata?: Pick<FrameTextSelectionPlan, 'valueKey' | 'frameGroup' | 'colorGroup' | 'semanticRole' | 'fieldType'>
) => {
  if (!page) {
    return '';
  }

  const selectionPlan = {
    key: '',
    frameRect,
    sourceTextHint,
    valueKey: metadata?.valueKey,
    frameGroup: metadata?.frameGroup,
    colorGroup: metadata?.colorGroup,
    semanticRole: metadata?.semanticRole,
    fieldType: metadata?.fieldType,
  } satisfies FrameTextSelectionPlan;

  switch (version) {
    case 'niv1.12': {
      const candidateItems = filterFrameRenderCandidatesForPlan(
        selectFrameRenderCandidateItemsV102(page, frameRect, sourceTextHint).map((item) =>
          scoreFrameRenderCandidateItemV112(item, sourceTextHint)
        ),
        selectionPlan
      );
      const renderText = selectBestFrameRenderTextWindowV102(candidateItems, sourceTextHint);
      return resolveFrameTextExtractionV112(renderText, renderText, sourceTextHint);
    }
    case 'niv1.02': {
      const candidateItems = filterFrameRenderCandidatesForPlan(
        selectFrameRenderCandidateItemsV102(page, frameRect, sourceTextHint),
        selectionPlan
      );
      const renderText = selectBestFrameRenderTextWindowV102(candidateItems, sourceTextHint);
      return resolveFrameTextExtractionV102(renderText, sourceTextHint);
    }
    case 'niv1.01':
    default:
      return buildFrameTextFromCandidateItems(selectFrameRenderCandidateItemsV101(page, frameRect));
  }
};

const compactImageFrameLabel = (value: string) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/[\s()[\]|ㆍ·:：/\\,._-]+/g, '')
    .trim();

const resolveImageFrameIgnoreRole = (frameGroup: string): ImageFrameTextSemanticRole | null => {
  const normalizedGroup = String(frameGroup || '').trim().toLowerCase();

  if (!normalizedGroup) {
    return null;
  }

  if (normalizedGroup.includes('barcode')) {
    return 'barcode';
  }

  if (normalizedGroup.includes('qr')) {
    return 'qr';
  }

  if (normalizedGroup.includes('footer')) {
    return 'footer';
  }

  if (normalizedGroup.includes('header')) {
    return 'ignore';
  }

  return null;
};

const resolveImageFrameFieldTypeFromLabel = (value: string): ImageFrameTextFieldType | null => {
  const label = compactImageFrameLabel(value);

  if (!label) {
    return null;
  }

  if ((label.includes('사업자') && label.includes('등록') && label.includes('번호')) || label.includes('사업등록번호')) {
    return 'business_registration_number';
  }

  if ((label.includes('주민') || label.includes('법인')) && label.includes('등록') && (label.includes('번호') || label.includes('번번호'))) {
    return 'resident_or_corporate_number_masked';
  }

  if (label.includes('처리') && label.includes('기간')) {
    return 'fixed_enum';
  }

  if (label.includes('발급') && label.includes('번호')) {
    return 'issue_number';
  }

  if (label.includes('접수') && label.includes('번호')) {
    return 'receipt_number';
  }

  if (label.includes('연락처') || (label.includes('전화') && label.includes('번호'))) {
    return 'phone';
  }

  if ((label.includes('개업') && label.includes('일')) || label.includes('등록일') || label.includes('발급일')) {
    return 'date';
  }

  if (label === '즉시' || label === '죽시' || label === '즉' || label === '시') {
    return 'fixed_enum';
  }

  if (label.includes('소재지')) {
    return 'address';
  }

  if (label.includes('상호') || label.includes('대표자') || label.includes('성명')) {
    return 'korean_name';
  }

  if (label.includes('업태') || label.includes('종목')) {
    return 'free_text';
  }

  return null;
};

const inferImageFrameFieldType = (valueKey: string, sourceTextHint: string, frameGroup: string): ImageFrameTextFieldType => {
  if (resolveImageFrameIgnoreRole(frameGroup)) {
    return 'ignore';
  }

  for (const candidate of [valueKey, frameGroup, sourceTextHint]) {
    const resolved = resolveImageFrameFieldTypeFromLabel(candidate);

    if (resolved) {
      return resolved;
    }
  }

  return 'free_text';
};

const inferImageFrameSemanticRole = (
  valueKey: string,
  sourceTextHint: string,
  fieldType: ImageFrameTextFieldType,
  frameGroup: string,
  colStart: string
): ImageFrameTextSemanticRole => {
  const ignoreRole = resolveImageFrameIgnoreRole(frameGroup);
  const colStartNumber = Number.parseInt(colStart || '0', 10);

  if (fieldType === 'ignore') {
    return ignoreRole || 'ignore';
  }

  if (ignoreRole) {
    return ignoreRole;
  }

  if (valueKey.trim()) {
    return 'value';
  }

  if (colStartNumber > 1 && (fieldType !== 'free_text' || /[0-9가-힣]/.test(sourceTextHint))) {
    return 'value';
  }

  if (fieldType !== 'free_text') {
    return /\d/.test(sourceTextHint) ? 'value' : 'label';
  }

  return 'unknown';
};

const buildImageFrameExpectedPattern = (fieldType: ImageFrameTextFieldType) => {
  switch (fieldType) {
    case 'business_registration_number':
      return '\\d{3}-\\d{2}-\\d{5}';
    case 'resident_or_corporate_number_masked':
      return '\\d{6}-(?:\\d{7}|\\*{7})';
    case 'issue_number':
      return '\\d{4}-\\d{3}-\\d{4}-\\d{3}';
    case 'receipt_number':
      return '\\d{12}';
    case 'phone':
      return '\\d{2,3}-\\d{3,4}-\\d{4}';
    case 'date':
      return '\\d{4}년\\s*\\d{1,2}월\\s*\\d{1,2}일';
    default:
      return '';
  }
};

const normalizeFrameWritePolicy = (value: string | null | undefined): FrameWritePolicy => {
  switch (String(value || '').trim()) {
    case 'display_accept':
    case 'display_review':
    case 'blank_review':
    case 'blank_accept':
    case 'hidden_ignore':
      return String(value).trim() as FrameWritePolicy;
    default:
      return 'display_review';
  }
};

const resolveImageFrameTextDisplayState = ({
  debugEntry,
  rawFrameText,
  sourceTextHint,
  metadata,
}: {
  debugEntry: ImageFrameDebugEntry | null | undefined;
  rawFrameText: string;
  sourceTextHint: string;
  metadata: {
    frameGroup?: string | null;
    valueKey?: string | null;
    colorGroup?: string | null;
  };
}) => {
  const writePolicy = normalizeFrameWritePolicy(debugEntry?.writePolicy);
  const selectedText = formatFrameSourceTextForDisplay(String(debugEntry?.selectedText || ''), metadata);
  const displayText = formatFrameSourceTextForDisplay(
    String(debugEntry?.displayText || rawFrameText || selectedText || ''),
    metadata
  );
  const fallbackSourceText = formatFrameSourceTextForDisplay(sourceTextHint, metadata);
  const semanticRole = String(debugEntry?.semanticRole || '').trim().toLowerCase();
  const fieldType = String(debugEntry?.fieldType || '').trim().toLowerCase();

  if (writePolicy === 'hidden_ignore') {
    return {
      text: '',
      visible: false,
      writePolicy,
      needsReview: Boolean(debugEntry?.needsReview),
      selectedBy: String(debugEntry?.selectedBy || ''),
      fieldType,
      semanticRole,
    };
  }

  if (displayText) {
    return {
      text: displayText,
      visible: true,
      writePolicy,
      needsReview: Boolean(debugEntry?.needsReview),
      selectedBy: String(debugEntry?.selectedBy || ''),
      fieldType,
      semanticRole,
    };
  }

  if (selectedText) {
    return {
      text: selectedText,
      visible: true,
      writePolicy,
      needsReview: Boolean(debugEntry?.needsReview),
      selectedBy: String(debugEntry?.selectedBy || ''),
      fieldType,
      semanticRole,
    };
  }

  if (writePolicy === 'blank_review' || writePolicy === 'blank_accept') {
    return {
      text: '',
      visible: true,
      writePolicy,
      needsReview: Boolean(debugEntry?.needsReview),
      selectedBy: String(debugEntry?.selectedBy || ''),
      fieldType,
      semanticRole,
    };
  }

  return {
    text: fallbackSourceText,
    visible: true,
    writePolicy,
    needsReview: Boolean(debugEntry?.needsReview),
    selectedBy: String(debugEntry?.selectedBy || ''),
    fieldType,
    semanticRole,
  };
};

const buildImageFrameDebugEntryMap = (renderModel: FrameTextRenderModel) =>
  new Map(
    (renderModel.diagnostics?.frameDebug || [])
      .filter((entry) => String(entry?.key || '').trim())
      .map((entry) => [String(entry.key).trim(), entry] as const)
  );

const buildAppliedImageFrameTextRenderModel = (
  renderModel: FrameTextRenderModel,
  appliedFrameResults: Record<string, string>,
  imageOcrVersion: TemplateExtractImageFrameTextVersion
) => {
  const frameDebug = renderModel.diagnostics?.frameDebug || [];
  const textItemsByPageNumber = new Map<number, TemplateExtractReplicaRenderPage['textItems']>();

  frameDebug.forEach((entry) => {
    const nextText = normalizeExtractedFrameText(appliedFrameResults[String(entry.key || '')] || '');
    const rect = entry.normalizedRectPdf;

    if (!nextText || !rect || rect.length !== 4) {
      return;
    }

    const [left, top, right, bottom] = rect;
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    if (width <= 0 || height <= 0) {
      return;
    }

    const pageNumber = Number.parseInt(String(entry.pageNumber || '1'), 10) || 1;
    const pageTextItems = textItemsByPageNumber.get(pageNumber) || [];
    pageTextItems.push({
      kind: 'plain_text',
      left,
      top,
      width,
      height,
      fontSize: Math.max(1, Number((height * 0.72).toFixed(2))),
      lineHeight: Number(height.toFixed(2)),
      fontWeight: 400,
      text: nextText,
    });
    textItemsByPageNumber.set(pageNumber, pageTextItems);
  });

  return {
    ...renderModel,
    pages: (renderModel.pages || []).map((page) => ({
      ...page,
      textItems: textItemsByPageNumber.get(page.pageNumber) || [],
    })),
    diagnostics: {
      ...(renderModel.diagnostics || {}),
      frameResults: appliedFrameResults,
      frameReviewFlags: Object.fromEntries(
        frameDebug.map((entry) => [String(entry.key || ''), Boolean(entry.needsReview)] as const).filter(([key]) => key)
      ),
      imageOcrVersion,
      fieldAwareEnabled:
        imageOcrVersion === 'iv2.02' ||
        imageOcrVersion === 'iv2.03' ||
        imageOcrVersion === 'iv2.04' ||
        imageOcrVersion === 'iv3.00' ||
        renderModel.diagnostics?.fieldAwareEnabled === true,
      detectionFirstEnabled:
        imageOcrVersion === 'iv2.03' ||
        imageOcrVersion === 'iv2.04' ||
        imageOcrVersion === 'iv3.00' ||
        Boolean(renderModel.diagnostics?.detectionFirstEnabled),
      ocrLayerSummary: renderModel.diagnostics?.ocrLayerSummary || null,
      frameAssignmentSummary: renderModel.diagnostics?.frameAssignmentSummary || null,
      pageTextOutput: renderModel.diagnostics?.pageTextOutput || [],
      ocrPageLayers: renderModel.diagnostics?.ocrPageLayers || [],
      frameDebug,
    },
  } satisfies FrameTextRenderModel;
};

const isStrictImageDebugVersion = (version: TemplateExtractImageFrameTextVersion) =>
  version === 'iv2.02' || version === 'iv2.03' || version === 'iv2.04' || version === 'iv3.00';

const buildMeasuredFramePlans = (
  measuredNodes: TemplateExtractMeasuredFrameNode[],
  renderModel: TemplateExtractReplicaRenderModel | null
) => {
  const pageDimensionsByPageNumber = new Map(
    (renderModel?.pages || []).map((page) => [page.pageNumber, { pdfPageWidth: page.width, pdfPageHeight: page.height }] as const)
  );

  return measuredNodes
    .filter((node) => node.width > 0 && node.height > 0 && node.frameGroup.trim())
    .map((node) => {
      const frameRect = {
        left: node.left,
        top: node.top,
        width: node.width,
        height: node.height,
      } satisfies FrameNodeRect;
      const key = buildFrameTextKey({
        pageNumber: node.pageNumber,
        frameGroup: node.frameGroup,
        rowStart: node.rowStart,
        rowEnd: node.rowEnd,
        colStart: node.colStart,
        colEnd: node.colEnd,
      });
      const fieldType = inferImageFrameFieldType(node.valueKey, node.sourceTextHint, node.frameGroup);
      const semanticRole = inferImageFrameSemanticRole(
        node.valueKey,
        node.sourceTextHint,
        fieldType,
        node.frameGroup,
        node.colStart
      );
      const pageDimensions = pageDimensionsByPageNumber.get(node.pageNumber);

      return {
        ...node,
        key,
        frameRect,
        fieldType,
        semanticRole,
        expectedPattern: buildImageFrameExpectedPattern(fieldType),
        viewportWidth: node.viewportWidth || pageDimensions?.pdfPageWidth || 0,
        viewportHeight: node.viewportHeight || pageDimensions?.pdfPageHeight || 0,
      } satisfies MeasuredFramePlan;
    });
};

const buildImageFrameRequestPlans = (
  measuredPlans: MeasuredFramePlan[],
  renderModel: TemplateExtractReplicaRenderModel | null
) => {
  const pageDimensionsByPageNumber = new Map(
    (renderModel?.pages || []).map((page) => [page.pageNumber, { pdfPageWidth: page.width, pdfPageHeight: page.height }] as const)
  );

  return measuredPlans.map((plan) => {
    const pageDimensions = pageDimensionsByPageNumber.get(plan.pageNumber);

    return {
      key: plan.key,
      pageNumber: plan.pageNumber,
      left: plan.left,
      top: plan.top,
      width: plan.width,
      height: plan.height,
      coordinateSpace: 'css-px' as const,
      viewportWidth: plan.viewportWidth,
      viewportHeight: plan.viewportHeight,
      pdfPageWidth: Number(pageDimensions?.pdfPageWidth || 0),
      pdfPageHeight: Number(pageDimensions?.pdfPageHeight || 0),
      rowStart: plan.rowStart,
      rowEnd: plan.rowEnd,
      colStart: plan.colStart,
      colEnd: plan.colEnd,
      semanticRole: plan.semanticRole,
      fieldType: plan.fieldType,
      expectedPattern: plan.expectedPattern,
      sourceTextHint: plan.sourceTextHint,
      frameGroup: plan.frameGroup,
      valueKey: plan.valueKey,
      colorGroup: plan.colorGroup,
    };
  });
};

const applyFrameTextUpdatesToHtml = (html: string, updates: FrameTextUpdate[]) => {
  if (!html.trim() || !updates.length) {
    return html;
  }

  const updatesByDomIndex = new Map(updates.map((update) => [update.domIndex, update] as const));
  let domIndex = 0;

  return html.replace(FRAME_NODE_REGEX, (match, tag: string, attrs: string, inner: string) => {
    const update = updatesByDomIndex.get(domIndex);
    domIndex += 1;

    if (!update) {
      return match;
    }

    let nextAttrs = attrs;
    nextAttrs = upsertHtmlAttr(nextAttrs, 'data-template-frame-page', String(update.pageNumber));
    nextAttrs = upsertHtmlAttr(nextAttrs, 'data-template-frame-extracted-text', update.text || null);
    nextAttrs = upsertHtmlAttr(nextAttrs, 'data-template-frame-write-policy', update.meta?.writePolicy || null);
    nextAttrs = upsertHtmlAttr(nextAttrs, 'data-template-frame-selected-by', update.meta?.selectedBy || null);
    nextAttrs = upsertHtmlAttr(
      nextAttrs,
      'data-template-frame-display-visible',
      typeof update.meta?.visible === 'boolean' ? String(update.meta.visible) : null
    );
    nextAttrs = upsertHtmlAttr(
      nextAttrs,
      'data-template-frame-needs-review',
      typeof update.meta?.needsReview === 'boolean' ? String(update.meta.needsReview) : null
    );
    nextAttrs = upsertHtmlAttr(nextAttrs, 'data-template-frame-field-type', update.meta?.fieldType || null);
    nextAttrs = upsertHtmlAttr(nextAttrs, 'data-template-frame-semantic-role', update.meta?.semanticRole || null);

    const nextInner = inner.replace(TEXTAREA_REGEX, (_textareaMatch, textareaAttrs: string) => {
      let nextTextareaAttrs = textareaAttrs;
      nextTextareaAttrs = upsertHtmlAttr(nextTextareaAttrs, 'data-template-frame-page', String(update.pageNumber));
      nextTextareaAttrs = upsertHtmlAttr(nextTextareaAttrs, 'data-template-frame-extracted-text', update.text || null);
      nextTextareaAttrs = upsertHtmlAttr(
        nextTextareaAttrs,
        'data-template-frame-write-policy',
        update.meta?.writePolicy || null
      );
      nextTextareaAttrs = upsertHtmlAttr(
        nextTextareaAttrs,
        'data-template-frame-selected-by',
        update.meta?.selectedBy || null
      );
      nextTextareaAttrs = upsertHtmlAttr(
        nextTextareaAttrs,
        'data-template-frame-display-visible',
        typeof update.meta?.visible === 'boolean' ? String(update.meta.visible) : null
      );
      nextTextareaAttrs = upsertHtmlAttr(
        nextTextareaAttrs,
        'data-template-frame-needs-review',
        typeof update.meta?.needsReview === 'boolean' ? String(update.meta.needsReview) : null
      );
      nextTextareaAttrs = upsertHtmlAttr(
        nextTextareaAttrs,
        'data-template-frame-field-type',
        update.meta?.fieldType || null
      );
      nextTextareaAttrs = upsertHtmlAttr(
        nextTextareaAttrs,
        'data-template-frame-semantic-role',
        update.meta?.semanticRole || null
      );

      return `<textarea${nextTextareaAttrs}>${escapeHtml(update.text)}</textarea>`;
    });

    return `<${tag}${nextAttrs}>${nextInner}</${tag}>`;
  });
};

const replaceReplicaRenderModelInHtml = (html: string, renderModel: TemplateExtractReplicaRenderModel | null) => {
  if (!html.trim() || !renderModel) {
    return html;
  }

  const serialized = JSON.stringify(renderModel).replace(/</g, '\\u003c');
  return html.replace(
    RENDER_MODEL_SCRIPT_PATTERN,
    `<script type="application/json" data-template-render-model="positioned-v1">${serialized}</script>`
  );
};

const buildNonImageFrameTextUpdates = (
  renderModel: TemplateExtractReplicaRenderModel,
  plans: MeasuredFramePlan[],
  version: TemplateExtractNonImageFrameTextVersion
) => {
  const pageModelByPageNumber = new Map(
    (renderModel.pages || []).map((page) => [page.pageNumber, page] as const)
  );

  if (version === 'niv1.12') {
    const plansByPageNumber = new Map<number, MeasuredFramePlan[]>();

    plans.forEach((plan) => {
      const pagePlans = plansByPageNumber.get(plan.pageNumber) || [];
      pagePlans.push(plan);
      plansByPageNumber.set(plan.pageNumber, pagePlans);
    });

    const textState = new Map<string, string>();

    plansByPageNumber.forEach((pagePlans, pageNumber) => {
      const pageModel = pageModelByPageNumber.get(pageNumber) || renderModel.pages[0];
      const extracted = extractFrameTextStateFromRenderPageV112(
        pageModel,
        pagePlans.map((plan) => ({
          key: plan.key,
          frameRect: plan.frameRect,
          sourceTextHint: plan.sourceTextHint,
          valueKey: plan.valueKey,
          frameGroup: plan.frameGroup,
          colorGroup: plan.colorGroup,
          semanticRole: plan.semanticRole,
          fieldType: plan.fieldType,
        }))
      );

      Object.entries(extracted).forEach(([key, value]) => {
        textState.set(key, value);
      });
    });

    return plans.map((plan) => ({
      domIndex: plan.domIndex,
      pageNumber: plan.pageNumber,
      key: plan.key,
      text: formatFrameSourceTextForDisplay(textState.get(plan.key) || '', {
        frameGroup: plan.frameGroup,
        valueKey: plan.valueKey,
        colorGroup: plan.colorGroup,
      }),
      frameGroup: plan.frameGroup,
      valueKey: plan.valueKey,
      colorGroup: plan.colorGroup,
    }));
  }

  return plans.map((plan) => {
    const pageModel = pageModelByPageNumber.get(plan.pageNumber) || renderModel.pages[0];
    const nextText = extractFrameTextFromRenderPage(pageModel, plan.frameRect, version, plan.sourceTextHint, {
      valueKey: plan.valueKey,
      frameGroup: plan.frameGroup,
      colorGroup: plan.colorGroup,
      semanticRole: plan.semanticRole,
      fieldType: plan.fieldType,
    });

    return {
      domIndex: plan.domIndex,
      pageNumber: plan.pageNumber,
      key: plan.key,
      text: formatFrameSourceTextForDisplay(nextText, {
        frameGroup: plan.frameGroup,
        valueKey: plan.valueKey,
        colorGroup: plan.colorGroup,
      }),
      frameGroup: plan.frameGroup,
      valueKey: plan.valueKey,
      colorGroup: plan.colorGroup,
    };
  });
};

const buildImageFrameTextUpdates = (
  renderModel: FrameTextRenderModel,
  plans: MeasuredFramePlan[],
  imageOcrVersion: TemplateExtractImageFrameTextVersion
) => {
  const frameResults = renderModel.diagnostics?.frameResults || {};
  const frameDebugByKey = buildImageFrameDebugEntryMap(renderModel);
  const appliedFrameResults: Record<string, string> = {};

  if (isStrictImageDebugVersion(imageOcrVersion)) {
    const missingFrameDebugKeys = plans
      .map((plan) => plan.key)
      .filter((key) => key && !frameDebugByKey.has(key));

    if (missingFrameDebugKeys.length > 0) {
      throw new Error(
        `텍스트 추출 실패: ${imageOcrVersion} diagnostics.frameDebug가 일부 프레임에 연결되지 않았습니다. (${missingFrameDebugKeys.slice(0, 5).join(', ')})`
      );
    }
  }

  const updates = plans.map((plan) => {
    const debugEntry = frameDebugByKey.get(plan.key);

    if (isStrictImageDebugVersion(imageOcrVersion) && !debugEntry) {
      throw new Error(`텍스트 추출 실패: ${imageOcrVersion} diagnostics.frameDebug가 프레임 ${plan.key} 에 없습니다.`);
    }

    const metadata = {
      frameGroup: plan.frameGroup,
      valueKey: plan.valueKey,
      colorGroup: plan.colorGroup,
    };
    const displayState =
      isStrictImageDebugVersion(imageOcrVersion)
        ? resolveImageFrameTextDisplayState({
            debugEntry,
            rawFrameText: frameResults[plan.key] || '',
            sourceTextHint: plan.sourceTextHint,
            metadata,
          })
        : {
            text: formatFrameSourceTextForDisplay(frameResults[plan.key] || '', metadata),
            visible: Boolean(frameResults[plan.key] || ''),
            writePolicy: 'display_review' as FrameWritePolicy,
            needsReview: false,
            selectedBy: '',
            fieldType: '',
            semanticRole: '',
          };
    const normalizedText = formatFrameSourceTextForDisplay(displayState.text, metadata);
    appliedFrameResults[plan.key] = normalizedText;

    return {
      domIndex: plan.domIndex,
      pageNumber: plan.pageNumber,
      key: plan.key,
      text: normalizedText,
      frameGroup: plan.frameGroup,
      valueKey: plan.valueKey,
      colorGroup: plan.colorGroup,
      meta: {
        writePolicy: displayState.writePolicy,
        visible: displayState.visible,
        needsReview: displayState.needsReview,
        selectedBy: displayState.selectedBy,
        fieldType: displayState.fieldType,
        semanticRole: displayState.semanticRole,
      },
    } satisfies FrameTextUpdate;
  });

  return {
    updates,
    appliedRenderModel: buildAppliedImageFrameTextRenderModel(renderModel, appliedFrameResults, imageOcrVersion),
  };
};

export const TemplateExtractFrameFinalHtmlService = {
  async applyToResolvedSource(
    fileName: string,
    bytes: Uint8Array,
    resolvedSource: TemplateExtractResolvedSource,
    decision: TemplateExtractFrameTextDecision
  ): Promise<TemplateExtractResolvedSource> {
    if (resolvedSource.sourceKind !== 'html') {
      return resolvedSource;
    }

    if (!resolvedSource.sourceContent.includes('data-template-frame-group=')) {
      throw new Error(
        '템플릿 추출 실패: 서버 최종 HTML 텍스트 추출을 위해 프레임 그룹 HTML이 필요합니다. extractionStage=frames 를 확인하세요.'
      );
    }

    let baseRenderModel = TemplateExtractReplicaRenderService.extractRenderModelFromHtml(resolvedSource.sourceContent);

    if (!baseRenderModel) {
      baseRenderModel = await TemplateExtractFrameTextService.extractPdfFrameText(fileName, bytes, {
        forceOcr: false,
      });
    }

    const measuredNodes = await TemplateExtractHtmlRenderService.measureFrameNodes(resolvedSource.sourceContent);
    const plans = buildMeasuredFramePlans(measuredNodes, baseRenderModel);

    if (!plans.length) {
      throw new Error('템플릿 추출 실패: 서버가 HTML 안에서 텍스트 추출 대상 프레임을 찾지 못했습니다.');
    }

    if (decision.mode === 'image') {
      const imageOcrVersion = decision.imageFrameTextExtractionVersion || 'iv1.00';
      const imageRenderModel = (await TemplateExtractFrameTextService.extractPdfFrameText(fileName, bytes, {
        forceOcr: true,
        framePlans: buildImageFrameRequestPlans(plans, baseRenderModel),
        imageOcrVersion,
      })) as FrameTextRenderModel;
      const { updates, appliedRenderModel } = buildImageFrameTextUpdates(imageRenderModel, plans, imageOcrVersion);
      const updatedHtml = replaceReplicaRenderModelInHtml(
        applyFrameTextUpdatesToHtml(resolvedSource.sourceContent, updates),
        appliedRenderModel
      );

      return {
        ...resolvedSource,
        sourceContent: updatedHtml,
      };
    }

    const frameTextExtractionVersion = decision.frameTextExtractionVersion || 'niv1.12';
    const updates = buildNonImageFrameTextUpdates(baseRenderModel, plans, frameTextExtractionVersion);

    return {
      ...resolvedSource,
      sourceContent: applyFrameTextUpdatesToHtml(resolvedSource.sourceContent, updates),
    };
  },
};
