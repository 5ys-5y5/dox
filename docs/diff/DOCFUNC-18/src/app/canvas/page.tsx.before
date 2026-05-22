'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../components/template/workspace/persistence/documentAttachmentClient';
import type {
  TemplateEditWorkspaceProps,
  TemplateEditWorkspaceSaveDraftParams,
} from '../../components/template/workspace/types';
import {
  TemplateExtractWorkspace,
  type TemplateExtractWorkspaceStatus,
} from '../../components/template/TemplateExtractWorkspace';
import { CanvasOwnedWorkspace, type CanvasOwnerSurface } from './ownerPolicy';
import {
  canvasAccessRoleLabels,
  canvasAccessRoles,
  createEmptyCanvasAccessRolePolicyStore,
  normalizeCanvasAccessRole,
  readCanvasAccessRolePolicyStoreFromStorage,
  resolveCanvasAccessRolePolicies,
  resolveEffectiveCanvasAccessMode,
  saveCanvasAccessRolePolicyStoreToStorage,
  updateCanvasAccessRolePolicyStoreOverride,
  type CanvasAccessMode,
  type CanvasAccessRole,
  type CanvasAccessRolePolicy,
  type CanvasAccessRolePolicyStore,
} from './accessRolePolicy';
import {
  applyCanvasOwnerSettingsToWorkspaceProps,
  buildCanvasToolbarVisibility,
  buildPersistenceVisibility,
  buildTemplateUsagePreviewLayoutDebugOptions,
  defaultCanvasOwnerSettings,
  createEmptyCanvasOwnerSettingsStore,
  normalizeCanvasWorkspaceMode,
  readCanvasOwnerSettingsFromStorage,
  resolveCanvasOwnerSettings,
  saveCanvasOwnerSettingsStoreToStorage,
  updateCanvasOwnerSettingsStoreOverride,
  type CanvasOwnerSettings,
  type CanvasOwnerSettingKey,
  type CanvasOwnerSettingSource,
  type CanvasOwnerSettingsStore,
} from './ownerSettings';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Divider } from '../../components/ui/Divider';
import { EntityPicker, type EntityPickerOption } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import { OptionButtonGroup } from '../../components/ui/OptionButtonGroup';
import { SettingToggleRow } from '../../components/ui/SettingToggleRow';
import {
  extractDocumentCanvasLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml,
  stringifyDocumentValue,
} from '../../lib/documentCanvasState';
import type { DocumentDetailResult, DocumentListItem } from '../../lib/documentDtos';
import { buildDocumentHtmlContentKey } from '../../lib/documentCanvasHtml';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../lib/documentAttachmentValues';
import type { TemplateRecordDto } from '../../lib/templateDtos';

type CanvasWorkspaceMode = 'template' | 'document' | 'read';
type CanvasOwnerControlTab = 'page' | 'mode';
type ManagedCanvasPageId =
  | 'canvas'
  | 'templates'
  | 'templates-edit'
  | 'documents'
  | 'project'
  | 'request-links'
  | 'member-access';
type ManagedCanvasPage = {
  id: ManagedCanvasPageId;
  label: string;
  path: string;
  surface: CanvasOwnerSurface;
  description: string;
  allowedModes: CanvasWorkspaceMode[];
  defaultMode: CanvasWorkspaceMode;
};

const fetchSuccessData = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || '데이터 조회에 실패했습니다.');
  }

  return result.data as T;
};

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

const modeDescriptions: Record<CanvasWorkspaceMode, string> = {
  template: '템플릿 구조 자체를 편집하는 원본 모드입니다. 상자 추가, 이동, 속성 조정 등 모든 기능을 사용합니다.',
  document: '문서를 기록하는 문서 모드입니다. 값 입력, 첨부파일, 서명 등 실제 문서 기록만 허용합니다.',
  read: '열람 전용 읽기 모드입니다. 상단 기능과 본문 편집이 모두 비활성화됩니다.',
};

const modeLabels: Record<CanvasWorkspaceMode, string> = {
  template: '템플릿 모드',
  document: '문서 모드',
  read: '읽기 모드',
};

const managedCanvasPages: ManagedCanvasPage[] = [
  {
    id: 'canvas',
    label: '공용 캔버스 관리자',
    path: '/canvas',
    surface: 'canvas',
    description: '공용 캔버스 owner 설정과 모드별 동작을 검증하는 기준 페이지입니다.',
    allowedModes: ['template', 'document', 'read'],
    defaultMode: 'template',
  },
  {
    id: 'templates',
    label: '템플릿 생성',
    path: '/templates',
    surface: 'templates',
    description: 'PDF 추출과 템플릿 저장을 포함한 템플릿 작성 페이지입니다.',
    allowedModes: ['template'],
    defaultMode: 'template',
  },
  {
    id: 'templates-edit',
    label: '템플릿 편집',
    path: '/templates/edit',
    surface: 'templates-edit',
    description: '저장된 템플릿을 직접 편집하는 페이지입니다.',
    allowedModes: ['template'],
    defaultMode: 'template',
  },
  {
    id: 'documents',
    label: '문서 관리',
    path: '/documents',
    surface: 'documents',
    description: '문서 요청, 출력본, 사진 증빙 흐름에서 문서를 읽기 전용으로 확인합니다.',
    allowedModes: ['read'],
    defaultMode: 'read',
  },
  {
    id: 'project',
    label: '현장 관리',
    path: '/project',
    surface: 'project',
    description: '현장 문서를 선택하고 권한에 따라 문서 기록 또는 읽기 전용 상태로 확인하는 화면입니다.',
    allowedModes: ['document', 'read'],
    defaultMode: 'document',
  },
  {
    id: 'request-links',
    label: '요청 링크',
    path: '/request-links/[token]',
    surface: 'request-links',
    description: '요청 링크 상태에 따라 허용된 값만 입력하거나 읽기 전용으로 확인합니다.',
    allowedModes: ['document', 'read'],
    defaultMode: 'document',
  },
  {
    id: 'member-access',
    label: '구성원 문서 접근',
    path: '/member-access/document/[documentId]',
    surface: 'member-access',
    description: '초대된 권한에 따라 문서를 편집하거나 읽기 전용으로 여는 페이지입니다.',
    allowedModes: ['document', 'read'],
    defaultMode: 'document',
  },
];

const normalizeManagedCanvasPageId = (value: string | null | undefined): ManagedCanvasPageId =>
  managedCanvasPages.some((page) => page.id === value) ? (value as ManagedCanvasPageId) : 'canvas';

const getManagedCanvasPage = (pageId: ManagedCanvasPageId) =>
  managedCanvasPages.find((page) => page.id === pageId) || managedCanvasPages[0];

const resolveManagedCanvasWorkspaceMode = (page: ManagedCanvasPage, value: string | null | undefined): CanvasWorkspaceMode => {
  const normalizedMode = normalizeCanvasWorkspaceMode(value);
  return page.allowedModes.includes(normalizedMode) ? normalizedMode : page.defaultMode;
};

const compactInputClassName = 'h-8 px-2 text-xs';

type CanvasRoutePreviewProps = Partial<
  Pick<
    TemplateEditWorkspaceProps,
    | 'additionalControlPanels'
    | 'canvasToolbarVisibility'
    | 'documentAttachmentApiPath'
    | 'editableValueKeys'
    | 'headerDescription'
    | 'headerTitle'
    | 'hideHeader'
    | 'hidePersistencePanel'
    | 'nameFieldLabel'
    | 'persistenceVisibility'
    | 'saveButtonLabel'
    | 'saveDisabled'
    | 'defaultCanvasFullscreen'
    | 'canvasPageContainerWidth'
    | 'canvasPageContainerHeight'
    | 'canvasSpecifiedHeightEnabled'
    | 'canvasSpecifiedHeight'
    | 'canvasSpecifiedWidthEnabled'
    | 'canvasSpecifiedWidth'
    | 'showWorkspaceMessages'
    | 'suppressInitialDraftLoadedMessage'
    | 'templateListDisplay'
    | 'templateNameReadOnly'
    | 'templateUsagePreviewLayoutDebugOptions'
    | 'topNotice'
  >
>;

