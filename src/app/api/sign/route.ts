import { NextResponse } from 'next/server';
import { SignAuthService } from '../../../services/signAuthService';
import { SignService } from '../../../services/signService';

const getClientIp = (request: Request) => {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    switch (action) {
      case 'REQUEST': {
        const newRequest = await SignService.createRequest({
          ...params,
          ipAddress,
          userAgent,
        });

        return NextResponse.json({ success: true, data: newRequest });
      }

      case 'EXECUTE': {
        const signatureResult = await SignService.executeSignature({
          ...params,
          ipAddress,
          userAgent,
        });

        return NextResponse.json({ success: true, data: signatureResult });
      }

      case 'VERIFY': {
        const verification = await SignService.verifySignature(params);

        return NextResponse.json({ success: true, data: verification });
      }

      case 'AUTH_REQUEST': {
        const authRequest = await SignAuthService.requestAuthentication({
          ...params,
          ipAddress,
          userAgent,
        });

        return NextResponse.json({ success: true, data: authRequest });
      }

      case 'AUTH_STATUS': {
        const authStatus = await SignAuthService.getAuthenticationStatus(params);

        return NextResponse.json({ success: true, data: authStatus });
      }

      case 'AUTH_CANCEL': {
        const cancelledAuth = await SignAuthService.cancelAuthentication({
          ...params,
          ipAddress,
          userAgent,
        });

        return NextResponse.json({ success: true, data: cancelledAuth });
      }

      case 'AUTH_VERIFY': {
        const verifyResult = await SignAuthService.verifyAuthentication({
          ...params,
          ipAddress,
          userAgent,
        });

        return NextResponse.json({ success: true, data: verifyResult });
      }

      case 'AUTH_CALLBACK': {
        const callbackResult = await SignAuthService.receiveCallback({
          ...params,
          ipAddress,
          userAgent,
        });

        return NextResponse.json({ success: true, data: callbackResult });
      }

      default:
        return NextResponse.json(
          { success: false, message: '유효하지 않은 액션입니다.' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Sign API Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
