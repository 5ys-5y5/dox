type ResendTargetInput = {
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  htmlBody: string;
};

type ResendTargetResult = {
  recipientEmail: string;
  recipientName: string | null;
  ok: boolean;
  status: 'sent' | 'failed' | 'provider_not_configured';
  providerMessageId: string | null;
  failureReason: string | null;
  providerPayloadSummary: Record<string, unknown>;
};

const RESEND_SEND_URL = 'https://api.resend.com/emails';

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail = process.env.REQUEST_LINK_EMAIL_FROM?.trim() || '';

  if (!apiKey || !fromEmail) {
    return null;
  }

  return { apiKey, fromEmail };
};

const sendSingleEmail = async (target: ResendTargetInput) => {
  const config = getResendConfig();

  if (!config) {
    return {
      ok: false as const,
      status: 'provider_not_configured' as const,
      providerMessageId: null,
      failureReason: 'RESEND_API_KEY 또는 REQUEST_LINK_EMAIL_FROM 이 설정되지 않았습니다.',
      providerPayloadSummary: {},
    };
  }

  const response = await fetch(RESEND_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [target.recipientEmail],
      subject: target.subject,
      html: target.htmlBody,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    return {
      ok: false as const,
      status: 'failed' as const,
      providerMessageId: null,
      failureReason: String(payload.message || payload.error || '이메일 발송 실패'),
      providerPayloadSummary: payload,
    };
  }

  return {
    ok: true as const,
    status: 'sent' as const,
    providerMessageId: typeof payload.id === 'string' ? payload.id : null,
    failureReason: null,
    providerPayloadSummary: payload,
  };
};

export const EmailDispatchService = {
  isConfigured() {
    return Boolean(getResendConfig());
  },

  async sendEmailBatch(targets: ResendTargetInput[]) {
    if (targets.length === 0) {
      return {
        ok: false as const,
        status: 'failed' as const,
        successCount: 0,
        failureCount: 0,
        results: [] as ResendTargetResult[],
        providerPayloadSummary: { message: 'targets_empty' },
      };
    }

    if (!this.isConfigured()) {
      return {
        ok: false as const,
        status: 'provider_not_configured' as const,
        successCount: 0,
        failureCount: targets.length,
        results: targets.map((target) => ({
          recipientEmail: target.recipientEmail,
          recipientName: target.recipientName,
          ok: false,
          status: 'provider_not_configured' as const,
          providerMessageId: null,
          failureReason: 'RESEND_API_KEY 또는 REQUEST_LINK_EMAIL_FROM 이 설정되지 않았습니다.',
          providerPayloadSummary: {},
        })),
        providerPayloadSummary: {},
      };
    }

    const results = await Promise.all(
      targets.map(async (target) => {
        const result = await sendSingleEmail(target);

        return {
          recipientEmail: target.recipientEmail,
          recipientName: target.recipientName,
          ok: result.ok,
          status: result.status,
          providerMessageId: result.providerMessageId,
          failureReason: result.failureReason,
          providerPayloadSummary: result.providerPayloadSummary,
        } satisfies ResendTargetResult;
      })
    );

    const successCount = results.filter((item) => item.ok).length;
    const failureCount = results.length - successCount;

    return {
      ok: successCount > 0,
      status: successCount === 0 ? ('failed' as const) : ('sent' as const),
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
