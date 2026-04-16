'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type { DocumentCreateResult, DocumentDetailResult, DocumentListItem } from '../../lib/documentDtos';
import type { RequestLinkRecordDto } from '../../lib/requestLinkDtos';
import type { SiteRecordDto } from '../../lib/siteChecklistDtos';
import type { TemplateRecordDto } from '../../lib/templateDtos';

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

const getPhotoStatusVariant = (status: string) => {
  switch (status) {
    case 'covered':
      return 'green' as const;
    case 'review_needed':
      return 'amber' as const;
    case 'missing':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

const getRequestLinkStatusVariant = (status: RequestLinkRecordDto['status']) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'submitted':
      return 'amber' as const;
    case 'expired':
    case 'revoked':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

type RecentRequestLinkListItem = {
  requestLink: RequestLinkRecordDto;
  documentTitle: string;
  documentTypeKey: string;
  siteId: string;
  maskedRecipientTarget: string;
};

export default function DocumentsPage() {
  const [siteId, setSiteId] = React.useState('site-demo-001');
  const [documentTypeKey, setDocumentTypeKey] = React.useState('safety-plan');
  const [title, setTitle] = React.useState('안전관리계획서');
  const [templateId, setTemplateId] = React.useState('');
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [htmlCanonical, setHtmlCanonical] = React.useState(defaultHtmlTemplate);
  const [labelValuesText, setLabelValuesText] = React.useState(defaultLabelValues);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [latestCreated, setLatestCreated] = React.useState<DocumentCreateResult | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState('');
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [selectedDocumentRequestLinks, setSelectedDocumentRequestLinks] = React.useState<RecentRequestLinkListItem[]>([]);
  const [versionHtmlCanonical, setVersionHtmlCanonical] = React.useState(defaultHtmlTemplate);
  const [versionLabelValuesText, setVersionLabelValuesText] = React.useState(defaultLabelValues);
  const [changeReason, setChangeReason] = React.useState('오타 수정');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

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

  const templateOptions = React.useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: template.sourceDocumentName || template.id,
      })),
    [templates]
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
      // 목록 조회 실패는 화면 전체를 막지 않습니다.
    }
  }, []);

  const loadTemplates = React.useCallback(async () => {
    try {
      const response = await fetch('/api/templates?limit=20', { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '템플릿 목록 조회에 실패했습니다.');
      }

      setTemplates((result.data || []) as TemplateRecordDto[]);
    } catch {
      // 목록 조회 실패는 템플릿 선택만 비웁니다.
    }
  }, []);

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

  React.useEffect(() => {
    void loadSites();
    void loadTemplates();
  }, [loadSites, loadTemplates]);

  const loadDocumentDetail = React.useCallback(
    async (documentId: string) => {
      const normalizedDocumentId = documentId.trim();

      if (!normalizedDocumentId) {
        setSelectedDocumentDetail(null);
        setSelectedDocumentRequestLinks([]);
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/documents/${normalizedDocumentId}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '문서 상세 조회에 실패했습니다.');
        }

        setSelectedDocumentDetail(result.data);
        setSelectedDocumentId(normalizedDocumentId);

        try {
          const requestLinksResponse = await fetch(
            `/api/request-links?siteId=${encodeURIComponent(result.data.document.siteId)}&limit=20`,
            { cache: 'no-store' }
          );
          const requestLinksResult = await requestLinksResponse.json();

          if (requestLinksResult.success) {
            const documentRequestLinks = (requestLinksResult.data as RecentRequestLinkListItem[]).filter(
              (item) => item.requestLink.documentId === normalizedDocumentId
            );
            setSelectedDocumentRequestLinks(documentRequestLinks);
          } else {
            setSelectedDocumentRequestLinks([]);
          }
        } catch {
          setSelectedDocumentRequestLinks([]);
        }

        const latestVersion = result.data.latestVersion;

        if (latestVersion) {
          setVersionHtmlCanonical(latestVersion.htmlCanonical);
          setVersionLabelValuesText(JSON.stringify(latestVersion.labelValues, null, 2));
        }
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '문서 상세 조회에 실패했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

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
      setSelectedDocumentId(result.data.document.id);
      setMessage('문서 메타데이터와 초기 버전이 저장되었습니다.');
      await loadDocuments();
      await loadDocumentDetail(result.data.document.id);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    const normalizedDocumentId = selectedDocumentId.trim();

    if (!normalizedDocumentId) {
      setMessage('버전을 추가할 문서 ID를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const labelValues = JSON.parse(versionLabelValuesText) as Record<string, unknown>;
      const response = await fetch(`/api/documents/${normalizedDocumentId}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCanonical: versionHtmlCanonical,
          labelValues,
          changeReason,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 버전 생성에 실패했습니다.');
      }

      setMessage(`문서 버전 ${result.data.latestVersion.versionNumber} 이 저장되었습니다.`);
      await loadDocuments();
      await loadDocumentDetail(normalizedDocumentId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 버전 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">DOC-CLOUD-05</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">서류 클라우드 관리</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문서 메타데이터, HTML 정본, 출력본 메타데이터를 분리 저장합니다. 지금 화면에서는 문서 등록,
            상세 조회, 버전 추가, 최신본 목록 확인과 한 문서 기준 운영 상태 통합 확인까지 다룹니다.
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
        <Card className="border-slate-200">
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
                <label className="text-sm font-medium text-slate-800">템플릿 선택</label>
                <EntityPicker
                  value={templateId}
                  options={templateOptions}
                  onChange={setTemplateId}
                  placeholder="템플릿을 선택하세요"
                  emptyMessage="저장된 템플릿이 없습니다."
                  allowClear
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
          <Card className="border-slate-200">
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

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>문서 상세 및 버전 추가</CardTitle>
              <CardDescription>
                문서 ID로 최신 버전과 전체 이력을 조회하고, 같은 문서에 새 버전을 추가합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <EntityPicker
                  value={selectedDocumentId}
                  options={documentOptions}
                  onChange={setSelectedDocumentId}
                  placeholder="문서를 선택하세요"
                  emptyMessage="선택 가능한 문서가 없습니다."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => void loadDocumentDetail(selectedDocumentId)}
                  disabled={loading}
                >
                  상세 조회
                </Button>
              </div>

              {selectedDocumentDetail ? (
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(selectedDocumentDetail.document.status)}>
                      {selectedDocumentDetail.document.status}
                    </Badge>
                    <span className="font-medium text-slate-900">
                      {selectedDocumentDetail.document.title}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <p>문서 ID: {selectedDocumentDetail.document.id}</p>
                    <p>최신 버전: {selectedDocumentDetail.latestVersion?.versionNumber ?? '-'}</p>
                    <p>버전 개수: {selectedDocumentDetail.versions.length}</p>
                    <p>출력본 개수: {selectedDocumentDetail.artifacts.length}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">출력본</p>
                      <p className="mt-2">artifact {selectedDocumentDetail.artifacts.length}건</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">요청 링크</p>
                      <p className="mt-2">최근 {selectedDocumentRequestLinks.length}건</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">사진 증빙</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={getPhotoStatusVariant(selectedDocumentDetail.photoEvidence.status)}>
                          {selectedDocumentDetail.photoEvidence.status}
                        </Badge>
                        <span>{selectedDocumentDetail.photoEvidence.requirementCount}개 요구</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">변경 사유</label>
                    <Input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">새 HTML 정본</label>
                    <textarea
                      value={versionHtmlCanonical}
                      onChange={(event) => setVersionHtmlCanonical(event.target.value)}
                      className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">새 라벨 값 JSON</label>
                    <textarea
                      value={versionLabelValuesText}
                      onChange={(event) => setVersionLabelValuesText(event.target.value)}
                      className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <Button onClick={handleCreateVersion} disabled={loading}>
                    새 버전 저장
                  </Button>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">버전 이력</p>
                    <div className="space-y-2">
                      {selectedDocumentDetail.versions.map((version) => (
                        <div key={version.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                          <p className="font-medium text-slate-900">버전 {version.versionNumber}</p>
                          <p>SHA-256: {version.htmlSha256}</p>
                          <p>변경 사유: {version.changeReason || '-'}</p>
                          <p>생성 시각: {version.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">출력본 이력</p>
                    {selectedDocumentDetail.artifacts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDocumentDetail.artifacts.map((artifact) => (
                          <div key={artifact.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="slate">{artifact.artifactFormat}</Badge>
                              <span className="font-medium text-slate-900">{artifact.status}</span>
                            </div>
                            <p className="mt-2">버전 ID: {artifact.versionId}</p>
                            <p>저장 경로: {artifact.storagePath}</p>
                            <p>크기: {artifact.fileSizeBytes ?? '-'} byte</p>
                            <p>생성 시각: {artifact.createdAt}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">연결된 출력본이 없습니다.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">최근 요청 링크</p>
                    {selectedDocumentRequestLinks.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDocumentRequestLinks.map((item) => (
                          <div
                            key={item.requestLink.id}
                            className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={getRequestLinkStatusVariant(item.requestLink.status)}>
                                {item.requestLink.status}
                              </Badge>
                              <span className="font-medium text-slate-900">{item.maskedRecipientTarget}</span>
                            </div>
                            <p className="mt-2">요청 링크 ID: {item.requestLink.id}</p>
                            <p>수신 채널: {item.requestLink.recipientChannel}</p>
                            <p>허용 라벨 수: {item.requestLink.allowedLabels.length}</p>
                            <p>만료 시각: {item.requestLink.expiresAt}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">최근 요청 링크가 없습니다.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">사진 증빙 요약</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getPhotoStatusVariant(selectedDocumentDetail.photoEvidence.status)}>
                          {selectedDocumentDetail.photoEvidence.status}
                        </Badge>
                        <span>요구 {selectedDocumentDetail.photoEvidence.requirementCount}개</span>
                        <span>충족 {selectedDocumentDetail.photoEvidence.coveredCount}개</span>
                        <span>검토 필요 {selectedDocumentDetail.photoEvidence.reviewNeededCount}개</span>
                        <span>누락 {selectedDocumentDetail.photoEvidence.missingCount}개</span>
                      </div>
                      {selectedDocumentDetail.photoEvidence.requirements.length > 0 ? (
                        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                          {selectedDocumentDetail.photoEvidence.requirements.map((requirement) => (
                            <div key={requirement.requirementId} className="text-xs text-slate-600">
                              {requirement.labelName} ({requirement.labelKey}) / {requirement.coverageStatus} / 최소{' '}
                              {requirement.minimumPhotoCount} / 충족 {requirement.matchedPhotoCount}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">이 문서 종류에 연결된 사진 증빙 요구가 없습니다.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">선택된 문서가 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
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
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadDocumentDetail(item.document.id)}
                        disabled={loading}
                      >
                        상세 보기
                      </Button>
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
