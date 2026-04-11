import { createHash, timingSafeEqual } from 'crypto';

export const DOCUMENT_HASH_ALGORITHM = 'sha256';
export const DOCUMENT_HASH_ENCODING = 'hex';
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export type DocumentHashInput =
  | string
  | Buffer
  | Uint8Array
  | Record<string, unknown>
  | unknown[];

export type DocumentCanonicalization = 'raw-bytes' | 'utf8-string' | 'canonical-json';

export type DocumentHashInfo = {
  hash: string;
  algorithm: typeof DOCUMENT_HASH_ALGORITHM;
  encoding: typeof DOCUMENT_HASH_ENCODING;
  canonicalization: DocumentCanonicalization;
  byteLength: number;
};

const normalizeForCanonicalJson = (value: unknown): unknown => {
  if (value === null) return null;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCanonicalJson(item));
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        const nestedValue = record[key];

        if (nestedValue !== undefined) {
          normalized[key] = normalizeForCanonicalJson(nestedValue);
        }

        return normalized;
      }, {});
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('문서 해시 생성 실패: JSON 문서에 Infinity 또는 NaN을 사용할 수 없습니다.');
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return value;
  }

  throw new Error(`문서 해시 생성 실패: 지원하지 않는 값 타입입니다. (${typeof value})`);
};

const toDocumentBuffer = (
  data: DocumentHashInput
): { buffer: Buffer; canonicalization: DocumentCanonicalization } => {
  if (Buffer.isBuffer(data)) {
    return { buffer: data, canonicalization: 'raw-bytes' };
  }

  if (data instanceof Uint8Array) {
    return { buffer: Buffer.from(data), canonicalization: 'raw-bytes' };
  }

  if (typeof data === 'string') {
    return { buffer: Buffer.from(data, 'utf8'), canonicalization: 'utf8-string' };
  }

  return {
    buffer: Buffer.from(JSON.stringify(normalizeForCanonicalJson(data)), 'utf8'),
    canonicalization: 'canonical-json',
  };
};

/**
 * DOCUMENT_HASH_INTEGRITY: 문서 해시와 정규화 메타데이터를 함께 생성합니다.
 */
export const generateDocumentHashInfo = (data: DocumentHashInput): DocumentHashInfo => {
  const { buffer, canonicalization } = toDocumentBuffer(data);

  return {
    hash: createHash(DOCUMENT_HASH_ALGORITHM).update(buffer).digest(DOCUMENT_HASH_ENCODING),
    algorithm: DOCUMENT_HASH_ALGORITHM,
    encoding: DOCUMENT_HASH_ENCODING,
    canonicalization,
    byteLength: buffer.byteLength,
  };
};

export const generateDocumentHash = (data: DocumentHashInput): string => {
  return generateDocumentHashInfo(data).hash;
};

export const isValidSha256Hash = (hash: unknown): hash is string => {
  return typeof hash === 'string' && SHA256_HEX_PATTERN.test(hash);
};

export const safeCompareHashes = (currentHash: unknown, expectedHash: unknown): boolean => {
  if (!isValidSha256Hash(currentHash) || !isValidSha256Hash(expectedHash)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(currentHash, DOCUMENT_HASH_ENCODING),
    Buffer.from(expectedHash, DOCUMENT_HASH_ENCODING)
  );
};

export const verifyIntegrity = (data: DocumentHashInput, expectedHash: string): boolean => {
  return safeCompareHashes(generateDocumentHash(data), expectedHash);
};
