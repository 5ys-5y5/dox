type OwnerDomNamingOptions = {
  root: HTMLElement;
  itemAttribute: string;
  nameAttribute: string;
  autoNamedAttribute: string;
  itemPrefix: string;
  existingItems?: Set<string>;
  envAttribute?: string;
};

type OwnerDomWatcherOptions = OwnerDomNamingOptions & {
  initialDelayMs?: number;
  mutationDelayMs?: number;
  pauseAfterPointerDownMs?: number;
};

type OwnerIdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

const OWNER_AUTO_ITEM_MAX_LENGTH = 120;
// DOM 계약값은 요청된 표기인 "_slibling" 철자를 그대로 사용한다.
const OWNER_ENV_RELATED_SUFFIX = '_slibling';
const OWNER_VISUAL_ONLY_SELECTORS = [
  '.v106-frame-selection-fill',
  '.v106-frame-selection-badge',
  '.v106-frame-delete-button',
  '.v106-frame-relation-badge',
  '.v106-frame-kind-marker',
  '.v106-frame-marquee',
  '.v106-frame-create-ghost',
  '[data-v106-frame-outline-overlay]',
  '[data-v106-frame-cluster-outline-overlay]',
  '[data-v106-frame-selected-side-indicator]',
  '[data-v106-selection-tonedown-overlay="true"]',
  '[data-v106-position-group-proxy-overlay]',
  '[data-template-position-spacing-selection-visual]',
  '[data-v106-resize-handle="true"]',
  '[data-v106-edge-button="true"]',
] as const;

const normalizeOwnerAutoNamePart = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, OWNER_AUTO_ITEM_MAX_LENGTH);

  return normalized || 'item';
};

const compactOwnerLabel = (value: string, fallback: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
};

const readOwnerDirectLabel = (element: Element) =>
  compactOwnerLabel(
    element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.getAttribute('placeholder') ||
      element.getAttribute('name') ||
      '',
    ''
  );

const readOwnerTextLabel = (element: Element) => {
  const tagName = element.tagName.toLowerCase();

  if (!['button', 'label', 'legend', 'summary', 'option', 'p', 'span', 'h1', 'h2', 'h3', 'h4'].includes(tagName)) {
    return '';
  }

  return compactOwnerLabel(element.textContent || '', '');
};

const readOwnerElementLabel = (element: Element) => {
  const directLabel = readOwnerDirectLabel(element);

  if (directLabel) {
    return directLabel;
  }

  const textLabel = readOwnerTextLabel(element);

  if (textLabel) {
    return textLabel;
  }

  const type = element.getAttribute('type');

  return type ? `${element.tagName.toLowerCase()} ${type}` : element.tagName.toLowerCase();
};

const readOwnerElementKind = (element: Element) => {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role');

  if (element.getAttribute('data-template-frame-group')) {
    return 'frame';
  }

  if (element.getAttribute('data-template-frame-input') === 'true') {
    return 'frame-input';
  }

  if (tagName === 'main') {
    return 'page-root';
  }

  if (tagName === 'section') {
    return 'section';
  }

  if (tagName === 'header') {
    return 'header';
  }

  if (tagName === 'footer') {
    return 'footer';
  }

  if (tagName === 'button') {
    return 'button';
  }

  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return 'field';
  }

  if (tagName === 'label') {
    return 'label';
  }

  if (tagName === 'ul' || tagName === 'ol') {
    return 'list';
  }

  if (tagName === 'li') {
    return 'list-row';
  }

  if (tagName === 'table') {
    return 'table';
  }

  if (tagName === 'thead') {
    return 'table-header';
  }

  if (tagName === 'tbody') {
    return 'table-body';
  }

  if (tagName === 'tr') {
    return 'table-row';
  }

  if (tagName === 'th') {
    return 'table-header-cell';
  }

  if (tagName === 'td') {
    return 'table-cell';
  }

  if (tagName === 'svg') {
    return 'icon';
  }

  if (tagName === 'path') {
    return 'icon-path';
  }

  if (role) {
    return role;
  }

  return tagName === 'div' ? 'container' : tagName;
};

