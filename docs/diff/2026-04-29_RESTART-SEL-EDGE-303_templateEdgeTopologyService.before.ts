import type {
  TemplateEdgeCohortDto,
  TemplateEdgeDescriptorDto,
  TemplateEdgeFrameDto,
  TemplateEdgeOrientation,
  TemplateEdgeSide,
  TemplateEdgeTopologySnapshotDto,
  TemplateEdgeTopologySourceDto,
} from '../lib/templateEdgeSelectionDtos';

const roundEdgeCoordinate = (value: number) => Number(value.toFixed(3));

const createEdgeDescriptor = (
  frame: TemplateEdgeFrameDto,
  side: TemplateEdgeSide,
  orientation: TemplateEdgeOrientation,
  lineCoordinate: number,
  oppositeCoordinate: number,
  spanStart: number,
  spanEnd: number
): TemplateEdgeDescriptorDto => ({
  edgeId: `${frame.frameGroupId}:${side}`,
  frameGroupId: frame.frameGroupId,
  pageId: frame.pageId,
  orientation,
  side,
  lineCoordinate: roundEdgeCoordinate(lineCoordinate),
  oppositeCoordinate: roundEdgeCoordinate(oppositeCoordinate),
  spanStart: roundEdgeCoordinate(spanStart),
  spanEnd: roundEdgeCoordinate(spanEnd),
  rect: frame.rect,
  cohortId: null,
});

const buildEdgeDescriptors = (frames: TemplateEdgeFrameDto[]) =>
  frames.flatMap((frame) => {
    const left = frame.rect.left;
    const right = frame.rect.left + frame.rect.width;
    const top = frame.rect.top;
    const bottom = frame.rect.top + frame.rect.height;

    return [
      createEdgeDescriptor(frame, 'left', 'vertical', left, right, top, bottom),
      createEdgeDescriptor(frame, 'right', 'vertical', right, left, top, bottom),
      createEdgeDescriptor(frame, 'top', 'horizontal', top, bottom, left, right),
      createEdgeDescriptor(frame, 'bottom', 'horizontal', bottom, top, left, right),
    ];
  });

const clusterByCoordinate = (
  edges: TemplateEdgeDescriptorDto[],
  readCoordinate: (edge: TemplateEdgeDescriptorDto) => number,
  tolerancePx: number
) => {
  const clusters: TemplateEdgeDescriptorDto[][] = [];

  edges
    .slice()
    .sort((left, right) => readCoordinate(left) - readCoordinate(right))
    .forEach((edge) => {
      const cluster = clusters[clusters.length - 1];

      if (!cluster) {
        clusters.push([edge]);
        return;
      }

      const reference = readCoordinate(cluster[cluster.length - 1]);

      if (Math.abs(readCoordinate(edge) - reference) <= tolerancePx) {
        cluster.push(edge);
        return;
      }

      clusters.push([edge]);
    });

  return clusters;
};

const buildCohorts = (edges: TemplateEdgeDescriptorDto[], tolerancePx: number) => {
  const cohorts: TemplateEdgeCohortDto[] = [];
  const groupedByAxis = new Map<string, TemplateEdgeDescriptorDto[]>();

  edges.forEach((edge) => {
    const key = `${edge.pageId}:${edge.orientation}:${edge.side}`;
    const current = groupedByAxis.get(key);

    if (current) {
      current.push(edge);
      return;
    }

    groupedByAxis.set(key, [edge]);
  });

  groupedByAxis.forEach((axisEdges, axisKey) => {
    const lineClusters = clusterByCoordinate(axisEdges, (edge) => edge.lineCoordinate, tolerancePx);

    lineClusters.forEach((lineCluster, lineClusterIndex) => {
      const oppositeClusters = clusterByCoordinate(lineCluster, (edge) => edge.oppositeCoordinate, tolerancePx);

      oppositeClusters.forEach((oppositeCluster, oppositeClusterIndex) => {
        const sortedEdges = oppositeCluster.slice().sort((left, right) => left.spanStart - right.spanStart);
        let chainIndex = -1;
        let chainEnd = Number.NEGATIVE_INFINITY;

        sortedEdges.forEach((edge) => {
          if (chainIndex < 0 || edge.spanStart > chainEnd + tolerancePx) {
            chainIndex += 1;
            chainEnd = edge.spanEnd;
          } else {
            chainEnd = Math.max(chainEnd, edge.spanEnd);
          }

          const cohortId = `${axisKey}:${lineClusterIndex}:${oppositeClusterIndex}:${chainIndex}`;
          edge.cohortId = cohortId;
          const existing = cohorts.find((cohort) => cohort.cohortId === cohortId);

          if (existing) {
            existing.edgeIds.push(edge.edgeId);
            return;
          }

          cohorts.push({
            cohortId,
            pageId: edge.pageId,
            orientation: edge.orientation,
            side: edge.side,
            lineCoordinate: edge.lineCoordinate,
            oppositeCoordinate: edge.oppositeCoordinate,
            chainIndex,
            edgeIds: [edge.edgeId],
          });
        });
      });
    });
  });

  return cohorts;
};

const createSnapshot = (input: TemplateEdgeTopologySourceDto): TemplateEdgeTopologySnapshotDto => {
  const edges = buildEdgeDescriptors(input.frames);
  const cohorts = buildCohorts(edges, input.tolerancePx);

  return {
    edges,
    cohorts,
  };
};

const getEdgeById = (snapshot: TemplateEdgeTopologySnapshotDto, edgeId: string) =>
  snapshot.edges.find((edge) => edge.edgeId === edgeId) || null;

const getCohortByEdgeId = (snapshot: TemplateEdgeTopologySnapshotDto, edgeId: string) => {
  const edge = getEdgeById(snapshot, edgeId);

  if (!edge?.cohortId) {
    return null;
  }

  return snapshot.cohorts.find((cohort) => cohort.cohortId === edge.cohortId) || null;
};

export const TemplateEdgeTopologyService = {
  createSnapshot,
  getEdgeById,
  getCohortByEdgeId,
};
