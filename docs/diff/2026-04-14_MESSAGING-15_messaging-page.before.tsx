'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type { DocumentListItem } from '../../lib/documentDtos';
import type {
  EmailDispatchHistoryItemDto,
  SmsDispatchHistoryItemDto,
  SmsRecipientRecordDto,
  SmsSenderRecordDto,
  SmsSettingsDto,
  SmsSyncResult,
} from '../../lib/messagingDtos';
import type { SiteRecordDto } from '../../lib/siteChecklistDtos';

export default function MessagingPage() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [senders, setSenders] = React.useState<SmsSenderRecordDto[]>([]);
  const [recipients, setRecipients] = React.useState<SmsRecipientRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [dispatches, setDispatches] = React.useState<SmsDispatchHistoryItemDto[]>([]);
  const [emailDispatches, setEmailDispatches] = React.useState<EmailDispatchHistoryItemDto[]>([]);
  const [settings, setSettings] = React.useState<SmsSettingsDto | null>(null);
  const [defaultSenderPhone, setDefaultSenderPhone] = React.useState('');
  const [documentSiteId, setDocumentSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [documentSenderDraft, setDocumentSenderDraft] = React.useState<Record<string, string>>({});
  const [documentRecipientDraft, setDocumentRecipientDraft] = React.useState<Record<string, string[]>>({});
  const [messagePrefix, setMessagePrefix] = React.useState('');
  const [senderPhone, setSenderPhone] = React.useState('01093107159');
  const [senderName, setSenderName] = React.useState('현장 발신번호');
  const [recipientPhone, setRecipientPhone] = React.useState('01098765432');
  const [recipientName, setRecipientName] = React.useState('현장 담당자');
  const [recipientSiteId, setRecipientSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [latestSyncedDispatch, setLatestSyncedDispatch] = React.useState<SmsSyncResult | null>(null);
  const [showAllDispatches, setShowAllDispatches] = React.useState(false);
  const siteOptions = React.useMemo(
    () =>
      sites.map((site) => ({
        id: site.id,
        label: site.siteName,
        meta: site.id,
        keywords: site.tradeKeys,
      })),
    [sites]
  );
  const senderOptions = React.useMemo(
    () =>
      senders.map((sender) => ({
        id: sender.phoneNumber,
        label: sender.phoneNumber,
        meta: sender.displayName || sender.id,
      })),
    [senders]
  );
  const senderIdOptions = React.useMemo(
    () =>
      senders.map((sender) => ({
        id: sender.id,
        label: sender.phoneNumber,
        meta: sender.displayName || sender.id,
      })),
    [senders]
  );

  const dedupedDispatchGroups = React.useMemo(() => {
    const seen = new Set<string>();
    const visible: SmsDispatchHistoryItemDto[] = [];
    const hiddenDuplicates: SmsDispatchHistoryItemDto[] = [];

    for (const item of dispatches) {
      const recipientKey = item.targets
        .map((target) => target.recipientPhoneNumber)
        .sort()
        .join(',');
      const dispatchKey = `${item.dispatch.requestLinkId || 'no-request-link'}::${recipientKey || 'no-recipient'}`;

      if (seen.has(dispatchKey)) {
        hiddenDuplicates.push(item);
        continue;
      }

      seen.add(dispatchKey);
      visible.push(item);
    }

    return {
      visible,
      hiddenDuplicates,
    };
  }, [dispatches]);

  const visibleDispatches = React.useMemo(
    () =>
      dedupedDispatchGroups.visible.filter(
        (item) =>
          item.dispatch.recipientCount > 0 &&
          (item.dispatch.status === 'delivered' || item.dispatch.status === 'sent' || item.dispatch.status === 'failed')
      ),
    [dedupedDispatchGroups.visible]
  );

  const hiddenDispatches = React.useMemo(
    () =>
      [
        ...dedupedDispatchGroups.hiddenDuplicates,
        ...dedupedDispatchGroups.visible.filter(
          (item) =>
            item.dispatch.recipientCount === 0 ||
            item.dispatch.status === 'provider_not_configured' ||
            item.dispatch.status === 'queued' ||
            item.dispatch.status === 'sending' ||
            item.dispatch.status === 'manual_required'
        ),
      ],
    [dedupedDispatchGroups.hiddenDuplicates, dedupedDispatchGroups.visible]
  );

  const loadMessagingData = React.useCallback(async () => {
    try {
      const [settingsResponse, sendersResponse, recipientsResponse, dispatchesResponse, emailDispatchesResponse] =
        await Promise.all([
        fetch('/api/messaging/sms/settings', { cache: 'no-store' }),
        fetch('/api/messaging/sms/senders', { cache: 'no-store' }),
        fetch('/api/messaging/sms/recipients', { cache: 'no-store' }),
        fetch('/api/messaging/sms/dispatches?limit=12', { cache: 'no-store' }),
          fetch('/api/messaging/email/dispatches?limit=12', { cache: 'no-store' }),
        ]);

      const [settingsResult, sendersResult, recipientsResult, dispatchesResult, emailDispatchesResult] =
        await Promise.all([
        settingsResponse.json(),
        sendersResponse.json(),
        recipientsResponse.json(),
        dispatchesResponse.json(),
          emailDispatchesResponse.json(),
        ]);

      if (settingsResult.success) {
        const nextSettings = settingsResult.data as SmsSettingsDto;
        setSettings(nextSettings);
        setDefaultSenderPhone(nextSettings.defaultSenderPhoneNumber || '');
        setMessagePrefix(nextSettings.messagePrefix || '');
        setDocumentSenderDraft(
          Object.fromEntries(nextSettings.documentSenderBindings.map((item) => [item.documentId, item.senderId]))
        );
        setDocumentRecipientDraft(
          Object.fromEntries(nextSettings.documentRecipientBindings.map((item) => [item.documentId, item.recipientIds]))
        );
      }

      if (sendersResult.success) {
        setSenders(sendersResult.data as SmsSenderRecordDto[]);
      }

      if (recipientsResult.success) {
        setRecipients(recipientsResult.data as SmsRecipientRecordDto[]);
      }

      if (dispatchesResult.success) {
        setDispatches(dispatchesResult.data as SmsDispatchHistoryItemDto[]);
      }

      if (emailDispatchesResult.success) {
        setEmailDispatches(emailDispatchesResult.data as EmailDispatchHistoryItemDto[]);
      }
    } catch {
      setMessage('messaging 운영 데이터 조회에 실패했습니다.');
    }
  }, []);

  React.useEffect(() => {
    void loadMessagingData();
  }, [loadMessagingData]);

  const loadSites = React.useCallback(async () => {
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '현장 목록 조회에 실패했습니다.');
      }

      const nextSites = result.data.sites as SiteRecordDto[];
      setSites(nextSites);
      setDocumentSiteId((previous) => {
        if (previous && nextSites.some((site) => site.id === previous)) {
          return previous;
        }

        return nextSites[0]?.id || previous;
      });
      setRecipientSiteId((previous) => {
        if (previous && nextSites.some((site) => site.id === previous)) {
          return previous;
        }

        return nextSites[0]?.id || previous;
      });
    } catch {
      setMessage((previous) => previous || '현장 목록 조회에 실패했습니다.');
    }
  }, []);

  React.useEffect(() => {
    void loadSites();
  }, [loadSites]);

  const loadDocuments = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?siteId=${encodeURIComponent(documentSiteId)}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (result.success) {
        setDocuments(result.data as DocumentListItem[]);
      }
    } catch {
      // 문서 목록 조회 실패는 messaging 화면 전체를 막지 않습니다.
    }
  }, [documentSiteId]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleSaveSettings = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/messaging/sms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultSenderPhoneNumber: defaultSenderPhone || null,
          messagePrefix,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문자 발송 설정 저장 실패');
      }

      setSettings(result.data as SmsSettingsDto);
      await loadMessagingData();
      setMessage('문자 발송 기본 설정을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문자 발송 설정 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const toggleDocumentRecipient = (documentId: string, recipientId: string) => {
    setDocumentRecipientDraft((previous) => {
      const existing = previous[documentId] || [];
      return {
        ...previous,
        [documentId]: existing.includes(recipientId)
          ? existing.filter((item) => item !== recipientId)
          : [...existing, recipientId],
      };
    });
  };

  const handleSaveDocumentMessagingDefaults = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/messaging/sms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentSenderBindings: documents.map((item) => ({
            documentId: item.document.id,
            senderId: documentSenderDraft[item.document.id] || null,
          })),
          documentRecipientBindings: documents.map((item) => ({
            documentId: item.document.id,
            recipientIds: documentRecipientDraft[item.document.id] || [],
          })),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서별 기본 발신번호/수신번호 저장 실패');
      }

      setSettings(result.data as SmsSettingsDto);
      setDocumentSenderDraft(
        Object.fromEntries((result.data as SmsSettingsDto).documentSenderBindings.map((item) => [item.documentId, item.senderId]))
      );
      setDocumentRecipientDraft(
        Object.fromEntries((result.data as SmsSettingsDto).documentRecipientBindings.map((item) => [item.documentId, item.recipientIds]))
      );
      await loadMessagingData();
      setMessage('문서별 기본 발신번호와 기본 수신번호를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문서별 기본 발신번호/수신번호 저장 실패');
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
          phoneNumber: senderPhone,
          displayName: senderName,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '발신번호 등록 실패');
      }

      await loadMessagingData();
      setDefaultSenderPhone(result.data.phoneNumber);
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
          phoneNumber: recipientPhone,
          recipientName,
          siteId: recipientSiteId || null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '수신번호 등록 실패');
      }

      await loadMessagingData();
      setMessage(`수신번호 ${result.data.phoneNumber} 를 등록했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '수신번호 등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDispatch = async (dispatchId: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/messaging/sms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchId }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문자 상태 동기화 실패');
      }

      setLatestSyncedDispatch(result.data as SmsSyncResult);
      await loadMessagingData();
      setMessage(
        `문자 상태 동기화 완료: ${result.data.dispatch.status} / 대상 ${result.data.dispatch.recipientCount}건 / 성공 ${result.data.dispatch.sentCount}건 / 실패 ${result.data.dispatch.failedCount}건`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문자 상태 동기화 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">MESSAGING-14</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">알림 발송 운영</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문자와 이메일 발송은 `messaging` 독립 도메인으로 관리합니다. 이 화면은 발신번호/수신번호 등록, 기본 설정,
            최근 발송 이력과 상태 동기화 같은 운영 확인만 담당합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/request-links"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            요청 링크로 이동
          </Link>
          <Button variant="outline" onClick={() => void loadMessagingData()} disabled={loading}>
            목록 새로고침
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>문자 발송 기본 설정</CardTitle>
            <CardDescription>
              발신번호를 따로 고르지 않는 화면은 여기서 저장한 기본 발신번호와 문자 앞머리 문구를 사용합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">기본으로 사용할 발신번호</label>
              <EntityPicker
                value={defaultSenderPhone}
                options={senderOptions}
                onChange={setDefaultSenderPhone}
                placeholder="등록된 발신번호 중 선택"
                emptyMessage="등록된 발신번호가 없습니다."
                allowClear
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">문자 앞머리 문구</label>
              <Input
                value={messagePrefix}
                onChange={(event) => setMessagePrefix(event.target.value)}
                placeholder="예: [MEJAI]"
              />
              <p className="text-xs text-slate-500">모든 문자 맨 앞에 자동으로 붙는 짧은 고정 문구입니다.</p>
            </div>
            <Button variant="outline" onClick={handleSaveSettings} disabled={loading}>
              기본 설정 저장
            </Button>
            {settings ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>저장된 기본 발신번호: {settings.defaultSenderPhoneNumber || '-'}</p>
                <p>저장된 문자 앞머리 문구: {settings.messagePrefix || '-'}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>새 발신번호 등록</CardTitle>
            <CardDescription>Solapi에 사용 가능한 발신번호를 우리 서비스의 messaging 정본에도 등록합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} />
              <Input value={senderName} onChange={(event) => setSenderName(event.target.value)} />
            </div>
            <Button variant="outline" onClick={handleRegisterSender} disabled={loading}>
              발신번호 등록
            </Button>
            <div className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
              {senders.length > 0 ? (
                senders.map((sender) => (
                  <div key={sender.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    {sender.phoneNumber} {sender.displayName ? `(${sender.displayName})` : ''}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">등록된 발신번호가 없습니다.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>문서별 기본 발신번호와 기본 수신번호</CardTitle>
          <CardDescription>
            문서마다 기본 발신번호와 기본 수신번호를 저장합니다. `/request-links`에서는 이 값들이 자동 적용되고,
            수신번호는 발송 전에 다시 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">현장 선택</label>
              <EntityPicker
                value={documentSiteId}
                options={siteOptions}
                onChange={setDocumentSiteId}
                placeholder="현장을 선택하세요"
                emptyMessage="저장된 현장이 없습니다."
              />
            </div>
          <div className="space-y-3">
            {documents.length > 0 ? (
              documents.map((item) => (
                <div key={item.document.id} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{item.document.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.document.id} / {item.document.documentTypeKey}
                    </p>
                  </div>
                  <div className="mt-3">
                    <label className="mb-2 block text-xs font-medium text-slate-700">기본 발신번호</label>
                    <EntityPicker
                      value={documentSenderDraft[item.document.id] || ''}
                      options={senderIdOptions}
                      onChange={(value) =>
                        setDocumentSenderDraft((previous) => ({
                          ...previous,
                          [item.document.id]: value,
                        }))
                      }
                      placeholder="문서 기본 발신번호 없음"
                      emptyMessage="등록된 발신번호가 없습니다."
                      allowClear
                    />
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-slate-700">기본 수신번호</label>
                    <div className="rounded-md border border-slate-200 bg-slate-50">
                      {(recipients.filter((recipient) => !recipient.siteId || recipient.siteId === documentSiteId)).length > 0 ? (
                        <div className="max-h-48 overflow-auto">
                          {recipients
                            .filter((recipient) => !recipient.siteId || recipient.siteId === documentSiteId)
                            .map((recipient) => {
                              const checked = (documentRecipientDraft[item.document.id] || []).includes(recipient.id);
                              return (
                                <label
                                  key={`${item.document.id}-${recipient.id}`}
                                  className={`flex cursor-pointer items-center gap-3 border-b border-slate-200 px-3 py-2 last:border-b-0 ${
                                    checked ? 'bg-white' : 'bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleDocumentRecipient(item.document.id, recipient.id)}
                                  />
                                  <span className="text-sm text-slate-700">
                                    {recipient.phoneNumber} {recipient.recipientName ? `(${recipient.recipientName})` : ''}
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">같은 현장에 등록된 수신번호가 없습니다.</div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      기본 선택 수신번호: {(documentRecipientDraft[item.document.id] || []).length}개
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">선택한 현장에 연결된 문서가 없습니다.</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleSaveDocumentMessagingDefaults}
            disabled={loading || documents.length === 0}
          >
            문서별 기본 발신번호와 수신번호 저장
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>수신번호 등록</CardTitle>
            <CardDescription>문자 발송에 사용할 수신번호 목록을 독립적으로 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} />
              <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">현장 선택</label>
              <EntityPicker
                value={recipientSiteId}
                options={siteOptions}
                onChange={setRecipientSiteId}
                placeholder="현장을 선택하세요"
                emptyMessage="저장된 현장이 없습니다."
                allowClear
              />
            </div>
            <Button variant="outline" onClick={handleRegisterRecipient} disabled={loading}>
              수신번호 등록
            </Button>
            <div className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
              {recipients.length > 0 ? (
                recipients.map((recipient) => (
                  <div key={recipient.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div>{recipient.phoneNumber} {recipient.recipientName ? `(${recipient.recipientName})` : ''}</div>
                    <div className="text-xs text-slate-500">siteId: {recipient.siteId || '-'}</div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">등록된 수신번호가 없습니다.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 문자 발송 이력</CardTitle>
              <CardDescription>
                request-links 등 다른 기능이 호출한 문자 발송도 이 독립 도메인의 정본 이력으로 함께 보입니다. 기본 화면은
                운영 가치가 있는 유효 발송만 우선 보여줍니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              {visibleDispatches.length > 0 ? (
                visibleDispatches.map((item) => (
                  <div key={item.dispatch.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">Dispatch ID: {item.dispatch.id}</p>
                        <p>상태: {item.dispatch.status}</p>
                        <p>대상 수신번호: {item.dispatch.recipientCount}건</p>
                        <p>성공: {item.dispatch.sentCount}건</p>
                        <p>실패: {item.dispatch.failedCount}건</p>
                        <p className="text-xs text-slate-500">요청 링크 ID: {item.dispatch.requestLinkId || '-'}</p>
                      </div>
                      <Button variant="outline" onClick={() => void handleSyncDispatch(item.dispatch.id)} disabled={loading}>
                        문자 상태 동기화
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      {item.targets.map((target) => (
                        <div key={target.id} className="text-xs text-slate-600">
                          {target.recipientPhoneNumber} {target.recipientName ? `(${target.recipientName})` : ''} /{' '}
                          {target.status}
                          {target.failureReason ? ` / ${target.failureReason}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">아직 조회된 유효 문자 발송 이력이 없습니다.</p>
              )}

              {hiddenDispatches.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">전체 이력 보기</p>
                      <p className="text-xs text-slate-500">
                        대상 수신번호 0건, provider 미설정, 임시 실패 같은 운영 잡음 이력을 포함합니다.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowAllDispatches((previous) => !previous)}
                      disabled={loading}
                    >
                      {showAllDispatches ? '전체 이력 숨기기' : `전체 이력 보기 (${hiddenDispatches.length})`}
                    </Button>
                  </div>
                  {showAllDispatches ? (
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      {hiddenDispatches.map((item) => (
                        <div key={item.dispatch.id} className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="font-medium text-slate-900">Dispatch ID: {item.dispatch.id}</p>
                          <p className="mt-1 text-xs text-slate-600">상태: {item.dispatch.status}</p>
                          <p className="text-xs text-slate-600">대상 수신번호: {item.dispatch.recipientCount}건</p>
                          <p className="text-xs text-slate-600">요청 링크 ID: {item.dispatch.requestLinkId || '-'}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {latestSyncedDispatch ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  마지막 동기화 dispatch: {latestSyncedDispatch.dispatch.id} / 상태: {latestSyncedDispatch.dispatch.status}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 이메일 발송 이력</CardTitle>
              <CardDescription>
                request-links 에서 실행한 이메일 발송도 이 독립 도메인의 정본 이력으로 함께 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              {emailDispatches.length > 0 ? (
                emailDispatches.map((item) => (
                  <div key={item.dispatch.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">Dispatch ID: {item.dispatch.id}</p>
                      <p>상태: {item.dispatch.status}</p>
                      <p>대상 수신자: {item.dispatch.recipientCount}건</p>
                      <p>성공: {item.dispatch.sentCount}건</p>
                      <p>실패: {item.dispatch.failedCount}건</p>
                      <p className="text-xs text-slate-500">요청 링크 ID: {item.dispatch.requestLinkId || '-'}</p>
                    </div>
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      {item.targets.map((target) => (
                        <div key={target.id} className="text-xs text-slate-600">
                          {target.recipientEmail} {target.recipientName ? `(${target.recipientName})` : ''} / {target.status}
                          {target.failureReason ? ` / ${target.failureReason}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">아직 조회된 이메일 발송 이력이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
