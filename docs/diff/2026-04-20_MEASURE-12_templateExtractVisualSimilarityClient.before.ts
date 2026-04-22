import type {
  TemplateExtractVisualSimilarityPageReport,
  TemplateExtractVisualSimilarityReport,
} from './templateExtractDtos';

type MeasureVisualSimilarityInput = {
  html: string;
  pdfPageDataUrls: string[];
  iframe: HTMLIFrameElement;
  minimumPassScore?: number;
  tolerancePx?: number;
  onProgress?: (progress: {
    phase:
      | 'preparing_pdf_pages'
      | 'loading_html'
      | 'capturing_pages'
      | 'comparing_pages'
      | 'aggregating';
    percent: number;
    stage: string;
    detail: string;
  }) => void;
};

const DEFAULT_MINIMUM_PASS_SCORE = 0.95;
const DEFAULT_TOLERANCE_PX = 1;
const WHITE_THRESHOLD = 250;
const MEASUREMENT_SAFE_FONT_ALIAS = 'TemplateExtractMeasurementSans';
const MEASUREMENT_SAFE_FONT_STACK = `"${MEASUREMENT_SAFE_FONT_ALIAS}", sans-serif`;
const CANVAS_SAFE_FONT_STACK = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
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

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다. ${src.slice(0, 48)}`));
    image.src = src;
  });

const loadImageFromBlob = async (blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
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

const drawImageToCanvas = (image: CanvasImageSource, width: number, height: number) => {
  const canvas = createCanvas(width, height);
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
  const fontFamily = (style.fontFamily || MEASUREMENT_SAFE_FONT_STACK).replaceAll(
    MEASUREMENT_SAFE_FONT_ALIAS,
    CANVAS_SAFE_FONT_STACK
  );

  return [fontStyle, fontVariant, fontWeight, fontSize, fontFamily].join(' ');
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
    context.fillText(glyph, x, y);
  }

  context.restore();
};

const capturePageElementToCanvas = async (doc: Document, pageElement: Element) => {
  const rect = pageElement.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  const serializePageElementToSvg = () => {
    const styleText = Array.from(doc.querySelectorAll('style'))
      .map((styleElement) => styleElement.textContent || '')
      .join('\n');

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
        ${styleText}
      </style>
      ${pageElement.outerHTML}
    </div>
  </foreignObject>
</svg>`;
  };

  const captureWithForeignObject = async () => {
    const svg = serializePageElementToSvg();
    const image = await loadImageFromBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    return drawImageToCanvas(image, width, height);
  };

  const captureWithManualCanvas = () => {
    const canvas = createCanvas(width, height);
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

  let canvas: HTMLCanvasElement;
  let measurementCaptureMode: 'foreign_object' | 'manual_canvas' = 'foreign_object';

  try {
    canvas = await captureWithForeignObject();
  } catch {
    measurementCaptureMode = 'manual_canvas';
    canvas = captureWithManualCanvas();
  }

  try {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('HTML 캡처 canvas context 를 읽지 못했습니다.');
    }

    context.getImageData(0, 0, 1, 1);
  } catch (error) {
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
    const reason = error instanceof Error ? error.message : 'unknown_error';

    throw new Error(
      `시각 유사도 측정 실패: HTML 수동 렌더 canvas 가 예상치 못하게 taint 되었습니다. ${reason}.${hintMessage}`
    );
  }

  canvas.dataset.templateMeasurementCaptureMode = measurementCaptureMode;
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
  const pageCanvases: Array<{ pageNumber: number; canvas: HTMLCanvasElement }> = [];

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

    pageCanvases.push({ pageNumber, canvas });
  }

  return pageCanvases.sort((left, right) => left.pageNumber - right.pageNumber);
};

