import type {
  TemplateExtractEngineVersion,
  TemplateExtractExtractionStage,
  TemplateExtractFrameGroupVersion,
  TemplateExtractResolvedSource,
} from '../lib/templateExtractDtos';
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
import { TemplateExtractSnapshotV18Service } from './templateExtractSnapshotV18Service';

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
      value === '47' ||
      value === '46' ||
      value === '45' ||
      value === '44' ||
      value === '43' ||
      value === '42' ||
      value === '36' ||
      value === '35' ||
      value === '34' ||
      value === '33' ||
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
      value === '18' ||
      value === '19' ||
      value === '20' ||
      value === '21' ||
      value === '22' ||
      value === '23' ||
      value === '24' ||
      value === '25' ||
      value === '26' ||
      value === '27' ||
      value === '28' ||
      value === '29' ||
      value === '30' ||
      value === '31' ||
      value === '32'
    ) {
      return value;
    }

    if (value === 'v2.21' || value === '2.21') {
      return '47';
    }

    if (value === 'v2.2' || value === '2.2' || value === 'v2.20' || value === '2.20') {
      return '46';
    }

    if (value === 'v2.14' || value === '2.14') {
      return '45';
    }

    if (value === 'v2.13' || value === '2.13') {
      return '44';
    }

    if (value === 'v2.12' || value === '2.12') {
      return '43';
    }

    if (value === 'v2.11' || value === '2.11') {
      return '42';
    }

    if (value === 'v2.05' || value === '2.05') {
      return '36';
    }

    if (value === 'v2.04' || value === '2.04') {
      return '35';
    }

    if (value === 'v2.03' || value === '2.03') {
      return '34';
    }

    if (value === 'v2.02' || value === '2.02') {
      return '33';
    }

    if (value === 'v2.01' || value === '2.01') {
      return '32';
    }

    if (typeof value === 'string') {
      const legacyMatched = value.trim().match(/^v?1\.(\d{2})$/i);
      const legacyVersion = legacyMatched?.[1]?.replace(/^0/, '');

      if (
        legacyVersion === '5' ||
        legacyVersion === '7' ||
        legacyVersion === '8' ||
        legacyVersion === '9' ||
        legacyVersion === '10' ||
        legacyVersion === '11' ||
        legacyVersion === '12' ||
        legacyVersion === '13' ||
        legacyVersion === '14' ||
        legacyVersion === '15' ||
        legacyVersion === '16' ||
        legacyVersion === '17' ||
        legacyVersion === '18' ||
        legacyVersion === '19' ||
        legacyVersion === '20' ||
        legacyVersion === '21' ||
        legacyVersion === '22' ||
        legacyVersion === '23' ||
        legacyVersion === '24' ||
        legacyVersion === '25' ||
        legacyVersion === '26' ||
        legacyVersion === '27' ||
        legacyVersion === '28' ||
        legacyVersion === '29' ||
        legacyVersion === '30' ||
        legacyVersion === '31'
      ) {
        return legacyVersion;
      }
    }

    return '19';
  },

  async resolveUploadSource(
    fileName: string,
    mimeType: string,
    bytes: Uint8Array,
    version: TemplateExtractEngineVersion,
    extractionStage: TemplateExtractExtractionStage = 'full',
    frameGroupVersion: TemplateExtractFrameGroupVersion = 'v1.11-default'
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
        return TemplateExtractSnapshotV18Service.extractPdfSource(fileName, bytes);
      case '19':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '19');
      case '20':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '20');
      case '21':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '21');
      case '22':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '22');
      case '23':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '23');
      case '24':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '24');
      case '25':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '25');
      case '26':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '26');
      case '27':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '27');
      case '28':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '28');
      case '29':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '29');
      case '30':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '30');
      case '31':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '31');
      case '32':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '32', extractionStage, frameGroupVersion);
      case '33':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '33', extractionStage, frameGroupVersion);
      case '34':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '34', extractionStage, frameGroupVersion);
      case '35':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '35', extractionStage, frameGroupVersion);
      case '47':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '47', extractionStage, frameGroupVersion);
      case '46':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '46', extractionStage, frameGroupVersion);
      case '45':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '45', extractionStage, frameGroupVersion);
      case '44':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '44', extractionStage, frameGroupVersion);
      case '43':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '43', extractionStage, frameGroupVersion);
      case '42':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '42', extractionStage, frameGroupVersion);
      case '36':
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '36', extractionStage, frameGroupVersion);
      default:
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes, '19');
    }
  },
};
