import * as React from "react";

import { cn } from "../../lib/utils";
import { Card } from "./Card";

export type StructuredListColumn = {
  key: string;
  label: React.ReactNode;
  width: string;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
};

export type StructuredListRow = {
  id: string;
  cells: Record<string, React.ReactNode>;
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  onSelect?: () => void;
};

export type StructuredListProps = {
  title: string;
  count: number;
  countLabel?: React.ReactNode;
  columns: StructuredListColumn[];
  rows: StructuredListRow[];
  headerControls?: React.ReactNode;
  toolbar?: React.ReactNode;
  emptyState?: React.ReactNode;
  maxBodyHeight?: string;
  minTableWidth?: number | string;
  className?: string;
};

const alignClassNames: Record<NonNullable<StructuredListColumn["align"]>, string> = {
  left: "text-left",
  center: "flex justify-center text-center",
  right: "flex justify-end text-right",
};

const renderCellValue = (value: React.ReactNode) => {
  if (typeof value === "string" || typeof value === "number") {
    return <span className="block truncate text-xs text-slate-700">{value}</span>;
  }

  return value;
};

export function StructuredList({
  title,
  count,
  countLabel,
  columns,
  rows,
  headerControls,
  toolbar,
  emptyState,
  maxBodyHeight = "min(56vh, 520px)",
  minTableWidth = 720,
  className,
}: StructuredListProps) {
  const gridTemplateColumns = columns.map((column) => column.width).join(" ");
  const resolvedCountLabel = countLabel ?? `총 ${count.toLocaleString("ko-KR")}개`;

  return (
    <Card className={cn("relative flex min-h-0 min-w-0 flex-col overflow-hidden border-slate-200 bg-white", className)}>
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-xs text-slate-500">{resolvedCountLabel}</div>
            </div>
            {headerControls ? <div className="shrink-0">{headerControls}</div> : null}
          </div>
          {toolbar ? <div className="flex w-full flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      </div>

      <div className="min-h-0 overflow-x-auto">
        <div className="w-full" style={{ minWidth: minTableWidth }}>
          <div
            className="grid items-center gap-x-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
            style={{ gridTemplateColumns }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className={cn(
                  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
                  alignClassNames[column.align || "left"],
                  column.headerClassName
                )}
              >
                {column.label}
              </div>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto" style={{ maxHeight: maxBodyHeight }}>
            {rows.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {rows.map((row) => {
                  const sharedClassName = cn(
                    "grid w-full items-center gap-x-2 overflow-hidden px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                    row.selected ? "bg-slate-50" : "hover:bg-slate-50",
                    row.onSelect ? "cursor-pointer" : "",
                    row.disabled ? "cursor-not-allowed opacity-60" : "",
                    row.className
                  );

                  const content = (
                    <>
                      {columns.map((column) => (
                        <div
                          key={`${row.id}-${column.key}`}
                          className={cn(
                            "min-w-0 overflow-hidden py-0.5 text-[11px] text-slate-600",
                            alignClassNames[column.align || "left"],
                            column.cellClassName
                          )}
                        >
                          {renderCellValue(row.cells[column.key] ?? "-")}
                        </div>
                      ))}
                    </>
                  );

                  if (row.onSelect) {
                    return (
                      <button
                        key={row.id}
                        type="button"
                        title={row.title}
                        aria-label={row.ariaLabel}
                        disabled={row.disabled}
                        className={sharedClassName}
                        style={{ gridTemplateColumns }}
                        onClick={row.onSelect}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div key={row.id} title={row.title} aria-label={row.ariaLabel} className={sharedClassName} style={{ gridTemplateColumns }}>
                      {content}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-sm text-slate-500">{emptyState}</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
