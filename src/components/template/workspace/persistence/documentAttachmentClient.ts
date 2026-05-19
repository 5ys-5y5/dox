import type { DocumentValueFileDto, DocumentValueFileInput } from '../../../../lib/documentDtos';
import type { TemplateEditWorkspaceAttachmentDraft } from '../types';

type UploadDocumentAttachmentsParams = {
  attachmentApiPath: string;
  attachmentDrafts: TemplateEditWorkspaceAttachmentDraft[];
};

type UploadDocumentAttachmentsResponse = {
  uploads: DocumentValueFileInput[];
};

const normalizeDocumentValueFileInput = (
  file: Pick<
    DocumentValueFileDto | DocumentValueFileInput,
    'valueKey' | 'storageBucket' | 'storagePath' | 'originalFileName' | 'mimeType' | 'fileSizeBytes' | 'uploadedBy' | 'metadata'
  >,
  sortOrder: number
): DocumentValueFileInput => ({
  valueKey: String(file.valueKey || '').trim(),
  storageBucket: String(file.storageBucket || '').trim(),
  storagePath: String(file.storagePath || '').trim(),
  originalFileName: String(file.originalFileName || '').trim(),
  mimeType: file.mimeType || null,
  fileSizeBytes: file.fileSizeBytes ?? null,
  sortOrder,
  uploadedBy: file.uploadedBy || null,
  metadata: file.metadata || {},
});

const uploadDraftFiles = async (
  attachmentApiPath: string,
  valueKey: string,
  files: TemplateEditWorkspaceAttachmentDraft['newFiles']
): Promise<DocumentValueFileInput[]> => {
  if (files.length === 0) {
    return [];
  }

  const formData = new FormData();
  formData.append('valueKey', valueKey);
  files.forEach((entry) => {
    formData.append('files', entry.file, entry.file.name);
  });

  const response = await fetch(attachmentApiPath, {
    method: 'POST',
    body: formData,
  });
  const result = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: UploadDocumentAttachmentsResponse;
  };

  if (!response.ok || !result?.success || !result.data?.uploads) {
    throw new Error(result?.message || '첨부파일 업로드에 실패했습니다.');
  }

  return result.data.uploads;
};

export const buildDocumentAttachmentValueFilesForSave = async ({
  attachmentApiPath,
  attachmentDrafts,
}: UploadDocumentAttachmentsParams): Promise<DocumentValueFileInput[]> => {
  const normalizedAttachmentApiPath = String(attachmentApiPath || '').trim();

  const nextValueFiles: DocumentValueFileInput[] = [];

  for (const draft of attachmentDrafts) {
    const valueKey = String(draft.valueKey || '').trim();

    if (!valueKey) {
      continue;
    }

    const removedExistingFileIdSet = new Set(
      draft.removedExistingFileIds.map((fileId) => String(fileId || '').trim()).filter((fileId) => Boolean(fileId))
    );
    const keptExistingFiles = draft.existingFiles.filter((file) => !removedExistingFileIdSet.has(file.id));

    if (keptExistingFiles.some((file) => !String(file.storageBucket || '').trim() || !String(file.storagePath || '').trim())) {
      throw new Error('첨부파일 상세 정보를 아직 불러오지 못했습니다. 잠시 후 다시 저장해 주세요.');
    }

    if (draft.newFiles.length > 0 && !normalizedAttachmentApiPath) {
      throw new Error('첨부파일 업로드 경로를 찾지 못했습니다.');
    }

    const uploadedNewFiles = await uploadDraftFiles(normalizedAttachmentApiPath, valueKey, draft.newFiles);
    const orderedFiles = [
      ...keptExistingFiles.map((file, index) => normalizeDocumentValueFileInput(file, index)),
      ...uploadedNewFiles.map((file, index) => normalizeDocumentValueFileInput(file, keptExistingFiles.length + index)),
    ];

    nextValueFiles.push(...orderedFiles);
  }

  return nextValueFiles;
};
