import type {
  TemplateFrameBoxKind,
  TemplateFrameRole,
  TemplateFrameRuntimeMode,
} from './templateFrameEditDtos';

export type TemplateLayoutResizeMode = 'fixed' | 'grow_height' | 'grow_width';

export type TemplateFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'signature';

export type TemplateSchemaFrameInput = {
  frameGroupId: string;
  label: string;
  role: TemplateFrameRole;
  boxKind?: TemplateFrameBoxKind | null;
  valueKey?: string | null;
  parentGroupId?: string | null;
  runtimeMode?: TemplateFrameRuntimeMode | null;
  fieldType?: string | null;
  pageNumber?: number | null;
  sortOrder?: number | null;
  frameSnapshot?: Record<string, unknown>;
  styleSnapshot?: Record<string, unknown>;
  positionSnapshot?: Record<string, unknown>;
  relationSnapshot?: Record<string, unknown>;
};

export type TemplateSchemaBindingInput = {
  bindingType: 'parent' | 'value';
  sourceFrameGroupId: string;
  targetFrameGroupId: string;
  sharedValueKey?: string | null;
  sortOrder?: number | null;
  bindingSnapshot?: Record<string, unknown>;
};

export type TemplateSchemaPositionRelationInput = {
  relationKey: string;
  targetKind: 'frame' | 'group';
  targetGroupId?: string | null;
  targetFrameGroupIds?: string[];
  anchorKind: 'frame' | 'group' | 'page-corner';
  anchorGroupId?: string | null;
  anchorFrameGroupId?: string | null;
  anchorPageCornerId?: string | null;
  gapYPx?: number | null;
  sortOrder?: number | null;
  relationSnapshot?: Record<string, unknown>;
};

export type TemplateSchemaSnapshotInput = {
  renderSnapshotHtml: string;
  frames: TemplateSchemaFrameInput[];
  bindings?: TemplateSchemaBindingInput[];
  positionRelations?: TemplateSchemaPositionRelationInput[];
};

export type TemplateCreateInput = {
  templateName: string;
  sourceDocumentName?: string | null;
  sourceDocumentId?: string | null;
  draftHtml: string;
  layoutResizeMode: TemplateLayoutResizeMode;
  revisionSnapshot?: TemplateSchemaSnapshotInput | null;
};

export type TemplateUpdateInput = {
  templateName?: string;
  sourceDocumentName?: string | null;
  draftHtml?: string;
  layoutResizeMode?: TemplateLayoutResizeMode;
  revisionSnapshot?: TemplateSchemaSnapshotInput | null;
};

export type TemplateLayoutDraftInput = {
  sourceTitle?: string | null;
  sourceKind: 'html' | 'text';
  sourceContent: string;
};

export type TemplateLayoutDraftResult = {
  sourceTitle: string | null;
  sourceDocumentName: string | null;
  resolvedSourceKind: 'html' | 'text';
  draftHtml: string;
  suggestedFields: TemplateFieldInput[];
  suggestedSignatureAreas: TemplateSignatureAreaInput[];
};

export type TemplateFieldInput = {
  fieldKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  labelKey: string;
  required?: boolean;
  placeholder?: string | null;
  defaultValue?: unknown;
  options?: string[] | null;
  layoutBlockId?: string | null;
  sortOrder?: number | null;
};

export type TemplateSignatureAreaInput = {
  labelKey: string;
  signerRoleName: string;
  pageIndex?: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
  sortOrder?: number | null;
};

export type TemplateRecordDto = {
  id: string;
  templateName: string;
  sourceDocumentName: string | null;
  sourceDocumentId: string | null;
  draftHtml: string;
  layoutResizeMode: TemplateLayoutResizeMode;
  status: 'draft' | 'active';
  currentRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplateFieldDto = {
  id: string;
  templateId: string;
  fieldKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  required: boolean;
  placeholder: string | null;
  defaultValue: unknown;
  options: string[];
  layoutBlockId: string | null;
  sortOrder: number;
};

export type TemplateLabelBindingDto = {
  id: string;
  templateId: string;
  fieldKey: string | null;
  labelKey: string;
  bindingScope: 'field' | 'signature';
};

export type TemplateSignatureAreaDto = {
  id: string;
  templateId: string;
  labelKey: string;
  signerRoleName: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  sortOrder: number;
};

export type TemplateLabelMapEntry = {
  labelKey: string;
  fieldKeys: string[];
  signatureAreaIds: string[];
};

export type TemplateDetailResult = {
  template: TemplateRecordDto;
  fields: TemplateFieldDto[];
  labelBindings: TemplateLabelBindingDto[];
  signatureAreas: TemplateSignatureAreaDto[];
  labelMap: TemplateLabelMapEntry[];
};

export type TemplateFieldsSaveInput = {
  fields: TemplateFieldInput[];
  signatureAreas?: TemplateSignatureAreaInput[];
};

export type TemplateFieldsSaveResult = {
  templateId: string;
  savedFieldCount: number;
  savedSignatureAreaCount: number;
  labelBindingCount: number;
};

export type TemplateUpdateResult = {
  template: TemplateRecordDto;
};

export type TemplateDeleteResult = {
  templateId: string;
};
