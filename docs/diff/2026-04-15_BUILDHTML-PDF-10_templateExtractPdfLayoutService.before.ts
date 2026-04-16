import type { TemplateExtractPdfLayoutModel } from '../lib/templateExtractDtos';
import { TemplateExtractPdfGeometryService } from './templateExtractPdfGeometryService';
import { TemplateExtractPdfHtmlCloneService } from './templateExtractPdfHtmlCloneService';

export const TemplateExtractPdfLayoutService = {
  // BUILDHTML-PDF-09
  // PDF 텍스트 줄을 그대로 absolute 재배치하지 않고,
  // 행/열 geometry 를 먼저 만들고 실제 HTML table 로 재구성합니다.
  // 이 단계는 배경 이미지 마스킹 없이 "실제 HTML 템플릿"을 만드는 활성 경로입니다.
  buildCloneHtml(sourceTitle: string, _rawText: string, layout?: TemplateExtractPdfLayoutModel | null) {
    if (!layout || layout.pages.length === 0) {
      return null;
    }

    const geometryModel = TemplateExtractPdfGeometryService.buildGeometry(layout);
    return TemplateExtractPdfHtmlCloneService.buildCloneHtml(sourceTitle, geometryModel);
  },
};
