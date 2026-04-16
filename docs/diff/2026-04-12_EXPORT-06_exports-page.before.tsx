'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { DocumentArtifactDto, DocumentListItem } from '../../lib/documentDtos';
import type { ExportJobCreateResult, ExportJobDetailResult, ExportTargetFormat } from '../../lib/exportDtos';

export default function ExportsPage() {
  const [siteId, setSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState('');
  const [versionId, setVersionId] = React.useState('');
  const [targetFormat, setTargetFormat] = React.useState<ExportTargetFormat>('pdf');
  const [requestedBy, setRequestedBy] = React.useState('export-demo-user');
  const [latestCreated, setLatestCreated] = React.useState<ExportJobCreateResult | null>(null);
  const [jobDetail, setJobDetail] = React.useState<ExportJobDetailResult | null>(null);
  const [artifacts, setArtifacts] = React.useState<DocumentArtifactDto[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const getArtifactDownloadUrl = React.useCallback((artifact: DocumentArtifactDto) => {
    const exportJobId = typeof artifact.metadata.exportJobId === 'string' ? artifact.metadata.exportJobId : null;

    if (artifact.artifactFormat !== 'pdf' || artifact.status !== 'ready' || !exportJobId) {
      return null;
    }

    return `/api/exports/${encodeURIComponent(exportJobId)}/download`;
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

  const loadArtifacts = React.useCallback(async (documentId: string) => {
    if (!documentId) {
      setArtifacts([]);
      return;
    }

    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/artifacts`, {
      cache: 'no-store',
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '출력본 목록 조회에 실패했습니다.');
    }

    setArtifacts(result.data.artifacts || []);
  }, []);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  React.useEffect(() => {
    if (selectedDocumentId) {
      void loadArtifacts(selectedDocumentId);
    }
  }, [loadArtifacts, selectedDocumentId]);

  const handleCreateExport = async () => {
    if (!selectedDocumentId) {
      setMessage('변환할 문서를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          versionId: versionId.trim() || null,
          targetFormat,
          requestedBy,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '변환 작업 생성에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setMessage(`export job ${result.data.job.id} 를 생성했습니다.`);
      setJobDetail(result.data);
      await loadArtifacts(selectedDocumentId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '변환 작업 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadJob = async () => {
    const exportJobId = latestCreated?.job.id;

    if (!exportJobId) {
      setMessage('먼저 export job을 생성하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/exports/${encodeURIComponent(exportJobId)}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '변환 작업 조회에 실패했습니다.');
      }

      setJobDetail(result.data);
      setMessage(`export job ${exportJobId} 상태를 조회했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '변환 작업 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">EXPORT-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">변환 저장</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            HTML 정본을 기준으로 export job과 artifact 메타데이터를 기록합니다. 현재 단계는 `pdf` 실제 다운로드,
            `docx` 메타데이터 저장, `hwp` 외부 연계 대기 경로까지 다룹니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDocuments()} disabled={loading}>
            문서 목록 새로고침
          </Button>
          <Button variant="outline" onClick={handleLoadJob} disabled={loading}>
            job 상태 조회
          </Button>
          <Button onClick={handleCreateExport} disabled={loading}>
            export 생성
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
            <CardTitle>대상 문서와 포맷</CardTitle>
            <CardDescription>문서와 버전을 고른 뒤 export job을 생성합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-800">현장 ID</label>
                <Input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">문서</label>
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
                <label className="text-sm font-medium text-slate-800">버전 ID</label>
                <Input
                  value={versionId}
                  onChange={(event) => setVersionId(event.target.value)}
                  placeholder="비우면 최신 버전"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">포맷</label>
                <select
                  value={targetFormat}
                  onChange={(event) => setTargetFormat(event.target.value as ExportTargetFormat)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="pdf">pdf</option>
                  <option value="docx">docx</option>
                  <option value="hwp">hwp</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">요청자</label>
                <Input value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 export 결과</CardTitle>
              <CardDescription>최근 생성한 export job과 artifact 결과를 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {latestCreated ? (
                <>
                  <p>Export Job ID: {latestCreated.job.id}</p>
                  <p>포맷: {latestCreated.job.targetFormat}</p>
                  <p>상태: {latestCreated.job.status}</p>
                  <p>버전 ID: {latestCreated.job.versionId}</p>
                  <p>Storage Path: {latestCreated.job.storagePath || '-'}</p>
                  <p>Renderer Key: {latestCreated.job.rendererKey || '-'}</p>
                  {latestCreated.artifact ? <p>Artifact ID: {latestCreated.artifact.id}</p> : <p>Artifact ID: -</p>}
                  {latestCreated.job.downloadReady && latestCreated.job.downloadUrl ? (
                    <a
                      href={latestCreated.job.downloadUrl}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900"
                    >
                      PDF 다운로드
                    </a>
                  ) : null}
                </>
              ) : (
                <p className="text-slate-500">아직 생성된 export job이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>job 상세</CardTitle>
              <CardDescription>export job 상태와 render metadata를 다시 조회합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {jobDetail ? (
                <>
                  <p>상태: {jobDetail.job.status}</p>
                  <p>MIME: {jobDetail.job.mimeType || '-'}</p>
                  <p>에러: {jobDetail.job.errorMessage || '-'}</p>
                  {jobDetail.job.downloadReady && jobDetail.job.downloadUrl ? (
                    <a
                      href={jobDetail.job.downloadUrl}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900"
                    >
                      PDF 다운로드
                    </a>
                  ) : null}
                  <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {JSON.stringify(jobDetail.job.renderMetadata, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="text-slate-500">아직 조회된 job 상세가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>문서 출력본 목록</CardTitle>
          <CardDescription>선택한 문서에 연결된 artifact 메타데이터를 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {artifacts.length > 0 ? (
            artifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="green">{artifact.status}</Badge>
                  <span className="font-medium text-slate-900">{artifact.artifactFormat}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p>Artifact ID: {artifact.id}</p>
                  <p>Version ID: {artifact.versionId}</p>
                  <p>Storage Path: {artifact.storagePath}</p>
                  <p>MIME: {artifact.mimeType || '-'}</p>
                  <p>Size: {artifact.fileSizeBytes || '-'}</p>
                </div>
                {getArtifactDownloadUrl(artifact) ? (
                  <div className="mt-3">
                    <a
                      href={getArtifactDownloadUrl(artifact) || '#'}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900"
                    >
                      PDF 다운로드
                    </a>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">저장된 출력본 메타데이터가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
