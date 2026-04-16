'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type {
  BulkChangeAction,
  BulkCommitResult,
  BulkPreviewResult,
} from '../../lib/bulkOperationDtos';
import type { DocumentListItem } from '../../lib/documentDtos';
import type { SiteRecordDto } from '../../lib/siteChecklistDtos';

type VerifiedAuthenticationOption = {
  id: string;
  requestId: string;
  documentId: string | null;
  documentTitle: string | null;
  signerName: string | null;
  providerLabel: string;
  verifiedAt: string;
};

const labelCatalog: Record<
  string,
  {
    label: string;
    hint: string;
    keywords: string[];
    signature?: boolean;
  }
> = {
  manager_name: {
    label: '담당자 이름',
    hint: '문서의 담당자 이름을 바꿉니다.',
    keywords: ['manager', '담당자'],
  },
  site_name: {
    label: '현장명',
    hint: '문서의 현장명을 바꿉니다.',
    keywords: ['site', '현장'],
  },
  work_date: {
    label: '작업일',
    hint: '문서의 작업일을 바꿉니다.',
    keywords: ['date', '날짜', '작업일'],
  },
  manager_signature: {
    label: '관리자 서명',
    hint: '서명 항목은 검증 완료된 본인확인 기록이 있어야 바꿀 수 있습니다.',
    keywords: ['signature', 'sign', '서명'],
    signature: true,
  },
};

const defaultLabelChanges = JSON.stringify(
  [
    {
      labelKey: 'manager_name',
      action: 'upsert',
      value: '김철수',
    },
  ],
  null,
  2
);

const buildSingleChangeText = (labelKey: string, action: BulkChangeAction, value: string) =>
  JSON.stringify(
    [
      action === 'delete'
        ? {
            labelKey,
            action,
          }
        : {
            labelKey,
            action,
            value,
          },
    ],
    null,
    2
  );

