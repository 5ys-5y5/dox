'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { DocumentListItem } from '../../lib/documentDtos';
import type { SmsRecipientRecordDto, SmsSenderRecordDto, SmsSendResult } from '../../lib/messagingDtos';
import type { RequestLinkCreateResult } from '../../lib/requestLinkDtos';

const defaultAllowedLabels = JSON.stringify(['manager_name'], null, 2);

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
  const [smsSenders, setSmsSenders] = React.useState<SmsSenderRecordDto[]>([]);
  const [smsRecipients, setSmsRecipients] = React.useState<SmsRecipientRecordDto[]>([]);
  const [selectedSmsSenderId, setSelectedSmsSenderId] = React.useState('');
  const [selectedSmsRecipientId, setSelectedSmsRecipientId] = React.useState('');
  const [smsSenderPhone, setSmsSenderPhone] = React.useState('01012345678');
  const [smsSenderName, setSmsSenderName] = React.useState('현장 발신번호');
  const [smsRecipientPhone, setSmsRecipientPhone] = React.useState('01098765432');
  const [smsRecipientName, setSmsRecipientName] = React.useState('현장 담당자');
  const [latestSmsDispatch, setLatestSmsDispatch] = React.useState<SmsSendResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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

  const loadMessagingRegistry = React.useCallback(async () => {
    try {
      const [senderResponse, recipientResponse] = await Promise.all([
        fetch('/api/messaging/sms/senders', { cache: 'no-store' }),
        fetch('/api/messaging/sms/recipients', { cache: 'no-store' }),
      ]);
      const [senderResult, recipientResult] = await Promise.all([
        senderResponse.json(),
        recipientResponse.json(),
      ]);

      if (senderResult.success) {
        setSmsSenders(senderResult.data);
        setSelectedSmsSenderId((previous) => previous || senderResult.data[0]?.id || '');
      }

      if (recipientResult.success) {
        setSmsRecipients(recipientResult.data);
        setSelectedSmsRecipientId((previous) => previous || recipientResult.data[0]?.id || '');
      }
    } catch {
      // messaging registry 는 부가 기능이므로 조회 실패가 페이지 로드를 막지 않습니다.
    }
  }, []);

  React.useEffect(() => {
    void loadMessagingRegistry();
  }, [loadMessagingRegistry]);

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
      setMessage(`요청 링크 ${result.data.requestLink.id} 를 생성했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '요청 링크 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSender = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/messaging/sms/senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: smsSenderPhone,
          displayName: smsSenderName,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '발신번호 등록 실패');
      }

      await loadMessagingRegistry();
      setSelectedSmsSenderId(result.data.id);
      setMessage(`발신번호 ${result.data.phoneNumber} 를 등록했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '발신번호 등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterRecipient = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/messaging/sms/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: smsRecipientPhone,
          recipientName: smsRecipientName,
          siteId,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '수신번호 등록 실패');
      }

      await loadMessagingRegistry();
      setSelectedSmsRecipientId(result.data.id);
      setMessage(`수신번호 ${result.data.phoneNumber} 를 등록했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '수신번호 등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSms = async () => {
    if (!latestCreated?.requestLink.id) {
      setMessage('먼저 요청 링크를 생성하세요.');
      return;
    }

    if (!selectedSmsSenderId || !selectedSmsRecipientId) {
      setMessage('발신번호와 수신번호를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const recipient = smsRecipients.find((item) => item.id === selectedSmsRecipientId);
      const requestLinkUrl = `${window.location.origin}${latestCreated.maskedUrl}`;
      const messageText = `[MEJAI] ${recipient?.recipientName || '수신자'}님, 요청 링크를 확인하세요. ${requestLinkUrl}`;

      const response = await fetch('/api/messaging/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestLinkId: latestCreated.requestLink.id,
          senderId: selectedSmsSenderId,
          recipientId: selectedSmsRecipientId,
          requestedBy,
          messageText,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문자 발송 실패');
      }

      setLatestSmsDispatch(result.data);
      setMessage(`문자 발송 상태: ${result.data.dispatch.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문자 발송 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">REQ-LINK-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">일괄 요청</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            특정 라벨만 제한적으로 수정할 수 있는 요청 링크를 발급하는 1차 구현입니다. 이번 단계는 토큰 해시 저장,
            만료 검증, 1회성 사용, 제출 감사 로그까지 다룹니다.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문자 발송용 번호 등록</CardTitle>
            <CardDescription>
              문자 발송은 request-links 내부 테이블이 아니라 messaging 스키마의 독립 도메인으로 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-800">발신번호 등록</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={smsSenderPhone} onChange={(event) => setSmsSenderPhone(event.target.value)} />
                <Input value={smsSenderName} onChange={(event) => setSmsSenderName(event.target.value)} />
              </div>
              <Button variant="outline" onClick={handleRegisterSender} disabled={loading}>
                발신번호 등록
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-800">수신번호 등록</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={smsRecipientPhone} onChange={(event) => setSmsRecipientPhone(event.target.value)} />
                <Input value={smsRecipientName} onChange={(event) => setSmsRecipientName(event.target.value)} />
              </div>
              <Button variant="outline" onClick={handleRegisterRecipient} disabled={loading}>
                수신번호 등록
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문자 발송</CardTitle>
            <CardDescription>
              UI는 단순하게 유지하지만, 뒤에서는 dispatch 생성, Solapi 호출, 결과 이벤트 저장이 순서대로 수행됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">발신번호</label>
                <select
                  value={selectedSmsSenderId}
                  onChange={(event) => setSelectedSmsSenderId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">발신번호 선택</option>
                  {smsSenders.map((sender) => (
                    <option key={sender.id} value={sender.id}>
                      {sender.phoneNumber} {sender.displayName ? `(${sender.displayName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">수신번호</label>
                <select
                  value={selectedSmsRecipientId}
                  onChange={(event) => setSelectedSmsRecipientId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">수신번호 선택</option>
                  {smsRecipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.phoneNumber} {recipient.recipientName ? `(${recipient.recipientName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={handleSendSms} disabled={loading}>
              문자 발송
            </Button>

            {latestSmsDispatch ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p>Dispatch ID: {latestSmsDispatch.dispatch.id}</p>
                <p>상태: {latestSmsDispatch.dispatch.status}</p>
                <p>Provider: {latestSmsDispatch.dispatch.providerKey}</p>
                <p>이벤트 수: {latestSmsDispatch.events.length}</p>
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
