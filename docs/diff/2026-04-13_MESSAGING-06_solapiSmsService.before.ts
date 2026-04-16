import crypto from 'node:crypto';

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send';

const getSolapiConfig = () => {
  const apiKey = process.env.SOLAPI_API_KEY?.trim() || '';
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim() || '';

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
};

const buildAuthorizationHeader = (apiKey: string, apiSecret: string) => {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
};

export const SolapiSmsService = {
  isConfigured() {
    return Boolean(getSolapiConfig());
  },

  async sendSms(params: { from: string; to: string; text: string }) {
    const config = getSolapiConfig();

    if (!config) {
      return {
        ok: false as const,
        status: 'provider_not_configured' as const,
        failureReason: 'SOLAPI_API_KEY 또는 SOLAPI_API_SECRET 이 설정되지 않았습니다.',
        providerPayloadSummary: {},
      };
    }

    const response = await fetch(SOLAPI_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: buildAuthorizationHeader(config.apiKey, config.apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          from: params.from,
          to: params.to,
          text: params.text,
        },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false as const,
        status: 'failed' as const,
        failureReason: String(payload.message || payload.errorMessage || 'SOLAPI 발송 실패'),
        providerPayloadSummary: payload,
      };
    }

    return {
      ok: true as const,
      status: 'sent' as const,
      providerMessageId:
        typeof payload.messageId === 'string'
          ? payload.messageId
          : typeof payload.groupId === 'string'
            ? payload.groupId
            : null,
      providerPayloadSummary: payload,
    };
  },
};
