'use client';

import * as React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import type {
  TemplateExtractDetailResult,
  TemplateExtractSourceKind,
} from '../../../lib/templateExtractDtos';
import type { TemplateLayoutResizeMode } from '../../../lib/templateDtos';

const defaultSourceContent = `<section>
  <h1>안전관리계획서</h1>
  <table>
    <tr>
      <th>현장명</th>
      <td>서울 A현장</td>
    </tr>
    <tr>
      <th>작업일</th>
      <td>2026-04-12</td>
    </tr>
    <tr>
      <th>책임자</th>
      <td>홍길동</td>
    </tr>
  </table>
</section>`;

const toReviewedFieldsJson = (detail: TemplateExtractDetailResult) =>
  JSON.stringify(
    detail.candidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      fieldKey: candidate.fieldKey,
      labelKey: candidate.labelKey,
      fieldType: candidate.fieldType,
      fieldLabel: candidate.fieldLabel,
      required: candidate.required,
      placeholder: candidate.placeholder,
      defaultValue: candidate.defaultValue,
      options: candidate.options,
      layoutBlockId: candidate.layoutBlockId,
      sortOrder: candidate.sortOrder,
      reviewStatus: candidate.reviewStatus,
    })),
    null,
    2
  );

export default function TemplateExtractPage() {
  const [sourceTitle, setSourceTitle] = React.useState('안전관리계획서 입력본');
  const [sourceKind, setSourceKind] = React.useState<TemplateExtractSourceKind>('html');
  const [sourceContent, setSourceContent] = React.useState(defaultSourceContent);
  const [similarTemplateIdsText, setSimilarTemplateIdsText] = React.useState('');
  const [selectedDraftId, setSelectedDraftId] = React.useState('');
  const [reviewedFieldsText, setReviewedFieldsText] = React.useState('[]');
  const [templateName, setTemplateName] = React.useState('안전관리계획서 템플릿 초안');
  const [layoutResizeMode, setLayoutResizeMode] =
    React.useState<TemplateLayoutResizeMode>('grow_height');
  const [draftDetail, setDraftDetail] = React.useState<TemplateExtractDetailResult | null>(null);
  const [approveResult, setApproveResult] = React.useState<{
    templateId: string;
    approvedFieldCount: number;
    skippedFieldCount: number;
  } | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadDraft = React.useCallback(async (draftId: string) => {
    const normalizedDraftId = draftId.trim();

    if (!normalizedDraftId) {
      setDraftDetail(null);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/extract/${normalizedDraftId}?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '추출 초안 조회에 실패했습니다.');
      }

      setDraftDetail(result.data);
      setReviewedFieldsText(toReviewedFieldsJson(result.data));
      setSelectedDraftId(normalizedDraftId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '추출 초안 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateDraft = async () => {
    setLoading(true);
    setMessage(null);
    setApproveResult(null);

    try {
      const response = await fetch('/api/templates/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTitle,
          sourceKind,
          sourceContent,
          similarTemplateIds: similarTemplateIdsText
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '추출 초안 생성에 실패했습니다.');
      }

      setDraftDetail(result.data);
      setSelectedDraftId(result.data.draft.id);
      setReviewedFieldsText(toReviewedFieldsJson(result.data));
      setMessage('추출 초안과 후보 필드가 저장되었습니다.');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '추출 초안 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    const normalizedDraftId = selectedDraftId.trim();

    if (!normalizedDraftId) {
      setMessage('승인할 draftId를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/extract/${normalizedDraftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          layoutResizeMode,
          reviewedFields: JSON.parse(reviewedFieldsText),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '정식 템플릿 승인에 실패했습니다.');
      }

      setApproveResult(result.data);
      setMessage(
        `정식 템플릿 ${result.data.templateId} 생성 완료. 승인 필드 ${result.data.approvedFieldCount}개, 건너뜀 ${result.data.skippedFieldCount}개`
      );
      await loadDraft(normalizedDraftId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '정식 템플릿 승인에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-EXT-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">템플릿 추출</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            값이 이미 들어간 문서를 읽어 템플릿 등록으로 넘길 수 있는 draft HTML과 후보 필드를 생성하는 1차 골격입니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            지금 단계는 HTML 또는 텍스트 본문을 직접 붙여 넣는 방식입니다. 실제 파일 업로드 파서와 LLM 추출은 다음 단계로 남겨둡니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDraft(selectedDraftId)} disabled={loading}>
            초안 조회
          </Button>
          <Button onClick={handleCreateDraft} disabled={loading}>
            초안 생성
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
            <CardTitle>입력값이 들어간 원본 본문</CardTitle>
            <CardDescription>
              표 구조가 있는 HTML이면 구조를 최대한 유지하고, 텍스트면 `라벨: 값` 패턴을 기준으로 후보를 만듭니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">원본 제목</label>
                <Input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">입력 형식</label>
                <select
                  value={sourceKind}
                  onChange={(event) => setSourceKind(event.target.value as TemplateExtractSourceKind)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="html">html</option>
                  <option value="text">text</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">유사 템플릿 ID 목록</label>
              <Input
                value={similarTemplateIdsText}
                onChange={(event) => setSimilarTemplateIdsText(event.target.value)}
                placeholder="쉼표로 구분해서 입력"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">원본 본문</label>
              <textarea
                value={sourceContent}
                onChange={(event) => setSourceContent(event.target.value)}
                className="flex min-h-[360px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>최근 추출 결과</CardTitle>
              <CardDescription>방금 생성한 draft와 후보 필드 요약입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {draftDetail ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="green">{draftDetail.draft.status}</Badge>
                    <span className="font-medium text-slate-900">
                      {draftDetail.draft.sourceTitle || '제목 없음'}
                    </span>
                  </div>
                  <p>Draft ID: {draftDetail.draft.id}</p>
                  <p>후보 수: {draftDetail.reviewSummary.candidateCount}</p>
                  <p>즉시 수용 후보: {draftDetail.reviewSummary.acceptedCount}</p>
                  <p>검토 필요 후보: {draftDetail.reviewSummary.reviewNeededCount}</p>
                  <p>평균 확신도: {draftDetail.reviewSummary.averageConfidenceScore}</p>
                </>
              ) : (
                <p className="text-slate-500">아직 생성된 추출 초안이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>정식 템플릿 승인</CardTitle>
              <CardDescription>
                추출 후보를 검토한 뒤 템플릿 등록 서비스로 넘겨 정식 템플릿을 만듭니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">Draft ID</label>
                <Input
                  value={selectedDraftId}
                  onChange={(event) => setSelectedDraftId(event.target.value)}
                  placeholder="draftId를 입력하세요"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">생성할 템플릿 이름</label>
                  <Input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">레이아웃 확장 정책</label>
                  <select
                    value={layoutResizeMode}
                    onChange={(event) =>
                      setLayoutResizeMode(event.target.value as TemplateLayoutResizeMode)
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="fixed">fixed</option>
                    <option value="grow_height">grow_height</option>
                    <option value="grow_width">grow_width</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">검토 후보 JSON</label>
                <textarea
                  value={reviewedFieldsText}
                  onChange={(event) => setReviewedFieldsText(event.target.value)}
                  className="flex min-h-[260px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <Button variant="outline" onClick={handleApprove} disabled={loading}>
                정식 템플릿 승인
              </Button>

              {approveResult ? (
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">승인 완료</p>
                  <p>템플릿 ID: {approveResult.templateId}</p>
                  <p>승인 필드 수: {approveResult.approvedFieldCount}</p>
                  <p>건너뛴 필드 수: {approveResult.skippedFieldCount}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>저장된 추출 초안 상세</CardTitle>
          <CardDescription>
            생성된 draft HTML, 후보 필드, 검토 상태를 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">Generated Draft HTML</p>
            <textarea
              readOnly
              value={draftDetail?.draft.generatedDraftHtml || ''}
              className="flex min-h-[280px] w-full rounded-md border border-input bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">후보 필드 목록</p>
            {draftDetail?.candidates.length ? (
              draftDetail.candidates.map((candidate) => (
                <div key={candidate.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Badge variant={candidate.reviewStatus === 'accepted' ? 'green' : 'slate'}>
                      {candidate.reviewStatus}
                    </Badge>
                    <span className="font-medium text-slate-900">{candidate.fieldLabel}</span>
                  </div>
                  <p>fieldKey: {candidate.fieldKey}</p>
                  <p>labelKey: {candidate.labelKey}</p>
                  <p>fieldType: {candidate.fieldType}</p>
                  <p>detectedValue: {candidate.detectedValue || '-'}</p>
                  <p>confidence: {candidate.confidenceScore}</p>
                  <p>reason: {candidate.extractionReason || '-'}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">조회된 후보 필드가 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
