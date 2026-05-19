import type * as React from 'react';
import type {
  TemplateEdgeDescriptorDto,
  TemplateEdgeRoleMapDto,
  TemplateEdgeSelectionStateDto,
  TemplateEdgeSide,
  TemplateEdgeTopologySnapshotDto,
} from '../../../lib/templateEdgeSelectionDtos';
import type {
  TemplateDetailResult,
  TemplateLayoutResizeMode,
  TemplateRecordDto,
  TemplateSchemaSnapshotInput,
} from '../../../lib/templateDtos';
import type { DocumentValueFileDto } from '../../../lib/documentDtos';
import type {
  TemplateFrameBoxKind,
  TemplateFrameResizeDirection,
  TemplateFrameRole,
  TemplateFrameRuntimeMode,
} from '../../../lib/templateFrameEditDtos';

export type TemplateOption = {
  id: string;
  label: string;
  meta: string;
  keywords: string[];
};

export type FrameNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SelectionStyleDraft = {
  width: string;
  height: string;
  fontSize: string;
  lineHeight: string;
  paddingTop: string;
  paddingBottom: string;
  paddingLeft: string;
  paddingRight: string;
  borderRadius: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecorationLine: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  borderAlign: string;
};

export type FrameMetadataDraft = {
  label: string;
  boxKind: TemplateFrameBoxKind | '';
  role: TemplateFrameRole | '';
  valueKey: string;
  parentGroupId: string;
  runtimeMode: TemplateFrameRuntimeMode | '';
};

export type FrameOverlayCacheEntry = {
  style?: SelectionStyleDraft;
  metadata?: FrameMetadataDraft;
};

export type FrameMetadataValidationIssue = {
  frameGroupId: string;
  message: string;
};

export type FrameMetadataReviewIssue = {
  frameGroupId: string;
  message: string;
};

export type SelectionSaveProgressPhase = 'idle' | 'running' | 'completed' | 'failed';

export type SelectionSaveProgressState = {
  phase: SelectionSaveProgressPhase;
  title: string;
  percent: number;
  stage: string;
  detail: string;
};

export type StyleFieldKey = keyof SelectionStyleDraft;
export type StyleFieldApplyState = 'idle' | 'saving' | 'saved' | 'failed';
export type AppearanceBoxModelTarget = 'content' | 'border' | 'corner';
export type AppearanceColorPickerField = 'backgroundColor' | 'borderColor';
export type AppearancePaddingSide = Extract<TemplateEdgeSide, 'top' | 'bottom' | 'left' | 'right'>;
export type AppearanceCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type TextAutoSizeMode = 'fixed' | 'height' | 'width';
export type TextAutoSizeAnchorSide = Extract<TemplateEdgeSide, 'top' | 'bottom' | 'left' | 'right'>;
export type TextAutoHeightAnchorSide = Extract<TextAutoSizeAnchorSide, 'top' | 'bottom'>;
export type TextAutoWidthAnchorSide = Extract<TextAutoSizeAnchorSide, 'left' | 'right'>;
export type TextAutoSizeSecondaryFitAxis = 'height' | 'width';
export type SelectedTextAutoSizeState = {
  totalCount: number;
  heightCount: number;
  widthCount: number;
  fixedCount: number;
  allHeight: boolean;
  allWidth: boolean;
  allFixed: boolean;
  mixed: boolean;
  anchorSide: TextAutoSizeAnchorSide;
  anchorSideMixed: boolean;
  heightAnchorSide: TextAutoHeightAnchorSide;
  heightAnchorSideMixed: boolean;
  widthAnchorSide: TextAutoWidthAnchorSide;
  widthAnchorSideMixed: boolean;
};
export type SizeMatchSourceKind = 'content' | 'selected-box';
export type SizeMatchTargetKind = 'height' | 'width' | 'both';

export type SelectionMetadataApplyResult = {
  ok: boolean;
  skipped: boolean;
  issues: FrameMetadataValidationIssue[];
  reviewIssues?: FrameMetadataReviewIssue[];
};

export type VirtualFrameDefinition = {
  id: string;
  label: string;
};

export type MetadataConnectionSuggestionOption = {
  id: string;
  label: string;
  meta: string;
  source: 'frame' | 'shared';
  role: TemplateFrameRole | 'group' | '';
};

export type FrameStylePatch = Omit<Partial<SelectionStyleDraft>, 'width' | 'height'> & {
  width?: number;
  height?: number;
  targetBorderSides?: TemplateEdgeSide[];
  targetCorners?: AppearanceCorner[];
};

