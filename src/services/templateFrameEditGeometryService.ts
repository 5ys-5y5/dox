import type {
  TemplateFrameEditResult,
  TemplateFrameEditWarning,
  TemplateFrameGeometryOptions,
  TemplateFrameNodeDto,
  TemplateFrameRectDto,
  TemplateFrameResizeDirection,
} from '../lib/templateFrameEditDtos';
import { DEFAULT_TEMPLATE_FRAME_GEOMETRY_OPTIONS } from '../lib/templateFrameEditDtos';

type PageBounds = {
  width: number;
  height: number;
};

type Rect = Omit<TemplateFrameRectDto, 'pageNumber'>;

type SplitAxis = 'vertical' | 'horizontal';

type SplitCandidate = {
  id: string;
  axis: SplitAxis;
  position: number;
  sourceFrameGroupId: string;
};

const mergeOptions = (options?: Partial<TemplateFrameGeometryOptions>): TemplateFrameGeometryOptions => ({
  ...DEFAULT_TEMPLATE_FRAME_GEOMETRY_OPTIONS,
  ...options,
});

const success = <T>(value: T, warnings: TemplateFrameEditWarning[] = []): TemplateFrameEditResult<T> => ({
  ok: true,
  value,
  warnings,
});

const failure = <T>(warning: TemplateFrameEditWarning): TemplateFrameEditResult<T> => ({
  ok: false,
  value: null,
  warnings: [warning],
});

const right = (rect: Rect) => rect.left + rect.width;
const bottom = (rect: Rect) => rect.top + rect.height;

const overlapLength = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const overlapsVertically = (leftRect: Rect, rightRect: Rect, tolerance = 2) =>
  leftRect.top < bottom(rightRect) - tolerance && rightRect.top < bottom(leftRect) - tolerance;

const overlapsHorizontally = (topRect: Rect, bottomRect: Rect, tolerance = 2) =>
  topRect.left < right(bottomRect) - tolerance && bottomRect.left < right(topRect) - tolerance;

const clampRect = (rect: Rect, bounds: PageBounds, minSize: number): Rect => {
  const width = Math.max(minSize, Math.min(bounds.width, rect.width));
  const height = Math.max(minSize, Math.min(bounds.height, rect.height));
  const left = Math.max(0, Math.min(bounds.width - width, rect.left));
  const top = Math.max(0, Math.min(bounds.height - height, rect.top));

  return { left, top, width, height };
};

const snapEdge = (edge: number, candidates: number[], threshold: number) => {
  let snapped = edge;
  let bestDistance = threshold + 1;

  candidates.forEach((candidate) => {
    const distance = Math.abs(candidate - edge);

    if (distance <= threshold && distance < bestDistance) {
      bestDistance = distance;
      snapped = candidate;
    }
  });

  return snapped;
};

const buildSnapCandidates = (
  rect: Rect,
  frameRects: Rect[],
  bounds: PageBounds,
  includePageBounds: boolean
) => {
  const horizontalCandidates = includePageBounds ? [0, bounds.width] : [];
  const verticalCandidates = includePageBounds ? [0, bounds.height] : [];

  frameRects.forEach((candidateRect) => {
    if (overlapsVertically(rect, candidateRect)) {
      horizontalCandidates.push(candidateRect.left, right(candidateRect));
    }

    if (overlapsHorizontally(rect, candidateRect)) {
      verticalCandidates.push(candidateRect.top, bottom(candidateRect));
    }
  });

  return { horizontalCandidates, verticalCandidates };
};

const buildMoveSnapCandidates = (
  rect: Rect,
  frameRects: Rect[],
  bounds: PageBounds,
  includePageBounds: boolean,
  _threshold: number
) => {
  const horizontalCandidates = includePageBounds ? [0, bounds.width] : [];
  const verticalCandidates = includePageBounds ? [0, bounds.height] : [];

  frameRects.forEach((candidateRect) => {
    horizontalCandidates.push(candidateRect.left, right(candidateRect));
    verticalCandidates.push(candidateRect.top, bottom(candidateRect));
  });

  return { horizontalCandidates, verticalCandidates };
};

