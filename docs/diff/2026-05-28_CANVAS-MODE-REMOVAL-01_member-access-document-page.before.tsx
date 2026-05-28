'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../../../components/template/workspace/persistence/documentAttachmentClient';
import type { TemplateEditWorkspaceSaveDraftParams } from '../../../../components/template/workspace/types';
import { CanvasOwnedWorkspace } from '../../../canvas/ownerPolicy';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { MemberAccessVerificationCard } from '../../MemberAccessVerificationCard';
import {
  extractDocumentCanvasLabelValuesFromHtml as extractDocumentLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
} from '../../../../lib/documentCanvasState';
import { buildDocumentHtmlContentKey } from '../../../../lib/documentCanvasHtml';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../../../lib/documentAttachmentValues';
import { formatMemberAccessErrorMessage } from '../../../../lib/memberAccessErrors';
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

const normalizePhoneNumber = (value: string | null | undefined) => String(value || '').replace(/[^0-9]/g, '').trim();

const normalizeSignatureKey = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const buildUrlWithPhoneNumber = (path: string, phoneNumber: string) => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    return path;
  }

  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('phoneNumber', normalizedPhoneNumber);

  return `${pathname}?${params.toString()}`;
};

type SignedSignatureDraft = {
  slotKey: string;
  imageData: string;
};

const readSignatureSlotKey = (element: Element) => {
  const readAttribute = (target: Element | null, attributeName: string) =>
    normalizeSignatureKey(target?.getAttribute(attributeName));
  const frameNode = element.closest(
    '[data-template-frame-parent-group], [data-template-frame-label], [data-template-frame-value-key]'
  );

  return (
    readAttribute(element, 'data-template-frame-parent-group') ||
    readAttribute(frameNode, 'data-template-frame-parent-group') ||
    readAttribute(element, 'data-template-usage-preview-field-key') ||
    readAttribute(element, 'data-template-frame-value-key') ||
    readAttribute(element, 'data-template-frame-label') ||
    readAttribute(frameNode, 'data-template-frame-value-key') ||
    readAttribute(frameNode, 'data-template-frame-label')
  );
};

const collectSignedSignatureDrafts = (html: string): SignedSignatureDraft[] => {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const draftsBySlotKey = new Map<string, SignedSignatureDraft>();

  document
    .querySelectorAll('[data-template-usage-preview-signature-status="signed"]')
    .forEach((element) => {
      const slotKey = readSignatureSlotKey(element);
      const imageData = normalizeSignatureKey(element.getAttribute('data-template-usage-preview-signature-image-data'));

      if (!slotKey || !imageData || draftsBySlotKey.has(slotKey)) {
        return;
      }

      draftsBySlotKey.set(slotKey, { slotKey, imageData });
    });

  return Array.from(draftsBySlotKey.values());
};

