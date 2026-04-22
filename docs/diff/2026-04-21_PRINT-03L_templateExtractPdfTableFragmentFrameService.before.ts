import type {
  TemplateExtractPdfFrameSource,
  TemplateExtractPdfGeometryRow,
  TemplateExtractPdfPage,
  TemplateExtractPdfPageGeometry,
  TemplateExtractPdfRulePage,
} from '../lib/templateExtractDtos';

export type TemplateExtractPdfTableFragmentFrameSegment =
  | { orientation: 'h'; left: number; top: number; width: number }
  | { orientation: 'v'; left: number; top: number; height: number };

export type TemplateExtractPdfTableFragmentFrameBuildResult = {
  segments: TemplateExtractPdfTableFragmentFrameSegment[];
  source: TemplateExtractPdfFrameSource;
  fragmentCount: number;
  giantTableRejected: boolean;
};

type FragmentBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type GeometryRowDescriptor = {
  row: TemplateExtractPdfGeometryRow;
  left: number;
  right: number;
  top: number;
  bottom: number;
  center: number;
  axes: number[];
};

type TableFragment = {
  rows: GeometryRowDescriptor[];
  explicitSegments: TemplateExtractPdfTableFragmentFrameSegment[];
  bounds: FragmentBounds;
};

type RuleGrid = {
  rowRules: number[];
  columnRules: number[];
  outerLeft: number;
  outerRight: number;
  outerTop: number;
  outerBottom: number;
};

const AXIS_TOLERANCE_PX = 3.5;
const ROW_FRAGMENT_GAP_PX = 20;
const EXPLICIT_ATTACH_GAP_PX = 10;
const EXPLICIT_SNAP_TOLERANCE_PX = 3.5;
const MIN_ROW_OVERLAP_PX = 36;
const VERTICAL_RUN_GAP_PX = 8;
const RULE_AXIS_ATTACH_TOLERANCE_PX = 24;
const RULE_BAND_ATTACH_GAP_PX = 10;

const clampCoordinate = (value: number, min: number, max: number) =>
  Number(Math.min(Math.max(value, min), max).toFixed(2));

const dedupeAxis = (values: number[], max: number, tolerance = AXIS_TOLERANCE_PX) => {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .map((value) => clampCoordinate(value, 0, max))
    .sort((left, right) => left - right);
  const deduped: number[] = [];

  for (const value of sorted) {
    const previous = deduped[deduped.length - 1];

    if (typeof previous === 'number' && Math.abs(previous - value) <= tolerance) {
      continue;
    }

    deduped.push(value);
  }

  return deduped;
};

const buildSegmentKey = (segment: TemplateExtractPdfTableFragmentFrameSegment) =>
  segment.orientation === 'h'
    ? `h:${segment.left.toFixed(2)}:${segment.top.toFixed(2)}:${segment.width.toFixed(2)}`
    : `v:${segment.left.toFixed(2)}:${segment.top.toFixed(2)}:${segment.height.toFixed(2)}`;

const appendSegment = (
  segments: TemplateExtractPdfTableFragmentFrameSegment[],
  seen: Set<string>,
  segment: TemplateExtractPdfTableFragmentFrameSegment | null
) => {
  if (!segment) {
    return;
  }

  const key = buildSegmentKey(segment);

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  segments.push(segment);
};

const mergeSegments = (segments: TemplateExtractPdfTableFragmentFrameSegment[]) => {
  const horizontal = segments
    .filter(
      (segment): segment is Extract<TemplateExtractPdfTableFragmentFrameSegment, { orientation: 'h' }> =>
        segment.orientation === 'h'
    )
    .sort((left, right) => left.top - right.top || left.left - right.left);
  const vertical = segments
    .filter(
      (segment): segment is Extract<TemplateExtractPdfTableFragmentFrameSegment, { orientation: 'v' }> =>
        segment.orientation === 'v'
    )
    .sort((left, right) => left.left - right.left || left.top - right.top);
  const merged: TemplateExtractPdfTableFragmentFrameSegment[] = [];

  for (const segment of horizontal) {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      previous.orientation === 'h' &&
      Math.abs(previous.top - segment.top) <= 1.25 &&
      segment.left <= previous.left + previous.width + 2
    ) {
      previous.width = Number(Math.max(previous.width, segment.left + segment.width - previous.left).toFixed(2));
      continue;
    }

    merged.push({ ...segment });
  }

  for (const segment of vertical) {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      previous.orientation === 'v' &&
      Math.abs(previous.left - segment.left) <= 1.25 &&
      segment.top <= previous.top + previous.height + 2
    ) {
      previous.height = Number(Math.max(previous.height, segment.top + segment.height - previous.top).toFixed(2));
      continue;
    }

    merged.push({ ...segment });
  }

  return merged.sort((left, right) => {
    if (left.orientation !== right.orientation) {
      return left.orientation === 'h' ? -1 : 1;
    }

    if (left.orientation === 'h' && right.orientation === 'h') {
      return left.top - right.top || left.left - right.left;
    }

    return left.left - right.left || left.top - right.top;
  });
};

