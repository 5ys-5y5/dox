type RenderInput = {
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

const buildRenderLines = (input: RenderInput) => [
  `문서 제목: ${input.documentTitle}`,
  `문서 ID: ${input.documentId}`,
  `버전: ${input.versionNumber}`,
  `생성 시각: ${input.generatedAt}`,
  '',
  ...htmlToLines(input.htmlCanonical),
];

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

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
})();

const crc32 = (input: Uint8Array) => {
  let crc = 0xffffffff;

  for (const byte of input) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const getDosDateTime = (value: Date) => {
  const year = Math.max(1980, value.getUTCFullYear());
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  const hours = value.getUTCHours();
  const minutes = value.getUTCMinutes();
  const seconds = Math.floor(value.getUTCSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;

  return { dosDate, dosTime };
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const buildStoredZip = (entries: ZipEntry[]) => {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const encoder = new TextEncoder();
  const now = getDosDateTime(new Date());
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const entryBuffer = Buffer.from(entry.data);
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entryBuffer.length, 18);
    localHeader.writeUInt32LE(entryBuffer.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    Buffer.from(nameBytes).copy(localHeader, 30);

    fileParts.push(localHeader, entryBuffer);

    const centralHeader = Buffer.alloc(46 + nameBytes.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entryBuffer.length, 20);
    centralHeader.writeUInt32LE(entryBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    Buffer.from(nameBytes).copy(centralHeader, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + entryBuffer.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return new Uint8Array(Buffer.concat([...fileParts, centralDirectory, endOfCentralDirectory]));
};

const buildDocxDocumentXml = (lines: string[]) => {
  const paragraphXml = lines
    .map((line) => {
      if (!line) {
        return '<w:p/>';
      }

      return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    ${paragraphXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
};

const buildDocxBytes = (input: RenderInput) => {
  const encoder = new TextEncoder();
  const lines = buildRenderLines(input);
  const created = new Date(input.generatedAt).toISOString();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(input.documentTitle)}</dc:title>
  <dc:creator>Codex Export Renderer</dc:creator>
  <cp:lastModifiedBy>Codex Export Renderer</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>`;

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex Export Renderer</Application>
</Properties>`;

  const documentXml = buildDocxDocumentXml(lines);

  return buildStoredZip([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { name: 'docProps/core.xml', data: encoder.encode(coreXml) },
    { name: 'docProps/app.xml', data: encoder.encode(appXml) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
  ]);
};

export const ExportRendererService = {
  renderPdf(input: RenderInput) {
    const lines = buildRenderLines(input).flatMap((line) => (line ? wrapLine(line) : ['']));

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

  renderDocx(input: RenderInput) {
    return buildDocxBytes(input);
  },
};
