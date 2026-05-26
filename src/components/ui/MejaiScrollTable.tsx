'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

type MejaiScrollTableAlign = 'left' | 'center' | 'right';

export type MejaiScrollTableColumn = {
  key: string;
  label: React.ReactNode;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  align?: MejaiScrollTableAlign;
  sticky?: 'left' | 'right';
  clampLines?: number;
  headerTitle?: string;
  headerClassName?: string;
  cellClassName?: string;
};

export type MejaiScrollTableRow = {
  key: string;
  cells: Record<string, React.ReactNode>;
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  ownerItemKey?: string;
  ownerItemName?: string;
  onClick?: () => void;
  expandedContent?: React.ReactNode;
};

type MejaiScrollTableItemAttributes = (item: string, name: string) => Record<string, string>;

type MejaiScrollTableProps = {
  columns: MejaiScrollTableColumn[];
  rows: MejaiScrollTableRow[];
  emptyMessage?: React.ReactNode;
  className?: string;
  scrollAreaClassName?: string;
  maxHeightClassName?: string;
  showIndexColumn?: boolean;
  indexHeaderLabel?: React.ReactNode;
  indexWidth?: number | string;
  minTableWidth?: number | string;
  ownerItemKey?: string;
  ownerItemName?: string;
  ownerItemAttributes?: MejaiScrollTableItemAttributes;
};

type MejaiScrollTableLayoutMetrics = {
  fillerWidth: number;
  headerRowHeight: number;
  bodyRowHeights: number[];
};

type RowPointerGesture = {
  pointerId: number;
  rowKey: string;
  startX: number;
  startY: number;
  dragged: boolean;
};

const ROW_CLICK_CANCEL_DRAG_THRESHOLD_PX = 6;
const RIGHT_SCROLL_SHADOW_VISUAL_WIDTH_PX = 26;

const toCssSize = (value: number | string | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === 'number' ? `${value}px` : value;
};

const toPixelNumber = (value: number | string | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.endsWith('px')) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const clampStyleForLines = (lineCount: number | undefined): React.CSSProperties => {
  if (!lineCount || lineCount <= 1) {
    return {
      display: 'block',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      wordBreak: 'normal',
      overflowWrap: 'normal',
      maxWidth: '100%',
    };
  }

  return {
    display: '-webkit-box',
    WebkitLineClamp: lineCount,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    whiteSpace: 'normal',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
    maxWidth: '100%',
  };
};

const getHeaderAlignmentClassName = (align: MejaiScrollTableAlign | undefined) => {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    default:
      return 'text-left';
  }
};

const getCellAlignmentClassName = (align: MejaiScrollTableAlign | undefined) => {
  switch (align) {
    case 'center':
      return 'items-center justify-center text-center';
    case 'right':
      return 'items-end justify-end text-right';
    default:
      return 'items-start justify-start text-left';
  }
};

const getStickyPlacementClassName = (sticky: MejaiScrollTableColumn['sticky']) => {
  switch (sticky) {
    case 'left':
      return 'sticky left-0';
    case 'right':
      return 'sticky right-0';
    default:
      return '';
  }
};

const getStickyHeaderClassName = (sticky: MejaiScrollTableColumn['sticky']) => {
  if (!sticky) {
    return '';
  }

  return cn(getStickyPlacementClassName(sticky), 'z-[3]');
};

const getStickyBodyClassName = (sticky: MejaiScrollTableColumn['sticky'], row: MejaiScrollTableRow) => {
  if (!sticky) {
    return '';
  }

  return cn(
    getStickyPlacementClassName(sticky),
    'z-[2]',
    row.selected ? 'bg-slate-50' : 'bg-white',
    row.onClick ? 'group-hover:bg-slate-50' : ''
  );
};

const renderCellValue = (value: React.ReactNode, column: MejaiScrollTableColumn) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <div style={clampStyleForLines(column.clampLines)} title={String(value)}>
        {value}
      </div>
    );
  }

  return <div className="min-w-0 max-w-full">{value}</div>;
};

