export type PositionGroupAlias = {
  alias: string;
  frameGroupIds: string[];
};

export const TEMPLATE_POSITION_GROUP_ALIASES_ATTR = 'data-template-position-group-aliases';

/**
 * 위치 그룹은 추출 단계에서 bandSource/인접도 기반으로 자동 추론하지 않습니다.
 * 그룹은 편집 화면에서 사용자가 명시적으로 생성한 물리 wrapper div만 정본입니다.
 */
export const computePositionGroupAliases = (_scope: ParentNode): PositionGroupAlias[] => [];

export const readPositionGroupAliases = (scope: ParentNode): PositionGroupAlias[] => {
  const element = scope as HTMLElement;
  const pageInner =
    element.querySelector?.<HTMLElement>('.page-inner') ||
    (element.classList?.contains('page-inner') ? element : null);

  const raw = pageInner?.getAttribute(TEMPLATE_POSITION_GROUP_ALIASES_ATTR) || '';
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PositionGroupAlias =>
        Boolean(item) && typeof item.alias === 'string' && Array.isArray(item.frameGroupIds),
    );
  } catch {
    return [];
  }
};

export const writePositionGroupAliases = (scope: ParentNode, aliases: PositionGroupAlias[]): void => {
  const element = scope as HTMLElement;
  const pageInner =
    element.querySelector?.<HTMLElement>('.page-inner') ||
    (element.classList?.contains('page-inner') ? element : null);

  if (!pageInner) return;

  if (aliases.length === 0) {
    pageInner.removeAttribute(TEMPLATE_POSITION_GROUP_ALIASES_ATTR);
  } else {
    pageInner.setAttribute(TEMPLATE_POSITION_GROUP_ALIASES_ATTR, JSON.stringify(aliases));
  }
};

/**
 * 기존 저장 HTML에 별칭이 있을 때만 표시 목록을 축약합니다.
 * 신규 추출은 별칭을 자동 생성하지 않습니다.
 */
export const buildPositionImpactDisplayList = (
  frameGroupIds: string[],
  aliases: PositionGroupAlias[],
): string[] => {
  if (aliases.length === 0) return frameGroupIds;

  const frameToAlias = new Map<string, string>();
  aliases.forEach((group) => {
    group.frameGroupIds.forEach((id) => frameToAlias.set(id, group.alias));
  });

  const seenAliases = new Set<string>();
  const result: string[] = [];

  frameGroupIds.forEach((id) => {
    const alias = frameToAlias.get(id);
    if (alias) {
      if (!seenAliases.has(alias)) {
        seenAliases.add(alias);
        result.push(alias);
      }
    } else {
      result.push(id);
    }
  });

  return result;
};

/**
 * HTML 문자열을 파싱하여 위치 그룹 별칭을 계산한 뒤 page-inner에 임베드합니다.
 */
export const embedPositionGroupAliasesInHtml = (html: string): string => {
  if (typeof document === 'undefined' || !html.trim()) return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  const aliases = computePositionGroupAliases(container);
  writePositionGroupAliases(container, aliases);

  return container.innerHTML;
};
