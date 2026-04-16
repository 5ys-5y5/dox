import { NextResponse } from 'next/server';
import { SignAuthService } from '../../../../services/signAuthService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get('limit') || '12');
    const limit = Number.isFinite(limitParam) ? limitParam : 12;
    const authentications = await SignAuthService.listVerifiedAuthentications({ limit });

    return NextResponse.json(
      {
        success: true,
        data: {
          authentications,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Sign Authentications API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