export type FrameMetadataPatch = {
  label?: string;
  boxKind?: TemplateFrameBoxKind;
  role?: TemplateFrameRole;
  valueKey?: string;
  parentGroupId?: string;
  runtimeMode?: TemplateFrameRuntimeMode;
};

export type ResolvedFrameMetadata = {
  label: string;
  boxKind: TemplateFrameBoxKind | '';
  role: TemplateFrameRole | 'group' | '';
  valueKey: string;
  parentGroupId: string;
  runtimeMode: TemplateFrameRuntimeMode | '';
};

export type MetadataRelationSelectionMode =
  | { kind: 'idle' }
  | { kind: 'parent'; sourceFrameGroupIds: string[] }
  | { kind: 'value'; sourceKeyFrameGroupId: string; targetFrameGroupIds: string[] };

export type MetadataVirtualConnectionDraft = {
  mode: 'idle' | 'key' | 'value';
  label: string;
  id: string;
  idTouched: boolean;
  error: string;
};

export type FrameRelationPreviewMode =
  | { kind: 'idle' }
  | { kind: 'parent-select'; sourceFrameGroupIds: string[] }
  | { kind: 'parent-linked'; sourceFrameGroupIds: string[]; keyFrameGroupId: string }
  | { kind: 'value-select'; sourceKeyFrameGroupId: string; targetFrameGroupIds: string[] }
  | { kind: 'value-linked'; sourceKeyFrameGroupId: string; targetFrameGroupIds: string[] };

export type SelectionPanelTab = 'metadata' | 'position';
export type CanvasInteractionMode = 'select' | 'move';
export type CanvasIconScale = 's' | 'm' | 'l';

export type TemplateFramePositionMode = 'relative' | 'absolute';

export type TemplateFrameRelativeAnchorKind = 'frame' | 'page-corner' | 'group';

export type TemplateFrameRelativeHorizontalPin = 'left' | 'right';

export type TemplateFrameRelativeVerticalPin = 'top' | 'bottom';

export type TemplateFrameRelativeAnchorId =
  | 'page-top-left'
  | 'page-top-right'
  | 'page-bottom-left'
  | 'page-bottom-right'
  | string;

export type TemplateFrameRelativeAnchorConfig = {
  positionMode: TemplateFramePositionMode;
  anchorKind: TemplateFrameRelativeAnchorKind;
  anchorId: TemplateFrameRelativeAnchorId;
  anchorX: TemplateFrameRelativeHorizontalPin;
  anchorY: TemplateFrameRelativeVerticalPin;
  offsetX: number;
  offsetY: number;
};

export type CanvasHistoryEntry = {
  renderHtml: string;
  draftHtml: string;
  selectedFrameGroupIds: string[];
  positionGroupProxySelectionGroupId: string;
  showAllGroupProxySelections: boolean;
};

export type PositionImpactGroup = {
  id: string;
  label: string;
  frameGroupIds: string[];
  inferred: boolean;
  childGroupIds?: string[];
  directFrameGroupIds?: string[];
};

export type PositionGroupTreeEntry = {
  id: string;
  label?: string;
  childGroupIds?: string[];
  frameGroupIds?: string[];
};

export type PositionPhysicalSortInfo = {
  pageIndex: number;
  rect: FrameNodeRect;
  sourceOrder: number;
};

export type PositionSelectionClickChainEntry =
  | {
      kind: 'group';
      frameGroupId: string;
      groupId: string;
      groupFrameGroupIds?: string[];
    }
  | {
      kind: 'frame';
      frameGroupId: string;
    };

export type PositionActiveSelectionEntity =
  | {
      kind: 'group';
      groupId: string;
      frameGroupIds: string[];
    }
  | {
      kind: 'frame';
      frameGroupId: string;
    }
  | null;

export type PositionSelectionClickChainSnapshot = {
  sourceFrameGroupId: string;
  point: { x: number; y: number } | null;
  entries: PositionSelectionClickChainEntry[];
};

export type PositionEntitySelectionSnapshot = {
  groupIds: string[];
  frameGroupIds: string[];
  selectedFrameGroupIds: string[];
  proxySelectionGroupId: string;
};

export type PositionGroupEditMode =
  | {
      kind: 'idle';
    }
  | {
      kind: 'exclude-from-group' | 'include-in-group';
      sourceSelection: PositionEntitySelectionSnapshot;
    };

