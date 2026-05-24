'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EntityPicker } from '../../../components/ui/EntityPicker';
import { Input } from '../../../components/ui/Input';
import { MultiEntityPicker } from '../../../components/ui/MultiEntityPicker';
import {
  OwnerSettingsActionBar,
  OwnerSettingsSectionHeader,
  OwnerSettingsTabList,
} from '../../../components/ui/OwnerSettingsLayout';
import { SettingToggleRow } from '../../../components/ui/SettingToggleRow';
import { CanvasOwnedWorkspace } from '../../canvas/ownerPolicy';
import type { TemplateEditWorkspaceInitialDraft } from '../../../components/template/TemplateEditWorkspace';
import type {
  TemplateCanvasSelectablePolicy,
  TemplateCanvasSelectedBox,
  TemplateCanvasSelectionChangeOptions,
} from '../../../components/template/workspace/types';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../../lib/documentAttachmentValues';
import { buildDocumentHtmlContentKey } from '../../../lib/documentCanvasHtml';
import {
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
} from '../../../lib/documentCanvasState';
import type { DocumentDetailResult, DocumentListItem, DocumentRequestTaskDto, DocumentRequestTaskInput } from '../../../lib/documentDtos';
import type { DocumentMemberRecordDto, SiteMemberRecordDto } from '../../../lib/memberAccessDtos';
import type { SiteRecordDto } from '../../../lib/siteChecklistDtos';
import { cn } from '../../../lib/utils';
import { DocumentsOwnerClient } from './documentOwnerClient';
import { collectDocumentRequestableFields } from './documentFieldIndex';
import { documentsOwnerManagedSurfaces, useDocumentsOwnerSettings } from './documentOwnerSettings';
import type {
  DocumentOwnerMemberOption,
  DocumentRequestableField,
  DocumentsOwnerRecentRequestLink,
  DocumentsOwnerSurface,
  DocumentsOwnerWorkspaceProps,
} from './documentOwnerTypes';

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const toDatetimeLocalValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const REQUEST_LINK_DEFAULT_EXPIRATION_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const buildDefaultRequestLinkExpiresAt = () =>
  toDatetimeLocalValue(new Date(Date.now() + REQUEST_LINK_DEFAULT_EXPIRATION_OFFSET_MS));

