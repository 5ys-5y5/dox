import { NextResponse } from 'next/server';
import { RequestLinkService } from '../../../services/requestLinkService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await RequestLinkService.createRequestLink(body);

    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Request Links API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