export type PositionSpacingMemberFrameEntry = {
  frameGroupId: string;
  node: HTMLElement;
  pageInner: HTMLElement;
  rect: FrameNodeRect;
};

export type PositionSpacingOrderedGroupMember = {
  group: PositionImpactGroup;
  selectionEntityId: string;
  pageInner: HTMLElement;
  groupRect: FrameNodeRect;
  memberFrameEntries: PositionSpacingMemberFrameEntry[];
  spacingReferenceRects: FrameNodeRect[];
};

export type PositionSpacingPairSummary = {
  pairKey: string;
  anchorLabel: string;
  targetLabel: string;
  anchorGroupId: string;
  targetGroupId: string;
  targetSelectionEntityId: string;
  defaultGapY: number;
  hasExistingRelation: boolean;
  existingGapY: number | null;
  existingGapMixed: boolean;
};

export type PositionSpacingResolvedPair = {
  pairKey: string;
  anchorMember: PositionSpacingOrderedGroupMember;
  targetMember: PositionSpacingOrderedGroupMember;
  anchorY: TemplateFrameRelativeVerticalPin;
  anchorReferenceRect: FrameNodeRect;
  targetReferenceRect: FrameNodeRect;
  defaultGapY: number;
};

export type PositionSpacingGuideRelation = {
  pairKey: string;
  anchorLabel: string;
  targetLabel: string;
  anchorFrameGroupIds: string[];
  targetFrameGroupIds: string[];
  anchorY: TemplateFrameRelativeVerticalPin;
  anchorReferenceRect: FrameNodeRect;
  targetReferenceRect: FrameNodeRect;
  gapYPx: number;
};

export type DefinedPositionRelativeRelation = {
  key: string;
  targetKind: 'group' | 'frame';
  targetGroupId: string;
  targetLabel: string;
  targetFrameGroupIds: string[];
  targetConfiguredFrameGroupIds: string[];
  relationConfiguredFrameGroupIds?: string[];
  anchorKind: 'group' | 'frame' | 'page-corner';
  anchorLabel: string;
  anchorPageCornerId: string;
  anchorGroupId: string;
  anchorFrameGroupId: string;
  anchorFrameGroupIds: string[];
  anchorY: TemplateFrameRelativeVerticalPin;
  gapYPx: number;
};

export type TemplateFramePositionGroupConfig = {
  groupId: string;
  label: string;
  managed: boolean;
};

export type PositionGroupProxySelection = {
  groupId: string;
  label: string;
  frameGroupIds: string[];
  selectionOrder?: number;
  colorName?: string;
  outlineColor?: string;
  fillColor?: string;
  haloColor?: string;
  badgeColor?: string;
  badgeTextColor?: string;
};

export type FrameMarqueeSelectionMode = 'contained' | 'intersected';

export type MarqueeFrameHitEntry = {
  frameGroupId: string;
  rect: FrameNodeRect;
};

export type MarqueePositionGroupHitEntry = {
  groupId: string;
  label: string;
  frameGroupIds: string[];
  frameGroupIdSet: Set<string>;
  rect: FrameNodeRect;
};

export type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  active: boolean;
  pageInner: HTMLElement;
  anchorRect: FrameNodeRect;
  moveRect: FrameNodeRect;
  nodes: Array<{
    node: HTMLElement;
    rect: FrameNodeRect;
  }>;
  snapSiblingRects: FrameNodeRect[];
};

export type ResizeState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  direction: TemplateFrameResizeDirection;
  node: HTMLElement;
  rect: FrameNodeRect;
  widthInstructions?: FrameWidthResizeInstruction[];
  snapSiblingRects?: FrameNodeRect[];
  edgeResizeTargets?: EdgeResizeTarget[];
  edgeSelectionAfterResize?: TemplateEdgeSelectionStateDto;
  edgeRoleById?: TemplateEdgeRoleMapDto;
  mutationEdgeIds?: string[];
  edgeDragSnapshot?: TemplateEdgeTopologySnapshotDto;
  edgeLineCoordinateBaseline?: Record<string, number>;
  appliedEdgeDeltaX?: number;
  appliedEdgeDeltaY?: number;
  edgeAutosnapLockX?: EdgeDragAutosnapLock | null;
  edgeAutosnapLockY?: EdgeDragAutosnapLock | null;
  passiveShiftedEdgeIds?: string[];
};

export type EdgeDragAutosnapLock = {
  orientation: TemplateEdgeDescriptorDto['orientation'];
  referenceEdgeId: string;
  candidateEdgeId: string;
  targetLineCoordinate: number;
  releaseThresholdPx: number;
};