const hasSharedFace = (
  first: TemplateFrameNodeDto,
  second: TemplateFrameNodeDto,
  options: TemplateFrameGeometryOptions
) => {
  if (first.rect.pageNumber !== second.rect.pageNumber) {
    return false;
  }

  const firstRect = first.rect;
  const secondRect = second.rect;
  const tolerance = options.thresholdPx;
  const verticalOverlap = overlapLength(firstRect.top, bottom(firstRect), secondRect.top, bottom(secondRect));
  const horizontalOverlap = overlapLength(firstRect.left, right(firstRect), secondRect.left, right(secondRect));
  const touchesHorizontally =
    Math.abs(right(firstRect) - secondRect.left) <= tolerance ||
    Math.abs(firstRect.left - right(secondRect)) <= tolerance;
  const touchesVertically =
    Math.abs(bottom(firstRect) - secondRect.top) <= tolerance ||
    Math.abs(firstRect.top - bottom(secondRect)) <= tolerance;

  return (
    (touchesHorizontally && verticalOverlap >= options.minSharedEdgePx) ||
    (touchesVertically && horizontalOverlap >= options.minSharedEdgePx)
  );
};

const framesAreConnectedBySharedFaces = (
  frames: TemplateFrameNodeDto[],
  options: TemplateFrameGeometryOptions
) => {
  if (frames.length < 2) {
    return false;
  }

  const visited = new Set<string>([frames[0].frameGroupId]);
  const queue = [frames[0]];

  while (queue.length) {
    const current = queue.shift()!;

    frames.forEach((candidate) => {
      if (visited.has(candidate.frameGroupId)) {
        return;
      }

      if (hasSharedFace(current, candidate, options)) {
        visited.add(candidate.frameGroupId);
        queue.push(candidate);
      }
    });
  }

  return visited.size === frames.length;
};

const buildUnionRect = (frames: TemplateFrameNodeDto[]): TemplateFrameRectDto => {
  const first = frames[0].rect;
  const unionLeft = Math.min(...frames.map((frame) => frame.rect.left));
  const unionTop = Math.min(...frames.map((frame) => frame.rect.top));
  const unionRight = Math.max(...frames.map((frame) => right(frame.rect)));
  const unionBottom = Math.max(...frames.map((frame) => bottom(frame.rect)));

  return {
    pageNumber: first.pageNumber,
    left: unionLeft,
    top: unionTop,
    width: unionRight - unionLeft,
    height: unionBottom - unionTop,
  };
};

