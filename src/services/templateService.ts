import { createClient } from '@supabase/supabase-js';
import type {
  TemplateCreateInput,
  TemplateDetailResult,
  TemplateFieldDto,
  TemplateFieldInput,
  TemplateFieldsSaveInput,
  TemplateFieldsSaveResult,
  TemplateLabelBindingDto,
  TemplateLabelMapEntry,
  TemplateLayoutResizeMode,
  TemplateRecordDto,
  TemplateSignatureAreaDto,
  TemplateSignatureAreaInput,
  TemplateDeleteResult,
  TemplateUpdateInput,
  TemplateUpdateResult,
} from '../lib/templateDtos';

type TemplateRegistryRow = {
  id: string;
  template_name: string;
  source_document_name: string | null;
  source_document_id: string | null;
  draft_html: string;
  layout_resize_mode: TemplateLayoutResizeMode;
  status: 'draft' | 'active';
  created_at: string;
  updated_at: string;
};

type TemplateFieldRow = {
  id: string;
  template_id: string;
  field_key: string;
  field_type: TemplateFieldDto['fieldType'];
  field_label: string;
  required: boolean;
  placeholder: string | null;
  default_value: unknown;
  options: string[] | null;
  layout_block_id: string | null;
  sort_order: number | null;
};

type TemplateLabelBindingRow = {
  id: string;
  template_id: string;
  field_key: string | null;
  label_key: string;
  binding_scope: TemplateLabelBindingDto['bindingScope'];
};

