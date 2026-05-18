import type { TemplateEdgeSide } from '../../../lib/templateEdgeSelectionDtos';
import type {
  TemplateFrameBoxKind,
  TemplateFrameResizeDirection,
  TemplateFrameRole,
  TemplateFrameRuntimeMode,
} from '../../../lib/templateFrameEditDtos';
import type {
  AppearanceBoxModelTarget,
  AppearanceCorner,
  AppearancePaddingSide,
  CanvasIconScale,
  EdgeRoleDiagnosticsState,
  FrameMetadataDraft,
  MetadataVirtualConnectionDraft,
  SelectionSaveProgressState,
  SelectionStyleDraft,
  StyleFieldApplyState,
  StyleFieldKey,
  TemplateFloatingOverlayId,
  TemplateFrameRelativeAnchorConfig,
} from './types';

export const POSITION_LOCK_COLOR_PRESETS = [
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
  {
    colorName: '분홍색',
    outlineColor: 'rgba(219, 39, 119, .98)',
    fillColor: 'rgba(244, 114, 182, .12)',
    haloColor: 'rgba(244, 114, 182, .3)',
    badgeColor: 'rgba(190, 24, 93, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '하늘색',
    outlineColor: 'rgba(2, 132, 199, .98)',
    fillColor: 'rgba(56, 189, 248, .12)',
    haloColor: 'rgba(56, 189, 248, .3)',
    badgeColor: 'rgba(3, 105, 161, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '라임색',
    outlineColor: 'rgba(101, 163, 13, .98)',
    fillColor: 'rgba(163, 230, 53, .12)',
    haloColor: 'rgba(163, 230, 53, .3)',
    badgeColor: 'rgba(77, 124, 15, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '자홍색',
    outlineColor: 'rgba(192, 38, 211, .98)',
    fillColor: 'rgba(232, 121, 249, .12)',
    haloColor: 'rgba(232, 121, 249, .3)',
    badgeColor: 'rgba(162, 28, 175, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '황색',
    outlineColor: 'rgba(217, 119, 6, .98)',
    fillColor: 'rgba(251, 191, 36, .12)',
    haloColor: 'rgba(251, 191, 36, .3)',
    badgeColor: 'rgba(180, 83, 9, .96)',
    badgeTextColor: '#fff',
  },
  {
    colorName: '슬레이트색',
    outlineColor: 'rgba(71, 85, 105, .98)',
    fillColor: 'rgba(148, 163, 184, .12)',
    haloColor: 'rgba(148, 163, 184, .3)',
    badgeColor: 'rgba(51, 65, 85, .96)',
    badgeTextColor: '#fff',
  },
] as const;

export const POSITION_STABLE_COLOR_INDEX_ORDER = [0, 1, 4, 3, 2, 6, 5, 10, 7, 9, 8, 11] as const;

