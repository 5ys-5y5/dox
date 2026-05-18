'use client';

import * as React from 'react';

type UseMetadataConnectionActionsOptions = any;

export const useMetadataConnectionActions = (options: UseMetadataConnectionActionsOptions) => {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const startParentKeySelectionMode = React.useCallback(() => {
    const { selectedFrameGroupIdsRef, clearTransientCanvasOverlays, setMetadataRelationSelectionMode, setMessage } =
      optionsRef.current;
    const activeSelectionIds = selectedFrameGroupIdsRef.current;

    if (activeSelectionIds.length === 0) {
      setMessage('먼저 key로 묶을 value 상자를 선택하세요.');
      return;
    }

    clearTransientCanvasOverlays();
    setMetadataRelationSelectionMode({
      kind: 'parent',
      sourceFrameGroupIds: activeSelectionIds.slice(),
    });
    setMessage(
      activeSelectionIds.length > 1
        ? `현재 value 상자 ${activeSelectionIds.length}개가 선택된 상태입니다. 이제 이 값들을 묶는 key 상자를 캔버스에서 1개 선택해주세요.`
        : '현재 value 상자 1개가 선택된 상태입니다. 이제 이 값의 key 상자를 캔버스에서 1개 선택해주세요.'
    );
  }, []);

  const startValueBoxSelectionMode = React.useCallback(() => {
    const {
      previewRef,
      selectedFrameGroupIdsRef,
      readSingleFrameGroupId,
      setMessage,
      resolveFrameSelectionAnchor,
      rawFrameNodeSelector,
      resolveNextFrameMetadata,
      getFrameNodes,
      readFrameParentGroupId,
      clearTransientCanvasOverlays,
      setFrameMetadataDraft,
      setMetadataRelationSelectionMode,
    } = optionsRef.current;
    const root = previewRef.current;
    const sourceKeyFrameGroupId = readSingleFrameGroupId(selectedFrameGroupIdsRef.current);

    if (!root || selectedFrameGroupIdsRef.current.length !== 1 || !sourceKeyFrameGroupId) {
      setMessage('먼저 기준이 될 key 상자 1개를 선택하세요.');
      return;
    }

    const sourceNode = resolveFrameSelectionAnchor(
      root.querySelector<HTMLElement>(`${rawFrameNodeSelector}[data-template-frame-group="${sourceKeyFrameGroupId}"]`)
    );
    const sourceMetadata = sourceNode ? resolveNextFrameMetadata(sourceNode, {}) : null;

    if (!sourceNode || !sourceMetadata) {
      setMessage('먼저 기준이 될 key 상자 1개를 선택하세요.');
      return;
    }

    const existingTargetFrameGroupIds = getFrameNodes(root)
      .filter((node: HTMLElement) => readFrameParentGroupId(node) === sourceKeyFrameGroupId)
      .map((node: HTMLElement) => node.getAttribute('data-template-frame-group') || '')
      .filter(Boolean);

    clearTransientCanvasOverlays();
    setFrameMetadataDraft((previous: any) => ({
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
    setMessage(
      '현재 key 상자가 선택된 상태입니다. 이제 이 key에 연결할 value 상자들을 캔버스에서 선택해주세요. 다시 클릭하면 해제됩니다.'
    );
  }, []);

  const clearParentKeySelectionDraft = React.useCallback(() => {
    const { setFrameMetadataDraft, metadataRelationSelectionModeRef, setMetadataRelationSelectionMode, setMessage } =
      optionsRef.current;

    setFrameMetadataDraft((previous: any) => ({
      ...previous,
      parentGroupId: '',
      valueKey: '',
    }));
    if (metadataRelationSelectionModeRef.current.kind === 'parent') {
      setMetadataRelationSelectionMode({ kind: 'idle' });
    }
    setMessage('연결할 key 상자를 비웠습니다.');
  }, []);

  const upsertVirtualDefinition = React.useCallback((rawText: string, target: 'key' | 'value') => {
    const {
      normalizeVirtualDefinitionId,
      virtualFrameDefinitions,
      setVirtualFrameDefinitions,
      persistVirtualFrameDefinitions,
      setFrameMetadataDraft,
      primarySelectedFrameGroupId,
      setMetadataRelationSelectionMode,
      setMessage,
    } = optionsRef.current;
    const label = rawText.trim();
    const id = normalizeVirtualDefinitionId(label);

    if (!label || !id) {
      return;
    }

    const nextDefinitions = (() => {
      const existing = virtualFrameDefinitions.find((definition: any) => definition.id === id);
      if (existing) {
        return virtualFrameDefinitions.map((definition: any) =>
          definition.id === id ? { ...definition, label } : definition
        );
      }
      return [...virtualFrameDefinitions, { id, label }];
    })();

    setVirtualFrameDefinitions(nextDefinitions);
    persistVirtualFrameDefinitions(nextDefinitions);
    if (target === 'key') {
      setFrameMetadataDraft((previous: any) => ({
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
  }, []);

  const renameVirtualDefinition = React.useCallback((id: string, nextLabelRaw: string, nextIdRaw?: string) => {
    const {
      normalizeVirtualDefinitionId,
      virtualFrameDefinitions,
      setMessage,
      setVirtualFrameDefinitions,
      persistVirtualFrameDefinitions,
      previewRef,
      getFrameNodes,
      readFrameParentGroupId,
      applyFrameMetadataPatch,
      readFrameValueKey,
      syncDraftPreviewHtmlRef,
      setFrameMetadataDraft,
    } = optionsRef.current;
    const nextLabel = nextLabelRaw.trim();
    const normalizedNextId = normalizeVirtualDefinitionId(String(nextIdRaw || id));

    if (!id || !nextLabel || !normalizedNextId) {
      return;
    }
    if (!virtualFrameDefinitions.some((definition: any) => definition.id === id)) {
      return;
    }
    if (
      id !== normalizedNextId &&
      virtualFrameDefinitions.some((definition: any) => definition.id === normalizedNextId)
    ) {
      setMessage(`가상 정의 ID ${normalizedNextId} 는 이미 존재합니다.`);
      return;
    }

    const nextDefinitions = virtualFrameDefinitions.map((definition: any) =>
      definition.id === id ? { ...definition, id: normalizedNextId, label: nextLabel } : definition
    );
    setVirtualFrameDefinitions(nextDefinitions);
    persistVirtualFrameDefinitions(nextDefinitions);

    if (id !== normalizedNextId) {
      const root = previewRef.current;
      if (root) {
        getFrameNodes(root).forEach((node: HTMLElement) => {
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

    setFrameMetadataDraft((previous: any) => ({
      ...previous,
      parentGroupId: previous.parentGroupId === id ? normalizedNextId : previous.parentGroupId,
      valueKey: previous.valueKey === id ? normalizedNextId : previous.valueKey,
    }));
    setMessage(`가상 정의 ${id} 를 ${normalizedNextId} 로 수정했습니다.`);
  }, []);

  const deleteVirtualDefinition = React.useCallback((id: string) => {
    const {
      virtualFrameDefinitions,
      setVirtualFrameDefinitions,
      persistVirtualFrameDefinitions,
      setFrameMetadataDraft,
      setMessage,
    } = optionsRef.current;

    if (!virtualFrameDefinitions.some((definition: any) => definition.id === id)) {
      return;
    }

    const nextDefinitions = virtualFrameDefinitions.filter((definition: any) => definition.id !== id);
    setVirtualFrameDefinitions(nextDefinitions);
    persistVirtualFrameDefinitions(nextDefinitions);
    setFrameMetadataDraft((previous: any) => ({
      ...previous,
      parentGroupId: previous.parentGroupId === id ? '' : previous.parentGroupId,
      valueKey: previous.valueKey === id ? '' : previous.valueKey,
    }));
    setMessage(`가상 정의 ${id} 를 삭제했습니다.`);
  }, []);

  const stageMetadataBoxKind = React.useCallback((boxKind: any) => {
    const {
      selectedFrameGroupIdsRef,
      setMessage,
      defaultMetadataVirtualConnectionDraft,
      setMetadataVirtualConnectionDraft,
      setMetadataConnectionPickerOpen,
      setFrameMetadataDraft,
      getCompatibleRuntimeModes,
      getDefaultRuntimeMode,
    } = optionsRef.current;

    if (selectedFrameGroupIdsRef.current.length === 0) {
      setMessage('먼저 메타데이터를 설정할 상자를 선택하세요.');
      return;
    }

    setMetadataVirtualConnectionDraft(defaultMetadataVirtualConnectionDraft);
    setMetadataConnectionPickerOpen(false);
    setFrameMetadataDraft((previous: any) => {
      const compatibleRuntimeModes = getCompatibleRuntimeModes(boxKind);
      const nextRuntimeMode =
        previous.runtimeMode && compatibleRuntimeModes.includes(previous.runtimeMode)
          ? previous.runtimeMode
          : getDefaultRuntimeMode(boxKind, previous.role || 'key_value');

      return {
        ...previous,
        boxKind,
        runtimeMode: nextRuntimeMode,
      };
    });
  }, []);

  const stageMetadataRole = React.useCallback((role: any) => {
    const {
      selectedFrameGroupIdsRef,
      setMessage,
      defaultMetadataVirtualConnectionDraft,
      setMetadataVirtualConnectionDraft,
      setMetadataConnectionPickerOpen,
      setFrameMetadataDraft,
      getDefaultRuntimeMode,
    } = optionsRef.current;

    if (selectedFrameGroupIdsRef.current.length === 0) {
      setMessage('먼저 메타데이터를 설정할 상자를 선택하세요.');
      return;
    }

    setMetadataVirtualConnectionDraft(defaultMetadataVirtualConnectionDraft);
    setMetadataConnectionPickerOpen(false);
    setFrameMetadataDraft((previous: any) => ({
      ...previous,
      role,
      parentGroupId: role === 'value' ? previous.parentGroupId : '',
      valueKey: role === 'value' ? previous.valueKey : '',
      runtimeMode:
        previous.runtimeMode ||
        (previous.boxKind ? getDefaultRuntimeMode(previous.boxKind, role) : previous.runtimeMode),
    }));
  }, []);

  const resetMetadataVirtualConnectionDraft = React.useCallback(() => {
    const { defaultMetadataVirtualConnectionDraft, setMetadataVirtualConnectionDraft, setMetadataConnectionPickerOpen } =
      optionsRef.current;
    setMetadataVirtualConnectionDraft(defaultMetadataVirtualConnectionDraft);
    setMetadataConnectionPickerOpen(false);
  }, []);

  const startMetadataVirtualConnectionDraft = React.useCallback((mode: 'key' | 'value') => {
    const { setMetadataVirtualConnectionDraft, setMetadataConnectionPickerOpen } = optionsRef.current;
    setMetadataVirtualConnectionDraft({
      mode,
      label: '',
      id: '',
      idTouched: false,
      error: '',
    });
    setMetadataConnectionPickerOpen(false);
  }, []);

  const applySelectedMetadataBoxConnection = React.useCallback(() => {
    const {
      previewRef,
      selectedFrameGroupIdsRef,
      setMessage,
      getFrameNodes,
      readFrameRole,
      readFrameParentGroupId,
      formatIssueList,
      resolveNextFrameMetadata,
      getCompatibleRuntimeModes,
      normalizeFrameValueKey,
      readFrameBoxLabel,
      readFrameValueKey,
      applyFrameMetadataPatch,
      getDefaultRuntimeMode,
      defaultMetadataVirtualConnectionDraft,
      setMetadataVirtualConnectionDraft,
      setMetadataConnectionPickerOpen,
      setMetadataRelationSelectionMode,
      syncFrameRelationshipValueKeys,
      syncDraftPreviewHtmlRef,
      syncFrameMetadataDraft,
      applyRuntimeSelectionUi,
      edgeSelectionStateRef,
      requestPreviewTextFit,
      virtualFrameDefinitions,
    } = optionsRef.current;
    const root = previewRef.current;
    const activeSelectionIds = selectedFrameGroupIdsRef.current;

    if (!root || activeSelectionIds.length === 0) {
      setMessage('연결할 상자를 먼저 선택하세요.');
      return;
    }

    const frameNodeById = new Map(
      getFrameNodes(root)
        .map((node: HTMLElement) => [node.getAttribute('data-template-frame-group') || '', node] as const)
        .filter(([frameGroupId]: readonly [string, HTMLElement]) => Boolean(frameGroupId))
    );
    const allSelectedEntries = activeSelectionIds.map((frameGroupId: string) => {
      const node = frameNodeById.get(frameGroupId) || null;
      const role = node ? readFrameRole(node) : '';
      return { frameGroupId, node, role };
    });

    if (allSelectedEntries.some((entry: any) => entry.role === 'key_value')) {
      setMessage('독립 박스는 연결할 수 없습니다.');
      return;
    }

    const selectedEntries = allSelectedEntries
      .map((entry: any) =>
        entry.node && (entry.role === 'key' || entry.role === 'value')
          ? {
              frameGroupId: entry.frameGroupId,
              node: entry.node,
              role: entry.role,
            }
          : null
      )
      .filter(Boolean);

    if (selectedEntries.length !== activeSelectionIds.length) {
      setMessage('박스 연결은 선택한 모든 상자의 Role이 key 또는 value일 때만 가능합니다.');
      return;
    }

    const keyEntries = selectedEntries.filter((entry: any) => entry.role === 'key');
    const valueEntries = selectedEntries.filter((entry: any) => entry.role === 'value');

    if (keyEntries.length > 1) {
      setMessage('키가 되는 상자는 하나만 있어야 합니다.');
      return;
    }

    if (keyEntries.length === 0 && valueEntries.length > 0) {
      startMetadataVirtualConnectionDraft('key');
      startParentKeySelectionMode();
      return;
    }

    if (keyEntries.length === 1 && valueEntries.length === 0) {
      startMetadataVirtualConnectionDraft('value');
      startValueBoxSelectionMode();
      return;
    }

    if (keyEntries.length !== 1 || valueEntries.length <= 0) {
      setMessage('박스 연결은 key 상자 1개와 value 상자 1개 이상을 선택해야 합니다.');
      return;
    }

    const keyEntry = keyEntries[0];
    const conflictingValueIds = valueEntries
      .filter((entry: any) => {
        const parentGroupId = readFrameParentGroupId(entry.node);
        return parentGroupId && parentGroupId !== keyEntry.frameGroupId;
      })
      .map((entry: any) => entry.frameGroupId);

    if (conflictingValueIds.length > 0) {
      const approved =
        typeof window !== 'undefined' &&
        window.confirm(
          `이미 다른 박스의 입력값인 박스가 있습니다: ${formatIssueList(conflictingValueIds)}.\n` +
            '해제하고 선택한 키 박스의 입력값으로 만들까요?'
        );

      if (!approved) {
        setMessage('박스 연결을 취소했습니다.');
        return;
      }
    }

    const keyMetadata = resolveNextFrameMetadata(keyEntry.node, {});
    const nextKeyBoxKind = keyMetadata.boxKind || 'text';
    const compatibleKeyRuntimeModes = getCompatibleRuntimeModes(nextKeyBoxKind);
    const keyLabel =
      normalizeFrameValueKey(readFrameBoxLabel(keyEntry.node)) ||
      normalizeFrameValueKey(readFrameValueKey(keyEntry.node)) ||
      keyEntry.frameGroupId;

    applyFrameMetadataPatch(keyEntry.node, {
      boxKind: nextKeyBoxKind,
      role: 'key',
      parentGroupId: '',
      runtimeMode:
        keyMetadata.runtimeMode && compatibleKeyRuntimeModes.includes(keyMetadata.runtimeMode)
          ? keyMetadata.runtimeMode
          : getDefaultRuntimeMode(nextKeyBoxKind, 'key'),
    });

    valueEntries.forEach((entry: any) => {
      applyFrameMetadataPatch(entry.node, {
        role: 'value',
        parentGroupId: keyEntry.frameGroupId,
        valueKey: keyLabel,
      });
    });

    setMetadataVirtualConnectionDraft(defaultMetadataVirtualConnectionDraft);
    setMetadataConnectionPickerOpen(false);
    setMetadataRelationSelectionMode({ kind: 'idle' });
    syncFrameRelationshipValueKeys(root, undefined, virtualFrameDefinitions);
    syncDraftPreviewHtmlRef();
    syncFrameMetadataDraft();
    applyRuntimeSelectionUi(activeSelectionIds, edgeSelectionStateRef.current);
    requestPreviewTextFit();
    setMessage(`박스 연결 완료: ${keyEntry.frameGroupId} → ${valueEntries.length}개 value`);
  }, [startMetadataVirtualConnectionDraft, startParentKeySelectionMode, startValueBoxSelectionMode]);

  const saveMetadataVirtualConnectionDefinition = React.useCallback(() => {
    const {
      previewRef,
      selectedFrameGroupIdsRef,
      metadataRelationSelectionModeRef,
      metadataVirtualConnectionDraft,
      normalizeVirtualDefinitionId,
      getFrameNodes,
      virtualFrameDefinitions,
      setMetadataVirtualConnectionDraft,
      readFrameRole,
      readFrameParentGroupId,
      formatIssueList,
      setMessage,
      setVirtualFrameDefinitions,
      persistVirtualFrameDefinitions,
      applyFrameMetadataPatch,
      syncFrameRelationshipValueKeys,
      syncDraftPreviewHtmlRef,
      syncFrameMetadataDraft,
      applyRuntimeSelectionUi,
      edgeSelectionStateRef,
      requestPreviewTextFit,
      resolveNextFrameMetadata,
      getCompatibleRuntimeModes,
      getDefaultRuntimeMode,
      readFrameBoxLabel,
      normalizeFrameValueKey,
      readFrameValueKey,
      defaultMetadataVirtualConnectionDraft,
      setMetadataConnectionPickerOpen,
      setMetadataRelationSelectionMode,
    } = optionsRef.current;
    const root = previewRef.current;
    const activeSelectionIds = selectedFrameGroupIdsRef.current;
    const relationMode = metadataRelationSelectionModeRef.current;
    const mode = metadataVirtualConnectionDraft.mode;
    const rawLabel = metadataVirtualConnectionDraft.label.trim();
    const id = normalizeVirtualDefinitionId(metadataVirtualConnectionDraft.id || rawLabel);

    if (!root || mode === 'idle') {
      return;
    }

    const frameNodeById = new Map(
      getFrameNodes(root)
        .map((node: HTMLElement) => [node.getAttribute('data-template-frame-group') || '', node] as const)
        .filter(([frameGroupId]: readonly [string, HTMLElement]) => Boolean(frameGroupId))
    );
    const selectedEntries = activeSelectionIds
      .map((frameGroupId: string) => {
        const node = frameNodeById.get(frameGroupId) || null;
        const role = node ? readFrameRole(node) : '';
        return node && (role === 'key' || role === 'value') ? { frameGroupId, node, role } : null;
      })
      .filter(Boolean);

    if (selectedEntries.length <= 0 || selectedEntries.length !== activeSelectionIds.length) {
      setMetadataVirtualConnectionDraft((previous: any) => ({
        ...previous,
        error: '선택한 모든 상자의 Role이 key 또는 value여야 합니다.',
      }));
      return;
    }

    if (mode === 'key') {
      const valueEntries = selectedEntries.filter((entry: any) => entry.role === 'value');

      if (valueEntries.length <= 0 || selectedEntries.some((entry: any) => entry.role !== 'value')) {
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          error: '새 key 정의는 value 상자만 선택된 상태에서 저장할 수 있습니다.',
        }));
        return;
      }

      const existingKeyNode = id ? frameNodeById.get(id) || null : null;
      const existingVirtualDefinition = id
        ? virtualFrameDefinitions.find((definition: any) => definition.id === id) || null
        : null;
      const targetLabel = existingKeyNode
        ? readFrameBoxLabel(existingKeyNode) || id
        : rawLabel || existingVirtualDefinition?.label || '';

      if (!id || !targetLabel) {
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          error: 'key 상자명과 아이디를 입력하거나 기존 key 상자를 선택하세요.',
        }));
        return;
      }

      if (existingKeyNode && readFrameRole(existingKeyNode) !== 'key') {
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          error: `${id} 는 key 역할 상자가 아닙니다. value 상자를 다른 value 상자 밑에 연결할 수 없습니다.`,
        }));
        return;
      }

      const conflictingValueIds = valueEntries
        .filter((entry: any) => {
          const parentGroupId = readFrameParentGroupId(entry.node);
          return parentGroupId && parentGroupId !== id;
        })
        .map((entry: any) => entry.frameGroupId);

      if (conflictingValueIds.length > 0) {
        const approved =
          typeof window !== 'undefined' &&
          window.confirm(
            `이미 다른 key의 입력값인 박스가 있습니다: ${formatIssueList(conflictingValueIds)}.\n` +
              '해제하고 선택한 key 박스의 입력값으로 바꿀까요?'
          );

        if (!approved) {
          setMessage('박스 연결을 취소했습니다.');
          return;
        }
      }

      const nextDefinitions =
        existingKeyNode || existingVirtualDefinition
          ? virtualFrameDefinitions
          : [...virtualFrameDefinitions, { id, label: targetLabel }];
      if (!existingKeyNode && !existingVirtualDefinition) {
        setVirtualFrameDefinitions(nextDefinitions);
        persistVirtualFrameDefinitions(nextDefinitions);
      }
      valueEntries.forEach((entry: any) => {
        applyFrameMetadataPatch(entry.node, {
          role: 'value',
          parentGroupId: id,
          valueKey: normalizeFrameValueKey(targetLabel) || id,
        });
      });
      syncFrameRelationshipValueKeys(root, undefined, nextDefinitions);
      syncDraftPreviewHtmlRef();
      syncFrameMetadataDraft();
      applyRuntimeSelectionUi(activeSelectionIds, edgeSelectionStateRef.current);
      requestPreviewTextFit();
      setMetadataRelationSelectionMode({ kind: 'idle' });
      setMessage(`${id} key에 ${valueEntries.length}개 value 상자를 연결했습니다.`);
    } else {
      const keyEntries = selectedEntries.filter((entry: any) => entry.role === 'key');

      if (keyEntries.length !== 1 || selectedEntries.length !== 1) {
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          error: '새 입력값 정의는 key 상자 1개만 선택된 상태에서 저장할 수 있습니다.',
        }));
        return;
      }

      const keyEntry = keyEntries[0];
      const relationSelectedValueTargetIds =
        relationMode.kind === 'value' && relationMode.sourceKeyFrameGroupId === keyEntry.frameGroupId
          ? Array.from(
              new Set(
                relationMode.targetFrameGroupIds
                  .map((targetFrameGroupId: string) => targetFrameGroupId.trim())
                  .filter(
                    (targetFrameGroupId: string) =>
                      Boolean(targetFrameGroupId) && frameNodeById.has(targetFrameGroupId)
                  )
              )
            )
          : [];
      const selectedValueTargetIds =
        relationSelectedValueTargetIds.length > 0
          ? relationSelectedValueTargetIds
          : id && frameNodeById.has(id)
            ? [id]
            : [];
      const keyMetadata = resolveNextFrameMetadata(keyEntry.node, {});
      const nextKeyBoxKind = keyMetadata.boxKind || 'text';
      const compatibleKeyRuntimeModes = getCompatibleRuntimeModes(nextKeyBoxKind);

      if (selectedValueTargetIds.length > 0) {
        const invalidValueTargetIds = selectedValueTargetIds.filter((targetFrameGroupId: string) => {
          const targetNode = frameNodeById.get(targetFrameGroupId) || null;
          return !targetNode || readFrameRole(targetNode) !== 'value';
        });

        if (invalidValueTargetIds.length > 0) {
          setMetadataVirtualConnectionDraft((previous: any) => ({
            ...previous,
            error: `value 대상은 Role이 value인 상자만 가능합니다: ${formatIssueList(invalidValueTargetIds)}`,
          }));
          return;
        }

        const conflictingValueIds = selectedValueTargetIds.filter((targetFrameGroupId: string) => {
          const targetNode = frameNodeById.get(targetFrameGroupId) || null;
          const parentGroupId = targetNode ? readFrameParentGroupId(targetNode) : '';
          return parentGroupId && parentGroupId !== keyEntry.frameGroupId;
        });

        if (conflictingValueIds.length > 0) {
          const approved =
            typeof window !== 'undefined' &&
            window.confirm(
              `이미 다른 key의 입력값인 박스가 있습니다: ${formatIssueList(conflictingValueIds)}.\n` +
                '해제하고 현재 key 박스의 입력값으로 바꿀까요?'
            );

          if (!approved) {
            setMessage('박스 연결을 취소했습니다.');
            return;
          }
        }

        const keyLabel =
          normalizeFrameValueKey(readFrameBoxLabel(keyEntry.node)) ||
          normalizeFrameValueKey(readFrameValueKey(keyEntry.node)) ||
          keyEntry.frameGroupId;
        const existingTargetFrameGroupIds = Array.from(frameNodeById.entries())
          .filter(([, node]) => readFrameParentGroupId(node) === keyEntry.frameGroupId)
          .map(([frameGroupId]) => frameGroupId);

        applyFrameMetadataPatch(keyEntry.node, {
          boxKind: nextKeyBoxKind,
          role: 'key',
          parentGroupId: '',
          runtimeMode:
            keyMetadata.runtimeMode && compatibleKeyRuntimeModes.includes(keyMetadata.runtimeMode)
              ? keyMetadata.runtimeMode
              : getDefaultRuntimeMode(nextKeyBoxKind, 'key'),
        });
        selectedValueTargetIds.forEach((targetFrameGroupId: string) => {
          const targetNode = frameNodeById.get(targetFrameGroupId);
          if (!targetNode) {
            return;
          }
          applyFrameMetadataPatch(targetNode, {
            role: 'value',
            parentGroupId: keyEntry.frameGroupId,
            valueKey: keyLabel,
          });
        });
        existingTargetFrameGroupIds
          .filter((targetFrameGroupId) => !selectedValueTargetIds.includes(targetFrameGroupId))
          .forEach((targetFrameGroupId) => {
            const targetNode = frameNodeById.get(targetFrameGroupId);
            if (!targetNode) {
              return;
            }
            applyFrameMetadataPatch(targetNode, {
              role: 'key_value',
              parentGroupId: '',
              valueKey: '',
            });
          });
        syncFrameRelationshipValueKeys(root, undefined, virtualFrameDefinitions);
        syncDraftPreviewHtmlRef();
        syncFrameMetadataDraft();
        applyRuntimeSelectionUi(
          Array.from(new Set([...activeSelectionIds, ...selectedValueTargetIds])),
          edgeSelectionStateRef.current
        );
        requestPreviewTextFit();
        setMetadataRelationSelectionMode({ kind: 'idle' });
        setMessage(`${keyEntry.frameGroupId} key에 ${selectedValueTargetIds.length}개 value 상자를 연결했습니다.`);
        setMetadataVirtualConnectionDraft(defaultMetadataVirtualConnectionDraft);
        setMetadataConnectionPickerOpen(false);
        return;
      }

      if (!rawLabel || !id) {
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          error: '입력값 상자명과 아이디를 입력하거나 기존 value 상자를 선택하세요.',
        }));
        return;
      }

      const existingVirtualDefinition = virtualFrameDefinitions.find((definition: any) => definition.id === id) || null;
      const nextDefinitions = existingVirtualDefinition
        ? virtualFrameDefinitions
        : [...virtualFrameDefinitions, { id, label: rawLabel }];
      if (!existingVirtualDefinition) {
        setVirtualFrameDefinitions(nextDefinitions);
        persistVirtualFrameDefinitions(nextDefinitions);
      }
      applyFrameMetadataPatch(keyEntry.node, {
        boxKind: nextKeyBoxKind,
        role: 'key',
        parentGroupId: '',
        runtimeMode:
          keyMetadata.runtimeMode && compatibleKeyRuntimeModes.includes(keyMetadata.runtimeMode)
            ? keyMetadata.runtimeMode
            : getDefaultRuntimeMode(nextKeyBoxKind, 'key'),
      });
      setMetadataRelationSelectionMode({
        kind: 'value',
        sourceKeyFrameGroupId: keyEntry.frameGroupId,
        targetFrameGroupIds: [id],
      });
      syncDraftPreviewHtmlRef();
      syncFrameMetadataDraft();
      applyRuntimeSelectionUi(activeSelectionIds, edgeSelectionStateRef.current);
      requestPreviewTextFit();
      setMessage(`가상 입력값 정의 ${id} 를 저장했습니다.`);
    }

    setMetadataVirtualConnectionDraft(defaultMetadataVirtualConnectionDraft);
    setMetadataConnectionPickerOpen(false);
  }, []);

  const handleMetadataRelationFramePick = React.useCallback(
    (
      frameGroupId: string,
      optionsArg: {
        append?: boolean;
      } = {}
    ) => {
      const {
        previewRef,
        metadataRelationSelectionModeRef,
        resolveFrameSelectionAnchor,
        rawFrameNodeSelector,
        setMessage,
        readFrameRole,
        setMetadataVirtualConnectionDraft,
        applyRuntimeSelectionVisuals,
        edgeSelectionStateRef,
        setMetadataRelationSelectionMode,
        readFrameBoxLabel,
      } = optionsRef.current;
      const root = previewRef.current;
      const relationMode = metadataRelationSelectionModeRef.current;

      if (!root || relationMode.kind === 'idle') {
        return false;
      }

      const targetNode = resolveFrameSelectionAnchor(
        root.querySelector<HTMLElement>(`${rawFrameNodeSelector}[data-template-frame-group="${frameGroupId}"]`)
      );

      if (!targetNode) {
        return false;
      }

      if (relationMode.kind === 'parent') {
        if (relationMode.sourceFrameGroupIds.includes(frameGroupId)) {
          setMessage('선택된 상자 자신을 key 상자로 지정할 수 없습니다.');
          return true;
        }

        if (readFrameRole(targetNode) !== 'key') {
          setMetadataVirtualConnectionDraft((previous: any) => ({
            ...previous,
            error: `${frameGroupId} 는 key 역할 상자가 아닙니다. value 상자를 다른 value 상자 밑에 연결할 수 없습니다.`,
          }));
          setMessage('key 대상은 Role이 key인 상자만 선택할 수 있습니다.');
          return true;
        }

        const targetLabel = readFrameBoxLabel(targetNode) || frameGroupId;
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          mode: 'key',
          label: targetLabel,
          id: frameGroupId,
          idTouched: true,
          error: '',
        }));
        applyRuntimeSelectionVisuals(relationMode.sourceFrameGroupIds, edgeSelectionStateRef.current);
        setMessage(`key 대상 ${frameGroupId} 를 입력했습니다. 저장 버튼을 눌러 연결을 적용하세요.`);
        return true;
      }

      if (frameGroupId === relationMode.sourceKeyFrameGroupId) {
        setMessage('현재 선택된 key 상자 자신은 value 상자로 선택할 수 없습니다.');
        return true;
      }

      if (readFrameRole(targetNode) !== 'value') {
        setMetadataVirtualConnectionDraft((previous: any) => ({
          ...previous,
          error: `${frameGroupId} 는 value 역할 상자가 아닙니다. key에 연결할 대상은 value 상자여야 합니다.`,
        }));
        setMessage('value 대상은 Role이 value인 상자만 선택할 수 있습니다.');
        return true;
      }

      const isAlreadySelectedTarget = relationMode.targetFrameGroupIds.includes(frameGroupId);
      const nextTargetFrameGroupIds = isAlreadySelectedTarget
        ? relationMode.targetFrameGroupIds.filter((targetId: string) => targetId !== frameGroupId)
        : optionsArg.append
          ? [...relationMode.targetFrameGroupIds, frameGroupId]
          : [frameGroupId];

      setMetadataRelationSelectionMode({
        kind: 'value',
        sourceKeyFrameGroupId: relationMode.sourceKeyFrameGroupId,
        targetFrameGroupIds: nextTargetFrameGroupIds,
      });
      setMetadataVirtualConnectionDraft((previous: any) => ({
        ...previous,
        mode: 'value',
        label:
          nextTargetFrameGroupIds.length === 0
            ? ''
            : nextTargetFrameGroupIds.length === 1
              ? readFrameBoxLabel(targetNode) || frameGroupId
              : `${nextTargetFrameGroupIds.length}개 value 상자 선택됨`,
        id:
          nextTargetFrameGroupIds.length === 0
            ? ''
            : nextTargetFrameGroupIds.length === 1
              ? frameGroupId
              : nextTargetFrameGroupIds.join(', '),
        idTouched: nextTargetFrameGroupIds.length > 0,
        error: '',
      }));
      setMessage(
        nextTargetFrameGroupIds.length > 0
          ? `현재 key 상자가 선택된 상태입니다. value 상자 ${nextTargetFrameGroupIds.length}개가 연결 예정입니다. 계속 선택하거나 저장하세요.`
          : '현재 key 상자가 선택된 상태입니다. 아직 연결 예정인 value 상자가 없습니다.'
      );
      return true;
    },
    []
  );

  const applyMetadataConnectionSuggestion = React.useCallback((option: any) => {
    const { metadataVirtualConnectionDraft, setMetadataVirtualConnectionDraft, setMetadataConnectionPickerOpen } =
      optionsRef.current;

    if (metadataVirtualConnectionDraft.mode === 'idle') {
      return;
    }

    if (option.source === 'shared') {
      setMetadataVirtualConnectionDraft((previous: any) => ({
        ...previous,
        label: option.label,
        id: option.id,
        idTouched: true,
        error: '',
      }));
      if (metadataVirtualConnectionDraft.mode === 'key') {
        setMetadataConnectionPickerOpen(false);
      }
      return;
    }

    handleMetadataRelationFramePick(option.id, {
      append: metadataVirtualConnectionDraft.mode === 'value',
    });
    if (metadataVirtualConnectionDraft.mode === 'key') {
      setMetadataConnectionPickerOpen(false);
    }
  }, [handleMetadataRelationFramePick]);

  const syncMetadataConnectionDraftFromLabelInput = React.useCallback(() => {
    const { setMetadataVirtualConnectionDraft, resolveMetadataConnectionOption, normalizeVirtualDefinitionId } =
      optionsRef.current;
    setMetadataVirtualConnectionDraft((previous: any) => {
      const existingOption = resolveMetadataConnectionOption(previous.label);

      if (existingOption) {
        return {
          ...previous,
          label: existingOption.label,
          id: existingOption.id,
          idTouched: true,
          error: '',
        };
      }

      if (previous.idTouched && previous.id.trim()) {
        return previous;
      }

      return {
        ...previous,
        id: normalizeVirtualDefinitionId(previous.label),
      };
    });
  }, []);

  const syncMetadataConnectionDraftFromIdInput = React.useCallback(() => {
    const { setMetadataVirtualConnectionDraft, resolveMetadataConnectionOption, normalizeVirtualDefinitionId } =
      optionsRef.current;
    setMetadataVirtualConnectionDraft((previous: any) => {
      const existingOption = resolveMetadataConnectionOption(previous.id);

      if (existingOption) {
        return {
          ...previous,
          label: existingOption.label,
          id: existingOption.id,
          idTouched: true,
          error: '',
        };
      }

      return {
        ...previous,
        id: normalizeVirtualDefinitionId(previous.id || previous.label),
      };
    });
  }, []);

  return {
    startParentKeySelectionMode,
    startValueBoxSelectionMode,
    clearParentKeySelectionDraft,
    upsertVirtualDefinition,
    renameVirtualDefinition,
    deleteVirtualDefinition,
    stageMetadataBoxKind,
    stageMetadataRole,
    resetMetadataVirtualConnectionDraft,
    startMetadataVirtualConnectionDraft,
    applySelectedMetadataBoxConnection,
    saveMetadataVirtualConnectionDefinition,
    handleMetadataRelationFramePick,
    applyMetadataConnectionSuggestion,
    syncMetadataConnectionDraftFromLabelInput,
    syncMetadataConnectionDraftFromIdInput,
  };
};
