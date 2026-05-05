import { createClient } from '@supabase/supabase-js';
import type { TemplateFieldInput, TemplateFieldType, TemplateLayoutResizeMode } from '../lib/templateDtos';
import type {
  TemplateExtractApproveInput,
  TemplateExtractApproveResult,
  TemplateExtractCandidateSeed,
  TemplateExtractCandidateDto,
  TemplateExtractConfidenceSummary,
  TemplateExtractCreateInput,
  TemplateExtractDetailResult,
  TemplateExtractDraftDto,
  TemplateExtractPair,
  TemplateExtractResolvedSource,
  TemplateExtractReviewStatus,
  TemplateExtractSourceKind,
} from '../lib/templateExtractDtos';
import { TemplateService } from './templateService';
import { TemplateExtractCloneService } from './templateExtractCloneService';
import { TemplateExtractReplicaHtmlNormalizerService } from './templateExtractReplicaHtmlNormalizerService';
import { TemplateExtractValueBindingService } from './templateExtractValueBindingService';

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
const EXTRACT_POSITION_ATTR_NAMES = [
  'data-template-frame-position-mode',
  'data-template-frame-relative-anchor-kind',
  'data-template-frame-relative-anchor-id',
  'data-template-frame-relative-anchor-x',
  'data-template-frame-relative-anchor-y',
  'data-template-frame-relative-offset-x',
  'data-template-frame-relative-offset-y',
  'data-template-frame-position-group-id',
  'data-template-frame-position-group-label',
  'data-template-frame-position-group-anchor-id',
  'data-template-frame-position-group-managed',
  'data-template-position-group-aliases',
];

const stripExtractRelativePositionAttrs = (content: string) => {
  let nextContent = String(content || '');

  EXTRACT_POSITION_ATTR_NAMES.forEach((attrName) => {
    const escapedAttrName = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    nextContent = nextContent.replace(
      new RegExp(`\\s${escapedAttrName}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'),
      ''
    );
  });

  return nextContent;
};

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

const toDraftDto = (row: ExtractDraftRow): TemplateExtractDraftDto => ({
  id: row.id,
  sourceTitle: row.source_title,
  sourceKind: row.source_kind,
  sourceContent:
    row.source_kind === 'html' ? stripExtractRelativePositionAttrs(row.source_content) : row.source_content,
  generatedDraftHtml:
    row.source_kind === 'html'
      ? stripExtractRelativePositionAttrs(row.generated_draft_html)
      : row.generated_draft_html,
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
    const sourceContent =
      resolvedSource.sourceKind === 'html'
        ? stripExtractRelativePositionAttrs(resolvedSource.sourceContent.trim())
        : resolvedSource.sourceContent.trim();

    if (!sourceContent) {
      throw new Error('템플릿 추출 실패: sourceContent가 비어 있습니다.');
    }

    if (!['html', 'text'].includes(resolvedSource.sourceKind)) {
      throw new Error('템플릿 추출 실패: sourceKind는 html 또는 text 여야 합니다.');
    }

    const analysis = TemplateExtractCloneService.analyzeSource(
      resolvedSource.sourceKind,
      sourceTitle,
      sourceContent
    );
    const generatedDraftHtml =
      resolvedSource.sourceKind === 'html'
        ? stripExtractRelativePositionAttrs(analysis.generatedDraftHtml)
        : analysis.generatedDraftHtml;
    const pipelineTrace =
      resolvedSource.pipelineTrace ||
      (resolvedSource.sourceKind === 'html'
        ? TemplateExtractReplicaHtmlNormalizerService.parsePipelineTraceFromHtml(sourceContent)
        : null);
    const qualityReport =
      resolvedSource.qualityReport ||
      (resolvedSource.sourceKind === 'html'
        ? TemplateExtractReplicaHtmlNormalizerService.parseQualityReportFromHtml(sourceContent)
        : null);
    const client = getSupabase();
    const extractsClient = extractsSchema(client);

    const { data: draftData, error: draftError } = await extractsClient
      .from('extract_drafts')
      .insert([
        {
          source_title: sourceTitle,
          source_kind: resolvedSource.sourceKind,
          source_content: sourceContent,
          generated_draft_html: generatedDraftHtml,
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
      reviewSummary: TemplateExtractValueBindingService.buildConfidenceSummary(candidates),
      pipelineTrace,
      qualityReport,
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
    const pipelineTrace =
      draft.source_kind === 'html'
        ? TemplateExtractReplicaHtmlNormalizerService.parsePipelineTraceFromHtml(draft.source_content)
        : null;
    const qualityReport =
      draft.source_kind === 'html'
        ? TemplateExtractReplicaHtmlNormalizerService.parseQualityReportFromHtml(draft.source_content)
        : null;

    return {
      draft: toDraftDto(draft),
      candidates: candidateDtos,
      reviewSummary: TemplateExtractValueBindingService.buildConfidenceSummary(candidateDtos),
      pipelineTrace,
      qualityReport,
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

    const approvedDraftHtml = stripExtractRelativePositionAttrs(
      typeof params.generatedDraftHtml === 'string' && params.generatedDraftHtml.trim()
        ? params.generatedDraftHtml.trim()
        : draft.generated_draft_html
    );

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
      draftHtml: approvedDraftHtml,
      layoutResizeMode: params.layoutResizeMode || DEFAULT_LAYOUT_MODE,
    });

    await TemplateService.saveTemplateFields(template.id, {
      fields: acceptedFields,
      signatureAreas: [],
    });

    const nextSummary = TemplateExtractValueBindingService.buildConfidenceSummary(
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
        generated_draft_html: approvedDraftHtml,
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
