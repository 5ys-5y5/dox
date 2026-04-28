import { NextResponse } from 'next/server';
import { TemplateExtractFrameTextService } from '../../../../../services/templateExtractFrameTextService';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const mode = String(formData.get('mode') || '').trim().toLowerCase();

    if (!(file instanceof File)) {
      throw new Error('텍스트 추출 실패: 업로드할 PDF 파일이 필요합니다.');
    }

    const renderModel = await TemplateExtractFrameTextService.extractPdfFrameText(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      {
        forceOcr: mode === 'image',
      }
    );

    return NextResponse.json({ success: true, data: renderModel });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Frame Text API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
