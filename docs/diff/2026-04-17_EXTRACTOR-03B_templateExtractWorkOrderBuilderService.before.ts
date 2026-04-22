import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfLine,
  TemplateExtractPdfRuleModel,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';
import { TemplateExtractPdfTextRecoveryService } from './templateExtractPdfTextRecoveryService';

const OCR_ROW_TOLERANCE_PX = 8;

type OcrRow = {
  y: number;
  lines: TemplateExtractPdfLine[];
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const sortOcrLines = (lines: TemplateExtractPdfLine[]) =>
  [...lines].sort((left, right) => {
    if (Math.abs(left.y - right.y) <= 3) {
      return left.x - right.x;
    }

    return right.y - left.y;
  });

const groupOcrRows = (lines: TemplateExtractPdfLine[]) => {
  const rows: OcrRow[] = [];

  for (const line of sortOcrLines(lines)) {
    const text = normalizeWhitespace(line.text);

    if (!text) {
      continue;
    }

    const current = rows[rows.length - 1];

    if (current && Math.abs(current.y - line.y) <= OCR_ROW_TOLERANCE_PX) {
      current.lines.push({
        ...line,
        text,
      });
      current.y = (current.y * (current.lines.length - 1) + line.y) / current.lines.length;
      continue;
    }

    rows.push({
      y: line.y,
      lines: [
        {
          ...line,
          text,
        },
      ],
    });
  }

  return rows.map((row) => ({
    ...row,
    lines: [...row.lines].sort((left, right) => left.x - right.x),
  }));
};

const buildSyntheticRawText = (ruleModel: TemplateExtractPdfRuleModel) =>
  ruleModel.pages
    .map((page) =>
      groupOcrRows(page.ocrLines)
        .map((row) => row.lines.map((line) => normalizeWhitespace(line.text)).filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n')
    )
    .filter(Boolean)
    .join('\n\n');

const buildSyntheticLayoutFromRuleModel = (ruleModel: TemplateExtractPdfRuleModel): TemplateExtractPdfLayoutModel => ({
  rawText: buildSyntheticRawText(ruleModel),
  pages: ruleModel.pages.map((page) => ({
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    contentSource: 'ocr',
    lines: sortOcrLines(page.ocrLines).map((line) => ({
      ...line,
      text: normalizeWhitespace(line.text),
      source: 'ocr',
    })),
  })),
});

export const TemplateExtractWorkOrderBuilderService = {
  buildFromDigitalLayout(
    sourceTitle: string,
    layout: TemplateExtractPdfLayoutModel,
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ) {
    return TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, layout.rawText, layout, version);
  },

  buildFromRuleModel(
    sourceTitle: string,
    fileName: string,
    ruleModel: TemplateExtractPdfRuleModel,
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ) {
    const syntheticLayout = buildSyntheticLayoutFromRuleModel(ruleModel);

    if (syntheticLayout.rawText.trim()) {
      const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(
        sourceTitle,
        syntheticLayout.rawText,
        syntheticLayout,
        version
      );

      if (clonedHtml) {
        return clonedHtml;
      }
    }

    // EXTRACTOR-03_WORK_ORDER_SCANNED_FALLBACK
    // scanned work-order 는 우선 동일 family builder 에 OCR synthetic layout 을 공급하되,
    // OCR 구조가 너무 약하면 같은 service 경로 안에서 frame 기반 fallback 으로 내려갑니다.
    return TemplateExtractPdfTextRecoveryService.buildHtmlFromRuleModel(
      sourceTitle,
      fileName,
      ruleModel,
      version
    );
  },

  buildSyntheticLayoutFromRuleModel,
};
