import crypto from 'node:crypto';

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send';
const SOLAPI_MESSAGE_LIST_URL = 'https://api.solapi.com/messages/v4/list';
const SOLAPI_GROUP_LIST_URL = 'https://api.solapi.com/messages/v4/groups';

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
  providerGroupId: string | null;
  failureReason: string | null;
  providerPayloadSummary: Record<string, unknown>;
};

type SolapiMessageLookupResult = {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'failed';
  statusCode: string | null;
  reason: string | null;
  raw: Record<string, unknown>;
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
    providerMessageId: typeof payload.messageId === 'string' ? payload.messageId : null,
    providerGroupId: typeof payload.groupId === 'string' ? payload.groupId : null,
    providerPayloadSummary: {
      ...payload,
      messageId: typeof payload.messageId === 'string' ? payload.messageId : null,
      groupId: typeof payload.groupId === 'string' ? payload.groupId : null,
    },
  };
};

const buildLookupUrl = (baseUrl: string, criteria: string, value: string) => {
  const params = new URLSearchParams();
  params.set('criteria', criteria);
  params.set('cond', 'eq');
  params.set('value', value);
  params.set('limit', '1');

  return `${baseUrl}?${params.toString()}`;
};

const extractObjectList = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      const list = value.filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)
      );

      if (list.length > 0) {
        return list;
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const list = Object.values(value as Record<string, unknown>).filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)
      );

      if (list.length > 0) {
        return list;
      }
    }
  }

  return [] as Record<string, unknown>[];
};

const toNumberOrZero = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const mapMessageLookupEntry = (providerMessageId: string, entry: Record<string, unknown>) => {
  const statusCode = typeof entry.statusCode === 'string' ? entry.statusCode : null;
  const rawStatus = typeof entry.status === 'string' ? entry.status.toUpperCase() : '';
  const reason = typeof entry.reason === 'string' ? entry.reason : null;

  let status: SolapiMessageLookupResult['status'] = 'sent';

  if (statusCode === '4000' || rawStatus === 'COMPLETE') {
    status = 'delivered';
  } else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED' || (statusCode && statusCode !== '4000')) {
    status = 'failed';
  }

  return {
    providerMessageId,
    status,
    statusCode,
    reason,
    raw: entry,
  } satisfies SolapiMessageLookupResult;
};

const mapGroupLookupEntry = (providerMessageId: string, entry: Record<string, unknown>) => {
  const statusCode = typeof entry.statusCode === 'string' ? entry.statusCode : null;
  const rawStatus = typeof entry.status === 'string' ? entry.status.toUpperCase() : '';
  const reason =
    typeof entry.reason === 'string'
      ? entry.reason
      : typeof entry.statusMessage === 'string'
        ? entry.statusMessage
        : null;
  const count =
    entry.count && typeof entry.count === 'object' && !Array.isArray(entry.count)
      ? (entry.count as Record<string, unknown>)
      : {};
  const sentSuccess = toNumberOrZero(count.sentSuccess ?? count.registeredSuccess);
  const sentFailed = toNumberOrZero(count.sentFailed ?? count.registeredFailed);

  let status: SolapiMessageLookupResult['status'] = 'sent';

  if ((rawStatus === 'COMPLETE' || statusCode === '4000') && sentSuccess > 0 && sentFailed === 0) {
    status = 'delivered';
  } else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED' || sentFailed > 0) {
    status = 'failed';
  }

  return {
    providerMessageId,
    status,
    statusCode,
    reason,
    raw: {
      ...entry,
      lookupMode: 'group',
      sentSuccess,
      sentFailed,
    },
  } satisfies SolapiMessageLookupResult;
};

const requestSolapiLookup = async (
  apiKey: string,
  apiSecret: string,
  url: string
): Promise<{ ok: boolean; payload: Record<string, unknown>; responseStatus: number }> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthorizationHeader(apiKey, apiSecret),
      'Content-Type': 'application/json',
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    ok: response.ok,
    payload,
    responseStatus: response.status,
  };
};

const lookupSingleProviderId = async (apiKey: string, apiSecret: string, providerMessageId: string) => {
  const normalizedId = providerMessageId.trim();

  if (!normalizedId) {
    return null;
  }

  const preferredCriteria = normalizedId.toLowerCase().startsWith('g') ? 'groupId' : 'messageId';
  const fallbackCriteria = preferredCriteria === 'groupId' ? 'messageId' : 'groupId';

  const attempts = [
    {
      criteria: preferredCriteria,
      url: buildLookupUrl(
        preferredCriteria === 'groupId' ? SOLAPI_GROUP_LIST_URL : SOLAPI_MESSAGE_LIST_URL,
        preferredCriteria,
        normalizedId
      ),
    },
    {
      criteria: fallbackCriteria,
      url: buildLookupUrl(
        fallbackCriteria === 'groupId' ? SOLAPI_GROUP_LIST_URL : SOLAPI_MESSAGE_LIST_URL,
        fallbackCriteria,
        normalizedId
      ),
    },
  ];

  const debugPayloads: Record<string, unknown>[] = [];

  for (const attempt of attempts) {
    const response = await requestSolapiLookup(apiKey, apiSecret, attempt.url);
    debugPayloads.push({
      criteria: attempt.criteria,
      responseStatus: response.responseStatus,
      ok: response.ok,
      payload: response.payload,
    });

    if (!response.ok) {
      continue;
    }

    const entries =
      attempt.criteria === 'groupId'
        ? extractObjectList(response.payload, ['groupList', 'data'])
        : extractObjectList(response.payload, ['messageList', 'data']);

    if (entries.length === 0) {
      continue;
    }

    const entry = entries[0];

    return attempt.criteria === 'groupId'
      ? {
          result: mapGroupLookupEntry(normalizedId, entry),
          debugPayloads,
        }
      : {
          result: mapMessageLookupEntry(normalizedId, entry),
          debugPayloads,
        };
  }

  return {
    result: null,
    debugPayloads,
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
          providerGroupId: null,
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
          providerGroupId: response.ok ? response.providerGroupId : null,
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

  async lookupMessagesByProviderIds(providerMessageIds: string[]) {
    const config = getSolapiConfig();

    if (!config) {
      return {
        ok: false as const,
        status: 'provider_not_configured' as const,
        results: [] as SolapiMessageLookupResult[],
        providerPayloadSummary: {},
      };
    }

    const dedupedIds = Array.from(new Set(providerMessageIds.map((item) => item.trim()).filter(Boolean)));

    if (dedupedIds.length === 0) {
      return {
        ok: true as const,
        status: 'sent' as const,
        results: [] as SolapiMessageLookupResult[],
        providerPayloadSummary: { message: 'provider_message_ids_empty' },
      };
    }

    const lookupResponses = await Promise.all(
      dedupedIds.map(async (providerMessageId) => lookupSingleProviderId(config.apiKey, config.apiSecret, providerMessageId))
    );

    const results = lookupResponses.flatMap((item) => (item?.result ? [item.result] : []));
    const providerPayloadSummary = {
      lookups: lookupResponses.map((item, index) => ({
        providerMessageId: dedupedIds[index],
        matched: Boolean(item?.result),
        debugPayloads: item?.debugPayloads || [],
      })),
    };

    return {
      ok: true as const,
      status: 'sent' as const,
      results,
      providerPayloadSummary,
    };
  },
};
