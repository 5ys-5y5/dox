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
    element.style.transform = 'scaleX(1)';
  }

  for (const element of elements) {
    const targetWidth = toNumber(element.dataset.templateFitTargetWidth);

    if (targetWidth <= 0) {
      continue;
    }

    const naturalWidth = element.getBoundingClientRect().width;
    const nextScale = clampScale(targetWidth / Math.max(1, naturalWidth));
    element.style.transform = `scaleX(${nextScale.toFixed(5)})`;
    element.dataset.templateFitScale = nextScale.toFixed(5);
  }

  return elements.length;
};
