export const MEMBER_ACCESS_SCHEMA_SETUP_MESSAGE =
  '구성원 기능을 쓰려면 docs/run-this-supabase-member-access-schema.sql 최신본을 Supabase SQL Editor에서 다시 실행해야 합니다.';

export const formatMemberAccessErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' && error.trim() ? error.trim() : fallbackMessage;

  if (
    message.includes('Invalid schema: member_access') ||
    message.includes('member_access_') ||
    message.includes('Could not find the function')
  ) {
    return MEMBER_ACCESS_SCHEMA_SETUP_MESSAGE;
  }

  return message || fallbackMessage;
};
