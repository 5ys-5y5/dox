const TEMPLATE_TEXT_FIT_SELECTOR = '[data-template-fit-target-width]';

const toNumber = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampScale = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.max(0.25, Math.min(4, value));
};

export const applyTemplateExtractEditableTextFit = (root: ParentNode | null | undefined) => {
  if (!root || typeof (root as ParentNode).querySelectorAll !== 'function') {
    return 0;
  }

  const elements = Array.from(
    (root as ParentNode).querySelectorAll<HTMLElement>(TEMPLATE_TEXT_FIT_SELECTOR)
  );

  for (const element of elements) {
    element.style.transform = 'scale(1, 1)';
  }

  for (const element of elements) {
    const targetWidth = toNumber(element.dataset.templateFitTargetWidth);
    const targetHeight = toNumber(element.dataset.templateFitTargetHeight);

    if (targetWidth <= 0) {
      continue;
    }

    const naturalRect = element.getBoundingClientRect();
    const naturalWidth = naturalRect.width;
    const naturalHeight = naturalRect.height;
    const scaleX = clampScale(targetWidth / Math.max(1, naturalWidth));
    const scaleY = targetHeight > 0 ? clampScale(targetHeight / Math.max(1, naturalHeight)) : 1;
    element.style.transform = `scale(${scaleX.toFixed(5)}, ${scaleY.toFixed(5)})`;
    element.dataset.templateFitScaleX = scaleX.toFixed(5);
    element.dataset.templateFitScaleY = scaleY.toFixed(5);
  }

  return elements.length;
};
