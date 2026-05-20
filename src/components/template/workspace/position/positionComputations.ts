import type {
  DefinedPositionRelativeRelation,
  FrameNodeRect,
  PositionImpactGroup,
  PositionSpacingGuideRelation,
  PositionSpacingOrderedGroupMember,
  PositionSpacingResolvedPair,
  TemplateFrameRelativeAnchorConfig,
} from '../types';

type PositionSpacingEntityVisual = {
  selectionOrder: number;
  groupId: string;
  colorName: string;
  outlineColor: string;
  fillColor: string;
  haloColor: string;
  badgeColor: string;
  badgeTextColor: string;
};

export const buildDefinedPositionRelativeRelations = (args: {
  previewRoot: HTMLDivElement | null;
  positionRelationFrameLabelById: Map<string, string>;
  pageCornerAnchorLabels: Record<string, string>;
  collectFrameSelectionAnchors: (root: HTMLElement) => HTMLElement[];
  getFrameGroupId: (node: HTMLElement) => string;
  collectPositionBoxGroups: (
    root: HTMLElement,
    options?: { includeSingletons?: boolean }
  ) => PositionImpactGroup[];
  normalizePositionGroupDisplayLabel: (label: string, id?: string) => string;
  readSingleFrameGroupId: (frameGroupIds: string[]) => string;
  readPositionGroupWrapperRect: (pageInner: HTMLElement, groupId: string) => FrameNodeRect | null;
  readStoredRelativeAnchorConfig: (element: HTMLElement | null | undefined) => TemplateFrameRelativeAnchorConfig | null;
  resolveFrameLayoutShell: (node: HTMLElement) => HTMLElement | null;
  resolveFrameContentTarget: (node: HTMLElement) => HTMLElement | null;
  readFrameMoveRect: (node: HTMLElement) => FrameNodeRect;
  resolveRelativeAnchorRect: (
    pageInner: HTMLElement,
    config: TemplateFrameRelativeAnchorConfig
  ) => FrameNodeRect | null;
}): DefinedPositionRelativeRelation[] => {
  const root = args.previewRoot;

  if (!root) {
    return [];
  }

  const frameNodes = args.collectFrameSelectionAnchors(root);
  const frameNodeById = new Map<string, HTMLElement>();
  frameNodes.forEach((node) => {
    const frameGroupId = args.getFrameGroupId(node);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, node);
    }
  });

  const allPositionGroups = args.collectPositionBoxGroups(root, { includeSingletons: true });
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
      return `${args.normalizePositionGroupDisplayLabel(group.label, group.id)} (그룹 ${group.frameGroupIds.length}개)`;
    }

    const singleFrameGroupId = args.readSingleFrameGroupId(group.frameGroupIds);
    return singleFrameGroupId || group.label || group.id;
  };

  const buildFrameLabel = (frameGroupId: string) => {
    const resolvedId = frameGroupId.trim();
    if (!resolvedId) {
      return '-';
    }
    const frameText = args.positionRelationFrameLabelById.get(resolvedId) || '';
    return frameText ? `${resolvedId} | ${frameText}` : resolvedId;
  };

  const groupRectById = new Map<string, FrameNodeRect>();
  allPositionGroups.forEach((group) => {
    const groupPageInner =
      group.frameGroupIds
        .map((frameGroupId) => frameNodeById.get(frameGroupId) || null)
        .map((node) => node?.closest<HTMLElement>('.page-inner') || null)
        .find((pageInner): pageInner is HTMLElement => Boolean(pageInner)) || null;
    const groupRect = groupPageInner ? args.readPositionGroupWrapperRect(groupPageInner, group.id) : null;
    if (groupRect) {
      groupRectById.set(group.id, groupRect);
    }
  });

  const candidates = frameNodes
    .map((targetNode) => {
      const targetFrameGroupId = args.getFrameGroupId(targetNode).trim();
      const targetPageInner = targetNode.closest<HTMLElement>('.page-inner') || null;

      if (!targetFrameGroupId || !targetPageInner) {
        return null;
      }

      const targetConfig =
        args.readStoredRelativeAnchorConfig(targetNode) ||
        args.readStoredRelativeAnchorConfig(args.resolveFrameLayoutShell(targetNode)) ||
        args.readStoredRelativeAnchorConfig(args.resolveFrameContentTarget(targetNode)) ||
        args.readStoredRelativeAnchorConfig(
          targetNode.querySelector<HTMLElement>('[data-template-frame-position-mode="relative"]')
        );
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
          ? groupRectById.get(targetGroupId) || null
          : args.readFrameMoveRect(targetNode);

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
          anchorRect = anchorNode ? args.readFrameMoveRect(anchorNode) : null;
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
          anchorRect = anchorNode ? args.readFrameMoveRect(anchorNode) : null;
        }
      } else {
        anchorKind = 'page-corner';
        anchorPageCornerId = String(targetConfig.anchorId || '').trim();
        anchorLabel = args.pageCornerAnchorLabels[targetConfig.anchorId] || targetConfig.anchorId;
        anchorRect = args.resolveRelativeAnchorRect(targetPageInner, targetConfig);
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

      const verticalRelation =
        targetRect && anchorRect
          ? resolveRelativeRelationVerticalGap(targetConfig, targetRect, anchorRect)
          : {
              anchorY: targetConfig.anchorY,
              gapYPx: Math.round(targetConfig.offsetY),
            };

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
        anchorY: verticalRelation.anchorY,
        gapYPx: verticalRelation.gapYPx,
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
};

const resolveRelativeRelationVerticalGap = (
  targetConfig: TemplateFrameRelativeAnchorConfig,
  targetRect: FrameNodeRect,
  anchorRect: FrameNodeRect
) => {
  const sourceEdgeY = targetConfig.sourceEdgeY || targetConfig.anchorY;
  const targetEdgeY =
    targetConfig.targetEdgeY ||
    (sourceEdgeY === 'bottom' ? ('top' as const) : ('bottom' as const));
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;
  const targetTop = targetRect.top;
  const targetBottom = targetRect.top + targetRect.height;

  if (sourceEdgeY === 'bottom' && targetEdgeY === 'top') {
    return {
      anchorY: 'bottom' as const,
      gapYPx: Math.round(targetTop - anchorBottom),
    };
  }

  if (sourceEdgeY === 'top' && targetEdgeY === 'bottom') {
    return {
      anchorY: 'top' as const,
      gapYPx: Math.round(anchorTop - targetBottom),
    };
  }

  return {
    anchorY: targetConfig.anchorY,
    gapYPx:
      targetConfig.anchorY === 'bottom'
        ? Math.round(targetTop - anchorBottom)
        : Math.round(anchorTop - targetBottom),
  };
};

