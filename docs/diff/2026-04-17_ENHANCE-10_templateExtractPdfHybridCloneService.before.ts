import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';

type TextLayerMode = 'visible' | 'invisible' | 'auto';
type PageStrategy = 'digital' | 'mixed' | 'scanned';

type PdfToken = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  rotate: number;
  source: 'pdf' | 'ocr';
  confidence?: number;
};

type PdfLink = {
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
  title?: string;
};

type PageClone = {
  pageNumber: number;
  width: number;
  height: number;
  backgroundDataUrl: string;
  tokens: PdfToken[];
  links: PdfLink[];
  strategy: PageStrategy;
};

type OcrWord = {
  text: string;
  confidence?: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

export interface TemplateExtractOcrAdapter {
  recognizePngDataUrl(
    pngDataUrl: string,
    options: {
      pageNumber: number;
      languages: string[];
    }
  ): Promise<OcrWord[]>;
}

export interface TemplateExtractPdfHybridCloneOptions {
  sourceTitle?: string;
  renderScale?: number;
  textLayerMode?: TextLayerMode;
  includeAnnotations?: boolean;
  enableOcr?: boolean;
  ocrLanguages?: string[];
  ocrAdapter?: TemplateExtractOcrAdapter | null;
  maxPages?: number;
}

const DEFAULT_OPTIONS: Required<
  Pick<
    TemplateExtractPdfHybridCloneOptions,
    'renderScale' | 'textLayerMode' | 'includeAnnotations' | 'enableOcr' | 'ocrLanguages'
  >
> = {
  renderScale: 2,
  textLayerMode: 'invisible',
  includeAnnotations: true,
  enableOcr: true,
  ocrLanguages: ['kor', 'eng'],
};

let defaultOcrAdapterPromise: Promise<TemplateExtractOcrAdapter | null> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, precision = 2) => Number(value.toFixed(precision));
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toDataUrl = (mimeType: string, bytes: Buffer) => `data:${mimeType};base64,${bytes.toString('base64')}`;

const getPdfTitle = (fileName: string, fallback?: string) =>
  fallback || fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

const rectOverlapRatio = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) => {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);

  if (right <= left || bottom <= top) return 0;

  const intersection = (right - left) * (bottom - top);
  const base = Math.min(a.w * a.h, b.w * b.h) || 1;
  return intersection / base;
};

const classifyPageStrategy = (pageWidth: number, pageHeight: number, pdfTokens: PdfToken[]): PageStrategy => {
  const charCount = pdfTokens.reduce((sum, token) => sum + token.text.replace(/\s+/g, '').length, 0);
  const coveredArea = pdfTokens.reduce((sum, token) => sum + token.w * token.h, 0);
  const coverageRatio = coveredArea / Math.max(1, pageWidth * pageHeight);

  if (charCount > 80 && coverageRatio > 0.01) return 'digital';
  if (charCount > 10) return 'mixed';
  return 'scanned';
};

const mergeTokens = (pdfTokens: PdfToken[], ocrTokens: PdfToken[]): PdfToken[] => {
  if (!pdfTokens.length) return ocrTokens;
  if (!ocrTokens.length) return pdfTokens;

  const merged: PdfToken[] = [...pdfTokens];

  for (const ocrToken of ocrTokens) {
    const overlaps = pdfTokens.some((pdfToken) => rectOverlapRatio(pdfToken, ocrToken) >= 0.35);
    if (!overlaps) merged.push(ocrToken);
  }

  return merged.sort((a, b) => {
    const rowGap = Math.abs(a.y - b.y);
    if (rowGap > 4) return a.y - b.y;
    return a.x - b.x;
  });
};

const buildTokenHtml = (token: PdfToken) => {
  const fontSize = clamp(token.fontSize, 6, 72);
  const left = round(token.x);
  const top = round(token.y);
  const width = round(token.w);
  const height = round(token.h);
  const rotate = round(token.rotate);

  const style = [
    `left:${left}px`,
    `top:${top}px`,
    `width:${width}px`,
    `height:${height}px`,
    `font-size:${fontSize}px`,
    `transform:rotate(${rotate}deg)`,
  ].join(';');

  return `<span class="te-token te-token--${token.source}" style="${style}">${escapeHtml(token.text)}</span>`;
};

const buildLinkHtml = (link: PdfLink) => {
  const style = [
    `left:${round(link.x)}px`,
    `top:${round(link.y)}px`,
    `width:${round(link.w)}px`,
    `height:${round(link.h)}px`,
  ].join(';');

  const titleAttr = link.title ? ` title="${escapeHtml(link.title)}"` : '';
  return `<a class="te-link" href="${escapeHtml(link.href)}"${titleAttr} style="${style}" target="_blank" rel="noreferrer noopener"></a>`;
};

