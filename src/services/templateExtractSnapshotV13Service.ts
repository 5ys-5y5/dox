import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { extractPdfLayoutModel, normalizePdfFallbackText } from './templateExtractPdfService';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';

export const TemplateExtractSnapshotV13Service = {
  // BUILDHTML-PDF-14_SNAPSHOT_V13
  // v13은 텍스트 레이어가 없는 PDF를 실패로 두고,
  // text layer가 있는 PDF에만 pdf-form-v13 경로를 사용하던 직전 active 상태를 고정합니다.
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const layout = await extractPdfLayoutModel(fileName, bytes);
    const rawText = layout.rawText;
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했습니다. 현재는 텍스트가 포함된 PDF만 추출할 수 있습니다.');
    }

    const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText, layout, '13');

    if (clonedHtml) {
      return {
        sourceTitle,
        sourceKind: 'html',
        sourceContent: clonedHtml,
        originalFileName: fileName,
        originalMimeType: 'application/pdf',
      };
    }

    return {
      sourceTitle,
      sourceKind: 'text',
      sourceContent: normalizePdfFallbackText(rawText),
      originalFileName: fileName,
      originalMimeType: 'application/pdf',
    };
  },
};
