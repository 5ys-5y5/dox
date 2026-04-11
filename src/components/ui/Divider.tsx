import React from "react";
import { cn } from "@/lib/utils";

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  className?: string;
}

export function Divider({ label, className, ...props }: DividerProps) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)} {...props}>
      <div className="h-px flex-1 bg-slate-200" />
      {label ? <div className="text-xs text-slate-500">{label}</div> : null}
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
