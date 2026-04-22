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
  TemplateExtractVisualSimilarityReport,
} from '../../../lib/templateExtractDtos';
import type { TemplateLayoutResizeMode } from '../../../lib/templateDtos';
import { TemplateExtractVisualSimilarityClient } from '../../../lib/templateExtractVisualSimilarityClient';

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

type DraftCreateProgressPhase = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

type DraftCreateProgressState = {
  visible: boolean;
  phase: DraftCreateProgressPhase;
  percent: number;
  stage: string;
  detail: string;
};

type VisualSimilarityProgressStepKey =
  | 'uploading'
  | 'rendering_pdf'
  | 'preparing_pdf_pages'
  | 'loading_html'
  | 'capturing_pages'
  | 'comparing_pages'
  | 'aggregating';

type VisualSimilarityProgressPhase =
  | 'idle'
  | VisualSimilarityProgressStepKey
  | 'completed'
  | 'failed';

type VisualSimilarityProgressState = {
  visible: boolean;
  phase: VisualSimilarityProgressPhase;
  activeStep: VisualSimilarityProgressStepKey | null;
  percent: number;
  stage: string;
  detail: string;
};

const VISUAL_SIMILARITY_PROGRESS_STEPS: Array<{
  key: VisualSimilarityProgressStepKey;
  label: string;
  description: string;
}> = [
  {
    key: 'uploading',
    label: '1. PDF 업로드',
    description: '브라우저에서 측정용 원본 PDF를 서버로 전송합니다.',
  },
  {
    key: 'rendering_pdf',
    label: '2. PDF 페이지 렌더',
    description: '서버에서 원본 PDF를 페이지 PNG로 렌더합니다.',
  },
  {
    key: 'preparing_pdf_pages',
    label: '3. PDF 페이지 준비',
    description: '브라우저에서 PDF PNG를 비교용 canvas로 정규화합니다.',
  },
  {
    key: 'loading_html',
    label: '4. HTML 로드',
    description: '추출 HTML을 숨김 브라우저 프레임에 올립니다.',
  },
  {
    key: 'capturing_pages',
    label: '5. HTML 캡처',
    description: '브라우저 DOM 렌더를 페이지별 canvas로 캡처합니다.',
  },
  {
    key: 'comparing_pages',
    label: '6. 픽셀 비교',
    description: '페이지별로 1px 허용 오차 기준 잉크 픽셀을 비교합니다.',
  },
  {
    key: 'aggregating',
    label: '7. 결과 집계',
    description: '페이지별 overlap 결과를 합산해 최종 비율을 계산합니다.',
  },
];

const VISUAL_SIMILARITY_STEP_ORDER: Record<VisualSimilarityProgressStepKey, number> = {
  uploading: 0,
  rendering_pdf: 1,
  preparing_pdf_pages: 2,
  loading_html: 3,
  capturing_pages: 4,
  comparing_pages: 5,
  aggregating: 6,
};

const V24_TARGET_VISUAL_SCORE = 0.9;
const V24_CANDIDATE_VERSIONS: TemplateExtractEngineVersion[] = ['20', '5', '22', '23'];

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

const formatScore = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(4);
};

const formatPercent = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return `${(value * 100).toFixed(2)}%`;
};

const getVisualSimilarityCurrentStep = (progress: VisualSimilarityProgressState) => {
  if (progress.phase === 'completed') {
    return VISUAL_SIMILARITY_PROGRESS_STEPS.length;
  }

  if (!progress.activeStep) {
    return 0;
  }

  return VISUAL_SIMILARITY_STEP_ORDER[progress.activeStep] + 1;
};

const getVisualSimilarityStepState = (
  progress: VisualSimilarityProgressState,
  stepKey: VisualSimilarityProgressStepKey
) => {
  const currentOrder = progress.activeStep ? VISUAL_SIMILARITY_STEP_ORDER[progress.activeStep] : -1;
  const stepOrder = VISUAL_SIMILARITY_STEP_ORDER[stepKey];

  if (progress.phase === 'completed') {
    return 'done' as const;
  }

  if (progress.phase === 'failed') {
    if (progress.activeStep === stepKey) {
      return 'failed' as const;
    }

    return stepOrder < currentOrder ? ('done' as const) : ('pending' as const);
  }

  if (progress.activeStep === stepKey) {
    return 'active' as const;
  }

  return stepOrder < currentOrder ? ('done' as const) : ('pending' as const);
};

