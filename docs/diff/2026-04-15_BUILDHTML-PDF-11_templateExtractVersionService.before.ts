import type { TemplateExtractEngineVersion, TemplateExtractResolvedSource } from '../lib/templateExtractDtos';
import { TemplateExtractFileService } from './templateExtractFileService';
import { TemplateExtractPdfService } from './templateExtractPdfService';
import { TemplateExtractSnapshotV05Service } from './templateExtractSnapshotV05Service';
import { TemplateExtractSnapshotV07Service } from './templateExtractSnapshotV07Service';
import { TemplateExtractSnapshotV08Service } from './templateExtractSnapshotV08Service';
import { TemplateExtractSnapshotV09Service } from './templateExtractSnapshotV09Service';

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
    if (value === '5' || value === '7' || value === '8' || value === '9') {
      return value;
    }

    return 'current';
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
      case 'current':
      default:
        return TemplateExtractPdfService.extractPdfSource(fileName, bytes);
    }
  },
};
