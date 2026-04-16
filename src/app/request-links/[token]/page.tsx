'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import type { RequestLinkPublicViewDto, RequestLinkSubmitResult } from '../../../lib/requestLinkDtos';

export default function RequestLinkTokenPage() {
  const params = useParams<{ token: string }>();
  const [token, setToken] = React.useState('');
  const [requestLink, setRequestLink] = React.useState<RequestLinkPublicViewDto | null>(null);
  const [submittedBy, setSubmittedBy] = React.useState('external-user');
  const [labelValuesText, setLabelValuesText] = React.useState('{}');
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
      setLabelValuesText(JSON.stringify(result.data.documentSummary.allowedLabelValues, null, 2));
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

  const handleSubmit = async () => {
    if (!token) {
      setMessage('token이 없습니다.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/request-links/${encodeURIComponent(token)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labelValues: JSON.parse(labelValuesText),
          submittedBy,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '요청 링크 제출에 실패했습니다.');
      }

      setSubmitResult(result.data);
      setMessage(`요청 링크 제출 완료: ${result.data.updatedLabels.length}개 라벨을 반영했습니다.`);
      await loadRequestLink(token);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '요청 링크 제출에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="space-y-2">
        <Badge variant="slate">REQ-LINK-02</Badge>
        <h1 className="text-3xl font-semibold text-slate-950">제한 입력 요청 링크</h1>
        <p className="text-sm text-slate-600">
          허용된 라벨만 수정할 수 있는 제한 입력 페이지입니다. 만료되었거나 이미 사용된 1회성 링크는 제출이 차단됩니다.
        </p>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>링크 요약</CardTitle>
            <CardDescription>허용 라벨과 현재 상태를 확인합니다.</CardDescription>
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
                <p>만료 시각: {requestLink.expiresAt}</p>
                <p>1회성: {requestLink.oneTimeUse ? '예' : '아니오'}</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">허용 라벨</p>
                  {requestLink.allowedLabels.map((label) => (
                    <p key={label} className="mt-2 text-sm text-slate-600">
                      {label}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500">링크 정보를 불러오는 중입니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>제한 입력 제출</CardTitle>
            <CardDescription>허용된 라벨만 제출할 수 있습니다. 허용되지 않은 키는 서버에서 차단합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">제출자</label>
              <Input value={submittedBy} onChange={(event) => setSubmittedBy(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">허용 라벨 값 JSON</label>
              <textarea
                value={labelValuesText}
                onChange={(event) => setLabelValuesText(event.target.value)}
                className="flex min-h-[240px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              />
            </div>
            <Button onClick={handleSubmit} disabled={loading}>
              제한 입력 제출
            </Button>

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
  );
}
