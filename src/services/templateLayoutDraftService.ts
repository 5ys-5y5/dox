import type {
  TemplateFieldInput,
  TemplateFieldType,
  TemplateLayoutDraftInput,
  TemplateLayoutDraftResult,
  TemplateSignatureAreaInput,
} from '../lib/templateDtos';
import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';

type ExtractedFieldSeed = {
  fieldKey: string;
  fieldType: TemplateFieldType;
  fieldLabel: string;
  labelKey: string;
  required: boolean;
  placeholder: string | null;
  layoutBlockId: string | null;
  sortOrder: number;
};

type ExtractedSignatureSeed = {
  labelKey: string;
  signerRoleName: string;
  sortOrder: number;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripHtml = (value: string) => decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const FIELD_KEY_ALIAS_MAP = new Map<string, string>([
  ['현장명', 'site_name'],
  ['작업일', 'work_date'],
  ['작성자', 'writer_name'],
  ['담당자', 'manager_name'],
  ['책임자', 'manager_name'],
  ['안전책임자', 'safety_manager_name'],
  ['안전관리자', 'safety_manager_name'],
  ['안전책임자 서명', 'safety_manager_signature'],
  ['안전관리자 서명', 'safety_manager_signature'],
  ['양식명(코드)', 'form_template_code'],
  ['문서번호', 'document_number'],
  ['발급일', 'issue_date'],
  ['프로젝트', 'project_name'],
  ['계약', 'contract_scope'],
  ['제목', 'title'],
  ['공사착수일', 'work_start_date'],
  ['공사완료일', 'work_end_date'],
  ['검사의 방법', 'inspection_method'],
  ['검사의 시기', 'inspection_timing'],
  ['대금 지급방법', 'payment_method'],
  ['대금 지급시기', 'payment_timing'],
  ['원재료 지급시 조건', 'material_supply_conditions'],
  ['특기사항', 'special_notes'],
  ['첨부파일', 'attachment_list'],
]);

const sanitizeLabel = (value: string) => normalizeWhitespace(value).replace(/\*+/g, '').trim();

const buildFallbackFieldKey = (label: string, index: number) => {
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return ascii || `field_${index + 1}`;
};

const buildFieldKey = (label: string, index: number) =>
  FIELD_KEY_ALIAS_MAP.get(label) || buildFallbackFieldKey(label, index);

const inferFieldType = (label: string, value: string): TemplateFieldType => {
  if (label.includes('서명')) {
    return 'signature';
  }

  if (/(일|날짜|발급일)/.test(label) && /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(value)) {
    return 'date';
  }

  if (value.length >= 80 || label.includes('내용') || label.includes('특기사항') || label.includes('방법')) {
    return 'textarea';
  }

  return 'text';
};

const buildSignatureRoleName = (label: string) => label.replace(/서명/g, '').trim() || '서명자';

const buildFieldSeed = (label: string, value: string, index: number): ExtractedFieldSeed | null => {
  const normalizedLabel = sanitizeLabel(label);
  const normalizedValue = normalizeWhitespace(value);

  if (!normalizedLabel || !normalizedValue) {
    return null;
  }

  const fieldKey = buildFieldKey(normalizedLabel, index);
  const fieldType = inferFieldType(normalizedLabel, normalizedValue);

  return {
    fieldKey,
    fieldType,
    fieldLabel: normalizedLabel,
    labelKey: fieldKey,
    required: true,
    placeholder: fieldType === 'text' ? `${normalizedLabel}을 입력하세요` : null,
    layoutBlockId: `${fieldKey}_block`,
    sortOrder: index + 1,
  };
};

const buildSignatureSeed = (label: string, fieldKey: string, index: number): ExtractedSignatureSeed => ({
  labelKey: fieldKey,
  signerRoleName: buildSignatureRoleName(label),
  sortOrder: index + 1,
});

const extractHtmlRows = (html: string) => {
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = Array.from(html.matchAll(rowRegex));
  const fields: ExtractedFieldSeed[] = [];
  const signatures: ExtractedSignatureSeed[] = [];

  const draftHtml = html.replace(rowRegex, (rowMarkup) => {
    const thMatch = rowMarkup.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i);
    const tdMatch = rowMarkup.match(/<td\b([^>]*)>([\s\S]*?)<\/td>/i);

    if (!thMatch || !tdMatch) {
      return rowMarkup;
    }

    const label = sanitizeLabel(stripHtml(thMatch[1]));
    const value = normalizeWhitespace(stripHtml(tdMatch[2]));
    const seed = buildFieldSeed(label, value, fields.length);

    if (!seed) {
      return rowMarkup;
    }

    const tdAttributes = tdMatch[1] || '';

    if (seed.fieldType === 'signature') {
      signatures.push(buildSignatureSeed(label, seed.fieldKey, signatures.length));
      return rowMarkup.replace(
        tdMatch[0],
        `<td${tdAttributes}><div data-signature-area="${escapeHtml(seed.fieldKey)}"></div></td>`
      );
    }

    fields.push(seed);
    return rowMarkup.replace(
      tdMatch[0],
      `<td${tdAttributes}><span data-label="${escapeHtml(seed.fieldKey)}"></span></td>`
    );
  });

  if (rows.length === 0) {
    return null;
  }

  return { draftHtml, fields, signatures };
};

