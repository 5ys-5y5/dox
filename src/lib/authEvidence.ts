import { createHmac } from 'crypto';
import { type DocumentHashInput, generateDocumentHash } from './crypto';

export type ProtectedAuthValue = {
  value: string | null;
  strategy: 'hmac-sha256' | 'sha256' | null;
};

const getEvidenceSecret = () => process.env.AUTH_EVIDENCE_HMAC_SECRET?.trim() || '';

const buildDomainSeparatedPayload = (label: string, value: string) =>
  JSON.stringify({ label, value: value.trim() });

export const hashAuthEvidence = (
  label: string,
  value?: DocumentHashInput | null
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string' && !value.trim()) {
    return null;
  }

  return generateDocumentHash(
    typeof value === 'string' ? buildDomainSeparatedPayload(label, value) : value
  );
};

export const protectIdentityValue = (
  label: string,
  value?: string | null
): ProtectedAuthValue => {
  if (!value?.trim()) {
    return { value: null, strategy: null };
  }

  const payload = buildDomainSeparatedPayload(label, value);
  const secret = getEvidenceSecret();

  if (secret) {
    return {
      value: createHmac('sha256', secret).update(payload).digest('hex'),
      strategy: 'hmac-sha256',
    };
  }

  return {
    value: generateDocumentHash(payload),
    strategy: 'sha256',
  };
};
