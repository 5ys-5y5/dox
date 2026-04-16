import { createClient } from '@supabase/supabase-js';
import type {
  SmsSyncInput,
  SmsSyncResult,
  SmsDispatchHistoryItemDto,
  EmailDispatchEventDto,
  EmailDispatchRecordDto,
  EmailDispatchTargetDto,
  EmailSendInput,
  EmailSendResult,
  SmsDispatchEventDto,
  SmsDispatchRecordDto,
  SmsDispatchTargetDto,
  SmsRecipientCreateInput,
  SmsRecipientRecordDto,
  SmsSendInput,
  SmsSendResult,
  SmsSenderCreateInput,
  SmsSenderRecordDto,
  SmsSettingsDto,
  SmsSettingsUpdateInput,
} from '../lib/messagingDtos';
import { EmailDispatchService } from './emailDispatchService';
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
  recipient_count?: number | null;
  sent_count?: number | null;
  failed_count?: number | null;
  requested_by: string | null;
  attempted_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type SmsDispatchTargetRow = {
  id: string;
  dispatch_id: string;
  recipient_id: string | null;
  recipient_phone_number: string;
  recipient_name: string | null;
  provider_message_id: string | null;
  status: SmsDispatchTargetDto['status'];
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

type EmailDispatchRow = {
  id: string;
  request_link_id: string | null;
  provider_key: 'resend';
  provider_message_id: string | null;
  status: EmailDispatchRecordDto['status'];
  subject: string;
  html_body: string;
  recipient_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
  requested_by: string | null;
  attempted_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type EmailDispatchTargetRow = {
  id: string;
  dispatch_id: string;
  request_link_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  provider_message_id: string | null;
  status: EmailDispatchTargetDto['status'];
  sent_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type EmailDispatchEventRow = {
  id: string;
  dispatch_id: string;
  event_type: EmailDispatchEventDto['eventType'];
  payload_summary: Record<string, unknown> | null;
  created_at: string;
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
  recipientCount: row.recipient_count ?? (row.recipient_id ? 1 : 0),
  sentCount: row.sent_count ?? (row.status === 'sent' ? 1 : 0),
  failedCount:
    row.failed_count ??
    (row.status === 'failed' || row.status === 'provider_not_configured' || row.status === 'recipient_not_registered'
      ? 1
      : 0),
  requestedBy: row.requested_by,
  attemptedAt: row.attempted_at,
  sentAt: row.sent_at,
  deliveredAt: row.delivered_at,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDispatchTargetDto = (row: SmsDispatchTargetRow): SmsDispatchTargetDto => ({
  id: row.id,
  dispatchId: row.dispatch_id,
  recipientId: row.recipient_id,
  recipientPhoneNumber: row.recipient_phone_number,
  recipientName: row.recipient_name,
  providerMessageId: row.provider_message_id,
  status: row.status,
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

const toEmailDispatchDto = (row: EmailDispatchRow): EmailDispatchRecordDto => ({
  id: row.id,
  requestLinkId: row.request_link_id,
  providerKey: row.provider_key,
  providerMessageId: row.provider_message_id,
  status: row.status,
  subject: row.subject,
  htmlBody: row.html_body,
  recipientCount: row.recipient_count ?? 1,
  sentCount: row.sent_count ?? (row.status === 'sent' ? 1 : 0),
  failedCount:
    row.failed_count ??
    (row.status === 'failed' || row.status === 'provider_not_configured' || row.status === 'recipient_not_registered'
      ? 1
      : 0),
  requestedBy: row.requested_by,
  attemptedAt: row.attempted_at,
  sentAt: row.sent_at,
  deliveredAt: row.delivered_at,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toEmailDispatchTargetDto = (row: EmailDispatchTargetRow): EmailDispatchTargetDto => ({
  id: row.id,
  dispatchId: row.dispatch_id,
  requestLinkId: row.request_link_id,
  recipientEmail: row.recipient_email,
  recipientName: row.recipient_name,
  providerMessageId: row.provider_message_id,
  status: row.status,
  sentAt: row.sent_at,
  deliveredAt: row.delivered_at,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toEmailDispatchEventDto = (row: EmailDispatchEventRow): EmailDispatchEventDto => ({
  id: row.id,
  dispatchId: row.dispatch_id,
  eventType: row.event_type,
  payloadSummary: row.payload_summary || {},
  createdAt: row.created_at,
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

const insertEmailDispatchEvent = async (
  dispatchId: string,
  eventType: EmailDispatchEventDto['eventType'],
  payloadSummary: Record<string, unknown>
) => {
  const { data, error } = await messagingSchema()
    .from('email_dispatch_events')
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
    throw new Error(`이메일 발송 이벤트 저장 실패: ${error?.message || 'event_insert_failed'}`);
  }

  return toEmailDispatchEventDto(data as EmailDispatchEventRow);
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

  async listSmsDispatches(limit = 12): Promise<SmsDispatchHistoryItemDto[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 50)) : 12;

    const { data: dispatchData, error: dispatchError } = await messagingSchema()
      .from('sms_dispatch_registry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (dispatchError) {
      throw new Error(`문자 발송 이력 조회 실패: ${dispatchError.message}`);
    }

    const dispatches = (dispatchData || []).map((row) => toDispatchDto(row as SmsDispatchRow));

    if (dispatches.length === 0) {
      return [];
    }

    const dispatchIds = dispatches.map((item) => item.id);
    const { data: targetData, error: targetError } = await messagingSchema()
      .from('sms_dispatch_targets')
      .select('*')
      .in('dispatch_id', dispatchIds)
      .order('created_at', { ascending: true });

    if (targetError) {
      throw new Error(`문자 발송 이력 target 조회 실패: ${targetError.message}`);
    }

    const groupedTargets = new Map<string, SmsDispatchTargetDto[]>();

    for (const row of targetData || []) {
      const target = toDispatchTargetDto(row as SmsDispatchTargetRow);
      const bucket = groupedTargets.get(target.dispatchId) || [];
      bucket.push(target);
      groupedTargets.set(target.dispatchId, bucket);
    }

    return dispatches.map((dispatch) => ({
      dispatch,
      targets: groupedTargets.get(dispatch.id) || [],
    }));
  },

  async sendSms(input: SmsSendInput): Promise<SmsSendResult> {
    const senderId = input.senderId?.trim() || '';
    const recipientIds = Array.from(
      new Set(
        [input.recipientId || null, ...(input.recipientIds || [])]
          .map((value) => value?.trim() || '')
          .filter(Boolean)
      )
    );
    const messageText = input.messageText.trim();
    const requestLinkId = input.requestLinkId?.trim() || null;

    if (recipientIds.length === 0 || !messageText) {
      throw new Error('문자 발송 실패: recipientIds, messageText가 필요합니다.');
    }

    if (requestLinkId) {
      await RequestLinkService.getRequestLinkById(requestLinkId);
    }

    const settings = await this.getSmsSettings();
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
    const recipientLookup = messagingSchema()
      .from('sms_recipient_registry')
      .select('*')
      .in('id', recipientIds)
      .eq('is_active', true);

    const [{ data: senderData, error: senderError }, { data: recipientData, error: recipientError }] =
      await Promise.all([senderLookup, recipientLookup]);

    if (senderError || !senderData) {
      throw new Error(`문자 발송 실패: 발신번호를 찾을 수 없습니다. (${senderError?.message || 'sender_not_found'})`);
    }

    if (recipientError || !recipientData || recipientData.length === 0) {
      throw new Error(`문자 발송 실패: 수신번호를 찾을 수 없습니다. (${recipientError?.message || 'recipient_not_found'})`);
    }

    const sender = senderData as SmsSenderRow;
    const recipients = (recipientData as SmsRecipientRow[]).sort(
      (left, right) => recipientIds.indexOf(left.id) - recipientIds.indexOf(right.id)
    );
    const foundRecipientIds = new Set(recipients.map((item) => item.id));
    const missingRecipientIds = recipientIds.filter((item) => !foundRecipientIds.has(item));

    if (missingRecipientIds.length > 0) {
      throw new Error(`문자 발송 실패: 일부 수신번호를 찾을 수 없습니다. (${missingRecipientIds.join(', ')})`);
    }

    const { data: dispatchData, error: dispatchError } = await messagingSchema()
      .from('sms_dispatch_registry')
      .insert([
        {
          request_link_id: requestLinkId,
          sender_id: sender.id,
          recipient_id: recipientIds.length === 1 ? recipientIds[0] : null,
          provider_key: 'solapi',
          status: 'queued',
          message_text: messageText,
          recipient_count: recipients.length,
          sent_count: 0,
          failed_count: 0,
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
    const { data: targetData, error: targetError } = await messagingSchema()
      .from('sms_dispatch_targets')
      .insert(
        recipients.map((recipient) => ({
          dispatch_id: dispatch.id,
          recipient_id: recipient.id,
          recipient_phone_number: recipient.phone_number,
          recipient_name: recipient.recipient_name,
          status: 'queued',
        }))
      )
      .select('*');

    if (targetError || !targetData) {
      throw new Error(`문자 발송 실패: dispatch target 저장 실패 (${targetError?.message || 'targets_insert_failed'})`);
    }

    let targets = (targetData || []).map((row) => toDispatchTargetDto(row as SmsDispatchTargetRow));
    events.push(
      await insertDispatchEvent(dispatch.id, 'dispatch_requested', {
        requestLinkId,
        senderId: sender.id,
        recipientIds,
        recipientCount: recipients.length,
      })
    );

    await messagingSchema()
      .from('sms_dispatch_registry')
      .update({
        status: 'sending',
        attempted_at: new Date().toISOString(),
      })
      .eq('id', dispatch.id);

    await messagingSchema()
      .from('sms_dispatch_targets')
      .update({
        status: 'sending',
      })
      .eq('dispatch_id', dispatch.id);

    const sendResult = await SolapiSmsService.sendSmsBatch({
      from: sender.phone_number,
      targets: recipients.map((recipient) => ({
        recipientId: recipient.id,
        to: recipient.phone_number,
        text: messageText,
      })),
    });

    const targetPatchResults = await Promise.all(
      sendResult.results.map(async (result) => {
        const { data, error } = await messagingSchema()
          .from('sms_dispatch_targets')
          .update({
            provider_message_id: result.providerMessageId ?? result.providerGroupId,
            status: result.status,
            failure_reason: result.failureReason,
            sent_at: result.ok ? new Date().toISOString() : null,
          })
          .eq('dispatch_id', dispatch.id)
          .eq('recipient_id', result.recipientId)
          .select('*')
          .single();

        if (error || !data) {
          throw new Error(`문자 발송 target 상태 저장 오류: ${error?.message || 'target_update_error'}`);
        }

        return toDispatchTargetDto(data as SmsDispatchTargetRow);
      })
    );

    targets = targetPatchResults;

    if (sendResult.successCount === 0) {
      const failureStatus = sendResult.status === 'provider_not_configured' ? 'provider_not_configured' : 'failed';

      const { data: failedData, error: failedError } = await messagingSchema()
        .from('sms_dispatch_registry')
        .update({
          status: failureStatus,
          sent_count: 0,
          failed_count: recipients.length,
          failure_reason: '모든 수신번호 발송 실패',
        })
        .eq('id', dispatch.id)
        .select('*')
        .single();

      if (failedError || !failedData) {
        throw new Error(`문자 발송 실패 후 상태 저장 오류: ${failedError?.message || 'dispatch_failed_update_error'}`);
      }

      events.push(
        await insertDispatchEvent(dispatch.id, 'dispatch_failed', {
          failureReason: '모든 수신번호 발송 실패',
          recipientCount: recipients.length,
          targetResults: sendResult.results.map((item) => ({
            recipientId: item.recipientId,
            status: item.status,
            providerMessageId: item.providerMessageId,
            providerGroupId: item.providerGroupId,
            failureReason: item.failureReason,
            providerPayloadSummary: item.providerPayloadSummary || {},
          })),
          providerPayloadSummary: sendResult.providerPayloadSummary || {},
        })
      );

      return {
        dispatch: toDispatchDto(failedData as SmsDispatchRow),
        targets,
        events,
      };
    }

    const { data: sentData, error: sentError } = await messagingSchema()
      .from('sms_dispatch_registry')
      .update({
        status: 'sent',
        provider_message_id:
          sendResult.results.length === 1
            ? (sendResult.results[0]?.providerMessageId ?? sendResult.results[0]?.providerGroupId ?? null)
            : null,
        sent_count: sendResult.successCount,
        failed_count: sendResult.failureCount,
        sent_at: new Date().toISOString(),
        failure_reason: sendResult.failureCount > 0 ? `${sendResult.failureCount}건 발송 실패` : null,
      })
      .eq('id', dispatch.id)
      .select('*')
      .single();

    if (sentError || !sentData) {
      throw new Error(`문자 발송 성공 후 상태 저장 오류: ${sentError?.message || 'dispatch_sent_update_error'}`);
    }

    events.push(
      await insertDispatchEvent(dispatch.id, 'provider_response', {
        recipientCount: recipients.length,
        successCount: sendResult.successCount,
        failureCount: sendResult.failureCount,
        targetResults: sendResult.results.map((item) => ({
          recipientId: item.recipientId,
          status: item.status,
          providerMessageId: item.providerMessageId,
          providerGroupId: item.providerGroupId,
          failureReason: item.failureReason,
          providerPayloadSummary: item.providerPayloadSummary || {},
        })),
        providerPayloadSummary: sendResult.providerPayloadSummary || {},
      })
    );

    return {
      dispatch: toDispatchDto(sentData as SmsDispatchRow),
      targets,
      events,
    };
  },

  async syncSmsDispatchStatus(input: SmsSyncInput): Promise<SmsSyncResult> {
    const dispatchId = input.dispatchId.trim();

    if (!dispatchId) {
      throw new Error('문자 상태 동기화 실패: dispatchId가 필요합니다.');
    }

    const [{ data: dispatchData, error: dispatchError }, { data: targetData, error: targetError }] = await Promise.all([
      messagingSchema().from('sms_dispatch_registry').select('*').eq('id', dispatchId).single(),
      messagingSchema().from('sms_dispatch_targets').select('*').eq('dispatch_id', dispatchId).order('created_at', { ascending: true }),
    ]);

    if (dispatchError || !dispatchData) {
      throw new Error(`문자 상태 동기화 실패: dispatch 조회 실패 (${dispatchError?.message || 'dispatch_not_found'})`);
    }

    if (targetError) {
      throw new Error(`문자 상태 동기화 실패: target 조회 실패 (${targetError.message})`);
    }

    const existingTargets = (targetData || []).map((row) => toDispatchTargetDto(row as SmsDispatchTargetRow));
    const providerMessageIds = existingTargets.map((item) => item.providerMessageId || '').filter(Boolean);

    if (providerMessageIds.length === 0) {
      return {
        dispatch: toDispatchDto(dispatchData as SmsDispatchRow),
        targets: existingTargets,
        events: [],
      };
    }

    const lookupResult = await SolapiSmsService.lookupMessagesByProviderIds(providerMessageIds);

    if (!lookupResult.ok && lookupResult.status === 'provider_not_configured') {
      throw new Error('문자 상태 동기화 실패: SOLAPI_API_KEY 또는 SOLAPI_API_SECRET 이 설정되지 않았습니다.');
    }

    const statusByProviderMessageId = new Map(
      lookupResult.results.map((item) => [
        item.providerMessageId,
        {
          status: item.status,
          statusCode: item.statusCode,
          reason: item.reason,
          raw: item.raw,
        },
      ])
    );

    const updatedTargets = await Promise.all(
      existingTargets.map(async (target) => {
        if (!target.providerMessageId) {
          return target;
        }

        const lookup = statusByProviderMessageId.get(target.providerMessageId);

        if (!lookup) {
          return target;
        }

        const nextStatus = lookup.status === 'delivered' ? 'delivered' : lookup.status === 'failed' ? 'failed' : target.status;
        const deliveredAt = lookup.status === 'delivered' ? new Date().toISOString() : target.deliveredAt;
        const failureReason = lookup.status === 'failed' ? lookup.reason || 'provider status failed' : target.failureReason;

        const { data, error } = await messagingSchema()
          .from('sms_dispatch_targets')
          .update({
            status: nextStatus,
            delivered_at: deliveredAt,
            failure_reason: failureReason,
          })
          .eq('id', target.id)
          .select('*')
          .single();

        if (error || !data) {
          throw new Error(`문자 상태 동기화 target 저장 실패: ${error?.message || 'target_sync_failed'}`);
        }

        return toDispatchTargetDto(data as SmsDispatchTargetRow);
      })
    );

    const deliveredCount = updatedTargets.filter((item) => item.status === 'delivered').length;
    const failedCount = updatedTargets.filter((item) => item.status === 'failed').length;
    const sentCount = updatedTargets.filter((item) => item.status === 'sent' || item.status === 'delivered').length;

    const nextDispatchStatus: SmsDispatchRecordDto['status'] =
      deliveredCount === updatedTargets.length
        ? 'delivered'
        : failedCount === updatedTargets.length
          ? 'failed'
          : 'sent';

    const { data: syncedDispatchData, error: syncedDispatchError } = await messagingSchema()
      .from('sms_dispatch_registry')
      .update({
        status: nextDispatchStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        delivered_at: nextDispatchStatus === 'delivered' ? new Date().toISOString() : null,
        failure_reason: failedCount > 0 ? `${failedCount}건 상태 실패` : null,
      })
      .eq('id', dispatchId)
      .select('*')
      .single();

    if (syncedDispatchError || !syncedDispatchData) {
      throw new Error(`문자 상태 동기화 dispatch 저장 실패: ${syncedDispatchError?.message || 'dispatch_sync_failed'}`);
    }

    const event = await insertDispatchEvent(dispatchId, 'provider_response', {
      updatedCount: updatedTargets.length,
      deliveredCount,
      failedCount,
      providerPayloadSummary: lookupResult.providerPayloadSummary || {},
      targets: lookupResult.results.map((item) => ({
        providerMessageId: item.providerMessageId,
        status: item.status,
        statusCode: item.statusCode,
        reason: item.reason,
      })),
    });

    return {
      dispatch: toDispatchDto(syncedDispatchData as SmsDispatchRow),
      targets: updatedTargets,
      events: [event],
    };
  },

  async sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
    const requestLinkId = input.requestLinkId?.trim() || null;
    const explicitRecipientEmail = input.recipientEmail?.trim() || null;
    const explicitRecipientName = input.recipientName?.trim() || null;
    const requestedBy = input.requestedBy?.trim() || null;
    const subject = input.subject.trim();
    const htmlBody = input.htmlBody.trim();

    if (!subject || !htmlBody) {
      throw new Error('이메일 발송 실패: subject, htmlBody가 필요합니다.');
    }

    const requestLink = requestLinkId ? await RequestLinkService.getRequestLinkById(requestLinkId) : null;

    if (requestLink && !explicitRecipientEmail && requestLink.recipientChannel !== 'email') {
      throw new Error('이메일 발송 실패: 선택한 요청 링크의 수신 채널이 email이 아닙니다.');
    }

    const recipientEmail = explicitRecipientEmail || requestLink?.recipientTarget || '';
    const recipientName = explicitRecipientName || requestLink?.recipientName || null;

    if (!recipientEmail) {
      throw new Error('이메일 발송 실패: recipientEmail이 필요합니다.');
    }

    const { data: dispatchData, error: dispatchError } = await messagingSchema()
      .from('email_dispatch_registry')
      .insert([
        {
          request_link_id: requestLinkId,
          provider_key: 'resend',
          status: 'queued',
          subject,
          html_body: htmlBody,
          recipient_count: 1,
          sent_count: 0,
          failed_count: 0,
          requested_by: requestedBy,
        },
      ])
      .select('*')
      .single();

    if (dispatchError || !dispatchData) {
      throw new Error(`이메일 발송 실패: dispatch 저장 실패 (${dispatchError?.message || 'dispatch_insert_failed'})`);
    }

    const dispatch = dispatchData as EmailDispatchRow;
    const events: EmailDispatchEventDto[] = [];
    const { data: targetData, error: targetError } = await messagingSchema()
      .from('email_dispatch_targets')
      .insert([
        {
          dispatch_id: dispatch.id,
          request_link_id: requestLinkId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          status: 'queued',
        },
      ])
      .select('*')
      .single();

    if (targetError || !targetData) {
      throw new Error(`이메일 발송 실패: dispatch target 저장 실패 (${targetError?.message || 'target_insert_failed'})`);
    }

    let target = toEmailDispatchTargetDto(targetData as EmailDispatchTargetRow);
    events.push(
      await insertEmailDispatchEvent(dispatch.id, 'dispatch_requested', {
        requestLinkId,
        recipientEmail,
        recipientName,
        subject,
      })
    );

    await messagingSchema()
      .from('email_dispatch_registry')
      .update({
        status: 'sending',
        attempted_at: new Date().toISOString(),
      })
      .eq('id', dispatch.id);

    await messagingSchema()
      .from('email_dispatch_targets')
      .update({
        status: 'sending',
      })
      .eq('id', target.id);

    const sendResult = await EmailDispatchService.sendEmailBatch([
      {
        recipientEmail,
        recipientName,
        subject,
        htmlBody,
      },
    ]);

    const targetResult = sendResult.results[0];
    const { data: updatedTargetData, error: updatedTargetError } = await messagingSchema()
      .from('email_dispatch_targets')
      .update({
        provider_message_id: targetResult?.providerMessageId ?? null,
        status: targetResult?.status ?? 'failed',
        failure_reason: targetResult?.failureReason ?? null,
        sent_at: targetResult?.ok ? new Date().toISOString() : null,
      })
      .eq('id', target.id)
      .select('*')
      .single();

    if (updatedTargetError || !updatedTargetData) {
      throw new Error(
        `이메일 발송 target 상태 저장 오류: ${updatedTargetError?.message || 'target_update_error'}`
      );
    }

    target = toEmailDispatchTargetDto(updatedTargetData as EmailDispatchTargetRow);

    if (!sendResult.ok || sendResult.successCount === 0) {
      const failureStatus = sendResult.status === 'provider_not_configured' ? 'provider_not_configured' : 'failed';

      const { data: failedData, error: failedError } = await messagingSchema()
        .from('email_dispatch_registry')
        .update({
          status: failureStatus,
          sent_count: 0,
          failed_count: 1,
          failure_reason: target.failureReason || '이메일 발송 실패',
        })
        .eq('id', dispatch.id)
        .select('*')
        .single();

      if (failedError || !failedData) {
        throw new Error(`이메일 발송 실패 후 상태 저장 오류: ${failedError?.message || 'dispatch_failed_update_error'}`);
      }

      events.push(
        await insertEmailDispatchEvent(dispatch.id, 'dispatch_failed', {
          failureReason: target.failureReason || '이메일 발송 실패',
          providerPayloadSummary: sendResult.providerPayloadSummary || {},
          targetResult: targetResult
            ? {
                recipientEmail: targetResult.recipientEmail,
                status: targetResult.status,
                failureReason: targetResult.failureReason,
              }
            : null,
        })
      );

      return {
        dispatch: toEmailDispatchDto(failedData as EmailDispatchRow),
        targets: [target],
        events,
      };
    }

    const { data: sentData, error: sentError } = await messagingSchema()
      .from('email_dispatch_registry')
      .update({
        status: 'sent',
        provider_message_id: target.providerMessageId,
        sent_count: 1,
        failed_count: 0,
        sent_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq('id', dispatch.id)
      .select('*')
      .single();

    if (sentError || !sentData) {
      throw new Error(`이메일 발송 성공 후 상태 저장 오류: ${sentError?.message || 'dispatch_sent_update_error'}`);
    }

    events.push(
      await insertEmailDispatchEvent(dispatch.id, 'provider_response', {
        successCount: sendResult.successCount,
        failureCount: sendResult.failureCount,
        providerPayloadSummary: sendResult.providerPayloadSummary || {},
        targetResult: targetResult
          ? {
              recipientEmail: targetResult.recipientEmail,
              status: targetResult.status,
              providerMessageId: targetResult.providerMessageId,
            }
          : null,
      })
    );

    return {
      dispatch: toEmailDispatchDto(sentData as EmailDispatchRow),
      targets: [target],
      events,
    };
  },
};
