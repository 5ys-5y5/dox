import type {
  TemplateDetailResult,
  TemplateLayoutResizeMode,
  TemplateRecordDto,
  TemplateSchemaSnapshotInput,
} from '../../../../lib/templateDtos';

type TemplateApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

type TemplateApiFailure = {
  success?: false;
  message?: string;
};

type TemplateApiResponse<T> = TemplateApiSuccess<T> | TemplateApiFailure;

const readApiJson = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const result = (await response.json()) as TemplateApiResponse<T>;

  if (!response.ok || !result.success) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data;
};

export const fetchTemplateList = async (limit = 64): Promise<TemplateRecordDto[]> => {
  const response = await fetch(`/api/templates?limit=${limit}`, { cache: 'no-store' });
  return readApiJson<TemplateRecordDto[]>(response, '저장된 템플릿 목록을 불러오지 못했습니다.');
};

export const fetchTemplateDetail = async (templateId: string): Promise<TemplateDetailResult> => {
  const response = await fetch(`/api/templates/${templateId}?ts=${Date.now()}`, {
    cache: 'no-store',
  });

  return readApiJson<TemplateDetailResult>(response, '템플릿 상세를 불러오지 못했습니다.');
};

export const deleteTemplateRecord = async (templateId: string): Promise<void> => {
  const response = await fetch(`/api/templates/${templateId}`, {
    method: 'DELETE',
  });

  await readApiJson<null>(response, '템플릿 삭제에 실패했습니다.');
};

export const saveTemplateRecord = async ({
  templateId,
  templateName,
  sourceDocumentName,
  layoutResizeMode,
  draftHtml,
  revisionSnapshot,
}: {
  templateId?: string;
  templateName: string;
  sourceDocumentName: string;
  layoutResizeMode: TemplateLayoutResizeMode;
  draftHtml: string;
  revisionSnapshot: TemplateSchemaSnapshotInput;
}): Promise<TemplateRecordDto | undefined> => {
  const normalizedTemplateId = templateId?.trim() || '';
  const response = await fetch(normalizedTemplateId ? `/api/templates/${normalizedTemplateId}` : '/api/templates', {
    method: normalizedTemplateId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateName,
      sourceDocumentName,
      layoutResizeMode,
      draftHtml,
      revisionSnapshot,
    }),
  });

  const result = (await response.json()) as TemplateApiResponse<
    TemplateRecordDto | { template?: TemplateRecordDto } | undefined
  >;

  if (!response.ok || !result.success) {
    throw new Error(result.message || '템플릿 저장에 실패했습니다.');
  }

  if (!result.data) {
    return undefined;
  }

  if ('template' in result.data && result.data.template) {
    return result.data.template;
  }

  return result.data as TemplateRecordDto;
};