const shouldSkipOwnerAutoElement = (element: Element) =>
  OWNER_VISUAL_ONLY_SELECTORS.some((selector) => element.matches(selector));

const readNearestOwnerEnvValue = (element: Element, root: HTMLElement, envAttribute: string) => {
  let parent = element.parentElement;

  while (parent && parent !== root.parentElement) {
    const parentEnv = parent.getAttribute(envAttribute);

    if (parentEnv) {
      return parentEnv.endsWith(OWNER_ENV_RELATED_SUFFIX)
        ? parentEnv
        : `${parentEnv}${OWNER_ENV_RELATED_SUFFIX}`;
    }

    if (parent === root) {
      return '';
    }

    parent = parent.parentElement;
  }

  return '';
};

const ensureOwnerEnvAttribute = (element: Element, root: HTMLElement, envAttribute: string) => {
  const currentEnv = element.getAttribute(envAttribute);

  if (currentEnv) {
    return;
  }

  element.setAttribute(envAttribute, readNearestOwnerEnvValue(element, root, envAttribute));
};

const readOwnerSemanticDataParts = (element: Element) => {
  const parts: string[] = [];
  const externalItem =
    element.getAttribute('data-normalization-map-item') ||
    element.getAttribute('data-mejai-ui-item') ||
    element.getAttribute('data-mejai-table-kind');
  const frameGroupId = element.getAttribute('data-template-frame-group');
  const frameValueKey = element.getAttribute('data-template-frame-value-key');
  const frameLabel = element.getAttribute('data-template-frame-label');
  const frameRole = element.getAttribute('data-template-frame-role');
  const frameFieldType = element.getAttribute('data-template-frame-field-type');
  const relationSelection = element.getAttribute('data-template-frame-relation-selection');
  const metadataRelationRole = element.getAttribute('data-template-metadata-relation-role');
  const positionGroupId = element.getAttribute('data-template-frame-position-group-id');
  const positionGroupLabel = element.getAttribute('data-template-frame-position-group-label');

  if (externalItem) {
    parts.push(externalItem);
  }

  if (frameGroupId) {
    parts.push('frame', frameGroupId);
  }

  if (frameValueKey) {
    parts.push('value-key', frameValueKey);
  }

  if (frameLabel) {
    parts.push('label', frameLabel);
  }

  if (frameRole) {
    parts.push('role', frameRole);
  }

  if (frameFieldType) {
    parts.push('field', frameFieldType);
  }

  if (relationSelection) {
    parts.push('relation', relationSelection);
  }

  if (metadataRelationRole) {
    parts.push('metadata', metadataRelationRole);
  }

  if (positionGroupId || positionGroupLabel) {
    parts.push('position-group', positionGroupLabel || positionGroupId || '');
  }

  return parts.filter(Boolean);
};

const findNearestOwnerElement = (
  element: Element,
  itemAttribute: string,
  autoNamedAttribute: string,
  root: HTMLElement
) => {
  let parent = element.parentElement;

  while (parent && parent !== root.parentElement) {
    if (parent.hasAttribute(itemAttribute) && parent.getAttribute(autoNamedAttribute) !== 'true') {
      return parent;
    }

    if (parent === root) {
      return null;
    }

    parent = parent.parentElement;
  }

  return null;
};

const buildOwnerSemanticAutoItem = (
  element: Element,
  root: HTMLElement,
  itemAttribute: string,
  autoNamedAttribute: string,
  itemPrefix: string
) => {
  const semanticParts = readOwnerSemanticDataParts(element);
  const directLabel = readOwnerDirectLabel(element) || readOwnerTextLabel(element);
  const kind = readOwnerElementKind(element);
  const ownerElement = findNearestOwnerElement(element, itemAttribute, autoNamedAttribute, root);
  const ownerItem = ownerElement?.getAttribute(itemAttribute) || '';
  const baseParts = ownerItem ? [ownerItem] : [itemPrefix];

  if (semanticParts.length) {
    return normalizeOwnerAutoNamePart([...baseParts, ...semanticParts, kind].join('-'));
  }

  if (directLabel) {
    return normalizeOwnerAutoNamePart([...baseParts, kind, directLabel].join('-'));
  }

  return normalizeOwnerAutoNamePart([...baseParts, kind].join('-'));
};

