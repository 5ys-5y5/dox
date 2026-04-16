import type { TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { extractPdfLayoutModel, normalizePdfFallbackText } from './templateExtractPdfService';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';
import { TemplateExtractPdfTextRecoveryService } from './templateExtractPdfTextRecoveryService';

export const TemplateExtractSnapshotV14Service = {
  // BUILDHTML-PDF-15_SNAPSHOT_V14
  // v14는 text layer PDF -> pdf-form-v14,
  // image PDF -> pdf-grid-v14 로 분기하던 직전 active 상태를 고정합니다.
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const layout = await extractPdfLayoutModel(fileName, bytes);
    const rawText = layout.rawText;
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';

    if (!rawText.trim()) {
      const recoveredHtml = await TemplateExtractPdfTextRecoveryService.recoverHtml(sourceTitle, fileName, bytes, '14');

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

    const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText, layout, '14');

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
