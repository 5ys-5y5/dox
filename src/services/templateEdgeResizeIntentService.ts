import type {
  TemplateEdgeResizeIntentDto,
  TemplateEdgeRoleMapDto,
  TemplateEdgeSelectionClickDto,
  TemplateEdgeSelectionStateDto,
} from '../lib/templateEdgeSelectionDtos';
import { TemplateEdgeSelectionService } from './templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from './templateEdgeTopologyService';

const EDGE_ROLE_OVERLAP_NOISE_FLOOR_PX = 4;
const EDGE_ROLE_LINE_ALIGNMENT_TOLERANCE_PX = 4;

const resolvePeerSide = (side: 'left' | 'right' | 'top' | 'bottom') => {
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

const createEmptyRoleSummary = () => ({
  selectedEdgeClickedIds: [] as string[],
  selectedEdgeAutoMultiIds: [] as string[],
  peerEdgeIds: [] as string[],
  mutationEdgeIds: [] as string[],
  edgeRoleById: {} as TemplateEdgeRoleMapDto,
});

const readEdgeOverlapLength = (
  left: Pick<NonNullable<TemplateEdgeSelectionClickDto['snapshot']['edges'][number]>, 'spanStart' | 'spanEnd'>,
  right: Pick<NonNullable<TemplateEdgeSelectionClickDto['snapshot']['edges'][number]>, 'spanStart' | 'spanEnd'>
) => Math.min(left.spanEnd, right.spanEnd) - Math.max(left.spanStart, right.spanStart);

const readEdgePositionGroupId = (
  edge: Pick<NonNullable<TemplateEdgeSelectionClickDto['snapshot']['edges'][number]>, 'positionGroupId'> | null | undefined
) => (edge?.positionGroupId || '').trim();

const collectPeerConstrainedSameSideEdgeIds = (
  snapshot: TemplateEdgeSelectionClickDto['snapshot'],
  referenceEdgeId: string | undefined,
  peerEdgeIds: string[],
  excludedEdgeIds: string[]
) => {
  const referenceEdge = referenceEdgeId ? TemplateEdgeTopologyService.getEdgeById(snapshot, referenceEdgeId) : null;
  const referencePositionGroupId = readEdgePositionGroupId(referenceEdge);

  if (!referenceEdge || !referencePositionGroupId || peerEdgeIds.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      peerEdgeIds.flatMap((peerEdgeId) => {
        const peerEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, peerEdgeId);
        const peerPositionGroupId = readEdgePositionGroupId(peerEdge);

        if (!peerEdge || peerPositionGroupId !== referencePositionGroupId) {
          return [];
        }

        return snapshot.edges
          .filter((candidate) => {
            if (excludedEdgeIds.includes(candidate.edgeId)) {
              return false;
            }

            if (
              candidate.pageId !== referenceEdge.pageId ||
              readEdgePositionGroupId(candidate) !== referencePositionGroupId ||
              candidate.orientation !== referenceEdge.orientation ||
              candidate.side !== referenceEdge.side
            ) {
              return false;
            }

            if (
              Math.abs(candidate.lineCoordinate - referenceEdge.lineCoordinate) >
              EDGE_ROLE_LINE_ALIGNMENT_TOLERANCE_PX
            ) {
              return false;
            }

            return readEdgeOverlapLength(peerEdge, candidate) > EDGE_ROLE_OVERLAP_NOISE_FLOOR_PX;
          })
          .map((candidate) => candidate.edgeId);
      })
    )
  );
};

const collectPeerEdgeIds = (
  snapshot: TemplateEdgeSelectionClickDto['snapshot'],
  sourceEdgeIds: string[],
  excludedEdgeIds: string[]
) =>
  Array.from(
    new Set(
      sourceEdgeIds.flatMap((edgeId) => {
        const sourceEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);
        const sourcePositionGroupId = readEdgePositionGroupId(sourceEdge);

        if (!sourceEdge || !sourcePositionGroupId) {
          return [];
        }

        const peerSide = resolvePeerSide(sourceEdge.side);

        return snapshot.edges
          .filter((candidate) => {
            if (candidate.edgeId === sourceEdge.edgeId || excludedEdgeIds.includes(candidate.edgeId)) {
              return false;
            }

            if (
              candidate.pageId !== sourceEdge.pageId ||
              readEdgePositionGroupId(candidate) !== sourcePositionGroupId ||
              candidate.orientation !== sourceEdge.orientation ||
              candidate.side !== peerSide
            ) {
              return false;
            }

            if (
              Math.abs(candidate.lineCoordinate - sourceEdge.lineCoordinate) >
              EDGE_ROLE_LINE_ALIGNMENT_TOLERANCE_PX
            ) {
              return false;
            }

            return readEdgeOverlapLength(sourceEdge, candidate) > EDGE_ROLE_OVERLAP_NOISE_FLOOR_PX;
          })
          .map((candidate) => candidate.edgeId);
      })
    )
  );

const collectPeerCandidateEdgeIds = (
  snapshot: TemplateEdgeSelectionClickDto['snapshot'],
  sourceEdgeIds: string[],
  excludedEdgeIds: string[] = sourceEdgeIds
) => {
  const normalizedSourceEdgeIds = Array.from(
    new Set(sourceEdgeIds.map((edgeId) => edgeId.trim()).filter((edgeId) => Boolean(edgeId)))
  );
  const normalizedExcludedEdgeIds = Array.from(
    new Set(excludedEdgeIds.map((edgeId) => edgeId.trim()).filter((edgeId) => Boolean(edgeId)))
  );

  if (normalizedSourceEdgeIds.length <= 0) {
    return [];
  }

  return collectPeerEdgeIds(snapshot, normalizedSourceEdgeIds, normalizedExcludedEdgeIds);
};