const buildOwnerSemanticAutoName = (
  element: Element,
  root: HTMLElement,
  itemAttribute: string,
  nameAttribute: string,
  autoNamedAttribute: string
) => {
  const semanticParts = readOwnerSemanticDataParts(element);
  const elementLabel = readOwnerElementLabel(element);
  const kind = readOwnerElementKind(element);
  const ownerElement = findNearestOwnerElement(element, itemAttribute, autoNamedAttribute, root);
  const ownerName = ownerElement?.getAttribute(nameAttribute) || ownerElement?.getAttribute(itemAttribute) || '';

  if (semanticParts.length) {
    return compactOwnerLabel(`${ownerName ? `${ownerName} 내부 ` : ''}${semanticParts.join(' · ')} ${kind}`, `${kind} 항목`);
  }

  return compactOwnerLabel(`${ownerName ? `${ownerName} 내부 ` : ''}${kind} - ${elementLabel}`, `${kind} 항목`);
};

const collectExistingOwnerItems = (root: HTMLElement, itemAttribute: string) => {
  const ownerItems = new Set<string>();

  [root, ...Array.from(root.querySelectorAll(`[${itemAttribute}]`))].forEach((element) => {
    const item = element.getAttribute(itemAttribute);

    if (item) {
      ownerItems.add(item);
    }
  });

  return ownerItems;
};

const reserveOwnerItem = (candidate: string, existingItems: Set<string>) => {
  if (!existingItems.has(candidate)) {
    existingItems.add(candidate);
    return candidate;
  }

  let index = 2;
  let nextCandidate = `${candidate}-${index}`;

  while (existingItems.has(nextCandidate)) {
    index += 1;
    nextCandidate = `${candidate}-${index}`;
  }

  existingItems.add(nextCandidate);
  return nextCandidate;
};

export const annotateOwnerUnnamedElements = ({
  root,
  itemAttribute,
  nameAttribute,
  autoNamedAttribute,
  itemPrefix,
  existingItems: providedExistingItems,
  envAttribute = 'env',
}: OwnerDomNamingOptions) => {
  if (shouldSkipOwnerAutoElement(root)) {
    return;
  }

  const elements = [root, ...Array.from(root.querySelectorAll('*'))].filter(
    (element) => !shouldSkipOwnerAutoElement(element)
  );
  const existingItems = providedExistingItems || collectExistingOwnerItems(root, itemAttribute);

  elements.forEach((element) => {
    ensureOwnerEnvAttribute(element, root, envAttribute);

    const item = element.getAttribute(itemAttribute);
    const name = element.getAttribute(nameAttribute);
    const autoNamed = element.getAttribute(autoNamedAttribute);

    if (item && name && autoNamed !== 'true') {
      return;
    }

    if (item && autoNamed !== 'true') {
      element.setAttribute(
        nameAttribute,
        buildOwnerSemanticAutoName(element, root, itemAttribute, nameAttribute, autoNamedAttribute)
      );
      element.setAttribute(autoNamedAttribute, 'name-only');
      return;
    }

    if (item && autoNamed === 'true') {
      existingItems.delete(item);
    }

    const autoItem = reserveOwnerItem(
      buildOwnerSemanticAutoItem(element, root, itemAttribute, autoNamedAttribute, itemPrefix),
      existingItems
    );
    const autoName = buildOwnerSemanticAutoName(element, root, itemAttribute, nameAttribute, autoNamedAttribute);

    if (item !== autoItem) {
      element.setAttribute(itemAttribute, autoItem);
    }

    if (name !== autoName) {
      element.setAttribute(nameAttribute, autoName);
    }

    element.setAttribute(autoNamedAttribute, 'true');
  });
};

