const TEMPLATE_FRAME_BORDER_ALIGN_ATTR = 'data-template-frame-border-align';
const TEMPLATE_FRAME_BORDER_WIDTH_ATTR = 'data-template-frame-border-width';
const TEMPLATE_FRAME_BORDER_STYLE_ATTR = 'data-template-frame-border-style';
const TEMPLATE_FRAME_BORDER_COLOR_ATTR = 'data-template-frame-border-color';
const TEMPLATE_TRANSPARENT_FRAME_GUIDE_ATTR = 'data-template-transparent-frame-guide';

const DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN = 'center';
const DEFAULT_TEMPLATE_FRAME_BORDER_WIDTH = '0.1';
const DEFAULT_TEMPLATE_FRAME_BORDER_STYLE = 'solid';
const DEFAULT_TEMPLATE_FRAME_BORDER_COLOR = '#0f172a';
const EXTRACT_PHYSICAL_STEP_PX = 5;
const FRAME_EDGE_SNAP_TOLERANCE_PX = 0.75;

type ExtractFrameBorderAppearance = {
  color: string;
  style: string;
  width: number;
};

type FrameNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const extractRgbChannelToHex = (value: number) => {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0');
};

const extractColorToHex = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized || normalized === 'transparent') {
    return 'transparent';
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1] || '';
    if (hex.length === 3) {
      return `#${hex
        .split('')
        .map((channel) => `${channel}${channel}`)
        .join('')}`;
    }
    return `#${hex}`;
  }

  const rgbMatch = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (!rgbMatch) {
    return normalized;
  }

  const alphaMatch = normalized.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([0-9.]+)\)/i);
  if (alphaMatch && Number.parseFloat(alphaMatch[1] || '1') <= 0) {
    return 'transparent';
  }

  const [, r, g, b] = rgbMatch;
  return `#${extractRgbChannelToHex(Number.parseInt(r, 10))}${extractRgbChannelToHex(
    Number.parseInt(g, 10)
  )}${extractRgbChannelToHex(Number.parseInt(b, 10))}`;
};

const normalizeExtractFrameBorderColor = (value: string | null | undefined) => {
  const color = extractColorToHex(String(value || ''));

  if (!color || color === 'transparent') {
    return color;
  }

  if (
    [
      '#000000',
      '#020617',
      '#0f172a',
      '#111827',
      '#18181b',
      '#27272a',
      '#334155',
      '#cbd5e1',
      '#d4d4d8',
      '#e4e4e7',
    ].includes(color)
  ) {
    return DEFAULT_TEMPLATE_FRAME_BORDER_COLOR;
  }

  return color;
};

const parseExtractFrameNumber = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

const normalizeExtractFrameBorderStyle = (value: string | null | undefined, width: number) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized || normalized === 'none' || normalized === 'hidden' || width <= 0) {
    return width > 0 ? DEFAULT_TEMPLATE_FRAME_BORDER_STYLE : 'none';
  }

  return normalized;
};

const normalizeExtractFrameBorderAlign = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'inside' || normalized === 'outside' || normalized === 'center') {
    return normalized;
  }

  return DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN;
};

const isDefaultExtractBackgroundColor = (value: string | null | undefined) => {
  const color = extractColorToHex(String(value || ''));
  return !color || color === 'transparent' || color === '#ffffff';
};

const normalizeExtractFrameDefaultBackground = (element: HTMLElement) => {
  if (isDefaultExtractBackgroundColor(element.style.backgroundColor)) {
    element.style.backgroundColor = 'transparent';
  }
};

const syncExtractTransparentFrameGuideAttr = (element: HTMLElement) => {
  normalizeExtractFrameDefaultBackground(element);
  element.removeAttribute(TEMPLATE_TRANSPARENT_FRAME_GUIDE_ATTR);
  element.removeAttribute('data-template-frame-container-guide-skip');
};

