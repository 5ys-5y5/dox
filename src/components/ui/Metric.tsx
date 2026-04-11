import { Card } from "./Card";

interface MetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  sub?: string;
}

export function Metric({ label, value, sub, ...props }: MetricProps) {
  return (
    <Card {...props}>
      <div className="p-4">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      </div>
    </Card>
  );
}
