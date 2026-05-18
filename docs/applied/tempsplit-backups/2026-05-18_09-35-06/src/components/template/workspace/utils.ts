import { POSITION_LOCK_COLOR_PRESETS, POSITION_STABLE_COLOR_INDEX_ORDER } from './constants';
import type { VirtualFrameDefinition } from './types';

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
