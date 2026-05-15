import type {
  TemplateExtractDetailResult,
  TemplateExtractEngineVersion,
  TemplateExtractFrameGroupVersion,
  TemplateExtractReplicaRenderModel,
  TemplateExtractReplicaRenderPage,
  TemplateExtractReplicaRenderTextItem,
} from './templateExtractDtos';

export const GUARANTEED_TEMPLATE_EXTRACT_FRAME_GROUP_VERSION: TemplateExtractFrameGroupVersion = 'fv1.11';
export const GUARANTEED_TEMPLATE_EXTRACT_FRAME_TEXT_VERSION = 'niv1.12';
export const GUARANTEED_TEMPLATE_EXTRACT_ENGINE_VERSION: TemplateExtractEngineVersion = '47';

type FrameNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FlattenedFramePreviewMarkup = {
  html: string;
  styleText: string;
};

type FrameExtractedTextState = Record<string, string>;

type FrameWritePolicy = 'display_accept' | 'display_review' | 'blank_review' | 'blank_accept' | 'hidden_ignore';

type FrameExtractedTextMetaState = Record<
  string,
  {
    writePolicy: FrameWritePolicy;
    visible: boolean;
    needsReview: boolean;
    selectedBy: string;
    fieldType: string;
    semanticRole: string;
  }
>;

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

const V106_FRAME_NODE_SELECTOR = '[data-v106-frame-node="true"]';
const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SELECTION_NODE_SELECTOR = `${V106_FRAME_NODE_SELECTOR}, ${RAW_FRAME_NODE_SELECTOR}`;
const RENDER_MODEL_SCRIPT_PATTERN =
  /<script\b[^>]*data-template-render-model="positioned-v1"[^>]*>([\s\S]*?)<\/script>/i;
const STATUS_HISTORY_LINE_PATTERN = /^(CAE|CE|CAM|PM)\s+.+?\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

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

  pageSections.forEach((pageSection, pageIndex) => {
    const pageInner = pageSection.querySelector<HTMLElement>(':scope > .page-inner');

    if (!pageInner) {
      return;
    }

    const nextPageInner = pageInner.cloneNode(true) as HTMLElement;
    const pageStyle = pageSection.getAttribute('style') || '';
    const pageWidth = extractStyleValue(pageStyle, 'width');
    const pageMinHeight = extractStyleValue(pageStyle, 'min-height');

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
  };
};

