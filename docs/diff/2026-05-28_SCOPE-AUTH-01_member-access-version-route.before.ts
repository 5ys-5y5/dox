import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MEMBER_ACCESS_SESSION_COOKIE_NAME, readMemberAccessSessionToken } from '../../../../../../lib/memberAccessSession';
import { DocumentService } from '../../../../../../services/documentService';
import { MemberAccessService } from '../../../../../../services/memberAccessService';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

const normalizePhoneNumberParam = (value: string | null) => String(value || '').replace(/[^0-9]/g, '').trim();

const readRequiredMemberSession = async () => {
  const cookieStore = await cookies();
  const session = readMemberAccessSessionToken(cookieStore.get(MEMBER_ACCESS_SESSION_COOKIE_NAME)?.value);

  if (!session) {
    throw new Error('구성원 인증이 필요합니다.');
  }

  return session;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const url = new URL(request.url);
    const requestedPhoneNumber = normalizePhoneNumberParam(url.searchParams.get('phoneNumber') || url.searchParams.get('phone'));
    const session = await readRequiredMemberSession();
    const access = await MemberAccessService.getMemberDocumentAccess(session.memberId, documentId, session.authenticatedAt);

    if (requestedPhoneNumber && normalizePhoneNumberParam(access.member.phoneNumber) !== requestedPhoneNumber) {
      return NextResponse.json(
        { success: false, message: '이 링크는 다른 구성원 번호로 저장할 수 없습니다. 링크에 표시된 휴대폰 번호로 다시 인증해 주세요.' },
        { status: 401 }
      );
    }

    if (access.accessRole !== 'editor') {
      return NextResponse.json({ success: false, message: '이 문서는 편집 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const createdVersion = await DocumentService.createVersion(documentId, {
      ...body,
      createdBy: session.memberId,
    });

    return NextResponse.json({ success: true, data: createdVersion });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const status = message.includes('인증') ? 401 : message.includes('권한') ? 403 : 500;

    console.error('Member Access Document Version API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status });
  }
}
