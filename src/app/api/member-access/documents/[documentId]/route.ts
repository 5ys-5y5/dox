import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MEMBER_ACCESS_SESSION_COOKIE_NAME, readMemberAccessSessionToken } from '../../../../../lib/memberAccessSession';
import { MemberAccessService } from '../../../../../services/memberAccessService';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

const readRequiredMemberSession = async () => {
  const cookieStore = await cookies();
  const session = readMemberAccessSessionToken(cookieStore.get(MEMBER_ACCESS_SESSION_COOKIE_NAME)?.value);

  if (!session) {
    throw new Error('구성원 인증이 필요합니다.');
  }

  return session;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const session = await readRequiredMemberSession();
    const access = await MemberAccessService.getMemberDocumentAccess(session.memberId, documentId, session.authenticatedAt);

    return NextResponse.json({ success: true, data: access });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const status = message.includes('인증') ? 401 : message.includes('권한') ? 403 : 500;

    console.error('Member Access Document API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status });
  }
}
