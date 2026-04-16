type PdfRenderInput = {
  documentTitle: string;
  documentId: string;
  versionNumber: number;
  generatedAt: string;
  htmlCanonical: string;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_PADDING_X = 50;
const PAGE_START_Y = 790;
const PAGE_LINE_HEIGHT = 18;
const MAX_LINES_PER_PAGE = 38;

const decodeHtmlEntities = (input: string) =>
  input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const htmlToLines = (htmlCanonical: string) => {
  const normalized = decodeHtmlEntities(htmlCanonical)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h1|h2|h3|p|div|section|article|header|footer|li|ul|ol)>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/th>/gi, ': ')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  return normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const wrapLine = (line: string, limit = 34) => {
  const chars = Array.from(line);
  const chunks: string[] = [];

  for (let index = 0; index < chars.length; index += limit) {
    chunks.push(chars.slice(index, index + limit).join(''));
  }

  return chunks.length > 0 ? chunks : [''];
};

const toUtf16BeHex = (text: string) => {
  let hex = '';

  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0x20;

    if (codePoint <= 0xffff) {
      hex += codePoint.toString(16).padStart(4, '0').toUpperCase();
      continue;
    }

    const adjusted = codePoint - 0x10000;
    const high = 0xd800 + (adjusted >> 10);
    const low = 0xdc00 + (adjusted & 0x3ff);
    hex += high.toString(16).padStart(4, '0').toUpperCase();
    hex += low.toString(16).padStart(4, '0').toUpperCase();
  }

  return hex;
};

const buildPdfContentStream = (lines: string[]) => {
  const commands = ['BT', '/F1 13 Tf', `${PAGE_LINE_HEIGHT} TL`, `1 0 0 1 ${PAGE_PADDING_X} ${PAGE_START_Y} Tm`];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('T*');
    }

    commands.push(`<${toUtf16BeHex(line)}> Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
};

const buildPdfDocument = (pages: string[][]) => {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] =
    '<< /Type /Font /Subtype /Type0 /BaseFont /HYGoThic-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [4 0 R] >>';
  objects[4] =
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYGoThic-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 1 >> >>';

  let nextObjectId = 5;

  for (const pageLines of pages) {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    const contentStream = buildPdfContentStream(pageLines);

    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] =
      `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const objectBody = objects[objectId];

    if (!objectBody) {
      continue;
    }

    offsets[objectId] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${objectId} 0 obj\n${objectBody}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const offset = offsets[objectId] || 0;
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
};

export const ExportRendererService = {
  renderPdf(input: PdfRenderInput) {
    const extractedLines = htmlToLines(input.htmlCanonical);
    const lines = [
      `문서 제목: ${input.documentTitle}`,
      `문서 ID: ${input.documentId}`,
      `버전: ${input.versionNumber}`,
      `생성 시각: ${input.generatedAt}`,
      '',
      ...extractedLines,
    ].flatMap((line) => (line ? wrapLine(line) : ['']));

    const pages: string[][] = [];
    let currentPage: string[] = [];

    for (const line of lines) {
      if (currentPage.length >= MAX_LINES_PER_PAGE) {
        pages.push(currentPage);
        currentPage = [];
      }

      currentPage.push(line);
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return buildPdfDocument(pages);
  },
};
