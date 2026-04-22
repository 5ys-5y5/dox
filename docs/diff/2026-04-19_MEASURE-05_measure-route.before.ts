import { NextResponse } from 'next/server';
import { TemplateExtractPdfRenderService } from '../../../../../services/templateExtractPdfRenderService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new Error('시각 유사도 측정 실패: PDF 파일이 필요합니다.');
    }

    const fileName = file.name || 'upload.pdf';

    if (!/\.pdf$/i.test(fileName) && file.type !== 'application/pdf') {
      throw new Error('시각 유사도 측정 실패: PDF 파일만 측정할 수 있습니다.');
    }

    const pageImages = await TemplateExtractPdfRenderService.renderPageImages(
      fileName,
      new Uint8Array(await file.arrayBuffer())
    );

    return NextResponse.json({
      success: true,
      data: {
        pageImages,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Measure POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