const readRawExtractElementBorderAppearance = (
  element: HTMLElement | null | undefined
): ExtractFrameBorderAppearance | null => {
  if (!element) {
    return null;
  }

  const width =
    parseExtractFrameNumber(element.getAttribute(TEMPLATE_FRAME_BORDER_WIDTH_ATTR)) ??
    parseExtractFrameNumber(element.style.borderTopWidth || element.style.borderWidth) ??
    parseExtractFrameNumber(element.style.outlineWidth);
  const style = normalizeExtractFrameBorderStyle(
    element.getAttribute(TEMPLATE_FRAME_BORDER_STYLE_ATTR) ||
      element.style.borderTopStyle ||
      element.style.borderStyle ||
      element.style.outlineStyle ||
      '',
    width ?? 0
  );
  const color = normalizeExtractFrameBorderColor(
    element.getAttribute(TEMPLATE_FRAME_BORDER_COLOR_ATTR) ||
      element.style.borderTopColor ||
      element.style.borderColor ||
      element.style.outlineColor ||
      ''
  );

  if (!width || width <= 0 || style === 'none' || !color || color === 'transparent') {
    return null;
  }

  return { color, style, width };
};

const applyExtractFrameBorderAppearanceStyle = (
  element: HTMLElement,
  appearance: {
    align: string;
    width: number;
    style: string;
    color: string;
  }
) => {
  const align = normalizeExtractFrameBorderAlign(appearance.align);
  const width = Math.max(0, appearance.width);
  const style = normalizeExtractFrameBorderStyle(appearance.style, width);
  const color = normalizeExtractFrameBorderColor(appearance.color) || DEFAULT_TEMPLATE_FRAME_BORDER_COLOR;
  const hasVisibleBorder = width > 0 && style !== 'none' && color !== 'transparent';
  const insideWidth = hasVisibleBorder ? (align === 'outside' ? 0 : align === 'center' ? width / 2 : width) : 0;
  const outsideWidth = hasVisibleBorder ? (align === 'outside' ? width : align === 'center' ? width - insideWidth : 0) : 0;

  element.style.boxSizing = 'border-box';
  element.style.borderWidth = `${insideWidth}px`;
  element.style.borderStyle = hasVisibleBorder && insideWidth > 0 ? style : 'none';
  element.style.borderColor = hasVisibleBorder ? color : 'transparent';
  element.style.outlineWidth = `${outsideWidth}px`;
  element.style.outlineStyle = hasVisibleBorder && outsideWidth > 0 ? style : 'none';
  element.style.outlineColor = hasVisibleBorder ? color : 'transparent';
  element.style.outlineOffset = '0px';
  element.setAttribute(TEMPLATE_FRAME_BORDER_ALIGN_ATTR, align);
  element.setAttribute(TEMPLATE_FRAME_BORDER_WIDTH_ATTR, String(Number(width.toFixed(2))));
  element.setAttribute(TEMPLATE_FRAME_BORDER_STYLE_ATTR, hasVisibleBorder ? style : 'none');
  element.setAttribute(TEMPLATE_FRAME_BORDER_COLOR_ATTR, hasVisibleBorder ? color : 'transparent');
  syncExtractTransparentFrameGuideAttr(element);

  if (hasVisibleBorder) {
    element.setAttribute('data-template-frame-outline-style', style);
  } else {
    element.removeAttribute('data-template-frame-outline-style');
  }
};

const clearNestedExtractFrameBorderStyles = (shell: HTMLElement) => {
  const nestedElements: HTMLElement[] = [];
  const table = shell.querySelector<HTMLElement>(':scope > table.v102-frame-band-table');

  if (table) {
    nestedElements.push(table);
    table.querySelectorAll<HTMLElement>('td, th').forEach((cell) => nestedElements.push(cell));
  }

  shell.querySelectorAll<HTMLElement>(':scope > .v202-frame-group[data-template-frame-group]').forEach((group) => {
    nestedElements.push(group);
  });

  nestedElements.forEach((element) => {
    element.style.borderWidth = '0px';
    element.style.borderStyle = 'none';
    element.style.borderColor = 'transparent';
    element.style.outline = 'none';
    element.style.outlineOffset = '0px';
    normalizeExtractFrameDefaultBackground(element);
    element.removeAttribute(TEMPLATE_FRAME_BORDER_ALIGN_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_BORDER_WIDTH_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_BORDER_STYLE_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_BORDER_COLOR_ATTR);
    element.removeAttribute('data-template-frame-outline-style');
    element.removeAttribute(TEMPLATE_TRANSPARENT_FRAME_GUIDE_ATTR);
    element.removeAttribute('data-template-frame-container-guide-skip');
  });
};