const overlapLength = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

const countSharedAxes = (leftAxes: number[], rightAxes: number[], tolerance = AXIS_TOLERANCE_PX) =>
  leftAxes.reduce(
    (count, leftAxis) => count + (rightAxes.some((rightAxis) => Math.abs(rightAxis - leftAxis) <= tolerance) ? 1 : 0),
    0
  );

const buildBounds = (left: number, right: number, top: number, bottom: number): FragmentBounds => ({
  left: Number(left.toFixed(2)),
  right: Number(right.toFixed(2)),
  top: Number(top.toFixed(2)),
  bottom: Number(bottom.toFixed(2)),
});

const mergeBounds = (left: FragmentBounds, right: FragmentBounds) =>
  buildBounds(
    Math.min(left.left, right.left),
    Math.max(left.right, right.right),
    Math.min(left.top, right.top),
    Math.max(left.bottom, right.bottom)
  );

const buildSegmentBounds = (segment: TemplateExtractPdfTableFragmentFrameSegment): FragmentBounds =>
  segment.orientation === 'h'
    ? buildBounds(segment.left, segment.left + segment.width, Math.max(0, segment.top - 1), segment.top + 1)
    : buildBounds(Math.max(0, segment.left - 1), segment.left + 1, segment.top, segment.top + segment.height);

const buildExplicitSegments = (page: TemplateExtractPdfPage, rulePage: TemplateExtractPdfRulePage | null) => {
  if (!rulePage) {
    return [] as TemplateExtractPdfTableFragmentFrameSegment[];
  }

  return [
    ...rulePage.horizontalSegments.map(
      (segment) =>
        ({
          orientation: 'h' as const,
          left: clampCoordinate(segment.start, 0, page.width),
          top: clampCoordinate(segment.position, 0, page.height),
          width: Number(Math.max(1, segment.end - segment.start).toFixed(2)),
        }) satisfies TemplateExtractPdfTableFragmentFrameSegment
    ),
    ...rulePage.verticalSegments.map(
      (segment) =>
        ({
          orientation: 'v' as const,
          left: clampCoordinate(segment.position, 0, page.width),
          top: clampCoordinate(segment.start, 0, page.height),
          height: Number(Math.max(1, segment.end - segment.start).toFixed(2)),
        }) satisfies TemplateExtractPdfTableFragmentFrameSegment
    ),
  ];
};

const findNearestAxis = (value: number, axes: number[], tolerance = RULE_AXIS_ATTACH_TOLERANCE_PX) => {
  let selected: number | null = null;
  let distance = Number.POSITIVE_INFINITY;

  for (const axis of axes) {
    const currentDistance = Math.abs(axis - value);

    if (currentDistance > tolerance || currentDistance >= distance) {
      continue;
    }

    selected = axis;
    distance = currentDistance;
  }

  return selected;
};

const resolveGeometryEdge = (geometryPage: TemplateExtractPdfPageGeometry, index: number, page: TemplateExtractPdfPage) => {
  const boundedIndex = Math.max(0, Math.min(index, geometryPage.columnEdges.length - 1));
  return clampCoordinate(geometryPage.columnEdges[boundedIndex] ?? 0, 0, page.width);
};

