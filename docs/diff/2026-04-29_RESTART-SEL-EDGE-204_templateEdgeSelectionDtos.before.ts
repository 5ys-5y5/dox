export type TemplateEdgeOrientation = 'vertical' | 'horizontal';

export type TemplateEdgeSide = 'left' | 'right' | 'top' | 'bottom';

export type TemplateEdgeSelectionMode = 'connected' | 'isolated';

export type TemplateEdgeAdjacencyRelation = 'touching-endpoint';

export type TemplateEdgeRectDto = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TemplateEdgeFrameDto = {
  frameGroupId: string;
  pageId: string;
  rect: TemplateEdgeRectDto;
};

export type TemplateEdgeDescriptorDto = {
  edgeId: string;
  frameGroupId: string;
  pageId: string;
  orientation: TemplateEdgeOrientation;
  side: TemplateEdgeSide;
  lineCoordinate: number;
  oppositeCoordinate: number;
  spanStart: number;
  spanEnd: number;
  rect: TemplateEdgeRectDto;
  cohortId: string | null;
};

export type TemplateEdgeAdjacencyDto = {
  fromEdgeId: string;
  toEdgeId: string;
  orientation: TemplateEdgeOrientation;
  side: TemplateEdgeSide;
  sharedCoordinate: number;
  relation: TemplateEdgeAdjacencyRelation;
};

export type TemplateEdgeCohortDto = {
  cohortId: string;
  pageId: string;
  orientation: TemplateEdgeOrientation;
  side: TemplateEdgeSide;
  lineCoordinate: number;
  oppositeCoordinate: number;
  chainIndex: number;
  edgeIds: string[];
};

export type TemplateEdgeTopologySnapshotDto = {
  edges: TemplateEdgeDescriptorDto[];
  adjacencies: TemplateEdgeAdjacencyDto[];
  cohorts: TemplateEdgeCohortDto[];
};

export type TemplateEdgeSelectionTokenDto = {
  tokenId: string;
  anchorEdgeId: string;
  mode: TemplateEdgeSelectionMode;
  memberEdgeIds: string[];
  selectionOrder: number;
};

export type TemplateEdgeSelectionStateDto = {
  tokens: TemplateEdgeSelectionTokenDto[];
  primaryTokenId: string | null;
};

export type TemplateEdgeSelectionClickDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
  clickedEdgeId: string;
  withShift: boolean;
};

export type TemplateSelectedEdgeActivationReason =
  | 'new-connected'
  | 'toggle-isolated'
  | 'toggle-connected'
  | 'append-connected'
  | 'replace-incompatible';

export type TemplateSelectedEdgeActivationRequestDto = TemplateEdgeSelectionClickDto;

export type TemplateSelectedEdgeActivationResultDto = {
  nextSelectionState: TemplateEdgeSelectionStateDto;
  activatedMode: TemplateEdgeSelectionMode | null;
  effectiveEdgeIds: string[];
  activationReason: TemplateSelectedEdgeActivationReason;
};

export type TemplateEdgeMutationOperationDto = {
  edgeId: string;
  frameGroupId: string;
  side: TemplateEdgeSide;
};

export type TemplateEdgeResizeIntentRequestDto = {
  snapshot: TemplateEdgeTopologySnapshotDto;
  activationResult: TemplateSelectedEdgeActivationResultDto;
  clickedEdgeId: string;
  side: TemplateEdgeSide;
  pointerDeltaPx: number;
};

export type TemplateEdgeResizeIntentBlockedReason = 'none' | 'missing-edge' | 'incompatible-side';

export type TemplateEdgeResizeIntentDto = {
  effectiveSelectionState: TemplateEdgeSelectionStateDto;
  targetEdgeIds: string[];
  targetOperations: TemplateEdgeMutationOperationDto[];
  activatedMode: TemplateEdgeSelectionMode | null;
  blockedReason: TemplateEdgeResizeIntentBlockedReason;
};

export type TemplateEdgeTopologySourceDto = {
  frames: TemplateEdgeFrameDto[];
  tolerancePx: number;
};
