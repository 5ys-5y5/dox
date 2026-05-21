'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ExternalLink, FileText, FolderKanban, KeyRound, LogOut, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { MejaiScrollTable, type MejaiScrollTableColumn, type MejaiScrollTableRow } from '../../components/ui/MejaiScrollTable';
import { formatMemberAccessErrorMessage } from '../../lib/memberAccessErrors';
import type { MemberAccessSessionDto } from '../../lib/memberAccessDtos';
import { MemberAccessVerificationCard } from './MemberAccessVerificationCard';

type AccessibleSite = MemberAccessSessionDto['accessibleSites'][number];
type AccessibleDocument = MemberAccessSessionDto['accessibleDocuments'][number];
type AccessibleDocumentGroup = {
  siteId: string;
  siteName: string;
  documents: AccessibleDocument[];
};
type DocumentRoleFilter = AccessibleDocument['accessRole'] | 'all';

const MEMBER_ACCESS_INFO_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '항목',
    width: 176,
    minWidth: 152,
    maxWidth: 220,
    clampLines: 2,
  },
  {
    key: 'status',
    label: '상태',
    width: 96,
    minWidth: 88,
    maxWidth: 116,
    align: 'center',
    clampLines: 1,
  },
  {
    key: 'summary',
    label: '내용',
    width: 300,
    minWidth: 220,
    maxWidth: 380,
    clampLines: 2,
  },
  {
    key: 'source',
    label: '출처',
    width: 176,
    minWidth: 152,
    maxWidth: 220,
    clampLines: 2,
  },
];

const MEMBER_ACCESS_ACTION_COLUMN: MejaiScrollTableColumn = {
  key: 'action',
  label: '열기',
  width: 52,
  minWidth: 52,
  maxWidth: 52,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'border-l border-slate-200',
  cellClassName: 'border-l border-slate-200',
};

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return value;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return dateTimeFormatter.format(date);
};

const getSiteRoleLabel = (role: AccessibleSite['accessRole']) => {
  switch (role) {
    case 'owner':
      return '현장 소유자';
    case 'manager':
      return '현장 관리자';
    case 'participant':
    case 'editor':
      return '현장 참여자';
    case 'viewer':
    default:
      return '현장 참여자';
  }
};

const getSiteRoleVariant = (role: AccessibleSite['accessRole']) => {
  switch (role) {
    case 'owner':
      return 'green' as const;
    case 'manager':
      return 'blue' as const;
    case 'participant':
    case 'editor':
      return 'amber' as const;
    case 'viewer':
    default:
      return 'outline' as const;
  }
};

const getDocumentRoleLabel = (role: AccessibleDocument['accessRole']) => {
  switch (role) {
    case 'editor':
      return '편집 가능';
    case 'signer':
    case 'viewer':
    default:
      return '열람 가능';
  }
};

const getDocumentRoleVariant = (role: AccessibleDocument['accessRole']) => {
  switch (role) {
    case 'editor':
      return 'green' as const;
    case 'signer':
    case 'viewer':
    default:
      return 'outline' as const;
  }
};

const getDocumentAccessSourceLabel = (source: AccessibleDocument['accessSource']) => {
  switch (source) {
    case 'site':
      return '현장 접근 권한';
    case 'document':
      return '문서 접근 권한';
    case 'site+document':
      return '현장+문서 접근 권한';
    default:
      return source;
  }
};

