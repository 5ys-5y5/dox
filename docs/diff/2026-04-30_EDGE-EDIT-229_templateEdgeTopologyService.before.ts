import type {
  TemplateEdgeDirectAdjacencyDto,
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

const sortEdgesBySpan = (left: TemplateEdgeDescriptorDto, right: TemplateEdgeDescriptorDto) => {
  if (left.spanStart !== right.spanStart) {
    return left.spanStart - right.spanStart;
  }

  if (left.spanEnd !== right.spanEnd) {
    return left.spanEnd - right.spanEnd;
  }

  return left.edgeId.localeCompare(right.edgeId);
};

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

const buildAdjacencyMap = (adjacencies: TemplateEdgeDirectAdjacencyDto[]) => {
  const adjacencyMap = new Map<string, Set<string>>();

  adjacencies.forEach((adjacency) => {
    const current = adjacencyMap.get(adjacency.fromEdgeId);

    if (current) {
      current.add(adjacency.toEdgeId);
      return;
    }

    adjacencyMap.set(adjacency.fromEdgeId, new Set([adjacency.toEdgeId]));
  });

  return adjacencyMap;
};

const buildDirectAdjacencies = (edges: TemplateEdgeDescriptorDto[], tolerancePx: number) => {
  const adjacencies: TemplateEdgeDirectAdjacencyDto[] = [];
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

  groupedByAxis.forEach((axisEdges) => {
    const lineClusters = clusterByCoordinate(axisEdges, (edge) => edge.lineCoordinate, tolerancePx);

    lineClusters.forEach((lineCluster) => {
      const oppositeClusters = clusterByCoordinate(lineCluster, (edge) => edge.oppositeCoordinate, tolerancePx);

      oppositeClusters.forEach((oppositeCluster) => {
        const sortedEdges = oppositeCluster.slice().sort(sortEdgesBySpan);

        for (let index = 0; index < sortedEdges.length - 1; index += 1) {
          const currentEdge = sortedEdges[index];
          const nextEdge = sortedEdges[index + 1];

          if (Math.abs(currentEdge.spanEnd - nextEdge.spanStart) > tolerancePx) {
            continue;
          }

          const sharedCoordinate = roundEdgeCoordinate((currentEdge.spanEnd + nextEdge.spanStart) / 2);

          adjacencies.push({
            fromEdgeId: currentEdge.edgeId,
            toEdgeId: nextEdge.edgeId,
            orientation: currentEdge.orientation,
            side: currentEdge.side,
            sharedCoordinate,
            relation: 'touching-endpoint',
          });
          adjacencies.push({
            fromEdgeId: nextEdge.edgeId,
            toEdgeId: currentEdge.edgeId,
            orientation: currentEdge.orientation,
            side: currentEdge.side,
            sharedCoordinate,
            relation: 'touching-endpoint',
          });
        }
      });
    });
  });

  return adjacencies;
};

const collectConnectedComponent = (
  startEdgeId: string,
  allowedEdgeIds: Set<string>,
  adjacencyMap: Map<string, Set<string>>
) => {
  const visited = new Set<string>();
  const queue = [startEdgeId];

  while (queue.length > 0) {
    const currentEdgeId = queue.shift();

    if (!currentEdgeId || visited.has(currentEdgeId)) {
      continue;
    }

    visited.add(currentEdgeId);
    const adjacentEdgeIds = adjacencyMap.get(currentEdgeId);

    adjacentEdgeIds?.forEach((adjacentEdgeId) => {
      if (allowedEdgeIds.has(adjacentEdgeId) && !visited.has(adjacentEdgeId)) {
        queue.push(adjacentEdgeId);
      }
    });
  }

  return visited;
};

const buildCohorts = (
  edges: TemplateEdgeDescriptorDto[],
  adjacencies: TemplateEdgeDirectAdjacencyDto[],
  tolerancePx: number
) => {
  const cohorts: TemplateEdgeCohortDto[] = [];
  const adjacencyMap = buildAdjacencyMap(adjacencies);
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
        const sortedEdges = oppositeCluster.slice().sort(sortEdgesBySpan);
        const remainingEdgeIds = new Set(sortedEdges.map((edge) => edge.edgeId));
        let chainIndex = 0;

        sortedEdges.forEach((edge) => {
          if (!remainingEdgeIds.has(edge.edgeId)) {
            return;
          }

          const componentEdgeIds = Array.from(
            collectConnectedComponent(edge.edgeId, remainingEdgeIds, adjacencyMap)
          );
          const componentEdges = componentEdgeIds
            .map((edgeId) => sortedEdges.find((candidate) => candidate.edgeId === edgeId) || null)
            .filter((candidate): candidate is TemplateEdgeDescriptorDto => Boolean(candidate))
            .sort(sortEdgesBySpan);
          const cohortId = `${axisKey}:${lineClusterIndex}:${oppositeClusterIndex}:${chainIndex}`;

          componentEdges.forEach((componentEdge) => {
            componentEdge.cohortId = cohortId;
            remainingEdgeIds.delete(componentEdge.edgeId);
          });

          cohorts.push({
            cohortId,
            pageId: edge.pageId,
            orientation: edge.orientation,
            side: edge.side,
            lineCoordinate: edge.lineCoordinate,
            oppositeCoordinate: edge.oppositeCoordinate,
            chainIndex,
            edgeIds: componentEdges.map((componentEdge) => componentEdge.edgeId),
          });

          chainIndex += 1;
        });
      });
    });
  });

  return cohorts;
};

