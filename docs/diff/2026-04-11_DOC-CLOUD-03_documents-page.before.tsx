'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { DocumentCreateResult, DocumentListItem } from '../../lib/documentDtos';

const defaultHtmlTemplate = `<section data-document-root="true">
  <h1>현장 서류 예시</h1>
  <p>현장명: <span data-label="site_name">서울 A현장</span></p>
  <p>책임자: <span data-label="manager_name">홍길동</span></p>
</section>`;

const defaultLabelValues = JSON.stringify(
  {
    site_name: '서울 A현장',
    manager_name: '홍길동',
  },
  null,
  2
);

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'draft':
      return 'amber' as const;
    case 'archived':
      return 'slate' as const;
    case 'deleted':
      return 'red' as const;
    default:
      return 'outline' as const;
  }
};

export default function DocumentsPage() {
  const [siteId, setSiteId] = React.useState('site-demo-001');
  const [documentTypeKey, setDocumentTypeKey] = React.useState('safety-plan');
  const [title, setTitle] = React.useState('안전관리계획서');
  const [templateId, setTemplateId] = React.useState('');
  const [htmlCanonical, setHtmlCanonical] = React.useState(defaultHtmlTemplate);
  const [labelValuesText, setLabelValuesText] = React.useState(defaultLabelValues);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [latestCreated, setLatestCreated] = React.useState<DocumentCreateResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/documents?siteId=${encodeURIComponent(siteId)}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 목록 조회에 실패했습니다.');
      }

      setDocuments(result.data);
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

  const handleCreateDocument = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const labelValues = JSON.parse(labelValuesText) as Record<string, unknown>;
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          documentTypeKey,
          title,
          templateId: templateId.trim() || null,
          htmlCanonical,
          labelValues,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 생성에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setMessage('문서 메타데이터와 초기 버전이 저장되었습니다.');
      await loadDocuments();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">DOC-CLOUD-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">서류 클라우드 관리</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문서 메타데이터, HTML 정본, 출력본 메타데이터를 분리 저장하는 1차 골격입니다. 지금 화면에서는
            문서 등록과 최신본 목록 확인까지만 다룹니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDocuments()} disabled={loading}>
            목록 새로고침
          </Button>
          <Button onClick={handleCreateDocument} disabled={loading}>
            문서 저장
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>문서 등록</CardTitle>
            <CardDescription>
              문서 메타데이터와 초기 HTML 정본을 함께 저장합니다. 출력본 파일은 아직 생성하지 않으며,
              메타데이터만 분리 테이블로 준비합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">현장 ID</label>
                <Input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">문서 종류 키</label>
                <Input
                  value={documentTypeKey}
                  onChange={(event) => setDocumentTypeKey(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">문서 제목</label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">템플릿 ID</label>
                <Input
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  placeholder="선택 입력"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">HTML 정본</label>
              <textarea
                value={htmlCanonical}
                onChange={(event) => setHtmlCanonical(event.target.value)}
                className="flex min-h-[260px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">라벨 값 JSON</label>
              <textarea
                value={labelValuesText}
                onChange={(event) => setLabelValuesText(event.target.value)}
                className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>이번 등록 결과</CardTitle>
              <CardDescription>가장 최근 생성한 문서의 핵심 메타데이터를 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {latestCreated ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="green">{latestCreated.document.status}</Badge>
                    <span className="font-medium text-slate-900">{latestCreated.document.title}</span>
                  </div>
                  <p>문서 ID: {latestCreated.document.id}</p>
                  <p>버전 ID: {latestCreated.latestVersion.id}</p>
                  <p>HTML SHA-256: {latestCreated.latestVersion.htmlSha256}</p>
                  <p>정규화 방식: {latestCreated.latestVersion.htmlCanonicalization}</p>
                  <p>바이트 길이: {latestCreated.latestVersion.htmlByteLength}</p>
                </>
              ) : (
                <p className="text-slate-500">아직 생성된 문서가 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>현장 문서 목록</CardTitle>
              <CardDescription>
                `deleted_at` 이 비어 있는 문서만 조회합니다. soft delete 정책이 다음 단계에서도 유지되어야
                합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents.length === 0 ? (
                <p className="text-sm text-slate-500">등록된 문서가 없습니다.</p>
              ) : (
                documents.map((item) => (
                  <div key={item.document.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getStatusVariant(item.document.status)}>{item.document.status}</Badge>
                      <span className="font-medium text-slate-900">{item.document.title}</span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>문서 ID: {item.document.id}</p>
                      <p>현장 ID: {item.document.siteId}</p>
                      <p>문서 종류: {item.document.documentTypeKey}</p>
                      <p>최신 버전: {item.latestVersion?.versionNumber ?? '-'}</p>
                      <p>HTML SHA-256: {item.latestVersion?.htmlSha256 ?? '-'}</p>
                      <p>출력본 개수: {item.artifactCount}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
