import type {
  TemplateSchemaBindingInput,
  TemplateSchemaFrameInput,
  TemplateSchemaPositionRelationInput,
  TemplateSchemaSnapshotInput,
} from '../../../../lib/templateDtos';
import { RAW_FRAME_NODE_SELECTOR } from '../constants';

const FRAME_PAGE_ATTR = 'data-template-frame-page';
const FRAME_ROW_START_ATTR = 'data-template-frame-row-start';
const FRAME_ROW_END_ATTR = 'data-template-frame-row-end';
const FRAME_COL_START_ATTR = 'data-template-frame-col-start';
const FRAME_COL_END_ATTR = 'data-template-frame-col-end';
const FRAME_HALIGN_ATTR = 'data-template-frame-halign';
const FRAME_VALIGN_ATTR = 'data-template-frame-valign';
const FRAME_LABEL_ATTR = 'data-template-frame-label';
const FRAME_ROLE_ATTR = 'data-template-frame-role';
const FRAME_VALUE_KEY_ATTR = 'data-template-frame-value-key';
const FRAME_PARENT_GROUP_ATTR = 'data-template-frame-parent-group';
const FRAME_BOX_KIND_ATTR = 'data-template-box-kind';
const FRAME_RUNTIME_MODE_ATTR = 'data-template-runtime-mode';
const FRAME_FIELD_TYPE_ATTR = 'data-template-frame-field-type';
const FRAME_POSITION_MODE_ATTR = 'data-template-frame-position-mode';
const FRAME_RELATIVE_ANCHOR_KIND_ATTR = 'data-template-frame-relative-anchor-kind';
const FRAME_RELATIVE_ANCHOR_ID_ATTR = 'data-template-frame-relative-anchor-id';
const FRAME_RELATIVE_ANCHOR_X_ATTR = 'data-template-frame-relative-anchor-x';
const FRAME_RELATIVE_ANCHOR_Y_ATTR = 'data-template-frame-relative-anchor-y';
const FRAME_RELATIVE_ANCHOR_SOURCE_EDGE_Y_ATTR = 'data-template-frame-relative-anchor-source-edge-y';
const FRAME_RELATIVE_ANCHOR_TARGET_EDGE_Y_ATTR = 'data-template-frame-relative-anchor-target-edge-y';
const FRAME_RELATIVE_OFFSET_X_ATTR = 'data-template-frame-relative-offset-x';
const FRAME_RELATIVE_OFFSET_Y_ATTR = 'data-template-frame-relative-offset-y';
const FRAME_RELATION_SELECTION_ATTR = 'data-template-frame-relation-selection';
const FRAME_POSITION_GROUP_ID_ATTR = 'data-template-frame-position-group-id';
const FRAME_POSITION_GROUP_LABEL_ATTR = 'data-template-frame-position-group-label';
const FRAME_POSITION_GROUP_MANAGED_ATTR = 'data-template-frame-position-group-managed';
const FRAME_POSITION_RELATION_ACTIVE_ATTR = 'data-template-frame-position-relation-active';
const FRAME_POSITION_RELATION_ANCHOR_ATTR = 'data-template-frame-position-relation-anchor';
const FRAME_AUTO_HEIGHT_ATTR = 'data-template-frame-auto-height';
const FRAME_AUTO_HEIGHT_BASE_ATTR = 'data-template-frame-auto-height-base';
const FRAME_AUTO_WIDTH_ATTR = 'data-template-frame-auto-width';
const FRAME_AUTO_WIDTH_BASE_ATTR = 'data-template-frame-auto-width-base';
const FRAME_AUTO_SIZE_ANCHOR_ATTR = 'data-template-frame-auto-size-anchor';
const FRAME_BORDER_ALIGN_ATTR = 'data-template-frame-border-align';
const FRAME_BORDER_WIDTH_ATTR = 'data-template-frame-border-width';
const FRAME_BORDER_STYLE_ATTR = 'data-template-frame-border-style';
const FRAME_BORDER_COLOR_ATTR = 'data-template-frame-border-color';

const readAttr = (node: Element, name: string) => node.getAttribute(name)?.trim() || '';

const parseInteger = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readBooleanAttr = (node: Element, name: string) => readAttr(node, name) === 'true';

