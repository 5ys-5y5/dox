import type {
  TemplateExtractPdfGeometryCell,
  TemplateExtractPdfGeometryModel,
  TemplateExtractPdfGeometryRow,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfLine,
  TemplateExtractPdfPage,
} from '../lib/templateExtractDtos';

type PositionedLine = TemplateExtractPdfLine & {
  top: number;
  bottom: number;
  right: number;
  normalizedText: string;
};

type RowCluster = {
  top: number;
  bottom: number;
  center: number;
  averageHeight: number;
  lines: PositionedLine[];
};

const ROW_TOLERANCE_PX = 7;
const EDGE_CLUSTER_TOLERANCE_PX = 10;
const MIN_EDGE_GAP_PX = 14;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

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

    deduped.push(edge);
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

    return edges.length - 1;
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

const buildPositionedLines = (page: TemplateExtractPdfPage): PositionedLine[] =>
  page.lines
    .map((line) => {
      const top = page.height - line.y - line.height;
      const bottom = top + line.height;
      return {
        ...line,
        top,
        bottom,
        right: line.x + line.width,
        normalizedText: normalizeWhitespace(line.text),
      };
    })
    .filter((line) => line.normalizedText.length > 0)
    .sort((left, right) => {
      if (Math.abs(left.top - right.top) <= 1.5) {
        return left.x - right.x;
      }

      return left.top - right.top;
    });

const clusterRows = (lines: PositionedLine[]): RowCluster[] => {
  const rows: RowCluster[] = [];

  for (const line of lines) {
    const lineCenter = line.top + line.height / 2;
    const current = rows[rows.length - 1];

    if (
      current &&
      Math.abs(current.center - lineCenter) <= Math.max(ROW_TOLERANCE_PX, Math.min(current.averageHeight, line.height) * 0.45)
    ) {
      current.lines.push(line);
      current.top = Math.min(current.top, line.top);
      current.bottom = Math.max(current.bottom, line.bottom);
      current.center = current.lines.reduce((sum, item) => sum + (item.top + item.height / 2), 0) / current.lines.length;
      current.averageHeight = current.lines.reduce((sum, item) => sum + item.height, 0) / current.lines.length;
      continue;
    }

    rows.push({
      top: line.top,
      bottom: line.bottom,
      center: lineCenter,
      averageHeight: line.height,
      lines: [line],
    });
  }

  return rows;
};

const buildColumnEdges = (page: TemplateExtractPdfPage, lines: PositionedLine[]) => {
  const rawEdges = [
    0,
    page.width,
    ...lines.flatMap((line) => [line.x, line.right]),
  ];

  return dedupeEdges(clusterNumbers(rawEdges, EDGE_CLUSTER_TOLERANCE_PX))
    .map((edge) => Number(edge.toFixed(2)))
    .sort((left, right) => left - right);
};

const buildCells = (columnEdges: number[], lines: PositionedLine[]): TemplateExtractPdfGeometryCell[] =>
  lines
    .map((line) => {
      const startColumn = assignEdgeIndex(columnEdges, line.x);
      const endColumn = assignEdgeIndex(columnEdges, line.right, true);

      return {
        text: line.normalizedText,
        x: line.x,
        right: line.right,
        width: line.width,
        height: line.height,
        startColumn,
        endColumn: Math.max(endColumn, startColumn + 1),
      };
    })
    .sort((left, right) => left.startColumn - right.startColumn || left.x - right.x);

const buildRows = (page: TemplateExtractPdfPage, columnEdges: number[], rowClusters: RowCluster[]): TemplateExtractPdfGeometryRow[] =>
  rowClusters.map((cluster, rowIndex) => ({
    rowIndex,
    top: Number(cluster.top.toFixed(2)),
    height: Number(Math.max(cluster.bottom - cluster.top, 18).toFixed(2)),
    cells: buildCells(columnEdges, cluster.lines),
  }));

const buildPageGeometry = (page: TemplateExtractPdfPage) => {
  const positionedLines = buildPositionedLines(page);
  const rowClusters = clusterRows(positionedLines);
  const columnEdges = buildColumnEdges(page, positionedLines);

  return {
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    columnEdges,
    rows: buildRows(page, columnEdges, rowClusters),
  };
};

export const TemplateExtractPdfGeometryService = {
  buildGeometry(layout: TemplateExtractPdfLayoutModel): TemplateExtractPdfGeometryModel {
    return {
      rawText: layout.rawText,
      pages: layout.pages.map(buildPageGeometry),
    };
  },
};
