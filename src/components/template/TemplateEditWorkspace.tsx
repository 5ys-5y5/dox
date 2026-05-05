'use client';

import { CheckCircle2, CircleDot, CornerDownRight, FileText, KeyRound, Loader2, Minus, Paperclip, Redo2, Signature, Undo2, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { EntityPicker, type EntityPickerOption } from '../ui/EntityPicker';
import { Input } from '../ui/Input';
import { applyTemplateExtractEditableTextFit } from '../../lib/templateExtractEditableTextFit';
import type {
  TemplateEdgeDescriptorDto,
  TemplateEdgeFrameDto,
  TemplateEdgeRoleMapDto,
  TemplateEdgeSelectionRole,
  TemplateEdgeSelectionStateDto,
  TemplateEdgeSide,
  TemplateEdgeTopologySnapshotDto,
} from '../../lib/templateEdgeSelectionDtos';
import type { TemplateDetailResult, TemplateLayoutResizeMode, TemplateRecordDto } from '../../lib/templateDtos';
import type {
  TemplateFrameBoxKind,
  TemplateFrameResizeDirection,
  TemplateFrameRole,
  TemplateFrameRuntimeMode,
} from '../../lib/templateFrameEditDtos';
import { TemplateEdgeResizeIntentService } from '../../services/templateEdgeResizeIntentService';
import { TemplateEdgeSelectionService } from '../../services/templateEdgeSelectionService';
import { TemplateEdgeTopologyService } from '../../services/templateEdgeTopologyService';
import { TemplateFrameEditGeometryService } from '../../services/templateFrameEditGeometryService';
import { TemplateFrameEditHtmlService } from '../../services/templateFrameEditHtmlService';

type TemplateOption = {
  id: string;
  label: string;
  meta: string;
  keywords: string[];
};

type FrameNodeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SelectionStyleDraft = {
  width: string;
  height: string;
  fontSize: string;
  lineHeight: string;
  paddingX: string;
  paddingY: string;
  borderRadius: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color: string;
  backgroundColor: string;
};

type FrameMetadataDraft = {
  boxKind: TemplateFrameBoxKind | '';
  role: TemplateFrameRole | '';
  valueKey: string;
  parentGroupId: string;
  runtimeMode: TemplateFrameRuntimeMode | '';
};

type FrameMetadataValidationIssue = {
  frameGroupId: string;
  message: string;
};

type SelectionSaveProgressPhase = 'idle' | 'running' | 'completed' | 'failed';

type SelectionSaveProgressState = {
  phase: SelectionSaveProgressPhase;
  title: string;
  percent: number;
  stage: string;
  detail: string;
};

type StyleFieldKey = keyof SelectionStyleDraft;
type StyleFieldApplyState = 'idle' | 'saving' | 'saved' | 'failed';

type SelectionMetadataApplyResult = {
  ok: boolean;
  skipped: boolean;
  issues: FrameMetadataValidationIssue[];
};

type VirtualFrameDefinition = {
  id: string;
  label: string;
};

type FrameStylePatch = Omit<Partial<SelectionStyleDraft>, 'width' | 'height'> & {
  width?: number;
  height?: number;
};

type FrameMetadataPatch = {
  boxKind?: TemplateFrameBoxKind;
  role?: TemplateFrameRole;
  valueKey?: string;
  parentGroupId?: string;
  runtimeMode?: TemplateFrameRuntimeMode;
};

type ResolvedFrameMetadata = {
  boxKind: TemplateFrameBoxKind | '';
  role: TemplateFrameRole | 'group' | '';
  valueKey: string;
  parentGroupId: string;
  runtimeMode: TemplateFrameRuntimeMode | '';
};

type MetadataRelationSelectionMode =
  | { kind: 'idle' }
  | { kind: 'parent'; sourceFrameGroupIds: string[] }
  | { kind: 'value'; sourceKeyFrameGroupId: string; targetFrameGroupIds: string[] };

type FrameRelationPreviewMode =
  | { kind: 'idle' }
  | { kind: 'parent-select'; sourceFrameGroupIds: string[] }
  | { kind: 'parent-linked'; sourceFrameGroupIds: string[]; keyFrameGroupId: string }
  | { kind: 'value-select'; sourceKeyFrameGroupId: string; targetFrameGroupIds: string[] }
  | { kind: 'value-linked'; sourceKeyFrameGroupId: string; targetFrameGroupIds: string[] };

type SelectionPanelTab = 'summary' | 'create' | 'metadata' | 'position' | 'text' | 'style';

type TemplateFramePositionMode = 'relative' | 'absolute';

type TemplateFrameRelativeAnchorKind = 'frame' | 'page-corner' | 'group';

type TemplateFrameRelativeHorizontalPin = 'left' | 'right';

type TemplateFrameRelativeVerticalPin = 'top' | 'bottom';

type TemplateFrameRelativeAnchorId = 'page-top-left' | 'page-top-right' | 'page-bottom-left' | 'page-bottom-right' | string;

type TemplateFrameRelativeAnchorConfig = {
  positionMode: TemplateFramePositionMode;
  anchorKind: TemplateFrameRelativeAnchorKind;
  anchorId: TemplateFrameRelativeAnchorId;
  anchorX: TemplateFrameRelativeHorizontalPin;
  anchorY: TemplateFrameRelativeVerticalPin;
  offsetX: number;
  offsetY: number;
};

type CanvasHistoryEntry = {
  renderHtml: string;
  draftHtml: string;
  selectedFrameGroupIds: string[];
  positionGroupProxySelectionGroupId: string;
  showAllGroupProxySelections: boolean;
};

type PositionImpactGroup = {
  id: string;
  label: string;
  frameGroupIds: string[];
  inferred: boolean;
};

type PositionSelectionClickChainEntry =
  | {
      kind: 'group';
      frameGroupId: string;
      groupId: string;
    }
  | {
      kind: 'frame';
      frameGroupId: string;
    };

type PositionSelectionClickChainSnapshot = {
  sourceFrameGroupId: string;
  point: { x: number; y: number } | null;
  entries: PositionSelectionClickChainEntry[];
};

type PositionSpacingMemberFrameEntry = {
  frameGroupId: string;
  node: HTMLElement;
  pageInner: HTMLElement;
  rect: FrameNodeRect;
};

type PositionSpacingOrderedGroupMember = {
  group: PositionImpactGroup;
  selectionEntityId: string;
  pageInner: HTMLElement;
  groupRect: FrameNodeRect;
  memberFrameEntries: PositionSpacingMemberFrameEntry[];
  spacingReferenceRects: FrameNodeRect[];
};

type PositionSpacingPairSummary = {
  pairKey: string;
  anchorLabel: string;
  targetLabel: string;
  anchorGroupId: string;
  targetGroupId: string;
  targetSelectionEntityId: string;
  defaultGapY: number;
};

type PositionSpacingResolvedPair = {
  pairKey: string;
  anchorMember: PositionSpacingOrderedGroupMember;
  targetMember: PositionSpacingOrderedGroupMember;
  anchorY: TemplateFrameRelativeVerticalPin;
  anchorReferenceRect: FrameNodeRect;
  targetReferenceRect: FrameNodeRect;
  defaultGapY: number;
};

type PositionSpacingGuideRelation = {
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

type DefinedPositionRelativeRelation = {
  key: string;
  targetKind: 'group' | 'frame';
  targetGroupId: string;
  targetLabel: string;
  targetFrameGroupIds: string[];
  targetConfiguredFrameGroupIds: string[];
  anchorKind: 'group' | 'frame' | 'page-corner';
  anchorLabel: string;
  anchorPageCornerId: string;
  anchorGroupId: string;
  anchorFrameGroupId: string;
  anchorFrameGroupIds: string[];
  gapYPx: number;
};

type TemplateFramePositionGroupConfig = {
  groupId: string;
  label: string;
  managed: boolean;
};

type PositionGroupProxySelection = {
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

type PositionGroupWithRect = {
  group: PositionImpactGroup;
  frameGroupIds: string[];
  frameGroupIdSet: Set<string>;
  rect: FrameNodeRect;
};

type FrameMarqueeSelectionMode = 'contained' | 'intersected';

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  anchorRect: FrameNodeRect;
  nodes: Array<{
    node: HTMLElement;
    rect: FrameNodeRect;
  }>;
};

type ResizeState = {
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  pageInner: HTMLElement;
  direction: TemplateFrameResizeDirection;
  node: HTMLElement;
  rect: FrameNodeRect;
  widthInstructions?: FrameWidthResizeInstruction[];
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

type EdgeDragAutosnapLock = {
  orientation: TemplateEdgeDescriptorDto['orientation'];
  referenceEdgeId: string;
  candidateEdgeId: string;
  targetLineCoordinate: number;
  releaseThresholdPx: number;
};

type MarqueeSelectionState = {
  pointerId: number;
  scale: number;
  pageInner: HTMLElement;
  anchorFrameGroupId: string | null;
  baseSelectionIds: string[];
  lastSelectionIds: string[];
  lastProxySelections?: PositionGroupProxySelection[];
  origin: {
    x: number;
    y: number;
  };
  ghost: HTMLElement | null;
  mode: FrameMarqueeSelectionMode;
  active: boolean;
};

type CreateBoxState = {
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

type EdgePressState = {
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

type EdgeRoleDiagnosticsState = {
  selectedEdgeClickedIds: string[];
  selectedEdgeAutoMultiIds: string[];
  peerEdgeIds: string[];
  mismatchEdgeIds: string[];
};

type BoundaryShrinkRange = {
  startIndex: number;
  endIndex: number;
  side: 'before' | 'after';
};

type FrameOutlineAxisRange = {
  start: number;
  end: number;
};

type FrameWidthResizeInstruction =
  | {
      kind: 'boundary';
      shell: HTMLElement;
      boundaryIndex: number;
      shrinkRange?: BoundaryShrinkRange;
      minimumStopRange?: BoundaryShrinkRange;
    }
  | { kind: 'outer-left'; shell: HTMLElement; shrinkRange?: BoundaryShrinkRange; minimumStopRange?: BoundaryShrinkRange }
  | { kind: 'outer-right'; shell: HTMLElement; shrinkRange?: BoundaryShrinkRange; minimumStopRange?: BoundaryShrinkRange };

type EdgeResizeTargetMember = {
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

type EdgeResizeTarget = {
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

type TableCellLayoutPosition = {
  cell: HTMLTableCellElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

type SplitFrameBandGroup = {
  groupKey: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  entries: TableCellLayoutPosition[];
};

type NormalizedBandGeometry = {
  shell: HTMLElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  sourceKey: string;
};

type TemplateEditWorkspaceProps = {
  initialTemplateId?: string;
};

type TemplateEditPreviewSurfaceProps = {
  renderedPreviewHtml: string;
  boxCreationMode: boolean;
  metadataVisualMode: boolean;
  selectionPanelTab: SelectionPanelTab;
  showMetadataIcons: boolean;
  setPreviewNode: (node: HTMLDivElement | null) => void;
  handlePreviewPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePreviewClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
  handlePreviewInput: (event: React.FormEvent<HTMLDivElement>) => void;
};

const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SELECTION_NODE_SELECTOR = RAW_FRAME_NODE_SELECTOR;
const FRAME_SELECTION_BADGE_CLASS = 'v106-frame-selection-badge';
const FRAME_RELATION_BADGE_CLASS = 'v106-frame-relation-badge';
const FRAME_KIND_MARKER_CLASS = 'v106-frame-kind-marker';
const FRAME_RESIZE_HANDLE_SELECTOR = '[data-v106-resize-handle="true"]';
const FRAME_EDGE_BUTTON_SELECTOR = '[data-v106-edge-button="true"]';
const FRAME_MARQUEE_GHOST_CLASS = 'v106-frame-marquee';
const FRAME_CREATION_GHOST_CLASS = 'v106-frame-create-ghost';
const FRAME_OUTLINE_OVERLAY_ATTR = 'data-v106-frame-outline-overlay';
const FRAME_CLUSTER_OUTLINE_OVERLAY_ATTR = 'data-v106-frame-cluster-outline-overlay';
const FRAME_SELECTED_SIDE_INDICATOR_ATTR = 'data-v106-frame-selected-side-indicator';
const FRAME_SELECTION_FILL_CLASS = 'v106-frame-selection-fill';
const FRAME_RICHTEXT_PREVIEW_CLASS = 'v106-frame-richtext-preview';
const TEMPLATE_FRAME_VALIDATION_ERROR_ATTR = 'data-template-validation-error';
const TEMPLATE_NATIVE_OUTLINE_HIDDEN_ATTR = 'data-template-native-outline-hidden';
const TEMPLATE_FRAME_POSITION_MODE_ATTR = 'data-template-frame-position-mode';
const TEMPLATE_FRAME_BASE_HEIGHT_ATTR = 'data-template-frame-base-height';
const TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR = 'data-template-frame-base-font-size';
const TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR = 'data-template-frame-base-line-height';
const TEMPLATE_FRAME_RICHTEXT_ACTIVE_ATTR = 'data-template-frame-richtext-active';
const TEMPLATE_FRAME_ROLE_ATTR = 'data-template-frame-role';
const TEMPLATE_FRAME_VALUE_KEY_ATTR = 'data-template-frame-value-key';
const TEMPLATE_FRAME_PARENT_GROUP_ATTR = 'data-template-frame-parent-group';
const TEMPLATE_FRAME_BOX_KIND_ATTR = 'data-template-box-kind';
const TEMPLATE_FRAME_RUNTIME_MODE_ATTR = 'data-template-runtime-mode';
const TEMPLATE_VIRTUAL_FRAME_DEFINITIONS_ATTR = 'data-template-virtual-frame-definitions';
const TEMPLATE_FRAME_FIELD_TYPE_ATTR = 'data-template-frame-field-type';
const TEMPLATE_FRAME_COLOR_GROUP_ATTR = 'data-template-frame-color-group';
const TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR = 'data-template-frame-visual-emphasis';
const TEMPLATE_FRAME_ROLE_VISUAL_ATTR = 'data-template-frame-role-visual';
const TEMPLATE_FRAME_BOX_KIND_VISUAL_ATTR = 'data-template-frame-box-kind-visual';
const TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR = 'data-template-frame-relative-anchor-kind';
const TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR = 'data-template-frame-relative-anchor-id';
const TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR = 'data-template-frame-relative-anchor-x';
const TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR = 'data-template-frame-relative-anchor-y';
const TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR = 'data-template-frame-relative-offset-x';
const TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR = 'data-template-frame-relative-offset-y';
const TEMPLATE_FRAME_RELATION_SELECTION_ATTR = 'data-template-frame-relation-selection';
const TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR = 'data-template-frame-position-impact-group';
const TEMPLATE_FRAME_POSITION_GROUP_ID_ATTR = 'data-template-frame-position-group-id';
const TEMPLATE_FRAME_POSITION_GROUP_LABEL_ATTR = 'data-template-frame-position-group-label';
const TEMPLATE_FRAME_POSITION_GROUP_MANAGED_ATTR = 'data-template-frame-position-group-managed';
const TEMPLATE_FRAME_POSITION_RELATION_ACTIVE_ATTR = 'data-template-frame-position-relation-active';
const TEMPLATE_FRAME_POSITION_RELATION_ANCHOR_ATTR = 'data-template-frame-position-relation-anchor';
const FRAME_RELATIVE_ANCHOR_GUIDE_CLASS = 'v106-frame-relative-anchor-guide';
const FRAME_RELATIVE_ANCHOR_BADGE_CLASS = 'v106-frame-relative-anchor-badge';
const CREATED_FRAME_GROUP_PREFIX = 'user-box';
const emptyEdgeRoleDiagnosticsState: EdgeRoleDiagnosticsState = {
  selectedEdgeClickedIds: [],
  selectedEdgeAutoMultiIds: [],
  peerEdgeIds: [],
  mismatchEdgeIds: [],
};

const defaultSelectionSaveProgressState: SelectionSaveProgressState = {
  phase: 'idle',
  title: '진행 상태',
  percent: 0,
  stage: '작업 대기 중입니다.',
  detail: '선택한 박스의 메타데이터와 스타일을 저장하면 진행률이 여기에 표시됩니다.',
};
const POSITION_LOCK_COLOR_PRESETS = [
  {
    colorName: '빨간색',
    outlineColor: 'rgba(220, 38, 38, .98)',
    fillColor: 'rgba(248, 113, 113, .12)',
    haloColor: 'rgba(248, 113, 113, .3)',
    badgeColor: 'rgba(185, 28, 28, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '파란색',
    outlineColor: 'rgba(37, 99, 235, .98)',
    fillColor: 'rgba(96, 165, 250, .12)',
    haloColor: 'rgba(96, 165, 250, .28)',
    badgeColor: 'rgba(30, 64, 175, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '초록색',
    outlineColor: 'rgba(22, 163, 74, .98)',
    fillColor: 'rgba(74, 222, 128, .12)',
    haloColor: 'rgba(74, 222, 128, .3)',
    badgeColor: 'rgba(21, 128, 61, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '보라색',
    outlineColor: 'rgba(147, 51, 234, .98)',
    fillColor: 'rgba(192, 132, 252, .12)',
    haloColor: 'rgba(192, 132, 252, .3)',
    badgeColor: 'rgba(109, 40, 217, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '주황색',
    outlineColor: 'rgba(234, 88, 12, .98)',
    fillColor: 'rgba(251, 146, 60, .12)',
    haloColor: 'rgba(251, 146, 60, .3)',
    badgeColor: 'rgba(194, 65, 12, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '민트색',
    outlineColor: 'rgba(13, 148, 136, .98)',
    fillColor: 'rgba(45, 212, 191, .12)',
    haloColor: 'rgba(45, 212, 191, .3)',
    badgeColor: 'rgba(15, 118, 110, .96)',
    badgeTextColor: '#fff',
  },
] as const;

const resolvePositionLockColorPreset = (selectionOrder: number, seed: number) => {
  const safeOrder = Number.isFinite(selectionOrder) ? Math.max(1, Math.floor(selectionOrder)) : 1;
  const length = POSITION_LOCK_COLOR_PRESETS.length;
  const safeSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  const offset = (safeSeed + safeOrder - 1) % length;
  return POSITION_LOCK_COLOR_PRESETS[offset] || POSITION_LOCK_COLOR_PRESETS[0];
};

const TemplateEditPreviewSurface = React.memo(function TemplateEditPreviewSurface({
  renderedPreviewHtml,
  boxCreationMode,
  metadataVisualMode,
  selectionPanelTab,
  showMetadataIcons,
  setPreviewNode,
  handlePreviewPointerDown,
  handlePreviewPointerMove,
  handlePreviewPointerUp,
  handlePreviewPointerCancel,
  handlePreviewClickCapture,
  handlePreviewInput,
}: TemplateEditPreviewSurfaceProps) {
  if (!renderedPreviewHtml) {
    return (
      <CardContent className="p-6">
        <div className="flex min-h-[560px] items-center justify-center text-sm text-slate-500">
          편집할 템플릿을 먼저 불러오세요.
        </div>
      </CardContent>
    );
  }

  return (
    <CardContent
      ref={setPreviewNode}
      className="template-edit-preview template-extract-draft-preview template-extract-preview-surface bg-slate-200 p-4 template-clone template-clone--raster-first-v2-structured"
      data-frame-create-mode={boxCreationMode ? 'true' : 'false'}
      data-metadata-visual-mode={metadataVisualMode ? 'true' : 'false'}
      data-selection-panel-tab={selectionPanelTab}
      data-metadata-icon-visual-mode={showMetadataIcons ? 'true' : 'false'}
      onPointerDownCapture={handlePreviewPointerDown}
      onPointerMoveCapture={handlePreviewPointerMove}
      onPointerUpCapture={handlePreviewPointerUp}
      onPointerCancelCapture={handlePreviewPointerCancel}
      onClickCapture={handlePreviewClickCapture}
      onInput={handlePreviewInput}
      dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
    />
  );
});
const FRAME_RESIZE_DIRECTIONS: TemplateFrameResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const TEMPLATE_FRAME_BOX_KIND_OPTIONS: TemplateFrameBoxKind[] = ['text', 'attachment', 'signature'];
const TEMPLATE_FRAME_ROLE_OPTIONS: TemplateFrameRole[] = ['key', 'value', 'key_value'];
const TEXT_RUNTIME_MODE_OPTIONS: TemplateFrameRuntimeMode[] = ['static_label', 'editable_text'];
const ATTACHMENT_RUNTIME_MODE_OPTIONS: TemplateFrameRuntimeMode[] = ['file_slot'];
const SIGNATURE_RUNTIME_MODE_OPTIONS: TemplateFrameRuntimeMode[] = [
  'signature_image',
  'signature_history',
  'signature_signer_name',
  'signature_signed_at',
  'signature_provider',
  'signature_status',
];
const FRAME_BOX_KIND_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: 'text | 텍스트 박스',
  attachment: 'attachment | 첨부파일 박스',
  signature: 'signature | 서명 박스',
};
const FRAME_BOX_KIND_SHORT_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: '텍스트 박스',
  attachment: '첨부파일 박스',
  signature: '서명 박스',
};
const FRAME_BOX_KIND_MARKER_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: '텍스트',
  attachment: '첨부',
  signature: '서명',
};
const NULL_MARKER_LABEL = '-';
const FRAME_BOX_KIND_DESCRIPTIONS: Record<TemplateFrameBoxKind, string> = {
  text: '문서마다 텍스트를 직접 입력하거나, 고정 라벨처럼 보여주는 박스입니다.',
  attachment: '문서마다 파일을 업로드하고 파일명 표시, 파일 열기 동작을 연결하는 박스입니다.',
  signature: '문서마다 서명 컨텍스트를 연결하고 이미지, 이력, 상태 같은 정보를 출력하는 박스입니다.',
};
const FRAME_ROLE_LABELS: Record<TemplateFrameRole, string> = {
  key: 'key | 상위 키',
  value: 'value | 하위 값',
  key_value: 'key_value | 독립 값',
};
const FRAME_ROLE_SHORT_LABELS: Record<TemplateFrameRole | 'group', string> = {
  group: '그룹',
  key: '상위 키',
  value: '하위 값',
  key_value: '독립 값',
};
const FRAME_ROLE_DESCRIPTIONS: Record<TemplateFrameRole, string> = {
  key: '다른 value 박스들을 묶는 기준 박스입니다. 보통 라벨이나 제목 역할을 맡습니다.',
  value: '어떤 key 박스에 속한 실제 입력값 박스입니다. 연결된 key 박스가 필요합니다.',
  key_value: '상위 key 없이 자기 자신이 하나의 완결된 값이 되는 독립 박스입니다.',
};

const FrameKindIcon = ({
  boxKind,
  className = '',
  strokeWidth = 2.15,
}: {
  boxKind: TemplateFrameBoxKind | '';
  className?: string;
  strokeWidth?: number;
}) => {
  const IconComponent =
    boxKind === 'text' ? FileText : boxKind === 'attachment' ? Paperclip : boxKind === 'signature' ? Signature : Minus;
  return <IconComponent aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
};

const FrameRoleIcon = ({
  role,
  className = '',
  strokeWidth = 2.15,
}: {
  role: TemplateFrameRole | 'group' | '';
  className?: string;
  strokeWidth?: number;
}) => {
  const IconComponent = role === 'key' ? KeyRound : role === 'value' ? CornerDownRight : role === 'key_value' || role === 'group' ? CircleDot : Minus;
  return <IconComponent aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
};

const FrameMetadataMarker = ({
  boxKind,
  role,
  compact = false,
}: {
  boxKind: TemplateFrameBoxKind | '';
  role: TemplateFrameRole | 'group' | '';
  compact?: boolean;
}) => (
  <span className="v106-frame-kind-marker__stack" aria-hidden="true">
    <span
      className="v106-frame-kind-marker__pill"
      data-marker-pill="kind"
      data-marker-icon="kind"
      data-box-kind={boxKind || 'null'}
    >
      <span className="v106-frame-kind-marker__icon">
        <FrameKindIcon boxKind={boxKind} className="h-3 w-3" />
      </span>
      {!compact ? <span className="v106-frame-kind-marker__text">{boxKind ? FRAME_BOX_KIND_MARKER_LABELS[boxKind] : NULL_MARKER_LABEL}</span> : null}
    </span>
    <span
      className="v106-frame-kind-marker__pill"
      data-marker-pill="role"
      data-marker-icon="role"
      data-frame-role={role || 'null'}
    >
      <span className="v106-frame-kind-marker__icon">
        <FrameRoleIcon role={role} className="h-3 w-3" />
      </span>
      {!compact ? <span className="v106-frame-kind-marker__text">{role ? FRAME_ROLE_SHORT_LABELS[role] : NULL_MARKER_LABEL}</span> : null}
    </span>
  </span>
);

const renderFrameMetadataMarkerMarkup = (
  boxKind: TemplateFrameBoxKind | '',
  role: TemplateFrameRole | 'group' | '',
  compact = false
) => renderToStaticMarkup(<FrameMetadataMarker boxKind={boxKind} role={role} compact={compact} />);

const confirmPromoteKeyBoxToText = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.confirm('key 박스는 text 박스여야 합니다. text 박스로 업데이트하고 설정을 반영할까요?');
};

const confirmPromoteRuntimeMode = (frameGroupId: string, currentRuntimeMode: string, nextRuntimeMode: TemplateFrameRuntimeMode) => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.confirm(
    `${frameGroupId} 의 runtime mode ${currentRuntimeMode} 는 현재 박스 타입과 호환되지 않습니다.\n` +
      `호환 가능한 runtime mode(${nextRuntimeMode})로 변경할까요?`
  );
};

const MetadataCanvasLegend = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">범례</div>
    <div className="mt-2 grid gap-2 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Box Kind</div>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="text" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-teal-700" />
            <span>텍스트 박스</span>
          </div>
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="attachment" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-amber-700" />
            <span>첨부파일 박스</span>
          </div>
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="signature" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-rose-700" />
            <span>서명 박스</span>
          </div>
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-slate-500" />
            <span>null (미지정)</span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Role</div>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <FrameRoleIcon role="key" className="h-3.5 w-3.5" />
            </span>
            <span>상위 키</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 ring-1 ring-sky-200">
              <FrameRoleIcon role="value" className="h-3.5 w-3.5" />
            </span>
            <span>하위 값</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <FrameRoleIcon role="key_value" className="h-3.5 w-3.5" />
            </span>
            <span>독립 값</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-300">
              <FrameRoleIcon role="" className="h-3.5 w-3.5" />
            </span>
            <span>null (미지정)</span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">관계 강조</div>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border border-slate-300 opacity-50" />
            <span>기본 연결 상태</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border-2 border-slate-700" />
            <span>현재 선택 관계군</span>
          </div>
          <div className="text-[10px] leading-4 text-slate-500">같은 그룹의 key/value 박스는 선택 시 함께 선명해집니다.</div>
        </div>
      </div>
    </div>
  </div>
);
const FRAME_RUNTIME_MODE_LABELS: Record<TemplateFrameRuntimeMode, string> = {
  static_label: 'static_label | 고정 라벨',
  editable_text: 'editable_text | 텍스트 입력',
  file_slot: 'file_slot | 파일 업로드 슬롯',
  signature_image: 'signature_image | 서명 이미지',
  signature_history: 'signature_history | 서명 이력',
  signature_signer_name: 'signature_signer_name | 서명자 이름',
  signature_signed_at: 'signature_signed_at | 서명 시각',
  signature_provider: 'signature_provider | 인증 제공자',
  signature_status: 'signature_status | 서명 상태',
};
const FRAME_RUNTIME_MODE_DESCRIPTIONS: Record<TemplateFrameRuntimeMode, string> = {
  static_label: '문서에서 수정되지 않는 고정 텍스트 라벨로 사용합니다.',
  editable_text: '문서마다 사용자가 직접 입력하거나 수정하는 텍스트 값으로 사용합니다.',
  file_slot: '문서마다 파일을 업로드해 연결하는 슬롯입니다. 업로드 후에는 파일명과 파일 열기 동작을 가집니다.',
  signature_image: '서명 이미지만 출력하는 박스입니다. 실제 서명 이미지는 문서별 서명 데이터에서 가져옵니다.',
  signature_history: '서명 요청, 인증, 완료 같은 이력 로그를 출력하는 박스입니다.',
  signature_signer_name: '서명한 사람의 이름이나 표시명을 출력하는 박스입니다.',
  signature_signed_at: '실제 서명이 완료된 시각을 출력하는 박스입니다.',
  signature_provider: '본인확인 또는 서명 인증에 사용된 제공자 정보를 출력하는 박스입니다.',
  signature_status: '서명 대기, 완료, 실패 같은 현재 상태를 출력하는 박스입니다.',
};
const EDGE_DRAG_START_THRESHOLD_PX = 4;
const EDGE_DRAG_AUTOSNAP_THRESHOLD_PX = 5;
const EDGE_DRAG_AUTOSNAP_RELEASE_THRESHOLD_PX = 8;
const EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX = 1;
const FRAME_MARQUEE_DRAG_THRESHOLD_PX = 4;
const FRAME_CLUSTER_TOUCH_TOLERANCE_PX = 1.5;
const DEFAULT_RELATIVE_PAGE_ANCHORS: Record<string, TemplateFrameRelativeAnchorConfig> = {
  'band-0-header': {
    positionMode: 'relative',
    anchorKind: 'page-corner',
    anchorId: 'page-top-left',
    anchorX: 'left',
    anchorY: 'top',
    offsetX: 0,
    offsetY: 0,
  },
  'band-1-header': {
    positionMode: 'relative',
    anchorKind: 'page-corner',
    anchorId: 'page-top-right',
    anchorX: 'right',
    anchorY: 'top',
    offsetX: 0,
    offsetY: 0,
  },
};
const DEFAULT_ABSOLUTE_FRAME_GROUP_IDS = new Set(['band-19-footer']);
const PAGE_CORNER_ANCHOR_LABELS: Record<string, string> = {
  'page-top-left': '페이지 좌상단 기준',
  'page-top-right': '페이지 우상단 기준',
  'page-bottom-left': '페이지 좌하단 기준',
  'page-bottom-right': '페이지 우하단 기준',
};

const defaultSelectionStyleDraft: SelectionStyleDraft = {
  width: '',
  height: '',
  fontSize: '',
  lineHeight: '',
  paddingX: '',
  paddingY: '',
  borderRadius: '',
  fontWeight: '',
  textAlign: 'left',
  color: '#0f172a',
  backgroundColor: 'transparent',
};

const defaultStyleFieldApplyStatus: Record<StyleFieldKey, StyleFieldApplyState> = {
  width: 'idle',
  height: 'idle',
  fontSize: 'idle',
  lineHeight: 'idle',
  paddingX: 'idle',
  paddingY: 'idle',
  borderRadius: 'idle',
  fontWeight: 'idle',
  textAlign: 'idle',
  color: 'idle',
  backgroundColor: 'idle',
};

const defaultFrameMetadataDraft: FrameMetadataDraft = {
  boxKind: '',
  role: '',
  valueKey: '',
  parentGroupId: '',
  runtimeMode: '',
};

const isTemplateFrameBoxKind = (value: string | null | undefined): value is TemplateFrameBoxKind =>
  TEMPLATE_FRAME_BOX_KIND_OPTIONS.includes(String(value || '').trim() as TemplateFrameBoxKind);

const isTemplateFrameRole = (value: string | null | undefined): value is TemplateFrameRole =>
  (['group', ...TEMPLATE_FRAME_ROLE_OPTIONS] as const).includes(String(value || '').trim() as TemplateFrameRole | 'group');

const isTemplateFrameRuntimeMode = (value: string | null | undefined): value is TemplateFrameRuntimeMode =>
  [...TEXT_RUNTIME_MODE_OPTIONS, ...ATTACHMENT_RUNTIME_MODE_OPTIONS, ...SIGNATURE_RUNTIME_MODE_OPTIONS].includes(
    String(value || '').trim() as TemplateFrameRuntimeMode
  );

const normalizeFrameValueKey = (value: string) =>
  value
    .split('>')
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' > ');

const normalizeVirtualDefinitionId = (value: string) => {
  const base = value.trim();
  if (!base) {
    return '';
  }

  return base
    .toLowerCase()
    .replace(/[^\w\-가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const parseVirtualFrameDefinitions = (raw: string | null | undefined): VirtualFrameDefinition[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const id = normalizeVirtualDefinitionId(String((entry as { id?: unknown }).id || ''));
        const label = String((entry as { label?: unknown }).label || '').trim();

        if (!id || !label) {
          return null;
        }

        return { id, label };
      })
      .filter((entry): entry is VirtualFrameDefinition => Boolean(entry));
  } catch {
    return [];
  }
};

const stringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const getCompatibleRuntimeModes = (boxKind: TemplateFrameBoxKind) => {
  if (boxKind === 'attachment') {
    return ATTACHMENT_RUNTIME_MODE_OPTIONS;
  }

  if (boxKind === 'signature') {
    return SIGNATURE_RUNTIME_MODE_OPTIONS;
  }

  return TEXT_RUNTIME_MODE_OPTIONS;
};

const getAllRuntimeModes = () => [...TEXT_RUNTIME_MODE_OPTIONS, ...ATTACHMENT_RUNTIME_MODE_OPTIONS, ...SIGNATURE_RUNTIME_MODE_OPTIONS];

const getDefaultRuntimeMode = (boxKind: TemplateFrameBoxKind, role: TemplateFrameRole | 'group') => {
  if (boxKind === 'attachment') {
    return 'file_slot' as const;
  }

  if (boxKind === 'signature') {
    return 'signature_image' as const;
  }

  return role === 'key' ? ('static_label' as const) : ('editable_text' as const);
};

const isStatusHistoryFrameNode = (node: HTMLElement | null | undefined) => {
  if (!node) {
    return false;
  }

  const frameGroupId = getFrameGroupId(node);
  const valueKey = normalizeFrameValueKey(node.getAttribute(TEMPLATE_FRAME_VALUE_KEY_ATTR) || '');
  const colorGroup = node.getAttribute(TEMPLATE_FRAME_COLOR_GROUP_ATTR)?.trim() || '';

  return frameGroupId.startsWith('status-history-') || valueKey === '상태 이력' || colorGroup === '상태 이력';
};

const resolvePersistedFrameNode = (node: HTMLElement | null | undefined) => {
  if (!node) {
    return null;
  }

  if (node.matches(RAW_FRAME_NODE_SELECTOR)) {
    return node;
  }

  const frameGroupId = getFrameGroupId(node);
  const exactMatch = frameGroupId
    ? node.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
    : null;

  if (exactMatch) {
    return exactMatch;
  }

  return node.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) || null;
};

const readFrameMetadataAttr = (node: HTMLElement, attrName: string) => {
  const directValue = node.getAttribute(attrName)?.trim() || '';

  if (directValue) {
    return directValue;
  }

  const persistedFrameNode = resolvePersistedFrameNode(node);
  const persistedValue = persistedFrameNode?.getAttribute(attrName)?.trim() || '';

  if (persistedValue) {
    return persistedValue;
  }

  return node.querySelector<HTMLElement>('[data-template-frame-input="true"]')?.getAttribute(attrName)?.trim() || '';
};

const readFrameBoxKind = (node: HTMLElement) => {
  const explicitBoxKind = readFrameMetadataAttr(node, TEMPLATE_FRAME_BOX_KIND_ATTR);

  if (isTemplateFrameBoxKind(explicitBoxKind)) {
    return explicitBoxKind;
  }

  return '' as const;
};

const readFrameRole = (node: HTMLElement) => {
  const explicitRole = readFrameMetadataAttr(node, TEMPLATE_FRAME_ROLE_ATTR);

  if (explicitRole === 'group' || TEMPLATE_FRAME_ROLE_OPTIONS.includes(explicitRole as TemplateFrameRole)) {
    return explicitRole as TemplateFrameRole | 'group';
  }

  return '' as const;
};

const readFrameValueKey = (node: HTMLElement) =>
  normalizeFrameValueKey(readFrameMetadataAttr(node, TEMPLATE_FRAME_VALUE_KEY_ATTR));

const readFrameParentGroupId = (node: HTMLElement) => readFrameMetadataAttr(node, TEMPLATE_FRAME_PARENT_GROUP_ATTR);

const readFrameRuntimeMode = (node: HTMLElement) => {
  const boxKind = readFrameBoxKind(node);
  const explicitRuntimeMode = readFrameMetadataAttr(node, TEMPLATE_FRAME_RUNTIME_MODE_ATTR);

  if (!isTemplateFrameRuntimeMode(explicitRuntimeMode)) {
    return '' as const;
  }

  if (!boxKind) {
    return explicitRuntimeMode;
  }

  if (getCompatibleRuntimeModes(boxKind).includes(explicitRuntimeMode)) {
    return explicitRuntimeMode;
  }

  return '' as const;
};

const buildFrameMetadataChangePatch = (nextDraft: FrameMetadataDraft, previousDraft: FrameMetadataDraft): FrameMetadataPatch => {
  const normalizedNextValueKey = normalizeFrameValueKey(nextDraft.valueKey);
  const normalizedPreviousValueKey = normalizeFrameValueKey(previousDraft.valueKey);
  const normalizedNextParentGroupId = nextDraft.parentGroupId.trim();
  const normalizedPreviousParentGroupId = previousDraft.parentGroupId.trim();

  return {
    boxKind:
      nextDraft.boxKind !== previousDraft.boxKind && isTemplateFrameBoxKind(nextDraft.boxKind)
        ? nextDraft.boxKind
        : undefined,
    role:
      nextDraft.role !== previousDraft.role && isTemplateFrameRole(nextDraft.role)
        ? nextDraft.role
        : undefined,
    valueKey: normalizedNextValueKey !== normalizedPreviousValueKey ? normalizedNextValueKey : undefined,
    parentGroupId:
      normalizedNextParentGroupId !== normalizedPreviousParentGroupId ? normalizedNextParentGroupId : undefined,
    runtimeMode:
      nextDraft.runtimeMode !== previousDraft.runtimeMode && isTemplateFrameRuntimeMode(nextDraft.runtimeMode)
        ? nextDraft.runtimeMode
        : undefined,
  };
};

const resolveNextFrameMetadata = (node: HTMLElement, patch: FrameMetadataPatch): ResolvedFrameMetadata => {
  const boxKind = patch.boxKind || readFrameBoxKind(node);
  const role = patch.role || readFrameRole(node);
  const valueKey = patch.valueKey !== undefined ? normalizeFrameValueKey(patch.valueKey) : readFrameValueKey(node);
  const parentGroupId = patch.parentGroupId !== undefined ? patch.parentGroupId.trim() : readFrameParentGroupId(node);
  const runtimeMode = patch.runtimeMode || readFrameRuntimeMode(node);

  return {
    boxKind,
    role,
    valueKey,
    parentGroupId,
    runtimeMode,
  };
};

const hasFrameParentCycle = (
  frameGroupId: string,
  requestedParentGroupId: string,
  frameNodeById: Map<string, HTMLElement>
) => {
  let cursor = requestedParentGroupId;
  const visited = new Set<string>([frameGroupId]);

  while (cursor) {
    if (visited.has(cursor)) {
      return true;
    }

    visited.add(cursor);
    const parentNode = frameNodeById.get(cursor);

    if (!parentNode || readFrameRole(parentNode) !== 'value') {
      return false;
    }

    cursor = readFrameParentGroupId(parentNode);
  }

  return false;
};

const hasResolvedFrameParentCycle = (
  frameGroupId: string,
  requestedParentGroupId: string,
  metadataById: Map<string, ResolvedFrameMetadata>
) => {
  let cursor = requestedParentGroupId;
  const visited = new Set<string>([frameGroupId]);

  while (cursor) {
    if (visited.has(cursor)) {
      return true;
    }

    visited.add(cursor);
    const parentMetadata = metadataById.get(cursor);

    if (!parentMetadata || parentMetadata.role !== 'value') {
      return false;
    }

    cursor = parentMetadata.parentGroupId;
  }

  return false;
};

const applyFrameMetadataPatch = (node: HTMLElement, patch: FrameMetadataPatch) => {
  const persistedFrameNode = resolvePersistedFrameNode(node);
  const textarea =
    node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]') ||
    persistedFrameNode?.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]') ||
    null;
  const targets = Array.from(new Set([node, persistedFrameNode, textarea].filter(Boolean))) as HTMLElement[];

  targets.forEach((target) => {
    if (patch.boxKind !== undefined) {
      target.setAttribute(TEMPLATE_FRAME_BOX_KIND_ATTR, patch.boxKind);
    }

    if (patch.role !== undefined) {
      target.setAttribute(TEMPLATE_FRAME_ROLE_ATTR, patch.role);
    }

    if (patch.valueKey !== undefined) {
      const nextValueKey = normalizeFrameValueKey(patch.valueKey);

      if (nextValueKey) {
        target.setAttribute(TEMPLATE_FRAME_VALUE_KEY_ATTR, nextValueKey);
      } else {
        target.removeAttribute(TEMPLATE_FRAME_VALUE_KEY_ATTR);
      }
    }

    if (patch.parentGroupId !== undefined) {
      const parentGroupId = patch.parentGroupId.trim();

      if (parentGroupId) {
        target.setAttribute(TEMPLATE_FRAME_PARENT_GROUP_ATTR, parentGroupId);
      } else {
        target.removeAttribute(TEMPLATE_FRAME_PARENT_GROUP_ATTR);
      }
    }

    if (patch.runtimeMode !== undefined) {
      if (patch.runtimeMode.trim()) {
        target.setAttribute(TEMPLATE_FRAME_RUNTIME_MODE_ATTR, patch.runtimeMode);
      } else {
        target.removeAttribute(TEMPLATE_FRAME_RUNTIME_MODE_ATTR);
      }
    }
  });
};

const normalizeEdgeSelectionState = (state: TemplateEdgeSelectionStateDto): TemplateEdgeSelectionStateDto => ({
  primaryTokenId: state.primaryTokenId,
  tokens: state.tokens.map((token) => ({
    ...token,
    memberEdgeIds: token.memberEdgeIds.slice().sort(),
  })),
});

const edgeSelectionStatesEqual = (
  left: TemplateEdgeSelectionStateDto,
  right: TemplateEdgeSelectionStateDto
) => JSON.stringify(normalizeEdgeSelectionState(left)) === JSON.stringify(normalizeEdgeSelectionState(right));

const frameSelectionIdsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const edgeRoleDiagnosticsStatesEqual = (left: EdgeRoleDiagnosticsState, right: EdgeRoleDiagnosticsState) =>
  frameSelectionIdsEqual(left.selectedEdgeClickedIds, right.selectedEdgeClickedIds) &&
  frameSelectionIdsEqual(left.selectedEdgeAutoMultiIds, right.selectedEdgeAutoMultiIds) &&
  frameSelectionIdsEqual(left.peerEdgeIds, right.peerEdgeIds) &&
  frameSelectionIdsEqual(left.mismatchEdgeIds, right.mismatchEdgeIds);

const presetStylePatches: Record<string, FrameStylePatch> = {
  label: {
    fontSize: '12',
    fontWeight: '600',
    lineHeight: '1.35',
    paddingX: '2',
    paddingY: '2',
    borderRadius: '4',
    textAlign: 'left',
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
  input: {
    fontSize: '13',
    fontWeight: '500',
    lineHeight: '1.45',
    paddingX: '6',
    paddingY: '4',
    borderRadius: '8',
    textAlign: 'left',
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
  body: {
    fontSize: '14',
    fontWeight: '400',
    lineHeight: '1.55',
    paddingX: '4',
    paddingY: '3',
    borderRadius: '4',
    textAlign: 'left',
    color: '#1e293b',
    backgroundColor: 'transparent',
  },
  focus: {
    fontSize: '14',
    fontWeight: '700',
    lineHeight: '1.45',
    paddingX: '6',
    paddingY: '4',
    borderRadius: '10',
    textAlign: 'center',
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
};

const FRAME_RESIZE_TOLERANCE_PX = 2;
const MIN_FRAME_SIZE_PX = 12;
const MIN_TABLE_COLUMN_WIDTH_PX = MIN_FRAME_SIZE_PX;
const MIN_TABLE_ROW_HEIGHT_PX = 12;
const MIN_WRITABLE_TABLE_SIZE_PX = 1;
const FRAME_SCAFFOLD_TRACK_THRESHOLD_PX = 4;
const NORMALIZED_FRAME_BAND_ATTR = 'data-v106-normalized-band';
const NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR = 'data-v106-band-range';
const NORMALIZED_FRAME_BAND_COL_RANGE_ATTR = 'data-v106-band-col-range';
const NORMALIZED_FRAME_BAND_SOURCE_ATTR = 'data-v106-band-source';

const parseFramePx = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const readFirstFiniteFramePx = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const parsed = parseFramePx(value);

    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
};

const readPreviewSourceRect = (root: HTMLElement) => {
  const primaryPageInner =
    root.querySelector<HTMLElement>(':scope > .page-inner') || root.querySelector<HTMLElement>('.page-inner');
  const primaryPage =
    root.querySelector<HTMLElement>(':scope > section.page') || root.querySelector<HTMLElement>('section.page');
  const sourceNode = primaryPageInner || primaryPage;

  if (!sourceNode) {
    return null;
  }

  const computedStyle = getComputedStyle(sourceNode);
  const width =
    readFirstFiniteFramePx(
      primaryPageInner?.style.width,
      primaryPage?.style.width,
      sourceNode.style.width,
      computedStyle.width
    ) || Math.max(1, sourceNode.scrollWidth || sourceNode.getBoundingClientRect().width);
  const height =
    readFirstFiniteFramePx(
      primaryPageInner?.style.minHeight,
      primaryPageInner?.style.height,
      primaryPage?.style.minHeight,
      primaryPage?.style.height,
      sourceNode.style.minHeight,
      sourceNode.style.height,
      computedStyle.minHeight,
      computedStyle.height
    ) || Math.max(1, sourceNode.scrollHeight || sourceNode.getBoundingClientRect().height);

  return { width, height };
};

const toFrameCssPx = (value: number) => `${Number(value.toFixed(3))}px`;

const resolveFrameLayoutShell = (node: HTMLElement) => node.closest<HTMLElement>('.v102-frame-band') || node;

const resolveFrameLayoutTable = (node: HTMLElement) => {
  const shell = resolveFrameLayoutShell(node);
  return shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || node.closest<HTMLTableElement>('table');
};

const readFrameElementRect = (element: HTMLElement, pageInner?: HTMLElement | null): FrameNodeRect => {
  const resolvedPageInner = pageInner || element.closest<HTMLElement>('.page-inner');
  const pageRect = resolvedPageInner?.getBoundingClientRect() || null;
  const elementRect = element.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const hasInlineLeft = element.style.left.trim() !== '';
  const hasInlineTop = element.style.top.trim() !== '';
  const hasInlineWidth = element.style.width.trim() !== '';
  const hasInlineHeight = element.style.height.trim() !== '';

  return {
    left: hasInlineLeft ? parseFramePx(element.style.left) : Math.max(0, elementRect.left - (pageRect?.left || 0)),
    top: hasInlineTop ? parseFramePx(element.style.top) : Math.max(0, elementRect.top - (pageRect?.top || 0)),
    width: Math.max(1, hasInlineWidth ? parseFramePx(element.style.width) : parseFramePx(computedStyle.width) || elementRect.width),
    height: Math.max(
      1,
      hasInlineHeight ? parseFramePx(element.style.height) : parseFramePx(computedStyle.height) || elementRect.height
    ),
  };
};

const readFrameMoveRect = (node: HTMLElement): FrameNodeRect => readFrameElementRect(resolveFrameLayoutShell(node));

const isAbsolutePositionedShell = (shell: HTMLElement | null | undefined) =>
  shell?.getAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR) === 'absolute';

const readPageInnerPointerPoint = (
  pageInner: HTMLElement,
  clientX: number,
  clientY: number,
  scale: number
) => {
  const rect = pageInner.getBoundingClientRect();
  const nextX = Math.max(0, Math.min(pageInner.clientWidth, (clientX - rect.left) / Math.max(scale, 0.01)));
  const nextY = Math.max(0, Math.min(pageInner.clientHeight, (clientY - rect.top) / Math.max(scale, 0.01)));

  return {
    x: nextX,
    y: nextY,
  };
};

const buildPointerDragRect = (
  origin: { x: number; y: number },
  current: { x: number; y: number }
): FrameNodeRect => ({
  left: Math.min(origin.x, current.x),
  top: Math.min(origin.y, current.y),
  width: Math.abs(current.x - origin.x),
  height: Math.abs(current.y - origin.y),
});

const rectContainsRect = (outer: FrameNodeRect, inner: FrameNodeRect) =>
  inner.left >= outer.left - FRAME_RESIZE_TOLERANCE_PX &&
  inner.top >= outer.top - FRAME_RESIZE_TOLERANCE_PX &&
  inner.left + inner.width <= outer.left + outer.width + FRAME_RESIZE_TOLERANCE_PX &&
  inner.top + inner.height <= outer.top + outer.height + FRAME_RESIZE_TOLERANCE_PX;

const rectIntersectsRect = (left: FrameNodeRect, right: FrameNodeRect) =>
  left.left < right.left + right.width - FRAME_RESIZE_TOLERANCE_PX &&
  left.left + left.width > right.left + FRAME_RESIZE_TOLERANCE_PX &&
  left.top < right.top + right.height - FRAME_RESIZE_TOLERANCE_PX &&
  left.top + left.height > right.top + FRAME_RESIZE_TOLERANCE_PX;

const collectTopLevelPositionGroupsWithRects = (pageInner: HTMLElement): PositionGroupWithRect[] => {
  const frameNodes = collectFrameSelectionAnchors(pageInner).filter(
    (node) => node.closest<HTMLElement>('.page-inner') === pageInner
  );
  const frameNodeById = new Map<string, HTMLElement>();

  frameNodes.forEach((frameNode) => {
    const frameGroupId = getFrameGroupId(frameNode);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, frameNode);
    }
  });

  const rawGroups = collectPositionBoxGroups(pageInner, { includeSingletons: false })
    .map((group) => {
      const frameGroupIds = Array.from(
        new Set(
          group.frameGroupIds
            .map((frameGroupId) => frameGroupId.trim())
            .filter((frameGroupId) => Boolean(frameGroupId) && frameNodeById.has(frameGroupId))
        )
      );

      if (frameGroupIds.length <= 1) {
        return null;
      }

      const memberRects = frameGroupIds
        .map((frameGroupId) => {
          const frameNode = frameNodeById.get(frameGroupId) || null;
          return frameNode ? readFrameMoveRect(frameNode) : null;
        })
        .filter((rect): rect is FrameNodeRect => Boolean(rect));

      if (memberRects.length <= 0) {
        return null;
      }

      const minLeft = Math.min(...memberRects.map((rect) => rect.left));
      const minTop = Math.min(...memberRects.map((rect) => rect.top));
      const maxRight = Math.max(...memberRects.map((rect) => rect.left + rect.width));
      const maxBottom = Math.max(...memberRects.map((rect) => rect.top + rect.height));

      return {
        group,
        frameGroupIds,
        frameGroupIdSet: new Set(frameGroupIds),
        rect: {
          left: minLeft,
          top: minTop,
          width: Math.max(1, maxRight - minLeft),
          height: Math.max(1, maxBottom - minTop),
        },
      } as PositionGroupWithRect;
    })
    .filter((groupWithRect): groupWithRect is PositionGroupWithRect => Boolean(groupWithRect));

  if (rawGroups.length <= 0) {
    return [];
  }

  const topLevelGroups = rawGroups.filter((candidate) => {
    return !rawGroups.some((other) => {
      if (other.group.id === candidate.group.id) {
        return false;
      }

      if (other.frameGroupIds.length <= candidate.frameGroupIds.length) {
        return false;
      }

      return candidate.frameGroupIds.every((frameGroupId) => other.frameGroupIdSet.has(frameGroupId));
    });
  });

  const dedupedByMembers = new Map<string, PositionGroupWithRect>();
  topLevelGroups.forEach((groupWithRect) => {
    const memberKey = groupWithRect.frameGroupIds.slice().sort((left, right) => left.localeCompare(right, 'ko')).join('|');
    if (!dedupedByMembers.has(memberKey)) {
      dedupedByMembers.set(memberKey, groupWithRect);
    }
  });

  return Array.from(dedupedByMembers.values());
};

const createFrameEditorGhost = (
  className: string,
  mode?: FrameMarqueeSelectionMode
) => {
  const ghost = document.createElement('div');
  ghost.className = className;
  ghost.setAttribute('aria-hidden', 'true');

  if (mode) {
    ghost.setAttribute('data-marquee-mode', mode);
  }

  return ghost;
};

const writeFrameEditorGhostRect = (ghost: HTMLElement, rect: FrameNodeRect) => {
  ghost.style.left = toFrameCssPx(rect.left);
  ghost.style.top = toFrameCssPx(rect.top);
  ghost.style.width = toFrameCssPx(rect.width);
  ghost.style.height = toFrameCssPx(rect.height);
};

const removeFrameEditorGhost = (ghost: HTMLElement | null | undefined) => {
  if (ghost?.parentElement) {
    ghost.parentElement.removeChild(ghost);
  }
};

const buildCreatedFrameGroupId = (root: ParentNode) => {
  const matches = Array.from(root.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR))
    .map((node) => getFrameGroupId(node))
    .map((frameGroupId) => frameGroupId.match(new RegExp(`^${CREATED_FRAME_GROUP_PREFIX}-(\\d+)$`)))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value));
  const nextIndex = (matches.length ? Math.max(...matches) : 0) + 1;
  return `${CREATED_FRAME_GROUP_PREFIX}-${nextIndex}`;
};

const buildCreatedFrameShell = ({
  pageInner,
  rect,
  frameGroupId,
  positionMode,
}: {
  pageInner: HTMLElement;
  rect: FrameNodeRect;
  frameGroupId: string;
  positionMode: TemplateFramePositionMode;
}) => {
  const pageId =
    pageInner.getAttribute('data-page')?.trim() ||
    pageInner.closest<HTMLElement>('[data-page]')?.getAttribute('data-page')?.trim() ||
    '1';
  const shell = document.createElement('div');
  shell.className = 'v102-frame-band';
  shell.setAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR, positionMode);
  shell.style.left = toFrameCssPx(rect.left);
  shell.style.top = toFrameCssPx(rect.top);
  shell.style.width = toFrameCssPx(Math.max(MIN_FRAME_SIZE_PX, rect.width));
  shell.style.height = toFrameCssPx(Math.max(MIN_FRAME_SIZE_PX, rect.height));

  const table = document.createElement('table');
  table.className = 'v202-table-block v102-frame-band-table';
  table.style.width = shell.style.width;
  table.style.height = shell.style.height;

  const colgroup = document.createElement('colgroup');
  const col = document.createElement('col');
  col.style.width = shell.style.width;
  colgroup.appendChild(col);
  table.appendChild(colgroup);

  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  row.style.height = shell.style.height;
  const cell = document.createElement('td');
  cell.className = 'halign-left valign-top v202-frame-group';
  cell.setAttribute('data-template-frame-group', frameGroupId);
  cell.setAttribute('data-template-frame-color-group', frameGroupId);
  cell.setAttribute('data-template-frame-source-text', '');
  cell.setAttribute('data-template-frame-outline-style', 'solid');
  cell.setAttribute('data-template-frame-row-start', '1');
  cell.setAttribute('data-template-frame-row-end', '2');
  cell.setAttribute('data-template-frame-col-start', '1');
  cell.setAttribute('data-template-frame-col-end', '2');
  cell.setAttribute('data-template-frame-halign', 'left');
  cell.setAttribute('data-template-frame-valign', 'top');
  cell.setAttribute('data-template-frame-page', pageId);
  cell.setAttribute('data-template-frame-extracted-text', '');
  cell.setAttribute('data-template-frame-display-visible', 'true');
  cell.setAttribute('data-template-frame-needs-review', 'false');
  cell.setAttribute(TEMPLATE_FRAME_BOX_KIND_ATTR, 'text');
  cell.setAttribute(TEMPLATE_FRAME_ROLE_ATTR, 'key_value');
  cell.setAttribute(TEMPLATE_FRAME_RUNTIME_MODE_ATTR, 'editable_text');
  cell.setAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR, positionMode);

  const textarea = document.createElement('textarea');
  textarea.className = 'v202-frame-group-input';
  textarea.setAttribute('spellcheck', 'false');
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('tabindex', '-1');
  textarea.setAttribute('data-template-frame-input', 'true');
  textarea.setAttribute('data-template-frame-group', frameGroupId);
  textarea.setAttribute('data-template-frame-color-group', frameGroupId);
  textarea.setAttribute('data-template-frame-source-text', '');
  textarea.setAttribute('data-template-frame-outline-style', 'solid');
  textarea.setAttribute('data-template-frame-halign', 'left');
  textarea.setAttribute('data-template-frame-valign', 'top');
  textarea.setAttribute('data-template-frame-page', pageId);
  textarea.setAttribute('data-template-frame-extracted-text', '');
  textarea.setAttribute('data-template-frame-display-visible', 'true');
  textarea.setAttribute('data-template-frame-needs-review', 'false');
  textarea.setAttribute(TEMPLATE_FRAME_BOX_KIND_ATTR, 'text');
  textarea.setAttribute(TEMPLATE_FRAME_ROLE_ATTR, 'key_value');
  textarea.setAttribute(TEMPLATE_FRAME_RUNTIME_MODE_ATTR, 'editable_text');
  textarea.setAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR, positionMode);
  textarea.value = '';
  textarea.textContent = '';

  cell.appendChild(textarea);
  row.appendChild(cell);
  tbody.appendChild(row);
  table.appendChild(tbody);
  shell.appendChild(table);

  return shell;
};

const readStoredRelativeAnchorConfig = (element: HTMLElement | null | undefined): TemplateFrameRelativeAnchorConfig | null => {
  if (!element) {
    return null;
  }

  const positionMode = element.getAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR)?.trim();
  const anchorKind = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR)?.trim();
  const anchorId = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR)?.trim();
  const anchorX = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR)?.trim();
  const anchorY = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR)?.trim();
  const offsetX = Number.parseFloat(element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR) || '');
  const offsetY = Number.parseFloat(element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR) || '');

  if (
    positionMode !== 'relative' ||
    (anchorKind !== 'frame' && anchorKind !== 'page-corner' && anchorKind !== 'group') ||
    !anchorId ||
    (anchorX !== 'left' && anchorX !== 'right') ||
    (anchorY !== 'top' && anchorY !== 'bottom') ||
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY)
  ) {
    return null;
  }

  return {
    positionMode,
    anchorKind,
    anchorId,
    anchorX,
    anchorY,
    offsetX,
    offsetY,
  };
};

const getRelativeAnchorAttributeTargets = (frameNode: HTMLElement | null | undefined) => {
  if (!frameNode) {
    return [];
  }

  const shell = resolveFrameLayoutShell(frameNode);
  const textarea = shell.querySelector<HTMLElement>('[data-template-frame-input="true"]');

  return [shell, frameNode, textarea].filter((element): element is HTMLElement => Boolean(element));
};

const writeFramePositionModeAttrs = (
  frameNode: HTMLElement | null | undefined,
  positionMode: TemplateFramePositionMode
) => {
  getRelativeAnchorAttributeTargets(frameNode).forEach((element) => {
    element.setAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR, positionMode);
  });
};

const clearFrameRelativeAnchorAttrs = (frameNode: HTMLElement | null | undefined) => {
  getRelativeAnchorAttributeTargets(frameNode).forEach((element) => {
    element.removeAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR);
    element.removeAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR);
  });
};

const readStoredPositionGroupConfig = (
  element: HTMLElement | null | undefined
): TemplateFramePositionGroupConfig | null => {
  if (!element) {
    return null;
  }

  const groupId = element.getAttribute(TEMPLATE_FRAME_POSITION_GROUP_ID_ATTR)?.trim() || '';

  if (!groupId) {
    return null;
  }

  return {
    groupId,
    label: element.getAttribute(TEMPLATE_FRAME_POSITION_GROUP_LABEL_ATTR)?.trim() || '',
    managed: element.getAttribute(TEMPLATE_FRAME_POSITION_GROUP_MANAGED_ATTR) === 'true',
  };
};

const readFramePositionGroupConfig = (
  frameNode: HTMLElement | null | undefined
): TemplateFramePositionGroupConfig | null => {
  if (!frameNode) {
    return null;
  }

  const shell = resolveFrameLayoutShell(frameNode);
  const textarea = shell.querySelector<HTMLElement>('[data-template-frame-input="true"]');

  return (
    readStoredPositionGroupConfig(frameNode) ||
    readStoredPositionGroupConfig(shell) ||
    readStoredPositionGroupConfig(textarea)
  );
};

const writeFramePositionGroupAttrs = (
  frameNode: HTMLElement | null | undefined,
  config: Omit<TemplateFramePositionGroupConfig, 'managed'> & { managed?: boolean } | null
) => {
  const targets = getRelativeAnchorAttributeTargets(frameNode);

  if (!config) {
    targets.forEach((element) => {
      element.removeAttribute(TEMPLATE_FRAME_POSITION_GROUP_ID_ATTR);
      element.removeAttribute(TEMPLATE_FRAME_POSITION_GROUP_LABEL_ATTR);
      element.removeAttribute(TEMPLATE_FRAME_POSITION_GROUP_MANAGED_ATTR);
    });
    return;
  }

  targets.forEach((element) => {
    element.setAttribute(TEMPLATE_FRAME_POSITION_GROUP_ID_ATTR, config.groupId);
    if (config.label.trim()) {
      element.setAttribute(TEMPLATE_FRAME_POSITION_GROUP_LABEL_ATTR, config.label.trim());
    } else {
      element.removeAttribute(TEMPLATE_FRAME_POSITION_GROUP_LABEL_ATTR);
    }
    element.setAttribute(TEMPLATE_FRAME_POSITION_GROUP_MANAGED_ATTR, config.managed ? 'true' : 'false');
  });
};

const resolvePreferredRelativeAnchorPins = (
  frameRect: FrameNodeRect,
  anchorRect: FrameNodeRect
): {
  preferredAnchorX?: TemplateFrameRelativeHorizontalPin;
  preferredAnchorY?: TemplateFrameRelativeVerticalPin;
} => {
  const anchorLeft = anchorRect.left;
  const anchorRight = anchorRect.left + anchorRect.width;
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;
  const frameRight = frameRect.left + frameRect.width;
  const frameBottom = frameRect.top + frameRect.height;
  const tolerance = FRAME_RESIZE_TOLERANCE_PX;

  let preferredAnchorX: TemplateFrameRelativeHorizontalPin | undefined;
  let preferredAnchorY: TemplateFrameRelativeVerticalPin | undefined;

  if (frameRect.left >= anchorRight - tolerance) {
    preferredAnchorX = 'right';
  } else if (frameRight <= anchorLeft + tolerance) {
    preferredAnchorX = 'left';
  }

  if (frameRect.top >= anchorBottom - tolerance) {
    preferredAnchorY = 'bottom';
  } else if (frameBottom <= anchorTop + tolerance) {
    preferredAnchorY = 'top';
  }

  return {
    preferredAnchorX,
    preferredAnchorY,
  };
};

const resolveNearestPageCornerRelativeAnchorConfig = (
  frameNode: HTMLElement,
  pageInner: HTMLElement
): TemplateFrameRelativeAnchorConfig => {
  const frameRect = readFrameMoveRect(frameNode);
  const pageRect = {
    left: 0,
    top: 0,
    width: pageInner.clientWidth,
    height: pageInner.clientHeight,
  };
  const candidates: Array<{
    anchorId: TemplateFrameRelativeAnchorId;
    anchorX: TemplateFrameRelativeHorizontalPin;
    anchorY: TemplateFrameRelativeVerticalPin;
    distance: number;
  }> = [
    {
      anchorId: 'page-top-left',
      anchorX: 'left',
      anchorY: 'top',
      distance: Math.abs(frameRect.left) + Math.abs(frameRect.top),
    },
    {
      anchorId: 'page-top-right',
      anchorX: 'right',
      anchorY: 'top',
      distance: Math.abs(pageRect.width - (frameRect.left + frameRect.width)) + Math.abs(frameRect.top),
    },
    {
      anchorId: 'page-bottom-left',
      anchorX: 'left',
      anchorY: 'bottom',
      distance: Math.abs(frameRect.left) + Math.abs(pageRect.height - (frameRect.top + frameRect.height)),
    },
    {
      anchorId: 'page-bottom-right',
      anchorX: 'right',
      anchorY: 'bottom',
      distance:
        Math.abs(pageRect.width - (frameRect.left + frameRect.width)) +
        Math.abs(pageRect.height - (frameRect.top + frameRect.height)),
    },
  ].sort((left, right) => left.distance - right.distance);
  const nearest = candidates[0];
  const anchorRect = resolvePageCornerAnchorRect(pageInner, nearest.anchorId) || {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };

  return buildRelativeAnchorConfigFromRect({
    frameRect,
    anchorRect,
    anchorKind: 'page-corner',
    anchorId: nearest.anchorId,
    preferredAnchorX: nearest.anchorX,
    preferredAnchorY: nearest.anchorY,
  });
};

const writeFrameRelativeAnchorAttrs = (
  frameNode: HTMLElement | null | undefined,
  config: TemplateFrameRelativeAnchorConfig | null
) => {
  if (!frameNode) {
    return;
  }

  if (!config || config.positionMode !== 'relative') {
    clearFrameRelativeAnchorAttrs(frameNode);
    return;
  }

  getRelativeAnchorAttributeTargets(frameNode).forEach((element) => {
    element.setAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR, config.positionMode);
    element.setAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR, config.anchorKind);
    element.setAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR, config.anchorId);
    element.setAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR, config.anchorX);
    element.setAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR, config.anchorY);
    element.setAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR, String(Number(config.offsetX.toFixed(3))));
    element.setAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR, String(Number(config.offsetY.toFixed(3))));
  });
};

const resolvePageCornerAnchorRect = (
  pageInner: HTMLElement,
  anchorId: TemplateFrameRelativeAnchorId
): FrameNodeRect | null => {
  const width = pageInner.clientWidth;
  const height = pageInner.clientHeight;

  switch (anchorId) {
    case 'page-top-left':
      return { left: 0, top: 0, width: 0, height: 0 };
    case 'page-top-right':
      return { left: width, top: 0, width: 0, height: 0 };
    case 'page-bottom-left':
      return { left: 0, top: height, width: 0, height: 0 };
    case 'page-bottom-right':
      return { left: width, top: height, width: 0, height: 0 };
    default:
      return null;
  }
};

const resolveRelativeAnchorRect = (
  pageInner: HTMLElement,
  config: TemplateFrameRelativeAnchorConfig
): FrameNodeRect | null => {
  if (config.anchorKind === 'page-corner') {
    return resolvePageCornerAnchorRect(pageInner, config.anchorId);
  }

  if (config.anchorKind === 'group') {
    const targetGroupId = String(config.anchorId || '').trim();

    if (!targetGroupId) {
      return null;
    }

    const positionGroups = collectPositionBoxGroups(pageInner, { includeSingletons: true });
    const targetGroup = positionGroups.find((group) => group.id === targetGroupId);

    if (!targetGroup || targetGroup.frameGroupIds.length <= 0) {
      return null;
    }

    const memberRects = targetGroup.frameGroupIds
      .map((frameGroupId) => {
        const memberNode = resolveFrameSelectionAnchor(
          pageInner.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
        );
        return memberNode ? readFrameMoveRect(memberNode) : null;
      })
      .filter((rect): rect is FrameNodeRect => Boolean(rect));

    if (memberRects.length <= 0) {
      return null;
    }

    const minLeft = Math.min(...memberRects.map((rect) => rect.left));
    const minTop = Math.min(...memberRects.map((rect) => rect.top));
    const maxRight = Math.max(...memberRects.map((rect) => rect.left + rect.width));
    const maxBottom = Math.max(...memberRects.map((rect) => rect.top + rect.height));

    return {
      left: minLeft,
      top: minTop,
      width: Math.max(1, maxRight - minLeft),
      height: Math.max(1, maxBottom - minTop),
    };
  }

  const anchorNode = resolveFrameSelectionAnchor(
    pageInner.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${config.anchorId}"]`)
  );

  if (!anchorNode) {
    return null;
  }

  return readFrameMoveRect(anchorNode);
};

const buildRelativeAnchorConfigFromRect = ({
  frameRect,
  anchorRect,
  anchorKind,
  anchorId,
  preferredAnchorX,
  preferredAnchorY,
}: {
  frameRect: FrameNodeRect;
  anchorRect: FrameNodeRect;
  anchorKind: TemplateFrameRelativeAnchorKind;
  anchorId: TemplateFrameRelativeAnchorId;
  preferredAnchorX?: TemplateFrameRelativeHorizontalPin;
  preferredAnchorY?: TemplateFrameRelativeVerticalPin;
}): TemplateFrameRelativeAnchorConfig => {
  const anchorLeft = anchorRect.left;
  const anchorRight = anchorRect.left + anchorRect.width;
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;
  const anchorX =
    preferredAnchorX ||
    (Math.abs(frameRect.left - anchorLeft) <= Math.abs(anchorRight - (frameRect.left + frameRect.width))
      ? 'left'
      : 'right');
  const anchorY =
    preferredAnchorY ||
    (Math.abs(frameRect.top - anchorTop) <= Math.abs(anchorBottom - (frameRect.top + frameRect.height))
      ? 'top'
      : 'bottom');

  return {
    positionMode: 'relative',
    anchorKind,
    anchorId,
    anchorX,
    anchorY,
    offsetX:
      anchorX === 'left'
        ? frameRect.left - anchorLeft
        : anchorRight - (frameRect.left + frameRect.width),
    offsetY:
      anchorY === 'top'
        ? frameRect.top - anchorTop
        : anchorBottom - (frameRect.top + frameRect.height),
  };
};

const buildFrameRectFromRelativeAnchor = (
  currentRect: FrameNodeRect,
  anchorRect: FrameNodeRect,
  config: TemplateFrameRelativeAnchorConfig
): FrameNodeRect => {
  const anchorLeft = anchorRect.left;
  const anchorRight = anchorRect.left + anchorRect.width;
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;
  const left =
    config.anchorX === 'left'
      ? anchorLeft + config.offsetX
      : anchorRight - config.offsetX - currentRect.width;
  const top =
    config.anchorY === 'top'
      ? anchorTop + config.offsetY
      : anchorBottom - config.offsetY - currentRect.height;

  return {
    left,
    top,
    width: currentRect.width,
    height: currentRect.height,
  };
};

const resolveDefaultRelativeAnchorConfig = (
  frameNode: HTMLElement,
  pageInner: HTMLElement
): TemplateFrameRelativeAnchorConfig | null => {
  const frameGroupId = getFrameGroupId(frameNode);
  const defaultConfig = DEFAULT_RELATIVE_PAGE_ANCHORS[frameGroupId];

  if (!defaultConfig) {
    return null;
  }

  const anchorRect = resolvePageCornerAnchorRect(pageInner, defaultConfig.anchorId);

  if (!anchorRect) {
    return null;
  }

  return buildRelativeAnchorConfigFromRect({
    frameRect: readFrameMoveRect(frameNode),
    anchorRect,
    anchorKind: defaultConfig.anchorKind,
    anchorId: defaultConfig.anchorId,
    preferredAnchorX: defaultConfig.anchorX,
    preferredAnchorY: defaultConfig.anchorY,
  });
};

const readFramePositionMode = (
  frameNode: HTMLElement | null | undefined,
  pageInner?: HTMLElement | null
): TemplateFramePositionMode => {
  if (!frameNode) {
    return 'absolute';
  }

  const shell = resolveFrameLayoutShell(frameNode);
  const textarea = shell.querySelector<HTMLElement>('[data-template-frame-input="true"]');
  const explicitMode =
    frameNode.getAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR)?.trim() ||
    shell.getAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR)?.trim() ||
    textarea?.getAttribute(TEMPLATE_FRAME_POSITION_MODE_ATTR)?.trim() ||
    '';

  if (explicitMode === 'absolute' || explicitMode === 'relative') {
    return explicitMode;
  }

  const hasStoredRelativeAnchorAttrs = [frameNode, shell, textarea].some((element) => {
    if (!element) {
      return false;
    }

    const anchorKind = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR)?.trim();
    const anchorId = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR)?.trim();
    const anchorX = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR)?.trim();
    const anchorY = element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR)?.trim();
    const offsetX = Number.parseFloat(element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR) || '');
    const offsetY = Number.parseFloat(element.getAttribute(TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR) || '');

    return (
      (anchorKind === 'frame' || anchorKind === 'page-corner' || anchorKind === 'group') &&
      Boolean(anchorId) &&
      (anchorX === 'left' || anchorX === 'right') &&
      (anchorY === 'top' || anchorY === 'bottom') &&
      Number.isFinite(offsetX) &&
      Number.isFinite(offsetY)
    );
  });

  if (hasStoredRelativeAnchorAttrs) {
    return 'relative';
  }

  const frameGroupId = getFrameGroupId(frameNode);

  if (DEFAULT_ABSOLUTE_FRAME_GROUP_IDS.has(frameGroupId)) {
    return 'absolute';
  }

  return 'absolute';
};

const readFrameRelativeAnchorConfig = (
  frameNode: HTMLElement | null | undefined,
  pageInner?: HTMLElement | null
): TemplateFrameRelativeAnchorConfig | null => {
  if (!frameNode) {
    return null;
  }

  if (readFramePositionMode(frameNode, pageInner) !== 'relative') {
    return null;
  }

  const shell = resolveFrameLayoutShell(frameNode);
  const storedConfig = readStoredRelativeAnchorConfig(frameNode) || readStoredRelativeAnchorConfig(shell);

  if (storedConfig) {
    return storedConfig;
  }

  return null;
};

const ensureFrameRelativeAnchorConfig = (frameNode: HTMLElement | null | undefined, pageInner?: HTMLElement | null) => {
  const resolvedPageInner = pageInner || frameNode?.closest<HTMLElement>('.page-inner') || null;

  if (!frameNode || !resolvedPageInner) {
    return null;
  }

  const positionMode = readFramePositionMode(frameNode, resolvedPageInner);
  writeFramePositionModeAttrs(frameNode, positionMode);
  let config = readFrameRelativeAnchorConfig(frameNode, resolvedPageInner);

  if (positionMode === 'relative' && !config) {
    config =
      resolveDefaultRelativeAnchorConfig(frameNode, resolvedPageInner) ||
      resolveNearestPageCornerRelativeAnchorConfig(frameNode, resolvedPageInner);
  }

  if (config) {
    writeFrameRelativeAnchorAttrs(frameNode, config);
  } else {
    clearFrameRelativeAnchorAttrs(frameNode);
  }

  return config;
};

const readRelativeAnchorTargetLabel = (config: TemplateFrameRelativeAnchorConfig | null) => {
  if (!config) {
    return null;
  }

  if (config.anchorKind === 'page-corner') {
    return PAGE_CORNER_ANCHOR_LABELS[config.anchorId] || config.anchorId;
  }

  if (config.anchorKind === 'group') {
    return `그룹 기준: ${config.anchorId}`;
  }

  return config.anchorId;
};

const readFrameBandSourceFrameGroupId = (frameNode: HTMLElement | null | undefined) => {
  if (!frameNode) {
    return '';
  }

  return (
    resolveFrameLayoutShell(frameNode)
      .getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR)
      ?.trim() ||
    frameNode.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR)?.trim() ||
    ''
  );
};

const collectExplicitRelativeFlowChildFrameGroupIds = (
  sourceFrameGroupId: string,
  allFrameNodes: HTMLElement[],
  resolvedPageInner: HTMLElement
) => {
  const groupedChildFrameGroupIds = new Set<string>();
  const positionGroupById = new Map(
    collectPositionBoxGroups(resolvedPageInner, { includeSingletons: true }).map((group) => [group.id, group] as const)
  );

  if (!sourceFrameGroupId) {
    return groupedChildFrameGroupIds;
  }

  const buildChildGroupIds = (parentId: string) => {
    const directChildIds = allFrameNodes
      .map((node) => {
        const candidateId = getFrameGroupId(node);
        const config = readFrameRelativeAnchorConfig(node, resolvedPageInner);

        if (!candidateId || !config) {
          return null;
        }

        if (candidateId === parentId) {
          return null;
        }

        if (config.anchorKind === 'frame') {
          if (config.anchorId !== parentId) {
            return null;
          }

          return candidateId;
        }

        if (config.anchorKind === 'group') {
          const anchorGroup = positionGroupById.get(config.anchorId) || null;
          if (!anchorGroup || !anchorGroup.frameGroupIds.includes(parentId)) {
            return null;
          }

          return candidateId;
        }

        return null;
      })
      .filter(Boolean) as string[];

    directChildIds.forEach((childId) => {
      if (!groupedChildFrameGroupIds.has(childId)) {
        groupedChildFrameGroupIds.add(childId);
        buildChildGroupIds(childId);
      }
    });
  };

  buildChildGroupIds(sourceFrameGroupId);
  return groupedChildFrameGroupIds;
};

const collectBandSourceAlignedFrameGroupIds = (
  sourceFrameNode: HTMLElement,
  allFrameNodes: HTMLElement[]
) => {
  const sourceFrameGroupId = getFrameGroupId(sourceFrameNode);
  const bandSourceFrameGroupId = readFrameBandSourceFrameGroupId(sourceFrameNode);
  const groupedFrameGroupIds = new Set<string>();

  if (!sourceFrameGroupId || !bandSourceFrameGroupId) {
    return groupedFrameGroupIds;
  }

  const sourcePageInner = sourceFrameNode.closest<HTMLElement>('.page-inner');
  if (!sourcePageInner) {
    return groupedFrameGroupIds;
  }

  allFrameNodes.forEach((candidate) => {
    if (candidate.closest<HTMLElement>('.page-inner') !== sourcePageInner) {
      return;
    }

    const candidateId = getFrameGroupId(candidate);
    const candidateBandSource = readFrameBandSourceFrameGroupId(candidate);

    if (!candidateId || candidateId === sourceFrameGroupId || !candidateBandSource || candidateBandSource !== bandSourceFrameGroupId) {
      return;
    }

    groupedFrameGroupIds.add(candidateId);
  });

  return groupedFrameGroupIds;
};

const collectPositionImpactGroupCandidateFrameGroupIds = (
  sourceFrameNode: HTMLElement | null,
  allFrameNodes: HTMLElement[],
  resolvedPageInner: HTMLElement
) => {
  if (!sourceFrameNode) {
    return new Set<string>();
  }

  const sourceFrameGroupId = getFrameGroupId(sourceFrameNode);
  if (!sourceFrameGroupId) {
    return new Set<string>();
  }

  const collectedFrameGroupIds = new Set<string>();
  const explicitRelativeChildIds = collectExplicitRelativeFlowChildFrameGroupIds(
    sourceFrameGroupId,
    allFrameNodes,
    resolvedPageInner
  );
  const bandAlignedFrameGroupIds = collectBandSourceAlignedFrameGroupIds(sourceFrameNode, allFrameNodes);

  explicitRelativeChildIds.forEach((frameGroupId) => {
    collectedFrameGroupIds.add(frameGroupId);
  });

  bandAlignedFrameGroupIds.forEach((frameGroupId) => {
    collectedFrameGroupIds.add(frameGroupId);
  });

  return collectedFrameGroupIds;
};

const collectPositionImpactGroupIds = (
  frameNode: HTMLElement | null | undefined,
  pageInner?: HTMLElement | null
) => {
  const resolvedPageInner = pageInner || frameNode?.closest<HTMLElement>('.page-inner') || null;

  if (!frameNode || !resolvedPageInner) {
    return new Set<string>();
  }

  const sourceIsRelative = readFramePositionMode(frameNode, resolvedPageInner) === 'relative';
  const sourceShell = resolveFrameLayoutShell(frameNode);
  const allFrameNodes = collectFrameSelectionAnchors(resolvedPageInner);
  const baseFrameGroupIds = collectPositionImpactGroupCandidateFrameGroupIds(
    frameNode,
    allFrameNodes,
    resolvedPageInner
  );

  if (baseFrameGroupIds.size > 0 || !sourceIsRelative) {
    return baseFrameGroupIds;
  }

  const sourceShellRect = readFrameElementRect(sourceShell, resolvedPageInner);
  const boundaryY = sourceShellRect.top + sourceShellRect.height;

  allFrameNodes
    .filter((candidate) => candidate !== frameNode)
    .filter((candidate) => readFramePositionMode(candidate, resolvedPageInner) !== 'absolute')
    .filter((candidate) => {
      const candidateRect = readFrameMoveRect(candidate);
      return candidateRect.top >= boundaryY - FRAME_RESIZE_TOLERANCE_PX;
    })
    .map((candidate) => getFrameGroupId(candidate))
    .filter(Boolean)
    .forEach((candidateFrameGroupId) => {
      if (candidateFrameGroupId) {
        baseFrameGroupIds.add(candidateFrameGroupId);
      }
    });

  return baseFrameGroupIds;
};

const collectPositionBoxGroups = (
  scope: ParentNode | null | undefined,
  options?: {
    includeSingletons?: boolean;
  }
) => {
  const includeSingletons = options?.includeSingletons ?? false;

  if (!scope) {
    return [] as PositionImpactGroup[];
  }

  const frameNodes = collectFrameSelectionAnchors(scope);
  const explicitBuckets = new Map<
    string,
    {
      frameGroupIds: Set<string>;
      label: string;
      firstIndex: number;
    }
  >();
  const explicitMemberIds = new Set<string>();

  frameNodes.forEach((frameNode, index) => {
    const frameGroupId = getFrameGroupId(frameNode);
    const config = readFramePositionGroupConfig(frameNode);

    if (!frameGroupId || !config?.groupId) {
      return;
    }

    const bucket = explicitBuckets.get(config.groupId) || {
      frameGroupIds: new Set<string>(),
      label: config.label.trim(),
      firstIndex: index,
    };

    bucket.frameGroupIds.add(frameGroupId);
    if (!bucket.label && config.label.trim()) {
      bucket.label = config.label.trim();
    }
    bucket.firstIndex = Math.min(bucket.firstIndex, index);
    explicitBuckets.set(config.groupId, bucket);
    explicitMemberIds.add(frameGroupId);
  });

  const groupsWithOrder: Array<PositionImpactGroup & { firstIndex: number }> = [];

  explicitBuckets.forEach((bucket, groupId) => {
    const frameGroupIds = Array.from(bucket.frameGroupIds).sort((left, right) => left.localeCompare(right, 'ko'));
    if (frameGroupIds.length === 0) {
      return;
    }

    groupsWithOrder.push({
      id: groupId,
      label: bucket.label,
      frameGroupIds,
      inferred: false,
      firstIndex: bucket.firstIndex,
    });
  });

  const inferredBuckets = new Map<
    string,
    {
      frameGroupIds: string[];
      firstIndex: number;
    }
  >();

  frameNodes.forEach((frameNode, index) => {
    const frameGroupId = getFrameGroupId(frameNode);
    const bandSource = readFrameBandSourceFrameGroupId(frameNode);
    const pageInner = frameNode.closest<HTMLElement>('.page-inner');
    const pageKey = pageInner?.getAttribute('data-page')?.trim() || '1';

    if (!frameGroupId || explicitMemberIds.has(frameGroupId) || !bandSource) {
      return;
    }

    const bucketKey = `${pageKey}|${bandSource}`;
    const bucket = inferredBuckets.get(bucketKey) || {
      frameGroupIds: [],
      firstIndex: index,
    };

    bucket.frameGroupIds.push(frameGroupId);
    bucket.firstIndex = Math.min(bucket.firstIndex, index);
    inferredBuckets.set(bucketKey, bucket);
  });

  inferredBuckets.forEach((bucket, bucketKey) => {
    const frameGroupIds = Array.from(new Set(bucket.frameGroupIds)).sort((left, right) => left.localeCompare(right, 'ko'));

    if (frameGroupIds.length <= 1) {
      return;
    }

    groupsWithOrder.push({
      id: `inferred:${bucketKey}`,
      label: '',
      frameGroupIds,
      inferred: true,
      firstIndex: bucket.firstIndex,
    });
  });

  const groupedMemberIds = new Set(groupsWithOrder.flatMap((group) => group.frameGroupIds));

  if (includeSingletons) {
    frameNodes.forEach((frameNode, index) => {
      const frameGroupId = getFrameGroupId(frameNode);

      if (!frameGroupId || groupedMemberIds.has(frameGroupId)) {
        return;
      }

      groupsWithOrder.push({
        id: `single:${frameGroupId}`,
        label: frameGroupId,
        frameGroupIds: [frameGroupId],
        inferred: true,
        firstIndex: index,
      });
    });
  }

  let nextAutoLabelIndex = 1;

  return groupsWithOrder
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map(({ firstIndex: _firstIndex, ...group }) => {
      if (group.frameGroupIds.length <= 1) {
        const singleFrameGroupId = readSingleFrameGroupId(group.frameGroupIds);
        const fallbackLabel = singleFrameGroupId || group.id.replace(/^single:/, '');
        return {
          ...group,
          label: group.label.trim() || fallbackLabel,
        };
      }

      if (group.label.trim()) {
        return group;
      }

      const labeledGroup = {
        ...group,
        label: `box ${nextAutoLabelIndex}`,
      };
      nextAutoLabelIndex += 1;
      return labeledGroup;
    });
};

const readSingleFrameGroupId = (frameGroupIds: string[]) => {
  const normalizedFrameGroupIds = frameGroupIds
    .map((frameGroupId) => frameGroupId.trim())
    .filter((frameGroupId) => Boolean(frameGroupId));

  if (normalizedFrameGroupIds.length !== 1) {
    return '';
  }

  return normalizedFrameGroupIds[0] || '';
};

const readNextPositionGroupLabel = (groups: PositionImpactGroup[]) => {
  const maxLabelIndex = groups.reduce((maxIndex, group) => {
    const matched = group.label.trim().match(/^box\s+(\d+)$/i);

    if (!matched) {
      return maxIndex;
    }

    return Math.max(maxIndex, Number.parseInt(matched[1] || '0', 10) || 0);
  }, 0);

  return `box ${maxLabelIndex + 1}`;
};

const collectPositionImpactGroupsBySourceIds = (
  scope: ParentNode | null | undefined,
  sourceFrameGroupIds: string[] = [],
  options?: {
    includeSourceFrameGroupIds?: boolean;
  }
) => {
  const includeSourceFrameGroupIds = options?.includeSourceFrameGroupIds ?? false;
  const normalizedSourceFrameGroupIds = Array.from(new Set(sourceFrameGroupIds.map((id) => id.trim()).filter(Boolean)));

  if (!scope || normalizedSourceFrameGroupIds.length === 0) {
    return [];
  }

  const frameNodeById = new Map<string, HTMLElement>();
  const allFrameNodes = collectFrameSelectionAnchors(scope);

  allFrameNodes.forEach((frameNode) => {
    const frameGroupId = getFrameGroupId(frameNode);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, frameNode);
    }
  });

  const sourceFrameGroupIdsInScope = normalizedSourceFrameGroupIds.filter((sourceFrameGroupId) =>
    frameNodeById.has(sourceFrameGroupId)
  );

  if (sourceFrameGroupIdsInScope.length === 0) {
    return [];
  }

  const touchedFrameGroupIds = new Set<string>();
  sourceFrameGroupIdsInScope.forEach((sourceFrameGroupId) => {
    const sourceFrameNode = frameNodeById.get(sourceFrameGroupId);
    if (!sourceFrameNode) {
      return;
    }

    if (includeSourceFrameGroupIds) {
      touchedFrameGroupIds.add(sourceFrameGroupId);
    }

    const impactedFrameGroupIds = collectPositionImpactGroupIds(sourceFrameNode);
    impactedFrameGroupIds.forEach((impactedFrameGroupId) => {
      touchedFrameGroupIds.add(impactedFrameGroupId);
    });
  });

  if (touchedFrameGroupIds.size === 0) {
    return [];
  }

  const sourceFrameGroupIdSet = new Set(sourceFrameGroupIdsInScope);
  const positionBoxGroups = collectPositionBoxGroups(scope, { includeSingletons: true });
  const matchedGroupIds = new Set<string>();

  positionBoxGroups.forEach((group) => {
    if (group.frameGroupIds.some((frameGroupId) => touchedFrameGroupIds.has(frameGroupId))) {
      matchedGroupIds.add(group.id);
    }
  });

  return positionBoxGroups
    .filter((group) => matchedGroupIds.has(group.id))
    .map((group) => ({
      ...group,
      frameGroupIds: group.frameGroupIds.filter(
        (frameGroupId) => includeSourceFrameGroupIds || !sourceFrameGroupIdSet.has(frameGroupId)
      ),
    }))
    .filter((group) => group.frameGroupIds.length > 0);
};

const collectPositionImpactGroupIdsBySourceIds = (
  scope: ParentNode | null | undefined,
  sourceFrameGroupIds: string[] = [],
  options?: {
    includeSourceFrameGroupIds?: boolean;
  }
) => {
  const impactGroups = collectPositionImpactGroupsBySourceIds(scope, sourceFrameGroupIds, options);
  const selectedPositionGroupIds = new Set<string>();

  impactGroups.forEach((group) => {
    group.frameGroupIds.forEach((frameGroupId) => {
      selectedPositionGroupIds.add(frameGroupId);
    });
  });

  return selectedPositionGroupIds;
};

const readPositionImpactGroupDisplayLabels = (groups: PositionImpactGroup[]) =>
  groups.map((group) => {
    if (group.label.trim()) {
      return group.label;
    }

    const singleFrameGroupId = readSingleFrameGroupId(group.frameGroupIds);
    return singleFrameGroupId || group.id;
  });

const applyFramePositionMode = (
  frameNode: HTMLElement | null | undefined,
  nextMode: TemplateFramePositionMode,
  pageInner?: HTMLElement | null
) => {
  const resolvedPageInner = pageInner || frameNode?.closest<HTMLElement>('.page-inner') || null;

  if (!frameNode || !resolvedPageInner) {
    return;
  }

  writeFramePositionModeAttrs(frameNode, nextMode);

  if (nextMode === 'absolute') {
    clearFrameRelativeAnchorAttrs(frameNode);
    return;
  }

  const existingConfig = readFrameRelativeAnchorConfig(frameNode, resolvedPageInner);

  if (existingConfig) {
    writeFrameRelativeAnchorAttrs(frameNode, existingConfig);
    return;
  }

  const defaultConfig = resolveDefaultRelativeAnchorConfig(frameNode, resolvedPageInner);
  writeFrameRelativeAnchorAttrs(
    frameNode,
    defaultConfig || resolveNearestPageCornerRelativeAnchorConfig(frameNode, resolvedPageInner)
  );
};

const readTableColWidths = (table: HTMLTableElement | null) => {
  if (!table) {
    return [];
  }

  return Array.from(table.querySelectorAll<HTMLTableColElement>('col')).map((col) => {
    const inlineWidth = parseFramePx(col.style.width || col.getAttribute('width') || '');
    if (inlineWidth > 0) {
      return inlineWidth;
    }

    const computedWidth = parseFramePx(getComputedStyle(col).width);
    return computedWidth > 0 ? computedWidth : MIN_TABLE_COLUMN_WIDTH_PX;
  });
};

const readTableRowHeights = (table: HTMLTableElement | null) => {
  if (!table) {
    return [];
  }

  return Array.from(table.querySelectorAll<HTMLTableRowElement>('tr')).map((row) => {
    const inlineHeight = parseFramePx(row.style.height || row.getAttribute('height') || '');
    if (inlineHeight > 0) {
      return inlineHeight;
    }

    const computedHeight = parseFramePx(getComputedStyle(row).height) || row.getBoundingClientRect().height;
    return computedHeight > 0 ? computedHeight : MIN_TABLE_ROW_HEIGHT_PX;
  });
};

const buildBoundaries = (sizes: number[]) => {
  const boundaries = [0];
  let cursor = 0;
  sizes.forEach((size) => {
    cursor += size;
    boundaries.push(cursor);
  });
  return boundaries;
};

const sumWritableTableSizes = (sizes: number[], startIndex = 0, endIndex = sizes.length) =>
  sizes
    .slice(startIndex, endIndex)
    .reduce((sum, size) => sum + getWritableTableSize(size), 0);

const getWritableTableSize = (value: number) =>
  Math.max(MIN_WRITABLE_TABLE_SIZE_PX, Number.isFinite(value) ? value : MIN_WRITABLE_TABLE_SIZE_PX);

const readTableSizeMinimums = (
  table: HTMLTableElement | null,
  axis: 'col' | 'row',
  sizes: number[],
  fallbackMinimum: number
) => {
  if (!table) {
    return [];
  }

  const datasetKey = axis === 'col' ? 'templateFrameColMinimums' : 'templateFrameRowMinimums';
  const cached = table.dataset[datasetKey];

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length === sizes.length) {
        return parsed.map((value) => getWritableTableSize(Number(value) || 0));
      }
    } catch {
      // Ignore malformed cache and rebuild from the current table layout.
    }
  }

  const minimums = sizes.map((size) => getWritableTableSize(Math.min(Math.max(size, 0), fallbackMinimum)));
  table.dataset[datasetKey] = JSON.stringify(minimums);
  return minimums;
};

const readTableColMinimums = (table: HTMLTableElement | null, colWidths?: number[]) =>
  readTableSizeMinimums(table, 'col', colWidths || readTableColWidths(table), MIN_TABLE_COLUMN_WIDTH_PX);

const readTableRowMinimums = (table: HTMLTableElement | null, rowHeights?: number[]) =>
  readTableSizeMinimums(table, 'row', rowHeights || readTableRowHeights(table), MIN_TABLE_ROW_HEIGHT_PX);

const getRangeShrinkCapacity = (sizes: number[], minimums: number[], range: BoundaryShrinkRange) => {
  let capacity = 0;

  for (let index = range.startIndex; index <= range.endIndex; index += 1) {
    const currentSize = getWritableTableSize(sizes[index] || 0);
    const minSize = getWritableTableSize(minimums[index] || 0);
    capacity += Math.max(0, currentSize - minSize);
  }

  return capacity;
};

const growSizeRangeEdge = (sizes: number[], range: BoundaryShrinkRange, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  if (range.side === 'before') {
    sizes[range.endIndex] = getWritableTableSize(sizes[range.endIndex] || 0) + amount;
    return amount;
  }

  sizes[range.startIndex] = getWritableTableSize(sizes[range.startIndex] || 0) + amount;
  return amount;
};

const shrinkSizeRange = (sizes: number[], minimums: number[], range: BoundaryShrinkRange, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  const indices: number[] = [];

  if (range.side === 'before') {
    for (let index = range.endIndex; index >= range.startIndex; index -= 1) {
      indices.push(index);
    }
  } else {
    for (let index = range.startIndex; index <= range.endIndex; index += 1) {
      indices.push(index);
    }
  }

  let remaining = amount;

  indices.forEach((index) => {
    if (remaining <= 0) {
      return;
    }

    const currentSize = getWritableTableSize(sizes[index] || 0);
    const minSize = getWritableTableSize(minimums[index] || 0);
    const shrinkable = Math.max(0, currentSize - minSize);
    const applied = Math.min(remaining, shrinkable);
    sizes[index] = currentSize - applied;
    remaining -= applied;
  });

  return amount - remaining;
};

const findClosestBoundaryIndex = (boundaries: number[], target: number) => {
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  boundaries.forEach((boundary, index) => {
    const diff = Math.abs(boundary - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
};

const clusterItemsByCoordinate = <T,>(items: T[], readCoordinate: (item: T) => number, tolerancePx: number) => {
  const clusters: T[][] = [];

  items
    .slice()
    .sort((left, right) => readCoordinate(left) - readCoordinate(right))
    .forEach((item) => {
      const cluster = clusters[clusters.length - 1];

      if (!cluster) {
        clusters.push([item]);
        return;
      }

      const referenceCoordinate = readCoordinate(cluster[cluster.length - 1]);

      if (Math.abs(readCoordinate(item) - referenceCoordinate) <= tolerancePx) {
        cluster.push(item);
        return;
      }

      clusters.push([item]);
    });

  return clusters;
};

const setTableColWidths = (table: HTMLTableElement, colWidths: number[]) => {
  const cols = Array.from(table.querySelectorAll<HTMLTableColElement>('col'));
  cols.forEach((col, index) => {
    const nextWidth = getWritableTableSize(colWidths[index] || 0);
    col.style.width = toFrameCssPx(nextWidth);
    col.removeAttribute('width');
  });
};

const setTableRowHeights = (table: HTMLTableElement, rowHeights: number[]) => {
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'));
  rows.forEach((row, index) => {
    const nextHeight = getWritableTableSize(rowHeights[index] || 0);
    row.style.height = toFrameCssPx(nextHeight);
  });
};

const syncShellSizeFromTable = (
  shell: HTMLElement,
  table: HTMLTableElement | null,
  colWidths: number[],
  rowHeights: number[],
  axes: {
    width?: boolean;
    height?: boolean;
  } = {}
) => {
  const syncWidth = axes.width ?? true;
  const syncHeight = axes.height ?? true;
  const totalWidth = colWidths.length > 0 ? colWidths.reduce((sum, width) => sum + getWritableTableSize(width), 0) : 0;
  const totalHeight =
    rowHeights.length > 0 ? rowHeights.reduce((sum, height) => sum + getWritableTableSize(height), 0) : 0;

  if (syncWidth && totalWidth > 0) {
    shell.style.width = toFrameCssPx(totalWidth);
  }

  if (syncHeight && totalHeight > 0) {
    shell.style.height = toFrameCssPx(totalHeight);
  }

  if (table) {
    if (syncWidth && totalWidth > 0) {
      table.style.width = toFrameCssPx(totalWidth);
    }

    if (syncHeight && totalHeight > 0) {
      table.style.height = toFrameCssPx(totalHeight);
    }
  }
};

const buildFrameResizeContext = (node: HTMLElement) => {
  const shell = resolveFrameLayoutShell(node);
  const table = resolveFrameLayoutTable(node);
  const pageInner = shell.closest<HTMLElement>('.page-inner');
  const cell = node.matches('td')
    ? node
    : table?.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${getFrameGroupId(node)}"]`) ||
      table?.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) ||
      node;
  const frameCellCount = table?.querySelectorAll(RAW_FRAME_NODE_SELECTOR).length || 1;
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const singleFrameEntryBand = frameCellCount <= 1;
  const singleCellBand = frameCellCount <= 1 && colWidths.length <= 1 && rowHeights.length <= 1;
  const shellRect = readFrameElementRect(shell, pageInner);
  const cellRect = readFrameElementRect(cell, pageInner);
  const tableRect = table?.getBoundingClientRect() || shell.getBoundingClientRect();
  const borderLeft = table ? parseFramePx(getComputedStyle(table).borderLeftWidth) : 0;
  const borderTop = table ? parseFramePx(getComputedStyle(table).borderTopWidth) : 0;
  const relativeLeft = cell.getBoundingClientRect().left - tableRect.left - borderLeft;
  const relativeTop = cell.getBoundingClientRect().top - tableRect.top - borderTop;
  const colBoundaries = buildBoundaries(colWidths);
  const rowBoundaries = buildBoundaries(rowHeights);
  const domColSpan = cell instanceof HTMLTableCellElement ? Math.max(1, cell.colSpan) : 1;
  const domRowSpan = cell instanceof HTMLTableCellElement ? Math.max(1, cell.rowSpan) : 1;
  const startColIndex = findClosestBoundaryIndex(colBoundaries, relativeLeft);
  const startRowIndex = findClosestBoundaryIndex(rowBoundaries, relativeTop);
  const endColIndex = Math.max(startColIndex + 1, Math.min(colBoundaries.length - 1, startColIndex + domColSpan));
  const endRowIndex = Math.max(startRowIndex + 1, Math.min(rowBoundaries.length - 1, startRowIndex + domRowSpan));
  const layoutCellRect =
    colBoundaries.length > 1 && rowBoundaries.length > 1
      ? {
          left: shellRect.left + borderLeft + (colBoundaries[startColIndex] || 0),
          top: shellRect.top + borderTop + (rowBoundaries[startRowIndex] || 0),
          width: Math.max(1, (colBoundaries[endColIndex] || 0) - (colBoundaries[startColIndex] || 0)),
          height: Math.max(1, (rowBoundaries[endRowIndex] || 0) - (rowBoundaries[startRowIndex] || 0)),
        }
      : cellRect;

  return {
    pageInner,
    shell,
    table,
    cell,
    shellRect,
    cellRect: layoutCellRect,
    colWidths,
    rowHeights,
    colBoundaries,
    rowBoundaries,
    startColIndex,
    endColIndex,
    startRowIndex,
    endRowIndex,
    singleFrameEntryBand,
    singleCellBand,
  };
};

const readFrameNodeRect = (node: HTMLElement): FrameNodeRect => {
  const context = buildFrameResizeContext(node);
  return context.singleFrameEntryBand ? context.shellRect : context.cellRect;
};

const filterResizeSnapRects = (
  siblingRects: FrameNodeRect[],
  anchorRect: FrameNodeRect,
  direction: TemplateFrameResizeDirection
) => {
  const anchorLeft = anchorRect.left;
  const anchorRight = anchorRect.left + anchorRect.width;
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;

  return siblingRects.filter((rect) => {
    const rectLeft = rect.left;
    const rectRight = rect.left + rect.width;
    const rectTop = rect.top;
    const rectBottom = rect.top + rect.height;

    if (direction.includes('e') || direction.includes('w')) {
      const pinnedX = direction.includes('e') ? anchorRight : anchorLeft;
      if (
        Math.abs(rectLeft - pinnedX) <= FRAME_RESIZE_TOLERANCE_PX ||
        Math.abs(rectRight - pinnedX) <= FRAME_RESIZE_TOLERANCE_PX
      ) {
        return false;
      }
    }

    if (direction.includes('n') || direction.includes('s')) {
      const pinnedY = direction.includes('s') ? anchorBottom : anchorTop;
      if (
        Math.abs(rectTop - pinnedY) <= FRAME_RESIZE_TOLERANCE_PX ||
        Math.abs(rectBottom - pinnedY) <= FRAME_RESIZE_TOLERANCE_PX
      ) {
        return false;
      }
    }

    return true;
  });
};

const stabilizeFrameContentHeight = (node: HTMLElement) => {
  const contentTarget = resolveFrameContentTarget(node);
  node.style.overflow = 'hidden';

  if (contentTarget && contentTarget !== node) {
    contentTarget.style.height = '100%';
    contentTarget.style.maxHeight = '100%';
    contentTarget.style.overflow = 'hidden';
  }

  if (!(contentTarget instanceof HTMLTextAreaElement)) {
    return;
  }

  const shell = resolveFrameLayoutShell(node);
  shell.querySelectorAll<HTMLElement>(`.${FRAME_RICHTEXT_PREVIEW_CLASS}`).forEach((element) => element.remove());
  contentTarget.removeAttribute(TEMPLATE_FRAME_RICHTEXT_ACTIVE_ATTR);
  contentTarget.removeAttribute(TEMPLATE_FRAME_BASE_HEIGHT_ATTR);
  contentTarget.removeAttribute(TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR);
  contentTarget.removeAttribute(TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR);
};

const primeFrameContentScaleMetrics = (root: ParentNode) => {
  root
    .querySelectorAll<HTMLElement>(
      `[${TEMPLATE_FRAME_BASE_HEIGHT_ATTR}], [${TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR}], [${TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR}]`
    )
    .forEach((element) => {
      element.removeAttribute(TEMPLATE_FRAME_BASE_HEIGHT_ATTR);
      element.removeAttribute(TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR);
      element.removeAttribute(TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR);
    });
};

const ensurePageInnerBaseMinHeight = (pageInner: HTMLElement) => {
  if (!pageInner.dataset.templateBaseMinHeight) {
    pageInner.dataset.templateBaseMinHeight = String(
      parseFramePx(pageInner.style.minHeight || getComputedStyle(pageInner).minHeight || '0')
    );
  }

  return Math.max(MIN_FRAME_SIZE_PX, Number.parseFloat(pageInner.dataset.templateBaseMinHeight || '0') || 0);
};

const updatePageInnerMinHeight = (pageInner: HTMLElement) => {
  const baseMinHeight = ensurePageInnerBaseMinHeight(pageInner);
  const shells = Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band'));
  const maxBottom = shells.reduce((maxBottomValue, shell) => {
    const rect = readFrameElementRect(shell, pageInner);
    return Math.max(maxBottomValue, rect.top + rect.height);
  }, baseMinHeight);
  pageInner.style.minHeight = `${Math.max(baseMinHeight, Math.ceil(maxBottom))}px`;
};

const buildTableCellLayoutPositions = (table: HTMLTableElement): TableCellLayoutPosition[] => {
  const positions: TableCellLayoutPosition[] = [];
  const occupiedUntilByColumn: number[] = [];

  Array.from(table.rows).forEach((row, rowIndex) => {
    let nextColumnIndex = 0;
    const advanceToOpenColumn = () => {
      while ((occupiedUntilByColumn[nextColumnIndex] || 0) > rowIndex) {
        nextColumnIndex += 1;
      }
    };

    advanceToOpenColumn();

    Array.from(row.cells).forEach((cell) => {
      advanceToOpenColumn();

      const colSpan = Math.max(1, cell.colSpan || 1);
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      positions.push({
        cell,
        rowStart: rowIndex,
        rowEnd: rowIndex + rowSpan,
        colStart: nextColumnIndex,
        colEnd: nextColumnIndex + colSpan,
      });

      for (let offset = 0; offset < colSpan; offset += 1) {
        occupiedUntilByColumn[nextColumnIndex + offset] = Math.max(
          occupiedUntilByColumn[nextColumnIndex + offset] || 0,
          rowIndex + rowSpan
        );
      }

      nextColumnIndex += colSpan;
    });
  });

  return positions;
};

const buildFallbackTableColWidths = (
  positions: TableCellLayoutPosition[],
  pageInner: HTMLElement,
  columnCount: number
) => {
  const fallbackWidths = Array.from({ length: columnCount }, () => MIN_TABLE_COLUMN_WIDTH_PX);

  positions.forEach((position) => {
    const cellRect = readFrameElementRect(position.cell, pageInner);
    const widthPerColumn = Math.max(
      MIN_WRITABLE_TABLE_SIZE_PX,
      cellRect.width / Math.max(1, position.colEnd - position.colStart)
    );

    for (let columnIndex = position.colStart; columnIndex < position.colEnd; columnIndex += 1) {
      fallbackWidths[columnIndex] = Math.max(fallbackWidths[columnIndex] || 0, widthPerColumn);
    }
  });

  return fallbackWidths;
};

const buildSplitFrameBandGroups = (positions: TableCellLayoutPosition[]): SplitFrameBandGroup[] =>
  positions
    .filter((position) => position.cell.matches(RAW_FRAME_NODE_SELECTOR))
    .map((position, index) => ({
      groupKey:
        position.cell.getAttribute('data-template-frame-group')?.trim() ||
        `normalized-cell-${index}:${position.rowStart}:${position.rowEnd}:${position.colStart}:${position.colEnd}`,
      rowStart: position.rowStart,
      rowEnd: position.rowEnd,
      colStart: position.colStart,
      colEnd: position.colEnd,
      entries: [position],
    }))
    .sort((left, right) => left.rowStart - right.rowStart || left.colStart - right.colStart);

const buildRowOccupiedMaxColEnd = (positions: TableCellLayoutPosition[]) => {
  const rowOccupiedMaxColEnd: number[] = [];

  positions.forEach((position) => {
    for (let rowIndex = position.rowStart; rowIndex < position.rowEnd; rowIndex += 1) {
      rowOccupiedMaxColEnd[rowIndex] = Math.max(rowOccupiedMaxColEnd[rowIndex] || 0, position.colEnd);
    }
  });

  return rowOccupiedMaxColEnd;
};

const expandSingleEntryGroupsToTrailingColumns = (
  groups: SplitFrameBandGroup[],
  rowOccupiedMaxColEnd: number[],
  columnCount: number
) =>
  groups.map((group) => {
    if (group.entries.length !== 1 || group.colEnd >= columnCount) {
      return group;
    }

    const isRightmostOccupiedGroup = Array.from(
      { length: group.rowEnd - group.rowStart },
      (_, offset) => group.rowStart + offset
    ).every((rowIndex) => (rowOccupiedMaxColEnd[rowIndex] || 0) <= group.colEnd);

    if (!isRightmostOccupiedGroup) {
      return group;
    }

    return {
      ...group,
      colEnd: columnCount,
    };
  });

const stripTransientFrameEditorUi = (root: ParentNode) => {
  root
    .querySelectorAll<HTMLElement>(
      `.${FRAME_MARQUEE_GHOST_CLASS}, .${FRAME_CREATION_GHOST_CLASS}, .${FRAME_RICHTEXT_PREVIEW_CLASS}`
    )
    .forEach((element) => {
      element.remove();
    });
  root.querySelectorAll<HTMLElement>('[data-frame-editor-ui]').forEach((element) => {
    element.remove();
  });
  root.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
    element.removeAttribute('data-template-selected');
    element.removeAttribute('data-template-primary-selected');
    element.removeAttribute('data-template-selection-order');
  });
  root.querySelectorAll<HTMLElement>('[data-template-edge-visual="true"], [data-template-edge-anchor-node="true"]').forEach((element) => {
    element.removeAttribute('data-template-edge-visual');
    element.removeAttribute('data-template-edge-anchor-node');
  });
  root.querySelectorAll<HTMLElement>('[data-template-relative-anchor-target="true"]').forEach((element) => {
    element.removeAttribute('data-template-relative-anchor-target');
  });
  root.querySelectorAll<HTMLElement>('[data-template-edit-enabled]').forEach((element) => {
    element.removeAttribute('data-template-edit-enabled');
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_RICHTEXT_ACTIVE_ATTR}]`).forEach((element) => {
    element.removeAttribute(TEMPLATE_FRAME_RICHTEXT_ACTIVE_ATTR);
  });
  root
    .querySelectorAll<HTMLElement>(
      `[${TEMPLATE_FRAME_BASE_HEIGHT_ATTR}], [${TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR}], [${TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR}]`
    )
    .forEach((element) => {
      element.removeAttribute(TEMPLATE_FRAME_BASE_HEIGHT_ATTR);
      element.removeAttribute(TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR);
      element.removeAttribute(TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR);
    });
};

const buildNormalizedFrameBandShell = (
  shell: HTMLElement,
  table: HTMLTableElement,
  pageInner: HTMLElement,
  group: SplitFrameBandGroup,
  colWidths: number[],
  rowHeights: number[],
  rowOccupiedMaxColEnd: number[]
) => {
  const tableRect = readFrameElementRect(table, pageInner);
  const tableStyle = getComputedStyle(table);
  const borderLeft = parseFramePx(tableStyle.borderLeftWidth);
  const borderTop = parseFramePx(tableStyle.borderTopWidth);
  const left = tableRect.left + borderLeft + sumWritableTableSizes(colWidths, 0, group.colStart);
  const top = tableRect.top + borderTop + sumWritableTableSizes(rowHeights, 0, group.rowStart);
  const width = sumWritableTableSizes(colWidths, group.colStart, group.colEnd);
  const height = sumWritableTableSizes(rowHeights, group.rowStart, group.rowEnd);
  const sourceKey =
    shell.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR) ||
    shell.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR)?.getAttribute('data-template-frame-group') ||
    `source:${shell.style.left}:${shell.style.top}:${shell.style.width}:${shell.style.height}`;
  const nextShell = shell.cloneNode(false) as HTMLElement;
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_ATTR, 'true');
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR, `${group.rowStart}:${group.rowEnd}`);
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_COL_RANGE_ATTR, `${group.colStart}:${group.colEnd}`);
  nextShell.setAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR, sourceKey);
  nextShell.setAttribute('data-v106-band-group-key', group.groupKey);
  nextShell.style.left = toFrameCssPx(left);
  nextShell.style.top = toFrameCssPx(top);
  nextShell.style.width = toFrameCssPx(width);
  nextShell.style.height = toFrameCssPx(height);
  nextShell.style.overflow = 'hidden';
  const preserveTopBorder = group.rowStart === 0;
  const preserveBottomBorder = group.rowEnd === rowHeights.length;
  const preserveLeftBorder = group.colStart === 0;
  const preserveRightBorder =
    group.colEnd === colWidths.length ||
    Array.from({ length: group.rowEnd - group.rowStart }, (_, offset) => group.rowStart + offset).every(
      (rowIndex) => (rowOccupiedMaxColEnd[rowIndex] || 0) <= group.colEnd
    );
  const nextTable = table.cloneNode(false) as HTMLTableElement;
  nextTable.style.width = nextShell.style.width;
  nextTable.style.height = nextShell.style.height;
  nextTable.style.borderTopWidth = preserveTopBorder ? tableStyle.borderTopWidth : '0px';
  nextTable.style.borderTopStyle = preserveTopBorder ? tableStyle.borderTopStyle : 'none';
  nextTable.style.borderTopColor = preserveTopBorder ? tableStyle.borderTopColor : 'transparent';
  nextTable.style.borderRightWidth = preserveRightBorder ? tableStyle.borderRightWidth : '0px';
  nextTable.style.borderRightStyle = preserveRightBorder ? tableStyle.borderRightStyle : 'none';
  nextTable.style.borderRightColor = preserveRightBorder ? tableStyle.borderRightColor : 'transparent';
  nextTable.style.borderBottomWidth = preserveBottomBorder ? tableStyle.borderBottomWidth : '0px';
  nextTable.style.borderBottomStyle = preserveBottomBorder ? tableStyle.borderBottomStyle : 'none';
  nextTable.style.borderBottomColor = preserveBottomBorder ? tableStyle.borderBottomColor : 'transparent';
  nextTable.style.borderLeftWidth = preserveLeftBorder ? tableStyle.borderLeftWidth : '0px';
  nextTable.style.borderLeftStyle = preserveLeftBorder ? tableStyle.borderLeftStyle : 'none';
  nextTable.style.borderLeftColor = preserveLeftBorder ? tableStyle.borderLeftColor : 'transparent';
  nextTable.style.borderSpacing = '0px';

  const colgroup = document.createElement('colgroup');
  colWidths.slice(group.colStart, group.colEnd).forEach((width) => {
    const col = document.createElement('col');
    col.style.width = toFrameCssPx(getWritableTableSize(width));
    colgroup.appendChild(col);
  });
  nextTable.appendChild(colgroup);

  const tbody = document.createElement('tbody');
  for (let rowIndex = group.rowStart; rowIndex < group.rowEnd; rowIndex += 1) {
    const sourceRow = table.rows.item(rowIndex);
    const nextRow = (sourceRow?.cloneNode(false) as HTMLTableRowElement | undefined) || document.createElement('tr');
    nextRow.style.height = toFrameCssPx(getWritableTableSize(rowHeights[rowIndex] || MIN_TABLE_ROW_HEIGHT_PX));
    tbody.appendChild(nextRow);
  }

  group.entries
    .slice()
    .sort((leftEntry, rightEntry) => leftEntry.colStart - rightEntry.colStart)
    .forEach((entry) => {
      const nextCell = entry.cell.cloneNode(true) as HTMLTableCellElement;
      const singleEntryGroup = group.entries.length === 1;
      nextCell.colSpan = Math.max(
        1,
        singleEntryGroup ? group.colEnd - group.colStart : entry.colEnd - entry.colStart
      );
      nextCell.rowSpan = Math.max(
        1,
        singleEntryGroup ? group.rowEnd - group.rowStart : entry.rowEnd - entry.rowStart
      );
      tbody.rows[entry.rowStart - group.rowStart]?.appendChild(nextCell);
    });

  nextTable.appendChild(tbody);
  nextShell.appendChild(nextTable);
  stripTransientFrameEditorUi(nextShell);
  TemplateFrameEditHtmlService.stripEditorUiState(nextShell);
  return nextShell;
};

const normalizeFrameBandTableLayout = (shell: HTMLElement) => {
  if (shell.getAttribute(NORMALIZED_FRAME_BAND_ATTR) === 'true') {
    return false;
  }

  const pageInner = shell.closest<HTMLElement>('.page-inner');
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');

  if (!pageInner || !table || table.rows.length <= 1) {
    return false;
  }

  const positions = buildTableCellLayoutPositions(table);
  const groups = buildSplitFrameBandGroups(positions);

  if (groups.length <= 1) {
    return false;
  }

  const columnCount = positions.reduce((maxColumnCount, position) => Math.max(maxColumnCount, position.colEnd), 0);
  const colWidthsFromTable = readTableColWidths(table);
  const colWidths =
    colWidthsFromTable.length >= columnCount
      ? colWidthsFromTable
      : buildFallbackTableColWidths(positions, pageInner, columnCount);
  const rowHeightsFromTable = readTableRowHeights(table);
  const rowHeights =
    rowHeightsFromTable.length >= table.rows.length
      ? rowHeightsFromTable
      : Array.from(table.rows).map((row, rowIndex) => {
          const fallbackHeight = parseFramePx(getComputedStyle(row).height) || row.getBoundingClientRect().height;
          return Math.max(
            MIN_WRITABLE_TABLE_SIZE_PX,
            rowHeightsFromTable[rowIndex] || fallbackHeight || MIN_TABLE_ROW_HEIGHT_PX
          );
        });
  const rowOccupiedMaxColEnd = buildRowOccupiedMaxColEnd(positions);
  const expandedGroups = expandSingleEntryGroupsToTrailingColumns(groups, rowOccupiedMaxColEnd, colWidths.length);

  const nextShells = expandedGroups.map((group) =>
    buildNormalizedFrameBandShell(shell, table, pageInner, group, colWidths, rowHeights, rowOccupiedMaxColEnd)
  );

  shell.replaceWith(...nextShells);
  return true;
};

const ensurePreviewFrameBandNormalization = (root: ParentNode) => {
  let normalized = false;

  root.querySelectorAll<HTMLElement>('.page-inner').forEach((pageInner) => {
    let pageNormalized = false;

    Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band')).forEach((shell) => {
      const shellNormalized = normalizeFrameBandTableLayout(shell);
      pageNormalized = shellNormalized || pageNormalized;
      normalized = shellNormalized || normalized;
    });

    if (pageNormalized) {
      updatePageInnerMinHeight(pageInner);
    }
  });

  return normalized;
};

const parseNormalizedBandRange = (value: string | null | undefined) => {
  const [startValue, endValue] = String(value || '')
    .split(':')
    .map((entry) => Number.parseInt(entry, 10));

  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue <= startValue) {
    return null;
  }

  return {
    start: startValue,
    end: endValue,
  };
};

const readNormalizedBandGeometry = (shell: HTMLElement): NormalizedBandGeometry | null => {
  if (shell.getAttribute(NORMALIZED_FRAME_BAND_ATTR) !== 'true') {
    return null;
  }

  const rowRange = parseNormalizedBandRange(shell.getAttribute(NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR));
  const colRange = parseNormalizedBandRange(shell.getAttribute(NORMALIZED_FRAME_BAND_COL_RANGE_ATTR));
  const sourceKey = shell.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR)?.trim() || '';

  if (!rowRange || !colRange || !sourceKey) {
    return null;
  }

  return {
    shell,
    rowStart: rowRange.start,
    rowEnd: rowRange.end,
    colStart: colRange.start,
    colEnd: colRange.end,
    sourceKey,
  };
};

const buildDenormalizedFrameBandShell = (sourceShells: HTMLElement[]) => {
  const geometries = sourceShells
    .map((shell) => readNormalizedBandGeometry(shell))
    .filter((geometry): geometry is NormalizedBandGeometry => Boolean(geometry))
    .sort((left, right) => left.rowStart - right.rowStart || left.colStart - right.colStart);

  const templateShell = geometries[0]?.shell || null;
  const templateTable =
    templateShell?.querySelector<HTMLTableElement>('table.v102-frame-band-table') ||
    templateShell?.querySelector<HTMLTableElement>('table') ||
    null;

  if (!templateShell || !templateTable) {
    return null;
  }

  const rowCount = geometries.reduce((maxRowCount, geometry) => Math.max(maxRowCount, geometry.rowEnd), 0);
  const colCount = geometries.reduce((maxColumnCount, geometry) => Math.max(maxColumnCount, geometry.colEnd), 0);
  const rowHeights = Array.from({ length: rowCount }, () => MIN_TABLE_ROW_HEIGHT_PX);
  const colWidths = Array.from({ length: colCount }, () => MIN_TABLE_COLUMN_WIDTH_PX);
  const shellRects = geometries.map((geometry) => readFrameElementRect(geometry.shell));

  geometries.forEach((geometry) => {
    const shellTable =
      geometry.shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') ||
      geometry.shell.querySelector<HTMLTableElement>('table') ||
      null;

    if (!shellTable) {
      return;
    }

    readTableColWidths(shellTable).forEach((width, index) => {
      const absoluteIndex = geometry.colStart + index;
      colWidths[absoluteIndex] = Math.max(colWidths[absoluteIndex] || 0, width);
    });
    readTableRowHeights(shellTable).forEach((height, index) => {
      const absoluteIndex = geometry.rowStart + index;
      rowHeights[absoluteIndex] = Math.max(rowHeights[absoluteIndex] || 0, height);
    });
  });

  const nextShell = templateShell.cloneNode(false) as HTMLElement;
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_ATTR);
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_ROW_RANGE_ATTR);
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_COL_RANGE_ATTR);
  nextShell.removeAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR);
  nextShell.removeAttribute('data-v106-band-group-key');
  nextShell.style.left = toFrameCssPx(Math.min(...shellRects.map((rect) => rect.left)));
  nextShell.style.top = toFrameCssPx(Math.min(...shellRects.map((rect) => rect.top)));
  nextShell.style.width = toFrameCssPx(colWidths.reduce((sum, width) => sum + getWritableTableSize(width), 0));
  nextShell.style.height = toFrameCssPx(rowHeights.reduce((sum, height) => sum + getWritableTableSize(height), 0));

  const nextTable = templateTable.cloneNode(false) as HTMLTableElement;
  nextTable.style.border = '';
  nextTable.style.borderLeftWidth = '';
  nextTable.style.borderRightWidth = '';
  nextTable.style.borderTopWidth = '';
  nextTable.style.borderBottomWidth = '';
  nextTable.style.borderSpacing = '';
  nextTable.style.width = nextShell.style.width;
  nextTable.style.height = nextShell.style.height;

  const colgroup = document.createElement('colgroup');
  colWidths.forEach((width) => {
    const col = document.createElement('col');
    col.style.width = toFrameCssPx(getWritableTableSize(width));
    colgroup.appendChild(col);
  });
  nextTable.appendChild(colgroup);

  const tbody = document.createElement('tbody');
  rowHeights.forEach((height) => {
    const row = document.createElement('tr');
    row.style.height = toFrameCssPx(getWritableTableSize(height));
    tbody.appendChild(row);
  });

  geometries.forEach((geometry) => {
    const shellTable =
      geometry.shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') ||
      geometry.shell.querySelector<HTMLTableElement>('table') ||
      null;

    if (!shellTable) {
      return;
    }

    Array.from(shellTable.rows).forEach((row, rowOffset) => {
      const targetRow = tbody.rows[geometry.rowStart + rowOffset];

      Array.from(row.cells).forEach((cell) => {
        targetRow?.appendChild(cell.cloneNode(true));
      });
    });
  });

  nextTable.appendChild(tbody);
  nextShell.appendChild(nextTable);
  stripTransientFrameEditorUi(nextShell);
  TemplateFrameEditHtmlService.stripEditorUiState(nextShell);
  return nextShell;
};

const denormalizePreviewFrameBands = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('.page-inner').forEach((pageInner) => {
    const groupedShells = new Map<string, HTMLElement[]>();

    Array.from(pageInner.querySelectorAll<HTMLElement>(`.v102-frame-band[${NORMALIZED_FRAME_BAND_ATTR}="true"]`)).forEach((shell) => {
      const sourceKey = shell.getAttribute(NORMALIZED_FRAME_BAND_SOURCE_ATTR)?.trim();

      if (!sourceKey) {
        return;
      }

      const current = groupedShells.get(sourceKey);

      if (current) {
        current.push(shell);
        return;
      }

      groupedShells.set(sourceKey, [shell]);
    });

    groupedShells.forEach((sourceShells) => {
      const replacementShell = buildDenormalizedFrameBandShell(sourceShells);

      if (!replacementShell) {
        return;
      }

      const [firstShell, ...remainingShells] = sourceShells;
      firstShell.replaceWith(replacementShell);
      remainingShells.forEach((shell) => shell.remove());
    });
  });
};

const applyOuterRightWidthDelta = (
  shell: HTMLElement,
  delta: number,
  shrinkRange?: BoundaryShrinkRange,
  minimumStopRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableColMinimums(table, colWidths);

  if (!table || colWidths.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextWidth = Math.max(MIN_FRAME_SIZE_PX, shellRect.width + delta);
    shell.style.width = toFrameCssPx(nextWidth);
    return nextWidth - shellRect.width;
  }

  const nextColWidths = [...colWidths];
  const lastIndex = nextColWidths.length - 1;

  if (delta >= 0) {
    if (shrinkRange?.side === 'before') {
      growSizeRangeEdge(nextColWidths, shrinkRange, delta);
    } else {
      nextColWidths[lastIndex] += delta;
    }
    setTableColWidths(table, nextColWidths);
    syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
    return delta;
  }

  const effectiveShrinkRange = minimumStopRange || shrinkRange;
  const shrinkable =
    effectiveShrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextColWidths, minimums, effectiveShrinkRange)
      : Math.max(0, nextColWidths[lastIndex] - getWritableTableSize(minimums[lastIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (effectiveShrinkRange?.side === 'before') {
    shrinkSizeRange(nextColWidths, minimums, effectiveShrinkRange, applied);
  } else {
    nextColWidths[lastIndex] -= applied;
  }
  setTableColWidths(table, nextColWidths);
  syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
  return -applied;
};

const applyOuterLeftWidthDelta = (
  shell: HTMLElement,
  delta: number,
  shrinkRange?: BoundaryShrinkRange,
  minimumStopRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableColMinimums(table, colWidths);
  const currentShellRect = readFrameElementRect(shell);
  const currentLeft = parseFramePx(shell.style.left);
  const currentRight = currentShellRect.left + currentShellRect.width;

  if (!table || colWidths.length === 0) {
    const nextWidth = Math.max(MIN_FRAME_SIZE_PX, currentShellRect.width - delta);
    const appliedDelta = currentShellRect.width - nextWidth;
    shell.style.left = toFrameCssPx(currentLeft + appliedDelta);
    shell.style.width = toFrameCssPx(nextWidth);
    return appliedDelta;
  }

  const firstIndex = 0;

  if (delta >= 0) {
    const nextColWidths = [...colWidths];
    const effectiveShrinkRange = minimumStopRange || shrinkRange;
    const shrinkable =
      effectiveShrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextColWidths, minimums, effectiveShrinkRange)
        : Math.max(0, nextColWidths[firstIndex] - getWritableTableSize(minimums[firstIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    if (effectiveShrinkRange?.side === 'after') {
      shrinkSizeRange(nextColWidths, minimums, effectiveShrinkRange, applied);
    } else {
      nextColWidths[firstIndex] -= applied;
    }
    shell.style.left = toFrameCssPx(currentLeft + applied);
    setTableColWidths(table, nextColWidths);
    syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
    const nextShellRect = readFrameElementRect(shell);
    const rightCorrection = currentRight - (nextShellRect.left + nextShellRect.width);

    if (Math.abs(rightCorrection) > 0.01) {
      const correctedWidth = Math.max(MIN_FRAME_SIZE_PX, nextShellRect.width + rightCorrection);
      shell.style.width = toFrameCssPx(correctedWidth);
      table.style.width = toFrameCssPx(correctedWidth);
    }

    return applied;
  }

  const nextColWidths = [...colWidths];
  if (shrinkRange?.side === 'after') {
    growSizeRangeEdge(nextColWidths, shrinkRange, Math.abs(delta));
  } else {
    nextColWidths[firstIndex] += Math.abs(delta);
  }
  shell.style.left = toFrameCssPx(currentLeft + delta);
  setTableColWidths(table, nextColWidths);
  syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
  const nextShellRect = readFrameElementRect(shell);
  const rightCorrection = currentRight - (nextShellRect.left + nextShellRect.width);

  if (Math.abs(rightCorrection) > 0.01) {
    const correctedWidth = Math.max(MIN_FRAME_SIZE_PX, nextShellRect.width + rightCorrection);
    shell.style.width = toFrameCssPx(correctedWidth);

    if (table) {
      table.style.width = toFrameCssPx(correctedWidth);
    }
  }

  return delta;
};

const applyTableBoundaryWidthDelta = (
  shell: HTMLElement,
  boundaryIndex: number,
  delta: number,
  shrinkRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableColMinimums(table, colWidths);

  if (!table || colWidths.length === 0 || boundaryIndex <= 0 || boundaryIndex >= colWidths.length) {
    return 0;
  }

  const nextColWidths = [...colWidths];
  const leftIndex = boundaryIndex - 1;
  const rightIndex = boundaryIndex;

  if (delta >= 0) {
    const shrinkable =
      shrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextColWidths, minimums, shrinkRange)
        : Math.max(0, nextColWidths[rightIndex] - getWritableTableSize(minimums[rightIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    nextColWidths[leftIndex] += applied;
    if (shrinkRange?.side === 'after') {
      shrinkSizeRange(nextColWidths, minimums, shrinkRange, applied);
    } else {
      nextColWidths[rightIndex] -= applied;
    }
    setTableColWidths(table, nextColWidths);
    syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
    return applied;
  }

  const shrinkable =
    shrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextColWidths, minimums, shrinkRange)
      : Math.max(0, nextColWidths[leftIndex] - getWritableTableSize(minimums[leftIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (shrinkRange?.side === 'before') {
    shrinkSizeRange(nextColWidths, minimums, shrinkRange, applied);
  } else {
    nextColWidths[leftIndex] -= applied;
  }
  nextColWidths[rightIndex] += applied;
  setTableColWidths(table, nextColWidths);
  syncShellSizeFromTable(shell, table, nextColWidths, rowHeights, { height: false });
  return -applied;
};

const getWidthDeltaCapacity = (
  shell: HTMLElement,
  mode: 'left' | 'right' | 'boundary-left' | 'boundary-right',
  boundaryIndex = 0,
  shrinkRange?: BoundaryShrinkRange,
  minimumStopRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const minimums = readTableColMinimums(table, colWidths);

  if (colWidths.length === 0) {
    const shellRect = readFrameElementRect(shell);
    return Math.max(0, shellRect.width - MIN_FRAME_SIZE_PX);
  }

  if (mode === 'left') {
    const effectiveShrinkRange = minimumStopRange || shrinkRange;
    if (effectiveShrinkRange?.side === 'after') {
      return getRangeShrinkCapacity(colWidths, minimums, effectiveShrinkRange);
    }

    return Math.max(0, (colWidths[0] || 0) - getWritableTableSize(minimums[0] || 0));
  }

  if (mode === 'right') {
    const effectiveShrinkRange = minimumStopRange || shrinkRange;
    if (effectiveShrinkRange?.side === 'before') {
      return getRangeShrinkCapacity(colWidths, minimums, effectiveShrinkRange);
    }

    return Math.max(
      0,
      (colWidths[colWidths.length - 1] || 0) - getWritableTableSize(minimums[colWidths.length - 1] || 0)
    );
  }

  if (mode === 'boundary-left') {
    if (shrinkRange?.side === 'before') {
      return getRangeShrinkCapacity(colWidths, minimums, shrinkRange);
    }

    return Math.max(0, (colWidths[boundaryIndex - 1] || 0) - getWritableTableSize(minimums[boundaryIndex - 1] || 0));
  }

  if (shrinkRange?.side === 'after') {
    return getRangeShrinkCapacity(colWidths, minimums, shrinkRange);
  }

  return Math.max(0, (colWidths[boundaryIndex] || 0) - getWritableTableSize(minimums[boundaryIndex] || 0));
};

const hasLeadingScaffoldColumns = (context: ReturnType<typeof buildFrameResizeContext>) => {
  if (!context.table || context.startColIndex <= 0 || context.cell.previousElementSibling) {
    return false;
  }

  const minimums = readTableColMinimums(context.table, context.colWidths);
  const leadingMinimums = minimums.slice(0, context.startColIndex);
  return leadingMinimums.length > 0 && leadingMinimums.every((width) => width <= FRAME_SCAFFOLD_TRACK_THRESHOLD_PX);
};

const hasTrailingScaffoldColumns = (context: ReturnType<typeof buildFrameResizeContext>) => {
  if (!context.table || context.endColIndex >= context.colWidths.length || context.cell.nextElementSibling) {
    return false;
  }

  const minimums = readTableColMinimums(context.table, context.colWidths);
  const trailingMinimums = minimums.slice(context.endColIndex);
  return trailingMinimums.length > 0 && trailingMinimums.every((width) => width <= FRAME_SCAFFOLD_TRACK_THRESHOLD_PX);
};

const readTableCellColBoundarySpans = (table: HTMLTableElement, colBoundaries: number[]) => {
  const tableRect = table.getBoundingClientRect();
  const borderLeft = parseFramePx(getComputedStyle(table).borderLeftWidth);

  return Array.from(table.querySelectorAll<HTMLTableCellElement>('td,th')).map((cell) => {
    const cellRect = cell.getBoundingClientRect();
    const relativeLeft = cellRect.left - tableRect.left - borderLeft;
    const startIndex = findClosestBoundaryIndex(colBoundaries, relativeLeft);
    const endIndex = Math.max(startIndex + 1, Math.min(colBoundaries.length - 1, startIndex + Math.max(1, cell.colSpan)));

    return {
      startIndex,
      endIndex,
    };
  });
};

const resolveOuterWidthMinimumStopRange = (
  shell: HTMLElement,
  edge: 'left' | 'right'
): BoundaryShrinkRange | undefined => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);

  if (!table || colWidths.length <= 1) {
    return undefined;
  }

  const colBoundaries = buildBoundaries(colWidths);
  const cellSpans = readTableCellColBoundarySpans(table, colBoundaries);

  if (edge === 'right') {
    const alignedStartIndex = cellSpans.reduce((maxStartIndex, span) => {
      if (span.endIndex !== colWidths.length) {
        return maxStartIndex;
      }

      return Math.max(maxStartIndex, span.startIndex);
    }, -1);

    if (alignedStartIndex < 0) {
      return undefined;
    }

    return {
      startIndex: alignedStartIndex,
      endIndex: colWidths.length - 1,
      side: 'before',
    };
  }

  const alignedEndIndex = cellSpans.reduce((minEndIndex, span) => {
    if (span.startIndex !== 0) {
      return minEndIndex;
    }

    return minEndIndex < 0 ? span.endIndex : Math.min(minEndIndex, span.endIndex);
  }, -1);

  if (alignedEndIndex <= 0) {
    return undefined;
  }

  return {
    startIndex: 0,
    endIndex: Math.max(0, alignedEndIndex - 1),
    side: 'after',
  };
};

const areOppositeBoundarySides = (leftSide: TemplateEdgeSide, rightSide: TemplateEdgeSide) =>
  (leftSide === 'left' && rightSide === 'right') ||
  (leftSide === 'right' && rightSide === 'left') ||
  (leftSide === 'top' && rightSide === 'bottom') ||
  (leftSide === 'bottom' && rightSide === 'top');

const targetsSharePhysicalBoundary = (
  left: Pick<EdgeResizeTargetMember, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  right: Pick<EdgeResizeTargetMember, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>
) =>
  left.edgeId !== right.edgeId &&
  left.orientation === right.orientation &&
  areOppositeBoundarySides(left.side, right.side) &&
  Math.abs(left.lineCoordinate - right.lineCoordinate) <= FRAME_RESIZE_TOLERANCE_PX &&
  Math.max(left.spanStart, right.spanStart) < Math.min(left.spanEnd, right.spanEnd);

const edgesSharePhysicalBoundary = (
  left: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>
) =>
  left.edgeId !== right.edgeId &&
  left.orientation === right.orientation &&
  areOppositeBoundarySides(left.side, right.side) &&
  Math.abs(left.lineCoordinate - right.lineCoordinate) <= FRAME_RESIZE_TOLERANCE_PX &&
  Math.max(left.spanStart, right.spanStart) < Math.min(left.spanEnd, right.spanEnd);

const edgesSharePhysicalBoundaryWithinTolerance = (
  left: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  tolerancePx: number
) =>
  left.edgeId !== right.edgeId &&
  left.orientation === right.orientation &&
  areOppositeBoundarySides(left.side, right.side) &&
  Math.abs(left.lineCoordinate - right.lineCoordinate) <= tolerancePx &&
  Math.max(left.spanStart, right.spanStart) < Math.min(left.spanEnd, right.spanEnd);

const edgesShareExactPhysicalBoundaryWithinTolerance = (
  left: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'edgeId' | 'orientation' | 'side' | 'lineCoordinate' | 'spanStart' | 'spanEnd'>,
  tolerancePx: number
) =>
  edgesSharePhysicalBoundaryWithinTolerance(left, right, tolerancePx) &&
  Math.abs(left.spanStart - right.spanStart) <= tolerancePx &&
  Math.abs(left.spanEnd - right.spanEnd) <= tolerancePx;

const readEdgeRolePriority = (role?: TemplateEdgeSelectionRole) => {
  if (role === 'selected_edge_clicked') {
    return 0;
  }

  if (role === 'selected_edge_auto_multi') {
    return 1;
  }

  if (role === 'peer_edge') {
    return 2;
  }

  return 3;
};

const groupExactPhysicalBoundaryEdgeIds = (
  snapshot: TemplateEdgeTopologySnapshotDto,
  edgeIds: string[],
  preferredEdgeRoleById?: TemplateEdgeRoleMapDto
) => {
  const sortedEdgeIds = edgeIds
    .slice()
    .sort((leftEdgeId, rightEdgeId) => {
      const rolePriorityDelta =
        readEdgeRolePriority(preferredEdgeRoleById?.[leftEdgeId]) -
        readEdgeRolePriority(preferredEdgeRoleById?.[rightEdgeId]);

      if (rolePriorityDelta !== 0) {
        return rolePriorityDelta;
      }

      return leftEdgeId.localeCompare(rightEdgeId);
    });

  const groupedEdgeIds: string[][] = [];
  const visitedEdgeIdSet = new Set<string>();

  sortedEdgeIds.forEach((edgeId) => {
    if (visitedEdgeIdSet.has(edgeId)) {
      return;
    }

    const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

    if (!edge) {
      return;
    }

    const nextGroup = sortedEdgeIds.filter((candidateEdgeId) => {
      if (visitedEdgeIdSet.has(candidateEdgeId)) {
        return false;
      }

      const candidateEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, candidateEdgeId);

      return (
        candidateEdge &&
        edgesShareExactPhysicalBoundaryWithinTolerance(edge, candidateEdge, FRAME_RESIZE_TOLERANCE_PX)
      );
    });

    nextGroup.forEach((groupEdgeId) => visitedEdgeIdSet.add(groupEdgeId));
    groupedEdgeIds.push(nextGroup.length > 0 ? nextGroup : [edgeId]);
  });

  return groupedEdgeIds;
};

const isSimpleExactPhysicalBoundaryVerticalDrag = ({
  direction,
  snapshot,
  edgeRoleById,
}: {
  direction: ResizeDirection;
  snapshot?: TemplateEdgeTopologySnapshotDto | null;
  edgeRoleById?: TemplateEdgeRoleMapDto;
}) => {
  if (!direction.includes('w') && !direction.includes('e')) {
    return false;
  }

  if (!snapshot || !edgeRoleById) {
    return false;
  }

  const relevantRoleEntries = Object.entries(edgeRoleById).filter(
    ([, role]) => role === 'selected_edge_clicked' || role === 'peer_edge' || role === 'selected_edge_auto_multi'
  );

  if (relevantRoleEntries.length === 0) {
    return false;
  }

  const clickedEdgeIds = relevantRoleEntries
    .filter(([, role]) => role === 'selected_edge_clicked')
    .map(([edgeId]) => edgeId);
  const autoMultiEdgeIds = relevantRoleEntries
    .filter(([, role]) => role === 'selected_edge_auto_multi')
    .map(([edgeId]) => edgeId);

  if (clickedEdgeIds.length !== 1 || autoMultiEdgeIds.length > 0) {
    return false;
  }

  const relevantEdgeIds = relevantRoleEntries.map(([edgeId]) => edgeId);
  const relevantEdges = relevantEdgeIds
    .map((edgeId) => TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId))
    .filter((edge): edge is TemplateEdgeDescriptorDto => Boolean(edge));

  if (
    relevantEdges.length !== relevantEdgeIds.length ||
    relevantEdges.some((edge) => edge.orientation !== 'vertical' || (edge.side !== 'left' && edge.side !== 'right'))
  ) {
    return false;
  }

  return groupExactPhysicalBoundaryEdgeIds(snapshot, relevantEdgeIds, edgeRoleById).length === 1;
};

const buildSelfWidthResizeInstruction = (
  context: ReturnType<typeof buildFrameResizeContext>,
  edge: 'left' | 'right'
): FrameWidthResizeInstruction | null => {
  if (context.singleCellBand || !context.table || context.colWidths.length === 0) {
    return {
      kind: edge === 'left' ? 'outer-left' : 'outer-right',
      shell: context.shell,
      minimumStopRange: resolveOuterWidthMinimumStopRange(context.shell, edge),
      shrinkRange:
        edge === 'left'
          ? {
              startIndex: context.startColIndex,
              endIndex: context.endColIndex - 1,
              side: 'after',
            }
          : {
              startIndex: context.startColIndex,
              endIndex: context.endColIndex - 1,
              side: 'before',
            },
    };
  }

  if (edge === 'left') {
    if (context.startColIndex <= 0 || hasLeadingScaffoldColumns(context)) {
      return {
        kind: 'outer-left',
        shell: context.shell,
        minimumStopRange: resolveOuterWidthMinimumStopRange(context.shell, 'left'),
        shrinkRange: {
          startIndex: context.startColIndex,
          endIndex: context.endColIndex - 1,
          side: 'after',
        },
      };
    }

    return {
      kind: 'boundary',
      shell: context.shell,
      boundaryIndex: context.startColIndex,
      shrinkRange: {
        startIndex: context.startColIndex,
        endIndex: context.endColIndex - 1,
        side: 'after',
      },
    };
  }

  if (context.endColIndex >= context.colWidths.length || hasTrailingScaffoldColumns(context)) {
    return {
      kind: 'outer-right',
      shell: context.shell,
      minimumStopRange: resolveOuterWidthMinimumStopRange(context.shell, 'right'),
      shrinkRange: {
        startIndex: context.startColIndex,
        endIndex: context.endColIndex - 1,
        side: 'before',
      },
    };
  }

  return {
    kind: 'boundary',
    shell: context.shell,
    boundaryIndex: context.endColIndex,
    shrinkRange: {
      startIndex: context.startColIndex,
      endIndex: context.endColIndex - 1,
      side: 'before',
    },
  };
};

const shiftShellsBelowBoundary = (
  pageInner: HTMLElement,
  boundaryY: number,
  deltaY: number,
  excludedShells: HTMLElement[] = []
) => {
  if (Math.abs(deltaY) < 0.5) {
    return;
  }

  const excludedSet = new Set(excludedShells);

  Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band')).forEach((shell) => {
    if (excludedSet.has(shell)) {
      return;
    }

    if (isAbsolutePositionedShell(shell)) {
      return;
    }

    const shellRect = readFrameElementRect(shell, pageInner);

    if (shellRect.top >= boundaryY - FRAME_RESIZE_TOLERANCE_PX) {
      shell.style.top = toFrameCssPx(shellRect.top + deltaY);
    }
  });
};

const applyOuterBottomHeightDelta = (shell: HTMLElement, delta: number, shrinkRange?: BoundaryShrinkRange) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableRowMinimums(table, rowHeights);

  if (!table || rowHeights.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextHeight = Math.max(MIN_FRAME_SIZE_PX, shellRect.height + delta);
    shell.style.height = toFrameCssPx(nextHeight);
    return nextHeight - shellRect.height;
  }

  const nextRowHeights = [...rowHeights];
  const lastIndex = nextRowHeights.length - 1;

  if (delta >= 0) {
    nextRowHeights[lastIndex] += delta;
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return delta;
  }

  const shrinkable =
    shrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
      : Math.max(0, nextRowHeights[lastIndex] - getWritableTableSize(minimums[lastIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (shrinkRange?.side === 'before') {
    shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
  } else {
    nextRowHeights[lastIndex] -= applied;
  }
  setTableRowHeights(table, nextRowHeights);
  syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
  return -applied;
};

const applyFrameResizeHeightDeltaLocal = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (Math.abs(delta) < 0.5) {
    return 0;
  }

  const resizesOuterBottom = context.singleCellBand || context.rowHeights.length <= context.endRowIndex;
  let appliedDelta = 0;

  if (resizesOuterBottom) {
    appliedDelta = applyOuterBottomHeightDelta(context.shell, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'before',
    });
  } else if (context.table) {
    appliedDelta = applyTableBoundaryHeightDelta(context.shell, context.endRowIndex, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'before',
    });
  }

  if (Math.abs(appliedDelta) > 0.5) {
    stabilizeFrameContentHeight(node);
  }

  return appliedDelta;
};

const applyFrameResizeHeightDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return 0;
  }

  const boundaryY = context.cellRect.top + context.cellRect.height;
  let appliedDelta = 0;

  const resizesOuterBottom = context.singleCellBand || context.rowHeights.length <= context.endRowIndex;

  if (resizesOuterBottom) {
    appliedDelta = applyOuterBottomHeightDelta(context.shell, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'before',
    });
  } else if (context.table) {
    appliedDelta = applyTableBoundaryHeightDelta(context.shell, context.endRowIndex, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'before',
    });
  }

  if (resizesOuterBottom && Math.abs(appliedDelta) > 0.5 && !isAbsolutePositionedShell(context.shell)) {
    shiftShellsBelowBoundary(context.pageInner, boundaryY, appliedDelta, [context.shell]);
    updatePageInnerMinHeight(context.pageInner);
  }

  if (Math.abs(appliedDelta) > 0.5) {
    stabilizeFrameContentHeight(node);
  }

  return appliedDelta;
};

const collectWidthResizeInstructions = (
  context: ReturnType<typeof buildFrameResizeContext>,
  edge: 'left' | 'right' = 'right'
): FrameWidthResizeInstruction[] => {
  const pageInner = context.pageInner;

  if (!pageInner) {
    return [];
  }

  if (isAbsolutePositionedShell(context.shell)) {
    const selfInstruction = buildSelfWidthResizeInstruction(context, edge);
    return selfInstruction ? [selfInstruction] : [];
  }

  const selectedBoundaryUsesOuterLeft = edge === 'left' && hasLeadingScaffoldColumns(context);
  const selectedBoundaryUsesOuterRight = edge === 'right' && hasTrailingScaffoldColumns(context);
  const boundaryX =
    edge === 'left'
      ? selectedBoundaryUsesOuterLeft
        ? context.shellRect.left
        : context.cellRect.left
      : selectedBoundaryUsesOuterRight
        ? context.shellRect.left + context.shellRect.width
        : context.cellRect.left + context.cellRect.width;
  const pageShells = Array.from(pageInner.querySelectorAll<HTMLElement>('.v102-frame-band'));

  return pageShells.flatMap((shell) => {
    if (shell !== context.shell && isAbsolutePositionedShell(shell)) {
      return [];
    }

    const shellRect = readFrameElementRect(shell, pageInner);
    const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
    const colWidths = readTableColWidths(table);
    const boundaries = buildBoundaries(colWidths);
    const internalBoundaryIndex =
      colWidths.length > 1
        ? boundaries.findIndex(
            (boundary, index) =>
              index > 0 &&
              index < boundaries.length - 1 &&
              Math.abs(shellRect.left + boundary - boundaryX) <= FRAME_RESIZE_TOLERANCE_PX
          )
        : -1;

    const nextInstructions: FrameWidthResizeInstruction[] = [];
    const skipSelectedInternalBoundary =
      shell === context.shell &&
      ((edge === 'left' && selectedBoundaryUsesOuterLeft) || (edge === 'right' && selectedBoundaryUsesOuterRight));

    if (internalBoundaryIndex > 0 && !skipSelectedInternalBoundary) {
      nextInstructions.push({
        kind: 'boundary',
        shell,
        boundaryIndex: internalBoundaryIndex,
        shrinkRange:
          shell === context.shell
            ? {
                startIndex: context.startColIndex,
                endIndex: context.endColIndex - 1,
                side: edge === 'left' ? 'after' : 'before',
              }
            : undefined,
      });
      return nextInstructions;
    }

    if (Math.abs(shellRect.left - boundaryX) <= FRAME_RESIZE_TOLERANCE_PX) {
      nextInstructions.push({
        kind: 'outer-left',
        shell,
        minimumStopRange: resolveOuterWidthMinimumStopRange(shell, 'left'),
        shrinkRange:
          shell === context.shell
            ? {
                startIndex: context.startColIndex,
                endIndex: context.endColIndex - 1,
                side: 'after',
              }
            : undefined,
      });
    }

    if (Math.abs(shellRect.left + shellRect.width - boundaryX) <= FRAME_RESIZE_TOLERANCE_PX) {
      nextInstructions.push({
        kind: 'outer-right',
        shell,
        minimumStopRange: resolveOuterWidthMinimumStopRange(shell, 'right'),
        shrinkRange:
          shell === context.shell
            ? {
                startIndex: context.startColIndex,
                endIndex: context.endColIndex - 1,
                side: 'before',
              }
            : undefined,
      });
    }

    return nextInstructions;
  });
};

const applyOuterTopHeightDelta = (shell: HTMLElement, delta: number, shrinkRange?: BoundaryShrinkRange) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableRowMinimums(table, rowHeights);
  const currentTop = parseFramePx(shell.style.top);

  if (!table || rowHeights.length === 0) {
    const shellRect = readFrameElementRect(shell);
    const nextHeight = Math.max(MIN_FRAME_SIZE_PX, shellRect.height - delta);
    const appliedDelta = shellRect.height - nextHeight;
    shell.style.top = toFrameCssPx(currentTop + appliedDelta);
    shell.style.height = toFrameCssPx(nextHeight);
    return appliedDelta;
  }

  const firstIndex = 0;

  if (delta >= 0) {
    const nextRowHeights = [...rowHeights];
    const shrinkable =
      shrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
        : Math.max(0, nextRowHeights[firstIndex] - getWritableTableSize(minimums[firstIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    if (shrinkRange?.side === 'after') {
      shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
    } else {
      nextRowHeights[firstIndex] -= applied;
    }
    shell.style.top = toFrameCssPx(currentTop + applied);
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return applied;
  }

  const nextRowHeights = [...rowHeights];
  nextRowHeights[firstIndex] += Math.abs(delta);
  shell.style.top = toFrameCssPx(currentTop + delta);
  setTableRowHeights(table, nextRowHeights);
  syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
  return delta;
};

const applyTableBoundaryHeightDelta = (
  shell: HTMLElement,
  boundaryIndex: number,
  delta: number,
  shrinkRange?: BoundaryShrinkRange
) => {
  const table = shell.querySelector<HTMLTableElement>('table.v102-frame-band-table') || shell.querySelector<HTMLTableElement>('table');
  const colWidths = readTableColWidths(table);
  const rowHeights = readTableRowHeights(table);
  const minimums = readTableRowMinimums(table, rowHeights);

  if (!table || rowHeights.length === 0 || boundaryIndex <= 0 || boundaryIndex >= rowHeights.length) {
    return 0;
  }

  const nextRowHeights = [...rowHeights];
  const upperIndex = boundaryIndex - 1;
  const lowerIndex = boundaryIndex;

  if (delta >= 0) {
    const shrinkable =
      shrinkRange?.side === 'after'
        ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
        : Math.max(0, nextRowHeights[lowerIndex] - getWritableTableSize(minimums[lowerIndex] || 0));
    const applied = Math.min(delta, shrinkable);
    nextRowHeights[upperIndex] += applied;
    if (shrinkRange?.side === 'after') {
      shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
    } else {
      nextRowHeights[lowerIndex] -= applied;
    }
    setTableRowHeights(table, nextRowHeights);
    syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
    return applied;
  }

  const shrinkable =
    shrinkRange?.side === 'before'
      ? getRangeShrinkCapacity(nextRowHeights, minimums, shrinkRange)
      : Math.max(0, nextRowHeights[upperIndex] - getWritableTableSize(minimums[upperIndex] || 0));
  const applied = Math.min(Math.abs(delta), shrinkable);
  if (shrinkRange?.side === 'before') {
    shrinkSizeRange(nextRowHeights, minimums, shrinkRange, applied);
  } else {
    nextRowHeights[upperIndex] -= applied;
  }
  nextRowHeights[lowerIndex] += applied;
  setTableRowHeights(table, nextRowHeights);
  syncShellSizeFromTable(shell, table, colWidths, nextRowHeights, { width: false });
  return -applied;
};

const applyFrameResizeTopDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return 0;
  }

  if (context.singleCellBand || context.startRowIndex === 0) {
    const appliedDelta = applyOuterTopHeightDelta(context.shell, delta, {
      startIndex: context.startRowIndex,
      endIndex: context.endRowIndex - 1,
      side: 'after',
    });
    if (Math.abs(appliedDelta) > 0.5) {
      stabilizeFrameContentHeight(node);
    }
    return appliedDelta;
  }

  const appliedDelta = applyTableBoundaryHeightDelta(context.shell, context.startRowIndex, delta, {
    startIndex: context.startRowIndex,
    endIndex: context.endRowIndex - 1,
    side: 'after',
  });
  if (Math.abs(appliedDelta) > 0.5) {
    stabilizeFrameContentHeight(node);
  }
  return appliedDelta;
};

const applyFrameResizeWidthDelta = (
  node: HTMLElement,
  delta: number,
  lockedInstructions?: FrameWidthResizeInstruction[]
) => {
  const context = buildFrameResizeContext(node);
  const pageInner = context.pageInner;

  if (!pageInner || Math.abs(delta) < 0.5) {
    return 0;
  }

  const instructions = lockedInstructions && lockedInstructions.length > 0 ? lockedInstructions : collectWidthResizeInstructions(context);

  if (!instructions.length) {
    return 0;
  }

  return applyWidthResizeInstructionsDelta(instructions, delta, 0.5);
};

const applyWidthResizeInstructionsDelta = (
  instructions: FrameWidthResizeInstruction[],
  delta: number,
  minimumThresholdPx = 0.5
) => {
  let appliedDelta = delta;

  if (delta > 0) {
    const positiveCapacities = instructions
      .map((instruction) => {
        if (instruction.kind === 'boundary') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'boundary-right',
            instruction.boundaryIndex,
            instruction.shrinkRange
          );
        }

        if (instruction.kind === 'outer-left') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'left',
            0,
            instruction.shrinkRange,
            instruction.minimumStopRange
          );
        }

        return Number.POSITIVE_INFINITY;
      })
      .filter((value) => Number.isFinite(value));

    if (positiveCapacities.length > 0) {
      appliedDelta = Math.min(delta, ...positiveCapacities);
    }
  } else {
    const negativeCapacities = instructions
      .map((instruction) => {
        if (instruction.kind === 'boundary') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'boundary-left',
            instruction.boundaryIndex,
            instruction.shrinkRange
          );
        }

        if (instruction.kind === 'outer-right') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'right',
            0,
            instruction.shrinkRange,
            instruction.minimumStopRange
          );
        }

        return Number.POSITIVE_INFINITY;
      })
      .filter((value) => Number.isFinite(value));

    if (negativeCapacities.length > 0) {
      appliedDelta = -Math.min(Math.abs(delta), ...negativeCapacities);
    }
  }

  if (Math.abs(appliedDelta) < minimumThresholdPx) {
    return 0;
  }

  instructions.forEach((instruction) => {
    if (instruction.kind === 'boundary') {
      applyTableBoundaryWidthDelta(
        instruction.shell,
        instruction.boundaryIndex,
        appliedDelta,
        instruction.shrinkRange
      );
      return;
    }

    if (instruction.kind === 'outer-left') {
      applyOuterLeftWidthDelta(
        instruction.shell,
        appliedDelta,
        instruction.shrinkRange,
        instruction.minimumStopRange
      );
      return;
    }

    applyOuterRightWidthDelta(
      instruction.shell,
      appliedDelta,
      instruction.shrinkRange,
      instruction.minimumStopRange
    );
  });

  return appliedDelta;
};

const resolveWidthInstructionDelta = (instructions: FrameWidthResizeInstruction[], delta: number) => {
  let appliedDelta = delta;

  if (delta > 0) {
    const positiveCapacities = instructions
      .map((instruction) => {
        if (instruction.kind === 'boundary') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'boundary-right',
            instruction.boundaryIndex,
            instruction.shrinkRange
          );
        }

        if (instruction.kind === 'outer-left') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'left',
            0,
            instruction.shrinkRange,
            instruction.minimumStopRange
          );
        }

        return Number.POSITIVE_INFINITY;
      })
      .filter((value) => Number.isFinite(value));

    if (positiveCapacities.length > 0) {
      appliedDelta = Math.min(delta, ...positiveCapacities);
    }
  } else {
    const negativeCapacities = instructions
      .map((instruction) => {
        if (instruction.kind === 'boundary') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'boundary-left',
            instruction.boundaryIndex,
            instruction.shrinkRange
          );
        }

        if (instruction.kind === 'outer-right') {
          return getWidthDeltaCapacity(
            instruction.shell,
            'right',
            0,
            instruction.shrinkRange,
            instruction.minimumStopRange
          );
        }

        return Number.POSITIVE_INFINITY;
      })
      .filter((value) => Number.isFinite(value));

    if (negativeCapacities.length > 0) {
      appliedDelta = -Math.min(Math.abs(delta), ...negativeCapacities);
    }
  }

  return Math.abs(appliedDelta) >= 0.5 ? appliedDelta : 0;
};

const resolveFrameResizeTopDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (delta < 0) {
    if (context.singleCellBand || context.startRowIndex === 0 || !context.table || context.rowHeights.length === 0) {
      return delta;
    }

    const minimums = readTableRowMinimums(context.table, context.rowHeights);
    const upperIndex = Math.max(0, context.startRowIndex - 1);
    const capacity = Math.max(0, context.rowHeights[upperIndex] - getWritableTableSize(minimums[upperIndex] || 0));

    return -Math.min(Math.abs(delta), capacity);
  }

  if (delta <= 0) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (!context.table || context.rowHeights.length === 0) {
    return Math.min(delta, Math.max(0, context.shellRect.height - MIN_FRAME_SIZE_PX));
  }

  const minimums = readTableRowMinimums(context.table, context.rowHeights);
  const shrinkRange = {
    startIndex: context.startRowIndex,
    endIndex: context.endRowIndex - 1,
    side: 'after' as const,
  };
  const capacity = getRangeShrinkCapacity(context.rowHeights, minimums, shrinkRange);

  return Math.min(delta, capacity);
};

const resolveFrameResizeBottomDelta = (node: HTMLElement, delta: number) => {
  const context = buildFrameResizeContext(node);

  if (!context.pageInner || Math.abs(delta) < 0.5) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (delta > 0) {
    if (
      context.singleCellBand ||
      context.rowHeights.length <= context.endRowIndex ||
      !context.table ||
      context.rowHeights.length === 0
    ) {
      return delta;
    }

    const minimums = readTableRowMinimums(context.table, context.rowHeights);
    const lowerIndex = Math.min(context.rowHeights.length - 1, context.endRowIndex);
    const capacity = Math.max(0, context.rowHeights[lowerIndex] - getWritableTableSize(minimums[lowerIndex] || 0));

    return Math.min(delta, capacity);
  }

  if (delta >= 0) {
    return Math.abs(delta) < 0.5 ? 0 : delta;
  }

  if (!context.table || context.rowHeights.length === 0) {
    return -Math.min(Math.abs(delta), Math.max(0, context.shellRect.height - MIN_FRAME_SIZE_PX));
  }

  const minimums = readTableRowMinimums(context.table, context.rowHeights);
  const shrinkRange = {
    startIndex: context.startRowIndex,
    endIndex: context.endRowIndex - 1,
    side: 'before' as const,
  };
  const capacity = getRangeShrinkCapacity(context.rowHeights, minimums, shrinkRange);

  return -Math.min(Math.abs(delta), capacity);
};

const resolveSharedEdgeResizeDelta = (requestedDelta: number, candidateDeltas: number[]) => {
  if (Math.abs(requestedDelta) < 0.5 || candidateDeltas.length === 0) {
    return 0;
  }

  if (requestedDelta > 0) {
    const positiveCandidates = candidateDeltas.map((candidateDelta) => Math.max(0, candidateDelta));
    return positiveCandidates.length > 0 ? Math.min(...positiveCandidates) : 0;
  }

  const negativeCandidates = candidateDeltas.map((candidateDelta) => Math.max(0, Math.abs(candidateDelta)));
  return negativeCandidates.length > 0 ? -Math.min(...negativeCandidates) : 0;
};

// Autosnap only participates in live edge drag. The width/height controls in the
// "선택 상태" panel continue to write explicit values without this proximity rule.
const readEdgeSpanOverlapLength = (
  left: Pick<EdgeResizeTargetMember, 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'spanStart' | 'spanEnd'>
) => Math.min(left.spanEnd, right.spanEnd) - Math.max(left.spanStart, right.spanStart);

const readEdgeEndpointGapLength = (
  left: Pick<EdgeResizeTargetMember, 'spanStart' | 'spanEnd'>,
  right: Pick<TemplateEdgeDescriptorDto, 'spanStart' | 'spanEnd'>
) => {
  const overlap = readEdgeSpanOverlapLength(left, right);

  if (overlap >= 0) {
    return 0;
  }

  return Math.min(Math.abs(left.spanEnd - right.spanStart), Math.abs(right.spanEnd - left.spanStart));
};

const findEdgeDragAutosnapBestMatch = ({
  orientation,
  movingMembers,
  snapshot,
  projectedDelta,
}: {
  orientation: TemplateEdgeDescriptorDto['orientation'];
  movingMembers: EdgeResizeTargetMember[];
  snapshot?: TemplateEdgeTopologySnapshotDto;
  projectedDelta: number;
}) => {
  if (!snapshot || movingMembers.length === 0) {
    return null;
  }

  const movingEdgeIdSet = new Set(movingMembers.map((member) => member.edgeId));
  let bestMatch:
    | {
        adjustment: number;
        sidePriority: number;
        spanPriority: number;
        spanMagnitude: number;
        endpointGap: number;
        referenceEdgeId: string;
        candidateEdgeId: string;
        targetLineCoordinate: number;
      }
    | null = null;

  movingMembers.forEach((member) => {
    const movingEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, member.edgeId);

    snapshot.edges.forEach((candidateEdge) => {
      if (
        movingEdgeIdSet.has(candidateEdge.edgeId) ||
        candidateEdge.orientation !== orientation ||
        (movingEdge && candidateEdge.pageId !== movingEdge.pageId)
      ) {
        return;
      }

      const projectedLineCoordinate = member.lineCoordinate + projectedDelta;
      const adjustment = candidateEdge.lineCoordinate - projectedLineCoordinate;

      if (Math.abs(adjustment) >= EDGE_DRAG_AUTOSNAP_THRESHOLD_PX) {
        return;
      }

      const sidePriority = candidateEdge.side === member.side ? 0 : 1;
      const spanOverlap = readEdgeSpanOverlapLength(member, candidateEdge);
      const endpointGap = readEdgeEndpointGapLength(member, candidateEdge);
      const isEndpointTouchCandidate =
        Math.abs(spanOverlap) <= EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX &&
        endpointGap <= EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX;

      if (isEndpointTouchCandidate) {
        return;
      }

      const spanPriority = spanOverlap > EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX ? 0 : 1;
      const spanMagnitude =
        spanOverlap > EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX ? spanOverlap : endpointGap;

      if (
        !bestMatch ||
        sidePriority < bestMatch.sidePriority ||
        (sidePriority === bestMatch.sidePriority && spanPriority < bestMatch.spanPriority) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          spanPriority === 0 &&
          spanMagnitude > bestMatch.spanMagnitude) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          spanPriority === 1 &&
          spanMagnitude < bestMatch.spanMagnitude) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          Math.abs(adjustment) < Math.abs(bestMatch.adjustment)) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          Math.abs(adjustment) === Math.abs(bestMatch.adjustment) &&
          endpointGap < bestMatch.endpointGap)
      ) {
        bestMatch = {
          adjustment,
          sidePriority,
          spanPriority,
          spanMagnitude,
          endpointGap,
          referenceEdgeId: member.edgeId,
          candidateEdgeId: candidateEdge.edgeId,
          targetLineCoordinate: candidateEdge.lineCoordinate,
        };
      }
    });
  });

  return bestMatch;
};

const resolveEdgeDragAutosnapDelta = ({
  requestedDelta,
  orientation,
  movingMembers,
  snapshot,
  currentAppliedDelta,
}: {
  requestedDelta: number;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  movingMembers: EdgeResizeTargetMember[];
  snapshot?: TemplateEdgeTopologySnapshotDto;
  currentAppliedDelta: number;
}) => {
  if (!snapshot || Math.abs(requestedDelta) < 0.5 || movingMembers.length === 0) {
    return requestedDelta;
  }

  const bestMatch = findEdgeDragAutosnapBestMatch({
    orientation,
    movingMembers,
    snapshot,
    projectedDelta: currentAppliedDelta + requestedDelta,
  });

  if (!bestMatch) {
    return requestedDelta;
  }

  const snappedDelta = requestedDelta + bestMatch.adjustment;

  if ((requestedDelta > 0 && snappedDelta < 0) || (requestedDelta < 0 && snappedDelta > 0)) {
    return requestedDelta;
  }

  return snappedDelta;
};

const resolveEdgeDragAutosnapResult = ({
  requestedDelta,
  orientation,
  movingMembers,
  snapshot,
  currentAppliedDelta,
  existingLock,
}: {
  requestedDelta: number;
  orientation: TemplateEdgeDescriptorDto['orientation'];
  movingMembers: EdgeResizeTargetMember[];
  snapshot?: TemplateEdgeTopologySnapshotDto;
  currentAppliedDelta: number;
  existingLock?: EdgeDragAutosnapLock | null;
}) => {
  if (!snapshot || Math.abs(requestedDelta) < 0.5 || movingMembers.length === 0) {
    return {
      delta: requestedDelta,
      nextLock: existingLock?.orientation === orientation ? existingLock : null,
    };
  }

  const normalizedLock = existingLock?.orientation === orientation ? existingLock : null;
  const lockedReferenceMember = normalizedLock
    ? movingMembers.find((member) => member.edgeId === normalizedLock.referenceEdgeId) || movingMembers[0]
    : null;

  if (normalizedLock && lockedReferenceMember) {
    const projectedLineCoordinate =
      lockedReferenceMember.lineCoordinate + currentAppliedDelta + requestedDelta;
    const adjustment = normalizedLock.targetLineCoordinate - projectedLineCoordinate;
    const snappedDelta = requestedDelta + adjustment;

    if (
      Math.abs(adjustment) <= normalizedLock.releaseThresholdPx &&
      !((requestedDelta > 0 && snappedDelta < -0.5) || (requestedDelta < 0 && snappedDelta > 0.5))
    ) {
      return {
        delta: snappedDelta,
        nextLock: normalizedLock,
      };
    }
  }

  const bestMatch = findEdgeDragAutosnapBestMatch({
    orientation,
    movingMembers,
    snapshot,
    projectedDelta: currentAppliedDelta + requestedDelta,
  });

  if (!bestMatch) {
    return {
      delta: requestedDelta,
      nextLock: null,
    };
  }

  const snappedDelta = requestedDelta + bestMatch.adjustment;

  if ((requestedDelta > 0 && snappedDelta < 0) || (requestedDelta < 0 && snappedDelta > 0)) {
    return {
      delta: requestedDelta,
      nextLock: null,
    };
  }

  return {
    delta: snappedDelta,
    nextLock: {
      orientation,
      referenceEdgeId: bestMatch.referenceEdgeId,
      candidateEdgeId: bestMatch.candidateEdgeId,
      targetLineCoordinate: bestMatch.targetLineCoordinate,
      releaseThresholdPx: EDGE_DRAG_AUTOSNAP_RELEASE_THRESHOLD_PX,
    } satisfies EdgeDragAutosnapLock,
  };
};

const resolveLiveEdgeAutosnapCorrection = ({
  orientation,
  movingMembers,
  snapshot,
}: {
  orientation: TemplateEdgeDescriptorDto['orientation'];
  movingMembers: EdgeResizeTargetMember[];
  snapshot?: TemplateEdgeTopologySnapshotDto;
}) => {
  if (!snapshot || movingMembers.length === 0) {
    return 0;
  }

  const movingEdgeIdSet = new Set(movingMembers.map((member) => member.edgeId));
  let bestMatch:
    | {
        adjustment: number;
        sidePriority: number;
        spanPriority: number;
        spanMagnitude: number;
        endpointGap: number;
      }
    | null = null;

  movingMembers.forEach((member) => {
    const movingEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, member.edgeId);

    snapshot.edges.forEach((candidateEdge) => {
      if (
        movingEdgeIdSet.has(candidateEdge.edgeId) ||
        candidateEdge.orientation !== orientation ||
        (movingEdge && candidateEdge.pageId !== movingEdge.pageId)
      ) {
        return;
      }

      const adjustment = candidateEdge.lineCoordinate - member.lineCoordinate;

      if (Math.abs(adjustment) >= EDGE_DRAG_AUTOSNAP_THRESHOLD_PX) {
        return;
      }

      const sidePriority = candidateEdge.side === member.side ? 0 : 1;
      const spanOverlap = readEdgeSpanOverlapLength(member, candidateEdge);
      const endpointGap = readEdgeEndpointGapLength(member, candidateEdge);
      const isEndpointTouchCandidate =
        Math.abs(spanOverlap) <= EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX &&
        endpointGap <= EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX;

      if (isEndpointTouchCandidate) {
        return;
      }

      const spanPriority = spanOverlap > EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX ? 0 : 1;
      const spanMagnitude =
        spanOverlap > EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX ? spanOverlap : endpointGap;

      if (
        !bestMatch ||
        sidePriority < bestMatch.sidePriority ||
        (sidePriority === bestMatch.sidePriority && spanPriority < bestMatch.spanPriority) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          spanPriority === 0 &&
          spanMagnitude > bestMatch.spanMagnitude) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          spanPriority === 1 &&
          spanMagnitude < bestMatch.spanMagnitude) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          Math.abs(adjustment) < Math.abs(bestMatch.adjustment)) ||
        (sidePriority === bestMatch.sidePriority &&
          spanPriority === bestMatch.spanPriority &&
          Math.abs(adjustment) === Math.abs(bestMatch.adjustment) &&
          endpointGap < bestMatch.endpointGap)
      ) {
        bestMatch = {
          adjustment,
          sidePriority,
          spanPriority,
          spanMagnitude,
          endpointGap,
        };
      }
    });
  });

  return bestMatch === null ? 0 : bestMatch.adjustment;
};

const clampResolvedEdgeDragDeltaToPointerRequest = (
  requestedDelta: number,
  resolvedDelta: number,
  overshootTolerancePx = EDGE_DRAG_AUTOSNAP_THRESHOLD_PX
) => {
  if (Math.abs(resolvedDelta) < 0.5) {
    return 0;
  }

  if (Math.abs(requestedDelta) < 0.5) {
    return resolvedDelta;
  }

  const maxAllowedMagnitude = Math.abs(requestedDelta) + overshootTolerancePx;

  if (Math.abs(resolvedDelta) <= maxAllowedMagnitude) {
    return resolvedDelta;
  }

  const directionSign = Math.sign(resolvedDelta) || Math.sign(requestedDelta);
  return directionSign * maxAllowedMagnitude;
};

const pickHeightResizeTargetMember = (
  target: EdgeResizeTarget,
  direction: TemplateFrameResizeDirection
): EdgeResizeTargetMember | null => {
  if (direction.includes('n')) {
    return target.members.find((member) => member.side === 'top') || target.members.find((member) => member.side === 'bottom') || null;
  }

  if (direction.includes('s')) {
    return (
      target.members.find((member) => member.side === 'bottom') ||
      target.members.find((member) => member.side === 'top') ||
      null
    );
  }

  return null;
};

const writeFrameMoveRect = (node: HTMLElement, rect: FrameNodeRect) => {
  const shell = resolveFrameLayoutShell(node);
  shell.style.left = toFrameCssPx(rect.left);
  shell.style.top = toFrameCssPx(rect.top);
  shell.style.width = toFrameCssPx(Math.max(MIN_FRAME_SIZE_PX, rect.width));
  shell.style.height = toFrameCssPx(Math.max(MIN_FRAME_SIZE_PX, rect.height));
};

const writeFrameNodeRect = (node: HTMLElement, rect: FrameNodeRect) => {
  const currentRect = readFrameNodeRect(node);
  applyFrameResizeWidthDelta(node, rect.width - currentRect.width);
  applyFrameResizeHeightDelta(node, rect.height - currentRect.height);
};

const applyFrameResizeWithDirection = (
  node: HTMLElement,
  nextRect: FrameNodeRect,
  direction: TemplateFrameResizeDirection,
  widthInstructions?: FrameWidthResizeInstruction[]
) => {
  const currentRect = readFrameNodeRect(node);

  if (direction.includes('w')) {
    applyFrameResizeWidthDelta(node, nextRect.left - currentRect.left, widthInstructions);
  } else if (direction.includes('e')) {
    applyFrameResizeWidthDelta(node, nextRect.width - currentRect.width, widthInstructions);
  }

  if (direction.includes('n')) {
    applyFrameResizeTopDelta(node, nextRect.top - currentRect.top);
  } else if (direction.includes('s')) {
    applyFrameResizeHeightDelta(node, nextRect.height - currentRect.height);
  }
};

const clampFrameNodeRect = (
  rect: FrameNodeRect,
  bounds: { width: number; height: number },
  minSize = MIN_FRAME_SIZE_PX
): FrameNodeRect => {
  const width = Math.max(minSize, Math.min(bounds.width, rect.width));
  const height = Math.max(minSize, Math.min(bounds.height, rect.height));
  const left = Math.max(0, Math.min(bounds.width - width, rect.left));
  const top = Math.max(0, Math.min(bounds.height - height, rect.top));
  return { left, top, width, height };
};

const getNextFrameSelection = (previous: string[], frameGroupId: string, isMultiSelect: boolean) => {
  if (isMultiSelect) {
    return previous.includes(frameGroupId)
      ? previous.filter((value) => value !== frameGroupId)
      : [...previous, frameGroupId];
  }

  return previous.includes(frameGroupId) ? previous : [frameGroupId];
};

const getFrameGroupId = (node: HTMLElement | null) => {
  if (!node) {
    return '';
  }

  const directFrameGroupId =
    node.getAttribute('data-template-frame-group')?.trim() ||
    node.getAttribute('data-v106-band-group-key')?.trim();

  if (directFrameGroupId) {
    return directFrameGroupId;
  }

  return node.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR)?.getAttribute('data-template-frame-group')?.trim() || '';
};

const resolveFrameSelectionAnchor = (node: HTMLElement | null) => {
  if (!node) {
    return null;
  }

  const frameGroupId = getFrameGroupId(node);

  if (!frameGroupId) {
    return null;
  }

  let current: HTMLElement | null = node;
  let fallbackAnchor: HTMLElement | null = null;
  let tableCellAnchor: HTMLElement | null = null;
  let shellAnchor: HTMLElement | null = null;

  while (current) {
    if (getFrameGroupId(current) === frameGroupId) {
      fallbackAnchor = current;

      if (!shellAnchor && current.classList.contains('v102-frame-band')) {
        shellAnchor = current;
      }

      if (!tableCellAnchor && current.matches('td,th')) {
        tableCellAnchor = current;
      }
    }

    current = current.parentElement;
  }

  return shellAnchor || tableCellAnchor || fallbackAnchor;
};

const collectFrameSelectionAnchors = (scope?: ParentNode | null) => {
  const anchorMap = new Map<string, HTMLElement>();

  Array.from(scope?.querySelectorAll<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR) || []).forEach((node) => {
    const anchorNode = resolveFrameSelectionAnchor(node);
    const frameGroupId = getFrameGroupId(anchorNode);

    if (!anchorNode || !frameGroupId || anchorMap.has(frameGroupId)) {
      return;
    }

    anchorMap.set(frameGroupId, anchorNode);
  });

  return Array.from(anchorMap.values());
};

const resolveExplicitEdgeFrameNode = (scope: ParentNode | null | undefined, edgeId: string | null | undefined) => {
  const frameGroupId = String(edgeId || '').split(':')[0]?.trim();

  if (!scope || !frameGroupId) {
    return null;
  }

  return (
    scope.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`) || null
  );
};

const syncFrameRelativeAnchorOffsetsToCurrentRect = (
  frameNode: HTMLElement | null | undefined,
  pageInner?: HTMLElement | null
) => {
  const resolvedPageInner = pageInner || frameNode?.closest<HTMLElement>('.page-inner') || null;

  if (!frameNode || !resolvedPageInner) {
    return null;
  }

  const currentConfig = ensureFrameRelativeAnchorConfig(frameNode, resolvedPageInner);

  if (!currentConfig) {
    return null;
  }

  const anchorRect = resolveRelativeAnchorRect(resolvedPageInner, currentConfig);

  if (!anchorRect) {
    return null;
  }

  const nextConfig = buildRelativeAnchorConfigFromRect({
    frameRect: readFrameMoveRect(frameNode),
    anchorRect,
    anchorKind: currentConfig.anchorKind,
    anchorId: currentConfig.anchorId,
    preferredAnchorX: currentConfig.anchorX,
    preferredAnchorY: currentConfig.anchorY,
  });
  writeFrameRelativeAnchorAttrs(frameNode, nextConfig);
  return nextConfig;
};

const applyRelativeAnchoredFrameRects = (pageInner: HTMLElement, excludedFrameGroupIds: string[] = []) => {
  const excludedFrameGroupIdSet = new Set(excludedFrameGroupIds);
  const relativeNodes = collectFrameSelectionAnchors(pageInner).filter((node) =>
    Boolean(ensureFrameRelativeAnchorConfig(node, pageInner))
  );

  for (let pass = 0; pass < 3; pass += 1) {
    relativeNodes.forEach((node) => {
      const frameGroupId = getFrameGroupId(node);

      if (!frameGroupId || excludedFrameGroupIdSet.has(frameGroupId)) {
        return;
      }

      const config = ensureFrameRelativeAnchorConfig(node, pageInner);

      if (!config) {
        return;
      }

      const anchorRect = resolveRelativeAnchorRect(pageInner, config);

      if (!anchorRect) {
        return;
      }

      const currentRect = readFrameMoveRect(node);
      const nextRect = buildFrameRectFromRelativeAnchor(currentRect, anchorRect, config);

      if (
        Math.abs(nextRect.left - currentRect.left) <= 0.5 &&
        Math.abs(nextRect.top - currentRect.top) <= 0.5
      ) {
        return;
      }

      writeFrameMoveRect(node, nextRect);
    });
  }
};

const ensureRelativeAnchorConfigs = (scope: ParentNode) => {
  Array.from(scope.querySelectorAll<HTMLElement>('.page-inner')).forEach((pageInner) => {
    collectFrameSelectionAnchors(pageInner).forEach((node) => {
      writeFramePositionModeAttrs(node, readFramePositionMode(node, pageInner));
      ensureFrameRelativeAnchorConfig(node, pageInner);
    });
  });
};

const applyRelativeAnchoredFrameRectsInRoot = (root: ParentNode, excludedFrameGroupIds: string[] = []) => {
  Array.from(root.querySelectorAll<HTMLElement>('.page-inner')).forEach((pageInner) => {
    applyRelativeAnchoredFrameRects(pageInner, excludedFrameGroupIds);
  });
};

const rebaseRelativeAnchorConfigForResizeDirection = (
  frameNode: HTMLElement,
  pageInner: HTMLElement,
  direction: TemplateFrameResizeDirection
) => {
  const currentConfig = readFrameRelativeAnchorConfig(frameNode, pageInner);

  if (!currentConfig || currentConfig.positionMode !== 'relative') {
    return;
  }

  const anchorRect = resolveRelativeAnchorRect(pageInner, currentConfig);
  if (!anchorRect) {
    return;
  }

  const preferredAnchorX = direction.includes('e')
    ? ('left' as const)
    : direction.includes('w')
      ? ('right' as const)
      : currentConfig.anchorX;
  const preferredAnchorY = direction.includes('s')
    ? ('top' as const)
    : direction.includes('n')
      ? ('bottom' as const)
      : currentConfig.anchorY;

  const nextConfig = buildRelativeAnchorConfigFromRect({
    frameRect: readFrameMoveRect(frameNode),
    anchorRect,
    anchorKind: currentConfig.anchorKind,
    anchorId: currentConfig.anchorId,
    preferredAnchorX,
    preferredAnchorY,
  });

  writeFrameRelativeAnchorAttrs(frameNode, nextConfig);
};

const appendRelativeAnchorGuideSegment = (
  pageInner: HTMLElement,
  rect: FrameNodeRect,
  orientation: 'horizontal' | 'vertical'
) => {
  const guide = document.createElement('div');
  guide.className = FRAME_RELATIVE_ANCHOR_GUIDE_CLASS;
  guide.setAttribute('data-frame-editor-ui', 'true');
  guide.setAttribute('data-relative-guide-orientation', orientation);
  guide.style.left = toFrameCssPx(rect.left);
  guide.style.top = toFrameCssPx(rect.top);
  guide.style.width = toFrameCssPx(Math.max(1, rect.width));
  guide.style.height = toFrameCssPx(Math.max(1, rect.height));
  pageInner.appendChild(guide);
};

const appendRelativeAnchorGuideBadge = (
  host: HTMLElement,
  point: { x: number; y: number },
  text: string,
  role: 'anchor' | 'source' | 'relation-gap'
) => {
  const badge = document.createElement('div');
  badge.className = FRAME_RELATIVE_ANCHOR_BADGE_CLASS;
  badge.setAttribute('data-frame-editor-ui', 'true');
  badge.setAttribute('data-relative-anchor-role', role);
  badge.textContent = text;
  badge.style.left = toFrameCssPx(point.x);
  badge.style.top = toFrameCssPx(point.y);
  host.appendChild(badge);
};

const appendFrameKindMarker = (
  frameNode: HTMLElement,
  boxKind: TemplateFrameBoxKind | '',
  role: TemplateFrameRole | 'group' | ''
) => {
  const shell = resolveFrameLayoutShell(frameNode);
  const hostRect = shell.getBoundingClientRect();
  const compact = hostRect.width < 72 || hostRect.height < 16;
  const marker = document.createElement('div');
  marker.className = FRAME_KIND_MARKER_CLASS;
  marker.setAttribute('data-box-kind', boxKind || 'null');
  marker.setAttribute('data-frame-role', role || 'null');
  marker.setAttribute('data-compact', compact ? 'true' : 'false');
  marker.setAttribute(
    'data-tooltip',
    `${boxKind ? FRAME_BOX_KIND_SHORT_LABELS[boxKind] : 'null'} · ${role ? FRAME_ROLE_SHORT_LABELS[role] : 'null'}`
  );
  shell.setAttribute('data-template-frame-marker-host', 'true');
  marker.innerHTML = renderFrameMetadataMarkerMarkup(boxKind, role, compact);
  shell.appendChild(marker);
};

const renderRelativeAnchorGuides = (
  root: HTMLElement,
  selectedIds: string[],
  guideFrameGroupId?: string | null
) => {
  const primarySelectedId = guideFrameGroupId?.trim() || selectedIds[0];

  if (!primarySelectedId) {
    return;
  }

  const frameNode = resolveFrameSelectionAnchor(
    root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${primarySelectedId}"]`)
  );
  const pageInner = frameNode?.closest<HTMLElement>('.page-inner') || null;

  if (!frameNode || !pageInner) {
    return;
  }

  const config = ensureFrameRelativeAnchorConfig(frameNode, pageInner);

  if (!config) {
    return;
  }

  const anchorRect = resolveRelativeAnchorRect(pageInner, config);

  if (!anchorRect) {
    return;
  }

  const sourceRect = readFrameMoveRect(frameNode);
  const sourcePoint = {
    x: config.anchorX === 'left' ? sourceRect.left : sourceRect.left + sourceRect.width,
    y: config.anchorY === 'top' ? sourceRect.top : sourceRect.top + sourceRect.height,
  };
  const anchorPoint = {
    x: config.anchorX === 'left' ? anchorRect.left : anchorRect.left + anchorRect.width,
    y: config.anchorY === 'top' ? anchorRect.top : anchorRect.top + anchorRect.height,
  };

  appendRelativeAnchorGuideSegment(
    pageInner,
    {
      left: Math.min(sourcePoint.x, anchorPoint.x),
      top: sourcePoint.y,
      width: Math.abs(anchorPoint.x - sourcePoint.x),
      height: 1,
    },
    'horizontal'
  );
  appendRelativeAnchorGuideSegment(
    pageInner,
    {
      left: anchorPoint.x,
      top: Math.min(sourcePoint.y, anchorPoint.y),
      width: 1,
      height: Math.abs(anchorPoint.y - sourcePoint.y),
    },
    'vertical'
  );
  appendRelativeAnchorGuideBadge(
    pageInner,
    {
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top - 8,
    },
    `상대 위치: ${readRelativeAnchorTargetLabel(config) || '-'}`,
    'source'
  );

  if (config.anchorKind === 'frame') {
    const anchorNode = resolveFrameSelectionAnchor(
      pageInner.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${config.anchorId}"]`)
    );

    if (!anchorNode) {
      return;
    }

    anchorNode.setAttribute('data-template-relative-anchor-target', 'true');
    const anchorBadge = document.createElement('div');
    anchorBadge.className = FRAME_RELATIVE_ANCHOR_BADGE_CLASS;
    anchorBadge.setAttribute('data-frame-editor-ui', 'true');
    anchorBadge.setAttribute('data-relative-anchor-role', 'anchor');
    anchorBadge.textContent = `기준: ${config.anchorId}`;
    anchorBadge.style.left = '50%';
    anchorBadge.style.top = '-4px';
    anchorNode.appendChild(anchorBadge);
    return;
  }

  appendRelativeAnchorGuideBadge(pageInner, anchorPoint, readRelativeAnchorTargetLabel(config) || config.anchorId, 'anchor');
};

const isInteractiveTarget = (target: HTMLElement | null) => {
  const interactive = target?.closest<HTMLElement>(
    'input, textarea, select, option, button, a, [contenteditable="true"], [data-template-frame-input="true"]'
  );

  if (!interactive) {
    return false;
  }

  if (
    (interactive instanceof HTMLTextAreaElement || interactive instanceof HTMLInputElement) &&
    (interactive.readOnly || interactive.disabled)
  ) {
    return false;
  }

  if (
    (interactive instanceof HTMLButtonElement ||
      interactive instanceof HTMLSelectElement ||
      interactive instanceof HTMLOptionElement) &&
    interactive.disabled
  ) {
    return false;
  }

  return true;
};

const syncFormControlMarkup = (root: ParentNode) => {
  root.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((element) => {
    element.textContent = element.value;
  });

  root.querySelectorAll<HTMLInputElement>('input').forEach((element) => {
    if (element.type === 'checkbox' || element.type === 'radio') {
      if (element.checked) {
        element.setAttribute('checked', 'checked');
      } else {
        element.removeAttribute('checked');
      }
      return;
    }

    element.setAttribute('value', element.value);
  });
};

const stripSelectionAttrs = (
  root: ParentNode,
  options?: {
    preserveFrameVisualHints?: boolean;
  }
) => {
  root.querySelectorAll<HTMLElement>('[data-template-selected="true"]').forEach((element) => {
    element.removeAttribute('data-template-selected');
    element.removeAttribute('data-template-primary-selected');
    element.removeAttribute('data-template-selection-order');
  });
  root.querySelectorAll<HTMLElement>('[data-template-edge-visual="true"], [data-template-edge-anchor-node="true"]').forEach((element) => {
    element.removeAttribute('data-template-edge-visual');
    element.removeAttribute('data-template-edge-anchor-node');
  });
  root.querySelectorAll<HTMLElement>('[data-template-edit-enabled]').forEach((element) => {
    element.removeAttribute('data-template-edit-enabled');
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_NATIVE_OUTLINE_HIDDEN_ATTR}="true"]`).forEach((element) => {
    element.removeAttribute(TEMPLATE_NATIVE_OUTLINE_HIDDEN_ATTR);
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}]`).forEach((element) => {
    if (!options?.preserveFrameVisualHints) {
      element.removeAttribute(TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR);
    }
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_ROLE_VISUAL_ATTR}]`).forEach((element) => {
    if (!options?.preserveFrameVisualHints) {
      element.removeAttribute(TEMPLATE_FRAME_ROLE_VISUAL_ATTR);
    }
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_BOX_KIND_VISUAL_ATTR}]`).forEach((element) => {
    if (!options?.preserveFrameVisualHints) {
      element.removeAttribute(TEMPLATE_FRAME_BOX_KIND_VISUAL_ATTR);
    }
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}]`).forEach((element) => {
    element.removeAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR);
  });
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR}]`).forEach((element) => {
    element.removeAttribute(TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR);
  });
};

const clearFrameValidationErrorUi = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>(`[${TEMPLATE_FRAME_VALIDATION_ERROR_ATTR}="true"]`).forEach((element) => {
    element.removeAttribute(TEMPLATE_FRAME_VALIDATION_ERROR_ATTR);
  });
};

const stripFrameMetadataMarkers = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>(`.${FRAME_KIND_MARKER_CLASS}`).forEach((element) => {
    element.remove();
  });
  root.querySelectorAll<HTMLElement>('[data-template-frame-marker-host="true"]').forEach((element) => {
    element.removeAttribute('data-template-frame-marker-host');
  });
};

const applyFrameValidationErrorUi = (root: HTMLElement, frameGroupIds: string[]) => {
  clearFrameValidationErrorUi(root);

  if (frameGroupIds.length === 0) {
    return;
  }

  const errorIdSet = new Set(frameGroupIds);
  collectFrameSelectionAnchors(root).forEach((node) => {
    if (errorIdSet.has(getFrameGroupId(node))) {
      node.setAttribute(TEMPLATE_FRAME_VALIDATION_ERROR_ATTR, 'true');
    }
  });
};

const extractEditorHtml = (root: HTMLElement) => {
  const container = document.createElement('div');
  container.innerHTML = root.innerHTML;
  syncFormControlMarkup(container);
  denormalizePreviewFrameBands(container);
  stripTransientFrameEditorUi(container);
  stripSelectionAttrs(container);
  clearFrameValidationErrorUi(container);
  stripFrameMetadataMarkers(container);
  TemplateFrameEditHtmlService.stripEditorUiState(container);
  return container.innerHTML.trim();
};

const extractPreviewRenderHtml = (root: HTMLElement) => {
  const container = document.createElement('div');
  container.innerHTML = root.innerHTML;
  syncFormControlMarkup(container);
  stripTransientFrameEditorUi(container);
  stripSelectionAttrs(container);
  clearFrameValidationErrorUi(container);
  TemplateFrameEditHtmlService.stripEditorUiState(container);
  return container.innerHTML.trim();
};

const applyPreviewEditPermissions = (root: HTMLElement) => {
  root.querySelectorAll<HTMLElement>('[data-template-edit-scope]').forEach((element) => {
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('data-template-edit-enabled', 'true');
  });
  primeFrameContentScaleMetrics(root);
  collectFrameSelectionAnchors(root).forEach((node) => {
    stabilizeFrameContentHeight(node);
  });
};

const applyFrameCanvasVisualHints = (root: HTMLElement) => {
  const frameNodes = collectFrameSelectionAnchors(root);
  const parentGroupIds = new Set(frameNodes.map((node) => readFrameParentGroupId(node)).filter(Boolean));
  root.querySelectorAll<HTMLElement>(`.${FRAME_KIND_MARKER_CLASS}`).forEach((element) => {
    element.remove();
  });

  frameNodes.forEach((node) => {
    const boxKind = readFrameBoxKind(node);
    const role = readFrameRole(node);
    const frameGroupId = getFrameGroupId(node);
    const isKeyLike = role ? role === 'key' || role === 'group' || parentGroupIds.has(frameGroupId) : false;

    node.setAttribute(TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR, isKeyLike ? 'full' : 'muted');
    if (role) {
      node.setAttribute(TEMPLATE_FRAME_ROLE_VISUAL_ATTR, role);
    } else {
      node.removeAttribute(TEMPLATE_FRAME_ROLE_VISUAL_ATTR);
    }
    if (boxKind) {
      node.setAttribute(TEMPLATE_FRAME_BOX_KIND_VISUAL_ATTR, boxKind);
    } else {
      node.removeAttribute(TEMPLATE_FRAME_BOX_KIND_VISUAL_ATTR);
    }
    appendFrameKindMarker(node, boxKind, role);
  });
};

const applyFrameRelationSelectionUi = (
  root: HTMLElement,
  relationMode: FrameRelationPreviewMode,
  selectedFrameGroupIds: string[] = []
) => {
  const frameNodes = collectFrameSelectionAnchors(root);
  root.querySelectorAll<HTMLElement>(`.${FRAME_RELATION_BADGE_CLASS}`).forEach((element) => {
    element.remove();
  });

  frameNodes.forEach((node) => {
    node.removeAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR);
  });

  if (root.getAttribute('data-selection-panel-tab') === 'position') {
    return;
  }

  const valueIdsByKeyId = new Map<string, string[]>();
  const keyIdsByValueId = new Map<string, string>();

  frameNodes.forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    const role = readFrameRole(node);
    const parentGroupId = readFrameParentGroupId(node);

    if (role === 'value' && parentGroupId) {
      const current = valueIdsByKeyId.get(parentGroupId) || [];
      current.push(frameGroupId);
      valueIdsByKeyId.set(parentGroupId, current);
      keyIdsByValueId.set(frameGroupId, parentGroupId);
    }
  });

  const activeRelationFrameIds = new Set<string>();
  selectedFrameGroupIds.forEach((frameGroupId) => {
    const linkedValueIds = valueIdsByKeyId.get(frameGroupId) || [];
    if (linkedValueIds.length > 0) {
      activeRelationFrameIds.add(frameGroupId);
      linkedValueIds.forEach((linkedValueId) => activeRelationFrameIds.add(linkedValueId));
      return;
    }

    const parentGroupId = keyIdsByValueId.get(frameGroupId) || '';
    if (!parentGroupId) {
      return;
    }

    activeRelationFrameIds.add(frameGroupId);
    activeRelationFrameIds.add(parentGroupId);
    (valueIdsByKeyId.get(parentGroupId) || []).forEach((linkedValueId) => activeRelationFrameIds.add(linkedValueId));
  });

  frameNodes.forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    const role = readFrameRole(node);
    const hasLinkedValues = role === 'key' && (valueIdsByKeyId.get(frameGroupId)?.length || 0) > 0;
    const isLinkedValue = role === 'value' && Boolean(keyIdsByValueId.get(frameGroupId));
    const isActive = activeRelationFrameIds.has(frameGroupId);

    if (hasLinkedValues) {
      node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, isActive ? 'linked-key' : 'passive-key');
      return;
    }

    if (isLinkedValue) {
      node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, isActive ? 'linked-value' : 'passive-value');
    }
  });

  if (relationMode.kind === 'parent-select' || relationMode.kind === 'parent-linked') {
    const sourceIds = new Set(relationMode.sourceFrameGroupIds);
    const linkedKeyFrameGroupId = relationMode.kind === 'parent-linked' ? relationMode.keyFrameGroupId : '';
    frameNodes.forEach((node) => {
      const frameGroupId = getFrameGroupId(node);

      if (frameGroupId === linkedKeyFrameGroupId) {
        node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, 'linked-key');
        return;
      }

      if (sourceIds.has(frameGroupId)) {
        node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, 'linked-value');
        return;
      }

      if (relationMode.kind === 'parent-select' && readFrameBoxKind(node) === 'text') {
        node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, 'parent-candidate');
      }
    });
    return;
  }

  const targetIds = new Set(relationMode.targetFrameGroupIds);
  frameNodes.forEach((node) => {
    const frameGroupId = getFrameGroupId(node);

    if (frameGroupId === relationMode.sourceKeyFrameGroupId) {
      node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, 'linked-key');
      return;
    }

    if (targetIds.has(frameGroupId)) {
      node.setAttribute(TEMPLATE_FRAME_RELATION_SELECTION_ATTR, 'linked-value');
    }
  });
};

const applyPositionImpactGroupSelectionUi = (
  root: HTMLElement,
  selectionPanelTab: SelectionPanelTab,
  _selectedFrameGroupIds: string[] = [],
  _positionRelationAnchorFrameGroupId: string = ''
) => {
  const frameNodes = collectFrameSelectionAnchors(root);

  frameNodes.forEach((node) => {
    node.removeAttribute(TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR);
  });

  if (selectionPanelTab !== 'position') {
    return;
  }

  const boxGroups = collectPositionBoxGroups(root, { includeSingletons: false }).filter(
    (group) => group.frameGroupIds.length > 1
  );

  if (boxGroups.length <= 0) {
    return;
  }

  const groupIdByFrameGroupId = new Map<string, string>();
  boxGroups.forEach((group) => {
    group.frameGroupIds.forEach((frameGroupId) => {
      groupIdByFrameGroupId.set(frameGroupId, group.id);
    });
  });

  frameNodes.forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    const groupId = frameGroupId ? groupIdByFrameGroupId.get(frameGroupId) : '';

    if (!groupId) {
      return;
    }

    node.setAttribute(TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR, groupId);
  });
};

const applyDefinedPositionRelativeRelationUi = (
  root: HTMLElement,
  selectionPanelTab: SelectionPanelTab,
  relations: DefinedPositionRelativeRelation[] = []
) => {
  const frameNodes = collectFrameSelectionAnchors(root);
  frameNodes.forEach((node) => {
    node.removeAttribute(TEMPLATE_FRAME_POSITION_RELATION_ACTIVE_ATTR);
    node.removeAttribute(TEMPLATE_FRAME_POSITION_RELATION_ANCHOR_ATTR);
  });

  root.querySelectorAll<HTMLElement>('[data-v106-position-relation-gap="true"]').forEach((element) => {
    element.remove();
  });

  if (selectionPanelTab !== 'position' || relations.length <= 0) {
    return;
  }

  const frameNodeById = new Map<string, HTMLElement>();
  frameNodes.forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, node);
    }
  });

  const resolveRectFromFrameGroupIds = (frameGroupIds: string[]) => {
    const memberRects = frameGroupIds
      .map((frameGroupId) => {
        const memberNode = frameNodeById.get(frameGroupId) || null;
        return memberNode ? readFrameMoveRect(memberNode) : null;
      })
      .filter((rect): rect is FrameNodeRect => Boolean(rect));

    if (memberRects.length <= 0) {
      return null;
    }

    const minLeft = Math.min(...memberRects.map((rect) => rect.left));
    const minTop = Math.min(...memberRects.map((rect) => rect.top));
    const maxRight = Math.max(...memberRects.map((rect) => rect.left + rect.width));
    const maxBottom = Math.max(...memberRects.map((rect) => rect.top + rect.height));
    return {
      left: minLeft,
      top: minTop,
      width: Math.max(1, maxRight - minLeft),
      height: Math.max(1, maxBottom - minTop),
    };
  };

  const proxySelections: PositionGroupProxySelection[] = [];
  const proxySelectionOrderByKey = new Map<string, number>();
  const ensureProxySelection = (relationKey: string, frameGroupIds: string[]) => {
    if (frameGroupIds.length <= 1) {
      return;
    }

    if (proxySelectionOrderByKey.has(relationKey)) {
      return;
    }

    const selectionOrder = proxySelectionOrderByKey.size + 1;
    proxySelectionOrderByKey.set(relationKey, selectionOrder);
    proxySelections.push({
      groupId: relationKey,
      label: relationKey,
      frameGroupIds: frameGroupIds.slice(),
      selectionOrder,
    });
  };

  relations.forEach((relation) => {
    if (relation.targetKind === 'group') {
      ensureProxySelection(`target:${relation.targetGroupId || relation.targetFrameGroupIds.join(',')}`, relation.targetFrameGroupIds);
    } else {
      relation.targetFrameGroupIds.forEach((frameGroupId) => {
        const targetNode = frameNodeById.get(frameGroupId) || null;
        if (targetNode) {
          targetNode.setAttribute(TEMPLATE_FRAME_POSITION_RELATION_ACTIVE_ATTR, 'true');
        }
      });
    }

    if (relation.anchorKind === 'group') {
      ensureProxySelection(`anchor:${relation.anchorGroupId || relation.anchorFrameGroupIds.join(',')}`, relation.anchorFrameGroupIds);
    } else if (relation.anchorKind === 'frame') {
      const anchorNode = frameNodeById.get(relation.anchorFrameGroupId) || null;
      if (anchorNode) {
        anchorNode.setAttribute(TEMPLATE_FRAME_POSITION_RELATION_ANCHOR_ATTR, 'true');
      }
    }

    const targetHostNode =
      relation.targetConfiguredFrameGroupIds
        .map((frameGroupId) => frameNodeById.get(frameGroupId) || null)
        .find((node): node is HTMLElement => Boolean(node)) || null;
    const hostNode =
      targetHostNode ||
      frameNodeById.get(relation.anchorFrameGroupId) ||
      null;
    const hostPageInner = hostNode?.closest<HTMLElement>('.page-inner') || null;
    const targetRect = resolveRectFromFrameGroupIds(relation.targetFrameGroupIds);
    const anchorRect =
      relation.anchorKind === 'page-corner' && hostPageInner
        ? resolvePageCornerAnchorRect(hostPageInner, relation.anchorPageCornerId)
        : resolveRectFromFrameGroupIds(relation.anchorFrameGroupIds);

    if (!targetRect || !anchorRect || !hostPageInner) {
      return;
    }

    const centerX = targetRect.left + targetRect.width / 2;
    const targetTop = targetRect.top;
    const anchorBottom = anchorRect.top + anchorRect.height;
    const centerY = Math.min(targetTop, anchorBottom) + Math.abs(targetTop - anchorBottom) / 2;
    const badge = document.createElement('div');
    badge.className = FRAME_RELATIVE_ANCHOR_BADGE_CLASS;
    badge.setAttribute('data-frame-editor-ui', 'true');
    badge.setAttribute('data-v106-position-relation-gap', 'true');
    badge.setAttribute('data-relative-anchor-role', 'relation-gap');
    badge.textContent = `간격 ${relation.gapYPx}px`;
    badge.style.left = toFrameCssPx(centerX);
    badge.style.top = toFrameCssPx(centerY);
    hostPageInner.appendChild(badge);
  });

  if (proxySelections.length > 0) {
    appendPositionGroupProxyOverlay(root, proxySelections);
  }
};

const applyPositionSpacingGuideUi = (
  root: HTMLElement,
  selectionPanelTab: SelectionPanelTab,
  relations: PositionSpacingGuideRelation[] = []
) => {
  root.querySelectorAll<HTMLElement>('[data-v106-position-spacing-guide="true"]').forEach((element) => {
    element.remove();
  });

  if (selectionPanelTab !== 'position' || relations.length <= 0) {
    return;
  }

  relations.forEach((relation) => {
    const anchorNode =
      relation.anchorFrameGroupIds
        .map((frameGroupId) =>
          resolveFrameSelectionAnchor(
            root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
          )
        )
        .find((node): node is HTMLElement => Boolean(node)) || null;
    const targetNode =
      relation.targetFrameGroupIds
        .map((frameGroupId) =>
          resolveFrameSelectionAnchor(
            root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
          )
        )
        .find((node): node is HTMLElement => Boolean(node)) || null;
    const pageInner =
      anchorNode?.closest<HTMLElement>('.page-inner') ||
      targetNode?.closest<HTMLElement>('.page-inner') ||
      null;

    if (!pageInner) {
      return;
    }

    const anchorEdgeY =
      relation.anchorY === 'bottom'
        ? relation.anchorReferenceRect.top + relation.anchorReferenceRect.height
        : relation.anchorReferenceRect.top;
    const targetEdgeY =
      relation.anchorY === 'bottom'
        ? relation.targetReferenceRect.top
        : relation.targetReferenceRect.top + relation.targetReferenceRect.height;
    const anchorCenterX = relation.anchorReferenceRect.left + relation.anchorReferenceRect.width / 2;
    const targetCenterX = relation.targetReferenceRect.left + relation.targetReferenceRect.width / 2;
    const lineX = (anchorCenterX + targetCenterX) / 2;
    const topY = Math.min(anchorEdgeY, targetEdgeY);
    const lineHeight = Math.max(1, Math.abs(targetEdgeY - anchorEdgeY));
    const capWidth = 12;
    const capHalf = capWidth / 2;

    const verticalLine = document.createElement('div');
    verticalLine.className = FRAME_RELATIVE_ANCHOR_GUIDE_CLASS;
    verticalLine.setAttribute('data-frame-editor-ui', 'true');
    verticalLine.setAttribute('data-v106-position-spacing-guide', 'true');
    verticalLine.setAttribute('data-relative-guide-orientation', 'vertical');
    verticalLine.style.left = toFrameCssPx(lineX);
    verticalLine.style.top = toFrameCssPx(topY);
    verticalLine.style.width = toFrameCssPx(1);
    verticalLine.style.height = toFrameCssPx(lineHeight);
    pageInner.appendChild(verticalLine);

    const startCap = document.createElement('div');
    startCap.className = FRAME_RELATIVE_ANCHOR_GUIDE_CLASS;
    startCap.setAttribute('data-frame-editor-ui', 'true');
    startCap.setAttribute('data-v106-position-spacing-guide', 'true');
    startCap.setAttribute('data-relative-guide-orientation', 'horizontal');
    startCap.style.left = toFrameCssPx(lineX - capHalf);
    startCap.style.top = toFrameCssPx(anchorEdgeY);
    startCap.style.width = toFrameCssPx(capWidth);
    startCap.style.height = toFrameCssPx(1);
    pageInner.appendChild(startCap);

    const endCap = document.createElement('div');
    endCap.className = FRAME_RELATIVE_ANCHOR_GUIDE_CLASS;
    endCap.setAttribute('data-frame-editor-ui', 'true');
    endCap.setAttribute('data-v106-position-spacing-guide', 'true');
    endCap.setAttribute('data-relative-guide-orientation', 'horizontal');
    endCap.style.left = toFrameCssPx(lineX - capHalf);
    endCap.style.top = toFrameCssPx(targetEdgeY);
    endCap.style.width = toFrameCssPx(capWidth);
    endCap.style.height = toFrameCssPx(1);
    pageInner.appendChild(endCap);

    const labelBadge = document.createElement('div');
    labelBadge.className = FRAME_RELATIVE_ANCHOR_BADGE_CLASS;
    labelBadge.setAttribute('data-frame-editor-ui', 'true');
    labelBadge.setAttribute('data-v106-position-spacing-guide', 'true');
    labelBadge.setAttribute('data-relative-anchor-role', 'spacing-gap');
    labelBadge.textContent = `${relation.anchorLabel} ↔ ${relation.targetLabel} · ${Math.round(relation.gapYPx)}px`;
    labelBadge.style.left = toFrameCssPx(lineX + 10);
    labelBadge.style.top = toFrameCssPx(topY + lineHeight / 2);
    pageInner.appendChild(labelBadge);
  });
};

const syncPreviewSurfaceSelectionPanelTabAttr = (root: HTMLElement, selectionPanelTab: SelectionPanelTab) => {
  root.setAttribute('data-selection-panel-tab', selectionPanelTab);
};

const syncPreviewSurfaceCloneAttrs = (root: HTMLElement) => {
  const source =
    root.querySelector<HTMLElement>(':scope > .page-inner') ||
    root.querySelector<HTMLElement>(':scope > section.page > .page-inner') ||
    root.querySelector<HTMLElement>('.page-inner');

  (
    [
      'data-template-extraction-stage',
      'data-template-frame-group-version',
      'data-template-clone-id',
      'data-page',
    ] as const
  ).forEach((attrName) => {
    const nextValue = source?.getAttribute(attrName)?.trim() || '';

    if (nextValue) {
      root.setAttribute(attrName, nextValue);
      return;
    }

    root.removeAttribute(attrName);
  });
};

const markTemplateValueElementEdited = (element: HTMLElement) => {
  element.setAttribute('data-template-edited', 'true');
  element
    .closest('.v201-choice-row, .v202-line--choice')
    ?.setAttribute('data-template-edited', 'true');
};

const toggleChoiceBoxElement = (element: HTMLElement) => {
  const nextValue = element.getAttribute('data-checked') === '1' ? '0' : '1';
  element.setAttribute('data-checked', nextValue);
  element.setAttribute('aria-checked', nextValue === '1' ? 'true' : 'false');
  markTemplateValueElementEdited(element);
};

const rgbChannelToHex = (value: number) => value.toString(16).padStart(2, '0');

const colorToHex = (value: string) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized === 'transparent') {
    return 'transparent';
  }

  if (normalized.startsWith('#')) {
    if (normalized.length === 4) {
      return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
    }

    return normalized.toLowerCase();
  }

  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!rgbMatch) {
    return normalized;
  }

  const alphaMatch = normalized.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([0-9.]+)\)/i);

  if (alphaMatch && Number.parseFloat(alphaMatch[1] || '1') <= 0) {
    return 'transparent';
  }

  const [, r, g, b] = rgbMatch;
  return `#${rgbChannelToHex(Number.parseInt(r, 10))}${rgbChannelToHex(Number.parseInt(g, 10))}${rgbChannelToHex(Number.parseInt(b, 10))}`.toLowerCase();
};

const normalizeNumericStyleValue = (value: string) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(2))) : '';
};

const getSharedValue = (values: string[]) => {
  const normalizedValues = values.map((value) => String(value || ''));
  const [first] = normalizedValues;

  if (normalizedValues.every((value) => value === first)) {
    return first;
  }

  return '';
};

const resolveFrameContentTarget = (node: HTMLElement) => {
  return (
    node.querySelector<HTMLElement>('[data-template-frame-input="true"]') ||
    node.querySelector<HTMLElement>('[data-template-value]') ||
    node.querySelector<HTMLElement>('[data-template-edit-scope]') ||
    node
  );
};

const readFrameDisplayText = (node: HTMLElement | null | undefined) => {
  if (!node) {
    return '';
  }

  const contentTarget = resolveFrameContentTarget(node);

  if (contentTarget instanceof HTMLTextAreaElement) {
    return String(contentTarget.value || contentTarget.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return String(contentTarget.textContent || '').replace(/\s+/g, ' ').trim();
};

const deriveFrameValueKey = (
  node: HTMLElement,
  frameNodeById: Map<string, HTMLElement>,
  resolvedMetadata?: ResolvedFrameMetadata | null
) => {
  const metadata = resolvedMetadata || resolveNextFrameMetadata(node, {});
  const frameGroupId = getFrameGroupId(node);

  if (isStatusHistoryFrameNode(node)) {
    return '상태 이력';
  }

  if (metadata.role === 'value' && metadata.parentGroupId) {
    const parentNode = frameNodeById.get(metadata.parentGroupId) || null;
    const parentLabel =
      normalizeFrameValueKey(readFrameDisplayText(parentNode || null)) ||
      normalizeFrameValueKey(parentNode ? readFrameValueKey(parentNode) : '') ||
      metadata.parentGroupId;
    return parentLabel;
  }

  if (metadata.role === 'key_value') {
    return normalizeFrameValueKey(readFrameDisplayText(node)) || frameGroupId;
  }

  return '';
};

const syncFrameRelationshipValueKeys = (root: HTMLElement, metadataById?: Map<string, ResolvedFrameMetadata>) => {
  const frameNodes = collectFrameSelectionAnchors(root);
  const frameNodeById = new Map(frameNodes.map((node) => [getFrameGroupId(node), node] as const));

  frameNodes.forEach((node) => {
    const nextValueKey = deriveFrameValueKey(node, frameNodeById, metadataById?.get(getFrameGroupId(node)) || null);
    applyFrameMetadataPatch(node, { valueKey: nextValueKey });
  });
};

const buildResizeHandle = (direction: TemplateFrameResizeDirection) => {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.setAttribute('data-v106-resize-handle', 'true');
  handle.setAttribute('data-frame-editor-ui', 'true');
  handle.setAttribute('data-direction', direction);
  handle.setAttribute('aria-label', `${direction} resize`);
  return handle;
};

const getCardinalEdgeSideFromDirection = (direction: TemplateFrameResizeDirection): TemplateEdgeSide | null => {
  if (direction === 'w') {
    return 'left';
  }

  if (direction === 'e') {
    return 'right';
  }

  if (direction === 'n') {
    return 'top';
  }

  if (direction === 's') {
    return 'bottom';
  }

  return null;
};

const getDirectionFromEdgeSide = (side: TemplateEdgeSide): TemplateFrameResizeDirection => {
  if (side === 'left') {
    return 'w';
  }

  if (side === 'right') {
    return 'e';
  }

  if (side === 'top') {
    return 'n';
  }

  return 's';
};

const buildEdgeSelectionButton = (
  side: TemplateEdgeSide,
  edgeId: string,
  selectionOrder: number | null,
  mode: 'connected' | 'isolated' | 'idle',
  isAnchorEdge: boolean,
  role: TemplateEdgeSelectionRole | null,
  hasMovementMismatch: boolean
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-v106-edge-button', 'true');
  button.setAttribute('data-frame-editor-ui', 'true');
  button.setAttribute('data-direction', getDirectionFromEdgeSide(side));
  button.setAttribute('data-edge-id', edgeId);
  button.setAttribute('data-side', side);
  button.setAttribute('data-edge-selection-mode', mode);
  if (selectionOrder !== null) {
    button.setAttribute('data-edge-selection-order', String(selectionOrder));
  }
  if (isAnchorEdge) {
    button.setAttribute('data-edge-anchor', 'true');
  }
  if (role) {
    button.setAttribute('data-edge-selection-role', role);
  }
  if (hasMovementMismatch) {
    button.setAttribute('data-edge-movement-mismatch', 'true');
  }
  button.setAttribute('aria-label', `${side} edge resize`);
  return button;
};

const resolveVisibleBorderValue = (
  primaryStyle: CSSStyleDeclaration | null,
  fallbackStyle: CSSStyleDeclaration | null,
  side: 'top' | 'right' | 'bottom' | 'left'
) => {
  const borderWidthProperty = `border${side[0].toUpperCase()}${side.slice(1)}Width` as const;
  const borderProperty = `border${side[0].toUpperCase()}${side.slice(1)}` as const;
  const primaryWidth = primaryStyle ? parseFramePx(primaryStyle[borderWidthProperty]) : 0;

  if (primaryWidth > 0 && primaryStyle) {
    return primaryStyle[borderProperty];
  }

  const fallbackWidth = fallbackStyle ? parseFramePx(fallbackStyle[borderWidthProperty]) : 0;
  return fallbackWidth > 0 && fallbackStyle ? fallbackStyle[borderProperty] : '';
};

const parseFrameBorderDefinition = (borderValue: string) => {
  const match = borderValue.trim().match(/^([0-9.]+)px\s+(\S+)\s+(.+)$/);

  if (!match) {
    return null;
  }

  const width = Number.parseFloat(match[1] || '0');
  const style = match[2] || 'solid';
  const color = match[3] || 'transparent';

  if (!Number.isFinite(width) || width <= 0 || style === 'none') {
    return null;
  }

  return { width, style, color, cssText: borderValue };
};

const isTransparentFrameBorderColor = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (normalized === 'transparent') {
    return true;
  }

  if (/rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) {
    return true;
  }

  if (/hsla\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) {
    return true;
  }

  return false;
};

const parseVisibleFrameBorderDefinition = (borderValue: string) => {
  const border = parseFrameBorderDefinition(borderValue);

  if (!border || isTransparentFrameBorderColor(border.color)) {
    return null;
  }

  return border;
};

const mergeFrameOutlineAxisRanges = (ranges: FrameOutlineAxisRange[]) => {
  if (ranges.length === 0) {
    return [] as FrameOutlineAxisRange[];
  }

  const sorted = [...ranges]
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((left, right) => left.start - right.start);

  if (sorted.length === 0) {
    return [] as FrameOutlineAxisRange[];
  }

  const merged: FrameOutlineAxisRange[] = [{ ...sorted[0] }];

  sorted.slice(1).forEach((range) => {
    const current = merged[merged.length - 1];

    if (range.start <= current.end + FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
      current.end = Math.max(current.end, range.end);
      return;
    }

    merged.push({ ...range });
  });

  return merged;
};

const resolveFrameExteriorAxisRanges = (
  frameNode: HTMLElement,
  shellRect: FrameNodeRect,
  pageInner: HTMLElement,
  side: TemplateEdgeSide
) => {
  const shell = resolveFrameLayoutShell(frameNode);
  const maxAxis = side === 'left' || side === 'right' ? shellRect.height : shellRect.width;
  const coverages: FrameOutlineAxisRange[] = [];
  const seenShells = new Set<HTMLElement>();

  collectFrameSelectionAnchors(pageInner).forEach((candidateNode) => {
    const candidateShell = resolveFrameLayoutShell(candidateNode);

    if (candidateShell === shell || seenShells.has(candidateShell)) {
      return;
    }

    seenShells.add(candidateShell);
    const candidateRect = readFrameElementRect(candidateShell, pageInner);

    if (side === 'left' || side === 'right') {
      const candidateEdge = side === 'left' ? candidateRect.left + candidateRect.width : candidateRect.left;
      const shellEdge = side === 'left' ? shellRect.left : shellRect.left + shellRect.width;

      if (Math.abs(candidateEdge - shellEdge) > FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
        return;
      }

      const overlapStart = Math.max(shellRect.top, candidateRect.top);
      const overlapEnd = Math.min(shellRect.top + shellRect.height, candidateRect.top + candidateRect.height);

      if (overlapEnd - overlapStart <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
        return;
      }

      coverages.push({
        start: Math.max(0, overlapStart - shellRect.top),
        end: Math.min(shellRect.height, overlapEnd - shellRect.top),
      });
      return;
    }

    const candidateEdge = side === 'top' ? candidateRect.top + candidateRect.height : candidateRect.top;
    const shellEdge = side === 'top' ? shellRect.top : shellRect.top + shellRect.height;

    if (Math.abs(candidateEdge - shellEdge) > FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
      return;
    }

    const overlapStart = Math.max(shellRect.left, candidateRect.left);
    const overlapEnd = Math.min(shellRect.left + shellRect.width, candidateRect.left + candidateRect.width);

    if (overlapEnd - overlapStart <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
      return;
    }

    coverages.push({
      start: Math.max(0, overlapStart - shellRect.left),
      end: Math.min(shellRect.width, overlapEnd - shellRect.left),
    });
  });

  const mergedCoverages = mergeFrameOutlineAxisRanges(coverages);
  const exposed: FrameOutlineAxisRange[] = [];
  let cursor = 0;

  mergedCoverages.forEach((range) => {
    if (range.start > cursor + FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
      exposed.push({ start: cursor, end: range.start });
    }

    cursor = Math.max(cursor, range.end);
  });

  if (cursor < maxAxis - FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
    exposed.push({ start: cursor, end: maxAxis });
  }

  return exposed.filter((range) => range.end - range.start > FRAME_CLUSTER_TOUCH_TOLERANCE_PX);
};

const areFrameRectsTouching = (left: FrameNodeRect, right: FrameNodeRect) => {
  const horizontalTouch =
    Math.abs(left.left + left.width - right.left) <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX ||
    Math.abs(right.left + right.width - left.left) <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX;
  const verticalOverlap =
    Math.min(left.top + left.height, right.top + right.height) -
      Math.max(left.top, right.top) >
    FRAME_CLUSTER_TOUCH_TOLERANCE_PX;

  if (horizontalTouch && verticalOverlap) {
    return true;
  }

  const verticalTouch =
    Math.abs(left.top + left.height - right.top) <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX ||
    Math.abs(right.top + right.height - left.top) <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX;
  const horizontalOverlap =
    Math.min(left.left + left.width, right.left + right.width) -
      Math.max(left.left, right.left) >
    FRAME_CLUSTER_TOUCH_TOLERANCE_PX;

  return verticalTouch && horizontalOverlap;
};

const buildConnectedFrameShellGroups = (
  entries: Array<{
    shell: HTMLElement;
    rect: FrameNodeRect;
  }>
) => {
  const groups: Array<
    Array<{
      shell: HTMLElement;
      rect: FrameNodeRect;
    }>
  > = [];
  const visited = new Set<number>();

  entries.forEach((entry, index) => {
    if (visited.has(index)) {
      return;
    }

    const queue = [index];
    const group: Array<{
      shell: HTMLElement;
      rect: FrameNodeRect;
    }> = [];
    visited.add(index);

    while (queue.length > 0) {
      const currentIndex = queue.shift();

      if (currentIndex === undefined) {
        continue;
      }

      const currentEntry = entries[currentIndex];

      if (!currentEntry) {
        continue;
      }

      group.push(currentEntry);

      entries.forEach((candidate, candidateIndex) => {
        if (visited.has(candidateIndex)) {
          return;
        }

        if (!areFrameRectsTouching(currentEntry.rect, candidate.rect)) {
          return;
        }

        visited.add(candidateIndex);
        queue.push(candidateIndex);
      });
    }

    groups.push(group);
  });

  return groups;
};

const mergeAbsoluteFrameLineSegments = (
  segments: Array<{
    orientation: 'horizontal' | 'vertical';
    line: number;
    start: number;
    end: number;
    border: { width: number; style: string; color: string; cssText: string };
    hasMissingVisibleBorder: boolean;
  }>
) => {
  const merged: Array<{
    orientation: 'horizontal' | 'vertical';
    line: number;
    start: number;
    end: number;
    border: { width: number; style: string; color: string; cssText: string };
    hasMissingVisibleBorder: boolean;
  }> = [];

  [...segments]
    .sort((left, right) => {
      if (left.orientation !== right.orientation) {
        return left.orientation.localeCompare(right.orientation);
      }

      if (Math.abs(left.line - right.line) > FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
        return left.line - right.line;
      }

      return left.start - right.start;
    })
    .forEach((segment) => {
      const previous = merged[merged.length - 1];

      if (
        previous &&
        previous.orientation === segment.orientation &&
        Math.abs(previous.line - segment.line) <= FRAME_CLUSTER_TOUCH_TOLERANCE_PX &&
        previous.end >= segment.start - FRAME_CLUSTER_TOUCH_TOLERANCE_PX &&
        previous.border.cssText === segment.border.cssText
      ) {
        previous.end = Math.max(previous.end, segment.end);
        previous.hasMissingVisibleBorder =
          previous.hasMissingVisibleBorder || segment.hasMissingVisibleBorder;
        return;
      }

      merged.push({ ...segment });
    });

  return merged;
};

const appendConnectedFrameClusterOutlines = (root: HTMLElement) => {
  const pageInnerGroups = new Map<
    HTMLElement,
    Array<{
      shell: HTMLElement;
      rect: FrameNodeRect;
      borderBySide: Record<
        TemplateEdgeSide,
        { width: number; style: string; color: string; cssText: string } | null
      >;
      fallbackBorder: { width: number; style: string; color: string; cssText: string } | null;
    }>
  >();

  collectFrameSelectionAnchors(root).forEach((frameNode) => {
    const shell = resolveFrameLayoutShell(frameNode);
    const pageInner = shell.closest<HTMLElement>('.page-inner');
    const table = resolveFrameLayoutTable(frameNode);
    const frameGroupId = getFrameGroupId(frameNode);
    const cell =
      frameNode.matches('td,th')
        ? frameNode
        : table?.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`) ||
          table?.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) ||
          null;
    const tableStyle = table ? getComputedStyle(table) : null;
    const cellStyle = cell ? getComputedStyle(cell) : null;
    const outlineStyle =
      cell?.getAttribute('data-template-frame-outline-style')?.trim() ||
      table?.getAttribute('data-template-frame-outline-style')?.trim() ||
      null;

    if (!pageInner) {
      return;
    }

    const fallbackBorder = parseFrameBorderDefinition(buildFrameBorderCssText(outlineStyle, 'rgba(15, 23, 42, 0.48)'));
    const entry = {
      shell,
      rect: readFrameElementRect(shell, pageInner),
      borderBySide: {
        top: parseVisibleFrameBorderDefinition(resolveVisibleBorderValue(cellStyle, tableStyle, 'top')),
        right: parseVisibleFrameBorderDefinition(resolveVisibleBorderValue(cellStyle, tableStyle, 'right')),
        bottom: parseVisibleFrameBorderDefinition(resolveVisibleBorderValue(cellStyle, tableStyle, 'bottom')),
        left: parseVisibleFrameBorderDefinition(resolveVisibleBorderValue(cellStyle, tableStyle, 'left')),
      } as Record<TemplateEdgeSide, { width: number; style: string; color: string; cssText: string } | null>,
      fallbackBorder,
    };

    const current = pageInnerGroups.get(pageInner) || [];
    current.push(entry);
    pageInnerGroups.set(pageInner, current);
  });

  pageInnerGroups.forEach((entries, pageInner) => {
    buildConnectedFrameShellGroups(entries).forEach((group) => {
      if (group.length <= 1) {
        return;
      }

      const segments = group.flatMap((entry) => {
        const groupRects = group.map((candidate) => ({
          shell: candidate.shell,
          rect: candidate.rect,
        }));

        return (['top', 'right', 'bottom', 'left'] as TemplateEdgeSide[]).flatMap((side) => {
          const border = entry.borderBySide[side] || entry.fallbackBorder;

          if (!border) {
            return [];
          }

          const exposedRanges = resolveFrameExteriorAxisRanges(
            entry.shell.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) || entry.shell,
            entry.rect,
            pageInner,
            side
          ).filter((range) => {
            const absoluteStart =
              side === 'left' || side === 'right' ? entry.rect.top + range.start : entry.rect.left + range.start;
            const absoluteEnd =
              side === 'left' || side === 'right' ? entry.rect.top + range.end : entry.rect.left + range.end;
            const line =
              side === 'left'
                ? entry.rect.left
                : side === 'right'
                  ? entry.rect.left + entry.rect.width
                  : side === 'top'
                    ? entry.rect.top
                    : entry.rect.top + entry.rect.height;

            return !groupRects.some((candidate) => {
              if (candidate.shell === entry.shell) {
                return false;
              }

              const candidateRect = candidate.rect;

              if (side === 'left' || side === 'right') {
                const candidateLine =
                  side === 'left' ? candidateRect.left + candidateRect.width : candidateRect.left;

                if (Math.abs(candidateLine - line) > FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
                  return false;
                }

                const overlapStart = Math.max(absoluteStart, candidateRect.top);
                const overlapEnd = Math.min(absoluteEnd, candidateRect.top + candidateRect.height);
                return overlapEnd - overlapStart > FRAME_CLUSTER_TOUCH_TOLERANCE_PX;
              }

              const candidateLine =
                side === 'top' ? candidateRect.top + candidateRect.height : candidateRect.top;

              if (Math.abs(candidateLine - line) > FRAME_CLUSTER_TOUCH_TOLERANCE_PX) {
                return false;
              }

              const overlapStart = Math.max(absoluteStart, candidateRect.left);
              const overlapEnd = Math.min(absoluteEnd, candidateRect.left + candidateRect.width);
              return overlapEnd - overlapStart > FRAME_CLUSTER_TOUCH_TOLERANCE_PX;
            });
          });

          return exposedRanges.map((range) => ({
            orientation: side === 'top' || side === 'bottom' ? ('horizontal' as const) : ('vertical' as const),
            line:
              side === 'top'
                ? entry.rect.top
                : side === 'bottom'
                  ? entry.rect.top + entry.rect.height
                  : side === 'left'
                    ? entry.rect.left
                    : entry.rect.left + entry.rect.width,
            start:
              side === 'top' || side === 'bottom'
                ? entry.rect.left + range.start
                : entry.rect.top + range.start,
            end:
              side === 'top' || side === 'bottom'
                ? entry.rect.left + range.end
                : entry.rect.top + range.end,
            border,
            hasMissingVisibleBorder: !entry.borderBySide[side],
          }));
        });
      });

      mergeAbsoluteFrameLineSegments(segments)
        .filter((segment) => segment.hasMissingVisibleBorder)
        .forEach((segment) => {
          const line = document.createElement('div');
          line.setAttribute(FRAME_CLUSTER_OUTLINE_OVERLAY_ATTR, 'true');
          line.setAttribute('data-frame-editor-ui', 'true');
          line.setAttribute('aria-hidden', 'true');
          line.style.position = 'absolute';
          line.style.pointerEvents = 'none';
          line.style.zIndex = '28';

          if (segment.orientation === 'horizontal') {
            line.style.left = toFrameCssPx(segment.start);
            line.style.top = toFrameCssPx(segment.line - segment.border.width / 2);
            line.style.width = toFrameCssPx(Math.max(0, segment.end - segment.start));
            line.style.height = '0';
            line.style.borderTop = segment.border.cssText;
          } else {
            line.style.left = toFrameCssPx(segment.line - segment.border.width / 2);
            line.style.top = toFrameCssPx(segment.start);
            line.style.width = '0';
            line.style.height = toFrameCssPx(Math.max(0, segment.end - segment.start));
            line.style.borderLeft = segment.border.cssText;
          }

          pageInner.appendChild(line);
        });
    });
  });
};

const buildFrameBorderCssText = (
  outlineStyle: string | null | undefined,
  fallbackColor = 'rgba(15, 23, 42, 0.48)'
) => {
  if (outlineStyle === 'dashed') {
    return '1px dashed rgba(15, 23, 42, 0.34)';
  }

  return `1px solid ${fallbackColor}`;
};

const appendFrameOutlineOverlay = (frameNode: HTMLElement, selectedSides: Set<TemplateEdgeSide>) => {
  const shell = resolveFrameLayoutShell(frameNode);
  const pageInner = shell.closest<HTMLElement>('.page-inner');
  const table = resolveFrameLayoutTable(frameNode);
  const frameGroupId = getFrameGroupId(frameNode);
  const cell =
    frameNode.matches('td,th')
      ? frameNode
      : table?.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`) ||
        table?.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) ||
        null;
  const tableStyle = table ? getComputedStyle(table) : null;
  const cellStyle = cell ? getComputedStyle(cell) : null;
  const borderTop = resolveVisibleBorderValue(cellStyle, tableStyle, 'top');
  const borderRight = resolveVisibleBorderValue(cellStyle, tableStyle, 'right');
  const borderBottom = resolveVisibleBorderValue(cellStyle, tableStyle, 'bottom');
  const borderLeft = resolveVisibleBorderValue(cellStyle, tableStyle, 'left');
  const shellRect = pageInner ? readFrameElementRect(shell, pageInner) : null;
  const outlineStyle =
    cell?.getAttribute('data-template-frame-outline-style')?.trim() ||
    table?.getAttribute('data-template-frame-outline-style')?.trim() ||
    null;
  const visibleBorderTop = parseVisibleFrameBorderDefinition(borderTop);
  const visibleBorderRight = parseVisibleFrameBorderDefinition(borderRight);
  const visibleBorderBottom = parseVisibleFrameBorderDefinition(borderBottom);
  const visibleBorderLeft = parseVisibleFrameBorderDefinition(borderLeft);

  if (!pageInner || !shellRect) {
    return;
  }

  if (!borderTop && !borderRight && !borderBottom && !borderLeft && !outlineStyle && selectedSides.size === 0) {
    return;
  }

  const horizontalFallbackBorder =
    visibleBorderTop ||
    visibleBorderBottom ||
    parseFrameBorderDefinition(buildFrameBorderCssText(outlineStyle, 'rgba(15, 23, 42, 0.48)'));
  const verticalFallbackBorder =
    visibleBorderLeft ||
    visibleBorderRight ||
    parseFrameBorderDefinition(buildFrameBorderCssText(outlineStyle, 'rgba(15, 23, 42, 0.48)'));

  const lineDefinitions = [
    { side: 'top' as const, border: visibleBorderTop },
    { side: 'right' as const, border: visibleBorderRight },
    { side: 'bottom' as const, border: visibleBorderBottom },
    { side: 'left' as const, border: visibleBorderLeft },
  ].filter((entry) => entry.border);

  const fallbackSegments = [
    { side: 'top' as const, border: !visibleBorderTop ? horizontalFallbackBorder : null },
    { side: 'right' as const, border: !visibleBorderRight ? verticalFallbackBorder : null },
    { side: 'bottom' as const, border: !visibleBorderBottom ? horizontalFallbackBorder : null },
    { side: 'left' as const, border: !visibleBorderLeft ? verticalFallbackBorder : null },
  ].flatMap((entry) =>
    entry.border
      ? resolveFrameExteriorAxisRanges(frameNode, shellRect, pageInner, entry.side).map((range) => ({
          side: entry.side,
          border: entry.border,
          range,
        }))
      : []
  );

  if (lineDefinitions.length === 0 && fallbackSegments.length === 0 && selectedSides.size === 0) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.setAttribute(FRAME_OUTLINE_OVERLAY_ATTR, 'true');
  overlay.setAttribute('data-frame-editor-ui', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.position = 'absolute';
  overlay.style.left = toFrameCssPx(shellRect.left);
  overlay.style.top = toFrameCssPx(shellRect.top);
  overlay.style.width = toFrameCssPx(shellRect.width);
  overlay.style.height = toFrameCssPx(shellRect.height);
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '29';
  overlay.style.overflow = 'visible';

  lineDefinitions.forEach((entry) => {
    if (!entry.border) {
      return;
    }

    const line = document.createElement('div');
    line.setAttribute('data-frame-editor-ui', 'true');
    line.style.position = 'absolute';
    line.style.pointerEvents = 'none';

    if (entry.side === 'top' || entry.side === 'bottom') {
      line.style.left = '0';
      line.style.width = '100%';
      line.style.height = '0';
      line.style.borderTop = entry.border.cssText;
      line.style.top =
        entry.side === 'top'
          ? toFrameCssPx(-entry.border.width / 2)
          : toFrameCssPx(shellRect.height - entry.border.width / 2);
    } else {
      line.style.top = '0';
      line.style.height = '100%';
      line.style.width = '0';
      line.style.borderLeft = entry.border.cssText;
      line.style.left =
        entry.side === 'left'
          ? toFrameCssPx(-entry.border.width / 2)
          : toFrameCssPx(shellRect.width - entry.border.width / 2);
    }

    overlay.appendChild(line);
  });

  fallbackSegments.forEach((entry) => {
    if (!entry.border) {
      return;
    }

    const line = document.createElement('div');
    line.setAttribute('data-frame-editor-ui', 'true');
    line.style.position = 'absolute';
    line.style.pointerEvents = 'none';

    if (entry.side === 'top' || entry.side === 'bottom') {
      line.style.left = toFrameCssPx(entry.range.start);
      line.style.width = toFrameCssPx(Math.max(0, entry.range.end - entry.range.start));
      line.style.height = '0';
      line.style.borderTop = entry.border.cssText;
      line.style.top =
        entry.side === 'top'
          ? toFrameCssPx(-entry.border.width / 2)
          : toFrameCssPx(shellRect.height - entry.border.width / 2);
    } else {
      line.style.top = toFrameCssPx(entry.range.start);
      line.style.height = toFrameCssPx(Math.max(0, entry.range.end - entry.range.start));
      line.style.width = '0';
      line.style.borderLeft = entry.border.cssText;
      line.style.left =
        entry.side === 'left'
          ? toFrameCssPx(-entry.border.width / 2)
          : toFrameCssPx(shellRect.width - entry.border.width / 2);
    }

    overlay.appendChild(line);
  });

  selectedSides.forEach((side) => {
    const indicator = document.createElement('div');
    indicator.setAttribute(FRAME_SELECTED_SIDE_INDICATOR_ATTR, 'true');
    indicator.setAttribute('data-frame-editor-ui', 'true');
    indicator.style.position = 'absolute';
    indicator.style.pointerEvents = 'none';

    if (side === 'top' || side === 'bottom') {
      indicator.style.left = '5px';
      indicator.style.width = toFrameCssPx(Math.max(0, shellRect.width - 10));
      indicator.style.height = '0';
      indicator.style.borderTop = '3px solid rgba(59, 130, 246, 0.98)';
      indicator.style.top =
        side === 'top'
          ? toFrameCssPx(5 - 1.5)
          : toFrameCssPx(Math.max(0, shellRect.height - 5 - 1.5));
    } else {
      indicator.style.top = '5px';
      indicator.style.height = toFrameCssPx(Math.max(0, shellRect.height - 10));
      indicator.style.width = '0';
      indicator.style.borderLeft = '3px solid rgba(59, 130, 246, 0.98)';
      indicator.style.left =
        side === 'left'
          ? toFrameCssPx(5 - 1.5)
          : toFrameCssPx(Math.max(0, shellRect.width - 5 - 1.5));
    }

    overlay.appendChild(indicator);
  });

  shell.setAttribute(TEMPLATE_NATIVE_OUTLINE_HIDDEN_ATTR, 'true');
  pageInner.appendChild(overlay);
};

const appendFrameSelectionFill = (frameNode: HTMLElement) => {
  const shell = resolveFrameLayoutShell(frameNode);
  const fill = document.createElement('div');
  fill.className = FRAME_SELECTION_FILL_CLASS;
  fill.setAttribute('data-frame-editor-ui', 'true');
  fill.setAttribute('aria-hidden', 'true');
  shell.appendChild(fill);
};

const appendPositionGroupProxyOverlay = (
  root: HTMLElement,
  positionGroupProxySelections: PositionGroupProxySelection[] = []
) => {
  if (!positionGroupProxySelections.length) {
    return;
  }

  const frameNodeById = new Map<string, HTMLElement>();
  collectFrameSelectionAnchors(root).forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, node);
    }
  });

  positionGroupProxySelections.forEach((positionGroupProxySelection) => {
    const pageInnerBuckets = new Map<
      HTMLElement,
      Array<{
        rect: FrameNodeRect;
      }>
    >();

    positionGroupProxySelection.frameGroupIds.forEach((frameGroupId) => {
      const frameNode = frameNodeById.get(frameGroupId);

      if (!frameNode) {
        return;
      }

      const shell = resolveFrameLayoutShell(frameNode);
      const pageInner = shell.closest<HTMLElement>('.page-inner');

      if (!pageInner) {
        return;
      }

      const current = pageInnerBuckets.get(pageInner) || [];
      current.push({ rect: readFrameElementRect(shell, pageInner) });
      pageInnerBuckets.set(pageInner, current);
    });

    pageInnerBuckets.forEach((entries, pageInner) => {
      if (entries.length <= 0) {
        return;
      }

      const minLeft = Math.min(...entries.map((entry) => entry.rect.left));
      const minTop = Math.min(...entries.map((entry) => entry.rect.top));
      const maxRight = Math.max(...entries.map((entry) => entry.rect.left + entry.rect.width));
      const maxBottom = Math.max(...entries.map((entry) => entry.rect.top + entry.rect.height));
      const overlay = document.createElement('div');
      overlay.setAttribute('data-frame-editor-ui', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('data-v106-position-group-proxy-overlay', positionGroupProxySelection.groupId);
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '29';
      overlay.style.left = toFrameCssPx(minLeft);
      overlay.style.top = toFrameCssPx(minTop);
      overlay.style.width = toFrameCssPx(Math.max(1, maxRight - minLeft));
      overlay.style.height = toFrameCssPx(Math.max(1, maxBottom - minTop));
      overlay.style.outline = `3px solid ${positionGroupProxySelection.outlineColor || 'rgba(13, 148, 136, .98)'}`;
      overlay.style.boxShadow = `0 0 0 5px ${positionGroupProxySelection.haloColor || 'rgba(45, 212, 191, .22)'}, inset 0 0 0 1px rgba(255, 255, 255, .84)`;
      overlay.style.background = positionGroupProxySelection.fillColor || 'rgba(13, 148, 136, .14)';

      const badge = document.createElement('div');
      badge.setAttribute('data-frame-editor-ui', 'true');
      badge.style.position = 'absolute';
      badge.style.top = '-10px';
      badge.style.left = '-10px';
      badge.style.minWidth = '20px';
      badge.style.height = '20px';
      badge.style.padding = '0 6px';
      badge.style.borderRadius = '999px';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.background = positionGroupProxySelection.badgeColor || 'rgba(15, 23, 42, .96)';
      badge.style.color = positionGroupProxySelection.badgeTextColor || '#fff';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '700';
      badge.textContent = Number.isFinite(positionGroupProxySelection.selectionOrder)
        ? `${positionGroupProxySelection.colorName || '선택'} 박스`
        : '선택 박스';
      overlay.appendChild(badge);

      pageInner.appendChild(overlay);
    });
  });
};

const appendPositionGroupCatalogOverlay = (root: HTMLElement) => {
  if (root.getAttribute('data-selection-panel-tab') !== 'position') {
    return;
  }

  const groups = collectPositionBoxGroups(root, { includeSingletons: false }).filter(
    (group) => group.frameGroupIds.length > 1
  );

  if (groups.length <= 0) {
    return;
  }

  const frameNodeById = new Map<string, HTMLElement>();
  collectFrameSelectionAnchors(root).forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, node);
    }
  });

  groups.forEach((group) => {
    const pageInnerBuckets = new Map<
      HTMLElement,
      Array<{
        rect: FrameNodeRect;
      }>
    >();

    group.frameGroupIds.forEach((frameGroupId) => {
      const frameNode = frameNodeById.get(frameGroupId);
      if (!frameNode) {
        return;
      }

      const shell = resolveFrameLayoutShell(frameNode);
      const pageInner = shell.closest<HTMLElement>('.page-inner');
      if (!pageInner) {
        return;
      }

      const current = pageInnerBuckets.get(pageInner) || [];
      current.push({ rect: readFrameElementRect(shell, pageInner) });
      pageInnerBuckets.set(pageInner, current);
    });

    pageInnerBuckets.forEach((entries, pageInner) => {
      if (entries.length <= 1) {
        return;
      }

      const minLeft = Math.min(...entries.map((entry) => entry.rect.left));
      const minTop = Math.min(...entries.map((entry) => entry.rect.top));
      const maxRight = Math.max(...entries.map((entry) => entry.rect.left + entry.rect.width));
      const maxBottom = Math.max(...entries.map((entry) => entry.rect.top + entry.rect.height));
      const overlay = document.createElement('div');
      overlay.setAttribute('data-frame-editor-ui', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('data-v106-position-group-catalog-overlay', group.id);
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '18';
      overlay.style.left = toFrameCssPx(minLeft);
      overlay.style.top = toFrameCssPx(minTop);
      overlay.style.width = toFrameCssPx(Math.max(1, maxRight - minLeft));
      overlay.style.height = toFrameCssPx(Math.max(1, maxBottom - minTop));
      overlay.style.outline = '2px solid rgba(217, 119, 6, .95)';
      overlay.style.outlineOffset = '0';
      overlay.style.boxShadow = '0 0 0 2px rgba(251, 191, 36, .32), inset 0 0 0 1px rgba(255, 255, 255, .72)';
      overlay.style.background = 'rgba(251, 191, 36, .06)';

      const badge = document.createElement('div');
      badge.setAttribute('data-frame-editor-ui', 'true');
      badge.style.position = 'absolute';
      badge.style.top = '-10px';
      badge.style.left = '-10px';
      badge.style.minWidth = '22px';
      badge.style.height = '20px';
      badge.style.padding = '0 7px';
      badge.style.borderRadius = '999px';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.background = 'rgba(217, 119, 6, .96)';
      badge.style.color = '#fff';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = '700';
      badge.textContent = group.label || group.id;
      overlay.appendChild(badge);

      pageInner.appendChild(overlay);
    });
  });
};

const applyFrameSelectionUi = (
  root: HTMLElement,
  selectedIds: string[],
  edgeSelectionState: TemplateEdgeSelectionStateDto,
  edgeSnapshot: TemplateEdgeTopologySnapshotDto | null,
  edgeRoleById: TemplateEdgeRoleMapDto,
  edgeMovementMismatchIds: string[],
  relativeGuideFrameGroupId?: string | null,
  positionGroupProxySelections: PositionGroupProxySelection[] = []
) => {
  stripSelectionAttrs(root, { preserveFrameVisualHints: true });
  TemplateFrameEditHtmlService.stripEditorUiState(root);
  const proxyMemberFrameGroupIdSet = new Set(
    positionGroupProxySelections.flatMap((proxySelection) =>
      proxySelection.frameGroupIds.map((frameGroupId) => frameGroupId.trim()).filter((frameGroupId) => Boolean(frameGroupId))
    )
  );

  const edgeMetaMap = new Map<
    string,
    {
      selectionOrder: number;
      mode: 'connected' | 'isolated';
      isAnchorEdge: boolean;
    }
  >();

  edgeSelectionState.tokens.forEach((token) => {
    token.memberEdgeIds.forEach((edgeId) => {
      edgeMetaMap.set(edgeId, {
        selectionOrder: token.selectionOrder,
        mode: token.mode,
        isAnchorEdge: edgeId === token.anchorEdgeId,
      });
    });
  });

  const edgeMap = new Map((edgeSnapshot?.edges || []).map((edge) => [edge.edgeId, edge]));

  collectFrameSelectionAnchors(root).forEach((node) => {
    const frameGroupId = getFrameGroupId(node);
    const selectionIndex = selectedIds.indexOf(frameGroupId);
    const selectedSides = new Set<TemplateEdgeSide>();

    node.setAttribute('data-template-edge-host', 'true');

    const isProxyMemberSelection = proxyMemberFrameGroupIdSet.has(frameGroupId);

    if (selectionIndex >= 0 && !isProxyMemberSelection) {
      node.setAttribute('data-template-selected', 'true');
      node.setAttribute('data-template-selection-order', String(selectionIndex + 1));

      if (selectionIndex === 0) {
        node.setAttribute('data-template-primary-selected', 'true');
      }
      appendFrameSelectionFill(node);
    }

    if (!edgeSnapshot) {
      return;
    }

    (['left', 'right', 'top', 'bottom'] as TemplateEdgeSide[]).forEach((side) => {
      const edgeId = `${frameGroupId}:${side}`;
      const edge = edgeMap.get(edgeId);
      const edgeMeta = edgeMetaMap.get(edgeId);
      const edgeRole = edgeRoleById[edgeId] || null;

      if (!edge) {
        return;
      }

      if (edgeMeta) {
        node.setAttribute('data-template-edge-visual', 'true');
        selectedSides.add(side);

        if (edgeMeta.isAnchorEdge) {
          node.setAttribute('data-template-edge-anchor-node', 'true');
        }
      }

      node.appendChild(
        buildEdgeSelectionButton(
          side,
          edgeId,
          edgeMeta?.selectionOrder ?? null,
          edgeMeta?.mode || 'idle',
          Boolean(edgeMeta?.isAnchorEdge),
          edgeRole,
          edgeMovementMismatchIds.includes(edgeId)
        )
      );
    });

    appendFrameOutlineOverlay(node, selectedSides);
  });

  appendConnectedFrameClusterOutlines(root);
  appendPositionGroupCatalogOverlay(root);
  appendPositionGroupProxyOverlay(root, positionGroupProxySelections);
  renderRelativeAnchorGuides(root, selectedIds, relativeGuideFrameGroupId);
};

const applyFrameStylePatch = (
  node: HTMLElement,
  patch: FrameStylePatch
) => {
  const contentTarget = resolveFrameContentTarget(node);
  const persistedFrameNode = resolvePersistedFrameNode(node);

  if (typeof patch.width === 'number' && Number.isFinite(patch.width)) {
    applyFrameResizeWidthDelta(node, patch.width - readFrameNodeRect(node).width);
    if (contentTarget !== node) {
      contentTarget.style.width = '100%';
    }
  }

  if (typeof patch.height === 'number' && Number.isFinite(patch.height)) {
    applyFrameResizeHeightDelta(node, patch.height - readFrameNodeRect(node).height);
    if (contentTarget !== node) {
      contentTarget.style.height = '100%';
    }
  }

  if (patch.fontSize !== undefined) {
    contentTarget.style.fontSize = patch.fontSize ? `${Number.parseFloat(patch.fontSize)}px` : '';
  }

  if (patch.lineHeight !== undefined) {
    contentTarget.style.lineHeight = patch.lineHeight ? `${Number.parseFloat(patch.lineHeight)}px` : '';
  }

  if (patch.fontWeight !== undefined) {
    contentTarget.style.fontWeight = patch.fontWeight || '';
  }

  if (patch.textAlign !== undefined) {
    contentTarget.style.textAlign = patch.textAlign || '';
  }

  if (patch.color !== undefined) {
    contentTarget.style.color = patch.color || '';
  }

  if (patch.backgroundColor !== undefined) {
    node.style.backgroundColor = patch.backgroundColor || '';
    if (persistedFrameNode && persistedFrameNode !== node) {
      persistedFrameNode.style.backgroundColor = patch.backgroundColor || '';
    }
  }

  if (patch.borderRadius !== undefined) {
    node.style.borderRadius = patch.borderRadius ? `${Number.parseFloat(patch.borderRadius)}px` : '';
    if (persistedFrameNode && persistedFrameNode !== node) {
      persistedFrameNode.style.borderRadius = patch.borderRadius ? `${Number.parseFloat(patch.borderRadius)}px` : '';
    }
  }

  if (patch.paddingX !== undefined || patch.paddingY !== undefined) {
    const paddingX = patch.paddingX !== undefined ? Number.parseFloat(patch.paddingX || '0') : NaN;
    const paddingY = patch.paddingY !== undefined ? Number.parseFloat(patch.paddingY || '0') : NaN;
    const safePaddingX = Number.isFinite(paddingX) ? paddingX : parseFramePx(contentTarget.style.paddingLeft || '0');
    const safePaddingY = Number.isFinite(paddingY) ? paddingY : parseFramePx(contentTarget.style.paddingTop || '0');
    contentTarget.style.padding = `${safePaddingY}px ${safePaddingX}px`;
  }
};

export default function TemplateEditWorkspace({ initialTemplateId = '' }: TemplateEditWorkspaceProps) {
  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [templateDetail, setTemplateDetail] = React.useState<TemplateDetailResult | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState('');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(initialTemplateId.trim());
  const [templateName, setTemplateName] = React.useState('');
  const [sourceDocumentName, setSourceDocumentName] = React.useState('');
  const [layoutResizeMode, setLayoutResizeMode] = React.useState<TemplateLayoutResizeMode>('grow_height');
  const [previewZoom, setPreviewZoom] = React.useState(100);
  const [boxCreationMode, setBoxCreationMode] = React.useState(false);
  const [boxCreationPositionMode, setBoxCreationPositionMode] =
    React.useState<TemplateFramePositionMode>('absolute');
  const [selectedFrameGroupIds, setSelectedFrameGroupIds] = React.useState<string[]>([]);
  const [edgeSelectionState, setEdgeSelectionState] = React.useState<TemplateEdgeSelectionStateDto>(
    TemplateEdgeSelectionService.createEmptyState()
  );
  const [edgeRoleDiagnostics, setEdgeRoleDiagnostics] = React.useState<EdgeRoleDiagnosticsState>(
    emptyEdgeRoleDiagnosticsState
  );
  const [selectionStyleDraft, setSelectionStyleDraft] = React.useState<SelectionStyleDraft>(defaultSelectionStyleDraft);
  const [styleFieldApplyStatus, setStyleFieldApplyStatus] =
    React.useState<Record<StyleFieldKey, StyleFieldApplyState>>(defaultStyleFieldApplyStatus);
  const [selectionTextDraft, setSelectionTextDraft] = React.useState('');
  const [selectionTextMixed, setSelectionTextMixed] = React.useState(false);
  const [frameMetadataDraft, setFrameMetadataDraft] = React.useState<FrameMetadataDraft>(defaultFrameMetadataDraft);
  const [selectionPanelTab, setSelectionPanelTab] = React.useState<SelectionPanelTab>('summary');
  const [positionRelationAnchorFrameGroupId, setPositionRelationAnchorFrameGroupId] = React.useState('');
  const [positionRelationTargetFrameGroupId, setPositionRelationTargetFrameGroupId] = React.useState('');
  const [positionOrderLockSelectionMode, setPositionOrderLockSelectionMode] = React.useState(false);
  const [positionOrderLockFrameGroupIds, setPositionOrderLockFrameGroupIds] = React.useState<string[]>([]);
  const [positionOrderLockSelectionKindByFrameGroupId, setPositionOrderLockSelectionKindByFrameGroupId] = React.useState<
    Record<string, 'group' | 'frame'>
  >({});
  const [positionOrderLockColorSeed, setPositionOrderLockColorSeed] = React.useState(0);
  const [positionOrderLockCandidateFrameGroupId, setPositionOrderLockCandidateFrameGroupId] = React.useState('');
  const [positionOrderLockCandidateGroupId, setPositionOrderLockCandidateGroupId] = React.useState('');
  const [positionOrderLockCandidateSelectionStage, setPositionOrderLockCandidateSelectionStage] = React.useState<
    'group' | 'frame' | ''
  >('');
  const [expandedPositionBoxGroupIds, setExpandedPositionBoxGroupIds] = React.useState<Record<string, boolean>>({});
  const [positionSpacingDraftByPairKey, setPositionSpacingDraftByPairKey] = React.useState<Record<string, { gapY: string }>>(
    {}
  );
  const [definedPositionRelationGapDraftByKey, setDefinedPositionRelationGapDraftByKey] = React.useState<
    Record<string, { gapY: string }>
  >({});
  const [showMetadataIcons, setShowMetadataIcons] = React.useState(true);
  const [showCanvasLegend, setShowCanvasLegend] = React.useState(false);
  const [metadataRelationSelectionMode, setMetadataRelationSelectionMode] = React.useState<MetadataRelationSelectionMode>({
    kind: 'idle',
  });
  const [selectionSaveProgress, setSelectionSaveProgress] =
    React.useState<SelectionSaveProgressState>(defaultSelectionSaveProgressState);
  const [hasSelectionProgressHistory, setHasSelectionProgressHistory] = React.useState(false);
  const [showSelectionStatus, setShowSelectionStatus] = React.useState(false);
  const [selectionValidationIssues, setSelectionValidationIssues] = React.useState<FrameMetadataValidationIssue[]>([]);
  const [virtualFrameDefinitions, setVirtualFrameDefinitions] = React.useState<VirtualFrameDefinition[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [previewDomVersion, setPreviewDomVersion] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [canvasHistoryRevision, setCanvasHistoryRevision] = React.useState(0);
  const [positionSelectionClickChainSnapshot, setPositionSelectionClickChainSnapshot] =
    React.useState<PositionSelectionClickChainSnapshot | null>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const stylePanelRef = React.useRef<HTMLDivElement | null>(null);
  const draftPreviewHtmlRef = React.useRef('');
  const selectedFrameGroupIdsRef = React.useRef<string[]>([]);
  const edgeSelectionStateRef = React.useRef<TemplateEdgeSelectionStateDto>(TemplateEdgeSelectionService.createEmptyState());
  const edgeRoleDiagnosticsRef = React.useRef<EdgeRoleDiagnosticsState>(emptyEdgeRoleDiagnosticsState);
  const syncedFrameMetadataDraftRef = React.useRef<FrameMetadataDraft>(defaultFrameMetadataDraft);
  const metadataRelationSelectionModeRef = React.useRef<MetadataRelationSelectionMode>({ kind: 'idle' });
  const frameRelationPreviewModeRef = React.useRef<FrameRelationPreviewMode>({ kind: 'idle' });
  const activePointerOwnerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const resizeStateRef = React.useRef<ResizeState | null>(null);
  const edgePressStateRef = React.useRef<EdgePressState | null>(null);
  const marqueeSelectionStateRef = React.useRef<MarqueeSelectionState | null>(null);
  const routeTemplateAutoloadedRef = React.useRef('');
  const createBoxStateRef = React.useRef<CreateBoxState | null>(null);
  const previewEditorStateFrameRef = React.useRef<number | null>(null);
  const previewEditorStateRetryCountRef = React.useRef(0);
  const deferredPreviewEditorStateRef = React.useRef(false);
  const positionGroupProxySelectionGroupIdRef = React.useRef('');
  const positionGroupProxySelectionShowAllGroupsRef = React.useRef(false);
  const positionGroupProxySelectionsOverrideRef = React.useRef<PositionGroupProxySelection[] | null>(null);
  const positionSpacingDraftApplyRequestedRef = React.useRef(false);
  const canvasHistoryEntriesRef = React.useRef<CanvasHistoryEntry[]>([]);
  const canvasHistoryIndexRef = React.useRef(-1);
  const canvasHistoryNavigationInProgressRef = React.useRef(false);

  const templateOptions = React.useMemo<TemplateOption[]>(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: template.id,
        keywords: [template.sourceDocumentName || '', template.layoutResizeMode],
      })),
    [templates]
  );

  const frameNodesAvailable = React.useMemo(
    () => ((previewHtml || templateDetail?.template.draftHtml || '').match(/data-template-frame-group=/g) || []).length,
    [previewHtml, templateDetail?.template.draftHtml]
  );
  const renderedPreviewHtml = previewHtml || templateDetail?.template.draftHtml || '';
  const selectedEdgeMemberCount = React.useMemo(
    () => new Set(edgeSelectionState.tokens.flatMap((token) => token.memberEdgeIds)).size,
    [edgeSelectionState]
  );
  const selectedEdgeMode = edgeSelectionState.tokens[0]?.mode || null;
  const selectedEdgeAnchorIds = edgeSelectionState.tokens.map((token) => token.anchorEdgeId);
  const selectedEdgeClickedCount = edgeRoleDiagnostics.selectedEdgeClickedIds.length;
  const selectedEdgeAutoMultiCount = edgeRoleDiagnostics.selectedEdgeAutoMultiIds.length;
  const peerEdgeCount = edgeRoleDiagnostics.peerEdgeIds.length;
  const primarySelectedFrameGroupId = readSingleFrameGroupId(selectedFrameGroupIds) || null;
  const canEditSingleSelection = selectedFrameGroupIds.length === 1;
  const selectionValidationErrorFrameIds = React.useMemo(
    () => Array.from(new Set(selectionValidationIssues.map((issue) => issue.frameGroupId).filter(Boolean))),
    [selectionValidationIssues]
  );
  const selectionSaveProgressFailed = selectionSaveProgress.phase === 'failed';
  const selectionSaveProgressCompleted = selectionSaveProgress.phase === 'completed';
  const selectionSaveProgressActive = selectionSaveProgress.phase === 'running';
  const canShowSelectionStatus = hasSelectionProgressHistory || selectionSaveProgress.phase !== 'idle';
  const routeTemplateId = React.useMemo(() => {
    const normalizedInitialTemplateId = initialTemplateId.trim();

    if (normalizedInitialTemplateId) {
      return normalizedInitialTemplateId;
    }

    if (typeof window === 'undefined') {
      return '';
    }

    return new URLSearchParams(window.location.search).get('templateId')?.trim() || '';
  }, [initialTemplateId]);
  const runtimeModeOptions = React.useMemo(
    () => (frameMetadataDraft.boxKind ? getCompatibleRuntimeModes(frameMetadataDraft.boxKind) : getAllRuntimeModes()),
    [frameMetadataDraft.boxKind]
  );
  const frameRuntimeModeHelpText = React.useMemo(() => {
    if (!frameMetadataDraft.runtimeMode) {
      if (frameMetadataDraft.boxKind) {
        return `${FRAME_BOX_KIND_LABELS[frameMetadataDraft.boxKind]}에 맞는 동작 방식을 선택하세요.`;
      }

      return '아직 특정 동작을 고르지 않았습니다. 박스가 문서에서 어떻게 동작하고 무엇을 출력할지 정합니다.';
    }

    return FRAME_RUNTIME_MODE_DESCRIPTIONS[frameMetadataDraft.runtimeMode];
  }, [frameMetadataDraft.boxKind, frameMetadataDraft.runtimeMode]);
  const primarySelectedResolvedMetadata = React.useMemo(() => {
    if (!primarySelectedFrameGroupId || !previewRef.current) {
      return null;
    }

    const frameNode = resolveFrameSelectionAnchor(
      previewRef.current.querySelector<HTMLElement>(
        `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${primarySelectedFrameGroupId}"]`
      )
    );

    return frameNode ? resolveNextFrameMetadata(frameNode, {}) : null;
  }, [primarySelectedFrameGroupId, renderedPreviewHtml]);
  const currentParentKeyBoxLabel = React.useMemo(() => {
    const parentGroupId = frameMetadataDraft.parentGroupId.trim();

    if (!parentGroupId || !previewRef.current) {
      return parentGroupId || 'null';
    }

    const parentNode = resolveFrameSelectionAnchor(
      previewRef.current.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${parentGroupId}"]`)
    );
    const parentText = readFrameDisplayText(parentNode);
    if (parentText) {
      return `${parentGroupId} | ${parentText}`;
    }

    const virtualDefinition = virtualFrameDefinitions.find((definition) => definition.id === parentGroupId);
    return virtualDefinition ? `${parentGroupId} | ${virtualDefinition.label}` : parentGroupId;
  }, [frameMetadataDraft.parentGroupId, renderedPreviewHtml, virtualFrameDefinitions]);
  const keyBoxSelectionHelpText = React.useMemo(() => {
    if (metadataRelationSelectionMode.kind === 'parent') {
      const count = metadataRelationSelectionMode.sourceFrameGroupIds.length;

      return count > 1
        ? `현재 value 박스 ${count}개가 선택된 상태입니다. 이제 이 값들을 묶는 key 박스를 캔버스에서 1개 선택해주세요.`
        : '현재 value 박스 1개가 선택된 상태입니다. 이제 이 값의 key 박스를 캔버스에서 1개 선택해주세요.';
    }

    return '먼저 value로 만들 박스를 선택한 뒤 `선택 모드`를 누르세요. 그 다음 캔버스에서 이 박스들의 key가 될 text 박스 1개를 선택합니다.';
  }, [metadataRelationSelectionMode]);
  const valueBoxSelectionHelpText = React.useMemo(() => {
    if (metadataRelationSelectionMode.kind === 'value') {
      return '현재 key 박스가 선택된 상태입니다. 이제 이 key에 연결할 value 박스들을 캔버스에서 선택해주세요. 다시 클릭하면 해제됩니다.';
    }

    return '먼저 기준이 될 key 박스 1개를 선택한 뒤 `선택 모드`를 누르세요. 그 다음 캔버스에서 이 key에 연결할 value 박스들을 선택합니다.';
  }, [metadataRelationSelectionMode]);
  const canStartValueBoxSelection =
    canEditSingleSelection &&
    Boolean(primarySelectedFrameGroupId) &&
    primarySelectedResolvedMetadata?.boxKind === 'text';
  const hasSelectedMetadataTarget = selectedFrameGroupIds.length > 0;
  const canEditValueBoxField = hasSelectedMetadataTarget && frameMetadataDraft.role !== 'value';
  const primarySelectedFramePositionMode = React.useMemo(() => {
    if (!primarySelectedFrameGroupId || !previewRef.current) {
      return null;
    }

    const frameNode = resolveFrameSelectionAnchor(
      previewRef.current.querySelector<HTMLElement>(
        `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${primarySelectedFrameGroupId}"]`
      )
    );
    return readFramePositionMode(frameNode);
  }, [primarySelectedFrameGroupId, renderedPreviewHtml]);
  const relativeCreateAnchorFrameGroupId =
    boxCreationPositionMode === 'relative' && selectedFrameGroupIds.length === 1 ? primarySelectedFrameGroupId : null;
  const primaryRelativeAnchorLabel = React.useMemo(() => {
    if (!primarySelectedFrameGroupId || !previewRef.current) {
      return null;
    }

    const frameNode = resolveFrameSelectionAnchor(
      previewRef.current.querySelector<HTMLElement>(
        `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${primarySelectedFrameGroupId}"]`
      )
    );
    const config = readFrameRelativeAnchorConfig(frameNode);
    return readRelativeAnchorTargetLabel(config);
  }, [primarySelectedFrameGroupId, renderedPreviewHtml]);
  const primaryRelativeImpactGroups = React.useMemo(() => {
    if (!primarySelectedFrameGroupId || !previewRef.current) {
      return [];
    }

    return collectPositionImpactGroupsBySourceIds(
      previewRef.current,
      [primarySelectedFrameGroupId],
      {
        includeSourceFrameGroupIds: false,
      }
    );
  }, [primarySelectedFrameGroupId, renderedPreviewHtml]);
  const primaryRelativeAffectedFrameGroupIds = React.useMemo(
    () =>
      Array.from(new Set(primaryRelativeImpactGroups.flatMap((group) => group.frameGroupIds))).sort((left, right) =>
        left.localeCompare(right, 'ko')
      ),
    [primaryRelativeImpactGroups]
  );
  const primaryRelativeImpactGroupLabels = React.useMemo(
    () => readPositionImpactGroupDisplayLabels(primaryRelativeImpactGroups),
    [primaryRelativeImpactGroups]
  );
  const selectedRelativeFrameGroupIds = React.useMemo(() => {
    const root = previewRef.current;

    if (!root || selectedFrameGroupIds.length <= 0) {
      return [] as string[];
    }

    const relativeFrameGroupIds = new Set<string>();

    selectedFrameGroupIds.forEach((frameGroupId) => {
      const normalizedFrameGroupId = frameGroupId.trim();
      if (!normalizedFrameGroupId) {
        return;
      }

      const frameNode = resolveFrameSelectionAnchor(
        root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${normalizedFrameGroupId}"]`)
      );
      const pageInner = frameNode?.closest<HTMLElement>('.page-inner') || null;

      if (!frameNode || !pageInner) {
        return;
      }

      if (readFramePositionMode(frameNode, pageInner) === 'relative') {
        relativeFrameGroupIds.add(normalizedFrameGroupId);
      }
    });

    return Array.from(relativeFrameGroupIds);
  }, [previewDomVersion, renderedPreviewHtml, selectedFrameGroupIds]);

  React.useEffect(() => {
    metadataRelationSelectionModeRef.current = metadataRelationSelectionMode;
  }, [metadataRelationSelectionMode]);

  React.useEffect(() => {
    if (metadataRelationSelectionMode.kind === 'idle') {
      return;
    }

    if (
      metadataRelationSelectionMode.kind === 'parent' &&
      stringArraysEqual(selectedFrameGroupIds, metadataRelationSelectionMode.sourceFrameGroupIds)
    ) {
      return;
    }

    if (
      metadataRelationSelectionMode.kind === 'value' &&
      metadataRelationSelectionMode.sourceKeyFrameGroupId === primarySelectedFrameGroupId
    ) {
      return;
    }

    setMetadataRelationSelectionMode({ kind: 'idle' });
  }, [metadataRelationSelectionMode, primarySelectedFrameGroupId, selectedFrameGroupIds]);

  React.useEffect(() => {
    if (selectionPanelTab !== 'metadata' && metadataRelationSelectionModeRef.current.kind !== 'idle') {
      setMetadataRelationSelectionMode({ kind: 'idle' });
    }
  }, [selectionPanelTab]);

  const syncTemplateQuery = React.useCallback((templateId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);

    if (templateId.trim()) {
      url.searchParams.set('templateId', templateId.trim());
    } else {
      url.searchParams.delete('templateId');
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, []);

  const canUndoCanvasHistory = React.useMemo(
    () => canvasHistoryIndexRef.current > 0,
    [canvasHistoryRevision]
  );
  const canRedoCanvasHistory = React.useMemo(
    () =>
      canvasHistoryIndexRef.current >= 0 &&
      canvasHistoryIndexRef.current < canvasHistoryEntriesRef.current.length - 1,
    [canvasHistoryRevision]
  );
  const commitCanvasHistoryRevision = React.useCallback(() => {
    setCanvasHistoryRevision((previous) => previous + 1);
  }, []);
  const resetCanvasHistory = React.useCallback((entry?: CanvasHistoryEntry | null) => {
    const normalizedEntry = entry || null;

    if (!normalizedEntry) {
      canvasHistoryEntriesRef.current = [];
      canvasHistoryIndexRef.current = -1;
      commitCanvasHistoryRevision();
      return;
    }

    canvasHistoryEntriesRef.current = [normalizedEntry];
    canvasHistoryIndexRef.current = 0;
    commitCanvasHistoryRevision();
  }, [commitCanvasHistoryRevision]);
  const pushCanvasHistoryEntry = React.useCallback(
    (entry: CanvasHistoryEntry) => {
      const normalizedEntry: CanvasHistoryEntry = {
        renderHtml: entry.renderHtml.trim(),
        draftHtml: entry.draftHtml.trim(),
        selectedFrameGroupIds: Array.from(
          new Set(entry.selectedFrameGroupIds.map((frameGroupId) => frameGroupId.trim()).filter(Boolean))
        ),
        positionGroupProxySelectionGroupId: entry.positionGroupProxySelectionGroupId.trim(),
        showAllGroupProxySelections: Boolean(entry.showAllGroupProxySelections),
      };

      if (!normalizedEntry.renderHtml && !normalizedEntry.draftHtml) {
        return;
      }

      const currentEntries = canvasHistoryEntriesRef.current;
      const currentIndex = canvasHistoryIndexRef.current;
      const currentEntry = currentIndex >= 0 ? currentEntries[currentIndex] : null;

      if (
        currentEntry &&
        currentEntry.draftHtml === normalizedEntry.draftHtml &&
        currentEntry.renderHtml === normalizedEntry.renderHtml
      ) {
        return;
      }

      const nextEntries =
        currentIndex >= 0 ? [...currentEntries.slice(0, currentIndex + 1), normalizedEntry] : [normalizedEntry];
      canvasHistoryEntriesRef.current = nextEntries;
      canvasHistoryIndexRef.current = nextEntries.length - 1;
      commitCanvasHistoryRevision();
    },
    [commitCanvasHistoryRevision]
  );
  const restoreCanvasHistoryAtIndex = React.useCallback(
    (nextIndex: number, actionLabel: '되돌리기' | '다시 실행하기') => {
      const nextEntry = canvasHistoryEntriesRef.current[nextIndex];

      if (!nextEntry) {
        return;
      }

      const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
      canvasHistoryNavigationInProgressRef.current = true;
      canvasHistoryIndexRef.current = nextIndex;
      draftPreviewHtmlRef.current = nextEntry.draftHtml;
      setPreviewHtml(nextEntry.renderHtml);
      setPreviewDomVersion((previous) => previous + 1);
      positionGroupProxySelectionGroupIdRef.current = nextEntry.positionGroupProxySelectionGroupId;
      positionGroupProxySelectionShowAllGroupsRef.current = nextEntry.showAllGroupProxySelections;
      positionGroupProxySelectionsOverrideRef.current = null;
      selectedFrameGroupIdsRef.current = nextEntry.selectedFrameGroupIds.slice();
      edgeSelectionStateRef.current = emptyEdgeSelection;
      setSelectedFrameGroupIds(nextEntry.selectedFrameGroupIds.slice());
      setEdgeSelectionState(emptyEdgeSelection);
      setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
      setSelectionValidationIssues([]);
      setSelectionSaveProgress(defaultSelectionSaveProgressState);
      commitCanvasHistoryRevision();
      setMessage(`${actionLabel} 적용됨`);

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          canvasHistoryNavigationInProgressRef.current = false;
        });
      } else {
        canvasHistoryNavigationInProgressRef.current = false;
      }
    },
    [commitCanvasHistoryRevision]
  );
  const handleUndoCanvasHistory = React.useCallback(() => {
    const currentIndex = canvasHistoryIndexRef.current;

    if (currentIndex <= 0) {
      return;
    }

    restoreCanvasHistoryAtIndex(currentIndex - 1, '되돌리기');
  }, [restoreCanvasHistoryAtIndex]);
  const handleRedoCanvasHistory = React.useCallback(() => {
    const currentIndex = canvasHistoryIndexRef.current;
    const lastIndex = canvasHistoryEntriesRef.current.length - 1;

    if (currentIndex < 0 || currentIndex >= lastIndex) {
      return;
    }

    restoreCanvasHistoryAtIndex(currentIndex + 1, '다시 실행하기');
  }, [restoreCanvasHistoryAtIndex]);

  const syncDraftPreviewHtmlRef = React.useCallback(() => {
    const root = previewRef.current;

    if (!root) {
      return '';
    }

    const nextDraftHtml = extractEditorHtml(root);
    const nextRenderHtml = extractPreviewRenderHtml(root);
    draftPreviewHtmlRef.current = nextDraftHtml;
    setPreviewDomVersion((previous) => previous + 1);
    setPreviewHtml(nextRenderHtml);
    if (!canvasHistoryNavigationInProgressRef.current) {
      pushCanvasHistoryEntry({
        renderHtml: nextRenderHtml,
        draftHtml: nextDraftHtml,
        selectedFrameGroupIds: selectedFrameGroupIdsRef.current,
        positionGroupProxySelectionGroupId: positionGroupProxySelectionGroupIdRef.current,
        showAllGroupProxySelections: positionGroupProxySelectionShowAllGroupsRef.current,
      });
    }
    return nextDraftHtml;
  }, [pushCanvasHistoryEntry]);

  const requestPreviewTextFit = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      applyTemplateExtractEditableTextFit(root);
    });
  }, []);

  const syncPreviewSurfaceScale = React.useCallback((rootArg?: HTMLElement | null) => {
    const root = rootArg || previewRef.current;

    if (!root) {
      return;
    }

    const sourceRect = readPreviewSourceRect(root);
    const availableWidth = root.clientWidth;

    if (!sourceRect || !availableWidth) {
      root.removeAttribute('data-template-preview-scaled');
      root.style.removeProperty('--template-preview-scale');
      root.style.removeProperty('--template-preview-source-width');
      root.style.removeProperty('--template-preview-source-height');
      root.style.removeProperty('--template-preview-scaled-height');
      setPreviewZoom(100);
      return;
    }

    const scale = Math.min(availableWidth / sourceRect.width, 1);
    const nextZoom = Math.max(20, Number((scale * 100).toFixed(1)));

    root.setAttribute('data-template-preview-scaled', 'true');
    root.style.setProperty('--template-preview-scale', String(scale));
    root.style.setProperty('--template-preview-source-width', `${sourceRect.width}px`);
    root.style.setProperty('--template-preview-source-height', `${sourceRect.height}px`);
    root.style.setProperty('--template-preview-scaled-height', `${sourceRect.height * scale}px`);
    setPreviewZoom((previous) => (Math.abs(previous - nextZoom) <= 0.25 ? previous : nextZoom));
  }, []);

  const getFrameNodes = React.useCallback(
    (scope?: ParentNode | null) => collectFrameSelectionAnchors(scope || previewRef.current),
    []
  );
  const persistVirtualFrameDefinitions = React.useCallback(
    (nextDefinitions: VirtualFrameDefinition[]) => {
      const root = previewRef.current;
      const host = root?.querySelector<HTMLElement>('.page-inner') || root;

      if (!root || !host) {
        return;
      }

      const normalized = nextDefinitions
        .map((definition) => ({
          id: normalizeVirtualDefinitionId(definition.id),
          label: definition.label.trim(),
        }))
        .filter((definition) => definition.id && definition.label);

      if (normalized.length > 0) {
        host.setAttribute(TEMPLATE_VIRTUAL_FRAME_DEFINITIONS_ATTR, JSON.stringify(normalized));
      } else {
        host.removeAttribute(TEMPLATE_VIRTUAL_FRAME_DEFINITIONS_ATTR);
      }

      syncDraftPreviewHtmlRef();
    },
    [syncDraftPreviewHtmlRef]
  );

  const availableFrameGroupIds = React.useMemo(() => {
    const root = previewRef.current;

    if (!root) {
      return [];
    }

    return getFrameNodes(root)
      .map((node) => getFrameGroupId(node))
      .filter((frameGroupId) => Boolean(frameGroupId))
      .sort((left, right) => left.localeCompare(right, 'ko'));
  }, [getFrameNodes, previewDomVersion, renderedPreviewHtml, selectedFrameGroupIds]);
  const positionBoxGroups = React.useMemo(
    () => (previewRef.current ? collectPositionBoxGroups(previewRef.current, { includeSingletons: false }) : []),
    [previewDomVersion, renderedPreviewHtml]
  );
  const positionBoxGroupByFrameGroupId = React.useMemo(() => {
    const nextMap = new Map<string, PositionImpactGroup>();

    positionBoxGroups.forEach((group) => {
      group.frameGroupIds.forEach((frameGroupId) => {
        nextMap.set(frameGroupId, group);
      });
    });

    return nextMap;
  }, [positionBoxGroups]);
  React.useEffect(() => {
    const activeGroupIdSet = new Set(positionBoxGroups.map((group) => group.id));

    setExpandedPositionBoxGroupIds((previous) => {
      const next: Record<string, boolean> = {};

      Object.entries(previous).forEach(([groupId, expanded]) => {
        if (!activeGroupIdSet.has(groupId)) {
          return;
        }

        if (expanded) {
          next[groupId] = true;
        }
      });

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      const hasSameKeys =
        previousKeys.length === nextKeys.length &&
        previousKeys.every((key) => nextKeys.includes(key));

      if (!hasSameKeys) {
        return next;
      }

      return previousKeys.every((key) => previous[key] === next[key]) ? previous : next;
    });
  }, [positionBoxGroups]);
  const resolvePositionSelectionClickChain = React.useCallback(
    (
      pageInner: HTMLElement | null,
      frameGroupId: string,
      point: { x: number; y: number } | null
    ): {
      entries: PositionSelectionClickChainEntry[];
    } => {
      const normalizedFrameGroupId = frameGroupId.trim();

      if (!pageInner || !normalizedFrameGroupId) {
        return {
          entries: normalizedFrameGroupId
            ? [
                {
                  kind: 'frame',
                  frameGroupId: normalizedFrameGroupId,
                },
              ]
            : [],
        };
      }

      const frameNodeById = new Map<string, HTMLElement>();
      collectFrameSelectionAnchors(pageInner).forEach((node) => {
        const candidateFrameGroupId = getFrameGroupId(node);
        if (candidateFrameGroupId) {
          frameNodeById.set(candidateFrameGroupId, node);
        }
      });

      const selectableGroups = collectPositionBoxGroups(pageInner, { includeSingletons: false })
        .filter((group) => group.frameGroupIds.length > 1)
        .filter((group) => group.frameGroupIds.includes(normalizedFrameGroupId))
        .map((group) => {
          const rectEntries = group.frameGroupIds
            .map((candidateFrameGroupId) => {
              const candidateNode = frameNodeById.get(candidateFrameGroupId) || null;
              if (!candidateNode) {
                return null;
              }
              const shell = resolveFrameLayoutShell(candidateNode);
              return readFrameElementRect(shell, pageInner);
            })
            .filter((rect): rect is FrameNodeRect => Boolean(rect));

          if (rectEntries.length <= 1) {
            return null;
          }

          const minLeft = Math.min(...rectEntries.map((rect) => rect.left));
          const minTop = Math.min(...rectEntries.map((rect) => rect.top));
          const maxRight = Math.max(...rectEntries.map((rect) => rect.left + rect.width));
          const maxBottom = Math.max(...rectEntries.map((rect) => rect.top + rect.height));
          const rect = {
            left: minLeft,
            top: minTop,
            width: Math.max(1, maxRight - minLeft),
            height: Math.max(1, maxBottom - minTop),
          };
          return {
            group,
            rect,
          };
        })
        .filter(
          (
            candidate
          ): candidate is {
            group: PositionImpactGroup;
            rect: FrameNodeRect;
          } => Boolean(candidate)
        );

      const tolerance = FRAME_RESIZE_TOLERANCE_PX;
      const pointCandidates =
        point === null
          ? []
          : selectableGroups.filter((candidate) => {
              const rectRight = candidate.rect.left + candidate.rect.width;
              const rectBottom = candidate.rect.top + candidate.rect.height;
              return (
                point.x >= candidate.rect.left - tolerance &&
                point.x <= rectRight + tolerance &&
                point.y >= candidate.rect.top - tolerance &&
                point.y <= rectBottom + tolerance
              );
            });

      const clickedMemberGroup = positionBoxGroupByFrameGroupId.get(normalizedFrameGroupId) || null;
      const fallbackCandidates = clickedMemberGroup
        ? selectableGroups.filter((candidate) => candidate.group.id === clickedMemberGroup.id)
        : [];
      const sortedCandidates = Array.from(new Map(
        [...pointCandidates, ...fallbackCandidates].map((candidate) => [candidate.group.id, candidate])
      ).values()).sort((left, right) => {
        const leftArea = left.rect.width * left.rect.height;
        const rightArea = right.rect.width * right.rect.height;

        if (Math.abs(leftArea - rightArea) > 0.1) {
          return rightArea - leftArea;
        }

        if (left.group.frameGroupIds.length !== right.group.frameGroupIds.length) {
          return right.group.frameGroupIds.length - left.group.frameGroupIds.length;
        }

        return left.group.id.localeCompare(right.group.id, 'ko');
      });

      const entries: PositionSelectionClickChainEntry[] = [];
      sortedCandidates.forEach((candidate) => {
        if (entries.some((entry) => entry.kind === 'group' && entry.groupId === candidate.group.id)) {
          return;
        }

        entries.push({
          kind: 'group',
          frameGroupId: normalizedFrameGroupId,
          groupId: candidate.group.id,
        });
      });

      entries.push({
        kind: 'frame',
        frameGroupId: normalizedFrameGroupId,
      });

      return {
        entries,
      };
    },
    [positionBoxGroupByFrameGroupId]
  );
  const resolvePositionOrderLockSelectionVisual = React.useCallback(
    (selectionOrder: number, groupId: string) => {
      const preset = resolvePositionLockColorPreset(selectionOrder, positionOrderLockColorSeed);
      return {
        selectionOrder,
        groupId,
        ...preset,
      };
    },
    [positionOrderLockColorSeed]
  );
  const resolvePositionGroupProxySelection = React.useCallback(
    (
      candidateSelectedFrameGroupIds: string[],
      candidatePositionGroupProxySelectionGroupId: string
    ): PositionGroupProxySelection | null => {
      if (selectionPanelTab !== 'position') {
        return null;
      }

      const normalizedProxyGroupId = candidatePositionGroupProxySelectionGroupId.trim();
      const normalizedSelectedIds = candidateSelectedFrameGroupIds
        .map((frameGroupId) => frameGroupId.trim())
        .filter((frameGroupId) => Boolean(frameGroupId));

      if (!normalizedProxyGroupId || normalizedSelectedIds.length <= 0) {
        return null;
      }

      const group = positionBoxGroups.find((candidate) => candidate.id === normalizedProxyGroupId) || null;

      if (!group || group.frameGroupIds.length <= 1) {
        return null;
      }

      const selectedIdSet = new Set(normalizedSelectedIds);
      const hasSelectedGroupMember = group.frameGroupIds.some((frameGroupId) => selectedIdSet.has(frameGroupId));
      if (!hasSelectedGroupMember) {
        return null;
      }

      return {
        groupId: group.id,
        label: group.label,
        frameGroupIds: group.frameGroupIds.slice(),
      };
    },
    [positionBoxGroups, selectionPanelTab]
  );
  const resolvePositionGroupProxySelections = React.useCallback(
    (
      candidateSelectedFrameGroupIds: string[],
      candidatePositionGroupProxySelectionGroupId: string,
      options?: {
        selectionKindByFrameGroupId?: Record<string, 'group' | 'frame'>;
      }
    ): PositionGroupProxySelection[] => {
      const selectedIds = candidateSelectedFrameGroupIds
        .map((frameGroupId) => frameGroupId.trim())
        .filter((frameGroupId) => Boolean(frameGroupId));
      const selectedIdSet = new Set(selectedIds);
      const persistedProxySelectionsOverride = positionGroupProxySelectionsOverrideRef.current;

      if (persistedProxySelectionsOverride !== null && !positionOrderLockSelectionMode) {
        return persistedProxySelectionsOverride
          .map((entry) => {
            const frameGroupIds = Array.from(
              new Set(
                entry.frameGroupIds
                  .map((frameGroupId) => frameGroupId.trim())
                  .filter((frameGroupId) => Boolean(frameGroupId))
              )
            );
            return {
              ...entry,
              frameGroupIds,
            };
          })
          .filter(
            (entry) =>
              entry.frameGroupIds.length > 0 &&
              entry.frameGroupIds.every((frameGroupId) => selectedIdSet.has(frameGroupId))
          );
      }

      const result: PositionGroupProxySelection[] = [];
      const seenGroupIds = new Set<string>();

      const primaryProxy = resolvePositionGroupProxySelection(
        candidateSelectedFrameGroupIds,
        candidatePositionGroupProxySelectionGroupId
      );

      if (primaryProxy) {
        if (positionOrderLockSelectionMode) {
          const selectionOrderCandidateIndexes = primaryProxy.frameGroupIds
            .map((frameGroupId) => selectedIds.indexOf(frameGroupId))
            .filter((selectionIndex) => selectionIndex >= 0);
          const selectionOrder =
            selectionOrderCandidateIndexes.length > 0
              ? Math.max(1, Math.min(...selectionOrderCandidateIndexes) + 1)
              : 1;
          const visual = resolvePositionOrderLockSelectionVisual(selectionOrder, primaryProxy.groupId);
          result.push({
            ...primaryProxy,
            selectionOrder,
            colorName: visual.colorName,
            outlineColor: visual.outlineColor,
            fillColor: visual.fillColor,
            haloColor: visual.haloColor,
            badgeColor: visual.badgeColor,
            badgeTextColor: visual.badgeTextColor,
          });
        } else {
          result.push(primaryProxy);
        }
        seenGroupIds.add(primaryProxy.groupId);
      }

      const shouldShowGroupProxySelections =
        positionGroupProxySelectionShowAllGroupsRef.current || positionOrderLockSelectionMode;

      if (!shouldShowGroupProxySelections) {
        return result;
      }

      let nextSelectionOrder = result.reduce((maxOrder, entry) => {
        const entryOrder = Number.isFinite(entry.selectionOrder) ? Number(entry.selectionOrder) : 0;
        return Math.max(maxOrder, entryOrder);
      }, 0);

      selectedIds.forEach((frameGroupId) => {
        const group = positionBoxGroupByFrameGroupId.get(frameGroupId);
        const optionSelectionKind = options?.selectionKindByFrameGroupId?.[frameGroupId];
        const selectionKind = positionOrderLockSelectionMode
          ? positionOrderLockSelectionKindByFrameGroupId[frameGroupId] || 'frame'
          : optionSelectionKind
            ? optionSelectionKind
            : group && group.frameGroupIds.length > 1
              ? 'group'
              : 'frame';
        const shouldUseGroup = selectionKind === 'group' && Boolean(group) && (group?.frameGroupIds.length || 0) > 1;

        if (!positionOrderLockSelectionMode && !shouldUseGroup) {
          return;
        }

        const resolvedGroupId = shouldUseGroup ? group?.id || `single:${frameGroupId}` : `single:${frameGroupId}`;

        if (seenGroupIds.has(resolvedGroupId)) {
          return;
        }
        if (positionOrderLockSelectionMode) {
          nextSelectionOrder += 1;
          const selectionOrder = nextSelectionOrder;
          const visual = resolvePositionOrderLockSelectionVisual(selectionOrder, resolvedGroupId);
          result.push({
            groupId: resolvedGroupId,
            label: shouldUseGroup ? group?.label || frameGroupId : frameGroupId,
            frameGroupIds: shouldUseGroup ? group?.frameGroupIds.slice() || [frameGroupId] : [frameGroupId],
            selectionOrder,
            colorName: visual.colorName,
            outlineColor: visual.outlineColor,
            fillColor: visual.fillColor,
            haloColor: visual.haloColor,
            badgeColor: visual.badgeColor,
            badgeTextColor: visual.badgeTextColor,
          });
        } else {
          result.push({
            groupId: resolvedGroupId,
            label: shouldUseGroup ? group?.label || frameGroupId : frameGroupId,
            frameGroupIds: shouldUseGroup ? group?.frameGroupIds.slice() || [frameGroupId] : [frameGroupId],
          });
        }
        seenGroupIds.add(resolvedGroupId);
      });

      return result;
    },
    [
      positionBoxGroupByFrameGroupId,
      positionOrderLockSelectionKindByFrameGroupId,
      positionOrderLockSelectionMode,
      resolvePositionGroupProxySelection,
      resolvePositionOrderLockSelectionVisual,
      selectionPanelTab,
    ]
  );
  const primarySelectedPositionBoxGroup = React.useMemo(
    () => (primarySelectedFrameGroupId ? positionBoxGroupByFrameGroupId.get(primarySelectedFrameGroupId) || null : null),
    [positionBoxGroupByFrameGroupId, primarySelectedFrameGroupId]
  );
  const frameNodePickerOptions = React.useMemo(() => {
    if (!previewRef.current) {
      return [];
    }

    return availableFrameGroupIds.map((frameGroupId) => {
      const node = previewRef.current?.querySelector<HTMLElement>(
        `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`
      );
      const groupLabel = positionBoxGroupByFrameGroupId.get(frameGroupId)?.label || '';
      const baseLabel = readFrameDisplayText(resolveFrameSelectionAnchor(node)) || frameGroupId;
      const label = groupLabel ? `[${groupLabel}] ${baseLabel}` : baseLabel;
      return {
        id: frameGroupId,
        label,
        meta: frameGroupId,
      };
    });
  }, [availableFrameGroupIds, positionBoxGroupByFrameGroupId, renderedPreviewHtml]);
  const positionRelationFrameLabelById = React.useMemo(
    () => new Map(frameNodePickerOptions.map((option) => [option.id, option.label])),
    [frameNodePickerOptions]
  );
  React.useEffect(() => {
    const primarySelectedFrameGroupId = readSingleFrameGroupId(selectedFrameGroupIds);
    const hasValidAnchor =
      Boolean(positionRelationAnchorFrameGroupId) && positionRelationFrameLabelById.has(positionRelationAnchorFrameGroupId);
    const hasValidTarget =
      Boolean(positionRelationTargetFrameGroupId) && positionRelationFrameLabelById.has(positionRelationTargetFrameGroupId);

    if (selectedFrameGroupIds.length <= 0) {
      if (!hasValidAnchor && positionRelationAnchorFrameGroupId) {
        setPositionRelationAnchorFrameGroupId('');
      }
      if (!hasValidTarget && positionRelationTargetFrameGroupId) {
        setPositionRelationTargetFrameGroupId('');
      }
      return;
    }

    if (selectedFrameGroupIds.length === 1) {
      if (!hasValidTarget || positionRelationTargetFrameGroupId !== primarySelectedFrameGroupId) {
        setPositionRelationTargetFrameGroupId(primarySelectedFrameGroupId);
      }

      if (!hasValidAnchor || positionRelationAnchorFrameGroupId === primarySelectedFrameGroupId) {
        setPositionRelationAnchorFrameGroupId('');
      }
      return;
    }

    if (selectedFrameGroupIds.length > 1) {
      if (!hasValidAnchor && positionRelationAnchorFrameGroupId) {
        setPositionRelationAnchorFrameGroupId('');
      }
      if (!hasValidTarget && positionRelationTargetFrameGroupId) {
        setPositionRelationTargetFrameGroupId('');
      }
      return;
    }

  }, [
    positionRelationAnchorFrameGroupId,
    positionRelationFrameLabelById,
    positionRelationTargetFrameGroupId,
    selectedFrameGroupIds,
  ]);
  const keyBoxPickerOptions = React.useMemo(() => {
    const frameOptions = availableFrameGroupIds.map((frameGroupId) => {
      const node = previewRef.current?.querySelector<HTMLElement>(
        `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`
      );
      const label = readFrameDisplayText(resolveFrameSelectionAnchor(node)) || frameGroupId;
      return {
        id: frameGroupId,
        label,
        meta: frameGroupId,
      };
    });

    const virtualOptions = virtualFrameDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      meta: definition.id,
    }));

    const dedup = new Map<string, { id: string; label: string; meta: string }>();
    [...frameOptions, ...virtualOptions].forEach((option) => {
      if (!dedup.has(option.id)) {
        dedup.set(option.id, option);
      }
    });
    return Array.from(dedup.values());
  }, [availableFrameGroupIds, renderedPreviewHtml, virtualFrameDefinitions]);
  const selectedPositionTargetFrameGroupId = React.useMemo(
    () => {
      const normalizedTargetFrameGroupId = positionRelationTargetFrameGroupId.trim();

      if (!normalizedTargetFrameGroupId) {
        return '';
      }

      return normalizedTargetFrameGroupId;
    },
    [positionRelationTargetFrameGroupId]
  );
  const definedPositionRelativeRelations = React.useMemo(() => {
    const root = previewRef.current;

    if (!root) {
      return [] as DefinedPositionRelativeRelation[];
    }

    const frameNodes = collectFrameSelectionAnchors(root);
    const frameNodeById = new Map<string, HTMLElement>();
    frameNodes.forEach((node) => {
      const frameGroupId = getFrameGroupId(node);
      if (frameGroupId) {
        frameNodeById.set(frameGroupId, node);
      }
    });

    const allPositionGroups = collectPositionBoxGroups(root, { includeSingletons: true });
    const positionGroupById = new Map<string, PositionImpactGroup>();
    const positionGroupByFrameGroupId = new Map<string, PositionImpactGroup>();
    allPositionGroups.forEach((group) => {
      positionGroupById.set(group.id, group);
      group.frameGroupIds.forEach((frameGroupId) => {
        positionGroupByFrameGroupId.set(frameGroupId, group);
      });
    });

    const buildGroupLabel = (group: PositionImpactGroup) => {
      if (group.frameGroupIds.length > 1) {
        return `${group.label} (묶음 ${group.frameGroupIds.length}개)`;
      }

      const singleFrameGroupId = readSingleFrameGroupId(group.frameGroupIds);
      return singleFrameGroupId || group.label || group.id;
    };

    const buildFrameLabel = (frameGroupId: string) => {
      const resolvedId = frameGroupId.trim();
      if (!resolvedId) {
        return '-';
      }
      const frameText = positionRelationFrameLabelById.get(resolvedId) || '';
      return frameText ? `${resolvedId} | ${frameText}` : resolvedId;
    };

    const resolveRectFromFrameGroupIds = (frameGroupIds: string[]) => {
      const memberRects = frameGroupIds
        .map((frameGroupId) => {
          const memberNode = frameNodeById.get(frameGroupId) || null;
          return memberNode ? readFrameMoveRect(memberNode) : null;
        })
        .filter((rect): rect is FrameNodeRect => Boolean(rect));

      if (memberRects.length <= 0) {
        return null;
      }

      const minLeft = Math.min(...memberRects.map((rect) => rect.left));
      const minTop = Math.min(...memberRects.map((rect) => rect.top));
      const maxRight = Math.max(...memberRects.map((rect) => rect.left + rect.width));
      const maxBottom = Math.max(...memberRects.map((rect) => rect.top + rect.height));
      return {
        left: minLeft,
        top: minTop,
        width: Math.max(1, maxRight - minLeft),
        height: Math.max(1, maxBottom - minTop),
      };
    };

    const groupRectById = new Map<string, FrameNodeRect>();
    allPositionGroups.forEach((group) => {
      const groupRect = resolveRectFromFrameGroupIds(group.frameGroupIds);
      if (groupRect) {
        groupRectById.set(group.id, groupRect);
      }
    });

    const candidates = frameNodes
      .map((targetNode) => {
        const targetFrameGroupId = getFrameGroupId(targetNode).trim();
        const targetPageInner = targetNode.closest<HTMLElement>('.page-inner') || null;

        if (!targetFrameGroupId || !targetPageInner) {
          return null;
        }

        const targetConfig =
          readStoredRelativeAnchorConfig(targetNode) || readStoredRelativeAnchorConfig(resolveFrameLayoutShell(targetNode));
        if (!targetConfig) {
          return null;
        }

        const targetPositionGroup = positionGroupByFrameGroupId.get(targetFrameGroupId) || null;
        const targetIsGrouped = Boolean(targetPositionGroup && targetPositionGroup.frameGroupIds.length > 1);
        const targetKind: DefinedPositionRelativeRelation['targetKind'] = targetIsGrouped ? 'group' : 'frame';
        const targetGroupId = targetKind === 'group' ? targetPositionGroup?.id || '' : '';
        const targetFrameGroupIds =
          targetKind === 'group' ? targetPositionGroup?.frameGroupIds.slice() || [targetFrameGroupId] : [targetFrameGroupId];
        const targetLabel =
          targetKind === 'group' && targetPositionGroup
            ? buildGroupLabel(targetPositionGroup)
            : buildFrameLabel(targetFrameGroupId);
        const targetRect =
          targetKind === 'group' && targetGroupId
            ? groupRectById.get(targetGroupId) || readFrameMoveRect(targetNode)
            : readFrameMoveRect(targetNode);

        if (!targetRect) {
          return null;
        }

        let anchorKind: DefinedPositionRelativeRelation['anchorKind'] = targetConfig.anchorKind;
        let anchorLabel = '-';
        let anchorPageCornerId = '';
        let anchorGroupId = '';
        let anchorFrameGroupId = '';
        let anchorFrameGroupIds: string[] = [];
        let anchorRect: FrameNodeRect | null = null;

        if (targetConfig.anchorKind === 'group') {
          const configuredAnchorGroupId = String(targetConfig.anchorId || '').trim();
          const anchorGroup = positionGroupById.get(configuredAnchorGroupId);

          if (anchorGroup && anchorGroup.frameGroupIds.length > 1) {
            anchorKind = 'group';
            anchorGroupId = anchorGroup.id;
            anchorFrameGroupIds = anchorGroup.frameGroupIds.slice();
            anchorLabel = buildGroupLabel(anchorGroup);
            anchorRect = groupRectById.get(anchorGroup.id) || null;
          } else {
            anchorKind = 'frame';
            anchorFrameGroupId = configuredAnchorGroupId;
            anchorFrameGroupIds = anchorFrameGroupId ? [anchorFrameGroupId] : [];
            anchorLabel = buildFrameLabel(anchorFrameGroupId);
            const anchorNode = frameNodeById.get(anchorFrameGroupId) || null;
            anchorRect = anchorNode ? readFrameMoveRect(anchorNode) : null;
          }
        } else if (targetConfig.anchorKind === 'frame') {
          const configuredAnchorFrameGroupId = String(targetConfig.anchorId || '').trim();
          const anchorPositionGroup = positionGroupByFrameGroupId.get(configuredAnchorFrameGroupId) || null;

          if (anchorPositionGroup && anchorPositionGroup.frameGroupIds.length > 1) {
            anchorKind = 'group';
            anchorGroupId = anchorPositionGroup.id;
            anchorFrameGroupIds = anchorPositionGroup.frameGroupIds.slice();
            anchorLabel = buildGroupLabel(anchorPositionGroup);
            anchorRect = groupRectById.get(anchorPositionGroup.id) || null;
          } else {
            anchorKind = 'frame';
            anchorFrameGroupId = configuredAnchorFrameGroupId;
            anchorFrameGroupIds = configuredAnchorFrameGroupId ? [configuredAnchorFrameGroupId] : [];
            anchorLabel = buildFrameLabel(configuredAnchorFrameGroupId);
            const anchorNode = frameNodeById.get(configuredAnchorFrameGroupId) || null;
            anchorRect = anchorNode ? readFrameMoveRect(anchorNode) : null;
          }
        } else {
          anchorKind = 'page-corner';
          anchorPageCornerId = String(targetConfig.anchorId || '').trim();
          anchorLabel = PAGE_CORNER_ANCHOR_LABELS[targetConfig.anchorId] || targetConfig.anchorId;
          anchorRect = resolveRelativeAnchorRect(targetPageInner, targetConfig);
        }

        const targetEntityKey = targetKind === 'group' ? `group:${targetGroupId}` : `frame:${targetFrameGroupId}`;
        const anchorEntityKey =
          anchorKind === 'group'
            ? `group:${anchorGroupId}`
            : anchorKind === 'frame'
              ? `frame:${anchorFrameGroupId}`
              : `corner:${anchorPageCornerId}`;

        if (targetEntityKey === anchorEntityKey) {
          return null;
        }

        const gapYPx =
          targetRect && anchorRect
            ? Math.round(targetRect.top - (anchorRect.top + anchorRect.height))
            : Math.round(targetConfig.offsetY);

        return {
          key: `${targetKind}:${targetGroupId || targetFrameGroupId}:${anchorKind}:${anchorGroupId || anchorFrameGroupId || targetConfig.anchorId}`,
          targetKind,
          targetGroupId,
          targetLabel,
          targetFrameGroupIds,
          targetConfiguredFrameGroupIds: [targetFrameGroupId],
          anchorKind,
          anchorLabel,
          anchorPageCornerId,
          anchorGroupId,
          anchorFrameGroupId,
          anchorFrameGroupIds,
          gapYPx,
          targetSortTop: targetRect.top,
        };
      })
      .filter(
        (
          value
        ): value is {
          targetSortTop: number;
        } & DefinedPositionRelativeRelation => Boolean(value)
      )
      .sort((left, right) => left.targetSortTop - right.targetSortTop);

    const mergedByKey = new Map<string, { targetSortTop: number } & DefinedPositionRelativeRelation>();
    candidates.forEach((candidate) => {
      const existing = mergedByKey.get(candidate.key);

      if (!existing) {
        mergedByKey.set(candidate.key, candidate);
        return;
      }

      existing.targetSortTop = Math.min(existing.targetSortTop, candidate.targetSortTop);
      existing.targetFrameGroupIds = Array.from(new Set([...existing.targetFrameGroupIds, ...candidate.targetFrameGroupIds]));
      existing.targetConfiguredFrameGroupIds = Array.from(
        new Set([...existing.targetConfiguredFrameGroupIds, ...candidate.targetConfiguredFrameGroupIds])
      );
    });

    return Array.from(mergedByKey.values())
      .sort((left, right) => left.targetSortTop - right.targetSortTop)
      .map(({ targetSortTop: _targetSortTop, ...relation }) => relation);
  }, [positionRelationFrameLabelById, previewDomVersion, renderedPreviewHtml]);
  const focusedDefinedPositionRelativeRelations = React.useMemo(() => {
    if (definedPositionRelativeRelations.length <= 0) {
      return definedPositionRelativeRelations;
    }

    const selectedEntityKeys = Array.from(
      new Set(
        selectedFrameGroupIds
          .map((frameGroupId) => frameGroupId.trim())
          .filter((frameGroupId) => Boolean(frameGroupId))
          .map((frameGroupId) => {
            const positionGroup = positionBoxGroupByFrameGroupId.get(frameGroupId);
            return positionGroup && positionGroup.frameGroupIds.length > 1 ? `group:${positionGroup.id}` : `frame:${frameGroupId}`;
          })
      )
    );

    if (selectedEntityKeys.length <= 0) {
      return definedPositionRelativeRelations;
    }

    const resolveTargetEntityKey = (relation: DefinedPositionRelativeRelation) =>
      relation.targetKind === 'group'
        ? `group:${relation.targetGroupId}`
        : `frame:${
            relation.targetFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) ||
            relation.targetConfiguredFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) ||
            ''
          }`;
    const resolveAnchorEntityKey = (relation: DefinedPositionRelativeRelation) =>
      relation.anchorKind === 'group'
        ? `group:${relation.anchorGroupId}`
        : relation.anchorKind === 'frame'
          ? `frame:${relation.anchorFrameGroupId}`
          : `corner:${relation.anchorPageCornerId}`;

    const adjacentEntityKeys = new Map<string, Set<string>>();
    definedPositionRelativeRelations.forEach((relation) => {
      const targetEntityKey = resolveTargetEntityKey(relation);
      const anchorEntityKey = resolveAnchorEntityKey(relation);

      if (!adjacentEntityKeys.has(targetEntityKey)) {
        adjacentEntityKeys.set(targetEntityKey, new Set<string>());
      }

      if (relation.anchorKind !== 'page-corner') {
        if (!adjacentEntityKeys.has(anchorEntityKey)) {
          adjacentEntityKeys.set(anchorEntityKey, new Set<string>());
        }

        adjacentEntityKeys.get(targetEntityKey)!.add(anchorEntityKey);
        adjacentEntityKeys.get(anchorEntityKey)!.add(targetEntityKey);
      }
    });

    const queue = [...selectedEntityKeys];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentEntityKey = queue.shift() || '';

      if (!currentEntityKey || visited.has(currentEntityKey)) {
        continue;
      }

      visited.add(currentEntityKey);
      const neighbors = adjacentEntityKeys.get(currentEntityKey);
      if (!neighbors) {
        continue;
      }

      neighbors.forEach((neighborEntityKey) => {
        if (!visited.has(neighborEntityKey)) {
          queue.push(neighborEntityKey);
        }
      });
    }

    if (visited.size <= 0) {
      return definedPositionRelativeRelations;
    }

    return definedPositionRelativeRelations.filter((relation) => {
      const targetEntityKey = resolveTargetEntityKey(relation);
      const anchorEntityKey = resolveAnchorEntityKey(relation);
      if (visited.has(targetEntityKey)) {
        return true;
      }

      return relation.anchorKind !== 'page-corner' && visited.has(anchorEntityKey);
    });
  }, [definedPositionRelativeRelations, positionBoxGroupByFrameGroupId, selectedFrameGroupIds]);
  const definedPositionRelativeRelationDisplayRows = React.useMemo(
    () =>
      focusedDefinedPositionRelativeRelations.map((relation) => ({
        key: relation.key,
        targetLabel:
          relation.targetKind === 'group'
            ? relation.targetLabel.replace(/\s*\(묶음\s*\d+개\)\s*$/u, '')
            : relation.targetFrameGroupIds.join(', ') || '-',
        anchorLabel:
          relation.anchorKind === 'group'
            ? relation.anchorLabel.replace(/\s*\(묶음\s*\d+개\)\s*$/u, '')
            : relation.anchorKind === 'frame'
              ? relation.anchorFrameGroupId
              : relation.anchorLabel,
        gapYLabel: `${relation.gapYPx}px`,
      })),
    [focusedDefinedPositionRelativeRelations]
  );
  const shouldShowDefinedPositionRelativeRelations = definedPositionRelativeRelationDisplayRows.length > 0;
  React.useEffect(() => {
    if (focusedDefinedPositionRelativeRelations.length <= 0) {
      setDefinedPositionRelationGapDraftByKey((previous) => (Object.keys(previous).length > 0 ? {} : previous));
      return;
    }

    setDefinedPositionRelationGapDraftByKey((previous) => {
      const next: Record<string, { gapY: string }> = {};
      focusedDefinedPositionRelativeRelations.forEach((relation) => {
        next[relation.key] = previous[relation.key] || {
          gapY: String(Math.round(relation.gapYPx)),
        };
      });

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      const hasSameKeys =
        previousKeys.length === nextKeys.length &&
        previousKeys.every((key) => nextKeys.includes(key));
      const hasSameValues = hasSameKeys
        ? previousKeys.every((key) => previous[key]?.gapY === next[key]?.gapY)
        : false;

      return hasSameValues ? previous : next;
    });
  }, [focusedDefinedPositionRelativeRelations]);
  const applyDefinedPositionRelationGapDraft = React.useCallback(
    (relation: DefinedPositionRelativeRelation, nextGapYRaw: string) => {
      setDefinedPositionRelationGapDraftByKey((previous) => ({
        ...previous,
        [relation.key]: { gapY: nextGapYRaw },
      }));

      const nextGapY = Number.parseFloat(nextGapYRaw);
      if (!Number.isFinite(nextGapY)) {
        return;
      }

      const root = previewRef.current;
      if (!root) {
        return;
      }

      const frameNodeById = new Map<string, HTMLElement>();
      collectFrameSelectionAnchors(root).forEach((node) => {
        const frameGroupId = getFrameGroupId(node);
        if (frameGroupId) {
          frameNodeById.set(frameGroupId, node);
        }
      });

      const resolveRectFromFrameGroupIds = (frameGroupIds: string[]) => {
        const memberRects = frameGroupIds
          .map((frameGroupId) => {
            const memberNode = frameNodeById.get(frameGroupId) || null;
            return memberNode ? readFrameMoveRect(memberNode) : null;
          })
          .filter((rect): rect is FrameNodeRect => Boolean(rect));

        if (memberRects.length <= 0) {
          return null;
        }

        const minLeft = Math.min(...memberRects.map((rect) => rect.left));
        const minTop = Math.min(...memberRects.map((rect) => rect.top));
        const maxRight = Math.max(...memberRects.map((rect) => rect.left + rect.width));
        const maxBottom = Math.max(...memberRects.map((rect) => rect.top + rect.height));
        return {
          left: minLeft,
          top: minTop,
          width: Math.max(1, maxRight - minLeft),
          height: Math.max(1, maxBottom - minTop),
        };
      };

      const targetNodes = relation.targetConfiguredFrameGroupIds
        .map((frameGroupId) => frameNodeById.get(frameGroupId) || null)
        .filter((node): node is HTMLElement => Boolean(node));

      if (targetNodes.length <= 0) {
        return;
      }

      const targetNodesByPageInner = new Map<HTMLElement, HTMLElement[]>();
      targetNodes.forEach((node) => {
        const pageInner = node.closest<HTMLElement>('.page-inner');
        if (!pageInner) {
          return;
        }
        const currentNodes = targetNodesByPageInner.get(pageInner) || [];
        currentNodes.push(node);
        targetNodesByPageInner.set(pageInner, currentNodes);
      });

      const targetPageBucket = Array.from(targetNodesByPageInner.entries())
        .map(([pageInner, nodes]) => {
          const top = Math.min(...nodes.map((node) => readFrameMoveRect(node).top));
          return {
            pageInner,
            nodes,
            count: nodes.length,
            top,
          };
        })
        .sort((left, right) => {
          if (left.count !== right.count) {
            return right.count - left.count;
          }
          if (Math.abs(left.top - right.top) > 0.1) {
            return left.top - right.top;
          }
          return 0;
        })[0];

      const targetPageInner = targetPageBucket?.pageInner || null;
      const targetNodesInPage = targetPageBucket?.nodes || [];

      if (!targetPageInner || targetNodesInPage.length <= 0) {
        return;
      }

      const targetRectFromNodes = (() => {
        const memberRects = targetNodesInPage.map((node) => readFrameMoveRect(node));
        if (memberRects.length <= 0) {
          return null;
        }
        const minLeft = Math.min(...memberRects.map((rect) => rect.left));
        const minTop = Math.min(...memberRects.map((rect) => rect.top));
        const maxRight = Math.max(...memberRects.map((rect) => rect.left + rect.width));
        const maxBottom = Math.max(...memberRects.map((rect) => rect.top + rect.height));
        return {
          left: minLeft,
          top: minTop,
          width: Math.max(1, maxRight - minLeft),
          height: Math.max(1, maxBottom - minTop),
        };
      })();

      const targetRect =
        relation.targetKind === 'group'
          ? resolveRectFromFrameGroupIds(relation.targetFrameGroupIds) || targetRectFromNodes
          : targetRectFromNodes;
      const anchorRect =
        relation.anchorKind === 'group'
          ? resolveRectFromFrameGroupIds(relation.anchorFrameGroupIds)
          : relation.anchorKind === 'frame'
            ? resolveRectFromFrameGroupIds([relation.anchorFrameGroupId])
            : resolvePageCornerAnchorRect(targetPageInner, relation.anchorPageCornerId);

      if (!targetRectFromNodes || !targetRect || !anchorRect) {
        return;
      }

      const currentGapY = targetRect.top - (anchorRect.top + anchorRect.height);
      const deltaY = nextGapY - currentGapY;

      if (Math.abs(deltaY) <= 0.1) {
        return;
      }

      const relationAnchorKind: TemplateFrameRelativeAnchorKind = relation.anchorKind;
      const relationAnchorId: TemplateFrameRelativeAnchorId =
        relation.anchorKind === 'group'
          ? relation.anchorGroupId
          : relation.anchorKind === 'frame'
            ? relation.anchorFrameGroupId
            : relation.anchorPageCornerId;
      relation.targetConfiguredFrameGroupIds.forEach((targetFrameGroupId) => {
        const targetNode = frameNodeById.get(targetFrameGroupId) || null;
        const nodePageInner = targetNode?.closest<HTMLElement>('.page-inner') || null;
        const nodeRect = targetNode ? readFrameMoveRect(targetNode) : null;

        if (!targetNode || !nodePageInner || !nodeRect || nodePageInner !== targetPageInner) {
          return;
        }

        const currentConfig =
          readStoredRelativeAnchorConfig(targetNode) ||
          readStoredRelativeAnchorConfig(resolveFrameLayoutShell(targetNode));
        const hasSameAnchorIdentity =
          Boolean(currentConfig) &&
          currentConfig.anchorKind === relationAnchorKind &&
          String(currentConfig.anchorId || '').trim() === String(relationAnchorId || '').trim();
        const preferredPins = resolvePreferredRelativeAnchorPins(nodeRect, anchorRect);

        const nextConfig = buildRelativeAnchorConfigFromRect({
          frameRect: {
            ...nodeRect,
            top: nodeRect.top + deltaY,
          },
          anchorRect,
          anchorKind: relationAnchorKind,
          anchorId: relationAnchorId,
          preferredAnchorX: hasSameAnchorIdentity ? currentConfig?.anchorX : preferredPins.preferredAnchorX,
          preferredAnchorY: hasSameAnchorIdentity ? currentConfig?.anchorY : preferredPins.preferredAnchorY,
        });

        applyFramePositionMode(targetNode, 'relative', nodePageInner);
        writeFrameRelativeAnchorAttrs(targetNode, nextConfig);
      });
      applyRelativeAnchoredFrameRectsInRoot(root);
      syncDraftPreviewHtmlRef();
      requestPreviewTextFit();
    },
    [requestPreviewTextFit, syncDraftPreviewHtmlRef]
  );
  const selectedPositionGroupingFrameGroupIds = React.useMemo(() => {
    const selectedIds = new Set<string>();
    const orderedIds: string[] = [];

    selectedFrameGroupIds.forEach((frameGroupId) => {
      const normalizedFrameGroupId = frameGroupId.trim();

      if (!normalizedFrameGroupId || selectedIds.has(normalizedFrameGroupId)) {
        return;
      }

      selectedIds.add(normalizedFrameGroupId);
      orderedIds.push(normalizedFrameGroupId);
    });

    return orderedIds;
  }, [selectedFrameGroupIds]);
  const selectedPositionExactMatchedBoxGroup = React.useMemo(() => {
    if (selectionPanelTab !== 'position' || selectedPositionGroupingFrameGroupIds.length <= 1) {
      return null;
    }

    const selectedIdSet = new Set(selectedPositionGroupingFrameGroupIds);
    return (
      positionBoxGroups.find((group) => {
        if (group.frameGroupIds.length <= 1 || group.frameGroupIds.length !== selectedPositionGroupingFrameGroupIds.length) {
          return false;
        }
        return group.frameGroupIds.every((frameGroupId) => selectedIdSet.has(frameGroupId));
      }) || null
    );
  }, [positionBoxGroups, selectedPositionGroupingFrameGroupIds, selectionPanelTab]);
  const selectedPositionResolvedBoxGroup = React.useMemo(() => {
    if (selectionPanelTab !== 'position') {
      return null;
    }

    const activeProxyGroupId = positionGroupProxySelectionGroupIdRef.current.trim();
    if (activeProxyGroupId) {
      const activeProxyGroup = positionBoxGroups.find((group) => group.id === activeProxyGroupId) || null;
      if (activeProxyGroup) {
        return activeProxyGroup;
      }
    }

    return selectedPositionExactMatchedBoxGroup;
  }, [positionBoxGroups, selectedPositionExactMatchedBoxGroup, selectionPanelTab]);
  const selectedPositionResolvedFrameGroupIds = React.useMemo(() => {
    if (selectionPanelTab !== 'position') {
      return selectedPositionGroupingFrameGroupIds;
    }

    if (selectedPositionResolvedBoxGroup && selectedPositionResolvedBoxGroup.frameGroupIds.length > 1) {
      return selectedPositionResolvedBoxGroup.frameGroupIds
        .map((frameGroupId) => frameGroupId.trim())
        .filter((frameGroupId) => Boolean(frameGroupId));
    }

    return selectedPositionGroupingFrameGroupIds;
  }, [selectedPositionGroupingFrameGroupIds, selectedPositionResolvedBoxGroup, selectionPanelTab]);
  const selectedPositionImpactSourceFrameGroupIds = React.useMemo(() => {
    if (selectionPanelTab === 'position') {
      if (selectedPositionResolvedFrameGroupIds.length > 0) {
        return selectedPositionResolvedFrameGroupIds;
      }
    } else {
      if (primarySelectedFrameGroupId) {
        return [primarySelectedFrameGroupId];
      }
    }

    const anchorFrameGroupId = positionRelationAnchorFrameGroupId.trim();
    return anchorFrameGroupId ? [anchorFrameGroupId] : [];
  }, [
    primarySelectedFrameGroupId,
    positionRelationAnchorFrameGroupId,
    selectedPositionResolvedFrameGroupIds,
    selectionPanelTab,
  ]);
  const selectedPositionImpactGroups = React.useMemo(() => {
    if (!previewRef.current) {
      return [];
    }

    return collectPositionImpactGroupsBySourceIds(
      previewRef.current,
      selectedPositionImpactSourceFrameGroupIds,
      { includeSourceFrameGroupIds: false }
    );
  }, [previewDomVersion, renderedPreviewHtml, selectedPositionImpactSourceFrameGroupIds]);
  const selectedPositionImpactFrameGroupIds = React.useMemo(() => {
    const impactedFrameGroupIds = new Set<string>();

    selectedPositionImpactGroups.forEach((group) => {
      group.frameGroupIds.forEach((frameGroupId) => {
        impactedFrameGroupIds.add(frameGroupId);
      });
    });

    return Array.from(impactedFrameGroupIds).sort((left, right) => left.localeCompare(right, 'ko'));
  }, [selectedPositionImpactGroups]);
  const selectedPositionImpactGroupLabels = React.useMemo(
    () => readPositionImpactGroupDisplayLabels(selectedPositionImpactGroups),
    [selectedPositionImpactGroups]
  );
  React.useEffect(() => {
    if (selectionPanelTab !== 'position' || selectedPositionGroupingFrameGroupIds.length !== 1) {
      setPositionSelectionClickChainSnapshot(null);
    }
  }, [selectedPositionGroupingFrameGroupIds.length, selectionPanelTab]);
  const selectedPositionSelectionChainEntries = React.useMemo(() => {
    if (selectionPanelTab !== 'position' || selectedPositionGroupingFrameGroupIds.length !== 1 || !previewRef.current) {
      return [] as PositionSelectionClickChainEntry[];
    }

    const selectedFrameGroupId = selectedPositionGroupingFrameGroupIds[0] || '';
    if (!selectedFrameGroupId) {
      return [];
    }
    const currentProxyGroupId = positionGroupProxySelectionGroupIdRef.current.trim();

    if (positionSelectionClickChainSnapshot?.entries.length) {
      const matchedSelectionIndex = positionSelectionClickChainSnapshot.entries.findIndex((entry) => {
        if (entry.frameGroupId !== selectedFrameGroupId) {
          return false;
        }

        if (entry.kind === 'group') {
          return entry.groupId === currentProxyGroupId;
        }

        return currentProxyGroupId.length === 0;
      });

      if (matchedSelectionIndex >= 0) {
        return positionSelectionClickChainSnapshot.entries;
      }
    }

    const selectedFrameNode = resolveFrameSelectionAnchor(
      previewRef.current.querySelector<HTMLElement>(
        `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${selectedFrameGroupId}"]`
      )
    );
    const pageInner = selectedFrameNode?.closest<HTMLElement>('.page-inner') || null;

    if (!selectedFrameNode || !pageInner) {
      return [];
    }

    const rect = readFrameMoveRect(selectedFrameNode);
    const centerPoint = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    return resolvePositionSelectionClickChain(pageInner, selectedFrameGroupId, centerPoint).entries;
  }, [
    positionSelectionClickChainSnapshot,
    previewDomVersion,
    renderedPreviewHtml,
    resolvePositionSelectionClickChain,
    selectedPositionGroupingFrameGroupIds,
    selectionPanelTab,
  ]);
  const selectedPositionCurrentBoxGroups = React.useMemo(() => {
    const activeProxyGroupId = positionGroupProxySelectionGroupIdRef.current.trim();

    if (selectionPanelTab === 'position' && selectedPositionGroupingFrameGroupIds.length === 1) {
      const nestedChainGroups = selectedPositionSelectionChainEntries
        .filter(
          (
            entry
          ): entry is {
            kind: 'group';
            frameGroupId: string;
            groupId: string;
          } => entry.kind === 'group'
        )
        .map((entry) => positionBoxGroups.find((group) => group.id === entry.groupId) || null)
        .filter((group): group is PositionImpactGroup => Boolean(group))
        .filter((group, index, groups) => groups.findIndex((candidate) => candidate.id === group.id) === index);

      if (nestedChainGroups.length > 0) {
        return nestedChainGroups;
      }

      if (activeProxyGroupId) {
        const activeProxyGroup = positionBoxGroups.find((group) => group.id === activeProxyGroupId) || null;
        if (activeProxyGroup) {
          return [activeProxyGroup];
        }
      }

      const singleSelectedFrameGroupId = selectedPositionGroupingFrameGroupIds[0] || '';
      const directGroup = singleSelectedFrameGroupId
        ? positionBoxGroupByFrameGroupId.get(singleSelectedFrameGroupId) || null
        : null;
      return directGroup ? [directGroup] : [];
    }

    const seenGroupIds = new Set<string>();
    const currentGroups: PositionImpactGroup[] = [];

    selectedPositionGroupingFrameGroupIds.forEach((frameGroupId) => {
      const group = positionBoxGroupByFrameGroupId.get(frameGroupId);

      if (!group || seenGroupIds.has(group.id)) {
        return;
      }

      seenGroupIds.add(group.id);
      currentGroups.push(group);
    });

    return currentGroups;
  }, [
    positionBoxGroupByFrameGroupId,
    positionBoxGroups,
    selectedPositionGroupingFrameGroupIds,
    selectedPositionSelectionChainEntries,
    selectionPanelTab,
  ]);
  const selectedPositionNestedGroupInfoLines = React.useMemo(() => {
    if (selectionPanelTab !== 'position' || selectedPositionCurrentBoxGroups.length <= 0) {
      return [] as string[];
    }

    return selectedPositionCurrentBoxGroups.map(
      (group) => `${group.label || group.id} [${group.id}] · ${group.frameGroupIds.length}개`
    );
  }, [selectedPositionCurrentBoxGroups, selectionPanelTab]);
  const selectedPositionCurrentBoxGroupLabels = React.useMemo(
    () => readPositionImpactGroupDisplayLabels(selectedPositionCurrentBoxGroups),
    [selectedPositionCurrentBoxGroups]
  );
  const selectedPositionDisplayIds = React.useMemo(() => {
    if (selectionPanelTab !== 'position') {
      return selectedFrameGroupIds;
    }

    const activeProxyGroupId = positionGroupProxySelectionGroupIdRef.current.trim();
    if (activeProxyGroupId) {
      const activeGroup =
        selectedPositionCurrentBoxGroups.find((group) => group.id === activeProxyGroupId) ||
        selectedPositionResolvedBoxGroup;
      if (activeGroup && activeGroup.frameGroupIds.length > 1) {
        return [activeGroup.label || activeGroup.id];
      }
    }

    if (selectedPositionResolvedBoxGroup) {
      return [selectedPositionResolvedBoxGroup.label || selectedPositionResolvedBoxGroup.id];
    }

    return selectedFrameGroupIds;
  }, [selectedFrameGroupIds, selectedPositionCurrentBoxGroups, selectedPositionResolvedBoxGroup, selectionPanelTab]);
  const selectedExplicitPositionCurrentBoxGroups = React.useMemo(
    () => selectedPositionCurrentBoxGroups.filter((group) => !group.inferred),
    [selectedPositionCurrentBoxGroups]
  );
  const hasSelectedPositionBoxes = selectedFrameGroupIds.length > 0;
  const canClearSelectedPositionGroups = selectedExplicitPositionCurrentBoxGroups.length > 0;
  const selectedPositionInfoCount =
    selectionPanelTab === 'position' ? selectedPositionDisplayIds.length : selectedFrameGroupIds.length;
  const selectedPositionInfoTitle = hasSelectedPositionBoxes
    ? `${selectedPositionInfoCount}개의 선택된 박스 정보`
    : '템플렛 박스 정보';
  const selectedPositionModeLabel = React.useMemo(() => {
    if (selectionPanelTab !== 'position' || !previewRef.current || selectedPositionResolvedFrameGroupIds.length <= 0) {
      return primarySelectedFramePositionMode || '-';
    }

    const modeSet = new Set<string>();
    selectedPositionResolvedFrameGroupIds.forEach((frameGroupId) => {
      const frameNode = resolveFrameSelectionAnchor(
        previewRef.current?.querySelector<HTMLElement>(
          `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`
        )
      );
      const mode = readFramePositionMode(frameNode);
      if (mode) {
        modeSet.add(mode);
      }
    });

    if (modeSet.size <= 0) {
      return '-';
    }

    return modeSet.size === 1 ? Array.from(modeSet)[0] : '혼합';
  }, [primarySelectedFramePositionMode, previewDomVersion, renderedPreviewHtml, selectedPositionResolvedFrameGroupIds, selectionPanelTab]);
  const selectedPositionAnchorLabel = React.useMemo(() => {
    if (selectionPanelTab !== 'position' || !previewRef.current || selectedPositionResolvedFrameGroupIds.length <= 0) {
      return primaryRelativeAnchorLabel || '-';
    }

    const anchorLabelSet = new Set<string>();
    selectedPositionResolvedFrameGroupIds.forEach((frameGroupId) => {
      const frameNode = resolveFrameSelectionAnchor(
        previewRef.current?.querySelector<HTMLElement>(
          `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`
        )
      );
      const config = readFrameRelativeAnchorConfig(frameNode);
      const anchorLabel = readRelativeAnchorTargetLabel(config) || '-';
      anchorLabelSet.add(anchorLabel);
    });

    if (anchorLabelSet.size <= 0) {
      return '-';
    }

    return anchorLabelSet.size === 1 ? Array.from(anchorLabelSet)[0] : '혼합';
  }, [primaryRelativeAnchorLabel, previewDomVersion, renderedPreviewHtml, selectedPositionResolvedFrameGroupIds, selectionPanelTab]);
  const positionOrderLockConfirmPreviewCount = React.useMemo(() => {
    const entityKeys = new Set<string>();

    positionOrderLockFrameGroupIds.forEach((frameGroupId) => {
      const normalizedFrameGroupId = frameGroupId.trim();

      if (!normalizedFrameGroupId) {
        return;
      }

      const selectionKind = positionOrderLockSelectionKindByFrameGroupId[normalizedFrameGroupId] || 'frame';
      if (selectionKind === 'group') {
        const groupId = positionBoxGroupByFrameGroupId.get(normalizedFrameGroupId)?.id || '';
        entityKeys.add(groupId ? `group:${groupId}` : `frame:${normalizedFrameGroupId}`);
        return;
      }

      entityKeys.add(`frame:${normalizedFrameGroupId}`);
    });

    return entityKeys.size;
  }, [positionBoxGroupByFrameGroupId, positionOrderLockFrameGroupIds, positionOrderLockSelectionKindByFrameGroupId]);
  const positionOrderLockConfirmButtonLabel = React.useMemo(() => {
    if (positionOrderLockConfirmPreviewCount <= 0) {
      return '2개 이상 박스 고르기';
    }

    if (positionOrderLockConfirmPreviewCount === 1) {
      return '1개 이상 더 고르기';
    }

    return '간격 고정 확정';
  }, [positionOrderLockConfirmPreviewCount]);
  const positionOrderLockSelectionGuideText = React.useMemo(() => {
    if (positionOrderLockConfirmPreviewCount <= 0) {
      return '고정할 박스를 2개 이상 선택하세요.';
    }

    if (positionOrderLockConfirmPreviewCount === 1) {
      return '1개 이상 박스를 더 선택하세요.';
    }

    return '선택된 박스들 사이 간격을 확인/수정한 뒤 간격 고정 확정을 누르세요.';
  }, [positionOrderLockConfirmPreviewCount]);
  const positionOrderLockSelectionVisualByGroupId = React.useMemo(() => {
    const nextMap = new Map<
      string,
      {
        selectionOrder: number;
        groupId: string;
        colorName: string;
        outlineColor: string;
        fillColor: string;
        haloColor: string;
        badgeColor: string;
        badgeTextColor: string;
      }
    >();

    let nextSelectionOrder = 1;

    positionOrderLockFrameGroupIds.forEach((frameGroupId) => {
      const normalizedFrameGroupId = frameGroupId.trim();

      if (!normalizedFrameGroupId) {
        return;
      }

      const group = positionBoxGroupByFrameGroupId.get(normalizedFrameGroupId);
      const selectionKind = positionOrderLockSelectionKindByFrameGroupId[normalizedFrameGroupId] || 'frame';
      const shouldUseGroup = selectionKind === 'group' && Boolean(group) && (group?.frameGroupIds.length || 0) > 1;
      const groupId = shouldUseGroup ? group?.id || `single:${normalizedFrameGroupId}` : `single:${normalizedFrameGroupId}`;

      if (nextMap.has(groupId)) {
        return;
      }

      nextMap.set(groupId, resolvePositionOrderLockSelectionVisual(nextSelectionOrder, groupId));
      nextSelectionOrder += 1;
    });

    return nextMap;
  }, [
    positionBoxGroupByFrameGroupId,
    positionOrderLockFrameGroupIds,
    positionOrderLockSelectionKindByFrameGroupId,
    resolvePositionOrderLockSelectionVisual,
  ]);
  const resolvePositionOrderLockGroupLabel = React.useCallback(
    (groupId: string, fallbackLabel: string) => {
      const visual = positionOrderLockSelectionVisualByGroupId.get(groupId);

      if (visual) {
        return `${visual.colorName} 박스`;
      }

      const normalizedFallback = fallbackLabel.trim();
      return /^box\s*\d+/iu.test(normalizedFallback) ? normalizedFallback : '선택 박스';
    },
    [positionOrderLockSelectionVisualByGroupId]
  );
  const resolvePositionSpacingOrderedGroupMembers = React.useCallback((
    targetFrameGroupIds: string[],
    selectionKindByFrameGroupIdArg: Record<string, 'group' | 'frame'> = {}
  ) => {
    const root = previewRef.current;
    const normalizedTargetFrameGroupIds = Array.from(
      new Set(targetFrameGroupIds.map((frameGroupId) => frameGroupId.trim()).filter((frameGroupId) => Boolean(frameGroupId)))
    );

    if (!root || normalizedTargetFrameGroupIds.length <= 0) {
      return [] as PositionSpacingOrderedGroupMember[];
    }

    const positionBoxGroups = collectPositionBoxGroups(root, { includeSingletons: true });
    const groupByFrameGroupId = new Map<string, PositionImpactGroup>();
    positionBoxGroups.forEach((group) => {
      group.frameGroupIds.forEach((frameGroupId) => {
        groupByFrameGroupId.set(frameGroupId, group);
      });
    });

    const selectedGroups = (() => {
      const seenEntityKeys = new Set<string>();
      const result: Array<{
        group: PositionImpactGroup;
        selectionKind: 'group' | 'frame';
        selectionEntityId: string;
      }> = [];

      normalizedTargetFrameGroupIds.forEach((frameGroupId) => {
        const group = groupByFrameGroupId.get(frameGroupId);
        const selectionKind = selectionKindByFrameGroupIdArg[frameGroupId] || 'frame';
        const shouldUseGroup = selectionKind === 'group' && Boolean(group) && (group?.frameGroupIds.length || 0) > 1;
        const entityKey = shouldUseGroup ? `group:${group?.id || ''}` : `frame:${frameGroupId}`;

        if (seenEntityKeys.has(entityKey)) {
          return;
        }

        seenEntityKeys.add(entityKey);

        if (shouldUseGroup && group) {
          result.push({
            group,
            selectionKind: 'group',
            selectionEntityId: group.id,
          });
          return;
        }

        result.push({
          group: {
            id: `single:${frameGroupId}`,
            label: frameGroupId,
            frameGroupIds: [frameGroupId],
            inferred: true,
          },
          selectionKind: 'frame',
          selectionEntityId: frameGroupId,
        });
      });

      return result;
    })();

    const frameNodeById = new Map<string, HTMLElement>();
    collectFrameSelectionAnchors(root).forEach((node) => {
      const frameGroupId = getFrameGroupId(node);
      if (frameGroupId) {
        frameNodeById.set(frameGroupId, node);
      }
    });

    return selectedGroups
      .map((selectedEntry) => {
        const group = selectedEntry.group;
        const memberEntries = group.frameGroupIds
          .map((frameGroupId) => {
            const memberNode = frameNodeById.get(frameGroupId) || null;
            const memberPageInner = memberNode?.closest<HTMLElement>('.page-inner') || null;
            const memberRect = memberNode ? readFrameMoveRect(memberNode) : null;
            return memberNode && memberPageInner && memberRect
              ? {
                  frameGroupId,
                  node: memberNode,
                  pageInner: memberPageInner,
                  rect: memberRect,
                }
              : null;
          })
          .filter(
            (
              value
            ): value is {
              frameGroupId: string;
              node: HTMLElement;
              pageInner: HTMLElement;
              rect: FrameNodeRect;
            } => Boolean(value)
          );

        if (memberEntries.length <= 0) {
          return null;
        }

        const memberEntriesByPageInner = new Map<HTMLElement, PositionSpacingMemberFrameEntry[]>();
        memberEntries.forEach((entry) => {
          const currentEntries = memberEntriesByPageInner.get(entry.pageInner) || [];
          currentEntries.push(entry);
          memberEntriesByPageInner.set(entry.pageInner, currentEntries);
        });

        let resolvedPageInner: HTMLElement | null = null;
        let normalizedMemberEntries: PositionSpacingMemberFrameEntry[] = [];

        if (selectedEntry.selectionKind === 'group') {
          const pageBuckets = Array.from(memberEntriesByPageInner.entries())
            .map(([pageInner, entries]) => {
              const top = Math.min(...entries.map((entry) => entry.rect.top));
              return {
                pageInner,
                entries,
                count: entries.length,
                top,
              };
            })
            .sort((left, right) => {
              if (left.count !== right.count) {
                return right.count - left.count;
              }
              if (Math.abs(left.top - right.top) > 0.1) {
                return left.top - right.top;
              }
              return 0;
            });

          const primaryBucket = pageBuckets[0] || null;
          resolvedPageInner = primaryBucket?.pageInner || null;
          normalizedMemberEntries = primaryBucket?.entries || [];
        } else {
          const selectedMemberEntry = memberEntries.find(
            (entry) => entry.frameGroupId === selectedEntry.selectionEntityId
          );
          resolvedPageInner = selectedMemberEntry?.pageInner || null;
          normalizedMemberEntries = resolvedPageInner ? memberEntriesByPageInner.get(resolvedPageInner) || [] : [];
        }

        if (normalizedMemberEntries.length <= 0) {
          return null;
        }

        const minLeft = Math.min(...normalizedMemberEntries.map((entry) => entry.rect.left));
        const minTop = Math.min(...normalizedMemberEntries.map((entry) => entry.rect.top));
        const maxRight = Math.max(...normalizedMemberEntries.map((entry) => entry.rect.left + entry.rect.width));
        const maxBottom = Math.max(...normalizedMemberEntries.map((entry) => entry.rect.top + entry.rect.height));
        const groupRect = {
          left: minLeft,
          top: minTop,
          width: Math.max(1, maxRight - minLeft),
          height: Math.max(1, maxBottom - minTop),
        };
        const spacingReferenceRects =
          selectedEntry.selectionKind === 'group'
            ? [groupRect]
            : normalizedMemberEntries.map((entry) => entry.rect);

        return {
          group,
          selectionEntityId: selectedEntry.selectionEntityId,
          pageInner: resolvedPageInner || normalizedMemberEntries[0].pageInner,
          groupRect,
          memberFrameEntries: normalizedMemberEntries,
          spacingReferenceRects,
        };
      })
      .filter(
        (value): value is PositionSpacingOrderedGroupMember => Boolean(value)
      );
  }, [previewDomVersion, renderedPreviewHtml]);
  const positionSpacingAutoOrderedGroupMembers = React.useMemo(() => {
    return resolvePositionSpacingOrderedGroupMembers(
      positionOrderLockFrameGroupIds,
      positionOrderLockSelectionKindByFrameGroupId
    );
  }, [
    positionOrderLockFrameGroupIds,
    positionOrderLockSelectionKindByFrameGroupId,
    resolvePositionSpacingOrderedGroupMembers,
  ]);
  const resolvePositionSpacingPairsFromOrderedMembers = React.useCallback(
    (orderedMembers: PositionSpacingOrderedGroupMember[]): PositionSpacingResolvedPair[] => {
      if (orderedMembers.length < 2) {
        return [];
      }

      const resolveVerticalRelation = (
        anchorMember: PositionSpacingOrderedGroupMember,
        targetMember: PositionSpacingOrderedGroupMember
      ) => {
        const directionTolerance = 0.5;
        const anchorGroupTop = anchorMember.groupRect.top;
        const anchorGroupBottom = anchorMember.groupRect.top + anchorMember.groupRect.height;
        const targetGroupTop = targetMember.groupRect.top;
        const targetGroupBottom = targetMember.groupRect.top + targetMember.groupRect.height;
        const anchorIsClearlyAbove = anchorGroupBottom <= targetGroupTop - directionTolerance;
        const targetIsClearlyAbove = targetGroupBottom <= anchorGroupTop - directionTolerance;
        let bestDownwardClear:
          | {
              gap: number;
              anchorRect: FrameNodeRect;
              targetRect: FrameNodeRect;
            }
          | null = null;
        let bestUpwardClear:
          | {
              gap: number;
              anchorRect: FrameNodeRect;
              targetRect: FrameNodeRect;
            }
          | null = null;
        let bestDownwardAny:
          | {
              gap: number;
              anchorRect: FrameNodeRect;
              targetRect: FrameNodeRect;
            }
          | null = null;
        let bestUpwardAny:
          | {
              gap: number;
              anchorRect: FrameNodeRect;
              targetRect: FrameNodeRect;
            }
          | null = null;
        let bestOverlap:
          | {
              magnitude: number;
              anchorY: TemplateFrameRelativeVerticalPin;
              anchorRect: FrameNodeRect;
              targetRect: FrameNodeRect;
            }
          | null = null;

        anchorMember.spacingReferenceRects.forEach((anchorRect) => {
          targetMember.spacingReferenceRects.forEach((targetRect) => {
            const anchorRectTop = anchorRect.top;
            const anchorRectBottom = anchorRect.top + anchorRect.height;
            const targetRectTop = targetRect.top;
            const targetRectBottom = targetRect.top + targetRect.height;
            const downwardGap = targetRectTop - anchorRectBottom;
            const upwardGap = anchorRectTop - targetRectBottom;

            if (downwardGap >= -directionTolerance) {
              const normalizedGap = Math.max(0, downwardGap);
              const candidate = {
                gap: normalizedGap,
                anchorRect,
                targetRect,
              };

              if (!bestDownwardAny || normalizedGap < bestDownwardAny.gap) {
                bestDownwardAny = candidate;
              }

              if (anchorRectBottom <= targetRectTop - directionTolerance) {
                if (!bestDownwardClear || normalizedGap < bestDownwardClear.gap) {
                  bestDownwardClear = candidate;
                }
              }
            }

            if (upwardGap >= -directionTolerance) {
              const normalizedGap = Math.max(0, upwardGap);
              const candidate = {
                gap: normalizedGap,
                anchorRect,
                targetRect,
              };

              if (!bestUpwardAny || normalizedGap < bestUpwardAny.gap) {
                bestUpwardAny = candidate;
              }

              if (targetRectBottom <= anchorRectTop - directionTolerance) {
                if (!bestUpwardClear || normalizedGap < bestUpwardClear.gap) {
                  bestUpwardClear = candidate;
                }
              }
            }

            if (downwardGap < 0 && upwardGap < 0) {
              const downwardMagnitude = Math.abs(downwardGap);
              const upwardMagnitude = Math.abs(upwardGap);
              const overlapMagnitude = Math.min(downwardMagnitude, upwardMagnitude);
              const overlapAnchorY = downwardMagnitude <= upwardMagnitude ? ('bottom' as const) : ('top' as const);

              if (!bestOverlap || overlapMagnitude < bestOverlap.magnitude) {
                bestOverlap = {
                  magnitude: overlapMagnitude,
                  anchorY: overlapAnchorY,
                  anchorRect,
                  targetRect,
                };
              }
            }
          });
        });

        if (anchorIsClearlyAbove && (bestDownwardClear || bestDownwardAny)) {
          const resolved = bestDownwardClear || bestDownwardAny;

          if (resolved) {
            return {
              isClearVertical: true,
              preferredGapMagnitude: resolved.gap,
              gapY: resolved.gap,
              anchorY: 'bottom' as const,
              anchorReferenceRect: resolved.anchorRect,
              targetReferenceRect: resolved.targetRect,
            };
          }
        }

        if (targetIsClearlyAbove && (bestUpwardClear || bestUpwardAny)) {
          const resolved = bestUpwardClear || bestUpwardAny;

          if (resolved) {
            return {
              isClearVertical: true,
              preferredGapMagnitude: resolved.gap,
              gapY: resolved.gap,
              anchorY: 'top' as const,
              anchorReferenceRect: resolved.anchorRect,
              targetReferenceRect: resolved.targetRect,
            };
          }
        }

        const resolvedDownward = bestDownwardClear || bestDownwardAny;
        const resolvedUpward = bestUpwardClear || bestUpwardAny;

        if (resolvedDownward && (!resolvedUpward || resolvedDownward.gap <= resolvedUpward.gap)) {
          return {
            isClearVertical: true,
            preferredGapMagnitude: resolvedDownward.gap,
            gapY: resolvedDownward.gap,
            anchorY: 'bottom' as const,
            anchorReferenceRect: resolvedDownward.anchorRect,
            targetReferenceRect: resolvedDownward.targetRect,
          };
        }

        if (resolvedUpward) {
          return {
            isClearVertical: true,
            preferredGapMagnitude: resolvedUpward.gap,
            gapY: resolvedUpward.gap,
            anchorY: 'top' as const,
            anchorReferenceRect: resolvedUpward.anchorRect,
            targetReferenceRect: resolvedUpward.targetRect,
          };
        }

        return {
          isClearVertical: false,
          preferredGapMagnitude: bestOverlap?.magnitude || 0,
          gapY: 0,
          anchorY: bestOverlap?.anchorY || ('bottom' as const),
          anchorReferenceRect: bestOverlap?.anchorRect || anchorMember.groupRect,
          targetReferenceRect: bestOverlap?.targetRect || targetMember.groupRect,
        };
      };

      const resolveEntityKey = (member: PositionSpacingOrderedGroupMember) =>
        member.group.id.trim() || member.selectionEntityId.trim();

      const relationByIndexPair = new Map<
        string,
        {
          leftIndex: number;
          rightIndex: number;
          leftToRight: ReturnType<typeof resolveVerticalRelation>;
          rightToLeft: ReturnType<typeof resolveVerticalRelation>;
          isClearVertical: boolean;
          preferredGapMagnitude: number;
          sortKey: string;
        }
      >();

      for (let leftIndex = 0; leftIndex < orderedMembers.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < orderedMembers.length; rightIndex += 1) {
          const leftMember = orderedMembers[leftIndex];
          const rightMember = orderedMembers[rightIndex];
          const leftToRight = resolveVerticalRelation(leftMember, rightMember);
          const rightToLeft = resolveVerticalRelation(rightMember, leftMember);
          const isClearVertical = leftToRight.isClearVertical || rightToLeft.isClearVertical;
          const preferredGapMagnitude = (() => {
            if (leftToRight.isClearVertical && rightToLeft.isClearVertical) {
              return Math.min(leftToRight.preferredGapMagnitude, rightToLeft.preferredGapMagnitude);
            }

            if (leftToRight.isClearVertical) {
              return leftToRight.preferredGapMagnitude;
            }

            if (rightToLeft.isClearVertical) {
              return rightToLeft.preferredGapMagnitude;
            }

            return Math.min(leftToRight.preferredGapMagnitude, rightToLeft.preferredGapMagnitude);
          })();
          const sortKey = [resolveEntityKey(leftMember), resolveEntityKey(rightMember)].sort((a, b) => a.localeCompare(b, 'ko')).join('<->');

          relationByIndexPair.set(`${leftIndex}:${rightIndex}`, {
            leftIndex,
            rightIndex,
            leftToRight,
            rightToLeft,
            isClearVertical,
            preferredGapMagnitude,
            sortKey,
          });
        }
      }

      const sortedEdges = Array.from(relationByIndexPair.values()).sort((left, right) => {
        if (left.isClearVertical !== right.isClearVertical) {
          return left.isClearVertical ? -1 : 1;
        }

        if (Math.abs(left.preferredGapMagnitude - right.preferredGapMagnitude) > 0.1) {
          return left.preferredGapMagnitude - right.preferredGapMagnitude;
        }

        return left.sortKey.localeCompare(right.sortKey, 'ko');
      });

      const parentByIndex = new Map<number, number>();
      const findParent = (index: number): number => {
        const currentParent = parentByIndex.get(index);

        if (currentParent === undefined || currentParent === index) {
          parentByIndex.set(index, index);
          return index;
        }

        const rootParent = findParent(currentParent);
        parentByIndex.set(index, rootParent);
        return rootParent;
      };
      const unionParent = (leftIndex: number, rightIndex: number) => {
        const leftRoot = findParent(leftIndex);
        const rightRoot = findParent(rightIndex);

        if (leftRoot === rightRoot) {
          return false;
        }

        if (leftRoot < rightRoot) {
          parentByIndex.set(rightRoot, leftRoot);
        } else {
          parentByIndex.set(leftRoot, rightRoot);
        }

        return true;
      };

      const selectedEdges = sortedEdges.filter((edge) => unionParent(edge.leftIndex, edge.rightIndex));
      const pairs: PositionSpacingResolvedPair[] = [];

      selectedEdges.forEach((edge) => {
        const leftMember = orderedMembers[edge.leftIndex];
        const rightMember = orderedMembers[edge.rightIndex];
        const preferLeftToRight =
          edge.leftToRight.isClearVertical !== edge.rightToLeft.isClearVertical
            ? edge.leftToRight.isClearVertical
            : edge.leftToRight.preferredGapMagnitude <= edge.rightToLeft.preferredGapMagnitude + 0.1;
        const anchorMember = preferLeftToRight ? leftMember : rightMember;
        const targetMember = preferLeftToRight ? rightMember : leftMember;
        const directedRelation = preferLeftToRight ? edge.leftToRight : edge.rightToLeft;
        const pairKey = [resolveEntityKey(leftMember), resolveEntityKey(rightMember)].sort((a, b) => a.localeCompare(b, 'ko')).join('<->');

        pairs.push({
          pairKey,
          anchorMember,
          targetMember,
          anchorY: directedRelation.anchorY,
          anchorReferenceRect: directedRelation.anchorReferenceRect,
          targetReferenceRect: directedRelation.targetReferenceRect,
          defaultGapY: directedRelation.gapY,
        });
      });

      return pairs;
    },
    []
  );
  const positionSpacingResolvedPairs = React.useMemo(
    () => resolvePositionSpacingPairsFromOrderedMembers(positionSpacingAutoOrderedGroupMembers),
    [positionSpacingAutoOrderedGroupMembers, resolvePositionSpacingPairsFromOrderedMembers]
  );
  const positionSpacingPairSummaries = React.useMemo(
    () =>
      positionSpacingResolvedPairs.map((pair) => {
        const anchorMember = pair.anchorMember;
        const targetMember = pair.targetMember;
        const anchorLabel = resolvePositionOrderLockGroupLabel(anchorMember.group.id, anchorMember.group.label);
        const targetLabel = resolvePositionOrderLockGroupLabel(targetMember.group.id, targetMember.group.label);

        return {
          pairKey: pair.pairKey,
          anchorLabel,
          targetLabel,
          anchorGroupId: anchorMember.group.id,
          targetGroupId: targetMember.group.id,
          targetSelectionEntityId: targetMember.selectionEntityId,
          defaultGapY: pair.defaultGapY,
        };
      }),
    [positionSpacingResolvedPairs, resolvePositionOrderLockGroupLabel]
  );
  const positionSpacingGuideRelations = React.useMemo(() => {
    if (!positionOrderLockSelectionMode) {
      return [] as PositionSpacingGuideRelation[];
    }

    return positionSpacingResolvedPairs.map((pair) => {
      const anchorMember = pair.anchorMember;
      const targetMember = pair.targetMember;
      const anchorLabel = resolvePositionOrderLockGroupLabel(anchorMember.group.id, anchorMember.group.label);
      const targetLabel = resolvePositionOrderLockGroupLabel(targetMember.group.id, targetMember.group.label);
      const draftGap = Number.parseFloat(positionSpacingDraftByPairKey[pair.pairKey]?.gapY || '');
      const resolvedGapY = Number.isFinite(draftGap) ? Math.max(0, draftGap) : Math.max(0, pair.defaultGapY);

      return {
        pairKey: pair.pairKey,
        anchorLabel,
        targetLabel,
        anchorFrameGroupIds: anchorMember.memberFrameEntries.map((entry) => entry.frameGroupId),
        targetFrameGroupIds: targetMember.memberFrameEntries.map((entry) => entry.frameGroupId),
        anchorY: pair.anchorY,
        anchorReferenceRect: pair.anchorReferenceRect,
        targetReferenceRect: pair.targetReferenceRect,
        gapYPx: resolvedGapY,
      };
    });
  }, [
    positionOrderLockSelectionMode,
    positionSpacingResolvedPairs,
    positionSpacingDraftByPairKey,
    resolvePositionOrderLockGroupLabel,
  ]);
  React.useEffect(() => {
    if (positionSpacingPairSummaries.length <= 0) {
      setPositionSpacingDraftByPairKey((previous) =>
        Object.keys(previous).length > 0 ? {} : previous
      );
      return;
    }

    setPositionSpacingDraftByPairKey((previous) => {
      const next: Record<string, { gapY: string }> = {};

      positionSpacingPairSummaries.forEach((pair) => {
        const previousValue = previous[pair.pairKey];
        next[pair.pairKey] = previousValue || {
          gapY: String(Math.round(pair.defaultGapY)),
        };
      });

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      const hasSameKeys =
        previousKeys.length === nextKeys.length &&
        previousKeys.every((key) => nextKeys.includes(key));
      const hasSameValues = hasSameKeys
        ? previousKeys.every(
            (key) =>
              previous[key]?.gapY === next[key]?.gapY
          )
        : false;

      return hasSameValues ? previous : next;
    });
  }, [positionSpacingPairSummaries]);
  const previewRelativeGuideFrameGroupId = React.useMemo(() => {
    if (selectionPanelTab === 'position') {
      if (selectedPositionTargetFrameGroupId) {
        return selectedPositionTargetFrameGroupId;
      }
      if (selectedPositionResolvedBoxGroup) {
        return null;
      }
      return primarySelectedFrameGroupId;
    }

    return primarySelectedFrameGroupId;
  }, [primarySelectedFrameGroupId, selectedPositionResolvedBoxGroup, selectedPositionTargetFrameGroupId, selectionPanelTab]);

  React.useEffect(() => {
    if (selectionPanelTab === 'position') {
      return;
    }

    setPositionOrderLockSelectionMode(false);
    setPositionOrderLockFrameGroupIds([]);
    setPositionOrderLockSelectionKindByFrameGroupId({});
    setPositionOrderLockCandidateFrameGroupId('');
    setPositionOrderLockCandidateGroupId('');
    setPositionOrderLockCandidateSelectionStage('');
    positionGroupProxySelectionShowAllGroupsRef.current = false;
    positionGroupProxySelectionsOverrideRef.current = null;
  }, [selectionPanelTab]);

  const virtualDefinitionIds = React.useMemo(
    () => new Set(virtualFrameDefinitions.map((definition) => definition.id)),
    [virtualFrameDefinitions]
  );
  const currentValueBoxFrameGroupIds = React.useMemo(() => {
    if (!primarySelectedFrameGroupId || !previewRef.current) {
      return [];
    }

    return getFrameNodes(previewRef.current)
      .filter((node) => readFrameParentGroupId(node) === primarySelectedFrameGroupId && readFrameRole(node) === 'value')
      .map((node) => getFrameGroupId(node))
      .filter(Boolean);
  }, [getFrameNodes, primarySelectedFrameGroupId, renderedPreviewHtml]);
  const shownValueBoxFrameGroupIds = React.useMemo(() => {
    if (
      metadataRelationSelectionMode.kind === 'value' &&
      metadataRelationSelectionMode.sourceKeyFrameGroupId === primarySelectedFrameGroupId
    ) {
      return metadataRelationSelectionMode.targetFrameGroupIds;
    }

    return currentValueBoxFrameGroupIds;
  }, [currentValueBoxFrameGroupIds, metadataRelationSelectionMode, primarySelectedFrameGroupId]);
  const valueBoxPickerOptions = React.useMemo(() => {
    if (!previewRef.current) {
      return [];
    }

    return shownValueBoxFrameGroupIds
      .map((frameGroupId) => {
        const node = resolveFrameSelectionAnchor(
          previewRef.current?.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
        );
        const label = readFrameDisplayText(node) || frameGroupId;
        return { id: frameGroupId, label, meta: frameGroupId };
      })
      .filter((option) => Boolean(option.id));
  }, [renderedPreviewHtml, shownValueBoxFrameGroupIds]);
  const valueBoxPickerCurrentValue = React.useMemo(() => {
    if (!canEditValueBoxField || shownValueBoxFrameGroupIds.length === 0) {
      return '';
    }

    return shownValueBoxFrameGroupIds[0] || '';
  }, [canEditValueBoxField, shownValueBoxFrameGroupIds]);
  const valueBoxPickerSummary = React.useMemo(() => {
    if (!shownValueBoxFrameGroupIds.length) {
      return '-';
    }

    if (!previewRef.current) {
      return shownValueBoxFrameGroupIds.join(', ');
    }

    return shownValueBoxFrameGroupIds
      .map((frameGroupId) => {
        const node = resolveFrameSelectionAnchor(
          previewRef.current?.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
        );
        const text = readFrameDisplayText(node);
        return text ? `${frameGroupId} | ${text}` : frameGroupId;
      })
      .join(', ');
  }, [renderedPreviewHtml, shownValueBoxFrameGroupIds]);
  const frameRelationPreviewMode = React.useMemo<FrameRelationPreviewMode>(() => {
    if (selectionPanelTab !== 'metadata') {
      return { kind: 'idle' };
    }

    if (metadataRelationSelectionMode.kind === 'parent') {
      return {
        kind: 'parent-select',
        sourceFrameGroupIds: metadataRelationSelectionMode.sourceFrameGroupIds,
      };
    }

    if (metadataRelationSelectionMode.kind === 'value') {
      return {
        kind: 'value-select',
        sourceKeyFrameGroupId: metadataRelationSelectionMode.sourceKeyFrameGroupId,
        targetFrameGroupIds: metadataRelationSelectionMode.targetFrameGroupIds,
      };
    }

    const linkedKeyFrameGroupId = frameMetadataDraft.parentGroupId.trim();

    if (linkedKeyFrameGroupId && selectedFrameGroupIds.length > 0) {
      return {
        kind: 'parent-linked',
        sourceFrameGroupIds: selectedFrameGroupIds,
        keyFrameGroupId: linkedKeyFrameGroupId,
      };
    }

    if (primarySelectedFrameGroupId && shownValueBoxFrameGroupIds.length > 0) {
      return {
        kind: 'value-linked',
        sourceKeyFrameGroupId: primarySelectedFrameGroupId,
        targetFrameGroupIds: shownValueBoxFrameGroupIds,
      };
    }

    return { kind: 'idle' };
  }, [
    frameMetadataDraft.parentGroupId,
    metadataRelationSelectionMode,
    primarySelectedFrameGroupId,
    selectedFrameGroupIds,
    selectionPanelTab,
    shownValueBoxFrameGroupIds,
  ]);
  React.useEffect(() => {
    frameRelationPreviewModeRef.current = frameRelationPreviewMode;
  }, [frameRelationPreviewMode]);

  const previewHasStableFrameLayout = React.useCallback((root: ParentNode) => {
    const frameNodes = Array.from(root.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR));

    if (!frameNodes.length) {
      return false;
    }

    const rawBandTables = Array.from(root.querySelectorAll<HTMLTableElement>('.v102-frame-band table')).filter(
      (table) =>
        table.rows.length > 1 && table.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR).length > 1
    );

    if (rawBandTables.length === 0) {
      return frameNodes.some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > MIN_FRAME_SIZE_PX + 0.5 || rect.height > MIN_FRAME_SIZE_PX + 0.5;
      });
    }

    return rawBandTables.every((table) => {
      const tableRect = table.getBoundingClientRect();

      if (tableRect.width <= MIN_FRAME_SIZE_PX * 2 || tableRect.height <= MIN_FRAME_SIZE_PX * 2) {
        return false;
      }

      const sizableFrameNodes = Array.from(table.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR)).filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > MIN_FRAME_SIZE_PX + 0.5 || rect.height > MIN_FRAME_SIZE_PX + 0.5;
      });

      return sizableFrameNodes.length >= 2;
    });
  }, []);

  const cancelScheduledPreviewEditorState = React.useCallback(() => {
    if (typeof window === 'undefined' || previewEditorStateFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(previewEditorStateFrameRef.current);
    previewEditorStateFrameRef.current = null;
  }, []);

  const hasActivePointerInteraction = React.useCallback(
    () =>
      Boolean(
        dragStateRef.current ||
          resizeStateRef.current ||
          edgePressStateRef.current ||
          marqueeSelectionStateRef.current ||
          createBoxStateRef.current
      ),
    []
  );

  const lockPreviewEditorStateDuringInteraction = React.useCallback(() => {
    if (previewEditorStateFrameRef.current !== null) {
      deferredPreviewEditorStateRef.current = true;
    }

    cancelScheduledPreviewEditorState();
  }, [cancelScheduledPreviewEditorState]);

  const safeHasPointerCapture = React.useCallback((owner: Element | null | undefined, pointerId: number) => {
    if (!owner || typeof pointerId !== 'number') {
      return false;
    }

    try {
      return owner.hasPointerCapture(pointerId);
    } catch {
      return false;
    }
  }, []);

  const safeSetPointerCapture = React.useCallback((owner: Element | null | undefined, pointerId: number) => {
    if (!owner || typeof pointerId !== 'number') {
      return false;
    }

    try {
      owner.setPointerCapture(pointerId);
      return true;
    } catch {
      return false;
    }
  }, []);

  const safeReleasePointerCapture = React.useCallback((owner: Element | null | undefined, pointerId: number) => {
    if (!owner || typeof pointerId !== 'number') {
      return false;
    }

    try {
      if (owner.hasPointerCapture(pointerId)) {
        owner.releasePointerCapture(pointerId);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const buildLiveEdgeTopologySnapshot = React.useCallback((root: HTMLElement): TemplateEdgeTopologySnapshotDto => {
    const pages = Array.from(root.querySelectorAll<HTMLElement>('section.page'));
    const frames: TemplateEdgeFrameDto[] = getFrameNodes(root).map((node) => {
      const pageElement = node.closest<HTMLElement>('section.page');
      const pageIndex = Math.max(0, pages.indexOf(pageElement || pages[0] || node));

      return {
        frameGroupId: getFrameGroupId(node),
        pageId: `page-${pageIndex + 1}`,
        rect: readFrameNodeRect(node),
      };
    });

    return TemplateEdgeTopologyService.createSnapshot({
      frames,
      tolerancePx: FRAME_RESIZE_TOLERANCE_PX,
    });
  }, [getFrameNodes]);

  const normalizeLiveVerticalCohorts = React.useCallback(
    (
      root: HTMLElement,
      options?: {
        edgeIds?: string[];
        preferredEdgeRoleById?: TemplateEdgeRoleMapDto;
      }
    ) => {
      const restrictedEdgeIds = options?.edgeIds?.length ? new Set(options.edgeIds) : null;

      for (let pass = 0; pass < 6; pass += 1) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        let corrected = false;
        const verticalEdgeGroups = new Map<string, TemplateEdgeDescriptorDto[]>();

        snapshot.edges
          .filter((edge) => edge.orientation === 'vertical' && (edge.side === 'left' || edge.side === 'right'))
          .forEach((edge) => {
            const groupKey = `${edge.pageId}:${edge.side}`;
            const current = verticalEdgeGroups.get(groupKey);

            if (current) {
              current.push(edge);
              return;
            }

            verticalEdgeGroups.set(groupKey, [edge]);
          });

        verticalEdgeGroups.forEach((groupEdges) => {
          clusterItemsByCoordinate(groupEdges, (edge) => edge.lineCoordinate, FRAME_RESIZE_TOLERANCE_PX)
            .filter((clusterEdges) => clusterEdges.length > 1)
            .filter((clusterEdges) => !restrictedEdgeIds || clusterEdges.some((edge) => restrictedEdgeIds.has(edge.edgeId)))
            .forEach((clusterEdges) => {
              const coordinates = clusterEdges.map((edge) => edge.lineCoordinate).sort((left, right) => left - right);
              const spread = coordinates[coordinates.length - 1] - coordinates[0];

              if (spread <= 0.01 || spread > FRAME_RESIZE_TOLERANCE_PX) {
                return;
              }

              const preferredEdgeId =
                clusterEdges.find((edge) => options?.preferredEdgeRoleById?.[edge.edgeId] === 'selected_edge_clicked')
                  ?.edgeId || null;
              const preferredLineCoordinate = preferredEdgeId
                ? TemplateEdgeTopologyService.getEdgeById(snapshot, preferredEdgeId)?.lineCoordinate
                : null;
              const targetLineCoordinate =
                typeof preferredLineCoordinate === 'number'
                  ? preferredLineCoordinate
                  : coordinates[Math.floor(coordinates.length / 2)];

              clusterEdges.forEach((edge) => {
                if (Math.abs(targetLineCoordinate - edge.lineCoordinate) <= 0.01) {
                  return;
                }

                const node =
                  getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === edge.frameGroupId) || null;

                if (!node) {
                  return;
                }

                if (edge.side !== 'left' && edge.side !== 'right') {
                  return;
                }

                const widthInstruction = buildSelfWidthResizeInstruction(buildFrameResizeContext(node), edge.side);

                if (!widthInstruction) {
                  return;
                }

                applyFrameResizeWidthDelta(node, targetLineCoordinate - edge.lineCoordinate, [widthInstruction]);
                corrected = true;
              });
            });
        });

        if (!corrected) {
          break;
        }
      }
    },
    [buildLiveEdgeTopologySnapshot, getFrameNodes]
  );

  const normalizeLiveVerticalPhysicalPeers = React.useCallback(
    (
      root: HTMLElement,
      options?: {
        edgeIds?: string[];
        preferredEdgeRoleById?: TemplateEdgeRoleMapDto;
      }
    ) => {
      const restrictedEdgeIds = options?.edgeIds?.length ? new Set(options.edgeIds) : null;
      const peerTolerancePx = Math.max(FRAME_RESIZE_TOLERANCE_PX, 6);

      for (let pass = 0; pass < 6; pass += 1) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        const verticalEdges = snapshot.edges.filter(
          (edge) => edge.orientation === 'vertical' && (edge.side === 'left' || edge.side === 'right')
        );
        const adjacencyMap = new Map<string, Set<string>>();

        verticalEdges.forEach((edge) => {
          adjacencyMap.set(edge.edgeId, new Set());
        });

        for (let leftIndex = 0; leftIndex < verticalEdges.length; leftIndex += 1) {
          const leftEdge = verticalEdges[leftIndex];

          for (let rightIndex = leftIndex + 1; rightIndex < verticalEdges.length; rightIndex += 1) {
            const rightEdge = verticalEdges[rightIndex];

            if (!edgesSharePhysicalBoundaryWithinTolerance(leftEdge, rightEdge, peerTolerancePx)) {
              continue;
            }

            adjacencyMap.get(leftEdge.edgeId)?.add(rightEdge.edgeId);
            adjacencyMap.get(rightEdge.edgeId)?.add(leftEdge.edgeId);
          }
        }

        let corrected = false;
        const visited = new Set<string>();

        verticalEdges.forEach((edge) => {
          if (visited.has(edge.edgeId)) {
            return;
          }

          const componentEdgeIds: string[] = [];
          const queue = [edge.edgeId];

          while (queue.length > 0) {
            const currentEdgeId = queue.shift();

            if (!currentEdgeId || visited.has(currentEdgeId)) {
              continue;
            }

            visited.add(currentEdgeId);
            componentEdgeIds.push(currentEdgeId);
            adjacencyMap.get(currentEdgeId)?.forEach((candidateEdgeId) => {
              if (!visited.has(candidateEdgeId)) {
                queue.push(candidateEdgeId);
              }
            });
          }

          if (componentEdgeIds.length <= 1) {
            return;
          }

          if (restrictedEdgeIds && !componentEdgeIds.some((edgeId) => restrictedEdgeIds.has(edgeId))) {
            return;
          }

          const componentEdges = componentEdgeIds
            .map((edgeId) => TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId))
            .filter((candidate): candidate is TemplateEdgeDescriptorDto => Boolean(candidate));

          const coordinates = componentEdges.map((componentEdge) => componentEdge.lineCoordinate).sort((left, right) => left - right);
          const spread = coordinates[coordinates.length - 1] - coordinates[0];

          if (spread <= 0.01) {
            return;
          }

          const preferredEdgeId =
            componentEdges.find((componentEdge) => options?.preferredEdgeRoleById?.[componentEdge.edgeId] === 'selected_edge_clicked')
              ?.edgeId ||
            componentEdges.find((componentEdge) => options?.preferredEdgeRoleById?.[componentEdge.edgeId] === 'selected_edge_auto_multi')
              ?.edgeId ||
            null;
          const preferredLiveCoordinate = preferredEdgeId
            ? TemplateEdgeTopologyService.getEdgeById(snapshot, preferredEdgeId)?.lineCoordinate
            : null;
          const targetLineCoordinate =
            typeof preferredLiveCoordinate === 'number'
              ? preferredLiveCoordinate
              : coordinates.reduce((sum, coordinate) => sum + coordinate, 0) / coordinates.length;

          componentEdges.forEach((componentEdge) => {
            const node =
              getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === componentEdge.frameGroupId) || null;

            if (!node) {
              return;
            }

            if (componentEdge.side !== 'left' && componentEdge.side !== 'right') {
              return;
            }

            const widthInstruction = buildSelfWidthResizeInstruction(buildFrameResizeContext(node), componentEdge.side);

            if (!widthInstruction) {
              return;
            }

            const liveEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, componentEdge.edgeId);

            if (!liveEdge) {
              return;
            }

            const correctionDelta = targetLineCoordinate - liveEdge.lineCoordinate;

            if (Math.abs(correctionDelta) <= 0.01) {
              return;
            }

            applyFrameResizeWidthDelta(node, correctionDelta, [widthInstruction]);
            corrected = true;
          });
        });

        if (!corrected) {
          break;
        }
      }
    },
    [buildLiveEdgeTopologySnapshot, getFrameNodes]
  );

  const normalizeLiveVerticalPhysicalPeersToDragDirection = React.useCallback(
    (root: HTMLElement, resizeState: ResizeState) => {
      if (!resizeState.edgeResizeTargets?.length || Math.abs(resizeState.appliedEdgeDeltaX || 0) < 0.5) {
        return;
      }

      const restrictedEdgeIds = new Set(
        (
          Object.keys(resizeState.edgeRoleById || {}).length > 0
            ? Object.keys(resizeState.edgeRoleById || {})
            : resizeState.mutationEdgeIds || []
        ).filter(Boolean)
      );

      if (restrictedEdgeIds.size === 0) {
        return;
      }

      const peerTolerancePx = Math.max(FRAME_RESIZE_TOLERANCE_PX, 6);

      for (let pass = 0; pass < 4; pass += 1) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        const verticalEdges = snapshot.edges.filter(
          (edge) => edge.orientation === 'vertical' && (edge.side === 'left' || edge.side === 'right')
        );
        const adjacencyMap = new Map<string, Set<string>>();

        verticalEdges.forEach((edge) => {
          adjacencyMap.set(edge.edgeId, new Set());
        });

        for (let leftIndex = 0; leftIndex < verticalEdges.length; leftIndex += 1) {
          const leftEdge = verticalEdges[leftIndex];

          for (let rightIndex = leftIndex + 1; rightIndex < verticalEdges.length; rightIndex += 1) {
            const rightEdge = verticalEdges[rightIndex];

            if (!edgesSharePhysicalBoundaryWithinTolerance(leftEdge, rightEdge, peerTolerancePx)) {
              continue;
            }

            adjacencyMap.get(leftEdge.edgeId)?.add(rightEdge.edgeId);
            adjacencyMap.get(rightEdge.edgeId)?.add(leftEdge.edgeId);
          }
        }

        let corrected = false;
        const visited = new Set<string>();

        verticalEdges.forEach((edge) => {
          if (visited.has(edge.edgeId)) {
            return;
          }

          const componentEdgeIds: string[] = [];
          const queue = [edge.edgeId];

          while (queue.length > 0) {
            const currentEdgeId = queue.shift();

            if (!currentEdgeId || visited.has(currentEdgeId)) {
              continue;
            }

            visited.add(currentEdgeId);
            componentEdgeIds.push(currentEdgeId);
            adjacencyMap.get(currentEdgeId)?.forEach((candidateEdgeId) => {
              if (!visited.has(candidateEdgeId)) {
                queue.push(candidateEdgeId);
              }
            });
          }

          if (componentEdgeIds.length <= 1 || !componentEdgeIds.some((edgeId) => restrictedEdgeIds.has(edgeId))) {
            return;
          }

          const componentEdges = componentEdgeIds
            .map((edgeId) => TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId))
            .filter((candidate): candidate is TemplateEdgeDescriptorDto => Boolean(candidate));

          if (componentEdges.length <= 1) {
            return;
          }

          const coordinates = componentEdges.map((componentEdge) => componentEdge.lineCoordinate);
          const targetLineCoordinate =
            (resizeState.appliedEdgeDeltaX || 0) >= 0
              ? Math.max(...coordinates)
              : Math.min(...coordinates);

          componentEdges.forEach((componentEdge) => {
            const node =
              getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === componentEdge.frameGroupId) || null;

            if (!node) {
              return;
            }

            const widthInstruction = buildSelfWidthResizeInstruction(buildFrameResizeContext(node), componentEdge.side);

            if (!widthInstruction) {
              return;
            }

            const liveEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, componentEdge.edgeId);

            if (!liveEdge) {
              return;
            }

            const correctionDelta = targetLineCoordinate - liveEdge.lineCoordinate;

            if (Math.abs(correctionDelta) <= 0.01) {
              return;
            }

            applyFrameResizeWidthDelta(node, correctionDelta, [widthInstruction]);
            corrected = true;
          });
        });

        if (!corrected) {
          break;
        }
      }
    },
    [buildLiveEdgeTopologySnapshot, getFrameNodes]
  );

  const reconcileLiveEdgeSelection = React.useCallback(
    (root?: HTMLElement | null, state?: TemplateEdgeSelectionStateDto) => {
      const resolvedRoot = root || previewRef.current;

      if (!resolvedRoot) {
        return TemplateEdgeSelectionService.createEmptyState();
      }

      return TemplateEdgeSelectionService.reconcileSelectionState({
        snapshot: buildLiveEdgeTopologySnapshot(resolvedRoot),
        currentSelection: state || edgeSelectionStateRef.current,
      });
    },
    [buildLiveEdgeTopologySnapshot]
  );

  const resolveEdgeRolePresentation = React.useCallback(
    (
      snapshot: TemplateEdgeTopologySnapshotDto,
      selectionState: TemplateEdgeSelectionStateDto,
      mismatchEdgeIds: string[] = []
    ) => {
      const roleSummary = TemplateEdgeResizeIntentService.describeSelectionRoles(
        snapshot,
        selectionState,
        selectionState.tokens[0]?.anchorEdgeId
      );
      return {
        edgeRoleById: roleSummary.edgeRoleById,
        diagnosticsState: {
          selectedEdgeClickedIds: roleSummary.selectedEdgeClickedIds,
          selectedEdgeAutoMultiIds: roleSummary.selectedEdgeAutoMultiIds,
          peerEdgeIds: roleSummary.peerEdgeIds,
          mismatchEdgeIds,
        },
      };
    },
    []
  );

  const collectPassiveShiftedHorizontalEdgeIds = React.useCallback(
    (
      pageInner: HTMLElement,
      node: HTMLElement,
      direction: TemplateFrameResizeDirection,
      snapshot: TemplateEdgeTopologySnapshotDto
    ) => {
      if (!direction.includes('s')) {
        return [];
      }

      const context = buildFrameResizeContext(node);
      const resizesOuterBottom = context.singleCellBand || context.rowHeights.length <= context.endRowIndex;

      if (!resizesOuterBottom) {
        return [];
      }

      const boundaryY = context.cellRect.top + context.cellRect.height;
      const shiftedFrameGroupIdSet = new Set(
        getFrameNodes(pageInner)
          .filter((candidate) => candidate !== node)
          .filter((candidate) => resolveFrameLayoutShell(candidate) !== context.shell)
          .filter((candidate) => {
            const candidateShell = resolveFrameLayoutShell(candidate);
            const shellRect = readFrameElementRect(candidateShell, pageInner);
            return shellRect.top >= boundaryY - FRAME_RESIZE_TOLERANCE_PX;
          })
          .map((candidate) => getFrameGroupId(candidate))
          .filter((frameGroupId) => Boolean(frameGroupId))
      );

      return snapshot.edges
        .filter(
          (edge) => edge.orientation === 'horizontal' && shiftedFrameGroupIdSet.has(edge.frameGroupId)
        )
        .map((edge) => edge.edgeId);
    },
    [getFrameNodes]
  );

  const detectEdgeRoleMovementMismatches = React.useCallback(
    (root: HTMLElement | null, resizeState: ResizeState | null) => {
      if (!root || !resizeState?.mutationEdgeIds?.length || !resizeState.edgeResizeTargets?.length) {
        return [];
      }

      const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
      const orientation = resizeState.edgeResizeTargets[0]?.orientation;
      const roleEdgeIds = Object.keys(resizeState.edgeRoleById || {});
      const expectedEdgeIds = roleEdgeIds.length > 0 ? roleEdgeIds : resizeState.mutationEdgeIds;
      const expectedEdgeIdSet = new Set(expectedEdgeIds);
      const passiveShiftedEdgeIdSet = new Set(resizeState.passiveShiftedEdgeIds || []);
      const referenceEdgeId =
        expectedEdgeIds.find((edgeId) => resizeState.edgeRoleById?.[edgeId] === 'selected_edge_clicked') ||
        expectedEdgeIds[0] ||
        null;
      const referenceBaseline = referenceEdgeId ? resizeState.edgeLineCoordinateBaseline?.[referenceEdgeId] : Number.NaN;
      const referenceLiveEdge = referenceEdgeId ? TemplateEdgeTopologyService.getEdgeById(liveSnapshot, referenceEdgeId) : null;
      const expectedDelta =
        Number.isFinite(referenceBaseline) && referenceLiveEdge
          ? referenceLiveEdge.lineCoordinate - referenceBaseline
          : orientation === 'vertical'
            ? resizeState.appliedEdgeDeltaX || 0
            : resizeState.appliedEdgeDeltaY || 0;
      const expectedMismatchIds = expectedEdgeIds.filter((edgeId) => {
        const baselineLineCoordinate = resizeState.edgeLineCoordinateBaseline?.[edgeId];
        const edge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId);
        const appliedMovementPresent = Math.abs(expectedDelta) > FRAME_RESIZE_TOLERANCE_PX;

        if (!Number.isFinite(baselineLineCoordinate) || !edge) {
          return true;
        }

        if (!resizeState.edgeRoleById?.[edgeId] && appliedMovementPresent) {
          return true;
        }

        return Math.abs(edge.lineCoordinate - baselineLineCoordinate - expectedDelta) > FRAME_RESIZE_TOLERANCE_PX;
      });
      const unexpectedMovedEdgeIds = liveSnapshot.edges
        .filter((edge) => edge.orientation === orientation && !expectedEdgeIdSet.has(edge.edgeId))
        .filter((edge) => {
          const baselineLineCoordinate = resizeState.edgeLineCoordinateBaseline?.[edge.edgeId];
          const appliedDelta = edge.lineCoordinate - (baselineLineCoordinate || 0);

          if (!Number.isFinite(baselineLineCoordinate)) {
            return false;
          }

          if (Math.abs(appliedDelta) <= FRAME_RESIZE_TOLERANCE_PX) {
            return false;
          }

          if (passiveShiftedEdgeIdSet.has(edge.edgeId)) {
            return Math.abs(appliedDelta - expectedDelta) > FRAME_RESIZE_TOLERANCE_PX;
          }

          return true;
        })
        .map((edge) => edge.edgeId);

      return Array.from(new Set([...expectedMismatchIds, ...unexpectedMovedEdgeIds]));
    },
    [buildLiveEdgeTopologySnapshot]
  );

  const schedulePreviewEditorState = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (hasActivePointerInteraction()) {
      deferredPreviewEditorStateRef.current = true;
      return;
    }

    cancelScheduledPreviewEditorState();
    previewEditorStateFrameRef.current = window.requestAnimationFrame(() => {
      previewEditorStateFrameRef.current = null;

      if (hasActivePointerInteraction()) {
        deferredPreviewEditorStateRef.current = true;
        return;
      }

      const root = previewRef.current;

      if (!root) {
        return;
      }

      const hasPendingRawBands =
        Boolean(root.querySelector('.v102-frame-band')) &&
        !root.querySelector(`.v102-frame-band[${NORMALIZED_FRAME_BAND_ATTR}="true"]`);

      if (hasPendingRawBands && !previewHasStableFrameLayout(root)) {
        if (previewEditorStateRetryCountRef.current < 8) {
          previewEditorStateRetryCountRef.current += 1;
          schedulePreviewEditorState();
        }
        return;
      }

      previewEditorStateRetryCountRef.current = 0;
      const normalized = ensurePreviewFrameBandNormalization(root);
      syncPreviewSurfaceCloneAttrs(root);
      syncPreviewSurfaceSelectionPanelTabAttr(root, selectionPanelTab);
      applyPreviewEditPermissions(root);
      applyFrameCanvasVisualHints(root);
      ensureRelativeAnchorConfigs(root);
      applyRelativeAnchoredFrameRectsInRoot(root);
      syncPreviewSurfaceScale(root);
      const nextRenderHtml = normalized ? extractPreviewRenderHtml(root) : '';

      if (nextRenderHtml && nextRenderHtml !== renderedPreviewHtml) {
        setPreviewHtml(nextRenderHtml);
      }

      const snapshot = buildLiveEdgeTopologySnapshot(root);
      const nextEdgeSelection = TemplateEdgeSelectionService.reconcileSelectionState({
        snapshot,
        currentSelection: edgeSelectionStateRef.current,
      });
      const edgeSelectionChanged = !edgeSelectionStatesEqual(nextEdgeSelection, edgeSelectionStateRef.current);

      edgeSelectionStateRef.current = nextEdgeSelection;
      const nextEdgeRolePresentation = resolveEdgeRolePresentation(
        snapshot,
        nextEdgeSelection,
        edgeRoleDiagnostics.mismatchEdgeIds
      );
      applyFrameSelectionUi(
        root,
        selectedFrameGroupIdsRef.current,
        nextEdgeSelection,
        snapshot,
        nextEdgeRolePresentation.edgeRoleById,
        nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds,
        previewRelativeGuideFrameGroupId,
        resolvePositionGroupProxySelections(
          selectedFrameGroupIdsRef.current,
          positionGroupProxySelectionGroupIdRef.current
        )
      );
      applyFrameRelationSelectionUi(root, frameRelationPreviewModeRef.current, selectedFrameGroupIdsRef.current);
      applyPositionImpactGroupSelectionUi(root, selectionPanelTab, selectedFrameGroupIdsRef.current, positionRelationAnchorFrameGroupId);
      applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
      applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );

      if (edgeSelectionChanged) {
        setEdgeSelectionState(nextEdgeSelection);
      }

      requestPreviewTextFit();
    });
  }, [
    buildLiveEdgeTopologySnapshot,
    cancelScheduledPreviewEditorState,
    edgeRoleDiagnostics.mismatchEdgeIds,
    hasActivePointerInteraction,
    previewRelativeGuideFrameGroupId,
    previewHasStableFrameLayout,
    renderedPreviewHtml,
    resolveEdgeRolePresentation,
    requestPreviewTextFit,
    resolvePositionGroupProxySelections,
    selectionPanelTab,
    positionRelationAnchorFrameGroupId,
    focusedDefinedPositionRelativeRelations,
    positionSpacingGuideRelations,
    syncPreviewSurfaceScale,
  ]);

  const setPreviewNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      previewRef.current = node;

      if (node && renderedPreviewHtml) {
        syncPreviewSurfaceCloneAttrs(node);
        syncPreviewSurfaceSelectionPanelTabAttr(node, selectionPanelTab);
        syncPreviewSurfaceScale(node);
        schedulePreviewEditorState();
      }
    },
    [renderedPreviewHtml, schedulePreviewEditorState, selectionPanelTab, syncPreviewSurfaceScale]
  );

  const applyRuntimeSelectionUi = React.useCallback(
    (
      nextSelectedFrameGroupIds: string[],
      nextEdgeSelectionState: TemplateEdgeSelectionStateDto,
      overridePositionGroupProxySelections?: PositionGroupProxySelection[]
    ) => {
      selectedFrameGroupIdsRef.current = nextSelectedFrameGroupIds;
      edgeSelectionStateRef.current = nextEdgeSelectionState;
      const root = previewRef.current;

      if (!root) {
        return;
      }

      applyPreviewEditPermissions(root);
      ensureRelativeAnchorConfigs(root);
      applyRelativeAnchoredFrameRectsInRoot(root);
      applyFrameCanvasVisualHints(root);
      const reconciledEdgeSelection = reconcileLiveEdgeSelection(root, nextEdgeSelectionState);
      const snapshot = buildLiveEdgeTopologySnapshot(root);
      const nextEdgeRolePresentation = resolveEdgeRolePresentation(snapshot, reconciledEdgeSelection);
      applyFrameSelectionUi(
        root,
        nextSelectedFrameGroupIds,
        reconciledEdgeSelection,
        snapshot,
        nextEdgeRolePresentation.edgeRoleById,
        nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds,
        previewRelativeGuideFrameGroupId,
        overridePositionGroupProxySelections ??
          resolvePositionGroupProxySelections(nextSelectedFrameGroupIds, positionGroupProxySelectionGroupIdRef.current)
      );
      applyFrameRelationSelectionUi(root, frameRelationPreviewModeRef.current, nextSelectedFrameGroupIds);
      applyPositionImpactGroupSelectionUi(root, selectionPanelTab, nextSelectedFrameGroupIds, positionRelationAnchorFrameGroupId);
      applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
      applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );
    },
    [
      buildLiveEdgeTopologySnapshot,
      previewRelativeGuideFrameGroupId,
      reconcileLiveEdgeSelection,
      resolveEdgeRolePresentation,
      resolvePositionGroupProxySelections,
      selectionPanelTab,
      positionRelationAnchorFrameGroupId,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
    ]
  );

  const applyRuntimeSelectionVisuals = React.useCallback(
    (nextSelectedFrameGroupIds: string[], nextEdgeSelectionState: TemplateEdgeSelectionStateDto) => {
      selectedFrameGroupIdsRef.current = nextSelectedFrameGroupIds;
      edgeSelectionStateRef.current = nextEdgeSelectionState;
      const root = previewRef.current;

      if (!root) {
        return;
      }

      applyPreviewEditPermissions(root);
      applyFrameCanvasVisualHints(root);
      const reconciledEdgeSelection = reconcileLiveEdgeSelection(root, nextEdgeSelectionState);
      const snapshot = buildLiveEdgeTopologySnapshot(root);
      const nextEdgeRolePresentation = resolveEdgeRolePresentation(snapshot, reconciledEdgeSelection);
      applyFrameSelectionUi(
        root,
        nextSelectedFrameGroupIds,
        reconciledEdgeSelection,
        snapshot,
        nextEdgeRolePresentation.edgeRoleById,
        nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds,
        previewRelativeGuideFrameGroupId,
        resolvePositionGroupProxySelections(nextSelectedFrameGroupIds, positionGroupProxySelectionGroupIdRef.current)
      );
      applyFrameRelationSelectionUi(root, frameRelationPreviewModeRef.current, nextSelectedFrameGroupIds);
      applyPositionImpactGroupSelectionUi(root, selectionPanelTab, nextSelectedFrameGroupIds, positionRelationAnchorFrameGroupId);
      applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
      applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
    },
    [
      buildLiveEdgeTopologySnapshot,
      previewRelativeGuideFrameGroupId,
      reconcileLiveEdgeSelection,
      resolveEdgeRolePresentation,
      resolvePositionGroupProxySelections,
      selectionPanelTab,
      positionRelationAnchorFrameGroupId,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
    ]
  );

  const clearTransientCanvasOverlays = React.useCallback(() => {
    removeFrameEditorGhost(marqueeSelectionStateRef.current?.ghost);
    marqueeSelectionStateRef.current = null;
    removeFrameEditorGhost(createBoxStateRef.current?.ghost);
    createBoxStateRef.current = null;
  }, []);

  const applyFrameBoxSelection = React.useCallback(
    (
      nextSelectedFrameGroupIds: string[],
      options?: {
        positionGroupProxySelectionGroupId?: string | null;
        showAllGroupProxySelections?: boolean;
        disableAutoPositionGroupProxySelection?: boolean;
        overridePositionGroupProxySelections?: PositionGroupProxySelection[];
      }
    ) => {
      const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
      const normalizedSelectionIds = Array.from(
        new Set(
          nextSelectedFrameGroupIds
            .map((frameGroupId) => frameGroupId.trim())
            .filter((frameGroupId) => Boolean(frameGroupId))
        )
      );
      let nextPositionGroupProxySelectionGroupId = (options?.positionGroupProxySelectionGroupId || '').trim();
      if (
        selectionPanelTab === 'position' &&
        !options?.disableAutoPositionGroupProxySelection &&
        !nextPositionGroupProxySelectionGroupId &&
        normalizedSelectionIds.length > 1
      ) {
        const selectedIdSet = new Set(normalizedSelectionIds);
        const matchedGroup =
          positionBoxGroups.find((group) => {
            if (group.frameGroupIds.length <= 1 || group.frameGroupIds.length !== normalizedSelectionIds.length) {
              return false;
            }
            return group.frameGroupIds.every((frameGroupId) => selectedIdSet.has(frameGroupId));
          }) || null;
        if (matchedGroup) {
          nextPositionGroupProxySelectionGroupId = matchedGroup.id;
        }
      }

      const nextPositionGroupProxySelectionsOverride =
        options?.overridePositionGroupProxySelections !== undefined
          ? options.overridePositionGroupProxySelections.map((entry) => ({
              ...entry,
              frameGroupIds: Array.from(
                new Set(
                  entry.frameGroupIds
                    .map((frameGroupId) => frameGroupId.trim())
                    .filter((frameGroupId) => Boolean(frameGroupId))
                )
              ),
            }))
          : null;
      const nextPositionGroupProxySelections =
        nextPositionGroupProxySelectionsOverride ||
        resolvePositionGroupProxySelections(
          normalizedSelectionIds,
          nextPositionGroupProxySelectionGroupId,
          options?.disableAutoPositionGroupProxySelection
            ? {
                selectionKindByFrameGroupId: normalizedSelectionIds.reduce<Record<string, 'frame'>>((accumulator, frameGroupId) => {
                  accumulator[frameGroupId] = 'frame';
                  return accumulator;
                }, {}),
              }
            : undefined
        );
      positionGroupProxySelectionsOverrideRef.current = nextPositionGroupProxySelectionsOverride;
      positionGroupProxySelectionGroupIdRef.current = nextPositionGroupProxySelectionGroupId;
      positionGroupProxySelectionShowAllGroupsRef.current = Boolean(
        options?.showAllGroupProxySelections
      );
      selectedFrameGroupIdsRef.current = normalizedSelectionIds;
      edgeSelectionStateRef.current = emptyEdgeSelection;
      setSelectedFrameGroupIds(normalizedSelectionIds);
      setEdgeSelectionState(emptyEdgeSelection);
      setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
      setSelectionValidationIssues([]);
      setSelectionSaveProgress(defaultSelectionSaveProgressState);
      applyRuntimeSelectionUi(normalizedSelectionIds, emptyEdgeSelection, nextPositionGroupProxySelections);
    },
    [
      applyRuntimeSelectionUi,
      positionBoxGroups,
      resolvePositionGroupProxySelections,
      selectionPanelTab,
    ]
  );

  const resolveMarqueeSelectionIds = React.useCallback(
    (
      pageInner: HTMLElement,
      selectionRect: FrameNodeRect,
      mode: FrameMarqueeSelectionMode,
      baseSelectionIds: string[]
    ) => {
      const frameNodesInPage = getFrameNodes(pageInner).filter(
        (node) => node.closest<HTMLElement>('.page-inner') === pageInner
      );
      const hits = frameNodesInPage
        .filter((node) => {
          const rect = readFrameMoveRect(node);
          return mode === 'contained' ? rectContainsRect(selectionRect, rect) : rectIntersectsRect(selectionRect, rect);
        })
        .map((node) => getFrameGroupId(node))
        .filter((frameGroupId) => Boolean(frameGroupId));

      if (selectionPanelTab === 'position') {
        const topLevelGroups = collectTopLevelPositionGroupsWithRects(pageInner);
        const topLevelGroupMemberIds = new Set<string>();
        const selectedTopLevelGroupMemberIds = new Set<string>();

        topLevelGroups.forEach((groupWithRect) => {
          groupWithRect.frameGroupIds.forEach((frameGroupId) => {
            topLevelGroupMemberIds.add(frameGroupId);
          });

          const matched =
            mode === 'contained'
              ? rectContainsRect(selectionRect, groupWithRect.rect)
              : rectIntersectsRect(selectionRect, groupWithRect.rect);

          if (!matched) {
            return;
          }

          groupWithRect.frameGroupIds.forEach((frameGroupId) => {
            selectedTopLevelGroupMemberIds.add(frameGroupId);
          });
        });

        const ungroupedHitSelectionIds =
          mode === 'contained'
            ? hits.filter((frameGroupId) => !selectedTopLevelGroupMemberIds.has(frameGroupId))
            : hits.filter((frameGroupId) => !topLevelGroupMemberIds.has(frameGroupId));
        const nextSelectionIds = [
          ...baseSelectionIds,
          ...Array.from(selectedTopLevelGroupMemberIds),
          ...ungroupedHitSelectionIds,
        ];

        return Array.from(new Set(nextSelectionIds));
      }

      return Array.from(new Set([...baseSelectionIds, ...hits]));
    },
    [getFrameNodes, selectionPanelTab]
  );

  const resolvePositionMarqueeProxySelections = React.useCallback(
    (pageInner: HTMLElement, selectedFrameGroupIds: string[]) => {
      if (selectionPanelTab !== 'position') {
        return undefined;
      }

      const selectedFrameGroupIdSet = new Set(
        selectedFrameGroupIds.map((frameGroupId) => frameGroupId.trim()).filter((frameGroupId) => Boolean(frameGroupId))
      );
      const topLevelGroups = collectTopLevelPositionGroupsWithRects(pageInner);
      const proxies = topLevelGroups
        .filter((groupWithRect) => groupWithRect.frameGroupIds.every((frameGroupId) => selectedFrameGroupIdSet.has(frameGroupId)))
        .map((groupWithRect) => ({
          groupId: groupWithRect.group.id,
          label: groupWithRect.group.label,
          frameGroupIds: groupWithRect.frameGroupIds.slice(),
        }));

      return proxies;
    },
    [selectionPanelTab]
  );

  const commitCreatedFrameShell = React.useCallback(
    (
      pageInner: HTMLElement,
      rect: FrameNodeRect,
      positionMode: TemplateFramePositionMode,
      anchorFrameGroupId: string | null
    ) => {
      const root = previewRef.current;

      if (!root) {
        return null;
      }

      const frameGroupId = buildCreatedFrameGroupId(root);
      const nextShell = buildCreatedFrameShell({
        pageInner,
        rect,
        frameGroupId,
        positionMode,
      });

      pageInner.appendChild(nextShell);
      const createdFrameNode = resolveFrameSelectionAnchor(
        nextShell.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
      );

      if (positionMode === 'relative' && createdFrameNode && anchorFrameGroupId) {
        const anchorNode = resolveFrameSelectionAnchor(
          pageInner.querySelector<HTMLElement>(
            `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${anchorFrameGroupId}"]`
          )
        );
        const anchorRect = anchorNode ? readFrameMoveRect(anchorNode) : null;

        if (anchorRect) {
          writeFrameRelativeAnchorAttrs(
            createdFrameNode,
            buildRelativeAnchorConfigFromRect({
              frameRect: readFrameMoveRect(createdFrameNode),
              anchorRect,
              anchorKind: 'frame',
              anchorId: anchorFrameGroupId,
            })
          );
        }
      }

      updatePageInnerMinHeight(pageInner);
      applyFrameBoxSelection([frameGroupId]);
      syncDraftPreviewHtmlRef();
      requestPreviewTextFit();

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          schedulePreviewEditorState();
        });
      }

      return frameGroupId;
    },
    [applyFrameBoxSelection, requestPreviewTextFit, schedulePreviewEditorState, syncDraftPreviewHtmlRef]
  );

  const loadTemplates = React.useCallback(async () => {
    try {
      const response = await fetch('/api/templates?limit=64', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '저장된 템플릿 목록을 불러오지 못했습니다.');
      }

      setTemplates(result.data || []);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '저장된 템플릿 목록을 불러오지 못했습니다.';
      setMessage(nextMessage);
    }
  }, []);

  const loadTemplate = React.useCallback(
    async (templateId: string) => {
      const normalizedTemplateId = templateId.trim();

      if (!normalizedTemplateId) {
        setTemplateDetail(null);
        setPreviewHtml('');
        selectedFrameGroupIdsRef.current = [];
        edgeSelectionStateRef.current = TemplateEdgeSelectionService.createEmptyState();
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
        setSelectionValidationIssues([]);
        setSelectionSaveProgress(defaultSelectionSaveProgressState);
        draftPreviewHtmlRef.current = '';
        resetCanvasHistory(null);
        syncTemplateQuery('');
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/templates/${normalizedTemplateId}?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || '템플릿 상세를 불러오지 못했습니다.');
        }

        const detail = result.data as TemplateDetailResult;
        setTemplateDetail(detail);
        setSelectedTemplateId(normalizedTemplateId);
        setTemplateName(detail.template.templateName);
        setSourceDocumentName(detail.template.sourceDocumentName || '');
        setLayoutResizeMode(detail.template.layoutResizeMode);
        setPreviewHtml(detail.template.draftHtml);
        selectedFrameGroupIdsRef.current = [];
        edgeSelectionStateRef.current = TemplateEdgeSelectionService.createEmptyState();
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
        setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
        setSelectionValidationIssues([]);
        setSelectionSaveProgress(defaultSelectionSaveProgressState);
        draftPreviewHtmlRef.current = detail.template.draftHtml;
        resetCanvasHistory({
          renderHtml: detail.template.draftHtml.trim(),
          draftHtml: detail.template.draftHtml.trim(),
          selectedFrameGroupIds: [],
          positionGroupProxySelectionGroupId: '',
          showAllGroupProxySelections: false,
        });
        syncTemplateQuery(normalizedTemplateId);
        setMessage(`템플릿 ${normalizedTemplateId} 를 편집 모드로 불러왔습니다.`);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '템플릿 상세를 불러오지 못했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    [resetCanvasHistory, syncTemplateQuery]
  );

  const handleDeleteTemplateOption = React.useCallback(
    async (option: TemplateOption) => {
      const templateId = option.id.trim();

      if (!templateId) {
        return;
      }

      if (typeof window !== 'undefined') {
        const confirmed = window.confirm(`템플릿 ${templateId} 을(를) 삭제할까요?`);
        if (!confirmed) {
          return;
        }
      }

      setMessage(null);

      try {
        const response = await fetch(`/api/templates/${templateId}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || '템플릿 삭제에 실패했습니다.');
        }

        setTemplates((previous) => previous.filter((item) => item.id !== templateId));

        if (selectedTemplateId.trim() === templateId || templateDetail?.template.id === templateId) {
          setSelectedTemplateId('');
          setTemplateDetail(null);
          setPreviewHtml('');
          setTemplateName('');
          setSourceDocumentName('');
          selectedFrameGroupIdsRef.current = [];
          edgeSelectionStateRef.current = TemplateEdgeSelectionService.createEmptyState();
          setSelectedFrameGroupIds([]);
          setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
          setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
          setSelectionValidationIssues([]);
          setSelectionSaveProgress(defaultSelectionSaveProgressState);
          draftPreviewHtmlRef.current = '';
          resetCanvasHistory(null);
          syncTemplateQuery('');
        }

        setMessage(`템플릿 ${templateId} 삭제를 완료했습니다.`);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '템플릿 삭제에 실패했습니다.';
        setMessage(nextMessage);
      }
    },
    [resetCanvasHistory, selectedTemplateId, syncTemplateQuery, templateDetail?.template.id]
  );

  const handleSelectedTemplateChange = React.useCallback(
    (nextTemplateId: string) => {
      const normalizedTemplateId = nextTemplateId.trim();
      setSelectedTemplateId(normalizedTemplateId);

      if (!normalizedTemplateId) {
        syncTemplateQuery('');
        return;
      }

      void loadTemplate(normalizedTemplateId);
    },
    [loadTemplate, syncTemplateQuery]
  );

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  React.useEffect(() => {
    const normalizedRouteTemplateId = routeTemplateId.trim();

    if (!normalizedRouteTemplateId || loading) {
      return;
    }

    if (templateDetail?.template.id === normalizedRouteTemplateId) {
      routeTemplateAutoloadedRef.current = normalizedRouteTemplateId;
      if (selectedTemplateId.trim() !== normalizedRouteTemplateId) {
        setSelectedTemplateId(normalizedRouteTemplateId);
      }
      return;
    }

    if (routeTemplateAutoloadedRef.current === normalizedRouteTemplateId) {
      return;
    }

    routeTemplateAutoloadedRef.current = normalizedRouteTemplateId;
    if (selectedTemplateId.trim() !== normalizedRouteTemplateId) {
      setSelectedTemplateId(normalizedRouteTemplateId);
    }
    void loadTemplate(normalizedRouteTemplateId);
  }, [loadTemplate, loading, routeTemplateId, selectedTemplateId, templateDetail?.template.id]);

  React.useEffect(() => {
    selectedFrameGroupIdsRef.current = selectedFrameGroupIds;
  }, [selectedFrameGroupIds]);

  React.useEffect(() => {
    edgeSelectionStateRef.current = edgeSelectionState;
  }, [edgeSelectionState]);

  React.useEffect(() => {
    edgeRoleDiagnosticsRef.current = edgeRoleDiagnostics;
  }, [edgeRoleDiagnostics]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined') {
      return;
    }

    draftPreviewHtmlRef.current = renderedPreviewHtml;
    let cancelled = false;
    const applyEditorState = async () => {
      schedulePreviewEditorState();
      await document.fonts?.ready?.catch(() => undefined);

      if (cancelled) {
        return;
      }

      schedulePreviewEditorState();
    };

    const pageInnerObservers = Array.from(root.querySelectorAll<HTMLElement>('.page-inner')).map((pageInner) => {
      const observer = new MutationObserver(() => {
        if (cancelled) {
          return;
        }

        if (!root.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
          schedulePreviewEditorState();
        }
      });
      observer.observe(pageInner, { childList: true });
      return observer;
    });

    void applyEditorState();

    return () => {
      cancelled = true;
      previewEditorStateRetryCountRef.current = 0;
      cancelScheduledPreviewEditorState();
      pageInnerObservers.forEach((observer) => observer.disconnect());
    };
  }, [cancelScheduledPreviewEditorState, renderedPreviewHtml, schedulePreviewEditorState]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined') {
      return;
    }

    let attempts = 0;
    const timerId = window.setInterval(() => {
      const liveRoot = previewRef.current;

      if (!liveRoot) {
        return;
      }

      if (liveRoot.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
        window.clearInterval(timerId);
        return;
      }

      schedulePreviewEditorState();
      attempts += 1;

      if (attempts >= 12) {
        window.clearInterval(timerId);
      }
    }, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [renderedPreviewHtml, schedulePreviewEditorState]);

  React.useEffect(() => {
    const root = previewRef.current;

    if (!root || !renderedPreviewHtml || typeof window === 'undefined') {
      return;
    }

    if (root.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
      return;
    }

    const timerId = window.setTimeout(() => {
      schedulePreviewEditorState();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [boxCreationMode, boxCreationPositionMode, renderedPreviewHtml, schedulePreviewEditorState]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root || typeof window === 'undefined') {
      return;
    }

    syncPreviewSurfaceScale(root);
    const frameId = window.requestAnimationFrame(() => {
      syncPreviewSurfaceScale(previewRef.current);
    });
    const handleWindowResize = () => {
      syncPreviewSurfaceScale(previewRef.current);
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [renderedPreviewHtml, syncPreviewSurfaceScale]);

  const rehydratePreviewEditorStateNow = React.useCallback(
    (root: HTMLElement) => {
      const hasPendingRawBands =
        Boolean(root.querySelector('.v102-frame-band')) &&
        !root.querySelector(`.v102-frame-band[${NORMALIZED_FRAME_BAND_ATTR}="true"]`);

      if (hasPendingRawBands && !previewHasStableFrameLayout(root)) {
        return false;
      }

      const normalized = ensurePreviewFrameBandNormalization(root);
      syncPreviewSurfaceCloneAttrs(root);
      syncPreviewSurfaceSelectionPanelTabAttr(root, selectionPanelTab);
      applyPreviewEditPermissions(root);
      applyFrameCanvasVisualHints(root);
      ensureRelativeAnchorConfigs(root);
      applyRelativeAnchoredFrameRectsInRoot(root);
      syncPreviewSurfaceScale(root);
      const nextRenderHtml = normalized ? extractPreviewRenderHtml(root) : '';

      if (nextRenderHtml && nextRenderHtml !== renderedPreviewHtml) {
        setPreviewHtml(nextRenderHtml);
      }

      normalizeLiveVerticalCohorts(root);
      normalizeLiveVerticalPhysicalPeers(root);
      const snapshot = buildLiveEdgeTopologySnapshot(root);
      const nextEdgeSelection = TemplateEdgeSelectionService.reconcileSelectionState({
        snapshot,
        currentSelection: edgeSelectionStateRef.current,
      });
      edgeSelectionStateRef.current = nextEdgeSelection;
      const nextEdgeRolePresentation = resolveEdgeRolePresentation(
        snapshot,
        nextEdgeSelection,
        edgeRoleDiagnostics.mismatchEdgeIds
      );
      applyFrameSelectionUi(
        root,
        selectedFrameGroupIdsRef.current,
        nextEdgeSelection,
        snapshot,
        nextEdgeRolePresentation.edgeRoleById,
        nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds,
        previewRelativeGuideFrameGroupId,
        resolvePositionGroupProxySelections(
          selectedFrameGroupIdsRef.current,
          positionGroupProxySelectionGroupIdRef.current
        )
      );
      applyFrameRelationSelectionUi(root, frameRelationPreviewModeRef.current, selectedFrameGroupIdsRef.current);
      applyPositionImpactGroupSelectionUi(root, selectionPanelTab, selectedFrameGroupIdsRef.current, positionRelationAnchorFrameGroupId);
      applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
      applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );
      requestPreviewTextFit();
      return true;
    },
    [
      buildLiveEdgeTopologySnapshot,
      edgeRoleDiagnostics.mismatchEdgeIds,
      normalizeLiveVerticalCohorts,
      normalizeLiveVerticalPhysicalPeers,
      previewRelativeGuideFrameGroupId,
      previewHasStableFrameLayout,
      renderedPreviewHtml,
      requestPreviewTextFit,
      selectionPanelTab,
      positionRelationAnchorFrameGroupId,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
      resolveEdgeRolePresentation,
      syncPreviewSurfaceScale,
      resolvePositionGroupProxySelections,
    ]
  );

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    if (!root.querySelector(FRAME_EDGE_BUTTON_SELECTOR)) {
      if (!rehydratePreviewEditorStateNow(root)) {
        schedulePreviewEditorState();
      }
      return;
    }

    applyPreviewEditPermissions(root);
    applyFrameCanvasVisualHints(root);
    normalizeLiveVerticalCohorts(root);
    normalizeLiveVerticalPhysicalPeers(root);
    const snapshot = buildLiveEdgeTopologySnapshot(root);
    const nextEdgeSelection = TemplateEdgeSelectionService.reconcileSelectionState({
      snapshot,
      currentSelection: edgeSelectionState,
    });
    edgeSelectionStateRef.current = nextEdgeSelection;
    const nextEdgeRolePresentation = resolveEdgeRolePresentation(
      snapshot,
      nextEdgeSelection,
      edgeRoleDiagnostics.mismatchEdgeIds
    );
    applyFrameSelectionUi(
      root,
      selectedFrameGroupIds,
      nextEdgeSelection,
      snapshot,
      nextEdgeRolePresentation.edgeRoleById,
      nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds,
      previewRelativeGuideFrameGroupId,
      resolvePositionGroupProxySelections(selectedFrameGroupIds, positionGroupProxySelectionGroupIdRef.current)
    );
    applyFrameRelationSelectionUi(root, frameRelationPreviewModeRef.current, selectedFrameGroupIds);
    applyPositionImpactGroupSelectionUi(root, selectionPanelTab, selectedFrameGroupIds, positionRelationAnchorFrameGroupId);
    applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
    applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
    setEdgeRoleDiagnostics((previous) =>
      edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
        ? previous
        : nextEdgeRolePresentation.diagnosticsState
    );
  }, [
      buildLiveEdgeTopologySnapshot,
      edgeRoleDiagnostics.mismatchEdgeIds,
      edgeSelectionState,
      normalizeLiveVerticalCohorts,
      normalizeLiveVerticalPhysicalPeers,
      rehydratePreviewEditorStateNow,
      renderedPreviewHtml,
      resolveEdgeRolePresentation,
      schedulePreviewEditorState,
      selectionPanelTab,
      selectedFrameGroupIds,
      positionRelationAnchorFrameGroupId,
      previewRelativeGuideFrameGroupId,
      resolvePositionGroupProxySelections,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
      showMetadataIcons,
  ]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    syncPreviewSurfaceSelectionPanelTabAttr(root, selectionPanelTab);
  }, [renderedPreviewHtml, selectionPanelTab]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    applyFrameValidationErrorUi(root, selectionValidationErrorFrameIds);
  }, [renderedPreviewHtml, selectionValidationErrorFrameIds, selectedFrameGroupIds, selectionPanelTab]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    applyRuntimeSelectionVisuals(selectedFrameGroupIdsRef.current, edgeSelectionStateRef.current);
    applyFrameValidationErrorUi(root, selectionValidationErrorFrameIds);
  }, [applyRuntimeSelectionVisuals, selectionValidationErrorFrameIds, showMetadataIcons]);

  React.useLayoutEffect(() => {
    const root = previewRef.current;

    if (!root) {
      return;
    }

    applyFrameRelationSelectionUi(root, frameRelationPreviewMode, selectedFrameGroupIds);
    applyPositionImpactGroupSelectionUi(root, selectionPanelTab, selectedFrameGroupIds, positionRelationAnchorFrameGroupId);
    applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
    applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
  }, [
      frameRelationPreviewMode,
      renderedPreviewHtml,
      selectedFrameGroupIds,
      selectionPanelTab,
      positionRelationAnchorFrameGroupId,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
  ]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || hasActivePointerInteraction()) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      schedulePreviewEditorState();
    });
    const timerId = window.setTimeout(() => {
      schedulePreviewEditorState();
    }, 80);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [
    edgeSelectionState,
    hasActivePointerInteraction,
    renderedPreviewHtml,
    schedulePreviewEditorState,
    selectedFrameGroupIds,
    selectionPanelTab,
  ]);

  const syncSelectionStyleDraft = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || selectedFrameGroupIds.length === 0) {
      setSelectionStyleDraft(defaultSelectionStyleDraft);
      return;
    }

    const nodes = getFrameNodes(root).filter((node) => selectedFrameGroupIds.includes(getFrameGroupId(node)));

    if (!nodes.length) {
      setSelectionStyleDraft(defaultSelectionStyleDraft);
      return;
    }

    const widths = nodes.map((node) => String(Math.round(readFrameNodeRect(node).width)));
    const heights = nodes.map((node) => String(Math.round(readFrameNodeRect(node).height)));
    const fontSizes = nodes.map((node) => normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).fontSize));
    const lineHeights = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).lineHeight)
    );
    const paddingXs = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).paddingLeft)
    );
    const paddingYs = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolveFrameContentTarget(node)).paddingTop)
    );
    const borderRadii = nodes.map((node) =>
      normalizeNumericStyleValue(getComputedStyle(resolvePersistedFrameNode(node) || node).borderRadius)
    );
    const fontWeights = nodes.map((node) => getComputedStyle(resolveFrameContentTarget(node)).fontWeight || '');
    const textAligns = nodes.map((node) => getComputedStyle(resolveFrameContentTarget(node)).textAlign || 'left');
    const colors = nodes.map((node) => colorToHex(getComputedStyle(resolveFrameContentTarget(node)).color || ''));
    const backgroundColors = nodes.map((node) =>
      colorToHex(getComputedStyle(resolvePersistedFrameNode(node) || node).backgroundColor || '')
    );

    const sharedTextAlign = getSharedValue(textAligns);

    setSelectionStyleDraft({
      width: getSharedValue(widths),
      height: getSharedValue(heights),
      fontSize: getSharedValue(fontSizes),
      lineHeight: getSharedValue(lineHeights),
      paddingX: getSharedValue(paddingXs),
      paddingY: getSharedValue(paddingYs),
      borderRadius: getSharedValue(borderRadii),
      fontWeight: getSharedValue(fontWeights),
      textAlign:
        sharedTextAlign === 'center' || sharedTextAlign === 'right' || sharedTextAlign === 'justify'
          ? sharedTextAlign
          : 'left',
      color: getSharedValue(colors) || '#0f172a',
      backgroundColor: getSharedValue(backgroundColors) || 'transparent',
    });
  }, [getFrameNodes, selectedFrameGroupIds]);

  React.useEffect(() => {
    syncSelectionStyleDraft();
  }, [selectedFrameGroupIds, syncSelectionStyleDraft, templateDetail?.template.id]);

  const syncFrameMetadataDraft = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || selectedFrameGroupIds.length === 0) {
      syncedFrameMetadataDraftRef.current = defaultFrameMetadataDraft;
      setFrameMetadataDraft(defaultFrameMetadataDraft);
      return;
    }

    const nodes = getFrameNodes(root).filter((node) => selectedFrameGroupIds.includes(getFrameGroupId(node)));

    if (!nodes.length) {
      syncedFrameMetadataDraftRef.current = defaultFrameMetadataDraft;
      setFrameMetadataDraft(defaultFrameMetadataDraft);
      return;
    }

    const sharedBoxKind = getSharedValue(nodes.map((node) => readFrameBoxKind(node)));
    const sharedRole = getSharedValue(nodes.map((node) => readFrameRole(node)));
    const sharedValueKey = getSharedValue(nodes.map((node) => readFrameValueKey(node)));
    const sharedParentGroupId = getSharedValue(nodes.map((node) => readFrameParentGroupId(node)));
    const sharedRuntimeMode = getSharedValue(nodes.map((node) => readFrameRuntimeMode(node)));

    const nextDraft: FrameMetadataDraft = {
      boxKind: isTemplateFrameBoxKind(sharedBoxKind) ? sharedBoxKind : '',
      role:
        sharedRole === 'group' || TEMPLATE_FRAME_ROLE_OPTIONS.includes(sharedRole as TemplateFrameRole)
          ? (sharedRole as TemplateFrameRole | '')
          : '',
      valueKey: sharedValueKey,
      parentGroupId: sharedParentGroupId,
      runtimeMode: isTemplateFrameRuntimeMode(sharedRuntimeMode) ? sharedRuntimeMode : '',
    };

    syncedFrameMetadataDraftRef.current = nextDraft;
    setFrameMetadataDraft(nextDraft);
  }, [getFrameNodes, selectedFrameGroupIds]);

  React.useEffect(() => {
    syncFrameMetadataDraft();
  }, [selectedFrameGroupIds, syncFrameMetadataDraft, templateDetail?.template.id]);

  const syncSelectionTextDraft = React.useCallback(() => {
    const root = previewRef.current;

    if (!root || selectedFrameGroupIds.length === 0) {
      setSelectionTextDraft('');
      setSelectionTextMixed(false);
      return;
    }

    const nodes = getFrameNodes(root).filter((node) => selectedFrameGroupIds.includes(getFrameGroupId(node)));

    if (!nodes.length) {
      setSelectionTextDraft('');
      setSelectionTextMixed(false);
      return;
    }

    const texts = nodes.map((node) => {
      const input = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
      if (!input) {
        return '';
      }
      return String(input.value || '');
    });
    const sharedText = getSharedValue(texts);

    setSelectionTextMixed(!sharedText);
    setSelectionTextDraft(sharedText || texts[0] || '');
  }, [getFrameNodes, selectedFrameGroupIds]);

  React.useEffect(() => {
    syncSelectionTextDraft();
  }, [selectedFrameGroupIds, syncSelectionTextDraft, templateDetail?.template.id]);

  React.useEffect(() => {
    setStyleFieldApplyStatus(defaultStyleFieldApplyStatus);
  }, [selectedFrameGroupIds, selectionPanelTab]);

  React.useEffect(() => {
    if (selectionSaveProgress.phase === 'idle') {
      return;
    }

    setHasSelectionProgressHistory(true);
    if (selectionSaveProgress.phase === 'running') {
      setShowSelectionStatus(true);
    }
  }, [selectionSaveProgress.phase]);

  React.useEffect(() => {
    const root = previewRef.current;
    const host = root?.querySelector<HTMLElement>('.page-inner') || root;

    if (!root || !host) {
      return;
    }

    const parsed = parseVirtualFrameDefinitions(host.getAttribute(TEMPLATE_VIRTUAL_FRAME_DEFINITIONS_ATTR));
    setVirtualFrameDefinitions(parsed);
  }, [renderedPreviewHtml]);

  const startParentKeySelectionMode = React.useCallback(() => {
    const activeSelectionIds = selectedFrameGroupIdsRef.current;

    if (activeSelectionIds.length === 0) {
      setMessage('먼저 key로 묶을 value 박스를 선택하세요.');
      return;
    }

    clearTransientCanvasOverlays();
    setMetadataRelationSelectionMode({
      kind: 'parent',
      sourceFrameGroupIds: activeSelectionIds.slice(),
    });
    setMessage(
      activeSelectionIds.length > 1
        ? `현재 value 박스 ${activeSelectionIds.length}개가 선택된 상태입니다. 이제 이 값들을 묶는 key 박스를 캔버스에서 1개 선택해주세요.`
        : '현재 value 박스 1개가 선택된 상태입니다. 이제 이 값의 key 박스를 캔버스에서 1개 선택해주세요.'
    );
  }, [clearTransientCanvasOverlays]);

  const startValueBoxSelectionMode = React.useCallback(() => {
    const root = previewRef.current;
    const sourceKeyFrameGroupId = readSingleFrameGroupId(selectedFrameGroupIdsRef.current);

    if (!root || selectedFrameGroupIdsRef.current.length !== 1 || !sourceKeyFrameGroupId) {
      setMessage('먼저 기준이 될 key 박스 1개를 선택하세요.');
      return;
    }

    const sourceNode = resolveFrameSelectionAnchor(
      root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${sourceKeyFrameGroupId}"]`)
    );
    const sourceMetadata = sourceNode ? resolveNextFrameMetadata(sourceNode, {}) : null;

    if (!sourceNode || !sourceMetadata) {
      setMessage('먼저 기준이 될 key 박스 1개를 선택하세요.');
      return;
    }

    if (sourceMetadata.boxKind !== 'text') {
      const approved = confirmPromoteKeyBoxToText();

      if (!approved) {
        setMessage('key 박스 선택을 취소했습니다.');
        return;
      }

      applyFrameMetadataPatch(sourceNode, {
        boxKind: 'text',
        role: 'key',
      });
      syncDraftPreviewHtmlRef();
      setMessage(`key 박스 ${sourceKeyFrameGroupId}를 text 박스로 업데이트하고 설정을 계속합니다.`);
    }

    const existingTargetFrameGroupIds = getFrameNodes(root)
      .filter((node) => readFrameParentGroupId(node) === sourceKeyFrameGroupId)
      .map((node) => getFrameGroupId(node))
      .filter(Boolean);

    clearTransientCanvasOverlays();
    setFrameMetadataDraft((previous) => ({
      ...previous,
      role: 'key',
      parentGroupId: '',
      valueKey: '',
    }));
    setMetadataRelationSelectionMode({
      kind: 'value',
      sourceKeyFrameGroupId,
      targetFrameGroupIds: existingTargetFrameGroupIds,
    });
    setMessage('현재 key 박스가 선택된 상태입니다. 이제 이 key에 연결할 value 박스들을 캔버스에서 선택해주세요. 다시 클릭하면 해제됩니다.');
  }, [clearTransientCanvasOverlays, getFrameNodes, syncDraftPreviewHtmlRef]);

  const clearParentKeySelectionDraft = React.useCallback(() => {
    setFrameMetadataDraft((previous) => ({
      ...previous,
      parentGroupId: '',
      valueKey: '',
    }));
    if (metadataRelationSelectionModeRef.current.kind === 'parent') {
      setMetadataRelationSelectionMode({ kind: 'idle' });
    }
    setMessage('연결할 key 박스를 비웠습니다.');
  }, []);

  const upsertVirtualDefinition = React.useCallback(
    (rawText: string, target: 'key' | 'value') => {
      const label = rawText.trim();
      const id = normalizeVirtualDefinitionId(label);

      if (!label || !id) {
        return;
      }

      const nextDefinitions = (() => {
        const existing = virtualFrameDefinitions.find((definition) => definition.id === id);
        if (existing) {
          return virtualFrameDefinitions.map((definition) =>
            definition.id === id ? { ...definition, label } : definition
          );
        }
        return [...virtualFrameDefinitions, { id, label }];
      })();

      setVirtualFrameDefinitions(nextDefinitions);
      persistVirtualFrameDefinitions(nextDefinitions);
      if (target === 'key') {
        setFrameMetadataDraft((previous) => ({
          ...previous,
          parentGroupId: id,
        }));
      } else if (primarySelectedFrameGroupId) {
        setMetadataRelationSelectionMode({
          kind: 'value',
          sourceKeyFrameGroupId: primarySelectedFrameGroupId,
          targetFrameGroupIds: [id],
        });
      }
      setMessage(`가상 정의 ${id} 를 저장했습니다.`);
    },
    [persistVirtualFrameDefinitions, primarySelectedFrameGroupId, virtualFrameDefinitions]
  );

  const renameVirtualDefinition = React.useCallback(
    (id: string, nextLabelRaw: string, nextIdRaw?: string) => {
      const nextLabel = nextLabelRaw.trim();
      const normalizedNextId = normalizeVirtualDefinitionId(String(nextIdRaw || id));

      if (!id || !nextLabel || !normalizedNextId) {
        return;
      }
      if (!virtualFrameDefinitions.some((definition) => definition.id === id)) {
        return;
      }
      if (id !== normalizedNextId && virtualFrameDefinitions.some((definition) => definition.id === normalizedNextId)) {
        setMessage(`가상 정의 ID ${normalizedNextId} 는 이미 존재합니다.`);
        return;
      }

      const nextDefinitions = virtualFrameDefinitions.map((definition) =>
        definition.id === id ? { ...definition, id: normalizedNextId, label: nextLabel } : definition
      );
      setVirtualFrameDefinitions(nextDefinitions);
      persistVirtualFrameDefinitions(nextDefinitions);

      if (id !== normalizedNextId) {
        const root = previewRef.current;
        if (root) {
          getFrameNodes(root).forEach((node) => {
            if (readFrameParentGroupId(node) === id) {
              applyFrameMetadataPatch(node, { parentGroupId: normalizedNextId });
            }
            if (readFrameValueKey(node) === id) {
              applyFrameMetadataPatch(node, { valueKey: normalizedNextId });
            }
          });
          syncDraftPreviewHtmlRef();
        }
      }

      setFrameMetadataDraft((previous) => ({
        ...previous,
        parentGroupId: previous.parentGroupId === id ? normalizedNextId : previous.parentGroupId,
        valueKey: previous.valueKey === id ? normalizedNextId : previous.valueKey,
      }));
      setMessage(`가상 정의 ${id} 를 ${normalizedNextId} 로 수정했습니다.`);
    },
    [getFrameNodes, persistVirtualFrameDefinitions, syncDraftPreviewHtmlRef, virtualFrameDefinitions]
  );

  const deleteVirtualDefinition = React.useCallback(
    (id: string) => {
      if (!virtualFrameDefinitions.some((definition) => definition.id === id)) {
        return;
      }

      const nextDefinitions = virtualFrameDefinitions.filter((definition) => definition.id !== id);
      setVirtualFrameDefinitions(nextDefinitions);
      persistVirtualFrameDefinitions(nextDefinitions);
      setFrameMetadataDraft((previous) => ({
        ...previous,
        parentGroupId: previous.parentGroupId === id ? '' : previous.parentGroupId,
        valueKey: previous.valueKey === id ? '' : previous.valueKey,
      }));
      setMessage(`가상 정의 ${id} 를 삭제했습니다.`);
    },
    [persistVirtualFrameDefinitions, virtualFrameDefinitions]
  );

  const handleMetadataRelationFramePick = React.useCallback(
    (frameGroupId: string) => {
      const root = previewRef.current;
      const relationMode = metadataRelationSelectionModeRef.current;

      if (!root || relationMode.kind === 'idle') {
        return false;
      }

      const targetNode = resolveFrameSelectionAnchor(
        root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
      );

      if (!targetNode) {
        return false;
      }

      if (relationMode.kind === 'parent') {
        if (relationMode.sourceFrameGroupIds.includes(frameGroupId)) {
          setMessage('선택된 박스 자신을 key 박스로 지정할 수 없습니다.');
          return true;
        }

        const targetMetadata = resolveNextFrameMetadata(targetNode, {});

        if (targetMetadata.boxKind !== 'text') {
          const approved = confirmPromoteKeyBoxToText();

          if (!approved) {
            setMessage('key 박스 선택을 취소했습니다.');
            return true;
          }

          applyFrameMetadataPatch(targetNode, {
            boxKind: 'text',
            role: 'key',
          });
          syncDraftPreviewHtmlRef();
        }

        const nextValueKey = normalizeFrameValueKey(readFrameDisplayText(targetNode)) || frameGroupId;
        setFrameMetadataDraft((previous) => ({
          ...previous,
          role: 'value',
          parentGroupId: frameGroupId,
          valueKey: nextValueKey,
        }));
        setMetadataRelationSelectionMode({ kind: 'idle' });
        applyRuntimeSelectionVisuals(relationMode.sourceFrameGroupIds, edgeSelectionStateRef.current);
        setMessage(`key 박스를 ${frameGroupId} 로 지정했습니다. 저장하면 선택된 박스들에 반영됩니다.`);
        return true;
      }

      if (frameGroupId === relationMode.sourceKeyFrameGroupId) {
        setMessage('현재 선택된 key 박스 자신은 value 박스로 선택할 수 없습니다.');
        return true;
      }

      const nextTargetFrameGroupIds = relationMode.targetFrameGroupIds.includes(frameGroupId)
        ? relationMode.targetFrameGroupIds.filter((targetId) => targetId !== frameGroupId)
        : [...relationMode.targetFrameGroupIds, frameGroupId];

      setMetadataRelationSelectionMode({
        kind: 'value',
        sourceKeyFrameGroupId: relationMode.sourceKeyFrameGroupId,
        targetFrameGroupIds: nextTargetFrameGroupIds,
      });
      setMessage(
        nextTargetFrameGroupIds.length > 0
          ? `현재 key 박스가 선택된 상태입니다. value 박스 ${nextTargetFrameGroupIds.length}개가 연결 예정입니다. 계속 선택하거나 저장하세요.`
          : '현재 key 박스가 선택된 상태입니다. 아직 연결 예정인 value 박스가 없습니다.'
      );
      return true;
    },
    [applyRuntimeSelectionVisuals, syncDraftPreviewHtmlRef]
  );

  const waitForNextPaint = React.useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }

        window.requestAnimationFrame(() => resolve());
      }),
    []
  );

  const applySelectionStylePatch = React.useCallback(
    (patch: FrameStylePatch) => {
      const root = previewRef.current;
      const activeSelectionIds = selectedFrameGroupIdsRef.current;

      if (!root || activeSelectionIds.length === 0) {
        setMessage('편집할 박스를 먼저 선택하세요.');
        return;
      }

      const nodes = getFrameNodes(root).filter((node) => activeSelectionIds.includes(getFrameGroupId(node)));

      if (!nodes.length) {
        return;
      }

      nodes.forEach((node) => applyFrameStylePatch(node, patch));
      applyRelativeAnchoredFrameRectsInRoot(root);
      syncDraftPreviewHtmlRef();
      syncSelectionStyleDraft();
      requestPreviewTextFit();
    },
    [getFrameNodes, requestPreviewTextFit, syncDraftPreviewHtmlRef, syncSelectionStyleDraft]
  );

  const previewPositionOrderLockCandidateSelection = React.useCallback(
    (
      nextFrameGroupId: string,
      options?: {
        positionGroupProxySelectionGroupId?: string | null;
        preserveFrameGroupId?: boolean;
        candidateGroupId?: string | null;
        disableProxySelection?: boolean;
        commitSelection?: boolean;
        replaceSelectionFromGroupId?: string | null;
      }
    ) => {
      const normalizedNextFrameGroupId = nextFrameGroupId.trim();
      const normalizedGroup = positionBoxGroupByFrameGroupId.get(normalizedNextFrameGroupId) || null;
      const selectionFrameGroupId = normalizedNextFrameGroupId;
      const optionProxySelectionGroupId = (options?.positionGroupProxySelectionGroupId || '').trim();
      const resolvedProxySelectionGroupId =
        options?.disableProxySelection
          ? ''
          : optionProxySelectionGroupId || ((normalizedGroup?.frameGroupIds.length || 0) > 1 ? normalizedGroup?.id || '' : '');
      const replaceSelectionFromGroupId = (options?.replaceSelectionFromGroupId || '').trim();
      const nextSelectionKind: 'group' | 'frame' =
        options?.preserveFrameGroupId || !resolvedProxySelectionGroupId ? 'frame' : 'group';
      const resolvedSelectionGroup =
        (resolvedProxySelectionGroupId
          ? positionBoxGroups.find((candidateGroup) => candidateGroup.id === resolvedProxySelectionGroupId) || null
          : null) || normalizedGroup;
      const resolvedSelectionGroupId = resolvedSelectionGroup?.id?.trim() || '';
      const nextSelectionFrameGroupIds =
        nextSelectionKind === 'group' && resolvedSelectionGroup && resolvedSelectionGroup.frameGroupIds.length > 1
          ? resolvedSelectionGroup.frameGroupIds
              .map((frameGroupId) => frameGroupId.trim())
              .filter((frameGroupId) => Boolean(frameGroupId))
          : [selectionFrameGroupId];

      if (!selectionFrameGroupId) {
        return;
      }

      const resolveNextSelectionIds = (sourceFrameGroupIds: string[]) => {
        const normalizedSourceIds = sourceFrameGroupIds
          .map((frameGroupId) => frameGroupId.trim())
          .filter((frameGroupId) => Boolean(frameGroupId));
        const filteredSourceIdsByReplacement =
          replaceSelectionFromGroupId.length > 0
            ? normalizedSourceIds.filter(
                (frameGroupId) => (positionBoxGroupByFrameGroupId.get(frameGroupId)?.id || '') !== replaceSelectionFromGroupId
              )
            : normalizedSourceIds;
        const filteredSourceIds =
          nextSelectionKind === 'group' && resolvedSelectionGroupId
            ? filteredSourceIdsByReplacement.filter(
                (frameGroupId) => (positionBoxGroupByFrameGroupId.get(frameGroupId)?.id || '') !== resolvedSelectionGroupId
              )
            : filteredSourceIdsByReplacement;
        const nextSelectionIdSet = new Set(filteredSourceIds);

        nextSelectionFrameGroupIds.forEach((frameGroupId) => {
          nextSelectionIdSet.add(frameGroupId);
        });

        return Array.from(nextSelectionIdSet);
      };
      const mergedSelectionIds = resolveNextSelectionIds(positionOrderLockFrameGroupIds);

      applyFrameBoxSelection(mergedSelectionIds, {
        positionGroupProxySelectionGroupId: resolvedProxySelectionGroupId,
        showAllGroupProxySelections: true,
      });
      if (options?.commitSelection) {
        setPositionOrderLockFrameGroupIds((previous) => {
          const nextSelectionIds = resolveNextSelectionIds(previous);
          const normalizedPrevious = previous.map((frameGroupId) => frameGroupId.trim()).filter((frameGroupId) => Boolean(frameGroupId));

          if (
            nextSelectionIds.length === normalizedPrevious.length &&
            nextSelectionIds.every((frameGroupId, index) => normalizedPrevious[index] === frameGroupId)
          ) {
            return previous;
          }

          return nextSelectionIds;
        });
        setPositionOrderLockSelectionKindByFrameGroupId((previous) => {
          const next = { ...previous };

          if (replaceSelectionFromGroupId.length > 0) {
            Object.keys(next).forEach((frameGroupId) => {
              if ((positionBoxGroupByFrameGroupId.get(frameGroupId)?.id || '') === replaceSelectionFromGroupId) {
                delete next[frameGroupId];
              }
            });
          }

          if (nextSelectionKind === 'group' && resolvedSelectionGroupId) {
            Object.keys(next).forEach((frameGroupId) => {
              if ((positionBoxGroupByFrameGroupId.get(frameGroupId)?.id || '') === resolvedSelectionGroupId) {
                delete next[frameGroupId];
              }
            });
          }
          nextSelectionFrameGroupIds.forEach((frameGroupId) => {
            next[frameGroupId] = nextSelectionKind;
          });
          return next;
        });
      }
      setPositionOrderLockCandidateFrameGroupId(selectionFrameGroupId);
      setPositionOrderLockCandidateGroupId((options?.candidateGroupId || normalizedGroup?.id || '').trim());
      setPositionOrderLockCandidateSelectionStage(resolvedProxySelectionGroupId ? 'group' : 'frame');
    },
    [applyFrameBoxSelection, positionBoxGroupByFrameGroupId, positionBoxGroups, positionOrderLockFrameGroupIds]
  );

  const startPositionOrderLockSelectionFromCurrentCanvasSelection = React.useCallback(() => {
    if (positionOrderLockSelectionMode) {
      return;
    }

    const selectedFrameGroupIds = selectedFrameGroupIdsRef.current
      .map((frameGroupId) => frameGroupId.trim())
      .filter((frameGroupId) => Boolean(frameGroupId));
    const uniqueSelectedFrameGroupIds = Array.from(new Set(selectedFrameGroupIds));
    const expandedSelectedFrameGroupIds = uniqueSelectedFrameGroupIds.flatMap((frameGroupId) => {
      const group = positionBoxGroupByFrameGroupId.get(frameGroupId);
      if (!group || group.frameGroupIds.length <= 1) {
        return [frameGroupId];
      }
      return group.frameGroupIds
        .map((memberFrameGroupId) => memberFrameGroupId.trim())
        .filter((memberFrameGroupId) => Boolean(memberFrameGroupId));
    });
    const nextSelectedFrameGroupIds = Array.from(new Set(expandedSelectedFrameGroupIds));

    if (nextSelectedFrameGroupIds.length < 2) {
      setMessage('2개 이상의 박스를 선택해야 합니다.');
      return;
    }

    const nextSelectionKindByFrameGroupId = nextSelectedFrameGroupIds.reduce<Record<string, 'group' | 'frame'>>(
      (accumulator, frameGroupId) => {
        const group = positionBoxGroupByFrameGroupId.get(frameGroupId);
        accumulator[frameGroupId] = group && group.frameGroupIds.length > 1 ? 'group' : 'frame';
        return accumulator;
      },
      {}
    );

    setPositionOrderLockSelectionMode(true);
    setPositionOrderLockColorSeed(Math.floor(Math.random() * 1_000_000));
    setPositionOrderLockFrameGroupIds(nextSelectedFrameGroupIds);
    setPositionOrderLockSelectionKindByFrameGroupId(nextSelectionKindByFrameGroupId);
    setPositionSpacingDraftByPairKey({});
    setPositionOrderLockCandidateFrameGroupId('');
    setPositionOrderLockCandidateGroupId('');
    setPositionOrderLockCandidateSelectionStage('');
    positionGroupProxySelectionShowAllGroupsRef.current = true;
    applyFrameBoxSelection(nextSelectedFrameGroupIds, {
      positionGroupProxySelectionGroupId: '',
      showAllGroupProxySelections: true,
    });
  }, [applyFrameBoxSelection, positionBoxGroupByFrameGroupId, positionOrderLockSelectionMode]);
  const applyPositionSpacingBySelectedFrameGroupIds = React.useCallback(
    (
      selectedTargetFrameGroupIdsArg: string[],
      draftByPairKeyArg: Record<string, { gapY: string }>,
      selectionKindByFrameGroupIdArg: Record<string, 'group' | 'frame'>
    ): {
      ok: boolean;
      message: string;
      appliedCount: number;
      skippedCount: number;
      orderedGroupCount: number;
    } => {
      const root = previewRef.current;
      const selectedTargetFrameGroupIds = Array.from(
        new Set(
          selectedTargetFrameGroupIdsArg
            .map((frameGroupId) => frameGroupId.trim())
            .filter((frameGroupId) => Boolean(frameGroupId))
        )
      );

      if (!root) {
        return {
          ok: false,
          message: '캔버스를 먼저 로드하세요.',
          appliedCount: 0,
          skippedCount: 0,
          orderedGroupCount: 0,
        };
      }

      if (selectedTargetFrameGroupIds.length < 2) {
        return {
          ok: false,
          message: '간격 고정은 2개 이상 박스를 선택해야 확정할 수 있습니다.',
          appliedCount: 0,
          skippedCount: 0,
          orderedGroupCount: 0,
        };
      }

      const orderedGroupMembers = resolvePositionSpacingOrderedGroupMembers(
        selectedTargetFrameGroupIds,
        selectionKindByFrameGroupIdArg
      );

      if (orderedGroupMembers.length < 2) {
        return {
          ok: false,
          message: '선택한 박스를 캔버스에서 찾지 못했습니다. 다시 선택 후 시도하세요.',
          appliedCount: 0,
          skippedCount: 0,
          orderedGroupCount: 0,
        };
      }

      const hasSameRelativeConfig = (
        frameNode: HTMLElement,
        pageInner: HTMLElement,
        nextConfig: TemplateFrameRelativeAnchorConfig
      ) => {
        if (readFramePositionMode(frameNode, pageInner) !== 'relative') {
          return false;
        }

        const currentConfig = readFrameRelativeAnchorConfig(frameNode, pageInner);

        if (!currentConfig) {
          return false;
        }

        return (
          currentConfig.anchorKind === nextConfig.anchorKind &&
          currentConfig.anchorId === nextConfig.anchorId &&
          currentConfig.anchorX === nextConfig.anchorX &&
          currentConfig.anchorY === nextConfig.anchorY &&
          Math.abs(currentConfig.offsetX - nextConfig.offsetX) <= 0.1 &&
          Math.abs(currentConfig.offsetY - nextConfig.offsetY) <= 0.1
        );
      };

      let appliedCount = 0;
      let skippedCount = 0;
      let changed = false;
      const resolvedSpacingPairs = resolvePositionSpacingPairsFromOrderedMembers(orderedGroupMembers);

      resolvedSpacingPairs.forEach((pair) => {
        const anchorGroupMember = pair.anchorMember;
        const targetGroupMember = pair.targetMember;

        if (!anchorGroupMember) {
          skippedCount += 1;
          return;
        }

        if (anchorGroupMember.pageInner !== targetGroupMember.pageInner) {
          skippedCount += 1;
          return;
        }

        const pairKey = pair.pairKey;
        const pairDraft = draftByPairKeyArg[pairKey];
        const draftGapY = Number.parseFloat(pairDraft?.gapY || '');
        const resolvedGapY = Number.isFinite(draftGapY) ? Math.max(0, draftGapY) : Math.max(0, pair.defaultGapY);
        const anchorReferenceBottom = pair.anchorReferenceRect.top + pair.anchorReferenceRect.height;
        const targetReferenceBottom = pair.targetReferenceRect.top + pair.targetReferenceRect.height;
        const deltaY =
          pair.anchorY === 'bottom'
            ? anchorReferenceBottom + resolvedGapY - pair.targetReferenceRect.top
            : pair.anchorReferenceRect.top - resolvedGapY - targetReferenceBottom;

        targetGroupMember.memberFrameEntries.forEach((memberEntry) => {
          if (memberEntry.pageInner !== targetGroupMember.pageInner) {
            skippedCount += 1;
            return;
          }

          const nextMemberRect = {
            ...memberEntry.rect,
            top: memberEntry.rect.top + deltaY,
          };
          const preferredMemberPins = resolvePreferredRelativeAnchorPins(nextMemberRect, anchorGroupMember.groupRect);
          const memberConfig = buildRelativeAnchorConfigFromRect({
            frameRect: nextMemberRect,
            anchorRect: anchorGroupMember.groupRect,
            anchorKind: 'group',
            anchorId: anchorGroupMember.group.id,
            preferredAnchorX: preferredMemberPins.preferredAnchorX,
            preferredAnchorY: pair.anchorY,
          });

          if (!hasSameRelativeConfig(memberEntry.node, memberEntry.pageInner, memberConfig)) {
            applyFramePositionMode(memberEntry.node, 'relative', memberEntry.pageInner);
            writeFrameRelativeAnchorAttrs(memberEntry.node, memberConfig);
            changed = true;
          }
          appliedCount += 1;
        });
      });

      if (appliedCount <= 0) {
        return {
          ok: false,
          message:
            skippedCount > 0
              ? `박스 간격을 고정하지 못했습니다. (${skippedCount}개 제외됨)`
              : '박스 간격을 고정할 수 없습니다.',
          appliedCount,
          skippedCount,
          orderedGroupCount: orderedGroupMembers.length,
        };
      }

      if (changed) {
        applyRelativeAnchoredFrameRectsInRoot(root);
        syncDraftPreviewHtmlRef();
        requestPreviewTextFit();
      }

      return {
        ok: true,
        message: '',
        appliedCount,
        skippedCount,
        orderedGroupCount: orderedGroupMembers.length,
      };
    },
    [
      requestPreviewTextFit,
      resolvePositionSpacingOrderedGroupMembers,
      resolvePositionSpacingPairsFromOrderedMembers,
      syncDraftPreviewHtmlRef,
    ]
  );

  React.useEffect(() => {
    if (!positionOrderLockSelectionMode || !positionSpacingDraftApplyRequestedRef.current) {
      return;
    }

    const selectedTargetFrameGroupIds = [...positionOrderLockFrameGroupIds];
    positionSpacingDraftApplyRequestedRef.current = false;

    if (selectedTargetFrameGroupIds.length < 2) {
      return;
    }

    const result = applyPositionSpacingBySelectedFrameGroupIds(
      selectedTargetFrameGroupIds,
      positionSpacingDraftByPairKey,
      positionOrderLockSelectionKindByFrameGroupId
    );
    if (!result.ok && result.message) {
      setMessage(result.message);
    }
  }, [
    applyPositionSpacingBySelectedFrameGroupIds,
    positionOrderLockFrameGroupIds,
    positionOrderLockSelectionKindByFrameGroupId,
    positionOrderLockSelectionMode,
    positionSpacingDraftByPairKey,
  ]);

  const confirmPositionOrderLock = React.useCallback(() => {
    const selectedTargetFrameGroupIds = [...positionOrderLockFrameGroupIds];
    const result = applyPositionSpacingBySelectedFrameGroupIds(
      selectedTargetFrameGroupIds,
      positionSpacingDraftByPairKey,
      positionOrderLockSelectionKindByFrameGroupId
    );

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setPositionOrderLockSelectionMode(false);
    setPositionOrderLockFrameGroupIds([]);
    setPositionOrderLockSelectionKindByFrameGroupId({});
    setPositionOrderLockCandidateFrameGroupId('');
    setPositionOrderLockCandidateGroupId('');
    setPositionOrderLockCandidateSelectionStage('');
    positionGroupProxySelectionShowAllGroupsRef.current = false;
    setMessage(
      `박스 간격 고정 완료: ${result.orderedGroupCount}개 그룹 선택, ${result.appliedCount}개 상대 간격 고정` +
        (result.skippedCount > 0 ? `, ${result.skippedCount}개 제외` : '')
    );
  }, [
    applyPositionSpacingBySelectedFrameGroupIds,
    positionOrderLockFrameGroupIds,
    positionOrderLockSelectionKindByFrameGroupId,
    positionSpacingDraftByPairKey,
  ]);
  const removePositionOrderLockTargetSelection = React.useCallback(
    (targetSelectionEntityId: string) => {
      const normalizedTargetSelectionEntityId = targetSelectionEntityId.trim();

      if (!normalizedTargetSelectionEntityId) {
        return;
      }

      const selectedGroupIds = new Set(
        positionOrderLockFrameGroupIds
          .map((frameGroupId) => frameGroupId.trim())
          .filter((frameGroupId) => Boolean(frameGroupId))
          .map((frameGroupId) => {
            const selectionKind = positionOrderLockSelectionKindByFrameGroupId[frameGroupId] || 'frame';
            if (selectionKind !== 'group') {
              return '';
            }
            return positionBoxGroupByFrameGroupId.get(frameGroupId)?.id || '';
          })
          .filter((groupId) => Boolean(groupId))
      );

      const shouldRemoveGroupEntity = selectedGroupIds.has(normalizedTargetSelectionEntityId);
      const frameGroupIdsToRemove = new Set(
        shouldRemoveGroupEntity
          ? positionOrderLockFrameGroupIds.filter((frameGroupId) => {
              const normalizedFrameGroupId = frameGroupId.trim();
              if (!normalizedFrameGroupId) {
                return false;
              }
              const selectionKind = positionOrderLockSelectionKindByFrameGroupId[normalizedFrameGroupId] || 'frame';
              if (selectionKind !== 'group') {
                return false;
              }
              return (
                (positionBoxGroupByFrameGroupId.get(normalizedFrameGroupId)?.id || '') ===
                normalizedTargetSelectionEntityId
              );
            })
          : [normalizedTargetSelectionEntityId]
      );

      const nextSelectionIds = positionOrderLockFrameGroupIds
        .map((frameGroupId) => frameGroupId.trim())
        .filter((frameGroupId) => Boolean(frameGroupId) && !frameGroupIdsToRemove.has(frameGroupId));

      if (nextSelectionIds.length === positionOrderLockFrameGroupIds.length) {
        return;
      }

      setPositionOrderLockFrameGroupIds(nextSelectionIds);
      setPositionOrderLockSelectionKindByFrameGroupId((previous) => {
        const next = { ...previous };
        frameGroupIdsToRemove.forEach((frameGroupId) => {
          delete next[frameGroupId];
        });
        return next;
      });
      applyFrameBoxSelection(nextSelectionIds, {
        positionGroupProxySelectionGroupId: '',
        showAllGroupProxySelections: true,
      });
    },
    [
      applyFrameBoxSelection,
      positionBoxGroupByFrameGroupId,
      positionOrderLockFrameGroupIds,
      positionOrderLockSelectionKindByFrameGroupId,
    ]
  );

  const applySelectedPositionGroupRelation = React.useCallback(() => {
    const root = previewRef.current;

    if (!root) {
      setMessage('캔버스를 먼저 로드하세요.');
      return;
    }

    if (selectedPositionGroupingFrameGroupIds.length < 2) {
      setMessage('하나의 박스 그룹으로 묶을 박스를 2개 이상 선택하세요.');
      return;
    }

    const selectedMembers = selectedPositionGroupingFrameGroupIds
      .map((frameGroupId) => {
        const node = resolveFrameSelectionAnchor(
          root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
        );
        const pageInner = node?.closest<HTMLElement>('.page-inner') || null;
        const rect = node ? readFrameMoveRect(node) : null;

        return node && pageInner && rect
          ? {
              frameGroupId,
              node,
              pageInner,
              rect,
            }
          : null;
      })
      .filter(
        (
          candidate
        ): candidate is {
          frameGroupId: string;
          node: HTMLElement;
          pageInner: HTMLElement;
          rect: FrameNodeRect;
        } => Boolean(candidate)
      );

    if (selectedMembers.length < 2) {
      setMessage('선택된 박스를 찾지 못했습니다. 다시 선택 후 시도하세요.');
      return;
    }

    const parentCandidate = selectedMembers
      .slice()
      .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left)[0];
    const parentFrameGroupId = parentCandidate?.frameGroupId || '';

    if (!parentFrameGroupId) {
      setMessage('묶을 박스를 먼저 선택하세요.');
      return;
    }

    const parentNode = parentCandidate.node;
    const parentPageInner = parentCandidate.pageInner;
    const parentRect = parentCandidate.rect;

    if (!parentNode || !parentPageInner || !parentRect) {
      setMessage('선택된 기준 박스를 찾지 못했습니다. 캔버스를 다시 로드한 뒤 다시 시도하세요.');
      return;
    }

    const nextGroupLabel = readNextPositionGroupLabel(collectPositionBoxGroups(root, { includeSingletons: false }));
    const nextGroupId = `position-box-${Date.now().toString(36)}`;
    const orderedGroupMembers = selectedMembers
      .sort((left, right) => {
        return left.rect.top - right.rect.top || left.rect.left - right.rect.left;
      });
    let appliedCount = 0;
    let skippedCount = 0;

    orderedGroupMembers.forEach((member, memberIndex) => {
      const frameGroupId = member.frameGroupId;
      const childNode = member.node;
      const childPageInner = member.pageInner;

      if (!childNode || !childPageInner) {
        skippedCount += 1;
        return;
      }

      if (childPageInner !== parentPageInner) {
        skippedCount += 1;
        return;
      }

      writeFramePositionGroupAttrs(childNode, {
        groupId: nextGroupId,
        label: nextGroupLabel,
        managed: false,
      });

      if (frameGroupId === parentFrameGroupId) {
        appliedCount += 1;
        return;
      }

      const childRect = member.rect;

      if (!childRect) {
        skippedCount += 1;
        return;
      }

      const anchorMember = orderedGroupMembers[Math.max(0, memberIndex - 1)];
      const anchorFrameGroupId = anchorMember?.frameGroupId || parentFrameGroupId;
      const anchorRect = anchorMember?.rect || parentRect;
      const preferredPins = resolvePreferredRelativeAnchorPins(childRect, anchorRect);
      const nextConfig = buildRelativeAnchorConfigFromRect({
        frameRect: childRect,
        anchorRect,
        anchorKind: 'frame',
        anchorId: anchorFrameGroupId,
        preferredAnchorX: preferredPins.preferredAnchorX,
        preferredAnchorY: preferredPins.preferredAnchorY,
      });
      applyFramePositionMode(childNode, 'relative', parentPageInner);
      writeFrameRelativeAnchorAttrs(childNode, nextConfig);
      syncFrameRelativeAnchorOffsetsToCurrentRect(childNode, parentPageInner);
      writeFramePositionGroupAttrs(childNode, {
        groupId: nextGroupId,
        label: nextGroupLabel,
        managed: true,
      });
      appliedCount += 1;
    });

    if (appliedCount === 0) {
      setMessage(
        skippedCount > 0
          ? `선택 박스 그룹을 만들지 못했습니다. (${skippedCount}개 제외됨)`
          : '선택 박스 그룹을 만들 박스가 없습니다.'
      );
      return;
    }

    ensureRelativeAnchorConfigs(root);
    applyRelativeAnchoredFrameRectsInRoot(root);
    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
    setMessage(
      `박스 묶기 완료: ${nextGroupLabel} (${appliedCount}개 박스)` +
        (skippedCount > 0 ? `, ${skippedCount}개 제외` : '')
    );
  }, [
    requestPreviewTextFit,
    selectedPositionGroupingFrameGroupIds,
    syncDraftPreviewHtmlRef,
  ]);
  const applySelectedPositionGroupRelationFromCanvasSelection = React.useCallback(() => {
    if (selectedFrameGroupIdsRef.current.length < 2) {
      setMessage('2개 이상의 박스를 선택해야 합니다.');
      return;
    }

    applySelectedPositionGroupRelation();
  }, [applySelectedPositionGroupRelation]);

  const clearSelectedPositionGroupRelation = React.useCallback(() => {
    const root = previewRef.current;

    if (!root) {
      setMessage('캔버스를 먼저 로드하세요.');
      return;
    }

    const explicitGroups = collectPositionBoxGroups(root, { includeSingletons: false }).filter((group) => !group.inferred);
    const explicitGroupByFrameGroupId = new Map<string, PositionImpactGroup>();
    explicitGroups.forEach((group) => {
      group.frameGroupIds.forEach((frameGroupId) => {
        explicitGroupByFrameGroupId.set(frameGroupId, group);
      });
    });
    const targetIds = Array.from(
      new Set(
        selectedPositionGroupingFrameGroupIds.flatMap((frameGroupId) => {
          const group = explicitGroupByFrameGroupId.get(frameGroupId);
          return group ? group.frameGroupIds : [];
        })
      )
    );

    if (targetIds.length === 0) {
      setMessage('해제할 명시 박스 그룹이 없습니다. 먼저 그룹에 속한 박스를 선택하세요.');
      return;
    }

    let clearedCount = 0;
    let skippedCount = 0;

    targetIds.forEach((frameGroupId) => {
      const targetNode = resolveFrameSelectionAnchor(
        root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
      );
      const targetPageInner = targetNode?.closest<HTMLElement>('.page-inner') || null;

      if (!targetNode || !targetPageInner) {
        skippedCount += 1;
        return;
      }

      applyFramePositionMode(targetNode, 'absolute', targetPageInner);

      writeFramePositionGroupAttrs(targetNode, null);
      clearedCount += 1;
    });

    if (clearedCount === 0) {
      setMessage(
        skippedCount > 0
          ? `해제할 박스를 찾지 못해 반영되지 않았습니다. (${skippedCount}개 제외됨)`
          : '해제할 박스가 없습니다.'
      );
      return;
    }

    applyRelativeAnchoredFrameRectsInRoot(root);
    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
    setMessage(`선택 박스 그룹 해제 완료: ${clearedCount}개 박스` + (skippedCount > 0 ? `, ${skippedCount}개 제외` : ''));
  }, [requestPreviewTextFit, selectedPositionGroupingFrameGroupIds, syncDraftPreviewHtmlRef]);

  const readSelectionStyleDraftFromControls = React.useCallback((): SelectionStyleDraft => {
    const root = stylePanelRef.current;

    if (!root) {
      return selectionStyleDraft;
    }

    const readFieldValue = (field: keyof SelectionStyleDraft) => {
      const element = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-style-field="${field}"]`);
      return element?.value ?? selectionStyleDraft[field];
    };

    return {
      width: readFieldValue('width'),
      height: readFieldValue('height'),
      fontSize: readFieldValue('fontSize'),
      lineHeight: readFieldValue('lineHeight'),
      paddingX: readFieldValue('paddingX'),
      paddingY: readFieldValue('paddingY'),
      borderRadius: readFieldValue('borderRadius'),
      fontWeight: readFieldValue('fontWeight'),
      textAlign: readFieldValue('textAlign') as SelectionStyleDraft['textAlign'],
      color: readFieldValue('color'),
      backgroundColor: readFieldValue('backgroundColor'),
    };
  }, [selectionStyleDraft]);

  const applySelectionStyleDraft = React.useCallback(() => {
    if (selectedFrameGroupIdsRef.current.length === 0) {
      setMessage('스타일을 적용할 박스를 먼저 선택하세요.');
      return false;
    }

    const nextDraft = readSelectionStyleDraftFromControls();
    const width = Number.parseFloat(nextDraft.width);
    const height = Number.parseFloat(nextDraft.height);

    setSelectionStyleDraft(nextDraft);

    applySelectionStylePatch({
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
      fontSize: nextDraft.fontSize,
      lineHeight: nextDraft.lineHeight,
      paddingX: nextDraft.paddingX,
      paddingY: nextDraft.paddingY,
      borderRadius: nextDraft.borderRadius,
      fontWeight: nextDraft.fontWeight,
      textAlign: nextDraft.textAlign,
      color: nextDraft.color,
      backgroundColor: nextDraft.backgroundColor,
    });
    return true;
  }, [applySelectionStylePatch, readSelectionStyleDraftFromControls]);

  const setStyleFieldDraftValue = React.useCallback((field: StyleFieldKey, value: string) => {
    setSelectionStyleDraft((previous) => ({ ...previous, [field]: value }));
    setStyleFieldApplyStatus((previous) => ({ ...previous, [field]: 'idle' }));
  }, []);

  const applyStyleFieldOnBlur = React.useCallback(
    (field: StyleFieldKey) => {
      if (selectedFrameGroupIdsRef.current.length === 0) {
        return;
      }

      setSelectionSaveProgress({
        phase: 'running',
        title: '선택 항목 저장',
        percent: 45,
        stage: '스타일 반영 중',
        detail: `${field} 스타일을 반영하고 있습니다.`,
      });
      setStyleFieldApplyStatus((previous) => ({ ...previous, [field]: 'saving' }));
      const ok = applySelectionStyleDraft();
      setStyleFieldApplyStatus((previous) => ({ ...previous, [field]: ok ? 'saved' : 'failed' }));
      setSelectionSaveProgress({
        phase: ok ? 'completed' : 'failed',
        title: '선택 항목 저장',
        percent: 100,
        stage: ok ? '스타일 반영 완료' : '스타일 반영 실패',
        detail: ok ? `${field} 스타일을 반영했습니다.` : `${field} 스타일 반영에 실패했습니다.`,
      });
    },
    [applySelectionStyleDraft]
  );

  const applySelectionTextDraft = React.useCallback(() => {
    const root = previewRef.current;
    const activeSelectionIds = selectedFrameGroupIdsRef.current;

    if (!root || activeSelectionIds.length === 0) {
      setMessage('텍스트를 적용할 박스를 먼저 선택하세요.');
      return;
    }

    const nodes = getFrameNodes(root).filter((node) => activeSelectionIds.includes(getFrameGroupId(node)));

    if (!nodes.length) {
      return;
    }

    nodes.forEach((node) => {
      const input = node.querySelector<HTMLTextAreaElement>('[data-template-frame-input="true"]');
      if (!input) {
        return;
      }

      input.value = selectionTextDraft;
      input.textContent = selectionTextDraft;
      markTemplateValueElementEdited(input);
    });

    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
    setSelectionTextMixed(false);
    setMessage(
      activeSelectionIds.length > 1
        ? `선택한 ${activeSelectionIds.length}개 박스 텍스트를 일괄 반영했습니다.`
        : '선택 박스 텍스트를 반영했습니다.'
    );
  }, [getFrameNodes, requestPreviewTextFit, selectionTextDraft, syncDraftPreviewHtmlRef]);

  const readFrameMetadataDraftFromControls = React.useCallback((): FrameMetadataDraft => {
    const root = stylePanelRef.current;

    if (!root) {
      return frameMetadataDraft;
    }

    const readFieldValue = (field: keyof FrameMetadataDraft) => {
      const element = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-metadata-field="${field}"]`);
      return element?.value ?? frameMetadataDraft[field];
    };

    return {
      boxKind: readFieldValue('boxKind') as FrameMetadataDraft['boxKind'],
      role: readFieldValue('role') as FrameMetadataDraft['role'],
      valueKey: readFieldValue('valueKey'),
      parentGroupId: readFieldValue('parentGroupId'),
      runtimeMode: readFieldValue('runtimeMode') as FrameMetadataDraft['runtimeMode'],
    };
  }, [frameMetadataDraft]);

  const applySelectionMetadataDraft = React.useCallback((): SelectionMetadataApplyResult => {
    const root = previewRef.current;
    const activeSelectionIds = selectedFrameGroupIdsRef.current;

    if (!root || activeSelectionIds.length === 0) {
      setMessage('메타데이터를 적용할 박스를 먼저 선택하세요.');
      return {
        ok: false,
        skipped: false,
        issues: [],
      };
    }

    const nextDraft = readFrameMetadataDraftFromControls();
    const frameNodeById = new Map(
      getFrameNodes(root)
        .map((node) => [getFrameGroupId(node), node] as const)
        .filter(([frameGroupId]) => Boolean(frameGroupId))
    );
    const relationMode = metadataRelationSelectionModeRef.current;

    if (!activeSelectionIds.some((frameGroupId) => frameNodeById.has(frameGroupId))) {
      return {
        ok: false,
        skipped: false,
        issues: [],
      };
    }

    const metadataPatch = buildFrameMetadataChangePatch(nextDraft, syncedFrameMetadataDraftRef.current);
    const hasMetadataChanges = Object.values(metadataPatch).some((value) => value !== undefined);
    const relationPatchByFrameId = new Map<string, FrameMetadataPatch>();
    let hasRelationChanges = false;

    if (relationMode.kind === 'value') {
      const sourceKeyFrameGroupId = relationMode.sourceKeyFrameGroupId;
      const desiredTargetFrameGroupIds = Array.from(
        new Set(relationMode.targetFrameGroupIds.filter((frameGroupId) => frameGroupId && frameGroupId !== sourceKeyFrameGroupId))
      );
      const existingTargetFrameGroupIds = Array.from(frameNodeById.entries())
        .filter(([, node]) => readFrameParentGroupId(node) === sourceKeyFrameGroupId)
        .map(([frameGroupId]) => frameGroupId);
      const sourceNode = frameNodeById.get(sourceKeyFrameGroupId) || null;
      const derivedValueKey =
        normalizeFrameValueKey(readFrameDisplayText(sourceNode)) ||
        (sourceNode ? normalizeFrameValueKey(readFrameValueKey(sourceNode)) : '') ||
        sourceKeyFrameGroupId;

      desiredTargetFrameGroupIds.forEach((frameGroupId) => {
        relationPatchByFrameId.set(frameGroupId, {
          role: 'value',
          parentGroupId: sourceKeyFrameGroupId,
          valueKey: derivedValueKey,
        });
      });

      existingTargetFrameGroupIds
        .filter((frameGroupId) => !desiredTargetFrameGroupIds.includes(frameGroupId))
        .forEach((frameGroupId) => {
          relationPatchByFrameId.set(frameGroupId, {
            role: 'key_value',
            parentGroupId: '',
            valueKey: '',
          });
        });

      hasRelationChanges =
        !stringArraysEqual(
          existingTargetFrameGroupIds.slice().sort((left, right) => left.localeCompare(right, 'ko')),
          desiredTargetFrameGroupIds.slice().sort((left, right) => left.localeCompare(right, 'ko'))
        );
    }

    if (!hasMetadataChanges && !hasRelationChanges) {
      return {
        ok: true,
        skipped: true,
        issues: [],
      };
    }

    const autoParentPatchByFrameId = new Map<string, FrameMetadataPatch>();
    const resolvedMetadataById = new Map<string, ResolvedFrameMetadata>();
    frameNodeById.forEach((node, frameGroupId) => {
      const nextMetadata = resolveNextFrameMetadata(node, {
        ...(activeSelectionIds.includes(frameGroupId) ? metadataPatch : {}),
        ...(relationPatchByFrameId.get(frameGroupId) || {}),
      });
      const normalizedMetadata =
        nextMetadata.role === 'value'
          ? nextMetadata
          : {
              ...nextMetadata,
              parentGroupId: '',
            };
      resolvedMetadataById.set(frameGroupId, normalizedMetadata);
    });

    const keyParentsNeedingPromotion = Array.from(
      new Set(
        Array.from(resolvedMetadataById.values())
          .filter((metadata) => metadata.role === 'value' && metadata.parentGroupId)
          .map((metadata) => metadata.parentGroupId)
          .filter((parentGroupId) => {
            const parentMetadata = resolvedMetadataById.get(parentGroupId);
            return Boolean(parentMetadata && parentMetadata.boxKind !== 'text');
          })
      )
    );

    for (const parentGroupId of keyParentsNeedingPromotion) {
      const approved = confirmPromoteKeyBoxToText();

      if (!approved) {
        return {
          ok: false,
          skipped: false,
          issues: [
            {
              frameGroupId: parentGroupId,
              message: `${parentGroupId} 의 key 박스 text 보정이 취소되어 저장을 중단했습니다.`,
            },
          ],
        };
      }

      const parentMetadata = resolvedMetadataById.get(parentGroupId);

      if (!parentMetadata) {
        continue;
      }

      resolvedMetadataById.set(parentGroupId, {
        ...parentMetadata,
        boxKind: 'text',
        role: 'key',
      });
      autoParentPatchByFrameId.set(parentGroupId, {
        boxKind: 'text',
        role: 'key',
      });
    }

    const autoRuntimePatchByFrameId = new Map<string, FrameMetadataPatch>();
    const affectedFrameGroupIds = Array.from(
      new Set([...activeSelectionIds, ...Array.from(relationPatchByFrameId.keys()), ...Array.from(autoParentPatchByFrameId.keys())])
    );
    const affectedNodes = affectedFrameGroupIds
      .map((frameGroupId) => frameNodeById.get(frameGroupId) || null)
      .filter((node): node is HTMLElement => Boolean(node));

    for (const frameGroupId of affectedFrameGroupIds) {
      const nextMetadata = resolvedMetadataById.get(frameGroupId);

      if (!nextMetadata || !nextMetadata.boxKind || !nextMetadata.runtimeMode) {
        continue;
      }

      const compatibleRuntimeModes = getCompatibleRuntimeModes(nextMetadata.boxKind);

      if (compatibleRuntimeModes.includes(nextMetadata.runtimeMode)) {
        continue;
      }

      const suggestedRuntimeMode = getDefaultRuntimeMode(nextMetadata.boxKind, nextMetadata.role || 'key_value');
      const nextRuntimeMode = compatibleRuntimeModes.includes(suggestedRuntimeMode)
        ? suggestedRuntimeMode
        : compatibleRuntimeModes[0];

      if (!nextRuntimeMode) {
        continue;
      }

      const approved = confirmPromoteRuntimeMode(frameGroupId, nextMetadata.runtimeMode, nextRuntimeMode);

      if (!approved) {
        return {
          ok: false,
          skipped: false,
          issues: [
            {
              frameGroupId,
              message: `${frameGroupId} 의 runtime mode 보정이 취소되어 저장을 중단했습니다.`,
            },
          ],
        };
      }

      resolvedMetadataById.set(frameGroupId, {
        ...nextMetadata,
        runtimeMode: nextRuntimeMode,
      });
      autoRuntimePatchByFrameId.set(frameGroupId, {
        runtimeMode: nextRuntimeMode,
      });
    }

    const issues: FrameMetadataValidationIssue[] = [];

    affectedNodes.forEach((node) => {
      const frameGroupId = getFrameGroupId(node);
      const nextMetadata = resolvedMetadataById.get(frameGroupId);

      if (!nextMetadata) {
        return;
      }

      if (nextMetadata.boxKind && nextMetadata.boxKind !== 'text' && nextMetadata.role === 'key') {
        issues.push({
          frameGroupId,
          message: `${frameGroupId} 는 ${nextMetadata.boxKind} 박스라 key 역할을 가질 수 없습니다.`,
        });
      }

      if (nextMetadata.role === 'value' && !nextMetadata.parentGroupId) {
        issues.push({
          frameGroupId,
          message: `${frameGroupId} 는 value 역할이라 연결된 key 박스가 필요합니다.`,
        });
      }

      if (
        nextMetadata.parentGroupId &&
        !availableFrameGroupIds.includes(nextMetadata.parentGroupId) &&
        !virtualDefinitionIds.has(nextMetadata.parentGroupId)
      ) {
        issues.push({
          frameGroupId,
          message: `${frameGroupId} 의 key 박스 ${nextMetadata.parentGroupId} 를 찾을 수 없습니다.`,
        });
      }

      if (nextMetadata.parentGroupId === frameGroupId) {
        issues.push({
          frameGroupId,
          message: `${frameGroupId} 는 자기 자신을 key 박스로 가질 수 없습니다.`,
        });
      }

      if (nextMetadata.role === 'value' && nextMetadata.parentGroupId) {
        const parentMetadata = resolvedMetadataById.get(nextMetadata.parentGroupId) || null;
        const isVirtualParent = virtualDefinitionIds.has(nextMetadata.parentGroupId);

        if (!parentMetadata && !isVirtualParent) {
          issues.push({
            frameGroupId,
            message: `${frameGroupId} 의 key 박스 ${nextMetadata.parentGroupId} 를 찾을 수 없습니다.`,
          });
        } else if (parentMetadata && !isVirtualParent && (parentMetadata.boxKind !== 'text' || parentMetadata.role !== 'key')) {
          issues.push({
            frameGroupId,
            message: `${frameGroupId} 의 key 박스 ${nextMetadata.parentGroupId} 는 text key 박스여야 합니다.`,
          });
        }
      }

      if (
        nextMetadata.parentGroupId &&
        !virtualDefinitionIds.has(nextMetadata.parentGroupId) &&
        hasResolvedFrameParentCycle(frameGroupId, nextMetadata.parentGroupId, resolvedMetadataById)
      ) {
        issues.push({
          frameGroupId,
          message: `${frameGroupId} 의 key 연결에 순환 참조가 있습니다.`,
        });
      }

      if (
        nextMetadata.boxKind &&
        nextMetadata.runtimeMode &&
        !getCompatibleRuntimeModes(nextMetadata.boxKind).includes(nextMetadata.runtimeMode)
      ) {
        issues.push({
          frameGroupId,
          message: `${frameGroupId} 의 runtime mode ${nextMetadata.runtimeMode} 는 ${nextMetadata.boxKind} 박스와 호환되지 않습니다.`,
        });
      }
    });

    if (issues.length > 0) {
      return {
        ok: false,
        skipped: false,
        issues,
      };
    }

    affectedNodes.forEach((node) => {
      const frameGroupId = getFrameGroupId(node);
      const nextMetadata = resolvedMetadataById.get(frameGroupId);
      const mergedPatch = {
        ...(activeSelectionIds.includes(frameGroupId) ? metadataPatch : {}),
        ...(relationPatchByFrameId.get(frameGroupId) || {}),
        ...(autoParentPatchByFrameId.get(frameGroupId) || {}),
        ...(autoRuntimePatchByFrameId.get(frameGroupId) || {}),
      };

      if (!nextMetadata) {
        return;
      }

      applyFrameMetadataPatch(node, {
        boxKind: mergedPatch.boxKind,
        role: mergedPatch.role,
        valueKey: nextMetadata.valueKey,
        parentGroupId:
          mergedPatch.parentGroupId !== undefined || mergedPatch.role !== undefined
            ? nextMetadata.role === 'value'
              ? nextMetadata.parentGroupId
              : ''
            : undefined,
        runtimeMode: nextMetadata.runtimeMode || '',
      });
    });

    syncFrameRelationshipValueKeys(root, resolvedMetadataById);
    syncDraftPreviewHtmlRef();
    syncFrameMetadataDraft();
    if (relationMode.kind === 'value') {
      setMetadataRelationSelectionMode({ kind: 'idle' });
    }
    requestPreviewTextFit();
    return {
      ok: true,
      skipped: false,
      issues: [],
    };
  }, [
    availableFrameGroupIds,
    getFrameNodes,
    readFrameMetadataDraftFromControls,
    requestPreviewTextFit,
    syncDraftPreviewHtmlRef,
    syncFrameMetadataDraft,
    virtualDefinitionIds,
  ]);

  React.useEffect(() => {
    if (selectionPanelTab !== 'metadata') {
      return;
    }

    if (selectedFrameGroupIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectionSaveProgress({
        phase: 'running',
        title: '선택 항목 저장',
        percent: 30,
        stage: '메타데이터 반영 중',
        detail: '메타데이터 변경을 자동 반영하고 있습니다.',
      });
      const metadataResult = applySelectionMetadataDraft();

      if (!metadataResult.ok) {
        setSelectionValidationIssues(metadataResult.issues);
        setSelectionSaveProgress({
          phase: 'failed',
          title: '선택 항목 저장',
          percent: 100,
          stage: '메타데이터 반영 실패',
          detail: '메타데이터 자동 반영에 실패했습니다.',
        });
        return;
      }

      setSelectionValidationIssues([]);
      setSelectionSaveProgress({
        phase: 'completed',
        title: '선택 항목 저장',
        percent: 100,
        stage: metadataResult.skipped ? '변경 없음' : '메타데이터 반영 완료',
        detail: metadataResult.skipped ? '반영할 메타데이터 변경이 없습니다.' : '메타데이터를 자동 반영했습니다.',
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [applySelectionMetadataDraft, frameMetadataDraft, selectedFrameGroupIds, selectionPanelTab]);

  const applySelectionPanelDrafts = React.useCallback(async () => {
    const activeSelectionIds = selectedFrameGroupIdsRef.current;

    if (activeSelectionIds.length === 0) {
      setMessage('저장할 박스를 먼저 선택하세요.');
      setSelectionSaveProgress({
        phase: 'failed',
        title: '선택 항목 저장',
        percent: 100,
        stage: '선택 박스가 없습니다.',
        detail: '박스 편집 캔버스에서 먼저 박스를 선택한 뒤 다시 저장하세요.',
      });
      return;
    }

    setSelectionValidationIssues([]);
    setSelectionSaveProgress({
      phase: 'running',
      title: '선택 항목 저장',
      percent: 12,
      stage: '선택 박스 확인 중',
      detail: `${activeSelectionIds.length}개 박스의 메타데이터와 스타일 저장 가능 여부를 확인하고 있습니다.`,
    });
    await waitForNextPaint();

    const metadataResult = applySelectionMetadataDraft();

    if (!metadataResult.ok) {
      const issues = metadataResult.issues;
      const errorCount = issues.length;
      setSelectionValidationIssues(issues);
      setSelectionSaveProgress({
        phase: 'failed',
        title: '선택 항목 저장',
        percent: 100,
        stage: '메타데이터 저장 실패',
        detail:
          errorCount > 0
            ? `${errorCount}개 오류를 모두 수집했습니다. 빨간 박스와 상세 사유를 확인하세요.`
            : '메타데이터를 저장할 수 없습니다.',
      });
      setMessage(
        errorCount > 0
          ? `메타데이터 저장 실패: ${errorCount}개 오류를 모두 확인했습니다.`
          : '메타데이터 저장에 실패했습니다.'
      );
      return;
    }

    setSelectionValidationIssues([]);
    setSelectionSaveProgress({
      phase: 'running',
      title: '선택 항목 저장',
      percent: metadataResult.skipped ? 52 : 58,
      stage: metadataResult.skipped ? '메타데이터 변경 없음' : '메타데이터 반영 중',
      detail: metadataResult.skipped
        ? '메타데이터 변경은 없어 스타일 저장 단계로 바로 넘어갑니다.'
        : '선택한 박스의 메타데이터를 캔버스에 반영했습니다.',
    });
    await waitForNextPaint();

    setSelectionSaveProgress({
      phase: 'running',
      title: '선택 항목 저장',
      percent: 82,
      stage: '스타일 반영 중',
      detail: `${activeSelectionIds.length}개 박스의 스타일을 일괄 적용하고 있습니다.`,
    });
    await waitForNextPaint();

    if (!applySelectionStyleDraft()) {
      setSelectionSaveProgress({
        phase: 'failed',
        title: '선택 항목 저장',
        percent: 100,
        stage: '스타일 저장 실패',
        detail: '스타일을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도하세요.',
      });
      return;
    }

    setSelectionSaveProgress({
      phase: 'completed',
      title: '선택 항목 저장',
      percent: 100,
      stage: '선택 항목 저장 완료',
      detail:
        activeSelectionIds.length > 1
          ? `선택한 ${activeSelectionIds.length}개 박스에 메타데이터와 스타일을 반영했습니다.`
          : '선택 박스의 메타데이터와 스타일을 반영했습니다.',
    });
    setMessage(
      activeSelectionIds.length > 1
        ? `선택한 ${activeSelectionIds.length}개 박스에 설정을 일괄 반영했습니다.`
        : '선택 박스 설정을 반영했습니다.'
    );
  }, [applySelectionMetadataDraft, applySelectionStyleDraft, waitForNextPaint]);

  const stageSelectionStylePreset = React.useCallback((preset: FrameStylePatch) => {
    setSelectionStyleDraft((previous) => ({
      ...previous,
      fontSize: preset.fontSize ?? previous.fontSize,
      lineHeight: preset.lineHeight ?? previous.lineHeight,
      paddingX: preset.paddingX ?? previous.paddingX,
      paddingY: preset.paddingY ?? previous.paddingY,
      borderRadius: preset.borderRadius ?? previous.borderRadius,
      fontWeight: preset.fontWeight ?? previous.fontWeight,
      textAlign:
        preset.textAlign === 'left' ||
        preset.textAlign === 'center' ||
        preset.textAlign === 'right' ||
        preset.textAlign === 'justify'
          ? preset.textAlign
          : previous.textAlign,
      color: preset.color ?? previous.color,
      backgroundColor: preset.backgroundColor ?? previous.backgroundColor,
    }));
  }, []);

  const renderStyleApplyStatusIcon = React.useCallback(
    (field: StyleFieldKey) => {
      const status = styleFieldApplyStatus[field];

      if (status === 'saving') {
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" aria-label="반영 중" />;
      }

      if (status === 'saved') {
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="반영 완료" />;
      }

      return null;
    },
    [styleFieldApplyStatus]
  );

  const applyPrimaryFramePositionMode = React.useCallback(
    (nextMode: TemplateFramePositionMode) => {
      const root = previewRef.current;
      const primaryFrameGroupId = readSingleFrameGroupId(selectedFrameGroupIdsRef.current);

      if (!root || !primaryFrameGroupId) {
        return;
      }

      const frameNode = resolveFrameSelectionAnchor(
        root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${primaryFrameGroupId}"]`)
      );
      const pageInner = frameNode?.closest<HTMLElement>('.page-inner') || null;

      if (!frameNode || !pageInner) {
        return;
      }

      applyFramePositionMode(frameNode, nextMode, pageInner);
      ensureRelativeAnchorConfigs(root);
      applyRelativeAnchoredFrameRectsInRoot(root);
      normalizeLiveVerticalCohorts(root);
      const snapshot = buildLiveEdgeTopologySnapshot(root);
      applyFrameSelectionUi(
        root,
        selectedFrameGroupIdsRef.current,
        edgeSelectionStateRef.current,
        snapshot,
        resolveEdgeRolePresentation(snapshot, edgeSelectionStateRef.current).edgeRoleById,
        edgeRoleDiagnostics.mismatchEdgeIds,
        previewRelativeGuideFrameGroupId,
        resolvePositionGroupProxySelections(
          selectedFrameGroupIdsRef.current,
          positionGroupProxySelectionGroupIdRef.current
        )
      );
      applyPositionImpactGroupSelectionUi(root, selectionPanelTab, selectedFrameGroupIdsRef.current, positionRelationAnchorFrameGroupId);
      applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
      applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
      setSelectedFrameGroupIds(selectedFrameGroupIdsRef.current.slice());
      syncDraftPreviewHtmlRef();
      syncSelectionStyleDraft();
      requestPreviewTextFit();
    },
    [
      buildLiveEdgeTopologySnapshot,
      edgeRoleDiagnostics.mismatchEdgeIds,
      normalizeLiveVerticalCohorts,
      previewRelativeGuideFrameGroupId,
      requestPreviewTextFit,
      resolveEdgeRolePresentation,
      resolvePositionGroupProxySelections,
      syncDraftPreviewHtmlRef,
      syncSelectionStyleDraft,
      positionRelationAnchorFrameGroupId,
      selectionPanelTab,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
    ]
  );
  const clearSelectedRelativeFramePositions = React.useCallback(() => {
    const root = previewRef.current;
    const selectedIds = Array.from(
      new Set(
        selectedFrameGroupIdsRef.current
          .map((frameGroupId) => frameGroupId.trim())
          .filter((frameGroupId) => Boolean(frameGroupId))
      )
    );

    if (!root || selectedIds.length <= 0) {
      setMessage('먼저 박스를 선택하세요.');
      return;
    }

    let clearedCount = 0;
    let skippedCount = 0;

    selectedIds.forEach((frameGroupId) => {
      const frameNode = resolveFrameSelectionAnchor(
        root.querySelector<HTMLElement>(`${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`)
      );
      const pageInner = frameNode?.closest<HTMLElement>('.page-inner') || null;

      if (!frameNode || !pageInner) {
        skippedCount += 1;
        return;
      }

      if (readFramePositionMode(frameNode, pageInner) !== 'relative') {
        return;
      }

      applyFramePositionMode(frameNode, 'absolute', pageInner);
      clearedCount += 1;
    });

    if (clearedCount <= 0) {
      setMessage('선택한 박스 중 상대 위치가 설정된 항목이 없습니다.');
      return;
    }

    ensureRelativeAnchorConfigs(root);
    applyRelativeAnchoredFrameRectsInRoot(root);
    normalizeLiveVerticalCohorts(root);
    const snapshot = buildLiveEdgeTopologySnapshot(root);
    applyFrameSelectionUi(
      root,
      selectedFrameGroupIdsRef.current,
      edgeSelectionStateRef.current,
      snapshot,
      resolveEdgeRolePresentation(snapshot, edgeSelectionStateRef.current).edgeRoleById,
      edgeRoleDiagnostics.mismatchEdgeIds,
      previewRelativeGuideFrameGroupId,
      resolvePositionGroupProxySelections(
        selectedFrameGroupIdsRef.current,
        positionGroupProxySelectionGroupIdRef.current
      )
    );
    applyPositionImpactGroupSelectionUi(root, selectionPanelTab, selectedFrameGroupIdsRef.current, positionRelationAnchorFrameGroupId);
    applyDefinedPositionRelativeRelationUi(root, selectionPanelTab, focusedDefinedPositionRelativeRelations);
    applyPositionSpacingGuideUi(root, selectionPanelTab, positionSpacingGuideRelations);
    setSelectedFrameGroupIds(selectedFrameGroupIdsRef.current.slice());
    syncDraftPreviewHtmlRef();
    syncSelectionStyleDraft();
    requestPreviewTextFit();
    setMessage(
      `선택한 ${clearedCount}개 박스의 상대 위치를 해제했습니다.` +
        (skippedCount > 0 ? ` (${skippedCount}개 제외)` : '')
    );
  }, [
    buildLiveEdgeTopologySnapshot,
    edgeRoleDiagnostics.mismatchEdgeIds,
    normalizeLiveVerticalCohorts,
    previewRelativeGuideFrameGroupId,
    requestPreviewTextFit,
    resolveEdgeRolePresentation,
    resolvePositionGroupProxySelections,
    selectionPanelTab,
    positionRelationAnchorFrameGroupId,
    focusedDefinedPositionRelativeRelations,
    positionSpacingGuideRelations,
    syncDraftPreviewHtmlRef,
    syncSelectionStyleDraft,
  ]);

  const getResizeShellAnchorId = React.useCallback((shell: HTMLElement, fallbackNode?: HTMLElement | null) => {
    const shellAnchorNode = shell.querySelector<HTMLElement>(RAW_FRAME_NODE_SELECTOR) || fallbackNode || null;
    const shellAnchorId = shellAnchorNode ? getFrameGroupId(shellAnchorNode) : '';

    return shellAnchorId || `shell:${shell.style.left}:${shell.style.top}:${shell.style.width}:${shell.style.height}`;
  }, []);

  const serializeBoundaryShrinkRange = React.useCallback(
    (range?: BoundaryShrinkRange) =>
      range ? `${range.startIndex}:${range.endIndex}:${range.side}` : 'none',
    []
  );

  const buildWidthInstructionKey = React.useCallback(
    (instruction: FrameWidthResizeInstruction, fallbackNode?: HTMLElement | null) => {
      const shellAnchorId = getResizeShellAnchorId(instruction.shell, fallbackNode);

      if (instruction.kind === 'boundary') {
        return [
          shellAnchorId,
          instruction.kind,
          instruction.boundaryIndex,
          serializeBoundaryShrinkRange(instruction.shrinkRange),
        ].join('|');
      }

      return [
        shellAnchorId,
        instruction.kind,
        serializeBoundaryShrinkRange(instruction.shrinkRange),
        serializeBoundaryShrinkRange(instruction.minimumStopRange),
      ].join('|');
    },
    [getResizeShellAnchorId, serializeBoundaryShrinkRange]
  );

  const buildEdgeResizeHandleId = React.useCallback(
    (
      node: HTMLElement,
      shell: HTMLElement,
      orientation: TemplateEdgeDescriptorDto['orientation'],
      side: TemplateEdgeSide,
      boundaryIndex: number | null
    ) => {
      const shellAnchorId = getResizeShellAnchorId(shell, node);
      const boundaryKey =
        boundaryIndex === null
          ? orientation === 'vertical'
            ? side === 'left'
              ? 'start'
              : 'end'
            : side === 'top'
              ? 'start'
              : 'end'
          : String(boundaryIndex);

      return `${shellAnchorId}:${orientation}:${boundaryKey}`;
    },
    [getResizeShellAnchorId]
  );

  const collectDirectRoleResizeTargets = React.useCallback(
    (root: HTMLElement, snapshot: TemplateEdgeTopologySnapshotDto, edgeIds: string[]) => {
      const handleMap = new Map<string, EdgeResizeTarget>();

      Array.from(new Set(edgeIds)).forEach((edgeId) => {
        const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

        if (!edge) {
          return;
        }

        const node = getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === edge.frameGroupId) || null;

        if (!node) {
          return;
        }

        const context = buildFrameResizeContext(node);
        const widthInstruction =
          edge.side === 'left' || edge.side === 'right'
            ? buildSelfWidthResizeInstruction(context, edge.side)
            : null;
        const boundaryIndex =
          edge.side === 'left'
            ? context.startColIndex
            : edge.side === 'right'
              ? context.endColIndex
              : edge.side === 'top'
                ? context.startRowIndex
                : context.endRowIndex;
        const member: EdgeResizeTargetMember = {
          handleId: buildEdgeResizeHandleId(
            node,
            context.shell,
            edge.orientation,
            edge.side,
            context.singleCellBand ? null : boundaryIndex
          ),
          edgeId: edge.edgeId,
          node,
          shell: context.shell,
          orientation: edge.orientation,
          side: edge.side,
          lineCoordinate: edge.lineCoordinate,
          spanStart: edge.spanStart,
          spanEnd: edge.spanEnd,
          boundaryIndex: context.singleCellBand ? null : boundaryIndex,
          widthInstructions: widthInstruction ? [widthInstruction] : undefined,
        };
        const existingTarget = handleMap.get(member.handleId);

        if (existingTarget) {
          if (!existingTarget.members.some((existingMember) => existingMember.edgeId === member.edgeId)) {
            existingTarget.members.push(member);
          }

          const mergedInstructions = [...(existingTarget.widthInstructions || []), ...(member.widthInstructions || [])];
          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
          mergedInstructions.forEach((instruction) => {
            uniqueInstructions.set(buildWidthInstructionKey(instruction, member.node), instruction);
          });
          existingTarget.widthInstructions = Array.from(uniqueInstructions.values());
          return;
        }

        handleMap.set(member.handleId, {
          handleId: member.handleId,
          node,
          shell: context.shell,
          orientation: edge.orientation,
          boundaryIndex: member.boundaryIndex,
          hasOppositePeer: false,
          widthInstructions: member.widthInstructions ? member.widthInstructions.slice() : undefined,
          members: [member],
          physicalPeerMembers: [],
        });
      });

      const groupedTargets = Array.from(handleMap.values());

      return groupedTargets.map((target, targetIndex) => ({
        ...target,
        physicalPeerMembers: groupedTargets
          .flatMap((candidateTarget, candidateIndex) => {
            if (candidateIndex === targetIndex) {
              return [];
            }

            if (
              !target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
            ) {
              return [];
            }

            return candidateTarget.members;
          })
          .filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          ),
        hasOppositePeer:
          target.hasOppositePeer ||
          target.members.some((member, memberIndex) =>
            target.members.some(
              (candidateMember, candidateIndex) =>
                candidateIndex !== memberIndex && targetsSharePhysicalBoundary(member, candidateMember)
            )
          ) ||
          groupedTargets.some(
            (candidateTarget, candidateIndex) =>
              candidateIndex !== targetIndex &&
              target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
          ),
      }));
    },
    [buildEdgeResizeHandleId, buildWidthInstructionKey, getFrameNodes]
  );

  const collectEdgeResizeTargets = React.useCallback(
    (root: HTMLElement, snapshot: TemplateEdgeTopologySnapshotDto, mutationEdgeIds: string[]) => {
      const handleMap = new Map<string, EdgeResizeTarget>();
      const seedEdgeIds = Array.from(
        new Set(
          mutationEdgeIds.flatMap((edgeId) => [edgeId, ...TemplateEdgeTopologyService.getPhysicalPeerEdgeIds(snapshot, edgeId)])
        )
      );
      const closureEdgeIds = Array.from(
        new Set([
          ...seedEdgeIds,
          ...seedEdgeIds.flatMap((edgeId) => {
            const sourceEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

            if (!sourceEdge) {
              return [];
            }

            return snapshot.edges
              .filter((candidate) => edgesSharePhysicalBoundary(sourceEdge, candidate))
              .map((candidate) => candidate.edgeId);
          }),
        ])
      );

      const buildTargetFromEdgeId = (edgeId: string): EdgeResizeTargetMember | null => {
        const edge = TemplateEdgeTopologyService.getEdgeById(snapshot, edgeId);

        if (!edge) {
          return null;
        }

        const node =
          getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === edge.frameGroupId) || null;

        if (!node) {
          return;
        }

        const context = buildFrameResizeContext(node);
        const boundaryIndex =
          edge.side === 'left'
            ? context.startColIndex
            : edge.side === 'right'
              ? context.endColIndex
              : edge.side === 'top'
                ? context.startRowIndex
                : context.endRowIndex;
        const widthInstruction =
          edge.side === 'left' || edge.side === 'right'
            ? buildSelfWidthResizeInstruction(context, edge.side)
            : null;
        return {
          handleId: buildEdgeResizeHandleId(
            node,
            context.shell,
            edge.orientation,
            edge.side,
            context.singleCellBand ? null : boundaryIndex
          ),
          edgeId: edge.edgeId,
          node,
          shell: context.shell,
          orientation: edge.orientation,
          side: edge.side,
          lineCoordinate: edge.lineCoordinate,
          spanStart: edge.spanStart,
          spanEnd: edge.spanEnd,
          boundaryIndex: context.singleCellBand ? null : boundaryIndex,
          widthInstructions: widthInstruction ? [widthInstruction] : undefined,
        };
      };

      const addTargetMember = (member: EdgeResizeTargetMember | null) => {
        if (!member) {
          return;
        }

        const existingHandle = handleMap.get(member.handleId);

        if (existingHandle) {
          if (!existingHandle.members.some((existingMember) => existingMember.edgeId === member.edgeId)) {
            existingHandle.members.push(member);
          }

          const mergedInstructions = [...(existingHandle.widthInstructions || []), ...(member.widthInstructions || [])];
          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();

          mergedInstructions.forEach((instruction) => {
            uniqueInstructions.set(buildWidthInstructionKey(instruction, member.node), instruction);
          });

          existingHandle.widthInstructions = Array.from(uniqueInstructions.values());
          existingHandle.hasOppositePeer =
            existingHandle.hasOppositePeer ||
            existingHandle.members.some(
              (existingMember) =>
                existingMember.edgeId !== member.edgeId && targetsSharePhysicalBoundary(existingMember, member)
            );
          return;
        }

        handleMap.set(member.handleId, {
          handleId: member.handleId,
          node: member.node,
          shell: member.shell,
          orientation: member.orientation,
          boundaryIndex: member.boundaryIndex,
          hasOppositePeer: false,
          widthInstructions: member.widthInstructions ? member.widthInstructions.slice() : undefined,
          members: [member],
          physicalPeerMembers: [],
        });
      };

      closureEdgeIds.forEach((edgeId) => {
        addTargetMember(buildTargetFromEdgeId(edgeId));
      });

      Array.from(handleMap.values())
        .flatMap((target) => target.members)
        .forEach((target) => {
          const oppositeSide =
          target.side === 'left'
            ? 'right'
            : target.side === 'right'
              ? 'left'
              : target.side === 'top'
                ? 'bottom'
                : 'top';

        getFrameNodes(root).forEach((node) => {
          const frameGroupId = getFrameGroupId(node);

          if (!frameGroupId) {
            return;
          }

          const candidateTarget = buildTargetFromEdgeId(`${frameGroupId}:${oppositeSide}`);

          if (!candidateTarget || !targetsSharePhysicalBoundary(target, candidateTarget)) {
            return;
          }

          addTargetMember(candidateTarget);
        });
      });

      const groupedTargets = Array.from(handleMap.values());

      return groupedTargets.map((target, targetIndex) => ({
        ...target,
        physicalPeerMembers: groupedTargets
          .flatMap((candidateTarget, candidateIndex) => {
            if (candidateIndex === targetIndex) {
              return [];
            }

            if (
              !target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
            ) {
              return [];
            }

            return candidateTarget.members;
          })
          .filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          ),
        hasOppositePeer:
          target.hasOppositePeer ||
          target.members.some((member, memberIndex) =>
            target.members.some(
              (candidateMember, candidateIndex) =>
                candidateIndex !== memberIndex && targetsSharePhysicalBoundary(member, candidateMember)
            )
          ) ||
          groupedTargets.some(
            (candidateTarget, candidateIndex) =>
              candidateIndex !== targetIndex &&
              target.members.some((member) =>
                candidateTarget.members.some((candidateMember) => targetsSharePhysicalBoundary(member, candidateMember))
              )
          ),
      }));
    },
    [buildEdgeResizeHandleId, buildWidthInstructionKey, getFrameNodes]
  );

  const resolveLiveEdgeResizeTargets = React.useCallback(
    (root: HTMLElement, snapshot: TemplateEdgeTopologySnapshotDto, mutationEdgeIds: string[]) => {
      const directRoleResizeTargets = collectDirectRoleResizeTargets(root, snapshot, mutationEdgeIds);

      if (directRoleResizeTargets.length > 0) {
        return directRoleResizeTargets;
      }

      return collectEdgeResizeTargets(root, snapshot, mutationEdgeIds);
    },
    [collectDirectRoleResizeTargets, collectEdgeResizeTargets]
  );

  const refreshLockedEdgeResizeTargets = React.useCallback(
    (root: HTMLElement, snapshot: TemplateEdgeTopologySnapshotDto, lockedTargets: EdgeResizeTarget[]) => {
      const liveNodes = getFrameNodes(root);

      return lockedTargets
        .map((lockedTarget) => {
          const refreshMember = (member: EdgeResizeTargetMember): EdgeResizeTargetMember | null => {
            const liveEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, member.edgeId);

            if (!liveEdge) {
              return null;
            }

            const node =
              liveNodes.find((candidate) => getFrameGroupId(candidate) === liveEdge.frameGroupId) || member.node;
            const context = buildFrameResizeContext(node);
            const boundaryIndex =
              liveEdge.side === 'left'
                ? context.startColIndex
                : liveEdge.side === 'right'
                  ? context.endColIndex
                  : liveEdge.side === 'top'
                    ? context.startRowIndex
                    : context.endRowIndex;
            const widthInstruction =
              liveEdge.side === 'left' || liveEdge.side === 'right'
                ? buildSelfWidthResizeInstruction(context, liveEdge.side)
                : null;

            return {
              ...member,
              node,
              shell: context.shell,
              lineCoordinate: liveEdge.lineCoordinate,
              spanStart: liveEdge.spanStart,
              spanEnd: liveEdge.spanEnd,
              boundaryIndex: context.singleCellBand ? null : boundaryIndex,
              widthInstructions: widthInstruction ? [widthInstruction] : undefined,
            };
          };

          const members = lockedTarget.members
            .map((member) => refreshMember(member))
            .filter((member): member is EdgeResizeTargetMember => Boolean(member));
          const physicalPeerMembers = lockedTarget.physicalPeerMembers
            .map((member) => refreshMember(member))
            .filter((member): member is EdgeResizeTargetMember => Boolean(member));

          if (members.length === 0) {
            return null;
          }

          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
          members
            .flatMap((member) => member.widthInstructions || [])
            .forEach((instruction) => {
              uniqueInstructions.set(buildWidthInstructionKey(instruction, members[0]?.node || lockedTarget.node), instruction);
            });

          return {
            ...lockedTarget,
            node: members[0]?.node || lockedTarget.node,
            shell: members[0]?.shell || lockedTarget.shell,
            boundaryIndex: members[0]?.boundaryIndex ?? lockedTarget.boundaryIndex,
            widthInstructions: Array.from(uniqueInstructions.values()),
            members,
            physicalPeerMembers,
            hasOppositePeer:
              lockedTarget.hasOppositePeer ||
              members.some((member) =>
                physicalPeerMembers.some((peerMember) => targetsSharePhysicalBoundary(member, peerMember))
              ),
          };
        })
        .filter(Boolean) as EdgeResizeTarget[];
    },
    [buildWidthInstructionKey, getFrameNodes]
  );

  const resolveResizeStateVerticalTargetLineCoordinate = React.useCallback(
    (
      resizeState: ResizeState,
      edgeIdGroup: string[],
      liveSnapshot: TemplateEdgeTopologySnapshotDto,
      fallbackReferenceEdgeId?: string | null
    ) => {
      const baselineReferenceEdgeId = edgeIdGroup[0];
      const baselineLineCoordinate = resizeState.edgeLineCoordinateBaseline?.[baselineReferenceEdgeId];
      const appliedEdgeDeltaX = resizeState.appliedEdgeDeltaX;

      if (typeof baselineLineCoordinate === 'number' && typeof appliedEdgeDeltaX === 'number') {
        return baselineLineCoordinate + appliedEdgeDeltaX;
      }

      const fallbackLiveEdge = fallbackReferenceEdgeId
        ? TemplateEdgeTopologyService.getEdgeById(liveSnapshot, fallbackReferenceEdgeId)
        : null;

      return fallbackLiveEdge?.lineCoordinate ?? null;
    },
    []
  );

  const realignLiveVerticalEdgeTargets = React.useCallback(
    (root: HTMLElement, resizeState: ResizeState) => {
      if (!resizeState.edgeResizeTargets?.length) {
        return;
      }

      const uniqueMembers = resizeState.edgeResizeTargets
        .flatMap((edgeTarget) => [...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
        .filter(
          (member, memberIndex, members) =>
            members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          )
        .filter((member) => member.orientation === 'vertical' && (member.widthInstructions?.length || 0) > 0);

      if (uniqueMembers.length === 0) {
        return;
      }

      const exactBoundaryMemberGroups = groupExactPhysicalBoundaryEdgeIds(
        resizeState.edgeDragSnapshot || buildLiveEdgeTopologySnapshot(root),
        uniqueMembers.map((member) => member.edgeId),
        resizeState.edgeRoleById
      );
      const clusterSeedMembers = exactBoundaryMemberGroups
        .map((edgeIdGroup) =>
          uniqueMembers.find((member) => member.edgeId === edgeIdGroup[0]) || null
        )
        .filter((member): member is EdgeResizeTargetMember => Boolean(member));

      const clusters = clusterItemsByCoordinate(
        clusterSeedMembers,
        (member) => resizeState.edgeLineCoordinateBaseline?.[member.edgeId] ?? member.lineCoordinate,
        FRAME_RESIZE_TOLERANCE_PX
      );

      for (let pass = 0; pass < 4; pass += 1) {
        clusters.forEach((clusterMembers) => {
          const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
          const clusterGroups = clusterMembers.map((clusterMember) =>
            exactBoundaryMemberGroups.find((edgeIdGroup) => edgeIdGroup.includes(clusterMember.edgeId)) || [
              clusterMember.edgeId,
            ]
          );
          const referenceMember =
            clusterMembers.find(
              (member) => resizeState.edgeRoleById?.[member.edgeId] === 'selected_edge_clicked'
            ) || clusterMembers[0];

          if (!referenceMember) {
            return;
          }

          const referenceGroup =
            exactBoundaryMemberGroups.find((edgeIdGroup) => edgeIdGroup.includes(referenceMember.edgeId)) || [
              referenceMember.edgeId,
            ];
          const expectedLineCoordinate = resolveResizeStateVerticalTargetLineCoordinate(
            resizeState,
            referenceGroup,
            liveSnapshot,
            referenceMember.edgeId
          );

          if (!Number.isFinite(expectedLineCoordinate)) {
            return;
          }

          clusterGroups.forEach((edgeIdGroup) => {
            edgeIdGroup.forEach((edgeId) => {
              const member = uniqueMembers.find((candidateMember) => candidateMember.edgeId === edgeId);
              const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId);

              if (!member || !liveEdge) {
                return;
              }

              const correctionDelta = expectedLineCoordinate - liveEdge.lineCoordinate;
              const freshInstruction =
                member.side === 'left' || member.side === 'right'
                  ? buildSelfWidthResizeInstruction(buildFrameResizeContext(member.node), member.side)
                  : null;
              const liveWidthInstructions = freshInstruction ? [freshInstruction] : member.widthInstructions || [];

              if (Math.abs(correctionDelta) <= 0.05 || liveWidthInstructions.length === 0) {
                return;
              }

              applyFrameResizeWidthDelta(member.node, correctionDelta, liveWidthInstructions);
            });
          });
        });
      }
    },
    [buildLiveEdgeTopologySnapshot, resolveResizeStateVerticalTargetLineCoordinate]
  );

  const stabilizeLiveVerticalEdgeTargetsToAppliedDelta = React.useCallback(
    (root: HTMLElement, resizeState: ResizeState, nextAppliedDeltaX: number) => {
      if (!resizeState.edgeResizeTargets?.length || Math.abs(nextAppliedDeltaX) < 0.5) {
        return;
      }

      const expectedEdgeIds = (Object.keys(resizeState.edgeRoleById || {}).length > 0
        ? Object.keys(resizeState.edgeRoleById || {})
        : resizeState.mutationEdgeIds || []
      ).filter((edgeId) => resizeState.edgeLineCoordinateBaseline?.[edgeId] !== undefined);

      if (expectedEdgeIds.length === 0) {
        return;
      }

      const normalizedExpectedEdgeGroups = groupExactPhysicalBoundaryEdgeIds(
        resizeState.edgeDragSnapshot || buildLiveEdgeTopologySnapshot(root),
        expectedEdgeIds,
        resizeState.edgeRoleById
      );

      for (let pass = 0; pass < 4; pass += 1) {
        const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
        const liveResizeTargets = refreshLockedEdgeResizeTargets(root, liveSnapshot, resizeState.edgeResizeTargets || []);
        const liveWidthInstructionsByEdgeId = new Map<string, FrameWidthResizeInstruction[]>();

        liveResizeTargets.forEach((edgeTarget) => {
          [...edgeTarget.members, ...edgeTarget.physicalPeerMembers].forEach((member) => {
            if ((member.widthInstructions || []).length > 0) {
              liveWidthInstructionsByEdgeId.set(member.edgeId, member.widthInstructions || []);
            }
          });
        });
        let corrected = false;

        normalizedExpectedEdgeGroups.forEach((edgeIdGroup) => {
          const baselineReferenceEdgeId = edgeIdGroup[0];
          const baselineLineCoordinate = resizeState.edgeLineCoordinateBaseline?.[baselineReferenceEdgeId];

          if (typeof baselineLineCoordinate !== 'number') {
            return;
          }

          const targetLineCoordinate = baselineLineCoordinate + nextAppliedDeltaX;

          edgeIdGroup.forEach((edgeId) => {
            const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId);

            if (!liveEdge || (liveEdge.side !== 'left' && liveEdge.side !== 'right')) {
              return;
            }

            const correctionDelta = targetLineCoordinate - liveEdge.lineCoordinate;

            if (Math.abs(correctionDelta) <= 0.05) {
              return;
            }

            const node =
              getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === liveEdge.frameGroupId) || null;

            if (!node) {
              return;
            }

            const liveWidthInstructions = liveWidthInstructionsByEdgeId.get(edgeId);
            const widthInstruction =
              liveWidthInstructions && liveWidthInstructions.length > 0
                ? liveWidthInstructions[0]
                : buildSelfWidthResizeInstruction(buildFrameResizeContext(node), liveEdge.side);

            if (!widthInstruction) {
              return;
            }

            applyFrameResizeWidthDelta(
              node,
              correctionDelta,
              liveWidthInstructions && liveWidthInstructions.length > 0 ? liveWidthInstructions : [widthInstruction]
            );
            corrected = true;
          });
        });

        if (!corrected) {
          break;
        }
      }
    },
    [buildLiveEdgeTopologySnapshot, getFrameNodes, refreshLockedEdgeResizeTargets]
  );

  const syncLiveAppliedEdgeDeltas = React.useCallback(
    (root: HTMLElement, resizeState: ResizeState) => {
      const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
      const preferredEdgeIds =
        Object.keys(resizeState.edgeRoleById || {}).length > 0
          ? Object.keys(resizeState.edgeRoleById || {})
          : resizeState.mutationEdgeIds || [];
      const resolveReferenceEdgeId = (orientation: TemplateEdgeDescriptorDto['orientation']) =>
        preferredEdgeIds.find((edgeId) => {
          const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId);

          return (
            liveEdge?.orientation === orientation &&
            resizeState.edgeRoleById?.[edgeId] === 'selected_edge_clicked'
          );
        }) ||
        preferredEdgeIds.find((edgeId) => TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId)?.orientation === orientation) ||
        resizeState.edgeResizeTargets
          ?.flatMap((edgeTarget) => [...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .find((member) => member.orientation === orientation)?.edgeId ||
        null;

      const verticalReferenceEdgeId = resolveReferenceEdgeId('vertical');
      const horizontalReferenceEdgeId = resolveReferenceEdgeId('horizontal');

      if (verticalReferenceEdgeId) {
        const baselineCoordinate = resizeState.edgeLineCoordinateBaseline?.[verticalReferenceEdgeId];
        const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, verticalReferenceEdgeId);

        if (typeof baselineCoordinate === 'number' && liveEdge) {
          resizeState.appliedEdgeDeltaX = liveEdge.lineCoordinate - baselineCoordinate;
        }
      }

      if (horizontalReferenceEdgeId) {
        const baselineCoordinate = resizeState.edgeLineCoordinateBaseline?.[horizontalReferenceEdgeId];
        const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, horizontalReferenceEdgeId);

        if (typeof baselineCoordinate === 'number' && liveEdge) {
          resizeState.appliedEdgeDeltaY = liveEdge.lineCoordinate - baselineCoordinate;
        }
      }
    },
    [buildLiveEdgeTopologySnapshot]
  );

  const normalizePassiveOppositeVerticalEdges = React.useCallback(
    (root: HTMLElement, resizeState: ResizeState) => {
      if (!resizeState.edgeResizeTargets?.length || Math.abs(resizeState.appliedEdgeDeltaX || 0) < 0.01) {
        return;
      }

      const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
      const liveNodes = getFrameNodes(root);
      const activeMembers = resizeState.edgeResizeTargets
        .flatMap((edgeTarget) => edgeTarget.members)
        .filter(
          (member, memberIndex, members) =>
            members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
        )
        .filter((member) => member.orientation === 'vertical' && (member.side === 'left' || member.side === 'right'));

      const frameSideMap = new Map<string, Set<'left' | 'right'>>();

      activeMembers.forEach((member) => {
        const nextSides = frameSideMap.get(member.frameGroupId) || new Set<'left' | 'right'>();
        nextSides.add(member.side);
        frameSideMap.set(member.frameGroupId, nextSides);
      });

      frameSideMap.forEach((movedSides, frameGroupId) => {
        if (movedSides.size !== 1) {
          return;
        }

        const movedSide = Array.from(movedSides)[0];
        const passiveSide = movedSide === 'left' ? 'right' : 'left';
        const passiveLiveEdge =
          liveSnapshot.edges.find(
            (edge) =>
              edge.frameGroupId === frameGroupId &&
              edge.orientation === 'vertical' &&
              edge.side === passiveSide
          ) || null;

        if (!passiveLiveEdge) {
          return;
        }

        const baselineCoordinate = resizeState.edgeLineCoordinateBaseline?.[passiveLiveEdge.edgeId];

        if (typeof baselineCoordinate !== 'number') {
          return;
        }

        const node = liveNodes.find((candidate) => getFrameGroupId(candidate) === frameGroupId) || null;

        if (!node) {
          return;
        }

        const correctionDelta = baselineCoordinate - passiveLiveEdge.lineCoordinate;

        if (Math.abs(correctionDelta) <= 0.01) {
          return;
        }

        const shell = resolveFrameLayoutShell(node);

        if (passiveSide === 'left') {
          applyOuterLeftWidthDelta(shell, correctionDelta);
          return;
        }

        applyOuterRightWidthDelta(shell, correctionDelta);
      });
    },
    [buildLiveEdgeTopologySnapshot, getFrameNodes]
  );

  const finalizeLiveVerticalEdgeTargets = React.useCallback(
    (root: HTMLElement, resizeState: ResizeState) => {
      if (!resizeState.edgeResizeTargets?.length) {
        return;
      }

      const baselineSnapshot = buildLiveEdgeTopologySnapshot(root);
      const roleEdgeIds = Object.keys(resizeState.edgeRoleById || {});
      const expectedEdgeIds = (roleEdgeIds.length > 0 ? roleEdgeIds : resizeState.mutationEdgeIds || []).filter(
        (edgeId) => TemplateEdgeTopologyService.getEdgeById(baselineSnapshot, edgeId)?.orientation === 'vertical'
      );

      if (expectedEdgeIds.length === 0) {
        return;
      }

      const normalizedExpectedEdgeGroups = groupExactPhysicalBoundaryEdgeIds(
        resizeState.edgeDragSnapshot || baselineSnapshot,
        expectedEdgeIds,
        resizeState.edgeRoleById
      );

      const expectedMembers = normalizedExpectedEdgeGroups
        .map((edgeIdGroup) => TemplateEdgeTopologyService.getEdgeById(baselineSnapshot, edgeIdGroup[0]))
        .filter((edge): edge is TemplateEdgeDescriptorDto => Boolean(edge));

      const clusters = clusterItemsByCoordinate(
        expectedMembers,
        (edge) => resizeState.edgeLineCoordinateBaseline?.[edge.edgeId] ?? edge.lineCoordinate,
        FRAME_RESIZE_TOLERANCE_PX
      );

      for (let pass = 0; pass < 6; pass += 1) {
        const liveSnapshot = buildLiveEdgeTopologySnapshot(root);
        let appliedCorrection = false;

        clusters.forEach((clusterEdges) => {
          const clusterEdgeGroups = clusterEdges.map((edge) =>
            normalizedExpectedEdgeGroups.find((edgeIdGroup) => edgeIdGroup.includes(edge.edgeId)) || [edge.edgeId]
          );
          const referenceEdgeId =
            clusterEdges.find((edge) => resizeState.edgeRoleById?.[edge.edgeId] === 'selected_edge_clicked')?.edgeId ||
            clusterEdges[0]?.edgeId ||
            null;
          const referenceEdgeGroup = referenceEdgeId
            ? normalizedExpectedEdgeGroups.find((edgeIdGroup) => edgeIdGroup.includes(referenceEdgeId)) || [
                referenceEdgeId,
              ]
            : null;
          const targetLineCoordinate = referenceEdgeGroup
            ? resolveResizeStateVerticalTargetLineCoordinate(
                resizeState,
                referenceEdgeGroup,
                liveSnapshot,
                referenceEdgeId
              )
            : null;

          if (!Number.isFinite(targetLineCoordinate)) {
            return;
          }

          clusterEdgeGroups.forEach((edgeIdGroup) => {
            edgeIdGroup.forEach((edgeId) => {
              const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveSnapshot, edgeId);

              if (!liveEdge || (liveEdge.side !== 'left' && liveEdge.side !== 'right')) {
                return;
              }

              const node =
                getFrameNodes(root).find((candidate) => getFrameGroupId(candidate) === liveEdge.frameGroupId) || null;

              if (!node) {
                return;
              }

              const widthInstruction = buildSelfWidthResizeInstruction(buildFrameResizeContext(node), liveEdge.side);

              if (!widthInstruction) {
                return;
              }

              const correctionDelta = targetLineCoordinate - liveEdge.lineCoordinate;

              if (Math.abs(correctionDelta) <= 0.01) {
                return;
              }

              applyFrameResizeWidthDelta(node, correctionDelta, [widthInstruction]);
              appliedCorrection = true;
            });
          });
        });

        if (!appliedCorrection) {
          break;
        }
      }

      normalizeLiveVerticalCohorts(root, {
        edgeIds: normalizedExpectedEdgeGroups.flatMap((edgeIdGroup) => edgeIdGroup),
        preferredEdgeRoleById: resizeState.edgeRoleById,
      });
      normalizeLiveVerticalPhysicalPeers(root, {
        edgeIds: normalizedExpectedEdgeGroups.flatMap((edgeIdGroup) => edgeIdGroup),
        preferredEdgeRoleById: resizeState.edgeRoleById,
      });
    },
    [
      buildLiveEdgeTopologySnapshot,
      getFrameNodes,
      normalizeLiveVerticalCohorts,
      normalizeLiveVerticalPhysicalPeers,
      resolveResizeStateVerticalTargetLineCoordinate,
    ]
  );

  const saveTemplate = React.useCallback(async () => {
    const normalizedTemplateId = selectedTemplateId.trim() || templateDetail?.template.id || '';
    const currentHtml = previewRef.current ? syncDraftPreviewHtmlRef() : draftPreviewHtmlRef.current.trim();

    if (!normalizedTemplateId) {
      setMessage('저장할 템플릿을 먼저 선택하세요.');
      return;
    }

    if (!currentHtml) {
      setMessage('저장할 템플릿 HTML이 없습니다.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/${normalizedTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          sourceDocumentName,
          layoutResizeMode,
          draftHtml: currentHtml,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '템플릿 저장에 실패했습니다.');
      }

      const updatedTemplate = result.data?.template as TemplateRecordDto | undefined;

      if (updatedTemplate) {
        setTemplates((previous) =>
          [updatedTemplate, ...previous.filter((item) => item.id !== updatedTemplate.id)].slice(0, 64)
        );
      }

      setTemplateDetail((previous) =>
        previous
          ? {
              ...previous,
              template: {
                ...previous.template,
                templateName,
                sourceDocumentName,
                layoutResizeMode,
                draftHtml: currentHtml,
              },
            }
          : previous
      );
      setMessage(`템플릿 ${normalizedTemplateId} 저장을 완료했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }, [
    layoutResizeMode,
    selectedTemplateId,
    sourceDocumentName,
    syncDraftPreviewHtmlRef,
    templateDetail?.template.id,
    templateName,
  ]);

  const stopPointerInteraction = React.useCallback(
    (pointerId?: number) => {
      const currentResizeState = resizeStateRef.current;
      const useSimpleExactBoundaryFinalize = currentResizeState?.edgeResizeTargets?.length
        ? isSimpleExactPhysicalBoundaryVerticalDrag({
            direction: currentResizeState.direction,
            snapshot: currentResizeState.edgeDragSnapshot,
            edgeRoleById: currentResizeState.edgeRoleById,
          })
        : false;
      const owner = activePointerOwnerRef.current;

      if (owner && typeof pointerId === 'number') {
        safeReleasePointerCapture(owner, pointerId);
      }

      activePointerOwnerRef.current = null;
      dragStateRef.current = null;
      resizeStateRef.current = null;
      edgePressStateRef.current = null;
      clearTransientCanvasOverlays();
      if (previewRef.current) {
        ensureRelativeAnchorConfigs(previewRef.current);
        selectedFrameGroupIdsRef.current.forEach((frameGroupId) => {
          const frameNode = resolveFrameSelectionAnchor(
            previewRef.current?.querySelector<HTMLElement>(
              `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${frameGroupId}"]`
            ) || null
          );
          syncFrameRelativeAnchorOffsetsToCurrentRect(frameNode);
        });
        applyRelativeAnchoredFrameRectsInRoot(previewRef.current);
        if (currentResizeState?.edgeResizeTargets?.length) {
          if (useSimpleExactBoundaryFinalize) {
            normalizeLiveVerticalPhysicalPeers(previewRef.current, {
              edgeIds: Object.keys(currentResizeState.edgeRoleById || {}),
              preferredEdgeRoleById: currentResizeState.edgeRoleById,
            });
          } else {
            realignLiveVerticalEdgeTargets(previewRef.current, currentResizeState);
            finalizeLiveVerticalEdgeTargets(previewRef.current, currentResizeState);
          }
          normalizePassiveOppositeVerticalEdges(previewRef.current, currentResizeState);
        } else {
          normalizeLiveVerticalCohorts(previewRef.current);
          normalizeLiveVerticalPhysicalPeers(previewRef.current);
        }
      }
      syncDraftPreviewHtmlRef();
      setSelectedFrameGroupIds(selectedFrameGroupIdsRef.current.slice());
      const nextEdgeSelectionBase = currentResizeState?.edgeSelectionAfterResize || edgeSelectionStateRef.current;
      const nextEdgeSelection = reconcileLiveEdgeSelection(previewRef.current, nextEdgeSelectionBase);
      const nextEdgeMovementMismatchIds = currentResizeState
        ? detectEdgeRoleMovementMismatches(previewRef.current, currentResizeState)
        : edgeRoleDiagnosticsRef.current.mismatchEdgeIds;
      const liveSnapshot = previewRef.current ? buildLiveEdgeTopologySnapshot(previewRef.current) : null;
      edgeSelectionStateRef.current = nextEdgeSelection;
      setEdgeSelectionState(nextEdgeSelection);
      const nextEdgeRolePresentation = liveSnapshot
        ? resolveEdgeRolePresentation(liveSnapshot, nextEdgeSelection, nextEdgeMovementMismatchIds)
        : {
            edgeRoleById: {},
            diagnosticsState: emptyEdgeRoleDiagnosticsState,
          };
      if (previewRef.current && liveSnapshot) {
        applyFrameSelectionUi(
          previewRef.current,
          selectedFrameGroupIdsRef.current,
          nextEdgeSelection,
          liveSnapshot,
          nextEdgeRolePresentation.edgeRoleById,
          nextEdgeRolePresentation.diagnosticsState.mismatchEdgeIds,
          previewRelativeGuideFrameGroupId,
          resolvePositionGroupProxySelections(
            selectedFrameGroupIdsRef.current,
            positionGroupProxySelectionGroupIdRef.current
          )
        );
        applyPositionImpactGroupSelectionUi(
          previewRef.current,
          selectionPanelTab,
          selectedFrameGroupIdsRef.current,
          positionRelationAnchorFrameGroupId
        );
        applyDefinedPositionRelativeRelationUi(previewRef.current, selectionPanelTab, focusedDefinedPositionRelativeRelations);
        applyPositionSpacingGuideUi(previewRef.current, selectionPanelTab, positionSpacingGuideRelations);
      }
      setEdgeRoleDiagnostics((previous) =>
        edgeRoleDiagnosticsStatesEqual(previous, nextEdgeRolePresentation.diagnosticsState)
          ? previous
          : nextEdgeRolePresentation.diagnosticsState
      );
      syncSelectionStyleDraft();
      requestPreviewTextFit();
      if (deferredPreviewEditorStateRef.current) {
        deferredPreviewEditorStateRef.current = false;
        schedulePreviewEditorState();
      }
    },
    [
      buildLiveEdgeTopologySnapshot,
      clearTransientCanvasOverlays,
      detectEdgeRoleMovementMismatches,
      finalizeLiveVerticalEdgeTargets,
      normalizeLiveVerticalCohorts,
      normalizePassiveOppositeVerticalEdges,
      normalizeLiveVerticalPhysicalPeers,
      previewRelativeGuideFrameGroupId,
      reconcileLiveEdgeSelection,
      realignLiveVerticalEdgeTargets,
      resolveEdgeRolePresentation,
      resolvePositionGroupProxySelections,
      selectionPanelTab,
      positionRelationAnchorFrameGroupId,
      focusedDefinedPositionRelativeRelations,
      positionSpacingGuideRelations,
      requestPreviewTextFit,
      schedulePreviewEditorState,
      syncDraftPreviewHtmlRef,
      syncSelectionStyleDraft,
    ]
  );

  const cancelPositionOrderLockSelection = React.useCallback(() => {
    if (!positionOrderLockSelectionMode) {
      return;
    }

    setPositionOrderLockSelectionMode(false);
    setPositionOrderLockFrameGroupIds([]);
    setPositionOrderLockSelectionKindByFrameGroupId({});
    setPositionOrderLockCandidateFrameGroupId('');
    setPositionOrderLockCandidateGroupId('');
    setPositionOrderLockCandidateSelectionStage('');
    positionGroupProxySelectionShowAllGroupsRef.current = false;
    positionGroupProxySelectionsOverrideRef.current = null;
    applyFrameBoxSelection(selectedFrameGroupIdsRef.current.slice(), {
      positionGroupProxySelectionGroupId: '',
      showAllGroupProxySelections: false,
    });
    setMessage('박스 간격 고정하기를 취소했습니다.');
  }, [applyFrameBoxSelection, positionOrderLockSelectionMode]);

  const clearFrameSelection = React.useCallback(() => {
    stopPointerInteraction();
    positionGroupProxySelectionGroupIdRef.current = '';
    positionGroupProxySelectionShowAllGroupsRef.current = false;
    positionGroupProxySelectionsOverrideRef.current = null;
    setPositionOrderLockSelectionMode(false);
    setPositionOrderLockFrameGroupIds([]);
    setPositionOrderLockSelectionKindByFrameGroupId({});
    setPositionOrderLockCandidateFrameGroupId('');
    setPositionOrderLockCandidateGroupId('');
    setPositionOrderLockCandidateSelectionStage('');
    setSelectionValidationIssues([]);
    setSelectionSaveProgress(defaultSelectionSaveProgressState);
    setSelectedFrameGroupIds([]);
    setEdgeSelectionState(TemplateEdgeSelectionService.createEmptyState());
    setEdgeRoleDiagnostics(emptyEdgeRoleDiagnosticsState);
  }, [stopPointerInteraction]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') {
        return;
      }

      if (positionOrderLockSelectionMode) {
        event.preventDefault();
        cancelPositionOrderLockSelection();
        return;
      }

      if (selectedFrameGroupIdsRef.current.length === 0 && edgeSelectionStateRef.current.tokens.length === 0) {
        return;
      }

      clearFrameSelection();
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [cancelPositionOrderLockSelection, clearFrameSelection, positionOrderLockSelectionMode]);

  const handlePreviewPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const root = previewRef.current;
      const target = event.target instanceof HTMLElement ? event.target : null;

      if (!root || !target) {
        return;
      }

      const edgeButton = target.closest<HTMLElement>(FRAME_EDGE_BUTTON_SELECTOR);
      const resizeHandle = target.closest<HTMLElement>(FRAME_RESIZE_HANDLE_SELECTOR);
      const explicitEdgeId = edgeButton?.getAttribute('data-edge-id')?.trim() || '';
      const explicitEdgeFrameNode = resolveExplicitEdgeFrameNode(root, explicitEdgeId);
      const frameAnchorTarget =
        explicitEdgeFrameNode ||
        edgeButton?.closest<HTMLElement>('.v102-frame-band') ||
        resizeHandle?.closest<HTMLElement>('.v102-frame-band') ||
        target.closest<HTMLElement>(FRAME_SELECTION_NODE_SELECTOR);
      const frameNode = resolveFrameSelectionAnchor(frameAnchorTarget);
      const pageInner =
        target.closest<HTMLElement>('.page-inner') || frameNode?.closest<HTMLElement>('.page-inner') || null;

      if (
        metadataRelationSelectionModeRef.current.kind !== 'idle' &&
        frameNode &&
        !edgeButton &&
        !resizeHandle
      ) {
        const relationFrameGroupId = getFrameGroupId(frameNode);

        if (relationFrameGroupId) {
          event.preventDefault();
          handleMetadataRelationFramePick(relationFrameGroupId);
          return;
        }
      }

      if (boxCreationMode && pageInner) {
        const anchorFrameGroupId =
          boxCreationPositionMode === 'relative' ? readSingleFrameGroupId(selectedFrameGroupIdsRef.current) || null : null;
        const resolvedPositionMode =
          boxCreationPositionMode === 'relative' && !anchorFrameGroupId ? 'absolute' : boxCreationPositionMode;

        if (boxCreationPositionMode === 'relative' && !anchorFrameGroupId) {
          setBoxCreationPositionMode('absolute');
          setMessage('상대 기준 박스 1개가 없어 이번 생성은 절대 위치 모드로 전환합니다.');
        }

        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        const origin = readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100);
        createBoxStateRef.current = {
          pointerId: event.pointerId,
          scale: previewZoom / 100,
          pageInner,
          positionMode: resolvedPositionMode,
          anchorFrameGroupId,
          origin,
          ghost: null,
          active: false,
        };
        return;
      }

      const shouldStartMarqueeSelection =
        !edgeButton && !resizeHandle && Boolean(pageInner) && (event.shiftKey || !frameNode);

      if (shouldStartMarqueeSelection && pageInner) {
        const useGroupedShiftSelection = selectionPanelTab === 'position';
        const shouldAccumulateSelection = Boolean(event.shiftKey);
        const rawAnchorFrameGroupId = frameNode ? getFrameGroupId(frameNode) : '';
        const resolvedAnchorFrameGroupId = rawAnchorFrameGroupId;
        const expandGroupMembers = (frameGroupId: string) => {
          const normalizedFrameGroupId = frameGroupId.trim();
          if (!normalizedFrameGroupId) {
            return [] as string[];
          }
          const group = positionBoxGroupByFrameGroupId.get(normalizedFrameGroupId);
          if (!group || group.frameGroupIds.length <= 1) {
            return [normalizedFrameGroupId];
          }
          return group.frameGroupIds
            .map((memberFrameGroupId) => memberFrameGroupId.trim())
            .filter((memberFrameGroupId) => Boolean(memberFrameGroupId));
        };
        const baseSelectionIds = shouldAccumulateSelection
          ? useGroupedShiftSelection
            ? Array.from(new Set(selectedFrameGroupIdsRef.current.flatMap(expandGroupMembers)))
            : selectedFrameGroupIdsRef.current.slice()
          : [];

        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        marqueeSelectionStateRef.current = {
          pointerId: event.pointerId,
          scale: previewZoom / 100,
          pageInner,
          anchorFrameGroupId: resolvedAnchorFrameGroupId || null,
          baseSelectionIds,
          lastSelectionIds: baseSelectionIds.slice(),
          lastProxySelections: useGroupedShiftSelection
            ? resolvePositionMarqueeProxySelections(pageInner, baseSelectionIds)
            : undefined,
          origin: readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100),
          ghost: null,
          mode: 'contained',
          active: false,
        };
        return;
      }

      if (!frameNode) {
        return;
      }

      const frameGroupId = getFrameGroupId(frameNode);

      if (!frameGroupId) {
        return;
      }

      if (selectionPanelTab === 'position' && !edgeButton && !resizeHandle) {
        const selectedPositionBoxGroup = positionBoxGroupByFrameGroupId.get(frameGroupId) || null;
        const selectedPositionBoxGroupIds = selectedPositionBoxGroup?.frameGroupIds || [];

        if (positionOrderLockSelectionMode) {
          if (selectedPositionBoxGroupIds.length > 1) {
            const groupSelectionFrameGroupId = frameGroupId;
            const selectedGroupId = selectedPositionBoxGroup?.id || '';
            const normalizedCandidateFrameGroupId = positionOrderLockCandidateFrameGroupId.trim();
            const normalizedCandidateGroupId = positionOrderLockCandidateGroupId.trim();
            const isSameCandidateGroup = Boolean(selectedGroupId) && normalizedCandidateGroupId === selectedGroupId;
            const isCandidateGroupProxySelection =
              isSameCandidateGroup && normalizedCandidateFrameGroupId === groupSelectionFrameGroupId;
            const selectedGroupSelectionFrameGroupId =
              positionOrderLockFrameGroupIds.find((selectedId) => {
                const normalizedSelectedId = selectedId.trim();
                if (!normalizedSelectedId) {
                  return false;
                }

                return (
                  (positionBoxGroupByFrameGroupId.get(normalizedSelectedId)?.id || '') === selectedGroupId &&
                  (positionOrderLockSelectionKindByFrameGroupId[normalizedSelectedId] || 'frame') === 'group'
                );
              }) || '';
            const canConvertExistingGroupSelectionToFrame =
              Boolean(selectedGroupSelectionFrameGroupId) &&
              frameGroupId !== selectedGroupSelectionFrameGroupId;

            event.preventDefault();
            if (canConvertExistingGroupSelectionToFrame) {
              previewPositionOrderLockCandidateSelection(frameGroupId, {
                preserveFrameGroupId: true,
                candidateGroupId: selectedGroupId,
                disableProxySelection: true,
                commitSelection: true,
                replaceSelectionFromGroupId: selectedGroupId,
              });
              return;
            }

            if (!isCandidateGroupProxySelection) {
              previewPositionOrderLockCandidateSelection(groupSelectionFrameGroupId, {
                positionGroupProxySelectionGroupId: selectedGroupId,
                candidateGroupId: selectedGroupId,
                commitSelection: true,
              });
              return;
            }

            previewPositionOrderLockCandidateSelection(frameGroupId, {
              preserveFrameGroupId: true,
              candidateGroupId: selectedGroupId,
              disableProxySelection: true,
              commitSelection: true,
              replaceSelectionFromGroupId: selectedGroupId,
            });
            return;
          }

          event.preventDefault();
          previewPositionOrderLockCandidateSelection(frameGroupId, { commitSelection: true });
          return;
        }

        event.preventDefault();
        const pointerPoint = pageInner
          ? readPageInnerPointerPoint(pageInner, event.clientX, event.clientY, previewZoom / 100)
          : null;
        const clickChain = resolvePositionSelectionClickChain(pageInner, frameGroupId, pointerPoint);
        setPositionSelectionClickChainSnapshot({
          sourceFrameGroupId: frameGroupId,
          point: pointerPoint,
          entries: clickChain.entries,
        });
        const currentSelectionIds = selectedFrameGroupIdsRef.current
          .map((selectionId) => selectionId.trim())
          .filter((selectionId) => Boolean(selectionId));
        const currentSelectedId = currentSelectionIds.length === 1 ? currentSelectionIds[0] || '' : '';
        const currentProxyGroupId = positionGroupProxySelectionGroupIdRef.current.trim();
        const currentChainIndex = clickChain.entries.findIndex((entry) => {
          if (entry.kind === 'group') {
            if (currentProxyGroupId) {
              return entry.groupId === currentProxyGroupId;
            }
            return entry.frameGroupId === currentSelectedId;
          }

          return entry.frameGroupId === currentSelectedId && currentProxyGroupId.length === 0;
        });
        const nextChainIndex =
          clickChain.entries.length > 0
            ? currentChainIndex >= 0
              ? (currentChainIndex + 1) % clickChain.entries.length
              : 0
            : -1;
        const nextEntry = nextChainIndex >= 0 ? clickChain.entries[nextChainIndex] : null;

        if (!nextEntry) {
          applyFrameBoxSelection([frameGroupId]);
          return;
        }

        if (nextEntry.kind === 'group') {
          const nextGroup = positionBoxGroups.find((group) => group.id === nextEntry.groupId) || null;
          const nextSelectionIds =
            nextGroup?.frameGroupIds
              .map((frameGroupId) => frameGroupId.trim())
              .filter((frameGroupId) => Boolean(frameGroupId)) || [];
          applyFrameBoxSelection(nextSelectionIds.length > 0 ? nextSelectionIds : [nextEntry.frameGroupId], {
            positionGroupProxySelectionGroupId: nextEntry.groupId,
          });
          return;
        }

        applyFrameBoxSelection([nextEntry.frameGroupId], {
          disableAutoPositionGroupProxySelection: true,
        });
        return;
      }

      const explicitEdgeDirection = (edgeButton?.getAttribute('data-direction') ||
        resizeHandle?.getAttribute('data-direction') ||
        '') as TemplateFrameResizeDirection;
      const explicitEdgeSide = getCardinalEdgeSideFromDirection(explicitEdgeDirection);

      if (explicitEdgeSide && pageInner) {
        const snapshot = buildLiveEdgeTopologySnapshot(root);
        const currentSelection = TemplateEdgeSelectionService.reconcileSelectionState({
          snapshot,
          currentSelection: edgeSelectionStateRef.current,
        });
        const clickedEdgeId = explicitEdgeId || `${frameGroupId}:${explicitEdgeSide}`;
        const resizeIntent = TemplateEdgeResizeIntentService.resolveResizeIntent({
          snapshot,
          currentSelection,
          clickedEdgeId,
          withShift: Boolean(event.shiftKey),
        });
        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        edgePressStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          node: frameNode,
          direction: explicitEdgeDirection,
          clickedEdgeId,
          snapshot,
          clickSelection: resizeIntent.clickSelectionState,
          dragSelection: resizeIntent.dragSelectionState,
          mutationEdgeIds: resizeIntent.mutationEdgeIds,
          edgeRoleById: resizeIntent.edgeRoleById,
          withShift: Boolean(event.shiftKey),
        };
        return;
      }

      if (!pageInner) {
        applyFrameBoxSelection([frameGroupId]);
        return;
      }

      const currentSelectionIds = selectedFrameGroupIdsRef.current;
      const stableSelection = currentSelectionIds.includes(frameGroupId) ? currentSelectionIds : [frameGroupId];
      applyFrameBoxSelection(stableSelection);

      if (resizeHandle) {
        const direction = (resizeHandle.getAttribute('data-direction') || 'se') as TemplateFrameResizeDirection;
        const resizeContext = buildFrameResizeContext(frameNode);
        event.preventDefault();
        lockPreviewEditorStateDuringInteraction();
        safeSetPointerCapture(event.currentTarget, event.pointerId);
        activePointerOwnerRef.current = event.currentTarget;
        resizeStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scale: previewZoom / 100,
          pageInner,
          direction,
          node: frameNode,
          rect: readFrameNodeRect(frameNode),
          widthInstructions:
            direction.includes('e') || direction.includes('w')
              ? collectWidthResizeInstructions(resizeContext, direction.includes('w') ? 'left' : 'right')
              : undefined,
          edgeResizeTargets: undefined,
        };
        return;
      }

      if (isInteractiveTarget(target)) {
        return;
      }

      event.preventDefault();
      lockPreviewEditorStateDuringInteraction();
      safeSetPointerCapture(event.currentTarget, event.pointerId);
      activePointerOwnerRef.current = event.currentTarget;
      const selectionOnPage = getFrameNodes(pageInner).filter(
        (node) =>
          getFrameGroupId(node) === frameGroupId ||
          (stableSelection.includes(getFrameGroupId(node)) &&
            node.closest<HTMLElement>('.page-inner') === pageInner)
      );

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scale: previewZoom / 100,
        pageInner,
        anchorRect: readFrameMoveRect(frameNode),
        nodes: selectionOnPage.length
          ? selectionOnPage.map((node) => ({ node, rect: readFrameMoveRect(node) }))
          : [{ node: frameNode, rect: readFrameMoveRect(frameNode) }],
      };
    },
    [
      boxCreationMode,
      boxCreationPositionMode,
      buildLiveEdgeTopologySnapshot,
      applyFrameBoxSelection,
      getFrameNodes,
      handleMetadataRelationFramePick,
      lockPreviewEditorStateDuringInteraction,
      positionOrderLockCandidateFrameGroupId,
      positionOrderLockCandidateGroupId,
      positionOrderLockFrameGroupIds,
      positionOrderLockSelectionKindByFrameGroupId,
      positionBoxGroups,
      positionBoxGroupByFrameGroupId,
      positionOrderLockSelectionMode,
      resolvePositionSelectionClickChain,
      previewPositionOrderLockCandidateSelection,
      previewZoom,
      selectionPanelTab,
    ]
  );

  const handlePreviewPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const marqueeSelectionState = marqueeSelectionStateRef.current;
    const createBoxState = createBoxStateRef.current;
    const dragState = dragStateRef.current;
    let resizeState = resizeStateRef.current;

    if (marqueeSelectionState && event.pointerId === marqueeSelectionState.pointerId) {
      event.preventDefault();
      const currentPoint = readPageInnerPointerPoint(
        marqueeSelectionState.pageInner,
        event.clientX,
        event.clientY,
        marqueeSelectionState.scale
      );
      const nextRect = buildPointerDragRect(marqueeSelectionState.origin, currentPoint);

      if (
        !marqueeSelectionState.active &&
        nextRect.width < FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
        nextRect.height < FRAME_MARQUEE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (!marqueeSelectionState.active) {
        const nextGhost = createFrameEditorGhost(FRAME_MARQUEE_GHOST_CLASS, marqueeSelectionState.mode);
        marqueeSelectionState.pageInner.appendChild(nextGhost);
        marqueeSelectionState.ghost = nextGhost;
        marqueeSelectionState.active = true;
      }

      const nextMode: FrameMarqueeSelectionMode =
        currentPoint.x >= marqueeSelectionState.origin.x ? 'contained' : 'intersected';
      marqueeSelectionState.mode = nextMode;
      marqueeSelectionState.ghost?.setAttribute('data-marquee-mode', nextMode);
      if (marqueeSelectionState.ghost) {
        writeFrameEditorGhostRect(marqueeSelectionState.ghost, nextRect);
      }

      const nextSelectionIds = resolveMarqueeSelectionIds(
        marqueeSelectionState.pageInner,
        nextRect,
        nextMode,
        marqueeSelectionState.baseSelectionIds
      );
      const marqueeProxySelections = resolvePositionMarqueeProxySelections(
        marqueeSelectionState.pageInner,
        nextSelectionIds
      );
      marqueeSelectionState.lastSelectionIds = nextSelectionIds;
      marqueeSelectionState.lastProxySelections = marqueeProxySelections;
      const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
      selectedFrameGroupIdsRef.current = nextSelectionIds;
      edgeSelectionStateRef.current = emptyEdgeSelection;
      applyRuntimeSelectionUi(nextSelectionIds, emptyEdgeSelection, marqueeProxySelections);
      return;
    }

    if (createBoxState && event.pointerId === createBoxState.pointerId) {
      event.preventDefault();
      const currentPoint = readPageInnerPointerPoint(
        createBoxState.pageInner,
        event.clientX,
        event.clientY,
        createBoxState.scale
      );
      const nextRect = buildPointerDragRect(createBoxState.origin, currentPoint);

      if (
        !createBoxState.active &&
        nextRect.width < FRAME_MARQUEE_DRAG_THRESHOLD_PX &&
        nextRect.height < FRAME_MARQUEE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (!createBoxState.active) {
        const nextGhost = createFrameEditorGhost(FRAME_CREATION_GHOST_CLASS);
        createBoxState.pageInner.appendChild(nextGhost);
        createBoxState.ghost = nextGhost;
        createBoxState.active = true;
      }

      if (createBoxState.ghost) {
        writeFrameEditorGhostRect(createBoxState.ghost, nextRect);
      }
      return;
    }

    if (dragState && event.pointerId === dragState.pointerId) {
      event.preventDefault();
      const pageBounds = {
        width: dragState.pageInner.clientWidth,
        height: dragState.pageInner.clientHeight,
      };
      const delta = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: event.clientX - dragState.startX,
          y: event.clientY - dragState.startY,
        },
        dragState.scale
      );
      const siblingRects = getFrameNodes(dragState.pageInner)
        .filter((node) => !dragState.nodes.some((selected) => selected.node === node))
        .map((node) => readFrameMoveRect(node));
      const snapResult = TemplateFrameEditGeometryService.snapMovedRect({
        rect: {
          ...dragState.anchorRect,
          left: dragState.anchorRect.left + delta.x,
          top: dragState.anchorRect.top + delta.y,
        },
        siblingRects,
        bounds: pageBounds,
      });
      const resolvedRect =
        snapResult.ok && snapResult.value
          ? snapResult.value
          : clampFrameNodeRect(
              {
                ...dragState.anchorRect,
                left: dragState.anchorRect.left + delta.x,
                top: dragState.anchorRect.top + delta.y,
              },
              pageBounds
            );
      const moveDx = resolvedRect.left - dragState.anchorRect.left;
      const moveDy = resolvedRect.top - dragState.anchorRect.top;

      dragState.nodes.forEach(({ node, rect }) => {
        writeFrameMoveRect(
          node,
          clampFrameNodeRect(
            {
              left: rect.left + moveDx,
              top: rect.top + moveDy,
              width: rect.width,
              height: rect.height,
            },
            pageBounds
          )
        );
      });
      ensureRelativeAnchorConfigs(dragState.pageInner);
      applyRelativeAnchoredFrameRects(dragState.pageInner, dragState.nodes.map(({ node }) => getFrameGroupId(node)));
      return;
    }

    const edgePressState = edgePressStateRef.current;

    if (!resizeState && edgePressState && event.pointerId === edgePressState.pointerId) {
      event.preventDefault();

      if (edgePressState.withShift) {
        return;
      }

      const rawDeltaX = event.clientX - edgePressState.startX;
      const rawDeltaY = event.clientY - edgePressState.startY;

      if (Math.abs(rawDeltaX) < EDGE_DRAG_START_THRESHOLD_PX && Math.abs(rawDeltaY) < EDGE_DRAG_START_THRESHOLD_PX) {
        return;
      }

      const resizeTargets = resolveLiveEdgeResizeTargets(
        previewRef.current || event.currentTarget,
        edgePressState.snapshot,
        edgePressState.mutationEdgeIds
      );

      applyRuntimeSelectionUi([], edgePressState.dragSelection);
      edgeSelectionStateRef.current = edgePressState.dragSelection;
      // During edge drag we keep the runtime selection UI on the live DOM only.
      // Committing React state here re-renders stale previewHtml and reverts the
      // in-progress shell geometry before pointerup can persist it.
      resizeStateRef.current = {
        pointerId: edgePressState.pointerId,
        startX: edgePressState.startX,
        startY: edgePressState.startY,
        scale: edgePressState.scale,
        pageInner: edgePressState.pageInner,
        direction: edgePressState.direction,
        node: edgePressState.node,
        rect: readFrameNodeRect(edgePressState.node),
        widthInstructions:
          edgePressState.direction === 'e' || edgePressState.direction === 'w'
            ? resizeTargets[0]?.widthInstructions
            : undefined,
        edgeResizeTargets: resizeTargets,
        edgeSelectionAfterResize: edgePressState.dragSelection,
        edgeRoleById: edgePressState.edgeRoleById,
        mutationEdgeIds: edgePressState.mutationEdgeIds,
        edgeDragSnapshot: edgePressState.snapshot,
        edgeLineCoordinateBaseline: Object.fromEntries(
          edgePressState.snapshot.edges.map((edge) => [
            edge.edgeId,
            edge.lineCoordinate,
          ])
        ),
        appliedEdgeDeltaX: 0,
        appliedEdgeDeltaY: 0,
        edgeAutosnapLockX: null,
        edgeAutosnapLockY: null,
        passiveShiftedEdgeIds: collectPassiveShiftedHorizontalEdgeIds(
          edgePressState.pageInner,
          edgePressState.node,
          edgePressState.direction,
          edgePressState.snapshot
        ),
      };
      edgePressStateRef.current = null;
      resizeState = resizeStateRef.current;
    }

    if (resizeState && event.pointerId === resizeState.pointerId) {
      event.preventDefault();
      if (
        (!resizeState.pageInner.isConnected ||
          resizeState.pageInner.clientWidth <= 0 ||
          resizeState.pageInner.clientHeight <= 0) &&
        previewRef.current
      ) {
        const resizeFrameGroupId = getFrameGroupId(resizeState.node);
        const liveResizeNode = resizeFrameGroupId
          ? resolveFrameSelectionAnchor(
              previewRef.current.querySelector<HTMLElement>(
                `${RAW_FRAME_NODE_SELECTOR}[data-template-frame-group="${resizeFrameGroupId}"]`
              )
            )
          : null;
        const livePageInner =
          liveResizeNode?.closest<HTMLElement>('.page-inner') ||
          previewRef.current.querySelector<HTMLElement>('.page-inner') ||
          null;

        if (liveResizeNode) {
          resizeState.node = liveResizeNode;
        }

        if (livePageInner) {
          resizeState.pageInner = livePageInner;
        }
      }
      const pageBounds = {
        width: resizeState.pageInner.clientWidth,
        height: resizeState.pageInner.clientHeight,
      };
      const delta = TemplateFrameEditGeometryService.screenDeltaToPageDelta(
        {
          x: event.clientX - resizeState.startX,
          y: event.clientY - resizeState.startY,
        },
        resizeState.scale
      );

      let nextRect: FrameNodeRect = { ...resizeState.rect };

      if (resizeState.direction.includes('w')) {
        nextRect.left = resizeState.rect.left + delta.x;
        nextRect.width = resizeState.rect.width - delta.x;
      }

      if (resizeState.direction.includes('e')) {
        nextRect.width = resizeState.rect.width + delta.x;
      }

      if (resizeState.direction.includes('n')) {
        nextRect.top = resizeState.rect.top + delta.y;
        nextRect.height = resizeState.rect.height - delta.y;
      }

      if (resizeState.direction.includes('s')) {
        nextRect.height = resizeState.rect.height + delta.y;
      }

      let activeEdgeResizeTargets = resizeState.edgeResizeTargets || [];

      if (activeEdgeResizeTargets.length > 0) {
        const liveResizeRoot = previewRef.current || resizeState.pageInner;
        const liveResizeSnapshot = liveResizeRoot ? buildLiveEdgeTopologySnapshot(liveResizeRoot) : null;

        if (liveResizeRoot && liveResizeSnapshot) {
          const liveResizeTargets = refreshLockedEdgeResizeTargets(
            liveResizeRoot,
            liveResizeSnapshot,
            resizeState.edgeResizeTargets || []
          );

          if (liveResizeTargets.length > 0) {
            activeEdgeResizeTargets = liveResizeTargets;
          }
        }
        const boundedEdgeRect = clampFrameNodeRect(nextRect, pageBounds);
        const totalRequestedDeltaX = resizeState.direction.includes('w')
          ? boundedEdgeRect.left - resizeState.rect.left
          : resizeState.direction.includes('e')
            ? boundedEdgeRect.width - resizeState.rect.width
            : 0;
        const totalRequestedDeltaY = resizeState.direction.includes('n')
          ? boundedEdgeRect.top - resizeState.rect.top
          : resizeState.direction.includes('s')
            ? boundedEdgeRect.height - resizeState.rect.height
            : 0;
        const nextDeltaX = totalRequestedDeltaX - (resizeState.appliedEdgeDeltaX || 0);
        const nextDeltaY = totalRequestedDeltaY - (resizeState.appliedEdgeDeltaY || 0);
        const widthResizeTargets = activeEdgeResizeTargets.filter(
          (edgeTarget) => edgeTarget.orientation === 'vertical' && (edgeTarget.widthInstructions?.length || 0) > 0
        );
        const widthConstraintTargets = widthResizeTargets.reduce<
          Array<{
            members: EdgeResizeTargetMember[];
            instructions: FrameWidthResizeInstruction[];
          }>
        >((groups, edgeTarget) => {
          const targetMembers = [...edgeTarget.members, ...edgeTarget.physicalPeerMembers].filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          );
          const targetInstructions = [
            ...(edgeTarget.widthInstructions || []),
            ...targetMembers.flatMap((member) => member.widthInstructions || []),
          ];
          const matchedGroup = groups.find((group) =>
            targetMembers.some((member) =>
              group.members.some(
                (groupMember) =>
                  groupMember.edgeId === member.edgeId || targetsSharePhysicalBoundary(groupMember, member)
              )
            )
          );

          if (!matchedGroup) {
            const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
            targetInstructions.forEach((instruction) => {
              uniqueInstructions.set(buildWidthInstructionKey(instruction, edgeTarget.node), instruction);
            });
            groups.push({
              members: targetMembers,
              instructions: Array.from(uniqueInstructions.values()),
            });
            return groups;
          }

          targetMembers.forEach((member) => {
            if (!matchedGroup.members.some((groupMember) => groupMember.edgeId === member.edgeId)) {
              matchedGroup.members.push(member);
            }
          });
          const uniqueInstructions = new Map<string, FrameWidthResizeInstruction>();
          [...matchedGroup.instructions, ...targetInstructions].forEach((instruction) => {
            uniqueInstructions.set(buildWidthInstructionKey(instruction, edgeTarget.node), instruction);
          });
          matchedGroup.instructions = Array.from(uniqueInstructions.values());
          return groups;
        }, []);
        const heightResizeTargets = activeEdgeResizeTargets
          .map((edgeTarget) => ({
            edgeTarget,
            member: pickHeightResizeTargetMember(edgeTarget, resizeState.direction),
          }))
          .filter(
            (
              value
            ): value is {
              edgeTarget: EdgeResizeTarget;
              member: EdgeResizeTargetMember;
            } => Boolean(value.member)
          );
        const resolveWidthDragDelta = (requestedDelta: number) =>
          resolveSharedEdgeResizeDelta(
            requestedDelta,
            widthConstraintTargets
              .map((constraintTarget) =>
                resolveWidthInstructionDelta(
                  constraintTarget.instructions,
                  requestedDelta
                )
              )
              .filter((candidateDelta) => Number.isFinite(candidateDelta))
          );
        const resolveHeightDragDelta = (requestedDelta: number) =>
          resolveSharedEdgeResizeDelta(
            requestedDelta,
            heightResizeTargets
              .map(({ edgeTarget, member }) => {
                const constraintMembers = [member, ...edgeTarget.members, ...edgeTarget.physicalPeerMembers].filter(
                  (constraintMember, constraintIndex, members) =>
                    members.findIndex((candidateMember) => candidateMember.edgeId === constraintMember.edgeId) ===
                    constraintIndex
                );
                const candidateDeltas = constraintMembers
                  .map((constraintMember) => {
                    if (constraintMember.side === 'top') {
                      return resolveFrameResizeTopDelta(constraintMember.node, requestedDelta);
                    }

                    if (constraintMember.side === 'bottom') {
                      return resolveFrameResizeBottomDelta(constraintMember.node, requestedDelta);
                    }

                    return 0;
                  })
                  .filter((candidateDelta) => Number.isFinite(candidateDelta));

                if (candidateDeltas.length === 0) {
                  return 0;
                }

                return resolveSharedEdgeResizeDelta(requestedDelta, candidateDeltas);
              })
              .filter((candidateDelta) => Number.isFinite(candidateDelta))
          );
        const constrainedDeltaX = resolveWidthDragDelta(nextDeltaX);
        const constrainedDeltaY = resolveHeightDragDelta(nextDeltaY);
        const movingWidthMembers = widthResizeTargets
          .flatMap((edgeTarget) => [...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .filter(
            (member, memberIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === member.edgeId) === memberIndex
          );
        const movingHeightMembers = heightResizeTargets
          .flatMap(({ edgeTarget, member }) => [member, ...edgeTarget.members, ...edgeTarget.physicalPeerMembers])
          .filter(
            (constraintMember, constraintIndex, members) =>
              members.findIndex((candidateMember) => candidateMember.edgeId === constraintMember.edgeId) ===
              constraintIndex
          );
        const autosnapWidthMembers = movingWidthMembers
          .map((member) => {
            const baselineEdge = resizeState.edgeDragSnapshot
              ? TemplateEdgeTopologyService.getEdgeById(resizeState.edgeDragSnapshot, member.edgeId)
              : null;

            if (!baselineEdge) {
              return member;
            }

            return {
              ...member,
              lineCoordinate: baselineEdge.lineCoordinate,
              spanStart: baselineEdge.spanStart,
              spanEnd: baselineEdge.spanEnd,
            };
          })
          .filter((member): member is EdgeResizeTargetMember => Boolean(member));
        const autosnapHeightMembers = movingHeightMembers
          .map((member) => {
            const baselineEdge = resizeState.edgeDragSnapshot
              ? TemplateEdgeTopologyService.getEdgeById(resizeState.edgeDragSnapshot, member.edgeId)
              : null;

            if (!baselineEdge) {
              return member;
            }

            return {
              ...member,
              lineCoordinate: baselineEdge.lineCoordinate,
              spanStart: baselineEdge.spanStart,
              spanEnd: baselineEdge.spanEnd,
            };
          })
          .filter((member): member is EdgeResizeTargetMember => Boolean(member));
        const snappedResultX = resolveEdgeDragAutosnapResult({
          requestedDelta: constrainedDeltaX,
          orientation: 'vertical',
          movingMembers: autosnapWidthMembers,
          snapshot: resizeState.edgeDragSnapshot,
          currentAppliedDelta: resizeState.appliedEdgeDeltaX || 0,
          existingLock: resizeState.edgeAutosnapLockX,
        });
        const snappedResultY = resolveEdgeDragAutosnapResult({
          requestedDelta: constrainedDeltaY,
          orientation: 'horizontal',
          movingMembers: autosnapHeightMembers,
          snapshot: resizeState.edgeDragSnapshot,
          currentAppliedDelta: resizeState.appliedEdgeDeltaY || 0,
          existingLock: resizeState.edgeAutosnapLockY,
        });
        const snappedDeltaX = snappedResultX.delta;
        const snappedDeltaY = snappedResultY.delta;
        const finalDeltaX =
          Math.abs(snappedDeltaX - constrainedDeltaX) >= 0.5 ? resolveWidthDragDelta(snappedDeltaX) : constrainedDeltaX;
        const finalDeltaY =
          Math.abs(snappedDeltaY - constrainedDeltaY) >= 0.5 ? resolveHeightDragDelta(snappedDeltaY) : constrainedDeltaY;
        const safeFinalDeltaX = clampResolvedEdgeDragDeltaToPointerRequest(nextDeltaX, finalDeltaX);
        const safeFinalDeltaY = clampResolvedEdgeDragDeltaToPointerRequest(nextDeltaY, finalDeltaY);
        resizeState.edgeAutosnapLockX = snappedResultX.nextLock || null;
        resizeState.edgeAutosnapLockY = snappedResultY.nextLock || null;
        const useSimpleExactBoundaryWidthCorrections =
          widthResizeTargets.length > 0 &&
          isSimpleExactPhysicalBoundaryVerticalDrag({
            direction: resizeState.direction,
            snapshot: resizeState.edgeDragSnapshot,
            edgeRoleById: resizeState.edgeRoleById,
          });

        const nextAppliedEdgeDeltaX = (resizeState.appliedEdgeDeltaX || 0) + safeFinalDeltaX;
        const nextAppliedEdgeDeltaY = (resizeState.appliedEdgeDeltaY || 0) + safeFinalDeltaY;

        widthResizeTargets.forEach((edgeTarget) => {
          if (Math.abs(safeFinalDeltaX) >= 0.5) {
            applyFrameResizeWidthDelta(edgeTarget.node, safeFinalDeltaX, edgeTarget.widthInstructions);
          }
        });

        heightResizeTargets.forEach(({ edgeTarget, member }) => {
          if (Math.abs(safeFinalDeltaY) < 0.5) {
            return;
          }

          if (member.side === 'top') {
            applyFrameResizeTopDelta(member.node, safeFinalDeltaY);
            return;
          }

          if (member.side === 'bottom') {
            if (edgeTarget.hasOppositePeer) {
              applyFrameResizeHeightDeltaLocal(member.node, safeFinalDeltaY);
              return;
            }

            applyFrameResizeHeightDelta(member.node, safeFinalDeltaY);
          }
        });

        resizeState.appliedEdgeDeltaX = nextAppliedEdgeDeltaX;
        resizeState.appliedEdgeDeltaY = nextAppliedEdgeDeltaY;
        if (previewRef.current) {
          if (widthResizeTargets.length > 0 && !useSimpleExactBoundaryWidthCorrections) {
            stabilizeLiveVerticalEdgeTargetsToAppliedDelta(
              previewRef.current,
              resizeState,
              nextAppliedEdgeDeltaX
            );
          }
          if (!useSimpleExactBoundaryWidthCorrections) {
            realignLiveVerticalEdgeTargets(previewRef.current, resizeState);
          }
          if (
            widthResizeTargets.length > 0 &&
            !resizeState.edgeAutosnapLockX &&
            !useSimpleExactBoundaryWidthCorrections
          ) {
            const liveAutosnapSnapshot = buildLiveEdgeTopologySnapshot(previewRef.current);
            const liveMovingWidthMembers = movingWidthMembers
              .map((member) => {
                const liveEdge = TemplateEdgeTopologyService.getEdgeById(liveAutosnapSnapshot, member.edgeId);

                if (!liveEdge) {
                  return null;
                }

                return {
                  ...member,
                  lineCoordinate: liveEdge.lineCoordinate,
                  spanStart: liveEdge.spanStart,
                  spanEnd: liveEdge.spanEnd,
                };
              })
              .filter((member): member is EdgeResizeTargetMember => Boolean(member));
            const liveAutosnapCorrectionX = resolveLiveEdgeAutosnapCorrection({
              orientation: 'vertical',
              movingMembers: liveMovingWidthMembers,
              snapshot: liveAutosnapSnapshot,
            });

            if (Math.abs(liveAutosnapCorrectionX) >= 0.5) {
              widthResizeTargets.forEach((edgeTarget) => {
                applyFrameResizeWidthDelta(edgeTarget.node, liveAutosnapCorrectionX, edgeTarget.widthInstructions);
              });
              resizeState.appliedEdgeDeltaX += liveAutosnapCorrectionX;
              stabilizeLiveVerticalEdgeTargetsToAppliedDelta(
                previewRef.current,
                resizeState,
                resizeState.appliedEdgeDeltaX
              );
              realignLiveVerticalEdgeTargets(previewRef.current, resizeState);
            }
          }
          if (Math.abs(safeFinalDeltaY) >= 0.5) {
            normalizeLiveVerticalPhysicalPeers(previewRef.current, {
              preferredEdgeRoleById: resizeState.edgeRoleById,
            });
          }
          if (widthResizeTargets.length > 0 && !useSimpleExactBoundaryWidthCorrections) {
            stabilizeLiveVerticalEdgeTargetsToAppliedDelta(
              previewRef.current,
              resizeState,
              resizeState.appliedEdgeDeltaX || 0
            );
            normalizeLiveVerticalPhysicalPeersToDragDirection(previewRef.current, resizeState);
          }
          if (widthResizeTargets.length > 0) {
            normalizePassiveOppositeVerticalEdges(previewRef.current, resizeState);
          }
        }
      } else {
        const siblingRects = filterResizeSnapRects(
          getFrameNodes(resizeState.pageInner)
            .filter((node) => node !== resizeState.node)
            .map((node) => readFrameNodeRect(node)),
          resizeState.rect,
          resizeState.direction
        );
        const snapResult = TemplateFrameEditGeometryService.snapResizedRect({
          rect: clampFrameNodeRect(nextRect, pageBounds),
          direction: resizeState.direction,
          siblingRects,
          bounds: pageBounds,
        });
        const resolvedRect =
          snapResult.ok && snapResult.value ? snapResult.value : clampFrameNodeRect(nextRect, pageBounds);
        applyFrameResizeWithDirection(
          resizeState.node,
          resolvedRect,
          resizeState.direction,
          resizeState.widthInstructions
        );
      }

      const resizeDirection = resizeState.direction;
      if (activeEdgeResizeTargets.length > 0) {
        const targetNodes = Array.from(
          new Set(
            activeEdgeResizeTargets.flatMap((edgeTarget) =>
              [...edgeTarget.members, ...edgeTarget.physicalPeerMembers].map((member) => member.node)
            )
          )
        );
        targetNodes.forEach((node) =>
          rebaseRelativeAnchorConfigForResizeDirection(node, resizeState.pageInner, resizeDirection)
        );
      } else {
        rebaseRelativeAnchorConfigForResizeDirection(resizeState.node, resizeState.pageInner, resizeDirection);
      }

      ensureRelativeAnchorConfigs(resizeState.pageInner);
        applyRelativeAnchoredFrameRects(
          resizeState.pageInner,
          activeEdgeResizeTargets.length
            ? Array.from(
              new Set(
                activeEdgeResizeTargets.flatMap((edgeTarget) =>
                  [...edgeTarget.members, ...edgeTarget.physicalPeerMembers]
                    .map((member) => getFrameGroupId(member.node))
                    .filter((frameGroupId) => Boolean(frameGroupId))
                )
              )
            )
          : [getFrameGroupId(resizeState.node)]
      );
      if (previewRef.current) {
        syncLiveAppliedEdgeDeltas(previewRef.current, resizeState);
      }
      applyRuntimeSelectionVisuals([], resizeState.edgeSelectionAfterResize || edgeSelectionStateRef.current);
    }
  }, [
    applyRuntimeSelectionUi,
    applyRuntimeSelectionVisuals,
    buildLiveEdgeTopologySnapshot,
    buildWidthInstructionKey,
    collectDirectRoleResizeTargets,
    collectEdgeResizeTargets,
    collectPassiveShiftedHorizontalEdgeIds,
    getFrameNodes,
    normalizeLiveVerticalCohorts,
    normalizePassiveOppositeVerticalEdges,
    normalizeLiveVerticalPhysicalPeers,
    normalizeLiveVerticalPhysicalPeersToDragDirection,
    realignLiveVerticalEdgeTargets,
    resolveLiveEdgeAutosnapCorrection,
    refreshLockedEdgeResizeTargets,
    resolveLiveEdgeResizeTargets,
    resolveMarqueeSelectionIds,
    resolvePositionMarqueeProxySelections,
    stabilizeLiveVerticalEdgeTargetsToAppliedDelta,
    syncLiveAppliedEdgeDeltas,
  ]);

  const handlePreviewPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const createBoxState = createBoxStateRef.current;

      if (createBoxState?.pointerId === event.pointerId) {
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        const finalPoint = readPageInnerPointerPoint(
          createBoxState.pageInner,
          event.clientX,
          event.clientY,
          createBoxState.scale
        );
        const finalRect = buildPointerDragRect(createBoxState.origin, finalPoint);
        const shouldCreate =
          finalRect.width >= MIN_FRAME_SIZE_PX && finalRect.height >= MIN_FRAME_SIZE_PX;

        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;

        if (shouldCreate) {
          const createdFrameGroupId = commitCreatedFrameShell(
            createBoxState.pageInner,
            finalRect,
            createBoxState.positionMode,
            createBoxState.anchorFrameGroupId
          );

          if (createdFrameGroupId) {
            setBoxCreationMode(false);
          }
        }

        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }

        return;
      }

      const marqueeSelectionState = marqueeSelectionStateRef.current;

      if (marqueeSelectionState?.pointerId === event.pointerId) {
        const keepGroupedShiftSelection = selectionPanelTab === 'position';
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        const finalPoint = readPageInnerPointerPoint(
          marqueeSelectionState.pageInner,
          event.clientX,
          event.clientY,
          marqueeSelectionState.scale
        );
        const finalRect = buildPointerDragRect(marqueeSelectionState.origin, finalPoint);
        const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();

        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;

        if (
          marqueeSelectionState.active ||
          finalRect.width >= FRAME_MARQUEE_DRAG_THRESHOLD_PX ||
          finalRect.height >= FRAME_MARQUEE_DRAG_THRESHOLD_PX
        ) {
          const nextMode: FrameMarqueeSelectionMode =
            finalPoint.x >= marqueeSelectionState.origin.x ? 'contained' : 'intersected';
          const computedSelectionIds = resolveMarqueeSelectionIds(
            marqueeSelectionState.pageInner,
            finalRect,
            nextMode,
            marqueeSelectionState.baseSelectionIds
          );
          const nextSelectionIds =
            marqueeSelectionState.active && marqueeSelectionState.lastSelectionIds.length > 0
              ? marqueeSelectionState.lastSelectionIds
              : computedSelectionIds;
          const marqueeProxySelections = keepGroupedShiftSelection
            ? marqueeSelectionState.lastProxySelections ||
              resolvePositionMarqueeProxySelections(
                marqueeSelectionState.pageInner,
                nextSelectionIds
              ) ||
              []
            : undefined;
          applyFrameBoxSelection(
            nextSelectionIds,
            keepGroupedShiftSelection
              ? {
                  showAllGroupProxySelections: true,
                  overridePositionGroupProxySelections: marqueeProxySelections,
                }
              : undefined
          );
          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }
          return;
        }

        if (marqueeSelectionState.anchorFrameGroupId) {
          const nextSelectionIds = getNextFrameSelection(
            marqueeSelectionState.baseSelectionIds,
            marqueeSelectionState.anchorFrameGroupId,
            true
          );
          const marqueeProxySelections = keepGroupedShiftSelection
            ? resolvePositionMarqueeProxySelections(
                marqueeSelectionState.pageInner,
                nextSelectionIds
              ) || []
            : undefined;
          applyFrameBoxSelection(
            nextSelectionIds,
            keepGroupedShiftSelection
              ? {
                  showAllGroupProxySelections: true,
                  overridePositionGroupProxySelections: marqueeProxySelections,
                }
              : undefined
          );
          if (deferredPreviewEditorStateRef.current) {
            deferredPreviewEditorStateRef.current = false;
            schedulePreviewEditorState();
          }
          return;
        }

        selectedFrameGroupIdsRef.current = marqueeSelectionState.baseSelectionIds;
        edgeSelectionStateRef.current = emptyEdgeSelection;
        applyRuntimeSelectionUi(marqueeSelectionState.baseSelectionIds, emptyEdgeSelection);
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      const edgePressState = edgePressStateRef.current;

      if (edgePressState?.pointerId === event.pointerId) {
        event.preventDefault();
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        activePointerOwnerRef.current = null;
        edgePressStateRef.current = null;
        selectedFrameGroupIdsRef.current = [];
        edgeSelectionStateRef.current = edgePressState.clickSelection;
        setSelectedFrameGroupIds([]);
        setEdgeSelectionState(edgePressState.clickSelection);
        setEdgeRoleDiagnostics(
          resolveEdgeRolePresentation(edgePressState.snapshot, edgePressState.clickSelection).diagnosticsState
        );
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [
      applyFrameBoxSelection,
      applyRuntimeSelectionUi,
      clearTransientCanvasOverlays,
      commitCreatedFrameShell,
      resolveEdgeRolePresentation,
      resolveMarqueeSelectionIds,
      resolvePositionMarqueeProxySelections,
      schedulePreviewEditorState,
      selectionPanelTab,
      positionOrderLockSelectionMode,
      stopPointerInteraction,
    ]
  );

  const handlePreviewPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const marqueeSelectionState = marqueeSelectionStateRef.current;

      if (marqueeSelectionState?.pointerId === event.pointerId) {
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        const emptyEdgeSelection = TemplateEdgeSelectionService.createEmptyState();
        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;
        selectedFrameGroupIdsRef.current = marqueeSelectionState.baseSelectionIds;
        edgeSelectionStateRef.current = emptyEdgeSelection;
        applyRuntimeSelectionUi(marqueeSelectionState.baseSelectionIds, emptyEdgeSelection);
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      if (createBoxStateRef.current?.pointerId === event.pointerId) {
        const owner = activePointerOwnerRef.current;

        safeReleasePointerCapture(owner, event.pointerId);

        clearTransientCanvasOverlays();
        activePointerOwnerRef.current = null;
        if (deferredPreviewEditorStateRef.current) {
          deferredPreviewEditorStateRef.current = false;
          schedulePreviewEditorState();
        }
        return;
      }

      if (edgePressStateRef.current?.pointerId === event.pointerId) {
        stopPointerInteraction(event.pointerId);
        return;
      }

      if (
        dragStateRef.current?.pointerId === event.pointerId ||
        resizeStateRef.current?.pointerId === event.pointerId
      ) {
        stopPointerInteraction(event.pointerId);
      }
    },
    [applyRuntimeSelectionUi, clearTransientCanvasOverlays, schedulePreviewEditorState, stopPointerInteraction]
  );

  const handlePreviewClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (metadataRelationSelectionModeRef.current.kind !== 'idle') {
      event.preventDefault();
      return;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    const choiceButton = target?.closest<HTMLElement>('[role="checkbox"][data-checked]');

    if (!choiceButton) {
      return;
    }

    toggleChoiceBoxElement(choiceButton);
    syncDraftPreviewHtmlRef();
  }, [syncDraftPreviewHtmlRef]);

  const handlePreviewInput = React.useCallback((event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;

    if (!target) {
      return;
    }

    markTemplateValueElementEdited(target);
    if (previewRef.current) {
      syncFrameRelationshipValueKeys(previewRef.current);
    }
    syncDraftPreviewHtmlRef();
    requestPreviewTextFit();
  }, [requestPreviewTextFit, syncDraftPreviewHtmlRef]);

  return (
    <div className="space-y-6">
      <style>{`
        .template-edit-preview {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          box-sizing: border-box;
          width: 100%;
          max-width: none;
          min-height: 0;
          overflow: hidden;
          border-top: 1px solid rgb(226 232 240);
          border-radius: 0;
          background: rgb(226 232 240) !important;
          box-shadow: none;
          color: rgb(30 41 59);
        }
        .template-edit-preview[data-template-preview-scaled="true"] {
          height: var(--template-preview-scaled-height, auto);
        }
        .template-edit-preview[data-template-preview-scaled="true"] > .page-inner,
        .template-edit-preview[data-template-preview-scaled="true"] > section.page {
          position: relative;
          left: auto;
          top: 0;
          width: var(--template-preview-source-width, auto) !important;
          min-height: var(--template-preview-source-height, auto) !important;
          height: var(--template-preview-source-height, auto);
          margin-left: auto !important;
          margin-right: auto !important;
          transform: none;
          zoom: var(--template-preview-scale, 1);
        }
        .template-edit-preview > .page-inner,
        .template-edit-preview > section.page,
        .template-edit-preview > .viewer {
          margin: 0 auto !important;
          padding: 0 !important;
          background: white !important;
        }
        .template-edit-preview .viewer {
          display: block;
          width: 100%;
          padding: 0 !important;
          margin: 0 auto !important;
        }
        .template-edit-preview section.page {
          position: relative;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          box-shadow: none !important;
          overflow: visible;
        }
        .template-edit-preview .page-inner {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        .template-edit-preview[data-frame-create-mode="true"] {
          cursor: crosshair;
        }
        .template-edit-preview[data-frame-create-mode="true"] [data-template-edit-scope][data-template-edit-enabled="true"] {
          cursor: crosshair;
        }
        .template-edit-preview [data-template-selected="true"] {
          position: relative;
          overflow: visible !important;
          z-index: 20 !important;
          outline: 2px solid rgba(37, 99, 235, .96) !important;
          outline-offset: 0;
          box-shadow:
            0 0 0 4px rgba(96, 165, 250, .22),
            inset 0 0 0 1px rgba(255, 255, 255, .84) !important;
        }
        .template-edit-preview [data-template-selected="true"]::before {
          content: attr(data-template-selection-order);
          position: absolute;
          top: -10px;
          right: -10px;
          z-index: 32;
          min-width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(37, 99, 235, .98);
          color: white;
          box-shadow: 0 4px 12px rgba(37, 99, 235, .28);
          font-size: 11px;
          line-height: 1;
          font-weight: 700;
          pointer-events: none;
        }
        .template-edit-preview [data-template-primary-selected="true"] {
          outline-color: rgba(13, 148, 136, .98) !important;
          box-shadow:
            0 0 0 4px rgba(45, 212, 191, .22),
            inset 0 0 0 1px rgba(255, 255, 255, .84) !important;
        }
        .template-edit-preview [data-template-primary-selected="true"]::before {
          background: rgba(13, 148, 136, .98);
          box-shadow: 0 4px 12px rgba(13, 148, 136, .28);
        }
        .template-edit-preview [${TEMPLATE_FRAME_POSITION_RELATION_ACTIVE_ATTR}="true"] {
          position: relative;
          overflow: visible !important;
          z-index: 19 !important;
          outline: 2px solid rgba(37, 99, 235, .9) !important;
          outline-offset: 0;
          box-shadow:
            0 0 0 3px rgba(96, 165, 250, .16),
            inset 0 0 0 1px rgba(255, 255, 255, .72) !important;
        }
        .template-edit-preview [${TEMPLATE_FRAME_POSITION_RELATION_ANCHOR_ATTR}="true"] {
          position: relative;
          overflow: visible !important;
          z-index: 19 !important;
          outline: 2px dashed rgba(217, 119, 6, .9) !important;
          outline-offset: -1px;
          box-shadow:
            0 0 0 3px rgba(251, 191, 36, .16),
            inset 0 0 0 1px rgba(255, 255, 255, .72) !important;
        }
        .template-edit-preview [${TEMPLATE_FRAME_VALIDATION_ERROR_ATTR}="true"] {
          outline: 2px solid rgba(225, 29, 72, .98) !important;
          outline-offset: 0;
          box-shadow:
            0 0 0 4px rgba(251, 113, 133, .24),
            inset 0 0 0 1px rgba(255, 255, 255, .84) !important;
        }
        .template-edit-preview [data-template-selected="true"][${TEMPLATE_FRAME_VALIDATION_ERROR_ATTR}="true"]::before {
          background: rgba(225, 29, 72, .98);
          box-shadow: 0 4px 12px rgba(225, 29, 72, .24);
        }
        .template-edit-preview [data-template-edge-host="true"] {
          position: relative;
          z-index: 21 !important;
        }
        .template-edit-preview [data-template-native-outline-hidden="true"] .v102-frame-band-table {
          border-color: transparent !important;
        }
        .template-edit-preview [data-template-native-outline-hidden="true"] .v102-frame-band-table td,
        .template-edit-preview [data-template-native-outline-hidden="true"] .v102-frame-band-table th {
          border-color: transparent !important;
        }
        .template-edit-preview [data-template-edge-host="true"] [data-template-frame-input="true"] {
          position: relative;
          z-index: 22;
        }
        .template-edit-preview ${RAW_FRAME_NODE_SELECTOR} {
          background-color: transparent;
        }
        .template-edit-preview ${RAW_FRAME_NODE_SELECTOR} [data-template-frame-input="true"],
        .template-edit-preview ${RAW_FRAME_NODE_SELECTOR} [data-template-edit-scope],
        .template-edit-preview ${RAW_FRAME_NODE_SELECTOR} [data-template-value] {
          background-color: transparent;
        }
        .template-edit-preview [data-template-frame-role="value"] [data-template-frame-input="true"],
        .template-edit-preview [data-template-frame-input="true"][data-template-frame-role="value"] {
          color: rgb(148 163 184) !important;
          -webkit-text-fill-color: rgb(148 163 184) !important;
        }
        .template-edit-preview [${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}="muted"] [data-template-frame-input="true"],
        .template-edit-preview [${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}="muted"] [data-template-edit-scope],
        .template-edit-preview [${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}="muted"] [data-template-value] {
          opacity: .5;
        }
        .template-edit-preview [${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}="full"] [data-template-frame-input="true"],
        .template-edit-preview [${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}="full"] [data-template-edit-scope],
        .template-edit-preview [${TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR}="full"] [data-template-value] {
          opacity: 1;
        }
        .template-edit-preview[data-metadata-visual-mode="true"] [${TEMPLATE_FRAME_ROLE_VISUAL_ATTR}] {
          position: relative;
        }
        .template-edit-preview[data-metadata-visual-mode="true"] [${TEMPLATE_FRAME_ROLE_VISUAL_ATTR}="group"] {
          background-image: linear-gradient(90deg, rgba(148, 163, 184, .78) 0 4px, transparent 4px) !important;
          background-color: rgba(148, 163, 184, .03) !important;
        }
        .template-edit-preview[data-metadata-visual-mode="true"] [${TEMPLATE_FRAME_ROLE_VISUAL_ATTR}="key"] {
          background-image: linear-gradient(90deg, rgba(245, 158, 11, .92) 0 4px, transparent 4px) !important;
          background-color: rgba(245, 158, 11, .04) !important;
        }
        .template-edit-preview[data-metadata-visual-mode="true"] [${TEMPLATE_FRAME_ROLE_VISUAL_ATTR}="value"] {
          background-image: linear-gradient(90deg, rgba(59, 130, 246, .92) 0 4px, transparent 4px) !important;
          background-color: rgba(59, 130, 246, .04) !important;
        }
        .template-edit-preview[data-metadata-visual-mode="true"] [${TEMPLATE_FRAME_ROLE_VISUAL_ATTR}="key_value"] {
          background-image: linear-gradient(90deg, rgba(16, 185, 129, .92) 0 4px, transparent 4px) !important;
          background-color: rgba(16, 185, 129, .04) !important;
        }
        .template-edit-preview [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="passive-value"] {
          outline: 1px solid rgba(37, 99, 235, .42) !important;
          outline-offset: -1px;
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, .24);
        }
        .template-edit-preview [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="passive-key"] {
          outline: 1px solid rgba(217, 119, 6, .42) !important;
          outline-offset: -1px;
          box-shadow: inset 0 0 0 1px rgba(217, 119, 6, .24);
        }
        .template-edit-preview [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="linked-value"] {
          outline: 2px solid rgba(37, 99, 235, .96) !important;
          outline-offset: -1px;
          box-shadow:
            inset 0 0 0 2px rgba(59, 130, 246, .92),
            0 0 0 4px rgba(96, 165, 250, .18);
        }
        .template-edit-preview[data-metadata-visual-mode="true"] [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="parent-candidate"] {
          outline: 2px dashed rgba(217, 119, 6, .8) !important;
          outline-offset: -1px;
          background-image: linear-gradient(180deg, rgba(245, 158, 11, .03), rgba(245, 158, 11, .08));
        }
        .template-edit-preview [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="linked-key"] {
          outline: 2px solid rgba(217, 119, 6, .96) !important;
          outline-offset: -1px;
          box-shadow:
            inset 0 0 0 2px rgba(217, 119, 6, .92),
            0 0 0 4px rgba(251, 191, 36, .18);
        }
        .template-edit-preview [${TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR}] {
          background-color: rgba(251, 191, 36, .28) !important;
        }
        .template-edit-preview[data-metadata-icon-visual-mode="false"] .${FRAME_KIND_MARKER_CLASS} {
          display: none;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} {
          position: absolute;
          top: 4px;
          left: 6px;
          z-index: 26;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          pointer-events: none;
          opacity: 1;
          transition: opacity .12s ease, transform .12s ease;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS}[data-compact="true"] {
          top: 1px;
          left: 1px;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} .v106-frame-kind-marker__stack {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS}[data-compact="true"] .v106-frame-kind-marker__stack {
          gap: 2px;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} .v106-frame-kind-marker__pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 16px;
          min-width: 16px;
          border-radius: 999px;
          padding: 2px;
          border: 1px solid rgba(148, 163, 184, .32);
          background: rgba(255, 255, 255, .96);
          color: rgba(15, 23, 42, .92);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS}[data-compact="true"] .v106-frame-kind-marker__pill {
          min-height: 11px;
          min-width: 11px;
          padding: 1px;
          border-radius: 999px;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} .v106-frame-kind-marker__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 12px;
          height: 12px;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS}[data-compact="true"] .v106-frame-kind-marker__icon {
          width: 8px;
          height: 8px;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} .v106-frame-kind-marker__text {
          display: none;
          margin-left: 3px;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} svg {
          width: 11px;
          height: 11px;
          display: block;
          stroke: currentColor;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS}[data-compact="true"] svg {
          width: 8px;
          height: 8px;
        }
        .template-edit-preview [data-template-selected="true"] .${FRAME_KIND_MARKER_CLASS}:not([data-compact="true"]) .v106-frame-kind-marker__text,
        .template-edit-preview [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="linked-key"] .${FRAME_KIND_MARKER_CLASS}:not([data-compact="true"]) .v106-frame-kind-marker__text,
        .template-edit-preview [${TEMPLATE_FRAME_RELATION_SELECTION_ATTR}="linked-value"] .${FRAME_KIND_MARKER_CLASS}:not([data-compact="true"]) .v106-frame-kind-marker__text {
          display: inline-block;
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="kind"][data-box-kind="text"] {
          color: rgba(15, 118, 110, .98);
          background: rgba(240, 253, 250, .98);
          border-color: rgba(153, 246, 228, .72);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="kind"][data-box-kind="attachment"] {
          color: rgba(217, 119, 6, .98);
          background: rgba(255, 251, 235, .98);
          border-color: rgba(253, 230, 138, .76);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="kind"][data-box-kind="signature"] {
          color: rgba(225, 29, 72, .98);
          background: rgba(255, 241, 242, .98);
          border-color: rgba(253, 164, 175, .76);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="kind"][data-box-kind="null"] {
          color: rgba(100, 116, 139, .95);
          background: rgba(248, 250, 252, .98);
          border-color: rgba(203, 213, 225, .9);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="role"][data-frame-role="key"] {
          color: rgba(217, 119, 6, .98);
          background: rgba(255, 251, 235, .98);
          border-color: rgba(253, 230, 138, .76);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="role"][data-frame-role="value"] {
          color: rgba(37, 99, 235, .98);
          background: rgba(239, 246, 255, .98);
          border-color: rgba(147, 197, 253, .76);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="role"][data-frame-role="key_value"],
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="role"][data-frame-role="group"] {
          color: rgba(5, 150, 105, .98);
          background: rgba(236, 253, 245, .98);
          border-color: rgba(167, 243, 208, .76);
        }
        .template-edit-preview .${FRAME_KIND_MARKER_CLASS} [data-marker-pill="role"][data-frame-role="null"] {
          color: rgba(100, 116, 139, .95);
          background: rgba(248, 250, 252, .98);
          border-color: rgba(203, 213, 225, .9);
        }
        .template-edit-preview [data-template-frame-input="true"][${TEMPLATE_FRAME_RICHTEXT_ACTIVE_ATTR}="true"] {
          opacity: 0;
        }
        .template-edit-preview .${FRAME_RICHTEXT_PREVIEW_CLASS} {
          user-select: none;
          -webkit-user-select: none;
        }
        .template-edit-preview .${FRAME_SELECTION_FILL_CLASS} {
          position: absolute;
          inset: 5px;
          z-index: 19;
          pointer-events: none;
          background: rgba(59, 130, 246, .14);
          box-shadow: inset 0 0 0 1px rgba(37, 99, 235, .22);
        }
        .template-edit-preview .${FRAME_SELECTION_BADGE_CLASS} {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 26;
          border-radius: 999px;
          background: rgba(15, 118, 110, .96);
          color: #f0fdfa;
          padding: 2px 8px;
          font-size: 10px;
          line-height: 1.2;
          font-weight: 700;
          pointer-events: none;
        }
        .template-edit-preview .${FRAME_MARQUEE_GHOST_CLASS} {
          position: absolute;
          z-index: 30;
          pointer-events: none;
          border: 1px dashed rgba(13, 148, 136, .92);
          background: rgba(20, 184, 166, .12);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .78);
        }
        .template-edit-preview .${FRAME_MARQUEE_GHOST_CLASS}[data-marquee-mode="intersected"] {
          border-color: rgba(2, 132, 199, .96);
          background: rgba(56, 189, 248, .12);
        }
        .template-edit-preview .${FRAME_CREATION_GHOST_CLASS} {
          position: absolute;
          z-index: 30;
          pointer-events: none;
          border: 1px solid rgba(15, 118, 110, .96);
          background:
            linear-gradient(180deg, rgba(15, 118, 110, .08), rgba(13, 148, 136, .12));
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, .85),
            0 0 0 1px rgba(15, 118, 110, .18);
        }
        .template-edit-preview .${FRAME_RELATIVE_ANCHOR_GUIDE_CLASS} {
          position: absolute;
          z-index: 29;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(249, 115, 22, .9), rgba(245, 158, 11, .88));
          box-shadow: 0 0 0 1px rgba(255, 255, 255, .72);
        }
        .template-edit-preview .${FRAME_RELATIVE_ANCHOR_BADGE_CLASS} {
          position: absolute;
          z-index: 31;
          pointer-events: none;
          transform: translate(-50%, -100%);
          border-radius: 999px;
          background: rgba(249, 115, 22, .96);
          color: white;
          padding: 2px 8px;
          font-size: 10px;
          line-height: 1.2;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(15, 23, 42, .18);
          white-space: nowrap;
        }
        .template-edit-preview .${FRAME_RELATIVE_ANCHOR_BADGE_CLASS}[data-relative-anchor-role="source"] {
          background: rgba(13, 148, 136, .96);
        }
        .template-edit-preview .${FRAME_RELATIVE_ANCHOR_BADGE_CLASS}[data-relative-anchor-role="relation-gap"] {
          background: rgba(59, 130, 246, .96);
        }
        .template-edit-preview .${FRAME_RELATIVE_ANCHOR_BADGE_CLASS}[data-relative-anchor-role="spacing-gap"] {
          background: rgba(5, 150, 105, .96);
        }
        .template-edit-preview [data-template-relative-anchor-target="true"] {
          box-shadow:
            0 0 0 3px rgba(249, 115, 22, .2),
            inset 0 0 0 1px rgba(249, 115, 22, .7) !important;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR} {
          position: absolute;
          z-index: 28;
          width: 12px;
          height: 12px;
          border: 2px solid white;
          border-radius: 999px;
          background: #0f766e;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .25);
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR} {
          position: absolute;
          z-index: 27;
          border: 0;
          background-color: transparent;
          background-image: none;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-mode="connected"] {
          background-color: transparent;
          background-image: none;
          box-shadow: none;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-mode="isolated"] {
          background-color: transparent;
          background-image: none;
          box-shadow: none;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-role="selected_edge_clicked"] {
          background-color: transparent;
          background-image: none;
          box-shadow: none;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-role="selected_edge_auto_multi"] {
          background-color: transparent;
          background-image: none;
          box-shadow: none;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-selection-role="peer_edge"] {
          background-color: transparent;
          background-image: none;
          box-shadow: none;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-edge-movement-mismatch="true"] {
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="left"],
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="right"] {
          top: 3px;
          bottom: 3px;
          width: 6px;
          cursor: ew-resize;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="left"] {
          left: -3px;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="right"] {
          right: -3px;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="top"],
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="bottom"] {
          left: 3px;
          right: 3px;
          height: 6px;
          cursor: ns-resize;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="top"] {
          top: -3px;
        }
        .template-edit-preview ${FRAME_EDGE_BUTTON_SELECTOR}[data-side="bottom"] {
          bottom: -3px;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="e"] {
          top: calc(50% - 6px);
          right: -6px;
          cursor: ew-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="w"] {
          top: calc(50% - 6px);
          left: -6px;
          cursor: ew-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="n"] {
          top: -6px;
          left: calc(50% - 6px);
          cursor: ns-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="s"] {
          bottom: -6px;
          left: calc(50% - 6px);
          cursor: ns-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="ne"] {
          top: -6px;
          right: -6px;
          cursor: nesw-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="nw"] {
          top: -6px;
          left: -6px;
          cursor: nwse-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="se"] {
          right: -6px;
          bottom: -6px;
          cursor: nwse-resize;
        }
        .template-edit-preview ${FRAME_RESIZE_HANDLE_SELECTOR}[data-direction="sw"] {
          left: -6px;
          bottom: -6px;
          cursor: nesw-resize;
        }
        .template-edit-preview [data-template-edit-scope][data-template-edit-enabled="true"] {
          cursor: text;
        }
      `}</style>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-EDIT-01</Badge>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-950">템플릿 편집</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              추출 페이지에서 저장한 템플릿을 불러와 div 박스를 여러 개 선택하고, 너비·높이·텍스트 크기·여백·정렬을
              한 번에 조정합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/templates/extract"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            추출 페이지
          </Link>
          <Link
            href="/templates"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            템플릿 관리
          </Link>
          <Button onClick={() => void saveTemplate()} disabled={saving || loading || !templateDetail}>
            {saving ? '저장 중...' : '현재 템플릿 저장'}
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>불러오기 및 저장</CardTitle>
          <CardDescription>
            저장된 템플릿을 불러온 뒤 이름과 레이아웃 정책을 조정하고, 편집 결과를 같은 템플릿에 다시 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">저장된 템플릿</label>
              <EntityPicker
                value={selectedTemplateId}
                options={templateOptions}
                onChange={handleSelectedTemplateChange}
                placeholder="편집할 템플릿을 선택하세요"
                emptyMessage="저장된 템플릿이 없습니다."
                optionLayout="inline"
                onDeleteOption={handleDeleteTemplateOption}
                deleteOptionLabel="템플릿 삭제"
                className="w-full"
                triggerClassName="h-11 min-h-11 items-center rounded-md py-2"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="h-11 min-h-11"
                variant="outline"
                onClick={() => void loadTemplate(selectedTemplateId)}
                disabled={loading || !selectedTemplateId.trim()}
              >
                {loading ? '불러오는 중...' : '템플릿 불러오기'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">템플릿 이름</label>
              <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">원본 문서명</label>
              <Input value={sourceDocumentName} onChange={(event) => setSourceDocumentName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">레이아웃 확장 정책</label>
              <select
                value={layoutResizeMode}
                onChange={(event) => setLayoutResizeMode(event.target.value as TemplateLayoutResizeMode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="fixed">fixed</option>
                <option value="grow_height">grow_height</option>
                <option value="grow_width">grow_width</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

  <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr] min-w-0">
        <Card className="border-slate-200 min-w-0 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>박스 편집 캔버스</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndoCanvasHistory}
                  disabled={!canUndoCanvasHistory}
                  aria-label="되돌리기"
                  title="되돌리기"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRedoCanvasHistory}
                  disabled={!canRedoCanvasHistory}
                  aria-label="다시 실행하기"
                  title="다시 실행하기"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowCanvasLegend((previous) => !previous)}>
                  {showCanvasLegend ? '범례 숨기기' : '범례 보기'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowMetadataIcons((previous) => !previous)}>
                  {showMetadataIcons ? '아이콘 끄기' : '아이콘 켜기'}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showCanvasLegend ? (
            <CardContent className="p-6 pt-0">
              <MetadataCanvasLegend />
            </CardContent>
          ) : null}
          {selectionPanelTab === 'position' && hasSelectedPositionBoxes && !positionOrderLockSelectionMode ? (
            <CardContent className="grid grid-cols-2 gap-1.5 px-6 pb-3 pt-0">
              <button
                type="button"
                className={`inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 ${
                  selectedPositionGroupingFrameGroupIds.length < 2 ? 'opacity-50' : ''
                }`}
                onClick={applySelectedPositionGroupRelationFromCanvasSelection}
              >
                박스 묶기
              </button>
              <button
                type="button"
                className={`inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 ${
                  selectedPositionGroupingFrameGroupIds.length < 2 ? 'opacity-50' : ''
                }`}
                onClick={startPositionOrderLockSelectionFromCurrentCanvasSelection}
              >
                박스 간격 고정
              </button>
            </CardContent>
          ) : null}
          {selectionPanelTab === 'position' && positionOrderLockSelectionMode ? (
            <CardContent className="px-6 pb-3 pt-0">
              <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-4 text-amber-900">
                <div>{positionOrderLockSelectionGuideText}</div>
                {positionSpacingPairSummaries.length > 0 ? (
                  <div className="space-y-1">
                    {positionSpacingPairSummaries.map((pair) => {
                      const pairDraft = positionSpacingDraftByPairKey[pair.pairKey] || {
                        gapY: String(Math.round(pair.defaultGapY)),
                      };
                      const anchorVisual = positionOrderLockSelectionVisualByGroupId.get(pair.anchorGroupId);
                      const targetVisual = positionOrderLockSelectionVisualByGroupId.get(pair.targetGroupId);

                      return (
                        <div key={pair.pairKey} className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: anchorVisual?.badgeColor || 'rgba(15, 23, 42, .92)',
                                color: anchorVisual?.badgeTextColor || '#fff',
                              }}
                            >
                              {pair.anchorLabel}
                            </span>
                            <span>→</span>
                            <span
                              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: targetVisual?.badgeColor || 'rgba(15, 23, 42, .92)',
                                color: targetVisual?.badgeTextColor || '#fff',
                              }}
                            >
                              {pair.targetLabel}
                            </span>
                          </div>
                          <div className="relative w-48 shrink-0">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                              세로 간격
                            </span>
                            <Input
                              value={pairDraft.gapY}
                              onChange={(event) => {
                                positionSpacingDraftApplyRequestedRef.current = true;
                                setPositionSpacingDraftByPairKey((previous) => ({
                                  ...previous,
                                  [pair.pairKey]: {
                                    gapY: event.target.value,
                                  },
                                }));
                              }}
                              inputMode="decimal"
                              className="h-7 pl-[52px] pr-6 text-[11px]"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                              px
                            </span>
                          </div>
                          <button
                            type="button"
                            className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                            onClick={() => removePositionOrderLockTargetSelection(pair.targetSelectionEntityId)}
                            aria-label="선택 박스 취소"
                            title="선택 박스 취소"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="pt-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={confirmPositionOrderLock}
                    disabled={positionOrderLockConfirmPreviewCount < 2}
                    className="h-7 w-full text-[11px]"
                  >
                    {positionOrderLockConfirmButtonLabel}
                  </Button>
                </div>
              </div>
            </CardContent>
          ) : null}
          <TemplateEditPreviewSurface
            renderedPreviewHtml={renderedPreviewHtml}
            boxCreationMode={boxCreationMode}
            metadataVisualMode={selectionPanelTab === 'metadata'}
            selectionPanelTab={selectionPanelTab}
            showMetadataIcons={showMetadataIcons}
            setPreviewNode={setPreviewNode}
            handlePreviewPointerDown={handlePreviewPointerDown}
            handlePreviewPointerMove={handlePreviewPointerMove}
            handlePreviewPointerUp={handlePreviewPointerUp}
            handlePreviewPointerCancel={handlePreviewPointerCancel}
            handlePreviewClickCapture={handlePreviewClickCapture}
            handlePreviewInput={handlePreviewInput}
          />
        </Card>

        <div className="space-y-6 min-w-0">
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>선택 상태</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSelectionStatus((previous) => !previous)}
                  disabled={!canShowSelectionStatus}
                >
                  {showSelectionStatus ? '상태 숨기기' : '상태 보기'}
                </Button>
              </div>
            </CardHeader>
            <CardContent ref={stylePanelRef} className="space-y-4">
              {canShowSelectionStatus && showSelectionStatus ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">진행 상태</div>
                    <div className="mt-1 truncate text-sm font-semibold text-sky-950">{selectionSaveProgress.title}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        selectionSaveProgressCompleted
                          ? 'green'
                          : selectionSaveProgressFailed
                            ? 'red'
                            : selectionSaveProgressActive
                              ? 'amber'
                              : 'slate'
                      }
                    >
                      {selectionSaveProgressCompleted
                        ? '완료'
                        : selectionSaveProgressFailed
                          ? '오류'
                          : selectionSaveProgressActive
                            ? '진행 중'
                            : '대기'}
                    </Badge>
                    <span className="font-semibold">{selectionSaveProgress.percent}%</span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={selectionSaveProgress.percent}
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      selectionSaveProgressFailed
                        ? 'bg-rose-500'
                        : selectionSaveProgressCompleted
                          ? 'bg-emerald-600'
                          : 'bg-sky-600'
                    }`}
                    style={{ width: `${selectionSaveProgress.percent}%` }}
                  />
                </div>
                <div className="mt-3 text-sm font-semibold">{selectionSaveProgress.stage}</div>
                <div className="mt-1 text-[11px] leading-5 opacity-90">
                  {selectionSaveProgress.phase === 'idle'
                    ? '선택 박스의 메타데이터와 스타일을 점검하고, 저장 중에는 진행률과 결과를 이곳에 표시합니다.'
                    : selectionSaveProgress.detail}
                </div>
                {selectionValidationIssues.length > 0 ? (
                  <div className="mt-3 rounded-md border border-rose-200 bg-white/80 p-3 text-[11px] text-rose-950">
                    <div className="font-semibold">문제가 된 박스</div>
                    <ul className="mt-2 space-y-1">
                      {selectionValidationIssues.map((issue, index) => (
                        <li key={`${issue.frameGroupId}-${index}`}>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {([
                  { id: 'summary', label: '요약' },
                  { id: 'create', label: '박스 생성' },
                  { id: 'metadata', label: '메타데이터' },
                  { id: 'position', label: '박스 위치' },
                  { id: 'text', label: '텍스트' },
                  { id: 'style', label: '스타일' },
                ] as const).map((tab) => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={selectionPanelTab === tab.id ? 'default' : 'outline'}
                    className="flex-1 md:flex-none"
                    onClick={() => setSelectionPanelTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              {selectionPanelTab === 'create' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">박스 생성</label>
                    <p className="text-xs text-slate-500">
                      캔버스에서 drag 해서 박스를 추가합니다. `relative` 는 먼저 선택한 박스 1개를 기준 anchor 로 삼고,
                      `absolute` 는 다른 박스의 resize 전파에서 제외됩니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={boxCreationMode ? 'default' : 'outline'}
                      onClick={() => {
                        clearTransientCanvasOverlays();
                        const nextMode = !boxCreationMode;

                        if (
                          nextMode &&
                          boxCreationPositionMode === 'relative' &&
                          selectedFrameGroupIdsRef.current.length !== 1
                        ) {
                          setBoxCreationPositionMode('absolute');
                          setMessage('상대 기준 박스 1개가 없어 박스 생성은 절대 위치 모드로 시작합니다.');
                        }

                        setBoxCreationMode(nextMode);
                      }}
                    >
                      {boxCreationMode ? '박스 생성 종료' : '박스 생성'}
                    </Button>
                    <select
                      value={boxCreationPositionMode}
                      onChange={(event) => setBoxCreationPositionMode(event.target.value as TemplateFramePositionMode)}
                      disabled={!boxCreationMode}
                      className="flex h-9 min-w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="relative">상대 위치</option>
                      <option value="absolute">절대 위치</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    <div>현재 생성 모드: {boxCreationMode ? '활성' : '비활성'}</div>
                    <div className="mt-1">위치 모드: {boxCreationPositionMode}</div>
                    <div className="mt-1">상대 기준 박스: {relativeCreateAnchorFrameGroupId || '미선택'}</div>
                  </div>
                </div>
              ) : null}

              {selectionPanelTab === 'summary' ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div>선택 박스 수: {selectedFrameGroupIds.length}</div>
                    <div className="mt-1 break-all">선택 ID: {selectedFrameGroupIds.join(', ') || '-'}</div>
                    <div className="mt-1">위치 관계: {primarySelectedFramePositionMode || '-'}</div>
                    <div className="mt-1">상대 기준 라벨: {primaryRelativeAnchorLabel || '-'}</div>
                    <div className="mt-1">
                      소속 박스 그룹:{' '}
                      {primarySelectedPositionBoxGroup
                        ? `${primarySelectedPositionBoxGroup.label} (${primarySelectedPositionBoxGroup.frameGroupIds.length}개)`
                        : '-'}
                    </div>
                    <div className="mt-1">위치 영향 대상 수: {primaryRelativeAffectedFrameGroupIds.length}</div>
                    <div className="mt-1 break-all">
                      위치 영향 대상 그룹: {primaryRelativeImpactGroupLabels.join(', ') || '-'}
                    </div>
                    <div className="mt-1 break-all">
                      위치 영향 대상: {primaryRelativeAffectedFrameGroupIds.join(', ') || '-'}
                    </div>
                    <div className="mt-1">선택 엣지 토큰 수: {edgeSelectionState.tokens.length}</div>
                    <div className="mt-1">선택 엣지 수: {selectedEdgeMemberCount}</div>
                    <div className="mt-1">선택 엣지 모드: {selectedEdgeMode || '-'}</div>
                    <div className="mt-1 break-all">선택 엣지 앵커: {selectedEdgeAnchorIds.join(', ') || '-'}</div>
                    <div className="mt-1">selected_edge_clicked 수: {selectedEdgeClickedCount}</div>
                    <div className="mt-1 break-all">
                      selected_edge_clicked: {edgeRoleDiagnostics.selectedEdgeClickedIds.join(', ') || '-'}
                    </div>
                    <div className="mt-1">selected_edge_auto_multi 수: {selectedEdgeAutoMultiCount}</div>
                    <div className="mt-1 break-all">
                      selected_edge_auto_multi: {edgeRoleDiagnostics.selectedEdgeAutoMultiIds.join(', ') || '-'}
                    </div>
                    <div className="mt-1">peer_edge 수: {peerEdgeCount}</div>
                    <div className="mt-1 break-all">peer_edge: {edgeRoleDiagnostics.peerEdgeIds.join(', ') || '-'}</div>
                    <div className="mt-1 break-all">
                      movement mismatch edge: {edgeRoleDiagnostics.mismatchEdgeIds.join(', ') || '-'}
                    </div>
                    <div className="mt-1">프레임 박스 수: {frameNodesAvailable}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">메타데이터 요약</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <span className="font-medium text-slate-900">Box Kind</span>
                        <div className="mt-0.5">{frameMetadataDraft.boxKind ? FRAME_BOX_KIND_LABELS[frameMetadataDraft.boxKind] : 'null'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">Role</span>
                        <div className="mt-0.5">
                          {frameMetadataDraft.role
                            ? frameMetadataDraft.role === 'group'
                              ? 'group | 그룹'
                              : FRAME_ROLE_LABELS[frameMetadataDraft.role]
                            : 'null'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">Runtime Mode</span>
                        <div className="mt-0.5">
                          {frameMetadataDraft.runtimeMode ? FRAME_RUNTIME_MODE_LABELS[frameMetadataDraft.runtimeMode] : 'null'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">현재 연결 상태</span>
                        <div className="mt-0.5">Key Box: {currentParentKeyBoxLabel}</div>
                        <div className="mt-0.5 break-all">Value Box: {valueBoxPickerSummary}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">위치 관계</label>
                      <select
                        value={primarySelectedFramePositionMode || 'relative'}
                        disabled={!canEditSingleSelection}
                        onChange={(event) =>
                          applyPrimaryFramePositionMode(event.target.value as TemplateFramePositionMode)
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="relative">relative</option>
                        <option value="absolute">absolute</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">상대 기준</label>
                      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                        {canEditSingleSelection ? primaryRelativeAnchorLabel || '-' : '단일 선택에서만 편집 가능'}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {selectionPanelTab === 'metadata' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">박스 메타데이터</label>
                    <p className="text-xs text-slate-500">
                      템플릿은 슬롯 정의만 저장하고, 실제 파일/서명 값은 템플릿을 사용하는 문서가 소유합니다.
                    </p>
                  </div>
                  <input type="hidden" data-metadata-field="valueKey" value={frameMetadataDraft.valueKey} readOnly />
                  <input
                    type="hidden"
                    data-metadata-field="parentGroupId"
                    value={frameMetadataDraft.parentGroupId}
                    readOnly
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">Box Kind</label>
                      <select
                        data-metadata-field="boxKind"
                        value={hasSelectedMetadataTarget ? frameMetadataDraft.boxKind : ''}
                        disabled={!hasSelectedMetadataTarget}
                        onChange={(event) =>
                          setFrameMetadataDraft((previous) => ({
                            ...previous,
                            boxKind: event.target.value as FrameMetadataDraft['boxKind'],
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">{hasSelectedMetadataTarget ? '혼합 / 변경 안 함' : '-'}</option>
                        {TEMPLATE_FRAME_BOX_KIND_OPTIONS.map((boxKind) => (
                          <option key={boxKind} value={boxKind}>
                            {FRAME_BOX_KIND_LABELS[boxKind]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">Role</label>
                      <select
                        data-metadata-field="role"
                        value={hasSelectedMetadataTarget ? frameMetadataDraft.role : ''}
                        disabled={!hasSelectedMetadataTarget}
                        onChange={(event) =>
                          setFrameMetadataDraft((previous) => ({
                            ...previous,
                            role: event.target.value as FrameMetadataDraft['role'],
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">{hasSelectedMetadataTarget ? '혼합 / 변경 안 함' : '-'}</option>
                        {TEMPLATE_FRAME_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {FRAME_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-800">Key Box</label>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">
                        <div className="font-semibold text-slate-900">현재 연결 예정 / 현재 연결</div>
                        <div className="mt-1">{hasSelectedMetadataTarget ? currentParentKeyBoxLabel : '-'}</div>
                        <div className="mt-2">
                          <EntityPicker
                            value={hasSelectedMetadataTarget ? frameMetadataDraft.parentGroupId : ''}
                            options={keyBoxPickerOptions as EntityPickerOption[]}
                            onChange={(value) =>
                              setFrameMetadataDraft((previous) => ({
                                ...previous,
                                parentGroupId: value,
                              }))
                            }
                            onCreateOption={(label) => upsertVirtualDefinition(label, 'key')}
                            onRenameOption={(option, nextLabel, nextId) => renameVirtualDefinition(option.id, nextLabel, nextId)}
                            onDeleteOption={(option) => deleteVirtualDefinition(option.id)}
                            createOptionLabel="저장"
                            placeholder={hasSelectedMetadataTarget ? 'Key Box 검색/선택 또는 새 정의 입력' : '-'}
                            emptyMessage="선택 가능한 Key Box가 없습니다."
                            allowClear
                            disabled={!hasSelectedMetadataTarget}
                            optionLayout="inline"
                            deleteOptionLabel="정의 삭제"
                            renameOptionLabel="정의 수정"
                            triggerClassName="h-11 min-h-11 items-center rounded-md py-2"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-800">Value Box</label>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">
                        <div className="font-semibold text-slate-900">현재 연결 예정 / 현재 연결</div>
                        <div className="mt-1 break-all">{hasSelectedMetadataTarget ? valueBoxPickerSummary : '-'}</div>
                        <div className="mt-2">
                          <EntityPicker
                            value={valueBoxPickerCurrentValue}
                            options={valueBoxPickerOptions as EntityPickerOption[]}
                            onChange={(value) => {
                              if (!primarySelectedFrameGroupId) {
                                return;
                              }
                              setMetadataRelationSelectionMode({
                                kind: 'value',
                                sourceKeyFrameGroupId: primarySelectedFrameGroupId,
                                targetFrameGroupIds: value ? [value] : [],
                              });
                            }}
                            onCreateOption={(label) => upsertVirtualDefinition(label, 'value')}
                            onRenameOption={(option, nextLabel, nextId) => renameVirtualDefinition(option.id, nextLabel, nextId)}
                            onDeleteOption={(option) => deleteVirtualDefinition(option.id)}
                            createOptionLabel="저장"
                            placeholder={canEditValueBoxField ? 'Value Box 검색/선택 또는 새 정의 입력' : '-'}
                            emptyMessage="선택 가능한 Value Box가 없습니다."
                            allowClear
                            disabled={!canEditValueBoxField}
                            optionLayout="inline"
                            deleteOptionLabel="정의 삭제"
                            renameOptionLabel="정의 수정"
                            triggerClassName="h-11 min-h-11 items-center rounded-md py-2"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-800">Runtime Mode</label>
                      <select
                        data-metadata-field="runtimeMode"
                        value={hasSelectedMetadataTarget ? frameMetadataDraft.runtimeMode : ''}
                        disabled={!hasSelectedMetadataTarget}
                        onChange={(event) =>
                          setFrameMetadataDraft((previous) => ({
                            ...previous,
                            runtimeMode: event.target.value as FrameMetadataDraft['runtimeMode'],
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">{hasSelectedMetadataTarget ? '혼합 / 자동 기본값 사용' : '-'}</option>
                        {runtimeModeOptions.map((runtimeMode) => (
                          <option key={runtimeMode} value={runtimeMode}>
                            {FRAME_RUNTIME_MODE_LABELS[runtimeMode]}
                          </option>
                        ))}
                      </select>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">
                        <div className="font-semibold text-slate-900">현재 선택 설명</div>
                        <div className="mt-1">{frameRuntimeModeHelpText}</div>
                        <div className="mt-2 space-y-1">
                          {runtimeModeOptions.map((runtimeMode) => (
                            <div key={runtimeMode}>
                              <span className="font-medium text-slate-900">{FRAME_RUNTIME_MODE_LABELS[runtimeMode]}</span>
                              {' - '}
                              {FRAME_RUNTIME_MODE_DESCRIPTIONS[runtimeMode]}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectionPanelTab === 'position' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">박스 위치 관계</label>
                    <p className="text-xs text-slate-500">
                      박스(또는 div) 사이 세로 간격을 고정합니다. 높이상 위/아래 관계가 명확한 박스 연결을 우선 적용합니다.
                    </p>
                  </div>
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    <div className="font-semibold text-slate-900">{selectedPositionInfoTitle}</div>
                    {hasSelectedPositionBoxes ? (
                      <>
                        {canClearSelectedPositionGroups ? (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearSelectedPositionGroupRelation}
                              className="w-full"
                            >
                              선택 박스 그룹 해제
                            </Button>
                          </div>
                        ) : null}
                        <div className="mt-1">선택 박스 수: {selectedPositionInfoCount}</div>
                        <div className="mt-1 break-all">선택 ID: {selectedPositionDisplayIds.join(', ') || '-'}</div>
                        <div className="mt-1">위치 관계: {selectedPositionModeLabel || '-'}</div>
                        <div className="mt-1">상대 기준 라벨: {selectedPositionAnchorLabel || '-'}</div>
                        <div className="mt-1">
                          소속 박스 그룹:{' '}
                          {selectedPositionCurrentBoxGroupLabels.join(', ') || '-'}
                        </div>
                        <div className="mt-1 break-all">
                          중첩 박스 그룹 정보: {selectedPositionNestedGroupInfoLines.join(' | ') || '-'}
                        </div>
                        <div className="mt-1">위치 영향 대상 수: {selectedPositionImpactFrameGroupIds.length}</div>
                        <div className="mt-1 break-all">위치 영향 대상 그룹: {selectedPositionImpactGroupLabels.join(', ') || '-'}</div>
                        <div className="mt-1 break-all">위치 영향 대상: {selectedPositionImpactFrameGroupIds.join(', ') || '-'}</div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1">템플렛 박스 수: {availableFrameGroupIds.length}</div>
                        <div className="mt-1">정의된 상대 위치 관계 수: {definedPositionRelativeRelationDisplayRows.length}</div>
                      </>
                    )}

                    {hasSelectedPositionBoxes && selectedRelativeFrameGroupIds.length > 0 ? (
                      <div className="mt-2 space-y-1 rounded border border-slate-200 bg-white p-2">
                        <div>
                          선택한 {selectedFrameGroupIds.length}개의 박스 중 {selectedRelativeFrameGroupIds.length}개의 상대 위치를
                          해제할 수 있습니다.
                        </div>
                        <Button size="sm" variant="outline" onClick={clearSelectedRelativeFramePositions}>
                          상대 위치 해제
                        </Button>
                      </div>
                    ) : null}

                  </div>

                  {positionBoxGroups.length > 0 ? (
                    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                      <div className="font-semibold text-slate-900">전체 박스 그룹 ({positionBoxGroups.length}개)</div>
                      {positionBoxGroups.map((group) => {
                        const isSelectedGroup = primarySelectedPositionBoxGroup?.id === group.id;
                        const isExpanded = Boolean(expandedPositionBoxGroupIds[group.id]);

                        return (
                          <div
                            key={group.id}
                            className={`rounded border p-2 text-xs ${
                              isSelectedGroup
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-amber-300 bg-amber-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="flex flex-1 items-center gap-1 text-left"
                                onClick={() => {
                                  const groupSelectionIds = group.frameGroupIds
                                    .map((frameGroupId) => frameGroupId.trim())
                                    .filter((frameGroupId) => Boolean(frameGroupId));
                                  if (groupSelectionIds.length <= 0) {
                                    return;
                                  }

                                  applyFrameBoxSelection(
                                    groupSelectionIds,
                                    {
                                      positionGroupProxySelectionGroupId: group.id,
                                    }
                                  );
                                }}
                              >
                                <span className="font-medium text-slate-800">
                                  {group.label}{' '}
                                  <span className="font-normal text-slate-500">({group.frameGroupIds.length}개)</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="h-5 min-w-5 rounded border border-slate-300 bg-white px-1 text-[11px] font-semibold leading-none text-slate-700"
                                onClick={() =>
                                  setExpandedPositionBoxGroupIds((previous) => ({
                                    ...previous,
                                    [group.id]: !previous[group.id],
                                  }))
                                }
                                aria-label={isExpanded ? '소속 div 숨기기' : '소속 div 보기'}
                              >
                                {isExpanded ? '−' : '+'}
                              </button>
                            </div>
                            {isExpanded ? (
                              <div className="mt-1 break-all text-slate-600">{group.frameGroupIds.join(', ')}</div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {shouldShowDefinedPositionRelativeRelations ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                      <div className="font-semibold text-slate-900">정의된 박스 상대 위치 관계</div>
                      <div className="mt-1">총 {definedPositionRelativeRelationDisplayRows.length}개</div>
                      <div className="mt-2 space-y-2">
                        {focusedDefinedPositionRelativeRelations.map((relation, relationIndex) => {
                          const displayRow = definedPositionRelativeRelationDisplayRows.find((row) => row.key === relation.key);
                          const relationDraft = definedPositionRelationGapDraftByKey[relation.key] || {
                            gapY: String(Math.round(relation.gapYPx)),
                          };

                          return (
                            <div key={relation.key} className="space-y-1 rounded border border-slate-200 bg-white p-2">
                              <div className="break-all text-[11px] text-slate-700">
                                {relationIndex + 1}. {displayRow?.targetLabel || relation.targetLabel} ←{' '}
                                {displayRow?.anchorLabel || relation.anchorLabel}
                              </div>
                              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                                <span className="w-20 shrink-0">세로 간격</span>
                                <Input
                                  value={relationDraft.gapY}
                                  onChange={(event) => {
                                    applyDefinedPositionRelationGapDraft(relation, event.target.value);
                                  }}
                                  inputMode="decimal"
                                  className="h-8 text-xs"
                                />
                                <span className="text-[10px] text-slate-500">px</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selectionPanelTab === 'text' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">박스 텍스트</label>
                    <p className="text-xs text-slate-500">
                      현재 선택한 박스의 텍스트를 편집합니다. 여러 박스를 선택하면 같은 값으로 일괄 반영됩니다.
                    </p>
                  </div>
                  <textarea
                    value={selectionTextDraft}
                    onChange={(event) => {
                      setSelectionTextDraft(event.target.value);
                      setSelectionTextMixed(false);
                    }}
                    placeholder={selectionTextMixed ? '여러 박스의 텍스트가 서로 다릅니다.' : '선택한 박스 텍스트'}
                    className="min-h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{selectedFrameGroupIds.length > 0 ? `${selectedFrameGroupIds.length}개 박스 선택됨` : '선택된 박스 없음'}</span>
                    <Button size="sm" onClick={() => applySelectionTextDraft()} disabled={selectedFrameGroupIds.length === 0}>
                      텍스트 반영
                    </Button>
                  </div>
                </div>
              ) : null}

              {selectionPanelTab === 'style' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">빠른 프리셋</label>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => stageSelectionStylePreset(presetStylePatches.label)}>
                        라벨형
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => stageSelectionStylePreset(presetStylePatches.input)}>
                        입력칸형
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => stageSelectionStylePreset(presetStylePatches.body)}>
                        본문형
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => stageSelectionStylePreset(presetStylePatches.focus)}>
                        강조형
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        너비 (px)
                        {renderStyleApplyStatusIcon('width')}
                      </label>
                      <Input
                        data-style-field="width"
                        value={selectionStyleDraft.width}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('width', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('width')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        높이 (px)
                        {renderStyleApplyStatusIcon('height')}
                      </label>
                      <Input
                        data-style-field="height"
                        value={selectionStyleDraft.height}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('height', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('height')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        폰트 크기
                        {renderStyleApplyStatusIcon('fontSize')}
                      </label>
                      <Input
                        data-style-field="fontSize"
                        value={selectionStyleDraft.fontSize}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('fontSize', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('fontSize')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        줄 간격
                        {renderStyleApplyStatusIcon('lineHeight')}
                      </label>
                      <Input
                        data-style-field="lineHeight"
                        value={selectionStyleDraft.lineHeight}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('lineHeight', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('lineHeight')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        좌우 여백
                        {renderStyleApplyStatusIcon('paddingX')}
                      </label>
                      <Input
                        data-style-field="paddingX"
                        value={selectionStyleDraft.paddingX}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('paddingX', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('paddingX')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        상하 여백
                        {renderStyleApplyStatusIcon('paddingY')}
                      </label>
                      <Input
                        data-style-field="paddingY"
                        value={selectionStyleDraft.paddingY}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('paddingY', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('paddingY')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        모서리 반경
                        {renderStyleApplyStatusIcon('borderRadius')}
                      </label>
                      <Input
                        data-style-field="borderRadius"
                        value={selectionStyleDraft.borderRadius}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('borderRadius', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('borderRadius')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        글자 굵기
                        {renderStyleApplyStatusIcon('fontWeight')}
                      </label>
                      <Input
                        data-style-field="fontWeight"
                        value={selectionStyleDraft.fontWeight}
                        placeholder="혼합"
                        onChange={(event) => setStyleFieldDraftValue('fontWeight', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('fontWeight')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        정렬
                        {renderStyleApplyStatusIcon('textAlign')}
                      </label>
                      <select
                        data-style-field="textAlign"
                        value={selectionStyleDraft.textAlign}
                        onChange={(event) => setStyleFieldDraftValue('textAlign', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('textAlign')}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="left">left</option>
                        <option value="center">center</option>
                        <option value="right">right</option>
                        <option value="justify">justify</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        글자 색
                        {renderStyleApplyStatusIcon('color')}
                      </label>
                      <Input
                        data-style-field="color"
                        type="color"
                        value={selectionStyleDraft.color}
                        onChange={(event) => setStyleFieldDraftValue('color', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('color')}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        배경 색
                        {renderStyleApplyStatusIcon('backgroundColor')}
                      </label>
                      <Input
                        data-style-field="backgroundColor"
                        value={selectionStyleDraft.backgroundColor}
                        placeholder="transparent"
                        onChange={(event) => setStyleFieldDraftValue('backgroundColor', event.target.value)}
                        onBlur={() => applyStyleFieldOnBlur('backgroundColor')}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
