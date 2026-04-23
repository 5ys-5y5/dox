import type {
  TemplateExtractVisualSimilarityPageReport,
  TemplateExtractVisualSimilarityReport,
} from './templateExtractDtos';
import { applyTemplateExtractEditableTextFit } from './templateExtractEditableTextFit';

type MeasureVisualSimilarityInput = {
  html: string;
  pdfPageDataUrls: string[];
  iframe: HTMLIFrameElement;
  minimumPassScore?: number;
  tolerancePx?: number;
  onProgress?: (progress: MeasureVisualSimilarityProgress) => void;
};

type MeasureRenderedPageImagesInput = {
  pdfPageDataUrls: string[];
  replicaPageDataUrls: string[];
  minimumPassScore?: number;
  tolerancePx?: number;
  onProgress?: (progress: MeasureVisualSimilarityProgress) => void;
};

type MeasureVisualSimilarityProgress = {
  phase:
    | 'preparing_pdf_pages'
    | 'preparing_replica_pages'
    | 'loading_html'
    | 'capturing_pages'
    | 'comparing_pages'
    | 'aggregating';
  percent: number;
  stage: string;
  detail: string;
};

const DEFAULT_MINIMUM_PASS_SCORE = 0.95;
const DEFAULT_TOLERANCE_PX = 1;
const WHITE_THRESHOLD = 250;
const MEASUREMENT_SAFE_FONT_ALIAS = 'TemplateExtractMeasurementSans';
const MEASUREMENT_SAFE_FONT_STACK = `"${MEASUREMENT_SAFE_FONT_ALIAS}", sans-serif`;
const MEASUREMENT_DOCUMENT_CSP =
  "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; font-src 'self' data:; media-src 'none'; connect-src 'none'; child-src 'none'; frame-src 'none'; object-src 'none'; script-src 'none';";
const MEASUREMENT_DOCUMENT_STYLE = `
@font-face {
  font-family: "${MEASUREMENT_SAFE_FONT_ALIAS}";
  src: local("Apple SD Gothic Neo");
}
@font-face {
  font-family: "${MEASUREMENT_SAFE_FONT_ALIAS}";
  src: local("Malgun Gothic");
}
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
body {
  background: #ffffff;
  color: #000000;
  font-family: ${MEASUREMENT_SAFE_FONT_STACK};
}
`;

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });

