import {
  collapseDocumentCanvasWhitespace,
  isDocumentCanvasAttachmentValueElement,
  isDocumentCanvasValueFieldElement,
  resolveDocumentCanvasValueKey,
  stringifyAttachmentDocumentValue,
  stringifyDocumentValue,
} from '../../../lib/documentCanvasState';
import type { DocumentRequestableField, DocumentRequestableKind } from './documentOwnerTypes';
import type { TemplateChecklistRegistrationTarget } from '../../../components/template/workspace/types';

const readAttribute = (element: Element | null | undefined, name: string) =>
  element?.getAttribute(name)?.trim() || '';

const readFrameAttribute = (element: HTMLElement, name: string) =>
  readAttribute(element, name) ||
  readAttribute(element.querySelector<HTMLElement>('[data-template-frame-input="true"]'), name);

const readText = (element: Element | null | undefined) =>
  collapseDocumentCanvasWhitespace(element?.textContent || '');

const readFrameDisplayText = (element: Element | null | undefined) => {
  if (!element) {
    return '';
  }

  const input = element.querySelector<HTMLElement>('[data-template-frame-input="true"]');

  return collapseDocumentCanvasWhitespace(
    readAttribute(element, 'data-template-frame-source-text') ||
      readAttribute(input, 'data-template-frame-source-text') ||
      readAttribute(element, 'data-template-frame-extracted-text') ||
      readAttribute(input, 'data-template-frame-extracted-text') ||
      readText(element) ||
      readAttribute(element, 'data-template-frame-chain-key') ||
      readAttribute(input, 'data-template-frame-chain-key')
  );
};

const humanizeKey = (value: string) =>
  value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const findFrameByGroupId = (root: ParentNode, frameGroupId: string) => {
  if (!frameGroupId) {
    return null;
  }

  return (
    Array.from(root.querySelectorAll<HTMLElement>('[data-template-frame-group]')).find(
      (frame) => readAttribute(frame, 'data-template-frame-group') === frameGroupId
    ) || null
  );
};

const findKeyFrameForValueFrame = (root: ParentNode, valueFrame: HTMLElement | null, valueKey: string) => {
  const parentGroupId = valueFrame ? readFrameAttribute(valueFrame, 'data-template-frame-parent-group') : '';

  if (parentGroupId) {
    const parentFrame = findFrameByGroupId(root, parentGroupId);
    if (parentFrame) {
      return parentFrame;
    }
  }

  const frames = Array.from(root.querySelectorAll<HTMLElement>('[data-template-frame-group]'));
  return (
    frames.find((frame) => {
      const role = readFrameAttribute(frame, 'data-template-frame-role');
      const frameValueKey = readFrameAttribute(frame, 'data-template-frame-value-key');
      return role === 'key' && frameValueKey && frameValueKey === valueKey;
    }) || null
  );
};

const resolveRequestKind = (element: HTMLElement, valueFrame: HTMLElement | null): DocumentRequestableKind => {
  const boxKind =
    readFrameAttribute(element, 'data-template-box-kind') ||
    readFrameAttribute(valueFrame || element, 'data-template-box-kind') ||
    readFrameAttribute(valueFrame || element, 'data-template-frame-box-kind-visual');
  const runtimeMode =
    readFrameAttribute(element, 'data-template-runtime-mode') ||
    readFrameAttribute(element, 'data-template-usage-preview-runtime-mode') ||
    readFrameAttribute(valueFrame || element, 'data-template-runtime-mode') ||
    readFrameAttribute(valueFrame || element, 'data-template-usage-preview-runtime-mode');

  if (boxKind === 'signature' || runtimeMode.startsWith('signature_')) {
    return 'signature';
  }

  if (boxKind === 'attachment' || runtimeMode === 'file_slot' || isDocumentCanvasAttachmentValueElement(element)) {
    return 'file';
  }

  if (boxKind === 'image') {
    return 'photo';
  }

  return 'value';
};

