import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfPage,
  TemplateExtractPdfPipelineTrace,
  TemplateExtractPdfTopologySummary,
  TemplateExtractReplicaQualityReport,
} from '../lib/templateExtractDtos';

type NormalizedReplicaPage = {
  pageNumber: number;
  width: number | null;
  height: number | null;
};

export type NormalizedReplicaHtml = {
  cloneId: string | null;
  rootAttributes: Record<string, string>;
  hasDraftRoot: boolean;
  pageCount: number;
  pages: NormalizedReplicaPage[];
  textContent: string;
  valueMarkerCount: number;
  tableCount: number;
  rowCount: number;
  cellCount: number;
  svgCount: number;
  frameHorizontalCount: number;
  frameVerticalCount: number;
  fullPageBackgroundImageCount: number;
  layerPresence: {
    vector: boolean;
    text: boolean;
    placeholder: boolean;
  };
};

const ROOT_SECTION_REGEX = /<section\b[^>]*data-template-extract-draft="true"[^>]*>/i;
const ATTRIBUTE_REGEX = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g;
const PAGE_TAG_REGEX = /<([a-z0-9:-]+)\b([^>]*\bdata-page(?:-number)?="(\d+)"[^>]*)>/gi;
const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const decodeHtml = (value: string) =>
  value.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (matched) => HTML_ENTITY_MAP[matched] || matched);

const countMatches = (value: string, pattern: RegExp) => {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
};

const parseAttributesFromTag = (tag: string) => {
  const attrs: Record<string, string> = {};

  for (const match of tag.matchAll(ATTRIBUTE_REGEX)) {
    attrs[match[1]] = decodeHtml(match[2]);
  }

  return attrs;
};

const parsePixelValue = (styleValue: string | undefined, propertyName: 'width' | 'height') => {
  if (!styleValue) {
    return null;
  }

  const matched = styleValue.match(new RegExp(`${propertyName}\\s*:\\s*([0-9.]+)px`, 'i'));
  return matched ? Number(matched[1]) : null;
};

const normalizeTextContent = (html: string) =>
  decodeHtml(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

const parseTopologySummaryToken = (token: string): TemplateExtractPdfTopologySummary | null => {
  const matched = token.match(/^p(\d+)-rb(\d+)-ce(\d+)-hs(\d+)-vs(\d+)-tb(\d+)-cc(\d+)$/);

  if (!matched) {
    return null;
  }

  return {
    pageCount: Number(matched[1]),
    rowBandCount: Number(matched[2]),
    columnEdgeCount: Number(matched[3]),
    horizontalSegmentCount: Number(matched[4]),
    verticalSegmentCount: Number(matched[5]),
    textBlockCount: Number(matched[6]),
    cellCandidateCount: Number(matched[7]),
  };
};

const toNumber = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value: string | undefined) => value === 'true';

const upsertDimensionStyle = (styleValue: string | undefined, width: number, height: number) => {
  const styleEntries = (styleValue || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !/^width\s*:/i.test(entry) && !/^height\s*:/i.test(entry));

  styleEntries.push(`width:${width.toFixed(2)}px`);
  styleEntries.push(`height:${height.toFixed(2)}px`);

  return styleEntries.join(';');
};

const buildTagFromAttributes = (tagName: string, attrs: Record<string, string>) =>
  `<${tagName} ${Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
    .join(' ')}>`;