const loadImage = (src: string, ownerWindow: Window = window) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = ownerWindow.document.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다. ${src.slice(0, 48)}`));
    image.src = src;
  });

const loadImageFromBlob = async (blob: Blob, ownerWindow: Window = window) => {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await loadImage(objectUrl, ownerWindow);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const createCanvas = (width: number, height: number, ownerDocument: Document = document) => {
  const canvas = ownerDocument.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
};

const formatUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || error.name || 'unknown_error';
  }

  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    typeof (error as { name?: unknown }).name === 'string'
  ) {
    const errorName = String((error as { name: string }).name || '').trim();
    const errorMessage =
      'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? String((error as { message: string }).message || '').trim()
        : '';

    return errorMessage ? `${errorName}: ${errorMessage}` : errorName || 'unknown_error';
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'unknown_error';
};

const configureMeasurementIframeViewport = (
  iframe: HTMLIFrameElement,
  dimensions: {
    width: number;
    height: number;
  }
) => {
  const nextWidth = Math.max(1, Math.ceil(dimensions.width));
  const nextHeight = Math.max(1, Math.ceil(dimensions.height));
  iframe.style.width = `${nextWidth}px`;
  iframe.style.height = `${nextHeight}px`;
};

const drawImageToCanvas = (
  image: CanvasImageSource,
  width: number,
  height: number,
  ownerDocument: Document = document
) => {
  const canvas = createCanvas(width, height, ownerDocument);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('2D canvas context 를 만들지 못했습니다.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
};

const parsePageNumber = (element: Element, fallbackPageNumber: number) => {
  const rawValue =
    element.getAttribute('data-page-number') ||
    element.getAttribute('data-page') ||
    String(fallbackPageNumber);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackPageNumber;
};

const getRenderablePageElements = (doc: Document) => {
  const pageElements = Array.from(doc.querySelectorAll('[data-page-number], [data-page]'));

  if (pageElements.length > 0) {
    return pageElements;
  }

  if (doc.body.firstElementChild) {
    return [doc.body.firstElementChild];
  }

  return [doc.body];
};

const extractUrlCandidates = (value: string) =>
  Array.from(value.matchAll(/url\(([^)]+)\)/g))
    .map((match) => match[1]?.trim().replace(/^['"]|['"]$/g, ''))
    .filter((candidate): candidate is string => Boolean(candidate));

const normalizeUrlCandidate = (doc: Document, candidate: string) => {
  if (!candidate || candidate.startsWith('data:') || candidate.startsWith('blob:') || candidate.startsWith('#')) {
    return null;
  }

  try {
    return new URL(candidate, doc.baseURI || window.location.href).toString();
  } catch {
    return candidate;
  }
};

const isCrossOriginCandidate = (candidate: string) => {
  try {
    const url = new URL(candidate, window.location.href);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const collectCrossOriginResourceHints = (doc: Document, pageElement: Element) => {
  const candidates = new Set<string>();

  for (const imageElement of Array.from(pageElement.querySelectorAll('img[src]'))) {
    const normalized = normalizeUrlCandidate(doc, imageElement.getAttribute('src') || '');

    if (normalized && isCrossOriginCandidate(normalized)) {
      candidates.add(normalized);
    }
  }

  for (const element of Array.from(pageElement.querySelectorAll('[style*=\"url(\"]'))) {
    const styleValue = element.getAttribute('style') || '';

    for (const candidate of extractUrlCandidates(styleValue)) {
      const normalized = normalizeUrlCandidate(doc, candidate);

      if (normalized && isCrossOriginCandidate(normalized)) {
        candidates.add(normalized);
      }
    }
  }

  for (const styleElement of Array.from(doc.querySelectorAll('style'))) {
    const styleText = styleElement.textContent || '';

    for (const candidate of extractUrlCandidates(styleText)) {
      const normalized = normalizeUrlCandidate(doc, candidate);

      if (normalized && isCrossOriginCandidate(normalized)) {
        candidates.add(normalized);
      }
    }
  }

  for (const linkElement of Array.from(doc.querySelectorAll('link[href]'))) {
    const normalized = normalizeUrlCandidate(doc, linkElement.getAttribute('href') || '');

    if (normalized && isCrossOriginCandidate(normalized)) {
      candidates.add(normalized);
    }
  }

  return Array.from(candidates).slice(0, 8);
};

const collectFontFamilyHints = (doc: Document, pageElement: Element) => {
  const candidates = new Set<string>();
  const styleText = Array.from(doc.querySelectorAll('style'))
    .map((styleElement) => styleElement.textContent || '')
    .join('\n');
  const fontFamilyMatches = styleText.match(/font-family\s*:\s*([^;]+);/g) || [];

  for (const match of fontFamilyMatches) {
    const normalized = match
      .replace(/^font-family\s*:\s*/i, '')
      .replace(/;$/g, '')
      .trim();

    if (normalized) {
      candidates.add(normalized);
    }
  }

  const pageStyle = pageElement.getAttribute('style') || '';
  const inlineMatches = pageStyle.match(/font-family\s*:\s*([^;]+);?/g) || [];

  for (const match of inlineMatches) {
    const normalized = match
      .replace(/^font-family\s*:\s*/i, '')
      .replace(/;$/g, '')
      .trim();

    if (normalized) {
      candidates.add(normalized);
    }
  }

  return Array.from(candidates).slice(0, 8);
};

const extractCssUrls = (cssText: string) => {
  const candidates = new Set<string>();

  for (const urlCandidate of extractUrlCandidates(cssText)) {
    if (urlCandidate) {
      candidates.add(urlCandidate);
    }
  }

  for (const importMatch of cssText.matchAll(/@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/g)) {
    const candidate = importMatch[1]?.trim();

    if (candidate) {
      candidates.add(candidate);
    }
  }

  return Array.from(candidates);
};

const collectHostDocumentCrossOriginResourceHints = () => {
  const candidates = new Set<string>();
  const currentDoc = window.document;

  for (const linkElement of Array.from(currentDoc.querySelectorAll('link[href]'))) {
    const href = linkElement.getAttribute('href') || '';

    try {
      const url = new URL(href, window.location.href);

      if (url.origin !== window.location.origin) {
        candidates.add(url.toString());
      }
    } catch {
      // ignore invalid href values
    }
  }

  for (const styleElement of Array.from(currentDoc.querySelectorAll('style'))) {
    for (const candidate of extractCssUrls(styleElement.textContent || '')) {
      try {
        const url = new URL(candidate, window.location.href);

        if (url.origin !== window.location.origin) {
          candidates.add(url.toString());
        }
      } catch {
        // ignore invalid stylesheet urls
      }
    }
  }

  for (const styleSheet of Array.from(currentDoc.styleSheets)) {
    try {
      const rules = Array.from(styleSheet.cssRules || []);

      for (const rule of rules) {
        const ruleText = 'cssText' in rule ? String(rule.cssText || '') : '';

        for (const candidate of extractCssUrls(ruleText)) {
          try {
            const url = new URL(candidate, window.location.href);

            if (url.origin !== window.location.origin) {
              candidates.add(url.toString());
            }
          } catch {
            // ignore invalid stylesheet urls
          }
        }
      }
    } catch {
      if (styleSheet.href) {
        try {
          const url = new URL(styleSheet.href, window.location.href);

          if (url.origin !== window.location.origin) {
            candidates.add(url.toString());
          }
        } catch {
          // ignore stylesheet read failures
        }
      }
    }
  }

  return Array.from(candidates).slice(0, 8);
};

const stripExternalUrlsFromCss = (cssText: string) =>
  cssText
    .replace(/@import\s+(?:url\()?['"]?[^;]+;?/gi, '')
    .replace(/url\((['"]?)https?:\/\/[^)'"]+\1\)/gi, 'none');

const rewriteMeasurementFontFamilies = (cssText: string) =>
  cssText
    .replace(/font-family\s*:\s*([^;]+);/gi, `font-family: ${MEASUREMENT_SAFE_FONT_STACK};`)
    .replace(/["']?(Apple SD Gothic Neo|Malgun Gothic|Noto Sans KR|Noto Sans CJK KR|AppleGothic)["']?/gi, MEASUREMENT_SAFE_FONT_ALIAS);

const sanitizeMeasurementCss = (cssText: string) => rewriteMeasurementFontFamilies(stripExternalUrlsFromCss(cssText));

const sanitizeMeasurementHtml = (rawHtml: string) =>
  rawHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*?>/gi, '')
    .replace(/<(iframe|object|embed|video|audio)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*\bsrc=['"]https?:\/\/[^'"]+['"][^>]*>/gi, '')
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs: string, cssText: string) => {
      return `<style${attrs}>${sanitizeMeasurementCss(cssText)}</style>`;
    })
    .replace(/\sstyle=(['"])([\s\S]*?)\1/gi, (_match, quote: string, cssText: string) => {
      return ` style=${quote}${sanitizeMeasurementCss(cssText)}${quote}`;
    });

const buildMeasurementDocumentHtml = (rawHtml: string) => {
  const sanitizedHtml = sanitizeMeasurementHtml(rawHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${MEASUREMENT_DOCUMENT_CSP}" />
    <style>${MEASUREMENT_DOCUMENT_STYLE}</style>
  </head>
  <body>${sanitizedHtml}</body>
</html>`;
};

const getMeasurementDocumentExtent = (doc: Document) => {
  const body = doc.body;
  const documentElement = doc.documentElement;
  const bodyWidth = Math.max(
    body?.scrollWidth || 0,
    body?.offsetWidth || 0,
    body?.clientWidth || 0
  );
  const bodyHeight = Math.max(
    body?.scrollHeight || 0,
    body?.offsetHeight || 0,
    body?.clientHeight || 0
  );
  const documentWidth = Math.max(
    documentElement?.scrollWidth || 0,
    documentElement?.offsetWidth || 0,
    documentElement?.clientWidth || 0
  );
  const documentHeight = Math.max(
    documentElement?.scrollHeight || 0,
    documentElement?.offsetHeight || 0,
    documentElement?.clientHeight || 0
  );

  return {
    width: Math.max(bodyWidth, documentWidth),
    height: Math.max(bodyHeight, documentHeight),
  };
};

