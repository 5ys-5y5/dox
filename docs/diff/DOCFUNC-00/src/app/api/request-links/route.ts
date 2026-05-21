import { NextResponse } from 'next/server';
import { RequestLinkService } from '../../../services/requestLinkService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dispatchUrlFor = searchParams.get('dispatchUrlFor')?.trim();

    if (dispatchUrlFor) {
      const data = await RequestLinkService.issueDispatchUrl(dispatchUrlFor);

      return NextResponse.json(
        { success: true, data },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const siteId = searchParams.get('siteId')?.trim() || undefined;
    const limit = Number(searchParams.get('limit') || '10');
    const data = await RequestLinkService.listRecentRequestLinks({ siteId, limit });

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Request Links API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

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