const buildGeometryRowDescriptor = (
  row: TemplateExtractPdfGeometryRow,
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry,
  snapAxes: number[] | null
): GeometryRowDescriptor | null => {
  if (!row.cells.length) {
    return null;
  }

  const rawAxes = row.cells.flatMap((cell) => [
    resolveGeometryEdge(geometryPage, cell.startColumn, page),
    resolveGeometryEdge(geometryPage, cell.endColumn, page),
  ]);
  const axes = dedupeAxis(
    rawAxes.map((axis) => (snapAxes ? findNearestAxis(axis, snapAxes) ?? axis : axis)),
    page.width,
    snapAxes ? Math.max(AXIS_TOLERANCE_PX, 5) : AXIS_TOLERANCE_PX
  );

  if (!axes.length) {
    return null;
  }

  const left = clampCoordinate(Math.min(...axes), 0, page.width);
  const right = clampCoordinate(Math.max(...axes), 0, page.width);
  const top = clampCoordinate(row.top, 0, page.height);
  const bottom = clampCoordinate(row.top + row.height, 0, page.height);

  if (right - left <= 1 || bottom - top <= 1) {
    return null;
  }

  return {
    row,
    left,
    right,
    top,
    bottom,
    center: Number(((top + bottom) / 2).toFixed(2)),
    axes,
  };
};

const buildGeometryRowDescriptors = (
  page: TemplateExtractPdfPage,
  geometryPage: TemplateExtractPdfPageGeometry | null,
  snapAxes: number[] | null = null
) => {
  if (!geometryPage) {
    return [] as GeometryRowDescriptor[];
  }

  return geometryPage.rows
    .map((row) => buildGeometryRowDescriptor(row, page, geometryPage, snapAxes))
    .filter((row): row is GeometryRowDescriptor => Boolean(row))
    .sort((left, right) => left.top - right.top || left.left - right.left);
};

const shouldStayInFragment = (previous: GeometryRowDescriptor, current: GeometryRowDescriptor) => {
  const verticalGap = current.top - previous.bottom;
  const horizontalOverlap = overlapLength(previous.left, previous.right, current.left, current.right);
  const sharedAxes = countSharedAxes(previous.axes, current.axes);
  const minimumSharedAxes = Math.min(2, Math.min(previous.axes.length, current.axes.length));
  const minimumOverlap = Math.max(
    MIN_ROW_OVERLAP_PX,
    Math.min(previous.right - previous.left, current.right - current.left) * 0.35
  );

  return verticalGap <= ROW_FRAGMENT_GAP_PX && horizontalOverlap >= minimumOverlap && sharedAxes >= minimumSharedAxes;
};

const buildGeometryFragments = (rows: GeometryRowDescriptor[]) => {
  const fragments: TableFragment[] = [];

  for (const row of rows) {
    const previous = fragments[fragments.length - 1];
    const previousRow = previous?.rows[previous.rows.length - 1];

    if (previous && previousRow && shouldStayInFragment(previousRow, row)) {
      previous.rows.push(row);
      previous.bounds = mergeBounds(previous.bounds, buildBounds(row.left, row.right, row.top, row.bottom));
      continue;
    }

    fragments.push({
      rows: [row],
      explicitSegments: [],
      bounds: buildBounds(row.left, row.right, row.top, row.bottom),
    });
  }

  return fragments;
};

const attachExplicitSegmentsToFragments = (
  fragments: TableFragment[],
  explicitSegments: TemplateExtractPdfTableFragmentFrameSegment[]
) => {
  for (const segment of explicitSegments) {
    const bounds = buildSegmentBounds(segment);
    let selectedFragment: TableFragment | null = null;
    let selectedScore = Number.NEGATIVE_INFINITY;

    for (const fragment of fragments) {
      const horizontalOverlap = overlapLength(
        fragment.bounds.left - EXPLICIT_ATTACH_GAP_PX,
        fragment.bounds.right + EXPLICIT_ATTACH_GAP_PX,
        bounds.left,
        bounds.right
      );
      const verticalOverlap = overlapLength(
        fragment.bounds.top - EXPLICIT_ATTACH_GAP_PX,
        fragment.bounds.bottom + EXPLICIT_ATTACH_GAP_PX,
        bounds.top,
        bounds.bottom
      );
      const score = horizontalOverlap + verticalOverlap;

      if (score > selectedScore && score > 0) {
        selectedFragment = fragment;
        selectedScore = score;
      }
    }

    if (!selectedFragment) {
      fragments.push({
        rows: [],
        explicitSegments: [segment],
        bounds,
      });
      continue;
    }

    selectedFragment.explicitSegments.push(segment);
    selectedFragment.bounds = mergeBounds(selectedFragment.bounds, bounds);
  }

  return fragments.filter((fragment) => fragment.rows.length > 0 || fragment.explicitSegments.length > 0);
};

