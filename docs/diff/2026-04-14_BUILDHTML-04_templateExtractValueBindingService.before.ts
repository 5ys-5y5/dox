import type { TemplateFieldType } from '../lib/templateDtos';
import type {
  TemplateExtractCandidateSeed,
  TemplateExtractConfidenceSummary,
  TemplateExtractPair,
  TemplateExtractReviewStatus,
} from '../lib/templateExtractDtos';

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

const EXTRACT_STRUCTURED_PDF_LABEL_RULES = [
  {
    matches: ['양식명(코드)'],
    fieldKey: 'form_template_code',
    labelKey: 'form_template_code',
    fieldLabel: '양식명(코드)',
    fieldType: 'text' as const,
    confidenceScore: 0.88,
  },
  {
    matches: ['양식 문서번호'],
    fieldKey: 'form_document_number',
    labelKey: 'form_document_number',
    fieldLabel: '양식 문서번호',
    fieldType: 'text' as const,
    confidenceScore: 0.9,
  },
  {
    matches: ['문서번호', '문 서 번 호'],
    fieldKey: 'document_number',
    labelKey: 'document_number',
    fieldLabel: '문서번호',
    fieldType: 'text' as const,
    confidenceScore: 0.9,
  },
  {
    matches: ['작성자', '작 성 자'],
    fieldKey: 'writer_name',
    labelKey: 'writer_name',
    fieldLabel: '작성자',
    fieldType: 'text' as const,
    confidenceScore: 0.9,
  },
  {
    matches: ['발급일', '발 급 일'],
    fieldKey: 'issue_date',
    labelKey: 'issue_date',
    fieldLabel: '발급일',
    fieldType: 'date' as const,
    confidenceScore: 0.92,
  },
  {
    matches: ['협력사승인일'],
    fieldKey: 'partner_approval_date',
    labelKey: 'partner_approval_date',
    fieldLabel: '협력사승인일',
    fieldType: 'date' as const,
    confidenceScore: 0.86,
  },
  {
    matches: ['프로젝트', '프 로 젝 트'],
    fieldKey: 'project_name',
    labelKey: 'project_name',
    fieldLabel: '프로젝트',
    fieldType: 'text' as const,
    confidenceScore: 0.9,
  },
  {
    matches: ['발급자', '발 급 자'],
    fieldKey: 'issuer_name',
    labelKey: 'issuer_name',
    fieldLabel: '발급자',
    fieldType: 'text' as const,
    confidenceScore: 0.9,
  },
  {
    matches: ['계약', '계 약'],
    fieldKey: 'contract_scope',
    labelKey: 'contract_scope',
    fieldLabel: '계약',
    fieldType: 'text' as const,
    confidenceScore: 0.86,
  },
  {
    matches: ['접수자', '접 수 자'],
    fieldKey: 'receiver_name',
    labelKey: 'receiver_name',
    fieldLabel: '접수자',
    fieldType: 'text' as const,
    confidenceScore: 0.9,
  },
  {
    matches: ['제목', '제 목'],
    fieldKey: 'instruction_title',
    labelKey: 'instruction_title',
    fieldLabel: '제목',
    fieldType: 'text' as const,
    confidenceScore: 0.88,
  },
  {
    matches: ['CE 담당자'],
    fieldKey: 'ce_assignee_name',
    labelKey: 'ce_assignee_name',
    fieldLabel: 'CE 담당자',
    fieldType: 'text' as const,
    confidenceScore: 0.86,
  },
  {
    matches: ['CE 처리시각'],
    fieldKey: 'ce_processed_at',
    labelKey: 'ce_processed_at',
    fieldLabel: 'CE 처리시각',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['PM 담당자'],
    fieldKey: 'pm_assignee_name',
    labelKey: 'pm_assignee_name',
    fieldLabel: 'PM 담당자',
    fieldType: 'text' as const,
    confidenceScore: 0.86,
  },
  {
    matches: ['PM 처리시각'],
    fieldKey: 'pm_processed_at',
    labelKey: 'pm_processed_at',
    fieldLabel: 'PM 처리시각',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['발급자 서명자'],
    fieldKey: 'issuer_signer_name',
    labelKey: 'issuer_signer_name',
    fieldLabel: '발급자 서명자',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['전자서명 상태'],
    fieldKey: 'issuer_signature_status',
    labelKey: 'issuer_signature_status',
    fieldLabel: '전자서명 상태',
    fieldType: 'text' as const,
    confidenceScore: 0.82,
  },
  {
    matches: ['공사 내용', '공 사 내 용'],
    fieldKey: 'work_scope',
    labelKey: 'work_scope',
    fieldLabel: '공사 내용',
    fieldType: 'textarea' as const,
    confidenceScore: 0.86,
  },
  {
    matches: ['대표수량 및 단가'],
    fieldKey: 'quantity_and_unit_price',
    labelKey: 'quantity_and_unit_price',
    fieldLabel: '대표수량 및 단가',
    fieldType: 'textarea' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['하도급 대금'],
    fieldKey: 'subcontract_amount',
    labelKey: 'subcontract_amount',
    fieldLabel: '하도급 대금',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['공사착수일'],
    fieldKey: 'work_start_date',
    labelKey: 'work_start_date',
    fieldLabel: '공사착수일',
    fieldType: 'date' as const,
    confidenceScore: 0.92,
  },
  {
    matches: ['공사완료일'],
    fieldKey: 'work_end_date',
    labelKey: 'work_end_date',
    fieldLabel: '공사완료일',
    fieldType: 'date' as const,
    confidenceScore: 0.92,
  },
  {
    matches: ['검사의 방법'],
    fieldKey: 'inspection_method',
    labelKey: 'inspection_method',
    fieldLabel: '검사의 방법',
    fieldType: 'textarea' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['검사의 시기'],
    fieldKey: 'inspection_timing',
    labelKey: 'inspection_timing',
    fieldLabel: '검사의 시기',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['대금 지급방법'],
    fieldKey: 'payment_method',
    labelKey: 'payment_method',
    fieldLabel: '대금 지급방법',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['대금 지급시기'],
    fieldKey: 'payment_timing',
    labelKey: 'payment_timing',
    fieldLabel: '대금 지급시기',
    fieldType: 'text' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['원재료 지급시 조건'],
    fieldKey: 'material_supply_conditions',
    labelKey: 'material_supply_conditions',
    fieldLabel: '원재료 지급시 조건',
    fieldType: 'text' as const,
    confidenceScore: 0.82,
  },
  {
    matches: ['공급원가 변동에 따른 하도급 대금의 조정'],
    fieldKey: 'price_adjustment_policy',
    labelKey: 'price_adjustment_policy',
    fieldLabel: '공급원가 변동에 따른 하도급 대금의 조정',
    fieldType: 'textarea' as const,
    confidenceScore: 0.82,
  },
  {
    matches: ['특기사항'],
    fieldKey: 'special_notes',
    labelKey: 'special_notes',
    fieldLabel: '특기사항',
    fieldType: 'textarea' as const,
    confidenceScore: 0.84,
  },
  {
    matches: ['첨부파일'],
    fieldKey: 'attachment_list',
    labelKey: 'attachment_list',
    fieldLabel: '첨부파일',
    fieldType: 'textarea' as const,
    confidenceScore: 0.84,
  },
] as const;

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
};