const buildPageHtml = (page: PageClone, textLayerMode: TextLayerMode) => {
  const resolvedTextMode = textLayerMode === 'auto'
    ? page.strategy === 'digital'
      ? 'visible'
      : 'invisible'
    : textLayerMode;

  return `
    <section
      class="te-page"
      data-page-number="${page.pageNumber}"
      data-strategy="${page.strategy}"
      style="width:${round(page.width)}px;height:${round(page.height)}px"
    >
      <img class="te-page__bg" src="${page.backgroundDataUrl}" alt="page-${page.pageNumber}" />
      <div class="te-page__text te-page__text--${resolvedTextMode}">
        ${page.tokens.map(buildTokenHtml).join('')}
      </div>
      <div class="te-page__links">
        ${page.links.map(buildLinkHtml).join('')}
      </div>
    </section>
  `.trim();
};

const buildDocumentHtml = (title: string, pages: PageClone[], textLayerMode: TextLayerMode) => {
  const body = pages.map((page) => buildPageHtml(page, textLayerMode)).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="template-extract-engine" content="hybrid-clone-v1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --page-gap: 20px;
      --page-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      --page-bg: #ffffff;
      --canvas-bg: #f3f4f6;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--canvas-bg); }
    body {
      font-family: "Noto Sans KR", "Malgun Gothic", Arial, sans-serif;
      color: #111827;
      padding: 24px 0 40px;
    }

    .te-page {
      position: relative;
      margin: 0 auto var(--page-gap);
      background: var(--page-bg);
      box-shadow: var(--page-shadow);
      overflow: hidden;
    }

    .te-page__bg,
    .te-page__text,
    .te-page__links {
      position: absolute;
      inset: 0;
    }

    .te-page__bg {
      width: 100%;
      height: 100%;
      object-fit: fill;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
    }

    .te-page__text {
      user-select: text;
      pointer-events: none;
    }

    .te-page__text--invisible .te-token {
      color: transparent;
    }

    .te-page__text--visible .te-token {
      color: #111827;
      mix-blend-mode: multiply;
    }

    .te-token {
      position: absolute;
      transform-origin: 0 0;
      white-space: pre;
      line-height: 1;
      font-weight: 400;
      font-family: "Noto Sans KR", "Malgun Gothic", Arial, sans-serif;
    }

    .te-page__links {
      pointer-events: auto;
    }

    .te-link {
      position: absolute;
      display: block;
      text-decoration: none;
      background: transparent;
    }

    .te-link:hover {
      outline: 1px dashed rgba(37, 99, 235, 0.55);
      background: rgba(37, 99, 235, 0.08);
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
};

const getDefaultOcrAdapter = async (): Promise<TemplateExtractOcrAdapter | null> => {
  if (!defaultOcrAdapterPromise) {
    defaultOcrAdapterPromise = (async () => {
      try {
        const { createWorker } = await import('tesseract.js');

        const adapter: TemplateExtractOcrAdapter = {
          async recognizePngDataUrl(pngDataUrl, options) {
            const worker = await createWorker(options.languages.join('+'));
            try {
              const result = await worker.recognize(pngDataUrl);
              const words = result.data.words ?? [];
              return words
                .filter((word: any) => String(word.text || '').trim())
                .map((word: any) => ({
                  text: String(word.text),
                  confidence: typeof word.confidence === 'number' ? word.confidence : undefined,
                  bbox: {
                    x0: Number(word.bbox?.x0 ?? 0),
                    y0: Number(word.bbox?.y0 ?? 0),
                    x1: Number(word.bbox?.x1 ?? 0),
                    y1: Number(word.bbox?.y1 ?? 0),
                  },
                }));
            } finally {
              await worker.terminate();
            }
          },
        };

        return adapter;
      } catch {
        return null;
      }
    })();
  }

  return defaultOcrAdapterPromise;
};

const renderPageToPng = async (page: any, renderScale: number) => {
  const { createCanvas } = await import('canvas');
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as any,
    viewport,
  }).promise;

  const buffer = canvas.toBuffer('image/png');
  return {
    dataUrl: toDataUrl('image/png', buffer),
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
  };
};

const extractPdfTokens = async (pdfjs: any, page: any, viewport: any): Promise<PdfToken[]> => {
  const textContent = await page.getTextContent({
    includeMarkedContent: true,
    disableNormalization: false,
  });

  const tokens: PdfToken[] = [];

  for (const item of textContent.items ?? []) {
    if (!item || typeof item.str !== 'string') continue;
    if (!item.str.trim()) continue;

    const transform = pdfjs.Util.transform(viewport.transform, item.transform);
    const rotate = Math.atan2(transform[1], transform[0]) * (180 / Math.PI);
    const fontSize = Math.max(
      1,
      Math.hypot(transform[0], transform[1]) || Math.hypot(transform[2], transform[3]) || item.height || 10
    );

    const x = clamp(transform[4], 0, viewport.width);
    const y = clamp(transform[5] - fontSize, 0, viewport.height);
    const w = clamp((item.width || 0) * viewport.scale, 1, viewport.width);
    const h = clamp((item.height || fontSize) * viewport.scale, fontSize, viewport.height);

    tokens.push({
      text: item.str,
      x,
      y,
      w,
      h,
      fontSize,
      rotate,
      source: 'pdf',
    });
  }

  return tokens;
};