export type MarqueeSelectionState = {
  pointerId: number;
  scale: number;
  pageInner: HTMLElement;
  anchorFrameGroupId: string | null;
  focusFrameGroupIdOnClick?: string | null;
  positionShiftClickFallbackEntry?: PositionSelectionClickChainEntry | null;
  baseSelectionIds: string[];
  baseProxySelections?: PositionGroupProxySelection[];
  clickSelectionIds?: string[];
  clickProxySelections?: PositionGroupProxySelection[];
  lastSelectionIds: string[];
  lastProxySelections?: PositionGroupProxySelection[];
  hitEntriesReady: boolean;
  frameHitEntries: MarqueeFrameHitEntry[];
  positionGroupHitEntries: MarqueePositionGroupHitEntry[];
  origin: {
    x: number;
    y: number;
  };
  ghost: HTMLElement | null;
  mode: FrameMarqueeSelectionMode;
  active: boolean;
};

export type CreateBoxState = {
  pointerId: number;
  scale: number;
  pageInner: HTMLElement;
  positionMode: TemplateFramePositionMode;
  anchorFrameGroupId: string | null;
  origin: {
    x: number;
    y: number;
  };
  ghost: HTMLElement | null;
  active: boolean;
};

export type CanvasPanState = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

export type EdgePressState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  node: HTMLElement;
  direction: TemplateFrameResizeDirection;
  clickedEdgeId: string;
  snapshot: TemplateEdgeTopologySnapshotDto;
  clickSelection: TemplateEdgeSelectionStateDto;
  dragSelection: TemplateEdgeSelectionStateDto;
  mutationEdgeIds: string[];
  edgeRoleById: TemplateEdgeRoleMapDto;
  withShift: boolean;
};

export type EdgeRoleDiagnosticsState = {
  selectedEdgeClickedIds: string[];
  selectedEdgeAutoMultiIds: string[];
  peerEdgeIds: string[];
  mismatchEdgeIds: string[];
};

export type BoundaryShrinkRange = {
  startIndex: number;
  endIndex: number;
  side: 'before' | 'after';
};

export type FrameOutlineAxisRange = {
  start: number;
  end: number;
};

export type FrameWidthResizeInstruction =
  | {
      kind: 'boundary';
      shell: HTMLElement;
      boundaryIndex: number;
      shrinkRange?: BoundaryShrinkRange;
      minimumStopRange?: BoundaryShrinkRange;
    }
  | { kind: 'outer-left'; shell: HTMLElement; shrinkRange?: BoundaryShrinkRange; minimumStopRange?: BoundaryShrinkRange }
  | { kind: 'outer-right'; shell: HTMLElement; shrinkRange?: BoundaryShrinkRange; minimumStopRange?: BoundaryShrinkRange };

export type EdgeResizeTargetMember = {
  handleId: string;
  edgeId: string;
  node: HTMLElement;
  shell: HTMLElement;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  side: TemplateEdgeSide;
  lineCoordinate: number;
  spanStart: number;
  spanEnd: number;
  boundaryIndex: number | null;
  widthInstructions?: FrameWidthResizeInstruction[];
};

export type EdgeResizeTarget = {
  handleId: string;
  node: HTMLElement;
  shell: HTMLElement;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  boundaryIndex: number | null;
  hasOppositePeer: boolean;
  widthInstructions?: FrameWidthResizeInstruction[];
  members: EdgeResizeTargetMember[];
  physicalPeerMembers: EdgeResizeTargetMember[];
};

