'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type { DocumentArtifactDto, DocumentListItem } from '../../lib/documentDtos';
import type {
  ExportJobCreateResult,
  ExportJobDetailResult,
  ExportTargetFormat,
  HwpCallbackResult,
  HwpHandoffResult,
} from '../../lib/exportDtos';
import type { SiteRecordDto } from '../../lib/siteChecklistDtos';

export default function ExportsPage() {
  const searchParams = useSearchParams();
  const initialSiteId = searchParams.get('siteId')?.trim() || 'a242f858-ea43-4191-878e-6324ea2e4b5d';
  const initialDocumentId = searchParams.get('documentId')?.trim() || '';
  const [siteId, setSiteId] = React.useState(initialSiteId);
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(initialDocumentId);
  const [versionId, setVersionId] = React.useState('');
  const [requestedBy, setRequestedBy] = React.useState('export-demo-user');
  const [latestCreated, setLatestCreated] = React.useState<ExportJobCreateResult | null>(null);
  const [jobDetail, setJobDetail] = React.useState<ExportJobDetailResult | null>(null);
  const [artifacts, setArtifacts] = React.useState<DocumentArtifactDto[]>([]);
  const [hwpHandoff, setHwpHandoff] = React.useState<HwpHandoffResult | null>(null);
  const [hwpCallbackResult, setHwpCallbackResult] = React.useState<HwpCallbackResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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

  const documentOptions = React.useMemo(
    () =>
      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        meta: `${item.document.documentTypeKey} / ${item.document.id}`,
      })),
    [documents]
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
      // 현장 목록은 선택 편의용입니다.
    }
  }, []);

  const getArtifactDownloadUrl = React.useCallback((artifact: DocumentArtifactDto) => {
    const exportJobId = typeof artifact.metadata.exportJobId === 'string' ? artifact.metadata.exportJobId : null;

    const downloadSupported = artifact.artifactFormat === 'pdf' || artifact.artifactFormat === 'docx';

    if (!downloadSupported || artifact.status !== 'ready' || !exportJobId) {
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
    void loadSites();
  }, [loadSites]);

  React.useEffect(() => {
    if (initialSiteId) {
      setSiteId(initialSiteId);
    }
  }, [initialSiteId]);

  React.useEffect(() => {
    if (initialDocumentId) {
      setSelectedDocumentId(initialDocumentId);
    }
  }, [initialDocumentId]);

  React.useEffect(() => {
    if (selectedDocumentId) {
      void loadArtifacts(selectedDocumentId);
    }
  }, [loadArtifacts, selectedDocumentId]);

  const activeJob = jobDetail?.job || latestCreated?.job || null;
  const latestHandoffStatus =
    activeJob?.targetFormat === 'hwp' && typeof activeJob.renderMetadata.handoffStatus === 'string'
      ? activeJob.renderMetadata.handoffStatus
      : null;
  const latestExternalJobId =
    activeJob?.targetFormat === 'hwp' && typeof activeJob.renderMetadata.externalJobId === 'string'
      ? activeJob.renderMetadata.externalJobId
      : null;
  const latestCallbackCompletedAt =
    activeJob?.targetFormat === 'hwp' && typeof activeJob.renderMetadata.callbackCompletedAt === 'string'
      ? activeJob.renderMetadata.callbackCompletedAt
      : null;

  const loadJobById = React.useCallback(async (exportJobId: string) => {
    const response = await fetch(`/api/exports/${encodeURIComponent(exportJobId)}`, {
      cache: 'no-store',
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '변환 작업 조회에 실패했습니다.');
    }

    setJobDetail(result.data);
    return result.data as ExportJobDetailResult;
  }, []);

  const prepareHwpHandoff = React.useCallback(async (exportJobId: string) => {
    const response = await fetch(`/api/exports/${encodeURIComponent(exportJobId)}/handoff`, {
      method: 'POST',
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'HWP handoff 준비에 실패했습니다.');
    }

    setHwpHandoff(result.data);
    return result.data as HwpHandoffResult;
  }, []);

  const handleCreateExport = async (
    nextFormat: ExportTargetFormat,
    options?: {
      autoDownload?: boolean;
      autoPrepareHwpHandoff?: boolean;
    }
  ) => {
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
          targetFormat: nextFormat,
          requestedBy,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '변환 작업 생성에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setHwpHandoff(null);
      setHwpCallbackResult(null);
      setMessage(`${nextFormat.toUpperCase()} 변환 요청을 만들었습니다.`);
      setJobDetail(result.data);
      await loadArtifacts(selectedDocumentId);

      if (options?.autoPrepareHwpHandoff && result.data.job.targetFormat === 'hwp') {
        const handoff = await prepareHwpHandoff(result.data.job.id);
        await loadJobById(result.data.job.id);
        setMessage(`HWP 외부 변환 요청을 준비했습니다. (${handoff.externalJobId})`);
      }

      if (options?.autoDownload && result.data.job.downloadReady && result.data.job.downloadUrl) {
        window.location.href = result.data.job.downloadUrl;
      }
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
      await loadJobById(exportJobId);
      setMessage(`export job ${exportJobId} 상태를 조회했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '변환 작업 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareHwpHandoff = async () => {
    const exportJobId = activeJob?.id;

    if (!exportJobId) {
      setMessage('먼저 hwp export job을 생성하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const handoff = await prepareHwpHandoff(exportJobId);
      setMessage(`HWP 외부 변환 요청을 준비했습니다. (${handoff.externalJobId})`);
      await loadJobById(exportJobId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'HWP handoff 준비에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateHwpCallback = async (status: 'completed' | 'failed') => {
    if (!hwpHandoff) {
      setMessage('먼저 handoff payload를 준비하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/exports/hwp-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportJobId: hwpHandoff.exportJobId,
          callbackToken: hwpHandoff.callbackToken,
          status,
          storagePath:
            status === 'completed'
              ? `external-hwp/${hwpHandoff.externalJobId}.hwp`
              : null,
          fileSizeBytes: status === 'completed' ? 4096 : null,
          externalJobId: hwpHandoff.externalJobId,
          errorMessage: status === 'failed' ? 'external renderer failed in simulation' : null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'HWP callback 처리에 실패했습니다.');
      }

      setHwpCallbackResult(result.data);
      setMessage(`hwp callback ${status} 처리를 완료했습니다.`);
      await handleLoadJob();

      if (selectedDocumentId) {
        await loadArtifacts(selectedDocumentId);
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'HWP callback 처리에 실패했습니다.';
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
            문서를 고른 뒤 버튼 한 번으로 PDF와 DOCX를 내려받고, HWP는 외부 변환 요청 상태를 확인합니다. 내부 job,
            artifact, callback 기록은 계속 남기되 화면에서는 단순한 버튼 흐름만 보여줍니다.
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
            <CardTitle>대상 문서</CardTitle>
            <CardDescription>문서와 버전을 고른 뒤 바로 다운로드하거나 HWP 변환 요청을 보냅니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
                <label className="text-sm font-medium text-slate-800">문서 선택</label>
                <EntityPicker
                  value={selectedDocumentId}
                  options={documentOptions}
                  onChange={setSelectedDocumentId}
                  placeholder="문서를 선택하세요"
                  emptyMessage="선택 가능한 문서가 없습니다."
                />
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
                <label className="text-sm font-medium text-slate-800">요청자</label>
                <Input value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-800">바로 실행</label>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleCreateExport('pdf', { autoDownload: true })} disabled={loading}>
                    PDF 다운로드
                  </Button>
                  <Button onClick={() => void handleCreateExport('docx', { autoDownload: true })} disabled={loading}>
                    DOCX 다운로드
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateExport('hwp', { autoPrepareHwpHandoff: true })}
                    disabled={loading}
                  >
                    HWP 변환 요청
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 변환 상태</CardTitle>
              <CardDescription>가장 최근 실행한 포맷의 상태만 간단히 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {latestCreated ? (
                <>
                  <p>포맷: {latestCreated.job.targetFormat.toUpperCase()}</p>
                  <p>상태: {latestCreated.job.status}</p>
                  <p>다운로드 가능: {latestCreated.job.downloadReady ? '예' : '아니오'}</p>
                  {latestCreated.job.downloadReady && latestCreated.job.downloadUrl ? (
                    <a
                      href={latestCreated.job.downloadUrl}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900"
                    >
                      {latestCreated.job.targetFormat.toUpperCase()} 다운로드
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
              <CardTitle>현재 처리 상태</CardTitle>
              <CardDescription>내부 메타데이터 대신 사용자에게 필요한 상태만 간단히 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {jobDetail ? (
                <>
                  <p>포맷: {jobDetail.job.targetFormat.toUpperCase()}</p>
                  <p>상태: {jobDetail.job.status}</p>
                  <p>에러: {jobDetail.job.errorMessage || '없음'}</p>
                  {latestHandoffStatus ? <p>HWP handoff 상태: {latestHandoffStatus}</p> : null}
                  {latestExternalJobId ? <p>외부 작업 ID: {latestExternalJobId}</p> : null}
                  {latestCallbackCompletedAt ? <p>HWP 완료 시각: {latestCallbackCompletedAt}</p> : null}
                  {jobDetail.job.downloadReady && jobDetail.job.downloadUrl ? (
                    <a
                      href={jobDetail.job.downloadUrl}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900"
                    >
                      {jobDetail.job.targetFormat.toUpperCase()} 다운로드
                    </a>
                  ) : null}
                </>
              ) : (
                <p className="text-slate-500">아직 조회된 job 상세가 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>HWP 진행 상태</CardTitle>
              <CardDescription>외부 변환기 연계 전이므로, 이 화면에서는 요청 준비와 완료 시뮬레이션만 간단히 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handlePrepareHwpHandoff}
                  disabled={loading || activeJob?.targetFormat !== 'hwp'}
                >
                  handoff 준비
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleSimulateHwpCallback('completed')}
                  disabled={loading || !hwpHandoff}
                >
                  성공 callback 시뮬레이션
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleSimulateHwpCallback('failed')}
                  disabled={loading || !hwpHandoff}
                >
                  실패 callback 시뮬레이션
                </Button>
              </div>

              {hwpHandoff ? (
                <>
                  <p>외부 작업 ID: {hwpHandoff.externalJobId}</p>
                  <p>요청 준비: 완료</p>
                  <p>callback URL: 준비됨</p>
                </>
              ) : (
                <p className="text-slate-500">아직 준비된 HWP 요청이 없습니다.</p>
              )}

              {hwpCallbackResult ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p>Callback 처리 상태: {hwpCallbackResult.status}</p>
                  <p>출력본 생성: {hwpCallbackResult.artifact ? '완료' : '실패'}</p>
                </div>
              ) : null}
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
                  <p>MIME: {artifact.mimeType || '-'}</p>
                  <p>파일 크기: {artifact.fileSizeBytes || '-'} bytes</p>
                  <p>생성 시각: {artifact.createdAt}</p>
                </div>
                {getArtifactDownloadUrl(artifact) ? (
                  <div className="mt-3">
                    <a
                      href={getArtifactDownloadUrl(artifact) || '#'}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900"
                    >
                      {artifact.artifactFormat.toUpperCase()} 다운로드
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