const loadHtmlIntoIframe = async (
  iframe: HTMLIFrameElement,
  html: string,
  preferredViewport?: {
    width: number;
    height: number;
  }
) => {
  const loaded = new Promise<Document>((resolve, reject) => {
    const handleLoad = () => {
      iframe.removeEventListener('load', handleLoad);
      const doc = iframe.contentDocument;

      if (!doc) {
        reject(new Error('iframe document 를 읽지 못했습니다.'));
        return;
      }

      resolve(doc);
    };

    iframe.addEventListener('load', handleLoad, { once: true });
  });

  if (preferredViewport) {
    configureMeasurementIframeViewport(iframe, preferredViewport);
  }

  iframe.srcdoc = buildMeasurementDocumentHtml(html);
  const doc = await loaded;
  await waitForNextFrame();

  if (doc.fonts?.ready) {
    await doc.fonts.ready.catch(() => undefined);
    await waitForNextFrame();
  }

  applyTemplateExtractEditableTextFit(doc);
  await waitForNextFrame();

  const measuredExtent = getMeasurementDocumentExtent(doc);

  if (
    measuredExtent.width > 0 &&
    measuredExtent.height > 0 &&
    preferredViewport &&
    (measuredExtent.width > preferredViewport.width || measuredExtent.height > preferredViewport.height)
  ) {
    configureMeasurementIframeViewport(iframe, {
      width: Math.max(preferredViewport.width, measuredExtent.width + 32),
      height: Math.max(preferredViewport.height, measuredExtent.height + 32),
    });
    await waitForNextFrame();
    await waitForNextFrame();
    applyTemplateExtractEditableTextFit(doc);
    await waitForNextFrame();
  }

  return doc;
};

const isTransparentColor = (value: string) =>
  !value ||
  value === 'transparent' ||
  /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value) ||
  /color\(srgb 0 0 0 \/ 0\)/i.test(value);

const toPixelNumber = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const isRenderableElement = (style: CSSStyleDeclaration, rect: DOMRect) =>
  style.display !== 'none' &&
  style.visibility !== 'hidden' &&
  Number(style.opacity || '1') > 0 &&
  rect.width > 0 &&
  rect.height > 0;

const drawElementBox = (
  context: CanvasRenderingContext2D,
  pageRect: DOMRect,
  element: Element
) => {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element) || window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  if (!isRenderableElement(style, rect)) {
    return;
  }

  const x = rect.left - pageRect.left;
  const y = rect.top - pageRect.top;
  const width = rect.width;
  const height = rect.height;

  if (!isTransparentColor(style.backgroundColor)) {
    context.fillStyle = style.backgroundColor;
    context.fillRect(x, y, width, height);
  }

  const borderTopWidth = toPixelNumber(style.borderTopWidth);
  const borderRightWidth = toPixelNumber(style.borderRightWidth);
  const borderBottomWidth = toPixelNumber(style.borderBottomWidth);
  const borderLeftWidth = toPixelNumber(style.borderLeftWidth);

  if (borderTopWidth > 0 && !isTransparentColor(style.borderTopColor)) {
    context.fillStyle = style.borderTopColor;
    context.fillRect(x, y, width, borderTopWidth);
  }

  if (borderBottomWidth > 0 && !isTransparentColor(style.borderBottomColor)) {
    context.fillStyle = style.borderBottomColor;
    context.fillRect(x, y + height - borderBottomWidth, width, borderBottomWidth);
  }

  if (borderLeftWidth > 0 && !isTransparentColor(style.borderLeftColor)) {
    context.fillStyle = style.borderLeftColor;
    context.fillRect(x, y, borderLeftWidth, height);
  }

  if (borderRightWidth > 0 && !isTransparentColor(style.borderRightColor)) {
    context.fillStyle = style.borderRightColor;
    context.fillRect(x + width - borderRightWidth, y, borderRightWidth, height);
  }
};

const buildCanvasFont = (style: CSSStyleDeclaration) => {
  const fontStyle = style.fontStyle || 'normal';
  const fontVariant = style.fontVariant || 'normal';
  const fontWeight = style.fontWeight || '400';
  const fontSize = style.fontSize || '16px';
  const fontFamily = style.fontFamily || MEASUREMENT_SAFE_FONT_STACK;

  return [fontStyle, fontVariant, fontWeight, fontSize, fontFamily].join(' ');
};

const resolveCanvasStrokeStyle = (style: CSSStyleDeclaration) => {
  const width = Number.parseFloat(style.webkitTextStrokeWidth || '0');

  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }

  const strokeColor = style.webkitTextStrokeColor || style.color || '#000000';

  if (isTransparentColor(strokeColor)) {
    return null;
  }

  return {
    width,
    color: strokeColor,
  };
};

const FOREIGN_OBJECT_STYLE_PROPERTIES = [
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'display',
  'box-sizing',
  'overflow',
  'overflow-x',
  'overflow-y',
  'white-space',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'background',
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration',
  'opacity',
  'transform',
  'transform-origin',
  'visibility',
  'z-index',
  'pointer-events',
];

const rewriteComputedStyleValue = (property: string, value: string) => {
  if (!value) {
    return '';
  }

  if (property === 'font-family') {
    return MEASUREMENT_SAFE_FONT_STACK;
  }

  if (property === 'background' || property === 'background-color') {
    return value.includes('url(') ? '#ffffff' : value;
  }

  return value.includes('url(') ? 'none' : value;
};

const buildForeignObjectInlineStyle = (style: CSSStyleDeclaration) =>
  FOREIGN_OBJECT_STYLE_PROPERTIES.map((property) => {
    const rewritten = rewriteComputedStyleValue(property, style.getPropertyValue(property).trim());

    if (!rewritten) {
      return '';
    }

    return `${property}:${rewritten};`;
  })
    .filter(Boolean)
    .join('');

const cloneElementForForeignObject = (sourceElement: Element, sourceWindow: Window): Element => {
  const clone = sourceElement.cloneNode(false) as Element;
  const computedStyle = sourceWindow.getComputedStyle(sourceElement);
  clone.setAttribute('style', buildForeignObjectInlineStyle(computedStyle));

  if (clone instanceof HTMLImageElement) {
    clone.removeAttribute('src');
  }

  for (const childNode of Array.from(sourceElement.childNodes)) {
    if (childNode.nodeType === Node.TEXT_NODE) {
      clone.appendChild(sourceElement.ownerDocument.createTextNode(childNode.textContent || ''));
      continue;
    }

    if (childNode.nodeType === Node.ELEMENT_NODE) {
      clone.appendChild(cloneElementForForeignObject(childNode as Element, sourceWindow));
    }
  }

  return clone;
};

