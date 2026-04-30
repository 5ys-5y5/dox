export type TemplateEdgeOrientation = 'vertical' | 'horizontal';

export type TemplateEdgeSide = 'left' | 'right' | 'top' | 'bottom';

export type TemplateEdgeSelectionMode = 'connected' | 'isolated';

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

export type TemplateEdgeAdjacencyRelation = 'touching-endpoint';

export type TemplateEdgeDirectAdjacencyDto = {
  fromEdgeId: string;
  toEdgeId: string;
  orientation: TemplateEdgeOrientation;
  side: TemplateEdgeSide;
  sharedCoordinate: number;
  relation: TemplateEdgeAdjacencyRelation;
};

export type TemplateEdgeTopologySnapshotDto = {
  edges: TemplateEdgeDescriptorDto[];
  cohorts: TemplateEdgeCohortDto[];
  adjacencies: TemplateEdgeDirectAdjacencyDto[];
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

export type TemplateEdgeActivationResultDto = {
  selectionState: TemplateEdgeSelectionStateDto;
  activatedTokenId: string | null;
  effectiveEdgeIds: string[];
  mode: TemplateEdgeSelectionMode | null;
};

export type TemplateEdgeResizeIntentDto = {
  clickSelectionState: TemplateEdgeSelectionStateDto;
  dragSelectionState: TemplateEdgeSelectionStateDto;
  selectedEdgeIds: string[];
  passivePeerEdgeIds: string[];
  targetEdgeIds: string[];
  dragMode: TemplateEdgeSelectionMode | null;
  side: TemplateEdgeSide | null;
};

export type TemplateEdgeTopologySourceDto = {
  frames: TemplateEdgeFrameDto[];
  tolerancePx: number;
};
