'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../../components/template/workspace/persistence/documentAttachmentClient';
import type { TemplateEditWorkspaceSaveDraftParams } from '../../../components/template/workspace/types';
import { CanvasOwnedWorkspace } from '../../canvas/ownerPolicy';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { buildDocumentHtmlContentKey } from '../../../lib/documentCanvasHtml';
import {
  extractDocumentCanvasLabelValuesFromHtml as extractDocumentLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
  stringifyDocumentValue,
} from '../../../lib/documentCanvasState';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../../lib/documentAttachmentValues';
import type { RequestLinkPublicViewDto, RequestLinkScalarValue, RequestLinkSubmitResult } from '../../../lib/requestLinkDtos';

const normalizeRequestLinkSubmittedScalar = (
  rawValue: unknown,
  previousValue: unknown
): RequestLinkScalarValue => {
  if (typeof rawValue === 'boolean' || typeof rawValue === 'number' || rawValue === null) {
    return rawValue;
  }

  const stringValue = typeof rawValue === 'string' ? rawValue : stringifyDocumentValue(rawValue);

  if (typeof previousValue === 'number') {
    const parsed = Number(stringValue);
    return Number.isFinite(parsed) ? parsed : stringValue;
  }

  if (typeof previousValue === 'boolean') {
    const normalized = stringValue.trim().toLowerCase();
    if (['true', '1', 'y', 'yes', '예'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'n', 'no', '아니오'].includes(normalized)) {
      return false;
    }
  }

  if (previousValue === null && !stringValue.trim()) {
    return null;
  }

  return stringValue;
};

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