const buildFrameSnapshot = (node: HTMLElement) => ({
  tagName: node.tagName.toLowerCase(),
  className: node.className || '',
  outerHtml: node.outerHTML,
  inlineStyle: node.getAttribute('style') || '',
  rowStart: parseInteger(readAttr(node, FRAME_ROW_START_ATTR), 1),
  rowEnd: parseInteger(readAttr(node, FRAME_ROW_END_ATTR), 1),
  colStart: parseInteger(readAttr(node, FRAME_COL_START_ATTR), 1),
  colEnd: parseInteger(readAttr(node, FRAME_COL_END_ATTR), 1),
  horizontalAlign: readAttr(node, FRAME_HALIGN_ATTR) || null,
  verticalAlign: readAttr(node, FRAME_VALIGN_ATTR) || null,
});

const buildStyleSnapshot = (node: HTMLElement) => ({
  className: node.className || '',
  inlineStyle: node.getAttribute('style') || '',
  borderAlign: readAttr(node, FRAME_BORDER_ALIGN_ATTR) || null,
  borderWidth: readAttr(node, FRAME_BORDER_WIDTH_ATTR) || null,
  borderStyle: readAttr(node, FRAME_BORDER_STYLE_ATTR) || null,
  borderColor: readAttr(node, FRAME_BORDER_COLOR_ATTR) || null,
  autoHeight: readBooleanAttr(node, FRAME_AUTO_HEIGHT_ATTR),
  autoHeightBase: parseNumber(readAttr(node, FRAME_AUTO_HEIGHT_BASE_ATTR)),
  autoWidth: readBooleanAttr(node, FRAME_AUTO_WIDTH_ATTR),
  autoWidthBase: parseNumber(readAttr(node, FRAME_AUTO_WIDTH_BASE_ATTR)),
  autoSizeAnchor: readAttr(node, FRAME_AUTO_SIZE_ANCHOR_ATTR) || null,
});

const buildPositionSnapshot = (node: HTMLElement) => ({
  pageNumber: parseInteger(readAttr(node, FRAME_PAGE_ATTR), 1),
  positionMode: readAttr(node, FRAME_POSITION_MODE_ATTR) || 'absolute',
  anchorKind: readAttr(node, FRAME_RELATIVE_ANCHOR_KIND_ATTR) || null,
  anchorId: readAttr(node, FRAME_RELATIVE_ANCHOR_ID_ATTR) || null,
  anchorX: readAttr(node, FRAME_RELATIVE_ANCHOR_X_ATTR) || null,
  anchorY: readAttr(node, FRAME_RELATIVE_ANCHOR_Y_ATTR) || null,
  sourceEdgeY: readAttr(node, FRAME_RELATIVE_ANCHOR_SOURCE_EDGE_Y_ATTR) || null,
  targetEdgeY: readAttr(node, FRAME_RELATIVE_ANCHOR_TARGET_EDGE_Y_ATTR) || null,
  offsetX: parseNumber(readAttr(node, FRAME_RELATIVE_OFFSET_X_ATTR)),
  offsetY: parseNumber(readAttr(node, FRAME_RELATIVE_OFFSET_Y_ATTR)),
  positionGroupId: readAttr(node, FRAME_POSITION_GROUP_ID_ATTR) || null,
  positionGroupLabel: readAttr(node, FRAME_POSITION_GROUP_LABEL_ATTR) || null,
  positionGroupManaged: readBooleanAttr(node, FRAME_POSITION_GROUP_MANAGED_ATTR),
});

const buildRelationSnapshot = (node: HTMLElement) => ({
  relationSelection: readAttr(node, FRAME_RELATION_SELECTION_ATTR) || null,
  relationActive: readBooleanAttr(node, FRAME_POSITION_RELATION_ACTIVE_ATTR),
  relationAnchor: readBooleanAttr(node, FRAME_POSITION_RELATION_ANCHOR_ATTR),
  parentGroupId: readAttr(node, FRAME_PARENT_GROUP_ATTR) || null,
  valueKey: readAttr(node, FRAME_VALUE_KEY_ATTR) || null,
});