const parsePositiveCssPixelValue = (value: string | null | undefined) => {
  const numeric = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const readFramePreviewScale = (pageInner: HTMLElement | null) => {
  if (!pageInner) {
    return 1;
  }

  const rect = pageInner.getBoundingClientRect();
  return pageInner.clientWidth > 0 && rect.width > 0 ? rect.width / pageInner.clientWidth : 1;
};

const readSelectableFrameNodeRect = (node: HTMLElement): FrameNodeRect => {
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

const readPreviewPageInnerLogicalSize = (pageInner: HTMLElement | null) => {
  if (!pageInner) {
    return { width: 0, height: 0 };
  }

  const scale = readFramePreviewScale(pageInner);
  const rect = pageInner.getBoundingClientRect();
  const width =
    pageInner.clientWidth ||
    parsePositiveCssPixelValue(pageInner.style.width) ||
    (rect.width > 0 && scale > 0 ? rect.width / scale : 0);
  const height =
    pageInner.clientHeight ||
    parsePositiveCssPixelValue(pageInner.style.minHeight) ||
    parsePositiveCssPixelValue(pageInner.style.height) ||
    (rect.height > 0 && scale > 0 ? rect.height / scale : 0);

  return { width, height };
};

const readFrameNodeSourceText = (node: HTMLElement) =>
  node.getAttribute('data-template-frame-source-text') ||
  node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]')?.getAttribute('data-template-frame-source-text') ||
  '';

const readFrameNodeExtractedText = (node: HTMLElement) =>
  node.getAttribute('data-template-frame-extracted-text') ||
  node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]')?.getAttribute('data-template-frame-extracted-text') ||
  '';

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
  framePlans: FrameTextSelectionPlan[]
): FrameExtractedTextState => {
  if (!page || !framePlans.length) {
    return {};
  }

  const assignments = new Map<string, FrameRenderCandidateItem[]>();
  const localCandidatesByKey = new Map<string, FrameRenderCandidateItem[]>();
  const scoredByItemIndex = new Map<number, Array<{ key: string; item: FrameRenderCandidateItem }>>();

  framePlans.forEach((plan) => {
    const candidates = filterFrameRenderCandidatesForPlan(
      selectFrameRenderCandidateItemsV102(page, plan.frameRect, plan.sourceTextHint).map((item) =>
        scoreFrameRenderCandidateItemV112(item, plan.sourceTextHint)
      ),
      plan
    )
      .filter((item) => isViableFrameRenderCandidateV112(item))
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
}) => [pageNumber, frameGroup, rowStart || '', rowEnd || '', colStart || '', colEnd || ''].join('::');

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

  if (
    (label.includes('사업자') && label.includes('등록') && label.includes('번호')) ||
    label.includes('사업등록번호')
  ) {
    return 'business_registration_number';
  }

  if (
    (label.includes('주민') || label.includes('법인')) &&
    label.includes('등록') &&
    (label.includes('번호') || label.includes('번번호'))
  ) {
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

const inferImageFrameFieldType = (
  valueKey: string,
  sourceTextHint: string,
  frameGroup: string
): ImageFrameTextFieldType => {
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

const resetFrameNodeExtractedText = (node: HTMLElement) => {
  const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
  const visibleText = node.querySelector<HTMLElement>('[data-template-frame-visible-text="true"]');

  node.removeAttribute('data-template-frame-extracted-text');
  node.removeAttribute('data-template-frame-write-policy');
  node.removeAttribute('data-template-frame-selected-by');
  node.removeAttribute('data-template-frame-display-visible');
  node.removeAttribute('data-template-frame-needs-review');
  node.removeAttribute('data-template-frame-field-type');
  node.removeAttribute('data-template-frame-semantic-role');
  textarea?.removeAttribute('data-template-frame-extracted-text');
  textarea?.removeAttribute('data-template-frame-write-policy');
  textarea?.removeAttribute('data-template-frame-selected-by');
  textarea?.removeAttribute('data-template-frame-display-visible');
  textarea?.removeAttribute('data-template-frame-needs-review');
  textarea?.removeAttribute('data-template-frame-field-type');
  textarea?.removeAttribute('data-template-frame-semantic-role');

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

const writeFrameNodeExtractedText = (
  node: HTMLElement,
  nextText: string,
  displayState?: FrameExtractedTextMetaState[string]
) => {
  const normalizedText = formatFrameSourceTextForDisplay(nextText, {
    frameGroup: node.getAttribute('data-template-frame-group'),
    valueKey: node.getAttribute('data-template-frame-value-key'),
    colorGroup: node.getAttribute('data-template-frame-color-group'),
  });
  const textarea = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
  const visibleText = node.querySelector<HTMLElement>('[data-template-frame-visible-text="true"]');
  const visible = displayState?.visible ?? Boolean(normalizedText);

  if (normalizedText) {
    node.setAttribute('data-template-frame-extracted-text', normalizedText);
    textarea?.setAttribute('data-template-frame-extracted-text', normalizedText);
  } else {
    node.removeAttribute('data-template-frame-extracted-text');
    textarea?.removeAttribute('data-template-frame-extracted-text');
  }

  if (displayState?.writePolicy) {
    node.setAttribute('data-template-frame-write-policy', displayState.writePolicy);
    textarea?.setAttribute('data-template-frame-write-policy', displayState.writePolicy);
  } else {
    node.removeAttribute('data-template-frame-write-policy');
    textarea?.removeAttribute('data-template-frame-write-policy');
  }

  if (displayState?.selectedBy) {
    node.setAttribute('data-template-frame-selected-by', displayState.selectedBy);
    textarea?.setAttribute('data-template-frame-selected-by', displayState.selectedBy);
  } else {
    node.removeAttribute('data-template-frame-selected-by');
    textarea?.removeAttribute('data-template-frame-selected-by');
  }

  node.setAttribute('data-template-frame-display-visible', visible ? 'true' : 'false');
  textarea?.setAttribute('data-template-frame-display-visible', visible ? 'true' : 'false');
  node.setAttribute('data-template-frame-needs-review', displayState?.needsReview ? 'true' : 'false');
  textarea?.setAttribute('data-template-frame-needs-review', displayState?.needsReview ? 'true' : 'false');
  if (displayState?.fieldType) {
    node.setAttribute('data-template-frame-field-type', displayState.fieldType);
    textarea?.setAttribute('data-template-frame-field-type', displayState.fieldType);
  } else {
    node.removeAttribute('data-template-frame-field-type');
    textarea?.removeAttribute('data-template-frame-field-type');
  }
  if (displayState?.semanticRole) {
    node.setAttribute('data-template-frame-semantic-role', displayState.semanticRole);
    textarea?.setAttribute('data-template-frame-semantic-role', displayState.semanticRole);
  } else {
    node.removeAttribute('data-template-frame-semantic-role');
    textarea?.removeAttribute('data-template-frame-semantic-role');
  }

  if (textarea) {
    textarea.value = normalizedText;
    textarea.textContent = normalizedText;
    textarea.style.color = visible ? '#0f172a' : 'transparent';
    textarea.style.setProperty('-webkit-text-fill-color', visible ? '#0f172a' : 'transparent');
  }

  if (visibleText) {
    visibleText.textContent = normalizedText;
    visibleText.style.color = visible ? '#0f172a' : 'transparent';
  }
};

const waitForMeasuredLayout = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
};

export const parseReplicaRenderModelFromHtml = (html: string) => {
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

export const buildGuaranteedFramePreviewHtml = (html: string) => {
  const flattened = flattenFramePreviewMarkup(html);
  const previewHtml = flattened?.html || html || '';
  const previewStyleText = flattened?.styleText || '';
  return `${previewStyleText ? `<style>${previewStyleText}</style>` : ''}${previewHtml}`;
};

export const stripFrameExtractedTextStateFromHtml = (html: string) => {
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

export const applyFrameExtractedTextStateToHtml = (
  html: string,
  extractedTextState: FrameExtractedTextState,
  extractedTextMetaState: FrameExtractedTextMetaState = {}
) => {
  if (!html.trim() || typeof document === 'undefined') {
    return html;
  }

  if (Object.keys(extractedTextState).length === 0 && Object.keys(extractedTextMetaState).length === 0) {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  Array.from(container.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR))
    .filter((node) => !node.matches('[data-template-frame-input="true"]'))
    .forEach((node) => {
      const key = buildFrameExtractedTextKeyFromNode(node);

      if (!key || !Object.prototype.hasOwnProperty.call(extractedTextState, key)) {
        if (!Object.prototype.hasOwnProperty.call(extractedTextMetaState, key)) {
          return;
        }
      }

      writeFrameNodeExtractedText(node, extractedTextState[key] || '', extractedTextMetaState[key]);
    });

  return container.innerHTML;
};

export const extractGuaranteedNonImageTextStateFromRoot = (
  root: HTMLElement,
  renderModel: TemplateExtractReplicaRenderModel
) => {
  const pageModelByPageNumber = new Map(
    (renderModel.pages || []).map((page) => [String(page.pageNumber), page] as const)
  );
  const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR)).filter(
    (node) => !node.matches('[data-template-frame-input="true"]')
  );
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

  const extractedTextState: FrameExtractedTextState = {};
  let filledCount = 0;

  framePlansByPageNumber.forEach((plans, pageNumber) => {
    const pageModel = pageModelByPageNumber.get(pageNumber) || renderModel.pages?.[0];

    const normalizedPlans = plans.map((plan) => {
      const valueKey = plan.node.getAttribute('data-template-frame-value-key') || '';
      const frameGroup = plan.node.getAttribute('data-template-frame-group') || '';
      const colorGroup = plan.node.getAttribute('data-template-frame-color-group') || '';
      const fieldType = inferImageFrameFieldType(valueKey, plan.sourceTextHint, frameGroup);
      const semanticRole = inferImageFrameSemanticRole(
        valueKey,
        plan.sourceTextHint,
        fieldType,
        frameGroup,
        plan.node.getAttribute('data-template-frame-col-start') || ''
      );

      return {
        key: plan.key,
        frameRect: plan.frameRect,
        sourceTextHint: plan.sourceTextHint,
        valueKey,
        frameGroup,
        colorGroup,
        semanticRole,
        fieldType,
      };
    });

    const nextState = extractFrameTextStateFromRenderPageV112(pageModel, normalizedPlans);

    plans.forEach((plan) => {
      const normalizedText = formatFrameSourceTextForDisplay(nextState[plan.key] || '', {
        frameGroup: plan.node.getAttribute('data-template-frame-group'),
        valueKey: plan.node.getAttribute('data-template-frame-value-key'),
        colorGroup: plan.node.getAttribute('data-template-frame-color-group'),
      });

      extractedTextState[plan.key] = normalizedText;

      if (normalizedText) {
        filledCount += 1;
      }
    });
  });

  return {
    extractedTextState,
    filledCount,
  };
};

export const createGuaranteedFrameDraftWithPdf = async ({
  file,
  sourceTitle,
  engineVersion = GUARANTEED_TEMPLATE_EXTRACT_ENGINE_VERSION,
  frameGroupVersion = GUARANTEED_TEMPLATE_EXTRACT_FRAME_GROUP_VERSION,
}: {
  file: File;
  sourceTitle?: string;
  engineVersion?: TemplateExtractEngineVersion;
  frameGroupVersion?: TemplateExtractFrameGroupVersion;
}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceTitle', sourceTitle || file.name);
  formData.append('engineVersion', engineVersion);
  formData.append('extractionStage', 'frames');
  formData.append('frameGroupVersion', frameGroupVersion);

  const response = await fetch('/api/templates/extract', {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || '템플릿 추출에 실패했습니다.');
  }

  return result.data as TemplateExtractDetailResult;
};

export const buildGuaranteedDraftHtmlFromFrameDraft = async ({
  generatedDraftHtml,
  renderModelSourceHtml,
}: {
  generatedDraftHtml: string;
  renderModelSourceHtml: string;
}) => {
  if (typeof document === 'undefined') {
    throw new Error('브라우저 환경에서만 보장 조합 추출을 실행할 수 있습니다.');
  }

  const previewDraftCopyHtml = buildGuaranteedFramePreviewHtml(generatedDraftHtml);
  const previewDraftBaseHtml = stripFrameExtractedTextStateFromHtml(previewDraftCopyHtml);
  const renderModel =
    parseReplicaRenderModelFromHtml(generatedDraftHtml) || parseReplicaRenderModelFromHtml(renderModelSourceHtml);

  if (!renderModel?.pages?.length) {
    throw new Error('텍스트 추출용 렌더 모델을 찾지 못했습니다.');
  }

  const measureHost = document.createElement('div');
  measureHost.className =
    'template-edit-preview template-extract-draft-preview template-extract-preview-surface template-clone template-clone--raster-first-v2-structured';
  measureHost.setAttribute('data-template-preview-scaled', 'false');
  measureHost.style.position = 'fixed';
  measureHost.style.left = '-20000px';
  measureHost.style.top = '0';
  measureHost.style.visibility = 'hidden';
  measureHost.style.pointerEvents = 'none';
  measureHost.style.width = 'max-content';
  measureHost.style.height = 'auto';
  measureHost.style.overflow = 'visible';
  measureHost.innerHTML = previewDraftBaseHtml;
  document.body.appendChild(measureHost);

  try {
    await waitForMeasuredLayout();
    const { extractedTextState, filledCount } = extractGuaranteedNonImageTextStateFromRoot(measureHost, renderModel);
    return {
      draftHtml: applyFrameExtractedTextStateToHtml(previewDraftBaseHtml, extractedTextState),
      filledCount,
    };
  } finally {
    measureHost.remove();
  }
};