export const TemplateFrameEditGeometryService = {
  screenDeltaToPageDelta(delta: { x: number; y: number }, previewScale: number) {
    const safeScale = Number.isFinite(previewScale) && previewScale > 0 ? previewScale : 1;

    return {
      x: delta.x / safeScale,
      y: delta.y / safeScale,
    };
  },

  snapMovedRect(input: {
    rect: Rect;
    siblingRects: Rect[];
    bounds: PageBounds;
    options?: Partial<TemplateFrameGeometryOptions>;
  }): TemplateFrameEditResult<Rect> {
    const options = mergeOptions(input.options);
    const clamped = clampRect(input.rect, input.bounds, options.minSizePx);
    const { horizontalCandidates, verticalCandidates } = buildMoveSnapCandidates(
      clamped,
      input.siblingRects,
      input.bounds,
      options.snapToPageBounds,
      options.thresholdPx
    );

    let snapDx = 0;
    let snapDy = 0;
    let snapDxDistance = options.thresholdPx + 1;
    let snapDyDistance = options.thresholdPx + 1;

    horizontalCandidates.forEach((edge) => {
      [clamped.left, right(clamped)].forEach((currentEdge) => {
        const delta = edge - currentEdge;
        const distance = Math.abs(delta);

        if (distance <= options.thresholdPx && distance < snapDxDistance) {
          snapDxDistance = distance;
          snapDx = delta;
        }
      });
    });

    verticalCandidates.forEach((edge) => {
      [clamped.top, bottom(clamped)].forEach((currentEdge) => {
        const delta = edge - currentEdge;
        const distance = Math.abs(delta);

        if (distance <= options.thresholdPx && distance < snapDyDistance) {
          snapDyDistance = distance;
          snapDy = delta;
        }
      });
    });

    return success(
      clampRect(
        {
          left: clamped.left + snapDx,
          top: clamped.top + snapDy,
          width: clamped.width,
          height: clamped.height,
        },
        input.bounds,
        options.minSizePx
      )
    );
  },

  snapResizedRect(input: {
    rect: Rect;
    direction: TemplateFrameResizeDirection;
    siblingRects: Rect[];
    bounds: PageBounds;
    options?: Partial<TemplateFrameGeometryOptions>;
  }): TemplateFrameEditResult<Rect> {
    const options = mergeOptions(input.options);
    const { horizontalCandidates, verticalCandidates } = buildSnapCandidates(
      input.rect,
      input.siblingRects,
      input.bounds,
      options.snapToPageBounds
    );
    let left = input.rect.left;
    let top = input.rect.top;
    let nextRight = right(input.rect);
    let nextBottom = bottom(input.rect);

    if (input.direction.includes('w')) {
      left = snapEdge(left, horizontalCandidates, options.thresholdPx);
      left = Math.max(0, Math.min(left, nextRight - options.minSizePx));
    }

    if (input.direction.includes('e')) {
      nextRight = snapEdge(nextRight, horizontalCandidates, options.thresholdPx);
      nextRight = Math.max(left + options.minSizePx, Math.min(nextRight, input.bounds.width));
    }

    if (input.direction.includes('n')) {
      top = snapEdge(top, verticalCandidates, options.thresholdPx);
      top = Math.max(0, Math.min(top, nextBottom - options.minSizePx));
    }

    if (input.direction.includes('s')) {
      nextBottom = snapEdge(nextBottom, verticalCandidates, options.thresholdPx);
      nextBottom = Math.max(top + options.minSizePx, Math.min(nextBottom, input.bounds.height));
    }

    return success(
      clampRect(
        {
          left,
          top,
          width: nextRight - left,
          height: nextBottom - top,
        },
        input.bounds,
        options.minSizePx
      )
    );
  },

  validateMerge(input: {
    frames: TemplateFrameNodeDto[];
    options?: Partial<TemplateFrameGeometryOptions>;
  }): TemplateFrameEditResult<TemplateFrameRectDto> {
    const options = mergeOptions(input.options);
    const pageNumbers = new Set(input.frames.map((frame) => frame.rect.pageNumber));
    const frameGroupIds = input.frames.map((frame) => frame.frameGroupId);

    if (input.frames.length < 2) {
      return failure({
        code: 'frames_not_adjacent',
        message: '병합할 프레임을 2개 이상 선택해야 합니다.',
        frameGroupIds,
      });
    }

    if (pageNumbers.size > 1) {
      return failure({
        code: 'frames_cross_page',
        message: '서로 다른 페이지의 프레임은 병합할 수 없습니다.',
        frameGroupIds,
      });
    }

    if (!framesAreConnectedBySharedFaces(input.frames, options)) {
      return failure({
        code: 'frames_not_adjacent',
        message: '한 개 이상의 면을 공유하며 연결된 프레임만 병합할 수 있습니다.',
        frameGroupIds,
      });
    }

    return success(buildUnionRect(input.frames));
  },

  listSplitCandidates(input: {
    frame: TemplateFrameNodeDto;
    siblings: TemplateFrameNodeDto[];
    axis: SplitAxis;
    options?: Partial<TemplateFrameGeometryOptions>;
  }): TemplateFrameEditResult<SplitCandidate[]> {
    const options = mergeOptions(input.options);
    const candidates: SplitCandidate[] = [];
    const rect = input.frame.rect;

    input.siblings
      .filter((candidate) => candidate.rect.pageNumber === rect.pageNumber)
      .forEach((candidate) => {
        const candidateRect = candidate.rect;

        if (input.axis === 'vertical' && overlapsVertically(rect, candidateRect)) {
          [candidateRect.left, right(candidateRect)].forEach((position) => {
            if (position > rect.left + options.minSizePx && position < right(rect) - options.minSizePx) {
              candidates.push({
                id: `vertical:${candidate.frameGroupId}:${Math.round(position)}`,
                axis: 'vertical',
                position,
                sourceFrameGroupId: candidate.frameGroupId,
              });
            }
          });
        }

        if (input.axis === 'horizontal' && overlapsHorizontally(rect, candidateRect)) {
          [candidateRect.top, bottom(candidateRect)].forEach((position) => {
            if (position > rect.top + options.minSizePx && position < bottom(rect) - options.minSizePx) {
              candidates.push({
                id: `horizontal:${candidate.frameGroupId}:${Math.round(position)}`,
                axis: 'horizontal',
                position,
                sourceFrameGroupId: candidate.frameGroupId,
              });
            }
          });
        }
      });

    const uniqueCandidates = Array.from(
      new Map(candidates.map((candidate) => [`${candidate.axis}:${Math.round(candidate.position)}`, candidate])).values()
    );

    if (!uniqueCandidates.length) {
      return failure({
        code: 'split_boundary_missing',
        message: '선택 프레임 내부를 지나는 인접 경계선이 없어 분할할 수 없습니다.',
        frameGroupIds: [input.frame.frameGroupId],
      });
    }

    const midpoint = input.axis === 'vertical' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;

    return success(
      uniqueCandidates.sort(
        (leftCandidate, rightCandidate) =>
          Math.abs(leftCandidate.position - midpoint) - Math.abs(rightCandidate.position - midpoint)
      )
    );
  },

  splitFrame(input: {
    frame: TemplateFrameNodeDto;
    candidate: SplitCandidate;
    firstFrameGroupId: string;
    secondFrameGroupId: string;
    options?: Partial<TemplateFrameGeometryOptions>;
  }): TemplateFrameEditResult<TemplateFrameNodeDto[]> {
    const options = mergeOptions(input.options);
    const rect = input.frame.rect;
    const position = input.candidate.position;

    if (input.candidate.axis === 'vertical') {
      if (position <= rect.left + options.minSizePx || position >= right(rect) - options.minSizePx) {
        return failure({
          code: 'frame_too_small',
          message: '분할 후 프레임 최소 너비를 확보할 수 없습니다.',
          frameGroupIds: [input.frame.frameGroupId],
        });
      }

      return success([
        {
          ...input.frame,
          frameGroupId: input.firstFrameGroupId,
          rect: { ...rect, width: position - rect.left },
        },
        {
          ...input.frame,
          frameGroupId: input.secondFrameGroupId,
          rect: {
            ...rect,
            left: position,
            width: right(rect) - position,
          },
        },
      ]);
    }

    if (position <= rect.top + options.minSizePx || position >= bottom(rect) - options.minSizePx) {
      return failure({
        code: 'frame_too_small',
        message: '분할 후 프레임 최소 높이를 확보할 수 없습니다.',
        frameGroupIds: [input.frame.frameGroupId],
      });
    }

    return success([
      {
        ...input.frame,
        frameGroupId: input.firstFrameGroupId,
        rect: { ...rect, height: position - rect.top },
      },
      {
        ...input.frame,
        frameGroupId: input.secondFrameGroupId,
        rect: {
          ...rect,
          top: position,
          height: bottom(rect) - position,
        },
      },
    ]);
  },

  validateCreateRect(input: {
    rect: Rect;
    siblingRects: Rect[];
    bounds: PageBounds;
    options?: Partial<TemplateFrameGeometryOptions>;
  }): TemplateFrameEditResult<Rect> {
    const options = mergeOptions(input.options);
    const clamped = clampRect(input.rect, input.bounds, options.minSizePx);

    if (clamped.width < options.minSizePx || clamped.height < options.minSizePx) {
      return failure({
        code: 'frame_too_small',
        message: '새 프레임이 최소 크기보다 작습니다.',
        frameGroupIds: [],
      });
    }

    return this.snapMovedRect({
      rect: clamped,
      siblingRects: input.siblingRects,
      bounds: input.bounds,
      options,
    });
  },
};
