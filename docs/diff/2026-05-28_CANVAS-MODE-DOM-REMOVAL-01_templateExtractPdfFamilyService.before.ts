import type {
  TemplateExtractDocumentFamily,
  TemplateExtractPdfFamilyDetectionResult,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfRuleModel,
  TemplateExtractPdfSourceMode,
  TemplateExtractPdfTextSource,
} from '../lib/templateExtractDtos';

type FamilyScore = {
  family: TemplateExtractDocumentFamily;
  score: number;
  matchedSignals: string[];
  detectionReasons: string[];
};

const normalizeLoose = (value: string) => value.replace(/\s+/g, '').toLowerCase();

const WORK_ORDER_SIGNALS = [
  '작업지시서',
  '공사내용',
  '대표수량및단가',
  '하도급대금',
  '공사착수일',
  '공사완료일',
  '발급자서명',
  '전자서명상태',
  'ce',
  'pm',
] as const;

const CERTIFICATE_SIGNALS = [
  '사업자등록증',
  '사업자등록증명',
  '사업자등록번호',
  '대표자성명',
  '사업장소재지',
  '발급번호',
  '처리기간',
  '접수번호',
  '담당부서',
] as const;

const scoreSignals = (
  family: TemplateExtractDocumentFamily,
  normalizedText: string,
  normalizedSourceHint: string,
  signals: readonly string[],
  exactHint: string
): FamilyScore => {
  let score = 0;
  const matchedSignals: string[] = [];
  const detectionReasons: string[] = [];

  if (normalizedSourceHint.includes(normalizeLoose(exactHint))) {
    score += 4;
    matchedSignals.push(exactHint);
    detectionReasons.push(`source-hint:${exactHint}`);
  }

  for (const signal of signals) {
    const normalizedSignal = normalizeLoose(signal);

    if (!normalizedText.includes(normalizedSignal)) {
      continue;
    }

    score += signal.length <= 2 ? 0.5 : 1;
    matchedSignals.push(signal);
    detectionReasons.push(`text-signal:${signal}`);
  }

  return {
    family,
    score,
    matchedSignals,
    detectionReasons,
  };
};

const chooseFamily = (
  normalizedText: string,
  normalizedSourceHint: string
): Pick<TemplateExtractPdfFamilyDetectionResult, 'documentFamily' | 'confidenceScore' | 'matchedSignals' | 'detectionReasons'> => {
  const candidates = [
    scoreSignals('work_order', normalizedText, normalizedSourceHint, WORK_ORDER_SIGNALS, '작업지시서'),
    scoreSignals('certificate', normalizedText, normalizedSourceHint, CERTIFICATE_SIGNALS, '사업자등록증'),
  ].sort((left, right) => right.score - left.score);

  const winner = candidates[0];

  if (!winner || winner.score < 3) {
    return {
      documentFamily: 'generic_form',
      confidenceScore: 0.55,
      matchedSignals: [],
      detectionReasons: ['fallback:generic-form'],
    };
  }

  return {
    documentFamily: winner.family,
    confidenceScore: Math.min(0.99, 0.55 + winner.score * 0.06),
    matchedSignals: Array.from(new Set(winner.matchedSignals)),
    detectionReasons: Array.from(new Set(winner.detectionReasons)),
  };
};

const inferSourceModeFromPageSources = (
  pageSources: TemplateExtractPdfTextSource[]
): Pick<TemplateExtractPdfFamilyDetectionResult, 'sourceMode' | 'detectionReasons'> => {
  const digitalPageCount = pageSources.filter((source) => source === 'text_layer' || source === 'fallback_text').length;
  const scannedPageCount = pageSources.filter((source) => source === 'ocr').length;

  if (scannedPageCount > 0 && digitalPageCount === 0) {
    return {
      sourceMode: 'scanned',
      detectionReasons: [`source-mode:ocr-only-pages(${scannedPageCount})`],
    };
  }

  return {
    sourceMode: 'digital',
    detectionReasons: [`source-mode:text-pages(${digitalPageCount || pageSources.length})`],
  };
};

const collectNormalizedTextFromLayout = (layout: TemplateExtractPdfLayoutModel) =>
  normalizeLoose(
    [
      layout.rawText,
      ...layout.pages.flatMap((page) => page.lines.map((line) => line.text)),
    ]
      .filter(Boolean)
      .join(' ')
  );

const collectNormalizedTextFromRuleModel = (ruleModel: TemplateExtractPdfRuleModel) =>
  normalizeLoose(
    [
      ruleModel.rawText,
      ...ruleModel.pages.flatMap((page) => page.ocrLines.map((line) => line.text)),
    ]
      .filter(Boolean)
      .join(' ')
  );

export const TemplateExtractPdfFamilyService = {
  detectFromLayout(
    sourceTitle: string,
    fileName: string,
    layout: TemplateExtractPdfLayoutModel
  ): TemplateExtractPdfFamilyDetectionResult {
    const pageSources = layout.pages.map((page) => page.contentSource || page.lines[0]?.source || 'text_layer');
    const sourceModeResult = inferSourceModeFromPageSources(pageSources);
    const normalizedText = collectNormalizedTextFromLayout(layout);
    const normalizedSourceHint = normalizeLoose(`${sourceTitle} ${fileName}`);
    const familyResult = chooseFamily(normalizedText, normalizedSourceHint);

    return {
      sourceMode: sourceModeResult.sourceMode,
      documentFamily: familyResult.documentFamily,
      confidenceScore: familyResult.confidenceScore,
      matchedSignals: familyResult.matchedSignals,
      detectionReasons: [...sourceModeResult.detectionReasons, ...familyResult.detectionReasons],
    };
  },

  detectFromRuleModel(
    sourceTitle: string,
    fileName: string,
    ruleModel: TemplateExtractPdfRuleModel
  ): TemplateExtractPdfFamilyDetectionResult {
    const normalizedText = collectNormalizedTextFromRuleModel(ruleModel);
    const normalizedSourceHint = normalizeLoose(`${sourceTitle} ${fileName}`);
    const familyResult = chooseFamily(normalizedText, normalizedSourceHint);

    return {
      sourceMode: 'scanned',
      documentFamily: familyResult.documentFamily,
      confidenceScore: familyResult.confidenceScore,
      matchedSignals: familyResult.matchedSignals,
      detectionReasons: ['source-mode:rule-ocr-model', ...familyResult.detectionReasons],
    };
  },
};
