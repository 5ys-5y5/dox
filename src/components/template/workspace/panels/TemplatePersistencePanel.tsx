'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { EntityPicker } from '../../../ui/EntityPicker';
import { Input } from '../../../ui/Input';
import type { TemplateEditWorkspacePersistenceVisibility } from '../types';

type TemplatePersistencePanelProps = {
  templateListDisplay: 'picker' | 'inline';
  additionalControlPanels?: React.ReactNode;
  templates: Array<{
    id: string;
    templateName: string;
    sourceDocumentName?: string | null;
    layoutResizeMode?: string;
  }>;
  selectedTemplateId: string;
  templateDetailTemplateId?: string;
  templateOptions: any[];
  templateName: string;
  sourceDocumentName: string;
  layoutResizeMode: string;
  saving: boolean;
  loading: boolean;
  renderedPreviewHtml: string;
  templateUsagePreviewMode: boolean;
  visibility?: TemplateEditWorkspacePersistenceVisibility;
  onSelectTemplate: (templateId: string) => void;
  onDeleteTemplate: (option: any) => void;
  onSave: () => void;
  onTemplateNameChange: (nextName: string) => void;
  onSourceDocumentNameChange: (nextName: string) => void;
  onLayoutResizeModeChange: (nextMode: string) => void;
};

export const TemplatePersistencePanel = ({
  templateListDisplay,
  additionalControlPanels,
  templates,
  selectedTemplateId,
  templateDetailTemplateId,
  templateOptions,
  templateName,
  sourceDocumentName,
  layoutResizeMode,
  saving,
  loading,
  renderedPreviewHtml,
  templateUsagePreviewMode,
  visibility,
  onSelectTemplate,
  onDeleteTemplate,
  onSave,
  onTemplateNameChange,
  onLayoutResizeModeChange,
}: TemplatePersistencePanelProps) => {
  const showTemplateList = visibility?.showTemplateList !== false;
  const showTemplateNameInput = visibility?.showTemplateNameInput !== false;
  const showLayoutResizeModeSelect = visibility?.showLayoutResizeModeSelect !== false;
  const showSourceDocumentNameInput = visibility?.showSourceDocumentNameInput !== false;
  const showSaveButton = visibility?.showSaveButton !== false;
  const showFieldGrid = showTemplateNameInput || showLayoutResizeModeSelect || showSourceDocumentNameInput;

  return (
  <div className="space-y-6">
    {additionalControlPanels}
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>불러오기 및 저장</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showTemplateList ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-800">
            {templateListDisplay === 'inline' ? '템플릿 리스트' : '저장된 템플릿'}
          </label>
          {templateListDisplay === 'inline' ? (
            <div className="max-h-[320px] overflow-auto rounded-md border border-slate-200 bg-white p-2">
              {templates.length > 0 ? (
                <div className="space-y-1.5">
                  {templates.map((template) => {
                    const isActiveTemplate = selectedTemplateId === template.id || templateDetailTemplateId === template.id;

                    return (
                      <div
                        key={template.id}
                        className={`grid min-h-14 min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] items-stretch overflow-hidden rounded-md border ${
                          isActiveTemplate ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 px-3 py-2 text-left transition hover:bg-slate-50"
                          onClick={() => onSelectTemplate(template.id)}
                        >
                          <span className="block truncate text-sm font-semibold text-slate-900">{template.templateName}</span>
                          <span className="block truncate text-xs text-slate-500">{template.sourceDocumentName || template.id}</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label={`${template.templateName} 삭제`}
                          title="템플릿 삭제"
                          onClick={() =>
                            onDeleteTemplate({
                              id: template.id,
                              label: template.templateName,
                              meta: template.sourceDocumentName || template.id,
                              keywords: [template.sourceDocumentName || '', template.layoutResizeMode],
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">저장된 템플릿이 없습니다.</div>
              )}
            </div>
          ) : (
            <EntityPicker
              value={selectedTemplateId}
              options={templateOptions}
              onChange={onSelectTemplate}
              placeholder="편집할 템플릿을 선택하세요"
              emptyMessage="저장된 템플릿이 없습니다."
              optionLayout="inline"
              onDeleteOption={onDeleteTemplate}
              deleteOptionLabel="템플릿 삭제"
              className="w-full"
              triggerClassName="h-11 min-h-11 items-center rounded-md py-2"
            />
          )}
        </div>
        ) : null}

        {showFieldGrid ? (
        <div className="grid grid-cols-2 gap-4">
          {showTemplateNameInput ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">템플릿 이름</label>
            <Input value={templateName} onChange={(event) => onTemplateNameChange(event.target.value)} />
          </div>
          ) : null}
          {showLayoutResizeModeSelect ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">레이아웃 확장 정책</label>
            <select
              value={layoutResizeMode}
              onChange={(event) => onLayoutResizeModeChange(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="fixed">fixed</option>
              <option value="grow_height">grow_height</option>
              <option value="grow_width">grow_width</option>
            </select>
          </div>
          ) : null}
          {showSourceDocumentNameInput ? (
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-slate-800">원본 문서명</label>
            <Input value={sourceDocumentName} readOnly className="cursor-not-allowed bg-slate-50 text-slate-500" />
          </div>
          ) : null}
        </div>
        ) : null}

        {showSaveButton ? (
        <Button
          className="h-11 min-h-11 w-full"
          onClick={onSave}
          disabled={saving || loading || !renderedPreviewHtml.trim() || templateUsagePreviewMode}
        >
          {saving ? '저장 중...' : templateDetailTemplateId ? '현재 템플릿 저장' : '초안 저장'}
        </Button>
        ) : null}
      </CardContent>
    </Card>
  </div>
  );
};
