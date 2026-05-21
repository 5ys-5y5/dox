'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EntityPicker } from '../../../components/ui/EntityPicker';
import { Input } from '../../../components/ui/Input';
import { CanvasOwnedWorkspace } from '../../canvas/ownerPolicy';
import type { TemplateEditWorkspaceInitialDraft } from '../../../components/template/TemplateEditWorkspace';
import type { TemplateChecklistRegistrationTarget } from '../../../components/template/workspace/types';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../../lib/documentAttachmentValues';
import { buildDocumentHtmlContentKey } from '../../../lib/documentCanvasHtml';
import {
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
} from '../../../lib/documentCanvasState';
import type { DocumentDetailResult, DocumentListItem, DocumentRequestTaskInput } from '../../../lib/documentDtos';
import type { DocumentMemberRecordDto, SiteMemberRecordDto } from '../../../lib/memberAccessDtos';
import type { SiteRecordDto } from '../../../lib/siteChecklistDtos';
import { cn } from '../../../lib/utils';
import { DocumentsOwnerClient } from './documentOwnerClient';
import {
  buildChecklistTargetForRequestableField,
  collectDocumentRequestableFields,
} from './documentFieldIndex';
import type {
  DocumentOwnerMemberOption,
  DocumentRequestableField,
  DocumentsOwnerRecentRequestLink,
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

const requestKindOptions: Array<{ value: DocumentRequestableField['requestKind']; label: string }> = [
  { value: 'value', label: '기록 값' },
  { value: 'signature', label: '서명 요청' },
  { value: 'photo', label: '필수 사진' },
  { value: 'file', label: '필수 파일' },
];

const isGeneratedFieldLabel = (value: string) =>
  /^(band-\d+|status-history-\d+|field-\d+|frame-\d+)/i.test(value.trim());

const getFieldLabel = (field: Pick<DocumentRequestableField, 'displayKeyText'>, index?: number) => {
  const label = field.displayKeyText.trim();

  if (!label || isGeneratedFieldLabel(label)) {
    return typeof index === 'number' && index >= 0 ? `선택한 상자 ${index + 1}` : '선택한 상자';
  }

  return label;
};

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

const normalizeLookupValue = (value: string | null | undefined) =>
  String(value || '').trim().toLowerCase();

const normalizePhoneDigits = (value: string | null | undefined) =>
  String(value || '').replace(/[^0-9]/g, '');

const buildDocumentsSelectionQueryKey = (siteId: string, documentId: string) =>
  `${siteId.trim()}::${documentId.trim()}`;

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
}: DocumentsOwnerWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = React.useState(initialSiteId);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(lockedDocumentId);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [recentRequestLinks, setRecentRequestLinks] = React.useState<DocumentsOwnerRecentRequestLink[]>([]);
  const [documentMembers, setDocumentMembers] = React.useState<DocumentMemberRecordDto[]>([]);
  const [siteMembers, setSiteMembers] = React.useState<SiteMemberRecordDto[]>([]);
  const [selectedFieldKeys, setSelectedFieldKeys] = React.useState<string[]>([]);
  const [selectedFieldKindByValueKey, setSelectedFieldKindByValueKey] = React.useState<Record<string, DocumentRequestableField['requestKind']>>({});
  const [selectedFieldAssigneeByValueKey, setSelectedFieldAssigneeByValueKey] = React.useState<Record<string, string>>({});
  const [activeFieldValueKey, setActiveFieldValueKey] = React.useState('');
  const [highlightTarget, setHighlightTarget] = React.useState<TemplateChecklistRegistrationTarget | null>(null);
  const [newMemberName, setNewMemberName] = React.useState('');
  const [newMemberPhone, setNewMemberPhone] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState(() => toDatetimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [latestCreatedRequestLinks, setLatestCreatedRequestLinks] = React.useState<
    Array<{ requestLink: DocumentsOwnerRecentRequestLink['requestLink']; requestUrl: string }>
  >([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const selectionQuerySyncRef = React.useRef('');
  const shouldSyncSelectionQuery = surface === 'documents' && !embedded && !hideDocumentPicker;

  React.useEffect(() => {
    if (initialSiteId) {
      setSelectedSiteId(initialSiteId);
    }
  }, [initialSiteId]);

  React.useEffect(() => {
    if (lockedDocumentId) {
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
          requestKind: selectedFieldKindByValueKey[field.valueKey] || field.requestKind,
        })),
    [requestableFields, selectedFieldKeys, selectedFieldKindByValueKey]
  );

  const activeSelectedField = React.useMemo(
    () =>
      selectedFields.find((field) => field.valueKey === activeFieldValueKey) ||
      selectedFields[selectedFields.length - 1] ||
      null,
    [activeFieldValueKey, selectedFields]
  );

  const canvasSelectableTargets = React.useMemo(
    () => requestableFields.map(buildChecklistTargetForRequestableField),
    [requestableFields]
  );

  const memberOptions = React.useMemo(
    () => mergeMemberOptions(documentMembers, siteMembers),
    [documentMembers, siteMembers]
  );

  const activeSelectedFieldAssignee = React.useMemo(
    () =>
      activeSelectedField
        ? memberOptions.find((option) => option.memberId === selectedFieldAssigneeByValueKey[activeSelectedField.valueKey]) || null
        : null,
    [activeSelectedField, memberOptions, selectedFieldAssigneeByValueKey]
  );

  const loadSites = React.useCallback(async () => {
    try {
      setSites(await DocumentsOwnerClient.listSites());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현장 목록 조회에 실패했습니다.');
    }
  }, []);

  const loadDocuments = React.useCallback(async (siteId: string) => {
    if (!siteId || hideDocumentPicker) {
      return;
    }

    try {
      const nextDocuments = await DocumentsOwnerClient.listDocuments(siteId);
      setDocuments(nextDocuments);
      setSelectedDocumentId((current) =>
        nextDocuments.some((item) => item.document.id === current) ? current : nextDocuments[0]?.document.id || ''
      );
    } catch (error) {
      setDocuments([]);
      setMessage(error instanceof Error ? error.message : '문서 목록 조회에 실패했습니다.');
    }
  }, [hideDocumentPicker]);

  const loadDocumentContext = React.useCallback(async (documentId: string) => {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      setSelectedDocumentDetail(null);
      setRecentRequestLinks([]);
      setDocumentMembers([]);
      setSiteMembers([]);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const detail = await DocumentsOwnerClient.getDocumentDetail(normalizedDocumentId);
      setSelectedDocumentDetail(detail);
      setSelectedSiteId((current) => (current === detail.document.siteId ? current : detail.document.siteId));
      const [requestLinks, nextDocumentMembers, nextSiteMembers] = await Promise.all([
        DocumentsOwnerClient.listRecentRequestLinks(detail.document.siteId).catch(() => []),
        DocumentsOwnerClient.listDocumentMembers(detail.document.id).catch(() => []),
        DocumentsOwnerClient.listSiteMembers(detail.document.siteId).catch(() => []),
      ]);

      setRecentRequestLinks(requestLinks.filter((item) => item.requestLink.documentId === detail.document.id));
      setDocumentMembers(nextDocumentMembers);
      setSiteMembers(nextSiteMembers);
    } catch (error) {
      setSelectedDocumentDetail(null);
      setMessage(error instanceof Error ? error.message : '문서 상세 조회에 실패했습니다.');
    } finally {
      setLoading(false);
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
    router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, { scroll: false });
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
    setSelectedFieldKindByValueKey((current) => {
      const nextEntries = Object.entries(current).filter(([valueKey]) =>
        requestableFields.some((field) => field.valueKey === valueKey)
      );

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
    setSelectedFieldAssigneeByValueKey((current) => {
      const nextEntries = Object.entries(current).filter(([valueKey]) =>
        requestableFields.some((field) => field.valueKey === valueKey)
      );

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
  }, [requestableFields]);

  React.useEffect(() => {
    if (activeFieldValueKey && !selectedFieldKeys.includes(activeFieldValueKey)) {
      setActiveFieldValueKey(selectedFieldKeys[selectedFieldKeys.length - 1] || '');
    }
  }, [activeFieldValueKey, selectedFieldKeys]);

  React.useEffect(() => {
    setHighlightTarget(activeSelectedField ? buildChecklistTargetForRequestableField(activeSelectedField) : null);
  }, [activeSelectedField]);

  const selectFieldFromCanvas = React.useCallback(
    (target: TemplateChecklistRegistrationTarget) => {
      const targetTokens = new Set(
        [
          target.id,
          target.valueKey,
          target.activationValueKey,
          target.frameGroupId,
          target.contextKey,
          ...(target.highlightFrameGroupIds || []),
        ]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
      );
      const field =
        requestableFields.find((item) => item.id === target.id) ||
        requestableFields.find((item) =>
          [item.valueKey, item.keyFrameGroupId, item.valueFrameGroupId, item.contextKey].some(
            (value) => value && targetTokens.has(value)
          )
        ) ||
        null;

      if (!field) {
        return;
      }

      setHighlightTarget(buildChecklistTargetForRequestableField(field));
      setActiveFieldValueKey(field.valueKey);
      setSelectedFieldKeys((current) => (current.includes(field.valueKey) ? current : [...current, field.valueKey]));
      setSelectedFieldKindByValueKey((current) => ({
        ...current,
        [field.valueKey]: current[field.valueKey] || field.requestKind,
      }));
    },
    [requestableFields]
  );

  const removeSelectedField = React.useCallback((valueKey: string) => {
    setSelectedFieldKeys((current) => current.filter((item) => item !== valueKey));
    setSelectedFieldKindByValueKey((current) => {
      const nextValue = { ...current };
      delete nextValue[valueKey];
      return nextValue;
    });
    setSelectedFieldAssigneeByValueKey((current) => {
      const nextValue = { ...current };
      delete nextValue[valueKey];
      return nextValue;
    });
    setActiveFieldValueKey((current) => (current === valueKey ? '' : current));
    setHighlightTarget((current) => (current?.valueKey === valueKey ? null : current));
  }, []);

  const changeSelectedFieldKind = React.useCallback(
    (field: DocumentRequestableField, requestKind: DocumentRequestableField['requestKind']) => {
      setSelectedFieldKindByValueKey((current) => ({
        ...current,
        [field.valueKey]: requestKind,
      }));
      setHighlightTarget(buildChecklistTargetForRequestableField({ ...field, requestKind }));
    },
    []
  );

  const assignSelectedFieldMember = React.useCallback((field: DocumentRequestableField, memberId: string) => {
    setSelectedFieldAssigneeByValueKey((current) => ({
      ...current,
      [field.valueKey]: memberId,
    }));
  }, []);

  const handleRegisterMemberForDocument = async () => {
    const documentId = selectedDocumentDetail?.document.id || selectedDocumentId;
    const phoneNumber = newMemberPhone.trim();
    const displayName = newMemberName.trim();

    if (!documentId) {
      setMessage('구성원을 등록할 문서를 먼저 선택하세요.');
      return null;
    }

    if (!phoneNumber) {
      setMessage('등록할 구성원 번호를 입력하세요.');
      return null;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await DocumentsOwnerClient.inviteDocumentMember({
        documentId,
        phoneNumber,
        displayName: displayName || null,
        accessRole: activeSelectedField?.requestKind === 'signature' ? 'signer' : 'editor',
      });
      await loadDocumentContext(documentId);
      if (activeSelectedField) {
        assignSelectedFieldMember(activeSelectedField, result.membership.member.id);
      }
      setNewMemberName('');
      setNewMemberPhone('');
      setMessage(`${formatPhoneNumber(result.membership.member.phoneNumber)} 구성원을 현재 문서에 등록했습니다.`);
      return result.membership.member;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '구성원 등록에 실패했습니다.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequestLink = async () => {
    const activeDocument = selectedDocumentDetail?.document;

    if (!activeDocument) {
      setMessage('요청 링크를 만들 문서를 먼저 선택하세요.');
      return;
    }

    if (selectedFields.length === 0) {
      setMessage('상자 편집 캔버스에서 상자를 하나 이상 선택하세요.');
      return;
    }

    const missingAssigneeField = selectedFields.find((field) => !selectedFieldAssigneeByValueKey[field.valueKey]);
    if (missingAssigneeField) {
      setActiveFieldValueKey(missingAssigneeField.valueKey);
      setHighlightTarget(buildChecklistTargetForRequestableField(missingAssigneeField));
      setMessage('선택한 상자마다 담당 구성원을 지정하세요.');
      return;
    }

    const normalizedExpiresAt = new Date(expiresAt);
    if (Number.isNaN(normalizedExpiresAt.getTime())) {
      setMessage('만료 시각을 다시 입력하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const documentContent = selectedDocumentInitialDraft?.draftHtml || selectedDocumentDetail?.latestVersion?.htmlCanonical || '';
      const fieldsByAssignee = selectedFields.reduce<Map<string, DocumentRequestableField[]>>((map, field) => {
        const assigneeMemberId = selectedFieldAssigneeByValueKey[field.valueKey];
        map.set(assigneeMemberId, [...(map.get(assigneeMemberId) || []), field]);
        return map;
      }, new Map());
      const createdLinks: Array<{ requestLink: DocumentsOwnerRecentRequestLink['requestLink']; requestUrl: string }> = [];

      for (const [assigneeMemberId, fields] of fieldsByAssignee.entries()) {
        const targetMember = memberOptions.find((option) => option.memberId === assigneeMemberId) || null;

        if (!targetMember) {
          throw new Error('담당 구성원 정보를 찾지 못했습니다.');
        }

        const createResult = await DocumentsOwnerClient.createRequestLink({
          documentId: activeDocument.id,
          allowedLabels: fields.map((field) => field.valueKey),
          recipientChannel: 'sms',
          recipientTarget: targetMember.phoneNumber,
          recipientName: targetMember.displayName,
          expiresAt: normalizedExpiresAt.toISOString(),
          requestedBy: 'documents-owner',
        });
        const requestTasks = await Promise.all(
          buildRequestTasks(fields).map(async (task) => {
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
      setLoading(false);
    }
  };

  const handleSiteSelectionChange = React.useCallback((nextSiteId: string) => {
    setSelectedSiteId(nextSiteId);
    setSelectedDocumentId('');
    setSelectedDocumentDetail(null);
    setRecentRequestLinks([]);
    setDocumentMembers([]);
    setSiteMembers([]);
    setSelectedFieldKeys([]);
    setActiveFieldValueKey('');
    setHighlightTarget(null);
  }, []);

  const renderDocumentSelectPanel = () => {
    if (hideDocumentPicker) {
      return null;
    }

    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>1. 작업할 문서 고르기</CardTitle>
          <CardDescription>현장과 문서를 고르면 아래에서 요청 링크 설정을 진행합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">현장 선택</label>
            <EntityPicker
              value={selectedSiteId}
              options={siteOptions}
              onChange={handleSiteSelectionChange}
              placeholder="현장을 선택하세요"
              emptyMessage="저장된 현장이 없습니다."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">문서 선택</label>
            <EntityPicker
              value={selectedDocumentId}
              options={documentOptions}
              onChange={setSelectedDocumentId}
              placeholder="문서를 선택하세요"
              emptyMessage="선택 가능한 문서가 없습니다."
            />
          </div>
          {selectedDocumentDetail ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusVariant(selectedDocumentDetail.document.status)}>
                  {selectedDocumentDetail.document.status}
                </Badge>
                <span className="font-medium text-slate-900">{selectedDocumentDetail.document.title}</span>
              </div>
              <p className="mt-2">문서 종류: {selectedDocumentDetail.document.documentTypeKey}</p>
              <p>최신 버전: {selectedDocumentDetail.latestVersion?.versionNumber || '-'}</p>
              <p>최근 요청 링크: {recentRequestLinks.length}건</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">먼저 작업할 문서를 고르세요.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderRequestLinkSetup = () => (
    <>
      {selectedDocumentInitialDraft ? (
        <CanvasOwnedWorkspace
          surface={surface === 'project' ? 'project' : 'documents'}
          key={selectedDocumentInitialDraft.draftKey}
          initialDraft={selectedDocumentInitialDraft}
          workspaceMode="read"
          hideHeader
          hidePersistencePanel
          suppressInitialDraftLoadedMessage
          templateNameReadOnly
          saveDisabled
          checklistRegistrationTarget={highlightTarget}
          checklistSelectableTargets={canvasSelectableTargets}
          onChecklistSelectableTargetSelect={selectFieldFromCanvas}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
          표시할 문서 본문이 없습니다.
        </div>
      )}

      <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-900">선택한 상자</div>
            <Badge variant="slate">{selectedFields.length}개</Badge>
          </div>
          {activeSelectedField ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {getFieldLabel(activeSelectedField, selectedFields.findIndex((field) => field.valueKey === activeSelectedField.valueKey))}
                </p>
                <p className="text-xs text-slate-500">
                  {activeSelectedField.currentValueText ? `현재 값: ${activeSelectedField.currentValueText}` : '입력 대기'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {requestKindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeSelectedFieldKind(activeSelectedField, option.value)}
                    className={cn(
                      'inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium',
                      activeSelectedField.requestKind === option.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">담당 구성원</label>
                <EntityPicker
                  value={selectedFieldAssigneeByValueKey[activeSelectedField.valueKey] || ''}
                  options={memberOptions}
                  onChange={(memberId) => assignSelectedFieldMember(activeSelectedField, memberId)}
                  placeholder="이 상자를 맡을 사람"
                  searchPlaceholder="이름 또는 번호 검색"
                  emptyMessage="현재 문서 접근 구성원이 없습니다."
                  optionLayout="inline"
                  allowClear
                />
                {activeSelectedFieldAssignee ? (
                  <p className="text-xs text-slate-500">
                    {activeSelectedFieldAssignee.label} · {activeSelectedFieldAssignee.meta} ·{' '}
                    {activeSelectedFieldAssignee.accessSource === 'document' ? '문서 권한' : '현장 권한'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">이 상자의 값을 책임지고 기록할 구성원을 지정하세요.</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => removeSelectedField(activeSelectedField.valueKey)}>
                선택 해제
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">상자 편집 캔버스에서 받을 값을 선택하세요.</p>
          )}
          {selectedFields.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {selectedFields.map((field) => (
                <button
                  key={field.valueKey}
                  type="button"
                  onClick={() => {
                    setActiveFieldValueKey(field.valueKey);
                    setHighlightTarget(buildChecklistTargetForRequestableField(field));
                  }}
                  className={cn(
                    'inline-flex min-h-8 items-center gap-2 rounded-md border px-2.5 py-1 text-xs',
                    activeSelectedField?.valueKey === field.valueKey
                      ? 'border-slate-900 bg-white text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <span>{getFieldLabel(field, selectedFields.findIndex((item) => item.valueKey === field.valueKey))}</span>
                  <Badge variant="slate">{getRequestKindLabel(field.requestKind)}</Badge>
                  {selectedFieldAssigneeByValueKey[field.valueKey] ? (
                    <span className="text-slate-500">
                      {memberOptions.find((option) => option.memberId === selectedFieldAssigneeByValueKey[field.valueKey])?.label || '담당자'}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-900">새 구성원 등록</div>
            <Input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="이름" />
            <Input
              value={newMemberPhone}
              onChange={(event) => setNewMemberPhone(event.target.value)}
              placeholder="휴대폰 번호"
              inputMode="tel"
            />
            <Button type="button" variant="outline" onClick={() => void handleRegisterMemberForDocument()} disabled={loading || !activeSelectedField}>
              선택한 상자 담당자로 등록
            </Button>
            <p className="text-xs text-slate-500">새 구성원은 현재 문서에 등록되고 선택한 상자의 담당자로 지정됩니다.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">만료 시각</label>
            <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>

          <Button type="button" onClick={() => void handleCreateRequestLink()} disabled={loading}>
            요청 링크 만들기
          </Button>

          {latestCreatedRequestLinks.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {latestCreatedRequestLinks.map(({ requestLink, requestUrl }) => (
                <div key={requestLink.id} className="space-y-1 rounded-md border border-slate-200 bg-white p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(requestLink.status)}>{requestLink.status}</Badge>
                    <span className="font-medium text-slate-900">{requestLink.recipientName || '-'}</span>
                  </div>
                  <p>수신 번호: {formatPhoneNumber(requestLink.recipientTarget)}</p>
                  <a href={requestUrl} className="break-all text-xs font-medium text-slate-700 underline underline-offset-4">
                    {requestUrl}
                  </a>
                </div>
              ))}
            </div>
          ) : null}
        </div>
    </>
  );

  const renderHistoryPanel = () => {
    if (!selectedDocumentDetail) {
      return null;
    }

    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>{hideDocumentPicker ? '이 문서 기록' : '3. 이 문서 기록'}</CardTitle>
          <CardDescription>현재 문서의 버전과 요청 링크 기록을 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">버전 이력</p>
            {selectedDocumentDetail.versions.length > 0 ? (
              <div className="space-y-2">
                {selectedDocumentDetail.versions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">버전 {version.versionNumber}</p>
                    <p>변경 사유: {version.changeReason || '-'}</p>
                    <p>생성 시각: {formatDateTime(version.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">버전 기록이 없습니다.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">최근 요청 링크</p>
            {recentRequestLinks.length > 0 ? (
              <div className="space-y-2">
                {recentRequestLinks.map((item) => (
                  <div key={item.requestLink.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getStatusVariant(item.requestLink.status)}>{item.requestLink.status}</Badge>
                      <span className="font-medium text-slate-900">{item.maskedRecipientTarget}</span>
                    </div>
                    <p className="mt-2">수신 채널: {item.requestLink.recipientChannel}</p>
                    <p>만료 시각: {formatDateTime(item.requestLink.expiresAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">최근 요청 링크가 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn(embedded ? 'space-y-6' : 'mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8')}>
      {hidePageHeader ? null : (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="slate">DOCFUNC</Badge>
            <h1 className="text-3xl font-semibold text-slate-950">서류 클라우드 관리</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              문서별 요청 링크 설정과 기록을 관리합니다.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadDocumentContext(selectedDocumentId)} disabled={loading || !selectedDocumentId}>
            새로고침
          </Button>
        </div>
      )}

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      {renderDocumentSelectPanel()}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>{hideDocumentPicker ? '지금 할 작업' : '2. 지금 할 작업'}</CardTitle>
          <CardDescription>요청 링크 설정 안에서 받을 값과 받을 사람을 정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedDocumentDetail ? (
            renderRequestLinkSetup()
          ) : (
            <p className="text-sm text-slate-500">문서를 고르면 요청 링크 설정을 시작할 수 있습니다.</p>
          )}
        </CardContent>
      </Card>

      {renderHistoryPanel()}
    </div>
  );
}
