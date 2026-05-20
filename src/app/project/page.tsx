'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import {
  CalendarDays,
  FileImage,
  FileStack,
  FolderKanban,
  Plus,
  RefreshCcw,
  Signature,
  Trash2,
  Users,
} from 'lucide-react';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../components/template/workspace/persistence/documentAttachmentClient';
import type { TemplateEditWorkspaceSaveDraftParams } from '../../components/template/workspace/types';
import { CanvasOwnedWorkspace } from '../canvas/ownerPolicy';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import { MejaiScrollTable, type MejaiScrollTableColumn, type MejaiScrollTableRow } from '../../components/ui/MejaiScrollTable';
import { MultiEntityPicker } from '../../components/ui/MultiEntityPicker';
import { buildDocumentHtmlContentKey } from '../../lib/documentCanvasHtml';
import {
  collapseDocumentCanvasWhitespace as collapseWhitespace,
  extractDocumentCanvasLabelValuesFromHtml as extractDocumentLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml as materializeDocumentHtml,
  stringifyDocumentValue,
} from '../../lib/documentCanvasState';
import type { DocumentCreateResult, DocumentDeleteResult, DocumentDetailResult, DocumentListItem } from '../../lib/documentDtos';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../lib/documentAttachmentValues';
import type {
  DocumentMemberAccessRole,
  DocumentMemberInviteResult,
  DocumentMemberRecordDto,
  MemberDispatchResultDto,
  MemberVerificationStatus,
  SiteMemberAccessRole,
  SiteMemberInviteResult,
  SiteMemberRecordDto,
} from '../../lib/memberAccessDtos';
import type { PhotoListItemDto } from '../../lib/photoLabelDtos';
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
type ProjectListAction = {
  title: string;
  ariaLabel: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};
type ProjectListRow = {
  key: string;
  label: string;
  statusLabel: string;
  statusVariant: ProjectListStatusVariant;
  summary: string;
  source: string;
  selected?: boolean;
  onClick?: () => void;
  action?: ProjectListAction;
};
type ApiErrorDebug = Partial<
  Record<'versions' | 'artifacts' | 'valueFiles' | 'photoEvidence' | 'templateLink' | 'valueEntries', string>
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
    throw new ApiFetchError(result?.message || '데이터 조회에 실패했습니다.', result?.debug || null);
  }

  return result.data as T;
};

const fetchSuccessDataWithTimeout = async <T,>(url: string, timeoutMs = 8000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const requestPromise = fetch(url, { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new ApiFetchError(result?.message || '데이터 조회에 실패했습니다.', result?.debug || null);
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

const SITE_MEMBER_ROLE_LABELS: Record<SiteMemberAccessRole, string> = {
  owner: '프로젝트 소유자',
  manager: '프로젝트 관리자',
  editor: '프로젝트 편집자',
  viewer: '프로젝트 열람자',
};

const DOCUMENT_MEMBER_ROLE_LABELS: Record<DocumentMemberAccessRole, string> = {
  editor: '문서 편집자',
  viewer: '문서 열람자',
  signer: '문서 서명자',
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

const SITE_MEMBER_ROLE_OPTIONS: Array<{ value: SiteMemberAccessRole; label: string }> = [
  { value: 'owner', label: '소유자' },
  { value: 'manager', label: '관리자' },
  { value: 'editor', label: '편집자' },
  { value: 'viewer', label: '열람자' },
];

const DOCUMENT_MEMBER_ROLE_OPTIONS: Array<{ value: DocumentMemberAccessRole; label: string }> = [
  { value: 'editor', label: '편집자' },
  { value: 'viewer', label: '열람자' },
  { value: 'signer', label: '서명자' },
];

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

const isConnectedDocumentInfoKey = (key: string): key is keyof typeof DOCUMENT_CONNECTED_INFO_LABELS =>
  key in DOCUMENT_CONNECTED_INFO_LABELS;

const getDocumentFieldLabel = (key: string) =>
  DOCUMENT_CONNECTED_INFO_LABELS[key as keyof typeof DOCUMENT_CONNECTED_INFO_LABELS] ||
  key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DOCUMENT_DETAIL_DEBUG_LABELS: Record<keyof ApiErrorDebug, string> = {
  versions: '버전 이력',
  artifacts: '출력본',
  valueFiles: '첨부 파일',
  photoEvidence: '사진 증빙 상태',
  templateLink: '템플릿 연결',
  valueEntries: '문서 값',
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
    return `${dispatch.message} 인증번호 ${dispatch.accessCodePreview}`;
  }

  return dispatch.message;
};

const buildProjectSelectionQueryKey = (siteId: string, documentId: string) =>
  `${siteId.trim()}::${documentId.trim()}`;

const getMemberAccessErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (message.includes('Invalid schema: member_access')) {
    return '구성원 기능을 쓰려면 docs/run-this-supabase-member-access-schema.sql을 적용하고, Supabase Data API 노출 스키마에 member_access를 추가해야 합니다.';
  }

  return message;
};

function RoleSegmentedButtons<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium transition-colors',
              selected
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            )}
            aria-pressed={selected}
          >
            {option.label}
          </button>
        );
      })}
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
      return '조회 실패';
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
    width: 76,
    minWidth: 72,
    maxWidth: 84,
    align: 'center',
  },
  {
    key: 'summary',
    label: '내용',
    width: 236,
    minWidth: 208,
    maxWidth: 280,
    clampLines: 2,
  },
  {
    key: 'source',
    label: '출처',
    width: 176,
    minWidth: 152,
    maxWidth: 220,
    clampLines: 2,
  },
];

