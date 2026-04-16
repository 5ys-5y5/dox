'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type {
  SmsDispatchHistoryItemDto,
  SmsRecipientRecordDto,
  SmsSenderRecordDto,
  SmsSettingsDto,
  SmsSyncResult,
} from '../../lib/messagingDtos';

export default function MessagingPage() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [senders, setSenders] = React.useState<SmsSenderRecordDto[]>([]);
  const [recipients, setRecipients] = React.useState<SmsRecipientRecordDto[]>([]);
  const [dispatches, setDispatches] = React.useState<SmsDispatchHistoryItemDto[]>([]);
  const [settings, setSettings] = React.useState<SmsSettingsDto | null>(null);
  const [defaultSenderPhone, setDefaultSenderPhone] = React.useState('');
  const [messagePrefix, setMessagePrefix] = React.useState('');
  const [senderPhone, setSenderPhone] = React.useState('01093107159');
  const [senderName, setSenderName] = React.useState('현장 발신번호');
  const [recipientPhone, setRecipientPhone] = React.useState('01098765432');
  const [recipientName, setRecipientName] = React.useState('현장 담당자');
  const [recipientSiteId, setRecipientSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [latestSyncedDispatch, setLatestSyncedDispatch] = React.useState<SmsSyncResult | null>(null);

  const loadMessagingData = React.useCallback(async () => {
    try {
      const [settingsResponse, sendersResponse, recipientsResponse, dispatchesResponse] = await Promise.all([
        fetch('/api/messaging/sms/settings', { cache: 'no-store' }),
        fetch('/api/messaging/sms/senders', { cache: 'no-store' }),
        fetch('/api/messaging/sms/recipients', { cache: 'no-store' }),
        fetch('/api/messaging/sms/dispatches?limit=12', { cache: 'no-store' }),
      ]);

      const [settingsResult, sendersResult, recipientsResult, dispatchesResult] = await Promise.all([
        settingsResponse.json(),
        sendersResponse.json(),
        recipientsResponse.json(),
        dispatchesResponse.json(),
      ]);

      if (settingsResult.success) {
        const nextSettings = settingsResult.data as SmsSettingsDto;
        setSettings(nextSettings);
        setDefaultSenderPhone(nextSettings.defaultSenderPhoneNumber || '');
        setMessagePrefix(nextSettings.messagePrefix || '');
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
    } catch {
      setMessage('messaging 운영 데이터 조회에 실패했습니다.');
    }
  }, []);

  React.useEffect(() => {
    void loadMessagingData();
  }, [loadMessagingData]);

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
          <Badge variant="slate">MESSAGING-11</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">문자 발송 운영</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문자 발송은 `messaging` 독립 도메인으로 관리합니다. 이 화면은 발신번호/수신번호 등록, 기본 설정,
            최근 발송 이력과 상태 동기화만 담당합니다.
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
              <select
                value={defaultSenderPhone}
                onChange={(event) => setDefaultSenderPhone(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="">등록된 발신번호 중 선택</option>
                {senders.map((sender) => (
                  <option key={sender.id} value={sender.phoneNumber}>
                    {sender.phoneNumber} {sender.displayName ? `(${sender.displayName})` : ''}
                  </option>
                ))}
              </select>
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
              <label className="text-sm font-medium text-slate-800">siteId</label>
              <Input value={recipientSiteId} onChange={(event) => setRecipientSiteId(event.target.value)} />
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

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>최근 문자 발송 이력</CardTitle>
            <CardDescription>
              request-links 등 다른 기능이 호출한 문자 발송도 이 독립 도메인의 정본 이력으로 함께 보입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            {dispatches.length > 0 ? (
              dispatches.map((item) => (
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
              <p className="text-slate-500">아직 조회된 문자 발송 이력이 없습니다.</p>
            )}

            {latestSyncedDispatch ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                마지막 동기화 dispatch: {latestSyncedDispatch.dispatch.id} / 상태: {latestSyncedDispatch.dispatch.status}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
