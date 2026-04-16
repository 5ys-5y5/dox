import { NextResponse } from 'next/server';
import { MessagingService } from '../../../../../services/messagingService';

export async function GET() {
  try {
    const data = await MessagingService.getSmsSettings();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '문자 발송 설정 조회 실패' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await MessagingService.updateSmsSettings(body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '문자 발송 설정 저장 실패' },
      { status: 500 }
    );
  }
}
