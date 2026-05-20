const TEMPLATE_USAGE_PREVIEW_CONTROL_ATTR = 'data-template-usage-preview-control';
const TEMPLATE_USAGE_PREVIEW_SIGNATURE_STATUS_ATTR = 'data-template-usage-preview-signature-status';
const TEMPLATE_USAGE_PREVIEW_SIGNATURE_SIGNER_NAME_ATTR = 'data-template-usage-preview-signature-signer-name';
const TEMPLATE_USAGE_PREVIEW_SIGNATURE_SIGNED_AT_ATTR = 'data-template-usage-preview-signature-signed-at';
const TEMPLATE_USAGE_PREVIEW_SIGNATURE_PROVIDER_ATTR = 'data-template-usage-preview-signature-provider';
const TEMPLATE_USAGE_PREVIEW_SIGNATURE_IMAGE_DATA_ATTR = 'data-template-usage-preview-signature-image-data';
const TEMPLATE_USAGE_PREVIEW_SIGNATURE_HISTORY_ATTR = 'data-template-usage-preview-signature-history';

const SIGNATURE_RUNTIME_STATE_ATTRS = [
  TEMPLATE_USAGE_PREVIEW_SIGNATURE_STATUS_ATTR,
  TEMPLATE_USAGE_PREVIEW_SIGNATURE_SIGNER_NAME_ATTR,
  TEMPLATE_USAGE_PREVIEW_SIGNATURE_SIGNED_AT_ATTR,
  TEMPLATE_USAGE_PREVIEW_SIGNATURE_PROVIDER_ATTR,
  TEMPLATE_USAGE_PREVIEW_SIGNATURE_IMAGE_DATA_ATTR,
  TEMPLATE_USAGE_PREVIEW_SIGNATURE_HISTORY_ATTR,
] as const;

const hasSignatureRuntimeStateAttrs = (element: Element | null | undefined) =>
  Boolean(element) &&
  SIGNATURE_RUNTIME_STATE_ATTRS.some((attributeName) => element?.hasAttribute(attributeName));

const readSignatureRuntimeStateSource = (frameNode: HTMLElement) => {
  if (hasSignatureRuntimeStateAttrs(frameNode)) {
    return frameNode;
  }

  const runtimeControl = frameNode.querySelector<HTMLElement>(
    `[${TEMPLATE_USAGE_PREVIEW_CONTROL_ATTR}="signature"]`
  );

  if (hasSignatureRuntimeStateAttrs(runtimeControl)) {
    return runtimeControl;
  }

  return frameNode.querySelector<HTMLElement>(
    SIGNATURE_RUNTIME_STATE_ATTRS.map((attributeName) => `[${attributeName}]`).join(', ')
  );
};

const applySignatureRuntimeState = (target: HTMLElement, source: HTMLElement) => {
  SIGNATURE_RUNTIME_STATE_ATTRS.forEach((attributeName) => {
    const value = source.getAttribute(attributeName);

    if (value && value.trim()) {
      target.setAttribute(attributeName, value);
      return;
    }

    target.removeAttribute(attributeName);
  });
};

export const mergePersistedSignatureRuntimeStateIntoHtml = (
  htmlCanonical: string,
  persistedRuntimeHtml?: string | null
) => {
  if (!htmlCanonical.trim() || !persistedRuntimeHtml?.trim() || typeof document === 'undefined') {
    return htmlCanonical;
  }

  const baseContainer = document.createElement('div');
  baseContainer.innerHTML = htmlCanonical;

  const persistedContainer = document.createElement('div');
  persistedContainer.innerHTML = persistedRuntimeHtml;

  const persistedSignatureStateByFrameLabel = new Map<string, HTMLElement>();

  persistedContainer.querySelectorAll<HTMLElement>('[data-template-frame-label]').forEach((frameNode) => {
    const frameLabel = frameNode.getAttribute('data-template-frame-label')?.trim() || '';

    if (!frameLabel) {
      return;
    }

    const runtimeStateSource = readSignatureRuntimeStateSource(frameNode);

    if (!runtimeStateSource) {
      return;
    }

    persistedSignatureStateByFrameLabel.set(frameLabel, runtimeStateSource);
  });

  if (persistedSignatureStateByFrameLabel.size <= 0) {
    return baseContainer.innerHTML.trim();
  }

  baseContainer.querySelectorAll<HTMLElement>('[data-template-frame-label]').forEach((frameNode) => {
    const frameLabel = frameNode.getAttribute('data-template-frame-label')?.trim() || '';

    if (!frameLabel) {
      return;
    }

    const persistedRuntimeStateSource = persistedSignatureStateByFrameLabel.get(frameLabel);

    if (!persistedRuntimeStateSource) {
      return;
    }

    const runtimeStateTarget =
      frameNode.querySelector<HTMLElement>('[data-template-frame-input="true"]') || frameNode;

    applySignatureRuntimeState(frameNode, persistedRuntimeStateSource);
    applySignatureRuntimeState(runtimeStateTarget, persistedRuntimeStateSource);
  });

  return baseContainer.innerHTML.trim();
};
