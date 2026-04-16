import { NextResponse } from 'next/server';
import { MessagingService } from '../../../../../services/messagingService';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 12;
    const data = await MessagingService.listSmsDispatches(limit);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '문자 발송 이력 조회 실패' },
      { status: 500 }
    );
  }
}
