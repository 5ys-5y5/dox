'use client';

import * as React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export type PreviewPipelineStage = {
  key: string;
  label: string;
  description: string;
};

type PreviewPipelineInspectorProps = {
  title: string;
  summary: string;
  enabled: boolean;
  stages: PreviewPipelineStage[];
  activeStageIndex: number;
  approvedStageIndex: number;
  onToggleEnabled: () => void;
  onSelectStage: (stageIndex: number) => void;
  onApproveNextStage: () => void;
};

export default function PreviewPipelineInspector({
  title,
  summary,
  enabled,
  stages,
  activeStageIndex,
  approvedStageIndex,
  onToggleEnabled,
  onSelectStage,
  onApproveNextStage,
}: PreviewPipelineInspectorProps) {
  const activeStage = stages[activeStageIndex] || null;
  const canAdvance = enabled && approvedStageIndex < stages.length - 1;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="amber">DOM 단계 검사</Badge>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
          </div>
          <p className="text-xs leading-5 text-slate-600">{summary}</p>
        </div>
        <Button type="button" size="sm" variant={enabled ? 'default' : 'outline'} onClick={onToggleEnabled}>
          {enabled ? '검사 끄기' : '검사 켜기'}
        </Button>
      </div>
      {enabled ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            {stages.map((stage, index) => {
              const isActive = index === activeStageIndex;
              const isApproved = index <= approvedStageIndex;
              return (
                <button
                  key={stage.key}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : isApproved
                        ? 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                  onClick={() => onSelectStage(index)}
                  disabled={!isApproved}
                >
                  <div className="text-[11px] font-semibold">{index + 1}</div>
                  <div className="mt-0.5 text-xs font-semibold">{stage.label}</div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onApproveNextStage} disabled={!canAdvance}>
              다음 단계 허용
            </Button>
            {activeStage ? (
              <p className="text-xs text-slate-600">
                현재 단계: <span className="font-semibold text-slate-900">{activeStage.label}</span> ·{' '}
                {activeStage.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
