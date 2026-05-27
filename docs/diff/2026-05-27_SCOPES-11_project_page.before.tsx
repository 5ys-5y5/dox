'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import {
  ChevronDown,
  Check,
  FileImage,
  FileStack,
  FolderKanban,
  Info,
  Link2,
  Minimize2,
  Plus,
  RefreshCcw,
  Signature,
  Trash2,
} from 'lucide-react';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../components/template/TemplateEditWorkspace';
import { DocumentsOwnerWorkspace } from '../documents/_owner';
import { CanvasOwnedWorkspace } from '../canvas/ownerPolicy';
import { buildDocumentAttachmentValueFilesForSave } from '../../components/template/workspace/persistence/documentAttachmentClient';
import type {
  TemplateScopeContextDto,
  TemplateScopeSaveScopeInput,
} from '../../services/canvasScopeDraftService';
import type {
  TemplateChecklistRegistrationTarget,
  TemplateChecklistSignatureState,
  TemplateChecklistSignatureSubmitParams,
  TemplateEditWorkspaceSaveDraftParams,
} from '../../components/template/workspace/types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { MejaiScrollTable, type MejaiScrollTableColumn, type MejaiScrollTableRow } from '../../components/ui/MejaiScrollTable';
import { MultiEntityPicker } from '../../components/ui/MultiEntityPicker';
import { OwnerSettingsTabList } from '../../components/ui/OwnerSettingsLayout';
import { buildDocumentHtmlContentKey } from '../../lib/documentCanvasHtml';
import {
  collapseDocumentCanvasWhitespace as collapseWhitespace,
  extractDocumentCanvasLabelValuesFromHtml as extractDocumentLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
  stringifyDocumentValue,
} from '../../lib/documentCanvasState';
import type {
  DocumentCreateResult,
  DocumentDeleteResult,
  DocumentDetailResult,
  DocumentListItem,
  DocumentValueFileDto,
  DocumentValueFileInput,
} from '../../lib/documentDtos';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../lib/documentAttachmentValues';
import { formatMemberAccessErrorMessage as getMemberAccessErrorMessage } from '../../lib/memberAccessErrors';
import type {
  DocumentMemberRecordDto,
  MemberAccessSessionDto,
  MemberDispatchResultDto,
  MemberVerificationStatus,
  SiteMemberAccessRole,
  SiteMemberInviteResult,
  SiteMemberRecordDto,
} from '../../lib/memberAccessDtos';
import type { PhotoListItemDto, SitePhotoLabelGapSummaryDto } from '../../lib/photoLabelDtos';
import type {
  SiteChecklistSummaryDto,
  SiteCreateResult,
  SiteDeleteImpactDto,
  SiteDeleteResult,
  SiteListResult,
  SiteRecordDto,
} from '../../lib/siteChecklistDtos';
import type { TemplateRecordDto } from '../../lib/templateDtos';
import { cn } from '../../lib/utils';
type DocumentDetailDiagnosticStatus = 'loaded' | 'missing' | 'loading' | 'error' | 'blocked';
type DocumentDetailDiagnosticItem = {
  key: string;
  label: string;
  status: DocumentDetailDiagnosticStatus;
  summary: string;
  source: string;
};
type ProjectListStatusVariant = 'default' | 'green' | 'amber' | 'slate' | 'red' | 'outline';
type ProjectDocumentOutputTab = 'edit' | 'todo';
type ProjectListAction = {
  title: string;
  ariaLabel: string;
  icon: React.ReactNode;
  completedIcon?: React.ReactNode;
  completed?: boolean;
  feedbackKey?: string;
  disabled?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | boolean | Promise<void | boolean>;
};
type ProjectListRow = {
  key: string;
  label: string;
  labelContent?: React.ReactNode;
  statusLabel: string;
  statusVariant: ProjectListStatusVariant;
  statusContent?: React.ReactNode;
  summary: string;
  source: React.ReactNode;
  checklistTypeLabel?: string;
  targetLabel?: string;
  assigneeLabel?: string;
  completedAtLabel?: string;
  contact?: string;
  roleLabel?: string;
  roleContent?: React.ReactNode;
  documentsContent?: React.ReactNode;
  scopeLabel?: string;
  scopeContent?: React.ReactNode;
  lastVerifiedAt?: string;
  signatureSlotLabel?: string;
  signatureSignerName?: string;
  signatureSignerPhoneNumber?: string;
  signatureRequestedAt?: string;
  signatureSignedAt?: string;
  signatureExpiresAt?: string;
  savedAt?: string;
  templateLabel?: React.ReactNode;
  capturedAt?: string;
  evidenceLabel?: string;
  selected?: boolean;
  onClick?: () => void;
  expandedContent?: React.ReactNode;
  detailAction?: ProjectListAction;
  documentLinkAction?: ProjectListAction;
  registerAction?: ProjectListAction;
  action?: ProjectListAction;
};
type ProjectDashboardSiteSummary = {
  site: SiteRecordDto;
  documents: DocumentListItem[];
  photos: PhotoListItemDto[];
  checklist: SiteChecklistSummaryDto | null;
  hasError: boolean;
};
type ProjectDashboardTodoItem = {
  key: string;
  label: string;
  statusLabel: string;
  statusVariant: ProjectListStatusVariant;
  summary: string;
};
type DocumentChecklistTab = 'signature' | 'photo' | 'file' | 'value';
type DocumentSignatureSlotOption = {
  slotKey: string;
  label: string;
  signatureBoxCount: number;
};
type TagComboboxOption = {
  id: string;
  label: string;
  meta?: string;
  keywords?: string[];
};
type ProjectChecklistLinkedPosition = {
  key: string;
  label: string;
  valueKey: string;
  slotKey: string;
  frameGroupId: string;
  contextKey: string;
  boxKind: 'signature' | 'attachment' | 'text' | 'image';
};
type DocumentFileRequirement = {
  id: string;
  documentId: string;
  title: string;
  fileNameKeyword: string;
  requiredCount: number;
  createdAt: string;
  linkedPosition?: ProjectChecklistLinkedPosition | null;
};
type PendingChecklistRegistration =
  | {
      kind: 'photo';
      requirementId: string;
      tagKey: string;
      tagName: string;
      linkedPosition?: ProjectChecklistLinkedPosition | null;
    }
  | {
      kind: 'file';
      requirementId: string;
      tagName: string;
      linkedPosition?: ProjectChecklistLinkedPosition | null;
    };
type ManagedSiteMemberAccessRole = 'manager' | 'participant';
type ProjectDocumentPickerOption = {
  id: string;
  label: string;
  templateId?: string | null;
  meta?: string;
  keywords?: string[];
};
type ApiErrorDebug = Partial<
  Record<
    | 'versions'
    | 'artifacts'
    | 'valueFiles'
    | 'photoEvidence'
    | 'templateLink'
    | 'valueEntries'
    | 'signatureEvidence'
    | 'photoRequirements',
    string
  >
>;

class ApiFetchError extends Error {
  debug: ApiErrorDebug | null;

  constructor(message: string, debug: ApiErrorDebug | null = null) {
    super(message);
    this.name = 'ApiFetchError';
    this.debug = debug;
  }
}

const fetchSuccessData = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new ApiFetchError(result?.message || '정보를 불러오지 못했습니다.', result?.debug || null);
  }

  return result.data as T;
};

const fetchSuccessDataWithTimeout = async <T,>(url: string, timeoutMs = 8000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const requestPromise = fetch(url, { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new ApiFetchError(result?.message || '정보를 불러오지 못했습니다.', result?.debug || null);
      }

      return result.data as T;
    });

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('문서 추가 정보를 제때 불러오지 못했습니다.'));
      }, timeoutMs);
    });

    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    throw error;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

const getTodayInputValue = () => {
  const now = new Date();
  const normalized = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 10);
};

const buildTemplateDocumentTypeKey = (templateId: string) => `template-${templateId}`;

const DOCUMENT_STATUS_LABELS: Record<DocumentListItem['document']['status'], string> = {
  draft: '작성 중',
  active: '사용 중',
  archived: '보관됨',
  deleted: '삭제됨',
};

const PHOTO_STATUS_LABELS: Record<PhotoListItemDto['photo']['status'], string> = {
  active: '사용 중',
  archived: '보관됨',
};

const PHOTO_EVIDENCE_STATUS_LABELS: Record<DocumentDetailResult['photoEvidence']['status'], string> = {
  not_required: '해당 없음',
  covered: '충족',
  review_needed: '검토 필요',
  missing: '누락',
};

const SIGNATURE_EVIDENCE_STATUS_LABELS: Record<DocumentDetailResult['signatureEvidence'][number]['status'], string> = {
  not_requested: '요청 전',
  pending: '서명 대기',
  authenticating: '인증 중',
  completed: '서명 완료',
  expired: '기한 만료',
  failed: '실패',
};

const PHOTO_REQUIREMENT_STATUS_LABELS: Record<DocumentDetailResult['photoRequirements'][number]['status'], string> = {
  not_required: '해당 없음',
  covered: '충족',
  review_needed: '검토 필요',
  missing: '누락',
};

const SITE_MEMBER_ROLE_LABELS: Record<SiteMemberAccessRole, string> = {
  owner: '관리자',
  manager: '관리자',
  participant: '참여자',
  editor: '참여자',
  viewer: '참여자',
};

const DOCUMENT_CONNECTED_INFO_LABELS = {
  photo_evidence_status: '사진 증빙 상태',
  photo_requirement_count: '사진 요구 수',
  photo_covered_count: '사진 충족 수',
  photo_review_needed_count: '사진 검토 필요 수',
  photo_missing_count: '사진 누락 수',
  attachment_file_count: '첨부 파일 수',
  attachment_file_names: '첨부 파일 이름',
} as const;

const SITE_MEMBER_ROLE_OPTIONS: Array<{ value: ManagedSiteMemberAccessRole; label: string }> = [
  { value: 'manager', label: '관리자' },
  { value: 'participant', label: '참여자' },
];

const getManagedSiteMemberRole = (role: SiteMemberAccessRole): ManagedSiteMemberAccessRole => {
  if (role === 'owner' || role === 'manager') {
    return 'manager';
  }

  return 'participant';
};

const hasFullDocumentAccessBySiteRole = (role: SiteMemberAccessRole | ManagedSiteMemberAccessRole) => {
  const managedRole = getManagedSiteMemberRole(role);
  return managedRole === 'manager';
};

const buildTemplateScopeSaveScopesFromContext = (
  context: TemplateScopeContextDto,
  assignmentsByScopeKey: Record<string, string[]>
): TemplateScopeSaveScopeInput[] =>
  context.logicalScopes.map((scope) => ({
    scopeKey: scope.scopeKey,
    displayName: scope.displayName,
    description: scope.description,
    keyFrameGroupIds: scope.keyFrameGroupIds,
    valueKeyByKeyFrameGroupId: scope.keyFrameGroupIds.reduce<Record<string, string | null>>((map, keyFrameGroupId) => {
      const registryEntry = context.registryEntries.find(
        (entry) =>
          entry.status === 'active' &&
          entry.scopeKey === scope.scopeKey &&
          entry.keyFrameGroupId === keyFrameGroupId
      );

      map[keyFrameGroupId] = registryEntry?.valueKey || null;
      return map;
    }, {}),
    memberIds: assignmentsByScopeKey[scope.scopeKey] || [],
  }));

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';

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

const getDocumentStatusLabel = (status: DocumentListItem['document']['status']) => DOCUMENT_STATUS_LABELS[status] || status;

const getPhotoStatusLabel = (status: PhotoListItemDto['photo']['status']) => PHOTO_STATUS_LABELS[status] || status;

const getPhotoEvidenceStatusLabel = (status: DocumentDetailResult['photoEvidence']['status']) =>
  PHOTO_EVIDENCE_STATUS_LABELS[status] || status;

const getSignatureEvidenceStatusLabel = (status: DocumentDetailResult['signatureEvidence'][number]['status']) =>
  SIGNATURE_EVIDENCE_STATUS_LABELS[status] || status;

const getSignatureEvidenceStatusVariant = (
  status: DocumentDetailResult['signatureEvidence'][number]['status']
): ProjectListStatusVariant => {
  switch (status) {
    case 'completed':
      return 'green';
    case 'pending':
    case 'authenticating':
    case 'not_requested':
      return 'amber';
    case 'expired':
    case 'failed':
      return 'red';
    default:
      return 'outline';
  }
};

const getPhotoRequirementStatusLabel = (status: DocumentDetailResult['photoRequirements'][number]['status']) =>
  PHOTO_REQUIREMENT_STATUS_LABELS[status] || status;

const getPhotoRequirementStatusVariant = (
  status: DocumentDetailResult['photoRequirements'][number]['status']
): ProjectListStatusVariant => {
  switch (status) {
    case 'covered':
      return 'green';
    case 'review_needed':
      return 'amber';
    case 'missing':
      return 'red';
    case 'not_required':
      return 'slate';
    default:
      return 'outline';
  }
};

const countMatches = (value: string, pattern: RegExp) => Array.from(value.matchAll(pattern)).length;
const SIGNATURE_BOX_SELECTOR = [
  '[data-template-box-kind="signature"]',
  '[data-template-frame-box-kind-visual="signature"]',
  '[data-template-usage-preview-control="signature"]',
  '[data-template-usage-preview-runtime-mode^="signature_"]',
].join(', ');

const normalizeSignatureSlotText = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const readSignatureSlotKeyFromElement = (element: Element) =>
  normalizeSignatureSlotText(
    element.getAttribute('data-template-frame-parent-group') ||
      element.getAttribute('data-template-usage-preview-field-key') ||
      element.getAttribute('data-template-frame-value-key') ||
      element.getAttribute('data-template-frame-label') ||
      element.closest('[data-template-frame-parent-group]')?.getAttribute('data-template-frame-parent-group') ||
      element.closest('[data-template-frame-value-key]')?.getAttribute('data-template-frame-value-key') ||
      element.closest('[data-template-frame-label]')?.getAttribute('data-template-frame-label')
  );

const readElementReadableText = (element: Element | null | undefined) =>
  normalizeSignatureSlotText(
    element?.getAttribute('data-template-frame-extracted-text') ||
      element?.getAttribute('data-template-frame-source-text') ||
      element?.textContent ||
      ''
  );

const findFrameGroupElement = (root: ParentNode, frameGroupId: string) => {
  const normalizedFrameGroupId = normalizeSignatureSlotText(frameGroupId);

  if (!normalizedFrameGroupId) {
    return null;
  }

  return (
    Array.from(root.querySelectorAll<HTMLElement>('[data-template-frame-group]')).find(
      (element) => normalizeSignatureSlotText(element.getAttribute('data-template-frame-group')) === normalizedFrameGroupId
    ) || null
  );
};

const getDocumentSignatureSlots = (html: string): DocumentSignatureSlotOption[] => {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return [];
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const slotsByKey = new Map<string, { labels: Set<string>; controlKeys: Set<string> }>();

  Array.from(document.querySelectorAll<HTMLElement>(SIGNATURE_BOX_SELECTOR)).forEach((element, index) => {
    const slotKey = readSignatureSlotKeyFromElement(element);

    if (!slotKey) {
      return;
    }

    const frameGroupId = normalizeSignatureSlotText(element.getAttribute('data-template-frame-group'));
    const frameLabel = normalizeSignatureSlotText(element.getAttribute('data-template-frame-label'));
    const runtimeMode = normalizeSignatureSlotText(
      element.getAttribute('data-template-runtime-mode') || element.getAttribute('data-template-usage-preview-runtime-mode')
    );
    const controlKey = runtimeMode || frameGroupId || frameLabel || `${slotKey}:signature:${index}`;
    const keyFrame = findFrameGroupElement(document, slotKey);
    const keyFrameText = readElementReadableText(keyFrame);
    const valueKey = normalizeSignatureSlotText(element.getAttribute('data-template-frame-value-key'));
    const ownLabel = readElementReadableText(element);
    const slot = slotsByKey.get(slotKey) || { labels: new Set<string>(), controlKeys: new Set<string>() };

    if (keyFrameText) {
      slot.labels.add(keyFrameText);
    }

    if (valueKey && valueKey !== slotKey) {
      slot.labels.add(valueKey);
    }

    if (ownLabel && ownLabel !== slotKey && ownLabel.length <= 60 && !ownLabel.startsWith('data:image/')) {
      slot.labels.add(ownLabel);
    }

    slot.controlKeys.add(controlKey);
    slotsByKey.set(slotKey, slot);
  });

  return Array.from(slotsByKey.entries()).map(([slotKey, slot]) => {
    const label = Array.from(slot.labels).find(Boolean) || slotKey;

    return {
      slotKey,
      label,
      signatureBoxCount: Math.max(slot.controlKeys.size, 1),
    };
  });
};

const readDocumentFrameAttribute = (element: HTMLElement, attributeName: string) =>
  normalizeSignatureSlotText(
    element.getAttribute(attributeName) ||
      element.querySelector<HTMLElement>('[data-template-frame-input="true"]')?.getAttribute(attributeName) ||
      ''
  );

const buildDocumentChecklistContextKey = (element: HTMLElement, frameGroupId: string, valueKey: string) => {
  const parentGroupId = readDocumentFrameAttribute(element, 'data-template-frame-parent-group');
  const colorGroupId = readDocumentFrameAttribute(element, 'data-template-frame-color-group');

  if (parentGroupId) {
    return `parent:${parentGroupId}`;
  }

  if (valueKey) {
    return `value:${valueKey}`;
  }

  if (colorGroupId) {
    return `color:${colorGroupId}`;
  }

  return frameGroupId ? `frame:${frameGroupId}` : 'frame:unknown';
};

const getDocumentChecklistLinkedPositions = (html: string): ProjectChecklistLinkedPosition[] => {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return [];
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const positionsByKey = new Map<string, ProjectChecklistLinkedPosition>();

  Array.from(document.querySelectorAll<HTMLElement>('[data-template-frame-group]')).forEach((element, index) => {
    const frameGroupId = normalizeSignatureSlotText(element.getAttribute('data-template-frame-group'));

    if (!frameGroupId) {
      return;
    }

    const explicitValueKey = readDocumentFrameAttribute(element, 'data-template-frame-value-key');
    const label = readDocumentFrameAttribute(element, 'data-template-frame-label') ||
      readElementReadableText(element) ||
      explicitValueKey ||
      frameGroupId;
    const boxKind = readDocumentFrameAttribute(element, 'data-template-box-kind');
    const visualBoxKind = readDocumentFrameAttribute(element, 'data-template-frame-box-kind-visual');
    const runtimeMode = readDocumentFrameAttribute(element, 'data-template-runtime-mode') ||
      readDocumentFrameAttribute(element, 'data-template-usage-preview-runtime-mode');
    const valueKey = explicitValueKey || label || frameGroupId;
    const contextKey = buildDocumentChecklistContextKey(element, frameGroupId, valueKey);
    const signatureRuntimeMode = runtimeMode.startsWith('signature_') ? runtimeMode : '';
    const isSignatureImagePosition =
      (boxKind === 'signature' || visualBoxKind === 'signature' || Boolean(signatureRuntimeMode)) &&
      (!signatureRuntimeMode || signatureRuntimeMode === 'signature_image');
    const normalizedBoxKind =
      isSignatureImagePosition
        ? 'signature'
        : boxKind === 'attachment' || visualBoxKind === 'attachment' || runtimeMode === 'file_slot'
          ? 'attachment'
          : visualBoxKind === 'image'
            ? 'image'
            : 'text';
    const slotKey =
      normalizedBoxKind === 'signature'
        ? readSignatureSlotKeyFromElement(element) || valueKey || frameGroupId
        : '';
    const key = `${normalizedBoxKind}:${contextKey}:${valueKey || frameGroupId}:${index}`;

    positionsByKey.set(key, {
      key,
      label,
      valueKey,
      slotKey,
      frameGroupId,
      contextKey,
      boxKind: normalizedBoxKind,
    });
  });

  return Array.from(positionsByKey.values());
};

const buildPhotoRequirementLinkKey = (documentId: string, tagNameOrKey: string) =>
  `${documentId.trim()}::${normalizeTagComboboxText(tagNameOrKey).toLowerCase()}`;

const buildChecklistTargetFromPosition = ({
  id,
  kind,
  label,
  linkedPosition,
  requestId,
  signerName,
}: {
  id: string;
  kind: TemplateChecklistRegistrationTarget['kind'];
  label: string;
  linkedPosition: ProjectChecklistLinkedPosition;
  requestId?: string | null;
  signerName?: string | null;
}): TemplateChecklistRegistrationTarget => ({
  id,
  kind,
  label,
  valueKey: linkedPosition.valueKey || undefined,
  slotKey: linkedPosition.slotKey || undefined,
  frameGroupId: linkedPosition.frameGroupId || undefined,
  contextKey: linkedPosition.contextKey || undefined,
  requestId: requestId || undefined,
  signerName: signerName || undefined,
});

const toDocumentValueFileInput = (
  file: DocumentValueFileDto | DocumentValueFileInput,
  fallbackSortOrder: number
): DocumentValueFileInput => ({
  valueKey: file.valueKey,
  storageBucket: file.storageBucket,
  storagePath: file.storagePath,
  originalFileName: file.originalFileName,
  mimeType: file.mimeType || null,
  fileSizeBytes: file.fileSizeBytes ?? null,
  sortOrder: file.sortOrder ?? fallbackSortOrder,
  uploadedBy: file.uploadedBy || null,
  metadata: file.metadata || {},
});

const resolveDocumentSignatureEvidenceSlot = (
  slotKey: string | null | undefined,
  signatureSlots: DocumentSignatureSlotOption[],
  signatureSlotByKey: Map<string, DocumentSignatureSlotOption>
) => {
  const normalizedSlotKey = normalizeSignatureSlotText(slotKey);

  if (normalizedSlotKey && signatureSlotByKey.has(normalizedSlotKey)) {
    return signatureSlotByKey.get(normalizedSlotKey) || null;
  }

  if (signatureSlots.length === 1) {
    return signatureSlots[0];
  }

  return null;
};

const getDocumentSignatureBoxCount = (html: string) => {
  if (!html.trim()) {
    return 0;
  }

  return Math.max(
    countMatches(html, /data-template-box-kind=(["'])signature\1/g),
    countMatches(html, /data-template-frame-box-kind-visual=(["'])signature\1/g),
    countMatches(html, /data-template-usage-preview-runtime-mode=(["'])signature_[^"']*\1/g),
    countMatches(html, /\bv106-template-usage-signature-control\b/g)
  );
};

const isConnectedDocumentInfoKey = (key: string): key is keyof typeof DOCUMENT_CONNECTED_INFO_LABELS =>
  key in DOCUMENT_CONNECTED_INFO_LABELS;

const getDocumentFieldLabel = (key: string) =>
  DOCUMENT_CONNECTED_INFO_LABELS[key as keyof typeof DOCUMENT_CONNECTED_INFO_LABELS] ||
  key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getDocumentDetailIssueMessage = (label: string, issue?: string) => {
  const normalizedIssue = issue?.trim();

  if (!normalizedIssue) {
    return `${label}을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.`;
  }

  return `${label}을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.`;
};

const DOCUMENT_DETAIL_DEBUG_LABELS: Record<keyof ApiErrorDebug, string> = {
  versions: '버전 이력',
  artifacts: '출력본',
  valueFiles: '첨부 파일',
  photoEvidence: '사진 증빙 상태',
  templateLink: '문서 양식 연결',
  valueEntries: '기록 값',
  signatureEvidence: '서명 요청',
  photoRequirements: '필수 사진',
};

const formatPhoneNumber = (value: string | null | undefined) => {
  const digits = (value || '').replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value || '-';
};

const normalizePhoneNumber = (value: string | null | undefined) => String(value || '').replace(/[^0-9]/g, '').trim();

const normalizeRequiredPhotoCount = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
};

const normalizeRequiredFileCount = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
};

const DOCUMENT_FILE_REQUIREMENTS_STORAGE_KEY = 'project.documentFileRequirements.v1';
const PHOTO_REQUIREMENT_LINKS_STORAGE_KEY = 'project.photoRequirementLinks.v1';

const DOCUMENT_CHECKLIST_TABS: Array<{ value: DocumentChecklistTab; label: string }> = [
  { value: 'signature', label: '서명 요청' },
  { value: 'photo', label: '필수 사진' },
  { value: 'file', label: '필수 파일' },
  { value: 'value', label: '기록 값' },
];

const getMemberVerificationStatusLabel = (status: MemberVerificationStatus) => {
  switch (status) {
    case 'verified':
      return '인증됨';
    case 'invited':
      return '대기';
    case 'revoked':
      return '철회';
    default:
      return status;
  }
};

const getMemberVerificationStatusVariant = (status: MemberVerificationStatus) => {
  switch (status) {
    case 'verified':
      return 'green' as const;
    case 'invited':
      return 'amber' as const;
    case 'revoked':
      return 'red' as const;
    default:
      return 'outline' as const;
  }
};

const formatMemberDispatchMessage = (dispatch: MemberDispatchResultDto) => {
  if (dispatch.accessCodePreview) {
    return `${dispatch.message} 인증 코드 ${dispatch.accessCodePreview}`;
  }

  return dispatch.message;
};

const buildProjectSelectionQueryKey = (siteId: string, documentId: string) =>
  `${siteId.trim()}::${documentId.trim()}`;

const projectOwnerItem = (item: string, name: string) => ({
  'data-project-owner-item': item,
  'data-project-owner-name': name,
});

const buildMemberAccessDocumentLinkUrl = (documentId: string, phoneNumber?: string | null) => {
  const normalizedDocumentId = documentId.trim();
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const url = new URL(
    `/member-access/document/${encodeURIComponent(normalizedDocumentId)}`,
    window.location.origin
  );

  if (normalizedPhoneNumber) {
    url.searchParams.set('phoneNumber', normalizedPhoneNumber);
  }

  return url.toString();
};

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand('copy');

    if (!copied) {
      throw new Error('copy command failed');
    }
  } finally {
    document.body.removeChild(textarea);
  }
};

function RoleSegmentedButtons<TValue extends string>({
  value,
  options,
  onChange,
  ownerItemKey,
  ownerItemName = '역할 선택 버튼 그룹',
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
  ownerItemKey?: string;
  ownerItemName?: string;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      {...(ownerItemKey ? projectOwnerItem(ownerItemKey, ownerItemName) : {})}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium',
	              selected
	                ? 'border-slate-900 bg-slate-900 text-white'
	                : 'border-slate-300 bg-white text-slate-700'
	            )}
            aria-pressed={selected}
            {...(ownerItemKey
              ? projectOwnerItem(`${ownerItemKey}-${option.value}-button`, `${option.label} 선택 버튼`)
              : {})}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MemberDocumentAccessPicker({
  membership,
  memberLabel,
  options,
  scopeContextsByTemplateId,
  savingMemberDocumentAccessKey,
  onToggleScopeAccess,
  onClearDocumentScopeAccess,
  ownerItemKey,
  ownerItemName,
}: {
  membership: SiteMemberRecordDto;
  memberLabel: string;
  options: ProjectDocumentPickerOption[];
  scopeContextsByTemplateId: Record<string, TemplateScopeContextDto>;
  savingMemberDocumentAccessKey: string;
  onToggleScopeAccess: (
    membership: SiteMemberRecordDto,
    documentId: string,
    templateId: string,
    scopeKey: string,
    operationKey: string
  ) => void | Promise<void>;
  onClearDocumentScopeAccess: (
    membership: SiteMemberRecordDto,
    documentId: string,
    templateId: string,
    operationKey: string
  ) => void | Promise<void>;
  ownerItemKey: string;
  ownerItemName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const ownerAttrs = React.useCallback(
    (item: string, name: string) => projectOwnerItem(item, name),
    []
  );
  const selectedDocumentCount = React.useMemo(
    () =>
      options.filter((option) => {
        const templateId = option.templateId?.trim() || '';
        const context = templateId ? scopeContextsByTemplateId[templateId] : null;

        return Boolean(
          context?.logicalScopes.some((scope) =>
            (context.assignmentsByScopeKey[scope.scopeKey] || []).includes(membership.member.id)
          )
        );
      }).length,
    [membership.member.id, options, scopeContextsByTemplateId]
  );
  const summary = selectedDocumentCount > 0
    ? `${selectedDocumentCount}개 문서 scope`
    : '지정 scope 없음';
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.meta || '', ...(option.keywords || [])].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full" {...ownerAttrs(ownerItemKey, ownerItemName)}>
      <div
        className="group flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:ring-1 focus-within:ring-slate-300"
        onClick={() => {
          setQuery('');
          setOpen(true);
          inputRef.current?.focus();
        }}
        {...ownerAttrs(`${ownerItemKey}-control`, `${ownerItemName} 컨트롤`)}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : summary}
          readOnly={!open}
          placeholder={open ? '문서 목록 검색' : '문서 scope를 선택하세요'}
          aria-haspopup="listbox"
          aria-expanded={open}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
          }}
          className="h-6 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          {...ownerAttrs(`${ownerItemKey}-input`, `${ownerItemName} 검색 입력`)}
        />
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setQuery('');
            setOpen((current) => !current);
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400"
          aria-label="문서 scope 목록 열기"
          title="문서 scope 목록 열기"
          {...ownerAttrs(`${ownerItemKey}-toggle-button`, `${ownerItemName} 목록 열기 버튼`)}
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 p-2"
          {...ownerAttrs(`${ownerItemKey}-dropdown`, `${ownerItemName} 드롭다운`)}
        >
          <div className="space-y-2" {...ownerAttrs(`${ownerItemKey}-dropdown-content`, `${ownerItemName} 드롭다운 내용`)}>
            <div
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500"
              {...ownerAttrs(`${ownerItemKey}-option-count`, `${ownerItemName} 옵션 개수`)}
            >
              전체 {options.length}개 중 {selectedDocumentCount}개 문서에 scope 지정
            </div>
            <div
              role="listbox"
              className="max-h-80 space-y-1 overflow-auto"
              {...ownerAttrs(`${ownerItemKey}-option-list`, `${ownerItemName} 옵션 목록`)}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const templateId = option.templateId?.trim() || '';
                  const scopeContext = templateId ? scopeContextsByTemplateId[templateId] : null;
                  const logicalScopes = scopeContext?.logicalScopes || [];
                  const assignedScopeKeys = logicalScopes
                    .filter((scope) => (scopeContext?.assignmentsByScopeKey[scope.scopeKey] || []).includes(membership.member.id))
                    .map((scope) => scope.scopeKey);
                  const selected = assignedScopeKeys.length > 0;
                  const savingThisDocument = savingMemberDocumentAccessKey.startsWith(`${membership.membershipId}:${option.id}:`);
                  const disabled = Boolean(savingThisDocument);

                  return (
                    <div
                      key={option.id}
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        'flex w-full items-center rounded-xl border text-left',
                        selected ? 'border-slate-200 bg-slate-100' : 'border-transparent bg-transparent'
                      )}
                      {...ownerAttrs(`${ownerItemKey}-option-${option.id}`, `${ownerItemName} 옵션 - ${option.label}`)}
                    >
                      <div
                        className="flex min-w-0 flex-1 flex-col items-start justify-start px-3 py-2.5 text-left"
                        {...ownerAttrs(`${ownerItemKey}-option-${option.id}-select-button`, `${ownerItemName} 옵션 선택 버튼 - ${option.label}`)}
                      >
                        <span className="min-w-0 truncate text-sm font-medium leading-5 text-slate-900">
                          {option.label}
                        </span>
                        {option.meta ? (
                          <span className="mt-0.5 min-w-0 truncate text-[11px] font-normal leading-4 text-slate-500">
                            {option.meta}
                          </span>
                        ) : null}
                        <span className="mt-1 text-[11px] text-slate-500">
                          {templateId
                            ? selected
                              ? `지정 scope ${assignedScopeKeys.length}개`
                              : '지정 scope 없음'
                            : 'scope를 지정할 템플릿 연결 없음'}
                        </span>
                      </div>
                      <div
                        className="flex shrink-0 flex-wrap justify-end gap-2 px-2 py-2"
                        {...ownerAttrs(`${ownerItemKey}-option-${option.id}-scope-buttons`, `${ownerItemName} 옵션 문서 scope 버튼 그룹 - ${option.label}`)}
                      >
                        {logicalScopes.length > 0 ? (
                          logicalScopes.map((scope) => {
                            const active = assignedScopeKeys.includes(scope.scopeKey);

                            return (
                              <button
                                key={scope.scopeKey}
                                type="button"
                                disabled={disabled}
                                aria-pressed={active}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!templateId) {
                                    return;
                                  }
                                  void onToggleScopeAccess(
                                    membership,
                                    option.id,
                                    templateId,
                                    scope.scopeKey,
                                    `${membership.membershipId}:${option.id}:${scope.scopeKey}`
                                  );
                                }}
                                className={cn(
                                  'inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60',
                                  active
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-300 bg-white text-slate-700'
                                )}
                                {...ownerAttrs(
                                  `${ownerItemKey}-option-${option.id}-scope-${scope.scopeKey}-button`,
                                  `${ownerItemName} 옵션 ${scope.displayName} scope 버튼 - ${option.label}`
                                )}
                              >
                                {scope.displayName}
                              </button>
                            );
                          })
                        ) : (
                          <span className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
                            scope 없음
                          </span>
                        )}
                      </div>
                      <div className="mr-1 flex shrink-0 items-center gap-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md">
                          {selected ? <Check aria-hidden="true" className="h-4 w-4 text-slate-700" /> : null}
                        </div>
                        <button
                          type="button"
                          disabled={!selected || disabled || !templateId}
                          aria-label={`${memberLabel} ${option.label} 문서 scope 지정 해제`}
                          title="문서 scope 지정 해제"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            if (!templateId) {
                              return;
                            }

                            void onClearDocumentScopeAccess(
                              membership,
                              option.id,
                              templateId,
                              `${membership.membershipId}:${option.id}:clear`
                            );
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                          {...ownerAttrs(`${ownerItemKey}-option-${option.id}-clear-button`, `${ownerItemName} 옵션 문서 scope 해제 버튼 - ${option.label}`)}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500"
                  {...ownerAttrs(`${ownerItemKey}-empty-state`, `${ownerItemName} 빈 상태`)}
                >
                  scope를 지정할 현장 문서가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const normalizeTagComboboxText = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const buildUniqueTagOptions = (options: TagComboboxOption[]) => {
  const seen = new Set<string>();
  const uniqueOptions: TagComboboxOption[] = [];

  options.forEach((option) => {
    const label = normalizeTagComboboxText(option.label);

    if (!label) {
      return;
    }

    const key = label.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    uniqueOptions.push({
      ...option,
      id: option.id || label,
      label,
    });
  });

  return uniqueOptions;
};

