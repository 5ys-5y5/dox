import { NextResponse } from 'next/server';
import { TemplateExtractFileService } from '../../../services/templateExtractFileService';
import { TemplateLayoutDraftService } from '../../../services/templateLayoutDraftService';
import { TemplateService } from '../../../services/templateService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '12');
    const templates = await TemplateService.listTemplates(limit);

    return NextResponse.json(
      { success: true, data: templates },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Templates API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const action = String(formData.get('action') || '').trim();

      if (action !== 'generate_draft') {
        throw new Error('템플릿 처리 실패: 지원하지 않는 form action 입니다.');
      }

      const file = formData.get('file');

      if (!(file instanceof File)) {
        throw new Error('템플릿 초안 생성 실패: 업로드할 파일이 필요합니다.');
      }

      const resolvedSource = await TemplateExtractFileService.resolveUploadSource(
        file.name,
        file.type || 'application/octet-stream',
        new Uint8Array(await file.arrayBuffer())
      );

      const draft = TemplateLayoutDraftService.generateDraftFromResolvedSource({
        ...resolvedSource,
        sourceTitle: String(formData.get('sourceTitle') || '').trim() || resolvedSource.sourceTitle,
      });

      return NextResponse.json({ success: true, data: draft });
    }

    const body = await request.json();

    if (body.action === 'generate_draft') {
      const draft = TemplateLayoutDraftService.generateDraftFromInput(body);
      return NextResponse.json({ success: true, data: draft });
    }

    const template = await TemplateService.createTemplate(body);

    return NextResponse.json({ success: true, data: template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Templates API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
