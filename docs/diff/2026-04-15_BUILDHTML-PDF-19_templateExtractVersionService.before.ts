import type { TemplateExtractEngineVersion, TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { TemplateExtractFileService } from './templateExtractFileService';
import { extractPdfLayoutModel, normalizePdfFallbackText, TemplateExtractPdfService } from './templateExtractPdfService';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';
import { TemplateExtractPdfTextRecoveryService } from './templateExtractPdfTextRecoveryService';
import { TemplateExtractSnapshotV05Service } from './templateExtractSnapshotV05Service';
import { TemplateExtractSnapshotV07Service } from './templateExtractSnapshotV07Service';
import { TemplateExtractSnapshotV08Service } from './templateExtractSnapshotV08Service';
import { TemplateExtractSnapshotV09Service } from './templateExtractSnapshotV09Service';
import { TemplateExtractSnapshotV10Service } from './templateExtractSnapshotV10Service';
import { TemplateExtractSnapshotV11Service } from './templateExtractSnapshotV11Service';
import { TemplateExtractSnapshotV12Service } from './templateExtractSnapshotV12Service';
import { TemplateExtractSnapshotV13Service } from './templateExtractSnapshotV13Service';
import { TemplateExtractSnapshotV14Service } from './templateExtractSnapshotV14Service';
import { TemplateExtractSnapshotV15Service } from './templateExtractSnapshotV15Service';
import { TemplateExtractSnapshotV17Service } from './templateExtractSnapshotV17Service';

const getFileExtension = (fileName: string) => {
  const matched = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] || '';
};

const isPdfUpload = (fileName: string, mimeType: string) => {
  const extension = getFileExtension(fileName);
  return mimeType === 'application/pdf' || extension === 'pdf';
};

export const TemplateExtractVersionService = {
  normalizeVersion(value: unknown): TemplateExtractEngineVersion {
    if (
      value === '5' ||
      value === '7' ||
      value === '8' ||
      value === '9' ||
      value === '10' ||
      value === '11' ||
      value === '12' ||
      value === '13' ||
      value === '14' ||
      value === '15' ||
      value === '16' ||
      value === '17' ||
      value === '18'
    ) {
      return value;
    }

    return '18';
  },

  async resolveUploadSource(
    fileName: string,
    mimeType: string,
    bytes: Uint8Array,
    version: TemplateExtractEngineVersion
  ): Promise<TemplateExtractResolvedSource> {
    if (!isPdfUpload(fileName, mimeType)) {
      return TemplateExtractFileService.resolveUploadSource(fileName, mimeType, bytes);
    }

    switch (version) {
      case '5':
        return TemplateExtractSnapshotV05Service.extractPdfSource(fileName, bytes);
      case '7':
        return TemplateExtractSnapshotV07Service.extractPdfSource(fileName, bytes);
      case '8':
        return TemplateExtractSnapshotV08Service.extractPdfSource(fileName, bytes);
      case '9':
        return TemplateExtractSnapshotV09Service.extractPdfSource(fileName, bytes);
      case '10':
        return TemplateExtractSnapshotV10Service.extractPdfSource(fileName, bytes);
      case '11':
        return TemplateExtractSnapshotV11Service.extractPdfSource(fileName, bytes);
      case '12':
        return TemplateExtractSnapshotV12Service.extractPdfSource(fileName, bytes);
      case '13':
        return TemplateExtractSnapshotV13Service.extractPdfSource(fileName, bytes);
      case '14':
        return TemplateExtractSnapshotV14Service.extractPdfSource(fileName, bytes);
      case '15':
        return TemplateExtractSnapshotV15Service.extractPdfSource(fileName, bytes);
      case '16':
        {
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

          const clonedHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, rawText, layout, '16');

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
        }
      case '17':
        return TemplateExtractSnapshotV17Service.extractPdfSource(fileName, bytes);
      case '18':
      default:
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes);
    }
  },
};
