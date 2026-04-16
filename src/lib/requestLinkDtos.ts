export type RequestLinkRecipientChannel = 'email' | 'sms';

export type RequestLinkScalarValue = string | number | boolean | null;

export type RequestLinkCreateInput = {
  documentId: string;
  allowedLabels: string[];
  recipientChannel: RequestLinkRecipientChannel;
  recipientTarget: string;
  recipientName?: string | null;
  expiresAt: string;
  oneTimeUse?: boolean;
  requestedBy?: string | null;
};

export type RequestLinkRecordDto = {
  id: string;
  documentId: string;
  recipientChannel: RequestLinkRecipientChannel;
  recipientTarget: string;
  recipientName: string | null;
  allowedLabels: string[];
  expiresAt: string;
  oneTimeUse: boolean;
  status: 'active' | 'submitted' | 'expired' | 'revoked';
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestLinkCreateResult = {
  requestLink: RequestLinkRecordDto;
  token: string;
  maskedUrl: string;
};

export type RequestLinkDocumentSummaryDto = {
  documentId: string;
  title: string;
  documentTypeKey: string;
  siteId: string;
  currentVersionNumber: number | null;
  allowedLabelValues: Record<string, unknown>;
};

export type RequestLinkPublicViewDto = {
  requestLinkId: string;
  status: 'active' | 'submitted' | 'expired' | 'revoked';
  expiresAt: string;
  oneTimeUse: boolean;
  recipientName: string | null;
  allowedLabels: string[];
  documentSummary: RequestLinkDocumentSummaryDto;
};

export type RequestLinkSubmitInput = {
  labelValues: Record<string, RequestLinkScalarValue>;
  submittedBy?: string | null;
};

export type RequestLinkSubmitAuditDto = {
  id: string;
  requestLinkId: string;
  documentId: string;
  submittedBy: string | null;
  submittedLabels: Record<string, RequestLinkScalarValue>;
  updatedVersionId: string;
  createdAt: string;
};

export type RequestLinkSubmitResult = {
  status: 'submitted';
  updatedLabels: string[];
  requestLinkId: string;
  updatedVersionId: string;
  auditLog: RequestLinkSubmitAuditDto;
};
