import { createClient } from '@supabase/supabase-js';
import type { TemplateFieldInput, TemplateFieldType, TemplateLayoutResizeMode } from '../lib/templateDtos';
import type {
  TemplateExtractApproveInput,
  TemplateExtractApproveResult,
  TemplateExtractCandidateDto,
  TemplateExtractConfidenceSummary,
  TemplateExtractCreateInput,
  TemplateExtractDetailResult,
  TemplateExtractDraftDto,
  TemplateExtractResolvedSource,
  TemplateExtractReviewStatus,
  TemplateExtractSourceKind,
} from '../lib/templateExtractDtos';
import { TemplateService } from './templateService';

type ExtractDraftRow = {
  id: string;
  source_title: string | null;
  source_kind: TemplateExtractSourceKind;
  source_content: string;
  generated_draft_html: string;
  status: TemplateExtractDraftDto['status'];
  confidence_summary: TemplateExtractConfidenceSummary;
  similar_template_ids: string[] | null;
  approved_template_id: string | null;
  created_at: string;
  updated_at: string;
};

type ExtractCandidateRow = {
  id: string;
  draft_id: string;
  candidate_key: string;
  field_key: string;
  label_key: string;
  field_type: TemplateFieldType;
  field_label: string;
  detected_value: string | null;
  placeholder: string | null;
  default_value: unknown;
  options: string[] | null;
  required: boolean;
  layout_block_id: string | null;
  confidence_score: number;
  review_status: TemplateExtractReviewStatus;
  extraction_reason: string | null;
  sort_order: number | null;
};

type ExtractPair = {
  labelText: string;
  valueText: string;
  rowHtml?: string;
  valueHtml?: string;
};

type ExtractCandidateSeed = {
  candidateKey: string;
  fieldKey: string;
  labelKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  detectedValue: string;
  placeholder: string | null;
  defaultValue: unknown;
  options: string[];
  required: boolean;
  layoutBlockId: string | null;
  confidenceScore: number;
  reviewStatus: TemplateExtractReviewStatus;
  extractionReason: string;
  sortOrder: number;
};

const EXTRACT_EXCLUDED_LABELS = new Set(
  [
    '순번',
    '번호',
    'no',
    'no.',
    '이미지',
    '직위',
    '담당업무',
    '담당 업무',
    '구성상태',
    '구성 상태',
    '보유역량',
    '보유역량(경력및학력등)',
    '보유 역량',
    '보유 역량 (경력 및 학력 등)',
    '비고',
    '명칭',
    '범주',
    '구분',
  ].map((value) => value.replace(/\s+/g, '').toLowerCase())
);

const EXTRACT_HEADER_LIKE_VALUES = new Set(
  ['입력/상황', '실제 결과', '세부 내용', '세부내용', '기대한 안전장치'].map((value) =>
    value.replace(/\s+/g, '').toLowerCase()
  )
);

const EXTRACT_TEXTAREA_LABEL_RULES = [
  {
    matches: ['아이템 개요'],
    fieldKey: 'item_overview',
    labelKey: 'item_overview',
    fieldLabel: '아이템 개요',
  },
  {
    matches: ['문제 인식', 'problem'],
    fieldKey: 'problem_statement',
    labelKey: 'problem_statement',
    fieldLabel: '문제 인식',
  },
  {
    matches: ['실현 가능성', 'solution'],
    fieldKey: 'solution_feasibility',
    labelKey: 'solution_feasibility',
    fieldLabel: '실현 가능성',
  },
  {
    matches: ['성장전략', '성장 전략', 'scale-up'],
    fieldKey: 'growth_strategy',
    labelKey: 'growth_strategy',
    fieldLabel: '성장전략',
  },
  {
    matches: ['팀 구성', 'team'],
    fieldKey: 'team_composition',
    labelKey: 'team_composition',
    fieldLabel: '팀 구성',
  },
] as const;

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const TEMPLATE_EXTRACT_DB_SCHEMA = 'template_extracts';
const DEFAULT_LAYOUT_MODE: TemplateLayoutResizeMode = 'grow_height';