const describeSelectionRoles = (
  snapshot: TemplateEdgeSelectionClickDto['snapshot'],
  selectionState: TemplateEdgeSelectionStateDto,
  referenceEdgeId?: string
) => {
  const roleSummary = createEmptyRoleSummary();
  const referenceEdge = referenceEdgeId ? TemplateEdgeTopologyService.getEdgeById(snapshot, referenceEdgeId) : null;

  selectionState.tokens.forEach((token) => {
    token.memberEdgeIds.forEach((edgeId) => {
      const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

      if (!edge) {
        return;
      }

      if (referenceEdge && (edge.orientation !== referenceEdge.orientation || edge.side !== referenceEdge.side)) {
        return;
      }

      if (edgeId === token.anchorEdgeId) {
        roleSummary.selectedEdgeClickedIds.push(edgeId);
        return;
      }

      roleSummary.selectedEdgeAutoMultiIds.push(edgeId);
    });
  });

  roleSummary.selectedEdgeClickedIds = Array.from(new Set(roleSummary.selectedEdgeClickedIds));
  roleSummary.selectedEdgeAutoMultiIds = Array.from(new Set(roleSummary.selectedEdgeAutoMultiIds));
  let changed = true;

  while (changed) {
    const previousSignature = JSON.stringify({
      selectedEdgeAutoMultiIds: roleSummary.selectedEdgeAutoMultiIds.slice().sort(),
      peerEdgeIds: roleSummary.peerEdgeIds.slice().sort(),
    });
    const selectedRoleEdgeIds = Array.from(
      new Set([...roleSummary.selectedEdgeClickedIds, ...roleSummary.selectedEdgeAutoMultiIds])
    );
    roleSummary.peerEdgeIds = Array.from(
      new Set([
        ...roleSummary.peerEdgeIds,
        ...collectPeerEdgeIds(snapshot, selectedRoleEdgeIds, selectedRoleEdgeIds),
      ])
    );
    roleSummary.selectedEdgeAutoMultiIds = Array.from(
      new Set([
        ...roleSummary.selectedEdgeAutoMultiIds,
        ...collectPeerConstrainedSameSideEdgeIds(
          snapshot,
          referenceEdgeId || roleSummary.selectedEdgeClickedIds[0],
          roleSummary.peerEdgeIds,
          [...roleSummary.selectedEdgeClickedIds, ...roleSummary.selectedEdgeAutoMultiIds]
        ),
      ])
    );
    const nextSignature = JSON.stringify({
      selectedEdgeAutoMultiIds: roleSummary.selectedEdgeAutoMultiIds.slice().sort(),
      peerEdgeIds: roleSummary.peerEdgeIds.slice().sort(),
    });
    changed = previousSignature !== nextSignature;
  }

  const resolvedSelectedRoleEdgeIds = Array.from(
    new Set([...roleSummary.selectedEdgeClickedIds, ...roleSummary.selectedEdgeAutoMultiIds])
  );
  roleSummary.mutationEdgeIds = Array.from(
    new Set([...resolvedSelectedRoleEdgeIds, ...roleSummary.peerEdgeIds])
  );
  roleSummary.selectedEdgeClickedIds.forEach((edgeId) => {
    roleSummary.edgeRoleById[edgeId] = 'selected_edge_clicked';
  });
  roleSummary.selectedEdgeAutoMultiIds.forEach((edgeId) => {
    if (!roleSummary.edgeRoleById[edgeId]) {
      roleSummary.edgeRoleById[edgeId] = 'selected_edge_auto_multi';
    }
  });
  roleSummary.peerEdgeIds.forEach((edgeId) => {
    if (!roleSummary.edgeRoleById[edgeId]) {
      roleSummary.edgeRoleById[edgeId] = 'peer_edge';
    }
  });

  return roleSummary;
};

const resolveResizeIntent = (input: TemplateEdgeSelectionClickDto): TemplateEdgeResizeIntentDto => {
  const clickActivation = TemplateEdgeSelectionService.resolveActivation(input);
  const dragActivation = TemplateEdgeSelectionService.resolveDragActivation(input);
  const clickedEdge = TemplateEdgeTopologyService.getEdgeById(input.snapshot, input.clickedEdgeId);

  if (!clickedEdge) {
    return {
      clickSelectionState: clickActivation.selectionState,
      dragSelectionState: dragActivation.selectionState,
      ...createEmptyRoleSummary(),
      dragMode: dragActivation.mode,
      side: null,
    };
  }

  const roleSummary = describeSelectionRoles(input.snapshot, dragActivation.selectionState, input.clickedEdgeId);

  return {
    clickSelectionState: clickActivation.selectionState,
    dragSelectionState: dragActivation.selectionState,
    ...roleSummary,
    dragMode: dragActivation.mode,
    side: clickedEdge.side,
  };
};

export const TemplateEdgeResizeIntentService = {
  collectPeerCandidateEdgeIds,
  describeSelectionRoles,
  resolveResizeIntent,
};