export const focusDefinedPositionRelativeRelations = (args: {
  definedPositionRelativeRelations: DefinedPositionRelativeRelation[];
  positionBoxGroupByFrameGroupId: Map<string, PositionImpactGroup>;
  selectedFrameGroupIds: string[];
}): DefinedPositionRelativeRelation[] => {
  const { definedPositionRelativeRelations, positionBoxGroupByFrameGroupId, selectedFrameGroupIds } = args;

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
};

export const resolvePositionSpacingOrderedGroupMembers = (args: {
  previewRoot: HTMLDivElement | null;
  targetFrameGroupIds: string[];
  selectionKindByFrameGroupId?: Record<string, 'group' | 'frame'>;
  selectionGroupIdByFrameGroupId?: Record<string, string>;
  collectPositionBoxGroups: (
    root: HTMLElement,
    options?: { includeSingletons?: boolean }
  ) => PositionImpactGroup[];
  collectFrameSelectionAnchors: (root: HTMLElement) => HTMLElement[];
  getFrameGroupId: (node: HTMLElement) => string;
  readFrameMoveRect: (node: HTMLElement) => FrameNodeRect;
  resolvePositionGroupWrapperElement: (pageInner: HTMLElement, groupId: string) => HTMLElement | null;
  readFrameElementRect: (element: HTMLElement, pageInner: HTMLElement) => FrameNodeRect | null;
}): PositionSpacingOrderedGroupMember[] => {
  const root = args.previewRoot;
  const selectionKindByFrameGroupIdArg = args.selectionKindByFrameGroupId || {};
  const selectionGroupIdByFrameGroupIdArg = args.selectionGroupIdByFrameGroupId || {};
  const normalizedTargetFrameGroupIds = Array.from(
    new Set(args.targetFrameGroupIds.map((frameGroupId) => frameGroupId.trim()).filter((frameGroupId) => Boolean(frameGroupId)))
  );

  if (!root || normalizedTargetFrameGroupIds.length <= 0) {
    return [];
  }

  const positionBoxGroups = args.collectPositionBoxGroups(root, { includeSingletons: true });
  const groupById = new Map(positionBoxGroups.map((group) => [group.id, group] as const));
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
      const selectionKind = selectionKindByFrameGroupIdArg[frameGroupId] || 'frame';
      const explicitSelectionGroupId = (selectionGroupIdByFrameGroupIdArg[frameGroupId] || '').trim();
      const group =
        selectionKind === 'group' && explicitSelectionGroupId
          ? groupById.get(explicitSelectionGroupId) || groupByFrameGroupId.get(frameGroupId)
          : groupByFrameGroupId.get(frameGroupId);
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

  const parentGroupIdByChildGroupId = new Map<string, string>();
  positionBoxGroups.forEach((group) => {
    (group.childGroupIds || []).forEach((childGroupId) => {
      const normalizedChildGroupId = childGroupId.trim();
      if (normalizedChildGroupId && !parentGroupIdByChildGroupId.has(normalizedChildGroupId)) {
        parentGroupIdByChildGroupId.set(normalizedChildGroupId, group.id);
      }
    });
  });

  const resolveAncestorGroups = (groupId: string) => {
    const ancestors: PositionImpactGroup[] = [];
    const visitedGroupIds = new Set<string>();
    let currentGroupId = groupId.trim();

    while (currentGroupId && !visitedGroupIds.has(currentGroupId)) {
      visitedGroupIds.add(currentGroupId);
      const parentGroupId = parentGroupIdByChildGroupId.get(currentGroupId) || '';
      const parentGroup = parentGroupId ? groupById.get(parentGroupId) || null : null;

      if (!parentGroup) {
        break;
      }

      ancestors.push(parentGroup);
      currentGroupId = parentGroup.id;
    }

    return ancestors;
  };

  const groupContainsGroup = (containerGroup: PositionImpactGroup, targetGroup: PositionImpactGroup) => {
    if (containerGroup.id === targetGroup.id) {
      return true;
    }

    const containerFrameGroupIdSet = new Set(containerGroup.frameGroupIds);
    return targetGroup.frameGroupIds.every((frameGroupId) => containerFrameGroupIdSet.has(frameGroupId));
  };

  const resolveEffectiveSpacingGroup = (
    selectedEntry: {
      group: PositionImpactGroup;
      selectionKind: 'group' | 'frame';
      selectionEntityId: string;
    },
    peerEntries: Array<{
      group: PositionImpactGroup;
      selectionKind: 'group' | 'frame';
      selectionEntityId: string;
    }>
  ) => {
    if (selectedEntry.selectionKind !== 'group' || selectedEntry.group.frameGroupIds.length <= 1) {
      return selectedEntry.group;
    }

    let effectiveGroup = selectedEntry.group;
    resolveAncestorGroups(selectedEntry.group.id).forEach((ancestorGroup) => {
      const hasExternalPeer = peerEntries.some((peerEntry) => {
        if (peerEntry.group.id === selectedEntry.group.id) {
          return false;
        }

        return !groupContainsGroup(ancestorGroup, peerEntry.group);
      });

      if (hasExternalPeer) {
        effectiveGroup = ancestorGroup;
      }
    });

    return effectiveGroup;
  };

  const effectiveSelectedGroups = Array.from(
    selectedGroups
      .reduce((accumulator, selectedEntry) => {
        const effectiveGroup = resolveEffectiveSpacingGroup(selectedEntry, selectedGroups);
        const entityKey =
          selectedEntry.selectionKind === 'group'
            ? `group:${effectiveGroup.id}`
            : `frame:${selectedEntry.selectionEntityId}`;

        if (!accumulator.has(entityKey)) {
          accumulator.set(entityKey, {
            ...selectedEntry,
            group: effectiveGroup,
          });
        }

        return accumulator;
      }, new Map<string, (typeof selectedGroups)[number]>())
      .values()
  );

  const frameNodeById = new Map<string, HTMLElement>();
  args.collectFrameSelectionAnchors(root).forEach((node) => {
    const frameGroupId = args.getFrameGroupId(node);
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, node);
    }
  });

  return effectiveSelectedGroups
    .map((selectedEntry) => {
      const group = selectedEntry.group;
      const memberEntries = group.frameGroupIds
        .map((frameGroupId) => {
          const memberNode = frameNodeById.get(frameGroupId) || null;
          const memberPageInner = memberNode?.closest<HTMLElement>('.page-inner') || null;
          const memberRect = memberNode ? args.readFrameMoveRect(memberNode) : null;
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

      const memberEntriesByPageInner = new Map<HTMLElement, typeof memberEntries>();
      memberEntries.forEach((entry) => {
        const currentEntries = memberEntriesByPageInner.get(entry.pageInner) || [];
        currentEntries.push(entry);
        memberEntriesByPageInner.set(entry.pageInner, currentEntries);
      });

      let resolvedPageInner: HTMLElement | null = null;
      let normalizedMemberEntries: typeof memberEntries = [];

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
        const selectedMemberEntry = memberEntries.find((entry) => entry.frameGroupId === selectedEntry.selectionEntityId);
        resolvedPageInner = selectedMemberEntry?.pageInner || null;
        normalizedMemberEntries = resolvedPageInner ? memberEntriesByPageInner.get(resolvedPageInner) || [] : [];
      }

      if (normalizedMemberEntries.length <= 0) {
        return null;
      }

      const wrapper =
        selectedEntry.selectionKind === 'group' && resolvedPageInner
          ? args.resolvePositionGroupWrapperElement(resolvedPageInner, group.id)
          : null;
      const groupRect =
        selectedEntry.selectionKind === 'group'
          ? wrapper && resolvedPageInner
            ? args.readFrameElementRect(wrapper, resolvedPageInner)
            : null
          : (() => {
              const minLeft = Math.min(...normalizedMemberEntries.map((entry) => entry.rect.left));
              const minTop = Math.min(...normalizedMemberEntries.map((entry) => entry.rect.top));
              const maxRight = Math.max(...normalizedMemberEntries.map((entry) => entry.rect.left + entry.rect.width));
              const maxBottom = Math.max(...normalizedMemberEntries.map((entry) => entry.rect.top + entry.rect.height));
              return {
                left: minLeft,
                top: minTop,
                width: Math.max(1, maxRight - minLeft),
                height: Math.max(1, maxBottom - minTop),
              };
            })();

      if (!groupRect) {
        return null;
      }

      const spacingReferenceRects =
        selectedEntry.selectionKind === 'group' ? [groupRect] : normalizedMemberEntries.map((entry) => entry.rect);

      return {
        group,
        selectionEntityId: selectedEntry.selectionEntityId,
        pageInner: resolvedPageInner || normalizedMemberEntries[0].pageInner,
        groupRect,
        memberFrameEntries: normalizedMemberEntries,
        spacingReferenceRects,
      };
    })
    .filter((value): value is PositionSpacingOrderedGroupMember => Boolean(value));
};

