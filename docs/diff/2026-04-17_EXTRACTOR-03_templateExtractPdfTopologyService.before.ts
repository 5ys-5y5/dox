import type {
  TemplateExtractPdfGeometryModel,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfLine,
  TemplateExtractPdfRuleModel,
  TemplateExtractPdfRulePage,
  TemplateExtractPdfSourceMode,
  TemplateExtractPdfTextSource,
  TemplateExtractPdfTopologyCellCandidate,
  TemplateExtractPdfTopologyModel,
  TemplateExtractPdfTopologyPage,
  TemplateExtractPdfTopologyRowBand,
  TemplateExtractPdfTopologySummary,
  TemplateExtractPdfTopologyTextBlock,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfGeometryService } from './templateExtractPdfGeometryService';

const EDGE_CLUSTER_TOLERANCE_PX = 8;
const MIN_EDGE_GAP_PX = 12;
const MIN_ROW_BAND_HEIGHT_PX = 8;

const clusterNumbers = (values: number[], tolerance: number) => {
  const sorted = [...values].sort((left, right) => left - right);
  const clusters: number[][] = [];

  for (const value of sorted) {
    const current = clusters[clusters.length - 1];

    if (!current) {
      clusters.push([value]);
      continue;
    }

    const average = current.reduce((sum, item) => sum + item, 0) / current.length;

    if (Math.abs(average - value) <= tolerance) {
      current.push(value);
      continue;
    }

    clusters.push([value]);
  }

  return clusters.map((cluster) => cluster.reduce((sum, value) => sum + value, 0) / cluster.length);
};

const dedupeEdges = (edges: number[]) => {
  const sorted = [...edges].sort((left, right) => left - right);
  const deduped: number[] = [];

  for (const edge of sorted) {
    const previous = deduped[deduped.length - 1];

    if (typeof previous === 'number' && Math.abs(previous - edge) < MIN_EDGE_GAP_PX) {
      continue;
    }

    deduped.push(Number(edge.toFixed(2)));
  }

  return deduped;
};

const assignEdgeIndex = (edges: number[], target: number, fallbackToEnd = false) => {
  if (fallbackToEnd) {
    for (let index = 0; index < edges.length; index += 1) {
      if (edges[index] >= target) {
        return index;
      }
    }

    return Math.max(edges.length - 1, 0);
  }

  let selectedIndex = 0;

  for (let index = 0; index < edges.length; index += 1) {
    if (edges[index] <= target) {
      selectedIndex = index;
      continue;
    }

    break;
  }

  return selectedIndex;
};

const toTopBasedTextBlock = (
  pageHeight: number,
  line: TemplateExtractPdfLine,
  fallbackSource: TemplateExtractPdfTextSource
): TemplateExtractPdfTopologyTextBlock => {
  const top = pageHeight - line.y - line.height;
  const bottom = top + line.height;

  return {
    text: line.text,
    x: Number(line.x.toFixed(2)),
    top: Number(top.toFixed(2)),
    right: Number((line.x + line.width).toFixed(2)),
    bottom: Number(bottom.toFixed(2)),
    width: Number(line.width.toFixed(2)),
    height: Number(line.height.toFixed(2)),
    textSource: line.source || fallbackSource,
  };
};

const buildTopologySummary = (sourceMode: TemplateExtractPdfSourceMode, pages: TemplateExtractPdfTopologyPage[]): TemplateExtractPdfTopologyModel => {
  const summary: TemplateExtractPdfTopologySummary = {
    pageCount: pages.length,
    rowBandCount: pages.reduce((sum, page) => sum + page.rowBands.length, 0),
    columnEdgeCount: pages.reduce((sum, page) => sum + page.columnEdges.length, 0),
    horizontalSegmentCount: pages.reduce((sum, page) => sum + page.horizontalSegments.length, 0),
    verticalSegmentCount: pages.reduce((sum, page) => sum + page.verticalSegments.length, 0),
    textBlockCount: pages.reduce((sum, page) => sum + page.textBlocks.length, 0),
    cellCandidateCount: pages.reduce((sum, page) => sum + page.cellCandidates.length, 0),
  };

  return {
    sourceMode,
    rawText: '',
    pages,
    summary,
  };
};

const buildScannedRowBandsFromRules = (rulePage: TemplateExtractPdfRulePage): TemplateExtractPdfTopologyRowBand[] => {
  const boundaries = dedupeEdges([0, ...rulePage.rowRules, rulePage.height]);
  const bands: TemplateExtractPdfTopologyRowBand[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const top = boundaries[index];
    const bottom = boundaries[index + 1];
    const height = bottom - top;

    if (height < MIN_ROW_BAND_HEIGHT_PX) {
      continue;
    }

    bands.push({
      rowIndex: bands.length,
      top: Number(top.toFixed(2)),
      bottom: Number(bottom.toFixed(2)),
      height: Number(height.toFixed(2)),
      source: 'rule_interval',
    });
  }

  return bands;
};