const hasExplicitExtractTransparentGuideIntent = (element: HTMLElement | null | undefined) => {
  if (!element) {
    return false;
  }

  const outlineStyle = String(element.getAttribute('data-template-frame-outline-style') || '').trim().toLowerCase();

  if (outlineStyle === 'dashed') {
    return true;
  }

  const inlineStyle = element.getAttribute('style') || '';
  return /\bborder(?:-[a-z]+)?:[^;"']*\bdashed\b/i.test(inlineStyle) || /\boutline[^;"']*\bdashed\b/i.test(inlineStyle);
};

const hasExplicitExtractTransparentGuideIntentInValueStage = (element: HTMLElement | null | undefined) => {
  if (!element) {
    return false;
  }

  if (hasExplicitExtractTransparentGuideIntent(element)) {
    return true;
  }

  const directTable = element.querySelector<HTMLElement>(':scope > table.v102-frame-band-table');

  if (hasExplicitExtractTransparentGuideIntent(directTable)) {
    return true;
  }

  return Array.from(
    element.querySelectorAll<HTMLElement>(':scope > .v202-frame-group[data-template-frame-group]')
  ).some((group) => hasExplicitExtractTransparentGuideIntent(group));
};

const readExtractSolidBorderEvidenceForValueStage = (element: HTMLElement): ExtractFrameBorderAppearance | null => {
  const selfAppearance = readRawExtractElementBorderAppearance(element);

  if (selfAppearance?.style === 'solid') {
    return selfAppearance;
  }

  const directTable = element.querySelector<HTMLElement>(':scope > table.v102-frame-band-table');
  const tableAppearance = readRawExtractElementBorderAppearance(directTable);

  if (tableAppearance?.style === 'solid') {
    return tableAppearance;
  }

  const directGroups = Array.from(
    element.querySelectorAll<HTMLElement>(':scope > .v202-frame-group[data-template-frame-group]')
  );

  for (const group of directGroups) {
    const groupAppearance = readRawExtractElementBorderAppearance(group);

    if (groupAppearance?.style === 'solid') {
      return groupAppearance;
    }
  }

  return null;
};

const preserveExtractTableCellPeerEdgeBorderStyleForValueStage = (
  cell: HTMLElement,
  appearance: ExtractFrameBorderAppearance
) => {
  const color = normalizeExtractFrameBorderColor(appearance.color) || DEFAULT_TEMPLATE_FRAME_BORDER_COLOR;
  const style = normalizeExtractFrameBorderStyle(appearance.style, appearance.width);
  const width = Math.max(0, appearance.width);
  const hasVisibleBorder = width > 0 && style !== 'none' && color !== 'transparent';

  normalizeExtractFrameDefaultBackground(cell);
  cell.style.boxSizing = 'border-box';
  cell.style.outline = 'none';
  cell.style.outlineOffset = '0px';
  cell.removeAttribute(TEMPLATE_FRAME_BORDER_ALIGN_ATTR);
  cell.removeAttribute(TEMPLATE_FRAME_BORDER_WIDTH_ATTR);
  cell.removeAttribute(TEMPLATE_FRAME_BORDER_STYLE_ATTR);
  cell.removeAttribute(TEMPLATE_FRAME_BORDER_COLOR_ATTR);
  syncExtractTransparentFrameGuideAttr(cell);

  if (hasVisibleBorder) {
    cell.setAttribute('data-template-frame-outline-style', style);
  } else {
    cell.removeAttribute('data-template-frame-outline-style');
  }
};

const clearExtractGuideDecoration = (element: HTMLElement) => {
  element.removeAttribute(TEMPLATE_TRANSPARENT_FRAME_GUIDE_ATTR);
  element.removeAttribute('data-template-frame-container-guide-skip');

  if (/repeating-linear-gradient\(/i.test(element.style.backgroundImage || '')) {
    element.style.backgroundImage = 'none';
  }
};

const parseFramePx = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatExtractFramePx = (value: number) => `${Number(Math.max(0, value).toFixed(2))}px`;

const snapExtractValueToStep = (value: number, step = EXTRACT_PHYSICAL_STEP_PX) =>
  Math.max(0, Math.round(value / step) * step);

const snapExtractAxisSizesToPixelBoundaries = (sizes: number[], minimumSize = 1) => {
  if (sizes.length <= 0) {
    return sizes;
  }

  const boundaries = [0];
  let cursor = 0;
  sizes.forEach((size) => {
    cursor += Math.max(minimumSize, size);
    boundaries.push(cursor);
  });

  const snappedBoundaries = boundaries.map((value) => Math.round(value));
  for (let index = 1; index < snappedBoundaries.length; index += 1) {
    snappedBoundaries[index] = Math.max(snappedBoundaries[index] || 0, (snappedBoundaries[index - 1] || 0) + minimumSize);
  }

  return sizes.map((_, index) =>
    Math.max(minimumSize, (snappedBoundaries[index + 1] || 0) - (snappedBoundaries[index] || 0))
  );
};

const distributeExtractAxisSizesToStepTotal = (
  sizes: number[],
  targetTotal: number,
  step = EXTRACT_PHYSICAL_STEP_PX,
  minimumSize = EXTRACT_PHYSICAL_STEP_PX
) => {
  if (sizes.length <= 0) {
    return sizes;
  }

  const safeTargetTotal = Math.max(minimumSize * sizes.length, snapExtractValueToStep(targetTotal, step));
  const sourceTotal = sizes.reduce((sum, size) => sum + Math.max(minimumSize, size), 0);
  const proportionalBase =
    sourceTotal > 0
      ? sizes.map((size) => Math.max(minimumSize, (Math.max(minimumSize, size) / sourceTotal) * safeTargetTotal))
      : sizes.map(() => safeTargetTotal / sizes.length);
  const nextSizes = proportionalBase.map((size) => Math.max(minimumSize, snapExtractValueToStep(size, step)));
  let diff = safeTargetTotal - nextSizes.reduce((sum, size) => sum + size, 0);
  let cursor = nextSizes.length - 1;
  let guard = 0;

  while (diff !== 0 && guard < 4096) {
    const index = ((cursor % nextSizes.length) + nextSizes.length) % nextSizes.length;
    const delta = diff > 0 ? step : -step;
    const candidate = (nextSizes[index] || minimumSize) + delta;

    if (candidate >= minimumSize) {
      nextSizes[index] = candidate;
      diff -= delta;
    }

    cursor -= 1;
    guard += 1;
  }

  return nextSizes.map((size) => Math.max(minimumSize, size));
};

const readExtractTableColumnWidths = (table: HTMLTableElement) =>
  Array.from(table.querySelectorAll<HTMLTableColElement>('col'))
    .map((col) => parseFramePx(col.style.width || col.getAttribute('width') || ''))
    .filter((width) => width > 0);

const readExtractTableRowHeights = (table: HTMLTableElement) =>
  Array.from(table.rows)
    .map((row) => parseFramePx(row.style.height || row.getAttribute('height') || ''))
    .filter((height) => height > 0);

const quantizeExtractFrameBandTableGeometry = (container: ParentNode, step = EXTRACT_PHYSICAL_STEP_PX) => {
  container.querySelectorAll<HTMLElement>('.v102-frame-band').forEach((shell) => {
    const table = shell.querySelector<HTMLTableElement>(':scope > table.v102-frame-band-table');
    const snappedLeft = shell.style.left.trim() ? snapExtractValueToStep(parseFramePx(shell.style.left), step) : null;
    const snappedTop = shell.style.top.trim() ? snapExtractValueToStep(parseFramePx(shell.style.top), step) : null;

    if (snappedLeft !== null) {
      shell.style.left = formatExtractFramePx(snappedLeft);
    }
    if (snappedTop !== null) {
      shell.style.top = formatExtractFramePx(snappedTop);
    }

    if (!table) {
      const shellWidth = parseFramePx(shell.style.width);
      const shellHeight = parseFramePx(shell.style.height);

      if (shellWidth > 0) {
        shell.style.width = formatExtractFramePx(Math.max(step, snapExtractValueToStep(shellWidth, step)));
      }
      if (shellHeight > 0) {
        shell.style.height = formatExtractFramePx(Math.max(step, snapExtractValueToStep(shellHeight, step)));
      }
      return;
    }

    const colElements = Array.from(table.querySelectorAll<HTMLTableColElement>('col'));
    const colWidths = readExtractTableColumnWidths(table);
    const rowElements = Array.from(table.rows);
    const rowHeights = readExtractTableRowHeights(table);
    const shellWidth = parseFramePx(shell.style.width) || colWidths.reduce((sum, width) => sum + width, 0);
    const shellHeight = parseFramePx(shell.style.height) || rowHeights.reduce((sum, height) => sum + height, 0);
    const quantizedShellWidth = shellWidth > 0 ? Math.max(step, snapExtractValueToStep(shellWidth, step)) : 0;
    const quantizedShellHeight = shellHeight > 0 ? Math.max(step, snapExtractValueToStep(shellHeight, step)) : 0;

    if (colElements.length > 0 && colWidths.length === colElements.length && quantizedShellWidth > 0) {
      const nextWidths = distributeExtractAxisSizesToStepTotal(colWidths, quantizedShellWidth, step, step);
      nextWidths.forEach((width, index) => {
        const col = colElements[index];
        if (col) {
          col.style.width = formatExtractFramePx(width);
        }
      });
      table.style.width = formatExtractFramePx(nextWidths.reduce((sum, width) => sum + width, 0));
      shell.style.width = table.style.width;
    } else if (quantizedShellWidth > 0) {
      table.style.width = formatExtractFramePx(quantizedShellWidth);
      shell.style.width = table.style.width;
    }

    if (rowElements.length > 0 && rowHeights.length === rowElements.length && quantizedShellHeight > 0) {
      const nextHeights = distributeExtractAxisSizesToStepTotal(rowHeights, quantizedShellHeight, step, step);
      nextHeights.forEach((height, index) => {
        const row = rowElements[index];
        if (row) {
          row.style.height = formatExtractFramePx(height);
        }
      });
      table.style.height = formatExtractFramePx(nextHeights.reduce((sum, height) => sum + height, 0));
      shell.style.height = table.style.height;
    } else if (quantizedShellHeight > 0) {
      table.style.height = formatExtractFramePx(quantizedShellHeight);
      shell.style.height = table.style.height;
    }
  });
};

const materializeExtractFrameBandTableGeometry = (container: ParentNode) => {
  container.querySelectorAll<HTMLElement>('.v102-frame-band').forEach((shell) => {
    const table = shell.querySelector<HTMLTableElement>(':scope > table.v102-frame-band-table');

    if (!table) {
      return;
    }

    const shellLeft = parseFramePx(shell.style.left);
    const shellTop = parseFramePx(shell.style.top);
    if (shell.style.left.trim()) {
      shell.style.left = formatExtractFramePx(Math.round(shellLeft));
    }
    if (shell.style.top.trim()) {
      shell.style.top = formatExtractFramePx(Math.round(shellTop));
    }

    const colElements = Array.from(table.querySelectorAll<HTMLTableColElement>('col'));
    const colWidths = readExtractTableColumnWidths(table);
    if (colElements.length > 0 && colWidths.length === colElements.length) {
      const snappedColWidths = snapExtractAxisSizesToPixelBoundaries(colWidths);
      snappedColWidths.forEach((width, index) => {
        const col = colElements[index];
        if (col) {
          col.style.width = formatExtractFramePx(width);
        }
      });
      const tableWidth = snappedColWidths.reduce((sum, width) => sum + width, 0);
      table.style.width = formatExtractFramePx(tableWidth);
      shell.style.width = formatExtractFramePx(tableWidth);
    } else {
      const shellWidth = parseFramePx(shell.style.width);
      if (shellWidth > 0) {
        shell.style.width = formatExtractFramePx(Math.round(shellWidth));
      }
    }

    const rows = Array.from(table.rows);
    const rowHeights = readExtractTableRowHeights(table);
    if (rows.length > 0 && rowHeights.length === rows.length) {
      const snappedRowHeights = snapExtractAxisSizesToPixelBoundaries(rowHeights);
      snappedRowHeights.forEach((height, index) => {
        const row = rows[index];
        if (row) {
          row.style.height = formatExtractFramePx(height);
        }
      });
      const tableHeight = snappedRowHeights.reduce((sum, height) => sum + height, 0);
      table.style.height = formatExtractFramePx(tableHeight);
      shell.style.height = formatExtractFramePx(tableHeight);
    } else {
      const shellHeight = parseFramePx(shell.style.height);
      if (shellHeight > 0) {
        shell.style.height = formatExtractFramePx(Math.round(shellHeight));
      }
    }
  });
};

const readStyledShellRect = (node: HTMLElement): FrameNodeRect | null => {
  if (!node.style.left.trim() || !node.style.top.trim() || !node.style.width.trim() || !node.style.height.trim()) {
    return null;
  }

  return {
    left: parseFramePx(node.style.left),
    top: parseFramePx(node.style.top),
    width: Math.max(1, parseFramePx(node.style.width)),
    height: Math.max(1, parseFramePx(node.style.height)),
  };
};

const writeStyledShellRect = (node: HTMLElement, rect: FrameNodeRect) => {
  node.style.left = formatExtractFramePx(rect.left);
  node.style.top = formatExtractFramePx(rect.top);
  node.style.width = formatExtractFramePx(rect.width);
  node.style.height = formatExtractFramePx(rect.height);
};

const clampExtractShellRectsToPageBounds = (pageInner: HTMLElement, step = EXTRACT_PHYSICAL_STEP_PX) => {
  const pageWidth = parseFramePx(pageInner.style.width || pageInner.getAttribute('data-page-width') || '');
  const pageHeight = parseFramePx(
    pageInner.style.height || pageInner.style.minHeight || pageInner.getAttribute('data-page-height') || ''
  );

  if (pageWidth <= 0 && pageHeight <= 0) {
    return false;
  }

  let changed = false;

  Array.from(
    pageInner.querySelectorAll<HTMLElement>('.v102-frame-band, .v202-cell-box[data-v106-frame-node="true"]')
  ).forEach((node) => {
    const rect = readStyledShellRect(node);

    if (!rect) {
      return;
    }

    const boundedWidth = pageWidth > 0 ? Math.min(rect.width, pageWidth) : rect.width;
    const boundedHeight = pageHeight > 0 ? Math.min(rect.height, pageHeight) : rect.height;
    const boundedLeft =
      pageWidth > 0 ? Math.max(0, Math.min(pageWidth - boundedWidth, rect.left)) : Math.max(0, rect.left);
    const boundedTop =
      pageHeight > 0 ? Math.max(0, Math.min(pageHeight - boundedHeight, rect.top)) : Math.max(0, rect.top);
    const nextRect = {
      left: snapExtractValueToStep(boundedLeft, step),
      top: snapExtractValueToStep(boundedTop, step),
      width: Math.max(step, snapExtractValueToStep(boundedWidth, step)),
      height: Math.max(step, snapExtractValueToStep(boundedHeight, step)),
    };

    if (
      pageWidth > 0 &&
      nextRect.left + nextRect.width > pageWidth &&
      nextRect.width > step
    ) {
      nextRect.width = Math.max(step, snapExtractValueToStep(pageWidth - nextRect.left, step));
    }

    if (
      pageHeight > 0 &&
      nextRect.top + nextRect.height > pageHeight &&
      nextRect.height > step
    ) {
      nextRect.height = Math.max(step, snapExtractValueToStep(pageHeight - nextRect.top, step));
    }

    if (
      nextRect.left !== rect.left ||
      nextRect.top !== rect.top ||
      nextRect.width !== rect.width ||
      nextRect.height !== rect.height
    ) {
      writeStyledShellRect(node, nextRect);
      changed = true;
    }
  });

  return changed;
};

const buildSteppedAxisValueMap = (
  values: number[],
  tolerance = FRAME_EDGE_SNAP_TOLERANCE_PX,
  step = EXTRACT_PHYSICAL_STEP_PX
) => {
  const sortedValues = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const snappedValueMap = new Map<number, number>();
  let cluster: number[] = [];

  const flushCluster = () => {
    if (!cluster.length) {
      return;
    }

    const average = cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
    const snappedValue = snapExtractValueToStep(average, step);
    cluster.forEach((value) => {
      snappedValueMap.set(value, snappedValue);
    });
    cluster = [];
  };

  sortedValues.forEach((value) => {
    if (!cluster.length) {
      cluster = [value];
      return;
    }

    const anchor = cluster[0] || value;
    if (Math.abs(value - anchor) <= tolerance) {
      cluster.push(value);
      return;
    }

    flushCluster();
    cluster = [value];
  });
  flushCluster();

  return snappedValueMap;
};

const snapExtractShellEdgesInScope = (scope: ParentNode, step = EXTRACT_PHYSICAL_STEP_PX) => {
  const entries = Array.from(
    scope.querySelectorAll<HTMLElement>('.v102-frame-band, .v202-cell-box[data-v106-frame-node="true"]')
  )
    .map((node) => {
      const rect = readStyledShellRect(node);
      return rect ? { node, rect } : null;
    })
    .filter((entry): entry is { node: HTMLElement; rect: FrameNodeRect } => Boolean(entry));

  if (entries.length <= 0) {
    return false;
  }

  const xSnapMap = buildSteppedAxisValueMap(
    entries.flatMap(({ rect }) => [rect.left, rect.left + rect.width]),
    FRAME_EDGE_SNAP_TOLERANCE_PX,
    step
  );
  const ySnapMap = buildSteppedAxisValueMap(
    entries.flatMap(({ rect }) => [rect.top, rect.top + rect.height]),
    FRAME_EDGE_SNAP_TOLERANCE_PX,
    step
  );
  let changed = false;

  entries.forEach(({ node, rect }) => {
    const nextLeft = xSnapMap.get(rect.left) ?? snapExtractValueToStep(rect.left, step);
    const nextRight = xSnapMap.get(rect.left + rect.width) ?? snapExtractValueToStep(rect.left + rect.width, step);
    const nextTop = ySnapMap.get(rect.top) ?? snapExtractValueToStep(rect.top, step);
    const nextBottom = ySnapMap.get(rect.top + rect.height) ?? snapExtractValueToStep(rect.top + rect.height, step);
    const nextRect = {
      left: nextLeft,
      top: nextTop,
      width: Math.max(step, nextRight - nextLeft),
      height: Math.max(step, nextBottom - nextTop),
    };

    if (
      nextRect.left !== rect.left ||
      nextRect.top !== rect.top ||
      nextRect.width !== rect.width ||
      nextRect.height !== rect.height
    ) {
      writeStyledShellRect(node, nextRect);
      changed = true;
    }
  });

  return changed;
};

const syncExtractFrameBandTablesToShellRects = (container: ParentNode, step = EXTRACT_PHYSICAL_STEP_PX) => {
  container.querySelectorAll<HTMLElement>('.v102-frame-band').forEach((shell) => {
    const table = shell.querySelector<HTMLTableElement>(':scope > table.v102-frame-band-table');

    if (!table) {
      return;
    }

    const shellWidth = parseFramePx(shell.style.width);
    const shellHeight = parseFramePx(shell.style.height);
    const colElements = Array.from(table.querySelectorAll<HTMLTableColElement>('col'));
    const rowElements = Array.from(table.rows);
    const colWidths = readExtractTableColumnWidths(table);
    const rowHeights = readExtractTableRowHeights(table);

    if (shellWidth > 0 && colElements.length > 0 && colWidths.length === colElements.length) {
      const nextWidths = distributeExtractAxisSizesToStepTotal(colWidths, shellWidth, step, step);
      nextWidths.forEach((width, index) => {
        const col = colElements[index];
        if (col) {
          col.style.width = formatExtractFramePx(width);
        }
      });
      table.style.width = formatExtractFramePx(nextWidths.reduce((sum, width) => sum + width, 0));
    } else if (shellWidth > 0) {
      table.style.width = formatExtractFramePx(shellWidth);
    }

    if (shellHeight > 0 && rowElements.length > 0 && rowHeights.length === rowElements.length) {
      const nextHeights = distributeExtractAxisSizesToStepTotal(rowHeights, shellHeight, step, step);
      nextHeights.forEach((height, index) => {
        const row = rowElements[index];
        if (row) {
          row.style.height = formatExtractFramePx(height);
        }
      });
      table.style.height = formatExtractFramePx(nextHeights.reduce((sum, height) => sum + height, 0));
    } else if (shellHeight > 0) {
      table.style.height = formatExtractFramePx(shellHeight);
    }
  });
};

export const applyExtractValueCorrectionsInHtml = (html: string) => {
  if (!html.trim() || typeof document === 'undefined') {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  container
    .querySelectorAll<HTMLElement>(
      '.v102-frame-band, .v202-cell-box[data-v106-frame-node="true"], .v202-frame-group[data-template-frame-group]'
    )
    .forEach((element) => {
      if (!hasExplicitExtractTransparentGuideIntentInValueStage(element)) {
        clearExtractGuideDecoration(element);
        return;
      }

      const solidEvidence = readExtractSolidBorderEvidenceForValueStage(element);

      if (solidEvidence) {
        const isTableCellFrameGroup =
          element.matches('.v202-frame-group[data-template-frame-group]') &&
          (element.tagName === 'TD' || element.tagName === 'TH');

        if (isTableCellFrameGroup) {
          preserveExtractTableCellPeerEdgeBorderStyleForValueStage(element, solidEvidence);
        } else {
          applyExtractFrameBorderAppearanceStyle(element, {
            align: element.getAttribute(TEMPLATE_FRAME_BORDER_ALIGN_ATTR) || DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN,
            width: solidEvidence.width,
            style: solidEvidence.style,
            color: solidEvidence.color,
          });
        }

        if (element.matches('.v102-frame-band, .v202-cell-box[data-v106-frame-node="true"]')) {
          clearNestedExtractFrameBorderStyles(element);
        }

        clearExtractGuideDecoration(element);
        return;
      }

      clearExtractGuideDecoration(element);
      applyExtractFrameBorderAppearanceStyle(element, {
        align: element.getAttribute(TEMPLATE_FRAME_BORDER_ALIGN_ATTR) || DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN,
        width: 0,
        style: 'none',
        color: 'transparent',
      });

      if (element.matches('.v102-frame-band, .v202-cell-box[data-v106-frame-node="true"]')) {
        clearNestedExtractFrameBorderStyles(element);
      }
    });

  return container.innerHTML;
};

export const applyExtractPhysicalCorrectionsInHtml = (html: string) => {
  if (!html.trim() || typeof document === 'undefined') {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  materializeExtractFrameBandTableGeometry(container);
  quantizeExtractFrameBandTableGeometry(container, EXTRACT_PHYSICAL_STEP_PX);
  const pageScopes = Array.from(container.querySelectorAll<HTMLElement>('.page-inner'));

  if (pageScopes.length > 0) {
    pageScopes.forEach((pageInner) => {
      snapExtractShellEdgesInScope(pageInner, EXTRACT_PHYSICAL_STEP_PX);
      clampExtractShellRectsToPageBounds(pageInner, EXTRACT_PHYSICAL_STEP_PX);
    });
  } else {
    snapExtractShellEdgesInScope(container, EXTRACT_PHYSICAL_STEP_PX);
  }

  syncExtractFrameBandTablesToShellRects(container, EXTRACT_PHYSICAL_STEP_PX);
  return container.innerHTML;
};