const inferDateField = (value: string) => {
  const trimmed = value.trim();

  return trimmed.length <= 40 && /^(\d{4}[-./]\s*\d{1,2}[-./]\s*\d{1,2})(?:\s+[AP]M)?$/i.test(trimmed);
};

const inferBooleanField = (value: string) => /^(예|아니오|Y|N|O|X|true|false)$/i.test(value.trim());

const normalizeExtractLabel = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase();

const isNumericOnlyLabel = (value: string) => /^\d+(?:[.)-]?\d+)*$/.test(value.trim());

const hasLongFreeformValue = (value: string) => value.trim().length >= 80;

const getKnownFieldMatchScore = (
  labelText: string,
  rules: ReadonlyArray<{
    matches: readonly string[];
  }>
) => {
  const normalized = labelText.toLowerCase();
  let bestScore = 0;

  for (const rule of rules) {
    for (const match of rule.matches) {
      const normalizedMatch = match.toLowerCase();

      if (normalized === normalizedMatch) {
        bestScore = Math.max(bestScore, normalizedMatch.length + 1000);
        continue;
      }

      if (normalized.includes(normalizedMatch)) {
        bestScore = Math.max(bestScore, normalizedMatch.length);
      }
    }
  }

  return bestScore;
};

const inferKnownField = (labelText: string, index: number) => {
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
    ...EXTRACT_STRUCTURED_PDF_LABEL_RULES,
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

  const ranked = knownRules
    .map((rule) => ({
      rule,
      score: getKnownFieldMatchScore(labelText, [rule]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.rule || null;
};

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
      ...EXTRACT_STRUCTURED_PDF_LABEL_RULES.flatMap((rule) => rule.matches),
      ...EXTRACT_TEXTAREA_LABEL_RULES.flatMap((rule) => rule.matches),
      '서명',
      'signature',
      'sign',
    ].some((match) => normalized.includes(match.toLowerCase()))
  );
};

const isHeaderLikePair = (pair: TemplateExtractPair) => {
  const labelText = pair.labelText.trim();
  const valueText = pair.valueText.trim();
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
    if (!/\d/.test(labelText) && !/\d/.test(valueText) && !hasLongFreeformValue(valueText)) {
      return true;
    }
  }

  return false;
};

