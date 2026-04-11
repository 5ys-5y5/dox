import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  key: T;
  label: string;
  disabled?: boolean;
};

type TabBaseProps<T extends string> = Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  tabs: Array<TabItem<T>>;
  activeKey: T;
  onSelect: (key: T) => void;
  className?: string;
};

export function UnderlineTabs<T extends string>({
  tabs,
  activeKey,
  onSelect,
  className,
  ...props
}: TabBaseProps<T>) {
  return (
    <div className={cn("border-b border-slate-200 pb-2", className)} {...props}>
      <nav className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              disabled={tab.disabled}
              onClick={() => {
                if (!tab.disabled) onSelect(tab.key);
              }}
              className={cn(
                "whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition",
                tab.disabled
                  ? "cursor-not-allowed border-transparent bg-transparent text-slate-400"
                  : isActive
                    ? "border-slate-300 bg-slate-100 text-slate-900"
                    : "border-transparent bg-transparent text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function PillTabs<T extends string>({
  tabs,
  activeKey,
  onSelect,
  className,
  sticky = true,
  ...props
}: TabBaseProps<T> & { sticky?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap rounded-3xl border border-slate-200 gap-2 bg-white/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80",
        sticky ? "sticky top-0 z-20" : "",
        className
      )}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) onSelect(tab.key);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              tab.disabled
                ? "cursor-not-allowed border-slate-200 bg-white text-slate-300"
                : isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
