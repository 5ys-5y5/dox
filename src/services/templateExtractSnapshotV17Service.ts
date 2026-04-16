import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { extractPdfLayoutModel, normalizePdfFallbackText } from './templateExtractPdfService';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';
import { TemplateExtractPdfTextRecoveryService } from './templateExtractPdfTextRecoveryService';

export const TemplateExtractSnapshotV17Service = {
  // BUILDHTML-PDF-18_SNAPSHOT_V17
  // v17은 직전 active 상태를 그대로 고정합니다.
  // text layer PDF -> pdf-form-v17
  // image PDF -> pdf-frame-v15
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const layout = await extractPdfLayoutModel(fileName, bytes);
    const rawText = layout.rawText;
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      const recoveredHtml = await TemplateExtractPdfTextRecoveryService.recoverHtml(sourceTitle, fileName, bytes, '15');

      if (recoveredHtml) {
        return {
          sourceTitle,
          sourceKind: 'html',
          sourceContent: recoveredHtml,
          originalFileName: fileName,
          originalMimeType: 'application/pdf',
        };
      }

      throw new Error('템플릿 추출 실패: 텍스트 레이어를 찾지 못했고, 이미지 기반 문서 틀 복제도 실패했습니다.');
    }

    const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText, layout, '17');

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