const hasHorizontalAnchor = (
  y: number,
  left: number,
  right: number,
  segments: TemplateExtractPdfTableFragmentFrameSegment[]
) =>
  segments.some(
    (segment) =>
      segment.orientation === 'h' &&
      Math.abs(segment.top - y) <= EXPLICIT_SNAP_TOLERANCE_PX &&
      overlapLength(segment.left, segment.left + segment.width, left, right) >= Math.max(16, (right - left) * 0.35)
  );

const findHorizontalAnchor = (
  y: number,
  left: number,
  right: number,
  segments: TemplateExtractPdfTableFragmentFrameSegment[]
) => {
  const candidates = segments.filter(
    (segment): segment is Extract<TemplateExtractPdfTableFragmentFrameSegment, { orientation: 'h' }> =>
      segment.orientation === 'h' &&
      Math.abs(segment.top - y) <= EXPLICIT_SNAP_TOLERANCE_PX &&
      overlapLength(segment.left, segment.left + segment.width, left, right) >= Math.max(16, (right - left) * 0.35)
  );
  const selected = candidates.sort((leftSegment, rightSegment) => rightSegment.width - leftSegment.width)[0];

  if (!selected) {
    return {
      left,
      right,
      top: y,
    };
  }

  return {
    left: Math.min(left, selected.left),
    right: Math.max(right, selected.left + selected.width),
    top: Number(((selected.top + y) / 2).toFixed(2)),
  };
};

const hasVerticalAnchor = (
  x: number,
  top: number,
  bottom: number,
  segments: TemplateExtractPdfTableFragmentFrameSegment[]
) =>
  segments.some(
    (segment) =>
      segment.orientation === 'v' &&
      Math.abs(segment.left - x) <= EXPLICIT_SNAP_TOLERANCE_PX &&
      overlapLength(segment.top, segment.top + segment.height, top, bottom) >= Math.max(10, (bottom - top) * 0.35)
  );

const findVerticalAnchor = (
  x: number,
  top: number,
  bottom: number,
  segments: TemplateExtractPdfTableFragmentFrameSegment[]
) => {
  const candidates = segments.filter(
    (segment): segment is Extract<TemplateExtractPdfTableFragmentFrameSegment, { orientation: 'v' }> =>
      segment.orientation === 'v' &&
      Math.abs(segment.left - x) <= EXPLICIT_SNAP_TOLERANCE_PX &&
      overlapLength(segment.top, segment.top + segment.height, top, bottom) >= Math.max(10, (bottom - top) * 0.35)
  );
  const selected = candidates.sort((leftSegment, rightSegment) => rightSegment.height - leftSegment.height)[0];

  if (!selected) {
    return {
      left: x,
      top,
      bottom,
    };
  }

  return {
    left: Number(((selected.left + x) / 2).toFixed(2)),
    top: Math.min(top, selected.top),
    bottom: Math.max(bottom, selected.top + selected.height),
  };
};

const buildRuleGrid = (page: TemplateExtractPdfPage, rulePage: TemplateExtractPdfRulePage | null): RuleGrid | null => {
  if (!rulePage) {
    return null;
  }

  const rowRules = dedupeAxis(rulePage.rowRules, page.height, 2.5);
  const columnRules = dedupeAxis(rulePage.columnRules, page.width, AXIS_TOLERANCE_PX);

  if (rowRules.length < 2 || columnRules.length < 2) {
    return null;
  }

  const outerLeft = columnRules[0];
  const outerRight = columnRules[columnRules.length - 1];
  const outerTop = rowRules[0];
  const outerBottom = rowRules[rowRules.length - 1];

  if (outerRight - outerLeft <= 24 || outerBottom - outerTop <= 24) {
    return null;
  }

  return {
    rowRules,
    columnRules,
    outerLeft,
    outerRight,
    outerTop,
    outerBottom,
  };
};

