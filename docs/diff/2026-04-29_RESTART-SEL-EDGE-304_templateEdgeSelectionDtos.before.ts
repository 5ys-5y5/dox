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

export type TemplateEdgeTopologySnapshotDto = {
  edges: TemplateEdgeDescriptorDto[];
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

export type TemplateEdgeTopologySourceDto = {
  frames: TemplateEdgeFrameDto[];
  tolerancePx: number;
};