export const RAW_FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
export const FRAME_SELECTION_NODE_SELECTOR = RAW_FRAME_NODE_SELECTOR;
export const FRAME_SELECTION_BADGE_CLASS = 'v106-frame-selection-badge';
export const FRAME_DELETE_BUTTON_CLASS = 'v106-frame-delete-button';
export const FRAME_DELETE_BUTTON_ATTR = 'data-v106-frame-delete-button';
export const FRAME_DELETE_KIND_ATTR = 'data-v106-frame-delete-kind';
export const FRAME_DELETE_TARGET_ID_ATTR = 'data-v106-frame-delete-target-id';
export const FRAME_RELATION_BADGE_CLASS = 'v106-frame-relation-badge';
export const FRAME_REVIEW_WARNING_BUTTON_CLASS = 'v106-frame-review-warning-button';
export const FRAME_REVIEW_WARNING_POPOVER_CLASS = 'v106-frame-review-warning-popover';
export const FRAME_KIND_MARKER_CLASS = 'v106-frame-kind-marker';
export const FRAME_RESIZE_HANDLE_SELECTOR = '[data-v106-resize-handle="true"]';
export const FRAME_EDGE_BUTTON_SELECTOR = '[data-v106-edge-button="true"]';
export const FRAME_MARQUEE_GHOST_CLASS = 'v106-frame-marquee';
export const FRAME_CREATION_GHOST_CLASS = 'v106-frame-create-ghost';
export const FRAME_MARQUEE_AUTOSCROLL_HOT_ZONE_PX = 48;
export const FRAME_MARQUEE_AUTOSCROLL_MAX_SPEED_PX = 24;
export const FRAME_OUTLINE_OVERLAY_ATTR = 'data-v106-frame-outline-overlay';
export const FRAME_CLUSTER_OUTLINE_OVERLAY_ATTR = 'data-v106-frame-cluster-outline-overlay';
export const FRAME_SELECTED_SIDE_INDICATOR_ATTR = 'data-v106-frame-selected-side-indicator';
export const FRAME_SELECTION_FILL_CLASS = 'v106-frame-selection-fill';
export const FRAME_SELECTION_VISUAL_ATTR = 'data-v106-frame-selection-visual';
export const FRAME_SELECTION_LABEL_ATTR = 'data-template-selection-label';
export const TEMPLATE_POSITION_SPACING_SELECTION_VISUAL_ATTR = 'data-template-position-spacing-selection-visual';
export const FRAME_RICHTEXT_PREVIEW_CLASS = 'v106-frame-richtext-preview';
export const TEMPLATE_FRAME_VALIDATION_ERROR_ATTR = 'data-template-validation-error';
export const TEMPLATE_FRAME_REVIEW_WARNING_ATTR = 'data-template-review-warning';
export const TEMPLATE_NATIVE_OUTLINE_HIDDEN_ATTR = 'data-template-native-outline-hidden';
export const TEMPLATE_FRAME_POSITION_MODE_ATTR = 'data-template-frame-position-mode';
export const TEMPLATE_FRAME_BASE_HEIGHT_ATTR = 'data-template-frame-base-height';
export const TEMPLATE_FRAME_BASE_FONT_SIZE_ATTR = 'data-template-frame-base-font-size';
export const TEMPLATE_FRAME_BASE_LINE_HEIGHT_ATTR = 'data-template-frame-base-line-height';
export const TEMPLATE_FRAME_RICHTEXT_ACTIVE_ATTR = 'data-template-frame-richtext-active';
export const TEMPLATE_FRAME_AUTO_HEIGHT_ATTR = 'data-template-frame-auto-height';
export const TEMPLATE_FRAME_AUTO_HEIGHT_BASE_ATTR = 'data-template-frame-auto-height-base';
export const TEMPLATE_FRAME_AUTO_HEIGHT_BASE_EXPLICIT_ATTR = 'data-template-frame-auto-height-base-explicit';
export const TEMPLATE_FRAME_AUTO_WIDTH_ATTR = 'data-template-frame-auto-width';
export const TEMPLATE_FRAME_AUTO_WIDTH_BASE_ATTR = 'data-template-frame-auto-width-base';
export const TEMPLATE_FRAME_AUTO_WIDTH_BASE_EXPLICIT_ATTR = 'data-template-frame-auto-width-base-explicit';
export const TEMPLATE_FRAME_AUTO_SIZE_ANCHOR_ATTR = 'data-template-frame-auto-size-anchor';
export const TEMPLATE_FRAME_LABEL_ATTR = 'data-template-frame-label';
export const TEMPLATE_FRAME_ROLE_ATTR = 'data-template-frame-role';
export const TEMPLATE_FRAME_VALUE_KEY_ATTR = 'data-template-frame-value-key';
export const TEMPLATE_FRAME_PARENT_GROUP_ATTR = 'data-template-frame-parent-group';
export const TEMPLATE_FRAME_BOX_KIND_ATTR = 'data-template-box-kind';
export const TEMPLATE_FRAME_RUNTIME_MODE_ATTR = 'data-template-runtime-mode';
export const TEMPLATE_VIRTUAL_FRAME_DEFINITIONS_ATTR = 'data-template-virtual-frame-definitions';
export const TEMPLATE_FRAME_FIELD_TYPE_ATTR = 'data-template-frame-field-type';
export const TEMPLATE_FRAME_COLOR_GROUP_ATTR = 'data-template-frame-color-group';
export const TEMPLATE_FRAME_VISUAL_EMPHASIS_ATTR = 'data-template-frame-visual-emphasis';
export const TEMPLATE_FRAME_ROLE_VISUAL_ATTR = 'data-template-frame-role-visual';
export const TEMPLATE_FRAME_BOX_KIND_VISUAL_ATTR = 'data-template-frame-box-kind-visual';
export const TEMPLATE_FRAME_VISUAL_HINTS_SIGNATURE_ATTR = 'data-v106-frame-visual-hints-signature';
export const TEMPLATE_USAGE_PREVIEW_MODE_ATTR = 'data-template-usage-preview-mode';
export const TEMPLATE_USAGE_PREVIEW_VALUE_BOX_ATTR = 'data-template-usage-preview-value-box';
export const TEMPLATE_USAGE_PREVIEW_CONTROL_ATTR = 'data-template-usage-preview-control';
export const TEMPLATE_USAGE_PREVIEW_FILE_INPUT_ATTR = 'data-template-usage-preview-file-input';
export const TEMPLATE_USAGE_PREVIEW_FILE_MODE_ATTR = 'data-template-usage-preview-file-mode';
export const TEMPLATE_USAGE_PREVIEW_FILE_DISPLAY_ATTR = 'data-template-usage-preview-file-display';
export const TEMPLATE_USAGE_PREVIEW_FILE_LIST_ATTR = 'data-template-usage-preview-file-list';
export const TEMPLATE_USAGE_PREVIEW_FILE_NAMES_ATTR = 'data-template-usage-preview-file-names';
export const TEMPLATE_USAGE_PREVIEW_FILE_ADD_ATTR = 'data-template-usage-preview-file-add';
export const TEMPLATE_USAGE_PREVIEW_FILE_REMOVE_ATTR = 'data-template-usage-preview-file-remove';
export const TEMPLATE_USAGE_PREVIEW_FILE_INDEX_ATTR = 'data-template-usage-preview-file-index';
export const TEMPLATE_USAGE_PREVIEW_CONTEXT_KEY_ATTR = 'data-template-usage-preview-context-key';
export const TEMPLATE_USAGE_PREVIEW_RUNTIME_MODE_ATTR = 'data-template-usage-preview-runtime-mode';
export const TEMPLATE_USAGE_PREVIEW_LABEL_ATTR = 'data-template-usage-preview-label';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_CANVAS_ATTR = 'data-template-usage-preview-signature-canvas';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_CLEAR_ATTR = 'data-template-usage-preview-signature-clear';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_IMAGE_DATA_ATTR = 'data-template-usage-preview-signature-image-data';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_STATUS_ATTR = 'data-template-usage-preview-signature-status';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_SIGNER_NAME_ATTR = 'data-template-usage-preview-signature-signer-name';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_SIGNED_AT_ATTR = 'data-template-usage-preview-signature-signed-at';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_PROVIDER_ATTR = 'data-template-usage-preview-signature-provider';
export const TEMPLATE_USAGE_PREVIEW_SIGNATURE_HISTORY_ATTR = 'data-template-usage-preview-signature-history';
export const TEMPLATE_PREVIEW_EDIT_PERMISSIONS_TAB_ATTR = 'data-v106-edit-permissions-tab';
export const TEMPLATE_PREVIEW_CONTENT_STABILIZED_ATTR = 'data-v106-content-stabilized';
export const TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR = 'data-template-frame-relative-anchor-kind';
export const TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR = 'data-template-frame-relative-anchor-id';
export const TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR = 'data-template-frame-relative-anchor-x';
export const TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR = 'data-template-frame-relative-anchor-y';
export const TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR = 'data-template-frame-relative-offset-x';
export const TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR = 'data-template-frame-relative-offset-y';
export const TEMPLATE_FRAME_RELATION_SELECTION_ATTR = 'data-template-frame-relation-selection';
export const TEMPLATE_FRAME_METADATA_RELATION_OUTLINE_ATTR = 'data-template-metadata-relation-outline';
export const TEMPLATE_FRAME_METADATA_RELATION_ROLE_ATTR = 'data-template-metadata-relation-role';
export const TEMPLATE_FRAME_METADATA_FOCUS_ATTR = 'data-template-metadata-focus';
export const TEMPLATE_METADATA_ACTIVE_FILTER_ATTR = 'data-template-metadata-active-filter';
export const TEMPLATE_METADATA_RELATION_RENDER_SIGNATURE_ATTR = 'data-v106-metadata-relation-render-signature';
export const TEMPLATE_FRAME_POSITION_IMPACT_GROUP_ATTR = 'data-template-frame-position-impact-group';
export const TEMPLATE_FRAME_POSITION_IMPACT_FOCUS_ATTR = 'data-template-position-impact-focus';
export const TEMPLATE_POSITION_IMPACT_ACTIVE_FILTER_ATTR = 'data-template-position-impact-active-filter';
export const SELECTION_TONEDOWN_OVERLAY_ATTR = 'data-v106-selection-tonedown-overlay';
export const SELECTION_TONEDOWN_OVERLAY_MODE_ATTR = 'data-v106-selection-tonedown-mode';
export const SELECTION_TONEDOWN_OVERLAY_TARGET_ATTR = 'data-v106-selection-tonedown-target';
export const TEMPLATE_FRAME_POSITION_GROUP_ID_ATTR = 'data-template-frame-position-group-id';
export const TEMPLATE_FRAME_POSITION_GROUP_LABEL_ATTR = 'data-template-frame-position-group-label';
export const TEMPLATE_FRAME_POSITION_GROUP_MANAGED_ATTR = 'data-template-frame-position-group-managed';
export const TEMPLATE_POSITION_GROUP_TREE_ATTR = 'data-template-position-group-tree';
export const TEMPLATE_POSITION_GROUP_NODE_ATTR = 'data-template-position-group-node';
export const TEMPLATE_POSITION_GROUP_NODE_ID_ATTR = 'data-template-position-group-id';
export const TEMPLATE_POSITION_GROUP_NODE_LABEL_ATTR = 'data-template-position-group-label';
export const POSITION_GROUP_LABEL_PREFIX = '그룹';
export const TEMPLATE_FRAME_POSITION_RELATION_ACTIVE_ATTR = 'data-template-frame-position-relation-active';
export const TEMPLATE_FRAME_POSITION_RELATION_ANCHOR_ATTR = 'data-template-frame-position-relation-anchor';
export const FRAME_RELATIVE_ANCHOR_GUIDE_CLASS = 'v106-frame-relative-anchor-guide';
export const FRAME_RELATIVE_ANCHOR_BADGE_CLASS = 'v106-frame-relative-anchor-badge';
export const CREATED_FRAME_GROUP_PREFIX = 'user-box';
export const POSITION_SUMMARY_LIST_COLLAPSE_THRESHOLD = 5;
export const SUMMARY_OVERLAY_INSET_PX = 12;
export const FLOATING_OVERLAY_STACK_GAP_PX = 12;
export const SUMMARY_OVERLAY_COLLAPSED_HEIGHT_PX = 32;
export const SUMMARY_OVERLAY_CLICK_DRAG_THRESHOLD_PX = 4;
export const POSITION_FLOATING_OVERLAY_STACK_ORDER: TemplateFloatingOverlayId[] = [
  'summary',
  'style',
  'sizeType',
  'textStyle',
  'action',
];
export const METADATA_FLOATING_OVERLAY_STACK_ORDER: TemplateFloatingOverlayId[] = [
  'summary',
  'metadataName',
  'metadataRolePrimary',
  'metadataRoleSecondary',
  'metadataRoleTertiary',
];

