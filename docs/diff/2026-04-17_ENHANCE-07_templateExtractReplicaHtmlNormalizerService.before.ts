// CHECKLIST: ENHANCE-07 offline gate false-negative 완화 전 상태
// TARGET: src/services/templateExtractReplicaHtmlNormalizerService.ts
// NOTE: 아래 구간은 page wrapper inference 보정 직전 버전입니다.

  normalizeReplicaHtml(html: string): NormalizedReplicaHtml {
    const rootTag = html.match(ROOT_SECTION_REGEX)?.[0] || null;
    const rootAttributes = rootTag ? parseAttributesFromTag(rootTag) : {};

    const pages = Array.from(html.matchAll(PAGE_TAG_REGEX)).map((match) => {
      const attrs = parseAttributesFromTag(match[0]);
      return {
        pageNumber: Number(match[3]),
        width: parsePixelValue(attrs.style, 'width'),
        height: parsePixelValue(attrs.style, 'height'),
      };
    });

    const pageCount = pages.length > 0 ? pages.length : rootTag ? 1 : 0;
    const textContent = normalizeTextContent(html);
    const valueMarkerCount = countMatches(html, /data-template-value=/g);
    const tableCount = countMatches(html, /<table\b/gi);
    const rowCount = countMatches(html, /<tr\b/gi);
    const cellCount = countMatches(html, /<(td|th)\b/gi);
    const svgCount = countMatches(html, /<svg\b/gi);
    const frameHorizontalCount = countMatches(html, /template-clone__pdf-frame-line--horizontal/g);
    const frameVerticalCount = countMatches(html, /template-clone__pdf-frame-line--vertical/g);
    const fullPageBackgroundImageCount = countMatches(html, /class="[^"]*\bte-page__bg\b[^"]*"/g);
    const vectorLayerPresent =
      svgCount > 0 || tableCount > 0 || frameHorizontalCount > 0 || frameVerticalCount > 0;

    return {
      cloneId: rootAttributes['data-template-clone'] || null,
      rootAttributes,
      hasDraftRoot: Boolean(rootTag),
      pageCount,
      pages,
      textContent,
      valueMarkerCount,
      tableCount,
      rowCount,
      cellCount,
      svgCount,
      frameHorizontalCount,
      frameVerticalCount,
      fullPageBackgroundImageCount,
      layerPresence: {
        vector: vectorLayerPresent,
        text: textContent.length > 0,
        placeholder: valueMarkerCount > 0,
      },
    };
  },