const drawTextNodeGlyphs = (
  doc: Document,
  context: CanvasRenderingContext2D,
  pageRect: DOMRect,
  textNode: Text
) => {
  const parentElement = textNode.parentElement;
  const textContent = textNode.textContent || '';

  if (!parentElement || !textContent.trim()) {
    return;
  }

  const style =
    parentElement.ownerDocument.defaultView?.getComputedStyle(parentElement) ||
    window.getComputedStyle(parentElement);
  const parentRect = parentElement.getBoundingClientRect();

  if (!isRenderableElement(style, parentRect) || isTransparentColor(style.color)) {
    return;
  }

  context.save();
  context.font = buildCanvasFont(style);
  context.fillStyle = style.color;
  context.textBaseline = 'alphabetic';
  const strokeStyle = resolveCanvasStrokeStyle(style);

  if (strokeStyle) {
    context.lineWidth = Math.max(0.5, strokeStyle.width * 2);
    context.strokeStyle = strokeStyle.color;
    context.lineJoin = 'round';
    context.lineCap = 'round';
  }

  for (let index = 0; index < textContent.length; index += 1) {
    const glyph = textContent[index];

    if (!glyph || /\s/.test(glyph)) {
      continue;
    }

    const range = doc.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + 1);
    const rect = range.getBoundingClientRect();
    range.detach?.();

    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    const metrics = context.measureText(glyph);
    const ascent =
      metrics.actualBoundingBoxAscent > 0
        ? metrics.actualBoundingBoxAscent
        : Math.max(1, toPixelNumber(style.fontSize) * 0.8);
    const x = rect.left - pageRect.left;
    const y = rect.top - pageRect.top + ascent;

    if (strokeStyle) {
      context.strokeText(glyph, x, y);
    }

    context.fillText(glyph, x, y);
  }

  context.restore();
};

const capturePageElementToCanvas = async (doc: Document, pageElement: Element) => {
  const rect = pageElement.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const ownerWindow = doc.defaultView || window;
  const ownerDocument = doc;
  const assertCanvasReadable = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('HTML 캡처 canvas context 를 읽지 못했습니다.');
    }

    context.getImageData(0, 0, 1, 1);
  };

  const serializePageElementToSvg = () => {
    const view = doc.defaultView || window;
    const clonedPageElement = cloneElementForForeignObject(pageElement, view);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#ffffff;">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        body {
          width: ${width}px;
          height: ${height}px;
          overflow: hidden;
          font-family: ${MEASUREMENT_SAFE_FONT_STACK};
        }
      </style>
      ${clonedPageElement.outerHTML}
    </div>
  </foreignObject>
