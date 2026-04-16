import { NextResponse } from 'next/server';
import { MessagingService } from '../../../../../services/messagingService';

export async function GET() {
  try {
    const data = await MessagingService.listSmsSenders();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '발신번호 조회 실패' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await MessagingService.createSmsSender(body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '발신번호 등록 실패' },
      { status: 500 }
    );
  }
}
