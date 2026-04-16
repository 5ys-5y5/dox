'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type {
  PhotoCreateResult,
  PhotoLabelRequirementDto,
  PhotoListItemDto,
  PhotoManualLabelDto,
  PhotoLabelRequirementsSaveResult,
  SitePhotoLabelGapSummaryDto,
  PhotoSuggestedLabelDto,
} from '../../lib/photoLabelDtos';

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

const toManualLabelsText = (labels: PhotoManualLabelDto[]) =>
  JSON.stringify(
    labels.map((label) => ({
      labelKey: label.labelKey,
      note: label.note,
    })),
    null,
    2
  );

const toSuggestedLabelsText = (labels: PhotoSuggestedLabelDto[]) =>
  JSON.stringify(
    labels.map((label) => ({
      labelKey: label.labelKey,
      confidenceScore: label.confidenceScore,
      suggestionReason: label.suggestionReason,
      suggestionStatus: label.suggestionStatus,
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
  const [siteId, setSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [photoTitle, setPhotoTitle] = React.useState('비계 작업 전경');
  const [description, setDescription] = React.useState('비계 작업 구간 전경과 안전모 착용 여부 확인 사진');
  const [capturedAt, setCapturedAt] = React.useState('2026-04-12T09:00');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = React.useState('');
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

      const preferredPhoto =
        nextPhotos.find((item) => item.photo.id === selectedPhotoId) ||
        nextPhotos.find((item) => item.photo.id === latestCreated?.photo.id) ||
        nextPhotos[0];

      if (preferredPhoto) {
        selectPhoto(preferredPhoto);
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [latestCreated?.photo.id, selectPhoto, selectedPhotoId, siteId]);

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
          <Badge variant="slate">PHOTO-LABEL-05</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">서류와 연계된 현장별 사진 라벨링 보관</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            사진 파일은 Supabase Storage에 저장하고, 사진 메타데이터와 라벨 결과는 별도 테이블에 분리 저장합니다. UI는
            단순하지만 실제 업로드, 메타데이터 기록, 라벨 저장, 누락 경고 계산은 각각 독립된 단계로 동작합니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            추천 라벨은 자동 확정하지 않고 `review_needed` 상태로 저장합니다. 이번 단계에서는 현장별 요구 라벨과 실제 저장된
            라벨을 비교해 누락 경고까지 함께 계산합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadPhotos()} disabled={loading}>
            목록 새로고침
          </Button>
          <Button variant="outline" onClick={handleLoadPhotoLabelGaps} disabled={loading}>
            누락 경고 조회
          </Button>
          <Button onClick={handleUploadPhoto} disabled={loading}>
            사진 업로드
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
            <CardTitle>사진 업로드</CardTitle>
            <CardDescription>
              이미지 파일은 Storage에 업로드하고, DB에는 `siteId`, 설명, 촬영 시각, 저장 경로, 파일 메타데이터를 함께 남깁니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">현장 ID</label>
                <Input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
              </div>
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
              <div className="space-y-2">
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
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>최근 사진 저장 결과</CardTitle>
              <CardDescription>가장 최근 업로드한 사진의 저장 결과와 파일 메타데이터를 보여줍니다.</CardDescription>
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
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>현장 요구 라벨 규칙과 누락 경고</CardTitle>
              <CardDescription>
                현장별로 필요한 사진 라벨을 저장하고, 실제 사진 라벨과 비교해 `covered`, `review_needed`, `missing`
                상태를 계산합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <Input value={siteId} onChange={(event) => setSiteId(event.target.value)} />
                <Button variant="outline" onClick={handleSaveRequirements} disabled={loading}>
                  요구 라벨 저장
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
              {gapSummary ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="slate">PHOTO-LABEL-04</Badge>
                    <span className="text-sm font-medium text-slate-900">현장 {gapSummary.siteId} 누락 경고 요약</span>
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

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>수동 라벨과 추천 라벨 저장</CardTitle>
              <CardDescription>
                추천 라벨은 자동 확정하지 않고 `review_needed` 상태를 함께 저장합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={selectedPhotoId}
                  onChange={(event) => setSelectedPhotoId(event.target.value)}
                  placeholder="photoId를 입력하세요"
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
      </div>

      <Card className="border-slate-200 shadow-sm">
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
