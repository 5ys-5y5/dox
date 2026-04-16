type DocxPair = {
  label: string;
  value: string;
};

const WORD_TEXT_TAG_PATTERN = /<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g;
const WORD_ROW_TAG_PATTERN = /<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g;
const WORD_CELL_TAG_PATTERN = /<w:tc(?=[\s>])[^>]*>[\s\S]*?<\/w:tc>/g;
const WORD_PARAGRAPH_TAG_PATTERN = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const WORD_BLOCK_PATTERN = /<w:(tbl|p)(?=[\s>])[\s\S]*?<\/w:\1>/g;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripXmlTags = (value: string) => value.replace(/<[^>]+>/g, ' ');

const extractWordText = (xmlFragment: string) => {
  const runs = Array.from(xmlFragment.matchAll(WORD_TEXT_TAG_PATTERN)).map((match) =>
    decodeXmlEntities(match[1])
  );

  if (runs.length === 0) {
    return normalizeWhitespace(stripXmlTags(decodeXmlEntities(xmlFragment)));
  }

  return normalizeWhitespace(stripXmlTags(runs.join(' ')));
};

const parseParagraphPair = (text: string): DocxPair | null => {
  const matched = text.match(/^([^:：]{1,60})[:：]\s*(.+)$/);

  if (!matched) {
    return null;
  }

  const label = normalizeWhitespace(matched[1]);
  const value = normalizeWhitespace(matched[2]);

  if (!label || !value) {
    return null;
  }

  return { label, value };
};

const toDocxRowPairs = (cells: string[]) => {
  if (cells.length < 2 || cells.length % 2 !== 0) {
    return [];
  }

  const pairs: DocxPair[] = [];

  for (let index = 0; index < cells.length; index += 2) {
    const label = cells[index]?.trim() || '';
    const value = cells[index + 1]?.trim() || '';

    if (!label || !value) {
      return [];
    }

    pairs.push({ label, value });
  }

  return pairs;
};

const buildParagraphClone = (text: string, sourceTitle: string) => {
  const pair = parseParagraphPair(text);

  if (pair) {
    return `<p><strong>${escapeHtml(pair.label)}</strong>: <span data-template-value="${escapeHtml(
      pair.label
    )}">${escapeHtml(pair.value)}</span></p>`;
  }

  if (text === sourceTitle) {
    return '';
  }

  return `<p>${escapeHtml(text)}</p>`;
};

const buildTableClone = (tableXml: string) => {
  const rowsHtml = Array.from(tableXml.matchAll(WORD_ROW_TAG_PATTERN))
    .map((rowMatch) => {
      const cells = Array.from(rowMatch[0].matchAll(WORD_CELL_TAG_PATTERN))
        .map((cellMatch) => extractWordText(cellMatch[0]))
        .filter(Boolean);

      const pairs = toDocxRowPairs(cells);

      if (pairs.length > 0) {
        const pairCells = pairs
          .map(
            (pair) =>
              `<th>${escapeHtml(pair.label)}</th><td><div data-template-value="${escapeHtml(
                pair.label
              )}">${escapeHtml(pair.value)}</div></td>`
          )
          .join('');

        return `    <tr>${pairCells}</tr>`;
      }

      const plainCells = cells
        .map((cell) => `<td>${escapeHtml(cell)}</td>`)
        .join('');

      return plainCells ? `    <tr>${plainCells}</tr>` : '';
    })
    .filter(Boolean)
    .join('\n');

  if (!rowsHtml) {
    return '';
  }

  return `<table class="template-clone__table">
${rowsHtml}
</table>`;
};

export const TemplateExtractDocxLayoutService = {
  buildCloneHtml(sourceTitle: string, documentXml: string) {
    const blocks = Array.from(documentXml.matchAll(WORD_BLOCK_PATTERN)).map((match) => ({
      kind: match[1],
      markup: match[0],
    }));

    const firstParagraph = Array.from(documentXml.matchAll(WORD_PARAGRAPH_TAG_PATTERN))
      .map((paragraphMatch) => extractWordText(paragraphMatch[0]))
      .find(Boolean);

    const heading = firstParagraph || sourceTitle;
    const bodyHtml = blocks
      .map((block) => {
        if (block.kind === 'tbl') {
          return buildTableClone(block.markup);
        }

        const text = extractWordText(block.markup);

        if (!text) {
          return '';
        }

        return buildParagraphClone(text, heading);
      })
      .filter(Boolean)
      .join('\n');

    return `<section data-template-extract-draft="true" data-template-clone="docx">
  <div class="template-clone template-clone--docx">
    <h1>${escapeHtml(heading)}</h1>
${bodyHtml
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  </div>
</section>`;
  },
};