const groupAccessibleDocumentsByProject = (documents: AccessibleDocument[]): AccessibleDocumentGroup[] => {
  const groups = new Map<string, AccessibleDocumentGroup>();

  documents.forEach((document) => {
    const siteId = document.siteId || document.siteName || 'unknown-project';
    const existingGroup = groups.get(siteId);

    if (existingGroup) {
      existingGroup.documents.push(document);
      return;
    }

    groups.set(siteId, {
      siteId,
      siteName: document.siteName || '현장 없음',
      documents: [document],
    });
  });

  return Array.from(groups.values());
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 min-w-0 break-words text-xl font-semibold leading-tight text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function MemberAccessInfoList({
  rows,
  emptyMessage,
  maxBodyHeightClassName,
  minTableWidth,
}: {
  rows: MejaiScrollTableRow[];
  emptyMessage: React.ReactNode;
  maxBodyHeightClassName?: string;
  minTableWidth?: number;
}) {
  const hasActionColumn = rows.some((row) => Boolean(row.cells.action));
  const columns = hasActionColumn ? [...MEMBER_ACCESS_INFO_COLUMNS, MEMBER_ACCESS_ACTION_COLUMN] : MEMBER_ACCESS_INFO_COLUMNS;

  return (
    <MejaiScrollTable
      columns={columns}
      rows={rows}
      emptyMessage={emptyMessage}
      maxHeightClassName={maxBodyHeightClassName}
      minTableWidth={minTableWidth || (hasActionColumn ? 800 : 748)}
    />
  );
}

export default function MemberAccessPage() {
  const router = useRouter();
  const [session, setSession] = React.useState<MemberAccessSessionDto | null>(null);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selectedSiteFilter, setSelectedSiteFilter] = React.useState('all');
  const [documentRoleFilter, setDocumentRoleFilter] = React.useState<DocumentRoleFilter>('all');
  const [documentSearch, setDocumentSearch] = React.useState('');

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
      setMessage(formatMemberAccessErrorMessage(error, '구성원 세션을 확인하지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSession();
  }, [loadSession]);

  React.useEffect(() => {
    if (!session || selectedSiteFilter === 'all') {
      return;
    }

    const hasSelectedSite = session.accessibleDocuments.some((document) => document.siteId === selectedSiteFilter);

    if (!hasSelectedSite) {
      setSelectedSiteFilter('all');
    }
  }, [selectedSiteFilter, session]);

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
      setSelectedSiteFilter('all');
      setDocumentRoleFilter('all');
      setDocumentSearch('');
      setSession(result.data as MemberAccessSessionDto);
      setMessage('번호 인증이 완료되었습니다.');
    } catch (error) {
      setMessage(formatMemberAccessErrorMessage(error, '구성원 인증에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/member-access/session', { method: 'DELETE' });
    setSession(null);
    setSelectedSiteFilter('all');
    setDocumentRoleFilter('all');
    setDocumentSearch('');
    setMessage('접근 세션을 종료했습니다.');
  };

  const filteredDocuments = React.useMemo(() => {
    const documents = session?.accessibleDocuments || [];
    const query = documentSearch.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesSite = selectedSiteFilter === 'all' || document.siteId === selectedSiteFilter;
      const matchesRole = documentRoleFilter === 'all' || document.accessRole === documentRoleFilter;
      const matchesQuery =
        !query ||
        document.title.toLowerCase().includes(query) ||
        document.siteName.toLowerCase().includes(query) ||
        getDocumentAccessSourceLabel(document.accessSource).toLowerCase().includes(query);

      return matchesSite && matchesRole && matchesQuery;
    });
  }, [documentRoleFilter, documentSearch, selectedSiteFilter, session]);

  const accessibleDocumentGroups = React.useMemo(() => groupAccessibleDocumentsByProject(filteredDocuments), [filteredDocuments]);
  const directDocumentCount = React.useMemo(
    () => (session?.accessibleDocuments || []).filter((document) => document.accessSource !== 'site').length,
    [session]
  );

  const siteRows = React.useMemo<MejaiScrollTableRow[]>(() => {
    if (!session) {
      return [];
    }

    return session.accessibleSites.map((site) => ({
      key: site.siteId,
      selected: selectedSiteFilter === site.siteId,
      title: `${site.siteName} / ${getSiteRoleLabel(site.accessRole)}`,
      ariaLabel: `${site.siteName} 현장 문서 필터`,
      onClick: () => setSelectedSiteFilter(site.siteId),
      cells: {
        label: (
          <div className="flex min-w-0 items-center gap-2">
            <FolderKanban className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate text-xs font-semibold text-slate-900">{site.siteName}</span>
          </div>
        ),
        status: (
          <Badge variant={getSiteRoleVariant(site.accessRole)} className="px-1.5 py-0 text-[10px] font-semibold leading-5">
            {getSiteRoleLabel(site.accessRole)}
          </Badge>
        ),
        summary: `연결 문서 ${site.documentCount.toLocaleString('ko-KR')}건`,
        source: '현장 접근 권한',
      },
    }));
  }, [selectedSiteFilter, session]);

  const buildDocumentRows = React.useCallback(
    (documents: AccessibleDocument[]): MejaiScrollTableRow[] =>
      documents.map((document) => ({
        key: document.documentId,
        title: `${document.title} / ${getDocumentRoleLabel(document.accessRole)}`,
        ariaLabel: `${document.title} 문서 열기`,
        onClick: () => router.push(`/member-access/document/${document.documentId}`),
        cells: {
          label: (
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate text-xs font-semibold text-slate-900">{document.title}</span>
            </div>
          ),
          status: (
            <Badge variant={getDocumentRoleVariant(document.accessRole)} className="px-1.5 py-0 text-[10px] font-semibold leading-5">
              {getDocumentRoleLabel(document.accessRole)}
            </Badge>
          ),
          summary: `현재 버전 ${document.currentVersionNumber || 0} · 마지막 변경 ${formatDateTime(document.updatedAt)}`,
          source: getDocumentAccessSourceLabel(document.accessSource),
          action: (
            <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <Link
                href={`/member-access/document/${document.documentId}`}
                aria-label={`${document.title} 문서 열기`}
                onClick={(event) => event.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">문서 열기</span>
              </Link>
            </Button>
          ),
        },
      })),
    [router]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">MEMBER-DOCUMENT-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">구성원 문서 접근</h1>
          <p className="max-w-4xl text-sm text-slate-600">
            번호 인증을 통과한 구성원이 현장별 문서와 문서별 권한을 확인하는 화면입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadSession()} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            새로고침
          </Button>
          {session ? (
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              세션 종료
            </Button>
          ) : null}
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-6 text-sm text-slate-600">구성원 접근 세션을 확인하는 중입니다.</CardContent>
        </Card>
      ) : session ? (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
          <Card className="min-w-0 border-slate-200">
            <CardHeader>
              <CardTitle>1. 접근 번호와 현장</CardTitle>
              <CardDescription>인증된 번호와 이 번호에 연결된 현장 접근 권한입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="member-access-display-name" className="text-sm font-medium text-slate-800">
                    이름
                  </label>
                  <Input
                    id="member-access-display-name"
                    name="memberAccessDisplayName"
                    value={session.member.displayName || '이름 없음'}
                    readOnly
                    className="bg-slate-50 text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="member-access-session-phone-number" className="text-sm font-medium text-slate-800">
                    휴대폰 번호
                  </label>
                  <Input
                    id="member-access-session-phone-number"
                    name="memberAccessSessionPhoneNumber"
                    value={formatPhoneNumber(session.member.phoneNumber)}
                    readOnly
                    className="bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard
                  icon={FolderKanban}
                  label="현장"
                  value={`${session.accessibleSites.length.toLocaleString('ko-KR')}건`}
                  description="현장 단위 접근 권한"
                />
                <MetricCard
                  icon={FileText}
                  label="문서"
                  value={`${session.accessibleDocuments.length.toLocaleString('ko-KR')}건`}
                  description="현재 번호로 열 수 있는 문서"
                />
                <MetricCard
                  icon={ShieldCheck}
                  label="직접 문서 권한"
                  value={`${directDocumentCount.toLocaleString('ko-KR')}건`}
                  description="문서 단위로 부여된 권한"
                />
                <MetricCard
                  icon={KeyRound}
                  label="인증 시각"
                  value={formatDateTime(session.authenticatedAt)}
                  description="현재 브라우저 세션 기준"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">현장 접근 권한</label>
                <MemberAccessInfoList
                  rows={siteRows}
                  emptyMessage="접근 가능한 현장이 없습니다."
                  maxBodyHeightClassName="max-h-[220px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-200">
            <CardHeader>
              <CardTitle>2. 접근 가능한 문서</CardTitle>
              <CardDescription>현장별로 묶인 문서와 문서별 권한입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_176px_164px]">
                <div className="min-w-0 space-y-2">
                  <label htmlFor="member-access-document-search" className="text-xs font-medium text-slate-700">
                    문서 검색
                  </label>
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="member-access-document-search"
                      name="memberAccessDocumentSearch"
                      value={documentSearch}
                      onChange={(event) => setDocumentSearch(event.target.value)}
                      placeholder="문서 또는 현장 검색"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="member-access-site-filter" className="text-xs font-medium text-slate-700">
                    현장 필터
                  </label>
                  <select
                    id="member-access-site-filter"
                    name="memberAccessSiteFilter"
                    value={selectedSiteFilter}
                    onChange={(event) => setSelectedSiteFilter(event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="현장 필터"
                  >
                    <option value="all">전체 현장</option>
                    {session.accessibleSites.map((site) => (
                      <option key={site.siteId} value={site.siteId}>
                        {site.siteName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="member-access-role-filter" className="text-xs font-medium text-slate-700">
                    권한 필터
                  </label>
                  <select
                    id="member-access-role-filter"
                    name="memberAccessRoleFilter"
                    value={documentRoleFilter}
                    onChange={(event) => setDocumentRoleFilter(event.target.value as DocumentRoleFilter)}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="문서 권한 필터"
                  >
                    <option value="all">전체 권한</option>
                    <option value="editor">편집 가능</option>
                    <option value="viewer">열람 가능</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredDocuments.length === 0 ? (
                  <EmptyState title="표시할 문서가 없습니다." description="검색어 또는 필터 조건을 바꿔 다시 확인하세요." />
                ) : (
                  accessibleDocumentGroups.map((group) => (
                    <div key={group.siteId} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate text-sm font-medium text-slate-800">{group.siteName}</div>
                        <Badge variant="slate">문서 {group.documents.length.toLocaleString('ko-KR')}건</Badge>
                      </div>
                      <MemberAccessInfoList
                        rows={buildDocumentRows(group.documents)}
                        emptyMessage="표시할 문서가 없습니다."
                        maxBodyHeightClassName="max-h-[260px]"
                      />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
          <MemberAccessVerificationCard
            className="min-w-0"
            title="1. 번호 인증"
            description="초대된 번호와 인증번호로 문서 접근 세션을 시작합니다."
            phoneNumber={phoneNumber}
            accessCode={accessCode}
            submitting={submitting}
            onPhoneNumberChange={setPhoneNumber}
            onAccessCodeChange={setAccessCode}
            onSubmit={handleVerify}
          />

          <Card className="min-w-0 border-slate-200">
            <CardHeader>
              <CardTitle>2. 접근 문서</CardTitle>
              <CardDescription>인증 후 현장별 문서와 권한이 이 영역에 표시됩니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState title="인증된 번호가 없습니다." description="접근 가능한 문서 목록을 아직 불러오지 않았습니다." />
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
