import type { TemplateEdgeResizeIntentDto, TemplateEdgeSelectionClickDto } from '../lib/templateEdgeSelectionDtos';
import { TemplateEdgeSelectionService } from './templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from './templateEdgeTopologyService';

const resolveResizeIntent = (input: TemplateEdgeSelectionClickDto): TemplateEdgeResizeIntentDto => {
  const activation = TemplateEdgeSelectionService.resolveActivation(input);
  const clickedEdge = TemplateEdgeTopologyService.getEdgeById(input.snapshot, input.clickedEdgeId);

  if (!clickedEdge) {
    return {
      selectionState: activation.selectionState,
      activatedTokenId: activation.activatedTokenId,
      targetEdgeIds: [],
      mode: activation.mode,
      side: null,
    };
  }

  const targetEdgeIds = Array.from(
    new Set(
      activation.effectiveEdgeIds.filter((edgeId) => {
        const edge = TemplateEdgeTopologyService.getEdgeById(input.snapshot, edgeId);
        return edge?.orientation === clickedEdge.orientation && edge.side === clickedEdge.side;
      })
    )
  );

  return {
    selectionState: activation.selectionState,
    activatedTokenId: activation.activatedTokenId,
    targetEdgeIds,
    mode: activation.mode,
    side: clickedEdge.side,
  };
};

export const TemplateEdgeResizeIntentService = {
  resolveResizeIntent,
};
