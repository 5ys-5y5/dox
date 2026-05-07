export type PositionGroupAlias = {
  alias: string;
  frameGroupIds: string[];
};

export const TEMPLATE_POSITION_GROUP_ALIASES_ATTR = 'data-template-position-group-aliases';

const FRAME_NODE_SELECTOR = '.v202-frame-group[data-template-frame-group]';
const FRAME_SHELL_CLASS = 'v102-frame-band';
const BAND_SOURCE_ATTR = 'data-v106-band-source';
const POSITION_MODE_ATTR = 'data-template-frame-position-mode';
const RELATIVE_ANCHOR_KIND_ATTR = 'data-template-frame-relative-anchor-kind';
const RELATIVE_ANCHOR_ID_ATTR = 'data-template-frame-relative-anchor-id';

/**
 * 프레임 노드 간 연결 관계(band alignment + relative anchor)를 분석하여
 * 함께 움직이는 그룹에 별칭("그룹 1", "그룹 2" 등)을 할당합니다.
 * 2개 이상의 프레임으로 구성된 연결 컴포넌트만 별칭으로 정의됩니다.
 * peer_edge 데이터와는 완전히 독립적입니다.
 */
export const computePositionGroupAliases = (scope: ParentNode): PositionGroupAlias[] => {
  const allNodes = Array.from(scope.querySelectorAll<HTMLElement>(FRAME_NODE_SELECTOR));
  const frameNodeById = new Map<string, HTMLElement>();

  allNodes.forEach((node) => {
    const id = node.getAttribute('data-template-frame-group')?.trim() || '';
    if (id && !frameNodeById.has(id)) {
      frameNodeById.set(id, node);
    }
  });

  const adjacency = new Map<string, Set<string>>();

  const ensureAdjacency = (id: string) => {
    if (!adjacency.has(id)) adjacency.set(id, new Set());
  };

  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    ensureAdjacency(a);
    ensureAdjacency(b);
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  // Band alignment 연결 (같은 page + 같은 band source인 프레임끼리)
  const bandByKey = new Map<string, string[]>();
  frameNodeById.forEach((node, id) => {
    const shell = node.closest<HTMLElement>(`.${FRAME_SHELL_CLASS}`) || node;
    const bandSource =
      shell.getAttribute(BAND_SOURCE_ATTR)?.trim() || node.getAttribute(BAND_SOURCE_ATTR)?.trim();
    if (!bandSource) return;
    const page = node.closest<HTMLElement>('.page-inner')?.getAttribute('data-page') || '1';
    const key = `${page}|${bandSource}`;
    const ids = bandByKey.get(key) || [];
    ids.push(id);
    bandByKey.set(key, ids);
  });

  bandByKey.forEach((ids) => {
    if (ids.length < 2) return;
    const seed = ids[0];
    ids.slice(1).forEach((id) => addEdge(seed, id));
  });

  // Relative anchor 연결 (anchorKind === 'frame'인 경우)
  frameNodeById.forEach((node, id) => {
    const shell = node.closest<HTMLElement>(`.${FRAME_SHELL_CLASS}`) || node;
    const positionMode =
      shell.getAttribute(POSITION_MODE_ATTR)?.trim() || node.getAttribute(POSITION_MODE_ATTR)?.trim();
    if (positionMode !== 'relative') return;
    const anchorKind =
      shell.getAttribute(RELATIVE_ANCHOR_KIND_ATTR)?.trim() ||
      node.getAttribute(RELATIVE_ANCHOR_KIND_ATTR)?.trim();
    if (anchorKind !== 'frame') return;
    const anchorId =
      shell.getAttribute(RELATIVE_ANCHOR_ID_ATTR)?.trim() ||
      node.getAttribute(RELATIVE_ANCHOR_ID_ATTR)?.trim();
    if (!anchorId || !frameNodeById.has(anchorId)) return;
    addEdge(id, anchorId);
  });

  // Vertical proximity 연결: band source도 없고 anchorKind도 'frame'/'page-corner'가 아닌 프레임들을
  // inline style의 top/height를 기준으로 수직 인접 여부를 판단해 연결한다.
  // getBoundingClientRect() 대신 inline style을 사용하므로 off-screen DOM에서도 동작한다.
  const parseStylePx = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const m = value.trim().match(/^([\d.]+)px$/);
    return m ? parseFloat(m[1]) : null;
  };

  type ProximityEntry = { id: string; top: number; bottom: number; pageKey: string };
  const proximityEntries: ProximityEntry[] = [];

  frameNodeById.forEach((node, id) => {
    const shell = node.closest<HTMLElement>(`.${FRAME_SHELL_CLASS}`) || node;
    const bandSource =
      shell.getAttribute(BAND_SOURCE_ATTR)?.trim() || node.getAttribute(BAND_SOURCE_ATTR)?.trim();
    if (bandSource) return;
    const anchorKind =
      shell.getAttribute(RELATIVE_ANCHOR_KIND_ATTR)?.trim() ||
      node.getAttribute(RELATIVE_ANCHOR_KIND_ATTR)?.trim();
    if (anchorKind === 'frame' || anchorKind === 'page-corner') return;

    const top = parseStylePx(shell.style?.top) ?? parseStylePx(node.style?.top);
    const height = parseStylePx(shell.style?.height) ?? parseStylePx(node.style?.height);
    if (top === null || height === null) return;

    const pageKey = node.closest<HTMLElement>('.page-inner')?.getAttribute('data-page') || '1';
    proximityEntries.push({ id, top, bottom: top + height, pageKey });
  });

  proximityEntries.sort((a, b) => a.pageKey.localeCompare(b.pageKey) || a.top - b.top);

  const VERTICAL_PROXIMITY_GAP_PX = 20;
  for (let i = 0; i < proximityEntries.length - 1; i++) {
    const curr = proximityEntries[i];
    const next = proximityEntries[i + 1];
    if (curr.pageKey === next.pageKey && next.top - curr.bottom <= VERTICAL_PROXIMITY_GAP_PX) {
      addEdge(curr.id, next.id);
    }
  }

  // BFS로 연결 컴포넌트 탐색 후 2개 이상인 컴포넌트에만 별칭 부여
  const visited = new Set<string>();
  const aliases: PositionGroupAlias[] = [];
  let boxIndex = 1;

  Array.from(frameNodeById.keys())
    .sort()
    .forEach((id) => {
      if (visited.has(id)) return;

      const component = new Set<string>();
      const queue = [id];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        component.add(current);
        adjacency.get(current)?.forEach((neighbor) => {
          if (!visited.has(neighbor)) queue.push(neighbor);
        });
      }

      const frameGroupIds = Array.from(component).sort((a, b) => a.localeCompare(b));
      if (frameGroupIds.length >= 2) {
        aliases.push({ alias: `그룹 ${boxIndex}`, frameGroupIds });
        boxIndex++;
      }
    });

  return aliases;
};

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
 * 프레임 ID 목록을 저장된 별칭을 사용해 간결한 표시 목록으로 변환합니다.
 * 예: ["band-3-cell-1", ..., "band-19-cell-2", "band-20-footer", "band-21-footer", "band-22-footer"]
 *     → ["그룹 1", "그룹 2", "band-22-footer"]
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