</svg>`;
  };

  const captureWithForeignObject = async () => {
    const svg = serializePageElementToSvg();
    const image = await loadImageFromBlob(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      ownerWindow
    );
    return drawImageToCanvas(image, width, height, ownerDocument);
  };

  const captureWithManualCanvas = () => {
    const canvas = createCanvas(width, height, ownerDocument);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('HTML 캡처 canvas context 를 만들지 못했습니다.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const elementWalker = doc.createTreeWalker(pageElement, NodeFilter.SHOW_ELEMENT);
    let currentElement = pageElement;

    while (currentElement) {
      drawElementBox(context, rect, currentElement);
      currentElement = elementWalker.nextNode() as Element | null;
    }

    const textWalker = doc.createTreeWalker(pageElement, NodeFilter.SHOW_TEXT);
    let currentTextNode = textWalker.nextNode() as Text | null;

    while (currentTextNode) {
      drawTextNodeGlyphs(doc, context, rect, currentTextNode);
      currentTextNode = textWalker.nextNode() as Text | null;
    }

    return canvas;
  };

  let canvas: HTMLCanvasElement | null = null;
  let measurementCaptureMode: 'foreign_object' | 'manual_canvas' = 'foreign_object';
  let foreignObjectReadError: unknown = null;

  try {
    canvas = await captureWithForeignObject();
    assertCanvasReadable(canvas);
  } catch (error) {
    foreignObjectReadError = error;
    measurementCaptureMode = 'manual_canvas';

    try {
      canvas = captureWithManualCanvas();
      assertCanvasReadable(canvas);
    } catch (manualCanvasError) {
      const pageHints = collectCrossOriginResourceHints(doc, pageElement);
      const hostDocumentHints = collectHostDocumentCrossOriginResourceHints();
      const fontHints = collectFontFamilyHints(doc, pageElement);
      const hintParts: string[] = [];

      if (pageHints.length > 0) {
        hintParts.push(`측정 HTML 내부 후보: ${pageHints.join(', ')}`);
      }

      if (hostDocumentHints.length > 0) {
        hintParts.push(`호스트 문서 전역 후보: ${hostDocumentHints.join(', ')}`);
      }

      if (fontHints.length > 0) {
        hintParts.push(`측정 HTML font-family 후보: ${fontHints.join(' | ')}`);
      }

      const hintMessage =
        hintParts.length > 0
          ? ` 원인 후보: ${hintParts.join(' / ')}`
          : ' 원인 후보를 자동 식별하지 못했습니다. 전역 @import 웹폰트 또는 style/url 리소스를 먼저 의심해야 합니다.';
      const manualReason = formatUnknownError(manualCanvasError);
      const foreignObjectReason = formatUnknownError(foreignObjectReadError);

      throw new Error(
        `시각 유사도 측정 실패: foreignObject 캡처와 manual canvas 캡처가 모두 실패했습니다. foreignObject=${foreignObjectReason}; manual=${manualReason}.${hintMessage}`
      );
    }
  }

  if (!canvas) {
    throw new Error('시각 유사도 측정 실패: HTML 페이지 canvas 를 생성하지 못했습니다.');
  }

  canvas.dataset.templateMeasurementCaptureMode = measurementCaptureMode;

  if (foreignObjectReadError) {
    canvas.dataset.templateMeasurementForeignObjectError = formatUnknownError(foreignObjectReadError);
  }

  return canvas;
};

const renderReplicaPagesToCanvases = async (
  html: string,
  iframe: HTMLIFrameElement,
  preferredViewport: {
    width: number;
    height: number;
  },
  onProgress?: MeasureVisualSimilarityInput['onProgress']
) => {
  const doc = await loadHtmlIntoIframe(iframe, html, preferredViewport);
  const pageElements = getRenderablePageElements(doc);
  const pageCanvases: Array<{
    pageNumber: number;
    canvas: HTMLCanvasElement;
    captureMode: 'foreign_object' | 'manual_canvas';
    foreignObjectError: string | null;
  }> = [];

  for (let index = 0; index < pageElements.length; index += 1) {
    onProgress?.({
      phase: 'capturing_pages',
      percent: pageElements.length > 0 ? 58 + Math.round((index / pageElements.length) * 16) : 70,
      stage: 'HTML 페이지를 캡처하고 있습니다.',
      detail: `브라우저 렌더 캡처 ${index + 1}/${pageElements.length}`,
    });
    const pageElement = pageElements[index];
    const pageNumber = parsePageNumber(pageElement, index + 1);
    const canvas = await capturePageElementToCanvas(doc, pageElement);

    pageCanvases.push({
      pageNumber,
      canvas,
      captureMode:
        (canvas.dataset.templateMeasurementCaptureMode as 'foreign_object' | 'manual_canvas' | undefined) ||
        'manual_canvas',
      foreignObjectError: canvas.dataset.templateMeasurementForeignObjectError || null,
    });
  }

  return pageCanvases.sort((left, right) => left.pageNumber - right.pageNumber);
};

const renderPageDataUrlsToCanvases = async (
  pdfPageDataUrls: string[],
  progressPhase: MeasureVisualSimilarityProgress['phase'],
  progressStartPercent: number,
  progressSpanPercent: number,
  progressStage: string,
  progressDetailPrefix: string,
  onProgress?: MeasureVisualSimilarityInput['onProgress']
) => {
  const pageCanvases: Array<{ pageNumber: number; canvas: HTMLCanvasElement }> = [];

  for (let index = 0; index < pdfPageDataUrls.length; index += 1) {
    onProgress?.({
      phase: progressPhase,
      percent:
        pdfPageDataUrls.length > 0
          ? progressStartPercent + Math.round((index / pdfPageDataUrls.length) * progressSpanPercent)
          : progressStartPercent + progressSpanPercent,
      stage: progressStage,
      detail: `${progressDetailPrefix} ${index + 1}/${pdfPageDataUrls.length}`,
    });
    const pageDataUrl = pdfPageDataUrls[index];

    if (!pageDataUrl) {
      continue;
    }

    const image = await loadImage(pageDataUrl);
    const canvas = drawImageToCanvas(image, image.naturalWidth, image.naturalHeight);

    pageCanvases.push({ pageNumber: index + 1, canvas });
  }

  return pageCanvases;
};

const renderPdfPagesToCanvases = async (
  pdfPageDataUrls: string[],
  onProgress?: MeasureVisualSimilarityInput['onProgress']
) =>
  renderPageDataUrlsToCanvases(
    pdfPageDataUrls,
    'preparing_pdf_pages',
    42,
    8,
    'PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.',
    'PDF 페이지 준비',
    onProgress
  );

const renderReplicaImagePagesToCanvases = async (
  replicaPageDataUrls: string[],
  onProgress?: MeasureRenderedPageImagesInput['onProgress']
) =>
  renderPageDataUrlsToCanvases(
    replicaPageDataUrls,
    'preparing_replica_pages',
    54,
    10,
    '서버에서 렌더된 HTML 페이지 PNG를 브라우저 캔버스로 정규화하고 있습니다.',
    'HTML 페이지 준비',
    onProgress
  );

const normalizeCanvasSize = (sourceCanvas: HTMLCanvasElement, width: number, height: number) => {
  if (sourceCanvas.width === width && sourceCanvas.height === height) {
    return sourceCanvas;
  }

  return drawImageToCanvas(sourceCanvas, width, height);
};

const buildInkMask = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('canvas image data 를 읽지 못했습니다.');
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);

  for (let index = 0; index < mask.length; index += 1) {
    const pixelIndex = index * 4;
    const alpha = imageData.data[pixelIndex + 3];

    if (alpha < 8) {
      continue;
    }

    const red = imageData.data[pixelIndex];
    const green = imageData.data[pixelIndex + 1];
    const blue = imageData.data[pixelIndex + 2];

    if (red < WHITE_THRESHOLD || green < WHITE_THRESHOLD || blue < WHITE_THRESHOLD) {
      mask[index] = 1;
    }
  }

  return mask;
};

const dilateMask = (mask: Uint8Array, width: number, height: number, radius: number) => {
  const dilated = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;

      if (mask[index] !== 1) {
        continue;
      }

      for (let dy = -radius; dy <= radius; dy += 1) {
        const nextY = y + dy;

        if (nextY < 0 || nextY >= height) {
          continue;
        }

        for (let dx = -radius; dx <= radius; dx += 1) {
          const nextX = x + dx;

          if (nextX < 0 || nextX >= width) {
            continue;
          }

          dilated[nextY * width + nextX] = 1;
        }
      }
    }
  }

  return dilated;
};

const countMask = (mask: Uint8Array) => {
  let count = 0;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 1) {
      count += 1;
    }
  }

  return count;
};

const subtractMask = (sourceMask: Uint8Array, excludedMask: Uint8Array) => {
  const result = new Uint8Array(sourceMask.length);

  for (let index = 0; index < sourceMask.length; index += 1) {
    if (sourceMask[index] === 1 && excludedMask[index] !== 1) {
      result[index] = 1;
    }
  }

  return result;
};

const buildLongAxisFrameMask = (inkMask: Uint8Array, width: number, height: number) => {
  const frameMask = new Uint8Array(inkMask.length);
  const minimumRunLength = 24;
  const maximumAxisDensity = 0.3;

  const hasThinHorizontalDensity = (y: number, startX: number, endX: number) => {
    const top = Math.max(0, y - 4);
    const bottom = Math.min(height - 1, y + 4);
    let inkCount = 0;
    const area = Math.max(1, (endX - startX) * (bottom - top + 1));

    for (let scanY = top; scanY <= bottom; scanY += 1) {
      for (let scanX = startX; scanX < endX; scanX += 1) {
        if (inkMask[scanY * width + scanX] === 1) {
          inkCount += 1;
        }
      }
    }

    return inkCount / area <= maximumAxisDensity;
  };

  const hasThinVerticalDensity = (x: number, startY: number, endY: number) => {
    const left = Math.max(0, x - 4);
    const right = Math.min(width - 1, x + 4);
    let inkCount = 0;
    const area = Math.max(1, (right - left + 1) * (endY - startY));

    for (let scanY = startY; scanY < endY; scanY += 1) {
      for (let scanX = left; scanX <= right; scanX += 1) {
        if (inkMask[scanY * width + scanX] === 1) {
          inkCount += 1;
        }
      }
    }

    return inkCount / area <= maximumAxisDensity;
  };

  for (let y = 0; y < height; y += 1) {
    let x = 0;

    while (x < width) {
      const index = y * width + x;

      if (inkMask[index] !== 1) {
        x += 1;
        continue;
      }

      const start = x;
      let cursor = x + 1;

      while (cursor < width && inkMask[y * width + cursor] === 1) {
        cursor += 1;
      }

      if (cursor - start >= minimumRunLength && hasThinHorizontalDensity(y, start, cursor)) {
        for (let markX = start; markX < cursor; markX += 1) {
          frameMask[y * width + markX] = 1;
        }
      }

      x = cursor;
    }
  }

  for (let x = 0; x < width; x += 1) {
    let y = 0;

    while (y < height) {
      const index = y * width + x;

      if (inkMask[index] !== 1) {
        y += 1;
        continue;
      }

      const start = y;
      let cursor = y + 1;

      while (cursor < height && inkMask[cursor * width + x] === 1) {
        cursor += 1;
      }

      if (cursor - start >= minimumRunLength && hasThinVerticalDensity(x, start, cursor)) {
        for (let markY = start; markY < cursor; markY += 1) {
          frameMask[markY * width + x] = 1;
        }
      }

      y = cursor;
    }
  }

  return frameMask;
};

const compareInkMasks = (
  sourceMask: Uint8Array,
  replicaMask: Uint8Array,
  width: number,
  height: number,
  tolerancePx: number
) => {
  const sourceDilated = dilateMask(sourceMask, width, height, tolerancePx);
  const replicaDilated = dilateMask(replicaMask, width, height, tolerancePx);
  let sourceInkPixelCount = 0;
  let replicaInkPixelCount = 0;
  let unionInkPixelCount = 0;
  let overlapInkPixelCountFromSource = 0;
  let overlapInkPixelCountFromReplica = 0;
  let exactOverlapInkPixelCount = 0;

  for (let index = 0; index < sourceMask.length; index += 1) {
    const sourceInk = sourceMask[index] === 1;
    const replicaInk = replicaMask[index] === 1;

    if (sourceInk) {
      sourceInkPixelCount += 1;
    }

    if (replicaInk) {
      replicaInkPixelCount += 1;
    }

    if (sourceInk || replicaInk) {
      unionInkPixelCount += 1;
    }

    if (sourceInk && replicaInk) {
      exactOverlapInkPixelCount += 1;
    }

    if (sourceInk && replicaDilated[index] === 1) {
      overlapInkPixelCountFromSource += 1;
    }

    if (replicaInk && sourceDilated[index] === 1) {
      overlapInkPixelCountFromReplica += 1;
    }
  }

  const overlapInkPixelCount = Math.min(
    unionInkPixelCount,
    Math.round((overlapInkPixelCountFromSource + overlapInkPixelCountFromReplica) / 2)
  );
  const overlapRatio =
    unionInkPixelCount > 0 ? overlapInkPixelCount / unionInkPixelCount : 1;
  const exactOverlapRatio =
    unionInkPixelCount > 0 ? exactOverlapInkPixelCount / unionInkPixelCount : 1;

  return {
    sourceInkPixelCount,
    replicaInkPixelCount,
    unionInkPixelCount,
    overlapInkPixelCount,
    exactOverlapInkPixelCount,
    overlapRatio,
    exactOverlapRatio,
    mismatchRatio: unionInkPixelCount > 0 ? 1 - overlapRatio : 0,
  };
};

const buildMissingLayerReport = (sourceInkPixelCount: number, replicaInkPixelCount: number) => {
  const unionInkPixelCount = Math.max(sourceInkPixelCount, replicaInkPixelCount);

  return {
    sourceInkPixelCount,
    replicaInkPixelCount,
    unionInkPixelCount,
    overlapInkPixelCount: 0,
    exactOverlapInkPixelCount: 0,
    overlapRatio: unionInkPixelCount > 0 ? 0 : 1,
    exactOverlapRatio: unionInkPixelCount > 0 ? 0 : 1,
    mismatchRatio: unionInkPixelCount > 0 ? 1 : 0,
  };
};

const suspendHostCrossOriginStylesheets = () => {
  const suspendedLinks: HTMLLinkElement[] = [];

  for (const linkElement of Array.from(document.querySelectorAll('link[rel=\"stylesheet\"][href]'))) {
    const href = linkElement.getAttribute('href') || '';

    try {
      const url = new URL(href, window.location.href);

      if (url.origin === window.location.origin) {
        continue;
      }
    } catch {
      continue;
    }

    if ((linkElement as HTMLLinkElement).disabled) {
      continue;
    }

    (linkElement as HTMLLinkElement).disabled = true;
    suspendedLinks.push(linkElement as HTMLLinkElement);
  }

  return () => {
    for (const linkElement of suspendedLinks) {
      linkElement.disabled = false;
    }
  };
};

const buildMissingPageReport = (
  pageNumber: number,
  width: number,
  height: number,
  sourceInkPixelCount: number,
  replicaInkPixelCount: number,
  notes: string[]
): TemplateExtractVisualSimilarityPageReport => {
  const combinedLayerReport = buildMissingLayerReport(sourceInkPixelCount, replicaInkPixelCount);
  const emptyFrameLayerReport = buildMissingLayerReport(0, 0);
  const emptyTextLayerReport = buildMissingLayerReport(sourceInkPixelCount, replicaInkPixelCount);

  return {
    pageNumber,
    width,
    height,
    sourceInkPixelCount: combinedLayerReport.sourceInkPixelCount,
    replicaInkPixelCount: combinedLayerReport.replicaInkPixelCount,
    unionInkPixelCount: combinedLayerReport.unionInkPixelCount,
    overlapInkPixelCount: combinedLayerReport.overlapInkPixelCount,
    exactOverlapInkPixelCount: combinedLayerReport.exactOverlapInkPixelCount,
    overlapRatio: combinedLayerReport.overlapRatio,
    exactOverlapRatio: combinedLayerReport.exactOverlapRatio,
    mismatchRatio: combinedLayerReport.mismatchRatio,
    frameLayerReport: emptyFrameLayerReport,
    textLayerReport: emptyTextLayerReport,
    notes,
  };
};

const buildVisualSimilarityReport = (
  sourcePages: Array<{ pageNumber: number; canvas: HTMLCanvasElement }>,
  replicaPages: Array<{
    pageNumber: number;
    canvas: HTMLCanvasElement;
    captureMode: string;
    foreignObjectError?: string | null;
  }>,
  tolerancePx: number,
  minimumPassScore: number,
  measurementMode: TemplateExtractVisualSimilarityReport['measurementMode'],
  reportNotes: string[],
  onProgress?: (progress: MeasureVisualSimilarityProgress) => void
) => {
  const pageCount = Math.max(replicaPages.length, sourcePages.length);
  const pageReports: TemplateExtractVisualSimilarityPageReport[] = [];
  let totalCombinedUnionInkPixelCount = 0;
  let totalCombinedOverlapInkPixelCount = 0;
  let totalFrameUnionInkPixelCount = 0;
  let totalFrameOverlapInkPixelCount = 0;
  let totalTextUnionInkPixelCount = 0;
  let totalTextOverlapInkPixelCount = 0;

  for (let index = 0; index < pageCount; index += 1) {
    onProgress?.({
      phase: 'comparing_pages',
      percent: pageCount > 0 ? 78 + Math.round((index / pageCount) * 16) : 90,
      stage: '페이지별 픽셀을 비교하고 있습니다.',
      detail: `픽셀 비교 ${index + 1}/${pageCount}`,
    });
    const sourcePage = sourcePages[index] || null;
    const replicaPage = replicaPages[index] || null;
    const pageNumber = sourcePage?.pageNumber || replicaPage?.pageNumber || index + 1;

    if (!sourcePage || !replicaPage) {
      const sourceMask = sourcePage ? buildInkMask(sourcePage.canvas) : new Uint8Array(0);
      const replicaMask = replicaPage ? buildInkMask(replicaPage.canvas) : new Uint8Array(0);
      const report = buildMissingPageReport(
        pageNumber,
        replicaPage?.canvas.width || sourcePage?.canvas.width || 0,
        replicaPage?.canvas.height || sourcePage?.canvas.height || 0,
        countMask(sourceMask),
        countMask(replicaMask),
        [!sourcePage ? 'source_page_missing' : 'replica_page_missing']
      );

      totalCombinedUnionInkPixelCount += report.unionInkPixelCount;
      totalCombinedOverlapInkPixelCount += report.overlapInkPixelCount;
      totalFrameUnionInkPixelCount += report.frameLayerReport?.unionInkPixelCount || 0;
      totalFrameOverlapInkPixelCount += report.frameLayerReport?.overlapInkPixelCount || 0;
      totalTextUnionInkPixelCount += report.textLayerReport?.unionInkPixelCount || 0;
      totalTextOverlapInkPixelCount += report.textLayerReport?.overlapInkPixelCount || 0;
      pageReports.push(report);
      continue;
    }

    const targetWidth = Math.max(1, replicaPage.canvas.width);
    const targetHeight = Math.max(1, replicaPage.canvas.height);
    const normalizedSourceCanvas = normalizeCanvasSize(sourcePage.canvas, targetWidth, targetHeight);
    const normalizedReplicaCanvas = normalizeCanvasSize(replicaPage.canvas, targetWidth, targetHeight);
    const sourceMask = buildInkMask(normalizedSourceCanvas);
    const replicaMask = buildInkMask(normalizedReplicaCanvas);
    const sourceFrameMask = buildLongAxisFrameMask(sourceMask, targetWidth, targetHeight);
    const replicaFrameMask = buildLongAxisFrameMask(replicaMask, targetWidth, targetHeight);
    const sourceTextMask = subtractMask(sourceMask, sourceFrameMask);
    const replicaTextMask = subtractMask(replicaMask, replicaFrameMask);
    const compared = compareInkMasks(sourceMask, replicaMask, targetWidth, targetHeight, tolerancePx);
    const rawFrameLayerReport = compareInkMasks(
      sourceFrameMask,
      replicaFrameMask,
      targetWidth,
      targetHeight,
      tolerancePx
    );
    const frameLayerReport =
      rawFrameLayerReport.unionInkPixelCount > 0
        ? rawFrameLayerReport
        : {
            ...rawFrameLayerReport,
            overlapRatio: 0,
            exactOverlapRatio: 0,
            mismatchRatio: 0,
          };
    const textLayerReport = compareInkMasks(sourceTextMask, replicaTextMask, targetWidth, targetHeight, tolerancePx);
    const frameScoreAvailable = frameLayerReport.unionInkPixelCount > 0;
    const report: TemplateExtractVisualSimilarityPageReport = {
      pageNumber,
      width: targetWidth,
      height: targetHeight,
      sourceInkPixelCount: compared.sourceInkPixelCount,
      replicaInkPixelCount: compared.replicaInkPixelCount,
      unionInkPixelCount: compared.unionInkPixelCount,
      overlapInkPixelCount: compared.overlapInkPixelCount,
      exactOverlapInkPixelCount: compared.exactOverlapInkPixelCount,
      overlapRatio: compared.overlapRatio,
      exactOverlapRatio: compared.exactOverlapRatio,
      mismatchRatio: compared.mismatchRatio,
      frameLayerReport,
      textLayerReport,
      notes: [
        `replica_capture_mode:${replicaPage.captureMode}`,
        frameScoreAvailable ? 'score_mode:frame_ink_overlap' : 'score_mode:combined_ink_overlap',
        'source_frame_mask:long_axis_runs_24px',
        'replica_frame_mask:long_axis_runs_24px',
        ...(frameScoreAvailable ? [] : ['frame_mask_union_missing']),
        ...(replicaPage.foreignObjectError
          ? [`replica_foreign_object_error:${replicaPage.foreignObjectError}`]
          : []),
      ],
    };

    totalCombinedUnionInkPixelCount += compared.unionInkPixelCount;
    totalCombinedOverlapInkPixelCount += compared.overlapInkPixelCount;
    totalFrameUnionInkPixelCount += frameLayerReport.unionInkPixelCount;
    totalFrameOverlapInkPixelCount += frameLayerReport.overlapInkPixelCount;
    totalTextUnionInkPixelCount += textLayerReport.unionInkPixelCount;
    totalTextOverlapInkPixelCount += textLayerReport.overlapInkPixelCount;
    pageReports.push(report);
  }

  onProgress?.({
    phase: 'aggregating',
    percent: 96,
    stage: '최종 시각 유사도를 집계하고 있습니다.',
    detail: '페이지별 frame/text overlap 결과를 분리해 최종 프레임 일치율을 계산하고 있습니다.',
  });

  const combinedScore =
    totalCombinedUnionInkPixelCount > 0 ? totalCombinedOverlapInkPixelCount / totalCombinedUnionInkPixelCount : 1;
  const frameScoreAvailable = totalFrameUnionInkPixelCount > 0;
  const frameScore = frameScoreAvailable
    ? totalFrameOverlapInkPixelCount / totalFrameUnionInkPixelCount
    : combinedScore;
  const textScore =
    totalTextUnionInkPixelCount > 0 ? totalTextOverlapInkPixelCount / totalTextUnionInkPixelCount : 1;
  const overallScore = frameScore;

  return {
    measured: true,
    measurementMode,
    tolerancePx,
    minimumPassScore,
    passed: overallScore >= minimumPassScore,
    overallScore,
    scoreMode: frameScoreAvailable ? 'frame_ink_overlap' : 'combined_ink_overlap',
    frameScore,
    textScore,
    combinedScore,
    measuredAt: new Date().toISOString(),
    pageCount,
    notes: [
      ...reportNotes,
      frameScoreAvailable ? 'primary_score:frame_ink_overlap' : 'primary_score:combined_ink_overlap',
      'combined_score:available',
      'text_score:reported_not_primary',
    ],
    pageReports,
  } satisfies TemplateExtractVisualSimilarityReport;
};

export const TemplateExtractVisualSimilarityClient = {
  async measureRenderedPageImages(
    input: MeasureRenderedPageImagesInput
  ): Promise<TemplateExtractVisualSimilarityReport> {
    const minimumPassScore = input.minimumPassScore ?? DEFAULT_MINIMUM_PASS_SCORE;
    const tolerancePx = input.tolerancePx ?? DEFAULT_TOLERANCE_PX;

    input.onProgress?.({
      phase: 'preparing_pdf_pages',
      percent: 42,
      stage: 'PDF 렌더 이미지를 준비하고 있습니다.',
      detail: `원본 PDF 페이지 ${input.pdfPageDataUrls.length}개 이미지를 비교용 canvas로 읽고 있습니다.`,
    });
    const sourcePages = await renderPdfPagesToCanvases(input.pdfPageDataUrls, input.onProgress);
    input.onProgress?.({
      phase: 'preparing_replica_pages',
      percent: 54,
      stage: 'HTML 렌더 이미지를 준비하고 있습니다.',
      detail: `서버가 렌더한 HTML 페이지 ${input.replicaPageDataUrls.length}개 이미지를 비교용 canvas로 읽고 있습니다.`,
    });
    const replicaPages = (
      await renderReplicaImagePagesToCanvases(input.replicaPageDataUrls, input.onProgress)
    ).map((page) => ({
      ...page,
      captureMode: 'server_headless_chrome',
      foreignObjectError: null,
    }));

    return buildVisualSimilarityReport(
      sourcePages,
      replicaPages,
      tolerancePx,
      minimumPassScore,
      'server_headless_chrome_capture',
      [
        'source_pdf_png_vs_server_headless_chrome_screenshot',
        'ink_union_overlap_ratio_with_1px_tolerance',
        'replica_capture_modes:server_headless_chrome',
      ],
      input.onProgress
    );
  },

  async measure(input: MeasureVisualSimilarityInput): Promise<TemplateExtractVisualSimilarityReport> {
    const minimumPassScore = input.minimumPassScore ?? DEFAULT_MINIMUM_PASS_SCORE;
    const tolerancePx = input.tolerancePx ?? DEFAULT_TOLERANCE_PX;
    const restoreHostStylesheets = suspendHostCrossOriginStylesheets();

    try {
    input.onProgress?.({
      phase: 'preparing_pdf_pages',
      percent: 42,
      stage: 'PDF 렌더 이미지를 준비하고 있습니다.',
      detail: `원본 PDF 페이지 ${input.pdfPageDataUrls.length}개 이미지를 브라우저 canvas로 읽고 있습니다.`,
    });
    const sourcePages = await renderPdfPagesToCanvases(input.pdfPageDataUrls, input.onProgress);
    const preferredViewport = {
      width: Math.max(1024, ...sourcePages.map((page) => page.canvas.width)) + 48,
      height:
        Math.max(
          1024,
          sourcePages.reduce((totalHeight, page) => totalHeight + page.canvas.height, 0)
        ) + 48,
    };
    input.onProgress?.({
      phase: 'loading_html',
      percent: 52,
      stage: '추출 HTML을 브라우저에 로드하고 있습니다.',
      detail:
        '외부 폰트와 외부 링크를 차단한 측정 전용 프레임에 output HTML을 올리고 있습니다.',
    });
    const replicaPages = await renderReplicaPagesToCanvases(
      input.html,
      input.iframe,
      preferredViewport,
      input.onProgress
    );
    const captureModes = Array.from(
      new Set(replicaPages.map((page) => page.canvas.dataset.templateMeasurementCaptureMode || 'manual_canvas'))
    );
    const measurementMode =
      captureModes.length === 1 && captureModes[0] === 'foreign_object'
        ? 'browser_foreign_object_capture'
        : 'browser_dom_capture';

    return buildVisualSimilarityReport(
      sourcePages,
      replicaPages,
      tolerancePx,
      minimumPassScore,
      measurementMode,
      [
        measurementMode === 'browser_foreign_object_capture'
          ? 'source_pdf_png_vs_browser_foreign_object_capture'
          : 'source_pdf_png_vs_browser_dom_capture',
        'ink_union_overlap_ratio_with_1px_tolerance',
        `replica_capture_modes:${captureModes.join(',')}`,
      ],
      input.onProgress
    );
    } finally {
      restoreHostStylesheets();
    }
  },
};
