import { cn } from "../../lib/cn";

export function PanelCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-slate-300 bg-slate-50", className)} {...props}>
      {children}
    </div>
  );
}

export function AdminTag({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "rounded border border-amber-300 bg-amber-50 px-1 py-0 text-[10px] font-semibold text-amber-700",
        className
      )}
      {...props}
    >
      ADMIN
    </span>
  );
}

export function StateBanner({
  tone,
  title,
  description,
  actions,
  actionsClassName,
  className,
  ...props
}: {
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  description?: string;
  actions?: React.ReactNode;
  actionsClassName?: string;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <div className={cn("rounded-xl border px-3 py-2", toneClass, className)} {...props}>
      <div
        className={cn(
          "flex gap-3",
          actions ? "flex-col sm:flex-row sm:items-stretch sm:justify-between" : "items-stretch"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {description ? <div className="mt-1 text-xs opacity-90">{description}</div> : null}
        </div>
        {actions ? (
          <div className={cn("w-full gap-2 sm:w-[112px] sm:shrink-0", actionsClassName ?? "flex flex-col")}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function InlineToggle({
  checked,
  className,
  ...props
}: { checked: boolean; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        checked
          ? "inline-flex h-7 w-[55px] items-center justify-center rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white"
          : "inline-flex h-7 w-[55px] items-center justify-center rounded-md bg-rose-700 px-2 py-1 text-[11px] font-bold text-white",
        className
      )}
      aria-label={checked ? "ON" : "OFF"}
      {...props}
    >
      {checked ? "ON" : "OFF"}
    </span>
  );
}

export function SectionBlock({
  id,
  title,
  description,
  children,
  ...props
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5" {...props}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}
