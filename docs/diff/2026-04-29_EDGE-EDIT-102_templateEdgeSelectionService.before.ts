import type {
  TemplateEdgeActivationResultDto,
  TemplateEdgeSelectionClickDto,
  TemplateEdgeSelectionMode,
  TemplateEdgeSelectionStateDto,
  TemplateEdgeSelectionTokenDto,
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

const resolveNextSelectionState = (input: TemplateEdgeSelectionClickDto): TemplateEdgeSelectionStateDto => {
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
      return nextToken ? normalizeState([nextToken]) : createEmptyState();
    }

    const nextToken = createToken(input.snapshot, input.clickedEdgeId, 'connected', 1);
    return nextToken ? normalizeState([nextToken]) : createEmptyState();
  }

  if (!tokensAreCompatible(input.snapshot, currentSelection, input.clickedEdgeId)) {
    const nextToken = createToken(input.snapshot, input.clickedEdgeId, 'connected', 1);
    return nextToken ? normalizeState([nextToken]) : createEmptyState();
  }

  if (existingTokenIndex >= 0) {
    const existingToken = currentSelection.tokens[existingTokenIndex];
    const nextMode = existingToken.mode === 'connected' ? 'isolated' : 'connected';
    const nextToken = createToken(input.snapshot, input.clickedEdgeId, nextMode, existingToken.selectionOrder);

    if (!nextToken) {
      return currentSelection;
    }

    return normalizeState(
      currentSelection.tokens.map((token, index) => (index === existingTokenIndex ? nextToken : token))
    );
  }

  const nextToken = createToken(
    input.snapshot,
    input.clickedEdgeId,
    'connected',
    currentSelection.tokens.length + 1
  );

  return nextToken ? normalizeState([...currentSelection.tokens, nextToken]) : currentSelection;
};

const resolveActivation = (input: TemplateEdgeSelectionClickDto): TemplateEdgeActivationResultDto => {
  const selectionState = resolveNextSelectionState(input);
  const activatedToken =
    selectionState.tokens.find((token) => token.anchorEdgeId === input.clickedEdgeId) ||
    selectionState.tokens.find((token) => token.memberEdgeIds.includes(input.clickedEdgeId)) ||
    null;

  return {
    selectionState,
    activatedTokenId: activatedToken?.tokenId || null,
    effectiveEdgeIds: activatedToken ? activatedToken.memberEdgeIds.slice() : [],
    mode: activatedToken?.mode || null,
  };
};

const resolveDragActivation = (input: TemplateEdgeSelectionClickDto): TemplateEdgeActivationResultDto => {
  const currentSelection = reconcileSelectionState({
    snapshot: input.snapshot,
    currentSelection: input.currentSelection,
  });
  const existingToken =
    currentSelection.tokens.find((token) => token.memberEdgeIds.includes(input.clickedEdgeId)) || null;

  if (!existingToken) {
    return resolveActivation(input);
  }

  return {
    selectionState: currentSelection,
    activatedTokenId: existingToken.tokenId,
    effectiveEdgeIds: existingToken.memberEdgeIds.slice(),
    mode: existingToken.mode,
  };
};

const resolveClick = (input: TemplateEdgeSelectionClickDto): TemplateEdgeSelectionStateDto =>
  resolveActivation(input).selectionState;

export const TemplateEdgeSelectionService = {
  createEmptyState,
  reconcileSelectionState,
  resolveActivation,
  resolveDragActivation,
  resolveClick,
};
