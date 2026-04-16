'use client';

import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type {
  SiteChecklistRebuildResult,
  SiteListResult,
  SiteChecklistSummaryDto,
  SiteCreateResult,
} from '../../lib/siteChecklistDtos';

const defaultRulesText = JSON.stringify(
  [
    {
      tradeKey: 'scaffold',
      documentTypeKey: 'safety-plan',
      documentTitle: '안전관리계획서',
      description: '비계 작업 착수 전 필수',
    },
    {
      tradeKey: 'scaffold',
      documentTypeKey: 'work-permit',
      documentTitle: '작업허가서',
      description: '비계 작업일 기준 필요',
    },
    {
      tradeKey: 'electrical',
      documentTypeKey: 'work-permit',
      documentTitle: '작업허가서',
      description: '전기 작업일 기준 필요',
    },
    {
      tradeKey: 'electrical',
      documentTypeKey: 'risk-assessment',
      documentTitle: '위험성평가서',
      description: '전기 공종 시작 전 필수',
    },
  ],
  null,
  2
);

const getItemStatusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'green' as const;
    case 'missing':
      return 'red' as const;
    default:
      return 'outline' as const;
  }
};

const getPhotoEvidenceVariant = (status: string) => {
  switch (status) {
    case 'covered':
      return 'green' as const;
    case 'review_needed':
      return 'amber' as const;
    case 'missing':
      return 'red' as const;
    default:
      return 'outline' as const;
  }
};