export default function CanvasOwnerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedManagedPageId = normalizeManagedCanvasPageId(searchParams.get('page'));
  const selectedManagedPage = getManagedCanvasPage(selectedManagedPageId);
  const workspaceMode = resolveManagedCanvasWorkspaceMode(selectedManagedPage, searchParams.get('mode'));
  const selectedCanvasAccessRole = normalizeCanvasAccessRole(searchParams.get('role'));
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';
  const documentIdFromQuery = searchParams.get('documentId')?.trim() || '';

  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [loadingLists, setLoadingLists] = React.useState(false);
  const [loadingDocumentDetail, setLoadingDocumentDetail] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [ownerEventMessage, setOwnerEventMessage] = React.useState<string | null>(null);
  const [extractStatus, setExtractStatus] = React.useState<TemplateExtractWorkspaceStatus | null>(null);
  const [extractStatusResetKey, setExtractStatusResetKey] = React.useState(0);
  const [draftReloadNonce, setDraftReloadNonce] = React.useState(0);
  const [savedSettingsStore, setSavedSettingsStore] = React.useState<CanvasOwnerSettingsStore>(() =>
    createEmptyCanvasOwnerSettingsStore()
  );
  const [settingsStore, setSettingsStore] = React.useState<CanvasOwnerSettingsStore>(() =>
    createEmptyCanvasOwnerSettingsStore()
  );
  const [savedAccessRolePolicyStore, setSavedAccessRolePolicyStore] = React.useState<CanvasAccessRolePolicyStore>(() =>
    createEmptyCanvasAccessRolePolicyStore()
  );
  const [accessRolePolicyStore, setAccessRolePolicyStore] = React.useState<CanvasAccessRolePolicyStore>(() =>
    createEmptyCanvasAccessRolePolicyStore()
  );
  const [activeControlTab, setActiveControlTab] = React.useState<CanvasOwnerControlTab>('page');

  const selectedTemplateId = templateIdFromQuery || templates[0]?.id || '';
  const selectedDocumentId = documentIdFromQuery || documents[0]?.document.id || '';
  const settingsSignature = React.useMemo(() => JSON.stringify(settingsStore), [settingsStore]);
  const savedSettingsSignature = React.useMemo(() => JSON.stringify(savedSettingsStore), [savedSettingsStore]);
  const accessRolePolicySignature = React.useMemo(() => JSON.stringify(accessRolePolicyStore), [accessRolePolicyStore]);
  const savedAccessRolePolicySignature = React.useMemo(
    () => JSON.stringify(savedAccessRolePolicyStore),
    [savedAccessRolePolicyStore]
  );
  const hasUnsavedCanvasSettings =
    settingsSignature !== savedSettingsSignature || accessRolePolicySignature !== savedAccessRolePolicySignature;
  const activeSettingsScope = activeControlTab === 'mode' ? 'mode' : 'page';
  const selectedPageAccessRolePolicies = React.useMemo(
    () => resolveCanvasAccessRolePolicies(accessRolePolicyStore, selectedManagedPage.id),
    [accessRolePolicyStore, selectedManagedPage.id]
  );
  const selectedAccessRolePolicy = selectedPageAccessRolePolicies[selectedCanvasAccessRole];
  const selectedAccessMode = resolveEffectiveCanvasAccessMode(selectedCanvasAccessRole, selectedAccessRolePolicy);
  const requestedAccessWorkspaceMode = selectedAccessMode === 'view' ? 'read' : workspaceMode;
  const canUseRequestedAccessWorkspaceMode = selectedManagedPage.allowedModes.includes(requestedAccessWorkspaceMode);
  const effectiveWorkspaceMode = canUseRequestedAccessWorkspaceMode ? requestedAccessWorkspaceMode : workspaceMode;
  const accessPreviewUnavailable = !canUseRequestedAccessWorkspaceMode;
  const resolvedSettings = React.useMemo(
    () =>
      resolveCanvasOwnerSettings(settingsStore, {
        pageId: activeSettingsScope === 'page' ? selectedManagedPage.id : undefined,
        workspaceMode: effectiveWorkspaceMode,
        accessRole: selectedCanvasAccessRole,
      }),
    [activeSettingsScope, effectiveWorkspaceMode, selectedCanvasAccessRole, selectedManagedPage.id, settingsStore]
  );
  const settings = resolvedSettings.settings;
  const settingSources = resolvedSettings.sources;
  const previewResolvedSettings = React.useMemo(
    () =>
      resolveCanvasOwnerSettings(settingsStore, {
        pageId: selectedManagedPage.id,
        workspaceMode: effectiveWorkspaceMode,
        accessRole: selectedCanvasAccessRole,
      }),
    [effectiveWorkspaceMode, selectedCanvasAccessRole, selectedManagedPage.id, settingsStore]
  );
  const previewSettings = previewResolvedSettings.settings;
  const previewSettingSources = previewResolvedSettings.sources;

  React.useEffect(() => {
    const { settingsStore: nextSettingsStore, hasStoredSettings } = readCanvasOwnerSettingsFromStorage({
      pageId: selectedManagedPage.id,
      workspaceMode: effectiveWorkspaceMode,
      accessRole: selectedCanvasAccessRole,
    });
    const {
      policyStore: nextAccessRolePolicyStore,
      hasStoredPolicies,
    } = readCanvasAccessRolePolicyStoreFromStorage();

    if (hasStoredSettings) {
      setSavedSettingsStore(nextSettingsStore);
      setSettingsStore(nextSettingsStore);
    }
    if (hasStoredPolicies) {
      setSavedAccessRolePolicyStore(nextAccessRolePolicyStore);
      setAccessRolePolicyStore(nextAccessRolePolicyStore);
    }
  }, []);

  const saveCanvasOwnerSettings = React.useCallback(() => {
    const nextSettingsStore = saveCanvasOwnerSettingsStoreToStorage(settingsStore);
    const nextAccessRolePolicyStore = saveCanvasAccessRolePolicyStoreToStorage(accessRolePolicyStore);
    setSavedSettingsStore(nextSettingsStore);
    setSettingsStore(nextSettingsStore);
    setSavedAccessRolePolicyStore(nextAccessRolePolicyStore);
    setAccessRolePolicyStore(nextAccessRolePolicyStore);
    setOwnerEventMessage(
      activeSettingsScope === 'page'
        ? `${selectedManagedPage.label} · ${canvasAccessRoleLabels[selectedCanvasAccessRole]} · ${modeLabels[effectiveWorkspaceMode]} 설정을 저장했습니다.`
        : `${canvasAccessRoleLabels[selectedCanvasAccessRole]} · ${modeLabels[effectiveWorkspaceMode]} 설정을 저장했습니다.`
    );
  }, [
    accessRolePolicyStore,
    activeSettingsScope,
    effectiveWorkspaceMode,
    selectedCanvasAccessRole,
    selectedManagedPage.label,
    settingsStore,
  ]);

  const resetCanvasOwnerSettings = React.useCallback(() => {
    setSettingsStore(savedSettingsStore);
    setAccessRolePolicyStore(savedAccessRolePolicyStore);
    setOwnerEventMessage('저장된 상자 편집 캔버스 환경설정으로 되돌렸습니다.');
  }, [savedAccessRolePolicyStore, savedSettingsStore]);

  const updateSetting = React.useCallback(
    <K extends keyof CanvasOwnerSettings>(key: K, value: CanvasOwnerSettings[K]) => {
      setSettingsStore((previous) =>
        updateCanvasOwnerSettingsStoreOverride(previous, {
          scope: activeSettingsScope,
          pageId: selectedManagedPage.id,
          workspaceMode: effectiveWorkspaceMode,
          accessRole: selectedCanvasAccessRole,
          key,
          value,
        })
      );
    },
    [activeSettingsScope, effectiveWorkspaceMode, selectedCanvasAccessRole, selectedManagedPage.id]
  );
  const updateAccessRolePolicy = React.useCallback(
    (role: CanvasAccessRole, patch: Partial<CanvasAccessRolePolicy>) => {
      setAccessRolePolicyStore((previous) =>
        updateCanvasAccessRolePolicyStoreOverride(previous, {
          pageId: selectedManagedPage.id,
          role,
          patch,
        })
      );
    },
    [selectedManagedPage.id]
  );

  const updateQuery = React.useCallback(
    (patch: Partial<Record<'page' | 'mode' | 'role' | 'templateId' | 'documentId', string>>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      Object.entries(patch).forEach(([key, value]) => {
        const normalizedValue = String(value || '').trim();

        if (normalizedValue) {
          nextParams.set(key, normalizedValue);
        } else {
          nextParams.delete(key);
        }
      });

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleSelectManagedPage = React.useCallback(
    (pageId: ManagedCanvasPageId) => {
      const nextPage = getManagedCanvasPage(pageId);
      const nextMode = nextPage.allowedModes.includes(workspaceMode) ? workspaceMode : nextPage.defaultMode;
      updateQuery({ page: nextPage.id, mode: nextMode });
    },
    [updateQuery, workspaceMode]
  );

  const handleSelectWorkspaceMode = React.useCallback(
    (mode: CanvasWorkspaceMode) => {
      if (!selectedManagedPage.allowedModes.includes(mode)) {
        return;
      }

      updateQuery({ mode });
    },
    [selectedManagedPage.allowedModes, updateQuery]
  );

  const handleSelectAccessRole = React.useCallback(
    (role: CanvasAccessRole) => {
      updateQuery({ role });
    },
    [updateQuery]
  );

  const loadLists = React.useCallback(async () => {
    setLoadingLists(true);
    try {
      const [templateItems, documentItems] = await Promise.all([
        fetchSuccessData<TemplateRecordDto[]>('/api/templates?limit=128'),
        fetchSuccessData<DocumentListItem[]>('/api/documents?latestOnly=true'),
      ]);
      setTemplates(templateItems);
      setDocuments(documentItems);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '캔버스 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingLists(false);
    }
  }, []);

  React.useEffect(() => {
    void loadLists();
  }, [loadLists]);

  React.useEffect(() => {
    if (effectiveWorkspaceMode === 'template' || !selectedDocumentId) {
      setSelectedDocumentDetail(null);
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoadingDocumentDetail(true);
      try {
        const detail = await fetchSuccessData<DocumentDetailResult>(
          `/api/documents/${encodeURIComponent(selectedDocumentId)}`
        );

        if (!cancelled) {
          setSelectedDocumentDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDocumentDetail(null);
          setMessage(error instanceof Error ? error.message : '문서 상세를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoadingDocumentDetail(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [effectiveWorkspaceMode, selectedDocumentId]);

  const documentOptions = React.useMemo<EntityPickerOption[]>(
    () =>
      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        meta: `${item.document.id} · 버전 ${item.latestVersion?.versionNumber || 0}`,
        keywords: [item.document.documentTypeKey, item.document.siteId],
      })),
    [documents]
  );

  const attachmentFilesByValueKey = React.useMemo(
    () => groupDocumentValueFilesByValueKey(selectedDocumentDetail?.valueFiles || []),
    [selectedDocumentDetail]
  );

  const selectedDocumentLabelValues = React.useMemo(() => {
    if (!selectedDocumentDetail) {
      return {};
    }

    return {
      ...mergeDocumentCanvasLabelValues(
        selectedDocumentDetail.latestVersion?.labelValues || {},
        selectedDocumentDetail.valueEntries
      ),
      ...buildDocumentAttachmentTextByValueKey(selectedDocumentDetail.valueFiles || []),
    };
  }, [selectedDocumentDetail]);

  const selectedDocumentInitialDraft = React.useMemo<TemplateEditWorkspaceInitialDraft | null>(() => {
    if (!selectedDocumentDetail) {
      return null;
    }

    const draftHtml = materializeDocumentCanvasHtml({
      linkedRenderHtml:
        selectedDocumentDetail.linkedTemplate?.draftHtml || selectedDocumentDetail.linkedTemplate?.renderSnapshotHtml,
      latestVersionHtml: selectedDocumentDetail.latestVersion?.htmlCanonical,
      labelValues: selectedDocumentLabelValues,
    });

    if (!draftHtml.trim()) {
      return null;
    }

    return {
      draftKey: `${selectedManagedPage.id}:${selectedCanvasAccessRole}:${effectiveWorkspaceMode}:${selectedDocumentDetail.document.id}:${selectedDocumentDetail.latestVersion?.id || 'no-version'}:${buildDocumentHtmlContentKey(draftHtml)}:${draftReloadNonce}`,
      templateName: selectedDocumentDetail.document.title,
      draftHtml,
      sourceDocumentName: '',
      layoutResizeMode: 'grow_height',
      attachmentFilesByValueKey,
    };
  }, [
    attachmentFilesByValueKey,
    draftReloadNonce,
    effectiveWorkspaceMode,
    selectedCanvasAccessRole,
    selectedDocumentDetail,
    selectedDocumentLabelValues,
    selectedManagedPage.id,
  ]);

  const handleSaveDocumentDraft = React.useCallback(
    async ({ currentHtml, attachmentDrafts }: TemplateEditWorkspaceSaveDraftParams) => {
      if (!selectedDocumentDetail?.document.id) {
        throw new Error('문서를 먼저 선택해 주세요.');
      }

      const nextLabelValues = extractDocumentCanvasLabelValuesFromHtml(currentHtml, selectedDocumentLabelValues);
      const nextValueFiles = await buildDocumentAttachmentValueFilesForSave({
        attachmentApiPath: `/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/attachments`,
        attachmentDrafts,
      });
      const persistedHtml = materializeTemplateCanvasHtmlForPersistence(currentHtml, {
        attachmentFiles: nextValueFiles,
      });

      const response = await fetch(`/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCanonical: persistedHtml,
          labelValues: nextLabelValues,
          valueFiles: nextValueFiles,
          changeReason: 'canvas-owner-edit',
          createdBy: 'canvas-owner-page',
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '문서 저장에 실패했습니다.');
      }

      const refreshedDetail = await fetchSuccessData<DocumentDetailResult>(
        `/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}`
      );
      setSelectedDocumentDetail(refreshedDetail);
      await loadLists();
      setOwnerEventMessage('문서 모드 저장 콜백이 실행되었습니다.');

      return {
        successMessage: '문서 저장을 완료했습니다.',
      };
    },
    [loadLists, selectedDocumentDetail, selectedDocumentLabelValues]
  );

  const selectedTemplateSummary = templates.find((item) => item.id === selectedTemplateId) || null;
  const previewEffectiveHeaderTitle = previewSettings.headerTitle.trim() || '상자 편집 캔버스';
  const previewEffectiveHeaderDescription = previewSettings.headerDescription.trim() || '공용 캔버스 owner 경로입니다.';
  const previewEffectiveNameFieldLabel = previewSettings.nameFieldLabel.trim() || '문서 이름:';
  const previewEffectiveSaveButtonLabel = previewSettings.saveButtonLabel.trim() || '문서 저장';
  const editableValueKeyCandidates = React.useMemo(
    () => Object.keys(selectedDocumentLabelValues).filter((key) => String(key || '').trim().length > 0).slice(0, 3),
    [selectedDocumentLabelValues]
  );
  const selectedPageAllowsEditableValueKeys =
    selectedManagedPage.surface === 'canvas' || selectedManagedPage.surface === 'request-links';
  const effectiveEditableValueKeys =
    selectedAccessMode !== 'edit' ||
    effectiveWorkspaceMode !== 'document' ||
    !previewSettings.limitEditableValueKeys ||
    !selectedPageAllowsEditableValueKeys
      ? null
      : editableValueKeyCandidates;
  const topNotice = previewSettings.showTopNotice ? (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      owner page sample `topNotice`가 켜진 상태입니다. 현재 페이지: {selectedManagedPage.label} · 권한:{' '}
      {canvasAccessRoleLabels[selectedCanvasAccessRole]} · 모드: {effectiveWorkspaceMode}
    </div>
  ) : null;
  const extractStatusNotice = extractStatus ? (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {extractStatus.kind === 'approve' ? (
              <>
                <p className="font-medium text-slate-950">저장 완료</p>
                <p>템플릿 ID: {extractStatus.templateId}</p>
              </>
            ) : (
              <p>{extractStatus.message}</p>
            )}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="알림 닫기"
            title="알림 닫기"
            onClick={() => {
              setExtractStatus(null);
              setExtractStatusResetKey((previous) => previous + 1);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  ) : null;
  const canUseTemplateExtractPanel =
    selectedAccessMode === 'edit' &&
    effectiveWorkspaceMode === 'template' &&
    ['canvas', 'templates'].includes(selectedManagedPage.id);
  const templateExtractPanel =
    canUseTemplateExtractPanel ? (
      <TemplateExtractWorkspace
        hideHeader
        showSaveControls={false}
        showPreview={false}
        showStatusSection={false}
        statusResetKey={extractStatusResetKey}
        autoSaveOnExtract
        onAutoSaveComplete={(result) => {
          updateQuery({ mode: 'template', templateId: result.templateId });
          setOwnerEventMessage(`PDF 추출 저장 완료: ${result.templateId}`);
          void loadLists();
        }}
        onStatusChange={setExtractStatus}
      />
    ) : null;
  const additionalControlPanels = (
    <>
      {templateExtractPanel}
      {previewSettings.showAdditionalControlPanels ? (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="font-medium text-slate-900">additionalControlPanels 샘플</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        TemplatePersistencePanel 위에 외부 제어 패널을 삽입하는 public prop 상태를 여기서 확인합니다.
      </p>
    </div>
      ) : null}
    </>
  );
  const effectiveDocumentAttachmentApiPath =
    effectiveWorkspaceMode === 'document' &&
    selectedAccessMode === 'edit' &&
    previewSettings.enableDocumentAttachmentApiPath &&
    selectedDocumentDetail
      ? `/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/attachments`
      : '';
  const effectiveCanvasToolbarVisibility = React.useMemo(
    () => buildCanvasToolbarVisibility(previewSettings, effectiveWorkspaceMode),
    [effectiveWorkspaceMode, previewSettings]
  );
  const effectivePersistenceVisibility = React.useMemo(
    () => buildPersistenceVisibility(previewSettings),
    [previewSettings]
  );
  const templateUsagePreviewLayoutDebugOptions = React.useMemo(
    () => buildTemplateUsagePreviewLayoutDebugOptions(previewSettings),
    [previewSettings]
  );
  const previewDocumentId = selectedDocumentDetail?.document.id || selectedDocumentId;
  const routeEquivalentPreviewProps: CanvasRoutePreviewProps | null = (() => {
    if (selectedManagedPage.id === 'canvas') {
      return null;
    }

    if (selectedManagedPage.id === 'templates') {
      return {
        hideHeader: false,
        hidePersistencePanel: false,
        templateListDisplay: 'inline',
        additionalControlPanels: templateExtractPanel,
        topNotice: extractStatusNotice,
        showWorkspaceMessages: true,
        suppressInitialDraftLoadedMessage: true,
        headerTitle: '템플릿 편집',
        headerDescription: '저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.',
        nameFieldLabel: '템플릿 이름:',
        saveButtonLabel: '저장',
        templateNameReadOnly: false,
        saveDisabled: selectedAccessMode !== 'edit',
      };
    }

    if (selectedManagedPage.id === 'templates-edit') {
      return {
        hideHeader: false,
        hidePersistencePanel: false,
        templateListDisplay: 'inline',
        showWorkspaceMessages: true,
        suppressInitialDraftLoadedMessage: false,
        headerTitle: '템플릿 편집',
        headerDescription: '저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.',
        nameFieldLabel: '템플릿 이름:',
        saveButtonLabel: '저장',
        templateNameReadOnly: false,
        saveDisabled: selectedAccessMode !== 'edit',
      };
    }

    if (selectedManagedPage.id === 'documents') {
      return {
        hideHeader: true,
        hidePersistencePanel: true,
        editableValueKeys: null,
        showWorkspaceMessages: true,
        suppressInitialDraftLoadedMessage: true,
        headerTitle: '템플릿 편집',
        headerDescription: '저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.',
        nameFieldLabel: '템플릿 이름:',
        saveButtonLabel: '저장',
        templateNameReadOnly: true,
        saveDisabled: true,
        documentAttachmentApiPath: '',
      };
    }

    if (selectedManagedPage.id === 'project') {
      return {
        hideHeader: true,
        hidePersistencePanel: true,
        editableValueKeys: null,
        showWorkspaceMessages: true,
        suppressInitialDraftLoadedMessage: true,
        headerTitle: '템플릿 편집',
        headerDescription: '저장된 템플릿을 불러와 상자 편집 캔버스에서 수정하고 다시 저장합니다.',
        nameFieldLabel: '문서 이름:',
        saveButtonLabel: '문서 저장',
        templateNameReadOnly: true,
        saveDisabled: selectedAccessMode !== 'edit' || effectiveWorkspaceMode !== 'document',
        documentAttachmentApiPath:
          previewDocumentId && selectedAccessMode === 'edit' && effectiveWorkspaceMode === 'document'
            ? `/api/documents/${encodeURIComponent(previewDocumentId)}/attachments`
            : '',
      };
    }

    if (selectedManagedPage.id === 'request-links') {
      return {
        hideHeader: false,
        hidePersistencePanel: true,
        editableValueKeys: effectiveWorkspaceMode === 'document' ? effectiveEditableValueKeys : null,
        showWorkspaceMessages: true,
        suppressInitialDraftLoadedMessage: true,
        headerTitle: '상자 편집 캔버스',
        headerDescription: '요청 링크에서 허용된 항목만 기록할 수 있습니다.',
        nameFieldLabel: '템플릿 이름:',
        saveButtonLabel: '문서 저장',
        templateNameReadOnly: true,
        saveDisabled: selectedAccessMode !== 'edit' || effectiveWorkspaceMode !== 'document' || loadingDocumentDetail,
        documentAttachmentApiPath: '',
      };
    }

    return {
      hideHeader: false,
      hidePersistencePanel: true,
      editableValueKeys: null,
      showWorkspaceMessages: true,
      suppressInitialDraftLoadedMessage: false,
      headerTitle: '구성원 문서 접근',
      headerDescription: '초대된 권한 범위 안에서 현장 문서를 열람하거나 수정합니다.',
      nameFieldLabel: '문서 이름:',
      saveButtonLabel: effectiveWorkspaceMode === 'document' && selectedAccessMode === 'edit' ? '문서 저장' : '열람 전용',
      templateNameReadOnly: true,
      saveDisabled: selectedAccessMode !== 'edit' || effectiveWorkspaceMode !== 'document',
      documentAttachmentApiPath:
        selectedAccessMode === 'edit' && effectiveWorkspaceMode === 'document' && previewDocumentId
          ? `/api/member-access/documents/${encodeURIComponent(previewDocumentId)}/attachments`
          : '',
    };
	  })();
	  const routeEquivalentPreviewEnabled = routeEquivalentPreviewProps !== null;
	  const canvasOwnerPreviewBaseProps: CanvasRoutePreviewProps = {
	    hideHeader: false,
	    hidePersistencePanel: false,
	    templateListDisplay: 'inline',
	    editableValueKeys: effectiveEditableValueKeys,
	    additionalControlPanels,
	    topNotice,
	    showWorkspaceMessages: true,
	    suppressInitialDraftLoadedMessage: false,
	    headerTitle: defaultCanvasOwnerSettings.headerTitle,
	    headerDescription: defaultCanvasOwnerSettings.headerDescription,
	    nameFieldLabel: defaultCanvasOwnerSettings.nameFieldLabel,
	    saveButtonLabel: defaultCanvasOwnerSettings.saveButtonLabel,
	    templateNameReadOnly: false,
	    saveDisabled:
        selectedAccessMode !== 'edit' ||
        effectiveWorkspaceMode === 'read' ||
        (effectiveWorkspaceMode === 'document' && loadingDocumentDetail),
	    documentAttachmentApiPath: effectiveDocumentAttachmentApiPath,
	  };
	  const previewWorkspaceProps = applyCanvasOwnerSettingsToWorkspaceProps({
	    baseProps: routeEquivalentPreviewProps ?? canvasOwnerPreviewBaseProps,
	    settings: previewSettings,
	    settingSources: previewSettingSources,
	    workspaceMode: effectiveWorkspaceMode,
	  });
	  const previewHideHeader = Boolean(previewWorkspaceProps.hideHeader);
	  const previewHidePersistencePanel = Boolean(previewWorkspaceProps.hidePersistencePanel);
	  const previewTemplateListDisplay = previewWorkspaceProps.templateListDisplay ?? previewSettings.templateListDisplay;
	  const previewEditableValueKeys = previewWorkspaceProps.editableValueKeys ?? null;
	  const previewAdditionalControlPanels = previewWorkspaceProps.additionalControlPanels;
	  const previewTopNotice = previewWorkspaceProps.topNotice;
	  const previewShowWorkspaceMessages = previewWorkspaceProps.showWorkspaceMessages !== false;
	  const previewSuppressInitialDraftLoadedMessage = Boolean(previewWorkspaceProps.suppressInitialDraftLoadedMessage);
	  const previewHeaderTitle = previewWorkspaceProps.headerTitle ?? previewEffectiveHeaderTitle;
	  const previewHeaderDescription = previewWorkspaceProps.headerDescription ?? previewEffectiveHeaderDescription;
	  const previewNameFieldLabel = previewWorkspaceProps.nameFieldLabel ?? previewEffectiveNameFieldLabel;
	  const previewSaveButtonLabel = previewWorkspaceProps.saveButtonLabel ?? previewEffectiveSaveButtonLabel;
	  const previewTemplateNameReadOnly = Boolean(previewWorkspaceProps.templateNameReadOnly);
	  const previewSaveDisabled = Boolean(previewWorkspaceProps.saveDisabled);
	  const previewCanvasPageContainerWidth = previewWorkspaceProps.canvasPageContainerWidth ?? '';
	  const previewCanvasPageContainerHeight = previewWorkspaceProps.canvasPageContainerHeight ?? '';
	  const previewCanvasSpecifiedHeightEnabled = Boolean(previewWorkspaceProps.canvasSpecifiedHeightEnabled);
	  const previewCanvasSpecifiedHeight = previewWorkspaceProps.canvasSpecifiedHeight ?? '';
	  const previewCanvasSpecifiedWidthEnabled = Boolean(previewWorkspaceProps.canvasSpecifiedWidthEnabled);
	  const previewCanvasSpecifiedWidth = previewWorkspaceProps.canvasSpecifiedWidth ?? '';
	  const previewDocumentAttachmentApiPath = previewWorkspaceProps.documentAttachmentApiPath ?? '';
	  const previewCanvasToolbarVisibility = previewWorkspaceProps.canvasToolbarVisibility ?? effectiveCanvasToolbarVisibility;
	  const previewPersistenceVisibility = previewWorkspaceProps.persistenceVisibility ?? effectivePersistenceVisibility;
	  const previewTemplateUsagePreviewLayoutDebugOptions =
	    previewWorkspaceProps.templateUsagePreviewLayoutDebugOptions ?? templateUsagePreviewLayoutDebugOptions;
	  const previewUsesRouteProps = routeEquivalentPreviewEnabled
	    ? 'route-defaults + canvas-owner-settings'
	    : 'canvas-owner-settings';
	  const previewAdditionalControlPanelsEnabled =
	    selectedManagedPage.id === 'templates' || (!routeEquivalentPreviewEnabled && Boolean(templateExtractPanel || previewSettings.showAdditionalControlPanels));
	  const previewTopNoticeEnabled = Boolean(previewTopNotice);
  const settingKeyByDefinitionName: Record<string, CanvasOwnerSettingKey> = {
    hideHeader: 'hideHeader',
    hidePersistencePanel: 'hidePersistencePanel',
    showTopNotice: 'showTopNotice',
    showWorkspaceMessages: 'showWorkspaceMessages',
    showAdditionalControlPanels: 'showAdditionalControlPanels',
    'canvasToolbarVisibility.showCanvasTitle': 'showCanvasTitle',
    'canvasToolbarVisibility.showTemplateNameInput': 'showCanvasNameField',
    'canvasToolbarVisibility.showSaveButton': 'showCanvasSaveButton',
    'canvasToolbarVisibility.showPreviewToggle': 'showCanvasPreviewToggle',
    'canvasToolbarVisibility.showInteractionModeControls': 'showCanvasInteractionModeControls',
    'canvasToolbarVisibility.showHistoryControls': 'showCanvasHistoryControls',
    'canvasToolbarVisibility.showZoomControls': 'showCanvasZoomControls',
    'canvasToolbarVisibility.showFullscreenControl': 'showCanvasFullscreenControl',
    defaultCanvasFullscreen: 'defaultCanvasFullscreen',
    pageContainerWidth: 'pageContainerWidth',
    pageContainerHeight: 'pageContainerHeight',
    autoCanvasHeight: 'autoCanvasHeight',
    autoCanvasWidth: 'autoCanvasWidth',
    useSpecifiedCanvasHeight: 'useSpecifiedCanvasHeight',
    specifiedCanvasHeight: 'specifiedCanvasHeight',
    specifiedCanvasWidth: 'specifiedCanvasWidth',
    'canvasToolbarVisibility.showEditSettingsToggle': 'showCanvasEditSettingsToggle',
    'canvasToolbarVisibility.showSelectionPanelTabs': 'showCanvasSelectionPanelTabs',
    'persistenceVisibility.showTemplateList': 'showPersistenceTemplateList',
    'persistenceVisibility.showTemplateNameInput': 'showPersistenceTemplateNameField',
    'persistenceVisibility.showLayoutResizeModeSelect': 'showPersistenceLayoutResizeModeField',
    'persistenceVisibility.showSourceDocumentNameInput': 'showPersistenceSourceDocumentNameField',
    'persistenceVisibility.showSaveButton': 'showPersistenceSaveButton',
    suppressInitialDraftLoadedMessage: 'suppressInitialDraftLoadedMessage',
    stabilizeInitialLayout: 'stabilizeInitialLayout',
    enableRuntimeInitialAutoSize: 'enableRuntimeInitialAutoSize',
    preventInitialValueClearShrink: 'preventInitialValueClearShrink',
    blockPeerClusterHeightTargets: 'blockPeerClusterHeightTargets',
    blockPeerClusterWidthTargets: 'blockPeerClusterWidthTargets',
    preventRuntimeAutoSizeShrink: 'preventRuntimeAutoSizeShrink',
    templateNameReadOnly: 'templateNameReadOnly',
    saveDisabled: 'saveDisabled',
    enableDocumentAttachmentApiPath: 'enableDocumentAttachmentApiPath',
    limitEditableValueKeys: 'limitEditableValueKeys',
    onTemplateSaved: 'enableOnTemplateSaved',
    headerTitle: 'headerTitle',
    headerDescription: 'headerDescription',
    nameFieldLabel: 'nameFieldLabel',
    saveButtonLabel: 'saveButtonLabel',
    templateListDisplay: 'templateListDisplay',
  };
  const getSettingKeyForDefinitionName = (definitionName: string): CanvasOwnerSettingKey | null =>
    settingKeyByDefinitionName[definitionName] || null;
  const getSettingSourceLabel = (source: CanvasOwnerSettingSource) =>
    source === 'page'
      ? '페이지'
      : source === 'page-role'
        ? '페이지 권한'
        : source === 'role-mode'
          ? '권한 모드'
          : source === 'mode'
            ? '모드'
            : '기본';
  const getModeManagedClassName = (settingKey: CanvasOwnerSettingKey | null) =>
    activeControlTab === 'page' &&
    settingKey &&
    (settingSources[settingKey] === 'mode' || settingSources[settingKey] === 'role-mode')
      ? 'border-slate-300 bg-slate-100'
      : 'bg-white';
  const getTextSettingClassName = (settingKey: CanvasOwnerSettingKey) =>
    `space-y-1 rounded border px-2 py-1 ${getModeManagedClassName(settingKey)}`;
  const renderSettingSourceBadge = (settingKey: CanvasOwnerSettingKey) => (
    <span className="text-[9px] font-semibold text-slate-400">{getSettingSourceLabel(settingSources[settingKey])}</span>
  );
  const formatOptionalBooleanProp = (value: boolean | undefined) =>
    value === undefined ? 'not passed' : value ? 'true' : 'false';
  const canvasConfigRows = [
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '워크스페이스 헤더 숨김',
      definitionName: 'hideHeader',
      description: '공용 캔버스 내부 제목과 설명 헤더를 렌더링하지 않습니다.',
      checked: settings.hideHeader,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('hideHeader', checked),
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '불러오기 및 저장 패널 숨김',
      definitionName: 'hidePersistencePanel',
      description: '템플릿 이름, 원본 문서명, 저장 버튼이 포함된 패널을 숨깁니다.',
      checked: settings.hidePersistencePanel,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('hidePersistencePanel', checked),
    },
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '상단 알림 표시',
      definitionName: 'showTopNotice',
      description: '외부에서 topNotice로 주입하는 상단 안내 영역을 표시합니다.',
      checked: settings.showTopNotice,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showTopNotice', checked),
    },
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '실행 알림 표시',
      definitionName: 'showWorkspaceMessages',
      description: 'setMessage(...)로 출력되는 상자 편집 캔버스 내부 실행 알림을 표시합니다. topNotice와는 별개입니다.',
      checked: settings.showWorkspaceMessages,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showWorkspaceMessages', checked),
    },
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '추가 제어 패널',
      definitionName: 'showAdditionalControlPanels',
      description: '기본 툴바 외의 보조 제어 패널을 함께 표시합니다.',
      checked: settings.showAdditionalControlPanels,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showAdditionalControlPanels', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '캔버스 제목 표시',
      definitionName: 'canvasToolbarVisibility.showCanvasTitle',
      description: '상자 편집 캔버스 카드 상단의 제목을 표시합니다.',
      checked: settings.showCanvasTitle,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasTitle', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '이름 입력 표시',
      definitionName: 'canvasToolbarVisibility.showTemplateNameInput',
      description: '캔버스 상단 이름 입력 영역을 표시합니다. 문서/읽기 모드에서는 모드 정책상 숨겨집니다.',
      checked: settings.showCanvasNameField,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasNameField', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '상단 저장 버튼 표시',
      definitionName: 'canvasToolbarVisibility.showSaveButton',
      description: '캔버스 상단 저장 버튼을 표시합니다. 읽기 모드에서는 모드 정책상 숨겨집니다.',
      checked: settings.showCanvasSaveButton,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasSaveButton', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '미리보기 버튼 표시',
      definitionName: 'canvasToolbarVisibility.showPreviewToggle',
      description: '템플릿 모드에서 실제 사용 미리보기/편집 모드 전환 버튼을 표시합니다. 문서/읽기 모드에서는 숨겨집니다.',
      checked: settings.showCanvasPreviewToggle,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasPreviewToggle', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '선택/이동 표시',
      definitionName: 'canvasToolbarVisibility.showInteractionModeControls',
      description: '선택 모드와 이동 모드 전환 버튼을 표시합니다. 템플릿 모드에서만 유효합니다.',
      checked: settings.showCanvasInteractionModeControls,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasInteractionModeControls', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '실행 기록 표시',
      definitionName: 'canvasToolbarVisibility.showHistoryControls',
      description: '되돌리기와 다시 실행 버튼을 표시합니다.',
      checked: settings.showCanvasHistoryControls,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasHistoryControls', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '확대/축소 표시',
      definitionName: 'canvasToolbarVisibility.showZoomControls',
      description: '문서 확대/축소 슬라이더와 버튼을 표시합니다.',
      checked: settings.showCanvasZoomControls,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasZoomControls', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '전체 화면 표시',
      definitionName: 'canvasToolbarVisibility.showFullscreenControl',
      description: '전체 화면 진입/종료 버튼을 표시합니다.',
      checked: settings.showCanvasFullscreenControl,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasFullscreenControl', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '초기 전체 화면',
      definitionName: 'defaultCanvasFullscreen',
      description: '상자 편집 캔버스를 처음 열 때 전체 화면 상태로 시작합니다.',
      checked: settings.defaultCanvasFullscreen,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('defaultCanvasFullscreen', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '편집 설정 표시',
      definitionName: 'canvasToolbarVisibility.showEditSettingsToggle',
      description: '상자 편집 패널 열기/닫기 버튼을 표시합니다. 템플릿 모드에서만 유효합니다.',
      checked: settings.showCanvasEditSettingsToggle,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasEditSettingsToggle', checked),
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '편집 탭 표시',
      definitionName: 'canvasToolbarVisibility.showSelectionPanelTabs',
      description: '크기 및 위치/속성 탭 전환 버튼을 표시합니다. 템플릿 모드에서만 유효합니다.',
      checked: settings.showCanvasSelectionPanelTabs,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showCanvasSelectionPanelTabs', checked),
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '템플릿 목록 표시',
      definitionName: 'persistenceVisibility.showTemplateList',
      description: '불러오기 및 저장 안의 템플릿 선택 목록을 표시합니다.',
      checked: settings.showPersistenceTemplateList,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('showPersistenceTemplateList', checked),
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '템플릿 이름 표시',
      definitionName: 'persistenceVisibility.showTemplateNameInput',
      description: '불러오기 및 저장 안의 템플릿 이름 입력을 표시합니다.',
      checked: settings.showPersistenceTemplateNameField,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('showPersistenceTemplateNameField', checked),
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '레이아웃 정책 표시',
      definitionName: 'persistenceVisibility.showLayoutResizeModeSelect',
      description: '불러오기 및 저장 안의 레이아웃 확장 정책 선택을 표시합니다.',
      checked: settings.showPersistenceLayoutResizeModeField,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('showPersistenceLayoutResizeModeField', checked),
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '원본 문서명 표시',
      definitionName: 'persistenceVisibility.showSourceDocumentNameInput',
      description: '불러오기 및 저장 안의 원본 문서명 읽기 전용 필드를 표시합니다.',
      checked: settings.showPersistenceSourceDocumentNameField,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('showPersistenceSourceDocumentNameField', checked),
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '하단 저장 버튼 표시',
      definitionName: 'persistenceVisibility.showSaveButton',
      description: '불러오기 및 저장 안의 전체 너비 저장 버튼을 표시합니다.',
      checked: settings.showPersistenceSaveButton,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('showPersistenceSaveButton', checked),
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '초기 초안 로드 안내 억제',
      definitionName: 'suppressInitialDraftLoadedMessage',
      description: '초기 draft 로드 완료 메시지를 사용자 알림으로 출력하지 않습니다.',
      checked: settings.suppressInitialDraftLoadedMessage,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('suppressInitialDraftLoadedMessage', checked),
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '초기 레이아웃 안정화',
      definitionName: 'stabilizeInitialLayout',
      description: '미리보기 HTML 생성 직후 숨김 측정으로 자동 크기와 peer edge 배치를 먼저 확정합니다.',
      checked: settings.stabilizeInitialLayout,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('stabilizeInitialLayout', checked),
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '런타임 초기 자동 크기',
      definitionName: 'enableRuntimeInitialAutoSize',
      description: '미리보기 런타임 연결 직후 자동 높이와 자동 너비 계산을 한 번 더 실행합니다.',
      checked: settings.enableRuntimeInitialAutoSize,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('enableRuntimeInitialAutoSize', checked),
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '초기 value 제거 축소 방지',
      definitionName: 'preventInitialValueClearShrink',
      description: '미리보기 HTML 안정화 중 자동 크기 대상이 아닌 프레임이 예시 value 제거 영향으로 줄어드는 것을 막습니다. 자동 높이/너비 상자는 자체 규칙을 우선합니다.',
      checked: settings.preventInitialValueClearShrink,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('preventInitialValueClearShrink', checked),
    },
    {
      sectionKey: 'peerAutoSize',
      sectionLabel: 'Peer Edge/자동 크기',
      label: 'peer cluster 높이 측정 차단',
      definitionName: 'blockPeerClusterHeightTargets',
      description: '자동 높이 측정 시 같은 peer cluster의 연동 높이 대상을 제외하고 현재 상자 기준으로 계산합니다.',
      checked: settings.blockPeerClusterHeightTargets,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('blockPeerClusterHeightTargets', checked),
    },
    {
      sectionKey: 'peerAutoSize',
      sectionLabel: 'Peer Edge/자동 크기',
      label: 'peer cluster 너비 측정 차단',
      definitionName: 'blockPeerClusterWidthTargets',
      description: '자동 너비 측정 시 같은 peer cluster의 연동 너비 대상을 제외하고 현재 상자 기준으로 계산합니다.',
      checked: settings.blockPeerClusterWidthTargets,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('blockPeerClusterWidthTargets', checked),
    },
    {
      sectionKey: 'peerAutoSize',
      sectionLabel: 'Peer Edge/자동 크기',
      label: '런타임 자동 크기 축소 차단',
      definitionName: 'preventRuntimeAutoSizeShrink',
      description: '입력, 첨부, 서명 이후 자동 크기 재계산에서 음수 delta를 차단합니다. 기본 OFF가 자동 높이 축소/확장 정상 동작입니다.',
      checked: settings.preventRuntimeAutoSizeShrink,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('preventRuntimeAutoSizeShrink', checked),
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '이름 입력 읽기 전용',
      definitionName: 'templateNameReadOnly',
      description: '이름 입력 필드는 표시하되 사용자가 직접 수정할 수 없게 합니다.',
      checked: settings.templateNameReadOnly,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('templateNameReadOnly', checked),
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '저장 비활성',
      definitionName: 'saveDisabled',
      description: '저장 버튼을 렌더링하지만 클릭할 수 없는 상태로 만듭니다.',
      checked: settings.saveDisabled,
      disabled: effectiveWorkspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('saveDisabled', checked),
    },
    {
      sectionKey: 'documentBinding',
      sectionLabel: '문서 연동',
      label: '첨부파일 API 연결',
      definitionName: 'enableDocumentAttachmentApiPath',
      description: '문서 모드에서 첨부파일 상자가 실제 문서 첨부 API를 사용하게 합니다.',
      checked: settings.enableDocumentAttachmentApiPath,
      disabled: effectiveWorkspaceMode === 'template',
      onCheckedChange: (checked: boolean) => updateSetting('enableDocumentAttachmentApiPath', checked),
    },
    {
      sectionKey: 'documentBinding',
      sectionLabel: '문서 연동',
      label: '편집 가능 value 키 제한',
      definitionName: 'limitEditableValueKeys',
      description: '문서 모드에서 전달된 editableValueKeys에 포함된 value 상자만 수정할 수 있게 제한합니다.',
      checked: settings.limitEditableValueKeys,
      disabled:
        effectiveWorkspaceMode === 'template' ||
        selectedAccessMode !== 'edit' ||
        !selectedPageAllowsEditableValueKeys ||
        editableValueKeyCandidates.length === 0,
      onCheckedChange: (checked: boolean) => updateSetting('limitEditableValueKeys', checked),
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '저장 완료 콜백 연결',
      definitionName: 'onTemplateSaved',
      description: '템플릿 저장 성공 시 owner 페이지의 저장 후처리 콜백을 실행합니다.',
      checked: settings.enableOnTemplateSaved,
      disabled: effectiveWorkspaceMode !== 'template' || selectedAccessMode !== 'edit',
      onCheckedChange: (checked: boolean) => updateSetting('enableOnTemplateSaved', checked),
    },
  ];
  const canvasConfigSections = [
    {
      key: 'workspaceFrame',
      label: '공용 프레임',
      description: '공용 캔버스 외곽 헤더, 알림, 외부 주입 패널 출력 여부입니다.',
    },
    {
      key: 'canvasEditor',
      label: '상자 캔버스 편집',
      description: '공용 캔버스 카드 안의 제목, 툴바 버튼, 편집 패널 진입 버튼 출력 여부입니다.',
    },
    {
      key: 'persistencePanel',
      label: '불러오기 및 저장',
      description: '템플릿 목록, 이름, 원본 문서명, 레이아웃 정책, 저장 버튼 출력 여부입니다.',
    },
    {
      key: 'initialLayout',
      label: '초기 로드/레이아웃',
      description: '초기 초안 로드 알림과 미리보기 진입 시 레이아웃 안정화 실행 여부입니다.',
    },
    {
      key: 'peerAutoSize',
      label: 'Peer Edge/자동 크기',
      description: '자동 높이와 자동 너비 계산에서 peer cluster 연동 대상을 포함할지 정합니다.',
    },
    {
      key: 'saveInput',
      label: '입력/저장',
      description: '이름 입력, 저장 버튼, 저장 완료 콜백의 사용 가능 상태입니다.',
    },
    {
      key: 'documentBinding',
      label: '문서 연동',
      description: '문서 모드에서 값 입력 제한과 첨부파일 API 연결 방식을 정합니다.',
    },
  ].map((section) => ({
    ...section,
    rows: canvasConfigRows.filter((row) => row.sectionKey === section.key),
  }));
  const effectiveTemplateWorkspacePropRows = [
    {
      section: 'Page routing',
      name: 'page',
      value: selectedManagedPage.id,
      description: '공용 캔버스를 사용하는 서비스 페이지입니다. 페이지는 모드와 분리해서 관리합니다.',
    },
    {
      section: 'Page routing',
      name: 'route',
      value: selectedManagedPage.path,
      description: '선택한 페이지의 실제 라우트 또는 동적 라우트 패턴입니다.',
    },
    {
      section: 'Page routing',
      name: 'allowedModes',
      value: selectedManagedPage.allowedModes.join(', '),
      description: '해당 페이지의 owner policy가 허용하는 workspaceMode 목록입니다.',
    },
    {
      section: 'Page routing',
      name: 'defaultMode',
      value: selectedManagedPage.defaultMode,
      description: '해당 페이지에서 별도 선택이 없을 때 사용하는 기본 모드입니다.',
    },
    {
      section: 'Owner policy',
      name: 'surface',
      value: selectedManagedPage.surface,
      description: 'CanvasOwnedWorkspace가 허용 정책을 검증할 owner surface입니다.',
    },
    {
      section: 'Owner policy',
      name: 'selectedWorkspaceMode',
      value: workspaceMode,
      description: '왼쪽 모드 선택에서 고른 기준 모드입니다.',
    },
    {
      section: 'Owner policy',
      name: 'selectedAccessRole',
      value: canvasAccessRoleLabels[selectedCanvasAccessRole],
      description: '권한자별 접근에서 선택한 현재 권한자입니다.',
    },
    {
      section: 'Owner policy',
      name: 'accessMode',
      value: selectedAccessMode === 'edit' ? '편집' : '보기',
      description: '선택한 권한자가 이 페이지에서 사용할 실제 접근 상태입니다.',
    },
    {
      section: 'Owner policy',
      name: 'effectiveWorkspaceMode',
      value: effectiveWorkspaceMode,
      description: '선택한 권한자의 접근 상태를 반영해 공용 캔버스에 전달하는 실제 모드입니다.',
    },
    {
      section: 'Owner policy',
      name: 'accessPreview',
      value: accessPreviewUnavailable ? 'unavailable' : 'enabled',
      description: accessPreviewUnavailable
        ? '선택한 페이지 정책이 이 권한자의 보기 모드를 허용하지 않습니다.'
        : '선택한 권한자의 상태로 캔버스를 확인합니다.',
    },
    {
      section: 'Owner policy',
      name: 'canvasOwnerSettingsState',
      value: routeEquivalentPreviewEnabled
        ? previewUsesRouteProps
        : hasUnsavedCanvasSettings
          ? 'draft-preview-only'
          : 'saved',
      description: '서비스 페이지 기본 props 위에 현재 상자 편집 캔버스 환경설정을 적용한 effective 상태입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'initialTemplateId',
      value: effectiveWorkspaceMode === 'template' ? selectedTemplateId || '-' : '-',
      description: '템플릿 모드에서 최초로 불러올 템플릿 ID입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'initialDraft',
      value: selectedDocumentInitialDraft ? selectedDocumentInitialDraft.draftKey : 'null',
      description: '문서/읽기 모드에서 공용 캔버스에 주입되는 문서 초안입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'editableValueKeys',
      value: previewEditableValueKeys?.length ? previewEditableValueKeys.join(', ') : 'null',
      description: '문서 모드에서 수정 가능한 value 키 목록입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'hideHeader',
      value: previewHideHeader ? 'true' : 'false',
      description: '공용 캔버스 내부 헤더 출력 여부를 제어합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'hidePersistencePanel',
      value: previewHidePersistencePanel ? 'true' : 'false',
      description: '불러오기 및 저장 패널 출력 여부를 제어합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'templateListDisplay',
      value: effectiveWorkspaceMode === 'template' ? previewTemplateListDisplay : 'not passed',
      description: '템플릿 목록을 picker 또는 inline으로 출력합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'additionalControlPanels',
      value: previewAdditionalControlPanelsEnabled ? 'enabled' : 'disabled',
      description: 'PDF 추출 등 외부 제어 패널 주입 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'topNotice',
      value: previewTopNoticeEnabled ? 'enabled' : 'disabled',
      description: '공용 캔버스 상단 알림 주입 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'showWorkspaceMessages',
      value: previewShowWorkspaceMessages ? 'true' : 'false',
      description: '상자 편집 캔버스 내부 실행 알림(message) 출력 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'suppressInitialDraftLoadedMessage',
      value: previewSuppressInitialDraftLoadedMessage ? 'true' : 'false',
      description: '초기 초안 로드 알림을 억제합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'headerTitle',
      value: previewHeaderTitle,
      description: '공용 캔버스 내부 헤더 제목입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'headerDescription',
      value: previewHeaderDescription,
      description: '공용 캔버스 내부 헤더 설명입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'nameFieldLabel',
      value: previewNameFieldLabel,
      description: '이름 입력 필드의 라벨입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'saveButtonLabel',
      value: previewSaveButtonLabel,
      description: '저장 버튼에 표시되는 문구입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'templateNameReadOnly',
      value: previewTemplateNameReadOnly ? 'true' : 'false',
      description: '이름 입력 필드를 읽기 전용으로 둘지 정합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'saveDisabled',
      value: previewSaveDisabled ? 'true' : 'false',
      description: '저장 버튼의 실제 비활성 상태입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'defaultCanvasFullscreen',
      value: previewWorkspaceProps.defaultCanvasFullscreen ? 'true' : 'false',
      description: '상자 편집 캔버스의 초기 전체 화면 활성 상태입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasPageContainerWidth',
      value: previewCanvasPageContainerWidth || 'not passed',
      description: '상자 편집 캔버스가 놓이는 페이지 컨테이너 폭입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasPageContainerHeight',
      value: previewCanvasPageContainerHeight || 'not passed',
      description: '상자 편집 캔버스가 놓이는 페이지 컨테이너 높이입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasSpecifiedHeightEnabled',
      value: previewCanvasSpecifiedHeightEnabled ? 'true' : 'false',
      description: '자동 높이를 끄고 편집부 높이를 직접 지정하는지 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasSpecifiedHeight',
      value: previewCanvasSpecifiedHeight || 'not passed',
      description: '자동 높이가 OFF일 때 편집부에 적용되는 높이 값입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasSpecifiedWidthEnabled',
      value: previewCanvasSpecifiedWidthEnabled ? 'true' : 'false',
      description: '자동 너비를 끄고 캔버스 컨테이너 너비를 직접 지정하는지 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasSpecifiedWidth',
      value: previewCanvasSpecifiedWidth || 'not passed',
      description: '자동 너비가 OFF일 때 캔버스 컨테이너에 적용되는 너비 값입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'documentAttachmentApiPath',
      value: previewDocumentAttachmentApiPath || '-',
      description: '문서 모드 첨부파일 API 경로입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasToolbarVisibility',
      value: previewCanvasToolbarVisibility ? 'enabled' : 'not passed',
      description: '상자 캔버스 편집 영역 안의 제목과 툴바 항목별 표시 설정입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'persistenceVisibility',
      value: previewPersistenceVisibility ? 'enabled' : 'not passed',
      description: '불러오기 및 저장 패널 안의 항목별 표시 설정입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'onTemplateSaved',
      value:
        selectedAccessMode === 'edit' &&
        effectiveWorkspaceMode === 'template' &&
        (selectedManagedPage.id === 'templates' || (!routeEquivalentPreviewEnabled && settings.enableOnTemplateSaved))
          ? 'enabled'
          : 'disabled',
      description: '템플릿 저장 후 owner 페이지 콜백 연결 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'onSaveDraftHtml',
      value: selectedAccessMode === 'edit' && effectiveWorkspaceMode === 'document' ? 'enabled' : 'disabled',
      description: '문서 모드 저장 콜백 연결 여부입니다.',
    },
    ...(previewCanvasToolbarVisibility ? Object.entries(previewCanvasToolbarVisibility) : []).map(([name, value]) => ({
      section: 'canvasToolbarVisibility',
      name,
      value: value ? 'true' : 'false',
      description: '상자 캔버스 편집 영역의 항목별 실제 표시 여부입니다. 모드 정책이 반영된 effective 값입니다.',
    })),
    ...(previewPersistenceVisibility ? Object.entries(previewPersistenceVisibility) : []).map(([name, value]) => ({
      section: 'persistenceVisibility',
      name,
      value: value ? 'true' : 'false',
      description: '불러오기 및 저장 패널의 항목별 실제 표시 여부입니다.',
    })),
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'stabilizeInitialLayout',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.stabilizeInitialLayout),
      description: '미리보기 HTML 생성 직후 숨김 측정으로 자동 크기와 peer edge 배치를 확정합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'enableInitialAutoSize',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.enableInitialAutoSize),
      description: '런타임 연결 직후 자동 크기 계산을 한 번 더 실행합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'preventInitialValueClearShrink',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.preventInitialValueClearShrink),
      description: '자동 크기 대상이 아닌 프레임의 미리보기 진입 1회성 축소만 차단합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'preventRuntimeAutoSizeShrink',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.preventRuntimeAutoSizeShrink),
      description: '입력/첨부/서명 이후 런타임 자동 크기 축소를 차단합니다. 기본 OFF입니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'measurePeerClusterHeightTargets',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.measurePeerClusterHeightTargets),
      description: '자동 높이 측정에서 peer cluster 높이 대상을 포함합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'measurePeerClusterWidthTargets',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.measurePeerClusterWidthTargets),
      description: '자동 너비 측정에서 peer cluster 너비 대상을 포함합니다.',
    },
  ];
  const effectiveTemplateWorkspacePropSections = [
    {
      key: 'pageRouting',
      sourceSection: 'Page routing',
      label: '페이지',
      definitionName: 'managedCanvasPage',
      description: '공용 캔버스를 사용하는 서비스 페이지와 그 페이지의 모드 정책입니다.',
    },
    {
      key: 'ownerPolicy',
      sourceSection: 'Owner policy',
      label: 'Owner 정책',
      definitionName: 'Owner policy',
      description: 'CanvasOwnedWorkspace가 공용 캔버스 사용 경로와 모드를 검증하는 값입니다.',
    },
    {
      key: 'workspaceProps',
      sourceSection: 'TemplateEditWorkspaceProps',
      label: '워크스페이스 전달값',
      definitionName: 'TemplateEditWorkspaceProps',
      description: '공용 캔버스 컴포넌트에 실제로 전달되는 public props입니다.',
    },
    {
      key: 'usagePreviewLayout',
      sourceSection: 'templateUsagePreviewLayoutDebugOptions',
      label: '미리보기/자동 크기',
      definitionName: 'templateUsagePreviewLayoutDebugOptions',
      description: '미리보기 진입, 자동 높이/너비, peer edge 런타임 계산 옵션입니다.',
    },
    {
      key: 'canvasToolbarVisibility',
      sourceSection: 'canvasToolbarVisibility',
      label: '상자 캔버스 편집 표시',
      definitionName: 'canvasToolbarVisibility',
      description: '상자 편집 캔버스 카드 안에서 실제로 보이는 툴바 항목입니다.',
    },
    {
      key: 'persistenceVisibility',
      sourceSection: 'persistenceVisibility',
      label: '불러오기 및 저장 표시',
      definitionName: 'persistenceVisibility',
      description: '불러오기 및 저장 패널 안에서 실제로 보이는 항목입니다.',
    },
  ].map((section) => ({
    ...section,
    rows: effectiveTemplateWorkspacePropRows.filter((row) => row.section === section.sourceSection),
  }));
  const renderWorkspaceModeButtons = () => (
    <div className="grid gap-1.5">
      {(['template', 'document', 'read'] as CanvasWorkspaceMode[]).map((mode) => {
        const active = workspaceMode === mode;
        const allowed = selectedManagedPage.allowedModes.includes(mode);

        return (
          <Button
            key={mode}
            type="button"
            variant={active ? 'default' : 'outline'}
            className="h-auto min-h-9 justify-start px-2 py-1.5 text-left text-xs"
            disabled={!allowed}
            onClick={() => handleSelectWorkspaceMode(mode)}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{modeLabels[mode]}</span>
              <span className="block truncate text-[10px] font-normal opacity-80">
                {allowed ? '이 페이지에서 사용 가능' : '이 페이지 정책에서 제외'}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
  const renderManagedPageControls = () => (
    <div className="space-y-3">
      <div className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
        {managedCanvasPages.map((page) => {
          const active = page.id === selectedManagedPage.id;

          return (
            <Button
              key={page.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              className="h-auto w-full justify-start px-2 py-2 text-left"
              onClick={() => handleSelectManagedPage(page.id)}
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-xs font-semibold">{page.label}</span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-normal opacity-80">{page.path}</span>
              </span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{selectedManagedPage.label}</div>
            <div className="mt-0.5 truncate text-[10px] text-slate-500">{selectedManagedPage.description}</div>
          </div>
          <Badge variant="slate" className="shrink-0 px-2 py-0 text-[10px]">
            {selectedManagedPage.surface}
          </Badge>
        </div>
        <div className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[72px_minmax(0,1fr)]">
          <div className="font-medium text-slate-600">route</div>
          <div className="truncate text-slate-900">{selectedManagedPage.path}</div>
          <div className="font-medium text-slate-600">기본 모드</div>
          <div className="truncate text-slate-900">{modeLabels[selectedManagedPage.defaultMode]}</div>
          <div className="font-medium text-slate-600">허용 모드</div>
          <div className="flex flex-wrap gap-1">
            {selectedManagedPage.allowedModes.map((mode) => (
              <Badge key={mode} variant={workspaceMode === mode ? 'blue' : 'slate'} className="px-1.5 py-0 text-[9px]">
                {mode}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-800">이 페이지에서 사용할 모드</div>
        {renderWorkspaceModeButtons()}
      </div>
    </div>
  );
  const renderModeControls = () => (
    <div className="space-y-2.5">
      <div className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
        <div className="font-semibold text-slate-900">{selectedManagedPage.label}</div>
        <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
          모드는 선택한 페이지의 owner policy 안에서만 변경할 수 있습니다.
        </div>
      </div>
      {renderWorkspaceModeButtons()}
      <p className="text-xs leading-5 text-slate-500">{modeDescriptions[workspaceMode]}</p>
    </div>
  );
  const renderAccessRolePolicySettings = () => (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-0.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <div className="shrink-0 text-[11px] font-semibold leading-3 text-slate-800">권한자별 접근</div>
          <div className="min-w-0 truncate text-[10px] leading-3 text-slate-500">
            선택한 페이지에서 문서 권한자가 사용할 수 있는 조작과 표시 색상을 정합니다.
          </div>
        </div>
        <Badge variant="slate" className="shrink-0 px-2 py-0 text-[9px]">
          {selectedManagedPage.label}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
        <span className="font-semibold text-slate-900">{canvasAccessRoleLabels[selectedCanvasAccessRole]}</span>
        <span>{selectedAccessMode === 'edit' ? '편집 가능' : '보기 전용'}</span>
        <span className="text-slate-400">/</span>
        <span>적용 모드: {modeLabels[effectiveWorkspaceMode]}</span>
        {accessPreviewUnavailable ? (
          <span className="font-medium text-amber-700">문서 기반 화면에서 선택한 권한자의 캔버스 상태를 확인합니다.</span>
        ) : null}
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {canvasAccessRoles.map((role) => {
          const policy = selectedPageAccessRolePolicies[role];
          const effectiveAccessMode = resolveEffectiveCanvasAccessMode(role, policy);
          const active = role === selectedCanvasAccessRole;
          const accessModeOptions: Array<{ value: CanvasAccessMode; label: string; disabled?: boolean }> = [
            { value: 'edit', label: '편집', disabled: role !== 'editor' },
            { value: 'view', label: '보기' },
          ];

          return (
            <div
              key={role}
              role="button"
              tabIndex={0}
              className={`space-y-2 rounded-lg border bg-white p-3 text-left outline-none ${
                active ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
              }`}
              onClick={() => handleSelectAccessRole(role)}
              onKeyDown={(event) => {
                if (event.currentTarget !== event.target) {
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSelectAccessRole(role);
                }
              }}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="truncate text-xs font-semibold text-slate-900">{canvasAccessRoleLabels[role]}</div>
                    {active ? (
                      <Badge variant="blue" className="shrink-0 px-1.5 py-0 text-[9px]">
                        선택됨
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                    {effectiveAccessMode === 'edit'
                      ? '텍스트, 첨부파일, 서명, 저장을 사용할 수 있습니다.'
                      : '전체 화면과 확대/축소만 사용할 수 있습니다.'}
                  </div>
                </div>
                <span
                  className="inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[10px] font-semibold"
                  style={{
                    borderColor: policy.accentColor,
                    backgroundColor: policy.backgroundColor,
                    color: policy.textColor,
                  }}
                >
                  {policy.badgeLabel}
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700">접근 권한</label>
                <OptionButtonGroup
                  value={policy.accessMode}
                  options={accessModeOptions}
                  onChange={(value) => updateAccessRolePolicy(role, { accessMode: value })}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">권한 이름</label>
                  <Input
                    className={compactInputClassName}
                    value={policy.label}
                    onChange={(event) => updateAccessRolePolicy(role, { label: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">배지 문구</label>
                  <Input
                    className={compactInputClassName}
                    value={policy.badgeLabel}
                    onChange={(event) => updateAccessRolePolicy(role, { badgeLabel: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['accentColor', '테두리'],
                  ['backgroundColor', '배경'],
                  ['textColor', '글자'],
                ] as Array<[keyof Pick<CanvasAccessRolePolicy, 'accentColor' | 'backgroundColor' | 'textColor'>, string]>).map(
                  ([key, label]) => (
                    <label key={key} className="space-y-1 text-[11px] font-medium text-slate-700">
                      <span>{label}</span>
                      <input
                        type="color"
                        value={policy[key]}
                        className="h-8 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                        onChange={(event) => updateAccessRolePolicy(role, { [key]: event.target.value })}
                      />
                    </label>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
  const renderCanvasSizeSettings = () => (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-0.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <div className="shrink-0 text-[11px] font-semibold leading-3 text-slate-800">출력 크기</div>
          <div className="min-w-0 truncate text-[10px] leading-3 text-slate-500">
            자동 크기를 끄면 상자 편집 캔버스 출력 크기를 직접 지정합니다.
          </div>
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <div className={`space-y-2 rounded border px-2 py-1.5 ${getModeManagedClassName('autoCanvasHeight')}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                <span>자동 높이</span>
                {renderSettingSourceBadge('autoCanvasHeight')}
              </div>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                ON이면 기본 높이 정책을 사용하고, OFF이면 아래 높이 값으로 편집부를 고정합니다.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={settings.autoCanvasHeight ? 'default' : 'outline'}
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => updateSetting('autoCanvasHeight', !settings.autoCanvasHeight)}
            >
              {settings.autoCanvasHeight ? 'ON' : 'OFF'}
            </Button>
          </div>
          {settings.autoCanvasHeight ? null : (
            <div className={getTextSettingClassName('specifiedCanvasHeight')}>
              <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
                <span>높이 값</span>
                {renderSettingSourceBadge('specifiedCanvasHeight')}
              </label>
              <Input
                className={compactInputClassName}
                placeholder="예: 70vh, 640px, calc(100vh - 240px)"
                value={settings.specifiedCanvasHeight}
                onChange={(event) => updateSetting('specifiedCanvasHeight', event.target.value)}
              />
              <p className="text-[10px] leading-4 text-slate-500">
                입력 가능 단위: px, %, vh, dvh, svh, rem, 또는 calc(...) 표현식입니다.
              </p>
            </div>
          )}
        </div>
        <div className={`space-y-2 rounded border px-2 py-1.5 ${getModeManagedClassName('autoCanvasWidth')}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                <span>자동 너비</span>
                {renderSettingSourceBadge('autoCanvasWidth')}
              </div>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                ON이면 페이지 레이아웃 폭을 따르고, OFF이면 아래 너비 값으로 캔버스 컨테이너를 고정합니다.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={settings.autoCanvasWidth ? 'default' : 'outline'}
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => updateSetting('autoCanvasWidth', !settings.autoCanvasWidth)}
            >
              {settings.autoCanvasWidth ? 'ON' : 'OFF'}
            </Button>
          </div>
          {settings.autoCanvasWidth ? null : (
            <div className={getTextSettingClassName('specifiedCanvasWidth')}>
              <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
                <span>너비 값</span>
                {renderSettingSourceBadge('specifiedCanvasWidth')}
              </label>
              <Input
                className={compactInputClassName}
                placeholder="예: 100%, 960px, min(100%, 1280px)"
                value={settings.specifiedCanvasWidth}
                onChange={(event) => updateSetting('specifiedCanvasWidth', event.target.value)}
              />
              <p className="text-[10px] leading-4 text-slate-500">
                입력 가능 단위: px, %, vw, dvw, rem, min(...), max(...), clamp(...), 또는 calc(...) 표현식입니다.
              </p>
            </div>
          )}
      </div>
      </div>
    </div>
  );
  const renderCanvasTextSettings = () => (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <div className={getTextSettingClassName('headerTitle')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>headerTitle</span>
          {renderSettingSourceBadge('headerTitle')}
        </label>
        <Input className={compactInputClassName} value={settings.headerTitle} onChange={(event) => updateSetting('headerTitle', event.target.value)} />
      </div>
      <div className={getTextSettingClassName('headerDescription')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>headerDescription</span>
          {renderSettingSourceBadge('headerDescription')}
        </label>
        <Input
          className={compactInputClassName}
          value={settings.headerDescription}
          onChange={(event) => updateSetting('headerDescription', event.target.value)}
        />
      </div>
      <div className={getTextSettingClassName('nameFieldLabel')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>nameFieldLabel</span>
          {renderSettingSourceBadge('nameFieldLabel')}
        </label>
        <Input
          className={compactInputClassName}
          value={settings.nameFieldLabel}
          onChange={(event) => updateSetting('nameFieldLabel', event.target.value)}
        />
      </div>
      <div className={getTextSettingClassName('saveButtonLabel')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>saveButtonLabel</span>
          {renderSettingSourceBadge('saveButtonLabel')}
        </label>
        <Input
          className={compactInputClassName}
          value={settings.saveButtonLabel}
          onChange={(event) => updateSetting('saveButtonLabel', event.target.value)}
        />
      </div>
      <div className={getTextSettingClassName('templateListDisplay')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>templateListDisplay</span>
          {renderSettingSourceBadge('templateListDisplay')}
        </label>
        <OptionButtonGroup
          value={settings.templateListDisplay}
          onChange={(value) => updateSetting('templateListDisplay', value)}
          options={[
            { value: 'picker', label: 'picker' },
            { value: 'inline', label: 'inline' },
          ]}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-700">draftKey</label>
        <Button type="button" variant="outline" className="h-8 w-full px-2 text-[11px]" onClick={() => setDraftReloadNonce((previous) => previous + 1)}>
          초안 다시 적용
        </Button>
      </div>
    </div>
  );
  const renderCanvasConfigSections = () => (
    <div className="space-y-1.5">
      {canvasConfigSections.map((section) =>
        section.rows.length > 0 ? (
          <div key={section.key} className="space-y-1">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-0.5">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <div className="shrink-0 text-[11px] font-semibold leading-3 text-slate-800">{section.label}</div>
                <div className="min-w-0 truncate text-[10px] leading-3 text-slate-500">{section.description}</div>
              </div>
              <span className="shrink-0 text-[9px] font-semibold text-slate-400">
                {section.rows.length}개
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {section.rows.map((row) => {
                const settingKey = getSettingKeyForDefinitionName(row.definitionName);

                return (
                  <SettingToggleRow
                    key={row.definitionName}
                    label={row.label}
                    sectionLabel={row.sectionLabel}
                    definitionName={`${row.definitionName}${settingKey ? ` · ${getSettingSourceLabel(settingSources[settingKey])}` : ''}`}
                    description={row.description}
                    checked={row.checked}
                    disabled={row.disabled}
                    className={getModeManagedClassName(settingKey)}
                    onCheckedChange={row.onCheckedChange}
                  />
                );
              })}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
  const renderEffectiveTemplateWorkspaceProps = () => (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-0.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <div className="shrink-0 text-[11px] font-semibold leading-3 text-slate-800">전달 prop 전체</div>
          <div className="min-w-0 truncate text-[10px] leading-3 text-slate-500">
            CanvasOwnedWorkspace를 거쳐 TemplateEditWorkspace에 실제로 전달되는 effective 값입니다.
          </div>
        </div>
        <span className="shrink-0 text-[9px] font-semibold text-slate-400">{effectiveTemplateWorkspacePropRows.length}개</span>
      </div>
      {effectiveTemplateWorkspacePropSections.map((section) =>
        section.rows.length > 0 ? (
          <div key={section.key} className="space-y-1">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-0.5">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <div className="shrink-0 text-[11px] font-semibold leading-3 text-slate-800">{section.label}</div>
                <div className="shrink-0 text-[10px] font-medium leading-3 text-slate-500">{section.definitionName}</div>
                <div className="min-w-0 truncate text-[10px] leading-3 text-slate-500">{section.description}</div>
              </div>
              <span className="shrink-0 text-[9px] font-semibold text-slate-400">{section.rows.length}개</span>
            </div>
            <div className="grid gap-1 md:grid-cols-2 2xl:grid-cols-3">
              {section.rows.map((row) => (
                <div key={`${row.section}:${row.name}`} className="min-w-0 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700">
                  <div className="flex min-w-0 items-center gap-1 leading-3">
                    <span className="min-w-0 truncate font-semibold text-slate-800">{row.name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold leading-[11px] text-blue-700" title={row.value}>
                    {row.value}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] leading-[11px] text-slate-500" title={row.description}>
                    {row.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-6 py-6">
        <header className="space-y-3">
          <Badge variant="blue">CANVAS-OWNER-01</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-950">상자 편집 캔버스</h1>
            <p className="max-w-4xl text-sm text-slate-600">
              모든 문서 출력의 기준이 되는 owner 페이지입니다. 이 화면에서 템플릿 편집, 문서 기록, 읽기 전용 상태를 직접 확인하고 공용 캔버스의 모드별 동작을 검증할 수 있습니다.
            </p>
          </div>
        </header>

        {message ? (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
          </Card>
        ) : null}

        {ownerEventMessage ? (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-4 text-sm text-slate-700">{ownerEventMessage}</CardContent>
          </Card>
        ) : null}

        {selectedManagedPage.id === 'templates' ? null : extractStatusNotice}

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="border-slate-200">
            <CardHeader className="space-y-1 p-4 pb-3">
              <CardTitle className="text-sm">공용 캔버스 관리</CardTitle>
              <CardDescription className="text-xs leading-5">
                페이지와 모드를 분리해서 선택합니다. 페이지 탭에서 공용 캔버스를 쓰는 모든 경로를 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div role="tablist" aria-label="공용 캔버스 관리 탭" className="grid grid-cols-2 gap-1.5">
                {(['page', 'mode'] as CanvasOwnerControlTab[]).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    size="sm"
                    variant={activeControlTab === tab ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    role="tab"
                    aria-selected={activeControlTab === tab}
                    onClick={() => setActiveControlTab(tab)}
                  >
                    {tab === 'page' ? '페이지' : '모드'}
                  </Button>
                ))}
              </div>
              {activeControlTab === 'page' ? renderManagedPageControls() : renderModeControls()}
            </CardContent>
          </Card>

	          {effectiveWorkspaceMode === 'template' ? (
	            <Card className="border-slate-200">
	              <CardHeader className="space-y-1 p-4 pb-3">
	                <CardTitle className="text-sm">현재 템플릿</CardTitle>
	                <CardDescription className="text-xs leading-5">템플릿 선택 상태를 확인합니다.</CardDescription>
	              </CardHeader>
	              <CardContent className="space-y-3 p-4 pt-0 text-sm text-slate-700">
	                <div className="grid gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-xs sm:grid-cols-[72px_minmax(0,1fr)]">
	                  <div className="font-medium text-slate-700">이름</div>
	                  <div className="truncate text-slate-900">{selectedTemplateSummary?.templateName || '아직 선택되지 않음'}</div>
	                  <div className="font-medium text-slate-700">ID</div>
	                  <div className="truncate text-slate-500">{selectedTemplateSummary?.id || '-'}</div>
	                </div>
	              </CardContent>
	            </Card>
	          ) : (
            <Card className="border-slate-200">
              <CardHeader className="space-y-1 p-4 pb-3">
                <CardTitle className="text-sm">문서 선택</CardTitle>
                <CardDescription className="text-xs leading-5">문서 선택 상태와 public prop 설정을 함께 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <EntityPicker
                  value={selectedDocumentId}
                  options={documentOptions}
                  onChange={(value) => updateQuery({ documentId: value })}
                  placeholder="문서를 고르세요"
                  searchPlaceholder="문서 검색"
                  optionLayout="stacked"
                  disabled={loadingLists}
                />

                {selectedDocumentDetail ? (
                  <div className="grid gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-xs sm:grid-cols-[88px_minmax(0,1fr)]">
                    <div className="font-medium text-slate-700">문서명</div>
                    <div className="truncate text-slate-900">{selectedDocumentDetail.document.title}</div>
                    <div className="font-medium text-slate-700">문서 ID</div>
                    <div className="truncate text-slate-500">{selectedDocumentDetail.document.id}</div>
                    <div className="font-medium text-slate-700">현재 버전</div>
                    <div className="truncate text-slate-700">{selectedDocumentDetail.latestVersion?.versionNumber || '-'}</div>
                    <div className="font-medium text-slate-700">마지막 저장</div>
                    <div className="truncate text-slate-700">{formatDateTime(selectedDocumentDetail.latestVersion?.createdAt)}</div>
                    <div className="font-medium text-slate-700">연결 템플릿</div>
                    <div className="truncate text-slate-700">{selectedDocumentDetail.linkedTemplate?.templateName || '-'}</div>
                    <div className="font-medium text-slate-700">editable 키</div>
                    <div className="truncate text-slate-700">
                      editableValueKeys 샘플:{' '}
                      {editableValueKeyCandidates.length ? editableValueKeyCandidates.join(', ') : '문서 값 키 없음'}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {loadingDocumentDetail ? '문서 상세를 불러오는 중입니다.' : '문서를 선택하면 여기에서 현재 상태를 확인합니다.'}
                  </p>
                )}

	              </CardContent>
	            </Card>
	          )}

	          <Card className="border-slate-200 xl:col-span-2">
	            <CardHeader className="p-4 pb-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
	                    <CardTitle className="text-sm">상자 편집 캔버스 환경설정</CardTitle>
	                    <CardDescription className="text-xs leading-5">
	                      {activeSettingsScope === 'page'
	                        ? `${selectedManagedPage.label} · ${canvasAccessRoleLabels[selectedCanvasAccessRole]} · ${modeLabels[effectiveWorkspaceMode]} 설정을 편집합니다. 회색 항목은 모드 설정에서 관리 중이며, 변경하면 페이지 권한 설정이 우선됩니다.`
	                        : `${canvasAccessRoleLabels[selectedCanvasAccessRole]} · ${modeLabels[effectiveWorkspaceMode]} 설정을 편집합니다. 페이지 권한 설정이 있는 항목은 실제 출력에서 페이지 설정이 우선됩니다.`}
	                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={hasUnsavedCanvasSettings ? 'amber' : 'green'} className="px-2 py-0 text-[10px]">
                      {hasUnsavedCanvasSettings ? '저장 전' : '저장됨'}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasUnsavedCanvasSettings}
                      onClick={resetCanvasOwnerSettings}
                    >
                      되돌리기
                    </Button>
                    <Button type="button" size="sm" disabled={!hasUnsavedCanvasSettings} onClick={saveCanvasOwnerSettings}>
                      설정 저장
                    </Button>
                  </div>
                </div>
		            </CardHeader>
		            <CardContent className="space-y-3 p-4 pt-0">
		              {renderAccessRolePolicySettings()}
		              {renderCanvasSizeSettings()}
		              {renderCanvasTextSettings()}
		              {renderCanvasConfigSections()}
	              {renderEffectiveTemplateWorkspaceProps()}
	            </CardContent>
	          </Card>

	          <div className="space-y-3 xl:col-span-2">
	            <Divider
                label={`공용 캔버스 · ${selectedManagedPage.label} · ${canvasAccessRoleLabels[selectedCanvasAccessRole]}`}
                className="py-0"
              />
              <div
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"
                style={{
                  borderColor: selectedAccessRolePolicy.accentColor,
                  backgroundColor: selectedAccessRolePolicy.backgroundColor,
                  color: selectedAccessRolePolicy.textColor,
                }}
              >
                <span className="font-semibold">{selectedAccessRolePolicy.badgeLabel}</span>
                <span>{selectedAccessMode === 'edit' ? '편집 가능' : '보기 전용'}</span>
                <span className="opacity-60">/</span>
                <span>
                  {selectedAccessMode === 'edit'
                    ? '텍스트, 첨부파일, 서명, 저장을 사용할 수 있습니다.'
                    : '전체 화면과 확대/축소만 사용할 수 있습니다.'}
                </span>
              </div>
              {accessPreviewUnavailable ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-800">
                  선택한 권한자의 캔버스 상태는 문서를 선택할 수 있는 화면에서 확인합니다.
                </div>
              ) : effectiveWorkspaceMode === 'template' ? (
	              <CanvasOwnedWorkspace
	                key={`canvas-owner:${selectedManagedPage.id}:${selectedCanvasAccessRole}:${effectiveWorkspaceMode}:${selectedTemplateId || 'no-template'}`}
	                surface={selectedManagedPage.surface}
                  canvasAccessRole={selectedCanvasAccessRole}
	                applyStoredCanvasOwnerSettings={false}
	                initialTemplateId={selectedTemplateId}
	                templateListDisplay={previewTemplateListDisplay}
	                hideHeader={previewHideHeader}
	                hidePersistencePanel={previewHidePersistencePanel}
	                additionalControlPanels={previewAdditionalControlPanels}
	                topNotice={previewTopNotice}
	                showWorkspaceMessages={previewShowWorkspaceMessages}
	                suppressInitialDraftLoadedMessage={previewSuppressInitialDraftLoadedMessage}
	                headerTitle={previewHeaderTitle}
	                headerDescription={previewHeaderDescription}
	                nameFieldLabel={previewNameFieldLabel}
	                saveButtonLabel={previewSaveButtonLabel}
	                templateNameReadOnly={previewTemplateNameReadOnly}
	                saveDisabled={previewSaveDisabled}
	                defaultCanvasFullscreen={previewWorkspaceProps.defaultCanvasFullscreen}
	                canvasPageContainerWidth={previewCanvasPageContainerWidth}
	                canvasPageContainerHeight={previewCanvasPageContainerHeight}
	                canvasSpecifiedHeightEnabled={previewCanvasSpecifiedHeightEnabled}
	                canvasSpecifiedHeight={previewCanvasSpecifiedHeight}
	                canvasSpecifiedWidthEnabled={previewCanvasSpecifiedWidthEnabled}
	                canvasSpecifiedWidth={previewCanvasSpecifiedWidth}
	                canvasToolbarVisibility={previewCanvasToolbarVisibility}
	                persistenceVisibility={previewPersistenceVisibility}
	                templateUsagePreviewLayoutDebugOptions={previewTemplateUsagePreviewLayoutDebugOptions}
	                onTemplateSaved={
                    selectedAccessMode !== 'edit'
                      ? undefined
                      : selectedManagedPage.id === 'templates'
	                    ? () => setOwnerEventMessage('템플릿 생성 페이지의 onTemplateSaved 콜백이 실행되었습니다.')
	                    : !routeEquivalentPreviewEnabled && settings.enableOnTemplateSaved
	                      ? (template) => setOwnerEventMessage(`onTemplateSaved 콜백: ${template.templateName} (${template.id})`)
	                      : undefined
	                }
	              />
	            ) : selectedDocumentInitialDraft ? (
	              <CanvasOwnedWorkspace
	                key={`canvas-owner:${selectedManagedPage.id}:${selectedCanvasAccessRole}:${selectedDocumentInitialDraft.draftKey}`}
	                surface={selectedManagedPage.surface}
                  canvasAccessRole={selectedCanvasAccessRole}
	                applyStoredCanvasOwnerSettings={false}
	                initialDraft={selectedDocumentInitialDraft}
	                workspaceMode={effectiveWorkspaceMode}
	                editableValueKeys={previewEditableValueKeys}
	                hideHeader={previewHideHeader}
	                hidePersistencePanel={previewHidePersistencePanel}
	                additionalControlPanels={previewAdditionalControlPanels}
	                topNotice={previewTopNotice}
	                showWorkspaceMessages={previewShowWorkspaceMessages}
	                suppressInitialDraftLoadedMessage={previewSuppressInitialDraftLoadedMessage}
	                headerTitle={previewHeaderTitle}
	                headerDescription={previewHeaderDescription}
	                nameFieldLabel={previewNameFieldLabel}
	                saveButtonLabel={previewSaveButtonLabel}
	                templateNameReadOnly={previewTemplateNameReadOnly}
	                saveDisabled={previewSaveDisabled}
	                defaultCanvasFullscreen={previewWorkspaceProps.defaultCanvasFullscreen}
	                canvasPageContainerWidth={previewCanvasPageContainerWidth}
	                canvasPageContainerHeight={previewCanvasPageContainerHeight}
	                canvasSpecifiedHeightEnabled={previewCanvasSpecifiedHeightEnabled}
	                canvasSpecifiedHeight={previewCanvasSpecifiedHeight}
	                canvasSpecifiedWidthEnabled={previewCanvasSpecifiedWidthEnabled}
	                canvasSpecifiedWidth={previewCanvasSpecifiedWidth}
	                documentAttachmentApiPath={previewDocumentAttachmentApiPath}
	                canvasToolbarVisibility={previewCanvasToolbarVisibility}
	                persistenceVisibility={previewPersistenceVisibility}
	                templateUsagePreviewLayoutDebugOptions={previewTemplateUsagePreviewLayoutDebugOptions}
	                onSaveDraftHtml={
                    selectedAccessMode === 'edit' && effectiveWorkspaceMode === 'document'
                      ? handleSaveDocumentDraft
                      : undefined
                  }
	              />
            ) : (
              <div className="px-6 py-12 text-sm text-slate-500">
                {loadingDocumentDetail ? '문서 초안을 준비하는 중입니다.' : '문서를 선택하면 공용 캔버스가 여기에 표시됩니다.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
