import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MEMBER_ACCESS_SESSION_COOKIE_NAME, readMemberAccessSessionToken } from '../../../../../../lib/memberAccessSession';
import { MemberAccessService } from '../../../../../../services/memberAccessService';
import { SignService } from '../../../../../../services/signService';

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

const getClientIp = (request: Request) =>
  request.headers.get('x-forwarded-for') ||
  request.headers.get('x-real-ip') ||
  request.headers.get('cf-connecting-ip') ||
  'unknown';

const getDocumentContentForSignatureRequest = (
  access: Awaited<ReturnType<typeof MemberAccessService.getMemberDocumentAccess>>,
  requestedAt: string | null
) => {
  const requestedAtTime = requestedAt ? new Date(requestedAt).getTime() : Number.NaN;
  const requestVersion =
    Number.isNaN(requestedAtTime)
      ? null
      : access.detail.versions
          .filter((version) => {
            const versionTime = new Date(version.createdAt).getTime();
            return version.htmlCanonical?.trim() && !Number.isNaN(versionTime) && versionTime <= requestedAtTime;
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;

  return requestVersion?.htmlCanonical || access.detail.latestVersion?.htmlCanonical || '';
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const url = new URL(request.url);
    const requestedPhoneNumber = normalizePhoneNumberParam(url.searchParams.get('phoneNumber') || url.searchParams.get('phone'));
    const session = await readRequiredMemberSession();
    const access = await MemberAccessService.getMemberDocumentAccess(session.memberId, documentId, session.authenticatedAt);
    const sessionPhoneNumber = normalizePhoneNumberParam(access.member.phoneNumber);

    if (requestedPhoneNumber && sessionPhoneNumber !== requestedPhoneNumber) {
      return NextResponse.json(
        { success: false, message: '이 링크는 다른 구성원 번호로 서명할 수 없습니다. 링크에 표시된 휴대폰 번호로 다시 인증해 주세요.' },
        { status: 401 }
      );
    }

    if (access.accessRole !== 'signer' && access.accessRole !== 'editor') {
      return NextResponse.json({ success: false, message: '이 문서는 서명 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const requestId = String(body?.requestId || '').trim();
    const signatureImagePath = String(body?.signatureImagePath || '').trim();
    const consentText = typeof body?.consentText === 'string' ? body.consentText : undefined;

    if (!requestId) {
      return NextResponse.json({ success: false, message: '서명 요청 ID가 필요합니다.' }, { status: 400 });
    }

    if (!signatureImagePath) {
      return NextResponse.json({ success: false, message: '서명 이미지가 필요합니다.' }, { status: 400 });
    }

    const signatureEvidence = access.detail.signatureEvidence.find((item) => item.requestId === requestId) || null;

    if (!signatureEvidence) {
      return NextResponse.json({ success: false, message: '이 구성원에게 배정된 서명 요청을 찾을 수 없습니다.' }, { status: 403 });
    }

    if (signatureEvidence.status === 'completed') {
      return NextResponse.json({ success: false, message: '이미 완료된 서명 요청입니다.' }, { status: 409 });
    }

    const evidencePhoneNumber = normalizePhoneNumberParam(signatureEvidence.signerPhoneNumber);
    const signerName = String(signatureEvidence.signerName || '').trim();
    const memberName = String(access.member.displayName || '').trim();
    const matchesSigner =
      evidencePhoneNumber ? evidencePhoneNumber === sessionPhoneNumber : !signerName || !memberName || signerName === memberName;

    if (!matchesSigner) {
      return NextResponse.json({ success: false, message: '현재 인증된 구성원은 이 서명 요청의 대상자가 아닙니다.' }, { status: 403 });
    }

    const documentContent = getDocumentContentForSignatureRequest(access, signatureEvidence.requestedAt);

    if (!documentContent.trim()) {
      return NextResponse.json({ success: false, message: '서명할 문서 본문을 찾을 수 없습니다.' }, { status: 409 });
    }

    const signature = await SignService.executeSignature({
      requestId,
      documentContent,
      signatureImagePath,
      consentText,
      signerId: session.memberId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      allowDocumentHashMismatch: true,
    });

    return NextResponse.json({ success: true, data: signature });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const status = message.includes('인증') ? 401 : message.includes('권한') ? 403 : 500;

    console.error('Member Access Document Signature API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status });
  }
}
