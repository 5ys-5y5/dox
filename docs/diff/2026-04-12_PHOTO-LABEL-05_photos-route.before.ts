import { NextResponse } from 'next/server';
import { PhotoLabelService } from '../../../services/photoLabelService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId') || undefined;
    const limit = Number(searchParams.get('limit') || '20');
    const photos = await PhotoLabelService.listPhotos(siteId, limit);

    return NextResponse.json(
      { success: true, data: photos },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Photos API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await PhotoLabelService.createPhoto(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Photos API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
