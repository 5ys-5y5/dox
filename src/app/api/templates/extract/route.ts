import { NextResponse } from 'next/server';
import { TemplateExtractService } from '../../../../services/templateExtractService';
import { TemplateExtractVersionService } from '../../../../services/templateExtractVersionService';

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

      const resolvedSource = await TemplateExtractVersionService.resolveUploadSource(
        file.name,
        file.type || 'application/octet-stream',
        new Uint8Array(await file.arrayBuffer()),
        engineVersion
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
      });
    }

    return NextResponse.json({ success: true, data: draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
