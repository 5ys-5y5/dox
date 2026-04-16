'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type { DocumentListItem } from '../../lib/documentDtos';
import type {
  PhotoCreateResult,
  PhotoLabelRequirementDto,
  PhotoListItemDto,
  PhotoManualLabelDto,
  PhotoLabelRequirementsSaveResult,
  SitePhotoLabelGapSummaryDto,
  PhotoSuggestedLabelDto,
} from '../../lib/photoLabelDtos';
import type { SiteRecordDto } from '../../lib/siteChecklistDtos';

const defaultManualLabels = JSON.stringify(
  [
    {
      labelKey: 'safety_helmet',
      note: '안전모 착용 사진',
    },
  ],
  null,
  2
);

const defaultSuggestedLabels = JSON.stringify(
  [
    {
      labelKey: 'scaffold_front_view',
      confidenceScore: 0.84,
      suggestionReason: '설명에 비계 점검 사진이 포함됨',
      suggestionStatus: 'review_needed',
    },
  ],
  null,
  2
);

const defaultRequirements = JSON.stringify(
  [
    {
      labelKey: 'safety_helmet',
      labelName: '안전모 착용 사진',
      description: '안전모 착용 여부가 확인되는 사진이 최소 1장 필요합니다.',
      documentTypeKey: 'safety-plan',
      minimumPhotoCount: 1,
    },
    {
      labelKey: 'scaffold_zone',
      labelName: '비계 작업 구간 사진',
      description: '비계 작업 구간 전경 사진이 최소 1장 필요합니다.',
      documentTypeKey: 'work-permit',
      minimumPhotoCount: 1,
    },
    {
      labelKey: 'fall_protection_check',
      labelName: '추락방지 설비 점검 사진',
      description: '추락방지 설비 점검 사진이 최소 1장 필요합니다.',
      documentTypeKey: 'risk-assessment',
      minimumPhotoCount: 1,
    },
  ],
  null,
  2
);

const toManualLabelsText = (labels: Array<{ labelKey: string; note?: string | null }>) =>
  JSON.stringify(
    labels.map((label) => ({
      labelKey: label.labelKey,
      note: label.note || null,
    })),
    null,
    2
  );

const toSuggestedLabelsText = (
  labels: Array<{
    labelKey: string;
    confidenceScore?: number | null;
    suggestionReason?: string | null;
    suggestionStatus?: 'review_needed' | 'accepted' | 'rejected';
  }>
) =>
  JSON.stringify(
    labels.map((label) => ({
      labelKey: label.labelKey,
      confidenceScore: label.confidenceScore ?? 0,
      suggestionReason: label.suggestionReason || null,
      suggestionStatus: label.suggestionStatus || 'review_needed',
    })),
    null,
    2
  );

const toRequirementText = (requirements: PhotoLabelRequirementDto[]) =>
  JSON.stringify(
    requirements.map((requirement) => ({
      labelKey: requirement.labelKey,
      labelName: requirement.labelName,
      description: requirement.description,
      documentTypeKey: requirement.documentTypeKey,
      minimumPhotoCount: requirement.minimumPhotoCount,
    })),
    null,
    2
  );

