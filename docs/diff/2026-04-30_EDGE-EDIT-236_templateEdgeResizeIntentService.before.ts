import type {
  TemplateEdgeResizeIntentDto,
  TemplateEdgeRoleMapDto,
  TemplateEdgeSelectionClickDto,
  TemplateEdgeSelectionStateDto,
} from '../lib/templateEdgeSelectionDtos';
import { TemplateEdgeSelectionService } from './templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from './templateEdgeTopologyService';

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

  const selectedRoleEdgeIds = Array.from(
    new Set([...roleSummary.selectedEdgeClickedIds, ...roleSummary.selectedEdgeAutoMultiIds])
  );

  roleSummary.peerEdgeIds = Array.from(
    new Set(
      selectedRoleEdgeIds.flatMap((edgeId) => {
        const sourceEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

        if (!sourceEdge) {
          return [];
        }

        const peerSide = resolvePeerSide(sourceEdge.side);

        return snapshot.edges
          .filter((candidate) => {
            if (candidate.edgeId === sourceEdge.edgeId) {
              return false;
            }

            if (
              candidate.pageId !== sourceEdge.pageId ||
              candidate.orientation !== sourceEdge.orientation ||
              candidate.side !== peerSide
            ) {
              return false;
            }

            if (Math.abs(candidate.lineCoordinate - sourceEdge.lineCoordinate) > 0.5) {
              return false;
            }

            return Math.min(sourceEdge.spanEnd, candidate.spanEnd) - Math.max(sourceEdge.spanStart, candidate.spanStart) > 0.5;
          })
          .map((candidate) => candidate.edgeId);
      })
    )
  ).filter((edgeId) => !selectedRoleEdgeIds.includes(edgeId));
  roleSummary.mutationEdgeIds = Array.from(
    new Set([...selectedRoleEdgeIds, ...roleSummary.peerEdgeIds])
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
  describeSelectionRoles,
  resolveResizeIntent,
};