export default function MemberAccessDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const documentId = String(params?.documentId || '').trim();
  const searchParamsText = searchParams.toString();
  const urlPhoneNumber = normalizePhoneNumber(searchParams.get('phoneNumber') || searchParams.get('phone'));
  const [access, setAccess] = React.useState<MemberDocumentAccessDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const buildMemberDocumentApiPath = React.useCallback(
    (path: string) => buildUrlWithPhoneNumber(path, urlPhoneNumber),
    [urlPhoneNumber]
  );

  const loadAccess = React.useCallback(async () => {
    if (!documentId) {
      setMessage('문서 ID가 없습니다.');
      setNeedsVerification(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(buildMemberDocumentApiPath(`/api/member-access/documents/${encodeURIComponent(documentId)}`), {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        const errorMessage = result?.message || '문서 접근 정보를 불러오지 못했습니다.';

        setAccess(null);
        if (response.status === 401 || errorMessage.includes('인증') || (urlPhoneNumber && response.status === 403)) {
          setNeedsVerification(true);
          setMessage(null);
        } else {
          setNeedsVerification(false);
          setMessage(formatMemberAccessErrorMessage(errorMessage, '문서 접근 정보를 불러오지 못했습니다.'));
        }
        return;
      }

      const nextAccess = result.data as MemberDocumentAccessDto;
      const nextPhoneNumber = normalizePhoneNumber(nextAccess.member.phoneNumber);

      setAccess(nextAccess);
      if (!urlPhoneNumber && nextPhoneNumber) {
        const nextParams = new URLSearchParams(searchParamsText);
        nextParams.set('phoneNumber', nextPhoneNumber);
        window.location.replace(`/member-access/document/${encodeURIComponent(documentId)}?${nextParams.toString()}`);
        return;
      }
      setNeedsVerification(false);
      setMessage(null);
    } catch (error) {
      setAccess(null);
      setNeedsVerification(false);
      setMessage(formatMemberAccessErrorMessage(error, '문서 접근 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [buildMemberDocumentApiPath, documentId, searchParamsText, urlPhoneNumber]);

  React.useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  React.useEffect(() => {
    if (urlPhoneNumber) {
      setPhoneNumber(urlPhoneNumber);
    }
  }, [urlPhoneNumber]);

  const handleVerify = React.useCallback(async () => {
    const verificationPhoneNumber = urlPhoneNumber || phoneNumber.trim();

    if (!verificationPhoneNumber || !accessCode.trim()) {
      setMessage('휴대폰 번호와 인증번호를 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/member-access/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: verificationPhoneNumber,
          accessCode: accessCode.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '구성원 인증에 실패했습니다.');
      }

      setPhoneNumber('');
      setAccessCode('');
      setNeedsVerification(false);
      await loadAccess();
    } catch (error) {
      setMessage(formatMemberAccessErrorMessage(error, '구성원 인증에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, loadAccess, phoneNumber, urlPhoneNumber]);

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
  const editableValueKeys = React.useMemo(
    () => (access ? access.scopeAccess.editableValueKeys.map(normalizeSignatureKey).filter(Boolean) : []),
    [access]
  );
  const editableValueKeySet = React.useMemo(() => new Set(editableValueKeys), [editableValueKeys]);
  const canEditDocument = Boolean(access && editableValueKeys.length > 0);
  const currentMemberPhoneNumber = normalizePhoneNumber(access?.member.phoneNumber);
  const currentMemberName = normalizeSignatureKey(access?.member.displayName);
  const signableSignatureRequests = React.useMemo(() => {
    if (!access || editableValueKeySet.size <= 0) {
      return [];
    }

    return access.detail.signatureEvidence.filter((item) => {
      if (!item.requestId || item.status === 'completed' || item.status === 'expired' || item.status === 'failed') {
        return false;
      }

      const evidenceKeys = [item.slotKey, item.label, item.signerRoleName].map(normalizeSignatureKey).filter(Boolean);
      if (!evidenceKeys.some((key) => editableValueKeySet.has(key))) {
        return false;
      }

      const signerPhoneNumber = normalizePhoneNumber(item.signerPhoneNumber);
      const signerName = normalizeSignatureKey(item.signerName);

      if (signerPhoneNumber) {
        return signerPhoneNumber === currentMemberPhoneNumber;
      }

      return !signerName || !currentMemberName || signerName === currentMemberName;
    });
  }, [access, currentMemberName, currentMemberPhoneNumber, editableValueKeySet]);
  const signerEditableValueKeys = React.useMemo(
    () =>
      Array.from(
        new Set(
          signableSignatureRequests
            .flatMap((item) => [item.slotKey, item.label, item.signerRoleName])
            .map(normalizeSignatureKey)
            .filter(Boolean)
        )
      ),
    [signableSignatureRequests]
  );
  const canSignDocument = Boolean(access && signerEditableValueKeys.length > 0);
  const canUseDocumentWorkspace = canEditDocument || canSignDocument;

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
      if (!access || !canUseDocumentWorkspace) {
        throw new Error('이 문서는 수정 가능한 scope이 없습니다.');
      }

      const signedDrafts = collectSignedSignatureDrafts(currentHtml);
      const pendingRequestByKey = new Map(
        signableSignatureRequests.flatMap((request) =>
          [request.slotKey, request.label, request.signerRoleName]
            .map(normalizeSignatureKey)
            .filter(Boolean)
            .map((key) => [key, request] as const)
        )
      );
      const uniqueSignableRequestKeys = new Set(
        signableSignatureRequests.map((request) => normalizeSignatureKey(request.slotKey || request.label)).filter(Boolean)
      );
      const fallbackSignatureRequest =
        signableSignatureRequests.length === 1 || uniqueSignableRequestKeys.size === 1
          ? signableSignatureRequests[0] || null
          : null;
      const signatureExecutionByRequestId = new Map<
        string,
        { draft: SignedSignatureDraft; request: (typeof signableSignatureRequests)[number] }
      >();

      signedDrafts.forEach((draft) => {
        const request = pendingRequestByKey.get(normalizeSignatureKey(draft.slotKey)) || fallbackSignatureRequest;
        const requestId = String(request?.requestId || '').trim();

        if (!request || !requestId || signatureExecutionByRequestId.has(requestId)) {
          return;
        }

        signatureExecutionByRequestId.set(requestId, { draft, request });
      });

      const signatureExecutions = Array.from(signatureExecutionByRequestId.values());

      if (canSignDocument && !canEditDocument && signatureExecutions.length === 0) {
        throw new Error('완료할 서명 요청을 찾지 못했습니다. 배정된 서명 상자에 서명한 뒤 다시 저장해 주세요.');
      }

      if (signatureExecutions.length > 0) {
        await Promise.all(
          signatureExecutions.map(async ({ draft, request }) => {
            const response = await fetch(
              buildMemberDocumentApiPath(
                `/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/signatures`
              ),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requestId: request.requestId,
                  signatureImagePath: draft.imageData,
                  consentText: `${access.member.displayName || access.member.phoneNumber}님이 ${access.detail.document.title} 문서의 ${request.label || '서명'} 항목에 서명했습니다.`,
                }),
              }
            );
            const result = await response.json();

            if (!response.ok || !result?.success) {
              throw new Error(result?.message || '서명 완료 처리에 실패했습니다.');
            }
          })
        );
      }

      if (canSignDocument && !canEditDocument) {
        await loadAccess();

        return {
          successMessage: '서명을 완료했습니다.',
        };
      }

      const nextLabelValues = extractDocumentLabelValuesFromHtml(currentHtml, labelValues);
      const nextValueFiles = await buildDocumentAttachmentValueFilesForSave({
        attachmentApiPath: buildMemberDocumentApiPath(
          `/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/attachments`
        ),
        attachmentDrafts,
      });
      const persistedHtml = materializeTemplateCanvasHtmlForPersistence(currentHtml, {
        attachmentFiles: nextValueFiles,
      });
      const response = await fetch(
        buildMemberDocumentApiPath(`/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/version`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlCanonical: persistedHtml,
            labelValues: nextLabelValues,
            valueFiles: nextValueFiles,
            changeReason: '구성원 문서 수정',
          }),
        }
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '문서 저장에 실패했습니다.');
      }

      await loadAccess();

      return {
        successMessage: '문서를 저장했습니다.',
      };
    },
    [
      access,
      buildMemberDocumentApiPath,
      canEditDocument,
      canSignDocument,
      canUseDocumentWorkspace,
      labelValues,
      loadAccess,
      signableSignatureRequests,
    ]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/member-access/document">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        {access ? (
          <>
            <span
              className="inline-flex h-6 items-center rounded-full border border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-800"
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              {editableValueKeys.length > 0 ? `scope ${access.scopeAccess.editableScopeKeys.length}개` : '열람 가능'}
            </span>
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
      ) : needsVerification ? (
        <MemberAccessVerificationCard
          title="번호 인증"
          description="문서에 접근하려면 초대받은 휴대폰 번호와 인증번호를 입력해 주세요."
          phoneNumber={phoneNumber}
          accessCode={accessCode}
          submitting={submitting}
          onPhoneNumberChange={setPhoneNumber}
          onAccessCodeChange={setAccessCode}
          onSubmit={handleVerify}
        />
      ) : access && initialDraft ? (
        <CanvasOwnedWorkspace
          surface="member-access"
          key={initialDraft.draftKey}
          initialDraft={initialDraft}
          workspaceMode={canUseDocumentWorkspace ? 'document' : 'read'}
          hidePersistencePanel
          headerTitle="구성원 문서 접근"
          headerDescription="멤버 소속과 scope 배정 범위 안에서 현장 문서를 열람하거나 수정합니다."
          nameFieldLabel="문서 이름:"
          saveButtonLabel={canEditDocument ? '문서 저장' : canSignDocument ? '서명 완료' : '열람 전용'}
          templateNameReadOnly
          saveDisabled={!canUseDocumentWorkspace}
          editableValueKeys={canUseDocumentWorkspace ? editableValueKeys : undefined}
          documentAttachmentApiPath={
            canEditDocument
              ? buildMemberDocumentApiPath(
                  `/api/member-access/documents/${encodeURIComponent(access.detail.document.id)}/attachments`
                )
              : undefined
          }
          onSaveDraftHtml={canUseDocumentWorkspace ? handleSaveDraft : undefined}
        />
      ) : (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문서를 열 수 없습니다.</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            접근 소속 또는 문서 본문 상태를 먼저 확인해 주세요.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