export type TableCellLayoutPosition = {
  cell: HTMLTableCellElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

export type SplitFrameBandGroup = {
  groupKey: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  entries: TableCellLayoutPosition[];
};

export type NormalizedBandGeometry = {
  shell: HTMLElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  sourceKey: string;
};

export type TemplateEditWorkspaceInitialDraft = {
  draftKey: string;
  templateName: string;
  sourceDocumentName?: string | null;
  draftHtml: string;
  layoutResizeMode?: TemplateLayoutResizeMode;
  attachmentFilesByValueKey?: Record<string, DocumentValueFileDto[]>;
};

export type TemplateEditWorkspaceAttachmentPendingFile = {
  localId: string;
  file: File;
};

export type TemplateEditWorkspaceAttachmentDraft = {
  valueKey: string;
  existingFiles: DocumentValueFileDto[];
  removedExistingFileIds: string[];
  newFiles: TemplateEditWorkspaceAttachmentPendingFile[];
};

export type TemplateEditWorkspaceSaveDraftParams = {
  currentHtml: string;
  renderHtml: string;
  revisionSnapshot: TemplateSchemaSnapshotInput;
  templateName: string;
  sourceDocumentName: string;
  layoutResizeMode: TemplateLayoutResizeMode;
  selectedTemplateId: string;
  attachmentDrafts: TemplateEditWorkspaceAttachmentDraft[];
};

export type TemplateEditWorkspaceSaveDraftResult = {
  successMessage?: string;
};

export type TemplateEditWorkspaceProps = {
  initialTemplateId?: string;
  initialDraft?: TemplateEditWorkspaceInitialDraft | null;
  workspaceMode?: 'template' | 'document' | 'read';
  editableValueKeys?: string[] | null;
  hideHeader?: boolean;
  hidePersistencePanel?: boolean;
  templateListDisplay?: 'picker' | 'inline';
  onTemplateSaved?: (template: TemplateRecordDto) => void;
  onSaveDraftHtml?: (
    params: TemplateEditWorkspaceSaveDraftParams
  ) => Promise<TemplateEditWorkspaceSaveDraftResult | void>;
  additionalControlPanels?: React.ReactNode;
  topNotice?: React.ReactNode;
  suppressInitialDraftLoadedMessage?: boolean;
  headerTitle?: string;
  headerDescription?: string;
  nameFieldLabel?: string;
  saveButtonLabel?: string;
  templateNameReadOnly?: boolean;
  saveDisabled?: boolean;
  documentAttachmentApiPath?: string;
};

export type TemplateFloatingOverlayContent = React.ReactNode | (() => React.ReactNode);

export type TemplateEditPreviewSurfaceProps = {
  renderedPreviewHtml: string;
  canvasFullscreen: boolean;
  boxCreationMode: boolean;
  canvasIconScale: CanvasIconScale;
  spacePanArmed: boolean;
  spacePanDragging: boolean;
  metadataVisualMode: boolean;
  templateUsagePreviewMode: boolean;
  selectionPanelTab: SelectionPanelTab;
  showMetadataIcons: boolean;
  actionOverlay?: TemplateFloatingOverlayContent;
  actionOverlayLabel?: string;
  actionOverlayExpandedWidthClassName?: string;
  metadataNameOverlay?: TemplateFloatingOverlayContent;
  metadataRolePrimaryOverlay?: TemplateFloatingOverlayContent;
  metadataRoleSecondaryOverlay?: TemplateFloatingOverlayContent;
  metadataRoleTertiaryOverlay?: TemplateFloatingOverlayContent;
  styleOverlay?: TemplateFloatingOverlayContent;
  styleOverlayLabel?: string;
  onStyleOverlayCollapsedChange?: (collapsed: boolean) => void;
  sizeTypeOverlay?: TemplateFloatingOverlayContent;
  onSizeTypeOverlayCollapsedChange?: (collapsed: boolean) => void;
  textStyleOverlay?: TemplateFloatingOverlayContent;
  onTextStyleOverlayCollapsedChange?: (collapsed: boolean) => void;
  textStyleOverlayExpandedWidthClassName?: string;
  summaryOverlay?: TemplateFloatingOverlayContent;
  onSummaryOverlayCollapsedChange?: (collapsed: boolean) => void;
  setPreviewNode: (node: HTMLDivElement | null) => void;
  syncTemplateUsagePreviewTextControls?: (root: ParentNode) => void;
  handlePreviewPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewLostPointerCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
  handlePreviewInput: (event: React.FormEvent<HTMLDivElement>) => void;
};

export type SummaryOverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type TemplateFloatingOverlayId =
  | 'summary'
  | 'style'
  | 'sizeType'
  | 'textStyle'
  | 'action'
  | 'metadataName'
  | 'metadataRolePrimary'
  | 'metadataRoleSecondary'
  | 'metadataRoleTertiary';

export type SummaryOverlayDragState = {
  overlayId: TemplateFloatingOverlayId;
  pointerId: number;
  originX: number;
  originY: number;
  initialLeft: number;
  initialTop: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  shellLeft: number;
  shellTop: number;
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
  visibleLeft: number;
  visibleTop: number;
  visibleWidth: number;
  visibleHeight: number;
  hasMoved: boolean;
};

export type FloatingOverlayQuadrantGuideState = {
  activeCorner: SummaryOverlayCorner;
  left: number;
  top: number;
  width: number;
  height: number;
};
