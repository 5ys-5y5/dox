import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfPage,
  TemplateExtractPdfSourceMode,
  TemplateExtractPdfTopologySummary,
  TemplateExtractReplicaQualityMode,
  TemplateExtractReplicaQualityPageReport,
  TemplateExtractReplicaQualityReport,
} from '../lib/templateExtractDtos';
import { TemplateExtractReplicaHtmlNormalizerService } from './templateExtractReplicaHtmlNormalizerService';

type OfflineQualityInput = {
  sourceText: string;
  sourceMode: TemplateExtractPdfSourceMode;
  sourcePages: Array<Pick<TemplateExtractPdfPage, 'pageNumber' | 'width' | 'height'>>;
  topologySummary: TemplateExtractPdfTopologySummary;
  replicaHtml: string;
  fallbackApplied?: boolean;
  fallbackEngineVersion?: TemplateExtractEngineVersion | null;
  fallbackReason?: string | null;
  mode?: TemplateExtractReplicaQualityMode;
  forceFailure?: boolean;
};

const clampScore = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const QUALITY_EPSILON = 0.0005;

const normalizeTextForTokens = (value: string) =>
  value
    .toLowerCase()
    .replace(/\r/g, '')
    .replace(/[^\p{L}\p{N}\s:_\-./]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalizeTextForTokens(value).split(' ').filter(Boolean);

const buildTokenCounts = (tokens: string[]) => {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return counts;
};

const scoreTokenF1 = (sourceText: string, replicaText: string) => {
  const sourceTokens = tokenize(sourceText);
  const replicaTokens = tokenize(replicaText);

  if (sourceTokens.length === 0 && replicaTokens.length === 0) {
    return 1;
  }

  if (sourceTokens.length === 0 || replicaTokens.length === 0) {
    return 0;
  }

  const sourceCounts = buildTokenCounts(sourceTokens);
  const replicaCounts = buildTokenCounts(replicaTokens);
  let overlap = 0;

  for (const [token, sourceCount] of sourceCounts.entries()) {
    overlap += Math.min(sourceCount, replicaCounts.get(token) || 0);
  }

  const precision = overlap / replicaTokens.length;
  const recall = overlap / sourceTokens.length;

  if (precision + recall === 0) {
    return 0;
  }

  return clampScore((2 * precision * recall) / (precision + recall));
};

const scoreRelativeCount = (expected: number, actual: number) => {
  if (expected <= 0 && actual <= 0) {
    return 1;
  }

  if (expected <= 0 || actual <= 0) {
    return 0;
  }

  return clampScore(1 - Math.abs(expected - actual) / Math.max(expected, actual));
};

const averageScore = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const scoreDimensionRatio = (
  expectedWidth: number,
  expectedHeight: number,
  actualWidth: number | null,
  actualHeight: number | null
) => {
  if (!actualWidth || !actualHeight || expectedWidth <= 0 || expectedHeight <= 0) {
    return 0;
  }

  const widthDelta = Math.abs(expectedWidth - actualWidth) / expectedWidth;
  const heightDelta = Math.abs(expectedHeight - actualHeight) / expectedHeight;
  return clampScore(1 - (widthDelta + heightDelta) / 2);
};

const scorePageContract = (
  hasDraftRoot: boolean,
  sourcePageCount: number,
  replicaPageCount: number,
  dimensionScore: number,
  fullPageBackgroundImageCount: number
) => {
  const rootScore = hasDraftRoot ? 1 : 0;
  const pageCountScore = scoreRelativeCount(sourcePageCount, replicaPageCount);
  const backgroundPenaltyScore = fullPageBackgroundImageCount === 0 ? 1 : 0;

  return clampScore(
    rootScore * 0.35 +
      pageCountScore * 0.35 +
      dimensionScore * 0.2 +
      backgroundPenaltyScore * 0.1
  );
};

const scoreTextAnchor = (
  sourceText: string,
  replicaText: string,
  hasTextLayer: boolean,
  valueMarkerCount: number
) => {
  const textContentScore = scoreTokenF1(sourceText, replicaText);
  const textLayerScore = hasTextLayer ? 1 : 0;
  const placeholderScore = valueMarkerCount > 0 ? 1 : 0.45;

  return clampScore(textContentScore * 0.75 + textLayerScore * 0.15 + placeholderScore * 0.1);
};

const scoreVectorTopology = (
  topologySummary: TemplateExtractPdfTopologySummary,
  normalized: ReturnType<typeof TemplateExtractReplicaHtmlNormalizerService.normalizeReplicaHtml>
) => {
  const rowScore = scoreRelativeCount(topologySummary.rowBandCount, normalized.rowCount);
  const horizontalScore =
    topologySummary.horizontalSegmentCount > 0
      ? scoreRelativeCount(topologySummary.horizontalSegmentCount, normalized.frameHorizontalCount + normalized.rowCount)
      : normalized.rowCount > 0 || normalized.frameHorizontalCount > 0
        ? 1
        : 0;
  const verticalScore =
    topologySummary.verticalSegmentCount > 0
      ? scoreRelativeCount(topologySummary.verticalSegmentCount, normalized.frameVerticalCount + normalized.tableCount)
      : normalized.tableCount > 0 || normalized.semanticCellCount > 0 || normalized.frameVerticalCount > 0
        ? 1
        : 0;
  const cellScore = scoreRelativeCount(topologySummary.cellCandidateCount, normalized.semanticCellCount);
  const tablePresenceScore = normalized.layerPresence.vector ? 1 : 0;

  return clampScore(
    rowScore * 0.25 +
      horizontalScore * 0.2 +
      verticalScore * 0.2 +
      cellScore * 0.25 +
      tablePresenceScore * 0.1
  );
};

const scoreImageFragments = (
  sourceMode: TemplateExtractPdfSourceMode,
  fullPageBackgroundImageCount: number,
  normalized: ReturnType<typeof TemplateExtractReplicaHtmlNormalizerService.normalizeReplicaHtml>
) => {
  if (fullPageBackgroundImageCount > 0) {
    return 0;
  }

  if (sourceMode === 'scanned') {
    return normalized.layerPresence.text || normalized.layerPresence.vector ? 0.88 : 0.52;
  }

  return 0.95;
};

const scorePlaceholderIntegrity = (
  sourceMode: TemplateExtractPdfSourceMode,
  valueMarkerCount: number,
  pageCount: number
) => {
  if (valueMarkerCount > 0) {
    return 1;
  }

  if (sourceMode === 'digital') {
    return pageCount > 0 ? 0.62 : 0.3;
  }

  return pageCount > 0 ? 0.56 : 0.28;
};

const buildPageReports = (
  sourcePages: Array<Pick<TemplateExtractPdfPage, 'pageNumber' | 'width' | 'height'>>,
  normalized: ReturnType<typeof TemplateExtractReplicaHtmlNormalizerService.normalizeReplicaHtml>
): TemplateExtractReplicaQualityPageReport[] => {
  const normalizedPagesByNumber = new Map(normalized.pages.map((page) => [page.pageNumber, page]));

  return sourcePages.map((sourcePage) => {
    const replicaPage = normalizedPagesByNumber.get(sourcePage.pageNumber);
    const hardFailures: string[] = [];
    const notes: string[] = [];

    if (!replicaPage) {
      hardFailures.push('replica_page_missing');
    }

    if (replicaPage && (replicaPage.width === null || replicaPage.height === null)) {
      notes.push('replica_page_dimension_missing');
    }

    const dimensionScore = scoreDimensionRatio(
      sourcePage.width,
      sourcePage.height,
      replicaPage?.width || null,
      replicaPage?.height || null
    );
    const mismatchPixelRatio = clampScore(1 - dimensionScore);

    if (replicaPage && mismatchPixelRatio > 0.015) {
      notes.push('page_dimension_drift_detected');
    }

    return {
      pageNumber: sourcePage.pageNumber,
      mismatchPixelRatio,
      hardFailures,
      notes,
    };
  });
};

export const TemplateExtractReplicaOfflineQualityService = {
  evaluate(input: OfflineQualityInput): TemplateExtractReplicaQualityReport {
    const normalized = TemplateExtractReplicaHtmlNormalizerService.normalizeReplicaHtml(input.replicaHtml);
    const diagnosticPageReports = buildPageReports(input.sourcePages, normalized);
    const hardFailures = [
      !normalized.hasDraftRoot ? 'draft_root_missing' : null,
      normalized.fullPageBackgroundImageCount > 0 ? 'full_page_background_image_forbidden' : null,
      normalized.pageCount !== input.sourcePages.length ? 'page_count_mismatch' : null,
      normalized.rowCount === 0 && normalized.semanticCellCount === 0 && !normalized.textContent.trim()
        ? 'replica_content_missing'
        : null,
    ].filter(Boolean) as string[];
    const hardFailureCount =
      hardFailures.length +
      diagnosticPageReports.reduce((count, pageReport) => count + pageReport.hardFailures.length, 0);
    const dimensionScore = averageScore(
      diagnosticPageReports.map((pageReport) => clampScore(1 - pageReport.mismatchPixelRatio))
    );
    const pageContractScore = scorePageContract(
      normalized.hasDraftRoot,
      input.sourcePages.length,
      normalized.pageCount,
      dimensionScore,
      normalized.fullPageBackgroundImageCount
    );
    const textContentScore = scoreTokenF1(input.sourceText, normalized.textContent);
    const textAnchorScore = scoreTextAnchor(
      input.sourceText,
      normalized.textContent,
      normalized.layerPresence.text,
      normalized.valueMarkerCount
    );
    const vectorTopologyScore = scoreVectorTopology(input.topologySummary, normalized);
    const imageFragmentScore = scoreImageFragments(
      input.sourceMode,
      normalized.fullPageBackgroundImageCount,
      normalized
    );
    const placeholderIntegrityScore = scorePlaceholderIntegrity(
      input.sourceMode,
      normalized.valueMarkerCount,
      normalized.pageCount
    );

    const diagnosticOverallScore = clampScore(
      pageContractScore * 0.24 +
        textAnchorScore * 0.24 +
        vectorTopologyScore * 0.22 +
        imageFragmentScore * 0.1 +
        textContentScore * 0.12 +
        placeholderIntegrityScore * 0.08
    );
    const maxMismatchPixelRatio = 1;
    const pageReports = diagnosticPageReports.map((pageReport) => ({
      ...pageReport,
      mismatchPixelRatio: 1,
      notes: [...pageReport.notes, 'pixel_overlap_not_measured'],
    }));
    // This service is structural diagnostics only.
    // It must never be interpreted as pixel-overlap measurement.
    const passed = false;

    return {
      passed,
      mode: input.mode || 'offline',
      fallbackApplied: Boolean(input.fallbackApplied),
      fallbackEngineVersion: input.fallbackEngineVersion || null,
      fallbackReason: input.fallbackReason || null,
      pageReports,
      offlineMetrics: {
        pageContractScore,
        textAnchorScore,
        vectorTopologyScore,
        imageFragmentScore,
        textContentScore,
        placeholderIntegrityScore,
        overallScore: diagnosticOverallScore,
      },
      summary: {
        maxMismatchPixelRatio,
        pageCount: input.sourcePages.length,
        hardFailureCount,
        overallScore: 0,
      },
    };
  },
};
