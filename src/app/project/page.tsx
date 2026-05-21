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
  Link2,
  Plus,
  RefreshCcw,
  Signature,
  Trash2,
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
import { formatMemberAccessErrorMessage as getMemberAccessErrorMessage } from '../../lib/memberAccessErrors';
import type {
  DocumentMemberAccessRole,
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
  completedIcon?: React.ReactNode;
  completed?: boolean;
  feedbackKey?: string;
  disabled?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | boolean | Promise<void | boolean>;
};
type ProjectListRow = {
  key: string;
  label: string;
  statusLabel: string;
  statusVariant: ProjectListStatusVariant;
  summary: string;
  source: React.ReactNode;
  contact?: string;
  roleLabel?: string;
  roleContent?: React.ReactNode;
  documentsContent?: React.ReactNode;
  lastVerifiedAt?: string;
  savedAt?: string;
  templateLabel?: React.ReactNode;
  capturedAt?: string;
  evidenceLabel?: string;
  selected?: boolean;
  onClick?: () => void;
  documentLinkAction?: ProjectListAction;
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
type ManagedSiteMemberAccessRole = 'owner' | 'manager' | 'participant';
type ManagedDocumentMemberAccessRole = 'editor' | 'viewer';
type MemberDocumentAccessDraft = {
  documentIds: string[];
  accessRole: ManagedDocumentMemberAccessRole;
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

const SITE_MEMBER_ROLE_LABELS: Record<SiteMemberAccessRole, string> = {
  owner: '소유자',
  manager: '관리자',
  participant: '참여자',
  editor: '참여자',
  viewer: '참여자',
};

const DOCUMENT_MEMBER_ROLE_LABELS: Record<DocumentMemberAccessRole, string> = {
  editor: '편집',
  viewer: '보기',
  signer: '보기',
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
  { value: 'owner', label: '소유자' },
  { value: 'manager', label: '관리자' },
  { value: 'participant', label: '참여자' },
];

const DOCUMENT_MEMBER_ROLE_OPTIONS: Array<{ value: ManagedDocumentMemberAccessRole; label: string }> = [
  { value: 'viewer', label: '보기' },
  { value: 'editor', label: '편집' },
];

const getManagedSiteMemberRole = (role: SiteMemberAccessRole): ManagedSiteMemberAccessRole => {
  if (role === 'owner' || role === 'manager') {
    return role;
  }

  return 'participant';
};

const hasFullDocumentAccessBySiteRole = (role: SiteMemberAccessRole | ManagedSiteMemberAccessRole) => {
  const managedRole = getManagedSiteMemberRole(role);
  return managedRole === 'owner' || managedRole === 'manager';
};

const getManagedDocumentMemberRole = (role: DocumentMemberAccessRole): ManagedDocumentMemberAccessRole =>
  role === 'editor' ? 'editor' : 'viewer';

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
    return `${dispatch.message} 인증 코드 ${dispatch.accessCodePreview}`;
  }

  return dispatch.message;
};

const buildProjectSelectionQueryKey = (siteId: string, documentId: string) =>
  `${siteId.trim()}::${documentId.trim()}`;

const buildMemberAccessDocumentLinkUrl = (documentId: string) => {
  const normalizedDocumentId = documentId.trim();

  return `${window.location.origin}/member-access/document/${encodeURIComponent(normalizedDocumentId)}`;
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
              'inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium',
              selected
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700'
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
    width: 76,
    minWidth: 72,
    maxWidth: 84,
    align: 'center',
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
    width: 190,
    minWidth: 164,
    maxWidth: 240,
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
    key: 'savedAt',
    label: '최근 저장',
    width: 146,
    minWidth: 128,
    maxWidth: 176,
    clampLines: 1,
  },
  {
    key: 'template',
    label: '문서 양식',
    width: 172,
    minWidth: 144,
    maxWidth: 220,
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
    key: 'role',
    label: '권한',
    width: 112,
    minWidth: 96,
    maxWidth: 136,
    clampLines: 1,
  },
  {
    key: 'documents',
    label: '문서',
    width: 112,
    minWidth: 96,
    maxWidth: 148,
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
    key: 'lastVerifiedAt',
    label: '최근 인증',
    width: 128,
    minWidth: 112,
    maxWidth: 156,
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
    label: '문서 권한',
    width: 180,
    minWidth: 156,
    maxWidth: 220,
    clampLines: 1,
  },
];