const compactOwnerElementRoots = (elements: HTMLElement[]) =>
  elements.filter((element, index) => {
    if (elements.findIndex((candidate) => candidate === element) !== index) {
      return false;
    }

    return !elements.some((candidate) => candidate !== element && candidate.contains(element));
  });

const collectAddedElementRoots = (mutations: MutationRecord[]) => {
  const addedElements: HTMLElement[] = [];

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        addedElements.push(node);
      }
    });
  });

  return compactOwnerElementRoots(addedElements);
};

export const watchOwnerUnnamedElements = ({
  root,
  itemAttribute,
  nameAttribute,
  autoNamedAttribute,
  itemPrefix,
  initialDelayMs = 0,
  mutationDelayMs = 500,
  pauseAfterPointerDownMs = 0,
}: OwnerDomWatcherOptions) => {
  const idleWindow = window as OwnerIdleWindow;
  const pendingRoots = new Set<HTMLElement>();
  let delayTimerId = 0;
  let idleCallbackId = 0;
  let timeoutFallbackId = 0;
  let pausedUntil = 0;

  const cancelIdleCallback = () => {
    if (idleCallbackId && idleWindow.cancelIdleCallback) {
      idleWindow.cancelIdleCallback(idleCallbackId);
    }

    if (timeoutFallbackId) {
      window.clearTimeout(timeoutFallbackId);
    }

    idleCallbackId = 0;
    timeoutFallbackId = 0;
  };

  const cancelScheduledAnnotate = () => {
    if (delayTimerId) {
      window.clearTimeout(delayTimerId);
    }

    delayTimerId = 0;
    cancelIdleCallback();
  };

  const runAnnotate = () => {
    idleCallbackId = 0;
    timeoutFallbackId = 0;
    const roots = compactOwnerElementRoots(Array.from(pendingRoots));
    const existingItems = collectExistingOwnerItems(root, itemAttribute);
    pendingRoots.clear();

    roots.forEach((pendingRoot) => {
      annotateOwnerUnnamedElements({
        root: pendingRoot,
        itemAttribute,
        nameAttribute,
        autoNamedAttribute,
        itemPrefix,
        existingItems,
      });
    });
  };

  const scheduleAnnotate = (targetRoot: HTMLElement, delayMs: number) => {
    pendingRoots.add(targetRoot);

    cancelScheduledAnnotate();
    delayTimerId = window.setTimeout(() => {
      delayTimerId = 0;

      if (Date.now() < pausedUntil) {
        pendingRoots.clear();
        return;
      }

      if (idleWindow.requestIdleCallback) {
        idleCallbackId = idleWindow.requestIdleCallback(runAnnotate, { timeout: 1200 });
        return;
      }

      timeoutFallbackId = window.setTimeout(runAnnotate, 0);
    }, delayMs);
  };

  scheduleAnnotate(root, initialDelayMs);

  const handlePointerDown = () => {
    if (!pauseAfterPointerDownMs) {
      return;
    }

    pausedUntil = Date.now() + pauseAfterPointerDownMs;
    pendingRoots.clear();
    cancelScheduledAnnotate();
  };

  if (pauseAfterPointerDownMs) {
    root.addEventListener('pointerdown', handlePointerDown, { capture: true });
    root.addEventListener('mousedown', handlePointerDown, { capture: true });
    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('mousedown', handlePointerDown, { capture: true });
  }

  const observer = new MutationObserver((mutations) => {
    if (Date.now() < pausedUntil) {
      return;
    }

    const addedElementRoots = collectAddedElementRoots(mutations);

    if (!addedElementRoots.length) {
      return;
    }

    addedElementRoots.forEach((element) => pendingRoots.add(element));
    scheduleAnnotate(addedElementRoots[0] || root, mutationDelayMs);
  });
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    root.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    root.removeEventListener('mousedown', handlePointerDown, { capture: true });
    window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    window.removeEventListener('mousedown', handlePointerDown, { capture: true });

    cancelScheduledAnnotate();
    pendingRoots.clear();
  };
};