function TagComboboxInput({
  value,
  options,
  onChange,
  placeholder,
  emptyMessage,
  disabled = false,
  ownerItemKey,
  ownerItemName = '태그 검색 입력',
}: {
  value: string;
  options: TagComboboxOption[];
  onChange: (value: string) => void;
  placeholder: string;
  emptyMessage: string;
  disabled?: boolean;
  ownerItemKey?: string;
  ownerItemName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const normalizedValue = normalizeTagComboboxText(value).toLowerCase();
  const filteredOptions = React.useMemo(() => {
    if (!normalizedValue) {
      return options;
    }

    return options.filter((option) => {
      const haystack = [option.label, option.meta || '', ...(option.keywords || [])].join(' ').toLowerCase();
      return haystack.includes(normalizedValue);
    });
  }, [normalizedValue, options]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      {...(ownerItemKey ? projectOwnerItem(ownerItemKey, ownerItemName) : {})}
    >
      <div
        className={cn(
          'flex min-h-10 w-full items-center gap-2 rounded-md border border-input bg-white px-3 py-1 text-sm focus-within:ring-1 focus-within:ring-ring',
          disabled ? 'cursor-not-allowed opacity-50' : ''
        )}
        {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-control`, `${ownerItemName} 컨트롤`) : {})}
      >
        <input
          type="text"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="h-7 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-input`, `${ownerItemName} 인풋`) : {})}
        />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={disabled}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
          aria-label="기존 태그 목록 열기"
          title="기존 태그 목록 열기"
          {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-toggle-button`, `${ownerItemName} 목록 열기 버튼`) : {})}
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 p-2"
          {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-dropdown`, `${ownerItemName} 드롭다운`) : {})}
        >
          <div className="space-y-2" {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-dropdown-content`, `${ownerItemName} 드롭다운 내용`) : {})}>
            <div
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500"
              {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-option-count`, `${ownerItemName} 옵션 개수`) : {})}
            >
              기존 태그 {options.length}개
            </div>
            <div
              role="listbox"
              className="max-h-64 space-y-1 overflow-auto"
              {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-option-list`, `${ownerItemName} 옵션 목록`) : {})}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.label.toLowerCase() === normalizedValue}
                    onClick={() => {
                      onChange(option.label);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start rounded-xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-white"
                    {...(ownerItemKey
                      ? projectOwnerItem(`${ownerItemKey}-option-${option.id}`, `${ownerItemName} 옵션 - ${option.label}`)
                      : {})}
                  >
                    <span className="min-w-0 truncate text-sm font-medium leading-5 text-slate-900">
                      {option.label}
                    </span>
                    {option.meta ? (
                      <span className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">{option.meta}</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div
                  className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500"
                  {...(ownerItemKey ? projectOwnerItem(`${ownerItemKey}-empty-state`, `${ownerItemName} 빈 상태`) : {})}
                >
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const getDocumentStatusVariant = (status: DocumentListItem['document']['status']) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'draft':
      return 'amber' as const;
    case 'archived':
      return 'slate' as const;
    case 'deleted':
      return 'red' as const;
    default:
      return 'outline' as const;
  }
};

const getPhotoStatusVariant = (status: PhotoListItemDto['photo']['status']) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    default:
      return 'slate' as const;
  }
};

const getDiagnosticStatusVariant = (status: DocumentDetailDiagnosticStatus) => {
  switch (status) {
    case 'loaded':
      return 'green' as const;
    case 'missing':
      return 'amber' as const;
    case 'loading':
      return 'slate' as const;
    case 'error':
      return 'red' as const;
    case 'blocked':
      return 'slate' as const;
    default:
      return 'outline' as const;
  }
};

const getDiagnosticStatusLabel = (status: DocumentDetailDiagnosticStatus) => {
  switch (status) {
    case 'loaded':
      return '정상';
    case 'missing':
      return '값 없음';
    case 'loading':
      return '불러오는 중';
    case 'error':
      return '불러오기 실패';
    case 'blocked':
      return '확인 불가';
    default:
      return status;
  }
};

const PROJECT_INFO_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '항목',
    width: 132,
    minWidth: 120,
    maxWidth: 156,
    clampLines: 2,
  },
  {
    key: 'status',
    label: '상태',
    width: 112,
    minWidth: 96,
    maxWidth: 132,
  },
  {
    key: 'summary',
    label: '상세',
    width: 236,
    minWidth: 208,
    maxWidth: 280,
    clampLines: 2,
  },
];

const PROJECT_DOCUMENT_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '문서',
    width: 320,
    minWidth: 240,
    maxWidth: 460,
    clampLines: 2,
  },
];

const PROJECT_PHOTO_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '사진',
    width: 180,
    minWidth: 150,
    maxWidth: 230,
    clampLines: 2,
  },
  {
    key: 'status',
    label: '상태',
    width: 76,
    minWidth: 72,
    maxWidth: 84,
    align: 'center',
  },
  {
    key: 'capturedAt',
    label: '촬영 일시',
    width: 150,
    minWidth: 132,
    maxWidth: 180,
    clampLines: 1,
  },
  {
    key: 'evidence',
    label: '증빙 연결',
    width: 150,
    minWidth: 128,
    maxWidth: 190,
    clampLines: 1,
  },
];

const PROJECT_SIGNATURE_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'signatureSlot',
    label: '서명 위치',
    width: 172,
    minWidth: 148,
    maxWidth: 220,
    clampLines: 2,
  },
  {
    key: 'status',
    label: '상태',
    width: 112,
    minWidth: 104,
    maxWidth: 132,
  },
  {
    key: 'signatureSigner',
    label: '서명자',
    width: 132,
    minWidth: 116,
    maxWidth: 164,
    clampLines: 1,
  },
  {
    key: 'signaturePhone',
    label: '휴대폰',
    width: 132,
    minWidth: 116,
    maxWidth: 156,
    clampLines: 1,
  },
  {
    key: 'signatureRequestedAt',
    label: '요청 시각',
    width: 150,
    minWidth: 132,
    maxWidth: 176,
    clampLines: 1,
  },
  {
    key: 'signatureSignedAt',
    label: '서명 시각',
    width: 150,
    minWidth: 132,
    maxWidth: 176,
    clampLines: 1,
  },
  {
    key: 'signatureExpiresAt',
    label: '만료 시각',
    width: 150,
    minWidth: 132,
    maxWidth: 176,
    clampLines: 1,
  },
];

const PROJECT_MEMBER_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '이름',
    width: 132,
    minWidth: 112,
    maxWidth: 164,
    clampLines: 1,
  },
  {
    key: 'contact',
    label: '연락처',
    width: 132,
    minWidth: 118,
    maxWidth: 156,
    clampLines: 1,
  },
  {
    key: 'status',
    label: '인증',
    width: 76,
    minWidth: 72,
    maxWidth: 84,
    align: 'center',
  },
  {
    key: 'scope',
    label: '범위',
    width: 160,
    minWidth: 132,
    maxWidth: 190,
    clampLines: 1,
  },
];

const PROJECT_MEMBER_DOCUMENT_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '문서',
    width: 220,
    minWidth: 180,
    maxWidth: 280,
    clampLines: 2,
  },
  {
    key: 'role',
    label: '문서 scope',
    width: 180,
    minWidth: 156,
    maxWidth: 220,
    clampLines: 1,
  },
];

const PROJECT_CHECKLIST_LIST_COLUMNS: MejaiScrollTableColumn[] = [
  {
    key: 'label',
    label: '체크 항목',
    width: 156,
    minWidth: 132,
    maxWidth: 210,
    clampLines: 2,
  },
  {
    key: 'checklistType',
    label: '유형',
    width: 92,
    minWidth: 82,
    maxWidth: 112,
    clampLines: 1,
  },
  {
    key: 'target',
    label: '대상',
    width: 180,
    minWidth: 148,
    maxWidth: 240,
    clampLines: 2,
  },
  {
    key: 'assignee',
    label: '담당자',
    width: 128,
    minWidth: 112,
    maxWidth: 156,
    clampLines: 1,
  },
  {
    key: 'status',
    label: '상태',
    width: 108,
    minWidth: 96,
    maxWidth: 128,
  },
  {
    key: 'summary',
    label: '진행 내역',
    width: 248,
    minWidth: 212,
    maxWidth: 320,
    clampLines: 2,
  },
  {
    key: 'completedAt',
    label: '최근 처리',
    width: 148,
    minWidth: 132,
    maxWidth: 176,
    clampLines: 1,
  },
];

const PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH = 60;

const PROJECT_INFO_LIST_DETAIL_COLUMN: MejaiScrollTableColumn = {
  key: 'detailAction',
  label: '상세',
  width: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  minWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  maxWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'border-l border-slate-200',
  cellClassName: 'border-l border-slate-200',
};

const PROJECT_INFO_LIST_DOCUMENT_LINK_COLUMN: MejaiScrollTableColumn = {
  key: 'documentLinkAction',
  label: '문서 링크',
  width: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  minWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  maxWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'border-l border-slate-200',
  cellClassName: 'border-l border-slate-200',
};

const PROJECT_INFO_LIST_REGISTER_COLUMN: MejaiScrollTableColumn = {
  key: 'registerAction',
  label: '등록',
  width: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  minWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  maxWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'border-l border-slate-200',
  cellClassName: 'border-l border-slate-200',
};

const PROJECT_INFO_LIST_ACTION_COLUMN: MejaiScrollTableColumn = {
  key: 'action',
  label: '삭제',
  width: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  minWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  maxWidth: PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'border-l border-slate-200',
  cellClassName: 'border-l border-slate-200',
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  ownerItemKey,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
  ownerItemKey: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" {...projectOwnerItem(ownerItemKey, `${label} 지표 카드`)}>
      <div className="flex items-center justify-between gap-3" {...projectOwnerItem(`${ownerItemKey}-header`, `${label} 지표 카드 머리글`)}>
        <div className="text-xs font-medium text-slate-500" {...projectOwnerItem(`${ownerItemKey}-label`, `${label} 지표 라벨`)}>{label}</div>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-950" {...projectOwnerItem(`${ownerItemKey}-value`, `${label} 지표 값`)}>{value}</div>
      <div className="mt-1 text-xs text-slate-500" {...projectOwnerItem(`${ownerItemKey}-description`, `${label} 지표 설명`)}>{description}</div>
    </div>
  );
}

function DashboardTodoCard({ item }: { item: ProjectDashboardTodoItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" {...projectOwnerItem(`dashboard-todo-card-${item.key}`, `${item.label} 대시보드 할 일 카드`)}>
      <div className="flex items-center justify-between gap-3" {...projectOwnerItem(`dashboard-todo-card-${item.key}-header`, `${item.label} 대시보드 할 일 머리글`)}>
        <div className="min-w-0 text-sm font-semibold text-slate-900" {...projectOwnerItem(`dashboard-todo-card-${item.key}-label`, `${item.label} 대시보드 할 일 라벨`)}>{item.label}</div>
        <Badge variant={item.statusVariant} className="shrink-0" {...projectOwnerItem(`dashboard-todo-card-${item.key}-status`, `${item.label} 대시보드 할 일 상태`)}>
          {item.statusLabel}
        </Badge>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-600" {...projectOwnerItem(`dashboard-todo-card-${item.key}-summary`, `${item.label} 대시보드 할 일 요약`)}>{item.summary}</div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  actionLabel,
  ownerItemKey,
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  ownerItemKey?: string;
}) {
  const resolvedOwnerItemKey = ownerItemKey || `empty-state-${title.replace(/\s+/g, '-').slice(0, 40)}`;

  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500" {...projectOwnerItem(resolvedOwnerItemKey, `${title} 빈 상태`)}>
      <p className="font-medium text-slate-700" {...projectOwnerItem(`${resolvedOwnerItemKey}-title`, `${title} 빈 상태 제목`)}>{title}</p>
      <p className="mt-2" {...projectOwnerItem(`${resolvedOwnerItemKey}-description`, `${title} 빈 상태 설명`)}>{description}</p>
      {href && actionLabel ? (
        <div className="mt-4" {...projectOwnerItem(`${resolvedOwnerItemKey}-action`, `${title} 빈 상태 실행 영역`)}>
          <Button variant="outline" asChild {...projectOwnerItem(`${resolvedOwnerItemKey}-action-button`, `${actionLabel} 버튼`)}>
            <Link href={href}>{actionLabel}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectListActionButton({
  action,
  className,
  ownerItemKey,
}: {
  action: ProjectListAction;
  className: string;
  ownerItemKey?: string;
}) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const completedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [completed, setCompleted] = React.useState(false);

  React.useEffect(
    () => () => {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
      }
    },
    []
  );

  const isCompleted = Boolean(action.completed || completed);
  const resolvedOwnerItemKey = ownerItemKey || `project-list-action-${action.feedbackKey || action.title}`;
  const markCompleted = React.useCallback(() => {
    if (!action.completedIcon) {
      return;
    }

    if (completedTimerRef.current) {
      clearTimeout(completedTimerRef.current);
    }

    buttonRef.current?.setAttribute('data-copy-feedback-state', 'completed');
    setCompleted(true);
    completedTimerRef.current = setTimeout(() => {
      buttonRef.current?.setAttribute('data-copy-feedback-state', 'idle');
      setCompleted(false);
      completedTimerRef.current = null;
    }, 3000);
  }, [action.completedIcon]);

  const markIdle = React.useCallback(() => {
    if (completedTimerRef.current) {
      clearTimeout(completedTimerRef.current);
      completedTimerRef.current = null;
    }

    buttonRef.current?.setAttribute('data-copy-feedback-state', 'idle');
    setCompleted(false);
  }, []);

  return (
    <>
      {action.completedIcon ? (
        <style>{`
          [data-copy-feedback-state="completed"] [data-copy-feedback-icon="idle"] {
            display: none;
          }
          [data-copy-feedback-state="completed"] [data-copy-feedback-icon="completed"] {
            display: inline-flex;
          }
        `}</style>
      ) : null}
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        title={action.title}
        aria-label={action.ariaLabel}
        data-member-access-link-key={action.feedbackKey}
        data-copy-feedback-state={action.completedIcon ? (isCompleted ? 'completed' : 'idle') : undefined}
        {...projectOwnerItem(resolvedOwnerItemKey, action.ariaLabel)}
        disabled={action.disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (action.completedIcon) {
            window.setTimeout(markCompleted, 0);
          }

          void Promise.resolve(action.onClick(event))
            .then((result) => {
              if (!action.completedIcon) {
                return;
              }

              if (result === false) {
                markIdle();
                return;
              }

              window.requestAnimationFrame(markCompleted);
            })
            .catch(() => {
              markIdle();
            });
        }}
      >
        <span data-copy-feedback-icon="idle" className="inline-flex">
          {action.icon}
        </span>
        {action.completedIcon ? (
          <span data-copy-feedback-icon="completed" className="hidden">
            {action.completedIcon}
          </span>
        ) : null}
      </Button>
    </>
  );
}

function ProjectInfoList({
  items,
  emptyMessage,
  maxBodyHeightClassName,
  minTableWidth,
  variant = 'detail',
  ownerItemKey,
  ownerItemName = '현장 관리 목록',
}: {
  items: ProjectListRow[];
  emptyMessage?: string;
  maxBodyHeightClassName?: string;
  minTableWidth?: number;
  variant?: 'detail' | 'document' | 'photo' | 'signature' | 'member' | 'memberDocument' | 'checklist';
  ownerItemKey?: string;
  ownerItemName?: string;
}) {
  const hasDetailColumn = items.some((item) => Boolean(item.detailAction));
  const hasDocumentLinkColumn = items.some((item) => Boolean(item.documentLinkAction));
  const hasRegisterColumn = items.some((item) => Boolean(item.registerAction));
  const hasActionColumn = items.some((item) => Boolean(item.action));
  const baseColumns =
    variant === 'document'
      ? PROJECT_DOCUMENT_LIST_COLUMNS
      : variant === 'photo'
        ? PROJECT_PHOTO_LIST_COLUMNS
        : variant === 'signature'
          ? PROJECT_SIGNATURE_LIST_COLUMNS
          : variant === 'member'
            ? PROJECT_MEMBER_LIST_COLUMNS
            : variant === 'memberDocument'
              ? PROJECT_MEMBER_DOCUMENT_LIST_COLUMNS
              : variant === 'checklist'
                ? PROJECT_CHECKLIST_LIST_COLUMNS
              : PROJECT_INFO_LIST_COLUMNS;
  const columns = [
    ...baseColumns,
    ...(hasDetailColumn ? [PROJECT_INFO_LIST_DETAIL_COLUMN] : []),
    ...(hasDocumentLinkColumn ? [PROJECT_INFO_LIST_DOCUMENT_LINK_COLUMN] : []),
    ...(hasRegisterColumn ? [PROJECT_INFO_LIST_REGISTER_COLUMN] : []),
    ...(hasActionColumn ? [PROJECT_INFO_LIST_ACTION_COLUMN] : []),
  ];
  const detailColumnWidth = hasDetailColumn ? PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH : 0;
  const linkColumnWidth = hasDocumentLinkColumn ? PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH : 0;
  const registerColumnWidth = hasRegisterColumn ? PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH : 0;
  const actionColumnWidth = hasActionColumn ? PROJECT_INFO_LIST_FIXED_ACTION_COLUMN_WIDTH : 0;
  const baseMinTableWidth =
    variant === 'document'
      ? 320
      : variant === 'photo'
        ? 556
        : variant === 'signature'
          ? 860
          : variant === 'member'
            ? 580
            : variant === 'memberDocument'
              ? 400
              : variant === 'checklist'
                ? 900
              : 492;
  const resolvedMinTableWidth =
    minTableWidth || baseMinTableWidth + detailColumnWidth + linkColumnWidth + registerColumnWidth + actionColumnWidth;
  const renderLinkActionButton = (action: ProjectListAction | undefined) =>
    action ? (
      <ProjectListActionButton
        action={action}
        className="h-7 w-7 rounded-md text-slate-500 disabled:opacity-100"
        ownerItemKey={ownerItemKey ? `${ownerItemKey}-document-link-action-${action.feedbackKey || action.title}` : undefined}
      />
    ) : null;
  const rows: MejaiScrollTableRow[] = items.map((item) => ({
    key: item.key,
    selected: item.selected,
    onClick: item.onClick,
    expandedContent: item.expandedContent,
    ownerItemKey: ownerItemKey ? `${ownerItemKey}-row-${item.key}` : undefined,
    ownerItemName: `${ownerItemName} 행 - ${item.label}`,
    ariaLabel: item.label,
    title: [
      item.signatureSlotLabel || item.label,
      item.statusLabel,
      item.signatureSignerName,
      item.signatureRequestedAt,
      item.signatureSignedAt,
      item.contact,
      item.roleLabel,
      item.scopeLabel,
      item.summary,
    ]
      .filter(Boolean)
      .join(' / '),
    cells: {
      label: item.labelContent ?? item.label,
      status: item.statusContent ?? (
        <Badge variant={item.statusVariant} className="px-1.5 py-0 text-[10px] font-semibold leading-5">
          {item.statusLabel}
        </Badge>
      ),
      checklistType: item.checklistTypeLabel || '-',
      target: item.targetLabel || item.source,
      assignee: item.assigneeLabel || '-',
      completedAt: item.completedAtLabel || '-',
      summary: item.summary,
      savedAt: item.savedAt || item.summary,
      template: item.templateLabel ?? item.source,
      capturedAt: item.capturedAt || '-',
      evidence: item.evidenceLabel || item.summary,
      contact: item.contact || '-',
      role: item.roleContent ?? item.roleLabel ?? '-',
      documents: item.documentsContent ?? '-',
      scope: item.scopeContent ?? item.scopeLabel ?? '-',
      lastVerifiedAt: item.lastVerifiedAt || '-',
      signatureSlot: item.signatureSlotLabel || item.label,
      signatureSigner: item.signatureSignerName || '-',
      signaturePhone: item.signatureSignerPhoneNumber || '-',
      signatureRequestedAt: item.signatureRequestedAt || '-',
      signatureSignedAt: item.signatureSignedAt || '-',
      signatureExpiresAt: item.signatureExpiresAt || '-',
      detailAction: item.detailAction ? (
        <ProjectListActionButton
          action={item.detailAction}
          className="h-7 w-7 rounded-md text-slate-500"
          ownerItemKey={ownerItemKey ? `${ownerItemKey}-detail-action-${item.key}` : undefined}
        />
      ) : null,
      documentLinkAction: renderLinkActionButton(item.documentLinkAction),
      registerAction: item.registerAction ? (
        <ProjectListActionButton
          action={item.registerAction}
          className="h-7 w-7 rounded-md text-blue-600 disabled:text-slate-300"
          ownerItemKey={ownerItemKey ? `${ownerItemKey}-register-action-${item.key}` : undefined}
        />
      ) : null,
      action: item.action ? (
        <ProjectListActionButton
          action={item.action}
          className="h-7 w-7 rounded-md text-rose-600"
          ownerItemKey={ownerItemKey ? `${ownerItemKey}-row-action-${item.key}` : undefined}
        />
      ) : null,
    },
  }));

  return (
    <div {...(ownerItemKey ? projectOwnerItem(ownerItemKey, ownerItemName) : {})}>
      <MejaiScrollTable
        columns={columns}
        rows={rows}
        emptyMessage={emptyMessage || '표시할 항목이 없습니다.'}
        maxHeightClassName={maxBodyHeightClassName}
        minTableWidth={resolvedMinTableWidth}
        showIndexColumn={false}
        ownerItemKey={ownerItemKey ? `${ownerItemKey}-scroll-table` : undefined}
        ownerItemName={`${ownerItemName} 스크롤 표`}
        ownerItemAttributes={ownerItemKey ? projectOwnerItem : undefined}
      />
    </div>
  );
}

export default function ProjectPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSiteId = searchParams.get('projectId')?.trim() || searchParams.get('siteId')?.trim() || '';
  const requestedDocumentId = searchParams.get('documentId')?.trim() || '';
  const selectionQuerySyncRef = React.useRef<string | null>(null);
  const pendingSelectionQueryStateRef = React.useRef<string | null>(null);
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [documentsLoadedSiteId, setDocumentsLoadedSiteId] = React.useState('');
  const [photos, setPhotos] = React.useState<PhotoListItemDto[]>([]);
  const [selectedSiteId, setSelectedSiteId] = React.useState(requestedSiteId);
  const [selectedSiteIds, setSelectedSiteIds] = React.useState<string[]>(
    requestedSiteId ? [requestedSiteId] : []
  );
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(requestedDocumentId);
  const [selectedPhotoId, setSelectedPhotoId] = React.useState('');
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [dashboardSummaries, setDashboardSummaries] = React.useState<ProjectDashboardSiteSummary[]>([]);
  const [loadingDashboardSummaries, setLoadingDashboardSummaries] = React.useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = React.useState(0);
  const [showCreateSiteForm, setShowCreateSiteForm] = React.useState(false);
  const [newSiteName, setNewSiteName] = React.useState('');
  const [newSiteOpenDate, setNewSiteOpenDate] = React.useState(getTodayInputValue());
  const [newSiteTemplateIds, setNewSiteTemplateIds] = React.useState<string[]>([]);
  const [showAddSiteDocumentForm, setShowAddSiteDocumentForm] = React.useState(false);
  const [siteDocumentTemplateIds, setSiteDocumentTemplateIds] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loadingRoot, setLoadingRoot] = React.useState(false);
  const [rootDataLoaded, setRootDataLoaded] = React.useState(false);
  const [loadingSiteData, setLoadingSiteData] = React.useState(false);
  const [loadingDocumentDetail, setLoadingDocumentDetail] = React.useState(false);
  const [creatingSite, setCreatingSite] = React.useState(false);
  const [addingSiteDocuments, setAddingSiteDocuments] = React.useState(false);
  const [deletingDocument, setDeletingDocument] = React.useState(false);
  const copiedDocumentLinkTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentLinkButtonTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [copyingDocumentLinkKey, setCopyingDocumentLinkKey] = React.useState('');
  const [copiedDocumentLinkKey, setCopiedDocumentLinkKey] = React.useState('');
  const [loadingDeleteImpact, setLoadingDeleteImpact] = React.useState(false);
  const [deletingSite, setDeletingSite] = React.useState(false);
  const [deleteImpact, setDeleteImpact] = React.useState<SiteDeleteImpactDto | null>(null);
  const [selectedDocumentDetailError, setSelectedDocumentDetailError] = React.useState<string | null>(null);
  const [selectedDocumentDetailErrorDebug, setSelectedDocumentDetailErrorDebug] = React.useState<ApiErrorDebug | null>(null);
  const [expandedDocumentStatusDocumentId, setExpandedDocumentStatusDocumentId] = React.useState('');
  const [showSignatureRequestForm, setShowSignatureRequestForm] = React.useState(false);
  const [signatureRequestMemberId, setSignatureRequestMemberId] = React.useState('');
  const [signatureRequestSignerName, setSignatureRequestSignerName] = React.useState('');
  const [signatureRequestPhoneNumber, setSignatureRequestPhoneNumber] = React.useState('');
  const [signatureRequestSlotKey, setSignatureRequestSlotKey] = React.useState('');
  const [signatureRequestFeedback, setSignatureRequestFeedback] = React.useState<{
    variant: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);
  const [creatingSignatureRequest, setCreatingSignatureRequest] = React.useState(false);
  const [deletingSignatureRequestId, setDeletingSignatureRequestId] = React.useState('');
  const [showPhotoRequirementForm, setShowPhotoRequirementForm] = React.useState(false);
  const [photoRequirementTagName, setPhotoRequirementTagName] = React.useState('');
  const [photoRequirementCount, setPhotoRequirementCount] = React.useState('1');
  const [photoRequirementLinkedPositionKey, setPhotoRequirementLinkedPositionKey] = React.useState('');
  const [savingPhotoRequirement, setSavingPhotoRequirement] = React.useState(false);
  const [photoRequirementFeedback, setPhotoRequirementFeedback] = React.useState<{
    variant: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);
  const [activeDocumentChecklistTab, setActiveDocumentChecklistTab] =
    React.useState<DocumentChecklistTab>('signature');
  const [fileRequirementsByDocumentId, setFileRequirementsByDocumentId] = React.useState<
    Record<string, DocumentFileRequirement[]>
  >({});
  const [showFileRequirementForm, setShowFileRequirementForm] = React.useState(false);
  const [fileRequirementTitle, setFileRequirementTitle] = React.useState('');
  const [fileRequirementCount, setFileRequirementCount] = React.useState('1');
  const [fileRequirementLinkedPositionKey, setFileRequirementLinkedPositionKey] = React.useState('');
  const [fileRequirementFeedback, setFileRequirementFeedback] = React.useState<{
    variant: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);
  const [activeProjectDocumentOutputTab, setActiveProjectDocumentOutputTab] =
    React.useState<ProjectDocumentOutputTab>('edit');
  const [photoRequirementLinksByKey, setPhotoRequirementLinksByKey] = React.useState<
    Record<string, ProjectChecklistLinkedPosition>
  >({});
  const [pendingChecklistRegistration, setPendingChecklistRegistration] =
    React.useState<PendingChecklistRegistration | null>(null);
  const [checklistRegistrationTarget, setChecklistRegistrationTarget] =
    React.useState<TemplateChecklistRegistrationTarget | null>(null);
  const photoRegistrationInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileRegistrationInputRef = React.useRef<HTMLInputElement | null>(null);
  const [siteMembers, setSiteMembers] = React.useState<SiteMemberRecordDto[]>([]);
  const [siteDocumentMembers, setSiteDocumentMembers] = React.useState<DocumentMemberRecordDto[]>([]);
  const [templateScopeContextsByTemplateId, setTemplateScopeContextsByTemplateId] = React.useState<Record<string, TemplateScopeContextDto>>({});
  const [loadingTemplateScopeContexts, setLoadingTemplateScopeContexts] = React.useState(false);
  const [memberAccessSession, setMemberAccessSession] = React.useState<MemberAccessSessionDto | null>(null);
  const [loadingSiteMembers, setLoadingSiteMembers] = React.useState(false);
  const [loadingSiteDocumentMembers, setLoadingSiteDocumentMembers] = React.useState(false);
  const [showAddSiteMemberForm, setShowAddSiteMemberForm] = React.useState(false);
  const [siteMemberPhoneNumber, setSiteMemberPhoneNumber] = React.useState('');
  const [siteMemberDisplayName, setSiteMemberDisplayName] = React.useState('');
  const [siteMemberRole, setSiteMemberRole] = React.useState<ManagedSiteMemberAccessRole>('participant');
  const [siteMemberDocumentIds, setSiteMemberDocumentIds] = React.useState<string[]>([]);
  const [siteMemberDocumentScopeKeys, setSiteMemberDocumentScopeKeys] = React.useState<string[]>([]);
  const [expandedSiteMemberId, setExpandedSiteMemberId] = React.useState('');
  const [invitingSiteMember, setInvitingSiteMember] = React.useState(false);
  const [deletingSiteMemberId, setDeletingSiteMemberId] = React.useState('');
  const [updatingSiteMemberId, setUpdatingSiteMemberId] = React.useState('');
  const [savingMemberDocumentAccessKey, setSavingMemberDocumentAccessKey] = React.useState('');

  React.useEffect(
    () => () => {
      if (copiedDocumentLinkTimerRef.current) {
        clearTimeout(copiedDocumentLinkTimerRef.current);
      }
      Object.values(documentLinkButtonTimersRef.current).forEach((timer) => clearTimeout(timer));
      documentLinkButtonTimersRef.current = {};
    },
    []
  );

  React.useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(DOCUMENT_FILE_REQUIREMENTS_STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue);

      if (parsedValue && !Array.isArray(parsedValue) && typeof parsedValue === 'object') {
        setFileRequirementsByDocumentId(parsedValue as Record<string, DocumentFileRequirement[]>);
      }
    } catch {
      setFileRequirementsByDocumentId({});
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        DOCUMENT_FILE_REQUIREMENTS_STORAGE_KEY,
        JSON.stringify(fileRequirementsByDocumentId)
      );
    } catch {
      // localStorage is only a client-side requirement cache. The page can continue without it.
    }
  }, [fileRequirementsByDocumentId]);

  React.useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(PHOTO_REQUIREMENT_LINKS_STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue);

      if (parsedValue && !Array.isArray(parsedValue) && typeof parsedValue === 'object') {
        setPhotoRequirementLinksByKey(parsedValue as Record<string, ProjectChecklistLinkedPosition>);
      }
    } catch {
      setPhotoRequirementLinksByKey({});
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(PHOTO_REQUIREMENT_LINKS_STORAGE_KEY, JSON.stringify(photoRequirementLinksByKey));
    } catch {
      // localStorage is only a client-side document-position cache. The page can continue without it.
    }
  }, [photoRequirementLinksByKey]);

  React.useEffect(() => {
    let active = true;

    void fetchSuccessData<MemberAccessSessionDto | null>('/api/member-access/session')
      .then((session) => {
        if (active) {
          setMemberAccessSession(session);
        }
      })
      .catch(() => {
        if (active) {
          setMemberAccessSession(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    setShowSignatureRequestForm(false);
    setSignatureRequestMemberId('');
    setSignatureRequestSignerName('');
    setSignatureRequestPhoneNumber('');
    setSignatureRequestSlotKey('');
    setSignatureRequestFeedback(null);
    setShowPhotoRequirementForm(false);
    setPhotoRequirementTagName('');
    setPhotoRequirementCount('1');
    setPhotoRequirementLinkedPositionKey('');
    setPhotoRequirementFeedback(null);
    setShowFileRequirementForm(false);
    setFileRequirementTitle('');
    setFileRequirementCount('1');
    setFileRequirementLinkedPositionKey('');
    setFileRequirementFeedback(null);
    setPendingChecklistRegistration(null);
    setChecklistRegistrationTarget(null);
  }, [selectedDocumentId]);

  React.useEffect(() => {
    const nextQueryKey = buildProjectSelectionQueryKey(requestedSiteId, requestedDocumentId);

    if (selectionQuerySyncRef.current === nextQueryKey) {
      return;
    }

    selectionQuerySyncRef.current = nextQueryKey;
    pendingSelectionQueryStateRef.current = nextQueryKey;
    setSelectedSiteId(requestedSiteId);
    setSelectedSiteIds(requestedSiteId ? [requestedSiteId] : []);
    setSelectedDocumentId(requestedDocumentId);
    setExpandedDocumentStatusDocumentId(requestedDocumentId);
  }, [requestedDocumentId, requestedSiteId]);

  React.useEffect(() => {
    const normalizedSiteId = selectedSiteId.trim();
    const normalizedDocumentId = selectedDocumentId.trim();
    const nextQueryKey = buildProjectSelectionQueryKey(normalizedSiteId, normalizedDocumentId);
    const pendingSelectionQueryState = pendingSelectionQueryStateRef.current;

    if (pendingSelectionQueryState) {
      if (pendingSelectionQueryState !== nextQueryKey) {
        return;
      }

      pendingSelectionQueryStateRef.current = null;
    }

    if (selectionQuerySyncRef.current === nextQueryKey) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());

    nextSearchParams.delete('siteId');

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
  }, [pathname, router, searchParams, selectedDocumentId, selectedSiteId]);

  const selectedSite = React.useMemo(
    () => sites.find((site) => site.id === selectedSiteId) || null,
    [selectedSiteId, sites]
  );

  const siteOptions = React.useMemo(
    () =>
      sites.map((site) => ({
        id: site.id,
        label: site.siteName,
        meta: `공사 시작일 ${formatDate(site.openDate)}`,
        keywords: [site.siteName, site.openDate, site.id],
      })),
    [sites]
  );

  const selectedNewSiteTemplates = React.useMemo(
    () => templates.filter((template) => newSiteTemplateIds.includes(template.id)),
    [newSiteTemplateIds, templates]
  );

  const newSiteTemplateOptions = React.useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: `마지막 수정 ${formatDate(template.updatedAt)}`,
        keywords: [template.templateName, template.sourceDocumentName || '', template.id],
      })),
    [templates]
  );

  const siteDocumentTemplateOptions = React.useMemo(() => {
    const existingTemplateIds = new Set(
      documents.map((item) => item.document.templateId).filter((templateId): templateId is string => Boolean(templateId))
    );

    return templates
      .filter((template) => !existingTemplateIds.has(template.id))
      .map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: `마지막 수정 ${formatDate(template.updatedAt)}`,
        keywords: [template.templateName, template.sourceDocumentName || '', template.id],
      }));
  }, [documents, templates]);

  const selectedPhoto = React.useMemo(
    () => photos.find((item) => item.photo.id === selectedPhotoId) || null,
    [photos, selectedPhotoId]
  );

  const selectedDocumentListItem = React.useMemo(
    () => documents.find((item) => item.document.id === selectedDocumentId) || null,
    [documents, selectedDocumentId]
  );

  const selectedDocumentVersionSource = React.useMemo(
    () => selectedDocumentDetail?.latestVersion || selectedDocumentListItem?.latestVersion || null,
    [selectedDocumentDetail?.latestVersion, selectedDocumentListItem?.latestVersion]
  );

  const selectedDocumentValueEntryValues = React.useMemo<Record<string, unknown>>(() => {
    return mergeDocumentCanvasLabelValues({}, selectedDocumentDetail?.valueEntries || []);
  }, [selectedDocumentDetail?.valueEntries]);

  const isRefreshing = loadingRoot || loadingSiteData;

  const selectedDocumentLabelValues = React.useMemo<Record<string, unknown>>(() => {
    return {
      ...(selectedDocumentVersionSource?.labelValues || {}),
      ...(selectedDocumentDetail ? buildDocumentAttachmentTextByValueKey(selectedDocumentDetail.valueFiles) : {}),
      ...selectedDocumentValueEntryValues,
    };
  }, [selectedDocumentDetail, selectedDocumentValueEntryValues, selectedDocumentVersionSource?.labelValues]);

  const selectedDocumentAttachmentFilesByValueKey = React.useMemo(
    () => (selectedDocumentDetail ? groupDocumentValueFilesByValueKey(selectedDocumentDetail.valueFiles) : {}),
    [selectedDocumentDetail]
  );

  const selectedDocumentMaterializedHtml = React.useMemo(
    () =>
      materializeDocumentHtml({
        linkedRenderHtml:
          selectedDocumentDetail?.linkedTemplate?.draftHtml || selectedDocumentDetail?.linkedTemplate?.renderSnapshotHtml,
        latestVersionHtml: selectedDocumentVersionSource?.htmlCanonical,
        labelValues: selectedDocumentLabelValues,
      }).trim(),
    [
      selectedDocumentDetail?.linkedTemplate?.draftHtml,
      selectedDocumentDetail?.linkedTemplate?.renderSnapshotHtml,
      selectedDocumentLabelValues,
      selectedDocumentVersionSource?.htmlCanonical,
    ]
  );

  const selectedDocumentSignatureBoxCount = React.useMemo(
    () => getDocumentSignatureBoxCount(selectedDocumentMaterializedHtml),
    [selectedDocumentMaterializedHtml]
  );
  const selectedDocumentSignatureSlots = React.useMemo(
    () => getDocumentSignatureSlots(selectedDocumentMaterializedHtml),
    [selectedDocumentMaterializedHtml]
  );
  const selectedDocumentSignatureSlotByKey = React.useMemo(
    () => new Map(selectedDocumentSignatureSlots.map((slot) => [slot.slotKey, slot] as const)),
    [selectedDocumentSignatureSlots]
  );
  const selectedDocumentChecklistLinkedPositions = React.useMemo(
    () => getDocumentChecklistLinkedPositions(selectedDocumentMaterializedHtml),
    [selectedDocumentMaterializedHtml]
  );
  const selectedDocumentAttachmentLinkedPositions = React.useMemo(
    () => selectedDocumentChecklistLinkedPositions.filter((position) => position.boxKind === 'attachment'),
    [selectedDocumentChecklistLinkedPositions]
  );
  const selectedDocumentChecklistLinkedPositionByKey = React.useMemo(
    () => new Map(selectedDocumentChecklistLinkedPositions.map((position) => [position.key, position] as const)),
    [selectedDocumentChecklistLinkedPositions]
  );
  const selectedDocumentChecklistSignatureStates = React.useMemo<TemplateChecklistSignatureState[]>(
    () =>
      (selectedDocumentDetail?.signatureEvidence || [])
        .filter((item) => Boolean(item.signatureImagePath?.trim()))
        .map((item) => {
          const signatureSlot = resolveDocumentSignatureEvidenceSlot(
            item.slotKey,
            selectedDocumentSignatureSlots,
            selectedDocumentSignatureSlotByKey
          );

          return {
            slotKey: signatureSlot?.slotKey || normalizeSignatureSlotText(item.slotKey) || item.label,
            imageData: item.signatureImagePath || '',
            signerName: item.signerName,
            signedAt: item.signedAt,
            provider: '전자서명',
          };
        }),
    [selectedDocumentDetail?.signatureEvidence, selectedDocumentSignatureSlotByKey, selectedDocumentSignatureSlots]
  );

  const selectedDocumentInitialDraft = React.useMemo<TemplateEditWorkspaceInitialDraft | null>(() => {
    if (!selectedDocumentId) {
      return null;
    }

    const materializedHtml = selectedDocumentMaterializedHtml;

    if (!materializedHtml.trim()) {
      return null;
    }

    const draftVersionKey =
      selectedDocumentVersionSource?.id ||
      selectedDocumentDetail?.linkedTemplate?.resolvedRevisionId ||
      selectedDocumentDetail?.templateLink?.lastSyncedRevisionId ||
      'linked-template';

    return {
      draftKey: `${selectedDocumentId}:${draftVersionKey}:${buildDocumentHtmlContentKey(materializedHtml)}`,
      templateName: selectedDocumentListItem?.document.title || selectedDocumentDetail?.document.title || '현장 문서',
      draftHtml: materializedHtml,
      sourceDocumentName: '',
      layoutResizeMode: 'grow_height',
      attachmentFilesByValueKey: selectedDocumentAttachmentFilesByValueKey,
    };
  }, [
    selectedDocumentAttachmentFilesByValueKey,
    selectedDocumentDetail?.linkedTemplate?.resolvedRevisionId,
    selectedDocumentDetail?.templateLink?.lastSyncedAt,
    selectedDocumentDetail?.templateLink?.lastSyncedRevisionId,
    selectedDocumentDetail?.document.title,
    selectedDocumentId,
    selectedDocumentMaterializedHtml,
    selectedDocumentListItem?.document.title,
    selectedDocumentVersionSource,
  ]);

  const selectedDocumentLabelEntries = React.useMemo(
    () =>
      Object.entries(selectedDocumentLabelValues).filter(([key, value]) => {
        if (isConnectedDocumentInfoKey(key)) {
          return false;
        }

        if (typeof value === 'string') {
          return Boolean(value.trim());
        }

        return value !== null && value !== undefined;
      }),
    [selectedDocumentLabelValues]
  );

  const selectedDocumentRecordedValueSummary = React.useMemo(
    () =>
      selectedDocumentLabelEntries
        .map(([labelKey, value]) => `${getDocumentFieldLabel(labelKey)}: ${stringifyDocumentValue(value) || '-'}`)
        .join(' · '),
    [selectedDocumentLabelEntries]
  );

  const selectedDocumentAttachmentSummary = React.useMemo(() => {
    if (!selectedDocumentDetail) {
      return '';
    }

    return selectedDocumentDetail.valueFiles
      .map((file) => {
        const segments = [file.originalFileName];
        const uploadedAtText = formatDateTime(file.uploadedAt);

        if (uploadedAtText !== '-') {
          segments.push(`등록 ${uploadedAtText}`);
        }

        return segments.join(' / ');
      })
      .join(' · ');
  }, [selectedDocumentDetail]);

  const selectedDocumentVersionHistorySummary = React.useMemo(() => {
    if (!selectedDocumentDetail) {
      return '';
    }

    return selectedDocumentDetail.versions
      .map((version) => `v${version.versionNumber} ${formatDateTime(version.createdAt)}`)
      .join(' · ');
  }, [selectedDocumentDetail]);

  const selectedDocumentQueryDebug = selectedDocumentDetail?.queryDebug || selectedDocumentDetailErrorDebug || null;

  const selectedDocumentDetailDiagnostics = React.useMemo<DocumentDetailDiagnosticItem[]>(() => {
    if (!selectedDocumentListItem && !selectedDocumentId) {
      return [];
    }

    const detailFailureMessage = selectedDocumentDetailError
      ? '문서 정보를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.'
      : '문서 정보를 불러오지 못했습니다.';
    const latestVersion = selectedDocumentVersionSource;
    const baseDocument = selectedDocumentDetail?.document || selectedDocumentListItem?.document || null;
    const detailAvailable = Boolean(selectedDocumentDetail);
    const recordedValueCount = selectedDocumentLabelEntries.length;
    const versionsIssue = selectedDocumentQueryDebug?.versions?.trim() || '';
    const artifactsIssue = selectedDocumentQueryDebug?.artifacts?.trim() || '';
    const valueFilesIssue = selectedDocumentQueryDebug?.valueFiles?.trim() || '';
    const photoEvidenceIssue = selectedDocumentQueryDebug?.photoEvidence?.trim() || '';
    const templateLinkIssue = selectedDocumentQueryDebug?.templateLink?.trim() || '';
    const valueEntriesIssue = selectedDocumentQueryDebug?.valueEntries?.trim() || '';
    const signatureIssue = selectedDocumentQueryDebug?.signatureEvidence?.trim() || '';
    const signatureRequestCount = selectedDocumentDetail?.signatureEvidence.length || 0;
    const signatureCompletedCount =
      selectedDocumentDetail?.signatureEvidence.filter((item) => item.status === 'completed').length || 0;
    const signaturePendingCount =
      selectedDocumentDetail?.signatureEvidence.filter((item) => item.status !== 'completed').length || 0;
    const blockingDebugKeys = new Set<keyof ApiErrorDebug>([
      'versions',
      'artifacts',
      'valueFiles',
      'photoEvidence',
      'templateLink',
      'valueEntries',
    ]);
    const effectiveDocumentHtml = selectedDocumentMaterializedHtml;
    const signatureBoxSummary =
      selectedDocumentSignatureSlots.length > 0
        ? `서명 위치 ${selectedDocumentSignatureSlots.length}곳`
        : selectedDocumentSignatureBoxCount > 0
          ? `서명 위치 ${selectedDocumentSignatureBoxCount}곳`
          : '서명 위치 없음';
    const blockedByFailures = Object.entries(selectedDocumentQueryDebug || {})
      .filter((entry): entry is [keyof ApiErrorDebug, string] => Boolean(entry[1]?.trim()))
      .filter(([key]) => blockingDebugKeys.has(key))
      .map(([key]) => DOCUMENT_DETAIL_DEBUG_LABELS[key]);
    const blockedSummary =
      blockedByFailures.length > 0
        ? `${blockedByFailures.join(', ')} 정보를 먼저 불러와야 확인할 수 있습니다. 새로고침 후 다시 확인해 주세요.`
        : '문서 정보를 먼저 불러와야 확인할 수 있습니다. 새로고침 후 다시 확인해 주세요.';

    return [
      {
        key: 'document-base',
        label: '문서 기본 정보',
        status: baseDocument ? 'loaded' : loadingDocumentDetail ? 'loading' : selectedDocumentDetailError ? 'error' : 'missing',
        summary: baseDocument
          ? `${baseDocument.title} · ${getDocumentStatusLabel(baseDocument.status)} · 현재 버전 ${baseDocument.currentVersionNumber || 0} · 생성일 ${formatDate(baseDocument.createdAt)}`
          : loadingDocumentDetail
            ? '문서 제목과 상태를 불러오는 중입니다.'
            : selectedDocumentDetailError
              ? detailFailureMessage
              : '문서 기본 정보가 없습니다.',
        source: '선택한 현장 문서',
      },
      {
        key: 'document-body',
        label: '문서 본문',
        status: versionsIssue
          ? 'error'
          : effectiveDocumentHtml
            ? 'loaded'
            : loadingDocumentDetail
              ? 'loading'
              : selectedDocumentDetailError
                ? 'error'
                : 'missing',
        summary: effectiveDocumentHtml
          ? `${selectedDocumentDetail?.linkedTemplate ? '문서 양식에서 만든 본문' : '직접 저장한 본문'} · 마지막 저장 ${formatDateTime(latestVersion?.createdAt)}`
          : versionsIssue
            ? getDocumentDetailIssueMessage('문서 본문', versionsIssue)
            : loadingDocumentDetail
              ? '문서 본문을 불러오는 중입니다.'
              : selectedDocumentDetailError
                ? detailFailureMessage
                : '문서 본문이 없습니다.',
        source: selectedDocumentDetail?.linkedTemplate ? '연결된 문서 양식과 입력 값' : '최근 저장한 문서',
      },
      {
        key: 'template-link',
        label: '문서 양식 연결',
        status: templateLinkIssue
          ? 'error'
          : detailAvailable
            ? selectedDocumentDetail.linkedTemplate
              ? 'loaded'
              : 'missing'
            : loadingDocumentDetail
              ? 'loading'
              : selectedDocumentDetailError
                ? 'blocked'
                : 'missing',
        summary: templateLinkIssue
          ? getDocumentDetailIssueMessage('문서 양식 연결', templateLinkIssue)
          : detailAvailable
            ? selectedDocumentDetail.linkedTemplate
              ? `${selectedDocumentDetail.linkedTemplate.templateName} · 양식 버전 ${selectedDocumentDetail.linkedTemplate.resolvedRevisionNumber || '-'} · 마지막 반영 ${formatDateTime(selectedDocumentDetail.templateLink?.lastSyncedAt)}`
              : '문서 양식 없이 직접 관리하는 문서입니다.'
            : loadingDocumentDetail
              ? '연결된 문서 양식을 확인하는 중입니다.'
            : selectedDocumentDetailError
                ? blockedSummary
                : '연결된 문서 양식이 없습니다.',
        source: '문서 양식 연결 상태',
      },
      {
        key: 'recorded-values',
        label: '문서에 기록된 값',
        status: valueEntriesIssue
          ? 'error'
          : detailAvailable
            ? selectedDocumentDetail.valueEntries.length > 0 || recordedValueCount > 0
              ? 'loaded'
              : 'missing'
            : latestVersion
              ? recordedValueCount > 0
                ? 'loaded'
                : 'missing'
              : loadingDocumentDetail
                ? 'loading'
                : selectedDocumentDetailError
                  ? 'error'
                  : 'missing',
        summary: valueEntriesIssue
          ? getDocumentDetailIssueMessage('문서에 기록된 값', valueEntriesIssue)
          : detailAvailable
            ? selectedDocumentDetail.valueEntries.length > 0
              ? selectedDocumentRecordedValueSummary || `${selectedDocumentDetail.valueEntries.length}개의 문서 값이 저장되어 있습니다.`
              : recordedValueCount > 0
                ? selectedDocumentRecordedValueSummary
                : '저장된 기록 값이 없습니다.'
            : latestVersion
              ? recordedValueCount > 0
                ? selectedDocumentRecordedValueSummary
                : '저장된 기록 값이 없습니다.'
              : loadingDocumentDetail
                ? '문서에 기록된 값을 불러오는 중입니다.'
                : selectedDocumentDetailError
                ? detailFailureMessage
                  : '저장된 기록 값이 없습니다.',
        source: detailAvailable ? '저장된 문서 값' : '최근 저장한 문서 값',
      },
      {
        key: 'signature-evidence',
        label: '서명',
        status: detailAvailable
          ? selectedDocumentSignatureBoxCount > 0 || signatureRequestCount > 0
            ? 'loaded'
            : 'missing'
          : loadingDocumentDetail
            ? 'loading'
            : selectedDocumentDetailError
              ? 'blocked'
              : selectedDocumentSignatureBoxCount > 0
                ? 'loaded'
                : 'missing',
        summary: detailAvailable
          ? selectedDocumentSignatureBoxCount > 0 || signatureRequestCount > 0
            ? signatureIssue
              ? `${signatureBoxSummary} · 서명 요청 상태를 불러오지 못했습니다.`
              : `${signatureBoxSummary} · 요청 ${signatureRequestCount}건 · 완료 ${signatureCompletedCount}건 · 대기 ${signaturePendingCount}건`
            : '서명 위치 없음'
          : loadingDocumentDetail
            ? '서명 상태를 확인하는 중입니다.'
            : selectedDocumentDetailError
              ? blockedSummary
              : selectedDocumentSignatureBoxCount > 0
                ? `${signatureBoxSummary} · 요청 상태를 확인하려면 문서 상세를 다시 불러와 주세요.`
                : '서명 위치 없음',
        source: '서명 위치와 요청 상태',
      },
      {
        key: 'attachments',
        label: '첨부 파일',
        status: valueFilesIssue
          ? 'error'
          : detailAvailable
            ? selectedDocumentDetail.valueFiles.length > 0
              ? 'loaded'
              : 'missing'
            : loadingDocumentDetail
              ? 'loading'
              : selectedDocumentDetailError
                ? 'blocked'
                : 'missing',
        summary: valueFilesIssue
          ? getDocumentDetailIssueMessage('첨부 파일', valueFilesIssue)
          : detailAvailable
            ? selectedDocumentDetail.valueFiles.length > 0
              ? selectedDocumentAttachmentSummary
              : '연결된 첨부 파일이 없습니다.'
            : loadingDocumentDetail
              ? '첨부 파일을 불러오는 중입니다.'
              : selectedDocumentDetailError
                ? blockedSummary
                : '연결된 첨부 파일이 없습니다.',
        source: '첨부 파일',
      },
      {
        key: 'photo-evidence',
        label: '사진 증빙 상태',
        status: photoEvidenceIssue
          ? 'error'
          : detailAvailable
            ? 'loaded'
            : loadingDocumentDetail
              ? 'loading'
              : selectedDocumentDetailError
                ? 'blocked'
                : 'missing',
        summary: photoEvidenceIssue
          ? getDocumentDetailIssueMessage('사진 증빙 상태', photoEvidenceIssue)
          : detailAvailable
            ? `${getPhotoEvidenceStatusLabel(selectedDocumentDetail.photoEvidence.status)} · 요구 ${selectedDocumentDetail.photoEvidence.requirementCount}건 · 충족 ${selectedDocumentDetail.photoEvidence.coveredCount}건 · 검토 필요 ${selectedDocumentDetail.photoEvidence.reviewNeededCount}건 · 누락 ${selectedDocumentDetail.photoEvidence.missingCount}건`
            : loadingDocumentDetail
              ? '사진 증빙 상태를 계산하는 중입니다.'
            : selectedDocumentDetailError
                ? blockedSummary
                : '사진 증빙 상태를 확인할 수 없습니다.',
        source: '사진 증빙 요구 상태',
      },
      {
        key: 'version-history',
        label: '버전 이력',
        status: versionsIssue
          ? 'error'
          : detailAvailable
            ? selectedDocumentDetail.versions.length > 0
              ? 'loaded'
              : 'missing'
            : loadingDocumentDetail
              ? 'loading'
              : selectedDocumentDetailError
                ? 'blocked'
                : 'missing',
        summary: versionsIssue
          ? getDocumentDetailIssueMessage('버전 이력', versionsIssue)
          : detailAvailable
            ? selectedDocumentDetail.versions.length > 0
              ? selectedDocumentVersionHistorySummary
              : '버전 이력이 없습니다.'
            : loadingDocumentDetail
              ? '버전 이력을 불러오는 중입니다.'
              : selectedDocumentDetailError
                ? blockedSummary
                : '버전 이력이 없습니다.',
        source: '저장 이력',
      },
      {
        key: 'artifacts',
        label: '출력본',
        status: artifactsIssue
          ? 'error'
          : selectedDocumentListItem
            ? selectedDocumentListItem.artifactCount > 0
              ? 'loaded'
              : 'missing'
            : loadingDocumentDetail
              ? 'loading'
              : selectedDocumentDetailError
                ? 'error'
                : 'missing',
        summary: artifactsIssue
          ? getDocumentDetailIssueMessage('출력본', artifactsIssue)
          : selectedDocumentListItem
            ? selectedDocumentListItem.artifactCount > 0
              ? `${selectedDocumentListItem.artifactCount}건의 출력본이 등록되어 있습니다.`
              : '등록된 출력본이 없습니다.'
            : loadingDocumentDetail
              ? '출력본 수를 확인하는 중입니다.'
              : selectedDocumentDetailError
                ? detailFailureMessage
                : '출력본 수를 확인할 수 없습니다.',
        source: '출력본',
      },
    ];
  }, [
    loadingDocumentDetail,
    selectedDocumentAttachmentSummary,
    selectedDocumentDetail,
    selectedDocumentDetailError,
    selectedDocumentDetailErrorDebug,
    selectedDocumentId,
    selectedDocumentLabelEntries.length,
    selectedDocumentListItem,
    selectedDocumentLabelValues,
    selectedDocumentMaterializedHtml,
    selectedDocumentQueryDebug,
    selectedDocumentRecordedValueSummary,
    selectedDocumentSignatureBoxCount,
    selectedDocumentSignatureSlots.length,
    selectedDocumentVersionSource,
    selectedDocumentVersionHistorySummary,
  ]);

  const selectedDocumentDetailRows = React.useMemo<ProjectListRow[]>(
    () =>
      selectedDocumentDetailDiagnostics.map((item) => ({
        key: item.key,
        label: item.label,
        statusLabel: getDiagnosticStatusLabel(item.status),
        statusVariant: getDiagnosticStatusVariant(item.status),
        summary: item.summary,
        source: item.source,
      })),
    [selectedDocumentDetailDiagnostics]
  );

  const selectedSignatureRequestSiteId = selectedDocumentDetail?.document.siteId || selectedSiteId;
  const canDeleteSignatureRequests = React.useMemo(
    () =>
      Boolean(
        selectedSignatureRequestSiteId &&
          memberAccessSession?.accessibleSites.some(
            (site) =>
              site.siteId === selectedSignatureRequestSiteId &&
              getManagedSiteMemberRole(site.accessRole) === 'manager'
          )
      ),
    [memberAccessSession?.accessibleSites, selectedSignatureRequestSiteId]
  );

  const handleDeleteSignatureRequest = React.useCallback(async (
    requestId: string,
    signatureSlotLabel: string,
    signerName: string,
    signatureStatus: string
  ) => {
    const normalizedRequestId = requestId.trim();
    const normalizedStatus = signatureStatus.trim().toLowerCase();
    const deletesCompletedSignature = normalizedStatus === 'completed' || normalizedStatus === 'signed';
    const deleteTargetLabel = deletesCompletedSignature ? '서명' : '서명 요청';

    if (!normalizedRequestId || deletingSignatureRequestId || !canDeleteSignatureRequests) {
      if (!canDeleteSignatureRequests) {
        setMessage('서명 요청 삭제 권한이 없습니다. 관리자만 삭제할 수 있습니다.');
      }
      return;
    }

    const confirmed = window.confirm(
      deletesCompletedSignature
        ? `"${signatureSlotLabel || '서명'}" 완료 서명을 삭제하시겠습니까?\n서명자: ${signerName || '서명 대상 미지정'}\n\n완료된 서명을 삭제하면 계약서의 서명 표시와 증빙 상태에 치명적인 영향을 줄 수 있습니다. 삭제 후에는 같은 위치에 다시 서명 요청을 만들어야 할 수 있습니다.\n계속하시겠습니까?`
        : `"${signatureSlotLabel || '서명 요청'}" 요청을 철회하고 목록에서 삭제하시겠습니까?\n서명자: ${signerName || '서명 대상 미지정'}\n삭제 후 같은 위치에 다시 서명 요청을 만들 수 있습니다.`
    );

    if (!confirmed) {
      return;
    }

    const refreshDocumentId = selectedDocumentDetail?.document.id || selectedDocumentId.trim();

    setDeletingSignatureRequestId(normalizedRequestId);
    setSignatureRequestFeedback(null);
    setMessage(null);

    try {
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_REQUEST',
          requestId: normalizedRequestId,
          contractImpactAcknowledged: deletesCompletedSignature,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '서명 요청 삭제에 실패했습니다.');
      }

      let refreshFailed = false;

      if (refreshDocumentId) {
        setLoadingDocumentDetail(true);

        try {
          const detail = await fetchSuccessDataWithTimeout<DocumentDetailResult>(`/api/documents/${refreshDocumentId}`);

          setSelectedDocumentDetail(detail);
          setSelectedDocumentDetailError(null);
          setSelectedDocumentDetailErrorDebug(null);
        } catch {
          refreshFailed = true;
          setSelectedDocumentDetail((current) =>
            current
              ? {
                  ...current,
                  signatureEvidence: current.signatureEvidence.filter((item) => item.requestId !== normalizedRequestId),
                }
              : current
          );
        } finally {
          setLoadingDocumentDetail(false);
        }
      }

      setDashboardRefreshKey((current) => current + 1);
      setMessage(
        refreshFailed
          ? `"${signatureSlotLabel || deleteTargetLabel}"을 삭제했습니다. 목록 재조회는 새로고침 후 다시 확인해 주세요.`
          : `"${signatureSlotLabel || deleteTargetLabel}"을 삭제했습니다.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '서명 삭제에 실패했습니다.');
    } finally {
      setDeletingSignatureRequestId('');
    }
  }, [
    canDeleteSignatureRequests,
    deletingSignatureRequestId,
    selectedDocumentDetail?.document.id,
    selectedDocumentId,
  ]);

  function getSelectedDocumentIdForChecklist() {
    return selectedDocumentDetail?.document.id || selectedDocumentListItem?.document.id || selectedDocumentId.trim();
  }

  function getSelectedLinkedPosition(positionKey: string) {
    const normalizedKey = positionKey.trim();

    if (!normalizedKey) {
      return null;
    }

    return selectedDocumentChecklistLinkedPositionByKey.get(normalizedKey) || null;
  }

  function resolvePhotoRequirementLinkedPosition(documentId: string, tagName: string, tagKey: string) {
    return (
      photoRequirementLinksByKey[buildPhotoRequirementLinkKey(documentId, tagKey)] ||
      photoRequirementLinksByKey[buildPhotoRequirementLinkKey(documentId, tagName)] ||
      null
    );
  }

  async function persistChecklistDocumentFiles(valueKey: string, files: File[], changeReason: string) {
    const targetDocumentId = getSelectedDocumentIdForChecklist();
    const normalizedValueKey = valueKey.trim();

    if (!targetDocumentId) {
      throw new Error('파일을 등록할 문서를 먼저 선택해 주세요.');
    }

    if (!selectedDocumentMaterializedHtml.trim()) {
      throw new Error('파일을 등록할 문서 본문을 먼저 불러와 주세요.');
    }

    if (!normalizedValueKey) {
      throw new Error('파일을 등록할 문서 연결 위치를 확인하지 못했습니다.');
    }

    if (files.length === 0) {
      throw new Error('등록할 파일을 선택해 주세요.');
    }

    const formData = new FormData();
    formData.set('valueKey', normalizedValueKey);
    files.forEach((file) => {
      formData.append('files', file);
    });

    const uploadResponse = await fetch(`/api/documents/${encodeURIComponent(targetDocumentId)}/attachments`, {
      method: 'POST',
      body: formData,
    });
    const uploadResult = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadResult?.success) {
      throw new Error(uploadResult?.message || '첨부파일 업로드에 실패했습니다.');
    }

    const uploadedFiles = (uploadResult?.data?.uploads || []) as DocumentValueFileInput[];
    const existingFiles = (selectedDocumentDetail?.valueFiles || []).map((file, index) =>
      toDocumentValueFileInput(file, index)
    );
    const nextSortStart =
      existingFiles
        .filter((file) => file.valueKey === normalizedValueKey)
        .reduce((maxSortOrder, file) => Math.max(maxSortOrder, file.sortOrder || 0), -1) + 1;
    const normalizedUploads = uploadedFiles.map((file, index) => ({
      ...toDocumentValueFileInput(file, nextSortStart + index),
      valueKey: normalizedValueKey,
      sortOrder: nextSortStart + index,
      uploadedBy: file.uploadedBy || 'project-page',
    }));
    const nextValueFiles = [...existingFiles, ...normalizedUploads];
    const persistedHtml = materializeTemplateCanvasHtmlForPersistence(selectedDocumentMaterializedHtml, {
      attachmentFiles: nextValueFiles,
    });
    const versionResponse = await fetch(`/api/documents/${encodeURIComponent(targetDocumentId)}/version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        htmlCanonical: persistedHtml,
        labelValues: selectedDocumentLabelValues,
        valueFiles: nextValueFiles,
        changeReason,
        createdBy: 'project-page',
      }),
    });
    const versionResult = await versionResponse.json();

    if (!versionResponse.ok || !versionResult?.success) {
      throw new Error(versionResult?.message || '문서 파일 등록 내용을 저장하지 못했습니다.');
    }

    if (selectedSiteId) {
      await syncSiteDocuments(selectedSiteId);
    }

    await loadSelectedDocumentDetail(targetDocumentId);
    setDashboardRefreshKey((current) => current + 1);
  }

  async function refreshSelectedSitePhotos() {
    const targetSiteId = selectedDocumentDetail?.document.siteId || selectedSiteId.trim();

    if (!targetSiteId) {
      return;
    }

    try {
      const nextPhotos = await fetchSuccessData<PhotoListItemDto[]>(
        `/api/photos?siteId=${encodeURIComponent(targetSiteId)}`
      );
      setPhotos(Array.isArray(nextPhotos) ? nextPhotos : []);
    } catch {
      setMessage('사진은 등록했지만 사진 목록은 새로고침 후 다시 확인해 주세요.');
    }
  }

  async function uploadPhotoRequirementFiles(
    registration: Extract<PendingChecklistRegistration, { kind: 'photo' }>,
    files: File[]
  ) {
    const targetSiteId = selectedDocumentDetail?.document.siteId || selectedSiteId.trim();

    if (!targetSiteId) {
      throw new Error('사진을 등록할 현장을 먼저 선택해 주세요.');
    }

    if (files.length === 0) {
      throw new Error('등록할 사진을 선택해 주세요.');
    }

    const labelKey = registration.tagKey.trim() || registration.tagName.trim();

    for (const file of files) {
      const formData = new FormData();
      formData.set('siteId', targetSiteId);
      formData.set('photoTitle', `${registration.tagName} · ${file.name}`);
      formData.append('file', file);

      const uploadResponse = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadResult?.success) {
        throw new Error(uploadResult?.message || '필수 사진 등록에 실패했습니다.');
      }

      const photoId = uploadResult?.data?.photo?.id;

      if (photoId && labelKey) {
        const labelResponse = await fetch('/api/photos/labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoId,
                manualLabels: [
                  {
                    labelKey,
                    note: '문서 요청 링크 등록',
                  },
                ],
          }),
        });
        const labelResult = await labelResponse.json();

        if (!labelResponse.ok || !labelResult?.success) {
          throw new Error(labelResult?.message || '사진 태그 등록에 실패했습니다.');
        }
      }
    }

    if (registration.linkedPosition?.valueKey) {
      await persistChecklistDocumentFiles(
        registration.linkedPosition.valueKey,
        files,
        `checklist-photo:${registration.tagName}`
      );
    } else {
      const targetDocumentId = getSelectedDocumentIdForChecklist();

      if (targetDocumentId) {
        await loadSelectedDocumentDetail(targetDocumentId);
      }
    }

    await refreshSelectedSitePhotos();
    setDashboardRefreshKey((current) => current + 1);
  }

  async function uploadFileRequirementFiles(
    registration: Extract<PendingChecklistRegistration, { kind: 'file' }>,
    files: File[]
  ) {
    const valueKey = registration.linkedPosition?.valueKey || registration.tagName;

    await persistChecklistDocumentFiles(valueKey, files, `checklist-file:${registration.tagName}`);
  }

  async function completePendingChecklistRegistration(files: File[]) {
    const registration = pendingChecklistRegistration;

    if (!registration) {
      return;
    }

    if (registration.kind === 'photo') {
      await uploadPhotoRequirementFiles(registration, files);
      setMessage(`"${registration.tagName}" 사진을 등록했습니다.`);
    } else {
      await uploadFileRequirementFiles(registration, files);
      setMessage(`"${registration.tagName}" 파일을 등록했습니다.`);
    }

    setPendingChecklistRegistration(null);
    setChecklistRegistrationTarget(null);
  }

  function handleStartPhotoRequirementRegistration(
    item: DocumentDetailResult['photoRequirements'][number],
    linkedPosition: ProjectChecklistLinkedPosition | null
  ) {
    const registration: Extract<PendingChecklistRegistration, { kind: 'photo' }> = {
      kind: 'photo',
      requirementId: item.requirementId,
      tagKey: item.tagKey,
      tagName: item.tagName || item.tagKey,
      linkedPosition,
    };

    setPendingChecklistRegistration(registration);
    setMessage(null);

    if (linkedPosition) {
      setChecklistRegistrationTarget(
        buildChecklistTargetFromPosition({
          id: `photo:${item.requirementId}`,
          kind: 'photo',
          label: item.tagName || item.tagKey,
          linkedPosition,
        })
      );
      setMessage(`"${item.tagName || item.tagKey}" 사진을 등록할 문서 연결 위치를 선택해 주세요.`);
      return;
    }

    photoRegistrationInputRef.current?.click();
  }

  function handleStartFileRequirementRegistration(requirement: DocumentFileRequirement) {
    const linkedPosition = requirement.linkedPosition || null;
    const registration: Extract<PendingChecklistRegistration, { kind: 'file' }> = {
      kind: 'file',
      requirementId: requirement.id,
      tagName: requirement.title,
      linkedPosition,
    };

    setPendingChecklistRegistration(registration);
    setMessage(null);

    if (linkedPosition) {
      setChecklistRegistrationTarget(
        buildChecklistTargetFromPosition({
          id: `file:${requirement.id}`,
          kind: 'file',
          label: requirement.title,
          linkedPosition,
        })
      );
      setMessage(`"${requirement.title}" 파일을 등록할 문서 연결 위치를 선택해 주세요.`);
      return;
    }

    fileRegistrationInputRef.current?.click();
  }

  function handleStartValueRequirementRegistration(valueKey: string) {
    const linkedPosition =
      selectedDocumentChecklistLinkedPositions.find(
        (position) => position.valueKey === valueKey || position.frameGroupId === valueKey || position.label === valueKey
      ) || null;

    if (!linkedPosition) {
      setMessage('문서에서 이동할 입력 위치를 찾지 못했습니다.');
      return;
    }

    setChecklistRegistrationTarget(
      buildChecklistTargetFromPosition({
        id: `value:${valueKey}`,
        kind: 'value',
        label: getDocumentFieldLabel(valueKey),
        linkedPosition,
      })
    );
    setMessage(`"${getDocumentFieldLabel(valueKey)}" 입력 위치로 이동했습니다.`);
  }

  function handleChecklistTargetActivate(target: TemplateChecklistRegistrationTarget) {
    const registration = pendingChecklistRegistration;

    if (!registration) {
      return;
    }

    if (target.kind === 'photo' && registration.kind === 'photo') {
      photoRegistrationInputRef.current?.click();
      return;
    }

    if (target.kind === 'file' && registration.kind === 'file') {
      fileRegistrationInputRef.current?.click();
    }
  }

  async function handleChecklistSignatureSubmit(params: TemplateChecklistSignatureSubmitParams) {
    const requestId = params.target.requestId?.trim();
    const targetDocumentId = getSelectedDocumentIdForChecklist();

    if (!requestId) {
      throw new Error('서명 요청 ID를 확인하지 못했습니다.');
    }

    if (!targetDocumentId || !selectedDocumentMaterializedHtml.trim()) {
      throw new Error('서명할 문서 본문을 먼저 불러와 주세요.');
    }

    const response = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'EXECUTE',
        requestId,
        documentContent: selectedDocumentMaterializedHtml,
        signatureImagePath: params.imageData,
        allowDocumentHashMismatch: true,
      }),
    });
    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || '서명 등록에 실패했습니다.');
    }

    await loadSelectedDocumentDetail(targetDocumentId);
    setDashboardRefreshKey((current) => current + 1);
    setChecklistRegistrationTarget(null);
    setMessage(`"${params.target.label || '서명'}" 서명을 등록했습니다.`);
  }

  const selectedDocumentSignatureRows = React.useMemo<ProjectListRow[]>(
    () => {
      if (!selectedDocumentDetail) {
        return [];
      }

      if (selectedDocumentSignatureBoxCount === 0 && selectedDocumentDetail.signatureEvidence.length === 0) {
        return [
          {
            key: 'signature-box-none',
            label: '서명',
            statusLabel: '값 없음',
            statusVariant: 'slate',
            summary: '서명 위치 없음',
            source: '문서 서명',
            signatureSlotLabel: '서명 위치 없음',
            signatureSignerName: '-',
            signatureSignerPhoneNumber: '-',
            signatureRequestedAt: '-',
            signatureSignedAt: '-',
            signatureExpiresAt: '-',
          },
        ];
      }

      return selectedDocumentDetail.signatureEvidence.map((item) => {
        const signatureSlot = resolveDocumentSignatureEvidenceSlot(
          item.slotKey,
          selectedDocumentSignatureSlots,
          selectedDocumentSignatureSlotByKey
        );
        const signatureSlotLabel = signatureSlot?.label || item.label || item.signerRoleName || '서명 요청';
        const signatureSignerName = item.signerName || '서명 대상 미지정';
        const normalizedStatus = String(item.status || '').trim().toLowerCase();
        const signatureSlotKey = signatureSlot?.slotKey || normalizeSignatureSlotText(item.slotKey);
        const signatureLinkedPosition =
          selectedDocumentChecklistLinkedPositions.find(
            (position) =>
              position.boxKind === 'signature' &&
              (position.slotKey === signatureSlotKey ||
                position.valueKey === signatureSlotKey ||
                position.frameGroupId === signatureSlotKey)
          ) || null;
        const canRegisterSignature =
          normalizedStatus === 'pending' && Boolean(item.requestId) && Boolean(signatureLinkedPosition);
        const canDeleteSignatureRequest =
          canDeleteSignatureRequests &&
          Boolean(item.requestId);
        const deleteActionLabel =
          normalizedStatus === 'completed' || normalizedStatus === 'signed' ? '서명 삭제' : '서명 요청 삭제';
        const activityText = item.signedAt
          ? `서명 ${formatDateTime(item.signedAt)}`
          : item.requestedAt
            ? `요청 ${formatDateTime(item.requestedAt)}`
            : '요청 전';
        const expiresText = item.expiresAt && !item.signedAt ? ` · 만료 ${formatDateTime(item.expiresAt)}` : '';

        return {
          key: `signature:${item.requestId || item.slotKey}`,
          label: signatureSlotLabel,
          statusLabel: getSignatureEvidenceStatusLabel(item.status),
          statusVariant: getSignatureEvidenceStatusVariant(item.status),
          summary: `${signatureSlotLabel} · ${item.signerName || '서명 대상 미지정'} · ${activityText}${expiresText}`,
          source: item.required ? '필수 서명' : '서명 요청',
          signatureSlotLabel,
          signatureSignerName,
          signatureSignerPhoneNumber: formatPhoneNumber(item.signerPhoneNumber),
          signatureRequestedAt: formatDateTime(item.requestedAt),
          signatureSignedAt: item.signedAt ? formatDateTime(item.signedAt) : '-',
          signatureExpiresAt: item.expiresAt ? formatDateTime(item.expiresAt) : '-',
          registerAction: {
            title: canRegisterSignature ? '서명 등록' : '서명 대기 상태에서만 등록할 수 있습니다.',
            ariaLabel: `${signatureSlotLabel} ${signatureSignerName} 서명 등록`,
            icon: <Check className="h-4 w-4" />,
            disabled: !canRegisterSignature,
            onClick: () => {
              if (!signatureLinkedPosition || !item.requestId) {
                return false;
              }

              setChecklistRegistrationTarget(
                buildChecklistTargetFromPosition({
                  id: `signature:${item.requestId}`,
                  kind: 'signature',
                  label: signatureSlotLabel,
                  linkedPosition: signatureLinkedPosition,
                  requestId: item.requestId,
                  signerName: signatureSignerName,
                })
              );
              setMessage(`"${signatureSlotLabel}" 위치를 선택해 ${signatureSignerName} 서명을 등록해 주세요.`);
            },
          },
          action: canDeleteSignatureRequest
            ? {
                title: deleteActionLabel,
                ariaLabel: `${signatureSlotLabel} ${signatureSignerName} ${deleteActionLabel}`,
                icon: <Trash2 className="h-4 w-4" />,
                disabled: deletingSignatureRequestId === item.requestId,
                onClick: () => {
                  void handleDeleteSignatureRequest(item.requestId || '', signatureSlotLabel, signatureSignerName, item.status);
                },
              }
            : undefined,
        };
      });
    },
    [
      canDeleteSignatureRequests,
      deletingSignatureRequestId,
      handleDeleteSignatureRequest,
      selectedDocumentDetail,
      selectedDocumentChecklistLinkedPositions,
      selectedDocumentSignatureBoxCount,
      selectedDocumentSignatureSlotByKey,
      selectedDocumentSignatureSlots,
    ]
  );

  const selectedDocumentPhotoRequirementRows = React.useMemo<ProjectListRow[]>(
    () => {
      if (!selectedDocumentDetail) {
        return [];
      }

      return selectedDocumentDetail.photoRequirements.map((item) => {
        const linkedPosition = resolvePhotoRequirementLinkedPosition(
          selectedDocumentDetail.document.id,
          item.tagName,
          item.tagKey
        );
        const linkedFiles = linkedPosition?.valueKey
          ? selectedDocumentDetail.valueFiles.filter((file) => file.valueKey === linkedPosition.valueKey)
          : [];
        const uploadedCount = Math.max(item.uploadedCount, linkedFiles.length);
        const missingCount = Math.max(item.requiredCount - uploadedCount, 0);
        const effectiveStatus =
          item.reviewPendingCount > 0
            ? 'review_needed'
            : uploadedCount >= item.requiredCount
              ? 'covered'
              : 'missing';

        return {
          key: `photo-requirement:${item.requirementId}`,
          label: item.tagName || item.tagKey,
          statusLabel: getPhotoRequirementStatusLabel(effectiveStatus),
          statusVariant: getPhotoRequirementStatusVariant(effectiveStatus),
          summary: `필수 ${item.requiredCount}건 · 등록 ${uploadedCount}건 · 검토 ${item.reviewPendingCount}건 · 누락 ${missingCount}건${
            linkedPosition ? ` · 문서 연결 위치 ${linkedPosition.label}` : ''
          }`,
          source: item.sourceScope === 'document_type' ? '문서별 필수 사진' : '현장 필수 사진',
          registerAction: {
            title: '필수 사진 등록',
            ariaLabel: `${item.tagName || item.tagKey} 필수 사진 등록`,
            icon: <Plus className="h-4 w-4" />,
            onClick: () => handleStartPhotoRequirementRegistration(item, linkedPosition),
          },
        };
      });
    },
    [photoRequirementLinksByKey, selectedDocumentDetail, selectedDocumentChecklistLinkedPositions]
  );

  const photoRequirementTagOptions = React.useMemo(
    () =>
      buildUniqueTagOptions(
        [
          ...(selectedDocumentDetail?.photoEvidence.requirements || []).map((item) => ({
            id: item.labelKey,
            label: item.labelName,
            meta: item.documentTypeKey ? '이 문서에서 사용 중' : '현장에서 사용 중',
            keywords: [item.labelKey, item.documentTypeKey || ''],
          })),
          ...(selectedDocumentDetail?.photoRequirements || []).map((item) => ({
            id: item.tagKey,
            label: item.tagName,
            meta: item.sourceScope === 'document_type' ? '이 문서에서 사용 중' : '현장에서 사용 중',
            keywords: [item.tagKey, item.sourceScope],
          })),
        ]
      ),
    [selectedDocumentDetail?.photoEvidence.requirements, selectedDocumentDetail?.photoRequirements]
  );

  const selectedDocumentFileRequirements = React.useMemo(() => {
    const targetDocumentId = selectedDocumentDetail?.document.id || selectedDocumentId.trim();

    if (!targetDocumentId) {
      return [];
    }

    return fileRequirementsByDocumentId[targetDocumentId] || [];
  }, [fileRequirementsByDocumentId, selectedDocumentDetail?.document.id, selectedDocumentId]);

  const fileRequirementTagOptions = React.useMemo(() => {
    const storedRequirements = Object.values(fileRequirementsByDocumentId).flat();
    const selectedFileNames = selectedDocumentDetail?.valueFiles.map((file) => file.originalFileName) || [];

    return buildUniqueTagOptions([
      ...storedRequirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.title,
        meta: '필수 파일 태그',
        keywords: [requirement.fileNameKeyword],
      })),
      ...selectedFileNames.map((fileName) => ({
        id: `file:${fileName}`,
        label: fileName.replace(/\.[^.]+$/, ''),
        meta: '등록된 파일명',
        keywords: [fileName],
      })),
    ]);
  }, [fileRequirementsByDocumentId, selectedDocumentDetail?.valueFiles]);

  const selectedDocumentFileRequirementRows = React.useMemo<ProjectListRow[]>(() => {
    if (!selectedDocumentDetail) {
      return [];
    }

    return selectedDocumentFileRequirements.map((requirement) => {
      const keyword = (requirement.fileNameKeyword || requirement.title).trim();
      const linkedValueKey = requirement.linkedPosition?.valueKey.trim() || '';
      const matchedFiles = selectedDocumentDetail.valueFiles.filter((file) => {
        if (linkedValueKey && file.valueKey === linkedValueKey) {
          return true;
        }

        if (!keyword) {
          return true;
        }

        return file.valueKey === keyword || file.originalFileName.includes(keyword);
      });
      const latestFile = [...matchedFiles].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0] || null;
      const isCovered = matchedFiles.length >= requirement.requiredCount;
      const fileNames = matchedFiles.map((file) => file.originalFileName).filter(Boolean).join(', ');

      return {
        key: `file-requirement:${requirement.id}`,
        label: requirement.title,
        statusLabel: isCovered ? '충족' : '누락',
        statusVariant: isCovered ? 'green' : 'red',
        summary: `필수 ${requirement.requiredCount}개 · 등록 ${matchedFiles.length}개${
          keyword ? ` · 파일 태그 ${keyword}` : ''
        }${requirement.linkedPosition ? ` · 문서 연결 위치 ${requirement.linkedPosition.label}` : ''}${
          fileNames ? ` · ${fileNames}` : ''
        }`,
        source: keyword ? `파일 태그 ${keyword}` : '파일 태그 없음',
        completedAtLabel: latestFile ? formatDateTime(latestFile.uploadedAt) : '-',
        registerAction: {
          title: '필수 파일 등록',
          ariaLabel: `${requirement.title} 필수 파일 등록`,
          icon: <Plus className="h-4 w-4" />,
          onClick: () => handleStartFileRequirementRegistration(requirement),
        },
        action: {
          title: '필수 파일 항목 삭제',
          ariaLabel: `${requirement.title} 필수 파일 항목 삭제`,
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => {
            setFileRequirementsByDocumentId((current) => ({
              ...current,
              [requirement.documentId]: (current[requirement.documentId] || []).filter(
                (item) => item.id !== requirement.id
              ),
            }));
          },
        },
      };
    });
  }, [selectedDocumentDetail, selectedDocumentFileRequirements]);

  const selectedDocumentValueRequirementRows = React.useMemo<ProjectListRow[]>(() => {
    if (!selectedDocumentDetail) {
      return [];
    }

    const valueEntryByKey = new Map(selectedDocumentDetail.valueEntries.map((entry) => [entry.valueKey, entry]));

    return selectedDocumentLabelEntries.map(([valueKey, value]) => {
      const valueEntry = valueEntryByKey.get(valueKey) || null;
      const displayValue = stringifyDocumentValue(value) || '-';

      return {
        key: `value-requirement:${valueKey}`,
        label: getDocumentFieldLabel(valueKey),
        statusLabel: displayValue !== '-' ? '충족' : '누락',
        statusVariant: displayValue !== '-' ? 'green' as const : 'red' as const,
        summary: displayValue !== '-' ? `현재 값: ${displayValue}` : '입력된 값이 없습니다.',
        source: '문서 입력 상자',
        completedAtLabel: valueEntry?.updatedAt
          ? formatDateTime(valueEntry.updatedAt)
          : selectedDocumentVersionSource?.createdAt
            ? formatDateTime(selectedDocumentVersionSource.createdAt)
            : '-',
        registerAction: {
          title: '입력 위치로 이동',
          ariaLabel: `${getDocumentFieldLabel(valueKey)} 입력 위치로 이동`,
          icon: <Check className="h-4 w-4" />,
          onClick: () => handleStartValueRequirementRegistration(valueKey),
        },
      };
    });
  }, [
    selectedDocumentDetail,
    selectedDocumentChecklistLinkedPositions,
    selectedDocumentLabelEntries,
    selectedDocumentVersionSource?.createdAt,
  ]);

  const selectedSignatureRequestMember = React.useMemo(
    () => siteMembers.find((membership) => membership.member.id === signatureRequestMemberId) || null,
    [signatureRequestMemberId, siteMembers]
  );

  const openSignatureRequestForm = React.useCallback(() => {
    const defaultSlotKey =
      selectedDocumentSignatureSlots[0]?.slotKey ||
      selectedDocumentDetail?.signatureEvidence[0]?.slotKey ||
      '서명';

    setSignatureRequestSlotKey((current) => current.trim() || defaultSlotKey);
    setShowSignatureRequestForm(true);
    setSignatureRequestFeedback(null);
    setMessage(null);
  }, [selectedDocumentDetail?.signatureEvidence, selectedDocumentSignatureSlots]);

  async function handleCreateSignatureRequest() {
    const targetDocumentId =
      selectedDocumentDetail?.document.id || selectedDocumentListItem?.document.id || selectedDocumentId.trim();
    const signerName = signatureRequestSignerName.trim();
    const phoneNumber = signatureRequestPhoneNumber.trim();
    const signatureSlotKey = normalizeSignatureSlotText(signatureRequestSlotKey);
    const documentContent = selectedDocumentMaterializedHtml.trim();

    setSignatureRequestFeedback({ variant: 'info', message: '서명 요청 입력값을 확인하는 중입니다.' });
    setMessage(null);

    if (!targetDocumentId) {
      setSignatureRequestFeedback({ variant: 'error', message: '서명 요청을 만들 문서를 먼저 선택해 주세요.' });
      return;
    }

    if (!documentContent) {
      setSignatureRequestFeedback({ variant: 'error', message: '서명 요청을 만들 문서 본문을 먼저 불러와 주세요.' });
      return;
    }

    if (!signerName) {
      setSignatureRequestFeedback({ variant: 'error', message: '서명할 사람의 이름을 입력해 주세요.' });
      return;
    }

    if (!phoneNumber) {
      setSignatureRequestFeedback({ variant: 'error', message: '서명할 사람의 휴대폰을 입력해 주세요.' });
      return;
    }

    if (!signatureSlotKey) {
      setSignatureRequestFeedback({ variant: 'error', message: '서명할 위치를 선택해 주세요.' });
      return;
    }

    const selectedSignatureSlot =
      selectedDocumentSignatureSlots.find((slot) => slot.slotKey === signatureSlotKey) || null;

    if (selectedDocumentSignatureSlots.length > 0 && !selectedSignatureSlot) {
      setSignatureRequestFeedback({ variant: 'error', message: '문서에 있는 서명 위치 중 하나를 선택해 주세요.' });
      return;
    }

    const activeSignatureRequestForSlot =
      selectedDocumentDetail?.signatureEvidence.find(
        (item) => {
          const itemSlot = resolveDocumentSignatureEvidenceSlot(
            item.slotKey,
            selectedDocumentSignatureSlots,
            selectedDocumentSignatureSlotByKey
          );

          return (
            (itemSlot?.slotKey || normalizeSignatureSlotText(item.slotKey)) === signatureSlotKey &&
            item.status !== 'expired' &&
            item.status !== 'failed'
          );
        }
      ) || null;

    if (activeSignatureRequestForSlot) {
      const activeSignerLabel =
        activeSignatureRequestForSlot.signerName ||
        formatPhoneNumber(activeSignatureRequestForSlot.signerPhoneNumber) ||
        '등록된 서명자';

      setSignatureRequestFeedback({
        variant: 'error',
        message: `"${selectedSignatureSlot?.label || signatureSlotKey}" 서명 위치는 이미 ${activeSignerLabel}에게 배정되어 있습니다.`,
      });
      return;
    }

    const normalizedPhoneDigits = phoneNumber.replace(/[^0-9]/g, '');

    setCreatingSignatureRequest(true);
    setSignatureRequestFeedback({ variant: 'info', message: '서명 권한을 등록하고 요청을 만드는 중입니다.' });

    try {
      const memberResponse = await fetch('/api/member-access/document-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: targetDocumentId,
          phoneNumber,
          displayName: signerName,
          accessRole: 'signer',
        }),
      });
      const memberResult = await memberResponse.json();

      if (!memberResponse.ok || !memberResult?.success) {
        throw new Error(memberResult?.message || '서명 권한 등록에 실패했습니다.');
      }

      const signResponse = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST',
          documentId: targetDocumentId,
          signatureSlotKey,
          documentContent,
          signerInfo: {
            name: signerName,
            phoneNumber,
            email: `${normalizedPhoneDigits || 'signer'}@phone.local`,
          },
        }),
      });
      const signResult = await signResponse.json();

      if (!signResponse.ok || !signResult?.success) {
        throw new Error(signResult?.message || '서명 요청 생성에 실패했습니다.');
      }

      await loadSelectedDocumentDetail(targetDocumentId);
      await loadSiteDocumentMembers(documents).catch(() => []);

      setShowSignatureRequestForm(false);
      setSignatureRequestMemberId('');
      setSignatureRequestSignerName('');
      setSignatureRequestPhoneNumber('');
      setSignatureRequestSlotKey('');
      setSignatureRequestFeedback({
        variant: 'success',
        message: `"${signerName}"에게 "${selectedSignatureSlot?.label || signatureSlotKey}" 서명 요청을 만들었습니다.`,
      });
      setMessage(`"${signerName}"에게 "${selectedSignatureSlot?.label || signatureSlotKey}" 서명 요청을 만들었습니다.`);
    } catch (error) {
      setSignatureRequestFeedback({
        variant: 'error',
        message: error instanceof Error ? error.message : '서명 요청 생성에 실패했습니다.',
      });
    } finally {
      setCreatingSignatureRequest(false);
    }
  }

  const openPhotoRequirementForm = React.useCallback(() => {
    setShowPhotoRequirementForm(true);
    setPhotoRequirementFeedback(null);
    setMessage(null);

    if (!photoRequirementCount.trim()) {
      setPhotoRequirementCount('1');
    }
  }, [photoRequirementCount]);

  async function handleCreatePhotoRequirement() {
    const targetSiteId = selectedDocumentDetail?.document.siteId || selectedSiteId.trim();
    const targetDocumentId = selectedDocumentDetail?.document.id || selectedDocumentId.trim();
    const targetDocumentTypeKey = selectedDocumentDetail?.document.documentTypeKey || '';
    const tagName = photoRequirementTagName.trim();
    const minimumPhotoCount = normalizeRequiredPhotoCount(photoRequirementCount);
    const linkedPosition = getSelectedLinkedPosition(photoRequirementLinkedPositionKey);

    setPhotoRequirementFeedback({ variant: 'info', message: '필수 사진 항목을 확인하는 중입니다.' });
    setMessage(null);

    if (!targetSiteId) {
      setPhotoRequirementFeedback({ variant: 'error', message: '필수 사진을 추가할 현장을 먼저 선택해 주세요.' });
      return;
    }

    if (!targetDocumentTypeKey) {
      setPhotoRequirementFeedback({ variant: 'error', message: '필수 사진을 연결할 문서 유형을 확인하지 못했습니다.' });
      return;
    }

    if (!tagName) {
      setPhotoRequirementFeedback({ variant: 'error', message: '사진 태그 이름을 입력해 주세요.' });
      return;
    }

    if (photoRequirementLinkedPositionKey.trim() && !linkedPosition) {
      setPhotoRequirementFeedback({ variant: 'error', message: '문서 연결 위치를 다시 선택해 주세요.' });
      return;
    }

    setSavingPhotoRequirement(true);
    setPhotoRequirementFeedback({ variant: 'info', message: '필수 사진 항목을 저장하는 중입니다.' });

    try {
      const gapSummary = await fetchSuccessData<SitePhotoLabelGapSummaryDto>(
        `/api/sites/${encodeURIComponent(targetSiteId)}/photo-label-gaps`
      );
      const existingRequirements = (gapSummary.requirements || []).map((item) => ({
        labelKey: item.labelKey,
        labelName: item.labelName,
        description: item.description,
        documentTypeKey: item.documentTypeKey,
        minimumPhotoCount: item.minimumPhotoCount,
      }));
      const nextRequirements = [
        ...existingRequirements.filter(
          (item) => `${item.labelName}::${item.documentTypeKey || ''}` !== `${tagName}::${targetDocumentTypeKey}`
        ),
        {
          labelName: tagName,
          description: null,
          documentTypeKey: targetDocumentTypeKey,
          minimumPhotoCount,
        },
      ];
      const response = await fetch('/api/photos/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: targetSiteId,
          requirements: nextRequirements,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '필수 사진 항목 저장에 실패했습니다.');
      }

      if (targetDocumentId && linkedPosition) {
        setPhotoRequirementLinksByKey((current) => ({
          ...current,
          [buildPhotoRequirementLinkKey(targetDocumentId, tagName)]: linkedPosition,
        }));
      }

      await loadSelectedDocumentDetail(selectedDocumentDetail.document.id);
      setDashboardRefreshKey((current) => current + 1);
      setShowPhotoRequirementForm(false);
      setPhotoRequirementTagName('');
      setPhotoRequirementCount('1');
      setPhotoRequirementLinkedPositionKey('');
      setPhotoRequirementFeedback({ variant: 'success', message: `"${tagName}" 필수 사진 항목을 추가했습니다.` });
      setMessage(`"${tagName}" 필수 사진 항목을 추가했습니다.`);
    } catch (error) {
      setPhotoRequirementFeedback({
        variant: 'error',
        message: error instanceof Error ? error.message : '필수 사진 항목 저장에 실패했습니다.',
      });
    } finally {
      setSavingPhotoRequirement(false);
    }
  }

  const openFileRequirementForm = React.useCallback(() => {
    setShowFileRequirementForm(true);
    setFileRequirementFeedback(null);
    setMessage(null);

    if (!fileRequirementCount.trim()) {
      setFileRequirementCount('1');
    }
  }, [fileRequirementCount]);

  function handleCreateFileRequirement() {
    const targetDocumentId = selectedDocumentDetail?.document.id || selectedDocumentId.trim();
    const title = fileRequirementTitle.trim();
    const requiredCount = normalizeRequiredFileCount(fileRequirementCount);
    const linkedPosition = getSelectedLinkedPosition(fileRequirementLinkedPositionKey);

    setFileRequirementFeedback({ variant: 'info', message: '필수 파일 항목을 확인하는 중입니다.' });
    setMessage(null);

    if (!targetDocumentId) {
      setFileRequirementFeedback({ variant: 'error', message: '필수 파일을 추가할 문서를 먼저 선택해 주세요.' });
      return;
    }

    if (!title) {
      setFileRequirementFeedback({ variant: 'error', message: '파일 태그 이름을 입력해 주세요.' });
      return;
    }

    if (fileRequirementLinkedPositionKey.trim() && !linkedPosition) {
      setFileRequirementFeedback({ variant: 'error', message: '문서 연결 위치를 다시 선택해 주세요.' });
      return;
    }

    const requirement: DocumentFileRequirement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      documentId: targetDocumentId,
      title,
      fileNameKeyword: title,
      requiredCount,
      createdAt: new Date().toISOString(),
      linkedPosition,
    };

    setFileRequirementsByDocumentId((current) => ({
      ...current,
      [targetDocumentId]: [...(current[targetDocumentId] || []), requirement],
    }));
    setShowFileRequirementForm(false);
    setFileRequirementTitle('');
    setFileRequirementCount('1');
    setFileRequirementLinkedPositionKey('');
    setFileRequirementFeedback({ variant: 'success', message: `"${title}" 필수 파일 항목을 추가했습니다.` });
    setMessage(`"${title}" 필수 파일 항목을 추가했습니다.`);
  }

  const selectedPhotoDetailRows = React.useMemo<ProjectListRow[]>(
    () =>
      selectedPhoto
        ? [
            {
              key: 'photo-title',
              label: '사진 제목',
              statusLabel: '정상',
              statusVariant: 'green',
              summary: selectedPhoto.photo.photoTitle || '제목 없는 사진',
              source: '사진 기본 정보',
            },
            {
              key: 'photo-description',
              label: '설명',
              statusLabel: selectedPhoto.photo.description ? '정상' : '값 없음',
              statusVariant: selectedPhoto.photo.description ? 'green' : 'amber',
              summary: selectedPhoto.photo.description || '설명이 없습니다.',
              source: '사진 기본 정보',
            },
            {
              key: 'photo-captured-at',
              label: '촬영 시각',
              statusLabel: selectedPhoto.photo.capturedAt ? '정상' : '값 없음',
              statusVariant: selectedPhoto.photo.capturedAt ? 'green' : 'amber',
              summary: formatDateTime(selectedPhoto.photo.capturedAt),
              source: '사진 기본 정보',
            },
            {
              key: 'photo-location',
              label: '촬영 위치',
              statusLabel: selectedPhoto.photo.capturedLocationText ? '정상' : '값 없음',
              statusVariant: selectedPhoto.photo.capturedLocationText ? 'green' : 'amber',
              summary: selectedPhoto.photo.capturedLocationText || '위치 정보 없음',
              source: '사진 기본 정보',
            },
            {
              key: 'photo-status',
              label: '사진 상태',
              statusLabel: getPhotoStatusLabel(selectedPhoto.photo.status),
              statusVariant: getPhotoStatusVariant(selectedPhoto.photo.status),
              summary: `직접 연결 ${selectedPhoto.manualLabels.length}건 · 추천 ${selectedPhoto.suggestedLabels.length}건`,
              source: '사진 분류 상태',
            },
            {
              key: 'photo-signature',
              label: '전자 서명',
              statusLabel: '값 없음',
              statusVariant: 'amber',
              summary: '연결된 전자 서명이 없습니다.',
              source: '서명 미연결',
            },
            {
              key: 'photo-labels',
              label: '연결 라벨',
              statusLabel:
                selectedPhoto.manualLabels.length > 0 || selectedPhoto.suggestedLabels.length > 0 ? '정상' : '값 없음',
              statusVariant:
                selectedPhoto.manualLabels.length > 0 || selectedPhoto.suggestedLabels.length > 0 ? 'green' : 'amber',
              summary:
                [
                  ...selectedPhoto.manualLabels.map((label) => `직접 연결:${label.labelKey}`),
                  ...selectedPhoto.suggestedLabels.map((label) => `추천:${label.labelKey}`),
                ].join(' · ') || '연결된 라벨이 없습니다.',
              source: '사진 증빙 연결',
            },
          ]
        : [],
    [selectedPhoto]
  );

  const loadRootData = React.useCallback(async () => {
    setLoadingRoot(true);
    setRootDataLoaded(false);

    try {
      const [siteResult, templateResult] = await Promise.all([
        fetchSuccessData<SiteListResult>('/api/sites'),
        fetchSuccessData<TemplateRecordDto[]>('/api/templates?limit=200'),
      ]);

      setSites(siteResult.sites);
      setTemplates(Array.isArray(templateResult) ? templateResult : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현장 목록 또는 문서 양식 목록을 불러오지 못했습니다.');
      setSites([]);
      setTemplates([]);
    } finally {
      setRootDataLoaded(true);
      setLoadingRoot(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRootData();
  }, [loadRootData]);

  React.useEffect(() => {
    if (!rootDataLoaded) {
      return;
    }

    setSelectedSiteId((current) => {
      if (current && sites.some((site) => site.id === current)) {
        return current;
      }

      if (requestedSiteId && sites.some((site) => site.id === requestedSiteId)) {
        return requestedSiteId;
      }

      return '';
    });
  }, [requestedSiteId, rootDataLoaded, sites]);

  React.useEffect(() => {
    if (!rootDataLoaded) {
      return;
    }

    setSelectedSiteIds((current) => {
      const validSiteIds = current.filter((siteId) => sites.some((site) => site.id === siteId));

      if (validSiteIds.length > 0) {
        return validSiteIds;
      }

      if (requestedSiteId && sites.some((site) => site.id === requestedSiteId)) {
        return [requestedSiteId];
      }

      return [];
    });
  }, [requestedSiteId, rootDataLoaded, sites]);

  React.useEffect(() => {
    setDeleteImpact(null);
  }, [selectedSiteId]);

  React.useEffect(() => {
    if (showCreateSiteForm) {
      setShowAddSiteDocumentForm(false);
      setSiteDocumentTemplateIds([]);
    }
  }, [showCreateSiteForm]);

  React.useEffect(() => {
    setShowAddSiteDocumentForm(false);
    setSiteDocumentTemplateIds([]);
  }, [selectedSiteId]);

  React.useEffect(() => {
    if (!selectedSiteId) {
      setDocuments([]);
      setDocumentsLoadedSiteId('');
      setPhotos([]);
      setSelectedDocumentDetail(null);
      return;
    }

    let active = true;
    setSelectedDocumentDetail(null);
    setDocumentsLoadedSiteId('');

    const loadSiteData = async () => {
      setLoadingSiteData(true);

      try {
        const [nextDocuments, nextPhotos] = await Promise.allSettled([
          fetchSuccessData<DocumentListItem[]>(`/api/documents?siteId=${encodeURIComponent(selectedSiteId)}`),
          fetchSuccessData<PhotoListItemDto[]>(`/api/photos?siteId=${encodeURIComponent(selectedSiteId)}`),
        ]);

        if (!active) return;

        setDocuments(nextDocuments.status === 'fulfilled' ? nextDocuments.value : []);
        setDocumentsLoadedSiteId(selectedSiteId);
        setPhotos(nextPhotos.status === 'fulfilled' ? nextPhotos.value : []);

        if (nextDocuments.status === 'rejected' || nextPhotos.status === 'rejected') {
          setMessage('일부 현장 정보를 불러오지 못했습니다. 문서와 사진 연결 상태를 확인해 주세요.');
        }
      } finally {
        if (active) {
          setLoadingSiteData(false);
        }
      }
    };

    void loadSiteData();

    return () => {
      active = false;
    };
  }, [selectedSiteId]);

  React.useEffect(() => {
    if (!rootDataLoaded || sites.length === 0) {
      setDashboardSummaries([]);
      setLoadingDashboardSummaries(false);
      return;
    }

    let active = true;
    setLoadingDashboardSummaries(true);

    const loadDashboardSummaries = async () => {
      const summaries = await Promise.all(
        sites.map(async (site) => {
          const encodedSiteId = encodeURIComponent(site.id);
          const [documentResult, photoResult, checklistResult] = await Promise.allSettled([
            fetchSuccessData<DocumentListItem[]>(`/api/documents?siteId=${encodedSiteId}`),
            fetchSuccessData<PhotoListItemDto[]>(`/api/photos?siteId=${encodedSiteId}`),
            fetchSuccessData<SiteChecklistSummaryDto>(`/api/sites/${encodedSiteId}/checklist`),
          ]);

          return {
            site,
            documents: documentResult.status === 'fulfilled' ? documentResult.value : [],
            photos: photoResult.status === 'fulfilled' ? photoResult.value : [],
            checklist: checklistResult.status === 'fulfilled' ? checklistResult.value : null,
            hasError:
              documentResult.status === 'rejected' ||
              photoResult.status === 'rejected' ||
              checklistResult.status === 'rejected',
          };
        })
      );

      if (active) {
        setDashboardSummaries(summaries);
        setLoadingDashboardSummaries(false);
      }
    };

    void loadDashboardSummaries().catch(() => {
      if (active) {
        setDashboardSummaries([]);
        setLoadingDashboardSummaries(false);
      }
    });

    return () => {
      active = false;
    };
  }, [dashboardRefreshKey, rootDataLoaded, sites]);

  React.useEffect(() => {
    if (documentsLoadedSiteId !== selectedSiteId) {
      return;
    }

    setSelectedDocumentId((current) => {
      if (current && documents.some((item) => item.document.id === current)) {
        return current;
      }

      return '';
    });
  }, [documents, documentsLoadedSiteId, selectedSiteId]);

  React.useEffect(() => {
    setSelectedPhotoId((current) => {
      if (current && photos.some((item) => item.photo.id === current)) {
        return current;
      }

      return '';
    });
  }, [photos]);

  React.useEffect(() => {
    setShowAddSiteMemberForm(false);
    setSiteMemberPhoneNumber('');
    setSiteMemberDisplayName('');
    setSiteMemberRole('participant');
    setSiteMemberDocumentIds([]);
    setSiteMemberDocumentScopeKeys([]);
    setExpandedSiteMemberId('');
  }, [selectedSiteId]);

  const handleRefresh = () => {
    void loadRootData();
  };

  const handleChangeSelectedSites = React.useCallback(
    (nextSiteIds: string[]) => {
      if (nextSiteIds.length === 0) {
        setSelectedSiteIds([]);
        setSelectedSiteId('');
        setSelectedDocumentId('');
        return;
      }

      const addedSiteId = nextSiteIds.find((siteId) => !selectedSiteIds.includes(siteId)) || '';
      const nextActiveSiteId =
        addedSiteId ||
        (selectedSiteId && nextSiteIds.includes(selectedSiteId) ? selectedSiteId : nextSiteIds[0]) ||
        '';

      setSelectedSiteIds(nextSiteIds);

      if (nextActiveSiteId && nextActiveSiteId !== selectedSiteId) {
        setSelectedSiteId(nextActiveSiteId);
      }
    },
    [selectedSiteId, selectedSiteIds]
  );

  const loadSiteMembers = React.useCallback(async (siteId: string) => {
    const normalizedSiteId = siteId.trim();

    if (!normalizedSiteId) {
      setSiteMembers([]);
      return [];
    }

    const members = await fetchSuccessData<SiteMemberRecordDto[]>(
      `/api/member-access/site-members?siteId=${encodeURIComponent(normalizedSiteId)}`
    );
    const nextMembers = Array.isArray(members) ? members : [];
    setSiteMembers(nextMembers);
    return nextMembers;
  }, []);

  const loadSiteDocumentMembers = React.useCallback(async (siteDocuments: DocumentListItem[]) => {
    if (siteDocuments.length === 0) {
      setSiteDocumentMembers([]);
      return [];
    }

    const results = await Promise.allSettled(
      siteDocuments.map((item) =>
        fetchSuccessData<DocumentMemberRecordDto[]>(
          `/api/member-access/document-members?documentId=${encodeURIComponent(item.document.id)}`
        )
      )
    );
    const nextMembers = results.flatMap((result) =>
      result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
    );

    setSiteDocumentMembers(nextMembers);
    return nextMembers;
  }, []);

  const loadTemplateScopeContexts = React.useCallback(async (siteId: string, siteDocuments: DocumentListItem[]) => {
    const normalizedSiteId = siteId.trim();
    const templateIds = Array.from(
      new Set(siteDocuments.map((item) => item.document.templateId?.trim() || '').filter(Boolean))
    );

    if (!normalizedSiteId || templateIds.length <= 0) {
      setTemplateScopeContextsByTemplateId({});
      return {};
    }

    setLoadingTemplateScopeContexts(true);

    try {
      const results = await Promise.allSettled(
        templateIds.map(async (templateId) => {
          const response = await fetch(
            `/api/scopes/template-scopes?templateId=${encodeURIComponent(templateId)}&siteId=${encodeURIComponent(normalizedSiteId)}`,
            { cache: 'no-store' }
          );
          const payload = await response.json();

          if (!response.ok || !payload?.success || !payload?.data) {
            throw new Error(payload?.message || 'scope 조회에 실패했습니다.');
          }

          return [templateId, payload.data as TemplateScopeContextDto] as const;
        })
      );
      const nextContexts = results.reduce<Record<string, TemplateScopeContextDto>>((accumulator, result) => {
        if (result.status === 'fulfilled') {
          accumulator[result.value[0]] = result.value[1];
        }

        return accumulator;
      }, {});

      setTemplateScopeContextsByTemplateId(nextContexts);
      return nextContexts;
    } finally {
      setLoadingTemplateScopeContexts(false);
    }
  }, []);

  const syncSiteDocuments = React.useCallback(async (siteId: string) => {
    const nextDocuments = await fetchSuccessData<DocumentListItem[]>(
      `/api/documents?siteId=${encodeURIComponent(siteId)}`
    );
    setDocuments(Array.isArray(nextDocuments) ? nextDocuments : []);
    setDocumentsLoadedSiteId(siteId);
    setDashboardRefreshKey((current) => current + 1);
  }, []);

  const reloadSelectedSiteMembers = React.useCallback(async () => {
    const normalizedSiteId = selectedSiteId.trim();

    if (!normalizedSiteId) {
      return;
    }

    await Promise.all([
      loadSiteMembers(normalizedSiteId),
      loadSiteDocumentMembers(documents),
    ]);
  }, [documents, loadSiteDocumentMembers, loadSiteMembers, selectedSiteId]);

  React.useEffect(() => {
    if (!selectedSiteId) {
      setSiteMembers([]);
      setTemplateScopeContextsByTemplateId({});
      return;
    }

    let active = true;
    setLoadingSiteMembers(true);

    void loadSiteMembers(selectedSiteId)
      .catch((error) => {
        if (active) {
          setSiteMembers([]);
          setMessage(getMemberAccessErrorMessage(error, '현장 구성원 목록을 불러오지 못했습니다.'));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingSiteMembers(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadSiteMembers, selectedSiteId]);

  React.useEffect(() => {
    if (!selectedSiteId || documentsLoadedSiteId !== selectedSiteId) {
      return;
    }

    void loadTemplateScopeContexts(selectedSiteId, documents);
  }, [documents, documentsLoadedSiteId, loadTemplateScopeContexts, selectedSiteId]);

  React.useEffect(() => {
    if (!selectedSiteId || documentsLoadedSiteId !== selectedSiteId) {
      setSiteDocumentMembers([]);
      setLoadingSiteDocumentMembers(false);
      return;
    }

    let active = true;
    setLoadingSiteDocumentMembers(true);

    void loadSiteDocumentMembers(documents)
      .catch((error) => {
        if (active) {
          setSiteDocumentMembers([]);
          setMessage(getMemberAccessErrorMessage(error, '구성원별 문서 scope를 불러오지 못했습니다.'));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingSiteDocumentMembers(false);
        }
      });

    return () => {
      active = false;
    };
  }, [documents, documentsLoadedSiteId, loadSiteDocumentMembers, selectedSiteId]);

  const clearSelectedDocumentContext = React.useCallback(() => {
    setSelectedDocumentId('');
    setSelectedDocumentDetail(null);
    setSelectedDocumentDetailError(null);
    setSelectedDocumentDetailErrorDebug(null);
    setExpandedDocumentStatusDocumentId('');
    setLoadingDocumentDetail(false);
    setSelectedPhotoId('');
  }, []);

  const loadSelectedDocumentDetail = React.useCallback(async (documentId: string) => {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      setSelectedDocumentDetail(null);
      setSelectedDocumentDetailError(null);
      setSelectedDocumentDetailErrorDebug(null);
      return null;
    }

    const detail = await fetchSuccessDataWithTimeout<DocumentDetailResult>(`/api/documents/${normalizedDocumentId}`);
    setSelectedDocumentDetail(detail);
    setSelectedDocumentDetailError(null);
    setSelectedDocumentDetailErrorDebug(null);
    return detail;
  }, []);

  const handleSelectDocument = React.useCallback(
    (documentId: string) => {
      const normalizedDocumentId = documentId.trim();

      if (!normalizedDocumentId) {
        return;
      }

      if (normalizedDocumentId === selectedDocumentId) {
        if (selectedDocumentDetail || loadingDocumentDetail) {
          return;
        }

        setLoadingDocumentDetail(true);
        void loadSelectedDocumentDetail(normalizedDocumentId)
          .catch((error) => {
            setSelectedDocumentDetail(null);
            setSelectedDocumentDetailError(
              error instanceof Error ? error.message : '문서 추가 정보를 불러오지 못했습니다.'
            );
            setSelectedDocumentDetailErrorDebug(error instanceof ApiFetchError ? error.debug : null);
          })
          .finally(() => {
            setLoadingDocumentDetail(false);
          });
        return;
      }

      setSelectedPhotoId('');
      setSelectedDocumentId(normalizedDocumentId);
      setSelectedDocumentDetail(null);
      setSelectedDocumentDetailError(null);
      setSelectedDocumentDetailErrorDebug(null);
      setMessage((current) => (current?.includes('편집은 계속할 수 있습니다.') ? null : current));
      setLoadingDocumentDetail(true);
    },
    [loadSelectedDocumentDetail, loadingDocumentDetail, selectedDocumentDetail, selectedDocumentId]
  );

  const handleSelectPhoto = React.useCallback((photoId: string) => {
    const normalizedPhotoId = photoId.trim();

    if (!normalizedPhotoId) {
      return;
    }

    setSelectedPhotoId(normalizedPhotoId);
  }, []);

  const handleDeleteDocument = React.useCallback(
    async (documentId: string) => {
      const normalizedDocumentId = documentId.trim();

      if (!normalizedDocumentId || deletingDocument) {
        return;
      }

      const documentTitle =
        documents.find((item) => item.document.id === normalizedDocumentId)?.document.title ||
        (selectedDocumentDetail?.document.id === normalizedDocumentId ? selectedDocumentDetail.document.title : '') ||
        '현장 문서';
      const confirmed = window.confirm(
        `"${documentTitle}" 문서를 삭제하시겠습니까?\n연결된 첨부 파일, 출력본, 요청 링크, 전자서명 연결도 함께 정리될 수 있습니다.`
      );

      if (!confirmed) {
        return;
      }

      setDeletingDocument(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/documents/${normalizedDocumentId}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || '현장 문서 삭제에 실패했습니다.');
        }

        const deletedDocument = result.data as DocumentDeleteResult;

        setDocuments((previous) => previous.filter((item) => item.document.id !== normalizedDocumentId));

        if (selectedDocumentId === normalizedDocumentId) {
          clearSelectedDocumentContext();
        }

        if (selectedSiteId) {
          try {
            await syncSiteDocuments(selectedSiteId);
          } catch {
            // The delete already succeeded. A later refresh can resync if needed.
          }
        }

        setMessage(`"${deletedDocument.document.title}" 문서를 삭제했습니다.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '현장 문서 삭제에 실패했습니다.');
      } finally {
        setDeletingDocument(false);
      }
    },
    [clearSelectedDocumentContext, deletingDocument, documents, selectedDocumentDetail, selectedDocumentId, selectedSiteId, syncSiteDocuments]
  );

  const setDocumentLinkButtonFeedback = React.useCallback((linkKey: string, state: 'idle' | 'completed') => {
    document
      .querySelectorAll<HTMLButtonElement>('[data-member-access-link-key]')
      .forEach((button) => {
        if (button.getAttribute('data-member-access-link-key') === linkKey) {
          button.setAttribute('data-copy-feedback-state', state);
        }
      });
  }, []);

  const showDocumentLinkCopiedFeedback = React.useCallback(
    (linkKey: string) => {
      if (documentLinkButtonTimersRef.current[linkKey]) {
        clearTimeout(documentLinkButtonTimersRef.current[linkKey]);
      }

      setDocumentLinkButtonFeedback(linkKey, 'completed');
      documentLinkButtonTimersRef.current[linkKey] = setTimeout(() => {
        setDocumentLinkButtonFeedback(linkKey, 'idle');
        delete documentLinkButtonTimersRef.current[linkKey];
      }, 3000);
    },
    [setDocumentLinkButtonFeedback]
  );

  const handleCopyDocumentLink = React.useCallback(
    async (documentId: string, documentTitle: string, phoneNumber?: string | null) => {
      const normalizedDocumentId = documentId.trim();
      const linkKey = `${normalizedDocumentId}:member-access`;

      if (!normalizedDocumentId || copyingDocumentLinkKey) {
        return false;
      }

      setCopyingDocumentLinkKey(linkKey);
      if (copiedDocumentLinkTimerRef.current) {
        clearTimeout(copiedDocumentLinkTimerRef.current);
      }

      setCopiedDocumentLinkKey(linkKey);
      copiedDocumentLinkTimerRef.current = setTimeout(() => {
        setCopiedDocumentLinkKey((current) => (current === linkKey ? '' : current));
        copiedDocumentLinkTimerRef.current = null;
      }, 3000);
      setMessage(null);

      try {
        await copyTextToClipboard(buildMemberAccessDocumentLinkUrl(normalizedDocumentId, phoneNumber));
        showDocumentLinkCopiedFeedback(linkKey);
        setMessage(`"${documentTitle || '현장 문서'}" 문서 접근 링크를 복사했습니다.`);
        return true;
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : '문서 접근 링크를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.'
        );
        setCopiedDocumentLinkKey((current) => (current === linkKey ? '' : current));
        setDocumentLinkButtonFeedback(linkKey, 'idle');
        return false;
      } finally {
        setCopyingDocumentLinkKey('');
      }
    },
    [copyingDocumentLinkKey, setDocumentLinkButtonFeedback, showDocumentLinkCopiedFeedback]
  );

  const handleInviteSiteMember = React.useCallback(async () => {
    const normalizedSiteId = selectedSiteId.trim();
    const phoneNumber = siteMemberPhoneNumber.trim();
    const displayName = siteMemberDisplayName.trim() || null;
    const documentScopeKeysToInvite = siteMemberRole === 'participant' ? siteMemberDocumentScopeKeys : [];

    if (!normalizedSiteId) {
      setMessage('구성원을 초대할 현장을 먼저 선택해 주세요.');
      return;
    }

    if (!phoneNumber) {
      setMessage('초대할 휴대폰을 입력해 주세요.');
      return;
    }

    setInvitingSiteMember(true);
    setMessage(null);

    try {
      const response = await fetch('/api/member-access/site-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: normalizedSiteId,
          phoneNumber,
          displayName,
          accessRole: siteMemberRole,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '현장 구성원 초대에 실패했습니다.');
      }

      const invitedMember = result.data as SiteMemberInviteResult;
      const scopeAssignmentsByTemplateId = documentScopeKeysToInvite.reduce<Record<string, string[]>>((accumulator, compositeKey) => {
        const [templateId, scopeKey] = compositeKey.split('::');

        if (templateId?.trim() && scopeKey?.trim()) {
          accumulator[templateId] = Array.from(new Set([...(accumulator[templateId] || []), scopeKey]));
        }

        return accumulator;
      }, {});
      const scopePermissionResults = await Promise.allSettled(
        Object.entries(scopeAssignmentsByTemplateId).map(async ([templateId, scopeKeys]) => {
          const context = templateScopeContextsByTemplateId[templateId];

          if (!context) {
            throw new Error('선택한 문서의 scope 정보를 불러오지 못했습니다.');
          }

          const nextAssignmentsByScopeKey = { ...context.assignmentsByScopeKey };
          scopeKeys.forEach((scopeKey) => {
            nextAssignmentsByScopeKey[scopeKey] = Array.from(
              new Set([...(nextAssignmentsByScopeKey[scopeKey] || []), invitedMember.membership.member.id])
            );
          });

          const scopeResponse = await fetch('/api/scopes/template-scopes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId,
              siteId: normalizedSiteId,
              scopes: buildTemplateScopeSaveScopesFromContext(context, nextAssignmentsByScopeKey),
            }),
          });
          const scopeResult = await scopeResponse.json();

          if (!scopeResponse.ok || !scopeResult?.success || !scopeResult?.data) {
            throw new Error(scopeResult?.message || '문서 scope 등록에 실패했습니다.');
          }

          setTemplateScopeContextsByTemplateId((previous) => ({
            ...previous,
            [templateId]: scopeResult.data as TemplateScopeContextDto,
          }));
        })
      );
      const failedScopePermission = scopePermissionResults.find((permissionResult) => permissionResult.status === 'rejected');

      await Promise.all([
        loadSiteMembers(normalizedSiteId),
        loadSiteDocumentMembers(documents),
      ]);

      if (failedScopePermission?.status === 'rejected') {
        throw failedScopePermission.reason;
      }

      setShowAddSiteMemberForm(false);
      setSiteMemberPhoneNumber('');
      setSiteMemberDisplayName('');
      setSiteMemberRole('participant');
      setSiteMemberDocumentIds([]);
      setSiteMemberDocumentScopeKeys([]);

      const documentCountMessage =
        documentScopeKeysToInvite.length > 0 ? ` 문서 scope ${documentScopeKeysToInvite.length}건도 함께 등록했습니다.` : '';
      setMessage(
        `${formatPhoneNumber(invitedMember.membership.member.phoneNumber)} 연락처에 현장 접근 권한을 등록했습니다.${documentCountMessage} ${formatMemberDispatchMessage(invitedMember.dispatch)}`
      );
    } catch (error) {
      setMessage(getMemberAccessErrorMessage(error, '현장 구성원 초대에 실패했습니다.'));
    } finally {
      setInvitingSiteMember(false);
    }
  }, [
    loadSiteMembers,
    selectedSiteId,
    siteMemberDisplayName,
    siteMemberDocumentScopeKeys,
    siteMemberPhoneNumber,
    siteMemberRole,
    documents,
    loadSiteDocumentMembers,
    templateScopeContextsByTemplateId,
  ]);

  const handleUpdateSiteMemberRole = React.useCallback(
    async (membership: SiteMemberRecordDto, nextRole: ManagedSiteMemberAccessRole) => {
      const normalizedSiteId = selectedSiteId.trim();
      const currentRole = getManagedSiteMemberRole(membership.accessRole);

      if (!normalizedSiteId || nextRole === currentRole || updatingSiteMemberId) {
        return;
      }

      setUpdatingSiteMemberId(membership.membershipId);
      setMessage(null);

      try {
        const response = await fetch('/api/member-access/site-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId: normalizedSiteId,
            phoneNumber: membership.member.phoneNumber,
            displayName: membership.member.displayName,
            accessRole: nextRole,
          }),
        });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || '현장 권한 변경에 실패했습니다.');
        }

        await loadSiteMembers(normalizedSiteId);
        setMessage(`"${membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber)}"의 현장 권한을 변경했습니다.`);
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '현장 권한 변경에 실패했습니다.'));
      } finally {
        setUpdatingSiteMemberId('');
      }
    },
    [loadSiteMembers, selectedSiteId, updatingSiteMemberId]
  );

  const handleSaveMemberDocumentScopeAccess = React.useCallback(
    async (
      membership: SiteMemberRecordDto,
      documentId: string,
      templateId: string,
      scopeKey: string,
      operationKey: string
    ) => {
      if (hasFullDocumentAccessBySiteRole(membership.accessRole)) {
        setMessage('관리자는 모든 scope 권한을 가지고 있습니다.');
        return;
      }

      const normalizedSiteId = selectedSiteId.trim();
      const normalizedTemplateId = templateId.trim();
      const normalizedScopeKey = scopeKey.trim();
      const context = templateScopeContextsByTemplateId[normalizedTemplateId];

      if (!normalizedSiteId || !normalizedTemplateId || !normalizedScopeKey || !context || savingMemberDocumentAccessKey) {
        return;
      }

      setSavingMemberDocumentAccessKey(operationKey);
      setMessage(null);

      try {
        const currentMemberIds = context.assignmentsByScopeKey[normalizedScopeKey] || [];
        const nextMemberIds = currentMemberIds.includes(membership.member.id)
          ? currentMemberIds.filter((memberId) => memberId !== membership.member.id)
          : [...currentMemberIds, membership.member.id];
        const nextAssignmentsByScopeKey = {
          ...context.assignmentsByScopeKey,
          [normalizedScopeKey]: Array.from(new Set(nextMemberIds)),
        };
        const response = await fetch('/api/scopes/template-scopes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: normalizedTemplateId,
            siteId: normalizedSiteId,
            scopes: buildTemplateScopeSaveScopesFromContext(context, nextAssignmentsByScopeKey),
          }),
        });
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.message || '문서 scope 저장에 실패했습니다.');
        }

        setTemplateScopeContextsByTemplateId((previous) => ({
          ...previous,
          [normalizedTemplateId]: result.data as TemplateScopeContextDto,
        }));
        setMessage(
          `"${membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber)}"의 문서 scope를 저장했습니다.`
        );
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '문서 scope 저장에 실패했습니다.'));
      } finally {
        setSavingMemberDocumentAccessKey('');
      }
    },
    [savingMemberDocumentAccessKey, selectedSiteId, templateScopeContextsByTemplateId]
  );

  const handleClearMemberDocumentScopeAccess = React.useCallback(
    async (
      membership: SiteMemberRecordDto,
      documentId: string,
      templateId: string,
      operationKey: string
    ) => {
      const normalizedSiteId = selectedSiteId.trim();
      const normalizedTemplateId = templateId.trim();
      const context = templateScopeContextsByTemplateId[normalizedTemplateId];

      if (!normalizedSiteId || !normalizedTemplateId || !context || savingMemberDocumentAccessKey) {
        return;
      }

      setSavingMemberDocumentAccessKey(operationKey);
      setMessage(null);

      try {
        const nextAssignmentsByScopeKey = Object.fromEntries(
          Object.entries(context.assignmentsByScopeKey).map(([entryScopeKey, memberIds]) => [
            entryScopeKey,
            memberIds.filter((memberId) => memberId !== membership.member.id),
          ])
        );
        const response = await fetch('/api/scopes/template-scopes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: normalizedTemplateId,
            siteId: normalizedSiteId,
            scopes: buildTemplateScopeSaveScopesFromContext(context, nextAssignmentsByScopeKey),
          }),
        });
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.message || '문서 scope 해제에 실패했습니다.');
        }

        setTemplateScopeContextsByTemplateId((previous) => ({
          ...previous,
          [normalizedTemplateId]: result.data as TemplateScopeContextDto,
        }));
        setMessage(
          `"${membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber)}"의 문서 scope를 해제했습니다.`
        );
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '문서 scope 해제에 실패했습니다.'));
      } finally {
        setSavingMemberDocumentAccessKey('');
      }
    },
    [savingMemberDocumentAccessKey, selectedSiteId, templateScopeContextsByTemplateId]
  );

  const handleDeleteSiteMember = React.useCallback(
    async (membershipId: string, memberId: string, memberLabel: string) => {
      const normalizedMembershipId = membershipId.trim();

      if (!normalizedMembershipId || deletingSiteMemberId) {
        return;
      }

      const confirmed = window.confirm(`"${memberLabel}"의 현장 접근 권한을 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      setDeletingSiteMemberId(normalizedMembershipId);
      setMessage(null);

      try {
        const linkedDocumentMemberships = siteDocumentMembers.filter((membership) => membership.member.id === memberId);

        await Promise.all(
          linkedDocumentMemberships.map(async (membership) => {
            const response = await fetch(
              `/api/member-access/document-members?membershipId=${encodeURIComponent(membership.membershipId)}`,
              { method: 'DELETE' }
            );
            const result = await response.json();

            if (!response.ok || !result?.success) {
              throw new Error(result?.message || '구성원의 문서 권한 삭제에 실패했습니다.');
            }
          })
        );

        const response = await fetch(
          `/api/member-access/site-members?membershipId=${encodeURIComponent(normalizedMembershipId)}`,
          { method: 'DELETE' }
        );
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || '현장 구성원 권한 삭제에 실패했습니다.');
        }

        if (selectedSiteId) {
          await reloadSelectedSiteMembers();
        }

        setMessage(`"${memberLabel}"의 현장 접근 권한을 삭제했습니다.`);
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '현장 구성원 권한 삭제에 실패했습니다.'));
      } finally {
        setDeletingSiteMemberId('');
      }
    },
    [deletingSiteMemberId, reloadSelectedSiteMembers, selectedSiteId, siteDocumentMembers]
  );

  const siteDocumentRows = React.useMemo<ProjectListRow[]>(
    () =>
      documents.map((item) => {
        const linkedTemplate = item.document.templateId
          ? templates.find((template) => template.id === item.document.templateId) || null
          : null;
        const directDocumentMembers = siteDocumentMembers.filter(
          (membership) => membership.documentId === item.document.id
        );
        const documentLinkPhoneNumber =
          directDocumentMembers.find((membership) => membership.accessRole === 'signer')?.member.phoneNumber ||
          directDocumentMembers[0]?.member.phoneNumber ||
          null;
        const isStatusExpanded = expandedDocumentStatusDocumentId === item.document.id;

        return {
          key: item.document.id,
          label: item.document.title,
          statusLabel: getDocumentStatusLabel(item.document.status),
          statusVariant: getDocumentStatusVariant(item.document.status),
          labelContent: (
            <div
              className="min-w-0"
              {...projectOwnerItem(
                `site-document-list-row-${item.document.id}-document-title-content`,
                `${item.document.title} 문서명 표시 영역`
              )}
            >
              <div
                className="truncate text-sm font-medium text-slate-900"
                title={item.document.title}
                {...projectOwnerItem(
                  `site-document-list-row-${item.document.id}-document-title`,
                  `${item.document.title} 문서명`
                )}
              >
                {item.document.title}
              </div>
            </div>
          ),
          summary: `버전 ${item.document.currentVersionNumber || 0}`,
          savedAt: item.latestVersion?.createdAt ? formatDateTime(item.latestVersion.createdAt) : '저장 이력 없음',
          source: item.document.templateId
            ? (
                <div className="min-w-0">
                  <div
                    className="truncate text-[11px] text-slate-700"
                    title={linkedTemplate?.templateName || '이름 없는 문서 양식'}
                  >
                    {linkedTemplate?.templateName || '이름 없는 문서 양식'}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">문서 양식에서 생성</div>
                </div>
              )
            : '직접 추가한 문서',
          templateLabel: item.document.templateId
            ? (
                <div className="min-w-0">
                  <div
                    className="truncate text-[11px] text-slate-700"
                    title={linkedTemplate?.templateName || '이름 없는 문서 양식'}
                  >
                    {linkedTemplate?.templateName || '이름 없는 문서 양식'}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">문서 양식에서 생성</div>
                </div>
              )
            : '직접 추가한 문서',
          selected: item.document.id === selectedDocumentId,
          onClick: () => {
            setExpandedDocumentStatusDocumentId(item.document.id);
            handleSelectDocument(item.document.id);
          },
          detailAction: {
            title: isStatusExpanded ? '문서 상태 상세 숨기기' : '문서 상태 상세 보기',
            ariaLabel: `${item.document.title} 문서 상태 상세 ${isStatusExpanded ? '숨기기' : '보기'}`,
            icon: isStatusExpanded ? <Minimize2 className="h-4 w-4" /> : <Info className="h-4 w-4" />,
            onClick: () => {
              if (isStatusExpanded) {
                setExpandedDocumentStatusDocumentId('');
                return;
              }

              setExpandedDocumentStatusDocumentId(item.document.id);
              handleSelectDocument(item.document.id);
            },
          },
          documentLinkAction: {
            title: '문서 접근 링크 복사',
            ariaLabel: `${item.document.title} 문서 접근 링크 복사`,
            icon: <Link2 className="h-4 w-4" />,
            completedIcon: <Check className="h-4 w-4 text-emerald-600" />,
            completed: copiedDocumentLinkKey === `${item.document.id}:member-access`,
            feedbackKey: `${item.document.id}:member-access`,
            disabled: copyingDocumentLinkKey === `${item.document.id}:member-access`,
            onClick: () => {
              return handleCopyDocumentLink(item.document.id, item.document.title, documentLinkPhoneNumber);
            },
          },
          action: {
            title: '현장 문서 삭제',
            ariaLabel: `${item.document.title} 삭제`,
            icon: <Trash2 className="h-4 w-4" />,
            disabled: deletingDocument,
            onClick: () => {
              return handleDeleteDocument(item.document.id);
            },
          },
        };
      }),
    [
      copiedDocumentLinkKey,
      copyingDocumentLinkKey,
      deletingDocument,
      documents,
      handleCopyDocumentLink,
      handleDeleteDocument,
      handleSelectDocument,
      expandedDocumentStatusDocumentId,
      selectedDocumentId,
      siteDocumentMembers,
      templates,
    ]
  );

  const expandedSiteDocumentStatusItem = React.useMemo(
    () =>
      expandedDocumentStatusDocumentId
        ? documents.find((item) => item.document.id === expandedDocumentStatusDocumentId) || null
        : null,
    [documents, expandedDocumentStatusDocumentId]
  );
  const expandedSiteDocumentStatusTemplate = React.useMemo(
    () =>
      expandedSiteDocumentStatusItem?.document.templateId
        ? templates.find((template) => template.id === expandedSiteDocumentStatusItem.document.templateId) || null
        : null,
    [expandedSiteDocumentStatusItem?.document.templateId, templates]
  );
  const expandedSiteDocumentStatusSavedAt = expandedSiteDocumentStatusItem?.latestVersion?.createdAt
    ? formatDateTime(expandedSiteDocumentStatusItem.latestVersion.createdAt)
    : '저장 이력 없음';
  const expandedSiteDocumentStatusTemplateLabel = expandedSiteDocumentStatusItem?.document.templateId
    ? expandedSiteDocumentStatusTemplate?.templateName || '이름 없는 문서 양식'
    : '직접 추가한 문서';

  const photoRows = React.useMemo<ProjectListRow[]>(
    () =>
      photos.map((item) => ({
        key: item.photo.id,
        label: item.photo.photoTitle || '제목 없는 사진',
        statusLabel: getPhotoStatusLabel(item.photo.status),
        statusVariant: getPhotoStatusVariant(item.photo.status),
        summary: `직접 연결 ${item.manualLabels.length}건 · 추천 ${item.suggestedLabels.length}건`,
        capturedAt: item.photo.capturedAt ? formatDateTime(item.photo.capturedAt) : '촬영 시각 없음',
        evidenceLabel: `직접 연결 ${item.manualLabels.length}건 · 추천 ${item.suggestedLabels.length}건`,
        source: '현장 사진',
        selected: item.photo.id === selectedPhotoId,
        onClick: () => handleSelectPhoto(item.photo.id),
      })),
    [handleSelectPhoto, photos, selectedPhotoId]
  );

	  const siteDocumentPickerOptions = React.useMemo(
	    () =>
	      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        templateId: item.document.templateId,
        meta: `현재 상태 ${getDocumentStatusLabel(item.document.status)}`,
        keywords: [item.document.title, item.document.id, item.document.templateId || ''],
      })),
	    [documents]
	  );

  const siteMemberDocumentScopeOptions = React.useMemo(() => {
    const selectedDocumentIdSet = new Set(siteMemberDocumentIds);
    const optionByKey = new Map<string, ProjectDocumentPickerOption>();

    documents
      .filter((item) => selectedDocumentIdSet.has(item.document.id))
      .forEach((item) => {
        const templateId = item.document.templateId?.trim() || '';
        const context = templateId ? templateScopeContextsByTemplateId[templateId] : null;

        if (!templateId || !context) {
          return;
        }

        context.logicalScopes.forEach((scope) => {
          const optionId = `${templateId}::${scope.scopeKey}`;

          if (!optionByKey.has(optionId)) {
            optionByKey.set(optionId, {
              id: optionId,
              label: `${item.document.title} / ${scope.displayName}`,
              templateId,
              meta: scope.scopeKey,
              keywords: [item.document.title, item.document.id, templateId, scope.scopeKey, scope.displayName],
            });
          }
        });
      });

    return Array.from(optionByKey.values());
  }, [documents, siteMemberDocumentIds, templateScopeContextsByTemplateId]);

  React.useEffect(() => {
    const availableScopeOptionIds = new Set(siteMemberDocumentScopeOptions.map((option) => option.id));
    setSiteMemberDocumentScopeKeys((current) => current.filter((scopeOptionId) => availableScopeOptionIds.has(scopeOptionId)));
  }, [siteMemberDocumentScopeOptions]);

  const memberScopeDocumentCountByMemberId = React.useMemo(() => {
    const counts: Record<string, number> = {};

    documents.forEach((item) => {
      const templateId = item.document.templateId?.trim() || '';
      const context = templateId ? templateScopeContextsByTemplateId[templateId] : null;

      if (!context) {
        return;
      }

      siteMembers.forEach((membership) => {
        const hasScope = context.logicalScopes.some((scope) =>
          (context.assignmentsByScopeKey[scope.scopeKey] || []).includes(membership.member.id)
        );

        if (hasScope) {
          counts[membership.member.id] = (counts[membership.member.id] || 0) + 1;
        }
      });
    });

    return counts;
  }, [documents, siteMembers, templateScopeContextsByTemplateId]);

	  const siteMemberRows = React.useMemo<ProjectListRow[]>(
	    () =>
      siteMembers.map((membership) => {
        const memberLabel = membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber);
        const memberScopeDocumentCount = memberScopeDocumentCountByMemberId[membership.member.id] || 0;
        const isDeletingMember = deletingSiteMemberId === membership.membershipId;
        const isUpdatingMember = updatingSiteMemberId === membership.membershipId;
        const hasFullDocumentAccess = hasFullDocumentAccessBySiteRole(membership.accessRole);
        const expanded = expandedSiteMemberId === membership.membershipId;
        const scopeLabel = hasFullDocumentAccess
          ? '현장 전체 접근'
          : memberScopeDocumentCount > 0
            ? `scope 접근 · ${memberScopeDocumentCount}개 문서`
            : 'scope 접근 · 지정 없음';

        return {
	          key: membership.membershipId,
	          label: memberLabel,
	          statusLabel: getMemberVerificationStatusLabel(membership.member.verificationStatus),
	          statusVariant: getMemberVerificationStatusVariant(membership.member.verificationStatus),
	          summary: scopeLabel,
	          contact: formatPhoneNumber(membership.member.phoneNumber),
	          roleLabel: SITE_MEMBER_ROLE_LABELS[membership.accessRole],
	          scopeLabel,
          scopeContent: (
            <div className="flex min-w-0 items-center gap-2">
              <Badge
                variant={hasFullDocumentAccess ? 'green' : 'slate'}
                className="shrink-0 px-2 py-0 text-[10px] leading-5"
              >
                {hasFullDocumentAccess ? '현장 전체' : '문서별'}
              </Badge>
              <span className="min-w-0 truncate text-[10px] text-slate-500">
                {hasFullDocumentAccess
                  ? '모든 문서 접근 가능'
                  : memberScopeDocumentCount > 0
                    ? `${memberScopeDocumentCount}개 문서 scope`
                    : '지정 scope 없음'}
              </span>
            </div>
          ),
	          lastVerifiedAt: membership.member.lastVerifiedAt ? formatDateTime(membership.member.lastVerifiedAt) : '인증 이력 없음',
	          source: '현장 접근 권한',
	          selected: expanded,
          detailAction: {
            title: expanded ? '구성원 접근 상세 숨기기' : '구성원 접근 상세 보기',
            ariaLabel: `${memberLabel} 구성원 접근 상세 ${expanded ? '숨기기' : '보기'}`,
            icon: expanded ? <Minimize2 className="h-4 w-4" /> : <Info className="h-4 w-4" />,
            disabled: isDeletingMember || isUpdatingMember,
            onClick: () => {
              setExpandedSiteMemberId((current) =>
                current === membership.membershipId ? '' : membership.membershipId
              );
            },
          },
	          action: {
	            title: '현장 접근 권한 삭제',
	            ariaLabel: `${memberLabel} 현장 접근 권한 삭제`,
	            icon: <Trash2 className="h-4 w-4" />,
	            disabled: isDeletingMember,
	            onClick: () => {
	              void handleDeleteSiteMember(membership.membershipId, membership.member.id, memberLabel);
	            },
	          },
	        };
	      }),
	    [
	      deletingSiteMemberId,
	      expandedSiteMemberId,
	      handleDeleteSiteMember,
	      memberScopeDocumentCountByMemberId,
	      siteMembers,
	      updatingSiteMemberId,
	    ]
	  );

	  const expandedSiteMember = React.useMemo(
	    () => siteMembers.find((membership) => membership.membershipId === expandedSiteMemberId) || null,
	    [expandedSiteMemberId, siteMembers]
	  );
  const expandedSiteMemberLabel = expandedSiteMember
    ? expandedSiteMember.member.displayName?.trim() || formatPhoneNumber(expandedSiteMember.member.phoneNumber)
    : '';
  const expandedSiteMemberManagedRole = expandedSiteMember
    ? getManagedSiteMemberRole(expandedSiteMember.accessRole)
    : 'participant';
  const expandedSiteMemberHasFullDocumentAccess = expandedSiteMember
    ? hasFullDocumentAccessBySiteRole(expandedSiteMember.accessRole)
    : false;
  const expandedSiteMemberCanManageDocuments = expandedSiteMember ? !expandedSiteMemberHasFullDocumentAccess : false;
  const expandedSiteMemberIsUpdating = expandedSiteMember
    ? updatingSiteMemberId === expandedSiteMember.membershipId
    : false;
  const expandedSiteMemberIsDeleting = expandedSiteMember
    ? deletingSiteMemberId === expandedSiteMember.membershipId
    : false;
  const expandedMemberScopeDocumentCount = expandedSiteMember
    ? memberScopeDocumentCountByMemberId[expandedSiteMember.member.id] || 0
    : 0;

  const dashboardTargetSiteIds = React.useMemo(
    () => (selectedSiteIds.length > 0 ? selectedSiteIds : sites.map((site) => site.id)),
    [selectedSiteIds, sites]
  );

  const dashboardTargetSummaries = React.useMemo(() => {
    const siteIdSet = new Set(dashboardTargetSiteIds);
    return dashboardSummaries.filter((summary) => siteIdSet.has(summary.site.id));
  }, [dashboardSummaries, dashboardTargetSiteIds]);

  const dashboardSiteCount = dashboardTargetSiteIds.length;
  const dashboardDocumentCount = dashboardTargetSummaries.reduce((sum, summary) => sum + summary.documents.length, 0);
  const dashboardDraftDocumentCount = dashboardTargetSummaries.reduce(
    (sum, summary) => sum + summary.documents.filter((item) => item.document.status === 'draft').length,
    0
  );
  const dashboardPhotoCount = dashboardTargetSummaries.reduce((sum, summary) => sum + summary.photos.length, 0);
  const dashboardMissingDocumentCount = dashboardTargetSummaries.reduce(
    (sum, summary) => sum + (summary.checklist?.missingCount || 0),
    0
  );
  const dashboardPhotoReviewNeededCount = dashboardTargetSummaries.reduce(
    (sum, summary) => sum + (summary.checklist?.photoReviewNeededCount || 0),
    0
  );
  const dashboardPhotoMissingCount = dashboardTargetSummaries.reduce(
    (sum, summary) => sum + (summary.checklist?.photoMissingCount || 0),
    0
  );
  const dashboardDataIssueCount = dashboardTargetSummaries.filter((summary) => summary.hasError).length;
  const dashboardTodoCount =
    dashboardDraftDocumentCount +
    dashboardMissingDocumentCount +
    dashboardPhotoReviewNeededCount +
    dashboardPhotoMissingCount +
    dashboardDataIssueCount;
  const dashboardScopeLabel =
    selectedSiteIds.length > 0 ? `선택 현장 ${dashboardSiteCount}곳` : `전체 현장 ${dashboardSiteCount}곳`;
  const dashboardTodoItems = React.useMemo<ProjectDashboardTodoItem[]>(
    () => [
      {
        key: 'documents',
        label: '문서 작성',
        statusLabel: dashboardMissingDocumentCount > 0 || dashboardDraftDocumentCount > 0 ? '할 일' : '정상',
        statusVariant: dashboardMissingDocumentCount > 0 || dashboardDraftDocumentCount > 0 ? 'amber' : 'green',
        summary:
          dashboardMissingDocumentCount > 0 || dashboardDraftDocumentCount > 0
            ? `필요 문서 ${dashboardMissingDocumentCount}건, 작성 중 문서 ${dashboardDraftDocumentCount}건을 확인해 주세요.`
            : '문서 작성 상태가 정리되어 있습니다.',
      },
      {
        key: 'photos',
        label: '사진 등록·검토',
        statusLabel: dashboardPhotoMissingCount > 0 || dashboardPhotoReviewNeededCount > 0 ? '할 일' : '정상',
        statusVariant: dashboardPhotoMissingCount > 0 || dashboardPhotoReviewNeededCount > 0 ? 'amber' : 'green',
        summary:
          dashboardPhotoMissingCount > 0 || dashboardPhotoReviewNeededCount > 0
            ? `누락 ${dashboardPhotoMissingCount}건, 검토 필요 ${dashboardPhotoReviewNeededCount}건이 있습니다.`
            : '사진 증빙 상태가 정리되어 있습니다.',
      },
      {
        key: 'signature',
        label: '서명 요청',
        statusLabel: '확인',
        statusVariant: 'slate',
        summary: '서명이 필요한 문서를 선택해 요청 상태와 완료 여부를 확인해 주세요.',
      },
      {
        key: 'data',
        label: '정보 확인',
        statusLabel: dashboardDataIssueCount > 0 ? '확인 필요' : '정상',
        statusVariant: dashboardDataIssueCount > 0 ? 'red' : 'green',
        summary:
          dashboardDataIssueCount > 0
            ? `${dashboardDataIssueCount}곳의 현장 정보를 다시 불러와 확인해 주세요.`
            : '현장별 문서와 사진 정보를 정상적으로 확인했습니다.',
      },
    ],
    [
      dashboardDataIssueCount,
      dashboardDraftDocumentCount,
      dashboardMissingDocumentCount,
      dashboardPhotoMissingCount,
      dashboardPhotoReviewNeededCount,
    ]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      clearSelectedDocumentContext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelectedDocumentContext]);

  React.useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedDocumentDetail(null);
      setSelectedDocumentDetailError(null);
      setSelectedDocumentDetailErrorDebug(null);
      setLoadingDocumentDetail(false);
      return;
    }

    let active = true;
    setSelectedDocumentDetail(null);
    setSelectedDocumentDetailError(null);
    setSelectedDocumentDetailErrorDebug(null);
    setLoadingDocumentDetail(true);

    const loadDetail = async () => {
      try {
        const detail = await fetchSuccessDataWithTimeout<DocumentDetailResult>(`/api/documents/${selectedDocumentId}`);

        if (active) {
          setSelectedDocumentDetail(detail);
        }
      } catch (error) {
        if (active) {
          setSelectedDocumentDetail(null);
          setSelectedDocumentDetailError(
            error instanceof Error ? error.message : '문서 추가 정보를 불러오지 못했습니다.'
          );
          setSelectedDocumentDetailErrorDebug(error instanceof ApiFetchError ? error.debug : null);
        }
      } finally {
        if (active) {
          setLoadingDocumentDetail(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [selectedDocumentId]);

  const createSiteDocumentsFromTemplates = React.useCallback(
    async (siteId: string, templateIds: string[]) => {
      const templatesToCopy = templateIds
        .map((templateId) => templates.find((template) => template.id === templateId))
        .filter((template): template is TemplateRecordDto => Boolean(template));

      if (templatesToCopy.length === 0) {
        throw new Error('현장 문서를 준비할 문서 양식을 찾을 수 없습니다.');
      }

      const results = await Promise.allSettled(
        templatesToCopy.map(async (template) => {
          if (!template.draftHtml.trim()) {
            throw new Error(`"${template.templateName}" 문서 양식에 편집할 본문이 없습니다.`);
          }

          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              siteId,
              documentTypeKey: buildTemplateDocumentTypeKey(template.id),
              title: template.templateName,
              templateId: template.id,
              htmlCanonical: template.draftHtml,
              labelValues: {},
              createdBy: 'project-page',
            }),
          });
          const result = await response.json();

          if (!response.ok || !result?.success) {
            throw new Error(`"${template.templateName}" 문서 생성 실패: ${result?.message || '문서를 만들 수 없습니다.'}`);
          }

          return result.data as DocumentCreateResult;
        })
      );

      const createdDocuments = results
        .filter((result): result is PromiseFulfilledResult<DocumentCreateResult> => result.status === 'fulfilled')
        .map((result) => result.value);
      const failedMessages = results.flatMap((result) =>
        result.status === 'rejected'
          ? [result.reason instanceof Error ? result.reason.message : '현장 문서 생성에 실패했습니다.']
          : []
      );

      return {
        createdDocuments,
        createdCount: createdDocuments.length,
        failedMessages,
      };
    },
    [templates]
  );

  const handleResetCreateSiteForm = () => {
    setNewSiteName('');
    setNewSiteOpenDate(getTodayInputValue());
    setNewSiteTemplateIds([]);
  };

  const handleCreateSite = async () => {
    const siteName = newSiteName.trim();

    if (!siteName) {
      setMessage('현장 이름을 입력해 주세요.');
      return;
    }

    if (!newSiteOpenDate) {
      setMessage('공사 시작일을 입력해 주세요.');
      return;
    }

    if (newSiteTemplateIds.length === 0) {
      setMessage('현장에서 사용할 문서를 최소 1건 선택해 주세요.');
      return;
    }

    setCreatingSite(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName,
          openDate: newSiteOpenDate,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '현장 생성에 실패했습니다.');
      }

      const createdSite = result.data as SiteCreateResult;
      const nextSite = createdSite.site;

      setSites((previous) => [nextSite, ...previous.filter((site) => site.id !== nextSite.id)]);
      setSelectedSiteId(nextSite.id);
      setSelectedSiteIds([nextSite.id]);

      const copiedDocuments = await createSiteDocumentsFromTemplates(nextSite.id, newSiteTemplateIds);

      try {
        await syncSiteDocuments(nextSite.id);
      } catch {
        // The site and documents are already created. A later refresh can resync the list if needed.
      }

      setShowCreateSiteForm(false);
      handleResetCreateSiteForm();
      setMessage(
        copiedDocuments.failedMessages.length > 0
          ? copiedDocuments.failedMessages[0]
          : `현장을 만들고 문서 ${copiedDocuments.createdCount}건을 준비했습니다.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현장 생성에 실패했습니다.');
    } finally {
      setCreatingSite(false);
    }
  };

  const handleAddSiteDocuments = async () => {
    if (!selectedSiteId) {
      setMessage('문서를 추가할 현장을 먼저 선택해 주세요.');
      return;
    }

    if (siteDocumentTemplateIds.length === 0) {
      setMessage('현장 문서로 추가할 문서를 최소 1건 선택해 주세요.');
      return;
    }

    setAddingSiteDocuments(true);
    setMessage(null);

    try {
      const copiedDocuments = await createSiteDocumentsFromTemplates(selectedSiteId, siteDocumentTemplateIds);
      await syncSiteDocuments(selectedSiteId);
      setShowAddSiteDocumentForm(false);
      setSiteDocumentTemplateIds([]);
      setMessage(
        copiedDocuments.failedMessages.length > 0
          ? copiedDocuments.failedMessages[0]
          : `현장 문서 ${copiedDocuments.createdCount}건을 추가했습니다.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현장 문서 추가에 실패했습니다.');
    } finally {
      setAddingSiteDocuments(false);
    }
  };

  const handlePrepareDeleteSite = async (siteId: string) => {
    if (loadingDeleteImpact || deletingSite) {
      return;
    }

    const nextSiteId = siteId.trim();

    if (!nextSiteId) {
      setMessage('삭제할 현장을 찾지 못했습니다.');
      return;
    }

    setSelectedSiteId(nextSiteId);
    setLoadingDeleteImpact(true);
    setDeleteImpact(null);
    setMessage(null);

    try {
      const impact = await fetchSuccessData<SiteDeleteImpactDto>(`/api/sites/${nextSiteId}`);
      setDeleteImpact(impact);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '삭제 항목을 확인하지 못했습니다.');
    } finally {
      setLoadingDeleteImpact(false);
    }
  };

  const handleCancelDeleteSite = () => {
    setDeleteImpact(null);
  };

  const handleDeleteSite = async () => {
    if (!deleteImpact) {
      setMessage('삭제 확인 대상 현장을 먼저 고른 뒤 다시 시도해 주세요.');
      return;
    }

    setDeletingSite(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/${deleteImpact.site.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '현장 삭제에 실패했습니다.');
      }

      const deletedSite = result.data as SiteDeleteResult;

      setDeleteImpact(null);
      setSites((previous) => previous.filter((site) => site.id !== deletedSite.site.id));
      setSelectedSiteId((current) => (current === deletedSite.site.id ? '' : current));
      setSelectedSiteIds((current) => current.filter((siteId) => siteId !== deletedSite.site.id));
      clearSelectedDocumentContext();
      setDocuments([]);
      setPhotos([]);

      setMessage(`"${deletedSite.site.siteName}" 현장과 연관된 항목을 삭제했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '현장 삭제에 실패했습니다.');
    } finally {
      setDeletingSite(false);
    }
  };

  const handleSaveDocumentDraft = React.useCallback(
    async ({ currentHtml, attachmentDrafts }: TemplateEditWorkspaceSaveDraftParams) => {
      const targetDocumentId =
        selectedDocumentDetail?.document.id || selectedDocumentListItem?.document.id || selectedDocumentId.trim();

      if (!targetDocumentId) {
        throw new Error('작성할 현장 문서를 먼저 선택해 주세요.');
      }

      const nextLabelValues = extractDocumentLabelValuesFromHtml(currentHtml, selectedDocumentLabelValues);
      const nextValueFiles = await buildDocumentAttachmentValueFilesForSave({
        attachmentApiPath: `/api/documents/${encodeURIComponent(targetDocumentId)}/attachments`,
        attachmentDrafts,
      });
      const persistedHtml = materializeTemplateCanvasHtmlForPersistence(currentHtml, {
        attachmentFiles: nextValueFiles,
      });
      const documentTitle = selectedDocumentDetail?.document.title || selectedDocumentListItem?.document.title || '현장 문서';

      const response = await fetch(`/api/documents/${targetDocumentId}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCanonical: persistedHtml,
          labelValues: nextLabelValues,
          valueFiles: nextValueFiles,
          changeReason: 'project-page-edit',
          createdBy: 'project-page',
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '현장 문서 저장에 실패했습니다.');
      }

      if (selectedSiteId) {
        await syncSiteDocuments(selectedSiteId);
      }

      setLoadingDocumentDetail(true);

      try {
        await loadSelectedDocumentDetail(targetDocumentId);
      } catch {
        setSelectedDocumentDetail(null);
        setSelectedDocumentDetailError('문서는 저장했지만 최신 상세 정보는 다시 불러오지 못했습니다.');
        setSelectedDocumentDetailErrorDebug(null);
        setMessage('문서는 저장했지만 상세 정보는 다시 불러오지 못했습니다. 편집 내용은 저장되었습니다.');
      } finally {
        setLoadingDocumentDetail(false);
      }

      return {
        successMessage: `"${documentTitle}" 문서를 저장했습니다.`,
      };
    },
    [
      loadSelectedDocumentDetail,
      selectedDocumentDetail,
      selectedDocumentId,
      selectedDocumentLabelValues,
      selectedDocumentListItem?.document.id,
      selectedDocumentListItem?.document.title,
      selectedSiteId,
      syncSiteDocuments,
    ]
  );

  const selectedOwnerDocumentId =
    selectedDocumentListItem?.document.id || selectedDocumentDetail?.document.id || selectedDocumentId.trim();
  const selectedOwnerSiteId =
    selectedDocumentListItem?.document.siteId || selectedDocumentDetail?.document.siteId || selectedSiteId;
  const projectDocumentOutputTabs: Array<{ value: ProjectDocumentOutputTab; label: string }> = [
    { value: 'edit', label: '편집' },
    { value: 'todo', label: '할 일' },
  ];

  const renderProjectDocumentCreateSiteNotice = () => (
    <Card className="border-slate-200" {...projectOwnerItem('document-output-create-site-notice-panel', '문서 출력 새 현장 입력 중 안내 패널')}>
      <CardContent className="p-6" {...projectOwnerItem('document-output-create-site-notice-content', '문서 출력 새 현장 입력 중 안내 내용')}>
        <EmptyState
          title="새 현장을 입력하는 중입니다."
          description="현장 생성을 마치거나 입력을 닫으면 선택한 문서를 다시 편집할 수 있습니다."
          ownerItemKey="document-output-create-site-notice-empty-state"
        />
      </CardContent>
    </Card>
  );

  const renderProjectDocumentNoSelectionNotice = () => (
    <Card className="border-slate-200" {...projectOwnerItem('document-output-no-selection-notice-panel', '문서 출력 문서 미선택 안내 패널')}>
      <CardContent className="p-6" {...projectOwnerItem('document-output-no-selection-notice-content', '문서 출력 문서 미선택 안내 내용')}>
        <EmptyState
          title="작업할 현장 문서를 먼저 고르세요."
          description="위의 현장 문서에서 문서를 선택하면 이 페이지 하단에서 바로 편집하거나 할 일을 부여할 수 있습니다."
          ownerItemKey="document-output-no-selection-notice-empty-state"
        />
      </CardContent>
    </Card>
  );

  const renderProjectDocumentEditPanel = () => {
    if (showCreateSiteForm) {
      return renderProjectDocumentCreateSiteNotice();
    }

    if (loadingDocumentDetail && selectedOwnerDocumentId && !selectedDocumentInitialDraft) {
      return (
        <Card className="border-slate-200" {...projectOwnerItem('document-edit-loading-panel', '문서 편집 로딩 패널')}>
          <CardContent className="p-6" {...projectOwnerItem('document-edit-loading-content', '문서 편집 로딩 내용')}>
            <EmptyState
              title="문서 정보를 불러오는 중입니다."
              description="현장 문서 본문을 준비하고 있습니다."
              ownerItemKey="document-edit-loading-empty-state"
            />
          </CardContent>
        </Card>
      );
    }

    if (selectedOwnerDocumentId && selectedDocumentInitialDraft) {
      return (
        <div {...projectOwnerItem('document-edit-canvas-owner-workspace', '문서 편집 상자 편집 캔버스')}>
          <CanvasOwnedWorkspace
            key={`project-edit:${selectedDocumentInitialDraft.draftKey}`}
            surface="project"
            initialDraft={selectedDocumentInitialDraft}
            workspaceMode="document"
            hideHeader
            hidePersistencePanel
            nameFieldLabel="문서 이름:"
            saveButtonLabel="문서 저장"
            templateNameReadOnly
            documentAttachmentApiPath={`/api/documents/${encodeURIComponent(selectedOwnerDocumentId)}/attachments`}
            onSaveDraftHtml={handleSaveDocumentDraft}
            suppressInitialDraftLoadedMessage
          />
        </div>
      );
    }

    if (selectedOwnerDocumentId || selectedDocumentListItem) {
      return (
        <Card className="border-slate-200" {...projectOwnerItem('document-edit-empty-body-panel', '문서 편집 본문 없음 안내 패널')}>
          <CardContent className="p-6" {...projectOwnerItem('document-edit-empty-body-content', '문서 편집 본문 없음 안내 내용')}>
            <EmptyState
              title="현재 문서에 편집할 본문이 없습니다."
              description="이 문서의 최신 본문이 없어서 상자 편집 캔버스를 열 수 없습니다."
              ownerItemKey="document-edit-empty-body-empty-state"
            />
          </CardContent>
        </Card>
      );
    }

    return renderProjectDocumentNoSelectionNotice();
  };

  const renderProjectDocumentTodoPanel = () => {
    if (showCreateSiteForm) {
      return renderProjectDocumentCreateSiteNotice();
    }

    if (selectedOwnerDocumentId) {
      return (
        <div {...projectOwnerItem('document-todo-documents-owner-workspace', '문서 할 일 문서 기능 워크스페이스')}>
          <DocumentsOwnerWorkspace
            key={`project-current-work:${selectedOwnerDocumentId}`}
            initialSiteId={selectedOwnerSiteId}
            lockedDocumentId={selectedOwnerDocumentId}
            hideDocumentPicker
            hidePageHeader
            embedded
            surface="project"
            renderMode="current-work-panel"
          />
        </div>
      );
    }

    return renderProjectDocumentNoSelectionNotice();
  };

  const renderProjectDocumentOutputTabs = () => (
    <div className="space-y-4" {...projectOwnerItem('document-output-tabs', '현장 문서 출력 탭 영역')}>
      <div {...projectOwnerItem('document-output-tab-list', '현장 문서 작업 탭 리스트')}>
        <OwnerSettingsTabList
          value={activeProjectDocumentOutputTab}
          ariaLabel="현장 문서 작업 탭"
          options={projectDocumentOutputTabs}
          onChange={(value) => setActiveProjectDocumentOutputTab(value as ProjectDocumentOutputTab)}
          className="max-w-xs"
        />
      </div>

      <div
        role="tabpanel"
        {...projectOwnerItem(
          activeProjectDocumentOutputTab === 'edit'
            ? 'document-edit-output-panel'
            : 'document-todo-output-panel',
          activeProjectDocumentOutputTab === 'edit'
            ? '현장 문서 편집 출력 패널'
            : '현장 문서 할 일 출력 패널'
        )}
      >
        {activeProjectDocumentOutputTab === 'edit'
          ? renderProjectDocumentEditPanel()
          : renderProjectDocumentTodoPanel()}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-8 md:px-8" {...projectOwnerItem('project-owner-root', '현장 관리 페이지 루트')}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between" {...projectOwnerItem('project-page-header', '현장 관리 페이지 머리글')}>
        <div className="space-y-2" {...projectOwnerItem('project-page-heading-group', '현장 관리 페이지 제목 묶음')}>
          <Badge variant="slate" {...projectOwnerItem('project-page-feature-badge', '현장 관리 페이지 기능 배지')}>현장 통합 관리</Badge>
          <h1 className="text-3xl font-semibold text-slate-950" {...projectOwnerItem('project-page-title', '현장 관리 페이지 제목')}>현장 관리</h1>
          <p className="max-w-4xl text-sm text-slate-600" {...projectOwnerItem('project-page-description', '현장 관리 페이지 설명')}>
            현장을 만들고 필요한 문서를 준비한 뒤, 기록 값과 첨부 파일, 사진 증빙, 구성원 접근 권한을 한곳에서 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" {...projectOwnerItem('project-page-actions', '현장 관리 페이지 실행 버튼 영역')}>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} {...projectOwnerItem('project-refresh-button', '현장 관리 새로고침 버튼')}>
            <RefreshCcw className="h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-white" {...projectOwnerItem('project-message-panel', '현장 관리 메시지 패널')}>
          <CardContent className="p-4 text-sm text-slate-700" {...projectOwnerItem('project-message-content', '현장 관리 메시지 내용')}>{message}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-6" {...projectOwnerItem('project-main-content', '현장 관리 주요 내용')}>
        <Card className="min-w-0 border-slate-200" {...projectOwnerItem('site-selection-panel', '1. 현장 선택과 기본 정보 패널')}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0" {...projectOwnerItem('site-selection-panel-header', '현장 선택과 기본 정보 제목 영역')}>
            <div className="space-y-1.5" {...projectOwnerItem('site-selection-panel-heading-group', '현장 선택과 기본 정보 제목 묶음')}>
              <CardTitle {...projectOwnerItem('site-selection-panel-title', '현장 선택과 기본 정보 제목')}>1. 현장 선택과 기본 정보</CardTitle>
              <CardDescription {...projectOwnerItem('site-selection-panel-description', '현장 선택과 기본 정보 설명')}>
                새 현장을 만들거나 기존 현장을 선택해 문서, 사진, 구성원을 관리합니다.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant={showCreateSiteForm ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowCreateSiteForm((previous) => !previous)}
              className="h-[42px] shrink-0"
              {...projectOwnerItem('site-create-form-toggle-button', '새 현장 만들기 입력 열고 닫기 버튼')}
            >
              {showCreateSiteForm ? '입력 닫기' : '새 현장 만들기'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5" {...projectOwnerItem('site-picker-field', '현장 리스트 선택 항목')}>
            {showCreateSiteForm ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" {...projectOwnerItem('site-create-form-panel', '새 현장 만들기 입력 패널')}>
                <div className="space-y-4" {...projectOwnerItem('site-create-form-content', '새 현장 만들기 입력 내용')}>
                  <div className="grid gap-4 md:grid-cols-2" {...projectOwnerItem('site-create-basic-field-grid', '새 현장 기본 입력 필드 묶음')}>
                    <div className="space-y-2" {...projectOwnerItem('site-create-name-field', '새 현장 이름 입력 항목')}>
                      <label className="text-sm font-medium text-slate-800" {...projectOwnerItem('site-create-name-label', '새 현장 이름 라벨')}>현장 이름</label>
                      <Input
                        value={newSiteName}
                        onChange={(event) => setNewSiteName(event.target.value)}
                        placeholder="예: 서울 A현장, 대구 침산 더샵 101동"
                        {...projectOwnerItem('site-create-name-input', '새 현장 이름 입력')}
                      />
                    </div>
                    <div className="space-y-2" {...projectOwnerItem('site-create-open-date-field', '새 현장 공사 시작일 입력 항목')}>
                      <label className="text-sm font-medium text-slate-800" {...projectOwnerItem('site-create-open-date-label', '새 현장 공사 시작일 라벨')}>공사 시작일</label>
                      <Input
                        type="date"
                        value={newSiteOpenDate}
                        onChange={(event) => setNewSiteOpenDate(event.target.value)}
                        {...projectOwnerItem('site-create-open-date-input', '새 현장 공사 시작일 입력')}
                      />
                    </div>
                  </div>

                  <div className="space-y-2" {...projectOwnerItem('site-create-template-field', '새 현장 사용할 문서 선택 항목')}>
                    <div className="space-y-1" {...projectOwnerItem('site-create-template-label-group', '새 현장 사용할 문서 라벨 묶음')}>
                      <label className="text-sm font-medium text-slate-800" {...projectOwnerItem('site-create-template-label', '새 현장 사용할 문서 라벨')}>현장에서 사용할 문서</label>
                      <p className="text-xs text-slate-500" {...projectOwnerItem('site-create-template-description', '새 현장 사용할 문서 설명')}>
                        여기서 고른 문서만 이 현장의 문서 목록으로 준비됩니다.
                      </p>
                    </div>
                    {templates.length > 0 ? (
                      <div className="space-y-2" {...projectOwnerItem('site-create-template-picker-field', '새 현장 사용할 문서 셀렉트 항목')}>
                        <MultiEntityPicker
                          values={newSiteTemplateIds}
                          options={newSiteTemplateOptions}
                          onChange={setNewSiteTemplateIds}
                          placeholder="현장에서 시작할 문서를 선택하세요"
                          searchPlaceholder="문서 목록 검색"
                          emptyMessage="선택 가능한 문서 양식이 없습니다."
                          allowClear
                          ownerItemKey="site-create-template-picker"
                          ownerItemName="새 현장 사용할 문서 선택기"
                          ownerItemAttributes={projectOwnerItem}
                        />
                        <div className="text-xs text-slate-500" {...projectOwnerItem('site-create-template-selection-summary', '새 현장 사용할 문서 선택 요약')}>
                          전체 {templates.length}개 중 {selectedNewSiteTemplates.length}개 선택됨. 필수: 최소 1건
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500" {...projectOwnerItem('site-create-template-empty-state', '새 현장 사용할 문서 양식 없음 안내')}>
                        <div {...projectOwnerItem('site-create-template-empty-message', '새 현장 사용할 문서 양식 없음 메시지')}>먼저 문서 양식 화면에서 현장 문서를 시작할 양식을 만들어 주세요.</div>
                        <div className="mt-4" {...projectOwnerItem('site-create-template-empty-action', '새 현장 사용할 문서 양식 없음 실행 영역')}>
                          <Button variant="outline" asChild {...projectOwnerItem('site-create-template-open-templates-button', '문서 양식 화면 열기 버튼')}>
                            <Link href="/templates">문서 양식 화면 열기</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2" {...projectOwnerItem('site-create-form-actions', '새 현장 만들기 실행 버튼 영역')}>
                    <Button onClick={handleCreateSite} disabled={creatingSite} {...projectOwnerItem('site-create-submit-button', '새 현장 만들기 버튼')}>
                      {creatingSite ? '현장 만드는 중...' : '현장 만들기'}
                    </Button>
                    <Button variant="outline" onClick={handleResetCreateSiteForm} disabled={creatingSite} {...projectOwnerItem('site-create-reset-button', '새 현장 입력 비우기 버튼')}>
                      입력 비우기
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {showCreateSiteForm ? null : (
              <div className="space-y-3" {...projectOwnerItem('site-picker-control-field', '현장 리스트 선택 컨트롤 항목')}>
                <label className="text-sm font-medium text-slate-800" {...projectOwnerItem('site-picker-label', '현장 리스트 라벨')}>현장 리스트</label>
                <MultiEntityPicker
                  values={selectedSiteIds}
                  options={siteOptions}
                  onChange={handleChangeSelectedSites}
                  placeholder="전체 현장"
                  searchPlaceholder="현장 이름 검색"
                  emptyMessage="선택 가능한 현장이 없습니다."
                  disabled={deletingSite}
                  allowClear
                  onDeleteOption={(option) => {
                    void handlePrepareDeleteSite(option.id);
                  }}
                  deleteOptionLabel="현장 삭제"
                  selectionSummary={(selectedOptions) => {
                    if (selectedOptions.length === 0) {
                      return '';
                    }

                    if (selectedOptions.length === 1) {
                      const option = selectedOptions[0];
                      return `${option.label}${option.meta ? ` · ${option.meta}` : ''}`;
                    }

                    const firstOption = selectedOptions[0];
                    const firstLabel = `${firstOption?.label || '현장'}${
                      firstOption?.meta ? ` · ${firstOption.meta}` : ''
                    }`;

                    return `${selectedOptions.length}곳 선택 · ${firstLabel} 외 ${selectedOptions.length - 1}곳`;
                  }}
                  ownerItemKey="site-picker"
                  ownerItemName="현장 리스트 선택기"
                  ownerItemAttributes={projectOwnerItem}
                />

                {loadingDeleteImpact ? (
                  <div className="text-xs text-slate-500" {...projectOwnerItem('site-delete-impact-loading-state', '현장 삭제 영향 확인 로딩 상태')}>삭제 시 함께 지워질 항목을 확인하는 중입니다.</div>
                ) : null}

                {deleteImpact ? (
                  <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4" {...projectOwnerItem('site-delete-impact-panel', '현장 삭제 영향 확인 패널')}>
                    <div className="space-y-1" {...projectOwnerItem('site-delete-impact-header', '현장 삭제 영향 확인 머리글')}>
                      <div className="text-sm font-semibold text-slate-900" {...projectOwnerItem('site-delete-impact-title', '현장 삭제 영향 확인 제목')}>
                        "{deleteImpact.site.siteName}" 현장을 삭제하면 아래 항목도 함께 삭제됩니다.
                      </div>
                      <p className="text-sm text-slate-600" {...projectOwnerItem('site-delete-impact-description', '현장 삭제 영향 확인 설명')}>
                        삭제 후 되돌릴 수 없습니다. 항목을 확인한 뒤 정말 삭제할지 한 번 더 선택해 주세요.
                      </p>
                    </div>

                    <div className="space-y-2" {...projectOwnerItem('site-delete-impact-list', '현장 삭제 영향 항목 목록')}>
                      {deleteImpact.items.map((item) => (
                        <div key={item.key} className="rounded-lg border border-rose-100 bg-white px-3 py-3" {...projectOwnerItem(`site-delete-impact-row-${item.key}`, `${item.label} 삭제 영향 항목`)}>
                          <div className="flex items-start justify-between gap-3" {...projectOwnerItem(`site-delete-impact-row-${item.key}-content`, `${item.label} 삭제 영향 항목 내용`)}>
                            <div className="min-w-0" {...projectOwnerItem(`site-delete-impact-row-${item.key}-text`, `${item.label} 삭제 영향 항목 텍스트`)}>
                              <div className="text-sm font-medium text-slate-900" {...projectOwnerItem(`site-delete-impact-row-${item.key}-label`, `${item.label} 삭제 영향 항목 라벨`)}>{item.label}</div>
                              {item.description ? (
                                <div className="mt-1 text-xs leading-5 text-slate-600" {...projectOwnerItem(`site-delete-impact-row-${item.key}-description`, `${item.label} 삭제 영향 항목 설명`)}>{item.description}</div>
                              ) : null}
                            </div>
                            <Badge variant="red" className="shrink-0" {...projectOwnerItem(`site-delete-impact-row-${item.key}-count-badge`, `${item.label} 삭제 영향 항목 개수`)}>
                              {item.count}건
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2" {...projectOwnerItem('site-delete-impact-actions', '현장 삭제 영향 실행 버튼 영역')}>
                      <Button variant="destructive" onClick={handleDeleteSite} disabled={deletingSite} {...projectOwnerItem('site-delete-confirm-button', '현장 삭제 확정 버튼')}>
                        {deletingSite ? '삭제하는 중...' : '정말 삭제'}
                      </Button>
                      <Button variant="outline" onClick={handleCancelDeleteSite} disabled={deletingSite} {...projectOwnerItem('site-delete-cancel-button', '현장 삭제 취소 버튼')}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <div
          className={cn(
            'grid min-w-0 grid-cols-1 gap-6',
            selectedSiteIds.length > 0 && selectedSite && !showCreateSiteForm
              ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
              : ''
          )}
          {...projectOwnerItem('site-dashboard-document-member-layout', '현장 대시보드와 현장 문서 구성원 배치')}
        >
          <Card className="min-w-0 border-slate-200" {...projectOwnerItem('site-dashboard-content', '현장 대시보드 내용')}>
            <CardContent className="space-y-3 p-6" {...projectOwnerItem('site-dashboard-content-body', '현장 대시보드 내용 본문')}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" {...projectOwnerItem('site-dashboard-header', '현장 대시보드 머리글')}>
                <div {...projectOwnerItem('site-dashboard-heading-group', '현장 대시보드 제목 묶음')}>
                  <div className="text-sm font-semibold text-slate-900" {...projectOwnerItem('site-dashboard-title', '현장 대시보드 제목')}>현장 대시보드</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500" {...projectOwnerItem('site-dashboard-description', '현장 대시보드 설명')}>
                    현장을 따로 고르지 않으면 모든 현장의 문서, 사진, 할 일을 합산해서 보여줍니다.
                  </p>
                </div>
                <Badge variant={loadingDashboardSummaries ? 'slate' : 'green'} className="w-fit shrink-0" {...projectOwnerItem('site-dashboard-scope-badge', '현장 대시보드 범위 배지')}>
                  {loadingDashboardSummaries ? '불러오는 중' : dashboardScopeLabel}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2" {...projectOwnerItem('site-dashboard-metric-grid', '현장 대시보드 지표 목록')}>
                <MetricCard
                  icon={FolderKanban}
                  label="현장"
                  value={String(dashboardSiteCount)}
                  description="대시보드에 포함된 현장"
                  ownerItemKey="site-dashboard-site-count-card"
                />
                <MetricCard
                  icon={FileStack}
                  label="문서"
                  value={String(dashboardDocumentCount)}
                  description="포함된 현장의 전체 문서"
                  ownerItemKey="site-dashboard-document-count-card"
                />
                <MetricCard
                  icon={FileImage}
                  label="사진"
                  value={String(dashboardPhotoCount)}
                  description="포함된 현장의 전체 사진"
                  ownerItemKey="site-dashboard-photo-count-card"
                />
                <MetricCard
                  icon={Signature}
                  label="할 일"
                  value={String(dashboardTodoCount)}
                  description="문서, 사진, 확인 필요 항목"
                  ownerItemKey="site-dashboard-todo-count-card"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2" {...projectOwnerItem('site-dashboard-todo-card-grid', '현장 대시보드 할 일 카드 목록')}>
                {dashboardTodoItems.map((item) => (
                  <DashboardTodoCard key={item.key} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedSiteIds.length > 0 && selectedSite && !showCreateSiteForm ? (
            <Card className="min-w-0 border-slate-200" {...projectOwnerItem('site-document-member-panel', '현장 문서 구성원 패널')}>
                <CardHeader {...projectOwnerItem('site-document-member-panel-header', '현장 문서 구성원 제목 영역')}>
                  <CardTitle {...projectOwnerItem('site-document-member-panel-title', '현장 문서 구성원 제목')}>현장 문서 · 구성원</CardTitle>
                  <CardDescription {...projectOwnerItem('site-document-member-panel-description', '현장 문서 구성원 설명')}>선택한 현장의 문서와 구성원 권한을 관리합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6" {...projectOwnerItem('site-document-member-panel-content', '현장 문서 구성원 내용')}>
                  <div className="space-y-3" {...projectOwnerItem('site-document-section', '현장 문서 섹션')}>
                    <div className="flex items-start justify-between gap-3" {...projectOwnerItem('site-document-section-header', '현장 문서 섹션 머리글')}>
                      <div className="space-y-1" {...projectOwnerItem('site-document-section-heading-group', '현장 문서 섹션 제목 묶음')}>
                        <div className="text-sm font-semibold text-slate-900" {...projectOwnerItem('site-document-section-title', '현장 문서 섹션 제목')}>현장 문서</div>
                        <p className="text-xs text-slate-500" {...projectOwnerItem('site-document-section-description', '현장 문서 섹션 설명')}>선택한 현장의 문서를 만들고, 접근 링크와 삭제를 관리합니다.</p>
                      </div>
                      <div className="flex items-center gap-2" {...projectOwnerItem('site-document-section-actions', '현장 문서 섹션 실행 영역')}>
                        <span className="text-xs text-slate-500" {...projectOwnerItem('site-document-total-count', '현장 문서 전체 개수')}>전체 {documents.length}건</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => setShowAddSiteDocumentForm((previous) => !previous)}
                          title="현장 문서 추가"
                          aria-label="현장 문서 추가"
                          disabled={!selectedSite}
                          {...projectOwnerItem('site-document-add-toggle-button', '현장 문서 추가 열기 버튼')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {selectedSite ? (
                      <>
                        {showAddSiteDocumentForm ? (
                          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" {...projectOwnerItem('site-document-add-form-panel', '현장 문서 추가 입력 패널')}>
                            {siteDocumentTemplateOptions.length > 0 ? (
                              <>
                                <MultiEntityPicker
                                  values={siteDocumentTemplateIds}
                                  options={siteDocumentTemplateOptions}
                                  onChange={setSiteDocumentTemplateIds}
                                  placeholder="현장 문서로 추가할 문서를 선택하세요"
                                  searchPlaceholder="문서 목록 검색"
                                  emptyMessage="추가 가능한 문서 양식이 없습니다."
                                  allowClear
                                  ownerItemKey="site-document-add-template-picker"
                                  ownerItemName="현장 문서 추가 문서 양식 선택기"
                                  ownerItemAttributes={projectOwnerItem}
                                />
                                <div className="flex flex-wrap gap-2" {...projectOwnerItem('site-document-add-form-actions', '현장 문서 추가 실행 버튼 영역')}>
                                  <Button onClick={handleAddSiteDocuments} disabled={addingSiteDocuments} {...projectOwnerItem('site-document-add-submit-button', '현장 문서 추가 버튼')}>
                                    {addingSiteDocuments ? '추가하는 중...' : '현장 문서 추가'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setShowAddSiteDocumentForm(false);
                                      setSiteDocumentTemplateIds([]);
                                    }}
                                    disabled={addingSiteDocuments}
                                    {...projectOwnerItem('site-document-add-cancel-button', '현장 문서 추가 취소 버튼')}
                                  >
                                    취소
                                  </Button>
                                </div>
                              </>
	                            ) : (
	                              <div className="text-sm text-slate-500" {...projectOwnerItem('site-document-add-empty-state', '현장 문서 추가 가능 문서 없음 안내')}>추가할 수 있는 문서 양식이 없습니다.</div>
	                            )}
	                          </div>
	                        ) : null}
                        <ProjectInfoList
                          items={siteDocumentRows}
                          variant="document"
                          emptyMessage="아직 만든 현장 문서가 없습니다."
                          maxBodyHeightClassName="max-h-[220px]"
                          ownerItemKey="site-document-list"
                          ownerItemName="현장 문서 목록"
                        />
                        {expandedSiteDocumentStatusItem ? (
                          <div
                            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                            {...projectOwnerItem(
                              `site-document-status-expanded-panel-${expandedSiteDocumentStatusItem.document.id}`,
                              `${expandedSiteDocumentStatusItem.document.title} 문서 상태 확장 패널`
                            )}
                          >
                            <div
                              className="flex items-center justify-between gap-3"
                              {...projectOwnerItem(
                                `site-document-status-expanded-header-${expandedSiteDocumentStatusItem.document.id}`,
                                `${expandedSiteDocumentStatusItem.document.title} 문서 상태 확장 머리글`
                              )}
                            >
                              <div
                                className="min-w-0 text-xs font-semibold text-slate-900"
                                {...projectOwnerItem(
                                  `site-document-status-expanded-title-${expandedSiteDocumentStatusItem.document.id}`,
                                  `${expandedSiteDocumentStatusItem.document.title} 문서 상태 확장 제목`
                                )}
                              >
                                {expandedSiteDocumentStatusItem.document.title} 문서 상태
                              </div>
                              {loadingDocumentDetail && selectedDocumentId === expandedSiteDocumentStatusItem.document.id ? (
                                <span
                                  className="shrink-0 text-[11px] text-slate-500"
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-loading-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 문서 상태 확장 로딩 표시`
                                  )}
                                >
                                  불러오는 중
                                </span>
                              ) : null}
                            </div>

                            <div
                              className="grid gap-2 sm:grid-cols-3"
                              {...projectOwnerItem(
                                `site-document-status-expanded-summary-${expandedSiteDocumentStatusItem.document.id}`,
                                `${expandedSiteDocumentStatusItem.document.title} 문서 상태 요약`
                              )}
                            >
                              <div
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                {...projectOwnerItem(
                                  `site-document-status-expanded-status-${expandedSiteDocumentStatusItem.document.id}`,
                                  `${expandedSiteDocumentStatusItem.document.title} 문서 상태 값`
                                )}
                              >
                                <div
                                  className="text-[10px] font-medium text-slate-500"
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-status-label-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 문서 상태 라벨`
                                  )}
                                >
                                  문서 상태
                                </div>
                                <div
                                  className="mt-1 text-xs font-semibold text-slate-900"
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-status-value-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 문서 상태 값 텍스트`
                                  )}
                                >
                                  {getDocumentStatusLabel(expandedSiteDocumentStatusItem.document.status)}
                                </div>
                              </div>
                              <div
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                {...projectOwnerItem(
                                  `site-document-status-expanded-saved-at-${expandedSiteDocumentStatusItem.document.id}`,
                                  `${expandedSiteDocumentStatusItem.document.title} 최근 저장 값`
                                )}
                              >
                                <div
                                  className="text-[10px] font-medium text-slate-500"
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-saved-at-label-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 최근 저장 라벨`
                                  )}
                                >
                                  최근 저장
                                </div>
                                <div
                                  className="mt-1 text-xs font-semibold text-slate-900"
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-saved-at-value-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 최근 저장 값 텍스트`
                                  )}
                                >
                                  {expandedSiteDocumentStatusSavedAt}
                                </div>
                              </div>
                              <div
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                {...projectOwnerItem(
                                  `site-document-status-expanded-template-${expandedSiteDocumentStatusItem.document.id}`,
                                  `${expandedSiteDocumentStatusItem.document.title} 문서 양식 값`
                                )}
                              >
                                <div
                                  className="text-[10px] font-medium text-slate-500"
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-template-label-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 문서 양식 라벨`
                                  )}
                                >
                                  문서 양식
                                </div>
                                <div
                                  className="mt-1 truncate text-xs font-semibold text-slate-900"
                                  title={expandedSiteDocumentStatusTemplateLabel}
                                  {...projectOwnerItem(
                                    `site-document-status-expanded-template-value-${expandedSiteDocumentStatusItem.document.id}`,
                                    `${expandedSiteDocumentStatusItem.document.title} 문서 양식 값 텍스트`
                                  )}
                                >
                                  {expandedSiteDocumentStatusTemplateLabel}
                                </div>
                              </div>
                            </div>

                            <ProjectInfoList
                              items={
                                selectedDocumentId === expandedSiteDocumentStatusItem.document.id
                                  ? selectedDocumentDetailRows
                                  : []
                              }
                              emptyMessage="문서 상태를 확인할 항목이 없습니다."
                              minTableWidth={492}
                              ownerItemKey={`site-document-status-expanded-list-${expandedSiteDocumentStatusItem.document.id}`}
                              ownerItemName={`${expandedSiteDocumentStatusItem.document.title} 문서 상태 확장 목록`}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <EmptyState
                        title="선택된 현장이 없습니다."
                        description="현장 리스트에서 현장을 선택하면 문서 목록을 확인할 수 있습니다."
                        ownerItemKey="site-document-empty-state"
                      />
                    )}
                  </div>

	                  <div className="space-y-3 border-t border-slate-200 pt-6" {...projectOwnerItem('site-member-section', '구성원 섹션')}>
	                    <div className="space-y-1" {...projectOwnerItem('site-member-section-heading-group', '구성원 섹션 제목 묶음')}>
	                      <div className="text-sm font-semibold text-slate-900" {...projectOwnerItem('site-member-section-title', '구성원 섹션 제목')}>구성원</div>
	                      <p className="text-xs text-slate-500" {...projectOwnerItem('site-member-section-description', '구성원 섹션 설명')}>현장 접근 권한과 문서별 scope를 구성원별로 관리합니다.</p>
	                    </div>
	                    {selectedSite ? (
	                      <div className="space-y-5" {...projectOwnerItem('site-member-content', '구성원 내용')}>
	                        <div className="space-y-2" {...projectOwnerItem('site-member-access-section', '현장 접근 권한 섹션')}>
	                          <div className="flex items-center justify-between gap-3" {...projectOwnerItem('site-member-access-header', '현장 접근 권한 머리글')}>
	                            <div className="text-sm font-medium text-slate-800" {...projectOwnerItem('site-member-access-title', '현장 접근 권한 제목')}>현장 접근 권한</div>
	                            <div className="flex items-center gap-2" {...projectOwnerItem('site-member-access-actions', '현장 접근 권한 실행 영역')}>
	                              <span className="text-xs text-slate-500" {...projectOwnerItem('site-member-count', '현장 구성원 수')}>
	                                {loadingSiteMembers || loadingSiteDocumentMembers
	                                  ? '불러오는 중...'
	                                  : `${siteMembers.length}명`}
	                              </span>
	                              <Button
	                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => setShowAddSiteMemberForm((current) => !current)}
                                title="현장 구성원 추가"
                                aria-label="현장 구성원 추가"
                                {...projectOwnerItem('site-member-add-toggle-button', '현장 구성원 추가 열기 버튼')}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
	                            </div>
	                          </div>
	                          {showAddSiteMemberForm ? (
	                            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" {...projectOwnerItem('site-member-add-form-panel', '현장 구성원 추가 입력 패널')}>
	                              <div className="space-y-3" {...projectOwnerItem('site-member-add-form-basic-fields', '현장 구성원 추가 기본 입력 묶음')}>
	                                <div className="space-y-2" {...projectOwnerItem('site-member-add-name-field', '현장 구성원 이름 입력 항목')}>
	                                  <label className="text-xs font-medium text-slate-700" {...projectOwnerItem('site-member-add-name-label', '현장 구성원 이름 라벨')}>이름</label>
	                                  <Input
                                    value={siteMemberDisplayName}
                                    onChange={(event) => setSiteMemberDisplayName(event.target.value)}
                                    placeholder="이름이 있으면 입력"
                                    {...projectOwnerItem('site-member-add-name-input', '현장 구성원 이름 입력')}
                                  />
                                </div>
                                <div className="space-y-2" {...projectOwnerItem('site-member-add-phone-field', '현장 구성원 휴대폰 입력 항목')}>
                                  <label className="text-xs font-medium text-slate-700" {...projectOwnerItem('site-member-add-phone-label', '현장 구성원 휴대폰 라벨')}>휴대폰</label>
                                  <Input
                                    value={siteMemberPhoneNumber}
                                    onChange={(event) => setSiteMemberPhoneNumber(event.target.value)}
                                    placeholder="예: 01012345678"
                                    inputMode="tel"
                                    {...projectOwnerItem('site-member-add-phone-input', '현장 구성원 휴대폰 입력')}
                                  />
                                </div>
	                                <div className="space-y-2" {...projectOwnerItem('site-member-add-role-field', '현장 구성원 현장 권한 선택 항목')}>
	                                  <label className="text-xs font-medium text-slate-700" {...projectOwnerItem('site-member-add-role-label', '현장 구성원 현장 권한 라벨')}>현장 권한</label>
		                                  <select
		                                    value={siteMemberRole}
		                                    onChange={(event) => {
		                                      const nextRole = event.target.value as ManagedSiteMemberAccessRole;
		                                      setSiteMemberRole(nextRole);

		                                      if (nextRole !== 'participant') {
		                                        setSiteMemberDocumentIds([]);
		                                        setSiteMemberDocumentScopeKeys([]);
		                                      }
		                                    }}
		                                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
		                                    {...projectOwnerItem('site-member-add-role-select', '현장 구성원 현장 권한 선택')}
		                                  >
	                                    {SITE_MEMBER_ROLE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
	                                  </select>
	                                </div>
	                              </div>
		                              {siteMemberRole === 'participant' ? (
		                                <div className="space-y-3 border-t border-slate-200 pt-3" {...projectOwnerItem('site-member-add-document-access-section', '현장 구성원 문서 scope 추가 섹션')}>
		                                  <div className="space-y-2" {...projectOwnerItem('site-member-add-document-picker-field', '현장 구성원 문서 선택 항목')}>
		                                    <label className="text-xs font-medium text-slate-700" {...projectOwnerItem('site-member-add-document-picker-label', '현장 구성원 문서 선택 라벨')}>문서</label>
		                                    <MultiEntityPicker
		                                      values={siteMemberDocumentIds}
		                                      options={siteDocumentPickerOptions}
		                                      onChange={setSiteMemberDocumentIds}
		                                      placeholder="scope를 등록할 문서를 선택하세요"
		                                      searchPlaceholder="문서 목록 검색"
			                                      emptyMessage="권한을 줄 현장 문서가 없습니다."
			                                      allowClear
			                                      ownerItemKey="site-member-add-document-picker"
			                                      ownerItemName="현장 구성원 문서 scope 문서 선택기"
			                                      ownerItemAttributes={projectOwnerItem}
			                                    />
		                                  </div>
		                                  <div className="space-y-2" {...projectOwnerItem('site-member-add-document-scope-field', '현장 구성원 문서 scope 선택 항목')}>
		                                    <label className="text-xs font-medium text-slate-700" {...projectOwnerItem('site-member-add-document-scope-label', '현장 구성원 문서 scope 라벨')}>문서 scope</label>
		                                    <MultiEntityPicker
		                                      values={siteMemberDocumentScopeKeys}
		                                      options={siteMemberDocumentScopeOptions}
		                                      onChange={setSiteMemberDocumentScopeKeys}
		                                      placeholder={loadingTemplateScopeContexts ? 'scope 불러오는 중' : '등록할 scope를 선택하세요'}
		                                      searchPlaceholder="scope 검색"
			                                      emptyMessage="선택한 문서에 등록된 scope가 없습니다."
			                                      allowClear
			                                      ownerItemKey="site-member-add-document-scope-picker"
			                                      ownerItemName="현장 구성원 문서 scope 선택기"
			                                      ownerItemAttributes={projectOwnerItem}
			                                    />
		                                  </div>
		                                </div>
		                              ) : null}
	                              <div className="grid grid-cols-2 gap-2" {...projectOwnerItem('site-member-add-form-actions', '현장 구성원 추가 실행 버튼 영역')}>
	                                <Button
	                                  type="button"
                                  className="w-full"
                                  onClick={() => void handleInviteSiteMember()}
                                  disabled={invitingSiteMember}
                                  {...projectOwnerItem('site-member-add-submit-button', '현장 구성원 초대 버튼')}
                                >
                                  {invitingSiteMember ? '초대 중...' : '현장 구성원 초대'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => {
	                                    setShowAddSiteMemberForm(false);
	                                    setSiteMemberPhoneNumber('');
	                                    setSiteMemberDisplayName('');
	                                    setSiteMemberRole('participant');
	                                    setSiteMemberDocumentIds([]);
	                                    setSiteMemberDocumentScopeKeys([]);
	                                  }}
	                                  disabled={invitingSiteMember}
	                                  {...projectOwnerItem('site-member-add-cancel-button', '현장 구성원 추가 취소 버튼')}
	                                >
                                  취소
	                                </Button>
	                              </div>
	                            </div>
	                          ) : null}
	                          <ProjectInfoList
	                            items={siteMemberRows}
	                            variant="member"
	                            emptyMessage="아직 현장 접근 권한을 받은 구성원이 없습니다."
	                            maxBodyHeightClassName="max-h-[260px]"
	                            ownerItemKey="site-member-list"
	                            ownerItemName="현장 접근 권한 구성원 목록"
	                          />
	                          {expandedSiteMember ? (
	                            <div
                                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                                {...projectOwnerItem(
                                  `site-member-access-expanded-panel-${expandedSiteMember.membershipId}`,
                                  `${expandedSiteMemberLabel} 구성원 접근 상세 패널`
                                )}
                              >
	                              <div
                                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                                  {...projectOwnerItem(
                                    `site-member-access-expanded-panel-${expandedSiteMember.membershipId}-header`,
                                    `${expandedSiteMemberLabel} 구성원 접근 상세 머리글`
                                  )}
                                >
	                                <div
                                    className="text-sm font-semibold text-slate-900"
                                    {...projectOwnerItem(
                                      `site-member-access-expanded-panel-${expandedSiteMember.membershipId}-title`,
                                      `${expandedSiteMemberLabel} 구성원 접근 상세 제목`
                                    )}
                                  >
	                                  {expandedSiteMemberLabel} 접근 상세
	                                </div>
	                                <div
                                    className="text-xs text-slate-500"
                                    {...projectOwnerItem(
                                      `site-member-access-expanded-panel-${expandedSiteMember.membershipId}-scope-summary`,
                                      `${expandedSiteMemberLabel} 구성원 접근 범위 요약`
                                    )}
                                  >
		                                  {expandedSiteMemberHasFullDocumentAccess
		                                    ? '현장 전체 문서 scope 접근 가능'
		                                    : expandedMemberScopeDocumentCount > 0
		                                      ? `${expandedMemberScopeDocumentCount}개 문서 scope`
		                                      : '지정 scope 없음'}
	                                </div>
	                              </div>
                                <div
                                  className="grid gap-3 md:grid-cols-3"
                                  {...projectOwnerItem(
                                    `site-member-access-expanded-summary-grid-${expandedSiteMember.membershipId}`,
                                    `${expandedSiteMemberLabel} 구성원 접근 상세 요약 그리드`
                                  )}
                                >
                                  <div className="rounded-lg border border-slate-200 bg-white p-3" {...projectOwnerItem(`site-member-access-expanded-member-card-${expandedSiteMember.membershipId}`, `${expandedSiteMemberLabel} 구성원 기본 정보 카드`)}>
                                    <div className="text-[10px] font-medium text-slate-500" {...projectOwnerItem(`site-member-access-expanded-member-card-${expandedSiteMember.membershipId}-label`, `${expandedSiteMemberLabel} 구성원 이름 라벨`)}>구성원</div>
                                    <div className="mt-1 truncate text-xs font-semibold text-slate-900" title={expandedSiteMemberLabel} {...projectOwnerItem(`site-member-access-expanded-member-card-${expandedSiteMember.membershipId}-value`, `${expandedSiteMemberLabel} 구성원 이름 값`)}>
                                      {expandedSiteMemberLabel}
                                    </div>
                                    <div className="mt-1 truncate text-[10px] text-slate-500" title={formatPhoneNumber(expandedSiteMember.member.phoneNumber)} {...projectOwnerItem(`site-member-access-expanded-member-card-${expandedSiteMember.membershipId}-phone`, `${expandedSiteMemberLabel} 구성원 연락처 값`)}>
                                      {formatPhoneNumber(expandedSiteMember.member.phoneNumber)}
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-slate-200 bg-white p-3" {...projectOwnerItem(`site-member-access-expanded-verification-card-${expandedSiteMember.membershipId}`, `${expandedSiteMemberLabel} 구성원 인증 정보 카드`)}>
                                    <div className="text-[10px] font-medium text-slate-500" {...projectOwnerItem(`site-member-access-expanded-verification-card-${expandedSiteMember.membershipId}-label`, `${expandedSiteMemberLabel} 구성원 인증 라벨`)}>인증</div>
                                    <Badge
                                      variant={getMemberVerificationStatusVariant(expandedSiteMember.member.verificationStatus)}
                                      className="mt-1 px-2 py-0 text-[10px] leading-5"
                                      {...projectOwnerItem(`site-member-access-expanded-verification-card-${expandedSiteMember.membershipId}-status`, `${expandedSiteMemberLabel} 구성원 인증 상태`)}
                                    >
                                      {getMemberVerificationStatusLabel(expandedSiteMember.member.verificationStatus)}
                                    </Badge>
                                    <div className="mt-1 truncate text-[10px] text-slate-500" {...projectOwnerItem(`site-member-access-expanded-verification-card-${expandedSiteMember.membershipId}-last-verified-at`, `${expandedSiteMemberLabel} 구성원 최근 인증 값`)}>
                                      {expandedSiteMember.member.lastVerifiedAt
                                        ? formatDateTime(expandedSiteMember.member.lastVerifiedAt)
                                        : '인증 이력 없음'}
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-slate-200 bg-white p-3" {...projectOwnerItem(`site-member-access-expanded-scope-card-${expandedSiteMember.membershipId}`, `${expandedSiteMemberLabel} 구성원 접근 범위 카드`)}>
                                    <div className="text-[10px] font-medium text-slate-500" {...projectOwnerItem(`site-member-access-expanded-scope-card-${expandedSiteMember.membershipId}-label`, `${expandedSiteMemberLabel} 구성원 접근 범위 라벨`)}>범위</div>
	                                    <div className="mt-1 text-xs font-semibold text-slate-900" {...projectOwnerItem(`site-member-access-expanded-scope-card-${expandedSiteMember.membershipId}-value`, `${expandedSiteMemberLabel} 구성원 접근 범위 값`)}>
	                                      {expandedSiteMemberHasFullDocumentAccess ? '현장 전체' : 'scope별'}
	                                    </div>
                                    <div className="mt-1 truncate text-[10px] text-slate-500" {...projectOwnerItem(`site-member-access-expanded-scope-card-${expandedSiteMember.membershipId}-description`, `${expandedSiteMemberLabel} 구성원 접근 범위 설명`)}>
	                                      {expandedSiteMemberHasFullDocumentAccess
	                                        ? '현장 아래 모든 문서 scope 접근 가능'
	                                        : expandedMemberScopeDocumentCount > 0
	                                          ? `${expandedMemberScopeDocumentCount}개 문서 scope`
	                                          : '지정된 scope 없음'}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className="space-y-2"
                                  {...projectOwnerItem(
                                    `site-member-access-expanded-role-field-${expandedSiteMember.membershipId}`,
                                    `${expandedSiteMemberLabel} 구성원 현장 권한 선택 항목`
                                  )}
                                >
                                  <label
                                    className="text-xs font-medium text-slate-700"
                                    {...projectOwnerItem(
                                      `site-member-access-expanded-role-label-${expandedSiteMember.membershipId}`,
                                      `${expandedSiteMemberLabel} 구성원 현장 권한 라벨`
                                    )}
                                  >
                                    현장 권한
                                  </label>
                                  <div
                                    className="grid grid-cols-2 gap-2"
                                    {...projectOwnerItem(
                                      `site-member-access-expanded-role-button-group-${expandedSiteMember.membershipId}`,
                                      `${expandedSiteMemberLabel} 구성원 현장 권한 버튼 그룹`
                                    )}
                                  >
                                    {SITE_MEMBER_ROLE_OPTIONS.map((option) => {
                                      const selected = option.value === expandedSiteMemberManagedRole;

                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          disabled={
                                            expandedSiteMemberIsDeleting ||
                                            expandedSiteMemberIsUpdating ||
                                            selected
                                          }
                                          aria-pressed={selected}
                                          onClick={() =>
                                            void handleUpdateSiteMemberRole(
                                              expandedSiteMember,
                                              option.value
                                            )
                                          }
                                          className={cn(
                                            'inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70',
                                            selected
                                              ? 'border-slate-900 bg-slate-900 text-white'
                                              : 'border-slate-300 bg-white text-slate-700'
                                          )}
                                          {...projectOwnerItem(
                                            `site-member-access-expanded-role-${option.value}-button-${expandedSiteMember.membershipId}`,
                                            `${expandedSiteMemberLabel} 구성원 ${option.label} 권한 버튼`
                                          )}
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                {expandedSiteMemberCanManageDocuments ? (
                                  <div
                                    className="space-y-2"
                                    {...projectOwnerItem(
                                      `site-member-access-expanded-document-picker-field-${expandedSiteMember.membershipId}`,
                                      `${expandedSiteMemberLabel} 구성원 문서 scope 선택 항목`
                                    )}
                                  >
                                    <label
                                      className="text-xs font-medium text-slate-700"
                                      {...projectOwnerItem(
                                        `site-member-access-expanded-document-picker-label-${expandedSiteMember.membershipId}`,
                                        `${expandedSiteMemberLabel} 구성원 문서 scope 라벨`
                                      )}
                                    >
                                      문서 scope
                                    </label>
                                    <MemberDocumentAccessPicker
                                      membership={expandedSiteMember}
                                      memberLabel={expandedSiteMemberLabel}
                                      options={siteDocumentPickerOptions}
                                      scopeContextsByTemplateId={templateScopeContextsByTemplateId}
                                      savingMemberDocumentAccessKey={savingMemberDocumentAccessKey}
                                      onToggleScopeAccess={handleSaveMemberDocumentScopeAccess}
                                      onClearDocumentScopeAccess={handleClearMemberDocumentScopeAccess}
                                      ownerItemKey={`site-member-access-expanded-document-picker-${expandedSiteMember.membershipId}`}
                                      ownerItemName={`${expandedSiteMemberLabel} 구성원 문서 scope 선택기`}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"
                                    {...projectOwnerItem(
                                      `site-member-access-expanded-full-access-notice-${expandedSiteMember.membershipId}`,
                                      `${expandedSiteMemberLabel} 구성원 현장 전체 접근 안내`
                                    )}
                                  >
                                    현장 접근 권한으로 현장 아래 모든 문서에 접근할 수 있습니다.
                                  </div>
                                )}
                            </div>
                          ) : null}
	                        </div>
	                      </div>
	                    ) : (
                      <EmptyState
                        title="선택된 현장이 없습니다."
                        description="현장을 선택하면 구성원 권한을 확인할 수 있습니다."
                        ownerItemKey="site-member-empty-state"
                      />
                    )}
	                  </div>
		                </CardContent>
		              </Card>
          ) : null}
        </div>
		      </div>

      <div className="space-y-4" {...projectOwnerItem('document-output-section', '현장 문서 하단 출력 섹션')}>
        {renderProjectDocumentOutputTabs()}
      </div>

    </div>
  );
}