export default function SitesPage() {
  const [siteName, setSiteName] = React.useState('서울 A현장');
  const [tradeKeysText, setTradeKeysText] = React.useState('scaffold, electrical');
  const [openDate, setOpenDate] = React.useState('2026-04-12');
  const [rulesText, setRulesText] = React.useState(defaultRulesText);
  const [selectedSiteId, setSelectedSiteId] = React.useState('');
  const [sitesResult, setSitesResult] = React.useState<SiteListResult | null>(null);
  const [createdSite, setCreatedSite] = React.useState<SiteCreateResult | null>(null);
  const [rebuiltChecklist, setRebuiltChecklist] = React.useState<SiteChecklistRebuildResult | null>(null);
  const [checklist, setChecklist] = React.useState<SiteChecklistSummaryDto | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const siteOptions = React.useMemo(
    () =>
      (sitesResult?.sites || []).map((site) => ({
        id: site.id,
        label: site.siteName,
        meta: site.id,
        keywords: site.tradeKeys,
      })),
    [sitesResult]
  );

  const parseRules = () => JSON.parse(rulesText) as Array<Record<string, unknown>>;
  const parseTradeKeys = () =>
    tradeKeysText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const loadSites = React.useCallback(async () => {
    try {
      const response = await fetch('/api/sites');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '현장 목록 조회에 실패했습니다.');
      }

      setSitesResult(result.data);

      setSelectedSiteId((current) => current || result.data.sites[0]?.id || '');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '현장 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    }
  }, []);

  const loadChecklist = React.useCallback(async (siteId: string) => {
    const normalizedSiteId = siteId.trim();

    if (!normalizedSiteId) {
      setChecklist(null);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/${normalizedSiteId}/checklist`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '체크리스트 조회에 실패했습니다.');
      }

      setChecklist(result.data);
      setSelectedSiteId(normalizedSiteId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '체크리스트 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateSite = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName,
          tradeKeys: parseTradeKeys(),
          openDate,
          requiredDocumentRules: parseRules(),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '현장 생성에 실패했습니다.');
      }

      setCreatedSite(result.data);
      setSelectedSiteId(result.data.site.id);
      setMessage(`현장 생성과 체크리스트 계산이 완료되었습니다. 항목 수: ${result.data.generatedChecklistCount}`);
      await loadSites();
      await loadChecklist(result.data.site.id);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '현장 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuildChecklist = async () => {
    const normalizedSiteId = selectedSiteId.trim();

    if (!normalizedSiteId) {
      setMessage('재계산할 siteId를 먼저 입력하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sites/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: normalizedSiteId,
          requiredDocumentRules: parseRules(),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '체크리스트 재계산에 실패했습니다.');
      }

      setRebuiltChecklist(result.data);
      setMessage(`체크리스트 버전 ${result.data.checklistVersion} 으로 재계산했습니다.`);
      await loadChecklist(normalizedSiteId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '체크리스트 재계산에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadSites();
  }, [loadSites]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">SITE-CHECK-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">현장별 필요 서류 누락 방지</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            공종별 필수 서류 규칙을 저장하고, 현장을 생성할 때 체크리스트를 자동 계산하는 1차 골격입니다.
            같은 문서는 하나로 합치고, 문서 서비스 상태를 읽어 `missing` 또는 `completed`로 표시합니다. 이번
            단계에서는 문서 종류별 사진 증빙 요구 상태도 함께 보여줍니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            `completed` 로 보이려면 서류 클라우드 관리에서 같은 `siteId` 로 문서를 저장해야 합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadChecklist(selectedSiteId)} disabled={loading}>
            체크리스트 조회
          </Button>
          <Button onClick={handleCreateSite} disabled={loading}>
            현장 생성
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
            <CardTitle>현장 생성과 규칙 입력</CardTitle>
            <CardDescription>
              규칙 JSON을 함께 보내면 `required_document_rules`를 먼저 저장한 뒤 체크리스트를 계산합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">현장명</label>
                <Input value={siteName} onChange={(event) => setSiteName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">오픈일</label>
                <Input type="date" value={openDate} onChange={(event) => setOpenDate(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">공종 키 목록</label>
              <Input
                value={tradeKeysText}
                onChange={(event) => setTradeKeysText(event.target.value)}
                placeholder="쉼표로 구분하세요. 예: scaffold, electrical"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">필수 서류 규칙 JSON</label>
              <textarea
                value={rulesText}
                onChange={(event) => setRulesText(event.target.value)}
                className="flex min-h-[320px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 현장 생성 결과</CardTitle>
              <CardDescription>가장 최근 생성한 현장과 자동 계산된 체크리스트 요약입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {createdSite ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="green">created</Badge>
                    <span className="font-medium text-slate-900">{createdSite.site.siteName}</span>
                  </div>
                  <p>현장 ID: {createdSite.site.id}</p>
                  <p>공종: {createdSite.site.tradeKeys.join(', ')}</p>
                  <p>체크리스트 버전: {createdSite.checklistVersion}</p>
                  <p>생성 항목 수: {createdSite.generatedChecklistCount}</p>
                </>
              ) : (
                <p className="text-slate-500">아직 생성된 현장이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>체크리스트 재계산과 조회</CardTitle>
              <CardDescription>
                저장된 현장 목록에서 선택해 최신 체크리스트를 조회하고, 규칙을 다시 저장한 뒤 새 버전으로 재계산합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <EntityPicker
                  value={selectedSiteId}
                  options={siteOptions}
                  onChange={setSelectedSiteId}
                  placeholder="현장을 선택하세요"
                  emptyMessage="저장된 현장이 없습니다."
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleRebuildChecklist} disabled={loading}>
                  체크리스트 재계산
                </Button>
              </div>

              <div className="text-xs text-slate-500">
                저장된 현장 수: {sitesResult?.siteCount ?? 0}
              </div>

              {rebuiltChecklist ? (
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">{rebuiltChecklist.site.siteName}</p>
                  <p>체크리스트 버전: {rebuiltChecklist.checklistVersion}</p>
                  <p>항목 수: {rebuiltChecklist.itemCount}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최신 체크리스트</CardTitle>
              <CardDescription>
                같은 문서는 하나로 합쳐 표시합니다. 이미 생성된 문서가 있으면 `completed`, 없으면 `missing`
                으로 보입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist ? (
                <>
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{checklist.site.siteName}</p>
                    <p>현장 ID: {checklist.site.id}</p>
                    <p>체크리스트 버전: {checklist.checklistVersion}</p>
                    <p>누락 수: {checklist.missingCount}</p>
                    <p>완료 수: {checklist.completedCount}</p>
                    <p>사진 요구 수: {checklist.photoRequirementCount}</p>
                    <p>사진 증빙 완료: {checklist.photoCoveredCount}</p>
                    <p>사진 검토 필요: {checklist.photoReviewNeededCount}</p>
                    <p>사진 누락: {checklist.photoMissingCount}</p>
                  </div>

                  {checklist.requiredDocuments.length === 0 ? (
                    <p className="text-sm text-slate-500">계산된 체크리스트가 없습니다.</p>
                  ) : (
                    checklist.requiredDocuments.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getItemStatusVariant(item.status)}>{item.status}</Badge>
                          <Badge variant={getPhotoEvidenceVariant(item.photoEvidence.status)}>
                            photo:{item.photoEvidence.status}
                          </Badge>
                          <span className="font-medium text-slate-900">{item.documentTitle}</span>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>문서 종류: {item.documentTypeKey}</p>
                          <p>연결 공종: {item.sourceTradeKeys.join(', ')}</p>
                          <p>연결 문서 ID: {item.linkedDocumentId || '-'}</p>
                          <p>체크리스트 버전: {item.checklistVersion}</p>
                          {item.photoEvidence.status === 'not_required' ? (
                            <p>사진 증빙 요구: 없음</p>
                          ) : (
                            <>
                              <p>사진 증빙 요구 수: {item.photoEvidence.requirementCount}</p>
                              <p>사진 증빙 완료: {item.photoEvidence.coveredCount}</p>
                              <p>사진 검토 필요: {item.photoEvidence.reviewNeededCount}</p>
                              <p>사진 누락: {item.photoEvidence.missingCount}</p>
                            </>
                          )}
                        </div>
                        {item.photoEvidence.requirements.length > 0 ? (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                            {item.photoEvidence.requirements.map((requirement) => (
                              <div key={requirement.requirementId} className="rounded-lg border border-slate-100 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={getPhotoEvidenceVariant(requirement.coverageStatus)}>
                                    {requirement.coverageStatus}
                                  </Badge>
                                  <span className="font-medium text-slate-900">{requirement.labelName}</span>
                                  <span className="text-xs text-slate-500">{requirement.labelKey}</span>
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-slate-500">
                                  <p>최소 필요 사진 수: {requirement.minimumPhotoCount}</p>
                                  <p>충족 사진 수: {requirement.matchedPhotoCount}</p>
                                  <p>검토 필요 추천 수: {requirement.reviewPendingCount}</p>
                                  <p>남은 부족 수: {requirement.missingPhotoCount}</p>
                                  {requirement.description ? <p>{requirement.description}</p> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">조회된 체크리스트가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
