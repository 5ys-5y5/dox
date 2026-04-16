import { createClient } from '@supabase/supabase-js';
import type {
  SmsDispatchEventDto,
  SmsDispatchRecordDto,
  SmsRecipientCreateInput,
  SmsRecipientRecordDto,
  SmsSendInput,
  SmsSendResult,
  SmsSenderCreateInput,
  SmsSenderRecordDto,
  SmsSettingsDto,
  SmsSettingsUpdateInput,
} from '../lib/messagingDtos';
import { RequestLinkService } from './requestLinkService';
import { SolapiSmsService } from './solapiSmsService';

type SmsSenderRow = {
  id: string;
  phone_number: string;
  display_name: string | null;
  solapi_status: 'registered' | 'unknown';
  is_active: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type SmsRecipientRow = {
  id: string;
  phone_number: string;
  recipient_name: string | null;
  site_id: string | null;
  is_active: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type SmsDispatchRow = {
  id: string;
  request_link_id: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  provider_key: 'solapi';
  provider_message_id: string | null;
  status: SmsDispatchRecordDto['status'];
  message_text: string;
  requested_by: string | null;
  attempted_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type SmsDispatchEventRow = {
  id: string;
  dispatch_id: string;
  event_type: SmsDispatchEventDto['eventType'];
  payload_summary: Record<string, unknown> | null;
  created_at: string;
};

type SmsSettingsRow = {
  id: string;
  default_sender_phone_number: string | null;
  message_prefix: string | null;
  created_at: string;
  updated_at: string;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const MESSAGING_DB_SCHEMA = 'messaging';
const messagingSchema = (client = getSupabase()) => client.schema(MESSAGING_DB_SCHEMA);

// MESSAGING_SCHEMA_BOUNDARY
// 문자 발송 도메인의 정본은 messaging 스키마에만 저장합니다.
// 다른 기능은 messaging 서비스 계약만 호출하고 messaging.* 테이블을 직접 다루지 않습니다.

const normalizePhoneNumber = (value: string) => value.replace(/[^0-9]/g, '').trim();

const toSenderDto = (row: SmsSenderRow): SmsSenderRecordDto => ({
  id: row.id,
  phoneNumber: row.phone_number,
  displayName: row.display_name,
  solapiStatus: row.solapi_status,
  isActive: row.is_active,
  verifiedAt: row.verified_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toRecipientDto = (row: SmsRecipientRow): SmsRecipientRecordDto => ({
  id: row.id,
  phoneNumber: row.phone_number,
  recipientName: row.recipient_name,
  siteId: row.site_id,
  isActive: row.is_active,
  memo: row.memo,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDispatchDto = (row: SmsDispatchRow): SmsDispatchRecordDto => ({
  id: row.id,
  requestLinkId: row.request_link_id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  providerKey: row.provider_key,
  providerMessageId: row.provider_message_id,
  status: row.status,
  messageText: row.message_text,
  requestedBy: row.requested_by,
  attemptedAt: row.attempted_at,
  sentAt: row.sent_at,
  deliveredAt: row.delivered_at,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDispatchEventDto = (row: SmsDispatchEventRow): SmsDispatchEventDto => ({
  id: row.id,
  dispatchId: row.dispatch_id,
  eventType: row.event_type,
  payloadSummary: row.payload_summary || {},
  createdAt: row.created_at,
});

const toSettingsDto = (row: SmsSettingsRow | null): SmsSettingsDto => ({
  defaultSenderPhoneNumber: row?.default_sender_phone_number || process.env.REQUEST_LINK_SMS_DEFAULT_SENDER?.trim() || null,
  messagePrefix: row?.message_prefix || process.env.REQUEST_LINK_SMS_MESSAGE_PREFIX?.trim() || null,
  createdAt: row?.created_at || null,
  updatedAt: row?.updated_at || null,
});

const insertDispatchEvent = async (
  dispatchId: string,
  eventType: SmsDispatchEventDto['eventType'],
  payloadSummary: Record<string, unknown>
) => {
  const { data, error } = await messagingSchema()
    .from('sms_dispatch_events')
    .insert([
      {
        dispatch_id: dispatchId,
        event_type: eventType,
        payload_summary: payloadSummary,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`문자 발송 이벤트 저장 실패: ${error?.message || 'event_insert_failed'}`);
  }

  return toDispatchEventDto(data as SmsDispatchEventRow);
};

export const MessagingService = {
  async getSmsSettings(): Promise<SmsSettingsDto> {
    const { data, error } = await messagingSchema()
      .from('sms_service_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      if (
        error.message.includes('schema cache') ||
        error.message.includes('sms_service_settings') ||
        error.message.includes('relation')
      ) {
        return toSettingsDto(null);
      }

      throw new Error(`문자 발송 설정 조회 실패: ${error.message}`);
    }

    return toSettingsDto((data as SmsSettingsRow | null) || null);
  },

  async updateSmsSettings(input: SmsSettingsUpdateInput): Promise<SmsSettingsDto> {
    const normalizedDefaultSender =
      typeof input.defaultSenderPhoneNumber === 'string'
        ? normalizePhoneNumber(input.defaultSenderPhoneNumber)
        : input.defaultSenderPhoneNumber === null
          ? null
          : undefined;
    const normalizedPrefix =
      typeof input.messagePrefix === 'string' ? input.messagePrefix.trim() || null : input.messagePrefix;

    const { data: existingData, error: existingError } = await messagingSchema()
      .from('sms_service_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(`문자 발송 설정 조회 실패: ${existingError.message}`);
    }

    if (!existingData) {
      const { data, error } = await messagingSchema()
        .from('sms_service_settings')
        .insert([
          {
            default_sender_phone_number: normalizedDefaultSender ?? null,
            message_prefix: normalizedPrefix ?? null,
          },
        ])
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(`문자 발송 설정 저장 실패: ${error?.message || 'settings_insert_failed'}`);
      }

      return toSettingsDto(data as SmsSettingsRow);
    }

    const patch: Record<string, unknown> = {};

    if (normalizedDefaultSender !== undefined) {
      patch.default_sender_phone_number = normalizedDefaultSender;
    }

    if (normalizedPrefix !== undefined) {
      patch.message_prefix = normalizedPrefix;
    }

    const { data, error } = await messagingSchema()
      .from('sms_service_settings')
      .update(patch)
      .eq('id', (existingData as SmsSettingsRow).id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`문자 발송 설정 저장 실패: ${error?.message || 'settings_update_failed'}`);
    }

    return toSettingsDto(data as SmsSettingsRow);
  },

  async createSmsSender(input: SmsSenderCreateInput) {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    if (!phoneNumber) {
      throw new Error('발신번호 등록 실패: phoneNumber가 필요합니다.');
    }

    const { data, error } = await messagingSchema()
      .from('sms_sender_registry')
      .insert([
        {
          phone_number: phoneNumber,
          display_name: input.displayName?.trim() || null,
          solapi_status: 'registered',
          is_active: true,
          verified_at: new Date().toISOString(),
        },
      ])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`발신번호 등록 실패: ${error?.message || 'sender_insert_failed'}`);
    }

    return toSenderDto(data as SmsSenderRow);
  },

  async createSmsRecipient(input: SmsRecipientCreateInput) {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    if (!phoneNumber) {
      throw new Error('수신번호 등록 실패: phoneNumber가 필요합니다.');
    }

    const { data, error } = await messagingSchema()
      .from('sms_recipient_registry')
      .insert([
        {
          phone_number: phoneNumber,
          recipient_name: input.recipientName?.trim() || null,
          site_id: input.siteId?.trim() || null,
          memo: input.memo?.trim() || null,
          is_active: true,
        },
      ])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`수신번호 등록 실패: ${error?.message || 'recipient_insert_failed'}`);
    }

    return toRecipientDto(data as SmsRecipientRow);
  },

  async listSmsSenders() {
    const { data, error } = await messagingSchema()
      .from('sms_sender_registry')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`발신번호 조회 실패: ${error.message}`);
    }

    return (data || []).map((row) => toSenderDto(row as SmsSenderRow));
  },

  async listSmsRecipients() {
    const { data, error } = await messagingSchema()
      .from('sms_recipient_registry')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`수신번호 조회 실패: ${error.message}`);
    }

    return (data || []).map((row) => toRecipientDto(row as SmsRecipientRow));
  },

  async sendSms(input: SmsSendInput): Promise<SmsSendResult> {
    const senderId = input.senderId?.trim() || '';
    const recipientId = input.recipientId.trim();
    const messageText = input.messageText.trim();
    const requestLinkId = input.requestLinkId?.trim() || null;

    if (!recipientId || !messageText) {
      throw new Error('문자 발송 실패: recipientId, messageText가 필요합니다.');
    }

    if (requestLinkId) {
      await RequestLinkService.getRequestLinkById(requestLinkId);
    }

    const settings = await this.getSmsSettings();
    const recipientLookup = messagingSchema()
      .from('sms_recipient_registry')
      .select('*')
      .eq('id', recipientId)
      .eq('is_active', true)
      .single();
    const senderLookup = senderId
      ? messagingSchema().from('sms_sender_registry').select('*').eq('id', senderId).eq('is_active', true).single()
      : settings.defaultSenderPhoneNumber
        ? messagingSchema()
            .from('sms_sender_registry')
            .select('*')
            .eq('phone_number', normalizePhoneNumber(settings.defaultSenderPhoneNumber))
            .eq('is_active', true)
            .single()
        : Promise.resolve({ data: null, error: null });

    const [{ data: senderData, error: senderError }, { data: recipientData, error: recipientError }] =
      await Promise.all([senderLookup, recipientLookup]);

    if (senderError || !senderData) {
      throw new Error(`문자 발송 실패: 발신번호를 찾을 수 없습니다. (${senderError?.message || 'sender_not_found'})`);
    }

    if (recipientError || !recipientData) {
      throw new Error(`문자 발송 실패: 수신번호를 찾을 수 없습니다. (${recipientError?.message || 'recipient_not_found'})`);
    }

    const sender = senderData as SmsSenderRow;
    const recipient = recipientData as SmsRecipientRow;

    const { data: dispatchData, error: dispatchError } = await messagingSchema()
      .from('sms_dispatch_registry')
      .insert([
        {
          request_link_id: requestLinkId,
          sender_id: sender.id,
          recipient_id: recipient.id,
          provider_key: 'solapi',
          status: 'queued',
          message_text: messageText,
          requested_by: input.requestedBy?.trim() || null,
        },
      ])
      .select('*')
      .single();

    if (dispatchError || !dispatchData) {
      throw new Error(`문자 발송 실패: dispatch 저장 실패 (${dispatchError?.message || 'dispatch_insert_failed'})`);
    }

    const dispatch = dispatchData as SmsDispatchRow;
    const events: SmsDispatchEventDto[] = [];
    events.push(
      await insertDispatchEvent(dispatch.id, 'dispatch_requested', {
        requestLinkId,
        senderId: sender.id,
        recipientId: recipient.id,
      })
    );

    await messagingSchema()
      .from('sms_dispatch_registry')
      .update({
        status: 'sending',
        attempted_at: new Date().toISOString(),
      })
      .eq('id', dispatch.id);

    const sendResult = await SolapiSmsService.sendSms({
      from: sender.phone_number,
      to: recipient.phone_number,
      text: messageText,
    });

    if (!sendResult.ok) {
      const failureStatus =
        sendResult.status === 'provider_not_configured' ? 'provider_not_configured' : 'failed';

      const { data: failedData, error: failedError } = await messagingSchema()
        .from('sms_dispatch_registry')
        .update({
          status: failureStatus,
          failure_reason: sendResult.failureReason,
        })
        .eq('id', dispatch.id)
        .select('*')
        .single();

      if (failedError || !failedData) {
        throw new Error(`문자 발송 실패 후 상태 저장 오류: ${failedError?.message || 'dispatch_failed_update_error'}`);
      }

      events.push(
        await insertDispatchEvent(dispatch.id, 'dispatch_failed', {
          failureReason: sendResult.failureReason,
          providerPayloadSummary: sendResult.providerPayloadSummary || {},
        })
      );

      return {
        dispatch: toDispatchDto(failedData as SmsDispatchRow),
        events,
      };
    }

    const { data: sentData, error: sentError } = await messagingSchema()
      .from('sms_dispatch_registry')
      .update({
        status: 'sent',
        provider_message_id: sendResult.providerMessageId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', dispatch.id)
      .select('*')
      .single();

    if (sentError || !sentData) {
      throw new Error(`문자 발송 성공 후 상태 저장 오류: ${sentError?.message || 'dispatch_sent_update_error'}`);
    }

    events.push(
      await insertDispatchEvent(dispatch.id, 'provider_response', {
        providerMessageId: sendResult.providerMessageId,
        providerPayloadSummary: sendResult.providerPayloadSummary || {},
      })
    );

    return {
      dispatch: toDispatchDto(sentData as SmsDispatchRow),
      events,
    };
  },
};
