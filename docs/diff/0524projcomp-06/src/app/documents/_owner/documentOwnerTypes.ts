import type { TemplateEditWorkspaceInitialDraft } from '../../../components/template/TemplateEditWorkspace';
import type { TemplateChecklistRegistrationTarget } from '../../../components/template/workspace/types';
import type { DocumentDetailResult, DocumentListItem } from '../../../lib/documentDtos';
import type { RequestLinkRecordDto } from '../../../lib/requestLinkDtos';
import type { SiteRecordDto } from '../../../lib/siteChecklistDtos';
import type { EntityPickerOption } from '../../../components/ui/EntityPicker';

export type DocumentsOwnerSurface = 'documents' | 'project';
export type DocumentsOwnerRenderMode = 'full' | 'current-work-panel';

export type DocumentsOwnerWorkspaceProps = {
  initialSiteId?: string;
  lockedDocumentId?: string;
  hideDocumentPicker?: boolean;
  hidePageHeader?: boolean;
  embedded?: boolean;
  surface?: DocumentsOwnerSurface;
  renderMode?: DocumentsOwnerRenderMode;
};

export type DocumentsOwnerRecentRequestLink = {
  requestLink: RequestLinkRecordDto;
  documentTitle: string;
  documentTypeKey: string;
  siteId: string;
  maskedRecipientTarget: string;
};

export type DocumentRequestableKind = 'value' | 'file' | 'signature' | 'photo';

export type DocumentRequestableField = {
  id: string;
  displayKeyText: string;
  valueKey: string;
  keyFrameGroupId?: string;
  valueFrameGroupId?: string;
  parentGroupId?: string;
  contextKey?: string;
  currentValueText: string;
  requestKind: DocumentRequestableKind;
};

export type DocumentOwnerMemberOption = EntityPickerOption & {
  memberId: string;
  phoneNumber: string;
  displayName: string;
  accessRole: string;
  accessSource: 'document' | 'site';
};

export type DocumentOwnerState = {
  sites: SiteRecordDto[];
  documents: DocumentListItem[];
  selectedSiteId: string;
  selectedDocumentId: string;
  selectedDocumentDetail: DocumentDetailResult | null;
  selectedDocumentInitialDraft: TemplateEditWorkspaceInitialDraft | null;
  requestableFields: DocumentRequestableField[];
  activeHighlightTarget: TemplateChecklistRegistrationTarget | null;
  recentRequestLinks: DocumentsOwnerRecentRequestLink[];
};