export const TemplateExtractReplicaHtmlNormalizerService = {
  normalizeReplicaHtml(html: string): NormalizedReplicaHtml {
    const rootTag = html.match(ROOT_SECTION_REGEX)?.[0] || null;
    const rootAttributes = rootTag ? parseAttributesFromTag(rootTag) : {};
    const pageMap = new Map<number, NormalizedReplicaPage>();

    for (const match of html.matchAll(PAGE_TAG_REGEX)) {
      const attrs = parseAttributesFromTag(match[0]);
      const pageNumber = Number(match[3]);

      if (!Number.isFinite(pageNumber) || pageNumber <= 0 || pageMap.has(pageNumber)) {
        continue;
      }

      pageMap.set(pageNumber, {
        pageNumber,
        width: parsePixelValue(attrs.style, 'width'),
        height: parsePixelValue(attrs.style, 'height'),
      });
    }

    const pages =
      pageMap.size > 0
        ? Array.from(pageMap.values()).sort((left, right) => left.pageNumber - right.pageNumber)
        : rootTag
          ? [{ pageNumber: 1, width: null, height: null }]
          : [];
    const pageCount = pages.length;
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

  upsertRootDataAttributes(html: string, attrsPatch: Record<string, string | null | undefined>) {
    const rootTag = html.match(ROOT_SECTION_REGEX)?.[0];

    if (!rootTag) {
      return html;
    }

    const currentAttrs = parseAttributesFromTag(rootTag);

    for (const [key, value] of Object.entries(attrsPatch)) {
      if (value === null || value === undefined || value === '') {
        delete currentAttrs[key];
        continue;
      }

      currentAttrs[key] = value;
    }

    currentAttrs['data-template-extract-draft'] = currentAttrs['data-template-extract-draft'] || 'true';

    const rebuiltTag = `<section ${Object.entries(currentAttrs)
      .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
      .join(' ')}>`;

    return html.replace(rootTag, rebuiltTag);
  },

  upsertPageMetrics(
    html: string,
    pages: Array<Pick<TemplateExtractPdfPage, 'pageNumber' | 'width' | 'height'>>
  ) {
    let nextHtml = html;

    for (const page of pages) {
      const pageTagRegex = new RegExp(
        `<([a-z0-9:-]+)\\b([^>]*\\bdata-page(?:-number)?="${page.pageNumber}"[^>]*)>`,
        'i'
      );
      const matched = nextHtml.match(pageTagRegex);

      if (!matched) {
        continue;
      }

      const currentAttrs = parseAttributesFromTag(matched[0]);
      currentAttrs.style = upsertDimensionStyle(currentAttrs.style, page.width, page.height);
      const rebuiltTag = buildTagFromAttributes(matched[1], currentAttrs);
      nextHtml = nextHtml.replace(matched[0], rebuiltTag);
    }

    return nextHtml;
  },

  embedPipelineTrace(html: string, pipelineTrace: TemplateExtractPdfPipelineTrace) {
    return this.upsertRootDataAttributes(html, {
      'data-template-engine-version': pipelineTrace.engineVersion,
      'data-template-source-mode': pipelineTrace.sourceMode,
      'data-template-document-family': pipelineTrace.documentFamily,
      'data-template-family-confidence': pipelineTrace.familyConfidenceScore.toFixed(2),
      'data-template-family-reasons': pipelineTrace.familyDetectionReasons.join('|'),
      'data-template-topology-summary': [
        `p${pipelineTrace.topologySummary.pageCount}`,
        `rb${pipelineTrace.topologySummary.rowBandCount}`,
        `ce${pipelineTrace.topologySummary.columnEdgeCount}`,
        `hs${pipelineTrace.topologySummary.horizontalSegmentCount}`,
        `vs${pipelineTrace.topologySummary.verticalSegmentCount}`,
        `tb${pipelineTrace.topologySummary.textBlockCount}`,
        `cc${pipelineTrace.topologySummary.cellCandidateCount}`,
      ].join('-'),
      'data-template-clone-builder': pipelineTrace.cloneBuilder,
    });
  },

  embedQualityReport(html: string, qualityReport: TemplateExtractReplicaQualityReport) {
    return this.upsertRootDataAttributes(html, {
      'data-template-quality-mode': qualityReport.mode,
      'data-template-quality-pass': qualityReport.passed ? 'true' : 'false',
      'data-template-quality-overall': qualityReport.summary.overallScore.toFixed(4),
      'data-template-quality-page-count': String(qualityReport.summary.pageCount),
      'data-template-quality-hard-failures': String(qualityReport.summary.hardFailureCount),
      'data-template-quality-max-mismatch': qualityReport.summary.maxMismatchPixelRatio.toFixed(4),
      'data-template-quality-contract': qualityReport.offlineMetrics?.pageContractScore.toFixed(4) || null,
      'data-template-quality-text-anchor': qualityReport.offlineMetrics?.textAnchorScore.toFixed(4) || null,
      'data-template-quality-vector': qualityReport.offlineMetrics?.vectorTopologyScore.toFixed(4) || null,
      'data-template-quality-image': qualityReport.offlineMetrics?.imageFragmentScore.toFixed(4) || null,
      'data-template-quality-text-content': qualityReport.offlineMetrics?.textContentScore.toFixed(4) || null,
      'data-template-quality-placeholder': qualityReport.offlineMetrics?.placeholderIntegrityScore.toFixed(4) || null,
      'data-template-fallback-applied': qualityReport.fallbackApplied ? 'true' : 'false',
      'data-template-fallback-engine-version': qualityReport.fallbackEngineVersion,
      'data-template-fallback-reason': qualityReport.fallbackReason,
    });
  },

  parsePipelineTraceFromHtml(html: string): TemplateExtractPdfPipelineTrace | null {
    const normalized = this.normalizeReplicaHtml(html);
    const attrs = normalized.rootAttributes;
    const topologySummary = parseTopologySummaryToken(attrs['data-template-topology-summary'] || '');

    if (
      !attrs['data-template-engine-version'] ||
      !attrs['data-template-source-mode'] ||
      !attrs['data-template-document-family'] ||
      !attrs['data-template-clone-builder'] ||
      !topologySummary
    ) {
      return null;
    }

    return {
      engineVersion: attrs['data-template-engine-version'] as TemplateExtractEngineVersion,
      sourceMode: attrs['data-template-source-mode'] as TemplateExtractPdfPipelineTrace['sourceMode'],
      documentFamily: attrs['data-template-document-family'] as TemplateExtractPdfPipelineTrace['documentFamily'],
      familyConfidenceScore: toNumber(attrs['data-template-family-confidence']) || 0,
      familyDetectionReasons: (attrs['data-template-family-reasons'] || '')
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean),
      topologySummary,
      cloneBuilder: attrs['data-template-clone-builder'],
    };
  },

  parseQualityReportFromHtml(html: string): TemplateExtractReplicaQualityReport | null {
    const normalized = this.normalizeReplicaHtml(html);
    const attrs = normalized.rootAttributes;

    if (!attrs['data-template-quality-mode']) {
      return null;
    }

    const overallScore = toNumber(attrs['data-template-quality-overall']) || 0;
    const offlineMetrics =
      attrs['data-template-quality-contract'] ||
      attrs['data-template-quality-text-anchor'] ||
      attrs['data-template-quality-vector']
        ? {
            pageContractScore: toNumber(attrs['data-template-quality-contract']) || 0,
            textAnchorScore: toNumber(attrs['data-template-quality-text-anchor']) || 0,
            vectorTopologyScore: toNumber(attrs['data-template-quality-vector']) || 0,
            imageFragmentScore: toNumber(attrs['data-template-quality-image']) || 0,
            textContentScore: toNumber(attrs['data-template-quality-text-content']) || 0,
            placeholderIntegrityScore: toNumber(attrs['data-template-quality-placeholder']) || 0,
            overallScore,
          }
        : null;

    return {
      passed: toBoolean(attrs['data-template-quality-pass']),
      mode: attrs['data-template-quality-mode'] as TemplateExtractReplicaQualityReport['mode'],
      fallbackApplied: toBoolean(attrs['data-template-fallback-applied']),
      fallbackEngineVersion: (attrs['data-template-fallback-engine-version'] as TemplateExtractEngineVersion) || null,
      fallbackReason: attrs['data-template-fallback-reason'] || null,
      pageReports: [],
      offlineMetrics,
      summary: {
        maxMismatchPixelRatio: toNumber(attrs['data-template-quality-max-mismatch']) || 0,
        pageCount: Number(attrs['data-template-quality-page-count'] || normalized.pageCount || 0),
        hardFailureCount: Number(attrs['data-template-quality-hard-failures'] || 0),
        overallScore,
      },
    };
  },
};
