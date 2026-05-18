import type { TemplateFrameBoxKind, TemplateFrameRole, TemplateFrameRuntimeMode } from '../../../lib/templateFrameEditDtos';
import {
  ATTACHMENT_RUNTIME_MODE_OPTIONS,
  DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN,
  FRAME_BORDER_STYLE_LABEL_BY_VALUE,
  FRAME_METADATA_DRAFT_FIELD_KEYS,
  POSITION_LOCK_COLOR_PRESETS,
  POSITION_STABLE_COLOR_INDEX_ORDER,
  SELECTION_STYLE_DRAFT_FIELD_KEYS,
  SIGNATURE_RUNTIME_MODE_OPTIONS,
  TEMPLATE_FRAME_BOX_KIND_OPTIONS,
  TEMPLATE_FRAME_ROLE_OPTIONS,
  TEXT_RUNTIME_MODE_OPTIONS,
} from './constants';
import type { FrameMetadataDraft, SelectionStyleDraft, VirtualFrameDefinition } from './types';

export const isLegacyInferredPositionGroupId = (groupId: string | null | undefined) =>
  /^inferred:/i.test(String(groupId || '').trim());

export const readPositionEntityColorNumber = (...values: string[]) => {
  for (const value of values) {
    const normalizedValue = value.trim();
    const match =
      normalizedValue.match(/그룹\s*(\d+)/iu) ||
      normalizedValue.match(/box\s*(\d+)/iu) ||
      normalizedValue.match(/이동\s+묶음\s+박스\s*(\d+)/iu) ||
      normalizedValue.match(/이동\s+묶음\s+상자\s*(\d+)/iu) ||
      normalizedValue.match(/group\s*(\d+)/iu) ||
      normalizedValue.match(/position-box-(\d+)/iu);

    if (match) {
      const nextNumber = Number.parseInt(match[1] || '', 10);
      if (Number.isFinite(nextNumber) && nextNumber > 0) {
        return nextNumber;
      }
    }
  }

  return null;
};

export const hashPositionEntityColorKey = (value: string) => {
  const normalizedValue = value.trim();
  let hash = 0;

  for (let index = 0; index < normalizedValue.length; index += 1) {
    hash = Math.imul(hash, 31) + normalizedValue.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

export const resolvePositionStableColorPreset = (entityId: string, label = '') => {
  const colorNumber = readPositionEntityColorNumber(label, entityId);
  const colorOrderIndex =
    colorNumber !== null
      ? (colorNumber - 1) % POSITION_STABLE_COLOR_INDEX_ORDER.length
      : hashPositionEntityColorKey(`${label}|${entityId}`) % POSITION_STABLE_COLOR_INDEX_ORDER.length;
  const paletteIndex = POSITION_STABLE_COLOR_INDEX_ORDER[colorOrderIndex] ?? 0;

  return POSITION_LOCK_COLOR_PRESETS[paletteIndex] || POSITION_LOCK_COLOR_PRESETS[0];
};

export const resolvePositionStableVisual = (entityId: string, label = '', selectionOrder = 1) => ({
  selectionOrder,
  groupId: entityId,
  ...resolvePositionStableColorPreset(entityId, label),
});

export const normalizeTextDecorationLineValue = (value: string | null | undefined) =>
  String(value || '')
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token && token !== 'none')
    .join(' ');

export const hasTextDecorationToken = (value: string | null | undefined, token: 'underline' | 'line-through') =>
  normalizeTextDecorationLineValue(value).split(/\s+/).includes(token);

export const toggleTextDecorationTokenValue = (
  value: string | null | undefined,
  token: 'underline' | 'line-through'
) => {
  const nextTokens = new Set(normalizeTextDecorationLineValue(value).split(/\s+/).filter(Boolean));

  if (nextTokens.has(token)) {
    nextTokens.delete(token);
  } else {
    nextTokens.add(token);
  }

  return Array.from(nextTokens).join(' ') || 'none';
};

export const normalizeFrameValueKey = (value: string) =>
  value
    .split('>')
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' > ');