export default function PhotosPage() {
  const searchParams = useSearchParams();
  const initialSiteId = searchParams.get('siteId')?.trim() || 'a242f858-ea43-4191-878e-6324ea2e4b5d';
  const initialDocumentId = searchParams.get('documentId')?.trim() || '';
  const [siteId, setSiteId] = React.useState(initialSiteId);
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(initialDocumentId);
  const [photoTitle, setPhotoTitle] = React.useState('비계 작업 전경');
  const [description, setDescription] = React.useState('비계 작업 구간 전경과 안전모 착용 여부 확인 사진');
  const [capturedAt, setCapturedAt] = React.useState('2026-04-12T09:00');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = React.useState('');
  const [selectedRequirementKeys, setSelectedRequirementKeys] = React.useState<string[]>([]);
  const [manualLabelsText, setManualLabelsText] = React.useState(defaultManualLabels);
  const [suggestedLabelsText, setSuggestedLabelsText] = React.useState(defaultSuggestedLabels);
  const [requirementsText, setRequirementsText] = React.useState(defaultRequirements);
  const [photos, setPhotos] = React.useState<PhotoListItemDto[]>([]);
  const [latestCreated, setLatestCreated] = React.useState<PhotoCreateResult | null>(null);
  const [latestRequirementsSave, setLatestRequirementsSave] =
    React.useState<PhotoLabelRequirementsSaveResult | null>(null);
  const [gapSummary, setGapSummary] = React.useState<SitePhotoLabelGapSummaryDto | null>(null);
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

  const photoOptions = React.useMemo(
    () =>
      photos.map((item) => ({
        id: item.photo.id,
        label: item.photo.photoTitle || '제목 없는 사진',
        meta: item.photo.originalFileName || item.photo.id,
      })),
    [photos]
  );

  const documentOptions = React.useMemo(
    () =>
      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        meta: item.document.documentTypeKey,
      })),
    [documents]
  );

  const selectedDocument = React.useMemo(
    () => documents.find((item) => item.document.id === selectedDocumentId) || null,
    [documents, selectedDocumentId]
  );

  const currentRequirements = React.useMemo(() => {
    if (!gapSummary) {
      return [];
    }

    if (!selectedDocument?.document.documentTypeKey) {
      return gapSummary.requirements;
    }

    return gapSummary.requirements.filter(
      (requirement) =>
        !requirement.documentTypeKey || requirement.documentTypeKey === selectedDocument.document.documentTypeKey
    );
  }, [gapSummary, selectedDocument?.document.documentTypeKey]);

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
      // 현장 목록 실패는 사진 로직을 막지 않습니다.
    }
  }, []);

  const loadDocuments = React.useCallback(async () => {
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

        if (initialDocumentId && nextDocuments.some((item) => item.document.id === initialDocumentId)) {
          return initialDocumentId;
        }

        return nextDocuments[0]?.document.id || '';
      });
    } catch {
      setDocuments([]);
      setSelectedDocumentId('');
    }
  }, [initialDocumentId, siteId]);

  const selectPhoto = React.useCallback((item: PhotoListItemDto) => {
    setSelectedPhotoId(item.photo.id);
    setManualLabelsText(toManualLabelsText(item.manualLabels));
    setSuggestedLabelsText(toSuggestedLabelsText(item.suggestedLabels));
  }, []);

  const loadPhotos = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/photos?siteId=${encodeURIComponent(siteId)}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '사진 목록 조회에 실패했습니다.');
      }

      const nextPhotos = result.data as PhotoListItemDto[];
      setPhotos(nextPhotos);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadPhotoLabelGaps = React.useCallback(
    async (nextSiteId = siteId) => {
      const response = await fetch(`/api/sites/${encodeURIComponent(nextSiteId)}/photo-label-gaps`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '사진 라벨 누락 경고 조회에 실패했습니다.');
      }

      setGapSummary(result.data as SitePhotoLabelGapSummaryDto);
    },
    [siteId]
  );

  const refreshGapSummarySilently = React.useCallback(
    async (nextSiteId = siteId) => {
      try {
        await loadPhotoLabelGaps(nextSiteId);
      } catch {
        // PHOTO-LABEL-04 runtime bootstrap is optional until the user applies the new SQL.
        // 사진 저장/라벨 저장 성공 메시지를 누락 경고 조회 실패가 덮어쓰지 않도록 분리합니다.
      }
    },
    [loadPhotoLabelGaps, siteId]
  );

  React.useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  React.useEffect(() => {
    void loadSites();
  }, [loadSites]);

  React.useEffect(() => {
    if (siteId.trim()) {
      void loadDocuments();
      void refreshGapSummarySilently(siteId);
    }
  }, [loadDocuments, refreshGapSummarySilently, siteId]);

  React.useEffect(() => {
    if (initialSiteId) {
      setSiteId(initialSiteId);
    }
  }, [initialSiteId]);

  React.useEffect(() => {
    const availableKeys = new Set(currentRequirements.map((requirement) => requirement.labelKey));
    setSelectedRequirementKeys((previous) => previous.filter((labelKey) => availableKeys.has(labelKey)));
  }, [currentRequirements]);

  React.useEffect(() => {
    if (photos.length === 0) {
      if (selectedPhotoId) {
        setSelectedPhotoId('');
      }
      return;
    }

    const preferredPhoto =
      photos.find((item) => item.photo.id === selectedPhotoId) ||
      photos.find((item) => item.photo.id === latestCreated?.photo.id) ||
      photos[0];

    if (!preferredPhoto) {
      return;
    }

    if (preferredPhoto.photo.id !== selectedPhotoId) {
      selectPhoto(preferredPhoto);
      return;
    }

    setManualLabelsText(toManualLabelsText(preferredPhoto.manualLabels));
    setSuggestedLabelsText(toSuggestedLabelsText(preferredPhoto.suggestedLabels));
  }, [latestCreated?.photo.id, photos, selectPhoto, selectedPhotoId]);

  const toggleRequirementKey = React.useCallback((labelKey: string) => {
    setSelectedRequirementKeys((previous) =>
      previous.includes(labelKey)
        ? previous.filter((item) => item !== labelKey)
        : [...previous, labelKey]
    );
  }, []);

  const handleUploadPhoto = async () => {
    if (!selectedFile) {
      setMessage('업로드할 이미지 파일을 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('siteId', siteId);
      formData.append('capturedAt', capturedAt ? new Date(capturedAt).toISOString() : '');
      formData.append('photoTitle', photoTitle);
      formData.append('description', description);
      formData.append('file', selectedFile);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '사진 업로드에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setSelectedPhotoId(result.data.photo.id);
      setMessage('사진 파일 업로드와 메타데이터 저장이 완료되었습니다.');
      await loadPhotos();
      await refreshGapSummarySilently(siteId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 업로드에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAndSavePhotoEvidence = async () => {
    if (!selectedDocument) {
      setMessage('먼저 문서를 선택하세요.');
      return;
    }

    if (!selectedFile) {
      setMessage('업로드할 이미지 파일을 먼저 선택하세요.');
      return;
    }

    if (selectedRequirementKeys.length === 0) {
      setMessage('이 사진이 증빙하는 항목을 하나 이상 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('siteId', siteId);
      formData.append('capturedAt', capturedAt ? new Date(capturedAt).toISOString() : '');
      formData.append('photoTitle', photoTitle);
      formData.append('description', description);
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.message || '사진 업로드에 실패했습니다.');
      }

      const createdPhoto = uploadResult.data as PhotoCreateResult;
      const manualLabels = selectedRequirementKeys.map((labelKey) => {
        const matchedRequirement = currentRequirements.find((requirement) => requirement.labelKey === labelKey);
        return {
          labelKey,
          note: matchedRequirement?.labelName || null,
        };
      });

      const labelsResponse = await fetch('/api/photos/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: createdPhoto.photo.id,
          manualLabels,
          suggestedLabels: [],
        }),
      });
      const labelsResult = await labelsResponse.json();

      if (!labelsResult.success) {
        throw new Error(labelsResult.message || '사진 항목 저장에 실패했습니다.');
      }

      setLatestCreated(createdPhoto);
      setSelectedPhotoId(createdPhoto.photo.id);
      setManualLabelsText(toManualLabelsText(manualLabels));
      setSuggestedLabelsText(toSuggestedLabelsText([]));
      setSelectedRequirementKeys([]);
      setSelectedFile(null);
      await loadPhotos();
      await loadPhotoLabelGaps(siteId);
      setMessage(`사진 업로드와 증빙 항목 ${manualLabels.length}개 연결을 완료했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 업로드와 증빙 연결에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLabels = async () => {
    const normalizedPhotoId = selectedPhotoId.trim();

    if (!normalizedPhotoId) {
      setMessage('라벨을 저장할 photoId를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/photos/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: normalizedPhotoId,
          manualLabels: JSON.parse(manualLabelsText),
          suggestedLabels: JSON.parse(suggestedLabelsText),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '사진 라벨 저장에 실패했습니다.');
      }

      setMessage(
        `수동 라벨 ${result.data.manualLabelCount}개, 추천 라벨 ${result.data.suggestedLabelCount}개를 저장했습니다.`
      );
      await loadPhotos();
      await refreshGapSummarySilently(siteId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 라벨 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRequirements = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/photos/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          requirements: JSON.parse(requirementsText),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '사진 요구 라벨 저장에 실패했습니다.');
      }

      const saved = result.data as PhotoLabelRequirementsSaveResult;
      setLatestRequirementsSave(saved);
      setRequirementsText(toRequirementText(saved.requirements));
      setMessage(`사진 요구 라벨 ${saved.requirementCount}개를 저장했습니다.`);
      await loadPhotoLabelGaps(siteId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 요구 라벨 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPhotoLabelGaps = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await loadPhotoLabelGaps(siteId);
      setMessage(`현장 ${siteId}의 사진 라벨 누락 경고를 조회했습니다.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 라벨 누락 경고 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">PHOTO-LABEL-07</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">서류와 연계된 현장별 사진 라벨링 보관</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문서에 필요한 사진 항목을 먼저 확인하고, 사진을 올린 뒤 어떤 항목의 증빙인지 체크만 하면 저장되는 화면입니다.
            Storage 업로드, 메타데이터 기록, 라벨 저장, 누락 경고 계산은 뒤에서 독립 단계로 처리합니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            기본 화면에서는 JSON을 직접 다루지 않습니다. 고급 편집이 필요할 때만 아래 `고급 편집`에서 직접 수정합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadPhotos()} disabled={loading}>
            목록 새로고침
          </Button>
          <Button onClick={handleUploadAndSavePhotoEvidence} disabled={loading}>
            사진 업로드하고 증빙 연결
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>1. 어떤 문서의 어떤 사진이 필요한지 확인</CardTitle>
            <CardDescription>
              현장과 문서를 고르면, 그 문서에 필요한 사진 항목을 먼저 보여줍니다. 이 사진이 무엇을 증빙하는지 체크한 뒤 업로드합니다.
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
                <label className="text-sm font-medium text-slate-800">문서 선택</label>
                <EntityPicker
                  value={selectedDocumentId}
                  options={documentOptions}
                  onChange={setSelectedDocumentId}
                  placeholder="문서를 선택하세요"
                  emptyMessage="선택 가능한 문서가 없습니다."
                />
              </div>
            </div>

            {selectedDocument ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{selectedDocument.document.title}</span>
                  <Badge variant="slate">{selectedDocument.document.documentTypeKey}</Badge>
                </div>
                <p className="mt-2">
                  현재 사진 증빙 상태: {gapSummary ? `${gapSummary.coveredCount}개 충족 / ${gapSummary.missingCount}개 누락` : '아직 계산 전'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                먼저 문서를 선택하세요.
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-800">이 사진이 증빙하는 항목</label>
                <Badge variant="slate">{selectedRequirementKeys.length}개 선택</Badge>
              </div>
              {selectedDocument ? (
                currentRequirements.length > 0 ? (
                  <div className="space-y-2">
                    {currentRequirements.map((requirement) => {
                      const isSelected = selectedRequirementKeys.includes(requirement.labelKey);
                      return (
                        <button
                          key={requirement.requirementId}
                          type="button"
                          onClick={() => toggleRequirementKey(requirement.labelKey)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                            isSelected ? 'border-slate-400 bg-slate-100' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                requirement.coverageStatus === 'covered'
                                  ? 'green'
                                  : requirement.coverageStatus === 'review_needed'
                                    ? 'amber'
                                    : 'slate'
                              }
                            >
                              {requirement.coverageStatus}
                            </Badge>
                            <span className="font-medium text-slate-900">{requirement.labelName}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {requirement.description || '설명 없음'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            최소 {requirement.minimumPhotoCount}장 / 충족 {requirement.matchedPhotoCount} / 검토 필요 {requirement.reviewPendingCount} / 누락 {requirement.missingPhotoCount}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                    이 문서 종류에 연결된 사진 요구 항목이 아직 없습니다.
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  문서를 선택하면 필요한 사진 항목이 여기에 나타납니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>2. 사진 올리고 저장</CardTitle>
              <CardDescription>
                사진을 올리면 Storage 업로드와 사진 메타데이터 저장을 먼저 처리하고, 방금 체크한 증빙 항목을 함께 연결합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">촬영 시각</label>
                  <Input
                    type="datetime-local"
                    value={capturedAt}
                    onChange={(event) => setCapturedAt(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">사진 제목</label>
                  <Input value={photoTitle} onChange={(event) => setPhotoTitle(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-800">이미지 파일</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>선택된 파일: {selectedFile ? selectedFile.name : '아직 선택되지 않았습니다.'}</p>
                <p>파일 크기: {selectedFile ? `${selectedFile.size.toLocaleString()} bytes` : '-'}</p>
                <p>MIME: {selectedFile?.type || '-'}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">사진 설명</label>
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button onClick={handleUploadAndSavePhotoEvidence} disabled={loading}>
                사진 업로드하고 증빙 연결
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>3. 저장 결과와 누락 상태</CardTitle>
              <CardDescription>방금 저장한 결과와 현재 문서 기준 사진 증빙 상태를 한 번에 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {latestCreated ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="green">{latestCreated.photo.status}</Badge>
                    <span className="font-medium text-slate-900">
                      {latestCreated.photo.photoTitle || '제목 없는 사진'}
                    </span>
                  </div>
                  <p>사진 ID: {latestCreated.photo.id}</p>
                  <p>현장 ID: {latestCreated.photo.siteId}</p>
                  <p>원본 파일명: {latestCreated.photo.originalFileName || '-'}</p>
                  <p>저장 버킷: {latestCreated.photo.storageBucket || '-'}</p>
                  <p>저장 경로: {latestCreated.photo.storagePath || '-'}</p>
                  <p>파일 크기: {latestCreated.photo.fileSizeBytes?.toLocaleString() || '-'} bytes</p>
                  <p>촬영 시각: {latestCreated.photo.capturedAt || '-'}</p>
                  {latestCreated.photo.photoUrl ? (
                    <a
                      href={latestCreated.photo.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-slate-900 underline"
                    >
                      업로드된 사진 열기
                    </a>
                  ) : null}
                </>
              ) : (
                <p className="text-slate-500">아직 저장된 사진이 없습니다.</p>
              )}
              {gapSummary ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="slate">PHOTO-LABEL-04</Badge>
                    <span className="text-sm font-medium text-slate-900">
                      현장 {gapSummary.siteId} 누락 경고 요약
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">요구 라벨 수: {gapSummary.requirementCount}</p>
                  <p className="text-sm text-slate-700">충족 수: {gapSummary.coveredCount}</p>
                  <p className="text-sm text-slate-700">검토 필요 수: {gapSummary.reviewNeededCount}</p>
                  <p className="text-sm text-slate-700">누락 수: {gapSummary.missingCount}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">아직 누락 경고를 조회하지 않았습니다.</p>
              )}
            </CardContent>
          </Card>

          <details className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
              고급 편집 열기
            </summary>
            <div className="space-y-6 border-t border-slate-200 px-4 py-4">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>현장 요구 라벨 규칙 저장</CardTitle>
                  <CardDescription>
                    현장별 요구 라벨 JSON을 직접 수정할 때만 사용합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row">
                    <EntityPicker
                      value={siteId}
                      options={siteOptions}
                      onChange={setSiteId}
                      placeholder="현장을 선택하세요"
                      emptyMessage="저장된 현장이 없습니다."
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handleSaveRequirements} disabled={loading}>
                      요구 라벨 저장
                    </Button>
                    <Button variant="outline" onClick={handleLoadPhotoLabelGaps} disabled={loading}>
                      누락 경고 조회
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">요구 라벨 JSON</label>
                    <textarea
                      value={requirementsText}
                      onChange={(event) => setRequirementsText(event.target.value)}
                      className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  {latestRequirementsSave ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p>최근 저장 siteId: {latestRequirementsSave.siteId}</p>
                      <p>저장된 요구 라벨 수: {latestRequirementsSave.requirementCount}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>기존 사진 라벨 직접 수정</CardTitle>
                  <CardDescription>
                    저장된 사진의 수동 라벨과 추천 라벨 JSON을 직접 편집할 때만 사용합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row">
                    <EntityPicker
                      value={selectedPhotoId}
                      options={photoOptions}
                      onChange={setSelectedPhotoId}
                      placeholder="사진을 선택하세요"
                      emptyMessage="선택 가능한 사진이 없습니다."
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handleSaveLabels} disabled={loading}>
                      라벨 저장
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">수동 라벨 JSON</label>
                    <textarea
                      value={manualLabelsText}
                      onChange={(event) => setManualLabelsText(event.target.value)}
                      className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">추천 라벨 JSON</label>
                    <textarea
                      value={suggestedLabelsText}
                      onChange={(event) => setSuggestedLabelsText(event.target.value)}
                      className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </details>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>현장 사진 목록</CardTitle>
          <CardDescription>
            같은 `siteId`의 사진 목록을 조회하고, 선택한 사진의 수동 라벨과 추천 라벨 상태를 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gapSummary && gapSummary.requirements.length > 0 ? (
            <div className="grid gap-3">
              {gapSummary.requirements.map((requirement) => (
                <div key={requirement.requirementId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        requirement.coverageStatus === 'covered'
                          ? 'green'
                          : requirement.coverageStatus === 'review_needed'
                            ? 'amber'
                            : 'slate'
                      }
                    >
                      {requirement.coverageStatus}
                    </Badge>
                    <span className="font-medium text-slate-900">{requirement.labelName}</span>
                    <span className="text-xs text-slate-500">{requirement.labelKey}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p>문서 종류: {requirement.documentTypeKey || '-'}</p>
                    <p>최소 필요 사진 수: {requirement.minimumPhotoCount}</p>
                    <p>충족 사진 수: {requirement.matchedPhotoCount}</p>
                    <p>검토 필요 추천 수: {requirement.reviewPendingCount}</p>
                    <p>남은 부족 수: {requirement.missingPhotoCount}</p>
                    <p>{requirement.description || '설명 없음'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {photos.length > 0 ? (
            photos.map((item) => {
              const isSelected = item.photo.id === selectedPhotoId;

              return (
                <button
                  key={item.photo.id}
                  type="button"
                  onClick={() => selectPhoto(item)}
                  className={`flex w-full flex-col gap-3 rounded-lg border p-4 text-left transition ${
                    isSelected ? 'border-slate-400 bg-slate-100' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.photo.status === 'active' ? 'green' : 'slate'}>{item.photo.status}</Badge>
                    {isSelected ? <Badge variant="slate">선택됨</Badge> : null}
                    <span className="font-medium text-slate-900">
                      {item.photo.photoTitle || '제목 없는 사진'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.photo.id}</p>
                  {item.photo.photoUrl ? (
                    <img
                      src={item.photo.photoUrl}
                      alt={item.photo.photoTitle || '업로드된 사진'}
                      className="h-40 w-full rounded-lg border border-slate-200 object-cover"
                    />
                  ) : null}
                  <p className="text-sm text-slate-600">
                    현장 ID: {item.photo.siteId} / 촬영 시각: {item.photo.capturedAt || '-'}
                  </p>
                  <p className="text-sm text-slate-600">
                    파일: {item.photo.originalFileName || '-'} / {item.photo.mimeType || '-'}
                  </p>
                  <p className="text-sm text-slate-600">{item.photo.description || '설명 없음'}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-900">수동 라벨</p>
                      {item.manualLabels.length > 0 ? (
                        item.manualLabels.map((label) => (
                          <p key={label.id} className="mt-2 text-sm text-slate-600">
                            {label.labelKey}
                            {label.note ? ` / ${label.note}` : ''}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">저장된 수동 라벨이 없습니다.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-900">추천 라벨</p>
                      {item.suggestedLabels.length > 0 ? (
                        item.suggestedLabels.map((label) => (
                          <p key={label.id} className="mt-2 text-sm text-slate-600">
                            {label.labelKey} / {label.suggestionStatus} / {label.confidenceScore}
                          </p>
                        ))
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">저장된 추천 라벨이 없습니다.</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">조회된 현장 사진이 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