const isUsefulExtractPair = (pair: TemplateExtractPair) => {
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

const dedupePairsByLabel = (pairs: TemplateExtractPair[]) => {
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

const inferCandidate = (pair: TemplateExtractPair, index: number): TemplateExtractCandidateSeed => {
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

type ConfidenceLike = {
  confidenceScore: number;
  reviewStatus: TemplateExtractReviewStatus;
};

export const TemplateExtractValueBindingService = {
  inferKnownFieldForLabel(labelText: string, index = 0) {
    return inferKnownField(labelText, index);
  },

  stripHtml(value: string) {
    return value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  decodeHtmlEntities(value: string) {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  },

  escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  buildConfidenceSummary(candidates: ConfidenceLike[]): TemplateExtractConfidenceSummary {
    return {
      candidateCount: candidates.length,
      acceptedCount: candidates.filter((candidate) => candidate.reviewStatus === 'accepted').length,
      reviewNeededCount: candidates.filter((candidate) => candidate.reviewStatus === 'review_needed').length,
      rejectedCount: candidates.filter((candidate) => candidate.reviewStatus === 'rejected').length,
      averageConfidenceScore: average(candidates.map((candidate) => candidate.confidenceScore)),
    };
  },

  extractPairsFromText(sourceContent: string): TemplateExtractPair[] {
    const lines = sourceContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const pairs: TemplateExtractPair[] = [];

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
  },

  buildCandidatesFromPairs(pairs: TemplateExtractPair[]) {
    const uniquePairs = dedupePairsByLabel(pairs.filter(isUsefulExtractPair));
    const candidates = uniquePairs.map((pair, index) => inferCandidate(pair, index));

    return {
      pairs: uniquePairs,
      candidates,
    };
  },

  createProjectionRegistry() {
    const pairs: TemplateExtractPair[] = [];
    const candidates: TemplateExtractCandidateSeed[] = [];
    const candidateByLabel = new Map<string, TemplateExtractCandidateSeed>();

    const registerPair = (pair: TemplateExtractPair, options?: { allowKnownEmptyValue?: boolean }) => {
      const labelText = pair.labelText.trim();
      const valueText = pair.valueText.trim();
      const allowKnownEmptyValue = options?.allowKnownEmptyValue ?? false;
      const canRegisterEmptyKnown = allowKnownEmptyValue && labelText && !valueText && inferKnownField(labelText, 0);

      if (!canRegisterEmptyKnown && !isUsefulExtractPair(pair)) {
        return null;
      }

      const normalizedLabel = normalizeExtractLabel(labelText);
      const existingCandidate = candidateByLabel.get(normalizedLabel);

      if (existingCandidate) {
        return existingCandidate;
      }

      const candidate = inferCandidate(pair, candidates.length);
      candidateByLabel.set(normalizedLabel, candidate);
      pairs.push(pair);
      candidates.push(candidate);

      return candidate;
    };

    return {
      pairs,
      candidates,
      registerPair,
    };
  },

  createKnownEmptyCandidate(labelText: string, sortOrder?: number) {
    const knownField = inferKnownField(labelText, sortOrder || 0);

    if (!knownField) {
      return null;
    }

    const reviewStatus = knownField.fieldType === 'signature' ? 'review_needed' : 'accepted';

    return {
      candidateKey: `candidate_empty_${knownField.labelKey}`,
      fieldKey: knownField.fieldKey,
      labelKey: knownField.labelKey,
      fieldType: knownField.fieldType,
      fieldLabel: knownField.fieldLabel,
      detectedValue: '',
      placeholder: null,
      defaultValue: null,
      options: [],
      required: false,
      layoutBlockId: `${knownField.labelKey}_block`,
      confidenceScore: knownField.confidenceScore,
      reviewStatus,
      extractionReason: `known empty label match: ${labelText}`,
      sortOrder: sortOrder ?? 0,
    };
  },
};