const buildRuleBandedSegments = (
  page: TemplateExtractPdfPage,
  geometryRows: GeometryRowDescriptor[],
  explicitSegments: TemplateExtractPdfTableFragmentFrameSegment[],
  grid: RuleGrid
): TemplateExtractPdfTableFragmentFrameBuildResult => {
  const segments: TemplateExtractPdfTableFragmentFrameSegment[] = [];
  const seen = new Set<string>();
  const bandProfiles: string[] = [];

  for (const rowRule of grid.rowRules) {
    appendSegment(segments, seen, {
      orientation: 'h',
      left: grid.outerLeft,
      top: rowRule,
      width: Number(Math.max(1, grid.outerRight - grid.outerLeft).toFixed(2)),
    });
  }

  appendSegment(segments, seen, {
    orientation: 'v',
    left: grid.outerLeft,
    top: grid.outerTop,
    height: Number(Math.max(1, grid.outerBottom - grid.outerTop).toFixed(2)),
  });
  appendSegment(segments, seen, {
    orientation: 'v',
    left: grid.outerRight,
    top: grid.outerTop,
    height: Number(Math.max(1, grid.outerBottom - grid.outerTop).toFixed(2)),
  });

  for (const explicitSegment of explicitSegments) {
    appendSegment(segments, seen, explicitSegment);
  }

  const verticalRuns = new Map<number, Array<{ top: number; bottom: number }>>();

  for (let index = 0; index < grid.rowRules.length - 1; index += 1) {
    const bandTop = grid.rowRules[index];
    const bandBottom = grid.rowRules[index + 1];

    if (bandBottom - bandTop <= 1) {
      continue;
    }

    const bandRows = geometryRows.filter((row) => {
      const overlap = overlapLength(row.top, row.bottom, bandTop - RULE_BAND_ATTACH_GAP_PX, bandBottom + RULE_BAND_ATTACH_GAP_PX);
      return overlap >= Math.max(2, Math.min(row.bottom - row.top, bandBottom - bandTop) * 0.25) || (row.center >= bandTop - 6 && row.center <= bandBottom + 6);
    });
    const activeAxes = new Set<number>();

    for (const axis of grid.columnRules.slice(1, -1)) {
      const rowSupported = bandRows.some((row) => row.axes.some((rowAxis) => Math.abs(rowAxis - axis) <= AXIS_TOLERANCE_PX));
      const explicitSupported = hasVerticalAnchor(axis, bandTop, bandBottom, explicitSegments);

      if (!rowSupported && !explicitSupported) {
        continue;
      }

      activeAxes.add(axis);
      const currentRuns = verticalRuns.get(axis) || [];
      const previous = currentRuns[currentRuns.length - 1];

      if (previous && bandTop <= previous.bottom + VERTICAL_RUN_GAP_PX) {
        previous.bottom = Math.max(previous.bottom, bandBottom);
      } else {
        currentRuns.push({
          top: bandTop,
          bottom: bandBottom,
        });
      }

      verticalRuns.set(axis, currentRuns);
    }

    if (bandRows.length > 0 || activeAxes.size > 0) {
      bandProfiles.push(`${bandRows.length}:${[...activeAxes].map((axis) => axis.toFixed(2)).join('|')}`);
    }
  }

  for (const [axis, runs] of verticalRuns.entries()) {
    for (const run of runs) {
      appendSegment(segments, seen, {
        orientation: 'v',
        left: axis,
        top: run.top,
        height: Number(Math.max(1, run.bottom - run.top).toFixed(2)),
      });
    }
  }

  const merged = mergeSegments(segments);
  const profileChanges = bandProfiles.reduce(
    (count, profile, index) => count + (index === 0 || profile !== bandProfiles[index - 1] ? 1 : 0),
    0
  );

  return {
    segments: merged,
    source: geometryRows.length > 0 ? 'rule_geometry' : 'rule_only',
    fragmentCount: Math.max(profileChanges, 1),
    giantTableRejected: true,
  };
};

