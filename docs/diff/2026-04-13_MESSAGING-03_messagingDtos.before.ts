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
  requestedBy: string | null;
  attemptedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmsDispatchEventDto = {
  id: string;
  dispatchId: string;
  eventType: 'dispatch_requested' | 'provider_response' | 'dispatch_failed';
  payloadSummary: Record<string, unknown>;
  createdAt: string;
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
  senderId: string;
  recipientId: string;
  requestedBy?: string | null;
  messageText: string;
};

export type SmsSendResult = {
  dispatch: SmsDispatchRecordDto;
  events: SmsDispatchEventDto[];
};