const formatExpirationRemainingTime = (value: string, nowMs: number) => {
  const parsed = new Date(value);

  if (!value || Number.isNaN(parsed.getTime())) {
    return '만료 시각을 입력하세요.';
  }

  const diffMs = parsed.getTime() - nowMs;

  if (diffMs <= 0) {
    return '만료 시각이 지났습니다.';
  }

  const totalHours = Math.max(0, Math.round(diffMs / HOUR_MS));

  if (totalHours <= 0) {
    return '1시간 미만 후';
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return `${days}일 ${hours}시간 후`;
};

const formatPhoneNumber = (value: string | null | undefined) => {
  const digits = (value || '').replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value || '';
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'active':
    case 'covered':
    case 'completed':
      return 'green' as const;
    case 'draft':
    case 'pending':
    case 'review_needed':
      return 'amber' as const;
    case 'missing':
    case 'failed':
    case 'expired':
    case 'revoked':
    case 'deleted':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

const getRequestKindLabel = (kind: DocumentRequestableField['requestKind']) => {
  switch (kind) {
    case 'signature':
      return '서명 요청';
    case 'file':
      return '필수 파일';
    case 'photo':
      return '필수 사진';
    default:
      return '기록 값';
  }
};

const isGeneratedFieldLabel = (value: string) =>
  /^(band-\d+|status-history-\d+|field-\d+|frame-\d+)/i.test(value.trim());

const normalizeFieldDisplayText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/([가-힣])\s+(?=[가-힣])/g, '$1')
    .replace(/(텍스트|서명|첨부파일|파일|사진)?(상위 키|하위 값)$/g, '')
    .trim();

const escapeCssSelectorValue = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const readCanvasDisplayText = (element: Element | null | undefined) => {
  if (!element) {
    return '';
  }

  const inputElement = element.querySelector<HTMLElement>('[data-template-frame-input="true"]');
  const valueText =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element.value
      : inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement
        ? inputElement.value
        : '';

  return normalizeFieldDisplayText(
    element.getAttribute('data-template-frame-source-text') ||
      inputElement?.getAttribute('data-template-frame-source-text') ||
      element.getAttribute('data-template-frame-extracted-text') ||
      inputElement?.getAttribute('data-template-frame-extracted-text') ||
      valueText ||
      element.textContent ||
      ''
  );
};

const getFieldLabel = (field: Pick<DocumentRequestableField, 'displayKeyText'>, index?: number) => {
  const label = normalizeFieldDisplayText(field.displayKeyText);

  if (!label || isGeneratedFieldLabel(label)) {
    return typeof index === 'number' && index >= 0 ? `선택한 상자 ${index + 1}` : '선택한 상자';
  }

  return label;
};

const getCanvasRoleForRequestableField = (field: DocumentRequestableField): TemplateCanvasSelectedBox['role'] => {
  if (field.requestKind === 'signature') {
    return 'signature';
  }

  if (field.requestKind === 'file' || field.requestKind === 'photo') {
    return 'attachment';
  }

  return 'value';
};

const buildCanvasSelectedBoxForRequestableField = (
  field: DocumentRequestableField,
  index?: number
): TemplateCanvasSelectedBox => ({
  id: field.valueKey,
  frameGroupId: field.keyFrameGroupId || field.valueFrameGroupId || field.valueKey,
  role: getCanvasRoleForRequestableField(field),
  label: getFieldLabel(field, index),
  value: field.currentValueText || undefined,
  valueKey: field.valueKey,
  slotKey: field.requestKind === 'signature' || field.requestKind === 'file' ? field.valueKey : undefined,
  contextKey: field.contextKey,
  keyFrameGroupId: field.keyFrameGroupId || undefined,
  valueFrameGroupId: field.valueFrameGroupId || undefined,
  highlightFrameGroupIds: Array.from(
    new Set(
      [field.keyFrameGroupId, field.valueFrameGroupId, field.parentGroupId, field.valueKey, field.contextKey]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ),
  requestKind:
    field.requestKind === 'signature'
      ? 'signature'
      : field.requestKind === 'file'
        ? 'file'
        : field.requestKind === 'photo'
          ? 'photo'
          : 'value',
});

const buildRequestTasks = (fields: DocumentRequestableField[]): DocumentRequestTaskInput[] =>
  fields.map((field, index) => ({
    kind: field.requestKind,
    targetKey: getFieldLabel(field, index),
    targetLabel: getFieldLabel(field, index),
    valueKey: field.valueKey,
    slotKey: field.requestKind === 'signature' ? field.valueKey : null,
    frameGroupId: field.valueFrameGroupId || field.keyFrameGroupId || null,
    status: 'requested',
    payload: {
      currentValueText: field.currentValueText,
      keyFrameGroupId: field.keyFrameGroupId || null,
      valueFrameGroupId: field.valueFrameGroupId || null,
      contextKey: field.contextKey || null,
    },
  }));

const buildMediaRequestTask = (
  draft: MediaRequestDraft,
  attachmentField: DocumentRequestableField | null
): DocumentRequestTaskInput => {
  const scope = draft.attachmentValueKey ? 'attachment' : 'document';
  const targetLabel = `${draft.tagName} · ${draft.attachmentLabel || '문서'}`;

  return {
    kind: draft.kind,
    targetKey: `${draft.kind}:${draft.tagKey}:${draft.attachmentValueKey || 'document'}`,
    targetLabel,
    valueKey: draft.attachmentValueKey || null,
    slotKey: draft.attachmentValueKey || null,
    frameGroupId: attachmentField?.valueFrameGroupId || attachmentField?.keyFrameGroupId || null,
    requiredCount: draft.requiredCount,
    status: 'requested',
    payload: {
      tagKey: draft.tagKey,
      tagName: draft.tagName,
      tagColor: draft.tagColor,
      tags: [draft.tagName],
      tagColors: { [draft.tagName]: draft.tagColor },
      tagKind: draft.kind,
      requestScope: scope,
      attachmentValueKey: draft.attachmentValueKey || null,
      attachmentLabel: draft.attachmentLabel || null,
      keyFrameGroupId: attachmentField?.keyFrameGroupId || null,
      valueFrameGroupId: attachmentField?.valueFrameGroupId || null,
      contextKey: attachmentField?.contextKey || null,
    },
  };
};

const normalizeLookupValue = (value: string | null | undefined) =>
  String(value || '').trim().toLowerCase();

const normalizePhoneDigits = (value: string | null | undefined) =>
  String(value || '').replace(/[^0-9]/g, '');

const buildDocumentsSelectionQueryKey = (siteId: string, documentId: string) =>
  `${siteId.trim()}::${documentId.trim()}`;

const documentsOwnerItem = (item: string, name: string) => ({
  'data-documents-owner-item': item,
  'data-documents-owner-name': name,
});

type MediaRequestKind = 'photo' | 'file';
type DocumentsOwnerRequestSetupStepKey = 'box-assignee' | 'photo' | 'file' | 'expiration';

type MediaTagOption = {
  kind: MediaRequestKind;
  id: string;
  label: string;
  color: string;
};

type MediaRequestDraft = {
  id: string;
  kind: MediaRequestKind;
  tagKey: string;
  tagName: string;
  tagColor: string;
  attachmentValueKey: string;
  attachmentLabel: string;
  assigneeMemberId: string;
  requiredCount: number;
};

const defaultMediaTagColors: Record<MediaRequestKind, string> = {
  photo: '#10b981',
  file: '#2563eb',
};

const normalizeMediaTagColor = (value: string | null | undefined, fallback = '#64748b') => {
  const normalizedValue = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(normalizedValue) ? normalizedValue.toLowerCase() : fallback;
};

const mediaRequestKindLabels: Record<MediaRequestKind, string> = {
  photo: '필수 사진',
  file: '필수 파일',
};

const mediaRequestTagFieldLabels: Record<MediaRequestKind, string> = {
  photo: '사진 태그',
  file: '파일 태그',
};

const documentsOwnerRequestSetupSteps: Array<{
  key: DocumentsOwnerRequestSetupStepKey;
  settingKey:
    | 'showRequestStepBoxAssignee'
    | 'showRequestStepPhoto'
    | 'showRequestStepFile'
    | 'showRequestStepExpiration';
  label: string;
  description: string;
}> = [
  {
    key: 'box-assignee',
    settingKey: 'showRequestStepBoxAssignee',
    label: '상자에 담당자 지정',
    description: '상자 편집 캔버스에서 선택한 상자를 한 담당자에게 일괄 지정합니다.',
  },
  {
    key: 'photo',
    settingKey: 'showRequestStepPhoto',
    label: '필수 사진 등록',
    description: '사진 태그, 첨부파일 상자 연결 여부, 담당자를 정합니다.',
  },
  {
    key: 'file',
    settingKey: 'showRequestStepFile',
    label: '필수 파일 등록',
    description: '파일 태그, 첨부파일 상자 연결 여부, 담당자를 정합니다.',
  },
  {
    key: 'expiration',
    settingKey: 'showRequestStepExpiration',
    label: '만료 시각 설정',
    description: '요청 링크 만료 시각을 정하고 담당자별 요청 링크를 만듭니다.',
  },
];

const buildMediaTagKey = (kind: MediaRequestKind, value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (normalized) {
    return `${kind}:${normalized}`;
  }

  let hash = 0;
  for (const character of value || kind) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `${kind}:tag-${hash.toString(36) || 'empty'}`;
};

const readTaskPayloadText = (task: DocumentRequestTaskDto, key: string) => {
  const value = task.payload?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const findExistingSignatureRequestId = (
  detail: DocumentDetailResult | null,
  task: DocumentRequestTaskInput,
  member: DocumentOwnerMemberOption
) => {
  const taskSlotKey = normalizeLookupValue(task.slotKey || task.valueKey || task.targetKey);
  const memberPhoneDigits = normalizePhoneDigits(member.phoneNumber);
  const memberName = normalizeLookupValue(member.displayName);
  const existingEvidence =
    detail?.signatureEvidence.find((item) => {
      const itemSlotKey = normalizeLookupValue(item.slotKey || item.label);
      const itemPhoneDigits = normalizePhoneDigits(item.signerPhoneNumber);
      const itemSignerName = normalizeLookupValue(item.signerName);
      const activeStatus = item.status !== 'expired' && item.status !== 'failed';

      return (
        activeStatus &&
        Boolean(item.requestId) &&
        itemSlotKey === taskSlotKey &&
        ((memberPhoneDigits && itemPhoneDigits === memberPhoneDigits) || (!memberPhoneDigits && itemSignerName === memberName))
      );
    }) || null;

  return existingEvidence?.requestId || '';
};

const isSiteWideDocumentAccessRole = (role: string) =>
  role === 'owner' || role === 'manager' || role === 'editor' || role === 'viewer';

const createMemberOption = (
  memberRecord: DocumentMemberRecordDto | SiteMemberRecordDto,
  source: DocumentOwnerMemberOption['accessSource']
): DocumentOwnerMemberOption => {
  const member = memberRecord.member;
  const displayName = member.displayName?.trim() || formatPhoneNumber(member.phoneNumber) || member.phoneNumber;
  const formattedPhone = formatPhoneNumber(member.phoneNumber);

  return {
    id: member.id,
    memberId: member.id,
    phoneNumber: member.phoneNumber,
    displayName,
    accessRole: memberRecord.accessRole,
    accessSource: source,
    label: displayName,
    meta: formattedPhone,
    keywords: [displayName, member.phoneNumber, formattedPhone, member.phoneNumber.replace(/[^0-9]/g, '')],
  };
};

const mergeMemberOptions = (
  documentMembers: DocumentMemberRecordDto[],
  siteMembers: SiteMemberRecordDto[]
): DocumentOwnerMemberOption[] => {
  const optionsByMemberId = new Map<string, DocumentOwnerMemberOption>();

  siteMembers
    .filter((membership) => isSiteWideDocumentAccessRole(membership.accessRole))
    .forEach((membership) => {
      const option = createMemberOption(membership, 'site');
      optionsByMemberId.set(option.memberId, option);
    });

        documentMembers.forEach((membership) => {
          const option = createMemberOption(membership, 'document');
          optionsByMemberId.set(option.memberId, option);
        });

  return Array.from(optionsByMemberId.values()).sort((left, right) => left.label.localeCompare(right.label, 'ko'));
};

const buildInitialDraft = (
  detail: DocumentDetailResult | null,
  labelValues: Record<string, unknown>
): TemplateEditWorkspaceInitialDraft | null => {
  if (!detail) {
    return null;
  }

  const html = materializeDocumentHtml({
    linkedRenderHtml: detail.linkedTemplate?.draftHtml || detail.linkedTemplate?.renderSnapshotHtml,
    latestVersionHtml: detail.latestVersion?.htmlCanonical,
    labelValues,
  });

  if (!html.trim()) {
    return null;
  }

  return {
    draftKey: `documents-owner:${detail.document.id}:${detail.latestVersion?.versionNumber || 0}:${buildDocumentHtmlContentKey(html)}`,
    templateName: detail.document.title,
    draftHtml: html,
    sourceDocumentName: '',
    layoutResizeMode: 'grow_height',
    attachmentFilesByValueKey: groupDocumentValueFilesByValueKey(detail.valueFiles || []),
  };
};

export function DocumentsOwnerWorkspace({
  initialSiteId = '',
  lockedDocumentId = '',
  hideDocumentPicker = false,
  hidePageHeader = false,
  embedded = false,
  surface = 'documents',
  renderMode = 'full',
}: DocumentsOwnerWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const documentsOwnerSettings = useDocumentsOwnerSettings();
  const [activeOwnerSettingsSurface, setActiveOwnerSettingsSurface] = React.useState<DocumentsOwnerSurface>('documents');
  const surfaceOwnerSettings = documentsOwnerSettings.resolveSurfaceSettings(surface);
  const documentPickerEnabled = !hideDocumentPicker && surfaceOwnerSettings.documentSelectionMode === 'picker';
  const requestSetupSteps = React.useMemo(
    () => documentsOwnerRequestSetupSteps.filter((step) => surfaceOwnerSettings[step.settingKey]),
    [
      surfaceOwnerSettings.showRequestStepBoxAssignee,
      surfaceOwnerSettings.showRequestStepExpiration,
      surfaceOwnerSettings.showRequestStepFile,
      surfaceOwnerSettings.showRequestStepPhoto,
    ]
  );
  const firstRequestSetupStepKey = requestSetupSteps[0]?.key || 'box-assignee';
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = React.useState(initialSiteId);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(lockedDocumentId);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [recentRequestLinks, setRecentRequestLinks] = React.useState<DocumentsOwnerRecentRequestLink[]>([]);
  const [documentRequestTasks, setDocumentRequestTasks] = React.useState<DocumentRequestTaskDto[]>([]);
  const [documentMembers, setDocumentMembers] = React.useState<DocumentMemberRecordDto[]>([]);
  const [siteMembers, setSiteMembers] = React.useState<SiteMemberRecordDto[]>([]);
  const [selectedFieldKeys, setSelectedFieldKeys] = React.useState<string[]>([]);
  const [selectedFieldAssigneeByValueKey, setSelectedFieldAssigneeByValueKey] = React.useState<Record<string, string>>({});
  const [selectedFieldLabelByValueKey, setSelectedFieldLabelByValueKey] = React.useState<Record<string, string>>({});
  const [canvasFieldLabelByValueKey, setCanvasFieldLabelByValueKey] = React.useState<Record<string, string>>({});
  const [mediaRequestDrafts, setMediaRequestDrafts] = React.useState<MediaRequestDraft[]>([]);
  const [localMediaTagOptions, setLocalMediaTagOptions] = React.useState<MediaTagOption[]>([]);
  const [mediaTagKeyByKind, setMediaTagKeyByKind] = React.useState<Record<MediaRequestKind, string>>({ photo: '', file: '' });
  const [mediaTagColorByKey, setMediaTagColorByKey] = React.useState<Record<string, string>>({});
  const [mediaAttachmentValueKeyByKind, setMediaAttachmentValueKeyByKind] = React.useState<Record<MediaRequestKind, string>>({ photo: '', file: '' });
  const [mediaAssigneeByKind, setMediaAssigneeByKind] = React.useState<Record<MediaRequestKind, string>>({ photo: '', file: '' });
  const [mediaRequiredCountByKind, setMediaRequiredCountByKind] = React.useState<Record<MediaRequestKind, number>>({ photo: 1, file: 1 });
  const [activeRequestSetupStep, setActiveRequestSetupStep] =
    React.useState<DocumentsOwnerRequestSetupStepKey>(firstRequestSetupStepKey);
  const [activeFieldValueKey, setActiveFieldValueKey] = React.useState('');
  const [newMemberRegistrationOpen, setNewMemberRegistrationOpen] = React.useState(false);
  const [newMemberName, setNewMemberName] = React.useState('');
  const [newMemberPhone, setNewMemberPhone] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState(buildDefaultRequestLinkExpiresAt);
  const [currentTimeMs, setCurrentTimeMs] = React.useState(() => Date.now());
  const [latestCreatedRequestLinks, setLatestCreatedRequestLinks] = React.useState<
    Array<{ requestLink: DocumentsOwnerRecentRequestLink['requestLink']; requestUrl: string }>
  >([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [documentListLoading, setDocumentListLoading] = React.useState(false);
  const [documentDetailLoading, setDocumentDetailLoading] = React.useState(Boolean(lockedDocumentId));
  const [requestContextLoading, setRequestContextLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const loading = documentListLoading || documentDetailLoading || requestContextLoading || actionLoading;
  const selectionQuerySyncRef = React.useRef('');
  const documentListLoadSeqRef = React.useRef(0);
  const documentContextLoadSeqRef = React.useRef(0);
  const shouldSyncSelectionQuery = surface === 'documents' && !embedded && documentPickerEnabled;

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (requestSetupSteps.length > 0 && !requestSetupSteps.some((step) => step.key === activeRequestSetupStep)) {
      setActiveRequestSetupStep(firstRequestSetupStepKey);
    }
  }, [activeRequestSetupStep, firstRequestSetupStepKey, requestSetupSteps]);

  React.useEffect(() => {
    if (initialSiteId) {
      setSelectedSiteId(initialSiteId);
    }
  }, [initialSiteId]);

  React.useEffect(() => {
    if (lockedDocumentId) {
      setDocumentDetailLoading(true);
      setSelectedDocumentId(lockedDocumentId);
    }
  }, [lockedDocumentId]);

  const siteOptions = React.useMemo(
    () =>
      sites.map((site) => ({
        id: site.id,
        label: site.siteName,
        meta: site.id,
        keywords: site.tradeKeys,
      })),
    [sites]
  );

  const documentOptions = React.useMemo(
    () =>
      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        meta: item.document.documentTypeKey,
        keywords: [item.document.documentTypeKey, item.document.status, item.document.id],
      })),
    [documents]
  );

  const selectedDocumentLabelValues = React.useMemo<Record<string, unknown>>(() => {
    if (!selectedDocumentDetail?.latestVersion) {
      return {};
    }

    return {
      ...mergeDocumentCanvasLabelValues(
        selectedDocumentDetail.latestVersion.labelValues || {},
        selectedDocumentDetail.valueEntries || []
      ),
      ...buildDocumentAttachmentTextByValueKey(selectedDocumentDetail.valueFiles || []),
    };
  }, [selectedDocumentDetail]);

  const selectedDocumentInitialDraft = React.useMemo(
    () => buildInitialDraft(selectedDocumentDetail, selectedDocumentLabelValues),
    [selectedDocumentDetail, selectedDocumentLabelValues]
  );

  const requestableFields = React.useMemo(
    () =>
      collectDocumentRequestableFields(
        selectedDocumentInitialDraft?.draftHtml || selectedDocumentDetail?.latestVersion?.htmlCanonical || '',
        selectedDocumentLabelValues
      ),
    [selectedDocumentDetail?.latestVersion?.htmlCanonical, selectedDocumentInitialDraft?.draftHtml, selectedDocumentLabelValues]
  );

  const selectedFields = React.useMemo(
    () =>
      requestableFields
        .filter((field) => selectedFieldKeys.includes(field.valueKey))
        .map((field) => ({
          ...field,
          displayKeyText: selectedFieldLabelByValueKey[field.valueKey] || canvasFieldLabelByValueKey[field.valueKey] || field.displayKeyText,
        })),
    [canvasFieldLabelByValueKey, requestableFields, selectedFieldKeys, selectedFieldLabelByValueKey]
  );
  const requestLinkSelectedFields = surfaceOwnerSettings.showRequestStepBoxAssignee ? selectedFields : [];
  const requestLinkMediaRequestDrafts = mediaRequestDrafts.filter((draft) =>
    draft.kind === 'photo'
      ? surfaceOwnerSettings.showRequestStepPhoto
      : surfaceOwnerSettings.showRequestStepFile
  );
  const activeMediaRequestKind: MediaRequestKind | null =
    activeRequestSetupStep === 'photo' || activeRequestSetupStep === 'file' ? activeRequestSetupStep : null;

  const requestableFieldRows = React.useMemo(
    () =>
      requestableFields.map((field, index) => {
        const resolvedField = {
          ...field,
          displayKeyText: selectedFieldLabelByValueKey[field.valueKey] || canvasFieldLabelByValueKey[field.valueKey] || field.displayKeyText,
        };
        const displayLabel = normalizeFieldDisplayText(resolvedField.displayKeyText);
        const label = getFieldLabel(resolvedField, index);
        const kindLabel = getRequestKindLabel(resolvedField.requestKind);
        const selected = selectedFieldKeys.includes(field.valueKey);

        return {
          field: resolvedField,
          label,
          kindLabel,
          selected,
          searchable: Boolean(displayLabel && !isGeneratedFieldLabel(displayLabel)),
          searchText: normalizeLookupValue([
            label,
            resolvedField.displayKeyText,
            resolvedField.currentValueText,
            kindLabel,
          ].join(' ')),
        };
      }),
    [canvasFieldLabelByValueKey, requestableFields, selectedFieldKeys, selectedFieldLabelByValueKey]
  );

  const selectableFieldOptions = React.useMemo(() => {
    const selectedOrder = new Map(selectedFieldKeys.map((valueKey, index) => [valueKey, index]));

    return requestableFieldRows
      .filter((row) => row.searchable)
      .map((row, index) => ({
        id: row.field.valueKey,
        label: row.label,
        meta: row.field.currentValueText ? `${row.kindLabel} · 현재 값: ${row.field.currentValueText}` : `${row.kindLabel} · 입력 대기`,
        keywords: [row.label, row.field.displayKeyText, row.field.currentValueText, row.kindLabel, row.searchText],
        selectedIndex: selectedOrder.get(row.field.valueKey),
        sourceIndex: index,
      }))
      .sort((left, right) => {
        const leftSelected = typeof left.selectedIndex === 'number';
        const rightSelected = typeof right.selectedIndex === 'number';

        if (leftSelected && rightSelected) {
          return (left.selectedIndex || 0) - (right.selectedIndex || 0);
        }

        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }

        return left.sourceIndex - right.sourceIndex;
      })
      .map(({ id, label, meta, keywords }) => ({ id, label, meta, keywords }));
  }, [requestableFieldRows, selectedFieldKeys]);

  const canvasSelectablePolicy = React.useMemo<TemplateCanvasSelectablePolicy>(() => {
    const selectableFrameGroupIds = Array.from(
      new Set(
        requestableFields
          .filter((field) => !activeMediaRequestKind || field.requestKind === 'file')
          .flatMap((field) => [field.keyFrameGroupId, field.valueFrameGroupId, field.parentGroupId, field.valueKey])
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );

    if (activeMediaRequestKind) {
      return { includeRoles: ['attachment'], selectableFrameGroupIds };
    }

    if (activeRequestSetupStep === 'box-assignee') {
      return {
        includeRoles: ['key', 'value', 'signature', 'attachment', 'text', 'unknown'],
        selectableFrameGroupIds,
      };
    }

    return { includeRoles: [] };
  }, [activeMediaRequestKind, activeRequestSetupStep, requestableFields]);

  const memberOptions = React.useMemo(
    () => mergeMemberOptions(documentMembers, siteMembers),
    [documentMembers, siteMembers]
  );

  const selectedFieldAssigneeState = React.useMemo(() => {
    const assigneeIds = selectedFields.map((field) => selectedFieldAssigneeByValueKey[field.valueKey] || '');
    const assignedIds = assigneeIds.filter(Boolean);
    const uniqueAssignedIds = Array.from(new Set(assignedIds));
    const allSelectedFieldsHaveSameAssignee =
      selectedFields.length > 0 && assignedIds.length === selectedFields.length && uniqueAssignedIds.length === 1;

    return {
      value: allSelectedFieldsHaveSameAssignee ? uniqueAssignedIds[0] || '' : '',
      assignedCount: assignedIds.length,
      unassignedCount: Math.max(selectedFields.length - assignedIds.length, 0),
      mixed: selectedFields.length > 0 && !allSelectedFieldsHaveSameAssignee && assignedIds.length > 0,
    };
  }, [selectedFieldAssigneeByValueKey, selectedFields]);

  const selectedBatchAssignee = React.useMemo(
    () => memberOptions.find((option) => option.memberId === selectedFieldAssigneeState.value) || null,
    [memberOptions, selectedFieldAssigneeState.value]
  );
  const rawActiveRequestSetupStepIndex = requestSetupSteps.findIndex((step) => step.key === activeRequestSetupStep);
  const activeRequestSetupStepIndex = rawActiveRequestSetupStepIndex >= 0 ? rawActiveRequestSetupStepIndex : 0;
  const currentRequestSetupStep =
    requestSetupSteps[activeRequestSetupStepIndex] || null;
  const requestSetupStepCount = requestSetupSteps.length;
  const requestSetupStepIsFirst = activeRequestSetupStepIndex <= 0;
  const requestSetupStepIsLast = activeRequestSetupStepIndex >= requestSetupStepCount - 1;

  const attachmentFieldOptions = React.useMemo(
    () => [
      {
        id: '',
        label: '문서에 직접 등록',
        meta: '첨부파일 상자 없이 문서 할 일로 요청',
        keywords: ['문서', '직접', '첨부파일 없음'],
      },
      ...requestableFieldRows
        .filter((row) => row.field.requestKind === 'file')
        .map((row) => ({
          id: row.field.valueKey,
          label: row.label,
          meta: row.field.currentValueText ? `첨부파일 상자 · 현재 파일: ${row.field.currentValueText}` : '첨부파일 상자',
          keywords: [row.label, row.field.displayKeyText, row.field.currentValueText, row.searchText],
        })),
    ],
    [requestableFieldRows]
  );
  const activeMediaAttachmentField = React.useMemo(() => {
    if (!activeMediaRequestKind) {
      return null;
    }

    const attachmentValueKey = mediaAttachmentValueKeyByKind[activeMediaRequestKind];
    return requestableFields.find((field) => field.valueKey === attachmentValueKey && field.requestKind === 'file') || null;
  }, [activeMediaRequestKind, mediaAttachmentValueKeyByKind, requestableFields]);

  const selectedCanvasBoxes = React.useMemo<TemplateCanvasSelectedBox[]>(() => {
    if (activeMediaRequestKind) {
      return activeMediaAttachmentField ? [buildCanvasSelectedBoxForRequestableField(activeMediaAttachmentField)] : [];
    }

    if (activeRequestSetupStep === 'box-assignee') {
      return selectedFields.map((field, index) => buildCanvasSelectedBoxForRequestableField(field, index));
    }

    return [];
  }, [activeMediaAttachmentField, activeMediaRequestKind, activeRequestSetupStep, selectedFields]);

  const mediaTagOptionsByKind = React.useMemo(() => {
    const optionsByKind: Record<MediaRequestKind, Array<{ id: string; label: string; meta?: string; keywords?: string[]; color: string }>> = {
      photo: [],
      file: [],
    };
    const seenByKind: Record<MediaRequestKind, Set<string>> = {
      photo: new Set(),
      file: new Set(),
    };
    const pushOption = (kind: MediaRequestKind, id: string, label: string, meta?: string, color?: string) => {
      const normalizedId = id.trim();
      const normalizedLabel = label.trim();

      if (!normalizedId || !normalizedLabel || seenByKind[kind].has(normalizedId)) {
        return;
      }

      seenByKind[kind].add(normalizedId);
      const normalizedColor = normalizeMediaTagColor(
        mediaTagColorByKey[normalizedId] || color,
        defaultMediaTagColors[kind]
      );
      optionsByKind[kind].push({
        id: normalizedId,
        label: normalizedLabel,
        meta,
        keywords: [normalizedId, normalizedLabel],
        color: normalizedColor,
      });
    };

    selectedDocumentDetail?.photoRequirements.forEach((requirement) => {
      pushOption('photo', `photo:${requirement.tagKey}`, requirement.tagName, '사진 요구 태그');
    });
    documentRequestTasks.forEach((task) => {
      if (task.kind !== 'photo' && task.kind !== 'file') {
        return;
      }

      const kind = task.kind;
      const tagName = readTaskPayloadText(task, 'tagName') || task.targetLabel;
      const tagKey = readTaskPayloadText(task, 'tagKey') || buildMediaTagKey(kind, tagName);
      const tagColor = readTaskPayloadText(task, 'tagColor');
      pushOption(kind, tagKey, tagName, '기존 요청 태그', tagColor);
    });
    mediaRequestDrafts.forEach((draft) => {
      pushOption(draft.kind, draft.tagKey, draft.tagName, '이번 요청 태그', draft.tagColor);
    });
    localMediaTagOptions.forEach((option) => {
      pushOption(option.kind, option.id, option.label, '새 태그', option.color);
    });

    return optionsByKind;
  }, [documentRequestTasks, localMediaTagOptions, mediaRequestDrafts, mediaTagColorByKey, selectedDocumentDetail?.photoRequirements]);

  const loadSites = React.useCallback(async () => {
    try {
      setSites(await DocumentsOwnerClient.listSites());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현장 목록 조회에 실패했습니다.');
    }
  }, []);

  const loadDocuments = React.useCallback(async (siteId: string) => {
    if (!siteId || !documentPickerEnabled) {
      setDocumentListLoading(false);
      setDocuments([]);
      return;
    }

    const loadSeq = documentListLoadSeqRef.current + 1;
    documentListLoadSeqRef.current = loadSeq;
    setDocumentListLoading(true);

    try {
      const nextDocuments = await DocumentsOwnerClient.listDocuments(siteId);
      if (documentListLoadSeqRef.current !== loadSeq) {
        return;
      }
      setDocuments(nextDocuments);
      setSelectedDocumentId((current) =>
        nextDocuments.some((item) => item.document.id === current) ? current : nextDocuments[0]?.document.id || ''
      );
    } catch (error) {
      if (documentListLoadSeqRef.current !== loadSeq) {
        return;
      }
      setDocuments([]);
      setMessage(error instanceof Error ? error.message : '문서 목록 조회에 실패했습니다.');
    } finally {
      if (documentListLoadSeqRef.current === loadSeq) {
        setDocumentListLoading(false);
      }
    }
  }, [documentPickerEnabled]);

  const loadDocumentContext = React.useCallback(async (documentId: string) => {
    const normalizedDocumentId = documentId.trim();
    const loadSeq = documentContextLoadSeqRef.current + 1;
    documentContextLoadSeqRef.current = loadSeq;

    if (!normalizedDocumentId) {
      setDocumentDetailLoading(false);
      setRequestContextLoading(false);
      setSelectedDocumentDetail(null);
      setRecentRequestLinks([]);
      setDocumentRequestTasks([]);
      setDocumentMembers([]);
      setSiteMembers([]);
      return;
    }

    setDocumentDetailLoading(true);
    setRequestContextLoading(false);
    setMessage(null);

    try {
      const detail = await DocumentsOwnerClient.getDocumentDetail(normalizedDocumentId);
      if (documentContextLoadSeqRef.current !== loadSeq) {
        return;
      }
      setSelectedDocumentDetail(detail);
      setSelectedSiteId((current) => (current === detail.document.siteId ? current : detail.document.siteId));
      setDocumentDetailLoading(false);
      setRequestContextLoading(true);
      const [requestLinks, nextDocumentMembers, nextSiteMembers, nextRequestTasks] = await Promise.all([
        DocumentsOwnerClient.listRecentRequestLinks(detail.document.siteId).catch(() => []),
        DocumentsOwnerClient.listDocumentMembers(detail.document.id).catch(() => []),
        DocumentsOwnerClient.listSiteMembers(detail.document.siteId).catch(() => []),
        DocumentsOwnerClient.listRequestTasks(detail.document.id).catch(() => []),
      ]);

      if (documentContextLoadSeqRef.current !== loadSeq) {
        return;
      }
      setRecentRequestLinks(requestLinks.filter((item) => item.requestLink.documentId === detail.document.id));
      setDocumentMembers(nextDocumentMembers);
      setSiteMembers(nextSiteMembers);
      setDocumentRequestTasks(nextRequestTasks);
    } catch (error) {
      if (documentContextLoadSeqRef.current !== loadSeq) {
        return;
      }
      setSelectedDocumentDetail(null);
      setMessage(error instanceof Error ? error.message : '문서 상세 조회에 실패했습니다.');
    } finally {
      if (documentContextLoadSeqRef.current === loadSeq) {
        setDocumentDetailLoading(false);
        setRequestContextLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadSites();
  }, [loadSites]);

  React.useEffect(() => {
    void loadDocuments(selectedSiteId);
  }, [loadDocuments, selectedSiteId]);

  React.useEffect(() => {
    void loadDocumentContext(selectedDocumentId);
  }, [loadDocumentContext, selectedDocumentId]);

  React.useEffect(() => {
    setMediaRequestDrafts([]);
    setMediaTagKeyByKind({ photo: '', file: '' });
    setMediaTagColorByKey({});
    setMediaAttachmentValueKeyByKind({ photo: '', file: '' });
    setMediaAssigneeByKind({ photo: '', file: '' });
    setActiveRequestSetupStep(firstRequestSetupStepKey);
  }, [firstRequestSetupStepKey, selectedDocumentId]);

  React.useEffect(() => {
    if (!shouldSyncSelectionQuery || typeof window === 'undefined') {
      return;
    }

    const normalizedSiteId = (selectedDocumentDetail?.document.siteId || selectedSiteId).trim();
    const normalizedDocumentId = selectedDocumentId.trim();
    const nextQueryKey = buildDocumentsSelectionQueryKey(normalizedSiteId, normalizedDocumentId);

    if (selectionQuerySyncRef.current === nextQueryKey) {
      return;
    }

    const nextSearchParams = new URLSearchParams(window.location.search);
    nextSearchParams.delete('siteId');
    nextSearchParams.delete('project');
    nextSearchParams.delete('document');

    if (normalizedSiteId) {
      nextSearchParams.set('projectId', normalizedSiteId);
    } else {
      nextSearchParams.delete('projectId');
    }

    if (normalizedDocumentId) {
      nextSearchParams.set('documentId', normalizedDocumentId);
    } else {
      nextSearchParams.delete('documentId');
    }

    selectionQuerySyncRef.current = nextQueryKey;
    const nextQueryString = nextSearchParams.toString();
    const nextHref = nextQueryString ? `${pathname}?${nextQueryString}` : pathname;
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (currentHref === nextHref) {
      return;
    }

    router.replace(nextHref, { scroll: false });
  }, [
    pathname,
    router,
    selectedDocumentDetail?.document.siteId,
    selectedDocumentId,
    selectedSiteId,
    shouldSyncSelectionQuery,
  ]);

  React.useEffect(() => {
    setSelectedFieldKeys((current) => current.filter((valueKey) => requestableFields.some((field) => field.valueKey === valueKey)));
    setSelectedFieldAssigneeByValueKey((current) => {
      const nextEntries = Object.entries(current).filter(([valueKey]) =>
        requestableFields.some((field) => field.valueKey === valueKey)
      );

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
    setSelectedFieldLabelByValueKey((current) => {
      const nextEntries = Object.entries(current).filter(([valueKey]) =>
        requestableFields.some((field) => field.valueKey === valueKey)
      );

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
    setCanvasFieldLabelByValueKey((current) => {
      const nextEntries = Object.entries(current).filter(([valueKey]) =>
        requestableFields.some((field) => field.valueKey === valueKey)
      );

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
    setMediaRequestDrafts((current) =>
      current.filter(
        (draft) =>
          !draft.attachmentValueKey || requestableFields.some((field) => field.valueKey === draft.attachmentValueKey && field.requestKind === 'file')
      )
    );
  }, [requestableFields]);

  React.useEffect(() => {
    if (typeof document === 'undefined' || requestableFields.length <= 0) {
      setCanvasFieldLabelByValueKey({});
      return;
    }

    let cancelled = false;
    const collectCanvasLabels = () => {
      if (cancelled) {
        return;
      }

      const nextLabels: Record<string, string> = {};

      requestableFields.forEach((field) => {
        const keyGroupId = field.keyFrameGroupId || field.valueKey || field.parentGroupId || '';
        const keySelector = keyGroupId
          ? `[data-template-frame-group="${escapeCssSelectorValue(keyGroupId)}"][data-template-frame-role="key"]`
          : '';
        const keyElement = keySelector ? document.querySelector<HTMLElement>(keySelector) : null;
        const label = readCanvasDisplayText(keyElement);

        if (label && !isGeneratedFieldLabel(label)) {
          nextLabels[field.valueKey] = label;
        }
      });

      setCanvasFieldLabelByValueKey((current) => {
        const currentJson = JSON.stringify(current);
        const nextJson = JSON.stringify(nextLabels);
        return currentJson === nextJson ? current : nextLabels;
      });
    };

    const frameId = window.requestAnimationFrame(collectCanvasLabels);
    const timeoutId = window.setTimeout(collectCanvasLabels, 250);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [requestableFields, selectedDocumentInitialDraft?.draftKey]);

  React.useEffect(() => {
    if (activeFieldValueKey && !selectedFieldKeys.includes(activeFieldValueKey)) {
      setActiveFieldValueKey(selectedFieldKeys[selectedFieldKeys.length - 1] || '');
    }
  }, [activeFieldValueKey, selectedFieldKeys]);

  React.useEffect(() => {
    if (selectedFields.length <= 0) {
      setNewMemberRegistrationOpen(false);
    }
  }, [selectedFields.length]);

  const selectedDocumentDetailLoading =
    documentDetailLoading && Boolean(selectedDocumentId) && (!selectedDocumentDetail || selectedDocumentDetail.document.id !== selectedDocumentId);

  const resolveFieldFromCanvasBox = React.useCallback(
    (box: TemplateCanvasSelectedBox) => {
      const targetTokens = new Set(
        [
          box.id,
          box.valueKey,
          box.slotKey,
          box.frameGroupId,
          box.keyFrameGroupId,
          box.valueFrameGroupId,
          box.contextKey,
          ...(box.highlightFrameGroupIds || []),
        ]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
      );

      return (
        requestableFields.find((item) => item.id === box.id) ||
        requestableFields.find((item) =>
          [item.valueKey, item.keyFrameGroupId, item.valueFrameGroupId, item.contextKey].some(
            (value) => value && targetTokens.has(value)
          )
        ) ||
        null
      );
    },
    [requestableFields]
  );

  const clearCanvasFieldSelection = React.useCallback(() => {
    if (activeMediaRequestKind) {
      setMediaAttachmentValueKeyByKind((current) => ({ ...current, [activeMediaRequestKind]: '' }));
      return;
    }

    setSelectedFieldKeys([]);
    setSelectedFieldLabelByValueKey({});
    setCanvasFieldLabelByValueKey({});
    setActiveFieldValueKey('');
    setNewMemberRegistrationOpen(false);
  }, [activeMediaRequestKind]);

  const selectFieldsFromCanvasBoxes = React.useCallback(
    (boxes: TemplateCanvasSelectedBox[], options?: TemplateCanvasSelectionChangeOptions) => {
      if (boxes.length <= 0) {
        clearCanvasFieldSelection();
        return;
      }

      const fieldEntries = Array.from(
        new Map(
          boxes
            .map((box) => ({ box, field: resolveFieldFromCanvasBox(box) }))
            .filter((entry): entry is { box: TemplateCanvasSelectedBox; field: DocumentRequestableField } =>
              Boolean(entry.field)
            )
            .map((entry) => [entry.field.valueKey, entry])
        ).values()
      );
      const fields = fieldEntries.map((entry) => entry.field);

      if (fields.length <= 0) {
        return;
      }

      if (activeMediaRequestKind) {
        const attachmentEntry = [...fieldEntries].reverse().find((entry) => entry.field.requestKind === 'file') || null;

        if (!attachmentEntry) {
          setMessage('필수 사진/파일 단계에서는 첨부파일 역할 상자만 연결할 수 있습니다.');
          return;
        }

        setMediaAttachmentValueKeyByKind((current) => ({
          ...current,
          [activeMediaRequestKind]: attachmentEntry.field.valueKey,
        }));
        setMessage(null);
        return;
      }

      if (activeRequestSetupStep !== 'box-assignee') {
        return;
      }

      const field = fields[fields.length - 1];
      setActiveFieldValueKey(field.valueKey);
      setSelectedFieldKeys((current) => {
        if (!options?.append) {
          return fields.map((item) => item.valueKey);
        }

        const nextKeys = current.slice();
        fields.forEach((item) => {
          if (!nextKeys.includes(item.valueKey)) {
            nextKeys.push(item.valueKey);
          }
        });
        return nextKeys;
      });
      setSelectedFieldLabelByValueKey((current) => {
        const nextValue = options?.append ? { ...current } : {};
        fieldEntries.forEach(({ box, field }) => {
          const targetLabel = normalizeFieldDisplayText(box.label || '');

          if (targetLabel && !isGeneratedFieldLabel(targetLabel)) {
            nextValue[field.valueKey] = targetLabel;
          }
        });
        return nextValue;
      });
    },
    [activeMediaRequestKind, activeRequestSetupStep, clearCanvasFieldSelection, resolveFieldFromCanvasBox]
  );

  const handleSelectedFieldKeysChange = React.useCallback((nextValueKeys: string[]) => {
    const validValueKeys = Array.from(
      new Set(nextValueKeys.filter((valueKey) => requestableFields.some((field) => field.valueKey === valueKey)))
    );
    const addedValueKey =
      validValueKeys.find((valueKey) => !selectedFieldKeys.includes(valueKey)) ||
      validValueKeys[validValueKeys.length - 1] ||
      '';

    setSelectedFieldKeys(validValueKeys);
    setActiveFieldValueKey(addedValueKey);
    setSelectedFieldLabelByValueKey((current) => {
      const nextLabels: Record<string, string> = {};

      validValueKeys.forEach((valueKey) => {
        const field = requestableFields.find((item) => item.valueKey === valueKey);
        const fieldLabel = normalizeFieldDisplayText(
          current[valueKey] || canvasFieldLabelByValueKey[valueKey] || field?.displayKeyText || ''
        );

        if (fieldLabel && !isGeneratedFieldLabel(fieldLabel)) {
          nextLabels[valueKey] = fieldLabel;
        }
      });

      return nextLabels;
    });
    setSelectedFieldAssigneeByValueKey((current) => {
      const nextAssignees = { ...current };

      Object.keys(nextAssignees).forEach((valueKey) => {
        if (!validValueKeys.includes(valueKey)) {
          delete nextAssignees[valueKey];
        }
      });

      return nextAssignees;
    });
  }, [canvasFieldLabelByValueKey, requestableFields, selectedFieldKeys]);

  const assignSelectedFieldsMember = React.useCallback(
    (memberId: string) => {
      if (selectedFields.length <= 0) {
        setMessage('담당 구성원을 지정할 상자를 먼저 선택하세요.');
        return;
      }

      setSelectedFieldAssigneeByValueKey((current) => {
        const nextValue = { ...current };

        selectedFields.forEach((field) => {
          if (memberId) {
            nextValue[field.valueKey] = memberId;
          } else {
            delete nextValue[field.valueKey];
          }
        });

        return nextValue;
      });
      setMessage(null);
    },
    [selectedFields]
  );

  const createMediaTagOption = React.useCallback((kind: MediaRequestKind, label: string) => {
    const normalizedLabel = label.trim();

    if (!normalizedLabel) {
      return '';
    }

    const tagKey = buildMediaTagKey(kind, normalizedLabel);
    const tagColor = normalizeMediaTagColor(mediaTagColorByKey[tagKey], defaultMediaTagColors[kind]);
    setLocalMediaTagOptions((current) =>
      current.some((option) => option.kind === kind && option.id === tagKey)
        ? current
        : [...current, { kind, id: tagKey, label: normalizedLabel, color: tagColor }]
    );
    setMediaTagColorByKey((current) => ({ ...current, [tagKey]: current[tagKey] || tagColor }));
    setMediaTagKeyByKind((current) => ({ ...current, [kind]: tagKey }));
    return tagKey;
  }, [mediaTagColorByKey]);

  const addMediaRequestDraft = React.useCallback(
    (kind: MediaRequestKind) => {
      const tagKey = mediaTagKeyByKind[kind];
      const tagOption = mediaTagOptionsByKind[kind].find((option) => option.id === tagKey) || null;
      const tagName = tagOption?.label.trim() || '';
      const tagColor = normalizeMediaTagColor(mediaTagColorByKey[tagKey] || tagOption?.color, defaultMediaTagColors[kind]);
      const assigneeMemberId = mediaAssigneeByKind[kind];
      const attachmentValueKey = mediaAttachmentValueKeyByKind[kind];
      const attachmentField = requestableFields.find((field) => field.valueKey === attachmentValueKey && field.requestKind === 'file') || null;
      const requiredCount = Math.max(1, Math.trunc(Number(mediaRequiredCountByKind[kind]) || 1));

      if (!tagName || !tagKey) {
        setMessage(`${mediaRequestTagFieldLabels[kind]}를 먼저 선택하거나 새로 만드세요.`);
        return;
      }

      if (!assigneeMemberId) {
        setMessage(`${mediaRequestKindLabels[kind]} 담당 구성원을 선택하세요.`);
        return;
      }

      const normalizedAttachmentValueKey = attachmentField?.valueKey || '';
      const attachmentLabel = attachmentField ? getFieldLabel(attachmentField) : '';
      const draftId = `${kind}:${tagKey}:${normalizedAttachmentValueKey || 'document'}:${assigneeMemberId}`;
      const nextDraft: MediaRequestDraft = {
        id: draftId,
        kind,
        tagKey,
        tagName,
        tagColor,
        attachmentValueKey: normalizedAttachmentValueKey,
        attachmentLabel,
        assigneeMemberId,
        requiredCount,
      };

      setMediaRequestDrafts((current) => {
        const nextDrafts = current.filter((draft) => draft.id !== draftId);
        return [...nextDrafts, nextDraft];
      });
      setMessage(null);
    },
    [
      mediaAssigneeByKind,
      mediaAttachmentValueKeyByKind,
      mediaRequiredCountByKind,
      mediaTagKeyByKind,
      mediaTagColorByKey,
      mediaTagOptionsByKind,
      requestableFields,
    ]
  );

  const removeMediaRequestDraft = React.useCallback((draftId: string) => {
    setMediaRequestDrafts((current) => current.filter((draft) => draft.id !== draftId));
  }, []);

  const handleRegisterMemberForDocument = async () => {
    const documentId = selectedDocumentDetail?.document.id || selectedDocumentId;
    const phoneNumber = newMemberPhone.trim();
    const displayName = newMemberName.trim();

    if (!documentId) {
      setMessage('구성원을 등록할 문서를 먼저 선택하세요.');
      return null;
    }

    if (selectedFields.length <= 0) {
      setMessage('새 구성원을 담당자로 지정할 상자를 먼저 선택하세요.');
      return null;
    }

    if (!phoneNumber) {
      setMessage('등록할 구성원 번호를 입력하세요.');
      return null;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      const result = await DocumentsOwnerClient.inviteDocumentMember({
        documentId,
        phoneNumber,
        displayName: displayName || null,
        accessRole: selectedFields.every((field) => field.requestKind === 'signature') ? 'signer' : 'editor',
      });
      await loadDocumentContext(documentId);
      assignSelectedFieldsMember(result.membership.member.id);
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberRegistrationOpen(false);
      setMessage(`${formatPhoneNumber(result.membership.member.phoneNumber)} 구성원을 현재 문서에 등록했습니다.`);
      return result.membership.member;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '구성원 등록에 실패했습니다.');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRequestLink = async () => {
    const activeDocument = selectedDocumentDetail?.document;

    if (!activeDocument) {
      setMessage('요청 링크를 만들 문서를 먼저 선택하세요.');
      return;
    }

    if (requestLinkSelectedFields.length === 0 && requestLinkMediaRequestDrafts.length === 0) {
      setMessage('상자 담당자나 필수 사진/파일 요청을 하나 이상 지정하세요.');
      return;
    }

    const missingAssigneeField = requestLinkSelectedFields.find((field) => !selectedFieldAssigneeByValueKey[field.valueKey]);
    if (missingAssigneeField) {
      setActiveRequestSetupStep(firstRequestSetupStepKey);
      setActiveFieldValueKey(missingAssigneeField.valueKey);
      setMessage('담당 구성원을 선택한 상자 전체에 지정하세요.');
      return;
    }

    const normalizedExpiresAt = new Date(expiresAt);
    if (Number.isNaN(normalizedExpiresAt.getTime())) {
      setMessage('만료 시각을 다시 입력하세요.');
      return;
    }

    setActionLoading(true);
      setMessage(null);

    try {
      const documentContent = selectedDocumentInitialDraft?.draftHtml || selectedDocumentDetail?.latestVersion?.htmlCanonical || '';
      const tasksByAssignee = new Map<string, DocumentRequestTaskInput[]>();
      const fieldsByAssignee = requestLinkSelectedFields.reduce<Map<string, DocumentRequestableField[]>>((map, field) => {
        const assigneeMemberId = selectedFieldAssigneeByValueKey[field.valueKey];
        map.set(assigneeMemberId, [...(map.get(assigneeMemberId) || []), field]);
        return map;
      }, new Map());

      fieldsByAssignee.forEach((fields, assigneeMemberId) => {
        tasksByAssignee.set(assigneeMemberId, buildRequestTasks(fields));
      });
      requestLinkMediaRequestDrafts.forEach((draft) => {
        const attachmentField =
          requestableFields.find((field) => field.valueKey === draft.attachmentValueKey && field.requestKind === 'file') || null;
        tasksByAssignee.set(draft.assigneeMemberId, [
          ...(tasksByAssignee.get(draft.assigneeMemberId) || []),
          buildMediaRequestTask(draft, attachmentField),
        ]);
      });

      const createdLinks: Array<{ requestLink: DocumentsOwnerRecentRequestLink['requestLink']; requestUrl: string }> = [];

      for (const [assigneeMemberId, rawTasks] of tasksByAssignee.entries()) {
        const targetMember = memberOptions.find((option) => option.memberId === assigneeMemberId) || null;

        if (!targetMember) {
          throw new Error('담당 구성원 정보를 찾지 못했습니다.');
        }

        const requestTasks = await Promise.all(
          rawTasks.map(async (task) => {
            if (task.kind !== 'signature') {
              return task;
            }

            if (!documentContent.trim()) {
              throw new Error('서명 요청을 만들 문서 본문을 찾지 못했습니다.');
            }

            const existingRequestId = findExistingSignatureRequestId(selectedDocumentDetail, task, targetMember);

            if (existingRequestId) {
              return {
                ...task,
                linkedExternalId: existingRequestId,
              };
            }

            const signRequest = await DocumentsOwnerClient.createSignatureRequest({
              documentId: activeDocument.id,
              signatureSlotKey: task.slotKey || task.valueKey || task.targetKey,
              documentContent,
              signerName: targetMember.displayName,
              phoneNumber: targetMember.phoneNumber,
            });

            return {
              ...task,
              linkedExternalId: signRequest.id,
            };
          })
        );
        const allowedLabels = Array.from(
          new Set(
            requestTasks
              .map((task) => task.valueKey || task.targetKey)
              .map((value) => String(value || '').trim())
              .filter((value) => Boolean(value))
          )
        );
        const createResult = await DocumentsOwnerClient.createRequestLink({
          documentId: activeDocument.id,
          allowedLabels,
          recipientChannel: 'sms',
          recipientTarget: targetMember.phoneNumber,
          recipientName: targetMember.displayName,
          expiresAt: normalizedExpiresAt.toISOString(),
          requestedBy: 'documents-owner',
        });

        await DocumentsOwnerClient.saveRequestTasks({
          documentId: activeDocument.id,
          requestLinkId: createResult.requestLink.id,
          assigneeMemberId: targetMember.memberId,
          tasks: requestTasks,
        });
        const dispatchUrl = await DocumentsOwnerClient.issueDispatchUrl(createResult.requestLink.id);
        createdLinks.push({
          requestLink: createResult.requestLink,
          requestUrl: `${window.location.origin}${dispatchUrl.maskedUrl}`,
        });
      }

      setLatestCreatedRequestLinks(createdLinks);
      await loadDocumentContext(activeDocument.id);
      setMessage(`${createdLinks.length}명의 담당 구성원에게 보낼 요청 링크를 만들었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '요청 링크 생성에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSiteSelectionChange = React.useCallback((nextSiteId: string) => {
    setSelectedSiteId(nextSiteId);
    setSelectedDocumentId('');
    setSelectedDocumentDetail(null);
    setRecentRequestLinks([]);
    setDocumentRequestTasks([]);
    setDocumentMembers([]);
    setSiteMembers([]);
    setSelectedFieldKeys([]);
    setSelectedFieldLabelByValueKey({});
    setCanvasFieldLabelByValueKey({});
    setMediaRequestDrafts([]);
    setMediaTagKeyByKind({ photo: '', file: '' });
    setMediaTagColorByKey({});
    setMediaAttachmentValueKeyByKind({ photo: '', file: '' });
    setMediaAssigneeByKind({ photo: '', file: '' });
    setActiveFieldValueKey('');
    setNewMemberRegistrationOpen(false);
    setActiveRequestSetupStep(firstRequestSetupStepKey);
  }, [firstRequestSetupStepKey]);

  const moveRequestSetupStep = React.useCallback((offset: number) => {
    setActiveRequestSetupStep((currentStep) => {
      const currentIndex = requestSetupSteps.findIndex((step) => step.key === currentStep);
      const nextIndex = Math.min(Math.max((currentIndex >= 0 ? currentIndex : 0) + offset, 0), requestSetupSteps.length - 1);
      return requestSetupSteps[nextIndex]?.key || firstRequestSetupStepKey;
    });
  }, [firstRequestSetupStepKey, requestSetupSteps]);

  const updateMediaTagColor = React.useCallback((kind: MediaRequestKind, tagKey: string, nextColor: string) => {
    const normalizedTagKey = tagKey.trim();

    if (!normalizedTagKey) {
      return;
    }

    const normalizedColor = normalizeMediaTagColor(nextColor, defaultMediaTagColors[kind]);
    setMediaTagColorByKey((current) => ({ ...current, [normalizedTagKey]: normalizedColor }));
    setLocalMediaTagOptions((current) =>
      current.map((option) =>
        option.kind === kind && option.id === normalizedTagKey ? { ...option, color: normalizedColor } : option
      )
    );
  }, []);

  const renderRequestSetupNavigation = () => (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3"
      {...documentsOwnerItem('request-setup-step-actions', '요청 링크 설정 단계 이동 버튼 영역')}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={requestSetupStepIsFirst}
        {...documentsOwnerItem('request-setup-previous-button', '요청 링크 설정 이전 단계 버튼')}
        onClick={() => moveRequestSetupStep(-1)}
      >
        이전으로 가기
      </Button>
      {!requestSetupStepIsLast ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            {...documentsOwnerItem('request-setup-skip-button', '요청 링크 설정 현재 단계 건너뛰기 버튼')}
            onClick={() => moveRequestSetupStep(1)}
          >
            건너뛰기
          </Button>
          <Button
            type="button"
            size="sm"
            {...documentsOwnerItem('request-setup-next-button', '요청 링크 설정 다음 단계 버튼')}
            onClick={() => moveRequestSetupStep(1)}
          >
            다음 단계
          </Button>
        </div>
      ) : null}
    </div>
  );

  const renderMediaRequestPanel = (kind: MediaRequestKind) => {
    const tagOptions = mediaTagOptionsByKind[kind];
    const selectedTagKey = mediaTagKeyByKind[kind];
    const assigneeMemberId = mediaAssigneeByKind[kind];
    const selectedAssignee = memberOptions.find((option) => option.memberId === assigneeMemberId) || null;
    const selectedTag = tagOptions.find((option) => option.id === selectedTagKey) || null;
    const selectedTagColor = normalizeMediaTagColor(
      mediaTagColorByKey[selectedTagKey] || selectedTag?.color,
      defaultMediaTagColors[kind]
    );
    const drafts = mediaRequestDrafts.filter((draft) => draft.kind === kind);

    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" {...documentsOwnerItem(`${kind}-required-request-panel`, `${mediaRequestKindLabels[kind]} 요청 설정 패널`)}>
        <div className="flex items-center justify-between gap-3" {...documentsOwnerItem(`${kind}-required-request-panel-header`, `${mediaRequestKindLabels[kind]} 요청 설정 머리글`)}>
          <div>
            <p className="text-sm font-medium text-slate-900" {...documentsOwnerItem(`${kind}-required-request-panel-title`, `${mediaRequestKindLabels[kind]} 요청 설정 제목`)}>
              {mediaRequestKindLabels[kind]}
            </p>
            <p className="mt-1 text-xs text-slate-500" {...documentsOwnerItem(`${kind}-required-request-panel-description`, `${mediaRequestKindLabels[kind]} 요청 설정 설명`)}>
              태그, 첨부파일 상자 연결 여부, 담당자를 정합니다.
            </p>
          </div>
          <Badge variant="slate" {...documentsOwnerItem(`${kind}-required-request-count-badge`, `${mediaRequestKindLabels[kind]} 요청 개수 배지`)}>
            {drafts.length}개
          </Badge>
        </div>

        <div className="space-y-2" {...documentsOwnerItem(`${kind}-required-tag-field`, `${mediaRequestKindLabels[kind]} 태그 선택 항목`)}>
          <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem(`${kind}-required-tag-label`, `${mediaRequestKindLabels[kind]} 태그 선택 라벨`)}>
            {mediaRequestTagFieldLabels[kind]}
          </label>
          <EntityPicker
            value={selectedTagKey}
            options={tagOptions}
            onChange={(value) => setMediaTagKeyByKind((current) => ({ ...current, [kind]: value }))}
            onCreateOption={(label) => {
              createMediaTagOption(kind, label);
            }}
            createOptionLabel="새 태그 만들기"
            placeholder={`${mediaRequestTagFieldLabels[kind]} 선택`}
            searchPlaceholder="태그 검색 또는 새 태그 입력"
            emptyMessage="등록된 태그가 없습니다. 입력해서 새로 만드세요."
            optionLayout="inline"
          />
        </div>

        <div className="space-y-2" {...documentsOwnerItem(`${kind}-required-tag-color-field`, `${mediaRequestKindLabels[kind]} 태그 색상 항목`)}>
          <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem(`${kind}-required-tag-color-label`, `${mediaRequestKindLabels[kind]} 태그 색상 라벨`)}>
            태그 색상
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={selectedTagColor}
              disabled={!selectedTagKey}
              onChange={(event) => updateMediaTagColor(kind, selectedTagKey, event.target.value)}
              className="h-9 w-14 shrink-0 p-1"
              {...documentsOwnerItem(`${kind}-required-tag-color-input`, `${mediaRequestKindLabels[kind]} 태그 색상 입력`)}
            />
            <span
              className="inline-flex min-w-0 max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{
                borderColor: selectedTagKey ? selectedTagColor : '#cbd5e1',
                backgroundColor: selectedTagKey ? `${selectedTagColor}1a` : '#f1f5f9',
                color: selectedTagKey ? selectedTagColor : '#64748b',
              }}
              {...documentsOwnerItem(`${kind}-required-tag-color-preview`, `${mediaRequestKindLabels[kind]} 태그 색상 미리보기`)}
            >
              {selectedTag?.label || '태그 선택 필요'}
            </span>
          </div>
        </div>

        <div className="space-y-2" {...documentsOwnerItem(`${kind}-required-attachment-field`, `${mediaRequestKindLabels[kind]} 첨부파일 상자 연결 항목`)}>
          <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem(`${kind}-required-attachment-label`, `${mediaRequestKindLabels[kind]} 첨부파일 상자 연결 라벨`)}>
            첨부파일 상자
          </label>
          <EntityPicker
            value={mediaAttachmentValueKeyByKind[kind]}
            options={attachmentFieldOptions}
            onChange={(value) => setMediaAttachmentValueKeyByKind((current) => ({ ...current, [kind]: value }))}
            placeholder="문서에 직접 등록"
            searchPlaceholder="첨부파일 상자 검색"
            emptyMessage="연결 가능한 첨부파일 상자가 없습니다."
            optionLayout="inline"
          />
          <p className="text-xs text-slate-500" {...documentsOwnerItem(`${kind}-required-attachment-help`, `${mediaRequestKindLabels[kind]} 첨부파일 상자 연결 도움말`)}>
            상자 지정은 선택입니다. 지정하려면 첨부파일 역할 상자만 고를 수 있습니다.
          </p>
        </div>

        <div className="space-y-2" {...documentsOwnerItem(`${kind}-required-assignee-field`, `${mediaRequestKindLabels[kind]} 담당 구성원 항목`)}>
          <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem(`${kind}-required-assignee-label`, `${mediaRequestKindLabels[kind]} 담당 구성원 라벨`)}>
            담당 구성원
          </label>
          <EntityPicker
            value={assigneeMemberId}
            options={memberOptions}
            onChange={(value) => setMediaAssigneeByKind((current) => ({ ...current, [kind]: value }))}
            placeholder="담당 구성원 검색"
            searchPlaceholder="이름 또는 번호 검색"
            emptyMessage="현재 문서 접근 구성원이 없습니다."
            optionLayout="inline"
          />
        </div>

        <div className="space-y-2" {...documentsOwnerItem(`${kind}-required-count-field`, `${mediaRequestKindLabels[kind]} 필요 개수 항목`)}>
          <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem(`${kind}-required-count-label`, `${mediaRequestKindLabels[kind]} 필요 개수 라벨`)}>
            필요 개수
          </label>
          <Input
            type="number"
            min={1}
            value={String(mediaRequiredCountByKind[kind])}
            onChange={(event) =>
              setMediaRequiredCountByKind((current) => ({
                ...current,
                [kind]: Math.max(1, Math.trunc(Number(event.target.value) || 1)),
              }))
            }
            {...documentsOwnerItem(`${kind}-required-count-input`, `${mediaRequestKindLabels[kind]} 필요 개수 입력`)}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          {...documentsOwnerItem(`${kind}-required-add-button`, `${mediaRequestKindLabels[kind]} 요청 추가 버튼`)}
          onClick={() => addMediaRequestDraft(kind)}
        >
          {mediaRequestKindLabels[kind]} 요청 추가
        </Button>

        {selectedTag || selectedAssignee ? (
          <p className="text-xs text-slate-600" {...documentsOwnerItem(`${kind}-required-current-summary`, `${mediaRequestKindLabels[kind]} 현재 선택 요약`)}>
            {selectedTag ? `태그: ${selectedTag.label}` : '태그 미선택'}
            {' · '}
            {selectedAssignee ? `담당: ${selectedAssignee.label}` : '담당 미선택'}
          </p>
        ) : null}

        {drafts.length > 0 ? (
          <div className="space-y-2" {...documentsOwnerItem(`${kind}-required-draft-list`, `${mediaRequestKindLabels[kind]} 요청 초안 목록`)}>
            {drafts.map((draft) => {
              const assignee = memberOptions.find((option) => option.memberId === draft.assigneeMemberId) || null;

              return (
                <div
                  key={draft.id}
                  className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600"
                  {...documentsOwnerItem(`${kind}-required-draft-row`, `${mediaRequestKindLabels[kind]} 요청 초안 - ${draft.tagName}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex min-w-0 flex-wrap items-center gap-1 font-medium text-slate-900">
                        <span
                          className="inline-flex min-w-0 max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor: draft.tagColor,
                            backgroundColor: `${draft.tagColor}1a`,
                            color: draft.tagColor,
                          }}
                        >
                          {draft.tagName}
                        </span>
                      </p>
                      <p className="mt-1">
                        {draft.attachmentLabel ? `상자: ${draft.attachmentLabel}` : '문서에 직접 등록'} · {draft.requiredCount}개 · 담당: {assignee?.label || '-'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                      {...documentsOwnerItem(`${kind}-required-draft-remove-button`, `${mediaRequestKindLabels[kind]} 요청 초안 제거 - ${draft.tagName}`)}
                      onClick={() => removeMediaRequestDraft(draft.id)}
                    >
                      제거
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderExpirationRequestPanel = () => {
    const assignedFieldCount = requestLinkSelectedFields.filter((field) => selectedFieldAssigneeByValueKey[field.valueKey]).length;
    const totalRequestCount = requestLinkSelectedFields.length + requestLinkMediaRequestDrafts.length;
    const expirationRemainingTime = formatExpirationRemainingTime(expiresAt, currentTimeMs);

    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" {...documentsOwnerItem('request-link-action-panel', '요청 링크 실행 설정 패널')}>
        <div className="flex items-center justify-between gap-3" {...documentsOwnerItem('request-link-action-panel-header', '요청 링크 실행 설정 머리글')}>
          <div>
            <p className="text-sm font-medium text-slate-900" {...documentsOwnerItem('request-link-action-panel-title', '요청 링크 실행 설정 제목')}>
              만료 시각 설정
            </p>
            <p className="mt-1 text-xs text-slate-500" {...documentsOwnerItem('request-link-action-panel-description', '요청 링크 실행 설정 설명')}>
              담당자별 요청 링크의 유효 시간을 정합니다.
            </p>
          </div>
          <Badge variant="slate" {...documentsOwnerItem('request-link-action-count-badge', '요청 링크 실행 설정 요청 개수 배지')}>
            {totalRequestCount}개
          </Badge>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600" {...documentsOwnerItem('request-link-action-summary', '요청 링크 실행 설정 요약')}>
          상자 담당자 {assignedFieldCount}/{requestLinkSelectedFields.length}개 · 필수 사진/파일 {requestLinkMediaRequestDrafts.length}개
        </div>

        <div className="space-y-2" {...documentsOwnerItem('request-link-expiration-field', '요청 링크 만료 시각 항목')}>
          <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem('request-link-expiration-label', '요청 링크 만료 시각 라벨')}>
            만료 시각
          </label>
          <p className="text-sm font-medium text-slate-900" {...documentsOwnerItem('request-link-expiration-relative-time', '요청 링크 만료까지 남은 시간')}>
            {expirationRemainingTime}
          </p>
          <Input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            {...documentsOwnerItem('request-link-expiration-input', '요청 링크 만료 시각 입력')}
          />
        </div>

        <Button
          type="button"
          {...documentsOwnerItem('request-link-create-button', '요청 링크 만들기 버튼')}
          onClick={() => void handleCreateRequestLink()}
          disabled={loading}
        >
          요청 링크 만들기
        </Button>

        {latestCreatedRequestLinks.length > 0 ? (
          <div
            className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            {...documentsOwnerItem('created-request-link-list', '방금 만든 요청 링크 목록')}
          >
            {latestCreatedRequestLinks.map(({ requestLink, requestUrl }) => (
              <div
                key={requestLink.id}
                className="space-y-1 rounded-md border border-slate-200 bg-white p-2"
                {...documentsOwnerItem('created-request-link-card', `방금 만든 요청 링크 - ${requestLink.recipientName || requestLink.recipientTarget || requestLink.id}`)}
              >
                <div className="flex flex-wrap items-center gap-2" {...documentsOwnerItem('created-request-link-card-header', '방금 만든 요청 링크 머리글')}>
                  <Badge variant={getStatusVariant(requestLink.status)} {...documentsOwnerItem('created-request-link-status', '방금 만든 요청 링크 상태')}>
                    {requestLink.status}
                  </Badge>
                  <span className="font-medium text-slate-900" {...documentsOwnerItem('created-request-link-recipient-name', '방금 만든 요청 링크 수신자 이름')}>
                    {requestLink.recipientName || '-'}
                  </span>
                </div>
                <p {...documentsOwnerItem('created-request-link-recipient-phone', '방금 만든 요청 링크 수신 번호')}>
                  수신 번호: {formatPhoneNumber(requestLink.recipientTarget)}
                </p>
                <a
                  href={requestUrl}
                  className="break-all text-xs font-medium text-slate-700 underline underline-offset-4"
                  {...documentsOwnerItem('created-request-link-url', '방금 만든 요청 링크 주소')}
                >
                  {requestUrl}
                </a>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderDocumentSelectPanel = () => {
    if (!documentPickerEnabled) {
      return null;
    }

    return (
      <Card className="border-slate-200" {...documentsOwnerItem('document-select-panel', '1. 작업할 문서 고르기 패널')}>
        <CardHeader {...documentsOwnerItem('document-select-panel-header', '작업할 문서 고르기 제목 영역')}>
          <CardTitle {...documentsOwnerItem('document-select-panel-title', '작업할 문서 고르기 제목')}>1. 작업할 문서 고르기</CardTitle>
          <CardDescription {...documentsOwnerItem('document-select-panel-description', '작업할 문서 고르기 설명')}>
            현장과 문서를 고르면 아래에서 요청 링크 설정을 진행합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" {...documentsOwnerItem('document-select-panel-content', '작업할 문서 고르기 내용')}>
          <div className="space-y-2" {...documentsOwnerItem('site-picker-field', '현장 선택 항목')}>
            <label className="text-sm font-medium text-slate-800" {...documentsOwnerItem('site-picker-label', '현장 선택 라벨')}>
              현장 선택
            </label>
            <EntityPicker
              value={selectedSiteId}
              options={siteOptions}
              onChange={handleSiteSelectionChange}
              placeholder="현장을 선택하세요"
              emptyMessage="저장된 현장이 없습니다."
            />
          </div>
          <div className="space-y-2" {...documentsOwnerItem('document-picker-field', '문서 선택 항목')}>
            <label className="text-sm font-medium text-slate-800" {...documentsOwnerItem('document-picker-label', '문서 선택 라벨')}>
              문서 선택
            </label>
            <EntityPicker
              value={selectedDocumentId}
              options={documentOptions}
              onChange={setSelectedDocumentId}
              placeholder="문서를 선택하세요"
              emptyMessage="선택 가능한 문서가 없습니다."
            />
          </div>
          {selectedDocumentDetail ? (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              {...documentsOwnerItem('selected-document-summary', '선택한 문서 요약')}
            >
              <div className="flex flex-wrap items-center gap-2" {...documentsOwnerItem('selected-document-summary-header', '선택한 문서 요약 머리글')}>
                <Badge
                  variant={getStatusVariant(selectedDocumentDetail.document.status)}
                  {...documentsOwnerItem('selected-document-status', '선택한 문서 상태')}
                >
                  {selectedDocumentDetail.document.status}
                </Badge>
                <span className="font-medium text-slate-900" {...documentsOwnerItem('selected-document-title', '선택한 문서 제목')}>
                  {selectedDocumentDetail.document.title}
                </span>
              </div>
              <p className="mt-2" {...documentsOwnerItem('selected-document-type', '선택한 문서 종류')}>
                문서 종류: {selectedDocumentDetail.document.documentTypeKey}
              </p>
              <p {...documentsOwnerItem('selected-document-latest-version', '선택한 문서 최신 버전')}>
                최신 버전: {selectedDocumentDetail.latestVersion?.versionNumber || '-'}
              </p>
              <p {...documentsOwnerItem('selected-document-recent-link-count', '선택한 문서 최근 요청 링크 수')}>
                최근 요청 링크: {recentRequestLinks.length}건
              </p>
            </div>
          ) : selectedDocumentDetailLoading ? (
            <div
              className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
              role="status"
              aria-live="polite"
              {...documentsOwnerItem('document-select-loading-state', '작업할 문서 고르기 로딩 상태')}
            >
              <div className="flex items-center gap-3" {...documentsOwnerItem('document-select-loading-row', '작업할 문서 고르기 로딩 줄')}>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" aria-hidden="true" />
                <span className="font-medium text-slate-900" {...documentsOwnerItem('document-select-loading-title', '문서 로딩 중 표시')}>
                  문서 로딩 중
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500" {...documentsOwnerItem('document-select-loading-description', '문서 로딩 설명')}>
                선택한 문서 정보를 불러오고 있습니다.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500" {...documentsOwnerItem('document-select-empty-state', '작업할 문서 고르기 빈 상태')}>
              먼저 작업할 문서를 고르세요.
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderRequestLinkSetup = () => {
    if (requestSetupSteps.length <= 0 || !currentRequestSetupStep) {
      return (
        <div
          className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500"
          {...documentsOwnerItem('request-link-setup-disabled-state', '요청 링크 설정 단계 꺼짐 안내')}
        >
          켜진 작업 단계가 없습니다. 문서 기능 설정에서 필요한 단계를 켜세요.
        </div>
      );
    }

    return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" {...documentsOwnerItem('request-link-setup-layout', '요청 링크 설정 2열 배치')}>
      <div className="min-w-0">
        {selectedDocumentInitialDraft ? (
          <CanvasOwnedWorkspace
            surface={surface === 'project' ? 'project' : 'documents'}
            key={selectedDocumentInitialDraft.draftKey}
            initialDraft={selectedDocumentInitialDraft}
            workspaceMode="read"
            hideHeader
            hidePersistencePanel
            applyStoredCanvasOwnerSettings={surfaceOwnerSettings.applyStoredCanvasOwnerSettings}
            suppressInitialDraftLoadedMessage
            templateNameReadOnly
            saveDisabled
            canvasSelectablePolicy={canvasSelectablePolicy}
            selectedCanvasBoxes={selectedCanvasBoxes}
            onCanvasSelectionChange={selectFieldsFromCanvasBoxes}
          />
        ) : (
          <div
            className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500"
            {...documentsOwnerItem('request-link-canvas-empty-state', '요청 링크 설정 문서 본문 없음 안내')}
          >
            표시할 문서 본문이 없습니다.
          </div>
        )}
      </div>

      <aside
        className="min-w-0 space-y-4 border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
        {...documentsOwnerItem('request-link-settings-column', '요청 링크 설정 오른쪽 설정 열')}
      >
        <div className="space-y-3" {...documentsOwnerItem('request-setup-stepper', '요청 링크 설정 단계 선택 영역')}>
          <div className="grid grid-cols-1 gap-2" {...documentsOwnerItem('request-setup-step-list', '요청 링크 설정 단계 목록')}>
            {requestSetupSteps.map((step, index) => {
              const active = step.key === activeRequestSetupStep;

              return (
                <button
                  key={step.key}
                  type="button"
                  className={cn(
                    'min-h-10 rounded-md border px-3 py-2 text-left text-xs transition',
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  )}
                  {...documentsOwnerItem('request-setup-step-button', `요청 링크 설정 단계 버튼 - ${step.label}`)}
                  onClick={() => setActiveRequestSetupStep(step.key)}
                >
                  <span className={active ? 'font-semibold text-white' : 'font-semibold text-slate-900'}>
                    {index + 1}. {step.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
            {...documentsOwnerItem('request-setup-active-step-summary', '요청 링크 설정 현재 단계 요약')}
          >
            <p className="text-[11px] font-semibold text-slate-500" {...documentsOwnerItem('request-setup-active-step-count', '요청 링크 설정 현재 단계 번호')}>
              단계 {activeRequestSetupStepIndex + 1} / {requestSetupStepCount}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900" {...documentsOwnerItem('request-setup-active-step-title', '요청 링크 설정 현재 단계 제목')}>
              {currentRequestSetupStep.label}
            </p>
            <p className="mt-1 text-xs text-slate-500" {...documentsOwnerItem('request-setup-active-step-description', '요청 링크 설정 현재 단계 설명')}>
              {currentRequestSetupStep.description}
            </p>
          </div>
        </div>

        <div className="space-y-4" {...documentsOwnerItem('request-setup-active-step-panel', '요청 링크 설정 현재 단계 내용')}>
          {activeRequestSetupStep === 'box-assignee' ? (
        <div className="space-y-3" {...documentsOwnerItem('selected-box-panel', '선택한 상자 패널')}>
          <div className="flex items-center justify-between gap-3" {...documentsOwnerItem('selected-box-panel-header', '선택한 상자 패널 머리글')}>
            <div className="text-sm font-medium text-slate-900" {...documentsOwnerItem('selected-box-panel-title', '선택한 상자 패널 제목')}>
              선택한 상자
            </div>
            <Badge variant="slate" {...documentsOwnerItem('selected-box-count-badge', '선택한 상자 개수 배지')}>
              {selectedFields.length}개
            </Badge>
          </div>

          <div className="space-y-2" {...documentsOwnerItem('selected-box-field-picker', '선택한 상자 셀렉트 박스 항목')}>
            <label className="text-xs font-medium text-slate-700" {...documentsOwnerItem('selected-box-field-picker-label', '선택한 상자 셀렉트 박스 라벨')}>
              상자 선택
            </label>
            <MultiEntityPicker
              values={selectedFieldKeys}
              options={selectableFieldOptions}
              onChange={handleSelectedFieldKeysChange}
              placeholder="상자를 선택하세요"
              searchPlaceholder="키 이름으로 상자 검색"
              emptyMessage="선택 가능한 상자가 없습니다."
              optionLayout="inline"
              allowClear
              triggerClassName="transition-colors hover:border-slate-400"
            />
          </div>

          <div className="space-y-3" {...documentsOwnerItem('selected-box-assignee-field', '선택한 상자 담당 구성원 일괄 지정 영역')}>
            <div className="space-y-1" {...documentsOwnerItem('selected-box-assignee-label', '선택한 상자 담당 구성원 일괄 지정 설명')}>
              <p className="text-sm font-medium text-slate-800">담당 구성원</p>
              <p className="text-xs text-slate-500">현재 선택된 모든 상자에 같은 담당 구성원을 지정합니다.</p>
            </div>
            <div {...documentsOwnerItem('selected-box-assignee-picker', '선택한 상자 담당 구성원 일괄 선택')}>
              <EntityPicker
                value={selectedFieldAssigneeState.value}
                options={memberOptions}
                onChange={assignSelectedFieldsMember}
                placeholder={
                  selectedFields.length <= 0
                    ? '상자를 먼저 선택하세요'
                    : selectedFieldAssigneeState.mixed
                      ? '여러 담당자'
                      : '담당 구성원 검색'
                }
                searchPlaceholder="이름 또는 번호 검색"
                emptyMessage="현재 문서 접근 구성원이 없습니다."
                optionLayout="inline"
                disabled={selectedFields.length <= 0}
              />
            </div>
            {selectedBatchAssignee ? (
              <p
                className="text-xs text-slate-600"
                {...documentsOwnerItem('selected-box-assignee-summary', '선택한 상자 담당 구성원 일괄 지정 요약')}
              >
                {selectedBatchAssignee.label} · {selectedBatchAssignee.meta} · 선택한 상자 {selectedFields.length}개에 지정됨
              </p>
            ) : selectedFieldAssigneeState.mixed ? (
              <p
                className="text-xs text-slate-600"
                {...documentsOwnerItem('selected-box-assignee-mixed-summary', '선택한 상자 담당 구성원 혼합 상태')}
              >
                {selectedFieldAssigneeState.assignedCount}개 지정, {selectedFieldAssigneeState.unassignedCount}개 미지정 상태입니다. 구성원을 선택하면 모두 같은 담당자로 바뀝니다.
              </p>
            ) : (
              <p
                className="text-xs text-slate-600"
                {...documentsOwnerItem('selected-box-assignee-empty-help', '선택한 상자 담당 구성원 일괄 지정 도움말')}
              >
                선택한 상자의 값을 책임지고 기록할 구성원을 한 번에 지정하세요.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedFields.length <= 0}
              {...documentsOwnerItem('new-member-registration-toggle-button', '새 구성원 등록 열기 버튼 - 선택한 상자 일괄 담당자')}
              onClick={() => setNewMemberRegistrationOpen((current) => !current)}
            >
              + 새 구성원 등록
            </Button>

            {newMemberRegistrationOpen ? (
              <div
                className="space-y-2 rounded-md border border-slate-200 bg-white p-3"
                {...documentsOwnerItem('new-member-registration-panel', '새 구성원 등록 패널 - 선택한 상자 일괄 담당자')}
              >
                <div className="text-sm font-medium text-slate-900" {...documentsOwnerItem('new-member-registration-title', '새 구성원 등록 제목 - 선택한 상자 일괄 담당자')}>
                  새 구성원 등록
                </div>
                <Input
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="이름"
                  {...documentsOwnerItem('new-member-name-input', '새 구성원 이름 입력 - 선택한 상자 일괄 담당자')}
                />
                <Input
                  value={newMemberPhone}
                  onChange={(event) => setNewMemberPhone(event.target.value)}
                  placeholder="휴대폰 번호"
                  inputMode="tel"
                  {...documentsOwnerItem('new-member-phone-input', '새 구성원 휴대폰 번호 입력 - 선택한 상자 일괄 담당자')}
                />
                <Button
                  type="button"
                  variant="outline"
                  {...documentsOwnerItem('new-member-register-button', '선택한 모든 상자 담당자로 등록 버튼')}
                  onClick={() => void handleRegisterMemberForDocument()}
                  disabled={loading || selectedFields.length <= 0}
                >
                  등록하고 선택한 상자에 일괄 지정
                </Button>
                <p className="text-xs text-slate-500" {...documentsOwnerItem('new-member-registration-help', '새 구성원 등록 도움말 - 선택한 상자 일괄 담당자')}>
                  새 구성원은 현재 문서에 등록되고 선택한 모든 상자의 담당자로 지정됩니다.
                </p>
              </div>
            ) : null}
          </div>
        </div>
          ) : null}
          {activeRequestSetupStep === 'photo' ? renderMediaRequestPanel('photo') : null}
          {activeRequestSetupStep === 'file' ? renderMediaRequestPanel('file') : null}
          {activeRequestSetupStep === 'expiration' ? renderExpirationRequestPanel() : null}
          {renderRequestSetupNavigation()}
        </div>
      </aside>
    </div>
    );
  };

  const renderHistoryPanel = () => {
    if (!surfaceOwnerSettings.showHistoryPanel || !selectedDocumentDetail) {
      return null;
    }

    return (
      <Card className="border-slate-200" {...documentsOwnerItem('document-history-panel', '이 문서 기록 패널')}>
        <CardHeader {...documentsOwnerItem('document-history-panel-header', '이 문서 기록 제목 영역')}>
          <CardTitle {...documentsOwnerItem('document-history-panel-title', '이 문서 기록 제목')}>
            {documentPickerEnabled ? '3. 이 문서 기록' : '이 문서 기록'}
          </CardTitle>
          <CardDescription {...documentsOwnerItem('document-history-panel-description', '이 문서 기록 설명')}>
            현재 문서의 버전과 요청 링크 기록을 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" {...documentsOwnerItem('document-history-panel-content', '이 문서 기록 내용')}>
          <div className="space-y-2" {...documentsOwnerItem('version-history-section', '버전 이력 항목')}>
            <p className="text-sm font-medium text-slate-800" {...documentsOwnerItem('version-history-title', '버전 이력 제목')}>
              버전 이력
            </p>
            {selectedDocumentDetail.versions.length > 0 ? (
              <div className="space-y-2" {...documentsOwnerItem('version-history-list', '버전 이력 목록')}>
                {selectedDocumentDetail.versions.map((version) => (
                  <div
                    key={version.id}
                    className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600"
                    {...documentsOwnerItem('version-history-card', `버전 이력 카드 - 버전 ${version.versionNumber}`)}
                  >
                    <p className="font-medium text-slate-900" {...documentsOwnerItem('version-history-version-number', `버전 번호 - ${version.versionNumber}`)}>
                      버전 {version.versionNumber}
                    </p>
                    <p {...documentsOwnerItem('version-history-change-reason', `버전 변경 사유 - ${version.versionNumber}`)}>
                      변경 사유: {version.changeReason || '-'}
                    </p>
                    <p {...documentsOwnerItem('version-history-created-at', `버전 생성 시각 - ${version.versionNumber}`)}>
                      생성 시각: {formatDateTime(version.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500" {...documentsOwnerItem('version-history-empty-state', '버전 이력 없음 안내')}>
                버전 기록이 없습니다.
              </p>
            )}
          </div>

          <div className="space-y-2" {...documentsOwnerItem('recent-request-link-section', '최근 요청 링크 항목')}>
            <p className="text-sm font-medium text-slate-800" {...documentsOwnerItem('recent-request-link-title', '최근 요청 링크 제목')}>
              최근 요청 링크
            </p>
            {recentRequestLinks.length > 0 ? (
              <div className="space-y-2" {...documentsOwnerItem('recent-request-link-list', '최근 요청 링크 목록')}>
                {recentRequestLinks.map((item) => (
                  <div
                    key={item.requestLink.id}
                    className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600"
                    {...documentsOwnerItem('recent-request-link-card', `최근 요청 링크 카드 - ${item.maskedRecipientTarget}`)}
                  >
                    <div className="flex flex-wrap items-center gap-2" {...documentsOwnerItem('recent-request-link-card-header', '최근 요청 링크 카드 머리글')}>
                      <Badge variant={getStatusVariant(item.requestLink.status)} {...documentsOwnerItem('recent-request-link-status', '최근 요청 링크 상태')}>
                        {item.requestLink.status}
                      </Badge>
                      <span className="font-medium text-slate-900" {...documentsOwnerItem('recent-request-link-recipient', '최근 요청 링크 수신자')}>
                        {item.maskedRecipientTarget}
                      </span>
                    </div>
                    <p className="mt-2" {...documentsOwnerItem('recent-request-link-channel', '최근 요청 링크 수신 채널')}>
                      수신 채널: {item.requestLink.recipientChannel}
                    </p>
                    <p {...documentsOwnerItem('recent-request-link-expires-at', '최근 요청 링크 만료 시각')}>
                      만료 시각: {formatDateTime(item.requestLink.expiresAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500" {...documentsOwnerItem('recent-request-link-empty-state', '최근 요청 링크 없음 안내')}>
                최근 요청 링크가 없습니다.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOwnerSettingsPanel = () => {
    if (surface !== 'documents' || renderMode !== 'full') {
      return null;
    }

    const managedSurface =
      documentsOwnerManagedSurfaces.find((item) => item.surface === activeOwnerSettingsSurface) ||
      documentsOwnerManagedSurfaces[0];
    const managedSettings = documentsOwnerSettings.resolveSurfaceSettings(managedSurface.surface);
    const savedManagedSettings = documentsOwnerSettings.resolveSavedSurfaceSettings(managedSurface.surface);
    const savedDocumentSelectionModeLabel =
      savedManagedSettings.documentSelectionMode === 'picker' ? '저장값 picker' : '저장값 host';
    const formatSavedBooleanDefinition = (definitionName: string, value: boolean) =>
      `${definitionName} · 저장값 ${value ? 'ON' : 'OFF'}`;

    return (
      <Card className="border-slate-200" {...documentsOwnerItem('owner-settings-panel', '문서 owner 설정 패널')}>
        <CardHeader className="p-4 pb-3" {...documentsOwnerItem('owner-settings-panel-header', '문서 owner 설정 제목 영역')}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm" {...documentsOwnerItem('owner-settings-panel-title', '문서 owner 설정 제목')}>
                문서 기능 환경설정
              </CardTitle>
              <CardDescription
                className="text-xs leading-5"
                {...documentsOwnerItem('owner-settings-panel-description', '문서 owner 설정 설명')}
              >
                {managedSurface.label} · documents owner 기능 표시와 /canvas 환경 적용을 편집합니다.
              </CardDescription>
            </div>
            <OwnerSettingsActionBar
              dirty={documentsOwnerSettings.hasUnsavedSettings}
              onReset={() => {
                documentsOwnerSettings.resetSettings();
                setMessage('저장된 문서 기능 환경설정으로 되돌렸습니다.');
              }}
              onSave={() => {
                documentsOwnerSettings.saveSettings();
                setMessage('문서 기능 환경설정을 저장했습니다.');
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0" {...documentsOwnerItem('owner-settings-panel-content', '문서 owner 설정 내용')}>
          <OwnerSettingsTabList
            value={managedSurface.surface}
            ariaLabel="문서 기능 관리 페이지 탭"
            options={documentsOwnerManagedSurfaces.map((item) => ({ value: item.surface, label: item.label }))}
            onChange={(value) => setActiveOwnerSettingsSurface(value as DocumentsOwnerSurface)}
          />

          <div
            className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700"
            {...documentsOwnerItem('owner-settings-active-surface-summary', `${managedSurface.label} 문서 기능 설정 요약`)}
          >
            <span className="font-semibold text-slate-900">{managedSurface.label}</span>
            <span>{managedSurface.path}</span>
            <span className="text-slate-400">/</span>
            <span>surface: {managedSurface.surface}</span>
            <span className="text-slate-400">/</span>
            <span>{managedSettings.documentSelectionMode === 'picker' ? '문서 선택 UI 사용' : '호출 페이지 문서 사용'}</span>
          </div>

          <div className="space-y-1.5" {...documentsOwnerItem('owner-settings-display-section', '문서 출력 방식 설정 섹션')}>
            <OwnerSettingsSectionHeader
              label="문서 출력 방식"
              description="문서 선택, 작업 패널, 기록 패널의 표시 여부를 정합니다."
              count="3개"
            />
            <div className="grid gap-1 md:grid-cols-3">
              <SettingToggleRow
                label="작업할 문서 고르기"
                sectionLabel="문서 기능"
                definitionName={`documentSelectionMode · ${savedDocumentSelectionModeLabel}`}
                description="ON이면 문서 선택 UI를 쓰고, OFF이면 호출 페이지나 URL에서 받은 문서로 출력합니다."
                checked={managedSettings.documentSelectionMode === 'picker'}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(
                    managedSurface.surface,
                    'documentSelectionMode',
                    checked ? 'picker' : 'host'
                  )
                }
              />
              <SettingToggleRow
                label="지금 할 작업"
                sectionLabel="문서 기능"
                definitionName={formatSavedBooleanDefinition('showCurrentWorkPanel', savedManagedSettings.showCurrentWorkPanel)}
                description="이 페이지에서 문서 요청 작업 패널을 표시합니다."
                checked={managedSettings.showCurrentWorkPanel}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'showCurrentWorkPanel', checked)
                }
              />
              <SettingToggleRow
                label="이 문서 기록"
                sectionLabel="문서 기능"
                definitionName={formatSavedBooleanDefinition('showHistoryPanel', savedManagedSettings.showHistoryPanel)}
                description="버전 이력과 최근 요청 링크 기록을 표시합니다."
                checked={managedSettings.showHistoryPanel}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'showHistoryPanel', checked)
                }
              />
            </div>
          </div>

          <div className="space-y-1.5" {...documentsOwnerItem('owner-settings-request-steps-section', '지금 할 작업 단계 설정 섹션')}>
            <OwnerSettingsSectionHeader
              label="지금 할 작업 단계"
              description="요청 링크 생성 흐름의 각 단계를 선택적으로 표시합니다."
              count="4개"
            />
            <div className="grid gap-1 md:grid-cols-3">
              <SettingToggleRow
                label="1단계 상자 담당자"
                sectionLabel="지금 할 작업"
                definitionName={formatSavedBooleanDefinition('showRequestStepBoxAssignee', savedManagedSettings.showRequestStepBoxAssignee)}
                description="선택한 상자와 담당 구성원을 지정하는 단계를 표시합니다."
                checked={managedSettings.showRequestStepBoxAssignee}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'showRequestStepBoxAssignee', checked)
                }
              />
              <SettingToggleRow
                label="2단계 필수 사진"
                sectionLabel="지금 할 작업"
                definitionName={formatSavedBooleanDefinition('showRequestStepPhoto', savedManagedSettings.showRequestStepPhoto)}
                description="사진 태그와 담당 구성원을 정하는 단계를 표시합니다."
                checked={managedSettings.showRequestStepPhoto}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'showRequestStepPhoto', checked)
                }
              />
              <SettingToggleRow
                label="3단계 필수 파일"
                sectionLabel="지금 할 작업"
                definitionName={formatSavedBooleanDefinition('showRequestStepFile', savedManagedSettings.showRequestStepFile)}
                description="파일 태그와 담당 구성원을 정하는 단계를 표시합니다."
                checked={managedSettings.showRequestStepFile}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'showRequestStepFile', checked)
                }
              />
              <SettingToggleRow
                label="4단계 만료 시각"
                sectionLabel="지금 할 작업"
                definitionName={formatSavedBooleanDefinition('showRequestStepExpiration', savedManagedSettings.showRequestStepExpiration)}
                description="요청 링크 만료 시각과 생성 버튼 단계를 표시합니다."
                checked={managedSettings.showRequestStepExpiration}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'showRequestStepExpiration', checked)
                }
              />
            </div>
          </div>

          <div className="space-y-1.5" {...documentsOwnerItem('owner-settings-canvas-section', '상자 편집 캔버스 연동 설정 섹션')}>
            <OwnerSettingsSectionHeader
              label="상자 편집 캔버스 연동"
              description="/canvas owner의 저장 환경을 이 문서 기능 화면에 적용할지 정합니다."
              count="1개"
            />
            <div className="grid gap-1 md:grid-cols-3">
              <SettingToggleRow
                label="상자 캔버스 환경"
                sectionLabel="문서 기능"
                definitionName={formatSavedBooleanDefinition(
                  'applyStoredCanvasOwnerSettings',
                  savedManagedSettings.applyStoredCanvasOwnerSettings
                )}
                description="/canvas에 저장된 해당 페이지 캔버스 설정을 적용합니다."
                checked={managedSettings.applyStoredCanvasOwnerSettings}
                onCheckedChange={(checked) =>
                  documentsOwnerSettings.updateSurfaceSetting(managedSurface.surface, 'applyStoredCanvasOwnerSettings', checked)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCurrentWorkPanel = () => {
    if (!surfaceOwnerSettings.showCurrentWorkPanel) {
      return null;
    }

    return (
      <Card className="border-slate-200" {...documentsOwnerItem('current-work-panel', '지금 할 작업 패널')}>
        <CardHeader {...documentsOwnerItem('current-work-panel-header', '지금 할 작업 제목 영역')}>
          <CardTitle {...documentsOwnerItem('current-work-panel-title', '지금 할 작업 제목')}>
            {documentPickerEnabled ? '2. 지금 할 작업' : '지금 할 작업'}
          </CardTitle>
          <CardDescription {...documentsOwnerItem('current-work-panel-description', '지금 할 작업 설명')}>
            요청 링크 설정 안에서 받을 값과 받을 사람을 정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4" {...documentsOwnerItem('current-work-panel-content', '지금 할 작업 내용')}>
          {selectedDocumentDetail ? (
            renderRequestLinkSetup()
          ) : selectedDocumentDetailLoading ? (
            <div
              className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-600"
              role="status"
              aria-live="polite"
              {...documentsOwnerItem('current-work-loading-state', '지금 할 작업 로딩 상태')}
            >
              <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" aria-hidden="true" />
              <p className="mt-3 font-medium text-slate-900" {...documentsOwnerItem('current-work-loading-title', '지금 할 작업 로딩 제목')}>
                문서 로딩 중
              </p>
              <p className="mt-1 text-xs text-slate-500" {...documentsOwnerItem('current-work-loading-description', '지금 할 작업 로딩 설명')}>
                상자 편집 캔버스를 준비하고 있습니다.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500" {...documentsOwnerItem('current-work-empty-state', '지금 할 작업 빈 상태')}>
              문서를 고르면 요청 링크 설정을 시작할 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (renderMode === 'current-work-panel') {
    return renderCurrentWorkPanel();
  }

  return (
    <div
      className={cn(embedded ? 'space-y-6' : 'mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8')}
      {...documentsOwnerItem('documents-owner-root', '문서 관리 페이지 루트')}
    >
      {hidePageHeader ? null : (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between" {...documentsOwnerItem('documents-page-header', '문서 관리 페이지 머리글')}>
          <div className="space-y-2" {...documentsOwnerItem('documents-page-heading-group', '문서 관리 페이지 제목 묶음')}>
            <Badge variant="slate" {...documentsOwnerItem('documents-page-feature-badge', '문서 관리 페이지 기능 배지')}>
              DOCFUNC
            </Badge>
            <h1 className="text-3xl font-semibold text-slate-950" {...documentsOwnerItem('documents-page-title', '문서 관리 페이지 제목')}>
              서류 클라우드 관리
            </h1>
            <p className="max-w-3xl text-sm text-slate-600" {...documentsOwnerItem('documents-page-description', '문서 관리 페이지 설명')}>
              문서별 요청 링크 설정과 기록을 관리합니다.
            </p>
          </div>
          <Button
            variant="outline"
            {...documentsOwnerItem('documents-refresh-button', '문서 관리 페이지 새로고침 버튼')}
            onClick={() => void loadDocumentContext(selectedDocumentId)}
            disabled={loading || !selectedDocumentId}
          >
            새로고침
          </Button>
        </div>
      )}

      {message ? (
        <Card className="border-slate-200 bg-slate-50" {...documentsOwnerItem('documents-message-panel', '문서 관리 메시지 패널')}>
          <CardContent className="p-4 text-sm text-slate-700" {...documentsOwnerItem('documents-message-content', '문서 관리 메시지 내용')}>
            {message}
          </CardContent>
        </Card>
      ) : null}

      {renderOwnerSettingsPanel()}

      {renderDocumentSelectPanel()}

      {renderCurrentWorkPanel()}

      {renderHistoryPanel()}
    </div>
  );
}
