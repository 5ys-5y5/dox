'use client';

import Link from 'next/link';
import * as React from 'react';
import { FileText, LogOut, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { MemberAccessSessionDto } from '../../lib/memberAccessDtos';

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return value;
};

const getDocumentRoleLabel = (role: MemberAccessSessionDto['accessibleDocuments'][number]['accessRole']) => {
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

export default function MemberAccessPage() {
  const [session, setSession] = React.useState<MemberAccessSessionDto | null>(null);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadSession = React.useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/member-access/session', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '구성원 세션을 확인하지 못했습니다.');
      }

      setSession((result.data as MemberAccessSessionDto | null) || null);
    } catch (error) {
      setSession(null);
      setMessage(error instanceof Error ? error.message : '구성원 세션을 확인하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleVerify = async () => {
    if (!phoneNumber.trim() || !accessCode.trim()) {
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
          phoneNumber: phoneNumber.trim(),
          accessCode: accessCode.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '구성원 인증에 실패했습니다.');
      }

      setPhoneNumber('');
      setAccessCode('');
      setSession(result.data as MemberAccessSessionDto);
      setMessage('번호 인증이 완료되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '구성원 인증에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/member-access/session', { method: 'DELETE' });
    setSession(null);
    setMessage('접근 세션을 종료했습니다.');
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">MEMBER-ACCESS-01</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">번호 인증 문서 접근</h1>
          <p className="mt-2 text-sm text-slate-600">
            초대된 번호만 접근할 수 있습니다. 인증은 번호당 한 번만 하면 되고, 이후에는 초대된 프로젝트와 문서 권한에 따라 접근 범위가 정해집니다.
          </p>
        </div>
        {session ? (
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            세션 종료
          </Button>
        ) : null}
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-6 text-sm text-slate-600">구성원 접근 세션을 확인하는 중입니다.</CardContent>
        </Card>
      ) : session ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>인증된 번호</CardTitle>
              <CardDescription>이 번호로 초대된 프로젝트와 문서를 볼 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-500">이름</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{session.member.displayName || '이름 없음'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">휴대폰 번호</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{formatPhoneNumber(session.member.phoneNumber)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">프로젝트 {session.accessibleSites.length}건</Badge>
                <Badge variant="green">접근 문서 {session.accessibleDocuments.length}건</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>접근 가능한 프로젝트</CardTitle>
                <CardDescription>프로젝트 권한이 있으면 그 프로젝트의 문서에 기본 접근할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.accessibleSites.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    접근 가능한 프로젝트가 없습니다.
                  </div>
                ) : (
                  session.accessibleSites.map((site) => (
                    <div key={site.siteId} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{site.siteName}</div>
                          <div className="mt-1 text-xs text-slate-500">연결 문서 {site.documentCount}건</div>
                        </div>
                        <Badge variant="outline">{site.accessRole}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>접근 가능한 문서</CardTitle>
                <CardDescription>문서별 권한이 있거나, 프로젝트 권한으로 열람 가능한 문서입니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.accessibleDocuments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    접근 가능한 문서가 없습니다.
                  </div>
                ) : (
                  session.accessibleDocuments.map((document) => (
                    <div key={document.documentId} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <div className="truncate text-sm font-semibold text-slate-900">{document.title}</div>
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {document.siteName} · 현재 버전 {document.currentVersionNumber || 0} · {document.accessSource}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={document.accessRole === 'editor' ? 'green' : 'outline'}>
                            {getDocumentRoleLabel(document.accessRole)}
                          </Badge>
                          <Link href={`/member-access/document/${document.documentId}`}>
                            <Button className="gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              문서 열기
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>번호 인증</CardTitle>
            <CardDescription>초대받은 휴대폰 번호와 받은 인증번호를 입력하면 접근 세션이 생성됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">휴대폰 번호</div>
              <Input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="예: 01012345678"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">인증번호</div>
              <Input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="6자리 인증번호"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            <div className="sm:col-span-2">
              <Button className="w-full sm:w-auto" onClick={handleVerify} disabled={submitting}>
                {submitting ? '인증 중...' : '서비스 접근 인증'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
