export type TemplateFrameRole = 'group' | 'key' | 'value' | 'key_value';
export type TemplateFrameBoxKind = 'text' | 'attachment' | 'signature';
export type TemplateFrameRuntimeMode =
  | 'static_label'
  | 'editable_text'
  | 'file_slot'
  | 'signature_image'
  | 'signature_history'
  | 'signature_signer_name'
  | 'signature_signed_at'
  | 'signature_provider'
  | 'signature_status';

export type TemplateFrameRectDto = {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TemplateFrameMetadataDto = {
  role: TemplateFrameRole;
  boxKind?: TemplateFrameBoxKind | null;
  runtimeMode?: TemplateFrameRuntimeMode | null;
  outlineStyle: 'solid' | 'dashed' | null;
  valueKey: string | null;
  parentGroupId: string | null;
  chainKey: string | null;
  chainDepth: number | null;
  sourceText: string | null;
};

export type TemplateFrameNodeDto = {
  frameGroupId: string;
  rect: TemplateFrameRectDto;
  metadata: TemplateFrameMetadataDto;
};

export type TemplateFrameResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type TemplateFrameEditWarningCode =
  | 'frames_not_adjacent'
  | 'frames_cross_page'
  | 'split_boundary_missing'
  | 'frame_too_small'
  | 'parent_missing'
  | 'metadata_conflict'
  | 'html_parse_failed';

export type TemplateFrameEditWarning = {
  code: TemplateFrameEditWarningCode;
  message: string;
  frameGroupIds: string[];
};

export type TemplateFrameEditResult<T> = {
  ok: boolean;
  value: T | null;
  warnings: TemplateFrameEditWarning[];
};

export type TemplateFrameGeometryOptions = {
  thresholdPx: number;
  minSizePx: number;
  snapToPageBounds: boolean;
  minSharedEdgePx: number;
};

export const DEFAULT_TEMPLATE_FRAME_GEOMETRY_OPTIONS: TemplateFrameGeometryOptions = {
  thresholdPx: 12,
  minSizePx: 12,
  snapToPageBounds: true,
  minSharedEdgePx: 6,
};
