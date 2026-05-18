import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createMemberAccessSessionToken, MEMBER_ACCESS_SESSION_COOKIE_NAME, readMemberAccessSessionToken } from '../../../../lib/memberAccessSession';
import { MemberAccessService } from '../../../../services/memberAccessService';

const buildSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
});

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = readMemberAccessSessionToken(cookieStore.get(MEMBER_ACCESS_SESSION_COOKIE_NAME)?.value);

    if (!session) {
      return NextResponse.json({ success: true, data: null });
    }

    const accessSession = await MemberAccessService.getMemberAccessSession(session.memberId, session.authenticatedAt);

    return NextResponse.json({ success: true, data: accessSession });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Member Access Session API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const verification = await MemberAccessService.verifyMemberAccess(body);
    const token = createMemberAccessSessionToken({
      memberId: verification.member.id,
      authenticatedAt: verification.authenticatedAt,
    });
    const session = await MemberAccessService.getMemberAccessSession(verification.member.id, verification.authenticatedAt);
    const response = NextResponse.json({ success: true, data: session });

    response.cookies.set(MEMBER_ACCESS_SESSION_COOKIE_NAME, token, buildSessionCookieOptions());

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Member Access Session API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(MEMBER_ACCESS_SESSION_COOKIE_NAME, '', {
    ...buildSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