const extractTextPairs = (sourceContent: string) =>
  sourceContent
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .flatMap((line) => {
      const matched = line.match(/^([^:：]{1,60})[:：]\s*(.+)$/);

      if (!matched) {
        return [];
      }

      return [{ label: sanitizeLabel(matched[1]), value: normalizeWhitespace(matched[2]) }];
    });

const buildDraftFromTextPairs = (sourceTitle: string | null, sourceContent: string) => {
  const pairs = extractTextPairs(sourceContent);
  const fields: ExtractedFieldSeed[] = [];
  const signatures: ExtractedSignatureSeed[] = [];

  if (pairs.length === 0) {
    return {
      draftHtml: `<section data-template-root="true">
  <h1>${escapeHtml(sourceTitle || '템플릿 초안')}</h1>
  <pre>${escapeHtml(sourceContent)}</pre>
</section>`,
      fields,
      signatures,
    };
  }

  const rows = pairs
    .map((pair) => {
      const seed = buildFieldSeed(pair.label, pair.value, fields.length);

      if (!seed) {
        return '';
      }

      if (seed.fieldType === 'signature') {
        signatures.push(buildSignatureSeed(pair.label, seed.fieldKey, signatures.length));
        return `    <tr><th>${escapeHtml(pair.label)}</th><td><div data-signature-area="${escapeHtml(
          seed.fieldKey
        )}"></div></td></tr>`;
      }

      fields.push(seed);
      return `    <tr><th>${escapeHtml(pair.label)}</th><td><span data-label="${escapeHtml(
        seed.fieldKey
      )}"></span></td></tr>`;
    })
    .filter(Boolean)
    .join('\n');

  return {
    draftHtml: `<section data-template-root="true">
  <h1>${escapeHtml(sourceTitle || '템플릿 초안')}</h1>
  <table>
${rows}
  </table>
</section>`,
    fields,
    signatures,
  };
};

const toFieldInputs = (fields: ExtractedFieldSeed[]): TemplateFieldInput[] =>
  fields.map((field) => ({
    fieldKey: field.fieldKey,
    fieldType: field.fieldType,
    fieldLabel: field.fieldLabel,
    labelKey: field.labelKey,
    required: field.required,
    placeholder: field.placeholder,
    defaultValue: null,
    options: [],
    layoutBlockId: field.layoutBlockId,
    sortOrder: field.sortOrder,
  }));

const toSignatureAreaInputs = (signatures: ExtractedSignatureSeed[]): TemplateSignatureAreaInput[] =>
  signatures.map((signature) => ({
    labelKey: signature.labelKey,
    signerRoleName: signature.signerRoleName,
    pageIndex: 1,
    x: 0,
    y: 0,
    width: 160,
    height: 60,
    required: true,
    sortOrder: signature.sortOrder,
  }));

const resolveFromSource = (resolvedSource: TemplateExtractResolvedSource) => {
  if (resolvedSource.sourceKind === 'html') {
    const htmlResult = extractHtmlRows(resolvedSource.sourceContent);

    if (htmlResult) {
      return htmlResult;
    }
  }

  return buildDraftFromTextPairs(resolvedSource.sourceTitle, resolvedSource.sourceContent);
};

export const TemplateLayoutDraftService = {
  generateDraftFromResolvedSource(resolvedSource: TemplateExtractResolvedSource): TemplateLayoutDraftResult {
    const sourceTitle = resolvedSource.sourceTitle?.trim() || null;
    const generated = resolveFromSource(resolvedSource);

    return {
      sourceTitle,
      sourceDocumentName: resolvedSource.originalFileName || sourceTitle,
      resolvedSourceKind: resolvedSource.sourceKind,
      draftHtml: generated.draftHtml,
      suggestedFields: toFieldInputs(generated.fields),
      suggestedSignatureAreas: toSignatureAreaInputs(generated.signatures),
    };
  },

  generateDraftFromInput(input: TemplateLayoutDraftInput): TemplateLayoutDraftResult {
    const sourceTitle = input.sourceTitle?.trim() || null;

    return this.generateDraftFromResolvedSource({
      sourceTitle,
      sourceKind: input.sourceKind,
      sourceContent: input.sourceContent.trim(),
      originalFileName: null,
      originalMimeType: null,
    });
  },
};