const humanizeLabelKey = (labelKey: string) =>
  labelCatalog[labelKey]?.label ||
  labelKey
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const getItemStatusVariant = (status: string) => {
  switch (status) {
    case 'apply':
      return 'green' as const;
    case 'skip':
      return 'amber' as const;
    case 'blocked':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

export default function BulkOpsPage() {
  const [siteId, setSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [requestedBy, setRequestedBy] = React.useState('ops-demo-user');
  const [confirmedBy, setConfirmedBy] = React.useState('ops-demo-admin');
  const [labelChangesText, setLabelChangesText] = React.useState(defaultLabelChanges);
  const [advancedMode, setAdvancedMode] = React.useState(false);
  const [simpleLabelKey, setSimpleLabelKey] = React.useState('manager_name');
  const [simpleAction, setSimpleAction] = React.useState<BulkChangeAction>('upsert');
  const [simpleValue, setSimpleValue] = React.useState('김철수');
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [authentications, setAuthentications] = React.useState<VerifiedAuthenticationOption[]>([]);
  const [selectedAuthenticationId, setSelectedAuthenticationId] = React.useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [previewResult, setPreviewResult] = React.useState<BulkPreviewResult | null>(null);
  const [commitResult, setCommitResult] = React.useState<BulkCommitResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const parsedLabelChanges = React.useMemo(() => {
    try {
      const parsed = JSON.parse(labelChangesText);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [labelChangesText]);

  const hasSignatureLabels = React.useMemo(
    () =>
      parsedLabelChanges.some(
        (change) =>
          typeof change?.labelKey === 'string' &&
          (/(^|_)signature($|_)/i.test(change.labelKey) || /sign/i.test(change.labelKey))
      ),
    [parsedLabelChanges]
  );

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

  const selectedDocuments = React.useMemo(
    () => documents.filter((item) => selectedDocumentIds.includes(item.document.id)),
    [documents, selectedDocumentIds]
  );

  const fieldOptions = React.useMemo(() => {
    const knownOptions = Object.entries(labelCatalog).map(([id, config]) => ({
      id,
      label: config.label,
      meta: config.hint,
      keywords: config.keywords,
    }));

    const discovered = new Map<string, { id: string; label: string; meta: string; keywords: string[] }>();

    for (const item of selectedDocuments) {
      const labelValues = item.latestVersion?.labelValues || {};
      for (const key of Object.keys(labelValues)) {
        if (discovered.has(key) || labelCatalog[key]) {
          continue;
        }

        discovered.set(key, {
          id: key,
          label: humanizeLabelKey(key),
          meta: '선택한 문서에서 이미 사용 중인 항목입니다.',
          keywords: [key],
        });
      }
    }

    return [...knownOptions, ...discovered.values()];
  }, [selectedDocuments]);

  const matchingAuthentications = React.useMemo(() => {
    if (!hasSignatureLabels || selectedDocumentIds.length !== 1) {
      return [];
    }

    return authentications.filter((authentication) => authentication.documentId === selectedDocumentIds[0]);
  }, [authentications, hasSignatureLabels, selectedDocumentIds]);

  const authOptions = React.useMemo(
    () =>
      matchingAuthentications.map((authentication) => ({
        id: authentication.id,
        label: authentication.documentTitle || authentication.signerName || '검증 완료된 인증',
        meta: [
          authentication.signerName || '서명자 정보 없음',
          authentication.providerLabel,
          new Date(authentication.verifiedAt).toLocaleString('ko-KR'),
        ]
          .filter(Boolean)
          .join(' / '),
        keywords: [
          authentication.signerName || '',
          authentication.documentTitle || '',
          authentication.documentId || '',
          authentication.requestId,
          authentication.providerLabel,
        ],
      })),
    [matchingAuthentications]
  );

  const loadSites = React.useCallback(async () => {
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '현장 목록 조회에 실패했습니다.');
      }

      const nextSites = result.data.sites as SiteRecordDto[];
      setSites(nextSites);
      setSiteId((previous) => {
        if (previous && nextSites.some((site) => site.id === previous)) {
          return previous;
        }

        return nextSites[0]?.id || previous;
      });
    } catch {
      // 현장 목록 조회 실패는 문서 목록 흐름을 막지 않습니다.
    }
  }, []);

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
      setSelectedDocumentIds((previous) => previous.filter((id) => nextDocuments.some((item) => item.document.id === id)));
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadAuthentications = React.useCallback(async () => {
    if (!hasSignatureLabels) {
      setAuthentications([]);
      setSelectedAuthenticationId('');
      return;
    }

    try {
      const response = await fetch('/api/sign/authentications?limit=12', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '본인확인 목록 조회에 실패했습니다.');
      }

      const nextAuthentications = (result.data?.authentications || []) as VerifiedAuthenticationOption[];
      setAuthentications(nextAuthentications);
      setSelectedAuthenticationId((previous) => {
        if (previous && nextAuthentications.some((item) => item.id === previous)) {
          return previous;
        }

        return nextAuthentications[0]?.id || '';
      });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '본인확인 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    }
  }, [hasSignatureLabels]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  React.useEffect(() => {
    void loadSites();
  }, [loadSites]);

  React.useEffect(() => {
    void loadAuthentications();
  }, [loadAuthentications]);

  React.useEffect(() => {
    if (advancedMode) {
      return;
    }

    setLabelChangesText(buildSingleChangeText(simpleLabelKey, simpleAction, simpleValue));
  }, [advancedMode, simpleAction, simpleLabelKey, simpleValue]);

  React.useEffect(() => {
    if (fieldOptions.some((option) => option.id === simpleLabelKey)) {
      return;
    }

    if (fieldOptions[0]?.id) {
      setSimpleLabelKey(fieldOptions[0].id);
    }
  }, [fieldOptions, simpleLabelKey]);

  React.useEffect(() => {
    if (!hasSignatureLabels) {
      setSelectedAuthenticationId('');
      return;
    }

    if (matchingAuthentications.some((item) => item.id === selectedAuthenticationId)) {
      return;
    }

    setSelectedAuthenticationId('');
  }, [hasSignatureLabels, matchingAuthentications, selectedAuthenticationId]);

  const toggleDocument = (documentId: string) => {
    setSelectedDocumentIds((previous) =>
      previous.includes(documentId) ? previous.filter((id) => id !== documentId) : [...previous, documentId]
    );
  };

  const handlePreview = async () => {
    if (selectedDocumentIds.length === 0) {
      setMessage('미리보기할 문서를 최소 1개 이상 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/bulk-ops/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: selectedDocumentIds,
          labelChanges: JSON.parse(labelChangesText),
          requestedBy,
          signatureAuthorization: hasSignatureLabels
            ? {
                authenticationId: selectedAuthenticationId,
                approvedBy: confirmedBy,
              }
            : null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '일괄 수정 미리보기에 실패했습니다.');
      }

      setPreviewResult(result.data);
      setCommitResult(null);
      setMessage(`preview ${result.data.preview.id} 를 생성했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '일괄 수정 미리보기에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    const previewId = previewResult?.preview.id;

    if (!previewId) {
      setMessage('먼저 미리보기를 생성하세요.');
      return;
    }

    if (hasSignatureLabels && !selectedAuthenticationId) {
      setMessage('서명 라벨 반영에는 검증 완료된 본인확인 기록 선택이 필요합니다.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/bulk-ops/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId,
          confirmedBy,
          signatureAuthorization: hasSignatureLabels
            ? {
                authenticationId: selectedAuthenticationId,
                approvedBy: confirmedBy,
              }
            : null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '일괄 수정 반영에 실패했습니다.');
      }

      setCommitResult(result.data);
      setMessage(
        `일괄 수정 반영 완료: 업데이트 ${result.data.updatedDocumentCount}건, 건너뜀 ${result.data.skippedDocumentCount}건`
      );
      await loadDocuments();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '일괄 수정 반영에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">BULK-EDIT-04</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">일괄 정보 입력</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            여러 문서에서 같은 항목을 한 번에 바꿉니다. 먼저 문서를 고르고, 바꿀 항목과 새 값을 정한 뒤
            미리보기로 확인하고 반영합니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            서명 항목은 더 엄격합니다. 한 번에 한 문서만 바꿀 수 있고, 그 문서용으로 검증 완료된 본인확인 기록이 있어야 합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDocuments()} disabled={loading}>
            문서 목록 새로고침
          </Button>
          <Button variant="outline" onClick={handlePreview} disabled={loading}>
            미리보기 계산
          </Button>
          <Button onClick={handleCommit} disabled={loading}>
            일괄 반영
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
            <CardTitle>대상 문서와 변경 라벨</CardTitle>
            <CardDescription>
              같은 `siteId` 문서를 불러와 선택하고, 라벨 변경 JSON을 입력해 미리보기를 만듭니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-800">현장 선택</label>
                <EntityPicker
                  value={siteId}
                  options={siteOptions}
                  onChange={setSiteId}
                  placeholder="현장을 선택하세요"
                  emptyMessage="저장된 현장이 없습니다."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">요청자</label>
                <Input value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <label className="text-sm font-medium text-slate-800">확정자</label>
                <Input value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">바꿀 항목</label>
                <EntityPicker
                  value={simpleLabelKey}
                  options={fieldOptions}
                  onChange={setSimpleLabelKey}
                  placeholder="바꿀 항목을 선택하세요"
                  emptyMessage="선택 가능한 항목이 없습니다."
                />
                <p className="text-xs text-slate-500">
                  먼저 문서를 고른 뒤, 여러 문서에서 같은 항목을 함께 바꿀 때만 사용하세요.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">변경 방식</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={simpleAction === 'upsert' ? 'default' : 'outline'}
                      onClick={() => setSimpleAction('upsert')}
                    >
                      값 바꾸기
                    </Button>
                    <Button
                      type="button"
                      variant={simpleAction === 'delete' ? 'default' : 'outline'}
                      onClick={() => setSimpleAction('delete')}
                    >
                      값 지우기
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">새 값</label>
                  <Input
                    value={simpleValue}
                    onChange={(event) => setSimpleValue(event.target.value)}
                    disabled={simpleAction === 'delete'}
                    placeholder={simpleAction === 'delete' ? '값 지우기 선택 시 입력하지 않습니다.' : '새 값을 입력하세요'}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">현재 변경 요약</p>
                <p className="mt-1">
                  {humanizeLabelKey(simpleLabelKey)} / {simpleAction === 'delete' ? '값 지우기' : `새 값: ${simpleValue || '(비어 있음)'}`}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdvancedMode((current) => !current)}
                >
                  {advancedMode ? '고급 입력 닫기' : '고급 입력 열기'}
                </Button>
                {advancedMode ? (
                  <>
                    <label className="text-sm font-medium text-slate-800">고급 JSON 입력</label>
                    <textarea
                      value={labelChangesText}
                      onChange={(event) => setLabelChangesText(event.target.value)}
                      className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <p className="text-xs text-slate-500">
                      여러 항목을 한 번에 바꿔야 할 때만 JSON을 직접 수정하세요.
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            {hasSignatureLabels ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm font-medium text-slate-800">검증 완료된 본인확인 기록</label>
                {selectedDocumentIds.length !== 1 ? (
                  <p className="text-sm text-amber-700">
                    서명 항목은 한 번에 한 문서만 수정할 수 있습니다. 먼저 문서를 1개만 선택하세요.
                  </p>
                ) : (
                  <>
                    <EntityPicker
                      value={selectedAuthenticationId}
                      options={authOptions}
                      onChange={setSelectedAuthenticationId}
                      placeholder="선택한 문서용 인증을 고르세요"
                      emptyMessage="이 문서에 연결된 검증 완료 인증이 없습니다."
                    />
                    <p className="text-xs text-slate-500">
                      서명 항목은 이 문서에 대해 검증 완료된 인증을 골라야 합니다. 추가 승인자는 현재 `확정자` 값으로 기록됩니다.
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>미리보기 결과</CardTitle>
              <CardDescription>반영 전에 몇 건이 실제 적용되는지 먼저 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {previewResult ? (
                <>
                  <p>Preview ID: {previewResult.preview.id}</p>
                  <p>대상 문서 수: {previewResult.preview.documentCount}</p>
                  <p>라벨 변경 수: {previewResult.preview.changeCount}</p>
                  <p>경고 수: {previewResult.warnings.length}</p>
                  <p>
                    적용 가능 항목 수:{' '}
                    {previewResult.items.filter((item) => item.itemStatus === 'apply').length}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">아직 생성된 미리보기가 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>커밋 결과</CardTitle>
              <CardDescription>미리보기 확인 후 실제로 반영된 문서 수를 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {commitResult ? (
                <>
                  <p>Commit ID: {commitResult.commit.id}</p>
                  <p>업데이트 문서 수: {commitResult.updatedDocumentCount}</p>
                  <p>건너뜀 문서 수: {commitResult.skippedDocumentCount}</p>
                </>
              ) : (
                <p className="text-slate-500">아직 반영된 커밋이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>대상 문서 목록</CardTitle>
          <CardDescription>선택한 문서만 미리보기와 커밋 대상에 포함합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.length > 0 ? (
            documents.map((item) => {
              const isSelected = selectedDocumentIds.includes(item.document.id);

              return (
                <label
                  key={item.document.id}
                  className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-4 ${
                    isSelected ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDocument(item.document.id)}
                    />
                    <Badge variant="green">{item.document.status}</Badge>
                    <span className="font-medium text-slate-900">{item.document.title}</span>
                  </div>
                  <p className="text-xs text-slate-500">{item.document.id}</p>
                  <p className="text-sm text-slate-600">
                    문서 종류: {item.document.documentTypeKey} / 최신 버전:{' '}
                    {item.document.currentVersionNumber || '-'}
                  </p>
                </label>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">조회된 문서가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>미리보기 상세</CardTitle>
          <CardDescription>`apply`, `skip`, `blocked` 상태를 문서별로 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewResult?.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">먼저 확인할 내용</p>
              {previewResult.warnings.map((warning) => (
                <p key={warning} className="mt-2 text-sm text-amber-800">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          {previewResult?.items.length ? (
            previewResult.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getItemStatusVariant(item.itemStatus)}>{item.itemStatus}</Badge>
                  <span className="font-medium text-slate-900">{item.documentTitle}</span>
                  <span className="text-xs text-slate-500">{item.labelKey}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">변경 전</p>
                    <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
                      {JSON.stringify(item.beforeValue, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">변경 후</p>
                    <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
                      {JSON.stringify(item.afterValue, null, 2)}
                    </pre>
                  </div>
                </div>
                {item.warningText ? <p className="mt-3 text-sm text-rose-700">{item.warningText}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">아직 계산된 미리보기가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
