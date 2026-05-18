import type { MetadataConnectionSuggestionOption, MetadataRelationSelectionMode, MetadataVirtualConnectionDraft } from '../types';

export const buildMetadataConnectionSuggestionOptions = (args: {
  availableFrameGroupIds: string[];
  virtualFrameDefinitions: Array<{ id: string; label: string }>;
  previewRoot: HTMLDivElement | null;
  rawFrameNodeSelector: string;
  resolveFrameSelectionAnchor: (node: HTMLElement | null) => HTMLElement | null;
  readFrameBoxLabel: (node: HTMLElement | null) => string;
  readFrameRole: (node: HTMLElement | null) => MetadataConnectionSuggestionOption['role'];
  mergeVirtualFrameDefinitions: (definitions: Array<{ id: string; label: string }>) => Array<{ id: string; label: string }>;
}): MetadataConnectionSuggestionOption[] => {
  const frameOptions = args.availableFrameGroupIds
    .map((frameGroupId): MetadataConnectionSuggestionOption | null => {
      const node = args.resolveFrameSelectionAnchor(
        args.previewRoot?.querySelector<HTMLElement>(
          `${args.rawFrameNodeSelector}[data-template-frame-group="${frameGroupId}"]`
        ) || null
      );

      if (!node) {
        return null;
      }

      return {
        id: frameGroupId,
        label: args.readFrameBoxLabel(node) || frameGroupId,
        meta: frameGroupId,
        source: 'frame',
        role: args.readFrameRole(node),
      };
    })
    .filter((option): option is MetadataConnectionSuggestionOption => Boolean(option));
  const sharedOptions = args.virtualFrameDefinitions.map(
    (definition): MetadataConnectionSuggestionOption => ({
      id: definition.id,
      label: definition.label,
      meta: definition.id,
      source: 'shared',
      role: '',
    })
  );

  return args
    .mergeVirtualFrameDefinitions(
      [...frameOptions, ...sharedOptions].map((option) => ({
        id: option.id,
        label: option.label,
      }))
    )
    .map((definition) => [...frameOptions, ...sharedOptions].find((option) => option.id === definition.id) || null)
    .filter((option): option is MetadataConnectionSuggestionOption => Boolean(option));
};

export const buildMetadataVirtualConnectionSuggestions = (args: {
  metadataVirtualConnectionDraft: MetadataVirtualConnectionDraft;
  metadataRelationSelectionMode: MetadataRelationSelectionMode;
  selectedFrameGroupIds: string[];
  metadataConnectionSuggestionOptions: MetadataConnectionSuggestionOption[];
}): MetadataConnectionSuggestionOption[] => {
  const mode = args.metadataVirtualConnectionDraft.mode;

  if (mode === 'idle') {
    return [];
  }

  const query = `${args.metadataVirtualConnectionDraft.label} ${args.metadataVirtualConnectionDraft.id}`
    .trim()
    .toLowerCase();
  const sourceIds = new Set(
    mode === 'key'
      ? args.metadataRelationSelectionMode.kind === 'parent'
        ? args.metadataRelationSelectionMode.sourceFrameGroupIds
        : args.selectedFrameGroupIds
      : args.metadataRelationSelectionMode.kind === 'value'
        ? [args.metadataRelationSelectionMode.sourceKeyFrameGroupId]
        : args.selectedFrameGroupIds
  );
  const rolePriority = (option: MetadataConnectionSuggestionOption) => {
    if (option.source === 'shared') {
      return 1;
    }
    if (mode === 'key') {
      return option.role === 'key' ? 0 : option.role === 'key_value' ? 2 : 3;
    }
    return option.role === 'value' ? 0 : option.role === 'key_value' ? 2 : 3;
  };

  return args.metadataConnectionSuggestionOptions
    .filter((option) => !sourceIds.has(option.id))
    .filter((option) => {
      if (option.source === 'shared') {
        return true;
      }
      return mode === 'key' ? option.role === 'key' : option.role === 'value';
    })
    .filter((option) => {
      if (!query) {
        return true;
      }

      const haystack = `${option.label} ${option.id} ${option.meta}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => rolePriority(left) - rolePriority(right) || left.label.localeCompare(right.label, 'ko'))
    .slice(0, 6);
};

export const buildMetadataConnectionPickerOptions = (args: {
  metadataVirtualConnectionDraft: MetadataVirtualConnectionDraft;
  metadataRelationSelectionMode: MetadataRelationSelectionMode;
  selectedFrameGroupIds: string[];
  metadataConnectionSuggestionOptions: MetadataConnectionSuggestionOption[];
  metadataVirtualConnectionSuggestions: MetadataConnectionSuggestionOption[];
}): MetadataConnectionSuggestionOption[] => {
  const mode = args.metadataVirtualConnectionDraft.mode;

  if (mode === 'idle') {
    return [];
  }

  const query = `${args.metadataVirtualConnectionDraft.label} ${args.metadataVirtualConnectionDraft.id}`
    .trim()
    .toLowerCase();
  const sourceIds = new Set(
    mode === 'key'
      ? args.metadataRelationSelectionMode.kind === 'parent'
        ? args.metadataRelationSelectionMode.sourceFrameGroupIds
        : args.selectedFrameGroupIds
      : args.metadataRelationSelectionMode.kind === 'value'
        ? [args.metadataRelationSelectionMode.sourceKeyFrameGroupId]
        : args.selectedFrameGroupIds
  );
  const suggestionKeys = new Set(args.metadataVirtualConnectionSuggestions.map((option) => `${option.source}:${option.id}`));
  const eligibleOptions = args.metadataConnectionSuggestionOptions
    .filter((option) => !sourceIds.has(option.id))
    .filter((option) => {
      if (option.source === 'shared') {
        return true;
      }
      return mode === 'key' ? option.role === 'key' : option.role === 'value';
    })
    .filter((option) => {
      if (!query) {
        return true;
      }

      const haystack = `${option.label} ${option.id} ${option.meta}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'ko'));

  return [
    ...args.metadataVirtualConnectionSuggestions,
    ...eligibleOptions.filter((option) => !suggestionKeys.has(`${option.source}:${option.id}`)),
  ];
};

export const buildMetadataConnectionPickerDisplayOptions = (args: {
  metadataVirtualConnectionDraftMode: MetadataVirtualConnectionDraft['mode'];
  selectedMetadataValueConnectionOptions: MetadataConnectionSuggestionOption[];
  metadataConnectionPickerOptions: MetadataConnectionSuggestionOption[];
}): MetadataConnectionSuggestionOption[] => {
  const optionMap = new Map<string, MetadataConnectionSuggestionOption>();

  if (args.metadataVirtualConnectionDraftMode === 'value') {
    args.selectedMetadataValueConnectionOptions.forEach((option) => {
      optionMap.set(`${option.source}:${option.id}`, option);
    });
  }
  args.metadataConnectionPickerOptions.forEach((option) => {
    const optionKey = `${option.source}:${option.id}`;
    if (!optionMap.has(optionKey)) {
      optionMap.set(optionKey, option);
    }
  });

  return Array.from(optionMap.values());
};

export const resolveMetadataConnectionOptionFromSuggestions = (
  metadataConnectionSuggestionOptions: MetadataConnectionSuggestionOption[],
  rawValue: string
) => {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return null;
  }

  return (
    metadataConnectionSuggestionOptions.find(
      (option) => option.id === trimmedValue || option.label.trim() === trimmedValue
    ) || null
  );
};
