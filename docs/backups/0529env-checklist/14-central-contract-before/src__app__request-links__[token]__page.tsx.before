'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../../components/template/workspace/persistence/documentAttachmentClient';
import type {
  TemplateCanvasSelectablePolicy,
  TemplateCanvasSelectedBox,
  TemplateCanvasSelectionChangeOptions,
  TemplateChecklistSignatureState,
  TemplateChecklistSignatureSubmitParams,
  TemplateEditWorkspaceSaveDraftParams,
} from '../../../components/template/workspace/types';
import { CanvasOwnedWorkspace } from '../../canvas/ownerPolicy';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
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
import type { DocumentRequestTaskDto, DocumentRequestTaskStatus } from '../../../lib/documentDtos';
import type { RequestLinkPublicViewDto, RequestLinkScalarValue, RequestLinkSubmitResult } from '../../../lib/requestLinkDtos';

const normalizeRequestLinkSubmittedScalar = (
  rawValue: unknown,
  previousValue: unknown
): RequestLinkScalarValue => {
  if (rawValue === null) {
    return null;
  }

  if (typeof rawValue === 'boolean' || typeof rawValue === 'number') {
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

const getRequestTaskKindLabel = (kind: string) => {
  switch (kind) {
    case 'signature':
      return '서명 요청';
    case 'photo':
      return '필수 사진';
    case 'file':
      return '필수 파일';
    default:
      return '기록 값';
  }
};

const getRequestTaskStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return '완료';
    case 'submitted':
      return '제출';
    case 'revoked':
      return '폐기';
    case 'draft':
      return '준비';
    default:
      return '요청';
  }
};

