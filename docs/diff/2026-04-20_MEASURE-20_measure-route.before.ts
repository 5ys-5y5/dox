import { NextResponse } from 'next/server';
import { TemplateExtractPdfRenderService } from '../../../../../services/templateExtractPdfRenderService';
import { TemplateExtractMeasurementLogService } from '../../../../../services/templateExtractMeasurementLogService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let measurementLogFileName = '';

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    measurementLogFileName = String(formData.get('measurementLogFileName') || '').trim();

    if (!(file instanceof File)) {
      throw new Error('시각 유사도 측정 실패: PDF 파일이 필요합니다.');
    }

    const fileName = file.name || 'upload.pdf';

    if (!/\.pdf$/i.test(fileName) && file.type !== 'application/pdf') {
      throw new Error('시각 유사도 측정 실패: PDF 파일만 측정할 수 있습니다.');
    }

    if (measurementLogFileName) {
      await TemplateExtractMeasurementLogService.appendEvent({
        fileName: measurementLogFileName,
        phase: 'rendering_pdf',
        percent: 24,
        stage: '서버에서 PDF 페이지 PNG 렌더를 시작했습니다.',
        detail: `업로드된 원본 PDF ${fileName} 를 페이지 이미지로 변환합니다.`,
        payload: {
          fileName,
          fileType: file.type || 'application/pdf',
          fileSize: file.size,
        },
      }).catch(() => undefined);
    }

    const pageImages = await TemplateExtractPdfRenderService.renderPageImages(
      fileName,
      new Uint8Array(await file.arrayBuffer())
    );

    if (measurementLogFileName) {
      await TemplateExtractMeasurementLogService.appendEvent({
        fileName: measurementLogFileName,
        phase: 'rendering_pdf',
        percent: 40,
        stage: '서버에서 PDF 페이지 PNG 렌더를 완료했습니다.',
        detail: `총 ${pageImages.length}개 페이지 이미지를 생성했습니다.`,
        payload: {
          pageCount: pageImages.length,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      data: {
        pageImages,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Measure POST Error:', error);

    if (measurementLogFileName) {
      await TemplateExtractMeasurementLogService.appendEvent({
        fileName: measurementLogFileName,
        level: 'error',
        phase: 'rendering_pdf',
        percent: 24,
        stage: '서버에서 PDF 페이지 PNG 렌더 중 오류가 발생했습니다.',
        detail: message,
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