const PROJECT_INFO_LIST_DOCUMENT_LINK_COLUMN: MejaiScrollTableColumn = {
  key: 'documentLinkAction',
  label: '문서 링크',
  width: 72,
  minWidth: 72,
  maxWidth: 72,
  align: 'center',
  sticky: 'right',
  clampLines: 1,
  headerClassName: 'border-l border-slate-200',
  cellClassName: 'border-l border-slate-200',
};

const PROJECT_INFO_LIST_ACTION_COLUMN: MejaiScrollTableColumn = {
  key: 'action',
  label: '삭제',
  width: 48,
  minWidth: 48,
  maxWidth: 48,
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

function DashboardTodoCard({ item }: { item: ProjectDashboardTodoItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm font-semibold text-slate-900">{item.label}</div>
        <Badge variant={item.statusVariant} className="shrink-0">
          {item.statusLabel}
        </Badge>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-600">{item.summary}</div>
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

function ProjectListActionButton({
  action,
  className,
}: {
  action: ProjectListAction;
  className: string;
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
}: {
  items: ProjectListRow[];
  emptyMessage?: string;
  maxBodyHeightClassName?: string;
  minTableWidth?: number;
  variant?: 'detail' | 'document' | 'photo' | 'member' | 'memberDocument';
}) {
  const hasDocumentLinkColumn = items.some((item) => Boolean(item.documentLinkAction));
  const hasActionColumn = items.some((item) => Boolean(item.action));
  const baseColumns =
    variant === 'document'
      ? PROJECT_DOCUMENT_LIST_COLUMNS
      : variant === 'photo'
        ? PROJECT_PHOTO_LIST_COLUMNS
        : variant === 'member'
          ? PROJECT_MEMBER_LIST_COLUMNS
          : variant === 'memberDocument'
            ? PROJECT_MEMBER_DOCUMENT_LIST_COLUMNS
          : PROJECT_INFO_LIST_COLUMNS;
  const columns = [
    ...baseColumns,
    ...(hasDocumentLinkColumn ? [PROJECT_INFO_LIST_DOCUMENT_LINK_COLUMN] : []),
    ...(hasActionColumn ? [PROJECT_INFO_LIST_ACTION_COLUMN] : []),
  ];
  const linkColumnWidth = hasDocumentLinkColumn ? 72 : 0;
  const actionColumnWidth = hasActionColumn ? 48 : 0;
  const baseMinTableWidth =
    variant === 'document'
      ? 584
      : variant === 'photo'
        ? 556
        : variant === 'member'
          ? 580
          : variant === 'memberDocument'
            ? 400
          : 444;
  const resolvedMinTableWidth = minTableWidth || baseMinTableWidth + linkColumnWidth + actionColumnWidth;
  const renderLinkActionButton = (action: ProjectListAction | undefined) =>
    action ? (
      <ProjectListActionButton
        action={action}
        className="h-7 w-7 rounded-md text-slate-500 disabled:opacity-100"
      />
    ) : null;
  const rows: MejaiScrollTableRow[] = items.map((item) => ({
    key: item.key,
    selected: item.selected,
    onClick: item.onClick,
    ariaLabel: item.label,
    title: [item.label, item.contact, item.roleLabel, item.summary].filter(Boolean).join(' / '),
    cells: {
      label: item.label,
      status: (
        <Badge variant={item.statusVariant} className="px-1.5 py-0 text-[10px] font-semibold leading-5">
          {item.statusLabel}
        </Badge>
      ),
      summary: item.summary,
      savedAt: item.savedAt || item.summary,
      template: item.templateLabel ?? item.source,
      capturedAt: item.capturedAt || '-',
      evidence: item.evidenceLabel || item.summary,
      contact: item.contact || '-',
      role: item.roleContent ?? item.roleLabel ?? '-',
      documents: item.documentsContent ?? '-',
      lastVerifiedAt: item.lastVerifiedAt || '-',
      documentLinkAction: renderLinkActionButton(item.documentLinkAction),
      action: item.action ? (
        <ProjectListActionButton
          action={item.action}
          className="h-7 w-7 rounded-md text-rose-600"
        />
      ) : null,
    },
  }));

  return (
    <MejaiScrollTable
      columns={columns}
      rows={rows}
      emptyMessage={emptyMessage || '표시할 항목이 없습니다.'}
      maxHeightClassName={maxBodyHeightClassName}
      minTableWidth={resolvedMinTableWidth}
      showIndexColumn={false}
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
  const [siteMembers, setSiteMembers] = React.useState<SiteMemberRecordDto[]>([]);
  const [siteDocumentMembers, setSiteDocumentMembers] = React.useState<DocumentMemberRecordDto[]>([]);
  const [loadingSiteMembers, setLoadingSiteMembers] = React.useState(false);
  const [loadingSiteDocumentMembers, setLoadingSiteDocumentMembers] = React.useState(false);
  const [showAddSiteMemberForm, setShowAddSiteMemberForm] = React.useState(false);
  const [siteMemberPhoneNumber, setSiteMemberPhoneNumber] = React.useState('');
  const [siteMemberDisplayName, setSiteMemberDisplayName] = React.useState('');
  const [siteMemberRole, setSiteMemberRole] = React.useState<ManagedSiteMemberAccessRole>('participant');
  const [siteMemberDocumentIds, setSiteMemberDocumentIds] = React.useState<string[]>([]);
  const [siteMemberDocumentRole, setSiteMemberDocumentRole] = React.useState<ManagedDocumentMemberAccessRole>('viewer');
  const [expandedSiteMemberId, setExpandedSiteMemberId] = React.useState('');
  const [memberDocumentDrafts, setMemberDocumentDrafts] = React.useState<Record<string, MemberDocumentAccessDraft>>({});
  const [invitingSiteMember, setInvitingSiteMember] = React.useState(false);
  const [deletingSiteMemberId, setDeletingSiteMemberId] = React.useState('');
  const [deletingDocumentMemberId, setDeletingDocumentMemberId] = React.useState('');
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
    const nextQueryKey = buildProjectSelectionQueryKey(requestedSiteId, requestedDocumentId);

    if (selectionQuerySyncRef.current === nextQueryKey) {
      return;
    }

    selectionQuerySyncRef.current = nextQueryKey;
    pendingSelectionQueryStateRef.current = nextQueryKey;
    setSelectedSiteId(requestedSiteId);
    setSelectedSiteIds(requestedSiteId ? [requestedSiteId] : []);
    setSelectedDocumentId(requestedDocumentId);
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
        source: '사진 증빙 현황',
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

      return sites[0]?.id || '';
    });
  }, [rootDataLoaded, sites]);

  React.useEffect(() => {
    setSelectedSiteIds((current) => current.filter((siteId) => sites.some((site) => site.id === siteId)));
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
    setSiteMemberDocumentRole('viewer');
    setExpandedSiteMemberId('');
    setMemberDocumentDrafts({});
  }, [selectedSiteId]);

  const handleRefresh = () => {
    void loadRootData();
  };

  const handleChangeSelectedSites = React.useCallback(
    (nextSiteIds: string[]) => {
      const addedSiteId = nextSiteIds.find((siteId) => !selectedSiteIds.includes(siteId)) || '';
      const nextActiveSiteId =
        addedSiteId ||
        (selectedSiteId && nextSiteIds.includes(selectedSiteId) ? selectedSiteId : nextSiteIds[0]) ||
        selectedSiteId ||
        sites[0]?.id ||
        '';

      setSelectedSiteIds(nextSiteIds);

      if (nextActiveSiteId && nextActiveSiteId !== selectedSiteId) {
        setSelectedSiteId(nextActiveSiteId);
      }
    },
    [selectedSiteId, selectedSiteIds, sites]
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
          setMessage(getMemberAccessErrorMessage(error, '구성원별 문서 권한을 불러오지 못했습니다.'));
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
    async (documentId: string, documentTitle: string) => {
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
        await copyTextToClipboard(buildMemberAccessDocumentLinkUrl(normalizedDocumentId));
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
    const documentIdsToInvite = siteMemberRole === 'participant' ? siteMemberDocumentIds : [];

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
      const documentPermissionResults = await Promise.allSettled(
        documentIdsToInvite.map(async (documentId) => {
          const documentResponse = await fetch('/api/member-access/document-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              phoneNumber,
              displayName,
              accessRole: siteMemberDocumentRole,
            }),
          });
          const documentResult = await documentResponse.json();

          if (!documentResponse.ok || !documentResult?.success) {
            throw new Error(documentResult?.message || '문서 권한 등록에 실패했습니다.');
          }
        })
      );
      const failedDocumentPermission = documentPermissionResults.find((permissionResult) => permissionResult.status === 'rejected');

      await Promise.all([
        loadSiteMembers(normalizedSiteId),
        loadSiteDocumentMembers(documents),
      ]);

      if (failedDocumentPermission?.status === 'rejected') {
        throw failedDocumentPermission.reason;
      }

      setShowAddSiteMemberForm(false);
      setSiteMemberPhoneNumber('');
      setSiteMemberDisplayName('');
      setSiteMemberRole('participant');
      setSiteMemberDocumentIds([]);
      setSiteMemberDocumentRole('viewer');

      const documentCountMessage =
        documentIdsToInvite.length > 0 ? ` 문서 ${documentIdsToInvite.length}건 권한도 함께 등록했습니다.` : '';
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
    siteMemberDocumentIds,
    siteMemberDocumentRole,
    siteMemberPhoneNumber,
    siteMemberRole,
    documents,
    loadSiteDocumentMembers,
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

  const handleSaveMemberDocumentAccess = React.useCallback(
    async (
      membership: SiteMemberRecordDto,
      documentIds: string[],
      accessRole: ManagedDocumentMemberAccessRole,
      operationKey: string
    ) => {
      if (hasFullDocumentAccessBySiteRole(membership.accessRole)) {
        setMessage('소유자와 관리자는 모든 문서 권한을 가지고 있습니다.');
        return;
      }

      const normalizedDocumentIds = Array.from(new Set(documentIds.map((documentId) => documentId.trim()).filter(Boolean)));

      if (normalizedDocumentIds.length === 0 || savingMemberDocumentAccessKey) {
        return;
      }

      setSavingMemberDocumentAccessKey(operationKey);
      setMessage(null);

      try {
        await Promise.all(
          normalizedDocumentIds.map(async (documentId) => {
            const response = await fetch('/api/member-access/document-members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                documentId,
                phoneNumber: membership.member.phoneNumber,
                displayName: membership.member.displayName,
                accessRole,
              }),
            });
            const result = await response.json();

            if (!response.ok || !result?.success) {
              throw new Error(result?.message || '문서 권한 저장에 실패했습니다.');
            }
          })
        );

        await loadSiteDocumentMembers(documents);
        setMemberDocumentDrafts((current) => ({
          ...current,
          [membership.membershipId]: {
            ...(current[membership.membershipId] || { accessRole: 'viewer' }),
            documentIds: [],
          },
        }));
        setMessage(
          `"${membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber)}"의 문서 권한을 저장했습니다.`
        );
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '문서 권한 저장에 실패했습니다.'));
      } finally {
        setSavingMemberDocumentAccessKey('');
      }
    },
    [documents, loadSiteDocumentMembers, savingMemberDocumentAccessKey]
  );

  const handleUpdateMemberDocumentRole = React.useCallback(
    async (membership: SiteMemberRecordDto, documentMembership: DocumentMemberRecordDto, nextRole: ManagedDocumentMemberAccessRole) => {
      const currentRole = getManagedDocumentMemberRole(documentMembership.accessRole);

      if (nextRole === currentRole) {
        return;
      }

      await handleSaveMemberDocumentAccess(
        membership,
        [documentMembership.documentId],
        nextRole,
        `${documentMembership.membershipId}:role`
      );
    },
    [handleSaveMemberDocumentAccess]
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
          throw new Error(result?.message || '문서 권한 삭제에 실패했습니다.');
        }

        await loadSiteDocumentMembers(documents);

        setMessage(`"${memberLabel}"의 문서 접근 권한을 삭제했습니다.`);
      } catch (error) {
        setMessage(getMemberAccessErrorMessage(error, '문서 권한 삭제에 실패했습니다.'));
      } finally {
        setDeletingDocumentMemberId('');
      }
    },
    [deletingDocumentMemberId, documents, loadSiteDocumentMembers]
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
          onClick: () => handleSelectDocument(item.document.id),
          documentLinkAction: {
            title: '문서 접근 링크 복사',
            ariaLabel: `${item.document.title} 문서 접근 링크 복사`,
            icon: <Link2 className="h-4 w-4" />,
            completedIcon: <Check className="h-4 w-4 text-emerald-600" />,
            completed: copiedDocumentLinkKey === `${item.document.id}:member-access`,
            feedbackKey: `${item.document.id}:member-access`,
            disabled: copyingDocumentLinkKey === `${item.document.id}:member-access`,
            onClick: () => {
              return handleCopyDocumentLink(item.document.id, item.document.title);
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
      selectedDocumentId,
      templates,
    ]
  );

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

  const documentTitleById = React.useMemo(
    () => new Map(documents.map((item) => [item.document.id, item.document.title] as const)),
    [documents]
  );

  const memberDocumentMembershipsByMemberId = React.useMemo(() => {
    const siteDocumentIdSet = new Set(documents.map((item) => item.document.id));

    return siteDocumentMembers.reduce<Record<string, DocumentMemberRecordDto[]>>((accumulator, membership) => {
      if (!siteDocumentIdSet.has(membership.documentId)) {
        return accumulator;
      }

      const memberId = membership.member.id;
      accumulator[memberId] = [...(accumulator[memberId] || []), membership].sort((left, right) =>
        (documentTitleById.get(left.documentId) || '').localeCompare(documentTitleById.get(right.documentId) || '', 'ko')
      );
      return accumulator;
    }, {});
  }, [documentTitleById, documents, siteDocumentMembers]);

	  const siteDocumentPickerOptions = React.useMemo(
	    () =>
	      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        meta: `현재 상태 ${getDocumentStatusLabel(item.document.status)}`,
        keywords: [item.document.title, item.document.id],
      })),
	    [documents]
	  );

	  const siteMemberRows = React.useMemo<ProjectListRow[]>(
	    () =>
      siteMembers.map((membership) => {
        const memberLabel = membership.member.displayName?.trim() || formatPhoneNumber(membership.member.phoneNumber);
        const memberDocumentMemberships = memberDocumentMembershipsByMemberId[membership.member.id] || [];
        const isDeletingMember = deletingSiteMemberId === membership.membershipId;
        const isUpdatingMember = updatingSiteMemberId === membership.membershipId;
        const managedSiteRole = getManagedSiteMemberRole(membership.accessRole);
        const hasFullDocumentAccess = hasFullDocumentAccessBySiteRole(membership.accessRole);
        const expanded = !hasFullDocumentAccess && expandedSiteMemberId === membership.membershipId;

        return {
	          key: membership.membershipId,
	          label: memberLabel,
	          statusLabel: getMemberVerificationStatusLabel(membership.member.verificationStatus),
	          statusVariant: getMemberVerificationStatusVariant(membership.member.verificationStatus),
	          summary: SITE_MEMBER_ROLE_LABELS[membership.accessRole],
	          contact: formatPhoneNumber(membership.member.phoneNumber),
	          roleLabel: SITE_MEMBER_ROLE_LABELS[membership.accessRole],
	          roleContent: (
            <select
              value={managedSiteRole}
              onChange={(event) =>
                void handleUpdateSiteMemberRole(membership, event.target.value as ManagedSiteMemberAccessRole)
              }
	              disabled={isDeletingMember || isUpdatingMember}
	              className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
	            >
	              {SITE_MEMBER_ROLE_OPTIONS.map((option) => (
	                <option key={option.value} value={option.value}>
	                  {option.label}
	                </option>
	              ))}
            </select>
          ),
          documentsContent: hasFullDocumentAccess ? (
            <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700">
              전체 권한
            </span>
          ) : (
            <button
              type="button"
	              className={cn(
	                'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium',
	                expanded
	                  ? 'border-slate-900 bg-slate-900 text-white'
	                  : 'border-slate-300 bg-white text-slate-700'
	              )}
	              onPointerDown={(event) => event.stopPropagation()}
	              onClick={(event) => {
	                event.preventDefault();
	                event.stopPropagation();
	                setExpandedSiteMemberId((current) =>
	                  current === membership.membershipId ? '' : membership.membershipId
	                );
	              }}
	            >
	              {memberDocumentMemberships.length > 0 ? `${memberDocumentMemberships.length}개 문서` : '문서 없음'}
	              <ChevronDown className="h-3.5 w-3.5" />
	            </button>
	          ),
	          lastVerifiedAt: membership.member.lastVerifiedAt ? formatDateTime(membership.member.lastVerifiedAt) : '인증 이력 없음',
	          source: '현장 접근 권한',
	          selected: expanded,
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
	      handleUpdateSiteMemberRole,
	      memberDocumentMembershipsByMemberId,
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
  const expandedSiteMemberCanManageDocuments = expandedSiteMember
    ? !hasFullDocumentAccessBySiteRole(expandedSiteMember.accessRole)
    : false;
  const expandedMemberDocumentMemberships = expandedSiteMember
    ? memberDocumentMembershipsByMemberId[expandedSiteMember.member.id] || []
	    : [];
	  const expandedMemberDocumentIds = new Set(
	    expandedMemberDocumentMemberships.map((membership) => membership.documentId)
	  );
	  const expandedMemberAvailableDocumentOptions = siteDocumentPickerOptions.filter(
	    (option) => !expandedMemberDocumentIds.has(option.id)
	  );
  const expandedMemberDocumentDraft = expandedSiteMember
    ? memberDocumentDrafts[expandedSiteMember.membershipId] || {
        documentIds: [],
        accessRole: 'viewer' as ManagedDocumentMemberAccessRole,
      }
    : {
        documentIds: [],
        accessRole: 'viewer' as ManagedDocumentMemberAccessRole,
      };
  const expandedMemberDocumentRows = React.useMemo<ProjectListRow[]>(() => {
    if (!expandedSiteMember) {
      return [];
    }

    return expandedMemberDocumentMemberships.map((documentMembership) => {
      const documentTitle = documentTitleById.get(documentMembership.documentId) || '현장 문서';
      const roleLabel = DOCUMENT_MEMBER_ROLE_LABELS[documentMembership.accessRole];

      return {
        key: documentMembership.membershipId,
        label: documentTitle,
        statusLabel: '등록됨',
        statusVariant: 'slate',
        summary: `문서 권한 ${roleLabel}`,
        source: roleLabel,
        roleLabel,
        roleContent: (
          <RoleSegmentedButtons
            value={getManagedDocumentMemberRole(documentMembership.accessRole)}
            options={DOCUMENT_MEMBER_ROLE_OPTIONS}
            onChange={(value) => void handleUpdateMemberDocumentRole(expandedSiteMember, documentMembership, value)}
          />
        ),
        action: {
          title: '문서 권한 삭제',
          ariaLabel: `${expandedSiteMemberLabel} ${documentTitle} 문서 권한 삭제`,
          icon: <Trash2 className="h-4 w-4" />,
          disabled: deletingDocumentMemberId === documentMembership.membershipId,
          onClick: () => {
            void handleDeleteDocumentMember(
              documentMembership.membershipId,
              `${expandedSiteMemberLabel} / ${documentTitle}`
            );
          },
        },
      };
    });
  }, [
    deletingDocumentMemberId,
    documentTitleById,
    expandedMemberDocumentMemberships,
    expandedSiteMember,
    expandedSiteMemberLabel,
    handleDeleteDocumentMember,
    handleUpdateMemberDocumentRole,
  ]);

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

  const hasSelectedDocumentContext = Boolean(selectedDocumentId || loadingDocumentDetail || selectedDocumentListItem);
  const selectedDetailPanel =
    selectedPhotoId && selectedPhoto
      ? 'photo'
      : hasSelectedDocumentContext
        ? 'document'
        : 'summary';

  return (
    <div className="project-no-motion mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <style>{`
        .project-no-motion,
        .project-no-motion *,
        .project-no-motion *::before,
        .project-no-motion *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `}</style>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">현장 통합 관리</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">현장 관리</h1>
          <p className="max-w-4xl text-sm text-slate-600">
            현장을 만들고 필요한 문서를 준비한 뒤, 기록 값과 첨부 파일, 사진 증빙, 구성원 접근 권한을 한곳에서 관리합니다.
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

      <div className="space-y-6">
        <Card className="min-w-0 border-slate-200">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>1. 현장 선택과 기본 정보</CardTitle>
              <CardDescription>
                새 현장을 만들거나 기존 현장을 선택해 문서, 사진, 구성원을 관리합니다.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant={showCreateSiteForm ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowCreateSiteForm((previous) => !previous)}
              className="h-[42px] shrink-0"
            >
              {showCreateSiteForm ? '입력 닫기' : '새 현장 만들기'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-800">현장 리스트</label>
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
            )}

            <div className="flex flex-col gap-3 p-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">현장 대시보드</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    현장을 따로 고르지 않으면 모든 현장의 문서, 사진, 할 일을 합산해서 보여줍니다.
                  </p>
                </div>
                <Badge variant={loadingDashboardSummaries ? 'slate' : 'green'} className="w-fit shrink-0">
                  {loadingDashboardSummaries ? '불러오는 중' : dashboardScopeLabel}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={FolderKanban}
                  label="현장"
                  value={String(dashboardSiteCount)}
                  description="대시보드에 포함된 현장"
                />
                <MetricCard
                  icon={FileStack}
                  label="문서"
                  value={String(dashboardDocumentCount)}
                  description="포함된 현장의 전체 문서"
                />
                <MetricCard
                  icon={FileImage}
                  label="사진"
                  value={String(dashboardPhotoCount)}
                  description="포함된 현장의 전체 사진"
                />
                <MetricCard
                  icon={Signature}
                  label="할 일"
                  value={String(dashboardTodoCount)}
                  description="문서, 사진, 확인 필요 항목"
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-4">
                {dashboardTodoItems.map((item) => (
                  <DashboardTodoCard key={item.key} item={item} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {showCreateSiteForm ? null : (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>현장 문서 · 사진·서명 · 구성원</CardTitle>
                  <CardDescription>선택한 현장의 문서, 사진·서명, 구성원 정보를 한곳에서 관리합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">현장 문서</div>
                        <p className="text-xs text-slate-500">선택한 현장의 문서를 만들고, 접근 링크와 삭제를 관리합니다.</p>
                      </div>
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
                          disabled={!selectedSite}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {selectedSite ? (
                      <>
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
                          variant="document"
                          emptyMessage="아직 만든 현장 문서가 없습니다."
                          maxBodyHeightClassName="max-h-[220px]"
                        />
                      </>
                    ) : (
                      <EmptyState
                        title="선택된 현장이 없습니다."
                        description="현장 리스트에서 현장을 선택하면 문서 목록을 확인할 수 있습니다."
                      />
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">사진·서명</div>
                        <p className="text-xs text-slate-500">선택한 현장의 사진과 서명 연결 상태를 확인합니다.</p>
                      </div>
                      <span className="text-xs text-slate-500">사진 {photos.length}건 · 연결된 서명 없음</span>
                    </div>
                    {selectedSite ? (
                      <ProjectInfoList
                        items={photoRows}
                        variant="photo"
                        emptyMessage="등록된 사진이 없습니다. 연결된 전자 서명도 아직 없습니다."
                      />
                    ) : (
                      <EmptyState
                        title="선택된 현장이 없습니다."
                        description="현장을 선택하면 사진과 서명 연결 상태를 확인할 수 있습니다."
                      />
                    )}
                  </div>

	                  <div className="space-y-3 border-t border-slate-200 pt-6">
	                    <div className="space-y-1">
	                      <div className="text-sm font-semibold text-slate-900">구성원</div>
	                      <p className="text-xs text-slate-500">현장 접근 권한과 문서별 권한을 구성원별로 관리합니다.</p>
	                    </div>
	                    {selectedSite ? (
	                      <div className="space-y-5">
	                        <div className="space-y-2">
	                          <div className="flex items-center justify-between gap-3">
	                            <div className="text-sm font-medium text-slate-800">현장 접근 권한</div>
	                            <div className="flex items-center gap-2">
	                              <span className="text-xs text-slate-500">
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
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
	                            </div>
	                          </div>
	                          {showAddSiteMemberForm ? (
	                            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
	                              <div className="space-y-3">
	                                <div className="space-y-2">
	                                  <label className="text-xs font-medium text-slate-700">이름</label>
	                                  <Input
                                    value={siteMemberDisplayName}
                                    onChange={(event) => setSiteMemberDisplayName(event.target.value)}
                                    placeholder="이름이 있으면 입력"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-slate-700">휴대폰</label>
                                  <Input
                                    value={siteMemberPhoneNumber}
                                    onChange={(event) => setSiteMemberPhoneNumber(event.target.value)}
                                    placeholder="예: 01012345678"
                                    inputMode="tel"
                                  />
                                </div>
	                                <div className="space-y-2">
	                                  <label className="text-xs font-medium text-slate-700">현장 권한</label>
		                                  <select
		                                    value={siteMemberRole}
		                                    onChange={(event) => {
		                                      const nextRole = event.target.value as ManagedSiteMemberAccessRole;
		                                      setSiteMemberRole(nextRole);

		                                      if (nextRole !== 'participant') {
		                                        setSiteMemberDocumentIds([]);
		                                        setSiteMemberDocumentRole('viewer');
		                                      }
		                                    }}
		                                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
		                                <div className="space-y-3 border-t border-slate-200 pt-3">
		                                  <div className="space-y-2">
		                                    <label className="text-xs font-medium text-slate-700">문서</label>
		                                    <MultiEntityPicker
		                                      values={siteMemberDocumentIds}
		                                      options={siteDocumentPickerOptions}
		                                      onChange={setSiteMemberDocumentIds}
		                                      placeholder="접근 권한을 줄 문서를 선택하세요"
		                                      searchPlaceholder="문서 목록 검색"
		                                      emptyMessage="권한을 줄 현장 문서가 없습니다."
		                                      allowClear
		                                    />
		                                  </div>
		                                  <div className="space-y-2">
		                                    <label className="text-xs font-medium text-slate-700">문서 권한</label>
		                                    <RoleSegmentedButtons
		                                      value={siteMemberDocumentRole}
		                                      options={DOCUMENT_MEMBER_ROLE_OPTIONS}
		                                      onChange={(value) => setSiteMemberDocumentRole(value)}
		                                    />
		                                  </div>
		                                </div>
		                              ) : null}
	                              <div className="grid grid-cols-2 gap-2">
	                                <Button
	                                  type="button"
                                  className="w-full"
                                  onClick={() => void handleInviteSiteMember()}
                                  disabled={invitingSiteMember}
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
	                                    setSiteMemberDocumentRole('viewer');
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
	                            variant="member"
	                            emptyMessage="아직 현장 접근 권한을 받은 구성원이 없습니다."
	                            maxBodyHeightClassName="max-h-[260px]"
	                          />
	                          {expandedSiteMember && expandedSiteMemberCanManageDocuments ? (
	                            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
	                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
	                                <div className="text-sm font-semibold text-slate-900">
	                                  {expandedSiteMemberLabel} 문서 권한
	                                </div>
	                                <div className="text-xs text-slate-500">
	                                  {expandedMemberDocumentMemberships.length > 0
	                                    ? `${expandedMemberDocumentMemberships.length}개 문서`
	                                    : '등록된 문서 없음'}
	                                </div>
	                              </div>
	                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
	                                <div className="space-y-2">
	                                  <label className="text-xs font-medium text-slate-700">문서 추가</label>
	                                  <MultiEntityPicker
	                                    values={expandedMemberDocumentDraft.documentIds}
	                                    options={expandedMemberAvailableDocumentOptions}
	                                    onChange={(nextDocumentIds) =>
	                                      setMemberDocumentDrafts((current) => ({
	                                        ...current,
	                                        [expandedSiteMember.membershipId]: {
	                                          ...expandedMemberDocumentDraft,
	                                          documentIds: nextDocumentIds,
	                                        },
	                                      }))
	                                    }
	                                    placeholder="추가할 문서를 선택하세요"
	                                    searchPlaceholder="문서 목록 검색"
	                                    emptyMessage="추가할 수 있는 문서가 없습니다."
	                                    allowClear
	                                  />
	                                </div>
	                                <div className="space-y-2">
	                                  <label className="text-xs font-medium text-slate-700">문서 권한</label>
	                                  <RoleSegmentedButtons
	                                    value={expandedMemberDocumentDraft.accessRole}
	                                    options={DOCUMENT_MEMBER_ROLE_OPTIONS}
	                                    onChange={(value) =>
	                                      setMemberDocumentDrafts((current) => ({
	                                        ...current,
	                                        [expandedSiteMember.membershipId]: {
	                                          ...expandedMemberDocumentDraft,
	                                          accessRole: value,
	                                        },
	                                      }))
	                                    }
	                                  />
	                                </div>
	                                <Button
	                                  type="button"
	                                  onClick={() =>
	                                    void handleSaveMemberDocumentAccess(
	                                      expandedSiteMember,
	                                      expandedMemberDocumentDraft.documentIds,
	                                      expandedMemberDocumentDraft.accessRole,
	                                      `${expandedSiteMember.membershipId}:add`
	                                    )
	                                  }
	                                  disabled={
	                                    expandedMemberDocumentDraft.documentIds.length === 0 ||
	                                    savingMemberDocumentAccessKey === `${expandedSiteMember.membershipId}:add`
	                                  }
	                                >
	                                  문서 권한 추가
	                                </Button>
	                              </div>
	                              <ProjectInfoList
	                                items={expandedMemberDocumentRows}
	                                variant="memberDocument"
	                                emptyMessage="이 구성원에게 등록된 문서 권한이 없습니다."
	                                minTableWidth={448}
	                              />
                            </div>
                          ) : null}
	                        </div>
	                      </div>
	                    ) : (
                      <EmptyState
                        title="선택된 현장이 없습니다."
                        description="현장을 선택하면 구성원 권한을 확인할 수 있습니다."
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-6">
              {selectedDetailPanel === 'document' ? (
                <Card className="border-slate-200">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="space-y-1.5">
                      <CardTitle>선택한 문서 상세</CardTitle>
                      <CardDescription>기록된 값, 첨부 파일, 사진 증빙, 저장 이력을 확인합니다.</CardDescription>
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
                        className="h-[42px] shrink-0"
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
                            ? `"${selectedDocumentListItem.document.title}" 문서 정보를 불러오는 중입니다.`
                            : '문서 정보를 불러오는 중입니다.'}
                        </div>
                        <ProjectInfoList items={selectedDocumentDetailRows} />
                      </div>
                    ) : selectedDocumentDetail ? (
                      <ProjectInfoList items={selectedDocumentDetailRows} />
                    ) : selectedDocumentListItem ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                          문서 편집은 계속할 수 있지만, 상세 정보 일부를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.
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
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle>선택한 문서 상세</CardTitle>
                    <CardDescription>현장 문서 또는 사진을 선택하면 상세 정보를 보여줍니다.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmptyState
                      title="선택된 항목이 없습니다."
                      description="왼쪽의 현장 문서나 사진 목록에서 확인할 항목을 선택해 주세요."
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {showCreateSiteForm ? (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <EmptyState
                title="새 현장을 입력하는 중입니다."
                description="현장 생성을 마치거나 입력을 닫으면 선택한 문서를 다시 편집할 수 있습니다."
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