const buildFrameInput = (node: HTMLElement, sortOrder: number): TemplateSchemaFrameInput | null => {
  const frameGroupId = readAttr(node, 'data-template-frame-group');

  if (!frameGroupId) {
    return null;
  }

  const role = readAttr(node, FRAME_ROLE_ATTR) || 'key_value';
  const boxKind = readAttr(node, FRAME_BOX_KIND_ATTR);
  const runtimeMode = readAttr(node, FRAME_RUNTIME_MODE_ATTR);

  return {
    frameGroupId,
    label: readAttr(node, FRAME_LABEL_ATTR) || frameGroupId,
    role: role as TemplateSchemaFrameInput['role'],
    boxKind: (boxKind || null) as TemplateSchemaFrameInput['boxKind'],
    valueKey: readAttr(node, FRAME_VALUE_KEY_ATTR) || null,
    parentGroupId: readAttr(node, FRAME_PARENT_GROUP_ATTR) || null,
    runtimeMode: (runtimeMode || null) as TemplateSchemaFrameInput['runtimeMode'],
    fieldType: readAttr(node, FRAME_FIELD_TYPE_ATTR) || null,
    pageNumber: parseInteger(readAttr(node, FRAME_PAGE_ATTR), 1),
    sortOrder,
    frameSnapshot: buildFrameSnapshot(node),
    styleSnapshot: buildStyleSnapshot(node),
    positionSnapshot: buildPositionSnapshot(node),
    relationSnapshot: buildRelationSnapshot(node),
  };
};

const buildBindingInputs = (frames: TemplateSchemaFrameInput[]): TemplateSchemaBindingInput[] => {
  const bindings: TemplateSchemaBindingInput[] = [];
  let sortOrder = 0;

  frames.forEach((frame) => {
    if (!frame.parentGroupId) {
      return;
    }

    bindings.push({
      bindingType: 'parent',
      sourceFrameGroupId: frame.parentGroupId,
      targetFrameGroupId: frame.frameGroupId,
      sortOrder,
      bindingSnapshot: {
        frameGroupId: frame.frameGroupId,
        parentGroupId: frame.parentGroupId,
      },
    });
    sortOrder += 1;

    if (frame.valueKey) {
      bindings.push({
        bindingType: 'value',
        sourceFrameGroupId: frame.parentGroupId,
        targetFrameGroupId: frame.frameGroupId,
        sharedValueKey: frame.valueKey,
        sortOrder,
        bindingSnapshot: {
          frameGroupId: frame.frameGroupId,
          parentGroupId: frame.parentGroupId,
          valueKey: frame.valueKey,
        },
      });
      sortOrder += 1;
    }
  });

  return bindings;
};

const buildPositionRelationInputs = (frames: TemplateSchemaFrameInput[]): TemplateSchemaPositionRelationInput[] => {
  let sortOrder = 0;

  return frames.flatMap((frame) => {
    const position = frame.positionSnapshot || {};
    const anchorKind = typeof position.anchorKind === 'string' ? position.anchorKind : '';
    const anchorId = typeof position.anchorId === 'string' ? position.anchorId : '';

    if (!anchorKind || !anchorId) {
      return [];
    }

    const sourceEdgeY =
      position.sourceEdgeY === 'top' || position.sourceEdgeY === 'bottom' ? position.sourceEdgeY : null;
    const targetEdgeY =
      position.targetEdgeY === 'top' || position.targetEdgeY === 'bottom' ? position.targetEdgeY : null;
    const relation: TemplateSchemaPositionRelationInput = {
      relationKey: `frame:${frame.frameGroupId}:relative`,
      targetKind: 'frame',
      targetGroupId: frame.frameGroupId,
      targetFrameGroupIds: [frame.frameGroupId],
      anchorKind: anchorKind as TemplateSchemaPositionRelationInput['anchorKind'],
      anchorGroupId: anchorKind === 'group' ? anchorId : null,
      anchorFrameGroupId: anchorKind === 'frame' ? anchorId : null,
      anchorPageCornerId: anchorKind === 'page-corner' ? anchorId : null,
      sourceEdgeY,
      targetEdgeY,
      gapYPx: typeof position.offsetY === 'number' ? position.offsetY : null,
      sortOrder,
      relationSnapshot: {
        ...position,
        frameGroupId: frame.frameGroupId,
      },
    };

    sortOrder += 1;
    return [relation];
  });
};

export const extractTemplateStructureSnapshot = (
  root: HTMLElement,
  renderSnapshotHtml: string
): TemplateSchemaSnapshotInput => {
  const frames = Array.from(root.querySelectorAll<HTMLElement>(RAW_FRAME_NODE_SELECTOR))
    .map((node, sortOrder) => buildFrameInput(node, sortOrder))
    .filter((frame): frame is TemplateSchemaFrameInput => Boolean(frame));

  return {
    renderSnapshotHtml: renderSnapshotHtml.trim(),
    frames,
    bindings: buildBindingInputs(frames),
    positionRelations: buildPositionRelationInputs(frames),
  };
};