export const normalizeFrameBoxLabel = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeVirtualDefinitionId = (value: string) => {
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

export const parseVirtualFrameDefinitions = (raw: string | null | undefined): VirtualFrameDefinition[] => {
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

export const mergeVirtualFrameDefinitions = (definitions: VirtualFrameDefinition[]) => {
  const merged = new Map<string, VirtualFrameDefinition>();

  definitions.forEach((definition) => {
    const id = normalizeVirtualDefinitionId(definition.id);
    const label = definition.label.trim();

    if (!id || !label) {
      return;
    }

    merged.set(id, { id, label });
  });

  return Array.from(merged.values()).sort((left, right) => left.label.localeCompare(right.label, 'ko'));
};

export const stringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const areSelectionStyleDraftsEqual = (left: SelectionStyleDraft, right: SelectionStyleDraft) =>
  SELECTION_STYLE_DRAFT_FIELD_KEYS.every((field) => left[field] === right[field]);

export const normalizeFrameBorderStyleValue = (value: string | null | undefined, borderWidth = 1) => {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue || normalizedValue === '없음' || normalizedValue === 'none' || normalizedValue === 'hidden' || borderWidth <= 0) {
    return 'none';
  }

  if (normalizedValue === '실선') {
    return 'solid';
  }

  if (normalizedValue === '점선') {
    return 'dashed';
  }

  if (normalizedValue === '점묘선') {
    return 'dotted';
  }

  if (normalizedValue === '이중선') {
    return 'double';
  }

  return FRAME_BORDER_STYLE_LABEL_BY_VALUE.has(normalizedValue) ? normalizedValue : 'solid';
};

export const normalizeFrameBorderAlignValue = (value: string | null | undefined) => {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (normalizedValue === 'center' || normalizedValue === '중앙') {
    return 'center';
  }

  if (normalizedValue === 'outside' || normalizedValue === 'outer' || normalizedValue === '외곽') {
    return 'outside';
  }

  return DEFAULT_TEMPLATE_FRAME_BORDER_ALIGN;
};

export const normalizeFrameBorderWidthValue = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());

  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

export const areFrameMetadataDraftsEqual = (left: FrameMetadataDraft, right: FrameMetadataDraft) =>
  FRAME_METADATA_DRAFT_FIELD_KEYS.every((field) => left[field] === right[field]);

export const isTemplateFrameBoxKind = (value: string | null | undefined): value is TemplateFrameBoxKind =>
  TEMPLATE_FRAME_BOX_KIND_OPTIONS.includes(String(value || '').trim() as TemplateFrameBoxKind);

export const isTemplateFrameRole = (value: string | null | undefined): value is TemplateFrameRole =>
  (['group', ...TEMPLATE_FRAME_ROLE_OPTIONS] as const).includes(String(value || '').trim() as TemplateFrameRole | 'group');

export const isTemplateFrameRuntimeMode = (value: string | null | undefined): value is TemplateFrameRuntimeMode =>
  [...TEXT_RUNTIME_MODE_OPTIONS, ...ATTACHMENT_RUNTIME_MODE_OPTIONS, ...SIGNATURE_RUNTIME_MODE_OPTIONS].includes(
    String(value || '').trim() as TemplateFrameRuntimeMode
  );

export const getCompatibleRuntimeModes = (boxKind: TemplateFrameBoxKind) => {
  if (boxKind === 'attachment') {
    return ATTACHMENT_RUNTIME_MODE_OPTIONS;
  }

  if (boxKind === 'signature') {
    return SIGNATURE_RUNTIME_MODE_OPTIONS;
  }

  return TEXT_RUNTIME_MODE_OPTIONS;
};

export const getAllRuntimeModes = () => [
  ...TEXT_RUNTIME_MODE_OPTIONS,
  ...ATTACHMENT_RUNTIME_MODE_OPTIONS,
  ...SIGNATURE_RUNTIME_MODE_OPTIONS,
];

export const getDefaultRuntimeMode = (boxKind: TemplateFrameBoxKind, role: TemplateFrameRole | 'group') => {
  if (boxKind === 'attachment') {
    return 'file_slot' as const;
  }

  if (boxKind === 'signature') {
    return 'signature_image' as const;
  }

  return role === 'key' ? ('static_label' as const) : ('editable_text' as const);
};