const extractPdfLinks = async (page: any, viewport: any): Promise<PdfLink[]> => {
  const annotations = await page.getAnnotations();
  const links: PdfLink[] = [];

  for (const annotation of annotations ?? []) {
    if (annotation?.subtype !== 'Link') continue;

    const href = annotation.url || annotation.unsafeUrl;
    if (!href || !annotation.rect) continue;

    const rect = viewport.convertToViewportRectangle(annotation.rect);
    const left = Math.min(rect[0], rect[2]);
    const top = Math.min(rect[1], rect[3]);
    const right = Math.max(rect[0], rect[2]);
    const bottom = Math.max(rect[1], rect[3]);

    links.push({
      x: clamp(left, 0, viewport.width),
      y: clamp(top, 0, viewport.height),
      w: clamp(right - left, 1, viewport.width),
      h: clamp(bottom - top, 1, viewport.height),
      href: String(href),
      title: annotation.title || annotation.contents || undefined,
    });
  }

  return links;
};

const convertOcrWordsToTokens = (
  words: OcrWord[],
  pageWidth: number,
  pageHeight: number,
  renderedWidth: number,
  renderedHeight: number
): PdfToken[] => {
  const scaleX = pageWidth / Math.max(1, renderedWidth);
  const scaleY = pageHeight / Math.max(1, renderedHeight);

  return words
    .filter((word) => word.text.trim())
    .map((word) => {
      const x = clamp(word.bbox.x0 * scaleX, 0, pageWidth);
      const y = clamp(word.bbox.y0 * scaleY, 0, pageHeight);
      const w = clamp((word.bbox.x1 - word.bbox.x0) * scaleX, 1, pageWidth);
      const h = clamp((word.bbox.y1 - word.bbox.y0) * scaleY, 1, pageHeight);

      return {
        text: word.text,
        x,
        y,
        w,
        h,
        fontSize: Math.max(8, h * 0.85),
        rotate: 0,
        source: 'ocr',
        confidence: word.confidence,
      };
    });
};

const extractSinglePageClone = async (
  pdfjs: any,
  page: any,
  pageNumber: number,
  options: Required<
    Pick<
      TemplateExtractPdfHybridCloneOptions,
      'renderScale' | 'textLayerMode' | 'includeAnnotations' | 'enableOcr' | 'ocrLanguages'
    >
  > & Pick<TemplateExtractPdfHybridCloneOptions, 'ocrAdapter'>
): Promise<PageClone> => {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = round(viewport.width);
  const pageHeight = round(viewport.height);

  const pdfTokens = await extractPdfTokens(pdfjs, page, viewport);
  const strategy = classifyPageStrategy(pageWidth, pageHeight, pdfTokens);

  const rendered = await renderPageToPng(page, options.renderScale);

  let ocrTokens: PdfToken[] = [];
  const needsOcr = options.enableOcr && (strategy === 'scanned' || strategy === 'mixed');

  if (needsOcr) {
    const adapter = options.ocrAdapter ?? (await getDefaultOcrAdapter());

    if (adapter) {
      const words = await adapter.recognizePngDataUrl(rendered.dataUrl, {
        pageNumber,
        languages: options.ocrLanguages,
      });

      ocrTokens = convertOcrWordsToTokens(
        words,
        pageWidth,
        pageHeight,
        rendered.pixelWidth,
        rendered.pixelHeight
      );
    }
  }

  const tokens =
    strategy === 'digital'
      ? pdfTokens
      : strategy === 'mixed'
        ? mergeTokens(pdfTokens, ocrTokens)
        : ocrTokens.length
          ? ocrTokens
          : [];

  const links = options.includeAnnotations ? await extractPdfLinks(page, viewport) : [];

  return {
    pageNumber,
    width: pageWidth,
    height: pageHeight,
    backgroundDataUrl: rendered.dataUrl,
    tokens,
    links,
    strategy,
  };
};

export const TemplateExtractPdfHybridCloneService = {
  async extractPdfSource(
    fileName: string,
    bytes: Uint8Array,
    options: TemplateExtractPdfHybridCloneOptions = {}
  ): Promise<TemplateExtractResolvedSource> {
    const mergedOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      stopAtErrors: false,
    });

    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, options.maxPages ?? pdf.numPages);
    const pages: PageClone[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const pageClone = await extractSinglePageClone(pdfjs, page, pageNumber, mergedOptions);
        pages.push(pageClone);
      } finally {
        if (typeof page.cleanup === 'function') page.cleanup();
      }
    }

    if (!pages.length) {
      throw new Error('PDF 페이지를 읽지 못했습니다.');
    }

    const sourceTitle = getPdfTitle(fileName, options.sourceTitle);
    const html = buildDocumentHtml(sourceTitle, pages, mergedOptions.textLayerMode);

    return {
      sourceTitle,
      sourceKind: 'html',
      sourceContent: html,
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  },

  async createTesseractOcrAdapter(): Promise<TemplateExtractOcrAdapter | null> {
    return getDefaultOcrAdapter();
  },
};