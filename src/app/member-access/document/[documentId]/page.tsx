'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../../../components/template/workspace/persistence/documentAttachmentClient';
import type { TemplateEditWorkspaceSaveDraftParams } from '../../../../components/template/workspace/types';
import { CanvasOwnedWorkspace } from '../../../canvas/ownerPolicy';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/Card';
import {
  extractDocumentCanvasLabelValuesFromHtml as extractDocumentLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
  stringifyDocumentValue,
} from '../../../../lib/documentCanvasState';
import type { DocumentDetailResult } from '../../../../lib/documentDtos';
import { buildDocumentHtmlContentKey } from '../../../../lib/documentCanvasHtml';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../../../lib/documentAttachmentValues';
import type { MemberDocumentAccessDto } from '../../../../lib/memberAccessDtos';

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const getRoleLabel = (role: MemberDocumentAccessDto['accessRole']) => {
  switch (role) {
    case 'editor':
      return '편집 가능';
    case 'signer':
      return '서명 가능';
    case 'viewer':
    default:
      return '열람 가능';
  }
};

export default function MemberAccessDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = String(params?.documentId || '').trim();
  const [access, setAccess] = React.useState<MemberDocumentAccessDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadAccess = React.useCallback(async () => {
    if (!documentId) {
      setMessage('문서 ID가 없습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/member-access/documents/${encodeURIComponent(documentId)}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '문서 접근 정보를 불러오지 못했습니다.');
      }

      setAccess(result.data as MemberDocumentAccessDto);
      setMessage(null);
    } catch (error) {
      setAccess(null);
      setMessage(error instanceof Error ? error.message : '문서 접근 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  React.useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const labelValues = React.useMemo<Record<string, unknown>>(() => {
    if (!access) {
      return {};
    }

    return {
      ...mergeDocumentCanvasLabelValues(access.detail.latestVersion?.labelValues || {}, access.detail.valueEntries),
      ...buildDocumentAttachmentTextByValueKey(access.detail.valueFiles),
    };
  }, [access]);

  const attachmentFilesByValueKey = React.useMemo(
    () => (access ? groupDocumentValueFilesByValueKey(access.detail.valueFiles) : {}),
    [access]
  );

  const initialDraft = React.useMemo<TemplateEditWorkspaceInitialDraft | null>(() => {
    if (!access) {
      return null;
    }

    const html = materializeDocumentHtml({
      linkedRenderHtml:
        access.detail.linkedTemplate?.draftHtml || access.detail.linkedTemplate?.renderSnapshotHtml,
      latestVersionHtml: access.detail.latestVersion?.htmlCanonical,
      labelValues,
    });

    if (!html.trim()) {
      return null;
    }

    return {
      draftKey: `${access.detail.document.id}:${access.detail.latestVersion?.id || access.detail.linkedTemplate?.resolvedRevisionId || 'draft'}:${buildDocumentHtmlContentKey(html)}`,
      templateName: access.detail.document.title,
      draftHtml: html,
      sourceDocumentName: '',
      layoutResizeMode: 'grow_height',
      attachmentFilesByValueKey,
    };
  }, [access, attachmentFilesByValueKey, labelValues]);

  const handleSaveDraft = React.useCallback(
    async ({ currentHtml, attachmentDrafts }: TemplateEditWorkspaceSaveDraftParams) => {
      if (!access || access.accessRole !== 'editor') {
        throw new Error('이 문서는 편집 권한이 없습니다.');
      }

      const nextLabelValues = extractDocumentLabelValuesFromHtml(currentHtml, labelValues);
      const nextValueFiles = await buildDocumentAttachmentValueFilesForSave({
        attachmentApiPath: `/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/attachments`,
        attachmentDrafts,
      });
      const persistedHtml = materializeTemplateCanvasHtmlForPersistence(currentHtml, {
        attachmentFiles: nextValueFiles,
      });
      const response = await fetch(`/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCanonical: persistedHtml,
          labelValues: nextLabelValues,
          valueFiles: nextValueFiles,
          changeReason: '구성원 문서 수정',
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '문서 저장에 실패했습니다.');
      }

      await loadAccess();

      return {
        successMessage: '문서를 저장했습니다.',
      };
    },
    [access, labelValues, loadAccess]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/member-access">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        {access ? (
          <>
            <Badge variant={access.accessRole === 'editor' ? 'green' : 'outline'}>
              <ShieldCheck className="mr-1 h-3 w-3" />
              {getRoleLabel(access.accessRole)}
            </Badge>
            <div className="text-sm text-slate-600">
              {access.detail.document.title} · 마지막 저장 {formatDateTime(access.detail.latestVersion?.createdAt)}
            </div>
          </>
        ) : null}
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-6 text-sm text-slate-600">문서 접근 정보를 불러오는 중입니다.</CardContent>
        </Card>
      ) : access && initialDraft ? (
        <CanvasOwnedWorkspace
          surface="member-access"
          key={initialDraft.draftKey}
          initialDraft={initialDraft}
          workspaceMode={access.accessRole === 'editor' ? 'document' : 'read'}
          hidePersistencePanel
          headerTitle="구성원 문서 접근"
          headerDescription="초대된 권한 범위 안에서 현장 문서를 열람하거나 수정합니다."
          nameFieldLabel="문서 이름:"
          saveButtonLabel={access.accessRole === 'editor' ? '문서 저장' : '열람 전용'}
          templateNameReadOnly
          saveDisabled={access.accessRole !== 'editor'}
          documentAttachmentApiPath={`/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/attachments`}
          onSaveDraftHtml={handleSaveDraft}
        />
      ) : (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문서를 열 수 없습니다.</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            접근 권한 또는 문서 본문 상태를 먼저 확인해 주세요.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