// TEMPLATE_EXTRACT_SCHEMA_BOUNDARY
// 템플릿 추출 도메인은 template_extracts 스키마만 사용합니다.
// 추출 초안과 후보 필드는 template_extracts.extract_drafts,
// template_extracts.extract_field_candidates 가 정본입니다.
//
// TEMPLATE_EXTRACT_APPROVAL_BOUNDARY
// 승인 단계에서만 TemplateService 계약을 사용해 templates 스키마에 정식 템플릿을 생성합니다.
// template_extracts 는 templates 내부 테이블을 직접 수정하지 않습니다.
//
// SUPABASE_API_SCHEMA_REQUIRED
// server-side service role 로 schema('template_extracts') 를 사용하려면
// PostgREST/Data API 가 template_extracts 스키마를 읽을 수 있어야 합니다.
const extractsSchema = (client = getSupabase()) => client.schema(TEMPLATE_EXTRACT_DB_SCHEMA);

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
};

const toDraftDto = (row: ExtractDraftRow): TemplateExtractDraftDto => ({
  id: row.id,
  sourceTitle: row.source_title,
  sourceKind: row.source_kind,
  sourceContent: row.source_content,
  generatedDraftHtml: row.generated_draft_html,
  status: row.status,
  confidenceSummary: row.confidence_summary,
  similarTemplateIds: row.similar_template_ids || [],
  approvedTemplateId: row.approved_template_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toCandidateDto = (row: ExtractCandidateRow): TemplateExtractCandidateDto => ({
  id: row.id,
  draftId: row.draft_id,
  candidateKey: row.candidate_key,
  fieldKey: row.field_key,
  labelKey: row.label_key,
  fieldType: row.field_type,
  fieldLabel: row.field_label,
  detectedValue: row.detected_value,
  placeholder: row.placeholder,
  defaultValue: row.default_value,
  options: row.options || [],
  required: row.required,
  layoutBlockId: row.layout_block_id,
  confidenceScore: Number(row.confidence_score),
  reviewStatus: row.review_status,
  extractionReason: row.extraction_reason,
  sortOrder: row.sort_order || 0,
});

const buildConfidenceSummary = (
  candidates: Array<{
    confidenceScore: number;
    reviewStatus: TemplateExtractReviewStatus;
  }>
): TemplateExtractConfidenceSummary => ({
  candidateCount: candidates.length,
  acceptedCount: candidates.filter((candidate) => candidate.reviewStatus === 'accepted').length,
  reviewNeededCount: candidates.filter((candidate) => candidate.reviewStatus === 'review_needed').length,
  rejectedCount: candidates.filter((candidate) => candidate.reviewStatus === 'rejected').length,
  averageConfidenceScore: average(candidates.map((candidate) => candidate.confidenceScore)),
});

const inferDateField = (value: string) => {
  return /(\d{4}[-./]\s*\d{1,2}[-./]\s*\d{1,2})/.test(value);
};

const inferBooleanField = (value: string) => /^(예|아니오|Y|N|O|X|true|false)$/i.test(value.trim());

const normalizeExtractLabel = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase();

const isNumericOnlyLabel = (value: string) => /^\d+(?:[.)-]?\d+)*$/.test(value.trim());

const hasLongFreeformValue = (value: string) => value.trim().length >= 80;

const isKnownExtractLabel = (labelText: string) => {
  const normalized = labelText.toLowerCase();

  return (
    [
      '현장명',
      '현장 이름',
      'site',
      '작업일',
      '작성일',
      '일자',
      'date',
      '책임자',
      '담당자',
      '이름',
      '성명',
      '연락처',
      '전화',
      '휴대폰',
      '창업아이템명',
      '아이템명',
      '산출물',
      '기업(예정)명',
      '기업명',
      '회사명',
      '직업',
      ...EXTRACT_TEXTAREA_LABEL_RULES.flatMap((rule) => rule.matches),
      '서명',
      'signature',
      'sign',
    ].some((match) => normalized.includes(match.toLowerCase()))
  );
};

const isHeaderLikePair = (pair: ExtractPair) => {
  const labelText = pair.labelText.trim();
  const valueText = pair.valueText.trim();
  const normalizedLabel = normalizeExtractLabel(labelText);
  const normalizedValue = normalizeExtractLabel(valueText);

  if (!labelText || !valueText) {
    return false;
  }

  if (isKnownExtractLabel(labelText)) {
    return false;
  }

  if (EXTRACT_HEADER_LIKE_VALUES.has(normalizedValue)) {
    return true;
  }

  if (labelText.length <= 20 && valueText.length <= 20) {
    if (!/\d/.test(labelText) && !/\d/.test(valueText)) {
      if (!hasLongFreeformValue(valueText)) {
        return true;
      }
    }
  }

  return false;
};

const isUsefulExtractPair = (pair: ExtractPair) => {
  const labelText = pair.labelText.trim();
  const valueText = pair.valueText.trim();
  const normalizedLabel = normalizeExtractLabel(labelText);

  if (!labelText || !valueText) {
    return false;
  }

  if (labelText.length > 80) {
    return false;
  }

  if (isNumericOnlyLabel(labelText)) {
    return false;
  }

  if (EXTRACT_EXCLUDED_LABELS.has(normalizedLabel)) {
    return false;
  }

  if (normalizeExtractLabel(labelText) === normalizeExtractLabel(valueText)) {
    return false;
  }

  if (isHeaderLikePair(pair)) {
    return false;
  }

  return true;
};

const dedupePairsByLabel = (pairs: ExtractPair[]) => {
  const seen = new Set<string>();

  return pairs.filter((pair) => {
    const key = normalizeExtractLabel(pair.labelText);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const inferKnownField = (labelText: string, index: number) => {
  const normalized = labelText.toLowerCase();

  const knownRules = [
    {
      matches: ['현장명', '현장 이름', 'site'],
      fieldKey: 'site_name',
      labelKey: 'site_name',
      fieldLabel: '현장명',
      fieldType: 'text' as const,
      confidenceScore: 0.96,
    },
    {
      matches: ['작업일', '작성일', '일자', 'date'],
      fieldKey: 'work_date',
      labelKey: 'work_date',
      fieldLabel: '작업일',
      fieldType: 'date' as const,
      confidenceScore: 0.96,
    },
    {
      matches: ['책임자', '담당자', '이름', '성명'],
      fieldKey: 'manager_name',
      labelKey: 'manager_name',
      fieldLabel: '담당자',
      fieldType: 'text' as const,
      confidenceScore: 0.9,
    },
    {
      matches: ['연락처', '전화', '휴대폰'],
      fieldKey: 'contact_phone',
      labelKey: 'contact_phone',
      fieldLabel: '연락처',
      fieldType: 'text' as const,
      confidenceScore: 0.88,
    },
    {
      matches: ['창업아이템명', '아이템명'],
      fieldKey: 'startup_item_name',
      labelKey: 'startup_item_name',
      fieldLabel: '창업아이템명',
      fieldType: 'text' as const,
      confidenceScore: 0.9,
    },
    {
      matches: ['산출물'],
      fieldKey: 'deliverables_summary',
      labelKey: 'deliverables_summary',
      fieldLabel: '산출물',
      fieldType: 'text' as const,
      confidenceScore: 0.88,
    },
    {
      matches: ['기업(예정)명', '기업명', '회사명'],
      fieldKey: 'company_name',
      labelKey: 'company_name',
      fieldLabel: '기업명',
      fieldType: 'text' as const,
      confidenceScore: 0.9,
    },
    {
      matches: ['직업'],
      fieldKey: 'occupation',
      labelKey: 'occupation',
      fieldLabel: '직업',
      fieldType: 'text' as const,
      confidenceScore: 0.86,
    },
    ...EXTRACT_TEXTAREA_LABEL_RULES.map((rule) => ({
      matches: rule.matches,
      fieldKey: rule.fieldKey,
      labelKey: rule.labelKey,
      fieldLabel: rule.fieldLabel,
      fieldType: 'textarea' as const,
      confidenceScore: 0.86,
    })),
    {
      matches: ['서명', 'signature', 'sign'],
      fieldKey: `signature_${index + 1}`,
      labelKey: `signature_${index + 1}`,
      fieldLabel: labelText.trim(),
      fieldType: 'signature' as const,
      confidenceScore: 0.82,
    },
  ];

  return knownRules.find((rule) => rule.matches.some((match) => normalized.includes(match.toLowerCase()))) || null;
};

const inferCandidate = (pair: ExtractPair, index: number): ExtractCandidateSeed => {
  const labelText = pair.labelText.trim();
  const valueText = pair.valueText.trim();
  const normalized = labelText.toLowerCase();
  const knownField = inferKnownField(labelText, index);

  if (knownField) {
    const reviewStatus = knownField.fieldType === 'signature' ? 'review_needed' : 'accepted';

    return {
      candidateKey: `candidate_${index + 1}`,
      fieldKey: knownField.fieldKey,
      labelKey: knownField.labelKey,
      fieldType: knownField.fieldType,
      fieldLabel: knownField.fieldLabel,
      detectedValue: valueText,
      placeholder: null,
      defaultValue: null,
      options: [],
      required: true,
      layoutBlockId: `${knownField.labelKey}_block`,
      confidenceScore: knownField.confidenceScore,
      reviewStatus,
      extractionReason: `known label match: ${labelText}`,
      sortOrder: index + 1,
    };
  }

  const textareaLike = EXTRACT_TEXTAREA_LABEL_RULES.some((rule) =>
    rule.matches.some((match) => normalized.includes(match.toLowerCase()))
  );
  const fieldType: TemplateFieldType = inferDateField(valueText)
    ? 'date'
    : inferBooleanField(valueText)
      ? 'checkbox'
      : textareaLike || hasLongFreeformValue(valueText)
        ? 'textarea'
        : 'text';
  const fallbackKey = `field_${index + 1}`;

  return {
    candidateKey: `candidate_${index + 1}`,
    fieldKey: fallbackKey,
    labelKey: fallbackKey,
    fieldType,
    fieldLabel: labelText || `필드 ${index + 1}`,
    detectedValue: valueText,
    placeholder: null,
    defaultValue: null,
    options: [],
    required: false,
    layoutBlockId: `${fallbackKey}_block`,
    confidenceScore: fieldType === 'date' ? 0.8 : 0.72,
    reviewStatus: 'review_needed',
    extractionReason: `generic pair inference: ${labelText}`,
    sortOrder: index + 1,
  };
};

const extractPairsFromText = (sourceContent: string): ExtractPair[] => {
  const lines = sourceContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const pairs: ExtractPair[] = [];

  for (const line of lines) {
    const matched = line.match(/^([^:：]{1,80})[:：]\s*(.+)$/);

    if (!matched) {
      continue;
    }

    pairs.push({
      labelText: matched[1].trim(),
      valueText: matched[2].trim(),
    });
  }

  return pairs;
};

const extractPairsFromHtml = (sourceHtml: string): { pairs: ExtractPair[]; generatedDraftHtml: string } => {
  const pairs: ExtractPair[] = [];
  let pairIndex = 0;

  const rowPattern =
    /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td([^>]*)>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  const generatedDraftHtml = sourceHtml.replace(
    rowPattern,
    (fullMatch, rawLabelHtml: string, tdAttrs: string, rawValueHtml: string) => {
      const labelText = stripHtml(rawLabelHtml);
      const valueText = stripHtml(rawValueHtml);

      if (!labelText || !valueText) {
        return fullMatch;
      }

      const pair: ExtractPair = {
        labelText,
        valueText,
        rowHtml: fullMatch,
        valueHtml: rawValueHtml,
      };

      if (!isUsefulExtractPair(pair)) {
        return fullMatch;
      }

      const candidate = inferCandidate(pair, pairIndex);
      pairs.push(pair);
      pairIndex += 1;

      return `<tr><th>${rawLabelHtml}</th><td${tdAttrs}><span data-label="${candidate.labelKey}"></span></td></tr>`;
    }
  );

  return { pairs, generatedDraftHtml };
};

const buildFallbackDraftHtml = (sourceTitle: string | null, pairs: ExtractPair[]) => {
  const rows = pairs
    .map((pair, index) => {
      const candidate = inferCandidate(pair, index);

      return `<tr><th>${escapeHtml(pair.labelText)}</th><td><span data-label="${candidate.labelKey}"></span></td></tr>`;
    })
    .join('\n');

  return `<section data-template-extract-draft="true">
  <h1>${escapeHtml(sourceTitle?.trim() || '템플릿 추출 초안')}</h1>
  <table>
${rows}
  </table>
</section>`;
};

const analyzeSource = (
  sourceKind: TemplateExtractSourceKind,
  sourceTitle: string | null,
  sourceContent: string
) => {
  const trimmedContent = sourceContent.trim();
  const htmlMode = sourceKind === 'html';

  let pairs: ExtractPair[] = [];
  let generatedDraftHtml = '';

  if (htmlMode) {
    const htmlAnalysis = extractPairsFromHtml(trimmedContent);
    pairs = htmlAnalysis.pairs;
    generatedDraftHtml = htmlAnalysis.generatedDraftHtml;

    if (pairs.length === 0) {
      pairs = extractPairsFromText(stripHtml(trimmedContent));
      generatedDraftHtml = buildFallbackDraftHtml(sourceTitle, pairs);
    }
  } else {
    pairs = extractPairsFromText(trimmedContent);
    generatedDraftHtml = buildFallbackDraftHtml(sourceTitle, pairs);
  }

  pairs = dedupePairsByLabel(pairs.filter(isUsefulExtractPair));
  const candidates = pairs.map((pair, index) => inferCandidate(pair, index));
  const confidenceSummary = buildConfidenceSummary(candidates);

  if (!generatedDraftHtml) {
    generatedDraftHtml = `<section data-template-extract-draft="true"><pre>${escapeHtml(
      trimmedContent
    )}</pre></section>`;
  }

  return {
    candidates,
    generatedDraftHtml,
    confidenceSummary,
  };
};

const getDraftById = async (draftId: string) => {
  const { data, error } = await extractsSchema().from('extract_drafts').select('*').eq('id', draftId).single();

  return { draft: data as ExtractDraftRow | null, error };
};

const loadCandidatesByDraftId = async (draftId: string) => {
  const { data, error } = await extractsSchema()
    .from('extract_field_candidates')
    .select('*')
    .eq('draft_id', draftId)
    .order('sort_order', { ascending: true });

  return { candidates: (data || []) as ExtractCandidateRow[], error };
};

export const TemplateExtractService = {
  // TEMPLATE_EXTRACT_HEURISTIC_FIRST_STAGE
  // 이번 단계는 HTML 또는 text 본문, 그리고 업로드에서 해석된 source 를 입력받아
  // 규칙 기반으로 draft 와 필드 후보를 생성합니다.
  // PDF/OCR/LLM 문서 이해는 다음 단계에서 이어집니다.
  async createDraft(params: TemplateExtractCreateInput): Promise<TemplateExtractDetailResult> {
    return this.createDraftFromResolvedSource({
      sourceTitle: params.sourceTitle?.trim() || null,
      sourceKind: params.sourceKind,
      sourceContent: params.sourceContent,
      originalFileName: null,
      originalMimeType: null,
    }, params.similarTemplateIds || []);
  },

  async createDraftFromResolvedSource(
    resolvedSource: TemplateExtractResolvedSource,
    similarTemplateIds: string[] = []
  ): Promise<TemplateExtractDetailResult> {
    const sourceTitle = resolvedSource.sourceTitle?.trim() || null;
    const sourceContent = resolvedSource.sourceContent.trim();

    if (!sourceContent) {
      throw new Error('템플릿 추출 실패: sourceContent가 비어 있습니다.');
    }

    if (!['html', 'text'].includes(resolvedSource.sourceKind)) {
      throw new Error('템플릿 추출 실패: sourceKind는 html 또는 text 여야 합니다.');
    }

    const analysis = analyzeSource(resolvedSource.sourceKind, sourceTitle, sourceContent);
    const client = getSupabase();
    const extractsClient = extractsSchema(client);

    const { data: draftData, error: draftError } = await extractsClient
      .from('extract_drafts')
      .insert([
        {
          source_title: sourceTitle,
          source_kind: resolvedSource.sourceKind,
          source_content: sourceContent,
          generated_draft_html: analysis.generatedDraftHtml,
          status: 'draft',
          confidence_summary: analysis.confidenceSummary,
          similar_template_ids: similarTemplateIds,
        },
      ])
      .select('*')
      .single();

    const draft = draftData as ExtractDraftRow | null;

    if (draftError || !draft) {
      throw new Error(`템플릿 추출 실패: ${draftError?.message || '초안을 저장할 수 없습니다.'}`);
    }

    let candidateRows: ExtractCandidateRow[] = [];

    if (analysis.candidates.length > 0) {
      const { data, error } = await extractsClient
        .from('extract_field_candidates')
        .insert(
          analysis.candidates.map((candidate) => ({
            draft_id: draft.id,
            candidate_key: candidate.candidateKey,
            field_key: candidate.fieldKey,
            label_key: candidate.labelKey,
            field_type: candidate.fieldType,
            field_label: candidate.fieldLabel,
            detected_value: candidate.detectedValue,
            placeholder: candidate.placeholder,
            default_value: candidate.defaultValue,
            options: candidate.options,
            required: candidate.required,
            layout_block_id: candidate.layoutBlockId,
            confidence_score: candidate.confidenceScore,
            review_status: candidate.reviewStatus,
            extraction_reason: candidate.extractionReason,
            sort_order: candidate.sortOrder,
          }))
        )
        .select('*');

      if (error) {
        throw new Error(`템플릿 추출 실패: 후보 필드 저장 중 오류가 발생했습니다. (${error.message})`);
      }

      candidateRows = (data || []) as ExtractCandidateRow[];
    }

    const candidates = candidateRows.map(toCandidateDto);

    return {
      draft: toDraftDto(draft),
      candidates,
      reviewSummary: buildConfidenceSummary(candidates),
    };
  },

  async getDraft(draftId: string): Promise<TemplateExtractDetailResult> {
    const normalizedDraftId = draftId.trim();

    if (!normalizedDraftId) {
      throw new Error('템플릿 추출 조회 실패: draftId가 필요합니다.');
    }

    const { draft, error: draftError } = await getDraftById(normalizedDraftId);

    if (draftError || !draft) {
      throw new Error(`템플릿 추출 조회 실패: ${draftError?.message || '초안을 찾을 수 없습니다.'}`);
    }

    const { candidates, error: candidateError } = await loadCandidatesByDraftId(normalizedDraftId);

    if (candidateError) {
      throw new Error(`템플릿 추출 조회 실패: 후보 필드 조회 중 오류가 발생했습니다. (${candidateError.message})`);
    }

    const candidateDtos = candidates.map(toCandidateDto);

    return {
      draft: toDraftDto(draft),
      candidates: candidateDtos,
      reviewSummary: buildConfidenceSummary(candidateDtos),
    };
  },

  async approveDraft(
    draftId: string,
    params: TemplateExtractApproveInput
  ): Promise<TemplateExtractApproveResult> {
    const normalizedDraftId = draftId.trim();
    const templateName = params.templateName.trim();

    if (!normalizedDraftId) {
      throw new Error('템플릿 추출 승인 실패: draftId가 필요합니다.');
    }

    if (!templateName) {
      throw new Error('템플릿 추출 승인 실패: templateName이 필요합니다.');
    }

    const { draft, error: draftError } = await getDraftById(normalizedDraftId);

    if (draftError || !draft) {
      throw new Error(`템플릿 추출 승인 실패: ${draftError?.message || '초안을 찾을 수 없습니다.'}`);
    }

    if (draft.status === 'approved' && draft.approved_template_id) {
      throw new Error('템플릿 추출 승인 실패: 이미 승인된 초안입니다.');
    }

    const { candidates, error: candidateError } = await loadCandidatesByDraftId(normalizedDraftId);

    if (candidateError) {
      throw new Error(`템플릿 추출 승인 실패: 후보 필드 조회 중 오류가 발생했습니다. (${candidateError.message})`);
    }

    const reviewedFields =
      params.reviewedFields && params.reviewedFields.length > 0
        ? params.reviewedFields
        : candidates.map((candidate) => ({
            candidateKey: candidate.candidate_key,
            fieldKey: candidate.field_key,
            labelKey: candidate.label_key,
            fieldType: candidate.field_type,
            fieldLabel: candidate.field_label,
            required: candidate.required,
            placeholder: candidate.placeholder,
            defaultValue: candidate.default_value,
            options: candidate.options,
            layoutBlockId: candidate.layout_block_id,
            sortOrder: candidate.sort_order,
            reviewStatus: candidate.review_status,
          }));

    const acceptedFields: TemplateFieldInput[] = [];
    let skippedFieldCount = 0;

    for (const [index, field] of reviewedFields.entries()) {
      if ((field.reviewStatus || 'accepted') === 'rejected') {
        skippedFieldCount += 1;
        continue;
      }

      if (field.fieldType === 'signature') {
        skippedFieldCount += 1;
        continue;
      }

      acceptedFields.push({
        fieldKey: field.fieldKey.trim(),
        fieldType: field.fieldType,
        fieldLabel: field.fieldLabel.trim(),
        labelKey: field.labelKey.trim(),
        required: field.required ?? false,
        placeholder: field.placeholder?.trim() || null,
        defaultValue: field.defaultValue ?? null,
        options: field.options || [],
        layoutBlockId: field.layoutBlockId?.trim() || null,
        sortOrder: field.sortOrder ?? index,
      });
    }

    const template = await TemplateService.createTemplate({
      templateName,
      sourceDocumentName: draft.source_title,
      sourceDocumentId: null,
      draftHtml: draft.generated_draft_html,
      layoutResizeMode: params.layoutResizeMode || DEFAULT_LAYOUT_MODE,
    });

    await TemplateService.saveTemplateFields(template.id, {
      fields: acceptedFields,
      signatureAreas: [],
    });

    const nextSummary = buildConfidenceSummary(
      reviewedFields.map((field) => ({
        confidenceScore:
          candidates.find((candidate) => candidate.candidate_key === field.candidateKey)?.confidence_score || 0,
        reviewStatus: field.reviewStatus || 'accepted',
      }))
    );

    const { error: updateError } = await extractsSchema()
      .from('extract_drafts')
      .update({
        status: 'approved',
        approved_template_id: template.id,
        confidence_summary: nextSummary,
      })
      .eq('id', normalizedDraftId);

    if (updateError) {
      throw new Error(`템플릿 추출 승인 실패: 초안 상태 업데이트 중 오류가 발생했습니다. (${updateError.message})`);
    }

    return {
      draftId: normalizedDraftId,
      templateId: template.id,
      approvedFieldCount: acceptedFields.length,
      skippedFieldCount,
      status: 'approved',
    };
  },
};
