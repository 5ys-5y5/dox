import { resolvePreferredDocumentHtml } from './documentCanvasHtml';
import { mergePersistedSignatureRuntimeStateIntoHtml } from './documentCanvasRuntimeState';

const templateRuntimeKindSelector =
  '[data-template-runtime-kind="file_slot"], [data-template-runtime-' + 'mo' + 'de="file_slot"]';

export const DOCUMENT_CANVAS_VALUE_ORIGIN_ATTR = 'data-document-canvas-value-origin';
export const DOCUMENT_CANVAS_HAS_ACTUAL_VALUE_ATTR = 'data-document-canvas-has-actual-value';
export const DOCUMENT_CANVAS_SAMPLE_VALUE_ATTR = 'data-document-canvas-sample-value';
export const DOCUMENT_CANVAS_VALUE_ORIGIN_ACTUAL = 'actual';
export const DOCUMENT_CANVAS_VALUE_ORIGIN_SAMPLE = 'sample';

export const collapseDocumentCanvasWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

export const stringifyDocumentValue = (value: unknown) => {
  if (typeof value === 'string') {
    return collapseDocumentCanvasWhitespace(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return collapseDocumentCanvasWhitespace(JSON.stringify(value));
};

export const stringifyAttachmentDocumentValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return collapseDocumentCanvasWhitespace(JSON.stringify(value));
};

export const isDocumentCanvasValueFieldElement = (element: Element) =>
  element.matches('[data-template-frame-role="value"]') ||
  element.closest('[data-template-frame-role="value"]') !== null ||
  element.matches('[data-template-usage-preview-value-box="true"]') ||
  element.closest('[data-template-usage-preview-value-box="true"]') !== null;

export const isDocumentCanvasAttachmentValueElement = (element: Element) =>
  element.matches(`[data-template-box-kind="attachment"], ${templateRuntimeKindSelector}`) ||
  element.closest(`[data-template-box-kind="attachment"], ${templateRuntimeKindSelector}`) !== null;

export const resolveDocumentCanvasValueKey = (element: Element) => {
  const currentElementKey =
    element.getAttribute('data-template-frame-value-key')?.trim() ||
    element.getAttribute('data-label')?.trim() ||
    '';

  if (currentElementKey) {
    return currentElementKey;
  }

  const owner =
    element.closest<HTMLElement>('[data-template-frame-value-key]') ||
    element.closest<HTMLElement>('[data-label]') ||
    null;

  if (!owner) {
    return '';
  }

  return owner.getAttribute('data-template-frame-value-key')?.trim() || owner.getAttribute('data-label')?.trim() || '';
};

export type DocumentCanvasValueEntryLike = {
  valueKey?: string;
  valuePayload?: unknown;
  displayText?: string | null;
};

export const readDocumentCanvasValueEntryValue = (entry: DocumentCanvasValueEntryLike) => {
  if (entry.valuePayload && typeof entry.valuePayload === 'object' && 'value' in entry.valuePayload) {
    return (entry.valuePayload as { value?: unknown }).value;
  }

  return entry.displayText;
};

export const mergeDocumentCanvasLabelValues = (
  baseValues: Record<string, unknown> | null | undefined,
  valueEntries?: Array<DocumentCanvasValueEntryLike> | null
) => {
  const nextValues = { ...(baseValues || {}) } as Record<string, unknown>;

  valueEntries?.forEach((entry) => {
    const valueKey = String(entry.valueKey || '').trim();

    if (!valueKey) {
      return;
    }

    nextValues[valueKey] = readDocumentCanvasValueEntryValue(entry);
  });

  return nextValues;
};

export const setDocumentCanvasValueElement = (element: HTMLElement, value: string) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
    element.defaultValue = value;
    element.setAttribute('value', value);

    if (element instanceof HTMLTextAreaElement) {
      element.textContent = value;
    }

    if (!value) {
      element.removeAttribute('placeholder');
    }

    return;
  }

  if (element.querySelector('[data-template-frame-input="true"]')) {
    return;
  }

  element.textContent = value;

  if (!value) {
    element.removeAttribute('data-placeholder');
  }
};

const readDocumentCanvasControlText = (element: HTMLElement) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value || element.defaultValue || element.getAttribute('value') || element.textContent || '';
  }

  const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-template-frame-input="true"]');

  if (input) {
    return input.value || input.defaultValue || input.getAttribute('value') || input.textContent || '';
  }

  return element.textContent || '';
};

const readDocumentCanvasSampleValue = (element: HTMLElement) => {
  const owner =
    element.closest<HTMLElement>('[data-template-frame-role="value"]') ||
    element.closest<HTMLElement>('[data-template-frame-value-key]') ||
    element;
  const input =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element
      : element.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-template-frame-input="true"]');

  return (
    readDocumentCanvasControlText(element) ||
    element.getAttribute('data-template-frame-source-text') ||
    input?.getAttribute('data-template-frame-source-text') ||
    owner?.getAttribute('data-template-frame-source-text') ||
    element.getAttribute('data-template-frame-extracted-text') ||
    input?.getAttribute('data-template-frame-extracted-text') ||
    owner?.getAttribute('data-template-frame-extracted-text') ||
    ''
  ).trim();
};

