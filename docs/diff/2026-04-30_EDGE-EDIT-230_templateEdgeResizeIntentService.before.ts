import type { TemplateEdgeResizeIntentDto, TemplateEdgeSelectionClickDto } from '../lib/templateEdgeSelectionDtos';
import { TemplateEdgeSelectionService } from './templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from './templateEdgeTopologyService';

const resolveResizeIntent = (input: TemplateEdgeSelectionClickDto): TemplateEdgeResizeIntentDto => {
  const clickActivation = TemplateEdgeSelectionService.resolveActivation(input);
  const dragActivation = TemplateEdgeSelectionService.resolveDragActivation(input);
  const clickedEdge = TemplateEdgeTopologyService.getEdgeById(input.snapshot, input.clickedEdgeId);

  if (!clickedEdge) {
    return {
      clickSelectionState: clickActivation.selectionState,
      dragSelectionState: dragActivation.selectionState,
      selectedEdgeIds: [],
      passivePeerEdgeIds: [],
      targetEdgeIds: [],
      dragMode: dragActivation.mode,
      side: null,
    };
  }

  const selectedEdgeIds = Array.from(
    new Set(
      dragActivation.effectiveEdgeIds.filter((edgeId) => {
        const edge = TemplateEdgeTopologyService.getEdgeById(input.snapshot, edgeId);
        return edge?.orientation === clickedEdge.orientation && edge.side === clickedEdge.side;
      })
    )
  );
  const passivePeerEdgeIds = Array.from(
    new Set(
      selectedEdgeIds.flatMap((edgeId) => TemplateEdgeTopologyService.getPhysicalPeerEdgeIds(input.snapshot, edgeId))
    )
  );
  const targetEdgeIds = Array.from(
    new Set([...selectedEdgeIds, ...passivePeerEdgeIds])
  );

  return {
    clickSelectionState: clickActivation.selectionState,
    dragSelectionState: dragActivation.selectionState,
    selectedEdgeIds,
    passivePeerEdgeIds,
    targetEdgeIds,
    dragMode: dragActivation.mode,
    side: clickedEdge.side,
  };
};

export const TemplateEdgeResizeIntentService = {
  resolveResizeIntent,
};
