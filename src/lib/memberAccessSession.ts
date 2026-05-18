import { createHmac, timingSafeEqual } from 'crypto';

export const MEMBER_ACCESS_SESSION_COOKIE_NAME = 'member_access_session';

export type MemberAccessSessionPayload = {
  memberId: string;
  authenticatedAt: string;
};

const encodeBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

const decodeBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const getMemberAccessSessionSecret = () => {
  const explicitSecret = process.env.MEMBER_ACCESS_SESSION_SECRET?.trim();

  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (fallbackSecret) {
    return fallbackSecret;
  }

  throw new Error('구성원 세션 서명 비밀값이 없습니다. MEMBER_ACCESS_SESSION_SECRET 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
};

const signValue = (value: string) => createHmac('sha256', getMemberAccessSessionSecret()).update(value).digest('base64url');

export const createMemberAccessSessionToken = (payload: MemberAccessSessionPayload) => {
  const serializedPayload = JSON.stringify(payload);
  const encodedPayload = encodeBase64Url(serializedPayload);
  const signature = signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
};

export const readMemberAccessSessionToken = (token: string | null | undefined): MemberAccessSessionPayload | null => {
  const normalizedToken = (token || '').trim();

  if (!normalizedToken) {
    return null;
  }

  const [encodedPayload, signature] = normalizedToken.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<MemberAccessSessionPayload>;

    if (!parsed.memberId || !parsed.authenticatedAt) {
      return null;
    }

    return {
      memberId: String(parsed.memberId),
      authenticatedAt: String(parsed.authenticatedAt),
    };
  } catch {
    return null;
  }
};
