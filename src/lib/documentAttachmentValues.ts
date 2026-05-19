import type { DocumentValueFileDto } from './documentDtos';

export const groupDocumentValueFilesByValueKey = (valueFiles: DocumentValueFileDto[]) => {
  return valueFiles.reduce<Record<string, DocumentValueFileDto[]>>((accumulator, file) => {
    const valueKey = String(file.valueKey || '').trim();

    if (!valueKey) {
      return accumulator;
    }

    if (!accumulator[valueKey]) {
      accumulator[valueKey] = [];
    }

    accumulator[valueKey].push(file);
    accumulator[valueKey].sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.originalFileName.localeCompare(right.originalFileName, 'ko');
    });

    return accumulator;
  }, {});
};

export const stringifyDocumentAttachmentFileNames = (valueFiles: DocumentValueFileDto[]) =>
  valueFiles.map((file) => String(file.originalFileName || '').trim()).filter((name) => Boolean(name)).join('\n');

export const buildDocumentAttachmentTextByValueKey = (valueFiles: DocumentValueFileDto[]) => {
  const grouped = groupDocumentValueFilesByValueKey(valueFiles);

  return Object.entries(grouped).reduce<Record<string, string>>((accumulator, [valueKey, files]) => {
    accumulator[valueKey] = stringifyDocumentAttachmentFileNames(files);
    return accumulator;
  }, {});
};
