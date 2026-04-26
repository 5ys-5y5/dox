import { NextResponse } from 'next/server';
import type {
  TemplateExtractExtractionStage,
  TemplateExtractFrameGroupVersion,
} from '../../../../lib/templateExtractDtos';
import { TemplateExtractService } from '../../../../services/templateExtractService';
import { TemplateExtractVersionService } from '../../../../services/templateExtractVersionService';

const normalizeExtractionStage = (value: unknown): TemplateExtractExtractionStage =>
  value === 'frames' ? 'frames' : 'full';

const normalizeFrameGroupVersion = (value: unknown): TemplateExtractFrameGroupVersion => {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'v1.01' ||
    normalized === 'v1.02' ||
    normalized === 'v1.03' ||
    normalized === 'v1.04' ||
    normalized === 'v1.05' ||
    normalized === 'v1.06' ||
    normalized === 'v1.07' ||
    normalized === 'v1.08' ||
    normalized === 'v1.09' ||
    normalized === 'v1.10'
  ) {
    return normalized as TemplateExtractFrameGroupVersion;
  }

  if (/^v1\.09-[0-9a-z._\-\u3131-\u318e\uac00-\ud7a3]+$/i.test(normalized)) {
    return normalized as TemplateExtractFrameGroupVersion;
  }

  if (/^v1\.10-[0-9a-z._\-\u3131-\u318e\uac00-\ud7a3]+$/i.test(normalized)) {
    return normalized as TemplateExtractFrameGroupVersion;
  }

  return 'v1.10-default';
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let draft;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        throw new Error('템플릿 추출 실패: 업로드할 파일이 필요합니다.');
      }

      const engineVersion = TemplateExtractVersionService.normalizeVersion(formData.get('engineVersion'));
      const extractionStage = normalizeExtractionStage(formData.get('extractionStage'));
      const frameGroupVersion = normalizeFrameGroupVersion(formData.get('frameGroupVersion'));

      const resolvedSource = await TemplateExtractVersionService.resolveUploadSource(
        file.name,
        file.type || 'application/octet-stream',
        new Uint8Array(await file.arrayBuffer()),
        engineVersion,
        extractionStage,
        frameGroupVersion
      );

      draft = await TemplateExtractService.createDraftFromResolvedSource(
        {
          ...resolvedSource,
          sourceTitle: String(formData.get('sourceTitle') || '').trim() || resolvedSource.sourceTitle,
        },
        String(formData.get('similarTemplateIds') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      );
    } else {
      const body = await request.json();
      draft = await TemplateExtractService.createDraft({
        ...body,
        engineVersion: TemplateExtractVersionService.normalizeVersion(body?.engineVersion),
        extractionStage: normalizeExtractionStage(body?.extractionStage),
        frameGroupVersion: normalizeFrameGroupVersion(body?.frameGroupVersion),
      });
    }

    return NextResponse.json({ success: true, data: draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
