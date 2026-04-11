import React from "react";
import { cn } from "@/lib/utils";

interface IconChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon: React.ElementType;
  label: string;
  className?: string;
}

export function IconChip({ icon: Icon, label, className, ...props }: IconChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700",
        className
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {label}
    </span>
  );
}
