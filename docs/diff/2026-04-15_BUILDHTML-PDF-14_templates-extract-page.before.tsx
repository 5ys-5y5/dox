'use client';

import * as React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EntityPicker } from '../../../components/ui/EntityPicker';
import { Input } from '../../../components/ui/Input';
import { TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS } from '../../../lib/templateExtractDtos';
import type {
  TemplateExtractCandidateDto,
  TemplateExtractDetailResult,
  TemplateExtractEngineVersion,
  TemplateExtractReviewedFieldInput,
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

const RECENT_DRAFTS_STORAGE_KEY = 'template-extract-recent-drafts';

type RecentDraftOption = {
  id: string;
  label: string;
  meta: string;
};

const toReviewedFields = (detail: TemplateExtractDetailResult): TemplateExtractReviewedFieldInput[] =>
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
  }));

const renderContentPreview = (sourceKind: TemplateExtractSourceKind, content: string) => {
  if (!content.trim()) {
    return <p className="text-sm text-slate-500">표시할 내용이 없습니다.</p>;
  }

  if (sourceKind === 'html') {
    return (
      <div
        className="prose prose-sm max-w-none text-slate-800"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700">{content}</pre>;
};

const renderDraftPreview = (html: string) => {
  if (!html.trim()) {
    return <p className="text-sm text-slate-500">아직 생성된 초안이 없습니다.</p>;
  }

  return (
    <div
      className="prose prose-sm max-w-none text-slate-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default function TemplateExtractPage() {
  const [sourceTitle, setSourceTitle] = React.useState('안전관리계획서 입력본');
  const [sourceKind, setSourceKind] = React.useState<TemplateExtractSourceKind>('html');
  const [sourceContent, setSourceContent] = React.useState(defaultSourceContent);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [engineVersion, setEngineVersion] = React.useState<TemplateExtractEngineVersion>('13');
  const [similarTemplateIdsText, setSimilarTemplateIdsText] = React.useState('');
  const [selectedDraftId, setSelectedDraftId] = React.useState('');
  const [reviewedFields, setReviewedFields] = React.useState<TemplateExtractReviewedFieldInput[]>([]);
  const [advancedReviewedFieldsText, setAdvancedReviewedFieldsText] = React.useState('[]');
  const [templateName, setTemplateName] = React.useState('안전관리계획서 템플릿 초안');
  const [layoutResizeMode, setLayoutResizeMode] =
    React.useState<TemplateLayoutResizeMode>('grow_height');
  const [draftDetail, setDraftDetail] = React.useState<TemplateExtractDetailResult | null>(null);
  const [recentDrafts, setRecentDrafts] = React.useState<RecentDraftOption[]>([]);
  const [approveResult, setApproveResult] = React.useState<{
    templateId: string;
    approvedFieldCount: number;
    skippedFieldCount: number;
  } | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [draftHtmlCopied, setDraftHtmlCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const candidateMap = React.useMemo(() => {
    const map = new Map<string, TemplateExtractCandidateDto>();

    for (const candidate of draftDetail?.candidates || []) {
      map.set(candidate.candidateKey, candidate);
    }

    return map;
  }, [draftDetail]);

  const reviewedSummary = React.useMemo(() => {
    return reviewedFields.reduce(
      (summary, candidate) => {
        if (candidate.reviewStatus === 'accepted') {
          summary.accepted += 1;
        } else if (candidate.reviewStatus === 'rejected') {
          summary.rejected += 1;
        } else {
          summary.reviewNeeded += 1;
        }

        return summary;
      },
      { accepted: 0, reviewNeeded: 0, rejected: 0 }
    );
  }, [reviewedFields]);

  const persistRecentDraft = React.useCallback((detail: TemplateExtractDetailResult) => {
    const nextEntry = {
      id: detail.draft.id,
      label: detail.draft.sourceTitle || '제목 없는 초안',
      meta: detail.draft.id,
    };

    setRecentDrafts((previous) => {
      const nextDrafts = [nextEntry, ...previous.filter((item) => item.id !== nextEntry.id)].slice(0, 8);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts));
      }

      return nextDrafts;
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem(RECENT_DRAFTS_STORAGE_KEY);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as RecentDraftOption[];
      setRecentDrafts(Array.isArray(parsed) ? parsed : []);
    } catch {
      // ignore local storage parse errors
    }
  }, []);

  const syncReviewedFields = React.useCallback((nextFields: TemplateExtractReviewedFieldInput[]) => {
    setReviewedFields(nextFields);
    setAdvancedReviewedFieldsText(JSON.stringify(nextFields, null, 2));
  }, []);

  const loadDraft = React.useCallback(
    async (draftId: string) => {
      const normalizedDraftId = draftId.trim();

      if (!normalizedDraftId) {
        setDraftDetail(null);
        syncReviewedFields([]);
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
        setSelectedDraftId(normalizedDraftId);
        syncReviewedFields(toReviewedFields(result.data));
        persistRecentDraft(result.data);
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '추출 초안 조회에 실패했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    [persistRecentDraft, syncReviewedFields]
  );

  const handleCreateDraft = async () => {
    setLoading(true);
    setMessage(null);
    setApproveResult(null);

    try {
      const similarTemplateIds = similarTemplateIdsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const response = selectedFile
        ? await (async () => {
            const formData = new FormData();
            formData.append('sourceTitle', sourceTitle);
            formData.append('similarTemplateIds', similarTemplateIds.join(','));
            formData.append('engineVersion', engineVersion);
            formData.append('file', selectedFile);

            return fetch('/api/templates/extract', {
              method: 'POST',
              body: formData,
            });
          })()
        : await fetch('/api/templates/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceTitle,
              sourceKind,
              sourceContent,
              similarTemplateIds,
              engineVersion,
            }),
          });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '추출 초안 생성에 실패했습니다.');
      }

      setDraftDetail(result.data);
      setSelectedDraftId(result.data.draft.id);
      syncReviewedFields(toReviewedFields(result.data));
      persistRecentDraft(result.data);
      const versionLabel =
        TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS.find((option) => option.value === engineVersion)?.label || engineVersion;
      setMessage(`원본 문서를 읽어 템플릿 초안과 추천 항목을 만들었습니다. (${versionLabel})`);
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
      setMessage('승인할 초안을 먼저 선택하세요.');
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
          reviewedFields,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '정식 템플릿 승인에 실패했습니다.');
      }

      setApproveResult(result.data);
      setMessage(
        `정식 템플릿 ${result.data.templateId} 생성 완료. 승인 ${result.data.approvedFieldCount}개, 제외 ${result.data.skippedFieldCount}개`
      );
      await loadDraft(normalizedDraftId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '정식 템플릿 승인에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDraftHtml = async () => {
    const html = draftDetail?.draft.generatedDraftHtml?.trim() || '';

    if (!html) {
      setMessage('복사할 생성 HTML이 없습니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(html);
      setDraftHtmlCopied(true);
      window.setTimeout(() => setDraftHtmlCopied(false), 1800);
    } catch {
      setMessage('생성된 HTML 코드를 복사하지 못했습니다.');
    }
  };

  const updateReviewedField = (
    candidateKey: string | undefined,
    patch: Partial<TemplateExtractReviewedFieldInput>
  ) => {
    syncReviewedFields(
      reviewedFields.map((field) =>
        field.candidateKey === candidateKey
          ? {
              ...field,
              ...patch,
            }
          : field
      )
    );
  };

  const handleAdvancedReviewedFieldsChange = (value: string) => {
    setAdvancedReviewedFieldsText(value);

    try {
      const parsed = JSON.parse(value) as TemplateExtractReviewedFieldInput[];

      if (Array.isArray(parsed)) {
        setReviewedFields(parsed);
      }
    } catch {
      // keep raw text until json becomes valid again
    }
  };

  const previewSourceKind = draftDetail?.draft.sourceKind || sourceKind;
  const previewSourceContent = draftDetail?.draft.sourceContent || sourceContent;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-FLOW-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">템플릿 추출</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문서를 올리면 왼쪽에서 원본과 추출 초안을 크게 보고, 오른쪽에서 필요한 항목만 검토한 뒤 바로 템플릿으로 저장합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDraft(selectedDraftId)} disabled={loading}>
            최근 초안 열기
          </Button>
          <Button onClick={handleCreateDraft} disabled={loading}>
            초안 생성
          </Button>
          <select
            value={engineVersion}
            onChange={(event) => setEngineVersion(event.target.value as TemplateExtractEngineVersion)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>원본 문서 입력</CardTitle>
              <CardDescription>
                파일 업로드 또는 본문 붙여넣기 중 편한 방법 하나만 쓰면 됩니다. 파일이 있으면 파일을 우선 읽습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">원본 제목</label>
                  <Input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">업로드 파일</label>
                  <input
                    type="file"
                    accept=".txt,.html,.htm,.docx,.pdf,text/plain,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>선택된 파일: {selectedFile ? selectedFile.name : '없음'}</p>
                <p>파일 형식: {selectedFile?.type || '-'}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">수동 입력 형식</label>
                  <select
                    value={sourceKind}
                    onChange={(event) => setSourceKind(event.target.value as TemplateExtractSourceKind)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="html">html</option>
                    <option value="text">text</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">유사 템플릿 ID 목록</label>
                  <Input
                    value={similarTemplateIdsText}
                    onChange={(event) => setSimilarTemplateIdsText(event.target.value)}
                    placeholder="필요하면 쉼표로 구분해 입력"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">추출 엔진 버전</label>
                  <Input
                    value={
                      TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS.find((option) => option.value === engineVersion)?.label ||
                      engineVersion
                    }
                    readOnly
                  />
                </div>
              </div>

              <details className="rounded-lg border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                  원본 본문 직접 붙여넣기
                </summary>
                <div className="mt-3">
                  <textarea
                    value={sourceContent}
                    onChange={(event) => setSourceContent(event.target.value)}
                    className="flex min-h-[240px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>원본 문서 미리보기</CardTitle>
              <CardDescription>사용자가 실제로 보게 될 문서를 기준으로 어떤 항목을 템플릿으로 만들지 검토합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-6">
                {renderContentPreview(previewSourceKind, previewSourceContent)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>추출된 템플릿 초안</CardTitle>
              <CardDescription>왼쪽 원본을 읽어 자동으로 만든 템플릿 초안입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-6">
                {renderDraftPreview(draftDetail?.draft.generatedDraftHtml || '')}
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">생성된 HTML 코드</p>
                    <p className="text-xs text-slate-600">
                      브라우저를 다시 열지 않고도 품질을 확인할 수 있게, 현재 생성된 HTML 원문을 그대로 복사합니다.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleCopyDraftHtml}
                    disabled={!draftDetail?.draft.generatedDraftHtml}
                  >
                    {draftHtmlCopied ? '복사됨' : 'HTML 코드 복사'}
                  </Button>
                </div>
                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    생성된 HTML 코드 보기
                  </summary>
                  <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-100">
                    {draftDetail?.draft.generatedDraftHtml?.trim() || '아직 생성된 HTML이 없습니다.'}
                  </pre>
                </details>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>초안 요약</CardTitle>
              <CardDescription>방금 만든 초안과 현재 검토 상태입니다.</CardDescription>
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
                  <p>초안 ID: {draftDetail.draft.id}</p>
                  <p>검토 대상: {reviewedFields.length}개</p>
                  <p>승인 예정: {reviewedSummary.accepted}개</p>
                  <p>추가 검토: {reviewedSummary.reviewNeeded}개</p>
                  <p>제외: {reviewedSummary.rejected}개</p>
                </>
              ) : (
                <p className="text-slate-500">아직 생성된 추출 초안이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>정식 템플릿 만들기</CardTitle>
              <CardDescription>초안을 고른 뒤 템플릿 이름과 레이아웃 정책만 정하면 저장됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">최근 초안 선택</label>
                <EntityPicker
                  value={selectedDraftId}
                  options={recentDrafts}
                  onChange={setSelectedDraftId}
                  placeholder="최근 초안을 선택하세요"
                  emptyMessage="최근 초안이 없습니다."
                  className="flex-1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">템플릿 이름</label>
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
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

              <Button variant="outline" onClick={handleApprove} disabled={loading || !draftDetail}>
                정식 템플릿 만들기
              </Button>

              {approveResult ? (
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">생성 완료</p>
                  <p>템플릿 ID: {approveResult.templateId}</p>
                  <p>승인 항목 수: {approveResult.approvedFieldCount}</p>
                  <a
                    href={`/templates?templateId=${approveResult.templateId}`}
                    className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    생성된 템플릿 열기
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>항목 검토</CardTitle>
              <CardDescription>필요한 항목만 승인하고, 불필요한 항목은 제외합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewedFields.length > 0 ? (
                reviewedFields.map((field) => {
                  const candidate = candidateMap.get(field.candidateKey || '');

                  return (
                    <div key={field.candidateKey || field.fieldKey} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            field.reviewStatus === 'accepted'
                              ? 'green'
                              : field.reviewStatus === 'rejected'
                                ? 'slate'
                                : 'slate'
                          }
                        >
                          {field.reviewStatus}
                        </Badge>
                        <Input
                          value={field.fieldLabel}
                          onChange={(event) =>
                            updateReviewedField(field.candidateKey, { fieldLabel: event.target.value })
                          }
                        />
                      </div>
                      <div className="mt-3 grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500">감지된 값</p>
                            <p className="text-sm text-slate-700">{candidate?.detectedValue || '-'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500">필드 타입</p>
                            <p className="text-sm text-slate-700">{field.fieldType}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-500">이 항목 처리</label>
                          <select
                            value={field.reviewStatus || 'review_needed'}
                            onChange={(event) =>
                              updateReviewedField(field.candidateKey, {
                                reviewStatus: event.target.value as TemplateExtractReviewedFieldInput['reviewStatus'],
                              })
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="accepted">템플릿 항목으로 저장</option>
                            <option value="review_needed">조금 더 검토</option>
                            <option value="rejected">이번 템플릿에서 제외</option>
                          </select>
                        </div>
                        <p className="text-xs text-slate-500">추출 근거: {candidate?.extractionReason || '-'}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">생성된 초안이 있으면 검토 항목이 나타납니다.</p>
              )}
            </CardContent>
          </Card>

          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">고급 JSON 편집</summary>
            <div className="mt-3 space-y-2">
              <label className="text-sm font-medium text-slate-800">검토 후보 JSON</label>
              <textarea
                value={advancedReviewedFieldsText}
                onChange={(event) => handleAdvancedReviewedFieldsChange(event.target.value)}
                className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