const buildContextKey = (valueFrame: HTMLElement | null, valueKey: string) => {
  const parentGroupId = valueFrame ? readFrameAttribute(valueFrame, 'data-template-frame-parent-group') : '';
  const colorGroupId = valueFrame ? readFrameAttribute(valueFrame, 'data-template-frame-color-group') : '';
  const frameGroupId = valueFrame ? readFrameAttribute(valueFrame, 'data-template-frame-group') : '';

  if (parentGroupId) {
    return `parent:${parentGroupId}`;
  }

  if (valueKey) {
    return `value:${valueKey}`;
  }

  if (colorGroupId) {
    return `color:${colorGroupId}`;
  }

  return frameGroupId ? `frame:${frameGroupId}` : '';
};

export const collectDocumentRequestableFields = (
  htmlCanonical: string,
  labelValues: Record<string, unknown>
): DocumentRequestableField[] => {
  if (!htmlCanonical.trim() || typeof DOMParser === 'undefined') {
    return [];
  }

  const parsedDocument = new DOMParser().parseFromString(htmlCanonical, 'text/html');
  const fieldsByValueKey = new Map<string, DocumentRequestableField>();

  parsedDocument
    .querySelectorAll<HTMLElement>('[data-template-frame-input="true"], [data-label], [data-template-frame-value-key]')
    .forEach((element, index) => {
      const legacyDataLabel = readAttribute(element, 'data-label');
      const frameRole = readFrameAttribute(element, 'data-template-frame-role');

      if (!isDocumentCanvasValueFieldElement(element) && !(legacyDataLabel && frameRole !== 'key')) {
        return;
      }

      const valueKey = resolveDocumentCanvasValueKey(element);
      if (!valueKey || fieldsByValueKey.has(valueKey)) {
        return;
      }

      const valueFrame =
        element.closest<HTMLElement>('[data-template-frame-group]') ||
        (element.matches('[data-template-frame-group]') ? element : null);
      const keyFrame = findKeyFrameForValueFrame(parsedDocument, valueFrame, valueKey);
      const valueFrameGroupId = valueFrame ? readFrameAttribute(valueFrame, 'data-template-frame-group') : '';
      const keyFrameGroupId = keyFrame ? readFrameAttribute(keyFrame, 'data-template-frame-group') : '';
      const parentGroupId = valueFrame ? readFrameAttribute(valueFrame, 'data-template-frame-parent-group') : '';
      const currentValue = isDocumentCanvasAttachmentValueElement(element)
        ? stringifyAttachmentDocumentValue(labelValues[valueKey])
        : stringifyDocumentValue(labelValues[valueKey]);
      const contextText = readText(element.closest('tr, p, li, section, div, td') || valueFrame || element);
      const keyText =
        readFrameDisplayText(keyFrame) ||
        readFrameAttribute(valueFrame || element, 'data-template-frame-label') ||
        collapseDocumentCanvasWhitespace(contextText.replace(currentValue, '')).replace(/[:：]\s*$/, '') ||
        humanizeKey(valueKey) ||
        valueKey;

      fieldsByValueKey.set(valueKey, {
        id: `${valueKey}:${valueFrameGroupId || keyFrameGroupId || index}`,
        displayKeyText: keyText,
        valueKey,
        keyFrameGroupId,
        valueFrameGroupId,
        parentGroupId,
        contextKey: buildContextKey(valueFrame, valueKey),
        currentValueText: currentValue,
        requestKind: resolveRequestKind(element, valueFrame),
      });
    });

  return Array.from(fieldsByValueKey.values()).sort((left, right) =>
    left.displayKeyText.localeCompare(right.displayKeyText, 'ko')
  );
};

export const buildChecklistTargetForRequestableField = (
  field: DocumentRequestableField
): TemplateChecklistRegistrationTarget => ({
  id: field.id,
  kind:
    field.requestKind === 'signature'
      ? 'signature'
      : field.requestKind === 'file'
        ? 'file'
        : field.requestKind === 'photo'
          ? 'photo'
          : 'value',
  label: field.displayKeyText,
  valueKey: field.valueKey,
  frameGroupId: field.valueFrameGroupId || field.keyFrameGroupId,
  contextKey: field.contextKey,
  highlightFrameGroupIds: [field.keyFrameGroupId, field.valueFrameGroupId].filter(Boolean) as string[],
  activationValueKey: field.valueKey,
});