export default function TemplateExtractPage() {
  const [sourceTitle, setSourceTitle] = React.useState('안전관리계획서 입력본');
  const [sourceKind, setSourceKind] = React.useState<TemplateExtractSourceKind>('html');
  const [sourceContent, setSourceContent] = React.useState(defaultSourceContent);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [engineVersion, setEngineVersion] = React.useState<TemplateExtractEngineVersion>('19');
  const [similarTemplateIdsText, setSimilarTemplateIdsText] = React.useState('');
  const [selectedDraftId, setSelectedDraftId] = React.useState('');
  const [reviewedFields, setReviewedFields] = React.useState<TemplateExtractReviewedFieldInput[]>([]);
  const [advancedReviewedFieldsText, setAdvancedReviewedFieldsText] = React.useState('[]');
  const [templateName, setTemplateName] = React.useState('안전관리계획서 템플릿 초안');
  const [layoutResizeMode, setLayoutResizeMode] =
    React.useState<TemplateLayoutResizeMode>('grow_height');
  const [draftDetail, setDraftDetail] = React.useState<TemplateExtractDetailResult | null>(null);
  const [visualSimilarityReport, setVisualSimilarityReport] =
    React.useState<TemplateExtractVisualSimilarityReport | null>(null);
  const [recentDrafts, setRecentDrafts] = React.useState<RecentDraftOption[]>([]);
  const [approveResult, setApproveResult] = React.useState<{
    templateId: string;
    approvedFieldCount: number;
    skippedFieldCount: number;
  } | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [draftHtmlCopied, setDraftHtmlCopied] = React.useState(false);
  const [draftLogWriting, setDraftLogWriting] = React.useState(false);
  const [visualSimilarityMeasuring, setVisualSimilarityMeasuring] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [draftProgress, setDraftProgress] = React.useState<DraftCreateProgressState>({
    visible: false,
    phase: 'idle',
    percent: 0,
    stage: '',
    detail: '',
  });
  const progressTimerRef = React.useRef<number | null>(null);
  const visualProgressTimerRef = React.useRef<number | null>(null);
  const visualMeasurementFrameRef = React.useRef<HTMLIFrameElement | null>(null);
  const visualMeasurementLogFileNameRef = React.useRef('');
  const lastVisualMeasurementLogEventKeyRef = React.useRef('');
  const lastVisualMeasurementKeyRef = React.useRef<string>('');
  const [visualSimilarityProgress, setVisualSimilarityProgress] =
    React.useState<VisualSimilarityProgressState>({
      visible: false,
      phase: 'idle',
      activeStep: null,
      percent: 0,
      stage: '',
      detail: '',
    });

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

  const clearDraftProgressTimer = React.useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearDraftProgressTimer(), [clearDraftProgressTimer]);

  const clearVisualSimilarityProgressTimer = React.useCallback(() => {
    if (visualProgressTimerRef.current !== null) {
      window.clearInterval(visualProgressTimerRef.current);
      visualProgressTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => clearVisualSimilarityProgressTimer(),
    [clearVisualSimilarityProgressTimer]
  );

  const updateDraftProgress = React.useCallback(
    (patch: Partial<DraftCreateProgressState>) => {
      setDraftProgress((previous) => ({
        ...previous,
        ...patch,
      }));
    },
    []
  );

  const updateVisualSimilarityProgress = React.useCallback(
    (patch: Partial<VisualSimilarityProgressState>) => {
      setVisualSimilarityProgress((previous) => ({
        ...previous,
        ...patch,
      }));
    },
    []
  );

  const postVisualMeasurementLog = React.useCallback(
    async (body: Record<string, unknown>) => {
      const fileName = visualMeasurementLogFileNameRef.current.trim();

      if (!fileName) {
        return;
      }

      try {
        await fetch('/api/templates/extract/measure/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            fileName,
          }),
        });
      } catch {
        // measurement logging must never block the main flow
      }
    },
    []
  );

  const appendVisualMeasurementLog = React.useCallback(
    async (input: {
      level?: 'info' | 'warn' | 'error';
      phase: string;
      percent?: number | null;
      stage?: string | null;
      detail?: string | null;
      payload?: unknown;
      force?: boolean;
    }) => {
      const eventKey = JSON.stringify([
        input.level || 'info',
        input.phase,
        input.percent ?? null,
        input.stage || '',
        input.detail || '',
      ]);

      if (!input.force && lastVisualMeasurementLogEventKeyRef.current === eventKey) {
        return;
      }

      lastVisualMeasurementLogEventKeyRef.current = eventKey;
      await postVisualMeasurementLog({
        action: 'append',
        level: input.level || 'info',
        phase: input.phase,
        percent: input.percent ?? null,
        stage: input.stage ?? null,
        detail: input.detail ?? null,
        payload: input.payload,
      });
    },
    [postVisualMeasurementLog]
  );

  const startVisualMeasurementLog = React.useCallback(
    async (input: {
      draftId?: string | null;
      sourceTitle?: string | null;
      sourceFileName?: string | null;
      engineVersion?: TemplateExtractEngineVersion | 'unknown' | null;
    }) => {
      lastVisualMeasurementLogEventKeyRef.current = '';

      try {
        const response = await fetch('/api/templates/extract/measure/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            draftId: input.draftId || null,
            sourceTitle: input.sourceTitle || null,
            sourceFileName: input.sourceFileName || null,
            engineVersion: input.engineVersion || 'unknown',
          }),
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '시각 유사도 로그 세션을 시작하지 못했습니다.');
        }

        visualMeasurementLogFileNameRef.current = String(result.data?.fileName || '').trim();
      } catch {
        visualMeasurementLogFileNameRef.current = '';
      }
    },
    []
  );

  const beginProcessingProgress = React.useCallback(
    (startPercent: number, stage: string, detail: string) => {
      clearDraftProgressTimer();
      setDraftProgress({
        visible: true,
        phase: 'processing',
        percent: startPercent,
        stage,
        detail,
      });

      progressTimerRef.current = window.setInterval(() => {
        setDraftProgress((previous) => {
          if (previous.phase !== 'processing') {
            return previous;
          }

          const ceiling = previous.percent < 80 ? 86 : 94;
          const step = previous.percent < 55 ? 4 : previous.percent < 75 ? 2 : 1;
          const nextPercent = Math.min(previous.percent + step, ceiling);

          if (nextPercent === previous.percent) {
            return previous;
          }

          return {
            ...previous,
            percent: nextPercent,
          };
        });
      }, 420);
    },
    [clearDraftProgressTimer]
  );

  const beginVisualSimilarityServerProgress = React.useCallback(
    (startPercent: number, stage: string, detail: string) => {
      clearVisualSimilarityProgressTimer();
      setVisualSimilarityProgress({
        visible: true,
        phase: 'rendering_pdf',
        activeStep: 'rendering_pdf',
        percent: startPercent,
        stage,
        detail,
      });

      visualProgressTimerRef.current = window.setInterval(() => {
        setVisualSimilarityProgress((previous) => {
          if (previous.phase !== 'rendering_pdf') {
            return previous;
          }

          const nextPercent = Math.min(previous.percent + 2, 40);

          if (nextPercent === previous.percent) {
            return previous;
          }

          return {
            ...previous,
            percent: nextPercent,
          };
        });
      }, 380);
    },
    [clearVisualSimilarityProgressTimer]
  );

  const createDraftWithFileUpload = React.useCallback(
    (formData: FormData) =>
      new Promise<{ success: boolean; data?: TemplateExtractDetailResult; message?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('POST', '/api/templates/extract');
        xhr.responseType = 'text';

        xhr.upload.onprogress = (event) => {
          const uploadRatio = event.lengthComputable && event.total > 0 ? event.loaded / event.total : 0.7;
          const uploadPercent = Math.max(4, Math.min(Math.round(uploadRatio * 58), 58));

          updateDraftProgress({
            visible: true,
            phase: 'uploading',
            percent: uploadPercent,
            stage: '파일을 업로드하고 있습니다.',
            detail: event.lengthComputable
              ? `업로드 ${Math.round(uploadRatio * 100)}%`
              : '브라우저에서 서버로 파일을 전송하고 있습니다.',
          });
        };

        xhr.onerror = () => {
          reject(new Error('추출 초안 생성 요청을 서버로 보내지 못했습니다.'));
        };

        xhr.onload = () => {
          beginProcessingProgress(
            62,
            '문서를 분석하고 있습니다.',
            '원본 문서를 읽고 템플릿 초안과 추천 항목을 조립하고 있습니다.'
          );

          try {
            const parsed = JSON.parse(xhr.responseText || '{}') as {
              success?: boolean;
              data?: TemplateExtractDetailResult;
              message?: string;
            };

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({
                success: Boolean(parsed.success),
                data: parsed.data,
                message: parsed.message,
              });
              return;
            }

            reject(new Error(parsed.message || '추출 초안 생성에 실패했습니다.'));
          } catch {
            reject(new Error('추출 초안 응답을 해석하지 못했습니다.'));
          }
        };

        xhr.send(formData);
      }),
    [beginProcessingProgress, updateDraftProgress]
  );

  const measureVisualSimilarityForHtml = React.useCallback(
    async (input: {
      draftId: string;
      candidateVersion: TemplateExtractEngineVersion;
      candidateIndex: number;
      candidateCount: number;
      sourceTitle: string | null;
      sourceHtml: string;
      pdfPageDataUrls: string[];
      fileName: string;
    }) => {
      const iframe = visualMeasurementFrameRef.current;

      if (!iframe) {
        throw new Error('시각 유사도 측정용 브라우저 프레임을 초기화하지 못했습니다.');
      }

      updateVisualSimilarityProgress({
        visible: true,
        phase: 'loading_html',
        activeStep: 'loading_html',
        percent: 52,
        stage: `v24 후보 ${input.candidateVersion} 시각 유사도를 측정하고 있습니다.`,
        detail: `후보 ${input.candidateIndex}/${input.candidateCount} HTML을 브라우저 렌더로 비교합니다.`,
      });

      const report = await TemplateExtractVisualSimilarityClient.measure({
        html: input.sourceHtml,
        pdfPageDataUrls: input.pdfPageDataUrls,
        iframe,
        minimumPassScore: V24_TARGET_VISUAL_SCORE,
        onProgress: (progress) => {
          updateVisualSimilarityProgress({
            visible: true,
            phase: progress.phase,
            activeStep: progress.phase,
            percent: progress.percent,
            stage: `[v${input.candidateVersion} ${input.candidateIndex}/${input.candidateCount}] ${progress.stage}`,
            detail: progress.detail,
          });
        },
      });

      return report;
    },
    [updateVisualSimilarityProgress]
  );

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
    setVisualSimilarityReport(null);
    clearDraftProgressTimer();
    setDraftProgress({
      visible: true,
      phase: selectedFile ? 'uploading' : 'processing',
      percent: selectedFile ? 4 : 12,
      stage: selectedFile ? '파일을 업로드하고 있습니다.' : '문서를 준비하고 있습니다.',
      detail: selectedFile
        ? '브라우저에서 서버로 파일을 전송합니다.'
        : '붙여 넣은 원본 본문을 읽어 템플릿 초안을 준비합니다.',
    });

    try {
      const similarTemplateIds = similarTemplateIdsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      let result;

      if (engineVersion === '24' && selectedFile) {
        if (!/\.pdf$/i.test(selectedFile.name) && selectedFile.type !== 'application/pdf') {
          throw new Error('v24 자동 비교는 PDF 업로드에 대해서만 지원합니다.');
        }

        clearVisualSimilarityProgressTimer();
        setVisualSimilarityProgress({
          visible: true,
          phase: 'uploading',
          activeStep: 'uploading',
          percent: 2,
          stage: 'v24 후보 비교를 준비하고 있습니다.',
          detail: '실제 브라우저 시각 유사도로 후보 버전을 순차 비교합니다.',
        });

        const pdfPageDataUrls = await requestVisualSimilarityPdfPages(selectedFile);
        const candidateResults: Array<{
          version: TemplateExtractEngineVersion;
          detail: TemplateExtractDetailResult;
          report: TemplateExtractVisualSimilarityReport;
        }> = [];
        const candidateMessages: string[] = [];

        for (let index = 0; index < V24_CANDIDATE_VERSIONS.length; index += 1) {
          const candidateVersion = V24_CANDIDATE_VERSIONS[index];

          updateDraftProgress({
            visible: true,
            phase: 'processing',
            percent: 64,
            stage: `v24 후보 ${candidateVersion} 초안을 생성하고 있습니다.`,
            detail: `후보 ${index + 1}/${V24_CANDIDATE_VERSIONS.length} 를 실제 시각 유사도로 검증합니다.`,
          });

          try {
            const formData = new FormData();
            formData.append('sourceTitle', sourceTitle);
            formData.append('similarTemplateIds', similarTemplateIds.join(','));
            formData.append('engineVersion', candidateVersion);
            formData.append('file', selectedFile);

            const candidateResult = await createDraftWithFileUpload(formData);

            if (!candidateResult.success || !candidateResult.data) {
              throw new Error(candidateResult.message || `v${candidateVersion} 초안 생성에 실패했습니다.`);
            }

            const report = await measureVisualSimilarityForHtml({
              draftId: candidateResult.data.draft.id,
              candidateVersion,
              candidateIndex: index + 1,
              candidateCount: V24_CANDIDATE_VERSIONS.length,
              sourceTitle: candidateResult.data.draft.sourceTitle,
              sourceHtml: candidateResult.data.draft.sourceContent.trim(),
              pdfPageDataUrls,
              fileName: selectedFile.name,
            });

            candidateResults.push({
              version: candidateVersion,
              detail: candidateResult.data,
              report,
            });
            candidateMessages.push(`v${candidateVersion} ${formatPercent(report.overallScore)}`);

            if (report.overallScore >= V24_TARGET_VISUAL_SCORE) {
              break;
            }
          } catch (error) {
            const nextMessage =
              error instanceof Error ? error.message : `v${candidateVersion} 후보 검증에 실패했습니다.`;
            candidateMessages.push(`v${candidateVersion} 실패`);
            updateVisualSimilarityProgress({
              visible: true,
              phase: 'failed',
              activeStep: 'capturing_pages',
              percent: 12,
              stage: `v24 후보 ${candidateVersion} 검증 실패`,
              detail: nextMessage,
            });
          }
        }

        const bestCandidate = candidateResults.reduce<{
          version: TemplateExtractEngineVersion;
          detail: TemplateExtractDetailResult;
          report: TemplateExtractVisualSimilarityReport;
        } | null>((best, current) => {
          if (!best || current.report.overallScore > best.report.overallScore) {
            return current;
          }

          return best;
        }, null);

        if (!bestCandidate) {
          throw new Error('v24 후보 비교에서 측정 가능한 초안을 하나도 만들지 못했습니다.');
        }

        result = {
          success: true,
          data: bestCandidate.detail,
          message: candidateMessages.join(' / '),
        };

        const bestMeasurementKey = [
          bestCandidate.detail.draft.id,
          selectedFile.name,
          selectedFile.size,
          selectedFile.lastModified,
        ].join('::');

        lastVisualMeasurementKeyRef.current = bestMeasurementKey;
        setVisualSimilarityReport(bestCandidate.report);
        clearVisualSimilarityProgressTimer();
        setVisualSimilarityProgress({
          visible: true,
          phase: 'completed',
          activeStep: 'aggregating',
          percent: 100,
          stage:
            bestCandidate.report.overallScore >= V24_TARGET_VISUAL_SCORE
              ? `v24가 목표 이상 후보를 찾았습니다.`
              : 'v24 후보 비교를 완료했습니다.',
          detail: `선택: v${bestCandidate.version} ${formatPercent(bestCandidate.report.overallScore)} / 비교: ${candidateMessages.join(', ')}`,
        });
      } else if (selectedFile) {
        const formData = new FormData();
        formData.append('sourceTitle', sourceTitle);
        formData.append('similarTemplateIds', similarTemplateIds.join(','));
        formData.append('engineVersion', engineVersion);
        formData.append('file', selectedFile);

        result = await createDraftWithFileUpload(formData);
      } else {
        beginProcessingProgress(
          22,
          '문서를 분석하고 있습니다.',
          '원본 본문을 읽고 템플릿 초안과 추천 항목을 조립하고 있습니다.'
        );
        const response = await fetch('/api/templates/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTitle,
            sourceKind,
            sourceContent,
            similarTemplateIds,
            engineVersion: engineVersion === '24' ? '23' : engineVersion,
          }),
        });
        result = await response.json();
      }

      if (!result.success) {
        throw new Error(result.message || '추출 초안 생성에 실패했습니다.');
      }

      clearDraftProgressTimer();
      setDraftProgress({
        visible: true,
        phase: 'completed',
        percent: 100,
        stage: '초안 생성을 완료했습니다.',
        detail: '원본 문서를 읽어 템플릿 초안과 추천 항목을 만들었습니다.',
      });
      setDraftDetail(result.data);
      setSelectedDraftId(result.data.draft.id);
      syncReviewedFields(toReviewedFields(result.data));
      persistRecentDraft(result.data);
      const versionLabel =
        TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS.find((option) => option.value === engineVersion)?.label || engineVersion;
      setMessage(
        engineVersion === '24' && result.message
          ? `v24 후보 비교 완료. ${result.message}`
          : `원본 문서를 읽어 템플릿 초안과 추천 항목을 만들었습니다. (${versionLabel})`
      );
    } catch (error) {
      clearDraftProgressTimer();
      setDraftProgress((previous) => ({
        visible: true,
        phase: 'failed',
        percent: Math.max(previous.percent, 18),
        stage: '초안 생성이 중단되었습니다.',
        detail: error instanceof Error ? error.message : '추출 초안 생성에 실패했습니다.',
      }));
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

  const handleCopyDraftLog = async () => {
    const normalizedDraftId = draftDetail?.draft.id?.trim() || '';

    if (!normalizedDraftId || !draftDetail) {
      setMessage('로그를 저장할 초안이 없습니다.');
      return;
    }

    setDraftLogWriting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/extract/${normalizedDraftId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTitle: draftDetail.draft.sourceTitle,
          sourceKind: draftDetail.draft.sourceKind,
          sourceContent: draftDetail.draft.sourceContent,
          generatedDraftHtml: draftDetail.draft.generatedDraftHtml,
          engineVersion: pipelineTrace?.engineVersion || engineVersion,
          pipelineTrace,
          qualityReport,
          visualSimilarityReport,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '로그 저장에 실패했습니다.');
      }

      const filePath = String(result.data?.filePath || '').trim();

      if (filePath) {
        try {
          await navigator.clipboard.writeText(filePath);
          setMessage(`로그 파일을 저장했고 경로를 클립보드에 복사했습니다. ${filePath}`);
        } catch {
          setMessage(`로그 파일을 저장했습니다. ${filePath}`);
        }
        return;
      }

      setMessage('로그 파일을 저장했습니다.');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '로그 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setDraftLogWriting(false);
    }
  };

  const requestVisualSimilarityPdfPages = React.useCallback(
    (file: File) =>
      new Promise<string[]>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        if (visualMeasurementLogFileNameRef.current.trim()) {
          formData.append('measurementLogFileName', visualMeasurementLogFileNameRef.current.trim());
        }

        xhr.open('POST', '/api/templates/extract/measure');
        xhr.responseType = 'text';

        xhr.upload.onloadstart = () => {
          updateVisualSimilarityProgress({
            visible: true,
            phase: 'uploading',
            activeStep: 'uploading',
            percent: 4,
            stage: '원본 PDF를 측정 서버로 업로드하고 있습니다.',
            detail: '시각 유사도 측정을 위해 브라우저에서 PDF를 전송합니다.',
          });
          void appendVisualMeasurementLog({
            phase: 'uploading',
            percent: 4,
            stage: '원본 PDF 업로드를 시작했습니다.',
            detail: file.name,
            payload: {
              fileName: file.name,
              fileType: file.type || 'application/pdf',
              fileSize: file.size,
            },
          });
        };

        xhr.upload.onprogress = (event) => {
          const uploadRatio = event.lengthComputable && event.total > 0 ? event.loaded / event.total : 0.6;
          const uploadPercent = Math.max(4, Math.min(Math.round(uploadRatio * 18), 18));
          const detail = event.lengthComputable
            ? `업로드 ${Math.round(uploadRatio * 100)}%`
            : '브라우저에서 서버로 측정용 PDF를 전송하고 있습니다.';

          updateVisualSimilarityProgress({
            visible: true,
            phase: 'uploading',
            activeStep: 'uploading',
            percent: uploadPercent,
            stage: '원본 PDF를 측정 서버로 업로드하고 있습니다.',
            detail,
          });
          void appendVisualMeasurementLog({
            phase: 'uploading',
            percent: uploadPercent,
            stage: '원본 PDF를 측정 서버로 업로드하고 있습니다.',
            detail,
          });
        };

        xhr.upload.onloadend = () => {
          beginVisualSimilarityServerProgress(
            22,
            '서버에서 PDF 페이지 PNG를 만들고 있습니다.',
            '원본 PDF를 페이지 단위 이미지로 렌더한 뒤 브라우저 비교 단계로 넘깁니다.'
          );
          void appendVisualMeasurementLog({
            phase: 'rendering_pdf',
            percent: 22,
            stage: '서버 PDF 렌더 대기',
            detail: '업로드가 끝나 서버에서 페이지 PNG 생성을 시작합니다.',
          });
        };

        xhr.onerror = () => {
          reject(new Error('시각 유사도 측정 요청을 서버로 보내지 못했습니다.'));
        };

        xhr.onload = () => {
          clearVisualSimilarityProgressTimer();

          try {
            const parsed = JSON.parse(xhr.responseText || '{}') as {
              success?: boolean;
              data?: {
                pageImages?: string[];
              };
              message?: string;
            };

            if (!(xhr.status >= 200 && xhr.status < 300 && parsed.success)) {
              reject(new Error(parsed.message || 'PDF 렌더 이미지를 생성하지 못했습니다.'));
              return;
            }

            const nextPageImages = parsed.data?.pageImages;
            const pageImages = Array.isArray(nextPageImages) ? nextPageImages : [];

            if (pageImages.length === 0) {
              reject(new Error('PDF 페이지 이미지를 생성하지 못했습니다.'));
              return;
            }

            updateVisualSimilarityProgress({
              visible: true,
              phase: 'preparing_pdf_pages',
              activeStep: 'preparing_pdf_pages',
              percent: 42,
              stage: 'PDF 페이지 PNG를 브라우저 비교 입력으로 넘겼습니다.',
              detail: `원본 PDF 페이지 ${pageImages.length}개를 브라우저 canvas 비교 단계로 넘깁니다.`,
            });
            void appendVisualMeasurementLog({
              phase: 'preparing_pdf_pages',
              percent: 42,
              stage: 'PDF 페이지 PNG를 브라우저 비교 입력으로 넘겼습니다.',
              detail: `원본 PDF 페이지 ${pageImages.length}개를 브라우저 canvas 비교 단계로 넘깁니다.`,
              payload: {
                pageCount: pageImages.length,
              },
            });
            resolve(pageImages);
          } catch {
            reject(new Error('시각 유사도 측정 응답을 해석하지 못했습니다.'));
          }
        };

        xhr.send(formData);
      }),
    [
      appendVisualMeasurementLog,
      beginVisualSimilarityServerProgress,
      clearVisualSimilarityProgressTimer,
      updateVisualSimilarityProgress
    ]
  );

  const handleMeasureVisualSimilarity = React.useCallback(async () => {
    const iframe = visualMeasurementFrameRef.current;

    if (!selectedFile) {
      setMessage('시각 유사도를 측정하려면 원본 PDF 파일이 필요합니다.');
      return;
    }

    if (!draftDetail || draftDetail.draft.sourceKind !== 'html') {
      setMessage('시각 유사도를 측정할 HTML 초안이 없습니다.');
      return;
    }

    if (!/\.pdf$/i.test(selectedFile.name) && selectedFile.type !== 'application/pdf') {
      setMessage('시각 유사도 측정은 PDF 업로드에 대해서만 지원합니다.');
      return;
    }

    if (!iframe) {
      setMessage('시각 유사도 측정용 브라우저 프레임을 초기화하지 못했습니다.');
      return;
    }

    const sourceHtml = draftDetail.draft.sourceContent.trim();
    const measurementKey = [
      draftDetail.draft.id,
      selectedFile.name,
      selectedFile.size,
      selectedFile.lastModified,
    ].join('::');

    if (!sourceHtml) {
      setMessage('시각 유사도를 측정할 output HTML이 없습니다.');
      return;
    }

    setVisualSimilarityMeasuring(true);
    setVisualSimilarityReport(null);
    setMessage(null);
    clearVisualSimilarityProgressTimer();
    setVisualSimilarityProgress({
      visible: true,
      phase: 'uploading',
      activeStep: 'uploading',
      percent: 2,
      stage: '시각 유사도 측정을 준비하고 있습니다.',
      detail: '원본 PDF와 output HTML을 같은 기준으로 비교하기 위한 입력을 준비합니다.',
    });
    lastVisualMeasurementKeyRef.current = measurementKey;

    try {
      await startVisualMeasurementLog({
        draftId: draftDetail.draft.id,
        sourceTitle: draftDetail.draft.sourceTitle || null,
        sourceFileName: selectedFile.name,
        engineVersion: pipelineTrace?.engineVersion || engineVersion,
      });
      await appendVisualMeasurementLog({
        phase: 'prepare',
        percent: 2,
        stage: '시각 유사도 측정 준비',
        detail: '원본 PDF와 output HTML 비교 세션을 시작했습니다.',
        payload: {
          draftId: draftDetail.draft.id,
          sourceTitle: draftDetail.draft.sourceTitle || null,
          sourceFileName: selectedFile.name,
        },
        force: true,
      });

      const pdfPageDataUrls = await requestVisualSimilarityPdfPages(selectedFile);

      const report = await TemplateExtractVisualSimilarityClient.measure({
        html: sourceHtml,
        pdfPageDataUrls,
        iframe,
        onProgress: (progress) => {
          updateVisualSimilarityProgress({
            visible: true,
            phase: progress.phase,
            activeStep: progress.phase,
            percent: progress.percent,
            stage: progress.stage,
            detail: progress.detail,
          });
          void appendVisualMeasurementLog({
            phase: progress.phase,
            percent: progress.percent,
            stage: progress.stage,
            detail: progress.detail,
          });
        },
      });

      clearVisualSimilarityProgressTimer();
      setVisualSimilarityProgress({
        visible: true,
        phase: 'completed',
        activeStep: 'aggregating',
        percent: 100,
        stage: '시각 유사도 측정을 완료했습니다.',
        detail: `PDF와 HTML의 1px 허용 오차 기준 중첩률 ${formatPercent(report.overallScore)} 를 계산했습니다.`,
      });
      setVisualSimilarityReport(report);
      await postVisualMeasurementLog({
        action: 'finalize',
        status: 'completed',
        summary: `1px 허용 오차 기준 중첩률 ${formatPercent(report.overallScore)}`,
        visualSimilarityReport: report,
      });
      setMessage(`시각 유사도를 측정했습니다. 1px 허용 오차 기준 ${formatPercent(report.overallScore)}`);
    } catch (error) {
      setVisualSimilarityReport(null);
      clearVisualSimilarityProgressTimer();
      const nextMessage = error instanceof Error ? error.message : '시각 유사도 측정에 실패했습니다.';
      setVisualSimilarityProgress((previous) => ({
        visible: true,
        phase: 'failed',
        activeStep: previous.activeStep || 'uploading',
        percent: Math.max(previous.percent, 12),
        stage: '시각 유사도 측정이 중단되었습니다.',
        detail: nextMessage,
      }));
      await appendVisualMeasurementLog({
        level: 'error',
        phase: 'failed',
        percent: null,
        stage: '시각 유사도 측정 실패',
        detail: nextMessage,
        force: true,
      });
      await postVisualMeasurementLog({
        action: 'finalize',
        status: 'failed',
        errorMessage: nextMessage,
        summary: '시각 유사도 측정이 실패했습니다.',
      });
      setMessage(nextMessage);
    } finally {
      setVisualSimilarityMeasuring(false);
    }
  }, [
    appendVisualMeasurementLog,
    clearVisualSimilarityProgressTimer,
    draftDetail,
    engineVersion,
    postVisualMeasurementLog,
    requestVisualSimilarityPdfPages,
    selectedFile,
    updateVisualSimilarityProgress,
    startVisualMeasurementLog,
  ]);

  React.useEffect(() => {
    if (
      !selectedFile ||
      !draftDetail ||
      draftDetail.draft.sourceKind !== 'html' ||
      (!/\.pdf$/i.test(selectedFile.name) && selectedFile.type !== 'application/pdf')
    ) {
      setVisualSimilarityReport(null);
      clearVisualSimilarityProgressTimer();
      visualMeasurementLogFileNameRef.current = '';
      lastVisualMeasurementLogEventKeyRef.current = '';
      setVisualSimilarityProgress({
        visible: false,
        phase: 'idle',
        activeStep: null,
        percent: 0,
        stage: '',
        detail: '',
      });
      lastVisualMeasurementKeyRef.current = '';
      return;
    }

    const measurementKey = [
      draftDetail.draft.id,
      selectedFile.name,
      selectedFile.size,
      selectedFile.lastModified,
    ].join('::');

    if (lastVisualMeasurementKeyRef.current === measurementKey || visualSimilarityMeasuring) {
      return;
    }

    void handleMeasureVisualSimilarity();
  }, [
    clearVisualSimilarityProgressTimer,
    draftDetail,
    handleMeasureVisualSimilarity,
    selectedFile,
    visualSimilarityMeasuring,
  ]);

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
  const pipelineTrace = draftDetail?.pipelineTrace || null;
  const qualityReport = draftDetail?.qualityReport || null;
  const offlineMetrics = qualityReport?.offlineMetrics || null;

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
            disabled={loading}
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

      {draftProgress.visible ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">{draftProgress.stage}</p>
                <p className="text-xs text-slate-600">{draftProgress.detail}</p>
              </div>
              <Badge
                variant={
                  draftProgress.phase === 'completed'
                    ? 'green'
                    : draftProgress.phase === 'failed'
                      ? 'slate'
                      : 'slate'
                }
              >
                {draftProgress.percent}%
              </Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={draftProgress.percent}
                className={`h-full rounded-full transition-[width] duration-300 ${
                  draftProgress.phase === 'failed' ? 'bg-slate-500' : 'bg-slate-900'
                }`}
                style={{ width: `${draftProgress.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>파일 업로드</span>
              <span>문서 분석</span>
              <span>초안 조립</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {visualSimilarityProgress.visible ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  시각 유사도 측정 진행 {getVisualSimilarityCurrentStep(visualSimilarityProgress)}/
                  {VISUAL_SIMILARITY_PROGRESS_STEPS.length}
                </p>
                <p className="text-xs text-slate-600">{visualSimilarityProgress.stage}</p>
                <p className="text-xs text-slate-500">{visualSimilarityProgress.detail}</p>
              </div>
              <Badge
                variant={
                  visualSimilarityProgress.phase === 'completed'
                    ? 'green'
                    : visualSimilarityProgress.phase === 'failed'
                      ? 'red'
                      : 'amber'
                }
              >
                {visualSimilarityProgress.phase === 'completed'
                  ? '완료'
                  : visualSimilarityProgress.phase === 'failed'
                    ? '오류'
                    : `${visualSimilarityProgress.percent}%`}
              </Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={visualSimilarityProgress.percent}
                className={`h-full rounded-full transition-[width] duration-300 ${
                  visualSimilarityProgress.phase === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${visualSimilarityProgress.percent}%` }}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {VISUAL_SIMILARITY_PROGRESS_STEPS.map((step) => {
                const stepState = getVisualSimilarityStepState(visualSimilarityProgress, step.key);

                return (
                  <div key={step.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-900">{step.label}</p>
                      <Badge
                        variant={
                          stepState === 'done'
                            ? 'green'
                            : stepState === 'active'
                              ? 'amber'
                              : stepState === 'failed'
                                ? 'red'
                                : 'slate'
                        }
                      >
                        {stepState === 'done'
                          ? '완료'
                          : stepState === 'active'
                            ? '진행 중'
                            : stepState === 'failed'
                              ? '오류'
                              : '대기'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-600">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
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
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>초안 요약</CardTitle>
                <CardDescription>방금 만든 초안과 현재 검토 상태입니다.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleMeasureVisualSimilarity}
                  disabled={!draftDetail || !selectedFile || visualSimilarityMeasuring}
                >
                  {visualSimilarityMeasuring
                    ? `시각 유사도 측정 중 ${visualSimilarityProgress.percent}%`
                    : '시각 유사도 측정'}
                </Button>
                <Button variant="outline" onClick={handleCopyDraftLog} disabled={!draftDetail || draftLogWriting}>
                  {draftLogWriting ? '로그 저장 중' : '로그 복사'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {draftDetail ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="green">{draftDetail.draft.status}</Badge>
                    {qualityReport ? (
                      <Badge variant="slate">
                        {qualityReport.mode === 'offline' ? 'diagnostic-only' : `${qualityReport.mode}:${qualityReport.passed ? 'pass' : 'review'}`}
                      </Badge>
                    ) : null}
                    {visualSimilarityReport?.measured ? (
                      <Badge variant={visualSimilarityReport.passed ? 'green' : 'slate'}>
                        visual:{formatPercent(visualSimilarityReport.overallScore)}
                      </Badge>
                    ) : null}
                    {visualSimilarityMeasuring || visualSimilarityProgress.visible ? (
                      <Badge
                        variant={
                          visualSimilarityProgress.phase === 'completed'
                            ? 'green'
                            : visualSimilarityProgress.phase === 'failed'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        측정 상태:
                        {visualSimilarityProgress.phase === 'completed'
                          ? ' 완료'
                          : visualSimilarityProgress.phase === 'failed'
                            ? ' 오류'
                            : ` ${visualSimilarityProgress.stage || '진행 중'}`}
                      </Badge>
                    ) : null}
                    {pipelineTrace ? <Badge variant="slate">{pipelineTrace.engineVersion}</Badge> : null}
                    <span className="font-medium text-slate-900">
                      {draftDetail.draft.sourceTitle || '제목 없음'}
                    </span>
                  </div>
                  <p>초안 ID: {draftDetail.draft.id}</p>
                  <p>검토 대상: {reviewedFields.length}개</p>
                  <p>승인 예정: {reviewedSummary.accepted}개</p>
                  <p>추가 검토: {reviewedSummary.reviewNeeded}개</p>
                  <p>제외: {reviewedSummary.rejected}개</p>
                  {pipelineTrace ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-900">Pipeline Trace</p>
                      <p>sourceMode: {pipelineTrace.sourceMode}</p>
                      <p>documentFamily: {pipelineTrace.documentFamily}</p>
                      <p>cloneBuilder: {pipelineTrace.cloneBuilder}</p>
                      <p>familyConfidence: {formatScore(pipelineTrace.familyConfidenceScore)}</p>
                      <p>
                        topology: p{pipelineTrace.topologySummary.pageCount} / rb{pipelineTrace.topologySummary.rowBandCount} / hs
                        {pipelineTrace.topologySummary.horizontalSegmentCount} / vs
                        {pipelineTrace.topologySummary.verticalSegmentCount}
                      </p>
                    </div>
                  ) : null}
                  {visualSimilarityReport ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-900">시각 유사도 측정 결과</p>
                      <p className="text-[11px] text-slate-700">
                        현재 값은 원본 PDF 페이지 PNG와 브라우저가 실제로 렌더한 HTML 캡처를 같은 canvas 크기로
                        정규화한 뒤 계산한 `1px 허용 오차 기준 잉크 픽셀 중첩률`입니다.
                      </p>
                      <p>measurementMode: {visualSimilarityReport.measurementMode}</p>
                      <p>tolerancePx: {visualSimilarityReport.tolerancePx}</p>
                      <p>minimumPassScore: {formatPercent(visualSimilarityReport.minimumPassScore)}</p>
                      <p>overallScore: {formatPercent(visualSimilarityReport.overallScore)}</p>
                      <p>passed: {visualSimilarityReport.passed ? 'true' : 'false'}</p>
                      <p>pageCount: {visualSimilarityReport.pageCount}</p>
                      <p>measuredAt: {visualSimilarityReport.measuredAt}</p>
                      {visualSimilarityReport.pageReports.length > 0 ? (
                        <details className="mt-2 rounded border border-slate-200 bg-white p-2">
                          <summary className="cursor-pointer font-medium text-slate-800">페이지별 결과 보기</summary>
                          <div className="mt-2 space-y-1">
                            {visualSimilarityReport.pageReports.map((pageReport) => (
                              <p key={`visual-page-${pageReport.pageNumber}`}>
                                p{pageReport.pageNumber}: {formatPercent(pageReport.overlapRatio)} / mismatch {formatPercent(pageReport.mismatchRatio)}
                              </p>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                  {qualityReport ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-900">
                        {visualSimilarityReport ? '구조 진단값' : '시각 유사도 측정 상태'}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        {visualSimilarityReport
                          ? '아래 값은 시각 유사도 점수가 아니라, 어디서 틀어졌는지 좁혀 보기 위한 구조 진단값입니다.'
                          : '시각 유사도는 아직 측정되지 않았습니다. 아래 값은 HTML 구조 진단용 보조 지표이며 시각 유사도 점수로 사용하면 안 됩니다.'}
                      </p>
                      {!visualSimilarityReport ? (
                        <p>visualSimilarity: {visualSimilarityMeasuring ? '측정 진행 중' : '미측정'}</p>
                      ) : null}
                      <p>measurementMode: structural-diagnostics-only</p>
                      <p>pageCount: {qualityReport.summary.pageCount}</p>
                      <p>hardFailures: {qualityReport.summary.hardFailureCount}</p>
                      <p>fallbackApplied: {qualityReport.fallbackApplied ? 'true' : 'false'}</p>
                      {qualityReport.fallbackReason ? <p>fallbackReason: {qualityReport.fallbackReason}</p> : null}
                      {offlineMetrics ? (
                        <details className="mt-2 rounded border border-slate-200 bg-white p-2">
                          <summary className="cursor-pointer font-medium text-slate-800">구조 진단값 보기</summary>
                          <div className="mt-2 space-y-1">
                            <p>pageContract: {formatScore(offlineMetrics.pageContractScore)}</p>
                            <p>textAnchor: {formatScore(offlineMetrics.textAnchorScore)}</p>
                            <p>vectorTopology: {formatScore(offlineMetrics.vectorTopologyScore)}</p>
                            <p>textContent: {formatScore(offlineMetrics.textContentScore)}</p>
                            <p>placeholderIntegrity: {formatScore(offlineMetrics.placeholderIntegrityScore)}</p>
                            <p>diagnosticOverall: {formatScore(offlineMetrics.overallScore)}</p>
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
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
      <iframe
        ref={visualMeasurementFrameRef}
        title="visual-similarity-measurement-frame"
        aria-hidden="true"
        tabIndex={-1}
        sandbox="allow-same-origin"
        className="pointer-events-none fixed -left-[200vw] top-0 h-px w-px opacity-0"
      />
    </div>
  );
}
