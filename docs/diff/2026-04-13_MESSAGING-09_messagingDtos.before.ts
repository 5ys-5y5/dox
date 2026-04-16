export type SmsSenderRecordDto = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  solapiStatus: 'registered' | 'unknown';
  isActive: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmsRecipientRecordDto = {
  id: string;
  phoneNumber: string;
  recipientName: string | null;
  siteId: string | null;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmsDispatchStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'provider_not_configured'
  | 'sender_not_registered'
  | 'recipient_not_registered'
  | 'manual_required';

export type SmsDispatchRecordDto = {
  id: string;
  requestLinkId: string | null;
  senderId: string | null;
  recipientId: string | null;
  providerKey: 'solapi';
  providerMessageId: string | null;
  status: SmsDispatchStatus;
  messageText: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  requestedBy: string | null;
  attemptedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmsDispatchTargetDto = {
  id: string;
  dispatchId: string;
  recipientId: string | null;
  recipientPhoneNumber: string;
  recipientName: string | null;
  providerMessageId: string | null;
  status: SmsDispatchStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmsDispatchEventDto = {
  id: string;
  dispatchId: string;
  eventType: 'dispatch_requested' | 'provider_response' | 'dispatch_failed' | 'status_synced';
  payloadSummary: Record<string, unknown>;
  createdAt: string;
};

export type SmsSettingsDto = {
  defaultSenderPhoneNumber: string | null;
  messagePrefix: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SmsSenderCreateInput = {
  phoneNumber: string;
  displayName?: string | null;
};

export type SmsRecipientCreateInput = {
  phoneNumber: string;
  recipientName?: string | null;
  siteId?: string | null;
  memo?: string | null;
};

export type SmsSendInput = {
  requestLinkId?: string | null;
  senderId?: string | null;
  recipientId?: string | null;
  recipientIds?: string[];
  requestedBy?: string | null;
  messageText: string;
};

export type SmsSendResult = {
  dispatch: SmsDispatchRecordDto;
  targets: SmsDispatchTargetDto[];
  events: SmsDispatchEventDto[];
};

export type SmsSyncInput = {
  dispatchId: string;
};

export type SmsSyncResult = {
  dispatch: SmsDispatchRecordDto;
  targets: SmsDispatchTargetDto[];
  events: SmsDispatchEventDto[];
};

export type SmsSettingsUpdateInput = {
  defaultSenderPhoneNumber?: string | null;
  messagePrefix?: string | null;
};

export type EmailDispatchStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'provider_not_configured'
  | 'recipient_not_registered'
  | 'manual_required';

export type EmailDispatchRecordDto = {
  id: string;
  requestLinkId: string | null;
  providerKey: 'resend';
  providerMessageId: string | null;
  status: EmailDispatchStatus;
  subject: string;
  htmlBody: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  requestedBy: string | null;
  attemptedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailDispatchTargetDto = {
  id: string;
  dispatchId: string;
  requestLinkId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  providerMessageId: string | null;
  status: EmailDispatchStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailDispatchEventDto = {
  id: string;
  dispatchId: string;
  eventType: 'dispatch_requested' | 'provider_response' | 'dispatch_failed';
  payloadSummary: Record<string, unknown>;
  createdAt: string;
};

export type EmailSendInput = {
  requestLinkId?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  requestedBy?: string | null;
  subject: string;
  htmlBody: string;
};

export type EmailSendResult = {
  dispatch: EmailDispatchRecordDto;
  targets: EmailDispatchTargetDto[];
  events: EmailDispatchEventDto[];
};
