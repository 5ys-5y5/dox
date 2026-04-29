import type {
  TemplateEdgeSelectionClickDto,
  TemplateEdgeSelectionMode,
  TemplateEdgeSelectionStateDto,
  TemplateEdgeSelectionTokenDto,
  TemplateSelectedEdgeActivationReason,
  TemplateSelectedEdgeActivationRequestDto,
  TemplateSelectedEdgeActivationResultDto,
  TemplateEdgeTopologySnapshotDto,
} from '../lib/templateEdgeSelectionDtos';
import { TemplateEdgeTopologyService } from './templateEdgeTopologyService';

const createToken = (
  snapshot: TemplateEdgeTopologySnapshotDto,
  anchorEdgeId: string,
  mode: TemplateEdgeSelectionMode,
  selectionOrder: number
): TemplateEdgeSelectionTokenDto | null => {
  const anchorEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, anchorEdgeId);

  if (!anchorEdge) {
    return null;
  }

  const memberEdgeIds =
    mode === 'connected'
      ? TemplateEdgeTopologyService.getCohortByEdgeId(snapshot, anchorEdgeId)?.edgeIds || [anchorEdgeId]
      : [anchorEdgeId];

  return {
    tokenId: anchorEdgeId,
    anchorEdgeId,
    mode,
    memberEdgeIds,
    selectionOrder,
  };
};

const normalizeState = (tokens: TemplateEdgeSelectionTokenDto[]): TemplateEdgeSelectionStateDto => {
  const normalizedTokens = tokens.map((token, index) => ({
    ...token,
    selectionOrder: index + 1,
  }));

  return {
    tokens: normalizedTokens,
    primaryTokenId: normalizedTokens[0]?.tokenId || null,
  };
};

const createEmptyState = (): TemplateEdgeSelectionStateDto => ({
  tokens: [],
  primaryTokenId: null,
});

const getEffectiveEdgeIds = (token: TemplateEdgeSelectionTokenDto) =>
  token.mode === 'isolated' ? [token.anchorEdgeId] : token.memberEdgeIds;

const reconcileSelectionState = (input: {
  snapshot: TemplateEdgeTopologySnapshotDto;
  currentSelection: TemplateEdgeSelectionStateDto;
}) => {
  const reconciledTokens = input.currentSelection.tokens
    .map((token) => createToken(input.snapshot, token.anchorEdgeId, token.mode, token.selectionOrder))
    .filter((token): token is TemplateEdgeSelectionTokenDto => Boolean(token));

  return normalizeState(reconciledTokens);
};

const tokensAreCompatible = (
  snapshot: TemplateEdgeTopologySnapshotDto,
  currentSelection: TemplateEdgeSelectionStateDto,
  clickedEdgeId: string
) => {
  const primaryToken = currentSelection.tokens[0];
  const primaryEdge = primaryToken ? TemplateEdgeTopologyService.getEdgeById(snapshot, primaryToken.anchorEdgeId) : null;
  const clickedEdge = TemplateEdgeTopologyService.getEdgeById(snapshot, clickedEdgeId);

  if (!primaryEdge || !clickedEdge) {
    return true;
  }

  return primaryEdge.orientation === clickedEdge.orientation && primaryEdge.side === clickedEdge.side;
};

const buildActivationResult = (
  nextSelectionState: TemplateEdgeSelectionStateDto,
  clickedEdgeId: string,
  activationReason: TemplateSelectedEdgeActivationReason
): TemplateSelectedEdgeActivationResultDto => {
  const activatedToken =
    nextSelectionState.tokens.find((token) => token.anchorEdgeId === clickedEdgeId) ||
    nextSelectionState.tokens.find((token) => token.memberEdgeIds.includes(clickedEdgeId)) ||
    null;

  return {
    nextSelectionState,
    activatedMode: activatedToken?.mode || null,
    effectiveEdgeIds: activatedToken ? getEffectiveEdgeIds(activatedToken) : [],
    activationReason,
  };
};

const resolveActivation = (
  input: TemplateSelectedEdgeActivationRequestDto
): TemplateSelectedEdgeActivationResultDto => {
  const currentSelection = reconcileSelectionState({
    snapshot: input.snapshot,
    currentSelection: input.currentSelection,
  });
  const existingTokenIndex = currentSelection.tokens.findIndex((token) => token.anchorEdgeId === input.clickedEdgeId);

  if (!input.withShift) {
    const currentPrimaryToken = currentSelection.tokens[0];

    if (currentPrimaryToken?.anchorEdgeId === input.clickedEdgeId) {
      const nextMode = currentPrimaryToken.mode === 'connected' ? 'isolated' : 'connected';
      const nextToken = createToken(input.snapshot, input.clickedEdgeId, nextMode, 1);
      const nextSelectionState = nextToken ? normalizeState([nextToken]) : createEmptyState();
      return buildActivationResult(
        nextSelectionState,
        input.clickedEdgeId,
        nextMode === 'isolated' ? 'toggle-isolated' : 'toggle-connected'
      );
    }

    const nextToken = createToken(input.snapshot, input.clickedEdgeId, 'connected', 1);
    const nextSelectionState = nextToken ? normalizeState([nextToken]) : createEmptyState();
    return buildActivationResult(nextSelectionState, input.clickedEdgeId, 'new-connected');
  }

  if (!tokensAreCompatible(input.snapshot, currentSelection, input.clickedEdgeId)) {
    const nextToken = createToken(input.snapshot, input.clickedEdgeId, 'connected', 1);
    const nextSelectionState = nextToken ? normalizeState([nextToken]) : createEmptyState();
    return buildActivationResult(nextSelectionState, input.clickedEdgeId, 'replace-incompatible');
  }

  if (existingTokenIndex >= 0) {
    const existingToken = currentSelection.tokens[existingTokenIndex];
    const nextMode = existingToken.mode === 'connected' ? 'isolated' : 'connected';
    const nextToken = createToken(input.snapshot, input.clickedEdgeId, nextMode, existingToken.selectionOrder);

    if (!nextToken) {
      return buildActivationResult(currentSelection, input.clickedEdgeId, 'toggle-connected');
    }

    const nextSelectionState = normalizeState(
      currentSelection.tokens.map((token, index) => (index === existingTokenIndex ? nextToken : token))
    );
    return buildActivationResult(
      nextSelectionState,
      input.clickedEdgeId,
      nextMode === 'isolated' ? 'toggle-isolated' : 'toggle-connected'
    );
  }

  const nextToken = createToken(
    input.snapshot,
    input.clickedEdgeId,
    'connected',
    currentSelection.tokens.length + 1
  );

  const nextSelectionState = nextToken ? normalizeState([...currentSelection.tokens, nextToken]) : currentSelection;
  return buildActivationResult(nextSelectionState, input.clickedEdgeId, 'append-connected');
};

const resolveClick = (input: TemplateEdgeSelectionClickDto): TemplateEdgeSelectionStateDto => {
  return resolveActivation(input).nextSelectionState;
};

export const TemplateEdgeSelectionService = {
  createEmptyState,
  reconcileSelectionState,
  resolveActivation,
  resolveClick,
};
