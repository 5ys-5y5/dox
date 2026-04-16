import { NextResponse } from 'next/server';
import { MessagingService } from '../../../../../services/messagingService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await MessagingService.sendEmail(body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '이메일 발송 실패' },
      { status: 500 }
    );
  }
}
