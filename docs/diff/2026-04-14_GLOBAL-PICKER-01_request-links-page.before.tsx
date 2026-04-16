'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { DocumentListItem } from '../../lib/documentDtos';
import type {
  EmailSendResult,
  SmsRecipientRecordDto,
  SmsSendResult,
  SmsSettingsDto,
} from '../../lib/messagingDtos';
import type { RequestLinkCreateResult, RequestLinkRecordDto } from '../../lib/requestLinkDtos';

const defaultAllowedLabels = JSON.stringify(['manager_name'], null, 2);

type RecentRequestLinkListItem = {
  requestLink: RequestLinkRecordDto;
  documentTitle: string;
  documentTypeKey: string;
  siteId: string;
  maskedRecipientTarget: string;
};

export default function RequestLinksPage() {
  const [siteId, setSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState('');
  const [allowedLabelsText, setAllowedLabelsText] = React.useState(defaultAllowedLabels);
  const [recipientChannel, setRecipientChannel] = React.useState<'email' | 'sms'>('email');
  const [recipientTarget, setRecipientTarget] = React.useState('worker@example.com');
  const [recipientName, setRecipientName] = React.useState('현장 담당자');
  const [expiresAt, setExpiresAt] = React.useState('2026-04-19T18:00');
  const [oneTimeUse, setOneTimeUse] = React.useState(true);
  const [requestedBy, setRequestedBy] = React.useState('ops-demo-user');
  const [latestCreated, setLatestCreated] = React.useState<RequestLinkCreateResult | null>(null);
  const [recentRequestLinks, setRecentRequestLinks] = React.useState<RecentRequestLinkListItem[]>([]);
  const [selectedRequestLinkId, setSelectedRequestLinkId] = React.useState('');
  const [smsRecipients, setSmsRecipients] = React.useState<SmsRecipientRecordDto[]>([]);
  const [selectedSmsRecipientIds, setSelectedSmsRecipientIds] = React.useState<string[]>([]);
  const [smsSettings, setSmsSettings] = React.useState<SmsSettingsDto | null>(null);
  const [latestSmsDispatch, setLatestSmsDispatch] = React.useState<SmsSendResult | null>(null);
  const [latestEmailDispatch, setLatestEmailDispatch] = React.useState<EmailSendResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const selectedRecentRequestLink = React.useMemo(
    () => recentRequestLinks.find((item) => item.requestLink.id === selectedRequestLinkId) || null,
    [recentRequestLinks, selectedRequestLinkId]
  );
  const selectedDocumentSenderBinding = React.useMemo(
    () =>
      smsSettings?.documentSenderBindings.find(
        (item) => item.documentId === selectedRecentRequestLink?.requestLink.documentId
      ) || null,
    [smsSettings, selectedRecentRequestLink]
  );
  const selectedDocumentRecipientBinding = React.useMemo(
    () =>
      smsSettings?.documentRecipientBindings.find(
        (item) => item.documentId === selectedRecentRequestLink?.requestLink.documentId
      ) || null,
    [smsSettings, selectedRecentRequestLink]
  );

  const loadDocuments = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/documents?siteId=${encodeURIComponent(siteId)}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 목록 조회에 실패했습니다.');
      }

      const nextDocuments = result.data as DocumentListItem[];
      setDocuments(nextDocuments);
      setSelectedDocumentId((previous) => {
        if (previous && nextDocuments.some((item) => item.document.id === previous)) {
          return previous;
        }

        return nextDocuments[0]?.document.id || '';
      });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const loadRecentRequestLinks = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/request-links?siteId=${encodeURIComponent(siteId)}&limit=12`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '요청 링크 목록 조회 실패');
      }

      const items = result.data as RecentRequestLinkListItem[];
      setRecentRequestLinks(items);
      setSelectedRequestLinkId((previous) => {
        if (previous && items.some((item) => item.requestLink.id === previous)) {
          return previous;
        }

        return items[0]?.requestLink.id || '';
      });
    } catch {
      setRecentRequestLinks([]);
      setSelectedRequestLinkId('');
    }
  }, [siteId]);

  React.useEffect(() => {
    void loadRecentRequestLinks();
  }, [loadRecentRequestLinks]);

  const loadSmsSettings = React.useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/sms/settings', { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        const settings = result.data as SmsSettingsDto;
        setSmsSettings(settings);
      }
    } catch {
      // 설정 조회 실패는 발송 실행 전체를 막지 않습니다.
    }
  }, []);

  React.useEffect(() => {
    void loadSmsSettings();
  }, [loadSmsSettings]);

  const loadSmsRecipients = React.useCallback(async () => {
    try {
      const response = await fetch('/api/messaging/sms/recipients', { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        setSmsRecipients(result.data as SmsRecipientRecordDto[]);
        setSelectedSmsRecipientIds((previous) =>
          previous.filter((recipientId) => (result.data as SmsRecipientRecordDto[]).some((item) => item.id === recipientId))
        );
      }
    } catch {
      // 수신번호 목록 조회 실패는 페이지 전체를 막지 않습니다.
    }
  }, []);

  React.useEffect(() => {
    void loadSmsRecipients();
  }, [loadSmsRecipients]);

  React.useEffect(() => {
    const availableRecipientIds = new Set(smsRecipients.map((recipient) => recipient.id));
    const nextRecipientIds = (selectedDocumentRecipientBinding?.recipientIds || []).filter((recipientId) =>
      availableRecipientIds.has(recipientId)
    );
    setSelectedSmsRecipientIds(nextRecipientIds);
  }, [selectedDocumentRecipientBinding?.documentId, selectedDocumentRecipientBinding?.recipientIds, smsRecipients]);

  const handleCreate = async () => {
    if (!selectedDocumentId) {
      setMessage('요청 링크를 생성할 문서를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/request-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          allowedLabels: JSON.parse(allowedLabelsText),
          recipientChannel,
          recipientTarget,
          recipientName,
          expiresAt: new Date(expiresAt).toISOString(),
          oneTimeUse,
          requestedBy,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '요청 링크 생성에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setSelectedRequestLinkId(result.data.requestLink.id);
      await loadRecentRequestLinks();
      setMessage(`요청 링크 ${result.data.requestLink.id} 를 생성했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '요청 링크 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleSmsRecipientId = (recipientId: string) => {
    setSelectedSmsRecipientIds((previous) =>
      previous.includes(recipientId) ? previous.filter((item) => item !== recipientId) : [...previous, recipientId]
    );
  };

  const handleSendSms = async () => {
    if (!selectedRequestLinkId) {
      setMessage('먼저 요청 링크를 선택하거나 생성하세요.');
      return;
    }

    const senderIdToUse = selectedDocumentSenderBinding?.senderId || null;
    const hasGlobalDefaultSender = Boolean(smsSettings?.defaultSenderPhoneNumber);

    if (!senderIdToUse && !hasGlobalDefaultSender) {
      setMessage('기본 발신번호를 먼저 /messaging 에서 준비하세요.');
      return;
    }

    if (selectedSmsRecipientIds.length === 0) {
      setMessage('수신번호를 하나 이상 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const requestLinkResponse = await fetch(
        `/api/request-links?dispatchUrlFor=${encodeURIComponent(selectedRequestLinkId)}`,
        {
          cache: 'no-store',
        }
      );
      const requestLinkResult = await requestLinkResponse.json();

      if (!requestLinkResult.success) {
        throw new Error(requestLinkResult.message || '문자 발송용 요청 링크 URL 생성 실패');
      }

      const requestLinkUrl = `${window.location.origin}${requestLinkResult.data.maskedUrl}`;
      const prefix = (smsSettings?.messagePrefix || '').trim();
      const prefixText = prefix ? `${prefix} ` : '';
      const messageText = `${prefixText}요청 링크를 확인하세요. ${requestLinkUrl}`;

      const response = await fetch('/api/messaging/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestLinkId: selectedRequestLinkId,
          senderId: senderIdToUse,
          recipientIds: selectedSmsRecipientIds,
          requestedBy,
          messageText,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문자 발송 실패');
      }

      setLatestSmsDispatch(result.data);
      setMessage(
        `문자 발송 상태: ${result.data.dispatch.status} / 대상 ${result.data.dispatch.recipientCount}건 / 성공 ${result.data.dispatch.sentCount}건 / 실패 ${result.data.dispatch.failedCount}건`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문자 발송 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSmsStatus = async () => {
    if (!latestSmsDispatch?.dispatch.id) {
      setMessage('먼저 문자 발송을 수행한 뒤 상태 동기화를 실행하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/messaging/sms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatchId: latestSmsDispatch.dispatch.id,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문자 상태 동기화 실패');
      }

      setLatestSmsDispatch(result.data);
      setMessage(
        `문자 상태 동기화 완료: ${result.data.dispatch.status} / 대상 ${result.data.dispatch.recipientCount}건 / 성공 ${result.data.dispatch.sentCount}건 / 실패 ${result.data.dispatch.failedCount}건`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문자 상태 동기화 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedRequestLinkId) {
      setMessage('먼저 요청 링크를 선택하거나 생성하세요.');
      return;
    }

    if (selectedRecentRequestLink && selectedRecentRequestLink.requestLink.recipientChannel !== 'email') {
      setMessage('이메일 발송은 recipientChannel 이 email 인 요청 링크에서만 사용할 수 있습니다.');
      return;
    }

    const subject = `[MEJAI] 문서 입력 요청: ${selectedRecentRequestLink?.documentTitle || '문서 입력 요청'}`;

    setLoading(true);
    setMessage(null);

    try {
      const requestLinkResponse = await fetch(
        `/api/request-links?dispatchUrlFor=${encodeURIComponent(selectedRequestLinkId)}`,
        {
          cache: 'no-store',
        }
      );
      const requestLinkResult = await requestLinkResponse.json();

      if (!requestLinkResult.success) {
        throw new Error(requestLinkResult.message || '이메일 발송용 요청 링크 URL 생성 실패');
      }

      const requestLinkUrl = `${window.location.origin}${requestLinkResult.data.maskedUrl}`;
      const htmlBody = [
        '<div>',
        `<p>안녕하세요${selectedRecentRequestLink?.requestLink.recipientName ? `, ${selectedRecentRequestLink.requestLink.recipientName}님` : ''}.</p>`,
        `<p>${selectedRecentRequestLink?.documentTitle || '문서'} 관련 요청 링크를 전달드립니다.</p>`,
        `<p><a href="${requestLinkUrl}">요청 링크 열기</a></p>`,
        `<p>${requestLinkUrl}</p>`,
        '</div>',
      ].join('');

      const response = await fetch('/api/messaging/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestLinkId: selectedRequestLinkId,
          requestedBy,
          subject,
          htmlBody,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '이메일 발송 실패');
      }

      setLatestEmailDispatch(result.data);
      setMessage(
        `이메일 발송 상태: ${result.data.dispatch.status} / 대상 ${result.data.dispatch.recipientCount}건 / 성공 ${result.data.dispatch.sentCount}건 / 실패 ${result.data.dispatch.failedCount}건`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '이메일 발송 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">REQ-LINK-10</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">일괄 요청</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            특정 라벨만 제한적으로 수정할 수 있는 요청 링크를 발급하고 전송하는 화면입니다. 요청 링크는 토큰 해시 저장,
            만료 검증, 1회성 사용, 제출 감사 로그를 유지합니다. 문자 발송은 `/messaging` 에서 저장한 문서별 기본
            발신번호와 문서별 기본 수신번호를 기본 적용하되, 발송 전에 수신번호를 다시 확인합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDocuments()} disabled={loading}>
            문서 목록 새로고침
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            요청 링크 생성
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>대상 문서와 허용 라벨</CardTitle>
            <CardDescription>
              같은 `siteId` 문서를 불러와 대상 문서를 고르고, 허용 라벨과 수신자 정보를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">현장 ID</label>
                <Input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">대상 문서</label>
                <select
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">문서를 선택하세요</option>
                  {documents.map((item) => (
                    <option key={item.document.id} value={item.document.id}>
                      {item.document.title} ({item.document.documentTypeKey})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">수신 채널</label>
                <select
                  value={recipientChannel}
                  onChange={(event) => setRecipientChannel(event.target.value as 'email' | 'sms')}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="email">email</option>
                  <option value="sms">sms</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">수신 대상</label>
                <Input value={recipientTarget} onChange={(event) => setRecipientTarget(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">수신자 이름</label>
                <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">만료 시각</label>
                <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">요청자</label>
                <Input value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={oneTimeUse} onChange={(event) => setOneTimeUse(event.target.checked)} />
                1회성 링크
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">허용 라벨 JSON</label>
              <textarea
                value={allowedLabelsText}
                onChange={(event) => setAllowedLabelsText(event.target.value)}
                className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>최근 생성 결과</CardTitle>
            <CardDescription>토큰 원문은 생성 직후에만 보여주고, DB에는 해시만 저장합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {latestCreated ? (
              <>
                <p>Request Link ID: {latestCreated.requestLink.id}</p>
                <p>문서 ID: {latestCreated.requestLink.documentId}</p>
                <p>수신자: {latestCreated.requestLink.recipientName || '-'}</p>
                <p>허용 라벨 수: {latestCreated.requestLink.allowedLabels.length}</p>
                <p>만료 시각: {latestCreated.requestLink.expiresAt}</p>
                <p>1회성: {latestCreated.requestLink.oneTimeUse ? '예' : '아니오'}</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">바로 열기</p>
                  <p className="mt-2 break-all font-mono text-xs">{latestCreated.maskedUrl}</p>
                </div>
                <Link
                  href={latestCreated.maskedUrl}
                  className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  제한 입력 페이지 열기
                </Link>
              </>
            ) : (
              <p className="text-slate-500">아직 생성된 요청 링크가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>최근 요청 링크 목록</CardTitle>
          <CardDescription>
            새로고침 후에도 기존 요청 링크를 다시 선택할 수 있습니다. 전송 실행 시에는 선택한 링크 기준으로 새 토큰 URL을
            재발급합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          {recentRequestLinks.length > 0 ? (
            recentRequestLinks.map((item) => {
              const isSelected = item.requestLink.id === selectedRequestLinkId;

              return (
                <button
                  key={item.requestLink.id}
                  type="button"
                  onClick={() => setSelectedRequestLinkId(item.requestLink.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left ${
                    isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{item.documentTitle}</p>
                      <p className="font-mono text-xs text-slate-500">{item.requestLink.id}</p>
                    </div>
                    {isSelected ? <Badge variant="slate">선택됨</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {item.documentTypeKey} / {item.requestLink.recipientChannel} / {item.maskedRecipientTarget}
                  </p>
                </button>
              );
            })
          ) : (
            <p className="text-slate-500">아직 조회된 요청 링크가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>이메일 발송</CardTitle>
          <CardDescription>
            선택한 요청 링크를 기준으로 새 토큰 URL을 재발급한 뒤 이메일을 발송합니다. UI는 단순하지만, 뒤에서는
            dispatch 생성, provider 호출, 이벤트 저장이 순서대로 수행됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            {selectedRequestLinkId ? (
              <>
                <p className="font-medium text-slate-900">
                  {selectedRecentRequestLink?.documentTitle || '선택한 요청 링크'}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">{selectedRequestLinkId}</p>
                <p className="mt-1 text-xs text-slate-500">
                  수신 채널: {selectedRecentRequestLink?.requestLink.recipientChannel || '-'}
                </p>
              </>
            ) : (
              <p className="text-slate-500">먼저 요청 링크를 선택하세요.</p>
            )}
          </div>
          <Button
            onClick={handleSendEmail}
            disabled={loading || !selectedRequestLinkId || selectedRecentRequestLink?.requestLink.recipientChannel !== 'email'}
          >
            이메일 발송
          </Button>

          {latestEmailDispatch ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p>Dispatch ID: {latestEmailDispatch.dispatch.id}</p>
              <p>상태: {latestEmailDispatch.dispatch.status}</p>
              <p>Provider: {latestEmailDispatch.dispatch.providerKey}</p>
              <p>대상 수신자: {latestEmailDispatch.dispatch.recipientCount}건</p>
              <p>성공: {latestEmailDispatch.dispatch.sentCount}건</p>
              <p>실패: {latestEmailDispatch.dispatch.failedCount}건</p>
              <p>이벤트 수: {latestEmailDispatch.events.length}</p>
              {latestEmailDispatch.targets.map((target) => (
                <div key={target.id} className="mt-2 text-xs text-slate-600">
                  {target.recipientEmail} {target.recipientName ? `(${target.recipientName})` : ''} / {target.status}
                  {target.failureReason ? ` / ${target.failureReason}` : ''}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">아직 이메일 발송 결과가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문자 발송 운영 이동</CardTitle>
          <CardDescription>
              발신번호 등록, 수신번호 등록, 기본 설정, 최근 발송 이력과 상태 동기화는 `/messaging` 독립 운영 화면에서
              관리합니다. 문서별 기본 발신번호와 기본 수신번호도 `/messaging`에서 지정합니다. 이 페이지는 요청 링크 생성과
              실제 발송 실행에만 집중합니다.
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">현재 저장된 기본 발신번호</p>
              <p className="mt-1">{smsSettings?.defaultSenderPhoneNumber || '-'}</p>
              <p className="mt-3 font-medium text-slate-900">문서별 기본 발신번호</p>
              <p className="mt-1">
                {selectedDocumentSenderBinding
                  ? `${selectedDocumentSenderBinding.senderPhoneNumber}${selectedDocumentSenderBinding.senderDisplayName ? ` (${selectedDocumentSenderBinding.senderDisplayName})` : ''}`
                  : '-'}
              </p>
              <p className="mt-3 font-medium text-slate-900">문서별 기본 수신번호</p>
              <p className="mt-1">
                {selectedDocumentRecipientBinding
                  ? `${selectedDocumentRecipientBinding.recipients.length}개 기본 선택`
                  : '-'}
              </p>
              <p className="mt-3 font-medium text-slate-900">현재 문자 앞머리 문구</p>
              <p className="mt-1">{smsSettings?.messagePrefix || '-'}</p>
            </div>
            <Link
              href="/messaging"
              className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              문자 발송 운영 화면 열기
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>문자 발송</CardTitle>
          <CardDescription>
              선택한 요청 링크를 문자로 전달합니다. 문서별 기본 수신번호가 자동 선택되며, 발송 전 다시 확인하거나 수정할 수
              있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              전역 기본 발신번호: {smsSettings?.defaultSenderPhoneNumber || '-'}
            </p>
            {selectedDocumentSenderBinding ? (
              <p className="text-xs text-slate-500">
                자동 사용 문서 발신번호: {selectedDocumentSenderBinding.senderPhoneNumber}
                {selectedDocumentSenderBinding.senderDisplayName ? ` (${selectedDocumentSenderBinding.senderDisplayName})` : ''}
              </p>
            ) : (
              <p className="text-xs text-slate-500">문서별 기본 발신번호가 없습니다. 전역 기본 발신번호를 사용합니다.</p>
            )}
            <p className="text-xs text-slate-500">
              자동 선택 문서 수신번호: {selectedDocumentRecipientBinding?.recipientIds.length || 0}개
            </p>
            <label className="text-sm font-medium text-slate-800">수신번호</label>
            <div className="rounded-md border border-slate-200 bg-white">
                {smsRecipients.length > 0 ? (
                  <div className="max-h-52 overflow-auto">
                    {smsRecipients.map((recipient) => {
                      const checked = selectedSmsRecipientIds.includes(recipient.id);

                      return (
                        <label
                          key={recipient.id}
                          className={`flex cursor-pointer items-center gap-3 border-b border-slate-200 px-3 py-2 last:border-b-0 ${
                            checked ? 'bg-slate-50' : 'bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSmsRecipientId(recipient.id)}
                          />
                          <span className="text-sm text-slate-700">
                            {recipient.phoneNumber} {recipient.recipientName ? `(${recipient.recipientName})` : ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-slate-500">등록된 수신번호가 없습니다.</div>
                )}
              </div>
              <p className="text-xs text-slate-500">발송 전 선택된 수신번호: {selectedSmsRecipientIds.length}개</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSendSms} disabled={loading}>
                문자 발송
              </Button>
              <Button variant="outline" onClick={handleSyncSmsStatus} disabled={loading || !latestSmsDispatch?.dispatch.id}>
                문자 상태 동기화
              </Button>
              <Link
                href="/messaging"
                className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                상세 운영 화면
              </Link>
            </div>

            {latestSmsDispatch ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p>상태: {latestSmsDispatch.dispatch.status}</p>
                <p>대상 수신번호: {latestSmsDispatch.dispatch.recipientCount}건</p>
                <p>성공: {latestSmsDispatch.dispatch.sentCount}건</p>
                <p>실패: {latestSmsDispatch.dispatch.failedCount}건</p>
                {latestSmsDispatch.targets.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                    {latestSmsDispatch.targets.slice(0, 3).map((target) => (
                      <div key={target.id} className="text-xs text-slate-600">
                        {target.recipientPhoneNumber} {target.recipientName ? `(${target.recipientName})` : ''} /{' '}
                        {target.status}
                        {target.failureReason ? ` / ${target.failureReason}` : ''}
                      </div>
                    ))}
                    {latestSmsDispatch.targets.length > 3 ? (
                      <div className="text-xs text-slate-500">
                        나머지 {latestSmsDispatch.targets.length - 3}건은 상세 운영 화면에서 확인합니다.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-slate-500">아직 문자 발송 결과가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