const renderPdfPagesToCanvases = async (
  pdfPageDataUrls: string[],
  onProgress?: MeasureVisualSimilarityInput['onProgress']
) => {
  const pageCanvases: Array<{ pageNumber: number; canvas: HTMLCanvasElement }> = [];

  for (let index = 0; index < pdfPageDataUrls.length; index += 1) {
    onProgress?.({
      phase: 'preparing_pdf_pages',
      percent: pdfPageDataUrls.length > 0 ? 42 + Math.round((index / pdfPageDataUrls.length) * 8) : 50,
      stage: 'PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.',
      detail: `PDF 페이지 준비 ${index + 1}/${pdfPageDataUrls.length}`,
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
  const unionInkPixelCount = Math.max(sourceInkPixelCount, replicaInkPixelCount);

  return {
    pageNumber,
    width,
    height,
    sourceInkPixelCount,
    replicaInkPixelCount,
    unionInkPixelCount,
    overlapInkPixelCount: 0,
    exactOverlapInkPixelCount: 0,
    overlapRatio: unionInkPixelCount > 0 ? 0 : 1,
    exactOverlapRatio: unionInkPixelCount > 0 ? 0 : 1,
    mismatchRatio: unionInkPixelCount > 0 ? 1 : 0,
    notes,
  };
};

export const TemplateExtractVisualSimilarityClient = {
  async measure(input: MeasureVisualSimilarityInput): Promise<TemplateExtractVisualSimilarityReport> {
    const minimumPassScore = input.minimumPassScore ?? DEFAULT_MINIMUM_PASS_SCORE;
    const tolerancePx = input.tolerancePx ?? DEFAULT_TOLERANCE_PX;
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
    const pageCount = Math.max(replicaPages.length, sourcePages.length);
    const pageReports: TemplateExtractVisualSimilarityPageReport[] = [];
    let totalUnionInkPixelCount = 0;
    let totalOverlapInkPixelCount = 0;

    for (let index = 0; index < pageCount; index += 1) {
      input.onProgress?.({
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

        totalUnionInkPixelCount += report.unionInkPixelCount;
        pageReports.push(report);
        continue;
      }

      const targetWidth = Math.max(1, replicaPage.canvas.width);
      const targetHeight = Math.max(1, replicaPage.canvas.height);
      const normalizedSourceCanvas = normalizeCanvasSize(sourcePage.canvas, targetWidth, targetHeight);
      const normalizedReplicaCanvas = normalizeCanvasSize(replicaPage.canvas, targetWidth, targetHeight);
      const sourceMask = buildInkMask(normalizedSourceCanvas);
      const replicaMask = buildInkMask(normalizedReplicaCanvas);
      const compared = compareInkMasks(sourceMask, replicaMask, targetWidth, targetHeight, tolerancePx);
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
        mismatchRatio: compared.unionInkPixelCount > 0 ? 1 - compared.overlapRatio : 0,
        notes: [],
      };

      totalUnionInkPixelCount += compared.unionInkPixelCount;
      totalOverlapInkPixelCount += compared.overlapInkPixelCount;
      pageReports.push(report);
    }

    input.onProgress?.({
      phase: 'aggregating',
      percent: 96,
      stage: '최종 시각 유사도를 집계하고 있습니다.',
      detail: '페이지별 overlap 결과를 합산해 최종 1px 허용 오차 중첩률을 계산하고 있습니다.',
    });
    const overallScore =
      totalUnionInkPixelCount > 0 ? totalOverlapInkPixelCount / totalUnionInkPixelCount : 1;

    const captureModes = Array.from(
      new Set(replicaPages.map((page) => page.canvas.dataset.templateMeasurementCaptureMode || 'manual_canvas'))
    );
    const measurementMode =
      captureModes.length === 1 && captureModes[0] === 'foreign_object'
        ? 'browser_foreign_object_capture'
        : 'browser_dom_capture';

    return {
      measured: true,
      measurementMode,
      tolerancePx,
      minimumPassScore,
      passed: overallScore >= minimumPassScore,
      overallScore,
      measuredAt: new Date().toISOString(),
      pageCount,
      notes: [
        measurementMode === 'browser_foreign_object_capture'
          ? 'source_pdf_png_vs_browser_foreign_object_capture'
          : 'source_pdf_png_vs_browser_dom_capture',
        'ink_union_overlap_ratio_with_1px_tolerance',
        `replica_capture_modes:${captureModes.join(',')}`,
      ],
      pageReports,
    };
  },
};
