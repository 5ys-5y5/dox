import { resolvePreferredDocumentHtml } from './documentCanvasHtml';
import { mergePersistedSignatureRuntimeStateIntoHtml } from './documentCanvasRuntimeState';

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
  element.matches('[data-template-box-kind="attachment"], [data-template-runtime-mode="file_slot"]') ||
  element.closest('[data-template-box-kind="attachment"], [data-template-runtime-mode="file_slot"]') !== null;

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

      setDocumentCanvasValueElement(
        element,
        isDocumentCanvasAttachmentValueElement(element)
          ? stringifyAttachmentDocumentValue(labelValues[valueKey])
          : stringifyDocumentValue(labelValues[valueKey])
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
