'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type {
  PhotoCreateResult,
  PhotoListItemDto,
  PhotoManualLabelDto,
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

export default function PhotosPage() {
  const [siteId, setSiteId] = React.useState('a242f858-ea43-4191-878e-6324ea2e4b5d');
  const [photoUrl, setPhotoUrl] = React.useState('https://example.com/site-a/photo-001.jpg');
  const [storagePath, setStoragePath] = React.useState('site-a/photo-001.jpg');
  const [photoTitle, setPhotoTitle] = React.useState('비계 작업 전경');
  const [description, setDescription] = React.useState('비계 작업 구간 전경과 안전모 착용 여부 확인 사진');
  const [capturedAt, setCapturedAt] = React.useState('2026-04-12T09:00');
  const [selectedPhotoId, setSelectedPhotoId] = React.useState('');
  const [manualLabelsText, setManualLabelsText] = React.useState(defaultManualLabels);
  const [suggestedLabelsText, setSuggestedLabelsText] = React.useState(defaultSuggestedLabels);
  const [photos, setPhotos] = React.useState<PhotoListItemDto[]>([]);
  const [latestCreated, setLatestCreated] = React.useState<PhotoCreateResult | null>(null);
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

  React.useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const handleCreatePhoto = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          photoUrl,
          storagePath,
          photoTitle,
          description,
          capturedAt: capturedAt ? new Date(capturedAt).toISOString() : null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '사진 저장에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setSelectedPhotoId(result.data.photo.id);
      setMessage('사진 메타데이터가 저장되었습니다.');
      await loadPhotos();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 저장에 실패했습니다.';
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
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '사진 라벨 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">PHOTO-LABEL-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">서류와 연계된 현장별 사진 라벨링 보관</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            사진 메타데이터, 수동 라벨, 추천 라벨을 분리 저장하는 1차 골격입니다. 지금 단계는 실제 파일 업로드가 아니라
            `siteId`, 사진 참조값, 설명, 라벨 결과를 저장합니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            추천 라벨은 자동 확정하지 않고 `review_needed` 상태로 저장합니다. 문서 요구 라벨 누락 경고는 다음 단계에서
            연결합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadPhotos()} disabled={loading}>
            목록 새로고침
          </Button>
          <Button onClick={handleCreatePhoto} disabled={loading}>
            사진 저장
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
            <CardTitle>사진 메타데이터 저장</CardTitle>
            <CardDescription>
              실제 바이너리는 아직 저장하지 않으므로 `photoUrl` 또는 `storagePath` 중 하나를 넣어 참조값만 기록합니다.
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
                <label className="text-sm font-medium text-slate-800">사진 URL</label>
                <Input value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">저장 경로</label>
                <Input value={storagePath} onChange={(event) => setStoragePath(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">사진 제목</label>
                <Input value={photoTitle} onChange={(event) => setPhotoTitle(event.target.value)} />
              </div>
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
              <CardDescription>가장 최근 저장한 사진 메타데이터를 보여줍니다.</CardDescription>
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
                  <p>촬영 시각: {latestCreated.photo.capturedAt || '-'}</p>
                </>
              ) : (
                <p className="text-slate-500">아직 저장된 사진이 없습니다.</p>
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
                  <p className="text-sm text-slate-600">
                    현장 ID: {item.photo.siteId} / 촬영 시각: {item.photo.capturedAt || '-'}
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
