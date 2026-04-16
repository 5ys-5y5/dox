import { NextResponse } from 'next/server';
import { MessagingService } from '../../../../../services/messagingService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await MessagingService.syncSmsDispatchStatus(body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '문자 상태 동기화 실패' },
      { status: 500 }
    );
  }
}
