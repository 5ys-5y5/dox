'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type {
  BulkCommitResult,
  BulkPreviewResult,
} from '../../lib/bulkOperationDtos';
import type { DocumentListItem } from '../../lib/documentDtos';

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
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [previewResult, setPreviewResult] = React.useState<BulkPreviewResult | null>(null);
  const [commitResult, setCommitResult] = React.useState<BulkCommitResult | null>(null);
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
      setSelectedDocumentIds((previous) => previous.filter((id) => nextDocuments.some((item) => item.document.id === id)));
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

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/bulk-ops/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId,
          confirmedBy,
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
          <Badge variant="slate">BULK-EDIT-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">일괄 정보 입력</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            같은 라벨 키를 가진 여러 문서에 일반 값만 한 번에 넣거나 수정하거나 삭제하는 1차 골격입니다.
            이번 단계는 미리보기와 커밋 이력까지 다룹니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            서명 라벨은 `BULK-EDIT-04` 전까지 차단합니다. `signature` 계열 라벨은 미리보기에서 `blocked`
            로만 표시됩니다.
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
                <label className="text-sm font-medium text-slate-800">현장 ID</label>
                <Input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">라벨 변경 JSON</label>
              <textarea
                value={labelChangesText}
                onChange={(event) => setLabelChangesText(event.target.value)}
                className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>미리보기 결과</CardTitle>
              <CardDescription>preview ID, 경고 수, 적용 가능 항목 수를 요약합니다.</CardDescription>
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
              <CardDescription>미리보기 확정 후 실제로 새 버전이 생성된 문서 수를 보여줍니다.</CardDescription>
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
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">현재 라벨 값</p>
                    <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
                      {JSON.stringify(item.latestVersion?.labelValues || {}, null, 2)}
                    </pre>
                  </div>
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
              <p className="text-sm font-medium text-amber-900">경고</p>
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
