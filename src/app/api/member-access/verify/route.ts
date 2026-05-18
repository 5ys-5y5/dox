import { NextResponse } from 'next/server';
import { MemberAccessService } from '../../../../services/memberAccessService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const verification = await MemberAccessService.verifyMemberAccess(body);

    return NextResponse.json({ success: true, data: verification });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Member Access Verify API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
