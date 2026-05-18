'use client';

import * as React from 'react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';

type TemplateEditWorkspaceHeaderProps = {
  templateName: string;
  loading: boolean;
  saving: boolean;
  renderedPreviewHtml: string;
  templateUsagePreviewMode: boolean;
  onTemplateNameChange: (nextName: string) => void;
  onSave: () => void;
};

export const TemplateEditWorkspaceHeader = ({
  templateName,
  loading,
  saving,
  renderedPreviewHtml,
  templateUsagePreviewMode,
  onTemplateNameChange,
  onSave,
}: TemplateEditWorkspaceHeaderProps) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold text-slate-950">템플릿 편집</h1>
      <p className="text-sm text-slate-600">저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.</p>
    </div>

    <div className="flex w-full flex-col gap-3 lg:max-w-[560px] lg:flex-row lg:items-end">
      <div className="relative lg:flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-slate-500">
          템플릿 이름:
        </span>
        <Input
          value={templateName}
          onChange={(event) => onTemplateNameChange(event.target.value)}
          disabled={loading}
          aria-label="템플릿 이름"
          className="pl-[7.75rem]"
        />
      </div>
      <Button onClick={onSave} disabled={saving || loading || !renderedPreviewHtml.trim() || templateUsagePreviewMode} className="lg:w-[120px]">
        {saving ? '저장 중...' : '저장'}
      </Button>
    </div>
  </div>
);
