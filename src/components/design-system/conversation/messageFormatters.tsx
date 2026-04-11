import type { ReactNode } from "react";

const LABELS = ["요약", "상세", "현재 상태", "KB 정책", "현재상태", "KB정책"];

type LabeledSection = { label: string; content: string };

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s:.,\-_/()[\]{}|'"`~!@#$%^&*+=<>?]/g, "");
}

function isRedundantDetail(summary: string, detail: string) {
  const summaryNorm = normalizeText(summary);
  const detailNorm = normalizeText(detail);
  if (!summaryNorm || !detailNorm) return false;
  if (summaryNorm.includes(detailNorm) || detailNorm.includes(summaryNorm)) return true;
  return false;
}

export function renderLabeledContent(content: string): ReactNode | string {
  const lines = String(content || "").split(/\r?\n/);
  const sections: LabeledSection[] = [];
  let current: LabeledSection | null = null;
  let prefix: string[] = [];

  lines.forEach((raw) => {
    const line = raw.trim();
    const matched = LABELS.find((label) => line.startsWith(`${label}:`));
    if (matched) {
      const value = line.slice(matched.length + 1).trim();
      current = { label: matched, content: value };
      sections.push(current);
      return;
    }
    if (!current) {
      if (raw.trim()) prefix.push(raw);
      return;
    }
    current.content = current.content ? `${current.content}\n${raw}` : raw;
  });

  if (sections.length === 0) return content;

  const summary = sections.find((section) => section.label === "요약");
  const detail = sections.find((section) => section.label === "상세");
  if (summary && detail && isRedundantDetail(summary.content, detail.content)) {
    const index = sections.indexOf(detail);
    if (index >= 0) sections.splice(index, 1);
  }

  return (
    <div className="space-y-4">
      {prefix.length > 0 ? (
        <div className="whitespace-pre-wrap">{prefix.join("\n")}</div>
      ) : null}
      {sections.map((section) => (
        <div key={`${section.label}-${section.content.slice(0, 12)}`} className="space-y-1">
          <div className="text-[11px] font-semibold text-slate-600">{section.label}</div>
          <div className="h-px bg-slate-200" />
          <div className="whitespace-pre-wrap text-sm text-slate-700">{section.content}</div>
        </div>
      ))}
    </div>
  );
}
