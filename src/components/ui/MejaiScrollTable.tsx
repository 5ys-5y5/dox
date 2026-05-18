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
  onClick?: () => void;
};

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
};

type RowPointerGesture = {
  pointerId: number;
  rowKey: string;
  startX: number;
  startY: number;
  dragged: boolean;
};

const ROW_CLICK_CANCEL_DRAG_THRESHOLD_PX = 6;

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
}: MejaiScrollTableProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const rowPointerGestureRef = React.useRef<RowPointerGesture | null>(null);
  const suppressClickRowKeyRef = React.useRef<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

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

  React.useEffect(() => {
    updateScrollHintState();

    const element = scrollAreaRef.current;

    if (!element) {
      return;
    }

    const handleScroll = () => {
      updateScrollHintState();
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      updateScrollHintState();
    });
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [rows, columns, updateScrollHintState]);

  const normalizedIndexWidth = toCssSize(indexWidth) || '42px';
  const stickyRightOffsetPx = columns.reduce((sum, column) => {
    if (column.sticky !== 'right') {
      return sum;
    }

    return sum + toPixelNumber(column.width ?? column.minWidth ?? column.maxWidth);
  }, 0);
  const columnDefs = showIndexColumn
    ? [{ key: '__index__', width: normalizedIndexWidth, minWidth: normalizedIndexWidth, maxWidth: normalizedIndexWidth }, ...columns]
    : columns;
  const computedMinTableWidth =
    toCssSize(minTableWidth) ||
    columnDefs.reduce((sum, column) => {
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

  return (
    <div
      data-mejai-scroll-table="1"
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-[rgba(255,255,255,0.55)]',
        className
      )}
      style={{ marginTop: 4 }}
    >
      <style>{`
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
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 top-0 z-10 flex items-center bg-gradient-to-r from-[rgba(255,255,255,0.92)] to-transparent pl-1 pr-1.5 transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
      >
        <ChevronLeft className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </div>

      <div
        data-mejai-scroll-right="1"
        className={cn(
          'pointer-events-none absolute bottom-0 right-0 top-0 z-10 flex items-center bg-gradient-to-l from-[rgba(255,255,255,0.92)] to-transparent pl-1.5 pr-1 transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
        style={stickyRightOffsetPx > 0 ? { right: stickyRightOffsetPx } : undefined}
      >
        <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </div>

      <div
        ref={scrollAreaRef}
        data-mejai-scroll-area="1"
        className={cn('block w-full overflow-auto', maxHeightClassName, scrollAreaClassName)}
      >
        <div data-mejai-scroll-track="1" className="flex min-w-full w-max items-stretch">
          <table
            data-mejai-scroll-table-inner="1"
            data-mejai-table-kind="generic_structured_table"
            data-mejai-col-padding-x="6"
            data-mejai-table-fallback-width="256"
            className="m-0 w-max min-w-full border-collapse table-auto text-inherit"
            style={computedMinTableWidth ? { minWidth: computedMinTableWidth } : undefined}
          >
            <colgroup>
              {showIndexColumn ? (
                <col
                  data-mejai-col-contract="1"
                  data-mejai-col-index="0"
                  data-mejai-col-role="index"
                  style={{ width: normalizedIndexWidth, minWidth: normalizedIndexWidth }}
                />
              ) : null}
              {columns.map((column, index) => {
                const width = toCssSize(column.width);
                const minWidth = toCssSize(column.minWidth || column.width);
                const maxWidth = toCssSize(column.maxWidth);

                return (
                  <col
                    key={column.key}
                    data-mejai-col-contract="1"
                    data-mejai-col-index={showIndexColumn ? index + 1 : index}
                    style={{
                      width,
                      minWidth,
                      maxWidth,
                    }}
                  />
                );
              })}
            </colgroup>
            <thead>
              <tr>
                {showIndexColumn ? (
                  <th
                    className="sticky top-0 z-[1] border-b border-slate-300 bg-slate-100 px-1.5 py-1 text-center text-[10px] font-semibold text-slate-700"
                  >
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">{indexHeaderLabel}</div>
                  </th>
                ) : null}
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    data-mejai-col-index={showIndexColumn ? index + 1 : index}
                    title={column.headerTitle}
                    className={cn(
                      'sticky top-0 z-[1] border-b border-slate-300 bg-slate-100 px-1.5 py-1 align-top text-[10px] text-slate-700',
                      getStickyHeaderClassName(column.sticky),
                      getHeaderAlignmentClassName(column.align),
                      column.headerClassName
                    )}
                  >
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">{column.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, index) => {
                  const content = (
                    <>
                      {showIndexColumn ? (
                        <td className="border-b border-slate-200 px-1.5 py-1 text-center text-[11px] font-bold whitespace-nowrap text-slate-900">
                          {index + 1}
                        </td>
                      ) : null}
                      {columns.map((column, columnIndex) => (
                        <td
                          key={`${row.key}-${column.key}`}
                          data-mejai-col-index={showIndexColumn ? columnIndex + 1 : columnIndex}
                          className={cn(
                            'border-b border-slate-200 px-1.5 py-1 align-top text-[11px] text-slate-600',
                            getStickyBodyClassName(column.sticky, row),
                            column.key === 'summary' ? 'text-slate-700' : 'text-slate-600',
                            row.onClick ? 'cursor-pointer' : '',
                            column.cellClassName
                          )}
                        >
                          <div
                            data-mejai-cell-content="1"
                            data-mejai-col-index={showIndexColumn ? columnIndex + 1 : columnIndex}
                            className={cn('flex min-w-0 max-w-full', getCellAlignmentClassName(column.align))}
                          >
                            {renderCellValue(row.cells[column.key] ?? '-', column)}
                          </div>
                        </td>
                      ))}
                    </>
                  );

                  const sharedClassName = cn(
                    row.onClick ? 'group cursor-pointer transition-colors hover:bg-slate-50' : '',
                    row.selected ? 'bg-slate-50' : 'bg-transparent',
                    row.disabled ? 'pointer-events-none opacity-60' : '',
                    row.className
                  );

                  if (row.onClick) {
                    return (
                      <tr
                        key={row.key}
                        role="button"
                        tabIndex={row.disabled ? -1 : 0}
                        aria-label={row.ariaLabel}
                        title={row.title}
                        className={sharedClassName}
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
                    );
                  }

                  return (
                    <tr key={row.key} aria-label={row.ariaLabel} title={row.title} className={sharedClassName}>
                      {content}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={columns.length + (showIndexColumn ? 1 : 0)}
                    className="px-3 py-6 text-sm text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