export function MejaiScrollTable({
  columns,
  rows,
  emptyMessage = '표시할 항목이 없습니다.',
  className,
  scrollAreaClassName,
  maxHeightClassName,
  showIndexColumn = true,
  indexHeaderLabel = '번호',
  indexWidth = 42,
  minTableWidth,
  ownerItemKey,
  ownerItemName = '스크롤 표',
  ownerItemAttributes,
}: MejaiScrollTableProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const tableRef = React.useRef<HTMLTableElement | null>(null);
  const headerRowRef = React.useRef<HTMLTableRowElement | null>(null);
  const bodyRef = React.useRef<HTMLTableSectionElement | null>(null);
  const fixedRightHeaderRowRef = React.useRef<HTMLTableRowElement | null>(null);
  const fixedRightBodyRef = React.useRef<HTMLTableSectionElement | null>(null);
  const rowPointerGestureRef = React.useRef<RowPointerGesture | null>(null);
  const suppressClickRowKeyRef = React.useRef<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [layoutMetrics, setLayoutMetrics] = React.useState<MejaiScrollTableLayoutMetrics>({
    fillerWidth: 0,
    headerRowHeight: 0,
    bodyRowHeights: [],
  });

  const updateScrollHintState = React.useCallback(() => {
    const element = scrollAreaRef.current;

    if (!element) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const nextCanScrollLeft = element.scrollLeft > 2;
    const nextCanScrollRight = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;

    setCanScrollLeft(nextCanScrollLeft);
    setCanScrollRight(nextCanScrollRight);
  }, []);

  const updateLayoutMetrics = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    const table = tableRef.current;
    const headerRow = headerRowRef.current;
    const body = bodyRef.current;
    const fixedRightHeaderRow = fixedRightHeaderRowRef.current;
    const fixedRightBody = fixedRightBodyRef.current;

    if (!scrollArea || !table || !body) {
      setLayoutMetrics((current) =>
        current.fillerWidth === 0 && current.headerRowHeight === 0 && current.bodyRowHeights.length === 0
          ? current
          : { fillerWidth: 0, headerRowHeight: 0, bodyRowHeights: [] }
      );
      return;
    }

    const fillerWidth = Math.max(0, scrollArea.getBoundingClientRect().width - table.getBoundingClientRect().width);
    const scrollBodyRows = Array.from(body.querySelectorAll(':scope > tr'));
    const fixedRightBodyRows = fixedRightBody
      ? Array.from(fixedRightBody.querySelectorAll(':scope > tr'))
      : [];
    const rowsToMeasure = [headerRow, fixedRightHeaderRow, ...scrollBodyRows, ...fixedRightBodyRows].filter(
      (row): row is HTMLTableRowElement => Boolean(row)
    );
    const previousRowHeights = rowsToMeasure.map((row) => row.style.height);

    rowsToMeasure.forEach((row) => {
      row.style.height = '';
    });

    const headerRowHeight = Math.max(
      headerRow?.getBoundingClientRect().height ?? 0,
      fixedRightHeaderRow?.getBoundingClientRect().height ?? 0
    );
    const scrollBodyRowHeights = scrollBodyRows.map((row) => row.getBoundingClientRect().height);
    const fixedRightBodyRowHeights = fixedRightBodyRows.map((row) => row.getBoundingClientRect().height);

    rowsToMeasure.forEach((row, index) => {
      row.style.height = previousRowHeights[index] || '';
    });

    const bodyRowCount = Math.max(scrollBodyRowHeights.length, fixedRightBodyRowHeights.length);
    const bodyRowHeights = Array.from({ length: bodyRowCount }, (_, index) =>
      Math.max(scrollBodyRowHeights[index] ?? 0, fixedRightBodyRowHeights[index] ?? 0)
    );

    setLayoutMetrics((current) => {
      const sameFillerWidth = Math.abs(current.fillerWidth - fillerWidth) < 0.5;
      const sameHeaderHeight = Math.abs(current.headerRowHeight - headerRowHeight) < 0.5;
      const sameBodyRows =
        current.bodyRowHeights.length === bodyRowHeights.length &&
        current.bodyRowHeights.every((height, index) => Math.abs(height - (bodyRowHeights[index] ?? 0)) < 0.5);

      if (sameFillerWidth && sameHeaderHeight && sameBodyRows) {
        return current;
      }

      return {
        fillerWidth,
        headerRowHeight,
        bodyRowHeights,
      };
    });
  }, []);

  React.useLayoutEffect(() => {
    updateScrollHintState();
    updateLayoutMetrics();

    const element = scrollAreaRef.current;
    const table = tableRef.current;
    const headerRow = headerRowRef.current;
    const bodyRows = Array.from(bodyRef.current?.querySelectorAll(':scope > tr') ?? []);
    const fixedRightHeaderRow = fixedRightHeaderRowRef.current;
    const fixedRightBodyRows = Array.from(fixedRightBodyRef.current?.querySelectorAll(':scope > tr') ?? []);

    if (!element) {
      return;
    }

    const handleScroll = () => {
      updateScrollHintState();
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      updateScrollHintState();
      updateLayoutMetrics();
    });
    resizeObserver.observe(element);
    if (table) {
      resizeObserver.observe(table);
    }
    if (headerRow) {
      resizeObserver.observe(headerRow);
    }
    if (fixedRightHeaderRow) {
      resizeObserver.observe(fixedRightHeaderRow);
    }
    bodyRows.forEach((row) => {
      resizeObserver.observe(row);
    });
    fixedRightBodyRows.forEach((row) => {
      resizeObserver.observe(row);
    });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [rows, columns, updateLayoutMetrics, updateScrollHintState]);

  const normalizedIndexWidth = toCssSize(indexWidth) || '42px';
  const stickyRightOffsetPx = columns.reduce((sum, column) => {
    if (column.sticky !== 'right') {
      return sum;
    }

    return sum + toPixelNumber(column.width ?? column.minWidth ?? column.maxWidth);
  }, 0);
  const hasRightStickyColumns = stickyRightOffsetPx > 0;
  const scrollColumns = hasRightStickyColumns ? columns.filter((column) => column.sticky !== 'right') : columns;
  const fixedRightColumns = hasRightStickyColumns ? columns.filter((column) => column.sticky === 'right') : [];
  const rightScrollShadowStyle =
    stickyRightOffsetPx > 0
      ? {
          right: 0,
          width: stickyRightOffsetPx + RIGHT_SCROLL_SHADOW_VISUAL_WIDTH_PX,
        }
      : undefined;
  let runningStickyRightOffsetPx = 0;
  const stickyRightOffsetsByKey = columns.reduceRight<Record<string, number>>((offsets, column) => {
    if (column.sticky !== 'right') {
      return offsets;
    }

    offsets[column.key] = runningStickyRightOffsetPx;
    runningStickyRightOffsetPx += toPixelNumber(column.width ?? column.minWidth ?? column.maxWidth);
    return offsets;
  }, {});
  const getColumnStickyStyle = (column: MejaiScrollTableColumn): React.CSSProperties | undefined => {
    if (column.sticky !== 'right') {
      return undefined;
    }

    const right = stickyRightOffsetsByKey[column.key] ?? 0;
    return { right };
  };
  const scrollColumnDefs = showIndexColumn
    ? [
        { key: '__index__', width: normalizedIndexWidth, minWidth: normalizedIndexWidth, maxWidth: normalizedIndexWidth },
        ...scrollColumns,
      ]
    : scrollColumns;
  const ownerAttrs = React.useCallback(
    (item: string | undefined, name: string) => (ownerItemAttributes && item ? ownerItemAttributes(item, name) : {}),
    [ownerItemAttributes]
  );
  const getColumnWidthTotal = (targetColumns: Array<Pick<MejaiScrollTableColumn, 'width' | 'minWidth'>>) =>
    targetColumns.reduce((sum, column) => {
      const widthCandidate = column.width ?? column.minWidth;

      if (typeof widthCandidate === 'number') {
        return sum + widthCandidate;
      }

      if (typeof widthCandidate === 'string' && widthCandidate.endsWith('px')) {
        const parsed = Number.parseFloat(widthCandidate);
        return Number.isFinite(parsed) ? sum + parsed : sum;
      }

      return sum;
    }, 0);
  const providedMinTableWidthPx = toPixelNumber(minTableWidth);
  const scrollColumnWidthTotal = getColumnWidthTotal(scrollColumnDefs);
  const computedScrollMinTableWidth =
    hasRightStickyColumns
      ? Math.max(scrollColumnWidthTotal, providedMinTableWidthPx > 0 ? providedMinTableWidthPx - stickyRightOffsetPx : 0)
      : undefined;
  const computedMinTableWidth =
    (hasRightStickyColumns && computedScrollMinTableWidth > 0 ? computedScrollMinTableWidth : toCssSize(minTableWidth)) ||
    scrollColumnDefs.reduce((sum, column) => {
      const widthCandidate = column.minWidth ?? column.width;

      if (typeof widthCandidate === 'number') {
        return sum + widthCandidate;
      }

      if (typeof widthCandidate === 'string' && widthCandidate.endsWith('px')) {
        return sum + Number.parseFloat(widthCandidate);
      }

      return sum;
    }, 0);

  const handleRowPointerDown = React.useCallback((event: React.PointerEvent<HTMLTableRowElement>, rowKey: string) => {
    if (event.button !== 0) {
      return;
    }

    rowPointerGestureRef.current = {
      pointerId: event.pointerId,
      rowKey,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };

    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }, []);

  const handleRowPointerMove = React.useCallback((event: React.PointerEvent<HTMLTableRowElement>, rowKey: string) => {
    const gesture = rowPointerGestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId || gesture.rowKey !== rowKey || gesture.dragged) {
      return;
    }

    if (
      Math.abs(event.clientX - gesture.startX) >= ROW_CLICK_CANCEL_DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - gesture.startY) >= ROW_CLICK_CANCEL_DRAG_THRESHOLD_PX
    ) {
      gesture.dragged = true;
    }
  }, []);

  const finalizeRowPointerGesture = React.useCallback(
    (event: React.PointerEvent<HTMLTableRowElement>, rowKey: string) => {
      const gesture = rowPointerGestureRef.current;

      if (!gesture || gesture.pointerId !== event.pointerId || gesture.rowKey !== rowKey) {
        return;
      }

      if (gesture.dragged) {
        suppressClickRowKeyRef.current = rowKey;
      }

      rowPointerGestureRef.current = null;

      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    },
    []
  );

  const handleRowClick = React.useCallback((event: React.MouseEvent<HTMLTableRowElement>, row: MejaiScrollTableRow) => {
    if (suppressClickRowKeyRef.current === row.key) {
      suppressClickRowKeyRef.current = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    row.onClick?.();
  }, []);

  const getRenderedColumnIndex = React.useCallback(
    (column: MejaiScrollTableColumn) => {
      const columnIndex = columns.findIndex((candidate) => candidate.key === column.key);

      if (columnIndex < 0) {
        return undefined;
      }

      return showIndexColumn ? columnIndex + 1 : columnIndex;
    },
    [columns, showIndexColumn]
  );

  const renderColGroup = (targetColumns: MejaiScrollTableColumn[], includeIndexColumn: boolean) => (
    <colgroup>
      {includeIndexColumn ? (
        <col
          data-mejai-col-contract="1"
          data-mejai-col-index="0"
          data-mejai-col-role="index"
          style={{ width: normalizedIndexWidth, minWidth: normalizedIndexWidth }}
        />
      ) : null}
      {targetColumns.map((column) => {
        const width = toCssSize(column.width);
        const minWidth = toCssSize(column.minWidth || column.width);
        const maxWidth = toCssSize(column.maxWidth);
        const renderedColumnIndex = getRenderedColumnIndex(column);

        return (
          <col
            key={column.key}
            data-mejai-col-contract="1"
            data-mejai-col-index={renderedColumnIndex}
            style={{
              width,
              minWidth,
              maxWidth,
            }}
          />
        );
      })}
    </colgroup>
  );

  const renderHeaderCells = (targetColumns: MejaiScrollTableColumn[], pane: 'scroll' | 'fixed-right') => (
    <>
      {pane === 'scroll' && showIndexColumn ? (
        <th
          {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-header-index-cell` : undefined, `${ownerItemName} 번호 머리 셀`)}
          className="sticky top-0 z-[1] border-b border-slate-300 bg-slate-100 px-1.5 py-1 text-center text-[10px] font-semibold text-slate-700"
        >
          <div className="overflow-hidden text-ellipsis whitespace-nowrap">{indexHeaderLabel}</div>
        </th>
      ) : null}
      {targetColumns.map((column) => {
        const renderedColumnIndex = getRenderedColumnIndex(column);

        return (
          <th
            key={column.key}
            data-mejai-col-index={renderedColumnIndex}
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-header-${column.key}` : undefined, `${ownerItemName} ${String(column.label)} 머리 셀`)}
            title={column.headerTitle}
            style={pane === 'fixed-right' ? undefined : getColumnStickyStyle(column)}
            className={cn(
              'sticky top-0 border-b border-slate-300 bg-slate-100 px-1.5 py-1 align-top text-[10px] text-slate-700',
              pane === 'fixed-right' ? 'z-[3]' : cn('z-[1]', getStickyHeaderClassName(column.sticky)),
              getHeaderAlignmentClassName(column.align),
              column.headerClassName
            )}
          >
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">{column.label}</div>
          </th>
        );
      })}
    </>
  );

  const renderBodyCells = (
    row: MejaiScrollTableRow,
    rowIndex: number,
    targetColumns: MejaiScrollTableColumn[],
    pane: 'scroll' | 'fixed-right',
    rowOwnerItemKey: string | undefined,
    rowOwnerItemName: string,
    isLastRenderedBodyRow: boolean
  ) => {
    const bodyBottomBorderClassName = isLastRenderedBodyRow ? 'border-b-0' : 'border-b border-slate-200';

    return (
      <>
        {pane === 'scroll' && showIndexColumn ? (
          <td
            {...ownerAttrs(rowOwnerItemKey ? `${rowOwnerItemKey}-index-cell` : undefined, `${rowOwnerItemName} 번호 셀`)}
            className={cn(
              bodyBottomBorderClassName,
              'px-1.5 py-1 text-center text-[11px] font-bold whitespace-nowrap text-slate-900'
            )}
          >
            {rowIndex + 1}
          </td>
        ) : null}
        {targetColumns.map((column) => {
          const renderedColumnIndex = getRenderedColumnIndex(column);

          return (
            <td
              key={`${row.key}-${pane}-${column.key}`}
              data-mejai-col-index={renderedColumnIndex}
              {...ownerAttrs(rowOwnerItemKey ? `${rowOwnerItemKey}-${column.key}-cell` : undefined, `${rowOwnerItemName} ${String(column.label)} 셀`)}
              style={pane === 'fixed-right' ? undefined : getColumnStickyStyle(column)}
              className={cn(
                bodyBottomBorderClassName,
                'px-1.5 py-1 align-middle text-[11px]',
                pane === 'fixed-right'
                  ? (row.selected ? 'bg-slate-50' : 'bg-white')
                  : cn(
                      getStickyBodyClassName(column.sticky, row),
                      column.key === 'summary' ? 'text-slate-700' : 'text-slate-600',
                      row.onClick ? 'cursor-pointer' : ''
                    ),
                pane === 'fixed-right' && column.key === 'summary' ? 'text-slate-700' : 'text-slate-600',
                column.cellClassName
              )}
            >
              <div
                data-mejai-cell-content="1"
                data-mejai-col-index={renderedColumnIndex}
                {...ownerAttrs(rowOwnerItemKey ? `${rowOwnerItemKey}-${column.key}-cell-content` : undefined, `${rowOwnerItemName} ${String(column.label)} 셀 내용`)}
                className={cn('flex min-w-0 max-w-full', getCellAlignmentClassName(column.align))}
              >
                {renderCellValue(row.cells[column.key] ?? '-', column)}
              </div>
            </td>
          );
        })}
      </>
    );
  };

  const renderBodyRows = (targetColumns: MejaiScrollTableColumn[], pane: 'scroll' | 'fixed-right') => {
    if (rows.length === 0) {
      const emptyHeight = pane === 'fixed-right' ? layoutMetrics.bodyRowHeights[0] : undefined;

      return (
        <tr
          {...ownerAttrs(
            ownerItemKey ? `${ownerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-empty-row` : undefined,
            `${ownerItemName} 빈 행`
          )}
          style={emptyHeight ? { height: emptyHeight } : undefined}
        >
          <td
            colSpan={targetColumns.length + (pane === 'scroll' && showIndexColumn ? 1 : 0)}
            {...ownerAttrs(
              ownerItemKey ? `${ownerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-empty-cell` : undefined,
              `${ownerItemName} 빈 셀`
            )}
            className={cn(
              'px-3 py-6 text-sm text-slate-500',
              pane === 'fixed-right' ? 'border-b-0 bg-white' : ''
            )}
          >
            {pane === 'scroll' ? emptyMessage : null}
          </td>
        </tr>
      );
    }

    let measuredBodyRowIndex = 0;

    return rows.map((row, index) => {
      const rowOwnerItemKey = row.ownerItemKey || (ownerItemKey ? `${ownerItemKey}-row-${row.key}` : undefined);
      const rowOwnerItemName = row.ownerItemName || `${ownerItemName} 행 - ${row.ariaLabel || row.title || row.key}`;
      const rowHeight = layoutMetrics.bodyRowHeights[measuredBodyRowIndex];
      measuredBodyRowIndex += 1;
      const sharedClassName = cn(
        row.onClick && pane === 'scroll' ? 'group cursor-pointer hover:bg-slate-50' : '',
        row.selected ? 'bg-slate-50' : 'bg-transparent',
        row.disabled ? 'pointer-events-none opacity-60' : '',
        row.className
      );
      const renderedRowOwnerItemKey =
        pane === 'fixed-right' && rowOwnerItemKey ? `${rowOwnerItemKey}-fixed-right-row` : rowOwnerItemKey;
      const renderedRowOwnerItemName =
        pane === 'fixed-right' ? `${rowOwnerItemName} 오른쪽 고정 행` : rowOwnerItemName;
      const isLastSourceRow = index === rows.length - 1;
      const hasExpandedContent = Boolean(row.expandedContent);
      const content = renderBodyCells(
        row,
        index,
        targetColumns,
        pane,
        rowOwnerItemKey,
        rowOwnerItemName,
        isLastSourceRow && !hasExpandedContent
      );
      const rowStyle = rowHeight ? { height: rowHeight } : undefined;
      const renderedRow = row.onClick && pane === 'scroll' ? (
        <tr
          key={`${row.key}:${pane}`}
          role="button"
          tabIndex={row.disabled ? -1 : 0}
          aria-label={row.ariaLabel}
          title={row.title}
          {...ownerAttrs(renderedRowOwnerItemKey, renderedRowOwnerItemName)}
          className={sharedClassName}
          style={rowStyle}
          onClick={(event) => handleRowClick(event, row)}
          onPointerDown={(event) => handleRowPointerDown(event, row.key)}
          onPointerMove={(event) => handleRowPointerMove(event, row.key)}
          onPointerUp={(event) => finalizeRowPointerGesture(event, row.key)}
          onPointerCancel={(event) => finalizeRowPointerGesture(event, row.key)}
          onKeyDown={(event) => {
            if (row.disabled) {
              return;
            }

            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              row.onClick?.();
            }
          }}
        >
          {content}
        </tr>
      ) : (
        <tr
          key={`${row.key}:${pane}`}
          aria-label={row.ariaLabel}
          title={row.title}
          {...ownerAttrs(renderedRowOwnerItemKey, renderedRowOwnerItemName)}
          className={sharedClassName}
          style={rowStyle}
        >
          {content}
        </tr>
      );

      if (!row.expandedContent) {
        return renderedRow;
      }

      const expandedRowHeight = layoutMetrics.bodyRowHeights[measuredBodyRowIndex];
      measuredBodyRowIndex += 1;

      return (
        <React.Fragment key={`${row.key}:${pane}:expanded`}>
          {renderedRow}
          <tr
            {...ownerAttrs(
              rowOwnerItemKey
                ? `${rowOwnerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-expanded-row`
                : undefined,
              `${rowOwnerItemName} 확장 행`
            )}
            className={row.selected ? 'bg-slate-50' : 'bg-transparent'}
            style={expandedRowHeight ? { height: expandedRowHeight } : undefined}
          >
            <td
              colSpan={targetColumns.length + (pane === 'scroll' && showIndexColumn ? 1 : 0)}
              {...ownerAttrs(
                rowOwnerItemKey
                  ? `${rowOwnerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-expanded-cell`
                  : undefined,
                `${rowOwnerItemName} 확장 셀`
              )}
              className={cn(isLastSourceRow ? 'border-b-0' : 'border-b border-slate-200', 'px-2 py-2')}
            >
              {pane === 'scroll' ? row.expandedContent : null}
            </td>
          </tr>
        </React.Fragment>
      );
    });
  };

  const renderTable = (targetColumns: MejaiScrollTableColumn[], pane: 'scroll' | 'fixed-right') => (
    <table
      ref={pane === 'scroll' ? tableRef : undefined}
      data-mejai-scroll-table-inner="1"
      data-mejai-table-kind={pane === 'fixed-right' ? 'generic_structured_table_fixed_right' : 'generic_structured_table'}
      data-mejai-col-padding-x="6"
      data-mejai-table-fallback-width="256"
      {...ownerAttrs(
        ownerItemKey ? `${ownerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-table` : undefined,
        pane === 'fixed-right' ? `${ownerItemName} 오른쪽 고정 표` : `${ownerItemName} 표`
      )}
      className={cn(
        'm-0 border-collapse text-inherit',
        pane === 'fixed-right' ? 'w-full table-fixed bg-white' : 'w-max min-w-full table-auto'
      )}
      style={
        pane === 'fixed-right'
          ? { minWidth: stickyRightOffsetPx, width: stickyRightOffsetPx }
          : computedMinTableWidth
            ? { minWidth: computedMinTableWidth }
            : undefined
      }
    >
      {renderColGroup(targetColumns, pane === 'scroll' && showIndexColumn)}
      <thead {...ownerAttrs(ownerItemKey ? `${ownerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-table-head` : undefined, `${ownerItemName} 표 머리`)}>
        <tr
          ref={pane === 'scroll' ? headerRowRef : fixedRightHeaderRowRef}
          {...ownerAttrs(ownerItemKey ? `${ownerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-header-row` : undefined, `${ownerItemName} 머리 행`)}
          style={layoutMetrics.headerRowHeight ? { height: layoutMetrics.headerRowHeight } : undefined}
        >
          {renderHeaderCells(targetColumns, pane)}
        </tr>
      </thead>
      <tbody
        ref={pane === 'scroll' ? bodyRef : fixedRightBodyRef}
        {...ownerAttrs(ownerItemKey ? `${ownerItemKey}${pane === 'fixed-right' ? '-fixed-right' : ''}-table-body` : undefined, `${ownerItemName} 표 본문`)}
      >
        {renderBodyRows(targetColumns, pane)}
      </tbody>
    </table>
  );

  return (
    <div
      data-mejai-scroll-table="1"
      {...ownerAttrs(ownerItemKey, ownerItemName)}
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-[rgba(255,255,255,0.55)]',
        className
      )}
      style={{ marginTop: 4 }}
    >
      <style>{`
        [data-mejai-scroll-table="1"],
        [data-mejai-scroll-table="1"] *,
        [data-mejai-scroll-table="1"]::before,
        [data-mejai-scroll-table="1"]::after,
        [data-mejai-scroll-table="1"] *::before,
        [data-mejai-scroll-table="1"] *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
        [data-mejai-scroll-area="1"] {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        [data-mejai-scroll-area="1"]::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div
        data-mejai-scroll-left="1"
        {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-left-scroll-shadow` : undefined, `${ownerItemName} 왼쪽 스크롤 그림자`)}
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 top-0 z-10 flex items-center bg-gradient-to-r from-[rgba(255,255,255,0.92)] to-transparent pl-1 pr-1.5',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
      >
        <ChevronLeft className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </div>

      <div
        data-mejai-scroll-right="1"
        {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-right-scroll-shadow` : undefined, `${ownerItemName} 오른쪽 스크롤 그림자`)}
        className={cn(
          'pointer-events-none absolute bottom-0 right-0 top-0 flex items-center justify-start',
          stickyRightOffsetPx > 0 ? 'z-[1]' : 'z-10',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
        style={rightScrollShadowStyle}
      >
        <span className="flex h-full w-[26px] items-center bg-gradient-to-l from-[rgba(255,255,255,0.92)] to-transparent pl-1.5 pr-1">
          <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
        </span>
      </div>

      {hasRightStickyColumns ? (
        <div
          data-mejai-scroll-split-layout="1"
          {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-split-layout` : undefined, `${ownerItemName} 분리형 스크롤 표 배치`)}
          className={cn('flex w-full items-stretch overflow-y-auto overflow-x-hidden', maxHeightClassName)}
        >
          <div
            ref={scrollAreaRef}
            data-mejai-scroll-area="1"
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-scroll-area` : undefined, `${ownerItemName} 스크롤 영역`)}
            className={cn('block min-w-0 flex-1 overflow-x-auto overflow-y-visible', scrollAreaClassName)}
          >
            <div
              data-mejai-scroll-track="1"
              {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-scroll-track` : undefined, `${ownerItemName} 스크롤 트랙`)}
              className="flex min-w-full w-max items-start"
            >
              {renderTable(scrollColumns, 'scroll')}
              {layoutMetrics.fillerWidth > 0.5 ? (
                <div
                  data-mejai-scroll-filler="1"
                  {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-scroll-filler` : undefined, `${ownerItemName} 스크롤 채움 영역`)}
                  aria-hidden="true"
                  className="pointer-events-none flex min-w-0 flex-[0_0_auto] self-stretch overflow-hidden"
                  style={{ width: layoutMetrics.fillerWidth }}
                >
                  <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
                    <div
                      data-mejai-scroll-filler-row="1"
                      className="box-border border-b border-slate-300 bg-slate-100"
                      style={{ height: layoutMetrics.headerRowHeight }}
                    />
                    {layoutMetrics.bodyRowHeights.map((height, index) => (
                      <div
                        key={`filler-row-${index}`}
                        data-mejai-scroll-filler-row="1"
                        className={cn(
                          'box-border',
                          index === layoutMetrics.bodyRowHeights.length - 1
                            ? 'border-b-0'
                            : 'border-b border-slate-200',
                          index === layoutMetrics.bodyRowHeights.length - 1 ? 'flex-1' : '',
                          rows[index]?.selected ? 'bg-slate-50' : 'bg-transparent'
                        )}
                        style={{ height }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div
            data-mejai-fixed-right-pane="1"
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-fixed-right-pane` : undefined, `${ownerItemName} 오른쪽 고정 컬럼 영역`)}
            className="relative z-[2] shrink-0 overflow-hidden"
            style={{ width: stickyRightOffsetPx }}
          >
            {renderTable(fixedRightColumns, 'fixed-right')}
          </div>
        </div>
      ) : (
        <div
          ref={scrollAreaRef}
          data-mejai-scroll-area="1"
          {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-scroll-area` : undefined, `${ownerItemName} 스크롤 영역`)}
          className={cn('block w-full overflow-auto', maxHeightClassName, scrollAreaClassName)}
        >
          <div
            data-mejai-scroll-track="1"
            {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-scroll-track` : undefined, `${ownerItemName} 스크롤 트랙`)}
            className="flex min-w-full w-max items-start"
          >
            {renderTable(scrollColumns, 'scroll')}
            {layoutMetrics.fillerWidth > 0.5 ? (
              <div
                data-mejai-scroll-filler="1"
                {...ownerAttrs(ownerItemKey ? `${ownerItemKey}-scroll-filler` : undefined, `${ownerItemName} 스크롤 채움 영역`)}
                aria-hidden="true"
                className="pointer-events-none flex min-w-0 flex-[0_0_auto] self-stretch overflow-hidden"
                style={{ width: layoutMetrics.fillerWidth }}
              >
                <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
                  <div
                    data-mejai-scroll-filler-row="1"
                    className="box-border border-b border-slate-300 bg-slate-100"
                    style={{ height: layoutMetrics.headerRowHeight }}
                  />
                  {layoutMetrics.bodyRowHeights.map((height, index) => (
                    <div
                      key={`filler-row-${index}`}
                      data-mejai-scroll-filler-row="1"
                      className={cn(
                        'box-border',
                        index === layoutMetrics.bodyRowHeights.length - 1
                          ? 'border-b-0'
                          : 'border-b border-slate-200',
                        index === layoutMetrics.bodyRowHeights.length - 1 ? 'flex-1' : '',
                        rows[index]?.selected ? 'bg-slate-50' : 'bg-transparent'
                      )}
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
