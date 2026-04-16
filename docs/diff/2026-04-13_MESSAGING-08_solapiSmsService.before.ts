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

type SolapiBatchTargetInput = {
  recipientId: string;
  to: string;
  text: string;
};

type SolapiBatchTargetResult = {
  recipientId: string;
  to: string;
  ok: boolean;
  status: 'sent' | 'failed' | 'provider_not_configured';
  providerMessageId: string | null;
  failureReason: string | null;
  providerPayloadSummary: Record<string, unknown>;
};

const sendSingleSms = async (params: { from: string; to: string; text: string }) => {
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
};

export const SolapiSmsService = {
  isConfigured() {
    return Boolean(getSolapiConfig());
  },

  async sendSms(params: { from: string; to: string; text: string }) {
    return sendSingleSms(params);
  },

  // SOLAPI bulk/group APIs also support multi-recipient sends, but the messaging domain
  // keeps per-recipient success/failure records as its source of truth. A one-click batch
  // therefore fans out to exact recipient-level requests so later services can reuse the
  // same dispatch/target history without ambiguity.
  async sendSmsBatch(params: { from: string; targets: SolapiBatchTargetInput[] }) {
    if (params.targets.length === 0) {
      return {
        ok: false as const,
        status: 'failed' as const,
        successCount: 0,
        failureCount: 0,
        results: [] as SolapiBatchTargetResult[],
        providerPayloadSummary: { message: 'targets_empty' },
      };
    }

    if (!this.isConfigured()) {
      return {
        ok: false as const,
        status: 'provider_not_configured' as const,
        successCount: 0,
        failureCount: params.targets.length,
        results: params.targets.map((target) => ({
          recipientId: target.recipientId,
          to: target.to,
          ok: false,
          status: 'provider_not_configured' as const,
          providerMessageId: null,
          failureReason: 'SOLAPI_API_KEY 또는 SOLAPI_API_SECRET 이 설정되지 않았습니다.',
          providerPayloadSummary: {},
        })),
        providerPayloadSummary: {},
      };
    }

    const results = await Promise.all(
      params.targets.map(async (target) => {
        const response = await sendSingleSms({
          from: params.from,
          to: target.to,
          text: target.text,
        });

        return {
          recipientId: target.recipientId,
          to: target.to,
          ok: response.ok,
          status: response.status,
          providerMessageId: response.ok ? response.providerMessageId : null,
          failureReason: response.ok ? null : response.failureReason,
          providerPayloadSummary: response.providerPayloadSummary || {},
        } satisfies SolapiBatchTargetResult;
      })
    );

    const successCount = results.filter((item) => item.ok).length;
    const failureCount = results.length - successCount;

    return {
      ok: successCount > 0,
      status:
        successCount === 0
          ? ('failed' as const)
          : failureCount > 0
            ? ('sent' as const)
            : ('sent' as const),
      successCount,
      failureCount,
      results,
      providerPayloadSummary: {
        targetCount: results.length,
        successCount,
        failureCount,
      },
    };
  },
};