const readTaskPayloadString = (task: DocumentRequestTaskDto, key: string) => {
  const value = task.payload?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readTaskPayloadStringArray = (task: DocumentRequestTaskDto, key: string) => {
  const value = task.payload?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
};

const getCanvasRoleFromRequestTask = (task: DocumentRequestTaskDto): TemplateCanvasSelectedBox['role'] => {
  if (task.kind === 'signature') {
    return 'signature';
  }

  if (task.kind === 'photo' || task.kind === 'file') {
    return 'attachment';
  }

  return 'value';
};

const buildCanvasSelectedBoxFromRequestTask = (
  task: DocumentRequestTaskDto,
  signerName: string | null | undefined
): TemplateCanvasSelectedBox => {
  const keyFrameGroupId = readTaskPayloadString(task, 'keyFrameGroupId');
  const valueFrameGroupId = readTaskPayloadString(task, 'valueFrameGroupId');
  const frameGroupId = task.frameGroupId || valueFrameGroupId || keyFrameGroupId || task.valueKey || task.targetKey;

  return {
    id: task.id,
    frameGroupId,
    role: getCanvasRoleFromRequestTask(task),
    label: task.targetLabel || task.targetKey,
    valueKey: task.valueKey || undefined,
    slotKey: task.slotKey || task.valueKey || task.targetKey,
    contextKey: readTaskPayloadString(task, 'contextKey') || undefined,
    keyFrameGroupId: keyFrameGroupId || undefined,
    valueFrameGroupId: valueFrameGroupId || undefined,
    highlightFrameGroupIds: [keyFrameGroupId, valueFrameGroupId, task.frameGroupId || ''].filter(Boolean),
    requestKind: task.kind === 'signature' ? 'signature' : task.kind === 'photo' ? 'photo' : task.kind === 'file' ? 'file' : 'value',
    requestId: task.linkedExternalId || undefined,
    signerName: signerName || undefined,
  };
};

const getTaskStatusVariant = (status: DocumentRequestTaskStatus) => {
  switch (status) {
    case 'completed':
      return 'green' as const;
    case 'submitted':
    case 'requested':
    case 'draft':
      return 'amber' as const;
    case 'revoked':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

export default function RequestLinkTokenPage() {
  const params = useParams<{ token: string }>();
  const [token, setToken] = React.useState('');
  const [requestLink, setRequestLink] = React.useState<RequestLinkPublicViewDto | null>(null);
  const [submittedBy, setSubmittedBy] = React.useState('request-link-user');
  const [submitResult, setSubmitResult] = React.useState<RequestLinkSubmitResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeTaskId, setActiveTaskId] = React.useState('');
  const [taskBusyById, setTaskBusyById] = React.useState<Record<string, boolean>>({});
  const [taskMessageById, setTaskMessageById] = React.useState<Record<string, string>>({});

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

  const requestTasks = React.useMemo(() => requestLink?.requestTasks || [], [requestLink]);

  React.useEffect(() => {
    if (activeTaskId && !requestTasks.some((task) => task.id === activeTaskId)) {
      setActiveTaskId('');
    }
  }, [activeTaskId, requestTasks]);

  const canvasSelectablePolicy = React.useMemo<TemplateCanvasSelectablePolicy>(() => ({
    selectableFrameGroupIds: Array.from(
      new Set(
        requestTasks
          .flatMap((task) => [
            task.frameGroupId || '',
            task.valueKey || '',
            readTaskPayloadString(task, 'keyFrameGroupId'),
            readTaskPayloadString(task, 'valueFrameGroupId'),
          ])
          .map((value) => value.trim())
          .filter(Boolean)
      )
    ),
  }), [requestTasks]);

  const activeTaskCanvasBox = React.useMemo<TemplateCanvasSelectedBox | null>(() => {
    const task = requestTasks.find((item) => item.id === activeTaskId) || null;
    return task ? buildCanvasSelectedBoxFromRequestTask(task, requestLink?.recipientName) : null;
  }, [activeTaskId, requestLink?.recipientName, requestTasks]);

  const selectedCanvasBoxes = React.useMemo(
    () => (activeTaskCanvasBox ? [activeTaskCanvasBox] : []),
    [activeTaskCanvasBox]
  );

  const handleCanvasSelectionChange = React.useCallback(
    (boxes: TemplateCanvasSelectedBox[], options?: TemplateCanvasSelectionChangeOptions) => {
      if (options?.source === 'clear' || boxes.length <= 0) {
        setActiveTaskId('');
        return;
      }

      const box = boxes[boxes.length - 1];
      const tokens = new Set(
        [
          box.id,
          box.valueKey,
          box.slotKey,
          box.frameGroupId,
          box.keyFrameGroupId,
          box.valueFrameGroupId,
          box.contextKey,
          ...(box.highlightFrameGroupIds || []),
        ]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
      );
      const matchedTask =
        requestTasks.find((task) => tokens.has(task.id)) ||
        requestTasks.find((task) =>
          [
            task.valueKey || '',
            task.slotKey || '',
            task.frameGroupId || '',
            readTaskPayloadString(task, 'keyFrameGroupId'),
            readTaskPayloadString(task, 'valueFrameGroupId'),
            readTaskPayloadString(task, 'contextKey'),
          ].some((value) => value && tokens.has(value))
        ) ||
        null;

      if (matchedTask) {
        setActiveTaskId(matchedTask.id);
      }
    },
    [requestTasks]
  );

  const canvasSignatureStates = React.useMemo<TemplateChecklistSignatureState[]>(
    () =>
      requestTasks
        .filter((task) => task.kind === 'signature')
        .map((task) => ({
          slotKey: task.slotKey || task.valueKey || task.targetKey,
          imageData: readTaskPayloadString(task, 'signatureImageData'),
          signerName: readTaskPayloadString(task, 'signatureSignerName') || requestLink?.recipientName || null,
          signedAt: readTaskPayloadString(task, 'signatureSignedAt') || null,
          provider: readTaskPayloadString(task, 'signatureProvider') || null,
        }))
        .filter((state) => Boolean(state.slotKey && state.imageData)),
    [requestLink?.recipientName, requestTasks]
  );

  const setTaskBusy = React.useCallback((taskId: string, busy: boolean) => {
    setTaskBusyById((current) => ({ ...current, [taskId]: busy }));
  }, []);

  const setTaskMessage = React.useCallback((taskId: string, nextMessage: string) => {
    setTaskMessageById((current) => ({ ...current, [taskId]: nextMessage }));
  }, []);

  const updateRequestTask = React.useCallback(
    async (
      task: DocumentRequestTaskDto,
      params: {
        status?: DocumentRequestTaskStatus;
        payload?: Record<string, unknown>;
        linkedExternalId?: string | null;
      }
    ) => {
      const response = await fetch(
        `/api/request-links/${encodeURIComponent(token)}/tasks/${encodeURIComponent(task.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '요청 작업 상태 갱신에 실패했습니다.');
      }

      return result.data as DocumentRequestTaskDto;
    },
    [token]
  );

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

      await Promise.all(
        requestLink.requestTasks
          .filter((task) => task.kind === 'value' || task.kind === 'file')
          .map((task) =>
            updateRequestTask(task, {
              status: 'submitted',
              payload: {
                ...task.payload,
                submittedAt: new Date().toISOString(),
                submittedBy,
              },
            })
          )
      );

      setSubmitResult(result.data);
      await loadRequestLink(token);

      return {
        successMessage: `제한 입력 제출 완료: ${result.data.updatedLabels.length}개 라벨을 반영했습니다.`,
      };
    },
    [labelValues, loadRequestLink, requestLink, submittedBy, token, updateRequestTask]
  );

  const handlePhotoTaskFiles = React.useCallback(
    async (task: DocumentRequestTaskDto, fileList: FileList | null) => {
      if (!requestLink) {
        return;
      }

      const files = Array.from(fileList || []);

      if (files.length === 0) {
        return;
      }

      if (requestLink.status !== 'active') {
        setTaskMessage(task.id, '현재 이 요청 링크는 사진을 등록할 수 없습니다.');
        return;
      }

      const labelKey = task.targetKey || task.valueKey || task.targetLabel;
      const uploadedPhotoIds: string[] = [];

      setActiveTaskId(task.id);
      setTaskBusy(task.id, true);
      setTaskMessage(task.id, '사진을 등록하는 중입니다.');

      try {
        for (const file of files) {
          const formData = new FormData();
          formData.set('siteId', requestLink.documentSummary.siteId);
          formData.set('photoTitle', `${task.targetLabel || labelKey} · ${file.name}`);
          formData.append('file', file);

          const uploadResponse = await fetch('/api/photos/upload', {
            method: 'POST',
            body: formData,
          });
          const uploadResult = await uploadResponse.json();

          if (!uploadResponse.ok || !uploadResult?.success) {
            throw new Error(uploadResult?.message || '필수 사진 등록에 실패했습니다.');
          }

          const photoId = String(uploadResult?.data?.photo?.id || '').trim();

          if (photoId) {
            uploadedPhotoIds.push(photoId);
          }

          if (photoId && labelKey) {
            const labelResponse = await fetch('/api/photos/labels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                photoId,
                manualLabels: [
                  {
                    labelKey,
                    note: '요청 링크 필수 사진',
                  },
                ],
              }),
            });
            const labelResult = await labelResponse.json();

            if (!labelResponse.ok || !labelResult?.success) {
              throw new Error(labelResult?.message || '사진 태그 등록에 실패했습니다.');
            }
          }
        }

        await updateRequestTask(task, {
          status: 'completed',
          payload: {
            ...task.payload,
            uploadedPhotoIds: [...readTaskPayloadStringArray(task, 'uploadedPhotoIds'), ...uploadedPhotoIds],
            photoSubmittedAt: new Date().toISOString(),
            photoSubmittedBy: submittedBy,
          },
        });
        setTaskMessage(task.id, `${uploadedPhotoIds.length || files.length}개 사진을 등록했습니다.`);
        await loadRequestLink(token);
      } catch (error) {
        setTaskMessage(task.id, error instanceof Error ? error.message : '필수 사진 등록에 실패했습니다.');
      } finally {
        setTaskBusy(task.id, false);
      }
    },
    [loadRequestLink, requestLink, setTaskBusy, setTaskMessage, submittedBy, token, updateRequestTask]
  );

  const handleCanvasSignatureSubmit = React.useCallback(
    async ({ target, imageData }: TemplateChecklistSignatureSubmitParams) => {
      if (!requestLink || !initialDraft) {
        throw new Error('서명할 문서 본문을 찾지 못했습니다.');
      }

      const task =
        requestLink.requestTasks.find((item) => item.id === target.id) ||
        requestLink.requestTasks.find((item) => item.linkedExternalId && item.linkedExternalId === target.requestId) ||
        null;
      const requestId = target.requestId || task?.linkedExternalId || '';

      if (!task || !requestId) {
        throw new Error('서명 요청 ID를 확인하지 못했습니다.');
      }

      setTaskBusy(task.id, true);
      setTaskMessage(task.id, '서명을 등록하는 중입니다.');

      try {
        const response = await fetch('/api/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'EXECUTE',
            requestId,
            documentContent: initialDraft.draftHtml,
            signatureImagePath: imageData,
            allowDocumentHashMismatch: true,
          }),
        });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || '서명 등록에 실패했습니다.');
        }

        await updateRequestTask(task, {
          status: 'completed',
          payload: {
            ...task.payload,
            signatureImageData: imageData,
            signatureSignedAt: new Date().toISOString(),
            signatureSignerName: requestLink.recipientName || submittedBy,
            signatureProvider: 'request-link',
          },
        });
        setTaskMessage(task.id, '서명을 등록했습니다.');
        await loadRequestLink(token);
      } catch (error) {
        setTaskMessage(task.id, error instanceof Error ? error.message : '서명 등록에 실패했습니다.');
        throw error;
      } finally {
        setTaskBusy(task.id, false);
      }
    },
    [initialDraft, loadRequestLink, requestLink, setTaskBusy, setTaskMessage, submittedBy, token, updateRequestTask]
  );

  const requestLinkEditable = requestLink?.status === 'active';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="space-y-2">
        <Badge variant="slate">REQ-LINK-02</Badge>
        <h1 className="text-3xl font-semibold text-slate-950">제한 입력 요청 링크</h1>
        <p className="text-sm text-slate-600">
          허용된 항목만 기록할 수 있는 문서 화면입니다. 활성 링크는 기록할 수 있고, 제출되었거나 만료된 링크는 읽기 전용으로 확인만 가능합니다.
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
                editableValueKeys={requestLinkEditable ? requestLink?.allowedLabels || [] : null}
                hidePersistencePanel
                suppressInitialDraftLoadedMessage
                templateNameReadOnly
                saveDisabled={!requestLinkEditable || loading}
                documentAttachmentApiPath={requestLink ? `/api/request-links/${encodeURIComponent(token)}/attachments` : ''}
                onSaveDraftHtml={requestLinkEditable ? handleSaveDraft : undefined}
                canvasSelectablePolicy={canvasSelectablePolicy}
                selectedCanvasBoxes={selectedCanvasBoxes}
                onCanvasSelectionChange={handleCanvasSelectionChange}
                canvasSignatureStates={canvasSignatureStates}
                onCanvasSignatureSubmit={handleCanvasSignatureSubmit}
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
              {requestLink?.requestTasks.length ? (
                <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">요청된 작업</p>
                  {requestLink.requestTasks.map((task) => {
                    const active = task.id === activeTaskId;
                    const busy = Boolean(taskBusyById[task.id]);
                    const canEditTask = requestLinkEditable && requestLink.status === 'active';

                    return (
                      <div
                        key={task.id}
                        className={[
                          'space-y-3 rounded-lg border bg-white p-3',
                          active ? 'border-slate-800' : 'border-slate-200',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveTaskId(task.id)}
                          className="w-full text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <Badge variant="slate">{getRequestTaskKindLabel(task.kind)}</Badge>
                            <Badge variant={getTaskStatusVariant(task.status)}>{getRequestTaskStatusLabel(task.status)}</Badge>
                          </div>
                          <p className="mt-2 font-medium text-slate-900">{task.targetLabel}</p>
                        </button>

                        {task.kind === 'photo' ? (
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={!canEditTask || busy}
                              onChange={(event) => {
                                void handlePhotoTaskFiles(task, event.currentTarget.files);
                                event.currentTarget.value = '';
                              }}
                            />
                          </div>
                        ) : null}

                        {task.kind === 'signature' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTaskId(task.id)}
                            disabled={!canEditTask || busy || !task.linkedExternalId}
                          >
                            서명 위치 선택
                          </Button>
                        ) : null}

                        {task.kind === 'value' || task.kind === 'file' ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => setActiveTaskId(task.id)}>
                            위치 보기
                          </Button>
                        ) : null}

                        {taskMessageById[task.id] ? (
                          <p className="text-xs text-slate-500">{taskMessageById[task.id]}</p>
                        ) : null}
                        {task.kind === 'signature' && !task.linkedExternalId ? (
                          <p className="text-xs text-red-600">연결된 서명 요청이 없습니다.</p>
                        ) : null}
                      </div>
                    );
                  })}
                  {activeTaskCanvasBox?.requestKind === 'signature' ? (
                    <p className="text-xs text-slate-500">강조된 서명 상자를 선택하면 서명판이 열립니다.</p>
                  ) : null}
                  {activeTaskCanvasBox && activeTaskCanvasBox.requestKind !== 'signature' ? (
                    <p className="text-xs text-slate-500">강조된 상자에서 값을 입력하거나 파일을 등록합니다.</p>
                  ) : null}
                </div>
              ) : null}
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
                  disabled={!requestLinkEditable}
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