export const SHARED_VIRTUAL_FRAME_DEFINITIONS_STORAGE_KEY = 'docs:template:shared-virtual-frame-definitions';

export const emptyEdgeRoleDiagnosticsState: EdgeRoleDiagnosticsState = {
  selectedEdgeClickedIds: [],
  selectedEdgeAutoMultiIds: [],
  peerEdgeIds: [],
  mismatchEdgeIds: [],
};

export const defaultSelectionSaveProgressState: SelectionSaveProgressState = {
  phase: 'idle',
  title: '진행 상태',
  percent: 0,
  stage: '작업 대기 중입니다.',
  detail: '선택한 상자의 메타데이터와 스타일을 저장하면 진행률이 여기에 표시됩니다.',
};

export const FRAME_RESIZE_DIRECTIONS: TemplateFrameResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export const CANVAS_ICON_SCALE_OPTIONS: CanvasIconScale[] = ['s', 'm', 'l'];
export const TEMPLATE_FRAME_BOX_KIND_OPTIONS: TemplateFrameBoxKind[] = ['text', 'attachment', 'signature'];
export const TEMPLATE_FRAME_ROLE_OPTIONS: TemplateFrameRole[] = ['key', 'value', 'key_value'];
export const TEXT_RUNTIME_MODE_OPTIONS: TemplateFrameRuntimeMode[] = ['static_label', 'editable_text'];
export const TEMPLATE_PREVIEW_TEXT_CANVAS_EDIT_MODE_ATTR = 'data-v106-text-canvas-edit-mode';
export const ATTACHMENT_RUNTIME_MODE_OPTIONS: TemplateFrameRuntimeMode[] = ['file_slot'];
export const APPEARANCE_TARGET_BY_STYLE_FIELD: Partial<Record<StyleFieldKey, AppearanceBoxModelTarget>> = {
  width: 'content',
  height: 'content',
  backgroundColor: 'content',
  borderWidth: 'border',
  borderColor: 'border',
  borderStyle: 'border',
  borderAlign: 'border',
  borderRadius: 'corner',
};
export const SIGNATURE_RUNTIME_MODE_OPTIONS: TemplateFrameRuntimeMode[] = [
  'signature_image',
  'signature_history',
  'signature_signer_name',
  'signature_signed_at',
  'signature_provider',
  'signature_status',
];
export const FRAME_BOX_KIND_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: 'text | 텍스트 상자',
  attachment: 'attachment | 첨부파일 상자',
  signature: 'signature | 서명 상자',
};
export const FRAME_BOX_KIND_SHORT_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: '텍스트 상자',
  attachment: '첨부파일 상자',
  signature: '서명 상자',
};
export const FRAME_BOX_KIND_BUTTON_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: '텍스트',
  attachment: '첨부파일',
  signature: '서명',
};
export const FRAME_BOX_KIND_ACTIVE_BUTTON_CLASSES: Record<TemplateFrameBoxKind, string> = {
  text: 'border-transparent bg-slate-700 text-white',
  attachment: 'border-transparent bg-purple-600 text-white',
  signature: 'border-transparent bg-red-600 text-white',
};
export const FRAME_BOX_KIND_MARKER_LABELS: Record<TemplateFrameBoxKind, string> = {
  text: '텍스트',
  attachment: '첨부',
  signature: '서명',
};
export const NULL_MARKER_LABEL = '-';
export const FRAME_BOX_KIND_DESCRIPTIONS: Record<TemplateFrameBoxKind, string> = {
  text: '문서마다 텍스트를 직접 입력하거나, 고정 라벨처럼 보여주는 상자입니다.',
  attachment: '문서마다 파일을 업로드하고 파일명 표시, 파일 열기 동작을 연결하는 상자입니다.',
  signature: '문서마다 서명 컨텍스트를 연결하고 이미지, 이력, 상태 같은 정보를 출력하는 상자입니다.',
};
export const FRAME_ROLE_LABELS: Record<TemplateFrameRole, string> = {
  key: 'key | 상위 키',
  value: 'value | 하위 값',
  key_value: 'key_value | 독립 값',
};
export const FRAME_ROLE_SHORT_LABELS: Record<TemplateFrameRole | 'group', string> = {
  group: '그룹',
  key: '상위 키',
  value: '하위 값',
  key_value: '독립 값',
};
export const FRAME_ROLE_ACTIVE_BUTTON_CLASSES: Record<TemplateFrameRole, string> = {
  key: 'border-transparent bg-amber-500 text-white',
  value: 'border-transparent bg-sky-500 text-white',
  key_value: 'border-transparent bg-slate-500 text-white',
};
export const FRAME_ROLE_DESCRIPTIONS: Record<TemplateFrameRole, string> = {
  key: '다른 value 상자를 묶을 수 있는 기준 역할입니다. 연결이 없어도 key 역할 자체는 유지됩니다.',
  value: '입력값 역할입니다. key 연결이 없으면 확인 필요 상태로 표시되지만 저장을 막지는 않습니다.',
  key_value: '상위 key 없이 자기 자신이 하나의 완결된 값이 되는 독립 상자입니다.',
};
export const FRAME_RUNTIME_MODE_LABELS: Record<TemplateFrameRuntimeMode, string> = {
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
export const FRAME_RUNTIME_MODE_DESCRIPTIONS: Record<TemplateFrameRuntimeMode, string> = {
  static_label: '문서에서 수정되지 않는 고정 텍스트 라벨로 사용합니다.',
  editable_text: '문서마다 사용자가 직접 입력하거나 수정하는 텍스트 값으로 사용합니다.',
  file_slot: '문서마다 파일을 업로드해 연결하는 슬롯입니다. 업로드 후에는 파일명과 파일 열기 동작을 가집니다.',
  signature_image: '서명 이미지만 출력하는 상자입니다. 실제 서명 이미지는 문서별 서명 데이터에서 가져옵니다.',
  signature_history: '서명 요청, 인증, 완료 같은 이력 로그를 출력하는 상자입니다.',
  signature_signer_name: '서명한 사람의 이름이나 표시명을 출력하는 상자입니다.',
  signature_signed_at: '실제 서명이 완료된 시각을 출력하는 상자입니다.',
  signature_provider: '본인확인 또는 서명 인증에 사용된 제공자 정보를 출력하는 상자입니다.',
  signature_status: '서명 대기, 완료, 실패 같은 현재 상태를 출력하는 상자입니다.',
};
export const EDGE_DRAG_START_THRESHOLD_PX = 4;
export const EDGE_DRAG_AUTOSNAP_THRESHOLD_PX = 5;
export const EDGE_DRAG_AUTOSNAP_RELEASE_THRESHOLD_PX = 8;
export const EDGE_DRAG_AUTOSNAP_SPAN_TOUCH_TOLERANCE_PX = 1;
export const FRAME_MOVE_DRAG_THRESHOLD_PX = 4;
export const FRAME_MARQUEE_DRAG_THRESHOLD_PX = 4;
export const FRAME_CLUSTER_TOUCH_TOLERANCE_PX = 1.5;
export const DEFAULT_RELATIVE_PAGE_ANCHORS: Record<string, TemplateFrameRelativeAnchorConfig> = {
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
export const DEFAULT_ABSOLUTE_FRAME_GROUP_IDS = new Set(['band-19-footer']);
export const PAGE_CORNER_ANCHOR_LABELS: Record<string, string> = {
  'page-top-left': '페이지 좌상단 기준',
  'page-top-right': '페이지 우상단 기준',
  'page-bottom-left': '페이지 좌하단 기준',
  'page-bottom-right': '페이지 우하단 기준',
};

export const defaultSelectionStyleDraft: SelectionStyleDraft = {
  width: '',
  height: '',
  fontSize: '',
  lineHeight: '',
  paddingTop: '',
  paddingBottom: '',
  paddingLeft: '',
  paddingRight: '',
  borderRadius: '',
  fontFamily: '',
  fontWeight: '',
  fontStyle: '',
  textDecorationLine: '',
  textAlign: 'left',
  color: '#0f172a',
  backgroundColor: 'transparent',
  borderColor: '',
  borderWidth: '',
  borderStyle: '',
  borderAlign: '',
};

export const defaultStyleFieldApplyStatus: Record<StyleFieldKey, StyleFieldApplyState> = {
  width: 'idle',
  height: 'idle',
  fontSize: 'idle',
  lineHeight: 'idle',
  paddingTop: 'idle',
  paddingBottom: 'idle',
  paddingLeft: 'idle',
  paddingRight: 'idle',
  borderRadius: 'idle',
  fontFamily: 'idle',
  fontWeight: 'idle',
  fontStyle: 'idle',
  textDecorationLine: 'idle',
  textAlign: 'idle',
  color: 'idle',
  backgroundColor: 'idle',
  borderColor: 'idle',
  borderWidth: 'idle',
  borderStyle: 'idle',
  borderAlign: 'idle',
};

export const SELECTION_STYLE_DRAFT_FIELD_KEYS: StyleFieldKey[] = [
  'width',
  'height',
  'fontSize',
  'lineHeight',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'borderRadius',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'textDecorationLine',
  'textAlign',
  'color',
  'backgroundColor',
  'borderColor',
  'borderWidth',
  'borderStyle',
  'borderAlign',
];

export const FRAME_BORDER_STYLE_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'dotted', label: '점묘선' },
  { value: 'double', label: '이중선' },
  { value: 'groove', label: 'groove' },
  { value: 'ridge', label: 'ridge' },
  { value: 'inset', label: 'inset' },
  { value: 'outset', label: 'outset' },
] as const;
export const FRAME_BORDER_ALIGN_OPTIONS = [
  { value: 'inside', label: '내부' },
  { value: 'center', label: '중앙' },
  { value: 'outside', label: '외곽' },
] as const;
export const FRAME_STYLE_COLOR_OPTIONS = [
  { value: 'transparent', label: '투명' },
  { value: '#ffffff', label: '흰색' },
  { value: '#f8fafc', label: '슬레이트 50' },
  { value: '#e2e8f0', label: '슬레이트 200' },
  { value: '#0f172a', label: '슬레이트 900' },
  { value: '#fef3c7', label: '노랑' },
  { value: '#dbeafe', label: '파랑' },
  { value: '#dcfce7', label: '초록' },
  { value: '#fee2e2', label: '빨강' },
] as const;
export const RICH_TEXT_FONT_FAMILY_OPTIONS = [
  { value: '', label: '기본 폰트' },
  { value: '"Noto Sans KR", sans-serif', label: 'Noto Sans KR' },
  { value: '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif', label: '시스템 한글' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
] as const;
export const FRAME_BORDER_STYLE_LABEL_BY_VALUE = new Map(
  FRAME_BORDER_STYLE_OPTIONS.map((option) => [option.value, option.label] as const)
);
export const MIXED_STYLE_VALUE_LABEL = '혼합';
export const MIXED_PADDING_DISPLAY_LABEL = '혼용';
export const APPEARANCE_PADDING_SIDES: AppearancePaddingSide[] = ['top', 'bottom', 'left', 'right'];
export const APPEARANCE_BORDER_SIDES: TemplateEdgeSide[] = ['top', 'right', 'bottom', 'left'];
export const APPEARANCE_CORNERS: AppearanceCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
export const APPEARANCE_CORNER_LABELS: Record<AppearanceCorner, string> = {
  'top-left': '좌상',
  'top-right': '우상',
  'bottom-right': '우하',
  'bottom-left': '좌하',
};
export const APPEARANCE_BORDER_SIDE_LABELS: Record<TemplateEdgeSide, string> = {
  top: '상',
  right: '우',
  bottom: '하',
  left: '좌',
};
export const APPEARANCE_PADDING_LABEL_BY_SIDE: Record<AppearancePaddingSide, string> = {
  top: '상',
  bottom: '하',
  left: '좌',
  right: '우',
};
export const APPEARANCE_PADDING_FIELD_BY_SIDE: Record<AppearancePaddingSide, StyleFieldKey> = {
  top: 'paddingTop',
  bottom: 'paddingBottom',
  left: 'paddingLeft',
  right: 'paddingRight',
};
export const APPEARANCE_CORNER_RADIUS_STYLE_PROP: Record<
  AppearanceCorner,
  'borderTopLeftRadius' | 'borderTopRightRadius' | 'borderBottomRightRadius' | 'borderBottomLeftRadius'
> = {
  'top-left': 'borderTopLeftRadius',
  'top-right': 'borderTopRightRadius',
  'bottom-right': 'borderBottomRightRadius',
  'bottom-left': 'borderBottomLeftRadius',
};
export const APPEARANCE_BORDER_SIDE_WIDTH_STYLE_PROP: Record<
  TemplateEdgeSide,
  'borderTopWidth' | 'borderRightWidth' | 'borderBottomWidth' | 'borderLeftWidth'
> = {
  top: 'borderTopWidth',
  right: 'borderRightWidth',
  bottom: 'borderBottomWidth',
  left: 'borderLeftWidth',
};
export const APPEARANCE_BORDER_SIDE_STYLE_STYLE_PROP: Record<
  TemplateEdgeSide,
  'borderTopStyle' | 'borderRightStyle' | 'borderBottomStyle' | 'borderLeftStyle'
> = {
  top: 'borderTopStyle',
  right: 'borderRightStyle',
  bottom: 'borderBottomStyle',
  left: 'borderLeftStyle',
};
export const APPEARANCE_BORDER_SIDE_COLOR_STYLE_PROP: Record<
  TemplateEdgeSide,
  'borderTopColor' | 'borderRightColor' | 'borderBottomColor' | 'borderLeftColor'
> = {
  top: 'borderTopColor',
  right: 'borderRightColor',
  bottom: 'borderBottomColor',
  left: 'borderLeftColor',
};
export const TEMPLATE_FRAME_BORDER_ALIGN_ATTR = 'data-template-frame-border-align';
export const TEMPLATE_FRAME_BORDER_WIDTH_ATTR = 'data-template-frame-border-width';
export const TEMPLATE_FRAME_BORDER_STYLE_ATTR = 'data-template-frame-border-style';
export const TEMPLATE_FRAME_BORDER_COLOR_ATTR = 'data-template-frame-border-color';
export const TEMPLATE_TRANSPARENT_FRAME_GUIDE_ATTR = 'data-template-transparent-frame-guide';
export const DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN = 'center';
export const DEFAULT_TEMPLATE_FRAME_BORDER_WIDTH = '0.1';
export const DEFAULT_TEMPLATE_FRAME_BORDER_STYLE = 'solid';
export const DEFAULT_TEMPLATE_FRAME_BORDER_COLOR = '#0f172a';
export const TEMPLATE_FRAME_BORDER_SIDE_WIDTH_ATTR: Record<TemplateEdgeSide, string> = {
  top: 'data-template-frame-border-top-width',
  right: 'data-template-frame-border-right-width',
  bottom: 'data-template-frame-border-bottom-width',
  left: 'data-template-frame-border-left-width',
};
export const TEMPLATE_FRAME_BORDER_SIDE_STYLE_ATTR: Record<TemplateEdgeSide, string> = {
  top: 'data-template-frame-border-top-style',
  right: 'data-template-frame-border-right-style',
  bottom: 'data-template-frame-border-bottom-style',
  left: 'data-template-frame-border-left-style',
};
export const TEMPLATE_FRAME_BORDER_SIDE_COLOR_ATTR: Record<TemplateEdgeSide, string> = {
  top: 'data-template-frame-border-top-color',
  right: 'data-template-frame-border-right-color',
  bottom: 'data-template-frame-border-bottom-color',
  left: 'data-template-frame-border-left-color',
};

export const defaultFrameMetadataDraft: FrameMetadataDraft = {
  label: '',
  boxKind: '',
  role: '',
  valueKey: '',
  parentGroupId: '',
  runtimeMode: '',
};
export const FRAME_METADATA_DRAFT_FIELD_KEYS: Array<keyof FrameMetadataDraft> = [
  'label',
  'boxKind',
  'role',
  'valueKey',
  'parentGroupId',
  'runtimeMode',
];

export const defaultMetadataVirtualConnectionDraft: MetadataVirtualConnectionDraft = {
  mode: 'idle',
  label: '',
  id: '',
  idTouched: false,
  error: '',
};
