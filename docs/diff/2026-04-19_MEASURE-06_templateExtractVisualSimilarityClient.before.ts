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

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
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

const loadHtmlIntoIframe = async (iframe: HTMLIFrameElement, html: string) => {
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

  iframe.srcdoc = html;
  const doc = await loaded;
  await waitForNextFrame();

  if (doc.fonts?.ready) {
    await doc.fonts.ready.catch(() => undefined);
    await waitForNextFrame();
  }

  return doc;
};

const buildPageSvg = (doc: Document, pageElement: Element, width: number, height: number) => {
  const styleMarkup = Array.from(doc.querySelectorAll('style'))
    .map((styleElement) => `<style>${styleElement.textContent || ''}</style>`)
    .join('\n');
  const pageHtml = pageElement.outerHTML;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#ffffff;">
      ${styleMarkup}
      ${pageHtml}
    </div>
  </foreignObject>
</svg>`;
};

const capturePageElementToCanvas = async (doc: Document, pageElement: Element) => {
  const rect = pageElement.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const svg = buildPageSvg(doc, pageElement, width, height);
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadImage(blobUrl);
    const canvas = drawImageToCanvas(image, width, height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('HTML 캡처 canvas context 를 만들지 못했습니다.');
    }

    try {
      context.getImageData(0, 0, 1, 1);
    } catch (error) {
      const hints = collectCrossOriginResourceHints(doc, pageElement);
      const hintMessage =
        hints.length > 0
          ? ` 의심되는 외부 리소스: ${hints.join(', ')}`
          : ' 의심되는 외부 리소스를 자동 식별하지 못했습니다.';
      const reason = error instanceof Error ? error.message : 'unknown_error';

      throw new Error(
        `시각 유사도 측정 실패: HTML 캡처 canvas 가 cross-origin 리소스로 taint 되었습니다. ${reason}.${hintMessage}`
      );
    }

    return canvas;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const renderReplicaPagesToCanvases = async (
  html: string,
  iframe: HTMLIFrameElement,
  onProgress?: MeasureVisualSimilarityInput['onProgress']
) => {
  const doc = await loadHtmlIntoIframe(iframe, html);
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
    input.onProgress?.({
      phase: 'loading_html',
      percent: 52,
      stage: '추출 HTML을 브라우저에 로드하고 있습니다.',
      detail: '실제 브라우저 렌더 결과를 캡처하기 위해 숨김 프레임에 output HTML을 올리고 있습니다.',
    });
    const replicaPages = await renderReplicaPagesToCanvases(input.html, input.iframe, input.onProgress);
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

    return {
      measured: true,
      measurementMode: 'browser_dom_capture',
      tolerancePx,
      minimumPassScore,
      passed: overallScore >= minimumPassScore,
      overallScore,
      measuredAt: new Date().toISOString(),
      pageCount,
      notes: [
        'source_pdf_png_vs_browser_dom_capture',
        'ink_union_overlap_ratio_with_1px_tolerance',
      ],
      pageReports,
    };
  },
};