export default function RequestLinkTokenPage() {
  const params = useParams<{ token: string }>();
  const [token, setToken] = React.useState('');
  const [requestLink, setRequestLink] = React.useState<RequestLinkPublicViewDto | null>(null);
  const [submittedBy, setSubmittedBy] = React.useState('request-link-user');
  const [submitResult, setSubmitResult] = React.useState<RequestLinkSubmitResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setToken(params?.token || '');
  }, [params]);

  const loadRequestLink = React.useCallback(async (nextToken: string) => {
    if (!nextToken) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/request-links/${encodeURIComponent(nextToken)}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '요청 링크 조회에 실패했습니다.');
      }

      setRequestLink(result.data);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '요청 링크 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (token) {
      void loadRequestLink(token);
    }
  }, [loadRequestLink, token]);

  const attachmentFilesByValueKey = React.useMemo(
    () => groupDocumentValueFilesByValueKey(requestLink?.documentSummary.valueFiles || []),
    [requestLink]
  );

  const labelValues = React.useMemo(() => {
    if (!requestLink) {
      return {};
    }

    return {
      ...mergeDocumentCanvasLabelValues(
        requestLink.documentSummary.labelValues || {},
        requestLink.documentSummary.valueEntries
      ),
      ...buildDocumentAttachmentTextByValueKey(requestLink.documentSummary.valueFiles || []),
    };
  }, [requestLink]);

  const initialDraft = React.useMemo<TemplateEditWorkspaceInitialDraft | null>(() => {
    if (!requestLink) {
      return null;
    }

    const html = materializeDocumentHtml({
      linkedRenderHtml:
        requestLink.documentSummary.linkedTemplate?.draftHtml ||
        requestLink.documentSummary.linkedTemplate?.renderSnapshotHtml,
      latestVersionHtml: requestLink.documentSummary.latestVersionHtml,
      labelValues,
    });

    if (!html.trim()) {
      return null;
    }

    return {
      draftKey: `request-link:${requestLink.requestLinkId}:${requestLink.documentSummary.documentId}:${requestLink.documentSummary.currentVersionNumber || 0}:${buildDocumentHtmlContentKey(html)}`,
      templateName: requestLink.documentSummary.title,
      draftHtml: html,
      sourceDocumentName: '',
      layoutResizeMode: 'grow_height',
      attachmentFilesByValueKey,
    };
  }, [attachmentFilesByValueKey, labelValues, requestLink]);

  const handleSaveDraft = React.useCallback(
    async ({ currentHtml, attachmentDrafts }: TemplateEditWorkspaceSaveDraftParams) => {
      if (!requestLink) {
        throw new Error('요청 링크 정보를 먼저 불러와 주세요.');
      }

      if (requestLink.status !== 'active') {
        throw new Error('현재 이 요청 링크는 더 이상 기록을 수정할 수 없습니다.');
      }

      const allowedLabelSet = new Set(requestLink.allowedLabels);
      const nextLabelValues = extractDocumentLabelValuesFromHtml(currentHtml, labelValues);
      const submittedLabelValues = requestLink.allowedLabels.reduce<Record<string, RequestLinkScalarValue>>((accumulator, labelKey) => {
        accumulator[labelKey] = normalizeRequestLinkSubmittedScalar(
          nextLabelValues[labelKey],
          requestLink.documentSummary.labelValues[labelKey]
        );
        return accumulator;
      }, {});

      const nextValueFiles = await buildDocumentAttachmentValueFilesForSave({
        attachmentApiPath: `/api/request-links/${encodeURIComponent(token)}/attachments`,
        attachmentDrafts: attachmentDrafts.filter((draft) => allowedLabelSet.has(draft.valueKey)),
      });
      const persistedHtml = materializeTemplateCanvasHtmlForPersistence(currentHtml, {
        attachmentFiles: nextValueFiles,
      });

      const response = await fetch(`/api/request-links/${encodeURIComponent(token)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labelValues: submittedLabelValues,
          htmlCanonical: persistedHtml,
          valueFiles: nextValueFiles,
          submittedBy,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '요청 링크 제출에 실패했습니다.');
      }

      setSubmitResult(result.data);
      await loadRequestLink(token);

      return {
        successMessage: `제한 입력 제출 완료: ${result.data.updatedLabels.length}개 라벨을 반영했습니다.`,
      };
    },
    [labelValues, loadRequestLink, requestLink, submittedBy, token]
  );

  const workspaceMode = requestLink?.status === 'active' ? 'document' : 'read';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="space-y-2">
        <Badge variant="slate">REQ-LINK-02</Badge>
        <h1 className="text-3xl font-semibold text-slate-950">제한 입력 요청 링크</h1>
        <p className="text-sm text-slate-600">
          허용된 항목만 기록할 수 있는 문서 화면입니다. 활성 링크는 문서 모드로 기록할 수 있고, 제출되었거나 만료된 링크는 읽기 전용으로 확인만 가능합니다.
        </p>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문서</CardTitle>
            <CardDescription>
              {requestLink?.status === 'active'
                ? '허용된 항목만 입력할 수 있습니다.'
                : '이 링크는 더 이상 수정할 수 없어 읽기 전용으로 표시됩니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {initialDraft ? (
              <CanvasOwnedWorkspace
                surface="request-links"
                initialDraft={initialDraft}
                workspaceMode={workspaceMode}
                editableValueKeys={workspaceMode === 'document' ? requestLink?.allowedLabels || [] : null}
                hidePersistencePanel
                suppressInitialDraftLoadedMessage
                templateNameReadOnly
                saveDisabled={workspaceMode !== 'document' || loading}
                documentAttachmentApiPath={requestLink ? `/api/request-links/${encodeURIComponent(token)}/attachments` : ''}
                onSaveDraftHtml={workspaceMode === 'document' ? handleSaveDraft : undefined}
                headerTitle="상자 편집 캔버스"
                headerDescription="요청 링크에서 허용된 항목만 기록할 수 있습니다."
                saveButtonLabel="문서 저장"
              />
            ) : (
              <div className="px-6 py-10 text-sm text-slate-500">
                {loading ? '문서를 불러오는 중입니다.' : '출력할 문서를 찾지 못했습니다.'}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>링크 요약</CardTitle>
              <CardDescription>현재 링크 상태와 문서 기본 정보를 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {requestLink ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant={requestLink.status === 'active' ? 'green' : 'amber'}>{requestLink.status}</Badge>
                    <span className="font-medium text-slate-900">{requestLink.documentSummary.title}</span>
                  </div>
                  <p>문서 ID: {requestLink.documentSummary.documentId}</p>
                  <p>문서 종류: {requestLink.documentSummary.documentTypeKey}</p>
                  <p>현장 ID: {requestLink.documentSummary.siteId}</p>
                  <p>현재 버전: {requestLink.documentSummary.currentVersionNumber || '-'}</p>
                  <p>수신자: {requestLink.recipientName || '-'}</p>
                  <p>만료 시각: {formatDateTime(requestLink.expiresAt)}</p>
                  <p>1회성: {requestLink.oneTimeUse ? '예' : '아니오'}</p>
                </>
              ) : (
                <p className="text-slate-500">링크 정보를 불러오는 중입니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>허용된 항목</CardTitle>
              <CardDescription>이 링크에서 수정할 수 있는 값만 표시됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              {requestLink?.allowedLabels.length ? (
                requestLink.allowedLabels.map((label) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="font-medium text-slate-900">{label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      현재 값: {stringifyDocumentValue(requestLink.documentSummary.allowedLabelValues[label]) || '-'}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">허용된 항목이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>제출자 정보</CardTitle>
              <CardDescription>감사 로그에 남길 제출자 식별자를 입력합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">제출자</label>
                <Input
                  value={submittedBy}
                  onChange={(event) => setSubmittedBy(event.target.value)}
                  disabled={workspaceMode !== 'document'}
                />
              </div>
              {submitResult ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p>요청 링크 ID: {submitResult.requestLinkId}</p>
                  <p>반영 라벨 수: {submitResult.updatedLabels.length}</p>
                  <p>새 버전 ID: {submitResult.updatedVersionId}</p>
                  <p>감사 로그 ID: {submitResult.auditLog.id}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
