export type AuthProviderGroup = 'barocert' | 'mobile_identity';
export type AuthProvider =
  | 'kakao'
  | 'naver'
  | 'toss'
  | 'pass'
  | 'niceid'
  | 'kcb'
  | 'sci';
export type AuthProviderProduct =
  | 'identity'
  | 'user_identity'
  | 'digital_signature'
  | 'mobile_identity';

export type AuthProviderDefinition = {
  key: string;
  providerGroup: AuthProviderGroup;
  provider: AuthProvider;
  defaultProduct: AuthProviderProduct;
  label: string;
  verificationMethod: 'polling' | 'callback' | 'hybrid';
  callbackTransport: 'redirect' | 'server-notify' | 'polling';
  requiredEnv: string[];
};

const PROVIDERS: AuthProviderDefinition[] = [
  {
    key: 'barocert:kakao',
    providerGroup: 'barocert',
    provider: 'kakao',
    defaultProduct: 'identity',
    label: 'BaroCert Kakao',
    verificationMethod: 'polling',
    callbackTransport: 'polling',
    requiredEnv: ['BAROCERT_LINK_ID', 'BAROCERT_SECRET_KEY', 'BAROCERT_CLIENT_CODE'],
  },
  {
    key: 'barocert:naver',
    providerGroup: 'barocert',
    provider: 'naver',
    defaultProduct: 'identity',
    label: 'BaroCert Naver',
    verificationMethod: 'polling',
    callbackTransport: 'polling',
    requiredEnv: ['BAROCERT_LINK_ID', 'BAROCERT_SECRET_KEY', 'BAROCERT_CLIENT_CODE'],
  },
  {
    key: 'barocert:toss',
    providerGroup: 'barocert',
    provider: 'toss',
    defaultProduct: 'user_identity',
    label: 'BaroCert Toss',
    verificationMethod: 'polling',
    callbackTransport: 'polling',
    requiredEnv: ['BAROCERT_LINK_ID', 'BAROCERT_SECRET_KEY', 'BAROCERT_CLIENT_CODE'],
  },
  {
    key: 'mobile_identity:pass',
    providerGroup: 'mobile_identity',
    provider: 'pass',
    defaultProduct: 'mobile_identity',
    label: 'PASS Mobile Identity',
    verificationMethod: 'callback',
    callbackTransport: 'redirect',
    requiredEnv: [
      'MOBILE_IDENTITY_PROVIDER',
      'MOBILE_IDENTITY_SITE_CODE',
      'MOBILE_IDENTITY_SITE_PASSWORD',
      'MOBILE_IDENTITY_RETURN_URL',
      'MOBILE_IDENTITY_ERROR_URL',
    ],
  },
  {
    key: 'mobile_identity:niceid',
    providerGroup: 'mobile_identity',
    provider: 'niceid',
    defaultProduct: 'mobile_identity',
    label: 'NICE Mobile Identity',
    verificationMethod: 'callback',
    callbackTransport: 'redirect',
    requiredEnv: [
      'MOBILE_IDENTITY_PROVIDER',
      'MOBILE_IDENTITY_SITE_CODE',
      'MOBILE_IDENTITY_SITE_PASSWORD',
      'MOBILE_IDENTITY_RETURN_URL',
      'MOBILE_IDENTITY_ERROR_URL',
    ],
  },
];

export const getAuthProviderDefinition = (
  providerGroup: AuthProviderGroup,
  provider: AuthProvider
): AuthProviderDefinition | null => {
  return (
    PROVIDERS.find(
      (definition) =>
        definition.providerGroup === providerGroup && definition.provider === provider
    ) || null
  );
};

export const getAuthProviderConfigState = (
  providerGroup: AuthProviderGroup,
  provider: AuthProvider
) => {
  const definition = getAuthProviderDefinition(providerGroup, provider);

  if (!definition) {
    return {
      configured: false,
      definition: null,
      missingEnv: [],
    };
  }

  const missingEnv = definition.requiredEnv.filter((key) => !process.env[key]);

  return {
    configured: missingEnv.length === 0,
    definition,
    missingEnv,
  };
};