const PROJECT_INFO_LIST_ACTION_COLUMN: MejaiScrollTableColumn = {
  key: 'action',
  label: '삭제',
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'shadow-[-1px_0_0_0_rgba(226,232,240,1)]',
  cellClassName: 'shadow-[-1px_0_0_0_rgba(226,232,240,1)]',
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-2">{description}</p>
      {href && actionLabel ? (
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href={href}>{actionLabel}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectInfoList({
  items,
  emptyMessage,
  maxBodyHeightClassName,
  minTableWidth,
}: {
  items: ProjectListRow[];
  emptyMessage?: string;
  maxBodyHeightClassName?: string;
  minTableWidth?: number;
}) {
  const hasActionColumn = items.some((item) => Boolean(item.action));
  const columns = hasActionColumn ? [...PROJECT_INFO_LIST_COLUMNS, PROJECT_INFO_LIST_ACTION_COLUMN] : PROJECT_INFO_LIST_COLUMNS;
  const rows: MejaiScrollTableRow[] = items.map((item) => ({
    key: item.key,
    selected: item.selected,
    onClick: item.onClick,
    ariaLabel: item.label,
    title: `${item.label} / ${item.summary}`,
    cells: {
      label: item.label,
      status: (
        <Badge variant={item.statusVariant} className="px-1.5 py-0 text-[10px] font-semibold leading-5">
          {item.statusLabel}
        </Badge>
      ),
      summary: item.summary,
      source: item.source,
      action: item.action ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          title={item.action.title}
          aria-label={item.action.ariaLabel}
          disabled={item.action.disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            item.action?.onClick(event);
          }}
        >
          {item.action.icon}
        </Button>
      ) : null,
    },
  }));

  return (
    <MejaiScrollTable
      columns={columns}
      rows={rows}
      emptyMessage={emptyMessage || '표시할 항목이 없습니다.'}
      maxHeightClassName={maxBodyHeightClassName}
      minTableWidth={minTableWidth || 662}
    />
  );
}

export default function ProjectPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSiteId = searchParams.get('projectId')?.trim() || searchParams.get('siteId')?.trim() || '';
  const requestedDocumentId = searchParams.get('documentId')?.trim() || '';
  const selectionQuerySyncRef = React.useRef<string | null>(null);
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [photos, setPhotos] = React.useState<PhotoListItemDto[]>([]);
  const [selectedSiteId, setSelectedSiteId] = React.useState('');
  const [selectedDocumentId, setSelectedDocumentId] = React.useState('');
  const [selectedPhotoId, setSelectedPhotoId] = React.useState('');
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [siteChecklist, setSiteChecklist] = React.useState<SiteChecklistSummaryDto | null>(null);
  const [showCreateSiteForm, setShowCreateSiteForm] = React.useState(false);
  const [newSiteName, setNewSiteName] = React.useState('');
  const [newSiteOpenDate, setNewSiteOpenDate] = React.useState(getTodayInputValue());
  const [newSiteTemplateIds, setNewSiteTemplateIds] = React.useState<string[]>([]);
  const [showAddSiteDocumentForm, setShowAddSiteDocumentForm] = React.useState(false);
  const [siteDocumentTemplateIds, setSiteDocumentTemplateIds] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loadingRoot, setLoadingRoot] = React.useState(false);
  const [loadingSiteData, setLoadingSiteData] = React.useState(false);
  const [loadingDocumentDetail, setLoadingDocumentDetail] = React.useState(false);
  const [creatingSite, setCreatingSite] = React.useState(false);
  const [addingSiteDocuments, setAddingSiteDocuments] = React.useState(false);
  const [deletingDocument, setDeletingDocument] = React.useState(false);
  const [loadingDeleteImpact, setLoadingDeleteImpact] = React.useState(false);
  const [deletingSite, setDeletingSite] = React.useState(false);
  const [deleteImpact, setDeleteImpact] = React.useState<SiteDeleteImpactDto | null>(null);
  const [selectedDocumentDetailError, setSelectedDocumentDetailError] = React.useState<string | null>(null);
  const [selectedDocumentDetailErrorDebug, setSelectedDocumentDetailErrorDebug] = React.useState<ApiErrorDebug | null>(null);
  const [siteMembers, setSiteMembers] = React.useState<SiteMemberRecordDto[]>([]);
  const [documentMembers, setDocumentMembers] = React.useState<DocumentMemberRecordDto[]>([]);
  const [loadingSiteMembers, setLoadingSiteMembers] = React.useState(false);
  const [loadingDocumentMembers, setLoadingDocumentMembers] = React.useState(false);
  const [showAddSiteMemberForm, setShowAddSiteMemberForm] = React.useState(false);
  const [showAddDocumentMemberForm, setShowAddDocumentMemberForm] = React.useState(false);
  const [siteMemberPhoneNumber, setSiteMemberPhoneNumber] = React.useState('');
  const [siteMemberDisplayName, setSiteMemberDisplayName] = React.useState('');
  const [siteMemberRole, setSiteMemberRole] = React.useState<SiteMemberAccessRole>('manager');
  const [documentMemberPhoneNumber, setDocumentMemberPhoneNumber] = React.useState('');
  const [documentMemberDisplayName, setDocumentMemberDisplayName] = React.useState('');
  const [documentMemberRole, setDocumentMemberRole] = React.useState<DocumentMemberAccessRole>('editor');
  const [invitingSiteMember, setInvitingSiteMember] = React.useState(false);
  const [invitingDocumentMember, setInvitingDocumentMember] = React.useState(false);
  const [deletingSiteMemberId, setDeletingSiteMemberId] = React.useState('');
  const [deletingDocumentMemberId, setDeletingDocumentMemberId] = React.useState('');

  React.useEffect(() => {
    const nextQueryKey = buildProjectSelectionQueryKey(requestedSiteId, requestedDocumentId);

    if (selectionQuerySyncRef.current === nextQueryKey) {
      return;
    }

    selectionQuerySyncRef.current = nextQueryKey;
    setSelectedSiteId(requestedSiteId);
    setSelectedDocumentId(requestedDocumentId);
  }, [requestedDocumentId, requestedSiteId]);

  React.useEffect(() => {
    const normalizedSiteId = selectedSiteId.trim();
    const normalizedDocumentId = selectedDocumentId.trim();
    const nextQueryKey = buildProjectSelectionQueryKey(normalizedSiteId, normalizedDocumentId);

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

  const draftDocumentCount = React.useMemo(
    () => documents.filter((item) => item.document.status === 'draft').length,
    [documents]
  );

  const activeDocumentCount = React.useMemo(
    () => documents.filter((item) => item.document.status === 'active').length,
    [documents]
  );

  const documentArtifactCount = React.useMemo(
    () => documents.reduce((sum, item) => sum + item.artifactCount, 0),
    [documents]
  );

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

  const selectedDocumentInitialDraft = React.useMemo<TemplateEditWorkspaceInitialDraft | null>(() => {
    if (!selectedDocumentId) {
      return null;
    }

    const materializedHtml = materializeDocumentHtml({
      linkedRenderHtml:
        selectedDocumentDetail?.linkedTemplate?.draftHtml || selectedDocumentDetail?.linkedTemplate?.renderSnapshotHtml,
      latestVersionHtml: selectedDocumentVersionSource?.htmlCanonical,
      labelValues: selectedDocumentLabelValues,
    });

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
    selectedDocumentDetail?.linkedTemplate?.draftHtml,
    selectedDocumentDetail?.linkedTemplate?.renderSnapshotHtml,
    selectedDocumentDetail?.templateLink?.lastSyncedAt,
    selectedDocumentDetail?.templateLink?.lastSyncedRevisionId,
    selectedDocumentDetail?.document.title,
    selectedDocumentId,
    selectedDocumentLabelValues,
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
        const mimeText = collapseWhitespace(file.mimeType || '');
        const uploadedAtText = formatDateTime(file.uploadedAt);

        if (mimeText) {
          segments.push(mimeText);
        }

        if (uploadedAtText !== '-') {
          segments.push(uploadedAtText);
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

    const detailFailureMessage = selectedDocumentDetailError?.trim() || '상세 응답을 받지 못했습니다.';
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
    const effectiveDocumentHtml = materializeDocumentHtml({
      linkedRenderHtml:
        selectedDocumentDetail?.linkedTemplate?.draftHtml || selectedDocumentDetail?.linkedTemplate?.renderSnapshotHtml,
      latestVersionHtml: latestVersion?.htmlCanonical,
      labelValues: selectedDocumentLabelValues,
    }).trim();
    const blockedByFailures = Object.entries(selectedDocumentQueryDebug || {})
      .filter((entry): entry is [keyof ApiErrorDebug, string] => Boolean(entry[1]?.trim()))
      .map(([key]) => DOCUMENT_DETAIL_DEBUG_LABELS[key]);
    const blockedSummary =
      blockedByFailures.length > 0
        ? `문서 상세 응답이 ${blockedByFailures.join(', ')} 문제로 중단되어 이 항목은 아직 확인할 수 없습니다.`
        : '문서 상세 응답이 중단되어 이 항목은 아직 확인할 수 없습니다.';

    return [
      {
        key: 'document-base',
        label: '문서 기본 정보',
        status: baseDocument ? 'loaded' : loadingDocumentDetail ? 'loading' : selectedDocumentDetailError ? 'error' : 'missing',
        summary: baseDocument
          ? `${baseDocument.title} · ${getDocumentStatusLabel(baseDocument.status)} · 현재 버전 ${baseDocument.currentVersionNumber || 0} · 생성일 ${formatDate(baseDocument.createdAt)}`
          : loadingDocumentDetail
            ? '문서 제목과 상태를 조회하는 중입니다.'
            : selectedDocumentDetailError
              ? detailFailureMessage
              : '문서 기본 정보가 없습니다.',
        source: '현장 문서 목록 또는 문서 상세 응답',
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
          ? `${selectedDocumentDetail?.linkedTemplate ? '템플릿 동기화 본문' : '문서 저장 본문'} · 마지막 저장 ${formatDateTime(latestVersion?.createdAt)}`
          : versionsIssue
            ? versionsIssue
            : loadingDocumentDetail
              ? '최신 본문 HTML을 조회하는 중입니다.'
              : selectedDocumentDetailError
                ? detailFailureMessage
                : '최신 본문 HTML이 없습니다.',
        source: selectedDocumentDetail?.linkedTemplate
          ? 'template draftHtml/renderSnapshotHtml + 문서 값'
          : '문서 목록 latestVersion 또는 문서 상세 응답',
      },
      {
        key: 'template-link',
        label: '템플릿 연결',
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
          ? templateLinkIssue
          : detailAvailable
            ? selectedDocumentDetail.linkedTemplate
              ? `${selectedDocumentDetail.linkedTemplate.templateName} · 리비전 ${selectedDocumentDetail.linkedTemplate.resolvedRevisionNumber || '-'} · 마지막 동기화 ${formatDateTime(selectedDocumentDetail.templateLink?.lastSyncedAt)}`
              : '템플릿과 연결되지 않은 독립 문서입니다.'
            : loadingDocumentDetail
              ? '연결된 템플릿과 동기화 기준을 확인하는 중입니다.'
            : selectedDocumentDetailError
                ? blockedSummary
                : '템플릿 연결 응답이 없습니다.',
        source: 'document_template_links + template_revisions',
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
          ? valueEntriesIssue
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
                ? '최신 버전의 기록 값을 조회하는 중입니다.'
                : selectedDocumentDetailError
                ? detailFailureMessage
                  : '기록 값 응답이 없습니다.',
        source: detailAvailable ? 'document_value_entries + 최신 버전 labelValues' : '최신 버전 labelValues',
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
          ? valueFilesIssue
          : detailAvailable
            ? selectedDocumentDetail.valueFiles.length > 0
              ? selectedDocumentAttachmentSummary
              : '연결된 첨부 파일이 없습니다.'
            : loadingDocumentDetail
              ? '첨부 파일 목록을 조회하는 중입니다.'
              : selectedDocumentDetailError
                ? blockedSummary
                : '첨부 파일 목록 응답이 없습니다.',
        source: '문서 상세 API valueFiles',
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
          ? photoEvidenceIssue
          : detailAvailable
            ? `${getPhotoEvidenceStatusLabel(selectedDocumentDetail.photoEvidence.status)} · 요구 ${selectedDocumentDetail.photoEvidence.requirementCount}건 · 충족 ${selectedDocumentDetail.photoEvidence.coveredCount}건 · 검토 필요 ${selectedDocumentDetail.photoEvidence.reviewNeededCount}건 · 누락 ${selectedDocumentDetail.photoEvidence.missingCount}건`
            : loadingDocumentDetail
              ? '사진 증빙 상태를 계산하는 중입니다.'
              : selectedDocumentDetailError
                ? blockedSummary
                : '사진 증빙 상태 응답이 없습니다.',
        source: '문서 상세 API photoEvidence',
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
          ? versionsIssue
          : detailAvailable
            ? selectedDocumentDetail.versions.length > 0
              ? selectedDocumentVersionHistorySummary
              : '버전 이력이 없습니다.'
            : loadingDocumentDetail
              ? '버전 이력을 조회하는 중입니다.'
              : selectedDocumentDetailError
                ? blockedSummary
                : '버전 이력 응답이 없습니다.',
        source: '문서 상세 API versions',
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
          ? artifactsIssue
          : selectedDocumentListItem
            ? selectedDocumentListItem.artifactCount > 0
              ? `${selectedDocumentListItem.artifactCount}건의 출력본이 등록되어 있습니다.`
              : '등록된 출력본이 없습니다.'
            : loadingDocumentDetail
              ? '출력본 수를 확인하는 중입니다.'
              : selectedDocumentDetailError
                ? detailFailureMessage
                : '출력본 수를 확인할 수 없습니다.',
        source: '문서 목록 artifactCount',
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
    selectedDocumentQueryDebug,
    selectedDocumentRecordedValueSummary,
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
              summary: `수동 ${selectedPhoto.manualLabels.length} · 추천 ${selectedPhoto.suggestedLabels.length}`,
              source: '사진 상태',
            },
            {
              key: 'photo-signature',
              label: '전자 서명',
              statusLabel: '값 없음',
              statusVariant: 'amber',
              summary: '연결된 전자 서명 데이터가 없습니다.',
              source: '서명 데이터 미연결',
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
                  ...selectedPhoto.manualLabels.map((label) => `수동:${label.labelKey}`),
                  ...selectedPhoto.suggestedLabels.map((label) => `추천:${label.labelKey}`),
                ].join(' · ') || '연결된 라벨이 없습니다.',
              source: '사진 라벨',
            },
          ]
        : [],
    [selectedPhoto]
  );

  const loadRootData = React.useCallback(async () => {
    setLoadingRoot(true);

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
      setLoadingRoot(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRootData();
  }, [loadRootData]);

  React.useEffect(() => {
    setSelectedSiteId((current) => {
      if (current && sites.some((site) => site.id === current)) {
        return current;
      }

      return sites[0]?.id || '';
    });
  }, [sites]);

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
      setPhotos([]);
      setSiteChecklist(null);
      setSelectedDocumentDetail(null);
      return;
    }

    let active = true;
    setSelectedDocumentDetail(null);

    const loadSiteData = async () => {
      setLoadingSiteData(true);

      try {
        const [nextDocuments, nextPhotos, nextChecklist] = await Promise.allSettled([
          fetchSuccessData<DocumentListItem[]>(`/api/documents?siteId=${encodeURIComponent(selectedSiteId)}`),
          fetchSuccessData<PhotoListItemDto[]>(`/api/photos?siteId=${encodeURIComponent(selectedSiteId)}`),
          fetchSuccessData<SiteChecklistSummaryDto>(`/api/sites/${selectedSiteId}/checklist`),
        ]);

        if (!active) return;

        setDocuments(nextDocuments.status === 'fulfilled' ? nextDocuments.value : []);
        setPhotos(nextPhotos.status === 'fulfilled' ? nextPhotos.value : []);
        setSiteChecklist(nextChecklist.status === 'fulfilled' ? nextChecklist.value : null);

        if (
          nextDocuments.status === 'rejected' ||
          nextPhotos.status === 'rejected' ||
          nextChecklist.status === 'rejected'
        ) {
          setMessage('일부 현장 데이터를 불러오지 못했습니다. 문서/사진/체크리스트 연결 상태를 확인해 주세요.');
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
    setSelectedDocumentId((current) => {
      if (current && documents.some((item) => item.document.id === current)) {
        return current;
      }

      return '';
    });
  }, [documents]);

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
    setSiteMemberRole('manager');
  }, [selectedSiteId]);

  React.useEffect(() => {
    setShowAddDocumentMemberForm(false);
    setDocumentMemberPhoneNumber('');
    setDocumentMemberDisplayName('');
    setDocumentMemberRole('editor');
  }, [selectedDocumentId]);

  const handleRefresh = () => {
    void loadRootData();
  };

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

  const loadDocumentMembers = React.useCallback(async (documentId: string) => {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      setDocumentMembers([]);
      return [];
    }

    const members = await fetchSuccessData<DocumentMemberRecordDto[]>(
      `/api/member-access/document-members?documentId=${encodeURIComponent(normalizedDocumentId)}`
    );
    const nextMembers = Array.isArray(members) ? members : [];
    setDocumentMembers(nextMembers);
    return nextMembers;
  }, []);

  const syncSiteDocuments = React.useCallback(async (siteId: string) => {
    const nextDocuments = await fetchSuccessData<DocumentListItem[]>(
      `/api/documents?siteId=${encodeURIComponent(siteId)}`
    );
    setDocuments(Array.isArray(nextDocuments) ? nextDocuments : []);
  }, []);

  React.useEffect(() => {
    if (!selectedSiteId) {
      setSiteMembers([]);
      return;
    }

    let active = true;
    setLoadingSiteMembers(true);

    void loadSiteMembers(selectedSiteId)
      .catch((error) => {
        if (active) {
          setSiteMembers([]);
          setMessage(getMemberAccessErrorMessage(error, '프로젝트 구성원 목록을 불러오지 못했습니다.'));
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
    if (!selectedDocumentId) {
      setDocumentMembers([]);
      setLoadingDocumentMembers(false);
      return;
    }

    let active = true;
    setLoadingDocumentMembers(true);

    void loadDocumentMembers(selectedDocumentId)
      .catch((error) => {
        if (active) {
          setDocumentMembers([]);
          setMessage(getMemberAccessErrorMessage(error, '문서 구성원 목록을 불러오지 못했습니다.'));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingDocumentMembers(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadDocumentMembers, selectedDocumentId]);

  const clearSelectedDocumentContext = React.useCallback(() => {
    setSelectedDocumentId('');
    setSelectedDocumentDetail(null);
    setSelectedDocumentDetailError(null);
    setSelectedDocumentDetailErrorDebug(null);
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

  const handleInviteSiteMember = React.useCallback(async () => {
    const normalizedSiteId = selectedSiteId.trim();
    const phoneNumber = siteMemberPhoneNumber.trim();

    if (!normalizedSiteId) {
      setMessage('구성원을 초대할 현장을 먼저 선택해 주세요.');
      return;
    }

    if (!phoneNumber) {
      setMessage('초대할 휴대폰 번호를 입력해 주세요.');
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
          displayName: siteMemberDisplayName.trim() || null,
          accessRole: siteMemberRole,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '프로젝트 구성원 초대에 실패했습니다.');
      }

      const invitedMember = result.data as SiteMemberInviteResult;
      await loadSiteMembers(normalizedSiteId);
      setShowAddSiteMemberForm(false);
      setSiteMemberPhoneNumber('');
      setSiteMemberDisplayName('');
      setSiteMemberRole('manager');
      setMessage(
        `${formatPhoneNumber(invitedMember.membership.member.phoneNumber)} 번호에 프로젝트 접근 권한을 등록했습니다. ${formatMemberDispatchMessage(invitedMember.dispatch)}`
      );
    } catch (error) {
      setMessage(getMemberAccessErrorMessage(error, '프로젝트 구성원 초대에 실패했습니다.'));
    } finally {
      setInvitingSiteMember(false);
    }
  }, [
    loadSiteMembers,
    selectedSiteId,
    siteMemberDisplayName,
    siteMemberPhoneNumber,
    siteMemberRole,
  ]);

  const handleInviteDocumentMember = React.useCallback(async () => {
    const normalizedDocumentId = selectedDocumentId.trim();
    const phoneNumber = documentMemberPhoneNumber.trim();

    if (!normalizedDocumentId) {
      setMessage('권한을 줄 현장 문서를 먼저 선택해 주세요.');
      return;
    }

    if (!phoneNumber) {
      setMessage('초대할 휴대폰 번호를 입력해 주세요.');
      return;
    }

    setInvitingDocumentMember(true);
    setMessage(null);

    try {
      const response = await fetch('/api/member-access/document-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: normalizedDocumentId,
          phoneNumber,
          displayName: documentMemberDisplayName.trim() || null,
          accessRole: documentMemberRole,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '문서 구성원 초대에 실패했습니다.');
      }

      const invitedMember = result.data as DocumentMemberInviteResult;
      await loadDocumentMembers(normalizedDocumentId);
      setShowAddDocumentMemberForm(false);
      setDocumentMemberPhoneNumber('');
      setDocumentMemberDisplayName('');
      setDocumentMemberRole('editor');
      setMessage(
        `${formatPhoneNumber(invitedMember.membership.member.phoneNumber)} 번호에 문서 접근 권한을 등록했습니다. ${formatMemberDispatchMessage(invitedMember.dispatch)}`
      );
    } catch (error) {
      setMessage(getMemberAccessErrorMessage(error, '문서 구성원 초대에 실패했습니다.'));
    } finally {
      setInvitingDocumentMember(false);
    }
  }, [
    documentMemberDisplayName,
    documentMemberPhoneNumber,
    documentMemberRole,
    loadDocumentMembers,
    selectedDocumentId,
  ]);

  const handleDeleteSiteMember = React.useCallback(
    async (membershipId: string, memberLabel: string) => {
      const normalizedMembershipId = membershipId.trim();

      if (!normalizedMembershipId || deletingSiteMemberId) {
        return;
      }

      const confirmed = window.confirm(`"${memberLabel}"의 프로젝트 접근 권한을 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      setDeletingSiteMemberId(normalizedMembershipId);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/member-access/site-members?membershipId=${encodeURIComponent(normalizedMembershipId)}`,
          { method: 'DELETE' }
        );
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || '프로젝트 구성원 권한 삭제에 실패했습니다.');
        }

        if (selectedSiteId) {
          await loadSiteMembers(selectedSiteId);
        }

        setMessage(`"${memberLabel}"의 프로젝트 접근 권한을 삭제했습니다.`);
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '프로젝트 구성원 권한 삭제에 실패했습니다.'));
      } finally {
        setDeletingSiteMemberId('');
      }
    },
    [deletingSiteMemberId, loadSiteMembers, selectedSiteId]
  );

  const handleDeleteDocumentMember = React.useCallback(
    async (membershipId: string, memberLabel: string) => {
      const normalizedMembershipId = membershipId.trim();

      if (!normalizedMembershipId || deletingDocumentMemberId) {
        return;
      }

      const confirmed = window.confirm(`"${memberLabel}"의 이 문서 접근 권한을 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      setDeletingDocumentMemberId(normalizedMembershipId);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/member-access/document-members?membershipId=${encodeURIComponent(normalizedMembershipId)}`,
          { method: 'DELETE' }
        );
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || '문서 구성원 권한 삭제에 실패했습니다.');
        }

        if (selectedDocumentId) {
          await loadDocumentMembers(selectedDocumentId);
        }

        setMessage(`"${memberLabel}"의 문서 접근 권한을 삭제했습니다.`);
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '문서 구성원 권한 삭제에 실패했습니다.'));
      } finally {
        setDeletingDocumentMemberId('');
      }
    },
    [deletingDocumentMemberId, loadDocumentMembers, selectedDocumentId]
  );

  const siteDocumentRows = React.useMemo<ProjectListRow[]>(
    () =>
      documents.map((item) => {
        const linkedTemplate = item.document.templateId
          ? templates.find((template) => template.id === item.document.templateId) || null
          : null;

        return {
          key: item.document.id,
          label: item.document.title,
          statusLabel: getDocumentStatusLabel(item.document.status),
          statusVariant: getDocumentStatusVariant(item.document.status),
          summary: [
            `버전 ${item.document.currentVersionNumber || 0}`,
            item.latestVersion?.createdAt ? `마지막 저장 ${formatDateTime(item.latestVersion.createdAt)}` : '저장 이력 없음',
          ].join(' · '),
          source: item.document.templateId
            ? (
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-slate-700" title={linkedTemplate?.templateName || '이름 없는 템플릿'}>
                    {linkedTemplate?.templateName || '이름 없는 템플릿'}
                  </div>
                  <div className="truncate text-[10px] text-slate-500" title={item.document.templateId}>
                    {item.document.templateId}
                  </div>
                </div>
              )
            : '연결된 템플릿 없음',
          selected: item.document.id === selectedDocumentId,
          onClick: () => handleSelectDocument(item.document.id),
          action: {
            title: '현장 문서 삭제',
            ariaLabel: `${item.document.title} 삭제`,
            icon: <Trash2 className="h-4 w-4" />,
            disabled: deletingDocument,
            onClick: () => {
              void handleDeleteDocument(item.document.id);
            },
          },
        };
      }),
    [deletingDocument, documents, handleDeleteDocument, handleSelectDocument, selectedDocumentId, templates]
  );

  const photoRows = React.useMemo<ProjectListRow[]>(
    () =>
      photos.map((item) => ({
        key: item.photo.id,
        label: item.photo.photoTitle || '제목 없는 사진',
        statusLabel: getPhotoStatusLabel(item.photo.status),
        statusVariant: getPhotoStatusVariant(item.photo.status),
        summary: [
          item.photo.capturedAt ? `촬영 ${formatDateTime(item.photo.capturedAt)}` : '촬영 시각 없음',
          `수동 ${item.manualLabels.length} · 추천 ${item.suggestedLabels.length}`,
        ].join(' · '),
        source: '현장 사진·서명',
        selected: item.photo.id === selectedPhotoId,
        onClick: () => handleSelectPhoto(item.photo.id),
      })),
    [handleSelectPhoto, photos, selectedPhotoId]
  );

  const siteMemberRows = React.useMemo<ProjectListRow[]>(
    () =>
      siteMembers.map((membership) => {
        const memberLabel = membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber);

        return {
          key: membership.membershipId,
          label: memberLabel,
          statusLabel: getMemberVerificationStatusLabel(membership.member.verificationStatus),
          statusVariant: getMemberVerificationStatusVariant(membership.member.verificationStatus),
          summary: `${formatPhoneNumber(membership.member.phoneNumber)} · ${SITE_MEMBER_ROLE_LABELS[membership.accessRole]}${
            membership.member.lastVerifiedAt ? ` · 마지막 인증 ${formatDateTime(membership.member.lastVerifiedAt)}` : ''
          }`,
          source: '프로젝트 접근 권한',
          action: {
            title: '프로젝트 접근 권한 삭제',
            ariaLabel: `${memberLabel} 프로젝트 접근 권한 삭제`,
            icon: <Trash2 className="h-4 w-4" />,
            disabled: deletingSiteMemberId === membership.membershipId,
            onClick: () => {
              void handleDeleteSiteMember(membership.membershipId, memberLabel);
            },
          },
        };
      }),
    [deletingSiteMemberId, handleDeleteSiteMember, siteMembers]
  );

  const documentMemberRows = React.useMemo<ProjectListRow[]>(
    () =>
      documentMembers.map((membership) => {
        const memberLabel = membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber);

        return {
          key: membership.membershipId,
          label: memberLabel,
          statusLabel: getMemberVerificationStatusLabel(membership.member.verificationStatus),
          statusVariant: getMemberVerificationStatusVariant(membership.member.verificationStatus),
          summary: `${formatPhoneNumber(membership.member.phoneNumber)} · ${DOCUMENT_MEMBER_ROLE_LABELS[membership.accessRole]}${
            membership.member.lastVerifiedAt ? ` · 마지막 인증 ${formatDateTime(membership.member.lastVerifiedAt)}` : ''
          }`,
          source: '선택 문서 접근 권한',
          action: {
            title: '문서 접근 권한 삭제',
            ariaLabel: `${memberLabel} 문서 접근 권한 삭제`,
            icon: <Trash2 className="h-4 w-4" />,
            disabled: deletingDocumentMemberId === membership.membershipId,
            onClick: () => {
              void handleDeleteDocumentMember(membership.membershipId, memberLabel);
            },
          },
        };
      }),
    [deletingDocumentMemberId, documentMembers, handleDeleteDocumentMember]
  );

  const quickCheckRows = React.useMemo<ProjectListRow[]>(
    () => [
      {
        key: 'open-date',
        label: '공사 시작일',
        statusLabel: selectedSite?.openDate ? '정상' : '값 없음',
        statusVariant: selectedSite?.openDate ? 'green' : 'amber',
        summary: selectedSite ? formatDate(selectedSite.openDate) : '-',
        source: '현장 선택 정보',
      },
      {
        key: 'document-count',
        label: '현장 문서',
        statusLabel: documents.length > 0 ? '정상' : '값 없음',
        statusVariant: documents.length > 0 ? 'green' : 'amber',
        summary: `${documents.length}건`,
        source: '현장 문서 목록',
      },
      {
        key: 'draft-count',
        label: '작성 중 문서',
        statusLabel: draftDocumentCount > 0 ? '정상' : '값 없음',
        statusVariant: draftDocumentCount > 0 ? 'green' : 'slate',
        summary: `${draftDocumentCount}건`,
        source: '현장 문서 목록',
      },
      {
        key: 'active-count',
        label: '사용 중 문서',
        statusLabel: activeDocumentCount > 0 ? '정상' : '값 없음',
        statusVariant: activeDocumentCount > 0 ? 'green' : 'slate',
        summary: `${activeDocumentCount}건`,
        source: '현장 문서 목록',
      },
      {
        key: 'artifact-count',
        label: '출력본',
        statusLabel: documentArtifactCount > 0 ? '정상' : '값 없음',
        statusVariant: documentArtifactCount > 0 ? 'green' : 'slate',
        summary: `${documentArtifactCount}건`,
        source: '문서 출력본 집계',
      },
      {
        key: 'photo-covered',
        label: '사진 증빙 완료',
        statusLabel: (siteChecklist?.photoCoveredCount || 0) > 0 ? '정상' : '값 없음',
        statusVariant: (siteChecklist?.photoCoveredCount || 0) > 0 ? 'green' : 'slate',
        summary: `${siteChecklist?.photoCoveredCount || 0}건`,
        source: '체크리스트 요약',
      },
      {
        key: 'photo-review',
        label: '사진 검토 필요',
        statusLabel: (siteChecklist?.photoReviewNeededCount || 0) > 0 ? '검토 필요' : '값 없음',
        statusVariant: (siteChecklist?.photoReviewNeededCount || 0) > 0 ? 'amber' : 'slate',
        summary: `${siteChecklist?.photoReviewNeededCount || 0}건`,
        source: '체크리스트 요약',
      },
      {
        key: 'photo-missing',
        label: '사진 증빙 누락',
        statusLabel: (siteChecklist?.photoMissingCount || 0) > 0 ? '누락' : '정상',
        statusVariant: (siteChecklist?.photoMissingCount || 0) > 0 ? 'red' : 'green',
        summary: `${siteChecklist?.photoMissingCount || 0}건`,
        source: '체크리스트 요약',
      },
    ],
    [
      activeDocumentCount,
      documents.length,
      documentArtifactCount,
      draftDocumentCount,
      selectedSite,
      siteChecklist?.photoCoveredCount,
      siteChecklist?.photoMissingCount,
      siteChecklist?.photoReviewNeededCount,
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
      clearSelectedDocumentContext();
      setDocuments([]);
      setPhotos([]);
      setSiteChecklist(null);

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

  const hasSelectedDocumentContext = Boolean(selectedDocumentId || loadingDocumentDetail || selectedDocumentListItem);
  const selectedDetailPanel =
    selectedPhotoId && selectedPhoto
      ? 'photo'
      : hasSelectedDocumentContext
        ? 'document'
        : 'summary';

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">PROJECT-MGMT-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">현장 관리</h1>
          <p className="max-w-4xl text-sm text-slate-600">
            현장 생성은 `현장 이름`, `공사 시작일`, `현장에서 사용할 문서`만 받습니다. 이 화면에서는 현장 문서에 무엇을
            기록했는지, 어떤 파일이 붙어 있는지, 사진 증빙이 충분한지만 바로 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCcw className="h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <Card className="min-w-0 border-slate-200">
          <CardHeader>
            <CardTitle>1. 현장 선택과 기본 정보</CardTitle>
            <CardDescription>
              임의 운영 메타는 제거했습니다. 이 영역에는 실제로 사용하는 현장 생성 값과 조회 값만 보여줍니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant={showCreateSiteForm ? 'outline' : 'default'}
              onClick={() => setShowCreateSiteForm((previous) => !previous)}
              className="h-14 w-full rounded-xl"
            >
              {showCreateSiteForm ? '입력 닫기' : '새 현장 만들기'}
            </Button>

            {showCreateSiteForm ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">현장 이름</label>
                      <Input
                        value={newSiteName}
                        onChange={(event) => setNewSiteName(event.target.value)}
                        placeholder="예: 서울 A현장, 대구 침산 더샵 101동"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">공사 시작일</label>
                      <Input
                        type="date"
                        value={newSiteOpenDate}
                        onChange={(event) => setNewSiteOpenDate(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-800">현장에서 사용할 문서</label>
                      <p className="text-xs text-slate-500">
                        여기서 고른 문서만 이 현장의 문서 목록으로 준비됩니다.
                      </p>
                    </div>
                    {templates.length > 0 ? (
                      <div className="space-y-2">
                        <MultiEntityPicker
                          values={newSiteTemplateIds}
                          options={newSiteTemplateOptions}
                          onChange={setNewSiteTemplateIds}
                          placeholder="현장에서 시작할 문서를 선택하세요"
                          searchPlaceholder="문서 목록 검색"
                          emptyMessage="선택 가능한 문서 양식이 없습니다."
                          allowClear
                        />
                        <div className="text-xs text-slate-500">
                          전체 {templates.length}개 중 {selectedNewSiteTemplates.length}개 선택됨. 필수: 최소 1건
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                        <div>먼저 문서 양식 화면에서 현장 문서를 시작할 양식을 만들어 주세요.</div>
                        <div className="mt-4">
                          <Button variant="outline" asChild>
                            <Link href="/templates">문서 양식 화면 열기</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleCreateSite} disabled={creatingSite}>
                      {creatingSite ? '현장 만드는 중...' : '현장 만들기'}
                    </Button>
                    <Button variant="outline" onClick={handleResetCreateSiteForm} disabled={creatingSite}>
                      입력 비우기
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {showCreateSiteForm ? null : (
              <>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-800">이미 만든 현장 보기</label>
                  <EntityPicker
                    value={selectedSiteId}
                    options={siteOptions}
                    onChange={setSelectedSiteId}
                    placeholder="현장을 선택하세요"
                    emptyMessage="선택 가능한 현장이 없습니다."
                    disabled={deletingSite}
                    onDeleteOption={(option) => {
                      void handlePrepareDeleteSite(option.id);
                    }}
                    deleteOptionLabel="현장 삭제"
                  />

                  {loadingDeleteImpact ? (
                    <div className="text-xs text-slate-500">삭제 시 함께 지워질 항목을 확인하는 중입니다.</div>
                  ) : null}

                  {deleteImpact ? (
                    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">
                          "{deleteImpact.site.siteName}" 현장을 삭제하면 아래 항목도 함께 삭제됩니다.
                        </div>
                        <p className="text-sm text-slate-600">
                          삭제 후 되돌릴 수 없습니다. 항목을 확인한 뒤 정말 삭제할지 한 번 더 선택해 주세요.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {deleteImpact.items.map((item) => (
                          <div key={item.key} className="rounded-lg border border-rose-100 bg-white px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900">{item.label}</div>
                                {item.description ? (
                                  <div className="mt-1 text-xs leading-5 text-slate-600">{item.description}</div>
                                ) : null}
                              </div>
                              <Badge variant="red" className="shrink-0">
                                {item.count}건
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="destructive" onClick={handleDeleteSite} disabled={deletingSite}>
                          {deletingSite ? '삭제하는 중...' : '정말 삭제'}
                        </Button>
                        <Button variant="outline" onClick={handleCancelDeleteSite} disabled={deletingSite}>
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {selectedSite ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">현장 이름</label>
                      <Input value={selectedSite.siteName} readOnly className="bg-slate-50 text-slate-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">공사 시작일</label>
                      <Input value={selectedSite.openDate} readOnly className="bg-slate-50 text-slate-500" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-slate-800">현장 문서</label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">전체 {documents.length}건</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => setShowAddSiteDocumentForm((previous) => !previous)}
                            title="현장 문서 추가"
                            aria-label="현장 문서 추가"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {showAddSiteDocumentForm ? (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button onClick={handleAddSiteDocuments} disabled={addingSiteDocuments}>
                                  {addingSiteDocuments ? '추가하는 중...' : '현장 문서 추가'}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setShowAddSiteDocumentForm(false);
                                    setSiteDocumentTemplateIds([]);
                                  }}
                                  disabled={addingSiteDocuments}
                                >
                                  취소
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-slate-500">추가할 수 있는 문서 양식이 없습니다.</div>
                          )}
                        </div>
                      ) : null}
                      <ProjectInfoList
                        items={siteDocumentRows}
                        emptyMessage="아직 만든 현장 문서가 없습니다."
                        maxBodyHeightClassName="max-h-[152px]"
                      />
                    </div>
                    {hasSelectedDocumentContext ? (
                      <>
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-medium text-slate-800">사진·서명</label>
                            <span className="text-xs text-slate-500">사진 {photos.length}건 · 서명 데이터 없음</span>
                          </div>
                          <ProjectInfoList
                            items={photoRows}
                            emptyMessage="등록된 사진이 없습니다. 전자 서명 데이터도 아직 연결되지 않았습니다."
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-medium text-slate-800">구성원</label>
                            <span className="text-xs text-slate-500">번호 초대 후 인증번호로 접근합니다.</span>
                          </div>
                          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-slate-800">프로젝트 접근 권한</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">
                                    {loadingSiteMembers ? '불러오는 중...' : `${siteMembers.length}명`}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg"
                                    onClick={() => setShowAddSiteMemberForm((current) => !current)}
                                    title="프로젝트 구성원 추가"
                                    aria-label="프로젝트 구성원 추가"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {showAddSiteMemberForm ? (
                                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-slate-700">이름</label>
                                      <Input
                                        value={siteMemberDisplayName}
                                        onChange={(event) => setSiteMemberDisplayName(event.target.value)}
                                        placeholder="이름이 있으면 입력"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-slate-700">휴대폰 번호</label>
                                      <Input
                                        value={siteMemberPhoneNumber}
                                        onChange={(event) => setSiteMemberPhoneNumber(event.target.value)}
                                        placeholder="예: 01012345678"
                                        inputMode="tel"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-700">프로젝트 권한</label>
                                    <RoleSegmentedButtons
                                      value={siteMemberRole}
                                      options={SITE_MEMBER_ROLE_OPTIONS}
                                      onChange={(value) => setSiteMemberRole(value)}
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button type="button" onClick={() => void handleInviteSiteMember()} disabled={invitingSiteMember}>
                                      {invitingSiteMember ? '초대 중...' : '프로젝트 구성원 초대'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setShowAddSiteMemberForm(false);
                                        setSiteMemberPhoneNumber('');
                                        setSiteMemberDisplayName('');
                                        setSiteMemberRole('manager');
                                      }}
                                      disabled={invitingSiteMember}
                                    >
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                              <ProjectInfoList
                                items={siteMemberRows}
                                emptyMessage="아직 프로젝트 접근 권한을 받은 구성원이 없습니다."
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-slate-800">선택 문서 접근 권한</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">
                                    {loadingDocumentMembers ? '불러오는 중...' : `${documentMembers.length}명`}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg"
                                    onClick={() => setShowAddDocumentMemberForm((current) => !current)}
                                    title="문서 구성원 추가"
                                    aria-label="문서 구성원 추가"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {showAddDocumentMemberForm ? (
                                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-slate-700">이름</label>
                                      <Input
                                        value={documentMemberDisplayName}
                                        onChange={(event) => setDocumentMemberDisplayName(event.target.value)}
                                        placeholder="이름이 있으면 입력"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-slate-700">휴대폰 번호</label>
                                      <Input
                                        value={documentMemberPhoneNumber}
                                        onChange={(event) => setDocumentMemberPhoneNumber(event.target.value)}
                                        placeholder="예: 01012345678"
                                        inputMode="tel"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-700">문서 권한</label>
                                    <RoleSegmentedButtons
                                      value={documentMemberRole}
                                      options={DOCUMENT_MEMBER_ROLE_OPTIONS}
                                      onChange={(value) => setDocumentMemberRole(value)}
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      onClick={() => void handleInviteDocumentMember()}
                                      disabled={invitingDocumentMember}
                                    >
                                      {invitingDocumentMember ? '초대 중...' : '문서 구성원 초대'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setShowAddDocumentMemberForm(false);
                                        setDocumentMemberPhoneNumber('');
                                        setDocumentMemberDisplayName('');
                                        setDocumentMemberRole('editor');
                                      }}
                                      disabled={invitingDocumentMember}
                                    >
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                              <ProjectInfoList
                                items={documentMemberRows}
                                emptyMessage="아직 이 문서에만 권한을 받은 구성원이 없습니다."
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="선택된 현장이 없습니다."
                    description="새 현장을 만들거나 이미 만든 현장을 선택하면 이 자리에서 현장 문서, 사진·서명, 구성원 정보를 바로 관리할 수 있습니다."
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          {showCreateSiteForm ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>2. 운영 요약</CardTitle>
                <CardDescription>새 현장 입력 중에는 기존 현장 정보와 상세를 숨깁니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="새 현장을 입력하는 중입니다."
                  description="현장을 만든 뒤에 기존 현장 선택, 문서 상세, 사진·서명 상세가 다시 표시됩니다."
                />
              </CardContent>
            </Card>
          ) : selectedDetailPanel === 'document' ? (
            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>선택한 문서 상세</CardTitle>
                  <CardDescription>문서에 기록된 값, 연결된 파일, 현재 현장 상태만 보여줍니다.</CardDescription>
                </div>
                {selectedDocumentId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      void handleDeleteDocument(
                        selectedDocumentListItem?.document.id || selectedDocumentDetail?.document.id || selectedDocumentId
                      );
                    }}
                    disabled={deletingDocument}
                    className="shrink-0"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    삭제
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingDocumentDetail ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
                      {selectedDocumentListItem
                        ? `"${selectedDocumentListItem.document.title}" 문서 정보를 불러오는 중입니다. 아래 항목에서 어떤 값을 기다리는지 확인할 수 있습니다.`
                        : '문서 정보를 불러오는 중입니다.'}
                    </div>
                    <ProjectInfoList items={selectedDocumentDetailRows} />
                  </div>
                ) : selectedDocumentDetail ? (
                  <ProjectInfoList items={selectedDocumentDetailRows} />
                ) : selectedDocumentListItem ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                      문서 편집은 계속할 수 있지만, 상세 정보 일부를 불러오지 못했습니다.
                      {selectedDocumentDetailError ? ` 오류: ${selectedDocumentDetailError}` : ''}
                    </div>
                    <ProjectInfoList items={selectedDocumentDetailRows} />
                  </div>
                ) : (
                  <EmptyState
                    title="선택된 문서가 없습니다."
                    description="왼쪽의 현장 문서에서 문서를 선택하면 기록 값과 첨부 파일, 사진 증빙 상태를 함께 보여줍니다."
                  />
                )}
              </CardContent>
            </Card>
          ) : selectedDetailPanel === 'photo' && selectedPhoto ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>선택한 사진·서명 상세</CardTitle>
                <CardDescription>선택한 사진 정보와 현재 연결 상태를 같은 자리에서 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {selectedPhoto.photo.photoUrl ? (
                      <img
                        src={selectedPhoto.photo.photoUrl}
                        alt={selectedPhoto.photo.photoTitle || '현장 사진'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-slate-400">
                        미리보기 없음
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <ProjectInfoList items={selectedPhotoDetailRows} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>2. 운영 요약</CardTitle>
                  <CardDescription>선택된 현장 기준의 실제 문서·사진·체크리스트 데이터만 집계합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricCard
                      icon={FileStack}
                      label="현장 문서"
                      value={String(documents.length)}
                      description="현재 선택한 현장에 등록된 문서"
                    />
                    <MetricCard
                      icon={FolderKanban}
                      label="작성 중 문서"
                      value={String(draftDocumentCount)}
                      description="아직 작성이 진행 중인 문서"
                    />
                    <MetricCard
                      icon={Users}
                      label="출력본"
                      value={String(documentArtifactCount)}
                      description="PDF 등으로 만들어 둔 문서 출력본"
                    />
                    <MetricCard
                      icon={FileImage}
                      label="사진"
                      value={String(photos.length)}
                      description="현재 선택한 현장의 증빙 사진"
                    />
                    <MetricCard
                      icon={CalendarDays}
                      label="사진 요구"
                      value={String(siteChecklist?.photoRequirementCount || 0)}
                      description="체크리스트 기준으로 필요한 사진 수"
                    />
                    <MetricCard
                      icon={Signature}
                      label="사진 누락"
                      value={String(siteChecklist?.photoMissingCount || 0)}
                      description="아직 충족되지 않은 사진 증빙 수"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>바로 확인할 항목</CardTitle>
                <CardDescription>실제 조회 가능한 값만 요약합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectInfoList items={quickCheckRows} />
              </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {showCreateSiteForm ? (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <EmptyState
                title="새 현장을 입력하는 중입니다."
                description="생성을 마치거나 입력을 닫으면 기존 현장 문서 편집 캔버스가 다시 표시됩니다."
              />
            </CardContent>
          </Card>
        ) : selectedDocumentInitialDraft ? (
          <CanvasOwnedWorkspace
            surface="project"
            key={selectedDocumentInitialDraft.draftKey}
            initialDraft={selectedDocumentInitialDraft}
            workspaceMode="document"
            hideHeader
            hidePersistencePanel
            nameFieldLabel="문서 이름:"
            saveButtonLabel="문서 저장"
            templateNameReadOnly
            documentAttachmentApiPath={`/api/documents/${encodeURIComponent(
              selectedDocumentListItem?.document.id || selectedDocumentDetail?.document.id || selectedDocumentId
            )}/attachments`}
            onSaveDraftHtml={handleSaveDocumentDraft}
            suppressInitialDraftLoadedMessage
          />
        ) : selectedDocumentListItem ? (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <EmptyState
                title="현재 문서에 편집할 본문이 없습니다."
                description="이 문서의 최신 본문이 없어서 상자 편집 캔버스를 열 수 없습니다."
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <EmptyState
                title="작업할 현장 문서를 먼저 고르세요."
                description="위의 현장 문서에서 문서를 선택하면 이 페이지 하단에서 바로 편집할 수 있습니다."
              />
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}