const resolveOppositeBoundarySide = (side: TemplateEdgeSide): TemplateEdgeSide => {
  if (side === 'left') {
    return 'right';
  }

  if (side === 'right') {
    return 'left';
  }

  if (side === 'top') {
    return 'bottom';
  }

  return 'top';
};

const spansSharePhysicalBoundary = (
  sourceEdge: TemplateEdgeDescriptorDto,
  candidateEdge: TemplateEdgeDescriptorDto,
  tolerancePx: number
) => {
  const overlapStart = Math.max(sourceEdge.spanStart, candidateEdge.spanStart);
  const overlapEnd = Math.min(sourceEdge.spanEnd, candidateEdge.spanEnd);

  return overlapEnd - overlapStart > tolerancePx;
};

const createSnapshot = (input: TemplateEdgeTopologySourceDto): TemplateEdgeTopologySnapshotDto => {
  const edges = buildEdgeDescriptors(input.frames);
  const adjacencies = buildDirectAdjacencies(edges, input.tolerancePx);
  const cohorts = buildCohorts(edges, adjacencies, input.tolerancePx);

  return {
    edges,
    cohorts,
    adjacencies,
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

const getPhysicalPeerEdgeIds = (
  snapshot: TemplateEdgeTopologySnapshotDto,
  edgeId: string,
  tolerancePx = 0.5
) => {
  const edge = getEdgeById(snapshot, edgeId);

  if (!edge) {
    return [];
  }

  const oppositeSide = resolveOppositeBoundarySide(edge.side);

  return snapshot.edges
    .filter((candidate) => {
      if (candidate.edgeId === edge.edgeId) {
        return false;
      }

      if (candidate.pageId !== edge.pageId || candidate.orientation !== edge.orientation || candidate.side !== oppositeSide) {
        return false;
      }

      if (Math.abs(candidate.lineCoordinate - edge.lineCoordinate) > tolerancePx) {
        return false;
      }

      return spansSharePhysicalBoundary(edge, candidate, tolerancePx);
    })
    .map((candidate) => candidate.edgeId);
};

export const TemplateEdgeTopologyService = {
  createSnapshot,
  getEdgeById,
  getCohortByEdgeId,
  getPhysicalPeerEdgeIds,
};
