import { NextResponse } from 'next/server';
import { PhotoLabelService } from '../../../../services/photoLabelService';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new Error('사진 업로드 실패: 업로드할 파일이 필요합니다.');
    }

    const result = await PhotoLabelService.uploadPhoto({
      siteId: String(formData.get('siteId') || ''),
      photoTitle: String(formData.get('photoTitle') || '') || null,
      description: String(formData.get('description') || '') || null,
      capturedAt: String(formData.get('capturedAt') || '') || null,
      capturedLocationText: String(formData.get('capturedLocationText') || '') || null,
      capturedLatitude: formData.get('capturedLatitude')
        ? Number(formData.get('capturedLatitude'))
        : null,
      capturedLongitude: formData.get('capturedLongitude')
        ? Number(formData.get('capturedLongitude'))
        : null,
      originalFileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileBytes: new Uint8Array(await file.arrayBuffer()),
      fileSizeBytes: file.size,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Photos Upload API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
