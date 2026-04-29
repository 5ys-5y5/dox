import type {
  TemplateEdgeMutationOperationDto,
  TemplateEdgeResizeIntentDto,
  TemplateEdgeResizeIntentRequestDto,
} from '../lib/templateEdgeSelectionDtos';
import { TemplateEdgeTopologyService } from './templateEdgeTopologyService';

const resolveTargetOperations = (
  request: TemplateEdgeResizeIntentRequestDto
): TemplateEdgeMutationOperationDto[] => {
  return request.activationResult.effectiveEdgeIds.flatMap((edgeId) => {
    const edge = TemplateEdgeTopologyService.getEdgeById(request.snapshot, edgeId);

    if (!edge || edge.side !== request.side) {
      return [];
    }

    return [
      {
        edgeId,
        frameGroupId: edge.frameGroupId,
        side: edge.side,
      },
    ];
  });
};

const resolveResizeIntent = (request: TemplateEdgeResizeIntentRequestDto): TemplateEdgeResizeIntentDto => {
  const clickedEdge = TemplateEdgeTopologyService.getEdgeById(request.snapshot, request.clickedEdgeId);

  if (!clickedEdge) {
    return {
      effectiveSelectionState: request.activationResult.nextSelectionState,
      targetEdgeIds: [],
      targetOperations: [],
      activatedMode: request.activationResult.activatedMode,
      blockedReason: 'missing-edge',
    };
  }

  if (clickedEdge.side !== request.side) {
    return {
      effectiveSelectionState: request.activationResult.nextSelectionState,
      targetEdgeIds: [],
      targetOperations: [],
      activatedMode: request.activationResult.activatedMode,
      blockedReason: 'incompatible-side',
    };
  }

  const targetOperations = resolveTargetOperations(request);

  return {
    effectiveSelectionState: request.activationResult.nextSelectionState,
    targetEdgeIds: targetOperations.map((operation) => operation.edgeId),
    targetOperations,
    activatedMode: request.activationResult.activatedMode,
    blockedReason: targetOperations.length > 0 ? 'none' : 'missing-edge',
  };
};

export const TemplateEdgeResizeIntentService = {
  resolveResizeIntent,
};
