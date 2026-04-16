import { NextResponse } from 'next/server';
import { MessagingService } from '../../../../../services/messagingService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '12');
    const data = await MessagingService.listEmailDispatches(limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '이메일 발송 이력 조회 실패' },
      { status: 500 }
    );
  }
}
