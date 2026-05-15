'use client';

import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { X } from 'lucide-react';
import TemplateEditWorkspace, {
  type TemplateEditWorkspaceInitialDraft,
} from '../../components/template/TemplateEditWorkspace';
import { Card, CardContent } from '../../components/ui/Card';
import { TemplateExtractWorkspace, type TemplateExtractWorkspaceStatus } from './extract/page';

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';
  const [extractedDraft, setExtractedDraft] = React.useState<TemplateEditWorkspaceInitialDraft | null>(null);
  const [extractStatus, setExtractStatus] = React.useState<TemplateExtractWorkspaceStatus | null>(null);
  const [extractStatusResetKey, setExtractStatusResetKey] = React.useState(0);

  const topNotice = extractStatus ? (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {extractStatus.kind === 'approve' ? (
              <>
                <p className="font-medium text-slate-950">저장 완료</p>
                <p>템플릿 ID: {extractStatus.templateId}</p>
                <a
                  href={`/templates/edit?templateId=${extractStatus.templateId}`}
                  className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  저장된 템플릿 편집하기
                </a>
              </>
            ) : (
              <p>{extractStatus.message}</p>
            )}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="알림 닫기"
            title="알림 닫기"
            onClick={() => {
              setExtractStatus(null);
              setExtractStatusResetKey((previous) => previous + 1);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-6 py-6">
        <TemplateEditWorkspace
          initialTemplateId={templateIdFromQuery}
          initialDraft={extractedDraft}
          templateListDisplay="inline"
          onTemplateSaved={() => setExtractedDraft(null)}
          topNotice={topNotice}
          suppressInitialDraftLoadedMessage
          additionalControlPanels={
            <TemplateExtractWorkspace
              hideHeader
              showSaveControls={false}
              showPreview={false}
              showStatusSection={false}
              statusResetKey={extractStatusResetKey}
              onDraftReady={setExtractedDraft}
              onStatusChange={setExtractStatus}
            />
          }
        />
      </div>
    </main>
  );
}