const buildScannedRowBandsFromTextBlocks = (
  pageHeight: number,
  textBlocks: TemplateExtractPdfTopologyTextBlock[]
): TemplateExtractPdfTopologyRowBand[] => {
  const clusteredCenters = clusterNumbers(
    textBlocks.map((block) => block.top + block.height / 2),
    10
  );

  return clusteredCenters.map((center, rowIndex) => {
    const rowBlocks = textBlocks.filter((block) => Math.abs(block.top + block.height / 2 - center) <= 10);
    const top = Math.min(...rowBlocks.map((block) => block.top));
    const bottom = Math.max(...rowBlocks.map((block) => block.bottom));

    return {
      rowIndex,
      top: Number(Math.max(top, 0).toFixed(2)),
      bottom: Number(Math.min(bottom, pageHeight).toFixed(2)),
      height: Number(Math.max(bottom - top, MIN_ROW_BAND_HEIGHT_PX).toFixed(2)),
      source: 'ocr_cluster',
    };
  });
};

const resolveRowIndexForTextBlock = (
  rowBands: TemplateExtractPdfTopologyRowBand[],
  textBlock: TemplateExtractPdfTopologyTextBlock
) => {
  const center = textBlock.top + textBlock.height / 2;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const rowBand of rowBands) {
    if (center >= rowBand.top && center <= rowBand.bottom) {
      return rowBand.rowIndex;
    }

    const distance = Math.min(Math.abs(center - rowBand.top), Math.abs(center - rowBand.bottom));

    if (distance < nearestDistance) {
      nearest = rowBand.rowIndex;
      nearestDistance = distance;
    }
  }

  return nearest;
};

const buildCellCandidatesFromTextBlocks = (
  columnEdges: number[],
  rowBands: TemplateExtractPdfTopologyRowBand[],
  textBlocks: TemplateExtractPdfTopologyTextBlock[]
): TemplateExtractPdfTopologyCellCandidate[] =>
  textBlocks.map((textBlock) => ({
    rowIndex: resolveRowIndexForTextBlock(rowBands, textBlock),
    startColumn: assignEdgeIndex(columnEdges, textBlock.x),
    endColumn: Math.max(assignEdgeIndex(columnEdges, textBlock.right, true), assignEdgeIndex(columnEdges, textBlock.x) + 1),
    text: textBlock.text,
    x: textBlock.x,
    right: textBlock.right,
    width: textBlock.width,
    height: textBlock.height,
    source: 'ocr_rule',
  }));

const buildDigitalTopologyPages = (
  layout: TemplateExtractPdfLayoutModel,
  geometry: TemplateExtractPdfGeometryModel
): TemplateExtractPdfTopologyPage[] =>
  geometry.pages.map((geometryPage) => {
    const layoutPage = layout.pages.find((page) => page.pageNumber === geometryPage.pageNumber);
    const fallbackSource = layoutPage?.contentSource || 'text_layer';

    return {
      pageNumber: geometryPage.pageNumber,
      width: geometryPage.width,
      height: geometryPage.height,
      columnEdges: geometryPage.columnEdges.map((edge) => Number(edge.toFixed(2))),
      rowBands: geometryPage.rows.map((row) => ({
        rowIndex: row.rowIndex,
        top: Number(row.top.toFixed(2)),
        bottom: Number((row.top + row.height).toFixed(2)),
        height: Number(row.height.toFixed(2)),
        source: 'geometry',
      })),
      horizontalSegments: [],
      verticalSegments: [],
      textBlocks: (layoutPage?.lines || []).map((line) => toTopBasedTextBlock(geometryPage.height, line, fallbackSource)),
      cellCandidates: geometryPage.rows.flatMap((row) =>
        row.cells.map((cell) => ({
          rowIndex: row.rowIndex,
          startColumn: cell.startColumn,
          endColumn: cell.endColumn,
          text: cell.text,
          x: Number(cell.x.toFixed(2)),
          right: Number(cell.right.toFixed(2)),
          width: Number(cell.width.toFixed(2)),
          height: Number(cell.height.toFixed(2)),
          source: 'geometry',
        }))
      ),
    };
  });

const buildScannedTopologyPages = (ruleModel: TemplateExtractPdfRuleModel): TemplateExtractPdfTopologyPage[] =>
  ruleModel.pages.map((page) => {
    const columnEdges = dedupeEdges([0, ...page.columnRules, page.width]);
    const textBlocks = page.ocrLines.map((line) => toTopBasedTextBlock(page.height, line, 'ocr'));
    const rowBands = buildScannedRowBandsFromRules(page);
    const effectiveRowBands = rowBands.length > 0 ? rowBands : buildScannedRowBandsFromTextBlocks(page.height, textBlocks);

    return {
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      columnEdges,
      rowBands: effectiveRowBands,
      horizontalSegments: page.horizontalSegments.map((segment) => ({ ...segment })),
      verticalSegments: page.verticalSegments.map((segment) => ({ ...segment })),
      textBlocks,
      cellCandidates: buildCellCandidatesFromTextBlocks(columnEdges, effectiveRowBands, textBlocks),
    };
  });

export const TemplateExtractPdfTopologyService = {
  buildFromDigitalLayout(layout: TemplateExtractPdfLayoutModel): TemplateExtractPdfTopologyModel {
    const geometry = TemplateExtractPdfGeometryService.buildGeometry(layout);
    const model = buildTopologySummary('digital', buildDigitalTopologyPages(layout, geometry));
    return {
      ...model,
      rawText: layout.rawText,
    };
  },

  buildFromScannedRuleModel(ruleModel: TemplateExtractPdfRuleModel): TemplateExtractPdfTopologyModel {
    const model = buildTopologySummary('scanned', buildScannedTopologyPages(ruleModel));
    return {
      ...model,
      rawText: ruleModel.rawText,
    };
  },
};