const markDocumentCanvasValueElementState = (
  element: HTMLElement,
  origin: typeof DOCUMENT_CANVAS_VALUE_ORIGIN_ACTUAL | typeof DOCUMENT_CANVAS_VALUE_ORIGIN_SAMPLE,
  sampleValue: string
) => {
  const targets = new Set<HTMLElement>([element]);
  const owner = element.closest<HTMLElement>('[data-template-frame-role="value"], [data-template-frame-value-key]');

  if (owner) {
    targets.add(owner);
  }

  targets.forEach((target) => {
    target.setAttribute(DOCUMENT_CANVAS_VALUE_ORIGIN_ATTR, origin);
    target.setAttribute(DOCUMENT_CANVAS_HAS_ACTUAL_VALUE_ATTR, origin === DOCUMENT_CANVAS_VALUE_ORIGIN_ACTUAL ? 'true' : 'false');

    if (sampleValue) {
      target.setAttribute(DOCUMENT_CANVAS_SAMPLE_VALUE_ATTR, sampleValue);
    } else {
      target.removeAttribute(DOCUMENT_CANVAS_SAMPLE_VALUE_ATTR);
    }
  });
};

export const materializeDocumentCanvasHtmlWithLabelValues = (
  htmlCanonical: string,
  labelValues: Record<string, unknown>,
  latestVersionHtml?: string | null
) => {
  if (!htmlCanonical.trim() || typeof document === 'undefined') {
    return htmlCanonical;
  }

  const container = document.createElement('div');
  container.innerHTML = htmlCanonical;
  container
    .querySelectorAll<HTMLElement>('[data-template-frame-input="true"], [data-label], [data-template-frame-value-key]')
    .forEach((element) => {
      if (!isDocumentCanvasValueFieldElement(element)) {
        return;
      }

      const valueKey = resolveDocumentCanvasValueKey(element);

      if (!valueKey) {
        return;
      }

      const hasLabelValue = Object.prototype.hasOwnProperty.call(labelValues, valueKey);
      const sampleValue = readDocumentCanvasSampleValue(element);
      const actualValueText = isDocumentCanvasAttachmentValueElement(element)
        ? stringifyAttachmentDocumentValue(labelValues[valueKey])
        : stringifyDocumentValue(labelValues[valueKey]);
      const hasActualValue = hasLabelValue && (Boolean(actualValueText) || !sampleValue);
      const nextValue = hasActualValue ? actualValueText : isDocumentCanvasAttachmentValueElement(element) ? '' : sampleValue;

      setDocumentCanvasValueElement(element, nextValue);
      markDocumentCanvasValueElementState(
        element,
        hasActualValue ? DOCUMENT_CANVAS_VALUE_ORIGIN_ACTUAL : DOCUMENT_CANVAS_VALUE_ORIGIN_SAMPLE,
        sampleValue
      );
    });

  return mergePersistedSignatureRuntimeStateIntoHtml(container.innerHTML.trim(), latestVersionHtml);
};

export const extractDocumentCanvasLabelValuesFromHtml = (
  htmlCanonical: string,
  fallbackValues: Record<string, unknown>
) => {
  if (!htmlCanonical.trim() || typeof document === 'undefined') {
    return fallbackValues;
  }

  const container = document.createElement('div');
  container.innerHTML = htmlCanonical;
  const nextValues = { ...fallbackValues };

  container
    .querySelectorAll<HTMLElement>('[data-template-frame-input="true"], [data-label], [data-template-frame-value-key]')
    .forEach((element) => {
      if (!isDocumentCanvasValueFieldElement(element)) {
        return;
      }

      const valueKey = resolveDocumentCanvasValueKey(element);

      if (!valueKey) {
        return;
      }

      const origin = element.getAttribute(DOCUMENT_CANVAS_VALUE_ORIGIN_ATTR)?.trim() || '';
      const hasActualValue = element.getAttribute(DOCUMENT_CANVAS_HAS_ACTUAL_VALUE_ATTR) === 'true';

      if (origin === DOCUMENT_CANVAS_VALUE_ORIGIN_SAMPLE && !hasActualValue) {
        return;
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        nextValues[valueKey] = isDocumentCanvasAttachmentValueElement(element)
          ? String(element.value || '').trim()
          : collapseDocumentCanvasWhitespace(element.value || '');
        return;
      }

      nextValues[valueKey] = isDocumentCanvasAttachmentValueElement(element)
        ? String(element.textContent || '').trim()
        : collapseDocumentCanvasWhitespace(element.textContent || '');
    });

  return nextValues;
};

export const materializeDocumentCanvasHtml = (params: {
  linkedRenderHtml?: string | null;
  latestVersionHtml?: string | null;
  labelValues: Record<string, unknown>;
}) => {
  const preferredHtml = resolvePreferredDocumentHtml(params);

  if (!preferredHtml.trim()) {
    return '';
  }

  return materializeDocumentCanvasHtmlWithLabelValues(preferredHtml, params.labelValues, params.latestVersionHtml);
};
