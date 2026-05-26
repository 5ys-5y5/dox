type OwnerDomNamingOptions = {
  root: HTMLElement;
  itemAttribute: string;
  nameAttribute: string;
  autoNamedAttribute: string;
  itemPrefix: string;
};

const normalizeOwnerAutoNamePart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);

const readOwnerAutoElementLabel = (element: Element) => {
  const directLabel =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder') ||
    element.getAttribute('name') ||
    element.getAttribute('type') ||
    element.tagName.toLowerCase();
  const elementText = 'innerText' in element ? String((element as HTMLElement).innerText || '') : '';
  const textLabel = (elementText || element.textContent || '').replace(/\s+/g, ' ').trim();
  const label = textLabel || directLabel;

  return label.length > 80 ? `${label.slice(0, 80)}...` : label;
};

const buildOwnerAutoItemPath = (element: Element, root: HTMLElement) => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== root && segments.length < 14) {
    const parent = current.parentElement;
    const tagName = current.tagName.toLowerCase();

    if (!parent) {
      segments.unshift(tagName);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter((sibling) => sibling.tagName === current?.tagName);
    const siblingIndex = sameTagSiblings.indexOf(current) + 1;
    segments.unshift(`${tagName}-${Math.max(siblingIndex, 1)}`);
    current = parent;
  }

  const normalizedPath = normalizeOwnerAutoNamePart(segments.join('__'));
  return normalizedPath || 'root';
};

export const annotateOwnerUnnamedElements = ({
  root,
  itemAttribute,
  nameAttribute,
  autoNamedAttribute,
  itemPrefix,
}: OwnerDomNamingOptions) => {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];

  elements.forEach((element) => {
    const item = element.getAttribute(itemAttribute);
    const name = element.getAttribute(nameAttribute);

    if (item && name) {
      return;
    }

    if (item && !name) {
      element.setAttribute(nameAttribute, `자동 명명: ${readOwnerAutoElementLabel(element)}`);
      element.setAttribute(autoNamedAttribute, 'true');
      return;
    }

    const autoItem = `${itemPrefix}-${buildOwnerAutoItemPath(element, root)}`;
    element.setAttribute(itemAttribute, autoItem);
    element.setAttribute(nameAttribute, `자동 명명: ${readOwnerAutoElementLabel(element)}`);
    element.setAttribute(autoNamedAttribute, 'true');
  });
};