export const resolvePositionSpacingPairsFromOrderedMembers = (
  orderedMembers: PositionSpacingOrderedGroupMember[]
): PositionSpacingResolvedPair[] => {
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
          anchorY: PositionSpacingResolvedPair['anchorY'];
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

  const resolveEntityKey = (member: PositionSpacingOrderedGroupMember) => {
    const groupId = member.group.id.trim();
    if (groupId.startsWith('single:') || (member.group.inferred && member.memberFrameEntries.length <= 1)) {
      return member.selectionEntityId.trim() || groupId.replace(/^single:/, '').trim();
    }

    return groupId || member.selectionEntityId.trim();
  };

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
      const sortKey = [resolveEntityKey(leftMember), resolveEntityKey(rightMember)]
        .sort((left, right) => left.localeCompare(right, 'ko'))
        .join('<->');

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

  const clearVerticalEdges = sortedEdges.filter((edge) => edge.isClearVertical);
  const selectedEdges =
    clearVerticalEdges.length > 0
      ? clearVerticalEdges
      : sortedEdges.filter((edge) => unionParent(edge.leftIndex, edge.rightIndex));
  const pairs: PositionSpacingResolvedPair[] = [];

  selectedEdges.forEach((edge) => {
    const leftMember = orderedMembers[edge.leftIndex];
    const rightMember = orderedMembers[edge.rightIndex];
    const directionTolerance = 0.5;
    const leftRectTop = leftMember.groupRect.top;
    const leftRectBottom = leftMember.groupRect.top + leftMember.groupRect.height;
    const rightRectTop = rightMember.groupRect.top;
    const rightRectBottom = rightMember.groupRect.top + rightMember.groupRect.height;
    const leftIsAboveRight = leftRectBottom <= rightRectTop - directionTolerance;
    const rightIsAboveLeft = rightRectBottom <= leftRectTop - directionTolerance;
    const preferLeftToRight =
      leftIsAboveRight || rightIsAboveLeft
        ? leftIsAboveRight
        : edge.leftToRight.isClearVertical !== edge.rightToLeft.isClearVertical
          ? edge.leftToRight.isClearVertical
          : edge.leftToRight.preferredGapMagnitude <= edge.rightToLeft.preferredGapMagnitude + 0.1;
    const anchorMember = preferLeftToRight ? leftMember : rightMember;
    const targetMember = preferLeftToRight ? rightMember : leftMember;
    const directedRelation = preferLeftToRight ? edge.leftToRight : edge.rightToLeft;
    const pairKey = [resolveEntityKey(leftMember), resolveEntityKey(rightMember)]
      .sort((left, right) => left.localeCompare(right, 'ko'))
      .join('<->');

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
};

export const buildPositionSpacingEntityVisualByKey = (args: {
  positionOrderLockSelectionVisualByGroupId: Map<string, PositionSpacingEntityVisual>;
  positionSpacingSettingRelations: Array<{
    anchorKind: 'group' | 'frame' | 'page-corner';
    anchorGroupId: string;
    anchorFrameGroupId: string;
    anchorLabel: string;
    targetKind: 'group' | 'frame';
    targetGroupId: string;
    targetFrameGroupIds: string[];
    targetLabel: string;
  }>;
  positionSpacingNewPairSummaries: Array<{
    anchorGroupId: string;
    anchorLabel: string;
    targetGroupId: string;
    targetLabel: string;
  }>;
  resolvePositionOrderLockSelectionVisual: (
    selectionOrder: number,
    groupId: string,
    groupLabel?: string
  ) => PositionSpacingEntityVisual;
}) => {
  const nextMap = new Map<string, PositionSpacingEntityVisual>();
  let nextOrder = 1;
  const addEntity = (entityKey: string, visualLookupId = entityKey, visualLabel = '') => {
    const normalizedEntityKey = entityKey.trim();
    const normalizedVisualLookupId = visualLookupId.trim();

    if (!normalizedEntityKey || nextMap.has(normalizedEntityKey)) {
      return;
    }

    const selectedVisual = args.positionOrderLockSelectionVisualByGroupId.get(normalizedVisualLookupId);
    if (selectedVisual) {
      nextMap.set(normalizedEntityKey, selectedVisual);
      nextOrder = Math.max(nextOrder, selectedVisual.selectionOrder + 1);
      return;
    }

    nextMap.set(
      normalizedEntityKey,
      args.resolvePositionOrderLockSelectionVisual(
        nextOrder,
        normalizedVisualLookupId || normalizedEntityKey,
        visualLabel || normalizedEntityKey
      )
    );
    nextOrder += 1;
  };

  args.positionSpacingSettingRelations.forEach((relation) => {
    addEntity(
      relation.anchorKind === 'group' ? `group:${relation.anchorGroupId}` : `frame:${relation.anchorFrameGroupId}`,
      relation.anchorKind === 'group' ? relation.anchorGroupId : `single:${relation.anchorFrameGroupId}`,
      relation.anchorLabel
    );
    addEntity(
      relation.targetKind === 'group'
        ? `group:${relation.targetGroupId}`
        : `frame:${relation.targetFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) || ''}`,
      relation.targetKind === 'group'
        ? relation.targetGroupId
        : `single:${relation.targetFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) || ''}`,
      relation.targetLabel
    );
  });
  args.positionSpacingNewPairSummaries.forEach((pair) => {
    addEntity(`selection:${pair.anchorGroupId}`, pair.anchorGroupId, pair.anchorLabel);
    addEntity(`selection:${pair.targetGroupId}`, pair.targetGroupId, pair.targetLabel);
  });

  return nextMap;
};

export const buildPositionSpacingGuideRelations = (args: {
  positionOrderLockSelectionMode: boolean;
  positionSpacingResolvedPairs: PositionSpacingResolvedPair[];
  positionSpacingDraftByPairKey: Record<string, { gapY: string }>;
  resolvePositionOrderLockGroupLabel: (groupId: string, fallbackLabel: string) => string;
}): PositionSpacingGuideRelation[] => {
  if (!args.positionOrderLockSelectionMode) {
    return [];
  }

  return args.positionSpacingResolvedPairs.map((pair) => {
    const anchorMember = pair.anchorMember;
    const targetMember = pair.targetMember;
    const anchorLabel = args.resolvePositionOrderLockGroupLabel(anchorMember.group.id, anchorMember.group.label);
    const targetLabel = args.resolvePositionOrderLockGroupLabel(targetMember.group.id, targetMember.group.label);
    const draftGap = Number.parseFloat(args.positionSpacingDraftByPairKey[pair.pairKey]?.gapY || '');
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
};

export const buildPositionSpacingSettingRelations = (args: any): DefinedPositionRelativeRelation[] => {
  const baseRelations = args.definedPositionRelativeRelations.filter(
    (relation: DefinedPositionRelativeRelation) => relation.anchorKind !== 'page-corner'
  );
  const seenRelationKeys = new Set<string>();
  const root = args.previewRoot as HTMLDivElement | null;

  if (!root) {
    return baseRelations;
  }

  const extractAutoGroupPageInnerSet = new Set(
    args.collectExtractAutoPositionGroupCandidates(root).map((candidate: any) => candidate.pageInner)
  );

  const frameNodes = args.collectFrameSelectionAnchors(root);
  const frameNodeById = new Map<string, HTMLElement>();
  frameNodes.forEach((node: HTMLElement) => {
    const frameGroupId = args.getFrameGroupId(node).trim();
    if (frameGroupId) {
      frameNodeById.set(frameGroupId, node);
    }
  });

  const readPartialRelativeAnchorConfig = (
    element: HTMLElement | null | undefined
  ): any | null => {
    if (!element) {
      return null;
    }

    const positionMode = element.getAttribute(args.TEMPLATE_FRAME_POSITION_MODE_ATTR)?.trim();
    const anchorKind = element.getAttribute(args.TEMPLATE_FRAME_RELATIVE_ANCHOR_KIND_ATTR)?.trim();
    const anchorId = element.getAttribute(args.TEMPLATE_FRAME_RELATIVE_ANCHOR_ID_ATTR)?.trim();
    const anchorX = element.getAttribute(args.TEMPLATE_FRAME_RELATIVE_ANCHOR_X_ATTR)?.trim();
    const anchorY = element.getAttribute(args.TEMPLATE_FRAME_RELATIVE_ANCHOR_Y_ATTR)?.trim();
    const offsetX = Number.parseFloat(element.getAttribute(args.TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_X_ATTR) || '');
    const offsetY = Number.parseFloat(element.getAttribute(args.TEMPLATE_FRAME_RELATIVE_ANCHOR_OFFSET_Y_ATTR) || '');

    if (
      positionMode !== 'relative' ||
      (anchorKind !== 'frame' && anchorKind !== 'page-corner' && anchorKind !== 'group') ||
      !anchorId ||
      (anchorY !== 'top' && anchorY !== 'bottom')
    ) {
      return null;
    }

    return {
      positionMode,
      anchorKind,
      anchorId,
      anchorX: anchorX === 'right' ? 'right' : 'left',
      anchorY,
      offsetX: Number.isFinite(offsetX) ? offsetX : 0,
      offsetY: Number.isFinite(offsetY) ? offsetY : 0,
    };
  };

  const readNodeRelativeConfig = (node: HTMLElement) => {
    const configElements = [
      node,
      args.resolveFrameLayoutShell(node),
      args.resolveFrameContentTarget(node),
      node.querySelector<HTMLElement>('[data-template-frame-position-mode="relative"]'),
    ];

    for (const element of configElements) {
      const config = args.readStoredRelativeAnchorConfig(element) || readPartialRelativeAnchorConfig(element);
      if (config) {
        return config;
      }
    }

    return null;
  };

  const buildFrameLabel = (frameGroupId: string) => {
    const normalizedFrameGroupId = frameGroupId.trim();
    const frameText = args.positionRelationFrameLabelById.get(normalizedFrameGroupId) || '';
    return frameText ? `${normalizedFrameGroupId} | ${frameText}` : normalizedFrameGroupId;
  };
  const buildGroupLabel = (group: PositionImpactGroup) =>
    `${args.normalizePositionGroupDisplayLabel(group.label, group.id)} (${args.POSITION_GROUP_LABEL_PREFIX} ${group.frameGroupIds.length}개)`;
  const resolveRectFromFrameGroupIds = (frameGroupIds: string[]) => {
    const rects = frameGroupIds
      .map((frameGroupId) => frameNodeById.get(frameGroupId.trim()) || null)
      .map((node) => (node ? args.readFrameMoveRect(node) : null))
      .filter((rect): rect is FrameNodeRect => Boolean(rect));

    if (rects.length <= 0) {
      return null;
    }

    const minLeft = Math.min(...rects.map((rect) => rect.left));
    const minTop = Math.min(...rects.map((rect) => rect.top));
    const maxRight = Math.max(...rects.map((rect) => rect.left + rect.width));
    const maxBottom = Math.max(...rects.map((rect) => rect.top + rect.height));
    return {
      left: minLeft,
      top: minTop,
      width: Math.max(1, maxRight - minLeft),
      height: Math.max(1, maxBottom - minTop),
    };
  };

  const fallbackRelations = frameNodes
    .map((targetNode: HTMLElement) => {
      const nodePageInner = targetNode.closest<HTMLElement>('.page-inner') || null;

      if (nodePageInner && extractAutoGroupPageInnerSet.has(nodePageInner)) {
        return null;
      }

      const targetFrameGroupId = args.getFrameGroupId(targetNode).trim();
      const targetConfig = readNodeRelativeConfig(targetNode);

      if (!targetFrameGroupId || !targetConfig || targetConfig.anchorKind === 'page-corner') {
        return null;
      }

      const targetGroup = args.positionBoxGroupByFrameGroupId.get(targetFrameGroupId) || null;
      const targetKind: DefinedPositionRelativeRelation['targetKind'] =
        targetGroup && targetGroup.frameGroupIds.length > 1 ? 'group' : 'frame';
      const targetGroupId = targetKind === 'group' ? targetGroup?.id || '' : '';
      const targetFrameGroupIds =
        targetKind === 'group' ? targetGroup?.frameGroupIds.slice() || [targetFrameGroupId] : [targetFrameGroupId];
      const targetRect =
        targetKind === 'group' && targetGroupId
          ? args.readPositionGroupWrapperRect(root, targetGroupId) || resolveRectFromFrameGroupIds(targetFrameGroupIds)
          : resolveRectFromFrameGroupIds([targetFrameGroupId]);

      let anchorKind: DefinedPositionRelativeRelation['anchorKind'] = 'frame';
      let anchorGroupId = '';
      let anchorFrameGroupId = '';
      let anchorFrameGroupIds: string[] = [];
      let anchorLabel = '';
      let anchorRect: FrameNodeRect | null = null;
      const rawAnchorId = String(targetConfig.anchorId || '').trim();

      if (targetConfig.anchorKind === 'group') {
        const anchorGroup = args.positionBoxGroupById.get(rawAnchorId) || null;
        if (anchorGroup && anchorGroup.frameGroupIds.length > 1) {
          anchorKind = 'group';
          anchorGroupId = anchorGroup.id;
          anchorFrameGroupIds = anchorGroup.frameGroupIds.slice();
          anchorLabel = buildGroupLabel(anchorGroup);
          anchorRect =
            args.readPositionGroupWrapperRect(root, anchorGroup.id) ||
            resolveRectFromFrameGroupIds(anchorGroup.frameGroupIds);
        } else {
          anchorKind = 'frame';
          anchorFrameGroupId = rawAnchorId;
          anchorFrameGroupIds = rawAnchorId ? [rawAnchorId] : [];
          anchorLabel = buildFrameLabel(rawAnchorId);
          anchorRect = resolveRectFromFrameGroupIds(anchorFrameGroupIds);
        }
      } else {
        const anchorFrameGroup = args.positionBoxGroupByFrameGroupId.get(rawAnchorId) || null;
        if (anchorFrameGroup && anchorFrameGroup.frameGroupIds.length > 1) {
          anchorKind = 'group';
          anchorGroupId = anchorFrameGroup.id;
          anchorFrameGroupIds = anchorFrameGroup.frameGroupIds.slice();
          anchorLabel = buildGroupLabel(anchorFrameGroup);
          anchorRect =
            args.readPositionGroupWrapperRect(root, anchorFrameGroup.id) ||
            resolveRectFromFrameGroupIds(anchorFrameGroup.frameGroupIds);
        } else {
          anchorKind = 'frame';
          anchorFrameGroupId = rawAnchorId;
          anchorFrameGroupIds = rawAnchorId ? [rawAnchorId] : [];
          anchorLabel = buildFrameLabel(rawAnchorId);
          anchorRect = resolveRectFromFrameGroupIds(anchorFrameGroupIds);
        }
      }

      const targetEntityId = targetKind === 'group' ? targetGroupId : targetFrameGroupId;
      const anchorEntityId = anchorKind === 'group' ? anchorGroupId : anchorFrameGroupId;
      const relationKey = `${targetKind}:${targetEntityId}:configured:${targetFrameGroupId}:${anchorKind}:${anchorEntityId}`;

      if (!targetEntityId || !anchorEntityId || targetEntityId === anchorEntityId || seenRelationKeys.has(relationKey)) {
        return null;
      }

      seenRelationKeys.add(relationKey);
      const verticalRelation =
        targetRect && anchorRect
          ? resolveRelativeRelationVerticalGap(targetConfig, targetRect, anchorRect)
          : {
              anchorY: targetConfig.anchorY,
              gapYPx: Math.round(targetConfig.offsetY),
            };

      return {
        key: relationKey,
        targetKind,
        targetGroupId,
        targetLabel:
          targetKind === 'group' && targetGroup ? buildGroupLabel(targetGroup) : buildFrameLabel(targetFrameGroupId),
        targetFrameGroupIds,
        targetConfiguredFrameGroupIds: [targetFrameGroupId],
        anchorKind,
        anchorLabel: anchorLabel || anchorEntityId,
        anchorPageCornerId: '',
        anchorGroupId,
        anchorFrameGroupId,
        anchorFrameGroupIds,
        anchorY: verticalRelation.anchorY,
        gapYPx: verticalRelation.gapYPx,
      } as DefinedPositionRelativeRelation;
    })
    .filter((relation: DefinedPositionRelativeRelation | null): relation is DefinedPositionRelativeRelation => Boolean(relation));

  const fallbackGroupWrapperRelations = (args.positionBoxGroups || [])
    .map((group: PositionImpactGroup) => {
      if (!group || group.frameGroupIds.length <= 1 || typeof args.resolvePositionGroupWrapperElement !== 'function') {
        return null;
      }

      const targetWrapper = args.resolvePositionGroupWrapperElement(root, group.id) as HTMLElement | null;
      const targetPageInner = targetWrapper?.closest<HTMLElement>('.page-inner') || null;
      const targetConfig = targetWrapper
        ? args.readStoredRelativeAnchorConfig(targetWrapper) || readPartialRelativeAnchorConfig(targetWrapper)
        : null;

      if (!targetWrapper || !targetPageInner || !targetConfig || targetConfig.anchorKind === 'page-corner') {
        return null;
      }

      const targetRect = args.readPositionGroupWrapperRect(root, group.id) || resolveRectFromFrameGroupIds(group.frameGroupIds);

      if (!targetRect) {
        return null;
      }

      let anchorKind: DefinedPositionRelativeRelation['anchorKind'] = 'frame';
      let anchorGroupId = '';
      let anchorFrameGroupId = '';
      let anchorFrameGroupIds: string[] = [];
      let anchorLabel = '';
      let anchorRect: FrameNodeRect | null = null;
      const rawAnchorId = String(targetConfig.anchorId || '').trim();

      if (targetConfig.anchorKind === 'group') {
        const anchorGroup = args.positionBoxGroupById.get(rawAnchorId) || null;
        if (anchorGroup && anchorGroup.frameGroupIds.length > 1) {
          anchorKind = 'group';
          anchorGroupId = anchorGroup.id;
          anchorFrameGroupIds = anchorGroup.frameGroupIds.slice();
          anchorLabel = buildGroupLabel(anchorGroup);
          anchorRect =
            args.readPositionGroupWrapperRect(root, anchorGroup.id) ||
            resolveRectFromFrameGroupIds(anchorGroup.frameGroupIds);
        } else {
          anchorKind = 'frame';
          anchorFrameGroupId = rawAnchorId;
          anchorFrameGroupIds = rawAnchorId ? [rawAnchorId] : [];
          anchorLabel = buildFrameLabel(rawAnchorId);
          anchorRect = resolveRectFromFrameGroupIds(anchorFrameGroupIds);
        }
      } else {
        const anchorFrameGroup = args.positionBoxGroupByFrameGroupId.get(rawAnchorId) || null;
        if (anchorFrameGroup && anchorFrameGroup.frameGroupIds.length > 1) {
          anchorKind = 'group';
          anchorGroupId = anchorFrameGroup.id;
          anchorFrameGroupIds = anchorFrameGroup.frameGroupIds.slice();
          anchorLabel = buildGroupLabel(anchorFrameGroup);
          anchorRect =
            args.readPositionGroupWrapperRect(root, anchorFrameGroup.id) ||
            resolveRectFromFrameGroupIds(anchorFrameGroup.frameGroupIds);
        } else {
          anchorKind = 'frame';
          anchorFrameGroupId = rawAnchorId;
          anchorFrameGroupIds = rawAnchorId ? [rawAnchorId] : [];
          anchorLabel = buildFrameLabel(rawAnchorId);
          anchorRect = resolveRectFromFrameGroupIds(anchorFrameGroupIds);
        }
      }

      const anchorEntityId = anchorKind === 'group' ? anchorGroupId : anchorFrameGroupId;
      const relationKey = `group:${group.id}:configured:${group.id}:${anchorKind}:${anchorEntityId}`;

      if (!group.id || !anchorEntityId || group.id === anchorEntityId || !anchorRect || seenRelationKeys.has(relationKey)) {
        return null;
      }

      seenRelationKeys.add(relationKey);
      const verticalRelation = resolveRelativeRelationVerticalGap(targetConfig, targetRect, anchorRect);

      return {
        key: relationKey,
        targetKind: 'group',
        targetGroupId: group.id,
        targetLabel: buildGroupLabel(group),
        targetFrameGroupIds: group.frameGroupIds.slice(),
        targetConfiguredFrameGroupIds: group.frameGroupIds.slice(),
        relationConfiguredFrameGroupIds: group.frameGroupIds.slice(),
        anchorKind,
        anchorLabel: anchorLabel || anchorEntityId,
        anchorPageCornerId: '',
        anchorGroupId,
        anchorFrameGroupId,
        anchorFrameGroupIds,
        anchorY: verticalRelation.anchorY,
        gapYPx: verticalRelation.gapYPx,
      } as DefinedPositionRelativeRelation;
    })
    .filter((relation: DefinedPositionRelativeRelation | null): relation is DefinedPositionRelativeRelation => Boolean(relation));

  const expandedBaseRelations = baseRelations
    .flatMap((relation: DefinedPositionRelativeRelation) => {
      const configuredFrameGroupIds = (
        relation.targetConfiguredFrameGroupIds.length > 0
          ? relation.targetConfiguredFrameGroupIds
          : relation.targetFrameGroupIds
      )
        .map((frameGroupId) => frameGroupId.trim())
        .filter((frameGroupId) => Boolean(frameGroupId));
      const targetEntityId =
        relation.targetKind === 'group' ? relation.targetGroupId : args.readSingleFrameGroupId(relation.targetFrameGroupIds);
      const anchorEntityId =
        relation.anchorKind === 'group'
          ? relation.anchorGroupId
          : relation.anchorKind === 'frame'
            ? relation.anchorFrameGroupId
            : '';

      if (!targetEntityId || !anchorEntityId || configuredFrameGroupIds.length <= 0) {
        return [] as DefinedPositionRelativeRelation[];
      }

      return configuredFrameGroupIds.map((configuredFrameGroupId) => ({
        ...relation,
        key: `${relation.targetKind}:${targetEntityId}:configured:${configuredFrameGroupId}:${relation.anchorKind}:${anchorEntityId}`,
        targetConfiguredFrameGroupIds: [configuredFrameGroupId],
      }));
    })
    .filter((relation: DefinedPositionRelativeRelation) => {
      if (seenRelationKeys.has(relation.key)) {
        return false;
      }

      seenRelationKeys.add(relation.key);
      return true;
    });

  const rawRelations = [...fallbackGroupWrapperRelations, ...fallbackRelations, ...expandedBaseRelations];
  const parentGroupIdByChildGroupId = new Map<string, string>();
  args.positionBoxGroups.forEach((group: PositionImpactGroup) => {
    (group.childGroupIds || []).forEach((childGroupId) => {
      const normalizedChildGroupId = childGroupId.trim();
      if (normalizedChildGroupId && !parentGroupIdByChildGroupId.has(normalizedChildGroupId)) {
        parentGroupIdByChildGroupId.set(normalizedChildGroupId, group.id);
      }
    });
  });

  const resolveTopLevelGroup = (groupId: string) => {
    let currentGroupId = groupId.trim();
    const visitedGroupIds = new Set<string>();
    let currentGroup = currentGroupId ? args.positionBoxGroupById.get(currentGroupId) || null : null;

    while (currentGroupId && !visitedGroupIds.has(currentGroupId)) {
      visitedGroupIds.add(currentGroupId);
      const parentGroupId = parentGroupIdByChildGroupId.get(currentGroupId) || '';
      const parentGroup = parentGroupId ? args.positionBoxGroupById.get(parentGroupId) || null : null;

      if (!parentGroup) {
        break;
      }

      currentGroupId = parentGroup.id;
      currentGroup = parentGroup;
    }

    return currentGroup;
  };

  const resolveFrameTopLevelGroup = (frameGroupId: string) => {
    const normalizedFrameGroupId = frameGroupId.trim();
    if (!normalizedFrameGroupId) {
      return null;
    }

    const containingGroups = args.positionBoxGroups
      .filter(
        (group: PositionImpactGroup) =>
          !group.inferred &&
          group.frameGroupIds.length > 1 &&
          group.frameGroupIds.some((memberFrameGroupId) => memberFrameGroupId.trim() === normalizedFrameGroupId)
      )
      .sort((left: PositionImpactGroup, right: PositionImpactGroup) => {
        if (left.frameGroupIds.length !== right.frameGroupIds.length) {
          return right.frameGroupIds.length - left.frameGroupIds.length;
        }
        return left.id.localeCompare(right.id, 'ko');
      });

    return containingGroups.length > 0 ? resolveTopLevelGroup(containingGroups[0]?.id || '') : null;
  };

  const resolveEntityRect = (entity: { kind: 'group' | 'frame'; id: string; frameGroupIds: string[] }) =>
    entity.kind === 'group'
      ? args.readPositionGroupWrapperRect(root, entity.id) || resolveRectFromFrameGroupIds(entity.frameGroupIds)
      : resolveRectFromFrameGroupIds(entity.frameGroupIds);

  const buildEntityFromGroup = (group: PositionImpactGroup) => ({
    kind: 'group' as const,
    id: group.id,
    label: buildGroupLabel(group),
    frameGroupIds: group.frameGroupIds.slice(),
    rect: resolveEntityRect({
      kind: 'group' as const,
      id: group.id,
      frameGroupIds: group.frameGroupIds,
    }),
  });

  const buildEntityFromFrame = (frameGroupId: string) => {
    const normalizedFrameGroupId = frameGroupId.trim();
    const topGroup = resolveFrameTopLevelGroup(normalizedFrameGroupId);

    if (topGroup) {
      return buildEntityFromGroup(topGroup);
    }

    return {
      kind: 'frame' as const,
      id: normalizedFrameGroupId,
      label: buildFrameLabel(normalizedFrameGroupId),
      frameGroupIds: normalizedFrameGroupId ? [normalizedFrameGroupId] : [],
      rect: resolveEntityRect({
        kind: 'frame' as const,
        id: normalizedFrameGroupId,
        frameGroupIds: normalizedFrameGroupId ? [normalizedFrameGroupId] : [],
      }),
    };
  };

  const buildEntityFromRelationSide = (
    kind: 'group' | 'frame',
    groupId: string,
    frameGroupId: string,
    frameGroupIds: string[]
  ) => {
    if (kind === 'group') {
      const topGroup = resolveTopLevelGroup(groupId) || null;
      if (topGroup) {
        return buildEntityFromGroup(topGroup);
      }
    }

    const firstFrameGroupId =
      frameGroupId.trim() ||
      frameGroupIds.find((candidateFrameGroupId) => Boolean(candidateFrameGroupId.trim()))?.trim() ||
      '';
    return buildEntityFromFrame(firstFrameGroupId);
  };

  const entityContainsFrame = (
    entity: {
      frameGroupIds: string[];
    },
    frameGroupId: string
  ) => entity.frameGroupIds.some((memberFrameGroupId) => memberFrameGroupId.trim() === frameGroupId.trim());
  const mergedByCanonicalPair = new Map<string, DefinedPositionRelativeRelation>();

  rawRelations.forEach((relation: DefinedPositionRelativeRelation) => {
    if (relation.anchorKind === 'page-corner') {
      return;
    }

    const targetEntity = buildEntityFromRelationSide(
      relation.targetKind,
      relation.targetGroupId,
      relation.targetFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) || '',
      relation.targetFrameGroupIds
    );
    const anchorEntity = buildEntityFromRelationSide(
      relation.anchorKind,
      relation.anchorGroupId,
      relation.anchorFrameGroupId,
      relation.anchorFrameGroupIds
    );

    if (
      !targetEntity.id ||
      !anchorEntity.id ||
      !targetEntity.rect ||
      !anchorEntity.rect ||
      `${targetEntity.kind}:${targetEntity.id}` === `${anchorEntity.kind}:${anchorEntity.id}`
    ) {
      return;
    }

    const targetBottom = targetEntity.rect.top + targetEntity.rect.height;
    const anchorBottom = anchorEntity.rect.top + anchorEntity.rect.height;
    const targetIsBelow = anchorBottom <= targetEntity.rect.top;
    const anchorIsBelow = targetBottom <= anchorEntity.rect.top;
    const upperEntity = targetIsBelow
      ? anchorEntity
      : anchorIsBelow
        ? targetEntity
        : targetEntity.rect.top <= anchorEntity.rect.top
          ? targetEntity
          : anchorEntity;
    const lowerEntity = upperEntity === targetEntity ? anchorEntity : targetEntity;
    const gapYPx =
      upperEntity.rect && lowerEntity.rect
        ? Math.max(0, Math.round(lowerEntity.rect.top - (upperEntity.rect.top + upperEntity.rect.height)))
        : Math.max(0, Math.round(relation.gapYPx));
    const canonicalPairKey = `${upperEntity.kind}:${upperEntity.id}->${lowerEntity.kind}:${lowerEntity.id}`;
    const rawConfiguredFrameGroupIds =
      relation.targetConfiguredFrameGroupIds.length > 0
        ? relation.targetConfiguredFrameGroupIds
        : relation.targetFrameGroupIds;
    const existing = mergedByCanonicalPair.get(canonicalPairKey);
    const nextRelation: DefinedPositionRelativeRelation = existing || {
      key: canonicalPairKey,
      targetKind: lowerEntity.kind,
      targetGroupId: lowerEntity.kind === 'group' ? lowerEntity.id : '',
      targetLabel: lowerEntity.label,
      targetFrameGroupIds: lowerEntity.frameGroupIds.slice(),
      targetConfiguredFrameGroupIds: lowerEntity.frameGroupIds.slice(),
      relationConfiguredFrameGroupIds: [],
      anchorKind: upperEntity.kind,
      anchorLabel: upperEntity.label,
      anchorPageCornerId: '',
      anchorGroupId: upperEntity.kind === 'group' ? upperEntity.id : '',
      anchorFrameGroupId: upperEntity.kind === 'frame' ? upperEntity.id : '',
      anchorFrameGroupIds: upperEntity.frameGroupIds.slice(),
      anchorY: 'bottom',
      gapYPx,
    };

    nextRelation.gapYPx = Math.min(nextRelation.gapYPx, gapYPx);
    nextRelation.relationConfiguredFrameGroupIds = Array.from(
      new Set([...(nextRelation.relationConfiguredFrameGroupIds || []), ...rawConfiguredFrameGroupIds])
    );
    nextRelation.targetConfiguredFrameGroupIds = Array.from(
      new Set(
        nextRelation.targetFrameGroupIds.length > 0
          ? nextRelation.targetFrameGroupIds
          : rawConfiguredFrameGroupIds.filter((frameGroupId) => entityContainsFrame(lowerEntity, frameGroupId))
      )
    );
    mergedByCanonicalPair.set(canonicalPairKey, nextRelation);
  });

  const simplifiedRelations = Array.from(mergedByCanonicalPair.values()).sort((left, right) => {
    const leftRect =
      left.targetKind === 'group'
        ? args.readPositionGroupWrapperRect(root, left.targetGroupId) || resolveRectFromFrameGroupIds(left.targetFrameGroupIds)
        : resolveRectFromFrameGroupIds(left.targetFrameGroupIds);
    const rightRect =
      right.targetKind === 'group'
        ? args.readPositionGroupWrapperRect(root, right.targetGroupId) || resolveRectFromFrameGroupIds(right.targetFrameGroupIds)
        : resolveRectFromFrameGroupIds(right.targetFrameGroupIds);

    return (leftRect?.top || 0) - (rightRect?.top || 0);
  });
  const buildRelationEntityPairKey = (relation: DefinedPositionRelativeRelation) => {
    const targetEntityId = relation.targetKind === 'group'
      ? relation.targetGroupId.trim()
      : (
          relation.targetFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) ||
          relation.targetConfiguredFrameGroupIds.find((frameGroupId) => Boolean(frameGroupId.trim())) ||
          ''
        ).trim();
    const anchorEntityId = relation.anchorKind === 'group'
      ? relation.anchorGroupId.trim()
      : relation.anchorKind === 'frame'
        ? relation.anchorFrameGroupId.trim()
        : '';

    return [targetEntityId ? `${relation.targetKind}:${targetEntityId}` : '', anchorEntityId ? `${relation.anchorKind}:${anchorEntityId}` : '']
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'ko'))
      .join('<->');
  };
  const simplifiedRelationEntityPairKeys = new Set(
    simplifiedRelations.map(buildRelationEntityPairKey).filter(Boolean)
  );
  const directWrapperRelations = fallbackGroupWrapperRelations.filter((relation) => {
    const relationPairKey = buildRelationEntityPairKey(relation);
    return Boolean(relationPairKey) && !simplifiedRelationEntityPairKeys.has(relationPairKey);
  });
  const coveredConfiguredFrameGroupIds = new Set(
    simplifiedRelations.flatMap((relation) =>
      relation.relationConfiguredFrameGroupIds && relation.relationConfiguredFrameGroupIds.length > 0
        ? relation.relationConfiguredFrameGroupIds
        : relation.targetConfiguredFrameGroupIds
    )
  );
  const simplifiedRelationKeys = new Set(simplifiedRelations.map((relation) => relation.key));
  const unresolvedBaseRelations = baseRelations.filter((relation: DefinedPositionRelativeRelation) => {
    if (relation.anchorKind === 'page-corner' || simplifiedRelationKeys.has(relation.key)) {
      return false;
    }

    const configuredFrameGroupIds = (
      relation.targetConfiguredFrameGroupIds.length > 0
        ? relation.targetConfiguredFrameGroupIds
        : relation.targetFrameGroupIds
    )
      .map((frameGroupId) => frameGroupId.trim())
      .filter(Boolean);

    if (
      configuredFrameGroupIds.length <= 0 ||
      configuredFrameGroupIds.every((frameGroupId) => coveredConfiguredFrameGroupIds.has(frameGroupId))
    ) {
      return false;
    }

    const hasUnresolvedAnchor =
      (relation.anchorKind === 'group' && !args.positionBoxGroupById.has(relation.anchorGroupId)) ||
      (relation.anchorKind === 'frame' && !frameNodeById.has(relation.anchorFrameGroupId));
    const hasUnresolvedTarget =
      relation.targetKind === 'group'
        ? !args.positionBoxGroupById.has(relation.targetGroupId)
        : relation.targetFrameGroupIds.some((frameGroupId) => !frameNodeById.has(frameGroupId));

    return hasUnresolvedAnchor || hasUnresolvedTarget;
  });

  return [...simplifiedRelations, ...directWrapperRelations, ...unresolvedBaseRelations];
};