const buildFallbackFragmentSegments = (
  page: TemplateExtractPdfPage,
  geometryRows: GeometryRowDescriptor[],
  explicitSegments: TemplateExtractPdfTableFragmentFrameSegment[]
): TemplateExtractPdfTableFragmentFrameBuildResult => {
  const fragments = attachExplicitSegmentsToFragments(buildGeometryFragments(geometryRows), explicitSegments);
  const segments = mergeSegments(
    fragments.flatMap((fragment) => {
      const localSegments: TemplateExtractPdfTableFragmentFrameSegment[] = [];
      const seen = new Set<string>();
      const rows = fragment.rows
        .slice()
        .sort((left, right) => left.top - right.top || left.left - right.left)
        .filter(
          (row) =>
            row.row.cells.length >= 2 ||
            hasHorizontalAnchor(row.top, row.left, row.right, fragment.explicitSegments) ||
            hasHorizontalAnchor(row.bottom, row.left, row.right, fragment.explicitSegments)
        );
      let previousBottom: number | null = null;
      const verticalSupports: Array<{ left: number; top: number; bottom: number }> = [];

      for (const row of rows) {
        const topAnchor = findHorizontalAnchor(row.top, row.left, row.right, fragment.explicitSegments);
        const bottomAnchor = findHorizontalAnchor(row.bottom, row.left, row.right, fragment.explicitSegments);

        if (previousBottom == null || Math.abs(previousBottom - topAnchor.top) > 1.5) {
          appendSegment(localSegments, seen, {
            orientation: 'h',
            left: topAnchor.left,
            top: topAnchor.top,
            width: Number(Math.max(1, topAnchor.right - topAnchor.left).toFixed(2)),
          });
        }

        appendSegment(localSegments, seen, {
          orientation: 'h',
          left: bottomAnchor.left,
          top: bottomAnchor.top,
          width: Number(Math.max(1, bottomAnchor.right - bottomAnchor.left).toFixed(2)),
        });

        previousBottom = bottomAnchor.top;

        for (const axis of row.axes) {
          const isOuterAxis = Math.abs(axis - row.left) <= AXIS_TOLERANCE_PX || Math.abs(axis - row.right) <= AXIS_TOLERANCE_PX;
          const anchored = hasVerticalAnchor(axis, row.top, row.bottom, fragment.explicitSegments);

          if (!isOuterAxis && !anchored && row.row.cells.length < 2) {
            continue;
          }

          const verticalAnchor = findVerticalAnchor(axis, row.top, row.bottom, fragment.explicitSegments);

          verticalSupports.push({
            left: verticalAnchor.left,
            top: verticalAnchor.top,
            bottom: verticalAnchor.bottom,
          });
        }
      }

      const mergedVerticalSupports = verticalSupports
        .sort((left, right) => left.left - right.left || left.top - right.top)
        .reduce<Array<{ left: number; top: number; bottom: number }>>((runs, support) => {
          const previous = runs[runs.length - 1];

          if (
            previous &&
            Math.abs(previous.left - support.left) <= AXIS_TOLERANCE_PX &&
            support.top <= previous.bottom + VERTICAL_RUN_GAP_PX
          ) {
            previous.bottom = Math.max(previous.bottom, support.bottom);
            previous.left = Number(((previous.left + support.left) / 2).toFixed(2));
            return runs;
          }

          runs.push({ ...support });
          return runs;
        }, []);

      for (const support of mergedVerticalSupports) {
        appendSegment(localSegments, seen, {
          orientation: 'v',
          left: support.left,
          top: support.top,
          height: Number(Math.max(1, support.bottom - support.top).toFixed(2)),
        });
      }

      return mergeSegments([...fragment.explicitSegments, ...localSegments]);
    })
  );

  return {
    segments,
    source:
      explicitSegments.length > 0 && geometryRows.length > 0
        ? 'rule_geometry'
        : explicitSegments.length > 0
          ? 'rule_only'
          : geometryRows.length > 0
            ? 'geometry_only'
            : 'none',
    fragmentCount: fragments.length,
    giantTableRejected: true,
  };
};

export const TemplateExtractPdfTableFragmentFrameService = {
  buildFrameSegments(
    page: TemplateExtractPdfPage,
    geometryPage: TemplateExtractPdfPageGeometry | null,
    rulePage: TemplateExtractPdfRulePage | null
  ): TemplateExtractPdfTableFragmentFrameBuildResult {
    const explicitSegments = buildExplicitSegments(page, rulePage);
    const ruleGrid = buildRuleGrid(page, rulePage);
    const geometryRows = buildGeometryRowDescriptors(page, geometryPage, ruleGrid?.columnRules || null);

    if (ruleGrid) {
      return buildRuleBandedSegments(page, geometryRows, explicitSegments, ruleGrid);
    }

    return buildFallbackFragmentSegments(page, geometryRows, explicitSegments);
  },
};