type TemplateSignatureAreaRow = {
  id: string;
  template_id: string;
  label_key: string;
  signer_role_name: string;
  page_index: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
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

const TEMPLATES_DB_SCHEMA = 'templates';
const LAYOUT_RESIZE_MODES: TemplateLayoutResizeMode[] = ['fixed', 'grow_height', 'grow_width'];
const TEMPLATE_FIELD_TYPES = ['text', 'textarea', 'date', 'number', 'select', 'checkbox', 'signature'] as const;

// TEMPLATES_SCHEMA_BOUNDARY
// 템플릿 등록 도메인 테이블은 public이 아니라 templates 스키마만 사용합니다.
// 템플릿 메타데이터, 필드 스키마, 라벨 바인딩, 서명 영역은
// templates.template_registry, templates.template_field_definitions,
// templates.template_label_bindings, templates.template_signature_areas 가 정본입니다.
//
// SUPABASE_API_SCHEMA_REQUIRED
// server-side service role 로 schema('templates')를 사용하려면 PostgREST/Data API 가
// templates 스키마를 읽을 수 있어야 합니다.
// runtime 에서 Invalid schema: templates 오류가 나오면 pgrst.db_schemas 에 templates 를 추가해야 합니다.
const templatesSchema = (client = getSupabase()) => client.schema(TEMPLATES_DB_SCHEMA);

const toTemplateRecordDto = (row: TemplateRegistryRow): TemplateRecordDto => ({
  id: row.id,
  templateName: row.template_name,
  sourceDocumentName: row.source_document_name,
  sourceDocumentId: row.source_document_id,
  draftHtml: row.draft_html,
  layoutResizeMode: row.layout_resize_mode,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toTemplateFieldDto = (row: TemplateFieldRow): TemplateFieldDto => ({
  id: row.id,
  templateId: row.template_id,
  fieldKey: row.field_key,
  fieldType: row.field_type,
  fieldLabel: row.field_label,
  required: row.required,
  placeholder: row.placeholder,
  defaultValue: row.default_value,
  options: row.options || [],
  layoutBlockId: row.layout_block_id,
  sortOrder: row.sort_order || 0,
});

const toTemplateLabelBindingDto = (row: TemplateLabelBindingRow): TemplateLabelBindingDto => ({
  id: row.id,
  templateId: row.template_id,
  fieldKey: row.field_key,
  labelKey: row.label_key,
  bindingScope: row.binding_scope,
});

const toTemplateSignatureAreaDto = (row: TemplateSignatureAreaRow): TemplateSignatureAreaDto => ({
  id: row.id,
  templateId: row.template_id,
  labelKey: row.label_key,
  signerRoleName: row.signer_role_name,
  pageIndex: row.page_index || 1,
  x: row.x,
  y: row.y,
  width: row.width,
  height: row.height,
  required: row.required,
  sortOrder: row.sort_order || 0,
});

const normalizeLayoutResizeMode = (value: string): TemplateLayoutResizeMode => {
  if (!LAYOUT_RESIZE_MODES.includes(value as TemplateLayoutResizeMode)) {
    throw new Error('템플릿 저장 실패: layoutResizeMode는 fixed, grow_height, grow_width 중 하나여야 합니다.');
  }

  return value as TemplateLayoutResizeMode;
};

const normalizeFields = (fields: TemplateFieldInput[]) => {
  return fields.map((field, index) => {
    const fieldKey = field.fieldKey.trim();
    const fieldLabel = field.fieldLabel.trim();
    const labelKey = field.labelKey.trim();

    if (!fieldKey || !fieldLabel || !labelKey) {
      throw new Error('템플릿 필드 저장 실패: fieldKey, fieldLabel, labelKey는 필수입니다.');
    }

    if (!TEMPLATE_FIELD_TYPES.includes(field.fieldType)) {
      throw new Error(`템플릿 필드 저장 실패: 지원하지 않는 fieldType 입니다. (${field.fieldType})`);
    }

    return {
      fieldKey,
      fieldType: field.fieldType,
      fieldLabel,
      labelKey,
      required: field.required ?? false,
      placeholder: field.placeholder?.trim() || null,
      defaultValue: field.defaultValue ?? null,
      options: field.options?.filter(Boolean) || [],
      layoutBlockId: field.layoutBlockId?.trim() || null,
      sortOrder: field.sortOrder ?? index,
    };
  });
};

const normalizeSignatureAreas = (signatureAreas: TemplateSignatureAreaInput[] = []) => {
  return signatureAreas.map((area, index) => {
    const labelKey = area.labelKey.trim();
    const signerRoleName = area.signerRoleName.trim();

    if (!labelKey || !signerRoleName) {
      throw new Error('서명 영역 저장 실패: labelKey와 signerRoleName은 필수입니다.');
    }

    const numericValues = [area.x, area.y, area.width, area.height];

    if (numericValues.some((value) => typeof value !== 'number' || Number.isNaN(value))) {
      throw new Error('서명 영역 저장 실패: x, y, width, height는 숫자여야 합니다.');
    }

    return {
      labelKey,
      signerRoleName,
      pageIndex: area.pageIndex ?? 1,
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      required: area.required ?? true,
      sortOrder: area.sortOrder ?? index,
    };
  });
};

const buildLabelMap = (
  labelBindings: TemplateLabelBindingDto[],
  signatureAreas: TemplateSignatureAreaDto[]
): TemplateLabelMapEntry[] => {
  const labelMap = new Map<string, TemplateLabelMapEntry>();

  for (const binding of labelBindings) {
    if (!labelMap.has(binding.labelKey)) {
      labelMap.set(binding.labelKey, {
        labelKey: binding.labelKey,
        fieldKeys: [],
        signatureAreaIds: [],
      });
    }

    const entry = labelMap.get(binding.labelKey)!;

    if (binding.fieldKey && !entry.fieldKeys.includes(binding.fieldKey)) {
      entry.fieldKeys.push(binding.fieldKey);
    }
  }

  for (const signatureArea of signatureAreas) {
    if (!labelMap.has(signatureArea.labelKey)) {
      labelMap.set(signatureArea.labelKey, {
        labelKey: signatureArea.labelKey,
        fieldKeys: [],
        signatureAreaIds: [],
      });
    }

    const entry = labelMap.get(signatureArea.labelKey)!;

    if (!entry.signatureAreaIds.includes(signatureArea.id)) {
      entry.signatureAreaIds.push(signatureArea.id);
    }
  }

  return [...labelMap.values()].sort((a, b) => a.labelKey.localeCompare(b.labelKey, 'ko'));
};

const getTemplateById = async (templateId: string) => {
  const { data, error } = await templatesSchema()
    .from('template_registry')
    .select('*')
    .eq('id', templateId)
    .single();

  return { template: data as TemplateRegistryRow | null, error };
};

export const TemplateService = {
  async listTemplates(limit = 12): Promise<TemplateRecordDto[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 12;
    const { data, error } = await templatesSchema()
      .from('template_registry')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(`템플릿 목록 조회 실패: ${error.message}`);
    }

    return ((data || []) as TemplateRegistryRow[]).map(toTemplateRecordDto);
  },

  // TEMPLATE_LAYOUT_DRAFT_INPUT_REQUIRED
  // 자동 초안 생성은 route + templateLayoutDraftService 에서 먼저 처리합니다.
  // createTemplate 는 이미 생성/검토된 draftHtml 을 정본 templates 스키마에 저장하는 책임만 가집니다.
  async createTemplate(params: TemplateCreateInput): Promise<TemplateRecordDto> {
    const templateName = params.templateName.trim();
    const draftHtml = params.draftHtml.trim();

    if (!templateName) {
      throw new Error('템플릿 저장 실패: templateName이 필요합니다.');
    }

    if (!draftHtml) {
      throw new Error('템플릿 저장 실패: draftHtml이 비어 있습니다.');
    }

    const { data, error } = await templatesSchema()
      .from('template_registry')
      .insert([
        {
          template_name: templateName,
          source_document_name: params.sourceDocumentName?.trim() || null,
          source_document_id: params.sourceDocumentId?.trim() || null,
          draft_html: draftHtml,
          layout_resize_mode: normalizeLayoutResizeMode(params.layoutResizeMode),
          status: 'draft',
        },
      ])
      .select('*')
      .single();

    const template = data as TemplateRegistryRow | null;

    if (error || !template) {
      throw new Error(`템플릿 저장 실패: ${error?.message || '템플릿을 저장할 수 없습니다.'}`);
    }

    return toTemplateRecordDto(template);
  },

  async getTemplate(templateId: string): Promise<TemplateDetailResult> {
    const normalizedTemplateId = templateId.trim();

    if (!normalizedTemplateId) {
      throw new Error('템플릿 조회 실패: templateId가 필요합니다.');
    }

    const client = getSupabase();
    const templatesClient = templatesSchema(client);
    const { template, error: templateError } = await getTemplateById(normalizedTemplateId);

    if (templateError || !template) {
      throw new Error(`템플릿 조회 실패: ${templateError?.message || '템플릿을 찾을 수 없습니다.'}`);
    }

    const [fieldResponse, bindingResponse, signatureResponse] = await Promise.all([
      templatesClient
        .from('template_field_definitions')
        .select('*')
        .eq('template_id', normalizedTemplateId)
        .order('sort_order', { ascending: true }),
      templatesClient
        .from('template_label_bindings')
        .select('*')
        .eq('template_id', normalizedTemplateId)
        .order('label_key', { ascending: true }),
      templatesClient
        .from('template_signature_areas')
        .select('*')
        .eq('template_id', normalizedTemplateId)
        .order('sort_order', { ascending: true }),
    ]);

    if (fieldResponse.error) {
      throw new Error(`템플릿 조회 실패: 필드 조회 중 오류가 발생했습니다. (${fieldResponse.error.message})`);
    }

    if (bindingResponse.error) {
      throw new Error(`템플릿 조회 실패: 라벨 바인딩 조회 중 오류가 발생했습니다. (${bindingResponse.error.message})`);
    }

    if (signatureResponse.error) {
      throw new Error(`템플릿 조회 실패: 서명 영역 조회 중 오류가 발생했습니다. (${signatureResponse.error.message})`);
    }

    const fields = ((fieldResponse.data || []) as TemplateFieldRow[]).map(toTemplateFieldDto);
    const labelBindings = ((bindingResponse.data || []) as TemplateLabelBindingRow[]).map(
      toTemplateLabelBindingDto
    );
    const signatureAreas = ((signatureResponse.data || []) as TemplateSignatureAreaRow[]).map(
      toTemplateSignatureAreaDto
    );

    return {
      template: toTemplateRecordDto(template),
      fields,
      labelBindings,
      signatureAreas,
      labelMap: buildLabelMap(labelBindings, signatureAreas),
    };
  },

  async updateTemplate(templateId: string, params: TemplateUpdateInput): Promise<TemplateUpdateResult> {
    const normalizedTemplateId = templateId.trim();

    if (!normalizedTemplateId) {
      throw new Error('템플릿 수정 실패: templateId가 필요합니다.');
    }

    const { template, error: templateError } = await getTemplateById(normalizedTemplateId);

    if (templateError || !template) {
      throw new Error(`템플릿 수정 실패: ${templateError?.message || '템플릿을 찾을 수 없습니다.'}`);
    }

    const nextTemplateName =
      params.templateName !== undefined ? params.templateName.trim() : template.template_name;
    const nextSourceDocumentName =
      params.sourceDocumentName !== undefined
        ? params.sourceDocumentName?.trim() || null
        : template.source_document_name;
    const nextDraftHtml =
      params.draftHtml !== undefined ? params.draftHtml.trim() : template.draft_html;
    const nextLayoutResizeMode =
      params.layoutResizeMode !== undefined
        ? normalizeLayoutResizeMode(params.layoutResizeMode)
        : template.layout_resize_mode;

    if (!nextTemplateName) {
      throw new Error('템플릿 수정 실패: templateName이 비어 있습니다.');
    }

    if (!nextDraftHtml) {
      throw new Error('템플릿 수정 실패: draftHtml이 비어 있습니다.');
    }

    const { data, error } = await templatesSchema()
      .from('template_registry')
      .update({
        template_name: nextTemplateName,
        source_document_name: nextSourceDocumentName,
        draft_html: nextDraftHtml,
        layout_resize_mode: nextLayoutResizeMode,
      })
      .eq('id', normalizedTemplateId)
      .select('*')
      .single();

    const updatedTemplate = data as TemplateRegistryRow | null;

    if (error || !updatedTemplate) {
      throw new Error(`템플릿 수정 실패: ${error?.message || '템플릿을 수정할 수 없습니다.'}`);
    }

    return {
      template: toTemplateRecordDto(updatedTemplate),
    };
  },

  async deleteTemplate(templateId: string): Promise<TemplateDeleteResult> {
    const normalizedTemplateId = templateId.trim();

    if (!normalizedTemplateId) {
      throw new Error('템플릿 삭제 실패: templateId가 필요합니다.');
    }

    const client = getSupabase();
    const templatesClient = templatesSchema(client);

    const { error: deleteBindingError } = await templatesClient
      .from('template_label_bindings')
      .delete()
      .eq('template_id', normalizedTemplateId);

    if (deleteBindingError) {
      throw new Error(`템플릿 삭제 실패: 라벨 바인딩 삭제 중 오류가 발생했습니다. (${deleteBindingError.message})`);
    }

    const { error: deleteFieldError } = await templatesClient
      .from('template_field_definitions')
      .delete()
      .eq('template_id', normalizedTemplateId);

    if (deleteFieldError) {
      throw new Error(`템플릿 삭제 실패: 필드 삭제 중 오류가 발생했습니다. (${deleteFieldError.message})`);
    }

    const { error: deleteSignatureError } = await templatesClient
      .from('template_signature_areas')
      .delete()
      .eq('template_id', normalizedTemplateId);

    if (deleteSignatureError) {
      throw new Error(`템플릿 삭제 실패: 서명 영역 삭제 중 오류가 발생했습니다. (${deleteSignatureError.message})`);
    }

    const { data: deletedTemplates, error: deleteTemplateError } = await templatesClient
      .from('template_registry')
      .delete()
      .eq('id', normalizedTemplateId)
      .select('id');

    if (deleteTemplateError) {
      throw new Error(`템플릿 삭제 실패: 템플릿 삭제 중 오류가 발생했습니다. (${deleteTemplateError.message})`);
    }

    if (!deletedTemplates || deletedTemplates.length === 0) {
      throw new Error('템플릿 삭제 실패: 템플릿을 찾을 수 없습니다.');
    }

    return {
      templateId: normalizedTemplateId,
    };
  },

  async saveTemplateFields(
    templateId: string,
    params: TemplateFieldsSaveInput
  ): Promise<TemplateFieldsSaveResult> {
    const normalizedTemplateId = templateId.trim();

    if (!normalizedTemplateId) {
      throw new Error('템플릿 필드 저장 실패: templateId가 필요합니다.');
    }

    const { template, error: templateError } = await getTemplateById(normalizedTemplateId);

    if (templateError || !template) {
      throw new Error(`템플릿 필드 저장 실패: ${templateError?.message || '템플릿을 찾을 수 없습니다.'}`);
    }

    const normalizedFields = normalizeFields(params.fields);
    const normalizedSignatureAreas = normalizeSignatureAreas(params.signatureAreas || []);
    const client = getSupabase();
    const templatesClient = templatesSchema(client);

    const { error: deleteBindingError } = await templatesClient
      .from('template_label_bindings')
      .delete()
      .eq('template_id', normalizedTemplateId);

    if (deleteBindingError) {
      throw new Error(`템플릿 필드 저장 실패: 기존 라벨 바인딩 삭제 중 오류가 발생했습니다. (${deleteBindingError.message})`);
    }

    const { error: deleteFieldError } = await templatesClient
      .from('template_field_definitions')
      .delete()
      .eq('template_id', normalizedTemplateId);

    if (deleteFieldError) {
      throw new Error(`템플릿 필드 저장 실패: 기존 필드 삭제 중 오류가 발생했습니다. (${deleteFieldError.message})`);
    }

    const { error: deleteSignatureError } = await templatesClient
      .from('template_signature_areas')
      .delete()
      .eq('template_id', normalizedTemplateId);

    if (deleteSignatureError) {
      throw new Error(
        `템플릿 필드 저장 실패: 기존 서명 영역 삭제 중 오류가 발생했습니다. (${deleteSignatureError.message})`
      );
    }

    let savedFields: TemplateFieldRow[] = [];
    let savedSignatureAreas: TemplateSignatureAreaRow[] = [];

    if (normalizedFields.length > 0) {
      const { data, error } = await templatesClient
        .from('template_field_definitions')
        .insert(
          normalizedFields.map((field) => ({
            template_id: normalizedTemplateId,
            field_key: field.fieldKey,
            field_type: field.fieldType,
            field_label: field.fieldLabel,
            required: field.required,
            placeholder: field.placeholder,
            default_value: field.defaultValue,
            options: field.options,
            layout_block_id: field.layoutBlockId,
            sort_order: field.sortOrder,
          }))
        )
        .select('*');

      if (error) {
        throw new Error(`템플릿 필드 저장 실패: 필드 저장 중 오류가 발생했습니다. (${error.message})`);
      }

      savedFields = (data || []) as TemplateFieldRow[];
    }

    if (normalizedSignatureAreas.length > 0) {
      const { data, error } = await templatesClient
        .from('template_signature_areas')
        .insert(
          normalizedSignatureAreas.map((area) => ({
            template_id: normalizedTemplateId,
            label_key: area.labelKey,
            signer_role_name: area.signerRoleName,
            page_index: area.pageIndex,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            required: area.required,
            sort_order: area.sortOrder,
          }))
        )
        .select('*');

      if (error) {
        throw new Error(`서명 영역 저장 실패: ${error.message}`);
      }

      savedSignatureAreas = (data || []) as TemplateSignatureAreaRow[];
    }

    const labelBindingsPayload = [
      ...savedFields.map((fieldRow) => {
        const fieldInput = normalizedFields.find((field) => field.fieldKey === fieldRow.field_key)!;

        return {
          template_id: normalizedTemplateId,
          field_key: fieldRow.field_key,
          label_key: fieldInput.labelKey,
          binding_scope: 'field' as const,
        };
      }),
      ...savedSignatureAreas.map((signatureRow) => ({
        template_id: normalizedTemplateId,
        field_key: null,
        label_key: signatureRow.label_key,
        binding_scope: 'signature' as const,
      })),
    ];

    let labelBindingCount = 0;

    if (labelBindingsPayload.length > 0) {
      const { data, error } = await templatesClient
        .from('template_label_bindings')
        .insert(labelBindingsPayload)
        .select('id');

      if (error) {
        throw new Error(`라벨 바인딩 저장 실패: ${error.message}`);
      }

      labelBindingCount = (data || []).length;
    }

    return {
      templateId: normalizedTemplateId,
      savedFieldCount: savedFields.length,
      savedSignatureAreaCount: savedSignatureAreas.length,
      labelBindingCount,
    };
  },
};
